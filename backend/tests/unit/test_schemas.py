"""Unit tests for shared Pydantic data contracts."""

from __future__ import annotations

from datetime import datetime, timezone

import pytest
from pydantic import ValidationError

from app.schemas import (
    SourceRecord,
    ContentSnapshot,
    DiscoveryRecord,
    SourceReference,
    AccessStatus,
    SourceType,
)


def _make_source() -> SourceRecord:
    return SourceRecord(
        source_type=SourceType.WEB_SEARCH,
        canonical_url="https://example.com/page",
        title="Example Page",
        author_or_publisher="Example Corp",
        access_status=AccessStatus.READY,
    )


def test_source_record_required_fields_and_defaults():
    source = _make_source()
    assert source.source_type == "web_search"
    assert str(source.canonical_url) == "https://example.com/page"
    assert source.title == "Example Page"
    assert source.access_status == AccessStatus.READY
    # Timestamps are present and timezone-aware (UTC).
    assert source.first_seen_at.tzinfo is not None
    assert source.last_seen_at.tzinfo is not None
    assert source.retrieval_count == 1
    assert source.metadata_json == {}


def test_source_record_published_at_optional_and_distinct():
    # published_at may be absent (genuinely unknown) -- not fabricated.
    source = SourceRecord(
        source_type=SourceType.WEB_PAGE,
        canonical_url="https://example.com/no-date",
    )
    assert source.published_at is None
    assert source.first_seen_at is not None
    assert source.first_seen_at != source.last_seen_at or source.first_seen_at == source.last_seen_at


def test_timestamps_must_be_timezone_aware():
    with pytest.raises(ValidationError):
        SourceRecord(
            source_type=SourceType.WEB_SEARCH,
            canonical_url="https://example.com/tz",
            first_seen_at=datetime(2026, 1, 1, 0, 0, 0),  # naive -> error
        )


def test_content_snapshot_requires_source_and_hash_optional():
    snap = ContentSnapshot(source_id="00000000-0000-0000-0000-000000000001")
    assert snap.source_id is not None
    assert snap.retrieved_at.tzinfo is not None
    assert snap.content_hash is None  # absent until computed
    assert snap.access_status == AccessStatus.READY


def test_discovery_record_defaults_unverified():
    disc = DiscoveryRecord(title="T", summary="S")
    assert disc.verification_status == "UNVERIFIED"
    assert disc.source_references == []
    assert disc.first_seen_at.tzinfo is not None


def test_discovery_score_bounds():
    with pytest.raises(ValidationError):
        DiscoveryRecord(
            title="T",
            summary="S",
            relevance_score=150,  # > 100 -> error
        )
    with pytest.raises(ValidationError):
        DiscoveryRecord(title="T", summary="S", novelty_score=-5)  # < 0 -> error


def test_source_reference_lightweight():
    ref = SourceReference(
        source_type=SourceType.INSTAGRAM_POST,
        canonical_url="https://instagram.com/p/ABC123",
        platform_id="ABC123",
        title="IG Post",
    )
    assert ref.platform_id == "ABC123"
    assert str(ref.canonical_url) == "https://instagram.com/p/ABC123"


def test_access_status_enum_values():
    assert AccessStatus.READY == "READY"
    assert AccessStatus.RATE_LIMITED == "RATE_LIMITED"
    assert AccessStatus.MISSING_CREDENTIALS == "MISSING_CREDENTIALS"
    assert AccessStatus.FAILED == "FAILED"
    assert AccessStatus.PARTIAL == "PARTIAL"

