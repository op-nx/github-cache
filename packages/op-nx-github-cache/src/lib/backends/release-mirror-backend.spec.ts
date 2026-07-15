import { describe, expect, it, vi } from 'vitest';
import { createReleaseMirrorBackend } from './release-mirror-backend.js';
import { monthTag } from '../shard.js';

const NOW = new Date('2026-07-15T00:00:00Z');
const CURRENT_TAG = monthTag(NOW);
const PRIOR_TAG = 'cache-mirror-202606';

function notFoundError(): Error & { status: number } {
  const error = new Error('Not Found') as Error & { status: number };

  error.status = 404;

  return error;
}

// The backend resolves a shard to a release (getReleaseByTag), pages its assets
// (paginate(listReleaseAssets)), then downloads by id (getReleaseAsset). Tests
// stub all three plus `paginate`.
function makeOctokit(overrides: {
  getReleaseByTag: ReturnType<typeof vi.fn>;
  paginate?: ReturnType<typeof vi.fn>;
  getReleaseAsset?: ReturnType<typeof vi.fn>;
}) {
  return {
    paginate: overrides.paginate ?? vi.fn().mockResolvedValue([]),
    rest: {
      repos: {
        getReleaseByTag: overrides.getReleaseByTag,
        listReleaseAssets: vi.fn(),
        getReleaseAsset: overrides.getReleaseAsset ?? vi.fn(),
      },
    },
  } as never;
}

describe('createReleaseMirrorBackend', () => {
  it('returns the asset content when found in the current month shard', async () => {
    const getReleaseByTag = vi
      .fn()
      .mockResolvedValue({ data: { id: 100, assets: [] } });
    const paginate = vi
      .fn()
      .mockResolvedValue([{ id: 1, name: 'abc123.tar.gz' }]);
    const getReleaseAsset = vi
      .fn()
      .mockResolvedValue({ data: Buffer.from('payload') });
    const octokit = makeOctokit({ getReleaseByTag, paginate, getReleaseAsset });

    const backend = createReleaseMirrorBackend({
      owner: 'op-nx',
      repo: 'github-cache',
      octokit,
      now: () => NOW,
    });
    const result = await backend.get('abc123');

    expect(getReleaseByTag).toHaveBeenCalledWith({
      owner: 'op-nx',
      repo: 'github-cache',
      tag: CURRENT_TAG,
    });
    expect(getReleaseAsset).toHaveBeenCalledWith(
      expect.objectContaining({ asset_id: 1 }),
    );
    expect(result?.toString()).toBe('payload');
  });

  it('falls back to the prior month shard when the current month misses', async () => {
    const getReleaseByTag = vi
      .fn()
      .mockRejectedValueOnce(notFoundError())
      .mockResolvedValueOnce({ data: { id: 200, assets: [] } });
    const paginate = vi
      .fn()
      .mockResolvedValue([{ id: 2, name: 'abc123.tar.gz' }]);
    const getReleaseAsset = vi
      .fn()
      .mockResolvedValue({ data: Buffer.from('prior-month-payload') });
    const octokit = makeOctokit({ getReleaseByTag, paginate, getReleaseAsset });

    const backend = createReleaseMirrorBackend({
      owner: 'op-nx',
      repo: 'github-cache',
      octokit,
      now: () => NOW,
    });
    const result = await backend.get('abc123');

    expect(getReleaseByTag).toHaveBeenNthCalledWith(1, {
      owner: 'op-nx',
      repo: 'github-cache',
      tag: CURRENT_TAG,
    });
    expect(getReleaseByTag).toHaveBeenNthCalledWith(2, {
      owner: 'op-nx',
      repo: 'github-cache',
      tag: PRIOR_TAG,
    });
    expect(result?.toString()).toBe('prior-month-payload');
  });

  it('returns null after both shards miss', async () => {
    const getReleaseByTag = vi.fn().mockRejectedValue(notFoundError());
    const octokit = makeOctokit({ getReleaseByTag });

    const backend = createReleaseMirrorBackend({
      owner: 'op-nx',
      repo: 'github-cache',
      octokit,
      now: () => NOW,
    });
    const result = await backend.get('abc123');

    expect(getReleaseByTag).toHaveBeenCalledTimes(2);
    expect(result).toBeNull();
  });

  it('rethrows a non-404 error instead of masking it as a cache miss', async () => {
    // A rate-limit/5xx must propagate (fail-open-to-miss happens one layer up
    // in server.ts). It must NEVER be cached as a null shard, which would
    // poison every later read for the process lifetime.
    const serverError = Object.assign(new Error('boom'), { status: 500 });
    const getReleaseByTag = vi.fn().mockRejectedValue(serverError);
    const octokit = makeOctokit({ getReleaseByTag });

    const backend = createReleaseMirrorBackend({
      owner: 'op-nx',
      repo: 'github-cache',
      octokit,
      now: () => NOW,
    });

    await expect(backend.get('abc123')).rejects.toThrow('boom');
  });

  it('caches a missing shard as null so repeated lookups do not re-hit the API', async () => {
    const getReleaseByTag = vi.fn().mockRejectedValue(notFoundError());
    const octokit = makeOctokit({ getReleaseByTag });

    const backend = createReleaseMirrorBackend({
      owner: 'op-nx',
      repo: 'github-cache',
      octokit,
      now: () => NOW,
    });

    await backend.get('aaa');
    await backend.get('bbb');

    // The window is two shards (current + prior). Each is resolved once total
    // across both lookups, not once per lookup -- the null is cached.
    expect(getReleaseByTag).toHaveBeenCalledTimes(2);
  });

  it('finds an asset returned only by the paginated list, not the embedded snapshot', async () => {
    // getReleaseByTag's embedded `assets` is empty (a truncated snapshot); the
    // real asset only comes back through the paginated listReleaseAssets call.
    // This fails against a read path that scans `release.data.assets`.
    const getReleaseByTag = vi
      .fn()
      .mockResolvedValue({ data: { id: 100, assets: [] } });
    const paginate = vi.fn().mockResolvedValue([
      { id: 9, name: 'other.tar.gz' },
      { id: 7, name: 'abc123.tar.gz' },
    ]);
    const getReleaseAsset = vi
      .fn()
      .mockResolvedValue({ data: Buffer.from('deep-page') });
    const octokit = makeOctokit({ getReleaseByTag, paginate, getReleaseAsset });

    const backend = createReleaseMirrorBackend({
      owner: 'op-nx',
      repo: 'github-cache',
      octokit,
      now: () => NOW,
    });
    const result = await backend.get('abc123');

    expect(paginate).toHaveBeenCalled();
    expect(getReleaseAsset).toHaveBeenCalledWith(
      expect.objectContaining({ asset_id: 7 }),
    );
    expect(result?.toString()).toBe('deep-page');
  });

  it('caches a shard asset list so repeated lookups do not re-hit the API', async () => {
    const getReleaseByTag = vi
      .fn()
      .mockResolvedValue({ data: { id: 100, assets: [] } });
    const paginate = vi.fn().mockResolvedValue([
      { id: 1, name: 'aaa.tar.gz' },
      { id: 2, name: 'bbb.tar.gz' },
    ]);
    const getReleaseAsset = vi
      .fn()
      .mockResolvedValue({ data: Buffer.from('x') });
    const octokit = makeOctokit({ getReleaseByTag, paginate, getReleaseAsset });

    const backend = createReleaseMirrorBackend({
      owner: 'op-nx',
      repo: 'github-cache',
      octokit,
      now: () => NOW,
    });

    await backend.get('aaa');
    await backend.get('bbb');

    // Both hashes live in the current shard: its release + asset list are
    // fetched once total, not once per lookup.
    expect(getReleaseByTag).toHaveBeenCalledTimes(1);
    expect(paginate).toHaveBeenCalledTimes(1);
    expect(getReleaseAsset).toHaveBeenCalledTimes(2);
  });

  it('always refuses writes', async () => {
    const octokit = makeOctokit({ getReleaseByTag: vi.fn() });
    const backend = createReleaseMirrorBackend({
      owner: 'op-nx',
      repo: 'github-cache',
      octokit,
      now: () => NOW,
    });

    await expect(backend.put('abc123', Buffer.from('x'))).resolves.toBe(
      'forbidden',
    );
  });
});
