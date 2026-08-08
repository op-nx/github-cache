---
quick_id: 260802-toz
type: execute
description: >-
  Close Case B and RESEARCH assumption A1 by live observation, during the
  temporary maintainer-authorised push of Phase 13 to `main`.
phase: 13-read-only-actions-cache-backend
wave: 1
depends_on: []
autonomous: false
requirements: [XOS-09, TEST-11]
files_modified:
  - .planning/phases/13-read-only-actions-cache-backend/13-EVIDENCE.md
  - .planning/phases/13-read-only-actions-cache-backend/13-VALIDATION.md
  - .planning/ROADMAP.md

must_haves:
  truths:
    - >-
      Run 30767511870's three ubuntu producers are MEASURED to have SAVED into
      main's default-branch scope, with their `nx-cache-<H>` keys recorded --
      before any observation branch is pushed.
    - >-
      Both observations are PRE-REGISTERED in `13-EVIDENCE.md` in a commit that
      precedes the runs that measure them.
    - >-
      Observation 1 runs on a `.planning/**`-only PR off `main` whose ubuntu
      producers HIT and emit ZERO `Sent <n> of <n>` lines, and whose Windows
      legs restore the SAME `nx-cache-<H>` keys the baseline recorded.
    - >-
      Observation 2 runs on a perturbed throwaway branch where
      `typecheck-windows` counts exactly 1, stays GREEN, and its Nx output is
      captured VERBATIM around the refused store.
    - >-
      Every claim names the run id, the job, and the log line it was read from;
      every write-up states what the observation does NOT prove.
    - >-
      Both throwaway branches are closed and deleted; no perturbation is an
      ancestor of any retained ref.
  artifacts:
    - .planning/phases/13-read-only-actions-cache-backend/13-EVIDENCE.md
  key_links:
    - >-
      Baseline keys from run 30767511870 <-> the keys the Case-B Windows legs
      restore. Identity of the key IS the A2 closure, measured not argued.
    - >-
      Zero `Sent <n> of <n>` on the Case-B run's ubuntu producers <-> the
      merge-ref scope stayed empty, which is what excludes the Case-A path.
    - >-
      Zero 403/forbidden tokens on the two UNPERTURBED Windows legs in
      Observation 2's run <-> the 403 is attributable to the partial miss's PUT
      rather than to ambient log content.
---

<objective>
Close the two OPEN live-CI items on Phase 13 -- Case B (base-scope restore) and RESEARCH
assumption A1 (the PUT 403 path) -- by direct observation, inside the time-boxed window in
which `main` is fast-forwarded to the Phase 13 tip.

Purpose: both items are behavioural and live-CI-only. No spec can close either. This is the
only window in which `main`'s default-branch cache scope holds Phase 13's task hashes, which
is Case B's entire premise.

Output: an `ADDENDUM 3` appended to `13-EVIDENCE.md` (pre-registration half first, observation
half after), status flips on the two Manual-Only rows in `13-VALIDATION.md`, and ROADMAP
Phase 13 Live-CI item 2 closed or recorded as not-holding.
</objective>

<context>
@.planning/phases/13-read-only-actions-cache-backend/13-EVIDENCE.md
@.planning/phases/13-read-only-actions-cache-backend/13-VALIDATION.md
@.planning/ROADMAP.md
@.github/workflows/ci.yml
</context>

<house_standard>
Non-negotiable, and it governs every line written by this plan.

1. **A green is not evidence unless the thing it claims could have failed.** Name, in advance,
   the observation that would have falsified the claim.
2. **Measured, never inferred.** Every number carries a run id, a job name, and the log line it
   came from.
3. **State what the observation does NOT prove.** Over-reading a green is the mistake CR-18
   caught, and it is the reason Phase 13 exists.
4. **A MISS carries no information on its own.** Only a non-zero gate count or an explicit
   `[remote cache]` label discriminates.
5. **A red job is NOT proof a gate fired.** `ci.yml:543` is a pre-existing bare `exit 1` in the
   readiness poll inside EVERY Windows job block. Always confirm WHICH STEP failed via the jobs
   API before attributing a red.
6. **Append to `13-EVIDENCE.md`; never back-edit it.** A prediction that turns out wrong is
   recorded as wrong. `09-EVIDENCE.md` OBS-04 is the precedent and it is worth more than a
   claimed pass.
7. **A deviation is a FINDING, not a reason to re-run or to adjust the predicted number.**

Counting: `rg -o -F "[remote cache]" <log> | wc -l`. NEVER `rg -c` (counts lines). `-F` is
mandatory (square brackets are a character class). Read the EXIT CODE -- `2` means the command
FAILED while printing nothing, which is indistinguishable from a genuine zero if only stdout is
read. Prefer the leg's own printed
`remote-cache label occurrences on windows-11-arm (<target>): <n>` line over any recount: the
job log carries the gate's own echoed shell body and reads +2 per leg (recorded in this file's
"A PREDICTION THAT DID NOT HOLD" section).
</house_standard>

<sequencing>
**The two observations MUST be separate PRs.** Confirmed, and the reason is stronger than
stated in the brief: Observation 2's perturbation rotates the `build` and `typecheck` hashes,
which destroys Case B's unrotated-hash premise; and it edits `ci.yml`, which is a declared
`test` input, so it rotates `test` too. A single PR carrying both would be Case A on all three
legs and would prove neither item.

**They CAN and SHOULD run CONCURRENTLY, as two separate PRs pushed in the same pass.** This is
safe and it halves the rewritten-`main` window:

- `ci.yml:34-36` sets `concurrency: group: ci-${{ github.ref }}`, keyed on the ref, so two
  distinct PR branches occupy two distinct groups and neither cancels the other.
- A PR run writes ONLY into its own `refs/pull/<N>/merge` scope. GitHub's documented rule,
  quoted in `13-RESEARCH.md` Q4: an entry created on a PR "cannot be restored by the base
  branch or other pull requests targeting that base branch." So Observation 2's saves are
  unreachable from Observation 1's run, and vice versa.
- Neither PR writes into `main`'s scope, so neither disturbs the baseline the other reads.

Ordering that IS load-bearing:

1. Task 1 (baseline + pre-registration) commits BEFORE either branch is pushed.
2. `main` MUST stay at the Phase 13 tip until BOTH runs have completed and their logs have been
   captured. The orchestrator owns the restore and must not start it earlier.
</sequencing>

<tasks>

<task type="auto">
  <name>Task 1: Measure main's base-scope baseline, then PRE-REGISTER both observations (GO/NO-GO gate)</name>
  <files>.planning/phases/13-read-only-actions-cache-backend/13-EVIDENCE.md</files>
  <action>
This task is a GATE. Case B's premise is that `main`'s default-branch scope already holds the
three task-hash entries. That is an assumption until measured, so measure it first. Do NOT open
any PR until this task's GO condition is met.

**Step 1 -- confirm the run's identity.**
`gh run view 30767511870 --json databaseId,event,headSha,status,conclusion,createdAt` and
`gh run view 30767511870 --json jobs -q '.jobs[] | "\(.name)\t\(.conclusion)\t\(.databaseId)"'`.
Record: event MUST be `push`, `headSha` MUST be the commit `main` was fast-forwarded to. Record
the full 40-char sha -- the short form is not a stable identifier in a write-up.

**Step 2 -- prove each ubuntu producer SAVED, and record its key.**
For each of the ubuntu jobs `build`, `typecheck`, `test` on that run, fetch the job log
(`gh run view --job <databaseId> --log`, redirect to a file under the session scratchpad) and
extract, per job:
  - every `Sent <n> of <n> (100.0%)` line -- this is the SAVE, and it is the only proof the
    entry reached main's scope;
  - every `nx-cache-[0-9]+` token (`rg -o -N "nx-cache-[0-9]+" <logfile>`), de-duplicated;
  - the `Cache: <n>/<n> hit` summary line.

Build a table: target -> `nx-cache-<H>` key -> bytes sent -> which job saved it. Expect the
documented `build`-hash race between the ubuntu `build` and `typecheck` jobs (13-EVIDENCE.md
records it resolving to the `typecheck` job on run 30744366870). EITHER resolution is fine; the
only thing that matters is that each of the three keys was SAVED by SOME ubuntu job on this run.

**GO condition:** all three targets have a recorded key AND at least one `Sent <n> of <n>` line
attributable to them.
**NO-GO:** if a target shows a HIT with no save anywhere on the run, that entry did NOT come
from this run. Investigate where it did come from before proceeding -- do not assume it is in
main's scope. If any target cannot be baselined, record it as a FINDING and drop that target
from Observation 1's claim rather than weakening the claim to fit.

**Step 3 -- pre-check assumption A2 locally (a-priori half).**
Per ROADMAP Phase 13 Live-CI item 2 step (a): `npx nx show project github-cache --json` and
confirm no `.planning` path appears in the declared inputs of `build`, `typecheck` or `test`.
Optionally strengthen this with `capture-hashes.mjs` -- read its usage block at the head of the
file FIRST (it documents flags including `--install-mode`, for which the file states there is
NO default) and do not guess flags. This pre-check is the weak half; A2 is CLOSED post-hoc in
Task 2 by key identity, which is a measurement rather than a reading.

**Step 4 -- write the pre-registration.**
APPEND to `13-EVIDENCE.md` a new section `## ADDENDUM 3 -- Case B and assumption A1, observed
during a temporary maintainer-authorised main push (2026-08-02)`, containing a
`### PRE-REGISTRATION -- committed BEFORE either observation run exists` subsection with:

  - The window context: `main` temporarily fast-forwarded to the Phase 13 tip; backup ref
    `refs/backups/main-pre-phase13-verify` = `fe25a3f865f20f3d4f8a40e96f8cb5717608ba8a`
    (local AND remote); PR #12 CLOSED first so the push could not retroactively mark it merged
    (verified `state=CLOSED mergedAt=null`); the restore is a later, orchestrator-owned step.
    **This record IS PERISHABLE** and that is the opposite of `13-EVIDENCE.md`'s headline
    claim about the original proving run -- say so explicitly. It rests on `main`'s scope
    holding these three entries, a state that is deliberately unwound afterwards.
  - The baseline table from Step 2.
  - **Observation 1 -- the Case-B discriminator, stated as a falsifiable prediction.** A PR off
    `main` touching ONLY `.planning/**`. Predicted: the three ubuntu producers HIT and emit
    ZERO `Sent <n> of <n>`; the three Windows legs print gate counts 1 / 2 / 1 and stay GREEN;
    every restored `nx-cache-<H>` equals a baseline key. Name the falsifier: any ubuntu producer
    that MISSES and SAVES means a hash rotated, A2 is false as stated, the run is Case A, and it
    proves nothing about Case B -- record that as a FINDING, do not re-run.
  - **Observation 2 -- the A1 partial-miss prediction.** Predicted per-leg gate counts
    1 / **1** / 1 (`build-windows` and `test-windows` are the same-run positive control at
    their usual values; `typecheck-windows` drops from 2 to 1). All three GREEN --
    `typecheck-windows`'s 1 clears the floor of 1. `typecheck-windows`'s Nx output shows one of
    its two tasks executing. Exactly one store attempt, refused.
    **The 403 wording is NOT predicted and must not be.** `server/server.ts:129` sets
    `res.statusCode = 403` and calls `res.end()` with an EMPTY BODY and logs nothing, so any
    403-adjacent text in the log is Nx's own reaction to a refused store and its wording is
    UNKNOWN. The observation CAPTURES it verbatim.
  - **What neither observation can prove**, written before the results exist so it cannot be
    trimmed to fit them (carry these forward verbatim into the observation half):
      * Case B cannot distinguish the BASE-branch scope from the DEFAULT-branch scope, because
        for a PR off `main` those are the same ref. What it closes is "restore from a scope
        populated before the run, outside this run's merge ref" -- which is the property the
        gate's soundness needs, but it is narrower than "base branch specifically".
      * Neither observation says anything about PORTABILITY. A restored task does not execute.
      * Neither observation re-proves the gate's fail path (closed separately on run
        30745558383) or the inductive read-only property (which rests on the absent write path,
        not on any run).
      * Observation 2 deliberately EXERCISES the partial-miss blind spot `13-EVIDENCE.md`
        already names as the floor's known cost (a `typecheck-windows` drop from 2 to 1 clears
        the floor and stays green). Demonstrating it must NOT be written up as validating it.

Commit with `git commit -F <msgfile>` -- `git commit -m` fails on this Dev Drive (ReFS,
`COMMIT_EDITMSG: Invalid argument`). Stage the single file by name; never `git add .` / `-A` /
`-u`.
  </action>
  <verify>
    <automated>test $(git grep -c -F "ADDENDUM 3 -- Case B and assumption A1" -- .planning/phases/13-read-only-actions-cache-backend/13-EVIDENCE.md) -ge 1 && git diff --quiet HEAD -- .planning/phases/13-read-only-actions-cache-backend/13-EVIDENCE.md && echo PRE-REGISTERED-AND-COMMITTED</automated>
    <automated>git show --stat --format= HEAD | rg -q "13-EVIDENCE.md" && test $(git show --numstat --format= HEAD -- .planning/phases/13-read-only-actions-cache-backend/13-EVIDENCE.md | cut -f2) -eq 0 && echo APPEND-ONLY-CONFIRMED</automated>
  </verify>
  <done>
The baseline table names all three `nx-cache-<H>` keys with the `Sent <n> of <n>` line that
saved each, read from run 30767511870's own ubuntu job logs. Both observations are
pre-registered with their expected counts, their named falsifiers, and their
does-NOT-prove list. The commit shows ZERO deleted lines in `13-EVIDENCE.md` (append-only) and
lands before any observation branch exists.
  </done>
</task>

<task type="auto">
  <name>Task 2: Observation 1 -- Case B, on a `.planning/**`-only PR off `main`</name>
  <files>.planning/phases/13-read-only-actions-cache-backend/13-EVIDENCE.md, .planning/phases/13-read-only-actions-cache-backend/13-VALIDATION.md, .planning/ROADMAP.md</files>
  <action>
**Step 1 -- build the branch.**
`git fetch origin`, then `git switch -c gsd/13-caseb-basescope-proof origin/main`.
Cherry-pick Task 1's pre-registration commit onto it (`git cherry-pick <sha>`). That commit
touches only `.planning/**`, so it satisfies the premise AND puts the pre-registration inside
the PR's own tree -- the same structural ordering argument `13-EVIDENCE.md` uses for run
30744366870 (the prediction was in the tree the run measured, so it cannot have been written
afterwards).

**Step 2 -- HARD GATE before pushing.** The diff against the merge base must contain ONLY
`.planning/**` paths. If anything else appears, STOP: the premise is broken and the run would
silently be Case A.

**Step 3 -- push and open the PR.**
`git push -u origin gsd/13-caseb-basescope-proof`, then `gh pr create --base main --draft` with
a title and body that say THROWAWAY / DO NOT MERGE and name this plan. Draft PRs do fire
`on: pull_request` here -- established by PR #13 / run 30745558383.

Record the run id and REQUIRE `attempt == 1`. A re-run is disqualified, not merely discouraged:
on attempt 2 the merge-ref scope may hold entries the first attempt saved, and the
"nothing wrote into the merge-ref scope" argument evaporates.

**Step 4 -- read the three ubuntu producer logs (this is the load-bearing half).**
Per ubuntu job `build`, `typecheck`, `test`:
  - `Sent <n> of <n>` occurrences MUST be ZERO. Report the count explicitly, including the `rg`
    exit code, so a zero is distinguishable from a failed command.
  - Record the `Cache hit for: nx-cache-<H>` line and the `Cache: <n>/<n> hit` summary.
  - Each key MUST equal a Task 1 baseline key. **This identity IS the A2 closure**: identical
    keys mean the hashes did not rotate, measured rather than read off an input list.
  - Any producer that MISSES and SAVES falsifies the premise. Record it as a FINDING and stop --
    do not re-run, do not adjust.

**Step 5 -- read the three Windows legs.**
Take each leg's own printed
`remote-cache label occurrences on windows-11-arm (<target>): <n>` line. Expect 1 / 2 / 1, all
GREEN. Record each leg's restored `nx-cache-<H>` key(s) and received byte counts, and tie them
to the baseline entries -- the byte-level tie is the same idiom `13-EVIDENCE.md` used for run
30744366870. If any leg is RED, confirm WHICH STEP failed via
`gh run view --job <id> --json steps` before attributing it -- the readiness poll's bare
`exit 1` at `ci.yml:543` can redden the same job for an unrelated reason.

**Step 6 -- write the observation.**
APPEND a `### OBSERVATION 1 -- Case B` subsection under ADDENDUM 3. Do not edit the
pre-registration. Include: run id + URL + event + headSha + attempt; the three producer HIT
lines with their zero-save counts; the three gate counts; the key-identity table against the
baseline; every deviation recorded as a deviation.

State the verdict in exactly the form the evidence supports:
  - If it held: **Case B: PROVEN.** The Windows legs restored entries that existed before the
    run, in a scope outside this run's merge ref. Nothing wrote into the merge-ref scope during
    the run, so the intra-run merge-ref path (Case A) cannot explain the HIT.
  - Then immediately restate the limits from the pre-registration verbatim, especially that
    base-scope and default-branch-scope are the SAME REF for a PR off `main` and are therefore
    NOT distinguished by this observation.
  - If it did not hold: record it plainly and point at ROADMAP Phase 13 Live-CI item 2's stated
    fallback (gate on `push` only; keep counts as diagnostics on `pull_request`). Note the
    second-order effect the ROADMAP already names: once the legs are read-only a Case-B MISS is
    PERMANENT for that hash on Windows, so it is a hard red, not a first-run-only red.

**Step 7 -- propagate and clean up.**
Update `13-VALIDATION.md`'s Manual-Only row for Case B (status + a forward reference to
ADDENDUM 3) and ROADMAP Phase 13 Live-CI item 2. These are status flips on OPEN items with
forward references, not back-edits of prior claims.
Then: `gh pr close <N>`, `git push origin --delete gsd/13-caseb-basescope-proof`,
`git switch <phase branch>`, `git branch -D gsd/13-caseb-basescope-proof`. Same cleanup
discipline as PR #13. Commit the artifact changes on the PHASE branch (not the throwaway) with
`git commit -F <msgfile>`, staging files by name.
  </action>
  <verify>
    <automated>git switch -c gsd/13-caseb-basescope-proof origin/main 2>/dev/null; git diff --name-only origin/main...HEAD | rg -v "^\.planning/" | wc -l | rg -q "^0$" && echo PLANNING-ONLY-DIFF-CONFIRMED</automated>
    <automated>test $(git grep -c -F "OBSERVATION 1 -- Case B" -- .planning/phases/13-read-only-actions-cache-backend/13-EVIDENCE.md) -ge 1 && echo OBSERVATION-RECORDED</automated>
    <automated>git ls-remote --exit-code --heads origin gsd/13-caseb-basescope-proof; test $? -eq 2 && echo THROWAWAY-BRANCH-DELETED</automated>
  </verify>
  <done>
`13-EVIDENCE.md` carries an `OBSERVATION 1 -- Case B` subsection naming the run id, all three
ubuntu producers' HIT lines with an explicitly-zero save count, the three gate counts, and a
key-identity table tying each restored `nx-cache-<H>` to the Task 1 baseline. The verdict states
what was proven AND that base-scope is not distinguished from default-branch-scope here. The
Case-B rows in `13-VALIDATION.md` and ROADMAP are updated with forward references. Draft PR
closed, branch deleted locally and on the remote.
  </done>
</task>

<task type="auto">
  <name>Task 3: Observation 2 -- assumption A1, via a partial miss on `typecheck-windows`</name>
  <files>.planning/phases/13-read-only-actions-cache-backend/13-EVIDENCE.md, .planning/phases/13-read-only-actions-cache-backend/13-VALIDATION.md</files>
  <action>
**The mechanism, stated so the perturbation is not mistaken for arbitrary.** `npm run typecheck`
resolves TWO tasks -- `build` plus `typecheck` -- which is why this leg's gate count is 2 while
the other two are 1. The gate is `if [ "${count}" -lt 1 ]`, a FLOOR, so 1 PASSES. Force exactly
one of the two tasks to MISS and the leg stays GREEN while executing a task, which attempts one
store, which the read-only backend's server refuses with 403. Both edits below are required and
neither alone suffices: without the source touch, `typecheck` HITs from `main`'s base scope
(count 2, no PUT); without the ci.yml edit, some producer saves `typecheck` (count 2, no PUT).

**Step 1 -- build the branch off `origin/main`:** `gsd/13-a1-403-proof`. Two edits:

  a. **Rotate the `build` and `typecheck` hashes.** Add a one-line comment to a non-spec
     `packages/github-cache/src/**/*.ts` file that is a declared `build` input --
     `backend/memory-backend.ts` is the suggested target. Mark it inline as a throwaway
     perturbation. `typecheck` rotates transitively via `build`'s declaration outputs
     (`dependentTasksOutputFiles`).
  b. **Starve the `typecheck` entry.** In the ubuntu `typecheck` JOB (job key at `ci.yml:328`),
     change `- run: npm run typecheck` (`ci.yml:396`) to `- run: npm run build`, with an inline
     throwaway marker comment. The job then resolves only `build`, so NO producer ever saves
     `typecheck`. Change nothing else -- leave the sidecar block, the `needs:` edges and all
     three Windows job blocks untouched.

Rejected alternative, recorded so it is not re-raised: adding `CACHE_READ_ONLY=1` to the ubuntu
`typecheck` job is a smaller one-line edit and starves the entry the same way, but it makes the
ubuntu leg 403 as well. That gives a SECOND 403 source in the same run and muddies "exactly one
403", which is the observation condition as written. Rejected on attribution, not on size.

**Step 2 -- LOCAL PRE-FLIGHT, before pushing anything.** Fifteen spec files read `ci.yml` from
disk. Run `npx nx test github-cache --skip-nx-cache` from the MAIN tree. It MUST be green. If a
spec pins the ubuntu `typecheck` job's run line, the ubuntu `test` job would go red in CI,
`test-windows` (`needs: test`) would never run, the positive control would be lost, and the run
would be red for the wrong reason. `--skip-nx-cache` is mandatory: LINT-04 exists because this
repo has shipped a stale-cache false PASS.

**Step 3 -- push, open a draft PR** (`--base main --draft`, THROWAWAY / DO NOT MERGE in the
title). Record the run id; REQUIRE `attempt == 1`.

**Step 4 -- read the three Windows legs.** Pre-registered signature:

| Leg | Perturbed | Predicted gate count | Predicted job |
|---|---|---|---|
| `build-windows` | no (control) | 1 | success |
| `typecheck-windows` | YES (partial miss) | **1** | **success** |
| `test-windows` | no (control) | 1 | success |

The two controls at their usual values in the SAME run are what make the `typecheck-windows`
result attributable to the partial miss rather than to the runner, the queue or an
`@actions/cache` regression -- this repo's TEST-09 idiom, and the same structure the gate
fail-path proof used on run 30745558383.

Confirm the partial miss is REAL, not assumed: `typecheck-windows`'s Nx output must show the
`build` task restored AND the `typecheck` task EXECUTING (its own
`> tsc --build tsconfig.json --emitDeclarationOnly` command line), plus an
`N out of M tasks` restored summary with N < M.

**Step 5 -- CAPTURE the 403 path verbatim. Do not assert its wording.**
Over `typecheck-windows`'s job log, scan for and quote the surrounding lines of every match of:
`403`, `forbidden`, `Failed to store`, `Failed to save`, `NX Warning`, `NX Error`,
`Cache upload`, `##[warning]`, `##[error]`. Report each match WITH CONTEXT and with the `rg`
exit code. Exclude the known false positives `13-EVIDENCE.md` already documented: `403`
substrings inside ISO timestamps and toolcache paths -- name each exclusion rather than
silently filtering it.

Run the SAME scan over `build-windows` and `test-windows` as the NEGATIVE CONTROL. Those legs
fully HIT, so they attempt no store and must show zero genuine matches. That contrast is what
attributes the text to the refused PUT instead of to ambient log content.

Also record the count of store attempts on the perturbed leg: `Sent <n> of <n>` MUST be zero
(the backend has no write path; the refusal happens at the protocol boundary, not in a `put()`
return value).

**Named risk, recorded in advance.** If `typecheck` FAILS when it executes on Windows, Nx does
not store a failed task, no PUT is attempted, no 403 occurs, and the job reddens at the tee'd
target step rather than at the gate. Confirm the failing step via
`gh run view --job <id> --json steps`. That outcome is a MAJOR finding in its own right -- a
genuine Windows-only defect that `13-EVIDENCE.md` explicitly says this gate cannot see -- and
A1 stays OPEN. Record it as such; do not retry into a different shape.

**Step 6 -- write the observation.** APPEND a `### OBSERVATION 2 -- assumption A1, the refused
store` subsection under ADDENDUM 3. Include: run id + URL + headSha + attempt; the perturbation
diff summarised precisely (two edits, named); the three counts against their pre-registration;
the partial-miss proof lines; the captured text VERBATIM; the negative-control result on the
two unperturbed legs.

Verdict, in the form the evidence supports:
  - If Nx tolerated the refusal: **A1: CONFIRMED, by observation.** Quote the exact output so a
    future reader can recognise it, and record whether it is confusing enough to justify the
    `OBS` requirement RESEARCH open question 3 deferred ("observe first, build only if the log
    is actually confusing"). Answer that question explicitly rather than leaving it implied.
  - If Nx failed the build or emitted an error annotation: **A1: FALSIFIED.** That is a finding
    about the shipped read-only posture, not a reason to re-run.

Then restate, verbatim from the pre-registration, that this observation deliberately exercises
the partial-miss blind spot the floor already has by design (D-05), and that demonstrating it
is NOT validating it.

**Step 7 -- update `13-VALIDATION.md`'s A1 Manual-Only row** with the outcome and a forward
reference to ADDENDUM 3. Clean up exactly as PR #13 was cleaned up: `gh pr close <N>`, delete
the branch on the remote and locally, and verify the perturbation is an ancestor of NO retained
ref. Commit the artifact changes on the PHASE branch with `git commit -F <msgfile>`, staging by
name.
  </action>
  <verify>
    <automated>npx nx test github-cache --skip-nx-cache</automated>
    <automated>test $(git grep -c -F "OBSERVATION 2 -- assumption A1" -- .planning/phases/13-read-only-actions-cache-backend/13-EVIDENCE.md) -ge 1 && echo OBSERVATION-RECORDED</automated>
    <automated>git ls-remote --exit-code --heads origin gsd/13-a1-403-proof; test $? -eq 2 && echo THROWAWAY-BRANCH-DELETED</automated>
    <automated>git log --oneline --all | rg -q "a1-403-proof" && echo PERTURBATION-STILL-REACHABLE-INVESTIGATE || echo NO-PERTURBATION-ON-RETAINED-REFS</automated>
  </verify>
  <done>
The local suite was green with the perturbation applied BEFORE anything was pushed.
`13-EVIDENCE.md` carries an `OBSERVATION 2 -- assumption A1` subsection naming the run id, the
three gate counts against a pre-registration of 1 / 1 / 1, proof that `typecheck-windows`
genuinely partial-missed (one task restored, one executed), the captured refusal text VERBATIM
with its `rg` exit codes, and a zero-match negative control on the two unperturbed legs. A1 is
recorded as CONFIRMED or FALSIFIED with the evidence for whichever, and RESEARCH open question 3
is answered explicitly. Draft PR closed, branch gone locally and remotely, no perturbation
reachable from any retained ref.
  </done>
</task>

</tasks>

<verification>
1. `13-EVIDENCE.md` gained exactly one `## ADDENDUM 3` with three subsections in this order:
   PRE-REGISTRATION, OBSERVATION 1, OBSERVATION 2. Zero deleted lines across all commits of this
   plan: `git diff <pre-plan sha> HEAD --numstat -- <13-EVIDENCE.md>` shows a deletion count of 0.
2. Every count in the write-up is the leg's own printed gate line, not a recount of the job log
   (which reads +2 per leg for the documented echo reason).
3. Every red job that appears is attributed to a NAMED step via the jobs API, never to the job
   as a whole.
4. Both throwaway branches are gone locally and on the remote; both draft PRs are CLOSED, never
   merged.
5. `13-VALIDATION.md`'s two OPEN Manual-Only rows (Case B, A1) each carry an outcome and a
   forward reference to ADDENDUM 3.
6. No change reached the phase branch's `ci.yml`, `src/`, or any spec. `git diff origin/main...HEAD
   --name-only | rg -v "^\.planning/"` is empty on the phase branch.
</verification>

<success_criteria>
- Case B is closed by measurement (key identity against a pre-run baseline, plus zero merge-ref
  saves) or recorded as not-holding with the ROADMAP fallback named.
- A1 is closed by capturing the refused store's actual output, with a same-run negative control,
  or recorded as still-open with the specific reason the path did not execute.
- Every claim names run id, job and log line. Every write-up states what it does NOT prove.
- Nothing merged, nothing left behind, and `main` is still at the Phase 13 tip when this plan
  returns (the restore is the orchestrator's step, after).
</success_criteria>

<output>
Both observations are recorded in
`.planning/phases/13-read-only-actions-cache-backend/13-EVIDENCE.md` under ADDENDUM 3. Report
the two run ids to the orchestrator and signal that `main` may now be restored.
</output>
