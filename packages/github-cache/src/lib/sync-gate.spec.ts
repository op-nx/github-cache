import { describe, expect, it } from 'vitest';
import { SYNC_EVENTS, isSyncTrusted, isTrustedSyncEvent } from './sync-gate.js';

// isSyncTrusted now returns a discriminated { trusted, reason } union; this helper
// extracts the boolean so the existing true/false assertions stay unchanged (the
// trust DECISION is what these tests pin, not the result shape).
const syncTrusted = (...args: Parameters<typeof isSyncTrusted>): boolean =>
  isSyncTrusted(...args).trusted;

// Every trigger that must be REFUSED even inside GitHub Actions on the default
// branch (TRUST-02 / D-01). Fork-reachable, dispatch, and other non-sync events
// the publish path must never mirror for. This list is DISTINCT from trust.ts's
// write-gate refusal set on purpose: the two trust boundaries must be able to
// diverge (Phase 5 widens WRITE, never SYNC).
const REFUSED_EVENTS = [
  'pull_request',
  'pull_request_target',
  'issue_comment',
  'workflow_run',
  'workflow_dispatch',
  'repository_dispatch',
  'merge_group',
  'release',
  'delete',
  'registry_package',
  'page_build',
];

const DEFAULT_BRANCH = 'main';

// Injected default-branch reader: resolves to the repo default branch without
// touching the filesystem (the real reader parses GITHUB_EVENT_PATH).
const readMain = (): string => DEFAULT_BRANCH;

// A fully-trusted sync env bag: push, on the default branch, inside Actions.
// Override one field per test to isolate the single condition under test.
function syncEnv(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    GITHUB_ACTIONS: 'true',
    GITHUB_EVENT_NAME: 'push',
    GITHUB_REF: 'refs/heads/main',
    GITHUB_REF_NAME: 'main',
    ...overrides,
  };
}

describe('isSyncTrusted', () => {
  it('trusts push on the default branch inside GitHub Actions (TRUST-02)', () => {
    const result = syncTrusted(
      syncEnv({ GITHUB_EVENT_NAME: 'push' }),
      readMain,
    );

    expect(result).toBe(true);
  });

  it('trusts schedule on the default branch inside GitHub Actions (TRUST-02)', () => {
    const result = syncTrusted(
      syncEnv({ GITHUB_EVENT_NAME: 'schedule' }),
      readMain,
    );

    expect(result).toBe(true);
  });

  for (const event of REFUSED_EVENTS) {
    it(`refuses ${event} even on the default branch inside GitHub Actions (TRUST-02)`, () => {
      const result = syncTrusted(
        syncEnv({ GITHUB_EVENT_NAME: event }),
        readMain,
      );

      expect(result).toBe(false);
    });
  }

  it('refuses a push on a non-default branch (TRUST-02)', () => {
    // Non-vacuous default-branch check: event + refs/heads/ prefix both pass, so
    // the ONLY failing condition is branch != repository.default_branch.
    const result = syncTrusted(
      syncEnv({
        GITHUB_REF: 'refs/heads/feature-x',
        GITHUB_REF_NAME: 'feature-x',
      }),
      readMain,
    );

    expect(result).toBe(false);
  });

  it('refuses a refs/tags/* ref for a trusted event (TRUST-02)', () => {
    const result = syncTrusted(
      syncEnv({ GITHUB_REF: 'refs/tags/v1.0.0', GITHUB_REF_NAME: 'v1.0.0' }),
      readMain,
    );

    expect(result).toBe(false);
  });

  it('refuses a tag ref whose name matches the default branch (isolates the refs/heads/ guard) (TRUST-02)', () => {
    // Non-vacuous refs/heads/ guard: the ref name equals the default branch, so
    // the branch-equality check would pass -- only the refs/heads/ prefix guard
    // can reject this (a tag push also sets GITHUB_REF_NAME).
    const result = syncTrusted(
      syncEnv({ GITHUB_REF: 'refs/tags/main', GITHUB_REF_NAME: 'main' }),
      readMain,
    );

    expect(result).toBe(false);
  });

  it('refuses when GITHUB_ACTIONS is not exactly "true" (TRUST-02)', () => {
    const result = syncTrusted(syncEnv({ GITHUB_ACTIONS: 'false' }), readMain);

    expect(result).toBe(false);
  });

  it('refuses a trusted event outside GitHub Actions (TRUST-02)', () => {
    const result = syncTrusted(
      {
        GITHUB_EVENT_NAME: 'push',
        GITHUB_REF: 'refs/heads/main',
        GITHUB_REF_NAME: 'main',
      },
      readMain,
    );

    expect(result).toBe(false);
  });

  it('fails closed when the event payload is unreadable/absent (TRUST-02)', () => {
    // readDefaultBranch returns undefined (absent/unreadable payload) -> the
    // default-branch check can never pass, so the run is not sync-eligible.
    const result = syncTrusted(syncEnv(), () => undefined);

    expect(result).toBe(false);
  });

  it('default-denies an empty env bag (TRUST-02)', () => {
    const result = syncTrusted({}, readMain);

    expect(result).toBe(false);
  });
});

describe('isTrustedSyncEvent (cleanup defense-in-depth gate, CREEP C2 / RETAIN-03)', () => {
  it('trusts a schedule event inside GitHub Actions', () => {
    expect(
      isTrustedSyncEvent({
        GITHUB_ACTIONS: 'true',
        GITHUB_EVENT_NAME: 'schedule',
      }),
    ).toBe(true);
  });

  it('trusts a push event inside GitHub Actions', () => {
    expect(
      isTrustedSyncEvent({ GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: 'push' }),
    ).toBe(true);
  });

  it('CANNOT fail-closed: trusts schedule with NO GITHUB_EVENT_PATH / no repository.default_branch (RETAIN-03 anti-fail-closed proof)', () => {
    // The whole reason this gate is NOT isSyncTrusted: the synthesized schedule payload
    // does not contractually carry repository.default_branch. This env bag has NO
    // GITHUB_EVENT_PATH at all (and no GITHUB_REF/GITHUB_REF_NAME), so ANY default-branch
    // dependency would return false and silently disable scheduled retention cleanup.
    // isTrustedSyncEvent must stay true here -- that is the retention-LOCKED guarantee.
    expect(
      isTrustedSyncEvent({
        GITHUB_ACTIONS: 'true',
        GITHUB_EVENT_NAME: 'schedule',
      }),
    ).toBe(true);
  });

  it('refuses pull_request even inside GitHub Actions', () => {
    expect(
      isTrustedSyncEvent({
        GITHUB_ACTIONS: 'true',
        GITHUB_EVENT_NAME: 'pull_request',
      }),
    ).toBe(false);
  });

  it('refuses workflow_dispatch even inside GitHub Actions', () => {
    expect(
      isTrustedSyncEvent({
        GITHUB_ACTIONS: 'true',
        GITHUB_EVENT_NAME: 'workflow_dispatch',
      }),
    ).toBe(false);
  });

  it('refuses a schedule event outside GitHub Actions (GITHUB_ACTIONS !== "true")', () => {
    expect(
      isTrustedSyncEvent({
        GITHUB_ACTIONS: 'false',
        GITHUB_EVENT_NAME: 'schedule',
      }),
    ).toBe(false);
  });

  it('default-denies an empty env bag', () => {
    expect(isTrustedSyncEvent({})).toBe(false);
  });
});

describe('SYNC_EVENTS', () => {
  // Content pin (TRUST-02 / D-01 / T-04-02): the sync allowlist is default-deny
  // with exactly push + schedule. This deep-equality assertion turns any early
  // widening into a build failure -- widening the WRITE gate in Phase 5 must NOT
  // silently widen SYNC, because SYNC_EVENTS is a SEPARATE declaration, never an
  // import of trust.ts's TRUSTED_EVENTS.
  it('deep-equals the two-element push/schedule allowlist (TRUST-02)', () => {
    expect([...SYNC_EVENTS]).toEqual(['push', 'schedule']);
  });
});
