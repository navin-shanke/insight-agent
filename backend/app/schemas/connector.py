"""Connector-level Pydantic contracts and the SourceConnector protocol.

Every external platform is accessed through an adapter implementing
``SourceConnector``.  Results carry explicit provenance (connector name,
retrieval timestamp, access status) so the research layer can continue
using healthy sources when another connector is blocked.
"""

from __future__ import annotations

from datetime import datetime
from typing import Protocol, Optional, List, Dict, Any, Literal
from uuid import UUID, uuid4

from pydantic import BaseModel, ConfigDict, Field

from .source import SourceRecord, ContentSnapshot, AccessStatus


def _now_utc() -> datetime:
    from datetime import timezone

    return datetime.now(timezone.utc)


class ConnectorHealth(BaseModel):
    """Health state of a connector."""

    model_config = ConfigDict(frozen=True)

    name: str
    status: AccessStatus
    checked_at: datetime = Field(default_factory=_now_utc)
    message: Optional[str] = None
    rate_limit_reset_at: Optional[datetime] = None


class ConnectorCapabilities(BaseModel):
    """Static capabilities advertised by a connector."""

    model_config = ConfigDict(frozen=True)

    name: str
    supports_search: bool = False
    supports_fetch: bool = False
    supports_comments: bool = False
    supports_media: bool = False
    requires_auth: bool = False
    max_results_per_query: Optional[int] = None


class AccessFailure(BaseModel):
    """Record of a source that could not be fully accessed."""

    model_config = ConfigDict(frozen=True)

    source_url: str
    access_status: AccessStatus
    reason: Optional[str] = None
    retrieved_at: datetime = Field(default_factory=_now_utc)
    retry_after_seconds: Optional[int] = None


class EvidenceRecord(BaseModel):
    """A single piece of evidence linking a claim to a source."""

    model_config = ConfigDict(frozen=True)

    source_id: UUID
    excerpt: str
    stance: Literal["supports", "contradicts", "contextualizes"] = "contextualizes"
    retrieved_at: datetime = Field(default_factory=_now_utc)
    quality_notes: Optional[str] = None
    independence_group: Optional[str] = None


class DiscoveryRequest(BaseModel):
    """A request for a connector to discover candidate sources."""

    model_config = ConfigDict(frozen=True)

    query: str
    topics: List[str] = Field(default_factory=list)
    lookback_hours: Optional[int] = Field(default=None, ge=1)
    max_results: int = Field(default=10, ge=1, le=100)
    source_preferences: List[str] = Field(default_factory=list)


class DiscoveryResult(BaseModel):
    """Result of a connector discovery call."""

    model_config = ConfigDict(frozen=True)

    connector_name: str
    query: str
    records: List[SourceRecord] = Field(default_factory=list)
    failures: List[AccessFailure] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    retrieved_at: datetime = Field(default_factory=_now_utc)
    total_available: Optional[int] = Field(
        default=None,
        description="Total results the provider reports (for completeness metadata).",
    )
    page: Optional[int] = None
    page_size: Optional[int] = None
    has_more: Optional[bool] = None
    complete: bool = Field(
        default=True,
        description="False when results were truncated, sampled, or partially failed.",
    )


class FetchedContent(BaseModel):
    """Result of a connector fetch call."""

    model_config = ConfigDict(frozen=True)

    connector_name: str
    source: SourceRecord
    snapshot: ContentSnapshot
    warnings: List[str] = Field(default_factory=list)
    error: Optional[AccessFailure] = None


class ConnectorResult(BaseModel):
    """Generic connector operation result: records plus completeness/error metadata."""

    model_config = ConfigDict(frozen=True)

    connector_name: str
    records: List[Any] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    errors: List[AccessFailure] = Field(default_factory=list)
    retrieved_at: datetime = Field(default_factory=_now_utc)
    complete: bool = Field(
        default=True,
        description="False when results were truncated, sampled, or partially failed.",
    )


class SourceConnector(Protocol):
    """Common connector interface independent of underlying technology.

    Every external platform adapter implements this contract.
    """

    name: str

    async def health_check(self) -> ConnectorHealth: ...

    async def discover(
        self, request: DiscoveryRequest
    ) -> DiscoveryResult: ...

    async def fetch(
        self, source: SourceReference
    ) -> FetchedContent: ...

    async def capabilities(self) -> ConnectorCapabilities: ...


__all__ = [
    "SourceConnector",
    "ConnectorHealth",
    "ConnectorCapabilities",
    "AccessFailure",
    "EvidenceRecord",
    "DiscoveryRequest",
    "DiscoveryResult",
    "FetchedContent",
    "ConnectorResult",
    "SourceRecord",
    "ContentSnapshot",
    "DiscoveryRecord",
    "SourceReference",
    "AccessStatus",
    "SourceType",
]
