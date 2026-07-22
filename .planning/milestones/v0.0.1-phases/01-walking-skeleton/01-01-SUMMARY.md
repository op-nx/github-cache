---
phase: 01-walking-skeleton
plan: 01
subsystem: infra
tags: [nx, typescript, vitest, nodenext, swc, monorepo, ts-solution]

# Dependency graph
requires:
  - phase: 00-teardown
    provides: workspace shell (@op-nx/source), tsconfig.base.json strict nodenext solution, nx.json @nx/js/typescript + @nx/vitest plugins, vitest.workspace.ts discovery glob
provides:
  - "@op-nx/github-cache Nx library at packages/github-cache with inferred build/typecheck/test targets (no project.json)"
  - "Vitest Wave-0 harness (packages/github-cache/vitest.config.mts) auto-discovered by the root workspace glob — every subsequent RED test lands here"
  - "root TS-solution reference wiring (tsconfig.json references[] -> ./packages/github-cache), nx sync:check clean"
  - "zero-dependency invariant proven: lib dependencies {} , no root dep/lockfile-tree churn"
affects: [01-02, 01-03, 01-04, phase-2, phase-3, phase-4, phase-5, phase-6]

# Tech tracking
tech-stack:
  added: []  # ZERO new deps (D-01/FOUND-03) — swc bundler rejected because it requires @swc/cli
  patterns:
    - "Nx @nx/js:lib with --bundler=tsc in a TS-solution workspace -> fully inferred build/typecheck/test targets, no hand-authored project.json (D-02)"
    - "Dependency-free lib: empty dependencies block; generator-added deps stripped (D-01)"

key-files:
  created:
    - packages/github-cache/package.json
    - packages/github-cache/tsconfig.lib.json
    - packages/github-cache/tsconfig.spec.json
    - packages/github-cache/tsconfig.json
    - packages/github-cache/vitest.config.mts
    - packages/github-cache/src/index.ts
  modified:
    - tsconfig.json
    - package-lock.json

key-decisions:
  - "Bundler = tsc (not swc): @nx/js:swc hard-requires @swc/cli (require.resolve + execSync), which pulls a ~109-package tree and declares @swc/helpers as a lib runtime dep — both violate the LOCKED D-01/FOUND-03 zero-dependency mandate. tsc uses the already-present typescript, adds zero deps, and yields inferred targets."
  - "Bundler != none: --bundler=none produces NO build target (exports point to src, package treated as non-buildable), failing the must-have inferred build target."
  - "Removed generator-added tslib from lib dependencies -> {} (prohibition: no dependencies block). Safe: es2022 target + trivial code emit no TS helpers; tslib stays hoisted (root devDep) if ever needed in-repo. Publish-time dep declaration is Phase 6's concern."

patterns-established:
  - "Scaffold-via-generator, strip-non-conforming-output: run nx g with --dry-run, then remove any dep/config the generator adds that violates a locked constraint, and revert spurious cosmetic reformatting."
  - "Inferred-target lib: presence of tsconfig.lib.json -> build/typecheck (via @nx/js/typescript); presence of vitest.config.mts -> test (via @nx/vitest). No project.json."

requirements-completed: []  # SRV-01 is lineage for this vessel but its behavior (loopback bind) is built+tested in Plan 01-02 — NOT completed here.

coverage:
  - id: D1
    description: "@op-nx/github-cache lib scaffolded via nx g @nx/js:lib with inferred build/typecheck/test targets, LOCKED name, tsconfig.lib.json extends ../../tsconfig.base.json"
    verification:
      - kind: automated_ui
        ref: "npx nx show project github-cache --json (targets include build, typecheck, test) + npx nx build/typecheck/test github-cache"
        status: pass
    human_judgment: false
  - id: D2
    description: "Root TS-solution reference wired (tsconfig.json references[] -> ./packages/github-cache); Vitest harness green"
    verification:
      - kind: automated_ui
        ref: "npx nx sync:check (exit 0) && CI=true npx nx test github-cache (1 passed, exit 0)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Zero-dependency invariant: lib package.json dependencies is empty; root package.json and nx.json unchanged; lockfile gained only the workspace-member registration"
    verification:
      - kind: other
        ref: "git diff --stat package.json nx.json (empty) + node -e print(dependencies)=={} + git diff package-lock.json (workspace member only)"
        status: pass
    human_judgment: false

# Metrics
duration: 21min
completed: 2026-07-18
status: complete
---

# Phase 1 Plan 01: Scaffold @op-nx/github-cache lib Summary

**`@op-nx/github-cache` Nx library scaffolded via `nx g @nx/js:lib --bundler=tsc` with fully inferred build/typecheck/test targets, LOCKED published name, zero runtime dependencies, and a green Vitest Wave-0 harness wired into the root TS solution.**

## Performance

- **Duration:** 21 min
- **Started:** 2026-07-18T12:22:29Z
- **Completed:** 2026-07-18T12:43:21Z
- **Tasks:** 2
- **Files modified:** 11 (9 created, 2 modified)

## Accomplishments
- Generated the `@op-nx/github-cache` library at `packages/github-cache` with inferred `build`/`typecheck`/`test` targets (via `@nx/js/typescript` + `@nx/vitest` plugins) — no hand-authored `project.json` (D-02).
- Held the LOCKED zero-dependency line (D-01/FOUND-03): root `package.json`/`nx.json` untouched, lib `dependencies` is `{}`, lockfile gained only the workspace-member registration.
- Verified the generator-added root TS-solution reference (`tsconfig.json` `references[]` -> `./packages/github-cache`); `nx sync:check` clean.
- Proved the Vitest harness runs green (`nx test github-cache`, 1 passing sample test) — the Wave-0 landing zone for every subsequent RED test in Plans 02-04.

## Task Commits

Each task was committed atomically:

1. **Task 1: Generate the @op-nx/github-cache lib via nx g @nx/js:lib** - `80136c2` (feat)
2. **Task 2: Verify the generator's root TS-solution reference and prove the harness runs green** - `6f6ee65` (chore)

## Files Created/Modified
- `packages/github-cache/package.json` - `@op-nx/github-cache` manifest; inferred targets; `dependencies: {}`
- `packages/github-cache/tsconfig.lib.json` - build/typecheck config, `extends ../../tsconfig.base.json`
- `packages/github-cache/tsconfig.spec.json` - test-only TS config
- `packages/github-cache/tsconfig.json` - project aggregator (references lib + spec)
- `packages/github-cache/vitest.config.mts` - Vitest config (`.mts`), auto-discovered by the root glob -> infers `test`
- `packages/github-cache/src/index.ts` - public barrel (sample re-export; neutralized in Plan 02)
- `packages/github-cache/src/lib/github-cache.ts` + `.spec.ts` - generator sample (kept so `test` passes; replaced in Plan 02)
- `packages/github-cache/README.md` - generator scaffold (inert)
- `tsconfig.json` (root) - added `{ "path": "./packages/github-cache" }` reference (generator-added, verified)
- `package-lock.json` - `@op-nx/github-cache` workspace-member registration only

## Decisions Made
- **Bundler = `tsc`, not `swc`.** RESEARCH Q1 recommended `--bundler=swc` on the belief it was dependency-free. It is not (see Deviations). `tsc` uses the already-present `typescript`, adds zero deps, and produces fully inferred targets — the exact D-01 + D-02 intersection.
- **Not `--bundler=none`.** Evaluated and rejected: `none` yields no `build` target (exports point to `src`, so `@nx/js/typescript` treats the package as non-buildable), failing the must-have inferred `build`.
- **SRV-01 left unmarked.** This is the vessel SRV-01 is built into; its loopback-bind behavior is implemented and tested in Plan 01-02 (which also claims SRV-01). Marking it complete here would be a false-positive.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug (in RESEARCH Q1)] Bundler switched swc -> tsc to honor the LOCKED zero-dependency mandate**
- **Found during:** Task 1 (generator run)
- **Issue:** RESEARCH Q1 pinned `--bundler=swc` claiming "zero new dependencies". Verified false: the `@nx/js:swc` executor does `require.resolve('@swc/cli/bin/swc.js')` and `execSync`s it (`node_modules/@nx/js/dist/src/utils/swc/compile-swc.js:14`), so swc HARD-REQUIRES `@swc/cli` (an optional peer the generator explicitly installs) — the swc run added `@swc/cli` to root `devDependencies` (+~2148 lockfile lines / 109 packages) and declared `@swc/helpers` as a lib runtime `dependency`. Both violate the LOCKED D-01/FOUND-03 dependency-free mandate (a hard Phase-1 acceptance gate). The bundler was explicitly "Claude's Discretion / re-openable at execute time"; D-01 is LOCKED, so D-01 wins.
- **Fix:** Reverted the swc generation entirely; regenerated with `--bundler=tsc` (zero new root deps, inferred build/typecheck/test targets). Consequence: no `.swcrc` is produced (swc-only artifact) — expected and harmless.
- **Files modified:** entire lib scaffold (regenerated), root `tsconfig.json`, `package-lock.json`
- **Verification:** `git diff --stat package.json nx.json` empty; `npx nx build/typecheck/test github-cache` all green
- **Committed in:** `80136c2` (Task 1)

**2. [Rule 3 - Blocking / remove generator-added dep] Removed generator-added `tslib` from the lib's dependencies**
- **Found during:** Task 1 (post-generation inspection)
- **Issue:** `--bundler=tsc` generated `dependencies: { "tslib": "^2.3.0" }` (because `tsconfig.base.json` sets `importHelpers: true`). The prohibition requires `packages/github-cache/package.json` to have "no `dependencies` block or an empty one", and Task 1 instructs "if the generator adds any dependency, remove it".
- **Fix:** Edited lib `package.json` `dependencies` to `{}` and re-synced the lockfile. Safe: the `es2022` target + trivial code emit no TS helpers, so no `tslib` import appears in output; `tslib` remains hoisted as a root devDep for any in-repo need. Publish-time dep declaration is Phase 6's concern.
- **Files modified:** `packages/github-cache/package.json`, `package-lock.json`
- **Verification:** `nx build/typecheck/test github-cache` all green with `dependencies: {}`
- **Committed in:** `80136c2` (Task 1)

**3. [Rule 3 - cleanup] Reverted spurious `nx.json` cosmetic reformat**
- **Found during:** Task 1 (generator formatting pass)
- **Issue:** The generator's JSON re-serialization expanded compact inline `inputs` objects to multi-line in `nx.json` (no semantic change; the load-bearing `integration` `{ runtime: node -p process.platform }` discriminator preserved). The acceptance criterion wants only expected registration / no unexpected root-config churn.
- **Fix:** `git checkout -- nx.json` (the committed form is already Prettier-canonical — `nx format:check --files nx.json` exits 0). Result: zero `nx.json` churn.
- **Files modified:** none (reverted)
- **Verification:** `git diff --stat nx.json` empty; `nx format:check` exit 0
- **Committed in:** n/a (reverted before commit)

---

**Total deviations:** 3 (1 research bug, 1 blocking dep removal, 1 cosmetic-churn cleanup)
**Impact on plan:** All three enforce the LOCKED D-01/FOUND-03 zero-dependency mandate that the plan's own prohibition and acceptance gate require. No scope creep — the deliverable (inferred-target, dependency-free lib + green harness) is exactly as specified; only the discretionary bundler choice changed.

## Issues Encountered
- Project registers under its package name `@op-nx/github-cache` in `nx show projects` (TS-solution / npm-workspaces convention); the short name `github-cache` resolves as an alias, so all plan verify commands (`nx show project github-cache`, `nx test github-cache`) work unchanged.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Wave-0 harness ready: `packages/github-cache/vitest.config.mts` is discovered by the root glob; `nx test github-cache` is green. Plans 01-02..01-04 can write RED tests immediately.
- Sample `src/lib/github-cache.ts` + `src/index.ts` are intentionally left in place (test target stays green); Plan 02 neutralizes the barrel and replaces the sample module.
- SRV-01 remains open in REQUIREMENTS.md — closed by Plan 01-02 (loopback bind implementation + test).

## Self-Check: PASSED

All 6 key created files exist on disk; both task commits (`80136c2`, `6f6ee65`) are in git history.

---
*Phase: 01-walking-skeleton*
*Completed: 2026-07-18*
