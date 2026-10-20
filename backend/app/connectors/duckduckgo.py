"""DuckDuckGo web-search connector.

Implements the :class:`app.schemas.connector.SourceConnector` contract
using the free, no-API-key ``ddgs`` library (DuckDuckGo HTML endpoint).

No credentials are required for DuckDuckGo, so the connector reports
``READY`` when the library is importable and network reachable.  All
network failures (timeouts, HTTP errors, rate limits, malformed
responses) are surfaced as structured access failures -- results are
never fabricated.
"""

from __future__ import annotations

import asyncio
import hashlib
import uuid
from datetime import datetime, timezone
from typing import Optional

from ddgs import DDGS

from app.schemas.source import SourceRecord, SourceReference, SourceType, AccessStatus
from app.schemas.connector import (
    SourceConnector,
    ConnectorHealth,
    ConnectorCapabilities,
    DiscoveryRequest,
    DiscoveryResult,
    FetchedContent,
    ContentSnapshot,
    AccessFailure,
)
from app.fetcher.safe_fetch import fetch_url, FetchError
from .base import ConnectorBase


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _content_hash(text: Optional[str]) -> str:
    if not text:
        return ""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _access_from_exception(exc: Exception) -> AccessStatus:
    message = str(exc).lower()
    if "ratelimit" in message or "rate limit" in message or "429" in message:
        return AccessStatus.RATE_LIMITED
    if "timeout" in message or "timed out" in message:
        return AccessStatus.TEMPORARILY_UNAVAILABLE
    if "connection" in message or "network" in message or "dns" in message:
        return AccessStatus.TEMPORARILY_UNAVAILABLE
    return AccessStatus.FAILED


class DuckDuckGoConnector(ConnectorBase, SourceConnector):
    """DuckDuckGo web-search adapter."""

    def __init__(self):
        super().__init__(name="duckduckgo")
        self._ddg_available: Optional[bool] = None

    async def health_check(self) -> ConnectorHealth:
        # Lightweight reachability check: one result, short timeout.
        try:
            await asyncio.wait_for(
                asyncio.to_thread(self._search_once, "__health__", 1),
                timeout=15.0,
            )
            return ConnectorHealth(
                name=self.name,
                status=AccessStatus.READY,
                message="DuckDuckGo reachable",
            )
        except asyncio.TimeoutError:
            return ConnectorHealth(
                name=self.name,
                status=AccessStatus.TEMPORARILY_UNAVAILABLE,
                message="DuckDuckGo request timed out",
            )
        except Exception as exc:  # noqa: BLE001 - surface any failure as health state
            return ConnectorHealth(
                name=self.name,
                status=_access_from_exception(exc),
                message=str(exc) or "DuckDuckGo unreachable",
            )

    def _search_once(self, query: str, max_results: int):
        """Synchronous DDG search (runs in a thread)."""
        with DDGS() as ddgs:
            return list(ddgs.text(query, max_results=max_results))

    async def discover(
        self, request: DiscoveryRequest
    ) -> DiscoveryResult:
        if self._ddg_available is False:
            return DiscoveryResult(
                connector_name=self.name,
                query=request.query,
                failures=[
                    AccessFailure(
                        source_url=request.query,
                        access_status=AccessStatus.UNSUPPORTED,
                        reason="DuckDuckGo connector unavailable",
                    )
                ],
                complete=False,
            )
        try:
            raw_results = await asyncio.wait_for(
                asyncio.to_thread(
                    self._search_once, request.query, request.max_results
                ),
                timeout=30.0,
            )
        except asyncio.TimeoutError:
            return DiscoveryResult(
                connector_name=self.name,
                query=request.query,
                failures=[
                    AccessFailure(
                        source_url=request.query,
                        access_status=AccessStatus.TEMPORARILY_UNAVAILABLE,
                        reason="DuckDuckGo search timed out",
                    )
                ],
                complete=False,
            )
        except Exception as exc:  # noqa: BLE001
            status = _access_from_exception(exc)
            return DiscoveryResult(
                connector_name=self.name,
                query=request.query,
                failures=[
                    AccessFailure(
                        source_url=request.query,
                        access_status=status,
                        reason=str(exc) or "DuckDuckGo search failed",
                    )
                ],
                complete=False,
            )

        records: list[SourceRecord] = []
        warnings: list[str] = []
        for item in raw_results or []:
            url = item.get("href") or item.get("url")
            title = item.get("title") or ""
            snippet = item.get("body") or ""
            if not url:
                warnings.append("DuckDuckGo result with no URL; skipped")
                continue
            try:
                records.append(
                    SourceRecord(
                        source_type=SourceType.WEB_SEARCH.value,
                        canonical_url=url,
                        title=title or None,
                        author_or_publisher=None,
                        published_at=None,  # publication time not provided by DDG
                        access_status=AccessStatus.READY,
                        metadata_json={
                            "snippet": snippet,
                            "provider": "duckduckgo",
                        },
                    )
                )
            except Exception as exc:  # noqa: BLE001
                warnings.append(f"Skipped invalid result ({url}): {exc}")

        return DiscoveryResult(
            connector_name=self.name,
            query=request.query,
            records=records,
            warnings=warnings,
            total_available=len(records),
            complete=len(warnings) == 0,
        )

    async def fetch(
        self, source: SourceReference
    ) -> FetchedContent:
        """Fetch a source page through the SSRF-safe fetcher."""
        try:
            result = await asyncio.wait_for(
                fetch_url(str(source.canonical_url)),
                timeout=45.0,
            )
        except FetchError as exc:
            return FetchedContent(
                connector_name=self.name,
                source=source,
                snapshot=ContentSnapshot(
                    source_id=uuid.uuid4(),
                    retrieved_at=datetime.now(timezone.utc),
                    access_status=_access_from_exception(exc),
                    coverage_json={"error": exc.code, "reason": exc.message},
                ),
                warnings=[],
                error=AccessFailure(
                    source_url=str(source.canonical_url),
                    access_status=_access_from_exception(exc),
                    reason=exc.message,
                ),
            )

        text = result.text or ""
        snapshot = ContentSnapshot(
            source_id=uuid.uuid4(),
            retrieved_at=datetime.now(timezone.utc),
            content_hash=_content_hash(text) or None,
            text_content=text or None,
            access_status=AccessStatus.READY,
            coverage_json={
                "status_code": result.status_code,
                "content_type": result.content_type,
                "redirect_chain": result.redirect_chain,
                "bytes": len(result.content),
            },
        )
        return FetchedContent(
            connector_name=self.name,
            source=source,
            snapshot=snapshot,
            warnings=[],
        )

    def capabilities(self) -> ConnectorCapabilities:
        return ConnectorCapabilities(
            name=self.name,
            supports_search=True,
            supports_fetch=True,
            supports_comments=False,
            supports_media=False,
            requires_auth=False,
            max_results_per_query=20,
        )
