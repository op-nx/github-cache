import * as core from '@actions/core';
import type { Octokit } from '@octokit/rest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isSyncTrusted } from '../lib/sync-gate.js';
import { resolveGitHubToken } from '../lib/github-identity.js';
import { dogfoodBody } from '../lib/dogfood-body.js';
import { mirrorSeedHash } from '../lib/mirror-seed.js';
import { publishMirror } from '../publish/publish-mirror.js';
import {
  CACHE_OS_VALUES,
  cachePlatform,
  type CacheOs,
} from '../lib/release-asset-name.js';
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
// Partial-mock the platform mapper -- same idiom as github-identity.js above, and only
// `cachePlatform` is replaced so `CACHE_OS_VALUES` below is still the real single-sourced
// tuple.
//
// WHY, and it is a SAMPLING-RATE fix rather than a new assertion. The verify branch's
// expected producer is the hardcoded literal `'linux'` (index.ts, D-19/D-20/D-21). The only
// thing that had caught a `cachePlatform()` substitution there was the hand-authored
// literal payload in the setSecret test below, and that test's BITE is
// platform-dependent: on ubuntu -- the only OS the `test` job runs (ci.yml:337-338, Windows
// legs are XOS-04/Phase 12) -- the ambient value IS `'linux'`, so the correct form and the
// substituted form are both green and CI samples the property at a rate of ZERO. The
// substitution reddens only the live `dogfood-verify (windows-11-arm)` leg, which before
// CR-18 was push-gated to `main` and unobservable pre-merge. That leg now runs on
// same-repo pull requests, which RAISES the live sampling rate but does not retire this
// mock: the leg is still skipped on fork PRs, it is a CI job rather than a spec, and the
// point here is a machine-INDEPENDENT check that holds on whatever runner executes the
// suite. A live job sampling the property elsewhere is not a reason to sample it at ZERO
// here.
//
// Stubbing the ambient value is what makes the check machine-INDEPENDENT: LINT-02 bans
// reading the real platform in a spec (eslint.config.mjs, the no-restricted-syntax ban)
// precisely because a machine-dependent expectation is how a guard becomes right on one
// matrix leg and wrong on another. The default is the seed leg's own OS so every other
// test in this file reads the same value it read before, deterministically rather than
// from whatever machine happens to run the suite.
vi.mock('../lib/release-asset-name.js', async (orig) => {
  const actual = await orig<typeof import('../lib/release-asset-name.js')>();

  return { ...actual, cachePlatform: vi.fn((): CacheOs => 'linux') };
});

const isSyncTrustedMock = vi.mocked(isSyncTrusted);
const resolveGitHubTokenMock = vi.mocked(resolveGitHubToken);
const publishMirrorMock = vi.mocked(publishMirror);
const serveMock = vi.mocked(serve);
const getInputMock = vi.mocked(core.getInput);
const cachePlatformMock = vi.mocked(cachePlatform);

/**
 * The seed leg's OS, as a literal -- the same value the verify branch hardcodes and
 * `dogfood-body.spec.ts` pins. Named once here so the cross-OS cases below derive their
 * reader OSes from the real `CACHE_OS_VALUES` minus this one, rather than spelling "the OS
 * that is not this machine's" (which is the banned machine-dependent form).
 */
const SEED_PRODUCER_OS = 'linux';

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

describe('createPublishClient.listCacheEntries ref scoping (TRUST-10)', () => {
  // THE PIN BEHIND THE COMMENT LOCK in action/index.ts's `Scope to this ref` adapter
  // comment. What is pinned is not "a ref is passed" but the WHOLE call: the endpoint
  // reference, every option beside it, and the fact that there is exactly ONE
  // enumeration. Three separate regressions are in scope and each reddens a DIFFERENT
  // case below, which is why this is not one assertion:
  //   - dropping `ref` from the options   -> the two ref cases redden
  //   - adding a SECOND paginate call     -> only the count case reddens
  //   - hardcoding the ref value          -> only the SECOND ref case reddens
  // A property-scoped `expect(opts.ref).toBe(ref)` would pass through all of the first
  // and none of the last two, which is the shape D-11 rejects.
  //
  // `getActionsCacheList` is held as a NAMED sentinel and asserted by identity: the
  // endpoint reference is half of what makes the call scoped, and swapping it for an
  // unscoped list endpoint is a regression a `{ ref }`-only check cannot see.
  function octokitSpy() {
    const getActionsCacheList = {};
    const paginate = vi.fn().mockResolvedValue([]);

    return {
      getActionsCacheList,
      paginate,
      octokit: {
        paginate,
        rest: { actions: { getActionsCacheList } },
      } as unknown as Octokit,
    };
  }

  // TWO distinct refs, so the value is proven PLUMBED from the constructor rather than
  // matched by coincidence against a default or a hardcoded literal. The second is a
  // non-default-branch ref on purpose: it is the value whose entries must never reach
  // the world-readable mirror.
  it.each([
    'refs/heads/main',
    'refs/heads/gsd/v0.0.2-os-invariant-cross-os-sharing',
  ])('scopes the enumeration to the constructor ref %s', async (ref) => {
    const { getActionsCacheList, paginate, octokit } = octokitSpy();

    await createPublishClient(
      octokit,
      'op-nx',
      'github-cache',
      ref,
    ).listCacheEntries();

    // ONE assertion over the WHOLE recorded argument ARRAY (D-11), never a per-property
    // read: `per_page` and the owner/repo pair are inside it deliberately, so a mistake
    // that kept `ref` while dropping the page size or the repo identity still reddens.
    expect(paginate.mock.calls[0]).toEqual([
      getActionsCacheList,
      { owner: 'op-nx', repo: 'github-cache', ref, per_page: 100 },
    ]);
  });

  it('enumerates the Actions cache EXACTLY once, so no second unscoped enumeration can be added', async () => {
    const { paginate, octokit } = octokitSpy();

    await createPublishClient(
      octokit,
      'op-nx',
      'github-cache',
      'refs/heads/main',
    ).listCacheEntries();

    // A SEPARATE case from the argument-array cases above, and not a redundant one: a
    // deep equality on `.mock.calls[0]` says nothing whatsoever about a SECOND call, and
    // a second, unscoped enumeration is exactly the regression the ref scoping exists to
    // prevent. Negate the QUANTIFIER (how many calls), not the predicate.
    expect(paginate).toHaveBeenCalledOnce();
  });
});

describe('createPublishClient.uploadReleaseAsset label forwarding (OBS-03, D-09)', () => {
  // LOAD-BEARING, not ceremonial. TypeScript ACCEPTS a contextually-typed adapter that
  // declares only three parameters against the four-parameter PublishClient method -- a
  // narrower implementation signature is assignable -- so forgetting the adapter half of
  // D-09 typechecks clean, passes every engine test (which asserts against a fake, not
  // this adapter), and silently drops the label on every real upload. This is the only
  // place that failure mode is observable before it reaches uploads.github.com.
  it('forwards the label into the Octokit call alongside an unchanged name', async () => {
    const uploadReleaseAsset = vi.fn(async () => ({}));
    const octokit = {
      rest: { repos: { uploadReleaseAsset } },
    } as unknown as Octokit;
    const bytes = Buffer.from('ab');

    const client = createPublishClient(octokit, 'op-nx', 'github-cache', 'ref');
    await client.uploadReleaseAsset(7, 'nm', bytes, 'mirrored-by: windows');

    expect(uploadReleaseAsset).toHaveBeenCalledOnce();
    // ONE assertion over the WHOLE recorded argument object, never a per-property pair
    // (D-11). `name` is inside it deliberately: a mistake that wrote the label over the
    // filename would satisfy a label-only check while renaming every mirrored asset.
    // `label` is an OS-agnostic pass-through here -- the adapter never derives it -- so
    // the value is an INPUT chosen by this test, not a hand-authored expectation about
    // the running machine.
    expect(uploadReleaseAsset).toHaveBeenCalledWith({
      owner: 'op-nx',
      repo: 'github-cache',
      release_id: 7,
      name: 'nm',
      data: bytes,
      label: 'mirrored-by: windows',
      headers: {
        'content-type': 'application/octet-stream',
        'content-length': '2',
      },
    });
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
    // Restored per test, because mockClear (the file-level beforeEach) does NOT undo a
    // mockReturnValue -- so without this the cross-OS cases below would leak their reader
    // OS into every later test in this describe.
    cachePlatformMock.mockReturnValue(SEED_PRODUCER_OS);
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

  // VER-06's leaf-level NON-VACUITY control, and the one clause in this file whose verdict
  // does not depend on which machine ran the suite. `dogfood-body.spec.ts` proves the
  // producer argument REACHES the bytes; this proves the verify branch's expectation is not
  // DERIVED from the reader's own platform. Those are different mutations and the first
  // does not catch the second.
  //
  // Reader OSes come from the real CACHE_OS_VALUES minus the seed's, so adding an OS
  // discriminator to that tuple automatically adds a case here rather than leaving one
  // reader OS unsampled.
  it.each(CACHE_OS_VALUES.filter((os) => os !== SEED_PRODUCER_OS))(
    'accepts the linux-seeded payload on a %s reader and names linux as the producer (VER-06)',
    async (readerOs) => {
      getInputMock.mockImplementation((name: string) =>
        name === 'operation' ? 'verify' : 'run-1',
      );
      serveMock.mockResolvedValue(fakeServer());
      cachePlatformMock.mockReturnValue(readerOs);
      // The same hand-authored literal the setSecret test pins (the pinned-literal
      // discipline, A1b) -- deliberately NOT dogfoodBody(...), which would survive a
      // template rename.
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(Buffer.from('nx-github-cache-dogfood:linux:run-1'), {
          status: 200,
        }),
      );

      await run();

      expect(core.setFailed).not.toHaveBeenCalled();
      // The live VER-06 log line, reproduced machine-independently: the reader's OS and the
      // producer's OS are DIFFERENT strings in one message. A verify branch that derived its
      // expectation from the ambient platform cannot produce this line at all -- it would
      // setFailed with the provenance mismatch instead, and it would do so on EVERY runner
      // rather than only on the Windows leg.
      expect(core.info).toHaveBeenCalledWith(
        expect.stringContaining(
          `cache HIT for run-1 on ${readerOs} with bytes matching a '${SEED_PRODUCER_OS}'-produced payload`,
        ),
      );
    },
  );

  // No spec asserted this string before OBS-05, which is precisely why it sat stale
  // naming only two of the operations. Asserted per NAME rather than on the whole
  // sentence so a reworded message stays green while a DROPPED operation reddens.
  it('names every valid operation when the operation input is unrecognised', async () => {
    getInputMock.mockImplementation((name: string) =>
      name === 'operation' ? 'not-an-operation' : 'run-1',
    );
    serveMock.mockResolvedValue(fakeServer());

    await run();

    expect(core.setFailed).toHaveBeenCalledOnce();
    const [message] = vi.mocked(core.setFailed).mock.calls[0];

    expect(message).toContain("unknown operation 'not-an-operation'");

    for (const operation of ['seed', 'mirror-seed', 'verify']) {
      // Quoted on BOTH sides deliberately: bare `seed` is a substring of
      // `mirror-seed`, so an unquoted check would pass with 'seed' itself deleted.
      expect(message).toContain(`'${operation}'`);
    }
  });

  /**
   * OBS-05's url-reuse trap, closed by a test rather than by a comment. `url` is built
   * from the RAW `hash` input ABOVE the operation branches, so a mirror-seed branch
   * that reused it would PUT at nx-cache-<run_id> -- and the PUT still returns 200, so
   * nothing fails here and read-back.ts MISSES silently instead.
   *
   * The assertion is on the WHOLE url and on the final PATH SEGMENT, never
   * toContain(RUN_ID): the derived seed CONTAINS the run id, so a substring check is
   * vacuous by construction. That is the one detail that makes this case worth having.
   */
  describe('the mirror-seed operation (OBS-05, D-12/D-13)', () => {
    const RUN_ID = '30401077417';

    function driveMirrorSeed(status: number) {
      getInputMock.mockImplementation((name: string) =>
        name === 'operation' ? 'mirror-seed' : RUN_ID,
      );
      serveMock.mockResolvedValue(fakeServer());

      return vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(new Response(null, { status }));
    }

    it.each(CACHE_OS_VALUES)(
      'PUTs at the DERIVED seed on a %s leg, never at the raw run id, and stamps the same leg into the body',
      async (producerOs) => {
        cachePlatformMock.mockReturnValue(producerOs);
        const fetchSpy = driveMirrorSeed(200);

        await run();

        // Asserted BEFORE the call is read, so an absent branch reports a call-count
        // mismatch rather than throwing on an undefined tuple.
        expect(fetchSpy).toHaveBeenCalledOnce();

        const [requestedUrl, init] = fetchSpy.mock.calls[0];
        const seedHash = mirrorSeedHash(RUN_ID, producerOs);

        expect(String(requestedUrl)).toBe(
          `http://127.0.0.1:1234/v1/cache/${seedHash}`,
        );
        expect(String(requestedUrl).split('/').at(-1)).not.toBe(RUN_ID);
        expect(init?.method).toBe('PUT');
        // DERIVED rather than hand-authored, and the exception is deliberate: the claim
        // under test is which ARGUMENTS reach the body, not the template. The template
        // itself is pinned by dogfood-body.spec.ts and by the two hand-authored literals
        // in the verify cases above.
        expect(init?.body).toEqual(dogfoodBody(seedHash, producerOs));
      },
    );

    it('fails the job loud on a non-200 PUT, without throwing', async () => {
      const fetchSpy = driveMirrorSeed(500);

      await expect(run()).resolves.toBeUndefined();

      expect(fetchSpy).toHaveBeenCalledOnce();
      expect(core.setFailed).toHaveBeenCalledWith(
        expect.stringContaining('expected PUT 200, got 500'),
      );
    });
  });
});
