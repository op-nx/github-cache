# Advanced usage

The [quickstart](../README.md#quickstart-5-minutes) is the whole product for most
adopters: a read-write GitHub Actions cache in CI, with nothing to host. This
guide covers the opt-in layers on top of it -- the cross-context GitHub Releases
read store, the publish/sync and cleanup that maintain it -- and the `&` fallback
for runners without the background-step engine.

## The opt-in GitHub Releases read store

The default Actions-cache backend is scoped to a repository's Actions cache,
which is not shared with a developer's machine and is capped at 10 GB
([Configuration](configuration.md#two-limits-to-know-about)). The GitHub Releases
store is a second, cross-context layer: cache entries mirrored to a monthly
GitHub Release (`nx-cache-YYYYMM`) can be read from anywhere with repository
read access.

### How the backend is selected

**The backend is chosen from runtime context -- there is nothing to enable in
code (D-01/TRUST-05).** `selectBackend` has FIVE outcomes, not a binary
read-write-versus-reader switch:

| Context                                                                                                   | Backend                                 | Observable behavior                                                                                   |
| --------------------------------------------------------------------------------------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Untrusted (a developer machine, a fresh runner, an untrusted trigger)                                     | read-only GitHub Releases **reader**    | reads resolve from the mirror; the server answers every `PUT` with `403`                              |
| Trusted, but `GITHUB_REPOSITORY` is malformed                                                             | none -- it **throws**                   | fail-closed: the server does not start, rather than resolve into another repository's cache namespace |
| Trusted, valid identity, but no resolvable token                                                          | an **empty read-only memory backend**   | **every read is a permanent MISS and every `PUT` a `403`, silently -- no error**                      |
| Trusted, valid identity, resolvable token                                                                 | the writable **Actions-cache backend**  | full read-write caching                                                                               |
| Trusted, valid identity, resolvable token, plus [`CACHE_READ_ONLY`](configuration.md#cache_read_only) set | the read-only **Actions-cache backend** | reads resolve from the real Actions cache; the server answers every `PUT` with `403`                  |

A read-only backend has **no `put()` at all** -- a write is unrepresentable rather
than a runtime error value, and the `403` is produced by the server at the protocol
boundary. So do not implement `put()` returning `'forbidden'` when supplying your
own reader: `PutResult` is `'stored' | 'conflict'`, and a `'forbidden'` return does
not typecheck.

The third row is the one adopters actually hit: a trusted CI trigger with no
`GH_TOKEN` / `GITHUB_TOKEN` wired does not fail -- it degrades to an empty backend
that MISSes every read, with every `PUT` answered `403` and no error raised, so a
"cache that never hits" on CI usually means a missing token, not a bug.

What it needs from you:

- **Your own GitHub authentication.** Local reads have no anonymous path -- the
  reader resolves a token from `GH_TOKEN` / `GITHUB_TOKEN`, then `gh auth token`,
  then the git credential helper, and MISSES if none resolve. See
  [No default local read](configuration.md#no-default-local-read).
- **A populated store.** The reader only finds entries that the publish/sync
  layer below has mirrored.

Every read fault degrades to a MISS (a rebuild), never a wrong result.

That covers read **faults**, and it carries one precondition: a cached task's
outputs must not depend on which OS produced them. The store does not partition
by runner OS, so a task whose output genuinely differs per OS has to declare that
difference as an Nx input -- this repo's `integration` target carries a platform
discriminator for exactly that reason.

## Publish / sync and cleanup

These are the maintenance layers that keep the Releases store populated and
bounded. They are opt-in and run in CI, not on a developer machine.

Sharing one store across operating systems has its own recipe -- see
[Cross-OS caching](cross-os.md) for the safe default and the checklist that earns
a per-target exception.

- **Publish / sync.** Enumerates the repository's `nx-cache-*` Actions-cache
  entries, restores them, and uploads them to the current month's
  `nx-cache-YYYYMM` Release. **Restore is not same-OS.** From v0.0.2 the
  archive path is a workspace-relative literal and the cross-OS archive flag is
  set, so the `@actions/cache` cache version no longer partitions by runner OS
  and a leg can restore an entry that was saved on another OS. Two legs are still
  worth running, for a different reason: each leg is still the only place its own
  OS's tasks **run**, because a target that touches real OS surface declares a
  platform discriminator that keeps its Linux and Windows Nx task hashes distinct
  (this repo's `integration` target is that case). Both legs may now reach the
  same entry, which is harmless -- uploads are first-write-wins and the asset set
  is byte-identical. The per-leg mirrored asset counts can still differ, since
  either leg may reach a given entry first and the totals also include seed
  assets, so an asymmetry is not by itself a bug.

  **Bumping this action can cost you one all-MISS publish.** Anything that
  changes the `@actions/cache` cache version -- the archive path literal above
  all -- rotates it for every entry already sitting in the Actions cache, so the
  first publish run after such a bump restores everything as a MISS and mirrors
  nothing. That is expected **once per version-affecting change**, and the
  warning it emits names the axis (the `@actions/cache` cache version, which is
  a separate mechanism from the Nx task hash and from the Release asset name)
  along with the two causes worth checking. Two consecutive all-miss runs with no
  version-affecting change in between is the signal that something else is wrong
  -- most likely the runtime token's Actions-cache read scope.

  **Upgrading to v0.0.2 rotates the Release asset name too, on top of the cache
  version.** The name dropped its OS component: an asset that was
  `<hash>-<os>` is now `nx-cache-<hash>`. The reader derives the new name only
  and has no fallback to the old one, so on the first run after the upgrade
  **every asset mirrored before v0.0.2 reads as a MISS** and stays that way until
  it is re-mirrored under the new name. Nothing is lost and nothing is wrong:
  the old assets remain prunable -- cleanup accepts both shapes -- and age out
  through the normal retention window. This is a one-time cost at the upgrade,
  and it is a second axis from the cache-version rotation above; the two land in
  the same run, so expect one all-MISS publish, not two.

  It is gated by a **separate** sync allowlist (`isSyncTrusted`: `push` /
  `schedule` on the default branch), never by the write gate -- widening
  write-trust must never widen sync, or a pull-request-influenced entry could
  reach the shared store. It needs `contents: write` (create the release and
  upload assets) and `actions: read` (enumerate the cache). **Publish must not
  share a job with a running sidecar** -- both resolve the same deterministic
  temp archive path per cache entry, and the per-hash lock that protects it is
  in-process only. **Nor may two publish legs run concurrently against the same
  month shard** -- the 1000-asset cap is a soft per-leg check, so concurrent
  legs can both observe the shard under the cap and push it over; this
  repository's own CI enforces it with `max-parallel: 1`.

- **Cleanup.** Prunes mirror assets older than
  [`CACHE_MIRROR_MAX_AGE_DAYS`](configuration.md#cache_mirror_max_age_days) from
  the month-shard Releases. It is **storage hygiene, not poison-containment** --
  it bounds growth, it does not contain a poisoned entry (see
  [Trust and security](trust-and-security.md)). It needs `contents: write`.

In this pre-1.0 release the default CI-RW quickstart is the primary supported
consumer path; the Releases mirror is the opt-in layer on top. Publish and
cleanup ship in the package (`publish/publish-mirror.ts`, `cleanup/`) and are
exercised end to end by this repository's own CI as the reference implementation.
Their trust requirements above are load-bearing regardless of how you wire them:
publish must run on the JS-action runtime (see below), and sync stays gated by
`isSyncTrusted`.

## The `&` fallback (older runners and GHES)

The quickstart uses GitHub's native background-step keywords (`background: true`
with a `cancel:` teardown). On a runner or GHES release that predates the
background-step engine, background the server with a shell `&` instead:

```yaml
# shell: bash is REQUIRED, not stylistic. This step uses export, $(...), & and
# >> "$GITHUB_ENV" -- on a Windows runner the default shell is pwsh, which fails
# on every one of them. Redundant on ubuntu; harmless there, load-bearing here.
- shell: bash
  run: |
    # Pin the port and bearer token BEFORE backgrounding: with PORT unset the
    # server binds a random ephemeral port, and with the token unset it mints a
    # fresh CSPRNG one -- either mismatch makes the Nx client MISS every read.
    # Exporting both here means serve() adopts them, so the values written to
    # GITHUB_ENV for the next step match what the server actually listens on.
    export PORT=3000
    # node, not openssl to mint the token: openssl may be absent from a Windows
    # runner's Git Bash, while node is guaranteed present wherever the sidecar
    # runs -- and `npx @op-nx/github-cache` below already requires it.
    export NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN="$(node -e 'process.stdout.write(require("crypto").randomBytes(32).toString("hex"))')"
    # Mask the token BEFORE it is written to GITHUB_ENV below, so it is redacted
    # from every later log line, not only from inside the sidecar process.
    echo "::add-mask::${NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN}"
    npx @op-nx/github-cache &
    {
      echo "NX_SELF_HOSTED_REMOTE_CACHE_SERVER=http://127.0.0.1:${PORT}"
      echo "NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN=${NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN}"
    } >> "$GITHUB_ENV"
# Poll until an authed GET on an unknown hash returns 404 or 200 before the Nx
# step -- see the readiness poll in the quickstart.
- run: npx nx affected -t build test
```

The `&` form has the same startup race as the native background step: the next
step's Nx run can begin before the backgrounded server has bound the port, so
copy the readiness poll from [the quickstart](../README.md#quickstart-5-minutes)
in between. Bound the job with `timeout-minutes` there too.

**The `&` fallback serves the read-only Releases reader path ONLY. It is NOT a
substitute for the read-write Actions-cache backend.** A plain `run:` step -- and
therefore anything you background with `&` inside it -- does not receive
`ACTIONS_RUNTIME_TOKEN` (nor `ACTIONS_RESULTS_URL`); those are injected only into
a JS-action runtime. Without them the Actions-cache `save` / `restore` calls
**silently no-op**: no error, just a cache that never stores anything and MISSes
every time. Read-write caching therefore always requires the JS action
(`start-cache-server`). Use `&` only where read-only Releases reads are enough.

## Why the sidecar is a JS action, not composite

`start-cache-server` is a Node (`node24`) JS action, and this is deliberate:

- **`ACTIONS_RUNTIME_TOKEN` reaches it.** A JS action runs with the Actions
  runtime token in its environment, which the child `serve` process inherits.
  That token is what lets the writable Actions-cache backend actually store and
  restore bytes (the `&` fallback lacks it -- see above).
- **A composite action cannot declare `background:` internally.** GitHub does not
  allow `background:` on steps _inside_ a **composite** action; a composite
  action can itself be run as a background step, but it cannot declare background
  steps of its own. The sidecar has to keep a process alive across later steps,
  so it must be a JS action the consumer marks `background: true`, not a
  composite that tries to background a step internally.
