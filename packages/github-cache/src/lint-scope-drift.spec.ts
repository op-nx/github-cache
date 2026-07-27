import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

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
 * The disk-read side strips comment lines FIRST, and the reason is not cosmetic:
 * `vitest.integration.config.mts`'s own prose quotes the include pattern while
 * explaining it, so a naive substring match would pass even if the REAL
 * `include` value had drifted. Same discipline, same reason, as
 * `cleanup-workflow.spec.ts:16-20` and `ppe-action.spec.ts:20-25`.
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
// `packages/` -> the workspace root. Never `__dirname`, never `process.cwd()` --
// and in THIS file doubly so, since an ambient read here would be banned by the
// very rule it is guarding.
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
const eslintConfigModule = import(
  new URL('eslint.config.mjs', WORKSPACE_ROOT_URL).href
) as Promise<{ default: readonly FlatConfigObject[] }>;

async function banConfigObject(): Promise<FlatConfigObject> {
  const { default: flatConfig } = await eslintConfigModule;
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
  it('configures the ban in ONE object with ignores a SIBLING of files (D-17)', async () => {
    const banConfig = await banConfigObject();

    // Structural proof of D-17, not a reading of the source text. An `ignores`
    // hoisted into its own object would leave THIS object with `files` and no
    // `ignores` -- and would globally un-lint every integration spec instead of
    // exempting them from the ban alone.
    expect(banConfig.files).toBeDefined();
    expect(banConfig.ignores).toBeDefined();
    expect(banConfig.files).toHaveLength(1);
    expect(banConfig.ignores).toHaveLength(1);
  });

  it('applies the ban to exactly the extension set it exempts', async () => {
    const banConfig = await banConfigObject();
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

  it('covers every extension the integration vitest config includes', async () => {
    const banConfig = await banConfigObject();
    const banned = extensionsOf(banConfig.files?.[0] ?? '', 'ESLint files');
    const includeMatch = /include:\s*\[\s*'([^']+)'/.exec(
      integrationConfigCode,
    );

    expect(
      includeMatch,
      'could not read the include glob out of vitest.integration.config.mts',
    ).not.toBeNull();

    const integration = extensionsOf(
      includeMatch?.[1] ?? '',
      'vitest integration include',
    );

    expect(
      integration.length,
      'the integration include glob yielded no extensions',
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
  it.each(['src', 'lib'])(
    'has no %s/ directory at the workspace root',
    (directory) => {
      expect(
        existsSync(new URL(directory, WORKSPACE_ROOT_URL)),
        `a root ${directory}/ directory would add a second inferred lint target and rotate every Nx task hash (D-08)`,
      ).toBe(false);
    },
  );
});
