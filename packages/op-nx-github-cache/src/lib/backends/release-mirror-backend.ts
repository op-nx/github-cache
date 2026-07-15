import { Octokit } from '@octokit/rest';
import type { CacheBackend, PutResult } from '../types.js';
import {
  DEFAULT_CACHE_MIRROR_MAX_AGE_DAYS,
  shardTagsForWindow,
} from '../shard.js';

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
  // Optional GitHub token. Anonymous (unset) is fine for public-repo reads but
  // is rate-limited to 60 req/hr; a token lifts that to 5000/hr. Ignored when
  // an explicit octokit is injected (tests).
  auth?: string;
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
  const octokit =
    options.octokit ?? new Octokit(options.auth ? { auth: options.auth } : {});
  const { owner, repo } = options;
  const now = options.now ?? (() => new Date());
  const maxAgeDays = options.maxAgeDays ?? DEFAULT_CACHE_MIRROR_MAX_AGE_DAYS;

  // Per-shard, in-process cache of the asset-name -> id map (null = shard does
  // not exist yet). `serve` is long-lived and the mirror is only ever written
  // by CI, so caching each shard's asset list for the process lifetime turns
  // an `nx affected`'s N cache lookups from ~2N GitHub API calls into a handful
  // (about two per shard in the window -- getReleaseByTag plus a paginated
  // listReleaseAssets), which keeps an anonymous client under the 60 req/hr
  // limit. Trade-off: a hash published mid-session isn't seen until
  // `serve` restarts -- an acceptable extra miss, never a wrong result.
  //
  // The value is the in-flight Promise, not the resolved map, so a burst of
  // concurrent cold GETs for the same shard (the normal `nx affected` startup
  // pattern) coalesces onto one API round-trip instead of stampeding it once
  // per lookup -- which would blow the very rate limit this cache protects.
  const shardCache = new Map<string, Promise<Map<string, number> | null>>();

  function loadShard(tag: string): Promise<Map<string, number> | null> {
    const cached = shardCache.get(tag);

    if (cached !== undefined) {
      return cached;
    }

    const pending = (async (): Promise<Map<string, number> | null> => {
      try {
        const release = await octokit.rest.repos.getReleaseByTag({
          owner,
          repo,
          tag,
        });
        // The `assets` array embedded in a release response is a non-paginated
        // snapshot (~first page only); a shard is expected to approach the
        // 1000-asset cap, so page through the dedicated endpoint instead --
        // mirroring publish-mirror.ts's write side. Otherwise any asset past
        // the first page is invisible to reads and Nx rebuilds a cached task.
        const assets = await octokit.paginate(
          octokit.rest.repos.listReleaseAssets,
          { owner, repo, release_id: release.data.id, per_page: 100 },
        );

        return new Map(
          assets.map((asset): [string, number] => [asset.name, asset.id]),
        );
      } catch (error) {
        if (isNotFound(error)) {
          return null;
        }

        throw error;
      }
    })();

    // A 404 resolves to a cached null (a missing shard stays missing for the
    // process lifetime, as before). Any other fault rejects: evict it so the
    // next lookup retries rather than caching the error -- a rate-limit/5xx
    // must never poison every later read (see the "rethrows a non-404" spec).
    shardCache.set(tag, pending);
    void pending.catch(() => {
      if (shardCache.get(tag) === pending) {
        shardCache.delete(tag);
      }
    });

    return pending;
  }

  async function findAssetId(hash: string): Promise<number | null> {
    const assetName = `${hash}.tar.gz`;
    const at = now();

    for (const tag of shardTagsForWindow(at, maxAgeDays)) {
      const assets = await loadShard(tag);
      const assetId = assets?.get(assetName);

      if (assetId !== undefined) {
        return assetId;
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
