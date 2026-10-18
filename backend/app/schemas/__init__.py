"""Shared source, content, discovery, and connector Pydantic contracts."""

from .source import (
    SourceType,
    AccessStatus,
    SourceReference,
    SourceRecord,
    ContentSnapshot,
)
from .connector import (
    SourceConnector,
    ConnectorHealth,
    ConnectorCapabilities,
    AccessFailure,
    EvidenceRecord,
    DiscoveryRequest,
    DiscoveryResult,
    FetchedContent,
    ConnectorResult,
)
from .discovery import (
    DiscoveryRecord,
    DiscoveryCreate,
)

__all__ = [
    "SourceType",
    "AccessStatus",
    "SourceReference",
    "SourceRecord",
    "ContentSnapshot",
    "DiscoveryRecord",
    "DiscoveryCreate",
    "SourceConnector",
    "ConnectorHealth",
    "ConnectorCapabilities",
    "AccessFailure",
    "EvidenceRecord",
    "DiscoveryRequest",
    "DiscoveryResult",
    "FetchedContent",
    "ConnectorResult",
]
