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
