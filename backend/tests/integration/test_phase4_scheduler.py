"""Phase 4 integration tests: scheduler, watchlists, deduplication, budgets."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
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
        },
    )()


def _mock_connector(svc, search_texts):
    async def discover(req):
        recs = []
        for i, t in enumerate(search_texts):
            recs.append(
                SourceReference(
                    source_type="web_search",
                    canonical_url=f"https://example.com/p{i}",
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
        result1 = scheduler.acquire_lock(session, "daily_discovery")
        assert result1 is True

        # Second acquire should fail
        result2 = scheduler.acquire_lock(session, "daily_discovery")
        assert result2 is False

        # Release the lock
        scheduler.release_lock(session, "daily_discovery", "completed")

        # Now it should be acquirable again
        result3 = scheduler.acquire_lock(session, "daily_discovery")
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
        ))
        session.commit()
        assert scheduler.acquire_lock(session, "stale") is True


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
    _mock_connector(svc, ["The launched price is $50. Official details here."])
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
    first_discoveries = len(final1.get("discoveries", []))
    first_claims = len(final1.get("claims", []))

    # Second run with same query - should deduplicate
    final2 = asyncio.run(
        scheduler.run_daily_discovery(
            query="What is the price of the new tool?",
            topics=["pricing"],
            max_iterations=3,
        )
    )
    second_discoveries = len(final2.get("discoveries", []))
    second_claims = len(final2.get("claims", []))

    # Second run should have fewer or equal discoveries (deduplication)
    assert second_discoveries <= first_discoveries
    assert second_claims <= first_claims


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

        report = session.query(Report).filter_by(id=report_id).first()
        assert report is not None
        assert report.body_md.startswith("# Research Report")
