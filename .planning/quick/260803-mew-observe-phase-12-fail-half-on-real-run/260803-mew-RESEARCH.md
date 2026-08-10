# Quick Task 260803-mew: Observe Phase 12 fail half on real run - Research

**Researched:** 2026-08-03
**Domain:** GitHub Actions `workflow_dispatch` mechanics; Nx `run-many` printed-target filtering
**Confidence:** HIGH on everything except Q1's workflow-BODY provenance (MEDIUM -- see F-1)

## Summary

Five of the six questions resolve to MEASURED answers this session. The one that does not
(which tree supplies the workflow BODY on a `workflow_dispatch`) turns out to be the single
load-bearing unknown in the whole task, because the repo's own precedent CANNOT discriminate
it -- the two candidate blobs in the prior window were byte-identical. A zero-cost in-plan
discriminator closes it (F-1).

Two findings change the plan's shape versus what the CONTEXT anticipated:

- **The mutated workflow file is its own spec's subject.** Dropping `lint` (the "cheapest
  target" the brief suggests) leaves `test` in the `-t` list; `test` then runs
  `windows-regression-detector.spec.ts`, which asserts the FOUR-target `-t` list against the
  mutated file on disk, fails, and reddens the `nx` command -- destroying the proof, because
  the RED must come from the `grep` with `nx` at exit 0. **Drop `test` instead** (F-3).
- **Runner minutes cost $0.** This is a PUBLIC repo and `windows-11-arm` is a standard
  GitHub-hosted runner label (F-4). The minute-optimization framing in the brief dissolves.

**Primary recommendation:** mutate ONE file (`-t build typecheck lint`, needle untouched),
on a throwaway branch, with the step NAME also changed so the run's own API payload proves
which tree supplied the body. Dispatch the GREEN first and confirm it before dispatching the
RED, because `lint` on `windows-11-arm` is unproven.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-1:** Observe BOTH directions, not just the fail half. (Confidence: HIGH.)
- **D-2:** The RED is produced by running 3 of the 4 needled targets. (Confidence: HIGH.)
- **D-3:** The mutation lives on a THROWAWAY remote branch, never on the phase branch or
  main. One plumbing commit puts the detector file on `main`; dispatch #1 `--ref` the phase
  branch at `41f65e1` -> GREEN; dispatch #2 `--ref` a throwaway branch carrying the 3-of-4
  mutation -> RED. (Confidence: HIGH.)
- **D-4:** Reuse the documented backup-and-restore procedure verbatim (`12-UAT.md:78-95`).
  Restore happens AFTER both dispatches are created. (Confidence: HIGH.)
- **D-5:** Evidence is read at STEP granularity, never run colour. (Confidence: HIGH.)

### Claude's Discretion

- Exact throwaway branch name and which target to drop from the `-t` list.
- Artifact filename and section layout for the observation record.
- Which existing artifacts get the evidence pointer (at minimum `12-UAT.md` item 2 must stop
  reading as closed on the current needle).

### Deferred Ideas (OUT OF SCOPE)

None recorded in CONTEXT.md.
</user_constraints>

## Project Constraints (from CLAUDE.md / AGENTS.md)

- No `grep` command and no Grep tool. `git grep` for tracked, `rg` for ignored/untracked;
  pipe filters are `| rg`. (The detector workflow's own runner-side `grep -q` is exempt --
  `windows-regression-detector.yml:109-112` records why.)
- ASCII only. No emoji, no em dash, no curly quotes.
- Never `git add .` / `-A` / `-u`; stage by name.
- `git commit -m` fails on this Dev Drive (ReFS COMMIT_EDITMSG EINVAL) -- use
  `git commit -F <file>`. [CITED: memory/git-commit-editmsg-einval.md]
- Nx tasks go through `npm exec -- nx ...`, never a global CLI.

## Findings

### F-1 [Q1, Q2] `workflow_dispatch` ref semantics -- the CHECKOUT is proven, the BODY is not

| Claim | Status |
|---|---|
| The workflow file must exist on the DEFAULT branch or the event does not fire | [CITED: docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_dispatch -- "This event will only trigger a workflow run if the workflow file exists on the default branch."] and [CITED: .../trigger-a-workflow -- "This trigger only receives events when the workflow file is on the default branch."] |
| `GITHUB_SHA` = last commit on the dispatched ref; `GITHUB_REF` = the dispatched branch/tag | [CITED: events-that-trigger-workflows, `workflow_dispatch` table] |
| `--ref` accepts a branch the default branch does not contain | [VERIFIED: `gh api repos/op-nx/github-cache/actions/runs/30603713356` -> `head_branch: gsd/v0.0.2-os-invariant-cross-os-sharing`, `head_sha: e757d4c8...`, `event: workflow_dispatch`] -- direct precedent in this repo. `main` was `fe25a3f`+plumbing at the time and never contained `e757d4c`. |
| `actions/checkout` therefore checks out the REF's tree, not `main`'s | [VERIFIED: same payload -- `head_sha` is the phase-branch commit] |
| **The workflow BODY comes from the ref's tree, not the default branch's** | **[ASSUMED]** |

**Why the last row cannot be lifted to VERIFIED from this repo's history.** The prior window's
two candidate blobs are IDENTICAL:

```
gh api "repos/op-nx/github-cache/contents/.github/workflows/windows-regression-detector.yml?ref=d043eec"
  -> sha 5a7d1962b915a1becc9399730201e799bcaf9bf3   (the copy on main)
git rev-parse e757d4c:.github/workflows/windows-regression-detector.yml
  -> 5a7d1962b915a1becc9399730201e799bcaf9bf3        (the copy on the ref)
```

So run `30603713356` is consistent with EITHER source and proves nothing about body
provenance. `12-UAT.md:87-89` correctly claims the run executed the phase-12 TREE; it does
not claim, and cannot support, a claim about the workflow body. GitHub's docs state the
default-branch EXISTENCE requirement but never state which version executes; the `ref` body
parameter is documented only as "The git reference for the workflow"
[CITED: docs.github.com/en/rest/actions/workflows].

**This is load-bearing.** If the body came from `main`, dispatch #2 would run `main`'s
unmutated four-target body against the throwaway tree and go GREEN -- a false negative that
reads as "the mutation did not take".

**Zero-cost fix, and the plan should adopt it.** Change the STEP NAME in the throwaway body
as well as the `-t` list, e.g. append ` -- THROWAWAY 3-of-4 MUTATION` to
`windows-regression-detector.yml:113`. The run's step names are in the jobs payload
(`gh api .../actions/runs/<id>/jobs -q '.jobs[].steps[].name'`), so the observation
self-authenticates in BOTH directions: a mutated step name proves body-from-ref, and the
unmutated name on a GREEN #2 would immediately expose body-from-main instead of being
misread. Verified the payload carries step names: run `30603713356` step 5 is
`Execute build, typecheck and test on Windows with the Nx cache bypassed` -- the
THREE-target wording from `e757d4c`, which is also (unhelpfully) `main`'s wording at
`d043eec`.

Secondary weak support, recorded honestly: `probe-crossos.yml` is registered as an `active`
workflow (id `320974202`) while being ABSENT from `main`'s tree at `fe25a3f`
(`git ls-tree -r origin/main --name-only -- .github/workflows/` returns only `ci.yml` and
`cleanup.yml`). Its one run (`30220536303`) is `event: pull_request` from branch
`probe/crossos`, so GitHub ran a body that was never on the default branch -- but
`pull_request` is a documented different code path from `workflow_dispatch`, so this does
not settle the question. It does establish that the workflow registry's `state` field is
populated by any run and is not a reliable "is it on main" signal.

### F-2 [Q2] `gh workflow run` will not currently resolve the detector

```
gh workflow list --repo op-nx/github-cache --all
  -> CI 313666980 | Cleanup mirror 316555008 | probe-crossos 320974202     (no detector)
gh api repos/op-nx/github-cache/actions/workflows/324200310
  -> {"id":324200310,"path":".github/workflows/windows-regression-detector.yml","state":"deleted"}
```

[VERIFIED: both commands run this session] The workflow record survives with `state:
deleted`. The plan must push the plumbing commit FIRST, then confirm the workflow re-appears
in `gh workflow list` before attempting either dispatch. Do not assume the id is reusable --
resolve by file name (`gh workflow run windows-regression-detector.yml --ref <ref>`), which
is the documented form [CITED: docs.github.com/.../manually-run-a-workflow -- "To run a
workflow on a branch other than the repository's default branch, use the `--ref` flag."].

### F-3 [Q3] The mutation shape -- drop `test`, not `lint`

**The trap.** `nx.json:71` declares
`{workspaceRoot}/.github/workflows/windows-regression-detector.yml` as a `test` target input,
and `windows-regression-detector.spec.ts:154` asserts

```js
expect(codeLines, reason).toMatch(/nx run-many -t build typecheck test lint --skip-nx-cache/);
```

against the file ON DISK. So if the `-t` list keeps `test`, the mutated workflow makes its own
`test` target fail. `set -euo pipefail` plus the pipe means the step reddens at the `nx` line
with a NON-ZERO nx exit -- which is precisely the weaker proof D-2 rejects, and it would be
indistinguishable at step granularity (F-6). Dropping `lint` (the brief's suggestion) walks
straight into this. [VERIFIED: spec read at `packages/github-cache/src/windows-regression-detector.spec.ts:144-155`; input read at `nx.json:71`]

**Recommended mutation -- ONE file, ONE line.**

```diff
-          npm exec -- nx run-many -t build typecheck test lint --skip-nx-cache 2>&1 | tee detector.log
+          npm exec -- nx run-many -t build typecheck lint --skip-nx-cache 2>&1 | tee detector.log
```

Needle on line 120 stays EXACTLY as at HEAD. Plus the step-name change from F-1.

**Measured, this session, on this workstation (win32/arm64, Nx 23.1.0):**

```
CI=true NO_COLOR=1 npm exec -- nx run-many -t build typecheck lint --skip-nx-cache
  -> exit 0
  ->  NX   Successfully ran targets build, typecheck, lint for project @op-nx/github-cache
```

[VERIFIED: command output captured this session] Plural (`targets`), not singular -- so this
is the strong proof shape, not the weak one. It does NOT contain
`Successfully ran targets build, typecheck, test, lint for project`, so `grep -q` exits 1.

**Positive control, also measured this session** -- and this is the FIRST measurement of the
FOUR-target needle at HEAD in either location:

```
CI=true NO_COLOR=1 npm exec -- nx run-many -t build typecheck test lint --skip-nx-cache
  -> nx exit 0
  -> rg -q -F 'Successfully ran targets build, typecheck, test, lint for project' -> exit 0
  -> critical path 14.6s (task: @op-nx/github-cache:test)
```

**Cross-check against the prior local measurement.** `12-03-SUMMARY.md:233` recorded the
verbatim TWO-target line for `-t build test`:

```
 NX   Successfully ran targets build, test for project @op-nx/github-cache
```

Nx prints the targets in `-t` ARGUMENT ORDER and filters out the ones that resolved no task
(`formatting-utils.js:37`, source-traced in `windows-regression-detector.yml:85-90`). The
three-target analog derived from that rule is `build, typecheck, lint` -- and the measurement
above confirms the derivation exactly.

**Why dropping `test` is the right target to drop, on four independent counts:**

1. It is the ONLY one of the four whose specs read the mutated file, so the mutation stays a
   one-file, one-line change with no paired spec edit.
2. It removes the vitest flake surface. `12-03-SUMMARY.md:202` records a known `test` flake
   (`69bd1b7`) that did not surface but is not retired. A flake would redden the `nx` command
   and void the proof.
3. It is the LONGEST task (14.6s critical path, measured above), so the RED run is the
   cheaper of the two dispatches -- the opposite direction from the brief's assumption that
   dropping the cheapest target saves minutes.
4. `test` sits in the MIDDLE of the needle's list. Its removal proves Nx FILTERS an interior
   element rather than merely truncating the tail -- strictly stronger than dropping the
   trailing `lint`.

**Documented fallback if dispatch #1 shows `lint` red on `windows-11-arm`** (it is unproven
there -- run `30603713356` predates `lint` joining the set): drop `lint` instead AND edit
`windows-regression-detector.spec.ts:154` in the SAME throwaway commit to
`/nx run-many -t build typecheck test --skip-nx-cache/`, leaving
`MULTI_TARGET_SUCCESS_LINE` (line 72-73) at four targets so the gating-form clause at
`:179-184` still passes. Two files, and it reinstates the flake surface -- which is why it is
the fallback, not the default.

### F-4 [Q4] Runner-minute cost: $0

[CITED: docs.github.com/en/billing/concepts/product-billing/github-actions -- "The use of
standard GitHub-hosted runners is free: In public repositories"] and
[CITED: docs.github.com/.../choose-the-runner-for-a-job -- the "Standard GitHub-hosted
runners for public repositories" table lists `windows-11-arm`, with "Use of the standard
GitHub-hosted runners is free and unlimited on public repositories."]

[VERIFIED: `gh repo view op-nx/github-cache --json visibility` -> `PUBLIC`, `isPrivate:
false`]

Wall clock, from run `30603713356`'s jobs payload [VERIFIED]:

| Step | Duration |
|---|---|
| Set up job + checkout | 12s |
| setup-node | 13s |
| `npm ci` | 2m50s |
| three-target execution | 25s |
| post/teardown | 8s |
| **job total** | **3m49s** (run 3m53s) |

`npm ci` is 74 percent of the job, so target selection is noise. Estimate: GREEN ~4m0s
(adds `lint`, a few seconds), RED ~3m50s (adds `lint`, drops the 14.6s `test`). Billable
rounding is per-minute per-job, so ~5 + ~4 = **~9 minutes**, at **$0.00** on this public
repo. Notional cost if the repo were private: `actions_windows_arm` is $0.010/min
[CITED: same billing page], i.e. about **$0.09** -- before the private-repo Windows minute
multiplier. Report it as free; the honest constraint here is the ~8 minutes of wall clock
during which `main` carries the plumbing commit, not money.

### F-5 [Q5] Restore safety

**(a) A run is pinned at creation.** [ASSUMED, but well-supported] No doc sentence found that
says this in so many words. The supporting evidence is behavioural and this repo owns it:
`12-UAT.md:90-91` records `main` being force-restored immediately after dispatch with run
`30603713356` completing normally afterwards, and `STATE.md:413` records the same pattern for
runs `30768540898` / `30768554184` in the Phase 13 window. Three runs, two windows, zero
observed cancellation. Mitigation if the planner wants certainty rather than precedent:
restore only after both runs report `status: completed`. That costs ~8 minutes more of
plumbing-commit exposure on `main`, and the precedent argues against needing it.

**(b) The restore invocation.** `main` is UNPROTECTED, so the force-push is permitted:

```
gh api repos/op-nx/github-cache/branches/main/protection  -> 404 "Branch not protected"
gh api repos/op-nx/github-cache/rulesets                  -> []
```

[VERIFIED: both run this session]

Use the EXPLICIT lease form, not the bare flag -- the bare `--force-with-lease` reads the
local remote-tracking ref, which is untrustworthy here because `main` is never checked out
locally in this procedure:

```
git push --force-with-lease=main:$PLUMBING_SHA origin $BACKUP_SHA:refs/heads/main
```

with `$PLUMBING_SHA` the commit the plan pushed and `$BACKUP_SHA` = `fe25a3f865f20f3d4f8a40e96f8cb5717608ba8a`.

Three-part verification, all three required (D-4):

```
git ls-remote origin refs/heads/main                    -> fe25a3f865f20f3d4f8a40e96f8cb5717608ba8a
gh api "repos/op-nx/github-cache/contents/.github/workflows/windows-regression-detector.yml?ref=main"
                                                        -> 404 (file absent)
git fetch origin main && git diff --exit-code origin/main <backup-ref>   -> empty, exit 0
```

Note the third is tautological once the first passes (identical SHAs cannot differ in tree),
so it is a cheap belt-and-braces check, not independent evidence. The load-bearing checks are
the SHA and the 404.

Entry state re-measured this session [VERIFIED]:

```
git ls-remote origin main -> fe25a3f865f20f3d4f8a40e96f8cb5717608ba8a
git ls-remote origin refs/heads/gsd/v0.0.2-... -> 41f65e1b2ae7058e85580eff0eb97bb784d7726c
git rev-parse HEAD -> 41f65e1b2ae7058e85580eff0eb97bb784d7726c
git ls-tree -r origin/main --name-only -- .github/workflows/ -> ci.yml, cleanup.yml only
git status --porcelain -> only the untracked quick-task dir
git rev-parse HEAD:.github/workflows/windows-regression-detector.yml
  -> b2ff9f33279229ed2abc3105bf1cb260a617262e   (120 lines; the four-target version)
```

**Five stale backup refs already exist on origin, all at `fe25a3f`** [VERIFIED:
`git ls-remote origin 'refs/backups*'`]: `main-pre-phase13-verify`,
`main-pre-publish-verify-window`, `main-pre-window2-260803`, `main-pre-windowA-260803`,
`main-pre-windowB-260803`. So the "delete the backup ref" step of D-4 was skipped in prior
windows. Two consequences: pick a NEW unique name (e.g. `refs/backups/main-pre-window-260803-mew`),
and note the restore target is already independently pinned five times over. Cleaning up the
strays is out of scope for this task; worth a one-line note in the artifact.

**(c) PR #16 will NOT be marked merged, and the reason is structural.** The hazard
`STATE.md:413,641` records is real but attaches to a DIFFERENT push shape. That window pushed
the Phase 13 **branch tip** to `main`, which would have made PR #12's head commit reachable
from the base branch -- GitHub's auto-close-as-merged condition. PR #12 was therefore closed
first, and `mergedAt=null` verified afterwards.

This task's plumbing commit is not a branch tip. It is a single commit whose parent is
`fe25a3f` and which adds exactly one file:

```
gh api repos/op-nx/github-cache/commits/d043eec
  -> parents: ["fe25a3f865f20f3d4f8a40e96f8cb5717608ba8a"]
  -> files:   [".github/workflows/windows-regression-detector.yml"]
```

[VERIFIED: the prior window's plumbing commit is still fetchable] PR #16's head
`41f65e1b2ae7058e85580eff0eb97bb784d7726c` is NOT reachable from such a commit, so the
merged-detection condition is never met.

**Direct precedent, measured:** PR #12 was `createdAt: 2026-07-30T22:10:10Z` and
`closedAt: 2026-08-02T19:23:59Z` [VERIFIED: `gh pr view 12 --json`]. The Phase 12 UAT
plumbing push (`d043eec`) and dispatch happened `2026-07-31T04:16:02Z` -- with PR #12 OPEN.
PR #12 was not marked merged then; it closed two days later, unmerged, for the branch-tip
push. So the exact shape this task uses has already run against an open PR with no merge
side effect.

Residual, cosmetic only: PR #16 (currently `mergeable: MERGEABLE`,
`mergeStateStatus: CLEAN`) will transiently read "1 commit behind" while the plumbing commit
sits on `main`, and returns to CLEAN once `main` is restored to the same SHA. A base-branch
push does not fire `pull_request` activity types (`opened` / `synchronize` / `reopened` all
key on the HEAD), so PR #16's checks are not re-run.

### F-6 [Q5, D-5] Step granularity is NECESSARY but NOT SUFFICIENT here

Unlike Phase 13's XOS-09, where the gate was its OWN step (`13-VERIFICATION.md:144-149`
lists step 8 "Run the build target" success / step 9 "Gate on the ... count" failure), this
detector runs `nx run-many` and the `grep` inside a SINGLE step
(`windows-regression-detector.yml:113-120`). A red step conclusion therefore cannot, on its
own, attribute the failure to the `grep` rather than to `nx`.

The evidence artifact must read the step LOG and record all three:

1. ` NX   Successfully ran targets build, typecheck, lint for project @op-nx/github-cache`
   present as genuine Nx output -- this is what proves `nx` exited 0 (with `-e` and
   `pipefail`, a non-zero `nx` short-circuits before the `grep` and Nx prints failure wording
   instead).
2. `Successfully ran targets build, typecheck, test, lint for project` present ONLY on the
   echoed `grep -q` command line, never as Nx output. `12-UAT.md:48-52` records the sibling
   trap: the echoed shell command carries the needle verbatim and is not a marker.
3. The step's terminal `Process completed with exit code 1.`

Plus the step-NAME check from F-1, which is what ties the observation to the mutated body.

### F-7 [Q6] Repo-specific pitfalls, checked

| Check | Result |
|---|---|
| Does the mutation break a spec if it leaked to the phase branch? | YES -- `windows-regression-detector.spec.ts:154` pins the four-target `-t` line and `:72-73,179-184` pin the four-target gating grep. This is exactly why the mutation stays on a throwaway ref and why the step-name change is safe there but not elsewhere. |
| Does the throwaway push trigger `ci.yml`? | NO. `ci.yml:3-7` is `push: branches: [main]` plus `pull_request`. A branch push with no PR fires neither. [VERIFIED: file read] |
| Does the throwaway commit risk `action-bundle-drift` / `check:action`? | NO. `check:action` is `npm run build:action && git diff --exit-code -- start-cache-server/index.js`; the throwaway commit touches no `serve()`-reachable source, only the workflow yml. Also `check:action` is not among the detector's four targets. [VERIFIED: root `package.json` scripts] |
| Does the mutated yml affect `lint`, `build` or `typecheck`? | NO. `nx.json:71` declares it as a `test` input only; the file lives outside `{projectRoot}` and eslint does not read yml. |
| Other specs referencing the detector | `nx-target-inputs.spec.ts:797-799` asserts `nx.json` DECLARES the input (reads `nx.json`, unaffected by editing the yml); `dogfood-cross-os.spec.ts:175` only mentions it in a comment. Both are `test`-target specs and do not run under the recommended `-t build typecheck lint`. [VERIFIED: `git grep`] |
| Does the plumbing push to `main` trigger `ci.yml`? | It would, hence `[skip ci]` in the commit subject -- the prior window's `d043eec` used exactly that and no push run exists for it. [VERIFIED: commit message fetched] |
| Four targets exist on the project | `npm exec -- nx show project @op-nx/github-cache --json` -> `typecheck, build, build-deps, watch-deps, test, lint, integration, nx-release-publish`. All four needled targets present. `project.json` declares only `integration`; the rest are plugin-inferred. |

## Recommended Sequence (for the planner)

1. Back up: `git push origin fe25a3f...:refs/backups/main-pre-window-260803-mew`, verify SHA.
2. Build the plumbing commit with git plumbing only -- the blob already exists
   (`b2ff9f33...`), so no `hash-object` is needed: temp `GIT_INDEX_FILE`, `read-tree fe25a3f`,
   `update-index --add --cacheinfo 100644,b2ff9f33...,.github/workflows/windows-regression-detector.yml`,
   `write-tree`, `commit-tree -p fe25a3f -F <msgfile>` with `[skip ci]` in the subject.
   Working tree and index untouched. Push to `refs/heads/main`.
3. Confirm the workflow re-registers: `gh workflow list --repo op-nx/github-cache`.
4. Dispatch #1: `gh workflow run windows-regression-detector.yml --ref gsd/v0.0.2-os-invariant-cross-os-sharing`.
   Wait for completion. Confirm GREEN and that `lint` executed. If red on `lint`, switch to
   F-3's fallback mutation before dispatching #2.
5. Push the throwaway branch (one commit, one file, `-t build typecheck lint` + mutated step
   name). Dispatch #2 against it.
6. Read both runs at step granularity per F-6. Write the artifact.
7. Restore `main` per F-5(b), verify all three ways, delete the new backup ref.
8. Delete the throwaway remote branch.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | `workflow_dispatch` executes the workflow BODY from the dispatched ref, not the default branch | F-1 | Dispatch #2 goes GREEN with `main`'s unmutated body; the RED is unobtainable on a throwaway ref and the mutation would have to go somewhere D-3 forbids. **Mitigated to self-detecting** by the step-name discriminator. |
| A2 | A created run is pinned to its workflow file and is unaffected by restoring `main` mid-run | F-5(a) | A run could re-read `main` and behave unexpectedly. Precedent: 3 runs across 2 windows. Mitigation available: restore only after both runs complete. |
| A3 | `lint` passes on `windows-11-arm` | F-3, F-4 | Dispatch #1 reddens on `lint` instead of going GREEN, and D-1's pass half fails for an unrelated reason. Detected by sequencing #1 before #2; fallback mutation documented. |

## Open Questions

1. **Which tree supplies the workflow body (A1).** Recommendation: do not try to resolve it
   before the run -- make the run answer it, via the step-name discriminator. That converts an
   unresolvable pre-flight question into a recorded measurement at zero marginal cost.

## Sources

### Primary (HIGH confidence)
- `gh api` / `gh run view` / `gh pr view` / `gh repo view` / `git ls-remote` / `git ls-tree`
  against `op-nx/github-cache`, all run 2026-08-03 (outputs quoted inline)
- Local `nx run-many` measurements, 2026-08-03, win32/arm64, Nx 23.1.0 (outputs quoted inline)
- Repo files: `.github/workflows/windows-regression-detector.yml`, `.github/workflows/ci.yml:3-7`,
  `nx.json:47-91`, `packages/github-cache/src/windows-regression-detector.spec.ts`,
  root `package.json` scripts

### Secondary (MEDIUM confidence)
- docs.github.com: events-that-trigger-workflows (`workflow_dispatch`),
  trigger-a-workflow, manually-run-a-workflow, rest/actions/workflows,
  billing/concepts/product-billing/github-actions, choose-the-runner-for-a-job
- Repo artifacts: `12-UAT.md:48-52,78-95`, `12-03-SUMMARY.md:100,202,233,265`,
  `13-VERIFICATION.md:126-149`, `.planning/STATE.md:413,641`

## Metadata

**Confidence breakdown:**
- Mutation shape (F-3): HIGH -- both success lines measured this session, spec trap read in source.
- Cost (F-4): HIGH -- repo visibility verified, runner label cited in the free-runner table.
- Restore safety (F-5b, F-5c): HIGH -- protection absence verified, plumbing-commit shape and
  the PR #12 timeline both measured.
- Run pinning (F-5a): MEDIUM -- behavioural precedent only, no doc statement found.
- Body provenance (F-1): MEDIUM -- docs silent, repo history provably non-discriminating.

**Research date:** 2026-08-03
**Valid until:** the observation window closes; the entry-state SHAs are re-measurable and
should be re-checked if the plan does not execute the same day.
