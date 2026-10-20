"""Daily watchlist discovery with owner-fenced renewable scheduler leases."""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from threading import Event, Thread
from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy import or_, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

from app.agents.graph import run_research
from app.agents.service import ResearchService
from app.db.models import Discovery, DiscoverySource, ScheduledRun, Source, Watchlist


class SchedulerService:
    """Manages bounded daily discovery and a renewable ownership lease."""

    LOCK_LEASE = timedelta(minutes=2)
    HEARTBEAT_SECONDS = 20
    MAX_RUN_SECONDS = 45 * 60
    MAX_SOURCES = 100
    MAX_INVESTIGATIONS = 20
    MAX_ITERATIONS = 5
    MAX_TOKENS = 50000
    LOCAL_TIMEZONE = timezone(timedelta(hours=5, minutes=30))

    def __init__(self, service: ResearchService):
        self.service = service
        from app.core.config import get_settings

        settings = get_settings()
        self.max_candidates = min(self.MAX_SOURCES, settings.max_candidates_per_run)
        self.max_investigations = min(self.MAX_INVESTIGATIONS, settings.max_deep_investigations)
        self.max_iterations = min(self.MAX_ITERATIONS, settings.max_research_iterations)
        self.max_run_seconds = min(self.MAX_RUN_SECONDS, settings.max_run_duration_seconds)
        self.schedule_hour = settings.daily_discovery_hour
        self.schedule_minute = settings.daily_discovery_minute

    @classmethod
    def next_daily_run(cls, now: Optional[datetime] = None, hour: int = 8, minute: int = 0) -> datetime:
        """Return the next 08:00 Asia/Kolkata-equivalent local run instant."""
        if not 0 <= hour <= 23 or not 0 <= minute <= 59:
            raise ValueError("daily schedule hour/minute out of range")
        now = now or datetime.now(timezone.utc)
        local_now = now.astimezone(cls.LOCAL_TIMEZONE)
        target = local_now.replace(hour=hour, minute=minute, second=0, microsecond=0)
        if target <= local_now:
            target += timedelta(days=1)
        return target.astimezone(timezone.utc)

    async def run_forever(self, *, hour: int = 8, minute: int = 0) -> None:
        """Run daily discovery at the configured local time; continue after failed days."""
        import logging

        logger = logging.getLogger(__name__)
        while True:
            next_run = self.next_daily_run(hour=hour, minute=minute)
            await asyncio.sleep(max(0, (next_run - datetime.now(timezone.utc)).total_seconds()))
            try:
                await self.run_daily_discovery()
            except Exception:
                logger.exception("Scheduled daily discovery failed; next daily attempt remains scheduled")

    def acquire_lock(self, session, lock_key: str, owner_token: Optional[str] = None) -> bool:
        owner_token = owner_token or str(uuid4())
        now = datetime.now(timezone.utc)
        expires_at = now + self.LOCK_LEASE
        next_run_at = self.next_daily_run(now, self.schedule_hour, self.schedule_minute)
        insert_fn = {"sqlite": sqlite_insert, "postgresql": pg_insert}.get(
            session.get_bind().dialect.name
        )
        if insert_fn is None:
            raise NotImplementedError("Scheduler locking supports SQLite and PostgreSQL")
        inserted = session.execute(
            insert_fn(ScheduledRun)
            .values(
                task_id=lock_key,
                status="running",
                lease_owner=owner_token,
                lease_expires_at=expires_at,
                next_run_at=next_run_at,
            )
            .on_conflict_do_nothing(index_elements=[ScheduledRun.task_id])
        )
        if inserted.rowcount == 1:
            session.commit()
            return True
        claimed = session.execute(
            update(ScheduledRun)
            .where(
                ScheduledRun.task_id == lock_key,
                or_(
                    ScheduledRun.status != "running",
                    ScheduledRun.lease_expires_at <= now,
                ),
            )
            .values(
                status="running",
                lease_owner=owner_token,
                lease_expires_at=expires_at,
                next_run_at=next_run_at,
                updated_at=now,
                error_summary=None,
            )
        )
        session.commit()
        return claimed.rowcount == 1

    def renew_lock(self, session, lock_key: str, owner_token: str) -> bool:
        now = datetime.now(timezone.utc)
        result = session.execute(
            update(ScheduledRun)
            .where(
                ScheduledRun.task_id == lock_key,
                ScheduledRun.status == "running",
                ScheduledRun.lease_owner == owner_token,
                ScheduledRun.lease_expires_at > now,
            )
            .values(
                lease_expires_at=now + self.LOCK_LEASE,
                updated_at=now,
            )
        )
        session.commit()
        return result.rowcount == 1

    def owns_lock(self, lock_key: str, owner_token: str) -> bool:
        now = datetime.now(timezone.utc)
        with self.service.session() as session:
            return (
                session.query(ScheduledRun.id)
                .filter(
                    ScheduledRun.task_id == lock_key,
                    ScheduledRun.status == "running",
                    ScheduledRun.lease_owner == owner_token,
                    ScheduledRun.lease_expires_at > now,
                )
                .first()
                is not None
            )

    def release_lock(
        self, session, lock_key: str, owner_token: str, status: str,
        *, digest_md: Optional[str] = None, coverage: Optional[dict] = None,
        error_summary: Optional[str] = None,
    ) -> bool:
        now = datetime.now(timezone.utc)
        result = session.execute(
            update(ScheduledRun)
            .where(
                ScheduledRun.task_id == lock_key,
                ScheduledRun.status == "running",
                ScheduledRun.lease_owner == owner_token,
            )
            .values(
                status=status,
                lease_owner=None,
                lease_expires_at=None,
                last_run_at=now,
                updated_at=now,
                digest_md=digest_md,
                coverage_json=coverage,
                error_summary=error_summary,
            )
        )
        session.commit()
        return result.rowcount == 1

    def _watchlist_queries(self) -> list[tuple[str, list[str], str, list[str]]]:
        with self.service.session() as session:
            rows = (
                session.query(Watchlist)
                .filter(Watchlist.enabled.is_(True))
                .order_by(Watchlist.created_at, Watchlist.id)
                .all()
            )
            return [
                (
                    " ".join([row.topic, *row.keywords_json]).strip(),
                    list(row.keywords_json or []),
                    row.name,
                    list(row.source_preferences_json or []),
                )
                for row in rows
            ]

    def _build_digest(self, results: list[dict], coverage: dict) -> str:
        discovery_ids = list(dict.fromkeys(
            discovery_id
            for result in results
            for discovery_id in result.get("discovery_ids", [])
        ))
        with self.service.session() as session:
            discoveries = (
                session.query(Discovery)
                .filter(Discovery.id.in_([UUID(value) for value in discovery_ids]))
                .order_by(Discovery.relevance_score.desc().nullslast(), Discovery.created_at.desc())
                .limit(10)
                .all()
            ) if discovery_ids else []
            finding_lines = []
            for index, discovery in enumerate(discoveries, start=1):
                sources = (
                    session.query(Source.canonical_url)
                    .join(DiscoverySource, DiscoverySource.source_id == Source.id)
                    .filter(DiscoverySource.discovery_id == discovery.id)
                    .order_by(Source.canonical_url)
                    .limit(8)
                    .all()
                )
                if not sources:
                    continue
                links = ", ".join(f"<{url}>" for (url,) in sources)
                finding_lines.append(
                    f"{index}. {discovery.title}\n   Verification: {discovery.verification_status}\n   Sources: {links}"
                )
        findings = "\n".join(finding_lines) if finding_lines else "No evidence-backed discoveries met the reporting criteria."
        unavailable = coverage["sources_failed"]
        date = datetime.now(timezone(timedelta(hours=5, minutes=30))).date().isoformat()
        return (
            f"# Insight Agent — Daily Research Digest\n\nDate: {date}\n\n"
            f"## Findings\n{findings}\n\n## Coverage\n"
            f"- Sources discovered: {coverage['sources_discovered']}\n"
            f"- Sources checked successfully: {coverage['sources_succeeded']}\n"
            f"- Sources unavailable: {unavailable}\n"
            f"- Sources with unknown publication date: {coverage['sources_unknown_publication_date']}\n"
            f"- Search queries attempted / failed / partial: {coverage['discovery_queries']} / "
            f"{coverage['discovery_failures']} / {coverage['discovery_partial_results']}\n"
            f"- Watchlists processed: {coverage['watchlists_processed']}\n"
            f"- Watchlists skipped for unsupported sources: {coverage.get('watchlists_skipped_unsupported', 0)}\n"
            f"- Research jobs completed: {coverage['jobs_completed']}\n"
            f"- Reported model tokens used: {coverage['tokens_used']} / {coverage['token_budget_total']}"
        )

    async def run_daily_discovery(
        self,
        query: Optional[str] = None,
        topics: list[str] | None = None,
        source_budget: int = MAX_SOURCES,
        max_iterations: int = MAX_ITERATIONS,
        time_budget_seconds: Optional[int] = None,
        token_budget: int = MAX_TOKENS,
    ) -> dict:
        """Run one bounded discovery per enabled watchlist, then persist a sourced digest."""
        if source_budget < 1 or max_iterations < 1 or token_budget < 0 or (
            time_budget_seconds is not None and time_budget_seconds < 1
        ):
            raise ValueError("source, iteration, and time budgets must be positive")
        source_budget = min(source_budget, self.MAX_SOURCES)
        max_iterations = min(max_iterations, self.MAX_ITERATIONS)
        time_budget_seconds = min(time_budget_seconds or self.max_run_seconds, self.max_run_seconds)
        source_budget = min(source_budget, self.max_candidates)
        max_iterations = min(max_iterations, self.max_iterations)
        token_budget = min(token_budget, self.MAX_TOKENS)
        lock_key = "daily_discovery"
        owner = str(uuid4())
        with self.service.session() as session:
            if not self.acquire_lock(session, lock_key, owner):
                return {"status": "skipped", "reason": "lock_held_by_other_task"}

        stopped = Event()
        lease_lost = Event()

        def heartbeat():
            while not stopped.wait(self.HEARTBEAT_SECONDS):
                try:
                    with self.service.session() as heartbeat_session:
                        if not self.renew_lock(heartbeat_session, lock_key, owner):
                            lease_lost.set()
                            return
                except Exception:  # Retry transient DB errors until ownership expires.
                    if not self.owns_lock(lock_key, owner):
                        lease_lost.set()
                        return

        heartbeat_thread = Thread(target=heartbeat, name="scheduler-lease-heartbeat", daemon=True)
        heartbeat_thread.start()
        deadline = datetime.now(timezone.utc) + timedelta(seconds=time_budget_seconds)
        try:
            watchlist_queries = self._watchlist_queries()
        except Exception as exc:
            stopped.set()
            heartbeat_thread.join(timeout=2)
            with self.service.session() as session:
                self.release_lock(session, lock_key, owner, "failed", error_summary=str(exc)[:2000])
            raise
        if query:
            watchlist_queries.insert(0, (query, list(topics or []), "manual", []))
        # A scheduled call with no configured watchlists does not fabricate a query.
        if not watchlist_queries:
            stopped.set()
            heartbeat_thread.join(timeout=2)
            with self.service.session() as session:
                self.release_lock(
                    session, lock_key, owner, "completed", digest_md="# Insight Agent — Daily Research Digest\n\nNo enabled watchlists.",
                    coverage={"watchlists_processed": 0, "jobs_completed": 0, "sources_discovered": 0,
                              "sources_succeeded": 0, "sources_failed": 0,
                              "sources_unknown_publication_date": 0, "discovery_queries": 0,
                              "discovery_failures": 0, "discovery_partial_results": 0,
                              "token_budget_total": token_budget, "tokens_used": 0},
                )
            return {"status": "completed", "digest_md": "# Insight Agent — Daily Research Digest\n\nNo enabled watchlists.",
                    "coverage": {"watchlists_processed": 0}}

        total = {
            "watchlists_processed": 0, "watchlists_skipped_unsupported": 0, "jobs_completed": 0,
            "sources_discovered": 0, "sources_inspected": 0,
            "sources_succeeded": 0, "sources_failed": 0,
            "sources_unknown_publication_date": 0,
            "discovery_queries": 0, "discovery_failures": 0,
            "discovery_partial_results": 0,
            "token_budget_total": token_budget, "tokens_used": 0,
        }
        results: list[dict] = []
        all_errors: list[dict] = []
        status = "completed"
        try:
            for run_query, run_topics, _name, source_preferences in watchlist_queries:
                if source_preferences and not set(source_preferences).issubset({"web_search", "duckduckgo"}):
                    total["watchlists_skipped_unsupported"] += 1
                    all_errors.append({
                        "stage": "watchlist", "watchlist": _name,
                        "error": "Requested source preference is not supported by the configured DuckDuckGo connector",
                        "source_preferences": source_preferences,
                    })
                    status = "partial"
                    continue
                total["watchlists_processed"] += 1
                if lease_lost.is_set() or not self.owns_lock(lock_key, owner):
                    status = "interrupted"
                    break
                if datetime.now(timezone.utc) >= deadline or total["sources_inspected"] >= self.max_investigations:
                    status = "partial"
                    break
                remaining_budget = source_budget - total["sources_discovered"]
                if remaining_budget <= 0:
                    status = "partial"
                    break
                task_id = uuid4()
                result = await run_research(
                    self.service,
                    task_id=task_id,
                    query=run_query,
                    topics=run_topics,
                    lookback_hours=24,
                    source_budget=remaining_budget,
                    max_iterations=max_iterations,
                    token_budget=token_budget - total["tokens_used"],
                    deadline_at=deadline,
                    max_sources_inspected=self.max_investigations - total["sources_inspected"],
                    ownership_check=lambda: self.owns_lock(lock_key, owner),
                )
                result["watchlist_name"] = _name
                results.append(result)
                total["jobs_completed"] += 1
                remaining_tokens = int(result.get("token_budget_remaining", token_budget - total["tokens_used"]))
                total["tokens_used"] = token_budget - remaining_tokens
                for key in (
                    "sources_discovered", "sources_inspected", "sources_succeeded",
                    "sources_failed", "sources_unknown_publication_date",
                    "discovery_queries", "discovery_failures", "discovery_partial_results",
                ):
                    total[key] += int(result.get(key, 0))
                all_errors.extend(result.get("errors", []))
                if result.get("finish_reason") in ("deadline_exceeded", "investigation_budget_exhausted"):
                    status = "partial"
                    break
                if result.get("finish_reason") in ("token_budget_exhausted", "token_usage_unavailable"):
                    status = "partial"
                    break
                if result.get("status") == "cancelled":
                    status = "cancelled"
                    break
                if result.get("status") == "interrupted":
                    status = "interrupted"
                    break
            total["errors"] = all_errors
            digest = self._build_digest(results, total)
            if status == "completed" and any(r.get("status") == "partial" for r in results):
                status = "partial"
            total["errors"] = all_errors
            with self.service.session() as session:
                self.release_lock(session, lock_key, owner, status, digest_md=digest, coverage=total)
            summary = {"status": status, "runs": results, "coverage": total, "digest_md": digest}
            if len(results) == 1 and watchlist_queries[0][2] == "manual":
                summary.update(results[0])
                summary["status"] = status
                summary["runs"] = results
                summary["coverage"] = total
                summary["digest_md"] = digest
            return summary
        except BaseException as exc:
            with self.service.session() as session:
                self.release_lock(
                    session, lock_key, owner, "failed", error_summary=str(exc)[:2000]
                )
            raise
        finally:
            stopped.set()
            heartbeat_thread.join(timeout=5)
