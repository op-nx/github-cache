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
 *
 * merge_group and workflow_dispatch are DELIBERATELY absent from both allowlists,
 * not an accidental deletion: Phase 5's plan lists them among events that must be
 * false on EVERY host (dangerous/unlisted, always refused), and TRUST-02 reinforces
 * the same rejection for the sync gate. Under default-deny they need no denylist
 * entry -- an unrecognised trigger is simply untrusted -- and TRUSTED_EVENTS is
 * content-pinned to push+schedule by the spec. Predecessor parity is explicitly NOT
 * a reason to re-add them (ADR framing: sunk cost is zero; known hazards are fixed
 * at the root, not parity-patched). Do not re-add them.
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
 * Why a write-trust check degraded to read-only. Surfaced so a silent read-only
 * degrade (e.g. a mis-set GHES host, or a non-CI invocation) is observable at the
 * call site instead of an opaque `false` (type-design #6).
 */
export type WriteUntrustedReason =
  'not-ci' | 'untrusted-event' | 'untrusted-host';

/** Discriminated write-trust result: trusted, or not-trusted WITH the reason. */
export type WriteTrust =
  | { readonly trusted: true }
  | { readonly trusted: false; readonly reason: WriteUntrustedReason };

/**
 * Default-deny write-trust predicate (TRUST-01/TRUST-03): trusted only when the
 * process runs in GitHub Actions AND either the event is a host-independent base
 * writer, or a host-gated widened event on a host that carries GitHub's guard.
 * Pure and injectable -- the env bag is the sole input; no caller/mode flag
 * (TRUST-05 / D-02: exactly one env parameter with a default). Returns a
 * discriminated union so the DEGRADE REASON is observable, never a bare boolean;
 * the trust DECISION for every input is unchanged from the prior boolean form.
 */
export function isWriteTrusted(
  env: NodeJS.ProcessEnv = process.env,
): WriteTrust {
  if (env.GITHUB_ACTIONS !== 'true') {
    return { trusted: false, reason: 'not-ci' }; // not CI -> never RW
  }

  const event = env.GITHUB_EVENT_NAME ?? '';

  if ((TRUSTED_EVENTS as readonly string[]).includes(event)) {
    return { trusted: true }; // base writers: trusted on any host
  }

  if ((HOST_GATED_EVENTS as readonly string[]).includes(event)) {
    // widened: only where the guard exists
    return hostSupportsWidenedTrust(env)
      ? { trusted: true }
      : { trusted: false, reason: 'untrusted-host' };
  }

  return { trusted: false, reason: 'untrusted-event' }; // default-deny, no denylist
}
