# Phase 7: Lint Toolchain and the Ambient-Platform-Read Ban - Context

**Gathered:** 2026-07-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Adopt a linter this repository has never had (no ESLint, no Biome, verified), and convert one
specific convention -- "a unit spec must not derive an expectation from the running machine" --
from documented prose into a build failure that names the rule and cannot be silenced without
writing down why.

Delivers: ESLint 9 flat config + a cacheable `lint` target in the CI battery (LINT-01); the
two-rule ambient-platform ban scoped to unit specs and exempted in integration specs (LINT-02,
CORR-06); a permanent RED-before-GREEN proof covering evasion shapes AND the four extant
violation sites (LINT-03); `lint` inputs that cannot serve a stale-cache false PASS (LINT-04);
described-only opt-outs with stale directives failing the build (LINT-05, LINT-06).

Does NOT deliver: removal of any CORR-05 violation (Phases 9 and 10 own that -- Phase 7 must
land described disables and leave the violations in place so LINT-03 has something to catch);
any hash-parity measurement or root-cause work (Phase 8); any general code-quality or ecosystem
hygiene rule sweep.

**Mode:** not `mvp` (toolchain adoption, no vertical user-facing slice). TDD is globally on
(`workflow.tdd_mode: true`).

</domain>

<decisions>
## Implementation Decisions

### Toolchain adoption

- **D-01:** The `lint` target comes from the **`@nx/eslint/plugin` INFERENCE plugin**, registered
  in `nx.json` `plugins` as `{ "plugin": "@nx/eslint/plugin", "options": { "targetName": "lint" } }`.
  There is no auto-registration. **USER-SELECTED at discuss time** over the explicit-target
  alternative, which was presented in full and is now CLOSED -- do not re-open it. The one-line
  dismissal REQUIREMENTS and research both demand still goes in the plan: an explicitly declared
  `command: 'eslint .'` target beside the existing `integration` target in
  `packages/github-cache/project.json` would need no inference plugin at all (`@nx/eslint`'s value
  is target inference plus the `@nx/eslint:lint` executor, neither of which LINT-01..06 requires),
  but `@nx/eslint` is the ecosystem norm, the generator does the wiring, and ROADMAP/REQUIREMENTS
  already cite inference as the LINT-01 -> PARITY-01 ordering mechanism. **The ordering constraint
  holds either way** -- any declared target mutates `hash_project_config` -- so nothing in the
  roadmap shape depends on this choice. The accepted cost is carried by D-35.

- **D-02:** Exactly **five** root devDependencies, exact-pinned via `npm i -D -E`:
  `eslint@9.39.5`, `@eslint/js@9.39.5`, `typescript-eslint@8.65.0`,
  `@eslint-community/eslint-plugin-eslint-comments@4.7.2`, `@nx/eslint@23.1.0`. Nothing else.
  `STACK.md` section 4 enumerates every rejected addition with its reason: `jiti`,
  `@vitest/eslint-plugin`, `eslint-plugin-n` / `-import` / `-unicorn`, `eslint-config-prettier`,
  a `tools/eslint-rules/` workspace-rules project, and `@nx/jest` (declared as an optional peer;
  npm will neither install nor warn -- do not add it).

- **D-03:** **ESLint 9.39.5, not 10.x.** Every peer range already admits v10 and we would be
  flat-config-only anyway, so v10 is unblocked -- take 9 regardless. LINT-01 says v9; nothing in
  the milestone needs a v10 feature; `eslint@10.8.0` was days old at research time; and
  `@nx/eslint`'s `resolveESLintClass` calls `eslintModule.loadESLint({ useFlatConfig })`, whose
  survival under v10's eslintrc-loader removal is UNCHECKED. On 9.39.5 that call is documented and
  present. `@eslint/js` stays in lockstep at 9.39.5.

- **D-04:** All five names are added to `packages/github-cache/src/pinned-deps.spec.ts` as sibling
  `it()` blocks in the existing `describe`. **Pinning and guarding are two separate tasks.** That
  spec is a hard-coded NAME list with one `it()` per package, NOT a blanket "every dependency is
  exact" rule -- the workspace deliberately carries ranges (`typescript ~6.0.3`, `vitest ~4.1.0`,
  `prettier ^3.8.1`, `@types/node ^24.0.0`). Pinning without adding the names leaves them
  unguarded and a later `npm install eslint@latest` passes every check. Record the ROBUST-03-class
  call in the spec's comment, where every other such decision lives: ESLint deps join the class
  because `lint` is a build gate whose behaviour a silent minor bump can change -- the same
  argument that put `esbuild` in the list -- unlike `prettier`, which is formatting-only and is
  deliberately out. The precedent is genuinely ambiguous, so the reasoning must be written down,
  not just the outcome.

- **D-05:** Regenerate `package-lock.json` in a **linux/arm64 `node:24` container**, never with a
  bare Windows `npm install`. A Windows install prunes the Linux-only optional subtrees, breaks CI
  `npm ci`, and is invisible locally. Doubly load-bearing in this milestone: lockfile asymmetry is
  the leading `External`-instruction hypothesis for the Phase 8 parity bug, so a Windows-pruned
  lockfile would inject the very variable Phase 8 exists to isolate.

- **D-06:** `packages/github-cache/package.json` is **untouched**. No runtime dependency changes,
  no new export, no new action input, no new env knob (D2-02, PARITY-05). `public-surface.spec.ts`
  must pass unchanged, and that it passes unchanged is itself a v0.0.2 requirement.

### Lint scope and blast radius

- **D-07:** `lint` is **project-scoped**: `eslint .` with `cwd = packages/github-cache`. The
  workspace root gets NO lint target -- `@nx/eslint`'s `getProjectUsingESLintConfig` returns
  `null` for `.` because the root has neither a `src/` nor a `lib/` directory (verified). Recorded
  consequence rather than papered over: `esbuild.action.mjs`, `start-cache-server/entry.ts`,
  `vitest.workspace.ts` and `.planning/spikes/*.mjs` are **not linted** by this phase. This
  narrows LINT-01 SC1's literal "across the workspace" to "across the project that has specs" --
  **flag it for the verifier as an intentional, recorded deviation, not a gap.** It costs nothing
  against this phase's goal: all 32 spec files and all four CORR-05 sites live inside the scope,
  so LINT-02, LINT-03 and CORR-06 are fully covered. It also keeps the LINT-04 input set matched
  to the actual lint scope, which is the direction that closes the stale-PASS class rather than
  widening it.

- **D-08:** **Never create a root `src/` or `lib/` directory during v0.0.2.** It would flip
  `getProjectUsingESLintConfig` for the root project and silently add a SECOND lint target,
  changing `hash_project_config` and rotating every task hash in the middle of the parity
  investigation. Comment-lock this at the plugin registration in `nx.json`.

- **D-09:** Do **not** create `packages/github-cache/.eslintignore`. Its mere existence makes the
  plugin construct a per-project `ESLint` instance instead of the shared one and appends an
  OS-touching `existsSync` branch, for zero benefit. Ignores live in the flat config's `ignores`
  key.

- **D-10:** A **single root `eslint.config.mjs`** -- `.mjs`, not `.ts` (a TypeScript config needs
  `jiti`, an extra install and a transpile step in the `lint` critical path). No helper module
  imported by it unless that helper lives under `tools/eslint-rules/**/*` or inside
  `{projectRoot}`; an imported helper anywhere else would not be a declared input, which is
  exactly the LINT-04 hole. Prefer one file and add no `tools/eslint-rules/` project.

### Rule set composition

- **D-11:** Enable `@eslint/js` `recommended` plus `typescript-eslint` `recommended` (the
  **non-type-checked** variant), on top of the LINT-02/05/06 rules. **Do NOT enable
  `recommendedTypeChecked`, and do NOT set `parserOptions.projectService` or `project`.** No
  mandated rule is type-aware (`no-restricted-syntax`/`no-restricted-imports` are syntactic;
  `ban-ts-comment` and `require-description` are comment/AST-level), and type-aware linting would
  make `lint` sensitive to every file in the TypeScript program plus the tsconfigs -- a much wider
  input set to declare correctly and a much bigger stale-cache blast radius (LINT-04 clause c).

- **D-12:** **Bounded-cleanup rule.** Measure the baseline finding count from the recommended sets
  BEFORE fixing anything, and record it. Findings that are few and mechanical get fixed in-phase.
  Any single rule producing a broad sweep is turned OFF in `eslint.config.mjs` with a one-line
  recorded reason plus a deferred-ideas entry -- **never** a blanket file-level or directory-level
  disable, and never an open-ended codebase cleanup. LINT-01's scope is "a `lint` target exists
  and the platform ban is enforced"; ecosystem hygiene is a separate, later decision.

- **D-13:** Known-in-advance scoping needs, so the planner does not discover them as surprises:
  `packages/github-cache/pack-check.cjs` is CommonJS and will trip
  `@typescript-eslint/no-require-imports` -- scope that rule off for `**/*.cjs` with
  `sourceType: 'commonjs'` and node globals, rather than rewriting a working guard script.
  `vitest.config.mts` and `vitest.integration.config.mts` use `__dirname` and fall in the same
  treatment class.

  > **NOTE ADDED 2026-07-27 (D-16 amendment, finding ME-01).** Widening the ban's `files` to
  > `{js,mjs,cjs,ts,mts,cts,jsx,tsx}` means a hypothetical `foo.spec.cjs` now matches BOTH the
  > `**/*.cjs` override here AND the ban block. **Measured: the ban still fires** -- P1
  > (`process.platform`) is reported at `x.spec.cjs`. No config-object reordering was needed,
  > and C5's original ordering reason is intact: the `**/*.cjs` override still sits AFTER the
  > `tseslint.configs.recommended` spread (so it still wins on `languageOptions`), and the ban
  > block sits after BOTH and only sets `rules`, so the two compose rather than collide.
  > Confirmed live by `x.spec.cjs` reporting no `no-undef` on `process` -- i.e. the override's
  > inline globals map is still active -- while the ban error is present.
  >
  > Secondary, recorded not fixed: a hypothetical `*.spec.{js,mjs,jsx}` WOULD additionally
  > trip `no-undef` on `process`, because `typescript-eslint/eslint-recommended` scopes
  > `no-undef: 'off'` to `{ts,tsx,mts,cts}` only and the override above covers `.cjs` only.
  > That is noise on a file that does not exist, not a hole -- the ban fires regardless. Adding
  > a globals map for those three extensions would be speculative config for files nobody has
  > written; do it if and when the first one appears.

- **D-14:** No `eslint-config-prettier` and no `eslint-plugin-prettier`. `nx format:check`
  (Prettier directly, `.prettierrc` = `{ "singleQuote": true }`) already owns formatting, and
  neither enabled recommended set turns on stylistic rules -- there is no conflict to bridge.

### The ban itself (LINT-02, CORR-06)

- **D-15:** **Two core rules, both required, no plugin.** One rule alone proves RED for one shape
  and silently misses the other:
  - `no-restricted-imports` with `paths` entries for `node:os` / `os` (`importNames`: `tmpdir`,
    `EOL`, `platform`, `arch`, `homedir`, `type`, `release`) and `node:path` / `path`
    (`importNames`: `sep`, `delimiter`, `win32`, `posix`). This is the only rule that can see a
    **destructured named import** -- and `cache-archive-path.spec.ts:1` is exactly that shape.
  - `no-restricted-syntax` with `MemberExpression` selectors for `process.platform|arch`, the
    `node:os` accessor set off an `os`-style namespace object, and `path.{sep,delimiter,win32,posix}`.
    This is the only rule that can ban a **member of a namespace import**.
  Both are core ESLint rules -- no new dependency. `STACK.md` 1.5 carries a selector sketch; treat
  it as a starting point and validate it against the real expressions, not as final text.

- **D-16:** ~~Scope block is `files: ['**/*.spec.{ts,mts,cts}']` with
  `ignores: ['**/*.integration.spec.{ts,mts,cts}']` -- **the full `{ts,mts,cts}` set in BOTH
  globs.**~~ The `.ts`-only form INVERTS the rule: `vitest.integration.config.mts` includes
  `{src,tests}/**/*.integration.spec.{ts,mts,cts}`, so an `*.integration.spec.mts` would be linted
  as a unit spec and its LEGITIMATE platform read would fail lint, while a `*.spec.mts` unit spec
  would slip the ban entirely.

  > **AMENDED 2026-07-27 -- origin: code-review finding ME-01 (`07-REVIEW.md`).**
  > The struck text above is superseded. The scope block is now:
  >
  > ```js
  > files:   ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
  > ignores: ['**/*.integration.spec.{ts,mts,cts}'],
  > ```
  >
  > **What was wrong.** "The full `{ts,mts,cts}` set in BOTH globs" was right about the E5
  > inversion it was aimed at, and wrong about the FRAME. Symmetry between the two ESLint
  > globs says nothing about what the RUNNER collects, so both could sit narrower than it in
  > lockstep and still read as correct. They did: the unit runner collects
  > `{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}`, so `*.test.ts`,
  > `*.spec.tsx` and `*.spec.cjs` ran as unit tests with the ambient-platform ban silently
  > OFF. Zero such files existed, which is exactly why nothing would have noticed the first
  > one.
  >
  > **The two globs are now ASYMMETRIC ON PURPOSE.** Each mirrors a DIFFERENT vitest key:
  > `files` mirrors the unit `include`, `ignores` mirrors the unit `exclude`. Naively widening
  > `ignores` to match `files` opens a new hole in the other direction -- the integration
  > runner collects only `{ts,mts,cts}`, so `foo.integration.spec.tsx` is not an integration
  > spec, the unit runner's exclude misses it too, and it runs as a UNIT test that a widened
  > `ignores` would exempt. Measured: under that widening `x.integration.spec.tsx` goes from
  > BANNED to clean.
  >
  > **Blast radius checked before amending:** repo-only. The npm tarball carries 53 files and
  > zero eslint/lint/spec/vitest artifacts; none of the three files touched here ship.
  > `packages/github-cache/package.json` and `public-surface.spec.ts` remain byte-identical.
  >
  > **Verified after amending:** the ban fires at all eight extensions plus the `{test,spec}`
  > name family at a unit path, stays exempt at `*.integration.spec.{ts,mts,cts}`, and fires
  > at the `.tsx` corner. See the `.cjs` note in D-13.

- **D-17:** `ignores` sits **alongside `files` in the same config object**, never as a bare
  `ignores`-only object. An `ignores` beside `files` removes those paths from THIS object only, so
  integration specs keep every other rule and lose only the platform ban -- which is precisely
  CORR-06's "the same APIs stay ALLOWED in `integration`". A standalone `ignores` object would
  globally un-lint them.

- **D-18:** The canonical ALLOWED shape, used in every rule `message` and anywhere the rule is
  documented, is **`cachePlatform('win32')`**. Do **not** use `releaseAssetName(hash, 'win32')`:
  CORR-02 deletes that parameter in Phase 10, three phases after Phase 7 writes the rule, and
  `fallow` will then flag it. OBS-03 deliberately keeps `cachePlatform`, so it is the stable
  substitute. Injected or explicit platform values are never banned -- only deriving an
  expectation from the RUNNING machine is.

### Drift guard for the scope split

- **D-19:** A drift spec asserts the ESLint globs and the two vitest configs agree, in the repo's
  existing drift-guard style (`docs-trust.spec.ts`, `trust.generated.spec.ts`): read/import the
  REAL configs, never restate the globs in the assertion. ~~**"Agree" is NOT set equality** --
  `vitest.config.mts`'s include is deliberately wider (`{js,mjs,cjs,ts,mts,cts,jsx,tsx}`), so an
  equality assertion would be permanently red. The two load-bearing invariants to assert are:~~
  1. ~~the ESLint `files` and `ignores` extension sets are **identical to each other**, so the
     exemption can never be narrower than the ban (that asymmetry IS the E5 inversion); and~~
  2. ~~that shared set is a **superset of `vitest.integration.config.mts`'s include extension
     set**, so no integration spec can ever be linted as a unit spec.~~

  > **AMENDED 2026-07-27 -- origin: code-review finding ME-01 (`07-REVIEW.md`).**
  > The two struck invariants are superseded. Read-the-real-configs and never-restate-the-globs
  > are UNCHANGED and still the point.
  >
  > **The invariant is: a file runs as a unit test IF AND ONLY IF the ban applies to it.**
  > Asserted as three legs, all against the real vitest configs:
  >
  > 1. ESLint `files` **==** `vitest.config.mts` `include`
  > 2. ESLint `ignores` **==** `vitest.config.mts` `exclude` (its quoted spec-name entry)
  > 3. `vitest.config.mts` `exclude` **==** `vitest.integration.config.mts` `include`
  >
  > **Why (a) had to go.** It compared the two ESLint globs only to EACH OTHER, so it had no
  > term for the runner and could not express "the ban is narrower than what runs". Legs 1+2
  > subsume the E5 inversion (a) existed to catch, and additionally reach the `.tsx` corner
  > (a) cannot express. Measured contrast: against a naive symmetric widening of `ignores`,
  > (a) PASSES while leg 2 fails. Leg 3 is old (b) stated exactly -- equality rather than
  > superset, because a superset in that direction means a file runs twice or not at all.
  >
  > **"NOT set equality" was the part that misdiagnosed the problem.** The unit include IS
  > wider, but that is not a reason to avoid equality -- it is a reason to compare the ban
  > against the CORRECT key. What must not be compared literally is the PATH ANCHOR: ESLint
  > matches relative to the config file's directory (`**/`), vitest relative to the package
  > root (`{src,tests}/**/`). The guard therefore compares the BASENAME pattern -- name family
  > and extension set, both as sorted sets -- which is neither vacuous nor permanently red.
  > That limitation is recorded in the spec header.

### RED before GREEN (LINT-03)

- **D-20:** The RED proof is a **permanent programmatic spec**, not a one-time observation and not
  a deliberately-red intermediate commit. Instantiate ESLint's Node API against the real root
  `eslint.config.mjs` and use `lintText(code, { filePath })` -- it applies flat-config
  `files`/`ignores` matching to the supplied path, so ONE mechanism proves the rule fires AND
  proves the scoping in both directions (a synthetic `...spec.ts` path errors, the same source at
  a `...integration.spec.ts` path does not). This preserves the repo's bisect-safety discipline
  (full battery green at EVERY commit): the rules and the D-31 disables land in one commit, and
  the evidence lives in a test rather than in a red build nobody can re-run later.

- **D-21:** The fixture covers the **evasion shapes**, not only what exists today: `const
  { platform } = process`, `const p = process; p.platform`, `import { platform } from 'node:os'`,
  `import * as os from 'node:os'`, `const k = 'platform'; process[k]`, and
  `await import('node:os')`. Each shape's expected verdict is asserted explicitly. Any shape the
  AST matcher genuinely cannot reach is recorded as a **known ceiling** in a `// ponytail:`-style
  comment naming the ceiling and its upgrade path -- never left as an untested silent gap. A rule
  proven only against the cases that already exist is proven against the easy half, and a rule
  that matches nothing is indistinguishable from a rule that is not wired up.

- **D-22:** A second, deliberately coupled assertion proves each of the **four extant CORR-05
  sites** is caught while it still exists: a declared site table (file + violating expression),
  each linted with its `eslint-disable-next-line` stripped, asserting an error at that position.
  Comment-lock the table with the removal schedule so Phases 9/10 delete the row together with the
  site:

  | Site | Removed by |
  |------|-----------|
  | `src/lib/cache-archive-path.spec.ts:1` (`import { tmpdir }`) and `:26` (`tmpdir()`) | VER-02, Phase 9 |
  | `src/backend/releases-backend.spec.ts:38` (`cachePlatform(process.platform)`) | CORR-02, Phase 10 |
  | `src/lib/release-asset-name.spec.ts:39` (`releaseAssetName(hash, process.platform)`) | CORR-02, Phase 10 |
  | `src/lib/release-asset-name.spec.ts:60` (`cachePlatform(process.platform)`) | **NOTHING** in this milestone -- Phase 10 makes an explicit call; recommended is moving it to `src/server/public-server.integration.spec.ts`, where LINT-02 allows it |

- **D-23:** **Mutation-test the guard before declaring it done.** Revert one selector and confirm
  the spec goes red on exactly the expected assertions, then restore it. Precedent and standard:
  quick 260726-gok mutation-tested `nx-target-inputs.spec.ts` and it is the reason that guard is
  trusted. A guard that cannot fail is worthless.

### Stale-cache closure (LINT-04)

- **D-24:** `nx.json` `targetDefaults.lint` declares the full input list plus `outputs: []`.
  `targetDefaults.<target>.inputs` **REPLACES** the inferred list rather than merging (verified
  empirically on this repo for `test`), so the block must restate everything it keeps: `default`,
  `^default`, `{workspaceRoot}/eslint.config.mjs`, `{workspaceRoot}/tools/eslint-rules/**/*`, and
  `{ externalDependencies: ['eslint', '@eslint/js', 'typescript-eslint',
  '@eslint-community/eslint-plugin-eslint-comments'] }`. The inferred
  `{ externalDependencies: ['eslint'] }` alone IS the LINT-04 hole -- a `typescript-eslint` or
  comments-plugin bump would not invalidate the `lint` cache. `outputs: []` is honest (`eslint .`
  with no `--output-file` writes nothing) and removes the `{options.outputFile}` token from
  `hash_project_config` entirely.

- **D-25:** **Second-order hole, and the one most likely to be missed.** The D-20/D-22 guard specs
  run under the `test` target, so `test.inputs` must ALSO gain `{workspaceRoot}/eslint.config.mjs`
  and the ESLint entries in its `externalDependencies` -- **in the same commit** as the guard.
  Without it, editing a rule replays a cached `test` PASS, and since LINT-03 IS the activity that
  edits rules, the false PASS surfaces during LINT-03 itself and reads as "the rule does not
  fire". This repo has shipped that exact defect twice: `governance-email.spec.ts` (T-06-03-02)
  and `typecheck`'s spec-excluding inputs (quick 260726-gok). Do not make it three.

- **D-26:** Extend `packages/github-cache/src/nx-target-inputs.spec.ts`; do **not** build a new
  mechanism. It already delegates every glob decision to Nx's own resolver trio
  (`splitInputsIntoSelfAndDependencies` -> `extractPatternsFromFileSets` ->
  `filterUsingGlobPatterns`, mirroring Nx's `getTargetInputs`) so it cannot drift from Nx's
  behaviour. **Do not "restore" `expandSingleProjectInputs`** -- it looks like a cleanup and it
  THROWS on this inputs array, because it rejects entries carrying `dependencies: true` and
  `nx.json` has one. Honour the spec's own recorded caveat: reading `nx.json` from a spec is safe
  only because `{workspaceRoot}/nx.json` is a `test` input, and **only `test` declares it**.

- **D-27:** LINT-04 is closed **by differential, not by reading the config** -- SC4 says so in as
  many words. Two measurements, both with the before/after `Cache: n/m` line recorded: editing a
  rule in `eslint.config.mjs` re-runs `lint` instead of replaying, and editing a linted source
  file does the same. Same evidence discipline as quick 260726-gok, which proved its one-token fix
  by running the failing case on both sides of the change.

### Opt-out discipline (LINT-05, LINT-06)

- **D-28:** Set `linterOptions.reportUnusedDisableDirectives: 'error'` **explicitly** in the flat
  config. v9's default is a non-failing `warn`; setting it explicitly makes the default
  irrelevant and costs one line. Skip `reportUnusedInlineConfigs` -- no v0.0.2 requirement needs
  it.

- **D-29:** `@eslint-community/eslint-comments/require-description` at `error`, imported from the
  plugin's **`./configs` subpath export**. Note the flat-config rule prefix is the scoped
  `@eslint-community/eslint-comments/`, **not** the legacy bare `eslint-comments/` that LINT-05's
  requirement text uses. Same rule, different prefix -- do not copy the requirement text
  verbatim into the config.

- **D-30:** `@typescript-eslint/ban-ts-comment` configured
  `{ 'ts-expect-error': 'allow-with-description', 'ts-ignore': true }`, so a bare
  `@ts-expect-error` or `@ts-ignore` is also an error. Free with `typescript-eslint`; no extra
  package.

- **D-31:** Each of the four CORR-05 sites gets a described
  `// eslint-disable-next-line <rule> -- <reason>` **in the same commit as the rules**, so Phase 7
  lands GREEN. Per LINT-06 the reason text must state WHY the assertion cannot move to
  `integration`. LINT-06's unused-directive error is then the mechanism that forces each disable
  out together with its violation in Phases 9 and 10. **That is the design working, not a leak.**
  A planner who does not know this will either leave the build red or delete the violations early
  and destroy LINT-03's evidence -- both are failures.

### CI wiring

- **D-32:** Add a `lint` job to `.github/workflows/ci.yml` beside `format-check` / `fallow` /
  `pack-check`, and a root `"lint": "nx run-many -t lint"` package script mirroring the existing
  `build` / `typecheck` / `test` / `integration` scripts.

- **D-33:** The `lint` job does **not** get the sidecar dogfood block in Phase 7. The four
  dogfooded targets stay `build` / `typecheck` / `test` / `integration`. Adding a fifth cache
  producer and a fifth mirrored hash family in the middle of the milestone whose entire job is
  stabilising hashes buys nothing (lint runs in seconds) and adds surface to the Phase 8
  investigation. Purely additive later -- carried as a deferred idea, not a gap.

- **D-34:** No `--max-warnings` flag and no override of the inferred `command`. Every mandated
  rule is `error`, so warnings-as-errors is redundant; and leaving `options.command` at the
  literal `eslint .` keeps one more `hash_project_config` field untouched during a milestone that
  is trying to hold hashes still.

### Phase 8 hand-off (the recorded mitigation for D-01's inherited risk)

- **D-35:** Phase 7 **must record the inferred `lint` target's HASHED node values** as the
  baseline CORR-03 compares against: `targetName`, `executor`, `outputs`, `options` (including the
  resolved `cwd`), `configurations`, `parallelism`. Those are exactly the fields
  `hash_project_config` folds in -- `metadata` is NOT hashed, so the `${pmc.exec}` it contains is
  a non-issue for the hash. This is the accepted-risk mitigation for D-01: `STACK.md` section 7
  leaves "does `@nx/eslint` infer `lint` identically on both OSes?" **UNVERIFIED BY DESIGN**,
  because the existence gate runs `eslint.isPathIgnored(join(workspaceRoot, file))` with a POSIX
  `join` over an absolute Windows root, producing mixed separators. It reads clean at source and
  Windows tolerates it, but "should" is exactly what a two-leg measurement is for. **Phase 8's
  CORR-03 treats `lint` as a FOURTH target and settles it empirically. Do not reason it closed
  here.**

- **D-36:** **Record in advance, do not gate.** Registering the plugin rotates EVERY task hash,
  and rotates `test` twice over (`{workspaceRoot}/nx.json` is already an explicit `test` input).
  Phase 7's first default-branch push is therefore a legitimate **all-MISS push**; Phase 9's
  VER-01 produces a second one. Write this down now so Phase 9's OBS-04 tripwire is authored as
  "two consecutive all-miss pushes with NO version-affecting change in between" -- there are three
  legitimate rotation windows in this milestone, and a tripwire that fires on correct work gets
  disabled.

### Claude's Discretion

- Exact esquery selector strings, rule `message` wording, flat-config file layout and config-object
  ordering, and the per-site disable reason prose.
- Which recommended-set rules (if any) end up scoped off under D-12, and where the fix-vs-disable
  line falls. Decide on the measured count and record the call with its number.
- Whether the D-21 evasion fixtures live inline in the spec or as exported string constants in a
  sibling module.
- Whether the D-19 drift guard and the D-20/D-22 RED proof are one spec file or two.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Required reading, in this order (carried from STATE.md's Session Continuity block)

- `.planning/research/v0.0.2/PROBE-RESULTS.md` -- **FIRST.** Establishes the two axes (a real OS
  axis and a `.nx/workspace-data` freshness axis that perfectly masquerades as it) and reframes
  Phase 8. Phase 7 needs it to understand what D-36's hash rotation does and does not prove.
- `.planning/research/v0.0.2/SUMMARY.md` -- section 3.1 findings B-4 (pinned-deps is name-scoped),
  B-6 (four CORR-05 sites and the Phase 7 described-disable consequence), B-7 (the `.mts` glob
  inversion), B-8 (one rule cannot enforce the ban list); section 3.3 "Phase 7"; section 4 item 5
  (the `@nx/eslint` adjudication); section 6 open gaps.
- `.planning/REQUIREMENTS.md` -- lines 115-127 (CORR-06), 129-188 (LINT-01..06), 85-114 (CORR-05,
  the four-site table and the sequencing consequence), 534-536 (the LINT sequencing rows), 40-64
  (locked decisions D2-01..D2-06).
- `.planning/ROADMAP.md` -- "### Phase 7" (goal, five success criteria, and the hashing reason
  Phase 7 comes first), the Traceability rows for LINT-01..06 / CORR-06, and
  "### Every sequencing-constraint row, and where it is honoured".
- `.planning/THREAT-MODEL.md` -- the C1-C18 CREEP control ledger. Phase 7 does not touch a
  control, but the register is the project-level security context.
- `.planning/research/v0.0.2/PITFALLS.md` -- **weight SILENT-3 above everything else** (STATE.md
  instruction). Section E is the ESLint-adoption block: E1 verified facts, E2 the explicit-target
  alternative and the inference-plugin OS-divergence class, E3 `lint`'s own stale-cache false
  PASS, E4 the evasion shapes, E5 the glob inversion, E6 the name-scoped pin guard.

### ESLint toolchain specifics

- `.planning/research/v0.0.2/STACK.md` sections 0 through 1.7 -- the exact dependency table and
  versions, the v9-not-v10 call, the inferred target's literal shape read from
  `packages/eslint/src/plugins/plugin.ts` @ 23.1.0, the `hash_project_config` confirmation, the
  field-by-field OS-variance audit and its two caveats, the `.eslintignore` advice, the LINT-04
  input block, the two-rule requirement plus a selector sketch, LINT-05/06 wiring, and the pinning
  obligation. Section 4 "What NOT to add" (every rejected dependency with its reason), section 5
  (install command and the lockfile-container rule), section 7 (open items, labelled).
- `.planning/research/v0.0.2/ARCHITECTURE.md` -- section 2.2 Gap 1 (the four CORR-05 sites),
  section 5.1, section 6.4.

### Repository single sources this phase edits or must not break

- `nx.json` -- `plugins[]` (D-01), `targetDefaults.lint` (D-24), `targetDefaults.test.inputs`
  (D-25). Note the existing `integration` target's `{ runtime: 'node -p process.platform' }`
  discriminator: CORR-04 requires `integration` stays the ONLY target declaring one, so `lint`
  must not acquire a platform input.
- `packages/github-cache/project.json` -- the existing explicit `integration` target
  (`command` + `options.cwd`); the shape precedent for the alternative rejected in D-01.
- `packages/github-cache/vitest.config.mts` and `vitest.integration.config.mts` -- the partition
  LINT-02 mirrors and D-19 guards. Note the unit config's include is wider than `{ts,mts,cts}`.
- `packages/github-cache/src/pinned-deps.spec.ts` -- the name-scoped guard to extend (D-04).
- `packages/github-cache/src/nx-target-inputs.spec.ts` -- the Nx-resolver-delegating inputs guard
  to extend (D-26), including its recorded `expandSingleProjectInputs` warning.
- `packages/github-cache/src/public-surface.spec.ts` -- must pass unchanged (D-06).
- The four CORR-05 sites: `packages/github-cache/src/lib/cache-archive-path.spec.ts:1,26`;
  `src/backend/releases-backend.spec.ts:38`; `src/lib/release-asset-name.spec.ts:39,60`.
- `.github/workflows/ci.yml` -- the job battery `lint` joins (D-32). It is **not** currently an
  Nx input; PARITY-06 registers it in Phase 9, so a Phase 7 spec must not assert on it.
- `.fallowrc.jsonc` -- `entry` / `ignorePatterns` / `ignoreDependencies`. A new root
  `eslint.config.mjs` is not import-reachable and may need an `entry` declaration; the four new
  ESLint devDependencies are consumed only by the config file, so check the unused-dependency
  verdict before assuming `fallow:ci` stays green.
- `.prettierignore` and `.prettierrc` -- the Prettier/ESLint boundary D-14 relies on.
- `.planning/codebase/CONVENTIONS.md` -- the "single source of truth + drift guard" pattern every
  guard in this phase should follow, plus the two style rules currently "enforced by convention,
  not by a lint config". **Stale as of 2026-07-22**: it states "ESLint is NOT configured in this
  repository", which this phase falsifies.

### Prior art on the exact failure class this phase must not repeat

- `.planning/quick/260726-gok-resolve-typecheck-stale-cache-false-pass/` -- the `typecheck`
  stale-cache false PASS and its one-token fix. Source of the differential-proof discipline
  (D-27), the mutation-test standard (D-23), the `expandSingleProjectInputs` correction (D-26),
  and the "a guard's own non-vacuity control can itself be vacuous" lesson.
- `.planning/quick/260726-4cc-audit-and-triage-proposals-1-4-then-appl/` -- where the same
  false-pass class was first surfaced.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable assets

- **`pinned-deps.spec.ts`** -- exact-semver guard reading the ROOT manifest via
  `new URL('../../../package.json', import.meta.url)`. Adding five `it()` blocks to the existing
  `describe` satisfies D-04 with no new file and no new mechanism.
- **`nx-target-inputs.spec.ts`** -- resolves Nx target inputs through Nx's own resolver trio and
  is already mutation-tested. Extend it with `lint` probe files (D-26).
- **`docs-trust.spec.ts` / `trust.generated.spec.ts`** -- the drift-guard shape D-19 copies:
  import the real single source, assert the derived copies agree, fail the build on divergence.
- **`cleanup-workflow.spec.ts` / `ppe-action.spec.ts`** -- config-assertion specs that read a file
  off disk via `import.meta.url` (never `__dirname`, never `process.cwd()`) and strip
  `#`-comment lines first so the spec's own prose cannot make an assertion vacuously pass. The
  pattern to reach for when asserting on `eslint.config.mjs` content.
- **`src/test/` fixtures** (`octokit-fault.ts`, `consumer-contract.ts`) -- spec-only helpers with
  no product imports; the right home for shared LINT-03 fixture strings if D-21's discretion goes
  that way.

### Established patterns that constrain this phase

- **Single source + drift guard is the dominant convention.** Author a fact once, then add a spec
  that fails the moment a second copy drifts. Every new cross-cutting fact in this phase (the glob
  extension set, the site table, the input list) should follow it rather than being hand-synced.
- **Strict ESM, `nodenext`.** Every relative import carries an explicit `.js` extension even from
  a `.ts` source; `import type` for type-only imports. Non-negotiable under the current
  `tsconfig.base.json`.
- **Explicit assertion lists, never `toMatchSnapshot()`.** `public-surface.spec.ts` is the
  precedent: an intentional change must show up as a reviewable diff, not a rubber-stampable
  `.snap` regen.
- **Comment density carries decisions.** Module and function headers state the invariant, why the
  alternative was rejected, and the requirement ID. A stale rationale comment is treated as a
  defect. Every comment-lock this phase asks for follows that house style.
- **`// ponytail:` marks a deliberate, scoped simplification with its ceiling and upgrade path
  named inline** -- the right form for D-21's known-ceiling notes.

### Integration points

- `nx.json` `plugins[]` and `targetDefaults` -- where the target enters the graph and where its
  inputs are pinned.
- The root `package.json` `scripts` block and `.github/workflows/ci.yml` job list -- where `lint`
  becomes a gate.
- `packages/github-cache/src/**/*.spec.ts` -- the 32 files the ban applies to; exactly one
  integration spec exists today (`src/server/public-server.integration.spec.ts`), which is also
  Phase 10's recommended destination for CORR-05 site 4.

</code_context>

<specifics>
## Specific Ideas

- The user chose `@nx/eslint` over the explicit-target alternative **with the inference-plugin
  OS-divergence risk stated in full**. That risk is therefore ACCEPTED, not overlooked, and D-35
  is its recorded mitigation. Do not re-litigate the choice; do not silently drop the mitigation.
- Three pieces of received wording are known-wrong and must not be copied verbatim:
  LINT-05's bare `eslint-comments/` rule prefix (D-29), CORR-06's
  `releaseAssetName(hash, 'win32')` example (D-18), and LINT-01's "covered by the `pinned-deps`
  guard" phrasing (D-04). Each has a corrected form above.
- Two claims that read like conclusions but are open questions, to be carried as open:
  whether `@nx/eslint` infers `lint` identically on both OSes (D-35), and how many findings the
  recommended rule sets produce on this tree (D-12). Neither is answerable by reading.

</specifics>

<deferred>
## Deferred Ideas

- **Mechanize the two conventions `CONVENTIONS.md` records as "enforced by convention, not by a
  lint config"** -- `curly` (a core rule, zero-dep, and the tree already complies) and
  blank-lines-around-control-flow (needs `@stylistic`, a new dependency). Genuinely tempting given
  a linter is now present, but outside LINT-01..06; research parks ecosystem hygiene rules as "a
  later, separate decision". A follow-on, not this phase.
- **Sidecar dogfood block for the `lint` job** (D-33). Purely additive. Revisit once Phase 8's
  parity work has settled and adding a fifth cache producer no longer muddies the investigation.
- **Lint the root-level files the project-scoped target misses** -- `esbuild.action.mjs`,
  `start-cache-server/entry.ts`, `vitest.workspace.ts`. Needs a second lint scope, and the
  `@nx/eslint` route to it is closed by D-08 (creating a root `src/`). A later, deliberate change.
- **`eslint@10` bump.** Blocked on checking that `loadESLint` survives v10's eslintrc-loader
  removal, which `@nx/eslint`'s `resolveESLintClass` depends on (`STACK.md` section 7). One-line
  change once checked.
- **Regenerate `.planning/codebase/*` via `/gsd:map-codebase`.** Mapped 2026-07-22 against v0.0.1
  and already flagged stale in PROJECT.md and STATE.md's Operator Next Steps. This phase falsifies
  `CONVENTIONS.md`'s "ESLint is NOT configured in this repository" outright. Not a Phase 7
  deliverable.

### Surfaced, and NOT owned by this phase

- **Whether `gsd/v0.0.2-os-invariant-cross-os-sharing` gets a PR per phase or one at milestone
  end** is an open operator decision already carried in STATE.md's Operator Next Steps. It is out
  of Phase 7's scope, but it determines WHEN D-36's legitimate all-MISS push lands on `main`, and
  Phase 10's live-CI close and Phase 11's proofs both depend on a warm mirror on the default
  branch. Flagged so it is not discovered late.

### Closed at discuss time, not deferred

- **The explicit-`lint`-target alternative** (a `command: 'eslint .'` target in the existing
  `project.json`). Presented in full with its case for and against, and rejected by the user in
  favour of `@nx/eslint` (D-01). Record the one-line dismissal in the plan as REQUIREMENTS and
  research require, then move on.

</deferred>

---

*Phase: 7-Lint Toolchain and the Ambient-Platform-Read Ban*
*Context gathered: 2026-07-27*
