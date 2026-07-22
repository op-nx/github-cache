# Phase 0: Teardown - Research

**Researched:** 2026-07-18
**Domain:** Nx-native project teardown (Nx 23.1.0) + CI rework + codebase-map de-priming
**Confidence:** HIGH (nearly every claim verified against the live Nx 23.1.0 CLI and this repo's tracked files; the two judgment calls are flagged as recommendations)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Remove `@op-nx/github-cache` with `nx g @nx/workspace:remove` (Nx-native, ROADMAP-mandated) - exact flags resolved at plan/execute time. The generator removes the project + its graph entry; it does NOT own the sibling directories, so **manually remove** `start-cache-server/`, `publish-mirror/`, and `.verdaccio/`. After removal, verify the project graph resolves with **zero dangling references** and a clean `nx run-many` succeeds (ROADMAP Phase 0 risk: dangling tsconfig aliases / `nx.json` targetDefaults / root `package.json` scripts).
- **D-02:** Scrub PoC-specific residue from `nx.json` `targetDefaults`, keep the rest:
  - REMOVE the hard-coded relative paths in `typecheck.inputs` pointing at the deleted project - `^{projectRoot}/../../../../../../../packages/op-nx-github-cache/tsconfig.lib.json` and `...tsconfig.spec.json` (`nx.json:124-125`) - they become dangling after removal (SC1).
  - REMOVE the PoC-only `externalDependencies` entries `@actions/cache` and `@octokit/rest` from `build.inputs` and `typecheck.inputs` (they were the cache project's deps; not in root `package.json`).
  - KEEP `namedInputs`, `plugins` (`@nx/js/typescript`, `@nx/vitest`), `analytics: false`, `release.version.preVersionCommand`, and the `test`/`build`/`typecheck` target defaults' generic parts.
- **D-03:** KEEP `.gitattributes eol=lf` AND the `integration` targetDefault in `nx.json` - **including** the `{ runtime: "node -p process.platform" }` discriminator (`nx.json:60-74`) - even though NO project consumes them after teardown. Foundation for Phase 3's cross-OS correctness. Do NOT re-derive in Phase 3; inherit it. The discriminator is a runtime input (shell-invariant, hash-parity proven), NOT `env:RUNNER_OS`.
- **D-04:** Remove the local-registry publish scaffold coupled to the deleted `.verdaccio/`: the `nx.targets.local-registry` target (`@nx/js:verdaccio`, `package.json:37-45`) and the `verdaccio` devDependency (`package.json:27`). SC1 deletes `.verdaccio/config.yml`. **[LOW-DEFERENCE / re-openable]** - Phase 6 (Distribution) re-adds a local-registry publish-test path via `nx g` if it needs one.
- **D-05:** Delete `.github/workflows/mirror-cleanup.yml` entirely. Rework `.github/workflows/ci.yml` to keep FIVE jobs on Nx's LOCAL cache only - `format-check`, `build`, `typecheck`, `test`, and an ubuntu+windows `integration` matrix (SC2/SC3).
  - DROP: the `windows-selfcheck` job, the `publish-mirror` job, every `- uses: ./start-cache-server` step, and the `build` job's `npx nx reset` + second-build reseed dance.
  - KEEP: `push: [main]` + `pull_request` triggers, `npx nx format:check --all`, `ubuntu-24.04-arm` runners, `node-version-file: .node-version` + `cache: 'npm'`, `npm ci`.
  - The `integration` matrix stays as scaffolding (green no-op until Phase 1 adds an `integration` target); preserve the `windows-11-arm` leg for Phase 3. `fail-fast: false` retained.
  - Reduce workflow `permissions` to `contents: read` only.
- **D-06:** Run `/gsd:map-codebase` to regenerate `.planning/codebase/*` against the torn-down (shell-only) workspace, then confirm no rebuild-priming artifact remains (SC5). Sequence this **LAST** - after the teardown commits land.

### Claude's Discretion
- Exact `nx g @nx/workspace:remove` flags (`--forceRemove` / `--importPath` etc.) - resolve at plan/execute time against `--help`.
- Exact ordering of the manual directory deletions and whether they ride in the same commit as the generator run or a follow-up commit.
- Whether the root `package.json` `integration` script stays - recommend KEEP (project-agnostic, green no-op, matches the retained CI job).

### Deferred Ideas (OUT OF SCOPE)
- verdaccio / local-registry publish testing -> Phase 6, if the npm-package publish flow wants a local-registry harness.
- Unpackaged spikes note (informational): `.planning/spikes/MANIFEST.md` exists; verdicts already consumed into PROJECT.md / ARCHITECTURE-DECISION.md. No packaging action for Phase 0.
</user_constraints>

## Phase Requirements

**None.** Phase 0 is a teardown/prep phase and delivers no v0.0.1 requirement (ROADMAP: "Requirements: None"). Do not invent requirements. The phase contract is the 5 Success Criteria (SC1-SC5) + 2 Risks in ROADMAP.md "### Phase 0: Teardown".

## Summary

This is a mechanics-only teardown of a spike/PoC on an otherwise-preserved Nx workspace shell. The single load-bearing tool is `nx g @nx/workspace:remove @op-nx/github-cache` (verified present in Nx 23.1.0). A `--dry-run` proves exactly what it owns: it deletes the entire `packages/op-nx-github-cache/` tree AND updates the root `tsconfig.json` (removing the project's TS project reference). It touches nothing else - so `nx.json`, root `package.json`, the three sibling directories, the lockfile, and both workflow files must all be handled by hand. There is **no `tsconfig.base.json` `paths` alias** to scrub (this workspace resolves via TS project references + `customConditions`/workspace `exports`, not path aliases), which retires one of the ROADMAP's two named removal risks up front.

The "no dangling references" gate (SC1/SC4) is provable with a tight command battery: `nx sync:check` (currently green via `@nx/js:typescript-sync`; stays green because the generator cleans the root tsconfig reference), `nx show projects`, and `nx run-many -t build test typecheck integration`. The last one is **verified to exit 0 as a green no-op** when no remaining project has those targets - which is the entire post-teardown state, since the only surviving project `@op-nx/source` has just the `local-registry` target (itself removed by D-04). That no-op behavior is what makes the reworked CI green with no remote cache (SC3).

**Primary recommendation:** Run the generator (no `--forceRemove` needed - the graph shows zero dependents and the dry-run is clean), then hand-scrub the 5 residues the generator leaves (`nx.json` x3, `package.json` x2), `rm -rf` the 3 sibling dirs, delete `mirror-cleanup.yml`, rework `ci.yml` to the 5-job local-cache-only baseline, **run `npm install` to resync `package-lock.json`** (mandatory - or CI `npm ci` breaks), then prove clean with the SC1/SC4 command battery. Resolve the pre-existing `nx format:check --all` red (unformatted tracked docs - see Open Questions) before declaring CI green. Sequence `/gsd:map-codebase` last.

## Architectural Responsibility Map

Teardown "capability" -> which mechanism owns it (planner task-assignment aid):

| Teardown capability | Owner | Leaves dangling? | Rationale |
|---------------------|-------|------------------|-----------|
| Delete `packages/op-nx-github-cache/**` + graph node | `nx g @nx/workspace:remove` | No | Generator DELETEs the whole dir (verified dry-run) |
| Clean root `tsconfig.json` project reference | `nx g @nx/workspace:remove` | No | Generator UPDATEs `tsconfig.json` (verified dry-run) |
| Scrub `nx.json` targetDefaults (dangling paths + PoC externalDeps) | Manual edit | Yes if skipped | Generator never touches `nx.json` (D-02) |
| Remove `local-registry` target + `verdaccio` devDep | Manual edit | Yes if skipped | Generator never touches root `package.json` (D-04) |
| Delete `start-cache-server/`, `publish-mirror/`, `.verdaccio/` | Manual `rm -rf` | Yes if skipped | Siblings, not owned by the generator (D-01) |
| Resync `package-lock.json` | `npm install` | CI `npm ci` fails if skipped | Generator runs no install step (verified dry-run) |
| Delete `mirror-cleanup.yml`, rework `ci.yml` | Manual edit | N/A | Workflow files are outside the Nx graph (D-05) |
| Regenerate `.planning/codebase/*` | `/gsd:map-codebase` (last) | N/A | De-priming after teardown commits land (D-06) |

## Q1: `nx g @nx/workspace:remove` Contract (Nx 23.1.0)

**Project name to pass:** `@op-nx/github-cache` (the Nx project name, = `package.json` `name`). NOT the folder name `op-nx-github-cache`. `[VERIFIED: nx show projects --json -> ["@op-nx/github-cache","@op-nx/source"]]`

**Flags** `[VERIFIED: nx g @nx/workspace:remove --help, v23.1.0]`:

| Flag | Type | Meaning | Use here? |
|------|------|---------|-----------|
| `[projectName]` (positional) or `--projectName` / `-project` | string | Project to remove | **Yes** - positional `@op-nx/github-cache` |
| `--forceRemove` | boolean | Force removal even if the project is still in use | **Not required** - graph shows zero dependents; dry-run succeeds without it. Harmless to include as belt-and-suspenders |
| `--importPath` | string | The library name (import path) used at creation time | Not needed - project name resolves it |
| `--skipFormat` | boolean | Skip formatting touched files | Recommend NOT skipping (lets `tsconfig.json` stay prettier-clean) |
| `--dry-run` / `--no-interactive` | - | Preview / non-interactive | Use `--dry-run` first, `--no-interactive` for the real run |

**What the generator DOES (verified via `--dry-run`):**
- DELETEs every file under `packages/op-nx-github-cache/` (src, bins, specs, fixtures, tsconfigs, vitest configs, README, package.json) and the directory itself.
- UPDATEs root `tsconfig.json` - removes the `{ "path": "./packages/op-nx-github-cache" }` entry from `references` (this is why the ROADMAP's "dangling tsconfig path aliases" risk is largely pre-handled for the root tsconfig).

**What the generator does NOT touch (must be handled by hand):**
- `nx.json` (targetDefaults, dangling typecheck paths, externalDeps) - see Q2.
- Root `package.json` (`verdaccio` devDep, `local-registry` target) - see Q2/D-04.
- `start-cache-server/`, `publish-mirror/`, `.verdaccio/` - siblings.
- `package-lock.json` - **no install step runs**; resync manually with `npm install`.
- `.github/workflows/*.yml`, `README.md` - outside the Nx graph.

`--forceRemove` verdict: `[VERIFIED: nx graph --print -> both projects have [] dependencies]` and `[VERIFIED: dry-run completed with no "in use" error]`. Recommend running WITHOUT it first (so an unexpected in-use report surfaces rather than being forced past).

## Q2: Dangling-Reference Scrub Checklist (hand-work the generator leaves)

Complete inventory, built from `git grep` across all tracked files (excluding the deleted package dir and `.planning/`). `[VERIFIED: git grep -e op-nx-github-cache -e start-cache-server -e publish-mirror -e verdaccio -e @actions/cache -e @octokit]`

**`nx.json`** (3 edits - `[VERIFIED: nx.json lines]`):
1. `targetDefaults.typecheck.inputs` (lines 124-125): DELETE the two entries
   - `"^{projectRoot}/../../../../../../../packages/op-nx-github-cache/tsconfig.lib.json"`
   - `"^{projectRoot}/../../../../../../../packages/op-nx-github-cache/tsconfig.spec.json"`
2. `targetDefaults.build.inputs[].externalDependencies` (lines 107-108): remove `"@actions/cache"`, `"@octokit/rest"`. KEEP `"typescript"`, `"tslib"`, `"@types/node"`.
3. `targetDefaults.typecheck.inputs[].externalDependencies` (lines 131-132): remove `"@actions/cache"`, `"@octokit/rest"`. KEEP `"typescript"`, `"tslib"`, `"@types/node"`.

> Scoping `externalDependencies` to the real toolchain closure (not the whole dep graph) is a load-bearing cross-OS hash-parity guard, not cosmetic: `@nx/js/typescript` leaves the scope unset upstream, which falls back to hashing platform-native packages (`@nx/nx-<os>-<arch>`, `@swc/core-*`) and diverges the hash by OS+arch. `[CITED: .planning/research/PITFALLS.md "Nx hash divergence BEYOND CRLF"]` So keep the explicit list - just drop the two PoC deps.

**Root `package.json`** (2 edits, D-04 - `[VERIFIED: package.json lines]`):
4. Remove the entire `nx.targets.local-registry` block (lines 37-45). Recommend keeping `"nx": { "includedScripts": [] }` (project-agnostic shell) so the root project stays clean with no targets.
5. Remove `"verdaccio": "^6.3.2"` from `devDependencies` (line 27).

**Sibling directories** (manual `rm -rf`, D-01):
6. `start-cache-server/` (action.yml, index.cjs, selfcheck.cjs)
7. `publish-mirror/` (action.yml, index.cjs, selfcheck.cjs)
8. `.verdaccio/` (config.yml)

**Lockfile** (mandatory):
9. `npm install` to prune `verdaccio` (133 lockfile refs), `@actions/cache`, `@octokit/*`, and the `packages/op-nx-github-cache` workspace entry from `package-lock.json`. `[VERIFIED: git grep -c in package-lock.json]` **Without this, `npm ci` (every CI job) errors on package/lock mismatch.**

**Stale docs (not graph refs, but stale after teardown):**
10. `README.md` (lines 3, 11-12) describes `@op-nx/github-cache` as "the only package" and links `packages/op-nx-github-cache/README.md` (now deleted -> broken link). `[VERIFIED: git grep README.md]` Not an SC1 graph reference, but a rebuild-priming artifact (relevant to SC5). Recommend reducing README.md to a shell description. See Open Questions.

**Handled automatically (do NOT hand-edit):** root `tsconfig.json` references (generator UPDATEs). **No `tsconfig.base.json` `paths` alias exists** `[VERIFIED: tsconfig.base.json has no "paths" key]` - retires that removal risk.

**Not dangling, KEEP as-is:** `package.json` `workspaces: ["packages/*"]` (empty glob is valid; Phase 1 repopulates), `packages/.gitkeep` (keeps the empty dir), root `package.json` scripts (`build`/`typecheck`/`test`/`integration`/`format*` are all `nx run-many`/`nx format:*` - become no-ops, not dangling).

## Q3: Graph-Clean + Green Verification Battery (SC1/SC4 gate)

Run all of these AFTER the scrub + `npm install`. This IS the "no dangling reference" gate - treat any failure as a teardown regression.

| Command | Expected | Proves | Status of claim |
|---------|----------|--------|-----------------|
| `npx nx sync:check` | `The workspace is up to date` (exit 0) | TS project references match the graph (no dangling tsconfig ref) | `[VERIFIED: currently green via @nx/js:typescript-sync]` |
| `npx nx show projects` | `@op-nx/source` only (no `@op-nx/github-cache`) | Project graph resolves; PoC node gone | `[VERIFIED: pre-teardown lists both]` |
| `npx nx graph --print` (or `--file`) | Valid JSON, exit 0 | Graph builds with no dangling references | `[VERIFIED: resolves pre-teardown]` |
| `npx nx run-many -t build test typecheck integration` | `No tasks were run`, **exit 0** | The green no-op baseline (SC3/SC4) | `[VERIFIED: exit 0 with no-matching-target warning]` |
| `npm ci` | Success | Lockfile in sync (CI gate) | `[VERIFIED: lockfile currently carries removed deps -> needs npm install first]` |

**Exit-code gotcha (the Q3 crux), resolved:** `nx run-many -t <target-no-project-has>` **exits 0** (green), printing `The following projects do not have a configuration for any of the provided targets ... No tasks were run`. It is NOT an error. `[VERIFIED: npx nx run-many -t build test typecheck integration -p @op-nx/source -> EXIT=0]` So `npm run build|typecheck|test|integration` are all green no-ops post-teardown - no special-casing needed in CI.

`nx build`/`nx test` "across remaining projects" (SC4 wording) resolve to the same no-op: `@op-nx/source` has no such targets. `[VERIFIED: nx show project @op-nx/source -> targets: local-registry only]`

## Q4: CI Rework Shape (SC2/SC3)

Current `ci.yml` job -> disposition `[VERIFIED: .github/workflows/ci.yml]`:

| Job | Disposition | Cache-coupled steps to DROP | Project-agnostic steps to KEEP |
|-----|-------------|------------------------------|-------------------------------|
| `format-check` | KEEP as-is | none | checkout, setup-node, `npm ci`, `npx nx format:check --all` |
| `build` | REWORK | `uses: ./start-cache-server`, `npx nx reset`, 2nd `npm run build` reseed | checkout, setup-node, `npm ci`, `npm run build` |
| `typecheck` | REWORK | `npx nx build @op-nx/github-cache` bootstrap, `uses: ./start-cache-server` | checkout, setup-node, `npm ci`, `npm run typecheck` |
| `test` | REWORK | `npx nx build @op-nx/github-cache` bootstrap, `uses: ./start-cache-server` | checkout, setup-node, `npm ci`, `npm run test` |
| `integration` (matrix) | REWORK (keep matrix) | `npx nx build @op-nx/github-cache` bootstrap, `uses: ./start-cache-server` | matrix `[ubuntu-24.04-arm, windows-11-arm]`, `fail-fast: false`, checkout, setup-node, `npm ci`, `npm run integration` |
| `windows-selfcheck` | DELETE | entire job (runs deleted `start-cache-server`/`publish-mirror` selfchecks) | - |
| `publish-mirror` | DELETE | entire job (`uses: ./publish-mirror`, `actions: read`+`contents: write`) | - |

**Workflow `permissions`:** `actions: read` + `contents: read` -> **`contents: read` only** (the Actions-cache-listing jobs that needed `actions: read` are gone). Drop all job-level `permissions:` blocks - workflow-level `contents: read` covers all five read-only jobs.

**Recommended reworked `ci.yml` skeleton** (planner adapts):
```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
permissions:
  contents: read
jobs:
  format-check:
    runs-on: ubuntu-24.04-arm
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v6
        with:
          node-version-file: '.node-version'
          cache: 'npm'
      - run: npm ci
      # --all: PR checkouts lack a local `main` ref for Nx's diff base.
      - run: npx nx format:check --all
  build:
    runs-on: ubuntu-24.04-arm
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v6
        with: { node-version-file: '.node-version', cache: 'npm' }
      - run: npm ci
      - run: npm run build          # nx run-many -t build -> no-op, exit 0
  typecheck:
    runs-on: ubuntu-24.04-arm
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v6
        with: { node-version-file: '.node-version', cache: 'npm' }
      - run: npm ci
      - run: npm run typecheck
  test:
    runs-on: ubuntu-24.04-arm
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v6
        with: { node-version-file: '.node-version', cache: 'npm' }
      - run: npm ci
      - run: npm run test
  integration:
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-24.04-arm, windows-11-arm]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v6
        with: { node-version-file: '.node-version', cache: 'npm' }
      - run: npm ci
      - run: npm run integration    # no-op scaffold until Phase 1 adds a target
```

**Empty/no-op matrix gotcha - none applies here.** A GitHub Actions job is skipped only when its matrix expands from an *empty array*; the `os: [ubuntu-24.04-arm, windows-11-arm]` list is hard-coded non-empty, so both legs run, execute `npm run integration` (exit 0), and report green. A job whose steps all succeed is green regardless of whether Nx ran any task. No `if:` guard or dummy step is needed. `[VERIFIED: run-many no-op exits 0]`

## Q5: Load-Bearing Invariant Preservation (dormant but kept)

The invariants D-03 preserves are NOT dangling references, so keeping them is safe and requires no special handling:

- **`.gitattributes` (`* text=auto eol=lf`):** a git checkout-normalization rule, not an Nx graph node. Nothing "references" it to dangle. Just do not delete it. It stays dormant (no target hashes cross-OS yet) but is the foundation of Phase 3 cross-OS parity. `[CITED: .planning/research/PITFALLS.md Pitfall 7 - CRLF divergence; .gitattributes header comment]`
- **`nx.json` `integration` targetDefault incl. `{ runtime: "node -p process.platform" }`:** a targetDefault is keyed by target name and applied only to targets that exist with that name. Post-teardown **no project has an `integration` target**, so the default is dormant - applied to nothing, erroring on nothing. **A targetDefault with no matching target is NOT a dangling reference.** `[VERIFIED: the existing `test` targetDefault references a non-existent `tsconfig.storybook.json` fileset and the graph still resolves cleanly]` The `runtime` discriminator only participates in a hash when an `integration` target actually runs (Phase 1+).
  - The discriminator recipe (`node -p process.platform`) is the proven cross-OS-hash primitive: shell-invariant, x64/arm64/emulation-invariant, and locally hittable - unlike `env:RUNNER_OS` (unset off-CI) or a plain `env` var (MSYS uppercases the key). Requires Nx >= 22.7.0; this repo is 23.1.0. `[CITED: .planning/research/PITFALLS.md "Empirically-Verified Platform Facts"]`
- **Root `package.json` `integration` script (`nx run-many -t integration`):** KEEP (D-05 discretion, recommended). Project-agnostic, green no-op `[VERIFIED]`, and matches the retained CI `integration` job.

## Q6: De-Priming Mechanics (SC5)

- **Prerequisite:** `/gsd:map-codebase` analyzes the live workspace, so the teardown must be **committed and graph-clean first** (Q3 battery green). This is exactly why D-06 sequences it LAST. A broken graph or out-of-sync lockfile would poison the regenerated map.
- **What it regenerates:** `.planning/codebase/{ARCHITECTURE,STACK,STRUCTURE,CONVENTIONS,INTEGRATIONS,CONCERNS,TESTING}.md` against the shell-only workspace (which now has no `src/`, no cache project, no actions). Expect a thin map describing an empty Nx workspace shell - that is correct.
- **"No rebuild-priming artifact remains" - concrete verification:** after regeneration, grep the regenerated `.planning/codebase/*` for PoC traces and expect ZERO current-state hits:
  ```bash
  git grep -n -e "op-nx-github-cache" -e "start-cache-server" -e "publish-mirror" \
    -e "selectBackend" -e "CacheBackend" -e "@actions/cache" -e "@octokit" \
    -- '.planning/codebase/**'
  ```
  (Note: PoC mentions in `.planning/ROADMAP.md`, `PROJECT.md`, and `.planning/research/*` are intentional historical/target-spec context - NOT rebuild-priming artifacts, and are out of SC5's regeneration scope per D-06.) Also confirm the stale root `README.md` PoC references (Q2 item 10) are resolved if the planner elects to update it.

## Runtime State Inventory

This is a delete/refactor phase; a file-level grep does not catch runtime/remote state. All five categories answered explicitly:

| Category | Items found | Action required |
|----------|-------------|-----------------|
| **Stored data** | None. The PoC used no local datastore keyed on the project name. `.nx/cache` / `.nx/workspace-data` are gitignored ephemeral Nx hash caches. `[VERIFIED: .gitignore]` | None (optional `nx reset` to clear stale hashes) |
| **Live service config** | **GitHub-side remote state persists.** PoC CI produced (a) GitHub Actions cache entries and (b) `cache-mirror-YYYYMM` Release assets on the actual repo. Deleting the code does NOT delete them. Deleting `mirror-cleanup.yml` means nothing prunes the Release mirror any more. `[CITED: PROJECT.md; ci.yml publish-mirror; mirror-cleanup.yml]` | **None required for Phase 0** (SC1-5 scope is code/CI/graph). Actions cache self-evicts (7-day disuse / 10 GB LRU). Optional manual deletion of `cache-mirror-*` releases if a clean remote is desired - flagged as deferred, not an SC |
| **OS-registered state** | None. No Task Scheduler / systemd / launchd / pm2 registrations; actions ran only inside GitHub-hosted runners. | None |
| **Secrets / env vars** | None to rotate/rename. PoC consumed `ACTIONS_RUNTIME_TOKEN` (runner-injected), `GH_TOKEN`/`GITHUB_TOKEN` (runner-provided). No repo secrets or `.env` defined for them. `[CITED: PROJECT.md "three credentials"; ci.yml]` | None |
| **Build artifacts / installed packages** | `packages/op-nx-github-cache/dist`, `out-tsc` deleted with the dir (gitignored). **`package-lock.json` still lists `verdaccio`, `@actions/cache`, `@octokit/*`, and the workspace package** `[VERIFIED: git grep package-lock.json]` | **`npm install`** to resync the lockfile + prune node_modules (mandatory - CI `npm ci` fails otherwise) |

**Canonical question - "after every file is updated, what runtime systems still hold the old state?"** Answer: only the GitHub-side Actions cache + Release-mirror assets, and they are explicitly out of Phase 0 scope (self-evict or manual optional cleanup). Everything else is code/config the scrub + `npm install` fully cover.

## Common Pitfalls (teardown-specific)

### Pitfall 1: Skipping `npm install` after the removal -> CI `npm ci` breaks
**What goes wrong:** `nx g @nx/workspace:remove` runs no install step (verified). Removing `verdaccio` from `devDependencies` and deleting the workspace package leaves `package-lock.json` out of sync; `npm ci` (every CI job) then errors with "can only install packages when package.json and package-lock.json are in sync." **How to avoid:** run `npm install` and commit the updated lockfile as part of the teardown. **Warning sign:** `npm ci` red locally.

### Pitfall 2: `nx format:check --all` is already red on tracked docs -> format-check job fails (SC3)
**What goes wrong:** the KEEP mechanic `npx nx format:check --all` scans the whole tree. Tracked files `.claude/settings.json`, `CLAUDE.md`, and all `.planning/**` are currently unformatted, so the job exits 1 `[VERIFIED: nx format:check --all -> EXIT=1; git ls-files confirms tracked]`. The workspace SHELL files (nx.json, package.json, tsconfigs, ci.yml) ARE clean. SC5's `/gsd:map-codebase` will WRITE more `.planning/codebase/*.md`, re-reddening it. **How to avoid:** decide the format policy (see Open Questions) - either add churny GSD docs to `.prettierignore` or run `nx format:write` (and again after SC5). **Warning sign:** format-check red while build/test/typecheck/integration are green.

### Pitfall 3: Accidentally deleting a dormant invariant as "unused"
**What goes wrong:** the `integration` targetDefault and `.gitattributes eol=lf` look dead post-teardown (nothing consumes them) and are tempting to "clean up." Deleting them silently breaks Phase 3 cross-OS correctness. **How to avoid:** treat D-03 as load-bearing; keep the comment blocks that explain why. **Warning sign:** a diff that touches `.gitattributes` or removes the `integration` targetDefault.

### Pitfall 4: Collapsing the `integration` matrix to one OS
**What goes wrong:** the `windows-11-arm` leg looks redundant for a no-op. Removing it dismantles the cross-OS scaffold Phase 3 needs and re-opens the (silent) cross-OS publish gap class. **How to avoid:** keep both legs + `fail-fast: false` (D-05). `[CITED: PITFALLS.md Pitfall 7]`

### Pitfall 5: Assuming the generator scrubbed `nx.json` / `package.json`
**What goes wrong:** the dry-run only DELETEs the package dir + UPDATEs `tsconfig.json`. Trusting it to also fix `nx.json` targetDefaults or the `local-registry` target leaves real dangling references (SC1 fail). **How to avoid:** run the Q2 checklist explicitly; verify with `git grep` for the deleted names returning zero hits outside intentional historical docs.

## Validation Architecture (verification / acceptance-command strategy)

`workflow.nyquist_validation` is `true`, but this teardown ships no runtime behavior - there are no units to test. The "tests" are the acceptance commands that prove the teardown is clean and green. Frame Wave-0 "test" work as wiring these into the phase's verification, not writing spec files.

### Acceptance command battery
| Property | Value |
|----------|-------|
| Framework | none new - Nx CLI (23.1.0) + npm are the acceptance harness |
| Quick check | `npx nx sync:check && npx nx show projects` |
| Full gate | `npm ci && npm run build && npm run typecheck && npm run test && npm run integration && npx nx format:check --all` |

### Success-Criterion -> acceptance command map
| SC | Assertion | Command | Verified? |
|----|-----------|---------|-----------|
| SC1 | project + siblings gone, graph clean | `npx nx show projects` (no `@op-nx/github-cache`); `git grep -e op-nx-github-cache -e start-cache-server -e publish-mirror -e verdaccio -- ':!.planning/**'` -> 0 hits; `test -d start-cache-server` -> absent; `npx nx sync:check` | Battery `[VERIFIED]` |
| SC2 | mirror-cleanup gone; ci.yml has no cache coupling | `test -f .github/workflows/mirror-cleanup.yml` -> absent; `git grep -e './start-cache-server' -e 'nx reset' -e 'windows-selfcheck' -e 'publish-mirror' -- .github/workflows/ci.yml` -> 0 hits | grep-based |
| SC3 | 5-job local-cache-only CI green | reworked `ci.yml` green on push/PR; locally `npm run build/typecheck/test/integration` exit 0 + `nx format:check --all` exit 0 | no-op `[VERIFIED]`; format `[VERIFIED red - resolve first]` |
| SC4 | shell intact + green | `nx.json`/root tsconfigs/`vitest.workspace.ts`/root `package.json`/`.gitattributes` present; `npx nx run-many -t build test` exit 0 | `[VERIFIED exit 0]` |
| SC5 | codebase map regenerated, no PoC trace | `/gsd:map-codebase` then `git grep -e op-nx-github-cache -e selectBackend -- '.planning/codebase/**'` -> 0 hits | post-commit |

### Wave 0 gaps
- None in the test-file sense. The only pre-existing gate failure is `nx format:check --all` (Pitfall 2 / Open Questions) - resolve it or the phase's own SC3 gate is red.

## Security Domain

`workflow.security_enforcement: true` (ASVS L1, block-on: high). A teardown is a net attack-surface REDUCTION, so most ASVS categories are N/A (no new input, auth, session, or crypto surface is introduced). Relevant points:

| ASVS / concern | Applies | Note |
|----------------|---------|------|
| V1 Architecture / least privilege | yes | Workflow `permissions` drops to `contents: read`; the `contents: write` (`publish-mirror`, `mirror-cleanup`) and `actions: read` write/read paths are deleted. Confirm no residual job re-grants write. `[VERIFIED: ci.yml permissions]` |
| V5 Input validation, V6 Crypto, V2/V3 Auth/Session | no | No runtime code remains after teardown; the PoC server/backends are deleted |
| Secret handling | yes (informational) | No repo secrets removed/rotated (runner-injected tokens only) - see Runtime State Inventory |

**Threat note (not a code vuln, out of Phase 0 scope but log it):** deleting `mirror-cleanup.yml` stops age-based pruning of any existing public `cache-mirror-*` Release assets, so PoC-era mirrored artifacts persist and stay anonymously world-readable until manually deleted. For this public repo that content was already public; flag for the optional remote-cleanup decision, not a blocker.

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|------------|-------------|-----------|---------|----------|
| Nx CLI (local) | every teardown/verify step | Yes | 23.1.0 | - |
| Node.js | Nx, npm | Yes | v24.13.0 (`.node-version` = `lts/krypton`) | - |
| npm | `npm ci` / `npm install` lockfile resync | Yes | bundled with Node 24 | - |
| git | grep-based dangling checks | Yes | - | - |
| `/gsd:map-codebase` | SC5 de-priming | Yes (GSD command) | - | - |

No NEW external dependency is introduced (the phase only removes). No web/registry lookup was needed - every claim was verifiable against the live workspace, which is stronger evidence than docs.

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|-------|---------|---------------|
| A1 | Reducing/scoping formatting of tracked GSD docs (via `.prettierignore` OR `nx format:write`) is acceptable to make `format:check --all` green | Pitfall 2 / Open Questions | If neither is allowed, SC3 (green CI) cannot be met without changing the `--all` mechanic (which D-05 locks to KEEP) |
| A2 | Updating stale root `README.md` PoC references is in-scope hygiene for SC5 | Q2 item 10 / Q6 | If out-of-scope, a broken doc link + PoC "current-state" prose survives teardown |
| A3 | GitHub-side Actions-cache / Release-mirror remote state need NOT be deleted in Phase 0 | Runtime State Inventory | If a clean remote is actually required, an extra manual `cache-mirror-*` deletion task is needed |

All three are breadth/policy judgments beyond the 6 locked decisions - surface to the planner/user, do not self-lock.

## Open Questions

1. **How to make `nx format:check --all` green (SC3)?** `[VERIFIED red]` The tracked unformatted files are `.claude/settings.json`, `CLAUDE.md`, `.planning/**` - all docs/agent-config, none are workspace source. SC5 regenerates `.planning/codebase/*` (more markdown), so this churns every phase.
   - **Recommendation (durable, lazy):** add `.planning/`, `CLAUDE.md`, `AGENTS.md`, `.claude/` (GSD/agent docs - not part of the consumer contract, so consumer-safe) to `.prettierignore`, keeping `format:check --all` scoped to real source. One edit, survives future `.planning` churn.
   - **Alternative:** `nx format:write` the whole tree now and again after SC5's map-codebase run. Simpler policy, but any future GSD doc write re-reddens CI until reformatted.
   - Flag as A1 - needs planner/user confirmation (it is a policy tweak beyond D-01..D-06).

2. **Update root `README.md`?** It calls `@op-nx/github-cache` "the only package" and links its now-deleted README (broken link). Recommend a minimal shell-describing rewrite as part of teardown (aligns with SC5 "no rebuild-priming artifact remains"). Flagged A2.

3. **Delete PoC-era GitHub remote cache/mirror assets?** Not required by SC1-5. Recommend deferring (public content, self-evicting Actions cache). Flagged A3.

## Sources

### Primary (HIGH confidence - live tooling, ground truth)
- `nx g @nx/workspace:remove --help` (Nx 23.1.0) - exact flag set.
- `nx g @nx/workspace:remove @op-nx/github-cache --dry-run --no-interactive` - exact touched-file set (DELETE package tree + UPDATE root tsconfig.json).
- `nx run-many -t build test typecheck integration [-p @op-nx/source]` - green no-op, EXIT=0.
- `nx sync:check` (green), `nx show projects` / `nx show project --json`, `nx graph --print` - graph + target inventory.
- `nx format:check --all` (EXIT=1) - format gate state.
- `git grep` across tracked files + `package-lock.json` - complete dangling-reference inventory.
- Repo files read directly: `nx.json`, root `package.json`, `tsconfig.base.json`, `tsconfig.json`, `vitest.workspace.ts`, `.gitattributes`, `.gitignore`, `.prettierignore`, `.prettierrc`, `.node-version`, both `.github/workflows/*.yml`, `packages/op-nx-github-cache/package.json`, `.planning/config.json`.

### Secondary (curated first-party research, MEDIUM-HIGH)
- `.planning/research/PITFALLS.md` "Empirically-Verified Platform Facts" - `process.platform` discriminator, `.gitattributes eol=lf`, `externalDependencies` scoping, cross-OS hash divergence. Implementation-independent; stays true after teardown.
- `.planning/ROADMAP.md` "### Phase 0: Teardown", `.planning/PROJECT.md`, `.planning/phases/00-teardown/00-CONTEXT.md`.

### Tertiary
- None. No external/web lookup was warranted - all unknowns were resolved empirically against the installed Nx 23.1.0.

## Metadata

**Confidence breakdown:**
- Generator contract (Q1): HIGH - `--help` + `--dry-run` against the exact installed version.
- Dangling inventory (Q2): HIGH - exhaustive `git grep` + file reads.
- Verification battery (Q3): HIGH - exit codes observed live.
- CI rework (Q4): HIGH - full ci.yml read + no-op behavior verified; skeleton is a recommendation.
- Invariant preservation (Q5): HIGH - dormant-vs-dangling distinction verified against existing non-matching defaults.
- De-priming (Q6): MEDIUM - mechanics clear; exact `/gsd:map-codebase` output depends on the runtime.
- Format-check remediation (Open Q1): MEDIUM - the red state is VERIFIED; the fix is a flagged policy choice.

**Research date:** 2026-07-18
**Valid until:** stable until the Nx version changes (re-verify the generator contract on any `nx` bump); the empirical facts hold as long as the workspace shell is unchanged.
