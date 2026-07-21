import type { Hash } from '../lib/cache-key.js';
import type { CacheBackend, GetResult, PutResult } from './types.js';

function readFrom(store: Map<string, Buffer>, hash: string): GetResult {
  const bytes = store.get(hash);

  if (bytes === undefined) {
    return { kind: 'miss' };
  }

  return { kind: 'hit', bytes };
}

/**
 * Trivial in-process Map-backed CacheBackend in its writable form.
 *
 * TEST FIXTURE (intentional, not dead code): selectBackend never constructs the
 * writable memory backend on any runtime path -- it is the writable seam that lets
 * serve.spec and the public-server integration round-trip drive a real PUT/GET
 * without the Actions-cache runtime. Kept exported for those tests.
 *
 * RW-vs-RO is which factory the caller constructs the server with, never a
 * caller-facing mode flag (TRUST-05).
 */
export function createWritableMemoryBackend(): CacheBackend {
  const store = new Map<string, Buffer>();

  return {
    async get(hash: Hash): Promise<GetResult> {
      return readFrom(store, hash);
    },

    async put(hash: Hash, bytes: Buffer): Promise<PutResult> {
      if (store.has(hash)) {
        return 'conflict';
      }

      store.set(hash, bytes);

      return 'stored';
    },
  };
}

/**
 * Read-only form of the Map-backed CacheBackend (the D-04 403 seam): put always
 * yields 'forbidden' -> the server maps it to 403. get mirrors the writable read
 * path; its store stays empty in Phase 1 (the real cross-context reader is
 * Phase 3), so get always misses here. RW-vs-RO is which factory constructs the
 * server, never a caller-facing mode flag (TRUST-05).
 */
export function createReadOnlyMemoryBackend(): CacheBackend {
  const store = new Map<string, Buffer>();

  return {
    async get(hash: Hash): Promise<GetResult> {
      return readFrom(store, hash);
    },

    async put(): Promise<PutResult> {
      return 'forbidden';
    },
  };
}
