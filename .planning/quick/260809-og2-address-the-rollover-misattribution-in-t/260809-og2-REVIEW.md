---
task: quick-260809-og2
reviewed: 2026-08-09T18:30:00Z
depth: deep
diff_base: ded3ddf
files_reviewed: 4
files_reviewed_list:
  - packages/github-cache/src/publish/publish-mirror.ts
  - packages/github-cache/src/publish/publish-mirror.spec.ts
  - packages/github-cache/src/docs-same-os-claims.spec.ts
  - docs/advanced.md
findings:
  critical: 0
  high: 2
  medium: 4
  low: 4
  info: 4
  total: 14
status: issues_found
---

# Quick 260809-og2: Code Review Report

**Reviewed:** 2026-08-09
**Depth:** deep (cross-file: engine <-> spec <-> docs guard row)
**Range:** `ded3ddf..HEAD` (`51dadac`, `5a5ed82`, `e94c649`)
**Status:** issues_found -- 0 Critical, 2 High, 4 Medium, 4 Low, 4 Info

## Summary

The central claim of the change -- the partial branch carries the month-shard-rollover cause and the
total gate must not -- **holds**, and I re-derived it from the code rather than from the plan (see
IN-01 for the derivation and for the one place the plan's stated reason is wrong). The distribution
constraint on both emitted strings holds. The string concatenation is clean. `nx test github-cache`
is green (1079 tests, 43 files), `lint` is green, all four files are ASCII-clean.

What is wrong is concentrated in two places the change itself is about: **a guard that does not
cover the behaviour the task exists to add** (BL-01), and **two new comments that assert things the
code does not do** (BL-02, WR-01) -- the exact defect class this file has a measured history of.

## High

### BL-01: The "list is not exhaustive" claim ships with no committed guard

**Files:** `packages/github-cache/src/publish/publish-mirror.ts:811`, `:934`;
`packages/github-cache/src/publish/publish-mirror.spec.ts:1432-1440`, `:1565-1571`

**Issue:** The change's headline behaviour -- both messages retract the completeness claim -- is
enforced by nothing. Measured: `git grep -n -F 'not exhaustive' -- packages docs .github` returns
**only the two source lines and one source comment**; no spec, in this file or any other, asserts the
phrase. Delete `and this list is not exhaustive` from both `core.warning` bodies and every one of the
1079 tests stays green. The only negative pin is `/Two candidate cause[s]/`, which catches a verbatim
relapse of the retired phrase and nothing else.

This matters more than an ordinary missing assertion because the artifact record says the coverage
exists. PLAN.md's Task 1 `<done>` states "the phrase-level pin plus the `not exhaustive` presence pin
in Task 2 is the whole of the mechanical coverage" -- but Task 2's "pin" is a one-shot `rg` in a
`<verify>` block, which does not survive the commit. And the spec comment at `:1433` reads "Catches
the return of a CLOSED enumeration", which overstates what a single-phrase regex can do. A future
reader trusting that comment will not add the missing pin.

The plan separately (and correctly) concedes that the CLASS "a closed enumeration" is not
mechanically checkable -- that concession is fine. The gap here is narrower and is checkable: the
presence of the retraction sentence itself.

**Fix:** one line per branch fixture, alongside the existing positive pins:

```ts
// In 'warns ONCE just ABOVE the target rate' and in 'fires the TOTAL-case branch':
// Catches the retraction being deleted -- the phrase-level absence pin below only
// catches the retired wording returning, not the open-list clause leaving.
expect(warned).toContain('this list is not exhaustive');
```

### BL-02: New source comment says the partial branch fires under a condition that routes to its sibling

**File:** `packages/github-cache/src/publish/publish-mirror.ts:873-882`

**Issue:** The new paragraph is titled `AND IT FIRES ON A VERSION SKEW TOO` -- "it" being the partial
branch it sits inside -- and then states the mechanism as: "the two compute different cache versions
in one repository and **every enumerated entry misses**".

If every enumerated entry misses, `readMisses === hashes.length` and `mirrored === 0`, so the
**total** gate fires and this `else if` is unreachable. The paragraph ten lines above (`:862-871`)
says exactly this in the opposite direction: this workflow's same-run `mirror-seed` step means the
leg's own seed always restores, so `mirrored >= 1` and the total gate stays silent. The new paragraph
therefore contradicts its immediate neighbour and describes the branch it is attached to as firing on
a condition under which it provably cannot fire.

The intended, and true, statement is narrower: under a skew every entry written by the OTHER artifact
misses, while entries written this run through the publish-side artifact restore -- which is *why* the
shape lands on the partial branch rather than the total gate. Written as it stands, a reader reasoning
from it would conclude the skew cause belongs on the total gate and not here, i.e. exactly the
asymmetry error the rest of the change is built to prevent.

**Fix:** replace the clause:

```
// ... the two compute different cache versions in one repository and every entry written
// by the OTHER artifact misses -- with no rotation anywhere in the commit range to find.
// Entries this run writes through the publish-side artifact still restore, which is what
// keeps `mirrored >= 1` and lands the shape HERE rather than on the gate above.
```

## Medium

### WR-01: The asymmetry's stated reason is a false implication (`mirrored === 0` does not imply an unresolved shard)

**File:** `packages/github-cache/src/publish/publish-mirror.spec.ts:1572-1576`

**Issue:** The new comment says: "This gate needs `mirrored === 0`, so the shard never resolves, the
pre-restore membership skip never runs, and rollover cannot move this number."

`mirrored === 0` does **not** imply the shard never resolves. Four live paths leave `mirrored` at 0
with a fully resolved shard: the post-restore already-present branch (`:718`), the D-11 cap branch
(`:696`), the burned-tag skip after the shard probe returned `undefined` (`:685`), and an upload
fault (`:772`). What actually forecloses shard resolution is the gate's *other* conjunct,
`readMisses === hashes.length`: every hash took the miss branch at `:644`, so no hash ever reached
the `shard === undefined` resolve at `:682`, which only runs after a restore HIT.

The conclusion is correct (see IN-01), but the premise is not, and this file's own engine comment at
`publish-mirror.ts:626-630` already states the correct one ("the shard resolves only after a restore
HIT -- which already falsifies the gate's condition"). Two comments in the same change now give two
different reasons for one fact, one of them false. Given this file's measured history -- a prior
review found five comments asserting constraints the code lacks, one of which would have led a reader
to delete a live clause -- a wrong premise here is worth fixing even though the assertion it annotates
is sound.

**Fix:**

```ts
// THE ASYMMETRY, NEGATIVE HALF -- catches the rollover cause being added to the branch
// that CANNOT have it. This gate needs readMisses === hashes.length: every hash took the
// miss branch, so none reached the lazy shard resolve, so the pre-restore membership skip
// never runs and rollover cannot move this number. (mirrored === 0 alone would NOT give
// that -- already-present, cap, burned-tag and upload-fault runs all resolve a shard.)
```

### WR-02: `docs/advanced.md:105` now claims a sameness the change deliberately broke

**File:** `docs/advanced.md:105`

**Issue:** The all-MISS paragraph says the total gate names "the same causes worth checking" as the
partial warning. Before this change that was exact -- both messages carried the identical two causes.
After it, the partial carries four and the total three; the missing one is the month-shard rollover,
and that difference is the entire point of the task. The edit dropped the cardinality (`two`) but left
the identity claim (`the same`), so the sentence went from true to false in the same commit that made
the asymmetry real.

The consequence is not theoretical: a maintainer reading the doc as the specification of the pair
would "restore" the rollover cause to the total gate. The spec would redden -- so the blast radius is
bounded -- but the doc is the only consumer-facing description of the two warnings, and no
`DOCS_08_SITES` row can catch this (the row deliberately pins no cardinality, per its new docstring).

**Fix:** name the difference rather than assert identity:

```
  ... and the same causes worth checking, minus the month-shard one -- a run that
  mirrored nothing never resolved a shard, so a rollover cannot have moved its number.
```

### WR-03: Cause (4) says "a one-time rise" for what the code produces as a persistent step

**File:** `packages/github-cache/src/publish/publish-mirror.ts:939-941`

**Issue:** The emitted text: "(4) the first publish run against a new month shard, where entries
previously skipped as already mirrored are re-attempted and **a one-time rise is expected**."

Trace the runs. Pre-rollover, an entry that is in the shard AND would now miss is suppressed by the
pre-restore skip (`:635`). At rollover the shard is empty, so it is re-attempted and counted -- the
rise. On the **next** run of the same month it is still not in the shard, because an entry that misses
can never be mirrored, so it is re-attempted and misses again: `readMisses` and `hashes.length` are
both unchanged, and the elevated proportion persists for every run of that month until the affected
entries evict from the Actions cache. It is a step change, not a spike.

The same change's own new comment at `:916-923` states this mechanism exactly ("an entry that MISSES
is never mirrored, so it is never in the shard, so it is re-enumerated and retried on every future
run"). So the message and the comment above it disagree about the same cohort. A reader reassured that
the rise is "one-time" will read the second firing as a new fault -- which is the misdiagnosis cost
this whole task exists to remove.

Secondary imprecision in the same clause: the rise materialises only for the subset of re-attempted
entries that have become unrestorable; entries that still restore raise `mirrored`, not `readMisses`.

**Fix:**

```
'read scope; (4) the first publish run against a new month shard, where entries ' +
'previously skipped as already mirrored are re-attempted, so any of them that can ' +
'no longer restore become visible at once and stay counted until they evict.',
```

(If this wording lands, update `publish-mirror.spec.ts:1448` in the same commit -- the pinned needle
`the first publish run against a new month shard` survives the rewording above unchanged, which is
why the clause is rewritten only after that phrase.)

### WR-04: The guard file spells both retired phrases verbatim, against its own stated convention

**File:** `packages/github-cache/src/docs-same-os-claims.spec.ts:144-145`

**Issue:** The new docstring writes `"two candidate causes"` and `"the same two causes worth
checking"` in full. This file states the opposing rule about itself three times -- at `:721-725`
("spelling it here would plant it in the very file that proves it is gone, and a repo-wide search
could no longer tell this guard apart from a regression"), at `:276-279` ("Do not 'tidy' that
contortion out"), and at `:595-598` ("the superseded wording is described BY CONCEPT and deliberately
not quoted here"). Measured consequence today: `git grep -i 'candidate cause'` over the repo returns
this docstring alongside the two spec regexes, so the relapse search this convention exists to keep
clean is already noisy.

No gate reddens on it -- the phrase is not in any `forbidden` list and the executor's `rg` check was
scoped to `publish-mirror.ts` -- which is precisely why it needs to be caught by review.

**Fix:** split each occurrence the way every `forbidden` row in the file does: `"two candidate
cause[s]"` -> write it as `two candidate cause` + `s` split by a bracket, or describe by concept:
"both sentences counted the causes -- one in the partial paragraph, one in the all-MISS paragraph".

## Low

### IN-01 (Low): The artifact blocklist regex is duplicated, and is narrower than the blocklist it enforces

**Files:** `packages/github-cache/src/publish/publish-mirror.spec.ts:1486-1490`, `:1582-1586`

Identical four-alternative regex in two tests. A fifth artifact name added later will be added in one
place and silently missing from the other. Hoist it to a module-level `const FORBIDDEN_ARTIFACTS` next
to `runWithMisses` and reference it from both.

Separately, it covers four of the blocklist's items and not RESEARCH blocklist item 7 (a figure or run
id not carrying `31305961054`) -- a leaked run id in either message would pass. `\.plannin[g]\/`
requires the trailing slash, so a bare `.planning` mention also passes. Both are acceptable gaps if
recorded; today they are neither recorded nor covered.

### IN-02 (Low): "the warnings no longer carry a count at all" overstates

**File:** `packages/github-cache/src/docs-same-os-claims.spec.ts:145-146`

Both messages still enumerate `(1) (2) (3)` (and `(4)`). What left is the *completeness claim*, not
the count. The next sentence of the same docstring says it correctly ("dropped the closed
enumeration"), so the fix is to delete the overstated half.

### IN-03 (Low): Retitled sibling test promises more than it pins

**File:** `packages/github-cache/src/publish/publish-mirror.spec.ts:1254`

The retitle from "both candidate causes" to "the causes worth checking" did **not** weaken any
assertion -- I checked every assertion in the case against `ded3ddf` and all six are byte-identical,
and the `Cause 1` / `Cause 2` -> named-cause comment relabel is accurate now that a cause sits at
position 2. But the new title names the whole list while the case pins only the rotation and
read-scope causes; the skew cause added to this same message is unpinned here (it is pinned at
`:1564`, in the other describe). Either add `expect(core.warning).toHaveBeenCalledWith(
expect.stringContaining('different versions of this action'))` here, or narrow the title.

### IN-04 (Low): Cause (2)'s relative clause attaches to the wrong antecedent

**File:** `packages/github-cache/src/publish/publish-mirror.ts:814-815`, `:937-938`

"...running at different versions of this action, **which computes** two cache versions in one
repository". The singular verb binds `which` to `this action`; the intended subject is the skew. A
stranger's CI log is the one place this costs a re-read. Suggest: "...at different versions of this
action, so two cache versions exist in one repository."

## Info -- verified, no action

### IN-05: The asymmetry claim is sound; the plan's reason for it is not

Derived independently. The total gate is `hashes.length > 0 && readMisses === hashes.length &&
mirrored === 0`. `readMisses === hashes.length` means every hash took the miss branch at `:644`, so
none reached the lazy shard resolve at `:682` (which runs only after a restore HIT), so
`shard === undefined` for the whole loop and the pre-restore membership skip at `:635` never executes.
Rollover changes only shard membership, so it cannot move any number the gate reads.

I also checked the counterfactual the plan does not: could a rollover make the total gate fire where
it previously did not, by un-suppressing misses? No. Suppression requires a resolved shard, which
requires at least one restore HIT; the restore outcome is a pure function of the hash and is unchanged
by rollover, so that same entry still HITs post-rollover and either mirrors (`mirrored >= 1`) or takes
a non-miss skip -- either way `readMisses < hashes.length`. The gate stays silent in both worlds. **No
path from rollover to the total gate exists.**

The plan's stated reason ("this gate needs `mirrored === 0`, so the shard never resolves") is a false
implication -- see WR-01 -- but it happens to reach the right answer.

### IN-06: Both asymmetry halves are non-vacuous, and so are the negative matchers

The positive pin (`spec:1448`) and the negative pin (`spec:1577-1579`) are on opposite fixtures, so
moving the clause to the wrong branch reddens both, and putting it on neither reddens the positive
one. Needle choice is right: `new month shard` returns exit 1 across the repo except for the source
line and its own pin, whereas the rejected bare `month shard` has 4 pre-existing hits in
`publish-mirror.ts` (measured) and would have been green before the edit.

Every negative assertion negates the **quantifier**, not the predicate: `mock.calls.flat()` +
`not.toContainEqual`, with `toHaveBeenCalledOnce()` pinned first in all three cases (`:1420`,
`:1473`, `:1548`), so an empty-`recorded` vacuous pass is foreclosed.

### IN-07: Distribution constraint holds on the emitted strings

Both joined messages contain no `action-bundle drift`, no `start-cache-server/index.js`, no
`dist/action/index.js`, no `.planning/` path, no run id and no measured baseline. The source comments
that do name those (`:877-879`) are comments, which the constraint permits.

### IN-08: Concatenation, pluralization and the guard row are clean

I joined both messages by hand across all 12 `' +` boundaries: every fragment carries its trailing
space, no doubled spaces, no broken interpolation. `entr${hashes.length === 1 ? 'y' : 'ies'}` is
untouched and still correct (the total gate is guarded by `hashes.length > 0`); the partial message is
unconditionally plural and cannot fire below four entries, so it needs none.

`docs-same-os-claims.spec.ts` still guards what it claims: all three `required` phrases of the OBS-04
row survive the docs edit, each on one line (`docs/advanced.md:89`, `:93`, `:101`), and none of the
three `forbidden` patterns matches the edited text. The docstring-only change adds no row and no
`required` entry, as intended. The `EDITED_FILES` producer-attribution scan is unaffected -- no new
sentence in `publish-mirror.ts` pairs `whose byte[s]` with a `produc*` token.

---

_Reviewed: 2026-08-09_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
