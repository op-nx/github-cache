# @op-nx/source

An Nx monorepo housing [`@op-nx/github-cache`](packages/op-nx-github-cache/README.md),
a self-hosted Nx remote cache server built on GitHub-native storage: the
GitHub Actions cache in CI (read-write), and an anonymous, read-only GitHub
Release-asset mirror for local development. No separate cache infrastructure
to run or pay for.

## Workspace layout

- `packages/op-nx-github-cache` is the only package in this workspace. See its
  [README](packages/op-nx-github-cache/README.md) for setup, CI wiring, local
  usage, and prerequisites. All usage details live there, not here.

## Building / testing

```sh
npx nx run-many -t build test
```

Or per-project: `npx nx build @op-nx/github-cache` / `npx nx test @op-nx/github-cache`.

## License

MIT
