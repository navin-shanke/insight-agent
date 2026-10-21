"""Schedules API — Phase 5.

GET /api/v1/schedules            List scheduled run history.
GET /api/v1/schedules/{id}       Get a single scheduled run record.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

from app.api.v1.auth import get_current_user
from app.core.config import get_settings
from app.db.models import ScheduledRun
from app.schemas.api.auth import TokenData
from app.schemas.api.schedules import ScheduleListResponse, ScheduledRunOut

router = APIRouter(prefix="/schedules", tags=["schedules"])


def _session() -> Session:
    settings = get_settings()
    db_url = settings.database_url.replace("sqlite+aiosqlite:///", "sqlite:///")
    engine = create_engine(db_url, connect_args={"check_same_thread": False})
    return Session(engine)


def _to_out(r: ScheduledRun) -> ScheduledRunOut:
    return ScheduledRunOut(
        id=str(r.id),
        task_id=r.task_id,
        schedule_key=r.schedule_key,
        status=r.status,
        last_run_at=r.last_run_at,
        next_run_at=r.next_run_at,
        error_summary=r.error_summary,
        digest_md=r.digest_md,
        coverage=r.coverage_json,
        created_at=r.created_at,
        updated_at=r.updated_at,
    )


@router.get("", response_model=ScheduleListResponse, summary="List scheduled runs")
async def list_schedules(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    _user: TokenData = Depends(get_current_user),
) -> ScheduleListResponse:
    s = _session()
    try:
        stmt = select(ScheduledRun).order_by(ScheduledRun.updated_at.desc())
        total = s.execute(select(func.count()).select_from(stmt.subquery())).scalar_one() or 0
        rows = s.execute(stmt.offset((page - 1) * page_size).limit(page_size)).scalars().all()
        return ScheduleListResponse(
            items=[_to_out(r) for r in rows],
            total=total,
            page=page,
            page_size=page_size,
            has_next=(page * page_size) < total,
        )
    finally:
        s.close()


@router.get("/{schedule_id}", response_model=ScheduledRunOut, summary="Get a scheduled run")
async def get_schedule(
    schedule_id: str,
    _user: TokenData = Depends(get_current_user),
) -> ScheduledRunOut:
    s = _session()
    try:
        from uuid import UUID
        try:
            sid = UUID(schedule_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid UUID")
        r = s.get(ScheduledRun, sid)
        if not r:
            raise HTTPException(status_code=404, detail="Scheduled run not found")
        return _to_out(r)
    finally:
        s.close()
