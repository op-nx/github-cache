import { describe, expect, it, vi } from 'vitest';
import {
  createReleaseMirrorBackend,
  monthTag,
} from './release-mirror-backend.js';

const NOW = new Date('2026-07-15T00:00:00Z');
const CURRENT_TAG = monthTag(NOW);
const PRIOR_TAG = 'cache-mirror-202606';

function notFoundError(): Error & { status: number } {
  const error = new Error('Not Found') as Error & { status: number };

  error.status = 404;

  return error;
}

describe('createReleaseMirrorBackend', () => {
  it('returns the asset content when found in the current month shard', async () => {
    const getReleaseByTag = vi.fn().mockResolvedValue({
      data: { assets: [{ id: 1, name: 'abc123.tar.gz' }] },
    });
    const getReleaseAsset = vi
      .fn()
      .mockResolvedValue({ data: Buffer.from('payload') });
    const octokit = {
      rest: { repos: { getReleaseByTag, getReleaseAsset } },
    } as never;

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
    expect(result?.toString()).toBe('payload');
  });

  it('falls back to the prior month shard when the current month misses', async () => {
    const getReleaseByTag = vi
      .fn()
      .mockRejectedValueOnce(notFoundError())
      .mockResolvedValueOnce({
        data: { assets: [{ id: 2, name: 'abc123.tar.gz' }] },
      });
    const getReleaseAsset = vi
      .fn()
      .mockResolvedValue({ data: Buffer.from('prior-month-payload') });
    const octokit = {
      rest: { repos: { getReleaseByTag, getReleaseAsset } },
    } as never;

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
    const octokit = {
      rest: { repos: { getReleaseByTag, getReleaseAsset: vi.fn() } },
    } as never;

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

  it('always refuses writes', async () => {
    const octokit = {
      rest: { repos: { getReleaseByTag: vi.fn(), getReleaseAsset: vi.fn() } },
    } as never;
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
