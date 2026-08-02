# Quick 260802-toz -- Evidence

> Append-only. Predictions are committed BEFORE the runs they predict and are never
> back-edited; observations are appended below them. Forward references ("see the
> OBSERVATION section") keep the whole file diffing as additions only.

## Why this window exists

Case B and RESEARCH assumption A1 are the two items Phase 13 closed with everything EXCEPT a
live observation. Neither is observable from the phase branch:

- **Case B** needs a PR whose Nx task hashes are UNROTATED relative to entries already in the
  default branch's Actions-cache scope. The phase branch is 410 commits ahead of a `main` that
  had never run the read-only legs, so every PR rotated all three hashes and took the intra-run
  merge-ref path (Case A) by construction.
- **A1** needs a task to MISS on a read-only Windows leg so a PUT is attempted at all.

Maintainer authorised a TEMPORARY push of the Phase 13 tip to `main`, to be restored afterwards.

## Window setup (completed before any observation)

| Step | Value |
|------|-------|
| Backup ref, local AND remote | `refs/backups/main-pre-phase13-verify` = `fe25a3f865f20f3d4f8a40e96f8cb5717608ba8a` |
| PR #12 | CLOSED FIRST, deliberately -- verified `state=CLOSED mergedAt=null` AFTER the push |
| `main` | fast-forwarded `fe25a3f..ce19770` (branch was 0 behind / 410 ahead, so no force needed) |
| Populating run | `30767511870`, event `push`, head `ce19770` |

**Why PR #12 was closed first.** Its head SHA was byte-identical to the pushed tip
(`ce19770`), so pushing with it OPEN would have made that SHA reachable from `main` and GitHub
would have marked the PR **Merged**. A PR cannot be un-merged, so the later `main` restore would
have left a public repo showing #12 merged while `main` did not contain it. The git side is
restorable; the PR status is not. Closing first breaks that link, and it was verified to have
worked: `mergedAt=null` after the push.

---

## BASELINE, measured from run 30767511870 (not predicted)

All three ubuntu producers completed SUCCESS, so `main`'s cache scope now holds their entries.

**Task-hash key identities at `ce19770`**, read out of the run log:

| Task | Key | Restored by | Gate count |
|------|-----|-------------|------------|
| `build` | `nx-cache-6303782621882711279` | `build-windows` | 1 |
| `typecheck` | `nx-cache-11553684120103592295` | `typecheck-windows` | 2 (this + the `build` dep) |
| `test` | `nx-cache-11565398464176149070` | `test-windows` | 1 |

`typecheck-windows` restored BOTH `nx-cache-6303782621882711279` (the `build` dependency) and
`nx-cache-11553684120103592295`, which is why its count is 2 while the other two legs are 1.
Gate counts on this run were 1 / 2 / 1, matching every prior Case-A observation.

---

## PRE-REGISTRATION -- Observation 1, Case B

**Procedure.** A PR branched off `main` at `ce19770` touching ONLY `.planning/**`. That path is
in no Nx target's declared input set (measured in `13-01-SUMMARY.md`: a `.planning/**`-only plan
rotated no task hash), so all three task hashes must stay identical to the baseline above. The
PR's own merge-ref scope is a fresh ref and therefore empty, so nothing can be restored from it.

**Predicted, before the run exists:**

1. The three Windows legs restore EXACTLY the three baseline keys above -- same digits. Key
   identity is the load-bearing half; a matching COUNT alone would not distinguish the scopes.
2. Gate counts stay 1 / 2 / 1 and all three legs stay GREEN.
3. The ubuntu producers `build`, `typecheck` and `test` HIT rather than MISS-and-save, because
   the entry already exists in the base scope. This is what rules out a same-run merge-ref
   entry: with no save this run, there is nothing intra-run to have restored.

**What this will NOT prove, stated in advance so it cannot be trimmed to fit the result:**

- It cannot distinguish BASE-branch scope from DEFAULT-branch scope. For a PR off `main` those
  are the same ref. What it closes is the narrower, and actually load-bearing, claim: the entry
  was restored from a scope populated BEFORE the run, outside this run's own merge ref.
- It says nothing about portability -- a restored task does not execute.

---

## PRE-REGISTRATION -- Observation 2, assumption A1

**The condition, verbatim from `13-VALIDATION.md`:** a partial miss on the two-task
`typecheck-windows` leg clears the floor, stays GREEN, and produces exactly one 403.

**Why a perturbation is required.** On every run so far every Windows task HIT, so no PUT was
ever attempted and no 403 could occur. A1 is UNEXERCISED, not unknown-in-principle.

**Procedure**, on a throwaway branch off `main`, never merged, deleted afterwards -- the same
shape that proved the gate's FAIL path on run `30745558383` via draft PR #13:

1. Touch a source file so the `build` and `typecheck` task hashes ROTATE. Required: without it,
   `main`'s base scope already holds `nx-cache-11553684120103592295` and the leg would simply
   HIT it, giving count 2 and no MISS. Note `ci.yml` is a declared `test` input but NOT a
   `typecheck` input, so the workflow edit alone does NOT rotate the `typecheck` hash.
2. Change the ubuntu `typecheck` producer so the `typecheck` TASK is never saved by any producer.

**Predicted:**

1. `typecheck-windows` resolves `build` (HIT, saved by a producer this run) and `typecheck`
   (MISS -- never saved by anyone) -> gate count **1**.
2. 1 is NOT below the floor of 1, so the gate PASSES and the leg stays **GREEN**. A green here
   is the prediction, not an accident.
3. The MISSed task executes and attempts exactly ONE store, which the read-only backend refuses
   with **403**.
4. `build-windows` and `test-windows` are UNAFFECTED at 1 and 1, serving as the same-run
   positive control.

**The 403's wording is NOT predicted, deliberately.** `server.ts:129` answers a read-only PUT
with `res.statusCode = 403; res.end()` -- an EMPTY body, and the server logs nothing. Whatever
"403 log noise" exists is produced by Nx reacting to a refused store, and its exact wording is
unknown. This observation CAPTURES that wording; it does not assert it.

**Named failure mode, recorded before the run.** If `typecheck` FAILS when it executes on
Windows, Nx does not store a failed task -- no PUT, no 403 -- and the job reddens at the tee'd
target step rather than at the gate. A1 would stay open, and that would be a finding in its own
right: a genuine Windows-only defect that the gate structurally cannot see. Distinguish via the
jobs API, never by the job's red/green alone -- `ci.yml:527` is a pre-existing bare `exit 1` in
the sidecar readiness poll inside EVERY Windows job block.

---

## UNPLANNED FINDING -- `publish-verify` is BROKEN on this branch (merge-blocking)

Found by this window rather than by design, and it is the most consequential thing here.

Run `30767511870`: **24 jobs success, 2 failure** -- `publish-verify (ubuntu-24.04-arm)` and
`publish-verify (windows-11-arm)`, both at the step
`node packages/github-cache/dist/roundtrip/read-back.js`:

```
github-cache round-trip read-back: cache MISS for feed230767511870 on linux. The real Releases
reader did not resolve the asset this leg mirrored this run -- suspect the month-shard tag, a
drift between the two mirrorSeedHash call sites (the mirror-seed operation writes the key, this
bin derives it again), or a publish leg that never uploaded.
```

**This is a REGRESSION, established by history rather than by reading the diff.** `publish-verify`
succeeded on all five prior `main` push runs -- `30608793890`, `30501074211`, `30500255530`,
`30473116345`, `30471772954`, most recently 2026-07-31 at `fe25a3f` -- and fails on BOTH legs at
`ce19770`.

**No PR run could ever have caught it.** `publish-verify` is push-gated (`on.push` is
`branches: [main]`), so it is structurally `skipped` on every pull request. The phase branch has
366+ green PR checks and none of them ran this job. This is the v0.0.1 retrospective's top lesson
repeating verbatim: three distribution bugs passed every local gate AND the verifier, and took
five live pushes to close.

Root-cause analysis is deliberately NOT folded into this window -- it needs no rewritten `main`
and would prolong one. See the OBSERVATION section for disposition.
