---
phase: 01-walking-skeleton
reviewed: 2026-07-18T21:46:39Z
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
  warning: 1
  info: 5
  total: 6
status: issues_found
---

# Phase 1: Code Review Report

**Reviewed:** 2026-07-18T21:46:39Z
**Depth:** deep
**Files Reviewed:** 14
**Status:** issues_found

## Summary

Reviewed the walking-skeleton Nx remote-cache HTTP server (`server.ts`), its in-memory
backend port + adapters, the `serve()` composition root, the barrel export, and the
conformance/unit specs, plus TS/vitest/package config. Adversarial focus per the domain
brief: auth bypass, timing side-channels, unbounded buffering/DoS, guard-clause ordering,
status-code correctness, and whether a read fault can surface as a wrong artifact.

**The production security posture is sound.** No BLOCKER-class defect was found. Traced
end to end:

- **Auth (SRV-02):** `makeAuthGate` hashes both the expected and presented token to fixed
  32-byte SHA-256 digests before `timingSafeEqual`, so lengths always match (no length
  side-channel, no `ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH` throw). No `===` fallback. Correct.
- **Guard-clause order (SRV-03):** route/method (404) -> auth (401) -> hash (400) ->
  body-cap (413) -> backend. A malformed/oversized/unauthenticated request cannot reach the
  backend; verified by the spy-backend tests asserting `called === false`.
- **Hash guard:** `/^[a-f0-9]{1,512}$/` runs on the raw (undecoded) `req.url` capture, so
  URL-encoded traversal (`%2e%2e`) and query strings are rejected with 400 before any backend
  call. N/A for the Map backend but correct for future filesystem backends.
- **Body cap (SRV-04):** both the fast path (oversized `Content-Length`) and the streaming
  path (lying/absent `Content-Length`, chunked overflow) abort; peak retained memory is
  bounded to the cap + one chunk (over-cap chunks are counted but not pushed). A small
  `Content-Length` with a huge actual body is still caught by the streaming loop -- no bypass.
- **Read best-effort / write fail-closed (SRV-05):** `backend.get` faults degrade to 404
  MISS (never a wrong artifact, never 5xx); `backend.put` faults surface as 500 (never a
  silent 200). Tested on both sides.
- **Anti-poisoning:** the writable backend returns `conflict` (409) when the hash already
  exists -- entries are immutable, no override. This is the key "never serve a poisoned
  artifact" property and it is tested.
- **Status codes vs vendored contract:** server emits PUT 200/409/403/500 and GET 200/404,
  matching the vendored Nx 23.1.0 spec's declared codes (200/401/403/409 for PUT;
  200/403/404 for GET); 400/413 are additional server-side hardening. Hard-200 (not any-2xx)
  is asserted.
- **Conformance drift guard (D-05):** the pinned `VENDORED_SPEC_SHA256` was independently
  recomputed and **matches** the committed file (`8c648a0f...529e5`, 2443 bytes); the fixture
  hashes the full file and does not key off `info.version` (confirmed `1.0.0` and useless as
  a drift signal, exactly as documented).

The one WARNING is a test-quality defect: the `server.spec.ts` SRV-01 loopback test is
vacuous. The remaining items are Info-level hardening/robustness notes.

## Warnings

### WR-01: SRV-01 loopback test is vacuous -- it asserts the test harness, not production

**File:** `packages/github-cache/src/server/server.spec.ts:29-36` (helper at `:19-26`)
**Issue:** The test named `binds 127.0.0.1 only (SRV-01)` calls the local `listen()` helper,
which itself hardcodes the bind address:

```ts
server.listen(0, '127.0.0.1', () => resolve());   // helper chooses the address
...
expect(address.address).toBe('127.0.0.1');        // then asserts that same choice
```

`createCacheServer` does not bind at all -- it returns an unbound `http.Server`; binding is
`serve()`'s responsibility. So this assertion is a tautology: it verifies the test's own
`listen()` call, not any production control. It would pass unchanged even if `serve()` bound
`0.0.0.0`. For a load-bearing security property (loopback-only, never routable) this test
gives false confidence.

Mitigating fact: the *real* SRV-01 coverage exists in `serve.spec.ts:15,48` where `serve()`
hardcodes `127.0.0.1` and the test asserts it, and `serve()` exposes no host option -- so a
routable-bind regression is caught there. This finding is about the misleading named test,
not a coverage gap.

**Fix:** Rename/repurpose the `server.spec.ts` test so it does not claim to verify the bind
(e.g. drop it, or rename to reflect it only checks the returned server listens where told),
and treat `serve.spec.ts` as the authoritative SRV-01 assertion. If you want a
`createCacheServer`-level SRV-01 test, it must let production choose the address (which it
cannot, by design) -- so the correct home is `serve.spec.ts`.

## Info

### IN-01: 413 status is delivered best-effort -- `req.destroy()` can truncate the response

**File:** `packages/github-cache/src/server/server.ts:108-111, 121-127`
**Issue:** On both body-cap rejections the code does `res.statusCode = 413; res.end(); req.destroy();`.
`req.destroy()` tears down the shared socket and can RST the connection before the 413 flushes,
so the client may observe a socket error instead of 413. The specs already acknowledge this
(`server.spec.ts:200,243` only assert the status when it arrives). Behavior is fail-closed and
safe -- the oversized upload is rejected either way -- so this is cosmetic, not correctness.
**Fix:** If reliable 413 delivery is wanted, destroy after the response flushes
(e.g. `res.end(() => req.destroy())` or destroy on the response `finish` event), or set
`Connection: close`. Otherwise leave as-is and keep the "abort is the point" comment.

### IN-02: `serve()` prints the live bearer token to stdout in plaintext

**File:** `packages/github-cache/src/serve.ts:74`
**Issue:** `main()` writes `bearer token: ${running.token}` to stdout. For a local dev tool the
operator must obtain the token somehow, so this is by-design, but it lands a live secret in
terminal scrollback / captured logs / CI output if the entrypoint is ever run there.
**Fix:** Acceptable for loopback dev. For hardening, gate the print on `process.stdout.isTTY`,
or write the token to a `0600` file instead of stdout. Note it in the phase's threat register
so a future non-local invocation revisits it.

### IN-03: bearer scheme match is case-sensitive (RFC 7235 says it is case-insensitive)

**File:** `packages/github-cache/src/server/server.ts:30`
**Issue:** `header?.startsWith('Bearer ')` rejects a lowercase `bearer ` with 401. RFC 7235
defines the auth-scheme token as case-insensitive. No practical impact: the Nx client always
sends `Bearer`. **Fix:** If strict RFC compliance ever matters, compare
`header.slice(0, 7).toLowerCase() === 'bearer '` before slicing the token; otherwise leave as-is.

### IN-04: unsupported methods return 404 instead of 405

**File:** `packages/github-cache/src/server/server.ts:63-68`
**Issue:** A POST/DELETE to a well-formed `/v1/cache/{hash}` route returns 404 (route and
method are conflated in one guard). Not security-relevant -- it is still fail-closed and leaks
nothing -- but 405 Method Not Allowed would be more contract-accurate. The vendored spec only
documents GET/PUT, so this is minor fidelity. **Fix:** Optional; split the route match from the
method check and return 405 for a matched route with an unsupported method.

### IN-05: `afterEach` closes `server` unconditionally -- fragile under test reordering

**File:** `packages/github-cache/src/server/server.spec.ts:17`, `packages/github-cache/src/serve.spec.ts:8`
**Issue:** `afterEach(() => ... server.close(...))` runs even for the sync-only test
(`server.spec.ts:90`, `MAX_CACHE_BODY_BYTES`), where it double-closes the prior test's already-
closed instance (harmless -- the callback still fires). But if test order ever changed so a
non-server test ran first, `server` would be `undefined` and `afterEach` would throw on
`undefined.close`. `conformance.spec.ts:35-41` already uses the correct guarded pattern
(`if (server) { ...; server = undefined; }`). **Fix:** Adopt the guarded `if (server)` pattern
in both files for consistency and order-independence.

---

_Reviewed: 2026-07-18T21:46:39Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
