# Testing Patterns

**Analysis Date:** 2026-07-18

## Current State: No Tests Exist Yet

This is a JUST-torn-down Nx workspace shell. **There are zero test files in the repository** — no `*.test.ts`, `*.spec.ts`, or any test directory exists anywhere outside `node_modules`. The only project is `@op-nx/source` (workspace root), and `packages/` contains only a placeholder `packages/.gitkeep`. A greenfield rebuild starts in Phase 1, which will introduce the first source and test files.

Everything below documents the test tooling/config already wired up to GOVERN future tests — framework, targets, and CI invocation — not observed test patterns, since none exist yet.

## Test Framework

**Runner:**
- Vitest `~4.1.0` (`vitest` in `package.json` `devDependencies`)
- Coverage provider: `@vitest/coverage-v8` `~4.1.0`
- Workspace glob config: `vitest.workspace.ts`:
  ```ts
  export default [
    '**/vite.config.{mjs,js,ts,mts}',
    '**/vitest.config.{mjs,js,ts,mts}',
  ];
  ```
  This tells Vitest's workspace mode to discover a `vite.config.*` or `vitest.config.*` per-project — none exist yet since there are no projects under `packages/`.
- Nx integration via the `@nx/vitest` plugin, registered in `nx.json`:
  ```json
  {
    "plugin": "@nx/vitest",
    "options": {
      "testTargetName": "test",
      "testMode": "watch"
    }
  }
  ```
  This plugin infers a `test` target for any project with a discoverable Vitest config — none exists yet.
- Transpilation support: `@swc/core`, `@swc-node/register`, `@swc/helpers` are present as devDependencies, implying Vitest will use SWC (via `@nx/vitest`'s default toolchain) rather than `ts-node`/`esbuild` for fast TS transforms.

**Assertion Library:**
- Vitest's built-in `expect` (Chai-compatible) — no separate assertion library (`chai`, `jest-extended`, etc.) is installed.

**Run Commands:**
```bash
npx nx run-many -t test          # Run tests for all projects (root package.json "test" script)
npx nx test <project>             # Run tests for a single project (once projects exist)
```
No dedicated watch-mode or coverage npm script is defined at the root; `@nx/vitest`'s `testMode: "watch"` option controls whether the inferred `test` target defaults to watch mode. CI invokes the plain `npm run test` script (`nx run-many -t test`), which runs non-interactively.

## Test Target Configuration (`nx.json`)

The `test` target default in `nx.json` sets caching inputs but no project defines the target yet:
```json
"test": {
  "dependsOn": ["^build"],
  "inputs": [
    "default",
    "^production",
    { "fileset": "{projectRoot}/tsconfig.spec.json", "dependencies": true },
    { "fileset": "{projectRoot}/tsconfig.storybook.json", "dependencies": true },
    { "json": "{workspaceRoot}/tsconfig.json", "fields": ["compilerOptions"] },
    { "externalDependencies": ["vitest"] },
    { "dependentTasksOutputFiles": "**/*.js", "transitive": true }
  ]
}
```
Notable implications for future test authoring:
- `dependsOn: ["^build"]` — unit tests run against BUILT dependency outputs, not source, for any cross-package dependency (build the dependency first, then test).
- A `tsconfig.spec.json` fileset is expected per-project — future packages should add one alongside `tsconfig.lib.json` to scope the test-only TypeScript config (e.g., including `@vitest/coverage-v8` types or test globals not needed in production code).
- A `tsconfig.storybook.json` fileset is also referenced defensively (Storybook is not currently installed; this is inert until/unless a package adds Storybook).

**Separate `integration` target** (distinct from `test`) is also defined in `nx.json` target defaults:
```json
"integration": {
  "cache": true,
  "dependsOn": ["^build"],
  "inputs": [
    "default",
    "^production",
    { "fileset": "{projectRoot}/tsconfig.spec.json", "dependencies": true },
    { "json": "{workspaceRoot}/tsconfig.json", "fields": ["compilerOptions"] },
    { "externalDependencies": ["vitest"] },
    { "dependentTasksOutputFiles": "**/*.js", "transitive": true },
    { "runtime": "node -p process.platform" }
  ]
}
```
- No project currently defines an `integration` target — this is scaffolding for Phase 1+, intended for tests that hit real OS surface (real sockets, real filesystem/tmpdir) rather than pure unit tests.
- The `{ "runtime": "node -p process.platform" }` input is a deliberate cross-OS cache discriminator: Linux and Windows runs compute different Nx hashes for this target, so a Linux-computed cache entry can never be replayed to satisfy a Windows run (and vice versa). This is intentional — do not remove it when adding the first `integration` target, or cross-OS integration tests will silently reuse a wrong-OS cache result.
- CI (`.github/workflows/ci.yml`) already runs an `integration` job on an `ubuntu-24.04-arm` + `windows-11-arm` matrix (`fail-fast: false`) via `npm run integration` (`nx run-many -t integration`) — currently a green no-op since no project defines the target yet.

## Test File Organization

Not established — no test files or directories exist yet. Given the `@nx/vitest` plugin's discovery mechanism (globbing `vite.config.*`/`vitest.config.*` per project directory via `vitest.workspace.ts`), expect each future `packages/<name>/` project to own its own `vitest.config.ts` and co-located or `src/`-nested test files, matched against the `tsconfig.spec.json` fileset referenced in the `test` target inputs.

## Test Structure / Mocking / Fixtures / Coverage

Not established — no test code exists yet to show suite structure, mocking patterns, fixtures, or coverage configuration. `@vitest/coverage-v8` is installed but no coverage thresholds or reporters are configured anywhere in the repo.

## CI Test Execution

`.github/workflows/ci.yml` defines five jobs, all on `ubuntu-24.04-arm` (except `integration`, which matrixes `ubuntu-24.04-arm` + `windows-11-arm`):

| Job | Command | Purpose |
|-----|---------|---------|
| `format-check` | `npx nx format:check --all` | Prettier check (uses `--all` since PR checkouts lack a local `main` ref for Nx's git-diff base) |
| `build` | `npm run build` (`nx run-many -t build`) | Build all projects |
| `typecheck` | `npm run typecheck` (`nx run-many -t typecheck`) | Type-check all projects |
| `test` | `npm run test` (`nx run-many -t test`) | Unit tests, all projects |
| `integration` | `npm run integration` (`nx run-many -t integration`), matrix `[ubuntu-24.04-arm, windows-11-arm]`, `fail-fast: false` | Cross-OS integration tests (currently a no-op; scaffolding for Phase 3+) |

All jobs use `actions/setup-node@v6` with `node-version-file: '.node-version'` (currently `lts/krypton`) and `cache: 'npm'`, then `npm ci` before running their command.

---

*Testing analysis: 2026-07-18*
