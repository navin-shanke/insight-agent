"""Reports API — Phase 5.

GET /api/v1/reports           Paginated report library.
GET /api/v1/reports/{id}      Full report detail with body_md and structured intelligence.
"""

from __future__ import annotations

import re
from typing import Optional
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session

from app.api.v1.auth import get_current_user
from app.core.config import get_settings
from app.db.models import Report, Claim, Evidence, Source
from app.schemas.api.auth import TokenData
from app.schemas.api.reports import (
    ReportDetailOut,
    ReportFinding,
    ReportListResponse,
    ReportMetrics,
    ReportOut,
    ReportSource,
)

router = APIRouter(prefix="/reports", tags=["reports"])


def _session() -> Session:
    settings = get_settings()
    db_url = settings.database_url.replace("sqlite+aiosqlite:///", "sqlite:///")
    engine = create_engine(db_url, connect_args={"check_same_thread": False})
    return Session(engine)


def _report_to_out(r: Report) -> ReportOut:
    return ReportOut(
        id=r.id,
        title=r.title,
        query=r.query,
        summary=r.summary,
        limitations=r.limitations,
        task_id=r.task_id,
        created_at=r.created_at,
        updated_at=r.updated_at,
        discovery_ids=r.discovery_ids_json or [],
    )


def _report_to_detail(r: Report, session: Optional[Session] = None) -> ReportDetailOut:
    body_md = r.body_md or ""
    findings: list[ReportFinding] = []
    sources_dict: dict[str, str] = {}

    # Extract all valid URLs from markdown
    raw_urls = set(re.findall(r'https?://[^\s)\]">]+', body_md))
    for u in raw_urls:
        parsed = urlparse(u)
        if parsed.netloc:
            dom = parsed.netloc.lower()
            if u not in sources_dict:
                sources_dict[u] = dom

    # Parse markdown table rows if present
    for line in body_md.splitlines():
        line = line.strip()
        if line.startswith("|") and line.endswith("|"):
            cells = [c.strip() for c in line[1:-1].split("|")]
            if len(cells) >= 3 and not all(c in "-: " for c in cells[0]):
                claim_candidate = cells[0].strip("*_ ")
                if claim_candidate.lower() in ("claim", "finding", "statement"):
                    continue
                status_raw = cells[1].strip()
                status_clean = re.sub(r"^ClaimVerdict\.", "", status_raw).strip().upper()
                src_cell = cells[2] if len(cells) > 2 else ""
                url_match = re.search(r'https?://[^\s)\]">]+', src_cell)
                src_url = url_match.group(0) if url_match else None
                dom = urlparse(src_url).netloc.lower() if src_url else None
                notes = cells[3] if len(cells) > 3 else ""

                findings.append(
                    ReportFinding(
                        id=f"finding-{len(findings) + 1}",
                        claim_text=claim_candidate,
                        verification_status=status_clean,
                        source_url=src_url,
                        source_domain=dom,
                        confidence_rationale=notes if notes != "N/A" else None,
                        evidence_excerpts=[],
                    )
                )

    # If no table findings, parse bullet findings (historical / synthesis format)
    if not findings:
        bullet_pattern = re.compile(
            r"^[*-]\s+(?:\*\*)?(.+?)(?:\*\*)?\s*\((?:verification:\s*)?(?:ClaimVerdict\.)?([A-Za-z_]+)\)",
            re.MULTILINE,
        )
        for m in bullet_pattern.finditer(body_md):
            claim_text = m.group(1).strip()
            status = m.group(2).strip().upper()
            url_match = re.search(r'https?://[^\s)\]">]+', claim_text)
            src_url = url_match.group(0) if url_match else None
            dom = urlparse(src_url).netloc.lower() if src_url else None
            clean_text = re.sub(r"\(Source:.*?\)", "", claim_text).strip()
            clean_text = clean_text.strip("*_ ")

            findings.append(
                ReportFinding(
                    id=f"finding-{len(findings) + 1}",
                    claim_text=clean_text,
                    verification_status=status,
                    source_url=src_url,
                    source_domain=dom,
                    confidence_rationale=None,
                    evidence_excerpts=[],
                )
            )

    # Attach DB evidence excerpts and sources if session is available
    if session:
        try:
            db_claims = session.execute(select(Claim)).scalars().all()
            db_sources = {str(s.id): s for s in session.execute(select(Source)).scalars().all()}
            for f in findings:
                f_norm = re.sub(r"\W+", "", f.claim_text.lower())
                for c in db_claims:
                    c_norm = re.sub(r"\W+", "", c.claim_text.lower())
                    if f_norm and (f_norm in c_norm or c_norm in f_norm):
                        if c.source_id and str(c.source_id) in db_sources:
                            src_obj = db_sources[str(c.source_id)]
                            if not f.source_url:
                                f.source_url = src_obj.canonical_url
                                f.source_domain = urlparse(src_obj.canonical_url).netloc.lower()
                                sources_dict[src_obj.canonical_url] = f.source_domain
                        ev_rows = session.execute(
                            select(Evidence).where(Evidence.claim_id == c.id)
                        ).scalars().all()
                        for ev in ev_rows:
                            if ev.excerpt and ev.excerpt not in f.evidence_excerpts:
                                f.evidence_excerpts.append(ev.excerpt)
                        break
        except Exception:
            pass

    # Extract Executive Summary
    exec_summary = r.summary
    if not exec_summary:
        exec_match = re.search(
            r"(?:#+\s*Executive Summary|#+\s*Summary|#+\s*Overview)\s*\n+([\s\S]+?)(?=\n#+|$)",
            body_md,
            re.IGNORECASE,
        )
        if exec_match:
            exec_summary = exec_match.group(1).strip()
        else:
            paragraphs = [
                p.strip() for p in body_md.split("\n\n")
                if p.strip() and not p.strip().startswith("#") and not p.strip().startswith("|")
            ]
            if paragraphs:
                exec_summary = paragraphs[0]

    # Metrics
    supported = sum(1 for f in findings if f.verification_status == "SUPPORTED")
    partially_supported = sum(1 for f in findings if f.verification_status == "PARTIALLY_SUPPORTED")
    contradicted = sum(1 for f in findings if f.verification_status in ("CONTRADICTED", "MIXED_EVIDENCE"))
    unverified = sum(1 for f in findings if f.verification_status in ("UNVERIFIED", "INSUFFICIENT_EVIDENCE", "UNVERIFIABLE"))

    domains = set(sources_dict.values())
    metrics = ReportMetrics(
        unique_sources_count=len(sources_dict),
        unique_domains_count=len(domains),
        total_discoveries_count=len(r.discovery_ids_json or []),
        total_claims_count=len(findings),
        supported_count=supported,
        partially_supported_count=partially_supported,
        contradicted_count=contradicted,
        unverified_count=unverified,
    )

    return ReportDetailOut(
        id=r.id,
        title=r.title,
        query=r.query,
        summary=r.summary,
        limitations=r.limitations,
        task_id=r.task_id,
        created_at=r.created_at,
        updated_at=r.updated_at,
        discovery_ids=r.discovery_ids_json or [],
        body_md=body_md,
        executive_summary=exec_summary,
        metrics=metrics,
        findings=findings,
        sources=[ReportSource(url=u, domain=d) for u, d in sources_dict.items()],
    )


@router.get("", response_model=ReportListResponse, summary="List research reports")
async def list_reports(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    q: Optional[str] = Query(default=None, description="Search in title/query"),
    _user: TokenData = Depends(get_current_user),
) -> ReportListResponse:
    s = _session()
    try:
        stmt = select(Report)
        if q:
            like = f"%{q}%"
            stmt = stmt.where(Report.title.ilike(like) | Report.query.ilike(like))
        stmt = stmt.order_by(Report.created_at.desc())

        total = s.execute(select(func.count()).select_from(stmt.subquery())).scalar_one() or 0
        rows = s.execute(stmt.offset((page - 1) * page_size).limit(page_size)).scalars().all()

        return ReportListResponse(
            items=[_report_to_out(r) for r in rows],
            total=total,
            page=page,
            page_size=page_size,
            has_next=(page * page_size) < total,
        )
    finally:
        s.close()


@router.get("/{report_id}", response_model=ReportDetailOut, summary="Get full report detail")
async def get_report(
    report_id: str,
    _user: TokenData = Depends(get_current_user),
) -> ReportDetailOut:
    s = _session()
    try:
        r = s.get(Report, report_id)
        if not r:
            raise HTTPException(status_code=404, detail="Report not found")
        return _report_to_detail(r, session=s)
    finally:
        s.close()
