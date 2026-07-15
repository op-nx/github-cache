import { writeFile } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import { restoreCache, saveCache } from '@actions/cache';

const events: string[] = [];

vi.mock('@actions/cache', () => ({
  saveCache: vi.fn(async () => {
    events.push('save-start');
    await new Promise((resolve) => setTimeout(resolve, 20));
    events.push('save-end');

    return 1;
  }),
  restoreCache: vi.fn(async () => {
    events.push('restore-start');
    await new Promise((resolve) => setTimeout(resolve, 5));
    events.push('restore-end');

    return undefined;
  }),
}));

const { cacheArchivePath, createActionsCacheBackend } =
  await import('./actions-cache-backend.js');

describe('cacheArchivePath', () => {
  it('is deterministic for the same hash (required for @actions/cache version matching)', () => {
    expect(cacheArchivePath('abc123')).toBe(cacheArchivePath('abc123'));
  });

  it('differs across hashes', () => {
    expect(cacheArchivePath('abc123')).not.toBe(cacheArchivePath('def456'));
  });
});

describe('createActionsCacheBackend return contracts', () => {
  it('put returns "stored" when saveCache reports a real cache id', async () => {
    vi.mocked(saveCache).mockResolvedValueOnce(1);

    const backend = createActionsCacheBackend();

    await expect(backend.put('feed01', Buffer.from('x'))).resolves.toBe(
      'stored',
    );
  });

  it('put returns "conflict" when saveCache returns -1 (already cached or write denied)', async () => {
    vi.mocked(saveCache).mockResolvedValueOnce(-1);

    const backend = createActionsCacheBackend();

    await expect(backend.put('feed02', Buffer.from('x'))).resolves.toBe(
      'conflict',
    );
  });

  it('get returns the archive bytes on a restore hit', async () => {
    // @actions/cache downloads the matched archive to the path on a hit and
    // returns the matched key; emulate both so the readFile branch runs.
    vi.mocked(restoreCache).mockImplementationOnce(async (paths: string[]) => {
      await writeFile(paths[0], Buffer.from('cached-bytes'));

      return 'feed03';
    });

    const backend = createActionsCacheBackend();
    const result = await backend.get('feed03');

    expect(result?.toString()).toBe('cached-bytes');
  });

  it('get returns null on a restore miss', async () => {
    vi.mocked(restoreCache).mockResolvedValueOnce(undefined);

    const backend = createActionsCacheBackend();

    await expect(backend.get('feed04')).resolves.toBeNull();
  });
});

describe('createActionsCacheBackend concurrency', () => {
  it('serializes a concurrent get/put pair for the same hash, avoiding a torn read/write on the shared path', async () => {
    events.length = 0;

    const backend = createActionsCacheBackend();

    await Promise.all([
      backend.put('samehash', Buffer.from('payload')),
      backend.get('samehash'),
    ]);

    expect(events).toEqual([
      'save-start',
      'save-end',
      'restore-start',
      'restore-end',
    ]);
  });
});
