# Audit Report — Agent Reach (`rolltidehero/agent-reach`)

**Audited against:** INSIGHT_AGENT_MASTER_BLUEPRINT Part II (Candidate 2 — candidate source-connector collection)
**Source:** https://github.com/rolltidehero/agent-reach (README references https://github.com/Panniantong/agent-reach)
**Local checkout:** `C:\Users\USER\AppData\Local\Temp\opencode\candidates\agent-reach` (shallow clone, `--depth 1`)
**Audit date:** 2026-10-19
**Auditor:** OpenCode (Phase 0)

## 1. Identity
| Field | Value | Evidence |
|---|---|---|
| Repository | rolltidehero/agent-reach (cloned); README references Panniantong/agent-reach | README.md line 298 |
| License | MIT | `LICENSE` file (copyright 2025 Agent Eyes) |
| Language / runtime | Python >=3.10 | `pyproject.toml` `requires-python = ">=3.10"` |
| Version | 1.5.0 | `pyproject.toml` |
| Install method | `pip install https://github.com/.../main.zip` then `agent-reach install --env=auto`, or `npx skills add Panniantong/Agent-Reach@agent-reach` | README.md Quick Start |
| CI | Not present in shallow clone (no `.github/workflows` listing verified beyond dir) | `.github/` dir exists |

## 2. Purpose in our plan
Candidate source-connector collection: a capability/routing layer that selects, installs, and health-checks the best access path per platform; the actual reading/searching is done by the agent calling upstream tools directly (no wrapper layer).

## 3. Capability audit

| Capability | Status | Evidence |
|---|---|---|
| Common connector interface per platform | CONFIRMED_BY_CODE | `agent_reach/channels/*.py` channel classes with `name`, `site`, `domains`, `usage`, `login_hint`; channel registry in `__init__.py` |
| Per-platform ordered backend list (primary + fallbacks) | CONFIRMED_BY_CODE | README "Current Tool Choices" table; e.g. Instagram → OpenCLI primary, official Graph API fallback |
| Web page read (any URL) | CONFIRMED_BY_CODE | `agent_reach/channels/web.py` → Jina Reader; README "Read web pages: Jina Reader" |
| Web search | CONFIRMED_BY_CODE | Exa via mcporter (free, no API key); `agent_reach/channels/exa_search.py` |
| GitHub read/search | CONFIRMED_BY_CODE | `gh` CLI powered; `agent_reach/channels/github.py` |
| YouTube read + subtitles + search | CONFIRMED_BY_CODE | `yt-dlp`; `agent_reach/channels/youtube.py` |
| Bilibili read + search | CONFIRMED_BY_CODE | `bili-cli` (yt-dlp 412-blocked, retired); `agent_reach/channels/bilibili.py` |
| RSS/Atom read | CONFIRMED_BY_CODE | `feedparser`; `agent_reach/channels/rss.py` |
| Twitter/X read + search | CONFIRMED_BY_CODE | `twitter-cli` + cookie, or OpenCLI fallback |
| Reddit read + search | CONFIRMED_BY_CODE | OpenCLI (desktop) or `rdt-cli` + cookie; no zero-config path |
| Instagram read | PARTIAL | OpenCLI desktop browser session only (manual Chrome extension install required) OR official Graph API (Business/Creator + app review); not zero-config; server environments skip OpenCLI channels |
| Facebook / LinkedIn / XiaoHongShu | PARTIAL | OpenCLI desktop-only or MCP/QR login; not zero-config |
| Health-check diagnostics | CONFIRMED_BY_CODE | `agent-reach doctor` (also `--json`); `agent_reach/doctor.py` `check_all` |
| Safe-mode install (no auto system changes) | CONFIRMED_BY_CODE | `agent-reach install --safe`, `--dry-run` |
| Cookie extraction from browser | CONFIRMED_BY_CODE | `agent_reach/cookie_extract.py` `configure_from_browser` (Chrome/Firefox/Edge/Brave/Opera) |
| Structured output normalization | PARTIAL | `agent_reach format xhs` formats XiaoHongShu JSON; no general structured contract per connector |
| Persistent source records / provenance schema | NOT_IMPLEMENTED | It is a capability layer, not a data store; no database |
| Research workflow / orchestration | NOT_IMPLEMENTED | Not an orchestrator; "capability layer, not yet another tool" |
| Read-only boundary enforced | DOCUMENTED_ONLY | README "Capability Boundary: Reading Content vs Operating Web Pages"; pairs with BrowserAct for hands-on actions |
| Instagram official Graph API | DOCUMENTED_ONLY | Listed as Instagram fallback; requires Business/Creator account + app review (not verified in code) |

Status label counts: CONFIRMED_BY_CODE=11, PARTIAL=2, DOCUMENTED_ONLY=2, NOT_IMPLEMENTED=2.

## 4. Dependencies and versions
- Core: `requests>=2.28`, `feedparser>=6.0`, `python-dotenv>=1.0`, `loguru>=0.7`, `pyyaml>=6.0`, `rich>=13.0`, `yt-dlp>=2024.0`
- Optional: `playwright>=1.40` (browser), `mcp[cli]>=1.0`, `browser-cookie3>=0.19`
- Dev: `pytest>=8.0`, `ruff>=0.8`, `mypy>=1.12`, `types-requests`, `types-PyYAML`
- External tools installed at runtime by installer: `gh`, Node.js/npm, `mcporter`, `twitter-cli`, `bilibili-cli`, `rdt-cli` (pinned git source), OpenCLI (npm global + manual Chrome extension)
- Build: hatchling

## 5. Maintenance state
- Commit history (shallow, 1 visible commit): `722cfc5 Update README.md to English`
- Version 1.5.0; README claims channels "re-verified regularly on real machines" and cites a June 2026 backend switch (Bilibili yt-dlp → bili-cli)
- Issue/PR activity: not inspectable from shallow clone; README links GitHub Issues
- Assessment: claims active maintenance; shallow clone limits history verification

## 6. Security and policy fit
| Concern | Assessment |
|---|---|
| Read-only focus | DOCUMENTED_ONLY — README states reading vs operating boundary; hands-on browser actions delegated to BrowserAct (third-party) |
| Browser session reuse | OpenCLI reuses logged-in Chrome session; requires manual extension install; cookies stay local per README |
| CAPTCHA / rate-limit bypass | None claimed; backend switching when a path dies |
| Credentials handling | Cookies stored locally (`~/.agent-reach`), proxy saved; `agent-reach uninstall` removes tokens |
| SSRF / arbitrary fetch | Web channel uses Jina Reader (third-party proxy) for any URL — SSRF defense delegated to Jina Reader, not self-enforced |
| License compatibility | MIT — permissive |

## 7. Integration effort
- Python package (installable via pip) — language matches target stack
- BUT: it is a capability layer for agents to call CLI tools directly, not a library with an importable API for a Python service; no common `SourceConnector` protocol returning typed `FetchResult`/`DiscoveryResult`
- Instagram path requires desktop Chrome + OpenCLI extension (manual step) or gated official Graph API — not suitable for an unattended cloud worker
- Reuse outcome: cannot be dropped in as the connector layer; its channel registry + `doctor` health-check + ordered-backend-fallback are useful design patterns
- Verdict: **Outcome D (design reference only)**.

## 8. License and copyright
- MIT License file present; copyright 2025 Agent Eyes. Preserve notice if any code is ported.

## 9. Tests
- Dev dependencies include `pytest>=8.0`; `tests/` directory present; `test.sh` at root
- Not executed (would require Python env + optional system tools)
- Ruff (`E, F, I`, ignore E501) and mypy configured

## 10. Reuse decision matrix (1–5)

| Criterion | Score | Rationale |
|---|---|---|
| Functional fit (30%) | 3 | Broad platform coverage incl. web search, but Instagram is non-zero-config desktop-only or gated API; not a research orchestrator |
| Code and test quality (20%) | 4 | pytest/ruff/mypy, doctor diagnostics, safe/dry-run install |
| Integration effort (20%) | 2 | No typed importable connector contract; CLI-subprocess model; desktop-browser Instagram path |
| Security and policy fit (15%) | 4 | Read-only boundary documented; cookies local; no bypass |
| Maintenance and license clarity (15%) | 4 | MIT, v1.5.0, claimed regular re-verification |
| Weighted total | 3.0 | |

**Outcome: D — Use only as a design reference.** Relevant patterns: ordered backend list with primary/fallback, `doctor` health checks with machine-readable JSON, safe/dry-run install, cookie extraction from browser, channel registry. Not reused as dependency or wrapped CLI.

## 11. Blockers
- Instagram access requires an authorized desktop Chrome session with the OpenCLI extension (manual step) — incompatible with an unattended server worker, and browser automation must not bypass login/CAPTCHA/rate limits (blueprint rule 5).
- Official Instagram Graph API fallback requires Business/Creator account + app review — eligibility unknown.
- No typed connector contract or persistent provenance store.

## 12. Conclusion
Agent Reach is a well-maintained capability-routing layer with broad platform coverage and good operational tooling (`doctor`, safe install), but it is not a research orchestrator and its Instagram path is desktop-browser-dependent or officially-gated. Adopt its connector-routing and health-check patterns as design references only; do not rely on it for unattended Instagram research.
