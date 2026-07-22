# Technology Stack

**Analysis Date:** 2026-07-22

## Languages

**Primary:**
- TypeScript ~6.0.3 (strict mode, ESM, `nodenext` module resolution) - all source under `packages/github-cache/src/**/*.ts`, plus `start-cache-server/entry.ts`
- JavaScript (ESM/CJS) - `esbuild.action.mjs` (build script), committed bundle `start-cache-server/index.js` (CJS output of esbuild), `packages/github-cache/pack-check.cjs` (CJS guard script)

**Secondary:**
- YAML - GitHub Actions workflow/action definitions: `.github/workflows/ci.yml`, `.github/workflows/cleanup.yml`, `packages/github-cache/action.yml`, `start-cache-server/action.yml`, `ppe/action.yml`
- Bash - inline `run:` steps inside the workflow/action YAML files (credential masking, curl polling, tool installs in `ppe/action.yml`)

## Runtime

**Environment:**
- Node.js, pinned via `.node-version` to `lts/krypton` (Node 24 LTS line)
- `package.json` (package `@op-nx/github-cache`) declares `"engines": { "node": ">=20" }` as the minimum consumer floor, but CI, the esbuild target (`target: 'node24'`), and the action `runs.using: 'node24'` all standardize on Node 24
- The package is pure ESM (`"type": "module"` in `packages/github-cache/package.json`); the bundled consumer action (`start-cache-server/index.js`) is CJS output because a `uses:` action's `main` must be resolvable without a module-type declaration in that directory

**Package Manager:**
- npm (root `package.json` uses npm workspaces: `"workspaces": ["packages/*"]`)
- Lockfile: present (`package-lock.json`, npm v9+ lockfile format)
- `.npmrc`/`.pypirc`/similar: not detected

## Frameworks

**Core:**
- None (no web framework) - the cache server is a hand-rolled `node:http` server (`packages/github-cache/src/server/server.ts`); zero-HTTP-dependency by design (only `node:http`, `node:crypto`, native `fetch`)
- Nx 23.1.0 - monorepo build/task orchestration (`nx.json`, `@nx/js` and `@nx/vitest` plugins)

**Testing:**
- Vitest ~4.1.0 (resolved 4.1.10) - unit tests (`packages/github-cache/vitest.config.mts`) and a separate integration-test project (`packages/github-cache/vitest.integration.config.mts`)
- `@vitest/coverage-v8` ~4.1.0 - coverage provider (`provider: 'v8'`)
- `vitest.workspace.ts` (root) - workspace glob for vite/vitest config discovery

**Build/Dev:**
- esbuild 0.28.1 (exact-pinned) - bundles the consumer action entry (`start-cache-server/entry.ts`) into the single committed CJS file `start-cache-server/index.js` (`esbuild.action.mjs`); target `node24`, `format: 'cjs'`, `bundle: true`
- TypeScript compiler (`tsc`) via `@nx/js/typescript` Nx plugin - library build (`tsconfig.lib.json` -> `dist/`) and typecheck targets, plus a standalone `tsc -p tsconfig.action.json` for the action-entry graph
- `@swc-node/register` 1.11.1 / `@swc/core` 1.15.8 / `@swc/helpers` 0.5.18 - fast TS transpilation used by the Nx/Vitest toolchain
- Prettier ^3.8.1 (resolved 3.9.5) - formatting (`.prettierrc`, `.prettierignore`); `nx format:check` / `nx format:write`
- fallow ~3.6.0 (resolved 3.6.0) - dead-code / unused-export auditing (`.fallowrc.jsonc`; `npm run fallow`, `npm run fallow:ci`)

## Key Dependencies

**Critical (package: `packages/github-cache/package.json`, all exact-pinned):**
- `@actions/cache` 6.2.0 - official GitHub Actions cache toolkit; backs the writable Actions-cache backend (`src/backend/actions-cache-backend.ts`, `cache.restoreCache` / `cache.saveCache`). Exact-pinned because the archive-version hash it derives (OS tmpdir path + compression method) is load-bearing for cross-OS cache-miss behavior; an upgrade is a deliberate, dogfood-canary-gated event (see `.github/workflows/ci.yml` `dogfood-seed`/`dogfood-verify`)
- `@actions/core` 3.0.1 - Actions toolkit primitives (`core.getInput`, `core.setFailed`, `core.setSecret`, `core.warning`, `core.info`) used throughout the action entry, publish, and cleanup bins; also a root-level dependency (same exact version) for the consumer sidecar entry (`start-cache-server/entry.ts`)
- `@octokit/rest` 22.0.1 - GitHub REST API client; used by the publish (`src/publish/publish-mirror.ts` via `src/action/index.ts`) and cleanup (`src/cleanup/index.ts`) engines for Releases + Actions-cache-list operations
- `@octokit/plugin-retry` 8.1.0 and `@octokit/plugin-throttling` 11.0.3 - composed onto the base `Octokit` in `src/lib/resilient-octokit.ts` (`createResilientOctokit`) for 429/5xx retry and primary/secondary rate-limit backoff; the pairing mirrors the upstream-blessed `octokit@5.0.5` combination on `@octokit/core@7` (resolved: 7.0.6)

**Infrastructure (devDependencies, root `package.json`):**
- `nx` 23.1.0, `@nx/js` 23.1.0, `@nx/vitest` 23.1.0 - monorepo task graph, TypeScript build plugin, Vitest test plugin
- `typescript` ~6.0.3 (resolved 6.0.3), `tslib` ^2.3.0, `@types/node` ^24.0.0
- `vite` ^8.0.0 (peer of Vitest 4.x), `vitest` ~4.1.0, `@vitest/coverage-v8` ~4.1.0
- `esbuild` 0.28.1 (exact-pinned - drives the deterministic, git-diffable consumer bundle)
- `fallow` ~3.6.0, `prettier` ^3.8.1

**Zero-dependency-by-design surfaces:**
- The `node:http` server (`src/server/server.ts`), the GitHub Releases read client (`src/backend/releases-backend.ts`), and the cross-OS read-back script (`src/roundtrip/read-back.ts`) deliberately use only Node built-ins (`node:crypto`, `node:http`, native global `fetch`, `AbortSignal.timeout`) rather than an HTTP client library - documented in-code as a "zero-dependency-lean" (D-01/D-03) design constraint

## Configuration

**TypeScript project structure (composite project references):**
- `tsconfig.base.json` (root) - shared compiler options: `module`/`moduleResolution: nodenext`, `target: es2022`, `lib: ["es2022"]`, `strict: true`, `composite: true`, `isolatedModules: true`, `noUnusedLocals`, `noImplicitReturns`, `noImplicitOverride`, `esModuleInterop: false`, custom condition `@op-nx/source` (lets in-repo consumers resolve `./src/index.ts` directly instead of `./dist`)
- `tsconfig.json` (root) - solution file referencing `./packages/github-cache`
- `packages/github-cache/tsconfig.json` - references `tsconfig.lib.json` + `tsconfig.spec.json`
- `packages/github-cache/tsconfig.lib.json` - library build config (`rootDir: src`, `outDir: dist`, excludes `*.test.*`/`*.spec.*`)
- `packages/github-cache/tsconfig.spec.json` - test config (`outDir: ./out-tsc/vitest`, includes `vitest/globals`, `vitest/importMeta`, `vite/client` types)
- `tsconfig.action.json` (root) - standalone, non-composite config (`noEmit: true`, `types: ["node"]`) that typechecks the esbuild-reachable graph starting at `start-cache-server/entry.ts` (which lives outside the package tsconfig and is otherwise unchecked); run via `npm run typecheck:action`

**Nx (`nx.json`):**
- Plugins: `@nx/js/typescript` (targets: `typecheck`, `build` via `tsconfig.lib.json`), `@nx/vitest` (target: `test`, `testMode: watch`)
- `packages/github-cache/project.json` adds one extra, non-plugin-inferred target: `integration` (`vitest run --config vitest.integration.config.mts`)
- Custom `targetDefaults.integration` input includes a `{ "runtime": "node -p process.platform" }` hash discriminator so Linux and Windows integration-test hashes never collide (integration tests touch real sockets/filesystem)
- `targetDefaults.test` inputs pin in the governance/docs files (`SECURITY.md`, `README.md`, `docs/*.md`, workflow YAML) so a docs-only change still invalidates the tests that assert docs/code are in sync
- `analytics: false`; `release.version.preVersionCommand: "npx nx run-many -t build"`

**Vitest:**
- `packages/github-cache/vitest.config.mts` - unit-test project (`@op-nx/github-cache`), `environment: 'node'`, excludes `*.integration.spec.*`, own `cacheDir: '../../node_modules/.vite/packages/github-cache'`
- `packages/github-cache/vitest.integration.config.mts` - integration-test project (`@op-nx/github-cache:integration`), includes only `*.integration.spec.ts`, a distinct `cacheDir` so the two suites never race on Vite's cache in parallel worktrees
- `vitest.workspace.ts` (root) - glob pattern registering every `vite.config.*`/`vitest.config.*` for workspace discovery

**Build (esbuild):**
- `esbuild.action.mjs` - the only build script invoked outside Nx/tsc; bundles `start-cache-server/entry.ts` to `start-cache-server/index.js` (CJS, `target: node24`), with a `define`+`banner` shim for `import.meta.url` (needed because `@azure/storage-common`'s crc64 module, pulled in transitively through `@actions/cache`, calls `createRequire(import.meta.url)` at load time)
- `npm run check:action` rebuilds the bundle and `git diff --exit-code`s it - a drift guard enforced as its own CI job (`action-bundle-drift` in `ci.yml`)

**Formatting/Linting:**
- `.prettierrc` - `{ "singleQuote": true }` (implied minimal config)
- `.prettierignore` - present
- `.fallowrc.jsonc` - dead-code/reachability audit config (entry points, ignores)
- No ESLint config detected in the repo root listing

## Platform Requirements

**Development:**
- Node 24 (per `.node-version` = `lts/krypton`), npm (workspaces-aware)
- `gh` CLI and/or `git credential` helper optionally present on a developer machine for local Releases-mirror reads (`src/lib/local-context.ts` tiers: env, `gh auth token`, `git credential fill`)

**Production / CI:**
- GitHub Actions runners: `ubuntu-24.04-arm` (primary CI/lint/build jobs) and `windows-11-arm` (cross-OS integration matrix leg) per `.github/workflows/ci.yml`
- The consumer-facing `start-cache-server` action and the internal `packages/github-cache/action.yml` dogfood action both declare `runs.using: 'node24'`
- No Docker/container runtime detected anywhere in the repo (no `Dockerfile`, no `docker-compose*.yml`)
- Deployment target: none (this is a library + two GitHub Actions consumed by other repositories' CI, not a hosted service)

---

*Stack analysis: 2026-07-22*
