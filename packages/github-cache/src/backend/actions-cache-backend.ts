import { readFile, rm, writeFile } from 'node:fs/promises';
import * as cache from '@actions/cache';
import { cacheArchivePath } from '../lib/cache-archive-path.js';
import { cacheKeyFor } from '../lib/cache-key.js';
import type { CacheBackend, GetResult, PutResult } from './types.js';

// The server-produced-key namespace + filter (prefix + HASH_PATTERN) now live in
// the cache-key.ts single-source leaf (TRUST-08 done); this backend just consumes
// cacheKeyFor so save and restore key by the one authored prefix.

/**
 * The project's first real storage backend (ROBUST-03, ROADMAP SC5): a
 * CacheBackend backed by GitHub's own Actions cache through the official,
 * exact-pinned @actions/cache toolkit. get maps to restoreCache, put maps to
 * saveCache, and every path string flows through the one cacheArchivePath helper
 * so save and restore always pass a byte-identical path (Pitfall 7).
 *
 * It takes NO parameters on purpose: nothing about RW-vs-RO is decided here --
 * that is the upstream write gate's job (D-01) -- and this factory must never
 * grow a mode argument (TRUST-05).
 *
 * This backend never returns 'forbidden' (403 is the read-only backend's job) and
 * never returns 'conflict' (409 belongs to the contract layer, and to Phase 4 for
 * the mirror), so a reader should not go looking for those branches here.
 */
export function createActionsCacheBackend(): CacheBackend {
  return {
    async get(hash: string): Promise<GetResult> {
      const path = cacheArchivePath(hash);
      const matched = await cache.restoreCache([path], cacheKeyFor(hash));

      if (matched === undefined) {
        return { kind: 'miss' };
      }

      try {
        const bytes = await readFile(path);

        return { kind: 'hit', bytes };
      } finally {
        // Mirror the put path (T-2-11 / WR-01): a restored archive is decrypted
        // cache bytes on disk; remove it on every exit so nothing is left on a
        // reused or shared runner.
        await rm(path, { force: true });
      }
    },

    async put(hash: string, bytes: Buffer): Promise<PutResult> {
      const path = cacheArchivePath(hash);
      await writeFile(path, bytes);

      try {
        // D-04: saveCache resolves a positive cache id on a real write, or the
        // ambiguous sentinel -1 ("an entry for this key already exists" OR "this
        // token may not write"). A reserve-conflict rejection (ReserveCacheError,
        // caught below) tells the same story. All of these are read as a benign
        // no-op yielding 'stored', because a same-hash write is byte-identical
        // (CORR-01) and, crucially, it is the upstream WRITE GATE (D-02) -- not
        // this backend -- that stops a denied write from masking a real outage.
        // Probing which of "exists" vs "denied" occurred is deliberately NOT
        // attempted. Every OTHER rejection is rethrown (below) so the server's
        // fail-closed write path surfaces it as a 500 instead of a silent success.
        await cache.saveCache([path], cacheKeyFor(hash));

        return 'stored';
      } catch (error) {
        if (error instanceof Error && error.name === 'ReserveCacheError') {
          return 'stored';
        }

        throw error;
      } finally {
        // Cleanup runs on every exit path -- success, benign no-op, and the
        // propagating-error path -- so cache bytes are never left on a shared or
        // reused runner (T-2-11).
        await rm(path, { force: true });
      }
    },
  };
}
