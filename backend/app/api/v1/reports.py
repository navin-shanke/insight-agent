"""Reports API — Phase 5.

GET /api/v1/reports           Paginated report library.
GET /api/v1/reports/{id}      Full report detail with body_md.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

from app.api.v1.auth import get_current_user
from app.core.config import get_settings
from app.db.models import Report
from app.schemas.api.auth import TokenData
from app.schemas.api.reports import ReportDetailOut, ReportListResponse, ReportOut

router = APIRouter(prefix="/reports", tags=["reports"])


def _session() -> Session:
    settings = get_settings()
    db_url = settings.database_url.replace("sqlite+aiosqlite:///", "sqlite:///")
    engine = create_engine(db_url, connect_args={"check_same_thread": False})
    return Session(engine)


def _report_to_out(r: Report) -> ReportOut:
    return ReportOut(
        id=r.id,
        title=r.title,
        query=r.query,
        summary=r.summary,
        limitations=r.limitations,
        task_id=r.task_id,
        created_at=r.created_at,
        updated_at=r.updated_at,
        discovery_ids=r.discovery_ids_json or [],
    )


def _report_to_detail(r: Report) -> ReportDetailOut:
    return ReportDetailOut(
        id=r.id,
        title=r.title,
        query=r.query,
        summary=r.summary,
        limitations=r.limitations,
        task_id=r.task_id,
        created_at=r.created_at,
        updated_at=r.updated_at,
        discovery_ids=r.discovery_ids_json or [],
        body_md=r.body_md,
    )


@router.get("", response_model=ReportListResponse, summary="List research reports")
async def list_reports(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    q: Optional[str] = Query(default=None, description="Search in title/query"),
    _user: TokenData = Depends(get_current_user),
) -> ReportListResponse:
    s = _session()
    try:
        stmt = select(Report)
        if q:
            like = f"%{q}%"
            stmt = stmt.where(Report.title.ilike(like) | Report.query.ilike(like))
        stmt = stmt.order_by(Report.created_at.desc())

        total = s.execute(select(func.count()).select_from(stmt.subquery())).scalar_one() or 0
        rows = s.execute(stmt.offset((page - 1) * page_size).limit(page_size)).scalars().all()

        return ReportListResponse(
            items=[_report_to_out(r) for r in rows],
            total=total,
            page=page,
            page_size=page_size,
            has_next=(page * page_size) < total,
        )
    finally:
        s.close()


@router.get("/{report_id}", response_model=ReportDetailOut, summary="Get full report detail")
async def get_report(
    report_id: str,
    _user: TokenData = Depends(get_current_user),
) -> ReportDetailOut:
    s = _session()
    try:
        r = s.get(Report, report_id)
        if not r:
            raise HTTPException(status_code=404, detail="Report not found")
        return _report_to_detail(r)
    finally:
        s.close()
