# Codebase Concerns

**Analysis Date:** 2026-07-17

## Tech Debt

**`gh` CLI stderr text-matching sentinels:**
- Issue: publish-mirror discriminates gh failures by matching human-readable stderr text (`GH_ALREADY_EXISTS_PATTERN = /already exists/i`, `GH_NOT_FOUND_MARKER = 'HTTP 404'`) because gh gives no structured exit codes for these conditions
- Files: `packages/op-nx-github-cache/src/bin/publish-mirror.ts` (lines 22-23, used in `ensureShardExists`, `uploadHash`, `getReleaseId`)
- Impact: a gh version that rewords these messages silently changes behavior -- an "already exists" upload becomes a thrown error (failed mirror run), or a 404 becomes a rethrown fault (cleanup aborts a shard). Acknowledged in a code comment; both sentinels are hoisted to one place
- Fix approach: replace gh CLI calls with Octokit (already a dependency via `@octokit/rest`, and `release-mirror-backend.ts` already discriminates 404 structurally via `error.status`). Trade-off: gh handles auth/pagination for free; Octokit needs explicit token plumbing in the publish jobs

**Duplicated TRUSTED_EVENTS list:**
- Issue: the trusted-write-event set exists twice -- once in the library, once copied into the composite action (which cannot import from `src/` because it must run pre-build with Node built-ins only)
- Files: `packages/op-nx-github-cache/src/lib/trust.ts` (lines 5-21), `start-cache-server/index.cjs` (lines 12-21)
- Impact: adding/removing an event in one place silently diverges the action's start-gate from the server's write-gate. Failure is safe-direction (server still refuses writes) but confusing: the action starts a server whose writes all 403, or skips starting on an event the server would trust
- Fix approach: a build step that generates the action's copy from `trust.ts`, or a comment-anchored lint check. Both files already carry "keep in sync" comments -- lowest-cost option is a selfcheck assertion comparing the two sets

**Fully-buffered request/response bodies:**
- Issue: the server buffers an entire PUT body in memory before any backend call (`readBody`, capped at 2 GB default) and buffers whole GET responses (`Buffer.from(response.data)` in the mirror backend; `readFile` in the Actions backend)
- Files: `packages/op-nx-github-cache/src/lib/server.ts` (lines 69-84, 143-148), `packages/op-nx-github-cache/src/lib/backends/release-mirror-backend.ts` (lines 140-147), `packages/op-nx-github-cache/src/lib/backends/actions-cache-backend.ts`
- Impact: concurrent large cache entries can spike memory on small runners (GitHub-hosted runners have 7-16 GB). `MAX_CACHE_BODY_BYTES` bounds the worst case per request, not aggregate
- Fix approach: stream PUT bodies to the temp file and GET responses from disk/HTTP. Only worth doing if real workspaces produce multi-hundred-MB task outputs; typical Nx tarballs are far below the danger zone

**`@actions/cache` -1 sentinel collapse:**
- Issue: `saveCache` returns -1 for both "entry already exists" and "write denied by read-only token"; the backend maps both to `'conflict'` (409). Marked with a `ponytail:` comment
- Files: `packages/op-nx-github-cache/src/lib/backends/actions-cache-backend.ts` (lines 52-61, 94-98)
- Impact: a systematically denied write (e.g. token policy change) is indistinguishable from the benign idempotent-write case in server responses; only `trust.ts` gating keeps this from masking a real outage
- Fix approach: none available through the public `@actions/cache` API -- it catches the distinguishing errors internally. Document-and-accept (already done); revisit if `@actions/cache` ever exposes structured results

**In-process per-hash lock assumes a single server instance:**
- Issue: same-hash GET/PUT serialization uses an in-process `Map` of promise chains; the shared deterministic temp path (`cacheArchivePath`) is only protected within one process
- Files: `packages/op-nx-github-cache/src/lib/backends/actions-cache-backend.ts` (lines 21-50)
- Impact: running `serve` and `publish-mirror` concurrently on the same host (or two `serve` processes) can interleave writeFile/rm/restoreCache on the same path -- truncated reads. Safe in the documented deployment (separate ephemeral runner VMs per job)
- Fix approach: documented as a known limitation in `packages/op-nx-github-cache/README.md` ("Known limitation" section). If self-hosted shared runners become a target, move staging to per-process directories with the deterministic path only at save/restore time -- but note `@actions/cache` version-hashes the literal path strings, so any path change breaks restore compatibility with existing entries

## Known Bugs

**None detected (open).** Two recently resolved issues are worth knowing because their failure mode is silent:

**Cross-OS publish-mirror gap (RESOLVED 2026-07-17):**
- Symptoms: Windows-saved Actions-cache entries (the OS-sensitive `integration` hash) never appeared in the Release mirror; local Windows mirror reads missed
- Files: `.github/workflows/ci.yml` (publish-mirror job), `packages/op-nx-github-cache/src/bin/publish-mirror.ts` (`uploadHash`'s `if (!hit) return` skip)
- Trigger: `@actions/cache`'s version hash folds in the OS temp path, a `windows-only` salt, and the compression method (windows-11-arm lacks zstd), so an ubuntu job can never restore a Windows-saved entry
- Resolution: publish-mirror is now a per-OS matrix (`ubuntu-24.04-arm`, `windows-11-arm`); each leg mirrors only its own OS's entries. Regression risk: any future "simplify the matrix back to one OS" change silently reopens this -- `uploadHash` treats an unrestorable entry as "evicted; skip" with no error

**CRLF hash divergence on Windows CI (RESOLVED):**
- Resolution: `.gitattributes` forces `* text=auto eol=lf` so Nx content hashes match across OS checkouts. Deleting or weakening that file silently breaks every cross-OS cache hit

## Security Considerations

**Write trust gate is spoofable env, by design:**
- Risk: `isWriteTrusted()` keys off `GITHUB_EVENT_NAME`/`GITHUB_ACTIONS`, which a fork PR controls in its own workflow file
- Files: `packages/op-nx-github-cache/src/lib/trust.ts`, `packages/op-nx-github-cache/src/lib/server.ts` (line 154)
- Current mitigation: documented as defense-in-depth only; the load-bearing control is GitHub's server-side read-only cache token for untrusted triggers (since 2026-06-26), plus workflow-level permission isolation (`contents: write` only on the isolated publish-mirror job). The assumption and its GHES caveat are spelled out in `packages/op-nx-github-cache/README.md`
- Recommendations: none needed for github.com. If this package is ever documented for GHES, add an explicit version floor for the read-only-token enforcement

**Predictable shared temp path on persistent runners:**
- Risk: `cacheArchivePath()` is a fixed, predictable path under `os.tmpdir()`; on a persistent multi-tenant self-hosted runner a co-tenant could pre-create it as a symlink and turn a cache write into an arbitrary-file overwrite
- Files: `packages/op-nx-github-cache/src/lib/backends/actions-cache-backend.ts` (lines 17-19)
- Current mitigation: documented deployment is ephemeral single-tenant GitHub-hosted runners (unaffected); README warns against shared persistent runners
- Recommendations: keep the README warning prominent if the package is published; the deterministic path is load-bearing for `@actions/cache` version matching, so it cannot simply be randomized

**HASH_PATTERN mirrors any hex-shaped cache key:**
- Risk: `filterNxCacheKeys` admits any 1-512-char lowercase-hex Actions-cache key, including entries created by unrelated workflow steps whose keys happen to be pure hex; those get published as public Release assets
- Files: `packages/op-nx-github-cache/src/lib/types.ts` (line 9), `packages/op-nx-github-cache/src/bin/publish-mirror.ts` (lines 85-90)
- Current mitigation: path-traversal and injection shapes are excluded (unit-tested in `packages/op-nx-github-cache/src/bin/publish-mirror.spec.ts`); Actions-cache content in a public repo's default branch is already effectively public
- Recommendations: acceptable for public repos. If ever used on a private repo, note that publish-mirror re-publishes cache content as Release assets with the repo's release visibility

**`shell: true` execution of the `command` input in both actions:**
- Risk: `INPUT_COMMAND` is spawned through a shell in both composite actions
- Files: `start-cache-server/index.cjs` (line 103), `publish-mirror/index.cjs` (line 54)
- Current mitigation: the input is workflow-author-controlled; anyone who can set it already has code execution in the job. Not a trust boundary
- Recommendations: none

## Performance Bottlenecks

**Sequential per-hash mirror upload:**
- Problem: `main()` restores and uploads hashes one at a time (`for...await uploadHash`); cleanup similarly walks shards and deletes assets serially
- Files: `packages/op-nx-github-cache/src/bin/publish-mirror.ts` (lines 410-419, 285-306)
- Cause: simple loop; each hash is a full `restoreCache` download + `gh release upload`
- Improvement path: bounded concurrency (e.g. 4-way) if mirror runs get slow. Current repo has few hashes per run, so serial is fine and avoids rate-limit pressure -- leave until publish-mirror wall time actually matters

**Anonymous mirror reads capped at 60 req/hr:**
- Problem: local `serve` without a token shares GitHub's per-IP anonymous limit; a very large workspace or parallel runs behind one IP can exhaust it
- Files: `packages/op-nx-github-cache/src/lib/backends/release-mirror-backend.ts` (per-shard promise cache, lines 50-114), `packages/op-nx-github-cache/src/lib/backends/index.ts` (line 42, token opt-in)
- Cause: GitHub API policy, not code
- Improvement path: already mitigated -- shard asset lists are fetched once per process and rate-limit faults degrade to cache misses (`server.ts` GET catch). `GH_TOKEN`/`GITHUB_TOKEN` lifts to 5000/hr. Documented in the README

## Fragile Areas

**`publish-mirror.ts` gh orchestration:**
- Files: `packages/op-nx-github-cache/src/bin/publish-mirror.ts` (`ensureShardExists`, `uploadHash`, `getReleaseId`, `listShardAssets`, `cleanupShard`, `resolveTrustedRepo`)
- Why fragile: layers three brittle contracts -- gh stderr text matching, gh's `-f`-flips-method-to-POST behavior (`actionsCachesListArgs` forces `-X GET` for exactly this reason), and `@actions/cache`'s literal-path version hashing. Failure modes are silent skips, not errors
- Safe modification: never change `cacheArchivePath` or the paths passed to `restoreCache`/`saveCache` without re-verifying an end-to-end restore (the act harness or a real CI run); keep new gh calls' error discrimination next to the hoisted sentinels; extract any new decision logic as a pure function with a spec, matching the existing `filterNxCacheKeys`/`planShardCleanup` pattern
- Test coverage: only the extracted pure helpers are unit-tested (`packages/op-nx-github-cache/src/bin/publish-mirror.spec.ts`); the gh I/O paths run only in real CI

**`start-cache-server/index.cjs` platform-split detached stdio:**
- Files: `start-cache-server/index.cjs` (lines 97-110, 128-136)
- Why fragile: POSIX inherits the child's stdout (so `::add-mask::` reaches the runner); Windows must NOT inherit (the runner closing the step pipe kills the detached server -- verified on windows-11-arm) and instead logs to a temp file and re-registers the mask by parsing `$GITHUB_ENV`. Two coupled workarounds that look removable but are each load-bearing on one platform
- Safe modification: run `node start-cache-server/selfcheck.cjs` on both platforms (CI does this via the `windows-selfcheck` job in `.github/workflows/ci.yml`); the selfcheck's case 1 specifically asserts the detached server survives and the mask reaches the console
- Test coverage: selfcheck covers gate/guard/survival; the Windows temp log file (`op-nx-cache-server-<pid>.log`) is never cleaned up -- harmless on ephemeral runners, cosmetic debt

**Early server responses leave the request body unconsumed:**
- Files: `packages/op-nx-github-cache/src/lib/server.ts` (401 at line 107, 403 at line 156, 400 at line 116)
- Why fragile: only the 413 path explicitly destroys the socket to avoid keep-alive misparsing unread body bytes; 401/403/400 on a PUT respond without reading the body and rely on Node's default connection teardown. Fine with the Nx client today, but a future keep-alive-heavy client could surface confusing connection resets
- Safe modification: if this ever bites, apply the same `req.destroy()` treatment the PayloadTooLargeError path uses (its comment explains the failure mode)
- Test coverage: `server.integration.spec.ts` (10 tests) exercises real sockets; no test asserts connection reuse after an early rejection

**Mirror read window / retention window coupling:**
- Files: `packages/op-nx-github-cache/src/lib/shard.ts` (shared `resolveMaxAgeDays`/`shardTagsForWindow`), `packages/op-nx-github-cache/src/lib/backends/release-mirror-backend.ts`, `packages/op-nx-github-cache/src/bin/publish-mirror.ts`
- Why fragile: "how long assets are kept" and "how far back reads look" must resolve identically from `CACHE_MIRROR_MAX_AGE_DAYS`, and cleanup runs in a different workflow (`.github/workflows/mirror-cleanup.yml`) than serve. Setting the env var differently between the cleanup workflow and a local serve makes retained assets unreadable or expired assets linger
- Safe modification: only ever read the window through `resolveMaxAgeDays`; never introduce a second env var or default
- Test coverage: good -- `shard.spec.ts` (10 tests) covers window arithmetic including short-month edge cases; `cleanup.spec.ts` (9 tests) covers the delete-release decision

## Scaling Limits

**1000 assets per month-shard release:**
- Current capacity: one release per calendar month, GitHub caps release assets at 1000
- Limit: a repo producing >1000 unique Nx hashes per month gets failed `gh release upload` calls (surfaced as publish-mirror job failure); there is no sub-sharding or overflow handling
- Scaling path: sub-shard tags (e.g. `cache-mirror-YYYYMM-N`) with the same window-walk on the read side; the read-side shard walk in `release-mirror-backend.ts` and `MIRROR_SHARD_PATTERN` in `publish-mirror.ts` are the two places that encode the tag shape

**2 GB per cache entry:**
- Current capacity: `DEFAULT_MAX_BODY_BYTES` = 2 GB (`packages/op-nx-github-cache/src/lib/server.ts` line 40), matching GitHub's ~2 GiB release-asset ceiling
- Limit: a single task output larger than that gets 413 (and could not be mirrored anyway)
- Scaling path: none needed; Nx task outputs approaching 2 GB indicate a caching-strategy problem upstream

**Actions cache 10 GB repo cap:**
- Current capacity: GitHub natively evicts by 7-day disuse and LRU at the cap
- Limit: entries evicted between save and the next main-push publish-mirror run are silently skipped (`uploadHash`'s no-hit return) and never mirrored
- Scaling path: accept (mirror is best-effort by design), or publish-mirror more often than per-push

## Dependencies at Risk

**`@actions/cache` undocumented internals:**
- Risk: three behaviors this codebase depends on are verified-against-source, not documented API: literal-path version hashing (`cacheArchivePath` determinism), the -1/undefined best-effort sentinels, and the runtime env vars (`ACTIONS_RUNTIME_TOKEN`/`ACTIONS_RESULTS_URL`) being injected only into JS actions. GitHub already churned this service once (v1 -> v2, 2025)
- Impact: an `@actions/cache` major bump can silently break restores (every mirror upload skips) or the action guards
- Migration plan: the act harness (`npm run test:act` in `packages/op-nx-github-cache/package.json`) is the canary -- run it on any `@actions/cache` upgrade before merging. Pinned `^6.2.0` in `packages/op-nx-github-cache/package.json`

**windows-11-arm runner image compression toolset:**
- Risk: the image currently omits zstd (falls back to gzip), which is folded into `@actions/cache`'s version. If GitHub adds zstd to the image, every pre-existing Windows entry stops restoring (version mismatch)
- Impact: transient -- misses rebuild and re-save under the new version; the mirror repopulates on the next main push
- Migration plan: none needed; know the symptom (a wave of Windows cache misses after a runner-image update) so it is not misdiagnosed

**`gh` CLI as a runtime dependency of publish-mirror:**
- Risk: preinstalled on GitHub runners but version-uncontrolled; the stderr text contracts above ride on it
- Impact: publish-mirror/cleanup failures on a gh release that rewords errors
- Migration plan: Octokit (already a dependency) -- see the first Tech Debt entry

## Missing Critical Features

**No true-LRU retention for the mirror:**
- Problem: retention is age-only (`created_at`); GitHub's Release Asset API exposes no last-accessed signal, so a hot entry older than `CACHE_MIRROR_MAX_AGE_DAYS` is deleted and rebuilt
- Blocks: nothing today (30-day window is generous). The single-writer daily cleanup workflow (`.github/workflows/mirror-cleanup.yml`) is deliberately the home for a future manifest with read-modify-write state, per the comment in `packages/op-nx-github-cache/src/bin/publish-mirror.ts` (line 378)

**Mid-session mirror staleness:**
- Problem: `serve` caches each shard's asset list for the process lifetime; a hash published after startup is invisible until restart (extra miss, never a wrong result)
- Blocks: nothing -- explicitly accepted trade-off (`packages/op-nx-github-cache/src/lib/backends/release-mirror-backend.ts` lines 51-58) to stay under the anonymous rate limit

## Test Coverage Gaps

**publish-mirror gh I/O orchestration:**
- What's not tested: `ensureShardExists`, `uploadHash`, `getReleaseId`, `listShardAssets`, `cleanupShard`, `cleanupMirror`, `resolveTrustedRepo` -- everything that actually shells out to gh
- Files: `packages/op-nx-github-cache/src/bin/publish-mirror.ts`
- Risk: a regression in error discrimination or the upload/skip flow ships silently; the failure mode in production is "mirror quietly missing entries," which took a real investigation to catch once already (see the resolved cross-OS gap)
- Priority: High -- at minimum, a mocked-`execFile` spec asserting the already-exists/404/other-error branching per sentinel

**`src/bin/publish-mirror-cleanup.ts`:**
- What's not tested: the bin has no spec (the logic it wires -- `cleanupMirror`, `planShardCleanup` -- is tested; the failure-aggregation-to-throw wrapper is not)
- Files: `packages/op-nx-github-cache/src/bin/publish-mirror-cleanup.ts`
- Risk: low (34-line wrapper), but it is the entirety of a scheduled workflow's behavior
- Priority: Low

**`selectBackend`:**
- What's not tested: no spec references `selectBackend` -- backend selection (CI vs local, GITHUB_REPOSITORY validation, token fallthrough `||` semantics) is untested
- Files: `packages/op-nx-github-cache/src/lib/backends/index.ts`
- Risk: the `GH_TOKEN || GITHUB_TOKEN` empty-string fallthrough and malformed-repo rejection carry documented subtle intent that a refactor could silently invert
- Priority: Medium -- pure function of env, cheap to spec

**`actions-cache-backend` unit coverage:**
- What's not tested: only an integration spec exists (`actions-cache-backend.integration.spec.ts`, 7 tests); stale `out-tsc/` artifacts suggest a unit spec was removed. The real `@actions/cache` round-trip runs only via the opt-in act harness (`npm run test:act`), never in default CI
- Files: `packages/op-nx-github-cache/src/lib/backends/actions-cache-backend.ts`
- Risk: the per-hash lock's chaining/eviction logic (`withHashLock`) has subtle promise bookkeeping; a regression shows up as rare truncated reads under concurrency
- Priority: Medium -- a concurrency-focused unit spec for `withHashLock` would close the sharpest edge

---

*Concerns audit: 2026-07-17*
