---
quick_id: 260803-0rr
status: complete
date: 2026-08-03
outcome: "A1 ANSWERED AFFIRMATIVELY by local measurement; A1 + Case B propagated to five surfaces; ROADMAP Live-CI block closed"
commits: 3a46db9..HEAD
---

# Quick 260803-0rr -- Summary

## Goal

Close RESEARCH assumption A1 -- *the Nx client tolerates a PUT `403` without failing the build or
producing alarming output* -- which quick `260802-toz` left ANSWERED-but-not-closed, and propagate
the closure into the phase artifacts that still called it OPEN.

## Outcome

| Item | Result |
|------|--------|
| Assumption A1 | **ANSWERED AFFIRMATIVELY**, by local measurement -- not on the landing run |
| Method | Local harness, no source change, no CI cycle |
| Propagation | **5 surfaces** updated, not the 2 the plan named |
| ROADMAP `**Live-CI close**` | Both items now CLOSED; item 1 was stale too, not just item 2 |
| Standing guard added | **None**, deliberately |
| New follow-up carried | `o3-witness` is not Case-B-safe |

Full evidence with controls: `260803-0rr-EVIDENCE.md`.

## What A1 turned on

The residual was a two-way ambiguity that no amount of reading could settle: **absence of noise
cannot distinguish "a PUT was attempted and silently refused" from "no PUT was attempted at all."**
`server.ts:129` answers a read-only PUT with `403` and an empty body and logs nothing, so neither
world leaves a trace. Run `30768554184` achieved the partial-miss condition and carried zero `403`
tokens -- consistent with both worlds.

**Answer: Nx DOES attempt a store.** Four PUTs across two runs, one per executed task, each refused
`403`, and Nx swallowed every one in complete silence -- the definitive run's full 30-line output
contains zero occurrences of `403`, `forbidden`, `refus`, `store`, `fail`, `could not`, `unable`,
`error` or `warn`. Build green.

## The two things worth keeping from how this was done

**1. The planner dissolved the orchestrator's design rather than executing it, and was right
twice.** The proposed route was to instrument `server.ts` with `core.debug()` and observe through a
throwaway CI branch plus `gh run rerun --debug`. Both halves were rejected:

- The instrumentation would have been an **architectural defect**. `server.ts` has zero `@actions/*`
  imports by design and it backs `createCacheServer`, which is the ENTIRE `EXPECTED_VALUE_EXPORTS`
  (`public-surface.spec.ts:40`). Adding `@actions/core` there would make the package's only public
  value export transitively depend on an Actions-only package for consumers outside Actions.
- **CI was never necessary.** `server.ts:128-133` returns the `403` BEFORE calling `handlePut`, so
  no backend method runs on a refused PUT. The backend's identity provably cannot affect the PUT
  path -- which makes the existing `createReadOnlyMemoryBackend` exactly equivalent, and PUT-maximal
  besides, because it is permanently empty so every task must execute.

**2. A vacuous run fired and was caught only by counting requests.** One harness run reported a
clean "Nx said nothing about the refused stores" while adding **zero** tap lines: served entirely
from local cache, it never contacted the instrument. Rejected. Root cause worth its own line:
**`NX_CACHE_DIRECTORY` is not honoured by Nx 23.1.0 here** -- a verifiably empty directory
(`entries: 0`) still produced `[local cache]` 2/2. Coldness was forced by ROTATING THE HASH
instead (one comment appended to `cleanup.ts`, reverted and proven byte-exact with
`git diff --quiet`).

The generalisation: **before believing any silence, prove the instrument was exercised.**

## Scope -- what does and does not transfer

**Measured directly:** with a read-only backend, this Nx pin attempts a store after executing a
MISSed task, the server refuses it `403`, and the client prints nothing and still succeeds.

**Transfers to CI:** the narrow client-side property *given a `403` to a store, this pinned Nx
emits no output.* That is a property of the client and the protocol response, not the environment.

**Does NOT transfer:** it is an INFERENCE. No CI run has directly observed a PUT arriving, and this
work does not make one. The CI silence on run `30768554184` is now best *explained* rather than
*measured*.

## Propagation -- five surfaces, because two was wrong

The plan named `13-EVIDENCE.md` and `13-VALIDATION.md`. `gsd-plan-checker` (B5) found three more
that still asserted A1 OPEN. Left silent, the repo would have asserted A1 as both CLOSED and OPEN
across two audit artifacts of the same phase.

| Surface | Treatment |
|---------|-----------|
| `13-EVIDENCE.md` | **ADDENDUM 3 appended.** Append-only held: 100 insertions, **0 deletions**, verified with a revision range |
| `13-VALIDATION.md` | Decision row `13-06 D5` and both Manual-Only rows (A1 and Case B) updated; dated approval left intact with a post-approval note under it |
| `13-SECURITY.md` | **Declared FROZEN, in writing.** A signed-off snapshot at `80f3066`; its OPEN items and its checked sign-off box were true of the tree it audited and of what that audit did, so they stand. A `SUPERSEDED` block states the freeze and carries the current status |
| `13-RESEARCH.md` | Assumptions Log A1 row: the stale "Confirm on the landing run" instruction replaced with the actual resolution. A2 also confirmed HELD, so no reader re-runs a done verification |
| `ROADMAP.md` | Both `**Live-CI close**` items closed -- see below |
| `13-VERIFICATION.md` | **Untouched**, by instruction |

The discipline throughout: **supersede forward, never rewrite the record.** Every artifact that
still reads OPEN now carries an in-file pointer to what closed it.

## ROADMAP -- item 1 was stale too

The handoff named only item 2 (Case B). Item 1 (XOS-09's gate) was equally stale -- it closed on
the phase's own landing run, exactly as designed, and nothing said so. Both are now recorded with
their runs, plus the note that the item-2 fallback was never needed because the read half holds.

Also stated: **A1 is not in `ROADMAP.md` at all** (`rg` exit 1 with a positive control), so no A1
row was invented there.

## Decisions

**No permanent test or standing guard was added.** The durable half (PUT -> `403`) is our code and
is already covered at that branch (`server.spec.ts:359`). The new half -- does the Nx client attempt
a store -- is THIRD-PARTY behaviour; guarding it would test Nx and redden on an unrelated bump. The
failure mode is self-announcing anyway: it would redden read-only legs on any partial miss.

**The plan-checker's verdict was collected after the measurement and does not invalidate it.** Its
central point is sound -- the plan's row 1 (a PUT arrives) closes A1 while row 2 (no PUT) was
unearned. The observation IS row 1, and all three row-2 hazards are excluded by what was run: no
operator probes were fired, so all 8 tap entries are Nx-attributable at real task hashes (B1); the
run exited 0 with four PUTs (B2); and the local-cache-HIT hazard was independently discovered and
gated by the tap-line delta (B3). W1 and I1 were accepted and applied to the evidence. B4, B5 and
W3 were carried into this propagation half and B4 and B5 are both discharged here.

**B4 discharged.** The plan's append-only check `git diff --numstat -- <file>` has no revision
range, so it compares worktree to index and is VACUOUS once the file is committed -- it prints
nothing and exits 0 regardless of what the commit did. Replaced with a `<base>..HEAD` range per
`13-VALIDATION.md:90`, with the base SHA captured before the first edit.

## The finding that outlived the task

**A1's residual had been latent since Phase 10.** `10-EVIDENCE-PRE-RENAME.md:88` records a local
sidecar plus real Nx runs against a read-only backend, with a control-table row reading *"no
PUT-to-read-only-backend crash"*. Phase 10 stood on this exact seam and recorded only that nothing
crashed -- never whether a PUT arrived. That omission IS A1, and it sat in a table that read as
coverage for three phases.

## Still open, and independent of this task

**PR #16 is BLOCKED on the `publish-verify` regression.** It fails on both legs at the Phase 13
tip, succeeded on all five prior `main` pushes, and is push-gated so it is invisible to every PR
run. Mechanism not established. That is the highest-value open thread in the project.

**`o3-witness` is not Case-B-safe** (surfaced by `260802-toz`, recorded here in ROADMAP and
`13-EVIDENCE.md` ADDENDUM 3). It asserts a CREATION ordering, which has no event to observe on a
run where every producer HITs. The first post-Phase-13 PR touching no declared input will redden it
falsely.
