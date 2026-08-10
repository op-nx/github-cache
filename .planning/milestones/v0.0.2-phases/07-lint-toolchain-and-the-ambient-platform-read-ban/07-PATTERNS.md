# Phase 7: Lint Toolchain and the Ambient-Platform-Read Ban - Pattern Map

**Mapped:** 2026-07-27
**Files analyzed:** 11 (2 create, 9 modify)
**Analogs found:** 9 / 11

Every excerpt below is verbatim from the working tree at the mapped date, with real
`file:line` references. Nothing is paraphrased or invented.

---

## File Classification

| New/Modified File | Create/Modify | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|---|
| `eslint.config.mjs` | CREATE | config | transform (source -> findings) | `.fallowrc.jsonc` (comment-per-entry rationale), `packages/github-cache/vitest.config.mts` (decision-carrying tool config) | partial (convention-only; no linter exists today) |
| `packages/github-cache/src/<red-proof>.spec.ts` | CREATE | test (guard spec) | file-I/O + transform (ESLint Node API over the real config) | `public-surface.spec.ts` (explicit assertion lists) + `nx-target-inputs.spec.ts` (negative control) + `cleanup-workflow.spec.ts` (`import.meta.url` disk read) | role-match (no existing spec instantiates a vendor Node API) |
| D-19 drift guard (new file OR folded into the above) | CREATE | test (drift guard) | file-I/O | `docs-trust.spec.ts` (import the real single source, assert the derived copies agree) + `cleanup-workflow.spec.ts` / `ppe-action.spec.ts` (disk read + comment strip) | exact |
| `nx.json` `plugins[]` | MODIFY | config | n/a | `nx.json:27-33` (the `@nx/vitest` registration) | exact (self-analog) |
| `nx.json` `targetDefaults.lint` (new) | MODIFY | config | n/a | `nx.json:42-71` (`test`), `nx.json:72-87` (`integration`) | exact (self-analog) |
| `nx.json` `targetDefaults.test.inputs` (D-25) | MODIFY | config | n/a | `nx.json:44-70` itself | exact (self-analog) |
| `package.json` (root) | MODIFY | config | n/a | `package.json:5-19` scripts, `package.json:24-40` devDependencies | exact (self-analog) |
| `package-lock.json` | MODIFY | generated config | n/a | none - it is a PROCEDURE (D-05 container regen), not a code pattern | no analog |
| `packages/github-cache/src/pinned-deps.spec.ts` | MODIFY | test (name-list pin guard) | file-I/O | itself, `pinned-deps.spec.ts:63-87` (the ROOT-manifest `describe`) | exact (self-analog) |
| `packages/github-cache/src/nx-target-inputs.spec.ts` | MODIFY | test (inputs guard) | transform (Nx resolver trio) | itself, `nx-target-inputs.spec.ts:67-124` | exact (self-analog) |
| `.github/workflows/ci.yml` (new `lint` job) | MODIFY | config (CI job) | batch | `ci.yml:13-24` (`format-check`), `ci.yml:33-42` (`fallow`) | exact |
| `.fallowrc.jsonc` | MODIFY | config | n/a | `.fallowrc.jsonc:63` (`"@nx/vitest"` in `ignoreDependencies`), `.fallowrc.jsonc:38-41` (`entry` with rationale) | exact (self-analog) |
| The four CORR-05 sites (3 spec files, 4 described disables) | MODIFY | test (existing specs) | n/a | none - RESEARCH F21 measures ZERO existing `eslint-disable` comments in the tree | no analog (first of kind; follow the comment-density convention) |

---

## Pattern Assignments

### `packages/github-cache/src/pinned-deps.spec.ts` (test, file-I/O) - D-04, LINT-01

**Analog:** itself. Five new sibling `it()` blocks go in the SECOND `describe`
(`'pinned build tooling (ROBUST-03)'`), because that block already reads the ROOT
manifest and all five ESLint packages are ROOT devDependencies.

**Root-manifest read idiom + exact-semver regex** (`pinned-deps.spec.ts:75-87`, verbatim):

```ts
describe('pinned build tooling (ROBUST-03)', () => {
  const workspaceManifest = JSON.parse(
    readFileSync(new URL('../../../package.json', import.meta.url), 'utf8'),
  ) as { devDependencies?: Record<string, string> };

  const EXACT_SEMVER = /^\d+\.\d+\.\d+$/;

  it('esbuild is pinned to an exact version in the workspace devDependencies, never a range (ROBUST-03)', () => {
    const specifier = workspaceManifest.devDependencies?.['esbuild'];

    expect(specifier).toMatch(EXACT_SEMVER);
  });
});
```

Copy exactly: `new URL('../../../package.json', import.meta.url)` (three levels up from
`src/`), the `as { devDependencies?: Record<string, string> }` cast, the const named
`EXACT_SEMVER`, the blank line between the `const specifier` and the `expect`, and the
`it()` title shape `'<pkg> is pinned to an exact version ..., never a range (<REQ-ID>)'`.

**One-`it()`-per-package, never a loop** - `pinned-deps.spec.ts:22-60` shows five separate
`it()` blocks with no `it.each`. D-04 turns on this being a hard-coded NAME list; a loop
over `Object.keys(devDependencies)` would be a different (and wrong) guard.

**Where the D-04 ROBUST-03-class rationale goes** - a block comment ABOVE the group of
`it()`s, in the same voice as `pinned-deps.spec.ts:45-49`:

```ts
  // The resilience pairing (F04) is a new supply-chain surface: @octokit/plugin-retry
  // and @octokit/plugin-throttling. Both were verified against the registry (versions,
  // core 7 peer range, no install scripts) and confirmed as octokit@5.0.5's own
  // pairing, then pinned exact so a range operator can never silently pull an
  // un-audited minor/patch. This spec fails the build the moment either widens.
```

That is the exact template for D-04's obligation ("ESLint deps join the class because
`lint` is a build gate ... unlike `prettier`, which is formatting-only and deliberately
out"). Note the closing sentence pattern - every rationale block in this file ends with
"This spec fails the build the moment ...".

---

### `packages/github-cache/src/nx-target-inputs.spec.ts` (test, transform) - D-25, D-26, LINT-04

**Analog:** itself. Extend; do not build a new mechanism.

**Vendor-resolver delegation - the exact import path and call shape**
(`nx-target-inputs.spec.ts:1-8` and `:67-78`, verbatim):

```ts
import { readFileSync } from 'node:fs';
import type { NxJsonConfiguration } from 'nx/src/config/nx-json.js';
import {
  extractPatternsFromFileSets,
  filterUsingGlobPatterns,
  splitInputsIntoSelfAndDependencies,
} from 'nx/src/hasher/task-hasher.js';
import { describe, expect, it } from 'vitest';
```

```ts
function hashedFilesFor(target: string): string[] {
  const { selfInputs } = splitInputsIntoSelfAndDependencies(
    nxJson.targetDefaults[target].inputs,
    nxJson.namedInputs,
  );

  return filterUsingGlobPatterns(
    PROJECT_ROOT,
    PROBE_FILES.map((file) => ({ file, hash: 'probe' })),
    extractPatternsFromFileSets(selfInputs),
  ).map((entry) => entry.file);
}
```

`hashedFilesFor` already takes the target name as a parameter, so the `lint` probes need
NO new helper - call `hashedFilesFor('lint')`.

**nx.json read idiom** (`nx-target-inputs.spec.ts:47-52`):

```ts
const nxJson = JSON.parse(
  readFileSync(new URL('../../../nx.json', import.meta.url), 'utf8'),
) as {
  namedInputs: Record<string, TargetInputs>;
  targetDefaults: Record<string, { inputs: TargetInputs }>;
};
```

**THE NEGATIVE CONTROL that the new `lint` probes must carry an equivalent of**
(`nx-target-inputs.spec.ts:100-111`, verbatim - comment included, it is the load-bearing
part):

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

RESEARCH's Non-vacuous-assertions table says the `lint` probe set needs its own honest
negative: `lint`'s inputs start from `default` (`{projectRoot}/**/*`), so `build` is NOT a
usable discriminator for it. If no clean negative exists for `lint`, RESEARCH's explicit
instruction is to SAY SO in the comment rather than shipping a positive-only set. The
existing `build` assertion stays untouched and keeps covering `typecheck`.

**The literal-pinning `{workspaceRoot}` assertion - the shape for the D-25 `test.inputs`
ESLint assertion** (`nx-target-inputs.spec.ts:114-125`, verbatim):

```ts
describe('the guard cannot replay a stale pass', () => {
  // This one DOES pin a literal, deliberately: there is no resolver to delegate
  // to for a `{workspaceRoot}` entry, and the wiring IS the invariant. Its
  // limitation is honest -- if the entry is removed, this test only fires once
  // some other input busts the `test` hash. That is still the next unrelated
  // source edit, and stating the requirement in code beats leaving it implicit.
  it('nx.json is a test input, so editing it re-runs this file', () => {
    expect(nxJson.targetDefaults.test.inputs).toContain(
      '{workspaceRoot}/nx.json',
    );
  });
});
```

D-25's assertion (`{workspaceRoot}/eslint.config.mjs` is in `test.inputs`) is the same
`toContain` on the same object, and belongs in this same `describe`. Copy the "this one
DOES pin a literal, deliberately" comment framing - it is how the file pre-empts the
"why isn't this delegated to the resolver?" review question.

**Do NOT touch** the `expandSingleProjectInputs` warning recorded at `:28-43` (D-26: it
THROWS on this inputs array).

---

### `.github/workflows/ci.yml` - new `lint` job (config, batch) - D-32, D-33

**Analog:** `ci.yml:13-24` (`format-check`) - the shortest complete non-dogfooded job.
Per D-33 the `lint` job gets NO sidecar dogfood block, so `format-check` / `fallow` /
`pack-check` are the shape, NOT `build` / `typecheck` / `test` / `integration`.

**Shortest complete job** (`ci.yml:33-42`, `fallow` - verbatim, comment included):

```yaml
  # `fallow dead-code --fail-on-issues` gates the whole repo against dead code
  # (unused files/exports/deps + reachability). It is config-declared-clean via
  # .fallowrc.jsonc and base-independent, so it works identically on push and on
  # shallow pull_request checkouts -- unlike `fallow audit`, which needs an
  # origin/main diff base and fails open (exits 0) when that ref is absent.
  # Future option: `fallow audit --changed-since origin/main` for faster,
  # diff-scoped gating once the repo grows large enough to want it.
  fallow:
    runs-on: ubuntu-24.04-arm
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v6
        with:
          node-version-file: '.node-version'
          cache: 'npm'
      - run: npm ci
      - run: npm run fallow:ci
```

The exact five-line boilerplate to copy: `runs-on: ubuntu-24.04-arm`,
`actions/checkout@v7`, `actions/setup-node@v6` with `node-version-file: '.node-version'`
and `cache: 'npm'`, then `npm ci`, then the one `npm run <script>`.

Every one of the three non-dogfooded jobs carries a `#` rationale comment ABOVE the job
key stating what it gates and why it is a distinct named job (`ci.yml:26-32`, `:44-50`,
`:68-72`). `pack-check` (`ci.yml:73-83`) is the analog if `lint` ever needs a build step
first - it adds `- run: npm run build` before its guard. `lint` does NOT (no `dependsOn`,
and RESEARCH G3's global `ignores` block exists precisely so lint output does not depend
on whether `build` ran).

**Do not copy from** `build` / `typecheck` / `test` / `integration` (`ci.yml:159`, `:233`,
`:289`, `:361`) - those carry the sidecar dogfood wiring D-33 excludes.

---

### `nx.json` `targetDefaults.lint` (config) - D-24

**Analog:** `nx.json:42-71`, the `test` entry. `targetDefaults.<target>.inputs` REPLACES
rather than merges (D-24, verified empirically on this repo), so the new block must
restate everything it keeps.

**Verbatim shape to copy** (`nx.json:42-71`):

```json
    "test": {
      "dependsOn": ["^build"],
      "inputs": [
        "default",
        "^production",
        "{workspaceRoot}/SECURITY.md",
        "{workspaceRoot}/LICENSE",
        "{workspaceRoot}/package.json",
        "{workspaceRoot}/nx.json",
        "{workspaceRoot}/start-cache-server/action.yml",
        "{workspaceRoot}/start-cache-server/entry.ts",
        "{workspaceRoot}/README.md",
        "{workspaceRoot}/docs/configuration.md",
        "{workspaceRoot}/docs/advanced.md",
        "{workspaceRoot}/docs/trust-and-security.md",
        "{workspaceRoot}/docs/versioning.md",
        "{workspaceRoot}/docs/examples/minimal-ci.yml",
        "{workspaceRoot}/docs/examples/README.md",
        "{workspaceRoot}/.github/workflows/cleanup.yml",
        "{workspaceRoot}/.gitattributes",
        "{workspaceRoot}/ppe/action.yml",
        { "fileset": "{projectRoot}/tsconfig.spec.json", "dependencies": true },
        {
          "json": "{workspaceRoot}/tsconfig.json",
          "fields": ["compilerOptions"]
        },
        { "externalDependencies": ["vitest"] },
        { "dependentTasksOutputFiles": "**/*.js", "transitive": true }
      ]
    },
```

Ordering convention this file follows, and the `lint` block should too: bare named inputs
first (`"default"`, `"^production"`), then `{workspaceRoot}/...` string entries, then
object entries (`fileset`, `json`, `externalDependencies`, `dependentTasksOutputFiles`)
last. D-25's two additions to `test` are `{workspaceRoot}/eslint.config.mjs` (string,
alongside the other `{workspaceRoot}` strings) and the four ESLint names appended to the
existing `{ "externalDependencies": ["vitest"] }` entry.

**`outputs: []` and `cache: true` placement** - `nx.json:72-87` (`integration`) shows
`"cache": true` as the FIRST key inside the target block, before `dependsOn`/`inputs`.
D-24's `"outputs": []` goes in the same key band.

**CORR-04 constraint, visible in the analog** (`nx.json:85`): `integration` carries
`{ "runtime": "node -p process.platform" }`. That entry must stay the ONLY one of its kind
- `lint` must not acquire a platform input.

**`plugins[]` registration analog** (`nx.json:27-33`):

```json
    {
      "plugin": "@nx/vitest",
      "options": {
        "testTargetName": "test",
        "testMode": "watch"
      }
    }
```

D-08's comment-lock ("never create a root `src/` or `lib/`") has no JSON-comment vehicle -
`nx.json` is strict JSON with zero comments today. The planner must choose a carrier: the
plan/commit message, `eslint.config.mjs`'s header, or an assertion in a spec. Flag it; do
not silently drop it.

---

### `.fallowrc.jsonc` (config) - RESEARCH G6

**Analog:** itself.

**`ignoreDependencies` entry - the identical case** (`.fallowrc.jsonc:59-67`, verbatim):

```jsonc
  // Load-bearing at build/test time but not observable as ES imports. Exact
  // string match (not glob); exempts each from BOTH unused-dependency and
  // unlisted-dependency detection. Removing any of these breaks the build.
  "ignoreDependencies": [
    "@nx/vitest", // Nx plugin that INFERS the `test` target via nx.json
    "@swc-node/register", // SWC transpile hook for the test runner
    "@swc/helpers", // SWC runtime helpers
    "tslib", // TS importHelpers emit runtime
  ],
```

`@nx/eslint` is the exact same case as `@nx/vitest`. Copy the trailing-comma JSONC style
and the one-trailing-comment-per-entry form. Entries are in alphabetical order today, so
`"@nx/eslint"` goes FIRST.

**`entry` line with rationale, if fallow flags `eslint.config.mjs`** (`.fallowrc.jsonc:38-41`):

```jsonc
    // Integration vitest config: consumed by the `integration` target's
    // `vitest run --config` command (project.json), not by any import. fallow
    // auto-credits vitest.config.mts but not the .integration. variant, so declare it.
    "packages/github-cache/vitest.integration.config.mts",
```

That is the closest analog (a tool config credited by nothing importable). RESEARCH G6 is
explicit: add `@nx/eslint` NOW, add the `entry` line ONLY against a measured
`npm run fallow:ci` finding - the file's own comment at `:5-8` warns that speculative
entries suppress real future findings.

---

### `package.json` (root) (config) - D-02, D-32

**Analog:** itself.

**Scripts block** (`package.json:5-19`) - the four battery-command scripts `lint` mirrors:

```json
    "build": "nx run-many -t build",
    "typecheck": "nx run-many -t typecheck",
    "test": "nx run-many -t test",
    "integration": "nx run-many -t integration",
```

D-32's script is `"lint": "nx run-many -t lint"`. Scripts here are grouped by concern, not
alphabetized - put `lint` with these four.

**devDependencies** (`package.json:24-40`): exact-pinned entries are bare `x.y.z`
(`"@nx/js": "23.1.0"`, `"esbuild": "0.28.1"`); ranged entries carry `^`/`~`
(`"typescript": "~6.0.3"`). All five new entries are bare, and the block is alphabetical.

---

### `eslint.config.mjs` (CREATE, config, transform) - D-10, D-12, D-15..D-18, D-28..D-30

**No functional analog exists** - RESEARCH and CONVENTIONS.md both confirm there is no
ESLint config, no `.eslintrc*`, and no `eslint` dependency in the tree. The analog work is
the repo's CONFIG-AUTHORING conventions, which are strong and specific.

**Convention 1 - one decision-carrying comment per entry, in the file's own voice.**
`.fallowrc.jsonc:9-42` is the densest example: every one of the ten `entry` values carries
a 2-4 line comment naming WHY reachability analysis cannot infer it. Excerpt
(`.fallowrc.jsonc:28-31`):

```jsonc
    // Consumer JS action entry: esbuild.action.mjs bundles it to
    // start-cache-server/index.js, which the runner invokes as action.yml's `main`;
    // it is never imported, so reachability analysis cannot infer it (D-09, Phase 6).
    "start-cache-server/entry.ts",
```

Note the trailing requirement/decision ID (`D-09, Phase 6`). CONVENTIONS.md:293-301
records this as house style: "what invariant holds, why the alternative was rejected, and
which requirement ID it satisfies".

**Convention 2 - a tool config carries the reasoning for a non-obvious value inline.**
`packages/github-cache/vitest.config.mts:11-21` is the closest same-file-type analog (a
root-level `.mts` tool config); it spends 11 comment lines justifying a two-key `env`
block, including the counterfactual that would silently pass. Excerpt (`:26-35`):

```ts
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    // *.integration.spec.ts is owned by the separate `integration` target
    // (vitest.integration.config.mts); exclude it here so it does not double-run
    // under the fast unit `test` target. Spread configDefaults.exclude so the
    // built-in node_modules/dist exclusions are preserved (a bare array replaces
    // them, which would make vitest scan node_modules).
    exclude: [
      ...configDefaults.exclude,
      '{src,tests}/**/*.integration.spec.{ts,mts,cts}',
    ],
```

This is the file the D-19 drift guard compares against, AND the style precedent for how
`eslint.config.mjs` should annotate its `files`/`ignores` split (RESEARCH G1(b): comment-
lock that globs are workspace-root-relative because `basePath = dirname(eslint.config.mjs)`
even though the target's `cwd` is the package directory).

**Convention 3 - `// ponytail:` ceiling notes (D-21).** `packages/github-cache/src/lib/with-hash-lock.ts:1-3`, verbatim - this is
the ONLY `ponytail:` comment in the tree and therefore the exact style to copy:

```ts
// ponytail: global in-process map. Ceiling = single-process / ephemeral single-
// tenant runner (the documented deployment). A distributed lock is out of scope;
// upgrade path is a shared coordinator only if multi-process writers ever appear.
const inFlight = new Map<string, Promise<unknown>>();
```

Three-part structure to reproduce for every D-21 ceiling: (1) what the simplification IS,
(2) `Ceiling = <the named limit>`, (3) `upgrade path is <X> only if <trigger>`. RESEARCH
G2 already drafts the P4/P5 ceiling in this exact form; the `globalThis.` ceiling (if P7 is
declined) needs the same treatment.

**Convention 4 - single quotes.** `.prettierrc` is `{ "singleQuote": true }` and
`eslint.config.mjs` is NOT in `.prettierignore`, so `npm run format:check` (battery command
1) fails on double quotes.

**Convention 5 - single source, referenced twice.** RESEARCH G2's shared `BAN_MESSAGE`
const (one string referenced by every `no-restricted-imports` `paths[].message` and every
`no-restricted-syntax` `message`) is the CONVENTIONS.md single-source pattern applied
inside one file. The in-repo precedent for "declare once, reference from both consumers" is
`test/consumer-contract.ts`'s `EXPECTED_ENV_KNOBS`, imported by both
`public-surface.spec.ts:34` and `docs-adoption.spec.ts`.

---

### The D-20/D-21/D-22 RED-proof spec (CREATE, test, file-I/O + transform) - LINT-02/03/05/06, CORR-06

**No exact analog** - nothing in the tree instantiates a vendor Node API from a spec. Four
partial analogs, each supplying one piece.

**(a) Workspace-root resolution from a spec** - `pinned-deps.spec.ts:77`,
`docs-trust.spec.ts:24-31`, `cleanup-workflow.spec.ts:22-25`, `ppe-action.spec.ts:27-30`
all use `new URL('<relative>', import.meta.url)`, never `__dirname`, never
`process.cwd()`. From `src/*.spec.ts` the root is three levels up:

```ts
const nxJson = JSON.parse(
  readFileSync(new URL('../../../nx.json', import.meta.url), 'utf8'),
```
(`nx-target-inputs.spec.ts:47-48`)

RESEARCH G1's prescribed constructor takes the same idiom through `fileURLToPath`:
`fileURLToPath(new URL('../../../', import.meta.url))`. Both `docs-trust.spec.ts:20-22`
and `ppe-action.spec.ts:16-18` record the level-counting reasoning in a comment - do the
same.

**(b) Explicit assertion lists, never a snapshot (D-22's site table)** -
`public-surface.spec.ts:36-50`, verbatim:

```ts
// --- The enumerated consumer contract. An intentional, reviewed surface change
// edits the lists below; that edit IS the human-readable diff a reviewer sees. ---

/** D-04 group (c): the runtime value exports of the package barrel. */
const EXPECTED_VALUE_EXPORTS = ['createCacheServer'];

/** D-04 group (c): the type-only exports of the package barrel. */
const EXPECTED_TYPE_EXPORTS = [
  'CacheBackend',
  'GetHit',
  'GetResult',
  'PutResult',
  'ReadableBackend',
  'WritableBackend',
];
```

and its header rationale (`public-surface.spec.ts:18-23`, verbatim) - the house rule D-22
inherits:

```ts
 * Style: explicit-assertion-list, NOT toMatchSnapshot() (the pinned-deps.spec.ts /
 * ppe-action.spec.ts precedent, D-05). An intentional surface change is made by
 * editing the EXPECTED_* lists below, so the contract change lands as an obvious,
 * reviewable diff in THIS file -- preferred over a `.snap` whose `-u` regen is easy
 * to rubber-stamp. Under the D-01 pre-1.0 posture the surface MAY still evolve; the
 * guard only guarantees a change is intentional and reviewed, never that it is frozen.
```

D-22's site table is a `SCREAMING_SNAKE_CASE` module-level const of objects, following
this shape. RESEARCH C2 requires it key on FILE + EXPRESSION TEXT, never a line number.

**(c) Non-vacuity control, stated in a comment beside the assertion it protects** -
`nx-target-inputs.spec.ts:100-107` (quoted in full above). Three vacuity traps apply here
(RESEARCH's Non-vacuous-assertions table); each needs its own comment in this voice. The
first is mandatory and two lines (RESEARCH G1(c)):

```js
// Non-vacuity control for the RED proof. ESLint returns ZERO messages for a path
// it considers `ignored` or `unconfigured`, which is indistinguishable from
// "the rule did not fire". warnIgnored surfaces that as a warning we can reject.
expect(result.messages.filter((m) => m.severity === 1 && !m.ruleId)).toEqual([]);
```

**(d) Reading a config file off disk and stripping its own prose** - if the D-19 guard or
any `eslint.config.mjs` content assertion falls back to text (RESEARCH Q6/Q7 says the
vitest side probably must), copy `cleanup-workflow.spec.ts:22-30` verbatim, adjusting the
comment prefix from `#` to `//`:

```ts
const workflowSource = readFileSync(
  new URL('../../../../.github/workflows/cleanup.yml', import.meta.url),
  'utf8',
);

const codeLines = workflowSource
  .split('\n')
  .filter((line) => !line.trim().startsWith('#'))
  .join('\n');
```

with its header rationale (`cleanup-workflow.spec.ts:16-20`, verbatim) - the reason the
strip exists, which must be restated because it is non-obvious:

```ts
 * Only non-comment lines are matched: this file's own prose comments repeat
 * "contents: write" and "cancel-in-progress" verbatim while explaining the
 * rationale, so a naive substring match against the raw file would pass even if
 * the REAL YAML directive had drifted. Stripping '#'-prefixed lines first makes
 * every assertion below non-vacuous against the actual config.
```

This applies with FORCE here: an `eslint.config.mjs` assertion is guaranteed to hit this
trap, because the config's own comments will quote the very globs and rule names being
asserted (see RESEARCH G1(b)'s comment-lock requirement, G3's `ignores` block comment).
`ppe-action.spec.ts:20-25` records the identical warning for its own file.

**(e) `import { ESLint } from 'eslint'`** - a genuine import of the root devDependency,
per RESEARCH G1 note 3. No in-repo analog for importing a root devDep from a package spec;
`nx-target-inputs.spec.ts:2-7` importing `nx/src/*` internals is the closest, and it
records the semver risk of doing so (`:35-37`) - a comment shape worth mirroring.

---

### The D-19 drift guard (CREATE or fold; test, file-I/O) - D-19

**Analog:** `docs-trust.spec.ts` - the repo's canonical "two copies of one fact must
agree" guard.

**Header stating the drift failure mode it closes** (`docs-trust.spec.ts:6-23`, verbatim):

```ts
/**
 * DOCS-03/GOV-03 single-source drift guard.
 *
 * The trust doc renders the SETTLED model, so its correctness is only as good as
 * its agreement with the code it describes. Rather than a generic topic-token
 * check, this spec imports the authored write-gate and sync-gate allowlists
 * (TRUSTED_EVENTS + HOST_GATED_EVENTS from lib/trust.ts, SYNC_EVENTS from
 * lib/sync-gate.ts) and asserts every event string renders verbatim in
 * docs/trust-and-security.md. A future allowlist change (e.g. widening
 * HOST_GATED_EVENTS) therefore trips this guard until the doc is updated,
 * closing the doc-vs-code drift failure mode.
```

**The assert-agreement loop, with a per-item failure message** (`docs-trust.spec.ts:49-55`):

```ts
  it('renders every write-gate and sync-gate event string verbatim', () => {
    const events = [...TRUSTED_EVENTS, ...HOST_GATED_EVENTS, ...SYNC_EVENTS];

    for (const event of events) {
      expect(trustDoc, `trust doc missing event "${event}"`).toContain(event);
    }
  });
```

The `expect(value, message)` second-argument form is the house way to keep a loop's failure
attributable - copy it for D-19's superset assertion, which is exactly this shape ("every
extension in the integration include set appears in the shared ESLint set").

**The two real single sources the guard must read, never restate**
(`vitest.integration.config.mts:16` and `vitest.config.mts:26,32-35`):

```ts
    include: ['{src,tests}/**/*.integration.spec.{ts,mts,cts}'],
```

```ts
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: [
      ...configDefaults.exclude,
      '{src,tests}/**/*.integration.spec.{ts,mts,cts}',
    ],
```

That wider unit `include` is exactly why D-19 says "agree" is NOT set equality.

---

### The four CORR-05 sites (MODIFY; test) - D-31, LINT-05/LINT-06

**No analog** - RESEARCH F21 measures ZERO existing `eslint-disable` comments in the
project. These four are the first of their kind. The applicable pattern is the comment
convention, plus the exact expressions being disabled.

**Site 1 - `packages/github-cache/src/lib/cache-archive-path.spec.ts:1`** (verbatim):

```ts
import { tmpdir } from 'node:os';
```

The disable goes above line 1. RESEARCH C2 is BLOCKING here: line 26
(`expect(dirname(path)).toBe(tmpdir());`, `cache-archive-path.spec.ts:26`) produces NO
error, so a disable there is an UNUSED directive and D-28's
`reportUnusedDisableDirectives: 'error'` fails the build. FOUR disables, at four
positions, and line 26 is not one of them.

Note also `cache-archive-path.spec.ts:3` (`import { basename, dirname, isAbsolute } from
'node:path';`) is NOT an error - the banned `node:path` `importNames` are `sep`,
`delimiter`, `win32`, `posix`.

**Site 2 - `packages/github-cache/src/backend/releases-backend.spec.ts:37-38`** (verbatim):

```ts
const OTHER_PLATFORM: NodeJS.Platform =
  cachePlatform(process.platform) === 'windows' ? 'linux' : 'win32';
```

The violating expression is on line 38, and it already carries a 3-line rationale comment
above it (`:33-36`) - the disable joins that block.

**Sites 3 and 4 - `packages/github-cache/src/lib/release-asset-name.spec.ts:37-41` and
`:59-61`** (verbatim):

```ts
  it('resolves the running platform when called with no platform argument (CORR-01)', () => {
    expect(releaseAssetName('abc123' as Hash)).toBe(
      releaseAssetName('abc123' as Hash, process.platform),
    );
  });
```

```ts
  it('resolves the running platform when called with no argument (CORR-01)', () => {
    expect(cachePlatform()).toBe(cachePlatform(process.platform));
  });
```

**Reason-text pattern.** No disable exists to copy, so the model is the file-local comment
voice. `release-asset-name.spec.ts:45-49` is the nearest in-file example of the density
required:

```ts
  // G4, non-vacuous: all three mapped branches PLUS the default fall-through are
  // asserted with literal expectations. The injectable platform parameter is what
  // lets one CI leg assert every OS mapping -- a positive-only same-platform test
  // would still pass if the mapping were silently wrong for the other two, which
  // would re-namespace the whole store and invalidate every published asset.
```

LINT-06 requires each reason to state WHY the assertion cannot move to `integration`, and
RESEARCH's vacuity table requires the guard to assert the reason text contains the word
`integration`. Each site's reason must also carry its removal owner (D-22 table: VER-02
Phase 9 for site 1; CORR-02 Phase 10 for sites 2 and 3; nothing in this milestone for site
4).

**Line-number rot warning (RESEARCH C2 second-order):** inserting the disable above
`releases-backend.spec.ts:38` shifts every later line in that file by one, in the same
commit. The D-22 table must key on FILE + EXPRESSION TEXT.

---

## Shared Patterns

### Header-comment rationale block (applies to every new/modified file)

**Source:** CONVENTIONS.md:293-301, instantiated in `public-surface.spec.ts:1-29`,
`nx-target-inputs.spec.ts:10-44`, `pinned-deps.spec.ts:4-14`, `docs-trust.spec.ts:6-23`,
`cleanup-workflow.spec.ts:4-21`, `ppe-action.spec.ts:4-26`.

Every guard spec in this repo opens with a `/** ... */` block that states: (1) the
requirement ID, (2) the failure mode being closed, (3) why the obvious alternative was
rejected, and (4) the guard's own honest limitation. `nx-target-inputs.spec.ts:28-43` is
the sharpest example of (4):

```ts
 * Two limits of that delegation, both deliberate. `filterUsingGlobPatterns`
 * substitutes `{projectRoot}` ONLY, so probe paths must be project-relative -- a
 * `{workspaceRoot}` pattern survives literally and matches nothing here. And an
 * EMPTY pattern list makes it return every file it was handed, which is why the
 * non-vacuity control below is a negative assertion rather than another
 * toContain().
 *
 * `nx/src/*` is an internal subpath with no semver guarantee. An Nx major could
 * move it and break this file at IMPORT time. That is the desired failure mode:
 * loud and immediate, never a silent pass.
```

Apply to: both new spec files, and the D-04 comment block in `pinned-deps.spec.ts`.

### Path resolution: `new URL(..., import.meta.url)` only

**Source:** `pinned-deps.spec.ts:17,77`; `nx-target-inputs.spec.ts:48`;
`docs-trust.spec.ts:24-31`; `cleanup-workflow.spec.ts:22-25`; `ppe-action.spec.ts:27-30`.
**Apply to:** every new spec, and the RED proof's `WORKSPACE_ROOT` const.

Never `__dirname`, never `process.cwd()`. Two of the analogs (`docs-trust.spec.ts:20-22`,
`ppe-action.spec.ts:16-18`) explicitly record the level count in a comment. In this phase
the rule is doubly load-bearing: `process.cwd()` in a unit spec is precisely what LINT-02
exists to ban, and RESEARCH G1 pins `cwd: WORKSPACE_ROOT` on the ESLint constructor for the
same reason.

### Vitest import line

**Source:** `import { describe, expect, it } from 'vitest';` - identical at
`pinned-deps.spec.ts:2`, `nx-target-inputs.spec.ts:8`, `docs-trust.spec.ts:2`,
`cleanup-workflow.spec.ts:2`, `ppe-action.spec.ts:2`, `public-surface.spec.ts:31`.
**Apply to:** both new spec files. Imports are ordered: node builtins, then type-only, then
third-party, then relative (`nx-target-inputs.spec.ts:1-8`).

### Strict ESM, explicit `.js` on relative imports

**Source:** CONVENTIONS.md:36-40; `docs-trust.spec.ts:3-4`
(`from './lib/trust.js'`, `from './lib/sync-gate.js'`); `public-surface.spec.ts:32-34`.
**Apply to:** any relative import in the new specs. Non-negotiable under `nodenext`.

### Explicit assertion lists, never `toMatchSnapshot()`

**Source:** `public-surface.spec.ts:18-23` (quoted above).
**Apply to:** the D-22 site table, the D-21 evasion-shape verdict table, the D-19
extension sets.

### `// ponytail:` ceiling comment

**Source:** `packages/github-cache/src/lib/with-hash-lock.ts:1-3` (quoted above) - the only
instance in the tree.
**Apply to:** every D-21 shape the AST matcher cannot reach (RESEARCH G2 names P4/P5's
hardcoded namespace names and, if P7 is declined, `globalThis.process.platform`).

### Single source of truth + drift guard

**Source:** CONVENTIONS.md:180-232.
**Apply to:** the ESLint `files`/`ignores` extension set vs the two vitest configs (D-19);
the `BAN_MESSAGE` const shared by both ban rules (RESEARCH G2); optionally the ESLint
global-`ignores` stems vs `.gitignore` (RESEARCH G3 flags this as a candidate, not a
requirement). The in-repo two-consumer precedent is `test/consumer-contract.ts`'s
`EXPECTED_ENV_KNOBS`, consumed by `public-surface.spec.ts:34` and `docs-adoption.spec.ts`.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `eslint.config.mjs` | config | transform | No linter has ever been configured in this repo (CONVENTIONS.md:316-318 states it outright; the phase falsifies that sentence). Use RESEARCH G1/G2/G3 for content and the config-authoring conventions above for form. |
| `package-lock.json` | generated config | n/a | Regenerated by a PROCEDURE (D-05: linux/arm64 `node:24` container), not authored. No pattern to copy; the constraint is the container, plus the `npm run check:action` contingency at RESEARCH G7/SC9. |
| ESLint Node-API instantiation inside a spec | test | transform | Nothing in the tree instantiates a vendor Node API from a spec. `nx-target-inputs.spec.ts:1-8` (importing `nx/src/*` internals) is the closest and supplies the semver-risk comment shape, not the call shape. Use RESEARCH G1's "Exact constructor options" block verbatim. |
| `eslint-disable-next-line` directives | test | n/a | RESEARCH F21 measures zero existing `eslint-disable` comments. First of kind; the reason-text form comes from the comment-density convention, not from an existing directive. |

---

## Metadata

**Analog search scope:** repo root (`nx.json`, `package.json`, `.fallowrc.jsonc`,
`.github/workflows/ci.yml`), `packages/github-cache/` (`vitest.config.mts`,
`vitest.integration.config.mts`, `project.json`), `packages/github-cache/src/**` guard
specs and the three CORR-05 spec files.
**Files read in full or in targeted range:** 16
**Pattern extraction date:** 2026-07-27
**Read-only:** no source file was modified; this document is the only artifact written.
