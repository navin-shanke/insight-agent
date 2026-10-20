# Insight Agent: Project Overview

## Purpose
Insight Agent is a bounded research orchestration system that performs daily discovery of topics, extracts claims from web sources, verifies those claims, and generates cited research reports. The system is designed as a research "sandbox" with strict budgets, iteration limits, and provenance tracking per [Blueprint Part V §14].

## Technology Stack
- **Python 3.11+** with SQLAlchemy 2.x for ORM
- **FastAPI** for API layer (currently baseline health only)
- **LangGraph** for research workflow orchestration
- **DuckDuckGo** as the search connector (with SSRF-safe fetcher)
- **ONNX embeddings** for semantic similarity / pattern memory
- **Pydantic** for data contracts (schemas/)

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    FastAPI Application                          │
│  (main.py — health endpoints, /daily-discovery CLI entry)       │
├─────────────────────┬─────────────────────┬───────────────────────┤
│                   │                     │                       │
│  Research Service │   LangGraph Graph   │   Scheduler Service   │
│  (service.py)     │  (graph.py — 10 nodes)│  (scheduler.py)       │
│                   │                     │                       │
├─────────────────────┼─────────────────────┼───────────────────────┤
│                   │                     │                       │
│   DB Models       │   Research State    │   Alembic Migrations  │
│   (models/)       │  (research_state.py) │  (versions/)          │
│                   │                     │                       │
└─────────────────────┴─────────────────────┴───────────────────────┘
                         ▲
                         │
                  Scheduled Runs
               (task_checkpoints table)
```

## Major Components

| Component | Responsibility |
|-----------|---------------|
| **ResearchService** | DB session, DuckDuckGo connector, ModelRouter (LLM), source persistence (upsert_source, add_snapshot, add_claim, etc.) |
| **StateGraph (graph.py)** | LangGraph StateGraph with 10-node sequence: load_context → plan_research → discover_sources → normalize_sources → inspect_content → extract_claims → verify_claims → score_discoveries → decide_next → build_report |
| **SchedulerService** | Idempotent lock management, `run_daily_discovery()` entry point |
| **Nodes (nodes.py)** | Each node is an async function `(service, state) -> partial_state_update`; they decrement budgets, enforce limits, and return partial updates |
| **Connectors** | DuckDuckGoConnector (search + fetch) with SSRF-safe fetcher |
| **LLM Router** | ModelRouter for plan_research, extract_claims, verify_claims, rank_discovery, synthesize_report |
| **DB Models** | Source, ContentSnapshot, Claim, Evidence, Discovery, DiscoverySource, Report, TaskCheckpoint |

## Completed Phases

| Phase | Status | Description |
|-------|--------|-------------|
| **Phase 1** | ✅ Completed | Initial project scaffolding, FastAPI app, basic DB models |
| **Phase 2** | ✅ Completed | Data contracts (Pydantic schemas), DuckDuckGo connector, SSRF-safe fetcher, SQLAlchemy models + Alembic migrations |
| **Phase 3** | ✅ Completed | Bounded deep-research workflow (StateGraph with 10 nodes, checkpoint persistence, iteration/budget enforcement) |
| **Phase 4** | 🟡 In Progress | Daily Discovery scheduler with watchlists, deduplication, source budget enforcement, and report generation |

## Future Phases

- **Phase 5**: Telegram dashboard integration with real-time discovery alerts
- **Phase 6**: Multi-provider LLM routing with cost-optimization
- **Phase 7**: Persistent cross-session memory via AgentDB / vector store

## Non-Negotiable Design Principles

1. **Bounded research** — State carries only IDs and summaries, never full payloads (Blueprint §14)
2. **Checkpoint persistence** — After every node execution, state is saved to `task_checkpoints` table (Part V §14, Part XXIV)
3. **Single source of truth** — DB is authoritative; in-memory state is derived from DB
4. **Idempotent scheduling** — Lock prevents concurrent runs for same task_id; release sets status
5. **Budget enforcement** — source_budget_remaining, token_budget_remaining, spend_budget_remaining are server-side and never overridden by the model
6. **Async boundary** — Graph execution uses a single `asyncio.run()` from synchronous call sites; no nested event loops

## Important Constraints

- No browser automation; text-based web only (DuckDuckGo + SSRF-safe fetcher)
- One search/inspect cycle per source per run (budget bounded)
- Model never sees raw HTML — always HTML→text converted by BeautifulSoup4
- Claim verification is "contextualizes" stance only; not full factual verification
- Reports are generated in Markdown; no PDF/HTML export in v1