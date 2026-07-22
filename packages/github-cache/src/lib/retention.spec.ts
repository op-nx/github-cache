import { describe, expect, it } from 'vitest';
import {
  isShardTag,
  resolveMaxAgeDays,
  SHARD_TAG_PATTERN,
  SHARD_TAG_PREFIX,
  shardTag,
  shardTagsForWindow,
} from './retention.js';

// Moved here verbatim from releases-backend.spec.ts (Phase 3's single-shard seam):
// retention.ts is now the single home for the cache-mirror-YYYYMM tag scheme, so its
// pins live beside the window walk that shares the same template. Pinned as a string
// literal (not rebuilt from the impl's template) so a cosmetic change to the tag scheme
// fails HERE rather than silently reading a different shard (Pitfall 7).
describe('shardTag current-month single-shard tag (D-03/D-08)', () => {
  it('is exactly cache-mirror-202607 for a July 2026 date', () => {
    expect(shardTag(new Date('2026-07-19'))).toBe('cache-mirror-202607');
  });

  it('zero-pads the month and reads year+month in UTC', () => {
    expect(shardTag(new Date('2026-01-05T00:00:00Z'))).toBe(
      'cache-mirror-202601',
    );
    expect(shardTag(new Date('2026-12-31T00:00:00Z'))).toBe(
      'cache-mirror-202612',
    );
  });
});

describe('isShardTag exact month-shard accepter (I8, Pitfall 4)', () => {
  // The exact accept/reject sets are pinned so the cleanup scope narrowing cannot
  // silently widen back to a loose `startsWith` prefix. \d{6} matches every YYYYMM
  // month shard (deliberately wider than the reader window) but rejects any
  // non-shard cache-mirror-* tag.
  it.each([
    'cache-mirror-202607',
    'cache-mirror-202601',
    'cache-mirror-202612',
  ])('accepts the genuine month shard %s', (tag) => {
    expect(isShardTag(tag)).toBe(true);
  });

  it.each([
    'cache-mirror-',
    'cache-mirror-2026',
    'cache-mirror-20260',
    'cache-mirror-2026070',
    'cache-mirror-latest',
    'cache-mirror-backup',
    'cache-mirror-2026-07',
    'v1.0.0',
  ])('rejects the non-shard tag %s', (tag) => {
    expect(isShardTag(tag)).toBe(false);
  });

  it('round-trips with shardTag so the accepter never drifts from the producer', () => {
    expect(isShardTag(shardTag(new Date('2026-07-19')))).toBe(true);
    expect(isShardTag(shardTag(new Date('2026-01-05T00:00:00Z')))).toBe(true);
    expect(isShardTag(shardTag(new Date('2026-12-31T00:00:00Z')))).toBe(true);
  });

  it('derives from the single-sourced SHARD_TAG_PREFIX (one home for the scheme)', () => {
    // Pin the prefix literal and the derived pattern so a cosmetic edit fails HERE
    // rather than silently scoping a different tag set (Pitfall 7).
    expect(SHARD_TAG_PREFIX).toBe('cache-mirror-');
    expect(SHARD_TAG_PATTERN.test('cache-mirror-202607')).toBe(true);
    expect(SHARD_TAG_PATTERN.test('cache-mirror-latest')).toBe(false);
  });
});

describe('resolveMaxAgeDays one coupled knob (D-07, T-04-04)', () => {
  it('defaults to 30 when CACHE_MIRROR_MAX_AGE_DAYS is unset', () => {
    expect(resolveMaxAgeDays({})).toBe(30);
  });

  it('defaults to 30 for a non-numeric value', () => {
    expect(resolveMaxAgeDays({ CACHE_MIRROR_MAX_AGE_DAYS: 'abc' })).toBe(30);
  });

  it('defaults to 30 for an empty string', () => {
    expect(resolveMaxAgeDays({ CACHE_MIRROR_MAX_AGE_DAYS: '' })).toBe(30);
  });

  it('defaults to 30 for zero', () => {
    expect(resolveMaxAgeDays({ CACHE_MIRROR_MAX_AGE_DAYS: '0' })).toBe(30);
  });

  it('defaults to 30 for a negative value', () => {
    expect(resolveMaxAgeDays({ CACHE_MIRROR_MAX_AGE_DAYS: '-5' })).toBe(30);
  });

  it('defaults to 30 for a non-finite value', () => {
    expect(resolveMaxAgeDays({ CACHE_MIRROR_MAX_AGE_DAYS: 'Infinity' })).toBe(
      30,
    );
  });

  it('accepts a valid in-range value', () => {
    expect(resolveMaxAgeDays({ CACHE_MIRROR_MAX_AGE_DAYS: '30' })).toBe(30);
  });

  it('accepts the 7-day floor itself without an override', () => {
    expect(resolveMaxAgeDays({ CACHE_MIRROR_MAX_AGE_DAYS: '7' })).toBe(7);
  });

  it('clamps a value over the 365-day ceiling', () => {
    expect(resolveMaxAgeDays({ CACHE_MIRROR_MAX_AGE_DAYS: '400' })).toBe(365);
  });

  it('floors a fractional in-range value', () => {
    expect(resolveMaxAgeDays({ CACHE_MIRROR_MAX_AGE_DAYS: '10.9' })).toBe(10);
  });
});

describe('resolveMaxAgeDays 7-day policy floor (F09, restic empty-policy refusal)', () => {
  // The floor rejects a catastrophic CONFIG, never a valid run -- restic/borg guard
  // the policy and the scope, never the outcome volume. A ratio breaker was rejected
  // in CONTEXT.md precisely because an aborting breaker is itself a way for retention
  // to silently stop running forever; this only ever throws on a bad config.
  it('throws for a finite positive value below the 7-day floor, naming the floor and the override knob', () => {
    for (const days of ['1', '2', '3', '6']) {
      expect(() =>
        resolveMaxAgeDays({ CACHE_MIRROR_MAX_AGE_DAYS: days }),
      ).toThrow(/7/);
      expect(() =>
        resolveMaxAgeDays({ CACHE_MIRROR_MAX_AGE_DAYS: days }),
      ).toThrow(/CACHE_MIRROR_ALLOW_AGGRESSIVE_RETENTION/);
    }
  });

  it('resolves a sub-floor value when the aggressive-retention opt-in is set', () => {
    expect(
      resolveMaxAgeDays({
        CACHE_MIRROR_MAX_AGE_DAYS: '1',
        CACHE_MIRROR_ALLOW_AGGRESSIVE_RETENTION: 'true',
      }),
    ).toBe(1);
  });

  it('keeps the 1-day hard floor on the override path (a sub-1-day value still resolves to 1, never 0)', () => {
    // The override widens what is allowed; it does not remove the clamp. A value in
    // (0,1) floors to 0, which would make cleanup's cutoff = now and prune the whole
    // in-window mirror -- so Math.max(1, ...) still applies.
    expect(
      resolveMaxAgeDays({
        CACHE_MIRROR_MAX_AGE_DAYS: '0.5',
        CACHE_MIRROR_ALLOW_AGGRESSIVE_RETENTION: 'true',
      }),
    ).toBe(1);
  });

  it('never blocks a valid policy: unset/zero/negative/non-numeric still fall back to 30', () => {
    expect(resolveMaxAgeDays({})).toBe(30);
    expect(resolveMaxAgeDays({ CACHE_MIRROR_MAX_AGE_DAYS: '0' })).toBe(30);
    expect(resolveMaxAgeDays({ CACHE_MIRROR_MAX_AGE_DAYS: '-5' })).toBe(30);
    expect(resolveMaxAgeDays({ CACHE_MIRROR_MAX_AGE_DAYS: 'abc' })).toBe(30);
  });
});

describe('shardTagsForWindow calendar-month walk, newest first (D-08)', () => {
  it('returns the current then prior month for a 30-day window', () => {
    // now - 30d reaches 2026-06-20, so June is in the window; newest first.
    expect(shardTagsForWindow(30, new Date('2026-07-20T00:00:00Z'))).toEqual([
      'cache-mirror-202607',
      'cache-mirror-202606',
    ]);
  });

  it('walks across a December->January boundary, newest first', () => {
    // now - 30d reaches 2026-12-06; the array crosses the year boundary.
    expect(shardTagsForWindow(30, new Date('2027-01-05T00:00:00Z'))).toEqual([
      'cache-mirror-202701',
      'cache-mirror-202612',
    ]);
  });

  it('does NOT under-scan a 28-day February: every calendar month touched is present', () => {
    // The naive maxAgeDays/30 heuristic would yield ONE month here and MISS the shards
    // the window actually reaches. 30 days before 2027-03-01 is 2027-01-30 (Feb has 28
    // days in 2027), so March, February AND January are all in the window, newest first.
    expect(shardTagsForWindow(30, new Date('2027-03-01T00:00:00Z'))).toEqual([
      'cache-mirror-202703',
      'cache-mirror-202702',
      'cache-mirror-202701',
    ]);
  });

  it('returns exactly the current month for a single-day mid-month window', () => {
    expect(shardTagsForWindow(1, new Date('2026-07-15T00:00:00Z'))).toEqual([
      'cache-mirror-202607',
    ]);
  });

  it('includes the prior month for a single-day window that crosses the month start', () => {
    expect(shardTagsForWindow(1, new Date('2026-07-01T12:00:00Z'))).toEqual([
      'cache-mirror-202607',
      'cache-mirror-202606',
    ]);
  });
});
