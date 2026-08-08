---
task: 260803-mew
title: Observe both directions of the Phase 12 Windows regression detector on a real runner
date: 2026-08-03
green_run: 30825110047
red_run: 30825602626
plumbing_sha: c53a096911477a901f77db1e723f552a8af0b0f0
backup_ref: refs/backups/main-pre-window-260803-mew
throwaway_sha: 8021b1cc1151343f90493fa179d9342725c296f3
runner: windows-11-arm
verdicts:
  pass_direction: CLOSED
  fail_direction: CLOSED
  a1_body_provenance: CLOSED
  nx_exit_in_red_step: 0
status: complete
---

# Quick Task 260803-mew: Evidence

Observation record for both directions of the Windows regression detector gate
(`.github/workflows/windows-regression-detector.yml`) against the FOUR-target needle
that exists at HEAD, measured on real `windows-11-arm` runners.

## Window log

Every remote operation of the operator-authorised `main` window, in execution order.
All values measured, never inferred.

### Pre-flight (re-measured 2026-08-03, immediately before STEP 1)

| Fact | Expected | Measured | Match |
| --- | --- | --- | --- |
| `git ls-remote origin main` | `fe25a3f865f20f3d4f8a40e96f8cb5717608ba8a` | `fe25a3f865f20f3d4f8a40e96f8cb5717608ba8a` | yes |
| Detector file on `main` | ABSENT | `gh api contents ...?ref=main` -> HTTP 404 `Not Found` | yes |
| Phase branch REMOTE tip | `41f65e1b2ae7058e85580eff0eb97bb784d7726c` | `41f65e1b2ae7058e85580eff0eb97bb784d7726c` | yes |
| Local HEAD | `e6c34ed147012e8528c257a7d8901f806bda1d27` | `e6c34ed147012e8528c257a7d8901f806bda1d27` | yes |
| Detector blob at local HEAD | `b2ff9f33279229ed2abc3105bf1cb260a617262e` | `b2ff9f33279229ed2abc3105bf1cb260a617262e` | yes |
| Detector blob at the remote tip `41f65e1` | same blob | `b2ff9f33279229ed2abc3105bf1cb260a617262e` | yes, IDENTICAL at both |
| `git config user.email` | `larsbrinknielsen@gmail.com` | `larsbrinknielsen@gmail.com` | yes |
| `git status --porcelain` | EMPTY | ` M .planning/quick/260803-mew-.../260803-mew-PLAN.md` | NO -- see note |
| Detector in `gh workflow list --all` | absent (record `state: deleted`, F-2) | absent: only CI, Cleanup mirror, probe-crossos | yes |

**The one pre-flight mismatch, and why it is not a stop condition.** The single dirty path is
the orchestrator's own uncommitted revision of `260803-mew-PLAN.md` -- the revision that ADDED
the entry-state section this table re-measures (it rewrote the "Phase branch tip and local HEAD"
row into the separate REMOTE-tip and local-HEAD rows, and changed STEP 5's `read-tree HEAD` to
`read-tree 41f65e1`). It is orchestrator-owned by the dispatch contract and predates this
agent's first command. Nothing under `.github/`, `packages/` or `nx.json` is dirty, so the
property the row exists to protect -- that this plumbing procedure never touches the working
tree or index of the code under test -- holds. The property was additionally proven by
comparing `git status --porcelain` byte-for-byte before STEP 1 and after STEP 9: identical.

**Five stale backup refs already sit on origin**, all at `fe25a3f865f20f3d4f8a40e96f8cb5717608ba8a`:
`main-pre-phase13-verify`, `main-pre-publish-verify-window`, `main-pre-window2-260803`,
`main-pre-windowA-260803`, `main-pre-windowB-260803` (F-5). Prior windows skipped their delete
step. Cleaning them up is OUT OF SCOPE here; noted so the omission is a recorded decision. Their
existence is also why this window used a NEW name rather than reusing one: reusing a name would
overwrite an existing pin.

### STEP 1 -- back up `main`

```
git push origin fe25a3f865f20f3d4f8a40e96f8cb5717608ba8a:refs/backups/main-pre-window-260803-mew
 * [new reference]   fe25a3f865f20f3d4f8a40e96f8cb5717608ba8a -> refs/backups/main-pre-window-260803-mew

git ls-remote origin refs/backups/main-pre-window-260803-mew
fe25a3f865f20f3d4f8a40e96f8cb5717608ba8a	refs/backups/main-pre-window-260803-mew
```

### STEP 2 -- build and push the plumbing commit

Built entirely with git plumbing against a temp `GIT_INDEX_FILE` located in the session
scratchpad, OUTSIDE the repository, so the working tree and the repo index are never touched
(D-3, T-mew-02). The blob already existed at `b2ff9f33279229ed2abc3105bf1cb260a617262e`, so no
`hash-object` was needed.

```
GIT_INDEX_FILE=<scratchpad>/tmp-index-plumbing
git read-tree fe25a3f865f20f3d4f8a40e96f8cb5717608ba8a
git update-index --add --cacheinfo 100644,b2ff9f33279229ed2abc3105bf1cb260a617262e,.github/workflows/windows-regression-detector.yml
git write-tree   -> f1f00cede0243baffa760e8583c3408758ce0a7d
git commit-tree f1f00ced... -p fe25a3f865f20f3d4f8a40e96f8cb5717608ba8a -F <msgfile>
                 -> c53a096911477a901f77db1e723f552a8af0b0f0
```

Commit shape, verified before the push:

```
c53a096911477a901f77db1e723f552a8af0b0f0
author:    Lars Gyrup Brink Nielsen <larsbrinknielsen@gmail.com>
committer: Lars Gyrup Brink Nielsen <larsbrinknielsen@gmail.com>
parents:   fe25a3f865f20f3d4f8a40e96f8cb5717608ba8a
subject:   ci(detector): register the windows regression detector for dispatch [skip ci]

 .github/workflows/windows-regression-detector.yml | 120 +++++++++++++++++
 1 file changed, 120 insertions(+)
```

Exactly one file, one parent, public-gmail identity on BOTH author and committer (T-mew-06),
and `[skip ci]` in the SUBJECT (T-mew-03, matching the prior window's `d043eec`).

```
git push origin c53a096911477a901f77db1e723f552a8af0b0f0:refs/heads/main
   fe25a3f..c53a096  c53a096911477a901f77db1e723f552a8af0b0f0 -> main
```

**PLUMBING SHA: `c53a096911477a901f77db1e723f552a8af0b0f0`.** The exposure window opens here.

### STEP 3 -- confirm re-registration

Before the push the detector was absent from the registry listing (its record is `state:
deleted`, F-2) and the dispatch API could not have resolved it. After:

```
gh workflow list --repo op-nx/github-cache --all
CI                            active   313666980
Cleanup mirror                active   316555008
probe-crossos                 active   320974202
Windows regression detector   active   324200310      <- re-registered
```

Every dispatch below resolves the workflow by FILE NAME, never by the numeric id.

### STEP 4 -- dispatch the GREEN (D-1)

```
gh workflow run windows-regression-detector.yml --repo op-nx/github-cache \
  --ref gsd/v0.0.2-os-invariant-cross-os-sharing
https://github.com/op-nx/github-cache/actions/runs/30825110047
```

**GREEN RUN ID: `30825110047`**, `event: workflow_dispatch`, `headSha:
41f65e1b2ae7058e85580eff0eb97bb784d7726c` -- the REMOTE tip, as required. Waited for
completion before building the mutation, because `lint` on `windows-11-arm` was unproven (A3)
and a red `lint` would have forced F-3's documented fallback mutation.

The GREEN completed `conclusion: success` in 3m06s (created 14:56:43Z, updated 14:59:49Z), and
its log shows `lint` executing on the runner. **A3 is closed by measurement**, so the DEFAULT
mutation was used and F-3's two-file `lint` fallback was NOT needed. Recorded because the plan
required the switch to be reported either way.

### STEP 5 -- build and push the throwaway mutation (D-2, D-3)

The tracked copy of the workflow was never opened. `git show
41f65e1b2ae7058e85580eff0eb97bb784d7726c:.github/workflows/windows-regression-detector.yml`
wrote a copy into the scratchpad, both edits were applied THERE, and the result was hashed with
`--path` so the `* text=auto eol=lf` clean filter applied.

```
git hash-object -w --path .github/workflows/windows-regression-detector.yml <scratchpad>/mutated.yml
                 -> 79799f902a2235a5e1f1fa51660a748d583b0e7f

GIT_INDEX_FILE=<scratchpad>/tmp-index-throwaway
git read-tree 41f65e1b2ae7058e85580eff0eb97bb784d7726c        <- the REMOTE tip, not local HEAD
git update-index --add --cacheinfo 100644,79799f90...,.github/workflows/windows-regression-detector.yml
git write-tree   -> e5b925cfbb1265508885fdcf4bb94e70e66247a7
git commit-tree e5b925cf... -p 41f65e1b2ae7058e85580eff0eb97bb784d7726c -F <msgfile>
                 -> 8021b1cc1151343f90493fa179d9342725c296f3
```

Whole-tree diff against the remote tip, proving the throwaway commit carries the mutation and
NOTHING else -- in particular not the `.planning/**`-only local commit `e6c34ed`:

```
git diff --stat 41f65e1b2ae7058e85580eff0eb97bb784d7726c 8021b1cc1151343f90493fa179d9342725c296f3
 .github/workflows/windows-regression-detector.yml | 4 ++--
 1 file changed, 2 insertions(+), 2 deletions(-)
```

**THE MUTATION, verbatim and complete.** Exactly two lines, and the needle survives as an
unchanged CONTEXT line:

```diff
@@ -110,11 +110,11 @@ jobs:
       # correct -- this project's never-use-grep rule governs the agent's own
       # shell, not workflow bodies, and ci.yml's lint job already uses grep -q
       # for exactly this purpose.
-      - name: Execute build, typecheck, test and lint on Windows with the Nx cache bypassed
+      - name: Execute build, typecheck, test and lint on Windows with the Nx cache bypassed -- THROWAWAY 3-of-4 MUTATION
         shell: bash
         env:
           NO_COLOR: '1'
         run: |
           set -euo pipefail
-          npm exec -- nx run-many -t build typecheck test lint --skip-nx-cache 2>&1 | tee detector.log
+          npm exec -- nx run-many -t build typecheck lint --skip-nx-cache 2>&1 | tee detector.log
           grep -q 'Successfully ran targets build, typecheck, test, lint for project' detector.log
```

```
git push origin 8021b1cc...:refs/heads/throwaway/detector-red-260803-mew
 * [new branch]      8021b1cc1151343f90493fa179d9342725c296f3 -> throwaway/detector-red-260803-mew
```

**No workflow fired on that push (F-7 confirmed, not assumed).** `gh run list --repo
op-nx/github-cache --limit 5` immediately afterwards shows no run with `headBranch:
throwaway/detector-red-260803-mew` other than the deliberate dispatch below; the most recent
`CI` run on `main` is `30808393246` at `2026-08-03T11:09:17Z`, hours BEFORE the 14:5x plumbing
push -- so `[skip ci]` also did its job on the `main` push (T-mew-03 closed in both directions).

### STEP 6 -- dispatch the RED

```
gh workflow run windows-regression-detector.yml --repo op-nx/github-cache \
  --ref throwaway/detector-red-260803-mew
https://github.com/op-nx/github-cache/actions/runs/30825602626
```

**RED RUN ID: `30825602626`**, `event: workflow_dispatch`, `headBranch:
throwaway/detector-red-260803-mew`, `headSha: 8021b1cc1151343f90493fa179d9342725c296f3`,
`status: in_progress`. NOT waited on -- the restore is the next action, and every additional
minute is exposure.

### STEP 7 -- restore `main` (D-4)

Executed with BOTH runs created and the RED still in flight. The EXPLICIT lease form was used,
not the bare flag, because `main` is never checked out locally in this procedure and the bare
form would read an untrustworthy remote-tracking ref:

```
git push --force-with-lease=main:c53a096911477a901f77db1e723f552a8af0b0f0 origin \
  fe25a3f865f20f3d4f8a40e96f8cb5717608ba8a:refs/heads/main
 + c53a096...fe25a3f fe25a3f865f20f3d4f8a40e96f8cb5717608ba8a -> main (forced update)
```

The exposure window ran from the STEP 2 push to this line: `14:5x` to `15:03`, about SIX
MINUTES, during which the default branch of a PUBLIC repository carried one extra commit.

### STEP 8 -- verify the restore THREE ways (the blocking gate)

```
(i)   git ls-remote origin refs/heads/main
      fe25a3f865f20f3d4f8a40e96f8cb5717608ba8a	refs/heads/main

(ii)  gh api "repos/op-nx/github-cache/contents/.github/workflows/windows-regression-detector.yml?ref=main"
      {"message":"Not Found"}   HTTP 404

(iii) git fetch origin refs/backups/main-pre-window-260803-mew
      FETCH_HEAD = fe25a3f865f20f3d4f8a40e96f8cb5717608ba8a
      origin/main = fe25a3f865f20f3d4f8a40e96f8cb5717608ba8a
      git diff --exit-code origin/main FETCH_HEAD   -> empty, exit status 0
```

All three pass. As the plan states, (iii) is tautological once (i) passes -- identical SHAs
cannot differ in tree -- so it is belt-and-braces, not independent evidence; (i) and (ii) are
the load-bearing checks. One deviation of FORM, not of substance, on (iii): the plan's literal
invocation `git diff --exit-code origin/main refs/backups/main-pre-window-260803-mew` fails with
`fatal: ambiguous argument ... unknown revision`, because `refs/backups/*` is a REMOTE namespace
that no local refspec fetches. The backup was fetched into `FETCH_HEAD` first and the diff run
against that. The comparison performed is the one the plan intended, against the same object.

### STEP 9 -- delete the backup ref

Run only after STEP 8 passed.

```
git push origin :refs/backups/main-pre-window-260803-mew
 - [deleted]         refs/backups/main-pre-window-260803-mew

git ls-remote origin refs/backups/main-pre-window-260803-mew   -> empty
```

The five stale refs from prior windows remain, deliberately untouched (out of scope). The
throwaway BRANCH was left alive here on purpose: the RED run was still in flight and its
checkout resolves against that ref. It is deleted at the end of the observation section below.

### Working tree and index: never touched

`git status --porcelain` immediately after STEP 9 is byte-identical to the pre-flight reading
apart from this artifact appearing as a new untracked file. Nothing under `.github/`,
`packages/` or `nx.json` was ever dirty. Both commits were built through `GIT_INDEX_FILE`
pointed into the session scratchpad, outside the repository (T-mew-02).

### Throwaway branch deleted

Run after the RED run completed and its logs were read.

```
git push origin :refs/heads/throwaway/detector-red-260803-mew
 - [deleted]         throwaway/detector-red-260803-mew

git ls-remote origin 'refs/heads/throwaway/*'   -> empty
```

The mutation exists nowhere on origin (D-3). `git ls-remote --heads origin` afterwards lists only
the pre-existing branches; `main` is `fe25a3f865f20f3d4f8a40e96f8cb5717608ba8a` and the phase
branch is `41f65e1b2ae7058e85580eff0eb97bb784d7726c`, unpushed and unchanged.

## PASS direction

**Run `30825110047`** -- the FIRST real-runner observation of the four-target needle at HEAD in
either direction (D-1). The one prior green, `30603713356`, pins the SUPERSEDED three-target
needle and cannot speak to this.

| Field | Value |
| --- | --- |
| `event` | `workflow_dispatch` |
| `headBranch` | `gsd/v0.0.2-os-invariant-cross-os-sharing` |
| `headSha` | `41f65e1b2ae7058e85580eff0eb97bb784d7726c` (the REMOTE tip, as required) |
| `conclusion` | `success` |
| Wall clock | 14:56:43Z -> 14:59:49Z, 3m06s |

### Per-job conclusion

| Job | Runner label | Runner | Conclusion |
| --- | --- | --- | --- |
| `detect` | `windows-11-arm` | GitHub Actions 1000002407 | success |

### Per-step conclusions

| # | Step | Conclusion | Duration |
| --- | --- | --- | --- |
| 1 | Set up job | success | 1s |
| 2 | Run actions/checkout@v7 | success | 9s |
| 3 | Run actions/setup-node@v6 | success | 11s |
| 4 | Run npm ci | success | 2m11s |
| 5 | Execute build, typecheck, test and lint on Windows with the Nx cache bypassed | **success** | 22s |
| 9 | Post Run actions/setup-node@v6 | success | 0s |
| 10 | Post Run actions/checkout@v7 | success | 5s |
| 11 | Complete job | success | 0s |

Step 5 is the guarded step: it runs `nx run-many` and the needle's `grep` together. Its name is
the UNMUTATED four-target wording, which is the contrast that gives the RED run's mutated name its
meaning.

### The needle as genuine Nx output

The four-target needle occurs TWICE in the GREEN log, and the two occurrences are different kinds
of thing. Both are attributed rather than counted:

```
line 156  ...14:59:20.8420599Z ESC[36;1mgrep -q 'Successfully ran targets build, typecheck, test, lint for project' detector.log ESC[0m
line 339  ...14:59:41.1007559Z  NX   Successfully ran targets build, typecheck, test, lint for project @op-nx/github-cache
```

Line 156 is the ECHOED shell command, identifiable by the ANSI command-echo colour codes that
bracket it. It is NOT a marker -- `12-UAT.md:48-52` records this exact sibling trap in this
repository. Line 339 is genuine Nx output, prefixed ` NX   ` and naming the project. Line 339 is
the observation; line 156 is noise that happens to contain the same bytes.

Nx also printed its plural header ` NX   Running targets build, typecheck, test, lint for project
@op-nx/github-cache:` at line 162, and `lint` is present as an executed task:

```
line 173  ...14:59:35.6567988Z ##[group][ok] > nx run @op-nx/github-cache:lint
```

**A3 is closed by measurement.** `lint` passes on `windows-11-arm`. It was unproven before this
run, because `30603713356` predates `lint` joining the target set. F-3's two-file fallback
mutation was therefore NOT needed, and the default one-file mutation was used.

VERDICT PASS-DIRECTION: CLOSED

## FAIL direction

**Run `30825602626`** -- the first observation of the detector's FAIL half on a real runner in the
repository's history. Before this, the non-vacuity proof existed only as a local measurement on
one Windows workstation (`12-03-SUMMARY.md:100,241`).

| Field | Value |
| --- | --- |
| `event` | `workflow_dispatch` |
| `headBranch` | `throwaway/detector-red-260803-mew` |
| `headSha` | `8021b1cc1151343f90493fa179d9342725c296f3` |
| `conclusion` | `failure` |
| Wall clock | 15:02:46Z -> 15:07:04Z, 4m18s |

### Per-job conclusion

| Job | Runner label | Conclusion |
| --- | --- | --- |
| `detect` | `windows-11-arm` | failure |

### Per-step conclusions

| # | Step | Conclusion | Duration |
| --- | --- | --- | --- |
| 1 | Set up job | success | 1s |
| 2 | Run actions/checkout@v7 | success | 11s |
| 3 | Run actions/setup-node@v6 | success | 14s |
| 4 | Run npm ci | success | 3m11s |
| 5 | Execute build, typecheck, test and lint on Windows with the Nx cache bypassed **-- THROWAWAY 3-of-4 MUTATION** | **failure** | 26s |
| 9 | Post Run actions/setup-node@v6 | skipped | -- |
| 10 | Post Run actions/checkout@v7 | success | 5s |
| 11 | Complete job | success | 0s |

Exactly one step failed, and it is the guarded step. Every step before it succeeded, so the red is
not a checkout, a toolchain or an `npm ci` fault.

### Why step granularity is necessary but NOT sufficient here

This is the material difference from Phase 13's XOS-09, whose form this section mirrors. There the
gate was its OWN step, so a red step conclusion attributed the failure by itself
(`13-VERIFICATION.md:144-149`: step 8 "Run the build target" success, step 9 "Gate on the ... count"
failure). This detector runs `nx run-many` and the `grep` inside a SINGLE step
(`windows-regression-detector.yml:113-120`), so `5|failure` on its own cannot distinguish a failed
`grep` from a failed `nx`. The four log facts below are what close that gap.

### FACT 1 -- the plural three-target Nx line, proving `nx` exited 0

```
line 226  ...15:06:52.1863919Z  NX   Successfully ran targets build, typecheck, lint for project @op-nx/github-cache
```

Genuine Nx output, ` NX   `-prefixed, and **PLURAL** (`targets`) -- the strong proof shape. The
singular form would have meant only one target resolved a task. Nx printed its matching plural
header at line 201, and all three targets appear as individually completed tasks:

```
line 207  ...15:06:39.6602207Z ##[group][ok] > nx run @op-nx/github-cache:build
line 212  ...15:06:43.2691955Z ##[group][ok] > nx run @op-nx/github-cache:typecheck
line 217  ...15:06:52.1856211Z ##[group][ok] > nx run @op-nx/github-cache:lint
```

`rg -F '@op-nx/github-cache:test'` over the whole RED log returns NOTHING: the dropped target did
not run, which is the mutation working as designed. Nx's own summary block follows, reporting
`Run duration: 15.2s`, `Cache: Skipped (--skip-nx-cache)`, `Critical path: 15.2s (1 task)` and a
recommendations block -- all success-shaped wording. No Nx failure wording appears anywhere in the
step.

This is what proves the `nx` command exited 0. The step body is `set -euo pipefail` plus a pipe: a
non-zero `nx` would have short-circuited the step BEFORE the `grep` ran, and Nx would have printed
failure wording instead of a success summary. So the exit-1 that reddened the step cannot have come
from `nx`.

VERDICT NX-EXIT-IN-RED-STEP: 0

### FACT 2 -- the four-target needle appears ONLY as an echoed command

Counted and attributed, not asserted:

```
rg -c -F 'Successfully ran targets build, typecheck, test, lint for project'  -> 1
rg -c -F 'Successfully ran targets build, typecheck, lint for project'        -> 1
```

The FOUR-target needle occurs exactly ONCE in the entire RED log, and that one occurrence is the
echoed `grep -q` command line:

```
line 195  ...15:06:30.8161842Z ESC[36;1mgrep -q 'Successfully ran targets build, typecheck, test, lint for project' detector.log ESC[0m
```

ANSI command-echo codes bracket it, exactly as on the GREEN run's line 156. It never appears as Nx
output. The THREE-target line occurs exactly once and is genuine Nx output (FACT 1). So the needle
the gate searches for was genuinely absent from `detector.log`, and the only text in the log that
matches it is the search expression itself. That is precisely the trap `12-UAT.md:48-52` records,
and here it is separated by attribution rather than by counting.

### FACT 3 -- the step's terminal exit line

```
line 238  ...15:06:56.7436938Z ##[error]Process completed with exit code 1.
```

Timing is corroborating evidence: Nx's summary block finished at `15:06:52.2013637Z` and the
exit-1 line is stamped `15:06:56.7436938Z`, about 4.5 seconds later. Those 4.5 seconds are the
`grep` reading `detector.log` and failing. There is no other command in the step body after the
`grep`.

Taken together: `nx` exited 0 inside the step, the needle was absent from the log it wrote, the
`grep -q` therefore exited 1, and `set -euo pipefail` propagated that to the step. The RED is
attributable to the NEEDLE, not to an exit code (D-2, D-5, F-6).

VERDICT FAIL-DIRECTION: CLOSED

## A1 -- workflow body provenance

The load-bearing unknown of the whole task. F-1 could establish that `actions/checkout` reads the
DISPATCHED ref's tree, but NOT which tree supplies the workflow BODY: GitHub's docs state the
default-branch EXISTENCE requirement and never state which version executes, and this repository's
own precedent provably cannot discriminate it -- the prior window's two candidate blobs were
byte-identical (`5a7d1962...` on both `main` and the phase branch), so run `30603713356` is
consistent with either source.

If the body had come from `main`, the RED dispatch would have run `main`'s UNMUTATED four-target
body against the throwaway tree and gone GREEN -- a false negative whose natural misreading is
"the mutation did not take".

The discriminator was built into the mutation: the step NAME carries a suffix that exists on the
throwaway ref and nowhere else. Step names are returned by the jobs REST payload, so the run
authenticates its own body. Measured:

```
gh api repos/op-nx/github-cache/actions/runs/30825602626/jobs -q '.jobs[].steps[].name'
  5 -> Execute build, typecheck, test and lint on Windows with the Nx cache bypassed -- THROWAWAY 3-of-4 MUTATION

gh api repos/op-nx/github-cache/actions/runs/30825110047/jobs -q '.jobs[].steps[].name'
  5 -> Execute build, typecheck, test and lint on Windows with the Nx cache bypassed
```

The RED run's step 5 carries the throwaway suffix. The GREEN run's step 5, dispatched against a ref
whose tree lacks the suffix, does not. The suffix exists only in blob
`79799f902a2235a5e1f1fa51660a748d583b0e7f`, reachable only from commit
`8021b1cc1151343f90493fa179d9342725c296f3` on the deleted throwaway ref -- never on `main`, whose
tree at the time carried blob `b2ff9f33279229ed2abc3105bf1cb260a617262e` via plumbing commit
`c53a096911477a901f77db1e723f552a8af0b0f0`. So the executed body came from the DISPATCHED REF.

A1 is settled by measurement rather than assumption, and the measurement cost nothing: the same
mutation that produces the RED also proves where the body came from.

VERDICT A1-BODY-PROVENANCE: CLOSED

## Assumptions carried

| # | Assumption | Status after this window |
| --- | --- | --- |
| A1 | `workflow_dispatch` executes the workflow BODY from the dispatched ref | **CLOSED by measurement.** Step-name discriminator, above. No longer an assumption. |
| A2 | A created run is pinned at creation and does not re-read `main` | **STILL CARRIED.** See below. |
| A3 | `lint` passes on `windows-11-arm` | **CLOSED by measurement.** GREEN run, line 173. |

**A2 remains an assumption and STEP 7 rests on it.** No documentation sentence was found stating
that a created run is pinned to its workflow file. The support is behavioural and this repository
owns all of it: `12-UAT.md:90-91` (run `30603713356`), `STATE.md:413` (runs `30768540898` /
`30768554184`), and now this window's `30825602626`, which was created BEFORE the restore and
completed normally 3m53s after it. That is four runs across three windows with zero observed
cancellation -- precedent, not a documented guarantee, and recorded here as such rather than
presented as a fact. The available stronger mitigation is to restore only after both runs report
`status: completed`, at the cost of roughly eight more minutes of plumbing-commit exposure on a
public default branch. This window took the precedent-backed ordering deliberately (T-mew-07,
disposition `accept`).

**Five stale `refs/backups/*` remain on origin**, all at `fe25a3f865f20f3d4f8a40e96f8cb5717608ba8a`:
`main-pre-phase13-verify`, `main-pre-publish-verify-window`, `main-pre-window2-260803`,
`main-pre-windowA-260803`, `main-pre-windowB-260803`. Prior windows skipped their delete step. This
window's own backup ref WAS deleted. Cleaning up the strays is out of scope; recorded so the
omission is a decision rather than an oversight.

## Superseded claims

Task 3 adds the `SUPERSEDED by quick 260803-mew` forward pointer to SIX closure claims across FIVE
artifacts: `12-UAT.md` item 2; `12-VALIDATION.md` twice (`:107` map row and `:160` XOS-05 row);
`12-VERIFICATION.md` twice (frontmatter `human_verification` entry and the prose item);
`REQUIREMENTS.md` XOS-05 traceability cell; `STATE.md`. Each preserves the original claim and
appends the replacement fact alongside it, never deleting -- `12-PATTERNS.md:1235` (S-1) is
explicit that a bare deletion leaves a future reader holding a documented argument for undoing the
work.

**Scope boundary, recorded as a decision.** `12-VALIDATION.md:104`, `12-PATTERNS.md:75,97`,
`12-SECURITY.md:85,87` and the `12-0N-PLAN.md` files also contain the three-target literal but were
deliberately NOT edited: they DESCRIBE the mechanism or the file as it stood when written rather
than claiming a closure, `:104` is closed on a different run (`30586177358`, about the per-leg
`[remote cache]` counts, not the needle), and historical plans are never back-edited.

## What this does NOT prove

- **It does not prove the four-target needle is correct for all future target sets.** The needle
  pins the `-t` ARGUMENT ORDER. Reordering the flags reddens a correct run. The documented repair
  stays what the workflow header says: update the needle AND its clause in
  `windows-regression-detector.spec.ts` in the SAME commit, never shorten the needle. This window's
  mutation is throwaway and must never be confused with that repair path.
- **It does not prove `main` can carry the detector file.** `main` does not carry it and this
  window did not change that. The detector remains dispatchable only inside a plumbing window until
  the phase branch merges. Its `schedule` trigger likewise cannot fire while the file is absent
  from the default branch, so the daily cadence is still unobserved.
- **It does not prove A2.** The restore-during-flight ordering worked a fourth time. That is
  precedent, not a guarantee.
- **It does not observe the SCHEDULED path.** Both runs are `event: workflow_dispatch`. The
  `schedule: cron: '23 4 * * *'` trigger has never fired for this workflow.
- **It does not prove Windows portability of the code under test beyond these four targets.** The
  GREEN proves `build`, `typecheck`, `test` and `lint` execute and pass on `windows-11-arm` at
  `41f65e1`. It says nothing about `integration`, which is not in the needle.
- **It does not prove the gate catches every Windows-only regression shape.** It proves the gate is
  non-vacuous: it fails when a needled target does not run. A regression that makes a target run
  and pass while producing wrong output is outside what a printed-target-list needle can see.
- **The RED was produced by a deliberate mutation, not by a real regression.** The proof is that
  the mechanism fires, not that a regression exists.

