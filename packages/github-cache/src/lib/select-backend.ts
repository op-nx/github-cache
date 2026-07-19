import { createActionsCacheBackend } from '../backend/actions-cache-backend.js';
import { createReadOnlyMemoryBackend } from '../backend/memory-backend.js';
import type { CacheBackend } from '../backend/types.js';
import { isWriteTrusted } from './trust.js';

/** owner/name shape for GITHUB_REPOSITORY: one non-slash segment, a slash, one more. */
export const GITHUB_REPOSITORY_PATTERN = /^[^/]+\/[^/]+$/;

/**
 * Resolve the GitHub token from runtime context: GH_TOKEN first, then
 * GITHUB_TOKEN. The chain deliberately uses the falsy-coalescing `||` (NOT the
 * nullish `??`) so a set-but-empty value falls through to the next source rather
 * than binding an empty secret (Pitfall 8; mirrors serve.ts:41-45). A later
 * reader must not "tidy" this to `??`.
 *
 * Nothing in Phase 2 sends this token anywhere -- the Actions-cache primitive
 * authenticates with its own runtime token -- but TEST-01 specifies the
 * fallthrough and Phase 3's authenticated private-repo read consumes it.
 */
export function resolveGitHubToken(
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  return env.GH_TOKEN || env.GITHUB_TOKEN || undefined;
}

/**
 * The single context-derived backend selection point (D-01, TRUST-05). RW-vs-RO
 * is which factory constructs the backend, decided entirely from runtime
 * context, never a caller-facing mode flag -- the only argument is the
 * (injectable) env bag, and no property in it can request the writable backend.
 *
 * Untrusted context returns the read-only backend; trusted context validates the
 * repository identity fail-closed, resolves the token, and only then constructs
 * the writable Actions-cache backend.
 */
export function selectBackend(
  env: NodeJS.ProcessEnv = process.env,
): CacheBackend {
  if (!isWriteTrusted(env)) {
    // Phase 3 placeholder for the real cross-context Releases reader: today the
    // read-only backend's store is empty, so get always misses (put -> 403).
    return createReadOnlyMemoryBackend();
  }

  if (!GITHUB_REPOSITORY_PATTERN.test(env.GITHUB_REPOSITORY ?? '')) {
    // Fail-closed construction guard (server.ts:62-66 precedent): a corrupted
    // repository identity in a write-trusted context must fail loudly rather than
    // resolve into some other repository's cache namespace.
    throw new Error(
      'selectBackend: GITHUB_REPOSITORY must be a valid owner/name in a write-trusted context (TEST-01)',
    );
  }

  if (resolveGitHubToken(env) === undefined) {
    // Degrade, do NOT throw: a merely-unwired workflow token must not break the
    // build. A malformed repository identity (above) is a misconfiguration and
    // does throw; an absent token is just a not-yet-write-capable context.
    return createReadOnlyMemoryBackend();
  }

  return createActionsCacheBackend();
}
