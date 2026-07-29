import { CACHE_OS_VALUES, type CacheOs } from './release-asset-name.js';

/**
 * The `publish` leg's own mirror seed key (OBS-05, D-12/D-13/D-14): the marker word
 * `feed`, then this OS's index in CACHE_OS_VALUES, then the workflow run id --
 * `feed0<run_id>` on windows, `feed1<run_id>` on macos, `feed2<run_id>` on linux.
 *
 * ONE helper, TWO call sites, and NO hash arithmetic in YAML (D-14): the `mirror-seed`
 * operation branch in action/index.ts writes it and roundtrip/read-back.ts reads it
 * back, so the writer and the reader cannot disagree about the key. The workflow keeps
 * passing `hash: ${{ github.run_id }}` and both ends derive from that one value.
 *
 * WHY a per-leg key exists at all: before OBS-05 both publish legs seeded the bare run
 * id and were separated ONLY by the asset name's OS suffix. CORR-02 collapses that
 * suffix -- at which point a windows reader would derive the exact name the ubuntu leg
 * uploaded and pass unconditionally, with the windows publish path entirely dead. A key
 * only one leg can produce is what keeps the two names distinct once the suffix is gone,
 * which is why this must exist BEFORE the rename rather than alongside it.
 *
 * The runtime edge to CACHE_OS_VALUES is DELIBERATE, and it is the one thing that
 * differs from the sibling dogfood-body.ts, whose `import type { CacheOs }` erases.
 * Taking the index from the REAL tuple is D-12's third constraint and it is what buys
 * the safety: adding a fourth OS discriminator shifts the indices in exactly one place,
 * so a new leg cannot silently collide with an existing seed. The precondition that
 * makes a single-digit index injective -- CACHE_OS_VALUES holding under ten members --
 * is pinned by mirror-seed.spec.ts rather than assumed, because at ten the slot stops
 * separating the legs and the ENCODING, not just the tuple, has to change.
 *
 * The marker word must stay DISTINCT from `cafe<run_id>`, the seed ci.yml's
 * `consumer-smoke` job already ships (its comment carries the identical hex-word
 * rationale, and `cafe30401077417-linux` is live in the shard today). Two seed families
 * that both began `cafe` would be indistinguishable in a shard listing, so following the
 * in-repo convention with a DIFFERENT word is the point, not a coincidence.
 *
 * The hex LETTERS are what make disjointness STRUCTURAL rather than probabilistic: both
 * competing key spaces -- workflow run ids and Nx task hashes -- are all-decimal, so no
 * value in either can equal one containing `f`, `e` or `d`. The whole string stays
 * inside HASH_PATTERN, which is what lets it cross parseHash, the server's SRV-03 route
 * validator, cacheKeyFor, isServerProducedKey (so the seed IS enumerated and therefore
 * mirrored -- required, not incidental) and both cleanup filter branches. Note what is
 * NOT representable: `<run_id>-<os>` is not a cache hash at all, which is the D-12
 * constraint a reader reaching for the obvious encoding misses.
 *
 * FAILURE MODE of changing any of the above: a SILENT MISS in read-back.ts. No error and
 * no crash -- publish-verify simply stops finding the asset its own leg seeded, and the
 * symptom reads as a dead publish path rather than as a bad key.
 *
 * The tidy-up a future reader WILL propose, named here so it is not proposed: folding
 * this into release-asset-name.ts, which already owns CACHE_OS_VALUES. Do not. A
 * separate leaf is unreachable from serve(), so it contributes a provably ZERO
 * consumer-bundle delta and keeps the whole ROBUST-04 rebuild obligation on the
 * releaseAssetName edit instead of spreading it across two files.
 */
export function mirrorSeedHash(runId: string, os: CacheOs): string {
  return `feed${CACHE_OS_VALUES.indexOf(os)}${runId}`;
}
