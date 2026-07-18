import type { CacheBackend, GetResult, PutResult } from './types.js';

/**
 * Trivial in-process Map-backed CacheBackend in its writable form.
 *
 * The read-only form (put -> 'forbidden', the D-04 403 seam) and selectBackend
 * are Plan 01-03 / Phase 2 concerns. RW-vs-RO is which factory the caller
 * constructs the server with, never a caller-facing mode flag (TRUST-05).
 */
export function createWritableMemoryBackend(): CacheBackend {
  const store = new Map<string, Buffer>();

  return {
    async get(hash: string): Promise<GetResult> {
      const bytes = store.get(hash);

      if (bytes === undefined) {
        return { kind: 'miss' };
      }

      return { kind: 'hit', bytes };
    },

    async put(hash: string, bytes: Buffer): Promise<PutResult> {
      if (store.has(hash)) {
        return 'conflict';
      }

      store.set(hash, bytes);

      return 'stored';
    },
  };
}
