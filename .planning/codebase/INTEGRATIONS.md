# External Integrations

**Analysis Date:** 2026-07-17

## APIs & External Services

**GitHub Actions cache service (read-write backend, CI only):**
- Used as the primary cache store while running under GitHub Actions
  - SDK/Client: `@actions/cache` (`restoreCache`/`saveCache`) in `packages/op-nx-github-cache/src/lib/backends/actions-cache-backend.ts` and `src/bin/publish-mirror.ts`
  - Auth: `ACTIONS_RUNTIME_TOKEN` + `ACTIONS_RESULTS_URL`/`ACTIONS_CACHE_URL` - GitHub injects these ONLY into JavaScript actions, never `run:` steps. That constraint is why `start-cache-server/index.cjs` and `publish-mirror/index.cjs` are JS actions: they inherit the runtime env to the spawned process. Both fail loudly if the env is missing.
  - Key invariant: `cacheArchivePath()` (`actions-cache-backend.ts`) is the single source of truth for the archive path - `@actions/cache` versions entries over the literal path strings, so save and restore must use byte-identical paths or every restore silently misses.
  - Known semantics: `saveCache` returns `-1` for both "already exists" and "write denied"; treated as idempotent conflict (409).

**GitHub Releases REST API (read-only mirror backend, local dev):**
- Anonymous, read-only cache reads for local development from Release assets
  - SDK/Client: `@octokit/rest` in `packages/op-nx-github-cache/src/lib/backends/release-mirror-backend.ts`
  - Endpoints: `repos.getReleaseByTag`, paginated `repos.listReleaseAssets` (per_page 100), `repos.getReleaseAsset` with `accept: application/octet-stream`
  - Auth: optional `GH_TOKEN` / `GITHUB_TOKEN` (`src/lib/backends/index.ts`; `||` fallthrough so an empty `GH_TOKEN` doesn't shadow `GITHUB_TOKEN`). Anonymous works for public repos at 60 req/hr; a token lifts to 5000 req/hr.
  - Sharding: one release per calendar month, tag `cache-mirror-YYYYMM` (`src/lib/shard.ts` `monthTag`), to stay under GitHub's 1000-asset-per-release cap. Reads walk `shardTagsForWindow()` back through the retention window. Per-shard asset maps are cached in-process for the server's lifetime (rate-limit protection).
  - `put()` always returns `'forbidden'` - writes never go through this backend.

**GitHub CLI (`gh`) - mirror publish/cleanup (CI only):**
- Release-asset upload and pruning, plus Actions cache-key listing
  - Client: `execFile('gh', ...)` in `packages/op-nx-github-cache/src/bin/publish-mirror.ts`
  - Calls: `gh repo view` (default branch), `gh api repos/<repo>/actions/caches --paginate` (forced `-X GET` - a `-f` field otherwise flips it to POST), `gh api repos/<repo>/releases`, `gh release create|upload|delete-asset|delete`
  - Auth: `GH_TOKEN` env (set by `publish-mirror/index.cjs` from the `token` input, default `${{ github.token }}`; or by `mirror-cleanup.yml` directly)
  - Fragile sentinels: `gh` reports "already exists" and 404 only as stderr text - matched by `GH_ALREADY_EXISTS_PATTERN` / `GH_NOT_FOUND_MARKER` in `publish-mirror.ts`
  - Never `--clobber` on upload: content-addressed immutability is part of the CREEP defense.

**Nx self-hosted remote cache protocol (this package IS the server):**
- HTTP endpoint consumed by Nx: `GET`/`PUT /v1/cache/:hash` (`CACHE_PATH_PATTERN` in `packages/op-nx-github-cache/src/lib/server.ts`)
- Handshake: `src/bin/serve.ts` prints/appends `NX_SELF_HOSTED_REMOTE_CACHE_SERVER` and `NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN` (to `$GITHUB_ENV` in CI, as `export` lines locally)
- GET failures degrade to 404 (cache miss), never 500 - remote reads are best-effort by design.

## Data Storage

**Databases:**
- None. Both backends are remote object stores addressed by Nx content hash (`HASH_PATTERN` in `src/lib/types.ts`, lowercase hex, max 512 chars).

**File Storage:**
- GitHub Actions cache (CI read-write) and GitHub Release assets (local read-only mirror) - see above
- Local filesystem: transient only - `os.tmpdir()/op-nx-github-cache/<hash>.tar.gz` staging files (`cacheArchivePath()`), removed in `finally` blocks; per-hash in-process locks serialize same-hash access

**Caching:**
- The product is a cache. In-process caches: per-shard asset-map promise cache (`release-mirror-backend.ts` `shardCache`, coalesces concurrent cold GETs; 404s cached, other faults evicted for retry)

## Authentication & Identity

**Auth Provider:**
- Custom, three layers:
  1. **HTTP bearer token** - per-process CSPRNG secret (`randomBytes(32).toString('hex')` in `src/bin/serve.ts`), compared with `timingSafeEqual` (`src/lib/server.ts` `isAuthorized`). Server binds loopback only (`127.0.0.1`). Token is masked in Actions logs via `::add-mask::` (Windows re-masks from `$GITHUB_ENV` in `start-cache-server/index.cjs` because the detached child's stdout goes to a file there).
  2. **Write-trust gate (CREEP / CVE-2025-36852 mitigation)** - `isWriteTrusted()` in `src/lib/trust.ts`: writes allowed only under `GITHUB_ACTIONS=true` with a trusted event (`push`, `schedule`, `workflow_dispatch`, `repository_dispatch`, `delete`, `registry_package`, `page_build`, `merge_group`). Mirrored (keep-in-sync) list in `start-cache-server/index.cjs`. Mirror publish/cleanup additionally require `GITHUB_REF == refs/heads/<default-branch>` (`resolveTrustedRepo` in `src/bin/publish-mirror.ts`).
  3. **GitHub server-side enforcement** - read-only cache tokens on untrusted triggers (silent defense-in-depth; not branchable in code, see `actions-cache-backend.ts` module comment).

## Monitoring & Observability

**Error Tracking:**
- None (no Sentry or similar)

**Logs:**
- `console.log`/`console.warn`/`console.error` only. GitHub workflow annotations via `::error::` (`start-cache-server/index.cjs`, `publish-mirror/index.cjs`). Server logs GET/PUT faults server-side before degrading responses (`src/lib/server.ts`).

## CI/CD & Deployment

**Hosting:**
- Not hosted - the server is a loopback sidecar spawned per CI job / dev session. The deliverable is the npm package `@op-nx/github-cache` (not yet published; version resolved from git tags via Nx release config in `packages/op-nx-github-cache/package.json`).

**CI Pipeline (GitHub Actions):**
- `.github/workflows/ci.yml` - on push to `main` + PRs:
  - `format-check`, `build`, `typecheck`, `test` on `ubuntu-24.04-arm`
  - `integration` matrix: `ubuntu-24.04-arm` + `windows-11-arm` (OS-discriminated Nx hash)
  - `windows-selfcheck` on `windows-latest` (JS action guard logic, no npm install)
  - `publish-mirror` matrix (both OSes, main only, upload-only): a leg can only restore/mirror entries saved on its own platform (compression + tmpdir path fold into `@actions/cache`'s version)
  - Every cache-consuming job dogfoods the just-built server via the local `./start-cache-server` action
- `.github/workflows/mirror-cleanup.yml` - daily cron `17 4 * * *` + `workflow_dispatch`; single-writer prune of stale mirror assets (`contents: write` only), runs `dist/bin/publish-mirror-cleanup.js` with `GH_TOKEN: ${{ github.token }}`
- Local composite JS actions: `start-cache-server/action.yml` + `index.cjs` (detached spawn, `$GITHUB_ENV` readiness poll, 10s timeout), `publish-mirror/action.yml` + `index.cjs` (synchronous, exit-status mirroring)
- Workflow-testing harness: `act` via `test:act` scripts against `packages/op-nx-github-cache/__fixtures__/act-workflow.yml`

**Permissions model (least-privilege, per job):**
- Cache read/write jobs: `contents: read` only (cache auth is `ACTIONS_RUNTIME_TOKEN`, not `GITHUB_TOKEN`)
- `publish-mirror`: `actions: read` (list caches) + `contents: write` (upload assets)
- `mirror-cleanup`: `contents: write` only

## Environment Configuration

**Required env vars:**
- CI (Actions-cache backend): `GITHUB_ACTIONS`, `GITHUB_EVENT_NAME`, `ACTIONS_RUNTIME_TOKEN`, `ACTIONS_RESULTS_URL`/`ACTIONS_CACHE_URL`, `GITHUB_ENV` (all GitHub-injected)
- Local (mirror backend): `GITHUB_REPOSITORY` (`owner/repo`) - the only mandatory user-set var
- Mirror publish/cleanup: `GITHUB_REPOSITORY`, `GITHUB_REF`, `GH_TOKEN`/`GITHUB_TOKEN`
- Optional tuning: `PORT`, `MAX_CACHE_BODY_BYTES`, `CACHE_MIRROR_MAX_AGE_DAYS`, `DEFAULT_BRANCH`, `GH_TOKEN` (rate-limit lift)

**Secrets location:**
- No repo secrets, no `.env` files. All tokens are GitHub-issued at runtime (`github.token`, `ACTIONS_RUNTIME_TOKEN`) or generated per-process (the serve bearer token). Local users may optionally export a personal `GH_TOKEN`.

## Webhooks & Callbacks

**Incoming:**
- None (the HTTP server is the Nx cache endpoint on loopback, not an internet-facing webhook receiver)

**Outgoing:**
- None

---

*Integration audit: 2026-07-17*
