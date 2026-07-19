# Phase 3: Cross-Context Read - Discussion Log (Assumptions Mode)

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md - this log preserves the analysis.

**Date:** 2026-07-19
**Phase:** 03-cross-context-read
**Mode:** assumptions (--analyze --auto)
**Calibration:** minimal_decisive (USER-PROFILE Vendor Choices = opinionated)
**Areas analyzed:** TEST-05 strategy; OS-namespacing scope; auth chain + reader construction

## Assumptions Presented

### TEST-05 cross-OS round-trip strategy
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| Phase 3 TEST-05 = injected/faked Releases-client test (seed per-OS in-memory, assert hit/MISS/never-wrong-OS); live CI round-trip deferred to Phase 4 | Likely | repo-wide injected-client convention (`actions-cache-backend.spec.ts:17` vi.mock, `select-backend.spec.ts:11`); publisher is Phase 4 (`ROADMAP.md:305-315`); `publish-mirror-cross-os-gap` memory; spike 005 already ran the live matrix (run 29613149528, green); Phase 4 TEST-03 also injected-client |
| Reader accepts an injected read-client defaulting to native fetch; NOT a mode flag (TRUST-05 intact) | Likely | stateful per-OS seeding trivial with a fake client; `selectBackend` still constructs with the real default so `select-backend.spec.ts` shape unchanged |

### OS-namespacing scope (CORR-01)
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| Namespace ALL entries by default (`<hash>-<platform>`); no per-target portability classification | Confident | `ARCHITECTURE-DECISION.md` Decision 6; CORR-01 "OS-namespaced by default" (`REQUIREMENTS.md:57`); no portability signal exists to classify against; spike 005 `ci-roundtrip.mjs:94` `${sensHash}-${OS}`, proved non-namespaced serves last-writer (wrong result) |
| OS discriminator = `process.platform` (win32->windows/darwin->macos/else linux) in ONE comment-locked single-source helper (cacheArchivePath pattern); Phase 4 publisher reuses it | Confident | `os-sensitive-nx-hash-discriminator` memory (compiled-in, emulation-proof); `cache-archive-path.ts:4-17` template (D-03); `ROADMAP.md:307` "reader's key scheme settles first" |

### FOUND-02 local auth chain + reader construction
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| Full three-tier chain as a NEW `resolveLocalReadToken` (reuse env-tier `resolveGitHubToken`, then `gh auth token`, then `git credential fill`); do NOT extend in place; structural stdout parsing never stderr | Likely | FOUND-02 names all three (`REQUIREMENTS.md:11`, `ROADMAP.md:274-276`); `resolveGitHubToken` env-only, shared with CI write path, pinned by TEST-01 (`select-backend.spec.ts:162-179`); `ARCHITECTURE-DECISION.md:9` / `PITFALLS.md:233` gh-stderr hazard |
| Reader downloads via native global fetch (no dep): GET release by tag -> asset list -> GET asset by id with octet-stream + Bearer; Octokit is Phase 4 | Likely | D-01 zero-dep-lean; spikes 001/005 used dependency-free fetch on Node 24; `PITFALLS.md:192,200` routes Octokit error.status to Phase 4 |
| Read-only by construction (`put->forbidden`); every fault -> `{kind:'miss'}` never thrown; no anon fallback; local repo identity via `git remote get-url origin` | Likely | SC4 / SRV-05 / D-04; `PITFALLS.md:204-225`; FOUND-02 forbids anon (`REQUIREMENTS.md:11`); `GITHUB_REPOSITORY` CI-only, spike 001 passed owner/repo as args |

## Corrections Made

No corrections - `--auto` mode. All assumptions were Confident or Likely (zero Unclear), so the
present_assumptions auto fast-path applied: logged and proceeded directly to CONTEXT.md.

## Auto-Resolved

No Unclear items required auto-resolution. Note: the user explicitly directed the run to use the
`--analyze --auto` decision mechanism (interactive batch-table checkpoint was declined). The three
originally-flagged forks (TEST-05 strategy, OS-namespacing scope, auth chain) were candidates for a
human checkpoint under the trap-quadrant rule (high-impact); the dedicated analyzer's codebase
evidence raised each to Confident/Likely, moving them out of the trap quadrant, so auto-confirming
the recommended resolution is evidence-backed, not a blind default.

## External Research

Not spawned inline. Two research topics were flagged by the analyzer and folded into
CONTEXT.md `<specifics>` as pointers for gsd-phase-researcher (which runs next in plan-phase with
`--research`), avoiding a duplicate research agent:
1. `gh auth token` / `git credential fill` invocation + Windows subprocess mechanics (no in-repo
   precedent).
2. GitHub Releases authenticated fault-response matrix (403/404/429 shapes) for structural
   degrade-to-MISS discrimination.
