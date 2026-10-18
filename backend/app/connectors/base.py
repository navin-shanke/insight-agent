"""Base helpers for source connectors."""

from __future__ import annotations

from typing import Optional
from app.schemas.connector import SourceConnector, ConnectorHealth, ConnectorCapabilities, AccessStatus


class ConnectorBase:
    """Shared behavior for connector adapters."""

    def __init__(self, name: str):
        self.name = name

    def capabilities(self) -> ConnectorCapabilities:
        return ConnectorCapabilities(
            name=self.name,
            supports_search=True,
            supports_fetch=True,
            supports_comments=False,
            supports_media=False,
            requires_auth=False,
        )

    async def health_check(self) -> ConnectorHealth:
        return ConnectorHealth(
            name=self.name,
            status=AccessStatus.READY,
            message="connector operational",
        )
