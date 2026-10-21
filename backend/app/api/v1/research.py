"""Research tasks API — Phase 5.

POST   /api/v1/research              Submit a new bounded research task
GET    /api/v1/research              List all tasks (from DB checkpoints)
GET    /api/v1/research/{task_id}    Get task status (polling fallback)
DELETE /api/v1/research/{task_id}/cancel   Request cooperative cancellation
GET    /api/v1/research/{task_id}/progress SSE live progress stream
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timezone
from typing import AsyncGenerator

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy import create_engine, func, select, distinct
from sqlalchemy.orm import Session

from app.api.v1.auth import get_current_user
from app.core.config import get_settings
from app.db.models import TaskCheckpoint, ResearchCancellation
from app.schemas.api.auth import TokenData
from app.schemas.api.research import (
    ResearchCancelResponse,
    ResearchListResponse,
    ResearchSubmitRequest,
    ResearchTaskResponse,
)
from app.services.task_runner import get_progress_stream, get_cached_status, submit_research_task
from app.schemas.research_state import TaskStatus

router = APIRouter(prefix="/research", tags=["research"])
logger = logging.getLogger(__name__)


def _get_db_session() -> Session:
    settings = get_settings()
    db_url = settings.database_url.replace("sqlite+aiosqlite:///", "sqlite:///")
    engine = create_engine(db_url, connect_args={"check_same_thread": False})
    return Session(engine)


def _task_from_checkpoints(task_id: str, session: Session) -> ResearchTaskResponse | None:
    """Build a ResearchTaskResponse from persisted TaskCheckpoint rows."""
    rows = (
        session.execute(
            select(TaskCheckpoint)
            .where(TaskCheckpoint.task_id == task_id)
            .order_by(TaskCheckpoint.created_at.desc())
        )
        .scalars()
        .all()
    )
    if not rows:
        return None

    latest = rows[0]
    oldest = rows[-1]

    # Determine status from latest step name
    step = latest.step
    status_map = {
        "complete": "completed",
        "report": "completed",
        "cancelled": "cancelled",
        "failed": "failed",
        "partial": "partial",
    }
    inferred_status = next(
        (v for k, v in status_map.items() if k in step.lower()), "running"
    )

    # Check if cancellation was requested
    cancel_row = session.execute(
        select(ResearchCancellation).where(ResearchCancellation.task_id == task_id)
    ).scalar_one_or_none()
    if cancel_row:
        inferred_status = "cancelled"

    import json
    state_data = {}
    try:
        state_data = json.loads(latest.state_json)
    except Exception:
        pass

    query = state_data.get("query", "")

    return ResearchTaskResponse(
        task_id=task_id,
        query=query,
        status=inferred_status,
        step=step,
        created_at=oldest.created_at,
        updated_at=latest.created_at,
        checkpoint_count=len(rows),
    )


@router.post(
    "",
    response_model=ResearchTaskResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Submit a new bounded research task",
)
async def submit_research(
    request: ResearchSubmitRequest,
    background_tasks: BackgroundTasks,
    _user: TokenData = Depends(get_current_user),
) -> ResearchTaskResponse:
    """Submit a research query. The task runs in the background; poll
    GET /research/{task_id} or stream GET /research/{task_id}/progress."""
    task_id = str(uuid.uuid4())
    task_uuid = uuid.UUID(task_id)

    # Persist the initial load_context checkpoint immediately so the task
    # is discoverable and cancellable right after submission returns.
    from app.agents.service import ResearchService
    settings = get_settings()
    db_url = settings.database_url.replace("sqlite+aiosqlite:///", "sqlite:///")
    service = ResearchService(database_url=db_url)
    with service.session() as session:
        service.save_checkpoint(
            session,
            thread_id=task_id,
            task_id=task_uuid,
            step="load_context",
            state={
                "task_id": task_id,
                "query": request.query,
                "status": TaskStatus.RUNNING,
                "iteration": 0,
                "max_iterations": request.max_iterations,
                "source_budget": request.source_budget,
                "token_budget": request.token_budget,
            },
        )
        session.commit()

    background_tasks.add_task(
        submit_research_task,
        task_id=task_id,
        query=request.query,
        source_budget=request.source_budget,
        max_iterations=request.max_iterations,
        time_budget_seconds=request.time_budget_seconds,
        token_budget=request.token_budget,
    )

    return ResearchTaskResponse(
        task_id=task_id,
        query=request.query,
        status="running",
        step="load_context",
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
        checkpoint_count=1,
    )


@router.get(
    "",
    response_model=ResearchListResponse,
    summary="List all research tasks",
)
async def list_research_tasks(
    _user: TokenData = Depends(get_current_user),
) -> ResearchListResponse:
    """Return all known tasks derived from persisted checkpoints."""
    session = _get_db_session()
    try:
        # Get distinct task_ids with their most recent checkpoint
        task_ids = session.execute(
            select(distinct(TaskCheckpoint.task_id))
            .where(TaskCheckpoint.task_id.isnot(None))
        ).scalars().all()

        tasks = []
        for tid in task_ids:
            t = _task_from_checkpoints(tid, session)
            if t:
                tasks.append(t)

        # Sort most recent first
        tasks.sort(key=lambda t: t.updated_at or datetime.min.replace(tzinfo=timezone.utc), reverse=True)

        return ResearchListResponse(tasks=tasks, total=len(tasks))
    finally:
        session.close()


@router.get(
    "/{task_id}",
    response_model=ResearchTaskResponse,
    summary="Get task status (polling fallback)",
)
async def get_task_status(
    task_id: str,
    _user: TokenData = Depends(get_current_user),
) -> ResearchTaskResponse:
    """Return the current status of a task from in-memory cache or DB."""
    # Try in-memory cache first (live tasks)
    cached = get_cached_status(task_id)
    if cached:
        return ResearchTaskResponse(
            task_id=task_id,
            query=cached.get("query", ""),
            status=cached.get("status", "unknown"),
            step=cached.get("step"),
            updated_at=datetime.fromisoformat(cached["timestamp"]) if "timestamp" in cached else None,
        )

    # Fall back to DB
    session = _get_db_session()
    try:
        task = _task_from_checkpoints(task_id, session)
        if not task:
            raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
        return task
    finally:
        session.close()


@router.delete(
    "/{task_id}/cancel",
    response_model=ResearchCancelResponse,
    summary="Request cooperative cancellation of a running task",
)
async def cancel_task(
    task_id: str,
    _user: TokenData = Depends(get_current_user),
) -> ResearchCancelResponse:
    """Persist a cancellation request. The running graph observes it at the
    next safe checkpoint boundary."""
    from app.agents.service import ResearchService
    settings = get_settings()
    db_url = settings.database_url.replace("sqlite+aiosqlite:///", "sqlite:///")
    service = ResearchService(database_url=db_url)

    try:
        task_uuid = uuid.UUID(task_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid task UUID format")

    accepted = service.request_cancellation(task_uuid)
    return ResearchCancelResponse(
        task_id=task_id,
        accepted=accepted,
        message="Cancellation request recorded." if accepted else "Cancellation was already requested.",
    )


@router.get(
    "/{task_id}/progress",
    summary="SSE live progress stream for a running task",
)
async def task_progress_stream(
    task_id: str,
    request: Request,
    _user: TokenData = Depends(get_current_user),
) -> StreamingResponse:
    """Stream Server-Sent Events with real-time progress for a running task.

    Each event is a JSON object with task_id, status, step, and timestamp.
    The stream closes when the task reaches a terminal state or the client
    disconnects.
    """
    async def _event_generator() -> AsyncGenerator[str, None]:
        async for event in get_progress_stream(task_id):
            if await request.is_disconnected():
                break
            if event.get("event") == "ping":
                yield "event: ping\ndata: \n\n"
            else:
                data = event.get("data", "{}")
                yield f"event: progress\ndata: {data}\n\n"

    return StreamingResponse(
        _event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
