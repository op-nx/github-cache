/**
 * Leaf module for GitHub repository-identity + token resolution primitives.
 *
 * Extracted from select-backend.ts to break the initialization import cycle
 * releases-backend -> local-context -> select-backend -> releases-backend
 * (flagged by fallow dead-code): local-context needs GITHUB_REPOSITORY_PATTERN
 * and resolveGitHubToken, but importing them from select-backend closed the loop.
 * This module imports nothing from ./select-backend, ./local-context, or
 * ../backend, so it is a true leaf and the cycle is gone. select-backend
 * re-exports both symbols, so every existing `from './select-backend.js'` import
 * (including TEST-01) keeps working unchanged.
 */

/** owner/name shape for GITHUB_REPOSITORY: one non-slash segment, a slash, one more. */
export const GITHUB_REPOSITORY_PATTERN = /^[^/]+\/[^/]+$/;

/**
 * Resolve the GitHub token from runtime context: GH_TOKEN first, then
 * GITHUB_TOKEN. The chain deliberately uses the falsy-coalescing `||` (NOT the
 * nullish `??`) so a set-but-empty value falls through to the next source rather
 * than binding an empty secret (Pitfall 8; mirrors the `||`-not-`??` token
 * fallback in serve()). A later reader must not "tidy" this to `??`.
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
