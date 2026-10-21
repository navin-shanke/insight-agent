"""Pydantic schemas for discoveries API."""

from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel


class DiscoverySourceOut(BaseModel):
    source_id: str
    url: str
    title: Optional[str]
    link_type: Optional[str]

    model_config = {"from_attributes": True}


class DiscoveryOut(BaseModel):
    id: str
    title: str
    summary: str
    category: Optional[str]
    verification_status: str
    relevance_score: Optional[int]
    novelty_score: Optional[int]
    evidence_quality_score: Optional[int]
    usefulness_score: Optional[int]
    created_at: datetime
    updated_at: datetime
    sources: list[DiscoverySourceOut] = []

    model_config = {"from_attributes": True}


class DiscoveryListResponse(BaseModel):
    items: list[DiscoveryOut]
    total: int
    page: int
    page_size: int
    has_next: bool
