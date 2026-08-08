/**
 * Single-source home for the server-produced-key namespace (TRUST-08 / ADR C16).
 *
 * This is the ONE authored source for the `nx-cache-` prefix, the key builder,
 * and the bounded lowercase-hex HASH_PATTERN that the server's SRV-03 hash guard
 * and the TRUST-08 mirror filter both validate against. A genuine server-produced
 * key is the prefix followed by a valid hash suffix -- never "any 1-512 hex"
 * foreign CI artifact (the cheap prefix-only subset the Phase 4 publish path
 * lacked, D-08). Never inline a second copy of the prefix or the pattern: a
 * duplicate authored literal is exactly the drift T-05-08-02 guards against.
 *
 * THE PREFIX NOW GOVERNS FOUR DISTINCT CONSUMERS (RETAIN-05c), not one. Since
 * CORR-02 collapsed the Release asset namespace onto it, all four derive from this
 * single literal:
 *   1. the Actions-cache KEY -- `cacheKeyFor` below;
 *   2. the Actions-cache ENUMERATION filter -- `isServerProducedKey` below, which
 *      decides which entries the publisher may mirror at all;
 *   3. the Release ASSET NAME -- `releaseAssetName` (release-asset-name.ts), which
 *      IMPORTS this literal rather than re-authoring it;
 *   4. the cleanup ACCEPT FILTER's current-shape branch -- `isCurrentAssetName`
 *      (release-asset-name.ts), which decides what may be DELETED.
 * Four consumers of ONE prefix, deliberately NOT aliases of one builder: 3 is not
 * folded into 1 and 4 is not folded into 2, so a change meant for the Actions-cache
 * namespace cannot silently move the Release namespace with it. Both refusals are
 * comment-locked at their sites.
 *
 * THE CONSEQUENCE OF CHANGING THE LITERAL, which is why the lock is this loud:
 * editing this string ORPHANS THE ENTIRE MIRROR. Every already-published asset keeps
 * its old name, so consumers 3 and 4 stop resolving and stop pruning them at the
 * same instant -- a silent all-MISS read plus unbounded shard growth, with no error
 * raised anywhere. And RETAIN-04's LEGACY filter branch does NOT cover those
 * orphans: it only knows the pre-CORR-02 `<hash>-<os>` shape, so assets written
 * under a superseded prefix would be prunable by neither branch and would sit in the
 * shard until it rolls over. The authored-occurrence count is pinned across this
 * leaf and its consumers by cache-key.spec.ts.
 *
 * Kept a true leaf -- it imports NOTHING from ../backend, ../publish, ../server,
 * or ./select-backend -- so every consumer can adopt it without opening an import
 * cycle, matching the github-identity.ts leaf-extraction precedent (Phase 4).
 */

/** The one authored server-produced-key prefix (TRUST-08). */
export const CACHE_KEY_PREFIX = 'nx-cache-';

/** Bounded lowercase-hex task hash (SRV-03); the shared server + filter hash space. */
export const HASH_PATTERN = /^[a-f0-9]{1,512}$/;

/**
 * A task hash that has been VALIDATED against HASH_PATTERN. The opaque brand makes
 * it unrepresentable to pass an unvalidated string -- a raw route param, or a full
 * `nx-cache-<hash>` key mistaken for its hash suffix -- where a hash is required, a
 * mixup class that was previously only caught by spec-pinning (type-design #3).
 * Mint one ONLY via parseHash; the brand never exists at runtime (it erases).
 */
export type Hash = string & { readonly __hash: unique symbol };

/**
 * Validate a raw string as a Hash, or undefined when it is not a bounded lowercase-
 * hex task hash. The single mint point for the Hash brand (SRV-03 uses it at the
 * server route; the mirror path uses it on a server-produced key's suffix).
 */
export function parseHash(value: string): Hash | undefined {
  return HASH_PATTERN.test(value) ? (value as Hash) : undefined;
}

/** Actions-cache key for a task hash: the prefix followed by the hash. */
export function cacheKeyFor(hash: Hash): string {
  return `${CACHE_KEY_PREFIX}${hash}`;
}

/**
 * TRUST-08 / C16: a genuine server-produced key is the prefix followed by a valid
 * hash suffix -- never the bare prefix, never a non-hex/garbage suffix. This is
 * the full filter the Phase 4 cheap-prefix (startsWith-only) subset lacked, so a
 * foreign or `nx-cache-<garbage>` key is filtered out before it can be mirrored.
 */
export function isServerProducedKey(key: string): boolean {
  return (
    key.startsWith(CACHE_KEY_PREFIX) &&
    HASH_PATTERN.test(key.slice(CACHE_KEY_PREFIX.length))
  );
}
