"""Daily discovery scheduler for Phase 4."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4
import uuid as _uuid

from app.agents.graph import run_research
from app.agents.service import ResearchService


class SchedulerService:
    """Manages scheduled daily discovery runs with idempotent locking."""

    def __init__(self, service: ResearchService):
        self.service = service

    def acquire_lock(self, session, task_id: str) -> bool:
        """Attempt to acquire the scheduler lock for a given task ID.

        Returns True if the lock was acquired, False if already running.
        """
        from app.db.models import ScheduledRun

        run = session.query(ScheduledRun).filter_by(task_id=task_id).first()
        if run is None:
            run = ScheduledRun(
                task_id=task_id,
                status="running",
                next_run_at=datetime.now(timezone.utc),
            )
            session.add(run)
            session.flush()
            return True

        if run.status == "running":
            return False

        run.status = "running"
        run.next_run_at = datetime.now(timezone.utc)
        session.flush()
        return True

    def release_lock(self, session, task_id: str, status: str) -> None:
        """Release the scheduler lock with the given status."""
        from app.db.models import ScheduledRun

        run = session.query(ScheduledRun).filter_by(task_id=task_id).first()
        if run is None:
            return
        run.status = status
        run.last_run_at = datetime.now(timezone.utc)
        session.flush()

    async def run_daily_discovery(
        self,
        query: str,
        topics: list[str] | None = None,
        source_budget: int = 100,
        max_iterations: int = 5,
    ):
        """Run a single daily discovery task.

        Returns:
            Task result dictionary
        """
        task_id = str(uuid4())
        result = await run_research(
            self.service,
            task_id=_uuid.UUID(task_id),
            query=query,
            topics=topics,
            lookback_hours=24,
            source_budget=source_budget,
            max_iterations=max_iterations,
        )
        return result