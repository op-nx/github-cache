---
phase: 01-walking-skeleton
reviewed: 2026-07-18T23:04:25Z
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
  critical: 0
  warning: 2
  info: 7
  total: 9
status: issues_found
---

# Phase 1: Code Review Report

**Reviewed:** 2026-07-18T23:04:25Z
**Depth:** deep (post-fix re-review, structural pre-pass incorporated)
**Files Reviewed:** 14
**Status:** issues_found

## Summary

Post-fix re-review of the Phase 1 walking-skeleton Nx remote-cache HTTP server,
incorporating a fresh **fallow 3.6.0** structural pre-pass (verdict `fail`). The three
findings from the prior pass are **confirmed resolved and clean**:

- **CR-01 (PUT body-drain crash) — RESOLVED, verified sound, no regression.** The
  body-drain loop is now wrapped in its own `try/catch` (server.ts:117-149). I traced
  every property the fix has to hold:
  - *Fails closed:* a stream fault before any response yields **400** (145-146); the
    backend is never reached, so no silent 200.
  - *No double-response / no half-written leak:* if headers were already sent it calls
    `res.destroy()` instead of a second `res.end()` (141-144). The over-cap branch
    (`res.end()` + `req.destroy()` + `return`, 124-130) exits before the catch, so it
    cannot double-respond either.
  - *Does not swallow a legitimate backend error:* the drain `try/catch` is scoped to
    request-body reading ONLY. `backend.put` sits in a **separate** `try/catch`
    (153-160) that maps a backend fault to **500** — a real put fault can never be
    mistranslated into a 400/200. The GET path keeps its own `try/catch` → 404 (87-100).
  - *Regression test present:* server.spec.ts:330-377 declares an oversized
    `Content-Length`, writes a partial body, destroys the socket mid-upload, and asserts
    both `unhandledRejection === []` and that a subsequent request still returns 404
    (process survived).
- **WR-01 (vacuous SRV-01 test) — RESOLVED.** The tautological loopback assertion is
  gone from server.spec.ts; authoritative non-vacuous coverage now lives in
  serve.spec.ts:18-27, which drives the real `serve()` composition root whose
  `ServeOptions` exposes no `host` field, so the bind is 100% production-determined and
  asserts `127.0.0.1` and not `0.0.0.0`/`::`.
- **IN-01 (`makeAuthGate` export) — RESOLVED.** Now a module-private function
  declaration (server.ts:24), absent from the index.ts barrel and imported by no spec.

The rest of the security contract re-verified clean: constant-time auth over fixed
32-byte SHA-256 digests (SRV-02, no length side-channel, no throw); route→auth→hash
guard order with a spy-proven no-backend-call on rejection (SRV-03); dual 2 GiB body
cap on both the Content-Length fast path and the mid-stream path (SRV-04);
read→404-MISS / write→fail-closed-500 asymmetry (SRV-05); exact status mapping
(200/409/403/401/404/400/413); loopback-only bind (SRV-01). TEST-07 drift guard is
correct — I recomputed the vendored spec's sha256 and it matches the pinned
`8c648a0f...529e5` byte-for-byte.

**No Critical remains.** Two Warnings for a `--fix --all` pass: the request-handler
complexity fallow now flags as *worsened/introduced* (WR-02, cyc 20 / CRAP 106.4 —
the CR-01 try/catch pushed it up), and a latent empty-token auth-bypass gap in the
exported `createCacheServer` factory that `serve()` currently masks (WR-03). Seven
Info items are adjudicated below, including the confirmed four-devDep fallow false
positive that must NOT be actioned.

## Structural Findings (fallow)

Source: **fallow 3.6.0** (re-run on post-fix code), verdict `fail`. Summary:
`unused_exports: 0`, `unused_dev_dependencies: 4`, `complexity_findings_above_threshold: 1`,
`duplication_clone_groups: 0`. Adjudication below; narrative findings build on this substrate.

| # | fallow finding | File:Line | Adjudication |
|---|----------------|-----------|--------------|
| S1 | `complexity` — request-handler arrow fn cyclomatic 20 (AT threshold 20) / CRAP 106.4 (threshold 30), `introduced` (worsened from 18 after the CR-01 try/catch) | `server/server.ts:60` | **CONFIRMED at/over threshold.** Well-tested, deliberately linear, but no headroom left. -> **WR-02**. |
| S2 | `unused_dev_dependency` — `@nx/vitest` | `package.json` | **FALSE POSITIVE** — Nx plugin inferring the `test` target via `nx.json`, not an ES import. Removing it breaks `nx test`. -> **IN-02**, do NOT remove. |
| S3 | `unused_dev_dependency` — `@swc-node/register`, `@swc/helpers`, `tslib` | `package.json` | **FALSE POSITIVE** — SWC transpile toolchain + `importHelpers` runtime; not import-graph-visible. -> **IN-02**, do NOT remove. |

`unused_exports` is now 0, confirming IN-01 (`makeAuthGate` de-export) landed.

## Narrative Findings (AI reviewer)

## Warnings

### WR-02: Request-handler dispatcher at the cyclomatic complexity threshold (fallow S1, introduced)

**File:** `packages/github-cache/src/server/server.ts:60-186`
**Issue:** The `http.createServer` async callback is one ~126-line arrow function
carrying the whole request lifecycle: route/method gate, auth gate, hash validation,
Content-Length fast-path 413, streaming body cap, the CR-01 drain try/catch, the
backend put try/catch, and the status switch. fallow 3.6.0 measures cyclomatic **20**
(at the max threshold) / CRAP **106.4** (threshold 30), marked `introduced` — the
CR-01 fix pushed it from 18 to 20, so it now has zero headroom. Well-tested and the
guard-clause linearity is a deliberate auditability property (which is why this is a
Warning, not Critical), but the next guard tips it over and the density makes the
load-bearing guard order easy to disturb.
**Fix:** Extract two module-private async sub-handlers, keeping the top-level guard
ladder inline so the load-bearing order is preserved **verbatim**. The top-level
callback keeps guards 1-3 in order, then dispatches:

```ts
// top-level callback: route/method (404) -> auth (401) -> hash (400) -> dispatch
return http.createServer(async (req, res) => {
  const match = req.url ? ROUTE.exec(req.url) : null;

  if (!match || (req.method !== 'GET' && req.method !== 'PUT')) {
    res.statusCode = 404;
    res.end();

    return;
  }

  if (!authGate(req.headers.authorization)) {
    res.statusCode = 401;
    res.end();

    return;
  }

  const hash = match[1];

  if (!HASH_PATTERN.test(hash)) {
    res.statusCode = 400;
    res.end();

    return;
  }

  if (req.method === 'GET') {
    return handleGet(backend, hash, res);
  }

  return handlePut(backend, hash, req, res, maxBodyBytes);
});
```

`handleGet(backend, hash, res)` holds the existing get try/catch → 200 hit / 404 miss
/ 404 fault (current 87-100). `handlePut(backend, hash, req, res, maxBodyBytes)` holds,
**in this exact order**: (1) Content-Length fast-path 413 (105-113), (2) the drain
try/catch with mid-stream 413 and fail-closed 400/`res.destroy` (115-149), (3) the
`backend.put` try/catch → 500 (151-160), (4) the status switch 200/409/403/500
(162-185). Because the three top-level guards run before dispatch and `handlePut`
preserves cap→drain→put→map, the full guard order (route → auth 401 → hash 400 →
body-cap 413 → drain/try-catch → backend → status) is unchanged. Do NOT reorder, merge,
or hoist any guard, and keep the drain and put try/catch blocks separate (see CR-01).
This drops the arrow function and both sub-handlers below threshold with zero
behavioral change.

### WR-03: Exported `createCacheServer` accepts an empty token — auth bypass via `Bearer ` (empty)

**File:** `packages/github-cache/src/server/server.ts:53-58` (gate at 24-38)
**Issue:** `createCacheServer(backend, token)` does not validate `token`. If a caller
passes `''`, `makeAuthGate` computes `expected = sha256('')`. A client sending exactly
`Authorization: Bearer ` (scheme + empty token) passes `startsWith('Bearer ')`, and
`sha256(header.slice(7))` = `sha256('')` = `expected`, so `timingSafeEqual` returns
**true** — every such request authenticates and the cache is open. The shipped
`serve()` path masks this via `options.token || env || generateToken()`
(serve.ts:50-53), so the deployed artifact is safe today. But `createCacheServer` is a
public export (index.ts:4) offered precisely so "consumers can supply their own backend
adapter" — a consumer wiring it from an empty/misconfigured env var gets a silently open
cache. This is missing input validation at a trust boundary in a security-sensitive
public API.
**Fix:** Fail closed in the factory before building the gate (one line, no behavior
change for `serve()` which never passes empty):

```ts
export function createCacheServer(
  backend: CacheBackend,
  token: string,
  maxBodyBytes: number = MAX_CACHE_BODY_BYTES,
): http.Server {
  if (!token) {
    throw new Error('createCacheServer: a non-empty bearer token is required');
  }

  const authGate = makeAuthGate(token);
  // ...
}
```

Add a one-line regression test asserting `createCacheServer(backend, '')` throws.

## Info

### IN-02: Four "unused" devDependencies are fallow false positives — do NOT remove (fallow S2, S3)

**File:** `package.json` (workspace root; the package's own `packages/github-cache/package.json` declares none)
**Issue:** `@nx/vitest`, `@swc-node/register`, `@swc/helpers`, `tslib` are flagged
unused because none appears in the ES import graph — by design invisible to it.
`@nx/vitest` is an Nx plugin registered in `nx.json` that *infers* the `test` target
(removing it breaks `nx test`); the SWC trio is the transpile toolchain + `importHelpers`
runtime emit dependency.
**Fix:** No action — recorded so a `--fix --all` pass leaves all four in place and a
future reader does not "clean up" and break the build. Optionally allowlist them in the
fallow config to silence the false positive.

### IN-03: 413 is delivered best-effort — `req.destroy()` can truncate the response

**File:** `packages/github-cache/src/server/server.ts:107-113, 124-130`
**Issue:** Both body-cap rejections do `res.statusCode = 413; res.end(); req.destroy();`.
`req.destroy()` tears down the socket and can RST before the 413 flushes, so the client
may observe a socket error instead of 413. The specs already accommodate this (assert
413 only when it arrives, server.spec.ts:196-198, 239-241). Fail-closed and safe — the
oversized upload is rejected either way — so cosmetic, not correctness.
**Fix:** Leave as-is. This is a deliberate DoS tradeoff — stopping a multi-GiB upload
immediately outweighs guaranteed 413 delivery. If cleaner delivery is ever wanted
without reopening the DoS window, set `Connection: close` and destroy on the response
`finish` event rather than synchronously. Not a `--fix --all` item.

### IN-04: PUT drains the full body (up to 2 GiB) before the backend can return 403/409

**File:** `packages/github-cache/src/server/server.ts:115-160`
**Issue:** The body is fully buffered before `backend.put` runs, which is where
`forbidden` (403, read-only seam) and `conflict` (409) are decided. So a read-only
backend accepts and buffers a whole upload (bounded at `maxBodyBytes`, default 2 GiB)
only to reject it, and a conflicting hash does the same. Bounded (not unbounded
buffering) and only reachable post-auth, so acceptable for Phase 1 — but wasted work and
a resource-amplification foothold.
**Fix:** No change for Phase 1. Upgrade path (Phase 3): let the backend signal
read-only / existence (`canWrite()` / `has(hash)`) so the handler can short-circuit
403/409 before draining the body.

### IN-05: `serve()` prints the live bearer token to stdout in plaintext

**File:** `packages/github-cache/src/serve.ts:74`
**Issue:** `main()` writes `bearer token: ${running.token}` to stdout. By-design for a
local dev tool (the operator needs the generated token to configure the Nx client), but
it lands a live secret in terminal scrollback / captured logs / CI output if the
entrypoint is ever run there.
**Fix:** Leave as-is for the loopback, ephemeral, per-process dev server — the token must
reach the operator and stdout is the standard channel. For hardening if CI use is
anticipated, gate the print on `process.stdout.isTTY` (or mask in CI). Optional; not
required under `--fix --all`.

### IN-06: Bearer scheme match is case-sensitive (RFC 7235 says case-insensitive)

**File:** `packages/github-cache/src/server/server.ts:30`
**Issue:** `header?.startsWith('Bearer ')` rejects a lowercase `bearer `/`BEARER ` with
401. RFC 7235 defines the auth-scheme token as case-insensitive. No practical impact —
the Nx client always sends `Bearer`.
**Fix:** Leave as-is (the token compare must stay exact regardless). If strict RFC
interop ever matters, match the scheme case-insensitively (`/^Bearer /i.test(header)`)
while keeping the 7-char slice. Low value; only bundle with WR-02 if convenient.

### IN-07: Unsupported methods return 404 instead of 405

**File:** `packages/github-cache/src/server/server.ts:63-68`
**Issue:** A POST/DELETE to a well-formed `/v1/cache/{hash}` returns 404 (route and
method conflated in one guard, before auth). Not security-relevant — still fail-closed,
leaks nothing — but 405 Method Not Allowed with an `Allow` header would be more
contract-accurate. The vendored spec documents only GET/PUT.
**Fix:** Leave as-is. Collapsing non-GET/PUT to an opaque, pre-auth 404 avoids leaking
route/method existence and needs no `Allow` header — a defensible choice. Do not change
under `--fix --all`.

### IN-08: Test `afterEach` hooks assume `server` was assigned

**File:** `packages/github-cache/src/server/server.spec.ts:17`, `packages/github-cache/src/serve.spec.ts:8`
**Issue:** Both suites run `afterEach(() => ... server.close(...))` against a
module-level `let server` with no guard. `server.spec.ts`'s `MAX_CACHE_BODY_BYTES`
constant test (81-84) never assigns `server`; it works today only because it happens to
run after server-creating tests (so `afterEach` re-closes an already-closed server —
benign). But running it via `it.only`, or any reorder that puts it first, leaves
`server` `undefined` and `afterEach` throws `Cannot read properties of undefined
(reading 'close')`, producing a spurious failure that masks the real result.
`conformance.spec.ts:35-41` already guards this correctly.
**Fix:** Guard the teardown in both suites to match conformance.spec.ts:

```ts
afterEach(async () => {
  if (server) {
    const closing = server;
    server = undefined;
    await new Promise<void>((resolve) => closing.close(() => resolve()));
  }
});
```

Trivial and safe — worth applying under `--fix --all`.

---

_Reviewed: 2026-07-18T23:04:25Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
_Structural pre-pass: fallow 3.6.0 (incorporated)_
_Prior findings CR-01 / WR-01 / IN-01: confirmed resolved_
