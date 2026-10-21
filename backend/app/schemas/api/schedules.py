"""Pydantic schemas for schedules API."""

from __future__ import annotations

from datetime import datetime
from typing import Optional, Any

from pydantic import BaseModel


class ScheduledRunOut(BaseModel):
    id: str
    task_id: str
    schedule_key: Optional[str]
    status: str
    last_run_at: Optional[datetime]
    next_run_at: datetime
    error_summary: Optional[str]
    digest_md: Optional[str]
    coverage: Optional[dict[str, Any]]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ScheduleListResponse(BaseModel):
    items: list[ScheduledRunOut]
    total: int
    page: int
    page_size: int
    has_next: bool
