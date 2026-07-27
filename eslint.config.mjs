// Root ESLint 9 flat config -- the SINGLE config for the whole workspace (D-10).
//
// `.mjs`, not `.ts`: a TypeScript config would need `jiti`, a sixth install and a
// transpile step in the `lint` critical path. It imports no local helper module
// either -- a helper living outside `{projectRoot}` or `tools/eslint-rules/` would
// not be a declared `lint` input, which is exactly the LINT-04 stale-cache hole.
//
// GLOB FRAME -- read this before editing any `files` or `ignores` pattern below.
// Every glob here is matched against a path relative to the WORKSPACE ROOT, because
// ESLint sets `basePath = path.dirname(configFilePath)` (eslint 9.39.5
// lib/config/config-loader.js:547 and :600) -- NOT relative to the target's `cwd`,
// which is `packages/github-cache`. Every pattern in this file therefore starts with
// a `**` segment, and the frame stays invisible right up until someone "tidies" one
// into a project-relative form such as `src/[star][star]/*.spec.ts`. That form matches
// NOTHING (there is no root `src/`), so the rule silently stops firing -- and a rule
// that matches nothing is indistinguishable from a rule that was never wired up.
// For the same reason `--config <path>` must NEVER be added to the command: that
// branch sets `basePath = cwd` instead and rewrites the frame every pattern here is
// built on. D-34 already forbids overriding the inferred command; this is a second,
// independent reason.
//
// NEVER CREATE A ROOT `src/` OR `lib/` DIRECTORY DURING v0.0.2 (D-08). The lock lives
// here because its stated home cannot carry it -- `nx.json` is strict JSON with zero
// comments. `@nx/eslint`'s `getProjectUsingESLintConfig` returns `null` for the root
// project precisely because neither directory exists; creating one flips that and
// silently adds a SECOND lint target, changing `hash_project_config` and rotating
// every task hash in the middle of the Phase 8 parity investigation.
//
// SCOPE, recorded rather than papered over (D-07). `lint` is project-scoped: `eslint .`
// with `cwd` at `packages/github-cache`. The workspace root gets NO lint target, so
// `esbuild.action.mjs`, `start-cache-server/entry.ts`, `vitest.workspace.ts` and the
// `.planning/spikes/*.mjs` scripts are NOT linted. That narrows LINT-01 SC1's literal
// "across the workspace" to "across the project that has specs" -- an intentional,
// recorded DEVIATION for the verifier, not a gap: all 32 spec files and all four
// CORR-05 sites are inside the scope, so LINT-02, LINT-03 and CORR-06 are fully
// covered, and the LINT-04 input set stays matched to the real lint scope instead of
// being widened past it. Linting the root-level files needs a second scope and is
// carried as a deferred idea, not attempted here.

import comments from '@eslint-community/eslint-plugin-eslint-comments/configs';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

// Single source for the ban's explanation (LINT-02 / CORR-06), referenced by every
// `paths[].message` and every `no-restricted-syntax` message below, so the two
// rules can never give contradictory advice about the same violation.
//
// The canonical ALLOWED shape named here is `cachePlatform('win32')` and it is a
// DECISION, not an example picked for readability (D-18). The two-argument form of
// the asset-name helper must never appear in this string: CORR-02 deletes that
// parameter in Phase 10, three phases after this rule is written, and `fallow`
// would then flag the example. ROADMAP SC2 uses exactly that forbidden form -- do
// not copy it from there. OBS-03 deliberately keeps `cachePlatform`, which is what
// makes it the stable substitute.
const BAN_MESSAGE =
  'CORR-06: a unit spec must not derive an expectation from the RUNNING machine. ' +
  "Pass the platform in instead -- cachePlatform('win32') -- or move the assertion " +
  'to an *.integration.spec.ts, where these APIs are allowed. Opting out needs a ' +
  'described disable saying why the assertion cannot move (LINT-05/LINT-06).';

// The accessor lists are declared once and shared by the prefixed and bare
// specifier entries, so the two halves of each pair cannot drift apart.
//
// `'default'` is FIRST and is not an accessor at all -- it is the synthetic name
// `no-restricted-imports` gives an `ImportDefaultSpecifier`, the same way it gives
// an `ImportNamespaceSpecifier` the synthetic `'*'`. Without it `import osx from
// 'node:os'; osx.tmpdir()` reported NOTHING (measured): the imports rule saw only
// `default`, which was not in either list, and P4/P5 below only reach the four
// hardcoded binding names. Both modules have working CJS default exports under
// `nodenext` + `esModuleInterop`, so that is an idiomatic reachable shape one token
// away from `import * as os`, which the ban DID catch. Listing it here bans the
// whole machine-dependent surface at the import, regardless of the local name.
const BANNED_OS_ACCESSORS = [
  'default',
  'tmpdir',
  'EOL',
  'platform',
  'arch',
  'homedir',
  'type',
  'release',
];
const BANNED_PATH_ACCESSORS = ['default', 'sep', 'delimiter', 'win32', 'posix'];

export default [
  // GLOBAL ignores. A standalone `ignores` with no other key removes these paths
  // from linting ENTIRELY -- deliberately NOT the D-17 shape, which only narrows a
  // single config object. This block is REQUIRED, not hygiene: `eslint .` walks the
  // real FILESYSTEM (`hfs.walk`) and never consults git, while Nx's `default` input
  // resolves against a git-derived file map. `dist/` and `out-tsc/` are gitignored,
  // so Nx never hashes them -- but they are on disk after `build`/`typecheck` and
  // WOULD be linted. That makes `lint`'s result depend on whether `build` ran while
  // its Nx hash does not move: a stale-cache false PASS by construction, and the
  // widening runs in the opposite direction to the one PITFALLS E3 predicted.
  // `**/node_modules/` and `.git/` are already ignored by ESLint's own default
  // config and are deliberately not restated. Guarded by G5's negative control 2:
  // the linted-file count must be identical across `rm -rf dist out-tsc`.
  {
    ignores: [
      '**/dist/',
      '**/out-tsc/',
      '**/test-output/',
      '**/.nx/',
      '**/coverage/',
    ],
  },

  js.configs.recommended,

  // The NON-type-checked variant, deliberately (D-11). `recommendedTypeChecked`
  // plus `parserOptions.projectService`/`project` would make `lint` sensitive to
  // every file in the TypeScript program AND to the tsconfigs -- a much wider input
  // set to declare correctly and a much bigger stale-cache blast radius (LINT-04
  // clause c) -- and buys nothing here, because no rule this phase mandates is
  // type-aware: `no-restricted-imports`/`no-restricted-syntax` are syntactic and
  // `ban-ts-comment`/`require-description` are comment-level.
  ...tseslint.configs.recommended,

  // MUST come AFTER the `tseslint.configs.recommended` spread, and the ordering IS
  // the fix. `typescript-eslint/base` carries NO `files` key, so it applies the TS
  // parser and `sourceType: 'module'` to EVERY linted file -- overriding ESLint's own
  // default `{ files: ['**/*.cjs'], sourceType: 'commonjs' }` block. Placed BEFORE the
  // spread this object is itself overridden and silently does nothing. Measured
  // before this block existed: 7 `no-undef` + 2 `no-require-imports` findings, all
  // from this one 172-line file.
  //
  // `pack-check.cjs` is the ONLY member of this class in the tree -- a deliberately
  // dependency-free CommonJS guard script CI runs straight after `npm ci`. Rewriting
  // it to ESM to satisfy a TS-oriented rule would be the tail wagging the dog (D-13).
  // Note that `vitest.config.mts` and `vitest.integration.config.mts` are NOT in this
  // class and get no override: `typescript-eslint/eslint-recommended` already scopes
  // `no-undef: 'off'` to `{ts,tsx,mts,cts}`, which covers their `__dirname`, and both
  // use ESM imports so `no-require-imports` cannot fire. An override for them would be
  // dead configuration a future reader would waste time on.
  {
    files: ['**/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs',
      // Declared inline rather than installing the `globals` package: `globals` is not
      // one of the five approved devDependencies (D-02), is not in the LINT-04
      // `externalDependencies` list, and would need its own fallow entry. Four names
      // beat a sixth dependency.
      //
      // ponytail: an inline four-name globals map instead of `no-undef: 'off'` for
      // this glob. Ceiling = a global this file starts using that is not one of the
      // four (say `Buffer`) reads as a `no-undef` error rather than being resolved;
      // upgrade path is adding the name here, only if that ever happens. Taken over
      // the one-line-shorter `'no-undef': 'off'` because `.cjs` is the ONLY place in
      // the repo where `no-undef` is live at all (it is disabled for ts/tsx/mts/cts),
      // so switching it off here would give up the typo check on the one file that
      // still has one.
      globals: {
        require: 'readonly',
        module: 'writable',
        __dirname: 'readonly',
        process: 'readonly',
      },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },

  // Registers the comments plugin under its scoped flat-config prefix
  // `@eslint-community/eslint-comments/`, which is what `require-description` below
  // is referenced by. NOTE the prefix: LINT-05's requirement text uses the LEGACY
  // bare `eslint-comments/` form. Same rule, different prefix -- copying the
  // requirement text verbatim into this file would not resolve (D-29). The five
  // rules this set enables (disable-enable-pair, no-aggregating-enable,
  // no-duplicate-disable, no-unlimited-disable, no-unused-enable) are the same
  // opt-out-hygiene family as LINT-05/LINT-06 and measure ZERO findings on this tree,
  // because there are no `eslint-disable` comments in it yet.
  comments.recommended,

  {
    // v9's default for this is a non-failing `warn` (`reportUnusedDisableDirectives: 1`
    // in ESLint's own default-config.js). Setting it EXPLICITLY to `error` makes that
    // default irrelevant for the cost of one line, and it is the whole mechanism
    // behind LINT-06: a described disable left sitting over a line that no longer
    // violates anything FAILS the build, which is what will force each of the four
    // CORR-05 disables out together with its violation in Phases 9 and 10.
    // `reportUnusedInlineConfigs` is deliberately not set -- no v0.0.2 requirement
    // needs it (D-28).
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
    rules: {
      // LINT-05: an opt-out must say WHY. A bare `eslint-disable-next-line` is an
      // error; only the `-- <reason>` form is admissible.
      '@eslint-community/eslint-comments/require-description': 'error',

      // LINT-05's TypeScript half (D-30), free with `typescript-eslint` and needing no
      // extra package: a bare `@ts-expect-error` is an error, the described form is
      // allowed, and `@ts-ignore` is banned outright in either form -- it suppresses
      // silently and never fails when the underlying error goes away, which is exactly
      // the property `@ts-expect-error` has and it does not.
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-expect-error': 'allow-with-description', 'ts-ignore': true },
      ],

      // Codifies the convention the repo ALREADY follows at six sites rather than
      // editing working code or spending a described disable on it. The single
      // baseline finding for this rule was `serve.spec.ts:89`'s `_bytes` -- a
      // trailing, deliberately-unused parameter that `args: 'after-used'` reports
      // while the other five `_`-prefixed params escape only because a USED param
      // follows them. A disable there would need a description under LINT-05 and
      // would then be one more thing to keep true; the underscore pattern is the
      // convention-matching fix and it is not a rule being turned off.
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },

  // LINT-02 / CORR-06 -- the ambient-platform-read ban, and the reason this phase
  // exists. A unit spec that derives an expectation from the RUNNING machine makes
  // its own verdict machine-dependent, which is how a cross-OS-shared cache entry
  // becomes wrong on one leg of the matrix and right on another.
  //
  // `ignores` is a SIBLING of `files` in THIS object and must stay one (D-17). In
  // that position it removes integration specs from this object ALONE, so they keep
  // every other rule in this file and lose only the ban -- which is precisely
  // CORR-06's "the same APIs stay ALLOWED in integration". Hoisted into a standalone
  // `ignores`-only object (the shape at the top of this file) it would globally
  // UN-LINT every integration spec, and the difference is invisible from the config
  // alone: both forms make the ban assertions pass. `lint-rules.spec.ts`'s "a
  // non-ban rule still errors at an *.integration.spec.ts path" control is what
  // tells the two apart.
  //
  // The FULL `{ts,mts,cts}` set in BOTH globs (D-16). The `.ts`-only form INVERTS
  // the rule rather than merely narrowing it: `vitest.integration.config.mts`
  // includes all three extensions, so an `*.integration.spec.mts` would be linted as
  // a unit spec and its LEGITIMATE platform read would fail, while an `*.spec.mts`
  // unit spec would slip the ban entirely. `lint-scope-drift.spec.ts` asserts the
  // two sets are identical and that they cover the integration include set.
  {
    files: ['**/*.spec.{ts,mts,cts}'],
    ignores: ['**/*.integration.spec.{ts,mts,cts}'],
    rules: {
      // The only rule of the two that can see a DESTRUCTURED NAMED IMPORT -- and
      // `cache-archive-path.spec.ts:1` is exactly that shape.
      //
      // FOUR entries, not two: the source match is an exact string lookup, so the
      // prefixed and bare specifiers are independent keys. The repo writes
      // `node:`-prefixed specifiers everywhere today; the bare forms cost one line
      // each and close the shape a future contributor will reach for.
      //
      // Per-name, not whole-module: `import { basename, dirname } from 'node:path'`
      // stays legitimate and is asserted so. A NAMESPACE import is reported anyway,
      // regardless of the local binding name, because it necessarily carries the
      // restricted names in with it.
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'node:os',
              importNames: BANNED_OS_ACCESSORS,
              message: BAN_MESSAGE,
            },
            {
              name: 'os',
              importNames: BANNED_OS_ACCESSORS,
              message: BAN_MESSAGE,
            },
            {
              name: 'node:path',
              importNames: BANNED_PATH_ACCESSORS,
              message: BAN_MESSAGE,
            },
            {
              name: 'path',
              importNames: BANNED_PATH_ACCESSORS,
              message: BAN_MESSAGE,
            },
          ],
        },
      ],

      // The only rule of the two that can ban a MEMBER of a namespace import or
      // reach a DYNAMIC import. Neither rule is sufficient alone (D-15); each
      // selector family below is proven individually load-bearing by plan 07-04's
      // M1/M2/M3 mutations.
      //
      // ponytail: P4/P5 hardcode the conventional binding names (os/nodeOs,
      // path/nodePath). Ceiling = a module object bound to any OTHER name is
      // invisible to THESE selectors. It is still an error, but read the reason
      // carefully, because the obvious phrasing of it is wrong: local-name
      // independence is a property of `no-restricted-imports`'s SPECIFIER
      // handling, not of the module. It maps an `ImportNamespaceSpecifier` to the
      // synthetic name `'*'` and an `ImportDefaultSpecifier` to `'default'`, and
      // reports either whenever that synthetic name is in the entry's
      // `importNames`. `'*'` is covered because a namespace necessarily carries
      // the restricted names in with it; `'default'` is covered only because it
      // is listed explicitly at the top of both accessor lists above. This
      // comment previously claimed the imports rule reports "regardless of the
      // local name" full stop -- true for `import * as X`, FALSE for `import X`,
      // which measured as reporting nothing at all before `'default'` was added.
      // The dynamic form is closed by P6.
      //
      // Upgrade path if the name constraint ever stops holding: drop the
      // object.name constraint and add an allowlist of legitimate objects
      // instead. Do NOT drop it without one -- measured, the unconstrained form
      // false-positives on the canonical allowed shape and on a plain
      // `config.platform` read.
      //
      // ponytail: every selector here is syntactic. Ceiling = a platform read
      // hidden behind a helper in ANOTHER module is out of reach, for these and for
      // any non-type-aware rule. Upgrade path is type-aware linting, which D-11
      // excludes for a stated reason (it widens the `lint` input set to the whole
      // TypeScript program and with it the stale-cache blast radius), so this one is
      // accepted rather than scheduled.
      'no-restricted-syntax': [
        'error',
        {
          // P1. The primary shape, and three of the four extant violations. The
          // non-computed constraint is what lets P2 be a separate, deliberately
          // broad ban rather than an accidental overlap.
          selector:
            "MemberExpression[computed=false][object.name='process'][property.name=/^(platform|arch)$/]",
          message: BAN_MESSAGE,
        },
        {
          // P2. Deliberately BROAD: a runtime key is the only shape a targeted
          // selector cannot see, so every computed index of `process` is banned.
          selector: "MemberExpression[computed=true][object.name='process']",
          message:
            BAN_MESSAGE +
            ' Computed indexing of process is banned WHOLESALE inside a unit spec,' +
            " including process['env'], because a runtime key is the only shape a" +
            ' targeted selector cannot see and computed indexing of process has no' +
            ' legitimate use here. The dotted process.env.CI form is unaffected.',
        },
        {
          // P3. Covers aliasing AND destructuring in one selector, and reports at
          // the declarator -- where the ambient dependency enters -- rather than at
          // the later read.
          selector: "VariableDeclarator[init.name='process']",
          message: BAN_MESSAGE,
        },
        {
          // P4. Backstop for an os namespace object; see the ceiling note above.
          selector:
            'MemberExpression[computed=false][object.name=/^(os|nodeOs)$/][property.name=/^(tmpdir|EOL|platform|arch|homedir|type|release)$/]',
          message: BAN_MESSAGE,
        },
        {
          // P5. Same, for a path namespace object. Constrained to the four
          // machine-dependent accessors, so `path.join` stays legitimate.
          selector:
            'MemberExpression[computed=false][object.name=/^(path|nodePath)$/][property.name=/^(sep|delimiter|win32|posix)$/]',
          message: BAN_MESSAGE,
        },
        {
          // P6, MANDATORY. `no-restricted-imports` at 9.39.5 has visitors for
          // static import and export declarations ONLY -- it has no
          // ImportExpression visitor, so it closes the STATIC import family and not
          // "the import family". Without this selector `await import('node:os')` is
          // a silent hole, and an executor looking for the miss would look in the
          // wrong rule. Constrained to the two module specifiers, so a dynamic
          // import of a local module is untouched.
          selector: 'ImportExpression[source.value=/^(node:)?(os|path)$/]',
          message: BAN_MESSAGE,
        },
        {
          // P7. Additive: matches the globalThis-qualified form and, measured, does
          // NOT double-report the plain one. Its false-positive surface is
          // `<anything>.process.platform`, which would be a bizarre thing to write
          // in a unit spec and does not exist in this repo. Included rather than
          // declined, so `globalThis.process.platform` needs no ceiling comment.
          selector:
            "MemberExpression[computed=false][object.property.name='process'][property.name=/^(platform|arch)$/]",
          message: BAN_MESSAGE,
        },
      ],
    },
  },
];
