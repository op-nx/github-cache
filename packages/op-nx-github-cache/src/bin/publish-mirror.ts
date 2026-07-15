#!/usr/bin/env node
import { execFile } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { restoreCache } from '@actions/cache';
import { cacheArchivePath } from '../lib/backends/actions-cache-backend.js';
import {
  planShardCleanup,
  resolveMinDownloadCount,
  type ReleaseAsset,
} from '../lib/cleanup.js';
import {
  monthTag,
  resolveMaxAgeDays,
  shardTagsForWindow,
} from '../lib/shard.js';
import { isWriteTrusted } from '../lib/trust.js';
import { HASH_PATTERN } from '../lib/types.js';

const exec = promisify(execFile);

const MAX_AGE_DAYS = resolveMaxAgeDays(process.env.CACHE_MIRROR_MAX_AGE_DAYS);
const MIN_DOWNLOAD_COUNT_TO_KEEP = resolveMinDownloadCount(
  process.env.CACHE_MIRROR_MIN_DOWNLOAD_COUNT_TO_KEEP,
);

// `gh` reports these conditions only as human-readable stderr, not structured
// exit codes; matching the text is brittle across gh versions but is the only
// signal the CLI gives here. Hoisted so both fragile sentinels live in one
// place. (release-mirror-backend.ts discriminates the same 404 structurally via
// error.status, which is why only the CLI path needs these.)
const GH_ALREADY_EXISTS_PATTERN = /already exists/i;
const GH_NOT_FOUND_MARKER = 'HTTP 404';

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

export const BRANCH_NAME_PATTERN = /^[\w./-]+$/;

async function resolveDefaultBranch(repo: string): Promise<string> {
  if (process.env.DEFAULT_BRANCH) {
    // Hardens nothing exploitable on its own (README already documents this
    // as maintainer-controlled, and its only use -- the GITHUB_REF equality
    // check below -- is defense-in-depth, not the load-bearing control), but
    // rejecting whitespace/control characters is a free correctness guard.
    if (!BRANCH_NAME_PATTERN.test(process.env.DEFAULT_BRANCH)) {
      throw new Error(
        `DEFAULT_BRANCH "${process.env.DEFAULT_BRANCH}" is not a plausible branch name.`,
      );
    }

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

// The Actions cache namespace is repo-wide, not Nx-owned: other workflow steps
// (e.g. actions/setup-node's own npm cache) create entries here too, and their
// keys are neither guaranteed Nx-shaped nor safe to interpolate into a
// filesystem path / asset name. Only genuine Nx hashes pass. Extracted as a
// pure function so this path-traversal/injection guard is unit-testable
// without the `gh` dependency.
export function filterNxCacheKeys(newlineSeparatedKeys: string): string[] {
  return newlineSeparatedKeys
    .split('\n')
    .map((line) => line.trim())
    .filter((key) => HASH_PATTERN.test(key));
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

  return filterNxCacheKeys(output);
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

  if (!result.ok && !GH_ALREADY_EXISTS_PATTERN.test(result.stderr)) {
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

    if (!result.ok && !GH_ALREADY_EXISTS_PATTERN.test(result.stderr)) {
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

    const releaseId = Number(result.stdout.trim());

    // A valid release id is a positive integer. Guard the pathological cases so
    // nothing bogus slips past the `releaseId === null` check in cleanupShard:
    // non-numeric stdout is NaN, and -- crucially -- empty/whitespace stdout is
    // Number('') === 0, which would otherwise reach a `/releases/0/assets` call.
    return Number.isInteger(releaseId) && releaseId > 0 ? releaseId : null;
  } catch (error) {
    // Only a real 404 (shard doesn't exist yet) is a legitimate "no cleanup
    // needed" case -- matches release-mirror-backend.ts's isNotFound
    // discrimination. Any other failure (auth, rate-limit, network) must
    // surface, not be silently treated as "nothing to clean up".
    if ((error as ExecFailure)?.stderr?.includes(GH_NOT_FOUND_MARKER)) {
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
  const { assetsToDelete, deleteRelease } = planShardCleanup(
    assets,
    {
      maxAgeDays: MAX_AGE_DAYS,
      minDownloadCountToKeep: MIN_DOWNLOAD_COUNT_TO_KEEP,
    },
    allowShardDeletion,
  );

  for (const asset of assetsToDelete) {
    const result = await ghAllowFailure([
      'release',
      'delete-asset',
      shardTag,
      asset.name,
      '--repo',
      repo,
      '--yes',
    ]);

    // Surface a failed prune. This path was previously fire-and-forget, so a
    // persistent problem (e.g. the mirror token losing contents:write) let
    // stale assets accumulate silently toward GitHub's 1000-asset-per-release
    // cap until, far downstream, uploads start failing. Not fatal: a transient
    // failure is retried by the next run's cleanup pass.
    if (!result.ok) {
      console.error(
        `Failed to delete stale asset ${asset.name} from ${shardTag}: ${result.stderr}`,
      );
    }
  }

  // planShardCleanup applies no `assets.length > 0` guard by design: an
  // already-empty release (e.g. a prior run's delete-release attempt failed)
  // must still be retried, not left orphaned forever. `gh release delete` on an
  // already-gone release is a harmless no-op via ghAllowFailure.
  if (deleteRelease) {
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

  // Match selectBackend's format check: a malformed value (missing the `/`)
  // would otherwise be interpolated mid-path into `gh api repos/<repo>/...`
  // and surface as a confusing GitHub error with no hint the env var is wrong.
  const [owner, repoName] = repo.split('/');

  if (!owner || !repoName) {
    throw new Error(`GITHUB_REPOSITORY must be "owner/repo"; got "${repo}".`);
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
      // for the shard window below -- report all failures at the end instead.
      console.error(`Failed to upload ${hash}:`, error);
      failures.push(hash);
    }
  }

  // Walk every shard the retention window (MAX_AGE_DAYS) could still hold a
  // live asset in -- not just current + previous month -- so raising
  // CACHE_MIRROR_MAX_AGE_DAYS doesn't leave older shards permanently
  // unpruned (release-mirror-backend.ts's read side walks the same window).
  // Never allow deleting the current shard: it was just uploaded to above.
  //
  // Isolate each shard the same way the upload loop above does: one shard's
  // non-404 fault (rate-limit, network, an unexpected gh error) must not abort
  // pruning the remaining shards, nor short-circuit past the upload-failure
  // report below. Collect both classes of failure and surface them together.
  const cleanupFailures: string[] = [];

  for (const shardTag of shardTagsForWindow(now, MAX_AGE_DAYS)) {
    try {
      await cleanupShard(repo, shardTag, shardTag !== currentShard);
    } catch (error) {
      console.error(`Failed to clean up shard ${shardTag}:`, error);
      cleanupFailures.push(shardTag);
    }
  }

  const problems: string[] = [];

  if (failures.length > 0) {
    problems.push(
      `${failures.length} hash(es) failed to upload: ${failures.join(', ')}`,
    );
  }

  if (cleanupFailures.length > 0) {
    problems.push(
      `${cleanupFailures.length} shard(s) failed to clean up: ${cleanupFailures.join(', ')}`,
    );
  }

  if (problems.length > 0) {
    throw new Error(problems.join('; '));
  }
}

// Only run as a CLI entry point, not when imported (e.g. by publish-mirror.spec.ts).
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
