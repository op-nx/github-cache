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
];
