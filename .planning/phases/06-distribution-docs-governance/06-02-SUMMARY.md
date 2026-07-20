---
phase: 06-distribution-docs-governance
plan: 02
subsystem: testing
tags: [docs-05, public-surface, guard-test, vitest, consumer-contract, nx-inputs]

# Dependency graph
requires:
  - phase: 06-01
    provides: the settled consumer surface (package.json exports/bin, start-cache-server/action.yml + entry.ts)
  - phase: 01-05
    provides: the barrel (index.ts), server.ts MAX_CACHE_BODY_BYTES, serve.ts + lib/* env-knob sources
provides:
  - The DOCS-05 enumerated, tested public-surface guard (packages/github-cache/src/public-surface.spec.ts)
  - An explicit-assertion-list contract for the D-04 consumer surface (value/type exports, action inputs, 7 env knobs, fixed 2 GiB body cap)
affects: [06-04 docs, future dogfood refactors, milestone-audit, verify-phase]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Explicit-assertion-list public-surface guard (not toMatchSnapshot): an intentional change edits the EXPECTED_* lists, so the contract diff is reviewable in the spec itself (D-05)"
    - "Runtime-barrel-keys for value exports + source-parse for type exports (type-only exports are erased from the runtime namespace)"
    - "Per-knob word-boundary presence cross-check against a fixed source-file set (a rename that orphans a documented knob fails the guard)"
    - "workspaceRoot test-input scoping so a guard that reads out-of-project files still re-runs on their drift (T-06-03-02 stale-cache precedent)"

key-files:
  created:
    - packages/github-cache/src/public-surface.spec.ts
  modified:
    - nx.json

key-decisions:
  - "Minimal barrel enumerated: value export is createCacheServer only; serve stays a bin, not a barrel export (D-04 / resolved open question 2). The RED gate used a bogus 'serve' to prove drift-detection."
  - "MAX_CACHE_BODY_BYTES asserted as a fixed 2 GiB const (2147483648), never listed among the tunable env knobs (resolved open question 1)."
  - "Type exports parsed from index.ts source (not the runtime barrel) because export type {...} is erased at runtime; value exports read from the runtime barrel keys (the authoritative shipped surface)."
  - "action.yml inputs parsed with a deterministic 2-space-indent line scan, no YAML dependency (ponytail)."

patterns-established:
  - "DOCS-05 guard style: enumerate the consumer contract only (D-04), exclude internal helpers structurally via barrel-key equality (never grep their names)"
  - "External-file guard inputs must be wired into the nx test target or a stale cache masks their drift"

requirements-completed: [DOCS-05]

coverage:
  - id: D1
    description: "Enumerated, tested public-surface guard: fails nx test github-cache on any unenumerated change to the barrel value exports, type exports, consumer action inputs, the 7 env knobs, or the fixed 2 GiB body cap"
    requirement: DOCS-05
    verification:
      - kind: unit
        ref: "packages/github-cache/src/public-surface.spec.ts (12 assertions; full suite 25 files / 451 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Drift-detection property proven via a real RED->GREEN sequence (RED: deliberately-wrong 'serve' export => value-exports assertion fails 1/12; GREEN: corrected => 451/451 pass)"
    requirement: DOCS-05
    verification:
      - kind: unit
        ref: "git 098598a (RED, 1 failed | 11 passed) -> 9ff8ba8 (GREEN, 451 passed)"
        status: pass
    human_judgment: false

# Metrics
duration: 10min
completed: 2026-07-21
status: complete
---

# Phase 06 Plan 02: DOCS-05 Public-Surface Guard Summary

**Explicit-assertion-list guard enumerating the D-04 consumer contract (barrel value export createCacheServer + 4 type exports, the single `port` action input, 7 env knobs, and the fixed 2 GiB `MAX_CACHE_BODY_BYTES`) that fails `nx test github-cache` on any unintended change; proven with a real RED->GREEN cycle.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-07-21T01:15:00+02:00
- **Completed:** 2026-07-21T01:25:00+02:00
- **Tasks:** 2 (RED, GREEN) + 1 deviation commit
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments
- Authored `public-surface.spec.ts`: a 12-assertion explicit-list guard for the D-04 consumer contract, mirroring the `pinned-deps.spec.ts` / `ppe-action.spec.ts` precedent (reads files via `import.meta.url`, no new dependency).
- Enumerated the REAL settled surface from the committed Wave-1 files: value export `createCacheServer` (minimal barrel, no `serve`), type exports `CacheBackend`/`GetHit`/`GetResult`/`PutResult`, the single `port` action input, the 7 consumer env knobs, and `MAX_CACHE_BODY_BYTES === 2147483648` as a fixed contract limit (not a knob).
- Proved drift-detection with a genuine RED commit (bogus `serve` -> value-exports assertion fails 1/12, on a real surface mismatch not a setup error) then a one-line GREEN correction (451/451 pass).
- Per-knob source cross-check (word-boundary) so a code rename that orphans a documented knob fails the guard (T-06-02-02).

## Task Commits

1. **Task 1 (RED): failing guard vs deliberately-wrong surface** - `098598a` (test)
2. **Task 2 (GREEN): correct guard to the real consumer surface** - `9ff8ba8` (test)
3. **Deviation (Rule 2): scope start-cache-server files into nx test inputs** - `e46e963` (chore)

_Note: this is a test-only artifact; see TDD Gate Compliance below._

## Files Created/Modified
- `packages/github-cache/src/public-surface.spec.ts` (created) - the DOCS-05 guard: 5 assertion groups (value exports, type exports, action inputs, env-knob set, fixed body cap) + 7 per-knob presence checks.
- `nx.json` (modified) - added `{workspaceRoot}/start-cache-server/action.yml` and `.../entry.ts` to the `test` targetDefaults inputs.

## Decisions Made
- **Minimal barrel:** value export = `createCacheServer` only; `serve` remains the `bin` (dist/serve.js), not a barrel export (D-04 / resolved OQ2). This exactly matched the committed `index.ts`, so the RED used a bogus `serve` purely to prove the guard fires.
- **`MAX_CACHE_BODY_BYTES` = fixed 2 GiB const**, asserted `=== 2147483648` and asserted NOT present in `EXPECTED_ENV_KNOBS` (resolved OQ1).
- **Value exports via runtime barrel keys; type exports via source parse** — type-only exports are erased from the runtime namespace, so `Object.keys(barrel)` alone would miss them; parsing `export type {...}` covers group (c) fully.
- **No YAML dependency** — a deterministic 2-space-indent line scan extracts the `inputs:` keys (ponytail; matches the ppe-action.spec.ts config-inspection style).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Scoped the two out-of-project guard inputs into the nx test target**
- **Found during:** Task 2 (GREEN), while confirming the guard's drift-detection holds under Nx caching.
- **Issue:** The guard reads `start-cache-server/action.yml` (action-input assertion) and `start-cache-server/entry.ts` (the `NX_*` env-knob presence check), but both live OUTSIDE the `github-cache` project, so the `nx test` target's default inputs do not track them. An edit to either would not bust the cache -> a stale pass could mask a real consumer-contract change. This is the exact T-06-03-02 stale-cache class that 06-03 already fixed for `SECURITY.md`/`LICENSE`/`package.json`. Leaving it unwired would partially defeat the plan's own success criterion ("an unintended change to ... the consumer action inputs ... fails nx test github-cache").
- **Fix:** Added `{workspaceRoot}/start-cache-server/action.yml` and `{workspaceRoot}/start-cache-server/entry.ts` to the `test` targetDefaults inputs in `nx.json`, mirroring the 06-03 precedent. Two explicit files (not a `start-cache-server/**` glob) to avoid churning the cache on the 2.4 MB committed bundle the guard never reads.
- **Files modified:** `nx.json`
- **Verification:** `node -e "JSON.parse(...)"` confirms nx.json parses; `nx show project github-cache --json` confirms both inputs now register on the `test` target.
- **Committed in:** `e46e963` (separate chore commit, kept distinct from the test-only RED/GREEN commits)

---

**Total deviations:** 1 auto-fixed (1 missing-critical / Rule 2)
**Impact on plan:** In-pattern with an existing codebase fix (06-03), directly required to fully satisfy the plan's success criterion for the action-input + NX-knob portions of the surface. No scope creep beyond making the authored guard actually fire on drift. The plan's `files_modified` listed only the spec; this adds one config file, documented here.

## TDD Gate Compliance

This plan (`type: tdd`) produces a TEST-ONLY artifact (a guard spec); there is NO production code to write. The RED->GREEN cycle is therefore expressed entirely in the spec:
- **RED gate present:** `098598a` `test(06-02): ... RED vs deliberately-wrong surface` — the value-exports assertion fails 1/12 against a bogus `serve` entry (a real surface mismatch, not a setup/syntax error).
- **GREEN gate present:** `9ff8ba8` `test(06-02): correct ... (GREEN)` — one-line removal of `serve`; full suite 451/451.
- **No `feat(...)` commit exists**, and this is expected/correct: the "production under test" is the already-settled surface shipped by Phases 1-5 + the 06-01 consumer action, so both gates are honestly `test(...)` commits. This is the intended shape for a guard-only TDD plan, not a missing gate.

## Issues Encountered
None. The pre-existing global git hooks delegate to an absent repo-local `.githooks/`, so committing the intentionally-failing RED state was not blocked; only the `commit-msg` hook (strips AI attribution) is active.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- DOCS-05 is satisfied: the consumer contract is enumerated and any unenumerated change to it fails `nx test github-cache`.
- 06-04 (remaining incomplete plan) can reference this guard as the authoritative enumeration of the public surface when writing the config/versioning docs.
- No blockers.

## Self-Check: PASSED

- FOUND: packages/github-cache/src/public-surface.spec.ts
- FOUND: nx.json (modified)
- FOUND: .planning/phases/06-distribution-docs-governance/06-02-SUMMARY.md
- FOUND commits: 098598a (RED), 9ff8ba8 (GREEN), e46e963 (Rule 2 chore)

---
*Phase: 06-distribution-docs-governance*
*Completed: 2026-07-21*
