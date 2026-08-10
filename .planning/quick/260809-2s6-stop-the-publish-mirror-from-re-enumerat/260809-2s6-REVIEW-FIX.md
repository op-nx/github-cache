---
phase: 260809-2s6
fixed_at: 2026-08-09
review_path: .planning/quick/260809-2s6-stop-the-publish-mirror-from-re-enumerat/260809-2s6-REVIEW.md
iteration: 1
findings_in_scope: 11
fixed: 11
skipped: 0
no_change_needed: 3
status: all_fixed
commits:
  - 9b1b136 fix(260809-2s6): correct the comments that assert constraints the code lacks
  - 3a82c01 test(260809-2s6): pin the all-decimal Nx hash shape the seed filter rests on
---

# Quick task 260809-2s6: Code Review Fix Report

**Source review:** `260809-2s6-REVIEW.md` (0 critical, 11 warning, 3 info)
**Scope applied:** the eleven warnings. The three Info findings were outside the
maintainer's stated scope and are recorded below as deliberately not actioned.

**Summary**

- Fixed: 11 of 11 warnings.
- Skipped: 0.
- Behaviour changed: nothing, except the one authorised addition (WR-08's new
  spec). Every other edit moves prose only.

**Commit grouping, and why it is two commits rather than eleven.** Six of the
warnings land inside `publish-mirror.ts`, several of them in the SAME comment
block (WR-03 and WR-07 are two clauses of one paragraph). Splitting those into
per-finding commits would mean hand-staging partial hunks of a single file, which
this repo's own guidance rejects in favour of coarser granularity. So the eleven
prose corrections land as one commit and the one behaviour-adjacent addition
lands as its own, which keeps the reviewable unit boundary where it matters: the
new test is separable from everything else in this pass.

---

## Fixed

### WR-01: the D1 filter's "position before the `Set` is load-bearing" claim

**Verdict:** fixed -- comment rewritten, AND the same false invariant removed from
the plan's `key_links`, per the explicit instruction.
**Files:** `publish-mirror.ts` (filter site), `260809-2s6-PLAN.md`.

I confirmed the review's reasoning before acting on it rather than taking it on
trust: `isOtherRunsSeed` reads only the element value and has no state, and `Set`
dedups by value, so `new Set(xs.filter(p))` and `[...new Set(xs)].filter(p)`
produce the same array in the same first-occurrence order. The comment now states
the real reason the filter sits in this pipeline (it is a second narrowing filter
rather than an edit to the shared `isServerProducedKey` / `HASH_PATTERN`
predicates) and says plainly that the position relative to the `Set` is a
readability choice, naming the reorder a future reader is most likely to want.

The plan's `key_links` row is corrected in the same commit and marked as a
post-review correction, so the record shows the claim was made and retracted
rather than silently rewritten.

### WR-03: "the cap branch is now reached only by ABSENT names"

**Verdict:** fixed -- and not reduced to a wording tweak. The comment now says the
clause the old one implied was dead is still LIVE, and why.
**File:** `publish-mirror.ts` (D3 guard comment).

The first entry of a run is the falsifier: `shard` is `undefined` on iteration 1,
so the pre-restore guard is skipped by construction; the restore then resolves the
shard and control reaches the cap branch with a name that may well be present. The
comment now names that entry specifically, states that `!shard.names.has(name)` is
still load-bearing for it, and records what deleting it would cost -- a spurious
cap warning on an already-mirrored entry, counted as a plain skip instead of an
`alreadyPresent`.

### WR-02: the exported threshold's stated purpose

**Verdict:** fixed by correcting the docblock, NOT by deriving the fixtures.
**File:** `publish-mirror.ts` (`PARTIAL_READ_MISS_WARN_RATIO`).

Deriving the boundary from the constant was the review's first option, but it
changes the test fixtures, and the fixtures are hand-built for one half on
purpose: a 4-entry enumeration exists because `4 * 0.5` is a whole number of
entries. A derived form would silently produce a fractional boundary at some other
ratio and turn a fixture invalidation into a quiet reinterpretation. The docblock
now says what the export actually is -- a value PIN -- and states that changing the
ratio invalidates the fixtures rather than moving them.

### WR-04: the third dogfood assertion cannot fail independently

**Verdict:** fixed by relabelling, assertion kept.
**File:** `dogfood-cross-os.spec.ts`.

The review is right that `toBe(verify)` is entailed by the two literal pins above
it and can never be the first failing assertion. It is also right that the
three-item list is accurate as a description of three REJECTED weaker designs. I
took that reading: the list is now explicitly about the alternatives, the shipped
form is named as the strongest of the four, and the redundancy is admitted in
terms -- kept as documentation of the round-trip, not as an independent gate.

I did NOT take the review's second option (a SHAPE regex making clause 3 genuinely
independent). That weakens the two pins from whole-value equality to a pattern
match, which is a change to what the gate detects, and the maintainer's scope for
this pass is prose corrections plus one authorised test addition.

### WR-05: `scanned`'s field documentation was not updated for D1

**Verdict:** fixed.
**File:** `publish-mirror.ts` (`PublishResult.scanned`).

The field doc now carries the subtraction clause and the non-comparability
warning, with the pre-filter figures named. The reasoning in the finding is the
part worth keeping: this doc is where a reader of the OBS-01 summary arrives, and
a reported number defined 320 lines from where it is read is the defect class D4
exists to fix.

### WR-06: the engine docblock omits D1 and D3

**Verdict:** fixed.
**File:** `publish-mirror.ts` (`publishMirror` docblock).

Added a `Seed filter (D1)` bullet and a `Membership-before-restore (D3)` bullet in
the existing style, each pointing at the site that carries the detail, and the
return sentence now names `alreadyPresent`.

### WR-07: D3's third aggregate consequence

**Verdict:** fixed, and treated as a real behavioural consequence rather than a
documentation nicety.
**File:** `publish-mirror.ts` (D3 guard comment); also summarised in the commit body.

The paragraph is renamed from TWO to THREE aggregate outcomes and the third is
stated with its mechanism: publish no longer restores an already-present entry, a
restore is an access, and access is what defers GitHub's 7-day-unaccessed
eviction -- so publish has stopped refreshing that clock for every mirrored entry.
The comment records why it is accepted (the sidecar refreshes an in-use hash each
run; a mirrored entry is readable from the shard until retention prunes it) and
the one case worth watching (a hash that evicts before the month-shard rollover
cannot be re-mirrored into the new shard, where publish's own restore previously
kept it alive).

### WR-08: T-2S6-01's "structural" mitigation rests on an unpinned external property

**Verdict:** fixed by adding the gate -- the one behaviour-adjacent addition
authorised in this pass. Own commit, `3a82c01`.
**File:** `publish-mirror.spec.ts` (new case in the D1 describe).

The review offered two options: downgrade the wording, or add a gate. The
maintainer chose the gate, so the STRUCTURAL wording stays and the assumption is
now pinned.

Design, against the two questions the instruction posed:

- *Would writing nothing pass it?* No. The case computes 32 hashes through Nx's
  own hasher at test time. A version of this test that asserted nothing, or that
  only scanned a possibly-empty local `.nx/cache`, would pass on a cold clone; this
  one cannot.
- *Would an honest FALSIFIED pass it?* No. The values are Nx-rendered, not
  literals. `hashArray` is the function Nx's own task hasher composes the final
  task-hash value with (`task-hasher.js`: `value: hashArray([res.value, command])`)
  and it delegates straight to the native hasher. If Nx switched to hex rendering,
  the shape clause reddens: a hex-rendered u64 avoids `a-f` in roughly one string
  in 6500, so 32 draws make detection certain.

Two clauses, both load-bearing and neither subsuming the other. The shape clause
detects the renderer change. The enumeration clause -- all 32 hashes still reach
the restore under a foreign run id -- ties the shape to the consequence, so a
failure names the mirror rather than a regex; on its own it would be weak, since a
hex hash collides with one of the three marker words only about three times in
65536. The failure message names the installed Nx version and states what has to
change before the pin is relaxed.

I rejected the review's literal suggestion (scan the local `.nx/cache` entry
names). Those ARE real task hashes, but the check is vacuous whenever the cache is
cold, and making it non-vacuous means failing on a fresh clone. The deep
`nx/src/*` import carries the same no-semver-guarantee caveat the repo already
accepts at `nx-target-inputs.spec.ts` and `capture-hashes.mjs`, and an import-time
break on an Nx major is the desired loud failure.

### WR-09: the prose sweep left a false all-decimal claim in a job it swept

**Verdict:** fixed, using the review's wording.
**File:** `.github/workflows/ci.yml` (consumer-smoke round-trip step).

### WR-10: `action.yml`'s `hash` input description is stale

**Verdict:** fixed.
**File:** `packages/github-cache/action.yml`.

Now names `bead<run id>` for the dogfood pair and the bare run id for
`mirror-seed`, so the parenthetical is right for all four operations.

### WR-11: D5's stated division of labour credits a gate the named cause cannot trip

**Verdict:** fixed in the code comment. The plan's `must_have` row is deliberately
left alone -- see below.
**File:** `publish-mirror.ts` (partial-guard comment).

The partial branch now records which gate actually fires on a rotation: `ci.yml`
runs `mirror-seed` immediately before `publish` in the same job, so this leg's own
`feed<i><run_id>` seed is written in this run under the current cache version on
the default-branch ref -- it is enumerated and it always restores, leaving
`mirrored >= 1` and the total-case gate silent. The partial branch is the live
rotation signal; the gate above covers only a read-scope regression wide enough to
hide the seed itself.

I did not edit the plan's `must_have` truth ("the total case remains covered by
the existing gate"). It is not false as written -- the gate does still cover the
total case, and the total case is still arithmetically subsumed -- it is merely
incomplete about which branch fires in practice, and that is now stated at the
code site a reader tuning the threshold will actually be standing in. The
maintainer's instruction scoped the plan edit to the WR-01 invariant specifically.

---

## Not actioned (outside the stated scope)

### IN-01: no invariant assertion on the count reconciliation

**Verdict:** no change. Not in the maintainer's scope for this pass, and adding a
reconciliation helper across eleven existing cases is a test-suite change rather
than a correction. Worth doing; worth doing deliberately.

### IN-02: the `cafe` marker literal is pinned on only one side

**Verdict:** no change. Not in scope. Note that the finding's own framing is the
useful half -- the drift is fail-open, so this is a symmetry gap and not a fault.
The `SEED_MARKER_WORDS` comment already records that the three literals are
duplicated and why that is accepted; it does not distinguish which are
independently pinned, which is the residual IN-02 names.

### IN-03: the partial guard has no minimum-denominator floor

**Verdict:** no change, and the finding itself says recording the omission as
deliberate is enough for now. Adding a floor is a behaviour change and the
milestone is frozen.

---

## Verification

Run on the MAIN tree (C7), all green:

- `npx nx test github-cache --skip-nx-cache` -- 43 files, 1070 tests passing
  (baseline 1069 plus the one new pin).
- `npx nx run-many -t lint typecheck -p github-cache --skip-nx-cache` -- clean.
  Note `format:check` is NOT a project target: `run-many` silently ran only two of
  the three requested targets, so `nx format:check` was run separately and is
  clean.
- `npm run check:action` -- exit 0, no bundle drift, working tree clean afterwards.
- `npm run typecheck:action` -- exit 0.

Locked constraints re-confirmed by inspection of the final diff: no `permissions:`
block added or changed (C2, T-11-01); the `listCacheEntries` `ref` positional
untouched (C3, TRUST-10); no key prefix or namespace change (C5); nothing merged
and no shard asset deleted (C6).

---

_Fixed: 2026-08-09_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
