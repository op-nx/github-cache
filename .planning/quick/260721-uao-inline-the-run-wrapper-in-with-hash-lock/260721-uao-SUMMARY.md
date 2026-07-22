---
quick_id: 260721-uao
slug: inline-the-run-wrapper-in-with-hash-lock
status: complete
date: 2026-07-21
commit: d4ba437
---

# Quick Task 260721-uao: Inline the run wrapper in withHashLock - Summary

## Outcome

Applied the single triaged ponytail-review over-engineering finding on the
current branch (`gsd/v0.0.1-greenfield-rebuild`) as one atomic, bisect-safe
commit.

## Change

**File:** `packages/github-cache/src/lib/with-hash-lock.ts` (+3/-3)

Removed the dead `run` local (`const run = (): Promise<T> => fn();`) and inlined
`const result = prior.then(fn, fn);`. Comment updated to reference `fn`.

## Verification

- `nx test github-cache`: 27 files, 344 tests passed (includes
  `with-hash-lock.spec.ts`, `serve.spec.ts`).
- `tsc --noEmit -p packages/github-cache/tsconfig.lib.json`: exit 0.
- Behavior unchanged: `fn` ignores the settled value/reason `.then` passes it,
  so `prior.then(fn, fn)` is identical to the prior `prior.then(run, run)`.

## Review context (not applied)

The ponytail-review pass surfaced 5 candidates; 4 were rejected on read and are
intentionally NOT changed:

1. `types.ts` `CacheBackend` alias -- documented public-API ergonomic name.
2. `actions-cache-backend.ts` `ReserveCacheError` catch -- deliberate
   defense-in-depth error handling (out of over-engineering scope).
3. `serve.ts` `op.then(del, del)` -- the `.finally` rewrite would re-raise the
   rejection into a `void`ed promise (unhandled rejection); current form is
   deliberately "cannot itself reject".
4. `trust.ts` `WriteTrust` reason union -- requirement-linked (TRUST-05/D-02)
   diagnostic-observability decision at a security-trust boundary.

## Commit

- `d4ba437` refactor(github-cache): inline the run wrapper in withHashLock
