import type { Hash } from '../lib/cache-key.js';
import type {
  CacheBackend,
  GetResult,
  PutResult,
  ReadableBackend,
} from './types.js';

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
 * Read-only form of the Map-backed backend (the D-04 read seam): a ReadableBackend
 * with NO put -- a write is unrepresentable, and the SERVER (not a put() return
 * value) answers a PUT routed here with the Nx contract's 403.
 *
 * Its live role is selectBackend's trusted-but-tokenless DEGRADE path: on a
 * write-trusted trigger with a valid identity but no resolvable token, this backend
 * is served so an unwired workflow token does not break the build. The store is
 * never populated, so it is a PERMANENT MISS on every read (and a 403 on every
 * write) -- deliberately. That is one of the four backend-selection outcomes; see
 * the table in docs/advanced.md ("How the backend is selected"). RW-vs-RO is which
 * factory constructs the server, never a caller-facing mode flag (TRUST-05).
 */
export function createReadOnlyMemoryBackend(): ReadableBackend {
  const store = new Map<string, Buffer>();

  return {
    async get(hash: Hash): Promise<GetResult> {
      return readFrom(store, hash);
    },
    // No put: read-only-ness is structural (ReadableBackend), not a runtime
    // 'forbidden'. The server answers a PUT here with the contract's 403.
  };
}
