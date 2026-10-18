# Architecture Decision Record — Insight Agent

**Source of truth:** `INSIGHT_AGENT_MASTER_BLUEPRINT.md`
**Status:** Phase 0 (Audit and Choose the Foundation) — decisions recorded below
**Date:** 2026-10-19

## ADR-001: Foundation selection — build fresh; candidates as design references only

**Decision:** Do not adopt any candidate repository as the foundation, dependency, or wrapped service. Build Insight Agent fresh per Blueprint Part III (Python/FastAPI + LangGraph + SQLAlchemy 2.x + Alembic; SQLite local prototype, PostgreSQL production; React dashboard; Telegram delivery).

**Rationale:** None of the six audited candidates is a complete match for the target architecture or the MVP scope:

| Candidate | Language | Closest fit | Blocker to foundation adoption |
|---|---|---|---|
| Jev Social | Node.js | read-only browser social research | External `socai CLI` binary + OpenRouter key + real Chrome session; not a Python library; not self-hostable in a worker |
| Agent Reach | Python | connector routing + health checks | Capability layer (agents call CLI tools directly); no typed connector contract; Instagram requires desktop Chrome + OpenCLI extension or gated Graph API |
| OpenMagpie | Python/Django | scheduling + semantic filtering | Instagram not supported (roadmap only); ships `challenge_bypass.py` (policy risk); full app with own scheduler/DB |
| AI Search Agent | Python/FastAPI/LangGraph | bounded deep-research graph | No persistence, no Instagram, no claims, no scheduler/Telegram/dashboard; unverified license; SSRF-unsafe fetcher |
| Research Agent | Python/LangGraph | LangGraph planner→reporter | No Instagram, no claims, no SQLAlchemy schema, no scheduler; unverified license (README claims MIT, no LICENSE file) |
| Instagram Agent Skill | — | content-creation prompts only | Explicitly not research/posting; reject as core |

**Consequences:**
- Reuse outcomes assigned:
  - Jev Social → D (design reference: read-only allowlist, typed decision validation, evidence sanitization/redaction, partial-result checkpointing, source-linked report shape)
  - Agent Reach → D (design reference: ordered backend primary/fallback, `doctor` health checks, safe/dry-run install, cookie extraction)
  - OpenMagpie → D (design reference: single-flight per-stage ticker, feed/watch/action-chain, semantic_filter, at-least-once delivery dedup)
  - AI Search Agent → D (design reference); possible outcome C port of LangGraph node/state/tool + structured Pydantic output after license confirmation; fetcher must be rewritten for SSRF safety
  - Research Agent → D (design reference: planner→executor→summariser→reporter split, map-reduce summarization, Jinja2 reports)
  - Instagram Agent Skill → E (reject as core)
- No candidate adopted as outcome A (dependency/external service) or outcome B (wrapped CLI) at this time.

**Tradeoffs considered:**
- Importing an entire application would duplicate schedulers/databases and violate Blueprint rule 10 and Part II "Do not import an entire application when a small connector or scheduling pattern is sufficient."
- Wrapping Jev Social's socai CLI via subprocess would introduce an external binary dependency, a browser profile on the worker, and an OpenRouter dependency — incompatible with an unattended cloud worker and blueprint least-privilege / no-secret-in-logs rules.

**Revisit trigger:** If a later phase requires browser-based Instagram inspection and a socai CLI + authorized Chrome session is separately provisioned and authorized by the user, reconsider Jev Social outcome B (adapter over the CLI) with the dependency documented.

## ADR-002: Target technology stack

**Decision:**
- Backend: Python 3.12+, FastAPI, SQLAlchemy 2.x, Alembic, Pydantic v2, LangGraph
- Database: SQLite (`sqlite+aiosqlite`) for local prototype; PostgreSQL for production
- Local model: Ollama (configurable base URL/model); hosted LLM provider configurable with budget caps
- Web search: one provider to be selected in Phase 2 (candidates: DuckDuckGo via `ddgs`, Exa); fetcher must enforce SSRF protections
- Frontend: React dashboard (Vite), served by the API or as static files
- Notifications: Telegram Bot API
- Scheduler: single in-process/database-locked scheduler (no Kafka/Kubernetes)

**Rationale:** Matches Blueprint Part III architecture principles and Part X environment variables; local-first, single-user MVP; avoids microservices and competing orchestrators (Blueprint rule 10).

## ADR-003: Instagram access strategy

**Decision:** First choice = official Meta/Instagram API for eligible accounts and authorized permissions (Blueprint Part IV §12). Second choice = permitted browser inspection via a dedicated private browser profile, only where allowed, with no CAPTCHA/login/rate-limit evasion. No automated liking/following/posting/DM in MVP (rule 5). When Instagram is unavailable, continue with healthy sources and label coverage partial.

**Rationale:** Blueprint rule 4 (respect access controls), rule 5 (least privilege), Part IV Instagram strategy.

## ADR-004: No fake functionality / provenance

**Decision:** No seeded/fabricated discoveries, comments, metrics, accounts, or citations. Every finding links to real source records; publication time stored separately from retrieval time; missing dates remain unknown. Test fixtures kept separate from production data.

**Rationale:** Blueprint rules 3, 4, 8; Part VI timestamp rules.

## Open items
- License confirmation for AI Search Agent and Research Agent (no LICENSE files) before any code port.
- Web-search provider selection (Phase 2).
- Live Instagram test: requires explicit user authorization + permitted account/session (Blueprint rule 8); not yet run.
- Candidate offline tests (`npm test` for Jev Social; `pytest` for Agent Reach/AI Search Agent; OpenMagpie connector tests) not yet executed — inspected statically only in Phase 0.

## Next steps
- Commit Phase 0 deliverables to a dedicated branch (`phase-0-audit`).
- Confirm the foundation decision with the user, then begin Phase 1 (make the foundation work) and Phase 2 (common source/discovery schemas + web-search connector).
