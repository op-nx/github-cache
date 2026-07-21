import { readFile, rm, writeFile } from 'node:fs/promises';
import * as cache from '@actions/cache';
import { cacheArchivePath } from '../lib/cache-archive-path.js';
import { cacheKeyFor, type Hash } from '../lib/cache-key.js';
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
    async get(hash: Hash): Promise<GetResult> {
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

    async put(hash: Hash, bytes: Buffer): Promise<PutResult> {
      const path = cacheArchivePath(hash);
      await writeFile(path, bytes);

      try {
        // D-04 / D-06 / SRV-05: saveCache resolves a positive cache id on a
        // CONFIRMED write, or the ambiguous sentinel -1. -1 is NOT proof of a
        // benign no-op: @actions/cache (verified v6.2.0, cache.js saveCacheV1/V2
        // catch arms) swallows EVERY non-ValidationError fault -- 5xx, network
        // errors, CacheWriteDeniedError, FinalizeCacheError, over-data-cap -- via
        // core.warning/core.error and returns -1 WITHOUT throwing. The upstream
        // WRITE GATE (D-02) only gates trust; it cannot detect a cache-service
        // outage or a runtime token-scope regression. So a bare -1 would let a
        // dropped write masquerade as a silent 200 -- exactly the fail-closed
        // hole SRV-05/D-06 forbid.
        //
        // Disambiguate the two -1 causes with a lookupOnly existence probe (no
        // download): if the entry IS present, it was a benign already-exists (or
        // a concurrent job's write) and 'stored' is correct; if it is ABSENT, the
        // -1 was a swallowed fault, so throw and let the server fail closed (500)
        // rather than report a write that never persisted.
        const cacheId = await cache.saveCache([path], cacheKeyFor(hash));

        if (cacheId > 0) {
          return 'stored';
        }

        const present = await cache.restoreCache(
          [path],
          cacheKeyFor(hash),
          [],
          {
            lookupOnly: true,
          },
        );

        if (present !== undefined) {
          return 'stored';
        }

        throw new Error(
          `github-cache: saveCache reported no write (id -1) and no entry exists for key ${cacheKeyFor(hash)}; treating as a failed write (fail-closed, SRV-05/D-06).`,
        );
      } catch (error) {
        // Defense-in-depth: if a future @actions/cache version throws a
        // ReserveCacheError instead of returning -1, a reserve conflict still
        // means another job is creating the same byte-identical entry (CORR-01).
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
