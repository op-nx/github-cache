# Phase 11: Live Proofs -- O1, O2, O3 - Pattern Map

**Mapped:** 2026-07-29
**Files analyzed:** 7 (2 files modified, 1 new evidence record, 1 optional new root instrument, 2 spec
guards, 1 CI file carrying two independent changes)
**Analogs found:** 7 / 7 -- every item has a shipped in-repo analog. **Zero files land in the
"no analog" bucket.** One named analog was CORRECTED (see `## Corrected Analogs`).

**How to read the CI citations.** `ci.yml` is 1269 lines and drifted ~220 lines inside one milestone,
so every `ci.yml` excerpt below is located by **JOB NAME plus quoted content**. Line numbers appear
only as a convenience anchor taken 2026-07-29 at `0bea74b` and must be re-found by content.

---

## File Classification

| New/Modified File | New/Mod | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|---|
| `capture-hashes.mjs` -- new task-graph assertion mode (D-12/D-13) | MOD | utility / dev-only CLI instrument | transform (resolved graph -> set -> verdict) | **itself**: `captureTargets` + `parseArgs` + the `diff` mode dispatch | exact (self-analog, same file, same call) |
| `.github/workflows/ci.yml` -- new probe steps inside the existing `integration` job (D-16, D-17a/b/c, D-21) | MOD | config / CI job | request-response (authed `curl`) + file-I/O (`tee`, `run.json`) | `integration` job's own `Wait for the loopback sidecar` step; `hash-parity`'s artifact upload | exact |
| `.github/workflows/ci.yml` -- new `o3-witness` job (D-17, sub-locks 3+4) | MOD (new job) | config / CI gate | request-response (REST) + batch compare | `hash-parity-compare` (whole job shape); `publish` (the `permissions` block) | exact |
| root-level `.mjs` that reads `.nx/cache/run.json` (OPTIONAL -- see `## Open Design Choice`) | NEW | utility / dev+CI script | file-I/O -> transform | `capture-hashes.mjs` (root-level, hash-neutral, throw-on-absent) | exact |
| `packages/github-cache/src/dogfood-cross-os.spec.ts` -- `o3-witness` job PRESENCE guard | MOD | test (config-assertion) | transform (YAML text -> job block -> assertions) | **itself**: `jobBlock()` + the three positive-control `it()`s | exact (self-analog) |
| `packages/github-cache/src/docs-same-os-claims.spec.ts` -- comment-prose lock for the new `ci.yml` rationale | MOD | test (content guard) | transform (raw file text -> phrase assertions) | **itself**: the `DOCS_08_SITES` rows keyed on file + quoted phrase | exact (self-analog) |
| `.planning/phases/11-live-proofs-o1-o2-o3/11-EVIDENCE.md` | NEW | documentation / evidence record | batch (transcription) | `10-EVIDENCE-PRE-RENAME.md` (control + provenance tables) and `10-EVIDENCE-LIVE-CI.md` (live-CI section shape) | exact -- two analogs, one per half |

Data artifacts the D-06 pre-flight emits -- `11-hashes-warm.json`, `11-hashes-cold.json` -- need no
pattern: they are `capture-hashes.mjs --out` output, and its writer is excerpted below.

---

## Corrected Analogs

**One correction, and it changes which file gets edited.**

The phase orientation named `packages/github-cache/src/docs-same-os-claims.spec.ts` as the analog for
"assert the witness job's presence by content so the new CI job is not a silently deletable gate."
That is the **wrong file for presence**, and the repo says so in its own words.

- `docs-same-os-claims.spec.ts` reads `ci.yml` **RAW** (`readFileSync` -> `toContain`). It is the
  right home for locking new COMMENT PROSE, and it is the only guard in the repo that can see a
  comment at all.
- `dogfood-cross-os.spec.ts` **strips every `#` line** before matching and extracts a single job's
  block via `jobBlock(name)`, which **THROWS when the job key is absent**. That throw IS the
  anti-silent-deletion mechanism. It is the right home for "the `o3-witness` job exists and has this
  shape."

The split is already documented in-tree, in `dogfood-cross-os.spec.ts`'s own header:

```
 * NO comment-phrase assertion belongs here. `codeLines` strips every `#` line, so a comment
 * lock placed in this file is vacuous by construction; XOS-07's comment lock lives in
 * `docs-same-os-claims.spec.ts`, whose read is raw.
```

and mirrored from the other side in `docs-same-os-claims.spec.ts`'s header:

```
 * `dogfood-cross-os.spec.ts` strips every `#` line before matching, so it
 * can assert the `needs:` VALUE -- it does, since this phase -- but structurally cannot
 * see the comment that explains the value. Two harnesses, one question each; there is
 * deliberately no third.
```

**Consequence for the planner:** the D-19 content guard is TWO edits in two files, not one. Presence
and shape -> `dogfood-cross-os.spec.ts`. New rationale prose -> `docs-same-os-claims.spec.ts`. Both
carry the same D-10 rotation cost (`test`/`typecheck`/`integration`/`lint`, NOT `build`), so both land
in the same post-proof wave and there is no reason to pick one to save hashes.

Everything else the orientation named was **CONFIRMED** as the closest analog.

---

## Pattern Assignments

### 1. `capture-hashes.mjs` -- new task-graph assertion mode (utility, transform)

**Analog: the same file.** This is not a new instrument; it emits a value the current code only uses
on its throw path. Match quality is exact by construction.

**Mode-dispatch pattern** -- copy this shape for the new mode, at the file's tail
(`capture-hashes.mjs:524-537`, the last statements in the file):

```js
const args = parseArgs(process.argv.slice(2));

if (args.diff) {
  if (args.installMode !== undefined || args.out !== undefined) {
    throw new Error(
      'capture-hashes: --diff is mutually exclusive with --install-mode and --out. ' +
        'Diff mode reads two already-captured records; it measures nothing.',
    );
  }

  diff(args.diff);
} else {
  await capture(args);
}
```

Note the house rule this encodes: a non-capture mode declares its **mutual exclusion with
`--install-mode`** explicitly and says why. The new mode measures no hash, so it must reject
`--install-mode` the same way `--diff` does, or the record shape lies.

**Flag-parsing pattern** -- hand-rolled, throws with a usage block on an unknown flag
(`capture-hashes.mjs:109-141`). Add one key to `parsed`, one `if` block, and one usage line:

```js
function parseArgs(argv) {
  const parsed = { installMode: undefined, out: undefined, diff: undefined };

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];

    if (flag === '--install-mode') {
      parsed.installMode = argv[index + 1];
      index += 1;
      continue;
    }
    // ... --out, --diff ...

    throw new Error(
      `capture-hashes: unrecognised argument \`${flag}\`. Usage:\n` +
        '  node capture-hashes.mjs --install-mode <ci|install> [--out <path>]\n' +
        '  node capture-hashes.mjs --diff <recordA.json> <recordB.json>',
    );
  }

  return parsed;
}
```

`ponytail: three flags, no arg library.` is the existing comment on that function -- keep the posture,
do not reach for an arg library for a fourth flag.

**The `createTaskGraph` call site to extend** (`captureTargets`, `capture-hashes.mjs:268-294`).
This is the exact call D-12 reuses with `targets = ['integration']`, plus the throw shape D-13's
non-vacuity assertions must mirror:

```js
async function captureTargets(projectGraph, nxJson) {
  const targets = {};

  for (const target of TARGETS) {
    // The second argument is `extraTargetDependencies`, a target-to-array map.
    // Passing `nxJson.targetDefaults` there throws `flatMap is not a function`.
    const taskGraph = createTaskGraph(
      projectGraph,
      {},
      [PROJECT],
      [target],
      undefined,
      {},
    );
    const taskId = `${PROJECT}:${target}`;
    const task = taskGraph.tasks[taskId];

    if (!task) {
      // Pitfall 4, and the direct analogue of Phase 7's `nx run-many -t
      // <missing>` learning: a deleted inferred target must NEVER read as
      // "measured, no difference".
      throw new Error(
        `capture-hashes: no task ${taskId} in the task graph -- the target was renamed, ` +
          'deleted, or its inferring plugin is not registered. Available: ' +
          `${Object.keys(taskGraph.tasks).join(', ')}`,
      );
    }
    // ... hashTask ...
  }

  return targets;
}
```

Three things to copy verbatim and one trap:

- `{}` as arg 2 -- the comment above it records the measured `flatMap is not a function` failure.
- `PROJECT` is DERIVED, never spelled: `JSON.parse(readFileSync(new URL('./packages/github-cache/package.json', ...))).name`
  (`capture-hashes.mjs:86-91`). It resolves to `@op-nx/github-cache`. Do not hardcode a task id.
- The failure message enumerates `Object.keys(taskGraph.tasks)` -- an absence must print the whole
  observed set. Copy this for the D-13 control failures too.
- **Trap:** the new mode asserts absence over the target SEGMENT, so split the task id on the LAST
  `:`. `PROJECT` is scoped, so a task id already contains structure a naive
  `taskId.includes('build')` misreads, and a future `@op-nx/github-cache:build-deps` would
  false-positive.

**Existence-guard pattern for a derived lookup** (`readDiscriminatorCommand`,
`capture-hashes.mjs:229-236`) -- the shape for "this thing MUST be here, and here are the suspects":

```js
  if (!entry) {
    throw new Error(
      'capture-hashes: no `runtime` entry in nx.json targetDefaults.integration.inputs. ' +
        'CORR-04 and D-14 require exactly one declared platform discriminator there -- ' +
        'suspect a deleted input entry, a renamed target, or an nx.json edit that ' +
        'landed before this measurement.',
    );
  }
```

**Evidence-output pattern** -- reuse `--out`, do not add a second output channel
(`capture-hashes.mjs:378-391`):

```js
  const serialised = `${JSON.stringify(record, null, 2)}\n`;

  if (args.out) {
    writeFileSync(args.out, serialised);
    process.stderr.write(
      `capture-hashes: wrote ${TARGETS.length} target records for ${PROJECT} ` +
        `(${record.meta.os}/${record.meta.arch}, ${record.meta.graphState} graph) to ${args.out}\n`,
    );

    return;
  }

  process.stdout.write(serialised);
```

Human-readable summary on **stderr**, machine-readable record on **stdout** or to `--out`. TEST-08
requires the assertion OUTPUT captured as evidence, so the verdict belongs in the stdout/`--out` JSON,
not only in a stderr line.

**Invocation pattern, and it costs nothing.** Root `package.json` already has
`"capture:hashes": "node capture-hashes.mjs"` (`package.json:16`), so `npm run capture:hashes -- <new-flag>`
works with **no `package.json` edit**. Editing root `package.json` would rotate `test`
(`{workspaceRoot}/package.json` is a `test` input). Do not add a new npm script.

**Do NOT copy** from this file: the EPIPE handler (`capture-hashes.mjs:63-67`) is already installed at
module scope and covers the new mode; and there is deliberately **no graph-state CLI flag** -- see the
`measureGraphState` doc comment, which spells out why the token is not written as a literal.

---

### 2. `.github/workflows/ci.yml` -- new probe steps in the `integration` job (config, request-response + file-I/O)

**Analog: the `integration` job's own `Wait for the loopback sidecar` step**, plus the `hash-parity`
job's upload step. Both are in the same file the edit lands in.

**Authed-`curl`-probe pattern** (job `integration`, step named `Wait for the loopback sidecar`,
`ci.yml:444-460`). This is the shape D-16 tightens:

```yaml
      - name: Wait for the loopback sidecar
        shell: bash
        run: |
          set -euo pipefail
          auth="Authorization: Bearer ${NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN}"
          code=000
          for _ in $(seq 1 30); do
            code=$(curl -s --max-time 10 -o /dev/null -w '%{http_code}' -H "${auth}" "${NX_SELF_HOSTED_REMOTE_CACHE_SERVER}/v1/cache/deadbeef" || true)
            if [ "${code}" = "404" ] || [ "${code}" = "200" ]; then
              break
            fi
            sleep 1
          done
          if [ "${code}" != "404" ] && [ "${code}" != "200" ]; then
            echo "sidecar not ready on ${NX_SELF_HOSTED_REMOTE_CACHE_SERVER} after 30 attempts (last status ${code}, wanted 404 or 200)" >&2
            exit 1
          fi
```

Copy exactly: `shell: bash` (the Windows leg's default is `pwsh` and fails on these constructs),
`set -euo pipefail`, `curl -s --max-time 10 -o /dev/null -w '%{http_code}'`, the `auth=` variable
built from the env var rather than interpolated, the failure message naming the **wanted** value, and
the hard `exit 1`.

Change exactly two things for D-16's positive control: the acceptance set becomes `{200}` ONLY (a
`404` there is a control FAILURE), and there is no retry loop -- the key is known-present because the
task's own `saveCache` just wrote it. **Do not collapse the two probes into one.** Two probes, two
acceptance sets, two questions: reachability vs. service round-trip.

**Step-ordering constraints inside the job**, all load-bearing:

- The existing tail is `- run: npm run integration` then `- cancel: cache-server` (`ci.yml:461-462`).
  New steps go BETWEEN them -- the control must run after the task (its key does not exist before) and
  before the sidecar is cancelled (the control goes through the sidecar).
- The `run.json` read must be the **immediately next** step after `npm run integration`. Every `nx`
  invocation overwrites `.nx/cache/run.json`. No convenience `nx` call in between.
- Give `npm run integration` an explicit `name:`. The `o3-witness` job selects the Windows step by its
  **rendered** name in the `jobs` REST payload (`Run npm run integration` today), and adding a `tee`
  changes that. An implicit rendered name is a silent coupling.

**Per-leg artifact upload pattern** (job `hash-parity`, `ci.yml:614-631`) -- the matrix-value-as-name
discriminator plus `if-no-files-found: error`:

```yaml
      - name: Capture the Nx task hashes on this runner
        shell: bash
        env:
          # Passed in through env rather than interpolated into the script body, so
          # the matrix value never lands on a command line the shell re-parses.
          RECORD: hash-parity-${{ matrix.os }}.json
        run: |
          set -euo pipefail
          node capture-hashes.mjs --install-mode ci --out "$RECORD"
      - uses: actions/upload-artifact@v7
        with:
          name: hash-parity-${{ matrix.os }}
          path: hash-parity-${{ matrix.os }}.json
          if-no-files-found: error
```

Two rules encoded here, both recorded in that job's leading comment block:

- `${{ matrix.os }}` reaches the script through `env:`, never interpolated into the `run:` body -- so
  the matrix value never lands on a command line the shell re-parses.
- `if-no-files-found: error` is not tidiness. The `ci.yml` comment states it: "the default is `warn`,
  so without it a leg whose instrument produced nothing uploads an EMPTY artifact ... A leg that
  measured nothing must fail ITS OWN leg." Same reason `upload-artifact@v7` pairs with
  `download-artifact@v8` here -- v4-onward names are immutable, so two legs on one name is an error,
  not a merge.

**Symmetry pattern** (job `hash-parity`, its own comment on the build step, `ci.yml:600-604`):

```
      # This is ONE step in a matrix job, so both legs get byte-identical treatment
      # by construction rather than by two copies staying in step.
```

D-17 requires both `integration` legs treated symmetrically with **no** `if: matrix.os == ...`. This
comment is the in-repo statement of why: one step in a matrix job is symmetric by construction; two
conditioned copies are symmetric only while someone maintains them.

**Env-var-into-`$GITHUB_ENV` + masking pattern** (job `integration`, step
`Pre-set the Nx cache client vars for the sidecar`, `ci.yml:429-436`), for reference only -- the token
is already `::add-mask::`ed there, and any new step that echoes env must not defeat it:

```yaml
      - name: Pre-set the Nx cache client vars for the sidecar
        shell: bash
        run: |
          set -euo pipefail
          echo "NX_SELF_HOSTED_REMOTE_CACHE_SERVER=http://127.0.0.1:3000" >> "$GITHUB_ENV"
          token="$(node -e 'process.stdout.write(require("crypto").randomBytes(32).toString("hex"))')"
          echo "::add-mask::${token}"
          echo "NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN=${token}" >> "$GITHUB_ENV"
```

---

### 3. `.github/workflows/ci.yml` -- the new `o3-witness` job (config, request-response + batch)

**Analog: the `hash-parity-compare` job** for the whole shape, and the **`publish`** job for the
`permissions` block. Both in the same file.

**Whole-job shape** (job `hash-parity-compare`, `ci.yml:747-780`):

```yaml
  hash-parity-compare:
    needs: hash-parity
    if: ${{ !cancelled() }}
    runs-on: ubuntu-24.04-arm
    # Generic hang insurance -- see the build job. Matches the non-matrix siblings at
    # 15 rather than the capture matrix's 20: this job installs, builds, downloads two
    # small JSON files and runs one node script.
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v7
        with:
          ref: ${{ github.event.pull_request.head.sha || github.sha }}
      - uses: actions/setup-node@v6
        with:
          node-version-file: '.node-version'
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - name: Create the records directory before the download
        shell: bash
        run: |
          set -euo pipefail
          mkdir -p hash-parity-records
      - uses: actions/download-artifact@v8
        with:
          pattern: hash-parity-*
          merge-multiple: true
          path: hash-parity-records
      - name: Compare the two records, and prove the comparison actually ran
        shell: bash
        run: |
          set -euo pipefail
          node packages/github-cache/dist/hash-parity/assert-parity.js hash-parity-records 2>&1 | tee hash-parity.log
          grep -q '^hash-parity: PARITY OK' hash-parity.log
```

Copy: `needs:` + `if: ${{ !cancelled() }}` (this file's house form -- the job's own comment records
why `!cancelled()` beats `always()`: "The two forms differ on exactly one case -- cancellation -- and a
cancelled run producing a red gate is noise, not signal"), a single ubuntu runner (not a matrix), a
`timeout-minutes`, `mkdir -p` BEFORE the download so the reader never ENOENTs, and the
`2>&1 | tee <log>` + anchored grep double signal.

Three rules attached to that grep, all from the job's own comment block and all load-bearing:

- **The grep is required ON TOP of the exit code.** "The pipeline's failure mode is the FIRST half --
  a non-zero exit from the bin fails the step under pipefail. The grep is the SECOND: it asserts the
  comparison actually RAN and PRINTED its verdict."
- **The `^` anchor is load-bearing, not tidiness.** Both streams are merged into one log, and failure
  detail interpolates values the downloaded record controls, so an unanchored match can hit a mid-line
  substring of the FAILURE line. Anchor the witness's success literal the same way.
- **Nothing in the `if:` may govern whether the job PASSES.** "the verdict comes from record CONTENT
  only, never from `needs.*.result`." There is deliberately no `needs.*.result` reference anywhere in
  that job -- keep it that way in the witness.

**Deviations from this analog the witness MUST make, each with its reason:**

| Deviation | Why |
|---|---|
| `needs: integration`, not `hash-parity` | D-17 sub-lock 1: on a `pull_request`, `hash-parity` pins `github.event.pull_request.head.sha` while `integration` takes checkout's default MERGE commit. The two measure DIFFERENT TREES. `H_linux` comes from the `integration` leg's own `run.json` |
| do NOT copy the `ref: ${{ github.event.pull_request.head.sha \|\| github.sha }}` pin | Same reason, inverted -- the witness judges the `integration` legs' artifacts, so it must not pin to a different tree than they used |
| drop `- run: npm run build` | `hash-parity-compare` builds because its comparator is TypeScript in `dist/`. The witness is `curl` + `jq`; a build step would only add ~20s and a failure surface. (Also drop `npm ci` unless a step actually needs `node_modules`) |
| ADD a job-level `permissions` block | The witness needs `actions: read`, which the workflow grant lacks. `hash-parity-compare` deliberately carries NO block, for the trap below |

**Job-level `permissions` pattern** (job `publish`, `ci.yml:1088-1094`) -- this is the ONLY job in the
file with a `permissions` block, and it exists precisely because it needs a scope the workflow grant
lacks:

```yaml
    # A job-level permissions block REPLACES the workflow grant (contents: read) WHOLESALE --
    # it does NOT merge. So this block MUST restate BOTH scopes: contents: write (create the
    # month-shard release + upload assets) AND actions: read (getActionsCacheList; omitting it
    # 404s the cache enumeration -- Pitfall 3). Least-privilege: exactly these two, nothing more.
    permissions:
      contents: write
      actions: read
```

The workflow-level grant it replaces is `ci.yml:9-10`:

```yaml
permissions:
  contents: read
```

So the witness block is `contents: read` + `actions: read`, with the restatement reason in a comment.
**The `contents: read` restatement is not optional** -- omit it and `actions/checkout` and
`actions/download-artifact` lose their grant.

The **inverse** rule is stated twice in this same file, and the witness must not trip it. From
`hash-parity` and again from `hash-parity-compare`:

```
  # NO JOB-LEVEL permissions BLOCK, for the trap recorded in full at :943-946: such a
  # block REPLACES the workflow grant WHOLESALE rather than merging it, so adding one
  # "to be explicit" silently drops scopes. The workflow-level contents: read (:9-10)
  # covers checkout plus an artifact upload, and this job requests no secret.
```

House rule, both readings consistent: **add a block only when you need a scope the workflow grant
lacks, and then restate everything you still need.**

**Credential pattern:** pass `${{ secrets.GITHUB_TOKEN }}` through the step `env:`, as the
`integration` job does for the sidecar action (`ci.yml:442-443`):

```yaml
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

No PAT, no new secret -- keeps the THREAT-MODEL ledger unchanged.

**Two-job producer-then-consumer precedent** (jobs `dogfood-seed` / `dogfood-verify`, leading comment
at `ci.yml:782-798`) -- the recorded reason a same-run same-process read-back is not evidence:

```
  # run id because a same-run, same-process read-back can succeed from local state
  # while the upload never reached GitHub's cache service -- two jobs prove the
  # bytes actually crossed the service.
```

This is the argument that makes the `integration` -> `o3-witness` split necessary rather than
stylistic: the witness reads the cache service's own metadata from a separate job.

**`consumer-smoke` naming trap** (job `consumer-smoke`, `ci.yml:944-949`) -- worth reading before
choosing any new cache key in this file:

```yaml
          # `cafe` prefix keeps the key valid hex (^[a-f0-9]+$) yet DISTINCT from the
          # dogfood-seed / publish `nx-cache-<run_id>` key. All three ubuntu jobs share
          # this run's Actions-cache scope; a bare run_id collides -- this job's PUT
          # would land in the very key dogfood-verify reads back (Actions cache is
          # first-write-wins), returning consumer-smoke's payload as wrong data.
```

The witness writes no cache key, so this is informational -- but it is the reason the run's cache
namespace already holds `cafe<run_id>`, `feed2<run_id>` and `feed0<run_id>` entries the witness's
`?key=` prefix filter will see.

---

### 4. Root-level `.mjs` reading `.nx/cache/run.json` (utility, file-I/O -> transform)

**Analog: `capture-hashes.mjs`.** Same tier, same boundary, same hash-neutrality argument.

**Why root-level is the pattern** (`capture-hashes.mjs:10-20`, its own header):

```
// WHY A ROOT-LEVEL DEV-ONLY SCRIPT RATHER THAN A MODULE OF THE PUBLISHED PACKAGE
// (D-01, two independent reasons; the second is the non-obvious one):
//   (a) it imports `nx/src/hasher/*`, and `nx` is a devDependency -- a shipped
//       module importing it would break every consumer install; and
//   (b) an Nx-CACHED instrument would REPLAY a stale record instead of
//       measuring, and a cached capture is not a capture. It is invoked
//       directly (`node capture-hashes.mjs`, the `capture:hashes` npm script,
//       the ci.yml capture job), never through `nx run`. The root package.json
//       declares `nx.includedScripts` as an EMPTY array, so adding that script
//       cannot create an Nx target -- D-01(b) is satisfied STRUCTURALLY, not by
//       discipline.
```

Reason (b) applies verbatim to a `run.json` reader: a cached reader would replay a stale hash. Reason
(a) becomes "this is measurement plumbing, not consumer surface" -- PROJECT.md's constraint that
"changes made for this repo's own CI/hashing must never leak into the consumer contract."

The in-repo root `.mjs` set is `capture-hashes.mjs`, `esbuild.action.mjs`, `eslint.config.mjs` -- all
three are dev/build tooling, none is in the package. A new root `.mjs` matches no `nx.json`
workspace-root input, so it rotates NOTHING and may land before the perishable proof.

**Throw-on-absent pattern** -- mandatory here, because Nx writes `run.json` inside a `try/catch` that
swallows every error unless `NX_VERBOSE_LOGGING`, so a missing file is SILENT. Mirror
`capture-hashes.mjs:285-294` (excerpted in section 1): enumerate what WAS observed in the failure
message (`Object.keys(...)` / `.map((t) => t.target)`), never default to an empty hash.

**Also copy** the `existsSync` + count helper shape from `directoryState`
(`capture-hashes.mjs:147-155`) if the new script needs a presence check, and the
"measured, never asserted" posture from the `measureGraphState` doc block.

**Do NOT copy:** the `spawnSync(command, { shell: true })` form from `runDiscriminator`. The reader
needs no shell. `git()` at `capture-hashes.mjs:208-213` is the fixed-argument, `shell:false` form to
copy if any git read is needed:

```js
/** Fixed-argument git read, shell false. Returns raw stdout. */
function git(...args) {
  return execFileSync('git', args, {
    cwd: fileURLToPath(new URL('./', import.meta.url)),
    encoding: 'utf8',
  });
}
```

---

### 5. `packages/github-cache/src/dogfood-cross-os.spec.ts` -- the `o3-witness` PRESENCE guard (test, config-assertion)

**Analog: the same file.** This is the corrected analog -- see `## Corrected Analogs`.

**Comment-stripped read + job-block extractor** (`dogfood-cross-os.spec.ts:49-77`). The `throw` is the
mechanism that makes a deleted job fail loud:

```ts
const codeLines = readFileSync(
  new URL('../../../.github/workflows/ci.yml', import.meta.url),
  'utf8',
)
  .split('\n')
  .filter((line) => !line.trim().startsWith('#'));

/**
 * One job's own block: from the `  <name>:` key (jobs are keyed at two spaces) up to
 * the next line at that same indent, exclusive. Throws rather than returning empty
 * when the job is absent, so a renamed or deleted job fails loud here instead of
 * silently satisfying the `not.toMatch` clause below.
 */
function jobBlock(name: string): string {
  const start = codeLines.findIndex((line) =>
    new RegExp(`^ {2}${name}:\\s*$`).test(line),
  );

  if (start < 0) {
    throw new Error(
      `ci.yml: no job keyed \`  ${name}:\` -- VER-06's guard cannot scope its assertions`,
    );
  }

  const rest = codeLines.slice(start + 1);
  const end = rest.findIndex((line) => /^ {2}\S/.test(line));

  return (end < 0 ? rest : rest.slice(0, end)).join('\n');
}
```

`jobBlock('o3-witness')` is the whole presence guard: delete the job and this throws. **Reuse the
helper; do not extract it to a shared module.** The file states why:

```
 * WHY IT LIVES IN THIS FILE. `jobBlock` above is the only job-block extractor in the repo.
 * Extracting it to a shared module so this guard could live elsewhere would be a NEW mechanism
 * built for one caller, which 10-RESEARCH's Don't-Hand-Roll table names as the smell. So the
 * guard comes to the helper rather than the helper going to the guard.
```

**Positive-control-first pattern** (`dogfood-cross-os.spec.ts:167-171`) -- every describe block in
this file opens with a control proving the extraction captured the RIGHT non-empty block:

```ts
  // POSITIVE CONTROL, and it comes first for the same reason the two controls above do. Every
  // clause below is a `toMatch`, so a `jobBlock` that returned the WRONG non-empty block would
  // have them asserting about the wrong job. This `if:` expression is unique to `publish` and
  // is real YAML, so it survives the comment strip.
  it('scopes to a real publish job block', () => {
    expect(jobBlock('publish')).toMatch(
      /^ {4}if:\s*\$\{\{\s*!cancelled\(\)\s*&&\s*github\.event_name == 'push'\s*\}\}$/m,
    );
  });
```

Pick a control literal for `o3-witness` that is real YAML unique to that job -- its
`runs-on: ubuntu-24.04-arm` is NOT unique (four jobs use it); its `permissions:` + `actions: read`
pair nearly is, and `needs: integration` is.

**Indent-anchoring pattern** (`dogfood-cross-os.spec.ts:173-189` and the `:135-138` comment):

```ts
  it('waits on build -- the SURVIVES clause, which a superset check cannot express', () => {
    expect(jobBlock('publish'), reason).toMatch(/^ {4}needs:.*\bbuild\b/m);
  });
```

```
 * Each pattern is anchored at `^ {4}needs:` -- a job's own keys sit one level under the
 * two-space job key -- so the token must appear ON the `needs:` line. Unanchored, `\bbuild\b`
 * would already be satisfied by this same job's `- run: npm run build` step and the guard would
 * be a tautology.
```

Two-space = job key, four-space = the job's own keys, six-space = under `strategy:`, eight-space =
step-level. `^ {4}permissions:` and `^ {6}actions: read` are the witness's anchors.

**Long `reason` string as the second `expect` argument** -- every assertion in this file carries one
naming what breaks and what to do instead. Copy that (`dogfood-cross-os.spec.ts:154-161`,
`:194-204`). Also copy the split-per-member discipline: separate `it()` per clause, so a mutation
shows its 3-of-4 split instead of stopping at the first failure.

**Stale-cached-PASS dependency**, stated in this file's own header (`dogfood-cross-os.spec.ts:44-47`):

```
 * This spec depends on `{workspaceRoot}/.github/workflows/ci.yml` being in
 * `nx.json`'s `targetDefaults.test.inputs` (PARITY-08, plan 09-01, `nx.json:69`).
 * Without it, `ci.yml` is not a hashed input and this spec replays a cached PASS
 * computed before its subject existed.
```

**CONFIRMED against the current tree this session:** `nx.json:69` is
`"{workspaceRoot}/.github/workflows/ci.yml"`, directly below `cleanup.yml` at `:68`. The registration
IS in place, so a `ci.yml` content guard cannot serve a stale cached PASS.

**Do NOT trust `ci.yml`'s own comment on this point.** The trailing comment above the `hash-parity`
job (`ci.yml:574-577`) and the identical one above `hash-parity-compare` (`ci.yml:742-746`) both say:

```
  # This comment block is the ONLY place that rationale can live. ci.yml is NOT in
  # nx.json's `test` inputs (only cleanup.yml is, nx.json:68), so a spec asserting on
  # this file's content would serve a stale cached PASS; registering it is PARITY-08,
  # deferred to Phase 9 so its hash rotation collapses into VER-01's window.
```

Both are **STALE and assert the OPPOSITE of current fact.** PARITY-08 landed. Do not propagate that
claim; if the plan corrects those two comment blocks it is a `ci.yml` edit and rotates `test`, so it
lands in the post-proof wave with the other `ci.yml` work.

---

### 6. `packages/github-cache/src/docs-same-os-claims.spec.ts` -- the comment-prose lock (test, content guard)

**Analog: the same file.** Right home for new RATIONALE PROSE in `ci.yml`, wrong home for job
presence.

**Raw read** (`docs-same-os-claims.spec.ts:4`, `:408-410`) -- no comment stripping, which is exactly
what lets it see a comment:

```ts
const WORKSPACE_ROOT_URL = new URL('../../../', import.meta.url);

function read(file: string): string {
  return readFileSync(new URL(file, WORKSPACE_ROOT_URL), 'utf8');
}
```

**Row shape** -- one entry per independently-deletable claim, keyed on FILE + QUOTED PHRASE
(`docs-same-os-claims.spec.ts:178-186` is the cleanest additive row to copy):

```ts
  {
    /**
     * ADDITIVE, XOS-06 clause (a). ... So the lock requires the status AND the mechanical reason for it:
     * ... A bare "not a correctness control" with no
     * reason is an assertion a reader can argue with; with the mechanism it is a fact.
     *
     * `forbidden` is EMPTY, and every XOS-06 row below shares that: these are ADDITIVE
     * locks on prose that did not exist before, so there is no old phrase to forbid ...
     */
    file: '.github/workflows/ci.yml',
    bucket: 'additive',
    required: [
      'NOT a correctness control (XOS-06)',
      'which OS leg wins the first-write-wins race',
      'Actions-cache entry and upload it VERBATIM',
    ],
    forbidden: [],
  },
```

**Assertion loop and its failure message** (`docs-same-os-claims.spec.ts:412-421`):

```ts
describe('every DOCS-08 site says what is true after VER-01/VER-03 (DOCS-08, OBS-04, XOS-07, D-31, D-32)', () => {
  for (const { file, bucket, required, forbidden } of DOCS_08_SITES) {
    describe(`${file} -- ${bucket}: ${required[0]}`, () => {
      for (const phrase of required) {
        it(`still contains \`${phrase}\``, () => {
          expect(
            read(file),
            `${file} no longer contains the exact phrase \`${phrase}\`. This table is keyed on FILE + PHRASE on purpose -- these six edits shift each other's lines in one commit, so a line number would rot. If the site was legitimately reworded, update its ROW here in the SAME commit; do not delete the assertion to make the suite green.`,
          ).toContain(phrase);
        });
      }
      // ... forbidden loop with .not.toMatch(pattern) ...
    });
  }
});
```

**Five rules the new rows must obey, all recorded in this file's own header:**

1. **EVERY PHRASE MUST FIT ON ONE LINE OF ITS FILE.** `read()` returns raw text, so a phrase spanning
   a hard wrap matches NOTHING and the row is a **silent false PASS in the additive direction**. The
   header says so in caps, and adds: "that is why the `ci.yml` phrases below look arbitrarily
   clipped: each was checked against a single comment line before being committed."
2. **`bucket: 'additive'` with `forbidden: []`** for new prose. Empty is the correct value and it is
   load-bearing, not lazy: "an absence check on the old ... phrase is SATISFIED BY DELETING THE WHOLE
   COMMENT, which is the failure this row exists to prevent."
3. **One row per independently-deletable clause**, not one row with nine phrases: "each survives or
   falls independently -- deleting the guard-sensitivity clause must redden something distinguishable
   from deleting the rejected argument."
4. **Require the REPLACEMENT REASON, not just the corrected claim.** The XOS-07 row requires "the
   mechanism, the bounded failure mode if that mechanism is ever wrong, and the run id the widening is
   justified by." For Phase 11 this maps directly onto D-17 sub-lock 2 (why absence-of-`[remote cache]`
   is RECORDED and never GATED) and onto the U-01 margin measurement -- and the house form for a
   measurement is `MEASURED 5/5 across the default-branch push runs on` + `run 30401077417` +
   `A measurement is not a documented guarantee` (the `:227-234` row).
5. **The single-character character-class contortion in `forbidden` patterns is deliberate** -- e.g.
   `/Restore is same-[O]S --/`, `/whose byte[s]/i`. "spelling a forbidden phrase plants it in the file
   that proves it is gone." Do not tidy it; and prefer additive rows so you never need it.

**Also extend `EDITED_FILES`** (`docs-same-os-claims.spec.ts:393-406`) with any new source file this
phase creates, in the SAME commit that creates it. The header records both the rule and the one time it
slipped by a commit. Note `read()` THROWS on a missing path, so an early entry blows up rather than
guards -- the entry and the file must land together.

---

### 7. `.planning/phases/11-live-proofs-o1-o2-o3/11-EVIDENCE.md` (documentation, batch)

**Two analogs, one per half.** D-22 wants ONE record with O1/O2/O3 sections and a RESERVED O4
section, so it takes the local-measurement shape from one file and the live-CI shape from the other.

#### 7a. Local measurement (O1/O2): `10-EVIDENCE-PRE-RENAME.md`

**Perishability header** (`10-EVIDENCE-PRE-RENAME.md:1-15`) -- machine identity, tree identity, and an
explicit expiry, before any measurement:

```markdown
# Phase 10: Pre-rename evidence (perishable measurements)

**Captured:** 2026-07-29
**Commit:** `06019d4` (branch `gsd/v0.0.2-os-invariant-cross-os-sharing`, UNMERGED)
**Machine:** native Windows arm64, `process.platform=win32`, Node v24.13.0, Nx 23.1.0
**Tree:** the **MAIN tree** at `D:/projects/github/op-nx/github-cache` (`.git` is a
directory, not a file -- NOT a git worktree, so no junctioned `node_modules` is in play)

Both measurements in this file are PERISHABLE and neither is recoverable later:
```

The "MAIN tree, not a worktree" line is not boilerplate -- it is what makes the measurement
attributable given this project's junctioned-`node_modules` hazard. Phase 11 adds the D-03 clock
(~2026-08-28) to the same position.

**Headline table before the detail** (`:21-32`) -- each half's verdict on one row, then the CAUSE:

```markdown
| Half | Result |
|---|---|
| Local Windows reader resolves a Windows-CI-produced mirror asset under the CURRENT `<hash>-<os>` name | **YES -- HTTP 200, 410 bytes**, hash `13758457399293023985` |
| Nx reports `[remote cache]` for `integration` on THIS branch's hash | **NO -- `Cache: 0/1 hit (0%)`** |
| Cause of the Nx-level MISS | This branch's four task hashes have **never been mirrored**. ... |
```

**The soundness control table -- D-08's calibrated instrument, verbatim** (`:73-91`). This is the
table to re-run and re-transcribe, not redesign. Note the third column: every row names which MISS
cause it eliminates.

```markdown
### Measurement soundness (established BEFORE any read)

The reader degrades **every** fault to a MISS, so a HIT is self-evidencing but a MISS is
not. Control rows reuse the prior record's table shape.

| Control | Result | Which MISS cause it eliminates |
|---|---|---|
| `gh auth token` through `runHelper`'s literal spawn shape (`shell:false`, `windowsHide`, no PATHEXT resolution) | exit 0, **RESOLVES**, len 40 (length only; the value was never recorded) | "no token -> reader returns `undefined` with zero fetches" |
| `git remote get-url origin`, same spawn shape | **RESOLVES**, `https://github.com/op-nx/github-cache.git` | "no repo identity -> reader cannot compose a URL" |
| `GITHUB_ACTIONS` / `GH_TOKEN` / `GITHUB_TOKEN` / `GITHUB_REPOSITORY` | all **UNSET** | wrong-branch selection |
| `isWriteTrusted(process.env).trusted`, read from the built `dist/lib/trust.js` rather than assumed | **false** -> `selectBackend` takes the off-CI branch -> `createReleasesReadBackend(createReleasesReadClient(env))` | proves WHICH backend served the read (the Releases mirror reader, not the Actions cache) |
| Bound URL read from the sidecar's OWN stdout (`resolvePort` silently falls back on a bad PORT) | `http://127.0.0.1:41999`, matches the value in `NX_SELF_HOSTED_REMOTE_CACHE_SERVER` | port mismatch making every task MISS |
| Wrong bearer | **401** | auth is live |
| No bearer | **401** | auth is live |
| Valid bearer, known-absent hash (`000000000000000000000000000000000000000f`) | **404** | the request reached a backend `get` (a 404 is a backend answer, not a routing failure) |
| Sidecar stderr | **0 bytes** across every probe and both Nx runs | no 401/403/429/5xx, no DNS fault, no download fault, no PUT-to-read-only-backend crash |
| Teardown | listening PID stopped; `Get-NetTCPConnection -LocalPort 41999 -State Listen` returns nothing; `curl` exit 7 | a leaked sidecar |
| Repo mutation | `git status --porcelain packages/ .github/ start-cache-server/` printed **nothing** | this plan edited no source |
```

Phase 11 adds one thing this table does not carry: TEST-10 requires the probe's TIMESTAMP recorded as
PRECEDING the first Nx run. Put it in the section heading, not buried in a row.

**Verbatim transcript pattern** (`:93-139`) -- fenced, ANSI stripped, otherwise byte-for-byte, with the
absence claim stated explicitly next to the output:

```markdown
Verbatim Nx output lines (ANSI stripped, otherwise byte-for-byte):

```
 NX   Successfully ran target integration for project @op-nx/github-cache

  Run duration:      961ms
  Cache:             0/1 hit (0%)
```

**There is NO `[remote cache]` marker on the task line.** `[remote cache]` is the only
discriminating label, and `Cache: 0/1 hit (0%)` is Nx's own end-of-run confirmation. The
task really executed (real 53ms vitest run, 961ms run duration) against the prior record's
1ms replay.
```

D-24 changes ONE thing here for Phase 11: every `Cache: n/m hit` line must be marked
**NON-DISCRIMINATING IN BOTH DIRECTIONS** beside the line. The analog above uses it as a
confirmation; Phase 11 must not.

**Per-hash probe table** (`:162-168`) -- the shape for the O1/O2 per-target result rows:

```markdown
| Target / source | Hash | Reader asked for | HTTP | Bytes |
|---|---|---|---|---|
| `integration`, local COLD at `06019d4` | `7907925174069363349` | `<hash>-windows` | **404** | 0 |
| **`integration`, the 2026-07-26 prior record's hash** | **`13758457399293023985`** | `<hash>-windows` | **200** | **410** |
```

**Candidate-cause elimination table** (`:180-185`) -- the shape D-07's contingency finding takes if the
cold hashes are absent: one row per candidate, `ELIMINATED` / `CONFIRMED`, and the eliminating evidence
named.

**Deviation-recording pattern** (`:52-71`, `### Method: COLD-DIRECTORY variant (a recorded deviation
from D-25's literal wording)`) -- if D-05's literal `nx reset` proves hazardous and the plan falls back
to the COLD-DIRECTORY variant, this is the section shape: name it a recorded deviation in the HEADING,
then number the reasons. "Three reasons, recorded rather than taken silently."

**Disposition section** (`:193-220`) -- numbered list of exactly what the NEXT phase inherits, with the
open preconditions labelled "a precondition, not a defect." Phase 11's equivalent is what Phase 12
inherits, including the RESERVED O4 section.

**Provenance table** (`:304-317`) -- the tail of the file, machine facts one per row:

```markdown
| Fact | Value |
|---|---|
| Commit | `06019d4` |
| Branch | `gsd/v0.0.2-os-invariant-cross-os-sharing` (unmerged) |
| Tree | MAIN tree, not a git worktree (no junctioned `node_modules`) |
| Node | v24.13.0 |
| Nx | 23.1.0 |
| Vitest | 4.1.10 |
| Platform | win32, arm64 |
| Source files changed by this capture | **none** (`git status --porcelain packages/ .github/ start-cache-server/` printed nothing) |
| Corroborating prior | `.planning/quick/260725-w3s-.../260725-w3s-STEP0-RESULTS.md` (2026-07-26, `bfd5143`) |
```

**Secret-hygiene pattern**, in that file's census section (`:228-230`) and its own commands block:

```markdown
Commands (counts and names extracted programmatically; **no raw `gh api` payload was pasted
here** -- some payload fields carry committer identity):
```

Also from the control table: `gh auth token` is recorded as "len 40 (length only; the value was never
recorded)". Never paste a raw REST payload into `11-EVIDENCE.md` -- this is a public repo.

#### 7b. Live-CI half (O3): `10-EVIDENCE-LIVE-CI.md`

**Push-and-restore provenance table** (`10-EVIDENCE-LIVE-CI.md:14-23`) -- the exact D-20 contract,
including the SHA-equality verification and the retained backup ref:

```markdown
| Item | Value |
|---|---|
| Observed run | `30471772954`, event `push`, branch `main` |
| Head commit | `180c3d3` (the phase-close commit) |
| `main` before | `fe25a3f` |
| `main` after restore | `fe25a3f` -- verified by SHA equality, not by assumption |
| Backup ref retained | `refs/heads/backup/main-before-phase10-verify` = `fe25a3f` |
| Run conclusion | `success` -- all 22 job legs green |
```

**Predict the restore run IN ADVANCE** (`:30-34`) -- so it is not read as an anomaly later:

```markdown
**The restore force-push itself fires a `push` run on `main`** (run `30473116345`, head
`fe25a3f`). That is expected and has precedent -- Phase 9's restore produced run `30401077417` the
same way.
```

**Pre-registered falsifier, quoted and then resolved** (`:63-68`) -- this is D-23's count discipline
in artifact form:

```markdown
**The falsifier was pre-registered and did NOT fire.** It read: "if the ubuntu leg reports
`mirrored: 0` with `readMisses == scanned`, the full-republish prediction is falsified and must be
recorded as such." Measured `readMisses` is **0** -- the ubuntu leg logged 16 `Cache hit for:`
restores and ZERO restore-MISS lines, with no all-restore-MISS warning anywhere in the job. The
prediction is confirmed, not rescued.
```

Copy the last sentence's posture: "confirmed, not rescued."

**Quoted job log lines as evidence** (`:83-86`, `:158-161`) -- fenced, prefixed with the job leg name:

```markdown
```
publish (ubuntu-24.04-arm): github-cache mirror-seed: stored feed230471772954 for this linux publish leg (PUT 200).
publish (windows-11-arm):   github-cache mirror-seed: stored feed030471772954 for this windows publish leg (PUT 200).
```
```

**Non-vacuity paragraph** (`:100-110`) -- states the count that would differ under the failure
hypothesis and that it was MET:

```markdown
**The non-vacuity condition was the one that mattered, and it was met.** The pre-registered
expectation was that `publish (windows)` must mirror exactly ONE asset -- its own seed -- and NOT
zero, because a zero would mean the per-leg seed never landed and OBS-05's detector would be
passing on nothing.
```

**Timing table for a job-ordering observation** (`:116-122`, `:138-143`) -- the shape for the O3
witness's `created_at` vs `started_at` record. Note the accompanying discipline in that file's XOS-06
section: "Strictly non-overlapping" is recorded as a MEASUREMENT, never as a guarantee.

**"What remains unobservable" closing section** (`:219-228`) -- explicit about what this record does NOT
close, and it hands the next phase its calibrated instrument by name. Phase 11's equivalent closes with
the RESERVED O4 section and what Phase 12 destroys.

---

## Shared Patterns

### S1. Fail-loud, never `continue-on-error` (all new CI steps and the witness job)
**Source:** job `hash-parity-compare`, its leading comment:
```
  # NO continue-on-error AND NO ADVISORY PERIOD (D-18). This job is build-gating from
  # its first commit. A later addition of continue-on-error would be invisible in a
  # green run, ...
```
**Apply to:** every new probe step and the witness job. Every failure path is a bare `exit 1` with the
observed value AND the wanted value in the message. No `|| true` except on a retry-loop's `curl`
inside a loop that checks the code afterwards (the readiness poll's exact form).

### S2. Exit code PLUS an anchored content assertion -- the double signal
**Source:** job `hash-parity-compare`'s final step; the rule's statement is in its comment ("THE GREP
IS REQUIRED ON TOP OF THE EXIT CODE (D-23)") and the original precedent is job `lint`.
**Apply to:** the witness's verdict, and to D-12's mode if it is ever wired into CI. Root cause the
precedent exists for: `nx run-many -t <missing>` prints "No tasks were run" and **exits 0**.
```bash
node <bin> ... 2>&1 | tee <log>
grep -q '^<literal success prefix>' <log>
```
**Two notes.** The `^` anchor is load-bearing (failure output interpolates attacker/record-controlled
values into the same log). And `ci.yml` uses `grep` here -- that is fine, it runs on a GitHub runner.
The project's `rg`-not-`grep` rule governs the LOCAL Windows arm64 box, so every local sweep in
`11-EVIDENCE.md`'s O1/O2 work uses `rg` (and `rg -o '\[remote cache\]' | wc -l` when you mean
occurrences, since `rg -c` counts LINES; `-F` or escaped brackets, since `[remote cache]` is a
character class as a regex).

### S3. `shell: bash` on every scripted step, plus `set -euo pipefail`
**Source:** every scripted step in `integration`, `hash-parity` and `hash-parity-compare`. The reason
is recorded on the `hash-parity` job:
```
  # shell: bash on the capture step, for the reason recorded at :399-404 -- GitHub's
  # DEFAULT shell on windows-11-arm is pwsh, which fails on the constructs this
  # file's scripted steps use. A bare `- run:` with no shell key inherits pwsh there.
```
**Apply to:** every new step in the `integration` job (both legs) and in `o3-witness`. `- uses:` and a
bare `- run: npm ...` need no shell key; anything multi-line does.

### S4. Non-vacuity companion for every absence assertion
**Sources, three shipped instances:**
- `dogfood-cross-os.spec.ts:80-85` -- `it('scopes to a real, non-empty job block -- the control that makes the no-matrix clause non-vacuous')`, with the comment "A `not.toMatch` against an empty string passes trivially."
- `capture-hashes.mjs:285-294` -- the missing-task throw, so a deleted target cannot read as "measured, no difference."
- `nx-target-inputs.spec.ts:150-161` -- the `filterUsingGlobPatterns`-returns-everything-on-an-
  empty-pattern-list trap D-13 exists to avoid. **This is the closest analog to D-13 in the repo**
  and it carries a lesson beyond the trap itself:

```ts
  // NON-VACUITY control, and it must be a NEGATIVE one. filterUsingGlobPatterns
  // starts with `if (positive.length === 0 && negative.length === 0) return files`
  // -- an empty pattern list returns the WHOLE probe list untouched. So every
  // toContain() above would pass together on a resolver that resolved nothing,
  // which is the same class of silent false pass this guard exists to prevent.
  // `build` is the discriminator: its inputs genuinely exclude specs, so this
  // assertion is true today and false the instant the filter stops filtering.
  it('does NOT hash the spec sources for build, proving the filter filters', () => {
    expect(hashedFilesFor('build')).not.toContain(
      `${PROJECT_ROOT}/src/index.spec.ts`,
    );
  });
```

  **The lesson, and it is the one D-13 needs most.** The SAME file needed a SECOND non-vacuity
  control for `lint`, and its comment records that the discriminator had to be re-chosen rather
  than copied (`nx-target-inputs.spec.ts:304-316`):

```ts
  // NON-VACUITY control for `lint`, and its discriminator had to be CHOSEN
  // rather than copied. `build` -- the discriminator the typecheck probes use
  // -- is unusable here: `lint` starting from `default` means hashing a spec is
  // exactly what it is SUPPOSED to do, so a build-shaped negative would assert
  // something false about this target. The honest negative is a probe path
  // outside `{projectRoot}`.
```

  That is exactly why RESEARCH.md rejects CONTEXT.md's parenthetical `nx run-many -t test` control
  in favour of `typecheck`: `test`'s `dependsOn` is `^build` (dependencies' build, of which there
  are none in this single-project workspace), so it resolves ONE task and clears bare vacuity
  without proving the resolver expands `dependsOn` at all. `typecheck` carries an INFERRED
  `dependsOn: ["build", "^typecheck"]`, so it resolves TWO tasks, one of them a member of
  `FORBIDDEN`. Assert the two-element expectation explicitly -- it is a property of the RESOLVED
  graph, so an Nx upgrade that changes the inference fails loud instead of quietly weakening the
  control.

**Apply to:** D-13's negative control (assert the control set is non-empty AND intersects `FORBIDDEN`
AND differs from the `integration` set); the witness's exact-`.key`-equality check (a prefix filter's
`total_count > 0` is not existence); and the `o3-witness` presence guard's positive control.

### S5. Correcting a claim requires supplying a REPLACEMENT reason
**Source:** `docs-same-os-claims.spec.ts`, the XOS-07 row (`:132-159`):
```
     * ... So a bare DELETION of the old argument would leave a future reader
     * holding a documented case for narrowing `needs:` straight back -- which is exactly
     * how Phase 9 shipped a regression. This row therefore requires the REPLACEMENT
     * REASON to be PRESENT: the mechanism, the bounded failure mode if that mechanism is
     * ever wrong, and the run id the widening is justified by.
```
**Apply to:** every `ci.yml` comment this phase touches, and to D-14's retraction wherever it appears
in `11-EVIDENCE.md`. If the plan corrects the stale `test`-inputs comment blocks, the correction must
carry the replacement fact (`nx.json:69`), not just delete the wrong one.

### S6. A tripwire that fires on correct work gets disabled
**Source:** job `publish`'s comment (`ci.yml:1069-1074`):
```
      # two must never be conflated -- a lost guard means a real defect goes unnoticed, not
      # that a wrong artifact reaches a developer. Naming the coupling is deliberate: a
      # tripwire that fires on correct work gets disabled, and OBS-04 is this repo's own
      # record of that.
```
**Apply to:** D-17 sub-lock 2 (absence-of-`[remote cache]` is RECORDED, never GATED -- it is FALSE on
a correct re-run at the same commit) and to the `runner.debug` guard step, which becomes a permanent
red once the `ACTIONS_STEP_DEBUG` variable is unset. Pre-register its removal.

### S7. Derive identifiers, never spell them
**Source:** `capture-hashes.mjs:80-91` -- `PROJECT` read from `packages/github-cache/package.json`'s
`name`; and `readDiscriminatorCommand`, which reads the discriminator string out of `nx.json` rather
than re-spelling it, "so this record cannot drift from the config."
**Apply to:** every task id (`@op-nx/github-cache:<target>` -- note the scope), the
`nx-cache-<hash>` key form, and any target list. Confirmed live this session: the project name in
`.nx/cache/run.json` is `@op-nx/github-cache`, not `github-cache`.

### S8. `import.meta.url`-relative paths in specs, never `__dirname` / `process.cwd()`
**Source:** both spec analogs -- `new URL('../../../.github/workflows/ci.yml', import.meta.url)`
(`dogfood-cross-os.spec.ts:49-51`) and `new URL('../../../', import.meta.url)` +
`new URL(file, WORKSPACE_ROOT_URL)` (`docs-same-os-claims.spec.ts:4`, `:408-410`). The idiom is named
in `dogfood-cross-os.spec.ts:24-25` as "the cleanup-workflow.spec.ts / pinned-deps.spec.ts idiom".
**Apply to:** any spec edit. Cross-cutting drift guards live at `packages/github-cache/src/*.spec.ts`
(the package-source root) because their subject spans multiple files -- both analogs state that
placement rule and cite `.planning/codebase/TESTING.md` for it. Do not create a subdirectory.

### S9. Timeouts on every job
**Source:** every job in `ci.yml` carries `timeout-minutes`, with a comment pointing at the
`build` job:
```yaml
    # Generic hang insurance -- see the build job. Matches the non-matrix siblings at
    # 15 rather than the capture matrix's 20: this job installs, builds, downloads two
    # small JSON files and runs one node script.
    timeout-minutes: 15
```
**Apply to:** `o3-witness`. It runs a checkout, a download and two `curl` calls -- 15 matches the
non-matrix siblings, and the comment should say what the job actually does, as this one does.

---

## No Analog Found

**Empty.** Every file in the classification table has a shipped in-repo analog. Three items are worth
naming as PARTIAL, because one clause of each has no precedent -- but the file-level pattern still
comes from the analog:

| Item | The clause with no precedent | What to do instead |
|---|---|---|
| `o3-witness` job | No workflow in this repo calls the GitHub REST API from a runner. All in-repo REST access is TypeScript in `dist/` via `@actions/*`, or a maintainer's local `gh`. Also **zero** `gh` invocations in any workflow -- the single `gh api` mention in `ci.yml` is inside a comment | Take the `curl` INVOCATION shape from the readiness poll (`-s --max-time 10 -w '%{http_code}'`, auth header from env) and the endpoints/fields/`jq` filters from `11-RESEARCH.md` `## U-01`, which measured them. D-17 sub-lock 4 already rejects `gh` |
| `o3-witness` fan-in over a matrix | `hash-parity-compare` is the only fan-in from a matrix's legs into one job, and it says so: "A reader looking for an in-repo precedent for the fan-in shape should read this sentence rather than go looking: there is none." | `hash-parity-compare` IS the precedent now -- it just has no precedent of its own |
| D-12's task-graph mode | No in-repo instrument asserts a property of a resolved task graph; `captureTargets` only hashes one | The `createTaskGraph` CALL is identical (`targets = ['integration']`). Only the assertion over `Object.keys(taskGraph.tasks)` is new, and its failure shape copies the existing throw |

---

## Rotation Cost per File (D-10, re-derived by research; drives wave order)

Reproduced here because it is the constraint that decides which pattern is applied WHEN. Verified
against `nx.json` by both CONTEXT.md and RESEARCH.md independently.

| File | Rotates | Wave |
|---|---|---|
| `capture-hashes.mjs` (MOD) | **nothing** -- no `{workspaceRoot}/*.mjs` glob exists in `nx.json` | may precede the proof |
| a NEW root-level `.mjs` | **nothing** -- same reason | may precede the proof |
| `.github/workflows/ci.yml` (MOD) | **`test` only** (`nx.json:69`) | AFTER the local proof |
| `packages/github-cache/src/*.spec.ts` (MOD) | **`test`, `typecheck`, `integration`, `lint`** -- NOT `build` (`nx.json:116` excludes `src/**/*.spec.ts`) | AFTER the local proof |
| root `package.json` | **`test`** (`nx.json:55`) | avoid entirely -- `capture:hashes` already forwards `--` args |
| `.planning/**` | **nothing** -- `.planning` appears in no named input | any time |

Three of the four proof targets die on a spec edit. Encode the order as `depends_on` in plan
frontmatter, never as prose.

---

## Metadata

**Analog search scope:** `.github/workflows/ci.yml` (job inventory enumerated, then `integration`,
`hash-parity`, `hash-parity-compare`, `publish`, `consumer-smoke`, `dogfood-seed` read);
`capture-hashes.mjs` (read in full); `packages/github-cache/src/*.spec.ts` (13 files enumerated,
`dogfood-cross-os.spec.ts` and `docs-same-os-claims.spec.ts` read in full); root `package.json`;
`nx.json` (`test` inputs confirmed); `.planning/phases/10-os-invariant-releases-mirror/10-EVIDENCE-PRE-RENAME.md`
and `10-EVIDENCE-LIVE-CI.md` (read in full).

**Files read in full:** 7. **Files scanned:** 19 CI jobs, 13 cross-cutting specs.

**Search tooling:** `git grep` for tracked-file searches (no `rg` fallback was needed -- nothing under
a gitignored path was searched). The Grep tool and `grep` were not used.

**Not read, deliberately:** `.planning/codebase/*.md` (mapped 2026-07-22 against v0.0.1; flagged stale
in PROJECT.md and STATE.md). The two spec analogs both cite `.planning/codebase/TESTING.md` for their
placement rule, and that CONVENTION is carried forward via their own headers rather than from the
stale map.

**Two in-tree claims contradicted by the current tree, both re-verified this session:**
- `ci.yml`'s `hash-parity` trailing comment and `hash-parity-compare` trailing comment both say
  `ci.yml` is NOT in `nx.json`'s `test` inputs. `nx.json:69` is
  `"{workspaceRoot}/.github/workflows/ci.yml"`. Both comments are STALE.
- `docs-same-os-claims.spec.ts`'s header already records the corrected fact under
  `HARD DEPENDENCY`, and `dogfood-cross-os.spec.ts:44-47` names `nx.json:69` explicitly. The specs are
  right; the `ci.yml` comments are wrong.

**Pattern extraction date:** 2026-07-29 at `0bea74b` (working tree clean).
