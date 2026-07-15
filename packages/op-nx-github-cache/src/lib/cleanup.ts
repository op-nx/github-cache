export interface ReleaseAsset {
  name: string;
  createdAt: string;
}

export interface CleanupOptions {
  maxAgeDays: number;
  now?: () => Date;
}

// Age-only retention: an asset is deletable once it is older than maxAgeDays.
// GitHub's Release Asset API exposes no last-accessed timestamp (only a
// cumulative download_count, which never decays), so true LRU is not possible
// here -- created_at age is the one reliable, leak-free signal. Retention is
// bounded by the same window the read side walks (see shard.ts), so nothing is
// ever kept that reads could not reach anyway.
export function selectAssetsToDelete(
  assets: ReleaseAsset[],
  options: CleanupOptions,
): ReleaseAsset[] {
  const now = options.now ? options.now() : new Date();
  const maxAgeMs = options.maxAgeDays * 24 * 60 * 60 * 1000;

  return assets.filter((asset) => {
    const ageMs = now.getTime() - new Date(asset.createdAt).getTime();

    return ageMs > maxAgeMs;
  });
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
