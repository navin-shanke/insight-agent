"""Unit tests for research quality improvements.

Tests:
1. SVG / script / style text stripping in safe_fetch.html_to_text.
2. Claim deduplication heuristics (_claims_are_duplicates).
3. Markdown report sanitization (_clean_markdown_report).
4. Candidate source selection prioritizing domain diversity.
5. Evidence grounding in verify_claims (insufficient evidence on empty excerpts,
   forwarding real excerpts, no ClaimVerdict. enum leak).
"""

from __future__ import annotations

import asyncio
from unittest import mock
from uuid import uuid4

import pytest

from app.fetcher.safe_fetch import html_to_text
from app.agents.nodes import (
    _claims_are_duplicates,
    _clean_markdown_report,
    inspect_content,
    verify_claims,
    extract_claims,
    build_report,
)
from app.schemas.research_state import (
    initial_state,
    TaskStatus,
    VerificationStatus,
)
from app.agents.service import ResearchService
from app.llm.router import RouteResult, ClaimVerification, FinalReport, ClaimExtraction


# ---------------------------------------------------------------------------
# 1. HTML to text: SVG decomposition
# ---------------------------------------------------------------------------
def test_html_to_text_strips_svg_and_scripts():
    html = """
    <html>
      <head><style>.btn { color: red; }</style></head>
      <body>
        <script>console.log("secret");</script>
        <h1>Main Heading</h1>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
          <text>Stray SVG Text</text>
          <path d="M10 10"/>
        </svg>
        <p>This is genuine article text about AI agents.</p>
        <noscript>Enable JS</noscript>
      </body>
    </html>
    """
    text = html_to_text(html)
    assert "Main Heading" in text
    assert "This is genuine article text about AI agents." in text
    assert "Stray SVG Text" not in text
    assert "console.log" not in text
    assert ".btn" not in text
    assert "Enable JS" not in text


# ---------------------------------------------------------------------------
# 2. Claim deduplication
# ---------------------------------------------------------------------------
def test_claims_are_duplicates_detection():
    # Exact matches
    assert _claims_are_duplicates(
        "Model Context Protocol connects AI systems to data sources and tools.",
        "Model Context Protocol connects AI systems to data sources and tools.",
    )

    # Paraphrased near-duplicates with high token overlap
    assert _claims_are_duplicates(
        "Model Context Protocol connects AI systems to external data sources and tools.",
        "Model Context Protocol connects AI to external tools and data sources.",
    )

    # Completely distinct claims
    assert not _claims_are_duplicates(
        "Model Context Protocol is an open-source standard created by Anthropic.",
        "MCP servers can run locally or remotely over SSE transport.",
    )

    # Empty inputs
    assert not _claims_are_duplicates("", "some claim")
    assert not _claims_are_duplicates("some claim", "")


# ---------------------------------------------------------------------------
# 3. Markdown report sanitization
# ---------------------------------------------------------------------------
def test_clean_markdown_report_sanitizes_artifacts():
    dirty = (
        r"\# Research Report" + "\n\n"
        r"This is \*\*important\*\* finding with \[link\](https://example.com)." + "\n\n"
        "Claim status: ClaimVerdict.SUPPORTED\n\n"
        "<svg><text>chart</text></svg>\n"
        "svg\n"
        "Actual paragraph continuing."
    )
    cleaned = _clean_markdown_report(dirty)

    assert r"\#" not in cleaned
    assert "# Research Report" in cleaned
    assert r"\*\*" not in cleaned
    assert "**important**" in cleaned
    assert r"\[link\]" not in cleaned
    assert "[link](https://example.com)" in cleaned
    assert "ClaimVerdict." not in cleaned
    assert "Claim status: SUPPORTED" in cleaned
    assert "<svg>" not in cleaned
    assert "Actual paragraph continuing." in cleaned


# ---------------------------------------------------------------------------
# 4. Domain diversity candidate selection
# ---------------------------------------------------------------------------
@pytest.fixture
def test_svc(db_engine):
    return ResearchService(database_url=db_engine.url)


def test_inspect_content_domain_diversity(test_svc):
    with test_svc.session() as session:
        # Create 2 sources from anthropic.com and 1 from github.com
        s1 = test_svc.upsert_source(
            session,
            source_type="web_page",
            canonical_url="https://anthropic.com/blog/mcp-intro",
            title="MCP Intro",
        )
        s2 = test_svc.upsert_source(
            session,
            source_type="web_page",
            canonical_url="https://anthropic.com/docs/mcp-spec",
            title="MCP Spec",
        )
        s3 = test_svc.upsert_source(
            session,
            source_type="web_page",
            canonical_url="https://github.com/modelcontextprotocol/servers",
            title="MCP Servers",
        )
        session.commit()
        s1_id, s2_id, s3_id = str(s1.id), str(s2.id), str(s3.id)

    # Mock fetch_source
    mock_snap = type(
        "Snap",
        (),
        {
            "content_hash": "h",
            "text_content": "Article text",
            "access_status": type("A", (), {"value": "ready"})(),
            "coverage_json": {},
        },
    )()
    mock_fetched = type(
        "F",
        (),
        {
            "error": None,
            "snapshot": mock_snap,
        },
    )()
    test_svc.fetch_source = mock.AsyncMock(return_value=mock_fetched)

    # Suppose s1 (anthropic.com) was already inspected
    state = initial_state(task_id=uuid4(), query="mcp")
    state["candidate_source_ids"] = [s2_id, s3_id]
    state["inspected_source_ids"] = [s1_id]

    res = asyncio.run(inspect_content(test_svc, state))

    # Even though s2_id was first in candidate list, s3_id (github.com) should be picked
    # because github.com is an uninspected domain!
    assert res["last_fetched"]["source_id"] == s3_id
    assert s2_id in res["candidate_source_ids"]


# ---------------------------------------------------------------------------
# 5. Evidence grounding & verdict cleaning in verify_claims
# ---------------------------------------------------------------------------
def test_verify_claims_fails_to_insufficient_evidence_when_no_excerpts(test_svc):
    state = initial_state(task_id=uuid4(), query="mcp")
    claim_id = str(uuid4())
    state["claims"] = [
        {
            "claim_id": claim_id,
            "claim_text": "MCP requires Python 3.14.",
            "claim_type": "statement",
            "source_url": "https://example.com/spec",
            "verification_status": VerificationStatus.UNVERIFIED,
            "excerpt": "",  # Empty excerpt!
            "excerpts": [],
        }
    ]

    # Model router verify_claim should NOT even be called or if called shouldn't mark SUPPORTED
    test_svc.router.verify_claim = mock.MagicMock()

    res = asyncio.run(verify_claims(test_svc, state))

    assert res["claims"][0]["verification_status"] == VerificationStatus.INSUFFICIENT_EVIDENCE
    assert "No specific factual passages retrieved" in res["claims"][0]["verification_rationale"]
    # LLM was not invoked for claim with zero evidence
    test_svc.router.verify_claim.assert_not_called()


def test_verify_claims_strips_enum_name_and_forwards_excerpts(test_svc):
    state = initial_state(task_id=uuid4(), query="mcp")
    claim_id = str(uuid4())
    state["claims"] = [
        {
            "claim_id": claim_id,
            "claim_text": "MCP standardizes AI-to-tool connections.",
            "claim_type": "statement",
            "source_url": "https://example.com/spec",
            "verification_status": VerificationStatus.UNVERIFIED,
            "excerpt": "MCP provides an open architecture connecting AI to tools.",
            "excerpts": ["MCP provides an open architecture connecting AI to tools."],
        }
    ]

    # Verify claim returns enum representation
    fake_route_result = RouteResult(
        ok=True,
        data=ClaimVerification(
            verdict="SUPPORTED",
            rationale="Passage directly confirms connection architecture.",
            primary_source_url="https://example.com/spec",
        ),
        provider="ollama",
        model="qwen",
    )
    test_svc.router.verify_claim = mock.MagicMock(return_value=fake_route_result)

    res = asyncio.run(verify_claims(test_svc, state))

    # Real excerpt was passed in evidence_text
    args, kwargs = test_svc.router.verify_claim.call_args
    evidence_text = kwargs.get("evidence_text") or (args[2] if len(args) > 2 else "")
    assert "MCP provides an open architecture connecting AI to tools." in evidence_text

    # Verification status is clean "SUPPORTED", not "ClaimVerdict.SUPPORTED"
    assert res["claims"][0]["verification_status"] == "SUPPORTED"
    assert "ClaimVerdict" not in res["claims"][0]["verification_status"]


def test_extract_claims_deduplicates_and_links_corroborating_source(test_svc):
    with test_svc.session() as session:
        src1 = test_svc.upsert_source(
            session,
            source_type="web_page",
            canonical_url="https://source1.com/mcp",
            title="Source 1",
        )
        src2 = test_svc.upsert_source(
            session,
            source_type="web_page",
            canonical_url="https://source2.com/mcp-overview",
            title="Source 2",
        )
        session.commit()
        src1_id, src2_id = str(src1.id), str(src2.id)

    # First fetch & extraction
    state = initial_state(task_id=uuid4(), query="mcp")
    state["last_fetched"] = {
        "source_id": src1_id,
        "url": "https://source1.com/mcp",
        "text": "MCP connects AI to tools.",
    }
    test_svc.router.extract_claims = mock.MagicMock(
        return_value=RouteResult(
            ok=True,
            data=ClaimExtraction(
                claims=[
                    {
                        "claim_text": "Model Context Protocol connects AI systems to external tools.",
                        "claim_type": "architecture",
                        "source_url": "https://source1.com/mcp",
                        "excerpt": "MCP connects AI to tools.",
                    }
                ]
            ),
        )
    )
    res1 = asyncio.run(extract_claims(test_svc, state))
    assert len(res1["claims"]) == 1
    state["claims"] = res1["claims"]

    # Second fetch from different source with nearly identical claim
    state["last_fetched"] = {
        "source_id": src2_id,
        "url": "https://source2.com/mcp-overview",
        "text": "MCP connects AI to tools and data.",
    }
    test_svc.router.extract_claims = mock.MagicMock(
        return_value=RouteResult(
            ok=True,
            data=ClaimExtraction(
                claims=[
                    {
                        "claim_text": "Model Context Protocol connects AI systems to tools and data sources.",
                        "claim_type": "architecture",
                        "source_url": "https://source2.com/mcp-overview",
                        "excerpt": "MCP connects AI to tools and data.",
                    }
                ]
            ),
        )
    )
    res2 = asyncio.run(extract_claims(test_svc, state))

    # Should still have only 1 unique claim, but with both sources linked as corroborating!
    assert len(res2["claims"]) == 1
    assert "https://source1.com/mcp" in res2["claims"][0]["corroborating_urls"]
    assert "https://source2.com/mcp-overview" in res2["claims"][0]["corroborating_urls"]

