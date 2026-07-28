# Phase 8 - Root-Cause Record

Opened by plan 08-01. Appended to by plans 08-03, 08-04, 08-05 and 08-06.

Every number in this document is MEASURED on this repo at the stated commit, and never predicted.
Where a prediction from `08-RESEARCH.md` exists it is quoted alongside so the divergence -- or its
absence -- is visible. This follows Phase 7's `07-EVIDENCE.md` convention (D-06).

**`08-RESEARCH.md`'s own numbers are NOT carried forward as this record's values.** That research was
measured at commit `c61ef40` as a MAP for the investigation. `08-CONTEXT.md`'s `<specifics>` requires
Phase 8 to re-take the reading at its own commit rather than cite an earlier one as current, and
D-15's ordering makes the point load-bearing: every `nx.json` edit rotates hashes, so a value taken
before this phase describes a different tree. Where a research figure is genuinely useful for
comparison it appears inside an explicitly labelled research-prediction callout and nowhere else.

This record lands in its own commit BEFORE any fix commit. Git history is the proof; there is no
programmatic mtime guard (D-06).

---

## Method

Recorded: 2026-07-28. Host: Windows 11 arm64 (`win32`/`arm64`), node v24.13.0, npm 11.6.2,
Nx 23.1.0 (installed, exact-pinned). Base commit: `5a8f7c5`.

### The instrument

`capture-hashes.mjs` at the repo root -- a dev-only ESM script, NOT a module of the published
package and NOT an Nx target (D-01). Two independent reasons, both load-bearing: it imports
`nx/src/hasher/*` and `nx` is a devDependency, so a shipped module importing it would break every
consumer install; and an Nx-CACHED instrument would REPLAY a stale record instead of measuring, and
a cached capture is not a capture. The root `package.json` declares `nx.includedScripts` as an empty
array, so the `capture:hashes` script cannot become an Nx target -- that half of D-01 is satisfied
STRUCTURALLY, not by discipline.

It computes nothing itself. It calls Nx's own arithmetic through four internal-subpath imports
(D-02), each with an explicit `.js` extension via the package's `./src/*` export condition:

```js
import { readNxJson } from 'nx/src/config/nx-json.js';
import { createProjectGraphAsync } from 'nx/src/project-graph/project-graph.js';
import { createTaskGraph } from 'nx/src/tasks-runner/create-task-graph.js';
import { createTaskHasher } from 'nx/src/hasher/create-task-hasher.js';
```

Per target: `createTaskGraph(projectGraph, {}, [PROJECT], [target], undefined, {})`, then
`await createTaskHasher(projectGraph, nxJson).hashTask(task, taskGraph, process.env)`. The METHOD is
used, not the free `hashTask` from `nx/src/hasher/hash-task.js`: the free function mutates the task,
returns void, and writes to the task-details SQLite DB during a measurement.

`nx/src/*` is an internal subpath with no semver guarantee. An Nx major that moves it breaks the
instrument at IMPORT time -- loud and immediate, never a silent pass. Same posture and precedent as
`packages/github-cache/src/nx-target-inputs.spec.ts:35-37`.

Five targets are captured (D-05): `build`, `typecheck`, `test`, `integration`, `lint`. `lint` is
present because Phase 7's D-35 hands it over explicitly; `STACK.md` section 7 left "does `@nx/eslint`
infer `lint` identically on both OSes?" UNVERIFIED BY DESIGN.

Each record carries, beyond the per-target `hash` / `command` / `nodes` map, the merged project node
(`projectGraph.nodes[PROJECT].data`) as a top-level `projectConfiguration` key. That addition is what
makes PARITY-01 answerable at all: the node map carries exactly ONE `<project>:ProjectConfiguration`
entry covering all five targets, so a difference there cannot be localised to a FIELD without the
merged node itself. Note that `metadata` inside that node is not hashed, so a difference there is
informational rather than a hash divergence.

The instrument throws -- naming the target, the likely causes and the available task ids -- when
`taskGraph.tasks[<project>:<target>]` is absent. That is Phase 7's `nx run-many -t <missing>` exits 0
learning applied at the measurement layer: a deleted inferred target must never read as "measured, no
difference".

### `graphState` is MEASURED, not asserted

D-04 requires the graph state to be recorded; it does not permit it to be taken on the caller's word.
The instrument has NO graph-state CLI flag -- grep the file and there is nothing to find. It reads
the resolved directories and their entry counts BEFORE `createProjectGraphAsync` runs and derives the
verdict from that.

The reason is a real, hit failure mode: `nx reset --onlyWorkspaceData` fails on Windows with
`EPERM, Permission denied` because it does not stop the daemon (only `--onlyDaemon` and a full
`nx reset` call `killDaemon()`) and the daemon holds the workspace-data SQLite file open. A recipe
that runs the reset and carries on leaves a WARM graph sitting behind a record that claims cold. A
measured non-zero `workspaceDataEntries` under a "cold" label is exactly the warning sign the field
exists to raise.

The resolved directories are recorded RAW, not forward-slash-normalised. A backslash IS the Windows
fact and this record is evidence. Recording the paths also makes an `NX_WORKSPACE_DATA_DIRECTORY` or
`NX_NATIVE_FILE_CACHE_DIRECTORY` redirect visible in the record instead of silently reclassifying the
measurement.

**Correction to `08-RESEARCH.md`'s recommended derivation, measured here.** RESEARCH's snippet under
`## Measuring graphState rather than asserting it` derives `cold` from BOTH the workspace-data entry
count and the native-file-cache entry count being zero. That derivation cannot ever return `cold`.
Measured at this commit: `getNativeFileCacheLocation()` is not a hash cache at all --
`node_modules/nx/dist/src/native/index.js:96-107` uses it to hold one version-prefixed copy of the
`.node` addon binary ("we copy the file to a workspace-scoped tmp directory and prefix with nxVersion
to avoid stale files being loaded"), and loading `nx/src/project-graph/project-graph.js` puts it there
before any measurement can run. Probed directly against a fresh empty directory: zero entries at
process entry, zero after importing `native-file-cache-location.js`, and
`[ '23.1.0-nx.win32-arm64-msvc.node' ]` immediately after importing `project-graph.js`. On this box
the long-lived native cache directory likewise holds that one file and nothing else.

So the verdict is derived from `workspaceDataEntries` ALONE, and the record carries an explicit
`meta.graphStateBasis: "workspaceDataEntries"` so a reader does not have to consult the source to
learn which surface decided. The native count stays in the record as evidence; it simply cannot
discriminate. Had the two-surface form shipped, every record would have read `warm` forever -- the
same class of silently-always-passes defect that D-04 exists to prevent.

### The cold recipe: environment variables, not deletion

```bash
COLD="$(mktemp -d)"
NX_DAEMON=false \
NX_WORKSPACE_DATA_DIRECTORY="$COLD/wsdata" \
NX_NATIVE_FILE_CACHE_DIRECTORY="$COLD/nfc" \
  node capture-hashes.mjs --install-mode ci --out "$OUT"
rm -rf "$COLD"
```

Three reasons this beats deleting `.nx/`:

1. **`rm -rf .nx/` does not produce a cold state at all.** The native file cache resolves under the
   OS temp directory, OUTSIDE the repo. A recipe that only deletes `.nx/` is measuring something it
   cannot name.
2. **An empty directory is cold by construction; `nx reset` is an operation that can fail.** See the
   EPERM case above.
3. **It is non-destructive.** D-07 asks the same person to capture a cold point and then a
   warm-preexisting point. `nx reset` destroys the very state the second point needs.

`nx reset` is still the right thing to DOCUMENT for a developer whose box misses everything -- that
is DOCS-07's note, deferred to Phase 12. It is the wrong thing to build a measurement on.

`NX_DAEMON` is MEASURED into the record as `daemonEnabled`, never forced from inside the instrument.
The daemon is not an arithmetic hazard; it is a fourth staleness surface with no inspectable file,
which is why the CALLER disables it and the record reports whether the caller did.

### Install mode

`--install-mode <ci|install>` is a REQUIRED flag with NO default, and a missing or unrecognised value
throws before any measurement runs. `process.env.npm_config_*` is unavailable when the script is
invoked directly, so a defaulted flag would record a GUESS as a measurement (PARITY-06). This matters
because `npm ci` and `npm install` can produce different platform-conditional optional-dependency
sets, and the node map carries 422 or more `npm:` entries -- an install-mode difference and an OS
difference wear the same shape in the diff.

### Working tree at the time of this record's measurements

`git status --porcelain` reported exactly one modified file, `.planning/STATE.md`, so the instrument
recorded `meta.workingTreeClean: false`. Verified rather than waved away: `.planning/` is not an
input to any target. Every target's hashed `workspace:` fileset node was checked for a `.planning`
reference and all five returned zero, and the two `workspace:` keys on `test` -- the target with the
longest explicit `{workspaceRoot}` input list -- enumerate `tsconfig.base.json`, `SECURITY.md`,
`LICENSE`, `package.json`, `nx.json`, the docs set, `cleanup.yml`, `.gitattributes`, `ppe/action.yml`,
`.gitignore` and `.nxignore`. No planning artifact reaches a task hash.

---

## The instrument computes Nx's number

The question this section answers: neither of D-08's two. It is the precondition for both. Until the
instrument is proven to compute the SAME number Nx computes, nothing downstream is a measurement of
Nx.

Executed in ONE shell session at commit `5a8f7c5`, with nothing interleaved between each `nx` run and
the read of the file it produced:

```bash
node capture-hashes.mjs --install-mode ci --out "$OUT/instrument.json"
npx nx run @op-nx/github-cache:build   && cp .nx/cache/run.json "$OUT/run-build.json"
npx nx run @op-nx/github-cache:test    && cp .nx/cache/run.json "$OUT/run-test.json"
```

| Target | Instrument `targets.<t>.hash` | `.nx/cache/run.json` `tasks[].hash` | `cacheStatus` | Result |
|--------|-------------------------------|-------------------------------------|---------------|--------|
| `build` | `15091651677672778193` | `15091651677672778193` | `local-cache-hit` | PASS -- byte-identical |
| `test`  | `17043910507556371878` | `17043910507556371878` | `local-cache-hit` | PASS -- byte-identical |

`test` was chosen as the second target because its declared input list is the longest in the
workspace, so it exercises the most input kinds (an explicit `{workspaceRoot}` file list, a
`fileset` with `dependencies: true`, a `json` field filter, an `externalDependencies` list, and a
`dependentTasksOutputFiles` entry).

`meta` for the instrument run in that session:

```json
{
  "os": "win32",
  "arch": "arm64",
  "nxVersion": "23.1.0",
  "nodeVersion": "v24.13.0",
  "installMode": "ci",
  "commit": "5a8f7c560bfd3991608e5f0f9ddbc6a453fb373c",
  "workingTreeClean": false,
  "githubSha": null,
  "runnerOs": null,
  "capturedAt": "2026-07-28T00:48:52.735Z",
  "graphState": "warm",
  "graphStateBasis": "workspaceDataEntries",
  "workspaceDataDirectory": "D:\\projects\\github\\op-nx\\github-cache\\.nx\\workspace-data",
  "workspaceDataEntries": 18,
  "nativeFileCacheDirectory": "C:\\Users\\LARSGY~1\\AppData\\Local\\Temp\\nx-native-file-cache-b463ff1",
  "nativeFileCacheEntries": 1,
  "daemonEnabled": true
}
```

**Method caveat (Pitfall 2).** `.nx/cache/run.json` is overwritten UNCONDITIONALLY by every `nx`
invocation -- `StoreRunInformationLifeCycle` writes it on every run, not only on a miss. The
comparison is only valid because each copy was taken before the next `nx` command, with no
`nx show`, no `nx reset`, and no editor-triggered graph build in between. The `nx show` invocations
in the next section were deliberately run AFTER both copies were taken. A repeat of this check must
reproduce that discipline; a value read out of a `run.json` that some later command wrote is a
measurement of that later command.

Two notes for readers comparing against earlier documents:

- These are the values at `5a8f7c5` with a warm, long-lived `.nx/workspace-data`. They are not
  offered as this phase's observation points; those arrive in plan 08-03 at the anchor commit.
- The `test` hash rotated within this plan. Adding the `capture:hashes` script edited the root
  `package.json`, and `{workspaceRoot}/package.json` is a declared `test` input. That is a correct,
  expected rotation and not a divergence.

---

## Why `nx show target inputs` is not evidence (D-03, PARITY-02)

The question this section answers: neither of D-08's two. It closes an anti-requirement. A "no
difference" result from this surface is NOT evidence, and both of v0.0.1's named suspects are
invisible to it.

Two independent citations, both taken at `5a8f7c5`.

### 1. It skips the node that matters, by its own documentation

`node_modules/nx/dist/src/native/index.d.ts:79-87`, the doc block on
`HashPlanInspector.inspectInputs`:

```
  /**
   * Like `inspect()` but returns structured `HashInputs` objects instead of flat strings.
   * Each `HashInstruction` is categorized into the appropriate bucket (files, runtime,
   * environment, depOutputs, external). TsConfiguration is resolved to the root tsconfig
   * file path. JsonFileSet is resolved to the matched JSON file paths (field/excludeField
   * filters only affect hashing, not which files are reported as inputs).
   * ProjectConfiguration is skipped for now. Cwd is skipped as it's ambient.
   */
```

Line 86 is the operative one: *"ProjectConfiguration is skipped for now. Cwd is skipped as it's
ambient."*

**The programmatic form carries the same limitation.** `HashPlanInspector` is reachable directly at
`nx/src/hasher/hash-plan-inspector.js`, and `inspectTaskInputs()` returns a structured `HashInputs`
rather than the CLI's rendering. It is built on the same NAPI inspector and the doc quoted above is
the doc for that class. So "maybe the API is better than the CLI" is closed here rather than left to
be raised later: it is the same inspector with a different wrapper.

### 2. It reports file PATHS, not content hashes -- run, not asserted

Note a CLI detail worth recording, because it changes what a reader has to run to reproduce this.
`--inputs` is NOT a flag at Nx 23.1.0; it is a SUBCOMMAND. `nx show target --help` reports:

```
Commands:
  nx show target inputs [target]           List resolved input files for a target.
  nx show target outputs [target]          List resolved output paths for a target.
  nx show target [target] [subcommand]     Shows resolved target configuration for a given project target. ...
```

`08-RESEARCH.md`'s invocation, `npx nx show target @op-nx/github-cache:build --inputs`, therefore
exits 0 while the trailing `--inputs` is INERT: it prints the resolved target CONFIGURATION, which
is the declared `inputs` array copied out of `nx.json` verbatim plus a `sourceMap`. That is an even
weaker surface than the one D-03 rejects -- no resolution at all. Both were run so that neither
reading can be dismissed as the wrong command.

The real subcommand, `npx nx show target inputs @op-nx/github-cache:build`, exits 0 and returns
exactly four keys plus the target identity:

```json
{
  "project": "@op-nx/github-cache",
  "target": "build",
  "files": [
    ".gitignore",
    "nx.json",
    "packages/github-cache/package.json",
    "packages/github-cache/src/action/index.ts",
    "packages/github-cache/src/backend/actions-cache-backend.ts",
    ...
    "packages/github-cache/tsconfig.lib.json",
    "tsconfig.base.json"
  ],
  "environment": [
    "NX_CLOUD_ENCRYPTION_KEY"
  ],
  "external": [
    "npm:@actions/cache",
    "npm:@actions/core",
    "npm:@actions/exec",
    ...
  ]
}
```

Top-level keys: `project`, `target`, `files`, `environment`, `external`. 34 file PATHS, 1 environment
variable name, 422 external package names, 467 lines of output -- and not one content hash anywhere
in it. Grepping the whole 467-line output for `ProjectConfiguration` returns ZERO occurrences.

Set that against the instrument's map for the same target at the same commit: 428 nodes, each a
`name -> hash` pair, including the `@op-nx/github-cache:ProjectConfiguration` entry this surface does
not emit. Two different questions. The CLI answers "which files are declared inputs"; PARITY-01 asks
"which hashed node differs", and the CLI structurally cannot reach it.

### `.nx/cache/run.json` is complementary, not a substitute

It is the TASK-level surface -- `{ run: {...}, tasks: [ { taskId, hash, cacheStatus, ... } ] }` -- and
it is how the previous section proved the instrument computes Nx's number. It carries one hash per
task and no node breakdown, so it can confirm a total and never localise a difference. And it is
overwritten by every `nx` invocation, which makes it usable only inside the discipline described
above. Use it to cross-check the instrument; do not build the record on it.

---

## Every prior cross-OS measurement in this repo read a confounded variable (D-09)

The question this section answers: it disqualifies prior attempts at BOTH of D-08's questions.

The pair to name is the one recorded in `.planning/STATE.md`, from quick 260725-rk4, probe run
`30173654069`, attributed at the time to "ubuntu CI" versus "windows CI":

- `build` on the ubuntu leg: cache key `nx-cache-14522047022641658505`
- `build` on the windows leg: cache key `nx-cache-13655686526929222562`

That pair read a confounded variable and must never be cited as an OS measurement. Both values are
reproducible on ONE Windows machine at one commit by varying only `.nx/workspace-data`, so OS was not
isolated. `STATE.md` now carries its own in-place retraction of the attribution
(`STALE ATTRIBUTION REMOVED 2026-07-26`); this record restates it because D-09 requires the
root-cause document itself to say so, not to inherit it from a corrected footnote elsewhere. The same
disqualification applies to the three sibling pairs the same quick recorded for `typecheck`, `test`
and `integration`, which were produced the same way.

**Name the confound precisely.** It is NOT "the graph was warm". A warm graph is not by itself wrong,
and the next section records that a warm graph built from a fresh workspace-data directory agrees
with a cold one. The confound is that **the graph was carrying a persisted inference result that no
longer matched the tree**. That is a different and narrower statement: the disagreement is not
between computing and replaying, it is between two different inference outcomes, one of which was
written to disk earlier and never revalidated into agreement.

Consequence, stated as a rule for every later section of this record and for plans 08-03 through
08-06: **no difference may be attributed to the OS until staleness is pinned on both sides.** A
cross-OS reading is only admissible when both legs record their measured `graphState`, their
`workspaceDataEntries`, and their `installMode`, and when the two legs agree on all three. That is
why PARITY-06's `meta` block is a requirement rather than a nicety, and why the instrument measures
`graphState` instead of accepting it.

---

## The second axis is STALENESS, not freshness

The question this section answers: it corrects the framing that both of D-08's questions are asked
in. This is a CORRECTION to the roadmap's own wording, and it is recorded as one rather than applied
silently.

`.planning/ROADMAP.md` Phase 8 success criterion 1 says, verbatim:

> separates the TWO axes the 2026-07-26 pre-flight probe established
> (`research/v0.0.2/PROBE-RESULTS.md`): a real OS axis (cold-ubuntu differs from cold-windows for
> every target) and a FRESHNESS axis that perfectly masquerades as it (warm local Windows
> `build`/`test` equal cold ubuntu CI to the digit; cold local Windows equals cold windows CI to the
> digit). No difference may be attributed to the OS until freshness is pinned.

`.planning/REQUIREMENTS.md` PARITY-01 uses the same word: *"(b) a FRESHNESS axis that perfectly
masquerades as it"*.

> **Research prediction, NOT this record's measurement.** `08-RESEARCH.md`'s Finding 4, measured at
> commit `c61ef40` and reproduced there across three runs, reports that cold and warm produce the
> SAME hash when `.nx/workspace-data` is FRESH: two runs against a brand-new workspace-data
> directory -- the first cold by construction, the second warm because the first populated it --
> agreed on all five targets, while the repo's long-lived directory produced a different value. The
> figures behind that claim live in `08-RESEARCH.md` and are deliberately not reproduced here. Phase
> 8 re-takes the reading at its own commit in plan 08-03; until then this section records the
> correction to the FRAMING, not a number.

So `cold != warm` is false as a general statement, and `stale != fresh` is what is true. The
distinction is not pedantic -- it changes what the axis is and what closes it:

- **`nx reset` is the only known cure, and it is not a control.** A control is something you can set
  and hold on both sides of a comparison. `nx reset` destroys state; it does not establish a
  reproducible one. The env-var recipe in `## Method` is the control, because an empty directory is
  cold by construction and its emptiness is readable before the measurement.
- **A warm-after-reset graph and a warm-since-March graph are different measurements wearing the same
  label.** This is why the record distinguishes `warm-fresh` (populated by a cold run in the same
  session) from `warm-preexisting` (whatever the developer's box already had), and why plan 08-03
  captures observation point 2 as **warm-preexisting** specifically. That is the state PARITY-04 is
  actually asking about; a warm-fresh reading would answer a question nobody asked.
- **It does not self-heal.** A stale persisted inference is not corrected by the next run that reads
  it; the file hash still validates, so nothing re-derives what that hash implies. This has a
  downstream consequence Phase 12 inherits: after Phase 8's fix commits land, developer machines will
  still be carrying the pre-fix inference, and `nx reset` is the note DOCS-07 needs to carry.

The roadmap and REQUIREMENTS wording is left as written and corrected here, attributably, rather than
edited in place. `.planning/ROADMAP.md` already carries a forward-pointing note that plan 08-01
records this correction with the quoted original; this section is that record.

---

## Which question each proof answers (D-08)

There are TWO questions in this phase and they are not the same question. Every later section of this
document is REQUIRED to state which of them it answers, and a section that answers neither must say
so (the two sections above that answer neither say so in their first line).

**Q1 -- cross-OS parity (PARITY-03, PARITY-05, CORR-03).** Do `build`, `typecheck`, `test` and `lint`
compute a byte-identical hash on `ubuntu-24.04-arm`, on `windows-11-arm` and on a native Windows
workstation, at one commit, with `integration` the only target that diverges?

**Q2 -- does a warm local box compute the hash cold CI published (PARITY-04)?** A fresh CI checkout
is always cold. A developer's box is not. If the everyday warm-preexisting state computes a different
hash from the one CI published, then O1 is unreachable regardless of how perfectly the OS axis is
closed.

**Q2 must NOT be silently resolved by `nx reset`, and the mechanism by which that happens is
specific.** TEST-10 mandates a reset in its proof recipe. `nx reset` clears `.nx/workspace-data`,
which forces the local box COLD. A cold local box compared against cold CI is a clean answer to Q1 --
and it looks like an answer to Q2 while having replaced Q2's subject. The developer whose experience
Q2 is about did not run `nx reset`; that is the entire premise. So any proof that resets before
measuring has answered Q1, and must be labelled Q1 no matter what it was aiming at.

Practical consequence for the observation points: D-07's point 1 (workstation, COLD) is a Q1 input.
Point 2 (workstation, WARM-PREEXISTING) is the only Q2 input available, and it cannot be produced by
CI, because no hosted runner is a developer workstation. Losing point 2 loses Q2 entirely.

---

## Observation points

**The anchor commit is `a9a3895a15700956f1a98e5532da2c3f5b245efe`.** All four observation points
carry it in `meta.commit`. It is the commit that added the `hash-parity` capture job to
`.github/workflows/ci.yml` and touched nothing else -- `git show --stat a9a3895` lists exactly one
file. `ci.yml` is NOT in `nx.json`'s `test` inputs (only `cleanup.yml` is, `nx.json:68`), so the
anchor commit itself rotates no task hash; it exists to give the four readings ONE SHA to share,
which is what PARITY-03 asks for.

### Where these readings were taken, and in what order

Points 1 and 2 came from the maintainer's own Windows 11 arm64 workstation, in the repository's
MAIN checkout -- not a git worktree. Verified rather than assumed, because Pitfall 7 makes the
distinction decisive (Nx 23.1.0's `sharedCacheDirectory()` resolves the MAIN worktree root, so a
worktree's "cold" reading is not cold):

```
$ git rev-parse --git-dir
.git                                     <- a DIRECTORY, not a `gitdir:` pointer file
$ git worktree list
D:/projects/github/op-nx/github-cache a9a3895 [gsd/v0.0.2-os-invariant-cross-os-sharing]
                                         <- exactly ONE entry, and it is this path
```

**Point 2 was captured BEFORE point 1, deliberately.** The cold recipe is non-destructive by
construction -- it redirects `NX_WORKSPACE_DATA_DIRECTORY` and `NX_NATIVE_FILE_CACHE_DIRECTORY`
into a temporary directory outside the repository and never touches `.nx/` -- so either order is
defensible. Taking the irreplaceable reading first removes even the residual risk: the long-lived,
STALE `.nx/workspace-data` IS the measurement subject of point 2, it cannot be regenerated once
disturbed, and nothing that runs afterwards can put it back. The cold reading, by contrast, can be
re-taken at will from an empty directory.

Before either capture, `npm ci` was run so the local install mode matches what both CI legs report
(`meta.installMode: "ci"` on all four points). That is not housekeeping: Pitfall 6 records that the
node map carries 400-plus external-dependency entries including platform-conditional optional
packages, so an install-mode difference produces `only-in-A` / `only-in-B` entries that look
exactly like an OS difference. `.nx/workspace-data` held 16 entries before `npm ci` and 16 after,
so the clean install did not disturb the stale state.

`git status --porcelain` was EMPTY immediately before and after every local capture, which is why
both records read `workingTreeClean: true`. Each record was written with `--out` pointing INSIDE
the temporary directory, so no capture landed in the working tree.

**Build-output state at capture time, stated because it turns out to matter.** Both workstation
captures were taken with `packages/github-cache/dist/` POPULATED by a full `npm run build`. Both CI
legs deliberately never build. `typecheck` declares a `dependentTasksOutputFiles` input that hashes
the CONTENT of that directory, so this is a real difference between the workstation points and the
runner points -- and it is the third variance source D-11 asks about. It is root-caused below
rather than left as a confound.

**What is pasted here and what is not.** Each section carries its full `meta` block, the five-target
hash table, and the discriminator's raw `stdout` and `stderr`. The node maps are NOT pasted: they
run 428-444 entries per target and roughly a quarter of a megabyte per record. What is pasted
instead is the DIFF, which is the part a reader needs. The full records exist as untracked local
files and as the two downloadable CI artifacts of run `30330077185`.

### Observation point 1 -- native Windows workstation, COLD

```json
{
  "os": "win32",
  "arch": "arm64",
  "nxVersion": "23.1.0",
  "nodeVersion": "v24.13.0",
  "installMode": "ci",
  "commit": "a9a3895a15700956f1a98e5532da2c3f5b245efe",
  "workingTreeClean": true,
  "githubSha": null,
  "runnerOs": null,
  "capturedAt": "2026-07-28T04:57:16.776Z",
  "graphState": "cold",
  "graphStateBasis": "workspaceDataEntries",
  "workspaceDataDirectory": "C:/Users/LARSGY~1/AppData/Local/Temp/claude/D--projects-github-op-nx-github-cache/ecd11393-4351-4fdb-a1bb-f555cfb148f0/scratchpad/hp/cold/wsdata",
  "workspaceDataEntries": 0,
  "nativeFileCacheDirectory": "C:/Users/LARSGY~1/AppData/Local/Temp/claude/D--projects-github-op-nx-github-cache/ecd11393-4351-4fdb-a1bb-f555cfb148f0/scratchpad/hp/cold/nfc",
  "nativeFileCacheEntries": 1,
  "daemonEnabled": false
}
```

Recipe, exactly as run:

```bash
COLD="$SP/cold"
rm -rf "$COLD"; mkdir -p "$COLD"
NX_DAEMON=false \
NX_WORKSPACE_DATA_DIRECTORY="$COLD/wsdata" \
NX_NATIVE_FILE_CACHE_DIRECTORY="$COLD/nfc" \
  node capture-hashes.mjs --install-mode ci --out "$SP/point1-cold.json"
```

| Target | Hash | Nodes |
|--------|------|-------|
| `build` | `4770979534943963808` | 428 |
| `typecheck` | `8784332057851660202` | 429 |
| `test` | `1238755096132544780` | 444 |
| `integration` | `3844377013355031551` | 430 |
| `lint` | `17022226934688547307` | 443 |

Discriminator, raw and verbatim (`command: node -p process.platform`, `status: 0`):

```json
{ "stdout": "win32\n", "stderr": "" }
```

**Which question this reading answers: Q1, cross-OS parity.** It is the workstation's contribution
to the three-way cold comparison, and the control that lets the same-OS pair with point 3 be read.

**`nativeFileCacheEntries` is 1, not 0, and that is the CORRECT cold reading.** The plan's
acceptance criterion asked for "both measured entry counts are zero", inheriting
`08-RESEARCH.md`'s two-surface derivation. `## Method` above already records that derivation as
measured-and-corrected: the native file cache is not a hash cache, it holds one version-prefixed
copy of the `.node` addon binary, and loading `nx/src/project-graph/project-graph.js` puts it there
before any measurement can run. Requiring both counts to be zero makes `cold` UNREACHABLE. Verified
directly for THIS reading rather than argued from the earlier note -- the freshly-created native
cache directory was listed after the run and holds exactly the addon copy and nothing else:

```
$ ls -1 "$COLD/nfc"
23.1.0-nx.win32-arm64-msvc.node
```

The verdict's declared basis is `workspaceDataEntries`, and that count IS zero. The cold directory
held 13 entries after the run, which is the run populating it -- the count in the record was read
before the graph was built.

### Observation point 2 -- native Windows workstation, WARM-PREEXISTING

```json
{
  "os": "win32",
  "arch": "arm64",
  "nxVersion": "23.1.0",
  "nodeVersion": "v24.13.0",
  "installMode": "ci",
  "commit": "a9a3895a15700956f1a98e5532da2c3f5b245efe",
  "workingTreeClean": true,
  "githubSha": null,
  "runnerOs": null,
  "capturedAt": "2026-07-28T04:56:58.057Z",
  "graphState": "warm",
  "graphStateBasis": "workspaceDataEntries",
  "workspaceDataDirectory": "D:\\projects\\github\\op-nx\\github-cache\\.nx\\workspace-data",
  "workspaceDataEntries": 16,
  "nativeFileCacheDirectory": "C:\\Users\\LARSGY~1\\AppData\\Local\\Temp\\nx-native-file-cache-b463ff1",
  "nativeFileCacheEntries": 1,
  "daemonEnabled": true
}
```

Recipe, exactly as run -- NO environment overrides at all:

```bash
node capture-hashes.mjs --install-mode ci --out "$SP/point2-warm-preexisting.json"
```

| Target | Hash | Nodes |
|--------|------|-------|
| `build` | `4824412313941236224` | 428 |
| `typecheck` | `4268438596418767705` | 429 |
| `test` | `3399438549782114146` | 444 |
| `integration` | `11646873861621802337` | 430 |
| `lint` | `14919174368951396261` | 443 |

Discriminator, raw and verbatim (`command: node -p process.platform`, `status: 0`):

```json
{ "stdout": "win32\n", "stderr": "" }
```

**Which question this reading answers: Q2 -- "does a warm local box compute the hash cold CI
published".** It is the ONLY Q2 input available and no runner can produce it. `daemonEnabled: true`
and `workspaceDataDirectory` pointing at the repository's own `.nx/workspace-data` are what make it
`warm-preexisting` rather than `warm-fresh`: this is the state the box was already in, not a state
manufactured for the measurement.

**No `nx reset` preceded this reading, and none preceded the session.** The staleness IS the
subject. Confirmed by the measurement itself rather than by assertion: had the long-lived graph
healed, points 1 and 2 would agree, and they do not -- the diff below shows the same single node
differing on all five targets.

### Provenance of points 3 and 4, and the checkout-pin check

Both came from GitHub-hosted runners on workflow run
[`30330077185`](https://github.com/op-nx/github-cache/actions/runs/30330077185), a `pull_request`
event on draft pull request #9, which exists solely to reach CI for this measurement. Both
`hash-parity` legs completed `success` and both uploaded an artifact; neither needed a re-run, so
the anchor never moved.

**The plan's pin check was stated backwards, and correcting it is what actually proves the pin.**
The plan asked to confirm `meta.commit == meta.githubSha`, reasoning that an unpinned
`pull_request` checkout resolves a merge commit and the two fields would then disagree. That is
inverted. `GITHUB_SHA` on a `pull_request` event is the MERGE commit, set by the runner from the
event payload -- it does not follow what the job checked out. So equality would mean the checkout
had landed on the merge commit, which is the pin FAILING. Disagreement in the specific direction
"commit == PR head, githubSha == merge commit" is the pin WORKING.

Measured, and cross-checked against the API rather than inferred:

| Field | Both legs | What it is |
|-------|-----------|------------|
| `meta.commit` | `a9a3895a15700956f1a98e5532da2c3f5b245efe` | the checked-out `HEAD` |
| `meta.githubSha` | `c6ec86ab4873c1f890526f07ce3f894c552a7ddc` | the runner-provided event SHA |

```
$ gh api repos/op-nx/github-cache/pulls/9 -q '{head:.head.sha,merge_commit:.merge_commit_sha,base:.base.sha}'
{"base":"fe25a3f865f20f3d4f8a40e96f8cb5717608ba8a",
 "head":"a9a3895a15700956f1a98e5532da2c3f5b245efe",
 "merge_commit":"c6ec86ab4873c1f890526f07ce3f894c552a7ddc"}
```

`meta.commit` equals the PR head SHA equals the anchor. `meta.githubSha` equals the merge commit
GitHub synthesised. The pin held on both legs, and the record measures the branch tree rather than
a tree no workstation can reproduce. The `ci.yml` comment block states the divergence direction to
watch for; it should be read as "commit must equal the anchor", with `githubSha` diverging on a
`pull_request` event by design.

**Cross-point `meta` comparison, per the D-09 admissibility rule.**

| Field | Point 1 (workstation) | Point 2 (workstation) | Point 3 (`windows-11-arm`) | Point 4 (`ubuntu-24.04-arm`) |
|-------|----------------------|----------------------|---------------------------|------------------------------|
| `commit` | anchor | anchor | anchor | anchor |
| `installMode` | `ci` | `ci` | `ci` | `ci` |
| `nxVersion` | `23.1.0` | `23.1.0` | `23.1.0` | `23.1.0` |
| `graphState` | `cold` | `warm` | `cold` | `cold` |
| `workspaceDataEntries` | 0 | 16 | 0 | 0 |
| `daemonEnabled` | `false` | `true` | `false` | `false` |
| `workingTreeClean` | `true` | `true` | `true` | `true` |
| `arch` | `arm64` | `arm64` | `arm64` | `arm64` |
| `nodeVersion` | `v24.13.0` | `v24.13.0` | **`v24.18.0`** | **`v24.18.0`** |

The three cold points agree on install mode, Nx version and graph state, so the cross-OS reading
between points 3 and 4 is admissible. Point 2 differs on graph state by construction -- that is its
purpose.

**The Node version is a named confound, and it is measurably inert.** `.node-version` holds
`lts/krypton`, a MOVING alias, so the runners resolved `v24.18.0` while this workstation is pinned
by `fnm` at `v24.13.0`. PARITY-06 requires it recorded, and a difference is a confound rather than
a footnote -- so it is checked rather than waved past. It is inert here, and the proof is in the
data below: points 1 and 3 differ ONLY in Node version, runner identity and build-output state,
and their `build`, `test`, `integration` and `lint` hashes are byte-identical with ZERO differing
nodes. The Node version reaches no hashed node.

### Observation point 3 -- `windows-11-arm` runner, cold

```json
{
  "os": "win32",
  "arch": "arm64",
  "nxVersion": "23.1.0",
  "nodeVersion": "v24.18.0",
  "installMode": "ci",
  "commit": "a9a3895a15700956f1a98e5532da2c3f5b245efe",
  "workingTreeClean": true,
  "githubSha": "c6ec86ab4873c1f890526f07ce3f894c552a7ddc",
  "runnerOs": "Windows",
  "capturedAt": "2026-07-28T04:58:03.064Z",
  "graphState": "cold",
  "graphStateBasis": "workspaceDataEntries",
  "workspaceDataDirectory": "C:\\a\\github-cache\\github-cache\\.nx\\workspace-data",
  "workspaceDataEntries": 0,
  "nativeFileCacheDirectory": "C:\\Users\\RUNNER~1\\AppData\\Local\\Temp\\nx-native-file-cache-a830eb7",
  "nativeFileCacheEntries": 1,
  "daemonEnabled": false
}
```

| Target | Hash | Nodes |
|--------|------|-------|
| `build` | `4770979534943963808` | 428 |
| `typecheck` | `14440024841214492138` | 429 |
| `test` | `1238755096132544780` | 444 |
| `integration` | `3844377013355031551` | 430 |
| `lint` | `17022226934688547307` | 443 |

Discriminator, raw and verbatim (`command: node -p process.platform`, `status: 0`):

```json
{ "stdout": "win32\n", "stderr": "" }
```

**Which question this reading answers: Q1, cross-OS parity.** It is also the same-OS control that
PARITY-05 asks for, paired with point 1.

### Observation point 4 -- `ubuntu-24.04-arm` runner, cold

```json
{
  "os": "linux",
  "arch": "arm64",
  "nxVersion": "23.1.0",
  "nodeVersion": "v24.18.0",
  "installMode": "ci",
  "commit": "a9a3895a15700956f1a98e5532da2c3f5b245efe",
  "workingTreeClean": true,
  "githubSha": "c6ec86ab4873c1f890526f07ce3f894c552a7ddc",
  "runnerOs": "Linux",
  "capturedAt": "2026-07-28T04:55:28.417Z",
  "graphState": "cold",
  "graphStateBasis": "workspaceDataEntries",
  "workspaceDataDirectory": "/home/runner/work/github-cache/github-cache/.nx/workspace-data",
  "workspaceDataEntries": 0,
  "nativeFileCacheDirectory": "/tmp/nx-native-file-cache-aa0ca25",
  "nativeFileCacheEntries": 1,
  "daemonEnabled": false
}
```

| Target | Hash | Nodes |
|--------|------|-------|
| `build` | `4824412313941236224` | 428 |
| `typecheck` | `12632208324451201361` | 429 |
| `test` | `3399438549782114146` | 444 |
| `integration` | `23244131947937181` | 430 |
| `lint` | `14919174368951396261` | 443 |

Discriminator, raw and verbatim (`command: node -p process.platform`, `status: 0`):

```json
{ "stdout": "linux\n", "stderr": "" }
```

**Which question this reading answers: Q1, cross-OS parity.** It is the leg the whole investigation
was missing -- `08-RESEARCH.md` could not measure it from a Windows workstation, which is why its
Finding 3 is a lead rather than a proof.

### All four points side by side

| Target | 1 workstation COLD | 2 workstation WARM-PRE | 3 `windows-11-arm` | 4 `ubuntu-24.04-arm` |
|--------|--------------------|------------------------|--------------------|----------------------|
| `build` | `4770979534943963808` | `4824412313941236224` | `4770979534943963808` | `4824412313941236224` |
| `typecheck` | `8784332057851660202` | `4268438596418767705` | `14440024841214492138` | `12632208324451201361` |
| `test` | `1238755096132544780` | `3399438549782114146` | `1238755096132544780` | `3399438549782114146` |
| `integration` | `3844377013355031551` | `11646873861621802337` | `3844377013355031551` | `23244131947937181` |
| `lint` | `17022226934688547307` | `14919174368951396261` | `17022226934688547307` | `14919174368951396261` |

Two things are visible before any diff is run. Columns 1 and 3 agree on four of five targets --
same OS, same graph state, different machines. Columns 2 and 4 agree on three of five -- a WARM
Windows workstation and a COLD Linux runner, which is the masquerade the roadmap named, reproduced
at this commit to the digit. `typecheck` carries FOUR distinct values, which is D-11's question.

**PARITY-05, the same-OS `integration` pair, is satisfied.** Point 1 and point 3 are both
`3844377013355031551`; point 4 is `23244131947937181`. `integration` diverges cross-OS and agrees
same-OS, which is exactly the behaviour CORR-04's declared discriminator exists to produce.

---

## The local staleness diff (point 1 versus point 2)

The question this section answers: both, jointly. It is what pins the staleness axis so that the
cross-OS reading further down is admissible under the D-09 rule.

`node capture-hashes.mjs --diff point1-cold.json point2-warm-preexisting.json`, A = cold,
B = warm-preexisting:

```
=== build : 4770979534943963808 (A) vs 4824412313941236224 (B) ===
  command: same
  nodes: 428 / 428
    only-in-A (0): -
    only-in-B (0): -
    value-changed (1):
        @op-nx/github-cache:ProjectConfiguration
          A=3473609128188475433
          B=17377863611053487263
    same: 427

=== typecheck : 8784332057851660202 (A) vs 4268438596418767705 (B) ===
  command: same
  nodes: 429 / 429
    only-in-A (0): -
    only-in-B (0): -
    value-changed (1):
        @op-nx/github-cache:ProjectConfiguration
          A=3473609128188475433
          B=17377863611053487263
    same: 428

=== test : 1238755096132544780 (A) vs 3399438549782114146 (B) ===
  command: same
  nodes: 444 / 444
    only-in-A (0): -
    only-in-B (0): -
    value-changed (1):
        @op-nx/github-cache:ProjectConfiguration
          A=3473609128188475433
          B=17377863611053487263
    same: 443

=== integration : 3844377013355031551 (A) vs 11646873861621802337 (B) ===
  command: same
  nodes: 430 / 430
    only-in-A (0): -
    only-in-B (0): -
    value-changed (1):
        @op-nx/github-cache:ProjectConfiguration
          A=3473609128188475433
          B=17377863611053487263
    same: 429

=== lint : 17022226934688547307 (A) vs 14919174368951396261 (B) ===
  command: same
  nodes: 443 / 443
    only-in-A (0): -
    only-in-B (0): -
    value-changed (1):
        @op-nx/github-cache:ProjectConfiguration
          A=3473609128188475433
          B=17377863611053487263
    same: 442

=== projectConfiguration (field level) ===
  fields
    only-in-A (0): -
    only-in-B (6): targets.typecheck.outputs.1, targets.typecheck.outputs.2, targets.typecheck.outputs.3, targets.typecheck.outputs.4, targets.typecheck.outputs.5, targets.typecheck.outputs.6
    value-changed (0):
        -
    same: 158
```

**Reading the `only-in` buckets first, per the prescribed order, even though they are empty.** Zero
nodes are present on one side and absent on the other, on any of the five targets. That bucket
cannot arise from staleness within a single machine, so an empty reading here is the expected
result -- and recording it as empty is what makes a NON-empty reading meaningful when the cross-OS
diff is read. It also means the external-dependency SET did not move, which is the confound
Pitfall 6 warns about; the `npm ci` step did its job.

`value-changed` is exactly ONE node, identically on all five targets:
`@op-nx/github-cache:ProjectConfiguration`, cold `3473609128188475433` versus warm-preexisting
`17377863611053487263`. `same` runs 427-443 depending on the target.

The `projectConfiguration` field diff localises it to a single field. The warm-preexisting graph
carries a SEVEN-entry `targets.typecheck.outputs`; the cold graph carries a ONE-entry one. 158
fields are identical and nothing else in the merged node moves.

```jsonc
// cold (point 1)
["{projectRoot}/tsconfig.tsbuildinfo"]

// warm-preexisting (point 2)
[
  "{projectRoot}/tsconfig.tsbuildinfo",
  "{projectRoot}/dist/**/*.{d.ts,d.cts,d.mts}",
  "{projectRoot}/dist/**/*.{d.ts,d.cts,d.mts}.map",
  "{projectRoot}/dist/tsconfig.lib.tsbuildinfo",
  "{projectRoot}/out-tsc/vitest/**/*.{d.ts,d.cts,d.mts}",
  "{projectRoot}/out-tsc/vitest/**/*.{d.ts,d.cts,d.mts}.map",
  "{projectRoot}/out-tsc/vitest/tsconfig.spec.tsbuildinfo"
]
```

`metadata` inside the merged node is NOT hashed, so any difference there would have been
informational. There is none: the diff reports zero `value-changed` fields anywhere.

> **Research prediction, quoted alongside -- NOT this record's numbers.** `08-RESEARCH.md`'s
> Finding 1, measured at `c61ef40`, predicted exactly this shape: one differing node,
> `@op-nx/github-cache:ProjectConfiguration`, identical across all five targets, with zero
> `only-in-*` entries. Its Finding 2 predicted the differing field is `targets.typecheck.outputs`
> and that the two forms are a seven-entry list and a one-entry list. Both predictions hold at the
> anchor. What RESEARCH did NOT establish is WHICH state carries WHICH form; measured here, the
> STALE long-lived graph carries the SEVEN-entry form and the COLD graph carries the ONE-entry
> form. The research figures themselves (`15091651677672778193` / `16999170787475652362` for
> `build`) are its numbers at its commit, not this record's.

### D-10's search ordering is SUPERSEDED, and this is the correction

D-10 directs the investigation to start at the external-dependency nodes and then the project
fileset, on the reasoning that `hash_project_config` was already ruled out. That ordering was
reasonable when written; it is wrong at this commit, and the measurement rather than an argument is
what supersedes it.

The measurement names ONE node: `@op-nx/github-cache:ProjectConfiguration`. The external-dependency
nodes did not move at all -- zero `only-in-*` entries and zero `value-changed` entries among the
400-plus `npm:` keys on every target. Neither did the project fileset. Starting where D-10 points
would have searched two buckets that are provably identical.

This is recorded as a correction with its evidence, not applied silently. Both of D-10's named
suspects remain reasonable priors for a DIFFERENT workspace; they are simply not what is happening
here.

---

## PARITY-04, answered as its own question

The question this section answers: **Q2, and only Q2.** It is stated in full and answered on its
own terms rather than absorbed into the cross-OS result.

> **Does a warm local box compute the hash cold CI published?**

**Measured answer at the anchor commit: NO, for all five targets.**

Same machine, same operating system (`win32`/`arm64`), same commit
(`a9a3895a15700956f1a98e5532da2c3f5b245efe`), same Nx (`23.1.0`), same Node (`v24.13.0`), same
install mode (`ci`), clean working tree on both sides. The only variable is the graph state.

| Target | Warm-preexisting (point 2) | Cold (point 1) | Agree? |
|--------|----------------------------|----------------|--------|
| `build` | `4824412313941236224` | `4770979534943963808` | NO |
| `typecheck` | `4268438596418767705` | `8784332057851660202` | NO |
| `test` | `3399438549782114146` | `1238755096132544780` | NO |
| `integration` | `11646873861621802337` | `3844377013355031551` | NO |
| `lint` | `14919174368951396261` | `17022226934688547307` | NO |

A fresh CI checkout is always cold, so the cold column is the shape of what CI computes; observation
points 3 and 4 below confirm the actual published values rather than leaving that inferred.

**This is a FINDING, not a bug this phase fixes.** PARITY-04's own text permits the answer to be
no, and the roadmap's success criterion 4 says so explicitly. The consequence is stated rather than
left implicit: **if a warm local box does not compute the hash cold CI published, the O1 outcome is
unreachable regardless of how perfectly the OS axis is closed.** A developer whose
`.nx/workspace-data` carries a stale inference result misses every remote entry CI produced, and
nothing about cross-OS parity changes that.

The developer-facing mitigation is `nx reset`, and it belongs to DOCS-07 in Phase 12, not here.

**This record deliberately does NOT put a `nx reset` in the proof recipe**, and the mechanism
matters. `nx reset` clears `.nx/workspace-data`, which forces the local box COLD. A cold local box
compared against cold CI is a clean answer to Q1 -- and it LOOKS like an answer to Q2 while having
replaced Q2's subject. The developer whose experience Q2 is about did not run `nx reset`; that is
the entire premise. TEST-10 mandates a reset in its recipe, which is exactly why PARITY-04 names
that move as disqualifying and why the cold recipe here is the environment-variable one.

---

## What the `typecheck` command actually writes (Research A6, open question 2)

The question this section answers: neither of D-08's two. It is the input plan 08-05's fix needs,
and it had to be settled BEFORE anything is pinned.

`08-RESEARCH.md` observed two forms of `targets.typecheck.outputs` in the persisted plugin cache --
a seven-entry list and a one-entry list -- and its assumption A6 took the seven-entry one to be
correct WITHOUT checking. If that assumption were inverted, pinning would make `typecheck` stop
caching its declaration output: a silent correctness regression in the very cache this project
exists to make trustworthy. So it is measured here rather than reasoned.

### Method

On a clean tree, `packages/github-cache/dist/`, `packages/github-cache/out-tsc/` and
`packages/github-cache/tsconfig.tsbuildinfo` were removed, the file set under
`packages/github-cache/` (excluding `node_modules`) was snapshotted, the target's ACTUAL command
was run, and the file set was snapshotted again. The command is the one recorded in the merged
project configuration, matching `nx-target-inputs.spec.ts:10-18`:

```
cwd:     packages/github-cache
command: tsc --build tsconfig.json --emitDeclarationOnly
exit:    0     stdout: ""     stderr: ""
```

`tsconfig.tsbuildinfo` did not exist beforehand and so was not removed -- the removal step reported
only `dist` and `out-tsc`. 78 files were present before; 136 were written.

### What it wrote, mapped onto the candidate patterns

| Pattern | Files it covers |
|---------|-----------------|
| `{projectRoot}/tsconfig.tsbuildinfo` | **0** |
| `{projectRoot}/dist/**/*.{d.ts,d.cts,d.mts}` | 31 |
| `{projectRoot}/dist/**/*.{d.ts,d.cts,d.mts}.map` | 31 |
| `{projectRoot}/dist/tsconfig.lib.tsbuildinfo` | 1 |
| `{projectRoot}/out-tsc/vitest/**/*.{d.ts,d.cts,d.mts}` | 36 |
| `{projectRoot}/out-tsc/vitest/**/*.{d.ts,d.cts,d.mts}.map` | 36 |
| `{projectRoot}/out-tsc/vitest/tsconfig.spec.tsbuildinfo` | 1 |
| **covered by the SEVEN-entry list** | **136 of 136** |
| **covered by the ONE-entry list** | **0 of 136** |
| uncovered by the seven-entry list | none |

A representative slice of the 136, showing every distinct shape:

```
dist/index.d.ts                                        (212 bytes)
dist/index.d.ts.map                                    (241 bytes)
dist/hash-parity/compare.d.ts                          (5675 bytes)
dist/tsconfig.lib.tsbuildinfo                          (50662 bytes)
out-tsc/vitest/src/lib/sync-gate.spec.d.ts             (55 bytes)
out-tsc/vitest/src/lib/sync-gate.spec.d.ts.map         (135 bytes)
out-tsc/vitest/vitest.config.d.mts                     (141 bytes)
out-tsc/vitest/vitest.config.d.mts.map                 (133 bytes)
out-tsc/vitest/tsconfig.spec.tsbuildinfo               (89201 bytes)
```

Note `vitest.config.d.mts` and its map: the `.mts` alternative in the brace expansion is not
decorative, it matches a real emitted file.

### Conclusion

**The SEVEN-entry list is the correct one. Assumption A6 is CONFIRMED, and the inversion it warned
about would have been a real regression.** The seven-entry list covers 136 of 136 emitted files.
The one-entry list covers ZERO of them: pinning it would make `typecheck` cache none of its output
and restore nothing on a hit, while still reporting a cache hit.

One honest qualification, because the goal is the correct list and not a vote between two
candidates. Entry 1, `{projectRoot}/tsconfig.tsbuildinfo`, matches NOTHING at this configuration --
`packages/github-cache/tsconfig.json` is a solution file with `"files": []` and `"include": []`, so
`tsc --build` compiles only its two references and writes no buildinfo for the solution itself. The
strictly minimal correct list is therefore the six entries that do match. The seven-entry list is
kept whole anyway, and 08-05 should keep it whole, for two reasons: it is what `@nx/js/typescript`
itself emits when the references are classified internal, so pinning it verbatim keeps the override
aligned with the plugin instead of quietly diverging from it; and an output pattern matching nothing
is inert for caching, whereas dropping an entry that a future tsconfig change WOULD populate is not.
Recorded here so that the inert entry is a known, deliberate choice rather than something a later
reader mistakes for an oversight.

---

## The cross-OS diff: PARITY-01, answered node by node

The question this section answers: **Q1, cross-OS parity.** It is admissible under the D-09 rule
because the staleness axis is pinned on both sides -- points 3 and 4 both record `graphState: cold`
with `workspaceDataEntries: 0`, the same `installMode`, and the same Nx version.

`node capture-hashes.mjs --diff <ubuntu record> <windows record>`, A = `ubuntu-24.04-arm`,
B = `windows-11-arm`, both cold, both at the anchor:

```
=== build : 4824412313941236224 (A) vs 4770979534943963808 (B) ===
  command: same
  nodes: 428 / 428
    only-in-A (0): -
    only-in-B (0): -
    value-changed (1):
        @op-nx/github-cache:ProjectConfiguration
          A=17377863611053487263
          B=3473609128188475433
    same: 427

=== typecheck : 12632208324451201361 (A) vs 14440024841214492138 (B) ===
  command: same
  nodes: 429 / 429
    only-in-A (0): -
    only-in-B (0): -
    value-changed (1):
        @op-nx/github-cache:ProjectConfiguration
          A=17377863611053487263
          B=3473609128188475433
    same: 428

=== test : 3399438549782114146 (A) vs 1238755096132544780 (B) ===
  command: same
  nodes: 444 / 444
    only-in-A (0): -
    only-in-B (0): -
    value-changed (1):
        @op-nx/github-cache:ProjectConfiguration
          A=17377863611053487263
          B=3473609128188475433
    same: 443

=== integration : 23244131947937181 (A) vs 3844377013355031551 (B) ===
  command: same
  nodes: 430 / 430
    only-in-A (0): -
    only-in-B (0): -
    value-changed (2):
        runtime:node -p process.platform
          A=11970638123438591088
          B=6694901896827773122
        @op-nx/github-cache:ProjectConfiguration
          A=17377863611053487263
          B=3473609128188475433
    same: 428

=== lint : 14919174368951396261 (A) vs 17022226934688547307 (B) ===
  command: same
  nodes: 443 / 443
    only-in-A (0): -
    only-in-B (0): -
    value-changed (1):
        @op-nx/github-cache:ProjectConfiguration
          A=17377863611053487263
          B=3473609128188475433
    same: 442

=== projectConfiguration (field level) ===
  fields
    only-in-A (6): targets.typecheck.outputs.1, targets.typecheck.outputs.2, targets.typecheck.outputs.3, targets.typecheck.outputs.4, targets.typecheck.outputs.5, targets.typecheck.outputs.6
    value-changed (0):
        -
    same: 158
```

### Reading it in the prescribed order

**`only-in-A` / `only-in-B` FIRST: ZERO entries, on every one of the five targets.** This is the
bucket that cannot arise from staleness within a single machine, so it is the cleanest OS signal
available -- and it is empty. Recording it as empty is the point of the exercise.

That is a **measured refutation of a research prediction**, and it is worth naming as one.
`08-RESEARCH.md`'s `### How to diff two maps usefully` states that a differing external-dependency
SET is "the likeliest shape of a genuine cross-OS difference, since optional platform-specific
packages such as `@nx/nx-linux-arm64-gnu`, `lightningcss-win32-arm64-msvc` and `fsevents` all
appear as nodes". They do appear as nodes -- and they appear IDENTICALLY on both legs. The external
node set is derived from `package-lock.json`, which both legs parse identically, not from what
`npm ci` chose to materialise on disk. So the platform-conditional optional dependencies that the
prediction (and Pitfall 6) both flag as the likeliest confound are not a cross-OS variable here at
all. Two independent 400-plus-entry node sets agreeing exactly is a strong non-vacuity signal for
the diff itself.

**`value-changed` second: exactly ONE node on `build`, `typecheck`, `test` and `lint`**, and it is
the same node with the same two values on every one of them:

```
@op-nx/github-cache:ProjectConfiguration
  linux   = 17377863611053487263
  win32   = 3473609128188475433
```

`integration` carries TWO, and the second is `runtime:node -p process.platform` -- the declared
CORR-04 discriminator, doing precisely the job D-14 keeps it for. That is the only target where a
second node moves, and it is the only target that is SUPPOSED to diverge.

**`same` last, as scale:** 427-443 identical nodes per target. One node out of 428 to 444 is what
the entire cross-OS divergence amounts to.

**The merged project configuration field diff localises that node to ONE field.** `targets.typecheck.outputs` has SEVEN entries on Linux and ONE on Windows; 158 other fields are
byte-identical, with zero `value-changed` entries anywhere in the merged node. `metadata` is not
hashed, and it did not differ either.

### PARITY-01's answer, in prose

**At commit `a9a3895a15700956f1a98e5532da2c3f5b245efe`, exactly one hash input differs between
`ubuntu-24.04-arm` and `windows-11-arm`: the `@op-nx/github-cache:ProjectConfiguration` node. The
differing field inside it is `targets.typecheck.outputs`, which `@nx/js/typescript` infers as a
SEVEN-entry list on Linux and a ONE-entry list on Windows. Because that single node covers all five
targets, that one field is what makes `build`, `typecheck`, `test` and `lint` diverge cross-OS.
`integration` diverges for that reason AND for its declared `runtime:node -p process.platform`
discriminator, which is the intended one. No external dependency, no fileset, no tsconfig node, and
no environment node differs.**

> **Research prediction, quoted beside the measurement.** `08-RESEARCH.md`'s Finding 3 names a
> Windows separator sensitivity in `@nx/js/typescript`'s project-reference classification as the
> strongest available lead: `isExternalProjectReference` terminates on a literal string comparison
> of two absolute paths, TypeScript hands back forward-slash absolute paths on Windows while Nx
> works in backslashes, so the two internal references are misclassified as EXTERNAL and
> `getOutputs()` yields ONE output instead of SEVEN. RESEARCH states plainly that this is "**not
> yet proven to be the cross-OS cause** -- the Linux leg was not measured", and offers it as a lead
> only.
>
> **The measurement above is that missing leg, and the prediction HOLDS.** Cold Linux yields the
> SEVEN-entry list (references classified internal); cold Windows yields the ONE-entry list
> (references classified external), reproduced independently on two different Windows machines --
> this workstation and a GitHub-hosted `windows-11-arm` runner. The predicted mechanism, the
> predicted direction and the predicted node are all confirmed. What is NOT re-derived here is
> RESEARCH's plugin-source reading itself; this record measures the OUTCOME, and the mechanism
> remains RESEARCH's citation rather than this record's.
>
> One caveat that keeps the claim honest: the stale Windows graph in point 2 carries the
> SEVEN-entry (Linux-shaped) form, so Windows is evidently capable of producing it -- RESEARCH
> records the plugin's persisted targets cache holding BOTH forms. What is reproducible at this
> commit is that a COLD Windows graph yields ONE and a COLD Linux graph yields SEVEN. The stale
> entry is a historical artifact of some earlier inference on this box, not a counter-example to
> the cold behaviour.

### The two axes have the SAME root cause, and that is why one masquerades as the other

This is the sharpest statement the four points support, and it was not predictable before both
legs existed. Compare the two `ProjectConfiguration` node values:

| Comparison | Value A | Value B |
|------------|---------|---------|
| Windows cold vs Windows warm-preexisting (the staleness axis) | `3473609128188475433` | `17377863611053487263` |
| Windows cold vs Linux cold (the OS axis) | `3473609128188475433` | `17377863611053487263` |

**The same pair of values, on both axes.** The roadmap calls the second axis one "that perfectly
masquerades as" the first; the reason it masquerades so perfectly is that it is not an imitation at
all -- a stale Windows graph is emitting literally the value a cold Linux graph emits, because both
carry the SEVEN-entry form of the same field. One field, two ways to arrive at it.

The direct consequence, measured rather than argued -- a WARM Windows workstation versus a COLD
`ubuntu-24.04-arm` runner (point 2 versus point 4):

```
=== build : 4824412313941236224 (A) vs 4824412313941236224 (B) ===   IDENTICAL, 428 same, 0 changed
=== test  : 3399438549782114146 (A) vs 3399438549782114146 (B) ===   IDENTICAL, 444 same, 0 changed
=== lint  : 14919174368951396261 (A) vs 14919174368951396261 (B) === IDENTICAL, 443 same, 0 changed
=== typecheck : 4268438596418767705 (A) vs 12632208324451201361 (B) ===
    value-changed (1):
        **/*.{d.ts,d.cts,d.mts}:packages/github-cache/dist/**/*.{js,cjs,mjs,jsx,d.ts,d.cts,d.mts}{,.map},packages/github-cache/dist/tsconfig.lib.tsbuildinfo
          A=17231791043533793938   B=3244421341483603138
=== integration : 11646873861621802337 (A) vs 23244131947937181 (B) ===
    value-changed (1):
        runtime:node -p process.platform
          A=6694901896827773122    B=11970638123438591088
=== projectConfiguration (field level) === only-in (0/0), value-changed (0), same: 164
```

A warm Windows workstation and a cold Linux runner are INDISTINGUISHABLE for `build`, `test` and
`lint` -- byte-identical hashes, zero differing nodes, 164 of 164 merged-configuration fields
identical. The only two surviving differences are both named non-OS mechanisms: the build-output
node on `typecheck` and the declared discriminator on `integration`. This reproduces at the anchor
what the 2026-07-26 pre-flight probe reported, and it is exactly why D-09's rule exists.

**Roadmap success criterion 1, checked against the measurement.** Its first clause -- "cold-ubuntu
differs from cold-windows for every target" -- holds: all five targets differ. Its second clause --
"warm local Windows `build`/`test` equal cold ubuntu CI to the digit" -- holds, and `lint` joins
them as a third. Its third clause -- "cold local Windows equals cold windows CI to the digit" --
holds for `build`, `test`, `integration` and `lint`, and NOT for `typecheck`, for the reason the
D-11 section below root-causes. *(That reading of the anchor records is unchanged. Plan 08-05
corrected what it MEANS: the `typecheck` gap is the instrument hashing outside the dependency chain,
not a divergence between the two machines -- see `## CORRECTION: D-11's consequence is FALSIFIED`.)*

---

## `lint` cross-OS: the D-21 verdict, and Phase 7's UNVERIFIED-BY-DESIGN question settled

The question this section answers: **Q1, cross-OS parity**, for the target Phase 7 handed over.

**Verdict: `lint`'s HASH diverges cross-OS -- and nothing `lint`-specific diverges.**

| | `lint` hash |
|---|---|
| point 4, `ubuntu-24.04-arm` cold | `14919174368951396261` |
| point 3, `windows-11-arm` cold | `17022226934688547307` |

The divergence is real, and it is entirely the shared `@op-nx/github-cache:ProjectConfiguration`
node: `lint`'s cross-OS diff shows ONE changed node, that one, with the same two values every other
target reports, and 442 of 443 nodes identical.

### D-35's Windows-side baseline, quoted beside the Linux measurement

`07-EVIDENCE.md:505-513` recorded the inferred `lint` target's hashed node values on Windows,
flagged `options.cwd` as "the row most likely to diverge", and confirmed it IS hashed. Every row is
now measured on BOTH legs:

| Hashed field | D-35 baseline (Windows) | Point 4 (`linux`) | Point 3 (`win32`) | Agree? |
|---|---|---|---|---|
| `executor` | `nx:run-commands` | `nx:run-commands` | `nx:run-commands` | YES |
| `outputs` | `[]` | `[]` | `[]` | YES |
| `options.cwd` | `packages/github-cache` | `packages/github-cache` | `packages/github-cache` | **YES** |
| `options.command` | `eslint .` | `eslint .` | `eslint .` | YES |
| `configurations` | `{}` | `{}` | `{}` | YES |
| `cache` (inferred) | `true` | `true` | `true` | YES |

`options.cwd` -- the row D-35 singled out -- is byte-identical on both runners, forward-slashed and
project-relative on Windows as well as Linux. The merged-node field diff independently confirms it:
zero `value-changed` fields anywhere in the merged configuration, so no `lint` field moved at all.

**Phase 7's question is therefore settled, and the answer is YES.** `STACK.md` section 7 and D-35
left "does `@nx/eslint` infer `lint` identically on both OSes?" UNVERIFIED BY DESIGN. Measured at
the anchor: it does. `@nx/eslint` produces an identical `lint` target node on `ubuntu-24.04-arm`
and `windows-11-arm`.

### Which branch of D-21 plan 08-06 must wire

**The PRIMARY branch: `lint` is asserted as a FOURTH IDENTICAL target, alongside
`build`/`typecheck`/`test`. The named fallback does NOT apply.**

D-21's fallback is conditioned on `lint` diverging AND its fix proving out of Phase 8's scope.
Neither half survives contact with the measurement. `lint` diverges only through the shared
`ProjectConfiguration` node; the field responsible is `targets.typecheck.outputs`; and D-12's fix
location -- `nx.json` `targetDefaults` -- reaches that field directly, as `targetDefaults.typecheck.inputs` already demonstrates in-repo (its merged value is identical
in every state precisely because it is declared). So `lint`'s divergence is expected to close as a
SIDE EFFECT of 08-05's fix, with no `lint`-specific work at all.

That is a prediction this record is making, not a measurement, and it is labelled as one. If
08-05's fix lands and `lint` still diverges, D-21's fallback becomes live again and the clause is
DOWNGRADED to a recorded-with-a-named-finding test -- never deleted, because a deleted clause is
indistinguishable from a clause that never existed. `compare.spec.ts`'s `INVARIANT_TARGETS` block
already carries that instruction.

### A note on U-01

`08-CONTEXT.md`'s U-01 asks whether PARITY-03's goal is reachable through `nx.json` alone, and
withholds D-12 from being treated as settled until the root cause is known. The root cause is now
known: a single `targetDefaults`-addressable field on the merged project configuration node. That
is inside D-12's reach on the evidence available. U-01 is not CLOSED here -- closing it requires
08-05 to land the fix and the two legs to actually agree -- but the specific risk it named, "the
divergence lives inside plugin inference that `targetDefaults` cannot override", is now the less
likely branch rather than an open coin-flip.

---

## D-11: `typecheck`'s third variance source, ROOT-CAUSED

The question this section answers: neither of D-08's two directly. It is the confound that has to
be named before either question's `typecheck` row can be read.

`typecheck` carries FOUR distinct values across the four observation points, which is exactly the
condition D-11 was opened for. D-11 permits recording it as OPEN with its evidence and forbids it
becoming a phase blocker. It does not need either concession: it is root-caused.

**The isolating comparison is point 1 versus point 3 -- same OS, same graph state, same commit,
same install mode, different machine:**

```
=== build       : 4770979534943963808 (A) vs 4770979534943963808 (B) ===  0 changed, 428 same
=== test        : 1238755096132544780 (A) vs 1238755096132544780 (B) ===  0 changed, 444 same
=== integration : 3844377013355031551 (A) vs 3844377013355031551 (B) ===  0 changed, 430 same
=== lint        : 17022226934688547307 (A) vs 17022226934688547307 (B) === 0 changed, 443 same

=== typecheck : 8784332057851660202 (A) vs 14440024841214492138 (B) ===
  nodes: 429 / 429
    only-in-A (0): -   only-in-B (0): -
    value-changed (1):
        **/*.{d.ts,d.cts,d.mts}:packages/github-cache/dist/**/*.{js,cjs,mjs,jsx,d.ts,d.cts,d.mts}{,.map},packages/github-cache/dist/tsconfig.lib.tsbuildinfo
          A=17231791043533793938
          B=3244421341483603138
    same: 428

=== projectConfiguration (field level) === only-in (0/0), value-changed (0), same: 158
```

Four of five targets are byte-identical across two different Windows arm64 machines, and the merged
project configuration is identical field for field. `typecheck` differs by exactly ONE node, and
that node is the `dependentTasksOutputFiles` entry declared at `nx.json:137`, which hashes the
CONTENT of `packages/github-cache/dist/`.

**The third source is the build-output state, exactly as `08-RESEARCH.md` predicted.** This
workstation captured both local points with `dist/` POPULATED by a full `npm run build`; both CI
legs deliberately skip the build step, so their `dist/` is absent and the node hashes an empty set.
RESEARCH's `### The dependentTasksOutputFiles node is a real hazard` named this as "a live
candidate for D-11's third variance source ... more concrete than `npm ci` vs `npm install`", and
added that "the instrument's own reading of `typecheck` depends on whether `build` ran first in
that job -- so the capture step's position relative to any build step must be identical on both
legs, and the record should state it." Both statements are confirmed, and the second is why the
`hash-parity` job has no build step on either leg.

**So `typecheck`'s four values decompose cleanly into three independent variables, with no residue:**

| Point | OS classification of `typecheck.outputs` | `dist/` state | Hash |
|-------|------------------------------------------|---------------|------|
| 1 workstation cold | one-entry (Windows) | populated | `8784332057851660202` |
| 3 `windows-11-arm` cold | one-entry (Windows) | empty | `14440024841214492138` |
| 2 workstation warm-preexisting | seven-entry (stale) | populated | `4268438596418767705` |
| 4 `ubuntu-24.04-arm` cold | seven-entry (Linux) | empty | `12632208324451201361` |

Two binary variables, four combinations, four values. Nothing is left unexplained.

**Consequence for the gate.** CORRECTED by plan 08-05 -- see
`## CORRECTION: D-11's consequence is FALSIFIED, and the instrument was measuring outside the
dependency chain` below. **The decomposition table above stands**; it is mechanically correct about
why the INSTRUMENT saw four values. The consequence originally drawn from it did not, and the
original wording is quoted in that section rather than deleted.

What is true, measured at the fix commit: `typecheck` carries an INFERRED
`dependsOn: ["build", "^typecheck"]` -- produced by `@nx/js/typescript`, absent from `nx.json` --
so Nx defers its hash until `build` has produced `dist/`. Two real `--skip-nx-cache` runs, one from
a populated `dist/` and one from a deleted one, both compute `8949082127832201885`. **A developer
who has built and one who has not compute the SAME `typecheck` hash.** The four values are an
artefact of the instrument calling `hashTask` outside the dependency chain, not a divergence any
machine experiences.

The live consequence is therefore for the GATE, not for developers: a job that hashes `typecheck`
without building first records a number nothing computes. Both `hash-parity` legs originally skipped
the build so the two legs would be identical in that respect -- correct instinct, wrong resolution,
since "both build" is equally identical AND measures the real value. The job is fixed in
`## The hash-parity job now builds before capturing` below.

---

## Root cause

The question this section answers: **both of D-08's two, separately.** It is the synthesis of every
measurement above, and it is derived from what plan 08-03 measured at the anchor commit
`a9a3895a15700956f1a98e5532da2c3f5b245efe` -- never from what `08-RESEARCH.md` predicted at `c61ef40`.

### Axis 1 -- STALENESS (observation point 1 versus observation point 2)

**The node:** exactly ONE moves, and it is the same one on all five targets --
`@op-nx/github-cache:ProjectConfiguration`, cold `3473609128188475433` versus warm-preexisting
`17377863611053487263`. `only-in-A` and `only-in-B` are EMPTY on every target; `same` runs 427-443.

**The field inside it:** `targets.typecheck.outputs`. The merged-node field diff reports six
`only-in-B` entries -- `targets.typecheck.outputs.1` through `.6` -- and 158 identical fields with
ZERO `value-changed` entries anywhere else. The warm-preexisting graph carries the SEVEN-entry list;
the cold graph carries the ONE-entry list. `metadata` is not hashed and did not differ either.

**This axis is staleness-of-persisted-inference, not freshness-of-computation.** That is a
CORRECTION to the wording `.planning/ROADMAP.md` SC1 and `REQUIREMENTS.md` PARITY-01 both use, and
plan 08-01 already recorded it with the original quoted -- see `## The second axis is STALENESS, not
freshness` above. `cold != warm` is false as a general statement: cold and warm agree when
`.nx/workspace-data` is FRESH. What differs is a long-lived directory holding an inference result
that no longer matches the tree.

**The persisted plugin cache does not self-heal.** The stale entry is not corrected by the next run
that reads it -- the file hash still validates, so nothing re-derives what that hash implies. This
is why point 2 had to be captured before anything else in the session, why the cold recipe redirects
`NX_WORKSPACE_DATA_DIRECTORY` instead of deleting anything, and why the fix landing in 08-05 will
NOT retroactively repair a developer's box. That last consequence is Phase 12's, and it is written
down in the hand-off section below rather than left to be rediscovered.

### Axis 2 -- OPERATING SYSTEM (observation point 4 versus observation point 3, both cold)

**Read the buckets in the prescribed order, because the two imply DIFFERENT fix routes:**

- **`only-in-A` / `only-in-B`: ZERO entries, on every one of the five targets.** Entries here would
  mean the two legs saw a different SET of external-dependency nodes -- the shape a
  platform-conditional optional package set takes -- and the route would then be to NARROW the
  affected target's declared `externalDependencies`. That bucket is empty, so that route is NOT the
  one. The external node set is derived from `package-lock.json`, which both legs parse identically,
  rather than from what `npm ci` materialised on disk. Two independent 400-plus-entry node sets
  agreeing exactly is also the strongest available non-vacuity signal for the diff itself.

- **`value-changed`: exactly ONE node on `build`, `typecheck`, `test` and `lint`**, and it is the
  same node with the same two values on every one of them:
  `@op-nx/github-cache:ProjectConfiguration`, `linux = 17377863611053487263` versus
  `win32 = 3473609128188475433`. A `value-changed` entry on the merged project configuration means
  inference produced a different merged node on the two operating systems, and the route is a
  `targetDefaults` entry that normalises the differing field regardless of what inference produced.
  **That is the only route the measurement supports, and it is the one the next section proposes.**

- **`integration` carries a SECOND `value-changed` node**, `runtime:node -p process.platform`. That
  is the declared CORR-04 discriminator doing exactly the job D-14 keeps it for. It is the only
  target with a second changed node and the only target that is SUPPOSED to diverge.

**The field inside the node, again:** `targets.typecheck.outputs` -- SEVEN entries on Linux, ONE on
Windows, with 158 other fields byte-identical and zero `value-changed` fields anywhere in the merged
node. The same field as the staleness axis.

> **Research prediction, quoted beside the measurement -- NOT this record's numbers.**
> `08-RESEARCH.md`'s Finding 3 named a Windows separator sensitivity in `@nx/js/typescript`'s
> project-reference classification as "the strongest available lead": `isExternalProjectReference`
> terminates on a literal string comparison of two absolute paths, TypeScript hands back
> forward-slash absolute paths on Windows while Nx works in backslashes, the two internal references
> are therefore misclassified as EXTERNAL, and `getOutputs()` yields ONE output instead of SEVEN.
> RESEARCH stated plainly that this was "**not yet proven to be the cross-OS cause** -- the Linux leg
> was not measured", and its assumption A1 priced the cost of the lead being wrong as "one wrong
> first hypothesis, not a wrong design".
>
> **The Linux leg now exists, and the prediction HOLDS.** Cold Linux yields SEVEN, cold Windows
> yields ONE, reproduced on two independent Windows arm64 machines. Predicted node, predicted field,
> predicted direction, all confirmed. Two qualifications keep the claim honest: this record measures
> the OUTCOME, so the plugin-source mechanism remains RESEARCH's citation rather than this record's;
> and RESEARCH's own `### How to diff two maps usefully` predicted the likeliest cross-OS shape to be
> a differing external-dependency SET, which the empty `only-in-*` buckets REFUTE. A research map
> that was right about the node and wrong about the bucket is worth more in this record than one
> quietly reported as uniformly correct.

### What the two axes have in common, and what they do not

**In common: the same node, the same field, and literally the same pair of values.**

| Comparison | Value A | Value B |
|------------|---------|---------|
| Windows cold vs Windows warm-preexisting (staleness) | `3473609128188475433` | `17377863611053487263` |
| Windows cold vs Linux cold (OS) | `3473609128188475433` | `17377863611053487263` |

A stale Windows graph does not imitate a cold Linux graph -- it emits literally the value a cold
Linux graph emits, because both carry the SEVEN-entry form of the same field. One field, two ways to
arrive at it. That is the mechanical reason the roadmap could describe the second axis as one "that
perfectly masquerades as" the first, and it is measured rather than argued: a WARM Windows
workstation and a COLD `ubuntu-24.04-arm` runner are byte-identical on `build`, `test` AND `lint`,
with 164 of 164 merged-configuration fields the same.

**Not in common: the direction, the cure, and the reachability.** The OS axis is a property of the
CONFIGURATION and is addressable by `nx.json`. The staleness axis is a property of a MACHINE's
persisted state and is not -- `nx reset` is its only known cure, and a cure is not a control. The
two coincide here only because the field they both move is the same one; closing the OS axis is
predicted to close the staleness axis as a side effect, and that prediction is labelled as one in
`## Pre-recorded: this phase's fix commits are a LEGITIMATE all-MISS rotation window` below.

**A third variance source exists and is NEITHER axis.** `typecheck` carries FOUR distinct values
across the four observation points, and the residue after both axes is the
`dependentTasksOutputFiles` node hashing the CONTENT of `packages/github-cache/dist/`. It is
root-caused in `## D-11: typecheck's third variance source, ROOT-CAUSED` above: two binary variables
(outputs classification, `dist/` populated), four combinations, four values, no residue. It is a
property of what has run in a workspace rather than of the config, so `nx.json` does not close it.

### The D-09 gate, stated explicitly

**No difference in this section is attributed to the operating system without the staleness axis
having been pinned first.** The two readings that pinned it are observation point 1 (workstation,
`graphState: cold`, `workspaceDataEntries: 0`) and observation point 2 (same workstation,
`graphState: warm`, `workspaceDataEntries: 16`) -- same machine, same OS, same commit, same Nx, same
Node, same install mode, clean tree on both sides, graph state the only variable. Having measured
what staleness alone does, the cross-OS reading is then taken between two points that BOTH record
`graphState: cold` with `workspaceDataEntries: 0`, the same `installMode`, and the same
`nxVersion`. The pair in `STATE.md` attributed to "ubuntu CI" versus "windows CI" satisfied none of
that and is disqualified in `## Every prior cross-OS measurement in this repo read a confounded
variable (D-09)` above.

**D-10's search ordering is SUPERSEDED BY MEASUREMENT, not by argument**, and the supersession is
recorded with its evidence in `### D-10's search ordering is SUPERSEDED, and this is the correction`
above: D-10 directs the investigation to start at `External` and then `ProjectFileSet`, and both
buckets are provably identical at the anchor -- zero `only-in-*` and zero `value-changed` among the
400-plus `npm:` keys on every target, and no fileset node moved either. Both remain reasonable
priors for a different workspace; they are simply not what is happening here.

---

## Proposed fix

**Written BEFORE the fix exists.** Plan 08-05 applies it; this section names the route so that "we
changed X and the hashes agreed" is evidence rather than a story fitted to a result. The git-history
listings in `## The ordering proof` below are what make that claim checkable.

### The constraints this proposal is bounded by

| Constraint | Source | What it forbids |
|------------|--------|-----------------|
| Fixes land in `nx.json` `targetDefaults` ONLY | D-12 | any other fix location, absent a U-01 escalation |
| No `project.json` | D-12, Phase 7 D-02 | the workspace is deliberately free of them |
| No plugin-option patching as a FIRST resort | D-12 | patching `@nx/js/typescript` internals or its options to route around inference |
| Prefer NARROWING inputs over adding them | D-13 | widening an input list to paper over a divergence |
| `integration`'s discriminator stays BYTE-IDENTICAL | D-14, CORR-04 | re-spelling `{ "runtime": "node -p process.platform" }` in any way |

The last one is worth stating as more than a table row. After VER-03 that runtime input is the SOLE
mechanism separating OS-sensitive targets from OS-invariant ones. Phase 8 does not re-spell it, does
not relocate it and does not "improve" it -- it only asserts that it is the ONLY one. Touching it is
a Core-Value regression, and `nx-target-inputs.spec.ts:241-260` already guards the "only one" half.

### Route for the ONE diverging node the measurement named

The diverging node is `@op-nx/github-cache:ProjectConfiguration` and the diverging field is
`targets.typecheck.outputs`. The route, naming the key:

**Add `targetDefaults.typecheck.outputs` to `nx.json`.**

`nx.json` currently declares `targetDefaults.typecheck.inputs` (`nx.json:133-145`) and no `outputs`
for that target. The shape precedent for adding one is `targetDefaults.lint` (`nx.json:147-148`),
where `outputs` sits first, before `inputs`.

**The evidence that a `targetDefaults` entry reaches this node is already in the record, in-repo and
measured.** The merged node's `targets.typecheck.inputs` field is among the 158 fields that are
byte-identical on BOTH axes -- identical cold versus warm-preexisting, and identical Linux versus
Windows -- while `targets.typecheck.outputs`, the field with no `targetDefaults` entry, is the one
that moves. `targetDefaults` inputs REPLACE rather than merge (recorded in PARITY-08's own text), so
the declared list is what lands in the merged node regardless of what the plugin inferred. That is a
live demonstration that a `targetDefaults` entry normalises ITS field of the merged node.

Corroborating but weaker: `targetDefaults.lint.outputs` is declared as `[]` (`nx.json:148`) and the
merged node's `lint` outputs measure `[]` identically on both legs (the D-35 table above). It is
weaker because `@nx/eslint` may infer `[]` anyway, so it cannot separate "declared" from "inferred"
-- it is consistent with the hypothesis rather than independent proof of it.

**This is a HYPOTHESIS with a named, cheap confirming experiment, not a conclusion.** The experiment
is one `nx.json` line plus one re-measurement, in both local graph states and on both CI legs. Its
pass and fail conditions are pre-committed in the U-01 section immediately below, before it is run.
`08-RESEARCH.md`'s assumption A2 states the same claim and the same escalation path.

### The VALUE that entry must carry

**The SEVEN-entry list, verbatim:**

```jsonc
[
  "{projectRoot}/tsconfig.tsbuildinfo",
  "{projectRoot}/dist/**/*.{d.ts,d.cts,d.mts}",
  "{projectRoot}/dist/**/*.{d.ts,d.cts,d.mts}.map",
  "{projectRoot}/dist/tsconfig.lib.tsbuildinfo",
  "{projectRoot}/out-tsc/vitest/**/*.{d.ts,d.cts,d.mts}",
  "{projectRoot}/out-tsc/vitest/**/*.{d.ts,d.cts,d.mts}.map",
  "{projectRoot}/out-tsc/vitest/tsconfig.spec.tsbuildinfo"
]
```

**The source of that value is the enumeration in `## What the typecheck command actually writes
(Research A6, open question 2)` above, not either candidate list's entry count.** The target's actual
command, `tsc --build tsconfig.json --emitDeclarationOnly` at `cwd packages/github-cache`, was run
on a cleaned tree and wrote 136 files. The seven-entry list covers **136 of 136**. The one-entry list
covers **0 of 136**. Entry 1 covers zero at this configuration and is kept anyway, deliberately, for
the two reasons recorded there -- it is what the plugin itself emits, and an output pattern matching
nothing is inert while a dropped entry that a future tsconfig WOULD populate is not.

**Why choosing by measurement rather than by stability matters here.** `outputs` is load-bearing
beyond the hash: it is what Nx CACHES and RESTORES. Pinning a list that is merely STABLE rather than
CORRECT -- the one-entry list is perfectly stable -- would make `typecheck` cache none of its
declaration output and restore nothing on a hit, while still reporting a cache hit. That is a
correctness regression in the very cache this project exists to make trustworthy, and it is exactly
the inversion `08-RESEARCH.md`'s assumption A6 warned about without checking.

### The external-dependency route: named, and NOT taken

For completeness, because the two buckets imply different routes and a reader must be able to see
which one was ruled out by measurement rather than by preference: had the cross-OS diff produced
`only-in-A` / `only-in-B` entries among the `npm:` nodes, the route would have been to NARROW the
affected target's declared `externalDependencies`, naming the target and the packages. All five
targets already declare an `externalDependencies` entry (`nx.json:77-84`, `:99`, `:130`, `:144`,
`:154-161`), so that route would have been an EDIT rather than an addition. **It is not taken,
because those buckets are empty on all five targets.** The route is recorded so that a future
divergence of that shape has a written starting point.

### Where the rationale lives, since `nx.json` cannot hold it

`nx.json` is strict JSON and carries no comments, so per D-13 each fix's rationale lock lives in the
guard spec that pins it. **That spec is `packages/github-cache/src/nx-target-inputs.spec.ts`, and
the pin must EXTEND that file rather than being re-authored elsewhere** -- re-authoring creates a
second copy to drift, which is the failure mode `CONVENTIONS.md`'s single-source-plus-drift-guard
pattern exists to prevent.

That file already carries this exact pattern, twice over:

- `:229-234` pins `targetDefaults.lint.outputs` to `[]` with the comment above it explaining WHY
  that value -- the value in `nx.json`, the reason in the spec. A `targetDefaults.typecheck.outputs`
  pin is the same shape with a longer list and a longer reason.
- `:269-273` asserts that `{workspaceRoot}/nx.json` is a declared `test` input, which is what stops
  the whole file serving a stale cached PASS after an `nx.json` edit. The new pin inherits that
  protection for free by living in the same file.

The reason text the new pin must carry, so 08-05 does not have to re-derive it: the list is the
plugin's own seven-entry emission; it covers 136 of 136 files the target actually writes; entry 1 is
inert at this configuration and is kept deliberately; and the entry exists to make the merged node's
`typecheck.outputs` field OS-invariant, which is the entire cross-OS divergence.

---

## U-01: the condition that would make it live

**Written BEFORE the experiment is run, so the result cannot be reinterpreted after it is known.**

### U-01, restated in full

> **U-01: Whether PARITY-03's byte-identical goal is reachable through `nx.json` alone.** The root
> cause is unknown by design -- that is what D-06 exists to establish. If the divergence turns out to
> live inside plugin inference that `targetDefaults` cannot override, then D-12's "fixes land in
> `nx.json` only" is not a sufficient fix location, and the options open up to: pinning the inferred
> target explicitly, patching plugin options, or escalating upstream. IMPACT is HIGH -- O1 and O4
> both depend on PARITY-03, and the choice would freeze how this workspace configures targets.
> CONFIDENCE is NOT HIGH -- there is no evidence yet either way. **Do not treat D-12 as settled if
> the root-cause record lands outside its reach.** Re-open this with the maintainer at that point
> rather than auto-selecting a fix location.

The measurement has moved the odds and has NOT closed it. The divergence does live inside plugin
inference -- U-01's literal trigger condition -- but it lands on a field a `targetDefaults` entry
addresses directly, which is why D-12 is still the proposed route. That is a reasoned prior, not a
result. The conditions below are what turn it into one.

### What would CONFIRM the proposal (all four must hold)

Measured after `targetDefaults.typecheck.outputs` lands and with nothing else changed:

- **C1 -- local, both graph states, one commit.** The `@op-nx/github-cache:ProjectConfiguration`
  node hash is IDENTICAL between a cold capture and a warm-preexisting capture on the workstation.
- **C2 -- both CI legs, both cold, one commit.** That same node hash is IDENTICAL between
  `ubuntu-24.04-arm` and `windows-11-arm`.
- **C3 -- the consequence.** The cross-OS diff for `build`, `test` and `lint` shows ZERO
  `value-changed` nodes and ZERO `only-in-*` entries, so those three hashes are byte-identical
  across the legs.
- **C4 -- the control still works.** `integration` still DIVERGES cross-OS, and its diff still shows
  `runtime:node -p process.platform` as a changed node. A fix that accidentally silenced the
  discriminator would satisfy C1-C3 and be a CORR-04 regression.

### What would make U-01 LIVE (any ONE is sufficient)

- **L1.** The `ProjectConfiguration` node still differs between cold and warm-preexisting locally,
  at one commit, after the entry lands.
- **L2.** The node still differs between the two cold CI legs, at one commit, after the entry lands.
- **L3.** The merged node's `targets.typecheck.outputs` does not take the declared value on at least
  one of the two operating systems -- that is `targetDefaults` demonstrably failing to reach the
  field, which is A2 being false.
- **L4.** The node converges, but a DIFFERENT node or field starts diverging cross-OS in something
  `targetDefaults` cannot reach: inference internals, a plugin option, or the plugin's own path
  handling.

### What is explicitly NOT a trigger

Pre-committed here so that a known, already-root-caused difference cannot be re-labelled as U-01
going live, and equally so that U-01 cannot be waved away by pointing at one of these:

- **N1.** `typecheck` differing between a workstation that has BUILT and a runner that has not. That
  is D-11's build-output variable, root-caused above, orthogonal to both axes, and explicitly NOT
  closed by this fix. It is a DOCS-07 item, not a U-01 trigger.
- **N2.** An all-MISS push immediately after the fix commit. That is the pre-recorded legitimate
  rotation window; `{workspaceRoot}/nx.json` is a declared input of every target, so one edit rotates
  all five hashes at once by design.
- **N3.** `integration` diverging cross-OS. That is C4, the intended behaviour.

### The commitment, if U-01 goes live

**Plan 08-05 STOPS.** It does not improvise a second fix location, does not reach for a plugin
option because it is nearby, and does not widen an input list to make the symptom disappear. It
records the failing condition with its measurement and re-opens the fix location with the
maintainer. The options that open up are the ones U-01 itself names: pinning the inferred target
explicitly, patching plugin options, or escalating upstream. Which of those is taken is a
maintainer decision with HIGH impact on how this workspace configures targets, and D-12 is not
settled enough to make it automatically.

**Upstream reporting is a legitimate FOLLOW-UP and does not belong in this phase's diff.** If the
measurement supports a report of the `@nx/js/typescript` path-comparison behaviour -- and Finding 3's
mechanism plus this record's two-leg confirmation is a strong basis for one -- it is filed as its own
piece of work, because a phase whose entire premise is a clean measure-then-fix ordering does not
also carry an unrelated upstream patch.

---

## Hand-off to Phase 12 (DOCS-07)

DOCS-07's portability checklist is deferred to Phase 12 and its items are DERIVED from this record.
They are written out here explicitly so Phase 12 inherits a list rather than a re-read.

1. **A warm local box does NOT compute the hash cold CI published.** Measured at the anchor: NO on
   all five targets, same machine, same OS, same commit, same Nx, same Node, same install mode --
   graph state the only variable. The developer-facing consequence is that a box carrying a stale
   persisted inference misses every remote entry CI produced, and no amount of cross-OS parity
   changes that. **The mitigation is a full `nx reset`.**

2. **The reset is needed AFTER the fix commit, not only before.** The persisted plugin cache on
   every existing developer machine holds an inference result that will NOT self-heal when 08-05's
   `nx.json` change lands -- the file hash still validates, so nothing re-derives what it implies. A
   developer who does nothing after pulling the fix keeps computing the pre-fix value. This is the
   single most likely way for the fix to look broken while being correct.

3. **Deleting the repository's `.nx/` directory does NOT produce a cold state.** The native file
   cache resolves under the OS temp directory, OUTSIDE the repository
   (`nx-native-file-cache-<hash>`), so a recipe built on `rm -rf .nx/` is measuring something it
   cannot name. Related and equally load-bearing for anyone working in a git worktree: at Nx 23.1.0
   `sharedCacheDirectory()` resolves the MAIN worktree root, so a worktree's "cold" reading is not
   cold. See `## SURFACED, NOT FIXED` below.

4. **Document the FULL `nx reset`, not `nx reset --onlyWorkspaceData`.** The narrow form can fail on
   Windows with `EPERM, Permission denied` because it does not stop the daemon (only `--onlyDaemon`
   and a full `nx reset` call `killDaemon()`) and the daemon holds the workspace-data SQLite file
   open. A recipe that runs the narrow reset and carries on leaves a WARM graph behind a claim of
   cold.

5. **For anyone reproducing the measurement rather than repairing a box, use the two environment
   variables instead of destroying state.** `NX_WORKSPACE_DATA_DIRECTORY` and
   `NX_NATIVE_FILE_CACHE_DIRECTORY`, pointed at a temporary directory, produce a cold state by
   construction -- an empty directory is cold and its emptiness is readable BEFORE the measurement,
   whereas `nx reset` is an operation that can fail. It is also non-destructive, which matters
   because the stale graph is itself a measurement subject and cannot be regenerated once cleared.

6. **REWRITTEN by plan 08-05 -- the original claim here was FALSE and must not be documented.** This
   item previously read: "A developer who has BUILT computes a different `typecheck` hash from CI,
   and 08-05's fix does NOT close it." **That is measured false** -- see
   `## CORRECTION: D-11's consequence is FALSIFIED, and the instrument was measuring outside the
   dependency chain`. `typecheck` carries an inferred `dependsOn: ["build", "^typecheck"]`, so Nx
   hashes it only after `build` has produced `dist/`; two real runs from opposite `dist/` states
   both compute `8949082127832201885`. The original text is preserved here, struck, precisely
   because shipping it to adopters was the risk that made the correction mandatory.

   **What Phase 12 should document instead: nothing.** There is no developer-facing portability
   hazard here, and adding a reassurance about a non-problem is worse than silence. `typecheck`'s
   `dependentTasksOutputFiles` input over `dist/` is correctly modelled and must stay. The only
   audience for the build-output variable is whoever writes a job or a script that hashes
   `typecheck` WITHOUT running it -- and that audience is served by the `hash-parity` job's own
   comment block, not by a portability checklist. Items 1 through 5 are unaffected.

---

## SURFACED, NOT FIXED: `AGENTS.md`'s per-worktree Nx cache claim is false at Nx 23.1.0

Recorded with its citation and deliberately left unfixed -- it is a documentation defect outside
this phase's stated boundary, and a drive-by edit would put an unrelated change in a phase whose
whole point is a clean measure-then-fix ordering.

`AGENTS.md` states, under the git-worktree strategy:

> `.nx/cache` and `.nx/workspace-data` live at the *worktree* root (not in `node_modules`) and are
> gitignored, so each worktree already gets its own -- let each regenerate its Nx cache rather than
> sharing it

That was true of older Nx. It is not true of the installed 23.1.0: `sharedCacheDirectory()`
resolves `getMainWorktreeRoot(root)` and returns the MAIN repository's cache directory, and
`cleanupWorkspaceData()` explicitly also cleans "the shared workspace data directory in the main
repo where the DB actually lives". [`nx/dist/src/utils/cache-directory.js`,
`nx/dist/src/command-line/reset/reset.js:141-158`; read by `08-RESEARCH.md` Pitfall 7 in the
installed tree.]

**Why it matters beyond tidiness:** an executor running in a git worktree reads the MAIN tree's
graph state, so a "cold" measurement taken there is not cold. That is why this plan verified it was
running in the main checkout rather than assuming it, and the verification is recorded above with
its commands. Anyone repeating these measurements from a worktree will get a reading that is
mislabelled rather than merely noisy.

Fixing the sentence is a one-line documentation change and belongs to whichever phase owns
`AGENTS.md` next. Not this one.

---

## Pre-recorded: this phase's fix commits are a LEGITIMATE all-MISS rotation window

Phase 7's D-36 records three legitimate all-MISS hash-rotation windows in milestone v0.0.2. Phase
8's fix commits are one of them, and it is recorded HERE, before the fix lands, so that nobody
reads the resulting cache misses as a defect and so Phase 9's tripwire is authored correctly.

**What will happen.** `08-05` edits `nx.json` to declare `targetDefaults.typecheck.outputs`.
`{workspaceRoot}/nx.json` is a declared input of every target in this workspace, so that single
edit rotates the task hash of `build`, `typecheck`, `test`, `integration` and `lint` at once. The
first push after it lands will MISS on every target on every leg. That is correct behaviour, not a
regression -- it is the same class of rotation Phase 7 recorded when registering the ESLint plugin.

**What Phase 9's tripwire must therefore be.** Not "an all-miss push is a defect": that fires on
correct work. The condition that actually distinguishes a defect is **two CONSECUTIVE all-miss
pushes with no version-affecting change in between** -- the second miss is the one that means the
entries are not being restored, because the first is fully explained by the rotation that caused
it.

**One additional prediction, labelled as such rather than measured.** After 08-05 lands, the fix
normalises `targets.typecheck.outputs` through `targetDefaults`, so a WORKSTATION carrying the
stale seven-entry inference and a cold runner should converge on the same value -- which means the
staleness axis closes as a side effect of closing the OS axis, for the same reason `lint` should.
That is a prediction. It is not evidence, and 08-06's gate is what turns it into either a
confirmation or a finding.

---

## The ordering proof: this record is complete, and no fix has been applied

D-06 names git history as the proof that the record predates the fix, and rules out a programmatic
mtime guard by name. This section is that proof. There is deliberately no timestamp assertion, no
mtime check and no spec asserting on commit ordering anywhere in this phase's changed files -- a
guard over git metadata would be a guard over something the history already states more legibly, and
it would be one more thing to keep correct.

The phase's commits are the range `7bfe64f..HEAD`. `7bfe64f docs(07): extract phase learnings` is
the last Phase 7 commit and therefore the phase boundary; 22 commits follow it up to and including
the commit immediately before this section landed.

### Listing 1 -- every commit in this phase that touched `nx.json`

```
$ git log --oneline 7bfe64f..HEAD -- nx.json
(exit 0; lines: 0)
```

**NONE.** Zero commits. The three commits that last touched `nx.json` --
`331a60c fix(07): LO-01 declare tools/eslint-rules as a test input too (D-25)`,
`b3fdf6d feat(07-03): infer a cacheable lint target and declare its full input set`, and
`db577db feat(07-01): adopt the ESLint 9 flat-config toolchain` -- are all Phase 7 commits and all
precede the boundary. Nothing in plans 08-01, 08-02, 08-03 or 08-04 edited the file the fix will
edit.

### Listing 2 -- every commit that touched this record

```
$ git log --format="%h  %ad  %s" --date=short 7bfe64f..HEAD -- .planning/phases/08-nx-task-hash-parity/08-ROOT-CAUSE.md
eeace53  2026-07-28  docs(08-04): name the root cause and write the fix route down before taking it
0f64781  2026-07-28  docs(08-03): record observation points 3 and 4, and answer PARITY-01 node by node
2a062a0  2026-07-28  docs(08-03): record observation points 1 and 2, PARITY-04, and what typecheck emits
a8c7e7c  2026-07-28  docs(08-01): open the root-cause record with its method and anti-requirements
```

### What the two listings prove together

The record was opened at `a8c7e7c`, filled with all four observation points and both diffs at
`2a062a0` and `0f64781`, and closed with the root cause, the fix route and U-01's trigger condition
at `eeace53`. Across every one of those commits and every other commit in the phase, `nx.json` is
untouched. **The record is complete at the commit carrying this section, and no fix has been applied
at any point up to and including it.**

The commit that follows this one in the phase is plan 08-05's `nx.json` edit -- the FIRST fix
commit. This plan's last commit is therefore the last commit in Phase 8 for which listing 1 can be
empty, which is precisely what makes PARITY-01's "RECORDED before any fix is applied" checkable
rather than asserted. Anyone auditing it re-runs listing 1 with `HEAD` replaced by this commit's
SHA.

---

## Requirement coverage

One row per requirement this record is responsible for, audited against each requirement's OWN text
in `.planning/REQUIREMENTS.md` rather than against the roadmap's paraphrase. Per D-08 each row
states which of the two questions its section addresses: **Q1** (cross-OS parity), **Q2** (does a
warm local box compute the hash cold CI published), or **neither, it is method**.

| Requirement | Answered by | D-08 question | Satisfied by this record? |
|---|---|---|---|
| **PARITY-01** -- root-cause node-by-node, RECORDED before any fix, controlling for BOTH axes | `## Root cause`, built on `## The local staleness diff (point 1 versus point 2)` and `## The cross-OS diff: PARITY-01, answered node by node`; ordering proven by `## The ordering proof` | **both, separately** -- the staleness sub-section is Q2's precondition, the OS sub-section is Q1's | **YES.** One node, one field, both axes separated, D-09 gate stated, D-10 supersession recorded, and the ordering proven by git history with no programmatic guard |
| **PARITY-02** -- the instrument emits the per-NODE `details` map; `nx show target inputs` recorded INSUFFICIENT | `## The instrument computes Nx's number` and `## Why nx show target inputs is not evidence (D-03, PARITY-02)` | **neither, it is method** -- both sections say so in their first line | **YES.** The instrument is validated byte-identical against `.nx/cache/run.json` on two targets, and the CLI surface is disqualified by its own API doc plus an executed run |
| **PARITY-03** -- byte-identical `build`/`typecheck`/`test` at three observation points, workstation in BOTH graph states; four values per target | `## Observation points` and `## All four points side by side` for the MEASUREMENT half; `### PARITY-03's verdict, UPDATED` for the outcome | **Q1** | **YES, as of plan 08-05 -- and for FOUR targets, not three.** As this section was first written the answer was NO and the record did not claim otherwise: four values per target were recorded at one commit, which was the measurement half, and they were not identical. The OUTCOME is now measured: `build`, `typecheck`, `test` and `lint` are byte-identical across the workstation in both graph states, `ubuntu-24.04-arm` and `windows-11-arm`, after 08-05's `nx.json` fix (`163e6b9`) and its `hash-parity` build step (`56bb11d`). Continuous enforcement still belongs to **plan 08-06's compare job**, per the requirement's own closing clause "Enforced continuously by CORR-03(c), not measured once" |
| **PARITY-04** -- "warm local box computes the cold-CI hash" as a SEPARATE named question, not resolved by `nx reset` | `## PARITY-04, answered as its own question` | **Q2, and only Q2** | **YES.** Measured answer NO on all five targets, stated as a finding the requirement's own text permits, with no `nx reset` anywhere in the recipe |
| **PARITY-05** -- `integration` byte-identical between the WORKSTATION and `windows-11-arm` | `## All four points side by side`, and the zero-node diff in `## D-11: typecheck's third variance source, ROOT-CAUSED` | **Q1**, in its same-OS form | **YES.** Point 1 (workstation, `win32`) and point 3 (`windows-11-arm`) both report `3844377013355031551`, with a zero-node diff across all 430 nodes. Presented as a same-OS PAIR, which is what the requirement asks for -- see the note below |
| **PARITY-06** -- every measurement records Nx version, Node version, install mode AND graph state | `## Observation points`, the four verbatim `meta` blocks, and the cross-point `meta` comparison table | **neither, it is method** | **YES.** All four fields present on all FOUR observation points, not a sample -- checked individually below |

### PARITY-03: what this record's job actually was

The requirement asks for byte-identical hashes at three observation points with the workstation
measured in BOTH graph states -- four values per target. All four values exist, at one commit, each
carrying its full `meta` block. They are not identical, and reporting the row as covered because the
measurement was taken would be exactly the failure mode this audit exists to catch. **This record's
job for PARITY-03 is the measurement; the outcome belongs to 08-05, and the continuous enforcement
belongs to 08-06.** *(CORRECTED by plan 08-05: the sentence that follows is superseded -- all FOUR
values converge once `typecheck` is hashed inside its dependency chain. See
`## CORRECTION: D-11's consequence is FALSIFIED` and the post-build-step re-measurement.)*
Note also that only THREE of the four values can ever be brought into agreement
by an `nx.json` change: the workstation's `typecheck` carries the build-output variable that
`nx.json` cannot reach (D-11, item 6 of the Phase 12 hand-off).

### PARITY-05: confirmed as a PAIR, not accidentally

The requirement names a same-OS pair -- native Windows workstation versus `windows-11-arm` -- not a
cross-OS one, and it is easy to satisfy accidentally and easier to report accidentally. It is
presented as a pair here: point 1 and point 3 are the two halves, both `win32`/`arm64`, both cold,
both at the anchor, and their `integration` diff is zero nodes changed out of 430. The cross-OS
value (`23244131947937181` on point 4) is recorded beside it so the same-OS agreement is visibly an
agreement rather than the absence of a reading. One consequence worth recording: **no CI job can
enforce PARITY-05 continuously**, because no hosted runner is a developer workstation. Unlike
PARITY-03, this row is closed by measurement or not at all.

### PARITY-06: all four points checked, not a sample

| Field | Point 1 | Point 2 | Point 3 | Point 4 |
|---|---|---|---|---|
| `nxVersion` | `23.1.0` | `23.1.0` | `23.1.0` | `23.1.0` |
| `nodeVersion` | `v24.13.0` | `v24.13.0` | `v24.18.0` | `v24.18.0` |
| `installMode` | `ci` | `ci` | `ci` | `ci` |
| `graphState` | `cold` | `warm` | `cold` | `cold` |

Four for four on every point. `nodeVersion` differs between the workstation and the runners because
`.node-version` holds the moving alias `lts/krypton`; PARITY-06 anticipates exactly that, and the
difference is measured inert above rather than waved past. The `meta` block in `## The instrument
computes Nx's number` carries the same four fields for the earlier validation run at `5a8f7c5`.

### Where the requirements' own words disagree with a paraphrase or with the measurement

Recorded rather than smoothed. None of these is edited in place; this record is the attributable
correction, matching how plan 08-01 handled the first of them.

1. **FRESHNESS versus STALENESS.** `ROADMAP.md` SC1 and `REQUIREMENTS.md` PARITY-01 both call the
   second axis a FRESHNESS axis. The measurement says staleness-of-persisted-inference: cold and
   warm AGREE when `.nx/workspace-data` is fresh. Already recorded by plan 08-01 in `## The second
   axis is STALENESS, not freshness`, and restated here because it is the one wording error that
   changes what closes the axis.

2. **PARITY-01's leading hypothesis names two plugins; the measurement names one.** The requirement
   says "the `@nx/vitest` / `@nx/js/typescript` OS-dependent `ProjectConfiguration` class". The
   CLASS is right and the node is right. The plugin is `@nx/js/typescript` specifically -- the
   diverging field is `targets.typecheck.outputs`, which `@nx/js/typescript` infers. `@nx/vitest`'s
   inferred `test` target contributes no differing field: zero `value-changed` fields anywhere in
   the merged node. A narrowing, not a contradiction.

3. **PARITY-01(b)'s parenthetical enumeration is incomplete at the anchor.** It says "warm-local-
   Windows `build`/`test` equal cold-ubuntu-CI to the digit". Measured here, `lint` joins them as a
   third: point 2 versus point 4 is byte-identical on `build`, `test` AND `lint`, with 164 of 164
   merged-configuration fields the same. Incomplete rather than wrong.

4. **PARITY-06's guess at `typecheck`'s third variance source is the right node and the wrong
   variable.** The requirement says "plausibly install mode reaching it via
   `dependentTasksOutputFiles` or `externalDependencies`". It IS the `dependentTasksOutputFiles`
   node -- but install mode is `ci` on all four observation points, so install mode is not the
   variable at all. The variable is whether `packages/github-cache/dist/` is POPULATED. Right node,
   wrong cause, and the difference matters because the requirement's version would have been closed
   by standardising the install command, which would not have closed anything.

5. **`ROADMAP.md`'s traceability table carries a stale PARITY numbering.** Rows `:530-534` read as
   an off-by-N shift against `REQUIREMENTS.md`: the `PARITY-02` row states PARITY-03's text
   ("byte-identical `build`/`typecheck`/`test` at all THREE observation points"), the `PARITY-03`
   row states PARITY-05's, the `PARITY-04` row states PARITY-06's, and the `PARITY-05` row states
   PARITY-07's. The coverage line at `:574` says "Phase 8: 7 (PARITY-01..05, CORR-03, CORR-04)",
   while the ROADMAP's OWN Phase 8 section at `:164-165` and `REQUIREMENTS.md`'s traceability rows
   at `:619-627` both list PARITY-01 through PARITY-07 plus CORR-03 and CORR-04 -- nine. **This
   audit reads `REQUIREMENTS.md`, which is why the shift is visible at all**; an audit against the
   table would have reported PARITY-02 covered by the observation points, which is PARITY-03's job
   and is exactly the row this record does NOT satisfy. Surfaced, not fixed: `ROADMAP.md` is outside
   this plan's file scope and a drive-by renumber in the phase whose whole point is a clean
   measure-then-fix ordering is the wrong trade.

---

## Anti-requirements: what does NOT count as evidence

This phase's success criteria are unusually prescriptive about what is not evidence, and each item
is easy to satisfy by accident in a later plan. Recorded as constraints on plans 08-05 and 08-06,
not as notes.

1. **A "no difference" result from `nx show target inputs` is NOT evidence.** The surface SKIPS
   `ProjectConfiguration` by its own API documentation -- which is the ONLY node that differs
   cross-OS in this workspace -- and reports file PATHS rather than content hashes. The programmatic
   `HashPlanInspector` form carries the same limitation; it is the same inspector with a different
   wrapper. Both the trailing-`--inputs` form and the real `inputs` subcommand were run so neither
   reading can be dismissed as the wrong command. Citations are in `## Why nx show target inputs is
   not evidence (D-03, PARITY-02)`. **Constraint: no plan may close a parity claim on that surface.**

2. **A textual assertion that `nx.json` CONTAINS the discriminator does NOT satisfy CORR-03.** It
   proves the input is DECLARED; it does not prove the input DISCRIMINATES. CORR-03's own text says
   so. The satisfying evidence is clause (b) -- `integration`'s hash differing between two real legs
   -- with clause (c) as its non-vacuity control. **Constraint on 08-06: the gate asserts over two
   downloaded runner records, never over `nx.json` text.** `nx-target-inputs.spec.ts:241-260` is a
   CORR-04 guard ("`integration` is the only target with a runtime input") and is not, and must not
   be presented as, CORR-03 evidence.

3. **A `nx reset` in a PARITY-04 proof recipe silently converts PARITY-04's question into
   PARITY-03's.** The reset clears `.nx/workspace-data` and forces the local box COLD; a cold local
   box compared against cold CI is a clean answer to Q1 that LOOKS like an answer to Q2 while having
   replaced Q2's subject. The developer Q2 is about did not run `nx reset` -- that is the entire
   premise. This record's PARITY-04 section deliberately contains none, and `nx reset` appears in
   this document only in prose explaining why it is excluded and in the Phase 12 hand-off where it
   is the developer-facing MITIGATION rather than a measurement step. **Constraint on 08-05: the
   post-fix re-measurement keeps the environment-variable cold recipe and keeps a
   warm-preexisting reading, or U-01's condition C1 is unmeasurable.**

4. **No Phase 8 spec may assert on `.github/workflows/ci.yml` content.** `nx.json`'s `test` inputs
   list `{workspaceRoot}/.github/workflows/cleanup.yml` (`nx.json:68`) and NOT `ci.yml`, so a spec
   reading `ci.yml` serves a stale cached PASS -- it re-runs only when some unrelated input busts
   the `test` hash. Registering `ci.yml` is **PARITY-08 and is deferred to Phase 9**, so its hash
   rotation collapses into VER-01's existing window. **This is a constraint on plans 08-05 and
   08-06, not a note:** 08-06 wires a CI job and the temptation to guard it with a spec that reads
   the workflow file is real. The rationale for that job lives in its own comment block in `ci.yml`
   -- which is why 08-03's job carries roughly 70 lines of comment -- and its behaviour is gated by
   the job failing, not by a spec asserting the job exists. This repo has shipped the
   stale-cached-PASS class three times (`governance-email.spec.ts`, `typecheck`'s own inputs, and
   the D-25 `tools/eslint-rules` hole), so the constraint is recorded rather than assumed.

---

## Post-fix re-measurement (local)

Appended by plan 08-05, AFTER the fix commit. Everything above this line was written before any
`nx.json` edit existed; `## The ordering proof` is checkable against the commit immediately
preceding `163e6b9`.

**The fix commit is `163e6b9e3af819ae3ad9b54ea17c870b737531b5`.** `git show --stat` lists exactly
two files: `nx.json` (+9, one hunk) and `packages/github-cache/src/nx-target-inputs.spec.ts` (+76,
two hunks, pure insertion). The `nx.json` hunk is the whole fix:

```jsonc
"typecheck": {
  "outputs": [
    "{projectRoot}/tsconfig.tsbuildinfo",
    "{projectRoot}/dist/**/*.{d.ts,d.cts,d.mts}",
    "{projectRoot}/dist/**/*.{d.ts,d.cts,d.mts}.map",
    "{projectRoot}/dist/tsconfig.lib.tsbuildinfo",
    "{projectRoot}/out-tsc/vitest/**/*.{d.ts,d.cts,d.mts}",
    "{projectRoot}/out-tsc/vitest/**/*.{d.ts,d.cts,d.mts}.map",
    "{projectRoot}/out-tsc/vitest/tsconfig.spec.tsbuildinfo"
  ],
  "inputs": [ /* unchanged */ ]
}
```

`outputs` sits FIRST, matching `targetDefaults.lint`, the only prior precedent. The `plugins` array
is untouched, no `project.json` was created, and `integration`'s runtime input is byte-identical.

### The pins were RED before the fix, and the RED was a value mismatch

Run BEFORE the `nx.json` hunk existed, with only the spec edit in the tree:

```
AssertionError: expected undefined to deeply equal [ ...(7) ]
 -> src/nx-target-inputs.spec.ts:173:53
 Test Files  1 failed | 33 passed (34)
      Tests  1 failed | 561 passed (562)
```

Recorded because the plan flagged it as the one place a naive RED goes wrong here.
`targetDefaults.typecheck` ALREADY EXISTED, so the helper did not throw the way it did when
`targetDefaults.lint` was absent in Phase 7 -- there is no `TypeError`, only a value mismatch, which
is a WEAKER signal. Asserting deep equality against the full expected list rather than a
`toBeDefined` is what makes it unambiguous, and the failure text above is the evidence that it is.

`561 passed` rather than `560` is also informative: the second new pin, the exact-equality one on
`integration`'s discriminator string, passed on its first run. It is a REGRESSION pin over an
already-correct value, not a RED-driven one, so it was mutation-tested separately below.

### Both new pins were OBSERVED red under mutation, then restored

D-22 and Phase 7's learning: a guard never seen red is not verified, and Phase 7 recorded two guards
that passed for the wrong reason. Each mutation was applied to `nx.json`, measured, and reverted.
Each edit busts the `test` hash by itself (`{workspaceRoot}/nx.json` is a declared `test` input), so
none of these readings can be a cached replay.

| # | Mutation | Result | Failing assertion |
|---|----------|--------|-------------------|
| M1 | the `outputs` key absent (the pre-fix state) | 1 failed / 561 passed | `expected undefined to deeply equal [ ...(7) ]` |
| M2 | `outputs` set to the ONE-entry list | 1 failed / 561 passed | `expected [ Array(1) ] to deeply equal [ ...(7) ]` |
| M3 | discriminator re-spelled `node -e "console.log(process.platform)"` | 1 failed / 561 passed | `expected [ Array(1) ] to deeply equal [ 'node -p process.platform' ]` |

**M2 is the one that matters for T-08-21.** The one-entry list is the OTHER form
`@nx/js/typescript` infers -- it is perfectly STABLE, so a guard that only checked for stability
would pass on it while `typecheck` silently cached none of its declaration output. M2 shows the pin
discriminates between the two candidates, not merely between present and absent.

**M3 is what proves the new discriminator pin adds coverage the pre-existing guard does not have.**
Under M3 the pre-existing CORR-04 guard at `nx-target-inputs.spec.ts:241-260` ("integration is still
the only target with a platform runtime input") stayed GREEN -- the re-spelled command is still a
runtime input on still exactly one target. Exactly one test failed, and it was the new pin. The
pre-existing guard was not modified: `git diff` over the spec file reports two pure-insertion hunks,
`@@ -136,0 +137,48 @@` and `@@ -260,0 +309,28 @@`, with zero deletions anywhere in the file.

### Three readings, all at the fix commit, on a clean tree

Taken in this ORDER, and the order is deliberate: warm-preexisting FIRST because it is the only
irreplaceable one, cold second because the env-var recipe is non-destructive and re-takeable at
will, warm-after-reset last because `nx reset` destroys the state reading 2 measures. The nine-command
battery was run before the readings, so `packages/github-cache/dist/` is POPULATED for all three --
the same condition observation points 1 and 2 were taken under, which keeps the D-11 variable held.

#### Reading A -- native Windows workstation, WARM-PREEXISTING

```json
{
  "os": "win32",
  "arch": "arm64",
  "nxVersion": "23.1.0",
  "nodeVersion": "v24.13.0",
  "installMode": "ci",
  "commit": "163e6b9e3af819ae3ad9b54ea17c870b737531b5",
  "workingTreeClean": true,
  "githubSha": null,
  "runnerOs": null,
  "capturedAt": "2026-07-28T06:38:01.460Z",
  "graphState": "warm",
  "graphStateBasis": "workspaceDataEntries",
  "workspaceDataDirectory": "D:\\projects\\github\\op-nx\\github-cache\\.nx\\workspace-data",
  "workspaceDataEntries": 18,
  "nativeFileCacheDirectory": "C:\\Users\\LARSGY~1\\AppData\\Local\\Temp\\nx-native-file-cache-b463ff1",
  "nativeFileCacheEntries": 1,
  "daemonEnabled": true
}
```

Recipe: `node capture-hashes.mjs --install-mode ci --out <outside the tree>`, NO overrides at all.
`daemonEnabled: true` and the workspace-data directory pointing at the repository's own `.nx/` are
what make it warm-PREEXISTING rather than warm-fresh. **No `nx reset` preceded it** -- the same
long-lived directory that carried the stale seven-entry inference at the anchor is still the one
being read, now at 18 entries rather than 16.

| Target | Hash | Nodes |
|--------|------|-------|
| `build` | `17197827372395989528` | 428 |
| `typecheck` | `8949082127832201885` | 429 |
| `test` | `1367622961810189968` | 444 |
| `integration` | `1193647465557986036` | 430 |
| `lint` | `6930879416208693542` | 443 |

Discriminator, raw and verbatim (`command: node -p process.platform`, `status: 0`):

```json
{ "stdout": "win32\n", "stderr": "" }
```

**Which question this reading answers: Q2 -- "does a warm local box compute the hash cold CI
published".** It is still the ONLY Q2 input available and no runner can produce it.

#### Reading B -- native Windows workstation, COLD

```json
{
  "os": "win32",
  "arch": "arm64",
  "nxVersion": "23.1.0",
  "nodeVersion": "v24.13.0",
  "installMode": "ci",
  "commit": "163e6b9e3af819ae3ad9b54ea17c870b737531b5",
  "workingTreeClean": true,
  "githubSha": null,
  "runnerOs": null,
  "capturedAt": "2026-07-28T06:38:17.925Z",
  "graphState": "cold",
  "graphStateBasis": "workspaceDataEntries",
  "workspaceDataDirectory": "C:/Users/LARSGY~1/AppData/Local/Temp/claude/D--projects-github-op-nx-github-cache/ecd11393-4351-4fdb-a1bb-f555cfb148f0/scratchpad/hp2/cold/wsdata",
  "workspaceDataEntries": 0,
  "nativeFileCacheDirectory": "C:/Users/LARSGY~1/AppData/Local/Temp/claude/D--projects-github-op-nx-github-cache/ecd11393-4351-4fdb-a1bb-f555cfb148f0/scratchpad/hp2/cold/nfc",
  "nativeFileCacheEntries": 1,
  "daemonEnabled": false
}
```

Recipe, unchanged from observation point 1 -- the environment-variable form, into a fresh temporary
directory OUTSIDE the repository, with no `nx reset` anywhere (anti-requirement 3):

```bash
COLD="$SP/hp2/cold"
rm -rf "$COLD"; mkdir -p "$COLD"
NX_DAEMON=false \
NX_WORKSPACE_DATA_DIRECTORY="$COLD/wsdata" \
NX_NATIVE_FILE_CACHE_DIRECTORY="$COLD/nfc" \
  node capture-hashes.mjs --install-mode ci --out "$SP/hp2/post-cold.json"
```

| Target | Hash | Nodes |
|--------|------|-------|
| `build` | `17197827372395989528` | 428 |
| `typecheck` | `8949082127832201885` | 429 |
| `test` | `1367622961810189968` | 444 |
| `integration` | `1193647465557986036` | 430 |
| `lint` | `6930879416208693542` | 443 |

Discriminator: `{ "stdout": "win32\n", "stderr": "" }`, `status: 0`.

`nativeFileCacheEntries: 1` is again the CORRECT cold reading and the freshly-created directory again
held exactly `23.1.0-nx.win32-arm64-msvc.node` and nothing else; the declared basis is
`workspaceDataEntries`, and that count is zero. See `## Method` for why the two-surface derivation
cannot ever return `cold`.

**Which question this reading answers: Q1, cross-OS parity.** It is the workstation's contribution to
the three-way cold comparison and the same-OS control PARITY-05 pairs with `windows-11-arm`.

#### Reading C -- native Windows workstation, WARM-AFTER-RESET

```json
{
  "os": "win32",
  "arch": "arm64",
  "nxVersion": "23.1.0",
  "nodeVersion": "v24.13.0",
  "installMode": "ci",
  "commit": "163e6b9e3af819ae3ad9b54ea17c870b737531b5",
  "workingTreeClean": true,
  "githubSha": null,
  "runnerOs": null,
  "capturedAt": "2026-07-28T06:39:29.407Z",
  "graphState": "warm",
  "graphStateBasis": "workspaceDataEntries",
  "workspaceDataDirectory": "D:\\projects\\github\\op-nx\\github-cache\\.nx\\workspace-data",
  "workspaceDataEntries": 13,
  "nativeFileCacheDirectory": "C:\\Users\\LARSGY~1\\AppData\\Local\\Temp\\nx-native-file-cache-b463ff1",
  "nativeFileCacheEntries": 1,
  "daemonEnabled": true
}
```

Recipe: a FULL `npx nx reset` (not `--onlyWorkspaceData`, per the EPERM hazard in `## Method`),
which reported `Successfully reset the Nx workspace` and left `.nx/workspace-data` at 0 entries; then
`npx nx show projects`, an ordinary command a developer would run, which repopulated it to 13; then
the capture with no overrides.

| Target | Hash | Nodes |
|--------|------|-------|
| `build` | `17197827372395989528` | 428 |
| `typecheck` | `8949082127832201885` | 429 |
| `test` | `1367622961810189968` | 444 |
| `integration` | `1193647465557986036` | 430 |
| `lint` | `6930879416208693542` | 443 |

Discriminator: `{ "stdout": "win32\n", "stderr": "" }`, `status: 0`.

**Which question this reading answers: Q1.** Per D-08, any proof that resets before measuring has
answered Q1 no matter what it was aiming at -- the reset forced the box cold and then re-derived, so
the developer whose experience Q2 is about is not its subject. It is recorded as a THIRD reading
rather than as a replacement for reading A, because overwriting the warm-preexisting value with a
post-reset one is precisely the move PARITY-04 names as disqualifying.

#### All three side by side

| Target | A warm-preexisting | B cold | C warm-after-reset | Agree? |
|--------|--------------------|--------|--------------------|--------|
| `build` | `17197827372395989528` | `17197827372395989528` | `17197827372395989528` | YES |
| `typecheck` | `8949082127832201885` | `8949082127832201885` | `8949082127832201885` | YES |
| `test` | `1367622961810189968` | `1367622961810189968` | `1367622961810189968` | YES |
| `integration` | `1193647465557986036` | `1193647465557986036` | `1193647465557986036` | YES |
| `lint` | `6930879416208693542` | `6930879416208693542` | `6930879416208693542` | YES |

### Diff 1 -- pre-fix cold (observation point 1) versus post-fix cold (reading B)

`node capture-hashes.mjs --diff point1-cold.json post-cold.json`, A = pre-fix, B = post-fix. This is
what the fix DID, and every moving node is accounted for.

```
=== build : 4770979534943963808 (A) vs 17197827372395989528 (B) ===
  nodes: 428 / 428    only-in-A (0)   only-in-B (0)
    value-changed (2):
        @op-nx/github-cache:ProjectConfiguration
          A=3473609128188475433   B=17377863611053487263
        workspace:[{workspaceRoot}/nx.json,{workspaceRoot}/.gitignore,{workspaceRoot}/.nxignore]
          A=17095470214823693567  B=12322429517629369676
    same: 426

=== typecheck : 8784332057851660202 (A) vs 8949082127832201885 (B) ===
  nodes: 429 / 429    only-in-A (0)   only-in-B (0)
    value-changed (3):
        workspace:[{workspaceRoot}/nx.json,...]        (the nx.json edit)
        @op-nx/github-cache:packages/github-cache/**/* (the spec edit)
          A=2398179098240992186   B=18133479598596954471
        @op-nx/github-cache:ProjectConfiguration
          A=3473609128188475433   B=17377863611053487263
    same: 426

=== test        : 1238755096132544780  -> 1367622961810189968   (4 changed, 440 same)
=== integration : 3844377013355031551  -> 1193647465557986036   (3 changed, 427 same)
=== lint        : 17022226934688547307 -> 6930879416208693542   (3 changed, 440 same)

=== projectConfiguration (field level) ===
    only-in-A (0): -
    only-in-B (6): targets.typecheck.outputs.1, targets.typecheck.outputs.2,
                   targets.typecheck.outputs.3, targets.typecheck.outputs.4,
                   targets.typecheck.outputs.5, targets.typecheck.outputs.6
    value-changed (0): -
    same: 158
```

**All five hashes rotated, and that is the pre-recorded N2 / D-36 rotation window, not a defect.**
`{workspaceRoot}/nx.json` is a declared input of every target, so the `workspace:[...nx.json...]`
node moves on all five by construction. `test` rotates twice over -- it carries nx.json in a second,
longer `workspace:` node as well. The `packages/github-cache/**/*` node moves on the three targets
whose fileset includes the edited spec.

**The load-bearing line is the field diff.** Six `only-in-B` entries,
`targets.typecheck.outputs.1` through `.6`: the COLD WINDOWS graph now carries the SEVEN-entry list
where before the fix it carried one. `targetDefaults` demonstrably reaches the field on Windows.
158 other fields are unchanged and there are zero `value-changed` fields anywhere in the merged node,
so the edit moved exactly the one field it was aimed at and nothing else.

And the `ProjectConfiguration` node did not merely move -- it moved TO `17377863611053487263`, which
is the value cold LINUX emitted at the anchor. Windows is now emitting the Linux node.

### Diff 2 -- post-fix cold (B) versus post-fix warm-preexisting (A)

`node capture-hashes.mjs --diff post-cold.json post-warm-preexisting.json`:

```
=== build       : 17197827372395989528 (A) vs 17197827372395989528 (B) === 0 changed, 428 same
=== typecheck   : 8949082127832201885  (A) vs 8949082127832201885  (B) === 0 changed, 429 same
=== test        : 1367622961810189968  (A) vs 1367622961810189968  (B) === 0 changed, 444 same
=== integration : 1193647465557986036  (A) vs 1193647465557986036  (B) === 0 changed, 430 same
=== lint        : 6930879416208693542  (A) vs 6930879416208693542  (B) === 0 changed, 443 same

=== projectConfiguration (field level) ===
    only-in-A (0): -    only-in-B (0): -    value-changed (0): -    same: 164
```

Zero `only-in-*`, zero `value-changed`, on every target and on every one of the 164 merged-node
fields. The post-fix cold-versus-warm-after-reset diff is identical in shape -- also all zeroes.

**The node the record named has stopped moving between graph states.** That is the confirming
outcome the plan named in advance, and it is C1.

**Which question the two diffs answer: both, jointly.** Diff 1 answers Q1's local half by showing
what changed and why; diff 2 answers Q2 directly by showing that the developer's own long-lived,
never-reset graph now computes the same number a cold graph does.

### PARITY-04's answer has CHANGED, and this is the measurement

At the anchor, PARITY-04's measured answer was NO on all five targets. The cold column is the shape
of what CI computes, and the CI section below confirms the actual published values.

| Target | Warm-preexisting local (A) | Cold CI, `windows-11-arm` | Agree? |
|--------|----------------------------|---------------------------|--------|
| `build` | `17197827372395989528` | `17197827372395989528` | **YES** |
| `typecheck` | `8949082127832201885` | `1284533355439392975` | NO -- D-11 |
| `test` | `1367622961810189968` | `1367622961810189968` | **YES** |
| `integration` | `1193647465557986036` | `1193647465557986036` | **YES** |
| `lint` | `6930879416208693542` | `6930879416208693542` | **YES** |

**Four of five, up from zero of five.** The one that still disagrees is `typecheck`, and its
remaining difference is the D-11 build-output variable and nothing else -- the same-OS diff below
isolates it to a single `dependentTasksOutputFiles` node. `nx.json` cannot reach that variable; it is
a property of whether the workspace has BUILT. This is pre-committed non-trigger N1 and a DOCS-07
item, item 6 of the Phase 12 hand-off, not a U-01 trigger.

*(CORRECTED by plan 08-05. The `NO -- D-11` row above is an artefact of the INSTRUMENT hashing
`typecheck` outside its dependency chain, not a real divergence: a real `nx typecheck` run computes
`8949082127832201885` from either `dist/` state, and that IS the value in the local column. Once the
`hash-parity` job builds before capturing, the CI column reads the same number and the row becomes
YES -- five of five. See `## CORRECTION: D-11's consequence is FALSIFIED` and the post-build-step
re-measurement. Hand-off item 6 is rewritten; N1's non-trigger status is unchanged.)*

**Consequence for the Phase 12 hand-off, measured rather than predicted.** Hand-off item 2 warned
that the persisted plugin cache would NOT self-heal and that a developer who does nothing after
pulling the fix keeps computing the pre-fix value -- "the single most likely way for the fix to look
broken while being correct". Reading A refutes that for THIS fix, and the mechanism is worth stating:
the stale entry is still there and still carries the seven-entry inference, but `targetDefaults`
OVERRIDES the field in the merged node regardless of what the plugin cache says, so the stale value
no longer reaches the hash. The prediction in `## Pre-recorded: this phase's fix commits are a
LEGITIMATE all-MISS rotation window` -- that the staleness axis would close as a side effect of
closing the OS axis -- is CONFIRMED. Hand-off item 2 should be narrowed in Phase 12 from "always
reset after this fix" to "reset when a divergence is not otherwise explained"; items 1, 3, 4, 5 and 6
are unaffected, because a `targetDefaults` override only protects the fields it declares.

### The nine-command battery at the fix commit

`format:check`, `build`, `typecheck`, `typecheck:action`, `test`, `lint`, `fallow:ci`,
`check:action`, `pack:check` -- all nine exit 0 at `163e6b9`. `packages/github-cache/src/public-surface.spec.ts`, `src/index.ts` and `src/test/consumer-contract.ts`
are byte-identical to their pre-plan state (`git diff --exit-code` clean) and `pack:check` exits 0,
which is PARITY-07 / D-16 satisfied as both halves rather than as a passing suite over an edited
guard.

---

## SURFACED during 08-05: `packages/github-cache/project.json` EXISTS, so "no `project.json`" is false

Recorded with its evidence and deliberately left unfixed. It is not a defect and there is nothing to
repair -- what is wrong is a PREMISE that three planning documents state as fact.

D-12 says fixes land in `nx.json` `targetDefaults` only, "No `project.json` (**the workspace is
deliberately free of them**)". Phase 7's D-02 says the same. `## Proposed fix` above repeats it as a
constraint row. Measured at the fix commit:

```
$ git ls-files | rg "project\.json"
packages/github-cache/project.json

$ git log --oneline -- packages/github-cache/project.json
7413363 test(github-cache): wire a real integration target + cross-OS HTTP round-trip (I1)
```

It has existed since well before Phase 7, and it declares the `integration` target:

```json
{
  "name": "@op-nx/github-cache",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "targets": {
    "integration": {
      "command": "vitest run --config vitest.integration.config.mts",
      "options": { "cwd": "packages/github-cache" }
    }
  }
}
```

**Nothing in this plan created it and nothing in this plan should delete it** -- `integration` is the
one target in the workspace that is NOT inferred by a plugin, so removing the file removes the
target, and Phase 7's `nx run-many -t <missing>` learning says that would read as a silently passing
gate rather than a failure.

**Why it is recorded rather than shrugged off: it changes the cost of one of U-01's four options.**
Option `pin-inferred-target` is priced in plan 08-05 as "Departs from D-02's no-`project.json`
posture". That price is already paid -- the posture is not the workspace's actual state, so the
option's real cost is narrower than stated: adding a second target to an existing file, not breaking
a workspace-wide invariant. A maintainer reading the checkpoint should know that before weighing it.

The accurate statement of the invariant, and the one this plan honoured, is the OTHER half of D-12:
the fix landed in `nx.json` `targetDefaults`, no `project.json` was created or edited, and the
`plugins` array is unchanged. Correcting D-12's and D-02's parenthetical is a planning-document edit
outside this plan's file scope, and the phase whose whole point is a clean measure-then-fix ordering
is the wrong place for a drive-by.

---

## Post-fix re-measurement (CI)

Appended by plan 08-05 task 2. A **LIVE-CI CLOSURE**: the cross-OS half of this re-measurement
exists only on real runners and cannot be closed locally without faking the thing under test.

Both records come from workflow run
[`30335453685`](https://github.com/op-nx/github-cache/actions/runs/30335453685), a `pull_request`
event on the same draft pull request #9. The whole run was `success`, including both `hash-parity`
legs; neither needed a re-run, so the fix commit never moved.

### Validated BEFORE the values were read

Same discipline plan 08-03 task 3 used. A record that fails these checks is not comparable with the
others, and checking after reading the hashes is checking with the answer already in hand.

| Check | `ubuntu-24.04-arm` | `windows-11-arm` | Verdict |
|-------|--------------------|------------------|---------|
| `meta.commit` equals the fix commit `163e6b9...` | yes | yes | PASS |
| `meta.commit` equals `meta.githubSha` | **no** | **no** | PASS -- see below |
| `meta.githubSha` | `42bee743f3551de4caba268cbd169bd0028bb10a` | same | the merge commit |
| `meta.installMode` | `ci` | `ci` | matches all three local readings |
| `meta.nxVersion` | `23.1.0` | `23.1.0` | matches all three local readings |
| `meta.graphState` / `workspaceDataEntries` | `cold` / 0 | `cold` / 0 | admissible under D-09 |
| `meta.workingTreeClean` | `true` | `true` | PASS |
| `meta.nodeVersion` | `v24.18.0` | `v24.18.0` | **differs from local `v24.13.0`** -- named confound |

**The `commit != githubSha` row is the pin WORKING, not failing**, and the record already carries the
correction that makes that readable: `GITHUB_SHA` on a `pull_request` event is the MERGE commit the
runner takes from the event payload, and it does not follow what the job checked out. Equality would
mean the checkout had landed on the merge commit. Cross-checked against the API rather than inferred:

```
$ gh api repos/op-nx/github-cache/pulls/9 -q '{head:.head.sha,merge_commit:.merge_commit_sha,base:.base.sha,draft:.draft}'
{"base":"fe25a3f865f20f3d4f8a40e96f8cb5717608ba8a",
 "head":"163e6b9e3af819ae3ad9b54ea17c870b737531b5",
 "merge_commit":"42bee743f3551de4caba268cbd169bd0028bb10a",
 "draft":true}
```

`meta.commit` equals the PR head equals the fix commit. `meta.githubSha` equals the merge commit
GitHub synthesised. The checkout pin held on both legs.

**The Node version difference is recorded as a named confound, not skipped, and it is measurably
inert again.** `.node-version` holds the moving alias `lts/krypton`, so the runners resolved
`v24.18.0` while this workstation is pinned by `fnm` at `v24.13.0` -- the same difference the anchor
carried. The proof it reaches no hashed node is in the data below: the workstation's cold reading and
the `windows-11-arm` reading differ ONLY in Node version, runner identity and build-output state, and
their `build`, `test`, `integration` and `lint` hashes are byte-identical with ZERO differing nodes.

### `ubuntu-24.04-arm`, cold

```json
{
  "os": "linux",
  "arch": "arm64",
  "nxVersion": "23.1.0",
  "nodeVersion": "v24.18.0",
  "installMode": "ci",
  "commit": "163e6b9e3af819ae3ad9b54ea17c870b737531b5",
  "workingTreeClean": true,
  "githubSha": "42bee743f3551de4caba268cbd169bd0028bb10a",
  "runnerOs": "Linux",
  "capturedAt": "2026-07-28T06:38:13.894Z",
  "graphState": "cold",
  "graphStateBasis": "workspaceDataEntries",
  "workspaceDataDirectory": "/home/runner/work/github-cache/github-cache/.nx/workspace-data",
  "workspaceDataEntries": 0,
  "nativeFileCacheDirectory": "/tmp/nx-native-file-cache-aa0ca25",
  "nativeFileCacheEntries": 1,
  "daemonEnabled": false
}
```

| Target | Hash | Nodes |
|--------|------|-------|
| `build` | `17197827372395989528` | 428 |
| `typecheck` | `1284533355439392975` | 429 |
| `test` | `1367622961810189968` | 444 |
| `integration` | `11946835023040710407` | 430 |
| `lint` | `6930879416208693542` | 443 |

Discriminator, raw and verbatim (`command: node -p process.platform`, `status: 0`):

```json
{ "stdout": "linux\n", "stderr": "" }
```

### `windows-11-arm`, cold

```json
{
  "os": "win32",
  "arch": "arm64",
  "nxVersion": "23.1.0",
  "nodeVersion": "v24.18.0",
  "installMode": "ci",
  "commit": "163e6b9e3af819ae3ad9b54ea17c870b737531b5",
  "workingTreeClean": true,
  "githubSha": "42bee743f3551de4caba268cbd169bd0028bb10a",
  "runnerOs": "Windows",
  "capturedAt": "2026-07-28T06:40:58.579Z",
  "graphState": "cold",
  "graphStateBasis": "workspaceDataEntries",
  "workspaceDataDirectory": "C:\\a\\github-cache\\github-cache\\.nx\\workspace-data",
  "workspaceDataEntries": 0,
  "nativeFileCacheDirectory": "C:\\Users\\RUNNER~1\\AppData\\Local\\Temp\\nx-native-file-cache-a830eb7",
  "nativeFileCacheEntries": 1,
  "daemonEnabled": false
}
```

| Target | Hash | Nodes |
|--------|------|-------|
| `build` | `17197827372395989528` | 428 |
| `typecheck` | `1284533355439392975` | 429 |
| `test` | `1367622961810189968` | 444 |
| `integration` | `1193647465557986036` | 430 |
| `lint` | `6930879416208693542` | 443 |

Discriminator, raw and verbatim (`command: node -p process.platform`, `status: 0`):

```json
{ "stdout": "win32\n", "stderr": "" }
```

### The cross-OS diff at the fix commit

`node capture-hashes.mjs --diff <ubuntu record> <windows record>`, A = `ubuntu-24.04-arm`,
B = `windows-11-arm`, both cold, both at `163e6b9`:

```
=== build : 17197827372395989528 (A) vs 17197827372395989528 (B) ===
  command: same
  nodes: 428 / 428
    only-in-A (0): -    only-in-B (0): -    value-changed (0): -    same: 428

=== typecheck : 1284533355439392975 (A) vs 1284533355439392975 (B) ===
  command: same
  nodes: 429 / 429
    only-in-A (0): -    only-in-B (0): -    value-changed (0): -    same: 429

=== test : 1367622961810189968 (A) vs 1367622961810189968 (B) ===
  command: same
  nodes: 444 / 444
    only-in-A (0): -    only-in-B (0): -    value-changed (0): -    same: 444

=== integration : 11946835023040710407 (A) vs 1193647465557986036 (B) ===
  command: same
  nodes: 430 / 430
    only-in-A (0): -    only-in-B (0): -
    value-changed (1):
        runtime:node -p process.platform
          A=11970638123438591088
          B=6694901896827773122
    same: 429

=== lint : 6930879416208693542 (A) vs 6930879416208693542 (B) ===
  command: same
  nodes: 443 / 443
    only-in-A (0): -    only-in-B (0): -    value-changed (0): -    same: 443

=== projectConfiguration (field level) ===
  fields
    only-in-A (0): -    only-in-B (0): -    value-changed (0): -    same: 164
```

Read in the prescribed order: `only-in-A` / `only-in-B` are ZERO on all five targets, as they were at
the anchor -- the external node set is still identical, so the diff is still non-vacuous.
`value-changed` is now ZERO on four targets and exactly ONE on `integration`, and that one is the
declared discriminator. The merged project configuration is identical field for field, 164 of 164,
where at the anchor it carried six `only-in-A` entries.

**The `@op-nx/github-cache:ProjectConfiguration` node reads `17377863611053487263` on BOTH legs.** At
the anchor it read `17377863611053487263` on Linux and `3473609128188475433` on Windows. It has
converged, and it converged onto the Linux value, which is the one the enumeration says is correct.

**L3 checked directly rather than inferred from the node hash.** The merged node's
`targets.typecheck.outputs` was compared against the value declared in `nx.json` on each leg
independently: it is byte-equal to the declared seven-entry list on `linux` AND on `win32`. A
`targetDefaults` entry demonstrably reaches this field on both operating systems, which is
assumption A2 holding.

### The four verdicts

Stated plainly, one line each, because these are the phase's outcome and must not be buried in a
diff dump. Each carries its bearing on plan 08-04's PRE-COMMITTED U-01 condition, which was written
before the experiment ran and is not reinterpreted here.

**VERDICT 1 -- `build`, `typecheck` and `test` cross-OS: IDENTICAL.** All three are byte-identical
between `ubuntu-24.04-arm` and `windows-11-arm` (`17197827372395989528`, `1284533355439392975`,
`1367622961810189968`), each with zero `value-changed` nodes and zero `only-in-*` entries. This is
PARITY-03's cross-OS half. *U-01 bearing: CONFIRMS. It satisfies C2 (the node is identical between
the two cold legs) and exceeds C3, which asked only for `build`, `test` and `lint` -- `typecheck`
converged too, because both legs skip the build so the D-11 variable is held equal between them.*

**VERDICT 2 -- `integration` cross-OS: DIFFERS**, `11946835023040710407` on Linux against
`1193647465557986036` on Windows, and its diff shows exactly ONE changed node,
`runtime:node -p process.platform`, with the other 429 identical. **A MATCHING hash on this row
would be a FAILURE of the discriminator and NOT a success of parity** -- it would mean the one target
that is supposed to be OS-sensitive had stopped being so, which is a CORR-04 regression that would
otherwise hide inside three clean-looking rows. *U-01 bearing: CONFIRMS. This is C4, and it is now
the ONLY surviving cross-OS difference in the workspace, which is exactly the state D-14 keeps that
input for.*

**VERDICT 3 -- `integration`, the SAME-OS pair: IDENTICAL.** This is PARITY-05 and it is a DIFFERENT
comparison from verdict 2, presented as its own row so it cannot be reported by accident. The
workstation's cold reading and the `windows-11-arm` reading are both `1193647465557986036`, with a
zero-node diff across all 430 nodes. *U-01 bearing: CONFIRMS -- no pre-committed condition names it,
because PARITY-05 was already satisfied at the anchor and the requirement is that the fix not break
it. It did not.*

**VERDICT 4 -- `lint` cross-OS: IDENTICAL**, `6930879416208693542` on both legs, zero changed nodes
out of 443. At the anchor it diverged (`14919174368951396261` against `17022226934688547307`), and
the divergence was entirely the shared `ProjectConfiguration` node. *U-01 bearing: CONFIRMS. It is
C3's third target, and it closed as a SIDE EFFECT of the `typecheck.outputs` fix with no
`lint`-specific work, which is what the record predicted and labelled as a prediction.*

### D-35's Windows-side baseline, now measured on both legs post-fix

`07-EVIDENCE.md:505-513` flagged `options.cwd` as "the row most likely to diverge" and confirmed it
IS hashed. Re-measured at the fix commit on both runners:

| Hashed field | D-35 baseline (Windows) | `ubuntu-24.04-arm` | `windows-11-arm` | Agree? |
|---|---|---|---|---|
| `executor` | `nx:run-commands` | `nx:run-commands` | `nx:run-commands` | YES |
| `outputs` | `[]` | `[]` | `[]` | YES |
| `options.cwd` | `packages/github-cache` | `packages/github-cache` | `packages/github-cache` | **YES** |
| `options.command` | `eslint .` | `eslint .` | `eslint .` | YES |
| `configurations` | `{}` | `{}` | `{}` | YES |
| `cache` (inferred) | `true` | `true` | `true` | YES |

`options.cwd` is byte-identical, forward-slashed and project-relative on Windows as well as Linux.
The merged-node field diff confirms it independently: zero `value-changed` fields anywhere, so **the
merged project configuration diff does NOT touch the `lint` target at all**. Phase 7's
UNVERIFIED-BY-DESIGN question stays settled: `@nx/eslint` infers `lint` identically on both
operating systems, and the anchor's `lint` divergence was never `lint`'s own.

### Which branch of D-21 plan 08-06 must wire

**The PRIMARY branch. `lint` is asserted as a FOURTH IDENTICAL target, alongside
`build`/`typecheck`/`test`. The named fallback does NOT apply and its clause is NOT downgraded.**

D-21's fallback is conditioned on `lint` diverging AND its fix proving out of Phase 8's scope.
Neither half survives the measurement: `lint` is byte-identical across the legs at the fix commit,
and no `lint`-specific work was needed to get there. The prediction the record made in
`### Which branch of D-21 plan 08-06 must wire` above is CONFIRMED, and `compare.spec.ts`'s
`INVARIANT_TARGETS` block keeps its four-target form.

### No `nx.json` edit was made in this task

```
$ git show --stat <this commit>
 .planning/phases/08-nx-task-hash-parity/08-ROOT-CAUSE.md
```

One file. The `nx.json` hunk landed once, at `163e6b9`, and nothing since has touched it -- which is
what makes "we changed X and the hashes agreed" attributable to X rather than to an undirected search.
`npm run format:check` exits 0.

### Every pre-committed condition, evaluated

The four confirming conditions, the four live-triggers and the three non-triggers were all written
into `## U-01: the condition that would make it live` BEFORE the fix existed. Evaluated against the
measurement, quoted, one row each:

| ID | Pre-committed text (abbreviated) | Measurement that decides it | Verdict |
|----|----------------------------------|------------------------------|---------|
| **C1** | "the `ProjectConfiguration` node hash is IDENTICAL between a cold capture and a warm-preexisting capture on the workstation" | both `17377863611053487263`; the cold-vs-warm diff is 0 changed nodes on all five targets and 164/164 fields | **MET** |
| **C2** | "that same node hash is IDENTICAL between `ubuntu-24.04-arm` and `windows-11-arm`" | both `17377863611053487263` | **MET** |
| **C3** | "the cross-OS diff for `build`, `test` and `lint` shows ZERO `value-changed` nodes and ZERO `only-in-*` entries" | 0/0 on `build` (428 same), `test` (444 same), `lint` (443 same) -- and on `typecheck` too | **MET, exceeded** |
| **C4** | "`integration` still DIVERGES cross-OS, and its diff still shows `runtime:node -p process.platform` as a changed node" | differs; exactly one changed node and it is that one | **MET** |
| **L1** | "The node still differs between cold and warm-preexisting locally, after the entry lands" | identical; 0 changed nodes | **NOT met** |
| **L2** | "The node still differs between the two cold CI legs, after the entry lands" | identical on both legs | **NOT met** |
| **L3** | "The merged node's `targets.typecheck.outputs` does not take the declared value on at least one of the two operating systems" | merged value is byte-equal to the declared seven-entry list on BOTH legs, checked directly | **NOT met** |
| **L4** | "The node converges, but a DIFFERENT node or field starts diverging cross-OS in something `targetDefaults` cannot reach" | cross-OS `value-changed` is zero on four targets and exactly one on `integration` -- the DECLARED discriminator, which `targetDefaults` not only reaches but owns; zero `only-in-*`; 164/164 fields | **NOT met** |
| **N1** | "`typecheck` differing between a workstation that has BUILT and a runner that has not ... NOT a U-01 trigger" | workstation `8949082127832201885` vs runner `1284533355439392975`; the same-OS diff isolates it to ONE node, the `dependentTasksOutputFiles` entry over `dist/` | **occurred; correctly NOT a trigger** |
| **N2** | "An all-MISS push immediately after the fix commit ... the pre-recorded legitimate rotation window" | all five hashes rotated at `163e6b9`; every moving node accounted for in diff 1 | **occurred; correctly NOT a trigger** |
| **N3** | "`integration` diverging cross-OS. That is C4, the intended behaviour" | it diverges | **occurred; correctly NOT a trigger** |

**All four confirming conditions MET. No live-trigger met.** The three things that did occur are each
a pre-committed non-trigger, named in advance and matching the shape that was named.

**Which way the evidence points, in one line and no more:** all four pre-committed confirming
conditions are met and none of the four live-triggers is, so the measurement matches the confirming
condition written before the experiment.

**U-01 is NOT decided here.** Task 3 is a blocking `checkpoint:decision` and the selection is the
maintainer's. `08-RESEARCH.md`'s own instruction stands: the confirming experiment is not a licence
to treat U-01 as auto-resolved.

---

## U-01 RESOLVED

**Date:** 2026-07-28
**Selected option:** `confirm-d12` -- the fix location is settled inside `nx.json`.
**Selected by:** the maintainer, at plan 08-05's blocking `checkpoint:decision`, with both
re-measurements in hand.

### The maintainer's reasoning, recorded verbatim

> The trap quadrant is HIGH-impact AND NOT-HIGH-confidence; U-01 sat in it at discuss time purely
> for want of evidence, and no longer does. A falsifiable condition (L1-L4 / N1-N3) was committed to
> git BEFORE the experiment, the experiment ran on real runners, L3 was checked directly on both
> operating systems, and the outcome matched the pre-registered prediction. Auto-locking a measured
> outcome against a pre-registered condition is categorically different from auto-locking a bare
> default, which is the only thing the rule exists to prevent.

### Did the selection match the pre-committed condition?

**YES, and without departure.** The confirming condition was the conjunction C1 AND C2 AND C3 AND
C4, written into `## U-01: the condition that would make it live` at commit `eeace53`, before
`nx.json` had been touched by any commit in this phase. All four are MET and none of L1-L4 is; the
row-by-row evaluation with the deciding measurement for each is in
`### Every pre-committed condition, evaluated` above. The three things that DID occur -- `typecheck`
differing between a built box and an unbuilt runner, the all-MISS rotation, and `integration`
diverging cross-OS -- are each a pre-committed NON-trigger, named in advance and matching the shape
that was named. Nothing had to be reinterpreted after the fact, which is the whole point of writing
the condition down first.

### What this closes, and what it does NOT

**Closes:** D-12 is settled for this workspace. `nx.json` `targetDefaults` is a SUFFICIENT fix
location for the divergence this phase root-caused; the three escalation options U-01 named --
pinning the inferred target explicitly, patching plugin options, escalating upstream -- are not
needed and are not taken. Plan 08-06 wires the gate as designed, with `lint` on D-21's PRIMARY
branch.

**Does NOT close:** the finding that `@nx/js/typescript` classifies its own project references
differently on Windows and Linux. `nx.json` NORMALISES the symptom at the merged node; it does not
repair the inference. `08-RESEARCH.md`'s Finding 3 mechanism plus this record's two-leg confirmation
remain a strong basis for an upstream report, and `## U-01: the condition that would make it live`
already records that such a report is a legitimate FOLLOW-UP filed as its own piece of work rather
than carried in this phase's diff.

`08-CONTEXT.md`'s UNRESOLVED U-01 block is left AS WRITTEN. The resolution lives here, in the
record. Editing the context document after the fact would erase the evidence that the item was
genuinely open when the phase started, which is the property that makes this resolution worth
anything.

---

## CORRECTION: D-11's consequence is FALSIFIED, and the instrument was measuring outside the dependency chain

Raised while reviewing plan 08-05's checkpoint, reproduced independently here before being recorded.
This CORRECTS a conclusion this record itself reached in `## D-11: typecheck's third variance source,
ROOT-CAUSED` and shipped into the Phase 12 hand-off. It is recorded as a correction with its
evidence, in the same style as the D-10 supersession, rather than applied silently.

**Why it could not be left standing:** hand-off item 6 as written would have shipped a false
statement to every adopter of this project. That is the reason this correction is not optional.

### `typecheck` carries an INFERRED `dependsOn`, and that is the fact everything turns on

```
$ npx nx show project @op-nx/github-cache --json
build        dependsOn=["^build"]
typecheck    dependsOn=["build","^typecheck"]      <- INFERRED
test         dependsOn=["^build"]
integration  dependsOn=["^build"]
lint         dependsOn=undefined

$ git grep -n "dependsOn" -- nx.json
nx.json:49:      "dependsOn": ["^build"],       (test)
nx.json:90:      "dependsOn": ["^build"],       (integration)
```

`typecheck -> build` is produced by `@nx/js/typescript` and appears NOWHERE in `nx.json`, which is
why four plans of reading the config never surfaced it. Nx defers the hash of a task that depends on
another task's outputs until those outputs exist -- `hashTasksThatDoNotDependOnOutputsOfOtherTasks`
is the pass that arranges it -- so in a REAL run `typecheck` is hashed AFTER `build` has produced
`dist/`.

### Measured, on this workstation, at the fix commit

Two real runs, both `--skip-nx-cache`, each `run.json` copied immediately after its own `nx`
invocation with nothing interleaved (the Pitfall 2 discipline this record already requires):

| Starting state | `build` hash | `typecheck` hash |
|---|---|---|
| `dist/` and `out-tsc/` POPULATED | `17197827372395989528` | `8949082127832201885` |
| `dist/`, `out-tsc/` and `tsconfig.tsbuildinfo` DELETED first | `17197827372395989528` | `8949082127832201885` |

**Identical.** The pre-run state of `dist/` does not affect the hash a real `nx typecheck` run
computes, because `build` runs first either way and `typecheck` is hashed against what `build`
produced.

### What is falsified, and what is NOT

**NOT falsified -- the input contract.** `dist/` is gitignored, so it never entered the hash through
`default` or the file map; it enters only through the `dependentTasksOutputFiles` entry at
`nx.json:137`. That input is CORRECTLY modelled, because `build` genuinely IS a declared dependency
of `typecheck`. **`dist/` must not be removed from `typecheck`'s inputs.** Nothing about the
configuration is wrong.

**NOT falsified -- the D-11 decomposition table.** The table in `## D-11: typecheck's third variance
source, ROOT-CAUSED` is mechanically correct about why the INSTRUMENT saw four values: two binary
variables, four combinations, four values, no residue. It stays as written.

**FALSIFIED -- the consequence drawn from it.** The claim that "a developer running `nx typecheck`
on a box that has built will compute a different `typecheck` hash from CI even after the OS axis is
closed" is measured false above. The corrected paragraph is in place at that section, and Phase 12
hand-off item 6 is rewritten.

### The defect is in the MEASUREMENT, not in the configuration

`capture-hashes.mjs` calls `hashTask` directly on a single task, OUTSIDE the dependency chain
(`## Method` documents this construction; it is what makes the instrument a hasher rather than a
runner). For four of the five targets that is harmless -- `build`, `test`, `integration` and `lint`
do not depend on another task's OUTPUTS in a way that reaches their own hash. For `typecheck` it is
not harmless: the instrument observes a value real execution never produces.

Two consequences, both measured:

- **The workstation readings were RIGHT BY COINCIDENCE.** All three local post-fix readings report
  `typecheck = 8949082127832201885`, which is exactly the value a real run computes. They agree only
  because the battery had just run `build`, so `dist/` happened to hold precisely what `build`
  produces at this commit. A STALE `dist/` would have produced a third value that is equally
  unreal. The instrument does not know the difference, so this is not a property to rely on.
- **The `hash-parity` job recorded a value nothing computes.** Its deliberate no-build design
  produced `1284533355439392975` on BOTH legs. That number is internally consistent and cross-OS
  identical, and no developer and no real CI run will ever compute it.

**The cross-OS conclusion is unaffected.** Both legs were wrong in the SAME way, so the comparison
between them was still like-for-like, and the four verdicts stand. What was wrong is the ABSOLUTE
value of one row, not the equality it was being read for. This is worth stating plainly because it
is the difference between "the gate was measuring nothing" and "the gate was measuring the right
comparison at the wrong offset" -- it was the second.

### N1 and U-01 are untouched

N1 stays a pre-committed NON-trigger and the reasoning that put it there was sound: the difference
it names is real in the instrument's readings, it is not the OS axis, and it is not something
`targetDefaults` reaches. The correction narrows WHY it is not a trigger -- it is an artefact of
hashing outside the dependency chain rather than a developer-facing divergence -- and a non-trigger
that turns out to be even less alarming than believed does not disturb a verdict that was reached
without counting it. **U-01's resolution stands as recorded.**

### The gate must therefore measure inside the dependency chain

The `hash-parity` job's no-build design is replaced in the section below, with its original
rationale re-stated rather than quietly reversed.

---

## The hash-parity job now builds before capturing

**The change, at commit `56bb11d2a480695ccb30c60a661d327ae2669c11`:** one `- run: npm run build`
step in `.github/workflows/ci.yml`'s `hash-parity` job, placed after `npm ci` and before the capture.
`nx.json` is NOT touched -- the fix commit remains the single clean one.

**Symmetry is guaranteed by construction, not by discipline.** `hash-parity` is a MATRIX job, so
that one step definition is the step both legs run. There are no two copies to drift.

### The replaced decision, re-stated rather than reversed

The no-build design was DOCUMENTED in `ci.yml`'s own comment block and called "load-bearing rather
than a missing line". Its argument: `typecheck` declares a `dependentTasksOutputFiles` input
(`nx.json:137`) hashing the CONTENT of `packages/github-cache/dist/`, so a leg that built hashes a
populated directory while a leg that did not hashes an empty one; both legs must be IDENTICAL in that
respect, and "neither builds" is the identical option that is also the fastest.

**The symmetry requirement was RIGHT and is preserved verbatim.** The resolution was wrong. "Both
build" is equally symmetric, and it is the only one of the two options that measures a number any
machine actually computes. What the original missed is the INFERRED
`dependsOn: ["build", "^typecheck"]`, which appears nowhere in `nx.json` -- so the no-build leg was
not merely hashing an empty `dist/`, it was hashing `typecheck` OUTSIDE its dependency chain, which
is a state no real run passes through.

The comment block in `ci.yml` now carries both halves: the original rationale, what it missed, and
the measurement that settled it. It is the only place that rationale can live -- `ci.yml` is not a
`test` input, so a spec reading it would serve a stale cached PASS (PARITY-08, Phase 9).

### Both legs, re-measured at the job-fix commit

Workflow run [`30354448537`](https://github.com/op-nx/github-cache/actions/runs/30354448537),
`pull_request` on the same draft PR #9, whole run `success`, both legs `success`, no re-run.

Validated before reading, as before: `meta.commit` equals `56bb11d...` on both legs; `meta.commit`
does NOT equal `meta.githubSha` (`6def44fdc1ed033543515052887ecc04fcf49093`, the merge commit), which
is the checkout pin working; `installMode` is `ci` and `nxVersion` `23.1.0` on both;
`workingTreeClean` true on both.

```json
// ubuntu-24.04-arm                          // windows-11-arm
{ "os": "linux",                             { "os": "win32",
  "arch": "arm64",                             "arch": "arm64",
  "nxVersion": "23.1.0",                       "nxVersion": "23.1.0",
  "nodeVersion": "v24.18.0",                   "nodeVersion": "v24.18.0",
  "installMode": "ci",                         "installMode": "ci",
  "commit": "56bb11d...",                      "commit": "56bb11d...",
  "workingTreeClean": true,                    "workingTreeClean": true,
  "githubSha": "6def44f...",                   "githubSha": "6def44f...",
  "runnerOs": "Linux",                         "runnerOs": "Windows",
  "graphState": "warm",                        "graphState": "warm",
  "graphStateBasis": "workspaceDataEntries",   "graphStateBasis": "workspaceDataEntries",
  "workspaceDataEntries": 15,                  "workspaceDataEntries": 15,
  "nativeFileCacheEntries": 1,                 "nativeFileCacheEntries": 1,
  "daemonEnabled": false }                     "daemonEnabled": false }
```

| Target | `ubuntu-24.04-arm` | `windows-11-arm` | Identical? |
|--------|--------------------|------------------|------------|
| `build` | `17197827372395989528` | `17197827372395989528` | YES |
| `typecheck` | `8949082127832201885` | `8949082127832201885` | **YES -- new** |
| `test` | `1367622961810189968` | `1367622961810189968` | YES |
| `integration` | `11946835023040710407` | `1193647465557986036` | NO, by design |
| `lint` | `6930879416208693542` | `6930879416208693542` | YES |

Discriminators, raw and verbatim, `status: 0` on both:
`{ "stdout": "linux\n", "stderr": "" }` and `{ "stdout": "win32\n", "stderr": "" }`.

`ProjectConfiguration` node: `17377863611053487263` on both, unchanged.

### `graphState` changed from cold to warm, and that is named rather than glossed

The build step populates `.nx/workspace-data` before the capture runs, so both legs now record
`warm` with 15 entries where they recorded `cold` with 0. **Stated because D-04 exists to stop a
graph-state change being silently reclassified.**

It is admissible under the D-09 rule, which requires both legs to RECORD `graphState`,
`workspaceDataEntries` and `installMode` and to AGREE on all three: they agree exactly, `warm` / 15 /
`ci`. And it is `warm-FRESH`, not `warm-preexisting` -- the directory starts empty on a fresh runner
and is populated by this job's own build, which is the distinction `## The second axis is STALENESS,
not freshness` draws and the state that section measured to AGREE with cold.

**Proven inert rather than argued inert, by the control below.**

### The control: `ci.yml` is not an input, so only `typecheck` was allowed to move

`nx.json`'s `test` inputs list `{workspaceRoot}/.github/workflows/cleanup.yml` and NOT `ci.yml`
(`nx.json:68`), so the job-fix commit rotates no task hash. That makes this a clean experiment with a
built-in control, and both halves hold:

| Target | At `163e6b9` (cold, no build) | At `56bb11d` (warm, build) | Expected | Result |
|--------|-------------------------------|----------------------------|----------|--------|
| `build` | `17197827372395989528` | `17197827372395989528` | unchanged | PASS |
| `test` | `1367622961810189968` | `1367622961810189968` | unchanged | PASS |
| `lint` | `6930879416208693542` | `6930879416208693542` | unchanged | PASS |
| `integration` | `11946835023040710407` / `1193647465557986036` | same pair | unchanged | PASS |
| `typecheck` | `1284533355439392975` | `8949082127832201885` | MOVED | PASS |

Four targets byte-identical across a cold-to-warm graph-state change on both operating systems is a
direct, in-situ re-confirmation that a FRESH warm graph agrees with a cold one. Exactly one target
moved, and it is the one the build step was added for.

### The cross-OS diff at the job-fix commit

`node capture-hashes.mjs --diff <ubuntu> <windows>`, A = `ubuntu-24.04-arm`, B = `windows-11-arm`:

```
=== build       : 17197827372395989528 (A) vs 17197827372395989528 (B) === 0/0, 0 changed, 428 same
=== typecheck   : 8949082127832201885  (A) vs 8949082127832201885  (B) === 0/0, 0 changed, 429 same
=== test        : 1367622961810189968  (A) vs 1367622961810189968  (B) === 0/0, 0 changed, 444 same
=== lint        : 6930879416208693542  (A) vs 6930879416208693542  (B) === 0/0, 0 changed, 443 same

=== integration : 11946835023040710407 (A) vs 1193647465557986036 (B) ===
  nodes: 430 / 430    only-in-A (0): -    only-in-B (0): -
    value-changed (1):
        runtime:node -p process.platform
          A=11970638123438591088
          B=6694901896827773122
    same: 429

=== projectConfiguration (field level) ===
    only-in-A (0): -    only-in-B (0): -    value-changed (0): -    same: 164
```

**Four invariant targets, zero differing nodes each. `integration` differs by exactly one node and
it is the declared discriminator.** The four verdicts in `## Post-fix re-measurement (CI)` are
re-confirmed at the job-fix commit, with `typecheck` now carrying the real-run value.

### PARITY-05, re-checked and now stronger

`node capture-hashes.mjs --diff <workstation cold> <windows-11-arm>`:

```
=== build       : 0 changed, 428 same
=== typecheck   : 0 changed, 429 same      <- was 1 changed at 163e6b9
=== test        : 0 changed, 444 same
=== integration : 0 changed, 430 same
=== lint        : 0 changed, 443 same
=== projectConfiguration : 0 changed, 164 same
```

**Zero differing nodes on all FIVE targets between the native Windows workstation and
`windows-11-arm`.** At `163e6b9` this pair still differed on `typecheck` by the
`dependentTasksOutputFiles` node -- the N1 artefact. With `typecheck` hashed inside its dependency
chain on both sides, the two machines are now indistinguishable on every target. PARITY-05 was
already satisfied for `integration` alone; it is now satisfied trivially and with room to spare.

### `typecheck` converges FOUR ways, on the value a real run computes

| Observation point | `typecheck` |
|---|---|
| workstation, warm-preexisting | `8949082127832201885` |
| workstation, cold | `8949082127832201885` |
| workstation, warm-after-reset | `8949082127832201885` |
| `ubuntu-24.04-arm`, warm-fresh | `8949082127832201885` |
| `windows-11-arm`, warm-fresh | `8949082127832201885` |
| **a real `nx typecheck` run, both `dist/` states** | **`8949082127832201885`** |

The last row is the one that matters: the number the instrument now reports is the number Nx's own
runner writes into `.nx/cache/run.json`. That was not true before this change.

### PARITY-03's verdict, UPDATED

**PARITY-03 is SATISFIED, for all FOUR invariant targets rather than three.** The row in
`## Requirement coverage` is updated in place with a pointer here.

At one commit, `build`, `typecheck` and `test` -- and `lint` as D-21's fourth -- are byte-identical
across the native Windows workstation in BOTH graph states, `ubuntu-24.04-arm`, and
`windows-11-arm`. Four values per target, all four identical, on four targets:

| Target | workstation cold | workstation warm-pre | `ubuntu-24.04-arm` | `windows-11-arm` |
|--------|------------------|----------------------|--------------------|------------------|
| `build` | `17197827372395989528` | `17197827372395989528` | `17197827372395989528` | `17197827372395989528` |
| `typecheck` | `8949082127832201885` | `8949082127832201885` | `8949082127832201885` | `8949082127832201885` |
| `test` | `1367622961810189968` | `1367622961810189968` | `1367622961810189968` | `1367622961810189968` |
| `lint` | `6930879416208693542` | `6930879416208693542` | `6930879416208693542` | `6930879416208693542` |
| `integration` | `1193647465557986036` | `1193647465557986036` | `11946835023040710407` | `1193647465557986036` |

**One honest qualification on the commit spread.** The workstation columns were captured at
`163e6b9` and the runner columns at `56bb11d`. That is admissible for exactly the reason the control
above establishes: the intervening commits touch only `.planning/` and `ci.yml`, neither of which is
a declared input of any target, and the four targets that carry no build-output dependency are
measured byte-identical at both commits. The claim is not "all four columns share a SHA" -- it is
"all four columns share a TREE as far as every task hash is concerned", and that is measured rather
than asserted. A single-SHA capture of all four is available any time the workstation readings are
re-taken; nothing about the values would change.

**The record's earlier claim that "only THREE of the four values can ever be brought into agreement
by an `nx.json` change" is superseded.** It was right that `nx.json` cannot reach the build-output
variable. It was wrong that the variable had to remain -- the variable was an artefact of measuring
outside the dependency chain, and it was closed by fixing the MEASUREMENT rather than the config.
