# Antigravity — Start Here

Copy and follow this instruction for the first session:

> Read the repository's root AGENTS.md, INSIGHT_AGENT_MASTER_BLUEPRINT.md, docs/ANTIGRAVITY_HANDOFF.md, docs/IMPLEMENTATION_STATUS.md, and docs/database-backup-and-migration.md before proposing changes.
>
> Inspect git status, current branch, HEAD, and its upstream before editing. Compare local and remote state without resetting or overwriting work. Confirm the configured database revision using a read-only connection and verify that the documented backup file exists and can be opened read-only; do not show row contents or secrets. Check the documented temporary migration-copy path, its owner, and whether it is in use before proposing cleanup. Do not alter either the original database or verified backup.
>
> Run only relevant, non-destructive checks. Treat reported test results as historical unless you run them yourself. Compare implementation, migration files, API surface, and configuration with the handoff, and report discrepancies with file/command evidence.
>
> Then present a concise current-state report and a short proposed next-step plan for user approval. Do not make implementation changes in this initial review.
>
> **Prohibitions:** Do not implement Phase 5 unless the user explicitly approves it. Do not implement Phase 6. Do not migrate, overwrite, reset, delete, or recreate the original database. Do not delete the verified backup. Do not integrate Google Drive or change storage behavior. Do not send Telegram messages or expose credentials. Do not commit or push, or change application code, as part of this initial handoff review unless the user separately authorizes that work.
