# External Integrations

**Analysis Date:** 2026-07-22

## APIs & External Services

**GitHub Actions cache service:**
- Used for: the default, read-write, in-CI cache backend. `get`/`put` map to `cache.restoreCache`/`cache.saveCache`.
  - SDK/Client: `@actions/cache` 6.2.0 (exact-pinned)
  - Implementation: `packages/github-cache/src/backend/actions-cache-backend.ts` (`createActionsCacheBackend`)
  - Auth: implicit - the Actions-cache primitive authenticates with its own runtime credentials (`ACTIONS_RUNTIME_TOKEN` / `ACTIONS_RESULTS_URL`), injected only into a JS-action process, never a plain `run:` shell step (see `docs/advanced.md` "Why the sidecar is a JS action, not composite")
  - Cache key derivation: `packages/github-cache/src/lib/cache-key.ts` (`cacheKeyFor`) and `src/lib/cache-archive-path.ts` (`cacheArchivePath`) are the single-source helpers so `save`/`restore` always agree on a byte-identical archive path per hash
  - Scope/limit: 10 GB per repository (GitHub platform limit, not configurable); on eviction the backend just MISSes, never errors
  - Concurrency guard: `src/lib/with-hash-lock.ts` (`withHashLock`) serializes `get`/`put` for the *same* hash in-process, because both paths reuse the same deterministic temp archive path

**GitHub Releases (REST via Octokit):**
- Used for: the opt-in, cross-context read mirror (`cache-mirror-YYYYMM` month-shard releases) and its maintenance (publish/sync + cleanup)
  - Read path SDK/Client: native global `fetch` (zero-dependency-lean by design), NOT Octokit - `packages/github-cache/src/backend/releases-backend.ts` (`createReleasesReadClient`, `fetchAssetFromShard`)
    - Endpoints: `GET /repos/{owner}/{repo}/releases/tags/{tag}`, `GET /repos/{owner}/{repo}/releases/{release_id}/assets` (paginated, never the inline `release.assets` snapshot), `GET /repos/{owner}/{repo}/releases/assets/{asset_id}` (asset download, follows a 302 to signed storage and intentionally drops the Authorization header on that cross-origin hop)
    - Auth: `Bearer <token>` header (`githubJsonHeaders`), token resolved via the local-read chain (below)
    - Timeouts: 5s for metadata calls (`FETCH_TIMEOUT_MS`), 300s for the asset download body (`DOWNLOAD_TIMEOUT_MS`), both via native `AbortSignal.timeout`
  - Write/publish path SDK/Client: `@octokit/rest` 22.0.1 via `createResilientOctokit` (`@octokit/plugin-retry` 8.1.0 + `@octokit/plugin-throttling` 11.0.3) - `packages/github-cache/src/lib/resilient-octokit.ts`
    - Publish adapter: `src/action/index.ts` (`createPublishClient`) - `octokit.rest.actions.getActionsCacheList` (paginated), `octokit.rest.repos.getReleaseByTag`, `createRelease`, `listReleaseAssets` (paginated), `uploadReleaseAsset`
    - Publish engine (network-free, injected-client): `src/publish/publish-mirror.ts`
    - Cleanup adapter: `src/cleanup/index.ts` (`createCleanupClient`) - `octokit.rest.repos.listReleases` (paginated), `listReleaseAssets` (paginated), `deleteReleaseAsset`
    - Cleanup engine (network-free, injected-client): `src/cleanup/cleanup.ts` (`cleanupMirror`)
  - Auth: `GH_TOKEN` / `GITHUB_TOKEN` resolved via `resolveGitHubToken` (`src/lib/github-identity.ts`) - see credential section below
  - Retention/sharding: `packages/github-cache/src/lib/retention.ts` - one coupled knob `CACHE_MIRROR_MAX_AGE_DAYS` (default 30, 7-day policy floor, 365-day hard ceiling) drives both the read-lookback window (`shardTagsForWindow`) and the cleanup prune window
  - Rate-limit handling: `createResilientOctokit`'s `onRateLimit`/`onSecondaryRateLimit` callbacks log via `core.warning` and retry once (`retryCount < 1`)
  - Fault handling: every read fault (401/403/404/429/5xx/DNS/timeout) degrades to a warned cache MISS (`warnOnce` in `releases-backend.ts`), never a build failure; cleanup's *list* phase inverts this and propagates any fault to abort the whole run with zero deletions (a swallowed list fault would read as false absence and could delete live data)

**gh CLI / git credential helper (local developer auth, not a network API per se):**
- Used for: resolving a GitHub token on a developer machine when no `GH_TOKEN`/`GITHUB_TOKEN` env var is set, so the opt-in Releases reader can authenticate locally
  - Implementation: `packages/github-cache/src/lib/local-context.ts` (`resolveLocalReadToken`, `runHelper`)
  - Tier 2: `gh auth token` (spawned via `node:child_process.spawn`, no shell, 5s timeout, `SIGKILL` on timeout)
  - Tier 3 (last, slowest): `git credential fill` with `protocol=https\nhost=github.com\n\n` piped to stdin; the `password=` line is extracted from stdout with an anchored regex
  - Hardening: `GIT_TERMINAL_PROMPT=0`, `GIT_ASKPASS=''`, `SSH_ASKPASS=''` env overrides prevent any interactive/GUI credential prompt from blocking the build; no stderr listener is attached (stderr is locale-dependent and may carry credential-adjacent material)
  - No anonymous fallback: exhausting all tiers resolves `undefined` and the reader MISSES rather than making an unauthenticated request (which would silently bind to GitHub's unauthenticated 60-req/hr rate limit and could not see a private repo)
  - Also used for repo-identity resolution: `resolveRepoIdentity` runs `git remote get-url origin` and parses `https://github.com/owner/repo(.git)` or `git@github.com:owner/repo(.git)` (host-anchored, case-insensitive host only)

## Data Storage

**Databases:** None.

**File Storage:**
- GitHub Actions cache (ephemeral, per-repo, 10 GB cap) - primary read-write store
- GitHub Releases assets (opt-in mirror, month-sharded `cache-mirror-YYYYMM` tags) - secondary cross-context read store; soft cap of ~1000 assets per release (per-OS asset names via `src/lib/release-asset-name.ts`)
- Local filesystem: transient cache archives at a deterministic temp path (`src/lib/cache-archive-path.ts`) used only as the on-disk staging area for `@actions/cache` save/restore, always removed in a `finally` block after use

**Caching:**
- The package itself *is* the cache server (`node:http`, `packages/github-cache/src/server/server.ts`); it has no cache-of-its-own beyond the backends above
- Build/test tool caches (Vite/Vitest `cacheDir`, Nx `.nx/cache`) are local developer/CI tooling caches, not an external integration

## Authentication & Identity

**Auth Provider:** None (no OAuth/OIDC/identity provider integration) - Custom, env/CLI-derived token resolution only.

**The three distinct credential types (never conflated, per in-code comments in `serve.ts` and `action/index.ts`):**

1. **CSPRNG bearer token** (`generateToken()` in `packages/github-cache/src/server/server.ts`, `randomBytes(32).toString('hex')`)
   - Purpose: per-process secret that gates the local loopback `node:http` server itself (the Nx self-hosted-remote-cache client presents it as `Authorization: Bearer <token>`)
   - Constant-time compare via SHA-256 digest + `timingSafeEqual` (`makeAuthGate`) to avoid a length/timing side-channel
   - Minted fresh per `serve()` call unless a token is inherited from `NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN` (env) or passed as `ServeOptions.token`; fallback uses `||` (not `??`) so a set-but-empty value still mints a fresh one
   - In the consumer sidecar handshake (`start-cache-server`), the CONSUMER mints this token (`openssl rand -hex 32` in a regular workflow step, masked with `::add-mask::` before being written to `$GITHUB_ENV`), because a background step cannot export env to later steps; `serve()` then *adopts* the pre-set token rather than minting its own
   - Never logged unmasked: `core.setSecret(running.token)` runs immediately after `serve()` returns in both `start-cache-server/entry.ts` and the internal dogfood entry (`src/action/index.ts`)

2. **`ACTIONS_RUNTIME_TOKEN`** (plus `ACTIONS_RESULTS_URL`)
   - Purpose: GitHub's own Actions-cache-service runtime credential, required by `@actions/cache`'s `saveCache`/`restoreCache` calls
   - Injected ONLY into a JS-action (`runs.using: 'node24'`) process by the Actions runner; absent from a plain `run:` shell step - this is precisely why the writable backend must ship as a JS action (`start-cache-server`, and internally `packages/github-cache/action.yml`) rather than a composite action or a bash `&`-backgrounded process (see `docs/advanced.md` "Why the sidecar is a JS action, not composite" and "The `&` fallback")
   - Never read/handled directly by this codebase's own logic - it flows implicitly through `@actions/cache`'s internals; the repo's code only checks for its *presence* (`src/action/index.ts` `run()`) to decide whether the dogfood entry should skip itself when invoked outside a real Actions JS-action runtime
   - Must never be re-exported through the workflow environment file (`$GITHUB_ENV`) - inherited by process only (documented as decision D-06)

3. **`GITHUB_TOKEN` / `GH_TOKEN`** (workflow/job-scoped or personal REST token)
   - Purpose: authenticates GitHub REST API calls - Octokit-based publish/cleanup (Releases + Actions-cache-list enumeration) and the native-`fetch`-based Releases reader
   - Resolution order: `GH_TOKEN || GITHUB_TOKEN` (falsy-coalescing `||`, not `??`, so a set-but-empty value falls through) - single source of truth `resolveGitHubToken` in `packages/github-cache/src/lib/github-identity.ts`
   - In CI: the job-scoped `secrets.GITHUB_TOKEN`, passed to action steps by **process inheritance** (`env: GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}`), never through `$GITHUB_ENV`
   - Permissions are least-privilege and workflow/job-scoped in `.github/workflows/ci.yml` and `cleanup.yml`:
     - `ci.yml` workflow-level: `contents: read`
     - `ci.yml` `publish` job override: `contents: write` (create release + upload asset) + `actions: read` (list Actions-cache entries) - a job-level `permissions:` block *replaces* the workflow grant wholesale, so both scopes must be restated together
     - `cleanup.yml` workflow-level: `contents: write` only (Releases assets live under `contents`; no `actions:read`, no personal token)
   - Locally (developer machine): tier 1 of `resolveLocalReadToken` in `src/lib/local-context.ts` - falls through to `gh`/git-credential tiers if unset (see gh CLI section above)
   - Same token also gates whether `selectBackend` (`src/lib/select-backend.ts`) can construct the writable Actions-cache backend at all - a trusted CI trigger with no resolvable token degrades to a silent empty read-only memory backend (every read a permanent MISS, every write a `403`), rather than failing the build

**Backend/trust selection (context-derived, not a caller flag):**
- `selectBackend` (`src/lib/select-backend.ts`) has four outcomes gated first on `isWriteTrusted` (`src/lib/trust.ts`): untrusted context -> read-only Releases reader; trusted + malformed `GITHUB_REPOSITORY` -> throws (fail-closed); trusted + valid identity + no token -> empty read-only memory backend; trusted + valid identity + token -> writable Actions-cache backend
- `isWriteTrusted`: two allowlists - `TRUSTED_EVENTS = ['push', 'schedule']` (host-independent) and `HOST_GATED_EVENTS = ['pull_request', 'release']` (trusted only on `github.com` or a `*.ghe.com` Data Residency host, inferred from `GITHUB_SERVER_URL`, fail-closed on GHES/malformed)
- `isSyncTrusted` (`src/lib/sync-gate.ts`) is a SEPARATE allowlist (`SYNC_EVENTS = ['push', 'schedule']`) that additionally requires the current ref to equal `repository.default_branch` (read from `GITHUB_EVENT_PATH` JSON) - gates the publish/mirror path so widening write-trust never widens sync-trust
- `isTrustedSyncEvent` (`src/lib/sync-gate.ts`) is a narrower, schedule-only defense-in-depth gate for the cleanup path (does not depend on the payload's `default_branch` field)
- All four predicates are pure functions of an injectable `NodeJS.ProcessEnv` bag (`GITHUB_ACTIONS`, `GITHUB_EVENT_NAME`, `GITHUB_SERVER_URL`, `GITHUB_REF`, `GITHUB_REF_NAME`, `GITHUB_EVENT_PATH`), never a caller-facing mode argument

## Monitoring & Observability

**Error Tracking:** None (no Sentry/Datadog/etc.) - failures surface via `@actions/core`'s `core.setFailed` (non-zero job exit), `core.warning` (annotations), and `core.info`.

**Logs:**
- `@actions/core` workflow-command logging (`core.info`, `core.warning`, `core.setFailed`, `core.setSecret` for masking) throughout the action/publish/cleanup entries
- Job-summary tables via `packages/github-cache/src/lib/summary.ts` (`writeCountSummary`) - single-source renderer used by both the publish (`mirrored`/`skipped`/`failed`) and cleanup (`pruned`/`failed`/`scanned`) engines as an "is the cache working" observability signal (documented decision D-17/OBS-01)
- Direct-invocation entries (`serve.ts`'s `main()`) write to `process.stdout`/`process.stderr` directly (not via `@actions/core`) since they can run outside any Actions runtime

## CI/CD & Deployment

**Hosting:** None - this package is a library plus two consumable GitHub Actions; it is not deployed anywhere itself. Consumers run it inside their own GitHub Actions workflows.

**CI Pipeline:** GitHub Actions (`.github/workflows/ci.yml`, `.github/workflows/cleanup.yml`)
- `ci.yml` jobs: `format-check`, `fallow` (dead-code gate), `action-bundle-drift` (esbuild bundle drift + `tsc` on the action graph), `pack-check` (npm tarball file-list guard), `ppe` (advisory PPE-hygiene dogfood against a known-unsafe fixture), `build`, `typecheck`, `test`, `integration` (matrix: `ubuntu-24.04-arm` + `windows-11-arm`, OS-sensitive Nx hash discriminator), `dogfood-seed`/`dogfood-verify` (live Actions-cache round-trip proof, push-only), `consumer-smoke` (live `start-cache-server` background-step round-trip, push-only), `publish` (per-OS mirror-to-Releases matrix, `max-parallel: 1`, push-only), `publish-verify` (live cross-OS read-back proof, push-only)
- `cleanup.yml`: single scheduled job (`cron: '17 3 * * *'`, daily), `concurrency: { group: github-cache-cleanup, cancel-in-progress: false }` for single-writer serialization
- Runners: `ubuntu-24.04-arm` and `windows-11-arm` exclusively (no x64 runners observed)

## Environment Configuration

**Required env vars (consumer-facing, the versioned contract per `docs/versioning.md`):**
- `NX_SELF_HOSTED_REMOTE_CACHE_SERVER` - loopback URL the Nx client targets (consumer-set, adopted by the action)
- `NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN` - bearer token (consumer-set, adopted by the action)
- `PORT` - optional, loopback port (`resolvePort`; falls back to an OS-assigned ephemeral port)
- `CACHE_MIRROR_MAX_AGE_DAYS` - optional, retention/read-window knob (default 30, floor 7, ceiling 365)
- `CACHE_MIRROR_ALLOW_AGGRESSIVE_RETENTION` - optional opt-in to bypass the 7-day floor
- `GH_TOKEN` / `GITHUB_TOKEN` - GitHub token, `GH_TOKEN` preferred
- `GITHUB_REPOSITORY` - `owner/name` identity override (defaults to the runner-injected value or the `origin` git remote)

**Runner-injected env vars consumed internally (not part of the consumer contract):**
- `GITHUB_ACTIONS`, `GITHUB_EVENT_NAME`, `GITHUB_SERVER_URL`, `GITHUB_REF`, `GITHUB_REF_NAME`, `GITHUB_EVENT_PATH` - all trust/sync-gate inputs (`trust.ts`, `sync-gate.ts`)
- `ACTIONS_RUNTIME_TOKEN`, `ACTIONS_RESULTS_URL` - implicit `@actions/cache` runtime credentials, presence-checked only

**Secrets location:**
- `secrets.GITHUB_TOKEN` (GitHub-managed, workflow/job-scoped, passed by process inheritance in `ci.yml`/`cleanup.yml`)
- No `.env` file, no `credentials.*`, no custom secrets store detected in the repo

## Webhooks & Callbacks

**Incoming:** None - this package does not receive GitHub webhooks; it reads the ambient Actions runner event context (`GITHUB_EVENT_NAME`, `GITHUB_EVENT_PATH`) that GitHub Actions itself populates per job run.

**Outgoing:** None (no outbound webhook/callback delivery) - all outbound calls are the request/response REST/fetch calls to the GitHub APIs enumerated above.

---

*Integration audit: 2026-07-22*
