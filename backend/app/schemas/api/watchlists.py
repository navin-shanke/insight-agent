"""Pydantic schemas for watchlists API."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class WatchlistOut(BaseModel):
    id: str
    name: str
    topic: str
    keywords: list[str]
    source_preferences: list[str]
    enabled: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class WatchlistCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    topic: str = Field(..., min_length=1, max_length=255)
    keywords: list[str] = Field(default_factory=list)
    source_preferences: list[str] = Field(default_factory=list)
    enabled: bool = True


class WatchlistUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    topic: Optional[str] = Field(None, min_length=1, max_length=255)
    keywords: Optional[list[str]] = None
    source_preferences: Optional[list[str]] = None
    enabled: Optional[bool] = None


class WatchlistListResponse(BaseModel):
    items: list[WatchlistOut]
    total: int
