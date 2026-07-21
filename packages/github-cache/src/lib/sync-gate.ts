import { readFileSync } from 'node:fs';

/**
 * Trusted triggers for the sync/publish gate (TRUST-02 / D-01). This is a
 * SEPARATE source of truth from the write gate's allowlist in lib/trust.ts: a
 * NEW declaration, never an import of it. The two sets coincide today, which
 * makes reuse tempting and wrong -- Phase 5 / TRUST-01 widens the WRITE allowlist to
 * pull_request/release, and a shared predicate would silently widen SYNC at the
 * same time, recreating the exact CREEP precondition ADR control C2 exists to
 * prevent. The content-pin in sync-gate.spec.ts fails the build if this widens.
 * ponytail: array .includes is fine at n=2.
 */
export const SYNC_EVENTS = ['push', 'schedule'] as const;

/**
 * Read repository.default_branch from the event payload JSON (GITHUB_EVENT_PATH).
 * The default branch is NOT a dedicated env var -- inferring it from
 * GITHUB_REF_NAME alone is unsafe (a tag push also sets that). Any failure
 * (absent path, unreadable file, malformed JSON) returns undefined so the gate
 * fails closed: an unknown default branch is never publish-eligible.
 */
function defaultBranch(env: NodeJS.ProcessEnv): string | undefined {
  const path = env.GITHUB_EVENT_PATH;

  if (!path) {
    return undefined;
  }

  try {
    const payload = JSON.parse(readFileSync(path, 'utf8')) as {
      repository?: { default_branch?: string };
    };

    return payload.repository?.default_branch;
  } catch {
    return undefined;
  }
}

/**
 * Default-deny sync-trust predicate (TRUST-02): true ONLY when the process runs
 * in GitHub Actions AND the triggering event is in SYNC_EVENTS AND the current
 * ref is the repository default branch (a refs/heads/ ref whose name equals
 * repository.default_branch). The default-branch check is PART of the predicate,
 * not a workflow `if:` alone (D-01). Pure and injectable -- `env` is the sole
 * runtime input and `readDefaultBranch` is injected in tests so the predicate
 * never touches the filesystem.
 */
/**
 * Why a sync-trust check refused to publish. Surfaced so a skipped mirror is
 * observable with its cause rather than an opaque `false` (type-design #6).
 */
export type SyncUntrustedReason =
  'not-ci' | 'untrusted-event' | 'not-default-branch';

/** Discriminated sync-trust result: trusted, or not-trusted WITH the reason. */
export type SyncTrust =
  | { readonly trusted: true }
  | { readonly trusted: false; readonly reason: SyncUntrustedReason };

export function isSyncTrusted(
  env: NodeJS.ProcessEnv = process.env,
  readDefaultBranch: (
    e: NodeJS.ProcessEnv,
  ) => string | undefined = defaultBranch,
): SyncTrust {
  if (env.GITHUB_ACTIONS !== 'true') {
    return { trusted: false, reason: 'not-ci' }; // not CI -> never sync
  }

  if (
    !(SYNC_EVENTS as readonly string[]).includes(env.GITHUB_EVENT_NAME ?? '')
  ) {
    // rejects pull_request/release/dispatch/merge_group/delete/etc.
    return { trusted: false, reason: 'untrusted-event' };
  }

  const ref = env.GITHUB_REF ?? '';

  if (!ref.startsWith('refs/heads/')) {
    // rejects tags and other non-branch refs
    return { trusted: false, reason: 'not-default-branch' };
  }

  const def = readDefaultBranch(env);

  return def !== undefined && (env.GITHUB_REF_NAME ?? '') === def
    ? { trusted: true }
    : { trusted: false, reason: 'not-default-branch' };
}

/**
 * Defense-in-depth in-code trust gate for the scheduled cleanup path (CREEP C2 /
 * RETAIN-03). True ONLY inside GitHub Actions on a SYNC_EVENTS trigger.
 *
 * DELIBERATELY narrower than `isSyncTrusted`: it does NOT read the repository default
 * branch. `isSyncTrusted` resolves `repository.default_branch` from the event payload,
 * but the `schedule` event GitHub synthesizes is not a documented webhook and does not
 * CONTRACTUALLY carry that field. If it were ever absent, reusing `isSyncTrusted` on the
 * cleanup path would return not-default-branch, cleanup would SILENTLY no-op every run,
 * and the mirror would leak toward the 1000-asset-per-release cap -- the exact
 * retention-LOCKED failure retention.ts guards. The default-branch check is also
 * redundant for cleanup: GitHub runs `schedule` ONLY on the default branch, and the
 * cleanup workflow is schedule-only. So this predicate gates on CI + trusted event alone
 * and CANNOT fail-closed on the happy path (schedule inside Actions). SYNC_EVENTS stays
 * the single source of truth for the trusted-event list -- never a second literal.
 */
export function isTrustedSyncEvent(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return (
    env.GITHUB_ACTIONS === 'true' &&
    (SYNC_EVENTS as readonly string[]).includes(env.GITHUB_EVENT_NAME ?? '')
  );
}
