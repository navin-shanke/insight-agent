"""Daily discovery scheduler for Phase 4."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4
import uuid

from app.agents.graph import run_research
from app.agents.service import ResearchService
from app.db.models import ScheduledRun


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

        Acquires a scheduler lock idempotently using a stable task key;
        guarantees lock release on success or failure via ``finally``.

        The ``task_id`` key ``"daily_discovery"`` is shared across invocations,
        so only one daily-discovery run can proceed at a time.

        Returns:
            Task result dictionary
        """
        import asyncio

        task_id = "daily_discovery"
        with self.service.session() as session:
            if not self.acquire_lock(session, task_id):
                return {"status": "skipped", "reason": "lock_held_by_other_task"}

            error = None
            try:
                result = await run_research(
                    self.service,
                    task_id=uuid.UUID(task_id),
                    query=query,
                    topics=topics,
                    lookback_hours=24,
                    source_budget=source_budget,
                    max_iterations=max_iterations,
                )
                self.release_lock(session, task_id, "completed")
                return result
            except Exception as e:
                error = e
                raise
            finally:
                if error is not None:
                    self.release_lock(session, task_id, "failed")