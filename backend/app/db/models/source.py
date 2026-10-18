"""SQLAlchemy ORM model for durable source records.

Maps to the ``sources`` table (Blueprint Part VI §19).  One row per
canonical source URL; content snapshots and discoveries reference it.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import String, DateTime, Text, JSON, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


class Source(Base):
    """A durable source record with provenance timestamps."""

    __tablename__ = "sources"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    source_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    canonical_url: Mapped[str] = mapped_column(Text, nullable=False, unique=True, index=True)
    platform_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    title: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    author_or_publisher: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    published_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, index=True
    )
    first_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
        default=_now_utc,
    )
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
        default=_now_utc,
    )
    retrieval_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    access_status: Mapped[str] = mapped_column(String(32), nullable=False, default="READY")
    metadata_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)

    snapshots: Mapped[list["ContentSnapshot"]] = relationship(
        back_populates="source", cascade="all, delete-orphan"
    )
    discovery_links: Mapped[list["DiscoverySource"]] = relationship(
        back_populates="source", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<Source id={self.id} url={self.canonical_url!r}>"

