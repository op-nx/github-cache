import { readFile, rm, writeFile } from 'node:fs/promises';
import * as cache from '@actions/cache';
import * as core from '@actions/core';
import { cacheArchivePath } from '../lib/cache-archive-path.js';
import { cacheKeyFor, type Hash } from '../lib/cache-key.js';
import { withHashLock } from '../lib/with-hash-lock.js';
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
 * This backend never returns 'forbidden' (403 is the read-only backend's job). It
 * DOES return 'conflict' on one branch: an ambiguous saveCache no-op, which the
 * contract layer maps to the Nx client's benign 409 (see put).
 *
 * BOTH get and put run under withHashLock (TEST-02 / D-03), because this module is
 * the one that OWNS the shared deterministic archive path. get does
 * restore -> read -> rm and put does write -> save -> rm on the SAME path for a
 * given hash, so an unserialized get/put pair can have one leg's `rm` delete the
 * archive the other leg is about to read or save. The lock lives here rather than
 * at the serve() composition root precisely so it sits with the resource it
 * guards -- and so it is never applied twice (a nested same-hash lock
 * self-deadlocks: the inner call sees the outer call's tail as `prior`, which
 * cannot settle until the inner one resolves).
 *
 * The writable MEMORY backend is intentionally NOT serialized: it has no shared
 * temp path, so there was never anything to protect there.
 */
export function createActionsCacheBackend(): CacheBackend {
  return {
    get(hash: Hash): Promise<GetResult> {
      return withHashLock(hash, async () => {
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
      });
    },

    put(hash: Hash, bytes: Buffer): Promise<PutResult> {
      return withHashLock(hash, async () => {
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
          // write did not land and the response must not be a silent 200.
          //
          // That absent branch answers 'conflict' (409), not a throw.
          // ARCHITECTURE-DECISION.md control C1 states a blocked PR write is a
          // benign 409/no-op, and the Nx client treats 409 as a graceful no-op -- so
          // 409 satisfies SRV-05/D-06's actual requirement (no silent 200) without
          // the build-breaking 500 the throw produced via server.ts's put-fault
          // handler. The predecessor did exactly this
          // (`cacheId === -1 ? 'conflict' : 'stored'`). The real trigger is a
          // base-scope read-only PR activity type (for example `pull_request`
          // `[closed]`); an ordinary fork PR writes its own isolated scope and
          // succeeds.
          //
          // The warning exists because a scope denial and a genuine cache-service
          // outage are indistinguishable at this layer BY DESIGN -- @actions/cache
          // collapses both to -1. Warn, never fail the build.
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

          core.warning(
            `github-cache: saveCache reported no write (id -1) and no entry exists for key ${cacheKeyFor(hash)}; reporting a 409 no-op. Either the runner's cache scope is read-only (a base-scope PR activity type) or the cache service dropped the write.`,
          );

          return 'conflict';
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
      });
    },
  };
}
