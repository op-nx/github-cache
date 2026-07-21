import { existsSync } from 'node:fs';
import { rm, writeFile } from 'node:fs/promises';
import * as cache from '@actions/cache';
import * as core from '@actions/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cacheArchivePath } from '../lib/cache-archive-path.js';
import { cacheKeyFor, type Hash } from '../lib/cache-key.js';
import { createActionsCacheBackend } from './actions-cache-backend.js';

// First module mock in this repository. @actions/cache only actually works inside
// a JS action on real CI, so every unit layer MUST mock it and prove the backend
// mapping against the recorded call arguments (02-RESEARCH.md "Don't Hand-Roll";
// the spec-file table in 02-PATTERNS.md notes module mocking has no in-repo
// precedent and must come from research). vi.mock hoists above the imports and
// auto-replaces each @actions/cache export with a vi.fn().
vi.mock('@actions/cache');

// @actions/core is mocked so the ambiguous-denial warning is spy-assertable and
// never touches a real workflow-command stream (D-14).
vi.mock('@actions/core', () => ({
  warning: vi.fn(),
}));

const restoreCache = vi.mocked(cache.restoreCache);
const saveCache = vi.mocked(cache.saveCache);
const warning = vi.mocked(core.warning);

const HASH = 'abc123' as Hash;

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

  it('removes the restored archive after a HIT so no cache bytes are left on a reused runner (WR-01, T-2-11)', async () => {
    // A real restoreCache recreates the archive on disk before get reads it;
    // simulate that here so the cleanup assertion below is non-vacuous.
    await writeFile(cacheArchivePath(HASH), Buffer.from('tar-bytes'));
    restoreCache.mockResolvedValue(cacheKeyFor(HASH));
    const backend = createActionsCacheBackend();

    expect(existsSync(cacheArchivePath(HASH))).toBe(true);

    await backend.get(HASH);

    expect(existsSync(cacheArchivePath(HASH))).toBe(false);
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

  it('returns "stored" when saveCache resolves -1 AND a lookupOnly probe confirms the entry exists (benign already-exists, D-04) (ROBUST-03)', async () => {
    saveCache.mockResolvedValue(-1);
    // The -1 probe finds the entry present -> benign already-exists.
    restoreCache.mockResolvedValue(cacheKeyFor(HASH));
    const backend = createActionsCacheBackend();

    const result = await backend.put(HASH, Buffer.from('tar-bytes'));

    expect(result).toBe('stored');
    // The probe must be a lookupOnly (no-download) existence check.
    expect(restoreCache).toHaveBeenCalledWith(
      [cacheArchivePath(HASH)],
      cacheKeyFor(HASH),
      [],
      { lookupOnly: true },
    );
  });

  // The real trigger is a base-scope read-only PR activity type (for example
  // `pull_request` `[closed]`), NOT "all fork PRs" -- an ordinary fork PR writes its
  // own isolated scope and succeeds.
  it('returns "conflict" when saveCache resolves -1 but no entry exists, so an ambiguous denial answers 409 rather than 500 (ADR C1, D-04) (ROBUST-03)', async () => {
    saveCache.mockResolvedValue(-1);
    // The -1 probe finds nothing -> the -1 was a swallowed fault or a scope denial.
    restoreCache.mockResolvedValue(undefined);
    const backend = createActionsCacheBackend();

    const result = await backend.put(HASH, Buffer.from('tar-bytes'));

    expect(result).toBe('conflict');
  });

  it('emits exactly one warning naming the cache key on the ambiguous-denial branch (OBS-01) (ROBUST-03)', async () => {
    saveCache.mockResolvedValue(-1);
    restoreCache.mockResolvedValue(undefined);
    const backend = createActionsCacheBackend();

    await backend.put(HASH, Buffer.from('tar-bytes'));

    expect(warning).toHaveBeenCalledTimes(1);
    expect(warning.mock.calls[0][0]).toContain(cacheKeyFor(HASH));
  });

  it('still removes the temp archive on the ambiguous-denial branch (T-2-11) (ROBUST-03)', async () => {
    saveCache.mockResolvedValue(-1);
    restoreCache.mockResolvedValue(undefined);
    const backend = createActionsCacheBackend();

    await backend.put(HASH, Buffer.from('tar-bytes'));

    expect(existsSync(cacheArchivePath(HASH))).toBe(false);
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

// A deferred lets a test drive settle order deterministically -- no timers.
function deferred<T>() {
  let resolve!: (value: T) => void;

  const promise = new Promise<T>((res) => {
    resolve = res;
  });

  return { promise, resolve };
}

/** Flush the microtask queue so a queued lock waiter gets its chance to enter. */
function tick(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe('createActionsCacheBackend serializes same-hash operations (TEST-02, Pitfall 7)', () => {
  // These live HERE, not in serve.spec.ts, because the lock moved to the module
  // that owns the shared deterministic archive path. serve() no longer wraps put,
  // so a fake writable backend behind serve() is no longer serialized at all.
  const LOCK_A = 'aa11bb' as Hash;
  const LOCK_B = 'cc22dd' as Hash;

  afterEach(async () => {
    await rm(cacheArchivePath(LOCK_A), { force: true });
    await rm(cacheArchivePath(LOCK_B), { force: true });
  });

  it('does not interleave two concurrent same-hash gets -- the second starts only after the first settles (TEST-02)', async () => {
    const order: string[] = [];
    const gates: Array<(value: string | undefined) => void> = [];
    restoreCache.mockImplementation(() => {
      order.push('restore');
      const gate = deferred<string | undefined>();
      gates.push(gate.resolve);

      return gate.promise;
    });
    const backend = createActionsCacheBackend();

    const first = backend.get(LOCK_A);
    await tick();

    const second = backend.get(LOCK_A);
    await tick();

    // Non-vacuous: WITHOUT the lock both gets would have entered restoreCache by
    // now, and this would read 2.
    expect(order).toHaveLength(1);

    gates[0](undefined);
    await first;
    await tick();

    expect(order).toHaveLength(2);

    gates[1](undefined);
    await second;
  });

  it('does not interleave a same-hash get and put -- the pair the shared archive path actually races (TEST-02, Pitfall 7)', async () => {
    const order: string[] = [];
    const saveGate = deferred<number>();
    saveCache.mockImplementation(() => {
      order.push('save');

      return saveGate.promise;
    });
    restoreCache.mockImplementation(async () => {
      order.push('restore');

      return undefined;
    });
    const backend = createActionsCacheBackend();

    const put = backend.put(LOCK_A, Buffer.from('tar-bytes'));
    await tick();

    const get = backend.get(LOCK_A);
    await tick();

    // The get is queued BEHIND the in-flight put: its restoreCache has not run, so
    // its `rm` cannot delete the archive saveCache is still reading.
    expect(order).toEqual(['save']);

    saveGate.resolve(42);
    await expect(put).resolves.toBe('stored');
    await tick();

    expect(order).toEqual(['save', 'restore']);
    await expect(get).resolves.toEqual({ kind: 'miss' });
  });

  it('still runs distinct hashes concurrently (TEST-02)', async () => {
    const order: string[] = [];
    const gates: Array<(value: string | undefined) => void> = [];
    restoreCache.mockImplementation(() => {
      order.push('restore');
      const gate = deferred<string | undefined>();
      gates.push(gate.resolve);

      return gate.promise;
    });
    const backend = createActionsCacheBackend();

    const a = backend.get(LOCK_A);
    const b = backend.get(LOCK_B);
    await tick();

    // BOTH gets reached restoreCache before EITHER gate was released.
    expect(order).toHaveLength(2);

    gates[0](undefined);
    gates[1](undefined);
    await Promise.all([a, b]);
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
