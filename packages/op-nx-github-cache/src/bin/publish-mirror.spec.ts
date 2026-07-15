import { describe, expect, it } from 'vitest';
import { BRANCH_NAME_PATTERN, filterNxCacheKeys } from './publish-mirror.js';

describe('BRANCH_NAME_PATTERN (DEFAULT_BRANCH validation)', () => {
  it.each(['main', 'release/2026.07', 'feature-branch', 'v1.2.3'])(
    'accepts plausible branch name "%s"',
    (name) => {
      expect(BRANCH_NAME_PATTERN.test(name)).toBe(true);
    },
  );

  it.each(['main\ninjected', 'has space', '\t', ''])('rejects "%s"', (name) => {
    expect(BRANCH_NAME_PATTERN.test(name)).toBe(false);
  });
});

describe('filterNxCacheKeys (repo-wide Actions cache -> genuine Nx hashes)', () => {
  it('keeps lowercase-hex Nx hashes and drops non-Nx / unsafe keys', () => {
    const keys = [
      'abc123def456', // genuine Nx hash
      'node-cache-Linux-x64-abcdef', // setup-node key: dashes + uppercase
      'setup-node-npm-cache', // non-hex
      '../../etc/passwd', // path-traversal shaped
      'ABC123', // uppercase hex -> rejected (pattern is a-f only)
      '  feedface  ', // padded, valid after trim
      '', // blank line
    ].join('\n');

    expect(filterNxCacheKeys(keys)).toEqual(['abc123def456', 'feedface']);
  });

  it('returns an empty array when no key is Nx-shaped', () => {
    expect(filterNxCacheKeys('setup-node\nLinux-build\n')).toEqual([]);
  });
});
