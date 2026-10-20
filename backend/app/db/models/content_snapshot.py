"""SQLAlchemy ORM model for content snapshots.

Maps to the ``content_snapshots`` table (Blueprint Part VI §19).  One row
per retrieval of a source, keyed by (source_id, content_hash) for
deduplication of identical content.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import String, DateTime, Text, JSON, Integer, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base
from .source import Source


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


class ContentSnapshot(Base):
    """A single retrieval of a source's content."""

    __tablename__ = "content_snapshots"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    source_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("sources.id", ondelete="CASCADE"), nullable=False, index=True
    )
    retrieved_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
        default=_now_utc,
    )
    content_hash: Mapped[Optional[str]] = mapped_column(String(128), nullable=True, index=True)
    caption: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    text_content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    transcript: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    ocr_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    access_status: Mapped[str] = mapped_column(String(32), nullable=False, default="READY")
    coverage_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)

    source: Mapped[Source] = relationship(back_populates="snapshots")

    __table_args__ = (
        UniqueConstraint(
            "source_id", "content_hash", name="uq_content_snapshots_source_hash"
        ),
    )

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<ContentSnapshot id={self.id} source_id={self.source_id}>"

