import { readFileSync, statSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';

/**
 * LINT-02 / D-19 / D-08 scope-drift guard for the ambient-platform-read ban.
 *
 * THE INVARIANT: a file runs as a unit test IF AND ONLY IF the ban applies to it.
 *
 * It is spread across FIVE globs in three files that nothing links, so they drift
 * independently and the drift is SILENT in both directions:
 *
 *   eslint.config.mjs  files    what the ban applies to
 *   eslint.config.mjs  ignores  what the ban exempts
 *   vitest.config.mts  include  what the unit runner collects
 *   vitest.config.mts  exclude  what the unit runner hands to the other target
 *   vitest.integration.config.mts include  what "an integration spec" means
 *
 * An exemption NARROWER than the ban makes an integration spec's LEGITIMATE
 * platform read fail lint. A ban narrower than the unit include lets a unit spec
 * slip the ban entirely. Both read as a green build until someone writes the file
 * that trips them.
 *
 * AMENDED 2026-07-27 (review finding ME-01). The invariants below used to be
 * (a) ESLint `files` == ESLint `ignores` and (b) `files` superset-of the
 * integration include. (a) is the one that had to go: it forced the two ESLint
 * globs to be SYMMETRIC, and symmetry is wrong here. Under (a) the ban covered
 * `**\/*.spec.{ts,mts,cts}` while the unit runner collected
 * `{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}` -- so `*.test.ts`, `*.spec.tsx`
 * and `*.spec.cjs` ran as unit tests with the ban silently OFF, and (a) could not
 * express the difference. See D-16/D-19 in 07-CONTEXT.md for the amendment.
 *
 * The two globs are now deliberately ASYMMETRIC, and that asymmetry is the whole
 * point rather than an oversight to tidy up. Widening `ignores` to match `files`
 * opens a NEW hole in the other direction: `foo.integration.spec.tsx` is not
 * collected by the integration runner ({ts,mts,cts} only) and its `.tsx` is not
 * caught by the unit runner's exclude either, so it runs as a UNIT test -- and a
 * widened `ignores` would exempt it from the ban. `ignores` must therefore track
 * the unit runner's EXCLUDE, never its include.
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
 * The guard's honest limitation: it compares the BASENAME pattern -- the name
 * family and the extension set -- not whole globs. The path ANCHOR is dropped on
 * purpose, because it legitimately differs: ESLint matches relative to the config
 * file's directory (the workspace root, so `**\/`) while vitest matches relative
 * to the package root (`{src,tests}/**\/`). Comparing whole globs would be
 * permanently red over a difference that means nothing. The cost is that a drift
 * in the directory portion -- `**\/*.spec.{ts,mts,cts}` narrowed to a
 * project-relative `src/...` form that matches NOTHING -- is invisible here. That
 * class is closed elsewhere: comment-locked in `eslint.config.mjs`'s GLOB FRAME
 * header, and proven live by `lint-rules.spec.ts`, which lints real in-tree paths
 * through the ESLint Node API rather than reasoning about globs.
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
 * A spec glob's BASENAME pattern, split into the two things that carry meaning:
 * the NAME family and the EXTENSION set.
 *
 *   `'{src,tests}/**\/*.{test,spec}.{ts,tsx}'`
 *     -> { names: ['spec', 'test'],        extensions: ['ts', 'tsx'] }
 *   `'**\/*.integration.spec.{ts,mts,cts}'`
 *     -> { names: ['integration.spec'],    extensions: ['cts', 'mts', 'ts'] }
 *
 * Both fields are SORTED SETS, so a reordered brace group is not a false red --
 * `{spec,test}` and `{test,spec}` select the same files and must compare equal.
 */
interface SpecGlobShape {
  readonly names: string[];
  readonly extensions: string[];
}

function sortedSetOf(commaGroup: string): string[] {
  return [...new Set(commaGroup.split(',').map((part) => part.trim()))]
    .filter((part) => part.length > 0)
    .sort();
}

function specGlobShape(glob: string, label: string): SpecGlobShape {
  // Everything up to the final `/` is the path anchor and is deliberately
  // discarded -- see the header. What remains must be `*.<names>.{ext,ext}`.
  const basename = glob.slice(glob.lastIndexOf('/') + 1);
  // `[^{}]` on the extension group is load-bearing: it stops the greedy
  // `(.+)` from swallowing the extension group when the name part is itself a
  // brace group, which is exactly the `*.{test,spec}.{js,...}` shape.
  const parsed = /^\*\.(.+)\.\{([^{}]+)\}$/.exec(basename);

  expect(
    parsed,
    `${label}: expected the glob "${glob}" to have a basename of the form *.<names>.{ext,ext}. If the pattern legitimately changed shape, this parser must change with it -- silently returning EMPTY sets here would make every assertion below pass trivially.`,
  ).not.toBeNull();

  return {
    // `{test,spec}` is a brace group; `integration.spec` is a literal. Stripping
    // the optional braces normalises both to the same comma-separated form.
    names: sortedSetOf((parsed?.[1] ?? '').replace(/^\{|\}$/g, '')),
    extensions: sortedSetOf(parsed?.[2] ?? ''),
  };
}

/**
 * The union of several globs' shapes, because every one of these keys is an
 * ARRAY. Reading only element zero was review finding ME-04: a second entry
 * would have been invisible and the invariant would have been asserted against a
 * SUBSET while reading as fully checked.
 */
function unionShape(globs: readonly string[], label: string): SpecGlobShape {
  const shapes = globs.map((glob) => specGlobShape(glob, label));

  return {
    names: sortedSetOf(shapes.flatMap((shape) => shape.names).join(',')),
    extensions: sortedSetOf(
      shapes.flatMap((shape) => shape.extensions).join(','),
    ),
  };
}

// The vitest side is read off disk rather than imported, and that is a measured
// call rather than laziness (Q7): both vitest configs export a FUNCTION that
// evaluates `__dirname` when called, and Vitest's ESM transform does not inject
// that CommonJS global for a `.mts` module imported from a spec. The import
// fails immediately and there is nothing to gain by retrying it.
function strippedConfigSource(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n');
}

const unitConfigCode = strippedConfigSource('../vitest.config.mts');
const integrationConfigCode = strippedConfigSource(
  '../vitest.integration.config.mts',
);

/**
 * Every QUOTED glob inside a `<key>: [ ... ]` array.
 *
 * Quoted is the operative word for the unit `exclude`, which spreads
 * `...configDefaults.exclude` as a bare identifier alongside its one literal.
 * The spread carries no quotes so it never reaches this list -- which is right:
 * it is vitest's own node_modules/dist noise, not a spec-NAME pattern, and
 * comparing it against an ESLint glob would be meaningless.
 */
function quotedGlobsIn(code: string, key: string, label: string): string[] {
  const arrayMatch = new RegExp(`${key}:\\s*\\[([^\\]]*)\\]`).exec(code);
  const globs = [...(arrayMatch?.[1] ?? '').matchAll(/'([^']+)'/g)].map(
    (match) => match[1],
  );

  expect(
    globs.length,
    `could not read any quoted ${key} glob out of ${label}`,
  ).toBeGreaterThan(0);

  return globs;
}

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

  // INVARIANT 1 (D-19 as amended): the ban applies to exactly what the unit
  // runner collects. This is the "=>" half of "runs as a unit test <=> the ban
  // applies", and it is what the superseded files-==-ignores invariant could not
  // express: that one only compared the two ESLint globs to each other, so both
  // could be narrower than the runner in lockstep and it would stay green.
  it('applies the ban to exactly what the unit runner COLLECTS (D-19 new (1))', () => {
    const banConfig = banConfigObject();
    const banned = unionShape(banConfig.files ?? [], 'ESLint files');
    const collected = unionShape(
      quotedGlobsIn(unitConfigCode, 'include', 'vitest.config.mts'),
      'vitest unit include',
    );

    // Split per field rather than one object comparison, so a failure names
    // WHICH half drifted (the docs-trust.spec.ts:49-55 form).
    expect(
      banned.names,
      `the ban covers the name family {${banned.names.join(',')}} but the unit runner collects {${collected.names.join(',')}} -- a file in the difference runs as a unit test with the ambient-platform ban silently OFF`,
    ).toEqual(collected.names);

    expect(
      banned.extensions,
      `the ban covers .{${banned.extensions.join(',')}} but the unit runner collects .{${collected.extensions.join(',')}} -- a file in the difference runs as a unit test with the ambient-platform ban silently OFF`,
    ).toEqual(collected.extensions);
  });

  // INVARIANT 2 (D-19 as amended): the ban exempts exactly what the unit runner
  // EXCLUDES -- deliberately NOT what it includes. Tracking the include here
  // would exempt `*.integration.spec.tsx`, which the integration runner does not
  // collect and the unit exclude does not catch, so it runs as a UNIT test. That
  // corner is unreachable by a files-==-ignores invariant, which has no term for
  // the runner at all.
  it('exempts exactly what the unit runner EXCLUDES, not what it includes (D-19 new (2))', () => {
    const banConfig = banConfigObject();
    const exempt = unionShape(banConfig.ignores ?? [], 'ESLint ignores');
    const excluded = unionShape(
      quotedGlobsIn(unitConfigCode, 'exclude', 'vitest.config.mts'),
      'vitest unit exclude',
    );

    expect(
      exempt.names,
      `the ban exempts the name family {${exempt.names.join(',')}} but the unit runner hands off {${excluded.names.join(',')}}`,
    ).toEqual(excluded.names);

    expect(
      exempt.extensions,
      `the ban exempts .{${exempt.extensions.join(',')}} but the unit runner hands off .{${excluded.extensions.join(',')}} -- an extension the ban exempts but the unit runner still RUNS is a unit spec with the ban off`,
    ).toEqual(excluded.extensions);
  });

  // The third leg, and what makes invariant 2 mean "the exemption IS the
  // integration suite" rather than just "the two configs happen to agree". It is
  // what the superseded superset-of-the-integration-include invariant was
  // reaching for, stated exactly: if the integration runner ever collected an
  // extension the unit runner does not hand off, that file would run under BOTH
  // targets -- and invariant 2 alone cannot see it, because it never looks at
  // the integration config.
  it('and the unit runner hands off exactly the integration suite', () => {
    const excluded = unionShape(
      quotedGlobsIn(unitConfigCode, 'exclude', 'vitest.config.mts'),
      'vitest unit exclude',
    );
    const integration = unionShape(
      quotedGlobsIn(
        integrationConfigCode,
        'include',
        'vitest.integration.config.mts',
      ),
      'vitest integration include',
    );

    expect(excluded.names).toEqual(integration.names);

    expect(
      excluded.extensions,
      `the unit runner hands off .{${excluded.extensions.join(',')}} but the integration runner collects .{${integration.extensions.join(',')}} -- a file in the difference either runs TWICE or not at all`,
    ).toEqual(integration.extensions);
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
