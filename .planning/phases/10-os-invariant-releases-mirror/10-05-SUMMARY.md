---
phase: 10-os-invariant-releases-mirror
plan: 05
subsystem: infra
tags: [github-actions, provenance, pagination, vitest, tdd, obs-05, xos-06]

# Dependency graph
requires:
  - phase: 10-04
    provides: "`mirrorSeedHash` and the `mirror-seed` operation branch -- the write half this plan's reader now derives against, and the reason the workflow flip is a one-line change rather than new arithmetic"
  - phase: 10-03
    provides: the `jobBlock` positive control this plan's `max-parallel` value guard reuses, and the two-harness split (raw read for a comment PHRASE, comment-stripped read for a YAML VALUE)
  - phase: 10-02
    provides: the `mirrored-by` label seam, without which there is no publisher identity to assert
provides:
  - "`ci.yml`'s `publish` job seeds `operation: mirror-seed`, so each leg writes a key only that leg can produce -- flipped in the SAME commit as the reader's derivation"
  - "`read-back.ts` accepts exactly ONE of `CACHE_OS_VALUES.length` payloads again (D-15), and its do-not-unify lock keeps its conclusion with a rewritten reason"
  - a paginated `mirrored-by` label assertion -- the ONLY mechanism that detects a dead publish leg, mutation-proven offline
  - "the repo's FIRST `max-parallel` value guard: reverting `max-parallel: 1` reddened nothing before this plan"
  - "XOS-06's two-way comment lock, and D-21's closure of `ci.yml`'s `publish-verify` job comment"
affects: [10-06, 10-07 CORR-02 rename, 10-VERIFICATION, 10-SECURITY]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Two halves of one wire contract flipped in ONE commit, asserted with `git show --stat`, because either half alone produces a silent MISS'
    - 'A paginated GitHub asset lookup in a bin, authored locally rather than by widening a client seam that sits inside the consumer bundle'
    - 'The real global `Response` in a fetch fake, so status discrimination cannot hide behind a lenient stub'
    - 'A page-SEQUENCE assertion (`[1, 2]`) plus a requested-`per_page` assertion, so a multi-page case is non-vacuous rather than merely present'
    - 'One inequality covering three rejection classes (wrong publisher, empty label, null label) with all three named in the message'
    - 'Splitting one comment lock into SEPARATE guard rows so deleting clause A reddens something distinguishable from deleting clause B'

key-files:
  created: []
  modified:
    - .github/workflows/ci.yml
    - packages/github-cache/src/roundtrip/read-back.ts
    - packages/github-cache/src/roundtrip/read-back.spec.ts
    - packages/github-cache/src/dogfood-cross-os.spec.ts
    - packages/github-cache/src/docs-same-os-claims.spec.ts

key-decisions:
  - 'The workflow flip and the reader derivation are ONE commit (`11f2dd2`), proven by `git show --stat`. An intermediate state MISSes on the next default-branch push, so this is a correctness property of the commit boundary, not a tidiness preference'
  - '`MIRRORED_BY_PREFIX` is authored a SECOND time in `read-back.ts` rather than extracted to a leaf. Rejected the extraction on a measured asymmetry: a drift here fails LOUD (publish-verify reddens naming both values), unlike an asset-name drift which MISSes silently -- and the pinned-literal discipline is already the house pattern for exactly this (`dogfood-body.ts`)'
  - 'The 404-versus-fault SPLIT from `releases-backend.ts` is deliberately NOT copied. That module has TWO outcomes (404 = try the next shard); this bin has already observed a HIT and has exactly ONE outcome for every non-ok status. The status is named in the message, so no diagnosis is lost and no untested branch is added'
  - 'An absent `GITHUB_RUN_ID` needed its OWN guard. `mirrorSeedHash("", os)` is `feed<index>` -- valid lowercase hex -- so the derived-hash check ACCEPTS it. One guard became two, with two diagnoses'
  - 'The three `max-parallel` clauses are three SEPARATE guard rows, not one row with nine phrases, so mutation 1 (delete the guard-sensitivity clause) reddens something distinguishable from deleting the rejected argument'
  - "XOS-06's value guard SHARES the XOS-07 describe and its positive control. The title is cited by 10-03-SUMMARY's coverage refs, so renaming it would rot those references, and a second describe would duplicate the repo's only job-block extractor for one assertion"

patterns-established:
  - 'Verifying every comment-lock phrase is a SINGLE-LINE substring in a scratch draft BEFORE writing the guard rows -- `read()` is raw, so a phrase spanning a hard wrap is a silent false PASS in the additive direction'
  - 'Mutating a FIXTURE in both directions (remove the fault / plant the fault) to separate "the guard reads the field" from "the guard rejects the wrong value"'
  - 'Recording which RED cases passed VACUOUSLY, and naming the mutation that is their real proof'

requirements-completed: [XOS-06]
requirements-deferred:
  - id: OBS-05
    reason: "Listed in this plan's frontmatter alongside XOS-06 and NOT marked complete. Its mechanism is finished on both sides of the wire, but its own acceptance names a two-leg property no unit spec can observe, and `publish` / `publish-verify` are push-gated to `main`. Row D10 carries the live confirmation. XOS-06 by contrast has no live dependency -- all four of its clauses (knob retained, not a correctness control, no requirement depends on the race winner, a comment recording this so the rejected ordering argument is not reconstructed) are delivered and each is guarded by a named test."

coverage:
  - id: D1
    description: 'The reader derives its lookup key as `mirrorSeedHash(GITHUB_RUN_ID, cachePlatform())`, asserted on the backend ARGUMENT rather than inferred from acceptance'
    requirement: 'OBS-05'
    verification:
      - kind: unit
        ref: 'packages/github-cache/src/roundtrip/read-back.spec.ts#round-trip read-back derives its OWN leg seed and accepts only that leg (OBS-05, D-15) > accepts the payload this %s leg itself seeded, keyed on its own derived seed'
        status: pass
    human_judgment: false
  - id: D2
    description: 'The producer comparison is EXACT: the reader accepts exactly one of `CACHE_OS_VALUES.length` payloads, rejecting every other member under its own derived key'
    requirement: 'OBS-05'
    verification:
      - kind: unit
        ref: 'packages/github-cache/src/roundtrip/read-back.spec.ts#round-trip read-back derives its OWN leg seed and accepts only that leg (OBS-05, D-15) > a %s reader REJECTS a %s-produced payload sitting under its own derived seed'
        status: pass
    human_judgment: false
  - id: D3
    description: "The read-back asset's `mirrored-by` label must name the reader's OWN OS -- the only mechanism that detects a dead publish leg, with both the expected and the observed value in the failure message"
    requirement: 'OBS-05'
    verification:
      - kind: unit
        ref: 'packages/github-cache/src/roundtrip/read-back.spec.ts#round-trip read-back proves its OWN leg published the asset (OBS-05, U-01) > a %s reader REJECTS its own asset when %s published it -- the dead-publish-leg case'
        status: pass
      - kind: unit
        ref: 'packages/github-cache/src/roundtrip/read-back.spec.ts#round-trip read-back proves its OWN leg published the asset (OBS-05, U-01) > accepts a %s leg asset labelled as published by that same leg'
        status: pass
    human_judgment: false
  - id: D4
    description: 'An EMPTY or absent label must not read as a pass -- all 122 assets in the live shard carry one, so this is the common case rather than an edge case'
    requirement: 'OBS-05'
    verification:
      - kind: unit
        ref: 'packages/github-cache/src/roundtrip/read-back.spec.ts#round-trip read-back proves its OWN leg published the asset (OBS-05, U-01) > a %s reader REJECTS an EMPTY label -- a legacy asset must not read as a pass'
        status: pass
    human_judgment: false
  - id: D5
    description: 'The label read PAGINATES the assets endpoint: an asset on a page after the first resolves, the requested page size is explicit, and exhaustion terminates on a short page rather than looping'
    requirement: 'OBS-05'
    verification:
      - kind: unit
        ref: 'packages/github-cache/src/roundtrip/read-back.spec.ts#round-trip read-back proves its OWN leg published the asset (OBS-05, U-01) > a %s reader resolves an asset that sits on a page AFTER the first'
        status: pass
      - kind: unit
        ref: 'packages/github-cache/src/roundtrip/read-back.spec.ts#round-trip read-back proves its OWN leg published the asset (OBS-05, U-01) > a %s reader fails loud when the asset is absent after every page is exhausted'
        status: pass
    human_judgment: false
  - id: D6
    description: 'The label read fails loud on a non-ok status and on an unresolved credential, and makes NO request in the latter case -- a silently skipped provenance check is the vacuity it exists to close'
    requirement: 'OBS-05'
    verification:
      - kind: unit
        ref: 'packages/github-cache/src/roundtrip/read-back.spec.ts#round-trip read-back proves its OWN leg published the asset (OBS-05, U-01) > a %s reader fails loud on a non-404 fault from the asset listing'
        status: pass
      - kind: unit
        ref: 'packages/github-cache/src/roundtrip/read-back.spec.ts#round-trip read-back proves its OWN leg published the asset (OBS-05, U-01) > fails loud rather than skipping the check when no read credential resolves'
        status: pass
    human_judgment: false
  - id: D7
    description: "`max-parallel: 1` is retained and its VALUE is guarded -- the repo's first such guard, behind the existing publish-job positive control"
    requirement: 'XOS-06'
    verification:
      - kind: unit
        ref: 'packages/github-cache/src/dogfood-cross-os.spec.ts#ci.yml publish waits on every job that produces a mirrored entry (XOS-07) > serializes the OS legs with max-parallel: 1 (XOS-06) -- publish-verify loses a guard without it'
        status: pass
    human_judgment: false
  - id: D8
    description: "XOS-06's comment is locked in BOTH directions: the knob's non-correctness status with its mechanical reason, the rejected ubuntu-first argument by name, and the guard-sensitivity clause with the ordering recorded as a measurement rather than a guarantee"
    requirement: 'XOS-06'
    verification:
      - kind: unit
        ref: 'packages/github-cache/src/docs-same-os-claims.spec.ts#every DOCS-08 site says what is true after VER-01/VER-03 (DOCS-08, OBS-04, XOS-07, D-31, D-32) > .github/workflows/ci.yml -- additive: NOT a correctness control (XOS-06)'
        status: pass
      - kind: unit
        ref: 'packages/github-cache/src/docs-same-os-claims.spec.ts#every DOCS-08 site says what is true after VER-01/VER-03 (DOCS-08, OBS-04, XOS-07, D-31, D-32) > .github/workflows/ci.yml -- additive: REJECTED ARGUMENT: ubuntu-first ordering makes the stricter Linux verdict win.'
        status: pass
      - kind: unit
        ref: 'packages/github-cache/src/docs-same-os-claims.spec.ts#every DOCS-08 site says what is true after VER-01/VER-03 (DOCS-08, OBS-04, XOS-07, D-31, D-32) > .github/workflows/ci.yml -- additive: see read-back.ts, which reads the mirrored-by label of the'
        status: pass
    human_judgment: false
  - id: D9
    description: "`ci.yml`'s `publish-verify` job comment no longer claims the same-OS publisher-to-reader contract, and carries its replacement reason (a per-leg SEED derivation) plus the publisher-not-producer distinction"
    requirement: 'XOS-06'
    verification:
      - kind: unit
        ref: 'packages/github-cache/src/docs-same-os-claims.spec.ts#every DOCS-08 site says what is true after VER-01/VER-03 (DOCS-08, OBS-04, XOS-07, D-31, D-32) > .github/workflows/ci.yml -- correction: per-leg SEED derivation,'
        status: pass
    human_judgment: false
  - id: D10
    description: 'LIVE: each `publish-verify` leg reads back its OWN leg''s asset and names its own OS as the publisher, and `publish (windows-11-arm)` reports `mirrored: 1`'
    verification: []
    human_judgment: true
    rationale: "`publish` / `publish-verify` are push-gated to `main`, so NO pull-request run samples them at any rate -- which is exactly why Phase 9's regression was findable only live. There is deliberately NO pre-merge acceptance check for this row. The detection it confirms is mutation-proven OFFLINE (mutations 4 and 5 below), so the live run is the confirming observation rather than the proof."

# Metrics
duration: 62min
completed: 2026-07-29
status: complete
---

# Phase 10 Plan 05: Per-Leg Seeds and the Dead-Publisher Detector Summary

**Each `publish` leg now seeds and reads back a key only that leg can produce -- flipped on
both sides of the wire in one commit -- and the read-back additionally proves the asset was
uploaded by that leg's OWN publish path, which converts dead-leg detection from a dependency
on UNDOCUMENTED GitHub matrix start order into a dependency on non-overlap, mutation-proven
offline rather than resting on a live failure.**

## Performance

- **Duration:** ~62 min
- **Tasks:** 3 of 3
- **Files created:** 0. **Files modified:** 5.
- **Tests:** 722 -> 769 (+47)

## Task Commits

| Commit | Kind | What |
|--------|------|------|
| `c335a23` | test | Task 1 RED -- the derived-seed lookup and the cross-producer rejection matrix |
| `11f2dd2` | feat | Task 1 GREEN -- **`ci.yml` and `read-back.ts` together**, plus the tightening and both lock rewrites |
| `fd91315` | test | Task 2 RED -- the `mirrored-by` publisher-identity cases |
| `ba7a16c` | feat | Task 2 GREEN -- the paginated label reader and its four-clause comment lock |
| `b141aaf` | test | Task 3 RED -- the `max-parallel` value guard and four `DOCS_08_SITES` rows |
| `3ec2d30` | docs | Task 3 GREEN -- XOS-06's two-way comment lock and D-21's `publish-verify` correction |

No REFACTOR commit: no duplication appeared that a later commit had to undo.

## The atomic flip, proven

`git show --stat 11f2dd2` lists BOTH halves:

```
 .github/workflows/ci.yml                         |  29 ++-
 packages/github-cache/src/roundtrip/read-back.ts | 227 ++++++++++++---------
```

This is a correctness property of the commit boundary, not tidiness. The workflow's seed
operation and the reader's key derivation are two ends of one wire: flip either alone and
`publish-verify` MISSes on the next default-branch push, with no error anywhere else. The
`hash:` input stays `${{ github.run_id }}` -- both ends derive through the one helper, so the
OS mapping never exists in YAML (D-14).

## Which kind of RED was achieved

**ASSERTION-LEVEL in all three tasks.** Every failure printed a value comparison, and the
sibling suite kept executing:

| Task | RED result | Character |
|------|-----------|-----------|
| 1 | `4 failed \| 725 passed (729)` | 3 acceptance cases: `promise rejected ... instead of resolving`, plus the split input guard |
| 2 | `19 failed \| 732 passed (751)` | rejections resolved instead of throwing; the multi-page case failed its page-COUNT assertion |
| 3 | `17 failed \| 752 passed (769)` | every one a `toContain` on a `ci.yml` comment phrase |

**Which RED cases passed VACUOUSLY, stated rather than glossed:**

- **Task 1's six cross-producer rejection pairs were GREEN at RED.** The fake served
  `dogfoodBody(<derived seed>, otherOs)` while the un-flipped reader looked up the raw run
  id, so the bytes matched nothing and the reader threw -- the right outcome for the wrong
  reason. Their real proof is **mutation 2**, which is exactly the split the plan predicted.
- **Task 2's three label-acceptance cases were GREEN at RED**, since `run()` ignored the
  label entirely. Their proof is **mutation 4**.
- **Task 3's `max-parallel` value guard was GREEN at RED**, because the value already
  existed. It is a drift guard; **mutation 7** is its bite.

## Group B's four corruption classes: all present, all green

Required to stay green across the tightening -- that continuity is the evidence they were
PRESERVED rather than traded away. Each fixture was re-keyed onto the derived seed, which is
the only change the tightening forced:

| Class | Fixture | Status |
|-------|---------|--------|
| garbage bytes | `Buffer.from('not a dogfood payload at all')` | pass |
| truncated / partial upload | `dogfoodBody(SEED, os).subarray(0, 12)` | pass |
| asset for a DIFFERENT hash | `dogfoodBody(NEIGHBOUR_SEED, os)` -- same leg, same encoding, run id one digit apart | pass |
| cross-run asset-name collision | same fixture as above; the hash is folded into the bytes | pass |

Plus the MISS case and both input-guard cases. The pinned rejection substrings stayed
`'cache HIT for'` / `'MISS'`, which is why they survived RED -> GREEN unchanged.

## Mutation checks: eight predicted, eight observed

GREEN was committed BEFORE every mutation (plan 10-02's recorded lesson), so each revert was
a revert to the intended state. Nothing was committed mutated; the tree was verified
`git diff --quiet` after each restore.

| # | Task | Mutation | Predicted | Observed | Verdict |
|---|------|----------|-----------|----------|---------|
| 1 | 1 | reader derives from the raw `GITHUB_RUN_ID` | the 3 per-member acceptance cases only | `3 failed \| 726 passed`, exactly those | as predicted |
| 2 | 1 | comparison loosened back to `CACHE_OS_VALUES.find` | the 6 rejection pairs redden, acceptance stays GREEN | `6 failed \| 723 passed`, exactly the 6 pairs | as predicted -- **this split IS the tightening's proof** |
| 3 | 2 | acceptance fixtures' label flipped to another tuple member | all 6 acceptance cases redden (proves the label is READ) | `6 failed \| 745 passed` | as predicted |
| 4 | 2 | wrong-publisher fixture relabelled to the reader's OWN OS | the 6 dead-publish-leg pairs redden (proves rejection is LABEL-driven) | `6 failed \| 745 passed`, exactly those | as predicted -- **the U-01 control's offline non-vacuity proof** |
| 5 | 2 | expected label hardcoded to `'linux'` instead of `cachePlatform()` | 10: 4 acceptance + 4 of 6 pairs + 2 pagination; every `linux` case stays green | `10 failed \| 741 passed`, and every survivor was a `linux` case | as predicted |
| 6 | 2 | read only the FIRST page of assets | the 3 multi-page cases only | `3 failed \| 748 passed`, exactly those | as predicted |
| 7 | 3 | guard-sensitivity clause deleted from the `max-parallel` comment | exactly that row's phrase | `1 failed \| 768 passed` | as predicted |
| 8 | 3 | `max-parallel: 1` -> `2` | the new VALUE guard only; no comment row moves | `1 failed \| 768 passed` | as predicted |
| 9 | 3 | `publish-verify` replacement justification deleted, corrected claim LEFT | that row's replacement phrases | `2 failed \| 767 passed`, the two publisher-identity phrases; the corrected own-asset claim stayed green | as predicted |

**Mutation 5 is the one worth reading twice.** Hardcoding `'linux'` left every `linux` case
green and reddened only the `windows` and `macos` ones. The `test` job is ubuntu-ONLY, so a
hand-authored axis would have been sampled at rate ZERO -- the mutation measures exactly the
defect that the tuple-driven axis prevents, rather than arguing for it.

**Mutation 8 is why a comment lock is not a guard.** With `max-parallel: 2` in the YAML, all
seventeen comment-phrase rows stayed green: the comment still SAID `1`. Before this plan,
reverting this knob reddened nothing at all.

## The pagination correction (T-10-22)

The plan predicted this would redden `publish-verify` on a CORRECT implementation if got
wrong, and it is the subtlest thing in the plan. Reading the asset `label` needs the shard's
asset LIST, and the release endpoint's inline `assets` array is a **non-paginated first page**
-- `createPublishClient.listReleaseAssets` paginates for exactly this reason (Pitfall 4), and
`releases-backend.ts` already carries the same loop for the same reason. The live
`cache-mirror-202607` shard holds **122** assets, so a leg's seed asset can legitimately sit
beyond page one.

Two things make the multi-page case non-vacuous rather than merely present:

- Page one is filled to **exactly** `ASSETS_PER_PAGE` decoys, because the loop's exit
  condition is a SHORT page. A 99-row first page would stop the walk and the case would prove
  nothing.
- It asserts the page SEQUENCE (`['1', '2']`) and the requested `per_page`, not just that the
  target resolved. Mutation 6 confirms a single-page read reddens exactly these three cases.

## XOS-06 locked in both directions

The requirement's hard part is that the comment has to say two things that LOOK opposed:
`max-parallel: 1` is **not** a correctness control, AND `publish-verify`'s dead-leg detection
**does** lean on the legs not overlapping. What reconciles them is written in both places:

| Where | Direction locked |
|-------|------------------|
| `ci.yml` `max-parallel` | not a correctness control, with the MECHANICAL reason (both legs restore the SAME single Actions-cache entry and upload it VERBATIM, so the race winner cannot matter); the REJECTED ubuntu-first argument by name; the guard-sensitivity clause pointing at `read-back.ts` BY FILE NAME |
| `read-back.ts` label assertion | non-overlap NOT order; what the assertion REMOVED; why the payload tightening cannot substitute; that the coupling is sensitivity, never a wrong-result guarantee |

**The `max-parallel` coupling is named openly**, including that removing the knob would redden
`publish-verify` on a CORRECT implementation -- because a tripwire that fires on correct work
gets disabled, and OBS-04 is this repo's own record of that. Hiding the coupling would have
been the more dangerous choice.

**The ordering is recorded as a MEASUREMENT and explicitly not a guarantee:** 5/5 across the
default-branch push runs on record, margins 150-190 s, run `30401077417` cited with both
timestamps -- alongside the statement that GitHub documents matrix CREATION order only, names
runner availability as a scheduling input, and that the two legs draw from DIFFERENT hosted
pools.

**Why the label assertion is not belt-and-braces:** it is the ONLY mechanism that detects a
dead publisher. D-15's payload tightening cannot, and the comment says so at the assertion
site, because a reader will otherwise assume it does. The bytes of the Windows leg's seed
asset are `dogfoodBody(seed_win, 'windows')` regardless of which leg UPLOADED them -- the SEED
was written by Windows. Provenance-of-payload and provenance-of-publisher are different axes.

## The do-not-unify lock: UPDATED, not deleted

Its old reason -- "publish's producer is genuinely VARIABLE" -- is precisely what OBS-05
falsifies, so leaving the paragraph standing would have been stale prose of the class that
shipped the Phase 9 regression. The **conclusion is unchanged**; the reason is rewritten:

> Both guards now assert exactly ONE producer. The reason they still must not be unified is
> that the two producers are fixed by DIFFERENT FACTS with different failure modes.
> `dogfood-verify`'s is fixed by a single-leg JOB (pinned by `dogfood-cross-os.spec.ts`'s
> no-matrix clause); this bin's is fixed by a per-leg SEED DERIVATION over a two-leg matrix.
> Unifying either way would let a change to one fact silently satisfy the other guard.

The "A SAME-OS-INVARIANT SWEEP MUST ENUMERATE CODE PATHS, NOT ONLY PROSE" paragraph is kept
verbatim in force -- it is the record of why the regression shipped and is still true.

## `DOCS_08_SITES` row count

Rows keyed on `.github/workflows/ci.yml`: **3 before, 7 after -- delta exactly 4**, as the
plan specified. The three `max-parallel` clauses are three SEPARATE rows rather than one row
carrying nine phrases, because each must fall independently: mutation 7 proves deleting the
guard-sensitivity clause reddens something distinguishable from deleting the rejected
argument. `forbidden: []` on all four, and the `publish-verify` row records WHY that is
load-bearing rather than lazy -- an absence check on a phrase from the old claim is satisfied
by deleting the whole comment, which is the exact failure D-21 exists to prevent.

`EDITED_FILES` already named `packages/github-cache/src/lib/mirror-seed.ts`: plan 10-04 added
it in the commit that created the file, as its own deviation 1 records. Nothing to do here,
and `release-asset-name.integration.spec.ts` is correctly still absent (plan 10-07 creates it).

## Deviations from Plan

### 1. [Rule 2 - Missing guard] An absent `GITHUB_RUN_ID` needed its own check

- **Found during:** Task 1, writing the RED
- **Issue:** the plan says to "keep the undefined-hash throw; widen its message". Keeping
  only that throw would have been a **regression**: `mirrorSeedHash('', os)` is
  `feed<index>`, which is valid lowercase hex, so `parseHash` ACCEPTS it. The existing
  `GITHUB_RUN_ID is required` guard would have stopped firing and the reader would have
  looked up the seed of the empty run -- surfacing as a dead publish path rather than as an
  unset variable.
- **Fix:** two guards, two diagnoses, comment-locked with the reason they must not be folded
  back together. A second spec case pins the non-hex derivation path.
- **Why it is not scope creep:** the plan's own words name these as "two different
  diagnoses"; this is the implementation of that sentence, and the hex-validity of
  `feed<index>` is what makes it mandatory rather than stylistic.
- **Committed in:** `11f2dd2`

### 2. [Rule 3 - Blocking] Doc-block reattachment after inserting module-level helpers

- **Found during:** Task 2 GREEN
- **Issue:** inserting the label reader between `run()`'s doc block and `run()` silently
  reattached that JSDoc to a `const`.
- **Fix:** the block was moved back onto `run()`; constants sit above it, helpers below.
- **Committed in:** `ba7a16c`

### 3. [Rule 1 - Guard fired on new prose] `whose bytes` in the rewritten doc block

- **Found during:** Task 1 GREEN, first full test run
- **Issue:** `docs-same-os-claims.spec.ts`'s retraction guard (`/whose byte[s]/i` over
  `EDITED_FILES`) reddened on my rewritten doc block, which read "asserts a HIT WHOSE BYTES
  equal ...".
- **Fix:** reworded to "asserts the returned bytes equal ... exactly", plus a sentence
  recording that the phrasing is enforced and why OBS-03 retracts the attribution reading.
- **Measured, because my first hypothesis was wrong:** I assumed the guard had a latent
  line-wrap false negative, since the pre-edit file carried the same words split across a
  wrap. It does not. The pre-edit text does not match even a newline-tolerant
  `whose\s+byte[s]` (verified against `git show HEAD~1:...`, exit 1), because the JSDoc
  ` * ` prefix sits between the two words. So there is no hole to fix and no widening was
  made. **Recorded sensitivity, deliberately NOT fixed:** the guard cannot see a phrase
  split across a comment-continuation prefix. Closing that would need comment-prefix-aware
  normalisation -- a new mechanism for one caller -- and the guard already catches the
  single-line form, which is how the phrase is actually written.
- **Committed in:** `11f2dd2`

### 4. [Simplification, recorded] The 404-versus-fault split was NOT copied

- **Found during:** Task 2 GREEN
- **Plan text:** `releases-backend.ts`'s "404 moves on while a non-404 fault throws" rule --
  "Copy that discipline."
- **What was copied:** the discipline that matters -- discrimination is STRUCTURAL on
  `res.status` only, never body text (D-11).
- **What was not:** the two-way BRANCH. That module has two OUTCOMES because a 404 means
  "try the next shard". This bin has already observed a HIT, so every non-ok status has
  exactly ONE outcome: fail. The status is named in the message, so an operator still
  distinguishes an absent shard from a rate limit, and no untested branch was added.
- **Why it is recorded rather than silent:** it is a deliberate reading of a plan
  instruction, and a verifier comparing the two files would otherwise read the missing
  branch as an omission.
- **Committed in:** `ba7a16c`

### 5. [Considered and rejected] Extracting `mirrored-by: ` to a shared leaf

- The prefix is now authored in `publish-mirror.ts` (which stamps it) and `read-back.ts`
  (which reads it). Extraction was rejected on a measured asymmetry, recorded at the
  constant: a drift between these two fails **LOUD** -- `publish-verify` reddens with both
  values in the message -- unlike an asset-name drift, which MISSes SILENTLY and is why
  `releaseAssetName` is single-sourced. The pinned-literal discipline is already the house
  pattern for exactly this case (`dogfood-body.ts`: "pinned in TWO files by design").
  Extracting would also have touched `publish-mirror.ts`, outside this plan's file list.

---

**Total deviations:** 3 auto-fixes (one a real missing guard, one mechanical, one a guard
firing correctly on new prose) plus 2 recorded design calls. No prohibition breached.

## Prohibitions: verified held

| Prohibition | Held? | Evidence |
|-------------|-------|----------|
| MUST NOT widen `ReleaseReadClient` / touch `releases-backend.ts` | yes | `git diff --name-only 1894b70..HEAD` does not list it; the label read is a module-local native `fetch` |
| MUST NOT read the release's INLINE `assets` array | yes | the code paginates `?per_page=100&page=N`; mutation 6 proves the loop is load-bearing |
| MUST NOT delete the DO NOT UNIFY lock | yes | present with its NEW justification (per-leg SEED vs single-leg JOB). Asserted on surviving CONTENT by reading, never by an absence check -- an absence check would be satisfied by deleting the lock |
| MUST NOT claim `max-parallel: 1` guarantees ubuntu starts first | yes | the comment says MEASURED 5/5 with run `30401077417` AND that a measurement is not a documented guarantee, naming creation-order-only, runner availability, and the different runner pools |
| MUST NOT claim D-15's tightening detects a dead publisher | yes | the label assertion's lock states the opposite explicitly, with the reason (the SEED was written by this leg, so the bytes are this leg's whoever uploaded them) |
| MUST NOT put a comment-phrase assertion in `dogfood-cross-os.spec.ts` | yes | that file gained a YAML-VALUE assertion only; its doc block records why a comment lock there is vacuous by construction |
| MUST NOT put a YAML-value assertion in `docs-same-os-claims.spec.ts` | yes | its four new rows are comment PHRASES only |
| MUST NOT describe the asset name by literal SHAPE | yes | `releaseAssetName(mirrorSeedHash(...))` in both `read-back.ts` and the `publish-verify` comment, so neither needs touching at CORR-02 |
| MUST NOT run `npm run build:action` | yes | not run; `git diff --stat 1894b70..HEAD -- start-cache-server/index.js` prints nothing |
| Locate `ci.yml` edits by CONTENT, never a line number | yes | every edit anchored on a quoted phrase or a job key |
| `git commit -F`, never `-m` | yes | all six commits |
| Stage by name, never `git add .`/`-A`/`-u` | yes | explicit paths every time; `.planning/config.json` was already modified before this plan and was never staged |
| ASCII only | yes | no non-ASCII in any file or commit message authored here |

## Acceptance criteria: measured

| Criterion | Result |
|-----------|--------|
| `nx run @op-nx/github-cache:test --skip-nx-cache` | `Test Files 39 passed (39)`, `Tests 769 passed (769)` (722 before) |
| `npm run test -- --skip-nx-cache` | pass |
| `npm run typecheck -- --skip-nx-cache` | pass |
| `npm run lint -- --skip-nx-cache` | pass |
| `npx nx format:check` | pass |
| `npm run fallow` | `No issues found` -- no config change needed |
| `git show --stat 11f2dd2` lists `ci.yml` AND `read-back.ts` | yes |
| `rg -c 'operation: mirror-seed' .github/workflows/ci.yml` | 2 (the value plus its rationale); the same step's `hash:` still reads `${{ github.run_id }}` -- read together at `ci.yml:1172-1174` |
| `rg -c 'mirrorSeedHash' read-back.ts` | 8 |
| `rg -c 'CACHE_OS_VALUES\.find' read-back.ts` | no match (exit 1) |
| `rg -c 'per_page' read-back.ts` | 1, and the page loop with its short-page exit was read |
| `rg -c "'linux'\|'windows'\|'macos'" read-back.ts` | no match (exit 1) -- every OS value is derived |
| `rg -c 'it\.each\(CACHE_OS_VALUES\)' read-back.spec.ts` | 7 |
| `rg -c 'page' read-back.spec.ts` | 21 |
| `rg -c 'toHaveBeenCalledWith\(\s*expect\.not' read-back.spec.ts` | no match (exit 1) |
| `rg -c 'REJECTED\|rejected' .github/workflows/ci.yml` | 3 |
| `rg -c 'read-back\.ts' .github/workflows/ci.yml` | 6 |
| `rg -c '30401077417' .github/workflows/ci.yml` | 1 |
| `rg -c 'max-parallel' dogfood-cross-os.spec.ts` | 4 |
| `rg -c 'lib/mirror-seed\.ts' docs-same-os-claims.spec.ts` | 2 |
| rows keyed on `ci.yml` in `DOCS_08_SITES` | 3 -> 7 (delta 4) |
| every `EDITED_FILES` path resolves on disk | yes -- `read()` is a `readFileSync` and the suite is green |
| `git diff --stat -- start-cache-server/index.js` | empty |
| `git diff --diff-filter=D --name-only 1894b70..HEAD` | empty -- no file deletions |

`--skip-nx-cache` is not optional on any of these: Phase 9 measured a stale `Cache: 2/2 hit`
PASS after a spec-only edit.

## Threat model: dispositions as executed

| Threat | Disposition | How it was closed |
|--------|-------------|-------------------|
| T-10-20 (a leg passing on ANOTHER leg's upload -- a dead publish path reported green) | mitigate | The `mirrored-by` label assertion detects it on EITHER leg under EITHER ordering. Mutation-proven OFFLINE in both directions (mutations 3 and 4), so non-vacuity needs no live failure. Residual exposure is a SENSITIVITY loss if `max-parallel: 1` is removed, comment-locked in both places as sensitivity and never as a wrong-result guarantee -- and the knob's value is now spec-guarded (mutation 8) |
| T-10-21 (the new native `fetch`) | mitigate | Reuses `resolveLocalReadToken` / `resolveRepoIdentity`; no new credential path, no re-authored env read. Metadata endpoints only; no restored cache byte reaches the log, and failure messages name only our own expectation and the observed label. The spec mocks both resolvers AND stubs `fetch`, so no test spawns a credential helper or reaches the network |
| T-10-09 (widening the consumer read seam) | mitigate | AVOIDED by construction -- `releases-backend.ts` is untouched. The `GITHUB_API` / timeout / page-size constants are authored locally with that reason recorded, so nobody "tidies" them into an import from the bundled module |
| T-10-03 (the label read as a PRODUCER claim) | mitigate | Both comment locks state the label names the PUBLISHING leg; the success and failure messages are worded as publisher identity. The retraction scan over `read-back.ts` caught a phrasing slip in this very plan and it was reworded (deviation 3) -- the guard demonstrably works |
| T-10-22 (a label read seeing only the first page of a 122-asset shard) | mitigate | The read paginates; pinned by the multi-page case with its page-sequence and `per_page` assertions, and by mutation 6 |
| T-10-06 (`operation: mirror-seed` in the workflow) | accept | The value selects a verb and a key derivation only; capability comes from runtime context inside `selectBackend` (TRUST-05). No new action input, so D2-02 and PARITY-07 hold. `dogfood-seed` / `dogfood-verify` are byte-unchanged at `ci.yml:815` and `:874` |
| T-10-SC (package installs) | accept | ZERO new packages. No `package.json` or lockfile edit, no installer run |

## Human verification needed

**Row D10 only, and it CANNOT close pre-merge.** `publish` / `publish-verify` are push-gated
to `main`, so no pull-request run samples them at any rate. There is deliberately **no**
pre-merge acceptance check that could satisfy this row.

On the first default-branch push after this lands, a real runner must show:

1. `publish-verify (windows-11-arm)` logging a `windows`-produced payload **and** the label
   `mirrored-by: windows`; `publish-verify (ubuntu-24.04-arm)` logging `linux` for both.
2. `publish (windows-11-arm)`'s OBS-01 summary reporting **`mirrored: 1`** -- its own seed --
   and NOT `0`, so the all-restore-MISS warning at `publish-mirror.ts` does not fire. Per
   research correction C-1(ii) the expected signal is `1`; a `0` here is the failure.
3. Both `nx-cache-feed0<run_id>` and `nx-cache-feed2<run_id>` present in
   `cache-mirror-202607`, which also closes plan 10-04's row D7.

**Do NOT deliberately break the Windows publish path on `main` to demonstrate the
detection.** It is mutation-proven offline (mutations 3, 4 and 6); the live run is the
confirming observation, not the proof.

## Issues Encountered

The only real judgement call was where the label read's failure taxonomy should stop.
Copying `releases-backend.ts`'s 404-versus-fault split verbatim would have added a branch
whose two arms do the same thing here, since this bin has already observed a HIT and cannot
"move on to the next shard". Naming the status in one message keeps the operator's diagnosis
and leaves no untested code. Recorded as deviation 4 rather than taken silently, because the
plan's wording pointed at that module.

## Self-Check: PASSED

All five modified files exist on disk. All six commits (`c335a23`, `11f2dd2`, `fd91315`,
`ba7a16c`, `b141aaf`, `3ec2d30`) are present in `git log --all`. The working tree carries no
uncommitted source change -- only `.planning/config.json`, which was modified before this
plan began and was never staged. This file is ASCII-clean.
