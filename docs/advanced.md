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
GitHub Release (`cache-mirror-YYYYMM`) can be read from anywhere with repository
read access.

**The reader is automatic -- there is nothing to enable in code.** The backend is
chosen from runtime context: on a trusted CI trigger with a resolvable token the
server serves the writable Actions-cache backend; in every other context (a
developer machine, a fresh runner, an untrusted trigger) it serves the read-only
Releases **reader** instead. The reader is read-only by construction -- a local
`put()` always returns `403`.

What it needs from you:

- **Your own GitHub authentication.** Local reads have no anonymous path -- the
  reader resolves a token from `GH_TOKEN` / `GITHUB_TOKEN`, then `gh auth token`,
  then the git credential helper, and MISSES if none resolve. See
  [No default local read](configuration.md#no-default-local-read).
- **A populated store.** The reader only finds entries that the publish/sync
  layer below has mirrored.

Every read fault degrades to a MISS (a rebuild), never a wrong result.

## Publish / sync and cleanup

These are the maintenance layers that keep the Releases store populated and
bounded. They are opt-in and run in CI, not on a developer machine.

- **Publish / sync.** Enumerates the repository's `nx-cache-*` Actions-cache
  entries, restores the ones the current OS can restore, and uploads them to the
  current month's `cache-mirror-YYYYMM` Release. It is gated by a **separate**
  sync allowlist (`isSyncTrusted`: `push` / `schedule` on the default branch),
  never by the write gate -- widening write-trust must never widen sync, or a
  pull-request-influenced entry could reach the shared store. It needs
  `contents: write` (create the release and upload assets) and `actions: read`
  (enumerate the cache).
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
- run: |
    # Pin the port and bearer token BEFORE backgrounding: with PORT unset the
    # server binds a random ephemeral port, and with the token unset it mints a
    # fresh CSPRNG one -- either mismatch makes the Nx client MISS every read.
    # Exporting both here means serve() adopts them, so the values written to
    # GITHUB_ENV for the next step match what the server actually listens on.
    export PORT=3000
    export NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN="$(openssl rand -hex 32)"
    npx @op-nx/github-cache &
    {
      echo "NX_SELF_HOSTED_REMOTE_CACHE_SERVER=http://127.0.0.1:${PORT}"
      echo "NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN=${NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN}"
    } >> "$GITHUB_ENV"
- run: npx nx affected -t build test
```

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
