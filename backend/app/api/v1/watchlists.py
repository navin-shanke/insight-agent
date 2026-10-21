"""Watchlists API — Phase 5.

GET    /api/v1/watchlists            List all watchlists.
POST   /api/v1/watchlists            Create a new watchlist.
GET    /api/v1/watchlists/{id}       Get a single watchlist.
PATCH  /api/v1/watchlists/{id}       Update a watchlist (enable/disable/rename).
DELETE /api/v1/watchlists/{id}       Delete a watchlist.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.api.v1.auth import get_current_user
from app.core.config import get_settings
from app.db.models import Watchlist
from app.schemas.api.auth import TokenData
from app.schemas.api.watchlists import (
    WatchlistCreateRequest,
    WatchlistListResponse,
    WatchlistOut,
    WatchlistUpdateRequest,
)

router = APIRouter(prefix="/watchlists", tags=["watchlists"])


def _session() -> Session:
    settings = get_settings()
    db_url = settings.database_url.replace("sqlite+aiosqlite:///", "sqlite:///")
    engine = create_engine(db_url, connect_args={"check_same_thread": False})
    return Session(engine)


def _to_out(w: Watchlist) -> WatchlistOut:
    return WatchlistOut(
        id=str(w.id),
        name=w.name,
        topic=w.topic,
        keywords=w.keywords_json or [],
        source_preferences=w.source_preferences_json or [],
        enabled=w.enabled,
        created_at=w.created_at,
        updated_at=w.updated_at,
    )


@router.get("", response_model=WatchlistListResponse, summary="List all watchlists")
async def list_watchlists(
    _user: TokenData = Depends(get_current_user),
) -> WatchlistListResponse:
    s = _session()
    try:
        rows = s.execute(select(Watchlist).order_by(Watchlist.created_at.desc())).scalars().all()
        return WatchlistListResponse(items=[_to_out(w) for w in rows], total=len(rows))
    finally:
        s.close()


@router.post(
    "",
    response_model=WatchlistOut,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new watchlist",
)
async def create_watchlist(
    req: WatchlistCreateRequest,
    _user: TokenData = Depends(get_current_user),
) -> WatchlistOut:
    s = _session()
    try:
        now = datetime.now(timezone.utc)
        w = Watchlist(
            id=uuid.uuid4(),
            name=req.name,
            topic=req.topic,
            keywords_json=req.keywords,
            source_preferences_json=req.source_preferences,
            enabled=req.enabled,
            created_at=now,
            updated_at=now,
        )
        s.add(w)
        s.commit()
        s.refresh(w)
        return _to_out(w)
    finally:
        s.close()


@router.get("/{watchlist_id}", response_model=WatchlistOut, summary="Get a watchlist")
async def get_watchlist(
    watchlist_id: str,
    _user: TokenData = Depends(get_current_user),
) -> WatchlistOut:
    s = _session()
    try:
        try:
            wid = UUID(watchlist_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid UUID")
        w = s.get(Watchlist, wid)
        if not w:
            raise HTTPException(status_code=404, detail="Watchlist not found")
        return _to_out(w)
    finally:
        s.close()


@router.patch("/{watchlist_id}", response_model=WatchlistOut, summary="Update a watchlist")
async def update_watchlist(
    watchlist_id: str,
    req: WatchlistUpdateRequest,
    _user: TokenData = Depends(get_current_user),
) -> WatchlistOut:
    s = _session()
    try:
        try:
            wid = UUID(watchlist_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid UUID")
        w = s.get(Watchlist, wid)
        if not w:
            raise HTTPException(status_code=404, detail="Watchlist not found")

        if req.name is not None:
            w.name = req.name
        if req.topic is not None:
            w.topic = req.topic
        if req.keywords is not None:
            w.keywords_json = req.keywords
        if req.source_preferences is not None:
            w.source_preferences_json = req.source_preferences
        if req.enabled is not None:
            w.enabled = req.enabled
        w.updated_at = datetime.now(timezone.utc)

        s.commit()
        s.refresh(w)
        return _to_out(w)
    finally:
        s.close()


@router.delete(
    "/{watchlist_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a watchlist",
)
async def delete_watchlist(
    watchlist_id: str,
    _user: TokenData = Depends(get_current_user),
) -> None:
    s = _session()
    try:
        try:
            wid = UUID(watchlist_id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid UUID")
        w = s.get(Watchlist, wid)
        if not w:
            raise HTTPException(status_code=404, detail="Watchlist not found")
        s.delete(w)
        s.commit()
    finally:
        s.close()
