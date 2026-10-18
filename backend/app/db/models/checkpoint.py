"""SQLAlchemy ORM model for graph checkpoints.

Persists the LangGraph research state after each node so an interrupted
task can resume from the last durable checkpoint (Blueprint Part V §14,
Part XXIV).  One row per checkpoint step per thread.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import String, DateTime, Text, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


def _now_utc() -> datetime:
    from datetime import timezone

    return datetime.now(timezone.utc)


class TaskCheckpoint(Base):
    """A persisted research-graph checkpoint for a thread / task."""

    __tablename__ = "task_checkpoints"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    thread_id: Mapped[str] = mapped_column(String(255), nullable=False)
    task_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    step: Mapped[str] = mapped_column(String(64), nullable=False)
    state_json: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True,
        default=_now_utc,
    )

    __table_args__ = (
        Index("ix_task_checkpoints_thread_step", "thread_id", "step"),
    )

    def __repr__(self) -> str:  # pragma: no cover - debugging aid
        return f"<TaskCheckpoint thread={self.thread_id} step={self.step}>"
