---
phase: 00-teardown
plan: 04
subsystem: infra
tags: [nx, verification, acceptance-battery, graph-clean, ci, cross-os, teardown]

# Dependency graph
requires:
  - phase: 00-teardown (plans 00-01, 00-02, 00-03)
    provides: shell-only Nx workspace + local-cache-only CI + scoped format gate; the merged Wave-1 tree this plan verifies
provides:
  - "Clean-state proof: SC1 (zero dangling references), SC2 (ci.yml cache-coupling gone), SC3 (5 targets green on local cache only + valid 5-job ci.yml), SC4 (shell intact + D-03 dormant invariants preserved) all pass on the merged tree"
  - "Committed, graph-clean, green workspace = the precondition for plan 05's /gsd:map-codebase de-priming (D-06)"
affects: [00-05-map-codebase-deprime, phase-1-rebuild]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Teardown acceptance is a command battery (nx sync:check / show projects / graph --print + git grep + npm ci + nx run-many + format:check), not test files"
    - "Dangling-ref check separates the authoritative direct-ref grep (nx.json/package.json/tsconfig.json) from the over-broad lockfile-scoped verdaccio grep (transitive @nx/js optional peer = non-defect)"

key-files:
  created:
    - .planning/phases/00-teardown/00-04-SUMMARY.md
  modified: []

key-decisions:
  - "Verification-only plan: no source/config files modified (files_modified: []); npm ci only refreshed gitignored node_modules, working tree stayed clean"
  - "Confirmed the carry-forward verdaccio non-defect: the literal SC1 grep (incl verdaccio) matches ONLY package-lock.json transitive-peer entries; the authoritative PoC-token grep (verdaccio excluded) and the direct-ref config grep both return exit 1 (no matches)"

patterns-established:
  - "The literal must_haves.truths SC1 grep that includes verdaccio over the whole tree is over-broad; the authoritative gate is (a) PoC tokens absent tree-wide + (b) direct verdaccio/local-registry refs absent from config files"

requirements-completed: []

coverage:
  - id: SC1
    description: "Graph resolves with zero dangling references; PoC project + siblings gone; PoC tokens absent from tracked source/config"
    verification:
      - kind: other
        ref: "npx nx sync:check -> exit 0 (The workspace is up to date)"
        status: pass
      - kind: other
        ref: "npx nx show projects --json -> [\"@op-nx/source\"] (exit 0); no @op-nx/github-cache"
        status: pass
      - kind: other
        ref: "npx nx graph --print -> exit 0, valid JSON, single node @op-nx/source"
        status: pass
      - kind: other
        ref: "packages/op-nx-github-cache, start-cache-server, publish-mirror, .verdaccio -> all ABSENT"
        status: pass
      - kind: other
        ref: "git grep -nE 'op-nx-github-cache|start-cache-server|publish-mirror|@actions/cache|@octokit' -- ':!.planning' (verdaccio excluded) -> exit 1, no matches"
        status: pass
      - kind: other
        ref: "git grep -nE '...|verdaccio|local-registry' -- nx.json package.json tsconfig.json -> exit 1, no matches (direct refs gone)"
        status: pass
    human_judgment: false
  - id: SC2
    description: "ci.yml free of cache coupling; mirror-cleanup.yml deleted; least-privilege permission posture (T-00-10 cross-check)"
    verification:
      - kind: other
        ref: "git grep -nE 'start-cache-server|nx reset|windows-selfcheck|publish-mirror' -- .github/workflows/ci.yml -> exit 1, no matches"
        status: pass
      - kind: other
        ref: "test ! -f .github/workflows/mirror-cleanup.yml -> exit 0 (absent)"
        status: pass
      - kind: other
        ref: "git grep -nE 'contents:\\s*write|actions:\\s*(read|write)' -- .github/workflows/ci.yml -> exit 1; contents: read present"
        status: pass
    human_judgment: false
  - id: SC3
    description: "5 targets green on local cache only; ci.yml valid YAML with the 5 jobs; format:check --all green"
    verification:
      - kind: other
        ref: "ci.yml parses as valid YAML; jobs == [format-check, build, typecheck, test, integration]; permissions contents: read"
        status: pass
      - kind: other
        ref: "npm run build / typecheck / test / integration -> each exit 0 (No tasks were run, green no-op)"
        status: pass
      - kind: other
        ref: "npx nx run-many -t build test typecheck integration -> exit 0 (No tasks were run)"
        status: pass
      - kind: other
        ref: "npx nx format:check --all -> exit 0"
        status: pass
    human_judgment: false
  - id: SC4
    description: "Workspace shell intact + green; D-03 dormant cross-OS invariants preserved (T-00-09 mitigation)"
    verification:
      - kind: other
        ref: "npm ci -> exit 0 (lockfile in sync)"
        status: pass
      - kind: other
        ref: "git grep -F 'node -p process.platform' -- nx.json -> match (integration discriminator preserved)"
        status: pass
      - kind: other
        ref: "git grep -F 'eol=lf' -- .gitattributes -> match (cross-OS EOL invariant preserved)"
        status: pass
    human_judgment: false

# Metrics
duration: 8min
completed: 2026-07-18
status: complete
---

# Phase 0 Plan 04: Graph-clean + green-CI acceptance battery Summary

**Ran the SC1-SC4 acceptance-command battery across the fully-merged Wave-1 teardown tree and proved it graph-clean and green on Nx's local cache only: zero dangling references, ci.yml free of cache coupling with valid 5-job structure, all five targets a green no-op, and the D-03 dormant cross-OS invariants intact - the committed clean-state proof that gates plan 05's de-priming. No source/config files were modified (verification-only).**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-07-18T02:41:00Z (approx)
- **Completed:** 2026-07-18T02:46:39Z
- **Tasks:** 2 (both verification-only)
- **Files modified:** 0 tracked (SUMMARY.md + STATE.md + ROADMAP.md are the only writes)

## Accomplishments

Executed the full acceptance battery from 00-04-PLAN.md. Every command's exit code recorded below.

### SC1 - zero dangling references

| Command | Result | Exit |
|---------|--------|------|
| `npx nx sync:check` | `The workspace is up to date` | 0 |
| `npx nx show projects --json` | `["@op-nx/source"]` (no `@op-nx/github-cache`) | 0 |
| `npx nx graph --print` | valid JSON, single node `@op-nx/source` | 0 |
| `test ! -e` on `packages/op-nx-github-cache` / `start-cache-server` / `publish-mirror` / `.verdaccio` | all ABSENT | 0 |
| `git grep -nE 'op-nx-github-cache\|start-cache-server\|publish-mirror\|@actions/cache\|@octokit' -- ':!.planning'` (verdaccio excluded - authoritative PoC-token gate) | no matches | 1 |
| `git grep -nE '...\|verdaccio\|local-registry' -- nx.json package.json tsconfig.json` (direct-ref gate) | no matches | 1 |

### SC2 - CI cache-coupling removed, least privilege

| Command | Result | Exit |
|---------|--------|------|
| `git grep -nE 'start-cache-server\|nx reset\|windows-selfcheck\|publish-mirror' -- .github/workflows/ci.yml` | no matches | 1 |
| `test ! -f .github/workflows/mirror-cleanup.yml` | absent | 0 |
| `git grep -nE 'contents:\s*write\|actions:\s*(read\|write)' -- .github/workflows/ci.yml` (T-00-10 cross-check) | no matches | 1 |
| `git grep -n 'contents: read' -- .github/workflows/ci.yml` | present (line 10) | 0 |

### SC3 - green on local cache only + valid ci.yml

| Command | Result | Exit |
|---------|--------|------|
| ci.yml YAML parse + job list | valid; jobs = `[format-check, build, typecheck, test, integration]`; `permissions: contents: read`; triggers `[push, pull_request]` | 0 |
| `npm run build` | `No tasks were run` (green no-op) | 0 |
| `npm run typecheck` | `No tasks were run` | 0 |
| `npm run test` | `No tasks were run` | 0 |
| `npm run integration` | `No tasks were run` | 0 |
| `npx nx run-many -t build test typecheck integration` | `No tasks were run` | 0 |
| `npx nx format:check --all` | clean (no unformatted files) | 0 |

### SC4 - shell intact + D-03 dormant invariants preserved

| Command | Result | Exit |
|---------|--------|------|
| `npm ci` | `added 647 packages` (lockfile in sync) | 0 |
| `git grep -F 'node -p process.platform' -- nx.json` | match (`integration` discriminator preserved) | 0 |
| `git grep -F 'eol=lf' -- .gitattributes` | match (`* text=auto eol=lf`) | 0 |

## Carry-forward non-defects (correctly excluded, NOT teardown failures)

**1. `verdaccio` still appears in `package-lock.json`.** The literal `must_haves.truths` SC1 grep (which INCLUDES `verdaccio` over the whole tree minus `.planning`) returns exit 0 - but `git grep -l` proves it matches **only `package-lock.json`**, and every match is a `verdaccio` / `@verdaccio/*` node_modules lockfile entry. `verdaccio` is a `peerDependenciesMeta.optional: true` peer of `@nx/js` (workspace-core), pulled transitively by default `npm ci`; it is NOT a dangling PoC reference (documented in 00-01-SUMMARY Deviation 2). Forcing it out would require `--omit=optional` and desync the default `npm ci` gate. The authoritative gates confirm no real dangling ref: the PoC-token grep with `verdaccio` excluded returns exit 1 (no matches anywhere in the tree), and the direct-ref config grep (nx.json/package.json/tsconfig.json) including `verdaccio` + `local-registry` returns exit 1 (the direct devDep and the `local-registry` target are both gone).

**2. `.gsd-migration-backup/` in `.prettierignore`.** Expected (00-03 Deviation 1): a gitignored, untracked GSD1->OpenGSD migration backup with an unformatted MANIFEST.json. It is why `nx format:check --all` is green; it never ships and does not exist in CI's fresh checkout.

## Deviations from Plan

None - the plan is verification-only and every authoritative acceptance check passed on the first run. The single "expect no matches / exit 1" criterion that instead returned exit 0 (the literal SC1 grep including `verdaccio`) is the pre-documented transitive-peer non-defect above, not a teardown regression; the authoritative scoped greps confirm the intent (zero dangling PoC references) is fully met.

## Issues Encountered

- 13 moderate npm audit advisories reported by `npm ci` - all pre-existing in retained devDeps (nx/vite/etc.), inherited from before teardown. Out of scope for this verification plan (noted in 00-01-SUMMARY).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- SC1 (zero dangling references), SC2 (CI cache-coupling removed), SC3 (5 targets green on local cache only + valid 5-job ci.yml), and SC4 (shell intact + D-03 dormant invariants preserved) are all proven on the merged tree.
- Wave 2 complete. The committed, graph-clean, green workspace is the precondition (D-06) for Wave 3 / plan 05: `/gsd:map-codebase` can now regenerate `.planning/codebase/*` against the torn-down shell-only state without a broken graph or out-of-sync lockfile poisoning the map.

## Self-Check: PASSED

- SUMMARY file written: `.planning/phases/00-teardown/00-04-SUMMARY.md` (this file).
- No tracked files modified: `git status --short` clean after the battery (npm ci only refreshed gitignored node_modules).
- Every SC1-SC4 acceptance command's exit code recorded above; all authoritative checks pass.
- Carry-forward non-defects (verdaccio transitive peer; `.gsd-migration-backup/` ignore) correctly identified and excluded.

---
*Phase: 00-teardown*
*Completed: 2026-07-18*
