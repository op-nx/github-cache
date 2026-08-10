---
phase: 08-nx-task-hash-parity
reviewed: 2026-07-28T13:01:37Z
depth: deep
files_reviewed: 11
files_reviewed_list:
  - capture-hashes.mjs
  - packages/github-cache/src/hash-parity/compare.ts
  - packages/github-cache/src/hash-parity/compare.spec.ts
  - packages/github-cache/src/hash-parity/assert-parity.ts
  - packages/github-cache/src/nx-target-inputs.spec.ts
  - packages/github-cache/pack-check.cjs
  - packages/github-cache/package.json
  - package.json
  - nx.json
  - .github/workflows/ci.yml
  - .fallowrc.jsonc
findings:
  critical: 0
  warning: 5
  info: 8
  total: 13
status: issues_found
---

# Phase 8: Code Review Report

**Reviewed:** 2026-07-28T13:01:37Z
**Depth:** deep
**Files Reviewed:** 11
**Status:** issues_found

## Summary

No BLOCKER. I attacked the false-green question hardest, because the phase brief
names it and the repo's own history justifies the paranoia, and I could not
construct a path where a malformed, truncated, empty, absent, or single-leg
record yields a PASS. Every hole I probed was already closed, and several were
closed by a mechanism I verified rather than read:

- **The instrument does not drift from Nx.** I ran `capture-hashes.mjs` on this
  Windows workstation and cross-checked its four cacheable numbers against
  `.nx/cache/`, whose subdirectories Nx names by task hash. `lint` came back
  `16122270460632698382` from the instrument, and `nx run-many -t lint
  --skip-nx-cache` at the same commit wrote `.nx/cache/16122270460632698382`.
  `build` / `typecheck` / `test` matched their cache directories too. The
  byte-equality claim in `08-ROOT-CAUSE.md` reproduces.
- **`targetDefaults.outputs` really does override plugin inference in this Nx
  version.** `nx show project github-cache` reports `lint.outputs: []`, which can
  only come from `targetDefaults.lint.outputs` overriding `@nx/eslint`'s inferred
  `["{options.outputFile}"]`. So the seven-entry `typecheck` override is
  load-bearing rather than coincidentally equal to Windows inference.
- **The seven-entry list is complete.** I enumerated every file `tsc` has emitted
  under `dist/` and `out-tsc/` and matched each against the seven globs: 167
  files total, 31 `.js` (build's exclusive output, correctly absent), **136
  covered by 136** -- the exact number `08-ROOT-CAUSE.md` claims.
- **The CRLF hazard this repo has shipped before is not live here.** TypeScript
  6.0.3's `createCompilerHost({}).getNewLine()` returns `"\n"` even though
  `ts.sys.newLine` is `"\r\n"` on this machine, and the emitted `dist/*.d.ts`
  contain zero CR bytes. So `typecheck`'s `dependentTasksOutputFiles` input over
  build's declaration output is OS-invariant by construction, not by luck.
- **`discriminator` really discriminates.** The captured `integration` node map
  carries `runtime:node -p process.platform`; `build`'s does not. All of
  `build` / `typecheck` / `lint` share one identical
  `@op-nx/github-cache:ProjectConfiguration` node hash, which is exactly the
  root-cause story the phase tells.
- The two specs pass (47 tests), `fallow dead-code --fail-on-issues` is clean
  (53 entry points), `nx run-many -t lint` is clean, and all eleven files are
  pure ASCII.

The five WARNINGs are hardening, not correctness reversals. The sharpest is
WR-01: the log-grep that ci.yml presents as an *independent* second signal is
satisfiable by content the failing path itself prints, so it is only a real
second signal because the exit code independently fails the step first. WR-02 is
the one substantive design gap the phase's very extensive `outputs` rationale
never mentions: 63 of `typecheck`'s 136 declared output files are also `build`'s
declared outputs, including one incremental-state file the two targets write with
contradictory compiler options.

**On the structural findings:** I judged `compare.ts:shapeFault` (cognitive
14/18) and it is **not** a defect -- see the section below. Do not refactor it.

## Structural Findings (fallow)

Produced by `fallow audit --format json --quiet --max-crap 30 --changed-since 8c44cc7`
(fallow 3.6.0). Verdict FAIL on `--gate new-only`. dead_code_issues 0,
complexity_findings 8, max_cyclomatic 14, duplication_clone_groups 0.

| path | fn | line | cyclo | cognitive | lines | severity | crap |
|---|---|---|---|---|---|---|---|
| src/hash-parity/compare.ts | shapeFault | 141 | 14 | 18 | 61 | (high) | - |
| capture-hashes.mjs | diff | 477 | 12 | 13 | 46 | critical | 156 |
| pack-check.cjs | main | 157 | 8 | 11 | 44 | high | 72 |
| capture-hashes.mjs | capture | 313 | 7 | 7 | 79 | high | 56 |
| capture-hashes.mjs | partition | 419 | 6 | 8 | 28 | moderate | 42 |
| capture-hashes.mjs | parseArgs | 109 | 5 | 7 | 33 | moderate | 30 |
| capture-hashes.mjs | flatten | 394 | 5 | 5 | 13 | moderate | 30 |
| capture-hashes.mjs | printPartition | 453 | 5 | 4 | 22 | moderate | 30 |

**Reviewer judgement, per finding:**

- **`shapeFault` 14/18 -- NOT a defect, and refactoring it would make the gate
  worse.** The function is a flat sequence of nine early-return guards plus two
  `for` loops; maximum nesting is 2 and there is no compound condition anywhere.
  Every branch corresponds to a *named* failure the spec exercises
  (`compare.spec.ts:302-352` drives six of them plus the not-an-object case). The
  score measures the *size of the fault taxonomy*, not tangled control flow.
  Splitting it into per-section helpers would add indirection and remove zero
  branches. The one real bug in it is WR-01's unescaped interpolation, which has
  nothing to do with its complexity.
- **The `capture-hashes.mjs` and `pack-check.cjs` CRAP numbers are metric
  artefacts**, as the pre-pass itself flags: `coverage_tier: "none"` cubes into
  the CRAP formula, and both files are dev-only by decision (D-19 for the
  instrument, pre-publish guard for pack-check). `diff`'s cyclo 12 is three
  sequential concerns in one print function (arg validation, per-target loop,
  projectConfiguration partition); splitting a dev CLI's output formatter buys
  nothing. Not reported.
- `capture` at 79 lines is 40 lines of record construction with a comment per
  field. Not reported.
- `dead_code_issues: 0` and `duplication_clone_groups: 0` are consistent with
  what I found independently: `fallow dead-code --fail-on-issues` passes, and the
  deliberate `partition`/`flatten` duplication between the instrument and the
  comparator turns out to be *zero lines*, because `compare.ts` does no set
  arithmetic over node maps at all (only an emptiness check).

## Narrative Findings (AI reviewer)

### WR-01: the "prove the comparison ran" grep is forgeable from record content

**Classification:** WARNING
**Files:**
`packages/github-cache/src/hash-parity/compare.ts:172,176,180`,
`packages/github-cache/src/hash-parity/assert-parity.ts:42,78`,
`.github/workflows/ci.yml:742`

**Issue:** `ci.yml:691-702` states that the grep is a *second, independent*
signal on top of the exit code -- "it asserts the comparison actually RAN and
PRINTED its verdict". It is not independent, because `shapeFault` interpolates a
**record-controlled** key straight into the failure detail:

```ts
for (const [name, entry] of Object.entries(targets)) {
  if (!isPlainObject(entry)) {
    return `\`targets.${name}\` is not an object`;   // compare.ts:172
```

`name` is a key of the downloaded JSON. `assert-parity.ts:78` prints that detail
verbatim, and the step pipes both streams into the grepped log
(`... 2>&1 | tee hash-parity.log`). A record carrying a target key containing a
newline followed by `hash-parity: PARITY OK` therefore produces a log the grep
matches -- on the FAILURE path. Anchoring alone does not fix it, because the
injected key can carry the newline.

The step is still RED today, but only for the reason D-23 says is insufficient on
its own: `process.exitCode = 1` plus `pipefail` aborts the script before `grep`
ever runs. So the composite gate holds and the *second* signal does not. Both the
success and failure lines are also unprefixed, so nothing distinguishes
"comparator printed this" from "comparator echoed this".

**Fix:** escape the untrusted segment at the point of interpolation, and anchor
the grep so the failure line cannot satisfy it:

```ts
// compare.ts -- JSON.stringify escapes newlines and backticks
return `targets[${JSON.stringify(name)}] is not an object`;
```

```yaml
# ci.yml -- the failure line starts `hash-parity: PARITY FAILED`, so ^ excludes it
grep -q '^hash-parity: PARITY OK' hash-parity.log
```

---

### WR-02: `typecheck.outputs` overlaps `build.outputs` on 63 of its 136 files, including a shared tsbuildinfo the two targets write with contradictory options

**Classification:** WARNING
**Files:** `nx.json:134-142`, `packages/github-cache/src/nx-target-inputs.spec.ts:172-182`

**Issue:** Measured, not inferred. Nx resolves `build.outputs` to
`["{projectRoot}/dist/**/*.{js,cjs,mjs,jsx,d.ts,d.cts,d.mts}{,.map}",
"{projectRoot}/dist/tsconfig.lib.tsbuildinfo"]`. Three of `typecheck`'s seven new
entries are subsets of that:

- `{projectRoot}/dist/**/*.{d.ts,d.cts,d.mts}` (31 files here)
- `{projectRoot}/dist/**/*.{d.ts,d.cts,d.mts}.map` (31 files here)
- `{projectRoot}/dist/tsconfig.lib.tsbuildinfo` (1 file)

That is **63 of typecheck's 136 output files declared as outputs of two cached
targets in the same project**, on a `dependsOn` edge (`typecheck` dependsOn
`build`). The spec pins the list and the surrounding 30-line rationale explains
why entry 1 matches nothing -- but nowhere does either mention that entries 2-4
are already `build`'s.

The concrete consequence is the shared `dist/tsconfig.lib.tsbuildinfo`. I read
the current one: it records `"emitDeclarationOnly": false`, i.e. it was last
written by `build` (`tsc --build tsconfig.lib.json`). `typecheck` runs
`tsc --build tsconfig.json --emitDeclarationOnly`, which writes the same path
with `emitDeclarationOnly: true`. So two targets own one incremental-state file
and write mutually inconsistent contents into it, and whichever target's cache is
restored last decides the on-disk state -- in a `typecheck` run that is always
`typecheck`, leaving a buildinfo asserting "no JS emitted" beside 31 emitted
`.js` files.

I could not turn that into data loss: `tsc` fingerprints its options into the
buildinfo, so a later `build` cache MISS detects the mismatch and rebuilds, and a
`build` cache HIT restores build's own consistent copy. The residual cost is a
guaranteed full declaration re-emit on every `typecheck` run plus 63 duplicated
files in a second cache entry that ci.yml's `publish` job mirrors to a public
Release. But this is exactly the class the rationale says the field exists to
prevent -- "`outputs` is what Nx CACHES and RESTORES" -- and it is unremarked.

**Fix:** drop the entry `build` already owns, since `build` caches and restores it
correctly and typecheck's copy is the misleading one:

```jsonc
"typecheck": {
  "outputs": [
    "{projectRoot}/tsconfig.tsbuildinfo",
    "{projectRoot}/dist/**/*.{d.ts,d.cts,d.mts}",
    "{projectRoot}/dist/**/*.{d.ts,d.cts,d.mts}.map",
    // dropped: {projectRoot}/dist/tsconfig.lib.tsbuildinfo -- build's output,
    // and typecheck writes it with emitDeclarationOnly:true, which contradicts
    // the .js files build emitted. build caches/restores it correctly.
    "{projectRoot}/out-tsc/vitest/**/*.{d.ts,d.cts,d.mts}",
    "{projectRoot}/out-tsc/vitest/**/*.{d.ts,d.cts,d.mts}.map",
    "{projectRoot}/out-tsc/vitest/tsconfig.spec.tsbuildinfo"
  ],
```

If the seven-entry list must stay verbatim to match plugin inference (a defensible
reading of the existing rationale), then at minimum extend the spec comment to
record the overlap and why it is accepted -- the current comment reads as though
the overlap was not considered.

---

### WR-03: the seven `REQUIRED_META_KEYS` are validated per record and never compared across the two, so the "at ONE commit" invariant is unenforced

**Classification:** WARNING
**Files:**
`packages/github-cache/src/hash-parity/compare.ts:77-85,250-294`,
`.github/workflows/ci.yml:525-535`

**Issue:** `ci.yml:531-535` claims the instrument records both `meta.commit` and
`meta.githubSha` "precisely so this is CHECKABLE rather than assumed: a record
whose two fields DISAGREE is the signal that this pin stopped working". Nothing
checks it. `git grep githubSha` over the tree returns only that comment, the
instrument's emit site, and the spec's fixture -- no comparison anywhere.

I confirmed the comparator's behaviour by running the built
`compareHashParity` against crafted pairs. It returns `ok: true` for every one of
these:

```
PASS  <- different commit on each leg
PASS  <- different nxVersion on each leg
PASS  <- different arch on each leg
PASS  <- graphState warm vs cold
PASS  <- installMode ci vs install
```

`meta.os` is the only one of the seven required keys that is compared across the
pair (`compare.ts:266`). The other six are asserted non-empty and then dropped.

Honest scoping, so this is not overstated: a cross-commit **green** is not
substantively wrong -- an Nx task hash covers its inputs, so two matching
invariant hashes mean the trees were input-identical whatever the SHAs. And as
wired, both artifacts always come from one run under one `ref:` expression, so
drift is not reachable through GitHub's mechanics. The live cost is
**diagnostic**: a mismatched `nxVersion` or `commit` produces
`invariant-target-diverged` -- a reason that reads as an OS-invariance regression
when the real defect is that the two legs measured different things. That is the
same wrong-blame class `duplicate-platform` was added to eliminate, one field
over. It also matters for the documented local use over hand-collected records
(`08-ROOT-CAUSE.md`'s two workstation observation points).

**Fix:** add one clause before clause (a), mirroring `duplicate-platform`:

```ts
for (const key of ['commit', 'nxVersion', 'arch'] as const) {
  if (a.meta[key] !== b.meta[key]) {
    return {
      ok: false,
      reason: 'not-like-for-like',
      detail:
        `\`meta.${key}\` differs between the legs (${a.meta.os}=${a.meta[key]} vs ` +
        `${b.meta.os}=${b.meta[key]}), so the two records did not measure the same ` +
        'thing. Without this clause a later clause reports a DIVERGENCE, which reads ' +
        'as an OS-invariance regression when the real defect is a broken checkout pin ' +
        '(ci.yml CHECKOUT REF) or an nx version skew between the legs.',
    };
  }
}
```

Add `'not-like-for-like'` to `ParityFailureReason` and one negative per key to
the spec.

---

### WR-04: `discriminator.stdout` / `stderr` are required present, then never read

**Classification:** WARNING
**File:** `packages/github-cache/src/hash-parity/compare.ts:184-198`

**Issue:** `shapeFault` requires both streams present as strings, with a comment
grounding the requirement in attribution: "a record missing one cannot explain
why `integration` diverged (D-04, PARITY-06)". No code reads either value --
`compare.ts` and `assert-parity.ts` both stop at the shape check. So the record
carries the one direct measurement of whether the declared discriminator actually
discriminated on these two legs, and the comparator throws it away.

Verified: the comparator returns `ok: true` for a pair whose two
`discriminator.stdout` values are **identical** (`"linux\n"` on both legs) while
the two `integration` hashes still differ:

```
PASS  <- discriminator stdout IDENTICAL on both legs (inert discriminator, hashes faked divergent)
PASS  <- discriminator stdout does not match meta.os
```

That is precisely the state the module header argues is impossible: "with every
other input demonstrably shared, the only surviving explanation for a divergent
`integration` is the declared discriminator". The record can prove or refute that
premise directly, and the code declines to look. The gap is largely covered from
the other side -- `nx-target-inputs.spec.ts:329-336` pins the command string
byte-identical and an inert discriminator would trip clause (b) -- so this is
missing corroboration, not a live false-green. It is also two lines to close.

**Fix:** after clause (b), turn the collected evidence into an assertion:

```ts
if (a.discriminator.stdout === b.discriminator.stdout) {
  return {
    ok: false,
    reason: 'discriminator-not-platform-sensitive',
    detail:
      `the platform discriminator printed the same value on both legs ` +
      `(${JSON.stringify(a.discriminator.stdout)} on ${a.meta.os} and ${b.meta.os}), ` +
      `so a divergent \`${DIVERGENT_TARGET}\` hash is NOT attributable to it -- ` +
      'some other input became OS-sensitive and clause (c) will not see it.',
  };
}
```

Alternatively, if the streams are genuinely only meant as recorded evidence, drop
them from `HashParityRecord` and `shapeFault` -- the header's own rule is that a
field "this module neither checks nor uses" should not be modelled, and a
required-but-unread field is the same assertion in a different costume.

---

### WR-05: `pack-check.cjs` calls `process.exit()` immediately after writing its operator message, which can truncate it on the CI runner

**Classification:** WARNING
**File:** `packages/github-cache/pack-check.cjs:181-199`

**Issue:** Both terminal paths write a multi-line message and then exit
synchronously:

```js
process.stderr.write(`pack-check: the ${PACKAGE_NAME} tarball file list is WRONG:\n` + ...);
process.exit(1);                                     // :191
...
process.stdout.write(`pack-check: ${PACKAGE_NAME} tarball ships ...`);
process.exit(0);                                     // :199
```

Node's `process.stdout`/`process.stderr` are **asynchronous when they are pipes on
POSIX**, and `process.exit()` is documented to truncate pending writes. In CI the
guard runs as `npm run pack:check` on `ubuntu-24.04-arm`, where the runner
captures step output through a pipe -- so the failure path can lose exactly the
enumerated `LEAK:` / `MISSING:` list that makes the red job actionable. This is
the same hazard `assert-parity.ts:34-38` explicitly reasons about and avoids
("setting `process.exitCode` lets stderr flush instead of truncating
mid-detail"); `pack-check.cjs` predates that reasoning and did not get it.

The `process.exit` calls are pre-existing rather than introduced by this phase,
but this phase rewrote both messages (adding the derived `DIST_SUBTREE_LIST`) and
the file is in scope.

**Fix:** adopt the sibling's pattern -- the script is a straight-line `main()`, so
no control flow changes:

```js
if (problems.length > 0) {
  process.stderr.write(...);
  process.exitCode = 1;

  return;
}

process.stdout.write(...);
```

## Info

### IN-01: `partition` uses the `in` operator, which walks the prototype chain

**Classification:** Info
**File:** `capture-hashes.mjs:425-443`

`if (!(key in b))` and `if (!(key in a))` return `true` for inherited names, so a
key literally named `constructor`, `toString`, `valueOf`, or `__proto__` is
misclassified as present when it is absent. Node-map keys (`npm:<pkg>`,
`<project>:ProjectConfiguration`, `runtime:<cmd>`, project-relative paths) and
`flatten`'s dotted paths make this unlikely, but this function is the tool you
reach for *when the gate is already red*, and the failure mode is a silently
hidden difference. Fix: `Object.hasOwn(b, key)` / `Object.hasOwn(a, key)`.

### IN-02: `flatten` emits no leaf for an empty object or array

**Classification:** Info
**File:** `capture-hashes.mjs:394-406`

`Object.entries({})` and `Object.entries([])` yield nothing, so the recursion
returns without assigning `out[prefix]`. A `projectConfiguration` field that is
`[]` on one leg and `{}` on the other therefore vanishes from both partitions and
is reported as no difference at all; a field empty on both is silently excluded
from the `same` count. Relevant here because `lint.outputs` is `[]`. Fix: emit a
sentinel leaf before recursing when `Object.keys(value).length === 0`.

### IN-03: `--diff` reports "MISSING from A" when the target is missing from both

**Classification:** Info
**File:** `capture-hashes.mjs:495-500`

`MISSING from ${!recordA ? 'A' : 'B'}` cannot say "both". Fix:
`${!recordA && !recordB ? 'BOTH' : !recordA ? 'A' : 'B'}`.

### IN-04: `typeof input === 'object'` without a null guard, in the file that states the rule against it

**Classification:** Info
**File:** `packages/github-cache/src/nx-target-inputs.spec.ts:263-267,301-303,330-333`

`typeof null === 'object'`, so `'runtime' in input` throws
`TypeError: Cannot use 'in' operator to search for 'runtime' in null` if any
`inputs` array ever contains a JSON `null`. The new test at :330-333 has this
shape, and it sits four lines below a comment (:293-300) explaining that a type on
a value parsed from disk "is an ASSERTION about the file, not a check of it" --
which is why the guard immediately above it uses `target.inputs?.some(...)`. The
instrument gets this right at `capture-hashes.mjs:222-227`
(`typeof input === 'object' && input !== null && ...`). Red-as-a-crash rather than
green, so it is not a false pass. Fix: add `&& input !== null` at all three sites
(and `entry !== null` in `registrationFor` at :63-68).

### IN-05: the `.env` predicate has a dead disjunct and a nested-path gap

**Classification:** Info
**File:** `packages/github-cache/pack-check.cjs:133`

```js
test: (p) => p === '.env' || p.startsWith('.env') || p.endsWith('/.env'),
```

`p === '.env'` is unreachable -- `startsWith('.env')` already covers it. And the
third disjunct matches only a path ending in exactly `/.env`, so
`dist/config/.env.production` is not caught while root-level `.env.production`
is. Fix: `/(^|\/)\.env($|\.)/.test(p)`.

### IN-06: `build.outputs` is still left to plugin inference while `typecheck.outputs` is normalised

**Classification:** Info
**File:** `nx.json:104-155`

The root cause is that `@nx/js/typescript` inferred `typecheck.outputs`
differently per OS, and the fix declares that one field in `targetDefaults`. The
same plugin also infers `build.outputs`
(`["{projectRoot}/dist/**/*.{js,cjs,mjs,jsx,d.ts,d.cts,d.mts}{,.map}",
"{projectRoot}/dist/tsconfig.lib.tsbuildinfo"]`), and that field is left to
inference -- so the identical divergence recurring there would break all four
invariant targets through the same shared `ProjectConfiguration` node. Plausibly
less exposed (build's outputs derive from one config's `outDir`, while
typecheck's require walking the solution's `references`, which is where a
path-comparison difference would bite), and the CI gate would catch a regression
loudly. Recorded as an accepted residual rather than a fix request, because
declaring it needs the same enumeration work entry-by-entry that
`08-ROOT-CAUSE.md` did for typecheck.

### IN-07: both hash-parity jobs pin to the PR head SHA, so the merge result is never gated pre-merge

**Classification:** Info
**Files:** `.github/workflows/ci.yml:566,720`

`ref: ${{ github.event.pull_request.head.sha || github.sha }}` is argued at
:525-535 and :668-674 in one direction -- a default-branch checkout could carry a
weakened comparator that silently judges this branch's records. Correct, and the
right trade to take. The residual in the other direction is worth writing down:
the gate never measures the merge tree, so a divergence introduced by the
*default branch* between branch-point and merge lands red on `main`'s push run
rather than on the PR. Both directions have a hole; this one cannot produce a
false green, which is why it is the right choice. No fix; recorded so a future
reader does not rediscover it as a bug.

### IN-08: `--diff` swallows a following flag as a record path

**Classification:** Info
**File:** `capture-hashes.mjs:127-131`

`parsed.diff = [argv[index + 1], argv[index + 2]]; index += 2;` consumes the next
two tokens unconditionally. `node capture-hashes.mjs --diff --out x` yields
`diff = ['--out', 'x']`, passes the mutual-exclusion check at :527 (because
`--out` was consumed as a path, so `parsed.out` is still `undefined`), and fails
with `ENOENT: no such file or directory, open '--out'` instead of the usage error
the function already knows how to print. Fix: reject a value starting with `--` in
the `--diff` branch and fall through to the usage error at :133-137.

---

_Reviewed: 2026-07-28T13:01:37Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
