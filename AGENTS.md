# Agent instructions for Insight Agent

Read this file before making repository changes. The detailed, dated technical handoff is docs/ANTIGRAVITY_HANDOFF.md; current implementation evidence is docs/IMPLEMENTATION_STATUS.md; database operations are governed by docs/database-backup-and-migration.md. The product plan remains INSIGHT_AGENT_MASTER_BLUEPRINT.md.

## User preferences and safety boundaries

- Prefer consolidated, actionable work with evidence over repeated audits or unnecessary refactors.
- Preserve existing work, behavior, and user data. Inspect Git state and relevant files before editing.
- Ask before destructive operations or crossing explicit approval boundaries.
- Never expose secrets, OAuth tokens, API keys, database contents, or private user information.
- Use the Windows PowerShell and Python environment in the project when available. Do not claim checks were run unless they were run in this session.
- Keep changes tightly scoped; inspect the complete diff and run git diff --check.

## Explicit phase and database boundaries

- Phase 5 is ON HOLD until the user explicitly authorizes implementation.
- Phase 6 has NOT STARTED and is not authorized. Do not implement it.
- Google Drive is a preferred future archive direction for planning only. Do not add its API, OAuth, upload queue, or alter storage behavior without separate authorization.
- The configured SQLite database is data/insight.db, historically at Alembic revision 35fd433a99c2; it is behind repository head b791c6a48d21. Never migrate, overwrite, reset, recreate, or delete it without explicit authorization.
- A verified backup is stored outside the repository at %LOCALAPPDATA%\InsightAgent\backups\insight-20261020T190543Z.sqlite3. Verify it exists before relying on it. Do not delete it.
- A migrated disposable database was found under %TEMP%\insight-agent-safety-a4afbfcab3974fccb424ae18c9be11d6\migration-copy.sqlite3; it passed integrity at b791c6a48d21. Its Windows ACL owner was the current user. Whether a process has an open handle was not verified; do not delete it until that is checked.
- PostgreSQL migration, concurrency, and timestamp behavior remain UNVERIFIED. SQLite test results do not establish PostgreSQL compatibility.

## Verified repository orientation (2026-10-21)

- Active branch: phase-0-audit; local HEAD and origin/phase-0-audit were both fc951c18f317ebf55d80b729a2fb5adb87a1844a, with a clean tracked worktree at inspection.
- Python project is described by pyproject.toml; application code and tests live under backend/app and backend/tests. There is no root README, frontend, Telegram adapter, or Google Drive adapter.
- Current API only exposes /health/live and /health/ready; readiness returns a constant success response and does not check dependencies.
- Main modules: agents/graph.py, agents/nodes.py, agents/service.py, services/scheduler.py, connectors/duckduckgo.py, fetcher/safe_fetch.py, llm/router.py, db/models/, and main.py.
- Local virtual environment commands: .\.venv\Scripts\python.exe -m pytest -q, .\.venv\Scripts\insight-agent.exe serve, and .\.venv\Scripts\python.exe -m alembic heads. Before Alembic migration commands, prove that DATABASE_URL targets a disposable copy; never point an upgrade at the configured original without explicit authorization.

For first-session steps, use docs/ANTIGRAVITY_START_HERE.md. Treat dates, test results, and environment observations in documentation as historical unless freshly verified.
