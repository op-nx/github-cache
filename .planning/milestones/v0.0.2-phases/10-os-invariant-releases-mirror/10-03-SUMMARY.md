---
phase: 10-os-invariant-releases-mirror
plan: 03
subsystem: infra
tags: [github-actions, workflow-needs, drift-guard, vitest, tdd]

# Dependency graph
requires:
  - phase: 10-01
    provides: the pre-rename baseline that had to be measured before any `main` push, which is why this plan could not land first
  - phase: 09-os-invariant-actions-cache-version
    provides: PARITY-08 -- `{workspaceRoot}/.github/workflows/ci.yml` in `targetDefaults.test.inputs`, without which both guards here replay a PASS computed before their subject existed
provides:
  - "`publish` declares `needs: [build, typecheck, test, integration]`, so one default-branch push mirrors that push's full task set instead of racing job completion"
  - the repo's FIRST assertion on any job's `needs:` VALUE, superset-proof by four independent per-producer cases
  - the `publish` comment's replacement justification (`!cancelled()`, the measured race, the bounded failure mode, two downstream consequences) locked as a phrase-keyed drift row
  - a retraction-scan scope that reaches this phase's edited SOURCE files, not only its prose
affects: [XOS-02 post-rename read verification, OBS-05 sampling, CORR-02, 10-VERIFICATION, 10-SECURITY]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A `needs:` VALUE assertion anchored at `^ {4}needs:` so the token must appear ON the needs line -- unanchored, `\\bbuild\\b` is satisfied by the job's own `- run: npm run build` step"
    - "One `it` per list member (not four `expect`s in one) so a revert mutation shows its 3-of-4 split instead of stopping at the first failure"
    - "`forbidden: []` chosen deliberately where an absence check would be satisfied by deleting the whole comment"

key-files:
  created: []
  modified:
    - .github/workflows/ci.yml
    - packages/github-cache/src/dogfood-cross-os.spec.ts
    - packages/github-cache/src/docs-same-os-claims.spec.ts

key-decisions:
  - "Task order INVERTED to 2 -> 3 -> 1: both guard specs were authored and committed RED against the un-widened `needs:`, and the `ci.yml` edit is the single GREEN commit for both. A workflow-YAML edit paired with a new guard spec is exactly the shape where the guard must go red first, and executing task 1 first would have made both REDs unreachable."
  - "Four SEPARATE `it` cases rather than `it.each` over a name array: an array member can be deleted silently, whereas four authored regexes cannot, and separate cases are what make the 3-of-4 mutation split observable at all."
  - "`forbidden: []` on the new drift row, not an absence check on the old `needs: build (NOT test)` phrase. An absence check there is satisfied by deleting the whole comment -- the exact failure the row exists to prevent -- and it would also have re-triggered the Phase 8 trap where the guard spells the token it forbids."
  - "The old narrow-`needs:` argument is RESTATED in the new comment, not merely replaced. Stating a rejected argument by name is what stops a future reader reconstructing it (D-23 clause (a), applied here)."

patterns-established:
  - "Positive control asserted on a value UNIQUE to the subject job (`publish`'s own `if:` expression) rather than on non-emptiness, so a wrong-but-non-empty block cannot satisfy it either"
  - "Two `ci.yml` harnesses, one question each: `jobBlock` (comment-stripped) for the VALUE, the phrase table (raw read) for the COMMENT. No third harness"

requirements-completed: [XOS-07]

coverage:
  - id: D1
    description: "The `publish` job declares all four producers, and `build` SURVIVES the widening -- each asserted independently so dropping any one reddens exactly one case"
    requirement: "XOS-07"
    verification:
      - kind: unit
        ref: "packages/github-cache/src/dogfood-cross-os.spec.ts#ci.yml publish waits on every job that produces a mirrored entry (XOS-07) > waits on build -- the SURVIVES clause, which a superset check cannot express"
        status: pass
      - kind: unit
        ref: "packages/github-cache/src/dogfood-cross-os.spec.ts#ci.yml publish waits on every job that produces a mirrored entry (XOS-07) > waits on typecheck"
        status: pass
      - kind: unit
        ref: "packages/github-cache/src/dogfood-cross-os.spec.ts#ci.yml publish waits on every job that produces a mirrored entry (XOS-07) > waits on test"
        status: pass
      - kind: unit
        ref: "packages/github-cache/src/dogfood-cross-os.spec.ts#ci.yml publish waits on every job that produces a mirrored entry (XOS-07) > waits on integration -- the two-leg matrix, so both OS legs finish first"
        status: pass
    human_judgment: false
  - id: D2
    description: "The extraction is proven to have captured the right job before anything is asserted about its contents, and a renamed/deleted job THROWS rather than returning an empty string that trivially satisfies every `toMatch`"
    requirement: "XOS-07"
    verification:
      - kind: unit
        ref: "packages/github-cache/src/dogfood-cross-os.spec.ts#ci.yml publish waits on every job that produces a mirrored entry (XOS-07) > scopes to a real publish job block"
        status: pass
    human_judgment: false
  - id: D3
    description: "The comment's replacement justification cannot be deleted silently: the mechanism, the bounded failure mode and the cited run id are each a phrase-keyed required row"
    requirement: "XOS-07"
    verification:
      - kind: unit
        ref: "packages/github-cache/src/docs-same-os-claims.spec.ts#every DOCS-08 site says what is true after VER-01/VER-03 (DOCS-08, OBS-04, XOS-07, D-31, D-32) > .github/workflows/ci.yml -- correction: MECHANISM: !cancelled() runs this job even when a needs: dependency FAILED."
        status: pass
    human_judgment: false
  - id: D4
    description: "The producer-attribution retraction scan reaches every source file this phase has already edited, not only its prose"
    requirement: "OBS-03"
    verification:
      - kind: unit
        ref: "packages/github-cache/src/docs-same-os-claims.spec.ts#the retracted producer-attribution claim appears in no edited file (OBS-03, D-33)"
        status: pass
    human_judgment: false
  - id: D5
    description: "LIVE: one default-branch push mirrors that push's FULL task set under the widened `needs:` -- the `publish` job starting only after `integration (windows-11-arm)` completes, and a post-push shard census containing every task hash from that push"
    verification: []
    human_judgment: true
    rationale: "`publish` is `push`-gated to the default branch, so NO PR run samples this at any rate. There is deliberately no pre-merge acceptance check: any check that could pass pre-merge would be passing for the wrong reason. Additionally, the `!cancelled()`-past-a-FAILED-`needs:` half is CITED from GitHub's docs and has never been reproduced in this repo, so it is falsifiable only by one push with a deliberately failing `test`."

# Metrics
duration: 15min
completed: 2026-07-29
status: complete
---

# Phase 10 Plan 03: What `publish` Waits On Summary

**`publish` now waits on every job that produces a mirrored entry, the comment that argued
against that supplies a replacement reason instead of a hole, and reverting either half reddens
a spec -- which before this plan neither did.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-29T10:56Z
- **Completed:** 2026-07-29T11:11Z
- **Tasks:** 3 of 3
- **Files modified:** 3

## Accomplishments

- `needs: build` -> `needs: [build, typecheck, test, integration]`. The race this removes is
  MEASURED: on run `30400231720` the `publish (ubuntu-24.04-arm)` leg enumerated the Actions
  cache ~122 s BEFORE `integration (windows-11-arm)` finished, and the shard carries the
  fingerprint -- task hash `8059758544828235640` exists ONLY as `8059758544828235640-windows`.
  The mirror has been completing only because the Windows publish leg happens to run second and
  slowly.
- **No `needs:` cycle, verified first-hand rather than inherited.** Every `needs:` line in
  `ci.yml` was read: the only five are `hash-parity-compare`, `dogfood-verify`,
  `dogfood-seed`(->`action-bundle-drift`), `publish` and `publish-verify`. `build`, `typecheck`,
  `test` and `integration` each declare none.
- **The comment is CORRECTED with a supplied replacement reason, in the same commit as the
  widening.** It carries the five clauses the plan required, and it RESTATES the old
  narrow-`needs:` argument rather than deleting it -- stating a rejected argument by name is what
  stops a future reader reconstructing it from scratch.
- **The repo's first `needs:` VALUE guard.** Before this plan, reverting XOS-07's widening
  reddened NOTHING; that is stated plainly in the spec's own doc block rather than implied.
- **The retraction scan now reaches CODE.** `EDITED_FILES` gained the six source files this
  phase has already edited, which is Phase 9's sweep lesson applied: a documentation-scoped scan
  missed `read-back.ts` and a `ci.yml` capacity comment, and both surfaced only after the sweep
  had declared itself complete.

## Task Commits

| Task | Commit | Kind | What |
|------|--------|------|------|
| 2 | `16e59bb` | test | RED -- the `needs:` VALUE guard against the un-widened value |
| 3 | `a0cf402` | test | RED -- the comment-lock drift row + the widened `EDITED_FILES` scope |
| 1 | `763d1de` | feat | GREEN -- the widened `needs:` and the rewritten comment |

No REFACTOR commit: nothing needed cleaning up.

## Which kind of RED was achieved

**ASSERTION-LEVEL in both TDD tasks, not import-level.** Named explicitly because plan 09-04's
RED was a whole-suite IMPORT failure, which proves the spec is wired to a real subject but
evaluates none of its new assertions.

| Task | RED evidence | Why it is assertion-level |
|------|--------------|---------------------------|
| 2 | `3 failed \| 7 passed (10)` | The file imported and 7 cases executed and passed -- including the new positive control and the new `waits on build` case. The three failures were per-assertion regex mismatches against the real `needs: build` line. |
| 3 | `3 failed \| 27 passed (30)` | 27 sibling cases in the same file executed and passed, including all six NEW retraction cases. The three failures were the new row's `required` phrases, each printing the missing phrase against the real file contents. |

## How the guard is proven NOT superset-satisfiable

This is the failure mode the plan flagged as the easiest way to ship a worthless guard here, so
it is proven three ways rather than asserted:

1. **By construction.** A `toMatch` against a `needs:` LIST is satisfied by any SUPERSET, so one
   assertion looking for `integration` would pass against `needs: [integration]` alone -- a
   rewrite that DROPPED `build`. Each of the four producers therefore gets its OWN case, `build`
   included. `build` surviving is the half a single-member check structurally cannot express.
2. **By the observed 3-of-4 mutation split.** Reverting to `needs: build` reddens `typecheck`,
   `test` and `integration` and leaves `waits on build` GREEN. A guard that was merely
   superset-satisfied would have shown 4-of-4 or 0-of-4; the asymmetry is what demonstrates each
   member is independently pinned. Predicted before running, then observed.
3. **By anchoring, which closes a second hole the plan did not name.** Each pattern is anchored
   at `^ {4}needs:` so the token must appear ON the `needs:` line. UNANCHORED, `\bbuild\b` is
   already satisfied by this same job's `- run: npm run build` step -- the `build` case would
   have been a tautology and mutation 1 would have shown a misleading 3-of-4 for the wrong
   reason. Recorded in the spec's doc block so a later "simplification" does not remove it.

Separate `it` cases (not four `expect`s in one) are load-bearing for point 2: vitest stops at
the first failing `expect`, so a single combined case would have reported `1 failed` and the
split would have been unobservable.

## Mutation checks (predicted first, then observed)

All three were applied to the working tree, OBSERVED first-hand, and reverted. GREEN was
committed BEFORE any mutation, per plan 10-02's recorded lesson -- so every revert was a revert
to the intended state and nothing was committed mutated.

| Mutation | Predicted | Observed | Verdict |
|----------|-----------|----------|---------|
| `needs:` reverted to `build` | exactly 3 of the 4 dependency cases redden, `build` stays green, nothing else | `3 failed \| 691 passed (694)`: `waits on typecheck`, `waits on test`, `waits on integration`. `waits on build` and the positive control green. Zero other files affected. | as predicted |
| `publish:` job key renamed to `publish-mirror:` | `jobBlock` THROWS rather than returning an empty string that trivially satisfies every `toMatch` | all 5 XOS-07 cases fail with `Error: ci.yml: no job keyed \`  publish:\` -- VER-06's guard cannot scope its assertions`. A throw, never a silent pass. The regex also did NOT drift onto the sibling `publish-verify:` key. | as predicted |
| replacement-reason clause deleted from `ci.yml`, widened `needs:` kept | exactly the new drift row's 3 `required` assertions redden | `3 failed \| 691 passed (694)`, the three being the new row's phrases. The value guard stayed GREEN with `needs: [build, ...]` still in place -- which is the positive demonstration that the two harnesses answer INDEPENDENT questions. | as predicted |

Suite confirmed back to `38 passed (38)` / `694 passed (694)` after the final revert.

## Two harnesses, and why neither could do the other's job

Measured, not assumed (10-PATTERNS Tier 3 item 10 predicted it and it held):

| Question | Harness | Why the other one cannot |
|----------|---------|-------------------------|
| the `needs:` VALUE | `dogfood-cross-os.spec.ts`'s `jobBlock` | `docs-same-os-claims.spec.ts`'s `read()` is RAW, so a value match there is also satisfied by `ci.yml`'s own COMMENTS -- including the new comment, which spells `needs: [build, typecheck, test, integration]` in prose |
| the COMMENT phrase | `docs-same-os-claims.spec.ts`'s phrase table | `jobBlock`'s `codeLines` filters out every line whose trimmed form starts with `#`, so it structurally cannot see a comment. A comment lock placed there is vacuous by construction |

No third harness was built. Mutation 3 is the empirical proof the split is real: it reddened one
harness and left the other green.

## Decisions Made

- **Task order INVERTED to 2 -> 3 -> 1.** See Deviations. Both guards went RED against the
  un-widened `needs:`; the `ci.yml` edit is the single GREEN commit for both.
- **Four authored `it` cases, not `it.each` over a name array.** An array member can be deleted
  silently while the harness still looks intact; four authored regexes cannot. The extra
  repetition buys the mutation observability described above.
- **`forbidden: []` on the new drift row, deliberately.** An absence check on the old
  `needs: build (NOT test)` phrase would be SATISFIED BY DELETING THE WHOLE COMMENT -- the exact
  failure the row exists to prevent -- and it would also have re-triggered the Phase 8 trap where
  the guard spells the token it forbids. Recorded in the row's doc-comment so a later tidy does
  not "strengthen" it into uselessness. Consequently no new `forbidden` regex exists, so the
  single-character character-class contortion was not needed anywhere in this plan.
- **The positive control asserts a value UNIQUE to `publish`** (its own `if:` expression), not
  merely non-emptiness. A `jobBlock` that returned the WRONG non-empty block would otherwise have
  every later clause asserting about a different job.
- **The `if: !cancelled() && push` trust-gate sentence was moved up, above the new block.** It is
  about D-01 (the in-process `isSyncTrusted` gate), not about `needs:`, and leaving it stranded
  mid-paragraph after a 30-line insertion would have read as part of the widening argument. The
  sentence's text is unchanged.
- **`!cancelled()`-past-a-FAILED-`needs:` is recorded as CITED, never as verified.** RESEARCH A-1
  logs it as unreproduced in this repo. The comment says so, and states the bounded downside: a
  SKIPPED mirror, never a wrong artifact.

## Deviations from Plan

### 1. [Rule 3 - Sequencing] Tasks executed 2 -> 3 -> 1 rather than 1 -> 2 -> 3

- **Found during:** execution planning, before any edit
- **Issue:** Task 1 is the `ci.yml` edit; tasks 2 and 3 are the guards that must redden when that
  edit is absent. Running task 1 first makes both REDs unreachable -- the guards would have been
  authored against an already-green subject, which is the import-level-RED shape the mode flags
  explicitly warn against.
- **Fix:** authored and committed both guards RED first (`16e59bb`, `a0cf402`), then landed
  `ci.yml` as the single GREEN commit (`763d1de`).
- **Authority:** the plan's own task 2 `<action>` sanctions it in as many words ("or against the
  pre-task-1 state if this task is executed before task 1 lands"). Task 3 is the same shape and
  is treated identically.
- **Cost:** HEAD was red for two commits. That is what a `test(...)` RED commit means, and no
  hook runs tests in this repo (`core.hooksPath` delegates to a repo-local `.githooks/` that does
  not exist), so nothing was bypassed and `--no-verify` was never used.
- **Files modified:** none beyond the plan's three.

### 2. [Documentation] Two acceptance criteria measure LINES where they mean OCCURRENCES

- **Found during:** task 2 and task 3 acceptance verification
- **Criteria:** `rg -c "jobBlock\('publish'\)" ... >= 2` and `rg -c "bucket: 'correction'" ...`
  is one greater than before.
- **Issue:** `rg -c` counts matching LINES, not occurrences -- the standing project lesson that
  invalidated two Phase 9 acceptance criteria.
- **Resolution:** both were measured with `rg -o ... | wc -l` instead. `jobBlock('publish')`
  occurs **5** times (>= 2 satisfied), and `bucket: 'correction'` went **3 -> 4** (exactly one
  greater). Both happen to be one-per-line here, so the two readings agree -- but they were
  measured the correct way rather than assumed to agree.
- **Committed in:** no code change.

---

**Total deviations:** 2 (1 sequencing, pre-authorised by the plan; 1 criterion-measurement
correction). No prohibition breached, no scope creep, no requirement claimed beyond what was
measured.

## Prohibitions: verified held

| Prohibition | Held? | Evidence |
|-------------|-------|----------|
| No bare `toMatch` for one member and stop | yes | four separate cases, one per producer, `build` included; proven by the 3-of-4 split |
| No COMMENT phrase assertion in `dogfood-cross-os.spec.ts` | yes | the new describe asserts only `if:` and `needs:` YAML values; the doc block records WHY a comment lock there is vacuous |
| No YAML VALUE assertion in `docs-same-os-claims.spec.ts` | yes | the new row's three phrases are all comment prose (`MECHANISM:`, `BOUNDED FAILURE MODE:`, `MEASURED on run`) |
| No third `ci.yml` harness | yes | `git grep -n "function jobBlock"` still returns exactly one hit; no new reader was added |
| Old justification not deleted without a replacement | yes | the new comment restates the old argument AND supplies the mechanism, the measurement, the bounded failure mode and both downstream consequences -- all in `763d1de`, the same commit as the widening |
| No non-existent file in `EDITED_FILES` | yes | all ten entries resolve on disk; `mirror-seed.ts` and `release-asset-name.integration.spec.ts` deliberately absent, with a comment saying which plans add them |
| No new `forbidden` regex spells its own phrase | yes | no new `forbidden` regex exists at all (`forbidden: []`) |
| `max-parallel: 1` and its comment untouched | yes | `rg -c 'max-parallel' packages/github-cache/src/dogfood-cross-os.spec.ts` returns 0 (exit 1, genuine absence); the `ci.yml` diff has exactly two hunks and neither touches it |
| `publish-verify` comment and shard-growth estimate untouched | yes | `git diff -U0` shows hunks only at the publish leading comment and its `needs:` line |
| ASCII only | yes | no non-ASCII in any edited file or commit message |

## ROBUST-04 / bundle obligation: ZERO, measured

No `serve()`-reachable source is touched -- the three edited files are a workflow YAML and two
spec files. `git diff --stat -- start-cache-server/index.js` prints nothing at HEAD.
`npm run build:action` was correctly NOT run.

## Threat model: no new surface

`needs:` gates job ORDERING, never capability. The load-bearing write gate is `isSyncTrusted`
re-checking the default branch IN-PROCESS (C2) plus the job-level `if:` on the push trigger;
neither is touched and the job's `permissions` block is unchanged. The set of tasks routed
through the sidecar is unchanged, so TRUST-12's exposure delta is unchanged -- widening `needs:`
only removes a timing race that was already resolving in favour of mirroring those entries. No
new packages, no `package.json` or lockfile edit, no installer run. T-10-16 (a vacuously-passing
guard) was the one `mitigate` disposition here and it is closed by the positive control, the four
independent cases and the three recorded mutation checks.

## Verification at HEAD (`763d1de`)

| Check | Result |
|-------|--------|
| `nx run @op-nx/github-cache:test --skip-nx-cache` | `Test Files 38 passed (38)`, `Tests 694 passed (694)` |
| `npm run typecheck -- --skip-nx-cache` | pass |
| `npm run lint -- --skip-nx-cache` | pass |
| `npx nx format:check` | pass (prettier preserved the flow-sequence `needs:` list) |
| `git diff --stat -- start-cache-server/index.js` | empty |
| `git diff --diff-filter=D --name-only` on each commit | empty -- no file deletions |

`--skip-nx-cache` is not optional on any of these: Phase 9 measured a stale `Cache: 2/2 hit`
PASS after a spec-only edit.

## Human verification needed (XOS-07's live half)

**LIVE CI, push-to-`main` only. There is deliberately NO pre-merge acceptance check** -- `publish`
is `github.event_name == 'push'`-gated, so no PR run samples it at any rate, and any check that
could pass pre-merge would be passing for the wrong reason.

After the next default-branch push, look at two things:

1. **Ordering.** The `publish` job starts only AFTER `integration (windows-11-arm)` completes.
   Compare against run `30400231720`, where it started 122 s earlier.
2. **Census.** `gh api repos/op-nx/github-cache/releases/tags/cache-mirror-<YYYYMM>` lists every
   task hash from that push, with no hash appearing under only one OS suffix.

A third observation is falsifiable only by a deliberate experiment and is NOT requested here:
one push with a failing `test` leg would confirm `!cancelled()` really does run `publish` past a
FAILED dependency. Until then that half stays CITED, with the bounded downside (a skipped
mirror, never a wrong artifact) written into the workflow comment.

## Self-Check: PASSED

All three modified files exist on disk. All three task commits (`16e59bb`, `a0cf402`, `763d1de`)
are present in `git log --all`. `.planning/config.json` was modified before this plan started and
was never staged. This file is ASCII-clean.
