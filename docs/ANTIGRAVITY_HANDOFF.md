# Insight Agent — Antigravity Project Handoff

**Verified:** 2026-10-21 (Windows local workspace; documentation-only inspection). Historical test evidence is labeled as reported, not rerun here.

## 1. Project overview

Insight Agent is intended as a local-first, single-user research assistant: discover useful developments, inspect accessible sources, extract and contextualize claims, preserve provenance, and create bounded cited research reports and daily discovery digests. It should expose honest progress, coverage, partial results, and errors as product surfaces are built.

Current non-goals include unrestricted crawling, bypassing access controls, fabricated data, automatically liking/following/posting/DMing, exposing private personal data, and beginning unapproved phases. There is no dashboard or Telegram delivery in the repository today.

## 2. Current repository state

- Repository: https://github.com/navin-shanke/insight-agent
- Branch: phase-0-audit
- HEAD: fc951c18f317ebf55d80b729a2fb5adb87a1844a
- Upstream: origin/phase-0-audit, same SHA after fetch; ahead/behind 0/0.
- Tracked working tree was clean before this handoff edit. The only pending changes for this task should be the documentation and memory files listed in the final report.
- Recent commits: fc951c1 safe SQLite backup/migration runbook; 7de5465 CLI dispatch and post-merge smoke; 62547f2 Phase 3/4 PR merge record; c6c3aee merge of PR #2. PR #2 is merged; this handoff does not reopen it.
- There is no root README, .github/workflows CI definition, frontend directory, or deployment configuration in the current repository listing. Existing guidance is in the blueprint, docs, and memory/.

## 3. Architecture and data flow

This is a Python 3.12+ project (see pyproject.toml) using FastAPI, SQLAlchemy, Alembic, Pydantic, LangGraph, DuckDuckGo (ddgs), BeautifulSoup, and a local Ollama model through ModelRouter. SQLite is the active local database default. Hosted-LLM configuration fields exist, but multi-provider routing is not established as implemented. No Instagram connector, browser automation, Telegram client, Drive adapter, frontend, persistent task queue, or external worker service was found.

backend/app/main.py is both the API factory and CLI dispatcher. The graph in agents/graph.py runs the node sequence in agents/nodes.py; ResearchService persists sources, snapshots, claims, evidence, discoveries, reports, checkpoints, and cancellation requests. DuckDuckGo search results pass through the common connector schema; fetcher/safe_fetch.py validates external fetch targets and extracts text. SchedulerService builds bounded runs from enabled watchlists, persists digest/coverage, and uses owner-token leases, heartbeat renewal, and a transaction write fence.

Research flow: task state/checkpoint → plan → search → normalize → inspect/fetch → extract claims/evidence → contextualize/score → persist discoveries → decide whether to continue → cited Markdown report or partial terminal result. Scheduled flow: load enabled watchlists and configured query terms → acquire/renew owner-fenced lease → bounded research → persist outcome/coverage/digest → release only while lease ownership remains valid.

The actual HTTP API currently has only GET /health/live, GET /health/ready, and generated OpenAPI/docs paths. There are no HTTP task, discovery, report, watchlist, cancellation, integration-status, auth, or dashboard endpoints. /health/ready is a constant {"status":"ready"} response, not a dependency probe.

## 4. Implemented work

| Work area | Status | Qualification |
|---|---|---|
| Phase 1 foundation | DONE | Current repository contains Python/FastAPI and persistence foundation |
| Phase 2 contracts/connectors | DONE | DuckDuckGo connector, schemas, safe fetch, and migrations are present |
| Phase 3 research backend | DONE | Implemented; automated test results are historical, PostgreSQL is unverified |
| Phase 4 scheduler backend | DONE | Implemented; configured original DB remains behind Alembic head |
| User-facing dashboard / REST research API | PARTIAL | Only health endpoints exist; task/discovery/report/watchlist APIs and UI are absent |
| Telegram delivery | NOT STARTED | Settings exist; integration and outbox/retries do not |
| PostgreSQL verification | UNVERIFIED | No server-backed migration/concurrency run |
| Original DB migration to current head | BLOCKED | Requires explicit user authorization and maintenance plan |
| Phase 5 implementation | ON HOLD | Explicit user approval required |
| Phase 6 implementation | NOT STARTED | Unauthorized; do not begin |
| Google Drive storage | PLANNING ONLY | No integration or storage change authorized |

The implementation status document records Phases 1–4 as built through the current codebase and reports automated evidence for Phase 3/4. Phase 3 code includes bounded LangGraph research, checkpoint persistence/resume path, cooperative cancellation, source-grounded reports, duration/iteration/source/token budget controls, and durable task records. Phase 4 code includes watchlist-backed scheduled discovery, time-window and run limits, dedupe, persisted coverage/digest, recurring scheduler CLI, and owner-fenced renewable scheduler leases.

CLI subcommands in main.py include serve, daily-discovery, scheduler, list-running-research, and cancel-research <task UUID>. The recurring scheduler is long-running; do not start it in an initial review. Cancellation is cooperative and cannot interrupt an in-flight synchronous model request.

Tests present: unit tests for schemas, state, graph routing, CLI, LLM router, connectors, URL normalization, and SSRF; integration tests for graph, persistence, migrations, and scheduler. docs/IMPLEMENTATION_STATUS.md reports 23 focused DB integration tests and 86 full-suite tests from the preceding safety-gate work; these were NOT rerun during this handoff. Earlier status reported 29 focused tests and 86 full tests after the CLI fix. Use the newest recorded run (23 / 86) as historical evidence, not a fresh run.

## 5. Partially implemented work

- Phase 3/4 backend capability does not imply a usable end-user application: there is no task or findings HTTP API and no UI.
- Model configuration contains hosted-provider settings, but source code routes to Ollama; multi-provider failover/cost optimization is not complete.
- Telegram settings are present in config, but no Telegram integration/outbox/retry code exists.
- Watchlists and run data are database/CLI-level, not manageable through HTTP/UI.
- The application contains one DuckDuckGo connector. Instagram and other candidate sources remain absent.
- Schema migration is implemented in Alembic, but the configured real SQLite database has not been brought to repository head.
- Dependencies for a fresh environment are not fully represented in pyproject.toml: source imports ddgs and langchain_ollama and tests import pytest, but the checked-in dependency list does not declare them. Verify/install compatible packages and update the manifest only as a separately scoped task. The existing .venv is environment-specific.

## 6. Unverified items

- PostgreSQL migration/backfill, concurrent lease/dedupe/cancellation semantics, and timezone timestamp round-tripping have not been verified against a PostgreSQL service.
- GitHub CI is unverified; no workflow definition was present in this checkout. Prior reports noted no PR checks, but no new CI query was performed here.
- Deployment readiness, authentication, worker isolation, backup automation, and production recovery are not established.
- Live web search/model behavior has been exercised in a prior bounded smoke according to IMPLEMENTATION_STATUS.md; it was not rerun in this handoff and is not an automated test guarantee.
- /health/ready does not verify database/model/search dependencies.
- Fresh installation reproducibility needs review because the checked-in manifest does not clearly declare all imported/test packages.

## 7. Known limitations and defects

- No root README; use the commands below and configuration in .env.example.
- Only health HTTP endpoints are exposed. Research and scheduling are CLI/service capabilities, not REST endpoints.
- Readiness returns constant success.
- data/insight.db is behind Alembic head; ResearchService metadata create_all does not replace the migration process for existing tables.
- Budget usage is known after model responses, so a single call can exceed remaining token budget. Missing usage metadata stops subsequent model work. Cancellation is cooperative.
- No dashboard, Telegram, authentication implementation, Google Drive, or PostgreSQL verification.
- No live/perpetual scheduler was launched in the handoff review.

## 8. Database safety and evidence

Current configuration was read from backend/app/core/config.py: sqlite+aiosqlite:///./data/insight.db, with no DATABASE_URL override in the inspected shell. Original path: data/insight.db. On this handoff inspection it existed, was 532,480 bytes, passed SQLite integrity_check, had 11 tables, and was still at revision 35fd433a99c2; repository Alembic head is b791c6a48d21. Do not migrate the original without explicit user authorization.

The durable backup exists at %LOCALAPPDATA%\InsightAgent\backups\insight-20261020T190543Z.sqlite3. This inspection confirmed it exists, opens read-only, passes integrity, remains at 35fd433a99c2, and has 11 tables. The 2026-10-21 safety-gate runbook records that it matched all table counts with the original (147 total rows) and that a separate restored copy reached head preserving listed research counts. See docs/database-backup-and-migration.md for the procedure and historical detailed counts.

The temporary migrated copy still exists under %TEMP%\insight-agent-safety-a4afbfcab3974fccb424ae18c9be11d6\migration-copy.sqlite3; this inspection confirmed it opens read-only, passes integrity, and is at b791c6a48d21 with 12 tables. Its ACL owner matches the current Windows user. The cleanup command was rejected in the preceding task. No Python process from this project's .venv was seen, but an open-handle check was not completed; leave it in place until its use is checked. Do not expose any DB rows or delete this file/backup as part of initial review.

PostgreSQL remains explicitly unverified. The original database migration remains pending separate explicit authorization.

## 9. Storage architecture decision

The selected direction is local-first: SQLite remains on local disk; active files/cache remain on the PC; a future Google Drive API adapter may archive selected reports, valuable evidence, selected source documents, and versioned backups. The user estimates 100–500 GB local storage is available; this has not been measured in the handoff. Never put the live SQLite database in a synced Drive folder. Drive adapter, OAuth scopes/token storage, resumable upload, checksums, deduplication, queue/retries, quotas/offline sync, retrieval, and restoration are all planning-only; no implementation or storage behavior change is authorized. Keep OAuth credentials local/protected and out of Git and archives. Archive scope should start conservative (reports/evidence/selected docs) and be approved after usage and retrieval costs can be measured.

## 10. Remaining roadmap and acceptance criteria

1. Finish handoff validation: new agent compares this document with code, branch, database, backup, and temp copy read-only; discrepancies are reported before any edits.
2. Database operational decision: after explicit authorization only, plan a maintenance window, fresh verified backup, migration of the real DB, schema/integrity/count checks, and restore readiness. PostgreSQL server testing is a separate prerequisite for PostgreSQL claims.
3. Phase 5 — ON HOLD: only after explicit user approval. Ordered work: (a) define authenticated API contracts for task creation/detail/progress/cancellation, discoveries, reports with source citations, watchlist management, and integration status; (b) build dashboard overview, jobs/progress, discovery filters, report/evidence/coverage, watchlists, and settings/integration/error states; (c) add Telegram configuration in protected local secrets, digest preview/approval boundary as specified by the user, delivery outbox, idempotency keys, retries, and visible failure state. Acceptance: API contract tests cover lifecycle/cancel/pagination/access controls; UI tests cover loading/empty/partial/error and source citations; Telegram tests prove no duplicate delivery after retry and expose exhausted failures; secret values never enter logs or Git; bounded end-to-end test verifies a persisted task through a cited report/digest without sending an unapproved external message. Existing backend lacks these REST endpoints and UI pages.
4. Google Drive file archive — planning only: separate approval required. Acceptance should include local-first operation without Drive, minimal OAuth scope, dedicated archive, checksummed/deduplicated resumable uploads, retry and quota/offline behavior, metadata persistence, verified download, and a tested versioned backup/restore path. Never store the live SQLite DB in Drive sync.
5. Phase 6 — NOT STARTED / unauthorized: do not begin. Future hardening/deployment work needs explicit approval and separately verified PostgreSQL, auth/secrets, worker/queue, health monitoring, retention, and recovery.

## 11. Commands and environment

Commands below were confirmed against current manifests/source or are the previously used local Windows commands. Running tests again is optional for the initial handoff review; the results above are historical.

Fresh-environment setup is not verified because the manifest may omit imported runtime/test dependencies. These are the base project commands from pyproject.toml only, not a promise that all integrations/tests install:

~~~powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e .
~~~

~~~powershell
# Run from repository root, using the existing project virtual environment.
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe -m pytest backend\tests\integration\test_migrations.py backend\tests\integration\test_persistence.py backend\tests\integration\test_phase4_scheduler.py -q
.\.venv\Scripts\insight-agent.exe serve
.\.venv\Scripts\insight-agent.exe list-running-research
# Only for a bounded, explicitly intended research run; this may call real integrations:
.\.venv\Scripts\insight-agent.exe daily-discovery --query "<bounded topic>" --source-budget 5 --max-iterations 1 --time-budget-seconds 120 --token-budget 1000
.\.venv\Scripts\insight-agent.exe cancel-research <task-uuid>
git status --short --branch
git diff --check
git fetch origin
git rev-list --left-right --count HEAD...origin/phase-0-audit
~~~

Do not start insight-agent.exe scheduler during initial review; it runs perpetually. No full clean-environment setup was proven in this handoff, and pyproject.toml should be reconciled with imported runtime/test dependencies before promising a fresh install.

### Disposable database migration only

Use the verified script in docs/database-backup-and-migration.md. Before .venv\Scripts\python.exe -m alembic upgrade head, confirm DATABASE_URL points to a new restored copy, not data/insight.db. alembic current, alembic heads, and SQLite metadata checks can be performed read-only. Never run upgrade head against the original without explicit authorization.

## 12. First task for Antigravity

Validate this handoff and report discrepancies using read-only inspection. Do not implement features or modify application code. Then propose a short next-step plan and wait for the user to approve work that crosses a phase/database boundary.

## 13. Session resume checklist

1. Read root AGENTS.md, this handoff, the master blueprint, implementation status, and database runbook.
2. Check git status --short --branch, git rev-parse HEAD, upstream SHA, and ahead/behind.
3. Confirm no unstaged/untracked user work is about to be overwritten.
4. Verify original DB and backup path exist with read-only metadata checks; do not show rows or migrate either.
5. Inspect the temporary migration copy's owner/open-handle status before proposing cleanup; do not delete it during initial review.
6. Compare actual API/config/modules and test files against this document. Tests are historical unless rerun.
7. Report inconsistencies and propose work. Wait for approval before Phase 5, Phase 6, Drive implementation, or original database migration.
