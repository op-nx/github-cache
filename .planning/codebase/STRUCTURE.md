# Codebase Structure

**Analysis Date:** 2026-07-18

## Directory Layout

```
github-cache/
├── .github/                  # CI workflow + agent/skill docs (no app code)
│   ├── workflows/ci.yml      # format-check, build, typecheck, test, integration jobs
│   ├── agents/                # ci-monitor-subagent.agent.md
│   ├── prompts/                # monitor-ci.prompt.md
│   └── skills/                # nx-generate, nx-import, nx-plugins, nx-run-tasks,
│                                nx-workspace, monitor-ci, link-workspace-packages
├── .planning/                # GSD planning artifacts (roadmap, phase plans, codebase docs)
├── .vscode/                  # editor extension recommendations only
├── packages/                 # EMPTY — reserved for future Nx projects
│   └── .gitkeep              # placeholder (git does not track empty directories)
├── plans/                    # gitignored scratch plan files (see .gitignore `/plans/`)
├── node_modules/             # installed dependencies (gitignored)
├── .gitattributes            # forces `eol=lf` for cross-OS Nx hash parity
├── .gitignore
├── .node-version              # `lts/krypton`
├── .prettierrc                # `{ "singleQuote": true }`
├── .prettierignore
├── AGENTS.md                  # agent-agnostic Nx workspace guidelines
├── CLAUDE.md                  # `@AGENTS.md` + GSD workflow-enforcement note
├── README.md                  # one-line workspace description
├── package.json               # workspace root project `@op-nx/source`, npm workspaces = packages/*
├── package-lock.json
├── nx.json                    # plugins, namedInputs, targetDefaults (build/test/typecheck/integration)
├── tsconfig.json               # empty composite root (files: [], references: [])
├── tsconfig.base.json          # shared strict compiler options
└── vitest.workspace.ts         # glob for future vite/vitest configs (currently matches nothing)
```

There is no `src/` directory, no `apps/` directory, and no `libs/` directory
at the repo root — only `packages/` is reserved, and it is currently empty.

## Directory Purposes

**`packages/`:**
- Purpose: reserved root for all future Nx projects (npm workspace glob
  `packages/*` in `package.json`, and the implied convention for this
  workspace layout).
- Contains: nothing but `packages/.gitkeep` today.
- Key files: none yet.

**`.github/`:**
- Purpose: CI pipeline definition plus a substantial set of agent-facing
  skill/prompt docs for Nx workflows (generation, import, plugins, running
  tasks, workspace exploration) and a CI-monitoring subagent.
- Contains: one real workflow (`ci.yml`) and many `SKILL.md` / `.agent.md` /
  `.prompt.md` reference docs — no application source.
- Key files: `.github/workflows/ci.yml`.

**`.planning/`:**
- Purpose: GSD (Get Shit Done) planning system state for this project —
  roadmap, phase plans, and this codebase map.
- Contains: markdown planning artifacts, not source code.

**`plans/`:**
- Purpose: gitignored scratch directory for ad-hoc plan files (distinct from
  `.planning/`); listed in `.gitignore` as `/plans/`.
- Generated/committed: not committed.

## Key File Locations

**Entry Points:**
- None. No application entry point exists (no `src/index.ts`, no server
  bootstrap file).

**Configuration:**
- `nx.json`: Nx plugin registration (`@nx/js/typescript`, `@nx/vitest`),
  `namedInputs`, and `targetDefaults` for `build`, `test`, `typecheck`, and
  the dormant `integration` target.
- `tsconfig.json`: workspace-level composite TS root, currently empty
  (`files: []`, `references: []`) — will need entries once projects exist.
- `tsconfig.base.json`: shared strict compiler options (`strict: true`,
  `module: nodenext`, `target: es2022`, `composite: true`,
  `emitDeclarationOnly: true`, etc.) that any future project tsconfig should
  extend.
- `vitest.workspace.ts`: glob pattern for discovering `vite.config.*` /
  `vitest.config.*` files across the workspace; matches zero files today.
- `.prettierrc` / `.prettierignore`: formatting config and exclusions
  (`.planning/`, `CLAUDE.md`, `AGENTS.md`, `.claude/`,
  `.gsd-migration-backup/` are excluded from Prettier).
- `.node-version`: pins Node to `lts/krypton` for local + CI consistency.

**Core Logic:**
- None. No `src/` or project directories exist.

**Testing:**
- None. No test files, no test project config exists yet. `vitest.workspace.ts`
  is present but has nothing to discover.

## Naming Conventions

**Files:**
- Root-level dotfiles/config follow standard tool conventions
  (`.prettierrc`, `.gitattributes`, `.node-version`, `nx.json`,
  `tsconfig.base.json`).
- No project-level file naming conventions exist yet — nothing to observe.

**Directories:**
- `packages/<project-name>` is the implied convention (from the npm
  workspaces glob `packages/*`), matching Nx's common monorepo layout.
- No specific `<project-name>` conventions (kebab-case vs. scoped names) can
  be inferred yet since zero packages exist.

## Where to Add New Code

**New Feature / New Project (Phase 1+):**
- Create a new directory under `packages/`, e.g. `packages/<name>/`, using
  an Nx generator (see the `nx-generate` skill referenced in `AGENTS.md`/
  `CLAUDE.md`) rather than hand-authoring `project.json` — this workspace
  relies on the `@nx/js/typescript` and `@nx/vitest` inferred-task plugins,
  so new projects should carry their own `tsconfig.lib.json` /
  `vite.config.ts` and let Nx infer `build`/`typecheck`/`test` targets.
- Add the new package's tsconfig as a `reference` in the root `tsconfig.json`
  (currently `references: []`).
- Extend `tsconfig.base.json` compiler options only if a workspace-wide
  change is needed — otherwise let each package's own tsconfig extend the
  base.

**New Component/Module:**
- Not applicable until a first package exists under `packages/`.

**Utilities:**
- No shared utility location exists yet. Establish one (e.g.
  `packages/shared/` or similar) only when a second package needs to reuse
  code — do not pre-create it speculatively.

## Special Directories

**`packages/`:**
- Purpose: reserved location for future Nx projects.
- Generated: no (the `.gitkeep` file is manually committed to keep the empty
  directory in git).
- Committed: yes (`packages/.gitkeep` only).

**`.nx/`:**
- Purpose: Nx daemon cache and workspace metadata (`cache/`,
  `workspace-data/`).
- Generated: yes.
- Committed: no (`.nx/cache`, `.nx/workspace-data`, `.nx/polygraph`,
  `.nx/self-healing`, `.nx/migrate-runs` are all gitignored).

**`node_modules/`:**
- Purpose: installed npm dependencies.
- Generated: yes (via `npm ci`/`npm install`).
- Committed: no.

**`.planning/`:**
- Purpose: GSD planning artifacts (roadmap, phase plans, codebase docs
  including this file).
- Generated: partially (hand-authored + agent-generated markdown).
- Committed: yes.

---

*Structure analysis: 2026-07-18*
