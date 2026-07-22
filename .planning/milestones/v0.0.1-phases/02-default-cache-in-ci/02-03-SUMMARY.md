---
phase: 02-default-cache-in-ci
plan: 03
subsystem: infra
tags: [concurrency, promise, in-process-lock, vitest, tdd]

# Dependency graph
requires:
  - phase: 02-01
    provides: "@actions/cache exact pin + the src/lib module home for Phase 2 primitives"
provides:
  - "withHashLock(hash, fn): process-wide per-hash serialization primitive"
  - "inFlightHashCount(): test-only in-flight map size probe"
affects: [02-05, actions-cache-backend, serve, write-path]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Module-global Map<hash,Promise> lock chained via .then(run,run)"
    - "Deferred-promise + shared order log deterministic concurrency spec (no timers)"

key-files:
  created:
    - packages/github-cache/src/lib/with-hash-lock.ts
    - packages/github-cache/src/lib/with-hash-lock.spec.ts
  modified: []

key-decisions:
  - "Store a non-rejecting tail in the map but return the real result promise, so a rejection reaches its own caller while later waiters never inherit it."
  - "Evict only on inFlight.get(hash) === tail identity check, so a concurrent re-add is never clobbered."
  - "Chain with prior.then(run, run) so a rejected op still triggers the next same-hash op (no wedge)."
  - "Ceiling comment-locked: single-process / ephemeral single-tenant runner; a distributed lock is out of scope (D-03)."

patterns-established:
  - "Deferred-promise concurrency testing: settle order driven by resolve()/reject(), asserted via a shared string log and inFlightHashCount() -- never elapsed time."
  - "Test-only observability probe (inFlightHashCount) doc-marked as NOT part of the consumer contract."

requirements-completed: [TEST-02]

coverage:
  - id: D1
    description: "withHashLock serializes two same-hash operations (the second fn does not start until the first settles)"
    requirement: "TEST-02"
    verification:
      - kind: unit
        ref: "packages/github-cache/src/lib/with-hash-lock.spec.ts#serializes two operations on the same hash (TEST-02)"
        status: pass
    human_judgment: false
  - id: D2
    description: "withHashLock runs two different hashes concurrently (both fn bodies start before either settles)"
    requirement: "TEST-02"
    verification:
      - kind: unit
        ref: "packages/github-cache/src/lib/with-hash-lock.spec.ts#runs two different hashes concurrently (TEST-02)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The map entry for a hash is evicted once its tail settles (inFlightHashCount returns to baseline)"
    requirement: "TEST-02"
    verification:
      - kind: unit
        ref: "packages/github-cache/src/lib/with-hash-lock.spec.ts#evicts a hash entry once its tail settles (TEST-02)"
        status: pass
    human_judgment: false
  - id: D4
    description: "A rejected operation reaches its own caller and does not wedge the lock; the next same-hash op still runs"
    requirement: "TEST-02"
    verification:
      - kind: unit
        ref: "packages/github-cache/src/lib/with-hash-lock.spec.ts#does not wedge the queue when an operation rejects (TEST-02)"
        status: pass
    human_judgment: false

# Metrics
duration: 5min
completed: 2026-07-19
status: complete
---

# Phase 2 Plan 03: Per-Hash Write Lock Summary

**`withHashLock` -- a module-global `Map<hash,Promise>` that serializes same-hash operations, runs distinct hashes concurrently, evicts each entry on settle, and never wedges on a rejected op (TEST-02), all proven deterministically with deferred promises and a shared order log (no timers).**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-07-19
- **Completed:** 2026-07-19
- **Tasks:** 1 (TDD: RED -> GREEN)
- **Files modified:** 2 (both created)

## Accomplishments
- `withHashLock(hash, fn)` per-hash serialization primitive with all four TEST-02 concurrency properties GREEN.
- `inFlightHashCount()` test-only probe making the eviction property directly observable without exposing internal state to the consumer contract.
- Deterministic concurrency spec (deferred promises + shared order log), the first such technique in this repo; no `setTimeout` sequencing and no fake timers.

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): failing per-hash lock concurrency spec (TEST-02)** - `e33d7df` (test)
2. **Task 1 (GREEN): implement per-hash write lock (TEST-02)** - `8d549b7` (feat)

_Note: TDD task -- the RED `test(02-03)` commit precedes the GREEN `feat(02-03)` commit._

## Files Created/Modified
- `packages/github-cache/src/lib/with-hash-lock.ts` - `withHashLock` + `inFlightHashCount`; Research Pattern 3 verbatim with the D-03 ceiling comment.
- `packages/github-cache/src/lib/with-hash-lock.spec.ts` - four-property TEST-02 spec (serialize / concurrent / evict / no-wedge) via deferred promises and a shared order log.

## Decisions Made
- Non-rejecting `tail` stored in the map, real `result` returned to the caller (T-2-08 repudiation mitigation: a failed write rejects to its caller rather than being absorbed by the lock).
- Identity-checked eviction (`inFlight.get(hash) === tail`) so a concurrent re-add is not clobbered (T-2-07 unbounded-map mitigation).
- `prior.then(run, run)` chaining so a rejection never wedges the same-hash queue (T-2-07 wedge mitigation).
- Ceiling comment-locked to single-process / ephemeral single-tenant runner; distributed lock out of scope (D-03).
- Eviction asserted against a captured baseline rather than an absolute size, so the module-global map cannot make the spec order-dependent.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- `state.record-metric` and `state.add-decision` gsd-tools verbs require named flags (`--phase`/`--plan`/`--summary`), not positional args; re-invoked with flags. Not a code issue.

## Threat Model Coverage
- T-2-06 (Tampering / same-hash write truncation): `withHashLock` serializes every same-hash op through the chained promise -- covered by the serialize test. Composition into the write path is Plan 02-05.
- T-2-07 (DoS / wedged queue + unbounded map): `.then(run, run)` no-wedge + identity-checked eviction -- covered by the no-wedge and evict tests.
- T-2-08 (Repudiation / swallowed failure): non-rejecting tail but real result returned -- covered by the no-wedge test.
- T-2-SC (install vector): accepted -- no package install in this plan (Node stdlib only, zero new deps).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `withHashLock` is standalone and NOT yet wired into the write path -- that composition happens in Plan 02-05 at the same single point where SIGTERM in-flight tracking attaches (per the plan objective and Pattern-map note). No blockers.

## Self-Check: PASSED
- FOUND: packages/github-cache/src/lib/with-hash-lock.ts
- FOUND: packages/github-cache/src/lib/with-hash-lock.spec.ts
- FOUND commit: e33d7df (RED test)
- FOUND commit: 8d549b7 (GREEN feat)
- RED precedes GREEN in git history: confirmed
- `npx nx test github-cache`: 60 passed (4 new TEST-02 properties GREEN)
- `npx nx run-many -t typecheck build`: green

---
*Phase: 02-default-cache-in-ci*
*Completed: 2026-07-19*
