import type { Hash } from '../lib/cache-key.js';

// The Nx PUT contract has only two SUCCESS-ish outcomes a writer reports: the entry
// was stored, or an existing entry cannot be overridden (409). The read-only 403
// ("read-only token used to write") is NOT a put() result -- a read-only backend has
// no put at all, and the server produces that 403 at the protocol boundary. So there
// is no 'forbidden' here (it was the workaround the put-less split removes).
export type PutResult = 'stored' | 'conflict';

export interface GetHit {
  readonly kind: 'hit';
  readonly bytes: Buffer;
}

export type GetResult = GetHit | { readonly kind: 'miss' };

/**
 * A read-only cache port: reads only. A read-only backend structurally CANNOT write
 * -- it has NO put method, so an illegal write is unrepresentable rather than a
 * runtime 'forbidden'. The Nx contract's PUT 403 ("read-only token used to write")
 * is owned by the server (the protocol boundary), not by a put() return value.
 */
export interface ReadableBackend {
  get(hash: Hash): Promise<GetResult>;
}

/** A read-write cache port: adds the write path on top of the read port. */
export interface WritableBackend extends ReadableBackend {
  put(hash: Hash, bytes: Buffer): Promise<PutResult>;
}

/**
 * Ergonomic public alias for the read-write port -- the friendly name a consumer
 * supplying its own writable backend to createCacheServer imports, and the type the
 * package's own test doubles annotate. Identical to WritableBackend; both are exported
 * so callers use whichever reads best. It is NOT a compatibility shim (there is no
 * prior release) -- just the read-write port's public name.
 */
export type CacheBackend = WritableBackend;

/**
 * Runtime discriminator for the ReadableBackend | WritableBackend union: does this
 * backend expose a write path? The server uses it to answer a PUT to a read-only
 * backend with the contract's 403 instead of calling a put that does not exist.
 */
export function isWritableBackend(
  backend: ReadableBackend | WritableBackend,
): backend is WritableBackend {
  return 'put' in backend;
}
