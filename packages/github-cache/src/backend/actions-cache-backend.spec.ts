import { existsSync } from 'node:fs';
import { rm, writeFile } from 'node:fs/promises';
import * as cache from '@actions/cache';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cacheArchivePath } from '../lib/cache-archive-path.js';
import {
  cacheKeyFor,
  createActionsCacheBackend,
} from './actions-cache-backend.js';

// First module mock in this repository. @actions/cache only actually works inside
// a JS action on real CI, so every unit layer MUST mock it and prove the backend
// mapping against the recorded call arguments (02-RESEARCH.md "Don't Hand-Roll";
// the spec-file table in 02-PATTERNS.md notes module mocking has no in-repo
// precedent and must come from research). vi.mock hoists above the imports and
// auto-replaces each @actions/cache export with a vi.fn().
vi.mock('@actions/cache');

const restoreCache = vi.mocked(cache.restoreCache);
const saveCache = vi.mocked(cache.saveCache);

const HASH = 'abc123';

afterEach(async () => {
  vi.resetAllMocks();
  await rm(cacheArchivePath(HASH), { force: true });
});

describe('createActionsCacheBackend get (ROBUST-03)', () => {
  it('returns a hit with the restored archive bytes when restoreCache matches a key (ROBUST-03)', async () => {
    const bytes = Buffer.from('tar-bytes');
    await writeFile(cacheArchivePath(HASH), bytes);
    restoreCache.mockResolvedValue(cacheKeyFor(HASH));
    const backend = createActionsCacheBackend();

    const result = await backend.get(HASH);

    expect(result).toEqual({ kind: 'hit', bytes });
  });

  it('returns a miss when restoreCache resolves undefined (ROBUST-03)', async () => {
    restoreCache.mockResolvedValue(undefined);
    const backend = createActionsCacheBackend();

    const result = await backend.get(HASH);

    expect(result).toEqual({ kind: 'miss' });
  });
});

describe('createActionsCacheBackend put (ROBUST-03)', () => {
  it('returns "stored" on a positive saveCache id (ROBUST-03)', async () => {
    saveCache.mockResolvedValue(42);
    const backend = createActionsCacheBackend();

    const result = await backend.put(HASH, Buffer.from('tar-bytes'));

    expect(result).toBe('stored');
  });

  it('returns "stored" when saveCache resolves -1 (benign no-op, D-04) (ROBUST-03)', async () => {
    saveCache.mockResolvedValue(-1);
    const backend = createActionsCacheBackend();

    const result = await backend.put(HASH, Buffer.from('tar-bytes'));

    expect(result).toBe('stored');
  });

  it('returns "stored" when saveCache rejects with a ReserveCacheError (benign no-op, D-04) (ROBUST-03)', async () => {
    const reserveConflict = new Error('cache already reserved');
    reserveConflict.name = 'ReserveCacheError';
    saveCache.mockRejectedValue(reserveConflict);
    const backend = createActionsCacheBackend();

    const result = await backend.put(HASH, Buffer.from('tar-bytes'));

    expect(result).toBe('stored');
  });

  it('propagates any other saveCache rejection so the server fails closed (ROBUST-03)', async () => {
    saveCache.mockRejectedValue(new Error('network down'));
    const backend = createActionsCacheBackend();

    await expect(backend.put(HASH, Buffer.from('tar-bytes'))).rejects.toThrow(
      'network down',
    );
  });

  it('removes the temp archive after put on the success path (ROBUST-03)', async () => {
    saveCache.mockResolvedValue(42);
    const backend = createActionsCacheBackend();

    await backend.put(HASH, Buffer.from('tar-bytes'));

    expect(existsSync(cacheArchivePath(HASH))).toBe(false);
  });

  it('removes the temp archive after put on the propagating-error path (ROBUST-03)', async () => {
    saveCache.mockRejectedValue(new Error('network down'));
    const backend = createActionsCacheBackend();

    await expect(backend.put(HASH, Buffer.from('tar-bytes'))).rejects.toThrow();

    expect(existsSync(cacheArchivePath(HASH))).toBe(false);
  });
});

describe('createActionsCacheBackend path + key agreement (ROBUST-03)', () => {
  // Non-vacuous: the assertion below compares the RECORDED first argument of both
  // toolkit calls to each other AND to cacheArchivePath(hash) imported from the
  // helper -- so it fails if save and restore ever pass different path strings,
  // which is the silent-MISS class this backend's single-source rule exists to
  // prevent (Pitfall 7).
  it('passes exactly cacheArchivePath(hash) as the single path to both restoreCache and saveCache, with the same key (ROBUST-03)', async () => {
    restoreCache.mockResolvedValue(undefined);
    saveCache.mockResolvedValue(42);
    const backend = createActionsCacheBackend();

    await backend.get(HASH);
    await backend.put(HASH, Buffer.from('tar-bytes'));

    const restorePaths = restoreCache.mock.calls[0][0];
    const savePaths = saveCache.mock.calls[0][0];

    expect(restorePaths).toEqual([cacheArchivePath(HASH)]);
    expect(savePaths).toEqual(restorePaths);
    expect(restoreCache.mock.calls[0][1]).toBe(cacheKeyFor(HASH));
    expect(saveCache.mock.calls[0][1]).toBe(cacheKeyFor(HASH));
  });
});
