"""Pydantic schemas for evidence and claims API."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class EvidenceOut(BaseModel):
    id: str
    claim_id: str
    source_id: str
    source_url: Optional[str]
    source_title: Optional[str]
    excerpt: str
    stance: str
    retrieved_at: datetime
    independence_group: Optional[str]
    quality_notes: Optional[str]

    model_config = {"from_attributes": True}


class ClaimOut(BaseModel):
    id: str
    task_id: Optional[str]
    text: str
    category: Optional[str]
    confidence: Optional[float]
    created_at: Optional[datetime]
    evidence: list[EvidenceOut] = []

    model_config = {"from_attributes": True}


class EvidenceListResponse(BaseModel):
    items: list[EvidenceOut]
    total: int
    page: int
    page_size: int
    has_next: bool


class ClaimListResponse(BaseModel):
    items: list[ClaimOut]
    total: int
    page: int
    page_size: int
    has_next: bool
