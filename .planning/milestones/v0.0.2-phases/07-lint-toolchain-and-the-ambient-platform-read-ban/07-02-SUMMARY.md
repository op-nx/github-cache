---
phase: 07
plan: 02
subsystem: lint-toolchain
tags: [eslint, no-restricted-syntax, no-restricted-imports, ambient-platform-ban, tdd, drift-guard, flaky-test]
status: complete
requires:
  - eslint.config.mjs (plan 07-01)
  - packages/github-cache/src/lint-rules.spec.ts ESLint Node-API harness (plan 07-01)
  - the shared non-vacuity control with its position check (plan 07-01)
  - the eight-command pre-commit battery
provides:
  - the two ban rules and BAN_MESSAGE in eslint.config.mjs (LINT-02)
  - CORR_05_SITES, the four-row D-22 site table in lint-rules.spec.ts
  - the D-21 evasion-shape verdicts and the six false-positive controls
  - the CORR-06 direction pair at an *.integration.spec.ts path
  - four described eslint-disable-next-line directives at four error positions
  - packages/github-cache/src/lint-scope-drift.spec.ts (D-19 guard, D-08 mechanical lock)
affects:
  - packages/github-cache/src/lib/cache-archive-path.spec.ts
  - packages/github-cache/src/backend/releases-backend.spec.ts
  - packages/github-cache/src/lib/release-asset-name.spec.ts
  - .planning/phases/07-lint-toolchain-and-the-ambient-platform-read-ban/07-EVIDENCE.md
tech-stack:
  added: []
  patterns:
    - two core ESLint rules behind ONE shared message constant (D-15, no plugin, no new dependency)
    - ignores as a SIBLING of files, so integration specs keep every other rule (D-17)
    - a site table keyed on FILE + EXPRESSION TEXT, never a line number (D-22)
    - blank-do-not-delete when stripping a directive, so line numbering survives the strip
    - importing eslint.config.mjs through a NON-LITERAL specifier to read real config values
key-files:
  created:
    - packages/github-cache/src/lint-scope-drift.spec.ts
  modified:
    - eslint.config.mjs
    - packages/github-cache/src/lint-rules.spec.ts
    - packages/github-cache/src/lib/cache-archive-path.spec.ts
    - packages/github-cache/src/backend/releases-backend.spec.ts
    - packages/github-cache/src/lib/release-asset-name.spec.ts
    - .planning/phases/07-lint-toolchain-and-the-ambient-platform-read-ban/07-EVIDENCE.md
decisions:
  - "P7 INCLUDED, not declined -- so globalThis.process.platform needs no ceiling comment."
  - "Q6 closed affirmatively: the non-literal dynamic import of eslint.config.mjs works under both vitest and typecheck, so the disk-read fallback was not needed on the ESLint side."
  - "Q5 closed affirmatively: every esquery-measured verdict reproduced under real ESLint with the real parser."
  - "The path.join false-positive control uses a LOCAL object, because a namespace import of node:path is itself an error and belongs in the evasion table."
  - "M4 run in a third variant not in VALIDATION.md (narrow BOTH globs), which is the only one that isolates the superset invariant."
metrics:
  duration: ~25 min
  tasks: 2
  files: 6
  post_merge_fixes: 1
  tests: 453 -> 486
  completed: 2026-07-27
---

# Phase 7 Plan 02: The Ambient-Platform-Read Ban Summary

The convention is now a build failure: two core ESLint rules behind one shared message,
proven RED before GREEN over seven evasion shapes and all four extant violations, with
four described opt-outs that keep the build green while leaving the violations in place
for Phases 9 and 10.

## What Shipped

**The two ban rules** in `eslint.config.mjs`, scoped by `files: ['**/*.spec.{ts,mts,cts}']`
with `ignores: ['**/*.integration.spec.{ts,mts,cts}']` as a SIBLING key in the same object.
`no-restricted-imports` carries FOUR `paths` entries -- the prefixed and bare `os` and `path`
specifiers are independent exact-string keys -- with the seven os accessors and the four path
accessors declared once each and shared across the pair. `no-restricted-syntax` carries
RESEARCH G2's measured P1..P7. One `BAN_MESSAGE` constant is referenced by every
`paths[].message` and every selector message, so the two rules cannot give contradictory
advice; P2's message extends it with its own deliberate blast radius rather than replacing it.

**28 new assertions** in `lint-rules.spec.ts`: 7 evasion shapes, 6 false-positive controls,
7 integration-path direction assertions, and 8 site assertions (4 sites x 2). Every one routes
through plan 07-01's shared non-vacuity control.

**`lint-scope-drift.spec.ts`**, 5 assertions: the two D-19 invariants read from the real
configs, a structural proof that `ignores` is a sibling of `files`, and D-08's mechanical
root-directory lock.

**Four described disables** at four error positions across three files, each stating why the
assertion cannot move to integration and naming its removal owner.

## Task Commits

| Task | Commit | What |
|---|---|---|
| 1 | `1454404` | the two rules, the RED proof, the four disables |
| 2 | `5adde9b` | the D-19 drift guard and the D-08 lock |
| post-merge fix | `e683c92` | hoist the toolchain boot out of the per-test budget |

Task 1 is necessarily one commit. D-31 requires the disables alongside the rules, and
independently any commit where the rules are enforced and the disables are absent is RED --
which this repo's bisect-safety standard forbids.

## The RED, Observed

Written and RUN before either rule existed. **15 failed, 22 passed of 37.**

| Group | Count | Verdict |
|---|---|---|
| plan 07-01's nine assertions | 9 | passed, untouched |
| D-21 evasion shapes at a unit path | 7 | **FAILED** |
| false-positive controls | 6 | passed (vacuously, by design) |
| CORR-06 direction pair at the integration path | 7 | passed |
| D-22 "is CAUGHT once the disable is stripped" | 4 | **FAILED** |
| D-22 "carries a described disable" | 4 | **FAILED** |

Actual failure text, site 2:

```
AssertionError: expected 'const OTHER_PLATFORM: NodeJS.Platform...' to contain
  'eslint-disable-next-line no-restricte...'
Expected: "eslint-disable-next-line no-restricted-syntax"
Received: "const OTHER_PLATFORM: NodeJS.Platform ="
```

and for an evasion shape, `expected [] to deeply equal [ 'no-restricted-syntax' ]`.

**The direction controls passing on BOTH sides is what makes the RED interpretable.** Had the
seven integration-path assertions failed too, the meaning would have been "the config never
loaded" -- the ignored/unconfigured trap, and the single most likely way this phase could
have shipped a vacuous guard. Intermediate after STEP 2: **6 failed, 31 passed**. After
STEP 3: **37 of 37**.

## Key Results

**P6 earned its mandatory status empirically.** With the full selector set live, the dynamic
import shape is caught by `no-restricted-syntax` and by nothing else -- `no-restricted-imports`
reports neither `await import('node:os')` nor `await import('node:path')`. RESEARCH C1 is
confirmed rather than assumed.

**Q5 is closed affirmatively.** Every shape in RESEARCH G2's esquery-measured verdict table
reproduced exactly under real ESLint with `@typescript-eslint/parser`, including the two-rule
double report on a namespace import. No selector that measured MATCH came back clean.

**Q6 is closed affirmatively.** The non-literal dynamic import of `eslint.config.mjs` works
under both `vitest` and `typecheck` on the first attempt, so the drift guard reads the REAL
evaluated array rather than matching source text. The disk-read fallback was needed only on
the vitest side, per Q7, which was not retested.

**M4 in three variants, each failing exactly one assertion.** The third -- narrowing BOTH
globs to `{ts,mts}` -- is not in VALIDATION.md's table and is the one that matters: identity
still holds, so only the SUPERSET invariant can catch it. That is what proves the two D-19
invariants are independently load-bearing rather than one thing asserted twice.
`eslint.config.mjs` was restored byte-identical before the commit.

**`npx eslint .` exits 0 with zero findings.** That is the measurement proving all four
disables are USED -- an unused one is an error under `reportUnusedDisableDirectives: 'error'`.

## Post-Merge Fix: A Flaky Timeout in Both New Guards

The post-merge gate caught `lint-scope-drift.spec.ts` intermittently failing under
`nx run-many -t typecheck,test --skip-nx-cache` (exit 0, 1, 0 across three runs; Nx's own
flaky-task detector fired on one hash with two outcomes). Fixed in `e683c92`.

**Root cause, measured rather than reasoned.** The module-level `import()` of
`eslint.config.mjs` pulls in the whole ESLint toolchain -- `@eslint/js`, typescript-eslint's
parser and plugin, the comments plugin. Measured in isolation on an IDLE workstation:

| Cost | Measured |
|---|---|
| bare `import('eslint.config.mjs')` in a cold node | **981 ms** |
| first test in `lint-scope-drift.spec.ts` (pays the resolve) | 731-883 ms |
| every subsequent test in that file | 0-1 ms |
| first test in `lint-rules.spec.ts` (first `lintText` loads config + TS parser) | 592-913 ms |

Against vitest's DEFAULT 5000 ms per-test budget that is ~5.7x headroom on an idle box.
Under CPU contention it is not enough, and because the cost falls on whichever test happens
to run FIRST, the failure location is arbitrary -- which is why it presents as flakiness
rather than as "the import is slow". CI is strictly worse: slower runners, and the four
dogfooded jobs each run a background sidecar alongside the target.

**The fix.** Hoist the one-time cost out of the per-test budget with a `beforeAll(fn, 30_000)`
in each file, not a bigger per-test timeout. `lint-scope-drift.spec.ts` resolves the config
in the hook and stores it, so `banConfigObject()` and all three tests become synchronous;
`lint-rules.spec.ts` gets a discarded warm-up `lintText`. **`testTimeout` in
`vitest.config.mts` was deliberately NOT raised** -- that would mask this class for all 486
tests, which is the opposite of what this phase is for.

`banConfigObject()`'s "exactly ONE object configures `no-restricted-syntax`" assertion stayed
in the assertion layer and did NOT move into the hook, so it still fails the suite. It also
became strictly harder to fool: `flatConfig` initialises to `[]`, so a hook that never ran
now fails that length assertion instead of passing on nothing.

**Proof, by controlled experiment rather than by repeat-running until green.** Three green
runs is what the BROKEN version already produced, so repeat runs alone prove nothing. The
decisive measurement pins the per-test budget just above the observed cost:

| Version | `--testTimeout=500` | `--testTimeout=50` |
|---|---|---|
| pre-fix | **2 failed** / 40 passed -- `Test timed out in 500ms` on `configures the ban in ONE object...` (the exact reported failure) AND on `lint-rules.spec.ts`'s first test | not run |
| post-fix | 42 passed | **42 passed** |

The post-fix suites pass at a budget **100x tighter** than the default, at the point where
the pre-fix version already failed. First-test duration went 731/883 ms -> 2/3 ms; headroom
against the real 5000 ms budget went from ~5.7x to >2500x. That is structural, not
statistical: no amount of contention times out a 2 ms test whose expensive dependency
resolved in a 30 s hook.

The pre-fix run also reproduced the timeout in `lint-rules.spec.ts`, which had NOT failed in
the gate's three runs. Giving that file the same hook was therefore closing a measured
exposure, not a speculative one.

Repeat evidence on the final state: `npm exec -- nx run-many -t typecheck,test
--skip-nx-cache` run **8 times, exit 0 every time** (`0 0 0 0 0 0 0 0`), zero `Test timed
out` across all eight logs. M4b was re-run against the refactored guard and still fails on
exactly the right assertion, so the hoist did not cost the guard its teeth.

## Deviations from Plan

### Discretionary Calls

**1. P7 was INCLUDED.** RESEARCH recommends it and leaves the call to the planner. Including
it means `globalThis.process.platform` is caught rather than accepted, so D-21 needs no
ceiling comment for it. Two ceilings ARE recorded in the three-part `with-hash-lock.ts:1-3`
form: P4/P5's hardcoded namespace binding names (upgrade path: drop the `object.name`
constraint IN FAVOUR OF an allowlist, never without one), and T-07-12's helper-in-another-
module read (upgrade path: type-aware linting, which D-11 excludes for a stated reason, so
it is accepted rather than scheduled).

**2. The `path.join` false-positive control uses a LOCAL object, not a namespace import.**
RESEARCH's control list writes it as a bare `path.join('a','b')` expression, which is correct
for an esquery run over a standalone snippet but not reproducible under real ESLint, where
`path` must come from somewhere. `import * as path from 'node:path'` IS an error -- the
imports rule reports a namespace specifier whenever the entry lists `importNames` -- so using
it here would have turned a false-positive control into a failing assertion. The namespace
form is asserted as an EVASION shape instead, which is where it belongs, and the local object
isolates exactly what the control is for: P5's property-name list.

**3. `releaseAssetName(hash, 'win32')` was dropped from the control set.** RESEARCH lists it
as one of eight measured controls, but D-18 forbids that form anywhere, and the plan's
critical notes repeat the prohibition. Six controls shipped instead of RESEARCH's eight; the
plan required at least five.

**4. A third M4 variant was added.** See Key Results.

### Corrections Recorded, Not Silently Absorbed

- **ROADMAP SC3 says "three CORR-05 violations".** REQUIREMENTS, CONTEXT and RESEARCH all say
  FOUR, and FOUR is what shipped. Not scope creep.
- **CONTEXT D-22 and REQUIREMENTS CORR-05 both list `cache-archive-path.spec.ts:26` beside
  `:1`.** Correct as a SITE -- both lines leave together under VER-02 in Phase 9 -- and wrong
  as an error POSITION. Verified against the live rule set: the bare `tmpdir()` call produces
  zero ban errors, because in strict ESM that binding cannot exist without the import and the
  import is the chokepoint. A fifth directive there would have been an UNUSED directive and
  would have failed the build through the phase's own opt-out discipline. Both corrections are
  comment-locked on `CORR_05_SITES` so the next reader does not re-derive them.

### Requirement Checkboxes

The frontmatter lists `[LINT-02, LINT-03, LINT-05, LINT-06, CORR-06]`. **Three were ticked,
two deliberately were not.**

**LINT-02 and LINT-03 are unambiguously closed.** Every clause of both requirement texts is
implemented and asserted -- the two rules, the full three-extension scope pair, the drift
spec, the evasion fixture, and all four sites confirmed CAUGHT while they still exist.

**LINT-05 and LINT-06 are NOT ticked.** Their rules were configured in 07-01 and their four
described disables land here, but 07-04 still owes the recorded M8/M9 mutation evidence that
both are live rather than merely configured. 07-04's frontmatter carries them.

**CORR-06 IS ticked, with one nuance the verifier should hold.** Its text says "a guard fails
the `test` target when a non-integration spec reads AMBIENT platform state", and read
literally that is only half-true today: a NEWLY written violation in some other spec fails
`lint`, which does not exist until 07-03. What fails `test` today is the guard-integrity
half -- D-25 wired `{workspaceRoot}/eslint.config.mjs` into `targetDefaults.test.inputs`, so
a rule change re-runs `test` and `lint-rules.spec.ts` goes red if the ban stops firing. The
tick was taken anyway on two grounds: the requirement's own closing line delegates
enforcement to "the lint rules in LINT-02", which are complete; and CORR-06 appears in NO
later plan's frontmatter, so leaving it would orphan it against a phase-level traceability
row that 07-03 will satisfy regardless.

`requirements mark-complete` inserts a spurious blank line before nearly every OTHER bullet
in the file as a side effect (the same cosmetic corruption 07-01 recorded). The mechanical
run was reverted and the six intended edits -- three checkboxes, three traceability rows --
reapplied exactly. `git diff` over `REQUIREMENTS.md` is 6 insertions and 6 deletions, nothing
else.

## Prohibitions Verified

**No CORR-05 violating expression was deleted, moved, or rewritten.** `git show --numstat` on
the task-1 commit reports `1 0`, `6 0` and `2 0` for the three violation-site files -- pure
additions, zero deletions, and every added line is a comment. Phases 9 and 10 own the
removals; removing one early would destroy LINT-03's evidence.

Both D-06 halves clean at both commits: `git diff --exit-code` returns zero for
`packages/github-cache/package.json` and for
`packages/github-cache/src/public-surface.spec.ts`.

## For the Verifier

**Four `eslint-disable-next-line` DIRECTIVES exist, across three files** (1 + 1 + 2). Note
that a naive `git grep -c "eslint-disable-next-line" -- packages/github-cache/src` also
returns 7 hits in `lint-rules.spec.ts`; every one of those is a fixture STRING, a test name,
or a matcher argument, none is a comment token, and `npx eslint .` at exit 0 confirms none is
a live directive. The acceptance criterion's literal grep count was already unreachable in
07-01 for the same reason.

**The `lint` target still does not exist.** The battery is eight commands at both of this
plan's commits and becomes nine in 07-03. `npx eslint .` was run directly instead, from
`packages/github-cache`, and exits 0.

## Battery at Both Commits

Eight commands, all exit 0: `format:check`, `build`, `typecheck`, `typecheck:action`, `test`,
`fallow:ci`, `check:action`, `pack:check`. Plus `npx eslint .` at exit 0.

Unit suite: **486 tests across 33 files**, up from 453. The +33 are 28 in `lint-rules.spec.ts`
and 5 in the new `lint-scope-drift.spec.ts`. Measured with `--skip-nx-cache`, not a cached
replay.

## Self-Check: PASSED
