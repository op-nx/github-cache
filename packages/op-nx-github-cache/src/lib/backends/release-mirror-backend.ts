import { Octokit } from '@octokit/rest';
import type { CacheBackend, PutResult } from '../types.js';
import {
  DEFAULT_CACHE_MIRROR_MAX_AGE_DAYS,
  shardTagsForWindow,
} from '../shard.js';

// Re-exported so callers (and release-mirror-backend.spec.ts) keep importing
// it from here; the single source of truth lives in shard.ts alongside
// resolveMaxAgeDays/shardTagsForWindow.
export { monthTag } from '../shard.js';

export interface ReleaseMirrorBackendOptions {
  owner: string;
  repo: string;
  octokit?: Octokit;
  // Injectable for tests; defaults to the real clock.
  now?: () => Date;
  // How far back reads look for a hash. Must track the same retention
  // window publish-mirror.ts's cleanup uses (see shard.ts) -- otherwise
  // assets that are still retained become unreadable via GET, or assets
  // past the read window never get cleaned up.
  maxAgeDays?: number;
}

function isNotFound(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    (error as { status: unknown }).status === 404
  );
}

// Read-only, get-only backend (verified pv-1/pv-10): mirror releases are
// sharded by calendar month (cache-mirror-<yyyymm>) to stay under GitHub's
// 1000-asset-per-release cap. There is no manifest/index, so a lookup walks
// shardTagsForWindow() -- current month back through however many prior
// months the configured retention window (maxAgeDays, defaulting to the same
// value publish-mirror.ts's cleanup uses) can still hold a live asset in.
// Writing only ever happens via the trusted-CI-only publish-mirror script,
// never through this backend.
export function createReleaseMirrorBackend(
  options: ReleaseMirrorBackendOptions,
): CacheBackend {
  const octokit = options.octokit ?? new Octokit();
  const { owner, repo } = options;
  const now = options.now ?? (() => new Date());
  const maxAgeDays = options.maxAgeDays ?? DEFAULT_CACHE_MIRROR_MAX_AGE_DAYS;

  async function findAssetId(hash: string): Promise<number | null> {
    const assetName = `${hash}.tar.gz`;
    const at = now();

    for (const tag of shardTagsForWindow(at, maxAgeDays)) {
      try {
        const release = await octokit.rest.repos.getReleaseByTag({
          owner,
          repo,
          tag,
        });
        const asset = release.data.assets.find(
          (candidate) => candidate.name === assetName,
        );

        if (asset) {
          return asset.id;
        }
      } catch (error) {
        if (isNotFound(error)) {
          continue;
        }

        throw error;
      }
    }

    return null;
  }

  return {
    async get(hash: string): Promise<Buffer | null> {
      const assetId = await findAssetId(hash);

      if (assetId === null) {
        return null;
      }

      const response = await octokit.rest.repos.getReleaseAsset({
        owner,
        repo,
        asset_id: assetId,
        headers: { accept: 'application/octet-stream' },
      });

      return Buffer.from(response.data as unknown as ArrayBuffer);
    },

    async put(): Promise<PutResult> {
      return 'forbidden';
    },
  };
}
