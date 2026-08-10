# Quick Task 260804-h3b: Fix o3-witness Case-B - Context

**Gathered:** 2026-08-04
**Status:** Ready for research

<domain>
## Task Boundary

Originally stated as "Fix o3-witness Case-B". The entry investigation found the CODE FIX
ALREADY LANDED, so the task re-scoped -- with the operator's explicit agreement -- to:

1. Retire the stale ROADMAP follow-up note and correct the milestone audit that repeated it.
2. OBSERVE the Case-B path live, which the fix has never had.

No `o3-witness` behaviour change is in scope. If research finds a genuine code defect the
scope re-opens, but the entry evidence says there is none.

</domain>

<entry_finding>
## The bug was already fixed -- established before planning

`git merge-base --is-ancestor` proves the ROADMAP note PREDATES both fixes:

| Commit | Date | What |
|--------|------|------|
| `da462b5` | 2026-08-03 01:09 | the ROADMAP follow-up note (`docs(260803-0rr)`) |
| `40e4d21` | 2026-08-03 03:13 | `fix(ci): make o3-witness read the base-branch cache scope (Case B)` |
| `e5d3cd3` | 2026-08-03 22:27 | `fix(ci): admit the default-branch scope to the o3-witness ref allowlist (D-17)` |

Both `is-ancestor da462b5 <fix>` checks return TRUE. The note was never retired.

The three halves of the Case-B problem are each addressed and each spec-guarded:

| Half | Where fixed | Guard |
|------|-------------|-------|
| Server-side `&ref=` narrow filtered out the proving row | `40e4d21` -- URL carries key only | `dogfood-cross-os.spec.ts:733` asserts the URL does NOT match `/ref=/` |
| Default-branch scope absent from the client allowlist | `e5d3cd3` -- `default_ref` arg added | `:584` pins the 3-ref jq select by exact regex; `:634` pins the `default_ref` block |
| Delta on a Case-B run is hours/days, not minutes | never a defect -- `ci.yml:1456-1461` states a LARGER delta is STRONGER evidence and forbids an upper bound | `:827` pins the `-lt 30` floor; `:806` pins the `matched_ref` print so Case A and Case B are distinguishable in the log |

24 `o3-witness` guards pass at HEAD (`npx vitest run -t "o3-witness"`, 2 files, 24 passed).
`CACHE_KEY_PREFIX` is `nx-cache-`, matching the key the witness composes.

**Live status:** green on Case A only. Run `30896484130` logged
`matched_ref=refs/pull/16/merge created_at=...09:29:14 started_at=...09:31:36 delta=142s`
-- the entry was created INSIDE that run, on the run's own merge ref. The
`$defaultref` clause has never matched on a real run.

</entry_finding>

<decisions>
## Implementation Decisions

### Deliverable shape
- Doc correction AND a live Case-B observation. Operator chose the observation explicitly
  over doc-only.

### Operator authorisation (granted 2026-08-04, this session)
- Temporary push to `main`, with backup before and restore after.
- Push to any branch.
- Drafting, opening and closing any PR.

This is the gate the main-window procedure requires. It is scoped to THIS task.

### Case-B decomposes into two sub-claims, and they have different costs
Locked: prove (a) first because it is free and de-risks (b).

- **(a) The prior-existence delta allowance.** An entry created OUTSIDE this run, matched
  with a large delta, passes. Provable with a `.planning/`-only re-push to the EXISTING PR
  branch: nothing rotates, the ubuntu `integration` leg HITs the previous run's entry on
  `refs/pull/N/merge`, writes nothing, and the witness matches its own ref with a delta of
  however long ago the previous run was. **No main window needed.**
- **(b) The `$defaultref` clause matching.** Requires an `nx-cache-<H_linux>` entry in the
  `refs/heads/main` scope for the CURRENT integration hash. `origin/main` is at `fe25a3f`,
  468 commits behind, so its scope holds only ancient hashes. **Needs the main window.**

Sub-claim (a) is the substance of the mechanism; (b) is the specific clause `e5d3cd3` added.
Report them separately -- do not let (a) passing be written up as (b) proven.

### Retire the note in place, do not delete it
The file's own house style (`ROADMAP.md:646-647`, `:679-688`) supersedes a Live-CI item with
a dated STATUS block and keeps the original text "for the reasoning it records". Follow it.

### Correct the milestone audit in the SAME task
`.planning/v0.0.2-MILESTONE-AUDIT.md` repeated the stale note as open follow-up #1 (authored
earlier today, commit `3c67513`). Left alone, the repo would assert the item both OPEN and
CLOSED -- the exact two-artifact contradiction `260803-0rr` was run to eliminate.

### No new standing guard
The 3-ref allowlist, the absent `&ref=` and the delta floor are ALREADY pinned by exact
regexes. A further guard would assert the same lines twice. Precedent: `260803-0rr`
declined a standing guard for the analogous residual as "third-party behaviour that would
redden on an unrelated bump".

### Claude's Discretion
- Exact wording of the ROADMAP status block and the audit correction.
- Branch and PR naming for the probe.
- Whether to fold the observation into `11-EVIDENCE.md` or keep it in this task's own
  EVIDENCE file (prefer this task's own; Phase 11 is closed).

</decisions>

<open_questions>
## Must be answered by research BEFORE the main window opens

A wrong plan here costs a main window plus TWO production `ci.yml` runs on `main`, each
firing the real `publish` legs. These are not rhetorical.

1. **Does the `integration` leg's positive control 404 on a Case-B run?** `ci.yml:999-1010`
   probes with an acceptance set of **200 ALONE** and calls a 404 a CONTROL FAILURE,
   describing the key as the one "this leg's own task just saved". On a Case-B run the task
   HITs and saves nothing. Does the probe still 200 because the entry exists (restored), or
   does it 404 and redden the leg for a reason unrelated to `o3-witness`? **If it 404s,
   sub-claim (a) cannot be observed on a green run and the plan must change.**
2. **Does the ubuntu `integration` leg on a `push` to `main` actually SAVE into
   `refs/heads/main`'s scope?** The write gate is `{push, schedule}` and CI-RW is the
   default composition, so it should -- confirm, and confirm the Windows leg saves H_win
   there too.
3. **Restore side effect.** Confirm the restore force-push fires a second full `ci.yml` run
   because `[skip ci]` is structurally unavailable to a re-push of an existing commit
   (`260803-mew`'s undisclosed finding, now a known audit item). Both production runs must
   be DISCLOSED in the plan, not discovered afterwards.
4. **Is `.planning/**` genuinely outside every declared input?** Re-verified this session
   via `nx show project @op-nx/github-cache --json`: no target's resolved inputs mention
   `.planning`, and `integration` declares neither `ci.yml` nor the docs (only `test`
   does). Research should confirm the scan was non-vacuous rather than take it on trust --
   `260802-toz`'s procedure names verifying A2 first as a hard step.
5. **Minimum exposure ordering.** `260803-mew` restored `main` while the observation run was
   still in flight, to close the window early. Establish whether the Case-B PR run can
   likewise be left in flight during the restore, or whether it reads `refs/heads/main`'s
   scope at a point that requires main to still be advanced.

</open_questions>

<canonical_refs>
## Canonical References

- `.planning/ROADMAP.md:700-705` -- the stale note being retired
- `.planning/ROADMAP.md:646-688` -- the supersede-in-place house style to copy
- `.github/workflows/ci.yml:1133-1471` -- the `o3-witness` job
- `.github/workflows/ci.yml:999-1010` -- the integration positive control (open question 1)
- `packages/github-cache/src/dogfood-cross-os.spec.ts:413-830` -- the witness guards
- `.planning/quick/260803-mew-.../260803-mew-PLAN.md:78-230` -- the main-window procedure,
  including the `GIT_INDEX_FILE`-outside-the-repo plumbing and the three-way restore
  verification
- `.planning/quick/260802-toz-.../` -- the Case-B run that exposed the bug, run `30768540898`
- `.planning/v0.0.2-MILESTONE-AUDIT.md` -- the audit to correct

</canonical_refs>
