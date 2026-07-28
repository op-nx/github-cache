---
phase: 08-nx-task-hash-parity
plan: 01
subsystem: infra
tags: [nx, task-hashing, cross-os, measurement, evidence, esm]

# Dependency graph
requires:
  - phase: 07-lint-toolchain-and-the-ambient-platform-read-ban
    provides: the inferred `lint` target (LINT-01) whose ProjectConfiguration contribution had to settle before any hash baseline was taken, plus D-35's explicit hand-off of `lint` as a Phase 8 measurement target
provides:
  - capture-hashes.mjs -- a root-level dev-only ESM instrument computing Nx task hashes for build/typecheck/test/integration/lint via Nx's own hasher, emitting the per-NODE Hash.details.nodes map plus the merged projectConfiguration node
  - proof that the instrument's hash is byte-identical to what Nx writes into .nx/cache/run.json, for two targets, read in the same session
  - a --diff mode that partitions two records into only-in-A / only-in-B / value-changed / same-count per target, plus a field-level projectConfiguration diff
  - 08-ROOT-CAUSE.md opened with its Method, the D-03 insufficiency proof, the D-09 confound, the staleness correction and the D-08 two-question split
  - the `capture:hashes` npm script and the fallow entry-point declaration
affects: [08-02 comparator, 08-03 two-leg capture job and observation points, 08-04 root-cause naming, 08-05 nx.json fix, 08-06 gate, phase 12 DOCS-07 portability checklist]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Measurement instrument as a root-level dev-only .mjs, outside the published package and outside the Nx graph (D-01)"
    - "Instrument validated against the measured system's own output (run.json) rather than against a mock"
    - "Measured-not-asserted state: a recorded environment field is derived from a readable surface, and the CLI flag that could assert it deliberately does not exist"

key-files:
  created:
    - capture-hashes.mjs
    - .planning/phases/08-nx-task-hash-parity/08-ROOT-CAUSE.md
  modified:
    - package.json
    - .fallowrc.jsonc

key-decisions:
  - "graphState is derived from workspaceDataEntries ALONE, correcting 08-RESEARCH.md's both-counts-zero recipe: the native file cache holds only the extracted .node addon binary, which the instrument's own import creates, so the recommended derivation could never return `cold`"
  - "The discriminator command string is READ out of nx.json's targetDefaults.integration.inputs rather than re-spelled, so the record cannot drift from the config (D-14)"
  - "--install-mode is a required flag with no default; a defaulted flag would record a guess as a measurement (Pitfall 6)"
  - "The record carries the merged projectConfiguration node beyond D-04's minimum, because the single <project>:ProjectConfiguration hash node cannot be localised to a field without it"
  - "`--inputs` is NOT a flag at Nx 23.1.0 but a subcommand; both 08-RESEARCH.md's invocation and the real `nx show target inputs` form were captured so neither reading can be dismissed as the wrong command"

patterns-established:
  - "Pattern: prove the instrument before trusting the measurement -- byte-equality against the measured system's own artifact, read in the same session that produced it"
  - "Pattern: a derived environment field records its own basis (meta.graphStateBasis) so a reader need not consult the source to learn which surface decided"
  - "Pattern: an evidence document quotes the wording it corrects, so a framing correction is attributable rather than a silent rewrite"

requirements-completed: []

coverage:
  - id: D1
    description: "capture-hashes.mjs computes the Nx task hash for all five D-05 targets and emits the per-NODE details.nodes map plus the merged project configuration node"
    requirement: PARITY-02
    verification:
      - kind: other
        ref: "node capture-hashes.mjs --install-mode ci | rg -q 'ProjectConfiguration' (exit 0; 5 targets, 428/429/444/430/443 nodes)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The instrument's hash is byte-identical to what Nx itself wrote into .nx/cache/run.json for the same task at the same commit"
    requirement: PARITY-02
    verification:
      - kind: other
        ref: "instrument --out, then nx run @op-nx/github-cache:build and :test, each followed immediately by a copy of .nx/cache/run.json; build 15091651677672778193 and test 17043910507556371878 matched on both sides"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every emitted record carries Nx version, Node version, install mode and a MEASURED graph state, with the install mode required and undefaultable"
    requirement: PARITY-06
    verification:
      - kind: other
        ref: "meta block asserted present; `node capture-hashes.mjs` with no --install-mode exits 1 naming the flag; a cold env-var capture reports graphState=cold while the repo default reports warm"
        status: pass
    human_judgment: false
  - id: D4
    description: "The instrument is not an Nx target and cannot be Nx-cached, so a capture is never a replay"
    verification:
      - kind: other
        ref: "root package.json nx.includedScripts deep-equals []; the script is a root-level .mjs outside every project"
        status: pass
    human_judgment: false
  - id: D5
    description: "08-ROOT-CAUSE.md exists with its Method, the recorded proof that nx show target inputs is insufficient, the D-09 confound, the staleness correction and the D-08 two-question split"
    requirement: PARITY-01
    verification: []
    human_judgment: true
    rationale: "The plan's own <human-check> requires the maintainer to confirm the Method section names THIS workstation's host details and base commit, and that no value in the record was carried over from 08-RESEARCH.md as a current measurement. Automated checks can prove the research hash digits are absent (they are: seven checked, zero occurrences) but not that every remaining figure was independently re-derived."

# Metrics
duration: 39min
completed: 2026-07-28
status: complete
---

# Phase 8 Plan 01: The Instrument Summary

**A root-level dev-only ESM instrument that computes Nx task hashes through Nx's own hasher and emits the per-node `details.nodes` map, proven byte-identical to `.nx/cache/run.json` for two targets, plus the root-cause record opened before any fix commit.**

## Performance

- **Duration:** 39 min
- **Started:** 2026-07-28T00:17:11Z
- **Completed:** 2026-07-28T00:56:16Z
- **Tasks:** 2
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments

- **`capture-hashes.mjs` computes Nx's arithmetic, not its own.** Four internal-subpath imports drive `createProjectGraphAsync` -> `createTaskGraph` -> `createTaskHasher().hashTask()` for `build`, `typecheck`, `test`, `integration` and `lint`, emitting each target's `hash`, `command` and the full `details.nodes` map (428-444 nodes per target). Nothing re-derives a hash, so it structurally cannot drift from Nx.
- **The instrument is PROVEN, not asserted.** In one uninterrupted session at `5a8f7c5`, the instrument's `build` hash `15091651677672778193` and `test` hash `17043910507556371878` were byte-identical to what `nx run` wrote into `.nx/cache/run.json`. Pitfall 2 discipline was held: each copy was taken before the next `nx` command, and the `nx show` runs were sequenced afterwards.
- **`nx show target inputs` is now recorded INSUFFICIENT with two independent citations.** The NAPI doc at `node_modules/nx/dist/src/native/index.d.ts:86` ("ProjectConfiguration is skipped for now"), and the captured output: 34 file PATHS, 1 environment name, 422 package names, 467 lines, zero content hashes, and zero `ProjectConfiguration` occurrences anywhere in it.
- **The record carries the merged project node**, which is the addition beyond D-04's minimum that makes PARITY-01 answerable -- the node map holds exactly one `<project>:ProjectConfiguration` entry covering all five targets, so a difference there cannot be localised to a field without it. The `--diff` mode already reproduces that localisation: run against a warm/cold pair during development it isolated a single moving node and, at field level, `targets.typecheck.outputs`.
- **`08-ROOT-CAUSE.md` is open and dated before any fix**, with Method, the D-03 insufficiency proof, the D-09 confounded-pair statement, the STALENESS-not-freshness correction quoting the roadmap's own wording, and the D-08 split into Q1 (cross-OS parity) and Q2 (PARITY-04) with the rule that every later section must declare which it answers.
- **`nx.json` is untouched by every commit in this plan.** Verified: `git diff --name-only 8c44cc7..HEAD -- nx.json packages/` returns zero files.

## Task Commits

1. **Task 1: The capture instrument** - `5a8f7c5` (feat)
2. **Task 1 follow-up: EPIPE on an early-closing stdout reader** - `da7345e` (fix)
3. **Task 2: Prove the instrument computes Nx's number, and open the record** - `a8c7e7c` (docs)

## Files Created/Modified

- `capture-hashes.mjs` - The instrument. Capture mode emits `{ meta, targets, projectConfiguration, discriminator }`; `--diff` mode partitions two records per target into only-in-A / only-in-B / value-changed / same-count plus a field-level project-node diff.
- `.planning/phases/08-nx-task-hash-parity/08-ROOT-CAUSE.md` - The root-cause record, opened with its method and its two anti-requirements.
- `package.json` - Added the `capture:hashes` script beside the other tool scripts. `nx.includedScripts` remains `[]`.
- `.fallowrc.jsonc` - Declared `capture-hashes.mjs` as a manual entry point; it is invoked as a standalone node bin and never imported, so reachability analysis cannot infer it.

## Decisions Made

- **`graphState` derives from `workspaceDataEntries` alone.** See the deviation below. The record carries `meta.graphStateBasis` so the decision is legible from the data, not only from the source.
- **The discriminator is read, never re-spelled.** D-14 requires `node -p process.platform` to stay byte-identical; reading it out of `nx.json` means the record cannot drift from the config. Verified byte-equal against the raw file.
- **`hasher.hashTask(...)` (the method), not the free `hashTask` from `hash-task.js`.** The free function mutates the task, returns void, and writes to the task-details SQLite DB during a measurement.
- **Paths recorded raw, not forward-slash-normalised.** A backslash IS the Windows fact and this record is evidence. This deliberately diverges from `pack-check.cjs`'s OS-normalisation, which exists so path PREDICATES are OS-independent -- a different job.
- **The instrument owns the only node-partition implementation in the repo,** and the plan's comparator (08-02) cannot import it: the capture job has no build step by design, so the instrument cannot import from `dist/`, and a typechecked module cannot import an untyped root `.mjs` (D-19). Stated in the source so the duplication reads as a decision.
- **D-01(b) is structural.** Root `package.json` declares `nx.includedScripts: []`, verified still `[]` after adding the script, so `capture:hashes` cannot become an Nx target and a capture can never be a replay.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `graphState` could never report `cold` under the prescribed derivation**

- **Found during:** Task 1 (The capture instrument)
- **Issue:** The plan (following `08-RESEARCH.md`'s recommended snippet) derives `cold` from BOTH `workspaceDataEntries` and `nativeFileCacheEntries` being zero. Measured: `getNativeFileCacheLocation()` is not a hash cache at all -- `node_modules/nx/dist/src/native/index.js:96-107` uses it to hold one version-prefixed copy of the `.node` addon binary, and the instrument's own static import of `nx/src/project-graph/project-graph.js` puts it there before any measurement can run. A fresh empty directory was probed directly: 0 entries at process entry, 0 after importing `native-file-cache-location.js`, and `[ '23.1.0-nx.win32-arm64-msvc.node' ]` immediately after importing `project-graph.js`. The long-lived directory on this box holds that same one file and nothing else. So the prescribed derivation returns `warm` unconditionally, forever -- the exact silently-always-passes class D-04 exists to prevent, and it would have mislabelled every observation point in plans 08-03 onward.
- **Fix:** Derive the verdict from `workspaceDataEntries` alone -- the surface that actually persists the project graph, file map and plugin caches, including the `tsc-*.hash` inference the staleness axis is about. Keep `nativeFileCacheDirectory` and `nativeFileCacheEntries` in the record as evidence (a redirect stays visible), and add `meta.graphStateBasis: "workspaceDataEntries"` so the record states its own derivation. The correction and its measurement are written into `08-ROOT-CAUSE.md`'s Method section, quoting the Nx source.
- **Files modified:** `capture-hashes.mjs`, `.planning/phases/08-nx-task-hash-parity/08-ROOT-CAUSE.md`
- **Verification:** A capture under `NX_WORKSPACE_DATA_DIRECTORY`/`NX_NATIVE_FILE_CACHE_DIRECTORY` pointed at a fresh temp directory reports `graphState: cold` (`wsd=0`, `nfc=1`), while the repo default reports `warm` (`wsd=18`, `nfc=1`) -- and the two produce different hashes for all five targets, so the label tracks a real difference.
- **Committed in:** `5a8f7c5` (Task 1 commit)

**2. [Rule 2 - Missing Critical] The rejected CLI surface was captured through an INERT flag**

- **Found during:** Task 2 (Prove the instrument, open the record)
- **Issue:** The plan directs capturing `npx nx show target @op-nx/github-cache:build --inputs`, which is `08-RESEARCH.md`'s executed invocation. It exits 0, so it does not trip the plan's "if that subcommand does not resolve, capture the error" branch -- but `nx show target --help` shows `--inputs` is NOT a flag at Nx 23.1.0; `inputs` is a SUBCOMMAND. The trailing `--inputs` is silently ignored and the command prints the resolved target CONFIGURATION instead. Recording only that would have left the D-03 evidence open to "you ran the wrong command", which is fatal for a section whose entire job is to close an anti-requirement.
- **Fix:** Captured BOTH forms and recorded the CLI detail explicitly in the record. The real subcommand `npx nx show target inputs @op-nx/github-cache:build` returns `{project, target, files, environment, external}` -- 34 file paths, 1 env name, 422 package names, no hashes, and zero `ProjectConfiguration` occurrences across all 467 lines. The record notes that RESEARCH's invocation is an even weaker surface (declared patterns copied verbatim out of `nx.json`, no resolution at all).
- **Files modified:** `.planning/phases/08-nx-task-hash-parity/08-ROOT-CAUSE.md`
- **Verification:** Both invocations run and their outputs captured; `rg -c ProjectConfiguration` over the 467-line subcommand output returns 0.
- **Committed in:** `a8c7e7c` (Task 2 commit)

**3. [Rule 1 - Bug] A successful capture printed a crash when its reader stopped early**

- **Found during:** Task 1 verification (running the plan's own `<automated>` check)
- **Issue:** The plan's verify command is `node capture-hashes.mjs --install-mode ci | rg -q 'ProjectConfiguration'`. `rg -q` exits on the first match, closing the pipe mid-write, and node's default handling emitted an unhandled `EPIPE` with a full stack trace while the pipeline still exited 0. A successful measurement that prints a crash is precisely the misattribution this phase exists to stamp out.
- **Fix:** Swallow `EPIPE` on `process.stdout` only; every other write error still throws, and the `--out` path (`writeFileSync`) is untouched.
- **Files modified:** `capture-hashes.mjs`
- **Verification:** The verify pipeline is now silent at exit 0, and a `--out` capture still writes all four top-level keys and all five targets.
- **Committed in:** `da7345e`

**4. [Rule 2 - Missing Critical] The non-existence of a graph-state flag was greppable as a false positive**

- **Found during:** Task 1 verification
- **Issue:** One acceptance criterion is verified by "grepping the source for a `--graph-state` flag and finding none". The source contained the literal token inside a comment stating that no such flag exists -- true, useful, and a false positive for the check. A guard satisfiable by a comment is Phase 7's "a lexical guard can be satisfied by the wrong token" recurring.
- **Fix:** Reworded the comment so it states the decision without spelling the flag literally, and says why it is written that way. `rg -- "--graph-state" capture-hashes.mjs` now returns no match.
- **Files modified:** `capture-hashes.mjs`
- **Verification:** `rg -c -- "--graph-state" capture-hashes.mjs` exits 1 (no match); the instrument still runs.
- **Committed in:** `5a8f7c5` (Task 1 commit)

---

**Total deviations:** 4 auto-fixed (2 bugs, 2 missing-critical)
**Impact on plan:** All four are corrections to the plan's own verification surface or to a derivation inherited from RESEARCH; none expands scope, and none touches `nx.json` or `packages/`. Deviation 1 is the consequential one -- shipping the prescribed derivation would have stamped every Phase 8 observation point `warm` regardless of the state it was taken in.

## Issues Encountered

- **`meta.workingTreeClean` reads `false` in the recorded validation session.** The only uncommitted file was `.planning/STATE.md` (the orchestrator's phase marker). Rather than wave it away, it was verified harmless and the verification written into the record: every target's hashed `workspace:` fileset node was checked for a `.planning` reference and all five returned zero, and the two `workspace:` keys on `test` -- the target with the longest explicit `{workspaceRoot}` input list -- enumerate no planning artifact. No planning file reaches a task hash.
- **The `test` hash rotated inside this plan.** Adding the `capture:hashes` script edits the root `package.json`, and `{workspaceRoot}/package.json` is a declared `test` input. Correct and expected; noted in the record so a later reader does not read it as a divergence.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for 08-02 (the comparator).** The record shape is fixed and stable: `{ meta, targets: { <target>: { hash, command, nodes } }, projectConfiguration, discriminator: { command, stdout, stderr, status } }`, serialised with two-space indentation and a trailing newline. `meta` carries `os`, `arch`, `nxVersion`, `nodeVersion`, `installMode`, `commit`, `workingTreeClean`, `githubSha`, `runnerOs`, `capturedAt`, `graphState`, `graphStateBasis`, `workspaceDataDirectory`, `workspaceDataEntries`, `nativeFileCacheDirectory`, `nativeFileCacheEntries` and `daemonEnabled`. The comparator's `EXPECTED_TARGETS` is `['build', 'typecheck', 'test', 'integration', 'lint']`, and `REQUIRED_META_KEYS` should be drawn from the list above rather than re-derived.

**Ready for 08-03 (the two-leg capture job).** The cold recipe is proven on this workstation: `NX_DAEMON=false` plus `NX_WORKSPACE_DATA_DIRECTORY` and `NX_NATIVE_FILE_CACHE_DIRECTORY` pointed at a fresh temp directory yields a MEASURED `graphState: cold`. The capture step needs `shell: bash` on the Windows leg (it sets env vars around the `node` invocation) and must run at an identical position relative to any build step on both legs, because `typecheck`'s `dependentTasksOutputFiles` node hashes whatever is in `dist/`.

**Carried forward, not resolved here:**

- `08-RESEARCH.md`'s Open Question 1 (does the cross-OS axis diverge at the same node as the staleness axis?) remains open; only the two-leg job answers it. The `--diff` mode leads with the `only-in-*` buckets specifically so a differing external-dependency SET is legible when it arrives.
- U-01 remains UNRESOLVED and must not be treated as settled. Nothing in this plan bears on whether `nx.json` alone can reach the fix.
- `AGENTS.md`'s claim that each git worktree gets its own `.nx/cache` is false at Nx 23.1.0 (RESEARCH Pitfall 7). Owned by 08-03 Task 3 Step 7 as surfaced-not-fixed; not touched here.

**No blockers.**

## Self-Check: PASSED

Files claimed created/modified, verified present:

- `capture-hashes.mjs` - FOUND
- `.planning/phases/08-nx-task-hash-parity/08-ROOT-CAUSE.md` - FOUND
- `package.json` - FOUND (contains `capture:hashes`)
- `.fallowrc.jsonc` - FOUND (contains the `capture-hashes.mjs` entry)

Commits claimed, verified present in `git log`:

- `5a8f7c5` - FOUND (feat: the instrument)
- `a8c7e7c` - FOUND (docs: the root-cause record)
- `da7345e` - FOUND (fix: EPIPE)

Plan-level constraints, verified:

- `git diff --name-only 8c44cc7..HEAD -- nx.json` returns 0 files - PASS
- `git diff --name-only 8c44cc7..HEAD -- packages/` returns 0 files - PASS
- No commit in this range deletes a tracked file - PASS
- All nine battery commands green at the final commit (`format:check`, `build`, `typecheck`, `typecheck:action`, `test`, `lint`, `fallow:ci`, `check:action`, `pack:check`) - PASS
- Zero non-ASCII characters in `capture-hashes.mjs`, `package.json`, `.fallowrc.jsonc` and `08-ROOT-CAUSE.md` - PASS
- Seven `08-RESEARCH.md` hash values checked against `08-ROOT-CAUSE.md`; zero occurrences of each - PASS

---
*Phase: 08-nx-task-hash-parity*
*Completed: 2026-07-28*
