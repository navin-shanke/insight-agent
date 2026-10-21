"""Research graph nodes.

Each node is an async function ``(service, state) -> partial_state_update``.
Nodes decrement budgets, enforce limits, and return partial updates that
LangGraph merges into the running state.  No node invents sources, claims,
or citations (Blueprint rule 4).
"""

from __future__ import annotations

from datetime import datetime, timezone
import re
from urllib.parse import urlparse
from uuid import UUID, uuid4

from app.agents.service import ResearchService
from app.schemas.research_state import (
    ResearchState,
    TaskStatus,
    VerificationStatus,
)
from app.schemas.connector import AccessStatus
from app.db.models import Source, Evidence


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)




def _normalize_claim_tokens(text: str) -> set[str]:
    return set(re.findall(r"\b[a-z0-9]{3,}\b", text.casefold()))


def _claims_are_duplicates(text1: str, text2: str) -> bool:
    if not text1 or not text2:
        return False
    norm1 = re.sub(r"\W+", " ", text1.casefold()).strip()
    norm2 = re.sub(r"\W+", " ", text2.casefold()).strip()
    if norm1 == norm2:
        return True
    tokens1 = _normalize_claim_tokens(text1)
    tokens2 = _normalize_claim_tokens(text2)
    if not tokens1 or not tokens2:
        return False
    intersection = len(tokens1 & tokens2)
    union = len(tokens1 | tokens2)
    jaccard = intersection / union if union else 0.0
    min_len = min(len(tokens1), len(tokens2))
    overlap = intersection / min_len if min_len else 0.0
    return jaccard >= 0.65 or (overlap >= 0.85 and min_len >= 4)


def _clean_markdown_report(text: str) -> str:
    if not text:
        return ""
    # Strip backslash escapes: \#, \*, \_, \[, \], \(, \)
    cleaned = re.sub(r"\\([#*_`\[\]()])", r"\1", text)
    # Strip ClaimVerdict. enum string leaks
    cleaned = re.sub(r"ClaimVerdict\.([A-Z_]+)", r"\1", cleaned)
    # Strip stray HTML/SVG blocks or tags
    cleaned = re.sub(r"<svg[\s\S]*?</svg>", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"<svg\b[^>]*>", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"^\s*svg\s*$", "", cleaned, flags=re.MULTILINE | re.IGNORECASE)
    return cleaned.strip()

def _source_url(rec) -> str:
    return getattr(rec, "canonical_url", "") or str(rec.get("canonical_url", "")) if isinstance(rec, dict) else ""


def _token_budget_update(state: ResearchState, result, stage: str) -> dict:
    """Charge reported provider usage; fail closed when usage telemetry is absent."""
    remaining = max(0, int(state.get("token_budget_remaining", 0)))
    used = getattr(result, "token_count", None)
    errors = list(state.get("errors", []))
    if used is None:
        remaining = 0
        errors.append({
            "stage": stage,
            "error": "Model provider did not report token usage; remaining model budget set to zero",
        })
    else:
        remaining = max(0, remaining - max(0, int(used)))
    return {"token_budget_remaining": remaining, "errors": errors}


# ---------------------------------------------------------------------------
# 1. load_context
# ---------------------------------------------------------------------------
async def load_context(service: ResearchService, state: ResearchState) -> dict:
    """Mark the run as started."""
    return {
        "status": TaskStatus.RUNNING,
        "iteration": int(state.get("iteration", 0)),
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
        for sub in result.data.sub_topics[:20]:
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
        **_token_budget_update(state, result, "plan_research"),
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
    discovered_count = 0
    unknown_dates = int(state.get("sources_unknown_publication_date", 0))
    errors = list(state.get("errors", []))
    discovery_queries = int(state.get("discovery_queries", 0))
    discovery_failures = int(state.get("discovery_failures", 0))
    partial_results = int(state.get("discovery_partial_results", 0))
    cutoff = None
    if state.get("lookback_hours"):
        from datetime import timedelta
        cutoff = _now_utc() - timedelta(hours=int(state["lookback_hours"]))
    processed_leads: list = []

    with service.session() as session:
        for lead in list(leads):
            lead["attempts"] = int(lead.get("attempts", 0)) + 1
            query = lead["query"]
            source_budget = int(state.get("source_budget_remaining", 0)) - discovered_count
            if source_budget <= 0:
                # Budget exhausted; keep this lead for a later retry.
                if int(lead["attempts"]) < 2:
                    processed_leads.append(lead)
                continue
            # Search up to the connector's bounded page size; out-of-window
            # results do not consume the candidate budget, allowing the query
            # to fill the available budget with eligible records.
            max_results = 8
            try:
                result = await service.discover_sources(query, max_results)
                discovery_queries += 1
            except Exception as exc:  # noqa: BLE001
                # Search failure; keep lead for retry.
                errors.append({"stage": "discover", "query": query, "error": str(exc)})
                discovery_failures += 1
                discovery_queries += 1
                if int(lead["attempts"]) < 2:
                    processed_leads.append(lead)
                continue
            if result.records:
                for rec in result.records[:max_results]:
                    published_at = getattr(rec, "published_at", None)
                    if published_at is not None:
                        if published_at.tzinfo is None:
                            published_at = published_at.replace(tzinfo=timezone.utc)
                        if cutoff and published_at < cutoff:
                            continue
                    else:
                        unknown_dates += 1
                    url = str(rec.canonical_url)
                    src = service.upsert_source(
                        session,
                        source_type=rec.source_type,
                        canonical_url=url,
                        title=rec.title,
                        published_at=published_at,
                        access_status=AccessStatus.READY,
                        metadata={},
                    )
                    if str(src.id) not in candidates:
                        if discovered_count >= source_budget:
                            break
                        candidates.add(str(src.id))
                        new_candidate_ids.append(str(src.id))
                        discovered_count += 1
            for failure in getattr(result, "failures", []):
                discovery_failures += 1
                errors.append({"stage": "discover", "query": query, "error": failure.reason,
                               "access_status": str(failure.access_status)})
            for warning in getattr(result, "warnings", []):
                errors.append({"stage": "discover", "query": query, "warning": str(warning)})
            if not getattr(result, "complete", True):
                partial_results += 1
            session.commit()
            # Lead has been processed successfully; remove it from pending leads.
            processed_leads.append(lead)

    # Leads that still have attempts remain pending; spent leads are dropped.
    remaining_leads = [l for l in leads if l not in processed_leads]

    return {
        "pending_leads": remaining_leads,
        "candidate_source_ids": list(candidates),
        "source_budget_remaining": max(0, int(state.get("source_budget_remaining", 0)) - discovered_count),
        "sources_discovered": int(state.get("sources_discovered", 0)) + discovered_count,
        "sources_unknown_publication_date": unknown_dates,
        "discovery_queries": discovery_queries,
        "discovery_failures": discovery_failures,
        "discovery_partial_results": partial_results,
        "errors": errors,
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

    def _domain(url_str: str) -> str:
        try:
            return urlparse(url_str).netloc.lower()
        except Exception:
            return ""

    source_id_str = candidates[0]
    with service.session() as session:
        cand_sources = (
            session.query(Source).filter(Source.id.in_([UUID(cid) for cid in candidates])).all()
        )
        if len(candidates) > 1 and cand_sources:
            inspected_sources = (
                session.query(Source).filter(Source.id.in_([UUID(iid) for iid in inspected])).all()
                if inspected
                else []
            )
            inspected_domains = set()
            domain_counts = {}
            for s in inspected_sources:
                dom = _domain(s.canonical_url)
                if dom:
                    inspected_domains.add(dom)
                    domain_counts[dom] = domain_counts.get(dom, 0) + 1

            src_map = {str(s.id): s for s in cand_sources}

            def _candidate_rank(cid: str):
                s = src_map.get(cid)
                if not s:
                    return (999, 999)
                dom = _domain(s.canonical_url)
                if not dom:
                    return (500, 500)
                return (1 if dom in inspected_domains else 0, domain_counts.get(dom, 0))

            sorted_candidates = sorted(candidates, key=_candidate_rank)
            source_id_str = sorted_candidates[0]

        candidates.remove(source_id_str)
        source_uuid = UUID(source_id_str)
        source = session.query(Source).filter_by(id=source_uuid).first()
        if not source:
            return {
                "candidate_source_ids": candidates,
                "inspected_source_ids": list(inspected | {source_id_str}),
                "sources_inspected": int(state.get("sources_inspected", 0)) + 1,
                "sources_failed": int(state.get("sources_failed", 0)) + 1,
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
                "sources_inspected": int(state.get("sources_inspected", 0)) + 1,
                "sources_succeeded": int(state.get("sources_succeeded", 0)) + 1,
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
                "sources_inspected": int(state.get("sources_inspected", 0)) + 1,
                "sources_failed": int(state.get("sources_failed", 0)) + 1,
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
        source_uuid = UUID(fetched["source_id"])
        with service.session() as session:
            source = session.query(Source).filter_by(id=source_uuid).first()
            for c in result.data.claims:
                # Deduplication check against existing claims
                dup_claim = None
                for existing in new_claims:
                    if _claims_are_duplicates(existing.get("claim_text", ""), c.claim_text):
                        dup_claim = existing
                        break

                if dup_claim is not None:
                    service.add_evidence(
                        session,
                        claim_id=UUID(dup_claim["claim_id"]),
                        source_id=source_uuid,
                        excerpt=c.excerpt or "",
                        stance="contextualizes",
                        quality_notes=f"Corroborating source: {fetched['url']}",
                    )
                    corrob = dup_claim.setdefault("corroborating_urls", [dup_claim["source_url"]])
                    if fetched["url"] not in corrob:
                        corrob.append(fetched["url"])
                    excerpts = dup_claim.setdefault("excerpts", [dup_claim.get("excerpt", "")])
                    if c.excerpt and c.excerpt not in excerpts:
                        excerpts.append(c.excerpt)
                else:
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
                            "excerpt": c.excerpt or "",
                            "excerpts": [c.excerpt or ""],
                            "corroborating_urls": [fetched["url"]],
                            "verification_status": VerificationStatus.UNVERIFIED,
                        }
                    )
            session.commit()

    return {
        "claims": new_claims,
        **_token_budget_update(state, result, "extract_claims"),
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
    token_remaining = int(state.get("token_budget_remaining", 0))
    usage_errors = []
    with service.session() as session:
        for claim in unverified[:15]:  # bound verification per step
            if token_remaining <= 0:
                break
            claim_uuid = UUID(claim["claim_id"])

            evidence_records = (
                session.query(Evidence, Source)
                .join(Source, Evidence.source_id == Source.id)
                .filter(Evidence.claim_id == claim_uuid)
                .all()
            )
            evidence_snippets = []
            evidence_urls = list(claim.get("corroborating_urls", []))
            for ev, src in evidence_records:
                if ev.excerpt:
                    evidence_snippets.append(f"Source: {src.canonical_url}\nExcerpt: {ev.excerpt}")
                if src.canonical_url and src.canonical_url not in evidence_urls:
                    evidence_urls.append(src.canonical_url)

            if not evidence_snippets:
                for exc in claim.get("excerpts", [claim.get("excerpt", "")]):
                    if exc:
                        evidence_snippets.append(f"Source: {claim.get('source_url', '')}\nExcerpt: {exc}")
                if claim.get("source_url") and claim.get("source_url") not in evidence_urls:
                    evidence_urls.append(claim.get("source_url"))

            evidence_text = "\n\n".join(evidence_snippets).strip()

            if not evidence_text:
                verdict_str = VerificationStatus.INSUFFICIENT_EVIDENCE
                rationale_str = "No specific factual passages retrieved from source content to substantiate claim."
                service.update_claim_verification(
                    session,
                    claim_id=claim_uuid,
                    verification_status=verdict_str,
                    confidence_rationale=rationale_str,
                )
                for c in updated:
                    if c["claim_id"] == claim["claim_id"]:
                        c["verification_status"] = verdict_str
                        c["verification_rationale"] = rationale_str
                        break
                continue

            result = service.verify_claim(
                claim_text=claim["claim_text"],
                claim_type=claim.get("claim_type", "statement"),
                evidence_text=evidence_text,
                evidence_urls=evidence_urls,
            )
            updated_state = _token_budget_update(
                {**state, "token_budget_remaining": token_remaining, "errors": []},
                result,
                "verify_claims",
            )
            token_remaining = updated_state["token_budget_remaining"]
            usage_errors.extend(updated_state["errors"])
            if result.ok and result.data:
                verdict_val = result.data.verdict
                verdict_str = getattr(verdict_val, "value", str(verdict_val))
                verdict_str = str(verdict_str).removeprefix("ClaimVerdict.").strip()
                rationale_str = result.data.rationale or ""
                service.update_claim_verification(
                    session,
                    claim_id=claim_uuid,
                    verification_status=verdict_str,
                    confidence_rationale=rationale_str,
                )
                for c in updated:
                    if c["claim_id"] == claim["claim_id"]:
                        c["verification_status"] = verdict_str
                        c["verification_rationale"] = rationale_str
                        break
            else:
                for c in updated:
                    if c["claim_id"] == claim["claim_id"]:
                        c["verification_status"] = VerificationStatus.INSUFFICIENT_EVIDENCE
                        break
        session.commit()

    return {
        "claims": updated,
        "token_budget_remaining": token_remaining,
        "errors": list(state.get("errors", [])) + usage_errors,
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
                VerificationStatus.PARTIALLY_SUPPORTED,
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
                if str(disc.id) not in new_disc_ids:
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
    iteration = int(state.get("iteration", 0)) + 1
    max_iterations = int(state.get("max_iterations", 5))
    source_budget = int(state.get("source_budget_remaining", 0))
    candidates = state.get("candidate_source_ids", []) or []
    leads = state.get("pending_leads", []) or []

    if iteration >= max_iterations:
        return {
            "iteration": iteration,
            "status": TaskStatus.PARTIAL,
            "finish_reason": "iteration_limit",
            "finish_reason_detail": f"Reached max iterations ({max_iterations})",
            "_route": "report",
        }
    if source_budget <= 0 and not candidates and not leads:
        return {
            "iteration": iteration,
            "status": TaskStatus.PARTIAL,
            "finish_reason": "source_budget_exhausted",
            "finish_reason_detail": "Source budget exhausted with no work remaining",
            "_route": "report",
        }
    if not candidates and not leads:
        return {
            "iteration": iteration,
            "status": TaskStatus.COMPLETED,
            "finish_reason": "no_more_leads",
            "finish_reason_detail": "No candidate sources or pending leads remain",
            "_route": "report",
        }
    if candidates:
        return {"status": TaskStatus.RUNNING, "iteration": iteration, "_route": "inspect"}
    if leads:
        return {"status": TaskStatus.RUNNING, "iteration": iteration, "_route": "plan"}
    return {"status": TaskStatus.COMPLETED, "iteration": iteration, "_route": "report"}


# ---------------------------------------------------------------------------
# 10. build_report
# ---------------------------------------------------------------------------
async def build_report(service: ResearchService, state: ResearchState) -> dict:
    """Generate a cited report from discoveries, claims, and evidence."""
    query = state["query"]
    discovery_ids = state.get("discovery_ids", []) or []
    claims = list(state.get("claims", []) or [])

    unique_sources = set()
    verified_findings = []
    unverified_findings = []
    contradictions = []
    evidence_rows = []

    for c in claims:
        txt = c.get("claim_text", "")
        status = str(c.get("verification_status", "UNVERIFIED")).removeprefix("ClaimVerdict.")
        src = c.get("source_url", "")
        if src:
            unique_sources.add(src)
        for u in c.get("corroborating_urls", []):
            if u:
                unique_sources.add(u)
        rationale = c.get("verification_rationale", "")

        entry = f"- {txt}"
        if src:
            entry += f" (Source: [{src.split('//')[-1][:35]}]({src}))"
        if rationale:
            entry += f"\n  Verification rationale: {rationale}"

        if status in (VerificationStatus.SUPPORTED, VerificationStatus.PARTIALLY_SUPPORTED):
            verified_findings.append(entry)
        elif status in (VerificationStatus.CONTRADICTED, VerificationStatus.MIXED_EVIDENCE):
            contradictions.append(entry)
        else:
            unverified_findings.append(entry)

        src_display = f"[{src.split('//')[-1][:30]}]({src})" if src else "N/A"
        evidence_rows.append(f"| {txt[:80]} | {status} | {src_display} | {rationale[:100] if rationale else 'N/A'} |")

    findings_sections = []
    if verified_findings:
        findings_sections.append("### Key Verified Findings\n" + "\n".join(verified_findings))
    if unverified_findings:
        findings_sections.append("### Unverified / Insufficient Evidence Claims\n" + "\n".join(unverified_findings))
    findings_summary = "\n\n".join(findings_sections) or "No claims extracted."

    table_header = "| Claim | Status | Source | Verification Notes |\n|---|---|---|---|\n"
    evidence_summary = (
        f"Analyzed {len(unique_sources)} unique source URLs across {len(claims)} extracted claims.\n\n"
        + table_header
        + ("\n".join(evidence_rows) if evidence_rows else "| None | - | - | - |")
    )

    contradictions_summary = "\n".join(contradictions) or "None detected."
    limitations = (
        f"Analysis based on {len(unique_sources)} unique sources retrieved via DuckDuckGo web search. "
        "Claim verification evaluated against retrieved snapshot text; ranking is not verification."
    )

    result = service.synthesize_report(
        query=query,
        findings_summary=findings_summary,
        evidence_summary=evidence_summary,
        contradictions=contradictions_summary,
        limitations=limitations,
        unique_sources_count=len(unique_sources),
        total_discoveries_count=len(discovery_ids),
    )

    body_md = ""
    if result.ok and result.data:
        body_md = _clean_markdown_report(result.data.report_md)
    else:
        body_md = _clean_markdown_report(
            f"# Research Report: {query}\n\n"
            f"**Research Question:** {query}\n\n"
            f"**Synthesis Note:** Structured LLM synthesis unavailable ({result.error or 'fallback'}). Compiled from verified graph records:\n\n"
            f"## Key Verified Findings\n"
            + ("\n".join(verified_findings) if verified_findings else "_No conclusively verified findings._\n")
            + f"\n\n## Unverified Claims\n"
            + ("\n".join(unverified_findings) if unverified_findings else "_None._\n")
            + (f"\n\n## Contradictions\n" + "\n".join(contradictions) if contradictions else "")
            + f"\n\n## Evidence Ledger\n\n{evidence_summary}\n\n"
            f"## Research Limitations\n{limitations}\n"
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
            discovery_ids=[UUID(d) for d in discovery_ids if d],
        )
        report_id = str(rep.id)
        session.commit()

    return {
        "report_id": report_id,
        "report_body": body_md,
        **_token_budget_update(state, result, "build_report"),
    }
