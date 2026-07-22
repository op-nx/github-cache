# Codebase Structure

**Analysis Date:** 2026-07-22

## Directory Layout

```
github-cache/                             # Nx workspace root (npm workspaces: packages/*)
├── packages/
│   └── github-cache/                     # The one publishable package, @op-nx/github-cache
│       ├── src/
│       │   ├── action/                   # Internal CI dogfood action (run(), runPublish())
│       │   ├── backend/                  # CacheBackend port + its three adapters
│       │   ├── cleanup/                  # Cleanup engine + its scheduled-workflow bin
│       │   ├── conformance/               # Cross-backend contract tests (one suite, many backends)
│       │   ├── lib/                       # Pure domain leaves: trust, sync-gate, retention,
│       │   │                              #   cache-key, release-asset-name, with-hash-lock, etc.
│       │   ├── ppe/                       # Spec pinning the top-level ppe/action.yml's config
│       │   ├── publish/                  # Publish (mirror) engine
│       │   ├── roundtrip/                # Live cross-OS read-back bin
│       │   ├── server/                   # node:http protocol layer (createCacheServer)
│       │   ├── test/                     # Shared test-only fakes (consumer-contract, octokit-fault)
│       │   ├── index.ts                  # Public barrel (createCacheServer + port types)
│       │   └── serve.ts                  # Composition root (serve()) + bin entry (main())
│       ├── dist/                          # Build output (gitignored); npm package payload
│       ├── out-tsc/                       # Vitest/tsc scratch output (gitignored)
│       ├── action.yml                    # INTERNAL dogfood action (main: dist/action/index.js)
│       ├── package.json                  # @op-nx/github-cache: deps, `files`, `bin`, `exports`
│       ├── project.json                  # Nx project config (adds the `integration` target)
│       ├── vitest.config.mts             # Unit-test target (`test`)
│       ├── vitest.integration.config.mts # Integration-test target (`integration`, *.integration.spec.ts only)
│       ├── tsconfig.json / .lib.json / .spec.json
│       ├── pack-check.cjs                # Verifies the npm tarball file list (CI: pack-check job)
│       └── README.md / LICENSE           # Published package metadata (mirrors repo root)
├── start-cache-server/                    # PUBLISHED consumer sidecar action (Channel B)
│   ├── action.yml                        # `uses:`-consumable surface (main: index.js, node24, background)
│   ├── entry.ts                          # Thin glue over serve(); esbuild input
│   └── index.js                          # COMMITTED, esbuild-bundled CJS output (NOT gitignored)
├── ppe/                                   # PUBLISHED advisory PPE-hygiene composite action
│   ├── action.yml                        # Composite action: self-installs zizmor + actionlint
│   └── fixtures/
│       └── unsafe-workflow.yml           # Deliberately-unsafe fixture for the CI `ppe` dogfood job
├── docs/                                  # Adopter-facing documentation (published, not code)
│   ├── advanced.md                       # Backend-selection table, retention knobs, advanced config
│   ├── configuration.md                  # Inputs/env vars reference
│   ├── trust-and-security.md             # Trust model, threat notes
│   ├── versioning.md                     # Release/versioning policy
│   └── examples/
│       ├── README.md
│       └── minimal-ci.yml                # Copy-pasteable minimal consumer workflow
├── .github/
│   └── workflows/
│       ├── ci.yml                        # format-check, fallow, action-bundle-drift, pack-check,
│       │                                 #   ppe, build, typecheck, test, integration (matrix),
│       │                                 #   dogfood-seed/verify, consumer-smoke, publish (matrix),
│       │                                 #   publish-verify (matrix)
│       └── cleanup.yml                   # Daily schedule-only cleanup workflow
├── plans/                                 # AI-assisted planning artifacts (gitignored content varies)
├── .planning/                              # GSD workflow state (phases, quick tasks, spikes, codebase docs)
├── esbuild.action.mjs                     # Bundles start-cache-server/entry.ts -> index.js (CJS, node24)
├── tsconfig.base.json                     # Shared strict compiler options (composite project refs)
├── tsconfig.json                          # Root project-references entry (-> packages/github-cache)
├── tsconfig.action.json                   # Separate tsconfig for start-cache-server/entry.ts (outside
│                                          #   the package's own tsconfig; typechecked in its own CI step)
├── vitest.workspace.ts                    # Vitest workspace pointer (one project: packages/github-cache)
├── nx.json                                # Nx task/target defaults, cache-input discriminators
├── package.json                          # Root scripts (build/test/typecheck/fallow/build:action/...)
├── .fallowrc.jsonc                        # fallow dead-code config (entry points, ignores)
├── AGENTS.md / CLAUDE.md                 # Agent-agnostic + Claude-specific working instructions
├── SECURITY.md                           # Security policy / reporting
└── README.md                             # Top-level project README
```

## Directory Purposes

**`packages/github-cache/src/action/`:**
- Purpose: the internal-only CI dogfood action that proves `serve()` and the publish path work end-to-end in this repo's own CI
- Contains: `index.ts` (`run()` for seed/verify dogfood, `runPublish()` for the sync-gated mirror, `createPublishClient()` real Octokit adapter), `index.spec.ts`
- Key files: `packages/github-cache/src/action/index.ts`

**`packages/github-cache/src/backend/`:**
- Purpose: the `CacheBackend` port and its three concrete adapters
- Contains: `types.ts` (port + `isWritableBackend`), `actions-cache-backend.ts` (RW, `@actions/cache`), `releases-backend.ts` (RO, GitHub Releases), `memory-backend.ts` (writable test fixture + RO degrade target), one `.spec.ts` per file
- Key files: `packages/github-cache/src/backend/types.ts`

**`packages/github-cache/src/cleanup/`:**
- Purpose: the age-based Releases-mirror prune engine and its scheduled-workflow entrypoint
- Contains: `cleanup.ts` (pure engine, injected `CleanupClient`), `index.ts` (bin: real Octokit adapter + `isTrustedSyncEvent` gate), specs including `cleanup-workflow.spec.ts` (pins `.github/workflows/cleanup.yml`'s shape)
- Key files: `packages/github-cache/src/cleanup/cleanup.ts`, `packages/github-cache/src/cleanup/index.ts`

**`packages/github-cache/src/conformance/`:**
- Purpose: one shared contract-test suite run against every backend implementation, so all adapters are proven to satisfy the same `CacheBackend` semantics
- Contains: `conformance.spec.ts`

**`packages/github-cache/src/lib/`:**
- Purpose: pure, mostly-leaf domain helpers that other layers must agree on byte-for-byte; the "single source of truth" modules
- Contains: `trust.ts` (write gate), `sync-gate.ts` (publish/cleanup gate), `retention.ts` (max-age + shard-tag scheme), `cache-key.ts` (hash brand + Actions-cache key), `cache-archive-path.ts` (deterministic temp path), `release-asset-name.ts` (OS-namespaced Release asset name), `with-hash-lock.ts` (per-hash serialization), `github-identity.ts` (repo/token pattern leaf), `local-context.ts` (local dev credential-tier chain), `octokit-status.ts` (status-code fault extractor), `resilient-octokit.ts` (retry/throttle-wrapped Octokit factory), `summary.ts` (job-summary table renderer), `dogfood-body.ts` (deterministic dogfood payload), `is-entrypoint.ts` (Windows-safe direct-invocation guard)
- Key files: `packages/github-cache/src/lib/trust.ts`, `packages/github-cache/src/lib/sync-gate.ts`, `packages/github-cache/src/lib/retention.ts`

**`packages/github-cache/src/ppe/`:**
- Purpose: TypeScript spec pinning the shipped top-level `ppe/action.yml` composite action's structure (versions, advisory posture) from disk
- Contains: `ppe-action.spec.ts` (no runtime `.ts` source -- `ppe/action.yml` itself is pure YAML)

**`packages/github-cache/src/publish/`:**
- Purpose: the Actions-cache -> GitHub-Releases mirror engine
- Contains: `publish-mirror.ts` (pure engine, injected `PublishClient`), `publish-mirror.spec.ts`

**`packages/github-cache/src/roundtrip/`:**
- Purpose: the live cross-OS proof bin that reads back what the publish matrix wrote, via the reader directly
- Contains: `read-back.ts` (no companion spec -- it is exercised live in CI, not unit-tested, since it deliberately bypasses `selectBackend`)

**`packages/github-cache/src/server/`:**
- Purpose: the node:http protocol layer implementing the Nx self-hosted-cache HTTP contract
- Contains: `server.ts` (`createCacheServer`, `generateToken`), `server.spec.ts` (unit), `public-server.integration.spec.ts` (real-socket integration, owned by the separate `integration` Nx target)

**`packages/github-cache/src/test/`:**
- Purpose: shared test-only fakes reused across multiple spec files
- Contains: `consumer-contract.ts`, `octokit-fault.ts` (fault-shaped fakes for the injected client seams)

**`start-cache-server/`:**
- Purpose: the PUBLISHED consumer sidecar action -- the actual `uses:` surface an adopting repo consumes
- Contains: `action.yml` (JS action, `main: index.js`, `background: true` shape), `entry.ts` (source, esbuild input), `index.js` (COMMITTED bundle -- NOT gitignored, drift-guarded by `npm run check:action`)
- Generated: `index.js` is generated by `node esbuild.action.mjs`, but is committed to git and must be kept in sync manually (or via `npm run build:action`) whenever `entry.ts` or its transitive deps change
- Committed: yes, deliberately (a `uses:` action resolves from the git ref, never from npm or a build step)

**`ppe/`:**
- Purpose: the PUBLISHED advisory PPE-hygiene composite action (workflow-hygiene scanning, not containment)
- Contains: `action.yml` (composite, self-installs `zizmor`/`actionlint`), `fixtures/unsafe-workflow.yml` (deliberately outside `.github/workflows/` so GitHub never executes it as a real workflow)

**`docs/`:**
- Purpose: adopter-facing documentation shipped alongside the package (not part of the npm tarball; consumed from the git repo / GitHub Pages-style browsing)
- Contains: `advanced.md`, `configuration.md`, `trust-and-security.md`, `versioning.md`, `examples/`

**`.github/workflows/`:**
- Purpose: this repo's own CI and the scheduled cleanup job
- Contains: `ci.yml` (11 jobs: format-check, fallow, action-bundle-drift, pack-check, ppe, build, typecheck, test, integration matrix, dogfood-seed/verify, consumer-smoke, publish matrix, publish-verify matrix), `cleanup.yml` (daily schedule)

## Key File Locations

**Entry Points:**
- `packages/github-cache/src/serve.ts`: composition root + `bin: github-cache` direct-invocation
- `packages/github-cache/src/action/index.ts`: internal CI dogfood action (`dist/action/index.js`)
- `start-cache-server/entry.ts`: consumer sidecar action source (bundled to `start-cache-server/index.js`)
- `packages/github-cache/src/cleanup/index.ts`: scheduled cleanup bin (`dist/cleanup/index.js`)
- `packages/github-cache/src/roundtrip/read-back.ts`: live cross-OS read-back bin (`dist/roundtrip/read-back.js`)

**Configuration:**
- `nx.json`: Nx defaults, including the `integration` target's `runtime` cache-input discriminator (OS-sensitive hashing)
- `packages/github-cache/project.json`: adds the `integration` Nx target on top of `@nx/js` inference
- `.fallowrc.jsonc`: `fallow dead-code` entry points and ignores
- `tsconfig.base.json` / `tsconfig.json`: shared strict TS compiler options + project references
- `tsconfig.action.json`: separate tsconfig covering only `start-cache-server/entry.ts` (outside the package's own project)
- `packages/github-cache/vitest.config.mts` / `vitest.integration.config.mts`: unit vs. integration test targets, deliberately separate `cacheDir`s

**Core Logic:**
- `packages/github-cache/src/server/server.ts`: HTTP protocol layer
- `packages/github-cache/src/lib/select-backend.ts`: backend selection policy
- `packages/github-cache/src/backend/*.ts`: storage adapters
- `packages/github-cache/src/publish/publish-mirror.ts`, `packages/github-cache/src/cleanup/cleanup.ts`: out-of-band engines

**Testing:**
- Unit specs live CO-LOCATED next to their source file (`foo.ts` + `foo.spec.ts` in the same directory)
- `packages/github-cache/src/server/public-server.integration.spec.ts`: the one `*.integration.spec.ts` file, owned by the `integration` Nx target
- `packages/github-cache/src/test/`: shared fakes reused by multiple spec files
- Root-level specs directly under `packages/github-cache/src/` (`docs-adoption.spec.ts`, `docs-trust.spec.ts`, `governance-docs.spec.ts`, `governance-email.spec.ts`, `pinned-deps.spec.ts`, `public-surface.spec.ts`, `consumer-action-runtime.spec.ts`) pin cross-cutting invariants (docs content, dependency pins, public API surface, generated-bundle runtime shape) rather than testing one module

## Naming Conventions

**Files:**
- One TypeScript module per concern, `kebab-case.ts` (e.g., `release-asset-name.ts`, `with-hash-lock.ts`, `select-backend.ts`)
- Every source file's unit test is `<same-name>.spec.ts`, co-located in the same directory (never a separate `__tests__/` tree)
- The one integration spec uses the `.integration.spec.ts` suffix specifically so `vitest.config.mts`'s `exclude` and `vitest.integration.config.mts`'s `include` can partition unit vs. integration tests by filename alone
- Bin-style modules that both export functions for testing AND run when invoked directly are named `index.ts` (`action/index.ts`, `cleanup/index.ts`) and gate their side-effecting `run()`/`main()` call behind `isEntrypoint(import.meta.url)`

**Directories:**
- One directory per architectural layer under `src/` (`backend/`, `server/`, `publish/`, `cleanup/`, `lib/`, `action/`, `roundtrip/`, `conformance/`, `ppe/`, `test/`) -- never nested more than one level deep
- Top-level published surfaces get their OWN top-level directory outside `packages/` when they are a distinct `uses:`-consumable action (`start-cache-server/`, `ppe/`), distinguishing them clearly from the internal package and from the internal-only `packages/github-cache/action.yml` dogfood action

## Where to Add New Code

**New backend adapter (e.g., a fourth storage system):**
- Implementation: `packages/github-cache/src/backend/<name>-backend.ts`, implementing `ReadableBackend` or `WritableBackend` from `packages/github-cache/src/backend/types.ts`
- Tests: co-located `<name>-backend.spec.ts`; add it to the shared suite in `packages/github-cache/src/conformance/conformance.spec.ts`
- Wiring: only `packages/github-cache/src/lib/select-backend.ts` should ever construct it in production code

**New out-of-band engine (batch job, mirrors publish/cleanup shape):**
- Engine: `packages/github-cache/src/<engine-name>/<engine-name>.ts`, pure orchestration behind a narrow injected client interface (no `@octokit/rest` import)
- Bin: `packages/github-cache/src/<engine-name>/index.ts`, real Octokit adapter + trust gate + `isEntrypoint()` guard
- Workflow: a new file under `.github/workflows/` (mirror `cleanup.yml`'s single-writer-concurrency-group shape if it mutates GitHub state)

**New pure domain helper needed by two or more layers:**
- Location: `packages/github-cache/src/lib/<name>.ts`, kept a true leaf (no imports from `../backend`, `../publish`, `../server`, or `./select-backend`) if any consumer might otherwise create an import cycle -- see `github-identity.ts`'s extraction rationale
- Tests: co-located `<name>.spec.ts`

**New HTTP route or protocol behavior:**
- Location: `packages/github-cache/src/server/server.ts`, preserving the fixed guard-clause order (route -> method -> auth -> hash -> body-cap -> backend -> status)
- Tests: `packages/github-cache/src/server/server.spec.ts` (unit) and, if it touches the real socket path, `public-server.integration.spec.ts`

**New consumer-facing action input or workflow:**
- Consumer sidecar changes: `start-cache-server/entry.ts`, then rebuild with `npm run build:action` and commit the resulting `start-cache-server/index.js` (CI's `action-bundle-drift` job fails on any drift)
- Documentation: update `docs/configuration.md` / `docs/advanced.md` and `docs/examples/minimal-ci.yml` to match

## Special Directories

**`packages/github-cache/dist/`:**
- Purpose: TypeScript build output; the npm package payload
- Generated: yes (`nx build github-cache` / `npm run build`)
- Committed: no (gitignored)

**`packages/github-cache/out-tsc/`:**
- Purpose: Vitest/tsc scratch/output directory
- Generated: yes
- Committed: no (gitignored)

**`start-cache-server/index.js`:**
- Purpose: the esbuild-bundled, dependency-inlined CJS entry a consumer's `uses:` step actually runs
- Generated: yes (`node esbuild.action.mjs`, invoked via `npm run build:action`)
- Committed: YES, deliberately -- a `uses:` action resolves `main` from the git ref, never from npm or a build step; staleness is caught by the CI `action-bundle-drift` job (`npm run check:action` = rebuild + `git diff --exit-code`)

**`.planning/`:**
- Purpose: GSD workflow state (phase plans, quick-task records, spikes, codebase-mapper output including this document)
- Generated: partially (mapper/agent output); partially hand-authored (phase discussions)
- Committed: yes

**`.nx/`:**
- Purpose: Nx's local cache and workspace metadata
- Generated: yes
- Committed: no (gitignored)

---

*Structure analysis: 2026-07-22*
