---
phase: 08-nx-task-hash-parity
plan: 02
subsystem: infra
tags: [nx, task-hashing, cross-os, tdd, gate, packaging, esm]

# Dependency graph
requires:
  - phase: 08-nx-task-hash-parity
    plan: 01
    provides: the capture instrument and its record shape -- `{ meta, targets: { <target>: { hash, command, nodes } }, projectConfiguration, discriminator }` -- which is the contract this comparator narrows
provides:
  - compareHashParity -- a pure, typed, discriminated verdict over exactly two platform records, implementing D-20's clauses (a), (b), (c) plus D-21's fourth clause, with a named reason and a cause-naming detail per failure
  - an OBSERVED RED for every clause, in two passes (import-time, then an unconditional-success implementation), plus a discrimination check that the vacuity control tracks the Pitfall 4 defect specifically
  - assert-parity.ts -- the thin CI bin the compare job runs, printing a stable literal success prefix that plan 08-06's workflow step greps for
  - the `!dist/hash-parity` tarball exclusion AND the pack-check predicate that asserts it, proven able to fire
  - pack-check.cjs DIST_SUBTREES -- one authored source for four previously-independent enumerations
affects: [08-06 the gating CI job (consumes the bin and the success prefix), 08-03 two-leg capture job (its artifacts are this comparator's input), phase 12 DOCS-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-pass RED: the import-time failure is recorded as WEAK evidence, and a deliberately-wrong unconditional-success implementation is the pass that actually reddens each clause"
    - "Discrimination check over a mutation-mutation: the vacuity control is shown to fail on the EXACT defect it names (Object.keys of the arriving map) and on nothing else"
    - "A type models only the fields its narrowing function validates, so the type cannot become an unchecked assertion about a file"
    - "Single-source + derivation for an enumeration restated in code AND prose: derive every runtime site, keep the one comment hand-written, and say in the comment that it is hand-written"

key-files:
  created:
    - packages/github-cache/src/hash-parity/compare.ts
    - packages/github-cache/src/hash-parity/compare.spec.ts
    - packages/github-cache/src/hash-parity/assert-parity.ts
  modified:
    - packages/github-cache/package.json
    - packages/github-cache/pack-check.cjs
    - .fallowrc.jsonc

key-decisions:
  - "`HashParityRecord` models ONLY the fields `shapeFault` validates. `targets.<t>.command`, `discriminator.command`, `discriminator.status`, `projectConfiguration` and the other ten `meta` keys are emitted by the instrument and deliberately left unmodelled -- declaring a field the module neither checks nor reads would recreate the parsed-from-disk assertion the header warns against. The spec fixture carries all of them anyway, so every test doubles as proof the comparator tolerates them."
  - "A non-string `hash` is `malformed-record` (a shape fault) while an ABSENT entry, an EMPTY hash string and an EMPTY `nodes` map are `missing-target-hash` (a completeness fault). The split keeps `shapeFault` a pure type check over what arrived and clause (a) a pure completeness check against EXPECTED_TARGETS."
  - "`shapeFault` DOES iterate `Object.entries(targets)`, and that is correct: it type-checks what turned up. Pitfall 4 governs COMPLETENESS, which is decided against EXPECTED_TARGETS. The distinction is stated inline because reading that loop as the violation is the easy misread."
  - "The success prefix is `hash-parity: PARITY OK` -- colour-free, not Nx-formatted, and named in the module header as the string the workflow asserts on (D-23)."
  - "`console.error` + `process.exitCode` over `@actions/core`: the compare job is a plain `run:` step, so the helper adds only an inline annotation over a non-zero exit, and `process.exitCode` lets a long detail string flush instead of truncating."

patterns-established:
  - "Pattern: prove the guard discriminates, not merely that it can fail -- inject the exact defect the control names and confirm it reddens that control and nothing else"
  - "Pattern: a grep-verifiable absence claim must not spell the token it forbids, anywhere in the file, including in the sentence explaining the rule"

# Deliberately empty, matching plan 08-01's reasoning. This plan's frontmatter claims
# CORR-03 and PARITY-07, and neither is CLOSED here: CORR-03 needs the two-leg job (08-06)
# observed red once against a REAL leg, which 08-VALIDATION.md lists as a Live-CI first-push
# closure, and PARITY-07 is a phase-end property the verifier closes against VERIFICATION +
# SUMMARY + REQUIREMENTS. Additionally `requirements.mark-complete` has corrupted
# REQUIREMENTS.md in two prior waves of this project (STATE.md, Phase 07 P04), so the tool
# was not invoked.
requirements-completed: []

coverage:
  - id: D1
    description: "compareHashParity FAILS each of D-20's clauses independently with a named reason, and PASSES a genuinely-correct pair"
    requirement: CORR-03
    verification:
      - kind: unit
        ref: "packages/github-cache/src/hash-parity/compare.spec.ts -- 28 cases, `npx nx test @op-nx/github-cache` (560 passed)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every clause, including the empty-`targets` vacuity control, was OBSERVED failing before the implementation was trusted"
    requirement: CORR-03
    verification:
      - kind: other
        ref: "RED pass 1 (import failure: Test Files 1 failed | 33 passed, 0 of 28 clause cases ran); RED pass 2 (unconditional success: 28 tests | 23 failed, positive control + four content pins green)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The vacuity control tracks the Pitfall 4 defect specifically, not merely 'something broken'"
    requirement: CORR-03
    verification:
      - kind: other
        ref: "clause (a)'s loop swapped to `Object.keys(a.targets)`, run, reverted: exactly 2 of 28 failed -- the vacuity control and the absent-entry case -- and the other 26 stayed green"
        status: pass
    human_judgment: false
  - id: D4
    description: "A malformed downloaded record produces a named verdict, never a TypeError"
    requirement: CORR-03
    verification:
      - kind: unit
        ref: "six malformed shapes plus a non-object record; each asserts `.not.toThrow()` AND reason `malformed-record`. RED pass 2 surfaced two of them as the literal TypeError this clause converts."
        status: pass
    human_judgment: false
  - id: D5
    description: "dist/hash-parity is excluded from the published tarball and the exclusion is ASSERTED by a guard proven able to fire"
    requirement: PARITY-07
    verification:
      - kind: other
        ref: "`npm run build && npm run pack:check` exits 0 naming four excluded subtrees (53 files); with `!dist/hash-parity` temporarily removed it exits 1 naming all four leaked dist/hash-parity paths. Observed, then reverted."
        status: pass
    human_judgment: false
  - id: D6
    description: "The public surface passes UNCHANGED -- src/index.ts, public-surface.spec.ts and src/test/consumer-contract.ts untouched"
    requirement: PARITY-07
    verification:
      - kind: other
        ref: "`git diff --name-only da7345e..HEAD -- nx.json src/index.ts src/public-surface.spec.ts src/test/consumer-contract.ts` returns zero files; public-surface.spec.ts's 13 tests pass"
        status: pass
    human_judgment: false
  - id: D7
    description: "The built bin exits 0 with the stable prefix on a valid pair and non-zero with a named reason otherwise"
    requirement: CORR-03
    verification:
      - kind: other
        ref: "run against real instrument records: pair -> exit 0, one stdout line beginning `hash-parity: PARITY OK`; single record -> exit 1, `wrong-record-count` plus the three suspects; missing directory -> exit 1, named error"
        status: pass
    human_judgment: false

# Metrics
duration: 26min
completed: 2026-07-28
status: complete
---

# Phase 8 Plan 02: The Comparator Summary

**A pure typed verdict over exactly two platform records -- six named failure reasons, an ordered guard chain that narrows untrusted artifact JSON instead of asserting it, every clause observed RED in two passes before GREEN, and a build output that provably cannot reach the tarball.**

## Performance

- **Duration:** 26 min
- **Started:** 2026-07-28T01:05Z
- **Completed:** 2026-07-28T01:31Z
- **Tasks:** 2 (3 commits)
- **Files modified:** 6 (3 created, 3 modified)

## Accomplishments

- **The RED was observed in TWO passes, and the second is the one that counts.** Pass 1 was the import-time failure with no `compare.ts` at all: `Test Files 1 failed | 33 passed`, and NONE of the 28 clause cases ran -- loud, unambiguous, and weak, because it proves nothing about the clauses. Pass 2 replaced it with an implementation returning `{ ok: true }` unconditionally: `28 tests | 23 failed`, with the positive control and all four content pins staying GREEN. That is the shape D-22 asks for -- every negative red, every positive green, at once.

- **The vacuity control was shown to DISCRIMINATE, not merely to fail.** Phase 7's lesson is that a control can be satisfied by the wrong thing, so clause (a)'s loop was temporarily swapped from `EXPECTED_TARGETS` to `Object.keys(a.targets)` -- the literal Pitfall 4 defect. Exactly 2 of 28 cases went red (the empty-`targets` control and the absent-entry case); the other 26 stayed green. The control tracks the defect it names. Mutation reverted; nothing was committed mutated.

- **Two malformed cases surfaced during RED pass 2 as the literal `TypeError: Cannot read properties of undefined (reading 'meta')`** -- the exact crash T-08-06 exists to convert into a named verdict. The shipped `shapeFault` returns `malformed-record` naming the record index and the first offending path instead.

- **`HashParityRecord` models only what is validated.** The instrument emits four more per-target/discriminator fields and ten more `meta` keys; the type declares none of them, because a declared-but-unchecked field is exactly the parsed-from-disk assertion `nx-target-inputs.spec.ts:243-255` warns about. The spec fixture carries all of them regardless, so all 28 cases double as proof the comparator tolerates the parts of the record it does not read.

- **`pack-check.cjs` had FOUR independent enumerations of its excluded subtrees, not the three the plan named.** The fourth is the FAILURE message at `:154-158`. All three runtime sites now derive from one `DIST_SUBTREES` array; the module header stays hand-written (a comment has no runtime) and now says so in a sentence. Each generated predicate is the same prefix test on the same string, so the refactor is behaviour-preserving for the first three and additive for the fourth.

- **The pack guard was seen firing.** With `!dist/hash-parity` temporarily removed, `npm run pack:check` exits 1 naming all four leaked `dist/hash-parity/*` paths and the derived message names four subtrees. With it in place, 53 files ship and it exits 0. Reverted; the exclusion is committed.

- **The bin was exercised against REAL instrument records**, not fixtures: a valid pair (one genuine `win32` capture plus a derived `linux` leg) exits 0 with a single stdout line beginning `hash-parity: PARITY OK`; a one-record directory exits 1 naming `wrong-record-count` and the three suspects; a missing directory exits 1 with a named error rather than a bare ENOENT stack.

- **`nx.json` is untouched by every commit in this plan** (D-06/D-15), as are `src/index.ts`, `public-surface.spec.ts` and `src/test/consumer-contract.ts`. PARITY-07 is satisfied by the public-surface guard passing WITHOUT being edited.

## Task Commits

1. **Task 1 RED: the failing comparator spec** - `948c900` (test)
2. **Task 1 GREEN: the CORR-03 comparator** - `0e7b0bf` (feat)
3. **Task 2: the CI bin, the tarball exclusion and its assertion** - `891c2c2` (feat)

## Files Created/Modified

- `packages/github-cache/src/hash-parity/compare.ts` - `compareHashParity(records: readonly unknown[]): ParityVerdict`, six named reasons, `EXPECTED_TARGETS` / `INVARIANT_TARGETS` / `DIVERGENT_TARGET` / `REQUIRED_META_KEYS`, and `shapeFault` / `targetFault`.
- `packages/github-cache/src/hash-parity/compare.spec.ts` - 18 `it(` sites producing 28 cases across the nine `08-VALIDATION.md` Wave 0 rows plus the shape and partition cases.
- `packages/github-cache/src/hash-parity/assert-parity.ts` - the thin CI bin: read, compare, print the stable prefix or the named reason.
- `packages/github-cache/package.json` - `!dist/hash-parity` added to `files`, positioned with its three siblings.
- `packages/github-cache/pack-check.cjs` - `DIST_SUBTREES` plus the derived predicates and both derived messages.
- `.fallowrc.jsonc` - `assert-parity.ts` declared as a manual entry point.

## Decisions Made

- **`HashParityRecord` models only the fields `shapeFault` validates.** See the frontmatter. The alternative -- modelling the full emitted record -- would put unchecked fields in a type used as a narrowing target.
- **A non-string `hash` is a SHAPE fault, an absent/empty/unattributable one is a COMPLETENESS fault.** `malformed-record` covers wrong types; `missing-target-hash` covers a missing entry, an empty hash string and an empty `nodes` map. This is what lets `shapeFault` iterate the arriving keys honestly while clause (a) iterates `EXPECTED_TARGETS`.
- **`shapeFault` deliberately iterates `Object.entries(targets)`.** Stated inline, because reading that loop as the Pitfall 4 violation is the easy misread, and the vacuity control is what tells the two apart.
- **`discriminator.stdout`/`stderr` are required PRESENT but may be EMPTY.** `stderr` is empty on every healthy leg, so the check is on the type, never the length.
- **Success prefix `hash-parity: PARITY OK`**, colour-free and not Nx-formatted, named in the module header as the string plan 08-06's step asserts on.
- **`console.error` + `process.exitCode`, not `@actions/core`.** The compare job is a plain `run:` step; `process.exitCode` also lets a long detail string flush rather than truncating.
- **Zero re-exports from `src/index.ts`.** `public-surface.spec.ts` pins the barrel by deep equality; not editing it is the proof (PARITY-07, D-16).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The spec's own header made its "no snapshot matcher" source assertion return a false positive**

- **Found during:** Task 1 verification
- **Issue:** One acceptance criterion is verified by scanning the file for the snapshot matcher's name and finding none. The header comment stated the house rule using the matcher's literal name -- true, useful, and a match for the scan. This is 08-01's deviation 4 recurring in a new file, and Phase 7's "a lexical guard can be satisfied by the wrong token" one level up: here the token's PRESENCE in prose defeats an ABSENCE check.
- **Fix:** Reworded the rule so the matcher's name is not written anywhere in the file, and said in the comment why it is written that way.
- **Files modified:** `packages/github-cache/src/hash-parity/compare.spec.ts`
- **Verification:** the source scan over `src/hash-parity/` now returns no match; the first reword attempt still contained the token inside the sentence claiming it was absent, and was caught by re-running the scan rather than by reading.
- **Committed in:** `948c900`

**2. [Rule 1 - Bug] The same inversion in the loader's header, for the `file://` assertion**

- **Found during:** Task 2 verification
- **Issue:** The acceptance criterion "does not construct a `file://` URL by string concatenation, verifiable as a source assertion" was defeated by the header sentence explaining why the naive concatenated form is not used -- which spelled the scheme literal.
- **Fix:** Restated the Windows Pitfall-6 rationale without writing the scheme literal, and recorded the inversion in the comment.
- **Files modified:** `packages/github-cache/src/hash-parity/assert-parity.ts`
- **Verification:** `rg "file://" assert-parity.ts` returns no match; `isEntrypoint(import.meta.url)` is present at the guard.
- **Committed in:** `891c2c2`

**3. [Rule 2 - Missing Critical] `pack-check.cjs` enumerated its excluded subtrees in FOUR places, not three**

- **Found during:** Task 2 step 3
- **Issue:** The plan names three sites (the module header, the `FORBIDDEN` predicates, the success message). There is a fourth: the FAILURE message at `:154-158` also lists `dist/action, dist/roundtrip, dist/test` by hand. Deriving three of four and leaving the fourth hand-written would have reproduced the exact staleness bug the refactor exists to remove -- and in the message a maintainer only ever reads when the guard is already red.
- **Fix:** Added a `DIST_SUBTREE_LIST` join derived from the same array and used it in BOTH messages. Verified: the four subtree directory names now appear only inside `DIST_SUBTREES` and in the hand-maintained module header.
- **Files modified:** `packages/github-cache/pack-check.cjs`
- **Verification:** the failure path was exercised (exclusion temporarily removed) and the printed failure message names four subtrees.
- **Committed in:** `891c2c2`

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 missing-critical)
**Impact on plan:** All three are corrections to the plan's own verification surface. None expands scope and none touches `nx.json`, `src/index.ts` or the public-surface guard. Deviations 1 and 2 are the same defect class in two files, which is itself the finding: a grep-verifiable ABSENCE claim must not spell the token it forbids, anywhere, including in the sentence explaining the rule.

## Issues Encountered

- **The RED pass 2 implementation had to be written to the real path**, because the spec imports it. It was never staged: the `test(...)` commit contains only the spec, and the `feat(...)` commit contains the finished comparator. `git log -p` for `compare.ts` shows one insertion, not a wrong version followed by a fix.
- **`git checkout -- packages/github-cache/package.json` reverted more than intended** while undoing the temporary exclusion removal: the `!dist/hash-parity` addition was itself uncommitted at that point, so the checkout dropped both. Caught immediately by a follow-up grep, and re-added before the commit. The committed `files` array is correct and `pack:check` was re-run green afterwards.

## Live-CI Items (not closable here)

Per `08-VALIDATION.md`'s Live-CI first-push list, the comparator is unit-proven but the GATE is not yet proven:

- **CORR-03 "the gate actually gates"** needs the compare job observed red once against a REAL leg, as distinct from a fixture. Owned by plan 08-06.
- **Whether `lint` diverges cross-OS** cannot be settled by any local run (D-21). If it does, D-21's named fallback applies: the clause is DOWNGRADED to a recorded-with-a-named-finding test, never deleted. The spec already carries that instruction in the `INVARIANT_TARGETS` describe block so the downgrade cannot be mistaken for a deletion.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for 08-06 (the gate).** The bin is `node packages/github-cache/dist/hash-parity/assert-parity.js <records-dir>`; it defaults to `hash-parity-records` when given no argument, reads every `.json` in the directory name-sorted, and prints exactly one stdout line beginning with the literal `hash-parity: PARITY OK` on success. The workflow step must grep for that prefix, not read the exit code (D-23). A directory that exists but received no artifact produces `wrong-record-count` naming the three suspects -- that is the case the grep exists for.

**Ready for 08-03 (the two-leg capture job).** The comparator's contract on the record is now explicit and narrow: seven non-empty `meta` strings, a `targets` entry per EXPECTED_TARGET with a non-empty `hash` and a non-empty `nodes` map, and `discriminator.stdout`/`stderr` present as strings. Everything else the instrument emits is tolerated. The two legs must report DIFFERENT `meta.os` values or the verdict is `duplicate-platform`.

**Carried forward, not resolved here:**

- U-01 remains UNRESOLVED. Nothing in this plan bears on whether `nx.json` alone can reach the fix.
- `nx.json` is deliberately untouched; the fix lands in 08-05, behind 08-03's anchor commit (D-06/D-15).

**No blockers.**

## Self-Check: PASSED

Files claimed created/modified, verified present:

- `packages/github-cache/src/hash-parity/compare.ts` - FOUND
- `packages/github-cache/src/hash-parity/compare.spec.ts` - FOUND
- `packages/github-cache/src/hash-parity/assert-parity.ts` - FOUND
- `packages/github-cache/package.json` - FOUND (contains `!dist/hash-parity`)
- `packages/github-cache/pack-check.cjs` - FOUND (contains `DIST_SUBTREES`)
- `.fallowrc.jsonc` - FOUND (contains the `assert-parity.ts` entry)

Commits claimed, verified present in `git log`:

- `948c900` - FOUND (test: the failing spec)
- `0e7b0bf` - FOUND (feat: the comparator)
- `891c2c2` - FOUND (feat: the bin and the exclusion)

Plan-level constraints, verified:

- `git diff --name-only da7345e..HEAD -- nx.json` returns 0 files - PASS
- `git diff --name-only da7345e..HEAD -- src/index.ts src/public-surface.spec.ts src/test/consumer-contract.ts` returns 0 files - PASS
- No commit in this range deletes a tracked file - PASS
- TDD gate sequence present: a `test(...)` commit precedes the `feat(...)` commit - PASS
- All nine battery commands green at the final commit (`format:check`, `build`, `typecheck`, `typecheck:action`, `test`, `lint`, `fallow:ci`, `check:action`, `pack:check`) - PASS
- Zero non-ASCII characters in all six touched files - PASS
- Zero occurrences of the snapshot matcher's name in `src/hash-parity/` - PASS
- The four dist-subtree directory names appear in `pack-check.cjs` only inside `DIST_SUBTREES` and in the hand-maintained module header - PASS

---
*Phase: 08-nx-task-hash-parity*
*Completed: 2026-07-28*
