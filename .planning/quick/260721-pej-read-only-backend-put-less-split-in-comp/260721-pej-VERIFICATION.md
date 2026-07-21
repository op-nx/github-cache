---
quick_id: 260721-pej
title: Read-only backend put-less split (spec-compliant; server owns the PUT-to-read-only 403)
status: passed
verified_at: 2026-07-21
verified_head: ebb62fd40ff5b095c79855b20967c62d84edc841
branch: gsd/v0.0.1-greenfield-rebuild
verifier: gsd-verifier
---

# Verification - Quick 260721-pej: Read-only backend put-less split

## Verdict

**PASSED.** Goal achieved on HEAD `ebb62fd`. A read-only backend's write-inability is
now UNREPRESENTABLE (no `put` method), and the design remains **Nx-OpenAPI-compliant**:
the `PUT /v1/cache/{hash}` `403` ("read-only token used to write") response is preserved,
moved from a `put()` return value into the server (the protocol boundary). Full green
battery run first-hand.

## Goal-backward assessment

Goal (PLAN.md): make read-only write-inability unrepresentable while keeping the OpenAPI
PUT-403 answerable. Verified backward from that goal against the code as it exists on HEAD.

### 1. Read-only backends have NO put -- CONFIRMED

- `createReadOnlyMemoryBackend` (`packages/github-cache/src/backend/memory-backend.ts:57-67`)
  returns an object with only `get`. The former `put: () => 'forbidden'` is gone
  (inline comment lines 64-65 record the removal).
- `createReleasesReadBackend` (`packages/github-cache/src/backend/releases-backend.ts:67-104`)
  returns an object with only `get`; no `put` (comment lines 100-102 record it).
- Both return `ReadableBackend`. A write is structurally unrepresentable, not a runtime refusal.

### 2. Types -- CONFIRMED

`packages/github-cache/src/backend/types.ts`:
- `ReadableBackend { get(hash): Promise<GetResult> }` (line 23-25).
- `WritableBackend extends ReadableBackend { put(hash, bytes): Promise<PutResult> }` (line 28-30).
- `PutResult = 'stored' | 'conflict'` (line 8) -- `'forbidden'` REMOVED.
- `CacheBackend = WritableBackend` alias kept (line 36).
- `isWritableBackend(b): b is WritableBackend` runtime guard, `'put' in backend` (line 43-47).

### 3. Spec compliance -- the load-bearing check -- CONFIRMED

- `createCacheServer` (`server/server.ts:57-122`) accepts `ReadableBackend | WritableBackend`
  and, on a PUT, branches on `!isWritableBackend(backend)` -> `403` at lines 113-118, returned
  BEFORE `handlePut` (so `put` is never called on a backend that lacks it). Guard order is
  correct: route/method (404) -> auth (401) -> hash validate (400) -> **read-only 403** ->
  handlePut. A valid-but-read-only token therefore maps to 403, not 401.
- `handlePut`'s `PutResult` switch (lines 225-244) dropped the `'forbidden'` case; the `default`
  is now a `never` exhaustiveness guard over `'stored' | 'conflict'`.
- `server.spec.ts:337-349` -- test "returns 403 on a PUT against a read-only backend (D-04 seam)"
  constructs the server with a put-less `createReadOnlyMemoryBackend()` and asserts `res.status === 403`.
  PASSING (server.spec.ts: 17/17 tests green in the first-hand run).
- OpenAPI cross-check (`conformance/nx-cache-openapi.v23.1.0.json`): PUT responses are exactly
  `200, 401, 403, 409`; the `403` description is "Access forbidden. (e.g. read-only token used
  to write)". The 403 path is preserved -> the design is spec-compliant.

### 4. selectBackend union + serve branch -- CONFIRMED

- `selectBackend` (`lib/select-backend.ts:29-60`) returns `ReadableBackend | WritableBackend`
  (untrusted/no-token -> read-only; trusted+token -> writable Actions backend).
- `serve` (`serve.ts:88-117`) branches on `isWritableBackend`: a writable backend gets its
  `put` wrapped in `withHashLock` + in-flight drain tracking (lines 96-112); a read-only backend
  is passed through unchanged (line 114) -- nothing to serialize/drain on a nonexistent write path.

### 5. Public surface -- CONFIRMED

- `index.ts` barrel exports `ReadableBackend` + `WritableBackend` (plus `CacheBackend`, `GetHit`,
  `GetResult`, `PutResult`).
- `public-surface.spec.ts` `EXPECTED_TYPE_EXPORTS` includes both new names and keeps `CacheBackend`
  (lines 42-49); exact-equality assertion passes (public-surface.spec.ts: 12/12 green).

### 6. Green battery -- CONFIRMED FIRST-HAND

- `npx nx run-many -t typecheck test integration --skip-nx-cache` -> SUCCESS. 27 test files,
  **340 tests passed**, incl. conformance.spec.ts (9), server.spec.ts (17), select-backend.spec.ts (25),
  public-surface.spec.ts (12), memory-backend.spec.ts (6), releases-backend.spec.ts (26).
- `npm run fallow` -> "No issues found" (0 dead-code findings).
- `npm run check:action` -> `build:action` rebuilt `start-cache-server/index.js`;
  `git diff --exit-code` clean (no bundle drift).
- CI run **29849039249** verified on HEAD `ebb62fd` (`pull_request`, conclusion **success**):
  all 10 PR jobs green -- format-check, fallow, pack-check, build, ppe, integration
  (ubuntu-24.04-arm), integration (windows-11-arm), typecheck, test, action-bundle-drift; 5
  publish/dogfood/consumer-smoke jobs correctly skipped for a PR event. Evidence supports the
  green claim.

## Minor, non-blocking observation

- Stale docstring: the block comment above `createReadOnlyMemoryBackend`
  (`backend/memory-backend.ts:50-53`) still reads "put always yields 'forbidden' -> the server
  maps it to 403", describing the removed behavior. The inline comment at lines 64-65 is correct,
  the code has no `put`, and the goal is unaffected. Documentation nit only -- does not change the
  PASSED verdict. Worth a one-line doc fix on the next touch of the file.

## Nx-OpenAPI compliance statement

The design REMAINS compliant with the Nx cache OpenAPI contract. The `PUT /v1/cache/{hash}` `403`
"read-only token used to write" response is answered by the server at the protocol boundary
(`isWritableBackend` false branch), replacing the former `put()->'forbidden'` return value with
no loss of the 403 status. GET (200/404), auth (401), conflict (409), and body-cap (413) paths are
unchanged. 403-on-PUT-to-read-only is preserved and tested.
