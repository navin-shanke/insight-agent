# Insight Agent — Project Overview

The canonical project instructions are in root AGENTS.md. See docs/ANTIGRAVITY_HANDOFF.md for the detailed current state, and INSIGHT_AGENT_MASTER_BLUEPRINT.md for product requirements.

## Purpose and boundaries

Insight Agent is a local-first personal research agent intended to discover useful information, investigate accessible sources, contextualize claims with evidence, preserve provenance, and produce bounded reports and scheduled digests. It must respect access policies, avoid fabricated results, and expose partial/failed coverage honestly.

## Verified technology and layout

- Python 3.12+ project described in pyproject.toml.
- FastAPI API shell and CLI: backend/app/main.py.
- LangGraph workflow: backend/app/agents/graph.py and nodes.py.
- Persistence: SQLAlchemy models in backend/app/db/models and Alembic migrations in backend/db/alembic.
- Scheduler/watchlists/leases: backend/app/services/scheduler.py.
- Connector/fetch: DuckDuckGo in backend/app/connectors and SSRF-conscious fetcher in backend/app/fetcher.
- Local SQLite default: data/insight.db. The original is behind Alembic head; see database runbook.
- Current API only has liveness and constant-success readiness endpoints.
- No frontend, Telegram adapter, Instagram adapter, Google Drive adapter, or external worker has been found.

## Phase status

| Area | Status |
|---|---|
| Phases 1–2 foundation/contracts | Implemented in repository; see implementation docs for evidence |
| Phase 3 research workflow | Backend implementation and historical tests reported complete; PostgreSQL unverified |
| Phase 4 daily discovery | Backend implementation and historical tests reported complete; database original remains behind migration head |
| Phase 5 dashboard and Telegram | ON HOLD; requires explicit user approval |
| Phase 6 hardening/cloud deployment | NOT STARTED; unauthorized |
| Google Drive archive | Planning only; no integration or storage change authorized |

Local-first storage decision: SQLite for structured records, local disk for active cache/files, possible Google Drive API for selected archive objects and backup copies. Do not sync the live SQLite DB through Drive. Keep secrets in local protected storage and out of archives/Git.
