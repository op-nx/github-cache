# Technology Stack

**Analysis Date:** 2026-07-17

## Languages

**Primary:**
- TypeScript ~6.0.3 - All package source in `packages/op-nx-github-cache/src/` (strict mode, `module: nodenext`, ES2022 target, composite project references; see `tsconfig.base.json`)

**Secondary:**
- JavaScript (CommonJS) - The two GitHub JS actions and their self-checks: `start-cache-server/index.cjs`, `start-cache-server/selfcheck.cjs`, `publish-mirror/index.cjs`, `publish-mirror/selfcheck.cjs`. Node built-ins only, no npm dependencies, so they run before/without `npm ci`.
- JavaScript (ESM) - Test fixture `packages/op-nx-github-cache/__fixtures__/act-round-trip.mjs`; skill scripts under `.github/skills/monitor-ci/scripts/*.mjs`
- YAML - CI workflows (`.github/workflows/`), action manifests (`start-cache-server/action.yml`, `publish-mirror/action.yml`), Verdaccio config (`.verdaccio/config.yml`)

## Runtime

**Environment:**
- Node.js `lts/krypton` (Node 24 LTS) - pinned in `.node-version`, consumed by `actions/setup-node` via `node-version-file`
- GitHub actions declare `using: 'node24'` (`start-cache-server/action.yml`, `publish-mirror/action.yml`)
- Package output is pure ESM (`"type": "module"` in `packages/op-nx-github-cache/package.json`)

**Package Manager:**
- npm with workspaces (`workspaces: ["packages/*"]` in root `package.json`)
- Lockfile: present (`package-lock.json`); CI installs via `npm ci`

## Frameworks

**Core:**
- Nx 23.1.0 - Monorepo task runner. Plugins configured in `nx.json`:
  - `@nx/js/typescript` - infers `build` (tsc via `tsconfig.lib.json`) and `typecheck` targets
  - `@nx/vitest` - infers the `test` target
- No web/server framework: the cache server is raw `node:http` (`packages/op-nx-github-cache/src/lib/server.ts`)

**Testing:**
- Vitest ~4.1.0 with `@vitest/coverage-v8` ~4.1.0 - two config tiers per package:
  - Unit: `packages/op-nx-github-cache/vitest.config.mts` (excludes `*.integration.spec.*`; OS-portable, cross-OS cache hits)
  - Integration: `packages/op-nx-github-cache/vitest.integration.config.mts` (only `*.integration.spec.*`; real sockets/filesystem; OS-discriminated Nx hash via `{ runtime: "node -p process.platform" }` input in `nx.json`)
- `act` (nektos/act, external CLI) - end-to-end GitHub Actions workflow tests via `test:act` / `test:act:untrusted` scripts in `packages/op-nx-github-cache/package.json` against `__fixtures__/act-workflow.yml`
- Windows self-checks: `start-cache-server/selfcheck.cjs`, `publish-mirror/selfcheck.cjs` run directly by the `windows-selfcheck` CI job (no npm install needed)

**Build/Dev:**
- TypeScript compiler (tsc) via the `@nx/js/typescript` plugin - emits ESM + declarations to `packages/op-nx-github-cache/dist/`
- Vite ^8.0.0 - present as Vitest's underlying dependency (no app bundling)
- `@swc-node/register` 1.11.1, `@swc/core` 1.15.8, `@swc/helpers` 0.5.18 - Nx tooling transpilation (devDependencies)
- Prettier ^3.8.1 - formatting via `nx format` (`.prettierrc`: `{ "singleQuote": true }`; ignores in `.prettierignore`)
- Verdaccio ^6.3.2 - local npm registry for publish testing (`local-registry` Nx target in root `package.json`, config at `.verdaccio/config.yml`, port 4873, storage `tmp/local-registry/storage`, proxies `registry.npmjs.org`)
- No ESLint config detected - formatting only (Prettier)

## Key Dependencies

**Critical (runtime deps of `@op-nx/github-cache`, see `packages/op-nx-github-cache/package.json`):**
- `@actions/cache` ^6.2.0 - Read/write access to the GitHub Actions cache service; the only channel to cache *content* (no public REST download exists). Used in `src/lib/backends/actions-cache-backend.ts` and `src/bin/publish-mirror.ts`
- `@octokit/rest` ^22.0.1 - GitHub REST client for the read-only Release-asset mirror (`src/lib/backends/release-mirror-backend.ts`)
- `tslib` ^2.3.0 - TypeScript helper runtime (`importHelpers: true`)

**Infrastructure (external CLI, not an npm dep):**
- `gh` (GitHub CLI) - shelled out via `execFile` in `src/bin/publish-mirror.ts` for release create/upload/delete-asset/delete and `gh api` calls (Actions caches list, releases list). Assumed present on GitHub-hosted runners.

## Configuration

**Environment (all runtime knobs are env vars; no config files, no `.env` files in repo):**
- `PORT` - server port; invalid/unset falls back to ephemeral port 0 (`src/bin/serve.ts` `resolvePort`)
- `MAX_CACHE_BODY_BYTES` - PUT body cap, default 2 GiB (`src/lib/server.ts` `resolveMaxBodyBytes`)
- `CACHE_MIRROR_MAX_AGE_DAYS` - mirror retention + read lookback window, default 30, clamped at 3650 (`src/lib/shard.ts` `resolveMaxAgeDays`); read by both backend selection and cleanup so the two never drift
- `GITHUB_ACTIONS` - backend selector: `'true'` -> Actions-cache backend (read-write), else Release-mirror backend (read-only) (`src/lib/backends/index.ts` `selectBackend`)
- `GITHUB_REPOSITORY` (`owner/repo`) - required for the local mirror backend and publish-mirror
- `GITHUB_EVENT_NAME`, `GITHUB_REF` - write-trust gate inputs (`src/lib/trust.ts`, `src/bin/publish-mirror.ts` `resolveTrustedRepo`)
- `GH_TOKEN` / `GITHUB_TOKEN` - optional GitHub auth; lifts anonymous mirror reads from 60 to 5000 req/hr; `GH_TOKEN` feeds the `gh` CLI in cleanup/publish
- `DEFAULT_BRANCH` - optional override for the trusted-branch check (`src/bin/publish-mirror.ts`)
- `ACTIONS_RUNTIME_TOKEN`, `ACTIONS_RESULTS_URL` / `ACTIONS_CACHE_URL` - GitHub-injected Actions cache runtime env; only JS actions receive these, which is why `start-cache-server/` and `publish-mirror/` exist as JS actions
- `GITHUB_ENV` - handshake file: `serve` appends `NX_SELF_HOSTED_REMOTE_CACHE_SERVER` / `NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN` for later workflow steps

**Build:**
- `tsconfig.base.json` - shared strict compiler options (`nodenext`, ES2022, composite, `customConditions: ["@op-nx/source"]` for source-first workspace resolution)
- `packages/op-nx-github-cache/tsconfig.lib.json` - emits `src/` -> `dist/`
- `packages/op-nx-github-cache/tsconfig.spec.json` - test typecheck -> `out-tsc/vitest/`
- `nx.json` - target defaults, cache inputs (including the platform runtime discriminator on `integration`), named inputs
- `vitest.workspace.ts` - Vitest workspace glob
- `.gitattributes` - forces `eol=lf` everywhere so Nx content hashes are byte-identical cross-OS (load-bearing for cross-OS cache hits)

## Platform Requirements

**Development:**
- Node 24 LTS (`.node-version`), npm
- `gh` CLI only needed for the mirror publish/cleanup bins (CI-side)
- Optional: `act` for local GitHub Actions workflow testing
- Agent skills for Nx workflows live in `.agents/skills/` and `.github/skills/` (nx-workspace, nx-generate, nx-run-tasks, monitor-ci, etc.)

**Production:**
- Distributed as an npm package (`@op-nx/github-cache` v0.0.1, private-workspace source; bins `op-nx-github-cache-serve`, `op-nx-github-cache-publish-mirror`, `op-nx-github-cache-publish-mirror-cleanup`)
- Runs as a loopback-only sidecar process on GitHub Actions runners (CI) or a developer machine (local read-only mode); no hosted deployment
- CI runners: `ubuntu-24.04-arm`, `windows-11-arm`, `windows-latest` (see `.github/workflows/ci.yml`)
- Versioning: Nx release with `git-tag` current-version resolver (`packages/op-nx-github-cache/package.json` `nx.release`)

---

*Stack analysis: 2026-07-17*
