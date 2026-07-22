---
phase: 02-default-cache-in-ci
plan: 05
subsystem: infra
tags: [nx-remote-cache, github-actions-cache, composition-root, sigterm-drain, concurrency, trust-gate]

# Dependency graph
requires:
  - phase: 02-02
    provides: isWriteTrusted(env) default-deny write-trust predicate + TRUSTED_EVENTS
  - phase: 02-03
    provides: withHashLock(hash, fn) per-hash serialization primitive
  - phase: 02-04
    provides: createActionsCacheBackend() Actions-cache CacheBackend + cacheArchivePath
  - phase: 01
    provides: createCacheServer/serve composition root, createReadOnlyMemoryBackend 403 seam, CacheBackend port
provides:
  - "selectBackend(env): the single context-derived backend selection point (RW in trusted CI, RO everywhere else, no caller-facing mode flag)"
  - "resolveGitHubToken(env): GH_TOKEN || GITHUB_TOKEN fallthrough (Phase 3 consumes it)"
  - "serve() wired to selectBackend + a put-decorator carrying the per-hash lock and in-flight tracking"
  - "RunningServer.shutdown(): bounded SIGTERM drain of in-flight writes"
affects: [phase-03-releases-reader, phase-05-trust-widening, phase-06-dogfood-action]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Composition-root backend selection: one pure function derives RW-vs-RO from runtime context; the server never sees a mode flag"
    - "Inline put-decorator: a single wrapper at composition applies withHashLock AND records in-flight puts, keeping server.ts untouched"
    - "Deterministic drain seam: shutdown() is triggered directly by tests; the SIGTERM handler calls shutdown() then exits"
    - "Module-mock the selection point in serve.spec.ts to inject controlled backends without ambient CI env"

key-files:
  created:
    - packages/github-cache/src/lib/select-backend.ts
    - packages/github-cache/src/lib/select-backend.spec.ts
  modified:
    - packages/github-cache/src/serve.ts
    - packages/github-cache/src/serve.spec.ts

key-decisions:
  - "selectBackend takes only the env bag (default process.env); no options object, no second arg, no env var requests write access (TRUST-05); proved structurally (selectBackend.length === 0) and behaviorally (override-shaped keys still yield forbidden put)"
  - "Malformed GITHUB_REPOSITORY in trusted context THROWS (fail-closed); an absent/empty token DEGRADES to read-only (do not throw) so a merely-unwired workflow does not break the build"
  - "resolveGitHubToken uses || not ?? so a set-but-empty token falls through (Pitfall 8)"
  - "serve keeps calling selectBackend(process.env); it gained NO backend-injection option -- serve.spec.ts mocks the selection module instead, preserving the no-write-surface property"
  - "shutdown() bounds the drain with an unref'd timer so a hung write yields to the runner's SIGKILL rather than deadlocking wait-all; shutdownGraceMs is a teardown-timing knob, explicitly not a mode switch"
  - "createReadOnlyMemoryBackend() reused as the local RO backend; no src/backend/read-only-backend.ts created (resolved planning decision)"

patterns-established:
  - "Context-derived RW/RO selection with no caller-facing mode surface (CREEP control C1)"
  - "One composition-point put-decorator carries both the concurrency lock and the shutdown drain"

requirements-completed: [TEST-01, TRUST-05, ROBUST-04]

coverage:
  - id: D1
    description: "selectBackend(env) returns the writable Actions-cache backend on push/schedule in CI and a read-only backend on every other event, locally, and when preconditions are unmet"
    requirement: "TEST-01"
    verification:
      - kind: unit
        ref: "packages/github-cache/src/lib/select-backend.spec.ts#selectBackend context selection (TEST-01, TRUST-05)"
        status: pass
    human_judgment: false
  - id: D2
    description: "No caller-facing mode surface on the selection path -- proved structurally (selectBackend.length === 0) and behaviorally (override-shaped extra env keys still yield a forbidden put)"
    requirement: "TRUST-05"
    verification:
      - kind: unit
        ref: "packages/github-cache/src/lib/select-backend.spec.ts#TRUST-05: no caller-facing mode surface"
        status: pass
    human_judgment: false
  - id: D3
    description: "Fail-closed repository validation (malformed GITHUB_REPOSITORY throws) and token fallthrough (GH_TOKEN || GITHUB_TOKEN, set-but-empty falls through)"
    requirement: "TEST-01"
    verification:
      - kind: unit
        ref: "packages/github-cache/src/lib/select-backend.spec.ts#selectBackend fail-closed repository validation (TEST-01) + resolveGitHubToken fallthrough (TEST-01)"
        status: pass
    human_judgment: false
  - id: D4
    description: "serve composes selectBackend and routes every write through the per-hash lock (same-hash serialized, different hashes overlap) with in-flight tracking"
    requirement: "TRUST-05"
    verification:
      - kind: integration
        ref: "packages/github-cache/src/serve.spec.ts#serve write path is locked per hash (TEST-02 wiring)"
        status: pass
    human_judgment: false
  - id: D5
    description: "RunningServer.shutdown() drains in-flight writes on SIGTERM within a bounded grace period; a hung write still lets shutdown resolve; the SIGTERM listener is registered by serve() and removed by shutdown()"
    requirement: "ROBUST-04"
    verification:
      - kind: integration
        ref: "packages/github-cache/src/serve.spec.ts#serve SIGTERM drain (ROBUST-04)"
        status: pass
    human_judgment: false

# Metrics
duration: 14min
completed: 2026-07-19
status: complete
---

# Phase 2 Plan 05: Composition Root Summary

**selectBackend(env) picks exactly one backend per process from runtime context (writable Actions-cache in trusted CI, read-only everywhere else, no caller-facing mode flag), and serve() composes it with the per-hash write lock plus a bounded SIGTERM in-flight drain.**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-07-19T04:57:00Z
- **Completed:** 2026-07-19T05:11:17Z
- **Tasks:** 2 (both TDD)
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments
- `selectBackend(env)` composes `isWriteTrusted` to return the writable Actions-cache backend only on a trusted CI trigger (`push`/`schedule`) and a read-only backend otherwise -- chosen entirely from runtime context, with no options object, second argument, or env var that can request write access (TRUST-05, proved both structurally and behaviorally against the repo's own tautological-test precedent).
- Fail-closed on a corrupted repository identity (malformed `GITHUB_REPOSITORY` throws), degrade-not-throw when the token is unresolvable, and `resolveGitHubToken` uses `||` (not `??`) so a set-but-empty token falls through (Pitfall 8).
- `serve()` now derives its backend from `selectBackend(process.env)`, wraps the write path in a single inline decorator that applies `withHashLock` and records in-flight puts, and exposes `RunningServer.shutdown()` -- a bounded SIGTERM drain that awaits in-flight writes up to a grace period backed by an unref'd timer, so a hung write yields to the runner's SIGKILL instead of deadlocking teardown (ROBUST-04). This also completes the TEST-02 wiring by attaching the lock to the real write path.
- `server/server.ts` is untouched, no `read-only-backend.ts` was created, and all four pitfall-locked pieces of `serve.ts` (zero-port fallback, `||` token fallthrough, `127.0.0.1` bind, `pathToFileURL` guard) survive verbatim.

## Task Commits

Each behavior-adding task ran as its own RED -> GREEN cycle:

1. **Task 1 (backend selection)** - RED `41a7443` (test) -> GREEN `3183c07` (feat)
2. **Task 2 (serve composition)** - RED `19f8f05` (test) -> GREEN `86d4e68` (feat)
   - Interposed fix `70f1edf` (fix) - see Deviations

RED precedes GREEN for both tasks (TDD gate satisfied).

## Files Created/Modified
- `packages/github-cache/src/lib/select-backend.ts` (created) - `selectBackend` + `resolveGitHubToken`; composes `isWriteTrusted`, reuses `createReadOnlyMemoryBackend`, validates `GITHUB_REPOSITORY` fail-closed.
- `packages/github-cache/src/lib/select-backend.spec.ts` (created) - TEST-01 case matrix + the TRUST-05 structural and behavioral no-mode-flag proofs; drives selection behaviorally via the returned backend's `put`.
- `packages/github-cache/src/serve.ts` (modified) - three localized edits: backend swap to `selectBackend(process.env)`, inline put-decorator (lock + in-flight tracking), and the bounded SIGTERM drain exposed as `RunningServer.shutdown`. Dropped the now-unused `createWritableMemoryBackend` import.
- `packages/github-cache/src/serve.spec.ts` (modified) - ROBUST-04 drain + hung-put + SIGTERM-listener assertions, and TEST-02 same-hash-serialize / different-hash-overlap wiring proofs; mocks the selection module to inject controlled backends.

## Decisions Made
See `key-decisions` frontmatter. Most load-bearing: `serve` gained NO backend-injection option (that would be a caller-facing write surface); tests inject backends by mocking `./lib/select-backend.js` instead, so the production selection path stays the sole, context-only decision point.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Cross-worker temp-file collision in select-backend spec**
- **Found during:** Task 2 (full `run-many` suite run after serve GREEN)
- **Issue:** `select-backend.spec.ts`'s writable-path cases drive the Actions backend's `put`, which writes `cacheArchivePath('abc123')` to the shared tmpdir. `actions-cache-backend.spec.ts` uses the same hash `'abc123'`, so the two spec files (run in parallel Vitest workers sharing the filesystem) raced on `/tmp/nx-github-cache-abc123.tar`, intermittently failing that file's "removes the temp archive" assertion.
- **Fix:** Changed the select-backend spec's fixture hash to a unique value (`'selectbackendfixture'`) and documented why the hash must stay distinct.
- **Files modified:** `packages/github-cache/src/lib/select-backend.spec.ts`
- **Verification:** `npx nx run-many -t typecheck build test --skip-nx-cache` green twice (99 tests, no flake).
- **Committed in:** `70f1edf` (separate `fix` commit, between Task 2 RED and GREEN)

---

**Total deviations:** 1 auto-fixed (1 bug).
**Impact on plan:** Test-isolation fix only; no production code affected, no scope creep. All acceptance criteria still met.

## Issues Encountered
- **Acceptance grep vs. Prettier formatting (non-blocking):** The Task 1 acceptance grep `export function selectBackend\(env` assumes a single-line signature, but Prettier wraps `selectBackend`'s signature across lines because its return type (`CacheBackend`) pushes the line past 80 columns (whereas `isWriteTrusted`'s `boolean` return fits). The property that grep proxies for -- exactly one declared parameter -- holds and is proven at runtime by the passing `selectBackend.length === 0` structural test. Prettier's `format:check` gates CI, so the wrapped form is the required house style; the code was not changed to satisfy the grep's layout assumption.

## Known Stubs
- **Local read always misses (intentional, Phase 3):** In untrusted/local context `selectBackend` returns `createReadOnlyMemoryBackend()`, whose store is empty, so `get` always misses. This is the resolved planning decision: the read-only backend is the deliberate Phase 3 placeholder for the real cross-context GitHub Releases reader. It is comment-documented in `select-backend.ts` and does not block this plan's goal (the composition wiring), which is complete.

## User Setup Required
None - no external service configuration required. (The real Actions-cache read/write path only runs inside the Phase 6 dogfood JS action on CI, where `ACTIONS_RUNTIME_TOKEN`/`ACTIONS_RESULTS_URL` are injected.)

## Next Phase Readiness
- The whole capability is now real: starting `serve` on a trusted CI trigger yields a loopback Nx cache server backed by GitHub's Actions cache; anywhere else it answers reads and refuses every write with a 403, with nothing an operator can pass to change that.
- Phase 3 swaps `createReadOnlyMemoryBackend()` for the real cross-context Releases reader at the one selection point, and consumes `resolveGitHubToken` for authenticated private-repo reads.
- Plan 06 (dogfood action + CI job) is the remaining Phase 2 plan; it launches this `serve()` from a JS action and asserts a real cross-run cache HIT.

---
*Phase: 02-default-cache-in-ci*
*Completed: 2026-07-19*

## Self-Check: PASSED
- All created/modified files exist on disk (select-backend.ts, select-backend.spec.ts, serve.ts, serve.spec.ts, 02-05-SUMMARY.md).
- All five commits verified in git history: 41a7443, 3183c07, 19f8f05, 70f1edf, 86d4e68.
