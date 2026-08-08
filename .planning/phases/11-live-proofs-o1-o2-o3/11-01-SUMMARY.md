---
phase: 11-live-proofs-o1-o2-o3
plan: 01
subsystem: testing
tags: [nx, task-graph, createTaskGraph, run.json, cacheStatus, hash-neutrality, evidence]

# Dependency graph
requires:
  - phase: 08-nx-task-hash-parity
    provides: capture-hashes.mjs -- the createProjectGraphAsync -> createTaskGraph call site, the hand-rolled parseArgs, the --out writer, and the missing-task throw shape all reused here
  - phase: 10-os-invariant-releases-mirror
    provides: D-14's live retraction of `mirrored-by` as a producer attributor, which is what makes the graph premise load-bearing rather than a nicety
provides:
  - "capture-hashes.mjs --assert-graph-premise: TEST-08's mechanical premise assertion over the RESOLVED task graph, with D-13's mandatory non-vacuity control"
  - "11-task-graph-premise.json: the captured assertion output TEST-08 requires as evidence"
  - "read-integration-hash.mjs: the D-17 step (b) reader that lifts the integration task's hash and cacheStatus out of .nx/cache/run.json and throws on both silent-absence paths"
  - "A mechanically-confirmed hash-neutrality result: neither edited path matches any of nx.json's 21 workspace-root inputs, so the perishable O1/O2 window is intact"
affects: [11-02, 11-03, 11-04, 11-06, 11-07, o3-witness, ci.yml integration job]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Non-vacuity control chosen per-target rather than copied: `typecheck` over `test`, because only the former resolves a FORBIDDEN member"
    - "One `observed` suffix built once and appended to every throw, so no failure path can forget to enumerate what was seen"
    - "Predict-then-observe-then-revert as the redness proof where a permanent spec would cost the measurement window"

key-files:
  created:
    - read-integration-hash.mjs
    - .planning/phases/11-live-proofs-o1-o2-o3/11-task-graph-premise.json
  modified:
    - capture-hashes.mjs

key-decisions:
  - "The negative control is `typecheck`, not CONTEXT.md's parenthetical `test`: test's dependsOn is ^build (dependencies' build, none in this single-project workspace) so it resolves ONE task and never proves the resolver expands dependsOn, while typecheck's inferred [build, ^typecheck] resolves TWO, one of them a FORBIDDEN member"
  - "The control's COUNT (exactly 2) is asserted alongside its membership, so an Nx upgrade that changes the inferred dependsOn fails loud instead of quietly weakening the control"
  - "The target segment is taken after the LAST colon, never by substring-matching the task id, because PROJECT is scoped and a future :build-deps would false-positive"
  - "--assert-graph-premise rejects --install-mode (the mode measures no hash) but ACCEPTS --out, which is the evidence channel TEST-08's captured-output clause needs"
  - "capture's inline --out-or-stdout writer was DUPLICATED rather than extracted to a shared helper: extraction would edit the capture path that plan 11-02's irreplaceable warm capture depends on, and verifying that refactor would mean running the warm capture this plan does not own"
  - "No npm script added: root package.json is an nx.json `test` input, and capture:hashes already forwards -- arguments"
  - "read-integration-hash.mjs writes the BARE hash with no trailing newline, because the consumer interpolates it into a cache key and a stray newline is a different key"

patterns-established:
  - "Fourth mode on capture-hashes.mjs: mode dispatch at the file tail declares its mutual exclusion with --install-mode and says why, mirroring --diff"
  - "Root-level .mjs as the home for a hash-neutral measurement instrument: reason (b) of capture-hashes.mjs's header (an Nx-cached instrument replays instead of measuring) generalises to any reader"
  - "A verification script that asserts an absence carries its own positive control, so two negative results cannot be vacuous -- D-13's discipline applied reflexively to the check itself"

requirements-completed: [TEST-08]

coverage:
  - id: D1
    description: "capture-hashes.mjs --assert-graph-premise resolves the Windows CI leg's actual command (nx run-many -t integration) and asserts over the RESOLVED task graph that no build, typecheck or test task appears in it (D-12)"
    requirement: TEST-08
    verification:
      - kind: integration
        ref: "node capture-hashes.mjs --assert-graph-premise --out .planning/phases/11-live-proofs-o1-o2-o3/11-task-graph-premise.json (exit 0; record verdict === 'PREMISE OK'; integration.taskIds === ['@op-nx/github-cache:integration'])"
        status: pass
    human_judgment: false
  - id: D2
    description: "The same run carries D-13's mandatory negative control, which DOES resolve a forbidden target, so a resolver that resolves nothing cannot pass"
    requirement: TEST-08
    verification:
      - kind: integration
        ref: "same invocation; control.taskIds === ['@op-nx/github-cache:build','@op-nx/github-cache:typecheck'] -- exactly 2 members, one of them a FORBIDDEN_TARGETS member, and the set differs from the integration set"
        status: pass
      - kind: integration
        ref: "predict-then-observe-then-revert: FORBIDDEN_TARGETS temporarily gained 'integration'; observed exit 1 with assertion 2's message enumerating the observed integration task-id set; mutation reverted, no trace in the committed state"
        status: pass
    human_judgment: false
  - id: D3
    description: "The assertion output is written to a JSON record on disk, not printed and discarded (TEST-08's own words)"
    requirement: TEST-08
    verification:
      - kind: integration
        ref: ".planning/phases/11-live-proofs-o1-o2-o3/11-task-graph-premise.json committed in b2dfaa8; parsed and asserted by the plan's own verify block (verdict, control set size 2, non-empty integration set)"
        status: pass
    human_judgment: false
  - id: D4
    description: "A committed root-level reader extracts the integration task hash and cacheStatus from .nx/cache/run.json and THROWS on absence rather than yielding an empty hash (D-17 step b)"
    requirement: TEST-08
    verification:
      - kind: integration
        ref: "three scratchpad fixtures with no nx invocation: run-integration-ok.json -> exit 0, 19-byte bare hash, stdout line carrying hash + remote-cache-hit + status; run-lint.json -> exit 1 quoting the observed command; run-integration-missing-task.json -> exit 1 enumerating 'build'"
        status: pass
      - kind: integration
        ref: "absent-file path: node read-integration-hash.mjs <nonexistent> <out> -> exit 1 and no output file written; no-args against this tree's real (lint) run.json -> exit 1 via guard 1"
        status: pass
    human_judgment: false
  - id: D5
    description: "Neither edit rotates any Nx task hash, so the perishable O1/O2 window is untouched (D-10 row 4, D-11)"
    requirement: TEST-08
    verification:
      - kind: integration
        ref: "node:path matchesGlob over all 21 {workspaceRoot} inputs walked out of nx.json: capture-hashes.mjs and read-integration-hash.mjs match NONE, with eslint.config.mjs as a live positive control (1 match) so the negatives are not vacuous"
        status: pass
      - kind: integration
        ref: "git status --porcelain packages/ .github/ start-cache-server/ printed nothing after both task commits; .nx/workspace-data still 18 entries and .nx/cache still 86 entries; no nx run-many/test/build/reset invoked anywhere in this plan"
        status: pass
    human_judgment: false

# Metrics
duration: 7min
completed: 2026-07-29
status: complete
---

# Phase 11 Plan 01: Hash-Neutral Instruments Summary

**TEST-08's premise now ASSERTED over the resolved Nx task graph -- `nx run-many -t integration` provably resolves one task and no `build`/`typecheck`/`test` -- with a `typecheck` negative control proven to bite, plus a `run.json` reader that throws on both of Nx's silent-absence paths. Both edits mechanically confirmed to match none of nx.json's 21 workspace-root inputs, so the perishable O1/O2 window is intact.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-07-29T20:48:06Z
- **Completed:** 2026-07-29T20:55:28Z
- **Tasks:** 2
- **Files modified:** 3 (1 modified, 2 created)

## Accomplishments

- **The graph premise is now an assertion, not an assumption.** `capture-hashes.mjs --assert-graph-premise` resolves the Windows CI leg's actual command through Nx's own `createTaskGraph` and asserts, over the RESOLVED graph, that it contains no `build`, `typecheck` or `test` task. Measured result: `@op-nx/github-cache:integration`, one task, no forbidden member. This is D-14 attribution row 1 -- the only one of the four means that is structural rather than observational, and the one that licenses "any such hash in the store is Linux-produced".
- **D-13's non-vacuity control is proven to bite, by observation rather than prediction.** The `typecheck` control resolves exactly `{@op-nx/github-cache:build, @op-nx/github-cache:typecheck}` -- two tasks, one of them a `FORBIDDEN_TARGETS` member, differing from the `integration` set. Then `integration` was temporarily added to `FORBIDDEN_TARGETS`, the predicted red was observed, and the mutation was reverted.
- **The assertion output is captured, not discarded.** `11-task-graph-premise.json` is committed under `.planning/`, which TEST-08 asks for in its own words.
- **`read-integration-hash.mjs` closes both of Nx's silent-absence paths.** Nx writes `run.json` inside a try/catch that swallows every error unless `NX_VERBOSE_LOGGING`, and `if-no-files-found: error` only checks that a file exists -- so an empty hash would have uploaded cleanly. Guard 1 rejects a `run.json` produced by any other `nx` invocation; guard 2 throws and enumerates the observed target names. Verified against three fixtures plus the ENOENT path with zero `nx` invocations.
- **Hash-neutrality is now a measured result, not a re-derivation.** A `node:path` `matchesGlob` sweep over all 21 `{workspaceRoot}` inputs walked out of `nx.json` confirms neither edited file matches any of them, with `eslint.config.mjs` as a live positive control so the two negatives cannot be vacuous.

## Task Commits

Each task was committed atomically:

1. **Task 1: Add the --assert-graph-premise mode to capture-hashes.mjs (D-12, D-13)** - `b2dfaa8` (feat)
2. **Task 2: Create read-integration-hash.mjs, the run.json reader (D-17 step b)** - `ab41e46` (feat)

## Files Created/Modified

- `capture-hashes.mjs` - MODIFIED. Fourth mode `--assert-graph-premise`; new module constants `FORBIDDEN_TARGETS` and `CONTROL_TARGET`; new helpers `resolvedTaskIds` and `targetSegment`; new `assertGraphPremise`; one new `parseArgs` key/branch/usage line; one new dispatch branch. The `capture` and `diff` functions are untouched.
- `read-integration-hash.mjs` - CREATED. Root-level, dev+CI, two optional positionals (`run.json` path, output path) defaulting to `.nx/cache/run.json` and `integration-hash.txt`. Two throwing guards, bare-hash write, one stdout line carrying hash + `cacheStatus` + `status`.
- `.planning/phases/11-live-proofs-o1-o2-o3/11-task-graph-premise.json` - CREATED. The captured assertion output: `verdict: "PREMISE OK"`, both resolved task-id sets, `forbiddenTargets`, and provenance (commit `7d90907`, win32/arm64, Nx 23.1.0, Node v24.13.0).

## The observed failure message from the mutation check (verbatim)

The plan requires this recorded verbatim rather than predicted. With `integration` temporarily appended to `FORBIDDEN_TARGETS`, `node capture-hashes.mjs --assert-graph-premise` exited **1** and printed to stderr:

```
Error: capture-hashes: --assert-graph-premise FAILED assertion 2 -- `nx run-many -t integration` resolves forbidden target(s) @op-nx/github-cache:integration. TEST-08's premise is that the Windows CI leg resolves no build/typecheck/test/integration task, so any such hash in the store is Linux-produced (D-12, D-14 row 1). With this false, that attribution is withdrawn. Observed `nx run-many -t integration` set (1): @op-nx/github-cache:integration. Observed `nx run-many -t typecheck` control set (2): @op-nx/github-cache:build, @op-nx/github-cache:typecheck.
```

Note that the message enumerates BOTH observed sets, and that the forbidden-target list in the message shows the mutated four-element form -- the message is built from the constant, so it cannot drift from what was actually asserted. The mutation was reverted and `git diff -- capture-hashes.mjs` shows the committed state carries the three-element form only.

## Pre-registered values, and what was measured

| Quantity | Pre-registered | Measured | Value under the failure hypothesis |
|---|---|---|---|
| `integration` resolved task-id set size | non-zero | **1** | 0 (a resolver that resolves nothing) |
| Forbidden members in the `integration` set | 0 | **0** | >= 1 (the premise is false; attribution withdrawn) |
| `typecheck` control set size | exactly 2 | **2** | 1 (Nx changed the inferred dependsOn; control weakened) |
| Control set members | `<PROJECT>:build`, `<PROJECT>:typecheck` | **both, exactly** | any other set |
| Control set intersects FORBIDDEN | yes | **yes (`build`)** | no (assertion 2 becomes vacuous) |
| Control set differs from `integration` set | yes | **yes** | identical (resolver ignores its input) |
| Reader fixture outcomes | 1 pass, 2 throws | **1 pass, 2 throws** | 3 passes (guards absent) or 3 throws (reader broken) |
| Output-file bytes for the OK fixture | 19, no whitespace | **19, `"1234567890123456789"`** | 20 (trailing newline -> a different cache key) |
| `nx.json` workspace-root inputs matching either edited file | 0 | **0 of 21** | >= 1 (an edit rotates a proof hash) |
| Positive control for that sweep (`eslint.config.mjs`) | >= 1 | **1** | 0 (the matcher matches nothing; negatives vacuous) |
| `.nx/workspace-data` entries after this plan | 18, unchanged | **18** | 0 (window destroyed) |
| `.nx/cache` entries after this plan | 86, unchanged | **86** | 0 (window destroyed) |

## Decisions Made

- **The negative control is `typecheck`, not `test`.** CONTEXT.md D-13's parenthetical suggests `nx run-many -t test`; RESEARCH.md establishes that is the weaker choice, and this plan implements the stronger one. `test`'s `dependsOn` is `^build` -- *dependencies'* build, of which a single-project workspace has none -- so it resolves ONE task, clearing bare vacuity without demonstrating that the resolver expands `dependsOn` at all. `typecheck` carries an inferred `dependsOn: ["build", "^typecheck"]`, so it resolves TWO tasks, one of them a `FORBIDDEN_TARGETS` member. That intersection is what makes assertion 2 meaningful.
- **The control's count is asserted separately from its membership.** Assertion 4 (membership) logically subsumes assertions 3 (count) and 5 (intersection), but all three are evaluated independently so a failure names *which* property broke rather than reporting one collapsed mismatch. This mirrors `dogfood-cross-os.spec.ts`'s split-per-member discipline.
- **`capture`'s `--out`-or-stdout writer was duplicated, not extracted.** Extracting it to a shared helper would be the smaller diff and the DRY-er choice, and it was the first thing considered. It was rejected: the extraction edits the `capture` path that plan 11-02's warm capture depends on, that capture is irrecoverable once the box is reset, and verifying the refactor would mean *running* the warm capture -- which this plan does not own. Ten duplicated lines is the cheaper risk. Recorded here so a later reader sees a decision rather than an oversight.
- **The mutual exclusion is asymmetric on purpose.** `--assert-graph-premise` rejects `--install-mode` (the mode measures no hash, so recording an install mode would make the record claim provenance it never measured) but accepts `--out`, because `--out` is the existing evidence channel and TEST-08 requires the assertion output captured.
- **The reader takes positionals, not flags.** Its two defaults are exactly what the wave-6 `ci.yml` steps rely on; the overrides exist so the three fixture cases run with no `nx` invocation. A flag parser here would be machinery for two arguments.
- **The reader writes the bare hash with no trailing newline.** The consumer is `cat integration-hash.txt` interpolated into a cache key, and a stray newline is a different key. Asserted at the byte level (19 bytes) rather than by string comparison, which would have passed on a trailing newline.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Reverted a premature `TEST-08` completion checkbox in REQUIREMENTS.md**

- **Found during:** the post-task state-update step (not inside either task)
- **Issue:** the execute-plan workflow instructs `requirements mark-complete` with every ID in the plan's `requirements:` frontmatter, which for this plan is `[TEST-08]`. That flipped REQUIREMENTS.md:473 to `- [x] **TEST-08**`. TEST-08's own text is "Each of **O1-O4** has a recorded live proof executed in the mandated order", and after plan 11-01 **zero** of those live proofs exist -- O1/O2 are plans 11-02/11-03, O3 is 11-06/11-07, and **O4 is not in Phase 11's scope at all** (ROADMAP assigns XOS-04/05/08 to Phase 12). Plan 11-01 delivers only TEST-08's *mechanical graph assertion* clause; six of this phase's seven plans carry TEST-08 in their frontmatter.
- **The decisive evidence that the flip was wrong:** REQUIREMENTS.md's own traceability table, line 654, was left untouched by the tool and still reads `| TEST-08 | Phase 11 | Pending (O4 evidence row appended in Phase 12) |`. The checkbox flip therefore contradicted the same file's traceability row.
- **Why it matters rather than being cosmetic:** the milestone audit closes requirements through a 3-source cross-reference (VERIFICATION + SUMMARY + REQUIREMENTS). A `[x]` here asserts the O1-O4 live proofs are recorded when none are, which is precisely the "recorded green instead of a falsifiable number" failure this phase exists to stamp out -- and it would have asserted it about a requirement that cannot be satisfied until Phase 12.
- **Fix:** `git checkout -- .planning/REQUIREMENTS.md`, a single named file that was otherwise clean at HEAD. No blanket reset was used. TEST-08 stays OPEN; the plan that genuinely closes its Phase 11 clauses is 11-07, and the traceability row's own words keep it Pending until Phase 12's O4 evidence lands.
- **Verification:** `git status --porcelain .planning/REQUIREMENTS.md` prints nothing; `git grep` confirms line 473 is `- [ ] **TEST-08**` again.
- **Committed in:** not committed -- the fix is the ABSENCE of a change, so REQUIREMENTS.md is deliberately excluded from this plan's metadata commit.

**Note for whoever runs 11-02 through 11-07:** the same blanket `mark-complete` will fire again on each of them. It is correct to let it flip TEST-08 only once the phase's proofs are actually recorded (11-07), and to leave the line-654 traceability row Pending regardless, since O4 is Phase 12's.

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** No scope change and no code touched. The fix protects the requirement-closure audit trail from a false claim; nothing was added.

Two further items are worth naming because a reader could mistake either for a deviation, and neither is:

1. **No `test(...)` RED commit exists for either task.** This is the plan's own explicit design, not a skipped gate. Both tasks carry `tdd="true"`, but the plan's `## Decisions implemented` section states that an every-commit Vitest version of the premise assertion is DELIBERATELY not built here, with two reasons: TEST-08 asks for a mechanical assertion whose output is captured rather than a permanent gate, and a spec under `packages/` would rotate three of the four proof hashes (D-10 row 2) inside the window this plan exists to protect. See `## TDD Gate Compliance` below for how RED was reached instead.
2. **A `node:path` `matchesGlob` sweep was added to the verification.** The plan's `<verification>` asks for the hash-neutrality claim by re-derivation from `nx.json`. The sweep is a strictly stronger, zero-cost mechanical form of the same check and lives in the session scratchpad, not the repository -- so it adds no file, no dependency and no hashed input. Its first form used a hand-rolled regex, which false-positived on `{workspaceRoot}/tools/eslint-rules/**/*` (a subdirectory-scoped glob that cannot match a workspace-root file); it was replaced with a real glob matcher plus a positive control before its result was trusted.

## TDD Gate Compliance

Both tasks are marked `tdd="true"`, and the RED gate was reached for both -- but not via a `test(...)` commit, because the plan forbids the artifact that would carry one.

| Task | RED (observed, not predicted) | GREEN |
|---|---|---|
| 1 | `integration` appended to `FORBIDDEN_TARGETS`; ran the mode; observed exit 1 and assertion 2's message naming the observed `integration` task-id set; reverted. Verbatim message recorded above. | Reverted code exits 0 and writes `verdict: "PREMISE OK"`; the plan's own verify block parses and asserts the record. |
| 2 | Three fixtures authored FIRST, then the verify block run against the not-yet-existing reader: observed exit 1 with `Cannot find module`. | Reader created; 1 pass + 2 throws, plus the ENOENT path and the no-args path against this tree's real (lint) `run.json`. |

**Why no permanent gate, restated so it is not read as debt:** the mode's own six assertions run on every invocation and all six throw. The instrument carries its own non-vacuity control internally, which is the runnable check that stands in for a spec. CONTEXT.md's `<deferred>` list owns the every-commit Vitest version with a reason.

## Issues Encountered

- **My first hash-neutrality check was wrong in the safe direction, and its own positive control is what would have caught it either way.** A hand-rolled regex classified `{workspaceRoot}/tools/eslint-rules/**/*` as a pattern that could match a root `.mjs`, producing a false BLOCK rather than a false pass. Replaced with `node:path`'s `matchesGlob` and given an `eslint.config.mjs` positive control. Worth recording because it is the same failure family the phase is about: an absence check whose matcher does not match is indistinguishable from a genuine absence.
- **`git commit -m` was not used.** Per the recorded Dev Drive (ReFS) `COMMIT_EDITMSG` "Invalid argument" hazard, both commits used `git commit -F <file>` with the message authored via the Write tool into the session scratchpad. No failure was hit as a result.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Plan 11-02 is unblocked, and the state it needs is intact.** The measurement window it opens is untouched: `.nx/workspace-data` still holds 18 entries and `.nx/cache` 86, so the box is still WARM and 11-02's irrecoverable warm capture is still available. No `nx run-many`, `nx test`, `nx build` or `nx reset` was invoked anywhere in this plan; only `node` and `npx prettier`.

Handed forward:

1. **To 11-04 (attribution):** `11-task-graph-premise.json` is the committed evidence for D-14 attribution row 1. Transcribe the verdict and both task-id sets; do not re-run the mode to produce a second record at a different commit.
2. **To 11-06 (`ci.yml`):** `read-integration-hash.mjs` exists at the workspace root with the two defaults the steps rely on -- `.nx/cache/run.json` and `integration-hash.txt`. The read step must be the IMMEDIATELY next step after `npm run integration`, with no `nx` call in between; guard 1 will reject a `run.json` from any other invocation, which is the intended failure and not a bug to work around. Its stdout line already carries `cacheStatus`, so no separate probe is needed for D-17 step (a)'s recorded observation.
3. **To 11-05:** `docs-same-os-claims.spec.ts` is deliberately UNCHANGED, and `read-integration-hash.mjs` was deliberately NOT added to its `EDITED_FILES` list. That list holds docs, `ci.yml` and files under `packages/github-cache/src/`; `capture-hashes.mjs` is a root dev-only instrument this milestone also edits and is likewise absent, so the established scope of that list excludes root instruments.

No blockers. One standing note rather than a concern: the four proof target hashes are deliberately absent from this record -- plan 11-02 owns them.

## Self-Check: PASSED

Every claim above re-verified against disk and git rather than asserted:

| Claim | Check | Result |
|---|---|---|
| `capture-hashes.mjs` modified | `[ -f ]` + `git diff HEAD~2 --stat` | FOUND, +236/-3 |
| `read-integration-hash.mjs` created | `[ -f ]` | FOUND |
| `11-task-graph-premise.json` created | `[ -f ]` + parsed | FOUND, `verdict: "PREMISE OK"` |
| Task 1 commit `b2dfaa8` | `git log --oneline --all \| rg` | FOUND |
| Task 2 commit `ab41e46` | `git log --oneline --all \| rg` | FOUND |
| No hashed source input touched | `git status --porcelain packages/ .github/ start-cache-server/` | printed nothing |
| Window intact | `ls .nx/workspace-data \| wc -l` / `ls .nx/cache \| wc -l` | 18 / 86, unchanged |
| ASCII-only artifact | `rg '[^\x00-\x7F]'` on this file | exit 1, no match |
| No email-shaped token | `rg` allowlist-inversion on this file | exit 1, no match |
| Committer identity is the public one | `git config user.email` | the public gmail |

Both `rg` sweeps had their EXIT CODE checked rather than their empty output read, since a zero-hit `rg` and a failed `rg` are indistinguishable from output alone.

---
*Phase: 11-live-proofs-o1-o2-o3*
*Completed: 2026-07-29*
