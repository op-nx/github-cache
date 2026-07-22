# Spike Conventions

Patterns and stack choices established across the FOUND-01 spike session. New spikes follow
these unless the question requires otherwise.

## Stack

- **Dependency-free Node 24 ESM** with global `fetch` for every experiment - no npm installs,
  no docker daemon required. Matches the project's dependency-light ethos and proves the exact
  mechanism a real adapter would use.
- **Raw HTTP APIs**, not CLIs/SDKs, so latency and call-fan-out are measured precisely and the
  adapter design is validated directly:
  - GHCR = the **OCI distribution API** (`https://ghcr.io/v2/...`) with a registry bearer
    obtained by `Basic <user:token>` -> `GET /token?scope=repository:<name>:pull[,push]`.
  - Releases = GitHub REST (`api.github.com` + `uploads.github.com`) mirroring exactly the
    calls `release-mirror-backend.ts` / `publish-mirror.ts` make.

## Structure

- One dir per spike: `.planning/spikes/NNN-name/` with `*.mjs` experiment scripts + `README.md`.
- CI-leg spikes keep their workflow + scripts in the spike dir AND push copies to the throwaway
  hub repo to run.
- Results are emitted as **pretty-printed JSON to stdout** (and `GITHUB_STEP_SUMMARY` in CI) so
  findings are machine-checkable and quotable in the README.

## Patterns

- **Throwaway targets, real infra:** a private hub repo `LayZeeDK/found01-spike` +
  `ghcr.io/layzeedk/found01-*` packages. Never touch the real `op-nx/github-cache` repo.
- **Latency:** `process.hrtime.bigint()` deltas; separate cold (fresh process/token) from warm
  (keep-alive) samples; take a 3-sample median.
- **Byte-identity:** always `Buffer.compare(pulled, pushed) === 0` AND verify the layer/asset
  digest - never trust a happy-path status code alone.
- **Auth:** `GH_TOKEN=$(gh auth token)` locally; `secrets.GITHUB_TOKEN` in CI. GHCR scopes:
  `write:packages` to push, `delete:packages`+`read:packages` for a user-PAT delete; CI
  `GITHUB_TOKEN` with `packages: write` can delete same-owner packages.

## Tools & Libraries

- `gh` CLI for repo/package/release setup, triggering + watching CI (`gh run watch`), and log
  extraction. `rg` for filtering log/JSON output (never `grep`).
- No `oras`, no docker daemon - the registry API path is sufficient and cleaner.
- Windows note: never use `/dev/stdin` for inline Node; write a temp `.mjs` and run it.
