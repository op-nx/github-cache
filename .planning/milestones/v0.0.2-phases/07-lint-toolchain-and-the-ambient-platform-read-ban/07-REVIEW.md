---
phase: 07-lint-toolchain-and-the-ambient-platform-read-ban
reviewed: 2026-07-27T08:30:00Z
depth: deep
reviewer: gsd-code-reviewer
diff_base: 7fd2042
files_reviewed: 13
files_reviewed_list:
  - eslint.config.mjs
  - nx.json
  - package.json
  - package-lock.json
  - .fallowrc.jsonc
  - .github/workflows/ci.yml
  - packages/github-cache/src/lint-rules.spec.ts
  - packages/github-cache/src/lint-scope-drift.spec.ts
  - packages/github-cache/src/nx-target-inputs.spec.ts
  - packages/github-cache/src/pinned-deps.spec.ts
  - packages/github-cache/src/backend/releases-backend.spec.ts
  - packages/github-cache/src/lib/cache-archive-path.spec.ts
  - packages/github-cache/src/lib/release-asset-name.spec.ts
findings:
  critical: 1
  high: 2
  medium: 6
  low: 6
  total: 15
status: issues-found
---

# Phase 7: Code Review Report

**Reviewed:** 2026-07-27
**Depth:** deep
**Scope:** the 14 commits `7fd2042..HEAD` on `gsd/v0.0.2-os-invariant-cross-os-sharing`
**Status:** issues-found

## Summary

The phase ships what it says it ships and the whole battery is green here (`format:check`,
`build`, `typecheck`, `typecheck:action`, `test` 33 files / 494 tests, `lint`, `fallow:ci`,
`check:action`, `pack:check`). Scope discipline holds: `packages/github-cache/package.json` is
untouched across the range (D-06), all four CORR-05 violations are still in place (LINT-03's
evidence is intact), the lockfile is strictly additive, and the regenerated action bundle landed
in the same commit as the lockfile.

The defects are not in what was built but in what the built thing does NOT catch, and in three
comments that assert coverage the code does not have. The headline finding is that the gate itself
can be silently disabled: `nx run-many -t lint` exits 0 when no `lint` target exists, so the CI
`lint` job goes green with nothing linted -- and the target's existence is contingent on an
inference plugin whose cross-OS behaviour D-35 leaves UNVERIFIED BY DESIGN. Below that, a
one-token variation on an evasion shape the phase DID test (`import * as os` -> `import osx`)
walks straight through both ban rules, while the shipped `// ponytail:` ceiling comment states
that it cannot.

All rule-level findings below were MEASURED against the real shipped `eslint.config.mjs` through
the ESLint Node API, not reasoned.

## What was verified clean

Recorded so a later reader does not re-do the work:

- **Config-object ORDER is correct** (RESEARCH C5). `js.configs.recommended` ->
  `...tseslint.configs.recommended` -> the `**/*.cjs` override, in that order
  (`eslint.config.mjs:97`, `:106`, `:124`). Additionally confirmed that
  `comments.recommended` (`:162`, which sits AFTER the `.cjs` block) carries only `plugins` and
  `rules` -- no `files`, no `languageOptions`, no `linterOptions` -- so it cannot re-override the
  `.cjs` `sourceType` or the explicit `reportUnusedDisableDirectives`.
- **The global `ignores` block works and is load-bearing.** With `dist/` and `out-tsc/` present on
  disk, `npx eslint . --format json` from `packages/github-cache` reports `linted: 66,
  findings: 0`. It is a standalone `ignores`-only object (`:87-95`), which is the correct shape
  for a global ignore and is deliberately distinct from the D-17 sibling `ignores` in the ban
  block.
- **Lockfile is additive.** Programmatic set diff of `packages`: 0 removed, 89 added, 21 transitive
  version changes. The two entries that look like regressions are hoisting reshuffles, not losses
  -- `which@3.0.1` survives at `node_modules/nx/node_modules/which`, `escape-string-regexp@1.0.5`
  at two nested locations. The Linux/wasm `@emnapi` subtrees are intact (the Windows-prune failure
  mode from project memory did NOT occur). All five ESLint packages are present and marked `dev`.
- **Bundle regeneration is consistent.** `start-cache-server/index.js` and `package-lock.json`
  changed in the SAME commit (`db577db`), and `npm run check:action` rebuilds byte-identical here.
- **D-06 honoured.** `git log 7fd2042..HEAD -- packages/github-cache/package.json` is empty.
- **The prompt's item 2 does not reproduce.** There are no `await banConfigObject()` expressions at
  HEAD; all three call sites (`lint-scope-drift.spec.ts:147`, `:160`, `:177`) are plain synchronous
  calls. The only `await` in that file is the legitimate one at `:88`.
- **Spot-check of the M1/M2/M3 mutation claims.** Not re-run (mutation requires writing to tracked
  files, out of bounds for this review), but the underlying assertions are demonstrably
  non-vacuous: every `EVASION_SHAPES` row routes through `lintFixture`, whose ignore/unconfigured
  rejection is itself covered by a self-test (`lint-rules.spec.ts:166-173`) that proves the
  rejected state is reachable. The independent probes below reproduce the exact per-shape verdicts
  the table claims, and they also found three shapes the table does not contain.

## CRITICAL

### CR-01: `npm run lint` exits 0 when no `lint` target exists -- the gate can be silently disabled

**Files:** `package.json:10`, `.github/workflows/ci.yml:46`, `nx.json:34-39`

**Measured:**

```
$ npx nx run-many -t no-such-target
 NX   No tasks were run
$ echo $?
0
$ npx nx run @op-nx/github-cache:no-such-target
 NX   Cannot find configuration for task @op-nx/github-cache:no-such-target
$ echo $?
1
```

**Issue.** The `lint` target does not exist in `project.json`; it is INFERRED by
`@nx/eslint/plugin` (D-01), and RESEARCH F16 establishes that the plugin returns `[]` -- no target
at all, silently -- whenever no `eslint.config.*` is found. RESEARCH F18 further establishes that
the existence gate runs `eslint.isPathIgnored(join(workspaceRoot, file))` with a POSIX `join` over
an absolute root, and D-35 leaves "does `@nx/eslint` infer `lint` identically on both OSes?"
**UNVERIFIED BY DESIGN**. So "the `lint` target exists on this runner" is a live, accepted,
unmeasured risk -- and `nx run-many` converts that risk into a GREEN CI leg rather than a red one.

Nothing else closes it:

- `lint-scope-drift.spec.ts` imports `eslint.config.mjs`, so deleting the FILE is caught. Deleting
  the four-line `plugins[]` entry in `nx.json:34-39` is not: the file still imports, the drift
  spec stays green.
- `nx-target-inputs.spec.ts` reads `nxJson.targetDefaults.lint` (`:157`, `:176`, `:185`, `:243`).
  `targetDefaults` is a DEFAULT applied to a target if one exists; it is not evidence a target
  exists. Every one of those assertions stays green with the plugin unregistered.
- `lint-rules.spec.ts:29-32` explicitly disclaims this half: "Nothing here would notice if
  `nx.json` never registered the plugin. That half is closed separately -- by plan 07-03's target
  wiring and by the battery command itself." The battery command is the thing that cannot detect
  it.

RESEARCH's own Validation Architecture table named the correct discriminator for LINT-01 --
"`npm run lint` (must exit 0 **and print `Successfully ran target lint`**)". The shipped CI job
checks only the exit code. For a phase whose thesis is "convert a convention into a build failure
that cannot be silenced without writing down why", a gate that no-ops on a one-line deletion with
no signal is the exact defect class the phase exists to close.

**Fix (either, cheapest first):**

```json
// package.json -- `nx run` on a missing target exits 1, `run-many` does not
"lint": "nx run @op-nx/github-cache:lint",
```

or add the existence assertion to the guard that already owns `lint` wiring:

```ts
// packages/github-cache/src/nx-target-inputs.spec.ts
import { createProjectGraphAsync } from 'nx/src/project-graph/project-graph.js';

it('the lint target is actually inferred, not merely defaulted', async () => {
  const graph = await createProjectGraphAsync({ exitOnError: false });
  const targets = graph.nodes['@op-nx/github-cache'].data.targets ?? {};

  expect(Object.keys(targets)).toContain('lint');
  expect(targets.lint.options.command).toBe('eslint .');
});
```

## HIGH

### HI-01: a DEFAULT import of `node:os` / `node:path` evades the ban entirely, and the shipped ceiling comment says it cannot

**Files:** `eslint.config.mjs:247-273` (`no-restricted-imports` paths), `eslint.config.mjs:280-288`
(the P4/P5 `// ponytail:` ceiling note), `packages/github-cache/src/lint-rules.spec.ts:352-356`

**Measured against the real config, at `packages/github-cache/src/x.spec.ts`:**

| Source | Reported rules |
|---|---|
| `import * as os from 'node:os'; os.tmpdir()` | `no-restricted-imports`, `no-restricted-syntax` |
| `import * as zz from 'node:path'; zz.sep` | `no-restricted-imports` |
| `import os from 'node:os'; os.tmpdir()` | `no-restricted-syntax` (P4 only, by binding name) |
| **`import osx from 'node:os'; osx.tmpdir()`** | **`[]`** |
| **`import osx from 'os'; osx.platform()`** | **`[]`** |
| **`import p from 'node:path'; p.sep`** | **`[]`** |

**Issue.** `no-restricted-imports` with `importNames` set maps an `ImportNamespaceSpecifier` to the
synthetic name `"*"` and reports it regardless of the local binding (RESEARCH F11, and confirmed
above). It maps a DEFAULT specifier to `"default"`, which is not in `BANNED_OS_ACCESSORS` or
`BANNED_PATH_ACCESSORS`, so a default import is never reported. P4/P5 then only reach bindings
literally named `os`/`nodeOs`/`path`/`nodePath`. A default import under any other name therefore
slips both rules -- and `node:os` / `node:path` both have working CJS default exports under
`nodenext` + `esModuleInterop`, so this is an idiomatic, reachable shape, not a curiosity.

The shipped ceiling comment asserts the opposite:

```js
// eslint.config.mjs:280-288
// ponytail: P4/P5 hardcode the conventional namespace binding names
// (os/nodeOs, path/nodePath). Ceiling = a namespace bound to any other name
// is invisible to THESE selectors -- and is still an error, because
// no-restricted-imports reports the namespace import itself regardless of the
// local name, and the dynamic form is closed by P6.
```

True for `import * as X`. **False for `import X`.** D-21 requires any shape the matcher cannot
reach to be recorded as a named ceiling with an upgrade path; this one is neither closed nor
recorded, and it is one token away from a shape that IS in `EVASION_SHAPES`. A reviewer reading
that comment concludes the family is closed.

**Fix.** Add `'default'` to both accessor lists (it is a valid `importNames` entry), then add the
row to `EVASION_SHAPES` so the guard proves it:

```js
// eslint.config.mjs
const BANNED_OS_ACCESSORS = [
  'default', // a default import hands over the WHOLE machine-dependent surface
  'tmpdir', 'EOL', 'platform', 'arch', 'homedir', 'type', 'release',
];
const BANNED_PATH_ACCESSORS = ['default', 'sep', 'delimiter', 'win32', 'posix'];
```

```ts
// packages/github-cache/src/lint-rules.spec.ts, in EVASION_SHAPES
{
  shape: 'a DEFAULT import of the os module under a non-conventional binding name',
  source: "import osx from 'node:os';\nexport const dir = osx.tmpdir();\n",
  expected: ['no-restricted-imports'],
},
```

Then correct the ceiling comment to say the namespace-name independence holds for
`ImportNamespaceSpecifier` specifically.

### HI-02: site 4's described disable states the assertion SHOULD move to integration -- the inverse of LINT-06 -- and the guard passes on a filename token

**Files:** `packages/github-cache/src/lib/release-asset-name.spec.ts:61`,
`packages/github-cache/src/lint-rules.spec.ts:568-583`

**Issue.** LINT-06 requires the reason text to state WHY the assertion cannot move to
`integration`. Site 4's reason states the opposite:

> `-- same default-argument contract as above, for cachePlatform: the running platform is what the
> no-argument call is specified to resolve to. NOTHING in this milestone removes this one -- the
> recommendation on record is moving the assertion to src/server/public-server.integration.spec.ts,
> where LINT-02 allows the read.`

That is an argument that the assertion CAN move and a recommendation that it SHOULD. A described
disable whose description concedes the disable is unnecessary is exactly the "described disable
that says nothing" failure the control exists to prevent.

The guard cannot tell the difference. `lint-rules.spec.ts:582` is:

```ts
expect(reason).toContain('integration');
```

which is satisfied here by the substring inside the PATH `public-server.integration.spec.ts`. So
the one semantic clause LINT-06 adds over LINT-05 is enforced by a substring match that a filename
satisfies.

Secondary, systemic: none of the four reasons actually argues "cannot move". Sites 1-3 argue
"moving gains nothing" ("an integration spec would make the same read", "would still have to read
the runner", "would carry the identical read across unchanged"). That is a defensible reading of
the requirement, but it is a softer one than LINT-06's text, and it is worth a deliberate decision
rather than four independent slides.

**Fix.** Rewrite site 4's reason to name the blocking constraint (e.g. the assertion pins
`cachePlatform`'s default-argument contract, which is a pure-function contract with no I/O, so an
integration spec would be a slower copy of a unit assertion and CORR-02 has not yet decided its
destination), and tighten the guard so a path token cannot satisfy it:

```ts
// reject the filename token, and require the reason to be prose about moving
const prose = reason.replace(/\S+\.integration\.spec\.[cm]?ts/g, '');

expect(prose.length).toBeGreaterThan(0);
expect(prose).toContain('integration');
```

## MEDIUM

### ME-01: the ban's `files` glob is narrower than the unit runner's own definition of a unit spec, and no guard covers that direction

**Files:** `eslint.config.mjs:232`, `packages/github-cache/vitest.config.mts:26`,
`packages/github-cache/src/lint-scope-drift.spec.ts:159-207`

**Measured** (`export const value = process.platform;`, against the real config):

| Fixture path | Reported rules |
|---|---|
| `packages/github-cache/src/x.spec.ts` / `.mts` / `.cts` | `no-restricted-syntax` |
| **`packages/github-cache/src/x.test.ts`** | **`[]`** |
| **`packages/github-cache/src/x.spec.tsx`** | **`[]`** |
| **`packages/github-cache/src/x.spec.cjs`** | **`[]`** |

**Issue.** The unit `test` target collects
`{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}`. The ban covers
`**/*.spec.{ts,mts,cts}`. So an entire naming convention the runner already honours -- `*.test.ts`
-- plus `.tsx`/`.jsx`/`.cjs` unit specs, run as unit tests with the ambient-platform ban silently
off.

`lint-scope-drift.spec.ts` cannot see this. By D-19 it asserts only (a) ESLint `files` == ESLint
`ignores` and (b) that set is a superset of the INTEGRATION include. D-19's reason for excluding
the unit config -- "`vitest.config.mts`'s include is deliberately wider, so an equality assertion
would be permanently red" -- is correct, but the CONSEQUENCE of the width (a whole file-naming
family exempt from the ban, unguarded) was never assessed or recorded. Zero such files exist today
(RESEARCH F23), which is precisely why nothing will notice when the first one is added.

**Fix.** Widen the ban to the naming forms the runner actually collects, keeping `files` and
`ignores` identical so the D-19 identity assertion still holds:

```js
files: ['**/*.{test,spec}.{ts,mts,cts,tsx}'],
ignores: ['**/*.integration.{test,spec}.{ts,mts,cts,tsx}'],
```

and add a drift assertion that the unit include's `{test,spec}` name set is covered, or that any
uncovered member is on an explicit accepted-exemption list.

### ME-02: `process.env.OS` / `RUNNER_OS` / `PROCESSOR_ARCHITECTURE` are unbanned and unrecorded

**File:** `eslint.config.mjs:309-316`

**Measured:** `export const value = process.env.OS;` at a unit spec path -> `[]`.

**Issue.** P2's message explicitly blesses the dotted form: "The dotted `process.env.CI` form is
unaffected." That is right for `CI`, but `process.env.OS` (`Windows_NT` on Windows),
`process.env.OSTYPE`, `process.env.PROCESSOR_ARCHITECTURE` and `process.env.RUNNER_OS` are all
derivations of an expectation from the RUNNING machine -- the exact thing CORR-06 bans. The
project's own memory names `env:RUNNER_OS` as an OS discriminator, so this is a shape a
contributor on this milestone is actively primed to reach for. It is neither closed by a selector
nor recorded as a D-21 ceiling.

**Fix.** One selector, or one ceiling comment. The selector:

```js
{
  selector:
    "MemberExpression[computed=false][object.object.name='process'][object.property.name='env'][property.name=/^(OS|OSTYPE|RUNNER_OS|PROCESSOR_ARCHITECTURE|ComSpec)$/]",
  message: BAN_MESSAGE,
},
```

### ME-03: two further evasion shapes reach no selector and are not recorded as ceilings

**File:** `eslint.config.mjs:337-347` (P6), `:280-295` (the two recorded ceilings)

**Measured, both `[]` at a unit spec path:**

```ts
const m = 'node:os';
export const v = await import(m);              // P6 needs a LITERAL source.value

import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
export const v = req('node:os').platform();    // no selector reaches a require handle
```

**Issue.** D-21 is explicit: "Any shape the AST matcher genuinely cannot reach is recorded as a
known ceiling in a `// ponytail:`-style comment naming the ceiling and its upgrade path -- never
left as an untested silent gap." Two ceilings are recorded (namespace binding name; cross-module
helper). These two are not, and the computed-specifier one is a direct sibling of a shape that IS
in `EVASION_SHAPES` (`await import('node:os')`).

**Fix.** Either broaden P6 to `ImportExpression` with a non-literal source (noisy, probably not
worth it) or -- lazier and sufficient -- add one ceiling comment naming both shapes and their
upgrade path, and add the two rows to `EVASION_SHAPES` with `expected: []` plus a comment marking
them as documented ceilings, so the day one becomes catchable the diff is reviewable.

### ME-04: the drift guard reads only the FIRST glob of the integration `include` array

**File:** `packages/github-cache/src/lint-scope-drift.spec.ts:179-181`, `:140-143`

```ts
const includeMatch = /include:\s*\[\s*'([^']+)'/.exec(integrationConfigCode);
```

**Issue.** `include` is an array. The regex captures the first element and the assertion loop
(`:201-206`) runs over that element's extensions only. Adding a second entry --
`include: ['{src,tests}/**/*.integration.spec.{ts,mts,cts}', 'e2e/**/*.integration.spec.tsx']` --
would be invisible to the guard, and the "no integration spec can ever be linted as a unit spec"
invariant would be asserted against a subset. That is the same class of partial read the file's
own header warns about.

Second, smaller: the comment-stripper (`:140-143`) only removes lines whose TRIMMED form starts
with `//`. A `/* ... */` block comment quoting an `include: ['...']` line survives the strip and
would be matched by the regex ahead of the real value. The file currently uses only `//` comments,
so this is latent.

**Fix.** Capture the whole array and union its extension sets:

```ts
const arrayMatch = /include:\s*\[([^\]]*)\]/.exec(integrationConfigCode);
const globs = [...(arrayMatch?.[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1]);

expect(globs.length, 'could not read the include globs out of vitest.integration.config.mts')
  .toBeGreaterThan(0);

const integration = [...new Set(globs.flatMap((g) => extensionsOf(g, 'vitest integration include')))];
```

### ME-05: the shipped consumer bundle gained a runtime behaviour change (undici 6.27.0 -> 6.28.0) with no consumer-impact assessment

**Files:** `start-cache-server/index.js`, `package-lock.json`

**Issue.** The D-05 container regeneration re-resolved `undici` (a transitive runtime dependency of
`@actions/*`) from 6.27.0 to 6.28.0, which drifted the committed action bundle. The mechanics were
handled correctly -- the bundle was regenerated in the SAME commit as the lockfile (`db577db`),
`check:action` is green here, and 07-EVIDENCE.md:75-79 records the cause. What is missing is the
consequence.

The diff is not cosmetic. It adds throw-on-invalid header validation on a path that previously
passed values straight through:

```js
// start-cache-server/index.js, require_request
const str = `${val[i]}`;
if (!isValidHeaderValue(str)) {
  throw new InvalidArgumentError(`invalid ${key} header`);
}
```

plus `validatePartialResponseContentLength` in the retry handler and an `errorRequest` path for a
blob content-type. Those are behaviour changes in the artifact adopters resolve from the git ref,
riding a phase whose CONTEXT says "no runtime dependency changes" (D-06 -- literally true of the
manifest, not of the shipped bytes).

**Fix.** Record the behavioural delta in the phase evidence and confirm no header value this
action constructs (`Authorization`, the cache-service headers) can now hit the new throw. A
one-paragraph note is enough; the point is that it is a DECISION rather than a side effect nobody
looked at.

### ME-06: `beforeAll(fn, 30_000)` triples the failure latency of a hung config import, and its stated justification cites the wrong budget

**Files:** `packages/github-cache/src/lint-rules.spec.ts:84`, `:99-101`;
`packages/github-cache/src/lint-scope-drift.spec.ts:74-75`, `:87-89`

**Issue.** Both comments justify the explicit timeout against "vitest's DEFAULT 5000ms per-test
budget". Measured in the installed vitest:

```
node_modules/vitest/dist/chunks/coverage.DM_a_rWm.js:539
resolved.hookTimeout ??= resolved.browser.enabled ? 3e4 : 1e4;
```

A `beforeAll` hook gets **10 000 ms**, not 5 000 ms. The 5 000 ms figure is `testTimeout`, which is
what applied BEFORE the hoist -- i.e. it describes the bug that commit `e683c92` fixed, not the
budget the fixed code runs under. The comment carries the pre-fix framing into the post-fix code.

On the assessment the prompt asks for: the measured boot is 590-910 ms (`lint-rules`) and ~1000 ms
(`lint-scope-drift`). The untouched default already gives ~10x headroom, which is the normal margin
for a CPU-contention flake. The explicit `30_000` buys no additional margin that matters and
triples the time a genuinely wedged config import takes to fail. 30 s is not right; the right value
is "don't pass one".

**Fix.** Drop the second argument in both files (inherit the 10 000 ms `hookTimeout`), or set
`10_000` explicitly if the intent is to pin it against a future vitest default change -- and in
either case correct both comments to name `hookTimeout`, not the per-test budget.

## LOW

### LO-01: `test.inputs` declares `eslint.config.mjs` but not `tools/eslint-rules/**/*`

**Files:** `nx.json:50-85` (test inputs) vs `nx.json:148-161` (lint inputs),
`packages/github-cache/src/nx-target-inputs.spec.ts:237-245`

`lint.inputs` declares `{workspaceRoot}/tools/eslint-rules/**/*` and the guard spec justifies it
("the day someone adds a local rule, its authoring commit must bust the lint hash, and remembering
to wire the input at that moment is exactly the kind of thing nobody remembers"). The identical
argument applies to `test`, because `lint-rules.spec.ts` loads the REAL config, which D-10 permits
to import a helper from exactly that directory. Editing such a helper would re-run `lint` and
replay a cached `test` PASS -- D-25's class, one entry short.

**Fix:** add `"{workspaceRoot}/tools/eslint-rules/**/*"` to `targetDefaults.test.inputs`, and a
matching assertion beside `nx-target-inputs.spec.ts:229`.

### LO-02: two spec headers claim `process.cwd()` is banned by LINT-02; it is not

**Files:** `packages/github-cache/src/lint-rules.spec.ts:42-45`,
`packages/github-cache/src/lint-scope-drift.spec.ts:45-47`

> "...doubly load-bearing in this file, because an ambient `process.cwd()` read inside a unit spec
> is precisely the shape LINT-02 exists to ban."

**Measured:** `export const v = process.cwd();` at a unit spec path -> `[]`. No selector reaches a
CALL on `process`; P1 is constrained to `platform|arch`, P2 to computed access. The house style
treats a stale rationale comment as a defect, and this one overstates the control's coverage in
the very files that document the control.

**Fix:** reword to "the house convention" (which is what actually motivates it), or add
`CallExpression[callee.object.name='process'][callee.property.name=/^(cwd|uptime|memoryUsage)$/]`
to the selector set and make the claim true.

### LO-03: the drift guard's comment-stripping rationale is wrong about the file it reads

**File:** `packages/github-cache/src/lint-scope-drift.spec.ts:24-28`

> "`vitest.integration.config.mts`'s own prose quotes the include pattern while explaining it, so a
> naive substring match would pass even if the REAL `include` value had drifted."

It does not. The file's comment (`vitest.integration.config.mts:3-7`) says "It includes ONLY
`*.integration.spec.ts`" and never writes an `include: ['...']` form. The stripping is still good
defensive practice inherited from `cleanup-workflow.spec.ts`; the specific factual claim about this
file is false and will mislead the next reader into thinking the trap is live here.

### LO-04: floating promise at module scope

**File:** `packages/github-cache/src/lint-scope-drift.spec.ts:64-66`

`const eslintConfigModule = import(...)` starts at module evaluation; the only rejection handler is
attached later, inside `beforeAll` (`:88`). If `eslint.config.mjs` throws on load, the rejection is
unhandled for at least one turn, which vitest surfaces as a worker-level unhandled rejection rather
than a clean, attributable hook failure -- the opposite of what the hook's own comment is trying to
achieve.

**Fix:** move the `import()` inside the hook, or attach a no-op catch at creation:

```ts
const eslintConfigModule = import(url).catch((error) => {
  throw new Error(`failed to load the root eslint.config.mjs: ${error}`);
}) as Promise<{ default: readonly FlatConfigObject[] }>;
```

### LO-05: `nx-target-inputs.spec.ts` throws instead of failing when a targetDefault omits `inputs`

**File:** `packages/github-cache/src/nx-target-inputs.spec.ts:185-195`

```ts
.filter(([, target]) => target.inputs.some(...))
```

The type already models `inputs` as required, but `nx.json` is parsed from disk with a cast, so the
type is an assertion, not a check. A future `targetDefaults` entry carrying only `cache: true`
turns this guard into a `TypeError: Cannot read properties of undefined (reading 'some')` instead
of a comprehensible assertion failure. Use `target.inputs?.some(...) ?? false`.

### LO-06: the D-08 root-directory lock uses `existsSync`, not a directory check

**File:** `packages/github-cache/src/lint-scope-drift.spec.ts:223-231`

`getProjectUsingESLintConfig` flips on a `src`/`lib` DIRECTORY. `existsSync` also returns `true`
for a plain file named `src` or `lib` at the root, which would fail the lock for a reason it does
not care about. Cosmetic today; `statSync(url, { throwIfNoEntry: false })?.isDirectory() === true`
is the exact predicate.

## Observations (not findings)

- **Transient spec files during the review.** The first `npm run test` of this review collected 35
  spec files / 496 tests including `src/zzz-verifier-bare-disable.spec.ts` and
  `src/zzz-verifier-stale-disable.spec.ts` (the M8 and M9 mutation probes). A re-run 45 seconds
  later collected 33 / 494 and neither file exists on disk or in the index. That is a concurrent
  agent's mutation probe being created and cleaned up, not a committed artefact -- HEAD is clean.
  Noted only so a later reader does not chase the count discrepancy. It does suggest mutation
  probes are written into `packages/github-cache/src/`, where a crash mid-mutation would leave a
  `zzz-*.spec.ts` behind that the `test` target would happily collect.
- **`ci.yml` is not an Nx input**, so the new `lint` job has no drift guard. That is correct for
  this phase (PARITY-06 registers `ci.yml` in Phase 9, and CONTEXT says a Phase 7 spec must not
  assert on it) -- flagged only so Phase 9 remembers the job now exists.
- **`.planning/config.json` is modified in the working tree** and uncommitted. Outside review
  scope; mentioned so it is not swept into an unrelated commit.

---

_Reviewed: 2026-07-27_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
