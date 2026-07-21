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
