# Handoff

For a new coding agent, begin with root AGENTS.md, then read docs/ANTIGRAVITY_START_HERE.md and docs/ANTIGRAVITY_HANDOFF.md. Current implementation evidence is in docs/IMPLEMENTATION_STATUS.md. Database operations are in docs/database-backup-and-migration.md.

## Boundaries

- Phase 5 is ON HOLD pending explicit user approval.
- Phase 6 has NOT STARTED and must not be implemented.
- Google Drive is a planning-only storage direction; no integration or storage behavior changes are authorized.
- Never migrate the original data/insight.db without explicit user authorization. The verified backup must not be deleted.
- The migrated temporary copy still exists; its owner was checked, but open-handle status is unknown. Do not delete it until that status is checked.
- PostgreSQL compatibility remains unverified.
- Treat historic test outcomes as reported evidence unless freshly rerun.

The detailed handoff asks the next agent to validate code/docs read-only, report discrepancies, and propose a plan for user approval before doing implementation work.
