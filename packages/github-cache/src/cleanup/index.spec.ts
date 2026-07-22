import * as core from '@actions/core';
import { Octokit } from '@octokit/rest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isTrustedSyncEvent } from '../lib/sync-gate.js';
import { resolveGitHubToken } from '../lib/github-identity.js';
import { cleanupMirror } from './cleanup.js';
import { run } from './index.js';

// The cleanup bin wires a load-bearing control that lives nowhere else -- the in-code
// trust gate (isTrustedSyncEvent) gated FIRST in run(), mirroring runPublish. Before
// run() was exported the module self-ran on import so the gate-first ordering and the
// gated-out no-delete guarantee were untestable-by-import (the action/index.spec.ts I5
// precedent). These specs pin that a gated-out context NEVER constructs a client nor
// reaches the delete engine.

vi.mock('@actions/core', () => ({
  info: vi.fn(),
  warning: vi.fn(),
  setFailed: vi.fn(),
}));
vi.mock('../lib/sync-gate.js', () => ({ isTrustedSyncEvent: vi.fn() }));
vi.mock('./cleanup.js', () => ({ cleanupMirror: vi.fn() }));
vi.mock('@octokit/rest', () => ({ Octokit: vi.fn() }));
// Keep the real GITHUB_REPOSITORY_PATTERN + resolveMaxAgeDays; only stub the token
// resolver (same seam action/index.spec.ts stubs).
vi.mock('../lib/github-identity.js', async (orig) => {
  const actual = await orig<typeof import('../lib/github-identity.js')>();

  return { ...actual, resolveGitHubToken: vi.fn() };
});

const isTrustedSyncEventMock = vi.mocked(isTrustedSyncEvent);
const resolveGitHubTokenMock = vi.mocked(resolveGitHubToken);
const cleanupMirrorMock = vi.mocked(cleanupMirror);
const OctokitMock = vi.mocked(Octokit);

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  vi.clearAllMocks();
  process.env = { ...ORIGINAL_ENV };
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

describe('cleanup run() trust gate (CREEP C2 / RETAIN-03)', () => {
  it('gates on isTrustedSyncEvent FIRST and returns without constructing a client or deleting when the context is untrusted', async () => {
    isTrustedSyncEventMock.mockReturnValue(false);
    // Deliberately hostile downstream state: a corrupt repository that WOULD throw if
    // the gate were not first. The gate must short-circuit before it is ever read.
    process.env.GITHUB_REPOSITORY = 'not/a/valid/repo';

    await expect(run()).resolves.toBeUndefined();

    expect(isTrustedSyncEventMock).toHaveBeenCalledOnce();
    // The retention/CREEP control: a gated-out context never constructs Octokit and
    // never reaches the delete engine.
    expect(OctokitMock).not.toHaveBeenCalled();
    expect(cleanupMirrorMock).not.toHaveBeenCalled();
    // A gated-out cleanup is a WARNING, not info: on a green scheduled job, an
    // info line is invisible, so a permanently-gated-out cleanup would look
    // identical to a healthy one (OBS-01). Never setFailed -- a non-sync context
    // is not a fault, and an aborting guard is itself a way for retention to stop.
    expect(core.warning).toHaveBeenCalledWith(
      expect.stringContaining('skipping'),
    );
    expect(core.setFailed).not.toHaveBeenCalled();
  });

  it('throws on a corrupted GITHUB_REPOSITORY once trusted (fail-closed, never resolve into another namespace)', async () => {
    isTrustedSyncEventMock.mockReturnValue(true);
    process.env.GITHUB_REPOSITORY = 'not-a-valid-owner-repo/extra/segment';

    await expect(run()).rejects.toThrow(/owner\/name/);
    expect(cleanupMirrorMock).not.toHaveBeenCalled();
  });

  it('throws when no delete token resolves once trusted (fail loud once, not per-item 401s)', async () => {
    isTrustedSyncEventMock.mockReturnValue(true);
    process.env.GITHUB_REPOSITORY = 'op-nx/github-cache';
    resolveGitHubTokenMock.mockReturnValue(undefined);

    await expect(run()).rejects.toThrow(/no GH_TOKEN\/GITHUB_TOKEN/);
    expect(cleanupMirrorMock).not.toHaveBeenCalled();
  });

  it('drives cleanupMirror once when trusted with a valid repo + token (happy path reaches the engine)', async () => {
    isTrustedSyncEventMock.mockReturnValue(true);
    process.env.GITHUB_REPOSITORY = 'op-nx/github-cache';
    resolveGitHubTokenMock.mockReturnValue('gh-token');
    cleanupMirrorMock.mockResolvedValue(undefined as never);

    await run();

    expect(OctokitMock).toHaveBeenCalledOnce();
    expect(cleanupMirrorMock).toHaveBeenCalledOnce();
  });
});
