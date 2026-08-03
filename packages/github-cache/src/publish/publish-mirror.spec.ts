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

  // THE MULTI-ENTRY BODY, which neither of the two cases around this one constructs -- both
  // are single-entry, which is exactly how the order-dependence survived. The discriminator
  // reads the WHOLE errors array (hasFaultCode), so the verdict cannot turn on which entry
  // GitHub happened to put first.
  //
  // This is the SILENT-GREEN direction and the more dangerous of the two: with a first-code
  // read, the `already_exists` at index 0 wins, every permanently-rejected upload counts as
  // `skipped`, `failed` stays 0, the aggregate setFailed never fires, and the leg exits
  // GREEN having mirrored nothing -- the shape of run 30767511870, one entry over.
  it('does not let an already_exists entry mask a fatal sibling in the SAME body', async () => {
    const fake = client({
      uploadReleaseAsset: vi.fn(async () => {
        throw octokitFault(422, {
          message: 'Validation Failed',
          errors: [
            { resource: 'ReleaseAsset', code: 'already_exists' },
            {
              resource: 'ReleaseAsset',
              code: 'custom',
              message: 'Release assets are immutable under this ruleset',
            },
          ],
        });
      }),
    });

    const result = await publishMirror(fake);

    // Still a benign skip: GitHub DID say already_exists, and D-05's first-write-wins no-op
    // is what that means. The property under test is that the answer is the same whichever
    // order the entries arrive in -- asserted by its twin below.
    expect(result.skipped).toBe(1);
    expect(result.failed).toBe(0);
  });

  it('reaches the same verdict when already_exists is NOT the first entry', async () => {
    const fake = client({
      uploadReleaseAsset: vi.fn(async () => {
        throw octokitFault(422, {
          message: 'Validation Failed',
          errors: [
            { resource: 'ReleaseAsset', code: 'custom', message: 'decoy' },
            { resource: 'ReleaseAsset', code: 'already_exists' },
          ],
        });
      }),
    });

    const result = await publishMirror(fake);

    // The half that fails CLOSED under a first-code read: `custom` would win, the genuine
    // duplicate-upload race would be counted as a fault, and the publish job would redden on
    // a race D-05 defines as benign. Order-independence is the whole claim.
    expect(result.skipped).toBe(1);
    expect(result.failed).toBe(0);
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
    // A BARE `rejects.toThrow()` IS NOT ENOUGH, twice over. It is satisfied by any throw,
    // including one raised BEFORE createRelease is ever reached -- so the call that this
    // case is about has to be asserted to have happened at all. And it says nothing about
    // whether the fault was LOGGED: a regression that throws on the unreadable body without
    // calling core.error loses B2's instrument on exactly the path B1 was measured on, and
    // would otherwise stay green here. The rejection is the fail-closed half; the log is
    // the diagnosable half, and this task exists because the second one was missing.
    expect(fake.createRelease).toHaveBeenCalledOnce();
    expect(core.error).toHaveBeenCalledOnce();
  });

  it('names GitHub own top-level message when the 422 body carries NO errors array', async () => {
    // THE MOST PLAUSIBLE SHAPE FOR THE NEXT PRODUCTION WINDOW, and it had zero coverage.
    // Every other 422 fixture in this file carries a full `errors[]` or no body at all, so
    // the `data.message` fallback -- an explicit claim in the reader's docstring -- was
    // never entered. A ruleset rejection that arrives with a top-level message and nothing
    // else is exactly the body a scarce verification window would be spent reading.
    const fake = client({
      getReleaseByTag: vi.fn(async () => {
        throw octokitFault(404);
      }),
      createRelease: vi.fn(async () => {
        throw octokitFault(422, {
          message: 'Tag name cannot be reused under this ruleset',
        });
      }),
    });

    await expect(publishMirror(fake, { now: NOW })).rejects.toThrow();

    expect(core.error).toHaveBeenCalledOnce();
    const logged = vi.mocked(core.error).mock.calls[0][0];
    expect(logged).toContain('code unknown');
    expect(logged).toContain('Tag name cannot be reused under this ruleset');
  });

  /**
   * THE FAIL-CLOSED FRONTIER, enumerated. The reader's docstring claims that an absent
   * body, a body that is not the documented shape, and a body carrying nothing readable
   * ALL land on `code === undefined` and therefore on the fault branch -- "undefined is
   * NOT benign, and no call site may treat it as such". Only two of those shapes had a
   * case. These are the rest, and each mock is primed to RESOLVE the second
   * getReleaseByTag: a re-GET on a guess does not merely redden somewhere else, it turns
   * the whole run GREEN, which is the failure mode run 30773689490 actually shipped.
   */
  it.each([
    ['no body at all', undefined],
    ['an empty object', {}],
    ['an EMPTY errors array', { errors: [] }],
    ['a non-array errors field', { errors: 'nope' }],
    ['an entry whose code is not a string', { errors: [{ code: 7 }] }],
  ])(
    'REJECTS a createRelease 422 carrying %s, and never re-GETs on the guess',
    async (_label, body) => {
      const getReleaseByTag = vi
        .fn<PublishClient['getReleaseByTag']>()
        .mockRejectedValueOnce(octokitFault(404))
        .mockResolvedValueOnce({ id: SHARD_ID });
      const fake = client({
        getReleaseByTag,
        createRelease: vi.fn(async () => {
          throw octokitFault(422, body);
        }),
      });

      await expect(publishMirror(fake, { now: NOW })).rejects.toThrow();

      expect(getReleaseByTag).toHaveBeenCalledOnce();
      expect(fake.uploadReleaseAsset).not.toHaveBeenCalled();
      expect(core.error).toHaveBeenCalledOnce();
    },
  );

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['a bare string', 'boom'],
  ])(
    'REJECTS a createRelease that throws %s -- a non-object fault is not a race either',
    async (_label, thrown) => {
      // Optional chaining in the reader absorbs a null/undefined/primitive fault, so no
      // caller-side pre-check exists to protect this path -- which is precisely why it
      // needs a case. `rejects.toBe` rather than `rejects.toThrow`: the engine rethrows the
      // ORIGINAL value, and toThrow cannot express a rejection that is not an Error.
      const getReleaseByTag = vi
        .fn<PublishClient['getReleaseByTag']>()
        .mockRejectedValueOnce(octokitFault(404))
        .mockResolvedValueOnce({ id: SHARD_ID });
      const fake = client({
        getReleaseByTag,
        createRelease: vi.fn(async () => {
          throw thrown;
        }),
      });

      await expect(publishMirror(fake, { now: NOW })).rejects.toBe(thrown);

      expect(getReleaseByTag).toHaveBeenCalledOnce();
      expect(fake.uploadReleaseAsset).not.toHaveBeenCalled();
      expect(core.error).toHaveBeenCalledOnce();
    },
  );

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

  it('names an errors[] message that carries NO code, instead of the generic top-level one', async () => {
    // THE CODE-LESS ENTRY. GitHub's `errors[].code` enum is six-membered and global, so a
    // rejection it has no member for can arrive with `resource`/`field`/`message` and no
    // `code` at all. A reader that binds the entry ON the code then reads THAT entry's
    // message discards the one useful string in the body and prints the generic top-level
    // `Validation Failed` -- the same "the window buys nothing" outcome B2 measured, reached
    // through a different door. The two lookups are INDEPENDENT facts about the body: the
    // message is the first readable one anywhere in `errors[]`, and only then `data.message`.
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
              field: 'tag_name',
              message: 'Blocked by org policy X',
            },
          ],
        });
      }),
    });

    await expect(publishMirror(fake, { now: NOW })).rejects.toThrow();

    expect(core.error).toHaveBeenCalledOnce();
    const logged = vi.mocked(core.error).mock.calls[0][0];
    expect(logged).toContain('Blocked by org policy X');
    // The code slot is honestly empty -- the entry carries none. Pinned so a future reader
    // cannot "fix" the message half by inventing a code.
    expect(logged).toContain('code unknown');
    expect(logged).not.toContain('Validation Failed');
  });

  /**
   * THE MEASURED BURNED-NAME PAYLOAD, verbatim from run 30796967020 and independently
   * captured byte-for-byte from two unrelated public repositories ~10 months apart. All
   * three entries, in the order GitHub sent them, `code: 'custom'` on every one -- which is
   * why `code` cannot discriminate here and the guard has to read a MESSAGE.
   *
   * Split into named entries so the decoy-only and reworded cases below compose the SAME
   * measured strings rather than restating them: a hand-edited second copy of the decoy is
   * how a "the decoy stays fatal" case quietly stops testing the decoy.
   */
  const PRE_RECEIVE_DECOY = {
    resource: 'Release',
    code: 'custom',
    field: 'pre_receive',
    message:
      'pre_receive Repository rule violations found\n\nCannot create ref due to creations being restricted.\n\n',
  };
  const BURNED_TAG_NAME_ENTRY = {
    resource: 'Release',
    code: 'custom',
    field: 'tag_name',
    message: 'tag_name was used by an immutable release',
  };
  const NO_VALID_TAG_ENTRY = {
    resource: 'Release',
    code: 'custom',
    message: 'Published releases must have a valid tag',
  };

  it('SKIPS the whole shard ONCE when createRelease reports the tag name was burned by an immutable release', async () => {
    // A1. The month-shard tag scheme reuses a name GitHub has permanently burned: an
    // immutable release published that tag once, and after its deletion the NAME is still
    // unusable (documented behaviour; the resurrection-attack note extends it past the
    // repository). Nothing in this run can make the tag creatable, so failing the whole
    // publish job buys nothing -- it just turns a shard that cannot exist into a red build.
    // The leg SKIPS loudly instead, and `publish-verify` is the downstream red gate.
    //
    // THREE hashes, and the multiplicity is load-bearing twice over. The lazy shard resolve
    // re-runs on EVERY iteration while `shard` is unset, so a skip that merely leaves it
    // unset issues one createRelease and one warning PER HASH (32 on the measured ubuntu
    // leg) -- exactly the noise this file's own fault comment argues against. And with a
    // SINGLE hash the called-ONCE assertions below are vacuous: one hash calls createRelease
    // once either way, so a one-hash fixture cannot see the sentinel at all.
    const fake = client({
      listCacheEntries: vi.fn(async () => [
        { key: 'nx-cache-aa11' },
        { key: 'nx-cache-bb22' },
        { key: 'nx-cache-cc33' },
      ]),
      getReleaseByTag: vi.fn(async () => {
        throw octokitFault(404);
      }),
      createRelease: vi.fn(async () => {
        throw octokitFault(422, {
          message: 'Validation Failed',
          errors: [
            PRE_RECEIVE_DECOY,
            BURNED_TAG_NAME_ENTRY,
            NO_VALID_TAG_ENTRY,
          ],
        });
      }),
    });

    const result = await publishMirror(fake, { now: NOW });

    // The counts stay HONEST, which is the whole reason this is a skip and not a silent
    // success: every scanned entry is accounted for as skipped, nothing reads as mirrored,
    // and `failed` stays 0 so the aggregate setFailed does not fire. A skipped shard must
    // never be indistinguishable from a healthy mirror -- the warning is the only thing
    // that separates them, hence the called-ONCE assertion on it below.
    expect(result).toEqual({
      scanned: 3,
      mirrored: 0,
      skipped: 3,
      readMisses: 0,
      failed: 0,
    });
    expect(result.skipped).toBe(result.scanned);
    // THE SENTINEL. One create attempt and one warning for the whole leg, not one per
    // hash: a burned tag cannot become creatable mid-run, so the second probe could only
    // ever repeat the first answer.
    expect(fake.createRelease).toHaveBeenCalledOnce();
    expect(core.warning).toHaveBeenCalledOnce();
    const warned = vi.mocked(core.warning).mock.calls[0][0];
    expect(warned).toContain(shardTag(NOW));
    expect(warned).toContain('immutable release');
    expect(fake.uploadReleaseAsset).not.toHaveBeenCalled();
    // GREEN leg, deliberately. This is the stated Window A outcome: publish green with the
    // warning, publish-verify red because nothing was mirrored for it to read back.
    expect(core.setFailed).not.toHaveBeenCalled();
  });

  it('still FAILS the run on a 422 carrying ONLY the pre_receive ruleset entry -- the decoy is not a burned name', async () => {
    // A2, and it is the load-bearing half of the pair. The decoy's wording ("Cannot create
    // ref due to creations being restricted") reads exactly like a tag ruleset, and on the
    // measured payload it is the FIRST entry -- so it is what `faultReason().message`
    // returns. A guard that matched this wording would swallow a GENUINE creations-restricted
    // ruleset, which must stay fatal: that one IS fixable, by a human editing repo settings.
    //
    // Excluded twice over, and both reasons are kept: structurally, its `field` is not
    // `tag_name`, so the field-scoped reader never looks at its message; and textually, its
    // message carries no `immutable release`.
    const fake = client({
      getReleaseByTag: vi.fn(async () => {
        throw octokitFault(404);
      }),
      createRelease: vi.fn(async () => {
        throw octokitFault(422, {
          message: 'Validation Failed',
          errors: [PRE_RECEIVE_DECOY],
        });
      }),
    });

    await expect(publishMirror(fake, { now: NOW })).rejects.toThrow();

    expect(fake.createRelease).toHaveBeenCalledOnce();
    expect(core.error).toHaveBeenCalledOnce();
    expect(fake.uploadReleaseAsset).not.toHaveBeenCalled();
  });

  it('FAILS CLOSED when the tag_name entry is reworded past the substring, and the fatal log names THAT entry not the decoy', async () => {
    // A3, two facts in one clause because they are the same fact from two sides.
    //
    // FAIL-CLOSED: the matched string is an UNDOCUMENTED vendor string (GitHub documents the
    // immutability behaviour and never the error text), so a rewording is the expected way
    // this guard dies. It has to die by throwing, never by skipping -- a rewording that took
    // the skip path would turn every future create fault into a green leg.
    //
    // AND THE LOG NAMES THE RIGHT ENTRY. `faultReason().message` returns the first entry
    // carrying a message, which on the measured payload is the DECOY -- so the fatal log
    // printed the ruleset wording for exactly the failure it exists to diagnose. The
    // authoritative entry is the `tag_name`-scoped one; the log now prefers it.
    const fake = client({
      getReleaseByTag: vi.fn(async () => {
        throw octokitFault(404);
      }),
      createRelease: vi.fn(async () => {
        throw octokitFault(422, {
          message: 'Validation Failed',
          errors: [
            PRE_RECEIVE_DECOY,
            {
              resource: 'Release',
              code: 'custom',
              field: 'tag_name',
              message: 'tag_name is reserved',
            },
          ],
        });
      }),
    });

    await expect(publishMirror(fake, { now: NOW })).rejects.toThrow();

    // Asserted against the ONE captured argument, never as a negated
    // `toHaveBeenCalledWith`. That form is satisfied when ANY ONE call fails to match, so it
    // states "some call lacks the decoy" rather than "no call carries it" -- vacuous the
    // moment this path emits a second log line.
    expect(core.error).toHaveBeenCalledOnce();
    const logged = vi.mocked(core.error).mock.calls[0][0];
    expect(logged).toContain('tag_name is reserved');
    expect(logged).not.toContain('Repository rule violations');
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
