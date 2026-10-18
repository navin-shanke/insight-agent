"""SQLAlchemy ORM model for claim evidence.

Maps to the ``evidence`` table (Blueprint Part VI §19).  Each evidence
record links a claim to a source with an excerpt, stance, and retrieval
time, plus notes on independence and quality.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import String, DateTime, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


def _now_utc() -> datetime:
    from datetime import timezone

    return datetime.now(timezone.utc)


class Evidence(Base):
    """Evidence linking a claim to a source, with a stance."""

    __tablename__ = "evidence"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    claim_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("claims.id", ondelete="CASCADE"), nullable=False, index=True
    )
    source_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("sources.id", ondelete="CASCADE"), nullable=False, index=True
    )
    excerpt: Mapped[str] = mapped_column(Text, nullable=False)
    stance: Mapped[str] = mapped_column(
        String(32), nullable=False, default="contextualizes", index=True
    )
    retrieved_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    independence_group: Mapped[Optional[str]] = mapped_column(
        String(64), nullable=True, index=True
    )
    quality_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    claim: Mapped["Claim"] = relationship(back_populates="evidence")
    source: Mapped["Source"] = relationship()

    __table_args__ = ()

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<Evidence id={self.id} stance={self.stance}>"
