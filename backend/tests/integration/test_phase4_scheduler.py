"""Phase 4 integration tests: scheduler, watchlists, deduplication, budgets."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
import asyncio
from uuid import uuid4
from unittest import mock

import pytest

from app.agents.graph import run_research
from app.agents.service import ResearchService
from app.services.scheduler import SchedulerService
from app.schemas.connector import DiscoveryResult, FetchedContent, SourceRecord
from app.schemas.research_state import VerificationStatus, TaskStatus
from app.schemas.source import SourceReference, AccessStatus


def _make_fetch_result(url: str, text: str):
    return type(
        "FetchedContent",
        (),
        {
            "source": SourceReference(
                source_type="web_page",
                canonical_url=url,
                title="Page",
            ),
            "snapshot": type(
                "Snapshot",
                (),
                {
                    "source_id": uuid4(),
                    "retrieved_at": datetime.now(timezone.utc),
                    "content_hash": "hash",
                    "text_content": text,
                    "access_status": AccessStatus.READY,
                    "coverage_json": {},
                },
            )(),
            "warnings": [],
            "error": None,
        },
    )()


def _route_result(data):
    return type(
        "RouteResult",
        (),
        {
            "ok": True,
            "data": data,
            "provider": "ollama",
            "model": "qwen",
            "latency_ms": 100,
            "token_count": 0,
        },
    )()


def _mock_connector(svc, search_texts, url_prefix="https://example.com"):
    async def discover(req):
        recs = []
        for i, t in enumerate(search_texts):
            recs.append(
                SourceReference(
                    source_type="web_search",
                    canonical_url=f"{url_prefix}/p{i}",
                    title=f"Title {i}",
                    access_status=AccessStatus.READY,
                    metadata_json={"snippet": t[:200]},
                )
            )
        return type(
            "DiscoveryResult",
            (),
            {
                "connector_name": "duckduckgo",
                "query": req.query,
                "records": recs,
                "complete": True,
            },
        )()

    async def fetch(ref):
        return _make_fetch_result(str(ref.canonical_url), search_texts[0])

    svc.connector.discover = discover
    svc.connector.fetch = fetch


def _mock_router(svc):
    svc.router.plan_research = lambda q, t: _route_result(
        __import__("app.llm.router", fromlist=["ResearchPlan"]).ResearchPlan(
            sub_topics=[q], reasoning="r"
        )
    )
    svc.router.extract_claims = lambda c, u, st=None: _route_result(
        __import__("app.llm.router", fromlist=["ClaimExtraction"]).ClaimExtraction(
            claims=[
                {
                    "claim_text": "The launched price is $50.",
                    "claim_type": "pricing",
                    "source_url": u,
                    "excerpt": "$50",
                }
            ]
        )
    )
    svc.router.verify_claim = lambda ct, ct2, et, urls: _route_result(
        __import__("app.llm.router", fromlist=["ClaimVerification"]).ClaimVerification(
            verdict="SUPPORTED",
            rationale="Official source confirms.",
            primary_source_url=urls[0] if urls else None,
        )
    )
    svc.router.rank_discovery = lambda t, s, e: _route_result(
        __import__("app.llm.router", fromlist=["DiscoveryScore"]).DiscoveryScore(
            relevance=80, novelty=60, evidence_quality=70, usefulness=90,
            explanation="r",
        )
    )
    svc.router.synthesize_report = lambda *a, **k: _route_result(
        __import__("app.llm.router", fromlist=["FinalReport"]).FinalReport(
            report_md="# Research Report\n\nFindings with sources."
        )
    )


@pytest.fixture
def svc(db_engine):
    return ResearchService(database_url=db_engine.url)


@pytest.fixture
def scheduler(svc):
    return SchedulerService(svc)


def test_watchlist_crud(db_engine):
    """Test watchlist CRUD operations."""
    from app.db.models import Watchlist

    svc = ResearchService(database_url=db_engine.url)

    with svc.session() as session:
        wl = Watchlist(
            name="AI Research",
            topic="AI developments",
            keywords_json=["AI", "machine learning"],
            source_preferences_json=["web_search"],
            enabled=True,
        )
        session.add(wl)
        session.commit()
        session.refresh(wl)

        assert wl.id is not None
        assert wl.name == "AI Research"
        assert wl.topic == "AI developments"
        assert wl.enabled is True
        assert wl.keywords_json == ["AI", "machine learning"]


def test_scheduler_lock_prevents_concurrent_runs(db_engine):
    """Test that the scheduler lock prevents concurrent runs."""
    svc = ResearchService(database_url=db_engine.url)
    scheduler = SchedulerService(svc)

    with svc.session() as session:
        # First acquire should succeed
        owner = str(uuid4())
        result1 = scheduler.acquire_lock(session, "daily_discovery", owner)
        assert result1 is True

        # Second acquire should fail
        result2 = scheduler.acquire_lock(session, "daily_discovery", str(uuid4()))
        assert result2 is False

        # Release the lock
        scheduler.release_lock(session, "daily_discovery", owner, "completed")

        # Now it should be acquirable again
        result3 = scheduler.acquire_lock(session, "daily_discovery", str(uuid4()))
        assert result3 is True


@pytest.mark.parametrize("initial_status", [None, "completed", "failed"])
def test_only_one_independent_session_claims_lock_concurrently(db_engine, initial_status):
    """Initial claims and terminal-row reacquisition must serialize in the DB."""
    svc = ResearchService(database_url=db_engine.url)
    scheduler = SchedulerService(svc)
    if initial_status is not None:
        with svc.session() as session:
            from app.db.models import ScheduledRun

            session.add(ScheduledRun(
                task_id="contended",
                status=initial_status,
                next_run_at=datetime.now(timezone.utc),
            ))
            session.commit()

    barrier = Barrier(2)

    def claim():
        with svc.session() as session:
            barrier.wait()
            return scheduler.acquire_lock(session, "contended")

    with ThreadPoolExecutor(max_workers=2) as pool:
        outcomes = list(pool.map(lambda _: claim(), range(2)))
    assert sorted(outcomes) == [False, True]


def test_expired_running_lock_can_be_recovered(db_engine):
    svc = ResearchService(database_url=db_engine.url)
    scheduler = SchedulerService(svc)
    with svc.session() as session:
        from app.db.models import ScheduledRun

        session.add(ScheduledRun(
            task_id="stale",
            status="running",
            next_run_at=datetime.now(timezone.utc) - timedelta(seconds=1),
            lease_owner=str(uuid4()),
            lease_expires_at=datetime.now(timezone.utc) - timedelta(seconds=1),
        ))
        session.commit()
        assert scheduler.acquire_lock(session, "stale", str(uuid4())) is True


def test_stale_owner_cannot_renew_or_release_after_recovery(db_engine):
    svc = ResearchService(database_url=db_engine.url)
    scheduler = SchedulerService(svc)
    old_owner, new_owner = str(uuid4()), str(uuid4())
    with svc.session() as session:
        from app.db.models import ScheduledRun

        session.add(ScheduledRun(
            task_id="owned",
            status="running",
            lease_owner=old_owner,
            lease_expires_at=datetime.now(timezone.utc) - timedelta(seconds=1),
            next_run_at=datetime.now(timezone.utc),
        ))
        session.commit()
        assert scheduler.acquire_lock(session, "owned", new_owner)
        assert not scheduler.renew_lock(session, "owned", old_owner)
        assert not scheduler.release_lock(session, "owned", old_owner, "completed")
        run = session.query(ScheduledRun).filter_by(task_id="owned").one()
        assert run.status == "running"
        assert run.lease_owner == new_owner


def test_heartbeat_prevents_long_run_lease_expiry(db_engine, monkeypatch):
    from app.services import scheduler as scheduler_module

    svc = ResearchService(database_url=db_engine.url)
    service = SchedulerService(svc)
    service.LOCK_LEASE = timedelta(milliseconds=180)
    service.HEARTBEAT_SECONDS = 0.03
    started, finish = asyncio.Event(), asyncio.Event()

    async def slow_research(*args, **kwargs):
        started.set()
        await finish.wait()
        return {
            "status": "completed", "discovery_ids": [], "sources_discovered": 0,
            "sources_inspected": 0, "sources_succeeded": 0, "sources_failed": 0,
            "sources_unknown_publication_date": 0, "errors": [],
        }

    monkeypatch.setattr(scheduler_module, "run_research", slow_research)

    async def scenario():
        runner = asyncio.create_task(service.run_daily_discovery(query="long task"))
        await started.wait()
        await asyncio.sleep(0.35)  # longer than the lease; heartbeat must renew it.
        owner_two = str(uuid4())
        with svc.session() as session:
            assert not service.acquire_lock(session, "daily_discovery", owner_two)
        finish.set()
        return await runner

    result = asyncio.run(scenario())
    assert result["status"] == "completed"


def test_scheduled_run_consumes_enabled_watchlists(db_engine, monkeypatch):
    from app.services import scheduler as scheduler_module
    from app.db.models import Watchlist

    svc = ResearchService(database_url=db_engine.url)
    with svc.session() as session:
        session.add_all([
            Watchlist(name="AI", topic="AI launches", keywords_json=["release"], enabled=True),
            Watchlist(name="Jobs", topic="AI internships", keywords_json=[], enabled=True),
            Watchlist(name="Off", topic="ignored", keywords_json=[], enabled=False),
        ])
        session.commit()
    seen = []

    async def fake_research(_svc, **kwargs):
        seen.append((kwargs["query"], kwargs["topics"]))
        return {
            "status": "completed", "discovery_ids": [], "sources_discovered": 1,
            "sources_inspected": 1, "sources_succeeded": 1, "sources_failed": 0,
            "sources_unknown_publication_date": 1, "errors": [],
        }

    monkeypatch.setattr(scheduler_module, "run_research", fake_research)
    result = asyncio.run(SchedulerService(svc).run_daily_discovery())
    assert seen == [("AI launches release", ["release"]), ("AI internships", [])]
    assert result["coverage"]["watchlists_processed"] == 2
    assert result["coverage"]["sources_succeeded"] == 2
    assert "Sources checked successfully: 2" in result["digest_md"]


def test_daily_schedule_uses_asia_kolkata_and_rolls_to_next_day():
    before = datetime(2026, 10, 20, 2, 29, tzinfo=timezone.utc)  # 07:59 IST
    next_today = SchedulerService.next_daily_run(before)
    assert next_today == datetime(2026, 10, 20, 2, 30, tzinfo=timezone.utc)
    after = datetime(2026, 10, 20, 2, 31, tzinfo=timezone.utc)  # 08:01 IST
    next_day = SchedulerService.next_daily_run(after)
    assert next_day == datetime(2026, 10, 21, 2, 30, tzinfo=timezone.utc)


def test_unsupported_watchlist_source_preference_is_reported_not_ignored(db_engine, monkeypatch):
    from app.services import scheduler as scheduler_module
    from app.db.models import Watchlist

    svc = ResearchService(database_url=db_engine.url)
    with svc.session() as session:
        session.add(Watchlist(
            name="Reddit", topic="AI discussions", keywords_json=[],
            source_preferences_json=["reddit"], enabled=True,
        ))
        session.commit()

    async def should_not_run(*_args, **_kwargs):
        raise AssertionError("unsupported source preference was silently ignored")

    monkeypatch.setattr(scheduler_module, "run_research", should_not_run)
    result = asyncio.run(SchedulerService(svc).run_daily_discovery())
    assert result["status"] == "partial"
    assert result["coverage"]["watchlists_skipped_unsupported"] == 1
    assert "unsupported sources: 1" in result["digest_md"]


def test_full_research_run_persists(db_engine):
    """Test that a daily discovery run persists discoveries."""
    svc = ResearchService(database_url=db_engine.url)
    scheduler = SchedulerService(svc)
    _mock_connector(svc, ["The launched price is $50. Official details here."])
    _mock_router(svc)

    import asyncio

    final = asyncio.run(
        scheduler.run_daily_discovery(
            query="What is the price of the new tool?",
            topics=["pricing"],
            max_iterations=3,
        )
    )
    # Just verify it runs without error
    assert final is not None
    assert final["status"] in ("completed", "partial")
    assert "report_id" in final


def test_duplicate_suppression(db_engine):
    """Test that running discovery twice suppresses duplicate stories."""
    svc = ResearchService(database_url=db_engine.url)
    scheduler = SchedulerService(svc)
    _mock_connector(svc, ["The launched price is $50. Official details here."], "https://one.example")
    _mock_router(svc)

    import asyncio

    # First run
    final1 = asyncio.run(
        scheduler.run_daily_discovery(
            query="What is the price of the new tool?",
            topics=["pricing"],
            max_iterations=3,
        )
    )
    first_discoveries = final1.get("discovery_ids", [])
    first_claims = len(final1.get("claims", []))

    # Same finding from a different URL reuses one discovery and links both sources.
    _mock_connector(svc, ["The launched price is $50. Official details here."], "https://two.example")
    final2 = asyncio.run(
        scheduler.run_daily_discovery(
            query="What is the price of the new tool?",
            topics=["pricing"],
            max_iterations=3,
        )
    )
    second_discoveries = final2.get("discovery_ids", [])
    second_claims = len(final2.get("claims", []))
    assert second_discoveries == first_discoveries
    assert second_claims <= first_claims
    with svc.session() as session:
        from app.db.models import Discovery, DiscoverySource

        assert session.query(Discovery).count() == 1
        assert session.query(DiscoverySource).count() == 2


def test_source_budget_enforcement(db_engine):
    """Test that source budget is enforced."""
    svc = ResearchService(database_url=db_engine.url)
    scheduler = SchedulerService(svc)
    _mock_connector(svc, ["Result 1", "Result 2", "Result 3", "Result 4", "Result 5"])
    _mock_router(svc)

    import asyncio

    final = asyncio.run(
        scheduler.run_daily_discovery(
            query="test query",
            topics=["test"],
            source_budget=2,  # Limit to 2 sources
            max_iterations=3,
        )
    )
    # Should respect the budget
    sources_inspected = final.get("sources_inspected", 0)
    assert sources_inspected <= 2
    assert final["sources_discovered"] <= 2
    assert final["sources_discovered"] == 2


def test_report_has_citations(db_engine):
    """Test that reports have citations."""
    svc = ResearchService(database_url=db_engine.url)
    scheduler = SchedulerService(svc)
    _mock_connector(svc, ["The launched price is $50. Official details here."])
    _mock_router(svc)

    import asyncio

    final = asyncio.run(
        scheduler.run_daily_discovery(
            query="What is the price of the new tool?",
            topics=["pricing"],
            max_iterations=3,
        )
    )
    # Report should have been generated
    report_id = final.get("report_id")
    assert report_id is not None

    # Verify report was persisted
    with svc.session() as session:
        from app.db.models import Report
        from app.db.models import ScheduledRun

        report = session.query(Report).filter_by(id=report_id).first()
        assert report is not None
        assert report.body_md.startswith("# Research Report")
        scheduled = session.query(ScheduledRun).filter_by(task_id="daily_discovery").one()
        assert scheduled.digest_md == final["digest_md"]
        assert scheduled.coverage_json["sources_succeeded"] > 0
    assert "https://example.com/p0" in final["digest_md"]
    assert final["coverage"]["sources_succeeded"] > 0
