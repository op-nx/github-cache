import { describe, expect, it } from 'vitest';
import {
  planShardCleanup,
  resolveMinDownloadCount,
  selectAssetsToDelete,
} from './cleanup.js';

const NOW = new Date('2026-07-15T00:00:00Z');
const now = () => NOW;

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

describe('selectAssetsToDelete', () => {
  it('deletes assets older than maxAgeDays and keeps newer ones', () => {
    const assets = [
      { name: 'old.tar.gz', createdAt: daysAgo(31), downloadCount: 0 },
      { name: 'new.tar.gz', createdAt: daysAgo(1), downloadCount: 0 },
    ];

    const result = selectAssetsToDelete(assets, {
      maxAgeDays: 30,
      minDownloadCountToKeep: 0,
      now,
    });

    expect(result.map((asset) => asset.name)).toEqual(['old.tar.gz']);
  });

  it('deletes all old assets by default (minDownloadCountToKeep 0 disables the popularity floor)', () => {
    const assets = [
      {
        name: 'popular-old.tar.gz',
        createdAt: daysAgo(60),
        downloadCount: 10_000,
      },
    ];

    const result = selectAssetsToDelete(assets, {
      maxAgeDays: 30,
      minDownloadCountToKeep: 0,
      now,
    });

    expect(result).toHaveLength(1);
  });

  it('protects an old-but-popular asset once minDownloadCountToKeep is configured', () => {
    const assets = [
      {
        name: 'popular-old.tar.gz',
        createdAt: daysAgo(60),
        downloadCount: 100,
      },
      {
        name: 'unpopular-old.tar.gz',
        createdAt: daysAgo(60),
        downloadCount: 5,
      },
    ];

    const result = selectAssetsToDelete(assets, {
      maxAgeDays: 30,
      minDownloadCountToKeep: 50,
      now,
    });

    expect(result.map((asset) => asset.name)).toEqual(['unpopular-old.tar.gz']);
  });

  it('keeps an asset exactly maxAgeDays old (age check is strict >, not >=)', () => {
    const result = selectAssetsToDelete(
      [{ name: 'exact.tar.gz', createdAt: daysAgo(30), downloadCount: 0 }],
      { maxAgeDays: 30, minDownloadCountToKeep: 0, now },
    );

    expect(result).toHaveLength(0);
  });

  it('protects an old asset whose downloadCount equals the floor (>= boundary)', () => {
    const result = selectAssetsToDelete(
      [{ name: 'at-floor.tar.gz', createdAt: daysAgo(60), downloadCount: 50 }],
      { maxAgeDays: 30, minDownloadCountToKeep: 50, now },
    );

    expect(result).toHaveLength(0);
  });

  it('never deletes a young asset regardless of download count', () => {
    const assets = [
      {
        name: 'young-unpopular.tar.gz',
        createdAt: daysAgo(1),
        downloadCount: 0,
      },
    ];

    const result = selectAssetsToDelete(assets, {
      maxAgeDays: 30,
      minDownloadCountToKeep: 50,
      now,
    });

    expect(result).toHaveLength(0);
  });
});

describe('resolveMinDownloadCount', () => {
  it('uses a finite positive value, floored to whole downloads', () => {
    expect(resolveMinDownloadCount('50')).toBe(50);
    expect(resolveMinDownloadCount('5.9')).toBe(5);
  });

  it('falls back to 0 (floor off) on non-numeric, negative, or unset values', () => {
    expect(resolveMinDownloadCount('not-a-number')).toBe(0);
    expect(resolveMinDownloadCount('-5')).toBe(0);
    expect(resolveMinDownloadCount('0')).toBe(0);
    expect(resolveMinDownloadCount(undefined)).toBe(0);
  });
});

describe('planShardCleanup', () => {
  const options = { maxAgeDays: 30, minDownloadCountToKeep: 0, now };

  it('selects old assets for deletion and keeps young ones', () => {
    const assets = [
      { name: 'old.tar.gz', createdAt: daysAgo(31), downloadCount: 0 },
      { name: 'new.tar.gz', createdAt: daysAgo(1), downloadCount: 0 },
    ];

    const plan = planShardCleanup(assets, options, true);

    expect(plan.assetsToDelete.map((asset) => asset.name)).toEqual([
      'old.tar.gz',
    ]);
    expect(plan.deleteRelease).toBe(false);
  });

  it('deletes the release when the shard is emptied and deletion is allowed', () => {
    const assets = [
      { name: 'old.tar.gz', createdAt: daysAgo(31), downloadCount: 0 },
    ];

    expect(planShardCleanup(assets, options, true).deleteRelease).toBe(true);
  });

  it('never deletes the release when deletion is disallowed (the just-uploaded current shard)', () => {
    const assets = [
      { name: 'old.tar.gz', createdAt: daysAgo(31), downloadCount: 0 },
    ];

    expect(planShardCleanup(assets, options, false).deleteRelease).toBe(false);
  });

  it('retries deleting an already-empty release', () => {
    expect(planShardCleanup([], options, true).deleteRelease).toBe(true);
  });

  it('does not delete the release while assets remain', () => {
    const assets = [
      { name: 'old.tar.gz', createdAt: daysAgo(31), downloadCount: 0 },
      { name: 'young.tar.gz', createdAt: daysAgo(1), downloadCount: 0 },
    ];

    expect(planShardCleanup(assets, options, true).deleteRelease).toBe(false);
  });
});
