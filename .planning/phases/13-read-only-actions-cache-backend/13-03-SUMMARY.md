---
phase: 13-read-only-actions-cache-backend
plan: 03
subsystem: infra
tags: [backend-selection, env-knob, narrowing-guarantee, branch-order, esbuild-bundle, vitest, tdd]

# Dependency graph
requires:
  - phase: 13-read-only-actions-cache-backend
    provides: "13-02 exported createReadOnlyActionsCacheBackend(), the parameterless ReadableBackend this plan wires in as the fifth outcome"
  - phase: 05-write-trust-gate
    provides: "isWriteTrusted's reason-carrying union and the two allowlists, which decide every branch above the knob"
provides:
  - "CACHE_READ_ONLY: a strictly-narrowing ROLE knob read inline by selectBackend as its LAST branch, giving a fifth backend-selection outcome"
  - "an exhaustive narrowing-only proof over five enumerated env shapes, asserted as writable(withKnob) => writable(withoutKnob) by negating the QUANTIFIER"
  - "a mechanically-checkable branch-order guarantee: first-occurrence position of the knob sits between the token check and the writable return"
  - regenerated start-cache-server/index.js carrying the knob, committed with its source
affects: [13-04 consumer-contract + docs for the knob, 13-05 the three Windows leg gates, 13-06 evidence]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "narrowing-by-branch-order: a capability-reducing signal placed after every branch that could already reduce, so 'can only narrow' is control flow rather than a comment"
    - "outcome-folding in a table-driven proof: writable | read-only | throws collapsed into one value so a knobbed run and an un-knobbed run compare uniformly, with a throw treated as an OUTCOME rather than a harness failure"
    - "prose-over-quote for guarded literals: a comment names a rejected form in words rather than quoting it, because a zero-count grep on the same file guards it"

key-files:
  created: []
  modified:
    - packages/github-cache/src/lib/select-backend.ts
    - packages/github-cache/src/lib/select-backend.spec.ts
    - packages/github-cache/src/backend/memory-backend.ts
    - start-cache-server/index.js

key-decisions:
  - "The knob is read INLINE with bare truthiness (`if (env.CACHE_READ_ONLY)`), not through a resolveReadOnly() predicate module -- public-surface.spec.ts:70 already lists ./lib/select-backend.ts in KNOB_SOURCE_FILES, so the inline read is contract-covered and a module would have been a rung to skip"
  - "The knob name appears exactly ONCE in select-backend.ts, at its own branch. The top-level JSDoc refers to it as 'the read-only ROLE knob' instead, because the branch-order guarantee is checked by FIRST-OCCURRENCE position and a second mention would defeat the check it was meant to document"
  - "The rejected exact-string equality form is described in prose rather than quoted, for the same reason: a zero-count grep on this file guards against a 'true'/'1'/'yes' parser, and quoting the form to explain the ban trips the ban"
  - "The pairing that makes the read-only clause non-vacuous lives INSIDE one test (knobbed and un-knobbed halves together), so neither half can be deleted without the other"
  - "The narrowing table PINS each row's un-knobbed outcome rather than only asserting the implication -- without the pin, a row that stopped reaching the branch it names would still satisfy the implication trivially"

patterns-established:
  - "Assert an implication by negating the QUANTIFIER (a `widened(before, after)` helper asserted false unconditionally on every row), never by wrapping the assertion in an `if` that reads as a guard and behaves as a skip"
  - "For a one-way ratchet, truthiness is the fail-SAFE read: a typo'd value must still reduce capability, which an exact-string parser inverts"

requirements-completed: [TRUST-14]

coverage:
  - id: D1
    description: "A write-trusted env with a valid identity, a resolvable token and a set CACHE_READ_ONLY constructs the read-only ACTIONS backend -- not the memory-degrade backend, and not the writable one"
    requirement: TRUST-14
    verification:
      - kind: unit
        ref: "packages/github-cache/src/lib/select-backend.spec.ts#narrows the ONE writable outcome to the read-only ACTIONS backend, and leaves the SAME env writable without the knob (TRUST-14)"
        status: pass
      - kind: other
        ref: "the same test drives get() and asserts cache.restoreCache ran once -- the memory-degrade backend never touches @actions/cache, so this distinguishes the two read-only outcomes that isWritableBackend cannot"
        status: pass
    human_judgment: false
  - id: D2
    description: "No env shape makes selectBackend return a WRITABLE backend it would not have returned without the knob, over an enumerated table; rows that throw without it still throw with it"
    requirement: TRUST-14
    verification:
      - kind: unit
        ref: "packages/github-cache/src/lib/select-backend.spec.ts#narrowing-only (%s): the knob never turns a non-writable outcome writable (TRUST-14) -- 5 rows: untrusted event, dangerous event on a guarded host, malformed repository identity, no resolvable token, fully write-trusted"
        status: pass
      - kind: other
        ref: "each row asserts three things: the un-knobbed outcome matches its declared pin, widened(withoutKnob, withKnob) is false, and throw-parity holds in BOTH directions"
        status: pass
    human_judgment: false
  - id: D3
    description: "The knob check is the LAST branch, so the narrowing guarantee is control flow rather than a comment"
    requirement: TRUST-14
    verification:
      - kind: other
        ref: "mechanical first-occurrence check: indexOf('resolveGitHubToken(env)') < indexOf('CACHE_READ_ONLY') < indexOf('return createActionsCacheBackend()') -> 'branch order OK', exit 0"
        status: pass
      - kind: other
        ref: "git grep -c -E \"=== 'true'|=== \\\"true\\\"\" -- packages/github-cache/src/lib/select-backend.ts -> 0 matches (no exact-string parser)"
        status: pass
    human_judgment: false
  - id: D4
    description: "selectBackend.length is still 0 -- the knob is a key in the existing env bag, never a parameter, and no ServeOptions field or factory flag was added"
    requirement: TRUST-14
    verification:
      - kind: unit
        ref: "packages/github-cache/src/lib/select-backend.spec.ts#structural: selectBackend.length is 0 -- its single declared parameter has a default (TRUST-05) -- untouched, still green"
        status: pass
      - kind: unit
        ref: "packages/github-cache/src/lib/select-backend.spec.ts#behavioral: an untrusted env bag carrying override-shaped extra keys still yields a forbidden put (TRUST-05) -- untouched, still green"
        status: pass
    human_judgment: false
  - id: D5
    description: "A non-empty typo value still NARROWS; only unset or the empty string leaves the writable outcome"
    requirement: TRUST-14
    verification:
      - kind: unit
        ref: "packages/github-cache/src/lib/select-backend.spec.ts#a non-empty %j still NARROWS -- truthiness is the fail-safe direction (TRUST-14) -- 6 rows: '0', 'false', 'no', 'off', 'FALSE', ' '"
        status: pass
      - kind: unit
        ref: "packages/github-cache/src/lib/select-backend.spec.ts#an unset or empty knob (%j) leaves the writable outcome intact (TRUST-14) -- 2 rows: undefined, ''"
        status: pass
    human_judgment: false
  - id: D6
    description: "start-cache-server/index.js matches its source at the commit that edits select-backend.ts and memory-backend.ts"
    verification:
      - kind: other
        ref: "npm run check:action (MAIN tree) -> exit 0, no diff"
        status: pass
      - kind: other
        ref: "git log --oneline -1 --name-only at cbf60e6 lists select-backend.ts, memory-backend.ts and start-cache-server/index.js in ONE commit"
        status: pass
      - kind: other
        ref: "git grep -c CACHE_READ_ONLY -- start-cache-server/index.js -> 1 (the knob is in the artifact consumers execute)"
        status: pass
    human_judgment: false

# Metrics
duration: 7min
completed: 2026-08-02
status: complete
---

# Phase 13 Plan 03: The Narrowing CACHE_READ_ONLY Knob Summary

**`selectBackend` has a fifth outcome, and it sits LAST on purpose: every branch above it has already returned read-only or thrown, so the knob's only reachable effect is to convert the single writable outcome into a read-only one -- narrowing is control flow, not a promise.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-08-02T00:55:06Z
- **Completed:** 2026-08-02T01:02:00Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- **The "can only narrow" guarantee is mechanically checkable, not argued.** The proof is
  positional: `indexOf('resolveGitHubToken(env)') < indexOf('CACHE_READ_ONLY') <
  indexOf('return createActionsCacheBackend()')`. Every branch above the knob has already
  returned a read-only backend or thrown, so the knob cannot resurrect the Releases branch, the
  fail-closed throw, or the memory-degrade branch -- control never reaches it from any of them.
- **The narrowing table asserts the implication in the correct direction.** Each of five
  enumerated env shapes is built twice, folded into a `writable | read-only | throws` outcome,
  and asserted with `widened(withoutKnob, withKnob) === false` -- an unconditional assertion of
  "no row widened". An `if (withKnob === 'writable')` guard would read as the same claim and
  behave as a silent skip on every row; so would a negated matcher inside a single call
  assertion, which this repo has shipped before.
- **Each row PINS its un-knobbed outcome**, which is what stops the table going quietly vacuous.
  Without the pin, a row that stopped reaching the branch its label names would still satisfy the
  implication trivially and report success.
- **The read-only outcome is proven to be the ACTIONS one, not merely "a read-only one."**
  `isWritableBackend` cannot tell the read-only Actions backend from the memory-degrade backend --
  both lack `put`. Driving `get()` and asserting `cache.restoreCache` ran does, so a knob wired to
  the wrong read-only factory fails rather than passing a structural-only check.
- **Truthiness is the fail-SAFE read for a one-way ratchet.** `'0'`, `'false'`, `'no'`, `'off'`,
  `'FALSE'` and `' '` all still narrow; only unset and the empty string leave the writable outcome.
  An exact-string parser would let a typo silently restore write, which is the wrong failure
  direction. The empty-string row also catches a branch that tested the KEY's presence rather than
  its value.
- **`selectBackend.length` is still 0 and both pre-existing TRUST-05 clauses are untouched and
  green.** The knob is a key in the env bag that was already the sole parameter, so the widening
  proof it complements did not have to be weakened to accommodate it.

## Task Commits

Each task was committed atomically:

1. **Task 1: RED -- the read-only outcome, the exhaustive narrowing table, truthiness semantics** -- `73f002a` (test). 7 failures, every one "expected true to be false" on a still-writable backend.
2. **Task 2: GREEN -- the last-branch narrowing knob, and the outcome count that stops being four** -- `cbf60e6` (feat)
3. **Task 3: Regenerate the committed action bundle from the MAIN tree** -- amended into `cbf60e6`, per plan

## Files Created/Modified

- `packages/github-cache/src/lib/select-backend.ts` - fifth branch inserted immediately before
  `return createActionsCacheBackend()`; `createReadOnlyActionsCacheBackend` added to the existing
  import; the branch carries a WHY comment locking its POSITION, the ROLE-not-TRUST framing, the
  truthiness choice and its fail-safe direction, and the env-bag-key-not-parameter constraint.
- `packages/github-cache/src/lib/select-backend.spec.ts` - a `TRUST-14` describe placed directly
  after the `TRUST-05` widening describe it complements: the paired read-only/writable clause, the
  five-row narrowing table plus its `SelectOutcome`/`outcomeOf`/`widened` helpers, and eight
  truthiness rows. 14 new tests; suite went 950 -> 964.
- `packages/github-cache/src/backend/memory-backend.ts` - "one of the **four** backend-selection
  outcomes" -> "**five**", corrected in the same commit that makes it false (D-06).
- `start-cache-server/index.js` - regenerated from the MAIN tree; the diff is exactly the three
  executable lines of the new branch.

## Decisions Made

- **The knob name appears exactly once in `select-backend.ts`, at its own branch.** The top-level
  JSDoc calls it "the read-only ROLE knob" instead. This is not stylistic: the branch-order
  guarantee is checked by FIRST-OCCURRENCE position, so a second mention in a doc comment above
  the token check defeats the very check it was trying to document. The JSDoc now says so, so a
  later reader does not "improve" it back.
- **The rejected exact-string equality form is described in prose, never quoted.** A zero-count
  grep on this file guards against a `'true'`/`'1'`/`'yes'` parser; quoting the form in a comment
  that bans it trips the ban. Same defect class as the previous point, and both were discovered by
  the criteria themselves rather than by review.
- **No `resolveReadOnly()` predicate module.** `trust.ts`'s reason-carrying union exists because a
  SILENT read-only degrade needed to be observable at the call site; a knob the workflow author set
  deliberately is not silent. `public-surface.spec.ts:70` already lists `./lib/select-backend.ts` in
  `KNOB_SOURCE_FILES`, so the inline read is already contract-covered and the module would have
  bought nothing.
- **The non-vacuity pairing lives inside ONE test.** Splitting "knob narrows" and "same env is
  writable without it" into two tests lets one be deleted while the other still passes and looks
  meaningful. Kept together, neither half survives alone.
- **A throw is an OUTCOME in the narrowing table, not a harness failure.** The fail-closed branch is
  one of the rows the proof must cover, and "the knob does not rescue a malformed identity" is a
  claim about that outcome. Throw parity is asserted in BOTH directions, so a knob that swallowed
  the fail-closed branch fails rather than reading as a successful narrowing.
- **`EXPECTED_ENV_KNOBS` was deliberately NOT touched.** It is still 8 entries, so
  `public-surface.spec.ts` is green at this plan's end; it goes RED in 13-04 by design. The
  `docs/advanced.md` and `docs/configuration.md` four-outcome sites are 13-04's DOCS-10 work and
  were left alone despite 13-02's handoff note loosely assigning them here.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] My own JSDoc mention of the knob defeated the branch-order check**

- **Found during:** Task 2 (running the acceptance criteria after GREEN)
- **Issue:** The plan asked for the knob to be named in the branch comment; I also extended
  `selectBackend`'s top-level JSDoc to mention `CACHE_READ_ONLY`. That JSDoc sits ABOVE the token
  check, and the order check uses `indexOf` -- so the first occurrence was at offset 1435, before
  `resolveGitHubToken(env)` at 2727. `knob branch is not last`, on a branch that WAS last.
- **Fix:** JSDoc reworded to "the read-only ROLE knob (TRUST-14), the last branch below", plus a
  sentence recording WHY the name is not repeated there, so it is not re-added.
- **Files modified:** `packages/github-cache/src/lib/select-backend.ts`
- **Verification:** `branch order OK`, exit 0.
- **Committed in:** `cbf60e6`

**2. [Rule 1 - Bug] My own comment quoting the banned equality form tripped its zero-count grep**

- **Found during:** Task 2 (same run)
- **Issue:** The branch comment said "never `=== 'true'`" to record the truthiness decision. The
  acceptance criterion is a zero-count grep for exactly that string on exactly that file, so the
  explanation of the ban violated the ban -- count 1.
- **Fix:** Reworded to "never an exact-string equality against a `'true'` literal, and no
  `'true'`/`'1'`/`'yes'` parser", with a parenthetical noting the form is spelled out in prose
  because a zero-count grep guards the file.
- **Files modified:** `packages/github-cache/src/lib/select-backend.ts`
- **Verification:** `git grep -c -E "=== 'true'|=== \"true\""` -> 0 matches.
- **Committed in:** `cbf60e6`

### Plan Premise Corrected

**3. The bundle drifts here for ONE reason, not two -- esbuild does NOT preserve these comments**

- **Found during:** Task 3
- **Plan claim:** "the `memory-backend.ts` comment-only edit drifts [the bundle] too because
  esbuild preserves source comments in this configuration", cited as the non-obvious second reason.
- **What is actually true:** esbuild's comment retention here is POSITIONAL, not blanket. The
  `memory-backend.ts` change is inside a leading JSDoc block on an exported declaration, and those
  are STRIPPED -- `git grep -c "backend-selection outcomes" -- start-cache-server/index.js` returns
  0 both before and after. My ~20-line statement-level comment in `select-backend.ts` was stripped
  too. The comment the plan verified as surviving (`read-only-ness is structural`) sits INSIDE an
  object literal, between members, which is a position esbuild does keep.
- **Consequence:** the bundle diff is exactly the three executable lines of the new branch
  (`+3 / -0`), and a comment-only edit to a JSDoc block is NOT a bundle-drift event. A future
  executor should not expect one, and should not treat a zero-diff bundle after a doc-comment edit
  as a failed build.
- **No code change** -- the regenerated bundle is correct either way; only the plan's stated reason
  was wrong.

---

**Total deviations:** 2 auto-fixed (both Rule 1), 1 plan-premise correction
**Impact on plan:** None on outcome. Both bugs were in my own explanatory comments rather than in
the logic, and both were caught by the plan's own mechanical criteria -- which is the criteria
working as intended.

## Issues Encountered

- **The two comment-vs-grep collisions are the same defect class 13-02 hit** ("my own new comment
  quoting the OLD prefix"). Three occurrences on this branch now. The general shape: when a
  criterion is a mechanical scan over a file, prose ON that file is INPUT to the scan, and any
  comment that quotes the guarded literal to explain it will trip it. Both fixes record the reason
  inline so the next reader does not undo them.
- **The RED was 7 failures, not 14.** The narrowing table (5 rows) and the unset/empty rows (2)
  pass against an implementation that ignores the knob entirely -- correctly so: the table proves
  narrowing, not that the knob acts. Only the paired outcome clause and the six truthiness rows can
  be red before the branch exists. Worth knowing so a future executor does not read a partial RED
  as a broken table.

## User Setup Required

None - no external service configuration required. The knob is not yet set anywhere; 13-05 wires it
into the three Windows legs.

## Next Phase Readiness

- **13-04 can add `CACHE_READ_ONLY` to `EXPECTED_ENV_KNOBS`.** The source-side half is done: the
  knob is read in `./lib/select-backend.ts`, which is already in `public-surface.spec.ts`'s
  `KNOB_SOURCE_FILES`, so the `KNOB_SOURCE_FILES` scan will pass the moment the contract entry
  lands. The remaining 13-04 work is the contract entry, the `docs/configuration.md` documentation
  clause, and the DOCS-10 four-outcome sites (`docs/advanced.md:21`,
  `docs/configuration.md:92`, and `docs-adoption.spec.ts`'s four-outcome clause).
- **`memory-backend.ts` no longer says four**, so `docs/advanced.md`'s table is now the only place
  in the repo claiming four outcomes. That is 13-04's to close.
- **Bundle coupling stays live.** Any further edit to a `serve()`-reachable source file needs
  `npm run build:action` in the SAME commit, from the MAIN tree.
- Pre-existing untracked `.planning/phases/13-read-only-actions-cache-backend/.gitkeep` was present
  before this plan started and is out of its scope; left untouched.
- No blockers.

## Self-Check: PASSED

Files verified present:
- `packages/github-cache/src/lib/select-backend.ts`
- `packages/github-cache/src/lib/select-backend.spec.ts`
- `packages/github-cache/src/backend/memory-backend.ts`
- `start-cache-server/index.js`

Commits verified in history: `73f002a`, `cbf60e6`

Battery (all from the MAIN tree): `npm run test` green (964 passed, 42 files),
`npx nx run-many -t typecheck lint --projects=github-cache --skip-nx-cache` green,
`npm run check:action` exit 0 with no diff, `npx prettier --check` clean on all three source files,
`git status --porcelain packages/github-cache/src start-cache-server` empty.

---
*Phase: 13-read-only-actions-cache-backend*
*Completed: 2026-08-02*
