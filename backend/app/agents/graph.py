"""LangGraph research workflow graph.

Defines the bounded research graph (Blueprint Part V §14) with typed
``ResearchState`` and explicit node execution.  State is persisted to the
``task_checkpoints`` table after every node so an interrupted task can
resume from the last durable checkpoint (Part V §14, Part XXIV).

Execution is driven step-by-step (rather than one-shot ``graph.invoke``)
so that checkpoints are written after every node and cancellation/partial
results are honoured.  Node coroutines are executed through a single
``asyncio.run`` so the graph stays runnable from synchronous call sites.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from langgraph.graph import StateGraph, END

from app.schemas.research_state import ResearchState, TaskStatus, initial_state
from app.agents.service import ResearchService
from app.agents import nodes


NODE_SEQUENCE = [
    "load_context",
    "plan_research",
    "discover_sources",
    "normalize_sources",
    "inspect_content",
    "extract_claims",
    "verify_claims",
    "score_discoveries",
    "decide_next",
    "build_report",
]

_NODE_FUNCS = {
    "load_context": nodes.load_context,
    "plan_research": nodes.plan_research,
    "discover_sources": nodes.discover_sources,
    "normalize_sources": nodes.normalize_sources,
    "inspect_content": nodes.inspect_content,
    "extract_claims": nodes.extract_claims,
    "verify_claims": nodes.verify_claims,
    "score_discoveries": nodes.score_discoveries,
    "decide_next": nodes.decide_next,
    "build_report": nodes.build_report,
}


def build_graph() -> StateGraph:
    """Build (uncompiled) the research StateGraph.

    Kept as a LangGraph ``StateGraph`` so the structure is typed and
    versionable; execution is driven manually in :func:`run_research` so
    checkpoints are written after every node.
    """
    workflow = StateGraph(ResearchState)

    for name in NODE_SEQUENCE:
        workflow.add_node(name, _NODE_FUNCS[name])

    workflow.set_entry_point("load_context")

    # Fixed linear edges (conditional routing lives in decide_next).
    workflow.add_edge("load_context", "plan_research")
    workflow.add_edge("plan_research", "discover_sources")
    workflow.add_edge("discover_sources", "normalize_sources")
    workflow.add_edge("normalize_sources", "inspect_content")
    workflow.add_edge("inspect_content", "extract_claims")
    workflow.add_edge("extract_claims", "verify_claims")
    workflow.add_edge("verify_claims", "score_discoveries")
    workflow.add_edge("score_discoveries", "decide_next")
    workflow.add_edge("build_report", END)

    return workflow


def _route_after_decide(state: ResearchState) -> str:
    """Route after decide_next based on remaining work.

    Iteration limit and terminal statuses take precedence so a run stops
    even when candidates or leads remain.
    """
    candidates = state.get("candidate_source_ids", []) or []
    leads = state.get("pending_leads", []) or []
    status = state.get("status")
    iteration = int(state.get("iteration", 0))
    max_iterations = int(state.get("max_iterations", 5))

    if iteration >= max_iterations:
        return "report"
    if status in (TaskStatus.COMPLETED, TaskStatus.PARTIAL):
        return "report"
    if candidates:
        return "inspect"
    if leads:
        return "plan"
    return "report"


async def _run_loop(
    service: ResearchService,
    state: ResearchState,
    thread_id: str,
    task_id: Optional[UUID],
    ownership_check=None,
) -> dict:
    """Execute nodes step-by-step, checkpointing after each one."""
    current = "load_context"
    max_steps = max(
        60,
        int(state.get("max_iterations", 5)) * 10
        + int(state.get("source_budget_remaining", 10)) * 6
        + 10,
    )
    steps_run = 0

    with service.session() as session:
        while current != "build_report" and steps_run < max_steps:
            stop_status = None
            stop_reason = None
            if ownership_check and not ownership_check():
                stop_status, stop_reason = TaskStatus.INTERRUPTED, "scheduler_lease_lost"
            elif task_id and service.consume_cancellation(session, task_id):
                stop_status, stop_reason = TaskStatus.CANCELLED, "user_requested"
            deadline = state.get("deadline_at")
            if not stop_status and deadline and datetime.now(timezone.utc) >= deadline:
                stop_status, stop_reason = TaskStatus.PARTIAL, "deadline_exceeded"
            if not stop_status and current == "inspect_content" and int(state.get("sources_inspected", 0)) >= int(state.get("max_sources_inspected", 20)):
                stop_status, stop_reason = TaskStatus.PARTIAL, "investigation_budget_exhausted"
            if not stop_status and int(state.get("token_budget_remaining", 0)) <= 0:
                usage_missing = any(
                    "did not report token usage" in error.get("error", "")
                    for error in state.get("errors", [])
                )
                stop_status, stop_reason = TaskStatus.PARTIAL, (
                    "token_usage_unavailable" if usage_missing else "token_budget_exhausted"
                )
            if stop_status:
                state.update(
                    status=stop_status,
                    finish_reason=stop_reason,
                    finish_reason_detail=(
                        "Cancellation requested by user"
                        if stop_status == TaskStatus.CANCELLED
                        else "Scheduler lease ownership was lost"
                        if stop_status == TaskStatus.INTERRUPTED
                        else f"Research run stopped at server limit: {stop_reason}"
                    ),
                )
                service.save_checkpoint(
                    session,
                    thread_id=thread_id,
                    task_id=task_id,
                    step="control_stop",
                    state=dict(state),
                )
                session.commit()
                return state
            steps_run += 1
            node_fn = _NODE_FUNCS[current]
            node_task = asyncio.create_task(node_fn(service, state))
            while not node_task.done():
                remaining = None
                if deadline:
                    remaining = max(0.0, (deadline - datetime.now(timezone.utc)).total_seconds())
                    if remaining <= 0:
                        node_task.cancel()
                        stop_status, stop_reason = TaskStatus.PARTIAL, "deadline_exceeded"
                        break
                try:
                    await asyncio.wait_for(asyncio.shield(node_task), timeout=min(0.5, remaining) if remaining else 0.5)
                except asyncio.TimeoutError:
                    if task_id and service.consume_cancellation(session, task_id):
                        node_task.cancel()
                        stop_status, stop_reason = TaskStatus.CANCELLED, "user_requested"
                        break
                    if ownership_check and not ownership_check():
                        node_task.cancel()
                        stop_status, stop_reason = TaskStatus.INTERRUPTED, "scheduler_lease_lost"
                        break
                except asyncio.CancelledError:
                    if node_task.cancelled():
                        break
                    raise
            if stop_status:
                try:
                    await node_task
                except asyncio.CancelledError:
                    pass
                state.update(
                    status=stop_status,
                    finish_reason=stop_reason,
                    finish_reason_detail=(
                        "Cancellation requested by user"
                        if stop_status == TaskStatus.CANCELLED
                        else "Scheduler lease ownership was lost"
                        if stop_status == TaskStatus.INTERRUPTED
                        else "Research run reached its deadline during a node"
                    ),
                )
                service.save_checkpoint(
                    session, thread_id=thread_id, task_id=task_id,
                    step="control_stop", state=dict(state),
                )
                session.commit()
                return state
            update = node_task.result()
            if isinstance(update, dict):
                state.update(update)
            elif update:
                state.update(dict(update))
            service.save_checkpoint(
                session,
                thread_id=thread_id,
                task_id=task_id,
                step=current,
                state=dict(state),
            )
            session.commit()

            # Routing.
            if current == "decide_next":
                route = update.pop("_route", "report")
                state.update(update)
                if route == "report":
                    current = "build_report"
                elif route == "plan":
                    current = "plan_research"
                else:  # inspect
                    current = "inspect_content"
            elif current in NODE_SEQUENCE:
                idx = NODE_SEQUENCE.index(current)
                if idx + 1 < len(NODE_SEQUENCE):
                    current = NODE_SEQUENCE[idx + 1]
                else:
                    current = "build_report"
            else:
                current = "build_report"

        # Always run the report node last (it handles the no-findings case).
        if current == "build_report":
            if task_id and service.consume_cancellation(session, task_id):
                state.update(status=TaskStatus.CANCELLED, finish_reason="user_requested")
                service.save_checkpoint(session, thread_id=thread_id, task_id=task_id,
                                        step="control_stop", state=dict(state))
                session.commit()
                return state
            if ownership_check and not ownership_check():
                state.update(status=TaskStatus.INTERRUPTED, finish_reason="scheduler_lease_lost")
                service.save_checkpoint(session, thread_id=thread_id, task_id=task_id,
                                        step="control_stop", state=dict(state))
                session.commit()
                return state
            deadline = state.get("deadline_at")
            if deadline and datetime.now(timezone.utc) >= deadline:
                state.update(status=TaskStatus.PARTIAL, finish_reason="deadline_exceeded")
                service.save_checkpoint(session, thread_id=thread_id, task_id=task_id,
                                        step="control_stop", state=dict(state))
                session.commit()
                return state
            if int(state.get("token_budget_remaining", 0)) <= 0:
                usage_missing = any(
                    error.get("stage") == "build_report"
                    and "did not report token usage" in error.get("error", "")
                    for error in state.get("errors", [])
                )
                state.update(
                    status=TaskStatus.PARTIAL,
                    finish_reason="token_usage_unavailable" if usage_missing else "token_budget_exhausted",
                    finish_reason_detail="No model token budget remains for report generation",
                )
                service.save_checkpoint(session, thread_id=thread_id, task_id=task_id,
                                        step="control_stop", state=dict(state))
                session.commit()
                return state
            update = await nodes.build_report(service, state)
            state.update(update or {})
            if any(
                error.get("stage") == "build_report"
                and "did not report token usage" in error.get("error", "")
                for error in state.get("errors", [])
            ):
                state.update(
                    status=TaskStatus.PARTIAL,
                    finish_reason="token_usage_unavailable",
                    finish_reason_detail="The final model call did not report token usage",
                )
            if task_id and service.consume_cancellation(session, task_id):
                state.update(status=TaskStatus.CANCELLED, finish_reason="user_requested")
            if ownership_check and not ownership_check():
                state.update(status=TaskStatus.INTERRUPTED, finish_reason="scheduler_lease_lost")
            service.save_checkpoint(
                session,
                thread_id=thread_id,
                task_id=task_id,
                step="build_report",
                state=dict(state),
            )
            session.commit()

    if current != "build_report" and steps_run >= max_steps:
        state.update(
            status=TaskStatus.PARTIAL,
            finish_reason="step_budget_exhausted",
            finish_reason_detail="Graph reached its hard node execution limit",
        )
    return state


async def run_research(
    service: ResearchService,
    *,
    task_id: UUID,
    query: str,
    topics: Optional[list[str]] = None,
    lookback_hours: Optional[int] = None,
    source_budget: int = 100,
    token_budget: int = 50000,
    spend_budget: float = 0.0,
    max_iterations: int = 5,
    deadline_at=None,
    max_sources_inspected: int = 20,
    ownership_check=None,
    thread_id: Optional[str] = None,
) -> dict:
    """Run the research graph, persisting a checkpoint after each node.

    Returns the final state dict.
    """
    if thread_id is None:
        thread_id = str(task_id)

    if source_budget < 1 or token_budget < 0 or max_iterations < 1 or max_sources_inspected < 1:
        raise ValueError("research budgets must be positive (token budget may be zero)")
    source_budget = min(source_budget, 100)
    token_budget = min(token_budget, 50000)
    max_iterations = min(max_iterations, 5)
    max_sources_inspected = min(max_sources_inspected, 20)
    now = datetime.now(timezone.utc)
    default_deadline = now + timedelta(minutes=45)
    if deadline_at is None or deadline_at > default_deadline:
        deadline_at = default_deadline

    state = initial_state(
        task_id=task_id,
        query=query,
        topics=topics,
        lookback_hours=lookback_hours,
        source_budget=source_budget,
        token_budget=token_budget,
        spend_budget=spend_budget,
        max_iterations=max_iterations,
        deadline_at=deadline_at,
        max_sources_inspected=max_sources_inspected,
    )

    # Build (but do not compile-with-checkpointer) the graph for structure.
    build_graph()

    return await _run_loop(service, state, thread_id, task_id, ownership_check)


def resume_research(
    service: ResearchService,
    thread_id: str,
    **overrides,
) -> dict:
    """Resume an interrupted run from its latest durable checkpoint.

    Loads the latest checkpoint state for ``thread_id`` and continues
    execution from there.  Returns the final state.
    """
    with service.session() as session:
        saved = service.load_latest_checkpoint(session, thread_id)
    if not saved:
        raise ValueError(f"No checkpoint found for thread {thread_id}")

    state = ResearchState(**saved)
    task_id = UUID(state["task_id"]) if state.get("task_id") else None
    if isinstance(state.get("deadline_at"), str):
        state["deadline_at"] = datetime.fromisoformat(state["deadline_at"])
        if state["deadline_at"].tzinfo is None:
            state["deadline_at"] = state["deadline_at"].replace(tzinfo=timezone.utc)

    build_graph()
    return asyncio.run(_run_loop(service, state, thread_id, task_id))
