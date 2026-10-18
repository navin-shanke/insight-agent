"""Research graph nodes.

Each node is an async function ``(service, state) -> partial_state_update``.
Nodes decrement budgets, enforce limits, and return partial updates that
LangGraph merges into the running state.  No node invents sources, claims,
or citations (Blueprint rule 4).
"""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4

from app.agents.service import ResearchService
from app.schemas.research_state import (
    ResearchState,
    TaskStatus,
    VerificationStatus,
)
from app.schemas.connector import AccessStatus
from app.db.models import Source


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _source_url(rec) -> str:
    return getattr(rec, "canonical_url", "") or str(rec.get("canonical_url", "")) if isinstance(rec, dict) else ""


# ---------------------------------------------------------------------------
# 1. load_context
# ---------------------------------------------------------------------------
async def load_context(service: ResearchService, state: ResearchState) -> dict:
    """Mark the run as started."""
    return {
        "status": TaskStatus.RUNNING,
        "iteration": int(state.get("iteration", 0)) + 1,
    }


# ---------------------------------------------------------------------------
# 2. plan_research
# ---------------------------------------------------------------------------
async def plan_research(service: ResearchService, state: ResearchState) -> dict:
    """Decompose the query into concrete leads using the LLM router."""
    query = state["query"]
    topics = state.get("topics", [])

    result = service.plan_research(query, topics)
    leads: list[dict] = []
    if result.ok and result.data:
        for sub in result.data.sub_topics:
            leads.append(
                {
                    "lead_id": str(uuid4()),
                    "query": sub,
                    "source": "planner",
                    "attempts": 0,
                }
            )
    else:
        # Fallback: a single lead with the original query if planning failed.
        leads.append(
            {
                "lead_id": str(uuid4()),
                "query": query,
                "source": "fallback",
                "attempts": 0,
                "planning_error": result.error,
            }
        )

    return {
        "pending_leads": leads,
        "token_budget_remaining": max(
            0, int(state.get("token_budget_remaining", 0)) - (result.latency_ms or 0) // 100
        ),
    }


# ---------------------------------------------------------------------------
# 3. discover_sources
# ---------------------------------------------------------------------------
async def discover_sources(service: ResearchService, state: ResearchState) -> dict:
    """Pop pending leads, search DuckDuckGo for each, add new sources to
    candidates.  All current leads are processed (bounded by source budget)
    so leads are not left to accumulate and re-trigger planning."""
    leads = list(state.get("pending_leads", []) or [])
    candidates = set(state.get("candidate_source_ids", [])) or set()

    if not leads:
        return {"candidate_source_ids": list(candidates)}

    new_candidate_ids: list = []
    fetched_count = 0
    processed_leads: list = []

    with service.session() as session:
        for lead in list(leads):
            lead["attempts"] = int(lead.get("attempts", 0)) + 1
            query = lead["query"]
            source_budget = int(state.get("source_budget_remaining", 0)) - fetched_count
            if source_budget <= 0:
                # Budget exhausted; keep this lead for a later retry.
                if int(lead["attempts"]) < 2:
                    processed_leads.append(lead)
                continue
            max_results = min(8, source_budget)
            try:
                result = await service.discover_sources(query, max_results)
            except Exception as exc:  # noqa: BLE001
                # Search failure; keep lead for retry.
                if int(lead["attempts"]) < 2:
                    processed_leads.append(lead)
                continue
            fetched_count += 1
            if result.complete and result.records:
                for rec in result.records:
                    url = str(rec.canonical_url)
                    src = service.upsert_source(
                        session,
                        source_type=rec.source_type,
                        canonical_url=url,
                        title=rec.title,
                        access_status=rec.access_status.value,
                        metadata=rec.metadata_json or {},
                    )
                    if str(src.id) not in candidates:
                        candidates.add(str(src.id))
                        new_candidate_ids.append(str(src.id))
            session.commit()
            # Lead has been processed successfully; remove it from pending leads.
            processed_leads.append(lead)

    # Leads that still have attempts remain pending; spent leads are dropped.
    remaining_leads = [l for l in leads if l not in processed_leads]

    return {
        "pending_leads": remaining_leads,
        "candidate_source_ids": list(candidates),
        "source_budget_remaining": max(
            0, int(state.get("source_budget_remaining", 0)) - fetched_count
        ),
        "errors": list(state.get("errors", [])),
    }


# ---------------------------------------------------------------------------
# 4. normalize_sources
# ---------------------------------------------------------------------------
async def normalize_sources(service: ResearchService, state: ResearchState) -> dict:
    """Drop candidates already inspected; keep deduped set."""
    candidates = set(state.get("candidate_source_ids", [])) or set()
    inspected = set(state.get("inspected_source_ids", [])) or set()
    candidates -= inspected
    return {"candidate_source_ids": list(candidates)}


# ---------------------------------------------------------------------------
# 5. inspect_content
# ---------------------------------------------------------------------------
async def inspect_content(service: ResearchService, state: ResearchState) -> dict:
    """Pop a candidate source, fetch it via the SSRF-safe fetcher, store snapshot."""
    candidates = list(state.get("candidate_source_ids", []) or [])
    inspected = set(state.get("inspected_source_ids", [])) or set()

    if not candidates:
        return {"candidate_source_ids": [], "inspected_source_ids": list(inspected)}

    source_id_str = candidates.pop(0)

    from app.db.models import Source

    source_uuid = UUID(source_id_str)
    with service.session() as session:
        source = session.query(Source).filter_by(id=source_uuid).first()
        if not source:
            return {
                "candidate_source_ids": candidates,
                "inspected_source_ids": list(inspected | {source_id_str}),
            }
        canonical_url = source.canonical_url

    fetched = await service.fetch_source(canonical_url)

    with service.session() as session:
        source = session.query(Source).filter_by(id=source_uuid).first()
        if fetched.error is None and fetched.snapshot is not None:
            snap = service.add_snapshot(
                session,
                source_id=source_uuid,
                content_hash=fetched.snapshot.content_hash,
                text_content=fetched.snapshot.text_content,
                access_status=fetched.snapshot.access_status.value,
                coverage=fetched.snapshot.coverage_json or {},
            )
            source.access_status = fetched.snapshot.access_status.value
            session.commit()
            return {
                "candidate_source_ids": candidates,
                "inspected_source_ids": list(inspected),
                "last_fetched": {
                    "source_id": str(source_id_str),
                    "url": canonical_url,
                    "snapshot_id": str(snap.id),
                    "text": fetched.snapshot.text_content or "",
                    "access_status": fetched.snapshot.access_status.value,
                },
                "errors": list(state.get("errors", [])),
            }
        else:
            source.access_status = (
                fetched.error.access_status.value
                if fetched.error
                else AccessStatus.FAILED.value
            )
            session.commit()
            return {
                "candidate_source_ids": candidates,
                "inspected_source_ids": list(inspected),
                "last_fetched": None,
                "errors": list(state.get("errors", []))
                + [
                    {
                        "stage": "inspect",
                        "url": canonical_url,
                        "error": fetched.error.reason if fetched.error else "fetch failed",
                        "access_status": source.access_status,
                    }
                ],
            }


# ---------------------------------------------------------------------------
# 6. extract_claims
# ---------------------------------------------------------------------------
async def extract_claims(service: ResearchService, state: ResearchState) -> dict:
    """Extract claims from the last fetched content via the LLM router."""
    fetched = state.get("last_fetched")
    if not fetched:
        return {"claims": list(state.get("claims", []))}

    result = service.extract_claims(
        content=fetched["text"],
        source_url=fetched["url"],
    )

    new_claims = list(state.get("claims", [])) or []
    if result.ok and result.data:
        from app.db.models import Source

        source_uuid = UUID(fetched["source_id"])
        with service.session() as session:
            source = session.query(Source).filter_by(id=source_uuid).first()
            for c in result.data.claims:
                claim = service.add_claim(
                    session,
                    source_id=source_uuid,
                    claim_text=c.claim_text,
                    claim_type=c.claim_type,
                    confidence_rationale=(
                        f"Extracted from {fetched['url']}; excerpt: {c.excerpt}"
                    ),
                )
                service.add_evidence(
                    session,
                    claim_id=claim.id,
                    source_id=source_uuid,
                    excerpt=c.excerpt or "",
                    stance="contextualizes",
                    quality_notes="Extracted from source content",
                )
                new_claims.append(
                    {
                        "claim_id": str(claim.id),
                        "claim_text": c.claim_text,
                        "claim_type": c.claim_type,
                        "source_id": fetched["source_id"],
                        "source_url": fetched["url"],
                        "verification_status": VerificationStatus.UNVERIFIED,
                    }
                )
            session.commit()

    return {
        "claims": new_claims,
        "errors": list(state.get("errors", []))
        + ([{"stage": "extract_claims", "error": result.error}] if not result.ok else []),
    }


# ---------------------------------------------------------------------------
# 7. verify_claims
# ---------------------------------------------------------------------------
async def verify_claims(service: ResearchService, state: ResearchState) -> dict:
    """Verify pending claims against gathered evidence using the LLM router."""
    claims = list(state.get("claims", []) or [])
    unverified = [c for c in claims if c.get("verification_status") == VerificationStatus.UNVERIFIED]
    if not unverified:
        return {"claims": claims}

    updated = list(claims)
    with service.session() as session:
        for claim in unverified[:5]:  # bound verification per run
            claim_uuid = UUID(claim["claim_id"])
            result = service.verify_claim(
                claim_text=claim["claim_text"],
                claim_type=claim.get("claim_type", "statement"),
                evidence_text=f"Source: {claim.get('source_url','')}",
                evidence_urls=[claim.get("source_url", "")],
            )
            if result.ok and result.data:
                service.update_claim_verification(
                    session,
                    claim_id=claim_uuid,
                    verification_status=result.data.verdict,
                    confidence_rationale=result.data.rationale,
                )
                for c in updated:
                    if c["claim_id"] == claim["claim_id"]:
                        c["verification_status"] = result.data.verdict
                        c["verification_rationale"] = result.data.rationale
                        break
            else:
                for c in updated:
                    if c["claim_id"] == claim["claim_id"]:
                        c["verification_status"] = VerificationStatus.INSUFFICIENT_EVIDENCE
                        break
        session.commit()

    return {
        "claims": updated,
        "errors": list(state.get("errors", [])),
    }


# ---------------------------------------------------------------------------
# 8. score_discoveries
# ---------------------------------------------------------------------------
async def score_discoveries(service: ResearchService, state: ResearchState) -> dict:
    """Group verified claims into discovery records."""
    claims = list(state.get("claims", []) or [])
    discoveries = list(state.get("discovery_ids", []) or [])

    new_disc_ids: list[str] = []
    with service.session() as session:
        for claim in claims:
            status = claim.get("verification_status")
            if status in (
                VerificationStatus.SUPPORTED,
                VerificationStatus.MIXED_EVIDENCE,
                VerificationStatus.UNVERIFIED,
            ):
                disc = service.add_discovery(
                    session,
                    title=claim["claim_text"][:120],
                    summary=f"Claim: {claim['claim_text']}",
                    category=claim.get("claim_type", "statement"),
                    verification_status=status,
                )
                service.link_discovery_source(
                    session,
                    discovery_id=disc.id,
                    source_id=UUID(claim["source_id"]),
                    link_type="cites",
                )
                new_disc_ids.append(str(disc.id))
        session.commit()

    return {
        "discovery_ids": list(discoveries) + new_disc_ids,
    }


# ---------------------------------------------------------------------------
# 9. decide_next
# ---------------------------------------------------------------------------
async def decide_next(service: ResearchService, state: ResearchState) -> dict:
    """Decide whether to inspect another candidate, re-plan, or finish."""
    iteration = int(state.get("iteration", 0))
    max_iterations = int(state.get("max_iterations", 5))
    source_budget = int(state.get("source_budget_remaining", 0))
    candidates = state.get("candidate_source_ids", []) or []
    leads = state.get("pending_leads", []) or []

    if iteration >= max_iterations:
        return {
            "status": TaskStatus.COMPLETED,
            "finish_reason": "iteration_limit",
            "finish_reason_detail": f"Reached max iterations ({max_iterations})",
            "_route": "report",
        }
    if source_budget <= 0 and not candidates and not leads:
        return {
            "status": TaskStatus.PARTIAL,
            "finish_reason": "source_budget_exhausted",
            "finish_reason_detail": "Source budget exhausted with no work remaining",
            "_route": "report",
        }
    if not candidates and not leads:
        return {
            "status": TaskStatus.COMPLETED,
            "finish_reason": "no_more_leads",
            "finish_reason_detail": "No candidate sources or pending leads remain",
            "_route": "report",
        }
    if candidates:
        return {"status": TaskStatus.RUNNING, "_route": "inspect"}
    if leads:
        return {"status": TaskStatus.RUNNING, "_route": "plan"}
    return {"status": TaskStatus.COMPLETED, "_route": "report"}


# ---------------------------------------------------------------------------
# 10. build_report
# ---------------------------------------------------------------------------
async def build_report(service: ResearchService, state: ResearchState) -> dict:
    """Generate a cited report from discoveries, claims, and evidence."""
    query = state["query"]
    discovery_ids = state.get("discovery_ids", []) or []
    claims = list(state.get("claims", []) or [])

    findings_lines = []
    contradictions = []
    for c in claims:
        findings_lines.append(
            f"- {c.get('claim_text')} (verification: {c.get('verification_status')})"
        )
        if c.get("verification_status") == VerificationStatus.CONTRADICTED:
            contradictions.append(c.get("claim_text"))

    findings_summary = "\n".join(findings_lines) or "No claims extracted."
    evidence_summary = "Evidence linked to source records via claim->source evidence table."
    contradictions_summary = "\n".join(contradictions) or "None detected."
    limitations = (
        "Single web-search provider (DuckDuckGo); claim verification limited to "
        "retrieved source text; ranking is not verification."
    )

    result = service.synthesize_report(
        query=query,
        findings_summary=findings_summary,
        evidence_summary=evidence_summary,
        contradictions=contradictions_summary,
        limitations=limitations,
    )

    body_md = ""
    if result.ok and result.data:
        body_md = result.data.report_md
    else:
        body_md = (
            f"# Research Report\n\nQuery: {query}\n\n"
            f"Report generation failed: {result.error}\n\n## Findings\n{findings_summary}\n"
        )

    report_id = None
    with service.session() as session:
        rep = service.add_report(
            session,
            title=f"Research: {query[:80]}",
            query=query,
            body_md=body_md,
            limitations=limitations,
            task_id=state.get("task_id"),
            discovery_ids=[__import__("uuid").UUID(d) for d in discovery_ids if d],
        )
        report_id = str(rep.id)
        session.commit()

    return {
        "report_id": report_id,
        "report_body": body_md,
    }