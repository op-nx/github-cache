---
phase: 02-default-cache-in-ci
reviewed: 2026-07-19T00:00:00Z
depth: deep
files_reviewed: 19
files_reviewed_list:
  - .fallowrc.jsonc
  - .github/workflows/ci.yml
  - package.json
  - packages/github-cache/action.yml
  - packages/github-cache/package.json
  - packages/github-cache/src/action/index.ts
  - packages/github-cache/src/backend/actions-cache-backend.spec.ts
  - packages/github-cache/src/backend/actions-cache-backend.ts
  - packages/github-cache/src/lib/cache-archive-path.spec.ts
  - packages/github-cache/src/lib/cache-archive-path.ts
  - packages/github-cache/src/lib/select-backend.spec.ts
  - packages/github-cache/src/lib/select-backend.ts
  - packages/github-cache/src/lib/trust.spec.ts
  - packages/github-cache/src/lib/trust.ts
  - packages/github-cache/src/lib/with-hash-lock.spec.ts
  - packages/github-cache/src/lib/with-hash-lock.ts
  - packages/github-cache/src/pinned-deps.spec.ts
  - packages/github-cache/src/serve.spec.ts
  - packages/github-cache/src/serve.ts
findings:
  critical: 0
  warning: 1
  info: 3
  total: 4
status: issues_found
---

# Phase 2: Code Review Report

**Reviewed:** 2026-07-19T00:00:00Z
**Depth:** deep
**Files Reviewed:** 19
**Status:** issues_found

## Summary

Reviewed the first real storage backend (`@actions/cache`), the default-deny write-trust gate,
the per-hash lock, the `selectBackend`/`serve` composition root, and the CI dogfood canary, with
cross-file tracing through the unchanged Phase 1 modules (`server.ts`, `memory-backend.ts`,
`types.ts`, `index.ts`).

The four security-load-bearing invariants this phase claims all hold under adversarial tracing:

- **Default-deny write trust (TRUST-03/05):** `isWriteTrusted` requires `GITHUB_ACTIONS==='true'`
  AND `GITHUB_EVENT_NAME` in the two-element `['push','schedule']` allowlist. No fork-reachable
  trigger (`pull_request`, `pull_request_target`, `workflow_run`, `issue_comment`, ...) can pass;
  the content-pin test freezes the allowlist. `selectBackend` reads only the env bag and reaches
  `createActionsCacheBackend` only after trust AND a valid `owner/name` AND a resolvable token; the
  override-shaped-extra-keys spec proves no caller-facing property can steer it.
- **Token fallthrough:** both `resolveGitHubToken` and `serve`'s token resolution use `||`, so a
  set-but-empty value correctly falls through instead of binding an empty secret. `server.ts` adds a
  construction-time empty-token guard as a second layer.
- **Bounded SIGTERM drain (ROBUST-04):** `shutdown` races the in-flight-put settle against an
  unref'd `setTimeout(graceMs)`, so a hung write yields to SIGKILL rather than deadlocking teardown.
- **Dogfood credential hygiene (D-06/T-2-19):** `core.setSecret(running.token)` is the first
  statement after `serve()` (which never prints the token because its `main()` direct-invocation
  guard is false when imported); the action uses no `core.exportVariable`, so runtime credentials
  are never re-exported through `GITHUB_ENV`.

The findings below are not bypasses of those invariants. The one WARNING is a disk-hygiene defect in
the backend `get` path that violates the same T-2-11 "no cache bytes left on a reused runner"
invariant the `put` path is careful to protect. The remaining items are defense-in-depth and a
low-likelihood concurrency note.

## Warnings

### WR-01: `createActionsCacheBackend().get` leaves the restored archive on disk (T-2-11 hygiene asymmetry)

**File:** `packages/github-cache/src/backend/actions-cache-backend.ts:34-45`
**Issue:** `put` deliberately cleans up its temp archive on every exit path via
`finally { await rm(path, { force: true }); }`, with a load-bearing comment citing T-2-11 ("cache
bytes are never left on a shared or reused runner"). The `get` path has no such cleanup. On a cache
HIT, `cache.restoreCache([path], key)` recreates the archive at `cacheArchivePath(hash)` and `get`
reads it with `readFile(path)` but never removes it. Every HIT therefore leaves a
`nx-github-cache-<hash>.tar` in `tmpdir()` containing the restored cache contents. On an ephemeral
GitHub-hosted runner this is wiped between runs, but on a reused/self-hosted runner (exactly the
T-2-11 scenario the `put` path guards against) these archives accumulate and expose cache bytes on
disk to later jobs/tenants. This is a hygiene/information-exposure defect, not a correctness bug: a
leftover archive never produces a false HIT, because a later `restoreCache` MISS returns
`{ kind: 'miss' }` without reading the stale file.
**Fix:** Mirror the `put` cleanup so the restored archive is removed after its bytes are read:
```typescript
async get(hash: string): Promise<GetResult> {
  const path = cacheArchivePath(hash);
  const matched = await cache.restoreCache([path], cacheKeyFor(hash));

  if (matched === undefined) {
    return { kind: 'miss' };
  }

  try {
    const bytes = await readFile(path);

    return { kind: 'hit', bytes };
  } finally {
    await rm(path, { force: true });
  }
}
```

## Info

### IN-01: `cacheArchivePath` performs no independent validation of `hash` (defense-in-depth)

**File:** `packages/github-cache/src/lib/cache-archive-path.ts:18-20`
**Issue:** `cacheArchivePath` interpolates `hash` directly into a filename
(`join(tmpdir(), `nx-github-cache-${hash}.tar`)`) with no guard. It is safe today because its only
production caller, `createActionsCacheBackend`, is reached exclusively through the server, which
validates the hash against `HASH_PATTERN = /^[a-f0-9]{1,512}$/` before any backend call — so a `../`
or path-separator hash can never arrive. The helper carries a detailed "LOAD-BEARING, do not edit the
path template" comment but says nothing about input trust, so a future caller that invokes it with an
unvalidated hash would silently reintroduce a path-traversal surface (`join(tmpdir(), 'nx-github-cache-../../x.tar')`).
**Fix:** Optional hardening — assert the shared invariant at the helper so it is self-defending
regardless of caller: `if (!/^[a-f0-9]{1,512}$/.test(hash)) { throw new Error('cacheArchivePath: hash must be lowercase hex'); }`.
At minimum, extend the comment to state that callers MUST pre-validate the hash to the server's
`HASH_PATTERN`.

### IN-02: `get` is not wrapped in `withHashLock` and shares the fixed temp path with `put` (low-likelihood race)

**File:** `packages/github-cache/src/serve.ts:83-97` (composition) and `packages/github-cache/src/backend/actions-cache-backend.ts:34-49`
**Issue:** `serve` wraps only `put` in `withHashLock`; `get` delegates straight through
(`get: (hash) => backend.get(hash)`). Both operations resolve the same `cacheArchivePath(hash)`
file. A concurrent same-hash GET and PUT would therefore race on one temp file: `put` does
`writeFile -> saveCache -> rm` while `get` does `restoreCache -> readFile`. Worst realistic outcome
is a spurious MISS (ENOENT from `put`'s `rm`, caught by the server's best-effort GET handler and
degraded to 404) or a corrupted `saveCache` if a concurrent `restoreCache` overwrites the file
mid-tar. This is practically unreachable with the intended Nx client (a task issues at most one
restore then, on miss, one store per hash, sequentially, and Nx dedupes identical hashes) and the
documented single-tenant ephemeral deployment, so it is not a WARNING — but the lock's protection is
asymmetric across the get/put boundary that shares mutable state.
**Fix:** If future deployments allow concurrent same-hash access, either route `get` through the same
`withHashLock(hash, ...)` seam or give each operation a unique temp path
(e.g. include a per-call nonce in the archive filename, keeping save/restore within a single call
byte-identical). Not required for the current single-tenant model — document the assumption if left
as-is.

### IN-03: `inFlightHashCount` is a test-only export shipped in a production module

**File:** `packages/github-cache/src/lib/with-hash-lock.ts:42-44`
**Issue:** `inFlightHashCount` exists solely so the TEST-02 eviction property is observable from the
spec. It is documented as "NOT part of the consumer contract" and is not re-exported from
`index.ts`, so it does not widen the public surface — but it is a test-only symbol living in
production source. Minor smell; noted for completeness, not action-required.
**Fix:** Acceptable as-is given the doc comment and the non-public barrel. If undesired, move the
size probe behind a test helper or assert eviction via a spied `Map`.

---

_Reviewed: 2026-07-19T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
