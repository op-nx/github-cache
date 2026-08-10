---
phase: 11-live-proofs-o1-o2-o3
plan: 07
subsystem: live-ci-evidence
tags: [o3, live-proof, push-and-restore, o3-witness, positive-control, phase-close]
requires:
  - '11-06 ci.yml instrumentation: the integration probe steps and the o3-witness job'
  - '11-04 sign-off and its two transferred mechanics: exact .key equality, one hash on two refs'
  - '11-03 11-EVIDENCE.md with the O3 PENDING placeholder and the O4 RESERVED section'
provides:
  - '11-EVIDENCE.md O3 section: TEST-09 parts 1, 2 and 3 all satisfied'
  - 'a calibrated o3-witness job, GREEN on both a push and a pull request'
  - 'a re-warmed mirror under the post-Phase-11 hashes, which Phase 12 needs'
affects:
  - 'Phase 12 (inherits the calibrated instruments; XOS-04 changes the graph premise)'
tech-stack:
  added: []
  patterns:
    - 'read-only pre-flight escalated to a total_count read when an empty listing makes a no-match unfalsifiable'
    - 'rehearse on a PR for mechanics, prove on a push for commensurability'
    - '--force-with-lease as a concurrency guard on a leg that needs no force at all'
key-files:
  created: []
  modified:
    - .planning/phases/11-live-proofs-o1-o2-o3/11-EVIDENCE.md
    - .planning/REQUIREMENTS.md
decisions:
  - 'The maintainer took the gate in TWO stages: rehearse-on-pr first, then proceed'
  - 'PR #11 was CLOSED before the proving push rather than left to auto-merge, diverging from the Phase 9 and Phase 10 precedent'
  - 'The 23 green-leg count was pre-registered at the gate, closing a D-23 gap in the plan table'
metrics:
  duration: 55m
  completed: 2026-07-30
status: complete
---

# Phase 11 Plan 07: The O3 live proof -- Summary

O3 is PROVEN. All three TEST-09 parts landed on push run `30500255530`, `main` was restored and
verified by SHA equality, and the debug variable is gone with both timestamps on record. This
closes the phase's live-CI half.

## Task 1 -- the blocking gate

**Selected option id: `rehearse-on-pr` first, then `proceed`.** The maintainer took the gate in two
stages rather than one, which the plan permits (`rehearse-on-pr` explicitly returns to task 1 for a
fresh selection).

### Secret pre-flight (the precedence trap) -- NOT FOUND

**NOT FOUND, and a genuine no-match is the pass condition.** Recorded with the escalation that made
it trustworthy: `gh secret list` exited 0 with EMPTY output and the filter exited 1, but a positive
control (`rg -c '.'` over the same listing) ALSO exited 1 -- so "no match" could not be
distinguished from "nothing was read at all". The REST read resolved it definitively:

```
GET repos/op-nx/github-cache/actions/secrets  ->  {"total_count":0,"secrets":[]}
```

Zero secrets of ANY name, established by a positive count field rather than by an empty-output
no-match. GitHub documents that the secret takes precedence over the variable when both exist, so
this is what makes D-21's variable trustworthy from the configuration side.

### Other pre-flight facts

| Item | Value |
|---|---|
| `ACTIONS_STEP_DEBUG` variable BEFORE state | ABSENT (`total_count = 0`) |
| `ACTIONS_RUNNER_DEBUG` | absent, and deliberately NOT touched |
| Phase branch HEAD | `38f9aea` |
| `origin/main` | `fe25a3f` |
| Divergence `origin/main...HEAD` | `0  240` -- `main` a STRICT ANCESTOR, so the outbound push is a FAST-FORWARD |
| Backup ref | `refs/heads/backup/main-before-phase11-verify`, absent beforehand, a clean add |
| Committer identity | PASS -- exactly ONE distinct email-shaped token across all 240 commits, and it is the approved public address (checked by allowlist-inversion) |
| Working tree | clean |

No write operation was performed by task 1.

## Task 2 -- the proving run

### D-21, both timestamps

| Event | UTC |
|---|---|
| `ACTIONS_STEP_DEBUG` SET to `true` | **`2026-07-29T23:39:35Z`** |
| `ACTIONS_STEP_DEBUG` DELETED | **`2026-07-29T23:57:22Z`** |

Both confirmed by a listing after each write: `total_count=1` with value `true` after the set,
`total_count=0` after the delete. Window open for about 18 minutes.

### The run

| Item | Value |
|---|---|
| Run URL | `https://github.com/op-nx/github-cache/actions/runs/30500255530` |
| Run id | `30500255530`, event `push`, branch `main`, head `38f9aea` |
| Conclusion | `success` -- **23 of 23 job legs green** |
| Outbound push | `fe25a3f..38f9aea`, a FAST-FORWARD (two-dot), not forced |
| Restore push | `38f9aea...fe25a3f`, forced update |
| Restore push run | **`30501074211`**, event `push`, head `fe25a3f` -- the advance prediction resolving |

### `o3-witness` -- delta 144 s

```
o3-witness: H_linux=18442367512424001648
o3-witness: key=nx-cache-18442367512424001648 created_at=2026-07-29T23:40:37.933086000Z started_at=2026-07-29T23:43:01Z delta=144s margin=30s
o3-witness: EXISTENCE OK key=nx-cache-18442367512424001648 created_at=2026-07-29T23:40:37.933086000Z started_at=2026-07-29T23:43:01Z delta=144s margin=30s
```

### Positive controls -- 200 on BOTH legs

```
integration (ubuntu-24.04-arm): positive control: GET /v1/cache/18442367512424001648 -> 200 (wanted 200)
integration (windows-11-arm): positive control: GET /v1/cache/4283357908429349587 -> 200 (wanted 200)
```

### Windows label count and cacheStatus

```
integration (windows-11-arm): integration hash=4283357908429349587 cacheStatus=cache-miss status=0
integration (windows-11-arm): remote-cache label occurrences on windows-11-arm: 0 -- RECORDED, never gated
```

The count of **0** was **RECORDED and never GATED**. Nothing in the workflow gates on it, because a
zero count is correct on the Windows leg AND on any re-run at the same commit, and a tripwire that
fires on correct work gets disabled.

### Run-level non-vacuity -- MET, and CONFIRMED rather than rescued

ubuntu `build`: **2** remote-cache label occurrences, `Cache: 1/1 hit (100%)`. `build`'s hash did
not rotate on this commit, exactly as the plan predicted, so the run was demonstrably not an
everything-misses run. No re-run was performed to obtain a better number.

### Restore, verified by SHA EQUALITY

```
expected = fe25a3f865f20f3d4f8a40e96f8cb5717608ba8a
actual   = fe25a3f865f20f3d4f8a40e96f8cb5717608ba8a
ASSERT PASS: origin/main EQUALS the recorded pre-push SHA
```

Asserted by equality, not by assumption. Backup ref RETAINED on the remote at
`refs/heads/backup/main-before-phase11-verify` = `fe25a3f`.

## Every pre-registered count, beside its observed value

No pre-registered value was edited after the run.

| Observation | Pre-registered | Observed | Verdict |
|---|---|---|---|
| `o3-witness` delta (s) | at least 30 (range 109-182) | 144 | **MET** |
| positive control, ubuntu | 200 | 200 | **MET** |
| positive control, windows | 200 | 200 | **MET** |
| Windows label occurrences | 0, recorded not gated | 0, recorded not gated | **MET** |
| Windows `cacheStatus` | `cache-miss` | `cache-miss` | **MET** |
| echoed `runner.debug` | `1` | `1` on both legs | **MET** |
| ubuntu `build` label occurrences (non-vacuity) | at least 1 | 2 | **MET** |
| ubuntu `integration` label occurrences | 0 | 0 | **MET** |
| green job legs | 23 | 23 of 23 | **MET** |

## Task 3 -- the evidence

`11-EVIDENCE.md` O3 section replaces the PENDING placeholder. The literal `PENDING` was cleared
from all THREE lines it occupied (18, 32 and 719), not just the section heading -- the plan's
automated check asserts it appears nowhere, and clearing only the heading would have failed it.

`## O4 (XOS-04, XOS-05) -- RESERVED` is intact and untouched: neither filled nor deleted.

The plan's automated verification passes: `O3 evidence complete`.

## Requirements

| ID | Action | Checkbox | Traceability row |
|---|---|---|---|
| XOS-03 | **flipped to Complete** | `[x]` | `Complete (live-CI: push run 30500255530 ...)` |
| TEST-09 | **flipped to Complete** | `[x]` | `Complete (all three parts on push run 30500255530 ...)` |
| TEST-08 | **deliberately NOT flipped** | `[ ]` | `Pending (O4 evidence row appended in Phase 12)` |

TEST-08 spans O1-O4 and O4 is Phase 12's, so it cannot close here. Every Phase 11 checkbox was
verified to AGREE with its traceability row -- see the deviation below, because they did not agree
on their own.

## Deviations from Plan

### 1. [Rule 1 - Bug] `requirements.mark-complete` ticked the boxes and left the traceability rows `Pending`

- **Found during:** task 3, on the post-flip agreement check.
- **Issue:** the SDK verb set `- [x]` for XOS-03 and TEST-09 but left rows 653 and 655 reading
  `Pending (live-CI only)`. This is the same defect 11-03 hit, and it is the reason the check was
  run at all rather than trusted.
- **Fix:** both rows rewritten to `Complete (...)` with the run id and the measured values, matching
  the format of the Phase 10 rows around them. TEST-08's row deliberately untouched.
- **Files modified:** `.planning/REQUIREMENTS.md`. **Commit:** `111db37`.

### 2. [Rule 3 - Blocking] A redundant stale-head run was cancelled during the rehearsal

Reopening PR #11 fired TWO runs: `30499449426` at the stale head `0bea74b` and `30499450423` at
`38f9aea`. The stale one was cancelled. `o3-witness` is ABSENT from `ci.yml` at `0bea74b` so it had
no rehearsal value, and both runs shared the `refs/pull/11/merge` cache scope -- a concurrent write
of the same `nx-cache-<H_linux>` key would have perturbed the exact `created_at` the witness
measures. Left alone it would have corrupted the rehearsal's timing reading.

### 3. The 23 green-leg count was pre-registered at the gate, closing a D-23 gap in the plan

The plan's `## Pre-registered counts` table carries no total green-leg count, yet task 2 requires
recording "the run conclusion with the number of green job legs" -- a green-job claim, which D-23
says must be paired with a count fixed BEFORE the run. 23 was computed from the workflow YAML and
registered in the checkpoint return before anything was pushed. It reconciled independently against
the rehearsal (15 green PR legs + 8 push-only legs = 23) and the proving run observed exactly 23.

### 4. The restore push was blocked once by a transient tooling error and retried

The first `git push` of step E was denied by the auto-mode classifier with a stated transient
stage-2 error. `main` was at `38f9aea` at that moment -- the exact between-C-and-F hazard flagged at
the gate. The same authorised command was retried immediately and succeeded
(`+ 38f9aea...fe25a3f ... (forced update)`), then the SHA-equality assertion and the mandatory step
F both ran. Recorded rather than omitted because a reader of the reflog will see the gap.

### 5. Maintainer-selected process changes, recorded for the record

Neither is a deviation by the executor; both were explicit selections.

- The gate was taken in two stages (`rehearse-on-pr`, then `proceed`).
- PR #11 was CLOSED before the proving push rather than allowed to auto-merge, a considered
  divergence from the Phase 9 and Phase 10 precedent, to avoid a permanent MERGED record for a
  `main` state that existed for about fifteen minutes.

## A finding recorded in the evidence, not buried here

The design's stated reason a PR cannot be the proof is that `integration` takes the merge commit
while `hash-parity` pins the head SHA, so they measure different trees. Measured on the rehearsal:
`refs/pull/11/merge` was a distinct COMMIT (`376975c`) but its TREE was byte-identical to the head's
(`f6610d3`), with an empty diff. At this divergence state the incommensurability did not obtain.
The push remained correct for three reasons that survive it -- the tree identity is contingent on
`main` staying a strict ancestor, it rests on a tree-identity rather than commit-identity argument,
and only a push re-warms the mirror. Written into `11-EVIDENCE.md` so a later reader gets it from
the record instead of rediscovering it.

Also recorded there: the `.ref` clause was NOT exercised as a discriminator by the rehearsal (one
exact-key match only), so the reason it stays is 11-04's measurement, not anything observed here.

## Known Stubs

None. This plan rotated no hash and shipped no code -- its only artifact is the evidence record.

## Deferred Items

`integration-nx.log`, `integration-hash.txt` and `o3-witness.log` remain absent from `.gitignore`,
carried forward unchanged from plan 11-06. They are created only inside CI jobs on ephemeral
runners. Still logged rather than done: this plan's scope is the evidence record.

## Threat Flags

None new. T-11-06 (the force-push) was mitigated as planned and then some -- the outbound leg
measured as a fast-forward, `--force-with-lease` guarded both legs against a concurrent third-party
push, and `fe25a3f` was already preserved by two pre-existing REMOTE refs
(`refs/heads/backup/main-before-phase10-verify` and `refs/tags/backup/pre-phase09-temp-push-main`)
before this plan created a third. T-11-04 closed by the confirmed delete. T-11-24 closed from both
the configuration and the effect side. T-11-25 held: no pre-registered value was edited after the
run. T-11-26 held: a FRESH push, never a workflow re-run. T-11-03 held: named fields only, no raw
REST payload, ASCII-only and no address of any kind, all asserted mechanically.

## Self-Check: PASSED

- `.planning/phases/11-live-proofs-o1-o2-o3/11-EVIDENCE.md` exists; the plan's automated check
  prints `O3 evidence complete`.
- `## O4 (XOS-04, XOS-05) -- RESERVED` present at line 1002 with its do-not-fill guard intact.
- `PENDING` appears nowhere in the file.
- Commit `111db37` is reachable in `git log`.
- `origin/main` = `fe25a3f865f20f3d4f8a40e96f8cb5717608ba8a`, asserted equal.
- `ACTIONS_STEP_DEBUG` absent, `total_count = 0`.
- Backup ref retained on the remote at `fe25a3f`.
