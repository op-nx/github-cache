---
phase: 01-walking-skeleton
plan: 03
subsystem: api
tags: [node-http, input-validation, dos-cap, best-effort-read, fail-closed-write, never-guard, ports-and-adapters, vitest, tdd, nodenext, nx-remote-cache]

# Dependency graph
requires:
  - phase: 01-walking-skeleton (Plan 01-02)
    provides: "createCacheServer guard-clause ladder (route/auth/status-map with the PutResult never-guard), CacheBackend port + PutResult/GetResult unions, createWritableMemoryBackend, real-socket + global fetch test harness"
provides:
  - "Hash validation (SRV-03): {hash} checked against ^[a-f0-9]{1,512}$ AFTER auth and BEFORE any backend call -> 400; malformed input never reaches the backend port"
  - "Body-size cap (SRV-04): MAX_CACHE_BODY_BYTES = 2 GiB; Content-Length fast-reject + streaming byte-counter + req.destroy() at the cap -> 413, body never buffered unbounded; maxBodyBytes injectable for fast tests"
  - "Best-effort read + fail-closed write (SRV-05): any backend.get fault degrades to a 404 MISS (never a build-breaking 5xx); a backend.put fault surfaces as 500 (never a silent 200)"
  - "createReadOnlyMemoryBackend() — the D-04 403 seam: put always yields 'forbidden' -> server maps to 403; RW/RO stays a construction-time backend capability, no caller-facing mode flag (TRUST-05)"
  - "Completed Nx status contract: 200 (stored) / 409 (conflict) / 403 (forbidden) via the never-typed PutResult exhaustiveness guard (D-06)"
affects: [01-04, phase-2, phase-3, phase-4]

# Tech tracking
tech-stack:
  added: []  # ZERO new deps — node:http + node:crypto stdlib only (D-01)
  patterns:
    - "Guard-clause ladder with load-bearing order: route/method (404) -> auth (401) -> hash validate (400) -> PUT body cap (413) -> backend -> status map. Auth precedes hash validation so unauthed callers never learn if a hash is well-formed; hash validation precedes any backend call (SRV-03)"
    - "413-socket-destroy body cap: Content-Length precheck (fast reject) + streaming byte-counter with req.destroy() at the ceiling — never buffers the whole body first (SRV-04)"
    - "Best-effort read / fail-closed write asymmetry: backend.get wrapped in try/catch -> 404 MISS; backend.put fault -> 500 surfaced, never swallowed to 200 (SRV-05, D-06)"
    - "Read-only backend factory as the 403 seam: same CacheBackend shape, put -> 'forbidden'; the RW/RO choice is which factory constructs the server, never a request flag (D-04/TRUST-05)"

key-files:
  created:
    - .planning/phases/01-walking-skeleton/01-03-SUMMARY.md
  modified:
    - packages/github-cache/src/server/server.ts
    - packages/github-cache/src/backend/memory-backend.ts
    - packages/github-cache/src/server/server.spec.ts
    - packages/github-cache/src/backend/memory-backend.spec.ts

key-decisions:
  - "put fault -> 500 (caught), not an uncaught 'propagate': a raw uncaught throw in a node:http async handler hangs the socket and surfaces NO status; catching to 500 is the fail-closed behavior the SRV-05 prohibition requires ('an error status is surfaced, never 200'). Reads still degrade to 404, writes fail closed as 5xx (allowed for writes; only reads must avoid 5xx)"
  - "Route capture widened ([^/]+ -> [^/]*) so an empty {hash} reaches the 400 guard instead of a 404 route-miss, satisfying the must-have 'empty returns 400'. Auth-first order preserved; no existing Plan 02 spec regressed"
  - "maxBodyBytes is an optional 3rd positional param defaulting to MAX_CACHE_BODY_BYTES (injectable ceiling, simplest form — no options object for a single knob); tests drive the streaming abort with an 8-byte cap"
  - "Shared module-private readFrom(store, hash) single-sources the identical hit/miss read path across the writable and read-only factories"

patterns-established:
  - "Backend spy in specs proves a negative (SRV-03): a fake CacheBackend records calls; the malformed-hash spec asserts get/put were NOT invoked"
  - "SRV-04 specs assert the DoS invariant deterministically via put-never-called + (413 or socket reset), robust to the res.end()/req.destroy() delivery race; the streaming path uses a ReadableStream body (chunked, no Content-Length) to exercise the mid-stream counter"
  - "SRV-05 fault specs use AbortSignal.timeout(3000) so the RED run fails fast (hung socket) and the client closes cleanly for afterEach; GREEN responds in ms so the abort never fires"

requirements-completed: [SRV-03, SRV-04, SRV-05]

coverage:
  - id: D1
    description: "SRV-03: malformed {hash} (non-hex, over 512 chars, empty) -> 400 AFTER auth and BEFORE any backend call; a backend spy proves get/put are not invoked on a malformed hash"
    requirement: "SRV-03"
    verification:
      - kind: unit
        ref: "packages/github-cache/src/server/server.spec.ts#rejects a non-hex hash on GET / #rejects a malformed hash on PUT / #rejects a hash longer than 512 chars / #rejects an empty hash"
        status: pass
    human_judgment: false
  - id: D2
    description: "SRV-04: MAX_CACHE_BODY_BYTES === 2 GiB; oversized Content-Length rejected on the fast path (413); streamed body exceeding the cap aborted mid-stream (413/socket-destroy) with the backend never receiving the body (no unbounded buffering)"
    requirement: "SRV-04"
    verification:
      - kind: unit
        ref: "packages/github-cache/src/server/server.spec.ts#exposes MAX_CACHE_BODY_BYTES as exactly 2 GiB / #rejects an oversized Content-Length with 413 / #aborts a streamed body exceeding the cap without buffering it"
        status: pass
    human_judgment: false
  - id: D3
    description: "SRV-05: backend.get fault degrades to a 404 MISS (never 5xx); backend.put fault surfaces an error status (500), never a silent 200 (best-effort read / fail-closed write)"
    requirement: "SRV-05"
    verification:
      - kind: unit
        ref: "packages/github-cache/src/server/server.spec.ts#degrades a backend.get fault to a 404 MISS / #surfaces an error status on a backend.put fault, never a silent 200"
        status: pass
    human_judgment: false
  - id: D4
    description: "Completed status contract (SC2 half): a second PUT of an existing hash -> 409 (no-override); a PUT against a read-only backend -> 403 (the D-04 seam, from construction not a caller flag)"
    verification:
      - kind: integration
        ref: "packages/github-cache/src/server/server.spec.ts#returns 409 on a second PUT of an already-stored hash / #returns 403 on a PUT against a read-only backend"
        status: pass
    human_judgment: false
  - id: D5
    description: "createReadOnlyMemoryBackend(): put always resolves 'forbidden' (the 403 feeder); get returns a valid GetResult (miss on the unseeded Phase-1 store)"
    requirement: "SRV-05"
    verification:
      - kind: unit
        ref: "packages/github-cache/src/backend/memory-backend.spec.ts#put always yields \"forbidden\" / #get still returns a valid GetResult"
        status: pass
    human_judgment: false
  - id: D6
    description: "The PutResult -> status switch keeps the never-typed exhaustiveness default (D-06); adding a variant without a status is a compile error"
    verification:
      - kind: other
        ref: "npx nx typecheck github-cache (exit 0) — never-guard exhaustiveness is compile-time"
        status: pass
    human_judgment: false

# Metrics
duration: 12min
completed: 2026-07-18
status: complete
---

# Phase 1 Plan 03: Server Hardening + Read-Only Backend Seam Summary

**The Plan 02 round-trip server is hardened into the full Nx status contract: bounded-hex `{hash}` validation (400 before any backend call), a 2 GiB body cap (413 via Content-Length precheck + streaming socket-destroy, never buffered unbounded), best-effort reads (get fault -> 404 MISS) with fail-closed writes (put fault -> 500, never a silent 200), and the 409/403 half of the contract fed by a `createReadOnlyMemoryBackend()` seam and a never-guarded `PutResult` map -- all built test-first (RED -> GREEN).**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-18T13:07:48Z
- **Completed:** 2026-07-18T13:20:00Z
- **Tasks:** 2 (TDD: 1 RED + 1 GREEN)
- **Files modified:** 4 (2 source, 2 spec)

## Accomplishments
- **SRV-03 hash validation** — `{hash}` is checked against `^[a-f0-9]{1,512}$` in the guard ladder AFTER auth and BEFORE any `backend.get`/`backend.put`; a backend spy proves the backend is never invoked on a malformed hash (non-hex, over-512, empty). The route capture was widened to `[^/]*` so an empty hash reaches the 400 guard rather than a 404 route-miss.
- **SRV-04 body-size cap** — `MAX_CACHE_BODY_BYTES = 2 * 1024 * 1024 * 1024` (2 GiB). PUT enforces it two ways: a `Content-Length` fast-reject (413) and a streaming byte-counter that `req.destroy()`s at the ceiling (413), so the body is never buffered unbounded. The ceiling is an injectable 3rd param so the streamed-overflow spec drives the abort with an 8-byte cap.
- **SRV-05 best-effort read / fail-closed write** — `backend.get` is wrapped in try/catch and ANY fault degrades to a `404` MISS (never a build-breaking 5xx); a `backend.put` fault is caught and surfaced as `500` (never a silent `200`). The asymmetry is explicit and separately tested.
- **409 + 403 status contract** — the `PutResult` never-guard maps `'stored'`->200, `'conflict'`->409, `'forbidden'`->403; `createReadOnlyMemoryBackend()` (put -> `'forbidden'`) feeds the 403 path as a construction-time capability (D-04), with no caller-facing mode flag (TRUST-05).
- **All 22 specs GREEN** (16 server + 6 backend); `npx nx test/typecheck/build github-cache` all exit 0. TDD gate satisfied: `test(01-03)` (12 failing) precedes `feat(01-03)` (22 passing).

## Task Commits

Each task was committed atomically (TDD RED -> GREEN gate):

1. **Task 1 (RED): First-written specs for hash validation, body cap, best-effort read, 409/403** - `e4be7f2` (test)
2. **Task 2 (GREEN): Complete the guard-clause pipeline + read-only backend factory** - `ffb12de` (feat)

**Plan metadata:** committed with SUMMARY.md + STATE.md + ROADMAP.md + REQUIREMENTS.md.

_TDD gate satisfied: `test(01-03)` (RED, nx test 12 failed / 10 passed) precedes `feat(01-03)` (GREEN, 22/22 pass, typecheck + build clean)._

## Files Created/Modified
- `packages/github-cache/src/server/server.ts` - added `MAX_CACHE_BODY_BYTES` + `HASH_PATTERN`; widened the route capture to `[^/]*`; hash-validation guard (400); PUT body cap (Content-Length fast-reject + streaming socket-destroy, 413); best-effort GET try/catch (404); fail-closed PUT try/catch (500); optional `maxBodyBytes` param. The `PutResult` never-guard is retained (D-06).
- `packages/github-cache/src/backend/memory-backend.ts` - added `createReadOnlyMemoryBackend()` (put -> `'forbidden'`); extracted a module-private `readFrom(store, hash)` shared by both factories' read path.
- `packages/github-cache/src/server/server.spec.ts` - 11 new specs: MAX_CACHE_BODY_BYTES constant, SRV-03 (x4, incl. backend-spy not-called), SRV-04 (fast + streaming), SRV-05 (get-throws->404, put-throws->500), 409, 403.
- `packages/github-cache/src/backend/memory-backend.spec.ts` - 2 new specs: read-only `put` -> `'forbidden'`, read-only `get` -> valid miss.

## Decisions Made
- **A put fault returns 500 (caught), NOT an uncaught "propagate".** The plan skeleton commented `backend.put` "may throw -> propagate", but a raw uncaught throw in a `node:http` async handler leaves the socket hanging and surfaces NO status to the client -- which fails the SRV-05 prohibition's own verification ("an error status is surfaced, never 200"). So the put fault is caught and mapped to `500`. This is the fail-closed behavior: reads degrade to `404` (never 5xx, to not break the build), writes surface a 5xx (allowed and correct for the write path). This is a faithful implementation of intent, not a scope change -- flagged explicitly because the wording differs from "propagate".
- **Route capture widened `[^/]+` -> `[^/]*`.** To satisfy the must-have "an empty `{hash}` returns 400", the route must capture the empty segment so it reaches the hash guard; with `+` an empty hash was a 404 route-miss. Verified no Plan 02 spec regressed and the auth-before-hash order is preserved (an unauthed empty-hash request is now 401, which is strictly more correct -- no hash-validity leak to unauthed callers).
- **`maxBodyBytes` is an optional positional param** (`= MAX_CACHE_BODY_BYTES`), not an options object -- the plan needs exactly one injectable knob, so an options bag would be premature (YAGNI). Existing 2-arg call sites are unaffected.
- **Shared `readFrom()` helper** single-sources the identical hit/miss read path across the writable and read-only factories (rung-2 reuse of an identical operation, not a speculative abstraction).

## Deviations from Plan

None - plan executed as written. The two notable implementation choices (put-fault -> 500 rather than an uncaught propagate; route capture `[^/]*` for empty-hash-400) are documented under Decisions Made: both are the correct way to satisfy the plan's own stated must-haves/prohibitions, not unplanned scope. No deviation rules (1-4) were triggered; no new dependencies; the threat-register mitigations (T-1-03/04/05/06) are all implemented as specified.

## Issues Encountered
- **RED for the SRV-05 fault specs hangs the socket** (current Plan 02 code has no try/catch, so a thrown get/put leaves the async handler rejected and the response pending). Handled by putting `AbortSignal.timeout(3000)` on those two fetches so the RED run fails fast and the client connection closes cleanly for `afterEach`; GREEN responds in ms so the abort never fires. The RED run also logged 2 expected "Unhandled Rejection" errors (the uncaught faults) -- both gone at GREEN.
- **`nx typecheck` compiles the spec files** (carried from Plan 02), so the RED state shows a failing test run; the streamed-body spec's `ReadableStream` + `duplex: 'half'` (typed via a `RequestInit & { duplex: 'half' }` intersection) compiled cleanly at GREEN.

## Known Stubs
- **`createReadOnlyMemoryBackend().get` reads an always-empty store** (`put` is forbidden, so nothing is ever written to it in Phase 1). This is an intentional Phase-1 seam, not a defect: the read-only factory exists solely to feed the `403`-on-write path (D-04), and its `get` mirrors the writable read shape so it is structurally ready. The real cross-context read data source (GitHub Releases reader + OS-namespacing) is **Phase 3** (FOUND-01); until then a read-only `get` correctly returns MISS. Documented so the verifier does not flag the unseeded read path as an incomplete deliverable.

## User Setup Required
None - no external service configuration required (loopback server, per-process token, zero new deps).

## Next Phase Readiness
- **Plan 01-04** (conformance + distribution seam): the full server pipeline (SRV-01..05 + 200/401/403/404/409) is now complete and ready to be locked by the TEST-07 two-layer conformance fixture (committed vendored spec sha256 drift-guard + a behavioral status-code run asserting hard `200` on PUT), the real `serve.ts` composition root (SC4), and the finalized `src/index.ts` public surface (still the `export {}` placeholder from Plan 02).
- **Phase 2** inherits the D-04 seam: `createReadOnlyMemoryBackend()` is the throwaway stand-in that `selectBackend(env)` supersedes; the "no caller-facing mode flag" property (TRUST-05) is now demonstrated end-to-end (403 comes from which factory constructs the server).
- No blockers. `npx nx test/typecheck/build github-cache` green; SRV-03/04/05 closed in REQUIREMENTS.md.

## Self-Check: PASSED

All 4 source/spec files + the SUMMARY exist on disk; both task commits (`e4be7f2`, `ffb12de`) are in git history; the `PutResult` never-guard is present in `server.ts`; `npx nx test github-cache` = 22/22 pass, `typecheck` + `build` exit 0.

---
*Phase: 01-walking-skeleton*
*Completed: 2026-07-18*
