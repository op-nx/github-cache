# Phase 8: Nx Task-Hash Parity - Research

**Researched:** 2026-07-28
**Measured at commit:** `c61ef40` (local `main`, working tree clean)
**Domain:** Nx 23.1.0 internal task hashing, cross-OS project-graph inference, GitHub Actions
matrix + artifact plumbing
**Confidence:** HIGH for the instrument API and the freshness axis (both executed and reproduced
this session); MEDIUM for the cross-OS root cause (mechanism localized from source + one local
axis, but the Linux leg cannot be measured from this workstation)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

Copied verbatim from `08-CONTEXT.md`. The planner MUST honour these.

#### Capture instrument (PARITY-02, PARITY-06)

- **D-01:** The instrument is a **root-level, dev-only ESM script** (sibling of
  `esbuild.action.mjs`), NOT a module of the published package and NOT an Nx target. Two
  independent reasons, both load-bearing:
  (a) it imports `nx/src/hasher/*`, and `nx` is a **devDependency** -- a shipped module importing
  it would break every consumer install;
  (b) **an Nx-cached instrument would replay a stale record instead of measuring.** A cached
  capture is not a capture. It is invoked directly by the CI step and by hand locally, never
  through `nx run`.

- **D-02:** The API is `createTaskHasher(projectGraph, nxJson)` + `hashTask(...)`, reading
  `Hash.details.nodes` -- verified present in the installed Nx 23.1.0 at
  `node_modules/nx/dist/src/hasher/task-hasher.d.ts:19-33`, reached via the package's `./src/*`
  export condition. If an Nx major moves the internal subpath the script fails at IMPORT time:
  loud and immediate, never a silent pass. Same posture and precedent as
  `packages/github-cache/src/nx-target-inputs.spec.ts`.

- **D-03:** `HashPlanInspector` / `nx show target inputs` is **REJECTED as the instrument** and the
  record must say so: it SKIPS `ProjectConfiguration` per its own API doc and reports file PATHS
  rather than content hashes, so both of v0.0.1's named suspects are invisible to it. A "no
  difference" result from it is NOT evidence. `.nx/cache/run.json` is recorded as the complementary
  **task-level** surface -- read immediately after the run that produced it, since every `nx`
  invocation overwrites it.

- **D-04:** One JSON record per observation point, shaped:
  `{ meta: { os, arch, nxVersion, nodeVersion, installMode, graphState, commit },
     targets: { <target>: { hash, nodes: { <nodeName>: <nodeHash> } } },
     discriminator: { stdout, stderr } }`.
  `meta` carries every PARITY-06 field, `graphState` is `cold` | `warm`, and the discriminator
  command's **raw stdout AND stderr** are captured per leg because `hash_runtime` hashes both.

- **D-05:** **Five** targets are captured: `build`, `typecheck`, `test`, `integration`, and
  `lint`. Phase 7's D-35 hands `lint` over explicitly -- `STACK.md` section 7 leaves "does
  `@nx/eslint` infer `lint` identically on both OSes?" UNVERIFIED BY DESIGN, and Phase 8 is where
  that is settled empirically rather than reasoned closed.

#### Root-cause record (PARITY-01, PARITY-03, PARITY-04, PARITY-06)

- **D-06:** The record is `.planning/phases/08-nx-task-hash-parity/08-ROOT-CAUSE.md`, matching
  Phase 7's `07-EVIDENCE.md` convention. It lands in **its own commit, before any fix commit**, and
  names the measured commit SHA in its header. Git history is the proof that it predates the fix --
  no programmatic mtime guard.

- **D-07:** **Four observation points per target**, not two:
  | # | Point | Graph state | Source |
  |---|-------|-------------|--------|
  | 1 | native Windows workstation | COLD (post-`nx reset`) | hand-captured, pasted with its `meta` |
  | 2 | native Windows workstation | WARM | hand-captured, pasted with its `meta` |
  | 3 | `windows-11-arm` runner | cold | CI artifact |
  | 4 | `ubuntu-24.04-arm` runner | cold | CI artifact |
  Points 1-2 cannot come from CI -- no hosted runner is a developer workstation -- so they are
  hand-captured. Every pasted value carries its full `meta` block so a stale paste is detectable.

- **D-08:** Every proof states **which question it answers**: cross-OS parity, or "does a warm
  local box compute the hash cold CI published" (PARITY-04). The second must NOT be silently
  resolved by `nx reset` -- TEST-10's mandated reset clears `.nx/workspace-data` and forces COLD,
  which answers the first question while looking like it answered the second.

- **D-09:** The record states explicitly that **every prior cross-OS measurement in this repo read
  a confounded variable**, naming the pair in `STATE.md` attributed to "ubuntu CI" vs "windows CI".
  No difference may be attributed to the OS until freshness is pinned.

- **D-10:** Leading hypothesis to test FIRST, carried from the probe: a **Windows-only inference
  difference visible only on a COLD graph** -- the `@nx/vitest` / `@nx/js/typescript`
  OS-dependent-`ProjectConfiguration` class, freshness-gated, which is why v0.0.1's fixes appeared
  to hold. Research already RULES OUT `hash_project_config` as the starting point (every hashed
  field is forward-slashed and `{projectRoot}`-tokenised), so start at `External`, then
  `ProjectFileSet`.

- **D-11:** `typecheck`'s **third** variance source (four distinct values across the four probe
  measurements) is attempted, with install mode reaching it via `dependentTasksOutputFiles` or
  `externalDependencies` as the lead candidate. If unsettled inside this phase it is recorded as
  **OPEN with its evidence** -- PARITY-06 permits either, and it must not become a phase blocker.

#### Fix and sequencing (PARITY-03, PARITY-05, PARITY-07, CORR-04)

- **D-12:** Fixes land in **`nx.json` `targetDefaults` only**. No `project.json` (the workspace is
  deliberately free of them), and no plugin-option patching as a first resort.

- **D-13:** Prefer **narrowing** inputs over adding them. `nx.json` is strict JSON and carries no
  comments, so each fix's rationale lock lives in the guard spec that pins it -- the same
  displacement `eslint.config.mjs` already uses for the D-08 root-directory lock.

- **D-14:** `integration`'s `{ "runtime": "node -p process.platform" }` stays **byte-identical**.
  Phase 8 does not re-spell it; it only asserts that it is the ONLY declared discriminator
  (CORR-04). After VER-03 this is the sole mechanism separating OS-sensitive targets, so touching
  it is a Core-Value regression.

- **D-15:** **Order is load-bearing: measure -> commit the record -> fix -> wire the gate.** Every
  `nx.json` edit rotates hashes; doing any of it before the record lands contaminates the very
  investigation the record exists to document.

- **D-16:** PARITY-07's public-surface guard passes **unchanged** -- no new env knob, no new action
  input, no new package export.

#### CORR-03 gating CI job

- **D-17:** Shape is a **two-leg matrix job** (`ubuntu-24.04-arm`, `windows-11-arm`) that runs the
  instrument and uploads its record, **plus a third compare job** that `needs` both legs, runs
  `if: always()`, downloads both records and asserts. A single job cannot see both legs -- and
  `if: always()` is what makes "fewer than two records is a FAILURE, not a skip" reachable, because
  a skipped or failed leg still arrives at the assertion.

- **D-18:** **Build-gating. No `continue-on-error`**, no advisory-first period.

- **D-19:** The comparator is a **pure, typed function** at
  `packages/github-cache/src/hash-parity/` with a co-located spec. This is the only location where
  it is typechecked and unit-testable (`typecheck` runs `tsc --build` over the spec project, so a
  spec importing an untyped root `.mjs` would not compile). It is kept out of the published
  tarball by adding `!dist/hash-parity` to `packages/github-cache/package.json` `files` -- the
  exact pattern already used for `!dist/action`, `!dist/roundtrip`, `!dist/test`.
  The CI job passes it the two downloaded records; the loader around it stays thin enough to
  review by eye.

- **D-20:** Assertions, per CORR-03: (a) **exactly two** platform records exist, each carrying a
  non-empty hash for every target -- fewer than two FAILS; (b) `integration` **DIFFERS** between
  legs; (c) `build`, `typecheck`, `test` are **IDENTICAL**. Clause (c) is the non-vacuity control
  for (b): with every other input demonstrably shared, the only surviving explanation for (b) is
  the declared discriminator. A textual assertion that `nx.json` contains the input does NOT
  satisfy this.

- **D-21:** `lint` is asserted as a **fourth IDENTICAL target**, alongside build/typecheck/test.
  The roadmap's SC6 says the job "treats `lint` as a FOURTH target", and measuring it without
  asserting on it would waste the measurement D-35 asked for. **Named fallback:** if `lint` does
  diverge and the fix proves out of Phase 8's scope, its clause is downgraded to
  recorded-with-a-named-finding -- never deleted, because a deleted clause is indistinguishable
  from a clause that never existed.

- **D-22:** The gate **must be proven able to fail** before it is trusted. Fixture-driven negative
  cases per clause, plus a **vacuity control** -- Phase 7 recorded both that a prescribed
  non-vacuity filter was itself vacuous and that a lexical guard can be satisfied by the wrong
  token, so a passing gate is not evidence until its RED has been observed.

- **D-23:** Assert on **content, never on exit code**. Phase 7's learning that
  `nx run-many -t <missing>` exits 0 makes an inferred target a silently deletable gate; the same
  hazard applies to a comparison step whose input file never arrived.

### Claude's Discretion

- Exact filenames, the record JSON's precise key spelling, and the artifact names used to move
  records between jobs.
- Whether the instrument emits one file per leg or one file per leg-and-target.
- How the `build`/`typecheck`/`test`/`lint` clauses are grouped in the comparator's return shape.
- Whether the root-cause record's per-node diff is a table or a nested list.
- Where exactly the `hash-parity` module sits under `src/` (subdirectory vs package-source root),
  given `TESTING.md` places cross-cutting drift guards at the root and cohesive modules in a
  subdirectory.

### UNRESOLVED -- withheld from auto-lock (HIGH impact, NOT-HIGH confidence)

- **U-01: Whether PARITY-03's byte-identical goal is reachable through `nx.json` alone.** The
  root cause is unknown by design -- that is what D-06 exists to establish. If the divergence
  turns out to live inside plugin inference that `targetDefaults` cannot override, then D-12's
  "fixes land in `nx.json` only" is not a sufficient fix location, and the options open up to:
  pinning the inferred target explicitly, patching plugin options, or escalating upstream.
  IMPACT is HIGH -- O1 and O4 both depend on PARITY-03, and the choice would freeze how this
  workspace configures targets. CONFIDENCE is NOT HIGH -- there is no evidence yet either way.
  **Do not treat D-12 as settled if the root-cause record lands outside its reach.** Re-open this
  with the maintainer at that point rather than auto-selecting a fix location.

> **Research update on U-01:** this session produced direct evidence bearing on it. See
> `## The measured root cause` below. Short version: the divergence lives in
> `ProjectConfiguration`, specifically the `@nx/js/typescript`-inferred
> `targets.typecheck.outputs` array -- i.e. inside plugin inference, U-01's trigger condition.
> BUT the same measurement shows `targetDefaults.typecheck.inputs` ALREADY normalises the
> `inputs` field of that same node across states, which is strong evidence that
> `targetDefaults.typecheck.outputs` would normalise `outputs` the same way and keep the fix
> inside D-12's reach. This is a hypothesis with a named, cheap confirming experiment -- it is
> NOT a licence to treat U-01 as auto-resolved. Run the experiment, record the result, and if it
> fails, escalate per U-01 rather than improvising a fix location.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PARITY-01 | Root-cause the divergence node-by-node, RECORDED before any fix, controlling for BOTH axes | `## The measured root cause` names the exact diverging node (`<project>:ProjectConfiguration`) and the exact field inside it (`targets.typecheck.outputs`), with a reproducible non-destructive recipe |
| PARITY-02 | Capture instrument emits the per-NODE `details` map; `nx show target inputs` recorded INSUFFICIENT | `## Verified call sequence` gives an executed, hash-validated call sequence; `## nx show target inputs is insufficient` records the source-cited proof plus a run |
| PARITY-03 | Byte-identical `build`/`typecheck`/`test` at three observation points, workstation in BOTH graph states | `## Graph state: cold, warm, and the third state nobody names` gives a deterministic, non-destructive way to produce and RECORD each state |
| PARITY-04 | "Warm local box computes the cold-CI hash" as a SEPARATE named question, not absorbed by `nx reset` | `## Graph state` measured the answer on this box today: **NO**. See `## Answer to PARITY-04, measured` |
| PARITY-05 | `integration` byte-identical between workstation and windows-11-arm | Same instrument, same record; `integration` is target #4 of five in D-05's list |
| PARITY-06 | Every measurement records Nx version, Node version, install mode, graph state | `## The record's meta block` gives the exact programmatic source for each field, including how to MEASURE graph state rather than assert it |
| PARITY-07 | Public-surface guard passes unchanged -- no new env knob/action input/package export | `## Public surface` distinguishes Nx's own process env vars (allowed, internal to a CI step) from the public contract the guard pins |
| CORR-03 | Build-gating two-leg CI job asserting the four clauses, recording discriminator stdout AND stderr | `## CI mechanics` -- artifact actions, `needs` + `if: always()` semantics, unique per-leg artifact names |
| CORR-04 | `integration` is the ONLY target declaring a platform discriminator | Already guarded by `nx-target-inputs.spec.ts:241-260`; `## Don't Hand-Roll` says reuse it, do not re-author |
</phase_requirements>

## Summary

The instrument is not the hard part. This session built it, ran it, and validated it against Nx's
own arithmetic: `createProjectGraphAsync` -> `createTaskGraph` -> `createTaskHasher` ->
`hasher.hashTask(task, taskGraph, process.env)` returns a `Hash` whose `.value` is byte-identical
to what `nx run` writes into `.nx/cache/run.json`, and whose `.details.nodes` is the per-node map
PARITY-02 demands. The whole thing is about forty lines.

The hard part is that the axis this phase was built around is misnamed, and this session measured
it. **Cold and warm produce the SAME hash when `.nx/workspace-data` is fresh.** Two runs against a
brand-new workspace-data directory -- run 1 cold by construction, run 2 warm because run 1
populated it -- agreed exactly on all five targets. The repo's long-lived `.nx/workspace-data`
produces a DIFFERENT value. So the second axis is not freshness-of-computation; it is
**staleness-of-persisted-inference**: `.nx/workspace-data/tsc-<optionsHash>.hash` retains an old
inference result and never self-heals, and Nx re-validates the tsconfig's file hash without
re-deriving what that hash implies. PARITY-01's record should say "STALENESS axis" wherever the
roadmap says "FRESHNESS axis", and note that a `nx reset` is not a control for it so much as the
only known cure.

And the node is named. Exactly one entry in `details.nodes` differs between the two states, and it
is the same one for all five targets: `@op-nx/github-cache:ProjectConfiguration` -- precisely the
node `HashPlanInspector` documents itself as skipping, which is why every prior investigation
using `nx show target inputs` saw "no difference" and was telling the truth about the wrong thing.
Diffing the merged project-graph node narrows it one level further: the only field that moves is
`targets.typecheck.outputs`, seven entries versus one, and the one-entry form co-occurs in the
persisted cache with a malformed input pattern (`^{projectRoot}/../../../../../../../packages/...`)
that points straight at a path-comparison in `@nx/js/typescript`'s plugin.

**Primary recommendation:** build the instrument first and use it to re-derive PARITY-01 at Phase
8's own commit; do not port this session's numbers into the record. Then test the one-line
`targetDefaults.typecheck.outputs` hypothesis before opening U-01 -- it is cheap, it is inside
D-12, and the evidence for it is already on the page.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Compute + serialise a per-node hash record | Dev tooling (root `.mjs`) | -- | D-01: imports a devDependency internal subpath; must never be Nx-cached |
| Compare two records and produce a verdict | Package source (`src/hash-parity/`) | -- | D-19: only location where it is typechecked and unit-testable |
| Produce the two records on real runners | CI (matrix job) | -- | Only a hosted runner is a hosted runner |
| Move records between jobs | CI (artifacts) | -- | Matrix legs cannot share `outputs` reliably; artifacts are the documented mechanism |
| Gate the build on the verdict | CI (compare job) | -- | D-18: build-gating, no `continue-on-error` |
| Hold the fix | `nx.json` `targetDefaults` | (U-01 escalation path) | D-12, with the U-01 caveat above |
| Lock each fix's rationale | The guard spec that pins it | -- | D-13: `nx.json` is strict JSON, no comments |

---

## The measured root cause

> Everything in this section was executed against the installed tree at commit `c61ef40` on
> `win32-arm64`, Nx 23.1.0, Node v24.13.0. It is offered as a **map for the investigation**, not
> as a substitute for it -- D-15's ordering and D-06's dated record still require Phase 8 to
> re-derive this at its own commit, and the Linux half cannot be measured from this workstation.

### Finding 1: exactly one node differs, and it is the one the CLI hides

Two node maps were captured at the same commit -- one against the repo's existing
`.nx/workspace-data`, one against a fresh empty workspace-data directory -- and diffed key by key.
Result, identical for all five targets:

```
=== build : 15091651677672778193 (repo state) vs 16999170787475652362 (fresh) ===
  command: same
  nodes: 428 / 428
  only-in-repo (0): -
  only-in-fresh (0): -
  value-changed (1):
      @op-nx/github-cache:ProjectConfiguration
        repo=17377863611053487263  fresh=3473609128188475433
```

`typecheck`, `test`, `integration` and `lint` produced byte-identical diffs -- same single node,
same two values. [VERIFIED: executed this session]

Not the External nodes. Not `ProjectFileSet`. Not `TsConfig`. `ProjectConfiguration`, alone.
D-10 directs the investigation to "start at `External`, then `ProjectFileSet`" -- that ordering
was reasonable when written and is now superseded by measurement. Start at `ProjectConfiguration`.

This is also the retroactive explanation for PARITY-02's insistence: `HashPlanInspector`'s own
NAPI doc says *"ProjectConfiguration is skipped for now. Cwd is skipped as it's ambient."*
[VERIFIED: `node_modules/nx/dist/src/native/index.d.ts:86`]. The one node that differs is the one
node the recommended CLI surface cannot see.

### Finding 2: the differing field is the inferred `typecheck` outputs

Dumping `projectGraph.nodes['@op-nx/github-cache']` (the MERGED configuration, `targetDefaults`
already applied) in both states and diffing gives a single hunk:

```diff
         "outputs": [
-          "{projectRoot}/tsconfig.tsbuildinfo",
-          "{projectRoot}/dist/**/*.{d.ts,d.cts,d.mts}",
-          "{projectRoot}/dist/**/*.{d.ts,d.cts,d.mts}.map",
-          "{projectRoot}/dist/tsconfig.lib.tsbuildinfo",
-          "{projectRoot}/out-tsc/vitest/**/*.{d.ts,d.cts,d.mts}",
-          "{projectRoot}/out-tsc/vitest/**/*.{d.ts,d.cts,d.mts}.map",
-          "{projectRoot}/out-tsc/vitest/tsconfig.spec.tsbuildinfo"
+          "{projectRoot}/tsconfig.tsbuildinfo"
         ],
         "syncGenerators": ["@nx/js:typescript-sync"],
```

That is `targets.typecheck.outputs`. Nothing else in the whole project node moves.
[VERIFIED: executed this session]

Two consequences the planner should carry forward:

1. **It is `outputs`, not `inputs`.** `nx.json` already declares `targetDefaults.typecheck.inputs`,
   and the `inputs` field of the merged node is IDENTICAL across both states. That is a live,
   in-repo demonstration that a `targetDefaults` entry normalises its field of
   `ProjectConfiguration` regardless of what inference produced. `targetDefaults.typecheck.outputs`
   is the obvious symmetric fix and it sits squarely inside D-12.
2. **`outputs` is load-bearing beyond the hash.** It is what Nx caches and restores. An override
   must be the CORRECT seven-entry list, not merely a stable one -- a one-entry override would
   make `typecheck` stop caching its `dist/` declaration output. Whichever list is chosen needs a
   guard spec pinning it (D-13) and a note in the record explaining why that list.

### Finding 3: why the two states disagree at all

`@nx/js/typescript`'s `getOutputs()` iterates `[rootTsConfig, ...internalProjectReferences]`
[VERIFIED: `node_modules/@nx/js/dist/src/plugins/typescript/plugin.js:517-576`]. Seven outputs is
what you get when `packages/github-cache/tsconfig.json`'s two references (`./tsconfig.lib.json`,
`./tsconfig.spec.json`) are classified INTERNAL. One output is what you get when
`internalProjectReferences` is empty.

The plugin's persisted targets cache holds BOTH forms, keyed `<fileHash>_<relativePath>`, and the
one-output entry carries a tell:

```
"12643541963273469335_packages/github-cache/tsconfig.json": {
  "targets": { "typecheck": {
    "inputs": [ ..., "^{projectRoot}/../../../../../../../packages/github-cache/tsconfig.lib.json",
                     "^{projectRoot}/../../../../../../../packages/github-cache/tsconfig.spec.json" ],
    "outputs": ["{projectRoot}/tsconfig.tsbuildinfo"] } } }
```

[VERIFIED: read from `.nx/workspace-data/tsc-2568428459166798129.hash` this session]

Seven `../` segments is exactly the depth from
`D:/projects/github/op-nx/github-cache/packages/github-cache` to the drive root. Those patterns
come from `getExternalProjectReferenceTsconfigPatterns`, which calls
`posixRelative(refContext.project.absolute, refConfigPath)` -- so the ref's owning project
resolved to `D:/` instead of `packages/github-cache`. That resolution runs through
`isExternalProjectReference`, whose loop terminates on a **literal string comparison of two
absolute paths**:

```js
let currentPath = refConfig.dirname;
while (currentPath !== project.absolute) { ... currentPath = dirname(currentPath); }
```

[VERIFIED: `node_modules/@nx/js/dist/src/plugins/typescript/plugin.js:766-785`]

And TypeScript hands back **forward-slash** absolute paths on Windows while Nx works in
backslashes -- measured directly:

```
projectReferences[0].path : D:/projects/github/op-nx/github-cache/packages/github-cache/tsconfig.lib.json
configFile (Nx-side form) : D:\projects\github\op-nx\github-cache\packages\github-cache\tsconfig.json
```

[VERIFIED: executed this session via `ts.getParsedCommandLineOfConfigFile`]

This is a Windows-only separator-sensitivity in third-party plugin inference. It matches D-10's
named hypothesis in kind ("a Windows-only inference difference"), differs from it in mechanism
(the `@nx/js/typescript` path comparison, not `@nx/vitest`), and is **not yet proven to be the
cross-OS cause** -- the Linux leg was not measured. Treat it as the strongest available lead and
the first thing the two-leg capture job should be read against.

**Do not "fix" this in Phase 8 by patching plugin internals.** D-12 forbids it, and the
`targetDefaults.typecheck.outputs` route makes the inference difference irrelevant to the hash
without touching the plugin. Upstream reporting is a legitimate follow-up and belongs in a
`## Deferred` note, not in this phase's diff.

### Finding 4: STALENESS, not freshness

The decisive experiment, non-destructive:

| Run | `NX_WORKSPACE_DATA_DIRECTORY` | Graph state | `build` hash |
|-----|-------------------------------|-------------|--------------|
| repo default | `.nx/workspace-data` (long-lived) | warm | `15091651677672778193` |
| iso run 1 | fresh empty temp dir | **cold** | `16999170787475652362` |
| iso run 2 | same temp dir, now populated by run 1 | **warm** | `16999170787475652362` |

All five targets behaved this way; run 1 and run 2 agreed on every one.
[VERIFIED: executed this session]

So cold != warm is FALSE as a general statement. What is true is `stale != fresh`, and the repo's
`.nx/workspace-data` is stale at `c61ef40` and does not self-heal. The record (D-09) should say
that prior measurements read a confounded variable AND name the confound precisely: not "the graph
was warm" but "the graph was carrying an inference result that no longer matched the tree".

Practical consequence for D-07's four observation points: point 2 ("native Windows workstation,
WARM") is only meaningful if the record states **how the warm state arose** -- a warm-after-reset
graph and a warm-since-March graph are different measurements wearing the same label. Recommend
the record distinguish `warm-fresh` (populated by a cold run in the same session) from
`warm-preexisting` (whatever the developer's box had), and capture point 2 as
`warm-preexisting` since that is the state PARITY-04 is actually asking about.

### Answer to PARITY-04, measured

> "Does a warm local box compute the hash cold CI published?"

On this workstation at `c61ef40`: **no.** The pre-existing warm graph yields
`15091651677672778193` for `build`; a cold graph -- which is what a fresh CI checkout always is --
yields `16999170787475652362`. Same machine, same OS, same commit, same Nx, same Node.

That is an O1-relevant finding independent of any cross-OS question, and it is exactly the finding
PARITY-04 says must not be absorbed by putting `nx reset` in the proof recipe. It should appear in
the record as its own numbered answer. Phase 8 must re-take it at its own commit -- but the
planner should expect the answer to still be "no" and should plan a task for what that implies
(at minimum: DOCS-07's "if your local box misses everything, `nx reset`" note, already deferred to
Phase 12).

---

## Verified call sequence

Executed end to end this session. Every line below ran.

```js
// Root-level dev-only ESM (D-01). Sibling of esbuild.action.mjs.
import { readNxJson } from 'nx/src/config/nx-json.js';
import { createProjectGraphAsync } from 'nx/src/project-graph/project-graph.js';
import { createTaskGraph } from 'nx/src/tasks-runner/create-task-graph.js';
import { createTaskHasher } from 'nx/src/hasher/create-task-hasher.js';

const PROJECT = '@op-nx/github-cache';   // the Nx project NAME, not the directory
const nxJson = readNxJson();
const projectGraph = await createProjectGraphAsync({ exitOnError: false });

for (const target of ['build', 'typecheck', 'test', 'integration', 'lint']) {
  const taskGraph = createTaskGraph(
    projectGraph,
    {},              // extraTargetDependencies -- see the trap below
    [PROJECT],       // projectNames
    [target],        // targets
    undefined,       // configuration
    {},              // overrides
  );
  const task = taskGraph.tasks[`${PROJECT}:${target}`];
  const hasher = createTaskHasher(projectGraph, nxJson);
  const hash = await hasher.hashTask(task, taskGraph, process.env);

  hash.value;                // "15091651677672778193" -- the task hash
  hash.details.command;      // hash of project/target/configuration/overrides
  hash.details.nodes;        // { [nodeName]: nodeHash } -- PARITY-02's deliverable
}
```

### Validation against Nx's own arithmetic

```
instrument, build : 15091651677672778193
nx run @op-nx/github-cache:build -> .nx/cache/run.json:
  @op-nx/github-cache:build 15091651677672778193 cache=local-cache-hit
```

Byte-identical. [VERIFIED: executed this session]

This validation belongs in the plan as an explicit task. It is the only thing standing between
"we built an instrument" and "we built a thing that computes a number". Assert it in the
comparator's spec or in a capture-time self-check -- and note it can only be asserted where a
real `nx` run has just happened, so `run.json`'s "overwritten by every invocation" hazard applies
(read it in the same step).

### Three traps in that sequence, all hit while writing it

| Trap | Symptom | Fix |
|------|---------|-----|
| Using the directory name as the project name | `TypeError: Cannot read properties of undefined (reading 'data')` inside `resolveConfiguration` | The name is `@op-nx/github-cache` (from `packages/github-cache/package.json` `name`). Derive it, or fail loudly if `taskGraph.tasks[id]` is undefined -- do not let it reach Nx |
| Passing `nxJson.targetDefaults` as `extraTargetDependencies` | `TypeError: ...flatMap is not a function` | The parameter is a `TargetDependencies` map (`target -> array`), not `targetDefaults`. Nx's own `run-command.js:435` passes `extraTargetDependencies ?? {}` -- pass `{}` |
| Running the script from outside the repo | `ERR_MODULE_NOT_FOUND: Cannot find package 'nx'` | Node ESM resolves bare specifiers from the FILE's location, not `cwd`. The instrument must live in the repo (D-01 puts it at the root anyway) |

### Signature notes the planner needs

- `createTaskHasher(projectGraph, nxJson, runnerOptions?)` -> `TaskHasher`.
  [VERIFIED: `nx/dist/src/hasher/create-task-hasher.d.ts:4`]
- `TaskHasher.hashTask(task, taskGraph, env, cwd?)` -> `Promise<Hash>`. This is the ergonomic call
  and the one used above. [VERIFIED: `nx/dist/src/hasher/task-hasher.d.ts:47`]
- The **free function** `hashTask(hasher, projectGraph, taskGraph, task, env, taskDetails)` from
  `nx/src/hasher/hash-task.js` returns `Promise<void>` and MUTATES the task
  (`task.hash = value; task.hashDetails = details`). It also runs custom hashers and writes to the
  task-details SQLite DB via `taskDetails.recordTaskDetails`.
  [VERIFIED: `nx/dist/src/hasher/hash-task.js:70-104`]
  **Recommendation: use the method, not the free function.** It is one call instead of two, it
  returns rather than mutates, and it does not write to a database during a measurement. This
  workspace declares no custom hashers, so the free function's only unique capability is unused.
  If the plan prefers the free function for symmetry with Nx's internals, `getTaskDetails()` may
  be passed `null` -- the code is `if (taskDetails?.recordTaskDetails)`, so `null` is explicitly
  supported. [VERIFIED: same file, line 92]
- `Hash.details` is `{ command, nodes, implicitDeps?, runtime? }`. In Nx 23.1.0 `implicitDeps` and
  `runtime` are always emitted as EMPTY objects by `createHashDetails` -- runtime inputs land in
  `nodes` under a `runtime:` key, not in `details.runtime`. Do not read `details.runtime` expecting
  the discriminator; it will be `{}`.
  [VERIFIED: `nx/dist/src/hasher/task-hasher.js` `createHashDetails`, and the executed run]

---

## The `Hash.details.nodes` key vocabulary

This is PARITY-01's working alphabet. Every key form below was observed in a real run this
session; the underlying Rust enum variants (`WorkspaceFileSet`, `Runtime`, `Environment`, `Cwd`,
`ProjectFileSet`, `ProjectConfiguration`, `TsConfiguration`, `TaskOutput`, `External`,
`AllExternalDependencies`, `JsonFileSet`) are readable as contiguous strings in the native binary.

| Key form | Meaning | Live example (build/test/integration) |
|----------|---------|----------------------------------------|
| `npm:<pkg>` / `npm:<pkg>@<ver>` | One external dependency node. **422-437 of them per target** -- they dominate the map by count | `npm:typescript`, `npm:@emnapi/core@1.11.1` |
| `workspace:[<comma-joined patterns>]` | A `{workspaceRoot}` fileset. The KEY is the joined pattern list, so editing `nx.json`'s input list changes the key itself, not just its value | `workspace:[{workspaceRoot}/nx.json,{workspaceRoot}/.gitignore,{workspaceRoot}/.nxignore]` |
| `<project>:<comma-joined patterns>` | The project fileset | `@op-nx/github-cache:packages/github-cache/**/*` |
| `<project>:ProjectConfiguration` | The merged project configuration. **The one that moves.** Invisible to `nx show target inputs` | `@op-nx/github-cache:ProjectConfiguration` |
| `<project>:TsConfig` | The resolved root tsconfig. Note the key is `TsConfig`, not the enum's `TsConfiguration` | `@op-nx/github-cache:TsConfig` |
| `json:{workspaceRoot}/<file>[<field>]` | A `{ json: ..., fields: [...] }` input | `json:{workspaceRoot}/tsconfig.json[compilerOptions]` |
| `env:<VAR>` | An environment input | `env:NX_CLOUD_ENCRYPTION_KEY` (Nx adds this ambiently on every target) |
| `runtime:<command>` | A `{ runtime: ... }` input | `runtime:node -p process.platform` -- **only on `integration`**, CORR-04 confirmed live |
| `<glob>:<expanded output patterns>` | A `dependentTasksOutputFiles` node -- hashes the dependency's real output FILES on disk | `**/*.{d.ts,d.cts,d.mts}:packages/github-cache/dist/**/*...,packages/github-cache/dist/tsconfig.lib.tsbuildinfo` |
| `cwd:<path>` | Working-directory input. Not present on any target here | -- |
| `AllExternalDependencies` | Appears when a target declares no `externalDependencies`. Not present here | -- |

Node counts observed: `build` 428, `typecheck` 429, `test` 444, `integration` 430, `lint` 443.

### How to diff two maps usefully

A raw diff drowns in 422 `npm:` keys. The comparator and the root-cause tooling should both
partition into three buckets and report each separately:

- **only-in-A** / **only-in-B** (a node PRESENT on one side and absent on the other -- this is
  what a differing external-dependency SET looks like, and the likeliest shape of a genuine
  cross-OS difference, since optional platform-specific packages such as
  `@nx/nx-linux-arm64-gnu`, `lightningcss-win32-arm64-msvc` and `fsevents` all appear as nodes)
- **value-changed** (same key, different hash -- what the staleness axis produced: exactly one)
- **same** (report the count only)

The `only-in-*` bucket is the one to lead with in a cross-OS reading. It cannot arise from
staleness within a single machine and is therefore the cleanest OS signal available.

### The `dependentTasksOutputFiles` node is a real hazard

`typecheck`'s node `**/*.{d.ts,d.cts,d.mts}:packages/github-cache/dist/...` hashes the CONTENT of
`packages/github-cache/dist/`, including `tsconfig.lib.tsbuildinfo`. A runner that has not yet run
`build` hashes an empty set; a workstation with a populated `dist/` hashes whatever is in it. This
is a live candidate for D-11's "typecheck's third variance source", and it is more concrete than
`npm ci` vs `npm install`. It also means **the instrument's own reading of `typecheck` depends on
whether `build` ran first in that job** -- so the capture step's position relative to any build
step must be identical on both legs, and the record should state it.

---

## `nx show target inputs` is insufficient -- the citations for the record

D-03 and PARITY-02 require this to be RECORDED, not merely believed. Two independent citations:

1. **It skips the node that moves.** The NAPI doc for `HashPlanInspector.inspectInputs`:
   *"TsConfiguration is resolved to the root tsconfig file path. JsonFileSet is resolved to the
   matched JSON file paths (field/excludeField filters only affect hashing, not which files are
   reported as inputs). **ProjectConfiguration is skipped for now.** Cwd is skipped as it's
   ambient."* [VERIFIED: `node_modules/nx/dist/src/native/index.d.ts:79-87`]

2. **It reports patterns, not content.** Run at `c61ef40`:
   ```
   $ npx nx show target @op-nx/github-cache:build --inputs
   { "project": "@op-nx/github-cache", "target": "build", "executor": "nx:run-commands",
     "command": "tsc --build tsconfig.lib.json", "cache": true,
     "inputs": [ "{projectRoot}/package.json", "{workspaceRoot}/tsconfig.base.json", ... ] }
   ```
   Declared patterns. No hashes. No `ProjectConfiguration`. [VERIFIED: executed this session]

The `HashPlanInspector` class is also reachable programmatically at
`nx/src/hasher/hash-plan-inspector.js` with `inspectTaskInputs()` returning a structured
`HashInputs` (`{ files, runtime, environment, depOutputs, external }`). Same limitation -- it is
built on the same NAPI inspector. Naming the programmatic form in the record closes the "maybe the
API is better than the CLI" objection before someone raises it.

`.nx/cache/run.json` shape, for the complementary task-level surface:
`{ run: {...}, tasks: [ { taskId, hash, cacheStatus, ... } ] }`. [VERIFIED: read this session]

---

## Graph state: cold, warm, and the third state nobody names

### Three persistence surfaces, not one

| Surface | Default location | Cleared by |
|---------|------------------|------------|
| Task cache | `<root>/.nx/cache` | `nx reset --onlyCache`; full `nx reset` |
| Workspace data (project graph, file map, plugin caches) | `<root>/.nx/workspace-data` | `nx reset --onlyWorkspaceData`; full `nx reset` |
| **Native file cache** | `os.tmpdir()/nx-native-file-cache-<sha256(workspaceRoot+nxVersion+username)[0:7]>` | `nx reset --onlyWorkspaceData`; full `nx reset` |
| Daemon (in-memory graph + its own dir) | `<root>/.nx/workspace-data/d` | `nx reset --onlyDaemon`; full `nx reset` |

[VERIFIED: `nx/dist/src/command-line/reset/reset.js`, `nx/dist/src/utils/cache-directory.js`,
`nx/dist/src/native/native-file-cache-location.js`]

The native file cache lives **outside the repo**, in the OS temp directory. `rm -rf
.nx/workspace-data` therefore does NOT produce a cold state. Resolved on this box:
`C:\Users\...\AppData\Local\Temp\nx-native-file-cache-b463ff1`. A "cold" recipe that only deletes
`.nx/` is measuring something it cannot name.

### The recommended cold recipe: env vars, not deletion

All three surfaces are redirectable:

| Variable | Redirects |
|----------|-----------|
| `NX_CACHE_DIRECTORY` | `.nx/cache` |
| `NX_WORKSPACE_DATA_DIRECTORY` (or legacy `NX_PROJECT_GRAPH_CACHE_DIRECTORY`) | `.nx/workspace-data` |
| `NX_NATIVE_FILE_CACHE_DIRECTORY` | the temp-dir native cache |
| `NX_DAEMON=false` | forces `InProcessTaskHasher`, no daemon |

[VERIFIED: same source files]

```bash
# COLD, deterministic, non-destructive, and provable by construction
COLD="$(mktemp -d)"
NX_DAEMON=false \
NX_WORKSPACE_DATA_DIRECTORY="$COLD/wsdata" \
NX_NATIVE_FILE_CACHE_DIRECTORY="$COLD/nfc" \
  node capture-hashes.mjs --graph-state cold --out "$OUT"
rm -rf "$COLD"

# WARM: run the same command twice against the SAME $COLD dir; the second run is warm-fresh.
# WARM-PREEXISTING: run with no overrides at all, against the repo's own .nx/.
```

Why this beats `nx reset`:

- **It cannot half-work.** An empty directory is cold by construction. `nx reset` is an operation
  that can fail (see the pitfall below) and leave you measuring a warm graph while your record
  says cold.
- **It is provable.** `existsSync(workspaceDataDirectory)` and its file count are readable BEFORE
  the graph is built -- so `graphState` is MEASURED, satisfying D-04's requirement that it not be
  merely asserted by the caller.
- **It is non-destructive.** A developer capturing point 1 (cold) does not lose their task cache,
  which matters because D-07 asks the same person to capture point 2 (warm-preexisting)
  afterwards. `nx reset` destroys the very state point 2 needs.

`nx reset` is still the right thing to DOCUMENT for DOCS-07's "your local box misses everything"
note. It is the wrong thing to build a measurement on.

### Measuring `graphState` rather than asserting it

Recommended, in the instrument, before `createProjectGraphAsync`:

```js
import { existsSync, readdirSync } from 'node:fs';
import { workspaceDataDirectory } from 'nx/src/utils/cache-directory.js';
import { getNativeFileCacheLocation } from 'nx/src/native/native-file-cache-location.js';

const wsdDir = workspaceDataDirectory;
const nfcDir = getNativeFileCacheLocation();
const observed = {
  workspaceDataDirectory: wsdDir,
  workspaceDataEntries: existsSync(wsdDir) ? readdirSync(wsdDir).length : 0,
  nativeFileCacheDirectory: nfcDir,
  nativeFileCacheEntries: existsSync(nfcDir) ? readdirSync(nfcDir).length : 0,
  graphState: /* derived: 0 entries in both => 'cold', else 'warm' */,
  daemonEnabled: process.env.NX_DAEMON !== 'false',
};
```

Both `workspaceDataDirectory` and `getNativeFileCacheLocation` are importable through the same
`./src/*` export condition the instrument already relies on, so no new failure surface.
[VERIFIED: both resolved and called this session]

Record the DIRECTORIES too, not just the verdict. On a runner they will be the repo-local
defaults; if a future job sets an override, the record shows it instead of silently reclassifying.

### The daemon: disable it, but not for the reason you'd guess

Measured both ways at the same commit:

| Target | `NX_DAEMON=false` | daemon default (on) | Hasher class (on) |
|--------|-------------------|---------------------|-------------------|
| build | 15091651677672778193 | 15091651677672778193 | `DaemonBasedTaskHasher` |
| typecheck | 14260814807354658740 | 14260814807354658740 | `DaemonBasedTaskHasher` |
| test | 9176090622564414995 | 9176090622564414995 | `DaemonBasedTaskHasher` |
| integration | 713392145795114960 | 713392145795114960 | `DaemonBasedTaskHasher` |
| lint | 397297077505022537 | 397297077505022537 | `DaemonBasedTaskHasher` |

[VERIFIED: executed this session]

`createTaskHasher` returns `DaemonBasedTaskHasher` when `daemonClient.enabled()`, otherwise
`InProcessTaskHasher` [VERIFIED: `create-task-hasher.js:7-15`]. Both emit a full `details.nodes`
map (428 nodes on the daemon path) and both agreed to the digit here.

So the daemon is **not** an arithmetic hazard. Set `NX_DAEMON=false` anyway, for two concrete
reasons:

1. The daemon holds an in-memory project graph across invocations. That is a fourth staleness
   surface, and it is the one with no file you can inspect. A measurement should not depend on
   the lifetime of a background process.
2. It holds a lock on the workspace-data SQLite DB, which is what breaks `nx reset` on Windows
   (next section).

Note that `NX_DAEMON=false` in the environment of a NEW process does not stop an ALREADY-RUNNING
daemon. If a recipe needs the daemon gone, `nx reset --onlyDaemon` (or full `nx reset`) is the
only thing that stops it -- `resetHandler` calls `killDaemon()` on those paths and on no other.
[VERIFIED: `reset.js:47-58`]

---

## CI mechanics for the two-leg + compare job

### The repo has NO prior artifact usage -- this is a new dependency

Complete inventory of third-party actions in `.github/workflows/`:

```
actions/checkout@v7
actions/setup-node@v6
```

[VERIFIED: `rg -oN "uses: [^ ]+" .github/workflows/*.yml | sort -u`]

The brief says to match existing majors. There are none to match. The planner picks fresh, and
should say so in the plan so a reviewer does not go looking for a precedent.

Current majors, and note they are **asymmetric** -- a classic copy-paste trap:

| Action | Latest | Published |
|--------|--------|-----------|
| `actions/upload-artifact` | **v7** (v7.0.1) | 2026-04-10 |
| `actions/download-artifact` | **v8** (v8.0.1) | 2026-03-11 |

[VERIFIED: `gh api repos/actions/{upload,download}-artifact/releases`]

`download-artifact@v8`'s own README uses `actions/upload-artifact@v7` throughout, so v7/v8 is the
documented pairing, not a mismatch. [CITED: github.com/actions/download-artifact README]
The repo pins by major (`@v7`, `@v6`), so `@v7` / `@v8` matches house style.

### The multi-OS pattern is documented, and it is exactly this shape

```yaml
# per-leg upload -- the name MUST be unique per leg (v4+ made artifact names immutable;
# two jobs uploading to one name is an error, not a merge)
- uses: actions/upload-artifact@v7
  with:
    name: hash-parity-${{ matrix.os }}
    path: <record>.json
    if-no-files-found: error      # a missing record must fail the LEG, not arrive as silence

# compare job
- uses: actions/download-artifact@v8
  with:
    pattern: hash-parity-*
    merge-multiple: true
    path: records/
```

[CITED: `actions/download-artifact` README, "Download multiple (or all) Artifacts" and the
multi-arch/os example]

`if-no-files-found: error` is worth a line in the plan: without it the default is `warn`, and a
leg whose instrument silently produced nothing uploads an empty artifact, which `merge-multiple`
happily merges into nothing, which the comparator then reports as "fewer than two records" --
correct verdict, wrong blame, and one job further from the cause than necessary.

### `needs` + `if: always()` semantics

`if: always()` makes the compare job run regardless of the `needs` jobs' conclusions -- including
when a leg FAILED or was SKIPPED or the whole run was cancelled. That is precisely what D-17
requires: a leg that died still delivers its absence to the assertion.

Two consequences for the plan:

1. **`always()` also runs on cancellation.** If a cancelled run producing a red compare job is
   noise, `if: '!cancelled()'` is the narrower expression that still covers failure and skip.
   D-17's stated requirement is only about failed/skipped legs, so either satisfies it; the plan
   should pick deliberately rather than by reflex.
2. **`needs` semantics vs the assertion.** Do NOT let the compare job's own conclusion be derived
   from `needs.*.result`. D-23 is explicit: assert on CONTENT. A leg can succeed and still have
   written a truncated record; a leg can fail after a valid upload. The record files are the
   evidence, the job results are not.

### The two-leg matrix shape already exists in this repo

`.github/workflows/ci.yml:409-455` (`integration`) is a working
`[ubuntu-24.04-arm, windows-11-arm]` matrix with `fail-fast: false`, `timeout-minutes`, and
`shell: bash` on every scripted step. Copy its skeleton. Its header comment records why
`shell: bash` is mandatory: *"GitHub's DEFAULT shell on windows-11-arm is pwsh, which fails on
`$GITHUB_ENV`, `$(...)`, `seq` and `[ ... ]`"*. The capture step is a scripted step. It needs
`shell: bash`. [VERIFIED: read this session]

`fail-fast: false` is not optional here -- with it on, a Windows leg failure cancels the Ubuntu
leg, and the compare job then reports "fewer than two records" for a reason that has nothing to do
with hash parity.

The new job does NOT need the sidecar block that `build`/`typecheck`/`test`/`integration` carry.
It runs no cached Nx task; it computes hashes. Leaving the sidecar out keeps the job fast and
removes an entire class of flake from a gate that must be trusted.

### Recording the discriminator's stdout AND stderr (CORR-03, D-04)

The declared input is `{ "runtime": "node -p process.platform" }`. Nx's runtime hashing covers
both streams, so both must be recorded. Capture in the instrument, not in a shell step -- a shell
step's `2>&1` merges them and loses the distinction the requirement asks for:

```js
import { execFileSync } from 'node:child_process';
// capture streams separately; a non-zero exit must be recorded, not thrown away
```

Record the raw strings verbatim, including trailing newlines. A trimmed value is a different
value, and "we trimmed it" is exactly the kind of silent normalisation that makes two legs look
equal when they are not.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why standard |
|---------|---------|---------|--------------|
| `nx` | 23.1.0 (installed, exact) | `createProjectGraphAsync`, `createTaskGraph`, `createTaskHasher` | Already a devDependency; the only thing that can compute an Nx hash |
| `typescript` | installed | Comparator module | Already the workspace language |
| `vitest` | ~4.1.0 via `@nx/vitest` | Comparator spec | The workspace runner; specs are co-located |
| `actions/upload-artifact` | `@v7` | Move per-leg records | GitHub's own; no alternative worth the argument |
| `actions/download-artifact` | `@v8` | Collect both records | Same |

**No new npm dependency is needed.** Everything the instrument imports is already installed.

### Alternatives considered

| Instead of | Could use | Tradeoff |
|------------|-----------|----------|
| Artifacts between jobs | Job `outputs` + `needs.<job>.outputs.*` | Matrix legs cannot set distinct outputs reliably -- legs overwrite each other. Would force two separately-named jobs, which contradicts D-17's matrix shape |
| `hasher.hashTask(...)` | free `hashTask(...)` from `hash-task.js` | Free function mutates the task, returns void, and writes to the task-details SQLite DB. No custom hashers exist here, so it buys nothing |
| Env-var cold recipe | `nx reset` | `nx reset` is destructive, can fail (see pitfalls), and gives no way to PROVE the state that resulted |

### Installation

```bash
# nothing to install
```

## Package Legitimacy Audit

No new npm packages are introduced by this phase. Every import resolves to an already-installed
devDependency, and every GitHub Action is first-party `actions/*`.

| Package | Registry | Age | Downloads | Source repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `nx` | npm | already installed at 23.1.0 (exact-pinned devDep) | n/a | github.com/nrwl/nx | OK | Already present, unchanged |
| `actions/upload-artifact@v7` | GitHub Actions (first-party) | v7.0.1, 2026-04-10 | n/a | github.com/actions/upload-artifact | OK | New to this repo -- first artifact usage |
| `actions/download-artifact@v8` | GitHub Actions (first-party) | v8.0.1, 2026-03-11 | n/a | github.com/actions/download-artifact | OK | New to this repo -- first artifact usage |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** none.

---

## Architecture Patterns

### System architecture

```
  Developer workstation                        GitHub Actions
  ---------------------                        --------------
                                    hash-parity (matrix, fail-fast: false)
  capture-hashes.mjs                 +----------------------+----------------------+
   (cold: env-var redirect)          |  ubuntu-24.04-arm    |  windows-11-arm      |
   (warm-preexisting: no override)   |  checkout            |  checkout            |
          |                          |  setup-node          |  setup-node          |
          v                          |  npm ci              |  npm ci              |
   record JSON (x2)                  |  node capture-*.mjs  |  node capture-*.mjs  |
          |                          |  upload-artifact     |  upload-artifact     |
          |  hand-paste with meta    |  hash-parity-<os>    |  hash-parity-<os>    |
          v                          +----------+-----------+-----------+----------+
   08-ROOT-CAUSE.md                             |                       |
   (own commit, BEFORE any fix)                 +-----------+-----------+
                                                            v
                                            hash-parity-compare
                                              needs: [hash-parity]
                                              if: always()          <- a dead leg still arrives
                                              download-artifact
                                                pattern: hash-parity-*
                                                merge-multiple: true
                                                            |
                                                            v
                                          packages/github-cache/src/hash-parity/
                                            compareRecords(records[]) -> verdict
                                              (a) exactly two, all hashes non-empty
                                              (b) integration DIFFERS
                                              (c) build/typecheck/test IDENTICAL
                                              (d) lint IDENTICAL              [D-21]
                                                            |
                                              fail on any violation (D-18)
```

The comparator is a pure function over an array of parsed records. Everything above it -- reading
files from `records/`, choosing an exit code -- is a thin loader the plan should keep small enough
to review by eye (D-19), because that loader is the one part with no unit test standing behind it.

### Pattern 1: fail at IMPORT, never at read

`nx-target-inputs.spec.ts:35-37` states the posture: *"`nx/src/*` is an internal subpath with no
semver guarantee. An Nx major could move it and break this file at IMPORT time. That is the
desired failure mode: loud and immediate, never a silent pass."*

The instrument inherits this. It should also fail loudly on the two runtime shapes that can go
quietly wrong:

```js
const task = taskGraph.tasks[`${PROJECT}:${target}`];
if (!task) {
  throw new Error(
    `no task ${PROJECT}:${target} in the task graph -- the target was renamed, deleted, ` +
    `or its inferring plugin is not registered. Available: ${Object.keys(taskGraph.tasks)}`,
  );
}
```

That error is the direct analogue of Phase 7's `nx run-many -t <missing>` learning: a deleted
inferred target must not read as "measured, no difference".

### Pattern 2: derive the project name, do not hardcode a guess

```js
const PROJECT = JSON.parse(
  readFileSync(new URL('./packages/github-cache/package.json', import.meta.url), 'utf8'),
).name;                                    // '@op-nx/github-cache'
```

Hardcoding `'github-cache'` costs a confusing `TypeError` deep in Nx (hit this session). Hardcoding
`'@op-nx/github-cache'` works but drifts silently if the package is renamed. Deriving it is one
line and the workspace already has exactly one publishable project.

### Pattern 3: partition the node diff before printing it

Covered above under "How to diff two maps usefully". Both the root-cause tooling and the
comparator's failure message should use the same three-bucket partition, so the number a reader
sees in CI is the same shape as the number in `08-ROOT-CAUSE.md`.

### Anti-patterns to avoid

- **Reading `details.runtime` for the discriminator.** It is always `{}` in Nx 23.1.0. The runtime
  input is in `details.nodes` under `runtime:node -p process.platform`.
- **`2>&1` on the discriminator capture.** CORR-03 wants both streams; merging them destroys the
  distinction it asked for.
- **Deriving the compare job's verdict from `needs.*.result`.** D-23: content, never status.
- **Putting `nx reset` in the PARITY-04 proof recipe.** The requirement names this exact move as
  disqualifying.
- **`git grep` for anything under `node_modules/`.** It returns zero matches with no error. Use
  `rg -uu`. (This cost real time before it was caught, twice.)
- **Trimming a captured stdout/stderr.** A trimmed value is a different value.

---

## Don't Hand-Roll

| Problem | Don't build | Use instead | Why |
|---------|-------------|-------------|-----|
| Computing a task hash | Any reimplementation of Nx's hashing | `createTaskHasher(...).hashTask(...)` | Validated byte-identical against `run.json` this session; a reimplementation would be measuring itself |
| Deciding which files a target hashes | Glob logic | `splitInputsIntoSelfAndDependencies` + `extractPatternsFromFileSets` + `filterUsingGlobPatterns` | Already the in-repo technique (`nx-target-inputs.spec.ts:90-101`) -- "delegate every glob decision to Nx's own resolver" |
| Asserting `integration` is the only discriminator (CORR-04) | A new spec | `nx-target-inputs.spec.ts:241-260` already does exactly this, with a defensive `?.` and a written rationale | Re-authoring it creates a second copy to drift. If Phase 8 needs more, EXTEND that describe block |
| Locating Nx's cache directories | Path guessing | `workspaceDataDirectory`, `cacheDir` from `nx/src/utils/cache-directory.js`; `getNativeFileCacheLocation()` | The native cache is in `os.tmpdir()`, not in the repo. Guessing gets it wrong |
| Producing a cold graph | `rm -rf .nx` | `NX_WORKSPACE_DATA_DIRECTORY` + `NX_NATIVE_FILE_CACHE_DIRECTORY` at a fresh temp dir | `rm -rf .nx` leaves the temp-dir native cache intact -- so it does not produce a cold state at all |
| Moving records between jobs | A committed file, a gist, an env var | `actions/upload-artifact@v7` / `download-artifact@v8` | Documented multi-OS pattern; anything else is a new failure mode on a gate |

**Key insight:** every measurement primitive this phase needs already exists in Nx's own internals,
and the repo already has a precedent for reaching in. The work is composing them and recording the
result honestly -- not building a hashing story of our own.

---

## Common Pitfalls

### Pitfall 1: `nx reset --onlyWorkspaceData` fails on Windows and the recipe carries on

**What goes wrong:** `EPERM, Permission denied: \\?\D:\...\.nx\workspace-data`. Hit this session.
**Why:** `--onlyWorkspaceData` does NOT stop the daemon (only `--onlyDaemon` and a full `nx reset`
call `killDaemon()`), and the daemon holds the workspace-data SQLite file open. Windows will not
delete an open file. [VERIFIED: `reset.js:47-58, 66-80` plus the observed failure]
**How to avoid:** use the env-var cold recipe. If a reset is genuinely wanted, use the FULL
`nx reset` (which kills the daemon first) and check its exit code -- `resetHandler` does
`process.exit(1)` on any collected error, so the signal exists, but only if someone reads it.
**Warning sign:** a "cold" record whose measured `workspaceDataEntries` is non-zero. This is
exactly why D-04's `graphState` must be measured and not asserted.

### Pitfall 2: `.nx/cache/run.json` is overwritten by the next `nx` invocation

**What goes wrong:** a recorded hash belongs to a later, unrelated run.
**Why:** `StoreRunInformationLifeCycle` writes it unconditionally on every invocation.
[CITED: `PROBE-RESULTS.md` method note]
**How to avoid:** read it in the SAME step that produced it. Better: do not depend on it for the
record at all -- the instrument computes the hash directly. Use `run.json` only for the
one-time cross-check that the instrument agrees with Nx.

### Pitfall 3: a spec that reads an unregistered input serves a stale cached PASS

**What goes wrong:** the guard reports the OLD file's verdict about the NEW file, and does it
silently, at exit 0.
**Why:** if a `test`-target spec's result depends on a file that is not in `targetDefaults.test.inputs`,
editing that file does not bust the `test` hash.
**This repo has shipped it three times:** `governance-email.spec.ts`; `typecheck`'s
spec-excluding inputs (`npm run typecheck` exited 0 while the REPLAYED output said "Found 1
error."); and it is the documented reason for every `{workspaceRoot}/...` entry in
`nx.json`'s `test` inputs. [CITED: `nx-target-inputs.spec.ts:10-18, 263-327`]
**How to avoid, for Phase 8 specifically:** the comparator's spec reads fixtures it ships itself
(inside `{projectRoot}`, covered by `default`) -- safe. But **any Phase 8 spec that asserts on
`.github/workflows/ci.yml` content is NOT safe**: `nx.json` lists `cleanup.yml` and NOT `ci.yml`,
and registering `ci.yml` is PARITY-08, deferred to Phase 9. The CONTEXT.md deferred-ideas block
states this explicitly. Design the gate so it does not need a spec that reads `ci.yml`.

### Pitfall 4: an inferred target can be deleted and the gate stays green

**What goes wrong:** `nx run-many -t <missing>` prints "No tasks were run" and EXITS 0.
[CITED: Phase 7 learnings, and `nx-target-inputs.spec.ts:144-150`]
**How this reaches Phase 8:** the instrument iterates a target list. If a target vanishes, a naive
loop records nothing for it and the comparator sees a record with fewer targets -- which could
read as "identical" depending on how the clauses iterate.
**How to avoid:** D-20(a) already requires "each carrying a non-empty hash for **every** target".
Implement that as an explicit expected-target-list check in the comparator, not as
`Object.keys(a.targets).every(...)` over whatever happened to be there. And make the instrument
throw on a missing task (Pattern 1).

### Pitfall 5: a passing gate is not evidence until its RED has been seen

**What goes wrong:** the comparator returns "pass" for a reason unrelated to correctness.
**Why:** Phase 7 recorded two distinct instances -- a prescribed non-vacuity filter that was
itself vacuous, and a lexical guard satisfied by the wrong token.
[CITED: `07-LEARNINGS.md` "The prescribed non-vacuity filter was itself vacuous",
"A lexical guard can be satisfied by the wrong token"]
**How to avoid:** D-22's fixture-driven negatives, one per clause, plus a vacuity control. The
vacuity control for this comparator is specific and worth naming in the plan: **a record pair with
an EMPTY `targets` object must FAIL clause (a)**, because a comparator that iterates
`Object.keys(record.targets)` passes clauses (b), (c) and (d) trivially on an empty map.

### Pitfall 6: `npm ci` vs `npm install` changes the external node SET

**What goes wrong:** `only-in-A` / `only-in-B` entries in the node diff that look like an OS
difference and are an install-mode difference.
**Why:** the node map carries 422-437 `npm:` entries including platform-conditional optional
dependencies. A bare Windows `npm install` is already known in this project's history to prune
Linux-only optional subtrees.
**How to avoid:** PARITY-06 already requires `installMode` in `meta`. Make the instrument READ it
rather than accept it as a flag where possible -- `process.env.npm_config_*` is unavailable when
the script is invoked directly, so the honest options are (a) a required CLI flag that the CI step
sets from the step that actually ran, or (b) recording the lockfile's mtime-vs-`node_modules`
relationship. A required flag with no default is better than a defaulted one: a missing value
should fail the capture, not silently record "ci".

### Pitfall 7: Nx worktrees share the MAIN repo's cache

**What goes wrong:** an executor running in a `git worktree` reads the main tree's graph state, so
its "cold" measurement is not cold.
**Why:** `sharedCacheDirectory()` resolves `getMainWorktreeRoot(root)` and returns the MAIN repo's
cache dir; `cleanupWorkspaceData()` explicitly also cleans "the shared workspace data directory in
the main repo where the DB actually lives".
[VERIFIED: `nx/dist/src/utils/cache-directory.js`, `reset.js:141-158`]
**This contradicts `AGENTS.md`**, which states *".nx/cache and .nx/workspace-data live at the
worktree root ... so each worktree already gets its own"*. That was true of older Nx; it is not
true of 23.1.0.
**How to avoid:** do not dispatch the local capture tasks to worktree-isolated executors, or set
`NX_WORKSPACE_DATA_DIRECTORY` per worktree. Worth a one-line correction to `AGENTS.md` -- but
note that is a doc edit outside this phase's scope, so it belongs in the plan as an explicit
decision, not as a drive-by.

### Pitfall 8: the `files` exclusion has a second half

Adding `!dist/hash-parity` to `packages/github-cache/package.json` `files` (D-19) is only half the
change. `packages/github-cache/pack-check.cjs` carries an explicit FORBIDDEN list asserting that
`dist/action/`, `dist/roundtrip/` and `dist/test/` are absent from the pack. A new exclusion with
no matching entry there is unasserted -- and unasserted is how the previous three would have
regressed. [VERIFIED: `pack-check.cjs:106-125`]

---

## Runtime State Inventory

Phase 8 is not a rename or migration, but it does rotate every task hash and touches persisted
runtime state, so the categories are answered explicitly.

| Category | Items found | Action required |
|----------|-------------|-----------------|
| Stored data | None. No database, no external datastore holds a Phase 8 artifact | None |
| Live service config | The GitHub Actions **cache** and the **Releases mirror** hold entries keyed by the OLD task hashes. Every `nx.json` edit invalidates them | None -- Phase 7's D-36 names three legitimate all-MISS rotation windows in this milestone and Phase 8's fix commits are one. Do NOT author a tripwire that fires on them (CONTEXT.md `<specifics>`) |
| OS-registered state | None | None |
| Secrets / env vars | No new secret. The Nx env vars used by the cold recipe (`NX_DAEMON`, `NX_WORKSPACE_DATA_DIRECTORY`, `NX_NATIVE_FILE_CACHE_DIRECTORY`) are process-scoped inside a CI step, never workflow-level | None. See `## Public surface` for why these do not violate PARITY-07 |
| Build artifacts | `.nx/workspace-data/tsc-*.hash` on every developer machine holds a stale inference (Finding 4). It will NOT self-heal when the fix lands | Developers need `nx reset` after the fix commit. This is DOCS-07's note (Phase 12) -- Phase 8 should state the need in the record so Phase 12 can derive it |

## Public surface

PARITY-07 requires the public-surface guard to pass **unchanged**: no new env knob, no new action
input, no new package export. Three clarifications the planner needs:

1. **Nx's own process env vars are not a public knob.** `NX_DAEMON`, `NX_WORKSPACE_DATA_DIRECTORY`
   and `NX_NATIVE_FILE_CACHE_DIRECTORY` are Nx's, they are set inside a single CI step or a local
   shell, and they are not read by any shipped code. The guard pins THIS package's contract. Say
   so in the plan so a reviewer does not read the cold recipe as a violation.
2. **`src/hash-parity/` must not become an export.** D-19's `!dist/hash-parity` in `files` handles
   the tarball; also confirm no `exports`/entry-point addition and add the `pack-check.cjs`
   forbidden-list entry (Pitfall 8).
3. **The instrument is a root-level `.mjs`, outside the package.** It ships nothing.

---

## Validation Architecture

`workflow.nyquist_validation` is `true` in `.planning/config.json`. [VERIFIED]

### Test framework

| Property | Value |
|----------|-------|
| Framework | Vitest ~4.1.0 via `@nx/vitest` (`testTargetName: "test"`) |
| Config file | `packages/github-cache/vitest.config.mts` (unit); `vitest.integration.config.mts` (integration) |
| Quick run command | `npx nx test @op-nx/github-cache` |
| Full suite command | `npm test` (`nx run-many -t test`) |
| Spec placement | **Co-located, always** -- `foo.ts` + `foo.spec.ts` in the same directory. No `tests/` tree. [VERIFIED: `TESTING.md:37-45`] |

### Phase requirements -> test map

| Req | Behaviour | Test type | Automated command | Exists? |
|-----|-----------|-----------|-------------------|---------|
| CORR-03(a) | Fewer than two records FAILS | unit | `npx nx test @op-nx/github-cache -- hash-parity` | Wave 0 |
| CORR-03(a) | A record missing a target's hash FAILS | unit | same | Wave 0 |
| CORR-03(a) | A record with an EMPTY `targets` map FAILS (vacuity control, D-22) | unit | same | Wave 0 |
| CORR-03(b) | Matching `integration` hashes FAIL | unit | same | Wave 0 |
| CORR-03(c) | Differing `build` FAILS; likewise `typecheck`, `test` | unit | same | Wave 0 |
| D-21 | Differing `lint` FAILS | unit | same | Wave 0 |
| CORR-03 | A genuinely-correct record pair PASSES (positive control) | unit | same | Wave 0 |
| PARITY-02 | The instrument emits a non-empty `details.nodes` per target | unit-ish | a spec over a captured fixture record | Wave 0 |
| PARITY-02 | The instrument's hash equals Nx's own | **manual / CI step** | run the instrument, then `nx run <t>`, compare to `run.json` in the same step | Wave 0 (as a CI step, not a spec) |
| CORR-04 | `integration` is the only runtime-input target | unit | `nx-target-inputs.spec.ts:241-260` | **EXISTS -- reuse** |
| PARITY-01 | Node-by-node root-cause record predates the fix | **git history** | `git log` ordering; D-06 says no programmatic mtime guard | n/a |
| PARITY-03 | Byte-identical at three observation points | **Live-CI + hand-capture** | the two-leg job; points 1-2 pasted by hand | Live-CI |
| PARITY-04 | Warm-local vs cold-CI, as its own question | **hand-capture** | two local runs, both `meta`-stamped | manual |
| PARITY-05 | `integration` identical workstation vs windows-11-arm | **Live-CI + hand-capture** | same records | Live-CI |
| PARITY-06 | `meta` completeness | unit | assert every `meta` field non-empty when parsing a record | Wave 0 |
| PARITY-07 | Public surface unchanged | unit | existing public-surface guard + `pack-check` | EXISTS |
| CORR-03 | The gate actually gates | **Live-CI first push** | the compare job must be observed RED once (D-22) before it is trusted | Live-CI |

### Sampling rate

- **Per task commit:** `npx nx test @op-nx/github-cache`
- **Per wave merge:** `npm test && npm run typecheck && npm run lint`
- **Phase gate:** full suite green, plus the two-leg job observed both GREEN and (via a deliberate
  fixture-level RED) capable of failing, before `/gsd:verify-work`

### Wave 0 gaps

- [ ] `packages/github-cache/src/hash-parity/compare.spec.ts` -- all seven comparator cases above
- [ ] Fixture records (valid pair, one-record, empty-targets, each single-clause violation) --
      as inline TypeScript objects or `.json` under `{projectRoot}` so they are covered by `default`
- [ ] `!dist/hash-parity` in `packages/github-cache/package.json` `files`, **plus** the matching
      `pack-check.cjs` forbidden-list entry
- No framework install needed.

### What only a real runner can prove

Per `TESTING.md`'s Live-CI first-push close pattern: the ubuntu and windows observation points, the
two-leg comparison itself, and the gate's ability to fail on a real leg are all unreachable
locally without faking the exact thing under test. They close on the first push that runs the
workflow. Name them in the plan as Live-CI items rather than letting them look like ordinary
verification steps that were skipped.

### What is hand-captured

Observation points 1 and 2 (D-07). No hosted runner is a developer workstation. Each pasted value
carries its full `meta` block so a stale paste is detectable -- which is only true if `meta`
includes the commit SHA and the measured (not asserted) graph state.

---

## Security Domain

`workflow.security_enforcement` is `true`, `security_asvs_level: 1`. [VERIFIED]

### Applicable ASVS categories

| ASVS category | Applies | Standard control |
|---------------|---------|------------------|
| V2 Authentication | no | Phase 8 adds no auth surface; the new CI job needs no secret and no sidecar |
| V3 Session Management | no | No sessions |
| V4 Access Control | **yes (narrow)** | The new workflow job must not widen `permissions`. It reads the repo and writes an artifact -- `contents: read` suffices. Do NOT add a job-level `permissions` block that REPLACES the workflow-level grant (ci.yml already records this trap for the dogfood jobs) |
| V5 Input Validation | **yes** | The comparator parses JSON downloaded from an artifact. Validate shape before indexing: missing `targets`, non-object `nodes`, non-string hashes must produce a comparator FAILURE, not a `TypeError`. Prefer a hand-written narrowing check over a new dependency |
| V6 Cryptography | no | No crypto is authored; Nx's hashing is not a security boundary here |

### Known threat patterns

| Pattern | STRIDE | Standard mitigation |
|---------|--------|---------------------|
| Untrusted artifact content crashes the comparator instead of failing it | Denial of Service | Shape-validate before use; a crash and a failure are both red, but only one names the cause (D-23's spirit) |
| A workflow-injection sink via captured stdout | Injection | The discriminator's stdout is written to JSON and read by Node -- never interpolated into a shell command or `$GITHUB_ENV`. Keep it that way |
| The gate is silently disabled | Tampering | D-18 (no `continue-on-error`) plus D-22 (observed RED). A `continue-on-error: true` added later is invisible in a green run -- Phase 7's `nx run-many` learning generalises |
| Job-level `permissions` replacing rather than extending the workflow grant | Elevation / breakage | Omit the job-level block; ci.yml already documents this exact hazard |

---

## Environment Availability

| Dependency | Required by | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | instrument, comparator | yes | v24.13.0 local; `.node-version` is `lts/krypton` (a moving alias -- PARITY-06 calls this out) | none needed |
| `nx` | instrument | yes | 23.1.0, exact-pinned devDep | none -- version parity across observation points is a PARITY-06 requirement, not a nicety |
| `typescript` / `vitest` | comparator + spec | yes | installed | none needed |
| `git` | D-06's before-the-fix proof | yes | -- | none |
| `gh` CLI | version lookups during research only | yes | -- | not needed at runtime |
| `ubuntu-24.04-arm` / `windows-11-arm` runners | PARITY-03, PARITY-05, CORR-03 | yes -- both already used by `ci.yml:409` | -- | none. These are Live-CI-only |
| `actions/upload-artifact` / `download-artifact` | CORR-03 | **new to this repo** | v7 / v8 | none worth taking |

**Missing dependencies with no fallback:** none.

---

## State of the Art

| Old approach | Current approach | When changed | Impact |
|--------------|------------------|--------------|--------|
| `Hasher` / `TaskHasher` constructed directly | `createTaskHasher(projectGraph, nxJson)`, which picks daemon vs in-process | -- | Use the factory; constructing `InProcessTaskHasher` yourself needs `getFileMap().rustReferences` |
| `hashTask(task)` / `hashTask(task, taskGraph)` | `hashTask(task, taskGraph, env, cwd?)` | deprecated "will be removed in v20", still present in 23.1.0 | Always pass `env` |
| `hashTasks(tasks, taskGraph, env)` | `hashTasks(tasks, taskGraph, perTaskEnvs)` keyed by `task.id` | deprecated, "will be removed in v22" | Irrelevant if hashing one task at a time, which is what the instrument does |
| `HashPlanInspector.inspect()` -> `string[]` | `inspectTaskInputs()` -> structured `HashInputs` | 23.x | Both skip `ProjectConfiguration`. Neither is the instrument |
| Nx 23.0.2 hash planner | 23.1.0 hash-planner rewrite | between 23.0.2 and 23.1.0 | **Cross-version measurements are non-comparable.** This is why PARITY-06 requires `nxVersion` in every record |

**Deprecated / outdated:**
- `NX_PROJECT_GRAPH_CACHE_DIRECTORY` -- superseded by `NX_WORKSPACE_DATA_DIRECTORY`; still honoured
  as a fallback in `workspaceDataDirectoryForWorkspace`.
- `actions/upload-artifact@v3` and below -- long dead; v4 introduced immutable, uniquely-named
  artifacts, which is why per-leg names are mandatory.
- `AGENTS.md`'s claim that each git worktree gets its own `.nx/cache` -- not true in Nx 23.1.0
  (Pitfall 7).

---

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|-------|---------|---------------|
| A1 | The Windows separator-sensitivity in `isExternalProjectReference` / `getConfigContext` is the mechanism behind the empty `internalProjectReferences`, and therefore behind the cross-OS axis too | The measured root cause, Finding 3 | The two-leg reading would show a different diverging node. Cost is one wrong first hypothesis, not a wrong design -- the instrument answers it either way |
| A2 | `targetDefaults.typecheck.outputs` will normalise `ProjectConfiguration`'s `outputs` field the way `targetDefaults.typecheck.inputs` demonstrably normalises `inputs` | U-01 research update; Finding 2 | If false, U-01 is live and the fix location must be re-opened with the maintainer. Confirming experiment is one `nx.json` line plus one re-measurement |
| A3 | `typecheck`'s third variance source is the `dependentTasksOutputFiles` node hashing a `dist/` that is present locally and absent on a fresh runner | Node vocabulary; D-11 | D-11 explicitly permits recording it OPEN. Not a blocker |
| A4 | `if: always()` on a `needs`-gated job runs when an upstream matrix leg failed or was skipped | CI mechanics | Standard documented Actions behaviour, but not executed this session. If wrong, D-17's "fewer than two records is a FAILURE" is unreachable in that shape and the plan needs two separately-named jobs instead |
| A5 | `upload-artifact@v7` + `download-artifact@v8` is a working pair on `windows-11-arm` | CI mechanics | The pairing is documented in download-artifact's own README; the arm64 Windows runner is not called out as an exception. Live-CI closes it |
| A6 | The 7-entry `typecheck` outputs list is the CORRECT one and the 1-entry list is the degraded one | Finding 2 | If inverted, an override would pin the wrong list and break `typecheck` caching. Verify against what `tsc --build tsconfig.json --emitDeclarationOnly` actually writes before pinning |

---

## Open Questions

1. **Does the cross-OS axis diverge at the same node as the staleness axis?**
   - Known: the staleness axis is `ProjectConfiguration`, one node, all five targets.
   - Unclear: the Linux leg is unmeasurable from this workstation. A differing external-dependency
     SET (`only-in-*` keys) is an equally plausible cross-OS shape and would NOT show up as
     `value-changed`.
   - Recommendation: the two-leg capture job answers this on its first run. Design the diff
     tooling to report both bucket kinds prominently so whichever it is, it is legible.

2. **Is the 7-entry or the 1-entry `typecheck` outputs list correct?** (A6)
   - Recommendation: check what the command actually emits before pinning either.

3. **Does `lint` diverge cross-OS?** (D-21's named fallback)
   - Known: `@nx/eslint` inference is the newest in the workspace and Phase 7 left it
     UNVERIFIED BY DESIGN.
   - Recommendation: the job measures it either way; D-21 already specifies both branches. No
     research can settle it -- only the runner can.

4. **How is `installMode` obtained honestly?** (Pitfall 6)
   - Recommendation: a required CLI flag with NO default, set by the CI step that ran the install.
     A defaulted flag records a guess as a measurement.

5. **Should `AGENTS.md`'s worktree/`.nx` claim be corrected in this phase?** (Pitfall 7)
   - Recommendation: raise it, do not drive-by fix it. It is a doc edit outside the phase boundary
     and CONTEXT.md's `<domain>` block is explicit about what is not in this phase.

---

## Sources

### Primary (HIGH confidence -- executed or read in the installed tree this session)

- `node_modules/nx/dist/src/hasher/task-hasher.d.ts` -- `Hash`, `PartialHash`, `TaskHasher`
  signatures, deprecation notes
- `node_modules/nx/dist/src/hasher/task-hasher.js` -- `createHashDetails`, `hashCommand`,
  `InProcessTaskHasher` / `DaemonBasedTaskHasher`
- `node_modules/nx/dist/src/hasher/create-task-hasher.{d.ts,js}` -- factory + daemon branch
- `node_modules/nx/dist/src/hasher/hash-task.{d.ts,js}` -- free `hashTask` mutation semantics,
  `getTaskDetails()` nullability
- `node_modules/nx/dist/src/hasher/hash-plan-inspector.{d.ts,js}` -- the rejected instrument
- `node_modules/nx/dist/src/native/index.d.ts:79-87` -- "ProjectConfiguration is skipped for now"
- `node_modules/nx/dist/src/command-line/reset/reset.js` -- reset granularity, daemon kill
- `node_modules/nx/dist/src/utils/cache-directory.js` -- `cacheDir`, `workspaceDataDirectory`,
  worktree sharing
- `node_modules/nx/dist/src/native/native-file-cache-location.js` -- the temp-dir cache
- `node_modules/nx/dist/src/tasks-runner/create-task-graph.d.ts` + `run-command.js:435` --
  `extraTargetDependencies` shape
- `node_modules/@nx/js/dist/src/plugins/typescript/plugin.js:505-830` -- `getOutputs`,
  `resolveInternalProjectReferences`, `isExternalProjectReference`, the tsconfig cache
- `.nx/workspace-data/tsc-2568428459166798129.hash` -- both inference forms, side by side
- Executed: the prototype instrument (5 targets x 4 graph/daemon configurations), the node-map
  diff, the merged-project-node diff, the `run.json` cross-check, the TypeScript
  `getParsedCommandLineOfConfigFile` path probe, `nx show target --inputs`
- `gh api repos/actions/{upload,download}-artifact/releases` -- current majors

### In-repo (HIGH confidence)

- `packages/github-cache/src/nx-target-inputs.spec.ts` -- the precedent, its documented limits,
  the existing CORR-04 guard at :241-260
- `nx.json` -- `targetDefaults` for all five targets, `integration`'s discriminator
- `.github/workflows/ci.yml:392-475` -- the two-leg matrix skeleton and its `shell: bash` rationale
- `packages/github-cache/package.json` `files` + `pack-check.cjs:106-125`
- `.planning/research/v0.0.2/PROBE-RESULTS.md`, `.planning/REQUIREMENTS.md`,
  `.planning/ROADMAP.md`, `08-CONTEXT.md`
- `.planning/phases/07-.../07-LEARNINGS.md`, `.planning/codebase/TESTING.md`

### Secondary (MEDIUM confidence)

- `actions/download-artifact` README (fetched via `gh api`) -- v7/v8 pairing, `pattern` +
  `merge-multiple`, unique-name requirement

---

## Metadata

**Confidence breakdown:**

- Instrument API and call sequence: **HIGH** -- executed, and validated byte-identical against
  `.nx/cache/run.json`
- Node key vocabulary: **HIGH** -- observed in live runs across five targets
- Staleness axis and its single diverging node: **HIGH** -- reproduced non-destructively, three
  independent runs
- `nx show target inputs` insufficiency: **HIGH** -- source citation plus a run
- Cross-OS root cause: **MEDIUM** -- mechanism localized from plugin source and one measured
  Windows-side path-form asymmetry, but the Linux leg was not measured
- CI artifact mechanics: **MEDIUM** -- versions and patterns verified from the actions' own repos;
  not executed against `windows-11-arm`
- U-01 resolution: **MEDIUM** -- strong in-repo evidence, one cheap unrun experiment away from HIGH

**Research date:** 2026-07-28
**Valid until:** ~2026-08-27 for the Nx internals (stable within 23.1.x; the 23.0.2 -> 23.1.0
rewrite shows a minor bump can invalidate this wholesale). ~2026-08-11 for the artifact action
majors.
