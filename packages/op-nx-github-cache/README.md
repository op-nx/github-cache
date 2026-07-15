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
  separate trusted-CI-only publish step. Read-only -- `PUT` always returns
  `403`. Since this repo is public, local reads are anonymous; no token setup
  needed.
- **CREEP mitigation**: writes are additionally gated by `isWriteTrusted()`,
  which only allows GitHub Actions' own trusted trigger events (`push`,
  `schedule`, `workflow_dispatch`, `repository_dispatch`, `delete`,
  `registry_package`, `page_build`). A PR-triggered run can never write to
  either the Actions cache or the mirror through this server.

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
        run: npx op-nx-github-cache-serve >> "$GITHUB_OUTPUT"
        id: cache-server
      - run: npx nx affected -t build test
        env:
          NX_SELF_HOSTED_REMOTE_CACHE_SERVER: ${{ env.NX_SELF_HOSTED_REMOTE_CACHE_SERVER }}
          NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN: ${{ env.NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN }}

  publish-mirror:
    needs: build
    if: github.ref == 'refs/heads/main'
    # Isolated job: only this job holds contents: write, and it never checks
    # out/executes untrusted PR code -- this is the load-bearing control, not
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
```

**MUST:** never invoke `op-nx-github-cache-publish-mirror` from a job that
also checks out or runs untrusted PR-controlled code (no `pull_request_target`
job that also builds PR code -- the classic "pwn request" pattern), and grant
`contents: write` only to that isolated post-build job, never workflow-wide.

**MUST:** if you set the optional `DEFAULT_BRANCH` env var (to skip the
`gh repo view` lookup), its value must be a literal you control -- never a
GitHub Actions expression interpolating PR-controlled data (e.g. a PR title
or body). `publish-mirror` compares `GITHUB_REF` against it as its
(defense-in-depth-only) ref check.

**Known limitation:** the Actions-cache backend and `publish-mirror` both
stage a hash's archive at the same deterministic per-hash temp path (required
so `@actions/cache` can match a save to a later restore -- see
`cacheArchivePath`'s doc comment), serialized only within one process via an
in-process lock. This is safe in the CI wiring above, where `build` and
`publish-mirror` are separate jobs on separate (ephemeral, GitHub-hosted)
runner VMs. It is NOT safe if you run `serve` and `publish-mirror` concurrently
on the same self-hosted runner host -- don't do that.

## Local usage

```bash
npx op-nx-github-cache-serve
# prints:
#   export NX_SELF_HOSTED_REMOTE_CACHE_SERVER=http://127.0.0.1:PORT
#   export NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN=...
# eval those, then run nx as usual -- reads hit the public mirror, writes 403.
```

Note: "anonymous" describes the mirror backend's own reads from the public
GitHub repo (no PAT needed there) -- the local server itself still requires
the printed bearer token on every request, GET included, matching Nx's
self-hosted remote-cache contract. The token is a shared secret between your
own `serve` process and your own `nx` client; it never leaves your machine.

Requires `GITHUB_REPOSITORY=owner/repo` to be set (CI sets this
automatically; set it yourself locally, e.g. `export
GITHUB_REPOSITORY=op-nx/github-cache`).

## Mirror cleanup

`op-nx-github-cache-publish-mirror` also prunes the mirror after each upload:
assets older than `CACHE_MIRROR_MAX_AGE_DAYS` (default 30) are deleted, unless
`download_count` is at or above `CACHE_MIRROR_MIN_DOWNLOAD_COUNT_TO_KEEP`
(default `0`, i.e. off -- age-only cleanup). `download_count` is a lifetime
total, not a recency signal (the Release Asset API has no last-accessed
field), so this is an explicit popularity _floor_, not true LRU. A hash cached
late in a month whose shard is later pruned yields a cache miss (rebuild) on
next read, not corruption -- expected sharding/retention behavior, not a bug.
The GitHub Actions cache backend needs no cleanup code at all: GitHub's own
10GB/7-day eviction already covers it.

## `act`-based local integration test harness (opt-in, test-only)

`@actions/cache` cannot be invoked at all outside a real (or emulated)
Actions runner, so `npm run test:act` / `npm run test:act:untrusted` (in this
package) use [`act`](https://github.com/nektos/act) + Docker to exercise the
real cache backend and the trust gate end to end. **Docker and `act` are
test-only developer prerequisites** -- neither is a runtime dependency of this
package, and these scripts are never run by default CI or `nx test`. `act`'s
token/permissions differ from a real runner, so the trust-gate fixture keys
off `GITHUB_EVENT_NAME` (which `act -e` sets accurately), never token scope.

## Building / testing

- `nx build @op-nx/github-cache`
- `nx test @op-nx/github-cache`
