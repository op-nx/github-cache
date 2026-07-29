import * as core from '@actions/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createReleasesReadBackend } from '../backend/releases-backend.js';
import type { Hash } from '../lib/cache-key.js';
import { dogfoodBody } from '../lib/dogfood-body.js';
import {
  resolveLocalReadToken,
  resolveRepoIdentity,
} from '../lib/local-context.js';
import { mirrorSeedHash } from '../lib/mirror-seed.js';
import {
  CACHE_OS_VALUES,
  cachePlatform,
  releaseAssetName,
  type CacheOs,
} from '../lib/release-asset-name.js';
import { run } from './read-back.js';

// THIS BIN HAD NO SPEC BEFORE PLAN 09-08, and that is the direct cause of the regression
// those tests closed. read-back.ts carried a `//` comment asserting "producer and reader
// are the same OS by construction" directly above the byte comparison it justified.
// VER-01 (the workspace-relative path literal) and VER-03 (enableCrossOsArchive) made
// cross-OS restore WORK -- the phase's goal -- which falsified that premise, and nothing
// reddened. The failure was MEASURED live: run 30400231720, job
// `publish-verify (windows-11-arm)`, conclusion failure, on a windows leg that had
// mirrored the LINUX-produced payload under its own asset name.
//
// WHAT PLAN 10-05 CHANGES, AND WHY IT IS NOT A REVERT. 09-08 RELAXED the comparison to
// "any known producer" because the two publish legs shared ONE run-scoped seed key, so
// the producer was genuinely unknowable. OBS-05 gives each leg a seed key only that leg
// can produce (mirrorSeedHash), so the producer is known PER LEG by construction again --
// and the comparison TIGHTENS back to exactly one expected payload. The reader therefore
// accepts exactly ONE of CACHE_OS_VALUES.length candidates rather than any of them, which
// is the whole content of D-15.
//
// The spec drives the EXPORTED run() rather than an extracted helper. Both sibling bins
// in this package (cleanup/index.ts, action/index.ts) already export run() behind the
// same isEntrypoint(import.meta.url) guard and are driven by a co-located spec;
// isEntrypoint is what makes importing the module inert under vitest. read-back.ts was
// the only bin doing neither, which is exactly why its premise rotted unnoticed.
//
// THE OS AXIS IS `it.each(CACHE_OS_VALUES)`, NOT "the OS that is not this one", and after
// the tightening that discipline carries MORE weight rather than less. The reader's own OS
// is now an INPUT to the key it looks up, so `cachePlatform` is partial-mocked per case
// and every expectation is derived from the mocked value. Asserting acceptance for EVERY
// member and rejection for every OTHER member makes the verdict machine-INDEPENDENT and
// needs no ambient platform read -- which LINT-02 bans in unit specs (eslint.config.mjs,
// the no-restricted-syntax ban object) for precisely the reason this gap existed: a
// machine-dependent expectation is how a cross-OS-shared entry becomes right on one
// matrix leg and wrong on another. The `test` job is ubuntu-ONLY, so a hand-authored
// non-linux expectation would be sampled at rate ZERO. The ban's own name for the banned
// members is left unspelled here so the readable `git grep` check agrees with the
// enforcing lint run.
//
// GROUP B IS THE NON-VACUITY CONTRACT, and it matters as much as Group A. This spec's
// purpose is as much to prove the byte assertion still BITES as to prove it accepts the
// payload its own leg seeded. Deleting the assertion, or weakening it to a presence /
// length / HIT-only check, would trade a RED job for a SILENTLY-GREEN one -- strictly
// worse than the bug being fixed. Group B pins the four classes that must keep failing:
// garbage bytes, a truncated (partial) upload, an asset for a different hash, and a
// cross-run asset-name collision. They are UNCHANGED by the tightening apart from the
// derived seed each fixture is keyed on, and that continuity is the evidence they were
// PRESERVED rather than traded away.

vi.mock('@actions/core', () => ({ info: vi.fn(), setFailed: vi.fn() }));
// Mocking the whole backend module is what keeps this spec off the network: no client is
// constructed, so no token is resolved and no request is made (T-09-64). The read seam
// reduces to a single `get`, which is all ReadableBackend has (backend/types.ts).
vi.mock('../backend/releases-backend.js', () => ({
  createReleasesReadClient: vi.fn(),
  createReleasesReadBackend: vi.fn(),
}));
// PARTIAL mock, replacing ONLY cachePlatform (the action/index.spec.ts idiom). The spread
// keeps CACHE_OS_VALUES and releaseAssetName REAL, which is what makes the it.each axis
// honest: a fully-faked module would let this spec assert against its own invented OS
// vocabulary. releaseAssetName stays real deliberately -- it closes over the module's own
// cachePlatform, so both the bin and this spec derive the asset name the same way and the
// expectation survives CORR-02 collapsing that name.
vi.mock('../lib/release-asset-name.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/release-asset-name.js')>();

  return { ...actual, cachePlatform: vi.fn(actual.cachePlatform) };
});
// The label read resolves its token and repo through these two, and BOTH must be mocked or
// this spec spawns `gh auth token` / `git credential fill` / `git remote get-url` -- a
// subprocess that can touch a real keychain (the select-backend.spec.ts rule). `fetch` is
// stubbed below for the same reason: nothing here may reach api.github.com.
vi.mock('../lib/local-context.js', () => ({
  resolveLocalReadToken: vi.fn(),
  resolveRepoIdentity: vi.fn(),
}));

const createReleasesReadBackendMock = vi.mocked(createReleasesReadBackend);
const cachePlatformMock = vi.mocked(cachePlatform);
const resolveLocalReadTokenMock = vi.mocked(resolveLocalReadToken);
const resolveRepoIdentityMock = vi.mocked(resolveRepoIdentity);

// HAND-AUTHORED literals (the pinned-literal discipline, A1b). The hash is the REAL run
// id from the measured failure, so this spec and 09-EVIDENCE.md's addendum read as the
// same incident.
const HASH = '30400231720';
// A NEIGHBOURING run id -- one digit apart, SAME LENGTH. The same length is the whole
// point: it is the only different-hash fixture that reddens a length-only or prefix-only
// comparison.
const NEIGHBOUR_HASH = '30400231721';

// The reader OS every non-it.each case runs under. Taken from the REAL tuple by index
// rather than spelled as a literal: `test` is an ubuntu-only job, so a hand-authored
// 'linux' would make each of these cases a same-OS coincidence on the ONE machine that
// runs them in CI and sample the derivation at rate zero. Index 0 is not the `test` job's
// OS, so on CI every case below proves the bin takes its OS from cachePlatform rather
// than from the process it happens to run in.
const DEFAULT_READER_OS = CACHE_OS_VALUES[0];
const SEED = mirrorSeedHash(HASH, DEFAULT_READER_OS);
const NEIGHBOUR_SEED = mirrorSeedHash(NEIGHBOUR_HASH, DEFAULT_READER_OS);

// Every (readerOs, otherProducerOs) pair with the two DIFFERENT, built from the real
// tuple so a fourth OS discriminator widens this matrix automatically. This is the
// tightening's own proof obligation: under the old CACHE_OS_VALUES.find() scan every one
// of these pairs was ACCEPTED.
const CROSS_PRODUCER_PAIRS = CACHE_OS_VALUES.flatMap((readerOs) =>
  CACHE_OS_VALUES.filter((producerOs) => producerOs !== readerOs).map(
    (producerOs) => [readerOs, producerOs] as const,
  ),
);

const get = vi.fn();

const TOKEN = 'ghs-fake-token-for-the-label-read';
const REPO = 'op-nx/github-cache';
const RELEASE_ID = 4242;

// The publisher's page size, authored here as a pinned literal because read-back.ts's
// ASSETS_PER_PAGE is module-local. The pagination loop stops on the first SHORT page, so
// this value is what a multi-page fixture must fill page one with to force a second
// request -- which is the only reason it matters.
const ASSETS_PER_PAGE = 100;

type AssetRow = { name: string; label: string | null };

const fetchMock = vi.fn<typeof fetch>();

/**
 * The real global Response, not a hand-rolled object: `.ok`, `.status` and `.json()` then
 * behave exactly as the production reader sees them, so a status-discrimination bug cannot
 * hide behind a lenient fake.
 */
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** Serve one release lookup plus a paginated asset listing, page by page. */
function serveShard(pages: readonly (readonly AssetRow[])[]): void {
  fetchMock.mockImplementation((input) => {
    const url = new URL(String(input));

    if (url.pathname.includes('/releases/tags/')) {
      return Promise.resolve(jsonResponse({ id: RELEASE_ID }));
    }

    const page = Number(url.searchParams.get('page'));

    return Promise.resolve(jsonResponse(pages[page - 1] ?? []));
  });
}

/** The shard row for `readerOs`'s OWN seed asset, carrying `label` verbatim. */
function ownSeedRow(readerOs: CacheOs, label: string | null): AssetRow {
  return {
    name: releaseAssetName(mirrorSeedHash(HASH, readerOs) as Hash),
    label,
  };
}

/** The publisher's label value. Pinned as a literal, exactly as publish-mirror.spec.ts does. */
function mirroredBy(os: CacheOs): string {
  return `mirrored-by: ${os}`;
}

/** `count` rows that are NOT the asset under test -- page filler, nothing more. */
function decoyRows(count: number): AssetRow[] {
  return Array.from({ length: count }, (_, index) => ({
    name: `decoy-asset-${index}`,
    label: '',
  }));
}

// The repo's bin-spec harness (cleanup/index.spec.ts, action/index.spec.ts): a file-level
// env save plus a per-test copy. clearAllMocks (NOT resetAllMocks) -- reset would clear
// the `{ get }` implementation wired below and every rejection test would fail on a
// TypeError instead of on its merits.
const ORIGINAL_ENV = process.env;

beforeEach(() => {
  vi.clearAllMocks();
  process.env = { ...ORIGINAL_ENV };
  process.env.GITHUB_RUN_ID = HASH;
  createReleasesReadBackendMock.mockReturnValue({ get });
  cachePlatformMock.mockReturnValue(DEFAULT_READER_OS);
  resolveLocalReadTokenMock.mockResolvedValue(TOKEN);
  resolveRepoIdentityMock.mockResolvedValue(REPO);
  vi.stubGlobal('fetch', fetchMock);
  serveShard([[ownSeedRow(DEFAULT_READER_OS, mirroredBy(DEFAULT_READER_OS))]]);
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
  vi.unstubAllGlobals();
});

describe('round-trip read-back derives its OWN leg seed and accepts only that leg (OBS-05, D-15)', () => {
  it.each(CACHE_OS_VALUES)(
    'accepts the payload this %s leg itself seeded, keyed on its own derived seed',
    async (os) => {
      cachePlatformMock.mockReturnValue(os);
      const seed = mirrorSeedHash(HASH, os);
      get.mockResolvedValue({ kind: 'hit', bytes: dogfoodBody(seed, os) });
      serveShard([[ownSeedRow(os, mirroredBy(os))]]);

      await expect(run()).resolves.toBeUndefined();

      // The backend must be asked for the DERIVED seed, not the raw run id. Asserted on
      // the argument rather than inferred from acceptance: a reader that still looked up
      // the run id would ALSO resolve this fake, because the fake answers every hash.
      expect(get).toHaveBeenCalledWith(seed);
      expect(core.info).toHaveBeenCalledWith(
        expect.stringContaining(`'${os}'-produced`),
      );
    },
  );

  it.each(CROSS_PRODUCER_PAIRS)(
    'a %s reader REJECTS a %s-produced payload sitting under its own derived seed',
    async (readerOs, producerOs) => {
      cachePlatformMock.mockReturnValue(readerOs);
      // Same key, DIFFERENT producer: the only variable is whose bytes came back, which
      // is exactly the axis the old `find` across CACHE_OS_VALUES could not see.
      get.mockResolvedValue({
        kind: 'hit',
        bytes: dogfoodBody(mirrorSeedHash(HASH, readerOs), producerOs),
      });

      await expect(run()).rejects.toThrow('cache HIT for');
    },
  );
});

describe('round-trip read-back still fails loud on every corruption class (09-08)', () => {
  // The rejection substrings are PINNED to 'cache HIT for' / 'MISS' deliberately: both
  // are present in the pre-fix AND post-fix messages, so these clauses stay green across
  // the RED -> GREEN transition. That continuity is the evidence they were PRESERVED
  // rather than traded away. Never assert the full message, and never a phrase unique to
  // one side of the fix.
  it('fails loud on garbage bytes', async () => {
    get.mockResolvedValue({
      kind: 'hit',
      bytes: Buffer.from('not a dogfood payload at all'),
    });

    await expect(run()).rejects.toThrow('cache HIT for');
  });

  it('fails loud on a truncated payload (partial upload)', async () => {
    // Buffer.equals compares LENGTH FIRST, so a prefix of the right payload matches no
    // candidate. This is the partial-upload class.
    get.mockResolvedValue({
      kind: 'hit',
      bytes: dogfoodBody(SEED, DEFAULT_READER_OS).subarray(0, 12),
    });

    await expect(run()).rejects.toThrow('cache HIT for');
  });

  it('fails loud on a payload for a DIFFERENT hash (cross-run asset-name collision)', async () => {
    // dogfood-body.ts folds the hash INTO the bytes, so a well-formed payload for a
    // neighbouring run's seed -- same leg, same encoding, one digit apart -- matches
    // nothing for THIS run's seed.
    get.mockResolvedValue({
      kind: 'hit',
      bytes: dogfoodBody(NEIGHBOUR_SEED, DEFAULT_READER_OS),
    });

    await expect(run()).rejects.toThrow('cache HIT for');
  });

  it('fails loud on a cache MISS', async () => {
    get.mockResolvedValue({ kind: 'miss' });

    await expect(run()).rejects.toThrow('MISS');
  });
});

/**
 * THE DEAD-PUBLISH-LEG DETECTOR, and the ONLY one there is.
 *
 * The seed derivation above answers "which KEY does this leg read?" -- it does NOT answer
 * "which leg UPLOADED the asset under that key?". Those are different questions and only
 * the `mirrored-by` label answers the second. Concretely: if the windows publish path is
 * DEAD but the ubuntu leg's enumeration happened to see the windows seed, ubuntu restores
 * it and uploads it under the windows leg's own asset name. The bytes are still
 * dogfoodBody(seed_win, 'windows') -- the SEED was written by windows -- so the byte
 * comparison above passes and the windows publish-verify leg goes GREEN on a dead
 * publisher. The label reads `mirrored-by: linux` and is the only field that differs.
 *
 * IT IS PROVEN OFFLINE, deliberately. `publish` / `publish-verify` are push-gated to
 * `main`, so no PR run samples them at any rate -- which is exactly why Phase 9's
 * regression was findable only live. Mutation-proving this group against a fake asset
 * listing is what makes the detection believable WITHOUT breaking the real publish path on
 * `main` to demonstrate it.
 *
 * THE OS AXES ARE BOTH TUPLE-DRIVEN. The reader's OS comes from CACHE_OS_VALUES and so
 * does the observed publisher, so the wrong-label matrix is every ordered pair with the
 * two different -- never "the OS this machine is not", which on the ubuntu-only `test` job
 * would sample the non-linux legs at rate ZERO.
 */
describe('round-trip read-back proves its OWN leg published the asset (OBS-05, U-01)', () => {
  it.each(CACHE_OS_VALUES)(
    'accepts a %s leg asset labelled as published by that same leg',
    async (os) => {
      cachePlatformMock.mockReturnValue(os);
      get.mockResolvedValue({
        kind: 'hit',
        bytes: dogfoodBody(mirrorSeedHash(HASH, os), os),
      });
      serveShard([[ownSeedRow(os, mirroredBy(os))]]);

      await expect(run()).resolves.toBeUndefined();
    },
  );

  it.each(CROSS_PRODUCER_PAIRS)(
    'a %s reader REJECTS its own asset when %s published it -- the dead-publish-leg case',
    async (readerOs, publisherOs) => {
      cachePlatformMock.mockReturnValue(readerOs);
      // The BYTES are this leg's own, because the SEED was. Only the publisher differs,
      // which is the whole point: this fixture passes every other assertion in the file.
      get.mockResolvedValue({
        kind: 'hit',
        bytes: dogfoodBody(mirrorSeedHash(HASH, readerOs), readerOs),
      });
      serveShard([[ownSeedRow(readerOs, mirroredBy(publisherOs))]]);

      const message = await run().catch((error: unknown) =>
        error instanceof Error ? error.message : String(error),
      );

      // BOTH values named, so an operator reading the failed job does not have to guess
      // which leg published it. Asserted as two separate containments rather than one
      // whole-message equality, which would break on any rewording.
      expect(message).toContain(mirroredBy(publisherOs));
      expect(message).toContain(mirroredBy(readerOs));
    },
  );

  it.each(CACHE_OS_VALUES)(
    'a %s reader REJECTS an EMPTY label -- a legacy asset must not read as a pass',
    async (os) => {
      // MEASURED: all 122 assets in the live cache-mirror-202607 shard carry an empty
      // label, because every one predates OBS-03. So "no label" is the COMMON case in the
      // shard and treating it as satisfied would make this guard vacuous on contact with
      // real data rather than on some hypothetical.
      cachePlatformMock.mockReturnValue(os);
      get.mockResolvedValue({
        kind: 'hit',
        bytes: dogfoodBody(mirrorSeedHash(HASH, os), os),
      });
      serveShard([[ownSeedRow(os, '')]]);

      await expect(run()).rejects.toThrow('publisher');
    },
  );

  it.each(CACHE_OS_VALUES)(
    'a %s reader resolves an asset that sits on a page AFTER the first',
    async (os) => {
      // THE LIVE SHARD HOLDS 122 ASSETS, so the seed asset can legitimately sit beyond
      // page one and a single-page read would redden on a CORRECT implementation. Page one
      // is filled to exactly the page size, because the pagination loop's exit condition is
      // a SHORT page -- a 99-row first page would stop the walk and this case would prove
      // nothing.
      cachePlatformMock.mockReturnValue(os);
      get.mockResolvedValue({
        kind: 'hit',
        bytes: dogfoodBody(mirrorSeedHash(HASH, os), os),
      });
      serveShard([
        decoyRows(ASSETS_PER_PAGE),
        [ownSeedRow(os, mirroredBy(os))],
      ]);

      await expect(run()).resolves.toBeUndefined();

      const pages = fetchMock.mock.calls
        .map(([input]) => new URL(String(input)))
        .filter((url) => url.searchParams.has('page'));

      expect(pages).toHaveLength(2);
      expect(pages.map((url) => url.searchParams.get('page'))).toEqual([
        '1',
        '2',
      ]);
      // The page SIZE is requested explicitly rather than left to the endpoint default of
      // 30: the inline release.assets snapshot this read deliberately avoids is
      // first-page-capped, and asking for a small page would reintroduce the same problem
      // one level down.
      expect(pages[0]?.searchParams.get('per_page')).toBe(
        String(ASSETS_PER_PAGE),
      );
    },
  );

  it.each(CACHE_OS_VALUES)(
    'a %s reader fails loud when the asset is absent after every page is exhausted',
    async (os) => {
      cachePlatformMock.mockReturnValue(os);
      get.mockResolvedValue({
        kind: 'hit',
        bytes: dogfoodBody(mirrorSeedHash(HASH, os), os),
      });
      // A full first page and an empty second: the walk must terminate on the short page
      // rather than paginate forever.
      serveShard([decoyRows(ASSETS_PER_PAGE), []]);

      await expect(run()).rejects.toThrow('no asset named');
    },
  );

  it.each(CACHE_OS_VALUES)(
    'a %s reader fails loud on a non-404 fault from the asset listing',
    async (os) => {
      cachePlatformMock.mockReturnValue(os);
      get.mockResolvedValue({
        kind: 'hit',
        bytes: dogfoodBody(mirrorSeedHash(HASH, os), os),
      });
      fetchMock.mockImplementation((input) =>
        Promise.resolve(
          new URL(String(input)).pathname.includes('/releases/tags/')
            ? jsonResponse({ id: RELEASE_ID })
            : jsonResponse({ message: 'rate limited' }, 403),
        ),
      );

      await expect(run()).rejects.toThrow('403');
    },
  );

  it('fails loud rather than skipping the check when no read credential resolves', async () => {
    // The consumer READER degrades a missing credential to a MISS by design. This bin must
    // NOT: a provenance assertion that silently no-ops when a token is absent is exactly
    // the vacuity it exists to close, and publish-verify would go green having checked
    // nothing.
    get.mockResolvedValue({
      kind: 'hit',
      bytes: dogfoodBody(SEED, DEFAULT_READER_OS),
    });
    resolveLocalReadTokenMock.mockResolvedValue(undefined);

    await expect(run()).rejects.toThrow('cannot read the publisher label');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('round-trip read-back input guard (09-08, OBS-05)', () => {
  it('fails loud when GITHUB_RUN_ID is absent', async () => {
    delete process.env.GITHUB_RUN_ID;

    await expect(run()).rejects.toThrow('GITHUB_RUN_ID');
  });

  it('fails loud, and DIFFERENTLY, when the derived seed is not a valid hash', async () => {
    // The run id must be guarded on its own now, and this pair of cases is why. An empty
    // GITHUB_RUN_ID derives `feed<index>` -- still valid lowercase hex, so the
    // derived-hash guard alone would silently look up a seed for the empty run. Two
    // inputs, two diagnoses.
    process.env.GITHUB_RUN_ID = 'not-hex';

    await expect(run()).rejects.toThrow('valid cache hash');
  });
});
