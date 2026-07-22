---
phase: 05-trust-widening-ppe-gate
plan: 01
subsystem: infra
tags: [github-actions, cache, trust, security, information-disclosure, leaf-module, tdd]

# Dependency graph
requires:
  - phase: 02-actions-cache-backend
    provides: cacheKeyFor + the nx-cache- prefix (actions-cache-backend.ts) and HASH_PATTERN (server.ts SRV-03)
  - phase: 04-publish-retention-observability
    provides: publish-mirror.ts nx-cache- prefix filter (D-16) + github-identity.ts leaf-extraction precedent
provides:
  - src/lib/cache-key.ts single-source leaf (CACHE_KEY_PREFIX, HASH_PATTERN, cacheKeyFor, isServerProducedKey)
  - hardened server-produced-key mirror filter (prefix + valid-hex, not startsWith-only)
  - single home for HASH_PATTERN shared by the SRV-03 server guard and the TRUST-08 filter
affects: [05-02-trust-widening, 05-03-codegen-selfcheck, 05-04-ppe-action, phase-06-distribution]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single-source leaf module (github-identity.ts precedent) owning one authored literal, consumed by siblings, imports nothing from siblings (no cycle)"
    - "Cross-file single-source count assertion: comment-strip + count === 1 fails the build on a duplicate authored literal"

key-files:
  created:
    - packages/github-cache/src/lib/cache-key.ts
    - packages/github-cache/src/lib/cache-key.spec.ts
  modified:
    - packages/github-cache/src/backend/actions-cache-backend.ts
    - packages/github-cache/src/backend/actions-cache-backend.spec.ts
    - packages/github-cache/src/publish/publish-mirror.ts
    - packages/github-cache/src/publish/publish-mirror.spec.ts
    - packages/github-cache/src/server/server.ts

key-decisions:
  - "isServerProducedKey = key.startsWith(CACHE_KEY_PREFIX) && HASH_PATTERN.test(suffix) - the full filter the Phase 4 startsWith-only subset lacked (D-08)"
  - "HASH_PATTERN moved out of server.ts into cache-key.ts so SRV-03 and TRUST-08 share one bounded lowercase-hex space (no second ^[a-f0-9]{1,512}$ literal)"
  - "cacheKeyFor output kept byte-identical (prefix+hash) so the Phase 2/4 restore key never drifts (T-05-08-03)"

patterns-established:
  - "Leaf single-source: one authored literal in a true leaf, guarded by a cross-file count===1 spec assertion"

requirements-completed: [TRUST-08]

coverage:
  - id: D1
    description: "cache-key.ts leaf exports CACHE_KEY_PREFIX, HASH_PATTERN, cacheKeyFor, isServerProducedKey"
    requirement: TRUST-08
    verification:
      - kind: unit
        ref: "packages/github-cache/src/lib/cache-key.spec.ts#isServerProducedKey admit/reject (TRUST-08)"
        status: pass
    human_judgment: false
  - id: D2
    description: "isServerProducedKey admits nx-cache-<valid hex>, rejects a foreign key, nx-cache-<non-hex>, uppercase, and the bare prefix"
    requirement: TRUST-08
    verification:
      - kind: unit
        ref: "packages/github-cache/src/lib/cache-key.spec.ts#isServerProducedKey admit/reject (TRUST-08)"
        status: pass
    human_judgment: false
  - id: D3
    description: "cacheKeyFor round-trips (isServerProducedKey(cacheKeyFor(h)) true for any hex h) and HASH_PATTERN preserves the 512 upper bound"
    requirement: TRUST-08
    verification:
      - kind: unit
        ref: "packages/github-cache/src/lib/cache-key.spec.ts#cacheKeyFor round-trip (TRUST-08, T-05-08-03)"
        status: pass
    human_judgment: false
  - id: D4
    description: "publishMirror filters via isServerProducedKey: a foreign key and nx-cache-<non-hex> are filtered BEFORE restore, never mirrored"
    requirement: TRUST-08
    verification:
      - kind: unit
        ref: "packages/github-cache/src/publish/publish-mirror.spec.ts#publishMirror server-produced-key filter (D-16/D-08/TRUST-08)"
        status: pass
    human_judgment: false
  - id: D5
    description: "backend derives its key through cacheKeyFor from the leaf; server shares HASH_PATTERN from the leaf; exactly one authored prefix literal remains across the leaf + consumers"
    requirement: TRUST-08
    verification:
      - kind: unit
        ref: "packages/github-cache/src/lib/cache-key.spec.ts#cache-key.ts single source (TRUST-08, T-05-08-02) - strict cross-file"
        status: pass
    human_judgment: false

# Metrics
duration: 9min
completed: 2026-07-20
status: complete
---

# Phase 5 Plan 01: Server-Produced-Key Single-Source Filter Summary

**Promoted the nx-cache- prefix + HASH_PATTERN into one src/lib/cache-key.ts leaf with a hardened isServerProducedKey (prefix + valid-hex) filter, and routed the Actions-cache backend, the publish/mirror path, and the HTTP server through it so the mirror admits only genuine server-produced keys (TRUST-08 / ADR C16, shipped FIRST per D-09).**

## Performance

- **Duration:** 9 min
- **Started:** 2026-07-20T11:30:00Z
- **Completed:** 2026-07-20T11:39:00Z
- **Tasks:** 2 (Task 1 TDD: RED + GREEN)
- **Files modified:** 7 (2 created, 5 modified)

## Accomplishments
- New `cache-key.ts` true leaf owns the ONE authored `nx-cache-` prefix, the shared `HASH_PATTERN`, `cacheKeyFor`, and the new `isServerProducedKey` filter.
- `isServerProducedKey` is the full filter (prefix + valid lowercase-hex suffix) the Phase 4 startsWith-only subset lacked: a foreign key or `nx-cache-<garbage>` is filtered out before restore, closing the info-disclosure gap where a foreign hex-keyed CI artifact could mirror to a world-readable Release asset (T-05-08-01).
- Backend, publish path, and server all now consume the single source; `HASH_PATTERN`'s second literal was removed from `server.ts` (SRV-03 and TRUST-08 share one home).
- publish-mirror fixtures hex-corrected (`h1`/`h2` -> `aa11`/`bb22`) plus a `nx-cache-zzz` rejection case proving the hardened filter drops a non-hex suffix.
- Strict cross-file single-source assertion (count === 1) guards against a duplicate authored literal re-appearing (T-05-08-02).

## Task Commits

Each task was committed atomically:

1. **Task 1: cache-key.ts leaf + filter spec (RED)** - `5008547` (test)
2. **Task 1: cache-key.ts leaf + filter spec (GREEN)** - `3880701` (feat)
3. **Task 2: route backend/publish/server through the leaf + hex-correct fixtures** - `33fc814` (refactor)

**Plan metadata:** (final docs commit)

_Note: TDD Task 1 has two commits (test -> feat); Task 2 is a single refactor commit._

## Files Created/Modified
- `packages/github-cache/src/lib/cache-key.ts` - NEW leaf: CACHE_KEY_PREFIX, HASH_PATTERN, cacheKeyFor, isServerProducedKey (single source, imports nothing from siblings).
- `packages/github-cache/src/lib/cache-key.spec.ts` - NEW: admit/reject matrix, cacheKeyFor round-trip, HASH_PATTERN bounds, leaf-import guard, and the strict cross-file single-source count.
- `packages/github-cache/src/backend/actions-cache-backend.ts` - imports cacheKeyFor from the leaf; inline definition + prefix literal removed.
- `packages/github-cache/src/backend/actions-cache-backend.spec.ts` - imports cacheKeyFor from `../lib/cache-key.js`.
- `packages/github-cache/src/publish/publish-mirror.ts` - filters via isServerProducedKey (prefix + HASH_PATTERN); inline CACHE_KEY_PREFIX + startsWith-only filter removed; doc updated to the D-08/TRUST-08 posture.
- `packages/github-cache/src/publish/publish-mirror.spec.ts` - hex-corrected fixtures + a nx-cache-<non-hex> rejection assertion.
- `packages/github-cache/src/server/server.ts` - imports HASH_PATTERN from the leaf; inline const removed; SRV-03 guard unchanged.

## Decisions Made
- None beyond the plan - executed as specified. The key design choices (full-suffix filter, HASH_PATTERN single home, byte-identical cacheKeyFor) were all pre-locked in the plan (D-08, T-05-08-02/03).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- `npx nx test github-cache --testFile=...` is rejected by vitest 4 (unknown option); vitest takes a positional name filter (`-- cache-key`). Minor tooling correction, no code impact.

## Threat Surface
No new security-relevant surface introduced. This plan CLOSES threat T-05-08-01 (information disclosure): the hardened filter rejects foreign/non-hex keys before they can be mirrored. T-05-08-02 (dual-literal drift) is guarded by the cross-file count===1 assertion; T-05-08-03 (key-output drift) is held by the byte-identical cacheKeyFor plus the existing backend key-agreement spec. No threat_flags.

## Known Stubs
None.

## Verification
- `npx nx test github-cache` - 19 files, 245 tests green (13 in the new cache-key.spec.ts).
- `npx nx typecheck github-cache` - green.
- `npx nx build github-cache` - green.
- `npm run fallow:ci` - 0 issues (cache-key.ts reachable via its importers; no dead-code finding).
- `npx nx format:check --all` - exit 0.

## Next Phase Readiness
- TRUST-08 is closed and shipped FIRST (D-09), so a private-repo mirror can now be enabled without risk of leaking a foreign hex-keyed artifact.
- `cache-key.ts` is the single home for the key namespace; 05-02 (trust widening), 05-03 (codegen/selfcheck), and 05-04 (PPE action) proceed independently.

## Self-Check: PASSED

- FOUND: packages/github-cache/src/lib/cache-key.ts
- FOUND: packages/github-cache/src/lib/cache-key.spec.ts
- FOUND: .planning/phases/05-trust-widening-ppe-gate/05-01-SUMMARY.md
- FOUND commits: 5008547 (RED), 3880701 (GREEN), 33fc814 (refactor)

---
*Phase: 05-trust-widening-ppe-gate*
*Completed: 2026-07-20*
