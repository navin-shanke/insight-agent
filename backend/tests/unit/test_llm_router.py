"""Unit tests for the LLM router (LLM mocked, no network)."""

from __future__ import annotations

from unittest import mock
from types import SimpleNamespace

import pytest

from app.llm.router import (
    ModelRouter,
    RouteResult,
    ClaimExtraction,
    ClaimVerification,
    ResearchPlan,
    DiscoveryScore,
)


def _make_route_result(data):
    return RouteResult(ok=True, data=data, provider="ollama", model="qwen2.5-coder:7b", latency_ms=100)


def test_plan_research_returns_sub_topics():
    router = ModelRouter()
    expected = ResearchPlan(
        sub_topics=["topic A", "topic B"],
        reasoning="decomposed query",
    )
    with mock.patch.object(router, "_run", return_value=_make_route_result(expected)) as m:
        result = router.plan_research("AI agent trends", ["ai"])
    assert result.ok
    assert result.data.sub_topics == ["topic A", "topic B"]
    # prompt contains the query and topics
    called_prompt = m.call_args[0][0]
    assert "AI agent trends" in called_prompt
    assert "ai" in called_prompt


def test_plan_research_failure_returns_error():
    router = ModelRouter()
    with mock.patch.object(
        router, "_run", return_value=RouteResult(ok=False, error="LLM down")
    ):
        result = router.plan_research("q", [])
    assert not result.ok
    assert result.error == "LLM down"


def test_extract_claims_returns_claims():
    router = ModelRouter()
    expected = ClaimExtraction(
        claims=[
            {
                "claim_text": "The tool launched in July 2026.",
                "claim_type": "launch_date",
                "source_url": "https://example.com/a",
                "excerpt": "launched in July 2026",
            }
        ],
        notes=None,
    )
    with mock.patch.object(router, "_run", return_value=_make_route_result(expected)):
        result = router.extract_claims("content", "https://example.com/a", "Example")
    assert result.ok
    assert len(result.data.claims) == 1
    assert result.data.claims[0].claim_text == "The tool launched in July 2026."
    with mock.patch.object(router, "_run", return_value=_make_route_result(expected)) as m2:
        router.extract_claims("content", "https://example.com/a", "Example")
        assert "https://example.com/a" in m2.call_args[0][0]


def test_extract_claims_empty_when_none():
    router = ModelRouter()
    expected = ClaimExtraction(claims=[], notes="no verifiable claims")
    with mock.patch.object(router, "_run", return_value=_make_route_result(expected)):
        result = router.extract_claims("just chatter", "https://example.com/x")
    assert result.ok
    assert result.data.claims == []
    assert result.data.notes == "no verifiable claims"


def test_verify_claim_supported():
    router = ModelRouter()
    expected = ClaimVerification(
        verdict="SUPPORTED",
        rationale="The official docs confirm the price.",
        primary_source_url="https://official.com/pricing",
        confidence_rationale="Primary source matches claim.",
    )
    with mock.patch.object(router, "_run", return_value=_make_route_result(expected)):
        result = router.verify_claim(
            "The price is $50.",
            "pricing",
            "The price is $50 per month.",
            ["https://official.com/pricing"],
        )
    assert result.ok
    assert result.data.verdict == "SUPPORTED"
    assert result.data.primary_source_url == "https://official.com/pricing"


def test_verify_claim_contradicted():
    router = ModelRouter()
    expected = ClaimVerification(
        verdict="CONTRADICTED",
        rationale="Sources disagree on the date.",
        primary_source_url=None,
    )
    with mock.patch.object(router, "_run", return_value=_make_route_result(expected)):
        result = router.verify_claim(
            "Launched July 1.",
            "launch_date",
            "Some sources say June.",
            ["https://a.com", "https://b.com"],
        )
    assert result.ok
    assert result.data.verdict == "CONTRADICTED"


def test_rank_discovery_returns_scored_components():
    router = ModelRouter()
    expected = DiscoveryScore(
        relevance=80,
        novelty=60,
        evidence_quality=70,
        usefulness=90,
        explanation="Highly relevant and useful; moderate novelty.",
    )
    with mock.patch.object(router, "_run", return_value=_make_route_result(expected)):
        result = router.rank_discovery(
            "Tool launch", "A new tool launched.", "Official docs + one review."
        )
    assert result.ok
    assert result.data.relevance == 80
    assert result.data.novelty == 60
    assert result.data.evidence_quality == 70
    assert result.data.usefulness == 90


def test_router_unavailable_when_ollama_down():
    # Force the LLM to be unavailable by making _get_llm return None.
    router = ModelRouter()
    router._llm = None
    router._available = False
    result = router.plan_research("q", [])
    assert not result.ok
    assert "unavailable" in result.error


def test_route_result_latency_recorded():
    router = ModelRouter()
    expected = ResearchPlan(sub_topics=["x"], reasoning="r")
    with mock.patch.object(router, "_run", return_value=_make_route_result(expected)):
        result = router.plan_research("q", [])
    assert result.latency_ms == 100


def test_llm_route_records_provider_token_usage():
    router = ModelRouter()
    expected = ResearchPlan(sub_topics=["x"], reasoning="r")

    class Structured:
        def invoke(self, _prompt):
            return {
                "parsed": expected,
                "raw": SimpleNamespace(usage_metadata={"input_tokens": 12, "output_tokens": 8}),
                "parsing_error": None,
            }

    class FakeLLM:
        def with_structured_output(self, _schema, **kwargs):
            assert kwargs["include_raw"] is True
            return Structured()

    router._get_llm = lambda: FakeLLM()
    result = router._run("q", ResearchPlan, "test")
    assert result.ok
    assert result.token_count == 20


def test_llm_route_marks_missing_token_usage_unknown():
    router = ModelRouter()
    expected = ResearchPlan(sub_topics=["x"], reasoning="r")

    class Structured:
        def invoke(self, _prompt):
            return {"parsed": expected, "raw": SimpleNamespace(usage_metadata={}), "parsing_error": None}

    class FakeLLM:
        def with_structured_output(self, _schema, **_kwargs):
            return Structured()

    router._get_llm = lambda: FakeLLM()
    assert router._run("q", ResearchPlan, "test").token_count is None
