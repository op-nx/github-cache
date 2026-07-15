import { describe, expect, it } from 'vitest';
import { isWriteTrusted } from './trust.js';

const TRUSTED_EVENTS = [
  'push',
  'schedule',
  'workflow_dispatch',
  'repository_dispatch',
  'delete',
  'registry_package',
  'page_build',
  'merge_group',
];

const UNTRUSTED_EVENTS = [
  'pull_request',
  'pull_request_target',
  'fork',
  'issue_comment',
];

describe('isWriteTrusted', () => {
  it.each(TRUSTED_EVENTS)('trusts "%s" under GITHUB_ACTIONS', (eventName) => {
    expect(
      isWriteTrusted({ GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: eventName }),
    ).toBe(true);
  });

  it.each(UNTRUSTED_EVENTS)('does not trust "%s"', (eventName) => {
    expect(
      isWriteTrusted({ GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: eventName }),
    ).toBe(false);
  });

  it('does not trust a trusted event name outside GITHUB_ACTIONS', () => {
    expect(isWriteTrusted({ GITHUB_EVENT_NAME: 'push' })).toBe(false);
  });

  it('does not trust a local run with no GITHUB_EVENT_NAME at all', () => {
    expect(isWriteTrusted({ GITHUB_ACTIONS: 'true' })).toBe(false);
  });

  it('does not trust GITHUB_ACTIONS set to a non-"true" value', () => {
    expect(
      isWriteTrusted({ GITHUB_ACTIONS: '1', GITHUB_EVENT_NAME: 'push' }),
    ).toBe(false);
  });
});
