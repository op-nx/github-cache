// LINT-02 opt-out. ROBUST-03's subject IS that the archive lands in the OS temp
// directory, so the expectation is the running machine's tmpdir by construction --
// there is no platform to pass in, because the value under test is not a platform.
// Moving it to an integration spec would read the same tmpdir through the same
// accessor and prove nothing extra, only slower.
// eslint-disable-next-line no-restricted-imports -- ROBUST-03 asserts the archive directory IS the running machine's temp dir, so the read is the subject and not an incidental dependency; an integration spec would make the same read. Removed by VER-02, Phase 9.
import { tmpdir } from 'node:os';
import type { Hash } from './cache-key.js';
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
    const path = cacheArchivePath('abc123' as Hash);

    expect(basename(path)).toBe('nx-github-cache-abc123.tar');
  });

  it('returns an absolute path whose directory is the OS temp directory (ROBUST-03)', () => {
    const path = cacheArchivePath('abc123' as Hash);

    expect(isAbsolute(path)).toBe(true);
    expect(dirname(path)).toBe(tmpdir());
  });

  it('is byte-identical for the same hash and differs for a different hash (ROBUST-03)', () => {
    expect(cacheArchivePath('abc123' as Hash)).toBe(
      cacheArchivePath('abc123' as Hash),
    );
    expect(cacheArchivePath('abc123' as Hash)).not.toBe(
      cacheArchivePath('def456' as Hash),
    );
  });
});
