"""Typed LangGraph research state and task states.

Defines the graph state carried between research nodes (Blueprint Part V
§14-15) plus the durable task/discovery/claim lifecycle statuses.  The state
is intentionally small: it carries database IDs and bounded summaries, never
full raw payloads or unlimited comments (Blueprint Part V §14 node contracts).
"""

from __future__ import annotations

from typing import TypedDict, List, Optional, Literal, Annotated
from datetime import datetime
from uuid import UUID
import operator

from app.schemas.source import AccessStatus, SourceType


# ---------------------------------------------------------------------------
# Task / run statuses
# ---------------------------------------------------------------------------
class TaskStatus(str):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    PARTIAL = "partial"
    FAILED = "failed"
    CANCELLED = "cancelled"
    INTERRUPTED = "interrupted"


# ---------------------------------------------------------------------------
# Claim verification statuses (Blueprint Part VI §16)
# ---------------------------------------------------------------------------
class VerificationStatus(str):
    UNVERIFIED = "UNVERIFIED"
    SUPPORTED = "SUPPORTED"
    CONTRADICTED = "CONTRADICTED"
    MIXED_EVIDENCE = "MIXED_EVIDENCE"
    INSUFFICIENT_EVIDENCE = "INSUFFICIENT_EVIDENCE"
    OUTDATED = "OUTDATED"
    NOT_APPLICABLE = "NOT_APPLICABLE"


def _now_utc() -> datetime:
    from datetime import timezone

    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Graph state
# ---------------------------------------------------------------------------
class ResearchState(TypedDict, total=False):
    """Typed state for the bounded research graph.

    Fields marked total=False are optional; the graph initializes missing
    ones in ``load_context`` / ``plan_research``.
    """

    # ── identity / budget ──────────────────────────────────────────────
    task_id: UUID
    query: str
    topics: List[str]
    lookback_hours: Optional[int]

    # budgets (enforced server-side, never overridden by the model)
    source_budget_remaining: int
    token_budget_remaining: int
    spend_budget_remaining: float
    iteration: int
    max_iterations: int
    deadline_at: Optional[datetime]
    max_sources_inspected: int
    sources_discovered: int
    sources_inspected: int
    sources_succeeded: int
    sources_failed: int
    sources_unknown_publication_date: int
    discovery_queries: int
    discovery_failures: int
    discovery_partial_results: int

    # ── durable object ids ─────────────────────────────────────────────
    candidate_source_ids: List[UUID]      # sources discovered, not yet inspected
    inspected_source_ids: List[UUID]      # sources already fetched/analyzed
    discovery_ids: List[UUID]             # discoveries produced this run
    pending_leads: List[dict]             # leads the model may follow next

    # ── claims / evidence / errors ─────────────────────────────────────
    claims: List[dict]                    # extracted claims (durable records)
    evidence: List[dict]                  # claim->source evidence links
    errors: List[dict]                    # operational errors (access failures, etc.)

    # ── control ────────────────────────────────────────────────────────
    status: str                           # TaskStatus value
    finish_reason: Optional[str]
    finish_reason_detail: Optional[str]


def initial_state(
    *,
    task_id: UUID,
    query: str,
    topics: Optional[List[str]] = None,
    lookback_hours: Optional[int] = None,
    source_budget: int = 100,
    token_budget: int = 50000,
    spend_budget: float = 0.0,
    max_iterations: int = 5,
    deadline_at: Optional[datetime] = None,
    max_sources_inspected: int = 20,
) -> ResearchState:
    """Build a fresh research state with all budgets initialized."""
    now = _now_utc()
    return {
        "task_id": task_id,
        "query": query,
        "topics": topics or [],
        "lookback_hours": lookback_hours,
        "source_budget_remaining": source_budget,
        "token_budget_remaining": token_budget,
        "spend_budget_remaining": spend_budget,
        "iteration": 0,
        "max_iterations": max_iterations,
        "deadline_at": deadline_at,
        "max_sources_inspected": max_sources_inspected,
        "sources_discovered": 0,
        "sources_inspected": 0,
        "sources_succeeded": 0,
        "sources_failed": 0,
        "sources_unknown_publication_date": 0,
        "discovery_queries": 0,
        "discovery_failures": 0,
        "discovery_partial_results": 0,
        "candidate_source_ids": [],
        "inspected_source_ids": [],
        "discovery_ids": [],
        "pending_leads": [],
        "claims": [],
        "evidence": [],
        "errors": [],
        "status": TaskStatus.PENDING,
        "finish_reason": None,
        "finish_reason_detail": None,
    }
