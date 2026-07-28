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
    // addRaw joins the mock for VER-05's appended compression-method line. Chainable
    // like its siblings, matching the real Summary's fluent shape.
    addRaw: vi.fn(() => summary),
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
// Mock the resilient-octokit helper, not @octokit/rest: the helper runs
// Octokit.plugin(retry, throttling) at module load, which a bare Octokit: vi.fn()
// mock cannot satisfy. runPublish's tests never reach construction anyway.
vi.mock('../lib/resilient-octokit.js', () => ({
  createResilientOctokit: vi.fn(),
}));
// Module-mock the sibling leaf. This is the repo's established seam for a sibling
// leaf (local-context.spec.ts, select-backend.spec.ts:24), and here it is what makes
// the asserted summary text DETERMINISTIC: the real resolveCompressionMethod spawns
// `zstd`, so leaving it live would make the expected line depend on whether the
// machine running the suite happens to have zstd installed -- green on a workstation
// with it, red on one without, which is a flake waiting to happen rather than a test.
// The derivation itself is asserted in compression-method.spec.ts, where the seam
// sits at node:child_process precisely so the branch under test survives.
vi.mock('../lib/compression-method.js', () => ({
  resolveCompressionMethod: vi.fn(() => 'zstd-without-long'),
}));
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

describe('runPublish OBS-01 summary rows (D-17)', () => {
  it('reports scanned and restore-MISS alongside mirrored/skipped/failed, labelling the miss row as a subset of skipped', async () => {
    isSyncTrustedMock.mockReturnValue({ trusted: true });
    process.env.GITHUB_REPOSITORY = 'op-nx/github-cache';
    resolveGitHubTokenMock.mockReturnValue('token');
    // Shape echoes the investigated windows leg: 25 distinct hashes, 12 restore MISSes,
    // 2 mirrored. Self-consistent -- mirrored + skipped + failed === scanned, and the
    // MISSes are INSIDE skipped, never added to it.
    publishMirrorMock.mockResolvedValue({
      scanned: 25,
      mirrored: 2,
      skipped: 23,
      readMisses: 12,
      failed: 0,
    });

    await runPublish();

    expect(core.summary.addTable).toHaveBeenCalledOnce();
    const rows = vi.mocked(core.summary.addTable).mock.calls[0][0];

    // Non-vacuous: the COUNT must reach the table, not just the label -- this fails if a
    // row is wired to the wrong field. The miss row's label carries the subset relation,
    // because readMisses is a strict subset of skipped and sibling rows would make every
    // reader double-count (2 + 23 + 12 != 25).
    expect(rows).toContainEqual(['scanned', '25']);
    expect(rows).toContainEqual(['restore-MISS (of skipped)', '12']);
    // TWICE, not once: writeCountSummary's table, then VER-05's appended line. The
    // count moved from one to two in the same commit that added the second write,
    // because write() APPENDS by default (summary.js:69-77) and the two writes are
    // the whole append mechanism.
    expect(core.summary.write).toHaveBeenCalledTimes(2);
  });

  // VER-05 / D-16. Asserted on CONTENT, not only on the write count: a bare count of
  // two is satisfied by two EMPTY writes, so a count-only assertion would stay green
  // if the surfacing silently reverted to nothing. It is a RAW line rather than a
  // table row because writeCountSummary renders a column headed `count` and takes
  // [string, number] pairs, which `zstd-without-long` cannot go through.
  it('appends the resolved compression method as a raw summary line, surfaced and never gated (VER-05)', async () => {
    isSyncTrustedMock.mockReturnValue({ trusted: true });
    process.env.GITHUB_REPOSITORY = 'op-nx/github-cache';
    resolveGitHubTokenMock.mockReturnValue('token');
    publishMirrorMock.mockResolvedValue({
      scanned: 1,
      mirrored: 1,
      skipped: 0,
      readMisses: 0,
      failed: 0,
    });

    await runPublish();

    expect(core.summary.addRaw).toHaveBeenCalledOnce();
    expect(core.summary.addRaw).toHaveBeenCalledWith(
      expect.stringContaining(
        'compression method (@actions/cache): zstd-without-long',
      ),
      true,
    );
    // Also in the log, not only the summary (D-16): a job summary is not readable
    // from a failed step's output, and the log is.
    expect(core.info).toHaveBeenCalledWith(
      expect.stringContaining('resolved compression method zstd-without-long'),
    );
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
    // HAND-AUTHORED on purpose (the pinned-literal discipline, A1b): kept as a literal
    // rather than reconstructed via dogfoodBody(...), which would survive a template
    // rename and stop pinning anything. The literal now encodes the PRODUCER OS as well
    // as the hash, matching the verify branch's expected `'linux'` producer -- so a
    // template change is intentionally a two-file edit, here and in dogfood-body.spec.ts.
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(Buffer.from('nx-github-cache-dogfood:linux:run-1'), {
        status: 200,
      }),
    );

    await run();

    expect(core.setSecret).toHaveBeenCalledWith('server-bearer-token');
    // Also assert the verify branch ACCEPTED that literal. Without this the literal
    // above is decorative: it documents the payload template but gates nothing, because
    // this test's only other assertion is about setSecret. Measured -- an M1 mutation
    // dropping producerOs from the payload left this file entirely green. With these two
    // lines the literal genuinely pins the template, which is what makes
    // dogfood-body.ts's "pinned in two files" claim true rather than aspirational.
    expect(core.setFailed).not.toHaveBeenCalled();
    expect(core.info).toHaveBeenCalledWith(
      expect.stringContaining('cache HIT'),
    );
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
