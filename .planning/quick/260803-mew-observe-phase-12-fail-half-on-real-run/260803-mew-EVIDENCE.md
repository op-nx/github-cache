---
task: 260803-mew
title: Observe both directions of the Phase 12 Windows regression detector on a real runner
date: 2026-08-03
green_run: 30825110047
red_run: PENDING
plumbing_sha: c53a096911477a901f77db1e723f552a8af0b0f0
backup_ref: refs/backups/main-pre-window-260803-mew
status: in-progress
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

