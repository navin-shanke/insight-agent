# Audit Report — AI Search Agent (`smnk-1/ai-search-agent`)

**Audited against:** INSIGHT_AGENT_MASTER_BLUEPRINT Part II (Candidate 4 — reference for iterative web research and evidence-linked synthesis)
**Source:** https://github.com/smnk-1/ai-search-agent
**Local checkout:** `C:\Users\USER\AppData\Local\Temp\opencode\candidates\ai-search-agent` (shallow clone, `--depth 1`)
**Audit date:** 2026-10-19
**Auditor:** OpenCode (Phase 0)

## 1. Identity
| Field | Value | Evidence |
|---|---|---|
| Repository | smnk-1/ai-search-agent | README.md |
| License | NO `LICENSE` file in root; README does not state a license | directory listing: backend, images, src, tests, env/example, docker-compose, Dockerfile, poetry.lock, pyproject, README — no LICENSE |
| Language / runtime | Python 3.12, Poetry | `pyproject.toml` `[tool.poetry] python = "^3.12"`, `poetry.lock` |
| Version | 0.1.0 | `pyproject.toml` |
| Install method | `git clone` + `poetry install`; run `uvicorn backend.main:app` | README.md Quick Start |
| CI | `.github/` present (not inspected) | directory exists |

## 2. Purpose in our plan
Reference for iterative web research and evidence-linked synthesis: LangGraph state machine with search → filter → fetch → summarize → verify loops, Ollama local LLM, structured Pydantic output, optional LangFuse tracing, FastAPI backend with HTML+Tailwind UI.

## 3. Capability audit

| Capability | Status | Evidence |
|---|---|---|
| LangGraph state machine | CONFIRMED_BY_CODE | `src/ai_search_agent/graph.py` `StateGraph`: sufficiency_check → formulate_query → ddg_search → filter_links → process_links → current_question_check → generate_final_answer → END |
| Query decomposition into sub-topics | CONFIRMED_BY_CODE | `sufficiency_check` node produces `current_question`; loop until sufficient or max_iterations |
| Web search (DuckDuckGo) | CONFIRMED_BY_CODE | `tools.py` `search()` via `ddgs` library, max_results=10 |
| Web page fetch + text extraction | CONFIRMED_BY_CODE | `tools.py` `fetch_page()` via `requests`+`BeautifulSoup`, max 10,000 chars, strips script/style/nav/footer/header/aside |
| Reliability-aware link filtering | CONFIRMED_BY_CODE | `filter_links` node uses LLM `FilterDecision` to pick useful links |
| Contradiction / novelty checks | DOCUMENTED_ONLY | README lists "Contradiction and novelty checks before adding information" as a capability; code shows `ANALYZE_SUMMARY_USEFULNESS_TEMPLATE` usefulness check, not explicit contradiction detection |
| Structured final report with sources | CONFIRMED_BY_CODE | `generate_final_answer` node via `GENERATE_FINAL_ANSWER_TEMPLATE`; `FinalAnswer` Pydantic model; source list with favicons (README) |
| Structured Pydantic LLM output | CONFIRMED_BY_CODE | `llm_utils.py` Pydantic models (`SufficiencyVerdict`, `SearchQuery`, `Summary`, `FilterDecision`, `CurrentQuestionCheck`, `FinalAnswer`); `llm.with_structured_output()` |
| Fallback on malformed LLM output | CONFIRMED_BY_CODE | `invoke_structured()` catches exceptions and returns a default |
| Iteration limits | CONFIRMED_BY_CODE | `max_iterations`/`max_sub_iterations` with counters; graph terminates |
| LangFuse tracing (optional) | CONFIRMED_BY_CODE | `USE_LANGFUSE` env; CallbackHandler; `langfuse>=4.11.0` dependency |
| FastAPI backend + web UI | CONFIRMED_BY_CODE | `backend/main.py` uvicorn app; HTML + Tailwind CSS static UI |
| Local LLM (Ollama) | CONFIRMED_BY_CODE | `langchain-ollama`, `OLLAMA_HOST`, default model `qwen2.5-coder:14b-instruct-q4_K_M` |
| Typed graph state with reducers | CONFIRMED_BY_CODE | `state.py` `AgentState` TypedDict with `Annotated[list, operator.add]` reducers |
| Instagram connector | NOT_IMPLEMENTED | grep found no `instagram`; web-only |
| Claim extraction + source-linked verification | NOT_IMPLEMENTED | Summarization/synthesis only; no claim/evidence records or verification statuses |
| Persistent application database | NOT_IMPLEMENTED | No SQLAlchemy/Alembic; no durable source/discovery schema |
| Scheduler / daily digest / Telegram | NOT_IMPLEMENTED | Not present |
| Auth / secret protection | NOT_IMPLEMENTED | `.env.example` with OLLAMA_HOST/MODEL_NAME; no auth system |
| Tests | PARTIAL | `tests/` directory + `pytest>=9.1.1` dev dep + `ruff`; not executed |

Status label counts: CONFIRMED_BY_CODE=12, DOCUMENTED_ONLY=1, NOT_IMPLEMENTED=4, PARTIAL=1.

## 4. Dependencies and versions
- `langchain^1.3.11`, `langgraph^1.2.6`, `langchain-ollama^1.1.0`, `requests^2.34.2`, `beautifulsoup4^4.15.0`, `pydantic^2.13.4`, `python-dotenv^1.2.2`, `ddgs^9.14.4`, `langfuse^4.11.0`, `fastapi^0.138.0`, `uvicorn^0.49.0`
- Dev: `ruff^0.15.18`, `pytest^9.1.1`
- Build: poetry-core / hatchling-compatible (`poetry.core.masonry.api`)
- Config via `.env`: `OLLAMA_HOST`, `MODEL_NAME`, `MODEL_TEMPERATURE=0`, `MODEL_NUM_CTX=16384`, `MODEL_NUM_PREDICT=4096`, `MAX_ITERATIONS=3`, `MAX_SUB_ITERATIONS=3`, `USE_LANGFUSE=false`

## 5. Maintenance state
- Commit history (shallow, 1 visible commit): `fa94ac5 docs: add project description`
- No tags/releases
- Issue/PR activity: not inspectable from shallow clone
- Assessment: minimal visible history; shallow clone limits verification

## 6. Security and policy fit
| Concern | Assessment |
|---|---|
| Web fetch SSRF | `fetch_page()` uses `requests.get(url)` with NO loopback/private-range blocking, no redirect revalidation, no size/time limits beyond `max_length` — does NOT meet blueprint web-security requirements (Part IV §13) if reused without hardening |
| LLM data | Ollama local (default) or configured endpoint; API keys optional |
| Read-only research | Yes (search/fetch/summarize only) |
| License compatibility | Unverified — no LICENSE file |

## 7. Integration effort
- Python/FastAPI/LangGraph — language and framework match the blueprint target stack (Part III)
- Closest architectural match of all candidates: LangGraph state machine + Ollama + FastAPI + web search + page fetcher
- BUT: no persistence (no DB), no Instagram, no claim/evidence model, no scheduler, no auth, no Telegram/dashboard; SSRF-unsafe fetcher
- It is a runnable app (`src/` + `backend/`), not a library; components (graph nodes, state, tools, prompts) are portable
- Reuse outcome: design reference + port small typed components (outcome C), not a foundation dependency
- Verdict: **Outcome D (design reference)** with possible small-component port of LangGraph node/state/tool patterns; the fetcher must be rewritten for SSRF safety.

## 8. License and copyright
- No LICENSE file present; README does not state a license. Reuse legality unverified → treat any ported code as copyright-unclear until confirmed.

## 9. Tests
- `tests/` directory; `pytest>=9.1.1`, `ruff^0.15.18` dev dependencies
- Not executed (requires Python 3.12 + Poetry environment)

## 10. Reuse decision matrix (1–5)

| Criterion | Score | Rationale |
|---|---|---|
| Functional fit (30%) | 3 | LangGraph research loop + Ollama + FastAPI matches target architecture well; lacks persistence, Instagram, claims, scheduler |
| Code and test quality (20%) | 4 | Clean node/state/tool/prompt separation, structured output, pytest/ruff, iteration limits, fallbacks |
| Integration effort (20%) | 3 | Language/framework match; portable components; fetcher needs SSRF rewrite; no DB to integrate |
| Security and policy fit (15%) | 2 | Fetcher lacks SSRF/private-range/size limits; license unverified |
| Maintenance and license clarity (15%) | 2 | No tags, single visible commit, no LICENSE file |
| Weighted total | 2.85 | |

**Outcome: D — Use only as a design reference** (with outcome C possibility: port small typed components such as the LangGraph node/state/tool pattern and structured Pydantic output, after confirming license). Do not reuse the fetcher as-is (SSRF-unsafe).

## 11. Blockers
- No LICENSE file → reuse legality unverified.
- No persistent database / SQLAlchemy-Alembic schema matching blueprint Part VI.
- No Instagram connector, no claim/evidence model, no scheduler/Telegram/dashboard/auth.
- Fetcher is SSRF-unsafe (no loopback/private-range blocking, redirect revalidation, size/time caps).

## 12. Conclusion
AI Search Agent is the closest architectural match to Insight Agent's target stack (Python/FastAPI/LangGraph/Ollama deep research) and is a strong design reference for the bounded research workflow, but it is not a foundation: no persistence, no Instagram, no claim verification, no scheduler/Telegram/dashboard, unverified license, and an SSRF-unsafe page fetcher. Adopt its LangGraph node/state/tool structure and structured-output pattern as design references only; build the fetcher, persistence, and connectors fresh per the blueprint.
