"""Discoveries API — Phase 5.

GET /api/v1/discoveries   Paginated, filtered list of discoveries with source links.
GET /api/v1/discoveries/{id}   Single discovery detail.
"""

from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session, selectinload

from app.api.v1.auth import get_current_user
from app.core.config import get_settings
from app.db.models import Discovery, DiscoverySource, Source
from app.schemas.api.auth import TokenData
from app.schemas.api.discoveries import DiscoveryListResponse, DiscoveryOut, DiscoverySourceOut

router = APIRouter(prefix="/discoveries", tags=["discoveries"])


def _session() -> Session:
    settings = get_settings()
    db_url = settings.database_url.replace("sqlite+aiosqlite:///", "sqlite:///")
    engine = create_engine(db_url, connect_args={"check_same_thread": False})
    return Session(engine)


def _build_discovery_out(d: Discovery, s: Session) -> DiscoveryOut:
    sources = []
    for link in d.source_links:
        src = s.get(Source, link.source_id)
        sources.append(DiscoverySourceOut(
            source_id=str(link.source_id),
            url=src.url if src else "",
            title=src.title if src else None,
            link_type=link.link_type,
        ))
    return DiscoveryOut(
        id=str(d.id),
        title=d.title,
        summary=d.summary,
        category=d.category,
        verification_status=d.verification_status,
        relevance_score=d.relevance_score,
        novelty_score=d.novelty_score,
        evidence_quality_score=d.evidence_quality_score,
        usefulness_score=d.usefulness_score,
        created_at=d.created_at,
        updated_at=d.updated_at,
        sources=sources,
    )


@router.get("", response_model=DiscoveryListResponse, summary="List discoveries")
async def list_discoveries(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    category: Optional[str] = Query(default=None),
    verification_status: Optional[str] = Query(default=None),
    q: Optional[str] = Query(default=None, description="Search in title/summary"),
    _user: TokenData = Depends(get_current_user),
) -> DiscoveryListResponse:
    s = _session()
    try:
        stmt = select(Discovery)
        if category:
            stmt = stmt.where(Discovery.category == category)
        if verification_status:
            stmt = stmt.where(Discovery.verification_status == verification_status)
        if q:
            like = f"%{q}%"
            stmt = stmt.where(
                Discovery.title.ilike(like) | Discovery.summary.ilike(like)
            )
        stmt = stmt.order_by(Discovery.created_at.desc())

        total = s.execute(select(func.count()).select_from(stmt.subquery())).scalar_one() or 0
        rows = s.execute(stmt.offset((page - 1) * page_size).limit(page_size)).scalars().all()

        items = [_build_discovery_out(d, s) for d in rows]
        return DiscoveryListResponse(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            has_next=(page * page_size) < total,
        )
    finally:
        s.close()


@router.get("/{discovery_id}", response_model=DiscoveryOut, summary="Get a single discovery")
async def get_discovery(
    discovery_id: str,
    _user: TokenData = Depends(get_current_user),
) -> DiscoveryOut:
    s = _session()
    try:
        try:
            did = UUID(discovery_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid discovery UUID")
        d = s.get(Discovery, did)
        if not d:
            raise HTTPException(status_code=404, detail="Discovery not found")
        return _build_discovery_out(d, s)
    finally:
        s.close()
