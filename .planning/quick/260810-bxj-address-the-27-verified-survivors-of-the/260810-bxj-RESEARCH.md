# Quick Task 260810-bxj: Address the 27 verified survivors of the thermos review of PR 16 - Research

**Researched:** 2026-08-10
**Domain:** ESLint 9 flat-config rule semantics, Nx 23 task-hash inputs, Vitest 4 fake timers,
GitHub Actions workflow guard shape
**Confidence:** HIGH -- every claim below was MEASURED in this repo in this session (apply, run,
revert). No web source was consulted and none was needed.

## Summary

The four mechanisms were probed by applying each candidate fix, running the real toolchain, and
reverting. Three of the four are safe and their exact shape is now measured. One (Q2) rotates every
task hash and breaks one existing guard -- both effects are now quantified rather than feared, and
the rotation turns out to be caused by nx.json's own bytes rather than by `namedInputs`, which
changes the risk verdict.

**Primary recommendation:** Q1, Q3 and Q4 are safe and have measured, copy-ready shapes. Q2 is safe
too, but only with two mandatory companion edits in the SAME commit (repair `nx-target-inputs.spec.ts`'s
LINT-04 guard; accept a one-time uniform hash rotation). If the executor is unwilling to accept the
rotation, defer T4-7 rather than half-doing it.

**Working tree state after this research:** clean. `nx.json`, `eslint.config.mjs` and
`read-back.spec.ts` were each temporarily modified to take a measurement and reverted
(`git status --short` shows only the untracked planning dir).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **DEC-1** -- a non-benign sibling in a 422 body is FATAL. Mirror the `ensureShardRelease`
  pattern (`publish-mirror.ts:366-395`) onto the ASSET-UPLOAD path. Benign only on a positively
  recognised signature read through a FIELD-SCOPED accessor and anchored textually; every other
  error code in the array is FATAL. Rename the spec at `publish-mirror.spec.ts:513`; correct the
  three comments at `octokit-fault-reason.ts:167`, `publish-mirror.ts:989`, and the block above the
  spec. `publish-mirror.ts:341` is the model. DO NOT RE-OPEN.
- **DEC-2** -- scope is 27 items; the six structural splits (T4-1 `ci.yml`, T4-2
  `publish-mirror.ts`, T4-3 `dogfood-cross-os.spec.ts`, T4-4 `capture-hashes.mjs`, T4-5
  `actions-cache-backend.spec.ts`, T4-8 `ReadOnlyBackend`) are DEFERRED to v0.0.3 and recorded in
  `260810-bxj-deferred-items.md`. DO NOT EXPAND INTO THEM.
- **Census claims** -- DELETE the number, or replace it with a programmatic count. Never
  hand-author a fourth one.
- **T1-5** -- make the Phase 13 guard LOCALIZING, not a cardinality check. The invariant is
  per-job, so the guard must be per-job. A new non-conforming Windows job must redden it.
- **T1-2** -- correct `docs/advanced.md`; do NOT widen `cleanup.ts` / `isShardTag`.
- **T1-3** -- close the `node:process` family, not just one token; fold in the `process.env`
  denylist widening; prove it with a test that FIRES via the ESLint Node API.
- **Every fix carries a check that fails if the logic breaks.** Byte-pinning indentation is not
  such a check. Where a fix is prose-deletion only, the check is that no surviving assertion
  depends on the deleted claim.
- **Commit granularity** -- atomic, grouped by tier and file. `retention.ts` is in the action
  bundle, so any bundled-source change needs the regenerated bundle in the SAME commit or
  `check:action` fails that commit. `publish-mirror.ts` and `octokit-fault-reason.ts` are NOT
  bundled.
- **Execution** -- main tree, no worktree isolation.

### Claude's Discretion

- Exact wording of replacement comments and doc sentences, provided no new unguarded count or
  unverifiable claim is introduced.
- Whether a given T3 deletion also warrants a one-line replacement stating the current truth.
- Test placement within the existing spec files, subject to the deferred-item boundary.

### Deferred Ideas (OUT OF SCOPE)

The six T4 structural splits named in DEC-2. Also do not re-litigate the rejected/folded items:
the zstd `.cmd`-shim compression inversion stays a DOCUMENTED CEILING; the `.gitignore` gaps and
`ci.yml:1508`'s missing jq element guard fold into T3/T1 as cheap fixes;
`windows-regression-detector.yml` having never executed is OPEN BY DESIGN.
</user_constraints>

## Project Constraints (from CLAUDE.md / AGENTS.md)

- Run tasks through `nx`, prefixed with the package manager (`npm exec nx`, `npx nx`). Never guess
  CLI flags.
- ASCII only in authored content. No emoji, box-drawing, em/en dashes, curly quotes, ellipsis.
- `git grep` for tracked files; `rg` for gitignored paths (`node_modules`). Never the `grep`
  command or the Grep tool. Pipe filtering is `| rg`.
- Never `git add .` / `-A` / `-u`. Stage specific files.
- Capture repeat/battery test output through `tee` with the real exit code via `PIPESTATUS[0]`
  (Nx caches terminal output only for SUCCESSFUL runs, so a re-run destroys a failure's evidence).
- Blank lines around control flow and returns; always braces. Prettier with `singleQuote: true`.
- Do not add a dependency for what a few lines can do.

## Installed toolchain (verified)

| Tool | Version | Source |
|------|---------|--------|
| eslint | 9.39.5 | `node_modules/eslint/package.json` [VERIFIED] |
| typescript-eslint | 8.65.0 | `node_modules/typescript-eslint/package.json` [VERIFIED] |
| nx | 23.1.0 | `node_modules/nx/package.json` [VERIFIED] |
| vitest | 4.1.10 | `node_modules/vitest/package.json` [VERIFIED] |

No package is added by any of the four fixes, so there is no Package Legitimacy Audit to run.

---

## Q1. Banning the `node:process` platform-read family

**VERDICT: SAFE, and the gap is WIDER than the review reported. Two `no-restricted-imports` `paths`
entries plus two one-token widenings close all 12 shapes with ZERO new selectors and ZERO findings
on the real tree. No selector is needed for the aliased default import.**

### The gap, reproduced

Probed all 12 candidate shapes through the REAL root config with the ESLint Node API at
`packages/github-cache/src/__lint_fixture__.spec.ts`. Every one reported `[]`:

| Shape | Before | After |
|-------|--------|-------|
| `import { platform } from 'node:process'` | MISS | `no-restricted-imports` |
| `import { arch } from 'node:process'` | MISS | `no-restricted-imports` |
| `import { platform } from 'process'` (bare) | MISS | `no-restricted-imports` |
| `import proc from 'node:process'; proc.platform` | MISS | `no-restricted-imports` |
| `import * as proc from 'node:process'; proc.platform` | MISS | `no-restricted-imports` |
| `import { env } from 'node:process'; env.OS` | MISS | `no-restricted-imports` |
| `await import('node:process')` | MISS | `no-restricted-syntax` |
| `process.env.RUNNER_TEMP` / `USERPROFILE` / `TEMP` / `HOME` / `windir` | MISS (5) | `no-restricted-syntax` (5) |
| CONTROL `process.platform` (P1) | CAUGHT | CAUGHT |
| CONTROL `process.env.CI` | legal | legal |
| CONTROL `import local from './local.js'` | legal | legal |

The review named three shapes. Two more are missing that it did not: the NAMESPACE import
(`import * as proc from 'node:process'`) and the DYNAMIC import (`await import('node:process')`).
The namespace one matters most -- `eslint.config.mjs:283` states a namespace import "is reported
anyway", true for `node:os`/`node:path` and FALSE for `node:process` today, because there is no
`paths` entry to carry the synthetic `'*'` name. [VERIFIED: measured this session]

### The measured fix (four edits, all inside the existing ban object)

```js
// beside BANNED_OS_ACCESSORS / BANNED_PATH_ACCESSORS
const BANNED_PROCESS_ACCESSORS = ['default', 'platform', 'arch', 'env'];
```

```js
// two NEW `paths` entries, after the four existing ones
{ name: 'node:process', importNames: BANNED_PROCESS_ACCESSORS, message: BAN_MESSAGE },
{ name: 'process',      importNames: BANNED_PROCESS_ACCESSORS, message: BAN_MESSAGE },
```

```js
// P6, one token wider
selector: 'ImportExpression[source.value=/^(node:)?(os|path|process)$/]',
```

```js
// P8, the env denylist widened (TMP is discretionary, see below)
selector:
  "MemberExpression[computed=false][object.object.name='process'][object.property.name='env'][property.name=/^(OS|OSTYPE|RUNNER_OS|PROCESSOR_ARCHITECTURE|ComSpec|TEMP|TMP|RUNNER_TEMP|USERPROFILE|HOME|windir)$/]",
```

### Answers to the three sub-questions

1. **Are `node:process` and `process` distinct specifiers?** YES -- `paths[].name` is an exact
   string lookup, so each prefix is an independent key. This is already proven in-repo for the
   os/path pair (`lint-rules.spec.ts:402-410`, the bare-`path` row) and re-measured here for
   process: the bare-`process` row only started reporting once the second entry was added.
   [VERIFIED: measured]
2. **What selector catches an aliased default import's member access?** NONE IS NEEDED. Listing
   `'default'` in `importNames` makes `no-restricted-imports` report at the IMPORT SITE regardless
   of the local binding name, because the rule maps an `ImportDefaultSpecifier` to the synthetic
   name `'default'` and an `ImportNamespaceSpecifier` to `'*'`. `import proc from 'node:process';
   proc.platform` reported `no-restricted-imports` with no new selector. This is the same mechanism
   `eslint.config.mjs:64-72` already documents for `import osx from 'node:os'`. Do NOT add a
   P4/P5-style hardcoded-alias selector for process -- it would be dead configuration.
   `importNames` also covers the whole NAMED-import half. [VERIFIED: measured]
3. **The in-repo harness.** `packages/github-cache/src/lint-rules.spec.ts`. Exact API:
   - `new ESLint({ cwd: WORKSPACE_ROOT, warnIgnored: true })` -- the `ESLint` class from `eslint`,
     NOT `loadESLint`, NOT `calculateConfigForFile`. `overrideConfigFile` and `overrideConfig` are
     deliberately NOT passed (:81-84) so the REAL root config is loaded.
   - `await eslint.lintText(source, { filePath })` with a synthetic in-tree path
     (`UNIT_PATH = 'packages/github-cache/src/__lint_fixture__.spec.ts'`,
     `INTEGRATION_PATH = '...__lint_fixture__.integration.spec.ts'`). The file need not exist --
     ESLint's config-status check is a pure path match.
   - `lintFixture(source, filePath)` is the mandatory wrapper: it rejects the
     ignored/unconfigured state (`ignoreWarnings` = severity 1 + null ruleId + no `line`) so a
     "zero errors" verdict cannot be vacuous. `banRuleIdsOf` filters to the two ban rule ids.
   - `beforeAll` pays the 590-910ms first-`lintText` boot outside any test budget.
   - **Where the new rows go:** append to the `EVASION_SHAPES` table (`:355-442`) with
     `expected` as literal rule ids in report order, and to `FALSE_POSITIVE_CONTROLS` (`:451-504`).
     Each `EVASION_SHAPES` row is consumed by TWO `it.each` loops -- caught at `UNIT_PATH`, allowed
     at `INTEGRATION_PATH` -- so one row buys both directions. The integration-path half is
     structurally safe: `ignores` is a sibling of `files` in that config object, so anything added
     inside it is exempt there by construction.

### False-positive measurement

`npx eslint .` in `packages/github-cache` with the full widening applied: **exit 0, zero findings**.
`git grep` confirms zero existing `from 'node:process'` imports anywhere under `packages/` or
`start-cache-server/`. [VERIFIED: measured]

### Two judgement calls for the planner

- `'env'` in the accessor list is what closes `import { env } from 'node:process'; env.OS`. It
  measured clean. Keeping it is recommended; it is the only route that bypasses P8 entirely.
- `TMP` is my addition beyond the review's five (`TEMP`, `RUNNER_TEMP`, `USERPROFILE`, `HOME`,
  `windir`). It is the Windows sibling of `TEMP` and measured clean. Discretionary.

---

## Q2. Nx `namedInputs` for the shared `externalDependencies` array

**VERDICT: MECHANICALLY CORRECT and SEMANTICALLY HASH-NEUTRAL, but it ROTATES all five task hashes
and BREAKS one existing guard. Safe to do in this task ONLY with the two companion actions below in
the same commit. The rotation is caused by nx.json's BYTES, not by `namedInputs` -- so it is
unavoidable for any nx.json edit whatsoever, and it is OS-uniform, which is what keeps Phase 8's
parity claim intact.**

### Syntax (verified against the installed schema)

`node_modules/nx/schemas/nx-schema.json`: `namedInputs.additionalProperties` is `$ref
#/definitions/inputs` -- the SAME union that target `inputs` uses, and that union includes the
`{ "externalDependencies": [...] }` variant. So a named input may carry an `externalDependencies`
object. [VERIFIED: installed nx 23.1.0 schema]

```json
"namedInputs": {
  "default": ["{projectRoot}/**/*", "sharedGlobals"],
  "production": ["..."],
  "sharedGlobals": ["{workspaceRoot}/tsconfig.base.json"],
  "eslintToolchain": [
    { "externalDependencies": [
      "eslint", "@eslint/js", "typescript-eslint",
      "@eslint-community/eslint-plugin-eslint-comments"
    ] }
  ]
}
```

Referenced as a bare string from both `targetDefaults` `inputs` arrays. `test` keeps its own
`{ "externalDependencies": ["vitest"] }` beside it; `lint` replaces its object outright.
`namedInputs` definitions may NOT start with `^` (Nx throws
`namedInputs definitions cannot start with ^`), which is irrelevant here.

### Hash impact -- MEASURED, not predicted

Captured with the repo's own instrument (`node capture-hashes.mjs --install-mode install`) before
and after, then `--diff`:

| target | hash before -> after | changed nodes |
|--------|---------------------|---------------|
| build | 8506726196199557690 -> 12926935210346394794 | 1 of 428 |
| typecheck | 17697385997957809815 -> 6445003757364598414 | 1 of 429 |
| test | 2886603475654374251 -> 15016169673564632821 | 2 of 444 |
| integration | 2081383867276309848 -> 17940552092921504142 | 1 of 430 |
| lint | 15680990699241588667 -> 4916770436858835752 | 1 of 443 |

The changed node is `workspace:[{workspaceRoot}/nx.json,{workspaceRoot}/.gitignore,{workspaceRoot}/.nxignore]`
in all five cases -- nx.json's FILE CONTENT, which Nx hashes into every task. `test` additionally
moves its explicit workspace fileset because that fileset LISTS `{workspaceRoot}/nx.json`
(nx.json:56). **Zero `externalDependencies` nodes changed, and the node COUNT is identical on every
target with no `only-in-A` / `only-in-B` entries** -- so the effective hashed input set is
bit-for-bit the same set. The refactor is semantically neutral; the rotation is the file's bytes.
[VERIFIED: measured this session, records diffed]

Corroborating in-repo statement: `nx-target-inputs.spec.ts:42-46` -- "A target's `inputs` array and
nx.json's root `namedInputs` are NOT part the ProjectConfiguration hash", which is why nx.json is
wired as an explicit `test` input in the first place.

**Parity is preserved.** The rotation is a content hash of a file that `.gitattributes` forces to
LF on every platform (`* text=auto eol=lf`, with the stated reason being exactly this), so both OS
legs rotate to the SAME new value. Nothing OS-sensitive is introduced. Any nx.json edit at all --
including the ones already made in this milestone -- has this same effect, so "the refactor rotates
hashes" is not an argument specific to `namedInputs`.

### The guard it breaks -- MEASURED

`packages/github-cache/src/nx-target-inputs.spec.ts` > "lists all four ESLint packages as external
dependencies" FAILS: `expected [] to deeply equal [ ...(4) ]`. One test, 28 others pass. Cause: the
guard flatMaps `nxJson.targetDefaults.lint.inputs` looking for inline objects, and after the
refactor `lint`'s entry is the string `"eslintToolchain"`. [VERIFIED: measured]

**The repair, using Nx's own arithmetic** (house pattern -- the file already imports from this exact
internal module):

```ts
import {
  expandSingleProjectInputs,
  splitInputsIntoSelfAndDependencies,
} from 'nx/src/hasher/task-hasher.js';

function externalDependenciesOf(target: string): string[] {
  // split FIRST: `lint.inputs` contains `^default`, and expandSingleProjectInputs
  // throws `namedInputs definitions cannot start with ^` on a dependency input.
  const { selfInputs } = splitInputsIntoSelfAndDependencies(
    nxJson.targetDefaults[target].inputs,
    nxJson.namedInputs,
  );

  return expandSingleProjectInputs(selfInputs, nxJson.namedInputs).flatMap(
    (input) =>
      typeof input === 'object' && 'externalDependencies' in input
        ? (input.externalDependencies ?? [])
        : [],
  );
}
```

Measured output with the refactor applied: `lint` -> the four ESLint packages; `test` -> the same
four plus `vitest`. [VERIFIED: measured]

This also delivers the drift guard T4-7 actually wants: assert `lint`'s resolved set EQUALS the four
AND that `test`'s resolved set is a superset of it, both through the resolver -- which is a real
single-source assertion rather than two hand-synced literal arrays.

### What the executor must do

1. Repair the LINT-04 guard as above IN THE SAME COMMIT (else the commit is red).
2. Accept and record the one-time hash rotation. It invalidates nothing that gates: no tracked
   file pins a live-computed Nx hash. The literal `18442367512424001648` in
   `read-integration-hash.integration.spec.ts:155` is a HAND-AUTHORED FIXTURE value, not a
   captured hash, and is unaffected. [VERIFIED]
3. Note in the commit message that `.planning/phases/11-live-proofs-o1-o2-o3/11-hashes-{cold,warm}.json`
   are historical Phase 11 evidence records whose values no longer reproduce from HEAD. They are
   evidence of a past run, not gates -- nothing reddens -- but the provenance note keeps a future
   reader from treating a mismatch as a regression.
4. Do NOT also "tidy" the `test` entry beyond splitting out `vitest`. The five-element array must
   still resolve to the same five names.

**If the executor will not accept (2) and (3):** defer T4-7 to v0.0.3 alongside the other structural
work rather than landing a partial version. A partial version (named input added, guard not
repaired) is a red commit; a hash rotation without the provenance note is a booby trap for the next
reader of Phase 11's records.

---

## Q3. Vitest fake timers vs the shard-window arithmetic

**VERDICT: SAFE. The in-repo idiom copies verbatim with no `toFake` narrowing and no
`shouldAdvanceTime`. Measured: all 38 tests pass in 60ms with the clock pinned, and the target test
goes RED (alone) when pinned to the 31st. Use `2026-07-15T00:00:00Z`, the same literal both sibling
specs already use.**

### The in-repo idiom, verbatim

`cleanup/cleanup.spec.ts:41,58-66` and `backend/releases-backend.spec.ts:83-92` are byte-identical
in shape:

```ts
const PINNED_NOW = new Date('2026-07-15T00:00:00Z');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(PINNED_NOW);
  // ... the spec's own setup
});

afterEach(() => {
  vi.useRealTimers();
  // ... the spec's own teardown
});
```

No `vi.useFakeTimers({ toFake })` config, no `shouldAdvanceTime`, no `advanceTimersByTime`.
`releases-backend.spec.ts`'s stated reason is exactly the one that applies here: "the reader reads
`new Date()` internally, so faking the system clock is the only way to fix the window without
changing the reader's signature." [VERIFIED]

### The arithmetic, confirmed

`retention.ts:154-173` walks month-start to month-start:

```
oldest          = now - maxAgeDays * MS_PER_DAY
oldestMonthStart= UTC(oldest.year, oldest.month, 1)
cursor          = UTC(now.year, now.month, 1)   // pushes tags while cursor >= oldestMonthStart
```

`now = 2026-08-31, maxAgeDays = 30` -> `oldest = 2026-08-01` -> `oldestMonthStart = 2026-08-01` ->
exactly ONE tag. `now = 2026-08-30` -> `oldest = 2026-07-31` -> two tags. So the collapse is
confined to day 31 of a 31-day month (7 days/year), which matches the review. `read-back.ts:139`
calls `shardTagsForWindow(resolveMaxAgeDays(process.env))`, default 30. [VERIFIED]

### Fake-timer interaction with `fetchMock` and async `run()` -- MEASURED

Applied the idiom to `read-back.spec.ts` (pin in `beforeEach` before `vi.clearAllMocks()`,
`vi.useRealTimers()` first in `afterEach`, keeping `process.env` restore and
`vi.unstubAllGlobals()`) and ran the file:

- pinned to `2026-07-15T00:00:00Z`: **38 passed, 0 failed, 60ms. No hang.**
- pinned to `2026-08-31T12:00:00Z`: **exactly 1 failed** -- "resolves an asset the publisher left in
  the PREVIOUS month shard" -- with the real message `no shard in [nx-cache-202608] holds an asset
  named ...`, which is the reported defect verbatim.

[VERIFIED: both directions measured this session, then reverted]

No narrowing is needed and none should be added:

- `read-back.ts:152,258` use `AbortSignal.timeout(FETCH_TIMEOUT_MS)`. Node implements that on an
  internal unref'd timer that sinon's fake clock does not drive, and `fetchMock` resolves
  synchronously, so the abort deadline is never reached. Measured: no hang.
- Promise scheduling is unaffected -- Vitest's default `toFake` does not include `queueMicrotask`
  or `nextTick`, and both sibling specs are heavily `async` under the same plain
  `vi.useFakeTimers()`.
- `vitest.config.mts` sets no `fakeTimers` overrides; the defaults in play are
  `loopLimit: 10_000`, `shouldClearNativeTimers: true`. [VERIFIED: `node_modules/vitest/dist/chunks/defaults.*.js`]

### The pinned date

`2026-07-15T00:00:00Z`. `shardTagsForWindow(30)` yields exactly `['nx-cache-202607',
'nx-cache-202606']` -- two DISTINCT tags, mid-month, so the fixture's intent holds unambiguously:
the current shard (`202607`) 404s and the older shard (`202606`) holds the asset, and
`seenTags.length > 1` is satisfied by construction rather than by calendar luck. Reusing the exact
literal both siblings use makes the three specs read as one pinned clock. Add a one-line comment
naming the two produced tags, as `releases-backend.spec.ts:83-87` does -- that comment is what makes
the choice of date auditable instead of arbitrary.

---

## Q4. A localizing guard for the read-only-leg invariant

**VERDICT: SAFE and the predicate is now measured. The invariant is a THREE-way conjunction, not
two: Windows leg AND cache-server sidecar AND a portable Nx target. A guard keyed on "Windows leg +
portable target" alone would FALSELY demand the knob on four jobs that correctly lack it. Use regex
over raw text -- do not add a YAML parser.**

### In-repo helpers (exact APIs)

`packages/github-cache/src/test/repo-file.ts` exports:

- `WORKSPACE_ROOT_URL: URL` -- `new URL('../../../../', import.meta.url)`.
- `repoFileUrl(relativePath: string): URL`
- `readRepoFile(relativePath: string): string` -- `readFileSync(repoFileUrl(p), 'utf8')`
- `stripYamlComments(source: string): string` -- drops LINE-LEADING `#` lines only. Its own header
  records that it is NOT a blanket replacement (it also drops shell comments inside `run:` bodies).

`dogfood-cross-os.spec.ts:49-74` already composes them:

```ts
const codeLines = stripYamlComments(readRepoFile('.github/workflows/ci.yml')).split('\n');

function jobBlock(name: string): string {
  const start = codeLines.findIndex((line) => new RegExp(`^ {2}${name}:\\s*$`).test(line));
  if (start < 0) { throw new Error(`ci.yml: no job keyed \`  ${name}:\` -- ...`); }
  const rest = codeLines.slice(start + 1);
  const end = rest.findIndex((line) => /^ {2}\S/.test(line));
  return (end < 0 ? rest : rest.slice(0, end)).join('\n');
}
```

`jobBlock` throws on an absent job (deliberately loud) and returns the block as a single string.

**No spec enumerates jobs by runner today.** All three per-leg clause families hard-code the name
via `windowsLegReasons('build-windows', ...)` / `'typecheck-windows'` / `'test-windows'`
(`dogfood-cross-os.spec.ts:1242,1479,...`). The nearest precedent for reading runners is
`windows-regression-detector.spec.ts:129`, which filters `/^ {4}runs-on: /` lines -- but it asserts
about a single-job workflow and never crosses a matrix. [VERIFIED]

### Measured job census of `ci.yml` (23 jobs)

| job | runs-on | Windows leg? | sidecar | portable target | CACHE_READ_ONLY sites |
|-----|---------|--------------|---------|-----------------|----------------------|
| build | ubuntu-24.04-arm | - | YES | build | 0 |
| typecheck | ubuntu-24.04-arm | - | YES | typecheck | 0 |
| test | ubuntu-24.04-arm | - | YES | test | 0 |
| build-windows | windows-11-arm | YES | YES | build | 1 |
| typecheck-windows | windows-11-arm | YES | YES | typecheck | 1 |
| test-windows | windows-11-arm | YES | YES | test | 1 |
| integration | `${{ matrix.os }}` | YES | YES | - | 0 |
| hash-parity | `${{ matrix.os }}` | YES | - | build | 0 |
| dogfood-verify | `${{ matrix.os }}` | YES | - | build | 0 |
| publish | `${{ matrix.os }}` | YES | - | build | 0 |
| publish-verify | `${{ matrix.os }}` | YES | - | build | 0 |
| consumer-smoke | ubuntu-24.04-arm | - | YES | - | 0 |
| (11 others) | ubuntu-24.04-arm | - | - | build/typecheck/none | 0 |

[VERIFIED: measured by enumerating `jobs:` with `jobBlock` semantics this session]

**Eight Windows legs, not three** -- confirming the T3 finding about `ci.yml:12`. Three declare
`runs-on: windows-11-arm` literally; five carry `runs-on: ${{ matrix.os }}` with
`os: [ubuntu-24.04-arm, windows-11-arm]`.

**Crucially, four of the five matrix Windows legs DO run `npm run build`** (hash-parity:1712,
dogfood-verify:2091, publish:2418, publish-verify:2589) and correctly carry NO knob -- because they
have no `- uses: ./start-cache-server` step, so Nx resolves through its LOCAL cache only and there
is nothing to write. `ci.yml:1709-1711` states this explicitly: "Still no sidecar block: `npm run
build` here resolves through Nx's LOCAL cache only, because the cache client is env-driven and this
job sets none of those variables." `integration` is the mirror case: sidecar on a Windows leg, but
it runs the `integration` target, which is OS-sensitive by design and not portable -- knob 0, also
correct.

### Recommended guard shape

Derive the leg list, then assert a PARTITION:

1. Slice `codeLines` from the `jobs:` line (column 0, `ci.yml:38`) to EOF **before** enumerating
   `^ {2}<name>:$`. Without the slice the `on:` trigger keys `push:` and `pull_request:` are also
   at two-space indent with a bare colon and enter the census as phantom jobs -- measured. The
   only top-level keys are `name`, `on`, `permissions`, `concurrency`, `jobs`.
2. For each job block derive:
   - `windowsLeg` = `/windows-11-arm/` in the `runs-on:` value, OR (`runs-on` is
     `${{ matrix.os }}` AND `/windows-11-arm/` appears in the block's `os: [...]` list). This is
     what covers BOTH shapes.
   - `sidecar` = `/-\s*uses:\s*\.\/start-cache-server/` present.
   - `portable` = `/npm run (build|typecheck|test)\b/` present.
   - `knobSites` = count of `CACHE_READ_ONLY` occurrences.
3. Assert both directions:
   - Every job with `windowsLeg && sidecar && portable` has `knobSites >= 1`, AND writes the knob
     BEFORE its sidecar step (reuse the existing ordering clause, now driven by the derived list
     instead of three literals). Today this set is exactly
     `{build-windows, typecheck-windows, test-windows}`.
   - Every job NOT in that set has `knobSites === 0`. This preserves everything
     `READ_ONLY_LEG_SITES = 3` was protecting -- "no producer gets the knob, not by a hoist to a
     workflow-level `env:` block either" -- while being LOCALIZING: it names the offending job.
   - One non-vacuity control: the derived set is non-empty and the census found more than a
     handful of jobs (a broken slice or a changed indent yields an empty census, which would make
     both clauses pass trivially). Prefer asserting the derived set EQUALS the three names, so a
     new conforming Windows consumer is a deliberate, reviewable one-line edit rather than a
     silent widening.

`READ_ONLY_LEG_SITES = 3` and its long justification comment are then deleted, and per the census
rule the replacement must not introduce a new hand-authored number -- clause 3's set equality is the
programmatic form.

A NEW non-conforming Windows job reddens clause 1 (in the set, no knob). A DELETED leg reddens
clause 3's set equality. A knob copied onto a producer reddens clause 2. All three failure modes the
cardinality check could not distinguish are now separately attributable.

### YAML parser

**Do not add one, and do not import the transitive ones.** `yaml@2.9.0` and `js-yaml@4.3.0 `are
present in top-level `node_modules` but are TRANSITIVE -- neither appears in `package.json`'s 20
`devDependencies`. Importing an undeclared package would depend on hoisting, would sit outside the
`lint`/`test` `externalDependencies` input lists (the exact LINT-04 stale-cache hole), and
`pinned-deps.spec.ts` exists to police the declared set. Every existing workflow guard in this repo
uses regex over `stripYamlComments(readRepoFile(...))` text, and the guard above needs nothing more.
[VERIFIED: `node_modules` probed with `rg`/`require`; `package.json` read]

---

## Don't Hand-Roll

| Problem | Don't build | Use instead |
|---------|-------------|-------------|
| Reading a repo file from a spec | a fourth `new URL('../../../../', import.meta.url)` | `readRepoFile` / `repoFileUrl` from `src/test/repo-file.ts` (this is T4-6's whole point) |
| Stripping YAML comments | a sixth line-leading `#` filter | `stripYamlComments` from the same module |
| Extracting a ci.yml job | a bespoke indent scanner | `jobBlock` in `dogfood-cross-os.spec.ts` (keep it there -- DEC-2 defers splitting that file) |
| Resolving Nx named inputs | a hand-rolled expander | `splitInputsIntoSelfAndDependencies` + `expandSingleProjectInputs` from `nx/src/hasher/task-hasher.js` |
| Measuring a task-hash change | reasoning about it | `node capture-hashes.mjs --install-mode install --out <p>` then `--diff <a> <b>` |
| Proving a lint rule fires | asserting config text | `ESLint` + `lintText` via `lint-rules.spec.ts`'s `lintFixture` |
| Parsing a workflow | a YAML dependency | regex over the stripped text |

## Common Pitfalls

1. **A cardinality assertion cannot localize.** Q4's whole subject. "Appears N times" is satisfiable
   by deletion and blind to a new site. Assert a partition over a derived set.
2. **A widened ban that is never measured on the real tree.** Q1's widening measured zero findings;
   an unmeasured one would surface as a red `lint` job on an unrelated commit. Run `npx eslint .` in
   the package before committing.
3. **`expandSingleProjectInputs` throws on `^`-prefixed inputs.** Split first. `lint.inputs`
   contains `^default`, so the naive call fails immediately -- a failure that reads as "the API is
   wrong" rather than "the argument is wrong".
4. **`jobBlock`'s `^ {2}<name>:$` pattern is not section-scoped.** Enumerating with it across the
   whole file picks up `on:`'s `push:` / `pull_request:` children.
5. **Nx caches terminal output only for SUCCESSFUL runs.** If a test battery goes red, capture it
   through `tee` with `PIPESTATUS[0]` before re-running -- the re-run destroys the evidence
   (AGENTS.md, from a real unattributed failure).
6. **An nx.json edit rotates every task hash.** Not `namedInputs`-specific. Any byte change does it,
   including a comment-free reformat, because Nx hashes the file's content into every task.

## Validation Architecture

`workflow.nyquist_validation: true`. Framework: vitest 4.1.10 via `@nx/vitest`; config
`packages/github-cache/vitest.config.mts` (unit) and `vitest.integration.config.mts`.

| Fix | Automated check | Command |
|-----|-----------------|---------|
| Q1 ban widening | new `EVASION_SHAPES` + `FALSE_POSITIVE_CONTROLS` rows | `npx vitest run src/lint-rules.spec.ts` (from `packages/github-cache`) |
| Q1 tree-wide false positives | the lint gate itself | `npx eslint .` (from `packages/github-cache`) |
| Q2 named input | repaired LINT-04 guard through Nx's resolver | `npx vitest run src/nx-target-inputs.spec.ts` |
| Q3 clock pin | the existing month-boundary test, now deterministic | `npx vitest run src/roundtrip/read-back.spec.ts` |
| Q4 localizing guard | new derived-set clauses | `npx vitest run src/dogfood-cross-os.spec.ts` |
| all | the phase gate | `npm run test` then `npm run lint` (`nx run-many`) |

**Wave 0 gaps: none.** Every check lands in an existing spec file, which is also what DEC-2's
deferred-item boundary requires (do not restructure the four oversized specs).

## Security Domain

`workflow.security_enforcement: true`, ASVS level 1. No fix in this research touches a trust
boundary: Q1 and Q4 are lint/test-only, Q2 is build configuration, Q3 pins a clock in a test.
No new external input is parsed, no dependency is added, no credential path changes. The one
security-adjacent property preserved: Q4's partition clause keeps `CACHE_READ_ONLY` off the
producers, which is the control that keeps a PR-triggered Windows leg from writing to the default
branch cache scope (V4 access control, already required by XOS-09 / TRUST-14). DEC-1's fail-closed
422 handling is the task's actual security-relevant change and is already locked -- no research
needed.

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|-------|---------|---------------|
| A1 | Vitest's default `toFake` excludes `queueMicrotask`/`nextTick`, which is why promise scheduling survives | Q3 | LOW -- the conclusion (no narrowing needed) was measured directly; only this mechanism is inferred rather than read out of vitest's source |
| A2 | `TMP` belongs in the P8 denylist alongside `TEMP` | Q1 | LOW -- measured clean; drop it if the planner prefers the review's exact five |

Everything else is `[VERIFIED]` by measurement in this session.

## Open Questions

**BOTH RESOLVED at planning time (2026-08-10). Neither is an open decision for the executor.**

- **Q1 -> ANSWERED NO.** The planner does NOT accept the hash rotation. T4-7's `namedInputs` half is
  deferred whole as T4-7a (CONTEXT.md amendment), on the project's own hard ordering rather than a
  preference: the cost is to EVIDENCE PROVENANCE for Phase 11's hash records, and
  `REQUIREMENTS.md:654` / `STATE.md:608` record that this milestone was sequenced expressly to
  prevent that class of change. Only the drift-guard half ships, at zero `nx.json` bytes. Note the
  guard shape was also CORRECTED after this research: the two arrays are NOT set-equal
  (`test` minus `lint` is the test-runner name), so the assertion is the SUBSET RELATION.
- **Q2 -> ANSWERED, NO EXTRA CLAUSE NEEDED,** as the research itself concluded. The recommended
  clause-1 predicate already catches a sidecar added to a currently sidecar-less Windows leg, because
  that leg then satisfies Windows AND sidecar AND portable with zero knob sites.

Original text preserved below for provenance.

1. **Does the planner accept Q2's hash rotation?** Not a research question -- a scope decision.
   Research says the rotation is unavoidable for any nx.json edit, is OS-uniform, and gates
   nothing. The cost is one provenance note about Phase 11's evidence records. If the answer is no,
   T4-7 must be deferred whole, not partially.
2. **Should the Q4 guard also require the SIDECAR-less Windows legs to stay sidecar-less?** The
   census shows four Windows legs running `npm run build` with no sidecar, and their correctness
   depends on that absence. Adding a sidecar to one of them without also adding the knob would
   silently create a fourth writer, and the recommended clause-1 predicate WOULD catch it (it
   becomes Windows + sidecar + portable with knob 0). So no extra clause is needed -- recorded here
   because it looks like a gap and is not.

## Sources

All primary, all measured in this repo on 2026-08-10:

- `eslint.config.mjs`, `packages/github-cache/src/lint-rules.spec.ts` (read); ESLint Node API
  probe over 15 shapes before and after the widening; `npx eslint .` over the real lint scope.
- `nx.json`, `node_modules/nx/schemas/nx-schema.json`, `nx/dist/src/hasher/task-hasher.js` exports;
  `capture-hashes.mjs` before/after/diff; `npx vitest run src/nx-target-inputs.spec.ts`.
- `packages/github-cache/src/lib/retention.ts`, `cleanup/cleanup.spec.ts`,
  `backend/releases-backend.spec.ts`, `roundtrip/read-back.{ts,spec.ts}`; two measured runs of
  `read-back.spec.ts` under a pinned clock.
- `.github/workflows/ci.yml`, `packages/github-cache/src/test/repo-file.ts`,
  `dogfood-cross-os.spec.ts`, `windows-regression-detector.spec.ts`; a full job census.
- `package.json`, `.gitattributes`, `.planning/config.json`.

## Metadata

**Confidence breakdown:**
- Q1 (process ban): HIGH -- 15 shapes measured both directions plus a clean full-tree lint run.
- Q2 (namedInputs): HIGH -- schema-verified, hashes captured and diffed, the breaking guard
  identified by running it and the repair verified through Nx's own resolver.
- Q3 (fake timers): HIGH -- both the GREEN and the RED direction executed.
- Q4 (localizing guard): HIGH -- the full 23-job census was computed rather than eyeballed, and it
  falsified the two-way predicate the review implied.

**Research date:** 2026-08-10
**Valid until:** pinned to the installed versions above; re-measure Q2 after any Nx upgrade and Q1
after any eslint/typescript-eslint upgrade.
