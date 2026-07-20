import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  cacheKeyFor,
  CACHE_KEY_PREFIX,
  HASH_PATTERN,
  isServerProducedKey,
} from './cache-key.js';

/**
 * Count authored occurrences of `needle` in a source file, ignoring comment
 * lines (a trimmed line starting with `*`, `//`, or `/*`). Used for the
 * single-source count assertions: the authored prefix literal must live in
 * exactly one production place (TRUST-08 / T-05-08-02).
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
    expect(cacheKeyFor('deadbeef')).toBe('nx-cache-deadbeef');
  });

  it('produces a key that isServerProducedKey admits for any hex hash', () => {
    for (const hash of ['0', 'abc123', 'deadbeef', 'f'.repeat(512)]) {
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
});
