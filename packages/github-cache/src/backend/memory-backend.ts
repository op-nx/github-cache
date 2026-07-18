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
 * RW-vs-RO is which factory the caller constructs the server with, never a
 * caller-facing mode flag (TRUST-05).
 */
export function createWritableMemoryBackend(): CacheBackend {
  const store = new Map<string, Buffer>();

  return {
    async get(hash: string): Promise<GetResult> {
      return readFrom(store, hash);
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
    async get(hash: string): Promise<GetResult> {
      return readFrom(store, hash);
    },

    async put(): Promise<PutResult> {
      return 'forbidden';
    },
  };
}
