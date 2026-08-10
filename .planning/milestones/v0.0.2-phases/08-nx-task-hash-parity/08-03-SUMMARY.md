---
phase: 08-nx-task-hash-parity
plan: 03
subsystem: infra
tags: [nx, task-hashing, cross-os, ci, measurement, live-ci, root-cause]

# Dependency graph
requires:
  - phase: 08-nx-task-hash-parity
    plan: 01
    provides: capture-hashes.mjs -- the instrument, its measured graphState, and the opened 08-ROOT-CAUSE.md this plan fills
  - phase: 08-nx-task-hash-parity
    plan: 02
    provides: the record-shape contract the two uploaded artifacts must satisfy (seven non-empty meta strings, a hash and a non-empty nodes map per EXPECTED_TARGET, discriminator streams present)
provides:
  - the ANCHOR commit a9a3895a15700956f1a98e5532da2c3f5b245efe -- every observation point names it
  - the `hash-parity` two-leg matrix capture job in ci.yml, with a checkout pinned to the PR head SHA and if-no-files-found error
  - two CI artifact names, hash-parity-ubuntu-24.04-arm and hash-parity-windows-11-arm, proven produced on a real run
  - PARITY-01's node-by-node answer -- ONE differing node cross-OS, localised to targets.typecheck.outputs
  - PARITY-04's own named answer (NO) with no nx reset in the recipe
  - the measured typecheck outputs list 08-05 must pin -- the SEVEN-entry one, 136 of 136 files covered
  - the D-21 branch decision for 08-06 (PRIMARY, not the fallback) and the D-11 verdict (root-caused, not OPEN)
affects: [08-05 the nx.json fix (consumes the outputs enumeration and the localisation), 08-06 the gating job (consumes the D-21 branch and the two artifact names), phase 9 VER-01 tripwire wording, phase 12 DOCS-07]

# Tech tracking
tech-stack:
  added:
    - actions/upload-artifact@v7 -- the repo's first artifact action; no prior in-repo major to match
  patterns:
    - "Anchor-commit measurement: land one commit that rotates no hash, then take every observation point at that SHA so a four-way comparison is a comparison rather than four readings"
    - "Isolate one axis per comparison pair: same-OS/same-state pins the machine variable, same-state/cross-OS pins the OS variable, and the leftover node names the cause"
    - "A capture job runs no build ON PURPOSE, because a dependentTasksOutputFiles input makes the build a hashed variable rather than a setup step"

key-files:
  created:
    - none
  modified:
    - .github/workflows/ci.yml
    - .planning/phases/08-nx-task-hash-parity/08-ROOT-CAUSE.md

key-decisions:
  - "Observation point 2 was captured BEFORE point 1. The cold recipe is non-destructive by construction, so order is free -- and taking the irreplaceable stale-graph reading first removes the residual risk entirely. Recorded in the record with the reason."
  - "The plan's checkout-pin check was INVERTED and is corrected in the record with API evidence. GITHUB_SHA on a pull_request event is the merge commit regardless of what is checked out, so `meta.commit == meta.githubSha` would mean the pin FAILED. The correct check is `meta.commit == the anchor`."
  - "Task 2's acceptance criterion 'both measured entry counts are zero' is unsatisfiable and was replaced with direct evidence. 08-01 already measured and recorded that the native file cache always holds exactly one entry (the .node addon copy); requiring zero makes `cold` unreachable. The cold directory was listed to prove the single entry IS that copy."
  - "D-11 is ROOT-CAUSED rather than recorded OPEN. The plan permitted either; the isolating pair (workstation cold vs windows-11-arm cold) is byte-identical on four of five targets and differs on typecheck by exactly the dependentTasksOutputFiles node."
  - "D-21 resolves to its PRIMARY branch. lint DOES diverge cross-OS, but every one of D-35's six hashed rows -- options.cwd included -- is byte-identical on both legs, so the divergence is the shared ProjectConfiguration node and not lint. The fallback is not triggered."
  - "The seven-entry typecheck outputs list is kept WHOLE in 08-05 even though its first entry matches nothing at this configuration, because it is what the plugin itself emits. Recorded as a deliberate choice with the measurement behind it."

patterns-established:
  - "Pattern: quote a research prediction beside the measurement that refutes it, not only beside the ones that confirm it (the empty only-in-* buckets refute the platform-optional-dependency prediction, and that refutation is load-bearing evidence the external set is lockfile-derived)"
  - "Pattern: when a plan's own verification step is logically inverted, correct it in the artifact WITH the evidence rather than quietly satisfying the reading that happens to hold"

# Deliberately empty, matching plans 08-01 and 08-02. This plan's frontmatter claims five
# PARITY requirements and none is CLOSED here: PARITY-01/04/05/06 are all substantively
# delivered by the record but are phase-end properties the verifier closes against
# VERIFICATION + SUMMARY + REQUIREMENTS, and PARITY-03 explicitly needs 08-05's fix plus
# 08-06's gate before byte-identical is true rather than measured-as-false. Additionally
# `requirements.mark-complete` has corrupted REQUIREMENTS.md in two prior waves of this
# project (STATE.md, Phase 07 P04), so the tool was not invoked.
requirements-completed: []

coverage:
  - id: D1
    description: "A two-leg matrix job produces one meta-stamped record per runner OS at a known commit, and a leg that measured nothing fails its own leg"
    requirement: PARITY-03
    verification:
      - kind: other
        ref: "run 30330077185 on draft PR #9: hash-parity (ubuntu-24.04-arm) success, hash-parity (windows-11-arm) success, two artifacts downloaded. if-no-files-found: error is set; its RED is not observed here (no leg failed) and is owned by 08-06's gate proving"
        status: pass
    human_judgment: false
  - id: D2
    description: "All FOUR observation points name the SAME commit SHA, and each carries its full meta block"
    requirement: PARITY-03
    verification:
      - kind: other
        ref: "all four meta.commit values equal a9a3895a15700956f1a98e5532da2c3f5b245efe; the anchor SHA appears 9 times in 08-ROOT-CAUSE.md; four `### Observation point N` sections each carry a verbatim meta block, a five-row hash table and the raw discriminator streams"
        status: pass
    human_judgment: false
  - id: D3
    description: "The checkout pin held -- the runners measured the branch tree, not a synthesised merge commit"
    requirement: PARITY-03
    verification:
      - kind: other
        ref: "both legs: meta.commit = a9a3895a (= PR #9 head.sha), meta.githubSha = c6ec86ab (= PR #9 merge_commit_sha, cross-checked via `gh api repos/op-nx/github-cache/pulls/9`). The divergence direction is the pin WORKING"
        status: pass
    human_judgment: false
  - id: D4
    description: "PARITY-01 is answered node by node, with staleness pinned on both sides before any difference is attributed to the OS"
    requirement: PARITY-01
    verification:
      - kind: other
        ref: "cross-OS diff of the two cold CI records: zero only-in-* entries on all five targets; exactly ONE value-changed node (@op-nx/github-cache:ProjectConfiguration) on build/typecheck/test/lint and TWO on integration (the declared discriminator); merged-node field diff localises it to targets.typecheck.outputs, 158 other fields identical"
        status: pass
    human_judgment: false
  - id: D5
    description: "PARITY-04 is answered as its OWN named question and is NOT resolved by a nx reset"
    requirement: PARITY-04
    verification:
      - kind: other
        ref: "its own heading, the question quoted in full, a five-row table of warm-preexisting vs cold on one machine (all five differ), and an explicit statement that no nx reset appears in the recipe. `rg 'nx reset' 08-ROOT-CAUSE.md` finds it only in prose explaining why it is excluded"
        status: pass
    human_judgment: false
  - id: D6
    description: "The integration hash is recorded for the workstation and for windows-11-arm as a same-OS pair"
    requirement: PARITY-05
    verification:
      - kind: other
        ref: "point 1 and point 3 both report integration = 3844377013355031551 with a zero-node diff across all 430 nodes; point 4 (linux) reports 23244131947937181"
        status: pass
    human_judgment: false
  - id: D7
    description: "Every pasted value carries the meta fields PARITY-06 requires, and a differing one is named as a confound rather than skipped"
    requirement: PARITY-06
    verification:
      - kind: other
        ref: "a cross-point meta comparison table covers commit, installMode, nxVersion, graphState, workspaceDataEntries, daemonEnabled, workingTreeClean, arch and nodeVersion. nodeVersion DIFFERS (workstation v24.13.0, runners v24.18.0, `.node-version` is the moving alias lts/krypton) and is shown inert by points 1 and 3 agreeing byte-for-byte on four targets"
        status: pass
    human_judgment: false
  - id: D8
    description: "Which typecheck outputs list is CORRECT is determined from what the command actually emits, before anything is pinned"
    requirement: PARITY-03
    verification:
      - kind: other
        ref: "dist/ + out-tsc/ removed, `tsc --build tsconfig.json --emitDeclarationOnly` run at cwd packages/github-cache (exit 0), 136 files enumerated and mapped per pattern: seven-entry list covers 136/136, one-entry list covers 0/136"
        status: pass
    human_judgment: false
  - id: D9
    description: "nx.json is untouched by every commit in this plan (D-06/D-15's proof)"
    requirement: PARITY-03
    verification:
      - kind: other
        ref: "`git diff --name-only 015a62b..HEAD -- nx.json` returns 0 files; the plan's full file set is exactly ci.yml and 08-ROOT-CAUSE.md"
        status: pass
    human_judgment: false

# Metrics
duration: 33min
completed: 2026-07-28
status: complete
---

# Phase 8 Plan 03: The Anchor and the Four Observation Points Summary

**One commit, four readings, and a single differing node: `targets.typecheck.outputs` is seven entries on Linux and one on Windows, and that one field is the entire cross-OS divergence AND the entire staleness divergence -- the same two node values on both axes, which is exactly why one masqueraded as the other.**

## Performance

- **Duration:** 33 min
- **Started:** 2026-07-28T04:41Z
- **Completed:** 2026-07-28T05:14Z
- **Tasks:** 3 (3 commits)
- **Files modified:** 2 (0 created, 2 modified)

## Accomplishments

- **The anchor holds.** `a9a3895` added the `hash-parity` job and nothing else, and all four observation points carry it in `meta.commit`. Because `ci.yml` is not in `nx.json`'s `test` inputs, the anchor commit itself rotates no task hash -- it exists purely to give the four readings one SHA to share.

- **PARITY-01 is answered node by node, and the answer is one node.** Cross-OS, cold on both legs: `@op-nx/github-cache:ProjectConfiguration` is the ONLY differing node on `build`, `typecheck`, `test` and `lint`, with 427-443 nodes identical per target. `integration` adds exactly one more -- `runtime:node -p process.platform`, the declared discriminator doing its job. The merged-node field diff narrows it to `targets.typecheck.outputs` with 158 other fields byte-identical.

- **The `only-in-*` buckets are EMPTY on every target, which refutes a research prediction.** RESEARCH named a differing platform-conditional optional-dependency set as "the likeliest shape of a genuine cross-OS difference". It is not a variable here at all: the external node set comes from `package-lock.json`, which both legs parse identically. Two independent 400-plus-entry node sets agreeing exactly is also a strong non-vacuity signal for the diff itself.

- **Research Finding 3 was a lead; it is now proven.** RESEARCH stated plainly that its Windows separator-sensitivity mechanism was "not yet proven to be the cross-OS cause -- the Linux leg was not measured". That leg now exists. Cold Linux yields the SEVEN-entry list, cold Windows the ONE-entry list, reproduced on two independent Windows arm64 machines. Predicted mechanism, direction and node all hold.

- **Both axes carry the SAME two node values, and that is the sharpest finding in the record.** Windows-cold vs Windows-warm-stale is `3473609128188475433` vs `17377863611053487263`. Windows-cold vs Linux-cold is the same pair. A stale Windows graph does not imitate a Linux one -- it emits literally the Linux value. Measured consequence: a warm Windows workstation and a cold `ubuntu-24.04-arm` runner are byte-identical on `build`, `test` AND `lint`, with 164 of 164 merged-config fields the same. The only survivors are the build-output node and the discriminator.

- **PARITY-04 has its own heading and a clean NO**, on all five targets, same machine, same OS, same commit, same Nx, same Node, same install mode. No `nx reset` appears anywhere in the proof recipe -- only in prose explaining why it is excluded.

- **Research assumption A6 is CONFIRMED empirically, and the inversion it warned about would have been real.** The command writes 136 files. The seven-entry outputs list covers 136 of 136; the one-entry list covers ZERO. Pinning the one-entry list would have made `typecheck` cache none of its output while still reporting hits.

- **`lint` is settled, and so is a question Phase 7 left open by design.** `lint` diverges cross-OS -- but every one of D-35's six hashed rows, `options.cwd` included (the row D-35 flagged as most likely to diverge), is byte-identical on both legs. `@nx/eslint` DOES infer `lint` identically on both OSes. The divergence is the shared node, so 08-06 wires D-21's PRIMARY branch.

- **D-11 is root-caused, not deferred.** The isolating pair -- workstation cold vs `windows-11-arm` cold, same OS, same graph state -- is byte-identical on four of five targets with 158 of 158 config fields matching, and `typecheck` differs by exactly the `dependentTasksOutputFiles` node. `typecheck`'s four values decompose into two binary variables with no residue.

- **U-01's named risk is now the less likely branch.** The root cause is a single `targetDefaults`-addressable field, which is inside D-12's reach. Not closed -- that needs 08-05 to land and the legs to actually agree -- but the "divergence lives where `targetDefaults` cannot reach" scenario is no longer an open coin-flip.

## Task Commits

1. **Task 1: the two-leg capture job, and the anchor** - `a9a3895` (feat)
2. **Task 2: observation points 1 and 2, PARITY-04, and the typecheck enumeration** - `2a062a0` (docs)
3. **Task 3: observation points 3 and 4, and PARITY-01's answer** - `0f64781` (docs)

## Files Created/Modified

- `.github/workflows/ci.yml` - the `hash-parity` two-leg matrix job (115 lines, of which ~70 are the rationale comment block, because this file is not an `nx.json` `test` input so no spec can hold that rationale). Five steps exactly: pinned checkout, setup-node, `npm ci`, a `shell: bash` capture step, upload. No sidecar, no job-level `permissions`, no event gate, no build step.
- `.planning/phases/08-nx-task-hash-parity/08-ROOT-CAUSE.md` - `## Observation points` with four meta-stamped sections plus provenance and a cross-point `meta` table; the local staleness diff; the D-10 supersession; PARITY-04's own section; the `typecheck` outputs enumeration; the cross-OS diff and PARITY-01's prose answer; the `lint` verdict against D-35's baseline; the D-11 verdict; and the two surfaced findings.

## Decisions Made

See the frontmatter. The three worth restating:

- **The plan's pin check was backwards.** Corrected in the record with the pulls-API cross-check, because a reader who applies the plan's version to a future run will conclude the pin failed exactly when it worked.
- **Point 2 before point 1.** The stale graph cannot be regenerated; the cold reading can be re-taken from an empty directory at will.
- **The seven-entry outputs list stays whole in 08-05**, inert first entry and all, because it is what `@nx/js/typescript` itself emits and an output pattern matching nothing is harmless while a dropped entry that a future tsconfig would populate is not.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The plan's checkout-pin verification is logically inverted**

- **Found during:** Task 3, step 2
- **Issue:** The plan directs the executor to confirm `meta.commit == meta.githubSha` and states that this "is what proves the checkout pin from task 1 worked". It does the opposite. `GITHUB_SHA` on a `pull_request` event is the synthesised MERGE commit, set by the runner from the event payload; it does not track what the job checked out. Equality would therefore mean the checkout had landed on the merge commit -- the pin FAILING. Applying the plan's rule as written to these (correct) records would have produced a false "the pin is broken, re-anchor" verdict and thrown away a good measurement.
- **Fix:** Recorded the correction in `08-ROOT-CAUSE.md` with evidence rather than silently applying the reading that happened to hold: `meta.commit` = `a9a3895a` = PR #9 `head.sha` = the anchor; `meta.githubSha` = `c6ec86ab` = PR #9 `merge_commit_sha`, cross-checked through `gh api repos/op-nx/github-cache/pulls/9`. The correct check is stated as "`meta.commit` must equal the anchor, and `githubSha` diverges on a `pull_request` event by design".
- **Files modified:** `.planning/phases/08-nx-task-hash-parity/08-ROOT-CAUSE.md`
- **Committed in:** `0f64781`

**2. [Rule 1 - Bug] Task 2's acceptance criterion "both measured entry counts are zero" is unsatisfiable**

- **Found during:** Task 2, step 1
- **Issue:** The criterion inherits `08-RESEARCH.md`'s two-surface `cold` derivation, which plan 08-01 already measured and corrected in this same document's `## Method`: the native file cache is not a hash cache, it holds one version-prefixed copy of the `.node` addon binary, and the instrument's own static import of `nx/src/project-graph/project-graph.js` puts it there before any measurement can run. `nativeFileCacheEntries` can never be 0. A criterion that can never be met is the same silent-defect class D-04 exists to prevent, one level up.
- **Fix:** Recorded the correction beside the reading, and proved the single entry IS the addon copy for THIS run rather than citing 08-01's earlier note -- `ls -1 "$COLD/nfc"` returns exactly `23.1.0-nx.win32-arm64-msvc.node`. The criterion actually applied is the one the instrument declares: `graphStateBasis: workspaceDataEntries`, and that count is 0.
- **Files modified:** `.planning/phases/08-nx-task-hash-parity/08-ROOT-CAUSE.md`
- **Committed in:** `2a062a0`

### Deliberate choices the plan permitted

- **Capture order reversed (point 2 first).** The plan and the dispatch brief both permit it if it reduces risk. It does, and the reason is recorded in the record rather than left to inference.
- **D-11 root-caused rather than recorded OPEN.** D-11 permits either. The measurement reached a verdict, so the verdict is what is recorded.

---

**Total deviations:** 2 auto-fixed (both bugs in the plan's own verification surface), 2 permitted choices exercised
**Impact on plan:** Neither deviation expands scope, neither touches `nx.json`, and both are corrections to how a reading is JUDGED rather than to what was measured. They belong to the same family as 08-02's: a verification step that would have passed or failed for the wrong reason.

## Issues Encountered

- **`gsd-tools query state.add-decision` and `state.record-metric` reject positional arguments** on this install and require `--summary` / `--phase --plan --duration` flags. The workflow's documented positional form returns `{"error": "summary required"}`. Re-run with flags; nothing was lost.
- **The instrument's `--out` path was kept outside the repository for every local capture**, so `git status --porcelain` stayed empty and both records read `workingTreeClean: true`. Writing into the working tree would have flipped that field for the second capture and made the pair non-comparable.

## Live-CI Items

**This plan CLOSED a Live-CI item rather than deferring one.** Observation points 3 and 4 exist only on real GitHub-hosted runners -- no local mock can produce them without faking the exact thing under test. Both `hash-parity` legs of run `30330077185` completed green at the anchor on draft PR #9, both uploaded an artifact, and neither needed a re-run, so the anchor never moved and all four points share one commit.

Still open, and owned elsewhere:

- **CORR-03 "the gate actually gates"** -- the compare job must be seen RED against a real leg. Owned by 08-06.
- **`if-no-files-found: error` firing** -- no leg produced nothing this run, so the setting is correct-by-construction and not yet observed. Also 08-06 territory.
- **Whether 08-05's fix actually brings the two legs to agreement** -- predicted in the record and labelled as a prediction, not evidence.

## User Setup Required

None. The draft pull request (#9) is open and stays draft; nothing was merged, un-drafted, force-pushed, or reconfigured. The workflow trigger surface is unchanged -- no `on.push.branches` widening and no `workflow_dispatch`, per T-08-14.

## Next Phase Readiness

**Ready for 08-05 (the fix).** It needs three things and has all of them:

1. **The field:** `targetDefaults.typecheck.outputs` in `nx.json`, using the `targetDefaults.lint.outputs` entry (nx.json:147-148) as the shape precedent -- `outputs` sits first, before `inputs`.
2. **The value:** the SEVEN-entry list, verbatim, quoted in the record. Measured to cover 136 of 136 emitted files.
3. **The rationale for the lock spec:** entry 1 is inert at this configuration and is kept anyway; the record says why, and `nx-target-inputs.spec.ts:229-234` is the 1:1 precedent for the pin.

**Ready for 08-06 (the gate).** D-21 resolves to the PRIMARY branch: assert `lint` as a fourth IDENTICAL target. The two artifact names are live and proven: `hash-parity-ubuntu-24.04-arm` and `hash-parity-windows-11-arm`.

**Carried forward:**

- **U-01 is still open**, but its named risk is now the less likely branch.
- **Two DOCS-07 items for Phase 12**, both derived here: `nx reset` for a box carrying a stale inference, and the separate fact that a developer who has built computes a different `typecheck` hash from CI because of the `dependentTasksOutputFiles` node -- which 08-05's fix does NOT close.
- **Phase 9's tripwire wording**, pre-recorded: "two CONSECUTIVE all-miss pushes with no version-affecting change in between", never "an all-miss push".
- **A surfaced, unfixed documentation defect**: `AGENTS.md`'s per-worktree Nx cache claim is false at Nx 23.1.0. Cited in the record, deliberately not drive-by-fixed.

**No blockers.**

## Self-Check: PASSED

Files claimed modified, verified present with the claimed content:

- `.github/workflows/ci.yml` - FOUND; YAML parse confirms job `hash-parity` with `fail-fast: false`, `matrix.os` exactly `["ubuntu-24.04-arm","windows-11-arm"]`, 5 steps, no `permissions` key, no `if` key
- `.planning/phases/08-nx-task-hash-parity/08-ROOT-CAUSE.md` - FOUND; 4 `### Observation point N` headings, anchor SHA present 9 times

Commits claimed, verified present in `git log`:

- `a9a3895` - FOUND (feat: the capture job and the anchor); `git show --stat` lists `.github/workflows/ci.yml` and nothing else
- `2a062a0` - FOUND (docs: points 1 and 2); lists only the record file
- `0f64781` - FOUND (docs: points 3 and 4); lists only the record file

Plan-level constraints, verified:

- `git diff --name-only 015a62b..HEAD -- nx.json` returns 0 files - PASS
- The plan's complete file set is `.github/workflows/ci.yml` + `08-ROOT-CAUSE.md` - PASS
- All four `meta.commit` values equal `a9a3895a15700956f1a98e5532da2c3f5b245efe` - PASS
- `git status --porcelain` empty at the anchor commit and before/after every local capture - PASS
- All NINE battery commands green at the final commit (`format:check`, `build`, `typecheck`, `typecheck:action`, `test`, `lint`, `fallow:ci`, `check:action`, `pack:check`) - PASS
- Zero non-ASCII characters in both touched files - PASS
- Allowlist-inversion email scan over both touched files: zero email-shaped tokens, so zero unexpected ones - PASS
- Committer identity `larsbrinknielsen@gmail.com` on every commit - PASS
- Draft PR #9 open, still draft, head = the anchor; both `hash-parity` legs `success` on run `30330077185` - PASS

Human-check items, self-confirmed under the dispatch brief's explicit authorization, each with its evidence:

- **Task 1 -- "the draft PR is open and `hash-parity` appears on both legs":** CONFIRMED. `gh pr view 9` returns `{"draft":true,"head":"a9a3895a15700956f1a98e5532da2c3f5b245efe","n":9,"state":"OPEN"}`. `gh run view 30330077185 --json jobs` lists `hash-parity (ubuntu-24.04-arm)` and `hash-parity (windows-11-arm)`.
- **Task 2 -- "points 1 and 2 came from the Windows workstation's MAIN checkout, point 2's graph was the long-lived one and was NOT preceded by a reset, both meta blocks name the anchor with a clean tree":** CONFIRMED. `git rev-parse --git-dir` returns `.git` as a DIRECTORY (a worktree would return a `.git/worktrees/<name>` path from a pointer file); `git worktree list` returns exactly one entry, `D:/projects/github/op-nx/github-cache`. No `nx reset` was run in this session, and the staleness is proven intact by the measurement rather than asserted -- points 1 and 2 disagree on all five targets, which a healed graph could not produce. `.nx/workspace-data` held 16 entries before `npm ci` and 16 after. Both records: `commit: a9a3895a...`, `workingTreeClean: true`, and `git status --porcelain` printed nothing immediately before and after each capture.
- **Task 3 -- "both legs green, both records name the anchor in BOTH commit fields, the pasted meta matches the downloaded artifacts":** CONFIRMED WITH A CORRECTION. Both legs `success`. Both records name the anchor in `meta.commit`; `meta.githubSha` is the merge commit `c6ec86ab` on both, and that divergence is the pin WORKING, not failing -- see deviation 1, where the check's inversion is corrected against `gh api repos/op-nx/github-cache/pulls/9`. The pasted `meta` blocks were produced by reading the two downloaded artifact files directly, not retyped.
- **Host-path hygiene in the pasted `meta` blocks (T-08-16):** CONFIRMED. The blocks carry a repository path, an OS temp path and two runner paths. Allowlist-inversion scan over the record returns zero email-shaped tokens; no credential and no work-domain string is present.

---
*Phase: 08-nx-task-hash-parity*
*Completed: 2026-07-28*
