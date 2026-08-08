---
phase: 10-os-invariant-releases-mirror
plan: 07
subsystem: naming
tags:
  [corr-02, corr-05, retain-04, retain-05, robust-04, lint-06, single-commit, green]
status: complete

# Dependency graph
requires:
  - phase: 10-06
    provides: 'the six assertion-level REDs this plan flips, each with its pre-rename diff recorded so a GREEN arriving for the wrong reason is detectable'
  - phase: 10-01
    provides: 'the measured 122-asset shard census (50 `.tar.gz` + 46 `-linux` + 26 `-windows`) the legacy filter branch must keep prunable'
  - phase: 10-02
    provides: "the `mirrored-by` Release label -- attribution had already MOVED before the name's OS token was removed, so attribution never lapses"
  - phase: 10-05
    provides: 'the `feed<index><run_id>` publish seed, which appears in the adversarial table under the new name'
provides:
  - '`releaseAssetName(hash)` -- one asset name per hash, no OS component, prefix imported and never re-authored'
  - '`isCurrentAssetName` / `isLegacyOsSuffixedAssetName` -- two exported branch predicates composed in one accept filter, so RETAIN-05(b) has two subjects to assert disjointness over'
  - "`CACHE_KEY_PREFIX`'s comment lock widened to four named consumers plus the orphaning consequence"
  - 'CORR-05 TRUE: zero extant ambient-platform reads in unit specs, stated positively rather than by an enumeration that emits nothing'
  - 'a rebuilt `start-cache-server/index.js` whose diff was predicted and then checked in the main tree'
affects: [10-08, 10-VERIFICATION, 10-SECURITY, 10-VALIDATION, 11]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Two separately named EXPORTED branch predicates composed in one exported filter, so a widened DELETE path is auditable branch by branch and disjointness is assertable DIRECTLY rather than through the union'
    - 'Comment-locking a disjointness MECHANISM as executable atoms (three one-line facts plus a composed argument), so a prefix edit that breaks the reasoning reddens at the explanation rather than only in whichever adversarial row happens to cover it'
    - 'Pinning an adversarial table ROW COUNT alongside the property it proves, because a per-row loop over a shortened table still passes'
    - 'A both-true COUNT over the whole table in addition to per-row assertions, so a silently dropped row cannot shrink the proof unnoticed'
    - 'Deleting dead enumeration machinery WITH its rows rather than leaving it over an empty array -- zero tests reported as coverage is worse than absent coverage'
    - 'Refusing an absence check where the corrected comment DELIBERATELY QUOTES its own superseded figures: a `forbidden` pattern over the old numbers would redden on the correct implementation'
    - 'Predicting a generated-bundle diff in the plan and then CHECKING the observed shape against it, so a legitimate tree-shake removal is not read as collateral damage'

key-files:
  created: []
  modified:
    - packages/github-cache/src/lib/release-asset-name.ts
    - packages/github-cache/src/lib/release-asset-name.spec.ts
    - packages/github-cache/src/lib/cache-key.ts
    - packages/github-cache/src/lib/dogfood-body.ts
    - packages/github-cache/src/backend/releases-backend.ts
    - packages/github-cache/src/backend/releases-backend.spec.ts
    - packages/github-cache/src/cleanup/cleanup.ts
    - packages/github-cache/src/publish/publish-mirror.ts
    - packages/github-cache/src/publish/publish-mirror.spec.ts
    - packages/github-cache/src/lint-rules.spec.ts
    - packages/github-cache/src/test/workspace-root-cwd.ts
    - packages/github-cache/src/docs-same-os-claims.spec.ts
    - .github/workflows/ci.yml
    - start-cache-server/index.js

key-decisions:
  - "The `releaseAssetName (CORR-01)` describe was RETITLED to `releaseAssetName determinism and injectivity (CORR-02)`, not just re-authored case by case. A describe naming a requirement whose claim the commit deletes is stale prose of exactly the class this phase sweeps, and the two surviving cases assert CORR-02 properties now. The plan asked for re-authored cases and did not mention the title; leaving it would have been the narrower literal reading and the worse outcome."
  - "The deleted `differs for the same hash under a different platform` case was replaced by INJECTIVITY over the hash (`abc123` vs `abc124`), not dropped. With the OS gone the hash is the only thing separating two assets, so collision freedom rests entirely there -- a name ignoring part of the hash would serve one task's archive for another and the byte comparison would pass."
  - "A sixth `releaseAssetName` consumer that research C-5 did not enumerate: `publish-mirror.spec.ts` asserted `name.startsWith(\\`<hash>-\\`)`. C-5 enumerated CALLS and found all eight in that file single-arg and surviving; this is a shape assertion on the RESULT. Re-authored to `endsWith(HASH)` plus a length guard -- the surviving structural fact -- rather than deleted, so the case still tells 'derived through the helper' apart from 'happens to equal what the helper returns today'."
  - '`readFileSync` and the two enumeration helpers (`readSiteLines`, `lineIndexOf`) left `lint-rules.spec.ts` with the rows. Keeping them would have been dead machinery over an empty table: it reads as coverage, reports zero tests, and cannot fail. `lint` caught the unused import, which is the LINT-06 mechanism working one level up from the directives it was built for.'
  - "The new `DOCS_08_SITES` row carries `forbidden: []` for a reason the other empty rows do NOT share. The corrected `ci.yml` comment deliberately QUOTES its own superseded figures in the correction-history paragraph, so a forbidden pattern over the old numbers would redden on the CORRECT implementation -- the very record that makes the correction auditable is what the absence check would forbid."
  - "The `EDITED_FILES` comment's own instruction was not followed by the plan that created the integration spec (10-06 landed it ADD-only, one commit ahead), so the entry lands here with a one-commit lag. Recorded as a lag rather than papered over: the instruction is still right for the next file."
  - "Warning 6 in the dispatch brief was STALE. `ci.yml`'s `publish-verify` job comment was already CLOSED under D-21 by an earlier plan in this phase, and `read-back.ts:367` carries the closure record rather than an outstanding instruction. Verified before acting rather than re-correcting an already-correct comment."

metrics:
  duration: ~19 min
  tasks_completed: 3
  files_modified: 14
  commits: 1
  tests_before: 774 (6 failing)
  tests_after: 818 (0 failing)

requirements-completed: [CORR-02, CORR-05, RETAIN-04, RETAIN-05]
requirements-deferred: []
---

# Phase 10 Plan 07: The One-Commit Rename Wave Summary

The Releases namespace is now one asset name per hash, and every change that collapse
forced landed in the same commit -- `77f675c`, 14 files, 688 insertions / 323 deletions.

## Plan-start SHA and the one-commit proof

| Check | Result |
| --- | --- |
| Plan-start SHA | `b37a35888fa6ad1520a29118a1972971f3a8df7a` |
| `git rev-list --count <plan-start>..HEAD` | **1** |
| Commit | `77f675c feat(10-07): collapse the Releases namespace to one asset name per hash` |
| Commit mechanism | `git commit -F <file>` (`-m` fails EINVAL on `COMMIT_EDITMSG` on this ReFS Dev Drive) |
| Staging | `git add <explicit path>` only -- no `.`, `-A`, `-u` at any point |
| `.planning/config.json` | modified on arrival, **never staged** (verified in `git status --short` before committing) |
| Whole-file deletions | none (`git diff --diff-filter=D HEAD~1 HEAD` empty) |
| Untracked left behind | none |

## The six REDs from plan 10-06, each confirmed green

Plan 10-06's handoff table is the target verbatim. Every one flipped, and **nothing
else changed status** -- the run went from 774 tests / 6 failing to 818 / 0 failing.

| # | Title | Now |
| --- | --- | --- |
| 1 | `releaseAssetName post-rename OS-free name (CORR-02) > produces exactly nx-cache-abc123 for hash abc123, on every OS (CORR-02)` | PASS |
| 2 | `... > produces exactly nx-cache-0 for the minimum-length hash 0 (CORR-02)` | PASS |
| 3 | `... > folds NO member of CACHE_OS_VALUES into the name (CORR-02)` | PASS |
| 4 | `createReleasesReadBackend name derivation (TEST-05) > derives the get asset name ONLY through releaseAssetName (TEST-05)` | PASS |
| 5 | `cleanupMirror over a MIXED shard (RETAIN-04, RETAIN-05, T-10-01) > prunes both name families and deletes neither the PoC-era family nor a foreign asset` | PASS |
| 6 | `every extant CORR-05 violation is caught while it still exists (LINT-03, D-22) > CORR-05 is now TRUE: zero extant ambient-platform reads remain in unit specs` | PASS |

Titles 5 and 6 were re-confirmed by name in a verbose run rather than inferred from
the aggregate count. Titles 1-4 are additionally confirmed live by the mutation checks
below, which reddened them on demand -- a title that no longer existed could not have.

The +44 test delta: 26 adversarial-table rows, the row-count pin, the both-true count
pin, the branch-non-dead check, 5 mechanism/atom cases, the arity pin, 7 extended
accept/reject entries, 6 new `DOCS_08_SITES` phrase assertions and 1 `EDITED_FILES`
entry, less the 5 cases deleted with their sites.

## The full battery at HEAD

| Gate | Result |
| --- | --- |
| `npm run test` (`--skip-nx-cache`) | GREEN -- 39 files / **818 tests** |
| `npm run typecheck` | GREEN |
| `npm run lint` | GREEN |
| `npm run format:check` | GREEN |
| `npm run integration` (`--skip-nx-cache`) | GREEN -- 2 files / 4 tests |
| `npm run check:action` | GREEN (after the rebuilt bundle was staged) |
| `npm run fallow:ci` | GREEN -- `No issues found`, 59 entry points |

`release-asset-name.integration.spec.ts` was **collected by name**, not merely counted:

```
[OK] |@op-nx/github-cache:integration| src/lib/release-asset-name.integration.spec.ts (1 test) 2ms
[OK] |@op-nx/github-cache:integration| src/server/public-server.integration.spec.ts (3 tests) 48ms
```

`fallow:ci` is the gate that mattered most here and it is clean: two new exports
reached only from a spec import, plus two intentionally-kept survivors, are exactly the
shapes `fallow dead-code --fail-on-issues` reports.

## The main-tree precondition, confirmed BEFORE the bundle step

| Probe | Output |
| --- | --- |
| `git rev-parse --show-toplevel` | `D:/projects/github/op-nx/github-cache` |
| `git worktree list` | one line only -- `D:/projects/github/op-nx/github-cache b37a358 [gsd/v0.0.2-os-invariant-cross-os-sharing]` |
| `.git` type | **directory** (`d`), not the file a linked worktree carries |
| `node_modules` link check | `lstatSync(...).isSymbolicLink()` -> **false**, a real directory |

The last probe is the load-bearing one. Node reports a Windows junction as a symlink,
so a `false` here rules out the junction that made esbuild rewrite 689 module paths
with no source edit -- the inverse fault with an identical symptom. The bundle verdict
is therefore genuine, not deferred.

## The bundle diff: PREDICTION beside OBSERVATION

| Predicted | Observed | Match |
| --- | --- | --- |
| the helper's one-line body changes | `return \`${hash}-${cachePlatform(platform2)}\`` -> `return \`${CACHE_KEY_PREFIX}${hash}\`` | yes |
| `cachePlatform` REMOVED (~10 lines) -- nothing in the `serve()` graph calls it after the rewrite | removed, 9 lines | yes |
| the two new predicates do NOT appear | absent | yes |
| roughly a dozen changed lines | `13 ++-----------` = **2 insertions, 11 deletions** | yes |
| ZERO `__commonJS` registrations changed | 0 matches for `__commonJS` in the diff | yes |
| `cache-key.ts`'s comment-only edit contributes ZERO lines | 0 | yes |

The whole diff, verbatim -- one hunk, one module:

```
@@ -68483,17 +68483,8 @@ function statusOf(error2) {
 // packages/github-cache/src/lib/release-asset-name.ts
-function cachePlatform(platform2 = process.platform) { ... }        (9 lines)
-function releaseAssetName(hash, platform2 = process.platform) {
-  return `${hash}-${cachePlatform(platform2)}`;
+function releaseAssetName(hash) {
+  return `${CACHE_KEY_PREFIX}${hash}`;
 }
```

**No divergence to explain.** `cachePlatform`'s removal is a legitimate tree-shake --
it survives in source with an intentionally-kept annotation for the `mirrored-by`
label, which is built in `publish-mirror.ts` and is not on the `serve()` path. Its
disappearance from the bundle is exactly the evidence the plan predicted it would be:
esbuild prunes unused exports from this module, which is also why the two new branch
predicates never appear.

## Mutation checks -- predicted, then observed, run AFTER the commit landed

Run against COMMITTED work on purpose (plan 10-02 lost an uncommitted GREEN edit to a
`git checkout --` revert; here that would have cost the whole staged wave). Each was
reverted with `git checkout -- <file>` and the tree re-verified clean at 818 GREEN.

**1. Drop the prefix (`return \`${hash}\``).** Predicted: the pinned-literal cases
redden; the reader-derivation EQUALITY clause stays GREEN because it rebuilds from the
helper. **Observed: 8 RED** -- both pinned literals, the producer/accepter round-trip,
the MECHANISM composition, `publish-mirror.spec.ts`'s derivation case, and 3
`mirror-seed.spec.ts` seed-path validators. `releases-backend.spec.ts`'s
`derives the get asset name ONLY through releaseAssetName (TEST-05)` **stayed GREEN**.
That contrast is the whole justification for the hand-authored literal: the derivation
guard is structurally blind to a prefix change because it rebuilds the expectation from
the same helper, so only a spelled-out literal catches it.

**2. Re-add the OS token (`...${hash}-${cachePlatform()}`).** Predicted: the
no-platform-token clause reddens while the exactly-one and equality clauses stay GREEN.
**Observed: 10 RED**, including `folds NO member of CACHE_OS_VALUES into the name` and
the `TEST-05` derivation case -- whose third clause is D-18's named replacement for the
proof CORR-02 destroyed, so the replacement is confirmed to bite. The **arity pin
stayed GREEN**, as predicted: `cachePlatform()` takes no arguments, so
`releaseAssetName.length` is still 1. The two guards catch different mutations and
neither subsumes the other.

**3. Composed filter reduced to branch A only.** Predicted: the legacy accept cases
redden; the disjointness table stays GREEN. **Observed: 11 RED** -- all four legacy
accept cases, the branch-non-dead union check, and six `cleanup.spec.ts` cases whose
fixtures use the legacy shape. **All 26 `NOT both branches accept` rows and the
both-true count stayed GREEN**, exactly as predicted, because they assert on the two
branch predicates directly rather than through the composition. The table proves
disjointness; the accept set proves the union. Neither could substitute for the other.

**4. Composed filter as A AND B.** Predicted: every accept case reddens. **Observed:
19 RED, and all EIGHT accept cases are among them** (four current-shape, four legacy).

## What each edit does

**1. `release-asset-name.ts` -- the name, the two branches, the survivors.**
`releaseAssetName(hash)` composes `CACHE_KEY_PREFIX` imported from `cache-key.ts`;
`rg -c "'nx-cache-'"` on this file returns **0** and `CACHE_KEY_PREFIX` appears 5
times, so the literal is single-sourced by construction rather than by convention. The
doc block's OS-namespacing claim -- including the false "a read on platform P can only
resolve an asset produced under platform P" -- is replaced with the one-name-per-hash
contract, where attribution went (Release `label` metadata, which landed in 10-02
BEFORE this commit, so attribution never lapsed), the unchanged failure mode (a silent
MISS, not a crash), and the named tidy-up refusal: folding into `cacheKeyFor` would
couple the Actions-cache KEY namespace to the Release ASSET namespace.

`isServerProducedAssetName` is now `isCurrentAssetName(name) ||
isLegacyOsSuffixedAssetName(name)`, both branches exported. `rg -c '^export function
is'` returns **3**. The legacy branch is the pre-rename body preserved verbatim,
`separator < 0` early return included -- that return is load-bearing, being the second
independent disjointness reason. The new branch's doc block states it is NOT aliased to
`isServerProducedKey` despite an identical body shape, because "these two are the same,
tidy them together" is what a future reader will propose. `cachePlatform` and
`CACHE_OS_VALUES` both survive with intentionally-kept annotations naming DIFFERENT
live consumers -- the label for the mapper, the legacy filter branch for the tuple.
RETAIN-04 names only the tuple; the mapper needed the same annotation for the same
reason and no requirement says so.

**2. `cache-key.ts` -- the widened lock.** Names all four governed consumers with their
locations, states that 3 is deliberately not folded into 1 and 4 not into 2, and adds
the consequence: changing the literal **orphans the entire mirror** -- consumers 3 and
4 stop resolving and stop pruning at the same instant, and the legacy filter branch does
**not** cover the orphans because it only knows the pre-CORR-02 `<hash>-<os>` shape, so
those assets would be prunable by neither branch. `rg -c 'orphan'` returns 1.

**3. `release-asset-name.spec.ts` -- the RETAIN-05(b) proof.** Three structural atoms
(`HASH_PATTERN` rejects a lone dash; the prefix contains a dash; that dash is its last
character), then the two mechanism reasons as executable arguments, then the 26-row
adversarial table with `expect(ADVERSARIAL_NAMES).toHaveLength(26)`, a per-row
`!(A && B)`, and a both-true count pinned to `[]`. A fourth case asserts each branch
accepts a nonempty slice and the union length equals the sum -- non-vacuity, since a
table both branches rejected entirely would satisfy every disjointness assertion above.
The two CORR-05 sites in this file left with their directives, and the arity pin was
added (`releaseAssetName.length === 1`).

**4. `releases-backend.spec.ts` / `.ts`.** `OTHER_PLATFORM` and `SENSITIVE_HASH` left
with the directive. The cross-OS MISS case was deleted with a comment at the deletion
site recording what was removed, why it became **unstateable** rather than merely
weaker (it would seed the very asset it then asserts is absent), and where its
replacement lives. The positive HIT case was re-authored: with one name per hash there
is no second name to pick between, so the read HITs where it previously MISSED -- which
is the requirement's payoff stated as a test. Both stale doc claims in the source
carry replacement reasons: the seam now proves DERIVATION rather than the cross-OS
boundary, and `get` resolves the hash's one name rather than the running platform's
asset, with the consequence named (this reader can serve bytes another OS mirrored, safe
only because VER-01/VER-03 made the archive OS-invariant).

**5. `lint-rules.spec.ts` -- CORR-05 closed.** All three rows deleted; the table is
`[] as const`. The dead enumeration over it went too, with the reason recorded. The
HISTORICAL block is preserved (`rg -c 'HISTORICAL'` = 3) and the count statement now
records the table is EMPTY, that CORR-05 is TRUE, and that the rule's non-vacuity lives
in `EVASION_SHAPES` -- without that sentence a reader finds an empty table and concludes
the rule is unproven. **`EVASION_SHAPES` is untouched**: every diff hunk in this file
is at line >= 705 (plus line 1, the import), and `EVASION_SHAPES` spans 353-503 with
drivers at 504-513 and 524-535.

**6. `cleanup.ts`.** The call-site comment names BOTH families, states the widening is
ADDITIVE, and keeps the existing discipline clauses in force verbatim -- a foreign asset
in a genuine shard is never deleted as ours, no third branch for the PoC-era family, and
the check stays the first statement in the loop so `scanned` means what it says.

**7. `publish-mirror.ts` -- BOTH byte-identity justifications.** `rg -c
'byte-identical'` returns 4 across the two rewritten sites. The engine doc block and the
in-loop first-write-wins branch each now state the one-entry-per-hash reason
independently, rather than the second pointing at the first -- the in-loop comment is
where a reader lands when they ask "why is skipping safe HERE". Both record that
byte-identity SURVIVES with a CHANGED reason and that the real race needs a second
producer (T-10-04, a later phase's write decision). Catching only the doc block would
have been the exact documentation-scoped-sweep failure Phase 9 shipped.

**8. The prose sweep.** `dogfood-body.ts`'s no-default rule now stands on its own
ground (a default would let the verify leg silently compare against ITSELF) instead of
by contrast with a deleted signature, and notes the sibling is now pinned by the same
`Function.length` mechanism for the opposite reason. `test/workspace-root-cwd.ts`'s
LOCK 2 injection example is replaced with three live ones (`selectBackend(env)`,
`createReleasesReadBackend(client)`, `cleanupMirror(client, options)`).
`rg -c 'releaseAssetName\(hash, platfor[m]' packages/github-cache/src` returns **0** --
the single-character character class is load-bearing, so this criterion does not plant
what it forbids.

**9. `ci.yml` -- the estimate's THIRD correction, DOWNWARD.** Records both prior
corrections by name and direction (upward in Phase 9 because each leg mirrored every
restorable hash under its own suffix; downward here because the suffix is gone), shows
the arithmetic from the estimate's own inputs (~5 real assets + ~3 run_id seeds = ~8
per push; 1000 / 8 = ~125 pushes per shard, roughly double Phase 9's ~75), and carries
the carve-out: **the Windows leg still mirrors exactly ONE real asset**, its own seed
plus its `integration` hash when ubuntu's enumeration snapshot predates it (measured on
run `30400231720`). So `publish (windows)` reports a small nonzero `mirrored`, the
all-restore-MISS warning will not fire, and that seed is precisely what OBS-05 reads
back -- which is why "zero assets" is the wrong summary and "zero DUPLICATE assets" is
the right one.

**10. `docs-same-os-claims.spec.ts`.** A new `DOCS_08_SITES` row requiring the corrected
figures, the arithmetic, the third-correction record and the Windows carve-out. All six
phrases were checked to fit on ONE line of `ci.yml` before committing (`rg -cF` returned
1 for each) -- a phrase spanning a hard wrap matches nothing and would be a silent false
PASS in the additive direction. `EDITED_FILES` gains the integration spec, and every
path in it resolves on disk (proved by the suite passing: `read()` is a `readFileSync`
that throws on a missing path).

## CORR-05 verification: zero surviving directives

`rg -n 'eslint-disable-next-line no-restricted-syntax' packages/github-cache/src` now
returns **nothing**. There are no survivors to attribute to other requirements -- the
ban's remaining proof is `EVASION_SHAPES`, which drives synthetic fixtures rather than
extant sites.

One subtlety handled rather than shipped: the comment recording `OTHER_PLATFORM`'s
deletion originally spelled that token in full, which would have returned an `rg` hit
indistinguishable from a live violation for anyone verifying CORR-05 the documented
way. It carries the single-character character-class contortion now, with a note saying
why, following `docs-same-os-claims.spec.ts`'s precedent. `lint` passing under
`reportUnusedDisableDirectives: 'error'` independently proves ESLint does not read it as
a directive (a directive keyword must lead the comment).

## Requirements: what is actually true now

Verified individually rather than trusting `requirements mark-complete`, which plan
10-01 caught over-ticking all three parts of RETAIN-05.

| Req | Status | Evidence |
| --- | --- | --- |
| CORR-02 | **TRUE** | `releaseAssetName(hash)` returns prefix + hash, arity pinned at 1, zero authored prefix copies, no `CACHE_OS_VALUES` member in the name |
| CORR-05 | **TRUE** | all three sites, directives and rows gone; zero surviving directives repo-wide; the claim stated positively, not by an empty enumeration |
| RETAIN-04 | **TRUE** | two-branch filter shipped in the same commit as the rename; mixed-shard dry-run prunes both families and retains the PoC-era and foreign assets |
| RETAIN-05 | **TRUE, all three parts** | (a) the 122-asset census is consumed by the fixture with its family counts locked; (b) disjointness asserted directly over 26 rows with the both-true count at 0, plus both mechanism reasons; (c) the four-consumer lock names all four plus the orphaning consequence |

## Deviations from Plan

Four, all inside the plan's stated intent. No Rule 4 escalations, no checkpoints, no
auth gates.

### Auto-fixed

**1. [Rule 1 - Bug] A sixth `releaseAssetName` consumer that research C-5 missed**

- **Found during:** Task 2, at the first full `test` run (1 failure out of 811)
- **Issue:** `publish-mirror.spec.ts:178` asserted `name.startsWith(\`${HASH}-\`)`.
  Research C-5 enumerated `releaseAssetName` CALLS and correctly found all eight in
  that file single-arg and surviving. This is not a call -- it is a shape assertion on
  the RESULT, pinning the deleted `<hash>-<os>` layout. Same class of miss as the stale
  prose this phase sweeps, one abstraction level over.
- **Fix:** re-authored to `endsWith(HASH)` plus `length > HASH.length` -- the surviving
  structural fact (the hash is the suffix under a prefix). Deleting it would have left
  the case unable to tell "derived through the helper" from "happens to equal what the
  helper returns today", which was the clause's whole job.
- **File:** `packages/github-cache/src/publish/publish-mirror.spec.ts`
- **This is the 14th file, one beyond the plan's 13.** Not scope creep: it is a test the
  plan's own change breaks, so it had to land in the same commit or the wave stays red.

**2. [Rule 3 - Blocking] `readFileSync` unused after the enumeration left**

- **Found during:** Task 2, at `npm run lint`
- **Issue:** `readSiteLines` was `readFileSync`'s only consumer in `lint-rules.spec.ts`.
- **Fix:** import removed, with a comment recording that it left with the rows. Worth
  noting as evidence rather than noise: this is LINT-06's mechanism firing one level up
  from the directives it was built for -- deleting a violation site leaves debris, and
  the lint gate finds it in the same commit.
- **File:** `packages/github-cache/src/lint-rules.spec.ts`

**3. [Rule 2 - Missing critical coverage] The union / branch-non-dead assertion**

- **Found during:** Task 1
- **Added:** a case asserting each branch accepts a nonempty slice of the adversarial
  table and that the union's length equals the sum of the two.
- **Why:** every disjointness assertion in that describe is satisfied by a table where
  BOTH branches reject everything. The plan required the both-true count pinned to 0 and
  did not require its non-vacuity companion. Mutation 3 confirms it earns its place --
  it is one of the 11 RED when the composed filter loses branch B.
- **File:** `packages/github-cache/src/lib/release-asset-name.spec.ts`

**4. [Rule 2 - Stale prose] A describe title naming a deleted requirement's claim**

- **Found during:** Task 1
- **Issue:** the plan asked for the four `releaseAssetName (CORR-01)` cases to be
  re-authored and said nothing about the describe title, which named CORR-01 -- the
  OS-namespaced-name requirement this commit deletes.
- **Fix:** retitled to `releaseAssetName determinism and injectivity (CORR-02)`. The
  narrower literal reading would have left a describe advertising a claim its own cases
  no longer make, which is the stale-prose class this phase exists to sweep.
- **File:** `packages/github-cache/src/lib/release-asset-name.spec.ts`

### Not needed

The dispatch brief's warning 6 said `ci.yml`'s `publish-verify` job comment was the half
Phase 9 deferred to this phase. **Already closed** under D-21 by an earlier plan:
`read-back.ts:367` reads "`ci.yml`'s `publish-verify` JOB COMMENT: CLOSED (D-21), and
this is the record rather than an outstanding instruction", and
`docs-same-os-claims.spec.ts` already carries the row locking the corrected text.
Verified before acting rather than re-correcting a correct comment. The plan's own
`files` list for task 3 named only the shard-growth estimate for `ci.yml`, which is
consistent -- the brief's warning was the stale artifact, not the plan.

## The five same-commit rules, each satisfied

| Rule | Satisfied by |
| --- | --- |
| RETAIN-04 with CORR-02 | both branches and the rename in `77f675c`; the mixed-shard dry-run is green in the same commit |
| RETAIN-05 same-commit | (b)'s table needs both predicates to exist; (c)'s four-consumer lock needs the asset name to BE the fourth consumer |
| D-20's comment reason change | both byte-identity sites rewritten in the same commit that invalidates the old reason |
| LINT-06 | every violation and its directive in one edit; `lint` GREEN proves no directive outlived its violation |
| ROBUST-04 | `build:action` run in the main tree, diff predicted then checked, `start-cache-server/index.js` IN the commit, `check:action` GREEN |

## Threat Flags

None. No new network endpoint, no new auth path, no new file-access pattern, no schema
change at a trust boundary. Zero new packages and no `package.json` or lockfile edit --
which is also why the bundle diff cannot be attributed to a dependency re-resolution,
making any unexpected diff a pure source-or-tree signal (T-10-SC).

Register entries this commit mitigates, each with evidence above: **T-10-01** (the
widened DELETE path -- two named branches from single-sourced constants, the legacy
branch verbatim, disjointness asserted directly over 26 rows with the mechanism, and the
mixed-shard dry-run proving a foreign asset is never deleted as ours); **T-10-25** (a
stale bundle -- main-tree precondition confirmed first, diff predicted then checked);
**T-10-26** (`CACHE_KEY_PREFIX` quadruply load-bearing -- authored count pinned at zero
for this module, comment lock naming all four consumers plus the orphaning consequence
including that the legacy branch does NOT cover the orphans); **T-10-16** (a vacuously
passing guard -- four mutation checks with predicted redness splits, all observed; the
destroyed non-vacuity proof's replacement confirmed to bite under mutation 2; the
emptied table replaced by a positive assertion).

**T-10-27** (attribution loss) is mitigated by sequencing rather than by this commit's
code: the `mirrored-by` label landed in 10-02, one wave earlier, so attribution never
lapsed. **T-10-05** (the anonymously-readable mirror) and **T-10-04** (first-write-wins
over non-identical payloads) remain ACCEPTED and are offered as INPUT to TRUST-12's and
TRUST-11's classification, never as their conclusion.

## Human-needed: LIVE CI, push-to-`main` only

Unchanged from the plan and not closable pre-merge -- `publish` is `push`-gated to
`main`, so no PR run reaches it. A real runner must show:

- the ubuntu `publish` leg's OBS-01 summary with a **nonzero `mirrored`**, `readMisses`
  at 0, and NO all-restore-MISS warning. Predicted: every name is new, so `mirrored` is
  roughly the full restorable set.
- a post-push shard census showing `nx-cache-*` names present and legacy OS-suffixed
  names no longer growing.
- `publish (windows)` reporting a **small nonzero `mirrored`, not 0** (its own seed, plus
  its `integration` hash when ubuntu's snapshot predates it). The all-restore-MISS
  warning requires `mirrored === 0` and must not fire.

Phase 9's rotation window is SPENT (sampled on run `30400231720`), and CORR-02 rotates
the ASSET NAME -- a different mechanism from the cache VERSION that warning concerns --
so a full republish is the prediction. **If the ubuntu leg instead reports `mirrored: 0`
with `readMisses` equal to `scanned`, that prediction is FALSIFIED and must be recorded
as such rather than explained away.**

## Self-Check: PASSED

Commit exists:

- `77f675c` -- FOUND (`git show --name-only`: 14 files, 688 insertions / 323 deletions)
- `git rev-list --count b37a3588..HEAD` -- **1**, so exactly one commit came from this plan

All 13 files the plan lists as modified are IN that commit, plus the one documented
Rule 1 addition:

| File | In `77f675c` |
| --- | --- |
| `packages/github-cache/src/lib/release-asset-name.ts` | yes |
| `packages/github-cache/src/lib/release-asset-name.spec.ts` | yes |
| `packages/github-cache/src/lib/cache-key.ts` | yes |
| `packages/github-cache/src/lib/dogfood-body.ts` | yes |
| `packages/github-cache/src/backend/releases-backend.ts` | yes |
| `packages/github-cache/src/backend/releases-backend.spec.ts` | yes |
| `packages/github-cache/src/cleanup/cleanup.ts` | yes |
| `packages/github-cache/src/publish/publish-mirror.ts` | yes |
| `packages/github-cache/src/lint-rules.spec.ts` | yes |
| `packages/github-cache/src/test/workspace-root-cwd.ts` | yes |
| `packages/github-cache/src/docs-same-os-claims.spec.ts` | yes |
| `.github/workflows/ci.yml` | yes |
| `start-cache-server/index.js` | yes |
| `packages/github-cache/src/publish/publish-mirror.spec.ts` | yes (Rule 1, documented) |

Claim spot-checks, each re-run at HEAD after the mutations were reverted:

- `test` 818/818, `typecheck`, `lint`, `format:check`, `integration`, `check:action`,
  `fallow:ci` -- all GREEN, with `--skip-nx-cache` on the vitest targets (Phase 9
  measured a stale `Cache: 2/2 hit` PASS on exactly this spec-edit path)
- working tree clean apart from `.planning/config.json`, which arrived modified and was
  never staged
- all four mutations reverted; `git status --short` shows no residue in
  `release-asset-name.ts`
- No `grep` or the Grep tool used anywhere; `rg` for untracked/absence claims, and no
  absence criterion spells the token it forbids
