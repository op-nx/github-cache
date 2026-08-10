---
phase: 12-windows-ci-reuse-o4-consumer-recipe
plan: 04
subsystem: nx-task-hashing
tags: [discriminator, cross-os, nx-inputs, correction-register, DOCS-07, D-15]
requires:
  - "12-01 / 12-02: the three windows-11-arm legs (the tree this sweep runs over)"
  - "12-RESEARCH U-01: the three measurements that make the hardening evidence-backed"
provides:
  - "the single-sourced stderr-immune discriminator literal `node --no-warnings -p process.platform`"
  - "two exact-equality pins on that literal (targetDefaults alone, and project.json-merged)"
  - "CORR-04's byte-identical constraint, SUPERSEDED IN PLACE with its replacement reason"
affects:
  - "12-05: renders this exact literal into docs/cross-os.md and locks the equality"
  - "12-06: pre-registered MISS counts -- this plan rotates build, typecheck, test, integration and lint"
tech-stack:
  added: []
  patterns:
    - "correction register: keep the superseded argument VISIBLE, never delete it (S-1)"
    - "completeness sweep paired with a positive control AND an explicit exit-code read"
    - "state the change without reproducing the retired literal, so the sweep stays clean"
key-files:
  created: []
  modified:
    - nx.json
    - packages/github-cache/src/nx-target-inputs.spec.ts
    - packages/github-cache/src/hash-parity/compare.spec.ts
    - packages/github-cache/src/hash-parity/compare.ts
    - eslint.config.mjs
    - .github/workflows/ci.yml
    - .planning/phases/08-nx-task-hash-parity/08-ROOT-CAUSE.md
decisions:
  - "--no-warnings rather than a redirect: hash_runtime runs the string through exactly ONE shell per OS, so 2>/dev/null / 2>nul breaks one of them"
  - "the supersession note does NOT reproduce the retired literal, so the D-15 sweep is not made permanently non-zero by the file recording the retirement"
  - "SIX sites aligned, not the planned five: plan 12-02 added a second ci.yml comment quoting the discriminator"
metrics:
  duration: 38min
  completed: 2026-07-30
status: complete
---

# Phase 12 Plan 04: Single-Sourced Stderr-Immune Discriminator Summary

The `integration` platform discriminator is now `node --no-warnings -p process.platform` at every
one of the nine sites in the tree that spells it, and the written invariant that forbade re-spelling
it is superseded in place with the mechanism, the bounded failure mode and the measurements that
justify the one exception.

## What shipped

Three commits, in the order the plan's TDD gate requires.

| Commit | Type | What |
|---|---|---|
| `3d9f895` | feat | both exact-equality pins moved to the new literal (RED), the rationale block rewritten, then `nx.json` moved to match (GREEN) |
| `d8e18b9` | refactor | the six remaining spelling sites aligned, plus the corrected completeness sweep |
| `f85b6c1` | docs | CORR-04's byte-identical constraint SUPERSEDED in place in `08-ROOT-CAUSE.md` |

## Task 1: the pins, the argument, and the config

### The OBSERVED RED, transcribed

Step A changed only the two expected literals, before `nx.json` was touched. Both pins failed,
naming the old value still present in the config:

```
FAIL  src/nx-target-inputs.spec.ts > lint declares its full input set (LINT-04)
      > integration declares exactly the byte-identical discriminator command
AssertionError: expected [ 'node -p process.platform' ] to deeply equal [ Array(1) ]

- Expected
+ Received

  [
-   "node --no-warnings -p process.platform",
+   "node -p process.platform",
  ]

 > src/nx-target-inputs.spec.ts:400:29

FAIL  src/nx-target-inputs.spec.ts
      > the discriminator survives the MERGED project configuration (CORR-04)
      > keeps the byte-identical discriminator once project.json is merged over targetDefaults
AssertionError: expected [ 'node -p process.platform' ] to deeply equal [ Array(1) ]

- Expected
+ Received

  [
-   "node --no-warnings -p process.platform",
+   "node -p process.platform",
  ]

 > src/nx-target-inputs.spec.ts:448:7

 Test Files  1 failed | 2 passed | 38 skipped (41)
      Tests  2 failed | 7 passed | 877 skipped (886)
```

The one-runtime-input guard stayed GREEN throughout, confirmed by a separate filtered run in the
same RED state (`-t "runtime input"` -> `Tests 1 passed | 885 skipped (886)`). That is the split
mutation M3 already recorded: the mechanism's red was on the record, only the NEW literal needed its
own observation.

After Step C the same filter is green: `Test Files 3 passed | 38 skipped (41)`,
`Tests 9 passed | 877 skipped (886)`.

### The rewritten argument

The comment above the first pin argued that the string must stay byte-identical, naming re-spelling
a Core-Value regression. Left beside a changed literal it would have shipped a file arguing against
its own contents. Both original points are KEPT VISIBLE and marked
`BOTH POINTS ABOVE ARE SUPERSEDED FOR EXACTLY ONE RE-SPELLING`, followed by the four replacement
components the plan specified, each separately greppable:

| Component | Token | Count |
|---|---|---|
| (a) stderr IS hashed, cited | `hash_runtime.rs` | 1 |
| (b) the warning channel is PID-bearing | `PID` | 1 |
| (c) a node flag, not a shell construct -- one shell per OS | `sh -c` | 1 |
| (d) the stated residual | `residual` (case-insensitive) | 3 |

Both pins kept `toEqual`, not `toContain`: a SECOND runtime entry on `integration` is as much a
CORR-04 event as the string changing. The `runtimeInputsOf` / `mergedIntegration` helpers and the
negative control are byte-unchanged.

### The config

`nx.json`'s `targetDefaults.integration.inputs` runtime value moved. Verified by direct read:
exactly one runtime entry in the file, carrying the new value, and still the LAST element of the
array. Nothing else in `nx.json` changed. `capture-hashes.mjs` was deliberately NOT touched --
`readDiscriminatorCommand` reads the string out of `nx.json`, which is why per-leg verification of
the new command is free on the next `hash-parity` run.

## Task 2: six sites, not five

**DEVIATION (Rule 3 -- the tree moved under the plan).** The plan budgeted FIVE remaining sites
against a tree with ONE `ci.yml` occurrence. Plan 12-02 added a second one: the XOS-08 wiring block
above `build-windows` quotes `{ runtime: "node -p process.platform" }` when explaining why
`integration`'s matrix is not the wiring precedent. Under D-15 -- one string, not two that happen to
match -- it is a spelling site like any other, so it was aligned too. Six sites this task, nine in
the tree.

| # | Site | Kind |
|---|---|---|
| 1 | `hash-parity/compare.spec.ts` record-factory `command:` | fixture value |
| 2 | `hash-parity/compare.spec.ts` CORR-03(b) comment | comment |
| 3 | `hash-parity/compare.ts` contract comment | comment |
| 4 | `eslint.config.mjs` P8 ambient-platform-read block | comment |
| 5 | `.github/workflows/ci.yml` XOS-08 wiring block (12-02's) | comment |
| 6 | `.github/workflows/ci.yml` `integration` job leading block | comment |

The fixture's empty-string `stderr` was left as it stands -- that is the value measured on both real
CI legs, and the fixture is a record of it. No `stderr` value was added anywhere.

Every changed line in `eslint.config.mjs` and `ci.yml` begins with optional whitespace then `//` or
`#`: a filtered diff for non-comment changed lines returns nothing.

### The sweep, and the M-1 trap made visible

Both counts recorded, as the plan requires, so the trap is visibly avoided rather than silently
stepped over:

| Command | New literal | Old literal |
|---|---|---|
| documented, flagless | **7** sites | exit **1** |
| corrected, `--hidden --glob '!.git'` | **9** sites | exit **1** |

The delta is exactly the two `.github/workflows/ci.yml` sites -- `.github` is a dot-directory and
ripgrep skips hidden entries during traversal, with exit code 0 in both cases so nothing signals the
omission. The old literal's zero is a GENUINE no-match (exit **1**, not exit 2), and it is trusted
only because the positive control on the new literal in the identical command shape returned 9.

**One thing the sweep caught that the plan did not anticipate.** The first draft of the Task 1
supersession note quoted the retired literal verbatim while recording what changed -- honest, but it
left the old spelling permanently present in the tree, so the D-15 completeness sweep could never
return a clean no-match again. Resolved by stating the change as inserting `--no-warnings`
immediately after `node` and changing nothing else: the prior value is exactly recoverable from the
pins by deleting one flag, so nothing is lost, and the note says why it declines to reproduce it.
This is the repo's own precedent -- `docs-same-os-claims.spec.ts` writes its forbidden phrases with
a single-character character class for the same reason.

### ROBUST-04: the action bundle

`npm run check:action` was run FROM THIS MAIN WORKING TREE (never a junctioned worktree, which
reports a false 689-module drift). **Exit 0, no drift. `start-cache-server/index.js` did NOT move
and is not in any commit of this plan.** That is the expected result twice over: `compare.ts` is the
hash-parity comparator and is not reachable from `serve()`, and this plan's edit to it is
comment-only. Recorded explicitly rather than omitted.

## Task 3: CORR-04 superseded in place

`08-ROOT-CAUSE.md`'s bounding-constraint table forbids re-spelling the discriminator "in any way".
The supersession is attached to that constraint -- `#### SUPERSEDED by Phase 12 (DOCS-07, D-15) for
exactly ONE re-spelling` sits at line 1596, seven lines below the row at 1589 and directly under the
paragraph that elaborates it. The row itself, its prose, and the struck checklist item 6 in
`## Hand-off to Phase 12 (DOCS-07)` are all byte-unchanged: the commit is 55 insertions and zero
deletions.

All six required components are present and separately greppable (`SUPERSEDED`, `Phase 12`,
`hash_runtime.rs`, `PID`, `cmd /C`, `phase-scoped`, `nx-target-inputs.spec.ts`). The file stays pure
ASCII -- `rg -c '[^\x00-\x7F]'` exits 1, unchanged from its pre-edit state.

**RESEARCH Open Question 1 was answered by adopting the phase-scoped reading**, and the trade is
written into the note rather than implied: the constraint's own prose says "Phase 8 does not
re-spell it", which scopes it to that phase. Under the competing project-scoped reading the old
spelling would have to stay in `nx.json`, and then D-15's single-string lock forces the consumer
recipe to publish the un-hardened form, so DOCS-07's stderr-immunity clause could not be honoured.
Those two cannot both be satisfied without this change.

## Rotation this plan pays

Stated in advance in the plan from D-16's measured table, and unchanged by execution, so plan
12-06's pre-registered counts stay traceable to an edit rather than to a guess:

| Edit | Rotates |
|---|---|
| `nx.json` | `test` (own input) plus `integration` |
| the three spec files | `test`, `typecheck`, `integration` |
| `hash-parity/compare.ts` (a NON-spec `src/` file) | the above **plus `build`** |
| `eslint.config.mjs` | `test` and `lint` |
| `.github/workflows/ci.yml` | `test` |
| `.planning/**` | nothing |

`compare.ts` is why `build` rotates. CONTEXT D-19's anticipated ubuntu `build` HIT does not hold for
this phase.

`npm run integration` was deliberately NOT run: the `integration` hash rotated by design and a MISS
there is expected, not a failure.

## Verification

| Gate | Result |
|---|---|
| `nx run-many -t build typecheck test --skip-nx-cache` | `Successfully ran targets build, typecheck, test` |
| test counts | **41 files passed (41), 886 tests passed (886)** |
| `npm run lint` | `Successfully ran target lint` |
| `nx format:check --all` | exit 0 |
| `npm run check:action` (main tree) | exit 0, no drift |
| new literal, corrected sweep | 9 sites |
| old literal, corrected sweep | exit 1 (genuine no-match) |

The 886/886 count is identical to the pre-plan baseline. This plan adds no new tests -- it moves two
existing pins' expected values -- so an unchanged count is the correct outcome, not a missing one.

## Verification this phase still gets for FREE, and must READ

RESEARCH assumption A1 (that `--no-warnings` behaves identically on `linux/arm64`, measured here
only on `win32/arm64`) is NOT closed by this plan and is not marked closed. The next `hash-parity`
run records the new command's raw stdout AND stderr per OS into `hash-parity-<os>.json` on both
legs, with no new instrument, because `readDiscriminatorCommand` reads the command out of `nx.json`.
Plan 12-06's pre-flight must READ that artifact rather than assume it.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 3 - Blocking] Six spelling sites, not the planned five**
- **Found during:** Task 2, running the corrected sweep before editing
- **Issue:** the plan's site table was built against a tree with one `ci.yml` discriminator
  occurrence; plan 12-02 added a second in its XOS-08 wiring block. Aligning only the plan's five
  would have left the tree spelling two different strings, which is exactly what D-15 forbids.
- **Fix:** aligned both `ci.yml` comments. Expected counts adjusted from 8 to 9 accordingly.
- **Files modified:** `.github/workflows/ci.yml`
- **Commit:** `d8e18b9`

**2. [Rule 1 - Bug] The supersession note defeated its own completeness sweep**
- **Found during:** Task 2, first sweep after Task 1 landed
- **Issue:** the Task 1 note reproduced the retired literal while recording what changed, so the
  old spelling was still present in the tree and the sweep returned one hit instead of exit 1.
  Nothing was wrong with the record; the problem is that a mechanical sweep cannot distinguish a
  historical citation from a live spelling site.
- **Fix:** the note now states the change as inserting `--no-warnings` after `node`, and says why it
  declines to reproduce the old value, citing the in-repo precedent.
- **Files modified:** `packages/github-cache/src/nx-target-inputs.spec.ts`
- **Commit:** `d8e18b9`

### Formatting

Prettier collapsed the first pin's `toEqual([...])` back onto one line after the edit; run through
`prettier --write` and re-verified, `format:check` exit 0. No behaviour change.

## GSD tooling defects, all three reproduced as briefed

1. **`requirements.mark-complete` NOT called.** Traceability is closed once by the orchestrator's
   `phase.complete` step after the verifier runs. Verified: `git diff --stat 0251bd3 HEAD --
   .planning/REQUIREMENTS.md` is EMPTY.
2. **`roadmap.update-plan-progress` fired both defects.** It injected a duplicate bare plan list
   (count went 6 -> 12) and mangled the progress-table cell to `| In Progress|  |`. Both repaired:
   `rg -c "12-0[1-6]-PLAN.md"` is back to exactly 6 with 12-01..12-04 as `[x]`, and the cell reads
   `| 4/6 | In Progress | - |`.
3. **`state.add-decision` injected a `[Phase ?]` marker**, corrected to `[Phase 12]`. It also
   rejects a positional argument and requires `--summary`; the probe invocation used to discover
   that left a stray `- [Phase ?]: probe` entry, which was removed. No em dash was injected this
   time (the decision text carries none) -- `rg -c '[^\x00-\x7F]' .planning/STATE.md` returns 13,
   unchanged.
4. **`state.record-metric` rejects the positional form** the executor spec prescribes, as the prior
   executor recorded. Used named flags: `--phase 12 --plan 04 --duration 38min --tasks "3 tasks"
   --files "7 files"`.

## Self-Check: PASSED

- `12-04-SUMMARY.md` exists on disk.
- All three commit hashes (`3d9f895`, `d8e18b9`, `f85b6c1`) resolve in `git log`.
- This SUMMARY is pure ASCII (`rg -c '[^\x00-\x7F]'` exits 1).
- The corrected `--hidden` sweep for the old literal still exits 1 with this file written.

## Threat Flags

None. The delta is one config value and eight text sites: no credential, no write path, no package,
no new public surface. T-12-04 checked and clear -- this plan writes no `$GITHUB_ENV` line and edits
only comments inside `ci.yml`. T-12-SC checked and clear -- no `package.json` or `package-lock.json`
in the changeset, nothing installed.
