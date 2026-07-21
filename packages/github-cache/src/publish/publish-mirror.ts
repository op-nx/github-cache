import * as core from '@actions/core';
import { createActionsCacheBackend } from '../backend/actions-cache-backend.js';
import type { GetResult } from '../backend/types.js';
import { CACHE_KEY_PREFIX, isServerProducedKey } from '../lib/cache-key.js';
import { statusOf } from '../lib/octokit-status.js';
import { releaseAssetName } from '../lib/release-asset-name.js';
import { shardTag } from '../lib/retention.js';

/**
 * The ~2 GiB per-asset Releases ceiling, which coincides with the server's 2 GB body
 * cap (D-12/ROBUST-02). Checked BEFORE any upload so the outcome is deterministic: an
 * artifact at or over this size fails the whole run loud, it is never truncated or
 * dropped. The exact boundary (>= vs >) is pinned by publish-mirror.spec.ts.
 */
export const RELEASE_ASSET_MAX_BYTES = 2 * 1024 * 1024 * 1024;

/**
 * The per-release (per month shard) asset cap (D-11/ROBUST-05). A shard already holding
 * this many assets degrades a new entry to skip-and-warn -- a cache MISS-on-write -- and
 * never hard-fails the build. The cap tracks monthly write volume, independent of the
 * retention window.
 */
export const RELEASE_ASSET_CAP = 1000;

// The restore-result the engine consumes IS the CacheBackend's GetResult
// (actionsCache.get returns it), so re-export the single-source type from
// backend/types instead of re-declaring a structurally-identical copy that would
// silently diverge if the canonical hit variant ever grew a field (I7). Consumers
// (publish-mirror.spec) keep importing GetResult from this module unchanged.
export type { GetResult };

/** An Actions-cache entry as the publisher needs it: only its key drives the mirror. */
export interface CacheEntry {
  readonly key: string;
}

/** A GitHub Release as the publisher needs it: its id addresses the shard's assets. */
export interface PublishRelease {
  readonly id: number;
}

/**
 * The narrow injected client (D-02/D-04 seam, the ReleaseReadClient precedent). Each
 * method wraps a single Octokit call in the real 04-06 adapter and is free to throw an
 * Octokit-shaped fault carrying a numeric `status`. This module imports NO @octokit/rest:
 * the engine is pure orchestration behind this seam, so the full fault matrix is
 * unit-tested with a fault-shaped fake and no live network.
 *
 * listReleaseAssets returns the FULLY materialized set of asset names (the real adapter
 * paginates, never reading a release's inline `assets` first-page snapshot -- Pitfall 4).
 * getReleaseByTag throws a 404 when the shard does not exist yet; createRelease throws a
 * 422 when another matrix leg created the tag first.
 */
export interface PublishClient {
  listCacheEntries(): Promise<CacheEntry[]>;
  getReleaseByTag(tag: string): Promise<PublishRelease>;
  createRelease(tag: string): Promise<PublishRelease>;
  listReleaseAssets(releaseId: number): Promise<string[]>;
  uploadReleaseAsset(
    releaseId: number,
    name: string,
    bytes: Buffer,
  ): Promise<void>;
}

/** Run counts for the OBS-01 summary (D-17); the bin emits the summary from these. */
export interface PublishResult {
  readonly mirrored: number;
  readonly skipped: number;
  readonly failed: number;
}

/** Test-injection knobs only (no runtime mode surface). `now` pins the shard tag. */
export interface PublishOptions {
  readonly now?: Date;
}

/**
 * Get-or-create the month-shard release, tolerating a concurrent-create race across the
 * per-OS matrix legs (D-05). Structural fault discrimination throughout (ROBUST-01):
 * only a 404 on the lookup means "not created yet"; a 422 on create means "another leg
 * created the tag first" -> re-read. Every other status is a REAL fault and propagates,
 * never inferred as absence.
 */
async function ensureShardRelease(
  client: PublishClient,
  tag: string,
): Promise<number> {
  try {
    const release = await client.getReleaseByTag(tag);

    return release.id;
  } catch (error) {
    if (statusOf(error) !== 404) {
      throw error;
    }
  }

  try {
    const release = await client.createRelease(tag);

    return release.id;
  } catch (error) {
    if (statusOf(error) === 422) {
      const release = await client.getReleaseByTag(tag);

      return release.id;
    }

    throw error;
  }
}

/**
 * The out-of-band publish/mirror engine (D-02/D-03/D-05/D-11/D-12, TEST-03,
 * ROBUST-01/02/05, TRUST-07, OBS-01). Enumerate default-branch Actions-cache entries,
 * mirror ONLY the server-produced keys via isServerProducedKey (D-16/D-08/TRUST-08),
 * restore each hash's bytes on THIS OS leg, and upload to the current-month shard
 * release without ever overwriting:
 *
 * - Enumeration (whole-run): a listCacheEntries fault propagates so the bin fails loud.
 * - Filter (D-08/TRUST-08): only server-produced keys (prefix + a valid HASH_PATTERN
 *   suffix) are mirrored, the prefix sliced to the hash; a foreign key OR a
 *   `nx-cache-<non-hex>` key is filtered out BEFORE restore, never mirrored as a public
 *   asset (the hardening the Phase 4 startsWith-only subset lacked).
 * - Restore (D-03): a foreign-OS or evicted entry MISSes its same-OS restore and is
 *   skipped -- never an error. The shard release is ensured LAZILY, only once there is a
 *   restorable entry, so an all-MISS leg never creates an empty release.
 * - ~2 GiB boundary (D-12/ROBUST-02): a pre-upload bytes.byteLength check fails the whole
 *   run loud (core.error + throw) BEFORE any upload -- never truncate or drop.
 * - 1000-asset cap (D-11/ROBUST-05): a shard at the cap skips-and-warns (core.warning),
 *   never hard-fails.
 * - First-write-wins (D-05/TRUST-07): a name already present is a benign no-op (the shard
 *   asset set is byte-identical under CORR-01); a duplicate-upload race returning 422 is
 *   likewise benign. A real per-item fault (401/403/429/5xx) is annotated and counted but
 *   isolated so the rest of the batch still mirrors (D-13 per-item vs whole-run).
 * - Aggregate fail-loud (OBS-01/D-15): a nonzero `failed` count calls core.setFailed after
 *   the batch, so a systemic upload regression (a token whose permissions regressed, a
 *   sustained upload-phase outage) fails the job instead of reporting CI green -- mirroring
 *   cleanupMirror's aggregate check. Only the count is logged, never a token.
 *
 * Returns mirrored/skipped/failed counts; the bin emits the OBS-01 summary from them.
 */
export async function publishMirror(
  client: PublishClient,
  options: PublishOptions = {},
): Promise<PublishResult> {
  const tag = shardTag(options.now);
  const actionsCache = createActionsCacheBackend();

  const entries = await client.listCacheEntries();
  const hashes = entries
    .filter((entry) => isServerProducedKey(entry.key))
    .map((entry) => entry.key.slice(CACHE_KEY_PREFIX.length));

  let mirrored = 0;
  let skipped = 0;
  let failed = 0;
  // Restore-MISS subset of `skipped` (skipped also counts already-present + cap +
  // 422-race). Tracked separately to detect an all-restore-MISS run below.
  let readMisses = 0;

  // The shard release + its asset set, resolved lazily (as ONE sentinel: the two
  // were always set together) on the first restorable entry.
  let shard: { id: number; names: Set<string> } | undefined;

  for (const hash of hashes) {
    const restored: GetResult = await actionsCache.get(hash);

    if (restored.kind === 'miss') {
      skipped++;
      readMisses++;

      continue;
    }

    const bytes = restored.bytes;
    const name = releaseAssetName(hash);

    // D-12: deterministic pre-upload boundary check -- fail the whole run loud BEFORE any
    // upload, so an oversized artifact is never truncated or dropped (ROBUST-02).
    // Uses strict `>` to match the server's body cap (server.ts handlePut, also `>`)
    // so an entry the primary backend ACCEPTS (exactly RELEASE_ASSET_MAX_BYTES) can
    // never hard-fail the mirror -- the two 2 GiB ceilings are documented to coincide.
    if (bytes.byteLength > RELEASE_ASSET_MAX_BYTES) {
      core.error(
        `github-cache: asset ${name} is ${bytes.byteLength} bytes, over the ~2 GiB Releases ceiling; refusing to upload (never truncate).`,
      );

      throw new Error(
        'github-cache: cache asset exceeds the ~2 GiB release-asset ceiling',
      );
    }

    if (shard === undefined) {
      const id = await ensureShardRelease(client, tag);
      shard = { id, names: new Set(await client.listReleaseAssets(id)) };
    }

    // D-11: the 1000-asset per-release cap degrades to skip-and-warn, never a hard fail.
    if (shard.names.size >= RELEASE_ASSET_CAP && !shard.names.has(name)) {
      core.warning(
        `github-cache: month-shard release ${tag} is at the ${RELEASE_ASSET_CAP}-asset cap; skipping ${name} (cache MISS-on-write, not an error).`,
      );
      skipped++;

      continue;
    }

    // D-05 first-write-wins: an already-present name is a benign no-op (byte-identical
    // under CORR-01) -- no upload, never an overwrite.
    if (shard.names.has(name)) {
      skipped++;

      continue;
    }

    try {
      await client.uploadReleaseAsset(shard.id, name, bytes);
      shard.names.add(name);
      mirrored++;
    } catch (error) {
      if (statusOf(error) === 422) {
        // A duplicate-upload race (another leg wrote the same byte-identical name between
        // our list and upload) returns 422 already_exists -- benign no-op (D-05),
        // discriminated on status alone, never on body text.
        skipped++;

        continue;
      }

      // A real per-item fault (401/403/429/5xx): annotate + count, but isolate it so the
      // rest of the batch still mirrors (D-13). Only the asset name + numeric status are
      // logged -- never a token, never a raw workflow-command string.
      failed++;
      core.warning(
        `github-cache: failed to mirror ${name} (status ${statusOf(error) ?? 'unknown'}); continuing.`,
      );
    }
  }

  // Silent-degradation signal (WARN, not fail): if EVERY enumerated server-produced
  // entry restored as a MISS and nothing mirrored, that is either the legitimate
  // cross-OS case (this OS's publish leg cannot restore entries saved on another OS)
  // OR an Actions-cache read-scope regression that looks identical to "nothing to
  // do" and would otherwise exit green. A hard fail would break legitimate cross-OS
  // runs, so surface it as a warning rather than swallowing it.
  if (hashes.length > 0 && readMisses === hashes.length && mirrored === 0) {
    core.warning(
      `github-cache publish: all ${hashes.length} server-produced cache ` +
        `entr${hashes.length === 1 ? 'y' : 'ies'} restored as a MISS; nothing ` +
        'mirrored. Expected when publishing from a different OS than the entries ' +
        "were saved on; otherwise check the runtime token's Actions-cache read scope.",
    );
  }

  // OBS-01/D-15: fail the run loud on any aggregate per-item failure, mirroring
  // cleanupMirror. Per-item faults are isolated (D-13) so the batch still completes,
  // but a nonzero total means the mirror is degraded -- a token whose permissions
  // regressed or a sustained upload-phase outage would otherwise count every entry
  // into `failed` yet exit 0, reporting a fully-broken mirror as CI green. Only the
  // count is logged, never a token or a raw workflow-command string.
  if (failed > 0) {
    core.setFailed(`github-cache publish: ${failed} asset mirror(s) failed.`);
  }

  return { mirrored, skipped, failed };
}
