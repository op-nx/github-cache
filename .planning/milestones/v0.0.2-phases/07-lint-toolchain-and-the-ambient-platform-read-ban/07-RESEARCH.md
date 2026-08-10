# Phase 7: Lint Toolchain and the Ambient-Platform-Read Ban - Research

**Researched:** 2026-07-27
**Domain:** ESLint 9 flat-config adoption in an Nx 23.1.0 workspace; AST-level rule authoring
**Confidence:** see per-claim labels. Nothing here is presented as verified that was not.

> **This document does NOT restate `.planning/research/v0.0.2/STACK.md` sections 0-1.7 or
> `PITFALLS.md` section E.** Those are the dependency table, the v9-vs-v10 call, the inferred-target
> shape, the `hash_project_config` mechanism, the OS-variance audit, the LINT-04 input block, the
> two-rule requirement, LINT-05/06 wiring and the pinning obligation. Read them first. This document
> answers only the gaps a planner cannot get from them, and corrects them where they are wrong.

<user_constraints>
## User Constraints (from 07-CONTEXT.md)

`07-CONTEXT.md` is the authoritative copy and is NOT duplicated here (it is 525 lines; duplicating
it would guarantee drift). It is REQUIRED reading for the planner. Summary of its binding force:

### Locked Decisions

**D-01 through D-36 in `07-CONTEXT.md` are LOCKED.** Nothing in this document reopens one. Where a
decision's supporting FACT turns out to be wrong, the correction is filed under
`## Corrections to Existing Artifacts` and the decision's INTENT is preserved.

Index, so the planner can map a task to its decisions:

| Group | IDs | Subject |
|---|---|---|
| Toolchain adoption | D-01..D-06 | `@nx/eslint` inference plugin (USER-SELECTED, CLOSED); five exact-pinned devDeps; ESLint 9.39.5; `pinned-deps.spec.ts` names; linux/arm64 lockfile container; package manifest untouched |
| Lint scope | D-07..D-10 | project-scoped `eslint .` at `cwd=packages/github-cache`; never create a root `src/`/`lib/`; no `.eslintignore`; single root `eslint.config.mjs` |
| Rule set | D-11..D-14 | js+tseslint recommended NON-type-checked; bounded-cleanup rule; `.cjs` scoping; no prettier bridge |
| The ban | D-15..D-18 | two core rules; `{ts,mts,cts}` in BOTH globs; `ignores` beside `files`; `cachePlatform('win32')` is the canonical allowed shape |
| Drift guard | D-19 | superset assertion, not set equality |
| RED before GREEN | D-20..D-23 | permanent programmatic spec via `lintText`; evasion fixtures; four-site table; mutation-test the guard |
| Stale cache | D-24..D-27 | `targetDefaults.lint` full input list + `outputs: []`; `test.inputs` in the SAME commit; extend `nx-target-inputs.spec.ts`; close by differential |
| Opt-out | D-28..D-31 | `reportUnusedDisableDirectives: 'error'`; scoped comments-plugin prefix; `ban-ts-comment`; four described disables in the rules commit |
| CI wiring | D-32..D-34 | `lint` job + root script; no sidecar dogfood; no `--max-warnings`, no `command` override |
| Phase 8 hand-off | D-35, D-36 | record the inferred target's hashed node values; record the all-MISS push in advance |

### Claude's Discretion (verbatim from CONTEXT.md)

- Exact esquery selector strings, rule `message` wording, flat-config file layout and config-object
  ordering, and the per-site disable reason prose.
- Which recommended-set rules (if any) end up scoped off under D-12, and where the fix-vs-disable
  line falls. Decide on the measured count and record the call with its number.
- Whether the D-21 evasion fixtures live inline in the spec or as exported string constants in a
  sibling module.
- Whether the D-19 drift guard and the D-20/D-22 RED proof are one spec file or two.

**This document exercises that discretion** in G2 (a validated selector set), G3 (config-object
ordering, forced by a mechanism), and G4 (a measured-by-proxy baseline). Those are RECOMMENDATIONS
with their evidence attached, not new locks.

### Deferred Ideas (OUT OF SCOPE, verbatim heads from CONTEXT.md)

Mechanising `curly` / blank-lines-around-control-flow; the `lint` sidecar dogfood block (D-33);
linting the root-level files the project-scoped target misses; the `eslint@10` bump; regenerating
`.planning/codebase/*`. Also surfaced and NOT owned here: the per-phase-vs-milestone-end PR question.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description (abridged from REQUIREMENTS.md) | Research support in this document |
|----|---------------------------------------------|-----------------------------------|
| LINT-01 | ESLint v9 flat config + a `lint` target in the CI battery; new devDeps exact-pinned AND their names added to `pinned-deps.spec.ts` | G1 (config resolution works from the package cwd), G3 (what actually gets linted, and the `ignores` block without which the target is nondeterministic), G6 (fallow stays green), G7 (ordering: the config file must exist before the plugin infers anything) |
| LINT-02 | Two rules banning ambient platform reads in unit specs, allowed in integration specs; full `{ts,mts,cts}` set in both globs | G2 (validated selector set P1..P7, plus the `no-restricted-imports` behaviour read from the rule source), G1(b) (the glob base path, which every one of these globs depends on) |
| LINT-03 | Proven RED before GREEN over the evasion shapes AND the four extant CORR-05 sites | G1(c) (`lintText` semantics and its vacuity trap), G2 (per-shape CAUGHT / ceiling verdicts, measured), G8 (mutation-test protocol) |
| LINT-04 | `lint` inputs declared so it cannot serve a stale-cache false PASS | G5 (the literal differential command sequence with expected `Cache:` lines), G3 (the filesystem-walk-vs-Nx-file-map mismatch, a NEW instance of the class), G7 (D-25's same-commit constraint) |
| LINT-05 | Opt-out only via a described disable; bare `@ts-expect-error`/`@ts-ignore` also an error | G4 (baseline: zero existing disables and zero existing ts-comments, so both rules land green), G7 (the four disables land with the rules) |
| LINT-06 | `reportUnusedDisableDirectives: 'error'`; a stale disable FAILS | G2 (only FOUR error positions exist, and `:26` is NOT one of them, so a disable there would itself fail LINT-06) |
| CORR-06 | The strategy is MECHANICALLY enforced; same APIs stay ALLOWED in integration | G1(b)+G1(c) (how `files`/`ignores` resolve and how `lintText` proves both directions), G2 (zero false positives across eight ALLOW controls) |

</phase_requirements>

## Verified Facts

Confidence labels: **VFS** = verified from source read this session; **VFD** = verified from official
docs; **MEAS** = measured on this repo this session; **REAS** = reasoned from a verified mechanism;
**ASSUMED** = training knowledge, unverified.

| # | Fact | Label | Source |
|---|------|-------|--------|
| F1 | ESLint 9.39.5 locates the flat config with `findUp(FLAT_CONFIG_FILENAMES, { cwd: fromDirectory })`, i.e. it DOES search ancestor directories upward from `cwd`. | VFS | `eslint-9.39.5/lib/config/config-loader.js:527-556` (`ConfigLoader.locateConfigFileToUse`) |
| F2 | The base path for `files`/`ignores` glob matching is `path.dirname(configFilePath)` -- the CONFIG FILE's directory, not `cwd`. It is passed to `new FlatConfigArray(baseConfig, { basePath, shouldIgnore })`. | VFS | `config-loader.js:547`, `:600-605` |
| F3 | `FLAT_CONFIG_FILENAMES` = `eslint.config.{js,mjs,cjs,ts,mts,cts}`, searched in that order. | VFS | `config-loader.js:43-50` |
| F4 | v9's default config loader is `LegacyConfigLoader`, which resolves ONE config from `cwd` (via the same upward search) and reuses it for every file. Same answer for our layout either way. | VFS | `config-loader.js:703-790` |
| F5 | `lintText(code, { filePath })` resolves `path.resolve(cwd, filePath)` and then checks `configs.getConfigStatus(resolvedFilename)`. If the status is not `"matched"` it does NOT lint; it pushes a warning result only when `warnIgnored` is truthy. | VFS | `eslint-9.39.5/lib/eslint/eslint.js:1081-1176` |
| F6 | The ESLint constructor's `warnIgnored` default is `true`. | VFS | `eslint-9.39.5/lib/eslint/eslint-helpers.js:822` |
| F7 | ESLint's default config globs ONLY `**/*.js`, `**/*.mjs`, `**/*.cjs`, and globally ignores ONLY `**/node_modules/` and `.git/`. `.ts`/`.mts`/`.cts` are NOT globbed by default, and `dist/`, `out-tsc/`, `test-output/` are NOT ignored by default. | VFS | `eslint-9.39.5/lib/config/default-config.js` |
| F8 | The default `linterOptions.reportUnusedDisableDirectives` is `1` (= `"warn"`), confirming D-28's premise. | VFS | `default-config.js` (`linterOptions: { reportUnusedDisableDirectives: 1 }`) |
| F9 | `eslint .` from a directory pushes the glob `<abs>/**` and walks the REAL FILESYSTEM (`@humanfs/node` `hfs.walk`), keeping an entry only when `matchesPattern && config !== undefined`. It does not consult git. | VFS | `eslint-helpers.js:516-640` (`findFiles`), `:259-380` (`globSearch`) |
| F10 | Core `no-restricted-imports` in 9.39.5 has visitors for `ImportDeclaration`, `ExportNamedDeclaration`, `ExportAllDeclaration`, `TSImportEqualsDeclaration` ONLY. **There is no `ImportExpression` visitor, so it cannot see `await import('node:os')`.** | VFS | `eslint-9.39.5/lib/rules/no-restricted-imports.js:815-845` |
| F11 | `no-restricted-imports` DOES report a namespace import: `ImportNamespaceSpecifier` maps to the name `"*"`, and when `importNames` is set it reports messageId `everything`/`everythingWithCustomMessage` REGARDLESS of the local binding name. | VFS | `no-restricted-imports.js:785-786`, `:441-462` |
| F12 | `paths[].name` matching is EXACT (`Object.hasOwn(groupedRestrictedPaths, importSource)` on the trimmed source string). `'node:os'` and `'os'` are separate entries and both must be listed. | VFS | `no-restricted-imports.js:393`, `:770` |
| F13 | `typescript-eslint@8.65.0`'s `configs.recommended` is a 3-element array. Element 1 (`typescript-eslint/base`) has **NO `files` key**, so it sets `parser` and `sourceType: 'module'` for EVERY linted file, including `.cjs`. Element 3 (`typescript-eslint/recommended`) also has no `files` key, so its 24 rules apply to every linted file. Only element 2 (`typescript-eslint/eslint-recommended`) is scoped, to `['**/*.ts','**/*.tsx','**/*.mts','**/*.cts']`. | VFS | `@typescript-eslint/eslint-plugin@8.65.0` `dist/configs/flat/{base,recommended,eslint-recommended}.js`, `dist/configs/eslint-recommended-raw.js` |
| F14 | `typescript-eslint/eslint-recommended` turns OFF 19 core rules for TS files (including `no-undef`, `no-redeclare`, `no-unreachable`) and turns ON `no-var`, `prefer-const`, `prefer-rest-params`, `prefer-spread`. `no-unused-vars` is replaced by `@typescript-eslint/no-unused-vars`. | VFS | `eslint-recommended-raw.js` |
| F15 | `@eslint/js@9.39.5` `configs.recommended` enables exactly 61 rules. | MEAS | required the published module and counted non-`off` entries |
| F16 | `@nx/eslint@23.1.0` returns `[]` (no lint targets at all) when no `eslint.config.*` / `.eslintrc.*` file exists anywhere. The config file's EXISTENCE is what creates the target. | VFS | `nrwl/nx` @ `23.1.0` `packages/eslint/src/plugins/plugin.ts` `createNodes`, `if (eslintConfigFiles.length === 0) return []` |
| F17 | The inferred target's `inputs` at 23.1.0 ALSO include `...tsconfigChainOutsideProjectRoot.map(f => '{workspaceRoot}/' + f)`. STACK.md 1.3's quoted shape omits this. For this repo the chain is exactly `tsconfig.base.json`, which `sharedGlobals` -> `default` already covers, so dropping it in D-24's replacement list is harmless. | VFS + MEAS | `plugin.ts` `buildEslintTargets`; `packages/github-cache/tsconfig.json` extends `../../tsconfig.base.json`; `nx.json` `sharedGlobals` |
| F18 | The `isPathIgnored` existence gate runs for this project because `configDir` (`.`) `!== projectRoot` (`packages/github-cache`). D-35's recorded OS-divergence risk is live, not theoretical. | VFS | `plugin.ts` `internalCreateNodesV2`, `if (configDir !== projectRoot \|\| projectRoot === '.')` |
| F19 | The repo's pre-commit battery is EIGHT commands: `format:check`, `build`, `typecheck`, `typecheck:action`, `test`, `fallow:ci`, `check:action`, `pack:check`. `integration` is NOT in it. Phase 7 makes it nine. | MEAS | root `package.json` scripts; `quick/260726-gok-.../260726-gok-SUMMARY.md` "Battery result per commit" |
| F20 | `fallow@3.6.0`'s platform binary contains a built-in config-filename table that includes `eslint.config.{js,cjs,mjs,ts,mts,cts}` adjacent to `vitest.config.*`, `jest.config.*`, `vite.config.*`, and a paired `eslint.config.<ext>` + `eslint` string suggesting a config-file-to-package crediting map. | MEAS (binary strings) | `rg -uu -a` over `node_modules/@fallow-cli/win32-arm64-msvc/fallow.exe` |
| F21 | The repo has ZERO existing `eslint-disable` comments and ZERO `@ts-expect-error`/`@ts-ignore` comments in `packages/github-cache/**`. LINT-05's two rules therefore have a zero baseline. | MEAS | `git grep -n "eslint-disable" -- 'packages/github-cache/**'` -> empty; same for the ts-comments |
| F22 | `tsconfig.base.json` sets `noUnusedLocals: true` but NOT `noUnusedParameters`. Unused locals and unused imports are already impossible; unused PARAMETERS are the only residual `@typescript-eslint/no-unused-vars` surface. | MEAS | `tsconfig.base.json` |
| F23 | `packages/github-cache` contains exactly ONE non-TypeScript source file inside the lint scope: `pack-check.cjs`. The two `.mts` vitest configs are TypeScript from ESLint's point of view. There is no `.js`/`.mjs`/`.jsx`/`.html`/`.vue` tracked file in the project. | MEAS | `git ls-files 'packages/github-cache/**' \| rg -v "\.ts$"` |
| F24 | On disk today `packages/github-cache/dist/` holds 30 `.js` + 30 `.d.ts` + 30 `.map`, and `out-tsc/` holds 35 `.d.ts` + 1 `.mts`. All are gitignored. All would be LINTED without an explicit `ignores` entry (F7 + F9). | MEAS | `find` over both directories |
| F25 | `esquery@1.7.0` is already installed in this workspace (transitively). `@babel/parser` is too. That is how G2's selector verdicts below were MEASURED rather than reasoned. | MEAS | `node_modules/esquery/package.json`, `node_modules/@babel/parser` |

---

## G1. Flat-config resolution under `cwd = packages/github-cache` with the config at the root

**Verdict: D-01 / D-07 WORK AS WRITTEN. No `--config` flag, no per-project config, no blocking
finding.** All three sub-answers are VFS from the ESLint 9.39.5 tarball
(`registry.npmjs.org/eslint/-/eslint-9.39.5.tgz`, streamed and read this session; ESLint is not
installed in this workspace).

### (a) Ancestor search: YES

```js
// eslint-9.39.5/lib/config/config-loader.js:527-556
static async locateConfigFileToUse({ useConfigFile, cwd, fromDirectory = cwd }) {
  let configFilePath;
  let basePath = cwd;
  if (typeof useConfigFile === "string") {          // --config <path>
    configFilePath = path.resolve(cwd, useConfigFile);
    basePath = cwd;
  } else if (useConfigFile !== false) {
    configFilePath = await findUp(FLAT_CONFIG_FILENAMES, { cwd: fromDirectory });
    if (configFilePath) { basePath = path.dirname(configFilePath); }
  }
  return { configFilePath, basePath };
}
```

`findUp` is the `find-up` package; it walks `fromDirectory` and every ancestor. With
`cwd = <root>/packages/github-cache` and the config at `<root>/eslint.config.mjs`, the search finds
it on the second hop. The default v9 loader (`LegacyConfigLoader`) calls this with
`fromDirectory = cwd` and caches one array for the whole run (F4), so there is no per-file
divergence to reason about either.

**Planner consequence:** do NOT add `--config`. D-34 forbids overriding `options.command`, and
`--config` is also actively harmful here -- look at the `useConfigFile` branch: it sets
`basePath = cwd`, which would move every glob's base to `packages/github-cache` and silently change
the meaning of every `files`/`ignores` pattern relative to what (b) describes. The one-line
convenience flag would rewrite the glob semantics the whole rule set is built on.

### (b) Glob base path: the CONFIG FILE's directory (the workspace root)

`basePath = path.dirname(configFilePath)` and it is handed straight to the config array:

```js
// config-loader.js:600-605
const configs = new FlatConfigArray(baseConfig || [], { basePath, shouldIgnore: ignoreEnabled });
```

**STACK.md 1.5's assertion is CORRECT at 9.39.5.** Every `files` and `ignores` glob in
`eslint.config.mjs` is matched against a path relative to the WORKSPACE ROOT, regardless of the
`cwd` the target runs with.

This is not a footnote. It dictates the shape of every pattern in the config:

| Intent | Correct pattern | WRONG pattern, and what it silently does |
|---|---|---|
| all unit specs | `**/*.spec.{ts,mts,cts}` | `src/**/*.spec.ts` -- root-relative, matches nothing (there is no `<root>/src`), so the BAN NEVER FIRES and LINT-03 reads as "the rule does not work" |
| exempt integration specs | `**/*.integration.spec.{ts,mts,cts}` | `src/**/*.integration.spec.ts` -- matches nothing, so integration specs are banned too (the E5 inversion, reached by a different route) |
| ignore build output | `**/dist/`, `**/out-tsc/` (or the explicit `packages/github-cache/dist/`) | `dist/` -- means `<root>/dist/`, which does not exist; `packages/github-cache/dist/**` stays linted (see G3) |

Because every pattern the phase needs starts with `**/`, the base path is invisible right up until
someone "tidies" one of them into a project-relative form. **Comment-lock the reason in
`eslint.config.mjs`**, in the house style: state that globs are workspace-root-relative because
`basePath = dirname(eslint.config.mjs)` even though the target's `cwd` is the package directory.

### (c) `lintText(code, { filePath })`: applies `files`/`ignores`, and has a vacuity trap

```js
// eslint-9.39.5/lib/eslint/eslint.js:1131-1160  (abridged, structure verbatim)
const resolvedFilename = path.resolve(cwd, filePath || "__placeholder__.js");
const configs = await this.#configLoader.loadConfigArrayForFile(resolvedFilename);
const configStatus = configs?.getConfigStatus(resolvedFilename) ?? "unconfigured";

if (resolvedFilename && configStatus !== "matched") {
  const shouldWarnIgnored = typeof warnIgnored === "boolean" ? warnIgnored : constructorWarnIgnored;
  if (shouldWarnIgnored) { results.push(createIgnoreResult(resolvedFilename, cwd, configStatus)); }
} else {
  const config = configs.getConfig(resolvedFilename);
  results.push(verifyText({ text: code, filePath: resolvedFilename, configs, cwd, ... }));
}
```

So: **YES**, `files`/`ignores` matching is applied against the supplied `filePath`. D-20's
one-mechanism-proves-both-directions design is sound.

**The trap, and it is the single most likely way this phase ships a vacuous guard.** There are THREE
outcomes, and two of them produce zero rule errors:

| `configStatus` | Meaning | `messages` | Reads to a naive assertion as |
|---|---|---|---|
| `matched` | some config object's `files` matched the path | the real lint result | correct |
| `ignored` | the path hit an `ignores`-only (global) ignore | `[]`, or one `warning` if `warnIgnored` | "the rule did not fire" |
| `unconfigured` | NO config object with `files` matched the path | `[]`, or one `warning` if `warnIgnored` | "the rule did not fire" |

A synthetic path typo (`'x.spec.tsx'`, `'/tmp/foo.spec.ts'`, a forgotten extension) lands in
`unconfigured` and the RED-proof spec passes its "no error at the integration path" assertion for
entirely the wrong reason -- while its "error at the unit path" assertion fails loudly, so the
executor "fixes" the wrong thing.

**Mandatory mitigation, and it costs two lines.** Construct with `warnIgnored: true` (the default,
F6, but set it explicitly) and assert, for EVERY fixture path in both directions, that the result
carries no ignore/unconfigured warning:

```js
// Non-vacuity control for the RED proof. ESLint returns ZERO messages for a path
// it considers `ignored` or `unconfigured`, which is indistinguishable from
// "the rule did not fire". warnIgnored surfaces that as a warning we can reject.
expect(result.messages.filter((m) => m.severity === 1 && !m.ruleId)).toEqual([]);
```

`createIgnoreResult` emits a message with `ruleId: null` and `severity: 1`, which is exactly what
that filter catches. A rule violation has a non-null `ruleId`, so the control cannot mask a real
finding.

### Exact constructor options for the RED-proof spec

The spec file lives at `packages/github-cache/src/<name>.spec.ts`, and vitest runs it with
`process.cwd()` at the repo root (Nx invokes `vitest` with `cwd: packages/github-cache`, but
`vitest.config.mts` sets `root: __dirname`; do not rely on either). Pin `cwd` explicitly rather than
inheriting it -- `cwd` participates in `path.resolve(cwd, filePath)` at eslint.js:1131, so an
inherited cwd makes the synthetic paths ambiguous:

```ts
import { ESLint } from 'eslint';
import { fileURLToPath } from 'node:url';

// Resolve the WORKSPACE ROOT from this module, never from process.cwd() -- the
// repo convention (cleanup-workflow.spec.ts, ppe-action.spec.ts, pinned-deps.spec.ts).
const WORKSPACE_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

const eslint = new ESLint({
  cwd: WORKSPACE_ROOT,   // makes relative filePaths workspace-root-relative,
                         // i.e. the same frame the config's globs use (F2)
  warnIgnored: true,     // explicit; see the vacuity control above
  // Do NOT pass overrideConfigFile: the point is to load the REAL root config.
  // Do NOT pass overrideConfig: it would add a config object the product run
  // does not have, and the guard would stop testing the shipped rule set.
});

const [result] = await eslint.lintText(source, {
  filePath: 'packages/github-cache/src/__fixture__.spec.ts',
});
```

Three notes the planner should carry verbatim into the task:

1. **`cwd: WORKSPACE_ROOT` makes the upward search terminate at the root config on hop zero.** It
   also makes `path.resolve(cwd, filePath)` produce exactly the workspace-relative frame that `files`
   globs are matched in, so a fixture path and a config glob can be read side by side.
2. **Use a path under the real project tree, not a bare `foo.spec.ts`.** `getConfigStatus` is a pure
   path match (no `existsSync`), so the file need not exist -- but keeping the fixture path inside
   `packages/github-cache/src/` means the same fixture also proves the path SHAPE the ban is scoped
   to, and matches how the four real sites are addressed in D-22.
3. **`import { ESLint } from 'eslint'` makes `eslint` a genuine import of the root devDependency.**
   That resolves the G6 question for the `eslint` package itself (fallow will see a real import) and
   is a second, independent reason `{workspaceRoot}/eslint.config.mjs` plus the ESLint
   `externalDependencies` must be in `test.inputs` (D-25).

---

## G2. The selector set, MEASURED against the four real expressions and every evasion shape

**Method (so the planner can re-run it).** `esquery@1.7.0` and `@babel/parser` are already in this
workspace's `node_modules` (F25). Each source shape below was parsed with
`@babel/parser` `{ sourceType: 'module', plugins: ['estree', 'typescript'] }` -- which emits the
ESTree node shapes `@typescript-eslint/parser` emits for all constructs used here
(`MemberExpression`, `VariableDeclarator`, `ObjectPattern`/`Property`, `ImportDeclaration`,
`ImportExpression`) -- and then run through `esquery(ast.program, selector)`. Match counts are
MEASURED, not reasoned. Residual risk: babel-estree and ts-estree could differ on a node this table
does not exercise; the D-20 spec running real ESLint is the authoritative confirmation, and it will
run in-phase.

### The four real violation sites, read from disk

| # | File:line | Exact expression | Caught by | Error position |
|---|---|---|---|---|
| 1 | `src/lib/cache-archive-path.spec.ts:1` | `import { tmpdir } from 'node:os';` | `no-restricted-imports` (F12: exact `'node:os'` entry, `importNames` includes `tmpdir`) | line 1, at the `tmpdir` specifier |
| 1b | `src/lib/cache-archive-path.spec.ts:26` | `expect(dirname(path)).toBe(tmpdir());` | **NOTHING, and correctly so** | **no error** |
| 2 | `src/backend/releases-backend.spec.ts:38` | `cachePlatform(process.platform) === 'windows' ? 'linux' : 'win32';` | `no-restricted-syntax` P1 | line 38 |
| 3 | `src/lib/release-asset-name.spec.ts:39` | `releaseAssetName('abc123' as Hash, process.platform),` | `no-restricted-syntax` P1 | line 39 |
| 4 | `src/lib/release-asset-name.spec.ts:60` | `expect(cachePlatform()).toBe(cachePlatform(process.platform));` | `no-restricted-syntax` P1 | line 60 |

**Blocking correction for D-31 / D-22.** Site 1b is a bare call of a binding whose IMPORT is already
banned. No selector reaches it and none should: in strict ESM a `tmpdir` identifier cannot exist
without an import, and the import is the chokepoint. Measured: the standalone expression
`expect(dirname(p)).toBe(tmpdir());` matches ZERO selectors in the set below.

Therefore **there are FOUR sites but only FOUR error POSITIONS at lines 1, 38, 39 and 60 -- NOT at
line 26.** If the executor puts an `eslint-disable-next-line` above line 26, that directive is
UNUSED, and D-28's `reportUnusedDisableDirectives: 'error'` fails the build. The phase would ship
red because of its own opt-out discipline. Write this into the plan explicitly.

Also note: `cache-archive-path.spec.ts:3` (`import { basename, dirname, isAbsolute } from
'node:path'`) is NOT an error -- the banned `node:path` `importNames` are `sep`, `delimiter`,
`win32`, `posix`, and F12's per-name check only reports listed names.

**Second-order:** a disable comment inserted above line 38 shifts every later line by one, in the
same commit. **The D-22 site table must key on FILE + EXPRESSION TEXT, never on a line number**, and
the guard spec should locate the position by searching the file for the expression. Line numbers in
that table rot in the very commit that creates them.

### The recommended `no-restricted-syntax` selector set (MEASURED)

```js
// P1  process.platform / process.arch, the primary shape (3 of the 4 real sites)
"MemberExpression[computed=false][object.name='process'][property.name=/^(platform|arch)$/]"

// P2  computed evasion: const k = 'platform'; process[k]
"MemberExpression[computed=true][object.name='process']"

// P3  aliasing AND destructuring in one selector: const p = process / const { platform } = process
"VariableDeclarator[init.name='process']"

// P4  node:os accessor off a namespace object (backstop; see the ceiling note)
"MemberExpression[computed=false][object.name=/^(os|nodeOs)$/][property.name=/^(tmpdir|EOL|platform|arch|homedir|type|release)$/]"

// P5  path.sep / path.delimiter / path.win32 / path.posix off a namespace object
"MemberExpression[computed=false][object.name=/^(path|nodePath)$/][property.name=/^(sep|delimiter|win32|posix)$/]"

// P6  dynamic import -- REQUIRED, no-restricted-imports cannot see it (F10)
"ImportExpression[source.value=/^(node:)?(os|path)$/]"

// P7  optional: globalThis.process.platform
"MemberExpression[computed=false][object.property.name='process'][property.name=/^(platform|arch)$/]"
```

### Measured verdicts, shape by shape

| Shape | Verdict | Matched by | Note |
|---|---|---|---|
| `process.platform` (sites 2, 3, 4) | **CAUGHT** | P1 x1 each | primary |
| `import { tmpdir } from 'node:os'` (site 1) | **CAUGHT** | `no-restricted-imports` | F12 |
| `tmpdir()` bare call (site 1b) | not matched, by design | -- | import is the chokepoint |
| `const { platform } = process` (D-21) | **CAUGHT** | P3 | |
| `const p = process; p.platform` (D-21) | **CAUGHT** | P3 (at the binding, not the read) | error points at the alias, which is the better location anyway |
| `import { platform } from 'node:os'` (D-21) | **CAUGHT** | `no-restricted-imports` | |
| `import * as os from 'node:os'` (D-21) | **CAUGHT TWICE** | `no-restricted-imports` (F11) AND P4 | |
| `import * as nodeOs from 'node:os'; nodeOs.tmpdir()` | **CAUGHT TWICE** | `no-restricted-imports` AND P4 | |
| `import * as sys from 'node:os'; sys.tmpdir()` | **CAUGHT** | `no-restricted-imports` ONLY (P4 misses) | see the ceiling note below |
| `const k = 'platform'; process[k]` (D-21) | **CAUGHT** | P2 | |
| `await import('node:os')` (D-21) | **CAUGHT** | P6 (and P4 if the binding happens to be named `os`) | `no-restricted-imports` CANNOT see this (F10) |
| `const q = await import('node:path'); q.sep` | **CAUGHT** | P6 | |
| `import * as path from 'node:path'; path.sep` | **CAUGHT TWICE** | `no-restricted-imports` AND P5 | |
| `function f(process) { return process.platform }` | CAUGHT (incidentally) | P1 | a shadowed param named `process` is a false positive in principle; nobody writes it |
| `globalThis.process.platform` | **CEILING unless P7 is added** | P7 if included | see below |

### False-positive controls (all MEASURED clean)

`cachePlatform('win32')`; `const cfg = { platform: 'win32' }; cfg.platform`; `process.env.CI`;
`path.join('a','b')`; `import { dirname, basename } from 'node:path'`;
`releaseAssetName(h, 'win32')`; `process.exitCode = 1`; `await import('./local.js')`.
**Zero matches across all eight.** D-18's canonical allowed shape and every adjacent legitimate
pattern in the repo survive the rule set untouched.

### `MemberExpression[computed=false]` vs the computed form: why both, explicitly

esquery's bare `MemberExpression[object.name='process'][property.name='platform']` matches only the
non-computed form in practice, because in the computed form `property` is the key EXPRESSION
(`Identifier k` or `Literal 'platform'`), so `property.name` is `k` (a variable name), not
`platform`. So the naive selector does not accidentally cover the computed shape, and it does not
accidentally over-match either. STACK.md 1.5's parenthetical ("`MemberExpression` matches both `a.b`
and the computed form when `[computed=false]` is omitted -- constrain it") is right to constrain,
for a slightly different reason than stated: **writing `[computed=false]` on P1 is what lets P2 be a
separate, deliberately BROAD ban on all computed access to `process`**, which is the only way to
reach `process[k]` where `k` is a runtime value.

P2 bans `process[anything]`, including `process['env']`. That is the intended blast radius: within a
unit spec, computed indexing of `process` has no legitimate use, and `process.env.CI` (the dotted
form) is measured clean. Say so in the rule `message`.

### The two ceilings, and what closes each

1. **`import * as <anyName> from 'node:os'`.** P4 hardcodes `object.name=/^(os|nodeOs)$/`, so
   `sys.tmpdir()` is invisible to it. **This is NOT a coverage hole**, because F11 proves
   `no-restricted-imports` reports the namespace import ITSELF (messageId `everything`) regardless of
   the binding name. The only way to obtain an `os` namespace object in a spec is an import, and
   every static import form is closed by `no-restricted-imports` (F11/F12) while the dynamic form is
   closed by P6. P4/P5 are defence in depth. Record it as:

   ```js
   // ponytail: P4/P5 hardcode the conventional namespace names (os/nodeOs, path/nodePath).
   // A namespace bound to any other name is invisible HERE -- and is still an error,
   // because no-restricted-imports reports the namespace import itself regardless of the
   // local name (eslint 9.39.5 no-restricted-imports.js:785,441 -- messageId "everything").
   // Upgrade path if that ever stops holding: drop the object.name constraint and add an
   // allowlist of legitimate objects instead. Do NOT drop it without one -- measured, the
   // unconstrained form false-positives on `cachePlatform(process.platform)` and on a plain
   // `cfg.platform`.
   ```

2. **`globalThis.process.platform`.** Not matched by P1 (its `object` is a MemberExpression, so
   `object.name` is undefined). **Recommendation: include P7.** Measured, P7 matches
   `globalThis.process.platform` and does NOT double-report the plain `process.platform` form, so it
   is additive. Its false-positive surface is `<anything>.process.platform` -- e.g. a fixture object
   with a `process` key holding a `platform` -- which does not exist in this repo and would be a
   bizarre thing to write in a unit spec. If the planner declines P7, it MUST be recorded as a named
   `// ponytail:` ceiling with `globalThis.` as the evasion and P7 as the upgrade path, per D-21.

   True remaining ceilings after P7, all recorded rather than closed:
   `const g = globalThis; g.process.platform`; a platform read hidden behind a helper in another
   module (out of reach for any non-type-aware rule, and out of scope per D-11); `eval`.

### The `no-restricted-imports` half

```js
'no-restricted-imports': ['error', {
  paths: [
    { name: 'node:os', importNames: ['tmpdir','EOL','platform','arch','homedir','type','release'], message: BAN_MESSAGE },
    { name: 'os',      importNames: ['tmpdir','EOL','platform','arch','homedir','type','release'], message: BAN_MESSAGE },
    { name: 'node:path', importNames: ['sep','delimiter','win32','posix'], message: BAN_MESSAGE },
    { name: 'path',      importNames: ['sep','delimiter','win32','posix'], message: BAN_MESSAGE },
  ],
}],
```

Four entries, not two: F12 proves the match is an exact string lookup, so `'os'` and `'node:os'` are
independent keys. The repo writes `node:`-prefixed specifiers everywhere today, but the bare forms
cost one line each and close the shape a future contributor will reach for.

### `message` wording (Claude's discretion, D-18-compliant)

One shared constant, referenced by every `paths[].message` and every `no-restricted-syntax`
`message`, so the guidance cannot drift between the two rules:

```js
// Single source for the ban's explanation, shared by no-restricted-imports and
// no-restricted-syntax so the two rules can never give contradictory advice (CORR-06).
const BAN_MESSAGE =
  'CORR-06: a unit spec must not derive an expectation from the RUNNING machine. ' +
  "Pass the platform in instead -- cachePlatform('win32') -- or move the assertion to " +
  'an *.integration.spec.ts, where these APIs are allowed. Opting out needs a described ' +
  'disable that says why the assertion cannot move (LINT-05/LINT-06).';
```

Note the deliberate absence of `releaseAssetName(hash, 'win32')` (D-18): CORR-02 deletes that
parameter in Phase 10 and `fallow` would then flag the example.

---

## G3. What `eslint .` from `packages/github-cache` actually lints, file by file

### Mechanism first (F9), because it produces the phase's biggest surprise

`eslint .` with `stat('.').isDirectory()` pushes the glob `<abs>/**` and then walks the **real
filesystem** with `@humanfs/node`'s `hfs.walk`. An entry survives iff
`matchesPattern && config !== undefined`, and a directory is descended iff
`!configs.isDirectoryIgnored(absolutePath)`.

**ESLint does not consult git.** Nx's `default` input (`{projectRoot}/**/*`) resolves against Nx's
file map, which EXCLUDES gitignored paths. So the lint SCOPE and the lint INPUTS are computed from
two different file universes. That is a fresh instance of exactly the LINT-04 class, and it is not
in STACK.md or PITFALLS.md.

### The 73 tracked files, classified

| Files | Count | Matched by | Linted? | Notes |
|---|---|---|---|---|
| `src/**/*.ts` (non-spec) | 29 | `typescript-eslint/eslint-recommended` `files: ['**/*.ts',...]` | **YES** | js.recommended (minus the 19 TS-disabled) + tseslint.recommended |
| `src/**/*.spec.ts` (non-integration) | 31 | same | **YES** | plus the LINT-02 ban block |
| `src/server/public-server.integration.spec.ts` | 1 | same | **YES** | `ignores` beside `files` removes ONLY the ban block (D-17) |
| `vitest.config.mts`, `vitest.integration.config.mts` | 2 | `**/*.mts` | **YES** | see the D-13 correction below |
| `pack-check.cjs` | 1 | default config `**/*.cjs` (F7) | **YES** | the only genuinely non-TS file; see the ordering trap below |
| `action.yml` | 1 | nothing | no | ESLint 9 has no YAML language by default |
| `src/conformance/nx-cache-openapi.v23.1.0.json` | 1 | nothing | no | no JSON language plugin is being added (D-02) |
| `package.json`, `project.json`, `tsconfig*.json` | 5 | nothing | no | same |
| `README.md`, `LICENSE` | 2 | nothing | no | no markdown plugin (D-02) |

So of 73 tracked files, **64 are linted** and 9 are inert. There is no `.js`, `.mjs`, `.jsx`,
`.tsx`, `.cts`, `.html` or `.vue` file anywhere in the project (F23), so `@nx/eslint`'s
`DEFAULT_EXTENSIONS` list is wider than the tree and nothing else can appear by surprise.

### UNTRACKED, ON DISK, AND LINTED WITHOUT AN `ignores` BLOCK -- the blocking finding

| Path | On disk today | Matched by | Would be linted |
|---|---|---|---|
| `packages/github-cache/dist/**/*.js` | 30 files | default config `**/*.js` | **YES** |
| `packages/github-cache/dist/**/*.d.ts` | 30 files | `**/*.ts` | **YES** |
| `packages/github-cache/out-tsc/**/*.d.ts` | 35 files | `**/*.ts` | **YES** |
| `packages/github-cache/out-tsc/**/*.mts` | 1 file | `**/*.mts` | **YES** |
| `packages/github-cache/dist/**/*.map`, `*.tsbuildinfo` | 31 files | nothing | no |
| `packages/github-cache/test-output/**` | absent today, created by `test --coverage` | HTML/JSON, nothing matches | no |
| `packages/github-cache/node_modules/**` | empty today | globally ignored (F7) | no |

**96 generated files would be linted.** Consequences, all bad:

1. **`lint` is not deterministic.** `dist/` and `out-tsc/` exist only after `build` / `typecheck`.
   `lint` has no `dependsOn`, so on a cold CI runner it lints 64 files and on a warm workstation it
   lints 160. Same commit, same hash inputs (Nx's file map ignores gitignored paths), different
   result. That is a stale-cache false PASS with an extra twist: the cache entry can be *created* by
   the run that saw fewer files.
2. **It would be red.** A compiled `dist/**/*.js` is an ES module full of `process`, `Buffer`,
   `console` and `URL` references with `no-undef` ON (F14 only disables `no-undef` for
   `**/*.{ts,tsx,mts,cts}`, not for `.js`), so the baseline finding count would be dominated by
   generated noise, and D-12's measurement would measure the wrong thing.
3. **It is slow and it inflates the D-12 baseline** the bounded-cleanup rule is supposed to act on.

**Required in `eslint.config.mjs`, as a standalone `ignores`-only config object** (global ignores,
distinct from the D-17 per-object `ignores`), with workspace-root-relative globs per G1(b):

```js
{
  // GLOBAL ignores. Standalone `ignores` with no other key = removed from linting
  // entirely -- deliberately NOT the D-17 shape, which only narrows one config object.
  // Required because `eslint .` walks the FILESYSTEM, not git: dist/ and out-tsc/ are
  // gitignored (so Nx never hashes them) but they are on disk and would be linted,
  // which makes `lint`'s result depend on whether `build`/`typecheck` ran first.
  // Globs are WORKSPACE-ROOT-relative (basePath = dirname(eslint.config.mjs)).
  ignores: ['**/dist/', '**/out-tsc/', '**/test-output/', '**/.nx/', '**/coverage/'],
}
```

`**/node_modules/` and `.git/` are already covered by the default config (F7) and do not need
restating. `**/.nx/` and `**/coverage/` are cheap insurance against a future run from a wider cwd.

**Drift-guard opportunity (fits the CONVENTIONS.md single-source pattern):** the ignore list and
`.gitignore`'s `dist` / `out-tsc` / `coverage` entries are two copies of one fact. A one-assertion
spec that every ESLint global-ignore stem appears in `.gitignore` (not the reverse -- `.gitignore`
is legitimately wider) keeps them from diverging. Optional; flag it to the planner as a candidate,
not a requirement.

### Per-file language-options and rule-scoping needs

**`pack-check.cjs` -- and a config-ORDERING trap that D-13 does not name.**

F13 is the load-bearing fact: `typescript-eslint/base` has **no `files` key**, so it applies to every
linted file and sets `languageOptions.sourceType: 'module'` and the TS parser universally. It comes
AFTER the default config in the array, so it **overrides the default config's
`{ files: ['**/*.cjs'], languageOptions: { sourceType: 'commonjs' } }`**. `typescript-eslint/recommended`
(element 3) likewise has no `files` key, so `@typescript-eslint/no-require-imports: 'error'` applies
to `.cjs` too.

Measured against the real file: `pack-check.cjs` references `require` x2, `__dirname` x1, and
`process` x4. Under `sourceType: 'module'` with no globals declared and `no-undef` ON (it is only
disabled for `**/*.{ts,tsx,mts,cts}`, F14), that is **7 `no-undef` errors + 2
`@typescript-eslint/no-require-imports` errors = 9 findings from one 172-line file.**

The override block therefore MUST come after the `tseslint.configs.recommended` spread, or it is
itself overridden:

```js
// AFTER ...tseslint.configs.recommended -- config objects apply in document order and
// typescript-eslint/base carries NO `files` key, so it sets sourceType:'module' for
// EVERY file, including this one. Ordering is the whole fix.
{
  files: ['**/*.cjs'],
  languageOptions: {
    sourceType: 'commonjs',
    // Declared inline rather than importing the `globals` package: `globals` is not
    // one of the five approved devDependencies (D-02), is not in the LINT-04
    // externalDependencies list, and would need a fallow entry. Four names beat a
    // sixth dependency. Keeping no-undef LIVE (rather than switching it off) is what
    // makes a typo in this guard script still fail.
    globals: { require: 'readonly', module: 'writable', __dirname: 'readonly', process: 'readonly' },
  },
  rules: {
    // pack-check.cjs is a deliberately dependency-free CommonJS guard script that CI
    // runs straight after `npm ci`. Rewriting it to ESM to satisfy a TS-oriented rule
    // would be the tail wagging the dog (D-13).
    '@typescript-eslint/no-require-imports': 'off',
  },
}
```

The lazier one-liner is `'no-undef': 'off'` for `**/*.cjs` instead of the globals map. It is one
line shorter and loses the typo check on the only file in the repo where `no-undef` is live. Prefer
the globals map; record the alternative.

**`vitest.config.mts` / `vitest.integration.config.mts` -- D-13 IS WRONG about these.** They are
NOT in the same treatment class as `pack-check.cjs`:

- `.mts` IS in `typescript-eslint/eslint-recommended`'s `files` (F13), so **`no-undef` is already
  OFF** for them and the `__dirname` reference produces nothing.
- Both use ESM `import`, so `@typescript-eslint/no-require-imports` cannot fire.
- Measured: `vitest.config.mts` and `vitest.integration.config.mts` contain no `require`, and their
  only non-ESM global is `__dirname`.

**They need NO special treatment.** Adding a `.mts` override block would be dead configuration and a
future reader would waste time on it. Correction filed below.

**`src/**/*.ts`** -- covered entirely by `tseslint.configs.recommended`. No `parserOptions.project`,
no `projectService` (D-11). Nothing else needed.

---

## G4. Expected baseline finding count for the two recommended sets

D-12 makes this a measurement. ESLint cannot be installed here, so this is an ANALYTIC baseline:
each rule in the two recommended sets that could plausibly fire on this tree was grepped, with
counts. Treat the totals as a PREDICTION the executor checks against, not as the measurement itself
-- **the plan must still run the real count and record it**, and a large divergence from this table
is itself a finding (it would mean a rule fires for a reason this analysis missed).

**Rule universe.** `@eslint/js` recommended = 61 rules (F15). `typescript-eslint/eslint-recommended`
turns 19 of them OFF for `**/*.{ts,tsx,mts,cts}` and turns ON 4 more (F14).
`typescript-eslint/recommended` adds 24 (F13). The `.ts`/`.mts` surface therefore sees roughly
61 - 19 + 4 + 24 = 70 rules; `pack-check.cjs` sees 61 + 24 = 85 (nothing is disabled for `.cjs`).

### Predicted findings, with evidence

| Rule | Scope | Predicted | Evidence |
|---|---|---|---|
| `@typescript-eslint/no-unused-vars` | all | **1** | `src/serve.spec.ts:89` `put: async (hash, _bytes) => {` -- `_bytes` is the LAST param and unused, so `args: 'after-used'` reports it. The other five `_`-prefixed params (`resilient-octokit.ts:44,52`, `publish-mirror.spec.ts:333`, `serve.spec.ts:51,271`) are all followed by a USED param and are NOT reported. Unused LOCALS and unused IMPORTS are structurally impossible: `noUnusedLocals: true` (F22). All 6 `catch (error)` bindings are used, so `caughtErrors: 'all'` finds nothing. |
| `no-undef` | `**/*.cjs` only | **7** | `pack-check.cjs`: `require` x2, `__dirname` x1, `process` x4. Live only because `typescript-eslint/eslint-recommended` scopes its `no-undef: off` to ts/tsx/mts/cts (F14) and `typescript-eslint/base` overrides the default `.cjs` `sourceType` (F13). |
| `@typescript-eslint/no-require-imports` | `**/*.cjs` only | **2** | `pack-check.cjs:32,33`. Named in D-13. |
| `@typescript-eslint/no-explicit-any` | all | **0** | `git grep ": any\|<any>\|as any\|any[]"` over `packages/github-cache/**/*.ts` -> 0 hits |
| `@typescript-eslint/no-namespace` | all | **0** | no `namespace`/`module` declaration in the tree |
| `no-redeclare` | -- | **0** (rule OFF for TS) | F14 |
| `@typescript-eslint/no-empty-object-type` | all | **0** | the 4 `{}` grep hits are object-literal VALUES (`{} as never`, `{} as {...}`), not empty TYPE literals |
| `no-empty` | all | **0** | zero statement-position `{ }` blocks (`if/for/while/try/else/do`) |
| `prefer-const` | ts/mts | **0** | all 33 `let` declarations are counters, accumulators or deferred-resolver slots that ARE reassigned |
| `no-var` | ts/mts | **0** | the single `var` grep hit is inside a prose comment |
| `@typescript-eslint/no-unused-expressions` | all | **0** | no standalone optional-chain or bare-expression statements |
| `no-case-declarations`, `no-fallthrough` | all | **0** | no `switch` with declarations; `noFallthroughCasesInSwitch: true` already gates the second |
| `no-prototype-builtins` | all | **0** | no `hasOwnProperty` call |
| `no-constant-condition`, `no-constant-binary-expression` | all | **0** | no `while (true)`, no `\|\| true` / `&& false` |
| `@typescript-eslint/no-non-null-asserted-optional-chain` | all | **0** | no `?.x!` form |
| `triple-slash-reference`, `prefer-rest-params`, `prefer-spread`, `no-unsafe-function-type`, `no-wrapper-object-types`, `no-this-alias`, `prefer-as-const`, `no-array-constructor`, `no-duplicate-enum-values`, `no-misused-new`, `no-unsafe-declaration-merging`, `no-extra-non-null-assertion`, `no-unnecessary-type-constraint`, `prefer-namespace-keyword` | all | **0** | no `/// <reference`, no `arguments`, no `.apply(`, the 4 `Function` hits are all in comments, no enums, no classes with these shapes |
| `@typescript-eslint/ban-ts-comment` | all | **0** | F21: zero `@ts-expect-error` / `@ts-ignore` in the project |
| `@eslint-community/eslint-comments/require-description` | all | **0** | F21: zero existing `eslint-disable` comments |
| `no-useless-escape`, `no-control-regex`, `no-irregular-whitespace`, `no-misleading-character-class` | all | **0-2, LOW confidence** | ~25 files contain a regex or a `.test(`/`.replace(/`; escaping in this repo is conventional but this class is the least greppable. Budget for a small number. |
| LINT-02's own two rules | unit specs | **4** | the four sites in G2, which is the point |
| **Predicted total, excluding LINT-02's four** | | **10, plus 0-2 uncertain** | |

### The D-12 call this predicts

**Nine of the ten predicted findings come from one file, `pack-check.cjs`, and the fix is
configuration, not code** -- the `.cjs` override block in G3, which D-13 already mandates. That is
not a "disable"; it is telling ESLint the truth about a CommonJS file.

**The tenth (`_bytes`) has a one-line, convention-matching fix that is NOT a disable either:**

```js
// The repo already marks an intentionally-unused binding with a leading underscore
// (6 sites today). Codify the existing convention instead of editing the code or
// disabling the rule -- a disable would need a description under LINT-05 and would
// then be one more thing to keep true.
'@typescript-eslint/no-unused-vars': ['error', {
  argsIgnorePattern: '^_',
  varsIgnorePattern: '^_',
  caughtErrorsIgnorePattern: '^_',
}],
```

**So the predicted bounded-cleanup outcome is: ZERO rules turned off, ZERO code edits, two
configuration blocks.** That is a strong result for D-12 and worth stating in the plan up front so
the executor is not braced for a sweep. If the real count comes in materially higher, the most
likely cause is that the G3 `ignores` block is missing and 96 generated files are being linted --
check that FIRST before reaching for a rule disable.

**Recording obligation.** D-12 requires the number be recorded. The measurement command, run once
before any fix:

```bash
cd packages/github-cache && npx eslint . --format json > /dev/null; \
npx eslint . --format json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const r=JSON.parse(s);const by={};let n=0;for(const f of r)for(const m of f.messages){by[m.ruleId??'(parse)']=(by[m.ruleId??'(parse)']||0)+1;n++;}console.log('files linted:',r.length);console.log('total findings:',n);console.log(JSON.stringify(by,null,1));})"
```

`files linted` is also the G3 determinism check: it must be **64** on this tree (see G5's negative
control).

---

## G5. LINT-04's differential proof, as an exact command sequence

**Prerequisite:** D-32's root script `"lint": "nx run-many -t lint"` must exist first, because the
`Cache: n/m hit (p%)` summary line is emitted by `run-many`, not by a single `nx run`. The line's
exact wording is MEASURED on this repo in `quick/260726-gok-.../260726-gok-SUMMARY.md`
(`Cache: 0/1 hit (0%)`, `Cache: 1/1 hit (100%)`, `Cache: 2/2 hit (100%)`).

All commands are Git Bash from the repo root. Record BOTH sides of every pair.

### Measurement A -- editing a rule in `eslint.config.mjs` re-runs `lint` (D-27, clause 1)

```bash
# A0  warm the cache (run twice; the second is the baseline replay)
npm run lint            # first run: executes.  EXPECT  Cache: 0/1 hit (0%)
npm run lint            # baseline replay.      EXPECT  Cache: 1/1 hit (100%)

# A1  perturb ONE rule. Use a real severity toggle, not a comment: a comment-only
#     edit still changes the file hash, so it proves the file is an input but NOT
#     that the rule set is what the command reads. Toggle P7 off, say.
#     (Edit eslint.config.mjs by hand or with the Edit tool -- no heredocs.)

npm run lint            # THE PROOF.            EXPECT  Cache: 0/1 hit (0%)

# A2  restore and confirm the pre-edit hash is still in the cache
git checkout -- eslint.config.mjs
npm run lint            #                       EXPECT  Cache: 1/1 hit (100%)
```

A `Cache: 1/1 hit (100%)` at A1 is the LINT-04 defect, unambiguously.

### Measurement B -- editing a linted source file re-runs `lint` (D-27, clause 2)

```bash
npm run lint                                            # EXPECT Cache: 1/1 hit (100%)
# append one line to a linted, tracked source file (NOT a spec, so the ban rules
# stay out of it): e.g. add a trailing comment to packages/github-cache/src/index.ts
npm run lint                                            # EXPECT Cache: 0/1 hit (0%)
git checkout -- packages/github-cache/src/index.ts
npm run lint                                            # EXPECT Cache: 1/1 hit (100%)
```

### Negative control 1 -- the mutation that proves the input list is load-bearing

Measurements A and B both pass on a `lint` target with NO `targetDefaults.lint` block at all,
because `@nx/eslint`'s INFERRED inputs already contain `default` and
`{workspaceRoot}/eslint.config.mjs` (F17). **A and B therefore do not prove D-24 did anything.**
The control that does:

```bash
# C1  TEMPORARILY delete the "{workspaceRoot}/eslint.config.mjs" entry from
#     nx.json targetDefaults.lint.inputs (leaving the rest of the block in place --
#     targetDefaults REPLACES the inferred list, so removing that one entry genuinely
#     removes it rather than falling back to the inferred one).
npm run lint            # re-warm after the nx.json edit.  EXPECT Cache: 0/1 hit (0%)
npm run lint            #                                  EXPECT Cache: 1/1 hit (100%)
# C2  now toggle the same rule as in A1
npm run lint            # THE BUG, REPRODUCED.             EXPECT Cache: 1/1 hit (100%)
# C3  restore both files
git checkout -- nx.json eslint.config.mjs
```

C2 showing a HIT is the proof that the entry is doing work; C2 showing a MISS means something ELSE
is invalidating the hash (most likely `{projectRoot}/**/*` catching a stray edit) and the
measurement is confounded -- stop and find it. This mirrors gok's discipline exactly: it proved its
one-token fix by running the FAILING case on both sides of the change.

### Negative control 2 -- `lint`'s scope must not depend on gitignored build output (G3)

This one has no analogue in gok and closes the new hole G3 found. It is the check that the global
`ignores` block is correct:

```bash
cd packages/github-cache
npx eslint . --format json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log('linted:',JSON.parse(s).length))"
#                                                   EXPECT  linted: 64
rm -rf dist out-tsc
npx eslint . --format json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log('linted:',JSON.parse(s).length))"
#                                                   EXPECT  linted: 64   <- IDENTICAL
cd .. && cd .. && npm run build && npm run typecheck   # restore the build output
```

**Two different numbers means `lint`'s result depends on whether `build` ran, while its Nx hash does
not. That is a stale-cache false PASS by construction and the `ignores` block is wrong.**

### Measurement C -- the second-order hole D-25 names

The `test` target runs the D-20 guard spec, which imports `eslint` and reads `eslint.config.mjs`.
Prove `test` re-runs too, or LINT-03 itself will read a stale PASS:

```bash
npm run test            # warm.                            EXPECT Cache: 1/1 hit (100%)
# toggle the same rule in eslint.config.mjs
npm run test            # THE PROOF for D-25.              EXPECT Cache: 0/1 hit (0%)
git checkout -- eslint.config.mjs
```

If this shows a HIT, `test.inputs` is missing `{workspaceRoot}/eslint.config.mjs` and the RED proof
is untrustworthy from that moment on. Run this BEFORE trusting any LINT-03 result.

### What to record

For each of A, B, C and both negative controls: the command, the `Cache: n/m hit (p%)` line on each
side, and the git SHA. Same evidence discipline as gok. Note that `Cache: n/m hit` is
non-discriminating in isolation (PITFALLS D1) -- it is the BEFORE/AFTER PAIR that carries the proof,
never a single reading.

---

## G6. `fallow` interaction: will `npm run fallow:ci` stay green?

The gate is `fallow dead-code --fail-on-issues` (`fallow@3.6.0`, verified installed). Its finding
classes include `--unused-files`, `--unused-deps` and `--unlisted-deps`, all of which this phase can
trip.

### Per-artifact verdict

| Artifact | Credited by | Verdict | Action |
|---|---|---|---|
| `eslint.config.mjs` (the FILE) | fallow's built-in config-filename table -- the binary contains the literal `eslint.config.mjs` alongside `vitest.config.*`, `jest.config.*`, `vite.config.*` (F20) | **LIKELY auto-credited. MEDIUM confidence.** | verify in-phase; contingency is one `entry` line |
| `@eslint/js` | imported by `eslint.config.mjs` | credited IF the config file is analysed | -- |
| `typescript-eslint` | imported by `eslint.config.mjs` | same | -- |
| `@eslint-community/eslint-plugin-eslint-comments` | imported by `eslint.config.mjs` (the `./configs` subpath, D-29) | same, PLUS a subpath-specifier risk (see below) | -- |
| `eslint` | **imported by nothing in `eslint.config.mjs`**; imported by the D-20 RED-proof spec (`import { ESLint } from 'eslint'`) | **credited by the SPEC, not by the config** | none, provided the spec is in the same commit |
| `@nx/eslint` | referenced ONLY from `nx.json` `plugins[]`, which fallow does not read | **WILL be flagged unused. HIGH confidence.** | **required** `ignoreDependencies` entry |

### Required `.fallowrc.jsonc` change (the one that is certain)

`@nx/vitest` already sits in `ignoreDependencies` with the comment "Nx plugin that INFERS the `test`
target via nx.json". `@nx/eslint` is the identical case and gets the identical treatment, in the
house style (trailing-comma JSONC, one comment per entry):

```jsonc
"ignoreDependencies": [
  "@nx/eslint", // Nx plugin that INFERS the `lint` target via nx.json (D-01)
  "@nx/vitest", // Nx plugin that INFERS the `test` target via nx.json
  ...
]
```

### The contingency, and how to decide it in one command

Run `npm run fallow:ci` as an explicit `verify` line on the commit that adds `eslint.config.mjs`.
Three possible findings and their one-line fixes:

| If fallow reports | Add to `.fallowrc.jsonc` |
|---|---|
| `eslint.config.mjs` is an unused file | an `entry` line, with a comment in the file's existing voice: `// Root ESLint flat config: consumed by the inferred `lint` target's `eslint .` command and by the LINT-03 guard spec's ESLint Node-API instance; never imported by product code.` |
| `@eslint/js` / `typescript-eslint` / the comments plugin are unused deps | nothing -- fixing the entry above fixes these, because they are real imports of that file |
| the `/configs` subpath is an unresolved or unlisted import | `ignoreDependencies` for `@eslint-community/eslint-plugin-eslint-comments`, with the reason recorded as "consumed via its `./configs` subpath export, which reachability analysis resolves to a different specifier than the package name" |

Do NOT pre-emptively add all of these. F20 is strong evidence the config file is recognised, and a
speculative `ignoreDependencies` entry suppresses a real future finding -- the exact failure the
existing `.fallowrc.jsonc` comments are careful about ("Both are defensive/documentary").
**Add `@nx/eslint` now; add the rest only against a measured finding.**

### Two adjacent facts

- **No `.prettierignore` entry is needed.** `eslint.config.mjs` is normal source and should be
  Prettier-formatted like everything else. `.prettierrc` sets `singleQuote: true`, so the config
  must be written with single quotes or `npm run format:check` (battery command 1) fails.
- **`fallow`'s GSD structural pre-pass remains a no-op** (ROADMAP records this). Phase 7's `lint`
  target does not replace it and does not interact with it. The gate that matters is the
  `fallow:ci` script, invoked directly.

---

## G7. Task and plan sequencing, and every forced same-commit coupling

### The two facts that drive the whole ordering

1. **F16: `@nx/eslint` returns NO targets when no `eslint.config.*` exists anywhere.** The plugin
   registration alone does not create a `lint` target. So the config file is a hard precondition of
   the target, not a companion to it.
2. **`nx.json` `plugins[]` cannot reference an uninstalled plugin** -- Nx throws while building the
   project graph, which fails every one of the eight battery commands at once. So the install is a
   hard precondition of the registration.

Combined: **install -> config -> registration.** Never any other order.

### FORCED same-commit couplings, each with the mechanism that forces it

| # | These must land in ONE commit | Forced by |
|---|---|---|
| SC1 | `nx.json` `targetDefaults.test.inputs` (the ESLint entries) + the D-20/D-22 guard spec | **D-25.** Without the input, editing a rule replays a cached `test` PASS. Since LINT-03 IS the activity that edits rules, the false PASS surfaces during LINT-03 and reads as "the rule does not fire". Shipped twice before in this repo (`governance-email.spec.ts` T-06-03-02; `typecheck` in quick 260726-gok). |
| SC2 | `eslint.config.mjs` (the rule set) + the FOUR described disables at lines 1 / 38 / 39 / 60 | **D-31**, and independently: any commit where the rules are enforced and the disables are absent is RED, which the repo's bisect-safety standard forbids. See the ordering note below on whether "enforced" starts at the config or at the target. |
| SC3 | The D-22 site-table spec + the four disables | The spec asserts each site currently carries a described disable AND that stripping it produces an error. It cannot pass before the disables exist, and the disables have no reviewable justification without it. |
| SC4 | `nx.json` `plugins[]` + `nx.json` `targetDefaults.lint` | Registering the plugin without the input block leaves the inferred `{externalDependencies: ['eslint']}` hole live for one commit, i.e. one commit ships the exact defect LINT-04 exists to close. Also both are one file. |
| SC5 | `nx.json` `targetDefaults.lint` + the `nx-target-inputs.spec.ts` `lint` probes | The spec indexes `nxJson.targetDefaults['lint'].inputs`; it throws on `undefined` before the block exists. Same coupling gok used for `test`. |
| SC6 | The root `"lint"` script + the `ci.yml` `lint` job + the target | A `ci.yml` job invoking a script that does not exist is a red CI leg; a script invoking a target that does not exist is a red battery command. |
| SC7 | The five devDependency additions + `package-lock.json` + the five `pinned-deps.spec.ts` `it()` blocks | **D-04.** The spec reads the root manifest; the `it()` blocks fail until the specifiers exist. And an install without the guard leaves the pins unguarded, which is D-04's whole point. |
| SC8 | The install + `.fallowrc.jsonc`'s `@nx/eslint` entry | `fallow:ci` is battery command 6. Five new devDependencies that nothing imports is an unused-dependency finding, i.e. a red commit. |
| SC9 | **`npm run build:action` output, IF and ONLY IF a `serve()`-reachable source changes** | Project memory / ROBUST-04. **Verified NOT triggered by this phase's planned edits** -- see below. |

### SC9, verified rather than assumed

`start-cache-server/entry.ts:19` imports `serve` from `packages/github-cache/src/serve.js`, and
`esbuild.action.mjs` bundles that entry with `bundle: true`, so every module transitively reachable
from `serve()` is inlined into the committed `start-cache-server/index.js`.

Phase 7's planned edits touch: `package.json` (root), `package-lock.json`, `eslint.config.mjs`
(new), `nx.json`, `.fallowrc.jsonc`, `.github/workflows/ci.yml`, `pinned-deps.spec.ts`,
`nx-target-inputs.spec.ts`, two new spec files, and three existing SPEC files (the disables).
**No product source under `packages/github-cache/src/**` that is not a `*.spec.ts` is touched, so
nothing `serve()`-reachable changes and `check:action` is unaffected.** D-06 (the package manifest
is untouched) reinforces this.

**One residual, and it is real.** D-05 mandates regenerating `package-lock.json` in a linux/arm64
`node:24` container. A lockfile regeneration can re-resolve a TRANSITIVE runtime dependency of
`@actions/cache` / `@actions/core` (both are exact-pinned, but their own dependencies carry ranges),
and any such bump changes the bytes esbuild inlines. **Contingency, not a prediction:** run
`npm run check:action` immediately after `npm ci` on the regenerated lockfile. If it drifts, run
`npm run build:action` and stage `start-cache-server/index.js` **in the same commit as the lockfile**
-- never as a follow-up, or the `action-bundle-drift` CI job fails that commit and every later one
until it is fixed.

### Recommended commit shape (three commits, battery green at each)

| Commit | Contents | Battery | Why this boundary |
|---|---|---|---|
| **1. Adopt the toolchain** | five devDeps exact-pinned + regenerated lockfile (SC7) + `pinned-deps.spec.ts` blocks (SC7) + `.fallowrc.jsonc` `@nx/eslint` (SC8) + `eslint.config.mjs` (full rule set) + the four described disables (SC2, SC3) + the D-20/D-22 RED-proof spec + the D-19 drift spec + `nx.json` `targetDefaults.test.inputs` (SC1) | 8 commands, green | ESLint runs here only via the Node API inside `test`. There is still NO `lint` target, so the four real sites are not enforced by any gate and the commit cannot be red for that reason. |
| **2. Wire the target** | `nx.json` `plugins[]` + `targetDefaults.lint` (SC4) + `nx-target-inputs.spec.ts` `lint` probes (SC5) + root `"lint"` script + `ci.yml` `lint` job (SC6) | **9** commands, green | This is the commit that rotates EVERY task hash (D-36). Isolating it makes the rotation attributable, which Phase 8 needs. |
| **3. Record the evidence** | the D-35 hashed-node baseline, the D-27 differential measurements, the D-12 baseline count, the D-36 all-MISS pre-record | 9, green | Docs only; no code. Splitting it keeps commit 2's diff readable. |

**Why the disables sit in commit 1 and not commit 2.** D-31 says "the same commit as the rules", and
the rules are in commit 1. It is also the only placement that lets SC3's guard spec ship in commit 1.
The cost is that a reviewer sees four disable comments one commit before anything enforces them; the
commit message must say so. The alternative (disables in commit 2, with the target) satisfies the
never-red constraint equally well but breaks SC3 and reads as a weaker fit to D-31. Either is
defensible; commit 1 is recommended.

**TDD ordering INSIDE commit 1** (`workflow.tdd_mode: true`, and gok's precedent of observing RED
inside a single commit): write the D-20/D-22 spec and run `npm run test` BEFORE adding the two ban
rules to `eslint.config.mjs`. Expect a partial RED -- the "error at the unit-spec path" assertions
fail while the "no error at the integration path" assertions pass on both sides by design (they are
the direction controls, exactly like gok's negative control). **Record which assertions failed and
which passed**, because a RED where the direction controls ALSO fail means the config is not being
loaded at all (the G1(c) `unconfigured` trap), not that the rules are missing.

### The two ordering constraints that reach outside this phase

- **LINT-01 before PARITY-01** (ROADMAP): satisfied by Phase 7 preceding Phase 8. Commit 2 is the
  hash-rotating event; Phase 8's measurements must be taken after it.
- **LINT-02/03 before CORR-05 removal** (Phases 9 and 10): satisfied by the D-22 site table plus the
  disables. The removal schedule is comment-locked in the table so a Phase 9/10 executor deletes the
  ROW with the SITE. LINT-06 then fails the build if they delete one without the other, which is the
  mechanism doing its job.

---

## Validation Architecture

`workflow.nyquist_validation: true` and `workflow.tdd_mode: true` in `.planning/config.json`
(verified this session). This section is the input the VALIDATION.md gate reads.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest `~4.1.0` (`@nx/vitest@23.1.0` infers the `test` target) |
| Config file | `packages/github-cache/vitest.config.mts` (unit), `vitest.integration.config.mts` (integration) |
| Quick run command | `npx vitest run <file>` from `packages/github-cache`, or `npm run test` from the root (`nx run-many -t test`, ~5s warm) |
| Full suite command | `npm run test` from the root; full gate is the NINE-command battery (F19 + `npm run lint`) |
| Baseline today | 32 spec files, 438 tests (gok, 2026-07-26) |

### Phase requirements to test map

| Req | Behavior that must be proven | Test type | Automated command | File |
|---|---|---|---|---|
| LINT-01 | the five devDeps are exact-pinned and NAME-guarded | unit | `npx vitest run src/pinned-deps.spec.ts` | EXTEND `src/pinned-deps.spec.ts` (D-04) |
| LINT-01 | a `lint` target exists, is cacheable, and is in the battery | integration-by-command | `npm run lint` (must exit 0 and print `Successfully ran target lint`) | no spec; the battery command IS the assertion (D-34: do not assert on `nx show project` text) |
| LINT-02 | a unit spec reading ambient platform state FAILS; the same code at an integration path PASSES | unit | `npx vitest run src/<red-proof>.spec.ts` | **NEW** (D-20) |
| LINT-02 | the ESLint globs and the vitest partition agree (superset, not equality) | unit | same file or a sibling (D-19 discretion) | **NEW** (D-19) |
| LINT-03 | every D-21 evasion shape has an explicit asserted verdict | unit | same file | **NEW** (D-20/D-21) |
| LINT-03 | each of the FOUR extant CORR-05 sites is CAUGHT while it exists | unit | same file | **NEW** (D-22) |
| LINT-04 | `lint` cannot serve a stale-cache false PASS | (a) unit for the declared inputs, (b) **manual differential** for the behaviour | (a) `npx vitest run src/nx-target-inputs.spec.ts`; (b) the G5 command sequence | (a) EXTEND `src/nx-target-inputs.spec.ts` (D-26); (b) manual, recorded in the phase evidence -- D-27/SC4 say "by differential, not by reading the config", so the spec alone does NOT close it |
| LINT-04 | `test` re-runs when a rule changes (D-25) | unit + manual | `nx-target-inputs.spec.ts` assertion + G5 Measurement C | EXTEND `src/nx-target-inputs.spec.ts` |
| LINT-05 | a bare disable and a bare `@ts-expect-error` are both errors | unit | the RED-proof spec, via `lintText` on a two-line fixture | **NEW**, folded into the D-20 spec |
| LINT-06 | a stale disable FAILS | unit | the RED-proof spec: lint a fixture that carries a described disable over a NON-violating line, assert a `reportUnusedDisableDirectives` error | **NEW**, folded into the D-20 spec |
| CORR-06 | the ban is mechanical, and integration keeps every OTHER rule | unit | the D-20 spec's direction pair, plus one assertion that a DIFFERENT rule still fires at the integration path (proves D-17's `ignores`-beside-`files` semantics, not a global un-lint) | **NEW** |

### Sampling rate

- **Per task commit:** `npm run test` (the whole unit suite; it is seconds) plus, from commit 2 on,
  `npm run lint`.
- **Per commit, before committing:** the full battery. EIGHT commands today (F19), **NINE** from
  commit 2: `format:check`, `build`, `typecheck`, `typecheck:action`, `test`, `lint`, `fallow:ci`,
  `check:action`, `pack:check`. gok's standard was "8/8 green before EVERY commit, not just the
  last"; this phase inherits it at 9.
- **Phase gate:** full battery green, plus the G5 differential measurements recorded, before
  `/gsd:verify-work`.

### Non-vacuous assertions -- what makes each one able to fail

This is the section the Nyquist gate exists for, and this phase has three distinct vacuity traps.

| Assertion | Its vacuity trap | The control that closes it |
|---|---|---|
| "the rule errors at a unit-spec path" | ESLint returns `[]` for an `ignored` or `unconfigured` path (F5), which looks identical to "no violation" | assert `result.messages` contains NO `severity:1, ruleId:null` ignore-warning (G1(c)); `warnIgnored: true` explicitly |
| "the rule does NOT error at an integration path" | passes trivially if the config never loaded, if the path is misspelled, or if the ban rules were never added | pair it with an assertion that a DIFFERENT rule (e.g. `@typescript-eslint/no-explicit-any` on `const x: any = 1;`) DOES fire at that same integration path -- proves the file is linted, only the ban is exempt (D-17) |
| `nx-target-inputs.spec.ts` `lint` probes | `filterUsingGlobPatterns` returns the WHOLE input list when the pattern list is empty, so every `toContain()` passes together on a resolver that resolved nothing (recorded in the spec's own comment) | reuse the existing NEGATIVE control shape: assert `lint` does NOT hash something it genuinely must not. `build` is the existing discriminator; for `lint` the honest negative is a probe path that `default` excludes. If no clean negative exists for `lint`, say so in the comment rather than shipping a positive-only set |
| "the four CORR-05 sites are caught" | rots the instant the disables shift the line numbers (which happens in the SAME commit) | key the site table on FILE + EXPRESSION TEXT, locate the position by searching the file content, and blank-out (do not delete) the stripped disable line so numbering is preserved |
| "the disables are described" | a disable with a `--` and an empty reason still parses | assert the reason text is non-empty AND contains the word `integration` (LINT-06 requires it to state why the assertion cannot move there) |

### Mutation testing (D-23, the repo standard since gok)

A guard that cannot fail is worthless. Before declaring the phase done, run each mutation, confirm
the EXACT expected failure set, and restore. Record the observed failure counts.

| # | Mutation | Expected result |
|---|---|---|
| M1 | delete the P1 selector from `no-restricted-syntax` | the three `process.platform` site assertions and the `process.platform` evasion assertion go RED; the import-shape assertions stay GREEN |
| M2 | delete the `node:os` entry from `no-restricted-imports` `paths` | the site-1 assertion and the named-import / namespace-import evasion assertions go RED; the `process.*` assertions stay GREEN |
| M3 | delete the P6 `ImportExpression` selector | ONLY the `await import('node:os')` / `await import('node:path')` assertions go RED. If nothing goes red, P6 is untested and D-21's dynamic-import shape is a silent gap |
| M4 | change `ignores` to `['**/*.integration.spec.ts']` (drop `mts,cts`) | the D-19 drift guard goes RED. If it stays green it is asserting set EQUALITY of the wrong pair, or restating the globs instead of reading them (D-19) |
| M5 | remove `{workspaceRoot}/eslint.config.mjs` from `targetDefaults.test.inputs` | the `nx-target-inputs.spec.ts` assertion goes RED. This is the D-25 guard's own mutation test |
| M6 | remove `{workspaceRoot}/eslint.config.mjs` from `targetDefaults.lint.inputs` | the `lint` probe assertion goes RED, AND G5's negative control 1 reproduces the stale-cache HIT |
| M7 | remove the global `ignores` block from `eslint.config.mjs` | G5's negative control 2 reports two different `linted:` counts across `rm -rf dist out-tsc`. This is the only control for the G3 finding |
| M8 | replace one described disable with a bare `// eslint-disable-next-line no-restricted-syntax` | `require-description` errors. Proves LINT-05 is live, not just configured |
| M9 | move a described disable one line off its violation | `reportUnusedDisableDirectives` errors AND the underlying rule errors. Proves LINT-06 is live |

**Each mutation must be applied, observed, and REVERTED before the commit.** Mutation runs are
never committed. gok's precedent (`nx-target-inputs.spec.ts`) is why that guard is trusted; the same
standard applies here or the LINT-03 evidence is worth nothing.

### Wave 0 gaps

- [ ] the D-20/D-22 RED-proof spec (NEW file) -- covers LINT-02, LINT-03, LINT-05, LINT-06, CORR-06
- [ ] the D-19 drift-guard assertions (NEW file or folded into the above, D-19 discretion)
- [ ] `src/pinned-deps.spec.ts` -- five new `it()` blocks (LINT-01)
- [ ] `src/nx-target-inputs.spec.ts` -- `lint` probes and the `test.inputs` ESLint assertion (LINT-04)
- [ ] No framework install needed. Vitest, its config and the ESM/`import.meta.url` reading idiom
      all already exist. The only NEW capability is instantiating the ESLint Node API from a spec,
      which needs the `eslint` devDependency (SC7) and nothing else.

---

## Security Domain

`workflow.security_enforcement: true`, `security_asvs_level: 1`, `security_block_on: high`.

### Applicable ASVS categories

| ASVS Category | Applies | Why / standard control |
|---|---|---|
| V2 Authentication | no | no auth surface is touched; D-06 keeps the package manifest and public surface unchanged |
| V3 Session Management | no | none |
| V4 Access Control | no | none. THREAT-MODEL.md's C1-C18 CREEP controls are untouched by this phase |
| V5 Input Validation | no | no runtime input path changes |
| V6 Cryptography | no | none |
| V14 Configuration / Dependency | **yes** | five new devDependencies, all exact-pinned (D-02) and NAME-guarded (D-04); lockfile regenerated in a controlled linux/arm64 container (D-05) |

### Threat patterns for this change

| Pattern | STRIDE | Mitigation in this phase |
|---|---|---|
| Slopsquatted / typosquatted lint dependency | Tampering | all five names came from `STACK.md` section 0, verified against `registry.npmjs.org` on 2026-07-26 and re-reached this session for `eslint@9.39.5`, `@eslint/js@9.39.5`, `typescript-eslint@8.65.0` (each resolved a real tarball). See the Package Legitimacy Audit below |
| Silent version drift in a build gate | Tampering | exact pins + the `pinned-deps.spec.ts` name list (D-04). The ROBUST-03-class argument is recorded in the spec comment: `lint` is a build gate whose BEHAVIOUR a silent minor can change, which is the same argument that put `esbuild` in the list |
| A lint rule that can be silently disabled | Repudiation | LINT-05 (`require-description`) + LINT-06 (`reportUnusedDisableDirectives: 'error'`) are precisely this control |
| Malicious `postinstall` in a new devDependency | Tampering | see the audit below |

### Package Legitimacy Audit

`gsd-tools query package-legitimacy check` is not reachable from this agent context; verification was
done directly against `registry.npmjs.org` this session and against `STACK.md` section 1.1's
2026-07-26 registry pass.

| Package | Registry | Requested version | Publish date | Source repo | Verdict | Disposition |
|---|---|---|---|---|---|---|
| `eslint` | npm | `9.39.5` | 2026-07-10 | github.com/eslint/eslint | OK | Approved. Tarball fetched and read this session; `engines: ^18.18.0 \|\| ^20.9.0 \|\| >=21.1.0`; no `postinstall` |
| `@eslint/js` | npm | `9.39.5` | in lockstep with `eslint` | github.com/eslint/eslint (monorepo) | OK | Approved. Tarball fetched and read this session |
| `typescript-eslint` | npm | `8.65.0` | 2026-07-20 | github.com/typescript-eslint/typescript-eslint | OK | Approved. Tarball fetched this session; it is a thin meta-package over `@typescript-eslint/{eslint-plugin,parser,utils,typescript-estree}@8.65.0` |
| `@eslint-community/eslint-plugin-eslint-comments` | npm | `4.7.2` | 2026-05-26 | github.com/eslint-community/eslint-plugin-eslint-comments | OK | Approved (STACK 1.1, registry-verified 2026-07-26). **Not independently re-fetched this session** -- the executor should confirm at install time |
| `@nx/eslint` | npm | `23.1.0` | 2026-07-13 | github.com/nrwl/nx | OK | Approved. Same org and exact version as the four `@nx/*` / `nx` packages already installed |

**Packages removed due to a SLOP verdict:** none.
**Packages flagged SUS:** none.
**Executor obligation at install time:** run
`npm view <pkg> scripts.postinstall` for all five before `npm i`. None is expected to have one; a
non-empty result on any is a STOP condition requiring a `checkpoint:human-verify`.

---

## Corrections to Existing Artifacts

Nine corrections. Two are BLOCKING (they change what the plan must contain); the rest are precision
fixes that would otherwise cost the executor time.

### C1 (BLOCKING) -- `no-restricted-imports` cannot see a dynamic import, so the `ImportExpression` selector is MANDATORY

- **Where:** `STACK.md` 1.5 ("Also cover `import('node:os')` dynamic form **if any spec uses it**");
  `PITFALLS.md` E4 (lists `await import` implicitly among evasions but prescribes only
  "`no-restricted-imports` for `node:os`/`os` ... it closes the whole import family in one line").
- **Wrong because:** ESLint 9.39.5's `no-restricted-imports` returns a visitor object containing
  exactly `ImportDeclaration`, `ExportNamedDeclaration`, `ExportAllDeclaration` and
  `TSImportEqualsDeclaration`. **There is no `ImportExpression` visitor** (F10, read from
  `lib/rules/no-restricted-imports.js:815-845`). It does NOT close "the whole import family"; it
  closes the STATIC import family.
- **Consequence:** D-21 lists `await import('node:os')` as a shape whose verdict must be asserted.
  Without an `ImportExpression[source.value=/^(node:)?(os|path)$/]` entry in `no-restricted-syntax`,
  that assertion FAILS and the executor will (correctly) conclude the rule set is incomplete --
  after burning time looking in the wrong rule. The selector is P6 in G2; it is measured to work.

### C2 (BLOCKING) -- there are FOUR sites but only FOUR error positions, and `:26` is not one of them

- **Where:** `07-CONTEXT.md` D-22's site table and `REQUIREMENTS.md` CORR-05's table both write
  "`cache-archive-path.spec.ts:1` (`import { tmpdir }`) **and `:26` (`tmpdir()`)**".
- **Wrong because:** measured -- `expect(dirname(p)).toBe(tmpdir());` matches ZERO selectors, and it
  should: in strict ESM the `tmpdir` binding cannot exist without the import, and the import is
  already an error. One error is produced for that file, at line 1.
- **Consequence:** if the executor places an `eslint-disable-next-line` above line 26, that
  directive is UNUSED and D-28's `reportUnusedDisableDirectives: 'error'` fails the build. **The
  phase would ship red because of its own opt-out discipline.** Four disables, at lines 1, 38, 39
  and 60. The table's site 1 row is still correct as a SITE (both lines go away together in Phase 9
  with VER-02); only the error-position reading is wrong.
- **Second-order:** the table must key on FILE + EXPRESSION, not line numbers -- inserting the
  disables shifts every later line in the same commit.

### C3 -- the `import * as <name>` "ceiling" is smaller than CONTEXT.md and STACK.md imply

- **Where:** `STACK.md` 1.5 ("`no-restricted-imports` alone cannot ban a specific member of a
  namespace import") and `07-CONTEXT.md` D-15 (same claim), which together read as "an
  `import * as sys from 'node:os'` slips the ban".
- **Sharpened:** the literal claim is true (it cannot ban a specific MEMBER), but the operative
  behaviour is stronger than the claim suggests. F11: when `importNames` is set,
  `ImportNamespaceSpecifier` maps to the name `"*"` and the rule reports the whole import with
  messageId `everything` -- **regardless of the local binding name**. So `import * as sys from
  'node:os'` IS an error, from `no-restricted-imports`, and P4's hardcoded `object.name` regex is
  defence in depth rather than the only line. This does not change D-15 (both rules are still
  required, for the reason D-15 gives) -- it changes what must be recorded as a `// ponytail:`
  ceiling under D-21. Recorded form is in G2.

### C4 -- D-13 is wrong about `vitest.config.mts` / `vitest.integration.config.mts`

- **Where:** `07-CONTEXT.md` D-13: "`vitest.config.mts` and `vitest.integration.config.mts` use
  `__dirname` and fall in the same treatment class" as `pack-check.cjs`.
- **Wrong because:** `typescript-eslint/eslint-recommended` scopes `no-undef: 'off'` to
  `['**/*.ts','**/*.tsx','**/*.mts','**/*.cts']` (F13/F14), which INCLUDES `.mts`. `__dirname` in an
  `.mts` file produces nothing. Both files use ESM `import`, so `no-require-imports` cannot fire
  either. **They need no override block.** Adding one ships dead configuration.
- D-13's `pack-check.cjs` half is correct and is the ONLY member of that class (F23).

### C5 -- the `.cjs` fix is an ORDERING fix, which D-13 does not say

- **Where:** `07-CONTEXT.md` D-13 prescribes "scope that rule off for `**/*.cjs` with
  `sourceType: 'commonjs'` and node globals" without saying where in the array.
- **Sharpened:** `typescript-eslint/base` has NO `files` key (F13), so it sets
  `sourceType: 'module'` and the TS parser for EVERY file including `.cjs`, overriding ESLint's own
  default `.cjs` block. **The override must come AFTER the `tseslint.configs.recommended` spread**
  or it is itself overridden and the fix silently does nothing. Config-object ordering is explicitly
  Claude's discretion under CONTEXT.md; this is a mechanism that constrains that discretion.
- Also: `no-undef` is LIVE on `.cjs` (it is only disabled for ts/tsx/mts/cts), which D-13 does not
  mention. Measured: 7 `no-undef` findings in `pack-check.cjs` on top of the 2 `no-require-imports`
  D-13 predicts.

### C6 -- PITFALLS E3 clause 2 overstates the lint scope

- **Where:** `PITFALLS.md` E3.2: "ESLint lints more than `src/**`: config files
  (`vitest.config.mts`, `esbuild.action.mjs`), `start-cache-server/entry.ts`, and `*.cjs` helpers."
- **Wrong under D-07:** `esbuild.action.mjs` and `start-cache-server/entry.ts` live at the WORKSPACE
  ROOT, outside `cwd = packages/github-cache`, and are not linted at all -- D-07 records this as an
  intentional deviation and CONTEXT.md's Deferred Ideas carries "lint the root-level files the
  project-scoped target misses" as a follow-on. E3.2 predates that decision.
- **And it points the wrong way.** The real LINT-04 widening runs in the OPPOSITE direction: `eslint
  .` walks the filesystem (F9) while Nx's `default` input resolves against a git-derived file map,
  so `dist/` and `out-tsc/` are **in the lint scope but NOT hashed**. 96 generated files today (F24).
  See G3. This instance is not recorded anywhere in the existing artifacts.

### C7 -- `STACK.md` 1.3's inferred-target shape is incomplete

- **Where:** the quoted `buildEslintTargets` output in `STACK.md` 1.3.
- **Missing:** `...tsconfigChainOutsideProjectRoot.map(f => '{workspaceRoot}/' + f)`, between the
  eslint-config entries and `{workspaceRoot}/tools/eslint-rules/**/*` (F17). For this repo the chain
  resolves to exactly `tsconfig.base.json`, which `sharedGlobals` -> `default` already covers, so
  D-24's replacement list needs no change. **Recording it matters because D-24's whole premise is
  "the block must restate everything it keeps"** -- a planner comparing the restated list against
  STACK's quote would conclude it is complete when the real inferred list is one entry longer.

### C8 -- the config file's EXISTENCE gates the target, which nothing records

- **Where:** not stated in `STACK.md`, `PITFALLS.md` or `07-CONTEXT.md`.
- **Fact (F16):** `@nx/eslint@23.1.0`'s `createNodes` short-circuits with
  `if (eslintConfigFiles.length === 0) { return []; }`. Registering the plugin in `nx.json` with no
  `eslint.config.*` anywhere produces NO lint target, silently -- not an error, just nothing. It
  would read as "the plugin does not work".
- **Consequence:** a hard ordering constraint (G7): install -> config -> registration. Never
  registration before config.

### C9 -- `STACK.md` 1.5's glob-base-path claim is CONFIRMED (recorded so nobody re-checks it)

The prompt flagged this for verification. `basePath = path.dirname(configFilePath)`, passed to
`new FlatConfigArray(..., { basePath })` (F2, read at 9.39.5). STACK.md 1.5 is right. The one
addition: passing `--config <path>` would set `basePath = cwd` instead and silently rewrite every
glob's frame. D-34 already forbids overriding `options.command`; this is a second, independent
reason.

### Also noted, already known, restated for the planner

- `ROADMAP.md` Phase 7 SC3 says "three CORR-05 violations". `REQUIREMENTS.md` and D-22 correct this
  to FOUR. Use FOUR.
- `.planning/codebase/CONVENTIONS.md` still states "ESLint is NOT configured in this repository".
  This phase falsifies it. Regenerating `.planning/codebase/*` is a Deferred Idea, not a Phase 7
  deliverable, but the verifier should not treat the stale sentence as a contradiction.
- `LINT-05`'s requirement text uses the legacy bare `eslint-comments/` prefix; the flat-config prefix
  is `@eslint-community/eslint-comments/` (D-29). Do not copy the requirement text into the config.

---

## Open Questions

| # | Question | Status | What would settle it |
|---|---|---|---|
| Q1 | Does `@nx/eslint` infer `lint` identically on Windows and Linux? | **UNVERIFIED BY DESIGN** (D-35, STACK 7). F18 confirms the mixed-separator `isPathIgnored` gate genuinely runs for this project layout, so the risk is live rather than hypothetical | Phase 8's CORR-03 two-leg job, treating `lint` as a fourth target. Phase 7's obligation is only to RECORD the hashed node values as the baseline. **Do not reason it closed here.** |
| Q2 | Does `fallow` auto-credit `eslint.config.mjs` and its imports? | **MEDIUM.** F20 (the literal filename is in the binary's config table, paired with `eslint`) is strong but is a binary-strings inference, not documentation | One `npm run fallow:ci` on the commit that adds the file. Contingency and exact remedy are in G6. Zero risk of getting stuck |
| Q3 | The REAL D-12 baseline finding count | **PREDICTED 10 (+0-2 uncertain), not measured.** ESLint cannot be installed in this session | The measurement command in G4. A materially higher number most likely means the G3 `ignores` block is missing -- check that before disabling any rule |
| Q4 | `no-useless-escape` / `no-control-regex` / `no-irregular-whitespace` / `no-misleading-character-class` findings | **LOW confidence, predicted 0-2.** ~25 files contain a regex; this class is the least greppable | The G4 measurement command |
| Q5 | Do babel-estree and `@typescript-eslint/parser` agree on every node shape G2's selectors depend on? | **REASONED yes** for `MemberExpression`, `VariableDeclarator`, `ObjectPattern`/`Property`, `ImportDeclaration`, `ImportExpression` -- all plain ESTree | The D-20 spec running REAL ESLint with the real parser, in-phase. If a selector that measured MATCH here comes back clean there, the node shape is the first place to look |
| Q6 | Can the D-19 drift guard import `eslint.config.mjs` from a `.ts` spec under `module: nodenext`? | **OPEN.** A static `import ... from '../../../eslint.config.mjs'` will fail `typecheck` (no declaration file, `allowJs` is unset). Recommended workaround: `await import(new URL('../../../eslint.config.mjs', import.meta.url).href)` -- a NON-LITERAL specifier, which TypeScript types as `any` and does not attempt to resolve. Untested here | The executor writing the spec. Fallback is the house disk-read pattern (`cleanup-workflow.spec.ts` / `ppe-action.spec.ts`: read the text, strip `//` comment lines, regex the globs) |
| Q7 | Can the drift guard read the vitest configs by IMPORT rather than by text? | **PROBABLY NOT.** `defineConfig(() => ({ root: __dirname, ... }))` returns the function; calling it evaluates `__dirname`, which Vitest's ESM transform does not inject for a `.mts` module imported from a spec. **Recommend the disk-read + comment-strip pattern for the vitest side** and do not burn time on the import | Trying it once; the failure is immediate and loud |
| Q8 | Does `nx run-many -t lint` print `Cache: n/m hit (p%)` in the same form as `test` / `typecheck`? | **ASSUMED yes.** The line is emitted by `run-many`'s lifecycle, not per target; gok measured it for `test` and `typecheck` on this repo | The first G5 run. If the line is absent, fall back to `nx run <project>:lint --verbose` and record the `[local cache]` / execution evidence instead |
| Q9 | Does `eslint@10` still expose `loadESLint` (which `@nx/eslint`'s `resolveESLintClass` calls)? | **NOT CHECKED**, carried from STACK 7 | Irrelevant at 9.39.5 (D-03). Check before the deferred v10 bump |
| Q10 | Will regenerating `package-lock.json` in the D-05 container bump a transitive runtime dep and drift `start-cache-server/index.js`? | **POSSIBLE, not predicted.** `@actions/cache` and `@actions/core` are exact-pinned but their own deps carry ranges | `npm run check:action` immediately after `npm ci` on the regenerated lockfile. If it drifts: `npm run build:action` and stage the bundle IN THE SAME COMMIT (SC9) |

---

## Sources

**Read from source this session (highest confidence):**

- `eslint@9.39.5` -- tarball streamed from `registry.npmjs.org/eslint/-/eslint-9.39.5.tgz`:
  `lib/config/config-loader.js` (`FLAT_CONFIG_FILENAMES` :43, `locateConfigFileToUse` :527,
  `calculateConfigArray` :560, `LegacyConfigLoader` :690-800), `lib/config/default-config.js`,
  `lib/eslint/eslint.js` (`lintText` :1081-1176), `lib/eslint/eslint-helpers.js`
  (`globSearch` :259, `findFiles` :516, `warnIgnored` default :822),
  `lib/rules/no-restricted-imports.js` (`checkRestrictedPathAndReport` :392, `checkNode` :769,
  the visitor object :815).
- `@eslint/js@9.39.5` -- `src/configs/eslint-recommended.js` (61 enabled rules, counted).
- `@typescript-eslint/eslint-plugin@8.65.0` -- `dist/configs/flat/{base,recommended,eslint-recommended}.js`,
  `dist/configs/eslint-recommended-raw.js`.
- `typescript-eslint@8.65.0` -- `package.json` (the four `@typescript-eslint/*` deps at 8.65.0).
- `nrwl/nx` @ tag `23.1.0` (local clone at `D:\projects\github\nrwl\nx`, read via `git show 23.1.0:`)
  -- `packages/eslint/src/plugins/plugin.ts`: `createNodes`, `internalCreateNodesV2`,
  `getProjectUsingESLintConfig`, `buildEslintTargets`, `normalizeOptions`, `DEFAULT_EXTENSIONS`.

**Measured on this repo this session:**

- `esquery@1.7.0` + `@babel/parser` (both already in `node_modules`) -- 22 source shapes parsed and
  matched against 7 candidate selectors; every verdict in G2 is a measured match count.
- `git grep` / `git ls-files` / `find` -- the file inventory (73 tracked, 64 linted), the extension
  breakdown, the four violation sites read verbatim, the G4 rule-by-rule baseline greps, the
  `dist/` + `out-tsc/` counts.
- `rg -uu -a` over `node_modules/@fallow-cli/win32-arm64-msvc/fallow.exe` -- the built-in
  config-filename table containing `eslint.config.{js,cjs,mjs,ts,mts,cts}`.
- `registry.npmjs.org` -- `eslint@9.39.5` metadata (engines, deps, dist), `dist-tags.latest` =
  `10.8.0`, and live tarballs for the three packages read above.

**Repository artifacts read:**

`nx.json`, `packages/github-cache/project.json`, both vitest configs,
`packages/github-cache/{tsconfig.json,pack-check.cjs}`, `tsconfig.base.json`, root `package.json`,
`.fallowrc.jsonc`, `.prettierignore`, `.gitignore`, `.github/workflows/ci.yml` (job list + the
`format-check`/`fallow` job shapes), `src/{pinned-deps,nx-target-inputs}.spec.ts`, the three
violation-site spec files, `esbuild.action.mjs`, `start-cache-server/entry.ts`,
`.planning/config.json`.

**Planning artifacts read:** `07-CONTEXT.md`, `ROADMAP.md`, `REQUIREMENTS.md` (85-188),
`research/v0.0.2/STACK.md` (0-1.7, 4, 5, 7), `research/v0.0.2/PITFALLS.md` (section E),
`quick/260726-gok-.../260726-gok-SUMMARY.md`.

**Not re-verified this session (carried from STACK.md's 2026-07-26 registry pass):**
`@eslint-community/eslint-plugin-eslint-comments@4.7.2` and `@nx/eslint@23.1.0` package metadata.

---

## Metadata

**Confidence breakdown:**

| Area | Level | Reason |
|---|---|---|
| G1 config resolution + `lintText` semantics | **HIGH** | read from the exact 9.39.5 sources |
| G2 selector set | **HIGH** | every verdict is a measured esquery match count; the `no-restricted-imports` half is read from the rule source |
| G3 lint scope + the `dist`/`out-tsc` finding | **HIGH** | mechanism read from `eslint-helpers.js`, file counts measured on disk |
| G4 baseline count | **MEDIUM** | analytic. Rule universe is HIGH (read from source); the per-rule counts are grep-derived proxies |
| G5 differential sequence | **HIGH** for the mechanism and the negative controls; **MEDIUM** for the exact `Cache:` wording under `lint` (Q8) |
| G6 fallow | **HIGH** for `@nx/eslint`; **MEDIUM** for the config-file auto-credit (Q2) |
| G7 sequencing | **HIGH** -- every coupling names a verified mechanism; SC9's non-triggering is verified, not assumed |
| Validation architecture | **HIGH** -- builds on the repo's own gok precedent and the measured vacuity traps |

**Research date:** 2026-07-27
**Valid until:** 30 days for the ESLint/tseslint source facts (pinned versions, so effectively
indefinite); 7 days for the registry `latest` observations; the `dist`/`out-tsc` file counts are a
snapshot and will change with any build.

---
*Phase 7 research. Deliberately narrow: it answers the seven gaps `07-CONTEXT.md` and
`research/v0.0.2/{STACK,PITFALLS,SUMMARY}.md` leave open, and corrects them where measurement
disagreed with them. It does not restate what they already establish.*

