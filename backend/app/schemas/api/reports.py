"""Pydantic schemas for reports API."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class ReportOut(BaseModel):
    id: str
    title: str
    query: str
    summary: Optional[str]
    limitations: Optional[str]
    task_id: Optional[str]
    created_at: datetime
    updated_at: datetime
    discovery_ids: list[str] = []

    model_config = {"from_attributes": True}


class ReportDetailOut(ReportOut):
    body_md: str


class ReportListResponse(BaseModel):
    items: list[ReportOut]
    total: int
    page: int
    page_size: int
    has_next: bool
