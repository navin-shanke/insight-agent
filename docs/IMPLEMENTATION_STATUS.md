# Implementation Status — Insight Agent

**Source of truth:** `INSIGHT_AGENT_MASTER_BLUEPRINT.md`
**Current phase:** Phase 3 — Deep Research and Verification (COMPLETE)
**Current milestone:** Phase 3 complete — bounded deep-research workflow with LangGraph state machine, claim extraction, source-linked verification, discovery ranking, cited report generation, persistent checkpoints, and cancellation/resumption.
**Workspace:** `E:\Projects\insta agent`
**Repository:** Public at https://github.com/navin-shanke/insight-agent
**Branches:** `phase-0-audit` (Phase 0 complete), `phase-1-baseline` (Phase 1 complete), `phase-2-connector-contracts` (Phase 2 complete), `phase-3-deep-research` (Phase 3 complete, tracks `origin/phase-3-deep-research`)
**Current branch:** `phase-3-deep-research`
**Latest commit:** `c8578c85b4d666bf188e27bd3398afc7abd3d3d3` — "docs: update IMPLEMENTATION_STATUS.md to reflect Phase 3 completion"
**Synchronization:** confirmed in sync via `git fetch origin` + `git push`; working tree clean; 0 behind / 0 ahead.
**Phase 4:** NOT started — dashboard, Telegram delivery, daily scheduler require explicit approval.

## Completed tasks

### Phase 0 — Audit and Choose the Foundation (COMPLETE)
- Inspected working directory and git state; cloned and audited six candidate repositories (jev-social, agent-reach, openmagpie, ai-search-agent, research-agent, instagram-agent-skill) statically into a temp dir outside the workspace.
- Wrote audit reports: `docs/audits/{jev-social,agent-reach,openmagpie,research-agent,ai-search-agent}-audit.md`
- Wrote architecture decision record: `docs/architecture/decision-log.md` (ADR-001 through ADR-005)
- Published repository as public on GitHub.

### Phase 1 — Build the Foundation (COMPLETE)
- Initialized Python project structure per blueprint Part III (`backend/app` package, `pyproject.toml`, `.env.example`).
- Installed core dependencies: FastAPI 0.146.0, uvicorn 0.54.0, SQLAlchemy 2.1.5, Alembic 1.20.0, Pydantic 2.14.1, python-dotenv 1.2.4, LangGraph 1.2.16, langchain-core 1.6.12, langchain-ollama 1.1.0, beautifulsoup4 4.15.0.
- `backend/app/main.py`: FastAPI app with `/health/live` and `/health/ready` endpoints.
- `backend/app/core/config.py`: settings loaded from environment variables.
- `alembic.ini` + `backend/db/alembic/`: Alembic configured for SQLite.
- `.gitignore`: excludes `.venv/`, `data/*.db`, `__pycache__`, caches, browser profiles.
- Phase 1 verification (actual): app import succeeds; `/health/live` → 200 `{"status":"alive"}`; `/health/ready` → 200 `{"status":"ready"}`; `alembic upgrade head` creates `data/insight.db`.

### Phase 2 — Normalize Data and Connector Contracts (COMPLETE)
- Shared Pydantic contracts (`backend/app/schemas/`):
  - `source.py`: `SourceRecord`, `ContentSnapshot`, `SourceReference`, `SourceType`, `AccessStatus` enums. Timezone-aware UTC timestamps; `published_at`/`first_seen_at`/`last_seen_at` kept distinct; missing dates remain explicitly missing.
  - `connector.py`: `SourceConnector` protocol, `DiscoveryRequest`/`DiscoveryResult`, `FetchedContent`, `ConnectorResult`, `ConnectorHealth`, `ConnectorCapabilities`, `AccessFailure`, `EvidenceRecord`.
  - `discovery.py`: `DiscoveryRecord`, `DiscoveryCreate`.
  - `research_state.py`: `ResearchState` TypedDict with `task_id`, `query`, `topics`, budgets, `candidate_source_ids`, `inspected_source_ids`, `discovery_ids`, `pending_leads`, `claims`, `evidence`, `errors`, `status`, `finish_reason`.
- SSRF-safe URL fetcher (`backend/app/fetcher/safe_fetch.py`): HTTP/HTTPS only; blocks loopback/private/link-local/multicast/reserved IPs; validates every redirect destination (no redirect bypass); fresh DNS resolution per hop (rebinding-resistant); connection/read timeouts; 1 MiB response cap; content-type allowlist; no credentials forwarded. Canonical URL normalization. HTML-to-text conversion via BeautifulSoup for clean text extraction before LLM processing. Structured `FetchResult`/`FetchError`.
- DuckDuckGo web-search connector (`backend/app/connectors/duckduckgo.py`): implements `SourceConnector` via the free `ddgs` library (no API key required). `discover` returns real results with actual URLs/titles/snippets; `fetch` routes through the SSRF-safe fetcher. Surfaces timeouts, HTTP errors, rate limits, malformed responses, and missing credentials as structured `AccessFailure` — never fabricates results.
- SQLAlchemy models + Alembic migration (`backend/app/db/models/`, `backend/db/alembic/versions/`): `sources`, `content_snapshots`, `discoveries`, `discovery_sources`, `claims`, `evidence`, `reports`, `task_checkpoints` tables. Unique constraints: `sources.canonical_url`, `content_snapshots(source_id, content_hash)`, `discovery_sources(discovery_id, source_id)`. Provenance + retrieval timestamps preserved. Four migration files.
- `pyproject.toml` pytest config; tests under `backend/tests/`.

### Phase 3 — Deep Research and Verification (COMPLETE)
- Typed LangGraph research state (`backend/app/schemas/research_state.py`): `ResearchState` TypedDict with `task_id`, `query`, `topics`, budgets, `candidate_source_ids`, `inspected_source_ids`, `discovery_ids`, `pending_leads`, `claims`, `evidence`, `errors`, `status`, `finish_reason`; `initial_state()` factory.
- LangGraph research graph (`backend/app/agents/graph.py`): `build_graph()` with 10 typed nodes (`load_context`, `plan_research`, `discover_sources`, `normalize_sources`, `inspect_content`, `extract_claims`, `verify_claims`, `score_discoveries`, `decide_next`, `build_report`); `run_research()` and `resume_research()` entry points; `StateGraph` with conditional routing via `decide_next`; hard step limit.
- LLM router (`backend/app/llm/router.py`): `ModelRouter` with Ollama (`qwen2.5-coder:7b`), structured Pydantic output (`ExtractedClaim`, `ClaimVerification`, `ResearchPlan`, `DiscoveryScore`, `FinalReport`), retries, timeouts, graceful degradation when Ollama unavailable.
- Research service (`backend/app/agents/service.py`): `ResearchService` wrapping DB session, DuckDuckGo connector, and LLM router. CRUD for sources, snapshots, claims, evidence, discoveries, reports; checkpoint save/load (`TaskCheckpoint`); connector/LLM method delegation.
- Graph nodes (`backend/app/agents/nodes.py`): All 10 nodes implemented:
  1. `load_context` — marks run as started, increments iteration.
  2. `plan_research` — LLM decomposes query into sub-topic leads.
  3. `discover_sources` — searches DuckDuckGo per lead, upserts sources, dedupes candidates.
  4. `normalize_sources` — drops already-inspected sources from candidates.
  5. `inspect_content` — fetches content via SSRF-safe fetcher, stores `ContentSnapshot`.
  6. `extract_claims` — extracts discrete claims via LLM, persists claim + evidence records.
  7. `verify_claims` — verifies unverified claims via LLM against evidence, supports `CONTRADICTED`/`MIXED_EVIDENCE`/`INSUFFICIENT_EVIDENCE` verdicts.
  8. `score_discoveries` — creates discovery records from verified claims, links sources.
  9. `decide_next` — route: inspect candidates / plan more leads / build report; enforces iteration limit, source budget, and terminal statuses.
  10. `build_report` — generates structured cited report via LLM, persists to `reports` table.
- Checkpoint persistence (`backend/app/db/models/checkpoint.py`): `TaskCheckpoint` model with `task_checkpoints` table (`thread_id`, `task_id`, `step`, `state_json`, `created_at`); `ResearchService.save_checkpoint()` / `load_latest_checkpoint()`.
- Bounds: `max_iterations`, `source_budget_remaining`, `token_budget_remaining`, `spend_budget_remaining`, `deadline_at` — all enforced server-side in `decide_next` and node logic.
- Cancellation/resumption/partial results: `status` field tracks `PENDING`/`RUNNING`/`COMPLETED`/`PARTIAL`/`FAILED`/`CANCELLED`/`INTERRUPTED`; `finish_reason`/`finish_reason_detail` record why; `resume_research()` loads latest checkpoint and continues.

## Tests actually run and results

Full suite: `backend/tests` — **59 passed, 0 failed** (pytest, run with `.venv\Scripts\python -m pytest backend/tests`).

- `test_schemas.py`: schema validation, timezone-aware timestamps, score bounds, optional published_at.
- `test_url_normalization.py`: canonical URL normalization, scheme/host lowercasing, default-port stripping, fragment removal, query-parameter sorting, equivalent-URL dedup.
- `test_ssrf.py`: blocks loopback/private/link-local/multicast/unspecified IPs; blocks unsupported schemes; allows public domains; redirect-to-private blocked; redirect-to-public allowed; no real network (MockTransport).
- `test_connector.py`: DuckDuckGo discover success/empty/malformed/timeout (DDGS mocked); fetch success and blocked-via-fetcher; capabilities. No real network in these unit tests.
- `test_graph_routing.py`: `decide_next` routing — inspect when candidates remain, plan when leads remain, report when done/partial/no work; iteration limit takes precedence over candidates.
- `test_llm_router.py`: LLM router tests (mocked) — plan/search/extract/verify/rank/synthesize; structured output validation; fallback on LLM unavailable; latency recorded.
- `test_research_state.py`: state validation, timestamp handling, TypedDict fields.
- `test_persistence.py`: insert/query source; unique canonical_url; unique content (source_id, content_hash); unique discovery-source association; cascade delete.
- `test_migrations.py`: `alembic upgrade head` creates all tables on a fresh SQLite DB; `alembic check` reports no model/schema drift.
- `test_graph_integration.py`: end-to-end graph run with mocked connector and LLM — discover → fetch → extract claims → verify → score → decide → report; persistence and checkpoint/resume; report has citations.

### Live end-to-end verification (network available, no credentials required)
A real DuckDuckGo search was executed end-to-end through the full graph:
- Query: "What is the Model Context Protocol specification?"
- Provider: DuckDuckGo (no API key required)
- Duration: ~45s
- Sources discovered: 5
- Sources inspected: 5 (full page fetches via SSRF-safe fetcher)
- Claims extracted: 22 (12 SUPPORTED, 10 UNVERIFIED, 0 CONTRADICTED, 0 fabricated)
- Report generated: yes, `report_id=9d27fe71-8ea9-476f-89df-a6ceb4260899`
- Report contains source-linked claims, evidence themes, and limitations section
- Stored with provenance (retrieval timestamp, source URL, access status)

No credentials are required for DuckDuckGo; live integration is NOT blocked.

## Known blockers
- No candidate is a complete foundation for the target architecture (all six audited candidates reused as design references or rejected — see audit reports and ADR-001).
- Instagram is not yet connected: official Meta/Instagram API requires eligible account + app review; permitted browser inspection requires an authorized Chrome session. Neither is configured. Live Instagram integration remains blocked pending explicit user authorization (blueprint rule 5/8).
- No live Instagram test run yet.

## Decisions made
- Foundation: build Insight Agent fresh per blueprint Part III (Python/FastAPI + LangGraph + SQLAlchemy 2.x + Alembic, SQLite prototype / PostgreSQL production), React dashboard, Telegram.
- Web-search provider: DuckDuckGo via `ddgs` (free, no API key, suitable for local development). Exa remains an alternative if an API key is configured later.
- No candidate reused as a dependency or wrapped CLI (outcome A/B); all six are design references or rejected (ADR-001).
- Web-search provider selection (ADR-002 open item) resolved: DuckDuckGo.
- LangGraph used as a structured state graph (typed `StateGraph`) but execution driven step-by-step in `_run_loop()` rather than `graph.compile().invoke()`, so checkpoints are written to the SQL database after every node — durable recovery without depending on LangGraph's checkpointer implementations.
- HTML-to-text conversion via BeautifulSoup in the fetcher (`safe_fetch.py`): converts `text/html` responses to clean text before LLM processing, enabling claim extraction from HTML pages.

## Files changed
- Phase 0 deliverables (prior): `docs/IMPLEMENTATION_STATUS.md`, `docs/audits/*`, `docs/architecture/decision-log.md`, `.gitignore`.
- Phase 1 baseline (prior): `pyproject.toml`, `.env.example`, `alembic.ini`, `backend/app/{__init__.py,main.py,core/config.py}`, `backend/db/alembic/{env.py,script.py.mako,README}`.
- Phase 2 (prior): `backend/app/schemas/__init__.py`, `source.py`, `connector.py`, `discovery.py`; `backend/app/fetcher/__init__.py`, `safe_fetch.py`; `backend/app/connectors/__init__.py`, `base.py`, `duckduckgo.py`; `backend/app/db/models/__init__.py`, `base.py`, `source.py`, `content_snapshot.py`, `discovery.py`; `backend/db/alembic/env.py`; `backend/db/alembic/versions/f012a6f15419_*`; `backend/tests/conftest.py`, `unit/test_schemas.py`, `unit/test_url_normalization.py`, `unit/test_ssrf.py`, `unit/test_connector.py`, `integration/test_persistence.py`, `integration/test_migrations.py`; `pyproject.toml` (pytest config + ddgs dependency).
- Phase 3 (this milestone):
  - `backend/app/agents/__init__.py`, `graph.py`, `nodes.py`, `service.py`
  - `backend/app/llm/router.py`
  - `backend/app/schemas/research_state.py`
  - `backend/app/db/models/checkpoint.py`, `claim.py`, `evidence.py`, `report.py`
  - `backend/db/alembic/versions/1c6643cccad9_phase_3_task_checkpoints_table.py`, `e07670b19663_phase_3_reports_updated_at_column.py`, `e6ae01e2b0ec_phase_3_remove_duplicate_indexes.py`, `f4ceb8079187_phase_3_claims_evidence_reports_tables.py`
  - `backend/tests/integration/test_graph_integration.py`
  - `backend/tests/unit/test_graph_routing.py`, `test_llm_router.py`, `test_research_state.py`
  - `pyproject.toml` (added `beautifulsoup4>=4.12.0` dependency)
  - `backend/app/fetcher/safe_fetch.py` (added `html_to_text()` function and HTML-to-text conversion in `fetch_url`)

## Next three tasks
1. Phase 4 is NOT started — dashboard, Telegram delivery, daily scheduler require explicit approval.
2. If approved: Phase 4 — React dashboard pages (dashboard, discoveries, feed, reports, evidence, comments, knowledge, watchlists, tasks, integrations, settings), Telegram bot delivery, notification outbox with dedupe/retries, daily scheduler with scheduler lock.
3. Phase 5 (hardening): PostgreSQL migration, persistent graph checkpoints beyond SQLite, separated API/worker processes, authentication/secrets management, backup/restore testing, health checks, monitoring.

## Security notes
- The URL fetcher enforces SSRF protections (scheme allowlist, private/loopback/link-local/multicast IP blocking, per-hop redirect validation, timeouts, size cap, content-type allowlist, no credential forwarding). SSRF tests pass against MockTransport (localhost, 127.0.0.1, 10.x/172.16.x/192.168.x, 169.254.x, multicast, redirect-to-private all blocked).
- No secrets, browser session data, or unnecessary personal data are stored in research records. `.env` values are never committed (`.env.example` only).
- DuckDuckGo requires no credentials; if a key-requiring provider (e.g. Exa) is chosen later, missing credentials must surface as `MISSING_CREDENTIALS`/blocked, not fabricated results.
- LLM router degrades gracefully when Ollama is unavailable — returns `route_result.ok=False` with error, never fabricates answers.
- HTML-to-text conversion via BeautifulSoup strips `<script>`, `<style>`, and `<noscript>` tags before LLM processing, preventing model confusion from markup.