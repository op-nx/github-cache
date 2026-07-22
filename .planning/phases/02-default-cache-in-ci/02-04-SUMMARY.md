---
phase: 02-default-cache-in-ci
plan: 04
subsystem: backend
tags: [actions-cache, cache-backend, tdd, vitest, vi-mock, silent-miss]

# Dependency graph
requires:
  - phase: 02-01
    provides: "@actions/cache 6.2.0 + @actions/core 3.0.1 exact pins, and the src/lib module home for Phase 2 primitives"
provides:
  - "cacheArchivePath(hash): single comment-locked source of truth for the temp archive path"
  - "createActionsCacheBackend(): CacheBackend backed by GitHub's Actions cache (get->restoreCache, put->saveCache)"
  - "cacheKeyFor(hash): the nx-cache-<hash> Actions-cache key"
affects: [02-05, 02-06, select-backend, serve, write-path, ci-dogfood]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single-source, comment-locked temp path whose exact produced file name is pinned by a literal-string spec (silent-MISS guard, Pitfall 7)"
    - "vi.mock('@actions/cache') + vi.mocked(...) module mocking -- first module mock in the repo"
    - "Benign no-op absorption (saveCache -1 and ReserveCacheError -> 'stored') with fail-closed propagation of every other rejection"
    - "Temp-file cleanup in a finally block covering success and propagating-error paths"

key-files:
  created:
    - packages/github-cache/src/lib/cache-archive-path.ts
    - packages/github-cache/src/lib/cache-archive-path.spec.ts
    - packages/github-cache/src/backend/actions-cache-backend.ts
    - packages/github-cache/src/backend/actions-cache-backend.spec.ts
  modified: []

key-decisions:
  - "cacheArchivePath ships as its OWN exported lib module (not a private backend fn) precisely so its exact produced file name can be pinned by a spec -- the only assertion that fails on a cosmetic path rename."
  - "The pinned spec spells the literal nx-github-cache-abc123.tar out by hand rather than reconstructing it from the impl template, avoiding the tautology the test exists to prevent."
  - "createActionsCacheBackend() takes NO parameters (empty param list) -- RW-vs-RO is the upstream write gate's job, never a caller-facing mode flag (TRUST-05)."
  - "saveCache -1 and a ReserveCacheError rejection are both read as a benign no-op yielding 'stored' (D-04); every other rejection propagates so the server fails closed to a 500."
  - "The temp archive is removed in a finally block on every exit path (success, benign no-op, propagating error) so cache bytes are never left on a shared/reused runner (T-2-11)."
  - "This backend never returns 'forbidden' (403 is the RO backend's job) nor 'conflict' (409 is the contract/mirror layer's job)."

patterns-established:
  - "Literal-string pinned-path spec as the guard for the @actions/cache silent-MISS class (the MAX_CACHE_BODY_BYTES precedent applied to a path helper)."
  - "vi.mock module mocking with per-test vi.mocked return values and vi.resetAllMocks() teardown -- taken from 02-RESEARCH.md, no prior in-repo precedent."
  - "Path-agreement assertion: the recorded first argument of both restoreCache and saveCache is compared to each other AND to cacheArchivePath(hash)."

requirements-completed: [ROBUST-03]

coverage:
  - id: D1
    description: "cacheArchivePath produces exactly nx-github-cache-<hash>.tar, an absolute path under the OS temp dir, stable per hash and distinct across hashes"
    requirement: "ROBUST-03"
    verification:
      - kind: unit
        ref: "packages/github-cache/src/lib/cache-archive-path.spec.ts#produces exactly the file name nx-github-cache-abc123.tar for hash abc123 (ROBUST-03)"
        status: pass
    human_judgment: false
  - id: D2
    description: "get maps to restoreCache: a matched key reads the archive and returns a hit; undefined returns a miss"
    requirement: "ROBUST-03"
    verification:
      - kind: unit
        ref: "packages/github-cache/src/backend/actions-cache-backend.spec.ts#returns a hit with the restored archive bytes when restoreCache matches a key (ROBUST-03)"
        status: pass
    human_judgment: false
  - id: D3
    description: "put maps to saveCache and returns 'stored' for a positive id, for -1, and for a ReserveCacheError; any other rejection propagates"
    requirement: "ROBUST-03"
    verification:
      - kind: unit
        ref: "packages/github-cache/src/backend/actions-cache-backend.spec.ts#propagates any other saveCache rejection so the server fails closed (ROBUST-03)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Save and restore pass byte-identical single-element path arrays equal to cacheArchivePath(hash), with the same cacheKeyFor(hash) key"
    requirement: "ROBUST-03"
    verification:
      - kind: unit
        ref: "packages/github-cache/src/backend/actions-cache-backend.spec.ts#passes exactly cacheArchivePath(hash) as the single path to both restoreCache and saveCache, with the same key (ROBUST-03)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The temp archive file no longer exists after put, on both the success and the propagating-error paths"
    requirement: "ROBUST-03"
    verification:
      - kind: unit
        ref: "packages/github-cache/src/backend/actions-cache-backend.spec.ts#removes the temp archive after put on the propagating-error path (ROBUST-03)"
        status: pass
    human_judgment: false

# Metrics
duration: 5min
completed: 2026-07-19
status: complete
---

# Phase 2 Plan 04: Actions-Cache Storage Backend Summary

**The project's first real storage backend: `createActionsCacheBackend()` satisfies the Phase 1 `CacheBackend` port against GitHub's Actions cache through the exact-pinned `@actions/cache` toolkit (`get`->`restoreCache`, `put`->`saveCache`), with every path string flowing through one comment-locked `cacheArchivePath(hash)` helper whose exact produced file name is pinned by a literal-string spec (the silent-MISS guard, ROBUST-03 / ROADMAP SC5).**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-07-19
- **Completed:** 2026-07-19
- **Tasks:** 2 (each TDD: RED -> GREEN)
- **Files modified:** 4 (all created)

## Accomplishments
- `cacheArchivePath(hash)` single source of truth for the archive temp path, comment-locked against the silent-MISS class (Pitfall 7 / T-2-09), with its exact file name `nx-github-cache-<hash>.tar` pinned by a spec that spells the literal out rather than reconstructing it.
- `createActionsCacheBackend()` real backend mapping `get`->`restoreCache` and `put`->`saveCache`, satisfying the unchanged `CacheBackend` contract so the Nx contract server can read and write GitHub's Actions cache.
- Ambiguous `saveCache -1` sentinel and `ReserveCacheError` reserve conflicts absorbed as a documented benign no-op (`'stored'`, D-04), while every other rejection propagates so the server's fail-closed write path surfaces a 500.
- Temp archive removed in a `finally` block on both the success and propagating-error paths (T-2-11).
- First module mock in the repository (`vi.mock('@actions/cache')` + `vi.mocked`), taken from research rather than improvised.

## Task Commits

Each task was committed atomically, RED before GREEN:

1. **Task 1 (RED): failing pinned archive-path spec (ROBUST-03)** - `8ff6d85` (test)
2. **Task 1 (GREEN): single-source cache archive path helper (ROBUST-03)** - `8b03107` (feat)
3. **Task 2 (RED): failing Actions-cache backend spec (ROBUST-03)** - `6f90f3d` (test)
4. **Task 2 (GREEN): Actions-cache backed CacheBackend (ROBUST-03)** - `a782a51` (feat)

_Note: TDD plan -- for each task the RED `test(02-04)` commit precedes its GREEN `feat(02-04)` commit in git history._

## Files Created/Modified
- `packages/github-cache/src/lib/cache-archive-path.ts` - one exported `cacheArchivePath(hash)`; LOAD-BEARING comment-lock naming Pitfall 7 and ROBUST-03, and forbidding cosmetic edits without an end-to-end CI restore.
- `packages/github-cache/src/lib/cache-archive-path.spec.ts` - pins the literal `nx-github-cache-abc123.tar`, asserts absolute-path-under-tmpdir and per-hash stability; non-vacuous comment on why the literal is spelled out.
- `packages/github-cache/src/backend/actions-cache-backend.ts` - `cacheKeyFor(hash)` (`nx-cache-<hash>`) and `createActionsCacheBackend()`; both call sites resolve the path through `cacheArchivePath`; D-04 no-op comment at the return site; never returns forbidden/conflict.
- `packages/github-cache/src/backend/actions-cache-backend.spec.ts` - nine cases over the whole `<behavior>` block against a mocked `@actions/cache`: hit/miss, positive-id/-1/ReserveCacheError/other-error, cleanup on both paths, and path+key agreement.

## Decisions Made
- Separate `lib/` module for `cacheArchivePath` (not a private backend fn) so the exact string is spec-pinnable -- the module earns its keep only because that pinned test exists (resolved planning decision, do not re-open).
- `createActionsCacheBackend()` empty parameter list: no mode argument now or ever (TRUST-05).
- `saveCache -1` and `ReserveCacheError` -> `'stored'` benign no-op; all other rejections propagate (D-04 / T-2-10).
- `finally { rm(path, { force: true }) }` for cleanup on every exit path (T-2-11).
- No `read-only-backend.ts` created (Phase 1's `createReadOnlyMemoryBackend()` is the reused RO seam; resolved decision).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- `state.record-metric` gsd-tools verb rejects positional args ("phase, plan, and duration required"); re-invoked with named flags (`--phase`/`--plan`/`--duration`/`--tasks`/`--files`). Not a code issue.

## Threat Model Coverage
- T-2-09 (Tampering / silent-MISS class): exactly one exported `cacheArchivePath` helper (repo-wide count = 1), both toolkit call sites resolve through it, the produced file name is pinned by a literal-string spec, and a comment-lock names Pitfall 7 and forbids cosmetic edits. End-to-end confirmation is the Plan 06 CI canary.
- T-2-10 (Repudiation / integrity, ambiguous sentinel): `saveCache -1` and `ReserveCacheError` absorbed as `'stored'`; a dedicated propagation test proves every other rejection escapes `put`.
- T-2-11 (Info disclosure / resource exhaustion, temp file): `finally` removes the temp archive on success and error paths; asserted on both.
- T-2-12 (Tampering / protocol drift): only the official toolkit's `restoreCache`/`saveCache` are called; no direct cache-service endpoint call.
- T-2-SC (install vector): accepted -- no package install in this plan; it consumes the 02-01 pin.

## Known Stubs
None - the backend is fully wired to `@actions/cache`; the only unexercised surface is the real cache service, which is exercised by the Plan 06 CI dogfood (by design, cannot run in unit tests).

## User Setup Required
None - the real Actions-cache round-trip runs only inside the CI JS action (Plan 06); unit specs mock the toolkit.

## Next Phase Readiness
- `createActionsCacheBackend()` is standalone and not yet selected by `serve()` -- `selectBackend(env)` wiring and the SIGTERM drain land in Plan 02-05; the CI dogfood that exercises the real primitive is Plan 02-06. No blockers.

## Self-Check: PASSED
- FOUND: packages/github-cache/src/lib/cache-archive-path.ts
- FOUND: packages/github-cache/src/lib/cache-archive-path.spec.ts
- FOUND: packages/github-cache/src/backend/actions-cache-backend.ts
- FOUND: packages/github-cache/src/backend/actions-cache-backend.spec.ts
- FOUND commit: 8ff6d85 (Task 1 RED test)
- FOUND commit: 8b03107 (Task 1 GREEN feat)
- FOUND commit: 6f90f3d (Task 2 RED test)
- FOUND commit: a782a51 (Task 2 GREEN feat)
- RED precedes GREEN in git history for both tasks: confirmed
- `npx nx test @op-nx/github-cache`: 72 passed (12 new ROBUST-03 cases GREEN)
- `npx nx run-many -t typecheck build`: green
- `git grep -c 'export function cacheArchivePath'`: 1 (single source of truth)

---
*Phase: 02-default-cache-in-ci*
*Completed: 2026-07-19*
