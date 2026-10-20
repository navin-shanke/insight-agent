# Insight Agent: Decisions

## Architectural Decisions

| Decision | Rationale | Status |
|----------|-----------|--------|
| **LangGraph StateGraph over raw asyncio loop** | Provides explicit node routing, checkpointability (Part V §14), and structured state machine. Easier to reason about than manually managed coroutine state. | ✅ Implemented |
| **Checkpoint after every node, not after full run** | Per ADR-005 §14: "State is persisted to the task_checkpoints table after every node so an interrupted task can resume from the last durable checkpoint." Guarantees resumeability even if model crashes mid-run. | ✅ Implemented |
| **Single `asyncio.run()` from synchronous entry points** | `run_research()` and `run_daily_discovery()` are synchronous; they bootstrap the async graph via `asyncio.run()`. Avoids confusion from nested event loops. | ✅ Implemented |
| **DDL-first DB with SQLAlchemy `create_all`** | `ResearchService.__init__` calls `Base.metadata.create_all(self.engine)` on startup. Ensures schema is always in sync with models; Alembic migrations tracked separately for production deployments. | ✅ Implemented |
| **DuckDuckGo as sole search provider** | Avoids API key management and cost variability for v1. SSRF-safe fetcher + BeautifulSoup4 HTML→text conversion keeps the system air-gapped and deterministic. | ✅ Implemented |
| **Markdown report body, no PDF/HTML export** | Keeps the v1 output simple and parser-friendly. Future phases can add export formats. | ✅ Implemented |
| **Claim verification stance = "contextualizes"** | Per Blueprint Part VI §16: verification determines support/contradiction/mixed/insufficient, but the "why" is "contextualizes" — not a full factual truth‑finder. Limits liability and scope. | ✅ Implemented |
| **Budgets are server‑side, never model‑overridable** | `source_budget_remaining`, `token_budget_remaining`, `spend_budget_remaining` are initialized in `initial_state()` and decremented by nodes. The model only observes remaining values; it cannot reset or increase them. | ✅ Implemented |
| **Research state carries IDs, not payloads** | `ResearchState` fields are `UUID` lists and `str` summaries. Full content lives in DB (`content_snapshot`, `claim` tables). Keeps state small and serialization-light. | ✅ Implemented |
| **Idempotent scheduler lock by task_id** | `acquire_lock()` / `release_lock()` key on `task_id` only. A given task can be retried after release; prevents truly concurrent runs from overlapping. | ✅ Implemented |

## Decisions That Must Not Be Changed Without Approval

1. **Do not change the node sequence** (load_context → plan_research → discover_sources → normalize_sources → inspect_content → extract_claims → verify_claims → score_discoveries → decide_next → build_report) without a full ADR review. The sequence is the bounded research contract.
2. **Do not remove checkpoint persistence** after each node — this is the recovery mechanism for interrupted runs.
3. **Do not allow the model to override budgets** — budget values in state are read-only observables; nodes that decrement must use the state values, not hard‑coded constants.
4. **Do not switch the search provider from DuckDuckGo without replacing the connector interface** (`DuckDuckGoConnector`) and updating all node expectations.

## Rejected Approaches (and Why)

| Rejected Approach | Why It Was Rejected |
|-------------------|---------------------|
| **Native `graph.invoke()` with checkpointer** | LangGraph's built‑in checkpointer stores state in-memory per session and doesn't persist to the relational DB. The project requires DB‑durable checkpoints (Part V §14, Part XXIV) for cross‑session resume, so the manual step‑by‑step `_run_loop` was chosen. |
| **Model‑controlled budget reset** | Would break the bounded‑research guarantee. A model could infinitely loop by resetting `source_budget_remaining = 100` each iteration. Enforced server‑side decrement only. |
| **Full‑content in ResearchState** | Would make state serialization expensive and violate the "bounded state" principle (Blueprint §14). Content is stored in DB; state carries only IDs/summaries. |
| **Multiple search providers in v1** | Would require connector abstraction, provider‑specific routing, and API key management — out of scope for the initial release. DuckDuckGo + SSRF fetcher is the minimal, secure choice. |

## Known Pitfalls

| Pitfall | Location | Symptom | Fix |
|---------|----------|---------|-----|
| `result.complete` is `None` from `runSocaiJson` dict | `nodes.py:119` `if result.complete and result.records:` | The `if` block is **never entered** because `dict.get("complete")` returns `None` (falsy). Candidates never populate. | Change to `if result.get("complete") and result.get("records"):` OR inspect `result["complete"]` / `result["records"]` as dict keys. |
| `metadata={}` vs `metadata or {}` in upsert_source | `nodes.py:128` passes `metadata={}` explicitly; `upsert_source` line 73 checks `if metadata is not None`. Works because `{}` is not `None`, but passing `None` would also work via the `or {}`. | Minor — no actual bug, just consistency. | Keep as-is; `metadata={}` is intentional to always pass a dict. |
| `fetched.error` vs `fetched.snapshot` in inspect_content | `nodes.py:190` checks `fetched.error is None and fetched.snapshot is not None` | If connector returns a `FetchedContent` with only `error` set (no `snapshot`), access_status is set to `FAILED`. | Verified working in `_mock_connector` test fixture; production connector must set both or neither. |
| `rec.canonical_url` on `SourceReference` when `result.records` is a list of dicts | If the mock or real connector returns plain dicts instead of `SourceReference` Pydantic objects, `.canonical_url` raises `AttributeError`. | `TypeError: 'dict' object has no attribute 'canonical_url'` | Ensure connector always returns `SourceReference` instances (Pydantic model with `model_config = ConfigDict(frozen=True)`). |
| `asyncio.run()` called when event loop already running | If `run_research()` is called from within an existing async context | `RuntimeError: asyncio.run() can't be called from a running event loop` | Wrap in `try: asyncio.run(...)` / use `await` from already‑async entry points. |

## Unresolved Decisions

| Decision | Options | Current Choice | Why Unresolved |
|----------|---------|----------------|----------------|
| **Cross-session memory backend** | AgentDB vector store vs simple JSON files vs SQLAlchemy‑only | SQLAlchemy‑only (no external vector DB) | Cost/complexity trade‑off; Phase 7 will evaluate AgentDB integration. |
| **Report format** | Markdown only vs Markdown + PDF vs Markdown + HTML | Markdown only (v1) | PDF/HTML export requires additional dependencies (WeasyReport, etc.) — deferred. |
| **Claim verification depth** | Superficial "contextualizes" vs Full factual verification | "contextualizes" (v1) | Full verification requires external knowledge bases and is out of scope for initial release. |
| **Scheduler: per‑query vs per‑task locking** | Lock on `task_id` (current) vs lock on `(task_id, query)` | `task_id` only | Query‑level locking would prevent re‑running same query, which the test `test_duplicate_suppression` explicitly tests at the discovery‑level, not scheduler‑level. |

## Important Notes for New Models

- **Never trust memory over the repo** — always `git status` and read the actual source files first.
- **The bug at `nodes.py:119`** (`result.complete` is `None`) is the #1 blocker for candidate sourcing. It must be fixed before any run can discover new sources.
- **Checkpoints are the source of truth** for resume — if a run is interrupted, `resume_research()` loads the latest checkpoint and continues from that node.
- **Budgets only go down** — never upwards. A run that exhausts its source budget stops inspecting and routes to "report".
- **The scheduler lock is per `task_id`** — running `daily-discovery` with the same query twice will work; the scheduler only prevents two runs with the same `task_id` simultaneously.