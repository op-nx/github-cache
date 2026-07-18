---
phase: 01-walking-skeleton
fixed_at: 2026-07-18T22:54:44Z
review_path: .planning/phases/01-walking-skeleton/01-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 1: Code Review Fix Report

**Fixed at:** 2026-07-18T22:54:44Z
**Source review:** .planning/phases/01-walking-skeleton/01-REVIEW.md
**Iteration:** 1

**Scope:** This pass applied only the findings explicitly requested (CR-01, WR-01,
IN-01), not the full Critical+Warning default. WR-02 and IN-02 were explicitly
out of scope and are recorded below as a deliberate deferral / confirmed
false-positive.

**Summary:**
- Findings in scope: 3
- Fixed: 3
- Skipped: 0
- Deferred / no-action (out of scope, documented): 2 (WR-02, IN-02)

## Fixed Issues

### CR-01: Unhandled promise rejection in the PUT body-read loop crashes the process

**Files modified:** `packages/github-cache/src/server/server.ts`, `packages/github-cache/src/server/server.spec.ts`
**Commits:** `944bd74` (test, RED), `e111a3b` (fix, GREEN)
**Applied fix (TDD RED-first):**
- RED: added a regression test that starts an authenticated PUT declaring a
  `Content-Length` of 1000, writes a few bytes, then destroys the client socket
  mid-body so the server's body-drain stream rejects
  (`ERR_STREAM_PREMATURE_CLOSE`). The test captures `process.on('unhandledRejection')`
  and asserts no rejection escapes and the server still answers a subsequent GET
  (404). Confirmed FAILING against the unguarded code (`expected [ Array(1) ] to
  deeply equal []`).
- GREEN: wrapped the `for await (const chunk of req)` body-drain loop and the
  trailing `Buffer.concat` in `try/catch`. On a stream fault the handler now fails
  closed on the single request -- `400` (or `res.destroy()` if headers were
  already sent) and returns -- instead of rejecting the async `http` handler and
  crashing the process under Node 24's default `unhandledRejection: throw`. No
  process-wide `unhandledRejection` handler was introduced (the actual await is
  guarded). The load-bearing guard-clause ladder order (route -> auth 401 -> hash
  400 -> body-cap 413 -> drain -> backend) is unchanged; the inner 413 streaming
  branch is preserved verbatim inside the new `try`.
- Verified: full suite green (35/35), typecheck clean, build clean.

### WR-01: Vacuous SRV-01 loopback test in server.spec.ts

**Files modified:** `packages/github-cache/src/server/server.spec.ts`
**Commit:** `762e1e4`
**Applied fix:** Deleted the `createCacheServer` "binds 127.0.0.1 only (SRV-01)"
test. It asserted the bind address chosen by its own `listen()` helper
(`server.listen(0, '127.0.0.1', ...)`), a tautology that would pass even if
production bound `0.0.0.0`. `createCacheServer` never binds -- binding is
`serve()`'s job -- so the honest, non-vacuous SRV-01 assertion lives in
`serve.spec.ts` (drives `serve()`, which exposes no host option, and asserts
`127.0.0.1` and not `0.0.0.0`/`::`). SRV-01 coverage is retained; only the false
confidence was dropped. The shared `listen()` helper was kept (other tests use it).

### IN-01: makeAuthGate exported but only used internally

**Files modified:** `packages/github-cache/src/server/server.ts`
**Commit:** `b35534b`
**Applied fix:** Dropped the `export` keyword on `makeAuthGate`, making it
module-private. Verified via `git grep -n makeAuthGate` that no source file
imports it outside `server.ts` (not re-exported by the `index.ts` barrel, not
imported by any spec -- specs exercise it transitively through
`createCacheServer`; the only source references are its definition and the
internal call on `server.ts:58`). All other hits are `.planning/` documentation.

## Deferred / No-action (out of scope this pass)

### WR-02: Request-handler complexity above threshold -- DEFERRED (deliberate)

**File:** `packages/github-cache/src/server/server.ts:60-169`
**Decision:** Not refactored this pass. The guard-clause ladder order is
load-bearing (security-critical) and the handler is deliberately linear and
well-tested; a cosmetic complexity refactor (extract `handleGet`/`handlePut`) is
not worth the regression risk on a Critical-fix pass. The CR-01 `try/catch`
landed cleanly in the existing linear handler without needing the extraction.
Recommend revisiting in Phase 3 when a real backend is added (fallow flags it
cyclomatic 18 / CRAP 88 against thresholds 20 / 30 -- above the CRAP threshold
but below the cyclomatic one).

### IN-02: Four "unused" devDependencies -- NO ACTION (confirmed false positives)

**File:** `packages/github-cache/package.json`
**Decision:** Confirmed false positives; not removed. `@nx/vitest` is an Nx plugin
that infers the `test` target via `nx.json` (invisible to fallow's ES import
graph; removing it breaks `nx test`). `@swc-node/register`, `@swc/helpers`, and
`tslib` are the SWC transpile toolchain + `importHelpers` runtime carried from the
Phase 0 workspace baseline. Recorded so a future reader does not "clean up" these
and break the build.

## Verification

- `npx nx test github-cache` -> **35 passed (35)**, 4 test files (added CR-01
  regression, removed vacuous SRV-01).
- `npx nx typecheck github-cache` -> **Successfully ran** (incl. its `build`
  dependency; the `let bytes: Buffer` definite-assignment pattern compiles clean
  under TS strict).
- `npx nx build github-cache` -> **Successfully ran**.

---

_Fixed: 2026-07-18T22:54:44Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
</content>
</invoke>
