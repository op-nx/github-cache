---
phase: quick-260810-kuo
verified: 2026-08-10T16:10:00Z
status: human_needed
score: 6/7 must-haves verified
behavior_unverified: 1
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 6/7
  range_added: "b6580ad..1b06816 (5 review-fix commits; full range 4518787..HEAD, 22 commits)"
  gaps_closed:
    - "A12's guard weakening -- reversed by CR-01, independently falsified three ways"
    - "The SUMMARY's unreproducible 'pre-existing contention flake' framing -- rewritten to what is evidenced, with no maintainer action implied"
    - "The two dangling pre-reword commit SHAs in the SUMMARY commit table"
    - "The overstated '17 bisect-safe commits' claim -- downgraded to the measured spot check"
    - "The orphaned docstring at cache-key.spec.ts:88 flagged in the first pass"
  gaps_remaining: []
  regressions: []
behavior_unverified_items:
  - truth: "Every commit leaves all six gates green, so the sequence is bisect-safe."
    test: "Run the gate battery at each of the 22 commits, not only at HEAD."
    expected: "Every commit green on the gates that apply to the files it touches."
    why_human: >-
      Ten of twenty-two commits are now spot-checked green on the `test` gate in a detached
      worktree -- the five highest-risk original commits (de95090, 5968d51, e4f7f71,
      ffb7f96, 31bb47b) and all five review-fix commits (af53734, 9709a2b, fd8fa7a, c02f0d6,
      1b06816). The other twelve commits, and the remaining five gates at per-commit
      granularity, were not exercised. SUMMARY.md now states this limit accurately rather
      than claiming bisect safety outright.
human_verification:
  - test: >-
      Run the gate battery at the twelve commits not spot-checked, or accept the ten-point
      spot check as sufficient evidence of bisect safety.
    expected: "Every commit in 4518787..HEAD green on all applicable gates."
    why_human: >-
      Full per-commit verification is 22 checkouts x 6 gates, and even 22 `test` runs would
      not discharge a six-gate claim. Whether the ten-point spot check -- which covers every
      commit that altered an assertion in the review-fix pass -- discharges it is a
      maintainer judgement about cost.
  - test: >-
      Reconcile SUMMARY.md's frontmatter metrics with HEAD, and fix three small stale
      references (listed in the Re-Verification section below).
    expected: >-
      `metrics.commits: 17` and `metrics.test_count: 1177` describe the pre-fix state; HEAD
      is 22 commits and 1184 tests. The body reconciles both; the frontmatter does not.
    why_human: >-
      Editing SUMMARY.md is the executor's or orchestrator's call, not the verifier's. None
      of these affects the code, but a machine reading the frontmatter gets the pre-fix
      numbers.
---

# Quick Task 260810-kuo: Apply the 15 triaged survivors of the /simplify review of PR #16 -- Verification Report

**Task goal:** Apply exactly the 15 triaged survivors (A1..A15) of the `/simplify` multi-agent
cleanup review of PR #16, with no guard weakened and no forbidden edit.
**Range verified:** `4518787..b6580ad`, 17 commits, branch
`gsd/v0.0.2-os-invariant-cross-os-sharing`, main tree.
**Verified:** 2026-08-10
**Status:** human_needed
**Re-verification:** No -- initial verification.

> **SUPERSEDED IN PART.** A code review after this pass found that A12 WEAKENED a guard, which this
> report did not catch. Five review-fix commits landed. The re-verification of that delta is appended
> at the end of this file, dated and separate; the original text below is left as the true record of
> what was measured at `b6580ad`. Read both.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | All 15 items A1..A15 applied, or explicitly recorded as dropped with a measured reason | VERIFIED | Each item located in the diff and read in the code. Table below. Nothing dropped. |
| 2 | No guard weakened; every guard that reddens is closed by changing the CODE | VERIFIED | Every removed assertion in the range accounted for (14 removed lines, all replacements or same-assertion rewrites). The one reddened guard was closed in `cache-key.spec.ts` by changing the reader, not the assertion. |
| 3 | A3+A4 produce a record with build/typecheck/integration/lint byte-identical and `test` ROTATED | VERIFIED | Proof script re-run by the verifier: all four identical, `test` rotated, exit 0. Falsified three ways (exit 1 each). Record provenance checked: BEFORE at `4518787`, AFTER at `c9d6299` (pre-amend C2), tree delta between them is `capture-hashes.mjs` only. |
| 4 | A8's two derived needles are byte-identical to today's two literals | VERIFIED | `INVARIANT_TARGETS = ['build','typecheck','test','lint']`; joins produce `build, typecheck, test, lint` and `build typecheck test lint`, matching the two lines in the untouched detector workflow exactly. |
| 5 | A7 and A15 end with strictly more diagnostic power than they started with | VERIFIED | A7: a flat count of 3 replaced by `targetDefaults` key-set equality plus per-target `toEqual([command])`, so a red names the target. A15: 5 `it`s -> `it.each` with the row in the title, plus two newly written reason strings on rows that had none. |
| 6 | Every commit leaves all six gates green, so the sequence is bisect-safe | PRESENT_BEHAVIOR_UNVERIFIED | 5 of 17 commits spot-checked green on `test` in a detached worktree; per-commit file grouping is coherent (one item per commit, coupled edits landing together). The other 12 commits were not run. |
| 7 | `nx.json` is byte-unchanged | VERIFIED | Blob `580d962a165f952fa8d49c24c62c52547737d807` at both `4518787` and HEAD; `git diff --exit-code` over the range silent. |

**Score:** 6/7 truths verified (1 present, behavior-unverified)

> **CORRECTION, from the re-verification below.** Truth 2 as recorded here was WRONG at `b6580ad`.
> A12 deleted an assertion on a false subsumption argument; nothing in the eight-gate battery
> distinguished an IMPORTED `collapseToOneLine` from a locally RE-AUTHORED one. This pass audited the
> removed assertions and accepted A12's subsumption reasoning instead of testing it. The code review
> caught it; `af53734` reversed it; the re-verification proves the restored guard red under two
> mutations and green under a reflow.

### The 15 Items, Walked Individually

| Item | Where | Status | Evidence |
|------|-------|--------|----------|
| A1 | `test/repo-file.ts` | APPLIED | `REPO_FILE_CACHE` module-scope Map, successful reads only, throw preserved; two controls added in the same commit. |
| A2 | `dogfood-cross-os.spec.ts` | APPLIED | `JOB_BLOCK_CACHE` memo, successful lookups only, interpolated RegExp hoisted out of the `findIndex` callback, throw control added. |
| A3 | `capture-hashes.mjs` | APPLIED | Zero static `nx/src/...` imports remain; eight `await import()` sites across the four consumers; `measureGraphState` async; `resolvedTaskIds` takes `createTaskGraph` as a third parameter and stays sync. |
| A4 | `capture-hashes.mjs` | APPLIED | `createTaskHasher` constructed once above `for (const target of TARGETS)`; the in-loop construction is gone. |
| A5 | 3 specs + exception list | APPLIED | All three `new URL('../...')` walks routed through `readRepoFile`/`repoFileUrl`; `WORKSPACE_ROOT_WALK_EXCEPTIONS` shrunk 6 -> 3 in the same commit; derived set equality and non-vacuity clause both green. |
| A6 | `test/repo-file.ts` + 3 callers | APPLIED | `packageSourceFiles(predicate)` and `PACKAGE_SOURCE_ROOT` exported; all three callers route through it; `packageModules()` retained as a one-line wrapper; the stale cwd-constraint docstring corrected. |
| A7 | `docs-cross-os.spec.ts` | APPLIED (strengthening) | Fence parsed; key set asserted by equality; per-target `toEqual([command])`; `SNIPPET_DISCRIMINATOR_SITES` deleted from the code; one-JSON-fence control kept; the existing `runtimeInputsOf` reused, no second extractor. |
| A8 | `windows-regression-detector.spec.ts` | APPLIED (strengthening) | Both needles built from `INVARIANT_TARGETS`; metacharacter claim relocated onto the constant; workflow file untouched. |
| A9 | `roundtrip/read-back.ts` | APPLIED (halved as planned) | Both sites call `mirroredByLabel(readerOs)`; `MIRRORED_BY_PREFIX` export retained because `read-back.spec.ts:360` pins its value. |
| A10 | `test/repo-file.ts` + 2 specs | APPLIED | One `probeTokenOf` exported; both local copies deleted; both non-vacuity controls survive at the call sites; the superset's extra `\b` strip is a no-op on the second caller's needles (verified: neither contains a word boundary). |
| A11a | `docs-same-os-claims.spec.ts` | APPLIED | `read` alias deleted, 5 call sites renamed, 3 prose references updated including the load-bearing throw description. |
| A11b | `read-back.spec.ts` | APPLIED | `mirroredBy` alias deleted, 8 call sites renamed. |
| A12 | `hash-parity/compare.spec.ts` | APPLIED -- **and subsequently corrected**, see the re-verification | Import-shape `toContain` deleted; the call assertion survived carrying a subsumption message. That message was false; `af53734` restored the invariant as a pattern. |
| A13 | `read-integration-hash.integration.spec.ts` | APPLIED | Two-line lazy memo (`acceptedResult ??= read(ACCEPTED)`), not a describe-scope const; both sites use it. |
| A14 | `eslint.config.mjs` | APPLIED | Six entries produced by a flatMap over three pairs, emitting `node:X` then `X` in the original order with the same `importNames` and `message`. |
| A15 | `nx-target-inputs.spec.ts` | APPLIED | One `it.each` with a five-row, three-column table; title interpolates `$entry` and `$target`; every explanatory block sits above its own row; the decision comment rewritten. |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/github-cache/src/test/repo-file.ts` | exports `packageSourceFiles`, `PACKAGE_SOURCE_ROOT`, `probeTokenOf`; memoizes `readRepoFile` | VERIFIED | All three exports present and consumed by 5 spec files; memo is success-only with the throw preserved and pinned. |
| `260810-kuo-deferred-items.md` | U1..U9, each with evidence, fix shape, deferral reason | VERIFIED | 9 unique `## U<N>` headings, 9 `Deferred because` paragraphs. U3 and U5 carry full reasoning (PROJECT.md:146 authority; the measured one-copy-only drift at `releases-backend.ts:227`). Cross-references the bxj record as a sibling lane and states its seven items still stand; does not append to it. |
| A3/A4 machine-checkable proof | exits non-zero on failure, sits in task 2's automated gate | VERIFIED | Present at the literal scratchpad path the plan names, and in the task-2 `<automated>` chain. Verifier re-ran it (exit 0 on the real records) and falsified it three ways: rotated `build` hash, un-rotated `test` hash, tampered `projectConfiguration` -- exit 1 each. A missing script path also exits 1, so the "silent success with the proof never executed" hole is closed. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `repo-file.spec.ts` derived set equality | A5's three rewrites | edited in one commit | WIRED | `de95090` touches all four coupled files together. |
| `repo-file.spec.ts` non-vacuity clause | `packageSourceFiles` | via the retained `packageModules()` wrapper | WIRED | Covered transitively, no clause re-pointed, list length 3 > 0. |
| `compare.spec.ts` `const TARGETS` scrape | `capture-hashes.mjs` | single-line regex extraction | WIRED | Declaration still on one line, byte-identical to baseline; the scrape's clauses are green. |
| `windows-regression-detector.spec.ts` needles | the detector workflow | byte-identical joins | WIRED | Workflow byte-unchanged; both needles match the written lines. |

### Gate Battery at `b6580ad` (uncached, verifier-run)

| Gate | Result |
|------|--------|
| `nx run-many -t build typecheck test integration lint --skip-nx-cache` | exit 0 |
| `test` | 1177 passed (1177), 44 files |
| `integration` | 15 passed (15), 3 files |
| `format:check` | exit 0 |
| `check:action` | exit 0, no bundle drift |
| `fallow:ci` | exit 0, 66 entry points, 0 issues |

### Test Count: 1174 -> 1177, and the identity of the +3

Confirmed two independent ways.

Structurally: the range adds exactly three `it` registrations and one `it.each`, and removes exactly
five `it`s -- the five the `it.each` replaces with five rows. Net +3.

Behaviourally, from the worktree spot check, the count progression is exactly the claimed one:

| Commit | Item | Tests |
|--------|------|-------|
| `de95090` | C3 / A5 | 1174 |
| `5968d51` | C4 / A6 | 1174 |
| `e4f7f71` | C6 / A1 | 1176 (+2: the two `readRepoFile` controls) |
| `ffb7f96` | C8 / A7 | 1177 (+1: the `jobBlock` control added in C7) |
| `31bb47b` | C15 / A14 | 1177 |
| `b6580ad` | -- | 1177 |

The three added clauses are `expect(() => readRepoFile('no-such-file.txt')).toThrow()`,
`expect(readRepoFile('nx.json')).toBe(readRepoFile('nx.json'))` and
`expect(() => jobBlock('no-such-job')).toThrow()` -- the positive controls for the two memos, exactly
as claimed. `nx-target-inputs.spec.ts` stands at 30 tests, so A15 is net zero. File count 44,
unchanged.

### The Flake Attribution -- Not Reproducible

The SUMMARY reported `test` failing CONSISTENTLY with `Hook timed out in 10000ms` at
`lint-scope-drift.spec.ts:151`, attributed to pre-existing CPU contention rather than to A14's
`eslint.config.mjs` edit.

**It did not reproduce.** Eleven independent test runs during verification, all green:

| Runs | How | Result |
|------|-----|--------|
| 1 | uncached `nx run-many` battery, default parallelism | 1177/1177, exit 0 |
| 5 | uncached `nx run-many -t test`, default parallelism, each output captured to its own log before the next run | 1177/1177, exit 0, five times |
| 5 | direct vitest at five mid-sequence commits in a detached worktree | exit 0, five times |

The machine carried 29 live `node.exe` processes before and after the five-run probe -- the same
lingering-process condition the SUMMARY names as the contributing cause -- and the suite still passed
every time.

**What this settles and what it does not.** The attribution CONCLUSION is independently corroborated,
by a stronger method than the executor used: A14 is present in the tree for all eleven runs, and a
change that caused a consistent failure could not produce eleven greens. What is NOT verifiable after
the fact is the PREMISE -- that the suite was failing consistently at all. That was a session-local
event on a machine state that no longer exists. Routed to human decision rather than recorded as a
gap: there is nothing broken to fix, only a SUMMARY section describing a condition a reader will not
be able to observe. **The review-fix pass rewrote that section; see the re-verification.**

`lint-scope-drift.spec.ts`'s own comment forbids the `testTimeout` remedy in terms ("Deliberately NOT
fixed by raising `testTimeout` in `vitest.config.mts`: that would mask this whole class for every
test in the repo"), and no such change was made -- `vitest.config.mts` is not in the range.

### Guard Audit -- Nothing Weakened

> **This section's conclusion was wrong.** See the re-verification: the A12 row below reads "NEUTRAL,
> diagnostic text preserved" on the strength of the subsumption argument written into the commit
> message, and that argument is false. The rest of the table stands.

Fourteen assertion lines were removed across the range. Every one is accounted for:

| Removed | Replacement | Net |
|---------|-------------|-----|
| `.toBe(SNIPPET_DISCRIMINATOR_SITES)` | key-set equality + per-target `toEqual([command])` | STRONGER |
| the multi-line import literal | deleted; the sibling call assertion argued to be subsumed by `typecheck` | claimed NEUTRAL -- **FALSE, see re-verification** |
| 5 x `nx-target-inputs` `toContain` | 5 `it.each` rows asserting the same thing, plus 2 new reason strings | STRONGER |
| `read(ACCEPTED).stdout` | `acceptedRun().stdout` | SAME |
| 2 x `mirroredBy(...)` | `mirroredByLabel(...)` | SAME |
| `toMatch(/nx run-many -t build typecheck test lint --skip-nx-cache/)` | derived `new RegExp`, byte-identical | SAME, plus a new failure mode on a widened constant |

**The one reddened guard.** `cache-key.spec.ts`'s orphaned `SOURCE_ROOT_URL` reader was closed by
changing the CODE: the read at what is now `:167` routes through the shared layer, so the file no
longer computes any root of its own. The assertion and its allowlist are untouched -- confirmed by
the diff, which contains no change to either.

### Forbidden Edits -- Confirmed Absent

| Invariant | Result |
|-----------|--------|
| `nx.json` byte-unchanged | blob identical at both ends; `git diff --exit-code` silent |
| `.github/workflows/ci.yml` byte-unchanged | silent |
| Detector workflow byte-unchanged | silent |
| Any `.github/` file changed | none; `git diff --stat` over `.github/` is empty |
| `260810-bxj` deferred record untouched | silent, range-scoped |
| `lib/compression-method.ts` (VER-05) | present |
| Construction-time `mkdirSync` (VER-08) | present, 5 `mkdirSync` sites in `actions-cache-backend.ts` |
| `capture-hashes.mjs` clauses 1-6 | all present; clause 5 and 6 retention blocks intact |
| No U1..U9 implemented | `isLegacyOsSuffixedAssetName` present in 4 modules; Wilson interval present; `SEED_MARKER_WORDS` present at `publish/publish-mirror.ts:234` (`publish-mirror.ts` byte-unchanged in the range); no `lib/github-rest.ts`; no `hash-parity/targets.json`; `.gitignore` unchanged |
| `start-cache-server/index.js` | byte-unchanged, and `check:action` regenerates it with no drift |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `packages/github-cache/src/lib/cache-key.spec.ts` | 88 | Orphaned docstring documenting nothing -- the `SOURCE_ROOT_URL` const it described was deleted in C4 | Warning | Cosmetic. No guard affected. **Fixed by `c02f0d6` in the review-fix pass.** |

No `TBD`, `FIXME`, `XXX`, `TODO`, `HACK` or `PLACEHOLDER` markers in any file the task modified. No
non-ASCII in the added code lines or in any of the 17 commit messages (verified with a positive
control on the scanner).

### SUMMARY.md Accuracy Notes (informational)

Three small drifts at `b6580ad`, all since corrected by the review-fix pass except the third:

1. The commit table listed `65d36e1` (C16) and `703a261` (C17) -- the PRE-REWORD hashes. Both still
   resolve as dangling objects, which is why the self-check passed. **Corrected.**
2. The bisect claim overstated what was measured. **Corrected.**
3. `read-back.spec.ts:363` is cited for the `MIRRORED_BY_PREFIX` value guard; it sits at `:360`.
   **Still open.**

### Requirements Coverage

The PLAN declares `requirements: [A1..A15]`, which are triage-ledger item IDs rather than
`REQUIREMENTS.md` IDs. All 15 are satisfied (table above). The `REQUIREMENTS.md` IDs this task had to
NOT violate -- VER-05, VER-08, DOCS-08 -- are all intact, confirmed in the forbidden-edits table.

### Gaps Summary (as of `b6580ad`)

None recorded at the time. Two items were routed to a human: one documentation decision about a
failure that no longer reproduces, and the cost question on full per-commit gating.

---

_Verified: 2026-08-10_
_Verifier: Claude (gsd-verifier)_

---

# Re-Verification -- 2026-08-10, after the review-fix pass

**Delta verified:** `b6580ad..1b06816`, 5 commits. **Full range now:** `4518787..HEAD`, 22 commits.
**HEAD:** `1b06816`. **Status after this pass:** human_needed. **Score:** 6/7 -- unchanged in shape,
but truth 2 moved from "verified on a false premise" to "verified by falsification".

## What this pass exists to correct

The original report certified truth 2 ("no guard weakened") on the strength of an
assertion-by-assertion audit. That audit accepted A12's subsumption argument from its commit message
instead of testing it. **The argument was false, and this verifier did not catch it.** The code
review did. The miss is recorded here rather than edited out of the section above.

## 1. CR-01 -- the A12 guard regression, reversed and independently falsified

The claim to test is not "a fix landed" but "the restored guard actually discriminates". Three
mutations of `assert-parity.ts`, each applied by the verifier, run, and reverted with
`git checkout --` (0 pending changes on the file after each):

| Mutation | Expected | Measured |
|----------|----------|----------|
| Control -- unmutated tree | green | **46/46, exit 0** |
| `collapseToOneLine` removed from the import and RE-AUTHORED locally | RED | **exit 1**, clause 1 fired: "assert-parity.ts must IMPORT `collapseToOneLine` from `./compare.js`" |
| Import KEPT and the symbol ALSO declared locally (the shadowing variant) | RED | **exit 1**, clause 2 fired: "assert-parity.ts must not DECLARE `collapseToOneLine` itself" |
| Pure REFLOW + REORDER of the import members onto one line | GREEN | **46/46, exit 0** |

Both clauses are independently live; neither is dead weight behind the other.

**The false premise is confirmed false, by measurement.** Under the re-authoring mutation,
`tsc --noEmit -p packages/github-cache/tsconfig.lib.json` exits **0**. So `typecheck` genuinely does
not distinguish an import from a local re-authoring, exactly as the review argued and contrary to
what A12's message asserted.

**A12's legitimate half is preserved, not undone.** The old assertion pinned Prettier's multi-line
layout as a literal (`import {\n  collapseToOneLine,` -- present at `73b6da1`, the commit before A12;
positive control confirms the search finds it there). That literal matches nowhere at HEAD, and the
reflow mutation stays green. The replacement additionally pins the module specifier, which the
literal never did.

**The false sentence is gone.** `THE CALL IS WHAT PINS THE IMPORT` exists at `806165b` (positive
control: 1 hit) and matches nowhere in the repo at HEAD.

## 2. WR-01 -- the A3 gate hole, closed

| Check | Measured |
|-------|----------|
| Six specifiers derived from the instrument's own source, not hand-copied | Yes -- `matchAll` over `readRepoFile('capture-hashes.mjs')` for `const { X } = await import('nx/src/...')`, deduped through a `Map` keyed on the specifier (two specifiers appear at two sites each; 8 sites -> 6 unique) |
| A length control precedes the rows, so the `it.each` cannot pass by iterating zero | Yes -- `toHaveLength(6)`, which also reddens if the instrument gains or drops a deferred import, or changes the destructure shape |
| The gate reddens on a MOVED specifier | **Yes.** Pointing `nx/src/hasher/create-task-hasher.js` at `...-moved.js`: **exit 1**, `1 failed \| 16 passed (17)`, `Cannot find package`. Control on the unmutated file: **17/17, exit 0**. File restored, 0 pending. |
| The fixer's correction of the review's proposed assertion | **Justified.** Runtime types of the six bindings: `getNativeFileCacheLocation` function, **`workspaceDataDirectory` string**, `createTaskGraph` function, `createTaskHasher` function, `readNxJson` function, `createProjectGraphAsync` function. The review's `toBeTypeOf('function')` would have shipped RED on the string row; `toBeDefined` is the correct choice and still catches a renamed export. |

## 3. Test count 1177 -> 1184 (+7), fully attributed

The fix range adds exactly one `it` (the extraction control) and one `it.each` over the six derived
rows. **No `it` or `test` registration is removed anywhere in the fix range** -- no file lost a case.
1 + 6 = 7.

Confirmed behaviourally by the per-commit walk: `af53734` = 1177, `9709a2b` = 1184 (the WR-01 commit,
where all +7 land), and 1184 at each of the three commits after it. `capture-hashes-cli.spec.ts` is
17 tests, up from 10. File count 44, unchanged.

## 4. WR-02 / WR-05 / WR-03 / WR-04 / IN-01

| Fix | Verdict | Evidence |
|-----|---------|----------|
| WR-02 -- single-source the snippet target list | Genuine, no relaxation | One `SNIPPET_TARGETS` now feeds both the key-set equality and the per-target loop. Key set still asserted by `toEqual`, each target still `toEqual([command])`. The in-code instruction now points at the constant instead of at the key set alone. |
| WR-05 -- name both crashes | Genuine | `JSON.parse` wrapped with a named throw carrying `REWORD_ADVICE`; `targetDefaults` presence asserted before use. `targetDefaults[target]?.inputs` on a missing key yields `[]`, which still fails `toEqual([command])`, so the guard is not softened by the optional chain. |
| WR-03 -- `mirrored-by-label.ts` docstring | Correct | The old reason ("the READER needs the prefix alone -- it strips it off") was false on both halves; the real reason (the spec pins its value) is now in the file that carries the claim. |
| WR-04 -- orphaned docstring | Correct | The exact line this verifier flagged at `cache-key.spec.ts:88` is deleted; the surviving docstring already carries the URL-anchoring fact. |
| IN-01 -- two ordering comments | Correct, comments only | Confirmed by reading the diff: no executable line changed in `capture-hashes.mjs`. The `capture()` comment no longer implies the measurement point is "unchanged" (it is EARLIER) and names the `graphState` verdict as the actual invariant. |

## 5. Gate battery at HEAD (uncached, verifier-run)

| Gate | Result |
|------|--------|
| `nx run-many -t build typecheck test integration lint --skip-nx-cache` | exit 0 |
| `test` | **1184 passed (1184), 44 files** |
| `integration` | 15 passed (15), 3 files |
| `format:check` | exit 0 |
| `check:action` | exit 0, no bundle drift |
| `fallow:ci` | exit 0, 66 entry points, 0 issues |

## 6. Non-negotiables across the FULL range `4518787..HEAD` (22 commits)

| Invariant | Result |
|-----------|--------|
| `nx.json` byte-unchanged | blob `580d962a165f952fa8d49c24c62c52547737d807` at both ends; `git diff --exit-code` silent |
| ALL of `.github/` byte-unchanged | `git diff --stat 4518787..HEAD -- .github/` is empty |
| `260810-bxj` deferred record untouched | silent, range-scoped |
| `lib/compression-method.ts` (VER-05) | present |
| Construction-time `mkdirSync` (VER-08) | present, 5 sites |
| `capture-hashes.mjs` clauses 1-6 | all six enumerated in the contract block; clause 5 and 6 retention text intact |
| No U1..U9 implemented | `isLegacyOsSuffixedAssetName` in 4 modules; `wilsonLowerBound` and `SEED_MARKER_WORDS` present (`publish-mirror.ts` byte-unchanged across the full range); no `lib/github-rest.ts`; no `hash-parity/targets.json`; `.gitignore` unchanged |
| `start-cache-server/index.js` | byte-unchanged; `check:action` green |
| A3 invariants still hold | zero static `nx/src/...` imports; `const TARGETS = [...]` still one line, byte-identical to baseline |
| Debt markers in fix-range files | none |
| Non-ASCII in added code lines / the 5 commit messages | none (scanner positive-controlled) |

## 7. Bisect spot check extended to 10 of 22

All five review-fix commits run green in a detached worktree, vitest invoked directly so no Nx cache
can replay a verdict: `af53734` 1177, `9709a2b` 1184, `fd8fa7a` 1184, `c02f0d6` 1184, `1b06816` 1184
-- exit 0 each. Combined with the earlier five, that is **10 of 22 commits measured on the `test`
gate**, covering every commit in the fix pass and the five highest-risk original ones. Twelve commits
and five of the six gates remain unmeasured per-commit, which is why truth 6 stays
PRESENT_BEHAVIOR_UNVERIFIED.

## 8. SUMMARY.md corrections -- verified, plus what still outruns its evidence

**The four corrections state what is evidenced.**

| Correction | Verdict |
|------------|---------|
| Flake section rewritten | Accurate. Records the eleven green runs and the 29 `node.exe` processes, says the "pre-existing contention flake" framing is NOT supported, and states plainly that no maintainer action is implied. The residual claim about the executor's own scoped revert is presented as the executor's evidence beside the stronger corroboration, under an explicit "can be neither confirmed nor refuted" framing. |
| Commit SHAs corrected | Verified. All 17 table SHAs satisfy `git merge-base --is-ancestor <sha> HEAD`; both pre-reword SHAs (`65d36e1`, `703a261`) correctly do NOT. The self-check now names `--is-ancestor` as the check, which is the one that discriminates. |
| Bisect claim downgraded | Accurate as written -- "spot-checked 5 of 17 (the highest-risk five), not measured for the other twelve", with the five SHAs named. It matches exactly what had been measured at the time. |
| Review-fix section added | Accurate, including the sentence that matters most: "the 'no guard weakened' claim was FALSE as this task originally landed, in exactly one place, and it is true again now." The review's finding counts (1 Critical, 5 Warnings, 4 Info) match REVIEW.md's headings. |

**Four claims in SUMMARY.md still outrun their evidence.** None affects the code; all are
documentation accuracy, and together they are the second human item.

1. **Frontmatter `metrics.commits: 17` and `metrics.test_count: 1177`** describe the pre-fix state.
   HEAD is 22 commits and 1184 tests. The body reconciles both; the frontmatter does not, so a tool
   reading frontmatter gets the wrong numbers.
2. **"Every commit was gated with the subset relevant to its change BEFORE it landed"** rests on the
   executor's own testimony. It is not measurable after the fact, and the sentence immediately after
   it correctly scopes what IS measured -- the two sit oddly together.
3. **The bisect sentence says "5 of 17"** while the range is now 22; the five fix commits were also
   unmeasured per-commit at the time it was written. (This verifier has since measured them: green.)
4. **`read-back.spec.ts:363`** is cited twice -- SUMMARY.md's reviewer notes and
   `260810-kuo-deferred-items.md` -- for a value guard that sits at `:360`. Relatedly the self-check
   line "Working tree carries only the three untracked planning documents" now reads five.

## Re-verification verdict

**status: human_needed**, and deliberately not `passed`.

The Critical regression is genuinely closed -- proven by falsification, not by reading the fix. Every
other review finding is addressed, the full-range non-negotiables are clean, the eight gates are
green uncached at HEAD, and the +7 is fully attributed. Nothing is broken, and no gap remains.

What blocks `passed` is one truth and one artifact detail, neither of which a fix pass changed:

- **Truth 6 is still unproven.** "Every commit leaves all six gates green" is measured at 10 of 22
  commits on one of six gates. SUMMARY.md now says the same thing about itself. Certifying 7/7 would
  assert something both this report and the artifact under review decline to assert.
- **SUMMARY.md's frontmatter metrics and three small references are stale**, and correcting an
  artifact this verifier is auditing is not the verifier's edit to make.

Both are cheap for a human to close, and neither is a code defect.

---

_Re-verified: 2026-08-10_
_Verifier: Claude (gsd-verifier)_
