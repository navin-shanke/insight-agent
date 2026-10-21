"""Pydantic schemas for research task API."""

from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class ResearchSubmitRequest(BaseModel):
    query: str = Field(..., min_length=3, max_length=2000, description="Research question or topic")
    source_budget: int = Field(default=20, ge=1, le=100)
    max_iterations: int = Field(default=3, ge=1, le=5)
    time_budget_seconds: Optional[int] = Field(default=300, ge=30, le=2700)
    token_budget: int = Field(default=10000, ge=500, le=50000)


class ResearchTaskResponse(BaseModel):
    task_id: str
    query: str
    status: str
    step: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    checkpoint_count: int = 0


class ResearchListResponse(BaseModel):
    tasks: list[ResearchTaskResponse]
    total: int


class ResearchCancelResponse(BaseModel):
    task_id: str
    accepted: bool
    message: str
