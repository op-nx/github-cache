# Codebase Structure

**Analysis Date:** 2026-07-17

## Directory Layout

```
github-cache/                          # Nx monorepo root (@op-nx/source)
|-- .github/
|   |-- workflows/
|   |   |-- ci.yml                     # build/typecheck/test/integration/publish-mirror/windows-selfcheck
|   |   '-- mirror-cleanup.yml         # daily scheduled mirror prune (single writer)
|   |-- skills/                        # Nx agent skills (nx-workspace, nx-generate, nx-run-tasks, ...)
|   |-- agents/                        # ci-monitor-subagent.agent.md
|   '-- prompts/                       # monitor-ci.prompt.md
|-- .agents/skills/                    # agent-agnostic skill mirror (same set as .github/skills)
|-- .claude/ .codex/ .cursor/ .gemini/ .opencode/   # per-agent-tool config/skill mirrors
|-- .planning/                         # GSD planning artifacts (this doc set lives in codebase/)
|-- .verdaccio/                        # local npm registry config for the local-registry target
|-- .vscode/                           # editor settings
|-- packages/
|   '-- op-nx-github-cache/            # THE package (@op-nx/github-cache) -- only project in the workspace
|       |-- src/
|       |   |-- index.ts               # public API barrel
|       |   |-- bin/                   # CLI entry points (serve, publish-mirror, publish-mirror-cleanup) + specs
|       |   '-- lib/
|       |       |-- server.ts          # HTTP protocol layer
|       |       |-- trust.ts           # trusted-event write gate
|       |       |-- shard.ts           # month-shard / retention math
|       |       |-- cleanup.ts         # pure retention decisions
|       |       |-- types.ts           # CacheBackend port, HASH_PATTERN
|       |       '-- backends/          # actions-cache / release-mirror adapters + selector
|       |-- __fixtures__/              # act harness: act-workflow.yml, act-round-trip.mjs, pull_request_target-event.json
|       |-- dist/                      # build output (gitignored; bins run from here in CI)
|       |-- out-tsc/                   # typecheck output (gitignored)
|       |-- vitest.config.mts          # unit test config (excludes *.integration.*)
|       |-- vitest.integration.config.mts  # integration test config (real sockets/fs)
|       |-- tsconfig.json              # solution file -> lib + spec
|       |-- tsconfig.lib.json          # src -> dist
|       |-- tsconfig.spec.json         # specs -> out-tsc/vitest
|       |-- package.json               # bins, deps, nx targets (integration), test:act scripts
|       '-- README.md                  # ALL usage/setup/CI-wiring docs live here, not the root README
|-- publish-mirror/                    # GitHub JS action: action.yml, index.cjs, selfcheck.cjs
|-- start-cache-server/                # GitHub JS action: action.yml, index.cjs, selfcheck.cjs
|-- nx.json                            # plugins (@nx/js/typescript, @nx/vitest), targetDefaults, named inputs
|-- package.json                       # workspace root (@op-nx/source), npm workspaces: packages/*
|-- tsconfig.base.json                 # strict, nodenext, composite; customConditions: ["@op-nx/source"]
|-- tsconfig.json                      # root solution -> packages/op-nx-github-cache
|-- vitest.workspace.ts                # glob of vitest configs
|-- .node-version                      # Node version pin (setup-node reads it)
|-- .prettierrc / .prettierignore
|-- AGENTS.md / CLAUDE.md              # agent instructions (CLAUDE.md imports AGENTS.md)
'-- README.md                          # workspace-level pointer to the package README
```

## Directory Purposes

**`packages/op-nx-github-cache/`:**
- Purpose: The only publishable package -- the entire product (server, backends, mirror pipeline).
- Contains: ESM TypeScript sources, co-located specs, act fixtures, per-package vitest/tsconfig files.
- Key files: `src/index.ts`, `src/lib/server.ts`, `src/lib/backends/index.ts`, `package.json` (three `bin` entries).

**`packages/op-nx-github-cache/src/lib/`:**
- Purpose: All library logic. Pure decision modules (`shard.ts`, `cleanup.ts`, `trust.ts`, `types.ts`) sit at this level; storage adapters in `backends/`.
- Contains: one module per concern, each with a co-located `.spec.ts`.

**`packages/op-nx-github-cache/src/bin/`:**
- Purpose: CLI entry points wired into `package.json` `bin`. Exported helpers here (e.g. `filterNxCacheKeys`, `cleanupMirror`, `resolvePort`) are unit-tested via co-located specs; `main()` only runs under the `pathToFileURL` CLI guard.

**`start-cache-server/` and `publish-mirror/` (repo root):**
- Purpose: GitHub JavaScript actions. MUST stay at the repo root (workflows reference `uses: ./start-cache-server`) and MUST use Node built-ins only (they run before `npm ci`). CommonJS (`.cjs`).
- Contains: `action.yml` (metadata, `command` input defaulting to the published bin), `index.cjs` (the action), `selfcheck.cjs` (framework-free assertions run standalone on Windows CI).

**`packages/op-nx-github-cache/__fixtures__/`:**
- Purpose: Opt-in `act`-based end-to-end harness (`npm run test:act` / `test:act:untrusted` from the package dir). Never part of `nx test`.
- Key files: `act-workflow.yml`, `act-round-trip.mjs`, `pull_request_target-event.json`.

**`.github/workflows/`:**
- Purpose: CI orchestration. `ci.yml` dogfoods the just-built server in every job; `mirror-cleanup.yml` is the mirror's single cleanup writer.

**`.github/skills/`, `.agents/skills/`, `.claude/`, `.cursor/`, `.opencode/`, `.codex/`, `.gemini/`:**
- Purpose: AI-agent tooling config and Nx skill mirrors (nx-workspace, nx-generate, nx-import, nx-plugins, nx-run-tasks, monitor-ci, link-workspace-packages). No product code.

**`.verdaccio/`:**
- Purpose: Config for the root `local-registry` Nx target (`@nx/js:verdaccio`, port 4873) for local publish testing.

## Key File Locations

**Entry Points:**
- `packages/op-nx-github-cache/src/bin/serve.ts`: cache server CLI (`op-nx-github-cache-serve`)
- `packages/op-nx-github-cache/src/bin/publish-mirror.ts`: mirror upload CLI
- `packages/op-nx-github-cache/src/bin/publish-mirror-cleanup.ts`: mirror prune CLI
- `packages/op-nx-github-cache/src/index.ts`: library barrel (public API)
- `start-cache-server/index.cjs`, `publish-mirror/index.cjs`: GitHub action mains

**Configuration:**
- `nx.json`: plugin-inferred targets (`build`, `typecheck`, `test`), explicit `integration` target defaults incl. the OS discriminator input `{ "runtime": "node -p process.platform" }`
- `tsconfig.base.json`: strict ESM/nodenext baseline shared by all tsconfigs
- `packages/op-nx-github-cache/package.json`: bins, `nx.targets.integration` command, `test:act` scripts
- `.node-version`: Node pin used by all CI jobs

**Core Logic:**
- `packages/op-nx-github-cache/src/lib/server.ts`: HTTP protocol + trust enforcement
- `packages/op-nx-github-cache/src/lib/backends/`: storage adapters + `selectBackend`
- `packages/op-nx-github-cache/src/lib/shard.ts`: retention/shard math (read + cleanup coupling)

**Testing:**
- Co-located: `src/**/<name>.spec.ts` (unit), `src/**/<name>.integration.spec.ts` (integration)
- Configs: `vitest.config.mts` (unit -- excludes integration glob), `vitest.integration.config.mts` (integration only; filename deliberately does NOT match `@nx/vitest`'s config glob so it stays out of the inferred `test` target)

## Naming Conventions

**Files:**
- kebab-case TypeScript modules: `actions-cache-backend.ts`, `publish-mirror-cleanup.ts`
- Backends end in `-backend.ts` under `src/lib/backends/`
- Unit specs: `<module>.spec.ts`, co-located. Integration specs: `<module>.integration.spec.ts`, co-located
- GitHub actions: directory per action at repo root, always `action.yml` + `index.cjs` + `selfcheck.cjs`
- ESM sources import relatives with the `.js` extension (`from './trust.js'`) -- required by `module: nodenext`

**Directories:**
- Package dir name mirrors the scoped npm name flattened: `packages/op-nx-github-cache` -> `@op-nx/github-cache`
- `__fixtures__/` for test-only harness files

**Identifiers / artifacts:**
- Published bins: `op-nx-github-cache-<command>`
- Mirror Release shards: `cache-mirror-<yyyymm>` tags (see `MIRROR_SHARD_PATTERN` in `src/bin/publish-mirror.ts:97`)
- Env knobs: SCREAMING_SNAKE (`CACHE_MIRROR_MAX_AGE_DAYS`, `MAX_CACHE_BODY_BYTES`, `PORT`, `DEFAULT_BRANCH`), each resolved through a `resolve*` helper with warn-and-default semantics
- Module-level constants: SCREAMING_SNAKE (`HASH_PATTERN`, `TRUSTED_EVENTS`, `READY_TIMEOUT_MS`)

## Where to Add New Code

**New library logic (validation, retention, protocol behavior):**
- Primary code: `packages/op-nx-github-cache/src/lib/<concern>.ts` -- extract any risky decision as a pure exported function (the `planShardCleanup` / `filterNxCacheKeys` pattern) so it is testable without I/O
- Tests: co-located `<concern>.spec.ts`
- Public surface: re-export from `packages/op-nx-github-cache/src/index.ts` only if consumers need it

**New cache backend:**
- Implementation: `packages/op-nx-github-cache/src/lib/backends/<name>-backend.ts`, factory `create<Name>Backend()` returning a `CacheBackend` object literal
- Wire selection into `src/lib/backends/index.ts` (`selectBackend`), export from `src/index.ts`, spec co-located

**New CLI entry point:**
- Implementation: `packages/op-nx-github-cache/src/bin/<name>.ts` with the `pathToFileURL(process.argv[1])` CLI guard; register in `packages/op-nx-github-cache/package.json` `"bin"` as `op-nx-github-cache-<name>`

**New GitHub action:**
- New root-level directory `<action-name>/` with `action.yml` + `index.cjs` + `selfcheck.cjs`; Node built-ins only, `node24` runtime; add its selfcheck to the `windows-selfcheck` job in `.github/workflows/ci.yml`

**New package (unlikely -- single-package workspace by design):**
- `packages/<name>/` via `nx g @nx/js:lib` (npm workspaces glob `packages/*` picks it up); add a reference in the root `tsconfig.json`

**Integration tests (real sockets/filesystem):**
- Name them `*.integration.spec.ts`; they run under `nx integration` (OS-discriminated hash), never under `nx test`

## Special Directories

**`packages/op-nx-github-cache/dist/`:**
- Purpose: Compiled ESM output; CI runs bins directly from here (`node .../dist/bin/serve.js`) because npm links bin shims only when `dist/` exists at install time
- Generated: Yes (`nx build`). Committed: No (gitignored)

**`packages/op-nx-github-cache/out-tsc/`:**
- Purpose: `typecheck` target's declaration output for specs
- Generated: Yes. Committed: No

**`packages/op-nx-github-cache/__fixtures__/`:**
- Purpose: act e2e harness. Generated: No. Committed: Yes

**`.nx/`:**
- Purpose: Nx local cache + workspace data. Generated: Yes. Committed: No

**`.act-cache/`, `.act-artifacts/` (under the package when `test:act` runs):**
- Purpose: act's cache/artifact server storage. Generated: Yes. Committed: No (gitignored)

**`.planning/`, `plans/`, `.gsd-opengsd/`, `.gsd-migration-backup/`:**
- Purpose: GSD/planning tooling state. `.planning/` is committed; `plans/` and `.gsd-opengsd/` are gitignored

---

*Structure analysis: 2026-07-17*
