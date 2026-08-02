---
phase: 13-read-only-actions-cache-backend
plan: 05
subsystem: ci
tags:
  [
    cross-os-reuse,
    read-only-backend,
    ci-gate,
    mutation-proof,
    vacuity-trap,
    stale-claim-correction,
  ]

# Dependency graph
requires:
  - phase: 13-read-only-actions-cache-backend
    provides: '13-02 created createReadOnlyActionsCacheBackend, the factory the knob selects'
  - phase: 13-read-only-actions-cache-backend
    provides: '13-03 landed CACHE_READ_ONLY as the LAST branch of selectBackend, read as bare truthiness -- this plan is the first consumer that sets it'
  - phase: 13-read-only-actions-cache-backend
    provides: '13-04 documented the knob on all three consumer doc surfaces, so this plan owns no docs/ site'
provides:
  - 'three read-only Windows reuse legs: build-windows, typecheck-windows and test-windows each write CACHE_READ_ONLY=1 to $GITHUB_ENV from their regular pre-set step'
  - 'three cross-OS reuse GATES at a floor of 1, each with an ::error:: annotation naming both causes a zero can have'
  - 'six spec clauses pinning the knob and the comparison per leg, each mutation-measured, none resting on the readiness poll`s pre-existing exit 1'
  - 'the ci.yml step name `Gate on the cross-OS remote-cache label count for this leg`, replacing the Record step on three legs'
affects:
  [
    13-06 evidence -- the gates are only observable on a real windows-11-arm runner,
  ]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'inductive-not-per-run soundness: a gate is sound when the leg CANNOT produce the thing it observes, so a green holds of every run rather than of this one'
    - 'liveness and correctness kept as two arguments: the `needs:` edge is why the entry is PRESENT, read-only-ness is why a green MEANS something -- a rationale resting the gate on the edge has confused them'
    - 'measure the vacuity trap rather than reason about it: the clause comment records that a leg with the gate DELETED still contains an exit 1, so an /exit 1/ clause would have passed over it'
    - 'correct the printed echo string, not only the rationale comment -- the echo is CODE, survives the spec`s comment strip, and is the only one of the two an operator reads'
    - 'bounded stale-claim sweep: assert the count of survivors and identify each by its own surrounding token, never a repo-wide zero-grep that would delete claims still true of other jobs'

key-files:
  created: []
  modified:
    - .github/workflows/ci.yml
    - packages/github-cache/src/dogfood-cross-os.spec.ts

key-decisions:
  - 'The knob goes in the existing REGULAR pre-set step, not the sidecar step`s env: -- a background step`s $GITHUB_ENV writes do not propagate to later steps, which start-cache-server/action.yml already records'
  - 'Compared with -lt 1 rather than -eq 0. They are equivalent here, but -lt 1 states the FLOOR D-05 locked, where -eq 0 reads as an exact pin`s negation and invites a future reader to tighten it'
  - 'Clause B matches the COMPARISON line, never a bare exit 1. Measured, not assumed: with the gate step deleted from build-windows the block still contains the readiness poll`s exit 1, so an /exit 1/ clause passes over a leg with no gate at all'
  - 'cacheObservation`s step-name regex was moved to the gate step`s NEW name in the RED commit rather than the GREEN one, so the RED describes the target state -- the discipline RENAME_NOTE states, at the cost of nine red clauses instead of the planned six'
  - 'The two out-of-scope RECORDED-never-gated sites were left untouched and asserted as survivors by their own tokens (runner.debug, LEG_OS). RESEARCH.md`s proposed repo-wide zero-grep of that literal would have deleted two claims that are still true'
  - 'The tee`d-run rationale (RESEARCH A4) was verified line by line and left unchanged: its would-leave-all-three-GREEN claim is scoped to the counterfactual bare `- run:` form, and deleting the tee now REDDENS the leg (no log -> grep fails -> || true -> count 0 -> gate fires) rather than blinding it'

patterns-established:
  - 'When a plan renames a step that an existing clause pins, update the assertion in the RED commit that describes the new state, not in the GREEN commit that produces it'
  - 'A needle-count comment records WHICH commit drifted it, so the next reader can tell a measurement that rots on any file change from one that tracks this phase`s own edit'
  - 'A gate`s ::error:: names every cause its trigger condition admits, and says which one to rule out first, so a red is actionable without reading the workflow'

requirements-completed: [XOS-09, TEST-11, DOCS-09]

coverage:
  - id: D1
    description: 'All three Windows legs write CACHE_READ_ONLY=1 to $GITHUB_ENV from their existing regular pre-set step, so each sidecar constructs a backend with no put'
    requirement: XOS-09
    verification:
      - kind: unit
        ref: 'packages/github-cache/src/dogfood-cross-os.spec.ts#declines the write via CACHE_READ_ONLY, which is what makes the gate below sound (x3, one per leg)'
        status: pass
      - kind: other
        ref: 'git grep -c -F ''echo "CACHE_READ_ONLY=1" >> "$GITHUB_ENV"'' -- .github/workflows/ci.yml -> 3'
        status: pass
      - kind: other
        ref: 'ci.yml parsed as YAML: for each of the three jobs, the step named `Pre-set the Nx cache client vars for the sidecar` has a run body containing CACHE_READ_ONLY=1'
        status: pass
    human_judgment: false
  - id: D2
    description: 'Each leg FAILS below a count of 1, printing the number and an ::error:: naming both causes a zero can have'
    requirement: XOS-09
    verification:
      - kind: unit
        ref: 'packages/github-cache/src/dogfood-cross-os.spec.ts#gates that count at a floor of 1 rather than only printing it (XOS-09) (x3, one per leg)'
        status: pass
      - kind: other
        ref: 'git grep -c -F -- "-lt 1 ]" -- .github/workflows/ci.yml -> 3; git grep -c -F -- "::error::" -- .github/workflows/ci.yml -> 3, up from 0 at HEAD~1'
        status: pass
      - kind: other
        ref: 'git grep -c -F -- "-eq 0" -- .github/workflows/ci.yml -> 0, unchanged: the floor form was used, not the exact-zero form'
        status: pass
    human_judgment: false
  - id: D3
    description: 'The gate clauses are non-vacuous by measurement, and specifically do not rest on the readiness poll`s pre-existing exit 1'
    requirement: TEST-11
    verification:
      - kind: other
        ref: 'MUTATION 1, gate step deleted from build-windows: exactly 2 clauses red, both that leg`s (gatedCount + cacheObservation). Positive control, needs:, tee`d-run, sidecar, cacheClient and both other legs stayed GREEN -- and the mutated block still contained the readiness poll`s exit 1'
        status: pass
      - kind: other
        ref: 'MUTATION 2, CACHE_READ_ONLY line deleted from typecheck-windows: 1 clause red, that leg`s readOnlyLeg alone. The two cacheClient writes and the readiness-poll clause for the SAME step stayed GREEN'
        status: pass
      - kind: other
        ref: 'MUTATION 3, test-windows` -lt 1 changed to -lt 0 (a comparison that can never fire): 1 clause red, that leg`s gatedCount alone, with its readOnlyLeg clause still GREEN'
        status: pass
      - kind: other
        ref: 'no toMatch or toContain argument in dogfood-cross-os.spec.ts contains "exit 1" (git grep -n -E "(toMatch|toContain)\(.*exit 1" -> no matches)'
        status: pass
    human_judgment: false
  - id: D4
    description: 'No comment, printed echo string or spec reason string inside the three Windows job blocks still argues the counts cannot soundly be gated'
    requirement: DOCS-09
    verification:
      - kind: unit
        ref: 'packages/github-cache/src/dogfood-cross-os.spec.ts -- the not.toContain(''RECORDED, never gated'') half of each leg`s gatedCount clause, per job block'
        status: pass
      - kind: other
        ref: 'git grep -c -F "WRITABLE sidecar" -- .github packages -> 0 (was 4: three ci.yml comment blocks plus the cacheObservation reason string)'
        status: pass
      - kind: other
        ref: 'the surviving first half of cacheObservation still names the @actions/cache bump and the dogfood canary, so the true argument for the clause`s existence was not deleted with the false one'
        status: pass
    human_judgment: false
  - id: D5
    description: 'The two ci.yml sites making the same claim about OTHER jobs survive untouched, because they are still true'
    requirement: DOCS-09
    verification:
      - kind: other
        ref: 'exactly 2 lines in ci.yml contain "RECORDED, never gated"; one contains runner.debug and the other LEG_OS -- asserted mechanically, not by eye'
        status: pass
      - kind: other
        ref: 'git diff HEAD~3 HEAD -- .github/workflows/ci.yml touches no line in the runner.debug record or the integration matrix leg'
        status: pass
    human_judgment: false
  - id: D6
    description: 'Every load-bearing block the gate depends on survived the edit'
    requirement: XOS-09
    verification:
      - kind: other
        ref: 'git grep -c -F "|| true" -- .github/workflows/ci.yml -> 19, unchanged from HEAD~3: no leg lost the tolerant brace group that lets a legitimate zero reach the comparison'
        status: pass
      - kind: other
        ref: 'git grep -c -F ''GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}'' -- .github/workflows/ci.yml -> 14, unchanged: no leg lost its sidecar token, which would take selectBackend`s memory-degrade branch BEFORE the knob'
        status: pass
      - kind: other
        ref: 'the readiness poll is byte-identical on all three legs; the mask-ordering clause still measures 8 sites and passes'
        status: pass
    human_judgment: false

# Metrics
duration: 20min
completed: 2026-08-02
status: complete
---

# Phase 13 Plan 05: Read-Only Windows Legs and Their Gated Counts Summary

**The three Windows reuse legs now decline the write, which is the only thing that makes their `[remote cache]` count gateable -- a leg that cannot save can only get that label by restoring the ubuntu producer's entry, so the gate is sound INDUCTIVELY rather than per-run.**

## Performance

- **Duration:** 20 min of work (wall clock spans a usage-limit pause between Task 1 and Task 2)
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments

- **The gate the phase exists for.** Each of `build-windows`, `typecheck-windows` and
  `test-windows` writes `CACHE_READ_ONLY=1` to `$GITHUB_ENV` from its existing pre-set step and
  fails below a count of 1. The previous rationale for leaving the count ungated was correct at the
  time and is now obsolete rather than wrong: with a writable sidecar the gate was launderable,
  because a broken cross-OS restore made a leg MISS, execute and SAVE, and a re-run of the same
  commit then HIT that self-produced entry. Removing the write path removes the premise.
- **The vacuity trap was disproved by measurement, not avoided by argument.** With the whole gate
  step deleted from `build-windows`, the job block still contains the readiness poll's bare
  `exit 1` -- so `expect(block).toMatch(/exit 1/)` would have passed over a leg with no gate at all.
  That run is recorded in the clause comment as MUTATION 1, alongside the fact that exactly two
  clauses reddened and both belonged to that leg.
- **The knob and the comparison are independently pinned, which needed proving.** They sit in one
  job block and could easily have covered for each other. Deleting the knob from
  `typecheck-windows` reddened that leg's knob clause alone, with the two `cacheClient` writes in
  the SAME step still green; defanging `test-windows`' comparison reddened that leg's gate clause
  alone, with its knob clause still green.
- **The stale-claim sweep was bounded, and the bound was load-bearing.** `RECORDED, never gated`
  has five sites in `ci.yml`; three are the converted legs' echo strings and two describe jobs this
  phase does not convert. RESEARCH.md's proposed repo-wide zero-grep of that literal would have
  deleted two claims that are still true. The scope limit is asserted mechanically -- exactly two
  survivors, each identified by its own surrounding token (`runner.debug`, `LEG_OS`) -- and the real
  work is done by a `not.toContain` scoped to each job block.
- **The echo strings mattered more than the comments, and both moved in the gate's own commit.**
  The three printed strings are CODE: they survive the spec's `#`-strip, they are what an operator
  reads in the job log, and a gate that prints "RECORDED, never gated" is self-refuting.
- **A measurement that had already rotted was re-measured and dated.** The job-scoping needle count
  read `10 stripped / 25 raw`; the true reading at the pre-edit HEAD was already `13 / 29`. It
  drifted in the CR-18 dogfood-widening commits, NOT in this phase's edit, which added no
  `windows-11-arm` line. Both recording sites now carry `13 / 29` and say which commit moved it.
- **No bundle drift, as predicted.** `npm run check:action` exits 0 from the main tree -- neither
  `ci.yml` nor `dogfood-cross-os.spec.ts` is `serve()`-reachable.

## Task Commits

Each task was committed atomically:

1. **Task 1: RED -- per-leg semantic pins for the knob and the gated count** -- `54943a5` (test)
2. **Task 2: GREEN -- three read-only legs, three gates, six stale sites corrected** -- `c818e7a` (ci)
3. **Task 3: Record the mutation proofs and re-measure the needle counts** -- `d96fa70` (test)

## Files Created/Modified

- `.github/workflows/ci.yml` - one `echo "CACHE_READ_ONLY=1"` line per Windows leg; three count
  steps renamed to `Gate on the cross-OS remote-cache label count for this leg` and given a `-lt 1`
  comparison plus an `::error::` annotation; the build leg's 15-line rationale replaced with the
  inductive one; the typecheck and test legs' one-line forms replaced; three echo strings corrected.
  The two out-of-scope marker sites, all three readiness polls, all `|| true` groups and all sidecar
  `env: GITHUB_TOKEN` blocks are untouched.
- `packages/github-cache/src/dogfood-cross-os.spec.ts` - two reason keys added (`readOnlyLeg`,
  `gatedCount`); `cacheObservation`'s false half replaced with the inductive argument and its
  step-name regex moved to the gate step's new name; two clauses added per leg with full comments on
  the build copy only; three mutation measurements recorded; the needle count re-measured at both
  recording sites.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The RED was nine clauses, not the six the plan predicted**

- **Found during:** Task 1
- **Issue:** Task 1's acceptance criterion says the RED must be "exactly six failing clauses". But
  Task 2's own instruction renames each leg's count step, and the pre-existing `cacheObservation`
  clause pins that step's name -- so the three `cacheObservation` clauses must move too. The two
  instructions cannot both be satisfied.
- **Fix:** Asserted the NEW step name in the RED commit, giving nine red clauses (six new plus three
  renamed). Every failure was for the intended reason, and every other clause in the file stayed
  green. The alternative -- pinning the old name in the RED and updating it in the GREEN -- would
  have made the RED describe a state the plan discards, and is the opposite of what `RENAME_NOTE`
  asks for.
- **Files modified:** `packages/github-cache/src/dogfood-cross-os.spec.ts`
- **Commit:** `54943a5`

**2. [Rule 1 - Bug] The `-lt 1` acceptance count had a non-zero baseline**

- **Found during:** Task 2
- **Issue:** The plan's criterion is that `git grep -c -F -- "-lt 1"` prints `3`. Measured at
  `HEAD~1`, that needle already printed `1`: `ci.yml:1223` contains `-lt 100`, and `-lt 1` is a
  substring of it. The criterion as written could never pass.
- **Fix:** Used the precise needle `-lt 1 ]`, which reads exactly `3` post-edit and `0` before. The
  intent -- three legs, three floor comparisons -- is met and verified.
- **Files modified:** none (measurement correction)
- **Commit:** `c818e7a`

**3. [Rule 1 - Bug] The `exit 1` count criterion cannot distinguish an assertion from prose**

- **Found during:** Task 1
- **Issue:** The plan requires the spec's `exit 1` count to be unchanged from `HEAD~1` (baseline
  `0`), while separately instructing that the trap be NAMED in the clause comment and the reason
  string. Both cannot hold: naming the trap introduces the literal. The count is now `4`.
- **Fix:** Verified the property the criterion was proxying for, directly: no `toMatch` or
  `toContain` argument in the file contains `exit 1`
  (`git grep -n -E "(toMatch|toContain)\(.*exit 1"` returns no matches). All four occurrences are
  prose -- two in the `gatedCount` reason string, two in the clause comment.
- **Files modified:** none (measurement correction)
- **Commit:** `54943a5`

**4. [Rule 2 - Missing] The job-scoping needle count was stale before this plan touched anything**

- **Found during:** Task 3
- **Issue:** The spec records `windows-11-arm` at `10 stripped / 25 raw` "at HEAD". Measured against
  the pre-edit tree it was already `13 / 29` -- it drifted in the CR-18 dogfood-widening commits and
  was never re-measured. A stale measurement in a file whose house standard is MEASURED-not-predicted
  is the exact defect the surrounding comment was written to prevent.
- **Fix:** Re-measured against the post-edit `ci.yml` and updated both recording sites, adding which
  commits moved it and noting that this phase's edit added no `windows-11-arm` line.
- **Files modified:** `packages/github-cache/src/dogfood-cross-os.spec.ts`
- **Commit:** `d96fa70`

### Verified and Deliberately Left Alone

- **The tee'd-run rationale, `ci.yml:529-542` (RESEARCH.md Assumption A4).** Checked line by line
  rather than rewritten. Its "an @actions/cache bump ... would leave all three GREEN" sentence is
  scoped to the counterfactual bare `- run:` form, where there is no log, so no count and no gate --
  it does not claim the current world stays green. It also strengthens rather than weakens under the
  gate: deleting the tee now makes the log absent, `grep` fail, `|| true` yield `count=0` and the
  gate fire, so the leg reddens instead of going blind.
- **`ci.yml:825` (`runner.debug`) and `ci.yml:928` (the integration matrix leg).** Both still say
  `RECORDED, never gated` and both are still true; neither describes a converted leg.

## Flagged for Review, Not Changed

- **`packages/github-cache/src/dogfood-cross-os.spec.ts:349-352`** -- "VER-06 is now PR-observable;
  OBS-04 is the surviving example, because its `[remote cache]` counts are RECORDED and never
  GATED." The referent of "its" is ambiguous. If it means the counts on the legs that run the
  COMMITTED bundle, three of those are now gated and the sentence has gone stale. If it means
  something narrower to OBS-04's all-restore-MISS warning, it is untouched. The site is outside the
  seven this plan's DOCS-09 scope enumerates, and an edit made under the wrong reading would delete
  a true claim -- the same failure mode the two `RECORDED, never gated` survivors exist to warn
  against. Raised here rather than resolved by guess.

## What This Gate Still Does Not Cover

Recorded because over-reading it is the mistake CR-18 caught once already, and it is now written
into `ci.yml` itself: these three legs run the COMMITTED public `./start-cache-server` bundle, while
the dogfood pair runs `uses: ./packages/github-cache` built in-job. Nothing in this gate ties the
bundle to the source it was built from -- `action-bundle-drift` is the control that does. A green
here is not evidence about uncommitted source.

The gate itself is only observable on a real `windows-11-arm` runner. That observation belongs to
plan 13-06, which is why this plan's evidence is structural: a spec runs in one process on one OS
and cannot observe a two-OS property.

## Self-Check: PASSED

- Files verified present: `.github/workflows/ci.yml`,
  `packages/github-cache/src/dogfood-cross-os.spec.ts`,
  `.planning/phases/13-read-only-actions-cache-backend/13-05-SUMMARY.md`.
- Commits verified in history: `54943a5`, `c818e7a`, `d96fa70`.
- `npm run test` green (975 tests, 42 files); `npm run check:action` exits 0 from the main tree;
  `nx lint` and `nx typecheck` report no errors.
- Every diffed line is ASCII.
