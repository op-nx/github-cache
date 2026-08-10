---
phase: quick-260810-kuo
reviewed: 2026-08-10T15:25:37Z
depth: deep
files_reviewed: 18
files_reviewed_list:
  - capture-hashes.mjs
  - eslint.config.mjs
  - packages/github-cache/src/backend/actions-cache-backend.spec.ts
  - packages/github-cache/src/capture-hashes-cli.spec.ts
  - packages/github-cache/src/docs-cross-os.spec.ts
  - packages/github-cache/src/docs-same-os-claims.spec.ts
  - packages/github-cache/src/dogfood-cross-os.spec.ts
  - packages/github-cache/src/hash-parity/compare.spec.ts
  - packages/github-cache/src/lib/cache-archive-path.spec.ts
  - packages/github-cache/src/lib/cache-key.spec.ts
  - packages/github-cache/src/lib/compression-method.spec.ts
  - packages/github-cache/src/nx-target-inputs.spec.ts
  - packages/github-cache/src/read-integration-hash.integration.spec.ts
  - packages/github-cache/src/roundtrip/read-back.spec.ts
  - packages/github-cache/src/roundtrip/read-back.ts
  - packages/github-cache/src/test/repo-file.spec.ts
  - packages/github-cache/src/test/repo-file.ts
  - packages/github-cache/src/windows-regression-detector.spec.ts
findings:
  critical: 1
  warning: 5
  info: 4
  total: 10
status: issues_found
---

# Quick Task 260810-kuo: Code Review Report

**Reviewed:** 2026-08-10T15:25:37Z
**Depth:** deep
**Files Reviewed:** 18
**Status:** issues_found

## Summary

Range `4518787..HEAD`, 17 commits, +600/-346 across 18 source files. All eight gates were
re-run uncached during this review and are green (`build`, `typecheck`, `test` 1177/44,
`integration` 15/3, `lint`, `format:check`, `check:action`, `fallow:ci` 0 issues).

The two changes the brief ranked highest -- the `readRepoFile` / `jobBlock` memos and the
`capture-hashes.mjs` lazy-import refactor -- hold up under adversarial reading, and the two
declared strengthenings (A7, A8) are genuinely stronger. Details of what was verified rather
than assumed are in "Verified clean" at the end; that section is not padding, it is the part of
the diff a re-review does not need to redo.

The defects are concentrated in the places the task changed a guard or a claim ABOUT a guard
rather than the mechanism under it:

- One assertion (A12) was deleted on a subsumption argument that is provably false, leaving the
  invariant its own surrounding comment names as unguarded -- and the false argument is now
  embedded in the failure message a maintainer reads on a red.
- A3 removed, as an unrecorded side effect, the only local gate on the six internal `nx/src/*`
  subpaths the instrument depends on. Nothing in the eight-gate battery now loads any of them.
- A7's replacement guard re-spells its target list twice, reproducing at a smaller scale the
  exact "hardcoded twice while a canonical constant exists" hole that A8 was written to close.
- Two docstrings elsewhere in the package were falsified by A9 and A6 and not updated.

## Critical Issues

### CR-01: A12 leaves the `collapseToOneLine` single-choke-point unguarded, behind a false subsumption argument

**File:** `packages/github-cache/src/hash-parity/compare.spec.ts:818-824`
**Issue:**
A12 deleted `expect(assertParitySource, ...).toContain('import {\n  collapseToOneLine,')` and
carried its message onto the surviving call assertion, adding:

> `THE CALL IS WHAT PINS THE IMPORT: a source containing this call cannot compile without importing the symbol, and 'typecheck' is what makes that pin sufficient -- which is why no separate assertion on the import STATEMENT is needed here.`

That claim is false. A locally declared `function collapseToOneLine(s: string) { return s; }` in
`assert-parity.ts` compiles cleanly, satisfies the surviving
`toContain('collapseToOneLine(error instanceof Error ? error.message : String(error))')`, and
passes every gate:

- `typecheck` -- the name resolves, to the local declaration.
- `lint` -- `no-restricted-imports` covers node builtin pairs only.
- `fallow:ci` -- `compare.ts`'s export keeps a consumer at `compare.spec.ts:835`, so it is not
  dead.
- the third clause (the negative match on the unsanitised interpolation, `:825-831`) is about a
  different shape entirely.

The deleted clause was the ONLY thing in the repo distinguishing "imported" from "re-authored
locally" -- which is precisely the failure the surrounding comment at `:805-809` says this
assertion exists to prevent ("a second authored copy is how the single choke point stops being
single"). Verified: `git grep -n "assert-parity" -- packages/github-cache/src` shows no other
guard reading that file's imports. So the guard IS weaker than before, against the plan's own
non-negotiable, and the compensating argument recorded in-file is wrong.

Note the deleted literal also had a real defect -- it pinned Prettier's multi-line layout and
nothing about the module specifier. The fix is not to restore it verbatim.

**Fix:** restore a reformat-proof import pin that also closes the gap the old literal left (the
`from` clause), and correct the message.

```ts
expect(
  assertParitySource,
  'assert-parity.ts must IMPORT `collapseToOneLine` from ./compare.js, not re-author it. ' +
    'The call assertion below cannot tell the two apart: a local declaration of the same ' +
    'name compiles, satisfies the call, and passes lint and fallow -- at which point ' +
    'compare.ts is no longer "THE SINGLE PLACE untrusted record content is neutralised". ' +
    'Asserted as a pattern rather than a literal layout so a Prettier reflow of the import ' +
    'block cannot redden it.',
).toMatch(/import\s*\{[^}]*\bcollapseToOneLine\b[^}]*\}\s*from\s*'\.\/compare\.js'/);
```

Then drop the `THE CALL IS WHAT PINS THE IMPORT ...` sentence from the call assertion's message
at `:818-821`; it is the false half.

## Warnings

### WR-01: A3 removed the only local gate on the six internal `nx/src/*` subpaths, unrecorded

**File:** `capture-hashes.mjs:59-76`, `packages/github-cache/src/capture-hashes-cli.spec.ts:64-260`
**Issue:**
Before A3, all six `nx/src/...` specifiers were static, so a moved or renamed internal subpath
failed at MODULE LOAD on every invocation -- and `capture-hashes-cli.spec.ts` spawns the script
ten times, so all ten went red immediately and locally. After A3 the imports sit inside
`capture()`, `captureTargets()`, `assertGraphPremise()` and `measureGraphState()`, none of which
any of those ten tests reaches: nine are argument-rejection paths that throw before the first
`await import`, and the tenth group is `--diff`, whose `diff()` is a local JSON comparator with
no Nx edge (`capture-hashes.mjs:1014-1022`).

Cross-checked the rest of the battery: `nx-target-inputs.spec.ts:3-11` imports a DISJOINT set of
subpaths, and its one overlap (`nx/src/config/nx-json.js`) is `import type`, which erases. So all
six deferred specifiers are now unexercised by `build`, `typecheck`, `test`, `integration` and
`lint`. The instrument can be broken by an Nx upgrade and the whole eight-gate battery stays
green until the CI hash-parity capture job runs.

This directly contradicts the reasoning `pinned-deps.spec.ts:154-168` recorded when it closed the
matching hole -- "a widened range ... could break BOTH the instrument and this suite at import
time -- loudly, which is the desired failure mode". The loud half is gone. Severity is Warning
rather than Critical only because `nx` is exact-pinned and the lockfile is honoured by `npm ci`,
which is the same bound `pinned-deps.spec.ts` already argues.

**Fix:** add one clause that resolves the specifiers, deriving the list from the instrument's own
source so it cannot drift -- the house pattern already used for `const TARGETS` at
`compare.spec.ts:638`.

```ts
// In capture-hashes-cli.spec.ts. A3 moved these six behind `await import()`, so no clause in
// this file reaches them any more; they are internal subpaths with no semver guarantee
// (pinned-deps.spec.ts T-08-03), and without this the whole battery is green on a broken bin.
const DEFERRED_NX_SPECIFIERS = [
  ...readRepoFile('capture-hashes.mjs').matchAll(/await import\('(nx\/src\/[^']+)'\)/g),
].map((match) => match[1]);

it('the deferred Nx specifier list is extractable, so the clause below is not vacuous', () => {
  expect(DEFERRED_NX_SPECIFIERS).toHaveLength(6);
});

it.each(DEFERRED_NX_SPECIFIERS)('resolves %s at runtime', async (specifier) => {
  await expect(import(specifier)).resolves.toBeDefined();
});
```

### WR-02: A7's per-target loop re-spells the target list, so the new guard can go three-of-N

**File:** `packages/github-cache/src/docs-cross-os.spec.ts:163` and `:168`
**Issue:**
The replacement guard names the target list twice, in two independent literals:
`toEqual(['build', 'lint', 'test'])` for the key set, and `for (const target of ['build', 'test', 'lint'])`
for the per-target clause. Adding a target to the key set alone leaves the new target's runtime
inputs entirely unchecked while the suite is green -- which is structurally the same hole A8 was
written to close one file over ("hardcoded ... twice while its own docstring cites
`INVARIANT_TARGETS` as canonical, so a fifth member would leave the detector silently
four-of-five").

The instruction at `:131-132` makes it likely rather than hypothetical: it tells the next
maintainer to "add it to the expected KEY SET here in the SAME commit" and says nothing about the
loop.

**Fix:** one constant, both clauses derived from it.

```ts
/** The targets section 1's snippet must declare. Named ONCE -- the key set and the per-target
 * clause below both derive from it, so a fourth target cannot be added to one and missed by
 * the other. */
const SNIPPET_TARGETS = ['build', 'test', 'lint'] as const;

expect(Object.keys(snippet.targetDefaults).sort(), `...`).toEqual(
  [...SNIPPET_TARGETS].sort(),
);

for (const target of SNIPPET_TARGETS) {
  expect(runtimeInputsOf(snippet.targetDefaults[target].inputs), `...`).toEqual([command]);
}
```

and reword `:131` to "add it to `SNIPPET_TARGETS` here in the SAME commit".

### WR-03: A9 falsified `mirrored-by-label.ts`'s stated reason for exporting the prefix, and the file was not updated

**File:** `packages/github-cache/src/lib/mirrored-by-label.ts:3-9`
**Issue:**
The docstring justifies the `MIRRORED_BY_PREFIX` export as:

> `Exported as well as the builder below because the READER needs the prefix alone -- it strips it off a label GitHub hands back to recover the OS -- while the writer and every fixture need the whole string.`

A9 swapped `read-back.ts` from the prefix to `mirroredByLabel`, so no production reader imports
it any more, and `read-back.ts:191` compares whole labels -- it never stripped anything. Verified
by `git grep -n "MIRRORED_BY_PREFIX"`: the only remaining consumers are the module itself and
`read-back.spec.ts:12,360`, a value pin.

The plan recorded the correct reason for the export surviving ("`read-back.spec.ts:363` pins its
VALUE"), but it was written into the SUMMARY and the commit message rather than into the file
that carries the claim. That leaves a canonical-reading file stating a fact that is false -- the
exact defect `repo-file.ts`'s own header exists to prevent, and the class this task corrected
three times elsewhere.

**Fix:**

```ts
/**
 * The publisher-attribution Release LABEL prefix (OBS-03). Exported as well as the builder below
 * ONLY because `read-back.spec.ts` pins its VALUE -- no production consumer imports it any more.
 * `read-back.ts` used to compose the label from it and now calls `mirroredByLabel` instead, so
 * the earlier reason given here ("the READER needs the prefix alone -- it strips it off a label
 * GitHub hands back") describes neither the reader's behaviour nor any current caller. Deleting
 * the export would delete that live value assertion, which is why it stays.
 */
```

### WR-04: orphaned and now-false docstring left behind by A6

**File:** `packages/github-cache/src/lib/cache-key.spec.ts:88`
**Issue:**
`/** The package source root, resolved from this file rather than from the cwd. */` documented
`SOURCE_ROOT_URL` and the local `PACKAGE_SOURCE_ROOT`. A6 deleted both constants and left the
line standing, so it now sits directly above `nonSpecModules`'s own docstring (`:89-100`),
documenting nothing -- and its claim is false of the replacement: `PACKAGE_SOURCE_ROOT` is
imported from `test/repo-file.js`, not resolved from this file.

Two adjacent `/** */` blocks on one function also read as a formatting accident, which is how a
reader talks themselves into deleting the wrong one.

**Fix:** delete line 88. The surviving docstring at `:89-100` already states the URL-anchoring
fact this line was carrying.

### WR-05: A7's fence parse crashes anonymously on two plausible doc edits

**File:** `packages/github-cache/src/docs-cross-os.spec.ts:154-161`
**Issue:**
`JSON.parse(snippets[0])` and `Object.keys(snippet.targetDefaults)` both run unguarded. Two
edits a doc author would reasonably make produce a bare `SyntaxError` / `TypeError: Cannot
convert undefined or null to object` instead of this file's own named reason:

1. a `//` comment inside the snippet -- legal in `nx.json` (JSONC), and the fence IS an `nx.json`
   snippet, so the temptation is real;
2. narrowing the fence to just the `targetDefaults` sub-object.

Every other clause in this file carries a `REWORD_ADVICE`-bearing message; the file's whole
design is that a red says what to do. The repo's own standard is explicit about this class --
`hash-parity/compare.ts:64-66` calls an unnamed crash "a crash where `shapeFault`'s own doc block
requires a named reason".

**Fix:** name both failure modes before dereferencing.

```ts
let snippet: { targetDefaults?: Record<string, { inputs?: readonly unknown[] }> };

try {
  snippet = JSON.parse(snippets[0]) as typeof snippet;
} catch (error) {
  throw new Error(
    `docs/cross-os.md's \`\`\`json fence must PARSE -- this guard reads the target keys out of ` +
      `it rather than counting occurrences in it. nx.json accepts JSONC comments; this fence ` +
      `cannot carry them. ${REWORD_ADVICE} (${String(error)})`,
  );
}

expect(
  snippet.targetDefaults,
  `docs/cross-os.md's \`\`\`json fence must be a whole nx.json shape with a \`targetDefaults\` key -- narrowing it to the sub-object breaks the copy-pasteable claim section 1 makes. ${REWORD_ADVICE}`,
).toBeDefined();
```

## Info

### IN-01: two ordering comments in `capture-hashes.mjs` are looser than the code

**File:** `capture-hashes.mjs:284-287` and `:452-455`
**Issue:**
`:452-455` says the measurement sits before the two `await import`s so the change "must not
quietly move this measurement later in the sequence than the static imports used to put it".
Under static imports all six modules loaded before `capture()` ran, so the measurement now
happens EARLIER, not at the same point -- the constraint as written is one-sided and satisfied,
but a reader will take it as "unchanged".

`:284-287` says the `await import` of `nx/src/utils/cache-directory.js` is "two lines below"; it
is four (the function opens at `:296`, the first import spans `:297-298`, cache-directory is
`:299-300`).

Both were checked rather than assumed, and the substance is right:
`node_modules/nx/dist/src/utils/cache-directory.js:9` does `require("../native")` while
`native-file-cache-location.js` does not, so the corrected mechanism holds. A direct probe under
redirected `NX_WORKSPACE_DATA_DIRECTORY` / `NX_NATIVE_FILE_CACHE_DIRECTORY` shows the reorder is
behaviourally neutral -- loading the four deferred specifiers first changes nothing:

```
{"mode":"before","workspaceData":{"exists":false,"entries":0},"nativeFileCache":{"exists":true,"entries":1}}
{"mode":"after", "workspaceData":{"exists":false,"entries":0},"nativeFileCache":{"exists":true,"entries":1}}
```

**Fix:** at `:452-455`, say what is true: the measurement moved EARLIER than the static imports
put it, and the `graphState` verdict is unaffected because none of the four deferred specifiers
populates the workspace-data directory at load time (measured). At `:285`, drop the line count or
say "below in this function".

### IN-02: A13's memo makes the two accepted-fixture clauses share one spawn, which `--retry` cannot re-run

**File:** `packages/github-cache/src/read-integration-hash.integration.spec.ts:152-153`
**Issue:** `acceptedResult` is module-scope, so a retry of the second clause replays the first
attempt's captured result rather than re-driving the instrument. Independence between the two
clauses is also gone -- one flaky spawn now fails both. This is the intended trade (A13 is a
perf item, and the fixture is deterministic), recorded here so a future flake is not
mis-attributed.
**Fix:** none required. If the file ever gains `--retry`, reset `acceptedResult` in a
`beforeEach` guarded to the accepted describe.

### IN-03: A15's row titles truncate to ~35 characters, leaving two rows separated by three characters

**File:** `packages/github-cache/src/nx-target-inputs.spec.ts:934-1050`
**Issue:** measured with `--reporter=verbose`, the five generated titles render as
`... '{workspaceRoot}/.github/workflows/ci....'` and `... '{workspaceRoot}/.github/workflows/win...'`.
Distinguishable today, and the full path is in each row's assertion message, so the localization
A15's rewritten comment promises is real. It becomes ambiguous the moment a third
`.github/workflows/w*` entry is registered.
**Fix:** none now. If a fourth workflow row lands, put a short discriminator first in the title,
e.g. `'nx.json declares $target input: $entry'` with a `label` column.

### IN-04: the SUMMARY's commit table names two commits that are not on the branch

**File:** `.planning/quick/260810-kuo-apply-the-15-triaged-survivors-of-the-si/260810-kuo-SUMMARY.md:81-82`
**Issue:** C16 is listed as `65d36e1` and C17 as `703a261`. Both objects exist, but
`git merge-base --is-ancestor 65d36e1 HEAD` is false -- they are orphans from a rewrite. The
commits actually on the branch are `a9184a4` (A15) and `b6580ad` (the deferral record). The
Self-Check line "All 17 commit hashes resolve in `git log --all`" is true and therefore did not
catch it; the bisect-safety claim rests on the wrong two SHAs.
Outside the source-review scope (planning artifact), recorded because the table is the map a
reviewer navigates by.
**Fix:** correct the two rows, and change the Self-Check to `git merge-base --is-ancestor <sha> HEAD`
for each.

## Verified clean

Checked adversarially and found sound. Listed so a re-review does not repeat the work.

**A1 `readRepoFile` memo (`test/repo-file.ts:48-101`).**
Key is the caller-spelled relative path against a fixed `WORKSPACE_ROOT_URL`, so two distinct
inputs cannot collide on one key and one key cannot resolve to two files. Only successful reads
enter the map, so the load-bearing throw re-fires (controlled at `repo-file.spec.ts:169-171`).
Values are strings -- immutable, no aliasing hazard. The independent walk `packageSourceFiles`
is NOT memoized and builds a fresh array per call, so the array-mutation hazard the brief flagged
does not exist. The writer-set claim was re-derived rather than trusted: five files under the
package source tree actually write (`actions-cache-backend.ts`, `actions-cache-backend.spec.ts`,
`capture-hashes-cli.spec.ts`, `read-integration-hash.integration.spec.ts`,
`test/workspace-root-cwd.ts`; `lib/cache-archive-path.ts` only mentions writes in prose), all
under `.nx/cache` or `tmpdir`, and the named near-miss is real -- `capture-hashes-cli.spec.ts:185`
is `mkdtempSync('.nx/cache/diff-')`. Also checked the controls against a plausible bug: a memo
keyed on a constant would pass `:161` but fail `:169`, because the throw clause runs after the
cache is warm.

**A2 `jobBlock` memo (`dogfood-cross-os.spec.ts:53-108`).**
`cached !== undefined` rather than a truthiness test, so a legitimately EMPTY block is cacheable
and still distinguishable from a miss. The miss throws and is never stored. The hoisted
`new RegExp` is still built per call, inside the function, as the interpolation requires.

**A3/A4 `capture-hashes.mjs`.** Every call site awaits what it must (`measureGraphState` has
exactly one caller, `:456`, and it awaits). No dynamic import sits inside a loop -- both of
`captureTargets`'s are above `for (const target of TARGETS)`. The file contains no `try`/`catch`
at all, so no error path can swallow a module-resolution failure. `resolvedTaskIds` has exactly
two callers, both inside `assertGraphPremise`, both passing the third parameter.
`const TARGETS = [...]` at `:97` is still one line, so `compare.spec.ts:638`'s extraction is
intact (and its clause is green). The A4 comment's citations were checked against the installed
Nx 23.1.0 and are accurate at the lines given: `run-command.js:672`, `init-tasks-runner.js:23`,
`task-hasher.js:76-77`.

**A5/A6/A10.** The three rewritten walks are at the levels the derived-set regex expects
(`compare.spec.ts` 4, the two root-instrument specs 3), which is why
`WORKSPACE_ROOT_WALK_EXCEPTIONS` correctly drops to three and the set-equality and non-vacuity
clauses stay green. `probeTokenOf`'s superset claim was re-measured, not taken on trust: neither
`FORBIDDEN_RESULT_MEMBERS` needle in `compression-method.spec.ts:261-262` contains `\b`, so the
extra strip is a no-op and both derived tokens are byte-identical. Both call sites keep their
non-vacuity control (`cache-archive-path.spec.ts:164`, `compression-method.spec.ts:304`).

**A7 is a genuine strengthening.** Beyond the localization argument the commit makes: a snippet
that declared the discriminator as a plain STRING input rather than a `{ runtime: ... }` object
passed the old occurrence count and fails the new `runtimeInputsOf(...)` clause. Nothing the old
count caught is lost -- an extra `targetDefaults` key now fails the key-set equality, and a
doubled entry fails that target's own `toEqual([command])`.

**A8's join products are byte-identical.** `INVARIANT_TARGETS` is
`['build','typecheck','test','lint']` (`hash-parity/compare.ts:82-87`), so `join(', ')` gives
`Successfully ran targets build, typecheck, test, lint for project` and `join(' ')` gives
`nx run-many -t build typecheck test lint --skip-nx-cache` -- both exactly the deleted literals.
The new cross-directory import is safe: `compare.ts` has no import-time side effects (no
`process.argv`, no `process.exit`, no top-level I/O) and no cycle back to the detector spec.

**A14.** The `flatMap` emits the six entries in the original order (`node:os`, `os`, `node:path`,
`path`, `node:process`, `process`) with the same `importNames` bindings and the same `BAN_MESSAGE`.

**A11/A9 residue.** No dangling references: `git grep` for `read(`, `mirroredBy\b` and
`SNIPPET_DISCRIMINATOR_SITES` all return no matches (with positive controls run in the same
session to rule out a false zero). `mirroredByLabel(os)` is `${MIRRORED_BY_PREFIX}${os}`, so both
`read-back.ts` sites are byte-identical at runtime, and `check:action` reports no bundle drift.

---

_Reviewed: 2026-08-10T15:25:37Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
