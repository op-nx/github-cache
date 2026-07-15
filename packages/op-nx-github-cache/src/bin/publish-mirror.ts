#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { promisify } from 'node:util';
import { restoreCache } from '@actions/cache';
import { cacheArchivePath } from '../lib/backends/actions-cache-backend.js';
import { selectAssetsToDelete, type ReleaseAsset } from '../lib/cleanup.js';
import { isWriteTrusted } from '../lib/trust.js';
import { HASH_PATTERN } from '../lib/types.js';

const exec = promisify(execFile);

const MAX_AGE_DAYS = Number(process.env.CACHE_MIRROR_MAX_AGE_DAYS ?? 30);
const MIN_DOWNLOAD_COUNT_TO_KEEP = Number(
  process.env.CACHE_MIRROR_MIN_DOWNLOAD_COUNT_TO_KEEP ?? 0,
);

function monthTag(date: Date): string {
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

interface ExecFailure {
  stderr?: string;
}

async function gh(args: string[]): Promise<string> {
  const { stdout } = await exec('gh', args);

  return stdout;
}

async function ghAllowFailure(
  args: string[],
): Promise<{ ok: boolean; stderr: string }> {
  try {
    await exec('gh', args);

    return { ok: true, stderr: '' };
  } catch (error) {
    const stderr = (error as ExecFailure)?.stderr ?? '';

    return { ok: false, stderr };
  }
}

async function resolveDefaultBranch(repo: string): Promise<string> {
  if (process.env.DEFAULT_BRANCH) {
    return process.env.DEFAULT_BRANCH;
  }

  const output = await gh([
    'repo',
    'view',
    repo,
    '--json',
    'defaultBranchRef',
    '-q',
    '.defaultBranchRef.name',
  ]);

  return output.trim();
}

async function listActionsCacheHashes(
  repo: string,
  defaultBranch: string,
): Promise<string[]> {
  const output = await gh([
    'api',
    `repos/${repo}/actions/caches`,
    '--paginate',
    '-f',
    `ref=refs/heads/${defaultBranch}`,
    '-q',
    '.actions_caches[].key',
  ]);

  // The Actions cache namespace is repo-wide, not Nx-owned: other workflow
  // steps (e.g. actions/setup-node's own npm cache) create entries here too,
  // and their keys are neither guaranteed Nx-shaped nor safe to interpolate
  // into a filesystem path / asset name. Only forward genuine Nx hashes.
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter((key) => HASH_PATTERN.test(key));
}

async function ensureShardExists(
  repo: string,
  shardTag: string,
): Promise<void> {
  const result = await ghAllowFailure([
    'release',
    'create',
    shardTag,
    '--notes',
    'Cache mirror shard',
    '--repo',
    repo,
  ]);

  if (!result.ok && !/already exists/i.test(result.stderr)) {
    throw new Error(
      `Failed to create mirror shard ${shardTag}: ${result.stderr}`,
    );
  }
}

async function uploadHash(
  shardTag: string,
  repo: string,
  hash: string,
): Promise<void> {
  // Must match the exact path the server's actions-cache-backend used to
  // save this hash -- @actions/cache matches an entry by a version hash
  // computed over the literal path strings, not just the key (see
  // cacheArchivePath's doc comment).
  const filePath = cacheArchivePath(hash);

  try {
    const hit = await restoreCache([filePath], hash, []);

    if (!hit) {
      // Evicted from the Actions cache between listing and restoring; skip.
      return;
    }

    // Never --clobber: overwriting an existing hash's asset would break the
    // content-addressed immutability this plugin's CREEP defense relies on.
    const result = await ghAllowFailure([
      'release',
      'upload',
      shardTag,
      filePath,
      '--repo',
      repo,
    ]);

    if (!result.ok && !/already exists/i.test(result.stderr)) {
      throw new Error(
        `Failed to upload ${hash} to ${shardTag}: ${result.stderr}`,
      );
    }
  } finally {
    await rm(filePath, { force: true });
  }
}

async function getReleaseId(
  repo: string,
  shardTag: string,
): Promise<number | null> {
  try {
    const result = await exec('gh', [
      'api',
      `repos/${repo}/releases/tags/${shardTag}`,
      '-q',
      '.id',
    ]);

    return Number(result.stdout.trim());
  } catch (error) {
    // Only a real 404 (shard doesn't exist yet) is a legitimate "no cleanup
    // needed" case -- matches release-mirror-backend.ts's isNotFound
    // discrimination. Any other failure (auth, rate-limit, network) must
    // surface, not be silently treated as "nothing to clean up".
    if ((error as ExecFailure)?.stderr?.includes('HTTP 404')) {
      return null;
    }

    throw error;
  }
}

async function listShardAssets(
  repo: string,
  releaseId: number,
): Promise<ReleaseAsset[]> {
  const output = await gh([
    'api',
    `repos/${repo}/releases/${releaseId}/assets`,
    '--paginate',
    '-q',
    '.[] | {name: .name, createdAt: .created_at, downloadCount: .download_count}',
  ]);

  return output
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as ReleaseAsset);
}

// Cleans up one shard's stale assets. `allowShardDeletion` restricts deleting
// the shard's whole release to shards other than the one this run just
// uploaded to, so an in-progress current-month shard is never removed mid-run.
async function cleanupShard(
  repo: string,
  shardTag: string,
  allowShardDeletion: boolean,
): Promise<void> {
  const releaseId = await getReleaseId(repo, shardTag);

  if (releaseId === null) {
    return;
  }

  const assets = await listShardAssets(repo, releaseId);
  const toDelete = selectAssetsToDelete(assets, {
    maxAgeDays: MAX_AGE_DAYS,
    minDownloadCountToKeep: MIN_DOWNLOAD_COUNT_TO_KEEP,
  });

  for (const asset of toDelete) {
    await ghAllowFailure([
      'release',
      'delete-asset',
      shardTag,
      asset.name,
      '--repo',
      repo,
      '--yes',
    ]);
  }

  const remaining = assets.length - toDelete.length;

  // No `assets.length > 0` guard: an already-empty release (e.g. a prior
  // run's delete-release attempt failed) must still be retried, not left
  // orphaned forever. `gh release delete` on an already-gone release is a
  // harmless no-op via ghAllowFailure.
  if (allowShardDeletion && remaining === 0) {
    await ghAllowFailure([
      'release',
      'delete',
      shardTag,
      '--repo',
      repo,
      '--yes',
    ]);
  }
}

async function main(): Promise<void> {
  if (!isWriteTrusted(process.env)) {
    throw new Error(
      'publish-mirror refused: not running under a trusted GitHub Actions trigger.',
    );
  }

  const repo = process.env.GITHUB_REPOSITORY;

  if (!repo) {
    throw new Error('GITHUB_REPOSITORY is required.');
  }

  const defaultBranch = await resolveDefaultBranch(repo);
  const trustedRef = `refs/heads/${defaultBranch}`;

  // Defense-in-depth only: does NOT close the "attacker with a write-scoped
  // token invokes gh directly" bypass -- workflow-level permission scoping
  // (see README) is the load-bearing control.
  if (process.env.GITHUB_REF !== trustedRef) {
    throw new Error(
      `publish-mirror refused: GITHUB_REF "${process.env.GITHUB_REF}" is not "${trustedRef}".`,
    );
  }

  const hashes = await listActionsCacheHashes(repo, defaultBranch);
  const now = new Date();
  const currentShard = monthTag(now);

  await ensureShardExists(repo, currentShard);

  const failures: string[] = [];

  for (const hash of hashes) {
    try {
      await uploadHash(currentShard, repo, hash);
    } catch (error) {
      // One hash's upload failure must not block the rest, or skip cleanup
      // for both shards below -- report all failures at the end instead.
      console.error(`Failed to upload ${hash}:`, error);
      failures.push(hash);
    }
  }

  await cleanupShard(repo, currentShard, false);
  await cleanupShard(repo, previousMonthTag(now), true);

  if (failures.length > 0) {
    throw new Error(
      `${failures.length} hash(es) failed to upload: ${failures.join(', ')}`,
    );
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
