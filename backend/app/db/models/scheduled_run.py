"""SQLAlchemy ORM model for scheduled discovery runs.

Maps to the ``scheduled_runs`` table (Blueprint Part VI §19).  Each row
records a scheduled daily discovery run with its schedule, next run time,
and status, enabling idempotent daily execution.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import String, DateTime, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


def _now_utc() -> datetime:
    from datetime import timezone

    return datetime.now(timezone.utc)


class ScheduledRun(Base):
    """A scheduled discovery run record.

    Tracks the schedule and state of scheduled discovery runs so that
    daily discovery can be idempotent and resumable across restarts.
    """

    __tablename__ = "scheduled_runs"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    task_id: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    lease_owner: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    lease_expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    schedule_key: Mapped[str] = mapped_column(String(255), nullable=True, unique=True, index=True)
    next_run_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
    )
    last_run_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="pending", index=True)
    error_summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    digest_md: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    coverage_json: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
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
        return f"<ScheduledRun key={self.schedule_key} task_id={self.task_id} status={self.status}>"
