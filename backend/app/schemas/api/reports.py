"""Pydantic schemas for reports API."""

from __future__ import annotations

from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, Field


class ReportOut(BaseModel):
    id: str
    title: str
    query: str
    summary: Optional[str] = None
    limitations: Optional[str] = None
    task_id: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    discovery_ids: list[str] = []

    model_config = {"from_attributes": True}


class ReportFinding(BaseModel):
    id: str
    claim_text: str
    verification_status: str
    category: Optional[str] = None
    confidence_rationale: Optional[str] = None
    source_url: Optional[str] = None
    source_domain: Optional[str] = None
    evidence_excerpts: List[str] = Field(default_factory=list)


class ReportSource(BaseModel):
    url: str
    domain: str
    title: Optional[str] = None


class ReportMetrics(BaseModel):
    unique_sources_count: int = 0
    unique_domains_count: int = 0
    total_discoveries_count: int = 0
    total_claims_count: int = 0
    supported_count: int = 0
    partially_supported_count: int = 0
    contradicted_count: int = 0
    unverified_count: int = 0


class ReportDetailOut(ReportOut):
    body_md: str
    executive_summary: Optional[str] = None
    metrics: ReportMetrics = Field(default_factory=ReportMetrics)
    findings: List[ReportFinding] = Field(default_factory=list)
    sources: List[ReportSource] = Field(default_factory=list)


class ReportListResponse(BaseModel):
    items: list[ReportOut]
    total: int
    page: int
    page_size: int
    has_next: bool
