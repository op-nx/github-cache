# @op-nx/github-cache

GitHub-backed Nx remote cache. Run a self-hosted Nx remote-cache server backed
by your repository's own GitHub Actions cache (and GitHub Releases for the
cross-context store) -- correct and safe caching for public and private repos,
with nothing extra to host.

## Install

```sh
npm install @op-nx/github-cache
```

Or consume the CI sidecar as a GitHub JS Action (no install step):

```yaml
- uses: op-nx/github-cache/start-cache-server@v0
  background: true
```

## Usage

The package exposes `createCacheServer` plus the `CacheBackend` / `GetHit` /
`GetResult` / `PutResult` port types, and a `github-cache` bin that starts the
loopback cache server (`npx @op-nx/github-cache`).

For the 5-minute CI quickstart, the configuration reference, the trust and
security model, and the advanced (opt-in store / sync / cleanup) guide, see the
full documentation in the repository:

https://github.com/op-nx/github-cache

## License

MIT (c) Lars Gyrup Brink Nielsen. See [LICENSE](./LICENSE).
