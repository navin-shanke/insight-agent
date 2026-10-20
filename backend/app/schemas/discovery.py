"""Discovery-related Pydantic contracts.

A DiscoveryRecord consolidates one or more source records into a single
findings unit with a verification status that reflects gathered evidence,
not an assertion of truth.
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional, List
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field, field_validator

from .source import SourceReference


def _now_utc() -> datetime:
    from datetime import timezone

    return datetime.now(timezone.utc)


class DiscoveryRecord(BaseModel):
    """A consolidated discovery backed by one or more source records."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID = Field(default_factory=uuid4)
    title: str
    summary: str
    category: Optional[str] = None
    first_seen_at: datetime = Field(default_factory=_now_utc)
    updated_at: datetime = Field(default_factory=_now_utc)
    source_references: List[SourceReference] = Field(default_factory=list)
    verification_status: str = Field(
        default="UNVERIFIED",
        description=(
            "UNVERIFIED | SUPPORTED | CONTRADICTED | MIXED_EVIDENCE | "
            "INSUFFICIENT_EVIDENCE | OUTDATED | NOT_APPLICABLE"
        ),
    )
    relevance_score: Optional[float] = Field(default=None, ge=0, le=100)
    novelty_score: Optional[float] = Field(default=None, ge=0, le=100)
    evidence_quality_score: Optional[float] = Field(default=None, ge=0, le=100)
    usefulness_score: Optional[float] = Field(default=None, ge=0, le=100)


class DiscoveryCreate(BaseModel):
    """Payload for creating a new discovery."""

    title: str
    summary: str
    category: Optional[str] = None
    source_references: List[SourceReference] = Field(default_factory=list)
    verification_status: str = "UNVERIFIED"
    relevance_score: Optional[float] = Field(default=None, ge=0, le=100)
    novelty_score: Optional[float] = Field(default=None, ge=0, le=100)
    evidence_quality_score: Optional[float] = Field(default=None, ge=0, le=100)
    usefulness_score: Optional[float] = Field(default=None, ge=0, le=100)
