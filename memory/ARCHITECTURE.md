# Insight Agent: Architecture

## Component Dependency Graph (Mermaid)

```mermaid
graph TD
    %% API Layer
    APP[FastAPI Application] -->|HTTP requests| API[/app/main.py]
    API -->|run_daily_discovery()| SCHED[SchedulerService]
    API -->|/health endpoints| Health[Health Probes]

    %% Research Service
    SCHED -->|task_id, query, budget| RS[ResearchService]
    RS -->|DB session| Engine[SQLAlchemy Engine]
    RS -->|connector| DC[DuckDuckGoConnector]
    RS -->|router| Router[ModelRouter]

    %% LangGraph
    RS -->|service, state| Graph[StateGraph (graph.py)]
    Graph -->|node execution| Nodes[nodes.py]
    Nodes -->|persist| RS

    %% DB Models
    Engine -->|CRUD operations| Models[DB Models]
    Models -->|Source, Snapshot, Claim, etc| Tables[SQLite tables]

    %% LLM Router
    Router -->|plan_research, extract_claims, verify_claims, rank_discovery, synthesize_report| LLM[Anthropic/Claude API]

    %% Scheduler
    SCHED -->|acquire_lock, release_lock| Lock[ScheduledRun table]

    style APP fill:#e3f2fd,stroke:#1565c0,stroke-width:2px
    style RS fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px
    style Graph fill:#fff3e0,stroke:#ef6c00,stroke-width:2px
    style SCHED fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    style Nodes fill:#ffebee,stroke:#c62828,stroke-width:2px
    style Router fill:#e3f2fd,stroke:#1565c0,stroke-width:2px
    style Models fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px
```

## Data Flow

### 1. Daily Discovery Trigger
```
CLI: python -m app.main daily-discovery --query "What is the price of the new tool?"
       → run_daily_discovery() in main.py
       → SchedulerService.run_daily_discovery()
       → ResearchService (creates DB session, init connector/router)
       → run_research(service, task_id=..., query=...)
```

### 2. Research Graph Execution (step-by-step with checkpoints)
```
run_research()
  → initial_state()  [candidate_source_ids=[], inspected_source_ids=[], etc.]
  → load_context()   [status=RUNNING, iteration=1]
  → plan_research()  [LLM produces sub_topics → pending_leads]
  → discover_sources() [DuckDuckGo search → candidate_source_ids]
  → normalize_sources() [remove already-inspected]
  → inspect_content() [SSRF-safe fetcher → ContentSnapshot]
  → extract_claims() [LLM extracts claims from fetched text]
  → verify_claims() [LLM verifies claims against evidence]
  → score_discoveries() [group verified claims → Discovery records]
  → decide_next() [routing: inspect more, re-plan, or finish]
  → build_report() [synthesize Report with citations]
  → final state returned
```

After each node: `service.save_checkpoint(session, thread_id, task_id, step, state)` + `session.commit()`.

### 3. Scheduler Locking
```
acquire_lock(task_id):
  → Query ScheduledRun table for task_id
  → If none: insert "running", return True
  → If status=="running": return False (already running)
  → Else: update status="running", return True

release_lock(task_id, status):
  → Update run status (completed/partial/failed), set last_run_at
```

### 4. DB Schema (key tables)
- **source** — canonical URL, access_status, retrieval_count, metadata_json
- **content_snapshot** — per-retrieval hash, text_content, access_status, coverage_json
- **claim** — claim_text, claim_type, verification_status, source_id FK
- **evidence** — claim_id FK → source_id FK, excerpt, stance, quality_notes
- **discovery** — title, summary, category, verification_status, task_id FK
- **discovery_source** — discovery_id FK → source_id FK, link_type (cites, contradicts)
- **report** — title, query, body_md, limitations, task_id FK, discovery_ids
- **task_checkpoint** — thread_id, task_id, step, state_json, timestamp
```

## Async/Sync Boundaries

| Boundary | Description |
|----------|-------------|
| **Entry point** | `run_daily_discovery()` and `run_research()` are synchronous functions that call `asyncio.run(_run_loop(...))` |
| **Graph loop** | `_run_loop()` is `async`; executes nodes via `await node_fn(service, state)` |
| **Single async context** | One `asyncio.run()` per research run; no nested event loops |
| **DB access** | SQLAlchemy sessions are synchronous (contextmanager); graph nodes run inside `asyncio.run()` but use sync sessions (works because SQLite + aiosqlite not used) |
| **LLM calls** | ModelRouter calls are async within the node; `await` the router |

## Implemented vs Planned Components

| Component | Status |
|-----------|--------|
| StateGraph with 10 nodes | ✅ Implemented (graph.py) |
| Checkpoint persistence to DB | ✅ Implemented (save_checkpoint + commit after each node) |
| Scheduler lock/release | ✅ Implemented (scheduler.py) |
| Source budget enforcement | ✅ Implemented (inspect_content, decide_next) |
| Deduplication of discoveries | ✅ Implemented (test_duplicate_suppression) |
| Watchlist CRUD | ✅ Implemented (test_watchlist_crud) |
| LLM Router (ModelRouter) | ✅ Implemented |
| DuckDuckGoConnector with SSRF-safe fetcher | ✅ Implemented |
| Phase 4: Daily Discovery scheduler UI | 🟡 In Progress (test file exists, scheduler.run_daily_discovery works) |
| Phase 5: Telegram dashboard | 🔲 Planned |
| Phase 6: Multi-provider LLM routing | 🔲 Planned |
| Phase 7: Persistent cross-session memory | 🔲 Planned |