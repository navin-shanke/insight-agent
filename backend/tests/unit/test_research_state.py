"""Unit tests for the typed research graph state."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4

import pytest

from app.schemas.research_state import (
    ResearchState,
    TaskStatus,
    VerificationStatus,
    initial_state,
)


def test_initial_state_sets_budgets_and_status():
    tid = uuid4()
    state = initial_state(
        task_id=tid,
        query="test query",
        topics=["ai"],
        lookback_hours=24,
        source_budget=50,
        token_budget=10000,
        max_iterations=3,
    )
    assert state["task_id"] == tid
    assert state["query"] == "test query"
    assert state["topics"] == ["ai"]
    assert state["lookback_hours"] == 24
    assert state["source_budget_remaining"] == 50
    assert state["token_budget_remaining"] == 10000
    assert state["iteration"] == 0
    assert state["max_iterations"] == 3
    assert state["status"] == TaskStatus.PENDING
    assert state["candidate_source_ids"] == []
    assert state["claims"] == []
    assert state["finish_reason"] is None


def test_state_has_required_fields():
    tid = uuid4()
    state = initial_state(task_id=tid, query="q")
    assert state["task_id"] == tid
    assert state["query"] == "q"
    assert state["iteration"] == 0
    assert state["status"] == TaskStatus.PENDING
    assert isinstance(state["candidate_source_ids"], list)
    assert isinstance(state["claims"], list)


def test_verification_status_values():
    assert VerificationStatus.SUPPORTED == "SUPPORTED"
    assert VerificationStatus.PARTIALLY_SUPPORTED == "PARTIALLY_SUPPORTED"
    assert VerificationStatus.CONTRADICTED == "CONTRADICTED"
    assert VerificationStatus.MIXED_EVIDENCE == "MIXED_EVIDENCE"
    assert VerificationStatus.INSUFFICIENT_EVIDENCE == "INSUFFICIENT_EVIDENCE"
    assert VerificationStatus.UNVERIFIED == "UNVERIFIED"
    assert VerificationStatus.OUTDATED == "OUTDATED"
    assert VerificationStatus.NOT_APPLICABLE == "NOT_APPLICABLE"


def test_task_status_values():
    assert TaskStatus.COMPLETED == "completed"
    assert TaskStatus.PARTIAL == "partial"
    assert TaskStatus.FAILED == "failed"
    assert TaskStatus.CANCELLED == "cancelled"
    assert TaskStatus.INTERRUPTED == "interrupted"
    assert TaskStatus.RUNNING == "running"
    assert TaskStatus.PENDING == "pending"


def test_state_is_mutable_dict():
    tid = uuid4()
    state: ResearchState = initial_state(task_id=tid, query="q")
    state["iteration"] = 2
    state["status"] = TaskStatus.RUNNING
    assert state["iteration"] == 2
    assert state["status"] == TaskStatus.RUNNING
