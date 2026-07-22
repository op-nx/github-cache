<!-- refreshed: 2026-07-22 -->
# Architecture

**Analysis Date:** 2026-07-22

## System Overview

```text
┌───────────────────────────────────────────────────────────────────────────┐
│                      Nx client (task runner)                              │
│   GET/PUT http://127.0.0.1:<port>/v1/cache/{hash}  (self-hosted contract) │
└───────────────────────────────────┬───────────────────────────────────────┘
                                     │  HTTP (bearer token)
                                     ▼
┌───────────────────────────────────────────────────────────────────────────┐
│  Protocol layer -- node:http, no framework                                │
│  `packages/github-cache/src/server/server.ts` (createCacheServer)         │
│  route -> method -> auth -> hash-validate -> body-cap -> backend -> status│
└───────────────────────────────────┬───────────────────────────────────────┘
                                     │  calls a plain CacheBackend
                                     ▼
┌───────────────────────────────────────────────────────────────────────────┐
│  Composition root -- `packages/github-cache/src/serve.ts` (serve())       │
│  resolves port + token, calls selectBackend(process.env) ONCE per process,│
│  wraps put() with in-flight tracking for the SIGTERM drain                │
└───────────────────────────────────┬───────────────────────────────────────┘
                                     │  runtime-context decision (no mode flag)
                                     ▼
┌───────────────────────────────────────────────────────────────────────────┐
│  Backend selection -- `packages/github-cache/src/lib/select-backend.ts`   │
│  isWriteTrusted(env) -> which FACTORY constructs the backend               │
└──────┬───────────────────┬────────────────────┬───────────────────────────┘
       │ untrusted          │ trusted, no token   │ trusted, valid token
       ▼                    ▼                     ▼
┌─────────────┐   ┌───────────────────────┐   ┌────────────────────────────┐
│ Releases    │   │ read-only memory      │   │ Actions-cache backend       │
│ read backend│   │ backend (permanent    │   │ `backend/                  │
│ (cross-     │   │ MISS, silent)         │   │  actions-cache-backend.ts`  │
│ context read)│  │ `backend/             │   │ (@actions/cache, withHash- │
│`backend/    │   │  memory-backend.ts`   │   │  Lock-serialized)          │
│ releases-   │   └───────────────────────┘   └───────────┬────────────────┘
│ backend.ts` │                                            │
└──────┬──────┘                                            │
       │ GitHub REST (fetch)                                │ @actions/cache toolkit
       ▼                                                    ▼
┌───────────────────────────────────────────────────────────────────────────┐
│  GitHub -- Releases (month-shard `cache-mirror-YYYYMM` assets)            │
│           + Actions cache service (`nx-cache-<hash>` keys)                │
└───────────────────────────────────────────────────────────────────────────┘

  Out-of-band engines (not on the request path, run from separate bins):
  publish/publish-mirror.ts  -- Actions cache -> Releases (sync-gated)
  cleanup/cleanup.ts         -- prunes expired Releases mirror assets (sync-gated)
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| `serve()` | Composition root: port/token resolution, backend selection, write-drain wiring, SIGTERM shutdown | `packages/github-cache/src/serve.ts` |
| `createCacheServer` | node:http protocol layer implementing the Nx self-hosted-cache HTTP contract | `packages/github-cache/src/server/server.ts` |
| `selectBackend` | The one runtime-context backend-selection point (RW vs RO), never a caller flag | `packages/github-cache/src/lib/select-backend.ts` |
| `CacheBackend` port (`ReadableBackend`/`WritableBackend`) | The structural read/read-write contract every backend implements | `packages/github-cache/src/backend/types.ts` |
| Actions-cache backend | Read-write adapter over `@actions/cache`; the primary same-OS, same-job cache | `packages/github-cache/src/backend/actions-cache-backend.ts` |
| Releases read backend | Read-only cross-context/cross-job adapter over GitHub Releases (native fetch) | `packages/github-cache/src/backend/releases-backend.ts` |
| Read-only memory backend | Degrade target for a write-trusted context with no resolvable token | `packages/github-cache/src/backend/memory-backend.ts` |
| Write trust gate | `isWriteTrusted`: default-deny predicate deciding RW eligibility | `packages/github-cache/src/lib/trust.ts` |
| Sync/publish trust gate | `isSyncTrusted` / `isTrustedSyncEvent`: SEPARATE predicate gating the mirror/cleanup engines | `packages/github-cache/src/lib/sync-gate.ts` |
| Publish (mirror) engine | Copies default-branch Actions-cache entries to a month-shard Release, per OS | `packages/github-cache/src/publish/publish-mirror.ts` |
| Cleanup engine | Age-prunes expired Releases-mirror assets, list-then-delete, fail-closed on list faults | `packages/github-cache/src/cleanup/cleanup.ts` |
| Cache key / hash brand | Single source for the `nx-cache-` prefix, `HASH_PATTERN`, and the validated `Hash` brand | `packages/github-cache/src/lib/cache-key.ts` |
| Release asset naming | Single source for the OS-namespaced `<hash>-<os>` asset name (cross-OS correctness) | `packages/github-cache/src/lib/release-asset-name.ts` |
| Retention resolver | Single `CACHE_MIRROR_MAX_AGE_DAYS` knob driving both the read window and the prune window | `packages/github-cache/src/lib/retention.ts` |
| Per-hash lock | Serializes same-hash get/put on the shared deterministic archive path | `packages/github-cache/src/lib/with-hash-lock.ts` |
| Internal CI dogfood action | Drives `serve()` end-to-end in this repo's own CI; also hosts `runPublish` | `packages/github-cache/src/action/index.ts` |
| Consumer sidecar action entry | Thin glue bundled to `start-cache-server/index.js`; the published `uses:` surface | `start-cache-server/entry.ts` |
| Cleanup bin | Scheduled-workflow entrypoint driving the cleanup engine | `packages/github-cache/src/cleanup/index.ts` |
| Round-trip read-back bin | Live cross-OS proof: reads back what the publish matrix wrote, via the reader directly | `packages/github-cache/src/roundtrip/read-back.ts` |
| Public barrel | Minimal published surface: `createCacheServer` + the `CacheBackend` port types | `packages/github-cache/src/index.ts` |

## Pattern Overview

**Overall:** Ports and adapters (hexagonal), organized around one narrow port -- `CacheBackend` (`ReadableBackend` | `WritableBackend`) -- with a thin protocol adapter on one side (node:http) and pluggable storage adapters on the other (Actions cache, GitHub Releases, in-memory).

**Key Characteristics:**
- Exactly one process-lifetime backend selection (`selectBackend`), decided from runtime context (env), never from a caller-facing mode flag or request-scoped parameter (documented invariant TRUST-05, repeated as a comment at nearly every call site).
- Read/write capability is structural, not a runtime flag: `ReadableBackend` has no `put` at all; `isWritableBackend` is a type-guard used by both `serve()` (to decide whether to wrap `put`) and the server (to answer a PUT to a read-only backend with 403).
- Two independent trust gates with separate authored allowlists on purpose: `lib/trust.ts` (write gate, `TRUSTED_EVENTS`/`HOST_GATED_EVENTS`) and `lib/sync-gate.ts` (publish/cleanup gate, `SYNC_EVENTS`). Widening one must never silently widen the other -- each file explicitly refuses to import the other's allowlist.
- Pure-logic "engines" (`publishMirror`, `cleanupMirror`) are injected-client, network-free, and unit-tested; the real Octokit-backed adapters that implement those client interfaces live only in the thin bins (`action/index.ts`, `cleanup/index.ts`) that import `@octokit/rest`.
- Single-source "leaf" modules for anything that must never drift between two derivations: `cache-key.ts` (hash validation + Actions-cache key), `release-asset-name.ts` (OS-namespaced Release asset name), `retention.ts` (the one `CACHE_MIRROR_MAX_AGE_DAYS` knob driving both the reader's shard window and the cleanup prune window). Comments in these files are explicitly "comment-locked" against being inlined or "tidied" elsewhere, because a drift is a silent cross-OS cache MISS, not a crash.
- Fail-open reads, fail-closed writes: every backend's `get` swallows faults into a MISS (never breaks a build); every `put` path either returns an explicit result or throws (never a silent 200 on failure).

## Layers

**Protocol layer:**
- Purpose: speak the Nx self-hosted-cache HTTP contract (`GET`/`PUT /v1/cache/{hash}`) over plain `node:http`
- Location: `packages/github-cache/src/server/server.ts`
- Contains: route/method/auth/hash/body-cap guard-clause ladder, constant-time bearer-token check, streaming PUT body handling with a 2 GiB cap
- Depends on: an injected `ReadableBackend | WritableBackend` (the port), `lib/cache-key.ts` for hash parsing
- Used by: `serve()` (production composition), `serve.spec.ts` / `public-server.integration.spec.ts` (tests, with the memory backend)

**Composition root:**
- Purpose: wire together port resolution, token resolution, backend selection, write-drain tracking, and graceful shutdown into one runnable server
- Location: `packages/github-cache/src/serve.ts`
- Contains: `serve()`, `ServeOptions`/`RunningServer` types, the bounded SIGTERM drain
- Depends on: `server/server.ts`, `lib/select-backend.ts`, `backend/types.ts`
- Used by: the internal CI dogfood action (`action/index.ts`), the consumer sidecar entry (`start-cache-server/entry.ts`), and `serve()`'s own `main()` for direct-invocation (`bin: github-cache`)

**Backend selection (policy):**
- Purpose: the single point deciding which storage adapter backs a given process, from runtime context only
- Location: `packages/github-cache/src/lib/select-backend.ts`
- Contains: `selectBackend`, the four-outcome decision table (untrusted -> Releases reader; trusted+malformed repo -> throw; trusted+no token -> read-only memory; trusted+token -> Actions-cache)
- Depends on: `lib/trust.ts` (`isWriteTrusted`), `lib/github-identity.ts`, all three backend factories
- Used by: `serve()` only (this is the one call site in production code)

**Backends (adapters):**
- Purpose: implement the `ReadableBackend`/`WritableBackend` port against a concrete storage system
- Location: `packages/github-cache/src/backend/`
- Contains: `actions-cache-backend.ts` (RW, `@actions/cache`), `releases-backend.ts` (RO, GitHub Releases over native `fetch`), `memory-backend.ts` (both a writable test fixture and the RO degrade target), `types.ts` (the port itself)
- Depends on: `lib/cache-archive-path.ts`, `lib/cache-key.ts`, `lib/with-hash-lock.ts`, `lib/local-context.ts`, `lib/release-asset-name.ts`, `lib/retention.ts`, `lib/octokit-status.ts`
- Used by: `select-backend.ts` (production), `serve.spec.ts` (memory backend), `publish-mirror.ts` (Actions-cache backend, for its own-OS restore step)

**Out-of-band engines (publish / cleanup):**
- Purpose: batch jobs that run outside the request path -- mirror Actions-cache entries into Releases, and prune expired mirror assets
- Location: `packages/github-cache/src/publish/publish-mirror.ts`, `packages/github-cache/src/cleanup/cleanup.ts`
- Contains: pure orchestration behind a narrow injected client interface (`PublishClient`, `CleanupClient`); no `@octokit/rest` import in either engine
- Depends on: `lib/retention.ts`, `lib/cache-key.ts`, `lib/release-asset-name.ts`, `lib/octokit-status.ts`, `backend/actions-cache-backend.ts` (publish only, for its own-OS restore)
- Used by: `action/index.ts` (`runPublish`, wires the real Octokit client), `cleanup/index.ts` (`run`, wires the real Octokit client)

**Pure domain leaves (`lib/`):**
- Purpose: single-source, dependency-free (or near-leaf) helpers that multiple layers must agree on byte-for-byte
- Location: `packages/github-cache/src/lib/`
- Contains: `trust.ts`, `sync-gate.ts`, `retention.ts`, `cache-key.ts`, `release-asset-name.ts`, `cache-archive-path.ts`, `with-hash-lock.ts`, `github-identity.ts`, `local-context.ts`, `octokit-status.ts`, `resilient-octokit.ts`, `summary.ts`, `dogfood-body.ts`, `is-entrypoint.ts`
- Depends on: as little as possible by design; several files' doc comments state explicitly which imports would reintroduce a cycle (see `github-identity.ts`'s extraction note)
- Used by: every other layer

**Entry points (bins):**
- Purpose: the small number of runnable processes that compose the above layers for a specific runtime (JS Action, scheduled workflow, plain node script)
- Location: `packages/github-cache/src/action/index.ts`, `packages/github-cache/src/cleanup/index.ts`, `packages/github-cache/src/roundtrip/read-back.ts`, `start-cache-server/entry.ts`, `packages/github-cache/src/serve.ts` (`main()`)
- Contains: env-driven wiring, `isEntrypoint()`-guarded `run()`/`main()` functions, `core.setFailed` top-level error handling
- Depends on: the engines/backends/composition root above, plus `@actions/core` and `@octokit/rest` (imported ONLY at this layer, never inside the engines)
- Used by: GitHub Actions workflows (`.github/workflows/ci.yml`, `.github/workflows/cleanup.yml`) and consumer workflows (via `start-cache-server/action.yml`, `ppe/action.yml`)

## Data Flow

### Primary Request Path (Nx cache read/write)

1. Nx client issues `GET`/`PUT /v1/cache/{hash}` with a `Bearer` token to the loopback server (`packages/github-cache/src/server/server.ts:77`)
2. `createCacheServer`'s guard ladder runs in fixed, load-bearing order: route match (404) -> method (405) -> auth (401) -> hash validation via `parseHash` (400) -> PUT body cap (413) (`server.ts:78-135`)
3. GET dispatches to `handleGet`, which calls `backend.get(hash)` and degrades ANY fault to a 404 MISS (`server.ts:145-164`)
4. PUT dispatches to `handlePut`, which streams the body under the 2 GiB cap, then calls `backend.put(hash, bytes)`; a backend fault surfaces as 500, never a silent 200 (`server.ts:176-283`)
5. The `backend` here is whatever `serve()` resolved once, at process start, via `selectBackend(process.env)` (`serve.ts:90`) -- never re-resolved per request

### Backend Selection (process start, once)

1. `selectBackend` calls `isWriteTrusted(env)` first (`select-backend.ts:32`)
2. Untrusted -> constructs the real cross-context `ReleasesReadBackend` synchronously; token/repo resolution defers to `get`-time inside the client (`select-backend.ts:40`)
3. Trusted but `GITHUB_REPOSITORY` fails `GITHUB_REPOSITORY_PATTERN` -> throws (fail-closed construction guard) (`select-backend.ts:43-50`)
4. Trusted, valid identity, but `resolveGitHubToken(env)` is `undefined` -> degrades to `createReadOnlyMemoryBackend()` (permanent MISS, silent 403 on write) (`select-backend.ts:52-57`)
5. Trusted, valid identity, resolvable token -> `createActionsCacheBackend()`, the full read-write path (`select-backend.ts:59`)

### Publish (Actions cache -> Releases mirror)

1. `runPublish()` (`action/index.ts:109`) checks `isSyncTrusted(process.env)` FIRST; a gated-out run exits 0 with `core.info`, never an error
2. Resolves `GITHUB_REPOSITORY` (throws on malformed) and a token (throws if absent) (`action/index.ts:126-145`)
3. Calls `publishMirror(createPublishClient(...))` (`publish-mirror.ts:154`): enumerates default-branch Actions-cache entries, filters to `isServerProducedKey`, restores each hash on THIS OS via the real Actions-cache backend, uploads unseen names to the current month-shard Release (`cache-mirror-YYYYMM`)
4. Emits a job-summary count table (`mirrored`/`skipped`/`failed`) and fails the run loud on any nonzero `failed` aggregate

### Cleanup (age-based Releases prune)

1. `run()` (`cleanup/index.ts:68`) checks the narrower `isTrustedSyncEvent(process.env)` (schedule-only, no default-branch lookup) FIRST
2. Resolves repo + token (throws if either is unusable)
3. Calls `cleanupMirror(createCleanupClient(...), maxAgeDays)` (`cleanup.ts:65`): LIST phase materializes every `cache-mirror-*` release+asset (any fault propagates, aborting with zero deletions); DELETE phase removes only assets older than the cutoff, isolating per-item faults
4. Emits a job-summary count table and fails the run loud on any nonzero `failed` aggregate

**State Management:**
- No persistent in-process state beyond the per-process in-flight-PUT `Set` (drain tracking, `serve.ts:89`) and the per-hash lock map (`with-hash-lock.ts:4`, explicitly ponytail-scoped to single-process/single-tenant). All durable state lives in GitHub (Actions cache service, Release assets).

## Key Abstractions

**`CacheBackend` port (`ReadableBackend` / `WritableBackend`):**
- Purpose: the one seam every storage adapter and every protocol-layer consumer agrees on
- Examples: `packages/github-cache/src/backend/types.ts`, implemented by `actions-cache-backend.ts`, `releases-backend.ts`, `memory-backend.ts`
- Pattern: structural read/read-write split -- a `ReadableBackend` literally has no `put` method, so "read-only" is a type-level fact, not a runtime flag; `isWritableBackend` is the one runtime discriminator, used by both `serve()` and the server

**`Hash` brand:**
- Purpose: make an unvalidated string un-passable where a validated task hash is required (server route param, mirror key suffix)
- Examples: `packages/github-cache/src/lib/cache-key.ts` (`parseHash`, the sole mint point)
- Pattern: nominal branding (`string & { readonly __hash: unique symbol }`) that erases at runtime; every consumer imports the type, never redeclares the pattern

**Discriminated trust results (`WriteTrust` / `SyncTrust`):**
- Purpose: make a trust degrade OBSERVABLE with its cause, instead of an opaque boolean
- Examples: `packages/github-cache/src/lib/trust.ts` (`WriteTrust`, reasons `not-ci`/`untrusted-event`/`untrusted-host`), `packages/github-cache/src/lib/sync-gate.ts` (`SyncTrust`, reasons `not-ci`/`untrusted-event`/`not-default-branch`)
- Pattern: `{ trusted: true } | { trusted: false; reason: ... }` discriminated unions

**Injected client seams (`ReleaseReadClient`, `PublishClient`, `CleanupClient`):**
- Purpose: keep the pure orchestration logic (engines) importable and unit-testable with zero network, while the real `@octokit/rest`/`fetch`-backed adapters live only at the bin layer
- Examples: `backend/releases-backend.ts` (`ReleaseReadClient`), `publish/publish-mirror.ts` (`PublishClient`), `cleanup/cleanup.ts` (`CleanupClient`)
- Pattern: narrow interface, one real adapter constructed in the corresponding bin (`action/index.ts`, `cleanup/index.ts`), one test-fake per spec file

## Entry Points

**`serve()` (composition root + library export):**
- Location: `packages/github-cache/src/serve.ts`
- Triggers: imported by the internal dogfood action, the consumer sidecar entry, and its own `main()` when run directly (`bin: github-cache` in `packages/github-cache/package.json`)
- Responsibilities: resolve port/token, call `selectBackend` exactly once, wrap `put` for drain tracking, bind `127.0.0.1` only, register the bounded SIGTERM drain

**Internal CI dogfood action (`action/index.ts`):**
- Location: `packages/github-cache/src/action/index.ts`, invoked via `packages/github-cache/action.yml` (`main: dist/action/index.js`)
- Triggers: `.github/workflows/ci.yml` jobs `dogfood-seed`, `dogfood-verify`, and the `publish` matrix (`operation: seed|verify|publish`)
- Responsibilities: `run()` drives one scripted PUT/GET against the real `serve()` composition for this repo's own CI proof; `runPublish()` drives the sync-gated mirror

**Consumer sidecar entry (`start-cache-server/entry.ts`):**
- Location: `start-cache-server/entry.ts`, bundled by `esbuild.action.mjs` into the COMMITTED `start-cache-server/index.js`, invoked via `start-cache-server/action.yml` (`main: index.js`)
- Triggers: an adopting repo's own workflow, as a `background: true` step
- Responsibilities: validate the pre-set port/token handshake, call `serve({ port })`, mask the adopted bearer token, keep the process alive until the `cancel:` teardown sends SIGTERM

**Cleanup bin (`cleanup/index.ts`):**
- Location: `packages/github-cache/src/cleanup/index.ts`, invoked as `node packages/github-cache/dist/cleanup/index.js`
- Triggers: `.github/workflows/cleanup.yml` (daily `schedule` cron only)
- Responsibilities: gate on `isTrustedSyncEvent`, then drive `cleanupMirror`

**Round-trip read-back bin (`roundtrip/read-back.ts`):**
- Location: `packages/github-cache/src/roundtrip/read-back.ts`, invoked as `node packages/github-cache/dist/roundtrip/read-back.js`
- Triggers: `.github/workflows/ci.yml`'s `publish-verify` job (after the `publish` matrix)
- Responsibilities: read back, on this OS, exactly what the publish matrix wrote this run, via the reader invoked directly (not `selectBackend`), byte-comparing the result

**PPE hygiene composite action (`ppe/action.yml`):**
- Location: `ppe/action.yml` (no compiled TS; a composite YAML action that self-installs `zizmor`/`actionlint`)
- Triggers: consumed as a step in an adopter's own job (dogfooded in `.github/workflows/ci.yml`'s `ppe` job)
- Responsibilities: advisory-only workflow hygiene scanning; explicitly NOT the containment control

## Architectural Constraints

- **Process model:** one `serve()` instance per process is the documented production shape (sidecar / dogfood bins); `selectBackend` runs exactly once per process, at `serve()` call time -- there is no per-request or per-caller mode switch anywhere in the codebase (TRUST-05, enforced by comment convention at every relevant call site, not by a lint rule).
- **Global state:** `with-hash-lock.ts`'s `inFlight` map (`packages/github-cache/src/lib/with-hash-lock.ts:4`) is a module-level `Map` scoped to single-process/single-tenant use; explicitly marked `ponytail` with a documented upgrade path (a shared coordinator) if a multi-process writer ever appears. `releases-backend.ts`'s `warned` flag (`releases-backend.ts:29`) is a once-per-process degrade-notice flag, also module-level.
- **Import-cycle avoidance:** `lib/github-identity.ts` was extracted from `select-backend.ts` specifically to break a `releases-backend -> local-context -> select-backend -> releases-backend` cycle (flagged by `fallow dead-code`); it is a deliberate "leaf" that imports nothing from `select-backend.ts`, `local-context.ts`, or `../backend`. When adding a new cross-cutting helper, check whether it needs to be a similar leaf rather than living inside `select-backend.ts`.
- **Two independent trust allowlists, never shared:** `lib/trust.ts` (write gate) and `lib/sync-gate.ts` (publish/cleanup gate) each declare their own event allowlist and explicitly refuse to import the other's, so widening write-trust (e.g., Phase 5's `pull_request`/`release` host-gated widening) cannot silently widen sync/publish/cleanup trust.
- **Concurrency:** distinct-hash PUTs run concurrently and each buffers its full body in memory before `backend.put` (documented ceiling: N concurrent distinct-hash PUTs hold up to N x 2 GiB resident) -- acceptable for the documented single-tenant loopback sidecar; a multi-client deployment would need streaming-to-temp-file, not a raised body cap.
- **HTTP/1.1 single-connection ceiling:** an early 413 response to a client still streaming a body well over the cap produces an OS-level `ECONNRESET`, not a clean 413, on large payloads (`server.ts:188-197`) -- documented as inherent to single-connection HTTP/1.1, not a bug to "fix."

## Anti-Patterns

### Adding a caller-facing "mode" parameter to a backend factory

**What happens:** A hypothetical change that adds a `mode: 'rw' | 'ro'` argument (or similar) to `selectBackend`, `createActionsCacheBackend`, or `createReleasesReadClient` so a caller can request write access directly.
**Why it's wrong:** RW-vs-RO is documented as decided ENTIRELY by runtime context (TRUST-05) -- there is no legitimate reason for any caller to request write capability, and a mode flag would let an untrusted context masquerade as trusted.
**Do this instead:** Extend `isWriteTrusted`'s allowlist (`lib/trust.ts`) or its host gate if a genuinely new trusted context needs to be recognized; every backend factory stays zero-argument or environment-only.

### Applying `withHashLock` at more than one layer for the same resource

**What happens:** Wrapping `serve()`'s composition (or another caller) with its own per-hash lock in addition to the one already inside `actions-cache-backend.ts`.
**Why it's wrong:** A nested same-hash lock self-deadlocks -- the inner call sees the outer call's tail as `prior`, which cannot settle until the inner call resolves (documented explicitly in `serve.ts:82-88` and `actions-cache-backend.ts:28-36`).
**Do this instead:** The lock lives exactly once, next to the shared deterministic archive path it protects (`actions-cache-backend.ts`), covering both `get` and `put`.

### Reusing the write-gate allowlist for the sync/publish/cleanup gate (or vice versa)

**What happens:** Importing `TRUSTED_EVENTS`/`isWriteTrusted` from `lib/trust.ts` inside `lib/sync-gate.ts` (or a new engine) instead of declaring a separate `SYNC_EVENTS` allowlist.
**Why it's wrong:** The write gate has been widened (host-gated `pull_request`/`release`) while the sync/publish/cleanup gate has not; a shared predicate would silently widen the mirror/cleanup surface along with the write gate -- exactly the "CREEP" precondition the two-allowlist split exists to prevent.
**Do this instead:** Keep each gate as its own authored source of truth; a content-pinning spec (`sync-gate.spec.ts`) fails the build if the sets are ever made to coincide via import.

### Deriving a Release asset name, Actions-cache key, or shard tag anywhere other than the designated single-source helper

**What happens:** Hand-building a string like `` `${hash}-${os}` ``, `` `nx-cache-${hash}` ``, or `` `cache-mirror-${year}${month}` `` inline instead of calling `releaseAssetName`, `cacheKeyFor`, or `shardTag`.
**Why it's wrong:** A drift between two independently-authored derivations (e.g., the reader's name-building vs. the publisher's) is a SILENT cross-OS cache MISS -- no error, no crash, just a wave of unexplained rebuilds. These three helpers are explicitly "comment-locked" against this exact mistake.
**Do this instead:** Always import from `lib/release-asset-name.ts`, `lib/cache-key.ts`, and `lib/retention.ts` respectively; never inline the template even for a "trivial" one-off script.

## Error Handling

**Strategy:** Split by direction -- reads fail open (degrade to MISS/404), writes fail closed (throw or return an explicit non-success result; never a silent 200).

**Patterns:**
- Every `ReadableBackend.get` implementation catches its own faults and returns `{ kind: 'miss' }` rather than propagating (`releases-backend.ts:86-98`, `server.ts:160-163` as the outermost safety net).
- Every write path either returns a typed `PutResult` (`'stored' | 'conflict'`) or throws, and the server maps a thrown `put` fault to 500 (`server.ts:250-259`) -- there is no code path that can silently drop a write.
- Out-of-band engines (`publishMirror`, `cleanupMirror`) isolate PER-ITEM faults (continue the batch, count as `failed`) but propagate WHOLE-RUN faults from their LIST phase (a mid-list fault aborts with zero mutations) -- the opposite fault-tolerance posture is deliberate: a swallowed list fault would read as "nothing to do" and could delete or skip live data.
- Fault discrimination is structural (HTTP status code only, via `lib/octokit-status.ts`'s `statusOf`), never on error message/body text, because body text can carry credential-adjacent material.
- Top-level bins (`action/index.ts`, `cleanup/index.ts`, `roundtrip/read-back.ts`) each end with `run().catch((error) => core.setFailed(...))`, gated by `isEntrypoint()` so importing the module for tests never triggers this.

## Cross-Cutting Concerns

**Logging:** `@actions/core` (`core.info`/`core.warning`/`core.error`/`core.setFailed`) inside Actions-runtime code; `process.stderr.write` for the one-time degrade notice in the Releases reader (`releases-backend.ts:42-53`, deliberately not `core.warning` since that module has no `@actions/core` dependency). Job-summary tables are rendered through a single shared helper, `lib/summary.ts` (`writeCountSummary`), used identically by publish and cleanup.

**Validation:** All untrusted input is validated at a clear trust boundary and fails closed: the HTTP route hash (`parseHash`/`HASH_PATTERN`, `server.ts:111-118`), the bearer token (constant-time compare via SHA-256 digest + `timingSafeEqual`, `server.ts:30-42`), `GITHUB_REPOSITORY` (`GITHUB_REPOSITORY_PATTERN`, checked at both `select-backend.ts` and the publish/cleanup bins), and the retention knob (`resolveMaxAgeDays`, clamped `[1, 365]` with a 7-day policy floor requiring explicit opt-out).

**Authentication:** Two independent credential surfaces that must never be conflated: (1) the per-process CSPRNG bearer token guarding the loopback HTTP server (`generateToken()`/`makeAuthGate`, `server.ts`), and (2) the GitHub token resolved from runtime context (`resolveGitHubToken`: `GH_TOKEN || GITHUB_TOKEN`, `lib/github-identity.ts`) used to talk to GitHub's APIs. `lib/local-context.ts` adds a third, local-developer-only tier chain (env -> `gh auth token` -> `git credential fill`) for the cross-context Releases reader when running outside CI.

---

*Architecture analysis: 2026-07-22*
