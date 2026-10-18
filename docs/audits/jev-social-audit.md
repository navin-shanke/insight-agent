# Audit Report — Jev Social (`socai-io/jev-social`)

**Audited against:** INSIGHT_AGENT_MASTER_BLUEPRINT Part II (Candidate 1 — potential primary Instagram/social research module)
**Source:** https://github.com/socai-io/jev-social
**Local checkout:** `C:\Users\USER\AppData\Local\Temp\opencode\candidates\jev-social` (shallow clone, `--depth 1`)
**Audit date:** 2026-10-19
**Auditor:** OpenCode (Phase 0)

## 1. Identity
| Field | Value | Evidence |
|---|---|---|
| Repository | socai-io/jev-social | README.md |
| License | MIT | `LICENSE` file present (MIT License, copyright 2026 jev-social contributors) |
| Language / runtime | Node.js >=22 (type: module) | `package.json` engines `"node": ">=22"`, `.nvmrc` |
| Version | 0.1.13 | `package.json` |
| Primary branch | main | shallow clone default branch |
| CI workflows | test.yml, codeql.yml, npm-publish.yml, pages.yml, plugin-security-scan.yml | `.github/workflows/` |
| Install method | `npx github:socai-io/jev-social#v0.1.13` or `git clone` + `npm install` | README.md "Try it" |

## 2. Purpose in our plan
Potential primary Instagram/social research module: read-only Instagram/TikTok/LinkedIn browsing through a user's own authenticated Chrome session, executed by an external `socai CLI`; a TypeSafe Jev decision loop picks bounded operations; output is a source-cited evidence report.

## 3. Capability audit (status labels: CONFIRMED_BY_CODE / TESTED_SUCCESSFULLY / DOCUMENTED_ONLY / PARTIAL / BLOCKED / NOT_IMPLEMENTED / UNKNOWN)

| Capability | Status | Evidence |
|---|---|---|
| Read-only Instagram search | CONFIRMED_BY_CODE | `src/socai.js` `buildSearchArgs(["instagram","search",query,limit])`; `src/app.js` platform allowlist `{instagram,tiktok,linkedin}`; AGENTS.md "read-only Instagram, TikTok, and LinkedIn research" |
| Open Instagram profile + post cards | CONFIRMED_BY_CODE | README "open a profile and its post cards"; `src/socai.js` STATUS_OPERATIONS includes `profile`, `get-posts` |
| Open specific post/reel + read comments | CONFIRMED_BY_CODE | README "open a specific post/reel and read comments"; `src/evidence.js` `extractEvidence` handles `read_post` with `top_comments` |
| Inspect page state | CONFIRMED_BY_CODE | `src/socai.js` STATUS_OPERATIONS includes `page_state`; README "inspect page state" |
| Source-cited evidence report | CONFIRMED_BY_CODE | `src/evidence.js` `evidenceReport()` emits `[Source](url)` per item; README "Every accepted finding must cite a captured source" |
| Partial results preserved on gate/failure | CONFIRMED_BY_CODE | `src/app.js` statuses `blocked`, `partial`, `step_limit`, `decision_failed`, `interrupted`; checkpoint saved before throw |
| Credentials/cookies not read or logged | CONFIRMED_BY_CODE | README Privacy "does not read or copy the browser cookie store directly"; `src/evidence.js` `PRIVATE_EVIDENCE_KEY` redacts cookie/token/authorization headers; `publicEvidence` strips private keys |
| Loopback-only UI (127.0.0.1:8766) | CONFIRMED_BY_CODE | README "Opens http://127.0.0.1:8766. Loopback only."; `src/server.js` per AGENTS.md |
| Offline test suite (no real accounts/browser/OpenRouter) | CONFIRMED_BY_CODE | AGENTS.md Testing guidance "Automated tests must remain offline..."; `package.json` test = `node --test` |
| Broad discovery of all public Reels | NOT_IMPLEMENTED | Blueprint rule 5; README does not claim unrestricted discovery; Jev chooses targets from observed results |
| Official Instagram API usage | NOT_IMPLEMENTED | Uses `socai CLI` browser session, not Meta API |
| Python library importable | NOT_IMPLEMENTED | Node.js application; `exports` exposes `src/index.js` only (CLI surface) |

Status label counts: CONFIRMED_BY_CODE=8, NOT_IMPLEMENTED=3.

## 4. Dependencies and versions
- Runtime: Node.js 22+ (Node 24 used in CI; 22 oldest supported LTS) — AGENTS.md Setup
- External (NOT bundled, required at runtime): `socai CLI` binary (separate project, `SOCAI_BIN` or PATH), decision provider (OpenRouter key or loopback Kev/System One endpoint), Chrome browser with signed-in session
- npm scripts: `start`, `dev`, `check` (syntax-check all shipped JS), `test` (`node --test`), benchmark:run/summarize
- No `package-lock.json` of substance (398 bytes) — dependency footprint minimal because execution is delegated to `socai CLI`

## 5. Maintenance state
- Commit history (shallow, 1 visible commit): `2f02e6f Add versioned import-only Reel library contract (#127)`
- Releases: npm-publish workflow present; README references `v0.1.13`, `v0.1.8`, `v0.1.10`
- Issue/PR activity: not inspectable from shallow clone; README links "good first issues" and Discord
- Recent activity: release tagging and npm publish workflow indicate active up to at least v0.1.13
- Assessment: appears maintained, but shallow clone limits full history verification

## 6. Security and policy fit
| Concern | Assessment |
|---|---|
| Read-only (no post/like/follow/DM) | CONFIRMED_BY_CODE — AGENTS.md non-negotiable boundary |
| Browser login required | Yes — user's own Chrome profile; README advises separate profile/test account |
| CAPTCHA/rate-limit bypass | None; stops and reports blocked access (AGENTS.md) |
| Secrets in logs/source | Redacted (`sanitizeCliErrorText`, `publicEvidence`, `PRIVATE_EVIDENCE_KEY`); `SOCAI_TELEMETRY=0` default |
| OpenRouter data flow | Decision requests include goal + visible text excerpts; README warns user input and visible social content are untrusted |
| SSRF / arbitrary fetch | Not applicable — navigation handled by socai CLI in user's browser |
| License compatibility | MIT — permissive, compatible |

## 7. Integration effort
- Language mismatch: Node.js vs target Python/FastAPI stack (blueprint Part III)
- External binary dependency: `socai CLI` is a separate installable, not a library; cannot be imported as a Python module
- External model dependency: OpenRouter key required for Jev decisions (or self-hosted Kev/System One loopback)
- Browser dependency: real Chrome session required; not headless-serviceable in a server worker without a desktop profile
- Reuse outcome: cannot be a dependency; wrapping via subprocess would require managing the socai CLI + browser profile on the worker — high operational complexity
- Verdict: **Outcome D (design reference only)**. Relevant patterns: read-only operation allowlist, typed decision validation, evidence sanitization/redaction, partial-result checkpointing, source-linked report generation, `status`/`stopReason` run shape.

## 8. License and copyright
- MIT License file present; copyright 2026 jev-social contributors. If any code is ported, preserve the MIT license and copyright notice.

## 9. Tests
- Command: `npm test` (`node --test`) — offline, no credentials
- Inspected `test/` directory statically (not executed; would require Node 22 environment)
- CI runs `npm ci` then `npm run check` and `npm test` (AGENTS.md)

## 10. Reuse decision matrix (1–5)

| Criterion | Score | Rationale |
|---|---|---|
| Functional fit (30%) | 2 | Read-only Instagram research fits, but depends on external socai CLI + OpenRouter + Chrome; not a self-contained research orchestrator |
| Code and test quality (20%) | 4 | Well-structured, offline tests, sanitization, CI, codeql |
| Integration effort (20%) | 1 | Node.js + external binary + browser session; high effort to wrap in Python worker |
| Security and policy fit (15%) | 5 | Read-only, credential redaction, loopback-only, no bypass |
| Maintenance and license clarity (15%) | 4 | MIT, releases, CI, recent version tags |
| Weighted total | 2.55 | |

**Outcome: D — Use only as a design reference.** Do not reuse as dependency or wrap as CLI at this time. If a future Phase requires browser-based Instagram inspection and the socai CLI is separately authorized, reconsider outcome B (wrap CLI behind an adapter) with the external-binary dependency documented.

## 11. Blockers
- `socai CLI` is an external dependency not present in this workspace and not authorized for installation.
- OpenRouter key / Chrome session required for a live run; neither is configured; live test requires explicit user authorization (blueprint rule 8).
- Node.js runtime not part of target stack; introduces a second language/runtime.

## 12. Conclusion
Jev Social is a well-engineered, read-only, browser-grounded social research tool with strong security boundaries, but it is not a foundation for Insight Agent: it is Node.js, depends on an external `socai CLI` binary and an OpenRouter key, and requires a real Chrome browser session. Adopt its evidence-sanitization, partial-result checkpointing, and source-linked report patterns as design references only. Instagram access via this path remains contingent on a separate socai CLI + authorized browser session.
