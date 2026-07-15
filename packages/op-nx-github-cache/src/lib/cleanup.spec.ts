import { describe, expect, it } from 'vitest';
import { planShardCleanup, selectAssetsToDelete } from './cleanup.js';

const NOW = new Date('2026-07-15T00:00:00Z');
const now = () => NOW;

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

describe('selectAssetsToDelete', () => {
  it('deletes assets older than maxAgeDays and keeps newer ones', () => {
    const assets = [
      { name: 'old.tar.gz', createdAt: daysAgo(31) },
      { name: 'new.tar.gz', createdAt: daysAgo(1) },
    ];

    const result = selectAssetsToDelete(assets, { maxAgeDays: 30, now });

    expect(result.map((asset) => asset.name)).toEqual(['old.tar.gz']);
  });

  it('keeps an asset exactly maxAgeDays old (age check is strict >, not >=)', () => {
    const result = selectAssetsToDelete(
      [{ name: 'exact.tar.gz', createdAt: daysAgo(30) }],
      { maxAgeDays: 30, now },
    );

    expect(result).toHaveLength(0);
  });

  it('never deletes a young asset', () => {
    const result = selectAssetsToDelete(
      [{ name: 'young.tar.gz', createdAt: daysAgo(1) }],
      { maxAgeDays: 30, now },
    );

    expect(result).toHaveLength(0);
  });

  it('keeps an asset with an unparseable createdAt rather than deleting it', () => {
    // new Date('nonsense').getTime() is NaN, so ageMs is NaN and `NaN > max`
    // is false -- the fail-safe direction is to keep, never to delete.
    const result = selectAssetsToDelete(
      [{ name: 'weird.tar.gz', createdAt: 'not-a-date' }],
      { maxAgeDays: 30, now },
    );

    expect(result).toHaveLength(0);
  });
});

describe('planShardCleanup', () => {
  const options = { maxAgeDays: 30, now };

  it('selects old assets for deletion and keeps young ones', () => {
    const assets = [
      { name: 'old.tar.gz', createdAt: daysAgo(31) },
      { name: 'new.tar.gz', createdAt: daysAgo(1) },
    ];

    const plan = planShardCleanup(assets, options, true);

    expect(plan.assetsToDelete.map((asset) => asset.name)).toEqual([
      'old.tar.gz',
    ]);
    expect(plan.deleteRelease).toBe(false);
  });

  it('deletes the release when the shard is emptied and deletion is allowed', () => {
    const assets = [{ name: 'old.tar.gz', createdAt: daysAgo(31) }];

    expect(planShardCleanup(assets, options, true).deleteRelease).toBe(true);
  });

  it('never deletes the release when deletion is disallowed (the just-uploaded current shard)', () => {
    const assets = [{ name: 'old.tar.gz', createdAt: daysAgo(31) }];

    expect(planShardCleanup(assets, options, false).deleteRelease).toBe(false);
  });

  it('retries deleting an already-empty release', () => {
    expect(planShardCleanup([], options, true).deleteRelease).toBe(true);
  });

  it('does not delete the release while assets remain', () => {
    const assets = [
      { name: 'old.tar.gz', createdAt: daysAgo(31) },
      { name: 'young.tar.gz', createdAt: daysAgo(1) },
    ];

    expect(planShardCleanup(assets, options, true).deleteRelease).toBe(false);
  });
});
