# Coding Conventions

**Analysis Date:** 2026-07-18

## Current State: Empty Workspace Shell

This is a JUST-torn-down Nx workspace. There is exactly one project, `@op-nx/source` (the workspace root itself, `package.json`), and no `packages/*` project yet — `packages/` contains only a placeholder `packages/.gitkeep`. **No source files exist anywhere in the repo** (no `src/`, no `.ts`/`.tsx` files outside tooling/config). A greenfield rebuild starts in Phase 1.

Everything below documents the tooling/config that will GOVERN conventions once code is written — not observed patterns, since there is no code yet to observe. Treat this document as a set of constraints/defaults for the first source files, not a description of existing style.

## Naming Patterns

**Files:**
- Not established — no source files exist yet.
- The single workspace package is named `@op-nx/source` (`package.json`); future packages under `packages/*` should follow the same `@op-nx/<name>` scope per the `workspaces": ["packages/*"]` field in `package.json`.

**Functions / Variables / Types:**
- Not established — no source code exists yet to infer patterns from.

## Code Style

**Formatting:**
- Prettier, config at `.prettierrc`:
  ```json
  { "singleQuote": true }
  ```
  All other Prettier defaults apply (2-space indent, semicolons, trailing commas per Prettier's default `"es5"`, 80-char print width, etc.) since nothing else is overridden.
- Ignore rules in `.prettierignore`: `/dist`, `/coverage`, `/.nx/cache`, `/.nx/workspace-data`, `.nx/self-healing`, and GSD/agent planning docs (`.planning/`, `CLAUDE.md`, `AGENTS.md`, `.claude/`, `.gsd-migration-backup/`) are excluded from formatting.
- Run via Nx, not the Prettier CLI directly: `npx nx format:write` / `npx nx format:check` (aliased as `npm run format` / `npm run format:check` in `package.json`). CI runs `npx nx format:check --all` in `.github/workflows/ci.yml` (the `--all` flag is required in CI because PR checkouts have no local `main` ref for Nx's git-diff-based default).

**Linting:**
- No ESLint (or other linter) config present at repo root. Not detected.

## TypeScript Configuration

**Base config:** `tsconfig.base.json` (extended by `tsconfig.json`, which currently has empty `files`/`references` arrays since there are no projects to reference yet):

- `"strict": true` — full strict-mode type checking is mandatory for all future code.
- `"module": "nodenext"`, `"moduleResolution": "nodenext"` — ESM-first, Node.js-native module resolution. Import specifiers must follow Node ESM rules (explicit file extensions for relative imports once files exist, package `exports` map resolution for dependencies).
- `"target": "es2022"`, `"lib": ["es2022"]` — no need to target older JS runtimes.
- `"isolatedModules": true` — every file must be independently transpilable (no const enums, no ambiguous re-exports); consistent with `@swc/core`/`@swc-node/register` being used for fast transpilation.
- `"composite": true`, `"declarationMap": true`, `"emitDeclarationOnly": true` — this is a TypeScript project-references setup; each future package should ship its own `tsconfig.lib.json` producing `.d.ts` + declaration maps only (JS emit happens via the build tool, not `tsc`).
- `"noUnusedLocals": true`, `"noImplicitReturns": true`, `"noFallthroughCasesInSwitch": true`, `"noImplicitOverride": true` — strict hygiene rules enforced at the type-checker level; write code assuming these are enforced, not just recommended.
- `"esModuleInterop": false` — do not rely on CJS/ESM interop default-import shims; use explicit named imports or namespace imports (`import * as x from 'x'`) for CJS-only packages.
- `"customConditions": ["@op-nx/source"]` — package `exports` conditional resolution is scoped to this custom condition; relevant when a future package defines conditional `exports` maps.
- `"skipLibCheck": true` — third-party `.d.ts` files are not type-checked.

**Enforcement targets** (via the `@nx/js/typescript` Nx plugin registered in `nx.json`):
- `build` target — `tsconfig.lib.json`-based (per-project, not yet created).
- `typecheck` target — runs `tsc --noEmit`-equivalent checking against the `production` named input (excludes spec/test files and `tsconfig.spec.json` from the fileset).

## Import Organization

Not established — no source files exist yet. Given `"module": "nodenext"`, expect Node ESM import rules to apply once code is written (explicit extensions on relative imports, no implicit `index` resolution without an `exports` map entry).

## Error Handling

Not established — no source code exists yet.

## Logging

Not established — no source code exists yet.

## Comments

Not established — no source code exists yet.

## Function Design

Not established — no source code exists yet.

## Module Design

**Package boundaries:**
- The root `package.json` defines `"workspaces": ["packages/*"]` (npm workspaces) — future packages live under `packages/<name>/`.
- `nx.json` registers exactly two Nx plugins that infer targets from project config, so per-project `project.json` files are optional/inferred:
  - `@nx/js/typescript` — infers `build` (from `tsconfig.lib.json`) and `typecheck` targets.
  - `@nx/vitest` — infers the `test` target (`testMode: "watch"` by default per plugin options; CI runs it non-interactively via `nx run-many -t test`).
- `nx.json` target defaults define an additional `integration` target (cached, depends on `^build`) with a platform-sensitive input (`{ "runtime": "node -p process.platform" }`) so cross-OS integration-test cache entries never collide between Linux and Windows runs. No project currently defines this target — it is scaffolding for Phase 1+.

**Exports:** Not established — no packages exist yet to define an `exports` map.

---

*Convention analysis: 2026-07-18*
