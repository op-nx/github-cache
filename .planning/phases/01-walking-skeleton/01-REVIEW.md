---
phase: 01-walking-skeleton
reviewed: 2026-07-18T22:35:02Z
depth: deep
files_reviewed: 14
files_reviewed_list:
  - packages/github-cache/src/server/server.ts
  - packages/github-cache/src/server/server.spec.ts
  - packages/github-cache/src/backend/memory-backend.ts
  - packages/github-cache/src/backend/types.ts
  - packages/github-cache/src/backend/memory-backend.spec.ts
  - packages/github-cache/src/serve.ts
  - packages/github-cache/src/serve.spec.ts
  - packages/github-cache/src/index.ts
  - packages/github-cache/src/conformance/conformance.spec.ts
  - packages/github-cache/src/conformance/nx-cache-openapi.v23.1.0.json
  - packages/github-cache/vitest.config.mts
  - packages/github-cache/tsconfig.lib.json
  - packages/github-cache/tsconfig.spec.json
  - packages/github-cache/package.json
findings:
  critical: 1
  warning: 2
  info: 8
  total: 11
status: issues_found
---

# Phase 1: Code Review Report

**Reviewed:** 2026-07-18T22:35:02Z
**Depth:** deep (re-run with structural pre-pass enabled)
**Files Reviewed:** 14
**Status:** issues_found

## Summary

Re-review of the Phase 1 walking-skeleton Nx remote-cache HTTP server, now **incorporating a structural pre-pass from fallow 3.6.0** (verdict: `fail`). The previous pass (without the structural substrate) concluded "no BLOCKER-class defect"; deeper end-to-end tracing this round overturns that with one Critical.

The security *contract* is genuinely well built and I re-verified it end to end:

- **Auth (SRV-02):** `makeAuthGate` hashes both expected and presented tokens to fixed 32-byte SHA-256 digests before `timingSafeEqual` -> no length side-channel, no `ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH` throw, no `===` fallback. Correct.
- **Guard order (SRV-03):** route/method (404) -> auth (401) -> hash `/^[a-f0-9]{1,512}$/` (400) -> Content-Length fast-path (413) -> streaming cap (413) -> backend. Spy-backend tests prove the backend is never reached on a rejected request.
- **Read/write asymmetry (SRV-05):** `backend.get` faults degrade to a 404 MISS (never a wrong artifact, never 5xx); `backend.put` faults fail closed to 500 (never a silent 200). Immutable-once-written store returns 409 on override -> no cache poisoning.
- **Contract fidelity + drift guard (TEST-07/D-05):** PUT success maps to exactly 200 (Nx 21+ floor); I independently recomputed `sha256` of the committed `nx-cache-openapi.v23.1.0.json` and it **matches** the pinned `8c648a0f...529e5` byte-for-byte; the fixture hashes the full file, not `info.version`.

**But the request handler has a hole that turns a normal client event into a process crash (CR-01).** Every awaited section is defended by `try/catch` *except* the PUT body-drain loop. Any stream error mid-upload — a cancelled build, a dropped connection, a lying `Content-Length` — rejects the `async` http listener; with Node v24's default `unhandledRejection: throw` policy and no global handler anywhere in the repo (both verified), that **terminates the server process**. It is reachable by ordinary post-auth traffic, so one aborted upload takes down the shared cache for everyone. That is a BLOCKER.

Two Warnings: the known-vacuous SRV-01 test (carried WR-01) and the handler complexity fallow flags as introduced (WR-02). Info items adjudicate the remaining structural findings — one real minor `makeAuthGate` export, and four fallow false positives that must NOT be actioned — plus hardening/robustness notes carried from the prior pass.

## Structural Findings (fallow)

Source: **fallow 3.6.0**, verdict `fail`. Summary: `unused_exports: 1`, `unused_dev_dependencies: 4`, `complexity_findings_above_threshold: 1`, `duplication_clone_groups: 0`. Adjudication of each item; narrative findings below build on this substrate.

| # | fallow finding | File:Line | Adjudication |
|---|----------------|-----------|--------------|
| S1 | `unused_export` — `makeAuthGate` (nothing imports it outside its module) | `server/server.ts:24` | **CONFIRMED real (minor).** Not in the `index.ts` barrel, not imported by any spec. -> **IN-01** (drop `export`). |
| S2 | `complexity` — request-handler arrow fn cyclomatic 18 / CRAP 88 (introduced) | `server/server.ts:60` | **CONFIRMED above threshold.** Well-tested and deliberately linear, but decomposable. -> **WR-02**. |
| S3 | `unused_dev_dependency` — `@nx/vitest` | `package.json:17` | **FALSE POSITIVE** — Nx plugin inferring the `test` target via `nx.json`, not an ES import. -> **IN-02**, do NOT remove. |
| S4 | `unused_dev_dependency` — `@swc-node/register`, `@swc/helpers`, `tslib` | `package.json` | **FALSE POSITIVE** — SWC transpile toolchain + `importHelpers` runtime; Phase 0 workspace-shell baseline, out of Phase 1 scope. -> **IN-02**, do NOT remove. |

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: Unhandled promise rejection in the PUT body-read loop crashes the process

**File:** `packages/github-cache/src/server/server.ts:118-132`
**Issue:** The handler is `async (req, res) => {...}` passed to `http.createServer`. Node's `'request'` emitter neither awaits nor catches the returned promise, so any rejection becomes an unhandled rejection. Two awaited sections are defended — `backend.get` (lines 87-100) and `backend.put` (lines 136-143) each sit in a `try/catch` — but the body-drain loop is not:

```ts
const chunks: Buffer[] = [];
let total = 0;

for await (const chunk of req) {   // <-- rejects on any stream error; NOT guarded
  total += chunk.length;
  ...
  chunks.push(chunk);
}

const bytes = Buffer.concat(chunks);
```

`for await ... of req` rejects whenever the request stream is destroyed before a clean `end`: a client disconnect mid-upload, a cancelled build (Ctrl-C), a transient network drop, a `Content-Length` that overstates the bytes actually sent (premature close -> `ERR_STREAM_PREMATURE_CLOSE`), or a malformed chunked body. The reject escapes the `async` handler with no `.catch()`. This repo runs Node **v24** (verified `node -v` = v24.13.0), whose default `unhandledRejection` policy is `throw`, and there is **no** `process.on('unhandledRejection')`/`uncaughtException` handler anywhere in the package or repo (verified by search). Net: **the server process crashes.**

Reachability makes this a BLOCKER rather than an edge case: the loop is downstream of the auth gate (line 70), so a trigger needs a valid bearer token — but for a remote cache that token is held by every Nx CI worker, and the trigger is *ordinary client behavior* (a cancelled or network-blipped build mid-PUT), not solely an attacker. One aborted upload downs the shared cache for every other worker. (In the variant where the loop completes but the socket later errors, the response is also never `end()`ed — the same missing guard leaks the socket until timeout.)

**Fix:** Wrap the drain (and `Buffer.concat`) so a stream fault fails the single request instead of the process:

```ts
let bytes: Buffer;

try {
  const chunks: Buffer[] = [];
  let total = 0;

  for await (const chunk of req) {
    total += chunk.length;

    if (total > maxBodyBytes) {
      res.statusCode = 413;
      res.end();
      req.destroy();

      return;
    }

    chunks.push(chunk);
  }

  bytes = Buffer.concat(chunks);
} catch {
  // client aborted / stream error mid-upload: fail this request, never the process
  if (res.headersSent) {
    res.destroy();
  } else {
    res.statusCode = 400;
    res.end();
  }

  return;
}
```

Add a regression test that starts a PUT with a valid token, aborts the socket mid-body, and asserts the server still answers a subsequent request. Defense-in-depth: a top-level `try/catch` around the whole handler body (mirroring the existing get/put guards) and a `server.on('clientError', ...)` close adjacent stream-error paths.

## Warnings

### WR-01: SRV-01 loopback test in server.spec.ts is vacuous (tautological)

**File:** `packages/github-cache/src/server/server.spec.ts:29-36` (helper at `:19-26`)
**Issue:** The test named `binds 127.0.0.1 only (SRV-01)` asserts the bind address, but that address is chosen by the test's own `listen()` helper (`server.listen(0, '127.0.0.1', ...)`, line 21), then the same value is asserted back. `createCacheServer` never binds — it returns an unbound `http.Server`; binding is `serve()`'s job. So the assertion is a tautology and would pass unchanged even if production bound `0.0.0.0`. For a load-bearing security property (loopback-only) this gives false confidence. Real SRV-01 coverage lives in `serve.spec.ts:18-27`, which drives `serve()` (no host option exposed) and asserts `127.0.0.1` and not `0.0.0.0`/`::`. (Previously recorded WR-01; re-surfaced because the vacuous test still ships.)
**Fix:** Drop the `server.spec.ts` test (the honest assertion lives in `serve.spec.ts`), or rename it to state it only checks that the returned server listens where the *test* told it to. Treat `serve.spec.ts` as the authoritative SRV-01 assertion.

### WR-02: Request-handler complexity above threshold (fallow S2, introduced)

**File:** `packages/github-cache/src/server/server.ts:60-169`
**Issue:** fallow 3.6.0 flags the request-handler arrow function at cyclomatic 18 / CRAP 88 (thresholds 20 / 30), marked `introduced`. One ~110-line body bundles the whole request lifecycle: route/method gate, auth gate, hash validation, Content-Length fast-path, streaming body cap, GET dispatch, PUT dispatch, and the status-map switch. It is well-tested (SRV-01..05, round-trip, conformance cover every branch) and the guard-clause linearity is a deliberate, documented auditability property (the ordered ladder *is* the security contract) — which is why this is a Warning, not a Critical. But 18 is high for one function and it will grow as Phase 3 adds a real backend.
**Fix:** Extract the two method bodies into module-private handlers so the top-level handler stays a short, auditable dispatcher and each branch is independently testable:

```ts
async function handleGet(backend, hash, res) { /* lines 86-103 */ }
async function handlePut(backend, hash, req, res, maxBodyBytes) { /* lines 105-168 */ }
```

The shared guard ladder (route/auth/hash) stays inline at the top; the CR-01 try/catch lands cleanly inside `handlePut`.

## Info

### IN-01: `makeAuthGate` is exported but only used internally (fallow S1)

**File:** `packages/github-cache/src/server/server.ts:24`
**Issue:** `makeAuthGate` is `export`ed with a full doc comment, but nothing imports it outside `server.ts` — `index.ts` does not re-export it and no spec imports it (they exercise it transitively through `createCacheServer`). Effectively module-private with a public signature, needlessly widening the surface.
**Fix:** Drop the `export` keyword. If a future phase wants to unit-test the gate directly, re-export it deliberately then.

### IN-02: Four "unused" devDependencies are fallow false positives — do NOT remove (fallow S3, S4)

**File:** `packages/github-cache/package.json` (root workspace deps)
**Issue:** `@nx/vitest`, `@swc-node/register`, `@swc/helpers`, `tslib` are flagged unused because none appears in the ES import graph — by design invisible to it. `@nx/vitest` is an Nx plugin registered in `nx.json` that *infers* the `test` target (removing it breaks `nx test`); the SWC trio is the transpile toolchain + `importHelpers` runtime from the Phase 0 workspace baseline.
**Fix:** No action. Recorded so a future reader does not "clean up" these and break the build. Optionally allowlist them in the fallow config to silence the false positive.

### IN-03: 413 is delivered best-effort — `req.destroy()` can truncate the response

**File:** `packages/github-cache/src/server/server.ts:108-111, 121-127`
**Issue:** Both body-cap rejections do `res.statusCode = 413; res.end(); req.destroy();`. `req.destroy()` tears down the shared socket and can RST before the 413 flushes, so the client may see a socket error instead of 413. The specs already accommodate this (only assert the status when it arrives). Fail-closed and safe — the oversized upload is rejected either way — so cosmetic, not correctness.
**Fix:** For reliable 413 delivery, destroy after flush (`res.end(() => req.destroy())` or on the response `finish` event) or set `Connection: close`. Otherwise leave as-is.

### IN-04: PUT drains the full body (up to 2 GiB) before the backend can return 403/409

**File:** `packages/github-cache/src/server/server.ts:115-137`
**Issue:** The body is fully buffered before `backend.put` runs, which is where `forbidden` (403, read-only seam) and `conflict` (409) are decided. So a read-only backend accepts and buffers a whole upload (bounded at `maxBodyBytes`, default 2 GiB) purely to reject it, and a conflicting hash does the same. Bounded (not the "unbounded buffering" failure mode) and only reachable post-auth, so acceptable for Phase 1 — but wasted work and a resource-amplification foothold.
**Fix:** No change for Phase 1. Upgrade path (Phase 3): let the backend signal read-only / existence (`canWrite()` / `has(hash)`) so the handler can short-circuit 403/409 before draining the body.

### IN-05: `serve()` prints the live bearer token to stdout in plaintext

**File:** `packages/github-cache/src/serve.ts:74`
**Issue:** `main()` writes `bearer token: ${running.token}` to stdout. By-design for a local dev tool (the operator needs the token), but it lands a live secret in terminal scrollback / captured logs / CI output if the entrypoint is ever run there.
**Fix:** Acceptable for loopback dev. For hardening, gate the print on `process.stdout.isTTY`, or write the token to a `0600` file. Note it in the phase threat register so a future non-local invocation revisits it.

### IN-06: Bearer scheme match is case-sensitive (RFC 7235 says case-insensitive)

**File:** `packages/github-cache/src/server/server.ts:30`
**Issue:** `header?.startsWith('Bearer ')` rejects a lowercase `bearer ` with 401. RFC 7235 defines the auth-scheme token as case-insensitive. No practical impact — the Nx client always sends `Bearer`.
**Fix:** If strict RFC compliance ever matters, compare `header.slice(0, 7).toLowerCase() === 'bearer '` before slicing the token; otherwise leave as-is.

### IN-07: Unsupported methods return 404 instead of 405

**File:** `packages/github-cache/src/server/server.ts:63-68`
**Issue:** A POST/DELETE to a well-formed `/v1/cache/{hash}` returns 404 (route and method are conflated in one guard). Not security-relevant — still fail-closed, leaks nothing — but 405 Method Not Allowed would be more contract-accurate. The vendored spec documents only GET/PUT, so this is minor fidelity.
**Fix:** Optional; split the route match from the method check and return 405 for a matched route with an unsupported method.

### IN-08: Test `afterEach` hooks assume `server` was assigned

**File:** `packages/github-cache/src/server/server.spec.ts:17`, `packages/github-cache/src/serve.spec.ts:8`
**Issue:** Both suites run `afterEach(() => ... server.close(...))` against a module-level `let server: Server` with no guard. It works today only because every server-creating test runs before/around the one synchronous test (`server.spec.ts:90`). If a synchronous or early-failing test ever runs first, `afterEach` throws `Cannot read properties of undefined (reading 'close')`, masking the real failure. `conformance.spec.ts:35-41` already does this correctly with `if (server) { ... }`.
**Fix:** Guard the teardown to match the conformance suite's pattern (`afterEach(() => server ? new Promise<void>((r) => server.close(() => r())) : undefined)`).

---

_Reviewed: 2026-07-18T22:35:02Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
_Structural pre-pass: fallow 3.6.0 (incorporated)_
