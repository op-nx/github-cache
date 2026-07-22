import { createActionsCacheBackend } from '../backend/actions-cache-backend.js';
import { createReadOnlyMemoryBackend } from '../backend/memory-backend.js';
import {
  createReleasesReadBackend,
  createReleasesReadClient,
} from '../backend/releases-backend.js';
import type { ReadableBackend, WritableBackend } from '../backend/types.js';
import {
  GITHUB_REPOSITORY_PATTERN,
  resolveGitHubToken,
} from './github-identity.js';
import { isWriteTrusted } from './trust.js';

// GITHUB_REPOSITORY_PATTERN and resolveGitHubToken live in the ./github-identity.js
// leaf module (extracted to break the releases-backend -> local-context ->
// select-backend cycle); selectBackend uses them internally below. Consumers import
// them from ./github-identity.js directly -- this module no longer re-exports them.

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
): ReadableBackend | WritableBackend {
  if (!isWriteTrusted(env).trusted) {
    // The local/untrusted branch returns the real cross-context GitHub Releases
    // reader (D-01), constructed with the real default client. selectBackend stays
    // SYNCHRONOUS: the async token and repo-identity resolution defer into the
    // client's fetchAsset (run at get-time), never at construction -- which is what
    // keeps Function.length at 0 and the serve.ts call site synchronous (TRUST-05).
    // The env bag is threaded through so the client resolves against the injected
    // environment. Read-only by construction (a ReadableBackend with no put).
    return createReleasesReadBackend(createReleasesReadClient(env));
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
