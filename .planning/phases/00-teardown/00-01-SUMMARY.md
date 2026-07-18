---
phase: 00-teardown
plan: 01
subsystem: infra
tags: [nx, nx-workspace-remove, teardown, monorepo, package-lock, cross-os]

# Dependency graph
requires:
  - phase: (none - Phase 0 is the first phase; operates on the pre-existing PoC workspace)
    provides: the spike/PoC Nx workspace shell that this plan tears down
provides:
  - Shell-only Nx workspace whose sole project is @op-nx/source
  - Graph resolves with zero dangling references (nx show projects / sync:check / run-many all green)
  - nx.json/package.json scrubbed of PoC residue; package-lock.json resynced (npm ci green)
  - D-03 dormant cross-OS invariants preserved intact (.gitattributes eol=lf; nx.json integration targetDefault + node -p process.platform discriminator)
affects: [phase-1-rebuild, phase-3-cross-os, phase-6-distribution, 00-02-ci-rework, 00-03-doc-deprime, 00-04-green-battery]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Preserved (not re-derived): nx.json integration targetDefault { runtime: node -p process.platform } cross-OS hash discriminator (D-03)"
    - "Preserved: externalDependencies scoped to the real toolchain closure (typescript, tslib, @types/node) as a cross-OS hash-parity guard"

key-files:
  created: []
  modified:
    - "tsconfig.json (generator removed the @op-nx/github-cache project reference; references now [])"
    - "nx.json (dropped 2 dangling typecheck.inputs paths + PoC externalDependencies @actions/cache/@octokit/rest; kept integration discriminator)"
    - "package.json (removed nx.targets.local-registry + verdaccio devDep)"
    - "package-lock.json (rebuilt: pruned phantom packages/op-nx-github-cache workspace entry, @actions/cache, @octokit/*, direct verdaccio)"

key-decisions:
  - "Ran nx g @nx/workspace:remove WITHOUT --forceRemove (zero dependents; surfaces an unexpected in-use report rather than forcing past)"
  - "Deleted the 3 sibling dirs (start-cache-server/, publish-mirror/, .verdaccio/) with git rm -r since the generator does not own them"
  - "Rebuilt package-lock.json from scratch (rm -f package-lock.json + npm install) because a plain npm install left a phantom extraneous packages/op-nx-github-cache entry"
  - "Accepted residual verdaccio lockfile entries: they are a transitive optional:true peer of @nx/js (workspace-core), NOT a dangling PoC reference; forcing them out would desync default npm ci"

patterns-established:
  - "Teardown verification is a command battery (nx show projects / sync:check / run-many + npm ci + git grep), not test files"

requirements-completed: []

coverage:
  - id: D1
    description: "PoC project @op-nx/github-cache and its 3 non-graph siblings removed; graph resolves to @op-nx/source only"
    verification:
      - kind: other
        ref: "npx nx show projects -> [\"@op-nx/source\"]"
        status: pass
      - kind: other
        ref: "test ! -d packages/op-nx-github-cache && test ! -d start-cache-server && test ! -d publish-mirror && test ! -d .verdaccio"
        status: pass
      - kind: other
        ref: "npx nx sync:check -> workspace up to date (exit 0)"
        status: pass
      - kind: other
        ref: "npx nx run-many -t build test typecheck integration -> No tasks were run (exit 0, green no-op)"
        status: pass
    human_judgment: false
  - id: D2
    description: "nx.json + package.json scrubbed of dangling PoC residue; D-03 dormant cross-OS invariants preserved"
    verification:
      - kind: other
        ref: "git grep -nE 'op-nx-github-cache|@actions/cache|@octokit|verdaccio' -- nx.json package.json tsconfig.json -> no matches (exit 1)"
        status: pass
      - kind: other
        ref: "git grep -F 'node -p process.platform' -- nx.json -> match; git grep -F 'eol=lf' -- .gitattributes -> match"
        status: pass
      - kind: other
        ref: "node -e JSON.parse(nx.json)+JSON.parse(package.json) -> both valid JSON (exit 0)"
        status: pass
    human_judgment: false
  - id: D3
    description: "package-lock.json resynced; npm ci green; PoC deps pruned from the lockfile"
    verification:
      - kind: other
        ref: "npm ci -> exit 0"
        status: pass
      - kind: other
        ref: "git grep -nE 'op-nx-github-cache|@octokit|@actions/cache' -- package-lock.json -> no matches (exit 1)"
        status: pass
    human_judgment: false

# Metrics
duration: 21min
completed: 2026-07-18
status: complete
---

# Phase 0 Plan 01: PoC Teardown - Nx workspace shell, graph-clean and green Summary

**Removed the @op-nx/github-cache spike/PoC project and its 3 non-graph siblings via nx g @nx/workspace:remove, scrubbed the dangling nx.json/package.json residue, and rebuilt package-lock.json - leaving a shell-only Nx workspace (@op-nx/source only) that resolves with zero dangling references and passes npm ci, with the D-03 dormant cross-OS invariants preserved.**

## Performance

- **Duration:** ~21 min wall (actual commit span ~8 min; remainder was the org-spend-limit pause + the nx-generate skill fork)
- **Started:** 2026-07-18T01:57:40Z
- **Completed:** 2026-07-18T02:18:52Z
- **Tasks:** 3
- **Files modified:** 42 files changed (385 insertions, 5822 deletions), across 8 top-level paths

## Accomplishments
- Deleted the PoC project `packages/op-nx-github-cache/` (via the Nx generator) plus `start-cache-server/`, `publish-mirror/`, `.verdaccio/`; `nx show projects` now lists `@op-nx/source` only.
- Scrubbed all dangling PoC references: 2 hard-coded `typecheck.inputs` paths + the `@actions/cache`/`@octokit/rest` externalDependencies from nx.json, and the `local-registry` target + `verdaccio` devDep from package.json.
- Rebuilt `package-lock.json` so `npm ci` exits 0 and no PoC package (`op-nx-github-cache`, `@octokit`, `@actions/cache`) remains in the lockfile.
- Preserved the D-03 load-bearing dormant invariants: `.gitattributes eol=lf` (untouched) and the nx.json `integration` targetDefault including the `{ runtime: "node -p process.platform" }` cross-OS discriminator.
- Graph-clean gate green: `nx sync:check` up to date, `nx run-many -t build test typecheck integration` is a benign exit-0 no-op.

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove the PoC project via the Nx generator and delete its non-graph siblings** - `9ce6273` (chore)
2. **Task 2: Scrub dangling PoC residue from nx.json and package.json, preserving the shell** - `406c9a5` (chore)
3. **Task 3: Resync package-lock.json so npm ci passes** - `0bc7af8` (chore)

**Plan metadata:** committed separately (docs: complete plan) with SUMMARY.md + STATE.md + ROADMAP.md.

## Files Created/Modified
- `tsconfig.json` - generator removed the `./packages/op-nx-github-cache` project reference (`references` now `[]`).
- `nx.json` - dropped the two dangling `typecheck.inputs` fileset paths into the deleted package and the PoC `externalDependencies` (`@actions/cache`, `@octokit/rest`) from both `build` and `typecheck`; kept the toolchain closure (`typescript`, `tslib`, `@types/node`) and the `integration` discriminator.
- `package.json` - removed `nx.targets.local-registry` (pointed at the deleted `.verdaccio/config.yml`) and the `verdaccio` devDependency; kept `nx.includedScripts: []` and the `build`/`typecheck`/`test`/`integration`/`format*` scripts.
- `package-lock.json` - rebuilt from package.json; pruned the phantom `packages/op-nx-github-cache` workspace entry, `@actions/cache`, `@octokit/*`, and the direct `verdaccio` devDep.
- Deleted: `packages/op-nx-github-cache/` (32 files), `start-cache-server/`, `publish-mirror/`, `.verdaccio/`.

## Decisions Made
- **No `--forceRemove`:** ran the generator plainly (graph showed zero dependents; a `--dry-run` was clean) so any unexpected in-use report would surface rather than being forced past. Confirmed the generator's contract at execute time via `--help` + `--dry-run` before the real run.
- **Sibling deletion via `git rm -r`** (specific paths only), consistent with the git-hygiene rule (never `git add -A`/glob).
- **Lockfile rebuilt from scratch** rather than trusting the incremental `npm install` (see Deviation 1).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Plain `npm install` left a phantom `packages/op-nx-github-cache` lockfile entry**
- **Found during:** Task 3 (Resync package-lock.json)
- **Issue:** After `npm install`, `package-lock.json` still contained a `packages/op-nx-github-cache` workspace entry marked `"extraneous": true` (with its `@actions/cache`/`@octokit/rest` deps). That is exactly the dangling PoC reference SC1 forbids. `npm install` pruned node_modules but did not evict the stale workspace node from the lockfile's `packages` map.
- **Fix:** `rm -f package-lock.json && npm install` to force a from-scratch resolution off `package.json` only. The phantom entry (and its `@octokit`/`@actions/cache` deps) is gone; `npm ci` exits 0.
- **Files modified:** package-lock.json
- **Verification:** `node -e "'packages/op-nx-github-cache' in require('./package-lock.json').packages"` -> false; `git grep -nE 'op-nx-github-cache|@octokit|@actions/cache' -- package-lock.json` -> no matches (exit 1); `npm ci` -> exit 0.
- **Committed in:** `0bc7af8` (Task 3 commit)

### Accepted (not fixed) - acceptance sub-criterion factually unsatisfiable

**2. Residual `verdaccio` entries remain in package-lock.json**
- **Found during:** Task 3
- **Sub-criterion affected:** Task 3 acceptance `git grep ... verdaccio ... -- package-lock.json -> no matches`, and the plan `<verification>` grep that extends the PoC-residue check to `package-lock.json`.
- **Why not fixed:** `verdaccio` is declared by `@nx/js` (workspace-core) as a `peerDependency` with `peerDependenciesMeta.optional: true`. Default `npm install`/`npm ci` install satisfiable optional peers, so a fully from-scratch lockfile rebuild still pulls `verdaccio@6.8.0` transitively (`npm ls verdaccio` -> `@op-nx/source -> @nx/js -> verdaccio`). It is NOT a dangling PoC reference. Forcing it out would require `--omit=optional`/`--legacy-peer-deps`, which would produce a lockfile inconsistent with the default `npm ci` that CI runs - breaking the far more important `npm ci -> exit 0` gate.
- **Why this is acceptable:** The D-04 intent (remove the DIRECT `verdaccio` devDep + the `local-registry` target) is fully satisfied - neither `root.devDependencies.verdaccio` nor `root.dependencies.verdaccio` exists, and `local-registry` is gone. The plan's authoritative `must_haves.truths` verdaccio grep is scoped to `nx.json package.json tsconfig.json` (NOT the lockfile) and PASSES. SC1 ("graph resolves with zero dangling references") is met: `nx show projects`/`sync:check`/`run-many` are all clean. The `package-lock.json` verdaccio grep is over-broad - it flags a legitimate workspace-core transitive dep that predates and is unrelated to the PoC.

---

**Total deviations:** 1 auto-fixed (blocking), 1 accepted (over-broad acceptance sub-criterion; substantive intent met).
**Impact on plan:** No scope creep. All SC1/SC4-config goals met. The only unmet item is a literal grep sub-criterion that reality (an @nx/js optional peer) makes unsatisfiable without breaking `npm ci`.

## Issues Encountered
- Execution was interrupted once by an org spend-limit reset before any task ran; resumed from the pre-execution baseline with no rework (confirmed by the coordinator and by `git status`). A duplicate executor was started/stopped and did nothing.
- 13 moderate npm audit advisories remain - all pre-existing in retained devDeps (nx/vite/etc.); this teardown only removes packages, so it introduced none. Out of scope for this plan.

## User Setup Required
None - no external service configuration required.

## Self-Check: PASSED
- Commits exist: `9ce6273`, `406c9a5`, `0bc7af8` all present in `git log`.
- Deletions confirmed: `packages/op-nx-github-cache/`, `start-cache-server/`, `publish-mirror/`, `.verdaccio/` all absent on disk and staged as deletions in their commits.
- `npx nx show projects` -> `["@op-nx/source"]` (no `@op-nx/github-cache`).
- `npx nx sync:check` -> workspace up to date (exit 0); `npx nx run-many -t build test typecheck integration` -> exit 0 (no-op).
- `npm ci` -> exit 0.
- `git grep -nE 'op-nx-github-cache|@actions/cache|@octokit|verdaccio' -- nx.json package.json tsconfig.json` -> no matches (exit 1).
- D-03 preserved: `node -p process.platform` present in nx.json; `eol=lf` present in `.gitattributes` (untouched).

## Next Phase Readiness
- SC1 (project + siblings gone, graph clean) and the config half of SC4 (shell intact + green) are met.
- Ready for the remaining Wave-1 plans: 00-02 (CI rework: delete mirror-cleanup.yml, rework ci.yml to the 5-job local-cache-only baseline, D-05), 00-03 (doc de-prime / README shell rewrite, D-07/D-08), then 00-04 (cross-tree SC1 grep + green-CI battery after Wave-1 merges).
- Concern for the phase verifier: the `package-lock.json` verdaccio grep in this plan's `<verification>` block cannot pass (see Deviation 2) - the `verdaccio` token should be dropped from any lockfile-scoped grep in downstream plans (it is a legitimate @nx/js optional peer). The PoC-specific tokens (`op-nx-github-cache`, `@octokit`, `@actions/cache`) ARE fully absent from the lockfile.

---
*Phase: 00-teardown*
*Completed: 2026-07-18*
