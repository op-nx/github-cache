<!-- refreshed: 2026-07-17 -->
# Architecture

**Analysis Date:** 2026-07-17

## System Overview

`@op-nx/github-cache` is a self-hosted Nx remote cache server built on GitHub-native storage: the GitHub Actions cache in CI (read-write) and an anonymous, read-only GitHub Release-asset mirror for local development. It speaks Nx's self-hosted-cache HTTP contract (`GET`/`PUT /v1/cache/{hash}`) on loopback and bridges it to one of two storage backends selected by runtime context.

```text
+---------------------------------------------------------------+
|                         Consumers                             |
|  Nx task runner (NX_SELF_HOSTED_REMOTE_CACHE_SERVER/_TOKEN)   |
+-------------------------------+-------------------------------+
                                | HTTP GET/PUT /v1/cache/{hash}
                                v          (Bearer token, loopback only)
+---------------------------------------------------------------+
|  HTTP protocol layer                                          |
|  `packages/op-nx-github-cache/src/lib/server.ts`              |
|  auth (timingSafeEqual) / hash validation / body cap /        |
|  error -> status mapping / write-trust gate                   |
+-------------------------------+-------------------------------+
                                | CacheBackend.get / .put
                                v
+---------------------------------------------------------------+
|  Backend layer  `src/lib/backends/`                           |
|  selectBackend(env) picks exactly one:                        |
|  +-------------------------+  +------------------------------+|
|  | actions-cache-backend   |  | release-mirror-backend       ||
|  | CI (GITHUB_ACTIONS)     |  | local dev (read-only)        ||
|  | @actions/cache via      |  | Octokit -> Release assets    ||
|  | deterministic temp file |  | month shards, in-proc cache  ||
|  +------------+------------+  +---------------+--------------+|
+---------------|-------------------------------|---------------+
                v                               v
   GitHub Actions cache service      GitHub Releases (cache-mirror-YYYYMM)
                ^                               ^
                | restoreCache                  | gh release upload / delete
+---------------+-------------------------------+---------------+
|  Mirror pipeline (CI-only, out-of-band of the server)         |
|  `src/bin/publish-mirror.ts` (upload, per-OS matrix leg)      |
|  `src/bin/publish-mirror-cleanup.ts` (daily scheduled prune)  |
+---------------------------------------------------------------+
```

A separate, repo-root layer of two GitHub **JavaScript actions** (`start-cache-server/`, `publish-mirror/`) exists solely because GitHub injects the Actions cache runtime env (`ACTIONS_RUNTIME_TOKEN` / `ACTIONS_RESULTS_URL`) only into JS actions, never `run:` shell steps. They spawn the built bins and hand that env down by process inheritance.

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| HTTP server | Nx cache protocol: routing, bearer auth, hash validation, body-size cap, status mapping, write-trust gate | `packages/op-nx-github-cache/src/lib/server.ts` |
| Backend contract | `CacheBackend` interface, `PutResult`, shared `HASH_PATTERN` | `packages/op-nx-github-cache/src/lib/types.ts` |
| Backend selection | Derive backend from runtime context (`GITHUB_ACTIONS`), never a flag; validate `GITHUB_REPOSITORY` | `packages/op-nx-github-cache/src/lib/backends/index.ts` |
| Actions cache backend | Read-write bridge to `@actions/cache` via a deterministic temp tarball path; per-hash in-process lock | `packages/op-nx-github-cache/src/lib/backends/actions-cache-backend.ts` |
| Release mirror backend | Read-only lookups over month-sharded Release assets; per-shard promise-cached asset maps; `put()` always `'forbidden'` | `packages/op-nx-github-cache/src/lib/backends/release-mirror-backend.ts` |
| Write-trust gate | CREEP (CVE-2025-36852) mitigation: allow writes only under GitHub's write-scoped trigger events | `packages/op-nx-github-cache/src/lib/trust.ts` |
| Shard/retention math | Month tags, retention-window resolution, shard-tag window walk (couples read lookback to cleanup retention) | `packages/op-nx-github-cache/src/lib/shard.ts` |
| Cleanup decisions | Pure age-based asset selection + whole-shard-delete decision | `packages/op-nx-github-cache/src/lib/cleanup.ts` |
| Server CLI | Bind loopback, generate CSPRNG token, export `NX_SELF_HOSTED_REMOTE_CACHE_*` (via `$GITHUB_ENV` in CI, stdout locally) | `packages/op-nx-github-cache/src/bin/serve.ts` |
| Mirror upload CLI | List Actions-cache keys via `gh`, filter Nx-shaped hashes, restore + upload to the current month shard (upload-only) | `packages/op-nx-github-cache/src/bin/publish-mirror.ts` |
| Mirror cleanup CLI | Daily single-writer prune of all `cache-mirror-*` shards | `packages/op-nx-github-cache/src/bin/publish-mirror-cleanup.ts` |
| Server-start action | Trusted-event gate, runtime-env guard, detached spawn, `$GITHUB_ENV` readiness poll, Windows token re-mask | `start-cache-server/index.cjs` + `action.yml` |
| Mirror-publish action | Token + runtime-env guards, synchronous run of the mirror bin, exit-status propagation | `publish-mirror/index.cjs` + `action.yml` |
| CI orchestration | Build/typecheck/test/integration matrix, dogfooding the just-built server; per-OS publish-mirror legs | `.github/workflows/ci.yml` |
| Scheduled cleanup | Daily 04:17 UTC prune, decoupled from pushes | `.github/workflows/mirror-cleanup.yml` |
| Public API barrel | Re-exports the library surface | `packages/op-nx-github-cache/src/index.ts` |

## Pattern Overview

**Overall:** Ports-and-adapters around a single `CacheBackend` port, wrapped in a thin HTTP protocol layer, with side-effect-free domain logic extracted into pure modules for testability.

**Key Characteristics:**
- Backend mode is derived entirely from runtime context (`GITHUB_ACTIONS=true` -> Actions cache; otherwise Release mirror) -- there is no mode flag a caller can get wrong (`src/lib/backends/index.ts`).
- Risky decisions are extracted as pure functions so they are unit-testable without I/O: `filterNxCacheKeys`, `filterMirrorShardTags`, `actionsCachesListArgs` (`src/bin/publish-mirror.ts`), `planShardCleanup` / `selectAssetsToDelete` (`src/lib/cleanup.ts`), `shardTagsForWindow` (`src/lib/shard.ts`).
- Reads are best-effort (any fault degrades to a cache MISS); writes are gated at multiple layers (trust gate in code, read-only token server-side at GitHub, workflow permission scoping).
- Retention is a single coupled setting: `CACHE_MIRROR_MAX_AGE_DAYS` drives both the read-side shard lookback (`release-mirror-backend.ts`) and the cleanup window (`publish-mirror-cleanup.ts`) through the shared `resolveMaxAgeDays` / `shardTagsForWindow` in `src/lib/shard.ts`.
- Heavy inline documentation: nearly every non-obvious decision carries a comment explaining the verified failure mode it prevents (often citing `pv-N` verification IDs or upstream issues).

## Layers

**GitHub JS actions (repo root):**
- Purpose: The only step type GitHub hands the Actions cache runtime env; gate, guard, and spawn the built bins.
- Location: `start-cache-server/`, `publish-mirror/`
- Contains: `action.yml` (metadata + `command` input), `index.cjs` (CommonJS, Node built-ins ONLY -- runs before/without `npm ci`), `selfcheck.cjs` (framework-free runnable assertions).
- Depends on: the built `packages/op-nx-github-cache/dist/bin/*.js` via the `command` input.
- Used by: `.github/workflows/ci.yml`.

**CLI entry points:**
- Purpose: Process lifecycle -- env resolution, wiring, top-level failure isolation.
- Location: `packages/op-nx-github-cache/src/bin/`
- Contains: `serve.ts`, `publish-mirror.ts`, `publish-mirror-cleanup.ts`. Each uses the `import.meta.url === pathToFileURL(process.argv[1]).href` guard so specs can import exported helpers without triggering `main()`.
- Depends on: `src/lib/*`.
- Used by: the JS actions, the `bin` entries in `packages/op-nx-github-cache/package.json`, and `mirror-cleanup.yml` (plain `run:` step -- cleanup needs no runtime env).

**HTTP protocol layer:**
- Purpose: Translate Nx's cache HTTP contract into backend calls; enforce trust boundaries.
- Location: `packages/op-nx-github-cache/src/lib/server.ts`
- Contains: routing (`CACHE_PATH_PATTERN`), timing-safe bearer auth, `HASH_PATTERN` validation, buffered body read with `MAX_CACHE_BODY_BYTES` cap, `PutResult` -> status mapping with a `never` exhaustiveness guard.
- Depends on: `types.ts`, `trust.ts`, a `CacheBackend`.
- Used by: `bin/serve.ts`.

**Backend layer:**
- Purpose: Storage adapters behind the `CacheBackend` port.
- Location: `packages/op-nx-github-cache/src/lib/backends/`
- Contains: `index.ts` (selector), `actions-cache-backend.ts`, `release-mirror-backend.ts`. Backends are created by factory functions (`createActionsCacheBackend()`, `createReleaseMirrorBackend(options)`) returning object literals -- no classes.
- Depends on: `@actions/cache` (CI backend), `@octokit/rest` (mirror backend), `shard.ts`, `types.ts`.
- Used by: `server.ts` (via injection), `bin/publish-mirror.ts` (reuses `cacheArchivePath`).

**Pure domain logic:**
- Purpose: Deterministic decisions with zero I/O.
- Location: `packages/op-nx-github-cache/src/lib/{shard,cleanup,trust,types}.ts`
- Depends on: nothing beyond the standard library.
- Used by: every other layer.

## Data Flow

### CI cache round-trip (primary)

1. `.github/workflows/ci.yml` builds the package, then runs the `./start-cache-server` action with `command: node packages/op-nx-github-cache/dist/bin/serve.js` (`ci.yml:45-47`).
2. `start-cache-server/index.cjs` gates on trusted events, verifies `ACTIONS_RUNTIME_TOKEN`/`ACTIONS_RESULTS_URL`, spawns the server detached (env inherited -- the runtime token never touches `$GITHUB_ENV`), and polls `$GITHUB_ENV` for readiness (`index.cjs:103-145`).
3. `bin/serve.ts` generates a 32-byte hex token, selects the backend, binds `127.0.0.1` only, masks the token (`::add-mask::`), and appends `NX_SELF_HOSTED_REMOTE_CACHE_SERVER` / `..._ACCESS_TOKEN` to `$GITHUB_ENV` (`serve.ts:35-84`).
4. Nx tasks in later steps GET/PUT `http://127.0.0.1:<port>/v1/cache/<hash>` with the bearer token.
5. `server.ts` validates route -> auth -> hash, then dispatches: GET faults degrade to 404 MISS (`server.ts:121-151`); PUT is refused 403 unless `isWriteTrusted(process.env)` (`server.ts:153-158`).
6. `actions-cache-backend.ts` writes/reads the body through the deterministic temp path `cacheArchivePath(hash)` (`$TMPDIR/op-nx-github-cache/<hash>.tar.gz`) and calls `saveCache`/`restoreCache` under a per-hash lock.

### Local development read (mirror)

1. A local `serve` run (no `GITHUB_ACTIONS`) requires `GITHUB_REPOSITORY=owner/repo`; `selectBackend` builds the Release-mirror backend, optionally authenticated via `GH_TOKEN || GITHUB_TOKEN` (`backends/index.ts:9-45`).
2. GET walks `shardTagsForWindow(now, maxAgeDays)` -- current month back through the retention window -- loading each shard's asset-name -> id map once per process, promise-coalesced so cold concurrent GETs share one API round-trip (`release-mirror-backend.ts:64-130`).
3. A hit downloads the Release asset as an octet stream; PUT always returns `'forbidden'` -> 403.

### Mirror publish (CI, main pushes, per-OS matrix)

1. `publish-mirror` job in `ci.yml` runs on both `ubuntu-24.04-arm` and `windows-11-arm` after all cache-producing jobs; each leg can only restore (and therefore mirror) entries saved on its own platform (`ci.yml:161-208`).
2. `publish-mirror/index.cjs` guards token + runtime env, then runs the bin synchronously, propagating its exit status.
3. `bin/publish-mirror.ts` -> `resolveTrustedRepo()` (trust gate + `GITHUB_REF` == default branch check), lists Actions-cache keys via `gh api`, filters to Nx-shaped hashes (`filterNxCacheKeys`), ensures the current month shard release exists, then restores each hash from the Actions cache and `gh release upload`s it (never `--clobber`) (`publish-mirror.ts:401-426`).

### Mirror cleanup (daily scheduled, single writer)

1. `.github/workflows/mirror-cleanup.yml` (cron `17 4 * * *`, plus `workflow_dispatch`) runs `bin/publish-mirror-cleanup.js` as a plain `run:` step with `GH_TOKEN`.
2. `cleanupMirror` walks every existing `cache-mirror-*` release (not just the read window), and per shard `planShardCleanup` decides which assets are past `maxAgeDays` and whether the whole release can be deleted (never the current-month shard) (`publish-mirror.ts:379-395`, `cleanup.ts:40-56`).

**State Management:**
- The server is stateless per request; the only in-process state is the per-hash lock map (`actions-cache-backend.ts:29`) and the per-shard asset-map cache (`release-mirror-backend.ts:64`). Durable state lives entirely in GitHub (Actions cache entries, Release assets).

## Key Abstractions

**`CacheBackend` (port):**
- Purpose: The single seam between protocol and storage: `get(hash): Promise<Buffer | null>`, `put(hash, body): Promise<PutResult>` where `PutResult = 'stored' | 'conflict' | 'forbidden'`.
- Examples: `packages/op-nx-github-cache/src/lib/types.ts`, both files in `src/lib/backends/`.
- Pattern: Factory functions returning object literals; injected into `createServer({ backend, token })`.

**`HASH_PATTERN` (shared trust-boundary validation):**
- Purpose: One regex (`/^[a-f0-9]{1,512}$/`) validates inbound request hashes AND filters Actions-cache keys before they are interpolated into temp-file paths or asset names (path-traversal/injection guard).
- Examples: `src/lib/types.ts:9`, used in `server.ts:114` and `publish-mirror.ts:85-90`.

**`cacheArchivePath(hash)` (single source of truth):**
- Purpose: `@actions/cache` matches entries by a version hash computed over the literal path strings, so save and restore MUST use byte-identical paths. This helper is the only place that path is defined.
- Examples: `src/lib/backends/actions-cache-backend.ts:17-19`, consumed by `bin/publish-mirror.ts:183`.

**Shard/retention coupling:**
- Purpose: `resolveMaxAgeDays` + `shardTagsForWindow` + `monthTag` keep "how long assets are kept" and "how far back reads look" resolved from the same place; drift would make retained assets unreadable or unreadable assets un-cleanable.
- Examples: `src/lib/shard.ts`, consumed by `backends/index.ts:35`, `release-mirror-backend.ts:120`, `bin/publish-mirror.ts:15`.

**`isWriteTrusted(env)` (write gate):**
- Purpose: CREEP mitigation -- writes allowed only under GitHub's write-scoped trigger events (`push`, `schedule`, `workflow_dispatch`, `repository_dispatch`, `delete`, `registry_package`, `page_build`, `merge_group`). Defense-in-depth alongside GitHub's server-side read-only cache token.
- Examples: `src/lib/trust.ts`, enforced in `server.ts:154` and `bin/publish-mirror.ts:335`.

**`resolve*` env-knob pattern:**
- Purpose: Every numeric env knob follows the same contract -- set-but-invalid warns and falls back to the default (never crash, never silently disable); unset is silent. Excessive values are clamped only where they carry per-unit cost (`MAX_CACHE_MIRROR_MAX_AGE_DAYS` caps API-call fan-out).
- Examples: `resolveMaxBodyBytes` (`server.ts:42-58`), `resolveMaxAgeDays` (`shard.ts:29-43`), `resolvePort` (`bin/serve.ts:15-29`).

## Entry Points

**`src/bin/serve.ts`** (published bin `op-nx-github-cache-serve`):
- Triggers: the `start-cache-server` action in CI; run manually for local dev.
- Responsibilities: token generation, backend selection, loopback bind, env-var handoff.

**`src/bin/publish-mirror.ts`** (bin `op-nx-github-cache-publish-mirror`):
- Triggers: the `publish-mirror` action, per-OS, on trusted main pushes.
- Responsibilities: trust preamble, Actions-cache -> Release-asset upload (upload-only).

**`src/bin/publish-mirror-cleanup.ts`** (bin `op-nx-github-cache-publish-mirror-cleanup`):
- Triggers: `.github/workflows/mirror-cleanup.yml` daily schedule / manual dispatch.
- Responsibilities: single-writer prune of all mirror shards.

**`src/index.ts`** (library import `@op-nx/github-cache`):
- Triggers: consumers importing the API (`createServer`, `selectBackend`, backends, cleanup/trust helpers).

**`start-cache-server/index.cjs`, `publish-mirror/index.cjs`** (GitHub actions):
- Triggers: `uses: ./start-cache-server` / `uses: ./publish-mirror` workflow steps.

All three bins share the CLI-guard idiom: `if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) { main().catch(...) }` -- keep it when adding a new bin so specs can import without side effects.

## Architectural Constraints

- **Threading:** Single Node.js process, single event loop. Same-hash concurrency in the Actions backend is serialized by an in-process promise-chain lock (`actions-cache-backend.ts:29-50`); different hashes run fully concurrently. The lock is explicitly in-process-only (single server instance assumed).
- **Global state:** `locks` map (module-level, `actions-cache-backend.ts:29`); `MAX_BODY_BYTES` resolved once at module load (`server.ts:60`); `shardCache` is per-backend-instance closure state (`release-mirror-backend.ts:64`) -- a hash published mid-session is invisible until `serve` restarts (accepted extra MISS, never a wrong result).
- **Memory:** PUT bodies are fully buffered (no streaming) up to `MAX_CACHE_BODY_BYTES` (default 2 GB) before any backend call (`server.ts:32-84`).
- **Deliberate duplication:** `TRUSTED_EVENTS` exists twice -- `src/lib/trust.ts:5-21` and `start-cache-server/index.cjs:12-21` -- because the action must be dependency-free CJS that runs before `npm ci`. The files carry "keep in sync" comments; any change to one MUST be mirrored in the other.
- **Action layer purity:** `start-cache-server/index.cjs` and `publish-mirror/index.cjs` may use Node built-ins ONLY (no npm dependencies) -- they run before the workspace is installed and are exercised standalone by `selfcheck.cjs` on Windows CI.
- **ESM everywhere in the package:** `"type": "module"`, `module: nodenext` -- relative imports MUST carry the `.js` extension even in `.ts` sources.
- **Network exposure:** the server binds `127.0.0.1` only, never all interfaces (`bin/serve.ts:51`).
- **Circular imports:** none. Dependency direction is strictly `bin -> lib -> (backends -> shard/types)`; `publish-mirror-cleanup.ts` imports from `publish-mirror.ts` (shared `resolveTrustedRepo`/`cleanupMirror`), which is one-directional.

## Anti-Patterns

### Text-matching `gh` CLI stderr

**What happens:** `bin/publish-mirror.ts` discriminates `gh` outcomes by matching human-readable stderr (`GH_ALREADY_EXISTS_PATTERN = /already exists/i`, `GH_NOT_FOUND_MARKER = 'HTTP 404'`, `publish-mirror.ts:22-23`).
**Why it's wrong:** brittle across `gh` versions; the CLI gives no structured exit codes for these cases, so it is tolerated -- but only there.
**Do this instead:** when Octokit is available, discriminate structurally (`error.status === 404`, as `release-mirror-backend.ts:25-32` does). Keep any new stderr sentinels hoisted next to the existing two so all fragile matching lives in one place.

### Bypassing the shared path/validation helpers

**What happens:** interpolating a hash or key into a filesystem path, asset name, or `gh` argument without `HASH_PATTERN` filtering, or constructing the temp tarball path inline instead of via `cacheArchivePath()`.
**Why it's wrong:** the Actions-cache namespace is repo-wide (other steps' keys are not Nx-shaped or traversal-safe), and a divergent temp path silently changes `@actions/cache`'s version hash so every restore misses -- both failure modes were hit and fixed in this codebase.
**Do this instead:** route all hash-derived paths through `cacheArchivePath()` (`actions-cache-backend.ts:17`) and all externally sourced keys through `filterNxCacheKeys()` / `HASH_PATTERN`.

### Letting backend read faults surface as 5xx

**What happens:** throwing (or re-throwing) from a GET path so Nx sees a 500.
**Why it's wrong:** a remote-cache read is best-effort by contract; a rate-limit or transient fault must degrade to a MISS so the build continues.
**Do this instead:** follow `server.ts:120-141` -- log server-side, respond 404. Reserve 5xx for genuinely unexpected write-path faults.

## Error Handling

**Strategy:** Reads degrade, writes surface. Cache retrieval faults become 404 MISSes (logged); write faults get precise statuses; batch operations isolate per-item failures and report them all at the end with a non-zero exit.

**Patterns:**
- `PutResult` -> status mapping ends in a `never`-typed exhaustiveness guard so a new variant is a compile error, not a silent 200 (`server.ts:169-178`).
- `PayloadTooLargeError` destroys the socket before responding 413 so keep-alive connections cannot misparse leftover body bytes (`server.ts:186-193`).
- `ValidationError` (from `@actions/cache`) maps to 400; everything else on the write path is a logged 500 (`server.ts:196-204`).
- Per-item isolation in batch loops: one hash's upload failure or one shard's cleanup fault never aborts the rest; failures are collected and thrown as a summary (`publish-mirror.ts:408-425`, `379-395`).
- Only structural/marker-verified 404s mean "not found"; auth/rate-limit/network errors must propagate, never be treated as absence (`publish-mirror.ts:233-243`, `release-mirror-backend.ts:104-111`).
- JS actions fail loudly via `::error::` workflow annotations + `process.exit(1)`; a broken cache must never be a silent no-op (`start-cache-server/index.cjs:26-32`).
- `@actions/cache`'s `saveCache` collapses "already cached" and "write denied" into `-1`; both are treated as an idempotent 409 conflict (`actions-cache-backend.ts:52-61, 94-98`).

## Cross-Cutting Concerns

**Logging:** `console.log`/`warn`/`error` only -- no logging framework. In CI, GitHub workflow commands are used deliberately: `::add-mask::<token>` before any output that could echo the secret (`bin/serve.ts:66`, re-registered on Windows in `start-cache-server/index.cjs:128-136`), `::error::` for failing annotations.
**Validation:** shared regexes at every trust boundary -- `HASH_PATTERN` (`types.ts`), `MIRROR_SHARD_PATTERN` (`publish-mirror.ts:97`, keeps cleanup from touching non-mirror releases), `BRANCH_NAME_PATTERN` (`publish-mirror.ts:49`), plus explicit `owner/repo` format checks in both `selectBackend` and `resolveTrustedRepo`.
**Authentication:** three distinct credentials, never mixed -- (1) the per-process CSPRNG bearer token between Nx and the server (timing-safe compare, `server.ts:17-30`); (2) `ACTIONS_RUNTIME_TOKEN` for the Actions cache service, passed only by process inheritance from JS actions; (3) `GITHUB_TOKEN`/`GH_TOKEN` for `gh`/Octokit REST calls (Release assets, cache key listing).
**Secret hygiene:** the runtime token never touches `$GITHUB_ENV`; the bearer token reaches later steps only via `$GITHUB_ENV` after masking.

---

*Architecture analysis: 2026-07-17*
