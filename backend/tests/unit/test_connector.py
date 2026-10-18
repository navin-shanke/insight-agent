"""Unit tests for the DuckDuckGo connector (DDGS mocked, no network)."""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from unittest import mock

import pytest

from app.connectors import DuckDuckGoConnector
from app.schemas.source import SourceReference
from app.schemas.connector import DiscoveryRequest
from app.fetcher.safe_fetch import FetchResult, FetchError


def _run(coro):
    return asyncio.run(coro)


def _fake_ddg_results(items):
    class _DDG:
        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def text(self, query, max_results):
            return items

    return _DDG()


def test_discover_success_returns_records():
    items = [
        {"href": "https://example.com/a", "title": "Result A", "body": "Snippet A"},
        {"href": "https://example.com/b", "title": "Result B", "body": "Snippet B"},
    ]
    with mock.patch(
        "app.connectors.duckduckgo.DDGS", return_value=_fake_ddg_results(items)
    ):
        conn = DuckDuckGoConnector()
        result = _run(conn.discover(DiscoveryRequest(query="test", max_results=5)))

    assert result.connector_name == "duckduckgo"
    assert len(result.records) == 2
    assert result.records[0].source_type == "web_search"
    assert str(result.records[0].canonical_url) == "https://example.com/a"
    assert result.records[0].title == "Result A"
    assert result.records[0].published_at is None  # publication time unknown
    assert result.records[0].access_status.value == "READY"
    assert result.warnings == []
    assert result.complete is True


def test_discover_empty_returns_no_records():
    with mock.patch(
        "app.connectors.duckduckgo.DDGS", return_value=_fake_ddg_results([])
    ):
        conn = DuckDuckGoConnector()
        result = _run(conn.discover(DiscoveryRequest(query="test", max_results=5)))
    assert result.records == []
    assert result.complete is True


def test_discover_malformed_result_skipped_with_warning():
    items = [
        {"title": "No URL", "body": "snippet"},  # no href -> skipped
        {"href": "https://example.com/ok", "title": "OK", "body": "s"},
    ]
    with mock.patch(
        "app.connectors.duckduckgo.DDGS", return_value=_fake_ddg_results(items)
    ):
        conn = DuckDuckGoConnector()
        result = _run(conn.discover(DiscoveryRequest(query="test", max_results=5)))
    assert len(result.records) == 1
    assert str(result.records[0].canonical_url) == "https://example.com/ok"
    assert len(result.warnings) == 1


def test_discover_timeout_reported_as_temporary_unavailable():
    with mock.patch(
        "app.connectors.duckduckgo.DDGS", side_effect=TimeoutError("timed out")
    ):
        conn = DuckDuckGoConnector()
        result = _run(conn.discover(DiscoveryRequest(query="test", max_results=5)))
    assert result.records == []
    assert len(result.failures) == 1
    assert result.failures[0].access_status.value == "TEMPORARILY_UNAVAILABLE"
    assert result.complete is False


def test_fetch_success_via_safe_fetcher():
    source = SourceReference(
        source_type="web_page",
        canonical_url="https://example.com/page",
        title="Page",
    )
    fetch_result = FetchResult(
        url="https://example.com/page",
        status_code=200,
        headers={"content-type": "text/html"},
        content=b"<html>hi</html>",
        text="<html>hi</html>",
        content_type="text/html",
        fetched_at=datetime.now(timezone.utc).isoformat(),
        redirect_chain=["https://example.com/page"],
    )
    with mock.patch("app.connectors.duckduckgo.fetch_url", return_value=fetch_result):
        conn = DuckDuckGoConnector()
        fetched = _run(conn.fetch(source))

    assert fetched.source.canonical_url == source.canonical_url
    assert fetched.source.source_type == source.source_type
    assert fetched.snapshot.access_status.value == "READY"
    assert fetched.snapshot.text_content == "<html>hi</html>"
    assert fetched.snapshot.content_hash != ""
    assert fetched.error is None


def test_fetch_blocked_returns_error_not_crash():
    source = SourceReference(
        source_type="web_page",
        canonical_url="http://127.0.0.1/blocked",
    )
    with mock.patch(
        "app.connectors.duckduckgo.fetch_url",
        side_effect=FetchError("blocked", code="blocked_host"),
    ):
        conn = DuckDuckGoConnector()
        fetched = _run(conn.fetch(source))

    assert fetched.error is not None
    assert fetched.error.access_status.value == "FAILED"
    assert fetched.error.reason == "blocked"


def test_capabilities():
    conn = DuckDuckGoConnector()
    caps = conn.capabilities()
    assert caps.supports_search is True
    assert caps.supports_fetch is True
    assert caps.requires_auth is False
    assert caps.max_results_per_query == 20
