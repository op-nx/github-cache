---
quick_id: 260802-toz
status: complete
date: 2026-08-02
outcome: "Case B PROVEN; A1 ANSWERED not closed; publish-verify regression found (merge-blocking)"
commits: 095291c..bb5e1f7
---

# Quick 260802-toz -- Summary

## Goal

Close the two items Phase 13 finished with everything except a live observation: **Case B** (a
restore from the default-branch scope) and **RESEARCH assumption A1** (the 403 path). Neither was
observable from the phase branch, so the maintainer authorised a TEMPORARY push of the Phase 13 tip
to `main`, to be restored afterwards.

## Outcome

| Item | Result |
|------|--------|
| Case B | **PROVEN** (run `30768540898`) |
| Assumption A1 | **ANSWERED, not closed** (run `30768554184`) |
| `publish-verify` | **REGRESSION FOUND** -- merge-blocking, unplanned |
| O3 witness | **NEW LIMITATION FOUND** -- not Case-B-safe |
| `main` | Restored to `fe25a3f`, verified |
| PR #12 -> #16 | Replaced; #12 preserved as CLOSED, never marked merged |

Full evidence with pre-registrations: `260802-toz-EVIDENCE.md`.

## What made the window safe

The one thing that had to be right. PR #12's head SHA was byte-identical to the tip being pushed,
so pushing with it OPEN would have made that SHA reachable from `main` and GitHub would have marked
the PR **Merged** -- permanently, since a PR cannot be un-merged. The later `main` restore would
then have left a public repo showing #12 merged while `main` did not contain it: the git side is
restorable, the PR status is not.

Closing #12 FIRST breaks that link. Verified after the push: `state=CLOSED mergedAt=null`, and
still so after the restore. This was the maintainer's sequencing, and it is the reason the window
left no permanent trace.

Backups were made local AND remote (`refs/backups/main-pre-phase13-verify` = `fe25a3f`) before
anything was closed or pushed, so the restore never depended on local state surviving.

## Case B -- PROVEN

All three ubuntu producers HIT their baseline keys and emitted **zero** `Sent` bytes, so nothing was
written that run and no same-run merge-ref entry existed to restore from. The three Windows legs
restored the baseline keys **byte for byte** -- 137951 / 98227 / 1299 -- at counts 1 / 2 / 1.

Narrowed honestly, and pre-registered as such: this does not distinguish base-branch scope from
default-branch scope, because for a PR off `main` they are the same ref. The load-bearing claim --
restored from a scope populated BEFORE the run, outside this run's own merge ref -- is what the
gate's soundness needs, and that is proven.

## A1 -- ANSWERED, not closed

The partial-miss condition was achieved exactly as pre-registered: `typecheck-windows` count **1**,
green, floor cleared, with `build`/`test` unaffected at 1/1 as the same-run positive control. A task
provably EXECUTED rather than replayed -- `Nx read the output ... for 1 out of 2`, against the
Case-B run's `2 out of 2` on the same leg.

The leg carries **zero** 403 tokens and no store-failure wording. So A1's practical question -- does
the read-only 403 create log noise a reader must triage? -- is answered: **none**.

Not closed, because absence of noise cannot distinguish "PUT attempted and silently refused" from
"no PUT attempted". `server.ts:129` answers with an empty body and logs nothing, so neither world
leaves a trace. Closing it needs the sidecar to record refused PUTs -- a code change, out of scope
for an observation task. Net movement: A1 goes from *unexercised* to *exercised, with no observable
noise*.

## Unplanned findings

### `publish-verify` is broken on this branch (merge-blocking)

24 success / 2 failure on run `30767511870`, both `publish-verify` legs, at the round-trip
read-back. A **regression** by history: it succeeded on all five prior `main` pushes and fails on
both legs here, and this branch changes that code by 1888 insertions.

**No PR run could ever have caught it** -- `publish-verify` is push-gated and structurally skipped
on every pull request. Exactly the v0.0.1 retrospective's top lesson.

Measured: the August shard release exists with **zero assets**; every asset upload returned 422 and
was swallowed as benign; the seed asset is unique per run so its 422 cannot mean "already exists".
NOT established: the mechanism. The month-boundary hypothesis is unconfirmed -- the shard was
created at `12:36Z`, before the `21:19Z` run. Root-cause is its own task; it needs no rewritten
`main`.

### The O3 witness is not Case-B-safe

`o3-witness` was the Case-B run's only failure, asserting that the linux entry existed *before* the
Windows integration step started. That is a CREATION ordering, and on a Case-B run nothing is
created because every producer HITs. The first real post-merge PR touching no declared input will
redden it the same way -- a false red, since the three green read-only legs in that same run show
the property holds.

## Process notes

- `gsd-plan-checker` found 3 blockers, and one was load-bearing: an Nx MISS-and-SAVE does not print
  its key, so the plan's baseline extraction could never satisfy its own GO condition -- and the one
  key it *could* extract was a failed-reserve race artifact belonging to a DIFFERENT task. Adopting
  it would have put a silent mis-attribution under the entire Case-B claim. Corrections recorded as
  C1-C6 rather than silently applied.
- The orchestrator did NOT delegate the outward-facing git operations (close, force-push, restore)
  to a worktree-isolated executor. Deliberate: a force-push to `main` is not a thing to hand to an
  agent.
- Both observations ran CONCURRENTLY. `ci.yml:34-36` keys concurrency on `github.ref`, so two PRs
  are two groups, and PR runs write only into their own merge-ref scope. Verified by the checker
  before use; it halved the window `main` stayed rewritten.
