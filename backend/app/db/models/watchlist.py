"""SQLAlchemy ORM model for watchlists.

Maps to the ``watchlists`` table (Blueprint Part VI §19).  A watchlist is a
user-configured research topic with keywords and source preferences that
drives scheduled daily discovery runs.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import String, DateTime, Text, JSON, Boolean
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


def _now_utc() -> datetime:
    from datetime import timezone

    return datetime.now(timezone.utc)


class Watchlist(Base):
    """A user-configured research topic with keywords and source preferences.

    Each watchlist defines a topic the user wants to monitor.  The
    scheduler uses watchlists to generate discovery queries during daily
    runs.
    """

    __tablename__ = "watchlists"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    topic: Mapped[str] = mapped_column(String(255), nullable=False)
    keywords_json: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    source_preferences_json: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
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

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<Watchlist id={self.id} topic={self.topic!r} enabled={self.enabled}>"
