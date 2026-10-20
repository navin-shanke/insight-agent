# Insight Agent: Current State

## Branch and HEAD

- **Current branch**: `phase-4-daily-discovery`
- **Current HEAD commit**: `0a5e01b` — "Phase 3: add HTML-to-text conversion in SSRF-safe fetcher and beautifulsoup4 dependency"
- **Phase 2 base**: `ff73445` — "Phase 2: data contracts, DuckDuckGo connector, SSRF-safe fetcher, SQLAlchemy models + Alembic migrations"
- **Remote tracking**: `origin/phase-3-deep-research` points to `ff73445` (Phase 2 state)
- **Local/remote sync**: `0a5e01b` is ahead of `origin/phase-3-deep-research` by Phase 3 + Phase 4 work

## Working Tree Status

- **Modified files** (5 files, shown by `git status --short`):
  - ` M backend/app/agents/graph.py`
  - ` M backend/app/agents/nodes.py`
  - ` M backend/app/db/models/__init__.py`
  - ` M backend/app/main.py`
  - `?? backend/app/agents/services/` (untracked directory)
  - `?? backend/app/db/models/scheduled_run.py` (untracked file)
  - `?? backend/app/db/models/watchlist.py` (untracked file)
  - `?? backend/app/services/` (untracked directory)
  - `?? backend/db/alembic/versions/35fd433a99c2_phase_4_add_watchlists_and_scheduled_.py` (untracked migration)
  - `?? backend/tests/integration/test_phase4_scheduler.py` (untracked test file)
- **No uncommitted changes beyond the above** — working tree has the listed modifications and new files.

## Current Implementation State

### Graph (graph.py)
- ✅ StateGraph built with 10-node sequence: `load_context → plan_research → discover_sources → normalize_sources → inspect_content → extract_claims → verify_claims → score_discoveries → decide_next → build_report`
- ✅ Fixed linear edges between nodes (conditional routing in `decide_next`)
- ✅ `_run_loop()` executes nodes step-by-step, checkpoint after each node
- ✅ `resume_research()` loads latest checkpoint and continues
- ✅ `if result.complete and result.records:` at `nodes.py:119` works correctly with `DiscoveryResult` Pydantic model (production) and test mock (dynamic class with `complete: True`). All 6 integration tests pass, confirming candidates populate correctly.

### Nodes (nodes.py)
- ✅ `load_context` — marks run as started, increments iteration
- ✅ `plan_research` — LLM produces sub_topics → pending_leads
- ✅ `discover_sources` — calls `service.discover_sources(query, max_results)` which returns `DiscoveryResult` Pydantic model with `complete: bool` and `records: List[SourceRecord]`. The guard `if result.complete and result.records:` enters correctly when records are found.
- ✅ `normalize_sources` — deduplicates candidates against inspected set
- ✅ `inspect_content` — pops candidate, fetches via `service.fetch_source(canonical_url)`, stores snapshot. Uses `fetched.error is None and fetched.snapshot is not None` guard.
- ✅ `extract_claims` — LLM extracts claims from fetched text; adds to `claims` list + evidence
- ✅ `verify_claims` — verifies up to 5 pending claims per run via LLM
- ✅ `score_discoveries` — groups verified claims into Discovery records
- ✅ `decide_next` — routing: report if iteration limit reached; inspect if candidates remain; plan if leads remain; report if nothing left
- ✅ `build_report` — synthesizes Markdown report with findings, evidence, contradictions; persists Report row

### Scheduler (scheduler.py)
- ✅ `acquire_lock(task_id)` — inserts "running" row if none exists; returns False if already running
- ✅ `release_lock(task_id, status)` — updates status, sets last_run_at
- ✅ `run_daily_discovery(query, topics, source_budget, max_iterations)` — calls `run_research()` with collected params
- ✅ `SchedulerService` wired into `main.py:run_daily_discovery()` CLI entry

### Service (service.py)
- ✅ `upsert_source()` — insert or update Source by canonical_url; increment retrieval_count
- ✅ `add_snapshot()` — persist ContentSnapshot per retrieval
- ✅ `add_claim()`, `add_evidence()`, `add_discovery()`, `link_discovery_source()`, `add_report()` — full CRUD
- ✅ `session()` — contextmanager yielding SQLAlchemy Session
- ✅ `save_checkpoint()`, `load_latest_checkpoint()` — DB-durable checkpoint persistence

### DB Models (models/__init__.py)
- ✅ `Source` — canonical_url, access_status, retrieval_count, metadata_json
- ✅ `ContentSnapshot` — content_hash, text_content, access_status, coverage_json
- ✅ `Claim` — claim_text, claim_type, verification_status, source_id FK
- ✅ `Evidence` — claim_id FK → source_id FK, excerpt, stance, quality_notes
- ✅ `Discovery` — title, summary, category, verification_status, task_id FK
- ✅ `DiscoverySource` — discovery_id FK → source_id FK, link_type (cites, contradicts)
- ✅ `Report` — title, query, body_md, limitations, task_id FK, discovery_ids_json
- ✅ `TaskCheckpoint` — thread_id, task_id, step, state_json, timestamp
- ✅ `ScheduledRun` — task_id, status, next_run_at, last_run_at (Phase 4 addition), with `task_id` column for lock queries
- ✅ `Watchlist` — name, topic, keywords_json, source_preferences_json, enabled (Phase 4 addition)

### Schemas (schemas/)
- ✅ `SourceReference` — lightweight source ref (source_type, canonical_url, title, etc.)
- ✅ `SourceRecord` — full normalized source (all timestamps, access_status, metadata_json)
- ✅ `AccessStatus` — READY, FAILED, RATE_LIMITED, etc.
- ✅ `ResearchState` — TypedDict with all graph state fields
- ✅ `TaskStatus` — PENDING, RUNNING, COMPLETED, PARTIAL, FAILED, CANCELLED, INTERRUPTED
- ✅ `VerificationStatus` — UNVERIFIED, SUPPORTED, CONTRADICTED, MIXED_EVIDENCE, INSUFFICIENT_EVIDENCE, OUTDATED, NOT_APPLICABLE
- ✅ `DiscoveryResult` — returned by `service.discover_sources()`; Pydantic `BaseModel` with `connector_name: str`, `query: str`, `records: List[SourceRecord]`, `failures: List[AccessFailure]`, `warnings: List[str]`, `retrieved_at: datetime`, `total_available: Optional[int]`, `page: Optional[int]`, `page_size: Optional[int]`, `has_more: Optional[bool]`, `complete: bool = True`

### Key Files New (Phase 4, not yet committed)
- `backend/app/db/models/scheduled_run.py` — ScheduledRun model with `task_id` column
- `backend/app/db/models/watchlist.py` — Watchlist model
- `backend/app/services/` — service utilities for Phase 4
- `backend/db/alembic/versions/35fd433a99c2_phase_4_add_watchlists_and_scheduled_.py` — new Alembic migration
- `backend/tests/integration/test_phase4_scheduler.py` — 6 integration tests

### Active Blocker

No active blockers. All 6 integration tests pass. The `result.complete` condition at `nodes.py:119` functions correctly with the `DiscoveryResult` Pydantic model.

### Last Verified Successful Command

```bash
cd backend && python -m pytest tests/integration/test_phase4_scheduler.py -v
# 6 passed, 0 failed
```

```bash
cd backend && alembic check
# No model/schema drift detected
```

```bash
cd backend && alembic upgrade head
# Creates all tables successfully
```

### Conditions Required Before Task Can Be Marked Complete

1. ✅ All 6 integration tests pass (verified: `test_watchlist_crud`, `test_scheduler_lock_prevents_concurrent_runs`, `test_full_research_run_persists`, `test_duplicate_suppression`, `test_source_budget_enforcement`, `test_report_has_citations`)
2. ✅ `alembic check` passes (no model/schema drift detected)
3. ✅ `alembic upgrade head` creates all tables without error
4. ✅ Scheduler lock/release tested and working
5. ✅ No uncommitted modifications to core files beyond the intentional Phase 4 additions
6. 🟡 **User approval required** before starting Phase 5 (Telegram dashboard) — per the `HANDOFF.md` approval boundary

### Approval Boundary

> **Do not start the next phase without user approval.** 
> 
> The current task (stabilizing Phase 4 Daily Discovery scheduler) must be verified complete by the user before any work begins on Phase 5 (Telegram dashboard), Phase 6 (multi-provider LLM routing), or Phase 7 (persistent cross-session memory). 
> 
> This boundary is enforced in `memory/HANDOFF.md` section 10 and tracked in `memory/PROGRESS.md` "Conditions Required Before Task Can Be Marked Complete".