"""Research service: wires together DB, connector, router, and checkpointer.

Provides a single object the graph nodes use to persist findings, discover
sources, fetch content, and call the LLM.  The service owns a SQLAlchemy
Session and a DuckDuckGoConnector; callers pass it into each graph node.
"""

from __future__ import annotations

from contextlib import contextmanager
from hashlib import sha256
import re
from typing import Optional
from uuid import UUID, uuid4
from datetime import datetime, timezone

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.db.models import Base, Source, ContentSnapshot, Claim, Evidence, Discovery, DiscoverySource, Report, TaskCheckpoint, ResearchCancellation
from app.connectors import DuckDuckGoConnector
from app.schemas.source import SourceReference, AccessStatus
from app.schemas.connector import DiscoveryRequest
from app.llm.router import ModelRouter
from app.schemas.research_state import VerificationStatus, TaskStatus


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


class ResearchService:
    """Holds the DB session, connector, and LLM router for one research run."""

    def __init__(
        self,
        database_url: str,
        connector: Optional[DuckDuckGoConnector] = None,
        router: Optional[ModelRouter] = None,
    ):
        url_str = str(database_url)
        if url_str.startswith("sqlite://"):
            # SQLite-specific connect args for better concurrency
            connect_args = {"timeout": 30, "check_same_thread": False}
        else:
            connect_args = {}
        self.engine = create_engine(database_url, pool_pre_ping=True, connect_args=connect_args)
        Base.metadata.create_all(self.engine)
        self.connector = connector or DuckDuckGoConnector()
        self.router = router or ModelRouter()

    @contextmanager
    def session(self) -> Session:
        with Session(self.engine) as session:
            yield session

    def request_cancellation(self, task_id: UUID | str) -> bool:
        """Persist an idempotent cancellation request for a running task."""
        import json
        from sqlalchemy.dialects.sqlite import insert as sqlite_insert
        from sqlalchemy.dialects.postgresql import insert as pg_insert

        dialect = self.engine.dialect.name
        insert_fn = {"sqlite": sqlite_insert, "postgresql": pg_insert}.get(dialect)
        if insert_fn is None:
            raise NotImplementedError(f"Cancellation is unsupported for {dialect!r}")
        with self.session() as session:
            checkpoint = (
                session.query(TaskCheckpoint)
                .filter_by(task_id=str(task_id))
                .order_by(TaskCheckpoint.created_at.desc())
                .first()
            )
            if checkpoint is None or checkpoint.step in ("build_report", "control_stop"):
                return False
            checkpoint_status = json.loads(checkpoint.state_json).get("status")
            if checkpoint_status not in (TaskStatus.RUNNING, TaskStatus.COMPLETED, TaskStatus.PARTIAL):
                return False
            result = session.execute(
                insert_fn(ResearchCancellation)
                .values(task_id=str(task_id))
                .on_conflict_do_nothing(index_elements=[ResearchCancellation.task_id])
            )
            session.commit()
            return result.rowcount == 1

    def list_running_tasks(self) -> list[dict]:
        """Return the latest durable checkpoint for each currently running task."""
        import json

        with self.session() as session:
            rows = (
                session.query(TaskCheckpoint)
                .filter(TaskCheckpoint.task_id.is_not(None))
                .order_by(TaskCheckpoint.created_at.desc())
                .all()
            )
            tasks = {}
            for row in rows:
                if row.task_id in tasks:
                    continue
                state = json.loads(row.state_json)
                if row.step not in ("build_report", "control_stop") and state.get("status") in (
                    TaskStatus.RUNNING, TaskStatus.COMPLETED, TaskStatus.PARTIAL
                ):
                    tasks[row.task_id] = {
                        "task_id": row.task_id,
                        "query": state.get("query"),
                        "step": row.step,
                        "updated_at": row.created_at.isoformat(),
                    }
            return list(tasks.values())

    def cancellation_requested(self, session: Session, task_id: UUID | str) -> bool:
        return (
            session.query(ResearchCancellation.id)
            .filter_by(task_id=str(task_id))
            .first()
            is not None
        )

    def consume_cancellation(self, session: Session, task_id: UUID | str) -> bool:
        request = session.query(ResearchCancellation).filter_by(task_id=str(task_id)).first()
        if request is None:
            session.commit()
            return False
        session.delete(request)
        session.commit()
        return True

    def clear_cancellation(self, task_id: UUID | str) -> None:
        with self.session() as session:
            session.query(ResearchCancellation).filter_by(task_id=str(task_id)).delete()
            session.commit()

    # ── source persistence ─────────────────────────────────────────────
    def upsert_source(
        self,
        session: Session,
        *,
        source_type: str,
        canonical_url: str,
        title: Optional[str] = None,
        author_or_publisher: Optional[str] = None,
        published_at: Optional[datetime] = None,
        access_status: str = AccessStatus.READY,
        metadata: Optional[dict] = None,
    ) -> Source:
        existing = (
            session.query(Source)
            .filter_by(canonical_url=canonical_url)
            .first()
        )
        if existing:
            existing.retrieval_count = (existing.retrieval_count or 0) + 1
            existing.last_seen_at = _now_utc()
            existing.access_status = access_status
            if title:
                existing.title = title
            if metadata is not None:
                existing.metadata_json = metadata
            session.flush()
            return existing
        source = Source(
            source_type=source_type,
            canonical_url=canonical_url,
            title=title,
            author_or_publisher=author_or_publisher,
            published_at=published_at,
            access_status=access_status,
            metadata_json=metadata or {},
        )
        session.add(source)
        session.flush()
        return source

    def add_snapshot(
        self,
        session: Session,
        *,
        source_id: UUID,
        content_hash: Optional[str] = None,
        caption: Optional[str] = None,
        text_content: Optional[str] = None,
        transcript: Optional[str] = None,
        ocr_text: Optional[str] = None,
        access_status: str = AccessStatus.READY,
        coverage: Optional[dict] = None,
    ) -> ContentSnapshot:
        existing = None
        if content_hash:
            existing = (
                session.query(ContentSnapshot)
                .filter_by(source_id=source_id, content_hash=content_hash)
                .first()
            )
        if existing:
            return existing
        snap = ContentSnapshot(
            source_id=source_id,
            content_hash=content_hash,
            caption=caption,
            text_content=text_content,
            transcript=transcript,
            ocr_text=ocr_text,
            access_status=access_status,
            coverage_json=coverage or {},
        )
        session.add(snap)
        session.flush()
        return snap

    # ── claim / evidence persistence ───────────────────────────────────
    def add_claim(
        self,
        session: Session,
        *,
        source_id: UUID,
        claim_text: str,
        claim_type: str = "statement",
        verification_status: str = VerificationStatus.UNVERIFIED,
        confidence_rationale: Optional[str] = None,
    ) -> Claim:
        claim = Claim(
            source_id=source_id,
            claim_text=claim_text,
            claim_type=claim_type,
            verification_status=verification_status,
            confidence_rationale=confidence_rationale,
        )
        session.add(claim)
        session.flush()
        return claim

    def add_evidence(
        self,
        session: Session,
        *,
        claim_id: UUID,
        source_id: UUID,
        excerpt: str,
        stance: str = "contextualizes",
        retrieved_at: Optional[datetime] = None,
        independence_group: Optional[str] = None,
        quality_notes: Optional[str] = None,
    ) -> Evidence:
        ev = Evidence(
            claim_id=claim_id,
            source_id=source_id,
            excerpt=excerpt,
            stance=stance,
            retrieved_at=retrieved_at or _now_utc(),
            independence_group=independence_group,
            quality_notes=quality_notes,
        )
        session.add(ev)
        session.flush()
        return ev

    def update_claim_verification(
        self,
        session: Session,
        claim_id: UUID,
        verification_status: str,
        confidence_rationale: Optional[str] = None,
    ) -> Optional[Claim]:
        claim = session.query(Claim).filter_by(id=claim_id).first()
        if not claim:
            return None
        claim.verification_status = verification_status
        claim.last_verified_at = _now_utc()
        if confidence_rationale is not None:
            claim.confidence_rationale = confidence_rationale
        session.flush()
        return claim

    # ── discovery / report persistence ─────────────────────────────────
    def add_discovery(
        self,
        session: Session,
        *,
        title: str,
        summary: str,
        category: Optional[str] = None,
        verification_status: str = VerificationStatus.UNVERIFIED,
        relevance_score: Optional[int] = None,
        novelty_score: Optional[int] = None,
        evidence_quality_score: Optional[int] = None,
        usefulness_score: Optional[int] = None,
    ) -> Discovery:
        identity = summary.removeprefix("Claim: ") or title
        normalized = re.sub(r"\W+", " ", identity.casefold(), flags=re.UNICODE).strip()
        dedupe_key = sha256(f"{(category or '').casefold()}\0{normalized}".encode()).hexdigest()
        from sqlalchemy.dialects.sqlite import insert as sqlite_insert
        from sqlalchemy.dialects.postgresql import insert as pg_insert

        insert_fn = {"sqlite": sqlite_insert, "postgresql": pg_insert}.get(
            session.get_bind().dialect.name
        )
        if insert_fn is None:
            raise NotImplementedError("Discovery deduplication supports SQLite and PostgreSQL")
        discovery_id = uuid4()
        result = session.execute(
            insert_fn(Discovery)
            .values(
                id=discovery_id,
                title=title,
                summary=summary,
                category=category,
                verification_status=verification_status,
                relevance_score=relevance_score,
                novelty_score=novelty_score,
                evidence_quality_score=evidence_quality_score,
                usefulness_score=usefulness_score,
                dedupe_key=dedupe_key,
            )
            .on_conflict_do_nothing(index_elements=[Discovery.dedupe_key])
        )
        if result.rowcount == 1:
            return session.query(Discovery).filter_by(id=discovery_id).one()
        return session.query(Discovery).filter_by(dedupe_key=dedupe_key).one()

    def link_discovery_source(
        self,
        session: Session,
        *,
        discovery_id: UUID,
        source_id: UUID,
        link_type: str = "cites",
    ) -> DiscoverySource:
        existing = session.query(DiscoverySource).filter_by(
            discovery_id=discovery_id, source_id=source_id
        ).first()
        if existing:
            if link_type:
                existing.link_type = link_type
            session.flush()
            return existing
        link = DiscoverySource(
            discovery_id=discovery_id,
            source_id=source_id,
            link_type=link_type,
        )
        session.add(link)
        session.flush()
        return link

    def add_report(
        self,
        session: Session,
        *,
        title: str,
        query: str,
        body_md: str,
        summary: Optional[str] = None,
        limitations: Optional[str] = None,
        task_id: Optional[UUID] = None,
        discovery_ids: Optional[list[UUID]] = None,
    ) -> Report:
        rep = Report(
            title=title,
            query=query,
            body_md=body_md,
            summary=summary,
            limitations=limitations,
            task_id=str(task_id) if task_id else None,
            discovery_ids_json=[str(d) for d in (discovery_ids or [])],
        )
        session.add(rep)
        session.flush()
        return rep

    # ── checkpoint persistence ─────────────────────────────────────────
    def save_checkpoint(
        self,
        session: Session,
        *,
        thread_id: str,
        task_id: Optional[UUID],
        step: str,
        state: dict,
    ) -> TaskCheckpoint:
        import json

        cp = TaskCheckpoint(
            thread_id=thread_id,
            task_id=str(task_id) if task_id else None,
            step=step,
            state_json=json.dumps(state, default=str),
        )
        session.add(cp)
        session.flush()
        return cp

    def load_latest_checkpoint(
        self, session: Session, thread_id: str
    ) -> Optional[dict]:
        import json

        row = (
            session.query(TaskCheckpoint)
            .filter_by(thread_id=thread_id)
            .order_by(TaskCheckpoint.created_at.desc())
            .first()
        )
        if not row:
            return None
        return json.loads(row.state_json)

    # ── connector / LLM helpers ────────────────────────────────────────
    async def discover_sources(self, query: str, max_results: int):
        from app.schemas.research_state import initial_state  # noqa: F401
        return await self.connector.discover(
            DiscoveryRequest(query=query, max_results=max_results)
        )

    async def fetch_source(self, canonical_url: str):
        ref = SourceReference(
            source_type="web_page",
            canonical_url=canonical_url,
            title="Page",
        )
        result = await self.connector.fetch(ref)
        return result

    def plan_research(self, query: str, topics: list[str]):
        return self.router.plan_research(query, topics)

    def extract_claims(
        self, content: str, source_url: str, source_title: Optional[str] = None
    ):
        return self.router.extract_claims(content, source_url, source_title)

    def verify_claim(
        self,
        claim_text: str,
        claim_type: str,
        evidence_text: str,
        evidence_urls: list[str],
    ):
        return self.router.verify_claim(claim_text, claim_type, evidence_text, evidence_urls)

    def rank_discovery(
        self, title: str, summary: str, evidence_summary: str
    ):
        return self.router.rank_discovery(title, summary, evidence_summary)

    def synthesize_report(
        self,
        query: str,
        findings_summary: str,
        evidence_summary: str,
        contradictions: str,
        limitations: str,
    ):
        return self.router.synthesize_report(
            query, findings_summary, evidence_summary, contradictions, limitations
        )
