# Implementation Status — Insight Agent

**Blueprint:** [INSIGHT_AGENT_MASTER_BLUEPRINT.md](../INSIGHT_AGENT_MASTER_BLUEPRINT.md)
**Repository:** https://github.com/navin-shanke/insight-agent
**Branch:** `phase-0-audit` (upstream: `origin/phase-0-audit`)
**Merged PR:** [#2](https://github.com/navin-shanke/insight-agent/pull/2) — merged 2026-10-21.
**PR merge commit:** `c6c3aeedc7d62f9ac8e1f6ec09562749dfe51bf3`
**Starting commit for this update:** `e6b8051116b40cb472935f16071ab2696b66ecfb`
**Verification update:** 2026-10-21. PR #2 was merged to `phase-0-audit`; local post-merge smoke results are recorded below.

## Phase scope

Phase 3 and Phase 4 work in this update covers cancellable research, watchlist-driven scheduled discovery, bounded runs, evidence-backed coverage/digest, duplicate suppression, and scheduler lease safety. Phase 5 is **ON HOLD**. Phase 6 has **NOT STARTED**.

## Acceptance criteria and evidence

| Requirement | Acceptance criteria | Result and evidence |
|---|---|---|
| Phase 3 — cancellation of running research | A running task can be listed and cancellation requested durably; the graph observes the request at safe node/yield boundaries, persists a cancelled checkpoint, and does not continue into report generation. | Implemented in `ResearchService` and graph checkpoint/control flow. `test_running_research_can_be_cancelled` exercises cancellation of an active graph and asserts the persisted terminal state. Cancellation is cooperative: an in-flight synchronous model call cannot be interrupted mid-request. Ollama HTTP calls have a configured request timeout; retries may extend time to observe cancellation. |
| Phase 4 — scheduled runs consume watchlists | Each enabled watchlist is loaded by the scheduled discovery path; configured topics/keywords produce actual queries; disabled lists are excluded; unsupported source preferences are reported. | Implemented by `SchedulerService.run_daily_discovery`; tests cover enabled watchlist query construction and unsupported preferences. The recurring CLI scheduler honors `DAILY_DISCOVERY_ENABLED` and the configured daily time. |
| Phase 3/4 — time windows and budgets | Research and scheduled paths enforce candidate/source, investigation, iteration, token and duration bounds; scheduled discovery excludes known stale publications and records unknown dates rather than silently treating them as fresh. | Direct research caps: 100 sources, 20 investigations, 5 iterations, 50,000 reported tokens and 45 minutes. Scheduled discovery applies configured daily caps and the 24-hour publication window. Tests cover stale-date filtering, budget/deadline stopping, and token-usage fail-closed behavior. Token usage must be reported by Ollama; when absent, the graph marks coverage partial and stops further model work. A request already executing can use more than the remaining token allowance before its usage is known; strict provider-side hard token reservation is not available in this implementation. |
| Phase 4 — evidence-backed coverage and digest | Persisted digest entries link to actual persisted discoveries and canonical source URLs; coverage reports observed query/source/fetch/watchlist/job outcomes, unknown publication dates, and budget/token completion information. | Implemented in scheduled-run result persistence (`digest_md`, `coverage_json`). Integration tests assert digest citations against stored discovery/source records and coverage fields against the run results. A search result without a known publication date is retained as a candidate but explicitly counted as date-unknown. |
| Phase 3/4 — duplicate suppression | Repeated equivalent claims from different URLs/runs map to one stable discovery identity while preserving all source links; concurrent insert behavior is atomic for the supported SQLite/PostgreSQL dialects. | Implemented with normalized claim/category SHA-256 `dedupe_key`, unique constraint and conflict-safe insert; source links are idempotent. Cross-run regression test submits the same claim via distinct URLs and asserts one discovery with both source links. Historical duplicates are preserved by migration backfill with deterministic keys; migration does not merge or delete existing records. |
| Phase 4 — PostgreSQL compatibility | Run migrations and independent-session lease/dedupe/cancellation tests against a real PostgreSQL test service before claiming PostgreSQL runtime verification. | **Not verified against a PostgreSQL server.** At verification time there was no `POSTGRES_TEST_URL` or `DATABASE_URL`, no `psql` or PostgreSQL Python driver available, and Docker daemon was unavailable. Exact unverified behavior: actual PostgreSQL migration upgrade/backfill; database-level concurrent `INSERT ... ON CONFLICT` behavior for cancellation, dedupe and scheduler acquisition; conditional lease update/renewal row counts under concurrent sessions; and timestamp/time-zone round-tripping for lease expiry. SQLite integration tests do not establish those server behaviors. |
| Phase 3/4 — CLI entry-point and cancellation commands | The installed `insight-agent` entry point dispatches documented subcommands; cancellation accepts a UUID and persists through the configured database. | Fixed `main()` to dispatch the CLI parser while retaining no-argument server launch; imported `uuid` for cancellation. Unit tests cover subcommand dispatch, UUID conversion/database URL, and default server behavior. A post-merge smoke invoked the installed console script for `--help`, `list-running-research`, and `cancel-research`. |
| Phase 4 — scheduler lease ownership, renewal, expiry, recovery | A run has an owner token and finite expiry; only that owner may renew/release; a live long-running job renews before expiry; abandoned expired jobs are recoverable; a stale owner cannot continue after takeover. | Implemented with owner-fenced compare-and-set, a 2-minute lease, 20-second heartbeat, expiry recovery, and a transactional write fence. Each research DB write transaction conditionally updates the lease row in the same transaction as its results; a takeover cannot commit first and then be followed by stale worker writes. Stale workers return interrupted and cannot write a final report or release an expired lease. Independent-session regression tests verify takeover fencing, acquisition contention, terminal/expired reacquisition, stale-owner fencing, and heartbeat renewal across lease TTL. This is verified on SQLite only; see PostgreSQL limitation above. |

## Verification performed

Commands run from repository root:

- `.venv\Scripts\python -m pytest backend/tests/unit/test_main_cli.py backend/tests/integration/test_graph_integration.py backend/tests/integration/test_phase4_scheduler.py backend/tests/integration/test_migrations.py -q` — **29 passed** after the post-merge CLI fix.
- `.venv\Scripts\python -m pytest -q` — **86 passed**, no failures.
- `git diff --check` — passed (no whitespace errors).

The test suite uses SQLite. No PostgreSQL service was available, and no CI checks were reported by GitHub for this branch. Live web-search and LLM provider behavior are not exercised by the automated suite.

## Post-merge local smoke (2026-10-21)

- The repository has no `README.md` launch guide. The installed `insight-agent` command is defined in `pyproject.toml`; after installing the local project editable, `.venv\Scripts\insight-agent.exe serve` started Uvicorn on a test-only port. `GET /health/live` returned **200** `{"status":"alive"}`; `GET /health/ready` returned **200** `{"status":"ready"}`; `GET /api/v1/openapi.json` returned **200**, title `Insight Agent`, and only `/health/live` and `/health/ready` paths.
- `/health/ready` currently returns a constant success response; it does not check database or model/search dependencies.
- The configured `data/insight.db` opened read-only at Alembic revision `35fd433a99c2`. It is behind head `b791c6a48d21`: its `scheduled_runs` table lacks lease/digest columns and `research_cancellations` is absent. The original file was not changed. A SQLite backup copy upgraded successfully to `b791c6a48d21`, including the cancellation table.
- DuckDuckGo health check returned `READY`; a real two-result search succeeded. Local Ollama `/api/tags` returned HTTP 200 with four installed models. Bounded research ran against disposable migrated SQLite databases and real DDG/Ollama integrations. One attempt persisted 10 checkpoints and one report, with 2 discovered/1 inspected source but no discoveries. A second attempt ended `partial` (`investigation_budget_exhausted`) and persisted 15 checkpoints, 4 sources, 15 claims, 15 evidence records, 13 discoveries, and 13 discovery/source links; it did not persist a report. Both runs used explicit source, iteration, investigation, token, timeout, and disposable-database bounds. All disposable files were removed.
- A bounded scheduler invocation with one enabled and one disabled disposable watchlist processed only the enabled list, issued query `FastAPI smoke health check`, returned `partial` under a zero-token budget, and persisted one scheduled-run row. The perpetual scheduler was not started.
- The installed CLI listed a disposable running task and `cancel-research <UUID>` returned success; one cancellation row was verified in the disposable database. Disposable CLI data was removed.
- `main()` now dispatches installed CLI subcommands and retains no-argument server startup; `cancel_research_task` now has the missing `uuid` import. Regression tests passed. The local console script was installed editable for launch verification; this did not change tracked dependency files.

## Remaining limitations

- **Non-blocking verification limitation:** PostgreSQL behavior listed above requires a PostgreSQL test service before claiming server-level compatibility. SQLite coverage is green; do not treat it as PostgreSQL verification.
- **Budget limitation:** Ollama usage is known only after an invocation returns. If a single invocation exceeds the remaining token allowance, the excess cannot be prevented retroactively. Missing usage metadata fails closed before subsequent model work.
- **Cancellation limitation:** cancellation is cooperative and observed at execution boundaries; it cannot terminate a synchronous request already executing. Request timeout bounds the wait for such an invocation.
- Phase 5 remains ON HOLD. Phase 6 was not started.
+
## Database safety gate follow-up (2026-10-21)

A documentation-only handoff inspection freshly confirmed the configured original at revision 35fd433a99c2 (SQLite integrity check returned ok, 11 tables), and the durable backup exists and independently passes integrity at the same revision (11 tables). The backup remains outside the repository. The temporary migrated copy also still exists; it passes integrity at b791c6a48d21 and has 12 tables. Its ACL owner was the current Windows user. An open-handle check was not completed, so the file was deliberately left in place. No application database was migrated in this follow-up. See docs/ANTIGRAVITY_HANDOFF.md and docs/database-backup-and-migration.md.
