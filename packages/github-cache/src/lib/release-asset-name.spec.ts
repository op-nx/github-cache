import { readFileSync } from 'node:fs';
import type { Hash } from './cache-key.js';
import { describe, expect, it } from 'vitest';
import {
  CACHE_OS_VALUES,
  cachePlatform,
  isServerProducedAssetName,
  releaseAssetName,
} from './release-asset-name.js';

// CORR-01 / TEST-05, non-vacuous: the expected asset names below are spelled out
// as string literals ON PURPOSE, not rebuilt from the same `${hash}-${platform}`
// template the implementation uses. A reconstructed expectation would still pass
// after a cosmetic edit to the separator, the slot ordering, or the platform
// casing -- which is exactly the change that silently MISSes every cross-OS
// Release read, because Phase 4's publisher derives asset names from this SAME
// helper. Pinning the literal here is the only assertion that fails on that drift
// instead of failing silently against live GitHub. Same discipline as
// cache-archive-path.spec.ts:6-13.
describe('releaseAssetName (CORR-01)', () => {
  it('produces exactly abc123-linux for hash abc123 on linux (CORR-01)', () => {
    expect(releaseAssetName('abc123' as Hash, 'linux')).toBe('abc123-linux');
  });

  it('is byte-identical for the same hash and platform pair (CORR-01)', () => {
    expect(releaseAssetName('abc123' as Hash, 'linux')).toBe(
      releaseAssetName('abc123' as Hash, 'linux'),
    );
  });

  it('differs for the same hash under a different platform (CORR-01)', () => {
    expect(releaseAssetName('abc123' as Hash, 'linux')).not.toBe(
      releaseAssetName('abc123' as Hash, 'win32'),
    );
  });

  it('resolves the running platform when called with no platform argument (CORR-01)', () => {
    expect(releaseAssetName('abc123' as Hash)).toBe(
      releaseAssetName('abc123' as Hash, process.platform),
    );
  });
});

describe('cachePlatform (CORR-01)', () => {
  // G4, non-vacuous: all three mapped branches PLUS the default fall-through are
  // asserted with literal expectations. The injectable platform parameter is what
  // lets one CI leg assert every OS mapping -- a positive-only same-platform test
  // would still pass if the mapping were silently wrong for the other two, which
  // would re-namespace the whole store and invalidate every published asset.
  it.each([
    ['win32', 'windows'],
    ['darwin', 'macos'],
    ['linux', 'linux'],
    ['freebsd', 'linux'],
  ])('maps %s to %s (CORR-01)', (platform, expected) => {
    expect(cachePlatform(platform as NodeJS.Platform)).toBe(expected);
  });

  it('resolves the running platform when called with no argument (CORR-01)', () => {
    expect(cachePlatform()).toBe(cachePlatform(process.platform));
  });
});

describe('isServerProducedAssetName server-produced <hash>-<os> guard', () => {
  // The exact accept/reject sets are pinned so the cleanup asset-name narrowing
  // cannot silently widen. Mirrors the isServerProducedKey discipline: only a valid
  // lowercase-hex hash + a known OS discriminator is ours.
  it.each([
    'abc123-linux',
    'deadbeef-windows',
    '0-macos',
    `${'a'.repeat(512)}-linux`,
  ])('accepts the genuine asset name %s', (name) => {
    expect(isServerProducedAssetName(name)).toBe(true);
  });

  it.each([
    'ABC123-linux',
    'abc123-Linux',
    'abc123-freebsd',
    'abc123',
    '-linux',
    'abc123-',
    'xyz-linux',
    'notes-backup',
  ])('rejects the non-server-produced name %s', (name) => {
    expect(isServerProducedAssetName(name)).toBe(false);
  });

  it('round-trips with releaseAssetName so the accepter never drifts from the producer', () => {
    for (const platform of ['win32', 'darwin', 'linux'] as const) {
      expect(
        isServerProducedAssetName(releaseAssetName('abc123' as Hash, platform)),
      ).toBe(true);
    }
  });

  it('validates the OS half against the single-sourced CACHE_OS_VALUES', () => {
    expect(CACHE_OS_VALUES).toEqual(['windows', 'macos', 'linux']);
  });
});

// G1 folded into this spec rather than a fourth spec file (03-PATTERNS.md Planner
// Note 4): both guards are "the cross-OS key scheme must not silently drift", so
// one file is fewer moving parts.
describe('.gitattributes LF normalisation guard (TEST-05)', () => {
  // Non-vacuous: read the repo-root .gitattributes from disk and assert the
  // LF-normalisation directive is present. Without `* text=auto eol=lf`, a Windows
  // checkout (runners default to core.autocrlf=true) gets CRLF and computes
  // different Nx content hashes than Linux/macOS, diverging the key space cross-OS
  // -- the exact invariant CORR-01 depends on. Path resolved via import.meta.url
  // (the pinned-deps.spec.ts idiom), NOT __dirname and NOT process.cwd().
  const gitattributes = readFileSync(
    new URL('../../../../.gitattributes', import.meta.url),
    'utf8',
  );

  it('forces LF line endings repo-wide so cross-OS Nx hashes stay identical (TEST-05)', () => {
    expect(gitattributes).toContain('* text=auto eol=lf');
  });
});
