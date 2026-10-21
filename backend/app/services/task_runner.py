"""Async task runner for Phase 5 dashboard research submission.

Wraps ResearchService and run_research in an asyncio background task, stores
progress events in per-task queues that the SSE endpoint consumes.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
import json
import logging
from typing import Any
from uuid import UUID

from app.core.config import get_settings

logger = logging.getLogger(__name__)

# task_id (str) → asyncio.Queue of progress event dicts
_progress_queues: dict[str, asyncio.Queue] = {}

# task_id → current cached status dict
_task_cache: dict[str, dict[str, Any]] = {}

_SENTINEL = None  # pushed to queue when stream is complete


def _get_queue(task_id: str) -> asyncio.Queue:
    if task_id not in _progress_queues:
        _progress_queues[task_id] = asyncio.Queue(maxsize=200)
    return _progress_queues[task_id]


def _push_event(task_id: str, event: dict[str, Any]) -> None:
    """Push a progress event without blocking."""
    q = _get_queue(task_id)
    try:
        q.put_nowait(event)
    except asyncio.QueueFull:
        pass
    _task_cache[task_id] = event


async def get_progress_stream(task_id: str):
    """Async generator yielding SSE-formatted progress events for a task."""
    q = _get_queue(task_id)
    while True:
        try:
            event = await asyncio.wait_for(q.get(), timeout=30.0)
        except asyncio.TimeoutError:
            # Keep-alive ping
            yield {"event": "ping", "data": ""}
            continue
        if event is _SENTINEL:
            break
        yield {"event": "progress", "data": json.dumps(event)}


def get_cached_status(task_id: str) -> dict[str, Any] | None:
    """Return the most recent cached progress event for polling fallback."""
    return _task_cache.get(task_id)


async def submit_research_task(
    task_id: str,
    query: str,
    source_budget: int,
    max_iterations: int,
    time_budget_seconds: int | None,
    token_budget: int,
) -> None:
    """Launch a bounded research run in the background.

    Pushes progress events to the task queue and records checkpoints in the DB.
    """
    settings = get_settings()
    db_url_sync = settings.database_url.replace("sqlite+aiosqlite:///", "sqlite:///")

    _push_event(task_id, {
        "task_id": task_id,
        "status": "running",
        "step": "initializing",
        "query": query,
        "progress_pct": 5,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })

    loop = asyncio.get_running_loop()

    def _run_worker():
        from app.agents.service import ResearchService
        from app.agents.graph import run_research
        from app.schemas.research_state import TaskStatus

        service = ResearchService(database_url=db_url_sync)
        task_uuid = UUID(task_id)

        # 1. Immediately persist an initial checkpoint so list-running-research
        # and cooperative cancellation can immediately observe it.
        with service.session() as session:
            service.save_checkpoint(
                session,
                thread_id=task_id,
                task_id=task_uuid,
                step="load_context",
                state={
                    "task_id": task_id,
                    "query": query,
                    "status": TaskStatus.RUNNING,
                    "iteration": 0,
                    "max_iterations": max_iterations,
                    "source_budget": source_budget,
                    "token_budget": token_budget,
                },
            )
            session.commit()

        deadline = (
            datetime.now(timezone.utc) + timedelta(seconds=time_budget_seconds)
            if time_budget_seconds
            else None
        )

        final_status = "completed"
        final_step = "build_report"

        try:
            # run_research creates its own event loop or runs async
            res = asyncio.run(
                run_research(
                    service=service,
                    query=query,
                    task_id=task_uuid,
                    source_budget=source_budget,
                    max_iterations=max_iterations,
                    deadline_at=deadline,
                    token_budget=token_budget,
                )
            )
            final_status = str(res.get("status", "completed"))
            final_step = "complete"
        except Exception as exc:
            logger.exception("Research task %s execution encountered: %s", task_id, exc)
            final_status = "failed"
            final_step = "error"

        # Final progress event
        asyncio.run_coroutine_threadsafe(
            _async_push(task_id, {
                "task_id": task_id,
                "status": final_status,
                "step": final_step,
                "query": query,
                "progress_pct": 100,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }),
            loop,
        ).result(timeout=5)

        # Sentinel to end SSE
        asyncio.run_coroutine_threadsafe(
            _progress_queues.get(task_id, asyncio.Queue()).put(_SENTINEL),
            loop,
        )

    try:
        await loop.run_in_executor(None, _run_worker)
    except Exception as exc:
        logger.exception("Executor failure for task %s: %s", task_id, exc)


async def _async_push(task_id: str, event: dict[str, Any]) -> None:
    _push_event(task_id, event)
