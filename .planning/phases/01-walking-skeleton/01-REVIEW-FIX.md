---
phase: 01-walking-skeleton
fixed_at: 2026-07-18T23:18:08Z
review_path: .planning/phases/01-walking-skeleton/01-REVIEW.md
iteration: 2
findings_in_scope: 9
fixed: 3
skipped: 0
no_action: 6
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

---

# Phase 1: Code Review Fix Report -- Audit 2 (`--fix --all`)

**Fixed at:** 2026-07-18T23:18:08Z
**Source review:** .planning/phases/01-walking-skeleton/01-REVIEW.md (post-fix re-review, 2026-07-18T23:04:25Z)
**Iteration:** 2

**Scope:** Full `--fix --all` pass over the post-fix re-review findings (WR-02,
WR-03, IN-02..IN-08). The prior pass's CR-01 / WR-01 / IN-01 record above is
unchanged (those three were confirmed resolved by the re-review). Prior-pass
WR-02 (deferred) and IN-02 (no-action) are re-adjudicated here.

**Summary:**
- Findings in scope: 9 (2 warning, 7 info)
- Fixed: 3 (WR-03, WR-02, IN-08)
- Skipped (fix failed / rolled back): 0
- No-action / intentionally retained (per review disposition): 6 (IN-02..IN-07)

**Verification (final, `--skip-nx-cache`):**
- `npx nx test github-cache` -> **36 passed (36)**, 4 test files (was 35; +1 = the
  WR-03 RED-then-GREEN regression test).
- `npx nx typecheck github-cache` -> **Successfully ran** (incl. its `build` dep).
- `npx nx build github-cache` -> **Successfully ran**.

## Fixed Issues

### WR-03: Exported `createCacheServer` accepts an empty token -- auth bypass via `Bearer ` (empty)

**Severity:** Warning (SECURITY -- missing input validation at a public trust boundary)
**Files modified:** `packages/github-cache/src/server/server.ts`, `packages/github-cache/src/server/server.spec.ts`
**Commits:** `0a70433` (test, RED), `c933083` (fix, GREEN)
**Applied fix (TDD RED-first):**
- RED: added a spec asserting `createCacheServer(backend, '')` and
  `createCacheServer(backend, '   ')` both throw `/non-empty bearer token/`.
  Confirmed FAILING against the unguarded factory (`expected [Function] to throw
  an error`); 35 other tests green.
- GREEN: added a construction-time guard `if (!token || !token.trim()) throw new
  Error('createCacheServer: a non-empty bearer token is required (SRV-02)')`
  before `makeAuthGate(token)`. This closes the empty-credential bypass
  (`makeAuthGate('')` set `expected = sha256('')`, so `Authorization: Bearer `
  authenticated). The `|| !token.trim()` also rejects whitespace-only tokens; the
  `!token` short-circuit covers a JS consumer passing `undefined` from a
  misconfigured env var. `serve()` (`token || env || generate`) never passes an
  empty token, so its behavior is unchanged.
- SRV-02 constant-time property preserved: the guard runs ONCE at construction,
  not per request. `makeAuthGate`'s per-request `timingSafeEqual` over fixed
  32-byte SHA-256 digests is untouched -- no length side-channel introduced for
  non-empty tokens.

### WR-02: Request-handler dispatcher at the cyclomatic complexity threshold

**Severity:** Warning (complexity -- fallow S1, cyc 20 / CRAP 106.4, introduced)
**Files modified:** `packages/github-cache/src/server/server.ts`
**Commit:** `00c2b80`
**Applied fix (guard-order-preserving decomposition):** Extracted two
module-private async sub-handlers, `handleGet(backend, hash, res)` and
`handlePut(backend, hash, req, res, maxBodyBytes)`, from the ~126-line inline
`http.createServer` arrow. The top-level callback keeps guards 1-3 inline IN
EXACT ORDER -- route/method (404) -> auth (401) -> hash (400) -- then dispatches
`GET -> handleGet` / `PUT -> handlePut`. `handlePut` preserves, verbatim and in
order: (1) Content-Length fast-path 413, (2) the drain try/catch (mid-stream 413
+ fail-closed 400/`res.destroy`), (3) the SEPARATE `backend.put` try/catch ->
500, (4) the status switch 200/409/403/500. The drain and put try/catch blocks
were kept separate (merging would reintroduce CR-01 or swallow backend faults).
The full guard order (route -> auth -> hash -> body-cap -> drain -> backend ->
status) and every status code are byte-for-byte behavior-identical.
- **Requires human verification note:** this is a security-critical file. Behavior
  identity was verified by keeping ALL 36 existing tests green (they encode the
  order/status contract: SRV-02/03/04/05, the 200/401/403/404/409/413/500 map,
  and the CR-01 abort-survival test) plus a clean strict typecheck. No test was
  weakened. A reviewer should still eyeball the diff to confirm no guard was
  reordered, merged, or hoisted.

### IN-08: Test `afterEach` hooks assume `server` was assigned

**Severity:** Info (test robustness)
**Files modified:** `packages/github-cache/src/server/server.spec.ts`, `packages/github-cache/src/serve.spec.ts`
**Commit:** `5f2191e`
**Applied fix:** Guarded the teardown in both suites:
`afterEach(async () => { if (server) { await new Promise(resolve =>
server.close(() => resolve())); } })`. Previously the unguarded
`server.close()` threw `Cannot read properties of undefined (reading 'close')`
if a test that never assigns `server` (the `MAX_CACHE_BODY_BYTES` constant test,
and now the WR-03 throw test) ran first via `it.only` or a reorder, masking the
real result. Used the minimal guard (kept the non-nullable `server` type -- no
call-site churn); this matches `conformance.spec.ts`'s guarded pattern in
intent. Proven by running the `MAX_CACHE_BODY_BYTES` test in isolation
(`vitest run -t`): it now passes cleanly instead of throwing in teardown.

## No-action / Intentionally Retained (per REVIEW.md disposition)

### IN-02: Four "unused" devDependencies -- NO ACTION (confirmed fallow false positives)

**File:** `package.json` (workspace root)
**Decision:** Not removed. `@nx/vitest` is an Nx plugin that infers the `test`
target via `nx.json` (invisible to fallow's ES import graph; removing it breaks
`nx test`). `@swc-node/register`, `@swc/helpers`, and `tslib` are the SWC
transpile toolchain + `importHelpers` runtime emit dependency. Recorded so a
future reader does not "clean up" these and break the build. (Re-confirms the
prior pass's IN-02 no-action.)

### IN-03: 413 delivered best-effort -- `req.destroy()` can truncate the response

**File:** `packages/github-cache/src/server/server.ts` (handlePut 413 branches)
**Decision:** Left as-is per review. Deliberate DoS tradeoff -- aborting a
multi-GiB upload immediately outweighs guaranteed 413 delivery. Fail-closed and
safe either way; the specs already assert 413 only when it arrives. Not a
`--fix --all` item.

### IN-04: PUT drains the full body (up to 2 GiB) before backend can return 403/409

**File:** `packages/github-cache/src/server/server.ts` (handlePut drain)
**Decision:** Left as-is per review. Bounded (not unbounded) buffering, reachable
only post-auth; acceptable for Phase 1. Upgrade path is Phase 3 (backend
`canWrite()`/`has(hash)` to short-circuit before draining). No Phase 1 change.

### IN-05: `serve()` prints the live bearer token to stdout

**File:** `packages/github-cache/src/serve.ts:74`
**Decision:** Left as-is per review. By-design for a loopback, ephemeral,
per-process dev server -- the operator needs the generated token to configure the
Nx client and stdout is the standard channel. Optional hardening (gate on
`process.stdout.isTTY`) noted for if CI use is ever anticipated; not required.

### IN-06: Bearer scheme match is case-sensitive (RFC 7235 says case-insensitive)

**File:** `packages/github-cache/src/server/server.ts` (makeAuthGate scheme check)
**Decision:** Left as-is per review. No practical impact -- the Nx client always
sends `Bearer`. The token compare must stay exact regardless. Low value; not
bundled.

### IN-07: Unsupported methods return 404 instead of 405

**File:** `packages/github-cache/src/server/server.ts` (top-level route/method guard)
**Decision:** Left as-is per review. Collapsing non-GET/PUT to an opaque,
pre-auth 404 avoids leaking route/method existence and needs no `Allow` header --
a defensible fail-closed choice. Do not change under `--fix --all`.

---

_Fixed: 2026-07-18T23:18:08Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2 (`--fix --all`)_
