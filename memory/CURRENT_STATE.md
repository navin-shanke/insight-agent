# Insight Agent — Current State

**Inspection date:** 2026-10-21

## Git

- Branch: phase-0-audit
- HEAD: fc951c18f317ebf55d80b729a2fb5adb87a1844a
- origin/phase-0-audit: same SHA after fetch; ahead/behind 0/0.
- Tracked working tree was clean before this handoff documentation was created.
- Recent commit fc951c1 adds the database backup/migration runbook.

## Database safety

- Configured default: sqlite+aiosqlite:///./data/insight.db; no DATABASE_URL override in the inspected shell.
- Original data/insight.db exists, SQLite integrity check ok, 11 tables, revision 35fd433a99c2. Repository head is b791c6a48d21. Never migrate without explicit user authorization.
- Durable backup exists at %LOCALAPPDATA%\InsightAgent\backups\insight-20261020T190543Z.sqlite3; read-only verification showed integrity ok, revision 35fd433a99c2, 11 tables.
- Disposable migrated copy still exists at %TEMP%\insight-agent-safety-a4afbfcab3974fccb424ae18c9be11d6\migration-copy.sqlite3; integrity ok, revision b791c6a48d21, 12 tables; ACL owner is the current user. File-open status is unknown, so do not delete pending handle check.
- PostgreSQL compatibility is unverified.

## Application state

- FastAPI only exposes /health/live and /health/ready. Readiness is a constant response.
- Bounded research and daily watchlist scheduler are backend/CLI capabilities; no dashboard/API endpoints or Telegram integration.
- See docs/IMPLEMENTATION_STATUS.md and docs/ANTIGRAVITY_HANDOFF.md. Test results there are historical unless a new command is recorded.
- Phase 5 ON HOLD. Phase 6 NOT STARTED and unauthorized. Google Drive direction planning only.
