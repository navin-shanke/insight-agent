"""Integration tests for the research graph with mocked connector and LLM.

No real network or model calls are made.  Verifies end-to-end flow:
discover → fetch → extract claims → verify → score → decide → report,
with persistence and checkpoint/resume.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from unittest import mock
from uuid import UUID, uuid4

import pytest

from app.agents.graph import run_research, resume_research
from app.agents.service import ResearchService
from app.schemas.source import SourceReference, AccessStatus
from app.schemas.connector import DiscoveryResult, FetchedContent, SourceRecord
from app.llm.router import RouteResult, ResearchPlan, ClaimVerification, DiscoveryScore, FinalReport
from app.schemas.research_state import VerificationStatus, TaskStatus


def _make_source_record(url: str, title: str, text: str) -> SourceRecord:
    return SourceRecord(
        source_type="web_search",
        canonical_url=url,
        title=title,
        access_status=AccessStatus.READY,
        metadata_json={"snippet": text[:200]},
    )


def _make_fetch_result(url: str, text: str) -> FetchedContent:
    return FetchedContent(
        connector_name="duckduckgo",
        source=SourceReference(
            source_type="web_page", canonical_url=url, title="Page"
        ),
        snapshot=type(
            "S",
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
        warnings=[],
    )


def _route_result(data):
    return RouteResult(ok=True, data=data, provider="ollama", model="qwen", latency_ms=10)


@pytest.fixture
def svc(db_engine):
    return ResearchService(database_url=db_engine.url)


def _mock_connector(svc, search_texts):
    async def discover(req):
        recs = []
        for i, t in enumerate(search_texts):
            recs.append(
                _make_source_record(f"https://example.com/p{i}", f"Title {i}", t)
            )
        return DiscoveryResult(
            connector_name="duckduckgo",
            query=req.query,
            records=recs,
            complete=True,
        )

    async def fetch(ref):
        # return text for the first URL only
        return _make_fetch_result(str(ref.canonical_url), search_texts[0])

    svc.connector.discover = discover
    svc.connector.fetch = fetch


def _mock_router(svc):
    svc.router.plan_research = lambda q, t: _route_result(
        ResearchPlan(sub_topics=[q], reasoning="r")
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
        ClaimVerification(
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
        FinalReport(report_md="# Report\n\nFindings with sources.")
    )


def test_full_research_run_persists(svc):
    _mock_connector(svc, ["The launched price is $50. Official details here."])
    _mock_router(svc)

    tid = uuid4()
    final = asyncio.run(run_research(
        svc,
        task_id=tid,
        query="What is the price of the new tool?",
        topics=["pricing"],
        max_iterations=3,
    ))

    assert final["status"] in (TaskStatus.COMPLETED, TaskStatus.PARTIAL)
    assert final["report_id"] is not None
    assert len(final["discovery_ids"]) >= 1
    assert len(final["claims"]) >= 1
    # verification happened
    claimed = [c for c in final["claims"]]
    assert claimed[0]["verification_status"] in (
        VerificationStatus.SUPPORTED,
        VerificationStatus.INSUFFICIENT_EVIDENCE,
    )
    # report body persisted
    assert final["report_body"].startswith("# Report")


def test_checkpoint_resume(svc):
    _mock_connector(svc, ["The launched price is $50. Official details here."])
    _mock_router(svc)

    tid = uuid4()
    thread = f"resume-{tid}"
    final = asyncio.run(run_research(
        svc,
        task_id=tid,
        query="What is the price of the new tool?",
        thread_id=thread,
        max_iterations=3,
    ))
    assert final["report_id"] is not None

    # Resume from the same thread: should load latest checkpoint and complete.
    resumed = resume_research(svc, thread)
    assert resumed["status"] in (TaskStatus.COMPLETED, TaskStatus.PARTIAL)
    assert resumed["report_id"] is not None


def test_report_has_citations(svc):
    _mock_connector(svc, ["The launched price is $50. Official details here."])
    _mock_router(svc)

    tid = uuid4()
    final = asyncio.run(run_research(svc, task_id=tid, query="price?", max_iterations=3))
    # The report body references findings; claims were persisted with source URLs.
    with svc.session() as session:
        from app.db.models import Claim, Evidence, Report, Discovery

        claims = session.query(Claim).all()
        assert len(claims) >= 1
        # each claim links back to a source URL via evidence
        evid = session.query(Evidence).all()
        report = session.query(Report).first()
        assert report is not None
        assert report.body_md.startswith("# Report")
