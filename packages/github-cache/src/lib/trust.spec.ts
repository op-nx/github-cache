import { describe, expect, it } from 'vitest';
import { TRUSTED_EVENTS, isWriteTrusted } from './trust.js';

// Every trigger that must be REFUSED even inside GitHub Actions (TRUST-03). These
// are the dangerous shared-default-scope / fork-reachable events plus a spread of
// other non-trusted triggers. Adding a refused trigger here is a one-line edit.
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

describe('isWriteTrusted', () => {
  it('trusts push inside GitHub Actions (TRUST-03)', () => {
    const result = isWriteTrusted({ GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: 'push' });

    expect(result).toBe(true);
  });

  it('trusts schedule inside GitHub Actions (TRUST-03)', () => {
    const result = isWriteTrusted({ GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: 'schedule' });

    expect(result).toBe(true);
  });

  for (const event of REFUSED_EVENTS) {
    it(`refuses ${event} even inside GitHub Actions (TRUST-03)`, () => {
      const result = isWriteTrusted({ GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: event });

      expect(result).toBe(false);
    });
  }

  it('refuses an unset event name inside GitHub Actions (TRUST-03)', () => {
    const result = isWriteTrusted({ GITHUB_ACTIONS: 'true' });

    expect(result).toBe(false);
  });

  it('refuses a trusted event outside GitHub Actions (TRUST-03)', () => {
    const result = isWriteTrusted({ GITHUB_EVENT_NAME: 'push' });

    expect(result).toBe(false);
  });

  it('refuses when GITHUB_ACTIONS is not exactly "true" (TRUST-03)', () => {
    const result = isWriteTrusted({ GITHUB_ACTIONS: 'false', GITHUB_EVENT_NAME: 'push' });

    expect(result).toBe(false);
  });

  it('default-denies an empty env bag (TRUST-03)', () => {
    const result = isWriteTrusted({});

    expect(result).toBe(false);
  });
});

describe('TRUSTED_EVENTS', () => {
  // Content pin (TRUST-03): the allowlist is default-deny with exactly two entries.
  // This deep-equality assertion turns an early widening into a build failure --
  // widening to contributor-facing triggers is Phase 5 / TRUST-01 work, not a
  // silent one-word maintenance edit here.
  it('deep-equals the two-element push/schedule allowlist (TRUST-03)', () => {
    expect([...TRUSTED_EVENTS]).toEqual(['push', 'schedule']);
  });
});
