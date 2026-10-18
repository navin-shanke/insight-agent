# Audit Report — Research Agent (`ram-cs7/Research_Agent`)

**Audited against:** INSIGHT_AGENT_MASTER_BLUEPRINT Part II (Candidate 5 — secondary reference for LangGraph, RAG, and research persistence)
**Source:** https://github.com/ram-cs7/Research_Agent
**Local checkout:** `C:\Users\USER\AppData\Local\Temp\opencode\candidates\research-agent` (shallow clone, `--depth 1`)
**Audit date:** 2026-10-19
**Auditor:** OpenCode (Phase 0)

## 1. Identity
| Field | Value | Evidence |
|---|---|---|
| Repository | ram-cs7/Research_Agent | README.md |
| License | README claims "MIT — use freely"; NO `LICENSE` file in root | README.md line 180; directory listing has no LICENSE |
| Language / runtime | Python | `requirements.txt`, `app.py`, `main.py` |
| Version | not versioned (no tags) | `git tag` returned nothing |
| Install method | `git clone` + `python -m venv` + `pip install -r requirements.txt` | README.md Quick Start |
| CI | `.github/` present (not inspected in detail) | directory exists |

## 2. Purpose in our plan
Secondary reference for LangGraph, RAG, and research persistence: planner → executor (ReAct loop) → summariser → reporter LangGraph; Tavily/DuckDuckGo web search; ChromaDB RAG for uploaded documents; map-reduce summarization; Jinja2 Markdown/HTML reports; Streamlit UI.

## 3. Capability audit

| Capability | Status | Evidence |
|---|---|---|
| LangGraph research workflow | CONFIRMED_BY_CODE | `agents/graph.py` `build_graph()`: planner → executor (conditional loop) → summariser → reporter → END |
| Query planning (LLM decomposes into task list) | CONFIRMED_BY_CODE | `agents/planner.py` `planner_node` (referenced by graph) |
| Web search (Tavily / DuckDuckGo) | CONFIRMED_BY_CODE | `tools/web_search.py`; requirements `tavily-python>=0.3.0`, `duckduckgo-search>=6.0.0` |
| Document retrieval (RAG, ChromaDB) | CONFIRMED_BY_CODE | `memory/vector_store.py` `chromadb.PersistentClient`; requirements `chromadb>=0.5.0`, `sentence-transformers>=3.0.0` |
| Map-reduce summarization | CONFIRMED_BY_CODE | `tools/summarizer.py` `map_reduce_summarise` |
| Structured Markdown/HTML report | CONFIRMED_BY_CODE | `report/generator.py` `reporter_node`; Jinja2 templates |
| Streamlit UI | CONFIRMED_BY_CODE | `app.py` `streamlit run app.py` |
| CLI entry point | CONFIRMED_BY_CODE | `main.py` with `--query`, `--docs`, `--output` |
| Memory across tasks | CONFIRMED_BY_CODE | `memory/agent_memory.py`; ChromaDB persistent `data/chroma_db/` |
| Claim extraction + source-linked verification | NOT_IMPLEMENTED | Summarization only; no claim/evidence model or verification statuses |
| Instagram connector | NOT_IMPLEMENTED | grep found no `instagram`; no social connectors |
| Persistent application DB (SQLAlchemy/Alembic) | NOT_IMPLEMENTED | ChromaDB for vectors + local `data/` files; no SQLAlchemy schema matching blueprint Part VI |
| Scheduler / daily digest / Telegram | NOT_IMPLEMENTED | Not present |
| Auth / secret protection | NOT_IMPLEMENTED | `.env` with LLM_API_KEY; no auth system |
| Tests | PARTIAL | `tests/` directory present (not executed) |

Status label counts: CONFIRMED_BY_CODE=9, NOT_IMPLEMENTED=6, PARTIAL=1.

## 4. Dependencies and versions
- `openai>=1.0.0`, `langgraph>=0.2.0`, `langchain-core>=0.3.0`, `duckduckgo-search>=6.0.0`, `tavily-python>=0.3.0`, `chromadb>=0.5.0`, `sentence-transformers>=3.0.0`, `PyPDF2>=3.0.0`, `beautifulsoup4>=4.12.0`, `requests>=2.31.0`, `jinja2>=3.1.0`, `streamlit>=1.35.0`, `python-dotenv>=1.0.0`, `markdown>=3.6.0`, `rich>=13.7.0`, `numpy>=1.26.0`, `torchvision`
- Config: `config.py` with `LLM_API_KEY`, `LLM_BASE_URL`, `TAVILY_API_KEY`, `PLANNER_MODEL`/`EXECUTOR_MODEL`/`REPORTER_MODEL` (default `llama-3.1-8b-instant`), `MAX_TASKS_PER_PLAN=8`, `MAX_SEARCH_RESULTS=5`, `CHUNK_SIZE=500`

## 5. Maintenance state
- Commit history (shallow, 1 visible commit): `43f77a3 Add demo screenshot to assets`
- No tags/releases; no version pinning
- Issue/PR activity: not inspectable from shallow clone
- Assessment: minimal visible history; appears to be a small/single-developer reference repo; shallow clone limits verification

## 6. Security and policy fit
| Concern | Assessment |
|---|---|
| Web fetch | `beautifulsoup4`+`requests` fetcher; no SSRF protection visible (no loopback/private-range blocking) — would need hardening if reused |
| LLM data | OpenAI-compatible (Groq/Ollama); API key in `.env` |
| Read-only research | Yes (research/summarization only, no platform write actions) |
| License compatibility | Uncertain — README claims MIT but no LICENSE file; treat as unverified |

## 7. Integration effort
- Python, but Stack differs: Streamlit UI + ChromaDB + langgraph 0.2.0 (old) vs target FastAPI + SQLAlchemy/PostgreSQL + newer LangGraph
- It is a complete CLI/Streamlit app, not a library; importing wholesale duplicates scheduler-less orchestration and a separate vector DB
- Small components (planner/executor/reporter node split, map-reduce summarizer) are portable as design references
- Reuse outcome: design reference / small-component port (outcome C) only for LangGraph node patterns; not a foundation
- Verdict: **Outcome D (design reference)**, with possible small-component port of the LangGraph node structure if licensed.

## 8. License and copyright
- No LICENSE file; README states "MIT — use freely." License is unverified → treat any reuse as copyright-unclear until a LICENSE file is confirmed.

## 9. Tests
- `tests/` directory present; not executed (no test runner configured in requirements.txt)

## 10. Reuse decision matrix (1–5)

| Criterion | Score | Rationale |
|---|---|---|
| Functional fit (30%) | 2 | LangGraph research pattern fits, but no Instagram, no claim verification, no DB schema matching blueprint, no scheduler/Telegram/dashboard |
| Code and test quality (20%) | 3 | Modular (agents/tools/memory/report), but old langgraph 0.2.0, Streamlit UI, no test runner deps |
| Integration effort (20%) | 2 | Separate ChromaDB + Streamlit; not importable as library; small pieces portable |
| Security and policy fit (15%) | 3 | No SSRF protection visible; license unverified |
| Maintenance and license clarity (15%) | 2 | No tags, single visible commit, no LICENSE file |
| Weighted total | 2.25 | |

**Outcome: D — Use only as a design reference.** Relevant patterns: planner→executor→summariser→reporter LangGraph split, conditional loop over tasks, map-reduce summarization, Jinja2 report rendering. Do not import as dependency; license unverified.

## 11. Blockers
- No LICENSE file → reuse legality unverified.
- No Instagram connector, no claim/evidence model, no SQLAlchemy/Alembic schema, no scheduler, no auth.
- Old LangGraph (0.2.0) and Streamlit UI diverge from target stack.

## 12. Conclusion
Research Agent is a small LangGraph research reference with planner/executor/summariser/reporter structure and ChromaDB RAG, but it is not a foundation: no Instagram, no claim verification, no persistent application database matching blueprint Part VI, no scheduler/Telegram/dashboard, and license is unverified (README claims MIT, no LICENSE file). Adopt its LangGraph node split and report patterns as design references only.
