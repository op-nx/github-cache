import { readFileSync } from 'node:fs';
import { CACHE_KEY_PREFIX, HASH_PATTERN, type Hash } from './cache-key.js';
import { describe, expect, it } from 'vitest';
import {
  CACHE_OS_VALUES,
  cachePlatform,
  isCurrentAssetName,
  isLegacyOsSuffixedAssetName,
  isServerProducedAssetName,
  releaseAssetName,
} from './release-asset-name.js';

// CORR-02 / TEST-05, non-vacuous: the expected asset names below are spelled out
// as string literals ON PURPOSE, not rebuilt from the same prefix-plus-hash
// composition the implementation uses. A reconstructed expectation would still pass
// after a cosmetic edit to the prefix, the separator, or the slot ordering -- which
// is exactly the change that silently MISSes every mirror read, because Phase 4's
// publisher derives asset names from this SAME helper. Pinning the literal here is
// the only assertion that fails on that drift instead of failing silently against
// live GitHub. Same discipline as cache-archive-path.spec.ts:6-13.
describe('releaseAssetName determinism and injectivity (CORR-02)', () => {
  // These two cases were re-authored, not edited, when CORR-02 deleted the
  // `platform` parameter. Their PREDECESSORS asserted byte-identity "for the same
  // hash and platform PAIR" and difference "for the same hash under a DIFFERENT
  // platform" -- claims whose subject no longer exists, and the second of which is
  // now the exact OPPOSITE of the truth. What survives from that pair is the
  // property the platform argument was incidental to: the name is a pure, injective
  // function of the hash alone.
  it('is byte-identical across calls for the same hash (CORR-02)', () => {
    expect(releaseAssetName('abc123' as Hash)).toBe(
      releaseAssetName('abc123' as Hash),
    );
  });

  it('differs for a different hash, so distinct hashes never share an asset (CORR-02)', () => {
    // The replacement for the deleted differs-under-a-different-platform case. With
    // the OS gone, the hash is the ONLY thing separating two assets, so collision
    // freedom rests entirely on this -- a name that ignored part of the hash would
    // serve one task's archive for another's and the byte comparison would pass.
    expect(releaseAssetName('abc123' as Hash)).not.toBe(
      releaseAssetName('abc124' as Hash),
    );
  });
});

// CORR-02, the RED half -- authored one commit BEFORE the rename it pins, so the
// irreversible one-commit rename wave carries as little unrecoverable work as
// possible. These three cases are RED on purpose against today's implementation,
// which still folds the OS discriminator into the name.
//
// The expectations are spelled out as literals for exactly the reason the doc block
// at the top of this file gives, and that reasoning is not paraphrased away here:
// rebuilding the expectation as `${CACHE_KEY_PREFIX}${hash}` would survive a
// cosmetic edit to the separator or the slot ordering -- which is precisely the
// change that silently MISSes every cross-OS Release read, because the publisher
// derives its names from this SAME helper. Pinning the literal is the only
// assertion that fails on that drift instead of failing silently against live
// GitHub.
describe('releaseAssetName post-rename OS-free name (CORR-02)', () => {
  it('produces exactly nx-cache-abc123 for hash abc123, on every OS (CORR-02)', () => {
    expect(releaseAssetName('abc123' as Hash)).toBe('nx-cache-abc123');
  });

  it('produces exactly nx-cache-0 for the minimum-length hash 0 (CORR-02)', () => {
    // The same minimum-length hash the cleanup filter's accept set pins, so the
    // producer and the accepter are pinned against one shared boundary case.
    expect(releaseAssetName('0' as Hash)).toBe('nx-cache-0');
  });

  it('folds NO member of CACHE_OS_VALUES into the name (CORR-02)', () => {
    const name = releaseAssetName('abc123' as Hash);

    // The WHOLE tuple, never "the OS this machine is not". A machine-relative
    // expectation is banned by LINT-02 at this path and would sample at a rate of
    // ZERO under the ubuntu-only `test` target anyway.
    for (const os of CACHE_OS_VALUES) {
      expect(name).not.toContain(os);
    }
  });

  it('takes exactly ONE parameter, so a platform argument cannot creep back (D-04)', () => {
    // The STRUCTURAL half of D-04: the parameter was DELETED, not defaulted away,
    // and that deletion is what removed two of the three CORR-05 sites. A
    // reintroduced `platform = process.platform` would leave every behavioural
    // assertion above GREEN -- the default resolves to the running platform and the
    // one-argument calls read identically -- so only arity catches it.
    // Function.length counts parameters BEFORE the first default, which is the same
    // precedent dogfood-body.spec.ts and select-backend.spec.ts already rely on.
    expect(releaseAssetName.length).toBe(1);
  });
});

describe('cachePlatform (CORR-01)', () => {
  // G4, non-vacuous: all three mapped branches PLUS the default fall-through are
  // asserted with literal expectations. The injectable platform parameter is what
  // lets one CI leg assert every OS mapping -- a positive-only same-platform test
  // would still pass if the mapping were silently wrong for the other two, which
  // used to re-namespace the whole store and now mislabels every mirrored asset.
  //
  // The no-argument default-resolution case that used to close this describe LEFT
  // in the CORR-02 commit together with its `eslint-disable-next-line` directive and
  // its `CORR_05_SITES` row. It was not deleted: plan 10-06 MOVED it to
  // `release-asset-name.integration.spec.ts`, where LINT-02's `ignores` exempts the
  // path and the two-leg matrix actually samples the running platform instead of
  // asserting against the one OS the `test` target ever runs on. This is the DELETE
  // half of that two-commit move; the ADD half is already committed.
  it.each([
    ['win32', 'windows'],
    ['darwin', 'macos'],
    ['linux', 'linux'],
    ['freebsd', 'linux'],
  ])('maps %s to %s (CORR-01)', (platform, expected) => {
    expect(cachePlatform(platform as NodeJS.Platform)).toBe(expected);
  });
});

describe('isServerProducedAssetName accepts BOTH name families (RETAIN-04)', () => {
  // The exact accept/reject sets are pinned so the cleanup asset-name narrowing
  // cannot silently widen. Mirrors the isServerProducedKey discipline: only a valid
  // lowercase-hex hash under one of the two known shapes is ours.
  //
  // The LEGACY entries below are the pre-rename accept set, UNCHANGED. That is the
  // point of listing them rather than replacing them: RETAIN-04's widening must be
  // purely ADDITIVE, so every name the single-branch filter accepted has to still
  // be accepted or the 122 already-published assets stop being prunable.
  it.each([
    // CURRENT shape (the new branch).
    'nx-cache-abc123',
    'nx-cache-0',
    'nx-cache-deadbeef',
    `${CACHE_KEY_PREFIX}${'a'.repeat(512)}`,
    // LEGACY shape -- the pre-rename accept set, verbatim.
    'abc123-linux',
    'deadbeef-windows',
    '0-macos',
    `${'a'.repeat(512)}-linux`,
  ])('accepts the genuine asset name %s', (name) => {
    expect(isServerProducedAssetName(name)).toBe(true);
  });

  it.each([
    // Pre-rename rejects, verbatim -- none of them may become acceptable.
    'ABC123-linux',
    'abc123-Linux',
    'abc123-freebsd',
    'abc123',
    '-linux',
    'abc123-',
    'xyz-linux',
    'notes-backup',
    // Near-misses the CURRENT branch introduces, and the reason it is not a cheap
    // `startsWith`: a prefixed name with a non-hex, empty, over-length or
    // OS-suffixed remainder is NOT ours, and this filter feeds a DELETE path.
    'nx-cache-',
    'nx-cache-ABC123',
    'nx-cache-h1',
    'nx-cache-abc123-linux',
    'nx-cache-abc123.tar.gz',
    'nxcache-abc123',
    `${CACHE_KEY_PREFIX}${'a'.repeat(513)}`,
    // The PoC-era family. Deliberately NOT admitted by either branch (D-08): the
    // shape is indistinguishable from a foreign asset dropped into a genuine shard,
    // so its 50 shipped instances are accepted dead weight, not a third branch.
    'abc123.tar.gz',
  ])('rejects the non-server-produced name %s', (name) => {
    expect(isServerProducedAssetName(name)).toBe(false);
  });

  it('round-trips with releaseAssetName so the accepter never drifts from the producer', () => {
    // Re-authored for the one-argument signature. Its predecessor looped three
    // platforms because the producer took one; with the name OS-free the axis that
    // matters is the HASH -- including both HASH_PATTERN boundaries, since the
    // accepter re-tests the remainder against that same pattern and an off-by-one
    // there would reject a name the producer had just written.
    for (const hash of ['0', 'abc123', 'deadbeef', 'a'.repeat(512)] as Hash[]) {
      expect(isServerProducedAssetName(releaseAssetName(hash))).toBe(true);
    }
  });

  it('validates the legacy OS half against the single-sourced CACHE_OS_VALUES', () => {
    expect(CACHE_OS_VALUES).toEqual(['windows', 'macos', 'linux']);
  });
});

/**
 * RETAIN-05(b): the two accept branches are MUTUALLY EXCLUSIVE, asserted DIRECTLY on
 * the two named predicates rather than inferred through the composed export -- which
 * is why both are exported from an otherwise internal module. Asserting through
 * `isServerProducedAssetName` alone would be strictly weaker: an OR is true when
 * either branch is, so a name both branches claimed would be indistinguishable from
 * a name one branch claimed.
 *
 * WHY DISJOINTNESS IS ASSERTED AT ALL, given this is an OR and an overlap would not
 * change the union's verdict: the branches are the audit unit. RETAIN-04 widened a
 * DELETE filter, and the argument that the widening is ADDITIVE rests on branch B
 * being the old filter UNCHANGED. If a name could satisfy both, "which branch
 * accepted this" stops being answerable, and the additive claim stops being
 * checkable from the code.
 *
 * The three ATOMS below are the MECHANISM, and they are the part a future reader
 * most needs: disjointness is a property of the PREFIX, not of branch B's last-dash
 * split. Assert the mechanism and a prefix edit that breaks the reasoning reddens
 * HERE, at the explanation, instead of only in whichever adversarial row happens to
 * cover it.
 */
describe('the two accept branches are mutually exclusive (RETAIN-05b, T-10-01)', () => {
  it('ATOM 1: HASH_PATTERN does not match a lone dash', () => {
    // Reason 1 and reason 2 both rest on this. If the hash space ever admitted a
    // dash, branch A's remainder could contain one and the whole argument below
    // collapses.
    expect(HASH_PATTERN.test('-')).toBe(false);
  });

  it('ATOM 2: CACHE_KEY_PREFIX contains a dash', () => {
    expect(CACHE_KEY_PREFIX).toContain('-');
  });

  it('ATOM 3: that dash is the prefix LAST character', () => {
    expect(CACHE_KEY_PREFIX.lastIndexOf('-')).toBe(CACHE_KEY_PREFIX.length - 1);
  });

  it('MECHANISM: branch B hash half for a branch-A name is the prefix minus its trailing dash, which itself holds a dash', () => {
    // The three atoms composed into the actual argument, so the reasoning is
    // executable rather than only written down. For any name branch A accepts, the
    // whole post-prefix remainder matches HASH_PATTERN (no dash), so the LAST dash
    // of the whole name is the prefix's own trailing one -- making branch B's hash
    // half exactly the prefix minus that dash. That string contains a dash, so
    // HASH_PATTERN rejects it, so branch B rejects the name.
    const accepted = releaseAssetName('abc123' as Hash);
    const separator = accepted.lastIndexOf('-');

    expect(isCurrentAssetName(accepted)).toBe(true);
    expect(separator).toBe(CACHE_KEY_PREFIX.length - 1);
    expect(accepted.slice(0, separator)).toBe(CACHE_KEY_PREFIX.slice(0, -1));
    expect(HASH_PATTERN.test(accepted.slice(0, separator))).toBe(false);
  });

  it('MECHANISM belt: branch B rejects any dashless name outright, so even a dashless prefix would stay disjoint', () => {
    // Reason 2, independent of reason 1. Asserted through the `separator < 0` early
    // return, which is why that return is load-bearing rather than a micro-guard a
    // future reader may fold into the final expression.
    expect(isLegacyOsSuffixedAssetName('abc123')).toBe(false);
    expect(isLegacyOsSuffixedAssetName('nxcacheabc123')).toBe(false);
  });

  /**
   * The 26-case adversarial table, MEASURED (10-RESEARCH.md `### RETAIN-04`): 0
   * both-true results here AND 0 across 1.6M randomised candidates drawn from
   * `abcdef0123456789-nxcheus` -- the exact character set that can construct a
   * near-miss -- each wrapped four ways (bare, prefixed, `-linux`-suffixed, and
   * prefixed plus `-windows`).
   *
   * Every row is a name a reader might reasonably worry about: both shapes, the
   * hybrids (a prefixed name with each OS appended), both HASH_PATTERN length
   * boundaries, the bare prefix, a doubled prefix, a lone OS suffix, a trailing
   * dash, an unknown OS, uppercase variants of each half, both `.tar.gz` shapes, a
   * doubled OS suffix, the two live seed families under the new name, a prefix
   * near-miss, and an unmistakably foreign name.
   */
  const ADVERSARIAL_NAMES = [
    'nx-cache-abc123',
    'nx-cache-abc123-linux',
    'nx-cache-abc123-windows',
    'nx-cache-abc123-macos',
    'abc123-linux',
    '0-macos',
    'abc123',
    'nx-cache-',
    'nx-cache-nx-cache-abc123',
    '-linux',
    'abc123-',
    'nx-cache--linux',
    'nx-cache-abc123-freebsd',
    'nx-cache-ABC123',
    'NX-CACHE-abc123',
    'nx-cache-abc123.tar.gz',
    'abc123.tar.gz',
    `${CACHE_KEY_PREFIX}${'a'.repeat(512)}`,
    `${CACHE_KEY_PREFIX}${'a'.repeat(513)}`,
    `${'a'.repeat(512)}-linux`,
    'nx-cache-abc123-linux-linux',
    // The `cafe<run_id>` consumer-smoke seed already shipped in ci.yml, under the
    // new name -- a live name, not a hypothetical.
    'nx-cache-cafe30401077417',
    // This phase's own `feed<index><run_id>` publish seed, under the new name. It
    // MUST land in branch A: it is the one asset the Windows publish leg mirrors,
    // and OBS-05 is vacuous if cleanup cannot see it.
    'nx-cache-feed230401077417',
    'nxcache-abc123',
    'notes-backup',
    'nx-cache-0',
  ] as const;

  it('holds 26 rows, so a silently dropped row cannot shrink this proof', () => {
    // The count is pinned for the same reason the both-true total below is a COUNT
    // rather than only a per-row assertion: a per-row loop over a shortened table
    // still passes, and a table trimmed to one row would report full coverage.
    expect(ADVERSARIAL_NAMES).toHaveLength(26);
  });

  it.each([...ADVERSARIAL_NAMES])(
    'NOT both branches accept %s (RETAIN-05b)',
    (name) => {
      expect(
        isCurrentAssetName(name) && isLegacyOsSuffixedAssetName(name),
      ).toBe(false);
    },
  );

  it('pins the both-true count across the whole table to ZERO (RETAIN-05b)', () => {
    const both = ADVERSARIAL_NAMES.filter(
      (name) => isCurrentAssetName(name) && isLegacyOsSuffixedAssetName(name),
    );

    expect(both).toEqual([]);
  });

  it('the union equals exactly the names one branch accepts, so neither branch is dead', () => {
    // Non-vacuous companion to the disjointness pin: a table where BOTH branches
    // rejected everything would satisfy every assertion above. Assert each branch
    // accepts a nonempty slice of this table, and that the union is exactly the sum
    // -- which is only true because the intersection is empty.
    const currentOnly = ADVERSARIAL_NAMES.filter(isCurrentAssetName);
    const legacyOnly = ADVERSARIAL_NAMES.filter(isLegacyOsSuffixedAssetName);
    const union = ADVERSARIAL_NAMES.filter(isServerProducedAssetName);

    expect(currentOnly).toEqual([
      'nx-cache-abc123',
      `${CACHE_KEY_PREFIX}${'a'.repeat(512)}`,
      'nx-cache-cafe30401077417',
      'nx-cache-feed230401077417',
      'nx-cache-0',
    ]);
    expect(legacyOnly).toEqual([
      'abc123-linux',
      '0-macos',
      `${'a'.repeat(512)}-linux`,
    ]);
    expect(union).toHaveLength(currentOnly.length + legacyOnly.length);
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
  // -- the exact invariant CORR-02 now depends on even more directly, since one
  // asset name per hash means a diverged hash is a permanent MISS rather than a
  // per-OS namespace. Path resolved via import.meta.url (the pinned-deps.spec.ts
  // idiom), NOT __dirname and NOT process.cwd().
  const gitattributes = readFileSync(
    new URL('../../../../.gitattributes', import.meta.url),
    'utf8',
  );

  it('forces LF line endings repo-wide so cross-OS Nx hashes stay identical (TEST-05)', () => {
    expect(gitattributes).toContain('* text=auto eol=lf');
  });
});
