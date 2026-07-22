<!-- refreshed: 2026-07-18 -->
# Architecture

**Analysis Date:** 2026-07-18

## System Overview

There is no application architecture to diagram. The repository is an empty Nx
workspace shell produced by a Phase 0 teardown. The only Nx project is the
workspace root itself (`@op-nx/source`); `packages/` contains a single
`packages/.gitkeep` placeholder and no project directories. No `src/`, no
runtime code, no libraries, no apps exist yet.

```text
┌─────────────────────────────────────────────────────────────┐
│                  Nx workspace root project                   │
│                    `@op-nx/source`                           │
│              (package.json + nx.json + tsconfig*)             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│               `packages/` (empty, `.gitkeep` only)            │
│         Reserved location for future project packages         │
└─────────────────────────────────────────────────────────────┘
```

A greenfield rebuild starts in Phase 1, which is expected to populate
`packages/` with the first real project(s) and give this document actual
layers, components, and data flow to describe.

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Workspace root project | Declares the single Nx project `@op-nx/source`; hosts root scripts (`build`, `typecheck`, `test`, `integration`, `format`) | `package.json` |
| Nx configuration | Registers `@nx/js/typescript` and `@nx/vitest` inferred-task plugins; defines `targetDefaults` for `test`, `integration`, `build`, `typecheck` | `nx.json` |
| TypeScript project references root | Empty composite root (`files: []`, `references: []`) — no projects reference it yet | `tsconfig.json` |
| TypeScript compiler baseline | Shared strict compiler options inherited by any future project tsconfig | `tsconfig.base.json` |
| Vitest workspace glob | Declares where Vitest should discover project configs (`vite.config.*` / `vitest.config.*`) — currently matches nothing since no project has one | `vitest.workspace.ts` |
| CI pipeline | Runs format-check, build, typecheck, test, and a dormant cross-OS `integration` matrix job on every push/PR | `.github/workflows/ci.yml` |
| Line-ending normalization | Forces `eol=lf` on all text files so Nx's content-hash-based caching is identical across Windows/Linux checkouts | `.gitattributes` |
| Empty packages placeholder | Reserves the `packages/` directory in git (directories are not tracked empty) so Phase 1 has a known location to scaffold into | `packages/.gitkeep` |

## Pattern Overview

**Overall:** Empty Nx monorepo shell (single-project workspace, no libs/apps yet).

**Key Characteristics:**
- Nx's inferred-tasks model is used exclusively — `@nx/js/typescript` and
  `@nx/vitest` plugins infer `build`, `typecheck`, and `test` targets from
  each project's own config files (e.g. `tsconfig.lib.json`,
  `vite.config.ts`), not from hand-written `project.json` target definitions.
  Since no project exists yet, no targets are currently inferred anywhere but
  the workspace root.
- `targetDefaults` in `nx.json` pre-declare caching/input rules for `test`,
  `build`, `typecheck`, and a not-yet-plugin-backed `integration` target —
  these are scaffolding for Phase 1+ projects, not evidence of existing code.
- npm workspaces (`"workspaces": ["packages/*"]` in `package.json`) delegate
  package resolution to `packages/*`, currently matching zero packages.

## Layers

There are no application layers. The only "layer" present is workspace
tooling/config at the repo root:

**Workspace configuration layer:**
- Purpose: Nx task graph, TypeScript compiler defaults, formatting, and CI
  wiring for whatever projects get added starting Phase 1.
- Location: repo root (`nx.json`, `tsconfig.base.json`, `tsconfig.json`,
  `package.json`, `vitest.workspace.ts`, `.prettierrc`, `.prettierignore`)
- Contains: JSON/TS configuration files only, no source code
- Depends on: `node_modules` (Nx, TypeScript, Vitest, Prettier toolchains)
- Used by: any future project added under `packages/`

## Data Flow

There is no request path, no build pipeline output, and no runtime data flow
— there is no application code to trace. The only "flow" that exists today is
the CI job sequence, which runs against an empty project set:

### CI job sequence (`.github/workflows/ci.yml`)

1. `format-check` — `npx nx format:check --all` (no per-project diff base on
   PR checkouts, so it always runs against the full workspace)
2. `build` — `npm run build` -> `nx run-many -t build` (currently a no-op:
   zero projects have a `build` target)
3. `typecheck` — `npm run typecheck` -> `nx run-many -t typecheck` (currently
   a no-op)
4. `test` — `npm run test` -> `nx run-many -t test` (currently a no-op)
5. `integration` — matrix job across `ubuntu-24.04-arm` and `windows-11-arm`,
   `npm run integration` -> `nx run-many -t integration` (currently a no-op;
   see Architectural Constraints below for why the matrix exists despite
   having nothing to run yet)

**State Management:** Not applicable — no application state exists.

## Key Abstractions

None yet. No domain types, services, or modules exist in this codebase state.

## Entry Points

**CI workflow:**
- Location: `.github/workflows/ci.yml`
- Triggers: push to `main`, and every pull request
- Responsibilities: format-check, build, typecheck, test, and cross-OS
  integration jobs — all currently operating over an empty project set

**Root package scripts:**
- Location: `package.json` `scripts` block
- Triggers: manually via `npm run <script>` or from CI
- Responsibilities: thin wrappers around `nx run-many -t <target>` /
  `nx format:write|check`

There is no application entry point (no `src/index.ts`, no `main.ts`, no
server bootstrap) because there is no application yet.

## Architectural Constraints

- **Threading:** Not applicable — no runtime code exists.
- **Global state:** None — no modules exist to hold state.
- **Circular imports:** None possible — there are zero source files to import
  from each other.
- **Dormant `integration` targetDefault:** `nx.json` `targetDefaults.integration`
  is preconfigured with `cache: true`, `dependsOn: ["^build"]`, and an input
  set that mirrors `test` plus one extra entry:
  `{ "runtime": "node -p process.platform" }`. No plugin currently produces an
  `integration` target (neither `@nx/js/typescript` nor `@nx/vitest` emits
  one), so this default is inert until a future project defines its own
  `integration` target (via `project.json` or an inferred-task plugin) that
  Nx can merge these defaults into. This is deliberate cross-OS scaffolding
  for a later phase (see `.github/workflows/ci.yml` inline comment,
  lines 59-70), not dead configuration.
- **`node -p process.platform` runtime discriminator:** This input, once a
  real `integration` target exists, forces Nx to compute a different task
  hash on Windows vs. Linux/macOS, so a Linux-computed cache entry can never
  be replayed as a false-positive hit for a Windows run (and vice versa).
  `process.platform` is chosen over `env:RUNNER_OS` (unset outside CI, so it
  can't discriminate local Windows runs) and over a plain `env` var (MSYS/Git
  Bash uppercases env var keys while Nx's env hasher is case-sensitive).
- **`.gitattributes` `* text=auto eol=lf`:** Normalizes all text file line
  endings to LF on checkout on every platform. This exists because Nx hashes
  file *contents* for cache keys — without this, a Windows checkout (GitHub
  Actions runners default to `core.autocrlf=true`) would produce CRLF bytes
  and compute a different hash than a Linux/macOS checkout of the same
  logical file, silently breaking cross-OS and local cache hits for any
  target that runs on the Windows CI leg (the `integration` matrix job in
  particular). Both this file and the `integration` targetDefault are
  preserved, dormant scaffolding intended to make cross-OS cache-hit parity
  work correctly once Phase 1+ adds real projects and an `integration` target.

## Anti-Patterns

None observed — there is no source code in which an anti-pattern could occur.

## Error Handling

**Strategy:** Not applicable — no application code exists to define an error
handling strategy.

## Cross-Cutting Concerns

**Logging:** Not applicable.
**Validation:** Not applicable.
**Authentication:** Not applicable.

---

*Architecture analysis: 2026-07-18*
