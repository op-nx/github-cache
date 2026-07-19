/**
 * Trusted triggers for the write gate (TRUST-03). Default-deny allowlist with NO
 * denylist path: an unrecognised or unset trigger returns not-trusted. This is the
 * single source of truth for the allowlist -- there is exactly one declaration in
 * the repo. The dependency-free action-context copy plus its parity assertion is
 * deliberately deferred to Phase 5 / TRUST-04. Widening this list (e.g. to
 * pull_request / release) is Phase 5 / TRUST-01 work, not a maintenance edit.
 * ponytail: array .includes is fine at n=2.
 */
export const TRUSTED_EVENTS = ['push', 'schedule'] as const;

/**
 * Default-deny write-trust predicate (TRUST-03): true only when the process runs
 * in GitHub Actions AND the triggering event is in the TRUSTED_EVENTS allowlist.
 * Pure and injectable -- the env bag is the sole input.
 */
export function isWriteTrusted(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.GITHUB_ACTIONS !== 'true') {
    return false; // not CI -> never RW
  }

  return (TRUSTED_EVENTS as readonly string[]).includes(
    env.GITHUB_EVENT_NAME ?? '',
  );
}
