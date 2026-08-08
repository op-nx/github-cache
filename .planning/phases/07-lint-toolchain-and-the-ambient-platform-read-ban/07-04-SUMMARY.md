---
phase: 07
plan: 04
subsystem: lint-toolchain
tags:
  [
    evidence,
    differential,
    mutation-testing,
    stale-cache,
    nx-hash,
    hand-off,
    lint,
  ]
status: complete
requires:
  - the inferred lint target and the root lint script (plan 07-03)
  - nx.json targetDefaults.lint and targetDefaults.test.inputs (plans 07-01, 07-03)
  - eslint.config.mjs with both ban rules and the four described disables (plans 07-01, 07-02)
  - the three guard specs -- lint-rules, lint-scope-drift, nx-target-inputs
provides:
  - LINT-04 closed BY DIFFERENTIAL with both negative controls and the cache line on both sides of every pair
  - proof that the declared lint input block is load-bearing, via a reproduced stale-cache HIT
  - proof the D-25 second-order test hole is closed, measured BEFORE any mutation was trusted
  - the M1-M9 mutation record with OBSERVED failure sets and a per-row match verdict
  - the D-35 hashed-node baseline re-verified as the Phase 8 CORR-03 input
  - the D-36 all-MISS pre-record that authors Phase 9's OBS-04 tripwire condition
  - the consolidated D-12 call, D-07 deviation, D-01 dismissal and the four wording corrections
  - LINT-05 and LINT-06 ticked against the measurements that make their text true
affects:
  - Phase 8 CORR-03 (compares its two-leg lint measurement against the D-35 baseline)
  - Phase 9 OBS-04 (its tripwire is authored from the D-36 pre-record)
  - .planning/REQUIREMENTS.md (LINT-05, LINT-06)
tech-stack:
  added: []
  patterns:
    - a differential's perturbed side must be run exactly ONCE; a repeat with the same edit text caches the perturbed hash and reads as the defect
    - a Cache line is a statement about a HASH, never about correctness -- only the BEFORE/AFTER pair carries proof
    - mutation-test the guard AND record the observed failure set, because a mutation that goes red on the wrong assertions is as informative as one that stays green
key-files:
  created:
    - .planning/phases/07-lint-toolchain-and-the-ambient-platform-read-ban/07-04-SUMMARY.md
  modified:
    - .planning/phases/07-lint-toolchain-and-the-ambient-platform-read-ban/07-EVIDENCE.md
    - .planning/REQUIREMENTS.md
decisions:
  - "The confounded first attempt at Measurement B was recorded rather than quietly discarded: running the perturbed side twice caches the perturbed hash, so a later repeat of the same edit reads Cache 1/1 -- indistinguishable at a glance from the LINT-04 defect the measurement exists to exclude."
  - "All nine mutations were re-run first-hand, including the five earlier waves had already measured, so the table is one executor's direct observation rather than a stitched-together citation."
  - "M3 went RED, so P6 is covered -- but its granularity diverges from VALIDATION.md: the shipped spec folds both dynamic-import shapes into ONE it() row, so the observed count is 1 failing assertion and not 2."
  - "M1 and M2 produce DISJOINT red sets. That is the measured form of D-15's claim that neither ban rule is sufficient alone."
  - "requirements.mark-complete was skipped and REQUIREMENTS.md edited by hand, because the tool corrupted that file in both prior waves of this phase."
metrics:
  duration: ~55 min
  tasks: 3
  files: 2
  tests: 494 (unchanged -- this plan adds no assertion)
  completed: 2026-07-27
---

# Phase 7 Plan 04: Evidence Summary

LINT-04 is closed by MEASUREMENT rather than by reading the config, every guard this phase ships
has been shown to fail for the right reason and then restored, and Phases 8 and 9 have the two
records they could not reconstruct later.

## What Shipped

Three commits, each modifying exactly the evidence file (the third also ticks two requirements).
**No source, config, workflow or spec file is modified by this plan.** Every perturbation was
applied, observed and reverted, with a `git diff --exit-code` confirmation before the next one.

| Commit | Content |
| ------ | ------- |
| `9ea224f` | G5 measurements A, B and C plus both negative controls |
| `be895a6` | the M1-M9 table with observed failure sets |
| `8300b58` | the D-35 / D-36 hand-offs, the consolidated phase record, LINT-05 and LINT-06 ticked |

## LINT-04, Closed By Differential

Base SHA `81048ca` for every reading. Q8 closed affirmatively: `nx run-many -t lint` prints
`Cache: n/m hit (p%)` in exactly the form `test` and `typecheck` do, so the verbose fallback
RESEARCH held in reserve was never substituted.

| Measurement | Baseline | Perturbed | Restored |
| ----------- | -------- | --------- | -------- |
| **A** rule edit re-runs `lint` | `1/1 hit (100%)` | **`0/1 hit (0%)`** | `1/1 hit (100%)` |
| **B** source edit re-runs `lint` | `1/1 hit (100%)` | **`0/1 hit (0%)`** | `1/1 hit (100%)` |
| **C** rule edit re-runs `test` (D-25) | `1/1 hit (100%)` | **`0/1 hit (0%)`** | n/a |
| **NC1** same rule edit, config entry REMOVED from `lint.inputs` | `1/1 hit (100%)` | **`1/1 hit (100%)`** -- THE BUG | n/a |
| **NC2** linted-file count across `rm -rf dist out-tsc` | **66** | **66** -- identical | n/a |

Measurement C was run **before** any mutation result was trusted, which is the ordering D-25
requires: every M1-M9 verdict below is read off a `test` target proven to re-run when the rule
set moves.

**Negative control 1 is the one that matters, and the record says so explicitly.** A and B both
pass on a `lint` target with no declared input block at all, because `@nx/eslint`'s inferred
inputs already contain `default` and the workspace-root config entry. A and B alone would NOT
have proven D-24's block did anything. Deleting one entry and watching a real rule change serve a
cached PASS is what does.

### The methodological trap, recorded because it manufactures a false defect

The first attempt at Measurement B was CONFOUNDED and discarded. The perturbed side was run
TWICE; the second run legitimately replayed the *perturbed* hash, so re-applying that identical
edit later read `Cache: 1/1 hit (100%)` -- indistinguishable, at a glance, from exactly the
stale-cache bug the measurement exists to exclude. The rule this yields: **a differential's
perturbed side must be run exactly ONCE, and any repeat needs perturbation text that has never
been hashed.** Same class as PITFALLS D1 -- a `Cache:` reading is a statement about a HASH, not
about correctness.

## M1-M9: Every Guard Can Fail

All nine re-run first-hand against the plan 07-03 tree, including the five earlier waves had
already measured, so the table is one executor's direct observation. Baseline across the three
guard specs before any mutation: 56 passed of 56. **All nine MATCHED their expectation.**

| # | Observed | Verdict |
| - | -------- | ------- |
| M1 | 4 failed / 33 passed -- the P1 evasion row plus the `is CAUGHT` assertion at all three syntax sites; every import-shape assertion GREEN | match |
| M2 | 3 failed / 34 passed -- named-import and namespace-import evasion rows plus site 1; every `process.*` assertion GREEN | match |
| M3 | 1 failed / 36 passed -- the dynamic-import row, `expected [] to deeply equal [ 'no-restricted-syntax', 'no-restricted-syntax' ]` | match, with a granularity divergence |
| M4 | 1 failed / 4 passed -- caught by the parser's OWN non-vacuity guard before the comparison ran | match |
| M5 | 1 failed / 13 passed -- the `test` input assertion, zero collateral | match |
| M6 | 1 failed / 13 passed on the assertion half; `1/1 hit` on the behavioural half | match, both halves |
| M7 | **66 -> 159** linted files | match |
| M8 | 1 error: `require-description` at severity 2 | match -- LINT-05 is LIVE |
| M9 | 2 errors: the unsuppressed ban AND a severity-2 unused-directive report | match -- LINT-06 is LIVE |

### M3 is not a silent gap, but VALIDATION.md's count is off by one

The plan flagged M3 as the mutation most likely to pass vacuously, which would mean P6 was
untested and D-21's dynamic-import shape a silent hole. **It went red**, so P6 is genuinely
load-bearing and genuinely covered.

The divergence, recorded because it is a real difference: VALIDATION.md predicts "ONLY the two
dynamic-import assertions RED". The shipped spec folds BOTH dynamic shapes into a SINGLE `it()`
row whose expected value is a two-element list, so the observed count is **one** failing
assertion covering two shapes. Coverage is identical; the granularity is not. A reader checking
"2 red" against the table would otherwise conclude the mutation had under-fired.

### M1 and M2 produce disjoint red sets

M1 leaves every import-shape assertion GREEN; M2 leaves every `process.*` assertion GREEN. That
is the measured form of D-15's claim that neither rule is sufficient alone -- two mutations, two
disjoint red sets, no overlap. The guard is not asserting one thing twice.

## The Two Hand-Offs

**D-35, Phase 8's CORR-03 baseline.** Present and complete from plan 07-03; re-read at this plan
and byte-for-byte unchanged. All six hashed fields recorded including the resolved `options.cwd`,
with `metadata` explicitly named as NOT hashed so a future reader does not re-derive whether its
package-manager-exec token matters. **The record states in as many words that whether `@nx/eslint`
infers the same node on Linux is UNVERIFIED BY DESIGN and is transferred to Phase 8, not reasoned
closed here.** The risk is live: the plugin's existence gate genuinely runs for this layout,
because the config directory differs from the project root, and that gate joins a POSIX-style
path onto an absolute Windows root.

**D-36, the legitimate all-MISS push.** Written down in advance and NOT as a gate. Three
legitimate rotation windows exist in this milestone -- Phase 7's plugin registration, Phase 8's
parity fix, Phase 9's VER-01 -- so Phase 9's OBS-04 tripwire must read *"two consecutive all-miss
pushes with NO version-affecting change in between"*. A tripwire that fires on correct work gets
disabled. The record also carries what a rotation does NOT prove: a hash difference is
attributable to the OS only once graph freshness is controlled on both sides, and every prior
cross-OS measurement in this repo read a confounded variable.

## The Consolidated Phase Record

`07-EVIDENCE.md` now also carries, in one place a verifier will find:

- **the D-12 call** with a predicted-vs-measured table -- ZERO rules turned off repo-wide, ZERO
  code edits to satisfy a linter, TWO configuration blocks, both named, with the one scoped
  rule-off recorded honestly rather than claimed as zero;
- **the D-07 deviation** -- `lint` is project-scoped, so the four root-level files are not linted.
  This narrows LINT-01 SC1's literal "across the workspace" to "across the project that has
  specs" and is INTENTIONAL and RECORDED, not a gap: all 32 spec files and all four CORR-05 sites
  are inside the scope;
- **the D-01 one-line dismissal** of the explicit-target alternative, which REQUIREMENTS and
  research both demand appear in the phase record;
- **four received-wording corrections** that must not propagate -- ROADMAP SC3's "three CORR-05
  violations" against the four everything else says; CORR-06's example using the two-argument
  asset-name form CORR-02 deletes in Phase 10; LINT-05's legacy bare comments-plugin prefix; and
  `cache-archive-path.spec.ts:26` being a valid SITE but not an error POSITION;
- **the stale codebase-map note** -- `CONVENTIONS.md:316` still says this repo has no ESLint
  configured. Regenerating the map is a deferred idea, so the verifier should read that sentence
  as a dated artefact rather than a contradiction.

## Requirement Ticks

LINT-05 and LINT-06 ticked, each against the measurement that makes its text true (M8 and M9).
Plans 07-01 and 07-02 left both unticked on purpose rather than write a falsehood into the ledger
the milestone audit reads -- at the time both were configured but their liveness was unproven,
and the proof was this plan's work. LINT-01, LINT-02, LINT-03 and LINT-04 were already ticked by
earlier plans; LINT-04's tick is now backed by the differential rather than by the declaration
probes alone.

## Deviations from Plan

**None on substance.** Three judgement calls inside the plan's own acceptance criteria:

1. **[Rule 2 - missing verification] All nine mutations were re-run rather than five cited.** The
   plan permits cross-referencing M6 and treats M4, M5, M7 and the wave-2/3 records as already
   measured. Re-running each takes seconds and turns a citation chain into one executor's direct
   observation, which is what D-23 is actually for. M7 in particular had to be re-run because its
   absolute counts moved with the tree (64/155 in wave 1, 66/159 now).
2. **[Rule 3 - blocking] Measurement B was re-run with novel perturbation text** after the first
   attempt cached the perturbed hash and produced a false HIT. Recorded as a finding rather than
   silently redone, because the false reading is indistinguishable from the LINT-04 defect.
3. **[Rule 1 - avoid a known bug] `requirements.mark-complete` was skipped** and `REQUIREMENTS.md`
   hand-edited, because the tool corrupted that same file in both prior waves of this phase. The
   diff is exactly four lines -- two checkbox flips and two traceability rows -- and was inspected
   line by line.

The optional tidy the brief offered (three no-op `await` expressions in `lint-scope-drift.spec.ts`)
was NOT taken. It is not adjacent to any file this plan touches, and this plan's whole contract is
that no source file is modified.

## Battery

All NINE commands exit 0 at all three commits: `format:check`, `build`, `typecheck`,
`typecheck:action`, `test`, `lint`, `fallow:ci`, `check:action`, `pack:check`. Unit suite
**494 tests across 33 files**, unchanged -- this plan adds no assertion, only recorded
measurement. Post-restore `npx eslint .` from `packages/github-cache`: 66 files linted, 0
findings, exit 0.

`git diff` against the plan 07-03 tree (`81048ca`) touches only
`.planning/phases/07-lint-toolchain-and-the-ambient-platform-read-ban/07-EVIDENCE.md` and
`.planning/REQUIREMENTS.md`. No mutation residue reached any commit.

## What This Leaves Open

- **T-07-17 / D-35 (transferred, not closed).** OS-divergent `lint` inference. Phase 8 CORR-03.
- **`lint-scope-drift.spec.ts`'s three no-op `await` expressions.** Harmless; not taken.
- **`.planning/codebase/CONVENTIONS.md` regeneration.** Deferred idea.
- **The `lint` sidecar dogfood block** (D-33). Purely additive, deferred by decision.

## Known Stubs

None. This plan produces recorded measurement only.

## Threat Flags

None. No network endpoint, auth path, file-access pattern or trust-boundary schema change: this
plan modifies two planning documents and nothing else.

## Self-Check: PASSED

`07-EVIDENCE.md` and `07-04-SUMMARY.md` both exist on disk; `07-EVIDENCE.md` carries the
`## Plan 07-04` heading, the five-row differential set, the nine-row mutation table and the
hand-off sections. All three commit hashes (`9ea224f`, `be895a6`, `8300b58`) resolve in
`git log`.
