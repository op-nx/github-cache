/**
 * Retention resolution for the GitHub Releases mirror (D-07/D-08). ONE coupled knob,
 * `CACHE_MIRROR_MAX_AGE_DAYS`, drives BOTH the reader's month-shard read window
 * (`shardTagsForWindow`) AND the scheduled cleanup's prune window, through this single
 * resolver. Never introduce a second knob: a read window that drifts from the retention
 * window makes an asset simultaneously unreadable (reads never scan its shard) and
 * unprunable (cleanup never visits it), leaking toward the 1000-asset-per-release cap.
 *
 * LOAD-BEARING, comment-locked (Pitfall 7). The `cache-mirror-YYYYMM` month-shard tag
 * scheme lives HERE and nowhere else -- both the Phase 3 reader and the Phase 4 publisher
 * derive their tags through these helpers, and `shardTagsForWindow` reuses `shardTag` so
 * the template exists in exactly one place. A drift between two tag derivations is a
 * SILENT cross-OS MISS -- no error, no crash, just a wave of rebuilds when a reader looks
 * under a tag the publisher never wrote. Never inline the template, never "tidy" it, and
 * never change the separator or the UTC/zero-pad rules without re-verifying an end-to-end
 * cross-OS read; the failure mode is a silent MISS, not a crash. The exact produced tags
 * are pinned by retention.spec.ts.
 */

/** Retention/read window when the knob is unset or invalid (D-07); matches the shard quantum. */
const DEFAULT_MAX_AGE_DAYS = 30;

/** Clamp ceiling so a fat-fingered knob cannot explode the shard walk or the prune scan (V5, T-04-04). */
const MAX_AGE_CEILING_DAYS = 365;

/** Milliseconds per day. Exported as the single time-window source shared by the cleanup engine's cutoff (I8: one home). */
export const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * The month-shard release tag: `cache-mirror-` plus the UTC year and zero-padded month
 * (e.g. cache-mirror-202607). Moved verbatim from the Phase 3 releases-backend seam so the
 * tag scheme has exactly one home. Computed from the clock (not a fixed constant) so it
 * already tracks the current month.
 */
/**
 * The month-shard tag prefix. Authored HERE, the one home for the tag scheme, so the
 * cleanup engine's `startsWith` scope filter cannot drift from the tag shardTag builds
 * (I8). Never inline a second copy of this literal.
 */
export const SHARD_TAG_PREFIX = 'cache-mirror-';

export function shardTag(date: Date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');

  return `${SHARD_TAG_PREFIX}${year}${month}`;
}

/**
 * Resolve the single coupled retention knob `CACHE_MIRROR_MAX_AGE_DAYS` (D-07). It is
 * untrusted numeric input from the consumer env, so it is validated + clamped at this
 * trust boundary (T-04-04): an unset, non-numeric, zero, or negative value falls back to
 * `DEFAULT_MAX_AGE_DAYS` (30); a finite positive value is floored, then clamped into
 * `[1, MAX_AGE_CEILING_DAYS]` (1..365). Both the reader window and the cleanup scan
 * resolve here.
 *
 * The 1-day FLOOR is load-bearing, not cosmetic: a sub-1-day value like `0.5` passes the
 * `raw <= 0` guard yet `Math.floor(0.5)` is 0, and a 0-day window makes cleanup's
 * `cutoff = Date.now() - 0 = now`, so EVERY asset (all created before now) is pruned --
 * wiping the whole in-window mirror, including the retention-locked set the one
 * non-negotiable rule says must never be deleted. Flooring to 1 keeps at least a
 * one-day window (matching the shard quantum's smallest safe value).
 */
export function resolveMaxAgeDays(
  env: NodeJS.ProcessEnv = process.env,
): number {
  const raw = Number(env.CACHE_MIRROR_MAX_AGE_DAYS);

  if (!Number.isFinite(raw) || raw <= 0) {
    return DEFAULT_MAX_AGE_DAYS;
  }

  return Math.max(1, Math.min(Math.floor(raw), MAX_AGE_CEILING_DAYS));
}

/**
 * The month-shard tags covering `[now - maxAgeDays, now]`, NEWEST FIRST. Uses calendar-month
 * arithmetic via a UTC month cursor -- NOT `maxAgeDays / 30`, which would under-scan short
 * months and mis-handle month boundaries (a 30-day window in early March reaches back into
 * January). The reader walks these newest-first and stops at the first hit; only exhausting
 * every tag is a MISS (D-08). Pure with an injectable `now` for deterministic tests.
 */
export function shardTagsForWindow(
  maxAgeDays: number,
  now: Date = new Date(),
): string[] {
  const oldest = new Date(now.getTime() - maxAgeDays * MS_PER_DAY);
  const oldestMonthStart = Date.UTC(
    oldest.getUTCFullYear(),
    oldest.getUTCMonth(),
    1,
  );
  const cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const tags: string[] = [];

  while (cursor.getTime() >= oldestMonthStart) {
    tags.push(shardTag(cursor));
    cursor.setUTCMonth(cursor.getUTCMonth() - 1);
  }

  return tags;
}
