---
phase: 08-nx-task-hash-parity
plan: 05
subsystem: infra
tags:
  [
    nx,
    task-hashing,
    cross-os,
    targetdefaults,
    outputs,
    drift-guard,
    mutation-testing,
    live-ci,
  ]

# Dependency graph
requires:
  - phase: 08-nx-task-hash-parity
    plan: 03
    provides: the anchor commit, all four observation points, the two node-level diffs, and the 136-file typecheck outputs enumeration that settles WHICH list is correct
  - phase: 08-nx-task-hash-parity
    plan: 04
    provides: the named root cause, the fix ROUTE written before it was taken, U-01's pre-committed C1-C4 / L1-L4 / N1-N3 predicate set, and the ordering proof this plan's commit is checked against
provides:
  - the `nx.json` fix -- `targetDefaults.typecheck.outputs` carrying the seven-entry list, which normalises the ONE field that made four targets diverge cross-OS
  - its rationale lock in `nx-target-inputs.spec.ts`, following the existing `lint.outputs` precedent, with the value sourced from the enumeration rather than from either candidate's entry count
  - a new exact-equality pin on `integration`'s runtime discriminator string, closing a hole the pre-existing CORR-04 guard passes straight through
  - three local post-fix readings (cold, warm-preexisting, warm-after-reset) all byte-identical on all five targets
  - two CI post-fix readings with four separately-stated verdicts and a row-by-row evaluation of every pre-committed condition
  - U-01 RESOLVED as `confirm-d12`, by maintainer selection against a condition committed to git before the experiment ran
  - a CORRECTION that falsifies this record's own D-11 consequence and rewrites the false Phase 12 hand-off item it had already shipped
  - the `hash-parity` job hashing `typecheck` INSIDE its dependency chain, so the records 08-06 gates on carry the value machines actually compute
  - PARITY-03 satisfied for FOUR invariant targets across four observation points
affects:
  [
    08-06 the gate (consumes the four-target INVARIANT_TARGETS set on D-21's primary branch and the corrected CI records),
    phase 9 PARITY-08 and VER-01,
    phase 12 DOCS-07 (hand-off item 6 deleted as false; items 1-5 stand, item 2 narrowed),
  ]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A `targetDefaults` entry normalises ITS field of the merged project-graph node regardless of what plugin inference produced -- the mechanism the whole fix relies on, demonstrated in-repo before it was relied on"
    - "Choose a pinned value by ENUMERATING what the command actually writes, never by picking between candidates on shape or entry count -- `outputs` is what Nx caches and restores, so a stable-but-wrong list is a silent cache-correctness regression rather than a build failure"
    - "Mutation-test a NEW pin against the specific inversion it exists to catch, not merely against absence -- and mutation-test it against the sibling guard too, to prove it adds coverage rather than a second copy that will drift"
    - "When a job measures a hash for a target with an inferred `dependsOn`, it must run that dependency first, or it records a value no real execution produces"
    - "Correct a falsified conclusion by quoting the original, marking it, and stating the measurement that killed it -- never by deleting it, because a deleted claim is indistinguishable from a claim never made"

key-files:
  created:
    - none
  modified:
    - nx.json
    - packages/github-cache/src/nx-target-inputs.spec.ts
    - .github/workflows/ci.yml
    - .planning/phases/08-nx-task-hash-parity/08-ROOT-CAUSE.md

key-decisions:
  - "The seven-entry list is pinned WHOLE, including entry 1 (`{projectRoot}/tsconfig.tsbuildinfo`) which matches nothing at this configuration. Two reasons, both recorded in the guard comment: it is what `@nx/js/typescript` itself emits when the references classify internal, so keeping it verbatim keeps the override aligned with the plugin; and an output pattern matching nothing is inert for caching, while dropping an entry a future tsconfig WOULD populate is not."
  - "The pin EXTENDS `nx-target-inputs.spec.ts` rather than being re-authored in `hash-parity/compare.spec.ts`. That file is the package's cross-cutting `nx.json` drift guard, `TESTING.md` places cross-cutting guards at the package-source root, and `{workspaceRoot}/nx.json` is already an asserted `test` input there -- so the pin inherits stale-cached-PASS protection for free."
  - "The pre-existing CORR-04 guard was NOT re-authored or modified. Both spec hunks are pure insertion (`@@ -136,0` and `@@ -260,0`), verified byte-identical against the pre-plan commit. The genuinely new assertion is the discriminator STRING pin, which the existing guard cannot make -- it proves only that exactly one target HAS a runtime input."
  - "All three local readings were taken with warm-preexisting FIRST. It is the only irreplaceable one; the cold recipe is non-destructive and re-takeable, and `nx reset` destroys the very state reading A measures. The post-reset reading is recorded as a THIRD reading and does not replace it."
  - "The `project.json` discovery was SURFACED, not fixed. `packages/github-cache/project.json` has existed since 7413363 and declares `integration` -- the one target no plugin infers -- so deleting it would delete the target. It is recorded because it re-prices U-01's `pin-inferred-target` option, whose stated cost is a departure from a posture the workspace does not actually hold."
  - "The D-11 consequence was FALSIFIED and corrected rather than defended. `typecheck` carries an INFERRED `dependsOn: [build, ^typecheck]` absent from `nx.json`, so a real run hashes it after `build` produces `dist/` and both `dist/` states yield the same hash. The decomposition TABLE stays (it is mechanically correct about the instrument); the consequence and Phase 12 hand-off item 6 did not."
  - "Hand-off item 6 is rewritten to say Phase 12 should document NOTHING here, rather than to document a softer version. There is no developer-facing hazard, and a reassurance about a non-problem is worse than silence."
  - "`typecheck`'s `dependentTasksOutputFiles` input over `dist/` is CORRECTLY modelled and was deliberately left alone. `build` genuinely is a declared dependency; the defect was in the measurement, not the input contract."
  - "The `hash-parity` no-build design was replaced with its original rationale RE-STATED in the comment block, not silently reversed. Its symmetry requirement was right and is preserved; only the resolution changed, because `both build` is equally symmetric AND measures a real value."

patterns-established:
  - "Pattern: an inferred `dependsOn` is invisible to config review -- `nx show project --json` is the only surface that reveals it, and a hashing instrument that ignores it silently reports unreal values for exactly the targets that have one"
  - "Pattern: a commit that changes a non-input file is its own control -- every target that should NOT move becomes a check on the one that should"
  - "Pattern: record a graph-state change in a measurement recipe explicitly, even when it is benign, because the whole point of measuring `graphState` is that it cannot be silently reclassified"

# Deliberately empty, matching plans 08-01 through 08-04. This plan's frontmatter claims
# PARITY-03, PARITY-05, PARITY-07 and CORR-04. PARITY-03 and PARITY-05 are now substantively
# SATISFIED and the record carries the measurements, but they remain phase-end properties the
# verifier closes against VERIFICATION + SUMMARY + REQUIREMENTS, and PARITY-03's own closing
# clause defers continuous enforcement to 08-06's compare job. CORR-04 is asserted here and
# gated in 08-06. Additionally `requirements.mark-complete` has corrupted REQUIREMENTS.md in
# two prior waves of this project (STATE.md, Phase 07 P04), so the tool was not invoked.
requirements-completed: []

coverage:
  - id: D1
    description: "The `nx.json` fix is applied, minimal and single-purpose, in `targetDefaults` only"
    requirement: PARITY-03
    verification:
      - kind: other
        ref: "`git diff e2b9176..HEAD -- nx.json` is 9 insertions / 0 deletions in ONE hunk adding `targetDefaults.typecheck.outputs`, `outputs` first per the `lint` precedent. `git log --oneline 7bfe64f..HEAD -- nx.json` returns exactly one commit, 163e6b9. The `plugins` array carries no diff lines and no `project.json` was created or edited"
        status: pass
    human_judgment: false
  - id: D2
    description: "The pinned value is the one the enumeration supports, not the one that merely looks stable"
    requirement: PARITY-03
    verification:
      - kind: unit
        ref: "packages/github-cache/src/nx-target-inputs.spec.ts#typecheck declares the outputs its command actually writes (PARITY-01, PARITY-03) > declares the seven-entry outputs list the enumeration confirmed"
        status: pass
      - kind: other
        ref: "Mutation M2 replaced the value with the one-entry list -- the other form the plugin infers, and a perfectly STABLE one -- and the pin went RED (`expected [ Array(1) ] to deeply equal [ ...(7) ]`), 1 failed / 561 passed. The guard discriminates between the two candidates, not merely between present and absent"
        status: pass
    human_judgment: false
  - id: D3
    description: "The rationale is locked in the guard spec that pins it, extending the existing file rather than re-authoring elsewhere"
    requirement: PARITY-03
    verification:
      - kind: other
        ref: "The pin sits in `nx-target-inputs.spec.ts` in a new describe block following the `lint.outputs` precedent at the same file's LINT-04 block. Its comment cites the enumeration (136 of 136 emitted files against the one-entry list's 0 of 136), states why entry 1 is inert and kept deliberately, states that `outputs` is what Nx caches and restores so a stable-but-wrong list is a correctness regression, and states why the entry exists at all. No new spec file was created"
        status: pass
    human_judgment: false
  - id: D4
    description: "The new guard was OBSERVED red under mutation and restored, and the pre-existing CORR-04 guard is unmodified"
    requirement: CORR-04
    verification:
      - kind: other
        ref: "Three mutations recorded in the record with their failure text, each 1 failed / 561 passed: M1 the absent key (the pre-fix RED, a deep-equality failure rather than a TypeError), M2 the wrong-but-stable one-entry list, M3 the re-spelled discriminator. Under M3 the pre-existing CORR-04 guard stayed GREEN, which is what proves the new string pin adds coverage. `git diff` over the spec file reports two pure-insertion hunks and the pre-existing guard is byte-identical to its text at e2b9176"
        status: pass
    human_judgment: false
  - id: D5
    description: "`integration`'s runtime discriminator is byte-identical and remains the only declared platform discriminator"
    requirement: CORR-04
    verification:
      - kind: unit
        ref: "packages/github-cache/src/nx-target-inputs.spec.ts#lint declares its full input set (LINT-04) > integration declares exactly the byte-identical discriminator command AND > integration is still the only target with a platform runtime input"
        status: pass
      - kind: other
        ref: "Both CI legs and all three local readings capture `command: node -p process.platform` with `status: 0`, `stdout` `linux\\n` and `win32\\n` respectively. The cross-OS diff shows `runtime:node -p process.platform` as the ONLY changed node on `integration` and the only changed node anywhere"
        status: pass
    human_judgment: false
  - id: D6
    description: "Three local post-fix readings covering all graph states, with the warm-preexisting one preserved rather than replaced"
    requirement: PARITY-03
    verification:
      - kind: other
        ref: "`## Post-fix re-measurement (local)` carries readings A (warm-preexisting, 18 workspace-data entries, no reset ever), B (cold, the unchanged environment-variable recipe into a temp directory outside the repo), and C (warm-after-reset, a full `nx reset` then `nx show projects` then capture) -- each with its full `meta` block, hash table and raw discriminator. All five targets agree byte-for-byte across all three. The cold-vs-warm diff is 0 changed nodes on every target and 164/164 merged fields"
        status: pass
    human_judgment: false
  - id: D7
    description: "Two CI post-fix readings, validated before being read, with four separately-labelled verdicts"
    requirement: PARITY-03
    verification:
      - kind: integration
        ref: "Workflow run 30335453685, both `hash-parity` legs `success`. `meta.commit` equals the fix commit on both; `meta.commit` does NOT equal `meta.githubSha`, which is the checkout pin working, cross-checked against `gh api .../pulls/9`"
        status: pass
      - kind: other
        ref: "`## Post-fix re-measurement (CI)` states verdicts 1-4 as their own lines: the three invariant targets cross-OS IDENTICAL; `integration` cross-OS DIFFERS with the explicit statement that a MATCHING hash there is a discriminator failure and not a parity success; `integration` workstation-versus-windows-11-arm as its own PARITY-05 row; and `lint` cross-OS IDENTICAL putting 08-06 on D-21's PRIMARY branch"
        status: pass
    human_judgment: false
  - id: D8
    description: "PARITY-05 -- `integration` byte-identical between the native Windows workstation and `windows-11-arm`"
    requirement: PARITY-05
    verification:
      - kind: other
        ref: "Both `1193647465557986036`, with a zero-node diff across all 430 nodes at the fix commit. Re-checked at the job-fix commit, where the same-OS diff is now ZERO differing nodes on ALL FIVE targets -- at 163e6b9 the pair still differed on `typecheck` by the N1 artefact"
        status: pass
    human_judgment: false
  - id: D9
    description: "Every pre-committed U-01 condition evaluated against the measurement that decides it"
    requirement: PARITY-03
    verification:
      - kind: other
        ref: "`### Every pre-committed condition, evaluated` is an eleven-row table quoting C1-C4, L1-L4 and N1-N3 with the deciding measurement per row: C1-C4 all MET, L1-L4 all NOT met, N1-N3 all occurred and all correctly non-triggers. L3 was checked DIRECTLY -- the merged `targets.typecheck.outputs` compared byte-wise against the declared list on each leg independently -- rather than inferred from the node hash"
        status: pass
    human_judgment: false
  - id: D10
    description: "U-01 resolved by a recorded maintainer decision, not self-written, with the pre-committed condition stated"
    requirement: PARITY-03
    verification:
      - kind: other
        ref: "`## U-01 RESOLVED` carries the date, the option id `confirm-d12`, the maintainer's reasoning verbatim as a block quote, an explicit statement that the selection matched the pre-committed condition without departure, and what the resolution does NOT close (the upstream `@nx/js/typescript` classification finding). `08-CONTEXT.md`'s UNRESOLVED block is left as written -- `git diff` over that file is empty for this plan"
        status: pass
    human_judgment: false
  - id: D11
    description: "The record's own falsified D-11 consequence is corrected, and the false Phase 12 hand-off item is rewritten"
    verification:
      - kind: other
        ref: "`## CORRECTION: D-11's consequence is FALSIFIED` records the inferred `dependsOn: [build, ^typecheck]` from `nx show project --json` and its absence from `nx.json` via `git grep`, plus two real `--skip-nx-cache` runs (populated `dist/` and deleted `dist/`/`out-tsc/`/`tsconfig.tsbuildinfo`) both computing `8949082127832201885`. Separates what is falsified (the consequence) from what is not (the input contract, the decomposition table, N1's status, U-01's verdict). Hand-off item 6 is rewritten with its original text preserved and marked; the PARITY-03 coverage note, the SC1 third-clause reading and the post-fix PARITY-04 table row all carry corrections"
        status: pass
    human_judgment: false
  - id: D12
    description: "Both `hash-parity` legs hash `typecheck` inside its dependency chain, symmetrically"
    verification:
      - kind: integration
        ref: "Workflow run 30354448537 at 56bb11d, whole run `success`, both legs `success`. One `- run: npm run build` step in a MATRIX job, so both legs are byte-symmetric by construction rather than by two copies staying in step"
        status: pass
      - kind: other
        ref: "The `ci.yml` comment block re-states the original no-build rationale, identifies the half that survives (symmetry) and the half that did not (the resolution), names what it missed (the inferred `dependsOn`), and cites the measurement. `nx.json` was not touched"
        status: pass
    human_judgment: false
  - id: D13
    description: "PARITY-03 satisfied for FOUR invariant targets across four observation points"
    requirement: PARITY-03
    verification:
      - kind: other
        ref: "`### PARITY-03's verdict, UPDATED` tabulates `build`, `typecheck`, `test` and `lint` byte-identical across workstation-cold, workstation-warm-preexisting, `ubuntu-24.04-arm` and `windows-11-arm`. `typecheck` converges FOUR ways on `8949082127832201885`, which is the value Nx's own runner writes into `.nx/cache/run.json`. The commit spread between the workstation and runner columns is qualified honestly and backed by the non-input control"
        status: pass
      - kind: other
        ref: "The control at the job-fix commit: `ci.yml` is not a declared input, so `build`, `test`, `lint` and `integration` read exactly their 163e6b9 values while `typecheck` moved off `1284533355439392975` -- five of five rows as predicted"
        status: pass
    human_judgment: false
  - id: D14
    description: "PARITY-07 -- the public-surface guard passes UNCHANGED, verified as both halves"
    requirement: PARITY-07
    verification:
      - kind: other
        ref: "`git diff --exit-code` is clean over `packages/github-cache/src/public-surface.spec.ts`, `src/index.ts` and `src/test/consumer-contract.ts`; `npm run pack:check` exits 0; the full `test` target is green. No env knob, no action input, no package export was added"
        status: pass
    human_judgment: false

# Metrics
duration: 5h 6m
completed: 2026-07-28
status: complete
---

# Phase 8 Plan 05: Apply the fix, re-measure, close U-01 Summary

**One declared `nx.json` key -- `targetDefaults.typecheck.outputs` -- collapsed the cross-OS divergence on four targets to zero differing nodes, and a second, uglier finding surfaced on the way: the instrument had been measuring `typecheck` outside its dependency chain, so the number the gate was about to enforce was one no machine computes.**

## Performance

- **Duration:** 5h 6m (08:21 to 13:27 local, including two Live-CI waits and a spend-limit interruption)
- **Tasks:** 3 of 3, plus a maintainer-approved correction and job fix
- **Files modified:** 4
- **Commits:** 7

## Accomplishments

- **The fix, nine lines.** `targetDefaults.typecheck.outputs` carrying the seven-entry list, `outputs` first per the only existing precedent in the file. One hunk, zero deletions, `plugins` array untouched, no `project.json` created. `git log --oneline 7bfe64f..HEAD -- nx.json` returns exactly one commit, so 08-04's ordering proof stays checkable.
- **Cross-OS divergence closed on four targets.** `build`, `typecheck`, `test` and `lint` are byte-identical between `ubuntu-24.04-arm` and `windows-11-arm`, each with zero `value-changed` nodes and zero `only-in-*` entries. The `ProjectConfiguration` node reads `17377863611053487263` on both, converged onto the value cold Linux emitted at the anchor.
- **`integration` still diverges, by exactly one node, and it is the declared discriminator.** The only surviving cross-OS difference in the workspace is `runtime:node -p process.platform`. That is CORR-04 working rather than parity failing, and the record says so explicitly so a future reader cannot mistake a matching `integration` hash for good news.
- **The staleness axis closed as a side effect, as predicted.** All three local readings -- warm-preexisting, cold, warm-after-reset -- agree byte-for-byte on all five targets. The stale plugin-cache entry is still present and still carries the old inference; `targetDefaults` overrides the field in the merged node, so it no longer reaches the hash.
- **PARITY-04's answer moved from NO on all five targets to YES on four, then five.** The last one closed once `typecheck` was hashed inside its dependency chain.
- **U-01 resolved as `confirm-d12` by maintainer selection**, against a condition committed to git at `eeace53` before `nx.json` had been touched by any commit in the phase. C1-C4 all met, L1-L4 all not met, N1-N3 all occurred as pre-committed non-triggers. Nothing was reinterpreted after the fact.
- **A conclusion this record had already shipped was falsified and corrected.** Phase 12 hand-off item 6 would have told every adopter that a developer who has built computes a different `typecheck` hash from CI. Measured false.
- **The gate now measures a real number.** One `npm run build` step in the `hash-parity` matrix job. `typecheck` moved from `1284533355439392975` -- internally consistent, cross-OS identical, computed by nothing -- to `8949082127832201885`, which is what Nx's own runner writes into `.nx/cache/run.json`.

## Task Commits

| # | Commit | What |
|---|--------|------|
| 1 | `163e6b9` | the `nx.json` fix and both spec pins |
| 1 | `4556224` | the local re-measurement, three graph states |
| 2 | `0cb48e0` | the CI re-measurement and the four verdicts |
| 3 | `8f1b5a1` | U-01 RESOLVED as `confirm-d12` |
| + | `80f1bd0` | the D-11 correction |
| + | `56bb11d` | build on both `hash-parity` legs |
| + | `cfb5a4d` | the post-build-step re-measurement, PARITY-03 updated |

## The measurement, end to end

| Target | workstation cold | workstation warm-pre | `ubuntu-24.04-arm` | `windows-11-arm` |
|--------|------------------|----------------------|--------------------|------------------|
| `build` | `17197827372395989528` | `17197827372395989528` | `17197827372395989528` | `17197827372395989528` |
| `typecheck` | `8949082127832201885` | `8949082127832201885` | `8949082127832201885` | `8949082127832201885` |
| `test` | `1367622961810189968` | `1367622961810189968` | `1367622961810189968` | `1367622961810189968` |
| `lint` | `6930879416208693542` | `6930879416208693542` | `6930879416208693542` | `6930879416208693542` |
| `integration` | `1193647465557986036` | `1193647465557986036` | `11946835023040710407` | `1193647465557986036` |

Four invariant targets, four observation points, one value each. `integration` diverges cross-OS and agrees same-OS, which is PARITY-05.

## Deviations from Plan

### Auto-fixed and auto-surfaced

**1. [Rule 2 - Missing critical verification] Mutation-tested the new pins beyond the plan's RED**

- **Found during:** Task 1
- **Issue:** The plan's RED (absent key) proves the pin fires on ABSENCE. It does not prove the pin catches the specific inversion T-08-21 names -- the one-entry list is present, well-formed and perfectly stable. And the new discriminator string pin passed on its first run, so it had never been red at all.
- **Fix:** Two additional mutations. M2 set `outputs` to the one-entry list; M3 re-spelled the discriminator as `node -e "console.log(process.platform)"`. Both went red on exactly the intended assertion, 1 failed / 561 passed each. M3 additionally showed the pre-existing CORR-04 guard staying GREEN, which is the evidence that the new pin adds coverage rather than a second copy to drift.
- **Files modified:** `nx.json` (mutated and restored)
- **Commit:** `163e6b9` (the mutations themselves are not committed; their results are recorded)

**2. [Rule 2 - Premise is false] `packages/github-cache/project.json` exists**

- **Found during:** Task 1, while checking the plan's "no `project.json` exists anywhere in the workspace" acceptance criterion
- **Issue:** D-12 and Phase 7's D-02 both state "the workspace is deliberately free of them". `git ls-files | rg "project\.json"` returns `packages/github-cache/project.json`, tracked since `7413363` and declaring the `integration` target.
- **Fix:** None -- deliberately. Deleting it would delete `integration`, the one target no plugin infers, and Phase 7's `nx run-many -t <missing>` learning says that reads as a silently passing gate. Recorded as `## SURFACED during 08-05` with its evidence, because it re-prices U-01's `pin-inferred-target` option: that option's stated cost is a departure from a posture the workspace does not actually hold.
- **Commit:** `4556224`

### Maintainer-approved additional scope

**3. The D-11 consequence was FALSIFIED, and the correction was mandatory**

- **Raised at:** the U-01 checkpoint, by the orchestrator; reproduced independently here before being recorded
- **Issue:** `typecheck` carries an INFERRED `dependsOn: ["build", "^typecheck"]` from `@nx/js/typescript`, absent from `nx.json`, which is why four plans of config review never surfaced it. Nx defers the hash of a task that depends on another task's outputs, so a real run hashes `typecheck` after `build` produces `dist/`. Two real `--skip-nx-cache` runs from opposite `dist/` states both compute `8949082127832201885`. The record's claim that a developer who has built computes a different hash from CI is false, and it had already been written into Phase 12 hand-off item 6 -- which would have shipped a false statement to every adopter.
- **Fix:** A correction section with the reproduction, separating what is falsified (the consequence) from what is not (the input contract, the decomposition table, N1's non-trigger status, U-01's verdict). Hand-off item 6 rewritten to say Phase 12 should document nothing here. Corrections also placed at the PARITY-03 coverage note, the SC1 third-clause reading and the post-fix PARITY-04 table row. Original wordings preserved and marked, never deleted.
- **Files modified:** `08-ROOT-CAUSE.md`
- **Commit:** `80f1bd0`

**4. The `hash-parity` job now builds before capturing**

- **Issue:** The instrument calls `hashTask` directly, outside the dependency chain. Harmless for four targets; for `typecheck` it made both legs record `1284533355439392975`, a number nothing computes -- and 08-06 gates on these records.
- **Fix:** One `- run: npm run build` step, after `npm ci`, before the capture. It is one step in a MATRIX job, so both legs are byte-symmetric by construction. The replaced no-build design was DOCUMENTED, so its rationale is re-stated in the comment block: its symmetry requirement was right and is preserved verbatim, only the resolution changed, and what it missed was the inferred `dependsOn`.
- **Files modified:** `.github/workflows/ci.yml`
- **Commit:** `56bb11d`

## The correction's own control

`ci.yml` is not a declared input of any target (`nx.json:68` lists `cleanup.yml`, not `ci.yml`), so the job-fix commit rotates no task hash. That made the re-measurement a clean experiment with a built-in control, and all five rows behaved as predicted: `build`, `test`, `lint` and `integration` read exactly their `163e6b9` values, and only `typecheck` moved. Four targets byte-identical across a cold-to-warm graph-state change on both operating systems is also an in-situ re-confirmation that a FRESH warm graph agrees with a cold one.

## What this plan did NOT close

- **The upstream `@nx/js/typescript` behaviour.** `nx.json` NORMALISES the symptom at the merged node; it does not repair the OS-dependent project-reference classification. A report remains a legitimate follow-up filed as its own work.
- **Continuous enforcement.** PARITY-03's own closing clause defers that to 08-06's compare job, which now has a four-target invariant set on D-21's PRIMARY branch.
- **`ROADMAP.md`'s stale PARITY numbering** and **D-12's / D-02's false `project.json` parenthetical.** Both surfaced, both outside this plan's file scope.

## Verification

- Nine-command battery green at every commit: `format:check`, `build`, `typecheck`, `typecheck:action`, `test`, `lint`, `fallow:ci`, `check:action`, `pack:check` -- each exit 0.
- `packages/github-cache/src/public-surface.spec.ts`, `src/index.ts`, `src/test/consumer-contract.ts` byte-identical; `pack:check` exit 0 (PARITY-07, D-16, both halves).
- `git diff` over the pre-existing CORR-04 guard: byte-identical to its text at `e2b9176`. Both spec hunks pure insertion.
- No `project.json` created or edited; `nx.json` `plugins` array unchanged; `08-CONTEXT.md` untouched.
- Both Live-CI closures green: run `30335453685` at the fix commit and run `30354448537` at the job-fix commit, both legs `success` on each, no re-runs.

## Self-Check: PASSED
