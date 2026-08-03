---
phase: 260803-mew
plan: 01
subsystem: ci-observability
tags: [github-actions, workflow-dispatch, windows-11-arm, nx-run-many, evidence]
requires:
  - the Phase 12 Windows regression detector at HEAD (four-target needle)
  - operator authorisation for a scoped temporary `main` window
provides:
  - first real-runner observation of the four-target needle in BOTH directions
  - A1 (workflow body provenance on workflow_dispatch) closed by measurement
  - A3 (`lint` on `windows-11-arm`) closed by measurement
  - forward pointers on six claims that read as closed on the superseded needle
affects:
  - .planning/phases/12-windows-ci-reuse-o4-consumer-recipe/12-UAT.md
  - .planning/phases/12-windows-ci-reuse-o4-consumer-recipe/12-VALIDATION.md
  - .planning/phases/12-windows-ci-reuse-o4-consumer-recipe/12-VERIFICATION.md
  - .planning/REQUIREMENTS.md
  - .planning/STATE.md
tech-stack:
  added: []
  patterns:
    - step-NAME mutation as a self-authenticating workflow-body provenance discriminator
    - git plumbing commits via a GIT_INDEX_FILE outside the repo (working tree never touched)
    - needle attribution by log-line KIND (genuine Nx output vs echoed shell command)
key-files:
  created:
    - .planning/quick/260803-mew-observe-phase-12-fail-half-on-real-run/260803-mew-EVIDENCE.md
  modified:
    - .planning/phases/12-windows-ci-reuse-o4-consumer-recipe/12-UAT.md
    - .planning/phases/12-windows-ci-reuse-o4-consumer-recipe/12-VALIDATION.md
    - .planning/phases/12-windows-ci-reuse-o4-consumer-recipe/12-VERIFICATION.md
    - .planning/REQUIREMENTS.md
    - .planning/STATE.md
decisions:
  - "A1 was closed by making the run answer it, not by pre-flight research: the same throwaway mutation that produces the RED also carries a step-name suffix that proves which tree supplied the workflow body."
  - "`test` was dropped from the -t list rather than `lint`, because nx.json declares the workflow file as a `test` input and the spec pins the four-target line -- keeping `test` would have reddened `nx` and voided the proof."
  - "Both original claims were preserved and the replacement fact appended, never substituted (12-PATTERNS.md S-1)."
  - "The five stale refs/backups/* strays were left alone as out of scope; this window's own backup ref was deleted."
metrics:
  green_run: 30825110047
  red_run: 30825602626
  plumbing_sha: c53a096911477a901f77db1e723f552a8af0b0f0
  main_exposure_window: ~6 minutes
  runner_cost: $0.00 (public repo, standard GitHub-hosted runner)
  tasks_completed: 3
  files_changed: 6
  completed: 2026-08-03
status: complete
---

# Quick Task 260803-mew: Observe Phase 12 fail half on real run Summary

Both directions of the Phase 12 Windows regression detector's four-target needle are now observed on
real `windows-11-arm` runners, and the load-bearing assumption about which tree supplies a
dispatched workflow's BODY is closed by measurement rather than carried.

## The four verdicts

```
VERDICT PASS-DIRECTION: CLOSED
VERDICT FAIL-DIRECTION: CLOSED
VERDICT A1-BODY-PROVENANCE: CLOSED
VERDICT NX-EXIT-IN-RED-STEP: 0
```

All four are the outcomes the runs actually produced. No fallback path fired.

## What was done

**Task 1 -- the `main` window (commit `280c12c`).** The operator-authorised five remote operations,
and nothing else. `main` backed up to a new ref and verified; a one-file `[skip ci]` plumbing commit
(`c53a0969`) built entirely through a `GIT_INDEX_FILE` in the session scratchpad and pushed to
`main`; the detector re-registered from `state: deleted` to `active`; GREEN dispatched against the
phase branch and waited for; the throwaway mutation built the same plumbing way and pushed; RED
dispatched; `main` force-restored with the explicit lease form and verified three ways; the backup
ref deleted.

**Task 2 -- the observation (commit `4c1ee88`).** Both runs read at STEP granularity from the jobs
REST payload plus the raw step logs, never from run colour.

**Task 3 -- the supersede pass (commit `97d86d8`).** Six stale closure claims across five artifacts
now carry a `SUPERSEDED by quick 260803-mew` forward pointer with the merge-base fact and both new
run IDs.

## Why the FAIL half needed more than a red step

The gap this task closes is not "no red existed" -- it is that a red step conclusion cannot
attribute the failure here. Phase 13's XOS-09 had the gate as its own step, so a red step named the
cause. This detector runs `nx run-many` and the needle's `grep` inside a SINGLE step, so
`5|failure` is equally consistent with a broken `nx`. Three log facts separate them:

- the PLURAL three-target line ` NX   Successfully ran targets build, typecheck, lint for project
  @op-nx/github-cache` as genuine Nx output, with all three targets individually completed and a
  success summary block -- with `set -e` and `pipefail` a non-zero `nx` would have short-circuited
  before the `grep` and printed failure wording instead
- the FOUR-target needle occurring exactly ONCE in the whole RED log, and that occurrence being the
  ANSI-bracketed echoed `grep -q` command line, never Nx output
- `##[error]Process completed with exit code 1.` stamped 4.5 seconds after Nx's summary finished --
  the `grep` reading `detector.log`

So the red is attributable to the NEEDLE with `nx` at exit 0 in the same step (D-2, D-5).

## A1, and why the mutation carried a second edit

F-1 established that `actions/checkout` reads the dispatched ref's tree, but NOT which tree supplies
the workflow BODY -- GitHub's docs never state it, and this repo's precedent provably cannot
discriminate it because the prior window's two candidate blobs were byte-identical. Had the body
come from `main`, the RED dispatch would have run the unmutated four-target body and gone GREEN, a
false negative whose natural misreading is "the mutation did not take".

The step NAME therefore carried ` -- THROWAWAY 3-of-4 MUTATION`, a string existing only in the
throwaway blob. The RED run's step 5 carries it; the GREEN run's does not. The body came from the
dispatched ref.

## Deviations from Plan

**1. [Pre-flight] `git status --porcelain` was not empty, and Task 1's fourth gate fails as written**

- **Found during:** pre-flight, before any remote operation
- **Issue:** the entry-state table expects an empty working tree. One path was dirty:
  `260803-mew-PLAN.md` itself -- the orchestrator's own uncommitted revision of the plan, the one
  that added the entry-state section being re-measured. Task 1's gate
  `git status --porcelain | rg -v '^\?\? \.planning/quick/260803-mew'` filters only UNTRACKED paths
  under the quick directory, so a modified tracked file there fails it.
- **Resolution:** not treated as a stop condition, and NOT reverted or committed (PLAN.md is
  orchestrator-owned). The property the gate protects -- that the plumbing procedure never touches
  the working tree or index -- was proven directly instead: `git status --porcelain` before STEP 1
  and after STEP 9 are identical apart from the new evidence artifact, and nothing under `.github/`,
  `packages/` or `nx.json` was ever dirty. The intent form of the gate,
  `rg -v '\.planning/quick/260803-mew'`, passes.

**2. [Rule 3 - Blocking] Restore check (iii) aborts as literally written**

- **Found during:** Task 1 STEP 8
- **Issue:** `git diff --exit-code origin/main refs/backups/main-pre-window-260803-mew` fails with
  `fatal: ambiguous argument ... unknown revision or path not in the working tree` -- `refs/backups/*`
  is a REMOTE namespace that no local refspec fetches, so the ref does not exist locally.
- **Fix:** fetched the backup into `FETCH_HEAD` first, then diffed against that. Same objects, same
  comparison. Recorded in the evidence artifact as a deviation of form, not of substance.
- **Files modified:** none (procedure only)

No other deviations. The A3 fallback (drop `lint`, two-file commit) was NOT needed -- `lint` was
observed passing on `windows-11-arm`. The A1 falsification branch did NOT fire.

## Out of scope, noted not fixed

- **Five stale `refs/backups/*` on origin**, all at `fe25a3f`, from prior windows that skipped their
  delete step. This window deleted its own backup ref.
- **Pre-existing non-ASCII in `.planning/STATE.md`** -- five em dashes around lines 334-338, in a
  section unrelated to this task. Confirmed absent from every line this task added. Not fixed:
  outside this task's scope.

## Verification

| Check | Result |
| --- | --- |
| `refs/heads/main` | `fe25a3f865f20f3d4f8a40e96f8cb5717608ba8a` |
| Detector file on `main` | HTTP 404 `Not Found` |
| `refs/backups/main-pre-window-260803-mew` | deleted |
| `refs/heads/throwaway/*` | none |
| Working tree outside the quick dir | clean |
| `npm exec -- nx run-many -t build typecheck test lint --skip-nx-cache` | exit 0, four-target needle present, 1011 tests passed |
| Task 2 verdict-contract gates (7) | all pass |
| Task 3 marker/count gates (4) | all pass |

## Self-Check: PASSED

- `260803-mew-EVIDENCE.md` exists, 571 lines, ASCII-clean, all four verdict lines present at
  line start with an enumerated token each.
- Commits `280c12c`, `4c1ee88`, `97d86d8` all present in `git log`.
- All five superseded artifacts carry the marker; the two files with two claims each carry it
  exactly twice; the original run id `30603713356` still occurs on both `12-VALIDATION.md` rows.
- No commit in this task deleted any tracked file.
