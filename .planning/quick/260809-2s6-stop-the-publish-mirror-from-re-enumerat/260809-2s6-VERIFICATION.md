---
phase: 260809-2s6
verified: 2026-08-09T03:20:00Z
status: human_needed
score: 6/7 must-haves verified
behavior_unverified: 1
overrides_applied: 0
verification_method: "goal-backward against the codebase at e78a842; every gate re-proven by INDEPENDENT mutation (applied, observed red, reverted), not by reading the SUMMARY's mutation table"
behavior_unverified_items:
  - truth: "A publish leg still restores and mirrors EVERY seed entry belonging to its own run, at every feed index, so both publish-verify legs stay green (C1)."
    test: "Open a temporary main window, push, then read both publish-verify leg logs for the cache HIT on feed<i><run_id> and the mirrored-by label."
    expected: "Both legs green; each leg finds its own feed<i> seed as a Release asset in the current month shard."
    why_human: "publish/publish-verify are push-gated to the default branch. The unit half is proven (both feed indices survive the filter, asserted as an exact restore-call list); the live round-trip is not reachable from a PR run."
human_verification:
  - test: "Read the ubuntu and windows publish legs' OBS-01 summary after the first post-fix push to main."
    expected: "readMisses / scanned settles near the real-hash cohort's share; the new already-present (of skipped) row reconciles (misses + already-present <= skipped <= scanned)."
    why_human: "The post-fix ratio is DERIVED, never measured. It is also the D5 threshold's recorded revisit trigger."
  - test: "Confirm both publish-verify legs stay green on that same push."
    expected: "Each leg logs a cache HIT for its own feed<i><run_id> seed read back out of the shard."
    why_human: "Push-gated; C1's live half."
  - test: "Confirm the bead round-trip: dogfood-seed PUTs bead<run_id> and dogfood-verify GETs it back."
    expected: "dogfood-verify (both legs) reports a cross-job HIT under the new key."
    why_human: "The two halves are pinned equal by spec, but the live cross-job HIT has only ever run under the superseded bare-run-id key."
deferred:
  - truth: "10-VERIFICATION.md's L3 `expected: readMisses 0` corrected to the post-fix steady state (CONTEXT canonical-refs)."
    addressed_in: "the first live post-fix run on main (the same window that closes the three items above)"
    evidence: "The correct value IS behavior_unverified item 1. The record is not currently misleading: the same L3 block already stamps 'FALSIFIED: readMisses is 63, not 0' and carries a full open_sub_item explaining it."
---

# Quick Task 260809-2s6: Stop the publish mirror re-enumerating prior runs' seeds -- Verification Report

**Goal:** stop the publish mirror from re-enumerating prior runs' seed entries, which cause
48 of the 63 readMisses and leave 38 of 87 shard assets as CI scratch.
**Verified:** 2026-08-09 against `e78a842` (base `fbfd88a`), main tree.
**Status:** human_needed -- no gaps; three live-CI observations outstanding and honestly recorded.

## Method

SUMMARY.md's claims were treated as unverified. Every gate the executor added was re-proven
INDEPENDENTLY by mutation: apply, run the named test, observe red, `git checkout --` restore.
Working tree confirmed clean afterwards. The full suite was NOT re-run (already run
independently by the maintainer, all uncached, all green).

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | A publish leg does not attempt to restore a seed entry belonging to any run other than its own (D1). | VERIFIED | `isOtherRunsSeed` in `publish-mirror.ts`: marker-prefix AND not-ends-with-run-id, wired as a second `.filter` after `parseHash` and BEFORE the `Set`. MUTATION: forcing the predicate to fail open reddens the D1 case with a named diff (`['cafe77','bead77','feed077',...]` vs the expected five). |
| 2 | A publish leg still restores and mirrors EVERY seed entry belonging to its own run, at every feed index, so both publish-verify legs stay green (C1). | PRESENT_BEHAVIOR_UNVERIFIED | Unit half PROVEN: `feed099` and `feed199` both survive the filter in the exact restore-call array, and `mirrorSeedHash` is confirmed to emit `feed<i><runId>` -- a suffix match, so no feed index can be starved. Live half (legs staying green) is push-gated and NOT OBSERVED. |
| 3 | The dogfood seed/verify round-trip is keyed on a hex-letter-leading marker word plus the run id (D2). | VERIFIED | Both jobs carry `hash: bead${{ github.run_id }}`; no other `hash:` input in the file drifts. MUTATION: reverting ONLY dogfood-verify reddens the new round-trip case. `jobBlock` strips comments and throws on a missing job, and a neighbouring positive control proves the extraction is non-empty. |
| 4 | An entry already present in the shard is skipped without an Actions-cache round-trip (D3). | VERIFIED | Membership test hoisted above `actionsCache.get`, guarded on the lazily-resolved shard. MUTATION: deleting the pre-restore branch reddens the D3 case. |
| 5 | OBS-01 reports unrestorable misses and already-present skips as two distinct numbers, both labelled subsets of skipped (D4). | VERIFIED | `PublishResult.alreadyPresent` added; `runPublish` emits `already-present (of skipped)` alongside the byte-identical `restore-MISS (of skipped)`. Both label AND count asserted. Every loop iteration still increments exactly one of mirrored/skipped/failed. |
| 6 | A run whose unrestorable fraction exceeds the derived post-fix baseline emits exactly one warning; the total case stays covered (D5). | VERIFIED | `PARTIAL_READ_MISS_WARN_RATIO = 0.5` as an `else if` on the total-case gate. MUTATION: splitting the `else if` into a second `if` reddens the exclusivity case ("expected to be called once, but got 2 times"). |
| 7 | A present-AND-unrestorable entry counts as an already-present skip, not a read miss (D3's only reclassification). | VERIFIED | MUTATION: deleting the pre-restore branch flips the exact pair to `{readMisses: 1, alreadyPresent: 0}` -- the reclassification case pins the direction, not just the magnitude. |

**Score:** 6/7 verified (1 present, behavior-unverified).

### The three questions, applied to every added gate

| Gate | Would an honest FALSIFIED pass? | Would writing NOTHING pass? | Would DELETING the guarded text pass? |
|---|---|---|---|
| D2 ci.yml round-trip | No -- one-sided revert reddens (proven) | No -- a missing `hash:` yields `undefined`, which fails the exact match | No -- `jobBlock` throws on a renamed/deleted job |
| runId plumb | No -- dropping the argument reddens (proven), and the assertion is on the EXACT value, so a hardcoded constant cannot satisfy it | No -- `?.runId` resolves to `undefined` and fails | No |
| D1 filter | No -- fail-open mutation reddens (proven) | No -- the unfiltered array is asserted whole | No |
| D3 reorder | No -- deletion reddens two separate cases (proven) | No | No |
| D5 exclusivity | No -- `if`/`else if` split reddens (proven) | No | No |
| `PARTIAL_READ_MISS_WARN_RATIO === 0.5` | N/A -- this one is a fixture-coupling lock, not a behaviour gate. It is honest about that in its own message; the boundary cases carry the behaviour. |

### Locked Decisions

| Decision | Status | Evidence |
|---|---|---|
| D1 structural disjointness, not shape heuristics | IMPLEMENTED | Marker-prefix + run-id suffix; no digit-length heuristic anywhere. The dangerous direction (a real hash misread as a seed) is unreachable: real hashes are all-decimal, gated by an all-decimal fixture in the exact-array case. |
| D2 own hex marker word for the dogfood family | IMPLEMENTED | `bead`, hex-letter-leading, distinct from and not a prefix of `cafe`/`feed`. Deviation from the obvious `dead` is reasoned (the file already ships `deadbeef` as an unrelated readiness probe) -- a genuine review-legibility call, not a coin flip. |
| D3 membership before restore | IMPLEMENTED | Above the restore, undefined-safe, lazy shard resolution NOT hoisted (the D3 case fails if it were, and says so). |
| D4 split the conflated metric | IMPLEMENTED | Second subset counter, incremented from both membership branches and deliberately NOT from the 422 duplicate-upload race. |
| D5 partial guard with a non-default threshold | IMPLEMENTED | One half, argued from the measured baseline, with the rejected 33-42% band and the provenance reason recorded in code. The guard's own gap against its motivating case (it does not fire at 42%) is stated in the comment rather than left for review -- that self-disclosure is what makes the choice reviewable. |

### Locked Constraints

| Constraint | Status | How re-derived |
|---|---|---|
| C1 -- current run's seed mirrored at every feed index | HONOURED (unit) / UNOBSERVED (live) | The predicate admits on run-id SUFFIX, which is exactly what makes it feed-index-agnostic; `mirrorSeedHash` confirmed to end with the run id; both feed indices asserted present in the exact restore-call array. The live leg-green half is item 2 above. |
| C2 -- no `actions: write` | HONOURED | Re-derived independently, not read from the SUMMARY: a non-comment search across `.github/workflows/` exits 1, against the SAME regex shape for `actions: read` exiting 0 with two real grants. Every workspace hit for the literal is prose, a spec needle or a planning doc -- never a YAML grant. No permission block was touched by this task. |
| C3 -- `listCacheEntries` ref scoping untouched | HONOURED | `createPublishClient` is in `action/index.ts` and its `ref` argument, the TRUST-10 comment lock and its pinning spec are all byte-unchanged. The only `ref`-bearing line this task added is a new comment in `runPublish` that CITES TRUST-10 while justifying the sibling env read. The D1 filter is strictly narrowing, so it cannot widen the enumerated set. |
| C4 -- no retroactive correctness | HONOURED | Nothing deletes or rewrites existing entries; the accepted cost (28 bare-run-id seeds stay unfilterable until they evict) is carried explicitly in the D5 arithmetic. |
| C5 -- no new key prefix, no namespace switch | HONOURED | Keys remain `nx-cache-`; `bead` is a marker word inside the hash slot, the third instance of an existing convention. |
| C6 -- nothing merged, no shard asset deleted | HONOURED | Three commits on the feature branch; no merge; no asset-delete path exists in the diff. |
| C7 -- main tree, not a worktree | HONOURED | Corroborated by the maintainer's independent `check:action` reporting no drift and a clean tree after regeneration -- the verdict a junctioned worktree cannot produce. |

### Data-Flow Trace

| Artifact | Value | Source | Real data | Status |
|---|---|---|---|---|
| `publish-mirror.ts` | `options.runId` | `process.env.GITHUB_RUN_ID` forwarded by `runPublish` | Yes -- runner-injected on the same step as two other load-bearing reads | FLOWING (mutation-proven) |
| `publish-mirror.ts` | `SEED_MARKER_WORDS` | module literal | Matches the live producers: `cafe` from consumer-smoke's `RUN_HASH`, `bead` from both dogfood jobs, `feed` from `mirrorSeedHash` -- all three confirmed against the actual producing sites, all three keys confirmed to END with the run id | FLOWING |
| `action/index.ts` | `already-present (of skipped)` row | `result.alreadyPresent` | Yes -- both label and count asserted | FLOWING |

### Behavioural Spot-Checks (independent mutation battery)

| Mutation applied | Named test run | Result |
|---|---|---|
| `isOtherRunsSeed` forced to fail open | D1 exact-array case | RED with a diff naming the admitted stale seeds |
| `{ runId }` argument dropped from `runPublish` | run-id plumb case | RED: `expected undefined to be '31281406708'` |
| pre-restore membership branch deleted | D3 case | RED |
| pre-restore membership branch deleted | reclassification case | RED: the two counts swap, exactly as the case's message predicts |
| dogfood-verify's `hash:` reverted alone | D2 round-trip case | RED |
| D5 `else if` split into a second `if` | exclusivity case | RED: called twice |

All six reverted; `git status` clean.

## The three NOT OBSERVED items

Confirmed HONESTLY RECORDED as unobserved, and NOT inferred as satisfied by anything in the
diff. `publish` is push-gated to `main` and no window was opened.

1. **The post-fix `readMisses` / `scanned` ratio.** The SUMMARY states plainly that every
   figure behind the D5 threshold is DERIVED, names the assumption it rests on (which cohort
   D1 removes), and records the revisit trigger. The code comment says the same thing at the
   branch. No claim anywhere asserts the ratio has fallen.
2. **Both publish-verify legs staying green.** Recorded as a live observation, with the
   unit-level substitute (exact restore-call list including both feed indices) correctly
   described as the substitute rather than as the proof.
3. **The `bead` round-trip.** Recorded, and correctly qualified: the two halves are pinned
   equal by spec, but the cross-job HIT has only ever run under the old key.

The `scanned`-is-not-comparable warning is carried in three places (the filter comment, the
new warning text, and the SUMMARY's `affects`), so a reader comparing figures across the fix
cannot miss it. That is the right disclosure for a change that moves a denominator.

## The deliberate omission: 10-VERIFICATION.md's stale `readMisses 0`

**Assessment: leaving it is the right call, and it is not a gap.**

CONTEXT's canonical-refs did say the expectation "must be corrected as part of this task",
and no PLAN task covered it -- a planning miss the executor surfaced rather than papered
over. But correcting it now is not available:

- The correct post-fix value IS the thing recorded as NOT OBSERVED. Writing a derived number
  into a VERIFICATION record whose entire purpose is measured evidence would replace one
  unverified expectation with another -- in an artifact class this milestone has spent its
  length correcting for exactly that.
- No false claim is currently in force. The same L3 block already carries
  `FALSIFIED: readMisses is 63, not 0` and an `open_sub_item` explaining that the count is
  neither novel nor a regression. A reader of that file is not misled.
- The dispatch forbade committing planning artifacts, so the edit was out of the executor's
  hand regardless.

**Residual (advisory, not a gap):** a reader of 10-VERIFICATION.md has no pointer to this
task. When the live post-fix run lands and the real ratio exists, correct the `expected`
clause and add the back-reference in that same pass -- it is the same window that closes all
three items above. Tracked here as `deferred`.

## Anti-Patterns

| File | Pattern | Severity | Assessment |
|---|---|---|---|
| `ci.yml`, consumer-smoke round-trip step | Comment says the payload is "keyed on the run id (all-decimal -> valid ^[a-f0-9]+$)" while `RUN_HASH` is `cafe<run_id>` | INFO | PRE-EXISTING, introduced in phase 06 and falsified by the later `cafe` prefix -- not a regression from this task, and outside its sweep list. Worth a one-line fix next time that job is touched. |
| `mirror-seed.ts` docblock | "No word may be a prefix of another either, or the filter cannot split them." | INFO | Slight over-claim: the filter uses `some(startsWith)` and does not need to split families, so a prefix relation would not break it. The real cost of a prefix relation is shard-listing legibility. Harmless, and the rule it states is the right rule to follow. |

No debt markers (`TBD`/`FIXME`/`XXX`) introduced. No stubs. No `TODO`.

## Gaps

None.

## What is NOT gated, and why that is acceptable

`SEED_MARKER_WORDS` duplicates three literals authored elsewhere with no test tying them
together. This was checked rather than accepted on the comment's word: the drift direction
really is fail-open in every case -- a renamed producer word simply stops being filtered,
which is today's behaviour. The only dangerous edit would be adding a DECIMAL-leading word to
the array, which the docblock forbids and which no gate prevents. Residual risk judged low and
the reasoning is recorded at the array. Not a gap.

---

_Verified: 2026-08-09_
_Verifier: Claude (gsd-verifier), goal-backward with an independent mutation battery_
