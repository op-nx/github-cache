# Configuration

Every consumer-facing configuration knob for `@op-nx/github-cache`, what sets it,
and its default. In the default [quickstart](../README.md#quickstart-5-minutes)
you set none of these by hand -- the `start-cache-server` action exports the two
`NX_*` variables for you and everything else has a safe default. This reference
is for the cases where you need to override a default or wire the server
yourself.

These knobs, plus the package exports and the action inputs, are the versioned
consumer contract (see [Versioning](versioning.md)) and are locked by the
`public-surface` guard test (DOCS-05).

## Environment variables

| Variable                                   | Set by                                          | Purpose                                                                             | Default                       |
| ------------------------------------------ | ----------------------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------- |
| `NX_SELF_HOSTED_REMOTE_CACHE_SERVER`       | the action (exported); or you, for the fallback | Loopback URL the Nx client uses to reach the sidecar (`http://localhost:<port>`)    | exported by the action        |
| `NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN` | the action (exported); or you, to pin a token   | Bearer token the Nx client presents and the server checks                           | a fresh per-run CSPRNG token  |
| `PORT`                                     | you (optional)                                  | Loopback port to bind (`resolvePort`)                                               | an OS-assigned ephemeral port |
| `CACHE_MIRROR_MAX_AGE_DAYS`                | you (optional)                                  | The one coupled retention knob (`resolveMaxAgeDays`) for the opt-in Releases mirror | `30` (clamped to `365`)       |
| `GH_TOKEN`                                 | you / the runner                                | GitHub token, first choice (`resolveGitHubToken`)                                   | none                          |
| `GITHUB_TOKEN`                             | you / the runner                                | GitHub token, fallback when `GH_TOKEN` is unset                                     | none                          |
| `GITHUB_REPOSITORY`                        | the runner (CI); you, to override locally       | `owner/name` identity (`resolveRepoIdentity`)                                       | the `origin` git remote       |

`MAX_CACHE_BODY_BYTES` is **not** an environment variable -- see
[The body-size limit is fixed](#the-body-size-limit-is-fixed) below.

## How each value is resolved

### Server connection: `NX_SELF_HOSTED_REMOTE_CACHE_SERVER` / `_ACCESS_TOKEN`

These two are the [Nx self-hosted remote cache][nx-self-hosted] client variables.
Nx (not this package) reads them to decide where to send `GET` / `PUT` cache
requests and which bearer token to present. The `start-cache-server` action
exports both after it binds the sidecar, so a later Nx step in the same job picks
them up automatically. You only set them by hand on the
[`&` fallback path](advanced.md#the--fallback-older-runners-and-ghes) or when
running the server as a library / `npx` process.

### `PORT`

`resolvePort` reads `PORT` (or the action's `port` input). A missing, non-integer,
negative, or out-of-range value falls back to `0`, which asks the OS for an
ephemeral port; the server binds `127.0.0.1` only. Read the actual URL back from
the exported `NX_SELF_HOSTED_REMOTE_CACHE_SERVER` rather than assuming a fixed
port.

### `CACHE_MIRROR_MAX_AGE_DAYS`

`resolveMaxAgeDays` reads this single retention knob. It is the **one coupled
knob**: it drives BOTH the reader's month-shard lookback window AND the cleanup
prune window through the same resolver, so a mirrored entry stays readable
exactly as long as it stays uncleaned. An unset, non-numeric, zero, or negative
value falls back to `30` days; a larger value is clamped to a `365`-day ceiling.

Treat retention as **storage hygiene, not a security control** -- it bounds how
much the mirror grows, it does not contain a poisoned entry. Poisoning is
contained at the write and sync gates (see
[Trust and security](trust-and-security.md)). This knob only matters if you use
the opt-in Releases mirror ([Advanced usage](advanced.md)).

### `GH_TOKEN` / `GITHUB_TOKEN`

`resolveGitHubToken` returns `GH_TOKEN || GITHUB_TOKEN` (falsy-coalescing: a set
but empty value falls through to the next source). The resolved token is used to:

- select the writable Actions-cache backend on a trusted CI trigger -- with no
  resolvable token the server falls back to a read-only backend and every write
  is a cache MISS; and
- authenticate the opt-in Releases reader (tier 1 of the local-read chain).

### `GITHUB_REPOSITORY`

`resolveRepoIdentity` uses a well-formed `owner/name` `GITHUB_REPOSITORY` (the
runner injects it in CI) and otherwise falls back to the `origin` git remote
(`github.com` HTTPS or SSH form only). An unparseable or absent identity resolves
to nothing and the read MISSES -- the code never guesses a repository, because a
guess would read into some other repository's cache namespace.

## The body-size limit is fixed

`MAX_CACHE_BODY_BYTES` is a **fixed contract limit of 2 GiB** (2,147,483,648
bytes), a constant in the server -- it is NOT read from the environment and there
is no knob to change it. A `PUT` whose body exceeds it is rejected with `413`. The
limit matches the roughly 2 GiB GitHub Releases asset ceiling, so a single cache
entry never exceeds what the mirror can store.

## Two limits to know about

### The GitHub Actions cache is capped at 10 GB per repository

The default backend stores entries in the GitHub Actions cache, which GitHub caps
at **10 GB per repository**. When a repository crosses that limit GitHub evicts
least-recently-used entries. On a large monorepo this can cause cache thrash --
entries are evicted before they are reused, so you see more MISSes than you
expect. This is a GitHub platform limit with nothing to configure here; be aware
of it when sizing expectations for a big monorepo, and consider the opt-in
Releases mirror ([Advanced usage](advanced.md)) for entries you want to outlive
the 10 GB window.

### No default local read

There is **no anonymous default local-read path**. Outside CI (a developer
machine, a fresh checkout) a read requires two things: the opt-in GitHub Releases
reader, and the developer's own GitHub authentication. The local-read token chain
(`resolveLocalReadToken`) tries, in order, `GH_TOKEN` / `GITHUB_TOKEN`, then the
`gh` CLI (`gh auth token`), then the `git credential` helper. If every tier is
exhausted the reader MISSES -- it deliberately does NOT fall back to an
unauthenticated request, because an anonymous request cannot see a private repo
and would silently bind the reader to GitHub's 60-requests-per-hour tier.

[nx-self-hosted]: https://nx.dev/docs/guides/tasks--caching/self-hosted-caching#usage-notes
