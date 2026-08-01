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
cache API), a GitHub Actions workflow, and a job whose working directory is the
workspace root -- the directory that holds `nx.json`.

That last one is a hard precondition, checked at startup on the path that can
write: when the sidecar resolves the Actions cache backend it refuses to start
unless `nx.json` sits in the process working directory and that directory matches
`GITHUB_WORKSPACE`. Both are startup checks rather than read faults, so they fail
the step loudly instead of degrading to a MISS. A read-only context -- a fork
pull request, or a local run -- never constructs that backend, so it never reaches
the check; it also never writes an archive, so the mismatch below cannot bite it.
Hold to the precondition anyway: the same workflow becomes write-trusted the
moment it runs on your default branch. The reason is that the
cache archive path is workspace-relative (see
[Advanced usage](docs/advanced.md)), so a working directory anywhere else would
have this action extract under one anchor and read under the other. The cache
would then never serve anything again: `@actions/cache` reports a hit, the bytes
are unreachable, the sidecar turns that into a 404, and every task rebuilds. It
is a permanent silent all-MISS -- slow, never wrong -- and the startup check
exists because nothing about it looks like a failure while it is happening.

Two layouts trip it today, and neither is currently supported:

- An Nx workspace in a subdirectory (`frontend/`, `web/`, most polyglot repos).
- `actions/checkout` with a `path:` input, which leaves `GITHUB_WORKSPACE` as the
  parent of the checkout.

If you need either, open an issue rather than working around it with a `cd` --
the archive anchor, not the check, is what would need to move.

Add the sidecar as a background step in your existing build job. Because a
background step cannot export environment variables to later steps, you set the
two `NX_*` variables the Nx client reads in a regular step first, then start the
sidecar with a matching `port`; the sidecar adopts the values you set:

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    # Generic hang insurance, NOT a teardown workaround and NOT the containment
    # control for a failing step. `cancel:` needs no help: a cancel: step is not
    # subject to skip-on-failure, so it still tears the sidecar down when an
    # earlier step fails. The hang warned about below is the one caused by
    # OMITTING cancel: -- a different thing. This bound only caps a genuine hang
    # (a stalled npm ci, a wedged test run) at minutes instead of the
    # 360-minute default.
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v7

      # A background step cannot export env to later steps, so PRE-SET the two
      # Nx client vars here in a regular step (whose $GITHUB_ENV writes DO
      # propagate). Pick any free loopback port and a fresh per-run token; the
      # sidecar below adopts both.
      - run: |
          echo "NX_SELF_HOSTED_REMOTE_CACHE_SERVER=http://127.0.0.1:3000" >> "$GITHUB_ENV"
          # Mask the token BEFORE writing it to $GITHUB_ENV: the runner redacts it
          # from the moment the ::add-mask:: command is processed, so nothing echoed
          # between here and the sidecar step can leak it into the log.
          # node, not openssl: openssl may be absent from a Windows runner's Git
          # Bash, while node is guaranteed present wherever the sidecar runs.
          token="$(node -e 'process.stdout.write(require("crypto").randomBytes(32).toString("hex"))')"
          echo "::add-mask::${token}"
          echo "NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN=${token}" >> "$GITHUB_ENV"

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

      # Wait for the sidecar before the first Nx task, and demand exactly 404 or
      # 200. An authed GET on an unknown hash MISSes with 404 on every backend the
      # sidecar can select, and 200 needs a pre-existing entry -- either one proves
      # reachability AND that the bearer token matches. Accepting "any status but
      # 000" would pass a 401, i.e. a token mismatch, after which every Nx request
      # 401s, read faults degrade to a cache MISS, and the job goes GREEN having
      # cached nothing. 404 also rejects a squatter process on the port answering
      # with its own status.
      - run: |
          set -euo pipefail
          auth="Authorization: Bearer ${NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN}"
          code=000
          for _ in $(seq 1 30); do
            # curl already prints 000 and exits non-zero on connection-refused, so
            # swallow the exit with `|| true` -- NEVER `|| echo 000`, which appends
            # a second 000 and makes the status unparseable. --max-time bounds EACH
            # attempt, so the loop's worst case is 30 x (10 + 1), about 5.5 minutes
            # -- not 30 seconds.
            code=$(curl -s --max-time 10 -o /dev/null -w '%{http_code}' -H "${auth}" "${NX_SELF_HOSTED_REMOTE_CACHE_SERVER}/v1/cache/deadbeef" || true)
            if [ "${code}" = "404" ] || [ "${code}" = "200" ]; then
              break
            fi
            sleep 1
          done
          if [ "${code}" != "404" ] && [ "${code}" != "200" ]; then
            echo "sidecar not ready on ${NX_SELF_HOSTED_REMOTE_CACHE_SERVER} after 30 attempts (last status ${code}, wanted 404 or 200)" >&2
            exit 1
          fi

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

On a Windows runner, add `shell: bash` to every `run:` step above -- the default
there is `pwsh`, which does not understand `$GITHUB_ENV` or `$(...)`.

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
  never a wrong result or a broken build. That covers read **faults**, and it
  assumes a cached task's outputs do not depend on which OS produced them: the
  store does not partition by runner OS, so a task whose output genuinely differs
  per OS must declare that difference as an Nx input. See
  [Advanced usage](docs/advanced.md).
- **`cancel:` is mandatory.** The server runs until torn down, so the `cancel:`
  step is required -- without it the job hangs at the implicit `wait-all` before
  post-job cleanup.
- **Wait for the sidecar, and bound the job.** The first Nx task can reach the
  loopback port before the server binds it, so poll until an authed GET returns
  404 or 200 (see the quickstart). `timeout-minutes` on the job is separate:
  generic hang insurance, not the containment control for a failing step -- a
  `cancel:` step is not subject to skip-on-failure.

The `op-nx/github-cache/start-cache-server` action above is the public consumer
surface. The internal `packages/github-cache/action.yml` is this repository's own
dogfood action and is not for consumer use.

## Documentation

- [Configuration](docs/configuration.md) -- every environment variable knob, the
  Actions-cache 10 GB per-repo limit, and the no-default-local-read note.
- [Advanced usage](docs/advanced.md) -- the opt-in Releases read store, publish /
  sync, cleanup, the `&` fallback for older runners, and the JS-action rationale.
- [Cross-OS caching](docs/cross-os.md) -- the safe default for sharing one cache
  across operating systems, and the checklist that earns a per-target exception.
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
