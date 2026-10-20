# Current Decisions

Authoritative product requirements: INSIGHT_AGENT_MASTER_BLUEPRINT.md. Current implementation state: docs/IMPLEMENTATION_STATUS.md and docs/ANTIGRAVITY_HANDOFF.md. Historical reuse ADRs remain in docs/architecture/decision-log.md.

## Current operational and product decisions

- Keep the structured database local SQLite during the local prototype; do not place the live DB inside Google Drive synchronization.
- Keep active files and cache on local disk. Google Drive API is the preferred future archive direction for selected research files/backups, but design/implementation beyond planning is not authorized.
- The original database remains at revision 35fd433a99c2; repository head is b791c6a48d21. Do not migrate without explicit user authorization.
- Keep the durable verified backup outside Git and do not delete it.
- Phase 5 is ON HOLD for explicit approval. Phase 6 is NOT STARTED and unauthorized.
- PostgreSQL compatibility is UNVERIFIED.
- Preserve source provenance, bounded loops, explicit partial/error reporting, least privilege, and no fabricated findings.

## Historical ADR notes

- LangGraph StateGraph and durable per-node checkpoints are the selected bounded workflow.
- DuckDuckGo is the current web search connector.
- Instagram access remains unimplemented; any access must use authorized, permitted paths.
- Current API and scheduler details are maintained in the Antigravity handoff; do not rely on old statements in historical notes.
