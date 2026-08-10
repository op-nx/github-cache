---
phase: 13-read-only-actions-cache-backend
plan: 06
subsystem: evidence
tags:
  [
    pre-registration,
    live-ci,
    cross-os-reuse,
    scope-honesty,
    unmet-prediction,
    assumption-log,
  ]

# Dependency graph
requires:
  - phase: 13-read-only-actions-cache-backend
    provides: '13-01 registered XOS-09 and TEST-11 and carried the Case-B live-CI item in ROADMAP, which this plan points at rather than restating'
  - phase: 13-read-only-actions-cache-backend
    provides: '13-04 landed the docs edits that rotate the `test` hash, which is half of why every producer MISSed'
  - phase: 13-read-only-actions-cache-backend
    provides: '13-05 installed the three read-only legs and their gate steps -- the instrument this plan reads'
provides:
  - '13-EVIDENCE.md: a pre-registration committed before the proving run and an observation appended after it, with the pre-registration byte-unchanged'
  - 'run 30744366870 as the behavioural proof of XOS-09 for Case A: gate counts 1 / 2 / 1, all three read-only Windows legs green, all three ubuntu producers reached'
  - 'the +2 job-log echo artifact, measured and converted, so a future reader counting the literal out of a job log does not read the gate number as wrong'
  - 'a stated observation condition for assumption A1, replacing the vague "confirm on the landing run"'
affects:
  [
    the phase verifier -- XOS-09 closes on this run id,
    the Case-B item in ROADMAP -- still open and still named,
  ]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'pre-registration as anti-repudiation: the proving run`s headSha IS the pre-registration commit, which is a stronger ordering claim than any timestamp comparison'
    - 'record the instrument conversion, not just the number: the gate reads `<target>-nx.log` and the job log reads +2, and a record giving only one of the two reads as a discrepancy against whichever a future reader measures'
    - 'an assumption that cannot be exercised is reported as unexercised, with the condition that WOULD exercise it, rather than reported closed on a clean log'
    - 'the floor`s blind spot is stated by the record that relies on the floor -- a 2-to-1 drop on the two-task leg clears it'
    - 'byte-level producer-to-consumer tie (sent == received per entry) so the same-run attribution does not rest on the label alone'

key-files:
  created:
    - .planning/phases/13-read-only-actions-cache-backend/13-EVIDENCE.md
  modified: []

key-decisions:
  - 'The pre-registration was committed as its own commit and the proving push carried it as HEAD, so the run`s headSha IS the prediction commit. That is the ordering evidence, not the commit clock'
  - 'The `Headline` table was written as forward references ("see the OBSERVATION section") so the observation needed no edit above the fold -- the whole file diffs as additions only, which is a stronger claim than "the pre-registration section is unchanged"'
  - 'The gating targets were re-run under `--skip-nx-cache`. A cached green is not an execution, and this repo has a documented `typecheck` stale-cache false PASS (LINT-04 exists because of it)'
  - 'A1 is recorded as OPEN, not closed. A run in which every pre-registered count is MET is precisely a run in which no task executes, so no PUT is attempted and no 403 exists to be noisy. Reporting a clean log as "A1 closed" would be inferring from an unexercised path'
  - 'The commit subject the plan dictated said "close assumption A1". It was amended to "A1 answered, not closed" rather than left to contradict its own body'
  - 'No `OBS` requirement was opened for the 403 path, per RESEARCH open question 3: observe first, build only if the log is actually confusing. There is still no evidence it is'

patterns-established:
  - 'When a pre-registered derived figure misses because the instrument changed under it in the same phase, record the miss AND publish the conversion, so both readings of the quantity stay legible'
  - 'A verdict line names what is proven, what is proven only locally, and what is open -- three states, not two'

requirements-completed: [XOS-09, TEST-11]

coverage:
  - id: D1
    description: 'The full local battery is green from the MAIN tree, with the gating targets executed rather than replayed'
    requirement: TEST-11
    verification:
      - kind: other
        ref: '`npx nx run-many -t test typecheck lint --skip-nx-cache` -> exit 0, `Cache: Skipped (--skip-nx-cache)`, 42 files / 975 tests'
        status: pass
      - kind: other
        ref: '`npm run check:action` -> exit 0 from the main tree (a junctioned worktree reports false drift)'
        status: pass
    human_judgment: false
  - id: D2
    description: 'The expected per-leg counts are pre-registered in a commit that PRECEDES the proving run'
    requirement: XOS-09
    verification:
      - kind: other
        ref: 'pre-registration commit `631a2e7`; proving run 30744366870 has `headSha` = `631a2e7`, so the prediction is in the tree the run measured'
        status: pass
      - kind: other
        ref: 'resolved task sets re-measured at this commit via `nx run-many -t <target> --graph` -> 1 / 2 / 1, agreeing with Phase 12`s measurement at 03b0143'
        status: pass
    human_judgment: false
  - id: D3
    description: 'The run is recorded with its id, its three per-leg counts and each ubuntu producer`s own line'
    requirement: XOS-09
    verification:
      - kind: other
        ref: 'gate steps printed `remote-cache label occurrences on windows-11-arm (build|typecheck|test): 1|2|1 -- GATED at a floor of 1`; all three legs `success`'
        status: pass
      - kind: other
        ref: 'ubuntu typecheck `Cache: 0/2 hit (0%)` with two `Sent ... of ...` saves; ubuntu test `Cache: 0/1 hit (0%)` with one save; ubuntu build `Cache hit for: nx-cache-6303782621882711279`, `1/1`'
        status: pass
      - kind: other
        ref: 'sent == received per entry: 137951 / 98227 / 1309, tying each Windows restore to its in-run ubuntu producer at the byte'
        status: pass
      - kind: other
        ref: '`Sent <n> of <n>` occurs 0 times on all three Windows legs -- no read-only leg saved anything'
        status: pass
    human_judgment: false
  - id: D4
    description: 'The evidence states the run is Case A and does not imply the base-scope read'
    requirement: XOS-09
    verification:
      - kind: other
        ref: 'Case A stated in the pre-registration AND restated in the observation; Case B points at ROADMAP Phase 13 Live-CI item 2 rather than restating its procedure'
        status: pass
      - kind: other
        ref: 'the non-.planning diff vs the prior run`s head `8a588d9` touches build, typecheck and test inputs, so all three hashes rotate -- the Case-A premise is measured, not asserted'
        status: pass
    human_judgment: false
  - id: D5
    description: 'Assumption A1 is answered by observation rather than deferred silently'
    requirement: TEST-11
    verification:
      - kind: other
        ref: '0 MISSes, 0 save attempts, 0 `##[warning]`/`##[error]` annotations and 0 genuine `403`/`forbidden` tokens across all three read-only legs -- so no PUT was attempted and A1 was not exercised'
        status: pass
      - kind: other
        ref: 'the observation condition is stated: a partial miss on the two-task `typecheck-windows` leg clears the floor, stays GREEN, and attempts exactly one 403'
        status: pass
    human_judgment: false
  - id: D6
    description: 'The pre-registration is never back-edited, including where it was wrong'
    requirement: XOS-09
    verification:
      - kind: other
        ref: '`git diff 631a2e7 HEAD -- 13-EVIDENCE.md` shows 0 deletion lines -- additions only'
        status: pass
      - kind: other
        ref: 'the unmet job-log prediction (2/3/2 predicted, 3/4/3 observed) is recorded as NOT met, with its cause and its conversion, per 09-EVIDENCE.md`s precedent'
        status: pass
    human_judgment: false

# Metrics
duration: 35min
completed: 2026-08-02
status: complete
---

# Phase 13 Plan 06: The Pre-Registered Counts, the Proving Run and 13-EVIDENCE.md Summary

**Run `30744366870` shows all three read-only Windows legs green at gate counts 1 / 2 / 1 against a
prediction committed as that run's own HEAD -- which proves cross-OS restore is LIVE and proves
nothing whatever about the base-scope read.**

## Performance

- **Duration:** ~35 min of work (wall clock spans a pause between Task 1's commit and the proving
  push, plus the 4m21s run itself)
- **Tasks:** 2
- **Files modified:** 1 created

## Accomplishments

- **The prediction is in the tree the run measured.** The pre-registration was committed alone as
  `631a2e7` and the proving push carried it as HEAD, so the run's `headSha` IS the prediction
  commit. That is a stronger anti-repudiation claim than the Phase 12 precedent's timestamp
  comparison, and it needs no clock to be trusted.
- **All three gates met their pre-registered numbers exactly**, each leg's own printed line quoted:
  `build-windows` 1, `typecheck-windows` 2, `test-windows` 1. The floor of 1 -- not those three
  numbers -- was named as the gate before the run, because the counts follow Nx's task graph (D-05).
- **Liveness and correctness stayed two arguments.** Each ubuntu producer's own line is recorded:
  `typecheck` MISSed and saved BOTH `build` and `typecheck` (`0/2`), `test` MISSed and saved
  (`0/1`), and `build` HIT the entry the `typecheck` job had already written (`1/1`). That last one
  is the race the pre-registration named in advance, resolving the same way Phase 11 measured it on
  run `30471772954` -- recorded as the anticipated outcome, not as a deviation.
- **The producer-to-consumer tie is at the byte, not at the label.** Sent equals received per entry:
  137951, 98227 and 1309. And `Sent <n> of <n>` occurs zero times on all three Windows legs, so the
  read-only claim is corroborated by absence as well as by the knob's appearance in the sidecar
  step's inherited env.
- **A prediction that did not hold is recorded as not holding.** The pre-registration derived the
  job-log raw counts as 2 / 3 / 2 from the OLD Record step; the observed values are 3 / 4 / 3. The
  new gate step's body carries the literal twice -- once in the `grep` needle and once inside the
  `::error::` text -- so the runner's command echo contributes +2 per leg, not +1. The GATE numbers
  were met exactly; only the derived figure was wrong, and it was wrong because this phase's own
  commit changed the instrument. The record publishes the conversion rather than quietly dropping
  the miss.
- **The scope limit is stated twice and pointed at once.** Case A is in both the pre-registration
  and the observation; Case B's procedure lives in ROADMAP's Phase 13 Live-CI item 2 and is
  referenced, never restated, so there is exactly one copy of it.
- **The battery was executed, not replayed.** `test`, `typecheck` and `lint` were re-run under
  `--skip-nx-cache` (`Cache: Skipped`), because this repo has a documented `typecheck` stale-cache
  false PASS -- LINT-04 exists because of it -- and a cached green is not evidence of an execution.
  `npm run check:action` exits 0 from the MAIN tree.

## Task Commits

Each task was committed atomically:

1. **Task 1: the local battery and the pre-registration** -- `631a2e7` (docs)
2. **Task 2: the proving run and the A1 observation** -- `440b824` (docs)

## Files Created/Modified

- `.planning/phases/13-read-only-actions-cache-backend/13-EVIDENCE.md` - created. A
  PRE-REGISTRATION section (the claim, the derived per-leg counts, the counting artifact, the
  producer expectations, the failure-hypothesis counts, the Case-A scope statement, the two
  over-reads to avoid) committed before the run existed, and an OBSERVATION section appended after
  it. The file diffs as additions only.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The dictated commit subject asserted a closure the body denies**

- **Found during:** Task 2
- **Issue:** The plan fixes Task 2's commit subject as
  `docs(13-06): record the Phase 13 proving run and close assumption A1`. The observation is that
  A1 could not be closed -- the run exercised no PUT at all. A subject claiming a closure its own
  body retracts is exactly the defect this phase's evidence discipline exists to prevent.
- **Fix:** Amended the tip commit to
  `docs(13-06): record the Phase 13 proving run; A1 answered, not closed (XOS-09, TEST-11)`. The
  requirement trailer and the body are unchanged.
- **Files modified:** none (commit metadata)
- **Commit:** `440b824`

**2. [Rule 2 - Missing] A1 had only two admitted outcomes; reality supplied a third**

- **Found during:** Task 2
- **Issue:** The plan's Task 2 allows A1 to be answered "quiet, so close it" or "noisy, so record a
  docs follow-up". Neither applies: every task on every read-only leg HIT, so nothing executed,
  nothing PUT, and no 403 was ever produced. Reporting the clean log as "A1 closed" would be
  inferring a property of a path the run never took -- and that inference is the same shape as
  reading a MISS as evidence, which this project's whole evidence discipline forbids.
- **Fix:** Recorded A1 as OPEN with the reason it is structurally unobservable on a fully-restoring
  run, plus the condition that WOULD exercise it: a partial miss on `typecheck-windows`, which
  resolves two tasks, clears the floor at a count of 1, stays GREEN, and attempts exactly one PUT.
  No `OBS` requirement opened, per RESEARCH open question 3.
- **Files modified:**
  `.planning/phases/13-read-only-actions-cache-backend/13-EVIDENCE.md`
- **Commit:** `440b824`

**3. [Rule 2 - Missing] The counting instrument had drifted, and the drift was measured before the run rather than discovered after it**

- **Found during:** Task 1
- **Issue:** Phase 12 recorded 1 / 2 / 1 by counting the literal out of each job log. Counting the
  same way today returns a higher number, because the count step's own shell body -- which contains
  the `grep` needle -- is echoed into the job log by the runner. A pre-registration reusing Phase
  12's numbers without saying which instrument produced them would have manufactured a false
  mismatch.
- **Fix:** Measured the artifact against the most recent prior run `30721656181` and pre-registered
  BOTH figures: the gate-printed count (1 / 2 / 1) and the job-log raw count. The raw prediction
  then missed by one more per leg -- see Accomplishments -- and the conversion is published in the
  observation.
- **Files modified:**
  `.planning/phases/13-read-only-actions-cache-backend/13-EVIDENCE.md`
- **Commit:** `631a2e7`, corrected in `440b824`

### Verified and Deliberately Left Alone

- **The `Headline` table's forward references.** Written as "see the OBSERVATION section" so the
  observation required no edit above the fold. The whole file therefore diffs as additions only,
  which is a stronger property than "the pre-registration section is unchanged".
- **The gate's floor.** Not tightened to an exact pin despite all three legs hitting their exact
  predicted numbers. D-05 locked the floor because the counts follow Nx's task graph; one green run
  is not a reason to re-open that.

## Flagged for Review, Not Changed

- **`packages/github-cache/src/dogfood-cross-os.spec.ts:349-352`** -- carried forward from
  `13-05-SUMMARY.md` unchanged. The referent of "its" in the OBS-04 sentence is ambiguous; one
  reading makes the sentence stale now that three legs are gated, the other leaves it true. Outside
  this plan's scope, and an edit under the wrong reading would delete a true claim.

## What This Evidence Still Does Not Cover

Recorded here as well as in the evidence file, because over-reading a green is the mistake CR-18
caught once already.

- **The base/default-branch scope read (Case B).** Not observable from this commit by construction:
  the landing diff touches declared `build`, `typecheck` and `test` inputs, so all three hashes
  rotate and every leg takes the intra-run merge-ref path. Carried as ROADMAP Phase 13 Live-CI item
  2, with its Assumption-A2 verification step.
- **The gate reddening on a genuine cross-OS restore failure.** Only observable on a real
  `windows-11-arm` runner after a ubuntu leg has saved. The three local mutations recorded in
  `13-05-SUMMARY.md` prove the CLAUSES are non-vacuous; they do not prove the live gate reddens.
  Two claims, and only the first is made.
- **A partial cross-OS regression.** The gate is a floor of 1 per leg and `typecheck-windows`
  resolves two tasks, so a drop from 2 to 1 clears the floor and the leg stays green. The
  per-target counts recorded in the evidence are what would make such a drop legible.
- **Portability.** A restored task does not execute. The scheduled `windows-regression-detector`
  workflow covers that, not this gate.

## Self-Check: PASSED

- File verified present:
  `.planning/phases/13-read-only-actions-cache-backend/13-EVIDENCE.md`,
  `.planning/phases/13-read-only-actions-cache-backend/13-06-SUMMARY.md`.
- Commits verified in history: `631a2e7`, `440b824`.
- `npx nx run-many -t test typecheck lint --skip-nx-cache` exits 0 (42 files, 975 tests,
  `Cache: Skipped`); `npm run check:action` exits 0 from the main tree.
- `git diff 631a2e7 HEAD -- 13-EVIDENCE.md` reports 0 deletion lines.
- Run `30744366870` verified `attempt: 1`, `event: pull_request`, `headSha: 631a2e7`,
  `conclusion: success`; `action-bundle-drift` green on the same run.
- Every line in both new files is ASCII.
