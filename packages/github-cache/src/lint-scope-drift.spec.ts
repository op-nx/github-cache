import { readFileSync, statSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';

/**
 * LINT-02 / D-19 / D-08 scope-drift guard for the ambient-platform-read ban.
 *
 * The ban's correctness depends on THREE globs written in two different files
 * agreeing with each other: `eslint.config.mjs`'s `files` (what the ban applies
 * to), its `ignores` (what the ban exempts), and
 * `vitest.integration.config.mts`'s `include` (what "an integration spec" means
 * to the test runner). Nothing links them, so they drift independently, and the
 * drift is SILENT in both directions. An exemption NARROWER than the ban -- the
 * `.ts`-only form of `ignores` against a `{ts,mts,cts}` `files` -- makes an
 * `*.integration.spec.mts`'s LEGITIMATE platform read fail lint. The same
 * asymmetry the other way lets an `*.spec.mts` unit spec slip the ban entirely.
 * Both read as a green build until someone writes the file that trips them.
 *
 * Why not the obvious alternative. Restating the expected globs as literals in
 * an `expect` would be shorter, and it would guard nothing: the assertion would
 * be a second copy of the thing it is checking, and the two copies drift for the
 * same reason the originals do. So this reads the REAL config values -- the
 * ESLint side by importing the config module, the vitest side off disk.
 *
 * The disk-read side strips comment lines FIRST. That is inherited defensive
 * practice from `cleanup-workflow.spec.ts:16-20` and `ppe-action.spec.ts:20-25`,
 * where the trap is live: a config whose own prose quotes the value being
 * asserted makes a naive match pass even after the REAL value has drifted.
 *
 * It is NOT live in `vitest.integration.config.mts` today, which is what an
 * earlier version of this comment claimed. That file's prose says "It includes
 * ONLY *.integration.spec.ts" and never writes an `include: ['...']` form, so
 * there is currently nothing for the stripper to catch. Kept anyway -- the cost
 * is one line and the next comment someone writes there could reintroduce the
 * trap -- but stated as prophylaxis rather than as a defence against a hazard
 * that is not there, so a reader does not go looking for it.
 *
 * "Agree" is deliberately NOT set equality (D-19). `vitest.config.mts`'s unit
 * include is wider on purpose (`{js,mjs,cjs,ts,mts,cts,jsx,tsx}`), so an equality
 * assertion against THAT pair would be permanently red. The two invariants that
 * are actually load-bearing are identity between the ESLint pair and superset
 * over the integration include, and those are what is asserted.
 *
 * The guard's honest limitation: it compares EXTENSION SETS, not whole globs. A
 * drift in the directory portion -- `**\/*.spec.{ts,mts,cts}` narrowed to a
 * project-relative `src/...` form that matches nothing -- is invisible here.
 * That class is closed elsewhere: comment-locked in `eslint.config.mjs`'s GLOB
 * FRAME header, and proven live by `lint-rules.spec.ts`, which lints real
 * in-tree paths through the ESLint Node API rather than reasoning about globs.
 */

// Three levels up from `src/*.spec.ts`: `src/` -> `packages/github-cache/` ->
// `packages/` -> the workspace root. Never `__dirname`, never `process.cwd()`:
// the house convention, and its reason is invocation-independence -- a
// cwd-relative read resolves differently depending on the directory the runner
// was started from.
//
// NOT because the rule this file guards would ban it, which is what this comment
// used to claim. Measured: `process.cwd()` at a unit spec path reports nothing,
// because no selector reaches a CALL on `process`. CORR-06 is about deriving an
// expectation from the running MACHINE; the working directory is a property of
// the invocation.
const WORKSPACE_ROOT_URL = new URL('../../../', import.meta.url);

interface FlatConfigObject {
  readonly files?: readonly string[];
  readonly ignores?: readonly string[];
  readonly rules?: Readonly<Record<string, unknown>>;
}

// Q6's recommended route: a dynamic import through a NON-LITERAL specifier.
// TypeScript types that as `any` and does not try to resolve it, which a static
// import would fail to do under `nodenext` -- `eslint.config.mjs` has no
// declaration file and `allowJs` is unset, so a static import breaks `typecheck`
// rather than this spec. Importing beats the disk-read fallback here because it
// yields the REAL evaluated array, so a glob assembled at runtime, or a config
// object placed where a later one overrides it, cannot hide behind matching
// source text.
//
// The `.catch` is attached AT CREATION and that placement is the point. This
// import starts at module evaluation, but the only consumer is the `beforeAll`
// below, so without a handler here the rejection is unhandled for at least one
// turn -- and vitest surfaces that as a worker-level unhandled rejection rather
// than as a clean failure attributed to this hook. A guard whose whole job is
// mechanical enforcement failing in the least attributable way available is the
// exact opposite of what the hook's own comment is trying to achieve. Rethrowing
// keeps the hook failing (the handler does not swallow), and names the file.
const eslintConfigModule = (
  import(new URL('eslint.config.mjs', WORKSPACE_ROOT_URL).href) as Promise<{
    default: readonly FlatConfigObject[];
  }>
).catch((error: unknown) => {
  throw new Error(`failed to load the root eslint.config.mjs: ${error}`);
});

let flatConfig: readonly FlatConfigObject[] = [];

// The await is hoisted OUT of every test's budget on purpose, and this hook must
// not be tidied back into a top-level await inside the tests.
//
// Resolving that import pulls in the whole ESLint toolchain -- @eslint/js,
// typescript-eslint's parser and plugin, the comments plugin. Measured at ~1000ms
// on an idle workstation here. Awaited inside a test, that one-time cost lands on
// whichever test happens to run FIRST, so a slowdown under CPU contention --
// `nx run-many -t typecheck,test`, or a CI runner with a dogfooded background
// sidecar -- times that test out. The symptom is a FLAKY failure at an arbitrary
// location rather than an honest "the import is slow", which is the worst possible
// shape for a guard whose entire job is mechanical enforcement: the first red run
// teaches everyone to re-run instead of read. Paid here, every assertion below is
// synchronous and measures the config, not the toolchain boot.
//
// NO explicit timeout argument, and that is the considered value rather than an
// omission. A `beforeAll` hook is budgeted by `hookTimeout`, which defaults to
// 10_000ms -- `resolved.hookTimeout ??= resolved.browser.enabled ? 3e4 : 1e4`,
// vitest 4.1.10. It is NOT the 5_000ms an earlier version of this comment cited:
// 5_000 is `testTimeout`, the per-TEST budget, i.e. the budget that applied BEFORE
// this hoist existed -- it describes the bug the hoist fixed, not the budget the
// fixed code runs under. Against a ~1000ms boot the untouched default is already
// 10x headroom, the normal margin for a contention flake, so the explicit 30_000
// this hook used to carry bought no margin that matters and tripled the time a
// genuinely wedged config import takes to fail.
//
// Deliberately NOT fixed by raising `testTimeout` in `vitest.config.mts`: that
// would mask this whole class for every test in the repo.
beforeAll(async () => {
  ({ default: flatConfig } = await eslintConfigModule);
});

function banConfigObject(): FlatConfigObject {
  // Non-vacuity: if the hook above never ran, `flatConfig` is still the empty
  // default and the length assertion below fails rather than passing on nothing.
  const banObjects = flatConfig.filter(
    (entry) => entry?.rules?.['no-restricted-syntax'] !== undefined,
  );

  // Exactly one. Two objects configuring the ban would mean the later silently
  // overrides the earlier, and reading either one in isolation would be wrong.
  expect(
    banObjects,
    'expected exactly ONE eslint.config.mjs object to configure no-restricted-syntax',
  ).toHaveLength(1);

  return banObjects[0];
}

/**
 * The trailing brace group of a glob, as a sorted extension list.
 * `'**\/*.spec.{ts,mts,cts}'` -> `['cts', 'mts', 'ts']`. Anchored at the END on
 * purpose: the integration include carries a SECOND brace group at the front
 * (`{src,tests}/`), and an unanchored match would return that directory list
 * instead and then compare it against extensions.
 */
function extensionsOf(glob: string, label: string): string[] {
  const trailingGroup = /\{([^{}]+)\}$/.exec(glob);

  expect(
    trailingGroup,
    `${label}: expected the glob "${glob}" to END in a {ext,ext} group. If the pattern legitimately changed shape, this parser must change with it -- silently returning an EMPTY set here would make every assertion below pass trivially.`,
  ).not.toBeNull();

  return (trailingGroup?.[1] ?? '')
    .split(',')
    .map((extension) => extension.trim())
    .filter((extension) => extension.length > 0)
    .sort();
}

// The vitest side is read off disk rather than imported, and that is a measured
// call rather than laziness (Q7): both vitest configs export a FUNCTION that
// evaluates `__dirname` when called, and Vitest's ESM transform does not inject
// that CommonJS global for a `.mts` module imported from a spec. The import
// fails immediately and there is nothing to gain by retrying it.
const integrationConfigSource = readFileSync(
  new URL('../vitest.integration.config.mts', import.meta.url),
  'utf8',
);

const integrationConfigCode = integrationConfigSource
  .split('\n')
  .filter((line) => !line.trim().startsWith('//'))
  .join('\n');

describe('the ESLint ban scope cannot drift from the vitest partition (LINT-02, D-19)', () => {
  it('configures the ban in ONE object with ignores a SIBLING of files (D-17)', () => {
    const banConfig = banConfigObject();

    // Structural proof of D-17, not a reading of the source text. An `ignores`
    // hoisted into its own object would leave THIS object with `files` and no
    // `ignores` -- and would globally un-lint every integration spec instead of
    // exempting them from the ban alone.
    expect(banConfig.files).toBeDefined();
    expect(banConfig.ignores).toBeDefined();
    expect(banConfig.files).toHaveLength(1);
    expect(banConfig.ignores).toHaveLength(1);
  });

  it('applies the ban to exactly the extension set it exempts', () => {
    const banConfig = banConfigObject();
    const banned = extensionsOf(banConfig.files?.[0] ?? '', 'ESLint files');
    const exempt = extensionsOf(banConfig.ignores?.[0] ?? '', 'ESLint ignores');

    // Non-vacuity: two empty sets are trivially identical, so an unparseable
    // glob must fail HERE rather than passing the comparison below.
    expect(
      banned.length,
      'the ESLint files glob yielded no extensions',
    ).toBeGreaterThan(0);

    // Identity, in this direction, IS the E5 inversion bug: an exemption
    // narrower than the ban bans a legitimate integration platform read.
    expect(exempt).toEqual(banned);
  });

  it('covers every extension the integration vitest config includes', () => {
    const banConfig = banConfigObject();
    const banned = extensionsOf(banConfig.files?.[0] ?? '', 'ESLint files');
    // The WHOLE array, never just its first element. `include` IS an array, and
    // the previous `\[\s*'([^']+)'` capture read element zero and stopped. A
    // second entry -- `include: ['{src,tests}/**/*.integration.spec.{ts,mts,cts}',
    // 'e2e/**/*.integration.spec.tsx']` -- would have been invisible here, so
    // "no integration spec can ever be linted as a unit spec" would have been
    // asserted against a SUBSET of the integration suite while reading as fully
    // checked. That is the same class of partial read this file's own header
    // warns about, one level down.
    const arrayMatch = /include:\s*\[([^\]]*)\]/.exec(integrationConfigCode);
    const globs = [...(arrayMatch?.[1] ?? '').matchAll(/'([^']+)'/g)].map(
      (match) => match[1],
    );

    expect(
      globs.length,
      'could not read the include globs out of vitest.integration.config.mts',
    ).toBeGreaterThan(0);

    // Union across every glob. `extensionsOf` still asserts that EACH one ends
    // in a brace group, so a second entry written in some other shape fails
    // loudly here rather than contributing an empty set to the union.
    const integration = [
      ...new Set(
        globs.flatMap((glob) =>
          extensionsOf(glob, 'vitest integration include'),
        ),
      ),
    ];

    expect(
      integration.length,
      'the integration include globs yielded no extensions',
    ).toBeGreaterThan(0);

    // SUPERSET, never equality. The per-item message is what makes a failure
    // attributable to the one extension that drifted (the docs-trust.spec.ts:49-55
    // form) rather than to an opaque array mismatch.
    for (const extension of integration) {
      expect(
        banned,
        `an *.integration.spec.${extension} would be linted as a UNIT spec: the ESLint scope covers ${banned.join(', ')} and the integration vitest config includes ${extension}`,
      ).toContain(extension);
    }
  });
});

describe('the workspace root has no src/ or lib/ directory (D-08)', () => {
  // The mechanical half of a lock whose stated home cannot carry it. D-08 says
  // to comment-lock this at the plugin registration in `nx.json`, but `nx.json`
  // is strict JSON with zero comments and has no vehicle for a reason. So the
  // lock lives in two places: the prose half in `eslint.config.mjs`'s header,
  // and these two lines.
  //
  // Do not delete this as paranoia. `@nx/eslint`'s `getProjectUsingESLintConfig`
  // returns `null` for the root project precisely BECAUSE neither directory
  // exists; creating one flips that and silently adds a SECOND lint target,
  // changing `hash_project_config` and rotating every task hash in the middle of
  // the Phase 8 cross-OS parity investigation. A comment in a file nobody opens
  // while creating a root directory is not a lock; this is.
  // `statSync(..., { throwIfNoEntry: false })?.isDirectory()`, not `existsSync`.
  // `getProjectUsingESLintConfig` flips on a `src`/`lib` DIRECTORY, and
  // `existsSync` is also true for a plain FILE named `src` or `lib` at the root
  // -- which would fail this lock for a reason the lock does not care about, and
  // send whoever hits it looking for a hash rotation that is not happening. The
  // `?.` is what handles the absent case: `throwIfNoEntry: false` returns
  // undefined rather than throwing, so `undefined?.isDirectory()` is undefined
  // and the explicit `=== true` narrows all three states to the one boolean this
  // assertion is about.
  it.each(['src', 'lib'])(
    'has no %s/ directory at the workspace root',
    (directory) => {
      const entry = statSync(new URL(directory, WORKSPACE_ROOT_URL), {
        throwIfNoEntry: false,
      });

      expect(
        entry?.isDirectory() === true,
        `a root ${directory}/ directory would add a second inferred lint target and rotate every Nx task hash (D-08)`,
      ).toBe(false);
    },
  );
});
