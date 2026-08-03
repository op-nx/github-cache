---
phase: 260803-mew
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/quick/260803-mew-observe-phase-12-fail-half-on-real-run/260803-mew-EVIDENCE.md
  - .planning/phases/12-windows-ci-reuse-o4-consumer-recipe/12-UAT.md
  - .planning/phases/12-windows-ci-reuse-o4-consumer-recipe/12-VALIDATION.md
  - .planning/phases/12-windows-ci-reuse-o4-consumer-recipe/12-VERIFICATION.md
  - .planning/REQUIREMENTS.md
  - .planning/STATE.md
autonomous: true
requirements: [D-1, D-2, D-3, D-4, D-5]

must_haves:
  truths:
    - "D-1: the detector's PASS half is observed on a real windows-11-arm runner against the FOUR-target needle at HEAD, not the superseded three-target needle."
    - "D-2 + D-5: the RED run's guarded step fails at the needle's grep while the nx command in that SAME step exited 0, proven by the plural three-target Nx line being present as genuine Nx output and by the step's terminal exit-code-1 line."
    - "A1 is closed by measurement, not assumed: the RED run's step NAME carries the throwaway mutation, proving the workflow BODY came from the dispatched ref rather than from main."
    - "D-3: the mutation exists only on a throwaway remote branch, which is deleted; neither the phase branch nor main ever carries it, and no ci.yml run is triggered by the throwaway push."
    - "D-4: main is restored to fe25a3f865f20f3d4f8a40e96f8cb5717608ba8a and the restore is proven three ways (remote SHA equality, detector file 404 on main, empty diff against the backup ref) before the task reports success."
    - "Every CLAIM that currently reads as CLOSED on the superseded three-target needle carries a forward pointer to the new run IDs -- six claims across five artifacts, two of those files carrying two claims each -- with the old claim preserved rather than deleted (D-21 / 12-PATTERNS.md S-1)."
    - "No verdict is written that the runs did not produce: an unexpected outcome is recorded as the actual result or PENDING."
  artifacts:
    - .planning/quick/260803-mew-observe-phase-12-fail-half-on-real-run/260803-mew-EVIDENCE.md
  key_links:
    - "plumbing commit on main -> workflow re-registers in gh workflow list -> the dispatch API accepts the call at all (F-2: the workflow record is currently state:deleted)."
    - "dispatched --ref -> the tree actions/checkout reads AND (unproven, A1) the workflow body executed -> the step-name discriminator is the only thing that tells the two apart."
    - "dropping test from the -t list -> windows-regression-detector.spec.ts:154 never runs -> nx stays at exit 0 -> the RED is attributable to the grep (F-3)."
    - "both runs CREATED -> main restored -> exposure window closed while the RED run is still in flight (A2, precedent-backed)."
---

<objective>
Observe BOTH directions of the Phase 12 Windows regression detector gate on a real
`windows-11-arm` runner, against the FOUR-target needle that exists at HEAD.

Purpose: the detector's FAIL half has only ever been measured on this workstation, and the
one PASS half on record (`30603713356`) pins the SUPERSEDED three-target needle that `9e79009`
replaced. So the gate as it exists at HEAD has never run on a real runner in either
direction.

Output: `260803-mew-EVIDENCE.md` recording both runs at STEP granularity, plus forward
pointers on the six claims (across five artifacts) that currently read as closed on the superseded
needle.
</objective>

<execution_context>
@~/.claude/gsd-core/workflows/execute-plan.md
@~/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/quick/260803-mew-observe-phase-12-fail-half-on-real-run/260803-mew-CONTEXT.md
@.planning/quick/260803-mew-observe-phase-12-fail-half-on-real-run/260803-mew-RESEARCH.md
@.github/workflows/windows-regression-detector.yml
@.planning/phases/12-windows-ci-reuse-o4-consumer-recipe/12-UAT.md
@.planning/phases/13-read-only-actions-cache-backend/13-VERIFICATION.md
</context>

## Decision Coverage

- **D-1:** Task 1 dispatches the GREEN against the phase branch at `41f65e1` so the FOUR-target
  needle at HEAD gets its first real-runner PASS observation, alongside the RED.
- **D-2:** Task 1's throwaway mutation runs 3 of the 4 needled targets (`-t build typecheck lint`),
  so `nx` exits 0 and the RED comes from the needle rather than from an exit code.
- **D-3:** Task 1 keeps the mutation on `throwaway/detector-red-260803-mew` only, built by git
  plumbing so the working tree and index are never touched, and deletes the branch in task 2.
- **D-4:** Task 1 reuses the `12-UAT.md:78-95` backup-and-restore verbatim, with the three-way
  restore verification as the task's blocking gate.
- **D-5:** Task 2 reads both runs at STEP granularity and records the three F-6 log facts plus the
  step-NAME discriminator; run colour alone is never accepted as evidence.

## Operator authorisation (recorded 2026-08-03, interactive session)

The maintainer was shown the five remote operations VERBATIM -- including the exact
`git push --force-with-lease=main:<plumbing-sha> origin
fe25a3f865f20f3d4f8a40e96f8cb5717608ba8a:refs/heads/main` invocation, named as a rewrite of the
DEFAULT branch tip of a PUBLIC repository -- and authorised all five:

1. backup `main` to `refs/backups/main-pre-window-260803-mew`
2. fast-forward push of the one-file `[skip ci]` plumbing commit to `refs/heads/main`
3. push `refs/heads/throwaway/detector-red-260803-mew` carrying the 3-of-4 mutation
4. **force-push restoring `main` to `fe25a3f`** (the destructive step)
5. delete the backup ref and the throwaway branch

This authorisation is SCOPED to exactly these five operations on
`refs/heads/main`, `refs/backups/main-pre-window-260803-mew` and
`refs/heads/throwaway/detector-red-260803-mew`. It does NOT extend to any other ref, to the phase
branch, to PR #16, or to a second window. Any deviation stops and re-asks.

## Entry state (re-measure before starting; abort if any value moved)

| Fact | Expected value |
| --- | --- |
| `main` | `fe25a3f865f20f3d4f8a40e96f8cb5717608ba8a`, detector file ABSENT |
| Phase branch tip and local HEAD | `41f65e1b2ae7058e85580eff0eb97bb784d7726c` |
| Detector blob at HEAD | `b2ff9f33279229ed2abc3105bf1cb260a617262e` |
| `git status --porcelain` | only the untracked quick-task directory |
| `git config user.email` | `larsbrinknielsen@gmail.com` (public repo; the plumbing commit lands on a public default branch) |

<tasks>

<task type="auto">
  <name>Task 1: Run the main window -- backup, plumbing commit, both dispatches, restore, verify</name>
  <files>.planning/quick/260803-mew-observe-phase-12-fail-half-on-real-run/260803-mew-EVIDENCE.md</files>
  <action>
Execute the operator-authorised single `main` window. Every step is remote-only plumbing: the
working tree and the index are NEVER touched (D-3, D-4). Record each measured value into
`260803-mew-EVIDENCE.md` as you go, under a `## Window log` section, so the run IDs are durable
before the restore is attempted.

CRASH RECOVERY, read this first. Between STEP 2 and STEP 7 the default branch of a PUBLIC
repository carries an unexpected commit for 5-10 minutes. If this task is interrupted after STEP 2
and before STEP 7 completes, a resuming session's FIRST action is `git ls-remote origin main`; if
it is not `fe25a3f865f20f3d4f8a40e96f8cb5717608ba8a`, restore it immediately, regardless of
in-flight run status. Losing a run is cheap and repeatable; leaving a public default branch
rewritten is neither.

PRE-FLIGHT. Re-measure every row of the entry-state table above. `git ls-remote origin main`,
`git ls-remote origin refs/heads/gsd/v0.0.2-os-invariant-cross-os-sharing`, `git rev-parse HEAD`,
`git rev-parse HEAD:.github/workflows/windows-regression-detector.yml`, `git status --porcelain`,
`git config user.email`. If any value differs from the table, STOP and report -- the research is
dated 2026-08-03 and its SHAs are the plan's foundation. The email check is not ceremonial: this
plumbing commit lands on the default branch of a PUBLIC repository.

STEP 1 -- BACK UP. `git push origin fe25a3f865f20f3d4f8a40e96f8cb5717608ba8a:refs/backups/main-pre-window-260803-mew`
then verify with `git ls-remote origin refs/backups/main-pre-window-260803-mew`. The name is NEW on
purpose: five stale `refs/backups/*` from prior windows already sit on origin at the same SHA
(F-5), so reusing a name would overwrite an existing pin. Do not clean the strays up -- out of
scope; note their existence in the artifact in one line.

STEP 2 -- BUILD AND PUSH THE PLUMBING COMMIT. The blob already exists at
`b2ff9f33279229ed2abc3105bf1cb260a617262e`, so no `hash-object` is needed. Use a temp
`GIT_INDEX_FILE` pointed OUTSIDE the repo (the session scratchpad), then: `git read-tree
fe25a3f865f20f3d4f8a40e96f8cb5717608ba8a`; `git update-index --add --cacheinfo
100644,b2ff9f33279229ed2abc3105bf1cb260a617262e,.github/workflows/windows-regression-detector.yml`;
`git write-tree`; `git commit-tree <tree> -p fe25a3f865f20f3d4f8a40e96f8cb5717608ba8a -F <msgfile>`
with a message written by the Write tool whose SUBJECT carries `[skip ci]` (F-7: a push to `main`
otherwise fires `ci.yml`, and the prior window's `d043eec` used exactly this). Push with
`git push origin <plumbing-sha>:refs/heads/main`. Record the plumbing SHA.

STEP 3 -- CONFIRM RE-REGISTRATION. `gh workflow list --repo op-nx/github-cache` must now list the
detector. Until the plumbing commit lands, its workflow record is `state: deleted` (F-2) and the
dispatch API will not resolve it. Resolve by FILE NAME in every dispatch below, never by the
numeric id.

STEP 4 -- DISPATCH THE GREEN (D-1). `gh workflow run windows-regression-detector.yml --repo
op-nx/github-cache --ref gsd/v0.0.2-os-invariant-cross-os-sharing`. Capture the run id from
`gh run list --workflow windows-regression-detector.yml --repo op-nx/github-cache --json
databaseId,headSha,event,createdAt --limit 5`, selecting the entry whose `headSha` is `41f65e1...`.
WAIT for completion (poll `gh run view <id> --json status,conclusion`; budget ~4 minutes, the
prior run was 3m53s). Confirm `conclusion: success` AND that `lint` executed -- assumption A3 says
`lint` on `windows-11-arm` is unproven, since `30603713356` predates `lint` joining the set. If the
GREEN reddens ON `lint`, do NOT proceed with the default mutation: switch to F-3's documented
fallback (drop `lint` instead, and edit `windows-regression-detector.spec.ts:154` to the
three-target form in the SAME throwaway commit, leaving `MULTI_TARGET_SUCCESS_LINE` at four
targets), and record the switch and its reason in the artifact.

The fallback is a TWO-file commit, and it stays ONE commit built the same plumbing way. Produce
both mutated files in the scratchpad and `git hash-object -w --path <repo-relative-path>` EACH of
them, then inside the temp `GIT_INDEX_FILE`: `read-tree HEAD`, then `update-index --add
--cacheinfo` TWICE -- once for the workflow blob at
`.github/workflows/windows-regression-detector.yml` and once for the spec blob at
`packages/github-cache/src/windows-regression-detector.spec.ts` -- and only THEN a single
`write-tree` and a single `commit-tree`. Do not improvise a second commit or a working-tree edit:
the no-touch guarantee (D-3) holds for the fallback exactly as it does for the default path. Under
the fallback the surviving three-target set is `build, typecheck, test`, so every downstream
expectation about the printed Nx line changes accordingly -- task 2's gates already tolerate this.

STEP 5 -- BUILD AND PUSH THE THROWAWAY MUTATION (D-2, D-3). Two edits to ONE file, produced without
touching the tracked copy: `git show HEAD:.github/workflows/windows-regression-detector.yml >
<scratchpad>/mutated.yml`, then apply both edits to the SCRATCHPAD copy with the Edit tool.
  (a) the `-t` list drops `test` and keeps argument order: the invocation becomes
      `nx run-many -t build typecheck lint --skip-nx-cache`. Drop `test`, NOT `lint` -- `nx.json:71`
      declares this workflow file as a `test` target input and
      `windows-regression-detector.spec.ts:154` pins the four-target `-t` line against the file on
      disk, so leaving `test` in the list makes the mutated workflow fail its OWN spec, reddens
      `nx`, and voids the proof by making the RED come from an exit code (F-3). Dropping `test` also
      removes the vitest flake surface, removes the longest task, and proves Nx filters an INTERIOR
      element of the needle rather than truncating the tail.
  (b) the step NAME gets the suffix ` -- THROWAWAY 3-of-4 MUTATION` appended. This is the A1
      discriminator (F-1) and it is the whole reason this run can settle which tree supplies the
      workflow BODY: step names appear in the jobs REST payload, so a mutated name on the RED run
      proves body-from-ref, and an UNMUTATED name proves body-from-main and voids the RED instead
      of being misread as "the mutation did not take". The prior window cannot settle this -- its
      two candidate blobs were byte-identical (`5a7d1962...` on both).
The needle line itself stays EXACTLY as at HEAD. Then hash the mutated file with `git hash-object
-w --path .github/workflows/windows-regression-detector.yml <scratchpad>/mutated.yml` -- `--path`
is load-bearing, it applies the `* text=auto eol=lf` clean filter so any CRLF the editor introduced
is normalised. Build the commit the same plumbing way as step 2 but with `read-tree HEAD` and
`-p 41f65e1b2ae7058e85580eff0eb97bb784d7726c`, and push to
`refs/heads/throwaway/detector-red-260803-mew`. Before dispatching, prove the mutation is exactly
the intended two lines: `git diff HEAD:.github/workflows/windows-regression-detector.yml
<throwaway-sha>:.github/workflows/windows-regression-detector.yml`. The push triggers no workflow --
`ci.yml`'s triggers are `push: branches: [main]` plus `pull_request`, and a branch push with no PR
fires neither (F-7) -- confirm this by checking `gh run list --repo op-nx/github-cache --limit 5`
shows no new `CI` run for the throwaway branch.

STEP 6 -- DISPATCH THE RED. `gh workflow run windows-regression-detector.yml --repo
op-nx/github-cache --ref throwaway/detector-red-260803-mew`. Capture its run id the same way.
Do NOT wait for it -- the restore is next, and every extra minute is exposure.

STEP 7 -- RESTORE `main` (D-4). Only now, with BOTH runs CREATED. Use the EXPLICIT lease form, not
the bare flag: `git push --force-with-lease=main:<plumbing-sha> origin
fe25a3f865f20f3d4f8a40e96f8cb5717608ba8a:refs/heads/main`. The bare `--force-with-lease` reads the
local remote-tracking ref, which is untrustworthy here because `main` is never checked out locally
in this procedure. `main` is unprotected and has no rulesets (both verified in F-5b), so the push
is permitted. Note honestly in the artifact that step 7 rests on A2 -- that a created run is pinned
at creation and does not re-read `main` -- which is precedent-backed (3 runs across 2 windows) and
NOT documented.

STEP 8 -- VERIFY THE RESTORE THREE WAYS. This is the task's GATE; the task may not report success
until all three pass. (i) `git ls-remote origin refs/heads/main` equals
`fe25a3f865f20f3d4f8a40e96f8cb5717608ba8a`. (ii) `gh api
"repos/op-nx/github-cache/contents/.github/workflows/windows-regression-detector.yml?ref=main"`
returns 404. (iii) `git fetch origin main` then `git diff --exit-code origin/main
refs/backups/main-pre-window-260803-mew` is empty. Record all three outputs. (iii) is
tautological once (i) passes -- identical SHAs cannot differ in tree -- so record it as
belt-and-braces, not as independent evidence; (i) and (ii) are the load-bearing checks.

STEP 9 -- DELETE THE BACKUP REF. `git push origin :refs/backups/main-pre-window-260803-mew`, and
only after step 8 passed. Leave the throwaway BRANCH alive: the RED run is still in flight and its
checkout resolves against that ref. Task 2 deletes it.

If any step fails, STOP and report the actual state. Never leave `main` carrying the plumbing
commit without saying so in the report.
  </action>
  <verify>
    <automated>git ls-remote origin refs/heads/main | rg -q '^fe25a3f865f20f3d4f8a40e96f8cb5717608ba8a'</automated>
    <automated>gh api "repos/op-nx/github-cache/contents/.github/workflows/windows-regression-detector.yml?ref=main" 2>&amp;1 | rg -q 'Not Found'</automated>
    <automated>test -z "$(git ls-remote origin refs/backups/main-pre-window-260803-mew)"</automated>
    <automated>test -z "$(git status --porcelain | rg -v '^\?\? \.planning/quick/260803-mew')"</automated>
    <automated>rg -c -F 'Window log' .planning/quick/260803-mew-observe-phase-12-fail-half-on-real-run/260803-mew-EVIDENCE.md</automated>
  </verify>
  <done>
`main` is back at `fe25a3f865f20f3d4f8a40e96f8cb5717608ba8a` with the detector file absent and the
new backup ref deleted; the working tree and index were never modified (only the untracked
quick-task directory shows in `git status`); `260803-mew-EVIDENCE.md` records the backup SHA, the
plumbing SHA, both run IDs with their `headSha`, the mutation diff, and all three restore
verification outputs.
  </done>
</task>

<task type="auto">
  <name>Task 2: Read both runs at STEP granularity and write the evidence artifact</name>
  <files>.planning/quick/260803-mew-observe-phase-12-fail-half-on-real-run/260803-mew-EVIDENCE.md</files>
  <action>
Wait for the RED run to complete (`gh run view <red-id> --json status,conclusion`), then read BOTH
runs at STEP granularity and write the observation record. Mirror the FORM of
`13-VERIFICATION.md:126-153` (the "FAIL direction" section): per-job conclusion table, then a
per-STEP table, then the prose that says which step failed and which succeeded.

Step granularity is NECESSARY but NOT SUFFICIENT here, and this is the difference from Phase 13's
XOS-09. There, the gate was its own step, so a red step conclusion attributed the failure by
itself. This detector runs `nx run-many` and the `grep` inside a SINGLE step
(`windows-regression-detector.yml:113-120`), so a red step conclusion cannot on its own distinguish
a failed `grep` from a failed `nx`. Fetch the raw step LOG for the guarded step of the RED run and
record all four of these (F-6, F-1):

  1. The plural THREE-target Nx line ` NX   Successfully ran targets build, typecheck, lint for
     project @op-nx/github-cache` present as genuine Nx output. This is what proves `nx` exited 0:
     with `set -e` and `pipefail`, a non-zero `nx` short-circuits before the `grep` runs and Nx
     prints failure wording instead. Note it is PLURAL (`targets`), which is the strong proof shape
     -- the singular form would indicate only one target resolved.
  2. The four-target needle appearing ONLY on the echoed `grep -q` command line and never as Nx
     output. `12-UAT.md:48-52` records the sibling trap in this exact repository: the echoed shell
     command carries the needle verbatim and is not a marker. Count occurrences and attribute each.
  3. The step's terminal `Process completed with exit code 1.` line.
  4. The step NAME from the jobs payload (`gh api repos/op-nx/github-cache/actions/runs/<id>/jobs
     -q '.jobs[].steps[].name'`). On the RED run it must carry the throwaway suffix, which CLOSES
     assumption A1 by measurement: the workflow BODY came from the dispatched ref. If it carries
     the UNMUTATED name, A1 is FALSIFIED, the RED observation is VOID rather than negative, and
     that is what the artifact must say -- record the actual result, never a verdict the run did
     not produce (12-06's own rule). Do the same read on the GREEN run and record its unmutated
     name as the contrast.

For the GREEN run also record: `conclusion`, `event`, `headSha` (must be `41f65e1...`), the runner
label from the jobs payload, the four-target needle present as genuine Nx output, and that `lint`
executed -- this is the FIRST real-runner observation of the needle at HEAD in either direction
(D-1).

Structure the artifact with: frontmatter (task id, date, both run IDs); a `## Window log` section
(already written by task 1, leave it); `## PASS direction`; `## FAIL direction`; `## A1 --
workflow body provenance`; `## Assumptions carried` (A2 restated as precedent-backed and
undocumented, plus the five stale `refs/backups/*` note); and `## What this does NOT prove`.

THE VERDICT CONTRACT, and it is what this task is verified against. Emit these FOUR lines, each at
the start of its own line, each carrying exactly one enumerated token, in the section it belongs to:

```
VERDICT PASS-DIRECTION: <CLOSED|FALSIFIED|VOID|PENDING>
VERDICT FAIL-DIRECTION: <CLOSED|FALSIFIED|VOID|PENDING>
VERDICT A1-BODY-PROVENANCE: <CLOSED|FALSIFIED|VOID|PENDING>
VERDICT NX-EXIT-IN-RED-STEP: <0|nonzero|UNREADABLE|PENDING>
```

The tokens are the honest-reporting mechanism, not decoration, and the gates assert the ENUMERATION
rather than any particular outcome (must_haves truth #7). Write whichever token the runs actually
produced:
  - `CLOSED` -- the direction was observed as designed.
  - `FALSIFIED` -- the run disproved the thing it was built to prove. This is the live A1 case: an
    UNMUTATED step name on the RED run means the workflow body came from `main`, so the run
    executed the four-target invocation and most likely SUCCEEDED. Then
    `VERDICT A1-BODY-PROVENANCE: FALSIFIED` and `VERDICT FAIL-DIRECTION: VOID` -- there is no
    exit-code-1 line to quote and there must be no pretence that there is.
  - `VOID` -- the run happened but cannot speak to the claim (A1 falsified, a runner fault, an
    unrelated red).
  - `PENDING` -- not observed at all.
A missing, hedged or prose-only verdict FAILS the gate, which is what keeps the enumeration
non-vacuous in both directions. Put `VERDICT A1-BODY-PROVENANCE` on its own line carrying the
token, never as a sentence about the suffix: a negated sentence ("the step name did NOT carry the
suffix") satisfies a bare substring search and this repo has a recorded trap for exactly that
shape. The token, on the verdict line, is the discriminator.

Then delete the throwaway branch: `git push origin :refs/heads/throwaway/detector-red-260803-mew`,
and verify with `git ls-remote origin 'refs/heads/throwaway/*'` returning nothing.

Write with the Write/Edit tools, ASCII only. Use `rg` for every local search -- the `grep` command
and the Grep tool are forbidden for this agent's own shell. The `grep` inside the workflow BODY is
correct and untouched: `windows-regression-detector.yml:109-112` records why the never-use-grep
rule governs the agent's shell and not workflow bodies.
  </action>
  <verify>
    <automated>rg -q '^VERDICT PASS-DIRECTION: (CLOSED|FALSIFIED|VOID|PENDING)\r?$' .planning/quick/260803-mew-observe-phase-12-fail-half-on-real-run/260803-mew-EVIDENCE.md</automated>
    <automated>rg -q '^VERDICT FAIL-DIRECTION: (CLOSED|FALSIFIED|VOID|PENDING)\r?$' .planning/quick/260803-mew-observe-phase-12-fail-half-on-real-run/260803-mew-EVIDENCE.md</automated>
    <automated>rg -q '^VERDICT A1-BODY-PROVENANCE: (CLOSED|FALSIFIED|VOID|PENDING)\r?$' .planning/quick/260803-mew-observe-phase-12-fail-half-on-real-run/260803-mew-EVIDENCE.md</automated>
    <automated>rg -q '^VERDICT NX-EXIT-IN-RED-STEP: (0|nonzero|UNREADABLE|PENDING)\r?$' .planning/quick/260803-mew-observe-phase-12-fail-half-on-real-run/260803-mew-EVIDENCE.md</automated>
    <automated>rg -q -e 'Process completed with exit code 1' -e '^VERDICT FAIL-DIRECTION: (FALSIFIED|VOID|PENDING)\r?$' .planning/quick/260803-mew-observe-phase-12-fail-half-on-real-run/260803-mew-EVIDENCE.md</automated>
    <automated>rg -q '^## What this does NOT prove\r?$' .planning/quick/260803-mew-observe-phase-12-fail-half-on-real-run/260803-mew-EVIDENCE.md</automated>
    <automated>test -z "$(git ls-remote origin 'refs/heads/throwaway/*')"</automated>
  </verify>
  <done>
`260803-mew-EVIDENCE.md` records both runs at STEP granularity with the failing step named and
numbered from the jobs payload, and carries all four verdict lines with an enumerated token each.
On the DEFAULT path that means: `VERDICT FAIL-DIRECTION: CLOSED` with the RED section proving the
`nx` command exited 0 in the same step that failed, distinguishing the needle's genuine-Nx-output
occurrence from its echoed-command occurrence; `VERDICT A1-BODY-PROVENANCE: CLOSED` backed by the
mutated step name; and `VERDICT PASS-DIRECTION: CLOSED` with the four-target needle as genuine Nx
output on `windows-11-arm` at `headSha 41f65e1`. On any documented alternate path (A1 falsified,
A3 fallback, a runner fault) the artifact records the token the runs actually produced and the
gates still pass -- an honest `VOID` or `FALSIFIED` is a completed task, a fabricated `CLOSED` is
not. The throwaway remote branch no longer exists.
  </done>
</task>

<task type="auto">
  <name>Task 3: Supersede the six stale closure claims in place</name>
  <files>.planning/phases/12-windows-ci-reuse-o4-consumer-recipe/12-UAT.md, .planning/phases/12-windows-ci-reuse-o4-consumer-recipe/12-VALIDATION.md, .planning/phases/12-windows-ci-reuse-o4-consumer-recipe/12-VERIFICATION.md, .planning/REQUIREMENTS.md, .planning/STATE.md</files>
  <action>
SIX closure claims, spread across five artifacts, currently read as CLOSED on the SUPERSEDED
three-target needle -- `12-VALIDATION.md` carries TWO independent ones. Add a forward pointer to
each CLAIM, not merely to each file. SUPERSEDE IN PLACE: preserve the original claim and append the
replacement fact
alongside it. Never delete the old claim -- `12-PATTERNS.md:1235` (S-1, "Correcting a claim requires
a REPLACEMENT reason") is explicit that a bare deletion leaves a future reader holding a documented
argument for undoing the work.

Use one distinctive marker literal in every pointer so the edit set is mechanically countable:
`SUPERSEDED by quick 260803-mew`. Each pointer states the same three things: the old evidence
proved the THREE-target needle at `e757d4c`; `9e79009` replaced the needle with the FOUR-target
form and `git merge-base --is-ancestor 9e79009 e757d4c` is false, so the old run cannot speak to
the needle at HEAD; and the new run IDs from task 2 close both directions on the four-target form.

The six sites:
  1. `12-UAT.md` item 2 (`### 2. The detector going green on a real windows-11-arm runner (XOS-05)`,
     around line 54). This one is REQUIRED by the task boundary: it must stop reading as closed on
     the current needle.
  2. `12-VALIDATION.md:160` -- the XOS-05 row whose cell opens `**CLOSED.**` and quotes the
     three-target line.
  3. `12-VALIDATION.md:107` -- a SEPARATE claim in the same file, in the "Per-Requirement
     Verification Map" table: the `the detector actually goes green on a windows-11-arm runner` row,
     whose Status cell reads `**manual-closed** -- run` and then the run id, `event=workflow_dispatch`,
     `job detect success on label windows-11-arm`. It is independently stale and a file-level check
     cannot see it, which is why this file's gate below asserts a COUNT of 2 rather than presence.
     Do not confuse it with `:104`, a different XOS-05 row closed on run `30586177358` (the
     `[remote cache]` per-leg counts) -- that one is not about the needle and is NOT in scope.
  4. `12-VERIFICATION.md` in BOTH places: the `human_verification` frontmatter entry at `:14` and
     the prose item `#### 2. The detector going green on a real runner (XOS-05)` at `:122-126`.
     Both name the three-target literal as the expected evidence. Leave `status`, `score` and the
     other frontmatter counters alone -- this is a pointer, not a re-verification.
  5. `.planning/REQUIREMENTS.md:759` -- the XOS-05 traceability cell, whose parenthetical says the
     conditional scheduled-detector clause is discharged by run `30603713356`.
  6. `.planning/STATE.md:102` -- "The scheduled detector went green on run 30603713356".

Bound the scope there, deliberately. `12-VALIDATION.md:104` (closed on a different run, about the
per-leg `[remote cache]` counts rather than the needle), `12-PATTERNS.md:75,97`,
`12-SECURITY.md:85,87` and the
`12-0N-PLAN.md` files also carry the three-target literal, but they DESCRIBE the mechanism or the
file as it stood on the day they were written rather than claiming a closure, and historical plans
are never back-edited. Say so in one line in the evidence artifact so the boundary is a recorded
decision rather than an omission.

Edit with the Edit tool, ASCII only. Never `git add .` / `-A` / `-u`; stage the five files by name.
If `git commit -m` fails with a COMMIT_EDITMSG "Invalid argument" (a known ReFS Dev Drive fault on
this machine), write the message to a file and use `git commit -F <file>`.

Note on the gates below: the two files carrying TWO claims each (`12-VALIDATION.md`,
`12-VERIFICATION.md`) are asserted by COUNT, not presence, because one marker anywhere in a file
would otherwise satisfy a file-level check while the second claim stayed stale. The last gate
asserts the ORIGINAL run id still occurs at least twice in `12-VALIDATION.md`, which is the
mechanical form of "supersede, never delete" (S-1). Match the id BARE: the file's text is
`` run `30603713356` `` at `:107` and `` Run `30603713356` `` at `:160`, so a markdown backtick
sits between the word and the digits in both, and the casing differs too -- any literal that
includes the preceding word matches at most one of them.
  </action>
  <verify>
    <automated>test "$(git grep -l -F 'SUPERSEDED by quick 260803-mew' -- .planning/phases/12-windows-ci-reuse-o4-consumer-recipe/12-UAT.md .planning/phases/12-windows-ci-reuse-o4-consumer-recipe/12-VALIDATION.md .planning/phases/12-windows-ci-reuse-o4-consumer-recipe/12-VERIFICATION.md .planning/REQUIREMENTS.md .planning/STATE.md | wc -l | tr -d ' ')" = "5"</automated>
    <automated>git grep -c -F 'SUPERSEDED by quick 260803-mew' -- .planning/phases/12-windows-ci-reuse-o4-consumer-recipe/12-VERIFICATION.md | rg -q ':2$'</automated>
    <automated>git grep -c -F 'SUPERSEDED by quick 260803-mew' -- .planning/phases/12-windows-ci-reuse-o4-consumer-recipe/12-VALIDATION.md | rg -q ':2$'</automated>
    <automated>test "$(git grep -c -F '30603713356' -- .planning/phases/12-windows-ci-reuse-o4-consumer-recipe/12-VALIDATION.md | rg -o '[0-9]+$')" -ge 2</automated>
  </verify>
  <done>
All five artifacts carry the `SUPERSEDED by quick 260803-mew` forward pointer naming the new run
IDs, covering all SIX stale claims -- `12-VERIFICATION.md` carries it twice (frontmatter and
prose) and `12-VALIDATION.md` carries it twice (`:107` map row and `:160` XOS-05 row), both
asserted by count; every original claim is still present verbatim alongside its replacement fact,
proven by the original run id still occurring at least twice in `12-VALIDATION.md`; the scope
boundary excluding `12-VALIDATION.md:104`, `12-PATTERNS.md`, `12-SECURITY.md` and the historical
plans is recorded in the evidence artifact.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| local repo -> `origin/main` of a PUBLIC repo | A force-push crosses into shared, world-readable history that PR #16 is based on |
| local repo -> throwaway remote branch | A deliberately-broken workflow body enters the remote namespace |
| GitHub Actions run -> evidence artifact | Run output becomes a durable project claim; a misread becomes a false verdict |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-mew-01 | Tampering | `origin/main` | critical | mitigate | Task 1 steps 1/7/8: back `main` up to a remote ref and verify its SHA BEFORE any push; restore with the EXPLICIT `--force-with-lease=main:<plumbing-sha>` form so a concurrent third-party push aborts the restore instead of being overwritten; the three-way restore verification is the task's blocking gate |
| T-mew-02 | Tampering | phase branch / PR #16 | high | mitigate | The mutation is built entirely with git plumbing against a temp `GIT_INDEX_FILE` outside the repo, so the working tree and index are never touched; task 1's second `<automated>` gate asserts `git status --porcelain` is clean apart from the untracked quick-task directory; the mutation is pushed only to `refs/heads/throwaway/detector-red-260803-mew` and deleted in task 2 |
| T-mew-03 | Denial of Service | `ci.yml` on `main` | medium | mitigate | `[skip ci]` in the plumbing commit SUBJECT (the prior window's `d043eec` used exactly this and produced no push run); the throwaway push cannot trigger `ci.yml` at all, whose triggers are `push: branches: [main]` plus `pull_request` (F-7), and task 1 step 5 confirms rather than assumes this by checking `gh run list` |
| T-mew-04 | Repudiation | the evidence artifact | high | mitigate | Task 2 records step names, step conclusions and raw log lines from the REST payload rather than run colour (D-5); the A1 falsification branch is written into the action, so an unmutated step name is recorded as VOID rather than silently read as a negative result |
| T-mew-05 | Spoofing | PR #16 merge state | low | accept | Merged-detection needs PR #16's head reachable from `main`; the plumbing commit is a single one-file commit parented on `fe25a3f` and cannot make `41f65e1` reachable. Verified against the prior window, during which PR #12 was open and stayed unmerged (F-5c). Residual is cosmetic: PR #16 transiently reads "1 commit behind" and returns to CLEAN on restore |
| T-mew-06 | Information Disclosure | commit identity on a public repo | high | mitigate | Task 1 pre-flight asserts `git config user.email` is the public gmail before `commit-tree`, because the plumbing commit lands on a public default branch and carries both author and committer identity |
| T-mew-07 | Tampering | in-flight runs during the restore | medium | accept | A2 (a created run is pinned at creation) is precedent-backed only -- 3 runs across 2 windows, no doc statement. Mitigated by ordering: the restore happens only after BOTH runs are CREATED, and the RED run's dispatch is the last action before it, minimising exposure. Recorded as a carried assumption in the artifact rather than presented as a fact |
| T-mew-SC | Tampering | npm/pip/cargo installs | n/a | accept | No package-manager install task exists in this plan; no legitimacy gate is required |
</threat_model>

<verification>
- `main` is at `fe25a3f865f20f3d4f8a40e96f8cb5717608ba8a` with the detector file absent, proven by
  remote SHA and a 404 on the contents API.
- No `refs/backups/main-pre-window-260803-mew` and no `refs/heads/throwaway/*` remain on origin.
- `git status --porcelain` shows nothing but the quick-task directory's own files.
- `npm exec -- nx run-many -t build typecheck test lint --skip-nx-cache` still green locally: the
  detector workflow at HEAD is untouched by this task, and `nx.json:71` makes it a `test` input, so
  an accidental edit would surface here.
- The evidence artifact names the failing STEP of the RED run and shows the `nx` command in that
  same step at exit 0.
</verification>

<success_criteria>
- Both directions of the four-target needle are observed on real `windows-11-arm` runners, with
  run IDs recorded (D-1, D-2).
- The RED is attributed to the needle's `grep`, not to an exit code, at STEP granularity (D-5).
- A1 is closed or falsified BY MEASUREMENT via the step-name discriminator, with the falsification
  branch honestly reported if it fires.
- `main` is restored and the restore is verified three ways before success is reported (D-4).
- The mutation exists nowhere on origin at the end of the task (D-3).
- Five artifacts carry a forward pointer; no prior claim was deleted.
</success_criteria>

<output>
Create `.planning/quick/260803-mew-observe-phase-12-fail-half-on-real-run/260803-mew-SUMMARY.md`
when done.
</output>
