# Technology Stack

**Analysis Date:** 2026-07-18

## Current State Notice

This is a freshly torn-down Nx workspace SHELL (post Phase 0). The only project is the workspace root itself, `@op-nx/source` (`package.json`). `packages/` exists but contains only `packages/.gitkeep` — no libraries, no apps, no `src/` yet. Nothing below describes application code because none exists; a greenfield rebuild starts in Phase 1. This document reflects only the tooling/config actually present at the repo root.

## Languages

**Primary:**
- TypeScript `~6.0.3` — configured workspace-wide via `tsconfig.base.json` and `tsconfig.json`; no source files exist yet to compile

**Secondary:**
- None detected (no JS/other language source present)

## Runtime

**Environment:**
- Node.js — pinned via `.node-version` to `lts/krypton` (Node 24 LTS codename); local `node -v` resolves to `v24.13.0`

**Package Manager:**
- npm — `package.json` has no `packageManager` field, but `package-lock.json` is present and committed (231KB) and CI uses `npm ci` (`.github/workflows/ci.yml`)
- Lockfile: present — `package-lock.json`
- npm workspaces declared: `"workspaces": ["packages/*"]` in `package.json` (currently resolves to zero packages, since `packages/` is empty except `.gitkeep`)

## Frameworks

**Core:**
- Nx `23.1.0` — monorepo build/task orchestration, configured in `nx.json`
  - `@nx/js` `23.1.0` — the `@nx/js/typescript` plugin (registered in `nx.json`'s `plugins` array) infers `typecheck` and `build` targets from `tsconfig.lib.json` per project (none exist yet)
  - `@nx/vitest` `23.1.0` — the `@nx/vitest` plugin infers `test` targets (`testMode: "watch"` per `nx.json`)

**Testing:**
- Vitest `~4.1.0` — test runner, workspace-level config in `vitest.workspace.ts` (currently only excludes `vite.config.*` / `vitest.config.*` glob patterns — no test projects registered yet)
- `@vitest/coverage-v8` `~4.1.0` — V8-based coverage provider for Vitest

**Build/Dev:**
- Vite `^8.0.0` — declared as a devDependency; used transitively by `@nx/vitest` and available for future library builds
- `@swc/core` `1.15.8` + `@swc-node/register` `1.11.1` + `@swc/helpers` `0.5.18` — SWC-based fast TypeScript compilation/register, used by Nx's TS tooling
- Prettier `^3.8.1` — formatting, config in `.prettierrc` (`{"singleQuote": true}`), exclusions in `.prettierignore`
- `tslib` `^2.3.0` — TypeScript helper runtime (referenced via `importHelpers: true` in `tsconfig.base.json`)

## Key Dependencies

**Critical:**
- `typescript` `~6.0.3` — sole language compiler; `tsconfig.base.json` sets `strict: true`, `module`/`moduleResolution: "nodenext"`, `target: "es2022"`, `composite: true`, `emitDeclarationOnly: true`
- `nx` `23.1.0` — drives every workspace script (`build`, `typecheck`, `test`, `integration`, `format`) via `nx run-many -t <target>` in `package.json` scripts

**Infrastructure:**
- `@types/node` `^24.0.0` — Node type definitions, matches the pinned `lts/krypton` (Node 24) runtime

## Configuration

**Environment:**
- No `.env` or environment-variable files exist in the repo (confirmed by directory listing) — nothing to configure at this stage
- Node version pinned centrally in `.node-version` (`lts/krypton`), consumed by CI via `actions/setup-node@v6` with `node-version-file: '.node-version'`

**Build:**
- `nx.json` — defines `namedInputs` (`default`, `production`, `sharedGlobals`), registers the `@nx/js/typescript` and `@nx/vitest` plugins, and sets `targetDefaults` for `build`, `typecheck`, `test`, and `integration` (the `integration` target default includes a `{ "runtime": "node -p process.platform" }` hash input to keep OS-specific results from colliding in the Nx cache)
- `tsconfig.base.json` — shared compiler options inherited by all future project `tsconfig.lib.json`/`tsconfig.spec.json` files
- `tsconfig.json` — root solution-style config (`files: []`, `references: []`), extends `tsconfig.base.json`
- `vitest.workspace.ts` — workspace-level Vitest project list (currently only glob-excludes config files; no projects registered)
- `.prettierrc` / `.prettierignore` — formatting config and exclusions (excludes `/dist`, `/coverage`, `.nx/*`, and GSD planning/agent docs: `.planning/`, `CLAUDE.md`, `AGENTS.md`, `.claude/`, `.gsd-migration-backup/`)
- `.gitattributes` — forces `* text=auto eol=lf` workspace-wide specifically to keep Nx task-hash inputs byte-identical across Windows/Linux checkouts (avoids CRLF-induced cache misses)

## Platform Requirements

**Development:**
- Node.js `lts/krypton` (Node 24), per `.node-version`
- npm (lockfile-based install: `npm ci` in CI, `npm install` locally)

**Production:**
- No deployment target defined yet — no app/service code exists. CI (`.github/workflows/ci.yml`) currently runs `format-check`, `build`, `typecheck`, `test` jobs on `ubuntu-24.04-arm`, plus an `integration` job matrixed across `ubuntu-24.04-arm` and `windows-11-arm` (this job is a green no-op today since no `integration` target/project exists yet — the workflow scaffolds the cross-OS matrix ahead of Phase 3)

---

*Stack analysis: 2026-07-18*
