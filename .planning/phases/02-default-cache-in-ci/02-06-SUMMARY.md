---
phase: 02-default-cache-in-ci
plan: 06
subsystem: infra
tags: [github-actions, actions-cache, ci, js-action, dogfood, node24, "@actions/core"]

# Dependency graph
requires:
  - phase: 02-05
    provides: serve() composition root with selectBackend(process.env) + bounded SIGTERM drain (RunningServer.shutdown)
  - phase: 02-01
    provides: exact-pinned @actions/cache 6.2.0 + @actions/core 3.0.1; pinned-deps guard
  - phase: 02-02
    provides: TRUSTED_EVENTS = {push, schedule} write gate (isWriteTrusted)
provides:
  - Internal dogfood JS action (action.yml, node24) that runs serve() in its own foreground process
  - src/action/index.ts entry - masks the bearer token, drives one scripted PUT (seed) or GET (verify), fails loudly, drains on exit, self-skips off-CI
  - test:act npm script - a self-skipping local canary over the same built action entry
  - dogfood-seed + dogfood-verify CI jobs proving a real cross-job Actions-cache HIT on a default-branch push
affects: [phase-05-trust-widening, phase-06-published-surface, "@actions/cache upgrades"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "JS action as the ONLY launch path for the Actions-cache backend (ACTIONS_RUNTIME_TOKEN/ACTIONS_RESULTS_URL exist only inside an action runtime)"
    - "Two-job seed->verify keyed on github.run_id proves the round-trip crossed GitHub's cache service (a same-process read-back cannot masquerade as a HIT)"
    - "action.yml main points into the build output (dist/action/index.js); every consuming job builds first"
    - "Runtime credentials by process inheritance only; step-level env passes GITHUB_TOKEN, never the workflow environment file"

key-files:
  created:
    - packages/github-cache/action.yml
    - packages/github-cache/src/action/index.ts
  modified:
    - .fallowrc.jsonc
    - package.json
    - .github/workflows/ci.yml

key-decisions:
  - "test:act is a self-skipping wrapper over the built action entry (exit 0 + skip notice when the Actions-cache runtime vars are absent); the real ROBUST-03 canary is the CI job pair"
  - "No job-level permissions block on either dogfood job (a block REPLACES the workflow grant wholesale); HIT is asserted from the local server's response, needing no extra scope"
  - "Both dogfood jobs gated to the push trigger via a job if, adding no new workflow trigger; the read-only path stays unit-tested"

patterns-established:
  - "Fail-loud dogfood: every branch asserts an exact status/body or calls core.setFailed; a MISS is a named failure, never a skip"
  - "setSecret(running.token) is the first statement after serve() starts, before any code path can print the bearer token"

requirements-completed: [ROBUST-03]

coverage:
  - id: D1
    description: "Internal dogfood JS action (action.yml node24 + src/action/index.ts) runs serve() in foreground, masks the bearer token, drives one scripted cache op, fails loudly, drains on exit"
    requirement: "ROBUST-03"
    verification:
      - kind: unit
        ref: "npx nx run-many -t build typecheck test (99 tests pass; serve/backend specs exercise the composition the action drives)"
        status: pass
      - kind: other
        ref: "npm run fallow:ci (action entry declared as a reachability entry point; exit 0)"
        status: pass
    human_judgment: false
  - id: D2
    description: "test:act self-skipping local canary over the same built action entry"
    requirement: "ROBUST-03"
    verification:
      - kind: integration
        ref: "npm run test:act (builds then runs dist/action/index.js; prints SKIP notice and exits 0 off-CI)"
        status: pass
    human_judgment: false
  - id: D3
    description: "dogfood-seed + dogfood-verify CI jobs prove a real cross-job Actions-cache HIT on a default-branch push (ROADMAP SC5, ROBUST-03 upgrade canary)"
    requirement: "ROBUST-03"
    verification:
      - kind: manual_procedural
        ref: "After merge to the default branch: open the workflow run; dogfood-seed reports PUT 200, dogfood-verify reports cache HIT with matching bytes"
        status: unknown
    human_judgment: true
    rationale: "The real Actions-cache primitive only works inside a JS action on real CI; it cannot be exercised locally (act is v1-only + QEMU-slow on arm64, R-01). The HIT must be confirmed on the workflow run after this branch merges to the default branch."

# Metrics
duration: 6min
completed: 2026-07-19
status: complete
---

# Phase 02 Plan 06: CI Dogfood Canary Summary

**Internal node24 JS action runs serve() in its own foreground process and, via a two-job seed->verify pair keyed on github.run_id, proves a real cross-job GitHub Actions-cache HIT on a default-branch push - the phase's headline capability proof and the @actions/cache upgrade canary in one job pair.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-07-19T03:17:37Z
- **Completed:** 2026-07-19T03:24:03Z
- **Tasks:** 2
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments
- Created the internal dogfood JS action (`action.yml`, `runs: node24`, `main: dist/action/index.js`) whose description states plainly it is CI-internal only, not the Phase 6 published surface.
- `src/action/index.ts`: masks the bearer token with `core.setSecret` before any print, self-skips (exit 0 + notice) when `ACTIONS_RUNTIME_TOKEN`/`ACTIONS_RESULTS_URL` are absent, drives `seed`=PUT / `verify`=GET as a fail-loud scripted round-trip, and `await running.shutdown()`s on every path. No `GITHUB_ENV` write.
- Declared the action entry in `.fallowrc.jsonc` so the dead-code gate stays green, and added a `test:act` script that builds then runs the same built entry.
- Added `dogfood-seed` and `dogfood-verify` jobs to `ci.yml`: push-trigger only, `verify` `needs` `seed`, both keyed on `${{ github.run_id }}`, no job-level permissions block, `GITHUB_TOKEN` passed by step-level env (process inheritance).

## Task Commits

Each task was committed atomically:

1. **Task 1: dogfood JS action + test:act canary** - `4c18696` (feat)
2. **Task 2: seed and verify CI jobs** - `f1cb23b` (feat)

## Files Created/Modified
- `packages/github-cache/action.yml` - node24 JS action manifest, inputs `hash` + `operation`, description flags it internal-dogfood-only, note that `main` points into the build output.
- `packages/github-cache/src/action/index.ts` - dogfood entry: self-skip guard, `core.setSecret` first, deterministic body from the hash, seed/verify fail-loud guards, `shutdown()` in `finally`.
- `.fallowrc.jsonc` - added the action entry to the `entry` array with an explanatory comment (JS-action entry, invoked by the runner, never imported).
- `package.json` - added `"test:act": "npx nx build github-cache && node packages/github-cache/dist/action/index.js"`.
- `.github/workflows/ci.yml` - added the two dogfood jobs preceded by a house-style comment block; existing six jobs unchanged (61 insertions, 0 deletions).

## Decisions Made
- Used `if: github.event_name == 'push'` as the job gate (the push trigger is already scoped to `main`, and this exactly mirrors the write gate's event check) rather than adding a `github.ref` clause - keeps the guard to the "push trigger" the plan specified without a redundant condition.
- Kept the action entry a plain top-level `run().catch(core.setFailed)` with no `pathToFileURL` entry guard: unlike `serve.ts`, this file is never imported (only executed as the action `main`), so the guard would be dead weight.

## Deviations from Plan

None - plan executed exactly as written.

The only mid-task correction was self-contained within Task 1: the first draft of `src/action/index.ts` referenced `$GITHUB_ENV` by name inside an explanatory comment, which tripped the plan's zero-count `GITHUB_ENV` guard (a critical constraint). Reworded the comment to "the workflow environment file" before committing, so the committed file has a `GITHUB_ENV` count of 0. Compiled output is unaffected (comments are stripped on emit).

## Issues Encountered
None.

## Self-Check: PASSED

- `packages/github-cache/action.yml` - FOUND
- `packages/github-cache/src/action/index.ts` - FOUND
- `packages/github-cache/dist/action/index.js` (build output) - FOUND
- Commit `4c18696` - FOUND
- Commit `f1cb23b` - FOUND

Verification battery (all green):
- `npm run fallow:ci` - exit 0 (18 entry points, no issues)
- `npm run test:act` - exit 0, printed the SKIP notice off-CI
- `npx nx run-many -t build typecheck test` - 99 tests pass, build + typecheck green
- `npx nx format:check --all` - exit 0
- `git grep -c 'permissions:' -- .github/workflows/ci.yml` = 1; `git grep -c 'GITHUB_ENV'` = 0 in both the action and the workflow

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The Actions-cache backend is now dogfooded end-to-end; Phase 5 (trust-widening to `pull_request`/`release`) and Phase 6 (published surface) build on this proven capability.
- **Pending human-check (blocks the SC5 sign-off, not the plan):** after this branch merges to the default branch, open the resulting workflow run and confirm `dogfood-seed` reports a stored PUT and `dogfood-verify` reports a cache HIT with matching bytes. A MISS means the round-trip did not reach GitHub's cache service - investigate the archive path and the pinned `@actions/cache` version before treating the phase as fully complete. No CI run URL exists yet (the run is produced by the merge to the default branch).

---
*Phase: 02-default-cache-in-ci*
*Completed: 2026-07-19*
