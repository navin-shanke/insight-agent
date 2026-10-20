"""LLM router for the research graph.

Routes bounded reasoning tasks to an Ollama model (default
``qwen2.5-coder:7b`` on ``http://127.0.0.1:11434``) with structured Pydantic
output, retries, and explicit timeouts.  When Ollama is unavailable or not
configured, every route returns a graceful "blocked" result rather than
fabricating answers -- the router never invents citations, quotes, sources,
dates, or confidence scores (Blueprint rule 4 / Part V §15).

All model interactions are recorded with the model name and provider for
important operations; per-task token and spending budgets are enforced by the
research graph, not here.
"""

from __future__ import annotations

import os
import time
from dataclasses import dataclass
from typing import Optional, List
from enum import Enum
from datetime import datetime, timezone

from langchain_ollama import ChatOllama
from pydantic import BaseModel, Field

from app.schemas.research_state import VerificationStatus

DEFAULT_MODEL = "qwen2.5-coder:7b"
DEFAULT_BASE_URL = "http://127.0.0.1:11434"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Structured output models
# ---------------------------------------------------------------------------
class ExtractedClaim(BaseModel):
    """A single claim extracted from source content."""

    claim_text: str = Field(..., description="The factual claim, in the source's words where possible.")
    claim_type: str = Field(
        default="statement",
        description="e.g. 'pricing', 'launch_date', 'feature', 'opinion', 'prediction'.",
    )
    source_url: Optional[str] = Field(
        default=None,
        description="The source URL where the claim appears (never fabricated).",
    )
    excerpt: Optional[str] = Field(
        default=None,
        description="Short verbatim excerpt supporting the claim.",
    )
    context: Optional[str] = Field(
        default=None,
        description="Surrounding context (date, version, speaker) if available.",
    )


class ClaimExtraction(BaseModel):
    """Result of claim extraction from one source."""

    claims: List[ExtractedClaim] = Field(default_factory=list)
    notes: Optional[str] = Field(
        default=None, description="Extraction caveats (e.g. 'no verifiable claims found')."
    )


class ClaimVerdict(str, Enum):
    SUPPORTED = "SUPPORTED"
    CONTRADICTED = "CONTRADICTED"
    MIXED_EVIDENCE = "MIXED_EVIDENCE"
    INSUFFICIENT_EVIDENCE = "INSUFFICIENT_EVIDENCE"
    UNVERIFIABLE = "UNVERIFIABLE"


class ClaimVerification(BaseModel):
    """Verification of one claim against independent evidence."""

    verdict: ClaimVerdict = Field(
        ..., description="SUPPORTED | CONTRADICTED | MIXED_EVIDENCE | INSUFFICIENT_EVIDENCE | UNVERIFIABLE"
    )
    rationale: str = Field(
        ..., description="Why this verdict was reached, citing evidence URLs."
    )
    primary_source_url: Optional[str] = Field(
        default=None,
        description="The primary source used (if any), never fabricated.",
    )
    confidence_rationale: Optional[str] = Field(
        default=None,
        description="Why this confidence level (not a calibrated probability).",
    )


class ResearchPlan(BaseModel):
    """Research plan: sub-topics / leads to investigate."""

    sub_topics: List[str] = Field(
        default_factory=list,
        description="Concrete sub-topics or leads to investigate next.",
    )
    reasoning: Optional[str] = Field(
        default=None,
        description="Why these leads were chosen.",
    )


class DiscoveryScore(BaseModel):
    """Ranked score for a discovery (0-100 each component)."""

    relevance: int = Field(..., ge=0, le=100)
    novelty: int = Field(..., ge=0, le=100)
    evidence_quality: int = Field(..., ge=0, le=100)
    usefulness: int = Field(..., ge=0, le=100)
    explanation: str = Field(
        ..., description="Why this discovery was ranked highly (ranking ≠ verification)."
    )


class FinalReport(BaseModel):
    """A structured, cited research report."""

    report_md: str = Field(
        ..., description="The full report in Markdown, with source links."
    )


# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------
@dataclass
class RouteResult:
    """Generic structured route result."""

    ok: bool
    data: Optional[BaseModel] = None
    error: Optional[str] = None
    model: Optional[str] = None
    provider: Optional[str] = None
    latency_ms: Optional[int] = None
    token_count: Optional[int] = None


class ModelRouter:
    """Routes structured reasoning tasks to an LLM with graceful degradation.

    Usage::

        router = ModelRouter()
        result = router.extract_claims(content="...", source_url="...")
        if result.ok:
            claims = result.data.claims
    """

    def __init__(
        self,
        model: Optional[str] = None,
        base_url: Optional[str] = None,
        temperature: float = 0.0,
        max_retries: int = 2,
        timeout_s: float = 60.0,
    ):
        self.model = model or os.getenv("OLLAMA_TEXT_MODEL") or DEFAULT_MODEL
        self.base_url = base_url or os.getenv("OLLAMA_BASE_URL") or DEFAULT_BASE_URL
        self.temperature = temperature
        self.max_retries = max_retries
        self.timeout_s = timeout_s
        self._llm: Optional[ChatOllama] = None
        self._available: Optional[bool] = None

    def _get_llm(self) -> Optional[ChatOllama]:
        """Lazily construct the Ollama client; cache availability."""
        if self._available is False:
            return None
        if self._llm is None:
            try:
                self._llm = ChatOllama(
                    model=self.model,
                    base_url=self.base_url,
                    temperature=self.temperature,
                    num_predict=1024,
                    client_kwargs={"timeout": self.timeout_s},
                    sync_client_kwargs={"timeout": self.timeout_s},
                )
                # Probe availability with a trivial call.
                self._llm.invoke("OK")
            except Exception:  # noqa: BLE001 - Ollama may be down
                self._llm = None
                self._available = False
                return None
        return self._llm

    def _run(
        self,
        prompt: str,
        schema: type[BaseModel],
        operation: str,
    ) -> RouteResult:
        """Run one structured LLM call with retries."""
        start = time.perf_counter()
        llm = self._get_llm()
        if llm is None:
            return RouteResult(
                ok=False,
                error=f"{operation}: LLM (Ollama {self.model}) unavailable",
                provider="ollama",
                model=self.model,
            )

        structured = llm.with_structured_output(schema, method="json_schema", include_raw=True)
        last_error: Optional[str] = None
        total_tokens = 0
        usage_complete = True
        for attempt in range(self.max_retries + 1):
            try:
                response = structured.invoke(prompt)
                if isinstance(response, dict) and "parsed" in response:
                    data = response.get("parsed")
                    raw = response.get("raw")
                    usage = getattr(raw, "usage_metadata", None) or {}
                    reported_tokens = usage.get("total_tokens")
                    if reported_tokens is None and ("input_tokens" in usage or "output_tokens" in usage):
                        reported_tokens = int(usage.get("input_tokens", 0)) + int(usage.get("output_tokens", 0))
                    if reported_tokens is None:
                        usage_complete = False
                    else:
                        total_tokens += int(reported_tokens)
                    if data is None:
                        raise ValueError(f"structured output parsing failed: {response.get('parsing_error')}")
                else:
                    data = response
                    usage_complete = False
                return RouteResult(
                    ok=True,
                    data=data,
                    provider="ollama",
                    model=self.model,
                    latency_ms=int((time.perf_counter() - start) * 1000),
                    token_count=total_tokens if usage_complete else None,
                )
            except Exception as exc:  # noqa: BLE001
                last_error = f"{exc}"
                # An exception can happen after an upstream model invocation;
                # usage for that attempt is unknowable, so fail closed.
                usage_complete = False
                if attempt < self.max_retries:
                    continue
                return RouteResult(
                    ok=False,
                    error=f"{operation}: {last_error}",
                    provider="ollama",
                    model=self.model,
                    latency_ms=int((time.perf_counter() - start) * 1000),
                )
        return RouteResult(
            ok=False,
            error=f"{operation}: {last_error}",
            provider="ollama",
            model=self.model,
            latency_ms=int((time.perf_counter() - start) * 1000),
        )

    # ------------------------------------------------------------------
    # Task-specific routes
    # ------------------------------------------------------------------
    def plan_research(self, query: str, topics: List[str]) -> RouteResult:
        """Decompose a research query into concrete sub-topics / leads."""
        prompt = (
            "You are a careful research planner. Given the user's query and active topics, "
            "produce a concise list of concrete sub-topics or leads worth investigating. "
            "Do not fabricate sources, URLs, or facts. Return only the plan.\n\n"
            f"Query: {query}\n"
            f"Topics: {', '.join(topics) if topics else '(none)'}\n"
        )
        return self._run(prompt, ResearchPlan, "plan_research")

    def extract_claims(
        self,
        content: str,
        source_url: str,
        source_title: Optional[str] = None,
    ) -> RouteResult:
        """Extract discrete factual claims from source content."""
        title_line = f"\nSource title: {source_title}" if source_title else ""
        prompt = (
            "You extract discrete, verifiable factual claims from source content. "
            "For each claim, return the claim text, a claim type, and the source URL. "
            "Only include claims actually supported by the content. "
            "Do not invent claims, quotations, dates, or sources. "
            "If no verifiable claims are present, return an empty claims list.\n\n"
            f"Source URL: {source_url}{title_line}\n\n"
            f"Content:\n{content[:12000]}\n"
        )
        return self._run(prompt, ClaimExtraction, "extract_claims")

    def verify_claim(
        self,
        claim_text: str,
        claim_type: str,
        evidence_text: str,
        evidence_urls: List[str],
    ) -> RouteResult:
        """Verify one claim against gathered evidence."""
        urls_line = "\n".join(f"- {u}" for u in evidence_urls) if evidence_urls else "(none)"
        prompt = (
            "You verify a factual claim against gathered evidence. Return a verdict "
            "(SUPPORTED | CONTRADICTED | MIXED_EVIDENCE | INSUFFICIENT_EVIDENCE | UNVERIFIABLE), "
            "a rationale citing evidence URLs, and the primary source URL if one exists. "
            "Do not treat multiple sites repeating the same claim as independent confirmation. "
            "Do not fabricate evidence or sources.\n\n"
            f"Claim: {claim_text}\n"
            f"Claim type: {claim_type}\n"
            f"Evidence URLs:\n{urls_line}\n\n"
            f"Evidence text:\n{evidence_text[:12000]}\n"
        )
        return self._run(prompt, ClaimVerification, "verify_claim")

    def rank_discovery(
        self,
        title: str,
        summary: str,
        evidence_summary: str,
    ) -> RouteResult:
        """Score a discovery on relevance, novelty, evidence quality, usefulness (0-100)."""
        prompt = (
            "You score a discovery on four components, each 0-100. "
            "Relevance: match to the user's topics. Novelty: difference from prior findings. "
            "Evidence quality: provenance, source reliability, corroboration. "
            "Usefulness: likely practical value. "
            "Return an explanation. Remember: ranking is not verification -- a popular claim "
            "is not necessarily true.\n\n"
            f"Title: {title}\n"
            f"Summary: {summary}\n"
            f"Evidence summary: {evidence_summary}\n"
        )
        return self._run(prompt, DiscoveryScore, "rank_discovery")

    def synthesize_report(
        self,
        query: str,
        findings_summary: str,
        evidence_summary: str,
        contradictions: str,
        limitations: str,
    ) -> RouteResult:
        """Synthesize a structured, cited research report."""
        prompt = (
            "You write a structured, cited research report. Include: the research question, "
            "key findings with supporting evidence and source URLs, contradictory evidence, "
            "unresolved questions, and limitations. Every material factual claim must have "
            "traceable supporting evidence or be explicitly marked unverified. Do not fabricate "
            "citations or sources.\n\n"
            f"Research question: {query}\n"
            f"Findings summary: {findings_summary}\n"
            f"Evidence summary: {evidence_summary}\n"
            f"Contradictions: {contradictions}\n"
            f"Limitations: {limitations}\n"
        )
        return self._run(prompt, FinalReport, "synthesize_report")


def make_router() -> ModelRouter:
    """Build a router from environment configuration."""
    return ModelRouter()
