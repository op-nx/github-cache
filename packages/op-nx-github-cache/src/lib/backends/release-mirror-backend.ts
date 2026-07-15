import { Octokit } from '@octokit/rest';
import type { CacheBackend, PutResult } from '../types.js';

export interface ReleaseMirrorBackendOptions {
  owner: string;
  repo: string;
  octokit?: Octokit;
  // Injectable for tests; defaults to the real clock.
  now?: () => Date;
}

export function monthTag(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');

  return `cache-mirror-${year}${month}`;
}

function previousMonthTag(date: Date): string {
  const previous = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1),
  );

  return monthTag(previous);
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
// 1000-asset-per-release cap. There is no manifest/index, so a lookup checks
// the current month's shard, then the prior month's -- bounded to exactly 2
// requests because the 30-day cleanup window (see cleanup.ts) means a hash
// can't realistically live in any older shard. Writing only ever happens via
// the trusted-CI-only publish-mirror script, never through this backend.
export function createReleaseMirrorBackend(
  options: ReleaseMirrorBackendOptions,
): CacheBackend {
  const octokit = options.octokit ?? new Octokit();
  const { owner, repo } = options;
  const now = options.now ?? (() => new Date());

  async function findAssetId(hash: string): Promise<number | null> {
    const assetName = `${hash}.tar.gz`;

    for (const tag of [monthTag(now()), previousMonthTag(now())]) {
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
