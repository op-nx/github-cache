# Phase 7 - Recorded Evidence

Measurements taken during phase 7 execution. Appended to by plans 07-01, 07-02, 07-03 and
07-04. Every number here is MEASURED on this repo, never predicted; where a prediction from
`07-RESEARCH.md` exists it is quoted alongside so the divergence (or its absence) is visible.

---

## Plan 07-01

Recorded: 2026-07-27. Host: Windows 11 arm64, node v24.13.0, npm 11.6.2.
Base commit: `7b451ca`.

### T-07-02 supply-chain pre-check (run BEFORE `npm i`)

`npm view <pkg> scripts.postinstall` for all five packages. A non-empty result on any one is
a STOP condition. All five returned EMPTY, so no stop condition fired and the install
proceeded.

| Package | `scripts.postinstall` | Result |
|---|---|---|
| `eslint` | (empty) | pass |
| `@eslint/js` | (empty) | pass |
| `typescript-eslint` | (empty) | pass |
| `@eslint-community/eslint-plugin-eslint-comments` | (empty) | pass |
| `@nx/eslint` | (empty) | pass |

A second pass over the full `scripts` object confirmed none of the five carries a
`preinstall`, `install` or `postinstall` hook. The comments plugin's `preversion` /
`version` / `postversion` entries are publish-time hooks in its own repo and never run for a
consumer install.

**Registry re-confirmation of the one second-hand entry.**
`07-RESEARCH.md`'s Package Legitimacy Audit approved
`@eslint-community/eslint-plugin-eslint-comments@4.7.2` from `STACK.md`'s 2026-07-26 pass
without re-fetching it. Re-fetched here: version `4.7.2` resolves, repository is
`git+https://github.com/eslint-community/eslint-plugin-eslint-comments.git`, tarball
`https://registry.npmjs.org/@eslint-community/eslint-plugin-eslint-comments/-/eslint-plugin-eslint-comments-4.7.2.tgz`.
The other four also re-resolved at their exact requested versions against the expected
official orgs (`eslint/eslint`, `typescript-eslint/typescript-eslint`, `nrwl/nx`).

### D-05 lockfile regeneration (linux/arm64 `node:24` container)

Invocation, run from the repo root under Git Bash. `MSYS_NO_PATHCONV=1` is required on this
host: without it Git Bash rewrites the container-side `-w /app` into
`C:/Program Files/Git/app` and docker rejects it.

```bash
MSYS_NO_PATHCONV=1 docker run --rm --platform linux/arm64 \
  -v "D:/projects/github/op-nx/github-cache:/app" \
  -v /app/node_modules \
  -w /app node:24 \
  sh -c "rm -f package-lock.json && npm install --package-lock-only"
```

Container: `node:24` at node `v24.18.0`, npm `11.16.0`. `-v /app/node_modules` masks the host
`node_modules` with an anonymous volume so the Windows tree cannot bias the resolve, which is
the whole point of the procedure.

**Result:** `package-lock.json` regenerated, +1450 / -104 lines, 621 entries,
`lockfileVersion 3`.

| Check | Result |
|---|---|
| all five packages present at the exact requested versions | yes (`eslint 9.39.5`, `@eslint/js 9.39.5`, `typescript-eslint 8.65.0`, `@eslint-community/eslint-plugin-eslint-comments 4.7.2`, `@nx/eslint 23.1.0`) |
| Linux-only WASM-fallback optional subtrees survived | yes -- 15 `@emnapi` / `wasm32-wasi` entries, including the nested `@oxc-resolver/binding-wasm32-wasi/node_modules/@emnapi/*` trio that a bare Windows install prunes |
| entries that appear as removals in the diff | `@typespec/ts-http-runtime`, `get-proto`, `agent-base`, `https-proxy-agent` -- all verified still PRESENT in the regenerated lockfile; the `-` lines are re-ordering, not drops |
| `npm ci` on the host afterwards | exit 0, 516 packages added |

### Q10 / SC9 -- the action bundle DID drift

`npm run check:action` immediately after `npm ci` on the regenerated lockfile. RESEARCH
carried this as a contingency, not a prediction. **The contingency fired.**

- **Cause:** `undici` re-resolved `6.27.0` -> `6.28.0`. It is a transitive runtime dependency
  reached through `@actions/*`, which are themselves exact-pinned but carry ranged
  dependencies of their own -- exactly the mechanism Q10 named.
- **Bundle delta:** `start-cache-server/index.js`, +88 / -6 lines. The changed bytes are
  undici's cookie parser gaining `validateCookieName` / `validateCookieValue` calls.
- **Action taken:** `npm run build:action` (already invoked by `check:action` itself), and
  `start-cache-server/index.js` staged IN THIS SAME COMMIT per SC9. Never as a follow-up: a
  later commit would leave the `action-bundle-drift` gate failing on this commit and every
  one after it.
- **Re-verified:** `npm run check:action` exits 0 with the rebuilt bundle staged.

No `serve()`-reachable SOURCE was edited by this plan, which is what RESEARCH verified. The
drift came from the dependency graph underneath it, which is the residual RESEARCH G7 flagged
as real.

### D-06 prohibition check

`git diff --exit-code -- packages/github-cache/package.json` -> clean. The package manifest is
byte-identical; all five ESLint packages are ROOT devDependencies.

### D-12 bounded-cleanup baseline

Measured with `npx eslint . --format json` from `packages/github-cache`, using G4's per-rule
counter.

**Pre-remediation** -- config carrying the global `ignores` block, `@eslint/js` recommended and
the `typescript-eslint` recommended spread, and nothing else. Taken BEFORE either remediation
block was written.

```
files linted:   64
total findings: 10
{
 "no-undef": 7,
 "@typescript-eslint/no-require-imports": 2,
 "@typescript-eslint/no-unused-vars": 1
}
```

Per-file, in full:

| File | Line:Col | Rule |
|---|---|---|
| `pack-check.cjs` | 32:26 | `@typescript-eslint/no-require-imports` |
| `pack-check.cjs` | 32:26 | `no-undef` (`require`) |
| `pack-check.cjs` | 33:14 | `@typescript-eslint/no-require-imports` |
| `pack-check.cjs` | 33:14 | `no-undef` (`require`) |
| `pack-check.cjs` | 36:29 | `no-undef` (`__dirname`) |
| `pack-check.cjs` | 151:5 | `no-undef` (`process`) |
| `pack-check.cjs` | 160:5 | `no-undef` (`process`) |
| `pack-check.cjs` | 163:3 | `no-undef` (`process`) |
| `pack-check.cjs` | 168:3 | `no-undef` (`process`) |
| `src/serve.spec.ts` | 89:23 | `@typescript-eslint/no-unused-vars` (`_bytes`) |

**Against RESEARCH G4's prediction: an exact match.** Predicted 64 files linted, 10 findings
(7 `no-undef` + 2 `no-require-imports` from `pack-check.cjs`, 1 `no-unused-vars` at
`serve.spec.ts:89` for `_bytes`), plus 0-2 uncertain from the low-confidence regex class
(`no-useless-escape`, `no-control-regex`, `no-irregular-whitespace`,
`no-misleading-character-class`). The uncertain class produced **zero**. G4's analytic
baseline reproduced file-for-file and line-for-line.

**Post-remediation residual:**

```
files linted:   64
total findings: 0
```

### The D-12 call, with its number

**Rules turned OFF repo-wide: ZERO. Code edits to fix a finding: ZERO. Configuration blocks
added: TWO.** That is the outcome RESEARCH G4 predicted, and it is a strong result for the
bounded-cleanup rule: nothing was swept, nothing was disabled to make a number go away, and no
working code was edited to satisfy a linter.

The two blocks, and why neither is a "disable":

1. **The `**/*.cjs` override** closes 9 of the 10 findings and is telling ESLint the truth
   about a CommonJS file rather than suppressing anything. It carries one scoped rule-off,
   `@typescript-eslint/no-require-imports: 'off'`, limited to that one glob: `pack-check.cjs`
   is a deliberately dependency-free CommonJS guard CI runs straight after `npm ci`, and
   rewriting it to ESM to satisfy a TypeScript-oriented rule would be the tail wagging the dog
   (D-13). Recorded honestly as a scoped rule-off rather than claimed as zero. `no-undef` was
   deliberately kept LIVE for the glob via a four-name inline globals map, so the one file in
   the repo where that rule still applies keeps its typo check.
2. **`@typescript-eslint/no-unused-vars` with the three leading-underscore patterns** closes
   the tenth. It codifies a convention the repo already follows at six sites. The alternative
   -- a described disable at `serve.spec.ts:89` -- would need reason prose under LINT-05 and
   would then be one more thing to keep true.

No deferred-ideas entry was needed: D-12's escape hatch is for a single rule producing a broad
sweep, and no rule did.

### G5 negative control 2 -- lint scope must not depend on gitignored build output

The only control for the G3 finding. Run from `packages/github-cache`.

| State | `dist/` files | `out-tsc/` files | Linted |
|---|---|---|---|
| with build output | 91 | 73 | **64** |
| after `rm -rf dist out-tsc` | 0 | 0 | **64** |

**Identical.** `lint`'s scope does not depend on whether `build` ran, so the result cannot
diverge from the Nx hash. Build output restored afterwards with `npm run build` and
`npm run typecheck`.

### M7 mutation -- proving negative control 2 can fail

A control that reports the same number twice is worth nothing until it is shown capable of
reporting two. The global `ignores` block was removed, the count re-taken with build output on
disk, and the block restored.

| Config | Linted |
|---|---|
| with the global `ignores` block | **64** |
| `ignores` block REMOVED (M7) | **155** |

91 extra files -- the generated `dist/` and `out-tsc/` trees -- would be linted without the
block, at an Nx hash that never moves. That is the stale-cache false PASS G3 predicted, made
visible. RESEARCH predicted 160 against a 96-file snapshot; the tree now holds 91 generated
files, so 155 is the same finding at a moved snapshot, not a divergence.

The mutation was applied, observed, and REVERTED before the commit. Post-restore re-measure:
64 files linted, 0 findings, and the `.cjs` override still ordered after the
`typescript-eslint` spread.

### TDD: the RED-before-GREEN split for `lint-rules.spec.ts`

`workflow.tdd_mode` is on. The opt-out rules were authored in this plan's task 2, so the RED
was produced deliberately: the entire `linterOptions` + `rules` config object carrying
`reportUnusedDisableDirectives`, `require-description`, `ban-ts-comment` and
`no-unused-vars` was stripped from `eslint.config.mjs`, the spec run, and the object
restored.

**RED -- 2 failed, 7 passed of 9.**

| Assertion | RED | Why |
|---|---|---|
| the non-vacuity control can itself fail | PASS | the control's own self-test; independent of the stripped rules |
| LINT-05 bare `eslint-disable-next-line` errors | **FAIL** | `require-description` comes ONLY from the stripped object |
| LINT-05 described disable accepted | PASS | a direction control -- passes on both sides by design |
| LINT-05 bare `@ts-expect-error` errors | PASS | see the note below |
| LINT-05 described `@ts-expect-error` accepted | PASS | direction control |
| LINT-05 `@ts-ignore` errors described or not | PASS | see the note below |
| LINT-06 stale described disable errors | **FAIL** | with the object stripped, `reportUnusedDisableDirectives` falls back to v9's default `warn` (severity 1), so the assertion on severity 2 fails |
| CORR-06 non-ban rule errors at the integration path | PASS | **the load-bearing observation -- see below** |
| CORR-06 same rule errors at the unit path | PASS | same |

**The CORR-06 controls passed on BOTH sides.** That is the distinction the control exists to
draw, and it is the one that had to be checked: a RED in which the CORR-06 assertions ALSO
failed would mean the config was not being loaded at all (the `unconfigured` trap), not that
a rule was missing. They passed, so the RED is attributable to the stripped rules and to
nothing else.

**Why the three `ban-ts-comment` assertions passed in RED, recorded honestly.**
`@typescript-eslint/ban-ts-comment` is already enabled by `typescript-eslint`'s recommended
set, and its plugin DEFAULT options happen to coincide with D-30's requested configuration.
So those three assertions do not discriminate the presence of D-30's explicit block; they
would stay green if it were deleted today. The explicit block is still worth its four lines
-- it pins the behaviour against a future change to the plugin's defaults, and the
`@ts-ignore`-described-form assertion WOULD fail if someone weakened `'ts-ignore': true` to
`'allow-with-description'` -- but "these three assertions prove D-30's block is present" would
be a false claim and is not made.

**GREEN after restore: 9 passed of 9.**

### A vacuity bug in the non-vacuity control, found BY the RED

The first version of the shared control filtered on `severity === 1 && ruleId === null`,
straight from RESEARCH G1(c). Under RED that filter matched the LINT-06 unused-directive
report itself -- because with `reportUnusedDisableDirectives` back at v9's default `warn`, an
unused-directive report is ALSO severity 1 with a null rule id. The control therefore
reported "this file was not linted" about a file that had just been linted correctly, which
is precisely the misdiagnosis it exists to prevent, reproduced inside itself. It passed in
GREEN only because `'error'` moves those reports to severity 2 -- meaning the control's
correctness depended on the very setting it was supposed to be independent of.

Fixed by adding the position check. Measured message shapes:

| Message | `ruleId` | `severity` | `line` |
|---|---|---|---|
| ignored path (`dist/...`) | `null` | 1 | **absent** |
| unconfigured path (unmatched extension) | `null` | 1 | **absent** |
| unused directive (at `warn`) | `null` | 1 | `1` |
| unused directive (at `error`) | `null` | 2 | `1` |

An ignore/unconfigured result describes the whole FILE and carries no position; every rule
report and every directive report carries one. The control now filters on
`severity === 1 && ruleId === null && line === undefined`, which separates them cleanly and
no longer depends on the LINT-06 severity. The spec carries its own self-test asserting the
control still detects a genuinely ignored path, so the control cannot silently become
inert -- the lesson quick 260726-gok recorded as "a guard's own non-vacuity control can
itself be vacuous".

### M5 mutation -- the D-25 input assertion can fail

`{workspaceRoot}/eslint.config.mjs` was removed from `nx.json` `targetDefaults.test.inputs`
and `nx-target-inputs.spec.ts` re-run.

| State | Result |
|---|---|
| input present | 6 passed of 6 |
| input REMOVED (M5) | **1 failed** (`eslint.config.mjs is a test input, ...`), 5 passed |

Exactly the one expected assertion, and no collateral. Applied, observed, REVERTED before the
commit.

### Q2 resolved -- fallow auto-credits `eslint.config.mjs`

RESEARCH carried this at MEDIUM confidence off a binary-strings inference (F20), with a
one-line `entry` contingency ready. `npm run fallow:ci` exits 0 with the new config file and
its three imports in place, so the contingency was NOT needed and no speculative
`.fallowrc.jsonc` entry was added. The single fallow change is the `@nx/eslint`
`ignoreDependencies` line, which was the one certain case (`@nx/eslint` is referenced only
from `nx.json`, which fallow does not read). The comments plugin's `./configs` subpath
resolved cleanly and needed no entry either.

### Battery at the commit

Eight commands, all exit 0: `format:check`, `build`, `typecheck`, `typecheck:action`, `test`,
`fallow:ci`, `check:action`, `pack:check`. There is no `lint` command yet -- it becomes the
ninth in plan 07-03.

Unit suite: **453 tests across 32 files, all passing.** Baseline before this plan was 438
(quick 260726-gok); the +15 are 5 `pinned-deps.spec.ts` pins, 9 `lint-rules.spec.ts`
assertions and 1 `nx-target-inputs.spec.ts` input assertion.

D-06 prohibitions, both verified clean at the commit:
`git diff --exit-code -- packages/github-cache/package.json` and
`git diff --exit-code -- packages/github-cache/src/public-surface.spec.ts`.

---

## Plan 07-02

Recorded: 2026-07-27. Host: Windows 11 arm64, node v24.13.0, npm 11.6.2.

### The RED observation (LINT-03), assertion by assertion

The assertions were written and RUN before either ban rule existed, per D-20. This is the
measured split, not a predicted one -- `npx vitest run src/lint-rules.spec.ts` at the moment
`eslint.config.mjs` still carried only plan 07-01's rules:

**15 failed, 22 passed of 37.**

| Group | Count | RED verdict | Why |
|---|---|---|---|
| plan 07-01's opt-out + CORR-06 assertions | 9 | PASSED | untouched by this plan |
| D-21 evasion shapes at a unit path | 7 | **FAILED** | the rules did not exist; `banRuleIdsOf` returned `[]` against every expected id |
| false-positive controls at a unit path | 6 | PASSED | vacuously, by design -- they assert ZERO ban errors and there were no ban rules |
| CORR-06 direction pair at the integration path | 7 | PASSED | **the critical control** |
| D-22 four sites, "is CAUGHT once the disable is stripped" | 4 | **FAILED** | no rules, so zero ban errors at each real expression |
| D-22 four sites, "carries a described disable" | 4 | **FAILED** | the disables did not exist yet |

Representative failure text, site 2:

```
AssertionError: expected 'const OTHER_PLATFORM: NodeJS.Platform...' to contain
  'eslint-disable-next-line no-restricte...'
Expected: "eslint-disable-next-line no-restricted-syntax"
Received: "const OTHER_PLATFORM: NodeJS.Platform ="
```

and, for an evasion shape, `expected [] to deeply equal [ 'no-restricted-syntax' ]`.

**The direction controls passing on BOTH sides is what makes this RED interpretable.** Had the
seven integration-path assertions failed too, the meaning would have been "the config is not
being loaded at all" (the ignored/unconfigured trap) rather than "the rules are missing" --
and that trap is the single most likely way this phase could have shipped a vacuous guard.
The false-positive controls passing vacuously in RED is expected and is not evidence; their
value is entirely in GREEN, where they discriminate against an over-broad selector.

Intermediate measurement after STEP 2 (rules added, disables not yet): **6 failed, 31 passed**
-- all seven evasion shapes flipped to CAUGHT, and the six residual failures were the four
"carries a described disable" assertions plus the two `release-asset-name.spec.ts` position
assertions, which report TWO ban errors until each site's sibling disable exists to suppress
the other. After STEP 3: **37 passed of 37.**

### P7 was INCLUDED, not declined

RESEARCH G2 recommends P7
(`MemberExpression[computed=false][object.property.name='process'][property.name=/^(platform|arch)$/]`)
and leaves it to the planner. It is IN the shipped selector set. Consequence for D-21:
`globalThis.process.platform` needs no `// ponytail:` ceiling comment, because it is caught
rather than accepted.

Two ceilings ARE recorded in `eslint.config.mjs`, both in the three-part form
(`with-hash-lock.ts:1-3`): P4/P5's hardcoded namespace binding names, whose upgrade path is
dropping the `object.name` constraint IN FAVOUR OF an allowlist and never without one; and
the residual T-07-12 ceiling -- a platform read hidden behind a helper in another module --
whose only upgrade path is type-aware linting, which D-11 excludes for a stated reason and
which is therefore accepted rather than scheduled.

### Selector-set behaviour, measured against REAL ESLint (Q5 closed)

RESEARCH G2's verdict table was produced with `@babel/parser` + `esquery`, and Q5 asked
whether babel-estree and `@typescript-eslint/parser` agree on every node shape those
selectors depend on. Every shape in the table reproduced exactly under real ESLint with the
real parser, including the two-rule double report on a namespace import. **Q5 is closed
affirmatively; no selector that measured MATCH under esquery came back clean under ESLint.**

One measured fact worth recording because it shaped a false-positive control:
`import * as path from 'node:path'` IS an error, because `no-restricted-imports` reports a
namespace specifier whenever the entry lists `importNames`. The "path.join is legitimate"
control therefore uses a LOCAL object rather than a namespace import -- the namespace form is
asserted as an evasion shape instead, which is where it belongs.

### The four disables, and the fifth position that does not exist

Four `eslint-disable-next-line` directives across three files
(`cache-archive-path.spec.ts` 1, `releases-backend.spec.ts` 1, `release-asset-name.spec.ts`
2). `npx eslint .` from `packages/github-cache` exits 0 with ZERO findings, which is the
measurement that proves all four are USED -- an unused one would be an error under
`reportUnusedDisableDirectives: 'error'`.

RESEARCH C2 confirmed against the live rule set: `cache-archive-path.spec.ts`'s bare
`tmpdir()` call produces NO ban error, so it correctly carries no disable. A fifth directive
there would have failed the build through the phase's own opt-out discipline.

### Corrections recorded for the verifier

- **ROADMAP SC3 says "three CORR-05 violations".** REQUIREMENTS, CONTEXT and RESEARCH all say
  FOUR, and FOUR is what the shipped `CORR_05_SITES` table and the four directives implement.
  Do not read the extra site as scope creep.
- **CONTEXT D-22 and REQUIREMENTS CORR-05 both list `cache-archive-path.spec.ts:26` alongside
  `:1`.** Correct as a SITE (both lines leave together under VER-02 in Phase 9), wrong as an
  error POSITION. The site table keys on the import only.

### Battery at the commit

Eight commands, all exit 0: `format:check`, `build`, `typecheck`, `typecheck:action`, `test`,
`fallow:ci`, `check:action`, `pack:check`. Plus `npx eslint .` at exit 0, run directly because
no `lint` target exists until plan 07-03.

Unit suite: **481 tests across 32 files**, up from 453. The +28 are 7 evasion shapes, 6
false-positive controls, 7 integration-path direction assertions and 8 site assertions.

D-06 prohibitions verified clean again at this commit:
`git diff --exit-code -- packages/github-cache/package.json` and
`git diff --exit-code -- packages/github-cache/src/public-surface.spec.ts`.

### M4 applied early, observed, and reverted (plan 07-02 task 2)

M4 is formally plan 07-04's, but the D-19 guard is worthless unless it can fail, so it was
run against the guard as it was written. Three variants, each producing exactly ONE failing
assertion and no collateral:

| Variant | Mutation to `eslint.config.mjs` | Assertion that went RED | Failure text |
|---|---|---|---|
| M4a (the VALIDATION.md form) | `ignores` -> `['**/*.integration.spec.ts']` | "applies the ban to exactly the extension set it exempts" | the parser's own non-vacuity guard fires first: `expected the glob "**/*.integration.spec.ts" to END in a {ext,ext} group` |
| M4b | `ignores` -> `['**/*.integration.spec.{ts,mts}']` | same | `expected [ 'mts', 'ts' ] to deeply equal [ 'cts', 'mts', 'ts' ]` |
| M4c | BOTH globs -> `{ts,mts}` | "covers every extension the integration vitest config includes" | `an *.integration.spec.cts would be linted as a UNIT spec: the ESLint scope covers mts, ts and the integration vitest config includes cts` |

M4c is the variant that matters most and is NOT in the VALIDATION.md table: it narrows both
globs together, so IDENTITY still holds and only the SUPERSET invariant can catch it. Both
D-19 invariants are therefore independently load-bearing -- the guard is not asserting one
thing twice. `eslint.config.mjs` was restored byte-identical
(`git diff --exit-code` clean) before the commit; no mutation is committed.

The ESLint side is read by IMPORTING `eslint.config.mjs` through a non-literal specifier
(Q6's recommended route). It worked on the first attempt under both `vitest` and `typecheck`,
so the disk-read-plus-comment-strip fallback was NOT needed there. Q6 is closed
affirmatively. The vitest side still uses the disk-read idiom, per Q7, which was not retested.

### Post-merge flake: the toolchain boot was inside the per-test budget

The post-merge gate caught `lint-scope-drift.spec.ts` failing intermittently under
`nx run-many -t typecheck,test --skip-nx-cache` (exit 0, 1, 0 over three runs; Nx's flaky-task
detector fired on one hash with two outcomes). Both new guard files were affected. Measured
costs on an IDLE workstation, against vitest's DEFAULT 5000 ms per-test budget:

| What | Measured |
|---|---|
| bare `import('eslint.config.mjs')` in a cold node | **981 ms** |
| first test in `lint-scope-drift.spec.ts` (pays the resolve) | 731-883 ms |
| every subsequent test in that file | 0-1 ms |
| first test in `lint-rules.spec.ts` (first `lintText` boots config + TS parser) | 592-913 ms |

~5.7x headroom on an idle box, and the cost falls on whichever test runs FIRST -- so the
failure location is arbitrary and the symptom is flakiness rather than "the import is slow".

Fixed by hoisting the one-time cost into `beforeAll(fn, 30_000)` in each file, NOT by raising
`testTimeout` (which would mask the class for all 486 tests). Controlled experiment, pinning
the per-test budget just above the observed cost, because repeat-running until green proves
nothing when the broken version already produced three green runs:

| Version | `--testTimeout=500` | `--testTimeout=50` |
|---|---|---|
| pre-fix | **2 failed** / 40 passed, `Test timed out in 500ms` on the exact reported test AND on `lint-rules.spec.ts`'s first test | not run |
| post-fix | 42 passed | **42 passed** |

Post-fix passes at a budget 100x TIGHTER than the default, where pre-fix already failed.
First-test duration 731/883 ms -> 2/3 ms; headroom ~5.7x -> >2500x. Structural, not
statistical.

Note the pre-fix run reproduced the timeout in `lint-rules.spec.ts` too, which had NOT failed
in the gate's three runs -- so treating that file was closing a measured exposure rather than
a speculative one.

Final state: `npm exec -- nx run-many -t typecheck,test --skip-nx-cache` run 8 times, exit 0
every time, zero `Test timed out` in any log. M4b re-run against the refactored guard still
fails on exactly the right assertion.

---

## Plan 07-03

Recorded: 2026-07-27. Host: Windows 11 arm64, node v24.13.0, npm 11.6.2.

### C8 satisfied, and PROVEN rather than assumed

`@nx/eslint@23.1.0`'s `createNodes` short-circuits with
`if (eslintConfigFiles.length === 0) { return []; }` and produces NO target, silently. So the
registration was verified by asking the graph, not by reading the config back:

```
npm exec -- nx show project @op-nx/github-cache --json
targets: typecheck, build, build-deps, watch-deps, test, lint, integration, nx-release-publish
```

`lint` is present, so the config-existence gate was satisfied by plan 07-01's
`eslint.config.mjs`. Exactly ONE new target appeared.

### D-35 -- the inferred `lint` target's HASHED node values (the Phase 8 CORR-03 baseline)

Read from `nx show project @op-nx/github-cache --json` on Windows, AFTER `targetDefaults.lint`
was applied, so this is the effective node Nx folds into `hash_project_config`. `metadata` is
NOT hashed and is therefore omitted -- the `${pmc.exec}` it contains (`npx eslint --help` on
this host) is a non-issue for the hash.

| Hashed field | Value on Windows |
|---|---|
| `targetName` | `lint` |
| `executor` | `nx:run-commands` |
| `outputs` | `[]` |
| `options.cwd` | `packages/github-cache` |
| `options.command` | `eslint .` |
| `configurations` | `{}` |
| `parallelism` | `true` |

`cache` is `true`, inferred; it is deliberately NOT restated in `targetDefaults` (D-24).

**This is a BASELINE, not a closure.** Whether `@nx/eslint` infers the same node on Linux is
UNVERIFIED BY DESIGN (D-35, T-07-17): the existence gate runs
`eslint.isPathIgnored(join(workspaceRoot, file))` with a POSIX `join` over an absolute Windows
root, and F18 confirms that gate genuinely runs for this project layout. Phase 8's CORR-03
two-leg measurement treats `lint` as a FOURTH target and settles it empirically. The
`options.cwd` row is the one most likely to diverge, and it is hashed.

### C7 -- the real inferred input list, checked against the replacement rather than assumed

D-24's premise is "the block must restate everything it keeps", so the inferred list was read
from the installed plugin (`node_modules/@nx/eslint/dist/src/plugins/plugin.js:288-302`,
`buildEslintTargets`) rather than from `STACK.md`'s quote, which is one entry short.

| # | Inferred entry | Resolves to, here | Restated? |
|---|---|---|---|
| 1 | `default` | -- | yes |
| 2 | `^default` | -- | yes |
| 3 | `{workspaceRoot}/<each eslint config>` | `{workspaceRoot}/eslint.config.mjs` | yes |
| 4 | `<projectRoot>/.eslintignore`, only `existsSync` | ABSENT -- no such file | n/a, not emitted |
| 5 | `...tsconfigChainOutsideProjectRoot` | `{workspaceRoot}/tsconfig.base.json` | **no, deliberately** |
| 6 | `{workspaceRoot}/tools/eslint-rules/**/*` | -- | yes |
| 7 | `{ externalDependencies: ['eslint'] }` | -- | **widened to four** |

Entry 5 is the one STACK.md omits. All three of `tsconfig.json`, `tsconfig.lib.json` and
`tsconfig.spec.json` extend `../../tsconfig.base.json` and nothing else, so the chain resolves
to exactly that one file -- which `sharedGlobals` already folds into `default`, entry 1. The
replacement list therefore needs no extra entry, and that is a checked conclusion rather than
an inherited one.

Entry 7 is the LINT-04 hole. `outputs` also changed, from the inferred `['{options.outputFile}']`
to `[]`, which removes that token from `hash_project_config` entirely (D-24).

### TDD: the RED, assertion by assertion

Probes written and run BEFORE `targetDefaults.lint` existed. The helper indexes
`nxJson.targetDefaults['lint']`, so every new assertion throws
`TypeError: Cannot read properties of undefined (reading 'inputs')` -- loud and unambiguous.

**7 failed, 7 passed of 14.**

| Assertion | RED | Why |
|---|---|---|
| the four pre-existing `typecheck` / `build` probes | PASS | untouched; confirms the fourth `PROBE_FILES` entry broke nothing |
| `lint` hashes the lib sources | **FAIL** | no `lint` target default |
| `lint` hashes the spec sources | **FAIL** | same |
| `lint` does NOT hash a path outside the project root | **FAIL** | same |
| `lint` lists all four ESLint external dependencies | **FAIL** | same |
| `lint` declares no outputs | **FAIL** | same |
| CORR-04: `integration` is the only runtime input | PASS | **a direction control -- passes on BOTH sides by design** |
| the two pre-existing `test.inputs` literal pins | PASS | untouched |
| `eslint.config.mjs` is a `lint` input | **FAIL** | no `lint` target default |
| the custom rule directory is a `lint` input | **FAIL** | same |

**GREEN after step 2: 14 passed of 14.** The CORR-04 control passing on both sides is the same
device plan 07-02 used for its integration-path pair: had it failed in RED, the failure would
have meant the spec could not read `nx.json` at all rather than that `lint` was missing.

### The negative control, and the mutation proving it is the ONLY one that catches vacuity

`build` is the discriminator the `typecheck` probes use, and it is UNUSABLE for `lint`:
`lint`'s inputs start from `default` (`{projectRoot}/**/*`), so hashing a spec is exactly what
`lint` is supposed to do. The chosen negative is a probe path OUTSIDE `{projectRoot}` --
`start-cache-server/entry.ts`, a real file, genuinely not linted, and already present in
`test.inputs` as a `{workspaceRoot}` string so both frames are visible side by side. It is a
fourth entry in `PROBE_FILES`; every pre-existing assertion is a `toContain` / `not.toContain`
on a named path and none is a whole-array comparison, which the RED run confirmed empirically
(all four pre-existing probes still passed).

Two mutations, each applied, observed and REVERTED before the commit.

| # | Mutation to `nx.json` | Result |
|---|---|---|
| M6a | remove `{workspaceRoot}/eslint.config.mjs` from `targetDefaults.lint.inputs` | **1 failed / 13 passed** -- exactly the expected assertion, zero collateral |
| MV | reduce `lint.inputs` to `^default` + the `externalDependencies` object, so the SELF pattern list resolves EMPTY | **3 failed / 11 passed** |

MV is the one that matters. With an empty pattern list `filterUsingGlobPatterns` returns the
WHOLE probe list untouched, so **both positive `toContain` assertions still PASSED** -- a
resolver that resolved nothing looked exactly like a working one. The out-of-project negative
was the only glob-resolution assertion that caught it. (The two literal-pinning assertions also
fired, but they pin strings the same mutation deleted; they are not evidence about the filter.)
That is the vacuity trap this control exists for, reproduced rather than argued.

M6's second half -- the stale-cache HIT differential -- is plan 07-04's, and is not claimed
here.

`nx.json` restored byte-identical after each mutation, re-verified at 14 passed of 14.

### The battery is NINE commands from this plan's second commit

`npm run lint` was added as `nx run-many -t lint` and joins the battery between `test` and
`fallow:ci`. First run, cold by construction (the plugin registration rotated every hash):

```
Successfully ran target lint for project @op-nx/github-cache
Run duration: 1.7s
Cache: 0/1 hit (0%)
```

1.7 s is the number behind D-33's "lint runs in seconds, a fifth cache producer buys nothing".

| Commit | Battery | Result |
|---|---|---|
| `b3fdf6d` (plugin + inputs + probes) | EIGHT: `format:check`, `build`, `typecheck`, `typecheck:action`, `test`, `fallow:ci`, `check:action`, `pack:check` | all exit 0 |
| this plan's second commit (script + CI job) | **NINE** -- the above plus `lint` | all exit 0 |

Unit suite at both commits: **494 tests across 33 files**. The delta is +8, all of them this
plan's, and all in `nx-target-inputs.spec.ts` (6 assertions -> 14).

### The CI job, verified structurally rather than by eye

`.github/workflows/ci.yml` parsed with the `yaml` package after the edit:

```
jobs: format-check, lint, fallow, action-bundle-drift, pack-check, ppe, build, typecheck,
      test, integration, dogfood-seed, dogfood-verify, consumer-smoke, publish, publish-verify

lint steps: [{"uses":"actions/checkout@v7"},
             {"uses":"actions/setup-node@v6","with":{"node-version-file":".node-version","cache":"npm"}},
             {"run":"npm ci"},
             {"run":"npm run lint"}]
```

Exactly the four steps of the `fallow` boilerplate: no background sidecar, no `cancel:`, no
build step. `git grep 'needs:' -- .github/workflows/ci.yml` returns no job depending on `lint`,
and no spec asserts on `ci.yml` -- it is not an Nx input yet, and PARITY-06 registers it in
Phase 9.

### Verification items from the plan, all checked at the final commit

| Check | Result |
|---|---|
| `nx show project` lists exactly ONE new target, `lint` | yes |
| `packages/github-cache/project.json` untouched (D-01/D-02) | `git diff --exit-code` clean |
| `packages/github-cache/package.json` untouched (D-06) | `git diff --exit-code` clean |
| `integration` is still the only target with a platform input (CORR-04) | asserted in the guard, passing |
