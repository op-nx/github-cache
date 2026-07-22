---
quick_id: 260721-pej
title: Read-only backend put-less split (spec-compliant)
status: complete
pr: 3
branch: gsd/v0.0.1-greenfield-rebuild
verification: gsd-verifier PASSED; CI green (all 9 pull_request jobs incl. conformance + cross-OS integration) on ebb62fd
supersedes: the "declined" verdict on type-design #5 in quick 260721-g1p
---

# Quick Task 260721-pej - Read-only backend put-less split

Implemented the type-design #5 split the earlier review (260721-g1p) had DECLINED.
The block then was that the `'forbidden'` PutResult was load-bearing for the Nx
contract's `PUT` 403. Consulting the vendored OpenAPI spec showed the 403 ("read-only
token used to write") IS a first-class contract response -- so the clean fix is to
move it from a `put()` return value into the SERVER (the protocol boundary). That lets
read-only backends drop `put` entirely AND removes the awkward `'forbidden'`.

## Landed (commit ebb62fd)

- `backend/types.ts`: `ReadableBackend { get }` + `WritableBackend extends ReadableBackend { put }`;
  `CacheBackend = WritableBackend` (back-compat alias); `PutResult = 'stored' | 'conflict'`
  (`'forbidden'` removed); `isWritableBackend()` runtime guard.
- Read-only backends (`createReadOnlyMemoryBackend`, `createReleasesReadBackend`) -> `ReadableBackend` (no put).
- `selectBackend` -> `ReadableBackend | WritableBackend`; `serve` branches (writable gets the
  withHashLock put-wrap + SIGTERM drain, read-only passed through).
- `createCacheServer` accepts the union; a PUT to a read-only backend -> **403 directly**
  (after auth 401 + hash 400), never a `put()->'forbidden'`. `handlePut` switch is now
  exhaustive over `'stored' | 'conflict'`.
- Public surface: `ReadableBackend` + `WritableBackend` added to the barrel (CacheBackend alias
  kept); `PutResult` drops `'forbidden'` (breaking, acceptable at v0.0.1); public-surface.spec updated.
- Specs assert read-only-ness structurally (`isWritableBackend` false / no `put`) instead of
  `put -> 'forbidden'`. Action bundle rebuilt.

## Verification

- gsd-verifier gate: **passed** (see 260721-pej-VERIFICATION.md) -- first-hand confirmed the 403
  path is preserved and OpenAPI-compliant, plus the stale docstring nit it raised is fixed.
- `nx run-many -t typecheck test integration`: 340 tests + integration green; fallow 0 issues;
  check:action clean.
- CI run 29849039249 on ebb62fd: all 9 pull_request jobs green (incl. `conformance` in `test`
  and the ubuntu+windows integration matrix).

## Nx OpenAPI compliance

Preserved. `PUT /v1/cache/{hash}` responses stay 200/401/403/409; the 403 ("read-only token
used to write") now originates at the server for a read-only backend rather than from a
put() return -- same wire behavior, cleaner types.
