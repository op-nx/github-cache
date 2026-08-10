---
phase: 10-os-invariant-releases-mirror
plan: 06
subsystem: testing
tags: [tdd, red, vitest, corr-02, corr-05, retain-04, retain-05, integration-matrix]
status: complete

# Dependency graph
requires:
  - phase: 10-01
    provides: "the measured shard census (release `354838660`, tag `cache-mirror-202607`, 122 assets = 50 `.tar.gz` + 46 `-linux` + 26 `-windows`) the mixed-shard fixture is shaped from"
  - phase: 10-05
    provides: "a green 769-test baseline, so the 6 new failures are attributable to this plan alone"
provides:
  - "assertion-level REDs for the post-rename asset name, the reader's derivation, the cleanup filter and CORR-05 -- landed ADD-only, one commit before plan 10-07's irreversible rename"
  - "`packages/github-cache/src/lib/release-asset-name.integration.spec.ts` -- the repo's SECOND integration spec, and the first machine-dependent assertion that actually samples on Windows"
  - "D-18's named replacement clause for CORR-01's non-vacuity proof, authored BEFORE the proof it replaces is destroyed"
  - "CORR-05 stated as a positive claim, so the empty-enumeration coverage cliff is closed before the table empties"
  - "`release-asset-name.ts` in the prefix single-source map at an expected ZERO, which is what pins 'import the literal, never re-author it' after the rename"
affects: [10-07, 10-08, 10-VERIFICATION, 10-SECURITY, 10-VALIDATION]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Landing the RED half of a TDD pair as its OWN commit when the GREEN half is bound by same-commit rules -- shrinking the unrecoverable window rather than accepting it'
    - 'A SECOND import statement from an already-imported module, so an ADD-only contract is not broken by widening a specifier list'
    - 'A grep-verifiable absence criterion whose forbidden token is never spelled in the file, with a comment lock explaining the contortion'
    - 'A fixture built from a MEASURED census with its family counts locked against the measured total, so it cannot be quietly reshaped into a shard that never existed'
    - 'A within-window member of the newly-admitted family as the control separating "the filter widened" from "the filter widened and stopped honouring the age cutoff"'
    - 'Sorted set-equality on collected DELETE names, so one assertion pins both directions (nothing missing, nothing extra) on a delete path'

key-files:
  created:
    - packages/github-cache/src/lib/release-asset-name.integration.spec.ts
  modified:
    - packages/github-cache/src/lib/release-asset-name.spec.ts
    - packages/github-cache/src/backend/releases-backend.spec.ts
    - packages/github-cache/src/lib/cache-key.spec.ts
    - packages/github-cache/src/cleanup/cleanup.spec.ts
    - packages/github-cache/src/lint-rules.spec.ts

key-decisions:
  - "The new integration spec's header names its own contorted spelling and WHY. An acceptance criterion greps that exact path expecting zero occurrences of the lint-directive token, and prose alone would satisfy the grep falsely -- the trap that bit Phase 8 twice in one plan"
  - "`CACHE_OS_VALUES` entered `releases-backend.spec.ts` as a SECOND import statement rather than by widening the existing specifier list. Widening would have registered as a deletion and broken the plan's ADD-only contract, which is the whole basis for splitting this RED out of 10-07's one commit. Lint has no duplicate-import rule here -- verified, not assumed. 10-07 already rewrites that line and folds the two"
  - "`expect(CORR_05_SITES).toEqual([])` is passed DIRECTLY, not spread. The plan sanctioned a spread as a fallback if TypeScript narrowed the readonly tuple; it does not -- `toEqual<E>(expected: E)` puts no constraint on E, and line 179 of the same file already compares a typed array to `[]`. Verified by a green `typecheck`, not by inspection"
  - "The mixed-shard fixture carries TWO foreign assets, not the one the plan required. The second (`nx-cache-release-notes.md`) wears the real prefix, so it must be rejected by the NEW branch on its non-hex remainder rather than only by the legacy split. One array element buys a delete-path near-miss the plain foreign asset cannot cover"
  - "Added a within-window new-form asset the plan did not name. It is GREEN both before and after the rename, so it adds no RED -- its value is separating a correct widening from a widening that also ignores the created_at cutoff, which is data loss wearing a passing test"
  - "`scanned` is asserted as `prunable.length + 1` rather than a bare literal, because that `+1` IS the within-window control: it is the count that distinguishes 'the filter admitted the asset and the age gate held it' from 'the filter never saw it'"

requirements-completed: []
requirements-deferred:
  - id: CORR-02
    reason: "This plan authors the RED only. The rename itself lands in 10-07; four of the six failing assertions are CORR-02's target."
  - id: CORR-05
    reason: "The positive claim is authored and RED. It goes GREEN when 10-07 deletes all three `CORR_05_SITES` rows with their sites and directives. All three rows are still present and still passing at this commit -- deliberately."
  - id: RETAIN-04
    reason: "The mixed-shard dry-run is authored and RED on the new-form family. The two-branch filter is 10-07's."
  - id: RETAIN-05
    reason: "Part (a)'s census is consumed by the fixture and part (c)'s four-consumer argument is comment-locked in `cache-key.spec.ts`, but part (b)'s branch-level disjointness table CANNOT be authored here -- the two branch predicates do not exist yet and referencing them would break `typecheck`. Not ticked: 10-01 already caught `requirements mark-complete` over-ticking all three parts of this requirement."
---

# Phase 10 Plan 06: The RED for the One-Commit Rename Wave Summary

Six spec files carry the whole rename wave's expectations as assertion-level REDs, landed
ADD-only with zero deletions, so 10-07's irreversible commit is as small and as late as it
can be.

## The target end state, met exactly

| Gate | Required | Measured |
|---|---|---|
| `test` | **RED** | RED -- 6 failed / 768 passed of 774, across 4 files |
| `lint` | GREEN | GREEN (`--skip-nx-cache`) |
| `typecheck` | GREEN | GREEN (`--skip-nx-cache`) |
| `format:check` | GREEN | GREEN (`nx format:check`, no output) |
| `integration` | GREEN | GREEN -- 2 files / 4 tests, new file collected BY NAME |
| deletions | ZERO | ZERO (`6 files changed, 284 insertions(+)`) |

Baseline before the edits: **39 files / 769 tests, all passing** (`--skip-nx-cache`). After:
774 tests, so the five new test cases are fully accounted for -- three in
`release-asset-name.spec.ts`, one in `cleanup.spec.ts`, one in `lint-rules.spec.ts`. The
`releases-backend.spec.ts` and `cache-key.spec.ts` edits extended EXISTING cases and added
no titles, which is why the count rose by five rather than seven.

## The RED set, enumerated -- exactly the plan's expected set, no more and no fewer

Every one is an `AssertionError` with a per-case diff. Zero module-resolution, transform, or
import failures in the captured output (`cannot find module` / `failed to load` /
`does not provide an export` / `ERR_MODULE`: 0 matches). So every RED is **assertion-level**,
not the import-level RED Pitfall 3 warns about -- each assertion was genuinely evaluated.

| # | Failing title | Diff | Why it is RED |
|---|---|---|---|
| 1 | `releaseAssetName post-rename OS-free name (CORR-02) > produces exactly nx-cache-abc123 for hash abc123, on every OS (CORR-02)` | `expected 'abc123-windows' to be 'nx-cache-abc123'` | The helper still folds the OS discriminator into the name. Goes GREEN when CORR-02 returns `` `${CACHE_KEY_PREFIX}${hash}` `` |
| 2 | `... > produces exactly nx-cache-0 for the minimum-length hash 0 (CORR-02)` | `expected '0-windows' to be 'nx-cache-0'` | Same cause, at the minimum-length hash the cleanup accept set also pins |
| 3 | `... > folds NO member of CACHE_OS_VALUES into the name (CORR-02)` | `expected 'abc123-windows' not to contain 'windows'` | Same cause, asserted over the whole tuple so it is RED on every OS leg, not only this machine |
| 4 | `createReleasesReadBackend name derivation (TEST-05) > derives the get asset name ONLY through releaseAssetName (TEST-05)` | `expected 'abc123-windows' not to contain 'windows'` | D-18's new third clause. The pre-existing exactly-one + equality half still passes; only the added no-platform-token loop fails |
| 5 | `cleanupMirror over a MIXED shard (RETAIN-04, RETAIN-05, T-10-01) > prunes both name families and deletes neither the PoC-era family nor a foreign asset` | 72 deleted vs 76 expected; the diff names exactly `nx-cache-feed0..3` as missing | Today's single-branch filter splits on the LAST `-`, so `nx-cache-feed0`'s hash half is the string `nx-cache`, which is not hex. RETAIN-04's new branch is 10-07's |
| 6 | `every extant CORR-05 violation is caught while it still exists (LINT-03, D-22) > CORR-05 is now TRUE: zero extant ambient-platform reads remain in unit specs` | `expected [ { …(3) }, { …(3) }, { …(3) } ] to deeply equal []` | Three rows are still extant, correctly. Goes GREEN when 10-07 empties the table |

**Nothing else failed.** The plan's rule was that any other failing title is a defect in the
plan rather than an expected RED; none appeared, so nothing needed investigating.

The cleanup diff is worth reading as evidence in its own right: it lists ONLY the four
new-form names as missing and nothing as extra. That is direct proof, in the same failure,
that the 50 PoC-era `.tar.gz` assets, both foreign assets, and the within-window new-form
asset were all correctly RETAINED by today's filter -- the delete-path half of the guard is
already GREEN and only the widening is RED.

## What each edit does

**1. `release-asset-name.spec.ts` -- the post-rename pinned literals (+36).** A new describe
beside the untouched `releaseAssetName (CORR-01)` group. `'nx-cache-abc123'` and
`'nx-cache-0'` are spelled out rather than rebuilt from `CACHE_KEY_PREFIX`, and the doc block
carries that file's existing pinned-literal reasoning rather than a paraphrase of it: a
reconstructed expectation survives a separator or slot change, which is exactly the change
that silently MISSes every cross-OS Release read. Both existing described disables are
untouched.

**2. `releases-backend.spec.ts` -- D-18's named replacement (+23).** The existing
name-derivation assertion gains a third clause looping the whole `CACHE_OS_VALUES` tuple. Its
comment states the TRADE explicitly -- this clause replaces the `MISSES an OS-sensitive hash`
case that CORR-02 destroys on purpose -- so a reader sees the exchange here rather than
inferring it from a deletion in a later commit. Deliberately NOT paired with a fourth
"exactly one" guard: the array equality already pins the length.

**3. `cache-key.spec.ts` -- the prefix single-source pin (+21).** `release-asset-name.ts`
joins the authored-count `files` map at an expected 0, and the total pin stays at 1
(unchanged, verified). Green today because the module authors no prefix; it stays green after
10-07 IMPORTS the literal rather than re-authoring it, which is the property being pinned.
The widened comment names what a nonzero count would mean and records that spec files are
absent from the map on purpose and must stay absent.

**4. `release-asset-name.integration.spec.ts` (NEW, 47 lines).** Exactly two import lines
(`vitest`, and the helper under test) and one `it`. The header carries the analog's three
transferable clauses -- what is REAL here, that it is DISTINCT from the unit spec's INJECTED
platform, and that the two-leg matrix is what makes the assertion bite -- and deliberately
does NOT borrow the analog's public-surface framing, because a default argument is an
internal contract. It also states that this is the ADD half of a two-commit MOVE, and names
its own contorted spelling with the reason.

**5. `cleanup.spec.ts` -- the mixed-shard dry-run (+135).** The fixture is 50 `.tar.gz` + 46
`-linux` + 26 `-windows` (the measured census of release `354838660`, tag
`cache-mirror-202607`, with the tag named beside the counts because the shard rolls over
2026-08-01) plus 4 aged new-form assets, 1 within-window new-form asset, and 2 foreign
assets. Offline throughout -- `cleanupMirror` is pure orchestration behind the injected
`CleanupClient`, no network. Deleted NAMES are collected and compared as a sorted set, which
pins both directions in one assertion, then every retained name is checked individually
because this is a delete path.

**6. `lint-rules.spec.ts` -- CORR-05 as a positive claim (+22).** One `it` added inside the
existing enumeration describe, before the loop. The comment records that the RULE's
non-vacuity lives in `EVASION_SHAPES` rather than in this table, and that the table's
HISTORICAL doc block survives when its rows go.

## The MUST-NOTs, each verified rather than assumed

| Prohibition | Verification | Result |
|---|---|---|
| ADD-only, zero deletions | `git diff --numstat` before commit; `git show --stat` after | `284 insertions(+)`, no deletion column on any file; `git diff --diff-filter=D HEAD~1 HEAD` empty |
| The `CORR_05_SITES` row is NOT repointed | `rg` on the third row's `file:` field | Still `packages/github-cache/src/lib/release-asset-name.spec.ts` |
| All three rows still present and still matching their sites | The enumeration's 6 tests in the RED run | All 6 passed -- `lineIndexOf` never fired. Exactly 1 failure in that file, the new positive claim |
| No spec file in the authored-count map | `rg "spec\.ts':" cache-key.spec.ts` | Zero entries |
| `cache-key.spec.ts` total pin unchanged | `rg 'expect\(total\)'` | `expect(total).toBe(1);` |
| No lint directive in the new integration spec | `rg -c 'eslint-disable' <path>` (NOT `git grep` -- the file was untracked) | 0 |
| Minimal import list | `rg -c '^import' <path>` | 2 |
| No assertion referencing a not-yet-exported symbol | `typecheck` GREEN, and confirmed the new file IS in the spec program (`tsc --showConfig`, 1 match) | GREEN |
| No machine-derived OS in a unit spec | The three new unit assertions loop `CACHE_OS_VALUES`; `process.platform` appears exactly once in the new integration spec and nowhere else new | 1 occurrence, at the deliberately machine-dependent integration path |
| No bundle change | `git diff --stat -- start-cache-server/index.js` | Empty. `build:action` was NOT run; no edited file is reachable from `serve()` |
| Nothing outside spec files | `git diff --name-only` | Five spec files + one new spec file. `.planning/config.json` was already modified on arrival and was NOT staged |

## The new integration spec is genuinely sampled, not merely present

`npx nx run @op-nx/github-cache:integration --skip-nx-cache` printed the file by name:

```
 [OK] |@op-nx/github-cache:integration| src/lib/release-asset-name.integration.spec.ts (1 test) 2ms
 [OK] |@op-nx/github-cache:integration| src/server/public-server.integration.spec.ts (3 tests) 44ms

 Test Files  2 passed (2)
      Tests  4 passed (4)
```

A green integration run that never collected the new file is exactly the vacuity this move
exists to remove (T-10-16), so the collection line is the load-bearing half of that result --
not the pass. The prior run collected 1 file / 3 tests; this one collects 2 / 4.

The plan's measured claim that there is no stale-cache hazard held: the file is picked up
with no `nx.json` edit, because the merged `integration` inputs lead with `default`
(`{projectRoot}/**/*`). And it is typechecked, because `tsconfig.spec.json`'s
`src/**/*.spec.ts` glob matches an `*.integration.spec.ts` name.

## Deviations from Plan

Three additions inside the plan's stated behaviour, no rule bent. No Rule 4 escalations, no
checkpoints, no auth gates.

### Additions

**1. [Rule 2 - missing critical coverage] A second foreign asset in the mixed-shard fixture**
- **Found during:** Task 1, edit 5
- **Plan said:** "at least one unmistakably foreign asset"
- **Added:** `nx-cache-release-notes.md` alongside the plain `sbom.spdx.json`. It wears the
  real prefix, so post-rename it must be rejected by the NEW branch on its non-hex remainder
  rather than only by the legacy last-`-` split. The plain foreign asset cannot cover that
  case, and this is a DELETE path -- the one place the laziest sufficient fixture is not the
  right one. Verified retained in the RED run's diff.
- **Files:** `packages/github-cache/src/cleanup/cleanup.spec.ts`

**2. [Rule 2 - missing critical coverage] A within-window new-form asset**
- **Found during:** Task 1, edit 5
- **Added:** one `nx-cache-<hash>` asset inside the age window. It is GREEN before AND after
  the rename, so it contributes no RED. Its value is separating "the filter widened" from
  "the filter widened and stopped honouring the `created_at` cutoff" -- the second is data
  loss wearing a passing test. It is also what makes the `scanned: prunable.length + 1`
  assertion meaningful.
- **Files:** `packages/github-cache/src/cleanup/cleanup.spec.ts`

**3. [Rule 3 - blocking] `CACHE_OS_VALUES` added as a SECOND import statement**
- **Found during:** Task 1, edit 2
- **Issue:** `releases-backend.spec.ts` needs `CACHE_OS_VALUES`, but widening the existing
  `import { cachePlatform, releaseAssetName }` line would register as a deletion and break
  the plan's ADD-only contract -- the very property that legitimises splitting this RED out
  of 10-07's single commit.
- **Fix:** a separate one-line import from the same module, with a comment stating why and
  that 10-07 folds the two. Checked first that no duplicate-import rule is configured
  (`git grep` over `eslint.config.mjs` for `no-duplicate-imports` / `no-duplicates` /
  `import/order`: zero hits), then confirmed by a green `lint`.
- **Files:** `packages/github-cache/src/backend/releases-backend.spec.ts`

### Not taken

The plan sanctioned spreading `CORR_05_SITES` into a fresh array if TypeScript narrowed the
readonly tuple. It does not -- `toEqual<E>(expected: E)` puts no constraint on `E`, and line
179 of the same file already compares a typed array to `[]`. The direct form is used, and
`typecheck` proves it rather than inspection.

## TDD Gate Compliance

This plan IS the RED half of a pair whose GREEN is plan 10-07, so no RED-before-GREEN gate
applies inside it and no extra RED was manufactured. The `test(10-06)` commit is the RED gate
for the pair. The GREEN gate (`feat(10-07)`) and the same-commit rules that bind it are
10-07's.

`test` being RED at HEAD is the plan's contract, not a defect. Do NOT "fix" it by
implementing the rename here, and do NOT weaken an assertion to make it green.

## Threat Flags

None. No new network endpoint, auth path, file access pattern, or schema change at a trust
boundary -- six spec files, zero production source, zero new packages, no `package.json` or
lockfile edit. T-10-01 (the delete path over a mixed shard), T-10-16 (a vacuously passing
guard) and T-10-23 (coverage dropping silently) are the register entries this plan mitigates,
and each has its evidence in the tables above. T-10-24 (a RED-only commit that breaks `lint`
and blocks the wave) is mitigated by the green `lint` at HEAD.

## Handoff to plan 10-07

Six titles must flip from RED to GREEN, and nothing else may change colour. Table 2 above is
that target, verbatim -- each row names its current diff, so a GREEN that arrives for the
wrong reason is detectable.

The deletions this plan deliberately left undone, all belonging to 10-07's single commit:

- `release-asset-name.spec.ts`: the four two-argument `releaseAssetName (CORR-01)` cases and
  the round-trip's two-arg calls; the `cachePlatform` default-argument case with its
  directive (its ADD half is already committed here).
- `releases-backend.spec.ts`: `OTHER_PLATFORM` with its directive, the `MISSES an
  OS-sensitive hash` case, and the two two-argument call sites. Fold the two import
  statements while rewriting that line.
- `lint-rules.spec.ts`: all three `CORR_05_SITES` rows. Do NOT repoint the third at the new
  integration path -- LINT-02 exempts that path, so the row's caught-when-stripped test would
  get an empty rule list and go RED on a CORRECT implementation. Preserve the HISTORICAL doc
  block.
- Non-spec prose 10-07 also owns (research C-5, Pitfall 7): `test/workspace-root-cwd.ts:38`'s
  stale two-argument signature and `dogfood-body.ts:19`'s contrast case, whose contrast
  disappears with the defaulted parameter.

## Self-Check: PASSED

Created file exists:

- `packages/github-cache/src/lib/release-asset-name.integration.spec.ts` -- FOUND (tracked as
  of `8fc9b64`, `create mode 100644`)

Commit exists:

- `8fc9b64` -- FOUND (`test(10-06): add the failing post-rename name, filter and CORR-05
  guards`, 6 files changed, 284 insertions(+), 0 deletions)

Claim spot-checks:

- `test` RED with 6 failures, all `AssertionError` -- FOUND in the captured run
- `lint` / `typecheck` / `format:check` / `integration` GREEN -- all four re-run with
  `--skip-nx-cache` where the target supports it (Pitfall 4: Phase 9 measured a stale
  `Cache: 2/2 hit` PASS on exactly this spec-only-edit path)
- Zero deletions -- FOUND (`git show --stat`, and `git diff --diff-filter=D HEAD~1 HEAD`
  empty)
