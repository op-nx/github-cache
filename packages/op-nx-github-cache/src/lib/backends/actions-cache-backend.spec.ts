import { describe, expect, it, vi } from 'vitest';

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
