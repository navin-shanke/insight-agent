"""Daily discovery scheduler for Phase 4."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

from sqlalchemy import update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

from app.agents.graph import run_research
from app.agents.service import ResearchService
from app.db.models import ScheduledRun


class SchedulerService:
    """Manages scheduled daily discovery runs with idempotent locking."""

    LOCK_LEASE = timedelta(hours=6)

    def __init__(self, service: ResearchService):
        self.service = service

    def acquire_lock(self, session, lock_key: str) -> bool:
        """Attempt to acquire the scheduler lock atomically.

        The insert-on-conflict and conditional update are single database
        statements. SQLite and PostgreSQL therefore serialize both first
        acquisition and reacquisition without a read-then-write race.
        ``next_run_at`` is used as a six-hour lease expiry so a crashed worker
        can be recovered by a later invocation.

        Returns True if the lock was acquired, False if already running.
        After a lock is released (status → "completed" or "failed"), it can
        be re-acquired.
        """
        from app.db.models import ScheduledRun

        now = datetime.now(timezone.utc)
        expires_at = now + self.LOCK_LEASE
        dialect = session.get_bind().dialect.name
        insert_fn = {"sqlite": sqlite_insert, "postgresql": pg_insert}.get(dialect)
        if insert_fn is None:
            raise NotImplementedError(
                f"Scheduler locking is not implemented for database dialect {dialect!r}"
            )

        inserted = session.execute(
            insert_fn(ScheduledRun)
            .values(
                task_id=lock_key,
                status="running",
                next_run_at=expires_at,
            )
            .on_conflict_do_nothing(index_elements=[ScheduledRun.task_id])
        )
        if inserted.rowcount == 1:
            session.commit()
            return True

        # Reacquire only if the current owner has released or its lease expired.
        # The predicate and ownership transition are atomic; concurrent workers
        # cannot both observe the same terminal row and claim it.
        claimed = session.execute(
            update(ScheduledRun)
            .where(
                ScheduledRun.task_id == lock_key,
                (ScheduledRun.status != "running")
                | (ScheduledRun.next_run_at <= now),
            )
            .values(status="running", next_run_at=expires_at)
        )
        session.commit()
        return claimed.rowcount == 1

    def release_lock(self, session, lock_key: str, status: str) -> None:
        """Release the scheduler lock with the given status."""
        from app.db.models import ScheduledRun

        run = session.query(ScheduledRun).filter_by(task_id=lock_key).first()
        if run is None:
            return
        run.status = status
        run.last_run_at = datetime.now(timezone.utc)
        run.next_run_at = datetime.now(timezone.utc)
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
