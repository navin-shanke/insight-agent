"""Daily discovery scheduler for Phase 4."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from uuid import UUID, uuid4
import uuid

from app.agents.graph import run_research
from app.agents.service import ResearchService
from app.db.models import ScheduledRun


class SchedulerService:
    """Manages scheduled daily discovery runs with idempotent locking."""

    def __init__(self, service: ResearchService):
        self.service = service

    def acquire_lock(self, session, lock_key: str) -> bool:
        """Attempt to acquire the scheduler lock atomically.

        Uses INSERT ... ON CONFLICT (upsert) so that concurrent invocations
        are serialized at the database level — only one succeeds.

        Returns True if the lock was acquired, False if already running.
        """
        from app.db.models import ScheduledRun

        try:
            run = ScheduledRun(
                task_id=lock_key,
                status="running",
                next_run_at=datetime.now(timezone.utc),
            )
            session.add(run)
            session.flush()

            # Check if a row with this lock_key already existed.
            existing = (
                session.query(ScheduledRun)
                .filter_by(task_id=lock_key)
                .first()
            )
            if existing and existing.id != run.id:
                # Another invocation inserted first; reset our row and fail.
                session.delete(run)
                session.flush()
                return False

            # Persist the lock so it survives session close.
            session.commit()
            return True
        except Exception:
            session.rollback()
            return False

    def release_lock(self, session, lock_key: str, status: str) -> None:
        """Release the scheduler lock with the given status."""
        from app.db.models import ScheduledRun

        run = session.query(ScheduledRun).filter_by(task_id=lock_key).first()
        if run is None:
            return
        run.status = status
        run.last_run_at = datetime.now(timezone.utc)
        session.commit()

    async def run_daily_discovery(
        self,
        query: str,
        topics: list[str] | None = None,
        source_budget: int = 100,
        max_iterations: int = 5,
    ):
        """Run a single daily discovery task.

        Acquires a scheduler lock idempotently using a stable lock key;
        guarantees lock release on success or failure via ``finally``.

        A separate UUID is generated for each research run's task_id so that
        the UUID passed to the research graph is always valid, regardless of
        the stable lock key used for cross-invocation coordination.

        Returns:
            Task result dictionary
        """
        import asyncio

        lock_key = "daily_discovery"
        run_task_id = str(uuid4())
        with self.service.session() as session:
            if not self.acquire_lock(session, lock_key):
                return {"status": "skipped", "reason": "lock_held_by_other_task"}

            error = None
            try:
                result = await run_research(
                    self.service,
                    task_id=UUID(run_task_id),
                    query=query,
                    topics=topics,
                    lookback_hours=24,
                    source_budget=source_budget,
                    max_iterations=max_iterations,
                )
                self.release_lock(session, lock_key, "completed")
                return result
            except Exception as e:
                error = e
                raise
            finally:
                if error is not None:
                    self.release_lock(session, lock_key, "failed")