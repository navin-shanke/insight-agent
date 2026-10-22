"""Unit tests for Instagram Adaptive Learning and Report Presentation.

Tests:
1. Ingestion with explicit data provenance and missing-metric tracking (never fabricated).
2. Pattern extraction: hook style detection, format breakdown, and averages without zero-substitution.
3. Adaptive strategy profile: sample-based hypotheses, promising pattern generation.
4. User feedback loop: rejection/acceptance directly affects strategy state.
5. Experiment proposal and outcome recording.
6. Report presentation enrichment: structured findings, distinct metric counts, executive summary.
"""

from __future__ import annotations

from datetime import datetime, timezone
import os
import tempfile
import pytest

from app.schemas.api.instagram import (
    InstagramObservationIn,
    InstagramMetrics,
    InstagramFeedbackIn,
    InstagramExperimentIn,
)
from app.services.instagram_learning import (
    InstagramLearningService,
    _extract_hook,
    _extract_hook_type,
    _extract_hashtags,
)
from app.schemas.api.reports import ReportDetailOut, ReportFinding, ReportMetrics
from app.api.v1.reports import _report_to_detail
from app.db.models import Report


@pytest.fixture
def temp_insta_service():
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = os.path.join(tmpdir, "test_insta.sqlite")
        svc = InstagramLearningService(db_path=db_path)
        yield svc


# ---------------------------------------------------------------------------
# 1. Feature Extraction Unit Tests
# ---------------------------------------------------------------------------
def test_hook_and_hashtag_extraction():
    caption = "Stop doing manual AI research!\nHere are 3 tools that automate your workflow.\n#AI #Automation #Productivity"
    
    hook = _extract_hook(caption)
    assert hook == "Stop doing manual AI research!"
    
    hook_type = _extract_hook_type(hook)
    assert hook_type == "problem_statement"

    hashtags = _extract_hashtags(caption)
    assert hashtags == ["ai", "automation", "productivity"]


def test_hook_types():
    assert _extract_hook_type("How to build an AI agent in 10 minutes?") == "question"
    assert _extract_hook_type("The secret nobody is talking about regarding MCP") == "curiosity_gap"
    assert _extract_hook_type("Never hardcode your API keys inside prompt templates") == "problem_statement"
    assert _extract_hook_type("We evaluated 15 open source AI libraries today") == "statement"


# ---------------------------------------------------------------------------
# 2. Ingestion & Missing Metric Provenance
# ---------------------------------------------------------------------------
def test_ingestion_with_missing_metrics_preserved_as_null(temp_insta_service):
    svc = temp_insta_service

    # Observation with only likes reported; views and comments are missing
    obs_in = InstagramObservationIn(
        source_url="https://instagram.com/reel/abc12345",
        account_handle="@airesearcher",
        format="reel",
        caption="Did you know MCP allows local file access?\nHere is how to set it up.",
        collection_method="user_url",
        provenance_notes="User-provided link from public technical account",
        metrics=InstagramMetrics(likes=150, views=None, comments=None),
    )

    out = svc.ingest_observation(obs_in)
    assert out.id is not None
    assert out.hook_type == "question"
    assert out.collection_method == "user_url"
    assert out.provenance_notes == "User-provided link from public technical account"
    assert out.metrics.likes == 150
    assert out.metrics.views is None  # Never fabricated to 0
    assert out.metrics.comments is None

    # Retrieve from DB
    listed = svc.list_observations()
    assert len(listed) == 1
    assert listed[0].metrics.views is None
    assert listed[0].metrics.likes == 150


# ---------------------------------------------------------------------------
# 3. Pattern Extraction & Non-Zero Averaging
# ---------------------------------------------------------------------------
def test_patterns_computes_averages_ignoring_null_metrics(temp_insta_service):
    svc = temp_insta_service

    # Ingest post 1 with views=1000
    svc.ingest_observation(
        InstagramObservationIn(
            source_url="https://instagram.com/p/1",
            format="reel",
            caption="Problem with LangChain agents\nDetails inside.",
            metrics=InstagramMetrics(views=1000, likes=100),
        )
    )

    # Ingest post 2 with views=null (unreported) and likes=50
    svc.ingest_observation(
        InstagramObservationIn(
            source_url="https://instagram.com/p/2",
            format="reel",
            caption="Avoid this common RAG failure mode\nStep 1...",
            metrics=InstagramMetrics(views=None, likes=50),
        )
    )

    patterns = svc.get_patterns()
    assert patterns.total_observations == 2
    reel_fmt = next(f for f in patterns.formats if f.format == "reel")
    assert reel_fmt.count == 2
    assert reel_fmt.percentage == 100.0
    # Average views should be 1000, NOT 500 (1000/2) because post 2 has null views!
    assert reel_fmt.avg_views == 1000.0
    assert reel_fmt.avg_likes == 75.0  # (100 + 50) / 2


# ---------------------------------------------------------------------------
# 4. Adaptive Strategy Profile & Hypothesis Evolution
# ---------------------------------------------------------------------------
def test_strategy_profile_adapts_with_sample_size(temp_insta_service):
    svc = temp_insta_service

    # Initially empty
    profile_0 = svc.get_strategy_profile()
    assert profile_0.sample_size == 0
    assert len(profile_0.promising_patterns) == 0

    # Ingest 3 reels with problem statements
    for i in range(3):
        svc.ingest_observation(
            InstagramObservationIn(
                source_url=f"https://instagram.com/p/{i}",
                format="reel",
                caption=f"Stop making this AI prompting mistake #{i}!\nRead below.",
                metrics=InstagramMetrics(views=500 + i * 100, likes=50),
            )
        )

    profile_1 = svc.get_strategy_profile()
    assert profile_1.sample_size == 3
    assert len(profile_1.promising_patterns) >= 1
    reels_pat = profile_1.promising_patterns[0]
    assert reels_pat.format == "reel"
    assert reels_pat.sample_size == 3
    assert "Sample size 3 posts" in reels_pat.limitations


# ---------------------------------------------------------------------------
# 5. User Feedback Loop Updates Strategy State
# ---------------------------------------------------------------------------
def test_user_rejection_removes_pattern_from_strategy(temp_insta_service):
    svc = temp_insta_service

    # Ingest 2 reels to trigger pattern
    for i in range(2):
        svc.ingest_observation(
            InstagramObservationIn(
                source_url=f"https://instagram.com/p/{i}",
                format="reel",
                caption=f"Stop doing manual data processing #{i}",
            )
        )

    profile_before = svc.get_strategy_profile()
    pattern_id = profile_before.promising_patterns[0].id

    # User explicitly rejects this pattern
    svc.record_feedback(
        InstagramFeedbackIn(
            target_id=pattern_id,
            target_type="pattern",
            action="rejected",
            user_note="Our audience prefers positive educational hooks rather than alarmist ones.",
        )
    )

    profile_after = svc.get_strategy_profile()
    # Pattern is now excluded based on user feedback!
    assert not any(p.id == pattern_id for p in profile_after.promising_patterns)
    assert len(profile_after.user_feedback) == 1
    assert profile_after.user_feedback[0].action == "rejected"


# ---------------------------------------------------------------------------
# 6. Experiment Loop: Proposal & Outcome Recording
# ---------------------------------------------------------------------------
def test_experiment_proposal_and_outcome_recording(temp_insta_service):
    svc = temp_insta_service

    exp = svc.create_experiment(
        InstagramExperimentIn(
            title="Test 3-Second Visual Hook on Carousel Cover",
            proposed_change="Include high-contrast diagram on slide 1",
            evidence_rationale="Observations indicate higher swipe rates on visual diagrams",
            why_it_helps="Improves initial curiosity before caption read",
            evaluation_metric="Swipe-through rate and saves",
            sample_required=4,
            baseline_summary="Baseline 12% swipe-through",
        )
    )
    assert exp.id is not None
    assert exp.status == "proposed"

    # User activates experiment via feedback
    svc.record_feedback(
        InstagramFeedbackIn(
            target_id=exp.id,
            target_type="experiment",
            action="accepted",
        )
    )
    exps = svc.list_experiments()
    active_exp = next(e for e in exps if e.id == exp.id)
    assert active_exp.status == "active"

    # Record measured outcome
    updated = svc.record_experiment_outcome(
        exp.id,
        outcome_summary="Across 4 test carousels, swipe-through averaged 21% vs 12% baseline (+75% relative lift).",
        status="completed",
    )
    assert updated.status == "completed"
    assert "21% vs 12% baseline" in updated.outcome_summary
    assert updated.completed_at is not None


# ---------------------------------------------------------------------------
# 7. Report Presentation Enrichment Unit Test
# ---------------------------------------------------------------------------
def test_report_presentation_extracts_findings_and_distinct_counts():
    body_md = """# Research Report: Model Context Protocol

## Executive Summary
The Model Context Protocol (MCP) is an open-source standard enabling AI models to interact with external tools and resources.

## Key Verified Findings
- Claim: MCP standardizes interactions via JSON-RPC 2.0.
  Status: SUPPORTED
  Source: https://anthropic.com/blog/mcp-intro
  Verification rationale: Official docs explicitly state JSON-RPC 2.0.

- Claim: MCP eliminates custom per-tool glue code.
  Status: PARTIALLY_SUPPORTED
  Source: https://github.com/modelcontextprotocol/servers
  Verification rationale: True for standard tools, but complex legacy backends still require adapters.

- Claim: MCP requires proprietary Anthropic API keys.
  Status: CONTRADICTED
  Source: https://modelcontextprotocol.io/spec
  Verification rationale: Protocol is client-agnostic and runs with local LLMs.

## Evidence Ledger
| Claim | Status | Source | Verification Notes |
|---|---|---|---|
| MCP uses JSON-RPC 2.0 | SUPPORTED | [anthropic.com](https://anthropic.com/blog/mcp-intro) | Confirmed in specification section 2 |
| Protocol is open source | SUPPORTED | [github.com](https://github.com/modelcontextprotocol) | MIT licensed repository |
| Requires paid tokens | CONTRADICTED | [modelcontextprotocol.io](https://modelcontextprotocol.io/spec) | Local stdio transport is free |

## Research Limitations
DuckDuckGo search provider.
"""
    fake_report = Report(
        id="test-rep-001",
        title="Research: Model Context Protocol",
        query="What is MCP?",
        body_md=body_md,
        summary=None,
        limitations="DuckDuckGo provider only.",
        discovery_ids_json=["disc-1", "disc-2", "disc-3"],
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )

    detail = _report_to_detail(fake_report, session=None)
    assert detail.id == "test-rep-001"
    assert "open-source standard enabling AI models" in (detail.executive_summary or "")
    
    # Check distinct metric counts
    assert detail.metrics.total_discoveries_count == 3
    assert detail.metrics.unique_sources_count >= 3
    assert detail.metrics.unique_domains_count >= 3
    assert detail.metrics.supported_count >= 1
    assert detail.metrics.partially_supported_count >= 1 or detail.metrics.supported_count >= 2

    # Check sources list
    domains = [s.domain for s in detail.sources]
    assert "anthropic.com" in domains
    assert "github.com" in domains


# ---------------------------------------------------------------------------
# 8. Actionable Recommendations & 7-Point Structure Test
# ---------------------------------------------------------------------------
def test_recommendations_and_7_point_structure(temp_insta_service):
    svc = temp_insta_service

    # Ingest 2 carousels and 1 reel
    svc.ingest_observation(
        InstagramObservationIn(
            source_url="https://instagram.com/p/c1",
            format="carousel",
            caption="Slide 1: Stop hardcoding configs.\n#DevOps",
            collection_method="manual_entry",
            metrics=InstagramMetrics(likes=150, saves=85),
        )
    )
    svc.ingest_observation(
        InstagramObservationIn(
            source_url="https://instagram.com/p/c2",
            format="carousel",
            caption="Slide 1: 5 Architecture Patterns for 2026.\n#SystemDesign",
            collection_method="manual_entry",
            metrics=InstagramMetrics(likes=200, saves=120),
        )
    )
    svc.ingest_observation(
        InstagramObservationIn(
            source_url="https://instagram.com/p/r1",
            format="reel",
            caption="Why your database is running out of connections.\n#PostgreSQL",
            collection_method="manual_entry",
            metrics=InstagramMetrics(likes=90, comments=15),
        )
    )

    recs = svc.get_recommendations()
    assert len(recs) >= 3

    # Verify each recommendation satisfies all 7 explicit required points
    for rec in recs:
        assert rec.what_to_do, f"{rec.id} missing what_to_do"
        assert rec.why_recommended, f"{rec.id} missing why_recommended"
        assert rec.supporting_evidence, f"{rec.id} missing supporting_evidence"
        assert rec.confidence_and_limitations, f"{rec.id} missing confidence_and_limitations"
        assert rec.expected_outcome, f"{rec.id} missing expected_outcome"
        assert rec.measurement_plan, f"{rec.id} missing measurement_plan"
        assert rec.contingency_plan, f"{rec.id} missing contingency_plan"
        assert rec.priority in ("high", "medium", "low")

    # Reject recommendation and verify it is excluded
    svc.record_feedback(
        InstagramFeedbackIn(
            target_id="rec-format-carousel",
            target_type="recommendation",
            action="rejected",
            user_note="Not producing carousels this quarter.",
        )
    )
    updated_recs = svc.get_recommendations()
    rec_ids = [r.id for r in updated_recs]
    assert "rec-format-carousel" not in rec_ids


# ---------------------------------------------------------------------------
# 9. Strategy Version History & Rollback Test
# ---------------------------------------------------------------------------
def test_strategy_version_history_and_rollback(temp_insta_service):
    svc = temp_insta_service

    # Initial checkpoint on ingestion
    svc.ingest_observation(
        InstagramObservationIn(
            source_url="https://instagram.com/p/test1",
            format="reel",
            caption="Avoid this silent bug in FastAPI.\n#Python",
            collection_method="manual_entry",
        )
    )

    history = svc.get_strategy_history()
    assert len(history) >= 1
    assert history[0].version >= 1
    assert "observation_ingested" in history[0].change_trigger

    v1 = history[0].version

    # Add feedback which creates v2
    svc.record_feedback(
        InstagramFeedbackIn(
            target_id="hyp-short-hooks",
            target_type="experiment",
            action="rejected",
            user_note="Audience prefers in-depth technical preambles.",
        )
    )

    history_after_fb = svc.get_strategy_history()
    assert len(history_after_fb) >= 2
    assert history_after_fb[0].version > v1

    # Test Rollback
    rolled_back = svc.rollback_strategy_version(v1)
    assert rolled_back is not None

    latest_history = svc.get_strategy_history()
    assert latest_history[0].change_trigger == "rollback"


# ---------------------------------------------------------------------------
# 10. System Improvement Proposals & Review Workflow Test
# ---------------------------------------------------------------------------
def test_system_improvement_proposals_and_review(temp_insta_service):
    svc = temp_insta_service

    proposals = svc.generate_diagnostic_proposals()
    assert len(proposals) >= 2
    assert all(p.status == "PENDING_REVIEW" for p in proposals)

    prop = proposals[0]
    assert prop.candidate_patch_diff
    assert prop.verification_plan
    assert prop.risk_level in ("low", "medium", "high")

    # Review: Approve
    from app.schemas.api.instagram import ProposalReviewIn
    approved = svc.review_improvement_proposal(
        prop.id,
        ProposalReviewIn(action="APPROVED", review_notes="Approved for indexing."),
    )
    assert approved is not None
    assert approved.status in ("APPROVED", "APPLIED")
    assert approved.reviewed_at is not None
    assert approved.review_notes == "Approved for indexing."
