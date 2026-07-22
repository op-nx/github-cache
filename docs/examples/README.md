# Examples

## `minimal-ci.yml`

A minimal, copyable GitHub Actions workflow for adopting `@op-nx/github-cache`.
Drop it into `.github/workflows/` in your Nx repository and you have the default
read-write cache: the loopback sidecar started as a background step, Nx wired to
it, and the mandatory `cancel:` teardown. Nothing to host.

It is deliberately minimal -- one job, the default Actions-cache path only. It is
NOT this repository's own CI (`.github/workflows/ci.yml`), which is a maximal
dogfood config with cross-OS matrices, publish / sync, and cleanup jobs that an
adopter does not need.

For the opt-in layers -- the GitHub Releases read store, publish / sync, cleanup,
and the `&` fallback for older runners -- see [Advanced usage](../advanced.md).
For every configuration knob, see [Configuration](../configuration.md).
