import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  HASH_PATTERN,
  cacheKeyFor,
  isServerProducedKey,
  parseHash,
  type Hash,
} from './cache-key.js';
import { mirrorSeedHash } from './mirror-seed.js';
import {
  CACHE_OS_VALUES,
  isServerProducedAssetName,
  releaseAssetName,
  type CacheOs,
} from './release-asset-name.js';

/**
 * OBS-05 / D-12. Two disciplines are in force here and they answer DIFFERENT
 * mutations.
 *
 * 1. PINNED LITERALS, spelled out rather than rebuilt from the same template the
 *    implementation uses (release-asset-name.spec.ts's discipline, verbatim). A
 *    reconstructed expectation survives a marker-word change and a slot reordering --
 *    exactly the edits whose failure mode is a SILENT MISS in read-back.ts: nothing
 *    crashes, publish-verify simply stops finding the asset its own leg seeded.
 * 2. A TUPLE-DERIVED axis: it.each over the REAL CACHE_OS_VALUES. The `test` target is
 *    single-leg ubuntu, so a hand-authored 'linux' expectation is sampled at a rate of
 *    ZERO -- Phase 9 proved one such guard worthless by substitution. PINNED_SEEDS is
 *    typed Record<CacheOs, string> for the same reason: a fourth tuple member becomes a
 *    TYPE error here rather than a silently unsampled OS.
 *
 * How the two split, which is why both are here: the LITERAL catches a marker change
 * and a slot reordering. The DERIVED check catches an index that is no longer taken
 * from the real tuple -- a hardcoded 0/1/2 mapping satisfies every literal in this file
 * and fails only there.
 */
const RUN_ID = '30401077417';

/** The marker word, authored here so changing it fails on this file's own terms. */
const MARKER = 'feed';

/**
 * HAND-AUTHORED per OS -- never rebuilt from MARKER + CACHE_OS_VALUES.indexOf(os) +
 * RUN_ID, which is the same template the implementation uses and would therefore pin
 * nothing. Record<CacheOs, string> makes adding an OS discriminator a compile error
 * here instead of an unsampled member.
 */
const PINNED_SEEDS: Record<CacheOs, string> = {
  windows: 'feed030401077417',
  macos: 'feed130401077417',
  linux: 'feed230401077417',
};

describe('mirrorSeedHash (OBS-05 per-leg publish seed, D-12)', () => {
  it.each(CACHE_OS_VALUES)(
    'derives exactly the pinned seed on a %s leg',
    (os) => {
      expect(mirrorSeedHash(RUN_ID, os)).toBe(PINNED_SEEDS[os]);
    },
  );

  it.each(CACHE_OS_VALUES)(
    'takes the OS slot digit from the REAL CACHE_OS_VALUES index for %s',
    (os) => {
      expect(mirrorSeedHash(RUN_ID, os)).toContain(
        `${MARKER}${CACHE_OS_VALUES.indexOf(os)}`,
      );
    },
  );

  it.each(CACHE_OS_VALUES)(
    'is representable as a cache hash on a %s leg -- the D-12 constraint a reader misses, since <run_id>-<os> is not',
    (os) => {
      expect(HASH_PATTERN.test(mirrorSeedHash(RUN_ID, os))).toBe(true);
    },
  );

  it.each(CACHE_OS_VALUES)(
    'contains a hex LETTER on a %s leg -- disjointness from run ids and Nx task hashes is STRUCTURAL, both spaces being all-decimal',
    (os) => {
      expect(mirrorSeedHash(RUN_ID, os)).toMatch(/[a-f]/);
    },
  );

  it.each(CACHE_OS_VALUES)(
    "stays distinct from the cafe<run_id> seed ci.yml's consumer-smoke job already ships, on a %s leg",
    (os) => {
      // That family is live in the shard today (cafe30401077417-linux and others) and
      // its comment carries the identical hex-word-marker rationale. Two families that
      // both begin `cafe` would be indistinguishable in a shard listing, so the FAMILY
      // clause is the load-bearing half; the exact-equality clause is the cheap belt.
      expect(mirrorSeedHash(RUN_ID, os).startsWith('cafe')).toBe(false);
      expect(mirrorSeedHash(RUN_ID, os)).not.toBe(`cafe${RUN_ID}`);
    },
  );

  it('derives a DISTINCT seed for every CACHE_OS_VALUES member -- injectivity, which is the whole point of the helper', () => {
    const seeds = CACHE_OS_VALUES.map((os) => mirrorSeedHash(RUN_ID, os));

    expect(new Set(seeds).size).toBe(CACHE_OS_VALUES.length);
  });

  it('pins the PRECONDITION for that injectivity: CACHE_OS_VALUES holds under ten members', () => {
    // At ten members the index stops being one character, so the boundary between the
    // index slot and the run id stops being positional: `feed1` followed by `0<run_id>`
    // renders identically to `feed10` followed by `<run_id>`. Two legs of the SAME run
    // would still differ -- which is exactly why the injectivity case above cannot carry
    // this claim and would keep passing past the tenth member. Adding OS number ten has
    // to change the ENCODING (a separator, or a fixed-width index), not just the tuple.
    // This is the only assertion in the repo that says so.
    expect(CACHE_OS_VALUES.length).toBeLessThan(10);
  });

  it.each(CACHE_OS_VALUES)(
    'survives every validator on the seed path for a %s leg',
    (os) => {
      const seed = mirrorSeedHash(RUN_ID, os);
      const parsed = parseHash(seed);

      expect(parsed).toBeDefined();
      // Enumerated and therefore MIRRORED -- required, not incidental. The publish
      // engine only mirrors keys isServerProducedKey accepts, so a seed this rejected
      // would never reach the shard for read-back.ts to find, and the MISS would look
      // like a dead publish path rather than a bad key.
      expect(isServerProducedKey(cacheKeyFor(parsed as Hash))).toBe(true);
      // ONE argument, deliberately: correct today, and still correct after CORR-02
      // deletes the second parameter, so this case survives that rename unchanged.
      expect(isServerProducedAssetName(releaseAssetName(parsed as Hash))).toBe(
        true,
      );
    },
  );

  // Structural, mirroring dogfood-body.spec.ts's dogfoodBody.length control.
  // Function.length counts parameters before the first default, so `os = cachePlatform()`
  // drops this to 1 and fails here. A default would let a caller derive a seed under the
  // RUNNING machine's OS while believing it had named a leg -- the same silent
  // self-comparison shape D-18 closed on the payload side.
  it('structural: mirrorSeedHash.length is 2 -- neither parameter carries a default', () => {
    expect(mirrorSeedHash.length).toBe(2);
  });

  it('is a true leaf: imports nothing from ../backend, ../publish, ../server, ../action, or ./select-backend', () => {
    const source = readFileSync(
      new URL('./mirror-seed.ts', import.meta.url),
      'utf8',
    );

    expect(source).not.toMatch(/from '\.\.\/backend/);
    expect(source).not.toMatch(/from '\.\.\/publish/);
    expect(source).not.toMatch(/from '\.\.\/server/);
    expect(source).not.toMatch(/from '\.\.\/action/);
    expect(source).not.toMatch(/from '\.\/select-backend/);
  });
});
