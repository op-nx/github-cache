---
phase: 12-windows-ci-reuse-o4-consumer-recipe
plan: 03
subsystem: ci
tags: [github-actions, scheduled-workflow, nx-cache-bypass, windows-arm64, regression-detector]

# Dependency graph
requires:
  - phase: 12-windows-ci-reuse-o4-consumer-recipe
    provides: "12-01's windows-regression-detector.spec.ts -- the eight-clause shape contract this plan turns GREEN, plus the nx.json test-input registration that makes it non-stale"
  - phase: 12-windows-ci-reuse-o4-consumer-recipe
    provides: "12-02's three windows-11-arm ci.yml legs -- the reuse this detector exists to keep honest"
  - phase: 04-releases-cache-mirror
    provides: "cleanup.yml -- the scheduled-workflow skeleton, its off-the-hour cron reason, and the four-step prelude"
provides:
  - ".github/workflows/windows-regression-detector.yml -- the only path in the repository that EXECUTES build, typecheck and test on a Windows runner once XOS-04 lands"
  - "A MEASURED green for `nx run-many -t build typecheck test --skip-nx-cache` on Windows arm64"
  - "A MEASURED non-vacuity proof for the plural three-target success needle: a two-target run exits 0 while failing it"
affects: [12-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Demand-the-success-LINE as a second signal after the exit code, with the needle naming every target in -t argument order"
    - "Prove the COMMAND rather than the job when a new workflow file cannot be dispatched pre-merge"

key-files:
  created:
    - .github/workflows/windows-regression-detector.yml
  modified:
    - .planning/STATE.md
    - .planning/ROADMAP.md

key-decisions:
  - "12-03: ONE nx run-many invocation gated on the PLURAL three-target success line, rather than three single-target steps. Nx filters the printed target list down to targets that actually resolved a task (formatting-utils.js:37), so the singular prefix is vacuous for a three-target run -- MEASURED here, not assumed. One invocation shares one graph load on the slowest runner in the fleet, and Nx already names the failing target itself. The accepted cost is that the needle pins the -t ARGUMENT ORDER, recorded in a comment beside it with the repair instruction (update the needle and its spec clause in the same commit, never shorten the needle)."
  - "12-03: cron '23 4 * * *' -- daily, off the top of the hour for cleanup.yml's own recorded reason (GitHub delays scheduled runs under top-of-hour load and this check has no deadline), with BOTH fields distinct from cleanup.yml's '17 3 * * *' so the two scheduled workflows do not contend."
  - "12-03: workflow_dispatch is present but its comment states its REAL justification -- on-demand re-run AFTER merge -- and explicitly disclaims the pre-merge-proof claim. GitHub only dispatches a workflow whose file exists on the DEFAULT branch, so a brand-new file on a feature branch does not appear in the UI and the API rejects it."
  - "12-03: the pre-merge risk is closed by proving the COMMAND on this Windows arm64 workstation (RESEARCH Correction 2 path 2), not by any new mechanism. Green-on-a-real-runner stays a POST-MERGE first-run close, the pattern this repo already uses by name for ppe, dogfood-* and consumer-smoke."
  - "12-03: least privilege and no unrequested mechanism -- contents: read only (no write scope, no actions scope), no concurrency group (nothing is deleted or written, so overlapping runs are harmless), no sidecar and no remote-cache client variable (--skip-nx-cache bypasses remote read AND write at Nx 23.1.0, so a cache server would be dead weight and an extra producer)."

patterns-established:
  - "Two-sided needle proof: a positive control that the needle matches the real green line, plus an OBSERVED red where the guarded command exits 0 and the needle still fails"

requirements-completed: []

coverage:
  - id: D1
    description: "The detector workflow exists and satisfies every clause of the 12-01 shape guard -- triggers, off-the-hour cron, one windows-11-arm job, --skip-nx-cache, NO_COLOR plus the plural success needle, no sidecar, no remote tier, no write permission"
    requirement: XOS-05
    verification:
      - kind: unit
        ref: "packages/github-cache/src/windows-regression-detector.spec.ts#windows-regression-detector.yml workflow config -- the XOS-05 detector"
        status: pass
    human_judgment: false
  - id: D2
    description: "The three-target cache-bypassing command is MEASURED green on Windows arm64, and the plural needle is MEASURED non-vacuous by a two-target run that exits 0 while failing it"
    requirement: XOS-05
    verification:
      - kind: manual
        ref: "## Measurement A and ## Measurement B below -- both transcribed verbatim from real runs on this workstation"
        status: pass
    human_judgment: false
  - id: D3
    description: "The detector goes green on a real windows-11-arm runner"
    requirement: XOS-05
    verification:
      - kind: manual
        ref: "POST-MERGE first-run close -- structurally impossible pre-merge (GitHub dispatches only default-branch workflow files). Carried to plan 12-06."
        status: pending
    human_judgment: true
    rationale: "RESEARCH Correction 2. Not closeable by this plan and deliberately not claimed."

# Metrics
duration: 22min
completed: 2026-07-30
status: complete
---

# Phase 12 Plan 03: The Scheduled Windows Regression Detector Summary

**A daily `--skip-nx-cache` `windows-11-arm` workflow that is the only path in the repository which
EXECUTES `build`, `typecheck` and `test` on Windows once XOS-04 lands -- gated not on an exit code
but on a plural three-target success line that a two-of-three run was MEASURED to fail while still
exiting 0.**

## Performance

- **Duration:** ~22 min
- **Tasks:** 2 of 2
- **Files modified:** 1 created (plus 2 planning files)

## Accomplishments

- `.github/workflows/windows-regression-detector.yml`: one `detect` job on `windows-11-arm`,
  `schedule` at `'23 4 * * *'` plus `workflow_dispatch`, `permissions: contents: read`,
  `timeout-minutes: 20`, `shell: bash`, `NO_COLOR: '1'`, and the demand-the-success-LINE step.
- All six previously-failing detector assertions are GREEN. The suite is back to **0 failures**.
- The three-target command is MEASURED green on this Windows arm64 workstation.
- The plural needle is MEASURED non-vacuous: a two-target run exits 0, fails the plural needle, and
  PASSES the naive short needle -- the positive demonstration that the obvious one is vacuous.

## Task Commits

1. **Task 1: the scheduled windows-11-arm regression detector workflow** - `83333a3` (feat)
2. **Task 2: prove the COMMAND on Windows arm64, and OBSERVE the needle's red** - no file changes;
   the measurements below ARE the deliverable and land in this SUMMARY's `docs(12-03)` commit
   (the plan's `<success_criteria>` allows `docs(12-03)` "if no file changes" -- an empty commit
   would carry nothing the SUMMARY does not).

## The chosen cron

`'23 4 * * *'` -- daily, minute 23 (off the top of the hour), hour 4. `cleanup.yml` is `'17 3 * * *'`,
so both fields differ and the two scheduled workflows do not contend.

```
.github/workflows/cleanup.yml:cron: '17 3 * * *'
.github/workflows/windows-regression-detector.yml:cron: '23 4 * * *'
```

## Measurement A -- the positive control

Run on this Windows arm64 workstation (`win32/arm64`), Nx local **v23.1.0**, Node **v24.13.0**,
against the workspace's existing installed `node_modules`.

```
CI=true NO_COLOR=1 npm exec -- nx run-many -t build typecheck test --skip-nx-cache
```

**Exit code: 0.**

All three targets resolved and executed. Head of the run, verbatim:

```

 NX   Running targets build, typecheck, test for project @op-nx/github-cache:

- @op-nx/github-cache



> nx run @op-nx/github-cache:build

> tsc --build tsconfig.lib.json


> nx run @op-nx/github-cache:typecheck

> tsc --build tsconfig.json --emitDeclarationOnly


> nx run @op-nx/github-cache:test

> vitest
```

Per-target result and wall time, verbatim from the tail:

```
 Test Files  41 passed (41)
      Tests  886 passed (886)
   Start at  18:18:10
   Duration  3.01s (transform 1.23s, setup 0ms, import 3.56s, tests 6.59s, environment 3ms)




 NX   Successfully ran targets build, typecheck, test for project @op-nx/github-cache


  Run duration:      3.5s
  Cache:             Skipped (--skip-nx-cache)
  Critical path:     3.5s (1 task)
  Recoverable time:  <1ms
```

**The FULL final success line, verbatim:**

```
 NX   Successfully ran targets build, typecheck, test for project @op-nx/github-cache
```

The workflow's needle -- `Successfully ran targets build, typecheck, test for project` -- is a
literal substring of that line, character for character. Nothing was adjusted to fit a prediction;
the needle written in Task 1 matched the observation on the first run.

**The `Cache:` line is NON-DISCRIMINATING in both directions, and is recorded only because the plan
asks for it.** `Skipped (--skip-nx-cache)` is what this flag always prints, whether or not a remote
tier exists -- an environment with no remote-cache client variable at all prints the same thing. And
in the other direction, a non-zero hit count on an unflagged run would include LOCAL hits, so it is
not evidence about the remote tier either. The discriminating signal here is the success LINE, not
the cache line.

The plan's `<automated>` verification, run as the literal pipeline:

```
CI=true NO_COLOR=1 npm exec -- nx run-many -t build typecheck test --skip-nx-cache 2>&1 \
  | rg -q -F "Successfully ran targets build, typecheck, test for project"
-> exit 0
```

**The `69bd1b7` `test` flake did NOT surface.** `test` executed with the cache bypassed on Windows
arm64 and reported `886 passed (886)` across `41 passed (41)` files, exit 0. Nothing was appended to
`.planning/phases/08-nx-task-hash-parity/deferred-items.md` because there was no observation to
attribute. This is a second independent green for that target on this box (RESEARCH F-5 recorded
`856 passed (856)` on 2026-07-30; the suite has since grown by the 12-01 and 12-02 guards).

## Measurement B -- the OBSERVED RED that proves the needle is not vacuous

The mutation is the one PATTERNS M-2 names: **drop one target from the `-t` list**, not from the
workflow.

```
CI=true NO_COLOR=1 npm exec -- nx run-many -t build test --skip-nx-cache
```

**`nx` exit code: 0.** The tail, verbatim:

```

 NX   Successfully ran targets build, test for project @op-nx/github-cache


  Run duration:      3.4s
  Cache:             Skipped (--skip-nx-cache)
  Critical path:     3.4s (1 task)
  Recoverable time:  <1ms
```

**The two-target success line, verbatim:**

```
 NX   Successfully ran targets build, test for project @op-nx/github-cache
```

Three facts, each from a real command, and together they are the red observation:

| Check | Command | Exit | Meaning |
|---|---|---|---|
| the run itself | `nx run-many -t build test --skip-nx-cache` | **0** | the exit code is NOT the gate -- a two-of-three run is indistinguishable from a good one by exit status alone |
| the PLURAL needle (the workflow's gate) | `rg -q -F "Successfully ran targets build, typecheck, test for project"` | **1** | ABSENT. The workflow's `grep -q` would fail, `set -euo pipefail` would propagate it, and the step goes RED |
| the naive SHORT needle | `rg -q -F "Successfully ran target"` | **0** | PRESENT. A guard using the obvious needle would have PASSED this run -- the vacuity M-2 predicted, now measured |

The plan's `<acceptance_criteria>` pipeline, run literally:

```
CI=true NO_COLOR=1 npm exec -- nx run-many -t build test --skip-nx-cache 2>&1 \
  | rg -q -F "Successfully ran targets build, typecheck, test for project"
-> exit 1   (non-zero, as required)
```

Note the shape of the printed line: Nx wrote `targets build, test` -- it FILTERED `typecheck` out of
the printed list rather than naming it as missing. That is `formatting-utils.js:37` behaving exactly
as source-traced, and it is precisely why a needle that only checks the prefix cannot detect a target
that silently stopped resolving.

## Verification

| Check | Result |
|---|---|
| `npx nx run @op-nx/github-cache:test --skip-nx-cache -- -t "detector"` | `9 passed \| 877 skipped (886)`, exit 0 |
| Full suite (`test`, via Measurement A) | `Test Files 41 passed (41)` / `Tests 886 passed (886)` -- **0 failures** |
| `npx nx format:check --all` | exit 0, no output |
| `npm run lint` | exit 0 |
| `npm run check:action` (ROBUST-04, run from the MAIN working tree) | exit 0 -- `git diff --exit-code -- start-cache-server/index.js` clean, no bundle drift |
| `git status --porcelain` | no `detector.log`, no stray artifact |

**Arithmetic on the suite:** the wave gate opened at `6 failed | 880 passed (886)`; all six were the
detector clauses. This plan closes exactly those six: `886 passed (886)`. **No pre-existing test
changed state** -- the delta is 6 fail-to-pass and nothing else.

Task 1 acceptance criteria, measured:

```
rg -c '^  detect:$'                            -> 1
rg -c '^    runs-on: windows-11-arm$'          -> 1   (and only ONE runs-on line in the file)
rg -c '^    timeout-minutes: 20$'              -> 1
rg -c '^        shell: bash$'                  -> 1
rg -o -F -- '--skip-nx-cache' | wc -l          -> 3   (>= 1; two in comments, one executable)
rg -o -F '<the plural needle>' | wc -l         -> 1
rg -c "cron: '[1-9]"                           -> 1   (minute field is not 0)
rg -c 'contents: read'                         -> 1
rg -c -F 'concurrency:'                        -> exit 1 (absent)
rg -c '[^\x00-\x7F]'                           -> exit 1 (pure ASCII)
```

## Files Created/Modified

- `.github/workflows/windows-regression-detector.yml` (created, 113 lines) - `name`, a four-paragraph
  header recording why it is a separate scheduled file, XOS-05's identical-observation sentence, and
  the hard-fail rationale; `schedule` + `workflow_dispatch`; `permissions: contents: read`; one
  `detect` job on `windows-11-arm` with `timeout-minutes: 20`, the four-step prelude, and the single
  scripted `shell: bash` step.
- `.planning/STATE.md` (modified) - position advanced to plan 4/6, two decisions, metric, session.
- `.planning/ROADMAP.md` (modified) - `12-03-PLAN.md` checked off, progress row `3/6`.

## Decisions Made

Recorded in the frontmatter `key-decisions`. The two that matter downstream:

1. The gate is the PLURAL three-target success line, and the accepted cost (it pins `-t` argument
   order) is written beside it together with the repair instruction. Plan 12-06 must not "simplify"
   the needle.
2. The pre-merge close is a COMMAND proof, never a job proof. `workflow_dispatch` is in the file for
   post-merge re-runs only, and its comment says so, so no later reader can cite it as evidence the
   detector was verified before merge.

## Deviations from Plan

### 1. [Rule 1 - Measurement correction] The "exactly ONE job" acceptance criterion cannot be satisfied as literally written

- **Found during:** Task 1, verifying acceptance criteria.
- **Issue:** The criterion is `rg -c "^  [a-z]" <file>` equals 1. That pattern counts every line at
  exactly two-space indent starting with a lowercase letter -- which in any workflow with an `on:`
  block and a `permissions:` block also matches `  schedule:`, `  workflow_dispatch:` and
  `  contents: read`. Measured: **4**. Reaching 1 would require either dropping those blocks (the
  spec REQUIRES `schedule`, `workflow_dispatch` and a permissions block) or indenting them past two
  spaces (which `npx nx format:check --all` -- prettier -- normalises straight back). The criterion's
  INTENT is satisfied and was verified two other ways: exactly one job key under `jobs:`
  (`rg -c '^  detect:$'` = 1, and no other two-space key appears below `jobs:`), and exactly one
  `runs-on` line in the whole file (`rg -c '^    runs-on: '` = 1), which is also the 12-01 spec's own
  clause (`expect(runsOnLines).toHaveLength(1)`) and it passes.
- **Fix:** None in code. Recorded so a later reader does not chase a 4 that reads like a failure.
- **Files modified:** none
- **Committed in:** n/a (measurement note only)

### 2. [Rule 3 - Blocking] `CI=true` needed locally for both measurements

- **Found during:** Task 2.
- **Issue:** `nx.json` configures `@nx/vitest` with `testMode: "watch"`, so the inferred `test`
  target never terminates on a workstation. The workflow does not need this -- GitHub sets `CI` on
  every runner.
- **Fix:** Every measurement was invoked as `CI=true NO_COLOR=1 npm exec -- nx run-many ...`. `CI` is
  NOT a `test` input (the explicit `targetDefaults.test.inputs` list REPLACES the inferred list,
  dropping `@nx/vitest`'s `{ env: 'CI' }`), so this does not perturb the task hash and the command is
  otherwise character-identical to the workflow's. Same finding as 12-01 deviation 3.
- **Files modified:** none
- **Committed in:** n/a (invocation only)

### 3. [Rule 2 - Environment note] A `FORCE_COLOR` warning appears inside the vitest workers, and does NOT defeat `NO_COLOR`

- **Found during:** Measurement A.
- **Issue:** The captured run printed
  `Warning: The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set.` several times.
  That reads like the load-bearing `NO_COLOR` being overridden, which would make the workflow's
  plain-text match fail on every run.
- **Fix:** None needed -- CHECKED rather than assumed. `FORCE_COLOR` is undefined in the shell
  (`node -e` confirms `FORCE_COLOR=undefined`); it is set by npm inside the script subprocesses, and
  the warning is Node's own `util` styling notice, not picocolors'. The captured output contains
  **zero** ANSI escape sequences (`rg -c $'\x1b\['` -> exit 1, genuine no-match), and the literal
  needle matched. Recorded because a future reader of a runner log will see the same warning.
- **Files modified:** none
- **Committed in:** n/a (measurement note only)

### 4. [Rule 1 - Bug] `roadmap.update-plan-progress` again injected a duplicate bare plan list and mangled the table cell

- **Found during:** the state-update step. Carried forward from 12-01 deviation 5 and 12-02.
- **Issue:** The handler inserted a second, bare six-entry plan list above the existing
  backtick-quoted descriptive one (twelve entries for six plans), and wrote the progress row as
  `| 2/6 | In Progress|  |` -- a malformed separator and an empty date cell.
- **Fix:** Deleted the injected list, checked off `12-03-PLAN.md` in the descriptive list, and
  normalised the row to `| 3/6 | In Progress | - |`. Verified: `rg -c "12-0[1-6]-PLAN.md"` returns
  exactly **6**, with 12-01/12-02/12-03 as `[x]`; the final `git diff` on ROADMAP.md is two hunks.
- **Files modified:** `.planning/ROADMAP.md`

### 5. [Rule 1 - Bug] `state.add-decision` injected an em dash and a `[Phase ?]` marker

- **Found during:** the state-update step. Carried forward from 12-02.
- **Issue:** The handler requires `--summary` / `--rationale` named flags (a single positional string
  errors with `summary required`) and then joins them with a U+2014 em dash, landing non-ASCII in
  `STATE.md`. It also wrote `[Phase ?]` instead of `[Phase 12]`.
- **Fix:** Replaced both em dashes with ` -- ` and both `[Phase ?]` with `[Phase 12]`, matching the
  12-02 entries directly above. Verified: `rg -c '[^\x00-\x7F]' .planning/STATE.md` returns **13**,
  the pre-existing count, so this plan added no non-ASCII line.
- **Files modified:** `.planning/STATE.md`

### 6. [Rule 1 - Bug] `state.record-metric` rejects the positional form the executor spec prescribes

- **Found during:** the state-update step.
- **Issue:** The executor contract calls
  `state.record-metric "$PHASE" "$PLAN" "$DURATION" "$TASK_COUNT" "$FILE_COUNT"` positionally. The
  handler needs named flags; the positional call would have silently recorded nothing.
- **Fix:** Invoked as
  `state.record-metric --phase 12 --plan 03 --duration 22min --tasks 2 --files 1`, which returned
  `{"recorded": true, ...}`.
- **Files modified:** `.planning/STATE.md`

### 7. [Deliberate skip, carried from 12-01/12-02] `requirements.mark-complete` NOT called

- **Reason:** On 12-01 that handler falsely flipped XOS-04/05/08 to `[x]`. XOS-05 in particular is
  NOT closeable here -- it needs the live-CI proof plan 12-06 gathers, and this plan's own
  `<verification>` block says so in as many words. Requirement traceability for this phase closes
  ONCE, by the orchestrator's `phase.complete` step, after the verifier runs. This plan's frontmatter
  therefore carries `requirements-completed: []`.
- **Verification:** `git diff --stat 0251bd3 -- .planning/REQUIREMENTS.md` returns nothing -- the file
  is byte-identical to the phase-planning commit.

---

**Total deviations:** 7 (2 measurement notes, 1 invocation note, 3 GSD state-tooling defects
repaired, 1 deliberate skip). **No clause of the 12-01 spec was weakened, softened or deleted**, and
no placeholder workflow was stubbed -- the file the spec asserts on is the real detector.

## Threat Flags

None. Re-checked against the plan's own register rather than asserted:

- **T-12-04** (`$GITHUB_ENV` writes, critical **if present**): the detector writes NOTHING to
  `$GITHUB_ENV`. `rg -c -F 'GITHUB_ENV' <file>` returns exit 1 (absent). `NO_COLOR` is a step-level
  `env:` literal, a different mechanism, and it is not derived from downloaded or checked-out
  content. The T-11-27 shape is structurally absent.
- **T-12-07** (new triggers): both `schedule` and `workflow_dispatch` are collaborator-only.
  Workflow-level `permissions: contents: read`, no `actions:` scope, no concurrency mechanism.
- **T-12-13** (a detector that passes on a partial run): mitigated AND now MEASURED -- see
  Measurement B.
- **T-12-14** (extra cache producer): no sidecar, no remote-cache client variable, and
  `--skip-nx-cache` skips read and write. Zero entries added to the Actions-cache budget, zero assets
  to the Releases mirror.
- **T-12-SC** (package installs): VERIFIED, not asserted -- no `package.json` and no
  `package-lock.json` was touched, and no package was installed. The workflow's `npm ci` installs the
  existing pinned lockfile and adds no specifier.

## Known Stubs

None. The workflow is fully wired: every directive it declares is executable, and its only
non-executable content is the rationale comments the spec's comment-stripping read deliberately
ignores.

## Issues Encountered

None blocking. The three GSD state-handler defects (deviations 4-6) are the same ones 12-01 and 12-02
hit; all three were caught and repaired before the commit, and all three will hit 12-04 through 12-06.

## User Setup Required

None - no external service configuration required.

## Human Verification Required

- **The detector goes green on a real `windows-11-arm` runner.** Structurally impossible to close
  pre-merge: GitHub only dispatches a workflow whose file exists on the DEFAULT branch, so this file
  cannot be dispatched from the phase branch at all -- it does not appear in the UI and the API
  rejects it. This is a POST-MERGE first-run close, the pattern this repo already uses by name for
  `ppe`, `dogfood-*` and `consumer-smoke`. The substantive half of the risk ("do these three targets
  pass on Windows with the cache bypassed?") IS closed, by Measurement A.
- **That the runner label resolves and the YAML parses on GitHub's side.** Structurally guarded by
  the 12-01 spec; the parse itself is post-merge.

Both are XOS-05 items and both belong to plan 12-06. Neither is claimed here.

## Next Phase Readiness

- **Plan 12-06** inherits a merged-and-ready detector plus a recorded first-run checklist: dispatch
  the workflow once the file is on the default branch, and record the run id together with the
  success line it printed.
- **Nothing is red that should be green.** The wave's full suite is `886 passed (886)`,
  `format:check` and `lint` are clean, and `check:action` reports no bundle drift.
- **The needle is now defended by a measurement, not an argument.** If a later plan wants to reorder
  `-t` or shorten the needle, Measurement B is the record of what that costs.

## Self-Check: PASSED

- `.github/workflows/windows-regression-detector.yml` - FOUND
- `.planning/phases/12-windows-ci-reuse-o4-consumer-recipe/12-03-SUMMARY.md` - FOUND
- commit `83333a3` - FOUND

---
*Phase: 12-windows-ci-reuse-o4-consumer-recipe*
*Completed: 2026-07-30*
