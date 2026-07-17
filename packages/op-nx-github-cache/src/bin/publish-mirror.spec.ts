import { describe, expect, it } from 'vitest';
import {
  actionsCachesListArgs,
  BRANCH_NAME_PATTERN,
  filterMirrorShardTags,
  filterNxCacheKeys,
} from './publish-mirror.js';

describe('actionsCachesListArgs (forces GET so gh does not POST on -f)', () => {
  it('sets the method to GET before the caches endpoint', () => {
    const args = actionsCachesListArgs('owner/repo', 'main');

    // gh flips to POST when a -f field is present unless the method is forced;
    // the caches endpoint is GET-only, so -X GET must precede everything else.
    expect(args.slice(0, 3)).toEqual(['api', '-X', 'GET']);
    expect(args).toContain('repos/owner/repo/actions/caches');
    expect(args).toContain('ref=refs/heads/main');
  });
});

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

describe("filterMirrorShardTags (only this mirror's own cache-mirror-YYYYMM releases)", () => {
  it('keeps cache-mirror-YYYYMM tags and drops unrelated or malformed ones', () => {
    const tags = [
      'cache-mirror-202607', // current mirror shard
      'cache-mirror-202512', // older mirror shard
      'v1.2.3', // a real product release -- must never be pruned
      'cache-mirror-2026', // 4 digits: not a month-shard
      'cache-mirror-20260713', // 8 digits: not a month-shard
      'nightly', // unrelated tag
      '  cache-mirror-202601  ', // padded, valid after trim
      '', // blank line
    ].join('\n');

    expect(filterMirrorShardTags(tags)).toEqual([
      'cache-mirror-202607',
      'cache-mirror-202512',
      'cache-mirror-202601',
    ]);
  });

  it('returns an empty array when the repo has no mirror shards', () => {
    expect(filterMirrorShardTags('v1.0.0\nlatest\n')).toEqual([]);
  });
});
