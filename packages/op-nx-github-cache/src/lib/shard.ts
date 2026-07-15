// Default cache-mirror retention window, in days. Kept here (not just in
// publish-mirror.ts) so both the write side (cleanup) and the read side
// (release-mirror-backend's lookback) resolve the same value from the same
// place -- resolveMaxAgeDays() and shardTagsForWindow() below are the shared
// coupling that keeps "how long assets are kept" and "how far back reads
// look" from drifting apart.
export const DEFAULT_CACHE_MIRROR_MAX_AGE_DAYS = 30;

// ~10 years: shardTagsForWindow scans roughly one shard per month of this
// value, and each shard costs a GitHub API call on every read/cleanup run --
// a fat-fingered CACHE_MIRROR_MAX_AGE_DAYS (e.g. accidentally in some other
// unit) must not translate into thousands of API calls.
export const MAX_CACHE_MIRROR_MAX_AGE_DAYS = 3650;

export function monthTag(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');

  return `cache-mirror-${year}${month}`;
}

// A non-numeric or non-positive override must not silently disable the
// window (Number(bad) is NaN, and a NaN/zero/negative retention would either
// compare false against every asset age or delete everything immediately) --
// fall back to the default instead, matching resolveMaxBodyBytes's
// fail-closed shape in server.ts. An excessively large override is clamped
// rather than rejected, since the operator's intent (a long retention
// window) is still honored -- just bounded to a sane worst-case shard count.
export function resolveMaxAgeDays(envValue: string | undefined): number {
  const configured = Number(envValue);

  if (!Number.isFinite(configured) || configured <= 0) {
    return DEFAULT_CACHE_MIRROR_MAX_AGE_DAYS;
  }

  return Math.min(configured, MAX_CACHE_MIRROR_MAX_AGE_DAYS);
}

// Returns shard month-tags from the current month back through the month
// containing `now - maxAgeDays`, inclusive -- i.e. every shard that could
// still hold a live (non-cleaned-up) asset. Uses real date arithmetic rather
// than a maxAgeDays/30 approximation, since a fixed divisor under-scans
// across short months (e.g. a 30-day window spanning March 1 back through
// January 31 needs 3 calendar-month shards, not 2). Floored at 2 tags
// (current + previous) so a very small maxAgeDays doesn't shrink the window
// below what release-mirror-backend.spec.ts already exercises at the
// default.
export function shardTagsForWindow(now: Date, maxAgeDays: number): string[] {
  const cutoff = new Date(now.getTime() - maxAgeDays * 24 * 60 * 60 * 1000);
  const cutoffMonthStart = Date.UTC(
    cutoff.getUTCFullYear(),
    cutoff.getUTCMonth(),
    1,
  );

  const tags: string[] = [];
  let cursor = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);

  while (tags.length < 2 || cursor >= cutoffMonthStart) {
    tags.push(monthTag(new Date(cursor)));
    const cursorDate = new Date(cursor);

    cursor = Date.UTC(cursorDate.getUTCFullYear(), cursorDate.getUTCMonth() - 1, 1);
  }

  return tags;
}
