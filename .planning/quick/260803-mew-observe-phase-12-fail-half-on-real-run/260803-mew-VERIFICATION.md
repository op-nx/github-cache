---
task: 260803-mew
verified: 2026-08-03
status: human_needed
green_run: 30825110047
red_run: 30825602626
score: 7/7 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Decide whether the STEP 7 restore push's incidental CI trigger (a full ci.yml run on main, distinct from the throwaway push) needs a runbook change for future backup-and-restore windows."
    expected: "A maintainer decision: accept the residual as unavoidable (main only ever contains fe25a3f, whose commit message the operator does not control and cannot carry [skip ci] on re-push), or adopt a different restore mechanism."
    why_human: "Not a defect of 260803-mew and not covered by any of its must_haves -- it is a systemic property of every backup-and-restore window this project has run (five stale refs/backups/* on origin imply five prior windows, each of which likely triggered the same effect). The specific failure observed (publish 422 on the August cache-mirror shard) is independently confirmed pre-existing and already tracked (STATE.md 260802-toz entry, and commit 1e5bc10's in-flight fix), so no NEW regression exists. But EVIDENCE.md and SUMMARY.md are silent on it, and it is exactly the class of side effect the task's own T-mew-03 threat entry addresses for the plumbing and throwaway pushes -- just not for the restore push."
---

# Quick Task 260803-mew Verification Report

**Task Goal:** Observe Phase 12's Windows regression detector gate FAIL half (and, since the one PASS
observation on record pinned a needle superseded by `9e79009`, the PASS half too) on a real
`windows-11-arm` GitHub Actions runner.

**Verified:** 2026-08-03
**Status:** human_needed
**Stance:** Every claim below was re-measured independently against live `gh api` / `gh run view` /
`git ls-remote` / `git grep` output and the raw GitHub Actions step logs. SUMMARY.md and EVIDENCE.md
were read as claims to falsify, not as evidence.

## Must-Have Truths

| # | Truth (from PLAN.md frontmatter) | Status | Evidence I gathered independently |
|---|---|---|---|
| 1 | D-1: PASS half observed on a real `windows-11-arm` runner against the FOUR-target needle at HEAD | VERIFIED | `gh run view 30825110047 --json status,conclusion,headSha,event,headBranch` -> `conclusion:success, headSha:41f65e1b2ae7058e85580eff0eb97bb784d7726c, event:workflow_dispatch, headBranch:gsd/v0.0.2-os-invariant-cross-os-sharing`. `gh api .../30825110047/jobs -q '.jobs[].labels'` -> `["windows-11-arm"]`. Fetched the full raw log (`gh run view 30825110047 --log`) myself: line 339 is genuine Nx output `NX   Successfully ran targets build, typecheck, test, lint for project @op-nx/github-cache` (the four-target needle); line 156 is the ANSI-bracketed echoed `grep -q` command carrying the same bytes; line 173 shows `nx run @op-nx/github-cache:lint` executing. All three line numbers match EVIDENCE.md exactly. |
| 2 | D-2 + D-5: RED run's guarded step fails at the needle's grep while `nx` in that SAME step exited 0, proven by the plural three-target Nx line as genuine output and the step's terminal exit-code-1 line | VERIFIED | Fetched the full raw RED log myself (`gh run view 30825602626 --log`). Independently: `rg -c -F 'Successfully ran targets build, typecheck, test, lint for project'` -> 1 (only line 195, the echoed `grep -q` command); `rg -c -F 'Successfully ran targets build, typecheck, lint for project'` -> 1 (line 226, `NX   Successfully ran targets build, typecheck, lint for project @op-nx/github-cache`, genuine Nx output, plural); `rg -c -F '@op-nx/github-cache:test'` -> 0 (the dropped target never ran); line 238 is `##[error]Process completed with exit code 1.`, timestamped 15:06:56.74, 4.5s after Nx's summary block finished at 15:06:52.20. All four line numbers (195, 201, 226, 238) match EVIDENCE.md's FACT 1/2/3 exactly. |
| 3 | A1 closed by measurement: RED step NAME carries the throwaway mutation, GREEN's does not, proving the workflow BODY came from the dispatched ref | VERIFIED | `gh api repos/op-nx/github-cache/actions/runs/30825602626/jobs -q '.jobs[].steps[].name'` -> step 5 is `Execute build, typecheck, test and lint on Windows with the Nx cache bypassed -- THROWAWAY 3-of-4 MUTATION`. Same query against `30825110047` -> step 5 is the unmutated name. `git grep -F 'THROWAWAY' -- .github/` -> exit code 1 (zero matches): the suffix never reached the tracked workflow at HEAD. |
| 4 | D-3: mutation exists only on the throwaway ref, deleted; neither phase branch nor main ever carries it; no ci.yml run triggered by the throwaway push | VERIFIED | `git ls-remote origin 'refs/heads/throwaway/*'` -> empty. `git grep -F 'THROWAWAY' -- .github/` -> no matches (confirms it never landed on any tracked ref). `gh run list --repo op-nx/github-cache --workflow ci.yml --json databaseId,headBranch,event,createdAt,conclusion --limit 15` -> no run with `headBranch: throwaway/detector-red-260803-mew`; the nearest `main` push-triggered CI runs bracket the window with no entry for the throwaway ref. |
| 5 | D-4: main restored to `fe25a3f865f20f3d4f8a40e96f8cb5717608ba8a`, proven three ways | VERIFIED | `git ls-remote origin refs/heads/main` -> `fe25a3f865f20f3d4f8a40e96f8cb5717608ba8a`. `gh api "repos/op-nx/github-cache/contents/.github/workflows/windows-regression-detector.yml?ref=main"` -> `{"message":"Not Found", ...}` HTTP 404. `git ls-remote origin refs/backups/main-pre-window-260803-mew` -> empty (deleted, confirming the third leg is moot the same way EVIDENCE.md states). |
| 6 | Six claims across five artifacts carry `SUPERSEDED by quick 260803-mew`, originals preserved, never deleted | VERIFIED (with a pre-existing accounting discrepancy noted) | `git grep -l -F 'SUPERSEDED by quick 260803-mew' --` across all five named files returns all five. `git grep -c` on `12-VERIFICATION.md` and `12-VALIDATION.md` both return `2`. `git grep -c -F '30603713356' -- 12-VALIDATION.md` -> `2` (original run id preserved at both `:107` and `:160`). Read every site directly: `12-UAT.md` item 2, `12-VALIDATION.md:107` and `:160`, `12-VERIFICATION.md` frontmatter (`superseded:` key on the item-2 human_verification entry) and prose (`#### 2.` section), `REQUIREMENTS.md:759`, `STATE.md:105-111` -- all supersede-in-place, original text intact alongside the new run IDs. Confirmed `12-VALIDATION.md:104` (a DIFFERENT XOS-05 row, closed on run `30586177358` for `[remote cache]` per-leg counts) was correctly left untouched. **Accounting note:** the plan's own must_haves truth #6 text says "six claims... two of those files carrying two claims each," which arithmetically is 1(UAT)+2(VALIDATION)+2(VERIFICATION)+1(REQUIREMENTS)+1(STATE) = 7, not 6. This inconsistency is in the PLAN's own prose (repeated in Task 3's action block, which also says "SIX closure claims" then lists a 6-item "sites" list whose item 4 covers two physical locations) -- it is not something the executor introduced, and the executor implemented all 7 physical edits correctly and consistently with the verification gates, which assert by COUNT (2 and 2) rather than by the prose number. Not a gap; a pre-existing label/count mismatch in the plan text. |
| 7 | No verdict written that the runs did not produce; unexpected outcome recorded as actual result or PENDING | VERIFIED | `## What this does NOT prove` section exists in EVIDENCE.md (confirmed present, 7 substantive bullets, not boilerplate). A2 ("a created run is pinned at creation") is stated as "STILL CARRIED" / "precedent-backed... NOT documented" in the Assumptions Carried table, never asserted as settled fact. All four `VERDICT` lines independently cross-checked against the runs I fetched myself: `PASS-DIRECTION: CLOSED` matches the GREEN run's success + genuine four-target Nx line; `FAIL-DIRECTION: CLOSED` matches the RED run's failure + three-target Nx line + absent-needle + exit-1; `A1-BODY-PROVENANCE: CLOSED` matches the step-name discriminator; `NX-EXIT-IN-RED-STEP: 0` matches the plural success summary preceding the exit-1 line. No fallback path fired (A3's `lint` fallback was not needed -- confirmed `lint` executing in the GREEN log at line 173). |

**Score:** 7/7 must-have truths independently verified.

## Deviations Assessment

### Deviation 1 (pre-flight): `git status --porcelain` was not empty

**Claim:** the dirty path was the orchestrator's own uncommitted revision of `260803-mew-PLAN.md`
(pre-dating this agent's dispatch), and the gate's intended property -- that the plumbing procedure
never touches the working tree or index of code under test -- held anyway.

**Independently checked:** `git diff` of the still-uncommitted `260803-mew-PLAN.md` (it remains dirty
in the working tree at verification time) shows exactly the described edit: the "Phase branch tip and
local HEAD" row split into separate REMOTE-tip / local-HEAD rows, and `read-tree HEAD` changed to
`read-tree 41f65e1...` at STEP 5 -- matching the SUMMARY's description precisely. `git status
--porcelain` at verification time shows nothing dirty under `.github/`, `packages/`, or `nx.json`.
**Assessment: honest and harmless.** The gate as literally written would indeed fail on this input
(its filter only strips `^\?\? \.planning/quick/260803-mew` lines, and a modified-tracked-file line
reads `M ...`, not `?? ...`); the substantive property was independently proven via the diff, not
merely asserted.

### Deviation 2 (Task 1 STEP 8, restore check iii): literal command aborts

**Claim:** `git diff --exit-code origin/main refs/backups/main-pre-window-260803-mew` fails with
`unknown revision` because `refs/backups/*` is a remote namespace no local refspec fetches; the
executor fetched into `FETCH_HEAD` and diffed against that instead.

**Independently reproduced:** ran the exact literal command myself --
`git diff --exit-code origin/main refs/backups/main-pre-window-260803-mew` -> `fatal: ambiguous
argument 'refs/backups/main-pre-window-260803-mew': unknown revision or path not in the working tree`
(exit 128). Confirmed the failure is real and structural (the ref is deleted now, but the underlying
reason -- no local refspec maps `refs/backups/*` -- would apply even if it existed).
**Assessment: honest and harmless.** The substitute check (fetch to `FETCH_HEAD`, diff against that)
compares the identical objects the plan intended; this is a deviation of form, not of substance, and
was disclosed in both EVIDENCE.md and SUMMARY.md.

## Additional Independent Finding (outside the must_haves scope)

**The restore push (STEP 7) fired a full `ci.yml` run on `main` that neither EVIDENCE.md nor
SUMMARY.md mentions.** `gh run list --repo op-nx/github-cache --workflow ci.yml ...` surfaced run
`30825636788`, `event: push`, `headBranch: main`, `headSha: fe25a3f865f20f3d4f8a40e96f8cb5717608ba8a`,
created `2026-08-03T15:03:11Z` (immediately after the RED dispatch and coincident with the SUMMARY's
own stated restore timing) -- overall `conclusion: failure`. Unlike the STEP 2 plumbing push, this
force-push restores an **already-existing** commit whose message the operator does not control and
which carries no `[skip ci]` token, so `push: branches: [main]` fired the full pipeline (11+ jobs).

Traced the failure: both `publish (windows-11-arm)` and `publish (ubuntu-24.04-arm)` jobs failed.
Fetched the Windows publish job's raw log myself -- it attempted a real write against the live repo:
`GET .../releases/tags/cache-mirror-202608` -> 404, `POST .../releases` -> **422**, then a second GET
still 404, then `##[error]Not Found`.

**Verified this is a pre-existing, already-tracked bug, not a regression from this task.** Checked an
unrelated `main`-push CI run from hours earlier the same day (`30808393246`, 11:09:17Z, cited in
EVIDENCE.md itself as the "most recent CI run on main" before the plumbing push) -- it shows the
identical failure shape: both `publish` jobs failed. `.planning/STATE.md`'s `260802-toz` entry
independently documents this exact class of bug ("the August shard holds ZERO assets, every asset
upload returned 422 and was swallowed as benign") and commit `1e5bc10` (`fix(publish): skip a burned
month-shard tag instead of failing the run`, on the phase branch, not yet on `main`) is an in-flight
fix for it.

**Why this is flagged as human_needed rather than a gap against 260803-mew's must_haves:** none of
the seven must_have truths above claim "the restore triggers no CI side effects" -- T-mew-03's threat
disposition explicitly covers the plumbing push (`[skip ci]`) and the throwaway push (confirmed no
run fires), but is silent on the restore push, which structurally cannot carry `[skip ci]` because it
force-pushes a pre-existing commit. The five stale `refs/backups/*` already on origin imply five prior
windows used this same restore mechanism, so this is very likely a systemic, repeated, previously
unflagged side effect of every "temporary main window" this project has run -- worth a maintainer
decision on whether to accept it as an unavoidable cost or design around it, but it is not evidence
that 260803-mew failed its stated goal, and it introduced no new regression to `main` (the pipeline
result is byte-identical in kind to `30808393246`'s failure hours earlier).

## Gaps Summary

No must-have truth failed. All 7 independently verified against live GitHub state and raw step logs,
not against SUMMARY.md's narration. Both documented deviations are honest and preserve the
substantive property each gate exists to protect. The six-vs-seven accounting note is a label
inconsistency inside the PLAN's own prose, not an execution gap -- the executor's work matches the
plan's count-based verification gates exactly.

The one item routed to human verification is a real, independently-verified, previously undisclosed
side effect (a live `ci.yml` run including a failed live "publish" write attempt, triggered by the
restore push) -- but it is a pre-existing, already-tracked bug unrelated to the detector work this
task set out to observe, and does not indicate the task's stated goal was not achieved.

## Human Verification Required

### 1. Restore-triggered CI run: accept as a known systemic cost, or change the runbook?

**Test:** Review run `30825636788` (`gh run view 30825636788 --repo op-nx/github-cache`) and decide
whether future backup-and-restore windows (`12-UAT.md:78-95`'s procedure, reused verbatim here and in
at least four prior windows per the stale `refs/backups/*` refs) should account for the restore push
firing a full `ci.yml` run.
**Expected:** A maintainer decision -- either accept the residual (main only ever contains `fe25a3f`,
whose message cannot be changed to carry `[skip ci]` on a re-push) or adopt a mitigation (e.g.,
restore via a different mechanism, or simply document the cost in the runbook).
**Why human:** Not a defect of this task and not covered by any of its must_haves. The specific
failure is independently confirmed pre-existing (identical shape hours earlier in run `30808393246`,
and already tracked in `STATE.md`'s `260802-toz` entry with an in-flight fix on the phase branch) --
so no new regression exists -- but the side effect itself (an unplanned CI run, including a live
publish write attempt against the production repo) was never observed or disclosed by EVIDENCE.md or
SUMMARY.md, and is exactly the class of thing T-mew-03's threat entry addresses for the other two
pushes in this same procedure.

---

_Verified: 2026-08-03_
_Verifier: Claude (gsd-verifier)_
