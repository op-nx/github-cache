---
phase: 12-windows-ci-reuse-o4-consumer-recipe
plan: 01
subsystem: testing
tags: [vitest, github-actions, nx-inputs, tdd-red, workflow-guards]

# Dependency graph
requires:
  - phase: 09-nx-hash-parity-ci
    provides: "PARITY-08 -- ci.yml registered as an nx.json test input, and the stale-cached-PASS defect that registration closes"
  - phase: 10-os-invariant-releases-mirror
    provides: "dogfood-cross-os.spec.ts jobBlock extractor, the o3-witness describe as the per-job clause template, and the recorded unanchored-needs tautology"
  - phase: 11-live-proofs-o1-o2-o3
    provides: "the authored-RED-before-the-ci.yml-change shape, and the WR-09 half-locked-phrase finding"
provides:
  - "Three per-leg describes guarding build-windows / typecheck-windows / test-windows: presence, runner, needs: edge, timeout, own-target, sidecar, and the absence of a job-level if:"
  - "windows-regression-detector.spec.ts -- an eight-clause shape guard over the not-yet-authored scheduled detector workflow"
  - "nx.json registration of the detector workflow as a test input, adjacent to ci.yml, landed in the same commit as its guard"
  - "A literal registration pin in nx-target-inputs.spec.ts"
  - "Four OBSERVED RED records, transcribed from actual runs"
affects: [12-02, 12-03, 12-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-leg describes over a parameterised loop, so three CI legs fail and are selected (-t) independently"
    - "existsSync-guarded workflow read yielding '' -- turns an absent-file RED into a NAMED assertion failure instead of a module-load ENOENT"
    - "Multi-target Nx success needle naming all three targets in -t argument order; the short prefix is vacuous"

key-files:
  created:
    - packages/github-cache/src/windows-regression-detector.spec.ts
  modified:
    - packages/github-cache/src/dogfood-cross-os.spec.ts
    - packages/github-cache/src/nx-target-inputs.spec.ts
    - nx.json

key-decisions:
  - "12-01: the three Windows-leg guards are three explicit describes, not one describe.each -- each leg fails independently (a copy-paste leaving the wrong npm run line is a different regression from a lost needs: edge), and the literal names are what let -t select each leg so three separate REDs could be observed rather than one undifferentiated failure."
  - "12-01: every new clause is indent-anchored (job keys at four spaces, step children at six) and scoped to jobBlock(<leg>). windows-11-arm occurs 19 times in ci.yml, so a file-wide clause passes unconditionally; and an unanchored token on build-windows's needs: would be satisfied by its own npm run build step -- the tautology dogfood-cross-os.spec.ts records having shipped once."
  - "12-01: the detector guard reads its workflow through an existsSync guard yielding '' rather than letting readFileSync throw. That is what makes the RED a NAMED existence assertion (expected false to be true) instead of a module-load ENOENT that takes the file's other seven clauses down with it and reports nothing about what is missing."
  - "12-01: the detector's success needle is the plural three-target line held in one constant, occurring exactly once in the file. Nx filters the printed target list down to targets that resolved a task (formatting-utils.js:37), so the bare Successfully-ran-target prefix still matches a two-of-three run and is vacuous for this workflow."
  - "12-01: the nx.json registration landed in the SAME commit as the guard that reads the workflow (D-09 / PARITY-08), with an explicit path rather than a workflows/** glob. Registering an input for a file that does not yet exist is safe -- an Nx fileset tolerates an absent path -- and it removes the stale-pass window entirely rather than leaving an ordering instruction for someone to remember."

patterns-established:
  - "Shared reason factory + per-leg destructuring: keeps failure messages leg-specific and substantive without triplicating prose, while leaving every jobBlock call site a literal"
  - "Absence clauses are always asserted AFTER a positive control that proves the extraction is real; on the detector guard the two absence clauses pass trivially against '' and the existence it() is what makes them mean anything"

requirements-completed: [XOS-04, XOS-08, XOS-05]

coverage:
  - id: D1
    description: "build-windows job guard -- seven indent-anchored, job-block-scoped clauses, OBSERVED failing with the jobBlock THROW naming the absent job key"
    requirement: XOS-04
    verification:
      - kind: unit
        ref: "packages/github-cache/src/dogfood-cross-os.spec.ts#ci.yml build-windows job exists and keeps its shape (XOS-04, XOS-08)"
        status: fail
    human_judgment: false
    rationale: "Deliberately RED -- the job is authored by plan 12-02. Status `fail` IS the deliverable for a RED plan."
  - id: D2
    description: "typecheck-windows job guard -- same seven clauses, OBSERVED failing with the jobBlock THROW"
    requirement: XOS-04
    verification:
      - kind: unit
        ref: "packages/github-cache/src/dogfood-cross-os.spec.ts#ci.yml typecheck-windows job exists and keeps its shape (XOS-04, XOS-08)"
        status: fail
    human_judgment: false
    rationale: "Deliberately RED -- the job is authored by plan 12-02."
  - id: D3
    description: "test-windows job guard -- same seven clauses, OBSERVED failing with the jobBlock THROW"
    requirement: XOS-04
    verification:
      - kind: unit
        ref: "packages/github-cache/src/dogfood-cross-os.spec.ts#ci.yml test-windows job exists and keeps its shape (XOS-04, XOS-08)"
        status: fail
    human_judgment: false
    rationale: "Deliberately RED -- the job is authored by plan 12-02."
  - id: D4
    description: "The needs: edge clause on each Windows leg -- a bare single-producer scalar, anchored at four spaces"
    requirement: XOS-08
    verification:
      - kind: unit
        ref: "packages/github-cache/src/dogfood-cross-os.spec.ts#waits on the ubuntu build job as a bare single-producer needs: scalar (XOS-08)"
        status: fail
    human_judgment: false
    rationale: "Deliberately RED -- the job is authored by plan 12-02."
  - id: D5
    description: "Detector-workflow shape guard -- eight clauses over the scheduled --skip-nx-cache workflow, OBSERVED failing at the NAMED existence it()"
    requirement: XOS-05
    verification:
      - kind: unit
        ref: "packages/github-cache/src/windows-regression-detector.spec.ts#the detector workflow file exists at all"
        status: fail
    human_judgment: false
    rationale: "Deliberately RED -- the workflow file is authored by plan 12-03."
  - id: D6
    description: "nx.json registers the detector workflow as a test input, adjacent to ci.yml, pinned by a literal assertion in the same commit"
    requirement: XOS-05
    verification:
      - kind: unit
        ref: "packages/github-cache/src/nx-target-inputs.spec.ts#nx.json declares the windows-regression-detector workflow as a test input"
        status: pass
    human_judgment: false

# Metrics
duration: 35min
completed: 2026-07-30
status: complete
---

# Phase 12 Plan 01: RED for the Windows-Reuse Slice Summary

**Twenty-seven failing assertions authored before any of their subjects exist: three per-leg
Windows CI job guards, an eight-clause detector-workflow guard whose read is existsSync-guarded so
its RED is a named assertion rather than an ENOENT, and the nx.json test-input registration that
lands in the same commit as the guard it de-stales.**

## Performance

- **Duration:** ~35 min (across a usage-limit interruption)
- **Tasks:** 2 of 2
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments

- Three describes in `dogfood-cross-os.spec.ts`, one per Windows leg, seven independently-named
  `it`s each: positive control, `runs-on`, `needs:`, `timeout-minutes`, own-target, sidecar, and
  the absence of a job-level `if:`. Every clause indent-anchored and scoped to `jobBlock(<leg>)`.
- `windows-regression-detector.spec.ts`: eight clauses over the XOS-05 detector workflow, with a
  named existence control asserted FIRST so the two absence clauses are non-vacuous.
- `nx.json` registers the detector workflow as a `test` input immediately after `ci.yml`, and
  `nx-target-inputs.spec.ts` pins that registration by literal -- all in ONE commit with the guard.
- Four RED observations captured from real runs, transcribed below.

## Task Commits

1. **Task 1: RED -- three per-job describes for the Windows legs** - `13c5775` (test)
2. **Task 2: RED -- the detector-workflow shape guard, registered in the same commit** - `91dbdc1` (test)

## The four OBSERVED REDs

All four were run on this Windows arm64 workstation with `CI=true NO_COLOR=1` (vitest's inferred
`test` target is `testMode: watch`, so `CI` is what makes it run once; `NO_COLOR` keeps the
transcript plain). Command in every case:

```
npx nx run @op-nx/github-cache:test --skip-nx-cache -- -t "<pattern>"
```

Lines below are copied verbatim from the captured stdout. Vitest's decorative separator and
pointer glyphs are non-ASCII and are OMITTED rather than transliterated; no quoted line is
altered.

### RED 1 -- `-t "build-windows"`, exit code 1

```
 FAIL  |@op-nx/github-cache| src/dogfood-cross-os.spec.ts > ci.yml build-windows job exists and keeps its shape (XOS-04, XOS-08) > scopes to a real build-windows job block that runs npm run build
Error: ci.yml: no job keyed `  build-windows:` -- VER-06's guard cannot scope its assertions
 Test Files  1 failed | 39 skipped (40)
      Tests  7 failed | 870 skipped (877)
Warning: command "vitest -t build-windows" exited with non-zero status code
 NX   Running target test for project @op-nx/github-cache failed
```

All seven clauses failed with that identical `Error:` line -- `jobBlock` throws before any
assertion runs, which is precisely the presence-guard behaviour the plan specified.

### RED 2 -- `-t "typecheck-windows"`, exit code 1

```
 FAIL  |@op-nx/github-cache| src/dogfood-cross-os.spec.ts > ci.yml typecheck-windows job exists and keeps its shape (XOS-04, XOS-08) > scopes to a real typecheck-windows job block that runs npm run typecheck
Error: ci.yml: no job keyed `  typecheck-windows:` -- VER-06's guard cannot scope its assertions
 Test Files  1 failed | 39 skipped (40)
      Tests  7 failed | 870 skipped (877)
Warning: command "vitest -t typecheck-windows" exited with non-zero status code
 NX   Running target test for project @op-nx/github-cache failed
```

### RED 3 -- `-t "test-windows"`, exit code 1

```
 FAIL  |@op-nx/github-cache| src/dogfood-cross-os.spec.ts > ci.yml test-windows job exists and keeps its shape (XOS-04, XOS-08) > scopes to a real test-windows job block that runs npm run test
Error: ci.yml: no job keyed `  test-windows:` -- VER-06's guard cannot scope its assertions
 Test Files  1 failed | 39 skipped (40)
      Tests  7 failed | 870 skipped (877)
Warning: command "vitest -t test-windows" exited with non-zero status code
 NX   Running target test for project @op-nx/github-cache failed
```

Three named RED observations, not one: `-t "build-windows"` does not select
`typecheck-windows` or `test-windows`, and `-t "test-windows"` is not a substring of
`typecheck-windows`, so each run reddened exactly its own leg (7 of 877).

### RED 4 -- `-t "detector"`, exit code 1

The failing test is the NAMED existence `it` (Test 1), not a module-load ENOENT. `rg -c "ENOENT"`
over the captured output returns exit 1 (genuine no-match). The output names
`windows-regression-detector.yml` in both the FAIL line and the assertion message:

```
 FAIL  |@op-nx/github-cache| src/windows-regression-detector.spec.ts > windows-regression-detector.yml workflow config -- the XOS-05 detector > the detector workflow file exists at all
AssertionError: There is no .github/workflows/windows-regression-detector.yml. XOS-05 makes this workflow REQUIRED, not optional: without it a Windows-only regression is invisible forever, because a fully-cached Windows CI leg going green is the SAME observation as a Windows leg that never ran the code. The correct response to a red here is to RESTORE THE WORKFLOW. If the workflow was legitimately reworked, update this describe in the SAME commit; do not delete the assertion to make the suite green.: expected false to be true // Object.is equality
 Test Files  1 failed | 1 passed | 39 skipped (41)
      Tests  6 failed | 3 passed | 877 skipped (886)
```

Clauses 2-6 failed against the empty string, each naming its own pattern, e.g.:

```
AssertionError: ... expected '' to match /^on:\s*\n\s*schedule:/m
AssertionError: ... expected '' to contain '--skip-nx-cache'
AssertionError: ... expected '' to contain 'NO_COLOR'
```

**The `3 passed` is the point of Test 1, not a defect.** Two of them are the ABSENCE clauses
(no sidecar / no remote cache tier; no write permission / no actions scope), which pass trivially
against `''`. The third is the new `nx-target-inputs.spec.ts` registration pin, which correctly
PASSES because the `nx.json` entry landed in this same commit.

## Full-suite verification

```
 Test Files  2 failed | 39 passed (41)
      Tests  27 failed | 859 passed (886)
```

27 = 21 (three legs x seven clauses) + 6 (detector). Only two spec files fail --
`dogfood-cross-os.spec.ts` and `windows-regression-detector.spec.ts` -- so **no pre-existing test
changed state.** `npx nx format:check --all` exits 0. `npm run lint` prints
`Successfully ran target lint for project @op-nx/github-cache` and exits 0.

## The nx.json insertion index

Requested explicitly by the plan's `<output>` block. The detector entry sits at **index 19** of
`targetDefaults.test.inputs`, immediately after `{workspaceRoot}/.github/workflows/ci.yml` at
index 18. Verified programmatically:

```
node -e "...const b=i.indexOf('{workspaceRoot}/.github/workflows/windows-regression-detector.yml');if(b!==a+1){...}"
-> adjacent at 19   (exit 0)
```

Explicit path, no glob: `rg -c -F "{workspaceRoot}/.github/workflows/**" nx.json` returns exit 1
(absent).

## Files Created/Modified

- `packages/github-cache/src/windows-regression-detector.spec.ts` (created) - eight-clause shape
  guard over the XOS-05 detector workflow; `existsSync`-guarded read at `../../../` depth (flat
  `src/`, three `../` not four); one-occurrence multi-target success-line constant.
- `packages/github-cache/src/dogfood-cross-os.spec.ts` (modified, +234) - three per-leg describes
  plus a shared `windowsLegReasons` factory and `RENAME_NOTE`.
- `nx.json` (modified, +1) - detector workflow registered as a `test` input at index 19.
- `packages/github-cache/src/nx-target-inputs.spec.ts` (modified) - one literal registration pin
  with the comment lock explaining the same-commit boundary and the no-glob call.

## Decisions Made

Recorded in the frontmatter `key-decisions`. The five that matter downstream:

1. Three explicit describes, not `describe.each` -- independent failure reporting and `-t`
   selectability, which is what made three separate REDs observable.
2. Every clause indent-anchored and job-block-scoped; no file-wide clause is permitted because
   `windows-11-arm` occurs 19 times in `ci.yml`.
3. `existsSync`-guarded detector read, so the RED is a named assertion, not an ENOENT crash.
4. The plural three-target success needle, held in a single constant; the short prefix is vacuous.
5. Registration in the SAME commit as the guard, explicit path, no glob.

## Deviations from Plan

### 1. [Rule 3 - Blocking] The `toMatch(/^` acceptance criterion is prettier-shape-sensitive

- **Found during:** Task 1, verifying acceptance criteria.
- **Issue:** The criterion `rg -n "toMatch\(/\^" ... | wc -l` must increase by at least 18. My
  first draft wrote every assertion as `expect(jobBlock('build-windows'), reason.runsOn).toMatch(`
  with the regex on the following line -- prettier's last-argument expansion. That is a legitimate
  house shape (the shipped `o3-witness` describe uses it at `:318-322`), but it puts `toMatch(`
  and `/^` on different lines, so the criterion measured +3 instead of +30. Every regex WAS
  anchored; the mechanical proxy simply could not see it.
- **Fix:** Reshaped each `it` to hoist `const block = jobBlock('<leg>');` and destructure the
  reason strings at describe scope, which brings each assertion under 80 columns so prettier keeps
  `toMatch(/^...$/m)` on one line. No assertion was weakened, added or removed; only the receiver
  binding changed. Final count is 39 vs 9 at HEAD (+30), and `jobBlock('<leg>-windows')` call
  sites are 21 (criterion: >= 18).
- **Files modified:** `packages/github-cache/src/dogfood-cross-os.spec.ts`
- **Verification:** All six Task 1 acceptance criteria re-run and passing; `format:check` exits 0.
- **Committed in:** `13c5775`

### 2. [Rule 1 - Measurement correction] The word-boundary criterion does not measure what it reads like

- **Found during:** Task 1, verifying `rg -c "toMatch\(/\\\\b" ... returns nothing added`.
- **Issue:** Through Git Bash the pattern reaches `rg` as a word-boundary assertion, not as a
  literal backslash-b. It therefore matches `toMatch(/` followed by any word character -- i.e.
  every regex that does not start with punctuation -- and returned **14**, which reads like a
  failure. It is not: all 14 hits are pre-existing lines (`:83-107`, `:416-506`), and the count at
  `HEAD` is also 14.
- **Fix:** None needed in code. Recorded here so a later reader does not chase it. The criterion's
  INTENT (no new unanchored word-boundary pattern) holds: 14 before, 14 after.
- **Verification:** `git show HEAD:<file> | rg -c 'toMatch\(/\b'` = 14; working tree = 14.
- **Committed in:** n/a (measurement note only)

### 3. [Rule 3 - Blocking] `CI=true` needed to run the test target non-interactively

- **Found during:** Task 1, first RED capture.
- **Issue:** `nx.json` configures `@nx/vitest` with `testMode: "watch"`, so the inferred `test`
  target runs vitest in watch mode on a workstation and would never terminate.
- **Fix:** Every capture run was invoked as `CI=true NO_COLOR=1 npx nx run ...`. `CI` is NOT a
  `test` input (the explicit `targetDefaults.test.inputs` list replaces the inferred list, which
  is what drops `@nx/vitest`'s `{ env: 'CI' }`), so this does not perturb the task hash. CI itself
  sets `CI` already.
- **Files modified:** none
- **Verification:** All four captures terminated with exit 1 and printed a full summary.
- **Committed in:** n/a (invocation only)

### 4. [Rule 1 - Bug] `requirements.mark-complete` closed three requirements on a RED-only plan

- **Found during:** the state-update step.
- **Issue:** The executor's mechanical instruction is to pass this plan's frontmatter
  `requirements: [XOS-04, XOS-08, XOS-05]` to `gsd-tools query requirements.mark-complete`. Doing
  so flipped all three from `- [ ]` to `- [x]` in `REQUIREMENTS.md` and flipped the XOS-04
  traceability row from `Pending` to `Complete`. **All three are false.** This plan landed failing
  guards only: the Windows jobs are authored by 12-02, the detector workflow by 12-03, and XOS-05
  is explicitly live-CI-only and closes in 12-06. A `[x]` here would have fed a false `Complete`
  into the milestone audit's three-source cross-reference (VERIFICATION + SUMMARY + REQUIREMENTS)
  while nothing was implemented. It also left the file internally inconsistent -- the handler
  rewrote only the XOS-04 table row, because the XOS-05 and XOS-08 rows carry parenthetical text
  after `Pending` that its matcher did not recognise.
- **Fix:** Reverted all four lines with targeted `Edit`s. `git diff .planning/REQUIREMENTS.md` is
  now empty, i.e. the file is byte-identical to HEAD.
- **Files modified:** `.planning/REQUIREMENTS.md` (reverted to unchanged)
- **Verification:** `git diff --stat .planning/REQUIREMENTS.md` returns nothing.
- **Standing note for 12-02..12-06:** the "mark every requirement in the plan frontmatter" step
  must NOT be applied to a TDD RED plan. Requirements close when the GREEN plan lands, and XOS-05
  only when its live-CI observation is recorded.

### 5. [Rule 1 - Bug] `roadmap.update-plan-progress` appended a duplicate plan list

- **Found during:** the state-update step.
- **Issue:** ROADMAP's Phase 12 plan list uses the backtick-quoted descriptive form
  (`` - [ ] `12-01-PLAN.md` - RED: ... ``). The handler did not recognise it and inserted a second,
  bare list (`- [x] 12-01-PLAN.md` ... `- [ ] 12-06-PLAN.md`) above it, leaving twelve entries for
  six plans with the original six all still unchecked. It also wrote the progress-table row with a
  malformed cell separator (`In Progress|` and an empty date).
- **Fix:** Deleted the injected bare list, checked off `12-01-PLAN.md` in the existing descriptive
  list, and normalised the table row to `| 1/6 | In Progress | - |` matching the rows above it.
- **Files modified:** `.planning/ROADMAP.md`
- **Verification:** `git diff .planning/ROADMAP.md` shows exactly two hunks -- one `[ ]` to `[x]`
  and the table row.

---

**Total deviations:** 5 (1 shape correction, 1 measurement correction, 1 invocation, 2 GSD
state-tooling bugs caught and reverted). **No clause was weakened** -- the plan's `<output>` block
asks for any weakened clause and its reason, and the answer is none. Every assertion in the
`<behavior>` blocks shipped as specified. Deviations 4 and 5 touched no source file; both were
false planning-state writes, and both are worth carrying forward because the same two handlers run
at the end of every plan in this phase.

## Threat Flags

None. This plan adds no network endpoint, no auth path, no file-access pattern and no schema
change. `T-12-SC` verified rather than asserted: no `package.json` or `package-lock.json` was
touched and no package was installed. `T-12-04` re-checked and structurally absent -- this plan
writes no workflow YAML, so there is no `$GITHUB_ENV` sink to review.

## Issues Encountered

- The session was interrupted by a usage limit between the Task 1 edit and its commit. The edit
  survived uncommitted in the working tree and was picked up intact; no work was lost and nothing
  was re-done.
- `git checkout -- <file>` was denied by the permission classifier while reshaping the Task 1
  assertions (correctly -- it would have discarded the uncommitted deliverable). Reshaped in place
  with `Edit` instead, which is the better move regardless.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Plan 12-02** inherits 21 failing assertions that fully specify the three `ci.yml` Windows
  legs: job key, `runs-on: windows-11-arm`, a bare single-producer `needs:` scalar at four spaces,
  `timeout-minutes: 15`, the correct `npm run <target>` line at six spaces and neither of the
  other two, the sidecar `- uses: ./start-cache-server` / `- cancel: cache-server` pair, and NO
  job-level `if:`. Nothing about the sidecar block's interior is asserted, per the plan's explicit
  instruction not to add the deferred byte-identity guard.
- **Plan 12-03** inherits 6 failing assertions specifying the detector workflow, plus a `test`
  input registration that is already live -- so editing that workflow rotates the `test` hash from
  its first commit and no stale PASS is reachable.
- **Nothing is green that should be red.** HEAD is deliberately red on 27 assertions; that is the
  RED gate, and the RED-before-GREEN sequence is now on record with `test(12-01)` commits at
  `13c5775` and `91dbdc1`.

## Self-Check: PASSED

- `packages/github-cache/src/windows-regression-detector.spec.ts` - FOUND
- `packages/github-cache/src/dogfood-cross-os.spec.ts` - FOUND
- `packages/github-cache/src/nx-target-inputs.spec.ts` - FOUND
- `nx.json` - FOUND
- commit `13c5775` - FOUND
- commit `91dbdc1` - FOUND

---
*Phase: 12-windows-ci-reuse-o4-consumer-recipe*
*Completed: 2026-07-30*
