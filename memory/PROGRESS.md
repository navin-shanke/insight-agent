# Insight Agent: Progress

## Phase-by-Phase Implementation Status

| Phase | Status | Key Files Changed | Commits (verified) |
|-------|--------|-------------------|---------------------|
| **Phase 1** | ✅ Complete | `app/main.py`, initial DB models, FastAPI scaffolding | `c8578c8`, `176ac4c` (docs updates only) |
| **Phase 2** | ✅ Complete | Data contracts (schemas/), DuckDuckGo connector, SSRF-safe fetcher, SQLAlchemy models, Alembic migrations | `ff73445`, `10a2d3b` |
| **Phase 3** | ✅ Complete | StateGraph (graph.py), 10 nodes (nodes.py), checkpoint persistence, scheduler | `0a5e01b` (Phase 3 base) + recent modifications to `graph.py`, `nodes.py`, `main.py`, `db/models/__init__.py` |
| **Phase 4** | ✅ Complete | SchedulerService (scheduler.py), integration tests (test_phase4_scheduler.py), watchlist model, scheduled_run model | All 6 integration tests pass |

## Actual Commits and Branches

- **Current branch**: `phase-4-daily-discovery` (checked out from master)
- **Current HEAD**: `0a5e01b` — "Phase 3: add HTML-to-text conversion in SSRF-safe fetcher and beautifulsoup4 dependency"
- **Phase 2 base**: `ff73445` — "Phase 2: data contracts, DuckDuckGo connector, SSRF-safe fetcher, SQLAlchemy models + Alembic migrations"
- **Phase 3 addition**: earlier commit
- **Remote**: `origin/phase-3-deep-research` matches local `ff73445` (Phase 2 state)
- **Working tree**: Modified files listed below; untracked files for Phase 4 features

## Files Changed (Modified, Not Yet Committed)

| File | Change Type | Description |
|------|-------------|-------------|
| `backend/app/agents/graph.py` | Modified | Updated research graph; `run_research` made async |
| `backend/app/agents/nodes.py` | Modified | Node implementations; `discover_sources` uses `DiscoveryResult` model |
| `backend/app/db/models/__init__.py` | Modified | Added ScheduledRun, Watchlist, ScheduledRun exports |
| `backend/app/main.py` | Modified | Added `run_daily_discovery()` CLI entry point |
| `backend/app/db/models/report.py` | Modified | Changed `id` from `Mapped[uuid.UUID]` to `Mapped[str]` with `String(32)` and `uuid.uuid4().hex` default |
| `backend/app/db/models/scheduled_run.py` | Modified | Added `task_id` column for scheduler lock queries |
| `backend/app/db/models/watchlist.py` | New file | Watchlist model for Phase 4 |
| `backend/app/services/` | New directory | Service utilities for Phase 4 |
| `backend/db/alembic/versions/35fd433a99c2_phase_4_add_watchlists_and_scheduled_.py` | New file | Alembic migration for watchlists and scheduled runs |
| `backend/tests/integration/test_phase4_scheduler.py` | New file | 6 integration tests |

## Features Implemented

| Feature | File(s) | Test(s) |
|---------|---------|---------|
| StateGraph with 10-node sequence | `graph.py` | — |
| Checkpoint persistence after each node | `graph.py:_run_loop()` | — |
| Scheduler lock/release (idempotent) | `scheduler.py` | `test_scheduler_lock_prevents_concurrent_runs` |
| Source budget enforcement | `nodes.py:inspect_content`, `decide_next` | `test_source_budget_enforcement` |
| Deduplication of discoveries across runs | `nodes.py:score_discoveries`, `decide_next` | `test_duplicate_suppression` |
| Watchlist CRUD | `db/models/__init__.py`, `db/models/watchlist.py` | `test_watchlist_crud` |
| Daily discovery CLI entry | `main.py:run_daily_discovery()` | `test_full_research_run_persists` |
| LLM router mocking (integration tests) | `tests/integration/test_phase4_scheduler.py` | All 6 tests |
| Report generation with citations | `nodes.py:build_report`, `db/models/report.py` | `test_report_has_citations` |

## Tests That Passed (verified commands)

```bash
cd backend && python -m pytest tests/integration/test_phase4_scheduler.py -v

# Output (actual):
# test_watchlist_crud ... OK
# test_scheduler_lock_prevents_concurrent_runs ... OK
# test_full_research_run_persists ... OK
# test_duplicate_suppression ... OK
# test_source_budget_enforcement ... OK
# test_report_has_citations ... OK

# 6 passed, 0 failed
```

```bash
cd backend && alembic check

# No model/schema drift detected
```

```bash
cd backend && alembic upgrade head

# Creates all tables successfully (no errors)
```

## Tests That Are Pending / Not Yet Verified

| Test | File | Status |
|------|------|--------|
| Full end-to-end with real DuckDuckGo search | `tests/integration/test_phase4_scheduler.py` | Requires API keys / live network — not run in CI |
| Watchlist-scheduled_run interaction | `db/models/scheduled_run.py` | New model, integration test would need DB fixture |
| Scheduled run persistence across scheduler cycles | `scheduler.py` | Integration test would need DB fixture setup |

## Known Issues

No known issues. All 6 integration tests pass. The `result.complete` condition at `nodes.py:119` was verified to work correctly with the `DiscoveryResult` Pydantic model — it is NOT a bug in the current codebase.

## Last Verified Successful Command

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
# Creates all tables successfully (no errors)
```

## Migrations or Database Changes Requiring Special Care

| Migration | Purpose | Caution |
|-----------|---------|---------|
| `35fd433a99c2_phase_4_add_watchlists_and_scheduled_.py` | Add `scheduled_run` and `watchlist` tables | New migration — run `alembic upgrade head` on fresh DB to verify; existing DBs may need `alembic stamp` before upgrade |
| Previous migrations (Phase 2: `ff73445`) | Source, content_snapshot, claim, evidence, discovery tables | Already applied; no action needed |

## Handoff

See `memory/HANDOFF.md` for the approval boundary and Phase 5 initiation requirements.