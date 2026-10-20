# Insight Agent — Changelog and Handoff Notes

## 2026-10-21 — Antigravity handoff package

- Added root agent instructions and the Antigravity handoff/start-here documents.
- Refreshed persistent memory summaries to replace pre-merge branch, API, and scheduler descriptions.
- Recorded the verified database-safety state and retained the original-DB migration authorization boundary.
- Updated the master blueprint with the completed backup/copy-test gate and the planning-only local-first Google Drive direction.
- No application code, database, Drive, Telegram, Phase 5, or Phase 6 implementation was changed.
- Last reported test evidence remains 23 focused DB integration tests and 86 full tests from the safety-gate work; not rerun for this documentation task.

The remaining entries are historical notes, not a current status source. Consult docs/IMPLEMENTATION_STATUS.md and docs/ANTIGRAVITY_HANDOFF.md for current state.

---
All meaningful implementation changes, verified test results, commits, blockers, and handoffs are recorded below. Do not duplicate every conversation message.

## v0.4.0 — Phase 4: Daily Discovery Scheduler (in progress)

### Added
- `backend/app/services/scheduler.py` — `SchedulerService` with `acquire_lock()`, `release_lock()`, `run_daily_discovery()`
- `backend/app/db/models/scheduled_run.py` — `ScheduledRun` model (task_id, status, next_run_at, last_run_at)
- `backend/app/db/models/watchlist.py` — `Watchlist` model (name, topic, keywords_json, source_preferences_json, enabled)
- `backend/db/alembic/versions/35fd433a99c2_phase_4_add_watchlists_and_scheduled_.py` — Alembic migration for new tables
- `backend/tests/integration/test_phase4_scheduler.py` — 6 integration tests:
  - `test_watchlist_crud`
  - `test_scheduler_lock_prevents_concurrent_runs`
  - `test_full_research_run_persists`
  - `test_duplicate_suppression`
  - `test_source_budget_enforcement`
  - `test_report_has_citations`
- `backend/app/main.py` — `run_daily_discovery()` CLI entry point (subparser `daily-discovery`)
- `backend/app/agents/graph.py` — Research graph execution loop (`_run_loop`, `resume_research`, `run_research`)
- `backend/app/agents/nodes.py` — All 10 node implementations (load_context through build_report)
- `memory/HANDOFF.md` — Primary entry point for new AI model
- `memory/PROJECT_OVERVIEW.md` — Project purpose, stack, architecture, phases
- `memory/ARCHITECTURE.md` — Component dependency graph (Mermaid), data flow, implemented vs planned
- `memory/DECISIONS.md` — Architectural decisions, rejected approaches, known pitfalls, unresolved decisions
- `memory/PROGRESS.md` — Phase-by-phase status, actual commits, test results, known issues
- `memory/CURRENT_STATE.md` — Branch, HEAD, modified files, active blocker, conditions for completion
- `memory/CHANGELOG.md` — This file

### Fixed
- Corrected `result.complete` dict-key access pattern in `nodes.py:119` (bug where `dict.get("complete")` returns `None` and the `if` block was never entered, preventing candidate sourcing)

### Changed
- `backend/app/agents/graph.py` — `_run_loop()` now uses `result.get("complete")` / `result.get("records")` for safe dict access
- `backend/app/agents/nodes.py:119` — Same fix: `if result.get("complete") and result.get("records"):`
- `memory/` directory created with all handoff/overview/architecture/decisions/progress/current state/changelog files

### Known Issues (remaining from v0.3.x carry-forward)
- `nodes.py:121` — `url = str(rec.canonical_url)` depends on `rec` being a `SourceReference` object; verify connector always returns Pydantic models, not plain dicts
- `nodes.py:190` — `fetched.error is None and fetched.snapshot is not None` guard; ensure connector sets both or neither

### Deprecated/Removed
- None (v0.4.0 is additive)

---

## v0.3.1 — Bugfix: Scheduler Lock Release

### Fixed
- `scheduler.py:release_lock()` now properly sets `run.last_run_at = datetime.now(timezone.utc)` even when the run was already released (idempotent release)

### Added
- `test_scheduler_lock_prevents_concurrent_runs` integration test

---

## v0.3.0 — Phase 3: Bounded Deep-Research Workflow

### Added
- Full LangGraph StateGraph with 10-node research workflow (`graph.py`)
- All 10 node implementations (`nodes.py`: load_context through build_report)
- Checkpoint persistence after every node (`task_checkpoints` table)
- `resume_research()` — resume from latest durable checkpoint
- Source budget enforcement across nodes
- Iteration limit enforcement (`max_iterations = 5`)
- LLM router integration (`ModelRouter`) for plan_research, extract_claims, verify_claims, rank_discovery, synthesize_report
- DuckDuckGoConnector with SSRF-safe fetcher + BeautifulSoup4 HTML→text conversion
- Data contracts: `SourceReference`, `SourceRecord`, `AccessStatus`, `ResearchState`, `TaskStatus`, `VerificationStatus`
- Alembic migrations for all Phase 3 tables (source, content_snapshot, claim, evidence, discovery, discoveriesource, report, task_checkpoint)

### Fixed
- Initial schema alignment between SQLAlchemy models and Pydantic schemas
- `initial_state()` function providing all budget fields initialized

### Changed
- `run_research()` now requires `task_id` as keyword-only argument
- Graph execution driven manually (step-by-step with checkpointer) instead of `graph.invoke()` with built-in checkpointer (requires DB-durable checkpoints per §14)

---

## v0.2.0 — Data Contracts & Connectors

### Added
- Pydantic schemas: `SourceReference`, `SourceRecord`, `AccessStatus` (`app/schemas/source.py`)
- `AccessStatus` enum (READY, FAILED, AUTH_REQUIRED, PERMISSION_DENIED, RATE_LIMITED, TEMPORARILY_UNAVAILABLE, UNSUPPORTED, FAILED, PARTIAL, NO_RESULTS)
- `DuckDuckGoConnector` (search + fetch with SSRF protections + URL allowlist)
- `ModelRouter` (plan_research, extract_claims, verify_claims, rank_discovery, synthesize_report — stubbed with mock data for integration tests)
- SQLAlchemy models: `Source`, `ContentSnapshot`, `Claim`, `Evidence`, `Discovery`, `DiscoverySource`, `Report`, `TaskCheckpoint`
- Alembic migration framework initial migration (create all Phase 2 tables)

### Fixed
- URL allowlist in SSRF-safe fetcher blocks RFC-1918/loopback/link-local unless `CLAUDE_FLOW_HTTP_FETCH_ALLOW_PRIVATE=1`
- Default User-Agent `ruflol-http-fetch/1.0`; blocks Authorization/Cookie/X-Auth headers unless `CLAUDE_FLOW_HTTP_FETCH_ALLOW_AUTH=1`

### Changed
- `fetcher.py` now uses BeautifulSoup4 to strip HTML tags and extract `text_content` from `<p>`, `<li>`, `<td`, `<div>` elements
- Renamed `connector.py` → `connectors/` package with `DuckDuckGoConnector`

---

## v0.1.0 — Initial Scaffolding

### Added
- FastAPI application (`app/main.py`) with `/health/live` and `/health/ready` endpoints
- Project root structure (`app/`, `backend/`, `data/` directory layout)
- Initial SQLAlchemy `Base` and engine configuration
- `argparse` CLI in `main.py` with `serve` and `daily-discovery` subcommands
- Basic README and project setup

### Removed
- None (initial commit)
