# @op-nx/github-cache

A GitHub-backed remote cache for [Nx](https://nx.dev). Store your Nx task cache
on GitHub's own infrastructure -- the Actions cache in CI, GitHub Releases across
contexts -- with **nothing extra to host**. No cache server to run, no external
service to pay for, and no secrets to manage beyond the workflow token you
already have.

- **Default path:** a read-write cache in CI, backed by the GitHub Actions cache.
- **Opt-in:** a cross-context read store and mirror on GitHub Releases, plus
  publish/sync and cleanup. See [Advanced usage](docs/advanced.md).

## Quickstart (5 minutes)

**Prerequisites:** an Nx workspace on Nx 21 or later (the self-hosted remote
cache API) and a GitHub Actions workflow.

Add the sidecar as a background step in your existing build job. Because a
background step cannot export environment variables to later steps, you set the
two `NX_*` variables the Nx client reads in a regular step first, then start the
sidecar with a matching `port`; the sidecar adopts the values you set:

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7

      # A background step cannot export env to later steps, so PRE-SET the two
      # Nx client vars here in a regular step (whose $GITHUB_ENV writes DO
      # propagate). Pick any free loopback port and a fresh per-run token; the
      # sidecar below adopts both.
      - run: |
          echo "NX_SELF_HOSTED_REMOTE_CACHE_SERVER=http://127.0.0.1:3000" >> "$GITHUB_ENV"
          echo "NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN=$(openssl rand -hex 32)" >> "$GITHUB_ENV"

      # Start the Nx remote-cache sidecar as a background step. It adopts the
      # pre-set NX_* vars and binds the matching port on 127.0.0.1.
      - uses: op-nx/github-cache/start-cache-server@v0
        id: cache-server
        background: true
        with:
          port: '3000'
        env:
          # Selects the writable Actions-cache backend on trusted triggers
          # (push / schedule). Without a resolvable token the sidecar serves a
          # read-only backend and every task is a cache MISS on write.
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      # Nx reads the pre-set NX_* vars and talks to the loopback sidecar.
      - run: npx nx affected -t build test

      # MANDATORY teardown. serve() never exits on its own, so the implicit
      # wait-all that runs before post-job cleanup would hang the job forever.
      # cancel sends SIGTERM; serve() drains in-flight writes, then exits.
      - cancel: cache-server
```

That is the whole default setup. There is no server to deploy and no cache
storage to provision -- the writes land in your repository's GitHub Actions
cache.

## How it works

- **Background sidecar.** `start-cache-server` is a JS action that runs the cache
  server on `127.0.0.1` as a [background step][background-steps]. A background
  step cannot export env to later steps, so you set
  `NX_SELF_HOSTED_REMOTE_CACHE_SERVER` (the loopback URL) and
  `NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN` (a per-run bearer token) in a regular
  step first and pass a matching `port`; the sidecar adopts them so the next Nx
  step reaches it.
- **Read-write only where it is safe.** The backend is chosen from runtime
  context, never a caller flag: a trusted CI trigger with a resolvable token gets
  the writable Actions-cache backend; everything else is read-only. See
  [Trust and security](docs/trust-and-security.md).
- **Correct over clever.** Every read fault degrades to a cache MISS (a rebuild),
  never a wrong result or a broken build.
- **`cancel:` is mandatory.** The server runs until torn down, so the `cancel:`
  step is required -- without it the job hangs at the implicit `wait-all` before
  post-job cleanup.

The `op-nx/github-cache/start-cache-server` action above is the public consumer
surface. The internal `packages/github-cache/action.yml` is this repository's own
dogfood action and is not for consumer use.

## Documentation

- [Configuration](docs/configuration.md) -- every environment variable knob, the
  Actions-cache 10 GB per-repo limit, and the no-default-local-read note.
- [Advanced usage](docs/advanced.md) -- the opt-in Releases read store, publish /
  sync, cleanup, the `&` fallback for older runners, and the JS-action rationale.
- [Trust and security](docs/trust-and-security.md) -- which events may write, the
  CREEP posture, the github.com-only backstop, and adopter prerequisites.
- [Versioning](docs/versioning.md) -- the versioned consumer contract and what
  counts as a breaking change.
- [Examples](docs/examples/) -- a minimal, copyable adopter workflow.

## Versioning

This package is pre-1.0 (`0.x`): the public surface may still evolve, a breaking
change bumps the **minor** version and is documented, and `1.0` will freeze the
contract. See [Versioning](docs/versioning.md).

## Security

Report vulnerabilities through GitHub's private vulnerability reporting -- see
[SECURITY.md](SECURITY.md). The trust model this cache defends (cache poisoning /
CVE-2025-36852) is documented in [Trust and security](docs/trust-and-security.md).

## License

[MIT](LICENSE) (c) Lars Gyrup Brink Nielsen.

[background-steps]: https://docs.github.com/actions/reference/workflows-and-actions/workflow-syntax
