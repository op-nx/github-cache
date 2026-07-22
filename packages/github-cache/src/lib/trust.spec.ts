import { describe, expect, it } from 'vitest';
import { isSyncTrusted } from './sync-gate.js';
import { HOST_GATED_EVENTS, TRUSTED_EVENTS, isWriteTrusted } from './trust.js';

// The predicates now return a discriminated { trusted, reason } union; these
// helpers extract the boolean so the existing true/false assertions below stay
// unchanged (the trust DECISION is what these tests pin, not the result shape).
const writeTrusted = (...args: Parameters<typeof isWriteTrusted>): boolean =>
  isWriteTrusted(...args).trusted;
const syncTrusted = (...args: Parameters<typeof isSyncTrusted>): boolean =>
  isSyncTrusted(...args).trusted;

// The host-independent base allowlist: trusted on ANY host (TRUST-01 / D-01).
const BASE_EVENTS = ['push', 'schedule'];

// The host-gated widened events: trusted ONLY where GitHub's server-side
// read-only-default-branch cache guard exists (github.com / *.ghe.com).
const WIDENED_EVENTS = ['pull_request', 'release'];

// Every trigger that must be REFUSED on EVERY host even inside GitHub Actions
// (TRUST-01, Pitfall 1). The dangerous trio (pull_request_target, issue_comment,
// workflow_run) run in the shared default-branch scope and are the CREEP vector;
// they are NOT in TRUSTED_EVENTS nor HOST_GATED_EVENTS, so a github.com host must
// never rescue them. pull_request and release are NO LONGER here -- they moved to
// the host-gated set.
const REFUSED_EVENTS = [
  'pull_request_target',
  'issue_comment',
  'workflow_run',
  'workflow_dispatch',
  'repository_dispatch',
  'merge_group',
  'delete',
  'registry_package',
  'page_build',
];

// GITHUB_SERVER_URL values that DO carry GitHub's guard -> widened events admitted.
// http://github.com is included to prove the match is host-based, not scheme-based.
const GUARDED_SERVER_URLS = [
  'https://github.com',
  'https://octocorp.ghe.com', // a real *.ghe.com Data Residency subdomain
  'http://github.com',
];

// GITHUB_SERVER_URL values WITHOUT the guard -> widened events denied (fail-closed).
const FAIL_CLOSED_SERVER_URLS = [
  'https://ghes.example.com', // a GHES appliance host (no server-side guard)
  '', // empty -> URL throws -> fail closed
  'not a url', // malformed -> URL throws -> fail closed
  'https://github.com.attacker.com', // structural hostname, NOT a substring includes
  'https://notghe.com', // endsWith('.ghe.com') needs a real leading label
  'https://ghe.com', // bare ghe.com rejected (no leading label)
];

describe('isWriteTrusted base events (host-independent)', () => {
  for (const event of BASE_EVENTS) {
    it(`trusts ${event} inside GitHub Actions with no host (TRUST-01)`, () => {
      const result = writeTrusted({
        GITHUB_ACTIONS: 'true',
        GITHUB_EVENT_NAME: event,
      });

      expect(result).toBe(true);
    });

    it(`trusts ${event} even on a GHES host (base events are host-independent) (TRUST-01)`, () => {
      const result = writeTrusted({
        GITHUB_ACTIONS: 'true',
        GITHUB_EVENT_NAME: event,
        GITHUB_SERVER_URL: 'https://ghes.example.com',
      });

      expect(result).toBe(true);
    });
  }
});

describe('isWriteTrusted host-gated widened events (TRUST-01, D-01, ADR C1)', () => {
  for (const event of WIDENED_EVENTS) {
    for (const serverUrl of GUARDED_SERVER_URLS) {
      it(`trusts ${event} on ${serverUrl} (guard present)`, () => {
        const result = writeTrusted({
          GITHUB_ACTIONS: 'true',
          GITHUB_EVENT_NAME: event,
          GITHUB_SERVER_URL: serverUrl,
        });

        expect(result).toBe(true);
      });
    }

    for (const serverUrl of FAIL_CLOSED_SERVER_URLS) {
      it(`refuses ${event} on ${JSON.stringify(serverUrl)} (fail-closed)`, () => {
        const result = writeTrusted({
          GITHUB_ACTIONS: 'true',
          GITHUB_EVENT_NAME: event,
          GITHUB_SERVER_URL: serverUrl,
        });

        expect(result).toBe(false);
      });
    }

    it(`refuses ${event} when GITHUB_SERVER_URL is unset (fail-closed on missing)`, () => {
      const result = writeTrusted({
        GITHUB_ACTIONS: 'true',
        GITHUB_EVENT_NAME: event,
      });

      expect(result).toBe(false);
    });
  }
});

describe('isWriteTrusted dangerous / unlisted events (refused on every host)', () => {
  for (const event of REFUSED_EVENTS) {
    it(`refuses ${event} even with a github.com host present (Pitfall 1, TRUST-01)`, () => {
      // A guarded host must NOT rescue a dangerous/unlisted event: it is in
      // neither allowlist, so default-deny applies regardless of host.
      const result = writeTrusted({
        GITHUB_ACTIONS: 'true',
        GITHUB_EVENT_NAME: event,
        GITHUB_SERVER_URL: 'https://github.com',
      });

      expect(result).toBe(false);
    });
  }
});

describe('isWriteTrusted default-deny guards', () => {
  it('refuses an unset event name inside GitHub Actions (TRUST-01)', () => {
    const result = writeTrusted({ GITHUB_ACTIONS: 'true' });

    expect(result).toBe(false);
  });

  it('refuses a base event outside GitHub Actions (TRUST-01)', () => {
    const result = writeTrusted({ GITHUB_EVENT_NAME: 'push' });

    expect(result).toBe(false);
  });

  it('refuses a widened event outside GitHub Actions even on github.com (TRUST-01)', () => {
    const result = writeTrusted({
      GITHUB_EVENT_NAME: 'pull_request',
      GITHUB_SERVER_URL: 'https://github.com',
    });

    expect(result).toBe(false);
  });

  it('refuses when GITHUB_ACTIONS is not exactly "true" (TRUST-01)', () => {
    const result = writeTrusted({
      GITHUB_ACTIONS: 'false',
      GITHUB_EVENT_NAME: 'push',
    });

    expect(result).toBe(false);
  });

  it('default-denies an empty env bag (TRUST-01)', () => {
    const result = writeTrusted({});

    expect(result).toBe(false);
  });
});

describe('allowlist content pins', () => {
  // Content pin (TRUST-01): the host-independent base stays exactly push/schedule.
  it('TRUSTED_EVENTS deep-equals the two-element push/schedule base (TRUST-01)', () => {
    expect([...TRUSTED_EVENTS]).toEqual(['push', 'schedule']);
  });

  // Content pin (TRUST-01, Pitfall 1): the host-gated widened set is EXACTLY
  // pull_request + release. This deep-equality turns any drift (e.g. adding
  // pull_request_target) into a build failure.
  it('HOST_GATED_EVENTS deep-equals the two-element pull_request/release set (TRUST-01)', () => {
    expect([...HOST_GATED_EVENTS]).toEqual(['pull_request', 'release']);
  });
});

describe('write-widen did NOT widen the sync gate (ADR C2 cross-check)', () => {
  // Regression (Pitfall 3): TRUST-01 widened the WRITE gate to pull_request /
  // release on a github.com host. The SYNC/publish gate is a SEPARATE allowlist
  // (sync-gate.ts) and MUST stay narrow, or the mirror would publish a
  // PR/release-scoped entry as a world-readable Release asset (CREEP re-poison).
  //
  // Injected default-branch reader so the predicate never touches the filesystem
  // (mirrors sync-gate.spec.ts's readMain). It resolves to the default branch so
  // the ONLY reason isSyncTrusted refuses is the event allowlist -- not the
  // branch/ref checks -- making this non-vacuous.
  const readMain = (): string => 'main';

  for (const event of ['pull_request', 'release']) {
    it(`isSyncTrusted refuses ${event} even on a github.com host on the default branch (TRUST-01 guard)`, () => {
      const result = syncTrusted(
        {
          GITHUB_ACTIONS: 'true',
          GITHUB_EVENT_NAME: event,
          GITHUB_REF: 'refs/heads/main',
          GITHUB_REF_NAME: 'main',
          GITHUB_SERVER_URL: 'https://github.com',
        },
        readMain,
      );

      expect(result).toBe(false);
    });
  }
});
