import * as core from '@actions/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Hash } from '../lib/cache-key.js';
import {
  CACHE_OS_VALUES,
  cachePlatform,
  releaseAssetName,
} from '../lib/release-asset-name.js';
import { shardTag } from '../lib/retention.js';
import { octokitFault } from '../test/octokit-fault.js';
import {
  publishMirror,
  RELEASE_ASSET_CAP,
  RELEASE_ASSET_MAX_BYTES,
  type CacheEntry,
  type GetResult,
  type PublishClient,
} from './publish-mirror.js';

// The engine restores bytes through createActionsCacheBackend().get on THIS OS leg
// (D-03). Mock the backend module directly so get is fully mock-driven: this lets a
// test control HIT/MISS and the restored byteLength deterministically -- crucial for
// the ~2 GiB boundary, which cannot be exercised by allocating a real 2 GiB buffer.
const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

vi.mock('../backend/actions-cache-backend.js', () => ({
  createActionsCacheBackend: vi.fn(() => ({
    get: getMock,
    put: vi.fn(),
  })),
}));

// @actions/core is mocked so the annotation calls are spy-assertable and never touch a
// real workflow-command stream (D-14: annotations only through @actions/core).
vi.mock('@actions/core', () => ({
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
  notice: vi.fn(),
  setFailed: vi.fn(),
}));

// PARTIAL mock -- only `cachePlatform` is replaced, everything else is spread from the
// real module (the idiom already shipped at action/index.spec.ts:84-88). Two exports
// depend on that: `CACHE_OS_VALUES` stays the REAL single-sourced tuple, which is what
// makes the it.each OS axis below honest rather than a restatement of the mock; and
// `releaseAssetName` stays real, so the name assertions keep comparing the engine's
// derivation against the one true helper.
//
// The mock's return value is set in beforeEach, not here: the file-level afterEach runs
// vi.resetAllMocks(), which discards a factory-supplied implementation after the first
// test.
vi.mock('../lib/release-asset-name.js', async (orig) => {
  const actual = await orig<typeof import('../lib/release-asset-name.js')>();

  return { ...actual, cachePlatform: vi.fn() };
});

const HASH = 'abc123' as Hash;
const SHARD_ID = 555;

/**
 * A PINNED clock for the cases that assert on the shard TAG. The tag is derived through
 * `shardTag(NOW)` rather than spelled as a literal, so the month-shard scheme lives in
 * exactly one place and this file cannot drift from it.
 */
const NOW = new Date('2026-08-15T00:00:00Z');

const cachePlatformMock = vi.mocked(cachePlatform);

/**
 * The publishing leg's OS for every case that does not drive its own OS axis, taken from
 * the REAL CACHE_OS_VALUES tuple rather than hand-authored (LINT-02 / Phase 9 gap G2).
 *
 * Index 0 and not a literal, for a measurable reason: the `test` job is single-leg
 * ubuntu, so an expectation of `'linux'` is indistinguishable from one derived from the
 * running machine and is sampled at a rate of ZERO there. Index 0 is `windows`, so on that
 * one job an engine reading the ambient platform instead of calling `cachePlatform()`
 * reddens even these baseline assertions. That is a bonus, NOT the guarantee: on a Windows
 * workstation the two coincide again. The clause that bites on EVERY machine is the
 * it.each group below, which mocks all three OSes and so must differ from the ambient one.
 */
const PUBLISHING_OS = CACHE_OS_VALUES[0];
const LABEL = `mirrored-by: ${PUBLISHING_OS}`;

/**
 * A restore HIT whose bytes carry only the byteLength the engine reads before the size
 * guard. uploadReleaseAsset is a spy, so a byteLength-only fake exercises every branch
 * without a real allocation (the ~2 GiB case would otherwise be untestable).
 */
function hit(byteLength = 8): GetResult {
  return { kind: 'hit', bytes: { byteLength } as unknown as Buffer };
}

const MISS: GetResult = { kind: 'miss' };

function client(overrides: Partial<PublishClient> = {}): PublishClient {
  return {
    listCacheEntries: vi.fn(
      async () => [{ key: `nx-cache-${HASH}` }] as CacheEntry[],
    ),
    getReleaseByTag: vi.fn(async () => ({ id: SHARD_ID })),
    createRelease: vi.fn(async () => ({ id: SHARD_ID })),
    listReleaseAssets: vi.fn(async () => [] as string[]),
    uploadReleaseAsset: vi.fn(async () => {}),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  getMock.mockResolvedValue(hit());
  // Restored per test because the afterEach below resets implementations, and because
  // mockClear alone would not undo an OS an earlier it.each case set.
  cachePlatformMock.mockReturnValue(PUBLISHING_OS);
});

afterEach(() => {
  vi.resetAllMocks();
});

describe('publishMirror server-produced-key filter (D-16/D-08/TRUST-08)', () => {
  it('mirrors ONLY prefix + valid-hex keys, stripping the prefix to the hash, and never restores a foreign or non-hex key', async () => {
    const fake = client({
      listCacheEntries: vi.fn(async () => [
        { key: 'nx-cache-aa11' },
        { key: 'unrelated-key' },
        { key: 'nx-cache-zzz' },
        { key: 'nx-cache-bb22' },
      ]),
    });

    const result = await publishMirror(fake);

    expect(result.mirrored).toBe(2);
    // The foreign key AND the nx-cache-<non-hex> key are filtered BEFORE restore, so get
    // is called only with the two valid-hex hashes. This proves the hardened
    // isServerProducedKey rejects a garbage suffix -- the D-08 improvement over the old
    // startsWith-only behavior, which would have restored nx-cache-zzz.
    expect(getMock.mock.calls.map((call) => call[0])).toEqual([
      'aa11' as Hash,
      'bb22' as Hash,
    ]);
    const uploadedNames = vi
      .mocked(fake.uploadReleaseAsset)
      .mock.calls.map((call) => call[1]);
    expect(uploadedNames).toEqual([
      releaseAssetName('aa11' as Hash),
      releaseAssetName('bb22' as Hash),
    ]);
  });
});

describe('publishMirror happy-path mirror (TEST-03)', () => {
  it('uploads a restored entry to the current-month shard and counts it mirrored', async () => {
    const fake = client();

    const result = await publishMirror(fake);

    expect(result).toEqual({
      scanned: 1,
      mirrored: 1,
      skipped: 0,
      readMisses: 0,
      failed: 0,
    });
    expect(fake.uploadReleaseAsset).toHaveBeenCalledOnce();
    expect(fake.uploadReleaseAsset).toHaveBeenCalledWith(
      SHARD_ID,
      releaseAssetName(HASH),
      expect.anything(),
      LABEL,
    );
  });

  it('derives the uploaded asset name ONLY through releaseAssetName(hash) (CORR-02, non-vacuous)', async () => {
    const fake = client();

    await publishMirror(fake);

    const name = vi.mocked(fake.uploadReleaseAsset).mock.calls[0][1];
    // Non-vacuous: the name must be the single-source form, never the bare hash --
    // this fails the moment the publisher inlines its own template and drifts.
    expect(name).toBe(releaseAssetName(HASH));
    expect(name).not.toBe(HASH);
    // The third clause was RE-AUTHORED by CORR-02, not deleted. It used to assert the
    // name STARTS with `<hash>-`, which pinned the deleted OS-suffixed shape and was
    // the only assertion here that could tell "derived through the helper" apart from
    // "happens to equal whatever the helper returns today". Its replacement pins the
    // surviving structural fact: the hash is the name's SUFFIX now, under a prefix, so
    // this still fails if the publisher were to emit the bare hash, a prefix-only
    // string, or the hash under some other decoration.
    expect(name.endsWith(HASH)).toBe(true);
    expect(name.length).toBeGreaterThan(HASH.length);
  });
});

describe('publishMirror mirrored-by label (OBS-03, D-09/D-10/D-11)', () => {
  // The OS axis over the REAL CACHE_OS_VALUES tuple with `cachePlatform` MOCKED to each
  // member -- UNFILTERED, unlike action/index.spec.ts's reader cases, because every OS is
  // a legitimate publishing leg here. This is the clause that is machine-INDEPENDENT: the
  // `test` job runs one ubuntu leg, so a hand-authored `'linux'` expectation would be
  // sampled at a rate of ZERO on the only runner that executes it (Phase 9 gap G2). Adding
  // an OS discriminator to the tuple adds a case here rather than leaving one unsampled.
  it.each(CACHE_OS_VALUES)(
    'stamps every upload with the %s publishing leg as part of the ONE upload argument array',
    async (os) => {
      cachePlatformMock.mockReturnValue(os);
      const fake = client();

      await publishMirror(fake);

      // D-11: deep equality over the WHOLE recorded argument array, never a separate
      // expect.stringContaining for the label. Phase 9 measured toEqual and
      // toStrictEqual identical on all eight argument shapes at vitest 4.1.10, so the
      // load-bearing choice is asserting the whole array -- a label checked in isolation
      // would stay green against an argument that landed in the wrong position.
      expect(vi.mocked(fake.uploadReleaseAsset).mock.calls).toEqual([
        [
          SHARD_ID,
          releaseAssetName(HASH),
          expect.anything(),
          `mirrored-by: ${os}`,
        ],
      ]);
    },
  );

  it('calls cachePlatform exactly ONCE per run (the hoist), stamping both uploads with the same label', async () => {
    // MULTI-hash on purpose: this is the only case that distinguishes the hoist above the
    // loop from a call per iteration, and a single-hash fixture cannot -- one hash calls
    // cachePlatform once either way.
    const fake = client({
      listCacheEntries: vi.fn(async () => [
        { key: 'nx-cache-aa11' },
        { key: 'nx-cache-bb22' },
      ]),
    });

    await publishMirror(fake);

    expect(cachePlatformMock).toHaveBeenCalledOnce();
    // The upload COUNT is pinned as well, and that clause is load-bearing rather than
    // decorative: called-once alone is satisfied by a run that uploaded nothing at all.
    const calls = vi.mocked(fake.uploadReleaseAsset).mock.calls;
    expect(calls).toHaveLength(2);
    expect(calls.map((call) => call[3])).toEqual([LABEL, LABEL]);
  });
});

describe('publishMirror restore MISS skip (D-03)', () => {
  it('skips a foreign-OS/evicted entry whose restore MISSes, touching no Release I/O', async () => {
    getMock.mockResolvedValue(MISS);
    const fake = client();

    const result = await publishMirror(fake);

    expect(result).toEqual({
      scanned: 1,
      mirrored: 0,
      skipped: 1,
      readMisses: 1,
      failed: 0,
    });
    expect(fake.uploadReleaseAsset).not.toHaveBeenCalled();
    // Lazy shard ensure: an all-MISS leg never creates an empty shard release.
    expect(fake.getReleaseByTag).not.toHaveBeenCalled();
    expect(fake.createRelease).not.toHaveBeenCalled();
  });
});

describe('publishMirror first-write-wins (TRUST-07, D-05)', () => {
  it('skips (no upload) when the asset name is already present in the shard (pre-list)', async () => {
    const fake = client({
      listReleaseAssets: vi.fn(async () => [releaseAssetName(HASH)]),
    });

    const result = await publishMirror(fake);

    expect(result).toEqual({
      scanned: 1,
      mirrored: 0,
      skipped: 1,
      readMisses: 0,
      failed: 0,
    });
    expect(fake.uploadReleaseAsset).not.toHaveBeenCalled();
  });

  it('treats a 422 already_exists upload race as a benign skip, never a fault', async () => {
    const fake = client({
      uploadReleaseAsset: vi.fn(async () => {
        throw octokitFault(422, { errors: [{ code: 'already_exists' }] });
      }),
    });

    const result = await publishMirror(fake);

    expect(result).toEqual({
      scanned: 1,
      mirrored: 0,
      skipped: 1,
      readMisses: 0,
      failed: 0,
    });
    // A benign already-exists is NOT a fault annotation.
    expect(core.warning).not.toHaveBeenCalled();
  });

  it('counts a 422 that is NOT already_exists as a real fault, never a benign skip', async () => {
    // THE NEGATIVE TWIN of the case above, and the one run 30767511870 needed. That run's
    // month shard was created already-PUBLISHED under GitHub's immutable-releases setting,
    // so every upload into it was rejected 422 -- permanently, and for a reason that is not
    // a duplicate name (the shard held ZERO assets and the seed name is unique per run).
    // Discriminating on `statusOf(error) === 422` ALONE counted 32 of 32 fatal rejections as
    // `skipped`, left `failed` at 0, never reached the aggregate setFailed, and reported a
    // mirror that wrote nothing as a GREEN publish leg -- the failure only surfaced one job
    // later, in publish-verify, pointing at the wrong subsystem.
    //
    // `already_exists` is the ONLY 422 GitHub documents for this endpoint ("Response if you
    // upload an asset with the same filename as another uploaded asset"), so it is the only
    // one the first-write-wins no-op (D-05) may claim. Every other 422 is a fault.
    const fake = client({
      uploadReleaseAsset: vi.fn(async () => {
        throw octokitFault(422, {
          message: 'Validation Failed',
          errors: [
            {
              resource: 'ReleaseAsset',
              code: 'immutable',
              message: 'Release asset is immutable',
            },
          ],
        });
      }),
    });

    const result = await publishMirror(fake);

    expect(result).toEqual({
      scanned: 1,
      mirrored: 0,
      skipped: 0,
      readMisses: 0,
      failed: 1,
    });
    // Annotated per item, and loud in aggregate -- the two halves that were both missing.
    expect(core.warning).toHaveBeenCalledOnce();
    expect(core.setFailed).toHaveBeenCalledOnce();
    // The upload site's observability gap is the CREATE site's gap one level down, so it
    // closes here in the same commit: a `code: custom` policy rejection has to be
    // diagnosable from the job log alone.
    //
    // `code immutable` and not the bare token: the MESSAGE also contains the word
    // "immutable", so a bare `toContain('immutable')` would pass with the code slot empty
    // -- it would assert the message twice rather than the code once.
    const warned = vi.mocked(core.warning).mock.calls[0][0];
    expect(warned).toContain('code immutable');
    expect(warned).toContain('Release asset is immutable');
  });
});

describe('publishMirror fault discrimination (ROBUST-01, TEST-03)', () => {
  it('creates the shard when getReleaseByTag 404s, then uploads', async () => {
    const fake = client({
      getReleaseByTag: vi.fn(async () => {
        throw octokitFault(404);
      }),
      createRelease: vi.fn(async () => ({ id: SHARD_ID })),
    });

    const result = await publishMirror(fake);

    expect(fake.createRelease).toHaveBeenCalledOnce();
    expect(result.mirrored).toBe(1);
    expect(fake.uploadReleaseAsset).toHaveBeenCalledWith(
      SHARD_ID,
      releaseAssetName(HASH),
      expect.anything(),
      LABEL,
    );
  });

  it('re-reads the shard by tag when the createRelease 422 body EXPLICITLY says already_exists', async () => {
    // THE POSITIVE CONTROL, not the RED: a genuine create race still takes the re-read
    // path. Its fault now carries an EXPLICIT `already_exists` body, because the status
    // ALONE no longer earns that path -- see the two rejection cases below.
    const getReleaseByTag = vi
      .fn<PublishClient['getReleaseByTag']>()
      .mockRejectedValueOnce(octokitFault(404))
      .mockResolvedValueOnce({ id: SHARD_ID });
    const fake = client({
      getReleaseByTag,
      createRelease: vi.fn(async () => {
        throw octokitFault(422, { errors: [{ code: 'already_exists' }] });
      }),
    });

    const result = await publishMirror(fake);

    expect(getReleaseByTag).toHaveBeenCalledTimes(2);
    expect(result.mirrored).toBe(1);
    expect(fake.uploadReleaseAsset).toHaveBeenCalledWith(
      SHARD_ID,
      releaseAssetName(HASH),
      expect.anything(),
      LABEL,
    );
  });

  it('REJECTS a createRelease 422 whose body is UNREADABLE, never re-GETting on a guess', async () => {
    // Fail CLOSED. An absent body carries no `already_exists`, so it is not a race, and
    // reading it as one is the whole defect: run 30773689490 took the race path on both
    // publish legs and afterwards NOTHING existed for a race to have created -- no
    // release, no tag ref, no draft. The re-GET then 404'd and killed the job with a bare
    // Not Found, naming nothing.
    const getReleaseByTag = vi
      .fn<PublishClient['getReleaseByTag']>()
      .mockRejectedValueOnce(octokitFault(404))
      .mockResolvedValueOnce({ id: SHARD_ID });
    const fake = client({
      getReleaseByTag,
      createRelease: vi.fn(async () => {
        throw octokitFault(422);
      }),
    });

    await expect(publishMirror(fake)).rejects.toThrow();

    // The INITIAL lookup only. A second call would mean the re-GET ran, which is exactly
    // the guess this case forbids -- and the mock is primed to RESOLVE on that second
    // call, so a re-GET would turn the whole run green rather than merely red elsewhere.
    expect(getReleaseByTag).toHaveBeenCalledOnce();
    expect(fake.uploadReleaseAsset).not.toHaveBeenCalled();
  });

  it('REJECTS a POLICY 422 and names the tag, the code AND GitHub own message in one core.error line (B2)', async () => {
    // B2 in one clause. GitHub's `errors[].code` enum is GLOBAL and six-membered, and a
    // policy rejection (ruleset, immutability, org setting) arrives as `custom` with the
    // entire diagnostic in `message`. A code-only reader prints "code custom" and the next
    // window is spent for nothing, so the MESSAGE is the load-bearing half here.
    const fake = client({
      getReleaseByTag: vi.fn(async () => {
        throw octokitFault(404);
      }),
      createRelease: vi.fn(async () => {
        throw octokitFault(422, {
          message: 'Validation Failed',
          errors: [
            {
              resource: 'Release',
              code: 'custom',
              field: 'tag_name',
              message: 'Tag name cannot be reused',
            },
          ],
        });
      }),
    });

    await expect(publishMirror(fake, { now: NOW })).rejects.toThrow();

    // Read the ONE recorded call and assert the three substrings against it. Asserting
    // three separate `toHaveBeenCalledWith(stringContaining(...))` would be satisfied by
    // three DIFFERENT calls each carrying one substring; the whole point is that a single
    // log line is readable on its own.
    expect(core.error).toHaveBeenCalledOnce();
    const logged = vi.mocked(core.error).mock.calls[0][0];
    expect(logged).toContain(shardTag(NOW));
    expect(logged).toContain('custom');
    expect(logged).toContain('Tag name cannot be reused');
  });

  it('names the tag when the re-read after a genuine already_exists itself 404s', async () => {
    // The re-GET is read-after-write against an endpoint that can 404 transiently and
    // that does not resolve DRAFT releases at all. Unguarded, it propagates octokit's
    // bare "Not Found", which names neither the tag nor the operation -- and that is the
    // message run 30773689490 died on.
    const fake = client({
      getReleaseByTag: vi.fn(async () => {
        throw octokitFault(404);
      }),
      createRelease: vi.fn(async () => {
        throw octokitFault(422, { errors: [{ code: 'already_exists' }] });
      }),
    });

    await expect(publishMirror(fake, { now: NOW })).rejects.toThrow(
      `re-read of shard release ${shardTag(NOW)}`,
    );
  });

  it('surfaces a real 5xx on the shard lookup as a whole-run throw (never absence)', async () => {
    const fake = client({
      getReleaseByTag: vi.fn(async () => {
        throw octokitFault(500);
      }),
    });

    await expect(publishMirror(fake)).rejects.toThrow();
    expect(fake.uploadReleaseAsset).not.toHaveBeenCalled();
  });

  it('isolates and counts a per-item upload 5xx, annotates it, and mirrors the rest (D-13)', async () => {
    const fake = client({
      listCacheEntries: vi.fn(async () => [
        { key: 'nx-cache-aa11' },
        { key: 'nx-cache-bb22' },
      ]),
      uploadReleaseAsset: vi
        .fn<PublishClient['uploadReleaseAsset']>()
        .mockRejectedValueOnce(octokitFault(500))
        .mockResolvedValueOnce(undefined),
    });

    const result = await publishMirror(fake);

    // A real per-item fault is SURFACED as a failure (not a skip) and does not abort the batch.
    expect(result).toEqual({
      scanned: 2,
      mirrored: 1,
      skipped: 0,
      readMisses: 0,
      failed: 1,
    });
    expect(core.warning).toHaveBeenCalledOnce();
  });
});

describe('publishMirror aggregate fail-loud (OBS-01, D-15)', () => {
  it('calls core.setFailed when any per-item upload fails (failed > 0)', async () => {
    // A systemic upload regression: every entry faults, so without the aggregate
    // check the job would exit 0 and report a fully-broken mirror as CI green.
    const fake = client({
      uploadReleaseAsset: vi.fn(async () => {
        throw octokitFault(500);
      }),
    });

    const result = await publishMirror(fake);

    expect(result.failed).toBe(1);
    expect(core.setFailed).toHaveBeenCalledOnce();
    // The message carries the count only, never a token or a raw command string.
    expect(vi.mocked(core.setFailed).mock.calls[0][0]).toContain('1');
  });

  it('does NOT call core.setFailed on a clean whole-run success (failed == 0)', async () => {
    const fake = client();

    const result = await publishMirror(fake);

    expect(result.failed).toBe(0);
    expect(core.setFailed).not.toHaveBeenCalled();
  });
});

describe('publishMirror enumeration failure (whole-run, OBS-01/D-13)', () => {
  it('propagates a listCacheEntries fault as a whole-run throw', async () => {
    const fake = client({
      listCacheEntries: vi.fn(async () => {
        throw octokitFault(500);
      }),
    });

    await expect(publishMirror(fake)).rejects.toThrow();
    expect(getMock).not.toHaveBeenCalled();
    expect(fake.uploadReleaseAsset).not.toHaveBeenCalled();
  });
});

describe('publishMirror 1000-asset cap skip-and-warn (ROBUST-05, D-11)', () => {
  it.each([
    [RELEASE_ASSET_CAP - 1, 'mirror'],
    [RELEASE_ASSET_CAP, 'skip'],
    [RELEASE_ASSET_CAP + 1, 'skip'],
  ])(
    'with %i existing assets it %ss the new entry (no hard-fail either way)',
    async (existingCount, outcome) => {
      const existing = Array.from(
        { length: existingCount },
        (_unused, index) => `filler-asset-${index}`,
      );
      const fake = client({
        listReleaseAssets: vi.fn(async () => existing),
      });

      const result = await publishMirror(fake);

      if (outcome === 'mirror') {
        expect(result).toEqual({
          scanned: 1,
          mirrored: 1,
          skipped: 0,
          readMisses: 0,
          failed: 0,
        });
        expect(fake.uploadReleaseAsset).toHaveBeenCalledOnce();
        expect(core.warning).not.toHaveBeenCalled();
      } else {
        expect(result).toEqual({
          scanned: 1,
          mirrored: 0,
          skipped: 1,
          readMisses: 0,
          failed: 0,
        });
        expect(fake.uploadReleaseAsset).not.toHaveBeenCalled();
        expect(core.warning).toHaveBeenCalledOnce();
      }
    },
  );
});

describe('publishMirror ~2 GiB boundary fail-loud (ROBUST-02, D-12)', () => {
  it('uploads an entry at exactly the ~2 GiB ceiling (cap) -- the guard uses strict > to match the server body cap so an accepted entry can always be mirrored', async () => {
    getMock.mockResolvedValue(hit(RELEASE_ASSET_MAX_BYTES));
    const fake = client();

    const result = await publishMirror(fake);

    expect(result.mirrored).toBe(1);
    expect(fake.uploadReleaseAsset).toHaveBeenCalledOnce();
  });

  it('counts an oversized entry as a failure and continues the batch, never uploading it (F13)', async () => {
    const fake = client({
      listCacheEntries: vi.fn(async () => [
        { key: 'nx-cache-aa11' },
        { key: 'nx-cache-bb22' },
      ]),
    });
    // First entry oversized, second a normal entry: the loop must NOT abort on the
    // oversized one -- the later valid entry still mirrors, and the accumulated counts
    // survive (the old throw discarded them and bypassed the aggregate check).
    getMock
      .mockResolvedValueOnce(hit(RELEASE_ASSET_MAX_BYTES + 1))
      .mockResolvedValueOnce(hit());

    const result = await publishMirror(fake);

    expect(result.mirrored).toBe(1);
    expect(result.failed).toBe(1);
    // The oversized entry is never uploaded; only the later valid one is.
    expect(fake.uploadReleaseAsset).toHaveBeenCalledOnce();
    expect(fake.uploadReleaseAsset).toHaveBeenCalledWith(
      SHARD_ID,
      releaseAssetName('bb22' as Hash),
      expect.anything(),
      LABEL,
    );
    expect(core.error).toHaveBeenCalledOnce();
    // Still loud + red: the aggregate failed>0 check fires exactly once at the end.
    expect(core.setFailed).toHaveBeenCalledOnce();
  });
});

describe('publishMirror all-restore-MISS degradation signal', () => {
  it('warns (does NOT fail) when every enumerated entry restores as a MISS and nothing mirrored', async () => {
    // Every server-produced entry MISSes its same-OS restore: either the legitimate
    // cross-OS case or an Actions-cache read-scope regression. Must be visible, not
    // a silent green run -- but not a hard fail (that would break real cross-OS runs).
    getMock.mockResolvedValue(MISS);
    const fake = client();

    const result = await publishMirror(fake);

    expect(result).toEqual({
      scanned: 1,
      mirrored: 0,
      skipped: 1,
      readMisses: 1,
      failed: 0,
    });
    expect(core.warning).toHaveBeenCalledWith(
      expect.stringContaining('restored as a MISS'),
    );
    expect(core.setFailed).not.toHaveBeenCalled();
  });

  it('does NOT warn about all-MISS when at least one entry mirrors', async () => {
    getMock.mockResolvedValue(hit());
    const fake = client();

    await publishMirror(fake);

    expect(core.warning).not.toHaveBeenCalledWith(
      expect.stringContaining('restored as a MISS'),
    );
  });

  it('names the cache-VERSION axis, both candidate causes, and the two-push gate (OBS-04, D-27, D-28b, C-10)', async () => {
    getMock.mockResolvedValue(MISS);
    const fake = client();

    await publishMirror(fake);

    // Asserted on CONTENT, not on the fact that a warning was emitted: the three
    // `restored as a MISS` assertions in this describe already prove the branch is
    // REACHED, and they would keep passing against a message that had silently lost
    // everything a reader actually needs.
    //
    // The axis, in the SAME WORDS as 09-ROTATION-SIGNAL.md's "The axis, and why naming
    // it matters" section. Two copies of one diagnosis: if they drift, a reader who
    // finds one and not the other gets a different answer.
    expect(core.warning).toHaveBeenCalledWith(
      expect.stringContaining('@actions/cache cache VERSION'),
    );
    // ... explicitly distinguished from the two mechanisms that produce a look-alike
    // all-MISS (rotation windows 1 and 3 of this milestone -- D-30 forbids a tripwire
    // that fires on them, so the message must let a reader tell them apart).
    expect(core.warning).toHaveBeenCalledWith(
      expect.stringContaining('Nx TASK hash'),
    );
    expect(core.warning).toHaveBeenCalledWith(
      expect.stringContaining('Release ASSET NAME'),
    );
    // Cause 1 (D-27): the archive path literal or the cross-OS flag moved.
    expect(core.warning).toHaveBeenCalledWith(
      expect.stringContaining('cache-version rotation in this commit range'),
    );
    // Cause 2 (D-27), the one that survives from the pre-Phase-9 message.
    expect(core.warning).toHaveBeenCalledWith(
      expect.stringContaining("runtime token's Actions-cache read scope"),
    );
    // The gate (D-28b): a raw push counter would fire on correct work, so the message
    // carries the reading instruction instead of persisting cross-push state.
    expect(core.warning).toHaveBeenCalledWith(
      expect.stringContaining('Two consecutive all-miss pushes'),
    );
    // Still a warning, never a failure -- three legitimate rotation windows exist.
    expect(core.setFailed).not.toHaveBeenCalled();
  });

  it('no longer offers the storage-partitioning explanation this milestone made false (OBS-04, D-27)', async () => {
    getMock.mockResolvedValue(MISS);
    const fake = client();

    await publishMirror(fake);

    // The single-character character class below is load-bearing, not style. This
    // assertion claims a phrase is ABSENT from the message, so spelling that phrase
    // here would plant it in the very file that proves it is gone -- and a repo-wide
    // search could then no longer tell this guard apart from a regression. The bracket
    // splits the token for a reader's search without changing what the regex matches.
    // Same technique, same reason, as the scan idiom in lint-scope-drift.spec.ts.
    //
    // ASSERTED OVER EVERY RECORDED ARGUMENT, not as
    // `toHaveBeenCalledWith(expect.not.stringMatching(...))`. That form passes when ANY
    // ONE call fails to match, so it states "some warning lacks the phrase" rather than
    // "no warning carries it" -- non-vacuous today only because this path happens to emit
    // exactly one warning, which is a property of the fixture and not of the claim. A
    // second warning added to this path (a per-entry annotation, say) would silently
    // vacate the retraction while this test stayed green. The call count is pinned too, so
    // the two clauses cover the same fact from both sides.
    expect(core.warning).toHaveBeenCalledOnce();
    expect(vi.mocked(core.warning).mock.calls.flat()).not.toContainEqual(
      expect.stringMatching(/differen[t] OS/),
    );
  });
});

describe('publishMirror duplicate-row dedup', () => {
  it('restores a hash enumerated twice (two archive versions of one key) exactly once', async () => {
    const fake = client({
      listCacheEntries: vi.fn(async () => [
        { key: 'nx-cache-aa11' },
        { key: 'nx-cache-aa11' },
      ]),
    });

    const result = await publishMirror(fake);

    // One round-trip, not two: the restore outcome is a pure function of the hash, so the
    // second row could only ever repeat the first result.
    expect(getMock).toHaveBeenCalledOnce();
    expect(result.scanned).toBe(1);
    // The duplicate no longer inflates `skipped` via the already-present branch.
    expect(result).toEqual({
      scanned: 1,
      mirrored: 1,
      skipped: 0,
      readMisses: 0,
      failed: 0,
    });
    expect(fake.uploadReleaseAsset).toHaveBeenCalledOnce();
  });

  it('still warns on a genuine total regression when the enumeration contains duplicates', async () => {
    // Guard, not a RED: this passes BEFORE the dedup too, and that is the point. The gate
    // predicate is multiplicity-invariant (2 === 2 before, 1 === 1 after), so it fires on
    // a real all-MISS run either way. The test exists so a future reader cannot break that
    // equivalence silently.
    getMock.mockResolvedValue(MISS);
    const fake = client({
      listCacheEntries: vi.fn(async () => [
        { key: 'nx-cache-aa11' },
        { key: 'nx-cache-aa11' },
      ]),
    });

    const result = await publishMirror(fake);

    expect(result.readMisses).toBe(result.scanned);
    expect(core.warning).toHaveBeenCalledWith(
      expect.stringContaining('restored as a MISS'),
    );
    expect(core.setFailed).not.toHaveBeenCalled();
  });
});
