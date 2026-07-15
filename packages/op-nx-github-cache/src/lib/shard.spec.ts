import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CACHE_MIRROR_MAX_AGE_DAYS,
  resolveMaxAgeDays,
  shardTagsForWindow,
} from './shard.js';

describe('resolveMaxAgeDays', () => {
  it('uses the configured value when it is a finite positive number', () => {
    expect(resolveMaxAgeDays('90')).toBe(90);
  });

  it('falls back to the default on a non-numeric value', () => {
    expect(resolveMaxAgeDays('not-a-number')).toBe(
      DEFAULT_CACHE_MIRROR_MAX_AGE_DAYS,
    );
  });

  it('falls back to the default on zero or negative values', () => {
    expect(resolveMaxAgeDays('0')).toBe(DEFAULT_CACHE_MIRROR_MAX_AGE_DAYS);
    expect(resolveMaxAgeDays('-5')).toBe(DEFAULT_CACHE_MIRROR_MAX_AGE_DAYS);
  });

  it('falls back to the default when unset', () => {
    expect(resolveMaxAgeDays(undefined)).toBe(
      DEFAULT_CACHE_MIRROR_MAX_AGE_DAYS,
    );
  });
});

describe('shardTagsForWindow', () => {
  it('returns exactly current + previous month at the default 30-day window', () => {
    const now = new Date('2026-07-15T00:00:00Z');

    expect(shardTagsForWindow(now, 30)).toEqual([
      'cache-mirror-202607',
      'cache-mirror-202606',
    ]);
  });

  it('is floored at 2 tags even for a very small window', () => {
    const now = new Date('2026-07-15T00:00:00Z');

    expect(shardTagsForWindow(now, 1)).toEqual([
      'cache-mirror-202607',
      'cache-mirror-202606',
    ]);
  });

  it('scans enough shards to cover a wider window across short months', () => {
    // 90 days back from March 15 lands in mid-December -- a naive
    // days/30 approximation would under-scan Jan (31 days), Feb (28 days
    // in 2026), so this must include Dec/Jan/Feb/Mar (4 shards).
    const now = new Date('2026-03-15T00:00:00Z');

    expect(shardTagsForWindow(now, 90)).toEqual([
      'cache-mirror-202603',
      'cache-mirror-202602',
      'cache-mirror-202601',
      'cache-mirror-202512',
    ]);
  });

  it('scans across a year boundary', () => {
    // 45 days back from Jan 10 lands Nov 26 -- that asset's shard is
    // November, so the window must reach back to Nov, not just Dec.
    const now = new Date('2027-01-10T00:00:00Z');

    expect(shardTagsForWindow(now, 45)).toEqual([
      'cache-mirror-202701',
      'cache-mirror-202612',
      'cache-mirror-202611',
    ]);
  });
});
