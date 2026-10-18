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
            steps_run += 1
            node_fn = _NODE_FUNCS[current]
            update = await node_fn(service, state)
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
            update = await nodes.build_report(service, state)
            state.update(update or {})
            service.save_checkpoint(
                session,
                thread_id=thread_id,
                task_id=task_id,
                step="build_report",
                state=dict(state),
            )
            session.commit()

    return state


def run_research(
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
    thread_id: Optional[str] = None,
) -> dict:
    """Run the research graph, persisting a checkpoint after each node.

    Returns the final state dict.
    """
    if thread_id is None:
        thread_id = str(task_id)

    state = initial_state(
        task_id=task_id,
        query=query,
        topics=topics,
        lookback_hours=lookback_hours,
        source_budget=source_budget,
        token_budget=token_budget,
        spend_budget=spend_budget,
        max_iterations=max_iterations,
    )

    # Build (but do not compile-with-checkpointer) the graph for structure.
    build_graph()

    return asyncio.run(_run_loop(service, state, thread_id, task_id))


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

    build_graph()
    return asyncio.run(_run_loop(service, state, thread_id, task_id))
