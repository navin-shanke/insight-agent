"""Unit tests for graph routing logic (decide_next)."""

from __future__ import annotations

from uuid import uuid4

import pytest

from app.agents.graph import _route_after_decide
from app.agents.nodes import decide_next
from app.schemas.research_state import TaskStatus, initial_state


def test_route_decide_inspect_when_candidates_remain():
    state = initial_state(task_id=uuid4(), query="q")
    state["status"] = TaskStatus.RUNNING
    state["candidate_source_ids"] = ["src-1"]
    state["pending_leads"] = []
    assert _route_after_decide(state) == "inspect"


def test_route_decide_plan_when_leads_remain():
    state = initial_state(task_id=uuid4(), query="q")
    state["status"] = TaskStatus.RUNNING
    state["candidate_source_ids"] = []
    state["pending_leads"] = [{"lead_id": "l1", "query": "x", "attempts": 0}]
    assert _route_after_decide(state) == "plan"


def test_route_decide_report_when_done():
    state = initial_state(task_id=uuid4(), query="q")
    state["status"] = TaskStatus.COMPLETED
    state["candidate_source_ids"] = []
    state["pending_leads"] = []
    assert _route_after_decide(state) == "report"


def test_route_decide_report_when_partial_no_work():
    state = initial_state(task_id=uuid4(), query="q")
    state["status"] = TaskStatus.PARTIAL
    state["candidate_source_ids"] = []
    state["pending_leads"] = []
    assert _route_after_decide(state) == "report"


def test_route_decide_iteration_limit_completes():
    state = initial_state(task_id=uuid4(), query="q", max_iterations=2)
    state["status"] = TaskStatus.RUNNING
    state["iteration"] = 2
    state["candidate_source_ids"] = ["src-1"]
    state["pending_leads"] = []
    # Iteration limit takes precedence over remaining candidates.
    assert _route_after_decide(state) == "report"


def test_iteration_limit_is_enforced_as_partial():
    state = initial_state(task_id=uuid4(), query="q", max_iterations=1)
    state["candidate_source_ids"] = ["src-1"]
    result = __import__("asyncio").run(decide_next(None, state))
    assert result["status"] == TaskStatus.PARTIAL
    assert result["iteration"] == 1
    assert result["finish_reason"] == "iteration_limit"
