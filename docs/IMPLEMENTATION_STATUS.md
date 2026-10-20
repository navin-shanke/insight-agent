# Implementation Status — Insight Agent

**Blueprint:** [INSIGHT_AGENT_MASTER_BLUEPRINT.md](../INSIGHT_AGENT_MASTER_BLUEPRINT.md)
**Repository:** https://github.com/navin-shanke/insight-agent
**Branch:** `phase-4-dashboard-scheduler` (upstream: `origin/phase-4-dashboard-scheduler`)
**Baseline for this verification:** `41fd9202c644698c77f7b0d16a9017c9922f3dbc` (fetched; branch was clean and equal to upstream)
**Verification update:** 2026-10-20. See GitHub report in the task completion summary for resulting commit and push verification.

## Current status

Phases 3 and 4 are **not complete** against their blueprint exit criteria. Phase 3 has a working research graph and checkpoint/resume path, but required cancellation behavior and some budget/time-window semantics are not demonstrated. Phase 4 has watchlist persistence and callable daily discovery, but it is not a complete daily discovery service: watchlists are not consumed by the run, no recurring trigger/digest/coverage pipeline is present, and time-window filtering and robust duplicate suppression are not demonstrated. The dashboard and Telegram requirements belong to Phase 5 and remain on hold.

Phase 5 is ON HOLD. Phase 6 has NOT started.

## Requirement map and evidence

| Phase | Requirement | Status | Evidence / gap |
|---|---|---|---|
| 3 | Typed bounded research workflow | Partial | `backend/app/agents/graph.py`, `nodes.py`; integration path is tested, but deadline/token/spend enforcement needs a dedicated audit and tests. |
| 3 | Claim extraction, verification, ranking, cited report | Partial | Nodes and persisted claim/evidence/report models exist; graph integration tests pass, but meaningful independent-source verification and citation integrity are not fully asserted. |
| 3 | Durable checkpoints and resume | Implemented, tested | `task_checkpoints`; `test_checkpoint_resume` exercises a completed graph resumed from its saved state. Recovery from interruption mid-node is not proven. |
| 3 | Cancellation and partial-result semantics | Incomplete | Status values exist, but no cancellation request/control path was found. |
| 4 | Watchlist persistence | Implemented, tested | `Watchlist` model and CRUD persistence test. Scheduled discovery currently takes explicit query/topics and does not load enabled watchlists. |
| 4 | Scheduled discovery, locking, recovery | Partial | Callable run with DB lock. SQLite independent-session contention tests pass. PostgreSQL behavior is implemented with its dialect upsert but was not exercised against PostgreSQL. Six-hour lock lease recovers abandoned runs; there is no lease heartbeat, so a live run exceeding six hours could overlap after expiry. |
| 4 | Duplicate suppression | Incomplete | Existing test compared aggregate counts only; it did not prove stable deduplication. No verified delivered-finding identity/update policy. |
| 4 | Time-window filtering, duration/cost limits, coverage metrics, digest | Incomplete | No completed end-to-end implementation/test evidence found for these Phase 4 blueprint requirements. |
| 5 | Dashboard and Telegram | ON HOLD | Not started as part of this work. |
| 6 | Hardening/cloud deployment | NOT STARTED | Explicitly out of scope. |

## Verification performed on this update

Commands executed from repository root:

- `.venv\Scripts\python -m pytest backend/tests/integration/test_phase4_scheduler.py -q` — **10 passed**.
- `.venv\Scripts\python -m pytest backend/tests/integration/test_graph_integration.py backend/tests/integration/test_migrations.py backend/tests/integration/test_phase4_scheduler.py -q` — **15 passed**.
- `.venv\Scripts\python -m pytest backend/tests -q` — **69 passed**, no skips, no failures.

The full suite initially exposed five failures: three graph integration tests invoked async `run_research` without awaiting it, and the SQLite migration used unsupported direct `ALTER TABLE` syntax while the migration drift test targeted a stale default database. Tests were corrected to await the async entry point; SQLite uses Alembic batch alteration; migration drift now runs against a fresh migrated temp database. The final commands above were rerun and passed. These results establish SQLite behavior only; PostgreSQL was not available for verification.

## Changes in this verification update

- `backend/app/services/scheduler.py`: replaced broad exception catching and unbounded recursive retry with SQLite/PostgreSQL `INSERT ... ON CONFLICT DO NOTHING` plus a conditional atomic update. Added a six-hour lease and terminal/expired reacquisition.
- `backend/tests/integration/test_phase4_scheduler.py`: added independent-session contention coverage for first acquisition and completed/failed reacquisition, plus stale lease recovery.
- `backend/db/alembic/versions/35fd433a99c2_phase_4_add_watchlists_and_scheduled_.py`: use SQLite batch alteration for reports ID type migration; keep direct alteration for PostgreSQL.
- `backend/tests/integration/test_graph_integration.py`: await the async research graph in integration tests.
- `backend/tests/integration/test_migrations.py`: verify schema drift against a fresh migrated SQLite database.

## Limitations and next work

**Blocking for Phase 3/4 completion:** implement or explicitly defer cancellation; consume enabled watchlists; define and enforce a time window and run-duration/cost bounds; implement coverage and digest output; establish real duplicate suppression semantics and tests; validate lock behavior against PostgreSQL before making production-database guarantees.

**Non-blocking for this local verification:** SQLite test suite is green. No CI run was initiated. Live search/LLM results are not part of this update's test run.

Phase 5 remains ON HOLD and Phase 6 was not started.
