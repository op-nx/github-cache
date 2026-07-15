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
// and resolveMaxBodyBytes use. Fractional values are floored to whole
// downloads.
export function resolveMinDownloadCount(envValue: string | undefined): number {
  const configured = Number(envValue);

  return Number.isFinite(configured) && configured > 0
    ? Math.floor(configured)
    : 0;
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
