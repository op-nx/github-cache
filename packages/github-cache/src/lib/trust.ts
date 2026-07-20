/**
 * Trusted triggers for the write gate. Two allowlists, one authored source of
 * truth (D-05) -- there is exactly one declaration of each in the repo.
 *
 * TRUSTED_EVENTS are the host-INDEPENDENT base writers: trusted on any host.
 *
 * HOST_GATED_EVENTS (pull_request / release, TRUST-01) are trusted ONLY where
 * GitHub's 2026-06-26 server-side read-only-default-branch cache guard exists,
 * inferred structurally from GITHUB_SERVER_URL (host github.com or a real
 * *.ghe.com Data Residency subdomain). Every GHES host and any malformed/missing
 * value fails closed.
 *
 * The in-code host gate is fork-spoofable defense-in-depth ONLY (ADR C1): the
 * load-bearing control is GitHub's server-side read-only-token guard + Actions
 * cache scope isolation. This gate exists so trust is not falsely widened on GHES
 * where that guard is absent -- a conservative fail-closed default, not a boundary.
 *
 * Default-deny, no denylist: an unrecognised or unset trigger is not trusted.
 * This file imports nothing from the SYNC/publish gate -- widening WRITE must
 * never widen SYNC (ADR C2); the two allowlists stay separate declarations.
 * ponytail: array .includes is fine at n=2.
 */
export const TRUSTED_EVENTS = ['push', 'schedule'] as const;

export const HOST_GATED_EVENTS = ['pull_request', 'release'] as const;

/**
 * Structural, fail-closed host check (TRUST-01, Pitfall 2). Parses
 * GITHUB_SERVER_URL with the global URL and compares the hostname; NEVER a
 * substring includes. Returns true only for github.com or a real *.ghe.com
 * subdomain -- endsWith('.ghe.com') requires a leading label, so bare ghe.com,
 * notghe.com, and github.com.attacker.com are rejected. Any parse throw
 * (malformed/empty/missing) returns false: fail closed on GHES-or-unknown.
 */
function hostSupportsWidenedTrust(env: NodeJS.ProcessEnv): boolean {
  const raw = env.GITHUB_SERVER_URL ?? '';
  let host: string;

  try {
    host = new URL(raw).hostname.toLowerCase();
  } catch {
    return false;
  }

  return host === 'github.com' || host.endsWith('.ghe.com');
}

/**
 * Default-deny write-trust predicate (TRUST-01/TRUST-03): true only when the
 * process runs in GitHub Actions AND either the event is a host-independent base
 * writer, or a host-gated widened event on a host that carries GitHub's guard.
 * Pure and injectable -- the env bag is the sole input; no caller/mode flag
 * (TRUST-05 / D-02: exactly one env parameter with a default).
 */
export function isWriteTrusted(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.GITHUB_ACTIONS !== 'true') {
    return false; // not CI -> never RW
  }

  const event = env.GITHUB_EVENT_NAME ?? '';

  if ((TRUSTED_EVENTS as readonly string[]).includes(event)) {
    return true; // base writers: trusted on any host
  }

  if ((HOST_GATED_EVENTS as readonly string[]).includes(event)) {
    return hostSupportsWidenedTrust(env); // widened: only where the guard exists
  }

  return false; // default-deny, no denylist
}
