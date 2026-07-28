---
phase: 08-nx-task-hash-parity
plan: 06
subsystem: infra
tags: [nx, task-hashing, cross-os, ci, gate, mutation-testing, live-ci, d-22]

# Dependency graph
requires:
  - phase: 08-nx-task-hash-parity
    plan: 02
    provides: compareHashParity and its 28 fixture-proven clause cases, the assert-parity.ts bin, and the stable colour-free success prefix this job greps for
  - phase: 08-nx-task-hash-parity
    plan: 05
    provides: the nx.json fix, the four-target INVARIANT_TARGETS set on D-21's PRIMARY branch, and the corrected CI records the gate compares
provides:
  - the `hash-parity-compare` job -- build-gating from its first commit, no continuous-on-error and no advisory period, deriving its verdict from record CONTENT with no reference to any upstream job result
  - `lint` ENFORCED as the fourth invariant target rather than measured once, closing Phase 7's D-35 hand-off through D-21's primary branch
  - an OBSERVED RED on REAL legs for BOTH halves of the gate -- the invariant-target clause and clause (a) -- each with its matching GREEN after revert and both run references
  - RESEARCH assumption A4 EXECUTED for the narrower `!cancelled()` form specifically, so clause (a)'s reachability past a failed leg is measured rather than inherited from prose
  - the record's `## The gate can fail` and `## Live-CI closures` sections, ten named closures with run references plus three stated non-closures
  - the final PARITY-07 confirmation, with the guard files byte-identical across the whole phase
  - an unplanned fifth observation -- PARITY-03 survives a full hash rotation, so it is a property of the configuration rather than a coincidence of one set of numbers
affects:
  [
    phase 9 PARITY-08 (registering ci.yml as a test input) and VER-01,
    phase 9's all-MISS tripwire (the rotation window is wider than pre-recorded),
    phase 12 DOCS-07,
  ]

# Tech tracking
tech-stack:
  added:
    - actions/download-artifact@v8
  patterns:
    - "A gate is not evidence until its RED has been seen on the REAL chain -- fixtures prove the comparator, only a live run proves two uploads, a cross-job download, a parse and a verdict that gates the branch"
    - "Choose the mutation that reddens the clause WITHOUT touching the string the milestone depends on: additive and obviously wrong on a different target beats remove-then-restore on the load-bearing one"
    - "A RED with no matching GREEN after the revert does not distinguish 'the gate fired' from 'the branch is broken' -- the unperturbed re-run is part of the proof, not a formality"
    - "Keep a demonstration's commits as an adjacent applied-and-reverted PAIR, and name the SHAs anywhere a later reader's log-based check would be muddied by them"
    - "Print the failure message for real before trusting its text: the only way this phase found that the gate's own detail string named an `if:` form the workflow does not carry"
    - "Continuous enforcement measures something a one-time reading cannot -- that the invariant holds across a hash rotation, not just at one set of values"

key-files:
  created:
    - .planning/phases/08-nx-task-hash-parity/deferred-items.md
  modified:
    - .github/workflows/ci.yml
    - .planning/phases/08-nx-task-hash-parity/08-ROOT-CAUSE.md
    - packages/github-cache/src/hash-parity/compare.ts
    - packages/github-cache/src/hash-parity/compare.spec.ts

key-decisions:
  - "`if: !cancelled()` over D-17's named `always()`, chosen deliberately and argued in the job's comment. What D-17 REQUIRES is that a FAILED or SKIPPED leg still reaches the assertion; the two forms differ on exactly one case, cancellation, where a red gate is noise rather than signal. The narrower form is also already this file's house form on a dependent job (`publish`). Both halves were then MEASURED rather than assumed -- the clause-(a) demonstration ran with an upstream leg at conclusion `failure` and the compare job still reached its verdict."
  - "The D-22 mutation is ADDITIVE and on a DIFFERENT target: a platform runtime input appended to `targetDefaults.build.inputs`, not a removal of `integration`'s discriminator. D-14 requires that string byte-identical and after VER-03 it is the sole mechanism separating OS-sensitive targets, so a remove-then-restore of it is a needless risk when an obviously-wrong mutation elsewhere reddens the same clause -- and reddens the clause that matters more, (c), the non-vacuity control that makes (b) mean anything."
  - "Clause (a) was proven on a real leg rather than recorded as a residual, because it was cheap and because it is the only clause whose reachability depends on WORKFLOW WIRING rather than on the comparator. It closes RESEARCH assumption A4, which was recorded as 'not executed' with the consequence that D-17's requirement would be unreachable in this shape if it were wrong."
  - "Both mutations are KEPT on the branch as adjacent applied-and-reverted pairs, not squashed away. A demonstration whose commits are gone is indistinguishable from one that never happened -- the same reasoning D-21 applies to a downgraded clause. Both reverts are verified byte-identical with `git diff --exit-code`, not merely equivalent."
  - "The checkout is pinned to the PR head SHA, which the plan did not ask for. On a default merge-commit checkout a clause WEAKENED on the default branch would judge THIS branch's records -- a false-green channel, since the merge tree can carry a removal the branch never made. The records come from the branch tree, so the comparator that judges them must be the branch's comparator."
  - "The `wrong-record-count` detail string was FIXED rather than left as a wording nit. It named `if: always()`, which the workflow does not contain, and it is read by whoever is debugging a gate that is already red -- the phase's own recurring finding (the correct verdict with the wrong cause named) in a new place."
  - "The one unreproducible `test` failure is recorded as an unattributed one-off in `deferred-items.md` with exactly what is and is not known, rather than diagnosed by guesswork. Its output was destroyed by the re-run; any statement about the cause would be invention."

patterns-established:
  - "Pattern: a mutation's LOCAL bonus signal (a second, independent guard reddening on the same edit through a different mechanism) is stronger evidence the mutation was real than either guard alone"
  - "Pattern: quote a failure message as it was PRINTED, even after fixing it, because that is what the run shows -- then record the fix separately"
  - "Pattern: when a demonstration muddies a prior plan's log-based proof, restate the proof against a FIXED endpoint no later commit can perturb"

# Deliberately empty, matching plans 08-01 through 08-05. This plan's frontmatter claims
# CORR-03, PARITY-03, PARITY-05 and PARITY-07. CORR-03 is now substantively CLOSED -- the
# gate is wired, build-gating, and observed red on real legs for both halves -- but these
# remain phase-end properties the verifier closes against VERIFICATION + SUMMARY +
# REQUIREMENTS. Additionally `requirements.mark-complete` has corrupted REQUIREMENTS.md in
# two prior waves of this project (STATE.md, Phase 07 P04), so the tool was not invoked.
requirements-completed: []

coverage:
  - id: D1
    description: "A build-gating job over BOTH legs at one commit, with an `if:` expression that reaches the assertion when a leg FAILED or was SKIPPED"
    requirement: CORR-03
    verification:
      - kind: other
        ref: "`.github/workflows/ci.yml` `hash-parity-compare`: `needs: hash-parity`, `if: ${{ !cancelled() }}`, single ubuntu runner, `timeout-minutes: 15`. Parsed and asserted structurally: no `permissions` key, no `continue-on-error` key, no event gate, and no `needs.*.result` substring anywhere in the job"
        status: pass
      - kind: integration
        ref: "Run 30357290164: `hash-parity (windows-11-arm)` conclusion `failure` and `hash-parity-compare` STILL RAN, reaching `wrong-record-count`. RESEARCH assumption A4 executed for the `!cancelled()` form specifically"
        status: pass
    human_judgment: false
  - id: D2
    description: "The verdict comes from record CONTENT, never from an exit code alone and never from an upstream job's result"
    requirement: CORR-03
    verification:
      - kind: other
        ref: "The comparison step runs the built bin under `set -euo pipefail`, tees combined output to a log, and greps that log for the loader's literal success prefix -- the `lint` job at ci.yml:66-72 as precedent, and Phase 7's `nx run-many -t <missing>` exiting 0 as the reason the precedent exists. No NO_COLOR needed: the prefix is the comparator's own literal, not Nx-formatted"
        status: pass
      - kind: integration
        ref: "Run 30356229082: `hash-parity-compare` FAILED while BOTH capture legs were `success` and `download-artifact` reported `Total of 2 artifact(s) downloaded`. There is no reading of that failure in which an upstream job result contributed"
        status: pass
    human_judgment: false
  - id: D3
    description: "The gate has been OBSERVED failing on a REAL leg, and recovering, for BOTH halves"
    requirement: CORR-03
    verification:
      - kind: integration
        ref: "Invariant-target clause: mutation `6260496`, RED at run 30356229082 -- `PARITY FAILED (invariant-target-diverged) -- \\`build\\` must be IDENTICAL across platforms but diverged: linux=5346514019200865346 vs win32=12093782812520948388` -- revert `65a2e13`, GREEN at run 30356937751 with `build` back at `17197827372395989528`"
        status: pass
      - kind: integration
        ref: "Clause (a): mutation `c9bd654`, RED at run 30357290164 -- `PARITY FAILED (wrong-record-count) -- expected exactly 2 platform records, one per matrix leg, but got 1` after `Total of 1 artifact(s) downloaded` -- revert `a0fb1b3`, GREEN at run 30358020343"
        status: pass
      - kind: other
        ref: "Bonus local signal: the same nx.json mutation reddened the pre-existing CORR-04 guard through a different mechanism, `expected [ 'integration', 'build' ] to deeply equal [ 'integration' ]`, 1 failed / 561 passed"
        status: pass
    human_judgment: false
  - id: D4
    description: "No mutated tree persists on the branch, and both reverts are byte-identical rather than merely equivalent"
    requirement: CORR-03
    verification:
      - kind: other
        ref: "`git diff --exit-code 77c8238 -- nx.json` exits 0; `git diff --exit-code 65a2e13 -- .github/workflows/ci.yml` exits 0. Both mutations are present as adjacent applied-and-reverted PAIRS (`6260496`/`65a2e13`, `c9bd654`/`a0fb1b3`), deliberately kept rather than squashed"
        status: pass
    human_judgment: false
  - id: D5
    description: "08-04's ordering proof stays checkable despite the nx.json mutation pair"
    verification:
      - kind: other
        ref: "`git log --oneline 7bfe64f..HEAD -- nx.json` now returns THREE commits instead of one, so the record names both demonstration SHAs and states that `163e6b9` remains the only fix and is the OLDEST of the three. It also restates the proof against a FIXED endpoint: `git log --oneline 7bfe64f..eeace53 -- nx.json` returns 0 lines, which no later commit can perturb"
        status: pass
    human_judgment: false
  - id: D6
    description: "`lint` is ENFORCED as a fourth invariant target on D-21's PRIMARY branch, and its clause was never deleted"
    requirement: PARITY-03
    verification:
      - kind: unit
        ref: "`INVARIANT_TARGETS` in compare.ts carries `build`, `typecheck`, `test`, `lint`; compare.spec.ts asserts each independently by name"
        status: pass
      - kind: integration
        ref: "Every green compare run prints `lint=<hash>/<hash>` with both sides equal -- `6930879416208693542` at runs 30355822956 and 30356937751, `16122270460632698382` after the rotation at run 30358020343. D-21's named fallback did NOT apply and no clause was downgraded"
        status: pass
    human_judgment: false
  - id: D7
    description: "Ten Live-CI items named individually, each with a run reference or an explicit open-with-reason line"
    requirement: PARITY-05
    verification:
      - kind: other
        ref: "`## Live-CI closures` is a ten-row table covering both observation points, PARITY-05's same-OS row, the two-leg comparison, the real-leg RED, clause (a) plus A4, `if-no-files-found: error`, the `lint` verdict, the v7/v8 artifact pairing (A5), and the rotation survival. Three non-closures are STATED rather than omitted: the zero-match download path, the upstream `@nx/js/typescript` classification, and PARITY-08"
        status: pass
    human_judgment: false
  - id: D8
    description: "PARITY-07 confirmed with the guard files UNTOUCHED across the whole phase"
    requirement: PARITY-07
    verification:
      - kind: other
        ref: "`git diff --name-only 7bfe64f..HEAD -- packages/github-cache/src/public-surface.spec.ts packages/github-cache/src/index.ts packages/github-cache/src/test/consumer-contract.ts` returns 0 files and `--exit-code` exits 0. `npm run pack:check` exits 0 naming 53 files and `dist/hash-parity` among four excluded subtrees. The three negatives are stated explicitly: no new env knob, no new action input, no new package export"
        status: pass
    human_judgment: false
  - id: D9
    description: "No Phase 8 spec asserts on `.github/workflows/ci.yml` content"
    verification:
      - kind: other
        ref: "No spec was added for the workflow; the job's rationale lives entirely in its comment block, because `nx.json:68` lists `cleanup.yml` and not `ci.yml` among the `test` inputs, so such a spec would serve a stale cached PASS. Registering `ci.yml` is PARITY-08 in Phase 9"
        status: pass
    human_judgment: false

# Metrics
duration: 42min
completed: 2026-07-28
status: complete
---

# Phase 8 Plan 06: Wire the gate, and prove it can fail Summary

**The comparison is now enforced on every run instead of measured once -- and it has been seen going RED on real runner data for BOTH halves of the gate, then GREEN again on the revert, which is the one thing five plans of fixtures and measurements could not establish.**

## Performance

- **Duration:** 42 min (13:41 to 14:23 local, including four Live-CI round-trips)
- **Tasks:** 2 of 2
- **Files modified:** 4 (1 created, 3 modified, plus the record)
- **Commits:** 7

## Accomplishments

- **The `hash-parity-compare` job, build-gating from its first commit.** `needs` the capture matrix, `if: ${{ !cancelled() }}`, single ubuntu runner, no `permissions` block, no event gate, no `continue-on-error` and no advisory period (D-18). Green on the pull request at run [`30355822956`](https://github.com/op-nx/github-cache/actions/runs/30355822956) with `Total of 2 artifact(s) downloaded` and one stdout line carrying all five hashes.

- **The gate was OBSERVED RED on real legs, twice, for two different clauses.** An additive OS-sensitive input on `build` reddened the invariant-target clause at run [`30356229082`](https://github.com/op-nx/github-cache/actions/runs/30356229082), naming the clause, the target and both platform hashes -- **while both capture legs were `success`**, which is the cleanest possible demonstration that the verdict comes from record content and not from an upstream result. A dropped windows record reddened clause (a) at run [`30357290164`](https://github.com/op-nx/github-cache/actions/runs/30357290164), **with the windows leg at conclusion `failure` and the compare job still reaching its assertion.**

- **Both REDs have their matching GREEN.** Runs [`30356937751`](https://github.com/op-nx/github-cache/actions/runs/30356937751) and [`30358020343`](https://github.com/op-nx/github-cache/actions/runs/30358020343). A RED with no GREEN afterwards does not distinguish "the gate fired on the mutation" from "the branch is broken about something else" -- the unperturbed re-run is part of the proof.

- **RESEARCH assumption A4 is EXECUTED, for the form actually shipped.** A4 -- "an `if:` expression on a `needs`-gated job runs when an upstream matrix leg failed" -- was recorded as not executed, with the consequence that D-17's "fewer than two records is a FAILURE" would be unreachable in this shape if it were wrong. Clause (a)'s demonstration ran it, on `!cancelled()` rather than on `always()`, so the closure is about the expression in the file.

- **`lint` is ENFORCED, not merely measured.** D-21's PRIMARY branch, on 08-05's verdict. Phase 7's D-35 handed "does `@nx/eslint` infer `lint` identically on both OSes?" over as UNVERIFIED BY DESIGN; every green compare run now prints `lint=<hash>/<hash>` with both sides equal, so the answer is re-asserted on every push rather than sitting in a record. The clause was never downgraded and never deleted.

- **`if-no-files-found: error` was proven to fail the LEG rather than deliver silence.** `No files were found with the provided path: hash-parity-windows-11-arm.json. No artifacts will be uploaded.` -- the setting's whole purpose, previously argued in a comment and now measured.

- **An unplanned fifth observation, and the most reassuring one.** The final commit edited `compare.ts`, which is under `{projectRoot}/**/*`, so all five hashes ROTATED. All four invariant targets are still byte-identical cross-OS at the new values and `integration` still diverges. **PARITY-03 is a property of the configuration, not a coincidence of one set of numbers** -- and only a continuously-enforced gate could have shown that.

- **PARITY-07 confirmed by an EMPTY diff.** `public-surface.spec.ts`, `src/index.ts` and `src/test/consumer-contract.ts` are byte-identical across the whole phase, `7bfe64f..HEAD`. The force of D-16 is in the word "unchanged": a guard edited until it passes proves nothing, so the evidence is the diff that is not there.

## Task Commits

| # | Commit | What |
|---|--------|------|
| 1 | `77c8238` | the `hash-parity-compare` job and its rationale block |
| 2 | `6260496` | D-22 gate-RED demonstration (nx.json), **deliberately wrong** |
| 2 | `65a2e13` | its revert, nx.json byte-identical |
| 2 | `c9bd654` | D-22 clause (a) demonstration (ci.yml), **deliberately wrong** |
| 2 | `a0fb1b3` | its revert, ci.yml byte-identical |
| 2 | `f866210` | the `wrong-record-count` detail fix |
| 2 | `69bd1b7` | the record's three new sections |

## The five compare-job runs, end to end

| Run | Commit | State | `hash-parity-compare` | Verdict |
|-----|--------|-------|-----------------------|---------|
| [`30355822956`](https://github.com/op-nx/github-cache/actions/runs/30355822956) | `77c8238` | baseline | success | `PARITY OK linux vs win32` |
| [`30356229082`](https://github.com/op-nx/github-cache/actions/runs/30356229082) | `6260496` | mutated | **failure** | `invariant-target-diverged`, naming `build` |
| [`30356937751`](https://github.com/op-nx/github-cache/actions/runs/30356937751) | `65a2e13` | reverted | success | `PARITY OK`, `build` restored |
| [`30357290164`](https://github.com/op-nx/github-cache/actions/runs/30357290164) | `c9bd654` | mutated | **failure** | `wrong-record-count`, got 1 |
| [`30358020343`](https://github.com/op-nx/github-cache/actions/runs/30358020343) | `f866210` | reverted | success | `PARITY OK` at rotated hashes |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The gate's own failure message named an `if:` form the workflow does not carry**

- **Found during:** Task 2, when the clause-(a) demonstration printed the message for real for the first time
- **Issue:** `wrong-record-count`'s detail read "The compare job runs `if: always()` (D-17)". The wired job runs `if: !cancelled()`. This string is what a maintainer reads when the gate is ALREADY red, and it sent them looking for an expression `ci.yml` does not contain -- the phase's own recurring finding (the correct verdict with the wrong cause named) in a new place. No fixture noticed, because none of the 28 cases asserts on that sentence; they assert on the reason and on the three named suspects.
- **Fix:** Corrected in `compare.ts` and in the spec's clause (a) comment, which now also records that the one-record case is measured on a real runner rather than assumed. No behaviour change: the reason, the clause order and the three suspects are untouched.
- **Files modified:** `packages/github-cache/src/hash-parity/compare.ts`, `packages/github-cache/src/hash-parity/compare.spec.ts`
- **Commit:** `f866210`

**2. [Rule 1 - Bug] The capture job's forward line reference was off by 130 lines after the insertion**

- **Found during:** Task 1
- **Issue:** The `hash-parity` job's comment points at the permissions trap "recorded in full at :658-661". It was already stale before this plan (the block was at :809), and inserting 135 lines above it made it worse.
- **Fix:** Both that reference and all three of the new job's forward references were recomputed against the post-insertion file and verified by `git grep -n`.
- **Files modified:** `.github/workflows/ci.yml`
- **Commit:** `77c8238`

### Maintainer-approved additional scope

**3. Clause (a) was proven on a REAL leg instead of being recorded as a residual**

- **Why:** The plan's STEP 2 says to take the real-leg clause-(a) proof "if it can be done cheaply", and it was: one windows-only step, one commit, one revert, one CI round-trip. It is also the only clause whose reachability depends on WORKFLOW WIRING rather than on the comparator, and RESEARCH listed that reachability (A4) as an unexecuted assumption whose falsity would make D-17's requirement unreachable. An actual observation beats an honest residual.
- **What it cost:** two extra commits and one extra CI round-trip.
- **What it bought:** A4 closed on the shipped expression, `if-no-files-found: error` proven to fail the leg, clause (a) red on real data -- and, as a side effect, deviation 1 above, which would otherwise have shipped.
- **Commits:** `c9bd654`, `a0fb1b3`

**4. The checkout is pinned to the PR head SHA, which the plan did not specify**

- **Why:** the records are captured from the branch tree, so the comparator that judges them must be the branch's comparator. On a default merge-commit checkout, a clause WEAKENED on the default branch would silently judge this branch's records -- a false-green channel, since the merge tree can carry a removal the branch never made. One line, and it keeps the capture/compare pair coherent.
- **Files modified:** `.github/workflows/ci.yml`
- **Commit:** `77c8238`

---

**Total deviations:** 2 auto-fixed bugs, 2 items of additional scope. None touches `nx.json` in its committed state, `src/index.ts` or the public-surface guard.

## Named residual: the zero-match download path

The job creates the records directory before the download so the loader always has a directory to read. If the download action ITSELF errors on a pattern matching ZERO artifacts, the job is still RED but the blame lands one step earlier than the comparator's named `wrong-record-count` reason. **That path was not exercised on a real leg** -- demonstration 2 produced ONE artifact, not zero -- so it is recorded as an accepted residual rather than claimed as observed. The clause is covered either way: the zero-record fixture case is unit-proven and the one-record case is now proven live. An honest residual beats a claimed observation.

## Issues Encountered

- **One unattributed `test` failure at `69bd1b7`, not reproducible, output destroyed by the re-run.** `npm run test` exited 1 once inside the battery loop, whose redirect discarded the message. Nx's own flaky-task detection then fired -- which means Nx saw a FAILURE and a SUCCESS at the SAME task hash, i.e. non-determinism rather than a regression. Seven consecutive local runs afterwards passed at that hash (`562 passed (562)`), and CI's `test` job at the same tree is `success`. Which spec failed is NOT known and cannot be recovered: Nx caches terminal output for successful runs only. Logged in full to `deferred-items.md` with what is and is not known, and deliberately NOT diagnosed -- any statement about the cause would be invention. Anyone who sees it again should capture the output BEFORE re-running.
- **`gsd-tools state record-metric` takes named flags (`--phase`, `--plan`, `--duration`, `--tasks`, `--files`), not positional arguments**, contrary to the executor's documented invocation. The positional form fails with `phase, plan, and duration required`.
- **`state add-decision` stamps `[Phase ?]`** rather than resolving the current phase; the three new lines were corrected to `[Phase 08]` in place. Nineteen pre-existing `[Phase ?]` entries from earlier phases were left alone.

## Verification

- **Nine-command battery green at the final commit:** `format:check`, `build`, `typecheck`, `typecheck:action`, `test`, `lint`, `fallow:ci`, `check:action`, `pack:check` -- each exit 0.
- **Both gate jobs green on the pull request at the final commit** (run [`30358020343`](https://github.com/op-nx/github-cache/actions/runs/30358020343)): `hash-parity` on both legs and `hash-parity-compare`.
- **The gate observed RED on real legs and GREEN on the reverts,** with all four run references recorded in the record.
- **No mutated tree persists on the branch.** Both reverts verified with `git diff --exit-code`, both exit 0.
- **`public-surface.spec.ts`, `src/index.ts`, `src/test/consumer-contract.ts` byte-identical across `7bfe64f..HEAD`;** `pack:check` exit 0 naming `dist/hash-parity` excluded.
- **The job carries no `permissions` key, no `continue-on-error` key, no event gate, and no `needs.*.result` substring** -- asserted by parsing the workflow rather than by reading it.
- **No Phase 8 spec asserts on `ci.yml` content.**
- **Zero non-ASCII characters** in every touched file.
- **No email-shaped token was added** to any committed content; committer identity is the public address.

## What this plan did NOT close

- **The zero-match download path** -- see the named residual above.
- **The upstream `@nx/js/typescript` OS-dependent project-reference classification.** `nx.json` normalises the symptom at the merged node; an upstream report remains a legitimate follow-up filed as its own work.
- **PARITY-08** (registering `ci.yml` as a declared `test` input) -- deferred to Phase 9 by design, so nothing in Phase 8 asserts on `ci.yml` behind a stale cached PASS.
- **The one-off `test` failure** -- logged, not diagnosed.

## Next Phase Readiness

**Phase 8 is ready for verification.** All six plans have summaries. The gate is live and gating.

**Two things Phase 9 must know:**

1. **The all-MISS rotation window is WIDER than pre-recorded.** The record predicted the rotation from `163e6b9`'s `nx.json` edit. `f866210`'s edit to `compare.ts` rotated all five hashes again, for the same legitimate reason -- every `{projectRoot}` source file is a declared input. Phase 9's tripwire must therefore still be "two CONSECUTIVE all-miss pushes with no version-affecting change in between", never "an all-miss push is a defect".
2. **PARITY-08 has a concrete first customer now.** `ci.yml` carries roughly 250 lines of rationale that no spec can assert on until it is a declared `test` input. The `hash-parity-compare` job's comment block is the largest single block of it.

**No blockers.**

## Self-Check: PASSED

Files claimed created/modified, verified present:

- `.github/workflows/ci.yml` - FOUND (contains `hash-parity-compare`)
- `.planning/phases/08-nx-task-hash-parity/08-ROOT-CAUSE.md` - FOUND (contains `## The gate can fail`, `## Live-CI closures`, `## PARITY-07, confirmed at the phase's end`)
- `.planning/phases/08-nx-task-hash-parity/deferred-items.md` - FOUND
- `packages/github-cache/src/hash-parity/compare.ts` - FOUND (detail names `!cancelled()`)
- `packages/github-cache/src/hash-parity/compare.spec.ts` - FOUND

Commits claimed, verified present in `git log`:

- `77c8238`, `6260496`, `65a2e13`, `c9bd654`, `a0fb1b3`, `f866210`, `69bd1b7` - all FOUND

Plan-level constraints, verified:

- `git diff --exit-code 77c8238 -- nx.json` exits 0 - PASS
- `git diff --exit-code 65a2e13 -- .github/workflows/ci.yml` exits 0 - PASS
- `git log --oneline 7bfe64f..eeace53 -- nx.json` returns 0 lines - PASS
- Guard files untouched across `7bfe64f..HEAD` - PASS
- All nine battery commands exit 0 at the final commit - PASS
- No commit in this plan deletes a tracked file - PASS

---
*Phase: 08-nx-task-hash-parity*
*Completed: 2026-07-28*
