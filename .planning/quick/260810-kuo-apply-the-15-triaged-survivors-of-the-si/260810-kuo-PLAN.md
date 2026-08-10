---
phase: quick-260810-kuo
plan: 01
type: execute
wave: 1
depends_on: []
autonomous: true
requirements: [A1, A2, A3, A4, A5, A6, A7, A8, A9, A10, A11, A12, A13, A14, A15]
files_modified:
  - capture-hashes.mjs
  - eslint.config.mjs
  - packages/github-cache/src/test/repo-file.ts
  - packages/github-cache/src/test/repo-file.spec.ts
  - packages/github-cache/src/backend/actions-cache-backend.spec.ts
  - packages/github-cache/src/lib/cache-key.spec.ts
  - packages/github-cache/src/lib/cache-archive-path.spec.ts
  - packages/github-cache/src/lib/compression-method.spec.ts
  - packages/github-cache/src/hash-parity/compare.spec.ts
  - packages/github-cache/src/capture-hashes-cli.spec.ts
  - packages/github-cache/src/read-integration-hash.integration.spec.ts
  - packages/github-cache/src/dogfood-cross-os.spec.ts
  - packages/github-cache/src/docs-cross-os.spec.ts
  - packages/github-cache/src/docs-same-os-claims.spec.ts
  - packages/github-cache/src/windows-regression-detector.spec.ts
  - packages/github-cache/src/nx-target-inputs.spec.ts
  - packages/github-cache/src/roundtrip/read-back.ts
  - packages/github-cache/src/roundtrip/read-back.spec.ts
  - .planning/quick/260810-kuo-apply-the-15-triaged-survivors-of-the-si/260810-kuo-deferred-items.md

must_haves:
  truths:
    - All 15 items A1..A15 are applied, or explicitly recorded as dropped with a measured reason.
    - No guard is weakened. Every guard that reddens is closed by changing the CODE, not the guard.
    - A3+A4 produce a hash record whose build, typecheck, integration and lint hashes are
      byte-identical to a pre-change record, with the test hash ROTATED.
    - A8's two derived needles are byte-identical to today's two literals.
    - A7 and A15 end with strictly more diagnostic power than they started with.
    - Every commit leaves all six gates green, so the sequence is bisect-safe.
    - nx.json is byte-unchanged.
  artifacts:
    - packages/github-cache/src/test/repo-file.ts exports packageSourceFiles, PACKAGE_SOURCE_ROOT
      and probeTokenOf, and memoizes readRepoFile.
    - .planning/quick/260810-kuo-apply-the-15-triaged-survivors-of-the-si/260810-kuo-deferred-items.md
      records U1..U9, each with evidence, fix shape and a written deferral reason.
    - A machine-checkable A3/A4 hash-identity proof that exits non-zero on failure and sits in
      task 2's automated gate.
  key_links:
    - repo-file.spec.ts's derived WORKSPACE_ROOT_WALK_EXCEPTIONS set equality is coupled to A5 and
      must be edited in the SAME commit.
    - repo-file.spec.ts's non-vacuity clause must be re-pointed at packageSourceFiles in A6's commit.
    - hash-parity/compare.spec.ts's `const TARGETS = [...]` regex extraction over capture-hashes.mjs
      must survive A3 and A4 unreflowed.
    - windows-regression-detector.spec.ts's needles must stay byte-identical across A8, so the
      workflow file is never touched.
---

<objective>
Apply the 15 ACCEPT rows (A1..A15) of the `/simplify` multi-agent cleanup review of PR #16, as
17 bisect-safe atomic commits, and open a v0.0.3 deferral record for the nine UNRESOLVED items.

Purpose: quality only -- reuse, simplification, efficiency, altitude. Two of the fifteen (A7, A8)
are guard STRENGTHENING and must land as such.
Output: 17 commits on `gsd/v0.0.2-os-invariant-cross-os-sharing`, plus a new deferred-items record.
</objective>

<decisions_taken_at_plan_time>

## A3 -- RESOLVED: KEEP, in RESEARCH.md's option (a) shape

The open decision was whether a partial lazy-load still pays. It does. Measured at plan time on the
main tree:

| Measurement | Result |
|---|---|
| Warm load of the six `nx/src/...` specifiers, three runs | 1507 ms / 687 ms / 767 ms |
| `node capture-hashes.mjs --nope` (argument rejection), three runs | 1063 ms / 1074 ms / 972 ms |
| `node -e "process.exit(0)"` (bare interpreter), three runs | 375 ms / 499 ms / 526 ms |

The decisive fact is the import inventory, not the timing: `capture-hashes.mjs`'s only other static
imports are `node:child_process`, `node:fs` and `node:url`. **Nothing else in the file pulls the Nx
subtree.** So moving all six behind `await import()` removes the subtree ENTIRELY from every path
that never reaches an Nx API -- it is not a partial lazy-load that leaves the heavy tree loaded by a
sibling specifier, which is the exact failure the decision rule was written to catch. The residual
spawn cost is bare-interpreter startup.

Roughly 0.5 s of each ~1.0 s rejection spawn is module load the rejection path never uses, and
`capture-hashes-cli.spec.ts` pays it 7 times.

**Shape (option (a), the smallest that covers all five consumers):**

- `capture()` and `assertGraphPremise()` are already `async` -- plain `await import()` inside each.
- `captureTargets()` is already `async` -- plain `await import()`, and A4's hoist lands in the same
  function.
- `measureGraphState()` becomes `async`. Its ONE caller is `capture():416`, already async, and it
  awaits the result immediately -- so the "MEASURED BEFORE the project graph is built (Pitfall 1)"
  ordering at that call site is preserved unchanged.
- `resolvedTaskIds()` stays SYNCHRONOUS and gains a third parameter, `createTaskGraph`. Its only two
  callers are both inside `assertGraphPremise()`, which awaits the import once and passes it to both.

Option (b) (make `resolvedTaskIds` async for no gain) and option (c) (a prime-once module cache whose
unprimed read is a silent `undefined`) are both rejected.

## A6 -- KEEP, in RESEARCH.md's reshape. CONTEXT G1's signature is superseded

CONTEXT G1 says the three walks "differ ONLY in the filter". Measured, they differ on THREE axes:
root resolution (cwd-relative string vs `import.meta.url` vs `repoFileUrl`), returned path shape
(prefixed vs bare), and filter (and copy 3's filter selects a genuinely disjoint set, not a variant
spelling). The extraction is still worth doing -- one walk primitive, per-caller path shape -- but it
carries a docstring correction that CONTEXT did not budget for. See task 4.

## A9 -- HALVED. The export STAYS

`read-back.spec.ts:363` pins `MIRRORED_BY_PREFIX`'s VALUE. Deleting the export deletes a live
assertion, which the no-guard-weakening rule forbids. CONTEXT G4 pre-authorised exactly this outcome
("if a spec pins it, leave the export and say so"). Only the two byte-preserving `read-back.ts`
call-site rewrites are in scope.

**Additional plan-time measurement, correcting RESEARCH.md's caution.** RESEARCH flagged
`read-back.ts` as a `DOCS_08_SITES` phrase-table subject and told the executor to read its row first.
Measured: `read-back.ts` is NOT a `DOCS_08_SITES` row. It appears at `docs-same-os-claims.spec.ts:712`
in `EDITED_FILES`, which feeds the producer-ATTRIBUTION retraction guard at `:891` -- a NEGATIVE
guard asserting the file does not co-locate a whose-bytes phrase with a producer word in one
sentence. A9 introduces neither. The edit is safe; the row-reading step is not needed.

## A15 -- KEEP, with the three-column table and the comment rewrite

The five assertions are not identical (target list, presence of a reason string, its text). The
in-code decision at `nx-target-inputs.spec.ts:1013-1015` argues against "one parameterised loop", and
`it.each` is not that -- it generates one `it` per row with the row in the title, so the localization
the comment demands is preserved. The comment must be REWRITTEN in the same commit to say so.

## Nothing is DROPPED

All 15 items are planned.

</decisions_taken_at_plan_time>

<execution_rules>

- **Main tree only.** Not a worktree -- a junctioned `node_modules` makes esbuild rewrite module paths
  so `check:action` reports false drift, and `check:action` is a required gate here.
- **`git commit -F <msgfile>`**, never `-m`. `git commit -m` fails on this Dev Drive with a
  COMMIT_EDITMSG "Invalid argument".
- **Stage by name.** Never `git add .` / `-A` / `-u`.
- **ASCII only.** No emoji, no em dash, no curly quotes, in code, comments or commit messages.
- **`git grep -n` for tracked files, `rg` for gitignored.** Never `grep`.
- **`nx.json` is BYTE-UNCHANGED.** If any item appears to need an `nx.json` edit, stop and report.
- **No guard may be weakened.** If a guard reddens, change the CODE. The one exception in this task
  is A5's exception list and A6's non-vacuity pointer, both of which are guards DESIGNED to be
  edited in the same commit as the change they track.
- **Per-commit gate.** The fast loop for most commits is the six-file vitest subset below (~1.2 s).
  The full battery runs at the task boundaries named in each task's verify block.
  `--reporter=basic` is unavailable in vitest 4.1.10; omit it.
- **A green `npm run <target>` may be a REPLAY.** Every one of these scripts is `nx run-many -t
  <target>`, so a warm `.nx/cache` replays a prior verdict rather than re-running the gate. Wherever
  a verify block is establishing a BASELINE or a FINAL state -- task 1 and the checkpoint -- append
  `--skip-nx-cache` (or export `NX_SKIP_NX_CACHE=true` for that run). Mid-task per-commit loops may
  use the cache; that is what it is for.
- **Treat each task boundary as a context checkpoint.** Land the task's commits, run its verify
  block, then re-orient before starting the next task rather than running all nine straight through.

```bash
npx vitest run --config packages/github-cache/vitest.config.mts \
  src/test/repo-file.spec.ts src/docs-cross-os.spec.ts \
  src/windows-regression-detector.spec.ts src/lib/cache-archive-path.spec.ts \
  src/lib/compression-method.spec.ts src/nx-target-inputs.spec.ts
```

</execution_rules>

<tasks>

<task type="auto">
  <name>Task 1: Pin the baseline and the eleven coupled guards BEFORE touching code</name>
  <files>(read-only; no commit)</files>
  <action>
Establish that every gate is green at HEAD before any edit, so a later red is attributable.

Run all gates with the Nx cache SKIPPED and record the counts -- a cached `npm run build` replays a
prior verdict and would make this baseline evidence of nothing:

```bash
npx nx run-many -t build typecheck test integration lint --skip-nx-cache
npm run format:check && npm run check:action && npm run fallow:ci
```

Then read, without editing, the eleven guards RESEARCH.md tabulates as reading the source text of
files this task touches. The point is that none of them surfaces later as a surprise red:

1. `test/repo-file.spec.ts` derived `WORKSPACE_ROOT_WALK_EXCEPTIONS` set equality -- coupled to A5.
2. `test/repo-file.spec.ts` non-vacuity clause -- coupled to A5 and A6.
3. `docs-same-os-claims.spec.ts` producer-attribution retraction guard over `EDITED_FILES` -- A9.
4. `docs-same-os-claims.spec.ts` ci.yml occurrence-count clauses -- A11 renames the alias they use.
5. `lint-scope-drift.spec.ts` loaded-object assertions over `eslint.config.mjs` -- A14.
6. `lint-rules.spec.ts` real-ESLint verdict assertions -- A14.
7. `hash-parity/compare.spec.ts` `const TARGETS = [...]` regex extraction over `capture-hashes.mjs`
   -- A3 and A4 must not reflow that declaration.
8. `hash-parity/compare.spec.ts` `INVARIANT_TARGETS` deep-equality -- the anchor A8 rests on.
9. `backend/actions-cache-backend.spec.ts` exact-array clauses over PREFIXED module paths -- A6.
10. `lib/cache-key.spec.ts` loop over BARE paths -- A6.
11. `test/repo-file.spec.ts` control suite for the spec primitives -- A6 and A10 add exports there.

`nx.json` is byte-unchanged for the whole task: record `git rev-parse HEAD:nx.json` now and assert
the same blob hash at the end.
  </action>
  <verify>
    <automated>npx nx run-many -t build typecheck test integration lint --skip-nx-cache &amp;&amp; npm run format:check &amp;&amp; npm run check:action &amp;&amp; npm run fallow:ci</automated>
  </verify>
  <done>All eight gates green at HEAD with test counts recorded, none of them a cache replay. The
  eleven guards are read and their coupling understood. The `nx.json` blob hash is recorded.</done>
</task>

<task type="auto">
  <name>Task 2: A3 + A4 -- capture-hashes.mjs, with the mandatory byte-identity proof (C1, C2)</name>
  <files>capture-hashes.mjs</files>
  <action>
This task MUST run with an otherwise clean working tree. Any other item's edit to a `test`-input file
rotates the `test` hash too and destroys the measurement signal.

**Step 1 -- capture BEFORE, at the clean pre-change tree.**

```bash
NX_DAEMON=false node capture-hashes.mjs --install-mode install --out /tmp/kuo-before.json
```

**Step 2 -- C1, A3: move the six `nx/src/...` static imports behind `await import()`.**

Delete all six static import lines. `node:child_process`, `node:fs` and `node:url` stay static.
Per consumer:

- `capture()` -- `await import()` for `nx/src/config/nx-json.js` (`readNxJson`) and
  `nx/src/project-graph/project-graph.js` (`createProjectGraphAsync`).
- `assertGraphPremise()` -- `await import()` for `nx/src/project-graph/project-graph.js` and
  `nx/src/tasks-runner/create-task-graph.js`.
- `captureTargets()` -- `await import()` for `nx/src/tasks-runner/create-task-graph.js` and
  `nx/src/hasher/create-task-hasher.js`.
- `measureGraphState()` becomes `async` and awaits `nx/src/native/native-file-cache-location.js`
  (`getNativeFileCacheLocation`) and `nx/src/utils/cache-directory.js` (`workspaceDataDirectory`).
  Its one caller at `capture()` becomes `const graph = await measureGraphState();` -- the
  Pitfall-1 ordering comment above it stays true and stays put.
- `resolvedTaskIds(projectGraph, targets, createTaskGraph)` gains a third parameter and stays
  SYNCHRONOUS. `assertGraphPremise()` awaits the import once and passes the binding to both call
  sites. Add one sentence to that function's existing block stating why the dependency is a
  parameter rather than an import: the function is the one sync consumer, and a parameter keeps it
  sync without a prime-once cache whose unprimed read would be a silent `undefined`.

Add a short comment at the deleted import site recording WHY: every argument-rejection path exits
before reaching any Nx API, and measured at plan time the six specifiers cost roughly 0.5 s of each
~1.0 s spawn while nothing else in this file pulls the Nx subtree.

**Do NOT reflow `const TARGETS = [...]`.** `hash-parity/compare.spec.ts` regex-extracts that
single-line array declaration and empties if it wraps.

Commit C1.

**Step 3 -- C2, A4: hoist `createTaskHasher` out of the per-target loop in `captureTargets()`.**

Construct the hasher ONCE above `for (const target of TARGETS)` and reuse it for every
`hashTask`. Both arguments (`projectGraph`, `nxJson`) are loop-invariant. Record in a comment that
this matches Nx's own usage -- `nx/dist/src/tasks-runner/run-command.js` constructs one hasher per
run and hashes every task with it -- and that with `NX_DAEMON=false` each construction was otherwise
building a fresh `NativeTaskHasherImpl` five times per capture.

Commit C2.

**Step 4 -- capture AFTER, and ASSERT.** The tree delta versus step 1 is now exactly A3 + A4.

```bash
NX_DAEMON=false node capture-hashes.mjs --install-mode install --out /tmp/kuo-after.json
```

Compare the HASH FIELDS, never whole records -- `capturedAt`, `commit`, `workingTreeClean` and the
whole `graphState` group vary unconditionally between any two captures, so a record diff false-fails.

**PATH TRAP, measured on this host -- do not simplify this back.** Git Bash MSYS-translates a POSIX
path passed as a bash ARGUMENT, but NOT one embedded inside the `node -e` script string. Measured:
`--out /tmp/kuo-before.json` writes to the Windows temp dir, while `require('/tmp/kuo-before.json')`
inside the script resolves to `D:\tmp\...` and throws MODULE_NOT_FOUND. Pass BOTH record paths as
argv so bash translates both sides identically, and read them with `readFileSync` + `JSON.parse`.
Verified: `node -e "console.log(process.argv[1])" /tmp/x` prints the same translated path the write
received. Never `require()` a POSIX-spelled path here.

Do NOT relocate the records under `.nx/cache/`. `actions-cache-backend.spec.ts` `rmSync`s that
directory, and this task's own verify runs `npm run test` -- which would delete the before-record
mid-task.

Write the assertion to a file and run it, rather than inlining it. **Put the file OUTSIDE the repo
working tree** (the session scratchpad, by absolute path) -- an untracked file inside the repo makes
`git status --porcelain` non-empty, and `capture-hashes.mjs` reads exactly that to set
`workingTreeClean` in the AFTER record. Write it with the Write tool, not a heredoc.

```js
// <scratchpad>/kuo-assert-hashes.mjs -- throwaway, outside the repo
import { readFileSync } from 'node:fs';

const load = (p) => JSON.parse(readFileSync(p, 'utf8'));
const a = load(process.argv[2]);
const b = load(process.argv[3]);
const same = (t) => a.targets[t].hash === b.targets[t].hash;

let ok = true;
const check = (label, pass, detail) => {
  if (!pass) ok = false;
  console.log(label.padEnd(22), pass ? 'OK' : 'FAIL', detail ?? '');
};

for (const t of ['build', 'typecheck', 'integration', 'lint']) {
  check(t, same(t), 'must be IDENTICAL');
}

check('test', !same('test'), 'must be ROTATED -- identical means the instrument is not a hashed input');
check('projectConfiguration', JSON.stringify(a.projectConfiguration) === JSON.stringify(b.projectConfiguration));
check('discriminator', JSON.stringify(a.discriminator) === JSON.stringify(b.discriminator));

// Informational only -- a count change is a signal to inspect, not a failure.
console.log('nodes-per-target      ',
  ['build', 'typecheck', 'test', 'integration', 'lint']
    .every((t) => Object.keys(a.targets[t].nodes).length === Object.keys(b.targets[t].nodes).length)
    ? 'SAME COUNTS' : 'DIFFERS -- inspect');

if (!ok) {
  process.exit(1);
}
```

Write the script to EXACTLY this absolute scratchpad path, and invoke it by that literal path:

```
C:/Users/LARSGY~1/AppData/Local/Temp/claude/D--projects-github-op-nx-github-cache/c823524a-6e92-43ae-a71a-0aa37440e4e9/scratchpad/kuo-assert-hash-parity.mjs
```

```bash
node C:/Users/LARSGY~1/AppData/Local/Temp/claude/D--projects-github-op-nx-github-cache/c823524a-6e92-43ae-a71a-0aa37440e4e9/scratchpad/kuo-assert-hash-parity.mjs /tmp/kuo-before.json /tmp/kuo-after.json
node capture-hashes.mjs --diff /tmp/kuo-before.json /tmp/kuo-after.json
```

**DO NOT put the script path in a shell variable (B3).** The Bash tool persists the working directory
but NOT environment variables, so a `KUO_ASSERT` defined in one invocation is EMPTY in the later
invocation that runs the verify chain -- and `node "" /tmp/a.json` was MEASURED on this host to exit 0
with no output. That degrades the tail of the verify chain to a silent success with the proof never
executed, which is B2 reinstated in the false-green direction. The literal path fails red if the script
is missing (`node <missing>` exits 1), which is the required behaviour.

Forward slashes are deliberate: the path is a bash argument, so it reaches node unmangled, and both
record paths translate the same way `--out` received them.

The script must EXIT NON-ZERO on failure and must appear in this task's `<automated>` chain. A
print-only comparator that exits 0 in every case means the gate passes both when the proof is never
run and when every required-identical hash differs -- which is the same class of silently-always-passes
defect this whole instrument exists to prevent.

A `test` hash that did NOT rotate is itself the defect -- it would mean the instrument is not a
hashed `test` input, the exact stale-PASS hole `capture-hashes-cli.spec.ts` records as closed.

Paste the assertion output into both commit message bodies (amend C1 and C2 if the proof is only
available after C2, or put it in C2's body and reference it from C1's).

If any of the four required-identical hashes DIFFERS: stop, revert both commits, and report. Do not
proceed and do not adjust the assertion.

**Gate note:** `fallow:ci` is the least obvious gate here -- a binding left in the top-level import
list with no remaining reference, or the reverse, is a finding. Run it on this task.
  </action>
  <verify>
    <automated>npm run test &amp;&amp; npm run lint &amp;&amp; npm run fallow:ci &amp;&amp; npm run format:check &amp;&amp; npx vitest run --config packages/github-cache/vitest.config.mts src/capture-hashes-cli.spec.ts src/hash-parity/compare.spec.ts &amp;&amp; node C:/Users/LARSGY~1/AppData/Local/Temp/claude/D--projects-github-op-nx-github-cache/c823524a-6e92-43ae-a71a-0aa37440e4e9/scratchpad/kuo-assert-hash-parity.mjs /tmp/kuo-before.json /tmp/kuo-after.json</automated>
  </verify>
  <done>Two commits. `capture-hashes.mjs` has zero static `nx/src/...` imports. The hasher is
  constructed once per capture. build, typecheck, integration and lint hashes are proven identical;
  `test` is proven rotated; `projectConfiguration` and `discriminator` identical. The
  `const TARGETS = [...]` extraction in `compare.spec.ts` is green.</done>
</task>

<task type="auto">
  <name>Task 3: A5 -- route three workspace-root walks through the layer (C3)</name>
  <files>packages/github-cache/src/hash-parity/compare.spec.ts, packages/github-cache/src/capture-hashes-cli.spec.ts, packages/github-cache/src/read-integration-hash.integration.spec.ts, packages/github-cache/src/test/repo-file.spec.ts</files>
  <action>
One commit. The exception list and the three rewrites are coupled by a DERIVED set equality -- edit
both halves together or the guard reddens by design.

Three rewrites:

- `compare.spec.ts:641`: `readFileSync(new URL('../../../../capture-hashes.mjs', import.meta.url), 'utf8')`
  becomes `readRepoFile('capture-hashes.mjs')`. `readRepoFile` is already imported in that file.
  Afterwards check whether `node:fs` is now an orphaned import there and drop it if so -- `lint` and
  `typecheck` catch it either way.
- `capture-hashes-cli.spec.ts:49`: `fileURLToPath(new URL('../../../capture-hashes.mjs', import.meta.url))`
  becomes `fileURLToPath(repoFileUrl('capture-hashes.mjs'))`. KEEP the `fileURLToPath` -- the path
  feeds `spawnSync`.
- `read-integration-hash.integration.spec.ts:91`: same shape, for `read-integration-hash.mjs`.

Do NOT touch `compare.spec.ts:758` -- it is a SIBLING-relative `new URL` with no `../`, so the
derivation regex never matched it and it is not in the exception set.

Then delete these three entries from `WORKSPACE_ROOT_WALK_EXCEPTIONS` in `test/repo-file.spec.ts`,
leaving three: `capture-hashes-cli.spec.ts`, `hash-parity/compare.spec.ts`,
`read-integration-hash.integration.spec.ts` go; `consumer-action-runtime.spec.ts`,
`docs-trust.spec.ts`, `governance-docs.spec.ts` stay.

The non-vacuity clause asserts the list length is above zero. Three remain, so it stays green and the
guard is NOT left vacuous -- its own message instructs the opposite action only at zero. Say that in
the commit message so a reviewer does not read the shrink as an erosion.
  </action>
  <verify>
    <automated>npm run test &amp;&amp; npm run integration &amp;&amp; npm run typecheck &amp;&amp; npm run lint &amp;&amp; npm run format:check</automated>
  </verify>
  <done>One commit. Three `new URL('../` walks are gone, the derived set equality is green with three
  remaining exceptions, and the non-vacuity clause is green.</done>
</task>

<task type="auto">
  <name>Task 4: A6 + A10 + A1 -- the spec-primitive module (C4, C5, C6)</name>
  <files>packages/github-cache/src/test/repo-file.ts, packages/github-cache/src/test/repo-file.spec.ts, packages/github-cache/src/backend/actions-cache-backend.spec.ts, packages/github-cache/src/lib/cache-key.spec.ts, packages/github-cache/src/lib/cache-archive-path.spec.ts, packages/github-cache/src/lib/compression-method.spec.ts</files>
  <action>
Three commits, all landing in `src/test/repo-file.ts` -- the package's one spec-primitive module. It
already houses `stripLineComments` and is vitest-free by hard constraint; keep it that way.

**C4, A6 -- the walk primitive.** Add to `repo-file.ts`:

```ts
export const PACKAGE_SOURCE_ROOT = 'packages/github-cache/src';
export function packageSourceFiles(predicate: (file: string) => boolean): string[];
```

`packageSourceFiles` walks `repoFileUrl(PACKAGE_SOURCE_ROOT)` recursively, normalises separators to
forward slashes, and returns BARE root-relative paths filtered by the caller's predicate. URL-anchored,
so it does not depend on cwd.

Then route the three copies:

- `backend/actions-cache-backend.spec.ts` -- its `nonSpecModules()` becomes
  `packageSourceFiles((f) => f.endsWith('.ts') && !f.endsWith('.spec.ts')).map((f) => \`${PACKAGE_SOURCE_ROOT}/${f}\`)`.
  Re-prefixing at the one call site that wants it is smaller than an options bag, and its three
  clauses assert on PREFIXED literals that must keep working.
  **Correct that function's docstring in this same commit.** It currently states, as a constraint,
  that the walk must be a function rather than a module-scope constant because the workspace-root cwd
  hook has not run at collection time. Routing through `repoFileUrl` REMOVES that cwd dependency, so
  the stated constraint no longer holds -- leaving it is exactly the false-canonical-claim defect
  `repo-file.ts`'s own header exists to prevent. Say what is true now: the walk is URL-anchored and
  cwd-independent, and the function form is retained because the callers read it lazily.
  Note also, in the commit message, that this does NOT remove that file's cwd-relative
  `readFileSync` calls on the walked paths -- those are left alone deliberately (smallest diff, still
  correct under the existing hook); routing them through `readRepoFile` is a separate decision.
- `lib/cache-key.spec.ts` -- same predicate, BARE paths, no prefixing. Its loop consumes bare paths.
- `test/repo-file.spec.ts` -- `packageModules()` has TWO callers in that file: the derived-set walk
  that the whole A5/A6 coupling rests on, and the non-vacuity clause. **Keep `packageModules()` as a
  one-line wrapper** over `packageSourceFiles((f) => f.endsWith('.ts') && !f.startsWith('test/'))`;
  do NOT inline it and re-point both call sites. The wrapper is the smaller diff, it keeps the name
  that the guards' own failure messages refer to, and the non-vacuity clause then covers the shared
  helper transitively -- so no clause needs re-pointing at all. (This supersedes RESEARCH.md's
  "re-point the non-vacuity clause" note, which assumed the wrapper would be removed.)
  That filter selects a DISJOINT set from the other two (it excludes the layer's own directory
  including non-spec files, and includes every `.spec.ts` elsewhere) -- parameterising the predicate
  is what makes one primitive serve all three.

**C5, A10 -- dedupe `probeTokenOf`.** Export the `cache-archive-path.spec.ts` version from
`repo-file.ts` -- it is a strict superset (the same bracket stripping, plus one word-boundary strip
applied first). Measured: neither `compression-method.spec.ts` needle contains a word boundary, so
the extra strip is a no-op on both and the tokens are byte-identical. Delete both local copies and
import the shared one.

The extracted helper's docstring must NOT spell any of the probed tokens verbatim -- both consuming
specs carry a "this file spells nothing verbatim" discipline and the helper now sits between them.

`repo-file.ts`'s stated discipline is that a primitive without a positive control is the defect one
layer down. The control already exists: both call sites carry a non-vacuity clause asserting the
needle matches its own derived probe token. Confirm both survive; if either does not, the shared
helper needs its own control in this commit.

**C6, A1 -- memoize `readRepoFile`.** A module-scope `Map<string, string>` keyed on the relative path
string, no invalidation. Cache SUCCESSFUL reads only -- `readRepoFile` throws on a missing path and
`docs-same-os-claims.spec.ts` documents relying on that throw, which a success-only memo preserves
because the throw re-fires on every call. Do not cache the thrown error.

Add the comment CONTEXT G2 requires, and state the measured evidence rather than asserting soundness:
`readRepoFile` is anchored on `import.meta.url`, and the complete set of filesystem writers under the
package source tree is five files, every one of which writes under `.nx/cache` or the OS temp dir --
disjoint from the read set. Name the one near-miss explicitly: the write that creates a file NAMED
`nx.json` targets a `mkdtemp` directory under `.nx/cache`, not the workspace-root `nx.json` that
`readRepoFile('nx.json')` resolves.

Do NOT memoize `repoFileUrl`. It returns a mutable `URL`, so handing one instance to two callers is a
new aliasing hazard for no gain.

**Add the control, in this same commit.** The throw-on-missing-path property is called load-bearing
above, and measured there is currently NO test asserting it -- `test/repo-file.spec.ts` contains zero
`toThrow`, and `readRepoFile` is a bare `readFileSync`. So a memo that cached a sentinel on the miss
path would ship green. Two clauses:

```ts
expect(() => readRepoFile('no-such-file.txt')).toThrow();
expect(readRepoFile('nx.json')).toBe(readRepoFile('nx.json'));
```

The first pins the throw the memo must preserve; the second pins that a repeated read still returns
equal content. This is the same discipline the shared `probeTokenOf` gets one commit over -- a
primitive without a positive control is the defect one layer down.

Callers are read-only content scans; the loop callers in three specs are what the memo helps, and
`.github/workflows/ci.yml` alone is read at four sites across four files.
  </action>
  <verify>
    <automated>npm run test &amp;&amp; npm run typecheck &amp;&amp; npm run lint &amp;&amp; npm run fallow:ci &amp;&amp; npm run format:check</automated>
  </verify>
  <done>Three commits. One walk primitive serves three callers with their own predicates and path
  shapes; the stale cwd docstring is corrected; one `probeTokenOf` serves two specs with its controls
  intact; `readRepoFile` memoizes successful reads and still throws on a missing path.</done>
</task>

<task type="auto">
  <name>Task 5: A2 -- memoize jobBlock and hoist its per-line RegExp (C7)</name>
  <files>packages/github-cache/src/dogfood-cross-os.spec.ts</files>
  <action>
One commit.

`jobBlock` is local and unexported, pure over the module-scope `codeLines` constant that is computed
once at module load and never reassigned, and nothing writes `ci.yml`. Memoizing is sound. It is
called roughly 80 times in this file.

Add a module-scope `Map` memo keyed on the job name. **Cache successful results only.** `jobBlock`
THROWS on an absent job key and that throw is load-bearing -- it is cited as the presence guard at
five sites. Do not cache `undefined` and return it.

Hoist the `new RegExp` out of the `findIndex` callback so it is constructed once per call instead of
once per line. It must stay INSIDE the function -- the pattern interpolates the job name, so module
scope is not available. Leave the second, already-literal regex alone.

**Add the control, in this same commit.** The throw is ungated today: all roughly 80 call sites pass
real job keys, so a memo that returned `undefined` on a miss would pass the entire suite while
silently disarming five presence guards. One clause closes it:

```ts
expect(() => jobBlock('no-such-job')).toThrow();
```

The file carries prose claiming `jobBlock` is the only job-block extractor and stays unexported. No
assertion enforces it, and this change keeps it true -- so the claim stays accurate and needs no edit.
  </action>
  <verify>
    <automated>npx vitest run --config packages/github-cache/vitest.config.mts src/dogfood-cross-os.spec.ts &amp;&amp; npm run test &amp;&amp; npm run format:check</automated>
  </verify>
  <done>One commit. `jobBlock` memoizes successful lookups, still throws on an absent key, and builds
  its interpolated pattern once per call.</done>
</task>

<task type="auto">
  <name>Task 6: A7 + A8 -- the two guard STRENGTHENINGS (C8, C9)</name>
  <files>packages/github-cache/src/docs-cross-os.spec.ts, packages/github-cache/src/windows-regression-detector.spec.ts</files>
  <action>
Two commits. Neither may be softened into a cosmetic edit.

**C8, A7 -- replace the cardinality gate with a parse over the fence.**

The gate counts occurrences of the discriminator command in the fence BODY as a flat string, under a
title claiming once per target. Measured, the count cannot localize: deleting one target key and
doubling another keeps it green. The fence is measured to be the only JSON fence in the document and
to parse.

Replace the count with: parse the fence, assert the `targetDefaults` KEY SET by equality, then assert
per target that the extracted runtime inputs equal exactly the one discriminator command. Use
`toEqual([command])` rather than `toContain` so BOTH presence and the exactly-once cardinality are
pinned per target -- the "exact count, never a floor" discipline is preserved, now at a level where it
can localize.

Reuse the existing `runtimeInputsOf` helper already in that file. Do not author a second extractor.
Its signature accepts an optional readonly unknown array, so the parsed `inputs` off the snippet
feeds it directly with no cast.

**Delete the now-orphaned `SNIPPET_DISCRIMINATOR_SITES` constant** in the same commit -- the count it
carried is what this change replaces, and leaving it standing leaves a stale claim next to the guard
that superseded it.

Keep the extraction control (exactly one JSON fence) unchanged -- without it a zero-fence document
would vacuously pass.

**Do not delete the surrounding comment block wholesale.** It carries the CR-01 history and the
"a green structural guard can sit over a wrong payload" lesson, which is the reasoning a future reader
needs. Rewrite it to state the new invariant and why the count was insufficient.

**Do not touch the sibling `it`** covering the bash verification fence. Different job, out of scope.

**C9, A8 -- derive the two detector needles from `INVARIANT_TARGETS`.**

The detector hardcodes the four target names twice while its own docstring cites `INVARIANT_TARGETS`
as canonical, so a fifth member would leave it silently four-of-five. Import `INVARIANT_TARGETS` from
`./hash-parity/compare.js` and build both needles by joining it.

Both join products are MEASURED byte-identical to today's literals, so this is a no-verdict-change
edit. The workflow file is NOT touched and both clauses must stay green.

The second site is a **RegExp literal**, so the derived form needs `new RegExp(...)`. The comment
above it asserts that the literal contains no metacharacter and can therefore only match
contiguously. That property now rests on the imported constant's members rather than on a literal --
**move the claim onto the constant** and say so. Do not leave a claim about a literal standing over a
computed regex.

Expect the new cross-directory import to be clean: the restricted-imports list covers only the
node builtin pairs, nothing intra-repo.
  </action>
  <verify>
    <automated>npx vitest run --config packages/github-cache/vitest.config.mts src/docs-cross-os.spec.ts src/windows-regression-detector.spec.ts &amp;&amp; npm run test &amp;&amp; npm run typecheck &amp;&amp; npm run lint &amp;&amp; npm run format:check &amp;&amp; git diff --exit-code -- .github/workflows/windows-regression-detector.yml</automated>
  </verify>
  <done>Two commits. The docs gate localizes per target key and pins exactly-once. Both detector
  needles are derived, byte-identical to the prior literals, with the metacharacter claim relocated
  onto the constant. The workflow file is unchanged.</done>
</task>

<task type="auto">
  <name>Task 7: A9 + A11 + A12 -- call sites, aliases, and one subsumed assertion (C10..C13)</name>
  <files>packages/github-cache/src/roundtrip/read-back.ts, packages/github-cache/src/roundtrip/read-back.spec.ts, packages/github-cache/src/docs-same-os-claims.spec.ts, packages/github-cache/src/hash-parity/compare.spec.ts</files>
  <action>
Four commits.

**C10, A9 -- call `mirroredByLabel` at the two `read-back.ts` sites.** Both sites build the label by
concatenating the prefix constant with the reader OS inside a template literal, so both are
byte-identical at runtime after the change. Swap `read-back.ts`'s import from the prefix constant to
the function.

**The export in `lib/mirrored-by-label.ts` STAYS.** `read-back.spec.ts:363` pins its VALUE, and
deleting the export would delete a live assertion. Record that in the commit message as the measured
outcome CONTEXT G4 pre-authorised, not as a miss.

Measured at plan time and no longer an open question: `read-back.ts` is NOT a required-phrase row in
the DOCS-08 table. It is in `EDITED_FILES`, which feeds the producer-attribution retraction guard --
a negative assertion that the file does not co-locate a whose-bytes phrase with a producer word in one
sentence. This edit introduces neither, so no phrase row needs updating.

Run `fallow:ci` on THIS commit specifically. The prefix constant loses its production reference and
its only remaining consumers become its own module and a spec. The precedent is good -- the config
credits spec imports, and two other exports are already spec-only-consumed and accepted today -- but
verify rather than assume. The module itself stays reachable regardless, being a declared entry point.

**C11, A11a -- delete the `read` alias in `docs-same-os-claims.spec.ts`.** It is a pure pass-through.
Rename its five call sites to `readRepoFile`. Three PROSE references to the alias elsewhere in the
file become stale in the same edit and must be updated in this commit -- one of them is load-bearing
prose describing that the function throws on a missing path.

**C12, A11b -- delete the `mirroredBy` alias in `read-back.spec.ts`.** Pure pass-through; rename its
eight call sites to `mirroredByLabel`, which is already imported there.

**C13, A12 -- delete the Prettier-import-shape assertion in `compare.spec.ts`.** It pins a
Prettier-produced multi-line import layout and reddens on a reformat that changes nothing semantic.

**The guard is not weakened, and the argument must be written down.** The very next assertion pins the
CALL. A source containing that call cannot compile without the import, and `typecheck` enforces that,
so the deleted clause is subsumed. The third clause -- the negative match on the unsanitised shape --
is untouched. Put the subsumption argument in the commit message. The surrounding comment still
describes the invariant correctly; leave it.

**Carry the failure message forward onto the surviving assertion.** The deleted clause is the only one
in that `it` with a message argument; the survivor is bare, so deleting the clause would silently cost
the whole `it` its diagnostic text. Add the trimmed rationale as the survivor's second argument --
that the call is what pins the import, and that `typecheck` is what makes the pin sufficient. This is
the same loss forbidden for A15's reason strings; the commit message is not a substitute for a
failure message.
  </action>
  <verify>
    <automated>npm run test &amp;&amp; npm run typecheck &amp;&amp; npm run lint &amp;&amp; npm run fallow:ci &amp;&amp; npm run format:check</automated>
  </verify>
  <done>Four commits. Both label sites route through the function; the prefix export survives with its
  value guard; two aliases and their stale prose are gone; one subsumed assertion is deleted with the
  subsumption recorded.</done>
</task>

<task type="auto">
  <name>Task 8: A13 + A14 + A15 -- spawn memo, ESLint flatMap, it.each table (C14, C15, C16)</name>
  <files>packages/github-cache/src/read-integration-hash.integration.spec.ts, eslint.config.mjs, packages/github-cache/src/nx-target-inputs.spec.ts</files>
  <action>
Three commits.

**C14, A13 -- hoist the duplicated accepted-fixture spawn.** Two sites each run a full `spawnSync` of
the same fixture through the same deterministic helper.

**Do NOT hoist to a describe-scope `const`.** Vitest evaluates describe bodies at COLLECTION time, so
that moves a `spawnSync` into collection, where a failure surfaces as a collection error rather than a
test failure -- destroying the framing of the first `it`, whose title is literally the control for
every rejection below. Use a two-line lazy memo, no hook:

```ts
let acceptedResult: ReturnType<typeof read> | undefined;
const acceptedRun = () => (acceptedResult ??= read(ACCEPTED));
```

Fixture filenames shift by one index for every later case; nothing asserts on them (tmpdir only).

**This spec runs under the `integration` target, not `test`.** `npm run test` does not exercise it.
Verify with `npm run integration` or the integration config directly, or the change ships unverified.

**C15, A14 -- collapse six restricted-import entries to a flatMap over three pairs.** Each pair is a
node builtin and its bare alias. The flatMap output must be deep-equal to today's six entries
INCLUDING each entry's message and import-name fields -- the ESLint verdict spec asserts behaviour,
and the structural spec asserts on the LOADED object and on the number of config OBJECTS, which this
does not change.

Run `npm run format` after -- Prettier owns the reformat of this file -- then `format:check`.

This rotates the `test` and `lint` task hashes, because `nx.json` lists this file in both targets'
inputs. That is expected and is NOT the deferred `nx.json` item: every item in this task edits tracked
source and rotates dependent hashes anyway. `nx.json` itself stays byte-unchanged.

**C16, A15 -- collapse five registration assertions to `it.each`.**

They are NOT five identical assertions. Use a THREE-column table -- target list, entry path, reason --
because four rows key on one target and the fifth keys on a different one, and three rows carry
bespoke reason strings today.

**Do not collapse the three bespoke reasons into one generic message.** Each names the SPECIFIC spec
that would replay a stale PASS, and the message is what a maintainer reads on a red. Write reasons for
the two rows that lack one -- that is guard strengthening, not scope creep, and it is the only way the
collapse is not a net loss of diagnostic text.

Interpolate the row into the test title so each row still fails under its own name.

**Rewrite the in-code decision comment in this same commit.** It argues against "one parameterised
loop over the pair" on the grounds that a combined failure would not say which list lost its entry.
`it.each` generates one `it` per row with the row in the title, so that localization is preserved --
say so. Leaving the comment unchanged would have the code visibly contradicting an argument sitting
next to it.

The five `it`s are separated by roughly 180 lines of dense explanatory blocks, each arguing why THAT
entry exists. **Those blocks are not interchangeable and must not be merged.** Leave every block
immediately above its own table ROW. All five are already inside one describe, so no merge is forced.
  </action>
  <verify>
    <automated>npm run integration &amp;&amp; npm run test &amp;&amp; npm run lint &amp;&amp; npm run typecheck &amp;&amp; npm run format:check &amp;&amp; git diff --exit-code -- nx.json</automated>
  </verify>
  <done>Three commits. The accepted fixture spawns once, lazily, outside collection time. Six
  restricted-import entries are produced by a flatMap with deep-equal output. Five assertions are one
  three-column `it.each`, every reason preserved or newly written, every explanatory block still above
  its own row, and the decision comment rewritten. `nx.json` unchanged.</done>
</task>

<task type="auto">
  <name>Task 9: Open the v0.0.3 deferral record for the nine UNRESOLVED items (C17)</name>
  <files>.planning/quick/260810-kuo-apply-the-15-triaged-survivors-of-the-si/260810-kuo-deferred-items.md, .planning/quick/260810-kuo-apply-the-15-triaged-survivors-of-the-si/260810-kuo-TRIAGE.md, .planning/quick/260810-kuo-apply-the-15-triaged-survivors-of-the-si/260810-kuo-RESEARCH.md</files>
  <action>
**Write a NEW file in this task's directory; do not append to the `260810-bxj` record.**

Reason, stated in the new file's header: the bxj file declares its own scope three times -- "In-scope
set for this task: 27 items" and "Deferred set: SEVEN items" in its opening lines, and 27 again in its
closing line. Appending two items from a DIFFERENT review falsifies all three. This repo's practice is
to supersede or cross-reference, never to back-edit a closed record. The new file cross-references the
bxj record as the sibling v0.0.3 lane and states that the seven bxj items (T4-1..T4-5, T4-7a, T4-8)
are unaffected and still stand.

**This deviates from CONTEXT `<canonical_refs>`, which says the two new items are "to be appended by
this task" to the bxj record. Say so explicitly in C17's commit message**, with the three falsified
counts as the reason. A deviation from a locked reference is legible or it is drift.

**Source: `260810-kuo-TRIAGE.md` in this same directory** (the `/simplify` triage ledger, now on
disk). Its `## UNRESOLVED` section carries all nine items with full bodies as bullets. Read U1..U9
from there; do not paraphrase from memory and do not re-derive. Commit the ledger alongside the
deferral record -- it is the provenance for both the 15 applied items and the nine deferred ones.

Also commit a one-line correction to `260810-kuo-RESEARCH.md`'s Q6 section, which is now known STALE:
it says `read-back.ts` is a `DOCS_08_SITES` phrase-table row and tells the reader to check its row
before editing. Measured: it is in `EDITED_FILES`, feeding the producer-attribution retraction guard --
a negative assertion. The sentence-splitter cannot move a boundary across either edited string
(neither contains a period or semicolon), so A9 is safe and no row-check is required. Correct it in
place so a v0.0.3 reader does not re-open the question.

**U3 -- the seed marker words leak this repo's own CI key families into the SHIPPED publish engine.**

`publish-mirror.ts:234` hardcodes three hex-letter marker words. Those words name this repo's
`consumer-smoke`, `dogfood-seed` and `mirror-seed` key families -- facts about THIS repo's `ci.yml` --
inside a module that `docs/advanced.md:156` tells adopters to wire into their own workflow. Confirmed
against `PROJECT.md:146`: "changes made for this repo's own CI/hashing must never leak into the
consumer contract." The fix relocates the skip to the `listCacheEntries` adapter seam that
`action/index.ts` already uses for ref-scoping policy, so the engine carries no repo-specific
vocabulary. Deferred because it is a seam change in the shipped consumer surface, not a defect fix,
and DEC-2 governs: a quick task fixes defects, it does not restructure.

**U5 -- `read-back.ts` re-authors the REST shard walk `releases-backend.ts` already has.**

Three independent reviewers flagged it, and the divergence is already MEASURABLE rather than
hypothetical: the month-boundary fix (window-spanning shard tags rather than a single shard tag) and
the asset-page ceiling have landed in ONE copy only -- `releases-backend.ts:227` still runs the
unbounded loop. The fix is a `lib/github-rest.ts` leaf, bundle-neutral by the same precedent that
produced `lib/mirror-seed.ts` and `lib/mirrored-by-label.ts`. Deferred because it is an extraction
across two production modules, which DEC-2 places outside a quick task.

Give each item its own second-level heading beginning `## U<N> -- `, and end each item's body with a
paragraph beginning `Deferred because` (both are the shapes the verify step counts -- headings alone
would let nine empty sections pass, which is exactly what this action forbids). For each of the nine,
record: the measured evidence, the proposed fix shape, and the written reason for deferral. Cross-reference `RETROSPECTIVE.md` Top Lesson #1 where the reason is that local gates
cannot prove GitHub Actions runtime behaviour.

Also record in this file: A9's export retention (the value guard that keeps it), A6's superseded
CONTEXT G1 signature, and the A3 measurement -- so a v0.0.3 reader does not re-open any of the three.
  </action>
  <verify>
    <automated>D=.planning/quick/260810-kuo-apply-the-15-triaged-survivors-of-the-si/260810-kuo-deferred-items.md; test "$(rg -o -N '^## U[1-9]\b' "$D" | sort -u | wc -l)" -eq 9 &amp;&amp; test "$(rg -o -N 'Deferred because' "$D" | wc -l)" -eq 9 &amp;&amp; git diff --exit-code -- .planning/quick/260810-bxj-address-the-27-verified-survivors-of-the/260810-bxj-deferred-items.md</automated>
  </verify>
  <done>One commit. A new deferred-items file records all nine UNRESOLVED items lifted from
  `260810-kuo-TRIAGE.md`, each with evidence, fix shape and a written deferral reason. The triage
  ledger and the RESEARCH.md Q6 correction are committed with it. The bxj record is provably
  untouched and its three scope counts remain true; the deviation from CONTEXT is recorded in the
  commit message.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>17 bisect-safe commits applying A1..A15, plus a v0.0.3 deferral record for U1..U9.</what-built>
  <how-to-verify>
1. `npx nx run-many -t build typecheck test integration lint --skip-nx-cache`, then `npm run format:check &amp;&amp; npm run check:action &amp;&amp; npm run fallow:ci` -- all eight green at HEAD on the MAIN tree. `--skip-nx-cache` is load-bearing: without it a warm `.nx/cache` replays a prior verdict and the final gate proves nothing.
2. `git diff --exit-code -- nx.json` and `git diff --exit-code -- .github/workflows/ci.yml` -- both silent.
3. `check:action` reports no bundle drift on every commit. No item touches a `serve()`-reachable
   source, so no bundle regeneration is expected -- drift here would mean something else moved.
4. Read the A3/A4 proof output in the commit body: four target hashes IDENTICAL, `test` ROTATED.
5. Confirm A7 and A8 read as STRENGTHENINGS in the diff, not as cosmetic edits.
6. Confirm the deferral record names all nine items with real content.
  </how-to-verify>
  <resume-signal>Type "approved" or name the items to revisit</resume-signal>
</task>

</tasks>

<verification>

Per-commit: the six-file vitest subset (~1.2 s) plus `format:check`.
Per-task: the gate set named in that task's verify block.
End of task: all eight gates uncached, `nx.json` blob hash equal to the value recorded in task 1.

Items whose gate exposure is easy to miss, so run them explicitly where named:

- `integration` (not `test`) is the only target that exercises A13's spec.
- `fallow:ci` is the gate for A3 (a stale or orphaned binding), A9 (an export losing its production
  reference), and A6 plus A10 (new spec-only exports).
- `lint` is the gate for A5 (an orphaned `node:fs` import), A8 (a new cross-directory import) and A14.
- `format:check` after `npm run format` is required for A14 -- Prettier owns that file's layout.

</verification>

<success_criteria>

- 17 commits, each green on all applicable gates, so `git bisect` is meaningful across the range.
- All 15 items applied. None dropped.
- No guard weakened. Every guard that reddened was closed by changing the CODE, except A5's exception
  list and A6's non-vacuity pointer, both designed to be edited alongside the change they track.
- A3/A4 byte-identity proof recorded in a commit body.
- A8's needles byte-identical; the detector workflow untouched.
- `nx.json` and `.github/workflows/ci.yml` byte-unchanged.
- The deferral record carries all nine UNRESOLVED items with real content.

</success_criteria>

<output>
Create `.planning/quick/260810-kuo-apply-the-15-triaged-survivors-of-the-si/260810-kuo-SUMMARY.md` when done.
</output>
</content>
</invoke>
