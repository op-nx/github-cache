---
phase: 260810-bxj
reviewed: 2026-08-10T13:20:00Z
depth: deep
files_reviewed: 39
files_reviewed_list:
  - .github/workflows/ci.yml
  - .gitignore
  - docs/advanced.md
  - docs/trust-and-security.md
  - eslint.config.mjs
  - packages/github-cache/src/action/index.spec.ts
  - packages/github-cache/src/backend/actions-cache-backend.spec.ts
  - packages/github-cache/src/backend/actions-cache-backend.ts
  - packages/github-cache/src/backend/memory-backend.ts
  - packages/github-cache/src/backend/releases-backend.spec.ts
  - packages/github-cache/src/backend/releases-backend.ts
  - packages/github-cache/src/capture-hashes-cli.spec.ts
  - packages/github-cache/src/cleanup/cleanup.ts
  - packages/github-cache/src/dogfood-cross-os.spec.ts
  - packages/github-cache/src/hash-parity/compare.ts
  - packages/github-cache/src/lib/cache-archive-path.spec.ts
  - packages/github-cache/src/lib/cache-key.spec.ts
  - packages/github-cache/src/lib/compression-method.spec.ts
  - packages/github-cache/src/lib/compression-method.ts
  - packages/github-cache/src/lib/mirrored-by-label.ts
  - packages/github-cache/src/lib/octokit-fault-reason.spec.ts
  - packages/github-cache/src/lib/octokit-fault-reason.ts
  - packages/github-cache/src/lib/release-asset-name.integration.spec.ts
  - packages/github-cache/src/lib/release-asset-name.ts
  - packages/github-cache/src/lib/retention.ts
  - packages/github-cache/src/lib/select-backend.spec.ts
  - packages/github-cache/src/lib/select-backend.ts
  - packages/github-cache/src/lint-rules.spec.ts
  - packages/github-cache/src/lint-scope-drift.spec.ts
  - packages/github-cache/src/nx-target-inputs.spec.ts
  - packages/github-cache/src/pinned-deps.spec.ts
  - packages/github-cache/src/public-surface.spec.ts
  - packages/github-cache/src/publish/publish-mirror.spec.ts
  - packages/github-cache/src/publish/publish-mirror.ts
  - packages/github-cache/src/roundtrip/read-back.spec.ts
  - packages/github-cache/src/roundtrip/read-back.ts
  - packages/github-cache/src/test/repo-file.spec.ts
  - packages/github-cache/src/test/repo-file.ts
  - start-cache-server/index.js
findings:
  critical: 1
  warning: 8
  info: 5
  total: 14
status: issues_found
---

# Quick Task 260810-bxj: Code Review Report

**Reviewed:** 2026-08-10T13:20:00Z
**Depth:** deep
**Files Reviewed:** 39
**Status:** issues_found

## Summary

DEC-1 is sound. `hasOnlyFaultCode` reads codes only, never a message, on the upload path; it
requires a non-empty array so an absent/null/non-array/empty `errors` all fall through to the
fault branch; a single-entry `already_exists` (which is the real GitHub duplicate-asset shape)
still skips benignly; both twins were re-authored to the fatal verdict with `setFailed`
asserted; and `ensureShardRelease`'s field-scoped, textually-anchored burned-tag read is
untouched and still the only message read in the file. The `mirrored-by:` single-sourcing is
complete: `git grep` finds no surviving independent authoring of the literal, and the persisted
prefix is pinned, so neither a one-sided nor a coordinated rename passes. The `node:process`
ban catches all six static-import shapes plus the dynamic form and the five widened env keys,
with anchored controls; `npx eslint .` is clean and `process.argv` / `process.exitCode` remain
legal. The T1-5 partition was replicated against the real `ci.yml`: 21 jobs enumerated with no
phantoms, the derived set is exactly the three consumers, the knob accounting identity holds
3 == 3, and the four sidecar-less Windows legs plus `integration` are correctly unasked. The
generated bundle is consistent with its sources -- `npm run check:action` is clean in the main
tree. The full suite is 1169/1169 green.

Two categories of defect survived the pass, and both are the pass's own named defect classes.

**A brand-new drift guard is satisfiable while its invariant is violated.** Measured: deleting
every ESLint package from `nx.json`'s `test.externalDependencies` leaves the T4-7 guard fully
GREEN, which is the exact stale-cache false PASS T4-7 was opened to close. Its assertion message
claims "A removal is the same hazard mirrored."

**A replaced guard lost coverage the deleted one had, and its prose says otherwise.** Measured:
deleting one sidecar block's token write -- or seven of the eight blocks -- leaves the rewritten
mask/write clause GREEN, where the deleted `MASKED_TOKEN_SITES = 8` pin reddened. The same
docstring re-authors the count "eight" in prose after removing the only assertion that pinned it.

Beyond those, four newly authored "MEASURED ... byte-identical" claims about the shared comment
stripper are false (it drops blank lines; none of the five copies it replaced did), one hoist
comment argues its conclusion from a premise that supports the opposite, and a line citation
survives inside the very comment block edited to declare it name-anchored.

## Critical Issues

### CR-01: The T4-7 drift guard cannot see an ESLint package removed from `test`

**File:** `packages/github-cache/src/nx-target-inputs.spec.ts:497-521` (the subtraction at
`:507-509`)

**Issue:** The guard asserts two things: `lint`'s `externalDependencies` set-equals
`ESLINT_TOOLCHAIN`, and `externalDependenciesOf('test')` *minus* `ESLINT_TOOLCHAIN` equals
`['vitest']`. The second clause subtracts the toolchain before comparing, so it is blind to the
toolchain shrinking on the `test` side. Nothing else in the tree asserts
`test.externalDependencies` -- every other clause in this file uses `toContain` on string
filesets.

Measured against the real `nx.json` with the guard's own logic:

```
baseline                                                  -> GREEN
MUTATION: 'eslint' removed from test.externalDependencies -> GREEN
MUTATION: ALL FOUR eslint pkgs removed from test          -> GREEN
```

**Failure scenario:** a contributor tidies `nx.json` and drops the four ESLint names from
`test.externalDependencies` (they look redundant next to `lint`'s copy). `test` stops rotating on
ESLint upgrades. An ESLint upgrade then changes what `eslint .` reports while `lint-rules.spec.ts`
-- whose entire job is proving the ambient-platform-read ban FIRES against the real root config --
replays a cached PASS against a config that has moved. That is verbatim the harm the guard's own
comment describes, and the guard is green. The clause's message additionally asserts coverage it
does not have: "A removal is the same hazard mirrored."

Note the caught direction does work: an ESLint plugin added to `lint` only reddens clause 1, and
an unexplained new entry on `test` reddens clause 2. All three mutations the SUMMARY records as
measured are ADDITIONS; the removal direction was never exercised.

**Fix:** pin the `test` set outright. It is still a set relation over named packages with no
element count, and it closes both directions in one clause:

```ts
const TEST_TOOLCHAIN = [...ESLINT_TOOLCHAIN, 'vitest'].sort();

it('keeps the test and lint ESLint toolchain sets from drifting apart', () => {
  expect(externalDependenciesOf('lint'), /* ...existing message... */).toEqual(
    ESLINT_TOOLCHAIN,
  );
  expect(
    externalDependenciesOf('test'),
    "nx.json's `test` externalDependencies is no longer the four ESLint packages plus the " +
      'test runner. `test` carries the runner on top of the four ESLint names -- that ' +
      'asymmetry is CORRECT. What this catches is an ESLint plugin added to one side and ' +
      'not the other, an ESLint package REMOVED from `test` (which stops `test` rotating on ' +
      'ESLint upgrades, so lint-rules.spec.ts replays a cached PASS), or an unexplained new ' +
      'entry. Update TEST_TOOLCHAIN here in the same commit if one is legitimately adopted.',
  ).toEqual(TEST_TOOLCHAIN);
});
```

Then delete the "A removal is the same hazard mirrored" sentence from clause 1's message, or
leave it -- it becomes true.

## Warnings

### WR-01: The rewritten mask/write pairing dropped the token-write coverage the deleted count had

**File:** `packages/github-cache/src/dogfood-cross-os.spec.ts:2489-2560` (positive control at
`:2515-2527`); docstring at `:2455-2487`

**Issue:** The old clause pinned `writeAt` to `MASKED_TOKEN_SITES = 8`, so losing a
`NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN` write reddened. The replacement derives blocks FROM the
writes and its only non-vacuity control is `blocks.length > 0`, so the write count is now
self-referential. Measured against the real `ci.yml` with the clause's own logic:

```
baseline: 8 masks, 8 writes, 8 blocks, all correctly ordered -> GREEN
MUTATION: delete the 4th mask                               -> RED (1 bad block)  [good]
MUTATION: delete 1 token write, keep its mask               -> GREEN (7 blocks)
MUTATION: delete 7 of the 8 mask+write pairs                -> GREEN (1 block)
```

**Failure scenario:** a sweep across the eight hand-maintained sidecar copies drops the token
write from `integration`'s block. That job silently loses its remote cache client and runs
local-cache-only for every subsequent run -- which is the harm the DELETED assertion message named
verbatim ("losing a site silently drops that job to local-cache-only"). The new message covers only
the all-or-nothing case ("no longer writes ... anywhere ... drops every wired job"), and the
docstring asserts the derivation is a free replacement: "What the count was protecting is the
under-sweep direction, and the per-block derivation gives that for free." It does not; it gives the
mask under-sweep for free and loses the write under-sweep entirely. Only the three Windows legs pin
their write independently (`:1486`, `:1730`, `:1903`), so the five ubuntu/integration/consumer-smoke
blocks are now unguarded.

Compounding it: the same docstring re-authors the count in prose -- "correct in all eight sidecar
blocks", "took the file to EIGHT", "the token appears eight times", and at `:2246` "`ci.yml` carries
EIGHT `- uses: ./start-cache-server` steps" -- in the same change that deleted the only assertion
pinning 8. The census rule is "delete the count, or assert it programmatically"; this deleted the
assertion and kept the prose.

**Fix:** derive the block set from the SIDECAR steps (an independent subject) rather than from the
writes, and assert one write per sidecar block:

```ts
const SIDECAR = /^ {6}- uses: \.\/start-cache-server$/;
// blocks := every sidecar step index; each must be preceded by its own mask AND its own write,
// mask before write before sidecar. A deleted write then reddens the block that lost it, by name,
// and no count is authored anywhere.
```
Then drop the prose "eight"s, since the sidecar set is derived.

### WR-02: Four newly authored "MEASURED ... byte-identical" claims about the shared stripper are false

**Files:**
- `packages/github-cache/src/lib/cache-archive-path.spec.ts:52`
- `packages/github-cache/src/lib/cache-key.spec.ts:22`
- `packages/github-cache/src/lint-scope-drift.spec.ts:246-248`
- `packages/github-cache/src/lib/compression-method.spec.ts:282` (same class)

**Issue:** `stripLineComments` (`test/repo-file.ts:133-140`) filters `trimmed !== ''`, so it drops
BLANK lines. None of the five copies it replaced did -- each filtered comment markers only. Measured
old-copy output against new-copy output on the real subjects:

```
vitest.config.mts              identical: false  (741 -> 739 chars)
vitest.integration.config.mts  identical: false  (397 -> 395 chars)
lib/cache-key.ts               identical: false  (559 -> 552 chars)
lib/cache-archive-path.ts      identical: false  (211 -> 207 chars)
lib/select-backend.ts          identical: false  (1846 -> 1837 chars)
```

`lint-scope-drift.spec.ts` is the sharpest: it names the block-comment difference and then asserts
byte-identity anyway.

**Failure scenario:** no live consequence today (all assertions on these subjects are single-line
needles, and the full suite is green). The defect is that a false MEASURED claim is the strongest
kind of comment a future reader will trust: someone adding a multi-line needle -- a `\n\n` separator,
or a regex spanning a blank line -- will believe the stripped view preserves the file's line
structure and get a silent no-match, which is a false GREEN in a content guard.

**Fix:** state the actual difference in each of the four comments, e.g. "MEASURED: the stripped view
differs from the previous local copy only by dropped BLANK lines (and, at
`lint-scope-drift.spec.ts`, potential block-comment lines); every needle asserted here is
single-line, so no clause changes verdict. Do not add a needle that spans a blank line." Or drop the
blank-line filter from `stripLineComments` and keep the truncation controls, which makes the claim
true for all five callers.

### WR-03: The de-byte-pinned count-pipeline clauses no longer assert that the tokens compose

**File:** `packages/github-cache/src/dogfood-cross-os.spec.ts:1626-1640`, `:1799-1813`,
`:1965-1979` (the log assertion at `:1632`, `:1805`, `:1971`)

**Issue:** Dropping the indentation anchor was correct. Splitting one line-scoped needle into five
independent `toMatch`/`toContain` calls over the whole job block was not: each token is now
satisfiable from a DIFFERENT line. In particular `expect(block, countShape).toContain(log)` is
satisfied three times over in every one of these blocks -- `ci.yml:613` (the tee'd step),
`ci.yml:667` (the count line) and `ci.yml:671` (the error message all name `build-nx.log`) -- so the
clause cannot pin what the count actually reads, while its own comment claims exactly that:
"Counted out of THIS leg's own log, derived from the leg parameter."

**Failure scenario:** the count line on `build-windows` is copy-pasted between the three
near-identical legs and ends up reading `typecheck-nx.log`. All five token clauses stay green
(`grep -a -o -F '[remote cache]'`, `build-nx.log` from the tee step, `wc -l | tr -d`, the `case`
shape, the floor). The gate then evaluates against a log that does not exist on that leg. In today's
tree that outcome is fail-CLOSED (`|| true` yields 0, `-lt 1` exits 1), so severity is bounded --
but the clause reports "the arithmetic is right" for a pipeline it has not read end to end, and the
comment states a locality it does not establish.

**Fix:** keep the one-line needle and remove only the byte-pin, which satisfies T2-2's mandate
without losing composition:

```ts
expect(block, countShape).toMatch(
  new RegExp(
    `count=\\$\\(\\{ grep -a -o -F '\\[remote cache\\]' ${log.replace('.', '\\.')} \\|\\| true; \\} \\| wc -l \\| tr -d '\\[:space:\\]'\\)`,
  ),
);
```
No `^ {10}` and no `$`, so a reindent is green; the tokens must still be in one pipeline reading this
leg's own log.

### WR-04: The burned-tag hoist comment argues its conclusion from a premise that supports the opposite

**File:** `packages/github-cache/src/publish/publish-mirror.ts:856-863`

**Issue:** The comment says `readMisses` no longer increments post-burn and then: "it CANNOT affect
the total-case gate below. That gate needs `readMisses === hashes.length`, and a burned tag means
the shard never resolved, so no entry was ever mirrored on that leg either." The gate is
`scanned > 0 && readMisses === scanned && mirrored === 0` (`:488`). `mirrored === 0` is a gate
PRECONDITION, so "no entry was ever mirrored" argues FOR the gate firing, not against it.

The conclusion is nevertheless correct, and the load-bearing fact is unstated: `burnedShardTag` is
set only inside `if (shard === undefined)`, which is reached only after `restored.kind !== 'miss'`.
So the entry that discovers the burn was a restore HIT and never incremented `readMisses`, hence
`readMisses <= scanned - 1 < scanned` both before and after the hoist. The hoist only lowers
`readMisses` further, so the gate is strictly less reachable.

**Failure scenario:** the next reader of this block, checking the reorder's safety, follows the
stated reason, finds it does not hold, and either "fixes" the gate or reverts the hoist -- which
restores the two properties the block's own first paragraph claims and that the hoist exists to make
true. This is the falsified-prose class the task exists to close, in prose the task authored.

**Fix:** replace the reason with the one that holds:

```
// (2) `readMisses` STOPS INCREMENTING for every post-burn entry ... It CANNOT make the
// total-case gate reachable, and the reason is the sentinel's own precondition rather than
// `mirrored`: `burnedShardTag` is set only inside the `shard === undefined` branch, which is
// reached only after a restore HIT -- so the entry that discovered the burn never counted as a
// miss, and `readMisses <= hashes.length - 1` on any burned leg, before and after this move.
// The hoist only lowers `readMisses` further.
```

### WR-05: A decayed line citation survives inside the comment block edited to declare it name-anchored

**File:** `packages/github-cache/src/backend/actions-cache-backend.spec.ts:344` (the added
paragraph at `:350-354`)

**Issue:** T3-6 re-anchored the `types.ts:46-50` citation by NAME and added: "ANCHORED BY NAME, not
by line. ... a line range decays on the next edit above it, silently." The immediately preceding
sentence in the SAME comment still cites `select-backend.spec.ts:307-335`. Measured: that range now
holds the C2 cold-cache-degrade WARNING clause (`select-backend.spec.ts:303-343`), which is not the
referenced content. The record actually cited -- the WR-01 tautological-security-test note -- is at
`select-backend.spec.ts:392`, and this diff pushed it 7 lines further down by inserting into that
file's header.

**Failure scenario:** a reader following the citation to understand why an identity check is
forbidden lands on an unrelated `core.warning` level assertion, concludes the note is stale
everywhere, and stops trusting the block -- including the behavioural-not-identity rule it exists to
protect. The comment simultaneously declares itself name-anchored, so nothing prompts a re-check.

**Fix:** anchor it by name like its neighbour: "... the failure mode `select-backend.spec.ts`
records having shipped once, in its TRUST-05 no-caller-facing-mode group (01-REVIEW.md WR-01)."

### WR-06: The jobs-API jq guard leaves `.steps` itself unguarded, so a malformed job still faults the step

**File:** `.github/workflows/ci.yml:1558`; the clause that pins it,
`packages/github-cache/src/dogfood-cross-os.spec.ts:795-822`

**Issue:** The expression is now
`first(.jobs[] | select(type == "object") | select(.name == ...) | .steps[] | select(type == "object") | select(.name == ...))`.
Both ELEMENT types are guarded. Neither the null nor the scalar case of the `.steps` CONTAINER is:
in jq, `null | .[]` and `"x" | .[]` both error ("Cannot iterate over null/string"). The outer array
has a container guard one line up at `:1554` and the inner has none, although the pair is presented
as mirrored -- and the clause's own message singles out the outer container guard as non-redundant
("only that one can tell an API or permissions fault apart from a genuinely absent step").

**Failure scenario:** the jobs API returns a job object whose `steps` is absent or null (queued or
partially-materialised legs are the plausible source). `step=$(printf ... | jq -c '...')` runs under
`set -euo pipefail` (`ci.yml:1546` region), so jq's non-zero exit aborts the step with a raw
"Cannot iterate over null" on stderr. The o3-witness job then fails naming jq instead of emitting
either of its two purpose-built diagnostics -- precisely the misattribution the extraction was split
up to prevent, arriving through the guard that was added to prevent it.

**Fix:** mirror the outer level's container check inside the pipeline and pin it:

```
first(.jobs[] | select(type == "object") | select(.name == "integration (windows-11-arm)")
  | select((.steps | type) == "array") | .steps[] | select(type == "object")
  | select(.name == "Run the integration target and tee its output")) // empty
```
A job with no `steps` array then contributes nothing instead of faulting, and the absent-step
message at `:1567` reports the real cause. Add a third `toMatch` to the clause for
`select\(\(\.steps \| type\) == "array"\)`.

### WR-07: The pass's unscoped "no surviving byte-pin" claim is false, including three negative assertions

**File:** `packages/github-cache/src/dogfood-cross-os.spec.ts:1447-1448`, `:1712-1713`,
`:1885-1886` (and 14 further `^ {10}` pins in the same file)

**Issue:** PLAN must_have and verification item 5 read "No replacement guard is a byte-pin: no
surviving assertion fails merely because whitespace or indentation moved." The count-pipeline half
is genuinely fixed, but 20 `^ {10}` run-body anchors remain in this file. Three of them are NEGATIVE:

```ts
expect(block, ownTarget).not.toMatch(/^ {10}npm run typecheck 2>&1/m);
expect(block, ownTarget).not.toMatch(/^ {10}npm run test 2>&1/m);
```

**Failure scenario:** the negative direction is the dangerous one. Reindent the `build-windows` run
body (or nest the target invocation one level deeper inside a conditional step) and these
`not.toMatch` clauses stop matching for the wrong reason -- so `build-windows` could gain a
`npm run typecheck` invocation and the exclusivity claim stays green. A positive byte-pin at least
reddens loudly on a reindent; a byte-pinned negative assertion silently becomes vacuous.

**Fix:** none of these lines is in the deferred set, and the fix is mechanical -- replace `^ {10}`
with `^\s+` in the three `not.toMatch` needles (the positives in the same clauses already scope to
the job block, so `\s+` does not widen them across jobs). Separately, narrow the PLAN/SUMMARY claim
to the count-pipeline clauses it actually covers, so the next reader does not read this file as
byte-pin-free.

### WR-08: The trailing strip's whitespace requirement leaves an uncontrolled false-GREEN shape

**File:** `packages/github-cache/src/test/repo-file.ts:87` and `:129`; the claim it backs,
`packages/github-cache/src/lib/select-backend.ts:38-48`

**Issue:** `TRAILING_COMMENT_MARKER = ' //'` (deviation D7). That correctly keeps `https://` intact
-- and it also means a trailing comment with NO preceding space is not stripped at all. The claim it
backs is the strongest in the package: the branch-order guard "reads the comment-stripped source so
prose can neither satisfy nor break it." `repo-file.spec.ts:71-105` controls the URL-survival and
the space-separated-note cases; nothing controls the no-space case, and neither the helper docstring
nor `select-backend.ts`'s corrected claim mentions it.

**Failure scenario:** `select-backend.ts`'s knob branch is deleted and replaced with
`return actionsBackend();// CACHE_READ_ONLY handled upstream now` (no space before `//`). The
trailing strip finds no ` //`, the comment survives into `selectBackendCode`, and the positive
first-occurrence clauses match the branch text out of prose with the branch itself gone -- the exact
false GREEN D7 set out to close, one character away. The residual is closed today only by
`format:check` (Prettier inserts the space), which is an unstated dependency on a different gate.

**Fix:** make the marker whitespace-class-based rather than space-literal, and control the shape:

```ts
const TRAILING_COMMENT = /\s\/\/.*$/;   // any whitespace, so a tab-indented note is caught too
// ... and, in the caller-visible docstring, state the residual explicitly:
// A `//` with NO whitespace before it is NOT stripped, by construction -- that is what keeps a
// URL scheme intact. `format:check` is what stops that shape existing in this repo; the two
// gates are load-bearing together.
```
Add one control to `repo-file.spec.ts`: `stripLineComments("const flag = 'on';// note", { trailing: true })`
documents (and pins) whichever behaviour is chosen.

## Info

### IN-01: A literal `\n` escape sequence leaked into a source comment

**File:** `packages/github-cache/src/lint-rules.spec.ts:480`

**Issue:** The comment reads `... claimed "is reported\n    // anyway" -- true for node:os ...` --
a two-character `\n` inside a `//` comment, on a 148-character line that breaks the file's wrap
convention. An editing artifact from joining two comment lines.

**Fix:** re-wrap the comment and drop the escape.

### IN-02: A rewritten failure message is circular

**File:** `packages/github-cache/src/dogfood-cross-os.spec.ts:2088-2090`

**Issue:** The `MASKED_TOKEN_SITES` reference was replaced mechanically, leaving "Pinned exactly
rather than as a floor for the same reason this pin is exact rather than a floor: a floor of 2 is
satisfied by ...". This is operator-facing text on a failing gate.

**Fix:** "Pinned exactly rather than as a floor: a floor of 2 is satisfied by the two survivors
alone and would let a third record appear in silence."

### IN-03: A pointless alias survives the stripper consolidation

**File:** `packages/github-cache/src/lib/compression-method.spec.ts:284`

**Issue:** `const strippedSourceOf = stripLineComments;` -- a one-hop rename left over from the
one-commit local copy (deviation D5). Four call sites go through the alias.

**Fix:** call `stripLineComments` directly and delete the alias; keep the docstring above it, which
explains the routing.

### IN-04: `jobCensus()` is walked three times at collection

**File:** `packages/github-cache/src/dogfood-cross-os.spec.ts:172`, `:2396`, `:2416`

**Issue:** The census re-parses the whole `jobs:` region on each call, and the three call sites can
in principle disagree if the file were re-read between them (it is not -- `codeLines` is
module-level). Correctness is fine; a single `const census = jobCensus();` beside `readOnlyLegs`
removes the duplication and makes the shared subject explicit.

**Fix:** hoist one `census` constant and derive `readOnlyLegs` and both partition lists from it.

### IN-05: The `portable` predicate is keyed to three target names, so a conforming new leg reddens the out-of-set clause

**File:** `packages/github-cache/src/dogfood-cross-os.spec.ts:149`

**Issue:** `portable: /npm run (build|typecheck|test)(\s|$)/m`. A future Windows sidecar consumer on
another portable Nx target -- `lint` is the obvious candidate -- gets `portable: false`, lands in the
NOT-in-set partition, and its correct `CACHE_READ_ONLY` write reddens the out-of-set clause with a
message telling the author their producer has stopped writing. That is a false RED on a conforming
addition, the inverse of the defect this guard replaced.

**Fix:** either derive portability from the Nx target list rather than three literals, or add one
sentence to the out-of-set clause's message: "If this job is a NEW Windows sidecar consumer running a
portable target this predicate does not name, widen the `portable` predicate rather than removing
the knob."

---

_Reviewed: 2026-08-10T13:20:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
