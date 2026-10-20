# Current Architecture

See docs/ANTIGRAVITY_HANDOFF.md for detailed data flow and limitations. This replaces the pre-merge component map, whose HTTP routes and scheduler locking descriptions were stale.

- CLI/API entry: backend/app/main.py.
- HTTP API: GET /health/live, GET /health/ready; the latter is constant success, not dependency readiness. OpenAPI/docs are generated. No research/watchlist/report endpoints or frontend.
- Research graph: backend/app/agents/graph.py and nodes.py. ResearchService persists task checkpoints and normalized source, snapshot, claim, evidence, discovery, report, and cancellation records.
- Web sources: DuckDuckGo connector at backend/app/connectors/duckduckgo.py and SSRF-conscious page fetcher at backend/app/fetcher/safe_fetch.py.
- Model: ModelRouter currently uses local Ollama. Hosted provider settings do not establish multi-provider implementation.
- Scheduler: backend/app/services/scheduler.py consumes enabled watchlists, enforces bounded runs and persists coverage/digest. Scheduler ownership uses expiring owner tokens, heartbeat renewal, and transactional stale-owner write fencing.
- Persistence: SQLite is configured locally; Alembic migrations are under backend/db/alembic. PostgreSQL is an intended target but unverified.
- No Telegram, Google Drive, Instagram, browser automation, queue service, dashboard, or independent worker process is implemented.

Data flow: CLI/API entry → bounded LangGraph nodes → connector/fetcher and ModelRouter → ResearchService/SQLAlchemy transaction → checkpoint and research records. Scheduled discovery loads watchlists, acquires an owner-fenced lease, invokes bounded research, persists outcome/digest/coverage, and releases only while still owner.
