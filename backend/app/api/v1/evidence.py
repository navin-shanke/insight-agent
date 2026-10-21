"""Evidence and Claims API — Phase 5.

GET /api/v1/evidence                  Paginated evidence list.
GET /api/v1/evidence/claims           Paginated claims with nested evidence.
GET /api/v1/evidence/claims/{claim_id} Single claim with all evidence.
"""

from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

from app.api.v1.auth import get_current_user
from app.core.config import get_settings
from app.db.models import Evidence, Claim, Source
from app.schemas.api.auth import TokenData
from app.schemas.api.evidence import (
    ClaimListResponse,
    ClaimOut,
    EvidenceListResponse,
    EvidenceOut,
)

router = APIRouter(prefix="/evidence", tags=["evidence"])


def _session() -> Session:
    settings = get_settings()
    db_url = settings.database_url.replace("sqlite+aiosqlite:///", "sqlite:///")
    engine = create_engine(db_url, connect_args={"check_same_thread": False})
    return Session(engine)


def _evidence_to_out(e: Evidence, s: Session) -> EvidenceOut:
    src = s.get(Source, e.source_id)
    return EvidenceOut(
        id=str(e.id),
        claim_id=str(e.claim_id),
        source_id=str(e.source_id),
        source_url=src.url if src else None,
        source_title=src.title if src else None,
        excerpt=e.excerpt,
        stance=e.stance,
        retrieved_at=e.retrieved_at,
        independence_group=e.independence_group,
        quality_notes=e.quality_notes,
    )


def _claim_to_out(c: Claim, s: Session) -> ClaimOut:
    evs = s.execute(
        select(Evidence).where(Evidence.claim_id == c.id)
    ).scalars().all()
    return ClaimOut(
        id=str(c.id),
        task_id=None,  # Claim model has no task_id column
        text=c.claim_text,
        category=c.claim_type,
        confidence=None,  # stored as verification_status string, not float
        created_at=c.last_verified_at,  # nearest available timestamp
        evidence=[_evidence_to_out(e, s) for e in evs],
    )


@router.get("", response_model=EvidenceListResponse, summary="List all evidence records")
async def list_evidence(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    stance: Optional[str] = Query(default=None),
    _user: TokenData = Depends(get_current_user),
) -> EvidenceListResponse:
    s = _session()
    try:
        stmt = select(Evidence)
        if stance:
            stmt = stmt.where(Evidence.stance == stance)
        stmt = stmt.order_by(Evidence.retrieved_at.desc())

        total = s.execute(select(func.count()).select_from(stmt.subquery())).scalar_one() or 0
        rows = s.execute(stmt.offset((page - 1) * page_size).limit(page_size)).scalars().all()

        return EvidenceListResponse(
            items=[_evidence_to_out(e, s) for e in rows],
            total=total,
            page=page,
            page_size=page_size,
            has_next=(page * page_size) < total,
        )
    finally:
        s.close()


@router.get("/claims", response_model=ClaimListResponse, summary="List all claims with evidence")
async def list_claims(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    q: Optional[str] = Query(default=None),
    _user: TokenData = Depends(get_current_user),
) -> ClaimListResponse:
    s = _session()
    try:
        stmt = select(Claim)
        if q:
            stmt = stmt.where(Claim.text.ilike(f"%{q}%"))
        stmt = stmt.order_by(Claim.created_at.desc())

        total = s.execute(select(func.count()).select_from(stmt.subquery())).scalar_one() or 0
        rows = s.execute(stmt.offset((page - 1) * page_size).limit(page_size)).scalars().all()

        return ClaimListResponse(
            items=[_claim_to_out(c, s) for c in rows],
            total=total,
            page=page,
            page_size=page_size,
            has_next=(page * page_size) < total,
        )
    finally:
        s.close()


@router.get("/claims/{claim_id}", response_model=ClaimOut, summary="Get a single claim with evidence")
async def get_claim(
    claim_id: str,
    _user: TokenData = Depends(get_current_user),
) -> ClaimOut:
    s = _session()
    try:
        try:
            cid = UUID(claim_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid claim UUID")
        c = s.get(Claim, cid)
        if not c:
            raise HTTPException(status_code=404, detail="Claim not found")
        return _claim_to_out(c, s)
    finally:
        s.close()
