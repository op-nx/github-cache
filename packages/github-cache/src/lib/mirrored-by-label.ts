import type { CacheOs } from './release-asset-name.js';

/**
 * The publisher-attribution Release LABEL prefix (OBS-03). Exported as well as the builder
 * below because the READER needs the prefix alone -- it strips it off a label GitHub hands
 * back to recover the OS -- while the writer and every fixture need the whole string. One
 * authored copy either way.
 */
export const MIRRORED_BY_PREFIX = 'mirrored-by: ';

/**
 * OBS-03's publisher attribution for one OS, as it is stamped into a Release asset's `label`
 * metadata: `mirrored-by: <os>`.
 *
 * WHY THIS IS A MODULE AND NOT A PINNED LITERAL IN EACH PLACE. This label is the ONLY OS
 * attribution the mirror carries after CORR-02 dropped the OS component from the asset name,
 * and read-back.ts's publisher check is the only mechanism that detects a DEAD publish leg.
 * The literal was authored independently at SEVEN sites -- the writer, the reader's prefix,
 * two re-authorings in publish-mirror.spec.ts, one helper in read-back.spec.ts and two
 * literals in action/index.spec.ts -- so a writer-side rename of the prefix passed every
 * spec in the package while silently breaking the one check that matters. That is not a
 * drift risk, it is a measured hole: the reader would find no label with the expected prefix
 * and report a MISS, which reads as a dead publish path rather than as a renamed field.
 *
 * The prior justification for the pinned-literal discipline here -- that the failure mode is
 * a LOUD publish-verify RED naming both values -- was true of a rename made in BOTH files. It
 * is not true of a rename made in one, which is the case a single source has to cover.
 *
 * A `lib/` LEAF, following `lib/mirror-seed.ts`'s shape rather than folding into
 * `release-asset-name.ts`, which already owns `CacheOs`. That precedent was chosen for a
 * measured reason and it applies unchanged here: a separate leaf is unreachable from
 * `serve()`, so it contributes a provably ZERO consumer-bundle delta, and it keeps the
 * ROBUST-04 rebuild obligation off the `releaseAssetName` edit instead of spreading it over
 * two files.
 *
 * The `CacheOs` import is `import type`, so it ERASES -- unlike `mirror-seed.ts`, which takes
 * a runtime edge to `CACHE_OS_VALUES` because it needs the tuple's indices. Nothing here
 * needs the tuple, only the union.
 */
export function mirroredByLabel(os: CacheOs): string {
  return `${MIRRORED_BY_PREFIX}${os}`;
}
