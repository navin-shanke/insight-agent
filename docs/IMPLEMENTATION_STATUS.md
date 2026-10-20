# Implementation Status — Insight Agent

**Blueprint:** [INSIGHT_AGENT_MASTER_BLUEPRINT.md](../INSIGHT_AGENT_MASTER_BLUEPRINT.md)
**Repository:** https://github.com/navin-shanke/insight-agent
**Branch:** `phase-4-dashboard-scheduler` (upstream: `origin/phase-4-dashboard-scheduler`)
**Starting commit for this update:** `e6b8051116b40cb472935f16071ab2696b66ecfb`
**Verification update:** 2026-10-20. The final commit and GitHub synchronization are recorded in the task completion report.

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
| Phase 4 — scheduler lease ownership, renewal, expiry, recovery | A run has an owner token and finite expiry; only that owner may renew/release; a live long-running job renews before expiry; abandoned expired jobs are recoverable; a stale owner cannot continue after takeover. | Implemented with owner-fenced compare-and-set, a 2-minute lease, 20-second heartbeat, expiry recovery, and a transactional write fence. Each research DB write transaction conditionally updates the lease row in the same transaction as its results; a takeover cannot commit first and then be followed by stale worker writes. Stale workers return interrupted and cannot write a final report or release an expired lease. Independent-session regression tests verify takeover fencing, acquisition contention, terminal/expired reacquisition, stale-owner fencing, and heartbeat renewal across lease TTL. This is verified on SQLite only; see PostgreSQL limitation above. |

## Verification performed

Commands run from repository root:

- `.venv\Scripts\python -m pytest backend/tests/integration/test_phase4_scheduler.py backend/tests/integration/test_graph_integration.py backend/tests/integration/test_migrations.py backend/tests/unit/test_graph_routing.py backend/tests/unit/test_llm_router.py -q` — **43 passed** after the final lease-fencing review.
- `.venv\Scripts\python -m pytest -q` — **83 passed**, no failures.
- `git diff --check` — passed (no whitespace errors).

The test suite uses SQLite. No PostgreSQL service was available, and no CI checks were reported by GitHub for this branch. Live web-search and LLM provider behavior are not exercised by the automated suite.

## Remaining limitations

- **Non-blocking verification limitation:** PostgreSQL behavior listed above requires a PostgreSQL test service before claiming server-level compatibility. SQLite coverage is green; do not treat it as PostgreSQL verification.
- **Budget limitation:** Ollama usage is known only after an invocation returns. If a single invocation exceeds the remaining token allowance, the excess cannot be prevented retroactively. Missing usage metadata fails closed before subsequent model work.
- **Cancellation limitation:** cancellation is cooperative and observed at execution boundaries; it cannot terminate a synchronous request already executing. Request timeout bounds the wait for such an invocation.
- Phase 5 remains ON HOLD. Phase 6 was not started.
