"""Integration tests for SQLAlchemy models, uniqueness constraints, and persistence."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

import pytest
from sqlalchemy.exc import IntegrityError

from app.db.models import Source, ContentSnapshot, Discovery, DiscoverySource


def test_insert_and_query_source(db_session):
    source = Source(
        source_type="web_search",
        canonical_url="https://example.com/page",
        title="Example Page",
        access_status="READY",
    )
    db_session.add(source)
    db_session.commit()
    db_session.refresh(source)

    assert source.id is not None
    assert source.first_seen_at is not None
    assert source.last_seen_at is not None

    found = db_session.query(Source).filter_by(canonical_url="https://example.com/page").one()
    assert found.id == source.id
    assert found.title == "Example Page"


def test_unique_canonical_url(db_session):
    db_session.add(
        Source(
            source_type="web_search",
            canonical_url="https://example.com/unique",
            title="First",
        )
    )
    db_session.commit()
    db_session.add(
        Source(
            source_type="web_search",
            canonical_url="https://example.com/unique",
            title="Duplicate",
        )
    )
    with pytest.raises(IntegrityError):
        db_session.commit()


def test_content_snapshot_unique_source_hash(db_session):
    source = Source(source_type="web_search", canonical_url="https://example.com/snap")
    db_session.add(source)
    db_session.commit()
    db_session.refresh(source)

    snap1 = ContentSnapshot(
        source_id=source.id,
        content_hash="abc123",
        text_content="body one",
    )
    snap2 = ContentSnapshot(
        source_id=source.id,
        content_hash="abc123",  # same source + same hash -> duplicate
        text_content="body two",
    )
    db_session.add(snap1)
    db_session.commit()
    db_session.add(snap2)
    with pytest.raises(IntegrityError):
        db_session.commit()


def test_discovery_source_unique_association(db_session):
    source = Source(source_type="web_search", canonical_url="https://example.com/assoc")
    discovery = Discovery(title="D", summary="S")
    db_session.add_all([source, discovery])
    db_session.commit()
    db_session.refresh(source)
    db_session.refresh(discovery)

    db_session.add(
        DiscoverySource(discovery_id=discovery.id, source_id=source.id, link_type="cites")
    )
    db_session.commit()
    db_session.add(
        DiscoverySource(discovery_id=discovery.id, source_id=source.id, link_type="cites")
    )
    with pytest.raises(IntegrityError):
        db_session.commit()


def test_cascade_delete_source_removes_snippets_and_links(db_session):
    source = Source(source_type="web_search", canonical_url="https://example.com/cascade")
    discovery = Discovery(title="D", summary="S")
    db_session.add_all([source, discovery])
    db_session.commit()
    db_session.refresh(source)
    db_session.refresh(discovery)

    db_session.add(
        ContentSnapshot(source_id=source.id, content_hash="h", text_content="t")
    )
    db_session.add(
        DiscoverySource(
            discovery_id=discovery.id, source_id=source.id, link_type="cites"
        )
    )
    db_session.commit()

    db_session.delete(source)
    db_session.commit()

    assert db_session.query(ContentSnapshot).count() == 0
    assert db_session.query(DiscoverySource).count() == 0
    assert db_session.query(Discovery).count() == 1  # discovery itself remains


def test_discovery_verification_status_indexed_and_queryable(db_session):
    db_session.add(
        Discovery(
            title="Verified",
            summary="S",
            verification_status="SUPPORTED",
        )
    )
    db_session.add(
        Discovery(title="Unverified", summary="S", verification_status="UNVERIFIED")
    )
    db_session.commit()

    supported = (
        db_session.query(Discovery)
        .filter_by(verification_status="SUPPORTED")
        .all()
    )
    assert len(supported) == 1
    assert supported[0].title == "Verified"
