import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cacheArchivePath } from './cache-archive-path.js';

// ROBUST-03, non-vacuous: the expected file name below is spelled out as a string
// literal ON PURPOSE, not rebuilt from the same `nx-github-cache-${hash}.tar`
// template the implementation uses. A reconstructed expectation would still pass
// after a cosmetic rename of the path template -- which is exactly the change that
// silently MISSes every @actions/cache restore, because the toolkit version-hashes
// the literal path string (Pitfall 7). Pinning the literal here is the only
// assertion that fails on that rename instead of failing silently in CI. This is
// the same discipline as server.spec.ts's MAX_CACHE_BODY_BYTES pinned-value test.
describe('cacheArchivePath', () => {
  it('produces exactly the file name nx-github-cache-abc123.tar for hash abc123 (ROBUST-03)', () => {
    const path = cacheArchivePath('abc123');

    expect(basename(path)).toBe('nx-github-cache-abc123.tar');
  });

  it('returns an absolute path whose directory is the OS temp directory (ROBUST-03)', () => {
    const path = cacheArchivePath('abc123');

    expect(isAbsolute(path)).toBe(true);
    expect(dirname(path)).toBe(tmpdir());
  });

  it('is byte-identical for the same hash and differs for a different hash (ROBUST-03)', () => {
    expect(cacheArchivePath('abc123')).toBe(cacheArchivePath('abc123'));
    expect(cacheArchivePath('abc123')).not.toBe(cacheArchivePath('def456'));
  });
});
