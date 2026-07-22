# Versioning and the Consumer Contract

`@op-nx/github-cache` follows [Semantic Versioning](https://semver.org). This
document defines the PUBLIC SURFACE the version number is a contract over, what
counts as a breaking change, and how versioning works under the current pre-1.0
(`0.x`) posture.

## The public surface (the consumer contract)

The versioned contract is the CONSUMER surface only -- exactly three groups
(decision D-04):

1. **Package exports.** The value and type exports re-exported from the package
   entry (`index.ts`): `createCacheServer` and the `CacheBackend`, `GetHit`,
   `GetResult`, and `PutResult` port types.
2. **Consumer action inputs.** The inputs of the `uses:`-consumable
   `start-cache-server` JS action.
3. **Consumer env knobs.** The environment variables an adopter sets:
   `NX_SELF_HOSTED_REMOTE_CACHE_SERVER`,
   `NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN`, `PORT`,
   `CACHE_MIRROR_MAX_AGE_DAYS`, `CACHE_MIRROR_ALLOW_AGGRESSIVE_RETENTION`,
   `GH_TOKEN` / `GITHUB_TOKEN`, and `GITHUB_REPOSITORY`.

`MAX_CACHE_BODY_BYTES` is a FIXED 2 GiB contract limit, not a tunable knob.

This surface is enforced mechanically by the public-surface guard test (DOCS-05):
an unintended change to any of the three groups fails the build, so a contract
change can only land as an explicit, reviewable diff -- never silently.

### What is NOT part of the contract

Internal module exports (for example `withHashLock`, `shardTag`, `octokitFault`,
`isWriteTrusted`, and the other internals not re-exported from `index.ts`), and
anything that exists only for this repo's own dogfooding or CI (`nx.json`,
project targets, `.github/workflows`, and the internal
`packages/github-cache/action.yml` dogfood action) are NOT part of the consumer
contract. They MAY change in any release, without a version signal.

## What "breaking" means

A breaking change is any backward-incompatible change to the public surface
above: removing or renaming an export or a port-type member, removing or renaming
a consumer action input or env knob, or changing the meaning of one so that an
adopter who did not change their configuration would break.

Adding a new export, a new optional action input, or a new optional env knob is
NOT breaking -- it is additive.

## Pre-1.0 (`0.x`) posture

This package is pre-1.0. Under standard semver `0.x` semantics:

- The public surface MAY still evolve before `1.0` -- it is not yet frozen.
- A breaking change bumps the **minor** version (`0.Y` -> `0.Y+1`) and is
  documented in the changelog / release notes.
- A backward-compatible change or fix bumps the patch version (`0.Y.Z` ->
  `0.Y.Z+1`).

The pre-1.0 posture is honest for an interface built this milestone with no
external adopters yet, and it still protects adopters: the DOCS-05 guard
guarantees every surface change is intentional and reviewed, not silent. The
guard does not promise the surface never changes -- it promises a change is never
accidental.

## The 1.0 freeze

`1.0` freezes the consumer contract to standard semver. From `1.0` onward a
breaking change to the public surface requires a **major** version bump
(`X.0.0`), a backward-compatible addition bumps the minor version, and a fix
bumps the patch version.
