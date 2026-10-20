"""SQLAlchemy ORM model for extracted factual claims.

Maps to the ``claims`` table (Blueprint Part VI §19).  Each claim is a
discrete, independently verifiable statement tied to a source, with a
verification status that reflects gathered evidence -- never an assertion
of truth.
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


class Claim(Base):
    """A discrete factual claim extracted from source content."""

    __tablename__ = "claims"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    source_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("sources.id", ondelete="CASCADE"), nullable=False, index=True
    )
    claim_text: Mapped[str] = mapped_column(Text, nullable=False)
    claim_type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    verification_status: Mapped[str] = mapped_column(
        String(32), nullable=False, default="UNVERIFIED", index=True
    )
    confidence_rationale: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    last_verified_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    source: Mapped["Source"] = relationship(back_populates="claims")
    evidence: Mapped[list["Evidence"]] = relationship(
        back_populates="claim", cascade="all, delete-orphan"
    )

    __table_args__ = ()

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<Claim id={self.id} status={self.verification_status}>"
