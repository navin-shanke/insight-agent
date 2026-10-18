# Audit Report — OpenMagpie (`obris-dev/openmagpie`)

**Audited against:** INSIGHT_AGENT_MASTER_BLUEPRINT Part II (Candidate 3 — reference/reusable component for scheduled monitoring and relevance filtering)
**Source:** https://github.com/obris-dev/openmagpie
**Local checkout:** `C:\Users\USER\AppData\Local\Temp\opencode\candidates\openmagpie` (shallow clone, `--depth 1`)
**Audit date:** 2026-10-19
**Auditor:** OpenCode (Phase 0)

## 1. Identity
| Field | Value | Evidence |
|---|---|---|
| Repository | obris-dev/openmagpie | README.md |
| License | Apache 2.0 | `LICENSE` file; optional `**/ee/` enterprise directories reserved |
| Language / runtime | Python (Django backend + uv workspace; CLI via Typer/httpx/Pydantic; web in Next.js) | `pyproject.toml`, `uv.lock`, README Project structure |
| Version | tracked via release-please / version.txt | `.release-please-manifest.json`, `version.txt` |
| Install method | `git clone` + `./scripts/quickstart/run.sh` or `curl -fsSL https://openmagpie.ai | sh`; needs Docker and uv | README.md Quickstart |
| CI | `.github/` present; pre-commit config | `.pre-commit-config.yaml`, `.github/` |

## 2. Purpose in our plan
Reference or reusable component for scheduled monitoring and relevance filtering: polls curated sources (feeds), runs an LLM semantic filter over new items, delivers matches via webhook/log; single-flight per-stage tickers; at-least-once delivery with dedup keys.

## 3. Capability audit

| Capability | Status | Evidence |
|---|---|---|
| Scheduled polling of sources | CONFIRMED_BY_CODE | Per-stage tickers (poll feeds, trigger watches, drain runs, flush digests); single-flight; `make up-jobs`/`make down-jobs`; cron-friendly |
| Semantic relevance filtering via LLM | CONFIRMED_BYCODE | `engine/` — Engine Protocol + OpenAICompatEngine + registry; `semantic_filter` action kind; any OpenAI-compatible /v1 (Ollama, vLLM, llama.cpp, LM Studio, OpenAI) |
| Deduplication / persistent state | CONFIRMED_BY_CODE | Delivery key = `source:external_id`; at-least-once, receivers dedup; per-attempt `WatchActionDelivery` rows auditable (`delivery list/get`) |
| Feed + watch + action-chain model | CONFIRMED_BY_CODE | `apps/core/feeds/`, `watches/`: Feed, Source, FeedItem, Watch, WatchFeed, WatchPath, WatchAction, WatchActionRun, WatchActionDelivery |
| Instant + digest delivery modes | CONFIRMED_BY_CODE | README "Delivery modes: instant, digest"; webhook POST/PUT/PATCH |
| Connectors shipped | CONFIRMED_BY_CODE | X/Twitter (`twitter_search`), YouTube (`youtube_search`), Reddit (`reddit_subreddit`), Hacker News (`hn_feed`, `hn_comment`), RSS/Atom (`rss`) |
| Instagram support | NOT_IMPLEMENTED | README Roadmap: "Facebook, TikTok, and Instagram (soon to be added)"; grep for `instagram` in `*.py` found no files; `apps/core/sources/connectors/` = hackernews, reddit, rss, twitter, youtube |
| Local-first / BYO LLM | CONFIRMED_BY_CODE | `ENGINE_BASE_URL`/`ENGINE_MODEL`; default Ollama `:11434` |
| Claims extraction / verification | NOT_IMPLEMENTED | Not part of social-listening scope |
| Dashboard UI for tasks/reports | PARTIAL | `web/` Next.js apps exist (app, marketing, email-render); README says "A UI / hosted version is on the way" |
| Tests | CONFIRMED_BY_CODE | `apps/core/sources/tests.py`, `tests_hackernews.py`, `tests_reddit_combined.py`, `tests_ratelimit.py`, `tests_twitter.py`, `tests_twitter_cookies.py`, `tests_youtube.py` |
| challenge_bypass module | PRESENT (policy risk) | `apps/core/sources/connectors/challenge_bypass.py` — inspect before any use; may conflict with blueprint rule 5 (do not bypass login/CAPTCHA/challenges) |

Status label counts: CONFIRMED_BY_CODE=10, NOT_IMPLEMENTED=2, PARTIAL=1, plus PRESENT policy-risk item.

## 4. Dependencies and versions
- Lockfile: `uv.lock` (216 KB) — full Python dependency tree pinned
- Backend: Django (DRF for auth API), common base (ULID PK, timestamps, locks + lease renewer, db ceilings, `/healthz`)
- CLI: Typer + httpx + Pydantic, standalone wheel
- Schema: `packages/openmagpie-schema` (pure Pydantic)
- Web: pnpm workspace (Next.js + Tailwind)
- Optional enterprise dirs `**/ee/` (not inspected for license)

## 5. Maintenance state
- Commit history (shallow, 1 visible commit): `9967975 docs(readme): simplify the How-it-works diagram (#187)`
- Changelog: `CHANGELOG.md` (42 KB) with per-release history
- Release tooling: release-please (`release-please-config.json`)
- AGENTS.md present for design conventions (char pointers, typed-blob pattern, trigger/drain/flush execution model)
- Assessment: actively maintained with changelog and release automation; shallow clone limits full history

## 6. Security and policy fit
| Concern | Assessment |
|---|---|
| Challenge bypass | `challenge_bypass.py` present — potential conflict with blueprint rule 5 (do not circumvent login challenges/CAPTCHAs); must not be used |
| Browser cookies | Two connectors (X/Twitter always, YouTube age-restricted) need browser-session cookie; credentials/README has TOS caveat |
| Data retention | Telemetry opt-in/off by default; delivery history rows inspectable |
| License compatibility | Apache 2.0 — permissive; note `**/ee/` reserved commercial directories |

## 7. Integration effort
- Python/Django — language broadly compatible with target, but it is a complete social-listening application with its own scheduler, DB models, and web UI
- Importing the whole app would violate blueprint rule 10 ("Avoid importing an entire application when a small connector or scheduling pattern is sufficient") and rule "avoid two schedulers/two databases"
- Extracting small pieces (polling cadence, single-flight ticker, semantic filter, delivery dedup) is feasible but the connectors don't include Instagram
- Reuse outcome: design reference only for scheduling/polling/semantic-filter/delivery patterns
- Verdict: **Outcome D (design reference only)**.

## 8. License and copyright
- Apache 2.0 `LICENSE` file present. Preserve notice if any code is ported; `**/ee/` directories reserved for future commercial features (not inspected).

## 9. Tests
- Test files under `apps/core/sources/` (twitter, twitter_cookies, youtube, reddit_combined, hackernews, ratelimit)
- Not executed (requires Django/uv environment + possible network/cookies)

## 10. Reuse decision matrix (1–5)

| Criterion | Score | Rationale |
|---|---|---|
| Functional fit (30%) | 2 | Scheduling + semantic filtering fit, but NO Instagram and no claim verification/report generation |
| Code and test quality (20%) | 4 | Django structure, uv.lock, per-connector tests, changelog, release-please |
| Integration effort (20%) | 2 | Full app with own scheduler/DB/UI; extracting small parts is moderate effort; language match helps |
| Security and policy fit (15%) | 3 | `challenge_bypass.py` risk; cookie-based connectors; TOS caveats |
| Maintenance and license clarity (15%) | 4 | Apache 2.0, active changelog, release automation |
| Weighted total | 2.9 | |

**Outcome: D — Use only as a design reference.** Relevant patterns: per-stage single-flight ticker scheduling, feed/watch/action-chain model, semantic_filter with LLM, at-least-once delivery with dedup keys, auditable delivery rows. Do not import the whole application. Instagram not supported.

## 11. Blockers
- Instagram is roadmap-only, not implemented → cannot serve as the Instagram research module.
- `challenge_bypass.py` present → must not be used (blueprint rule 5).
- Full-application import would duplicate scheduler/database; prohibited by blueprint.

## 12. Conclusion
OpenMagpie is a maintained Apache-2.0 social-listening tool with useful scheduling, semantic-filtering, and delivery-audit patterns, but Instagram is not supported (roadmap only) and it lacks claim verification/report generation. Adopt its polling/delivery patterns as design references only; do not use as the Instagram or monitoring foundation.
