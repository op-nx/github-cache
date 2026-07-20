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

/** Actions-cache key for a task hash: the prefix followed by the hash. */
export function cacheKeyFor(hash: string): string {
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
