---
phase: quick-260809-og2
plan: 01
subsystem: publish
tags: [publish-mirror, warnings, distribution-constraint, guards, docs]
status: complete
requires:
  - 260809-2s6 (the leak removal whose collateral this records)
  - 260809-hcr (the OBS-04 guard row this extends)
provides:
  - Both publish read-miss warnings state their cause list is not exhaustive
  - A consumer-general version-skew cause on both branches
  - The month-shard rollover cause on the partial branch alone, pinned from both sides
affects:
  - packages/github-cache/src/publish/publish-mirror.ts
  - packages/github-cache/src/publish/publish-mirror.spec.ts
  - docs/advanced.md
  - packages/github-cache/src/docs-same-os-claims.spec.ts
tech-stack:
  added: []
  patterns:
    - Absence asserted over mock.calls.flat(), never through a file read
    - Forbidden phrases split with a single-character character class
    - Asymmetry enforced by a paired positive/negative pin, never narrated
key-files:
  created: []
  modified:
    - packages/github-cache/src/publish/publish-mirror.ts
    - packages/github-cache/src/publish/publish-mirror.spec.ts
    - docs/advanced.md
    - packages/github-cache/src/docs-same-os-claims.spec.ts
decisions:
  - The closed enumeration is the defect, not the missing item -- the count is gone and every specific cause stayed
  - The version-skew cause is named in consumer-general terms, so no artifact of this repository enters a stranger's job log
  - The rollover cause goes on the partial branch only, because `readMisses === hashes.length` means no hash ever reached the lazy shard resolve
  - The cardinality is deliberately NOT re-pinned as a required phrase in the guard row
  - The rollover cause is described as a persistent step, not a one-time spike, because an entry that misses can never be mirrored back into the shard
metrics:
  tasks: 3
  commits: 4
  files_changed: 4
  review_rounds: 1
  completed: 2026-08-09
---

# Quick Task 260809-og2: The rollover misattribution in the publish mirror warning -- Summary

Both publish read-miss warnings stopped asserting a closed list of causes, gained the
version-skew cause that actually fires under a sidecar/publish artifact mismatch, and the
partial branch alone gained the month-shard rollover cause -- with a red-then-green guard
pair that enforces the asymmetry from both sides.

## What changed

**The defect.** Under a version skew between the artifact that wrote the entries and the
artifact publish runs from, both warnings fired naming a cache-version rotation the reader
never made, while naming nothing that occurred. The closed enumeration was the defect
rather than the missing item: the same message had already shed a true cause once
(`54677af`) with nothing reddening.

**Both messages** now read "Causes worth checking, and this list is not exhaustive" and
keep every cause they already named, so dropping the completeness claim cost the reader no
specificity. Both gained the skew cause, stated as "the sidecar that wrote these entries
and this publish step running at different versions of this action" -- a form a stranger
can act on inside their own repository, naming no artifact, run id, baseline or planning
path of this one.

**The asymmetry.** The partial branch gained a fourth cause, the first publish run against
a new month shard. The total gate did not, and must not: its working conjunct is
`readMisses === hashes.length`, so every hash took the miss branch and none reached the
lazy shard resolve, so the pre-restore membership skip never runs and rollover cannot move
its number. Both halves landed in the same commit -- alone, either is satisfied by putting
the clause on neither branch.

**The comments** carry what the messages cannot. The rotation-signal instruction now says
the branch fires on a version skew as well and names action-bundle drift as this
repository's own instance of that class. The stranger's-CI-log block records that
`54677af` dropped the self-perpetuating-cohort cause as collateral of a leak removal --
stated as what the diff shows, never as that commit's intent -- and why it is not restored
as a numbered item.

**The prose** no longer counts the causes. Two sentences in `docs/advanced.md` asserted a
cardinality the messages no longer carry, and neither was pinned by any guard row. The
OBS-04 row's docstring records why the count left and why it is not re-pinned.

## The RED evidence

Task 1's guards landed failing, before any message was touched. `npx nx test github-cache
--skip-nx-cache` exited 1 with 2 failed of 1079, both in the new assertions and neither a
syntax error:

- The partial fixture failed on the closed-enumeration retraction, and the failure output
  printed the full recorded message -- which demonstrably carried neither of the two new
  phrases.
- The total-gate fixture failed on the version-skew requirement.
- The rollover needle returned exit 1 across the entire captured log while that log
  contained the emitted partial message verbatim, which is direct proof the rollover pin
  was red against the current message rather than merely unreached.

Every pre-existing case in the file stayed green through the red run. All 1079 pass after
Task 2.

## Verification

| Gate | Result |
|---|---|
| `npx nx test github-cache --skip-nx-cache` | 43 files, 1079 tests, exit 0 |
| `npx nx run github-cache:typecheck` | exit 0 |
| `npx nx run github-cache:lint` | exit 0 |
| `rg -c -F 'candidate causes' <src>` | exit 1 (was 3) |
| `rg -c -F 'restored as a MISS' <src>` (paired positive control) | 3, exit 0 |
| `rg -c -F 'not exhaustive' <src>` | 3, exit 0 |
| retraction removed from both messages (BL-01 red probe) | 2 failed of 1079, one per fixture |
| `rg -c -F 'one-time rise' <src>` | exit 1 (reworded, WR-03) |
| `rg -c -F 'different versions of this action' <src>` | 2, exit 0 |
| `rg -c -F 'new month shard' <src>` | 1, exit 0 |
| ASCII sweep over all four files | clean |
| Cardinality phrases in `docs/advanced.md` | exit 1 |
| OBS-04 three required phrases | 3, exit 0 |
| `.planning/REQUIREMENTS.md` in the diff | absent |
| `npm run check:action` | exit 0, no drift |

`git diff --name-only ded3ddf..HEAD` lists exactly the four planned files.

The plan predicted `check:action` would be a no-op here because `publishMirror` is not
inlined in the sidecar bundle. Confirmed: it regenerated clean.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Stale claim in a file being edited] The sibling total-gate case asserted a
cardinality the change makes false**

- **Found during:** Task 2, after the messages went green.
- **Issue:** `publish-mirror.spec.ts` carried a test titled "names the cache-VERSION axis,
  **both candidate causes**, and the two-push gate", plus `Cause 1` / `Cause 2` comment
  labels. The title asserted the same closed count the task exists to remove, in the file
  that proves it absent, and the ordinals pointed at the wrong items after the message
  gained a cause at position 2.
- **Fix:** Title now reads "the causes worth checking"; the two comment labels name the
  cause instead of its position, with one line saying why -- a position in an open list is
  not a stable identifier.
- **Files modified:** `packages/github-cache/src/publish/publish-mirror.spec.ts`
- **Commit:** `5a5ed82`
- **Why not deferred:** the plan's own must-have is that no closed enumeration survives,
  and Task 3 retires exactly this claim from the prose. Leaving it in the guard file would
  have left the count asserted in the one place a reader checks for its absence.

No other deviations. All 9 of RESEARCH's MUST NOT items are absent from the result; both
message bodies and both docs edits were lifted verbatim from RESEARCH's sanctioned wording.

## Review Round 1 (`845b9cc`)

Code review of `51dadac`, `5a5ed82`, `e94c649` returned 0 Critical, 2 High, 4 Medium,
4 Low, 4 Info. The reviewer independently re-derived the asymmetry and confirmed it holds,
including a counterfactual the plan never checked: rollover cannot make the total gate fire
where it previously did not, because suppression needs a resolved shard, which needs a
restore HIT, and the restore outcome is a pure function of the hash and unchanged by
rollover.

**Both High findings were in this change's own subject matter, and both are fixed.**

**BL-01 -- the headline claim shipped unguarded.** No spec anywhere asserted `not
exhaustive`; deleting the clause from both messages left all 1079 tests green. The only
committed pin was the phrase-level absence row, which catches a verbatim relapse of the
retired wording and nothing else. The `rg` that appeared to cover it lived in a verify
block and proved the state of one tree at one moment. This is the same defect class the
task exists to fix -- a claim nothing enforces. Both branch fixtures now require the clause
through `publishMirror`.

RED evidence, measured rather than argued: with `and this list is not exhaustive` removed
from both message bodies, `npx nx test github-cache --skip-nx-cache` exits 1 with 2 failed
of 1079 -- one per fixture, each naming the needle:

```
FAIL ... > warns ONCE just ABOVE the target rate (10 entries, 9 misses -- bound 0.5958)
AssertionError: expected 'github-cache publish: 9 of 10 server-...' to contain 'this list is not exhaustive'
FAIL ... > fires the TOTAL-case branch, not the partial one, when everything missed
AssertionError: expected 'github-cache publish: all 2 server-pr...' to contain 'this list is not exhaustive'
```

The source file was restored from a byte copy and re-verified green.

**BL-02 -- a new comment described a condition that routes to the sibling branch.** It said
the partial branch fires where "every enumerated entry misses" -- which is
`readMisses === hashes.length` with nothing mirrored, i.e. the total gate, making the
`else if` unreachable. It contradicted its own neighbouring paragraph, and a reader
reasoning from it would have concluded the skew cause belongs on the total gate: the exact
asymmetry error the change is built to prevent. It now states the true, narrower mechanism
and says why the shape lands on the partial branch.

### Medium and Low -- per finding

| ID | Verdict | Note |
|---|---|---|
| WR-01 | Fixed | `mirrored === 0` does not imply an unresolved shard -- already-present, cap, burned-tag and upload-fault runs all resolve one. Premise corrected to `readMisses === hashes.length`. Written in one site only (the spec comment); the source comments at the D3 reorder are pre-existing and already state it correctly. The assertions were not touched -- they were right. |
| WR-02 | Fixed, wording NOT lifted | The docs kept "the same causes" after the change made the two lists differ by one. Now names the difference. The reviewer's proposed replacement embedded the very `mirrored === 0` premise WR-01 corrects, so it was rewritten with the accurate one. |
| WR-03 | Fixed | "a one-time rise" was wrong: an entry that misses is never mirrored, so it is never in the shard, so it is re-attempted and misses again every run of that month. A step, not a spike -- and the comment twenty lines above said so already. Message reworded; the pinned needle survives unchanged. |
| WR-04 | Fixed | The guard-row docstring spelled both retired phrases verbatim, against the rule that file states about itself three times. Described by concept instead; the relapse search now returns only the split regex. |
| IN-01 | Fixed, one gap declined | Regex hoisted to a shared `FORBIDDEN_ARTIFACTS` constant and the trailing-slash requirement dropped. Run-id coverage (blocklist item 7) declined: a digit-shaped needle would match the entry counts the messages legitimately carry. Gap recorded in the constant's docstring rather than left implicit. |
| IN-02 | Fixed | "no count at all" overstated -- the messages still enumerate. What left is the completeness claim. |
| IN-03 | Fixed | The retitled sibling case now pins the skew cause its title names. |
| IN-04 | Fixed | "which computes two cache versions" bound the relative clause to `this action`; now "so two cache versions exist in one repository". |

Nothing was declined outright. One sub-item of IN-01 was declined with reasons above.

## Known Stubs

None.

## GSD Tracking Handlers

Not run. The task constraints assign the docs commit -- SUMMARY, PLAN, CONTEXT, RESEARCH,
STATE -- to the orchestrator, and this project's recorded handler defects (`state
record-metric` rejecting positional args, per-plan handlers corrupting tracking files) make
an executor-side run a net risk to files this executor does not own. `ROADMAP.md` untouched
per instruction.

## Self-Check: PASSED

- `packages/github-cache/src/publish/publish-mirror.ts` -- FOUND
- `packages/github-cache/src/publish/publish-mirror.spec.ts` -- FOUND
- `docs/advanced.md` -- FOUND
- `packages/github-cache/src/docs-same-os-claims.spec.ts` -- FOUND
- commit `51dadac` -- FOUND
- commit `5a5ed82` -- FOUND
- commit `e94c649` -- FOUND
- commit `845b9cc` (review round 1) -- FOUND
