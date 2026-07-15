export interface ReleaseAsset {
  name: string;
  createdAt: string;
  downloadCount: number;
}

export interface CleanupOptions {
  maxAgeDays: number;
  // GitHub's Release Asset API has no last-accessed field (pv-10), so this is
  // honestly scoped as a delete-protection floor on lifetime download count,
  // not true recency/LRU. 0 (default) disables the floor: cleanup is age-only.
  minDownloadCountToKeep: number;
  now?: () => Date;
}

export function selectAssetsToDelete(
  assets: ReleaseAsset[],
  options: CleanupOptions,
): ReleaseAsset[] {
  const now = options.now ? options.now() : new Date();
  const maxAgeMs = options.maxAgeDays * 24 * 60 * 60 * 1000;

  return assets.filter((asset) => {
    const ageMs = now.getTime() - new Date(asset.createdAt).getTime();
    const isOld = ageMs > maxAgeMs;

    if (!isOld) {
      return false;
    }

    const isProtectedByPopularity =
      options.minDownloadCountToKeep > 0 &&
      asset.downloadCount >= options.minDownloadCountToKeep;

    return !isProtectedByPopularity;
  });
}

// The popularity-floor env knob's resolver. A non-numeric or negative value
// must not silently become a trap -- fall back to 0 (floor off, age-only
// cleanup, the documented default), the same fall-back shape resolveMaxAgeDays
// and resolveMaxBodyBytes use. A value of 1 or more is floored to whole
// downloads (5.9 -> 5); a positive value below 1 rounds to 0, which would
// silently mean "off", so it is warned like any other disabling typo.
export function resolveMinDownloadCount(envValue: string | undefined): number {
  const configured = Number(envValue);

  // `>= 1`, not `> 0`: a sub-1 positive (e.g. "0.5") floors to 0 and so cannot
  // protect anything -- fall through to the warn path rather than returning a
  // misleading 0 as if it were a valid configured floor.
  if (Number.isFinite(configured) && configured >= 1) {
    return Math.floor(configured);
  }

  // Unlike the other resolvers, this one's fallback (0) DISABLES a safety
  // margin (the popularity floor), so a typo silently reverting protection to
  // off is worth surfacing. `0`/`-0` is the documented explicit-off value --
  // don't warn on it, only on genuinely unparseable/negative/sub-1 input.
  if (envValue !== undefined && configured !== 0) {
    console.warn(
      `CACHE_MIRROR_MIN_DOWNLOAD_COUNT_TO_KEEP="${envValue}" is not a positive whole number of downloads; popularity floor disabled.`,
    );
  }

  return 0;
}

export interface ShardCleanupPlan {
  assetsToDelete: ReleaseAsset[];
  deleteRelease: boolean;
}

// Pure cleanup decision for a single shard, extracted from publish-mirror's gh
// I/O so the riskiest call -- whether to delete the shard's whole release -- is
// unit-testable. A wrong `deleteRelease: true` orphans or nukes a live shard,
// and that decision otherwise had zero coverage.
export function planShardCleanup(
  assets: ReleaseAsset[],
  options: CleanupOptions,
  allowShardDeletion: boolean,
): ShardCleanupPlan {
  const assetsToDelete = selectAssetsToDelete(assets, options);
  const remaining = assets.length - assetsToDelete.length;

  // Delete the whole release only when the caller allows it (never the shard
  // this run just uploaded to) AND nothing would remain. An already-empty
  // release still qualifies, so a prior run's failed delete gets retried
  // rather than orphaned forever.
  return {
    assetsToDelete,
    deleteRelease: allowShardDeletion && remaining === 0,
  };
}
