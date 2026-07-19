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
export function isSyncTrusted(
  env: NodeJS.ProcessEnv = process.env,
  readDefaultBranch: (e: NodeJS.ProcessEnv) => string | undefined = defaultBranch,
): boolean {
  if (env.GITHUB_ACTIONS !== 'true') {
    return false; // not CI -> never sync
  }

  if (!(SYNC_EVENTS as readonly string[]).includes(env.GITHUB_EVENT_NAME ?? '')) {
    return false; // rejects pull_request/release/dispatch/merge_group/delete/etc.
  }

  const ref = env.GITHUB_REF ?? '';

  if (!ref.startsWith('refs/heads/')) {
    return false; // rejects tags and other non-branch refs
  }

  const def = readDefaultBranch(env);

  return def !== undefined && (env.GITHUB_REF_NAME ?? '') === def;
}
