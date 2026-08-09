import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  cacheKeyFor,
  CACHE_KEY_PREFIX,
  HASH_PATTERN,
  isServerProducedKey,
  type Hash,
} from './cache-key.js';

/**
 * Count authored occurrences of `needle` in a source file, ignoring comment
 * lines (a trimmed line starting with `*`, `//`, or `/*`). Used for the
 * single-source count assertions: the authored prefix literal must live only in
 * the production modules the tree-walk clause below allowlists by name, and in
 * no others (TRUST-08 / T-05-08-02).
 */
function countAuthored(source: string, needle: string): number {
  const code = source
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();

      return (
        !trimmed.startsWith('*') &&
        !trimmed.startsWith('//') &&
        !trimmed.startsWith('/*')
      );
    })
    .join('\n');

  return code.split(needle).length - 1;
}

describe('isServerProducedKey admit/reject (TRUST-08)', () => {
  it('admits the prefix followed by a valid lowercase-hex hash', () => {
    expect(isServerProducedKey('nx-cache-abc123')).toBe(true);
  });

  it('admits a single hex digit suffix (run ids are all-decimal, still hex)', () => {
    expect(isServerProducedKey('nx-cache-0')).toBe(true);
  });

  it('rejects a prefix-plus-non-hex suffix (h is not in [a-f0-9]) - the D-08 hardening', () => {
    expect(isServerProducedKey('nx-cache-h1')).toBe(false);
  });

  it('rejects an uppercase-hex suffix (pattern is lowercase-hex)', () => {
    expect(isServerProducedKey('nx-cache-ABC')).toBe(false);
  });

  it('rejects the bare prefix with an empty suffix', () => {
    expect(isServerProducedKey('nx-cache-')).toBe(false);
  });

  it('rejects a key with no prefix', () => {
    expect(isServerProducedKey('unrelated-key')).toBe(false);
  });

  it('rejects a key where the prefix is not at the start', () => {
    expect(isServerProducedKey('some-nx-cache-abc')).toBe(false);
  });
});

describe('cacheKeyFor round-trip (TRUST-08, T-05-08-03)', () => {
  it('builds the prefix + hash key', () => {
    expect(cacheKeyFor('deadbeef' as Hash)).toBe('nx-cache-deadbeef');
  });

  it('produces a key that isServerProducedKey admits for any hex hash', () => {
    for (const hash of ['0', 'abc123', 'deadbeef', 'f'.repeat(512)] as Hash[]) {
      expect(isServerProducedKey(cacheKeyFor(hash))).toBe(true);
    }
  });
});

describe('HASH_PATTERN bounds (SRV-03, shared home)', () => {
  it('admits a 512-char lowercase-hex hash (upper bound preserved)', () => {
    expect(HASH_PATTERN.test('a'.repeat(512))).toBe(true);
  });

  it('rejects a 513-char hash (over the 512 upper bound)', () => {
    expect(HASH_PATTERN.test('a'.repeat(513))).toBe(false);
  });
});

/** The package source root, resolved from this file rather than from the cwd. */
const SOURCE_ROOT_URL = new URL('../', import.meta.url);

/** The same root spelled workspace-relative, for readable allowlist keys and messages. */
const PACKAGE_SOURCE_ROOT = 'packages/github-cache/src';

/**
 * Every non-spec TypeScript module under the package source root, as paths relative to
 * that root.
 *
 * The walk shape is `actions-cache-backend.spec.ts`'s VER-09 clause, separator
 * normalisation included -- `readdirSync(recursive: true)` yields backslashes on Windows,
 * so an unnormalised path would make the allowlist keys below match on one OS and miss on
 * the other. It is rooted at `import.meta.url` rather than at a cwd-relative literal
 * because this spec has no workspace-root chdir hook: vitest runs it with the PROJECT root
 * as the cwd, so the workspace-relative spelling would scan
 * `packages/github-cache/packages/github-cache/src` and throw ENOENT.
 */
function nonSpecModules(): string[] {
  return readdirSync(SOURCE_ROOT_URL, {
    encoding: 'utf8',
    recursive: true,
  })
    .map((entry) => entry.replaceAll('\\', '/'))
    .filter((file) => file.endsWith('.ts') && !file.endsWith('.spec.ts'));
}

describe('cache-key.ts single source (TRUST-08, T-05-08-02)', () => {
  it('authors the prefix literal exactly once within cache-key.ts (comment-stripped)', () => {
    const source = readFileSync(
      new URL('./cache-key.ts', import.meta.url),
      'utf8',
    );

    expect(countAuthored(source, CACHE_KEY_PREFIX)).toBe(1);
  });

  it('is a true leaf: imports nothing from ../backend, ../publish, ../server, or ./select-backend', () => {
    const source = readFileSync(
      new URL('./cache-key.ts', import.meta.url),
      'utf8',
    );

    expect(source).not.toMatch(/from '\.\.\/backend/);
    expect(source).not.toMatch(/from '\.\.\/publish/);
    expect(source).not.toMatch(/from '\.\.\/server/);
    expect(source).not.toMatch(/from '\.\/select-backend/);
  });

  it('authors the prefix literal in exactly the TWO allowlisted production modules (strict cross-file single source)', () => {
    // A TREE WALK, not a hand-maintained file map, and the swap is the point. The map
    // this replaced named four files, so it could see neither the copy that already
    // existed outside it nor a FIFTH module inlining the literal tomorrow -- and a
    // single-source guard that cannot see a new source is not a single-source guard.
    // The walk is the same `nonSpecModules()` shape `actions-cache-backend.spec.ts`
    // uses for its VER-09 clause; the allowlist below is what the map used to be, but
    // now it constrains a complete enumeration instead of standing in for one.
    //
    // TWO SITES, NOT ONE. The wording this replaced claimed a single production home
    // for the literal, and that was already FALSE when it was written.
    // `retention.ts` authors a byte-identical
    // `nx-cache-` as SHARD_TAG_PREFIX, deliberately and argued at its own site: the
    // Actions-cache KEY namespace and the Release month-shard TAG namespace are two
    // different GitHub APIs and two disjoint keyspaces, `isServerProducedKey` is never
    // asked about a tag and `isShardTag` never about a key, and the two should stay
    // independently changeable. That is a deliberate second copy, not drift -- so it is
    // allowlisted BY NAME with its count pinned, rather than papered over by widening
    // the total.
    //
    // The prefix governs FOUR distinct consumers (the Actions-cache key, the
    // Actions-cache enumeration filter, the Release asset name, and the cleanup accept
    // filter's current-shape branch -- RETAIN-05c). An unallowlisted third authored
    // copy means a change applied to one of them orphans the entire mirror silently.
    //
    // Spec files are deliberately EXCLUDED by the walk, and must stay excluded. The
    // pinned expectation in `release-asset-name.spec.ts` MUST author the literal --
    // that is the pinned-literal discipline, and spelling it out is what catches a
    // separator change -- so counting a spec here would redden this for entirely the
    // wrong reason.
    const ALLOWED = {
      [`${PACKAGE_SOURCE_ROOT}/lib/cache-key.ts`]: 1,
      [`${PACKAGE_SOURCE_ROOT}/lib/retention.ts`]: 1,
    };

    const authored: Record<string, number> = {};

    for (const file of nonSpecModules()) {
      const count = countAuthored(
        readFileSync(new URL(file, SOURCE_ROOT_URL), 'utf8'),
        CACHE_KEY_PREFIX,
      );

      if (count > 0) {
        authored[`${PACKAGE_SOURCE_ROOT}/${file}`] = count;
      }
    }

    expect(
      authored,
      `Exactly two production modules may author the \`${CACHE_KEY_PREFIX}\` literal: lib/cache-key.ts (the Actions-cache KEY namespace) and lib/retention.ts (the Release month-shard TAG namespace, a deliberate second copy argued at its own site). Any other module inlining it is the drift T-05-08-02 guards -- editing the literal in one place then ORPHANS THE ENTIRE MIRROR. Import CACHE_KEY_PREFIX from lib/cache-key.ts instead. If a third home is genuinely earned, allowlist it HERE in the SAME commit and record why at its site. A shell copy in a workflow cannot import the leaf and is annotated in ci.yml instead; it is outside this walk by construction.`,
    ).toEqual(ALLOWED);
  });
});
