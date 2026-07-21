import * as core from '@actions/core';
import { Octokit } from '@octokit/rest';
import { isEntrypoint } from '../lib/is-entrypoint.js';
import {
  GITHUB_REPOSITORY_PATTERN,
  resolveGitHubToken,
} from '../lib/github-identity.js';
import { resolveMaxAgeDays } from '../lib/retention.js';
import {
  cleanupMirror,
  type CleanupAsset,
  type CleanupClient,
  type CleanupRelease,
} from './cleanup.js';

/**
 * The real CleanupClient adapter over @octokit/rest (D-04). The two list methods go
 * through `octokit.paginate`, which REJECTS on any page fault -- an incomplete
 * pagination is an abort, never a partial list. That rejection is exactly what gives
 * cleanupMirror its RETAIN-01/C9 list-abort guarantee: a mid-list fault propagates
 * out of listAll* and aborts the whole run with ZERO deletions. deleteAsset is the
 * only write; it authenticates with the same-repo contents:write GITHUB_TOKEN
 * (RETAIN-03), no PAT. The engine imports NO @octokit/rest -- it only sees this
 * narrow seam -- so the octokit dependency lives here in the bin.
 */
export function createCleanupClient(
  octokit: Octokit,
  owner: string,
  repo: string,
): CleanupClient {
  return {
    async listAllReleases(): Promise<CleanupRelease[]> {
      return octokit.paginate(octokit.rest.repos.listReleases, {
        owner,
        repo,
        per_page: 100,
      });
    },

    async listAllAssets(releaseId: number): Promise<CleanupAsset[]> {
      return octokit.paginate(octokit.rest.repos.listReleaseAssets, {
        owner,
        repo,
        release_id: releaseId,
        per_page: 100,
      });
    },

    async deleteAsset(assetId: number): Promise<void> {
      await octokit.rest.repos.deleteReleaseAsset({
        owner,
        repo,
        asset_id: assetId,
      });
    },
  };
}

/**
 * Scheduled cleanup entry (RETAIN-01/RETAIN-03/D-09, OBS-01). Thin glue over the
 * fully-tested cleanupMirror engine: resolve owner/repo + token + retention window
 * from the process env the cleanup.yml workflow inherits, construct the real Octokit
 * CleanupClient, and drive the engine. All fault handling (list-abort, per-item
 * isolation, aggregate setFailed, OBS-01 summary) lives in the engine.
 */
async function run(): Promise<void> {
  const repository = process.env.GITHUB_REPOSITORY ?? '';

  if (!GITHUB_REPOSITORY_PATTERN.test(repository)) {
    // Fail-closed on a corrupted repository identity (selectBackend precedent): a
    // scheduled write path must never resolve into some other namespace.
    throw new Error(
      'github-cache cleanup: GITHUB_REPOSITORY must be a valid owner/name',
    );
  }

  const [owner, repo] = repository.split('/');

  const token = resolveGitHubToken(process.env);

  if (token === undefined) {
    // No token means the delete path cannot authenticate; fail loud once here rather
    // than let every per-item delete 401 (OBS-01).
    throw new Error(
      'github-cache cleanup: no GH_TOKEN/GITHUB_TOKEN resolved for the delete path',
    );
  }

  const octokit = new Octokit({ auth: token });
  const maxAgeDays = resolveMaxAgeDays(process.env);

  await cleanupMirror(createCleanupClient(octokit, owner, repo), maxAgeDays);
}

// Direct-invocation guard: run() only when this module is the entrypoint (the built
// dist/cleanup/index.js invoked by cleanup.yml), never when createCleanupClient is
// imported. isEntrypoint owns the Windows Pitfall-6 idiom. A whole-run fault reaches
// core.setFailed (non-zero exit) so the scheduled job fails loud (OBS-01/D-15).
if (isEntrypoint(import.meta.url)) {
  run().catch((error: unknown) => {
    core.setFailed(error instanceof Error ? error.message : String(error));
  });
}
