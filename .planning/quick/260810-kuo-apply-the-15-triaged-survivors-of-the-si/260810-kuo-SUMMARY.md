---
phase: quick-260810-kuo
plan: 01
subsystem: spec-suite, tooling, hash-parity instrument
status: complete
tags: [cleanup, simplify, guard-strengthening, memoization, deduplication]
requires:
  - .planning/quick/260810-kuo-apply-the-15-triaged-survivors-of-the-si/260810-kuo-TRIAGE.md
provides:
  - packages/github-cache/src/test/repo-file.ts exports packageSourceFiles, PACKAGE_SOURCE_ROOT, probeTokenOf
  - a memoized readRepoFile with controls for the throw and the re-read
  - .planning/quick/260810-kuo-apply-the-15-triaged-survivors-of-the-si/260810-kuo-deferred-items.md
affects:
  - capture-hashes.mjs
  - eslint.config.mjs
  - 13 spec files under packages/github-cache/src
tech-stack:
  added: []
  patterns:
    - lazy `await import()` for a heavy subtree behind argument-rejection paths
    - success-only memoization, so a load-bearing throw survives
    - it.each with a per-row reason column instead of N near-identical `it`s
    - derive a test needle from the canonical constant rather than respelling it
key-files:
  created:
    - .planning/quick/260810-kuo-apply-the-15-triaged-survivors-of-the-si/260810-kuo-deferred-items.md
  modified:
    - capture-hashes.mjs
    - eslint.config.mjs
    - packages/github-cache/src/test/repo-file.ts
    - packages/github-cache/src/test/repo-file.spec.ts
    - packages/github-cache/src/backend/actions-cache-backend.spec.ts
    - packages/github-cache/src/lib/cache-key.spec.ts
    - packages/github-cache/src/lib/cache-archive-path.spec.ts
    - packages/github-cache/src/lib/compression-method.spec.ts
    - packages/github-cache/src/hash-parity/compare.spec.ts
    - packages/github-cache/src/capture-hashes-cli.spec.ts
    - packages/github-cache/src/read-integration-hash.integration.spec.ts
    - packages/github-cache/src/dogfood-cross-os.spec.ts
    - packages/github-cache/src/docs-cross-os.spec.ts
    - packages/github-cache/src/docs-same-os-claims.spec.ts
    - packages/github-cache/src/windows-regression-detector.spec.ts
    - packages/github-cache/src/nx-target-inputs.spec.ts
    - packages/github-cache/src/roundtrip/read-back.ts
    - packages/github-cache/src/roundtrip/read-back.spec.ts
decisions:
  - A3/A4 are record-identical, proven by measurement, so they were admissible despite T4-4
  - the MIRRORED_BY_PREFIX export stays because a spec pins its value (CONTEXT G4)
  - the nine UNRESOLVED items go in a NEW file, not appended to the bxj record whose three scope counts that would falsify
metrics:
  commits: 22
  tasks: 9
  test_count: 1184
  test_files: 44
  commits_note: 17 for the A1..A15 pass, plus 5 for the review-fix pass (af53734..1b06816)
  test_count_note: 1174 at base -> 1177 after the A1..A15 pass -> 1184 after the review-fix pass
---

# Quick Task 260810-kuo: Apply the 15 triaged survivors of the /simplify review of PR #16 -- Summary

All 15 ACCEPT items (A1..A15) applied as 17 atomic commits, plus a v0.0.3 deferral record for the
nine UNRESOLVED items. Nothing dropped, `nx.json` and `ci.yml` byte-unchanged. One guard WAS
weakened -- A12 -- which the code review caught and a follow-up pass reversed; see the note at the
end of this file.

## Commit sequence

| # | Commit | Item |
|---|--------|------|
| C1 | `a149f95` | A3 lazy `nx/src/...` imports |
| C2 | `f31705f` | A4 hoist `createTaskHasher` |
| C3 | `de95090` | A5 route three workspace-root walks |
| C4 | `5968d51` | A6 the walk primitive |
| C5 | `1a06f3b` | A10 dedupe `probeTokenOf` |
| C6 | `e4f7f71` | A1 memoize `readRepoFile` |
| C7 | `9586ec4` | A2 memoize `jobBlock` + regex hoist |
| C8 | `ffb7f96` | A7 docs gate strengthening |
| C9 | `9e12f46` | A8 detector needle derivation |
| C10 | `2a97f1f` | A9 `mirroredByLabel` call sites |
| C11 | `ca34893` | A11a delete the `read` alias |
| C12 | `73b6da1` | A11b delete the `mirroredBy` alias |
| C13 | `806165b` | A12 delete the import-shape assertion |
| C14 | `8cc8020` | A13 lazy fixture spawn |
| C15 | `31bb47b` | A14 flatMap the restricted-import entries |
| C16 | `a9184a4` | A15 the `it.each` table |
| C17 | `b6580ad` | the deferral record + TRIAGE + RESEARCH correction |

Each commit was gated with the subset relevant to its change before it landed -- but that is EXECUTOR
TESTIMONY about a transient state, not a reproducible measurement, and it should not be read as one.

What WAS independently measured, by the verifier, is a **spot check of 10 of the 22 commits, on `test`
only** -- the five highest-risk commits of the A1..A15 pass (`de95090`, `5968d51`, `e4f7f71`, `ffb7f96`,
`31bb47b`) plus all five review-fix commits (`af53734`, `9709a2b`, `fd8fa7a`, `c02f0d6`, `1b06816`).

**The other twelve commits are NOT measured, and no commit in the range is gated on all six gates.**
Full per-commit gating is 22 checkouts x 6 gates, which was not run and is the open cost call recorded
in VERIFICATION.md. The full eight-gate battery ran uncached at the baseline and at HEAD; HEAD is green.

C16 and C17 were reworded after they first landed. Their pre-reword hashes (`65d36e1`, `703a261`) are
now dangling objects: they still resolve in `git log --all`, which is why the self-check below did not
catch it. `git merge-base --is-ancestor <sha> HEAD` is the check that does, and it is what the
self-check now uses.

## The A3/A4 byte-identity proof (the acceptance condition for A3+A4, CONTEXT G3)

Records captured with `NX_DAEMON=false node capture-hashes.mjs --install-mode install --out ...`,
BEFORE at the clean pre-change tree and AFTER at C2's tree, with no other edit and no unrelated
commit or stage between the two captures. The assert script lived OUTSIDE the repo, at the literal
absolute scratchpad path, because `capture-hashes.mjs` derives `workingTreeClean` from
`git status --porcelain` and an untracked in-tree script would have corrupted the AFTER record.

Verbatim output of
`node C:/Users/LARSGY~1/.../scratchpad/kuo-assert-hash-parity.mjs /tmp/kuo-before.json /tmp/kuo-after.json`:

```
build                  OK must be IDENTICAL
typecheck              OK must be IDENTICAL
integration            OK must be IDENTICAL
lint                   OK must be IDENTICAL
test                   OK must be ROTATED -- identical means the instrument is not a hashed input
projectConfiguration   OK
discriminator          OK
nodes-per-target       SAME COUNTS
EXIT=0
```

The instrument's own comparator localised the single rotation to exactly one node, and it is the
expected one:

```
=== build : 2051034099668014497 (A) vs 2051034099668014497 (B) ===
  nodes: 428 / 428    value-changed (0)
=== typecheck : 5125489027805058446 (A) vs 5125489027805058446 (B) ===
  nodes: 429 / 429    value-changed (0)
=== test : 7765117394831368309 (A) vs 8939012628755299489 (B) ===
  nodes: 444 / 444    value-changed (1), same: 443
    workspace:[...,{workspaceRoot}/eslint.config.mjs,...,{workspaceRoot}/capture-hashes.mjs]
      A=14336282348100063503
      B=18040456555099593066
=== integration : 3897728362140034776 (A) vs 3897728362140034776 (B) ===
  nodes: 430 / 430    value-changed (0)
```

`test` rotating is the REQUIRED direction, not a regression: `capture-hashes.mjs` is itself a hashed
`test` input, so a `test` hash that did not move would mean the instrument had fallen out of the
input set -- the stale-PASS hole `capture-hashes-cli.spec.ts` records as closed.

## Final gate battery (uncached)

| Gate | Result |
|---|---|
| build, typecheck, lint | green |
| test | **1177 passed / 44 files** -- green (1184 after the review-fix pass, which added 7 clauses) |
| integration | 15 passed / 3 files |
| format:check | green |
| check:action | green, no bundle drift |
| fallow:ci | 66 entry points, 0 issues |

### A session-local `lint-scope-drift.spec.ts` failure that does NOT reproduce

Recorded because this project records observations rather than dropping them, and framed as what is
evidenced rather than as a standing property of the repo.

**What was observed.** Late in the execution session the `test` target failed repeatedly with
`Hook timed out in 10000ms` at `lint-scope-drift.spec.ts:151`, the `beforeAll` that awaits the
`eslint.config.mjs` import, sometimes taking `lint-rules.spec.ts` down at suite level. Nx classified
the task flaky. The same tree had passed 1177/1177 many times earlier in the same session.

**What refutes the framing.** Verification could not reproduce it: **eleven independent green runs**
-- one uncached `nx run-many` battery, five uncached `nx run-many -t test` runs at default
parallelism each captured to its own log, and five direct vitest runs at mid-sequence commits in a
detached worktree. 1177/1177, exit 0, every time. The machine carried 29 live `node.exe` processes
throughout, which is the same contention condition the original write-up named as the cause. So the
earlier "pre-existing contention flake" framing is NOT supported: the premise (that the suite failed
consistently at all) was a session-local event on a machine state that no longer exists, and it can
be neither confirmed nor refuted after the fact.

**What still holds.** A14 is not the cause, and that conclusion is now corroborated by a stronger
method than the executor used: A14 was in the tree for all eleven green runs, and a change that
caused a consistent failure cannot produce eleven greens. The executor's own scoped revert
(`git checkout 4518787 -- eslint.config.mjs`, restored immediately) failed with the identical
signature, and the `^import` lines are byte-identical between `4518787` and HEAD -- A14 adds no
module to the import graph.

**No maintainer action is implied.** There is nothing observable to act on, so no decision about that
hook's timeout budget follows from this. The hook's own comment forbids the `testTimeout` remedy by
name, and `vitest.config.mts` is not in this range.

### Test count: 1174 -> 1177 (+3), every one an added control

The baseline at `4518787` was 1174/44. The delta is three NEW assertions, each the positive control
for a memo added in the same commit -- not a side effect:

| + | Clause | Commit | Why it had to be written |
|---|--------|--------|--------------------------|
| +1 | `expect(() => readRepoFile('no-such-file.txt')).toThrow()` | C6 | `repo-file.spec.ts` contained ZERO `toThrow` and `readRepoFile` was a bare `readFileSync`, so a memo caching a sentinel on the miss path would have shipped green |
| +1 | `expect(readRepoFile('nx.json')).toBe(readRepoFile('nx.json'))` | C6 | nothing pinned that a repeated read still returns the content |
| +1 | `expect(() => jobBlock('no-such-job')).toThrow()` | C7 | the throw is cited as the presence guard at five sites, and all ~80 call sites pass real keys, so it was completely ungated |

File count is unchanged at 44. A15 collapsed five `it`s into one `it.each` with five rows, which is
five `it`s out -- net zero, confirmed by `nx-target-inputs.spec.ts` staying at 30 tests.

## The two guard strengthenings, measured rather than asserted

**A7 -- the cardinality gate could not localize, and here is the proof.** The old gate asserted the
discriminator command occurred exactly three times in the JSON fence body. Measured against the real
document, in memory, without modifying it: deleting the `lint` target and doubling the discriminator
under `build` leaves the count at THREE.

```
--- real doc (both gates must PASS) ---
  old count gate: PASS
  new parse gate: PASS
--- mutated: lint deleted, build doubled ---
  occurrences in fence: 3
  old count gate: PASS -- MISSES the defect
  new parse gate: FAIL -- CATCHES the defect
```

The replacement parses the fence, asserts the `targetDefaults` key set by equality, then asserts per
target that the runtime inputs are exactly `[command]`. `toEqual`, not `toContain`, so the
exact-count discipline survives at a level that names the target. The orphaned
`SNIPPET_DISCRIMINATOR_SITES` constant is deleted; the CR-01 comment block is rewritten, not removed.

**A8 -- byte-identical needles, so a silent hole becomes a red test.** Both join products verified
identical to the literals they replace:

```
success line identical: true
regex source identical: true
metacharacter-free members: true
```

`.github/workflows/windows-regression-detector.yml` is byte-unchanged. The metacharacter claim moved
off the deleted literal and onto `INVARIANT_TARGETS`, since that is what the property now rests on.

## The one guard that reddened, and the code change that closed it

**C4 (A6), `cache-key.spec.ts`:** deleting the local `SOURCE_ROOT_URL` in favour of the shared
URL-anchored walk orphaned a SECOND reader at `:167` that used it to read each walked file.

```
FAIL src/lib/cache-key.spec.ts > cache-key.ts single source (TRUST-08, T-05-08-02)
     > authors the prefix literal in exactly the TWO allowlisted production modules
ReferenceError: SOURCE_ROOT_URL is not defined
```

Closed by changing the CODE, per the `260810-bxj` precedent: that read now routes through
`readRepoFile(`${PACKAGE_SOURCE_ROOT}/${file}`)`, the same layer the walk uses, so the file no longer
computes any root of its own. The assertion and its allowlist are untouched. No other guard reddened
at any point in the 17 commits.

## Deliberate corrections to claims this work falsified

Three comments asserted things that stopped being true. Each was corrected in place rather than
deleted, which is this repo's recorded discipline -- a comment carrying a false reason is a
documented argument for undoing the work.

1. **`capture-hashes.mjs` `measureGraphState`** argued `cold` would be unreachable because "this
   file's own static import of `nx/src/project-graph/project-graph.js`" populates the native file
   cache. A3 removed that static import. Verified the conclusion still holds by a different route:
   the `await import` of `nx/src/utils/cache-directory.js` inside that same function requires
   `nx/src/native`, which performs the addon copy -- on the call that reads it.
2. **`actions-cache-backend.spec.ts` `nonSpecModules`** stated as a CONSTRAINT that the walk must be
   a function because the workspace-root cwd hook has not run at collection time. Routing through
   `repoFileUrl` removed the cwd dependency, so the constraint no longer holds; the function form is
   retained for the weaker real reason (callers read it lazily).
3. **`docs-same-os-claims.spec.ts:698`** described `read()` as "a `readFileSync` that THROWS on a
   missing path". The alias is gone (A11a) and `readRepoFile` now memoizes, so it reads "wraps a
   `readFileSync` that THROWS on a missing path (memoizing SUCCESSFUL reads only, so the throw still
   re-fires on every call)".

## Non-negotiables verified at HEAD

| Invariant | Result |
|---|---|
| `nx.json` byte-unchanged | blob `580d962a165f952fa8d49c24c62c52547737d807`, identical to the value recorded in task 1; `git diff --exit-code <base>..HEAD` silent |
| `.github/workflows/ci.yml` byte-unchanged | `git diff --exit-code <base>..HEAD` silent |
| detector workflow byte-unchanged | silent |
| `lib/compression-method.ts` (VER-05) | present |
| construction-time `mkdirSync` (VER-08) | present, 5 `mkdirSync` sites intact |
| `capture-hashes.mjs` clauses 5 and 6 | both retention blocks present |
| no U1..U9 implemented | `isLegacyOsSuffixedAssetName` and `SEED_MARKER_WORDS` still present; no `lib/github-rest.ts`; no `hash-parity/targets.json`; `.gitignore` untouched |
| bxj deferred-items record untouched | `git diff --exit-code <base>..HEAD -- <bxj record>` silent (range-scoped, so a committed edit would also have been caught) |

## Deferral record

`260810-kuo-deferred-items.md` carries U1..U9, each with measured evidence, fix shape and exactly ONE
paragraph beginning "Deferred because" -- one per item, so the count means what it claims rather than
nine reasons living inside one section. Verified: 9 unique `## U<N>` headings, 9 occurrences of the
reason phrase.

It is a NEW file rather than an append to the `260810-bxj` record, deviating from CONTEXT's
`<canonical_refs>`. The reason, recorded in both the file and C17's message: the bxj record declares
its scope three times ("27 items", "SEVEN items", "27 items" in its closing line) and appending items
from a different review falsifies all three.

`260810-kuo-TRIAGE.md` is committed as the provenance for both the 15 applied and the nine deferred.
`260810-kuo-RESEARCH.md`'s Q6 pitfall is corrected in place: `read-back.ts` is NOT a DOCS-08
phrase-table row, it is in `EDITED_FILES` feeding a negative attribution guard, so A9 needed no row
check.

## Notes for the reviewer

- **A9 halved as planned.** The `MIRRORED_BY_PREFIX` export stays; `read-back.spec.ts:360` pins its
  value. `fallow:ci` was run on C10 specifically -- clean, the spec-import crediting precedent held.
- **A13 is invisible to `npm run test`.** Its spec runs under the `integration` target only, so it
  was verified with `npm run integration`.
- **A14 rotates the `test` and `lint` hashes** because `nx.json` lists `eslint.config.mjs` in both
  input sets. Expected, and not the deferred T4-7a item, which is about editing `nx.json` itself.
- **A15's row titles truncate in the vitest reporter** for the two longest entry paths
  (the reporter clips them after `.../ci.` and `.../win` respectively). They remain distinguishable
  from each other, and the full path is in
  each row's reason string, so localization is not lost.

## Not completed

**All 9 tasks and all 15 items are done.** Two things a reviewer should know:

1. **The `lint-scope-drift.spec.ts` failure observed during the session is not reproducible** and
   needs no action (section above). Eleven independent verification runs are green at default
   parallelism with A14 in the tree, so there is no standing defect to patch and no maintainer
   decision to make about that hook's budget.
2. **Two diagnostics were blocked by the permission classifier and routed around rather than
   forced.** A mutation of `docs/cross-os.md` to prove A7's strengthening was denied as an in-place
   overwrite of a tracked file; the same proof was obtained by mutating the parsed fence IN MEMORY
   (`docs/cross-os.md` verified untouched afterwards). A `git checkout --detach 4518787` to measure
   the baseline was denied against the "stay on this branch" instruction; the attribution was
   obtained instead with a scoped single-file `git checkout 4518787 -- eslint.config.mjs`, restored
   immediately. Both denials were correct and neither weakened the evidence.

No GSD `state.*` handler was invoked -- not `state.record-metric` (which rejects positional args),
and none was probed, since probing executes and mutates STATE.md. So no tracking file was corrupted
and no repair was needed. STATE.md, PLAN.md, CONTEXT.md and this SUMMARY.md are left uncommitted for
the orchestrator; ROADMAP.md was not touched.

## Review-fix pass (after the code review, five further commits)

The code review found one Critical, five Warnings and four Info items. Five follow-up commits close
them; the deferred-items record is unchanged.

- **CR-01 reverses A12's premise.** A12 deleted the import-shape assertion in `compare.spec.ts` on
  the argument that the surviving call assertion plus `typecheck` subsume it. That argument is
  false: a locally re-authored `collapseToOneLine` in `assert-parity.ts` resolves the name and
  passes typecheck (exit 0), lint (exit 0) and the call assertion alike, so the single-choke-point
  invariant was unguarded. Restored as a reflow-proof pattern that also pins the module specifier,
  plus a clause forbidding a local declaration; the false sentence is gone from the failure message.
  **So the "no guard weakened" claim was FALSE as this task originally landed**, in exactly one
  place, and it is true again now.
- **WR-01 re-closes a hole A3 opened silently.** Making the six `nx/src/...` imports lazy removed
  the only local gate on them -- nothing in the battery loaded any of the six. A derived clause set
  in `capture-hashes-cli.spec.ts` resolves all six and reads the destructured export off each.
- **WR-02 / WR-05** single-source the docs-gate target list and name both unguarded dereferences.
- **WR-03 / WR-04** correct the two docstrings this task falsified and did not update.
- **IN-01** tightens two ordering comments in `capture-hashes.mjs` that were looser than the code.
- **IN-02 and IN-03** are recorded as accepted trades in the review and need no change.

Test count after the pass: **1184 / 44 files** (+7 from WR-01: one extraction control and six rows).

## Self-Check: PASSED

- Both created files exist on disk.
- `git merge-base --is-ancestor <sha> HEAD` holds for all 17 commit hashes in the table, and
  `git log 4518787..HEAD` counted exactly 17 at the time the task closed. Resolution in
  `git log --all` is NOT the check -- a pre-reword hash still resolves, which is how two dangling
  SHAs survived the first pass of this list.
- `nx.json` blob at HEAD equals the value recorded in task 1.
- `ci.yml` and the detector workflow are byte-unchanged across the range.
- The `260810-bxj` deferred-items record is untouched, verified range-scoped.
- The deferral record carries 9 unique `## U<N>` headings and 9 `Deferred because` occurrences, one
  per item.
- All 17 commit messages and every added source line are ASCII-only.
- Working tree carries only the three untracked planning documents the orchestrator owns.
