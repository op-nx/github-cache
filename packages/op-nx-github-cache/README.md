# @op-nx/github-cache

A self-hosted Nx remote cache server built on GitHub-native storage: GitHub
Actions cache in CI (read-write), and an anonymous, read-only GitHub Release-
asset mirror for local development. No separate cache infrastructure to run
or pay for.

## How it works

- **In CI (`GITHUB_ACTIONS=true`)**: the server bridges Nx's HTTP cache
  protocol to `@actions/cache`'s `saveCache`/`restoreCache`, using the Nx task
  hash as the cache key. Read-write.
- **Locally**: the server reads from a GitHub Release-asset mirror
  (`cache-mirror-<yyyymm>`, sharded by calendar month), populated by a
  separate trusted-CI-only publish step. Read-only: `PUT` always returns
  `403`. Since this repo is public, local reads are anonymous; no token setup
  needed.
- **CREEP mitigation**: writes are additionally gated by `isWriteTrusted()`,
  which only allows GitHub Actions' own trusted trigger events (`push`,
  `schedule`, `workflow_dispatch`, `repository_dispatch`, `delete`,
  `registry_package`, `page_build`, `merge_group`). A PR-triggered run
  (`pull_request` / `pull_request_target`) can never write to either the
  Actions cache or the mirror through this server. `pull_request` runs still
  read the cache (GET is always allowed); only the PUT is refused with `403`.
  Nx treats a refused cache store as a non-fatal warning (its native HTTP cache
  `store()` reports failure by return value, not by throwing), so PR builds
  still pass -- `npm run test:act:untrusted` exercises this end to end.

> **Why this holds, and its one assumption.** `isWriteTrusted()` keys off
> `GITHUB_EVENT_NAME`, which a fork `pull_request` can set itself (it controls
> its own workflow file), so this in-process gate is defense-in-depth, not a
> boundary. The load-bearing control against a spoofed event is GitHub's own
> server-side cache token: since 2026-06-26 GitHub issues a **read-only** cache
> token to untrusted triggers, so `@actions/cache`'s `saveCache` is denied at
> the service regardless of what `isWriteTrusted()` returns. This posture
> therefore assumes a GitHub deployment that ships that enforcement (github.com,
> or a GHES / data-residency version new enough to have it). On an older runner
> talking to a cache service without it, the env-spoof would flip both the gate
> and the token open -- so keep untrusted PR code out of any job that can reach
> a write-scoped token, exactly as the mirror guidance below already requires.

## Prerequisites

- Node.js + npm to run the `npx` commands below.
- **For `publish-mirror`:** the `gh` CLI, installed and authenticated. GitHub-
  hosted runners preinstall `gh` but do not auto-authenticate it. Set
  `env: GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}` on the step that runs
  `op-nx-github-cache-publish-mirror` (see CI wiring below).
- **For local `serve` usage:** `GITHUB_REPOSITORY=owner/repo` (see
  [Local usage](#local-usage)).
- **For the opt-in `act`-based test harness:** Docker + `act` (see
  [below](#act-based-local-integration-test-harness-opt-in-test-only)).

## CI wiring

```yaml
jobs:
  build:
    # Untrusted-code-safe: no write permissions, may check out PR code.
    permissions:
      contents: read
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - name: Start cache server
        run: |
          npx op-nx-github-cache-serve &
          timeout 10 bash -c 'until grep -q NX_SELF_HOSTED_REMOTE_CACHE_SERVER "$GITHUB_ENV" 2>/dev/null; do sleep 0.2; done'
      - run: npx nx affected -t build test

  publish-mirror:
    needs: build
    if: github.ref == 'refs/heads/main'
    # Isolated job: only this job holds contents: write, and it never checks
    # out/executes untrusted PR code. This is the load-bearing control, not
    # the in-process trust.ts/GITHUB_REF checks (which are defense-in-depth
    # only and cannot stop an attacker with code execution inside a
    # write-scoped job from calling `gh release upload` directly).
    permissions:
      contents: write
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npx nx build @op-nx/github-cache
      - run: npx op-nx-github-cache-publish-mirror
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

`serve` never exits on its own: `server.listen()` keeps the process alive for
the rest of the job, so the CI step above backgrounds it with `&` and polls
`$GITHUB_ENV` until `serve` has appended its two `NX_SELF_HOSTED_REMOTE_CACHE_*`
vars (GitHub Actions auto-exports those to every later step in the same job,
so `nx affected` picks them up with no further plumbing). Running `serve` in
the foreground instead would hang the step forever.

**MUST:** never invoke `op-nx-github-cache-publish-mirror` from a job that
also checks out or runs untrusted PR-controlled code (no `pull_request_target`
job that also builds PR code, the classic "pwn request" pattern), and grant
`contents: write` only to that isolated post-build job, never workflow-wide.

**MUST:** if you set the optional `DEFAULT_BRANCH` env var (to skip the
`gh repo view` lookup), its value must be a literal you control, never a
GitHub Actions expression interpolating PR-controlled data (e.g. a PR title
or body). `publish-mirror` compares `GITHUB_REF` against it as its
(defense-in-depth-only) ref check. `publish-mirror` also rejects a
`DEFAULT_BRANCH` containing whitespace or control characters outright.

**Known limitation:** the Actions-cache backend and `publish-mirror` both
stage a hash's archive at the same deterministic per-hash temp path (required
so `@actions/cache` can match a save to a later restore, see
`cacheArchivePath`'s doc comment), serialized only within one process via an
in-process lock. This is safe in the CI wiring above, where `build` and
`publish-mirror` are separate jobs on separate (ephemeral, GitHub-hosted)
runner VMs. It is NOT safe if you run `serve` and `publish-mirror` concurrently
on the same self-hosted runner host, so don't do that. For the same reason (the
per-hash temp path under `tmpdir()` is predictable and shared), avoid a
persistent runner shared with untrusted jobs: a co-tenant could pre-create that
path as a symlink and turn a cache write into an arbitrary-file overwrite.
Ephemeral, single-tenant GitHub-hosted runners -- the documented deployment --
are unaffected.

## How Nx targets this server

This server implements Nx's [self-hosted remote cache](https://nx.dev/docs/guides/tasks--caching/self-hosted-caching)
contract: `PUT`/`GET /v1/cache/{hash}`, bearer-token auth on every request. Two
env vars wire Nx to it, both exactly what `serve` prints/exports above:

- `NX_SELF_HOSTED_REMOTE_CACHE_SERVER`: the server's base URL.
- `NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN`: the bearer token Nx sends on
  every request, GET included.

The guide also documents `NODE_TLS_REJECT_UNAUTHORIZED=0` to disable TLS
certificate validation. That doesn't apply here, since this server only ever
binds to `127.0.0.1` over plain HTTP.

## Local usage

```bash
npx op-nx-github-cache-serve
# prints:
#   export NX_SELF_HOSTED_REMOTE_CACHE_SERVER=http://127.0.0.1:PORT
#   export NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN=...
# eval those, then run nx as usual. Reads hit the public mirror, writes 403.
```

Note: "anonymous" describes the mirror backend's own reads from the public
GitHub repo (no PAT needed there). The local server itself still requires
the printed bearer token on every request, GET included, matching Nx's
self-hosted remote-cache contract. The token is a shared secret between your
own `serve` process and your own `nx` client; it never leaves your machine.

Requires `GITHUB_REPOSITORY=owner/repo` to be set (CI sets this
automatically; set it yourself locally, e.g. `export
GITHUB_REPOSITORY=op-nx/github-cache`). A malformed value (missing the `/`)
is rejected up front with a clear error.

**Rate limits:** the mirror reads the public repo anonymously by default, which
GitHub caps at **60 requests/hour per IP**. Each shard's asset list is fetched
once per `serve` process and cached in-memory, so a normal `nx affected` stays
well under that -- but a very large workspace, or several parallel runs sharing
an IP, can still exhaust it. To lift the cap to 5000/hour, export a token
before `serve`: `GH_TOKEN` (or `GITHUB_TOKEN`) is picked up automatically. When
the limit is hit, cache reads fail _open_ (treated as a miss, build continues),
never as an error.

## Configuration

All optional; sensible defaults apply when unset. A non-numeric, zero, or
negative value on any numeric knob falls back to its default rather than
misbehaving.

| Env var                                   | Applies to                     | Default                | Purpose                                                                   |
| ----------------------------------------- | ------------------------------ | ---------------------- | ------------------------------------------------------------------------- |
| `PORT`                                    | `serve`                        | `0` (random free port) | Port for the loopback cache server.                                       |
| `MAX_CACHE_BODY_BYTES`                    | `serve`                        | `2147483648` (2 GB)    | Max `PUT` body size; larger bodies get `413`.                             |
| `GH_TOKEN` / `GITHUB_TOKEN`               | `serve` (local mirror)         | unset (anonymous)      | Lifts the mirror's read rate limit from 60 to 5000 req/hr.                |
| `GITHUB_REPOSITORY`                       | `serve` (local mirror)         | (required locally)     | `owner/repo` the mirror reads from.                                       |
| `CACHE_MIRROR_MAX_AGE_DAYS`               | `publish-mirror`, mirror reads | `30`                   | Retention window; couples cleanup and read lookback.                      |
| `DEFAULT_BRANCH`                          | `publish-mirror`               | (looked up via `gh`)   | Skips the default-branch lookup; must be a maintainer-controlled literal. |

## Mirror cleanup

Cache data auto-cleans by age in both backends:

- **Local mirror (GitHub Releases):** `op-nx-github-cache-publish-mirror` prunes
  the mirror after each upload -- assets older than `CACHE_MIRROR_MAX_AGE_DAYS`
  (default 30) are deleted, and a month-shard release with nothing left is
  removed. Retention is age-only: the Release Asset API exposes no last-accessed
  timestamp (only a cumulative `download_count`, which never decays), so there
  is no true-LRU signal to key off -- `created_at` age is the reliable one.
  Retention is bounded by the same window reads walk (`CACHE_MIRROR_MAX_AGE_DAYS`),
  so nothing is kept that a read could not reach anyway. A hash cached late in a
  month whose shard is later pruned yields a cache miss (rebuild) on next read,
  not corruption -- expected sharding/retention behavior.
- **CI (GitHub Actions cache):** needs no cleanup code. GitHub evicts natively
  by both age and true LRU -- entries unused for 7 days are removed, and at the
  per-repo size cap (10 GB by default) it evicts by last-access date, oldest
  first.

## `act`-based local integration test harness (opt-in, test-only)

`@actions/cache` cannot be invoked at all outside a real (or emulated)
Actions runner, so `npm run test:act` / `npm run test:act:untrusted` (in this
package) use [`act`](https://github.com/nektos/act) + Docker to exercise the
real cache backend and the trust gate end to end. **Docker and `act` are
test-only developer prerequisites**: neither is a runtime dependency of this
package, and these scripts are never run by default CI or `nx test`. `act`'s
token/permissions differ from a real runner, so the trust-gate fixture keys
off `GITHUB_EVENT_NAME` (which `act -e` sets accurately), never token scope.

## Building / testing

- `nx build @op-nx/github-cache`
- `nx test @op-nx/github-cache`
