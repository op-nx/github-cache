---
phase: 00-teardown
plan: 02
subsystem: infra
tags: [github-actions, ci, nx, workflow-permissions, cross-os]

# Dependency graph
requires:
  - phase: 00-teardown (plan 00-01)
    provides: PoC project + cache-server action removed; shell-only Nx workspace, graph-clean
provides:
  - "ci.yml reworked to 5 jobs (format-check, build, typecheck, test, integration matrix) on Nx LOCAL cache only"
  - "workflow permissions reduced to contents: read (least privilege, no actions: scope)"
  - "ubuntu+windows integration matrix with fail-fast: false preserved as dormant cross-OS scaffold"
  - "mirror-cleanup.yml deleted (Release-asset pruning for the removed mirror gone)"
affects: [phase-1-build, phase-3-cross-os, phase-5-creep-controls]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "CI on Nx local cache only: each job is checkout -> setup-node(.node-version + cache:npm) -> npm ci -> single npm run <target>"
    - "Least-privilege workflow: single workflow-level permissions: contents: read; no job-level permission blocks"

key-files:
  created: []
  modified:
    - .github/workflows/ci.yml
    - .github/workflows/mirror-cleanup.yml (deleted)

key-decisions:
  - "D-05: 5-job local-cache-only CI; dropped windows-selfcheck, publish-mirror, all start-cache-server steps, PoC bootstrap builds, and the build reset+reseed dance"
  - "Reduced workflow permissions to contents: read only (T-00-04 mitigation); removed all job-level permission blocks"
  - "Kept ubuntu+windows integration matrix + fail-fast: false as a green no-op scaffold for Phase 3 (D-03/D-05), not dead weight"

patterns-established:
  - "Baseline CI does very little now, sized to receive Phase 1's lib; integration target is a green no-op until Phase 1 adds it"

requirements-completed: []

coverage:
  - id: D1
    description: "mirror-cleanup.yml deleted entirely (whole file)"
    verification:
      - kind: other
        ref: "test ! -f .github/workflows/mirror-cleanup.yml"
        status: pass
    human_judgment: false
  - id: D2
    description: "ci.yml free of cache coupling (no start-cache-server / nx reset / windows-selfcheck / publish-mirror)"
    verification:
      - kind: other
        ref: "git grep -nE 'start-cache-server|nx reset|windows-selfcheck|publish-mirror' -- .github/workflows/ci.yml (no matches, exit 1)"
        status: pass
    human_judgment: false
  - id: D3
    description: "ci.yml declares exactly the five jobs format-check/build/typecheck/test/integration"
    verification:
      - kind: other
        ref: "python -c yaml.safe_load -> jobs == [format-check, build, typecheck, test, integration]"
        status: pass
    human_judgment: false
  - id: D4
    description: "workflow permissions reduced to contents: read only; no contents: write and no actions: scope anywhere"
    verification:
      - kind: other
        ref: "git grep -nE 'contents:\\s*write|actions:\\s*(read|write)' -- .github/workflows/ci.yml (no matches, exit 1)"
        status: pass
    human_judgment: false
  - id: D5
    description: "kept mechanics: push:[main]+pull_request, node-version-file, cache:npm, npm ci, format:check --all, fail-fast:false + windows-11-arm"
    verification:
      - kind: other
        ref: "git grep -F on 'format:check --all', 'node-version-file', 'fail-fast: false', 'windows-11-arm', 'contents: read' (all match)"
        status: pass
    human_judgment: false

# Metrics
duration: 5min
completed: 2026-07-18
status: complete
---

# Phase 0 Plan 02: Rework CI to a lean local-cache-only baseline Summary

**Deleted mirror-cleanup.yml and reworked ci.yml into a 5-job (format-check, build, typecheck, test, ubuntu+windows integration matrix) local-cache-only workflow with least-privilege `contents: read` permissions.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-07-18T02:27:14Z
- **Completed:** 2026-07-18T02:32:32Z
- **Tasks:** 2
- **Files modified:** 2 (1 reworked, 1 deleted)

## Accomplishments
- Reworked `.github/workflows/ci.yml` to run entirely on Nx's LOCAL cache: five jobs, each just checkout -> setup-node -> `npm ci` -> one `npm run <target>`. No cache-server start, no reset+reseed, no PoC bootstrap build.
- Stripped all remote-cache coupling: dropped the `windows-selfcheck` and `publish-mirror` jobs, every `./start-cache-server` step, and the `build` job's `npx nx reset` + second-build reseed.
- Reduced workflow `permissions` to `contents: read` only and removed all job-level permission blocks (mitigates threat T-00-04, elevation of privilege).
- Preserved the load-bearing dormant scaffold: `push:[main]`+`pull_request` triggers, `node-version-file`+`cache:'npm'`, `format:check --all` (with its PR-checkout diff-base comment), and the ubuntu+windows `integration` matrix with `fail-fast: false` for Phase 3 cross-OS.
- Deleted `.github/workflows/mirror-cleanup.yml` (the removed mirror's age-based Release-asset pruning).

## Task Commits

Each task was committed atomically:

1. **Task 1: Delete mirror-cleanup.yml** - `1a2aebf` (chore)
2. **Task 2: Rework ci.yml to the 5-job local-cache-only baseline** - `95b0e2d` (chore)

## Files Created/Modified
- `.github/workflows/ci.yml` - Reworked from 7 cache-coupled jobs to 5 local-cache-only jobs; permissions now `contents: read` only.
- `.github/workflows/mirror-cleanup.yml` - Deleted (44 lines removed).

## Decisions Made
- Followed D-05 exactly: which jobs/steps to drop and which mechanics to keep were dictated by the plan; the integration matrix stays as a dormant cross-OS scaffold rather than being collapsed to one OS.
- Used `npm run <target>` for build/typecheck/test/integration (verified those scripts exist in root `package.json` as `nx run-many -t <target>`, green no-ops post-teardown) and kept `npx nx format:check --all` directly for format-check per the plan.

## Deviations from Plan

None - plan executed exactly as written. Both tasks and all acceptance criteria (grep battery + YAML parse) passed on the first attempt.

## Issues Encountered
- The GSD state-tooling substeps `state.record-metric` and `state.add-decision` initially errored ("phase, plan, and duration required" / "summary required") when invoked with positional args; the handlers take named flags (`--phase/--plan/--duration/--tasks/--files`, `--phase/--summary`). Re-ran with named flags - both succeeded.
- Skipped re-running `state.update-progress`: it renders the progress bar with non-ASCII block characters (U+2588/U+2591), which violates the project's strict ASCII rule (CLAUDE.md overrides tool defaults). The body `Progress:` line was left as its existing ASCII form; the plan counter was still advanced (Plan 3 of 5 via `state.advance-plan`) and ROADMAP plan progress was updated, so position tracking is intact without introducing forbidden Unicode.

## User Setup Required

None - no external service configuration required. (Per D-09, the GitHub remote `cache-mirror-*` Release assets are intentionally left untouched; deleting mirror-cleanup.yml only stops future pruning.)

## Next Phase Readiness
- CI is a lean, project-agnostic baseline sized to receive Phase 1's new lib. The live green CI run and the local `npm run <target>` no-op battery are proven in plan 00-04, not here.
- The ubuntu+windows `integration` matrix + `fail-fast: false` and `contents: read` least-privilege posture are ready for Phase 3 (cross-OS) and Phase 5 (CREEP controls) respectively.

## Self-Check: PASSED

- Files: `.github/workflows/mirror-cleanup.yml` confirmed absent; `.github/workflows/ci.yml` confirmed present and valid YAML.
- Commits: `1a2aebf` and `95b0e2d` both found in `git log`.
- Acceptance: all Task 2 grep criteria + YAML-parse job-list check passed.

---
*Phase: 00-teardown*
*Completed: 2026-07-18*
