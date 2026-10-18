"""SQLAlchemy ORM models for discoveries and their source associations.

Maps to the ``discoveries`` and ``discovery_sources`` tables
(Blueprint Part VI §19).  A discovery consolidates one or more sources.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional, List

from sqlalchemy import String, DateTime, Text, JSON, Integer, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


class DiscoverySource(Base):
    """Association linking a discovery to a source with a relationship label."""

    __tablename__ = "discovery_sources"

    discovery_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("discoveries.id", ondelete="CASCADE"), primary_key=True
    )
    source_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("sources.id", ondelete="CASCADE"), primary_key=True
    )
    link_type: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)

    discovery: Mapped["Discovery"] = relationship(back_populates="source_links")
    source: Mapped["Source"] = relationship(back_populates="discovery_links")

    __table_args__ = (
        UniqueConstraint(
            "discovery_id", "source_id", name="uq_discovery_sources"
        ),
    )

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<DiscoverySource discovery_id={self.discovery_id} source_id={self.source_id}>"


class Discovery(Base):
    """A consolidated discovery backed by one or more source records."""

    __tablename__ = "discoveries"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[Optional[str]] = mapped_column(String(128), nullable=True, index=True)
    verification_status: Mapped[str] = mapped_column(
        String(32), nullable=False, default="UNVERIFIED", index=True
    )
    relevance_score: Mapped[Optional[float]] = mapped_column(Integer, nullable=True)
    novelty_score: Mapped[Optional[float]] = mapped_column(Integer, nullable=True)
    evidence_quality_score: Mapped[Optional[float]] = mapped_column(Integer, nullable=True)
    usefulness_score: Mapped[Optional[float]] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
        default=_now_utc,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
        default=_now_utc,
    )

    source_links: Mapped[List[DiscoverySource]] = relationship(
        back_populates="discovery", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<Discovery id={self.id} title={self.title!r}>"

