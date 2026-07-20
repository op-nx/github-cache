import * as core from '@actions/core';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** A GitHub Release as the cleanup engine needs it: its id and its tag (the shard key). */
export interface CleanupRelease {
  readonly id: number;
  readonly tag_name: string;
}

/** A release asset as the cleanup engine needs it: id, name, and the age-cutoff key. */
export interface CleanupAsset {
  readonly id: number;
  readonly name: string;
  readonly created_at: string;
}

/**
 * The narrow injected client (D-04 seam, the ReleaseReadClient precedent). Each method
 * returns a FULLY materialized array and is free to throw. The real 04-05 adapter wraps
 * `octokit.paginate`, which REJECTS on any page fault -- so a mid-list fault propagates
 * as a thrown listAll* call, which is exactly the RETAIN-01 list-abort guarantee. This
 * module imports NO @octokit/rest: the engine is pure logic behind this seam, and the
 * spec injects a fault-shaped fake with no network.
 */
export interface CleanupClient {
  listAllReleases(): Promise<CleanupRelease[]>;
  listAllAssets(releaseId: number): Promise<CleanupAsset[]>;
  deleteAsset(assetId: number): Promise<void>;
}

/** Run counts for the OBS-01 summary and the bin's aggregate-failure decision. */
export interface CleanupResult {
  readonly pruned: number;
  readonly failed: number;
  readonly scanned: number;
}

/**
 * Duck-type the numeric status off an Octokit-shaped fault (ROBUST-01, D-04). Never
 * `instanceof RequestError` (two @octokit/request-error versions can coexist in the
 * dependency tree) and never stderr text: discrimination is STRUCTURAL on error.status.
 */
function statusOf(error: unknown): number | undefined {
  if (
    error !== null &&
    typeof error === 'object' &&
    typeof (error as { status?: unknown }).status === 'number'
  ) {
    return (error as { status: number }).status;
  }

  return undefined;
}

/**
 * Age-based prune of the GitHub Releases mirror (D-06/D-09/D-10, RETAIN-01/TEST-04),
 * behind the injected CleanupClient so it runs with no network. Two strictly ordered
 * phases:
 *
 * LIST PHASE -- materialize the COMPLETE cache-mirror-* release + asset set BEFORE a
 * single deletion. This deliberately INVERTS the Phase 3 reader's swallow-every-fault-
 * into-a-MISS discipline (releases-backend.ts:53-57): on the cleanup path a swallowed
 * list fault reads as authoritative absence and would delete live data, so ANY throw
 * from listAllReleases/listAllAssets PROPAGATES and aborts the whole run with ZERO
 * deletions. `octokit.paginate` in the real adapter rejects on any page fault
 * (incomplete pagination == abort) -- the RETAIN-01/C9 guarantee. Cleanup enumerates
 * EVERY cache-mirror-* release (deliberately wider than the reader's window: an
 * out-of-window shard must still be pruned, Pitfall 4), sharing only the maxAgeDays
 * cutoff with the reader.
 *
 * DELETE PHASE -- delete only assets older than maxAgeDays by created_at (D-06), each
 * isolated so one rejection never blocks the rest. A 404 is the ONLY "already gone"
 * absence (benign, the desired end state); every other status (401/403/429/5xx) is a
 * real per-item failure (ROBUST-01). A non-zero aggregate failure count fails the run
 * loud via core.setFailed (TEST-04). OBS-01: a summary table reports pruned/failed/
 * scanned counts, and each real per-item failure emits a core.warning carrying only the
 * asset name + numeric status -- never a token, never a raw workflow-command string.
 */
export async function cleanupMirror(
  client: CleanupClient,
  maxAgeDays: number,
): Promise<CleanupResult> {
  const cutoff = Date.now() - maxAgeDays * MS_PER_DAY;

  // LIST PHASE: materialize before deleting. Any throw here aborts with zero deletions.
  const releases = await client.listAllReleases();
  const expired: { assetId: number; name: string }[] = [];
  let scanned = 0;

  for (const release of releases) {
    if (!release.tag_name.startsWith('cache-mirror-')) {
      continue;
    }

    const assets = await client.listAllAssets(release.id);

    for (const asset of assets) {
      scanned++;

      if (new Date(asset.created_at).getTime() < cutoff) {
        expired.push({ assetId: asset.id, name: asset.name });
      }
    }
  }

  // DELETE PHASE: per-item isolation; a non-zero aggregate failure count exits non-zero.
  let pruned = 0;
  let failed = 0;

  for (const asset of expired) {
    try {
      await client.deleteAsset(asset.assetId);
      pruned++;
    } catch (error) {
      if (statusOf(error) === 404) {
        // Already gone (a concurrent delete under the single-writer schedule) -- the
        // desired end state, not a failure (ROBUST-01: 404 is the only absence).
        pruned++;

        continue;
      }

      failed++;
      core.warning(
        `github-cache cleanup: failed to delete ${asset.name} (status ${statusOf(error) ?? 'unknown'}); continuing.`,
      );
    }
  }

  core.summary.addHeading('github-cache cleanup', 2).addTable([
    [
      { data: 'metric', header: true },
      { data: 'count', header: true },
    ],
    ['pruned', String(pruned)],
    ['failed', String(failed)],
    ['scanned', String(scanned)],
  ]);
  await core.summary.write();

  if (failed > 0) {
    core.setFailed(`github-cache cleanup: ${failed} asset deletion(s) failed.`);
  }

  return { pruned, failed, scanned };
}
