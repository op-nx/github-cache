---
context: quick
quick_id: 260726-4cc
slug: audit-and-triage-proposals-1-4-then-appl
tasks_completed: 4
total_tasks: 4
status: executed
executed: 2026-07-26
branch: gsd/debug-windows-publish-one-asset
base: b32b5c8
head: cf91b42
pushed: false
---

# Quick Task 260726-4cc: Apply Proposals 1-4 - Summary

All four tasks executed in plan order, one atomic commit each, full eight-command battery green
before every commit. Nothing dropped, nothing deferred. Branch NOT pushed, no PR opened.

## Task -> commit mapping

| # | task | commit | message subject |
|---|---|---|---|
| 1 | `scanned` + `readMisses` in `PublishResult`, 5 summary rows | `0b05d1e` | `feat(publish): report scanned and restore-MISS counts in the publish summary` |
| 2 | dedup the hash enumeration to DISTINCT hashes | `55dfb87` | `perf(publish): restore each distinct hash once` |
| 3 | the expected per-OS publish asymmetry | `98c13b9` | `docs(advanced): record the expected per-OS publish asymmetry` |
| 4 | Pitfall 7's stale zstd clause + dead `uploadHash` | `cf91b42` | `docs(pitfalls): correct Pitfall 7's stale zstd and uploadHash claims` |

Base (pre-execution HEAD): `b32b5c8`. Final HEAD: `cf91b42`. Order 1 -> 2 -> 3 -> 4, never reordered.

## TDD: the observed RED, before the source edit, in each case

### Task 1 RED (tests + typecheck, both before any source edit)

Test edits landed first (step 1a: the 8 `toEqual` literals; step 1b: the new summary-row spec), then
`npx nx test github-cache --skip-nx-cache` was run BEFORE touching `publish-mirror.ts` or
`action/index.ts`:

```
Test Files  2 failed | 28 passed (30)
     Tests  10 failed | 421 passed (431)
```

All 10 named:

1. `action/index.spec.ts > runPublish OBS-01 summary rows (D-17)` -- the new summary-row spec (the
   table had no `scanned` row).
2. `publishMirror happy-path mirror > uploads a restored entry ...` (site `:112`)
3. `publishMirror restore MISS skip > skips a foreign-OS/evicted entry ...` (site `:142`)
4. `publishMirror first-write-wins > skips (no upload) when the asset name is already present` (`:158`)
5. `publishMirror first-write-wins > treats a 422 already_exists upload race ...` (`:171`)
6. `publishMirror fault discrimination > isolates and counts a per-item upload 5xx ...` (`:246`)
7. `publishMirror 1000-asset cap > with 999 existing assets it mirrors ...` (`:312`)
8. `publishMirror 1000-asset cap > with 1000 existing assets it skips ...` (`:316`)
9. `publishMirror 1000-asset cap > with 1001 existing assets it skips ...` (`:316`, second case)
10. `publishMirror all-restore-MISS degradation signal > warns (does NOT fail) ...` (`:376`)

Failure text on every publish-mirror case was the exact-shape mismatch the research predicted, e.g.

```
AssertionError: expected { Object (mirrored, skipped, ...) } to deeply equal { scanned: 1, mirrored: +0, ... }
-   "readMisses": 1,
-   "scanned": 1,
```

The typecheck RED, also before any source edit:

```
src/action/index.spec.ts:105:7 - error TS2353: Object literal may only specify known
properties, and 'scanned' does not exist in type 'PublishResult'.
```

No `as PublishResult` cast was used to paper over it; it went green with the source edit, as planned.

After the source edits (steps 1d-1f): `Tests 431 passed (431)`.

### Task 2 RED (exactly the first new spec; the gate-invariance spec green on BOTH sides)

Spec edits landed first (step 2a: both duplicate-key specs), then the run BEFORE the dedup:

```
Failed Tests 1
 FAIL  publishMirror duplicate-row dedup > restores a hash enumerated twice
       (two archive versions of one key) exactly once
AssertionError: expected "vi.fn()" to be called once, but got 2 times
    456|     expect(getMock).toHaveBeenCalledOnce();
Test Files  1 failed | 29 passed (30)
     Tests  1 failed | 432 passed (433)
```

The SECOND new spec (`still warns on a genuine total regression when the enumeration contains
duplicates`) was among the 432 PASSED in that same pre-dedup run, and passed again post-dedup
(433/433). That is the cheap empirical confirmation of research's multiplicity-invariance proof:
`2 === 2` before the dedup, `1 === 1` after, warning fires either way.

## Battery results, per commit (all eight, every commit)

| command | `0b05d1e` | `55dfb87` | `98c13b9` | `cf91b42` |
|---|---|---|---|---|
| `npm run format:check` | exit 0 | exit 0 | exit 0 | exit 0 |
| `npm run build` | exit 0 | exit 0 | exit 0 | exit 0 |
| `npm run typecheck` | exit 0 | exit 0 | exit 0 | exit 0 |
| `npm run typecheck:action` | exit 0 | exit 0 | exit 0 | exit 0 |
| `npm run test` | exit 0, 431/431 | exit 0, 433/433 | exit 0, 433/433 | exit 0, 433/433 |
| `npm run fallow:ci` | exit 0, no issues | exit 0, no issues | exit 0, no issues | exit 0, no issues |
| `npm run check:action` | exit 0, NO bundle drift | exit 0, NO bundle drift | exit 0, NO bundle drift | exit 0, NO bundle drift |
| `npm run pack:check` | exit 0, 55 files | exit 0, 55 files | exit 0, 55 files | exit 0, 55 files |

Each battery ran against the exact tree that became that commit (tree clean before staging, only the
task's named files modified, `git status --porcelain` clean immediately after each commit).

`check:action` never regenerated a differing `start-cache-server/index.js`, confirming the plan's
prediction: `entry.ts` imports `serve()` only and `publish-mirror.ts` is unreachable from the bundle.
No bundle was staged in any commit.

### Independent bisect re-verification (extra, after all four commits)

Each commit was checked out detached and re-run from scratch (`--skip-nx-cache` on both):

| commit | `nx test github-cache` | `npm run typecheck` |
|---|---|---|
| `0b05d1e` | 431 passed (431) | OK |
| `55dfb87` | 433 passed (433) | OK |
| `98c13b9` | 433 passed (433) | OK |
| `cf91b42` | 433 passed (433) | OK |

Every commit is independently green. Branch restored to `gsd/debug-windows-publish-one-asset`,
working tree clean.

## Blocking constraints -- confirmations

**Gate predicate byte-identical.** Compared literally between the pre-execution base and final HEAD:

```
b32b5c8 :264  if (hashes.length > 0 && readMisses === hashes.length && mirrored === 0) {
cf91b42 :300  if (hashes.length > 0 && readMisses === hashes.length && mirrored === 0) {
```

String-equality check on the two extracted lines passed -- BYTE-IDENTICAL across all four commits.
Only the line number moved (264 -> 300), from the added interface doc comments and the dedup's WHY
comment. Only the gate's existing *comment* gained one clause (plan step 2d), recording that its
message's "entr(y|ies)" now counts DISTINCT keys rather than enumerated rows.

**No `37` hardcoded.** `git diff b32b5c8..HEAD | rg "^\+" | rg "\b37\b"` returns nothing -- the token
does not appear in a single added line, in any test, doc, or comment across the four commits.
Expected `scanned` in every fixture is derived from that fixture's distinct-hash count (1, 1, 1, 1,
2, 1, 1, 1 for the eight extended literals; 1 for the dedup spec; 25 in the summary-row spec, which
is the DISTINCT-hash figure, not the row count).

**`readMisses` presented as a strict subset.** The summary row is
`['restore-MISS (of skipped)', result.readMisses]`, placed immediately after `skipped`. The exact
label string appears in exactly two places (see Task 1 verify below). The interface doc comment and
the `action/index.ts` call-site comment both state the subset relation and why the label carries it.

**No `toMatchObject` relaxation.** All 8 exhaustive `toEqual` literals were extended in place;
`git grep -n "toMatchObject" -- packages/github-cache/src/publish/publish-mirror.spec.ts` finds
nothing.

## Per-task `verify` checks -- actual results

### Task 1

| plan check | result |
|---|---|
| `nx test github-cache` fails after 1b / before 1d, passes after 1f | PASS with a counting caveat: **10** test failures, not the plan's predicted 9 (see Deviation D1). Green after 1f: 431/431. |
| the summary test asserts both the label AND the value | PASS -- `toContainEqual(['scanned', '25'])` and `toContainEqual(['restore-MISS (of skipped)', '12'])`; it fails if a row is wired to the wrong field. |
| full battery green | PASS, 8/8. |
| `git grep -n "restore-MISS" -- packages/` shows the label in exactly two places | PASS as intended. The exact LABEL `restore-MISS (of skipped)` occurs in exactly two places: `packages/github-cache/src/action/index.ts:166` (the row) and `packages/github-cache/src/action/index.spec.ts:122` (the assertion). The looser token `restore-MISS` has 6 hits, the other 4 being prose: the new call-site comment, the new test name, the engine's `readMisses` local comment, and the pre-existing `all-restore-MISS degradation signal` describe title. |

### Task 2

| plan check | result |
|---|---|
| `nx test github-cache` fails on the dedup spec after 2a / before 2c | PASS -- exactly 1 failure, the first new spec (`getMock` called 2 times). |
| the gate-invariance spec is green on BOTH sides of the change | PASS -- green pre-dedup (inside the 432 passed) and post-dedup (433/433). |
| no EXISTING assertion changes value; confirm by diffing | PASS -- `git diff HEAD -- publish-mirror.spec.ts` was **49 insertions, 0 deletions**. No task-1 `scanned` expectation moved, because every pre-existing fixture uses distinct keys. |
| full battery green | PASS, 8/8. |
| `git grep -n "hashes.length" -- publish-mirror.ts` shows the gate and the `scanned` return only, condition unchanged from `HEAD~1` | PASS on the code hits: gate (`:300`), gate message (`:302`, `:303`), `scanned` return (`:319`). Two further hits (`:182`, `:186`) are inside the WHY comment the plan itself dictates, not code. Condition unchanged from `HEAD~1` and from `b32b5c8`. |

### Task 3

| plan check | result |
|---|---|
| full battery green; `npm run test` re-runs `docs-adoption.spec.ts` / `docs-trust.spec.ts` against the edited file | PASS -- 433/433. `docs/advanced.md` is an nx `test` input (`nx.json:54`), so no stale-cache false pass; no `nx.json` change was made. |
| `npm run format:check` green, surrounding hand-wrap width matched, neighbouring bullets not reflowed | PASS -- exit 0. Wrap width 68-78 chars, matching the file. Neighbouring bullets and sections untouched; the edited bullet's own prose was rewrapped (see Deviation D3). |
| the added text contains no count, no run id, and no claim that a leg's mirrored count equals its cacheable-task count | PASS -- the two new sentences carry no number at all. The only 4+ digit token in any added line is the pre-existing `1000-asset cap`, carried along by the rewrap. |

### Task 4

| plan check | result |
|---|---|
| full battery green | PASS, 8/8. |
| `npm run format:check` green; PITFALLS long single lines preserved, neighbours not rewrapped | PASS -- exit 0. Every changed line remains one long single line; no neighbouring item rewrapped. |
| `git grep -n "uploadHash" -- .planning/research/PITFALLS.md packages/` returns nothing | PASS -- returns nothing. This required a fourth edit outside Pitfall 7 (see Deviation D4). |
| `git diff HEAD~1 -- PITFALLS.md` shows changes ONLY inside Pitfall 7, every **How to avoid** bullet untouched | PARTIAL by design: hunks at `159-160` (Pitfall 7 items 2 and 3) and `172` (Pitfall 7 warning signs) are inside Pitfall 7; a third hunk at `208` is in Pitfall 9 (Deviation D4). Every **How to avoid** bullet (`165-168`) is untouched, as is item 1 (CRLF), item 3's "Fix: per-OS matrix" statement, the `MUST-NOT-REOPEN` heading, and the line-361 carry-forward mention. |
| no line number appears in the new prose | PASS -- both citations name the file and the branch predicate (`the engine's restored.kind === 'miss' skip branch in publish/publish-mirror.ts`), never a line range. |

## Deviations from the plan

**D1 -- Task 1's RED was 10 test failures, not 9 (no action taken; prediction artifact only).**
The plan counted 8 assertion SITES and predicted 9 failures. Vitest counts parameterized CASES: the
1000-asset cap block is an `it.each` with three rows, so site `:312` yields one failing case and site
`:316` yields two. 8 sites -> 9 failing publish-mirror tests, + the new summary-row test = 10. Every
one of the 8 named sites went red, which is what the check was actually testing for. Nothing in the
plan's intent changed.

**D2 -- Task 1 also updated `publishMirror`'s JSDoc "Returns ..." line (one line, same commit).**
The function's doc comment said `Returns mirrored/skipped/failed counts; the bin emits the OBS-01
summary from them.` Left as-is it would have shipped a doc line that the same commit made false.
Changed to `Returns the scanned/mirrored/skipped/readMisses/failed counts; ...`. Not named in the
plan's step list; it is the same interface-accuracy obligation as step 2e, applied to the function
comment instead of the field comment. No behavior, no test impact.

**D3 -- Task 3's insertion rewrapped the remainder of the Publish / sync bullet (16 insertions,
11 deletions), not just the inserted lines.** The plan required the sentences to land immediately
after "...`cache-mirror-YYYYMM` Release." and BEFORE "It is gated by a **separate** sync allowlist"
-- a mid-paragraph insertion. Splicing ~330 characters into a hand-wrapped paragraph shifts every
subsequent wrap point in it. Ending the insertion without rewrapping left a 32-character ragged line
mid-paragraph ("reach the shared store. It needs"), which does not match the file's style. Rewrapping
the bullet through its own final line pushes the remainder to the bullet's natural short last line
(55 chars) and keeps every line 68-78 chars, matching the surrounding prose. Scope of the rewrap:
that ONE bullet only. The bullet's first two lines are byte-identical to before; no other bullet,
paragraph, or section changed; not one word of the pre-existing prose was altered, only its line
breaks. `format:check` green.

**D4 -- Task 4 made a FOURTH edit, outside Pitfall 7: `PITFALLS.md:208` (Pitfall 9's eviction
bullet).** The plan scoped the edits to "all inside `### Pitfall 7`", but its own verify check
requires `git grep -n "uploadHash" -- .planning/research/PITFALLS.md packages/` to return NOTHING.
Pitfall 9's eviction bullet named the same dead symbol (`(\`uploadHash\`'s no-hit \`return\` silently
skips it)`), describing the same engine branch, so the verify could not pass on a Pitfall-7-only
edit. The two constraints conflict and the outcome check was treated as authoritative: leaving a
second dead-symbol citation in the same document is exactly the staleness this task exists to remove.
The edit is minimal -- the dead symbol swapped for the identical live citation
(`the engine's \`restored.kind === 'miss'\` skip branch in \`publish/publish-mirror.ts\``), by file +
predicate with no line range. Nothing else in that bullet changed; its "Accepted -- mirror is
best-effort" verdict stands. `PITFALLS.md:208` is NOT on the plan's "What must NOT change" list (that
list protects the **How to avoid** block, item 1, item 3's per-OS-matrix statement, the
`MUST-NOT-REOPEN` heading, and the line-361 carry-forward mention -- all untouched).

**D4a -- consequence: commit 4's message gained a closing paragraph.** The plan's verbatim message
describes Pitfall 7 only. Since the commit also touches Pitfall 9, two sentences were appended so a
`git log` reader is not surprised by a Pitfall 9 hunk under a Pitfall 7 subject. The plan's authored
text is unchanged above it.

## Observation (no action taken, out of scope)

**The nx `typecheck` target can serve a stale cache HIT after a spec-only edit.** `nx.json`'s
`targetDefaults.typecheck.inputs` starts from the `production` named input, which EXCLUDES
`*.spec.ts`; but the target's command is `tsc --build tsconfig.json --emitDeclarationOnly`, which
DOES compile spec files. Observed directly during Task 1's RED: after editing only the two spec
files, `npm run typecheck` reported `Cache 2/2 hit (100%)` and exit 0, while the same command with
`--skip-nx-cache` surfaced the genuine `TS2353` on `index.spec.ts:105`. This is the T-06-03-02
false-pass class, pre-existing, and unrelated to the four proposals -- recorded here rather than
fixed, since it is outside this task's scope. Mitigation used during execution: every post-task
`typecheck` from Task 2 onward, plus the four-commit bisect re-verification, ran with
`--skip-nx-cache`. Tasks 1 and 2 also changed source files, which busts the hash regardless.
Worth a follow-up quick task (add the spec fileset to the `typecheck` inputs, or drop specs from the
`tsconfig.json` the target builds).

## Out-of-scope items confirmed untouched

- No `enableCrossOsArchive`, and nothing that makes a publish leg mirror another OS's entries.
- U2 (`nx-cache-cafe<runid>` Linux-only entries): not touched.
- `writeCountSummary` NOT widened -- still `[metric, number]` pairs only; the row label carries the
  subset relation, as the plan requires. `packages/github-cache/src/lib/summary.ts` is unchanged.
- The all-miss gate predicate: byte-identical (see above).
- No live mirror asset in release 354838660 / shard `cache-mirror-202607` was read, modified, or
  deleted; no network call was made during execution.
- Branch NOT pushed; no PR opened. `gsd/debug-windows-publish-one-asset` is 6 commits ahead of
  `origin/main` (`24a2597` the debug report, `b32b5c8` the planning wip commit, plus these four),
  0 behind, unpushed.

## Files changed across the four commits

| file | commits |
|---|---|
| `packages/github-cache/src/publish/publish-mirror.ts` | 1, 2 |
| `packages/github-cache/src/publish/publish-mirror.spec.ts` | 1, 2 |
| `packages/github-cache/src/action/index.ts` | 1 |
| `packages/github-cache/src/action/index.spec.ts` | 1 |
| `docs/advanced.md` | 3 |
| `.planning/research/PITFALLS.md` | 4 |

Test count: 430 before -> 433 after (+1 summary-row spec in commit 1, +2 duplicate-key specs in
commit 2).
