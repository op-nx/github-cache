import * as core from '@actions/core';
import type { Octokit } from '@octokit/rest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isSyncTrusted } from '../lib/sync-gate.js';
import { resolveGitHubToken } from '../lib/github-identity.js';
import { publishMirror } from '../publish/publish-mirror.js';
import { serve } from '../serve.js';
import { createPublishClient, run, runPublish } from './index.js';

// The bin wires load-bearing controls that live nowhere else -- the sync-gate-FIRST
// ordering (isSyncTrusted, not isWriteTrusted), the keyless-row filter, and the
// dogfood fail-loud branches. Before I5 the module self-ran on import so none of it
// was testable; the direct-invocation guard now lets these be imported and asserted.

vi.mock('@actions/core', () => {
  const summary = {
    addHeading: vi.fn(() => summary),
    addTable: vi.fn(() => summary),
    write: vi.fn(async () => summary),
  };

  return {
    info: vi.fn(),
    setFailed: vi.fn(),
    setSecret: vi.fn(),
    getInput: vi.fn(),
    summary,
  };
});
vi.mock('../serve.js', () => ({ serve: vi.fn() }));
vi.mock('../lib/sync-gate.js', () => ({ isSyncTrusted: vi.fn() }));
vi.mock('../publish/publish-mirror.js', () => ({ publishMirror: vi.fn() }));
vi.mock('@octokit/rest', () => ({ Octokit: vi.fn() }));
// Keep the real GITHUB_REPOSITORY_PATTERN; only stub the token resolver.
vi.mock('../lib/github-identity.js', async (orig) => {
  const actual = await orig<typeof import('../lib/github-identity.js')>();

  return { ...actual, resolveGitHubToken: vi.fn() };
});

const isSyncTrustedMock = vi.mocked(isSyncTrusted);
const resolveGitHubTokenMock = vi.mocked(resolveGitHubToken);
const publishMirrorMock = vi.mocked(publishMirror);
const serveMock = vi.mocked(serve);
const getInputMock = vi.mocked(core.getInput);

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  vi.clearAllMocks();
  process.env = { ...ORIGINAL_ENV };
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

describe('runPublish sync gate + fail-closed identity (TRUST-02, CREEP C2)', () => {
  it('gates on isSyncTrusted FIRST and returns without constructing a client or calling the engine when untrusted', async () => {
    isSyncTrustedMock.mockReturnValue({
      trusted: false,
      reason: 'untrusted-event',
    });

    await runPublish();

    // The CREEP control: a gated-out context never reaches publishMirror.
    expect(isSyncTrustedMock).toHaveBeenCalledOnce();
    expect(publishMirrorMock).not.toHaveBeenCalled();
    expect(core.info).toHaveBeenCalledWith(expect.stringContaining('skipping'));
  });

  it('throws on a corrupted GITHUB_REPOSITORY (fail-closed, never resolve into another namespace)', async () => {
    isSyncTrustedMock.mockReturnValue({ trusted: true });
    process.env.GITHUB_REPOSITORY = 'not-a-valid-owner-repo/extra/segment';

    await expect(runPublish()).rejects.toThrow(/owner\/name/);
    expect(publishMirrorMock).not.toHaveBeenCalled();
  });

  it('throws when no upload token resolves (fail loud once, not per-request 401s)', async () => {
    isSyncTrustedMock.mockReturnValue({ trusted: true });
    process.env.GITHUB_REPOSITORY = 'op-nx/github-cache';
    resolveGitHubTokenMock.mockReturnValue(undefined);

    await expect(runPublish()).rejects.toThrow(/no GH_TOKEN\/GITHUB_TOKEN/);
    expect(publishMirrorMock).not.toHaveBeenCalled();
  });
});

describe('createPublishClient.listCacheEntries keyless-row filter', () => {
  it('drops rows without a string key so the engine only ever sees concrete keys', async () => {
    const octokit = {
      paginate: vi
        .fn()
        .mockResolvedValue([
          { key: 'nx-cache-aaa' },
          { key: undefined },
          { id: 7 },
          { key: 'nx-cache-bbb' },
        ]),
      rest: { actions: { getActionsCacheList: {} } },
    } as unknown as Octokit;

    const client = createPublishClient(octokit, 'op-nx', 'github-cache', 'ref');
    const entries = await client.listCacheEntries();

    expect(entries).toEqual([{ key: 'nx-cache-aaa' }, { key: 'nx-cache-bbb' }]);
  });
});

describe('run() dogfood fail-loud canary (T-2-19, T-2-20)', () => {
  function fakeServer() {
    return {
      token: 'server-bearer-token',
      url: 'http://127.0.0.1:1234',
      server: {} as never,
      port: 1234,
      shutdown: vi.fn(async () => {}),
    };
  }

  beforeEach(() => {
    process.env.ACTIONS_RUNTIME_TOKEN = 'runtime';
    process.env.ACTIONS_RESULTS_URL = 'https://results';
  });

  it('masks the bearer token with setSecret before driving any request (T-2-19)', async () => {
    getInputMock.mockImplementation((name: string) =>
      name === 'operation' ? 'verify' : 'run-1',
    );
    serveMock.mockResolvedValue(fakeServer());
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(Buffer.from('nx-github-cache-dogfood:run-1'), {
        status: 200,
      }),
    );

    await run();

    expect(core.setSecret).toHaveBeenCalledWith('server-bearer-token');
  });

  it('fails the job loud on a verify cache MISS (GET 404) -- a silent pass is the exact failure this canary catches (T-2-20)', async () => {
    getInputMock.mockImplementation((name: string) =>
      name === 'operation' ? 'verify' : 'run-1',
    );
    const server = fakeServer();
    serveMock.mockResolvedValue(server);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 404 }),
    );

    await run();

    expect(core.setFailed).toHaveBeenCalledWith(
      expect.stringContaining('MISS'),
    );
    // Always drains, even on the failure path.
    expect(server.shutdown).toHaveBeenCalledOnce();
  });

  it('fails the job loud on a verify HIT with mismatched bytes (crossed the service, wrong data)', async () => {
    getInputMock.mockImplementation((name: string) =>
      name === 'operation' ? 'verify' : 'run-1',
    );
    serveMock.mockResolvedValue(fakeServer());
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(Buffer.from('wrong-bytes'), { status: 200 }),
    );

    await run();

    expect(core.setFailed).toHaveBeenCalledWith(
      expect.stringContaining('did not match'),
    );
  });
});
