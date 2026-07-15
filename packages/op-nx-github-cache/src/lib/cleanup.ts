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
