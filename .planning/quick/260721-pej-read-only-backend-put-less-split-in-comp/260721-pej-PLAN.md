---
quick_id: 260721-pej
title: Read-only backend put-less split (spec-compliant; server owns the PUT-to-read-only 403)
status: in-progress
mode: full --auto
branch: gsd/v0.0.1-greenfield-rebuild
supersedes: the "declined" verdict on type-design #5 in quick 260721-g1p
---

# Quick Task 260721-pej - Read-only backend put-less split

## Goal

Make a read-only backend's write-inability UNREPRESENTABLE (no `put` method), while
staying compliant with the Nx cache OpenAPI contract (`PUT /v1/cache/{hash}` MUST be
able to answer `403` "read-only token used to write"). The prior objection was that
the `'forbidden'` PutResult is load-bearing for that 403; the resolution moves the 403
from a `put()` return value into the SERVER (the protocol boundary), which lets
read-only backends drop `put` entirely and lets us delete `'forbidden'`.

## Design (auto-decided; documented per --auto)

`backend/types.ts`:
- `ReadableBackend { get(hash: Hash): Promise<GetResult> }`
- `WritableBackend extends ReadableBackend { put(hash: Hash, bytes: Buffer): Promise<PutResult> }`
- `CacheBackend = WritableBackend` (kept as a backward-compatible alias so the public
  barrel export + docs keep resolving; the get+put shape is unchanged for writers).
- `PutResult = 'stored' | 'conflict'` -- **drop `'forbidden'`** (no put() ever returns it now).
- `isWritableBackend(b): b is WritableBackend` runtime guard (`'put' in b`).

Backends:
- read-only (`createReadOnlyMemoryBackend`, `createReleasesReadBackend`) -> `ReadableBackend` (drop the `put: () => 'forbidden'`).
- writable (`createActionsCacheBackend`, `createWritableMemoryBackend`) -> `WritableBackend` (unchanged; put returns 'stored'/'conflict').

`selectBackend` -> `ReadableBackend | WritableBackend` (RW path writable, RO paths readable).

`serve`: branch on `isWritableBackend` -- writable gets the withHashLock put-wrap + SIGTERM
drain; read-only is passed through (nothing to serialize/drain on write).

`createCacheServer(backend: ReadableBackend | WritableBackend, token, maxBodyBytes)`:
- GET -> backend.get (unchanged).
- PUT -> if `isWritableBackend(backend)`: existing handlePut (stored->200, conflict->409);
  else: `403` (the spec's "read-only token used to write" response). Bare status body,
  consistent with the server's other status-only responses.
- handlePut's PutResult switch drops the `'forbidden'` case.

## Public-surface note (breaking, acceptable at v0.0.1)

- New exports: `ReadableBackend`, `WritableBackend`, `isWritableBackend`.
- `CacheBackend` kept as alias `= WritableBackend`.
- `PutResult` loses `'forbidden'` (a public union member) -- aligned with the redesign
  (a backend that wants to refuse writes is a `ReadableBackend`, not a put returning
  'forbidden'). Update public-surface.spec + docs-adoption if they pin these.

## Waves

1. types + isWritableBackend guard.
2. read-only backends drop put; writable unchanged.
3. selectBackend union return; serve branch; server 403 branch + switch.
4. specs: memory/releases/cleanup/select-backend (put-forbidden -> read-only/no-put),
   server (read-only PUT->403 via a ReadableBackend), public-surface (exports), serve.
5. bundle rebuild; full battery (typecheck+test+integration+fallow+format+check:action).
6. gsd-verifier gate; SUMMARY/STATE; docs commit; push; CI green.
