# Plan: @op-nx/github-cache Nx Remote Cache Plugin

## Strategic Direction

> Advisor guidance (verbatim):

1. Ship CLI `bin` that boots localhost server implementing `GET/PUT /v1/cache/{hash}`; run as CI sidecar.
2. Set `NX_SELF_HOSTED_REMOTE_CACHE_SERVER=http://127.0.0.1:<port>` in CI; leave unset locally so Nx cleanly skips remote cache.
3. Bridge PUT/GET to `@actions/cache` `saveCache`/`restoreCache`; functions only inside a runner per pv-7.
4. Assuming a public repo (unverified), do mirror default-branch cache to GHCR/OCI from trusted CI and pull anonymously for local read-only. Verify public repo before acting.
5. CREEP: gate PUT on write-scoped token; inherit GitHub trust-scoping (pv-5/pv-6); no hash trick.

**Critical:** Local "read-only cache" is impossible against Actions storage (pv-7). Commit to the GHCR/OCI mirror OR accept local no-remote-cache -- do not fake a reader. The mirror is a second write path; restrict its writes to trusted default-branch triggers only, else you reopen CREEP.

### Resolved: repo visibility

Remote is now configured and verified: `origin` -> `https://github.com/op-nx/github-cache.git`, `gh repo view op-nx/github-cache --json visibility` -> `"PUBLIC"`. This closes the previously-open item: local reads from the Release-asset mirror (step 4) can be **anonymous** (`gh release download` / unauthenticated Octokit asset fetch) — no read-only PAT needs to be distributed to developer machines. The private-repo PAT-distribution path described below no longer applies to this repo but is left as a note in case visibility ever changes:

- **Public repo (current state)** -> anonymous `gh release download` / unauthenticated Octokit asset fetch works for local read-only, no token needed on dev machines.
- **Private repo (not applicable here)** -> local read-only would need a distributed read-only PAT (`repo` read scope, same credential a dev already needs to clone the repo at all).

### Revision: GitHub Release-asset mirror instead of git-orphan-branch or GHCR/OCI

The user's follow-up allows the GitHub Octokit client and/or `gh` CLI as implementation tools, and requires TypeScript source (already this stub's default — no change needed, all new files below are `.ts`). Given that, **GitHub Release assets** (via `gh release upload`/`gh release download`, or Octokit's `repos.uploadReleaseAsset`/`repos.getReleaseAsset`) are a better fit than either alternative considered earlier:

- vs. **git orphan-branch mirror**: avoids unbounded repo-history growth and hand-rolled git plumbing (`git show <ref>:<path>` tricks); release assets are natively addressable, replaceable (`--clobber`), and versioned by tag.
- vs. **GHCR/OCI**: no new HTTP/OCI client dependency and no separate registry auth story — `gh` is already assumed available (per the user's constraint), and Octokit is the officially blessed, already-typed GitHub API client if programmatic control is preferred over shelling out.

**Recommendation: GitHub Release-asset mirror**, using `gh` CLI by default (zero new runtime dependency) with an Octokit-based implementation as the alternative if the plan needs to avoid shelling out (e.g. for structured error handling on rate limits). This replaces step 4 below.

### Addendum: Docker's role (research follow-up)

> Advisor guidance (verbatim):
>
> 1. Adopt `act`+Docker as local test-only harness; production runtime correctly stays bare Node. Orientation missed no production case.
> 2. Add `act` step to plan Tests/Validate section: `--cache-server-path` exercises the `@actions/cache` bridge; `-e` injects `pull_request_target` to hit the trust-gate.
> 3. Gate the `act` suite behind an opt-in flag (env or npm script); CI already runs real runners, so keep it developer-local.
> 4. Document Docker as a test-only dev prerequisite in the plan, explicitly excluded from shipped `package.json` runtime deps.
> 5. Note `act` GITHUB_TOKEN/permissions differ from real runners; trust-gate assertions must key on `GITHUB_EVENT_NAME`, not token scope.

Research question: could Docker improve the plugin locally and/or in CI? Answer: **no production benefit, one clear testing benefit.** Neither the CI-side server nor the local read-only mirror client gains anything from running in a container — both are already thin Node/CLI processes with no isolation or portability problem to solve, and requiring Docker Desktop for either would be a pure cost. The one genuine gap Docker (via `act`, which is already installed and on `PATH` in this dev environment, alongside Docker v29.6.1) closes: `@actions/cache`'s `saveCache`/`restoreCache` cannot be invoked at all outside a real GitHub Actions runner (verified in an earlier session), so until now the CI-only backend and the CREEP trust-gate's interaction with real trigger semantics were only testable by pushing to actual GitHub Actions CI. `act --cache-server-path=<dir> --artifact-server-path=<dir>` starts local emulated cache/artifact servers and injects the same `ACTIONS_RUNTIME_URL`/`ACTIONS_RUNTIME_TOKEN`-family env vars a real runner would, so `@actions/cache` works transparently against act's local emulation; `act -e <event.json>` additionally lets the trust-gate be exercised against untrusted trigger types (e.g. `pull_request_target`) without needing a real untrusted PR. This becomes new Step 10 below (test harness only; does not change Steps 1-9's shipped architecture).

### Addendum: auto-cleanup requirement (research follow-up)

> Advisor guidance (verbatim):
>
> 1. Fold mirror cleanup into the existing `publish-mirror` CI script; reuse its trusted-CI write credentials, adding no second CREEP-gated write path.
> 2. Delete assets where `created_at` exceeds age threshold (e.g. 30d); single field, native API, deterministic.
> 3. Scope "optionally recently used" down as infeasible; document `download_count` is monotonic-total, not recency, so it cannot signal LRU without new telemetry.
> 4. Use `download_count` only as a delete-protection floor for popular assets, labeled a heuristic, not recency.
> 5. State explicitly in plan: Actions-cache backend needs zero cleanup code; GitHub's 7-day/10GB native eviction covers it.

Research question: must `@op-nx/github-cache` auto-clean up old cache entries based on date and, optionally, recent usage? Verified against the live GitHub Release Asset API schema (`created_at`, `updated_at`, `download_count` -- no last-accessed/last-downloaded field exists), true recency-based ("least recently used") eviction is **not natively supported**: `download_count` is a monotonic lifetime total, not a recency signal, and building real recency tracking would require a new authenticated-write telemetry channel from anonymous local reads -- which conflicts with the deliberately-anonymous, read-only local mirror design and would reopen a second CREEP-relevant write path. Split by backend:

- **GitHub Actions cache (CI backend)**: needs **no new cleanup code**. GitHub already enforces a 10GB per-repo size cap and evicts entries unused for 7+ days automatically (verified earlier session). Adding our own logic here would duplicate a feature the platform already owns.
- **Release-asset mirror (local-read backend)**: has no built-in eviction at all, so this is where the requirement actually applies. Folded into the existing `publish-mirror` CI script (no new write path, no new CREEP surface) as new Step 11 below: after each trusted-trigger upload, delete mirror assets whose `created_at` exceeds a configurable age threshold (default 30 days). "Recently used" is honestly scoped down to a **delete-protection floor**, not true LRU: assets with `download_count` above a threshold are skipped even if old, explicitly documented as a popularity heuristic (total downloads ever), not a recency signal -- this satisfies the "optionally recently used" qualifier without inventing telemetry the API can't support.

### Addendum: review-findings remediation (research follow-up)

> Advisor guidance (verbatim):
>
> 1. Adopt date-based sharding `cache-mirror-<yyyymm>`; one design bounds asset cap, pagination, and create-race together.
> 2. Skip a manifest; 30-day cleanup caps concurrently-live shards at ~2, so no unbounded fan-out exists.
> 3. Read path searches newest-first: `listReleases` prefix-filtered, current month then prior month only. No index needed.
> 4. Confirm F4: attempt create, catch "already exists", fall through to get-by-tag. Sufficient once sharding shrinks blast radius.
> 5. Accept F5 double-compression as documented low-severity CPU tradeoff; do not bypass `@actions/cache` public API for internal service access.
>
> **Critical:** A hash cached late in month N and read after its shard is pruned at 30 days yields a cache miss (rebuild), not corruption -- acceptable, but state it in the plan so it is not mistaken for a bug later.

A prior `/lz-review` pass surfaced 5 findings (F1-F5) plus a Suggestion (F6) and a Question (F7); see Findings Disposition below for how each is addressed. The user separately resolved F6/F7 directly: Octokit is the **primary** implementation for the local read path (bundled npm dependency, `gh` not guaranteed on dev machines); `gh` CLI is assumed available and used for the CI write path (`publish-mirror.ts`, since CI already has `gh` preinstalled/pre-authenticated). This replaces the earlier "gh CLI default, Octokit fallback" framing everywhere below with a deliberate environment-based split, not a fallback-for-uncertainty.

### Addendum: security-review remediation (research follow-up)

> Advisor guidance (verbatim):
>
> 1. Adopt (a) as load-bearing; token-scoping in the workflow is the only real backstop. Add (b) only as labeled defense-in-depth.
> 2. Document in Step 7: never run `publish-mirror.ts` alongside untrusted PR checkout; grant `contents: write` in an isolated post-build job.
> 3. Add `GITHUB_REF` allowlist guard to `publish-mirror.ts`, commented that it does NOT close F2's direct-`gh` bypass.
> 4. Confirm OQ6: yes -- pass `ref=refs/heads/<default-branch>` to the caches-list call.
> 5. Fix F1 via catch-"already-exists"-and-no-op, not check-then-skip -- the check-then variant has a TOCTOU race on concurrent uploads.

A `/lz-security-review` pass on this plan surfaced 4 findings (S1-S4, using S-prefixed numbering here to disambiguate from the earlier `/lz-review` F1-F7) plus an Open Question (S5/OQ6); see Findings Disposition below. Two load-bearing resolutions from this research pass:

- **Open Question resolved via WebSearch:** GitHub's "List GitHub Actions caches for a repository" REST endpoint, called WITHOUT an explicit `ref` filter, returns cache entries across ALL refs in the repo -- including untrusted PR merge-refs (`refs/pull/N/merge`) -- not just the trusted/default branch. Confirmed real: `publish-mirror.ts`'s enumeration step (Step 6) must explicitly pass `ref=refs/heads/<default-branch>`, or it will discover and then promote into the trusted Release-asset mirror cache entries that were only ever meant to be scoped to an untrusted PR.
- **S2 (no GitHub-enforced backstop for mirror writes) is fundamentally a workflow-design concern, not something the plugin's own code can fully close:** the load-bearing fix is documentation (Step 7 -- never invoke `publish-mirror.ts` from a job that checks out/executes untrusted PR code; scope `contents: write` to an isolated post-build job only). A `GITHUB_REF` allowlist guard is added to `publish-mirror.ts` as labeled defense-in-depth, but the plan is explicit that this guard does NOT close the "attacker calls `gh release upload` directly" bypass -- only workflow-level permission scoping does.
  - File: `packages/op-nx-github-cache/src/lib/server.ts`
  - Change: Implement a plain `node:http` server (no new HTTP framework dependency) exposing exactly `GET /v1/cache/:hash` and `PUT /v1/cache/:hash` per the verified Nx 23 contract (pv-1): GET returns 200+bytes or 404; PUT returns 200 on success, 409 if the hash already exists (treat as success, no-op), 403 if writes are refused. The server treats the request/response body as an **opaque blob** -- it must NOT parse the tarball; Nx assembles/extracts the tar.gz itself (pv-1), so this server is a generic content-addressable store keyed by `hash`.
  - **Security fix (review Finding S5, path traversal):** validate the `:hash` route parameter against `^[a-f0-9]+$` (Nx hashes are lowercase hex) immediately on entry, before it reaches any backend, temp-file path, or asset name. Return 400 on a non-matching hash rather than passing it through -- this closes a `../`-style traversal risk anywhere `hash` is later interpolated into a filesystem path (step 3's temp file) or a `<hash>.tar.gz` asset name (step 4/6).
  - **Security fix (review Finding S3, bind interface):** `serve.ts` (step 6) must explicitly bind the server to loopback only (`127.0.0.1` and `::1`), never `0.0.0.0`/all-interfaces -- Node's `http.Server.listen()` defaults to all interfaces when no host is passed, which would expose this write-capable CI sidecar to any co-tenant process/container sharing the runner's network namespace.
  - Rationale: Matches the verified ground-truth contract exactly (pv-1); avoids scope creep into tar handling Nx already owns. The hash-validation and bind-interface fixes close two concrete, low-cost attack surfaces flagged by security review before any backend logic ever runs.

2. **Trust-scope gate (CREEP mitigation, defense-in-depth)**
   - File: `packages/op-nx-github-cache/src/lib/trust.ts`
   - Change: A pure function `isWriteTrusted(env): boolean` that inspects `GITHUB_EVENT_NAME` (and `GITHUB_ACTIONS`) and returns `true` only for the trusted-trigger set verified in pv-5/pv-6 (`push`, `schedule`, `workflow_dispatch`, `repository_dispatch`, `delete`, `registry_package`, `page_build`); everything else (including no `GITHUB_EVENT_NAME` at all, i.e. local) is untrusted. `server.ts`'s PUT handler calls this **before** attempting any backend write and returns 403 immediately if untrusted -- this is a fast, self-owned check, not a substitute for GitHub's own enforcement (step 3 still catches a genuine backend-level rejection as backstop).
   - Rationale: Per pv-4, hashing/checksums cannot detect CREEP because poisoning happens before hashing -- the only structural fix is gating writes by branch/trigger trust, mirroring GitHub's own model (pv-5) instead of inventing a new one.
   - **Scope limitation (review Finding S2), stated explicitly:** this in-process check is a real backstop for the Actions-cache write path ONLY because GitHub's own platform additionally enforces read-only-trigger rejection server-side (pv-5) -- there is no equivalent platform-side enforcement for Release-asset uploads. For the mirror write path (`publish-mirror.ts`, step 6), `isWriteTrusted` is defense-in-depth, not the load-bearing control; the load-bearing control is workflow-level permission scoping (step 7).

3. **GitHub Actions cache backend (CI read-write)**
   - File: `packages/op-nx-github-cache/src/lib/backends/actions-cache-backend.ts`
   - Change: Bridge the opaque PUT/GET bytes to `@actions/cache`'s `saveCache(paths, key)` / `restoreCache(paths, key, [])` (pv-7), using `hash` as the cache key. Since these functions take file paths, write the PUT body to a per-request temp file/dir before calling `saveCache`, and stream the restored file back on GET. Catch and translate `@actions/cache` errors (including GitHub's own native read-only-trigger rejection, pv-5) into the 403/404/5xx responses `server.ts` expects. Add `@actions/cache` as a dependency.
   - **Known accepted tradeoff (review Finding F5):** `saveCache` re-archives the already-gzipped tarball Nx's PUT body contains, wasting some CPU per store (not doubling storage -- re-compressing incompressible bytes yields roughly the same size plus a small wrapper). Accepted as documented overhead rather than bypassing `@actions/cache`'s public API to talk to GitHub's internal cache service directly (would trade a bounded CPU cost for an undocumented-API dependency).
   - Rationale: This is the only documented way to read/write GitHub Actions cache content (pv-7), and only works inside an actual Actions runner -- this backend is CI-only by construction (it will throw if the runner context is absent, which is fine: it's never selected outside CI).

4. **GitHub Release-asset mirror backend (local read-only, sharded, Octokit-primary)**
   - File: `packages/op-nx-github-cache/src/lib/backends/release-mirror-backend.ts`
   - Change: Read-only `get(hash)` implementation using **Octokit as the primary implementation** (bundled `@octokit/rest` dependency, not a fallback -- `gh` is not guaranteed on developer machines). Mirror releases are **sharded by calendar month**, tagged `cache-mirror-<yyyymm>` (e.g. `cache-mirror-202607`), to stay under GitHub's hard 1000-asset-per-release cap (review Finding F1) -- an unbounded single release would otherwise accumulate one asset per distinct Nx task-hash indefinitely. Since a given hash's shard isn't known in advance and no manifest/index is maintained (a manifest would itself be a new write-coordination surface), `get(hash)` searches **newest-first, current month then prior month only** (`octokit.repos.getReleaseByTag('cache-mirror-<currentYYYYMM>')`, then `<previousYYYYMM>` on 404), bounded to exactly 2 lookups because the 30-day cleanup window (step 9) means a hash can realistically only live in the current or immediately-prior month's shard. Returns 404 cleanly when neither shard has the asset. No `put` here -- this backend is get-only; writing is a separate, narrow CLI (`publish-mirror`, step 6) invoked only from trusted CI, never from the running server.
   - **Documented, accepted edge case (per advisor guidance):** a hash cached late in month N and read after that shard is pruned at the 30-day age threshold (step 9) yields a cache miss (Nx just rebuilds), not corruption or an error -- this is expected sharding+retention behavior, not a bug.
   - Rationale: Directly satisfies "work in read-only mode locally" (requirement 5) using a stable, addressable GitHub primitive (Release assets) rather than git plumbing or a new registry; the monthly shard scheme resolves F1 (bounded per-shard asset count) without adding a manifest file that would itself need CREEP-style write gating.

5. **Server wiring / backend selection**
   - File: `packages/op-nx-github-cache/src/lib/server.ts` (extend step 1), `packages/op-nx-github-cache/src/lib/backends/index.ts`
   - Change: At startup, select backend by environment: if `GITHUB_ACTIONS=true` -> `actions-cache-backend` (read-write, gated by step 2); else -> `release-mirror-backend` (read-only, GET only, PUT always 403). No env var forces mode manually -- the runtime context itself determines it, so there is no "read-only flag" a caller can get wrong.
   - Rationale: Requirements (4) and (5) both fall out of this one selection rule instead of needing separately-configured modes.

6. **CLI entry points**
   - File: `packages/op-nx-github-cache/src/bin/serve.ts`, `packages/op-nx-github-cache/src/bin/publish-mirror.ts`
   - Change: `serve.ts` starts the step-1 server on an ephemeral or specified port, **binds explicitly to loopback only** (`127.0.0.1`/`::1`, review Finding S3 -- see step 1), and prints the URL (for CI to capture into `NX_SELF_HOSTED_REMOTE_CACHE_SERVER`). It does not need to emit a GitHub-issued token at all -- since the server is a loopback-only sidecar under our own control, auth is a local-only shared secret generated at startup via `crypto.randomBytes` (review Finding S4 -- a CSPRNG, not `Math.random()` or similar) and passed to the caller. **In CI, this secret must never be printed to stdout/job logs** (public-repo Actions logs are world-readable) -- write it to `$GITHUB_ENV` directly (or register it with `core.setSecret()`/`::add-mask::` first if it must ever be echoed) rather than logging it; locally, printing to the terminal is fine since there's no public log.
   - `publish-mirror.ts` is a narrow trusted-CI-only script (run as a post-build CI step, gated by `isWriteTrusted` from step 2) using **`gh` CLI as the primary implementation** (assumed available/pre-authenticated in CI). It:
     1. **Enumerates newly-cached hashes** via the GitHub Actions Cache REST API, **explicitly filtered to the trusted ref**: `gh api repos/{owner}/{repo}/actions/caches --paginate -f ref=refs/heads/<default-branch>` (resolved-Open-Question fix -- without this filter, the endpoint returns cache entries across ALL refs in the repo, including untrusted PR merge-refs, which would otherwise get promoted into the trusted mirror), using the cache-entry `key` field -- which equals the Nx hash, since step 3 uses `hash` as the `saveCache` key -- as the enumeration source. (Review Finding F2: `@actions/cache`'s own toolkit has no list function; this REST endpoint is the actual mechanism, not previously specified.)
     2. **Defense-in-depth trigger guard (review Finding S2, secondary control only):** before doing anything else, refuse to run unless `GITHUB_REF` matches an explicitly-configured trusted-ref pattern (e.g. `refs/heads/<default-branch>`). This is stated explicitly as NOT closing the actual gap S2 describes -- an attacker with code execution inside a job that already holds a write-scoped token can invoke `gh release upload` directly, bypassing this script (and its guard) entirely. The real control is workflow-level permission scoping (step 7); this guard only prevents accidental misconfiguration (e.g. someone wiring `publish-mirror.ts` into the wrong workflow trigger by mistake).
     3. **Resolves the current month's shard tag** (`cache-mirror-<yyyymm>`) and idempotently ensures it exists: attempt `gh release create cache-mirror-<yyyymm> --notes "Cache mirror shard"`, catch an "already exists" failure, and fall through to treating the shard as already present (review Finding F4 -- this catch-and-recover pattern, not a check-then-create race, is what makes concurrent CI matrix jobs safe).
     4. **Uploads** each newly-cached hash as an asset **without `--clobber`** (review Finding S1/F1 -- `--clobber` silently overwrites an existing hash's content, breaking the content-addressed immutability the plan relies on as its core CREEP defense): attempt `gh release upload cache-mirror-<yyyymm> <hash>.tar.gz`, catch the "asset already exists" failure, and treat it as a no-op success -- matching the same catch-and-recover pattern as shard creation (step 6.3) rather than a check-then-upload race (a check-then-upload has the same TOCTOU exposure as check-then-create would for shard creation).
   - Rationale: Requirement (1), "must work in ... GitHub Actions (CI)", needs an actual process to run; keeping auth local-only for the server avoids inventing a second credential system on top of GitHub's, while `publish-mirror` deliberately does use real GitHub auth (`gh`'s own pre-authenticated CI login) since it must actually write to the repo's releases. Using `gh` here (rather than Octokit) is a deliberate environment-based split, not a fallback: CI already has `gh` preinstalled and authenticated, so it's the leaner choice for the write path, while Octokit is the primary tool for the read path (step 4) where `gh` isn't guaranteed.
   - Add `"bin"` entries to `packages/op-nx-github-cache/package.json` for both scripts; add `@octokit/rest` as a real (not fallback) dependency for step 4.

7. **CI wiring example**
   - File: `packages/op-nx-github-cache/README.md`
   - Change: Document the two required workflow steps -- start the server and export `NX_SELF_HOSTED_REMOTE_CACHE_SERVER`/`_ACCESS_TOKEN` before running `nx` tasks; run `publish-mirror` after a successful build on trusted triggers only (requires `gh auth` already configured in the CI job, or `GH_TOKEN`/a PAT for the Octokit path). Document that locally, developers run `npx @op-nx/github-cache serve` (or similar) once per session and export the printed URL/token themselves, or via a documented shell function -- no code change needed to "activate" read-only local mode, since backend selection (step 5) already degrades correctly off `GITHUB_ACTIONS`. Since `op-nx/github-cache` is confirmed public, local reads work anonymously -- no `gh auth login` or PAT required for the read path (only `publish-mirror`, run in trusted CI, needs write-scoped auth).
   - **Load-bearing security requirement (review Finding S2), stated as a MUST, not a nice-to-have:** the README must explicitly instruct that `publish-mirror.ts` is invoked ONLY from a job that (a) never checks out or executes untrusted PR-controlled code (no `pull_request_target` job that also runs PR build steps -- the canonical "pwn request" pattern), and (b) is granted `contents: write` permission ONLY in that isolated post-build job, not workflow-wide. This is the actual, load-bearing control -- `trust.ts` (step 2) and `publish-mirror.ts`'s `GITHUB_REF` guard (step 6) are defense-in-depth only, since neither can stop an attacker who already has code execution inside a job holding a write-scoped token from invoking `gh release upload` directly. Include a concrete example workflow snippet showing the build job (untrusted-code-safe, read-only permissions) and the separate publish job (trusted, `contents: write`, runs only after the build job succeeds on a trusted trigger).
   - Rationale: The env-var contract (pv-1) has no Nx-side config surface -- this is the only place the wiring can be taught to consumers, and it's also the only place this plan can actually close review Finding S2, since the vulnerability is a workflow-architecture concern the plugin's own code cannot fully enforce.

8. **Tests**
   - File: `packages/op-nx-github-cache/src/lib/server.spec.ts`, `packages/op-nx-github-cache/src/lib/trust.spec.ts`, `packages/op-nx-github-cache/src/lib/cleanup.spec.ts`, `packages/op-nx-github-cache/src/lib/backends/release-mirror-backend.spec.ts`
   - Change: Unit-test `isWriteTrusted` against the full trusted/untrusted trigger matrix (pv-5); an integration-style test that boots `server.ts` against a fake in-memory backend and exercises GET 404 -> PUT 200 -> GET 200 -> PUT 409 (duplicate) -> PUT 403 (untrusted) round-trips matching the verified Nx contract (pv-1); a unit test for `cleanup()` (step 9) against a fake paginated asset list verifying age-threshold deletion, the `download_count` delete-protection floor (including the edge case where both conditions disagree -- old but popular -> kept), and full pagination traversal (review F3); and a unit test for the release-mirror-backend's shard-search logic (review F1) verifying it checks current-month then prior-month shard tags in order and returns a clean 404 only after both miss.
   - Rationale: These are the genuinely new logic pieces (trust gating, HTTP contract shape, cleanup heuristic, shard search); the backends are thin bridges to already-tested third-party tools (`@actions/cache`, `gh` CLI / Octokit).

9. **Mirror auto-cleanup (per-shard, paginated)**
   - File: `packages/op-nx-github-cache/src/bin/publish-mirror.ts` (extend step 6), `packages/op-nx-github-cache/src/lib/cleanup.ts`
   - Change: After uploading newly-cached hashes, `publish-mirror.ts` calls a `cleanup(assets, { maxAgeDays, minDownloadCountToKeep })` function against the **current month's shard** (`cache-mirror-<yyyymm>`): list all assets via `gh api repos/{owner}/{repo}/releases/tags/cache-mirror-<yyyymm> --paginate` (or Octokit's `paginate(repos.listReleaseAssets, ...)`) -- **fully paginated** (review Finding F3: GitHub's list endpoints page at ~100/response; sharding already keeps each shard's count well under a handful of pages, but pagination must still be exhaustive, not single-page). Delete (`gh release delete-asset` / `repos.deleteReleaseAsset`) any asset where `created_at` is older than `maxAgeDays` (default 30) **and** `download_count` is below `minDownloadCountToKeep` (default 0, i.e. off unless configured) -- documented explicitly as a popularity heuristic, not true recency, since the API exposes no last-accessed timestamp (pv-10). Additionally, once a shard older than `maxAgeDays` has zero remaining assets, delete the shard's release itself (`gh release delete cache-mirror-<yyyymm>`) to keep the shard list itself from growing unbounded. Runs only from `publish-mirror.ts`, so it inherits the same trusted-CI-only gating as step 6 -- no new write path, no new CREEP surface.
   - Rationale: Satisfies "must auto-clean up based on date and optionally recently used" for the one backend that actually lacks native eviction (the Release-asset mirror); the Actions-cache backend needs no cleanup code at all -- GitHub's own 10GB/7-day eviction already covers it (pv-6), so no file changes there. Sharding (step 4/6) keeps this cleanup's pagination cost small by construction, resolving F3 as a side effect of resolving F1.

10. **`act`+Docker local integration-test harness (test-only, not shipped runtime)**
    - File: `packages/op-nx-github-cache/.actrc` or `package.json` script `test:act` (opt-in, not part of the default `test`/`test-ci` targets), plus a fixture workflow e.g. `packages/op-nx-github-cache/__fixtures__/act-workflow.yml`
    - Change: Add an opt-in script (e.g. `npm run test:act`, gated behind an explicit flag/env var, never run by default CI or `nx test`) that invokes `act push --cache-server-path=.act-cache --artifact-server-path=.act-artifacts` against the fixture workflow to exercise the real `@actions/cache`-backed `actions-cache-backend.ts` end-to-end (step 3), and a second invocation with `act -e __fixtures__/pull_request_target-event.json` to verify `trust.ts` (step 2) actually refuses writes under an untrusted trigger, using real `@actions/cache` calls rather than mocked ones. Document Docker + `act` as **test-only developer prerequisites** in the README (step 7) -- explicitly NOT added to `packages/op-nx-github-cache/package.json` `dependencies` or `devDependencies` (no npm package for `act`/Docker itself), since neither ships in the runtime path.
    - Rationale: `@actions/cache` cannot be invoked at all outside a real runner (pv-7), so this is the only way to validate the CI backend and the CREEP trust-gate against real GitHub Actions semantics before pushing to actual CI. Kept strictly opt-in and test-only per the advisor's guidance, since real CI runners already exist and don't need `act` to run for real -- and `act`'s `GITHUB_TOKEN`/permissions differ from real runners, so any trust-gate assertions in this harness must key on `GITHUB_EVENT_NAME` (which `act -e` sets accurately), never on token scope.

11. **Validate**
    - Run: `npx nx test op-nx-github-cache`
    - Verify: All vitest specs pass, including the trust-matrix and server round-trip tests from step 8, and the cleanup-heuristic tests from step 9.
    - Run (manual, pre-commit, change-surface-matched to the new runtime server/env wiring): start `serve.ts` locally, `export NX_SELF_HOSTED_REMOTE_CACHE_SERVER=http://127.0.0.1:<port>` (and token), run `npx nx build op-nx-github-cache` twice.
    - Verify: second run reports a remote cache hit (Nx logs "Retrieved from remote cache"), confirming the server round-trips real Nx-generated tarballs end to end, not just synthetic test bytes.
    - Run (optional, if Docker is available): `npm run test:act` (step 10).
    - Verify: the `act`-driven run shows a real `@actions/cache` save/restore round-trip on a trusted event, and a refused write (403) on the injected `pull_request_target` event.

## Findings Disposition

Input: the `/lz-review` pass on this plan file (prior session), 5 numbered findings plus a Suggestion and a Question.

- **Finding F1 (Critical):** Single fixed `cache-mirror` release accumulates one asset per task-hash with no upper bound; GitHub enforces a hard, actively-enforced 1000-asset-per-release cap.
  - **Disposition:** addressed
  - **Rationale:** Step 4/6/9 now shard the mirror by calendar month (`cache-mirror-<yyyymm>`), so each shard's asset count resets monthly instead of growing unbounded.

- **Finding F2 (Important):** `publish-mirror.ts` "reads newly-cached hashes from the Actions cache" but `@actions/cache`'s Node toolkit has no list/enumerate function.
  - **Disposition:** addressed
  - **Rationale:** Step 6 now specifies the actual enumeration mechanism -- the GitHub Actions Cache REST API (`GET /repos/{owner}/{repo}/actions/caches`, via `gh api` or Octokit), which lists cache entries by key; since our cache keys equal Nx hashes, this gives a real enumeration source `@actions/cache` itself doesn't expose.

- **Finding F3 (Important):** Mirror cleanup's "list all assets" doesn't account for pagination (~100/page); assets past page 1 would never be pruned.
  - **Disposition:** addressed
  - **Rationale:** Step 9 now specifies full pagination (`gh api --paginate` / Octokit's `paginate()` helper) when listing a shard's assets, and sharding (F1's fix) also keeps each shard's asset count -- and therefore page count -- small.

- **Finding F4 (Important):** `publish-mirror.ts`'s "create the release on first use if it doesn't exist" has no idempotency/concurrency handling; parallel CI matrix jobs could race.
  - **Disposition:** addressed
  - **Rationale:** Step 6 now specifies the standard idempotent pattern (attempt create, catch "already exists," fall through to get-by-tag); sharding (F1) also shrinks the blast radius since each shard's first-creation race is a rarer, smaller-scale event (once per month per shard, not once ever for an unbounded release).

- **Finding F5 (Important, magnitude corrected by reviewer):** The CI backend passes Nx's already-gzipped PUT body through `@actions/cache`'s `saveCache`, which re-archives it, wasting CPU per store.
  - **Disposition:** rejected (accepted as documented tradeoff, no code change)
  - **Rationale:** `@actions/cache`'s only public/documented API always re-archives given paths; bypassing it to talk to GitHub's internal cache service directly would violate the "only documented way" principle this plan already established for backend 3 (pv-7) and trade a modest, bounded CPU cost for a much riskier undocumented-API dependency. Documented as an accepted low-severity overhead in Key Decisions, not fixed in code.

- **Finding F6 (Suggestion):** Dual `gh`+Octokit paths (one primary, one fallback) may be unjustified complexity for a branch that may never trigger.
  - **Disposition:** addressed
  - **Rationale:** Superseded by the user's explicit environment-based split (Octokit primary for local reads, `gh` primary for CI writes) -- there is no longer a "fallback for uncertainty" path; each tool has a distinct, non-overlapping justification, closing the YAGNI concern.

- **Finding F7 (Question):** Does the local read path's need for a tool independent of `gh` justify an Octokit fallback even if writes stay `gh`-only?
  - **Disposition:** addressed
  - **Rationale:** Answered directly by the user: yes -- Octokit is bundled as a real dependency for the local read path specifically because `gh` isn't guaranteed on developer machines, while CI's write path uses `gh` because CI already has it preinstalled/pre-authenticated.

Input: the `/lz-security-review` pass on this plan file (this session), 4 numbered findings (S1-S4, using S-prefixed numbering to disambiguate from the `/lz-review` findings above) plus an Open Question (S5/OQ6).

- **Finding S1 (Critical):** `gh release upload ... --clobber` silently overwrites an existing hash's mirror asset, breaking content-addressed immutability and reopening CREEP-style poisoning at the mirror layer.
  - **Disposition:** addressed
  - **Rationale:** Step 6.4 drops `--clobber`; upload now attempts a plain upload and catches "asset already exists" as a no-op success, matching the same catch-and-recover idempotency pattern used for shard creation (F4/Step 6.3) rather than reintroducing a check-then-act race.

- **Finding S2 (Critical, raised from High by security reviewer):** the CREEP trust gate has no GitHub-server-enforced backstop for the Release-mirror write path; an attacker with code execution inside a write-scoped CI job can bypass `trust.ts` entirely by invoking `gh release upload` directly.
  - **Disposition:** addressed
  - **Rationale:** Per advisor guidance, the load-bearing fix is workflow-level permission scoping, documented as a MUST in Step 7 (never invoke `publish-mirror.ts` from a job that checks out/executes untrusted PR code; scope `contents: write` to an isolated post-build job only). A `GITHUB_REF` allowlist guard is added to `publish-mirror.ts` (Step 6.2) as labeled defense-in-depth, explicitly documented as NOT closing the direct-`gh`-invocation bypass -- only the workflow-architecture fix in Step 7 does that.

- **Finding S3 (Medium):** the server's bind interface was unspecified; defaulting to all-interfaces would expose the write-capable CI sidecar to co-tenant processes.
  - **Disposition:** addressed
  - **Rationale:** Step 1/6 now mandates explicit loopback-only binding (`127.0.0.1`/`::1`).

- **Finding S4 (Low):** the local-only shared secret's generation method was unspecified, and "echoed alongside the URL" risked landing in public-repo CI logs.
  - **Disposition:** addressed
  - **Rationale:** Step 6 now mandates `crypto.randomBytes` (a CSPRNG) and specifies writing the secret via `$GITHUB_ENV` (or masking it first) in CI instead of printing it to stdout/job logs.

- **Finding S5 (Medium, added during review, not in original scan):** the `:hash` URL path segment is used unvalidated in temp-file paths and `<hash>.tar.gz` asset names -- a path-traversal risk.
  - **Disposition:** addressed
  - **Rationale:** Step 1 now validates `:hash` against `^[a-f0-9]+$` centrally in `server.ts` before any backend, temp-file, or asset-name use -- closing the traversal risk on both the GET and PUT paths in one place rather than duplicating validation per backend.

- **Finding S6 (Open Question 6):** does the Actions Cache REST API enumeration used by `publish-mirror.ts` ever surface caches written by untrusted PR runs sharing ref scope?
  - **Disposition:** addressed
  - **Rationale:** Resolved via WebSearch: yes, the endpoint returns entries across ALL refs (including PR merge-refs) unless explicitly filtered. Step 6.1 now passes `ref=refs/heads/<default-branch>` to the cache-list call, preventing PR-scoped cache entries from ever being enumerated for promotion into the trusted mirror.

## Key Decisions

- **Blob-store, not tarball-aware server**: pv-1 confirms Nx itself builds/extracts the tar.gz; the server must stay a dumb opaque byte store keyed by hash. Building tar-awareness into the server would duplicate Nx's own logic and risk diverging from it across Nx versions.
- **No manual read-only/read-write flag**: backend selection is driven entirely by `GITHUB_ACTIONS` presence (step 5), because a manual flag is one more thing a CI config or a developer can set wrong, and the correct mode is always mechanically derivable from the runtime context.
- **GitHub Release-asset mirror over git-orphan-branch and GHCR/OCI**: settled per the user's explicit follow-up allowing Octokit/`gh` CLI. No repo-history growth (unlike a git-mirror branch), no new registry/auth story (unlike GHCR/OCI), and release assets are natively replaceable (`--clobber`) so there's no cleanup/GC concern to defer.
- **Octokit primary for local reads, `gh` CLI primary for CI writes (environment-based split, not fallback)**: settled per the user's explicit resolution of review Question F7. Octokit (`@octokit/rest`) is a real bundled dependency because `gh` isn't guaranteed on developer machines; `gh` is used in CI because it's already preinstalled and pre-authenticated there. Resolves review Suggestion F6 (dual-path complexity) by giving each tool a distinct, non-overlapping justification instead of one being an uncertain fallback for the other.
- **Monthly shard tags (`cache-mirror-<yyyymm>`) instead of one unbounded release**: resolves review Finding F1 (GitHub's hard 1000-asset-per-release cap) without a manifest/index file, which would itself be a new write-coordination surface needing its own trust gating. The read path's 2-shard (current + prior month) search bound relies on the 30-day cleanup window (step 9) -- a hash cannot realistically live in any older shard. Accepted edge case: a hash cached late in month N whose shard gets pruned at 30 days yields a cache miss (rebuild), not corruption -- documented in step 4, not treated as a bug.
- **Idempotent shard creation (attempt-create-catch-exists), not check-then-create**: resolves review Finding F4. A check-then-create pattern (`get-by-tag`, then `create` if missing) has a TOCTOU race between concurrent CI matrix jobs; attempting create and catching "already exists" is race-safe by construction.
- **Full pagination on every release-asset list call**: resolves review Finding F3. Sharding (F1's fix) keeps each shard's page count small, but the listing code itself must still paginate exhaustively -- a single-page read would silently miss older assets within even a modest-sized shard.
- **F5 (double compression) accepted as documented overhead, not fixed in code**: `@actions/cache`'s only public/documented API always re-archives given paths; bypassing it to talk to GitHub's internal cache service directly would trade a bounded, modest CPU cost for an undocumented-API dependency -- worse than the problem it would solve.
- **Local-only auth secret instead of a GitHub-issued token**: since the server is a private localhost sidecar and never receives traffic from outside the machine/job, there is no security benefit to routing a "real" credential through `NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN` -- risk of over-engineering an auth scheme Nx's own protocol doesn't require us to have.
- **Revised during execution (empirical contradiction, pv-1/Step 3): `@actions/cache`'s public `saveCache`/`restoreCache` are best-effort by design and cannot surface a distinguishable write-denied signal.** Verified against `actions/toolkit` source (`packages/cache/src/cache.ts`): both functions catch `ReserveCacheError`/`CacheWriteDeniedError`/`CacheReadDeniedError` internally, log via `core.warning`/`core.info`, and return a plain sentinel (`saveCache` -> `-1`, `restoreCache` -> `undefined`) for _any_ reservation or policy failure -- "already exists" (should be 409) and "write denied by read-only token" (should be 403) are indistinguishable from the return value; only `ValidationError` (bad key/paths) actually throws. This means GitHub's own backend enforcement (pv-5), while real, is **not observable through the documented API** and cannot serve as an in-code backstop as originally framed. `isWriteTrusted(env)` in `trust.ts` -- which runs and rejects with 403 _before_ `saveCache` is ever called -- is therefore the sole practical in-code write gate; GitHub's platform-side enforcement remains a real but silent defense-in-depth layer, not something this plugin's code can detect or branch on. `actions-cache-backend.ts` maps `cacheId === -1` uniformly to HTTP 409 (idempotent "already cached" no-op, consistent with the mirror backend's own catch-and-no-op pattern), not 403. Rejected alternatives: scraping `@actions/core`'s internal log strings for the `cache write denied:` prefix (couples to an undocumented internal message), and bypassing the public API for the internal twirp/reservation client to get real status codes (contradicts the same "only documented way" principle Finding F5's disposition already established, for a bigger reason than F5's CPU-cost tradeoff).
- **Docker/`act` kept strictly test-only, never a runtime dependency**: both the CI server and local mirror client are thin Node/CLI processes that work fine bare; the only genuine gap Docker closes is testing the `@actions/cache` bridge and trust-gate without pushing to real CI. Risk: contributors without Docker simply can't run the `test:act` script -- mitigated by keeping it optional and excluded from the default test/CI targets (step 10).
- **Mirror auto-cleanup is date-based with a popularity floor, not true LRU**: GitHub's Release Asset API has no last-accessed field (pv-10), so "recently used" is honestly scoped down to `download_count` (a lifetime total, not recency) as a delete-protection heuristic. Risk: a genuinely-stale-but-once-popular asset could be kept indefinitely if `minDownloadCountToKeep` is set too low relative to typical counts -- mitigate by defaulting `minDownloadCountToKeep` to 0 (age-only cleanup) and treating the download-count floor as an explicit opt-in, not the default.
- **Cleanup lives only in `publish-mirror.ts`, never in the server's request path**: reusing the same trusted-CI-only script that already writes to the mirror avoids creating a second write-capable code path that would need its own CREEP-style trust gating.
- **Never `--clobber` the mirror; always catch-"already exists"-and-no-op instead**: settled per security review Finding S1. Content-addressed storage must stay immutable per hash -- overwriting is exactly the CREEP impact class the plan exists to prevent, and the plan's own Actions-cache path (409/no-op) already establishes this as the correct pattern; the mirror must match it, not diverge from it.
- **Workflow-level permission scoping (README, Step 7) is the load-bearing fix for the mirror's missing platform-enforced trust boundary, not any in-process check**: settled per security review Finding S2 and advisor guidance. `trust.ts` and the `GITHUB_REF` guard in `publish-mirror.ts` are both defense-in-depth, explicitly documented as insufficient alone -- an attacker with code execution in a write-scoped job can always invoke `gh` directly. This is stated plainly rather than implied, so a future reader doesn't mistake the in-process checks for a complete control.
- **Cache-enumeration must always filter by trusted ref**: settled via WebSearch-verified resolution of the review's Open Question. GitHub's caches-list endpoint is ref-agnostic by default (returns all refs including untrusted PR merge-refs); omitting the filter would let PR-scoped cache entries get promoted into the trusted mirror.
- **Hash validation centralized in `server.ts`, not duplicated per backend**: settled per security review Finding S5. Validating `:hash` against `^[a-f0-9]+$` once, before any backend/temp-file/asset-name use, closes the traversal risk for both GET and PUT without needing the same check re-implemented in each backend.
- **Server binds loopback-only; secret uses a CSPRNG and avoids logs**: settled per security review Findings S3/S4. Both are cheap, mechanical fixes with no design tradeoff -- there was never a reason to bind beyond loopback or use a weak RNG for a value whose only role is authenticating localhost traffic.

## Dependencies

- Steps 1-2 (server skeleton + trust gate) have no external dependencies and can be done first.
- Step 3 (Actions backend) and step 4 (release mirror backend) are independent of each other and can be built in parallel once step 1 defines the backend interface.
- Step 5 (wiring) depends on steps 3 and 4 both existing.
- Step 6 (CLI) depends on step 5.
- Step 7 (README) depends on step 6 being finalized (needs real command names/flags).
- Step 8 (tests) can start alongside steps 1-2 for `trust.ts`, but the server round-trip test needs step 5 complete, the shard-search test needs step 4, and the cleanup test needs step 9.
- Step 9 (mirror auto-cleanup) depends on step 6 (`publish-mirror.ts` must exist to extend).
- Step 10 (`act`+Docker harness) depends on steps 3 and 2 (it exercises the Actions backend and the trust gate) but is otherwise independent of steps 4/9/11 and can be built in parallel with them.
- Step 11 (Validate) runs last, after everything else.

## Verdict

**Verdict axis:** scope: api-correctness

The plan covers correctness of the Nx remote-cache HTTP contract, GitHub Actions cache/git integration, and CREEP mitigation architecture. It does NOT cover a full security audit (use `/lz-security-review` after implementation to validate the trust-gate and mirror-write restrictions adversarially), performance (no perf assertions on tarball transfer size/latency), or accessibility (not applicable to a server/CLI). The repo-visibility question is now resolved (public, verified via `gh repo view`); both the mirror mechanism (GitHub Release assets) and its auth mode (anonymous reads) are settled. All 5 findings plus the Suggestion/Question from the prior `/lz-review` pass are now addressed per Findings Disposition above (F1/F2/F3/F4/F6/F7 fixed in the plan, F5 explicitly accepted as a documented tradeoff) -- a follow-up `/lz-review` pass after implementation is still recommended to confirm the sharding scheme lands as designed. All 4 findings plus the Open Question from the subsequent `/lz-security-review` pass (S1-S4, S6) are now addressed per Findings Disposition above; S2's fix is partly a documentation/workflow-architecture requirement (Step 7) rather than pure code, so a follow-up `/lz-security-review` after implementation should specifically verify the shipped CI workflow example actually isolates untrusted-code-checkout jobs from the `contents: write`-scoped publish job, not just that the plugin's own code is correct in isolation.
