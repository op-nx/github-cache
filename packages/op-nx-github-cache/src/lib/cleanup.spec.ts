import { describe, expect, it } from 'vitest';
import { selectAssetsToDelete } from './cleanup.js';

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
