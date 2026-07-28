import * as core from '@actions/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Hash } from '../lib/cache-key.js';
import { releaseAssetName } from '../lib/release-asset-name.js';
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

const HASH = 'abc123' as Hash;
const SHARD_ID = 555;

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
    );
  });

  it('derives the uploaded asset name ONLY through releaseAssetName(hash) (CORR-01, non-vacuous)', async () => {
    const fake = client();

    await publishMirror(fake);

    const name = vi.mocked(fake.uploadReleaseAsset).mock.calls[0][1];
    // Non-vacuous: the name must be the OS-namespaced single-source form, never the bare
    // hash -- this fails the moment the publisher inlines its own template and drifts.
    expect(name).toBe(releaseAssetName(HASH));
    expect(name).not.toBe(HASH);
    expect(name.startsWith(`${HASH}-`)).toBe(true);
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
    );
  });

  it('re-reads the shard by tag when createRelease 422s (another leg won the create race)', async () => {
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

    const result = await publishMirror(fake);

    expect(getReleaseByTag).toHaveBeenCalledTimes(2);
    expect(result.mirrored).toBe(1);
    expect(fake.uploadReleaseAsset).toHaveBeenCalledWith(
      SHARD_ID,
      releaseAssetName(HASH),
      expect.anything(),
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
