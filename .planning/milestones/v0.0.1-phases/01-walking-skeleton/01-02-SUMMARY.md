---
phase: 01-walking-skeleton
plan: 02
subsystem: api
tags: [node-http, node-crypto, ports-and-adapters, timing-safe-auth, csprng, vitest, tdd, nodenext, nx-remote-cache]

# Dependency graph
requires:
  - phase: 01-walking-skeleton (Plan 01-01)
    provides: "@op-nx/github-cache lib (inferred build/typecheck/test targets, tsc bundler), green Vitest Wave-0 harness, generator sample src/lib + src/index.ts barrel to neutralize"
provides:
  - "CacheBackend port + PutResult/GetResult/GetHit unions (packages/github-cache/src/backend/types.ts) — the contract Plans 03/04 implement against"
  - "createWritableMemoryBackend() — trivial Map-backed CacheBackend (put stored/conflict, get hit/miss)"
  - "createCacheServer(backend, token) — node:http protocol layer for the Nx GET/PUT /v1/cache/{hash} authenticated happy path (hard 200 on PUT, 200+Content-Length on GET hit, 404 on miss)"
  - "generateToken() (per-process crypto.randomBytes CSPRNG) + makeAuthGate(token) (crypto.timingSafeEqual over fixed 32-byte SHA-256 digests, 401 on missing/wrong)"
  - "First-written RED specs (server.spec.ts real-socket via global fetch, memory-backend.spec.ts) — the Wave-0 test bed subsequent plans extend"
affects: [01-03, 01-04, phase-2, phase-3]

# Tech tracking
tech-stack:
  added: []  # ZERO new deps — node:http + node:crypto stdlib only (D-01); vitest + global fetch already present
  patterns:
    - "Ports-and-adapters inside one lib: server depends on the CacheBackend port, never the adapter; RW/RO is which factory the caller constructs with (D-04, no caller-facing mode flag / TRUST-05)"
    - "Guard-clause request ladder in a single http.createServer handler: route/method -> auth (401) -> backend -> status map (no router library, D-01)"
    - "Timing-safe bearer auth: hash BOTH tokens to fixed 32-byte SHA-256 digests before crypto.timingSafeEqual (no length oracle, no ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH throw, never ===)"
    - "PutResult never-typed exhaustiveness guard over the discriminated union (D-06) — adding a variant without a status becomes a compile error"

key-files:
  created:
    - packages/github-cache/src/backend/types.ts
    - packages/github-cache/src/backend/memory-backend.ts
    - packages/github-cache/src/server/server.ts
    - packages/github-cache/src/backend/memory-backend.spec.ts
    - packages/github-cache/src/server/server.spec.ts
  modified:
    - packages/github-cache/src/index.ts
  deleted:
    - packages/github-cache/src/lib/github-cache.ts
    - packages/github-cache/src/lib/github-cache.spec.ts

key-decisions:
  - "Bearer auth compares fixed 32-byte SHA-256 digests of both tokens via crypto.timingSafeEqual (no length oracle, never ===); per-process token via crypto.randomBytes (SRV-02)"
  - "RW/RO is the injected backend factory at server construction, never a caller-facing mode flag (D-04/TRUST-05); PutResult never-guard keeps forbidden->403 exhaustive (D-06); PUT success is hard 200"
  - "index.ts neutralized to an empty ES-module barrel (export {}) not a deletion — TS1208 requires a module, and Plan 01-04 finalizes the public surface"

patterns-established:
  - "Real-socket test harness: listen(0,'127.0.0.1') + Node global fetch (no supertest), afterEach closes the server; assert .toBe(200) never < 300"
  - "Explicit .js extensions on relative imports (nodenext); import * as http (esModuleInterop:false); node:crypto named imports"

requirements-completed: [SRV-01, SRV-02]

coverage:
  - id: D1
    description: "Writable Map-backed CacheBackend: put(new)->'stored', put(existing)->'conflict', get(stored)->hit with bytes, get(absent)->miss"
    verification:
      - kind: unit
        ref: "packages/github-cache/src/backend/memory-backend.spec.ts (4 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "SRV-01: createCacheServer binds 127.0.0.1 only; server.address().address === '127.0.0.1'"
    requirement: "SRV-01"
    verification:
      - kind: unit
        ref: "packages/github-cache/src/server/server.spec.ts#binds 127.0.0.1 only (SRV-01)"
        status: pass
    human_judgment: false
  - id: D3
    description: "SRV-02: missing Authorization -> 401; wrong bearer -> 401 without throwing; correct bearer passes; per-process CSPRNG token compared via timingSafeEqual on 32-byte SHA-256 digests"
    requirement: "SRV-02"
    verification:
      - kind: unit
        ref: "packages/github-cache/src/server/server.spec.ts#returns 401 when the Authorization header is missing / #returns 401 for a wrong bearer token without throwing"
        status: pass
    human_judgment: false
  - id: D4
    description: "SC2 authenticated round-trip: PUT stored -> hard 200; GET hit -> 200 + Content-Length equal to byte length + exact bytes; GET of an unstored hash -> 404"
    verification:
      - kind: integration
        ref: "packages/github-cache/src/server/server.spec.ts#stores a PUT then serves it on GET with Content-Length (SC2 round-trip) / #returns 404 for a GET of an unstored hash"
        status: pass
    human_judgment: false
  - id: D5
    description: "CacheBackend port + PutResult/GetResult unions with the never-typed exhaustiveness guard mapping stored->200, conflict->409, forbidden->403 (D-04/D-06 seam, compile-enforced)"
    verification:
      - kind: other
        ref: "npx nx typecheck github-cache (exit 0) — never-guard exhaustiveness is compile-time"
        status: pass
    human_judgment: false

# Metrics
duration: 7min
completed: 2026-07-18
status: complete
---

# Phase 1 Plan 02: Authenticated E2E Cache Round-Trip Spine Summary

**A node:http server speaks the Nx `GET`/`PUT /v1/cache/{hash}` contract end-to-end against a trivial writable Map backend: hard `200` on PUT, `200`+`Content-Length` on GET hit, `404` on miss, `401` on unauth via a per-process CSPRNG bearer compared with `crypto.timingSafeEqual` on fixed 32-byte SHA-256 digests, bound to `127.0.0.1` only — built test-first (RED -> GREEN).**

## Performance

- **Duration:** 7 min
- **Started:** 2026-07-18T12:53:00Z
- **Completed:** 2026-07-18T13:00:00Z
- **Tasks:** 2 (TDD: 1 RED + 1 GREEN)
- **Files modified:** 6 (5 created, 1 modified) + 2 deleted

## Accomplishments
- `CacheBackend` port + `PutResult`/`GetResult`/`GetHit` discriminated unions (`src/backend/types.ts`) — the load-bearing contract Plans 03/04 build against; `readonly` preserved verbatim from the plan's `<interfaces>` block.
- `createWritableMemoryBackend()` — a `Map<string, Buffer>` behind the port: `put` -> `'conflict'` when present else `'stored'`; `get` -> hit/miss.
- `createCacheServer(backend, token)` — a single `http.createServer` guard-clause ladder (route/method -> auth -> backend -> status map) using only `node:http` + `node:crypto`. PUT `'stored'` -> exactly `200`; GET hit -> `200` + auto `Content-Length`; miss -> `404`. `PutResult` never-guard maps `conflict`->409, `forbidden`->403 (the D-04/D-06 seam, exercised fully in Plan 03).
- `generateToken()` (`crypto.randomBytes(32)` CSPRNG) + `makeAuthGate(token)` (`crypto.timingSafeEqual` over fixed 32-byte SHA-256 digests) — SRV-02; missing/wrong bearer -> `401` without throwing.
- Neutralized the generator's sample: deleted `src/lib/github-cache.ts` + its spec and replaced the `src/index.ts` re-export with an empty ES-module barrel (`export {}`), clearing the dangling-import TS2307 while keeping typecheck valid (Plan 04 finalizes the public surface).
- All 9 first-written specs GREEN; `npx nx test/typecheck/build github-cache` all exit 0.

## Task Commits

Each task was committed atomically (TDD RED -> GREEN gate):

1. **Task 1 (RED): First-written specs for the writable backend + authenticated round-trip** - `b7108d2` (test)
2. **Task 2 (GREEN): Port + writable Map adapter + node:http server happy path with timing-safe auth** - `17b5e05` (feat)

**Plan metadata:** committed with SUMMARY.md + STATE.md + ROADMAP.md + REQUIREMENTS.md.

_TDD gate satisfied: `test(01-02)` (RED, nx test exit 1 "Cannot find module") precedes `feat(01-02)` (GREEN, 9/9 pass)._

## Files Created/Modified
- `packages/github-cache/src/backend/types.ts` - `CacheBackend` port + `PutResult`/`GetResult`/`GetHit` unions (D-03 contract).
- `packages/github-cache/src/backend/memory-backend.ts` - `createWritableMemoryBackend()` trivial Map adapter.
- `packages/github-cache/src/server/server.ts` - `createCacheServer` / `generateToken` / `makeAuthGate` (node:http + node:crypto protocol layer).
- `packages/github-cache/src/backend/memory-backend.spec.ts` - 4 unit specs (put stored/conflict, get hit/miss).
- `packages/github-cache/src/server/server.spec.ts` - 5 real-socket specs (SRV-01, SRV-02 x2, SC2 round-trip, GET miss).
- `packages/github-cache/src/index.ts` - neutralized to `export {}` placeholder barrel (was `export * from './lib/github-cache.js'`).
- `packages/github-cache/src/lib/github-cache.ts` + `.spec.ts` - **deleted** (generator sample, replaced by the real specs).

## Decisions Made
- **Timing-safe auth hashes both sides first.** Both the expected and presented tokens are SHA-256'd to fixed 32-byte digests before `crypto.timingSafeEqual`, so lengths always match — no `ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH` throw and no length side-channel (Pitfall 3). Never `===` (SRV-02, threat T-1-02/T-1-02b).
- **No caller-facing mode flag (D-04/TRUST-05).** RW vs RO is which backend factory is passed at construction; `createCacheServer(backend, token)` has no `mode`/RW/RO parameter. This plan ships only the writable form; the read-only `'forbidden'`->403 form is Plan 03, but the port shape + never-guard already carry the seam.
- **`index.ts` -> empty barrel, not deleted.** `isolatedModules` (TS1208) requires the file to be a module, so `export {}` (not a zero-byte file) is the correct placeholder; Plan 04 fills real exports.

## Deviations from Plan

None - plan executed exactly as written. The sample-module deletion + `index.ts` neutralization and the `conflict`->409 / `forbidden`->403 never-guard cases were all specified in the plan (Task 1 action + Task 2 `PutResult` mapping / D-06), not unplanned work.

## Issues Encountered
- **`nx typecheck` compiles spec files (via `tsconfig.spec.json`), so at RED it reported TS2307 for the not-yet-created modules** (`./memory-backend.js`, `./server.js`) — this is the expected RED state and cleared automatically at GREEN. Confirmed `index.ts` itself was NOT among the RED errors (barrel neutralization worked). Useful for Plans 03/04, which add further RED specs: a red typecheck between RED and GREEN commits is normal under this target setup.
- **`state record-metric` takes named flags** (`--phase --plan --duration --tasks --files`), not positional args as the generic protocol snippet implies. Noted for future state-update steps.

## User Setup Required
None - no external service configuration required (loopback server, per-process token, zero deps).

## Next Phase Readiness
- **Plan 01-03** (hardening): `createReadOnlyMemoryBackend()` (put->`'forbidden'`->403), full hash validation (`^[a-f0-9]{1,512}$` -> 400 before any backend call, SRV-03), body-size cap (413-socket-destroy, SRV-04), and best-effort read swallowing (get fault -> 404, put fails closed, SRV-05). The port shape + never-guard + guard-clause ladder are already in place to receive these.
- **Plan 01-04** (conformance + distribution seam): vendored Nx OpenAPI fixture + two-layer TEST-07 spec, real `serve.ts` composition root (SC4), and the finalized `src/index.ts` public surface (currently an empty barrel placeholder — intentional, tracked here).
- **Known intentional placeholder:** `src/index.ts` is `export {}` — no public API is exported yet by design. Consumers/tests import the concrete modules directly. Plan 04 resolves it; it does not block this plan's E2E round-trip goal.
- No blockers. `npx nx test/typecheck/build github-cache` green; SRV-01 + SRV-02 closed in REQUIREMENTS.md.

## Self-Check: PASSED

All 5 created files exist on disk; both task commits (`b7108d2`, `17b5e05`) are in git history; `npx nx test github-cache` = 9/9 pass, `typecheck` + `build` exit 0.

---
*Phase: 01-walking-skeleton*
*Completed: 2026-07-18*
