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
 * The read-only port with the write path CLOSED, rather than merely absent.
 *
 * WHY IT EXISTS. `WritableBackend extends ReadableBackend`, so a
 * `ReadableBackend | WritableBackend` union COLLAPSES to `ReadableBackend` and carries
 * zero read-only information. The read-only guarantee then rested entirely on
 * excess-property checking, which fires only on a fresh object literal -- so a
 * non-literal wrapper (`function f(): ReadableBackend { return
 * createActionsCacheBackend(); }`) compiled clean, made `isWritableBackend` TRUE on the
 * CACHE_READ_ONLY branch, the server called put, and XOS-09's inductive argument ("a
 * read-only leg cannot produce an entry on its OS") was silently false with every gate
 * green.
 *
 * `put?: never` resolves to `never | undefined` = `undefined`, and optionality excuses
 * only an ABSENT property -- so any source type carrying a real `put` is rejected.
 * VERIFIED with a strictness-matched `tsc --noEmit`: assigning a `WritableBackend` here
 * is TS2322.
 *
 * WHAT THIS DOES NOT BUY, stated plainly because overclaiming it is how the next reader
 * stops checking. The laundering wrapper is NOT unrepresentable. `ReadableBackend` is
 * still assignable to `ReadOnlyBackend` (the property is merely absent), so a wrapper
 * annotated with the OLD base type still launders a writable backend through one
 * indirection. What changed is that the three read-only factories now DECLARE this type,
 * so re-opening the hole requires WIDENING a declared return type -- a visible, reviewable
 * diff instead of a silent one.
 *
 * `readonly` is documentation, not the mechanism: it contributes nothing to
 * assignability. Do not describe it as the mechanism.
 *
 * INTERNAL. Deliberately NOT re-exported from `src/index.ts`: D2-02 forbids new package
 * exports this milestone, and `public-surface.spec.ts` asserts over the BARREL alone, so
 * an internal type changes nothing a consumer or that spec can see.
 */
export interface ReadOnlyBackend extends ReadableBackend {
  readonly put?: never;
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
