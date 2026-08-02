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

---

## PRE-REGISTRATION CORRECTIONS (still before any observation run exists)

Raised by `gsd-plan-checker` against the plan, applied here before either observation branch was
pushed. No observation run existed when this was written, so the predictions above remain
untested-at-time-of-writing; this section tightens HOW they are measured, and does not soften WHAT
was predicted.

### C1 -- an Nx MISS-and-SAVE does not print its key. Only a HIT does.

The baseline table above is therefore derived from the WINDOWS CONSUMER legs, which HIT, and tied
to the ubuntu producers BY BYTE SIZE -- the idiom `13-EVIDENCE.md` already uses for its
producer-to-consumer tie. Verified from run `30767511870`'s log:

| Producer | `Sent` | Consumer | `Cache hit for:` | `Received` |
|----------|--------|----------|------------------|------------|
| ubuntu `build` | 137951 of 137951 | `build-windows` | `nx-cache-6303782621882711279` | 137951 |
| ubuntu `typecheck` | 98227 of 98227 | `typecheck-windows` | `nx-cache-11553684120103592295` | 98227 |
| ubuntu `test` | 1299 of 1299 | `test-windows` | `nx-cache-11565398464176149070` | 1299 |

`typecheck-windows` additionally HIT `nx-cache-6303782621882711279` at `Received 137951` -- the
`build` dependency -- which is why its count is 2.

### C2 -- a `Cache hit for:` line is NOT always a restore. Race-artifact rule.

Run `30767511870`'s ubuntu `typecheck` job contains, in sequence:

```
Failed to save: Unable to reserve cache with key nx-cache-6303782621882711279, another job may be creating this cache.
Cache hit for: nx-cache-6303782621882711279
Lookup only - skipping download
```

That is the `build` key surfacing inside the `typecheck` JOB because the reserve race resolved to
the `build` job this run -- the opposite way round from run `30744366870`. It is a lookup-only
probe, not a restore. **Rule: a `Cache hit for:` immediately following `Failed to save: Unable to
reserve` is a race artifact and must never be attributed as a restore, nor tied to that job's own
`Sent` figure.** Doing so here would have bound the `build` key to `Sent 98227`, which is the
`typecheck` entry -- a silent mis-attribution underneath the entire Case-B claim.

### C3 -- `Sent == 0` is the corroborator, NOT the primary discriminator.

A producer that MISSes, executes, and then FAILS TO RESERVE also emits zero `Sent` -- and that
exact sequence is present in this very run. So Observation 1's binding discriminator is
`Cache: <n>/<n> hit (100%)` on each ubuntu producer, with zero `Sent` as corroboration.

### C4 -- widened falsifier for Observation 1.

A MISS on an ubuntu producer means *a hash rotated* **OR** *the baseline entry is no longer
reachable* (LRU eviction under the 10 GB repo cap, or an unreachable scope). Compare the observed
key against the baseline BEFORE attributing a MISS to hash rotation. Eviction is unlikely at these
sizes (1 KB / 98 KB / 138 KB) but it is a different fact and must not be reported as the other one.

### C5 -- jobs excluded from the "nothing wrote into the merge-ref scope" claim, named not filtered.

The claim is checked over the three ubuntu producers. Two other jobs touch the cache and are
excluded for stated reasons: `dogfood-seed` keys on `nx-cache-<GITHUB_RUN_ID>` (`ci.yml:26-31`), a
run-scoped key that is not a task hash; and `integration` carries a `process.platform`
discriminator (`nx.json:106`), so it cannot collide with a task-hash key either.

### C6 -- run `30767511870`'s overall conclusion is `failure`, and the baseline is still sound.

The two failures are `publish-verify (ubuntu-24.04-arm)` and `publish-verify (windows-11-arm)` --
see the UNPLANNED FINDING section. All three ubuntu producers and all three Windows legs are
`success`. `publish-verify` exercises the GitHub **Releases** mirror, a different store from the
**Actions** cache this baseline measures, and it runs AFTER the producers. A later reader running
`gh run view 30767511870` will see `failure` next to a baseline claimed off it; that is expected,
and this paragraph is why it is not a contradiction.

---

## OBSERVATION 1 -- Case B: PROVEN

**Run `30768540898`**, event `pull_request`, draft PR #14, head `7188a66` -- which IS the
pre-registration commit, so the prediction was provably in the tree the run measured.

### The producers HIT. Nothing was written this run.

The primary discriminator (C3), measured on all three ubuntu producers:

| Producer | Observed | `Sent` |
|----------|----------|--------|
| ubuntu `build` | `Cache hit for: nx-cache-6303782621882711279` | NONE |
| ubuntu `typecheck` | `Cache hit for: nx-cache-11553684120103592295` and `...6303782621882711279` | NONE |
| ubuntu `test` | `Cache hit for: nx-cache-11565398464176149070` | NONE |

Not one `Sent <n> of <n>` line on any producer, and no `Failed to save: Unable to reserve`
anywhere -- so C2's race artifact is absent and C4's eviction alternative is excluded, because the
keys observed ARE the baseline keys rather than new ones.

### The Windows legs restored the BASELINE keys, byte for byte

| Leg | `Cache hit for:` | `Received` | Baseline `Sent` | Gate count |
|-----|------------------|-----------|-----------------|------------|
| `build-windows` | `nx-cache-6303782621882711279` | 137951 | 137951 | 1 |
| `typecheck-windows` | `nx-cache-11553684120103592295` | 98227 | 98227 | 2 |
| | + `nx-cache-6303782621882711279` (build dep) | 137951 | 137951 | |
| `test-windows` | `nx-cache-11565398464176149070` | 1299 | 1299 | 1 |

Counts **1 / 2 / 1**, exactly as pre-registered. All three legs GREEN.

### Why this is Case B and not Case A

Nothing was saved during this run -- every producer HIT and emitted no bytes. So there was no
same-run merge-ref entry in existence for the Windows legs to have restored. The PR's own
merge-ref scope was a fresh, empty ref. The keys the Windows legs restored are byte-identical to
the ones `main`'s scope received from run `30767511870`. The entries therefore came from a scope
populated BEFORE the run started. That is Case B.

### What this does NOT prove (stated in the pre-registration, unchanged)

- It does not distinguish BASE-branch scope from DEFAULT-branch scope; for a PR off `main` they
  are the same ref. The narrower claim -- restored from a scope populated before the run, outside
  this run's merge ref -- is what the gate's soundness actually needs, and that is what is proven.
- It says nothing about portability. A restored task does not execute.

### UNPLANNED FINDING -- the O3 witness is not Case-B-safe

The run's overall conclusion is `failure`, from ONE job: `o3-witness`, at the step
`Assert the H_linux cache entry existed before the Windows integration step started`. The three
read-only legs are all `success`.

This is not a flake and not a defect in Case B -- it is a real limitation the observation exposed.
`o3-witness` asserts a CREATION ordering: that the linux entry came into existence before the
Windows integration step began. On a Case-B run nothing is created at all, because every producer
HITs, so an assertion phrased over in-run creation has no event to observe. The witness silently
assumes the Case-A shape.

Consequence for a real merge: the FIRST PR after Phase 13 lands that touches no declared input
will redden `o3-witness` for this reason. That is a false red -- the cross-OS property holds, as
the three green read-only legs in this very run show. Logged as a follow-up, not fixed here.

---

## OBSERVATION 2 -- assumption A1: ANSWERED, still not fully CLOSED

**Run `30768554184`**, event `pull_request`, draft PR #15, head `6e982aa`, conclusion **success**.

### The partial-miss condition was achieved exactly as pre-registered

| Leg | Gate count | Predicted | Conclusion |
|-----|-----------|-----------|------------|
| `typecheck-windows` | **1** | 1 | success |
| `build-windows` | 1 | 1 (control) | success |
| `test-windows` | 1 | 1 (control) | success |

A count of 1 is NOT below the floor of 1, so the gate PASSED and the leg stayed GREEN -- the
predicted outcome, not an accident.

### A task genuinely EXECUTED -- measured, not inferred

The decisive line, from the tee'd Nx summary on `typecheck-windows`:

```
Nx read the output from the cache instead of running the command for 1 out of 2
```

against the Case-B run's control on the same leg, `2 out of 2`. One of the two tasks was restored
(`build`) and the other (`typecheck`) MISSed and RAN. That is the partial miss, observed rather
than assumed.

### The finding: the refused store produces NO log noise at all

`typecheck-windows` contains **zero** occurrences of `403` and no store-failure wording of any
kind. The 55 `403` tokens elsewhere in the run belong to unrelated jobs (`build`, `integration`,
`ppe`, `fallow`) and are incidental HTTP noise, not sidecar responses -- none of those jobs runs a
read-only backend.

So A1's practical question -- *does the read-only 403 generate log noise a reader would have to
triage?* -- is answered: **no, none.** This is consistent by construction with `server.ts:129`,
which answers with `res.statusCode = 403; res.end()`: an empty body, and the server logs nothing.

### Why this is ANSWERED but NOT CLOSED

Absence of noise is consistent with two different worlds: a PUT was attempted and silently
refused, or no PUT was attempted at all. Nothing in the captured output distinguishes them,
because the server logs nothing on the 403 path and Nx printed nothing about storing. Inferring
"the PUT happened" from Nx's normal behaviour would be exactly the reasoning this project forbids
-- the same shape as reading a MISS as evidence.

**What would close it:** instrumenting the sidecar to record refused PUTs (a counter or a single
stderr line), then re-running this same perturbation. That is a code change and is out of scope
for an observation task.

**Net movement:** A1 goes from *unexercised* -- no PUT ever attempted on any run -- to *the
condition has now been exercised on a real `windows-11-arm` runner, and produced no observable
noise*. The residual is instrumentation, not behaviour.
