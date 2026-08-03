import * as core from '@actions/core';
import { isWritableBackend } from '../backend/types.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createReleasesReadBackend,
  type ReleaseReadClient,
} from '../backend/releases-backend.js';
import { octokitFault } from '../test/octokit-fault.js';
import {
  cleanupMirror,
  type CleanupAsset,
  type CleanupClient,
} from './cleanup.js';

// @actions/core is mocked so the summary/annotation calls never touch a real
// GITHUB_STEP_SUMMARY file and every emission is spy-assertable. The summary object
// is chainable (addHeading().addTable()) so the engine's fluent call compiles and
// runs against the fake (03-PATTERNS.md: assert on recorded @actions/core calls).
vi.mock('@actions/core', () => {
  const summary = {
    addHeading: vi.fn(() => summary),
    addTable: vi.fn(() => summary),
    write: vi.fn(async () => summary),
  };

  return {
    warning: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    notice: vi.fn(),
    setFailed: vi.fn(),
    summary,
  };
});

// Pin the clock so the created_at cutoff is calendar-date-independent: the engine
// reads Date.now() internally, so faking the system clock is the only way to fix the
// prune window deterministically. now = 2026-07-15, maxAgeDays = 30 => cutoff =
// 2026-06-15. EXPIRED is well before the cutoff (pruned); WITHIN_WINDOW is after it
// (retained).
const PINNED_NOW = new Date('2026-07-15T00:00:00Z');
const EXPIRED = '2026-05-01T00:00:00Z';
const WITHIN_WINDOW = '2026-07-10T00:00:00Z';

// A mirror release and a non-mirror release, so the cache-mirror-* scope filter is
// exercised (Pitfall 4: cleanup considers ONLY cache-mirror-* releases).
const MIRROR_RELEASE = { id: 10, tag_name: 'cache-mirror-202607' };

function client(overrides: Partial<CleanupClient> = {}): CleanupClient {
  return {
    listAllReleases: vi.fn(async () => [MIRROR_RELEASE]),
    listAllAssets: vi.fn(async () => [] as CleanupAsset[]),
    deleteAsset: vi.fn(async () => {}),
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(PINNED_NOW);
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('cleanupMirror LIST phase fail-loud (RETAIN-01, D-10, C9)', () => {
  it('aborts with ZERO deletions when listAllAssets throws mid-pagination (RETAIN-01)', async () => {
    // The load-bearing test: release 10 DOES contain an expired asset, but the fault on
    // the SECOND release's asset listing must abort the whole run BEFORE any delete --
    // materialize-before-delete, so a partial listing can never authorize a deletion.
    const deleteAsset = vi.fn(async () => {});
    const listAllAssets = vi
      .fn<(releaseId: number) => Promise<CleanupAsset[]>>()
      .mockResolvedValueOnce([
        { id: 1, name: 'feed01-linux', created_at: EXPIRED },
      ])
      .mockRejectedValueOnce(octokitFault(500));
    const faultingClient = client({
      listAllReleases: vi.fn(async () => [
        { id: 10, tag_name: 'cache-mirror-202606' },
        { id: 20, tag_name: 'cache-mirror-202607' },
      ]),
      listAllAssets,
      deleteAsset,
    });

    await expect(cleanupMirror(faultingClient, 30)).rejects.toThrow();

    expect(deleteAsset).not.toHaveBeenCalled();
  });

  it('aborts with zero deletions on a non-404 fault listing releases (RETAIN-01, ROBUST-01)', async () => {
    const deleteAsset = vi.fn(async () => {});
    const faultingClient = client({
      listAllReleases: vi.fn(async () => {
        throw octokitFault(403);
      }),
      deleteAsset,
    });

    await expect(cleanupMirror(faultingClient, 30)).rejects.toThrow();

    expect(deleteAsset).not.toHaveBeenCalled();
  });

  it('is a clean no-op on a repo with no releases (0 pruned, no failure)', async () => {
    const deleteAsset = vi.fn(async () => {});
    const emptyClient = client({
      listAllReleases: vi.fn(async () => []),
      deleteAsset,
    });

    const result = await cleanupMirror(emptyClient, 30);

    expect(result).toEqual({ pruned: 0, failed: 0, scanned: 0 });
    expect(deleteAsset).not.toHaveBeenCalled();
    expect(core.setFailed).not.toHaveBeenCalled();
  });

  it('considers ONLY cache-mirror-* releases (Pitfall 4 scope)', async () => {
    const listAllAssets = vi.fn(async () => [] as CleanupAsset[]);
    const deleteAsset = vi.fn(async () => {});
    const mixedClient = client({
      listAllReleases: vi.fn(async () => [
        { id: 5, tag_name: 'v1.0.0' },
        { id: 6, tag_name: 'latest' },
      ]),
      listAllAssets,
      deleteAsset,
    });

    await cleanupMirror(mixedClient, 30);

    expect(listAllAssets).not.toHaveBeenCalled();
    expect(deleteAsset).not.toHaveBeenCalled();
  });

  it('skips a non-shard cache-mirror-* release entirely (exact isShardTag, not a loose prefix)', async () => {
    // The loose startsWith(SHARD_TAG_PREFIX) matched these; the exact isShardTag
    // does not, so a cache-mirror-latest / cache-mirror-backup release is never
    // scoped -- its assets are neither listed nor deleted.
    const listAllAssets = vi.fn(async () => [] as CleanupAsset[]);
    const deleteAsset = vi.fn(async () => {});
    const nonShardClient = client({
      listAllReleases: vi.fn(async () => [
        { id: 30, tag_name: 'cache-mirror-latest' },
        { id: 31, tag_name: 'cache-mirror-backup' },
      ]),
      listAllAssets,
      deleteAsset,
    });

    await cleanupMirror(nonShardClient, 30);

    expect(listAllAssets).not.toHaveBeenCalled();
    expect(deleteAsset).not.toHaveBeenCalled();
  });
});

describe('cleanupMirror DELETE phase prune/retain by created_at (TEST-06)', () => {
  it('prunes an expired created_at and retains a within-window one (TEST-06)', async () => {
    const deleteAsset = vi.fn(async () => {});
    const pruneClient = client({
      listAllAssets: vi.fn(async () => [
        { id: 1, name: 'abc123-linux', created_at: EXPIRED },
        { id: 2, name: 'deadbeef-linux', created_at: WITHIN_WINDOW },
      ]),
      deleteAsset,
    });

    const result = await cleanupMirror(pruneClient, 30);

    expect(deleteAsset).toHaveBeenCalledTimes(1);
    expect(deleteAsset).toHaveBeenCalledWith(1);
    expect(result.pruned).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.scanned).toBe(2);
  });

  it('skips a foreign asset but still prunes a genuine expired <hash>-<os> in the same shard (asset-name narrowing guard)', async () => {
    // The regression guard for the asset-name narrowing: a foreign asset (no
    // <hash>-<os> shape) in a genuine shard is skipped -- before scanned++ -- while
    // a genuine expired publisher asset in the SAME release is still pruned, proving
    // the change is a pure narrowing that never stops pruning real shard assets.
    const deleteAsset = vi.fn(async () => {});
    const guardClient = client({
      listAllAssets: vi.fn(async () => [
        { id: 1, name: 'sbom.json', created_at: EXPIRED },
        { id: 2, name: 'deadc0de-linux', created_at: EXPIRED },
      ]),
      deleteAsset,
    });

    const result = await cleanupMirror(guardClient, 30);

    expect(deleteAsset).toHaveBeenCalledTimes(1);
    expect(deleteAsset).toHaveBeenCalledWith(2);
    expect(result.pruned).toBe(1);
    expect(result.failed).toBe(0);
    // The foreign asset is skipped before scanned++, so only the genuine one counts.
    expect(result.scanned).toBe(1);
  });
});

// The MEASURED census of shard `cache-mirror-202607` -- release id 354838660, read live
// 2026-07-29 and recorded in 10-EVIDENCE-PRE-RENAME.md. 122 assets total: 50 PoC-era
// `<hash>.tar.gz`, 46 `<hash>-linux`, 26 `<hash>-windows`, ZERO `<hash>-macos`, ZERO
// anything else. The shard tag is named here on purpose -- it rolls over 2026-08-01 and a
// bare count is unattributable afterwards.
//
// These are real numbers, so the fixture below models a shard that actually exists rather
// than one invented to suit the filter, and the three counts are locked against the
// measured total inside the test so a later edit cannot quietly reshape it.
const CENSUS_TAR_GZ = 50;
const CENSUS_LINUX = 46;
const CENSUS_WINDOWS = 26;
const CENSUS_TOTAL = 122;

// Absent from the census by construction: the shard predates CORR-02, so no
// `nx-cache-<hash>` asset has ever been written to it. Four is enough to be a FAMILY
// rather than a single case.
const NEW_FORM_EXPIRED = 4;

// `feed` + a hex index, so every hash half is lowercase hex and HASH_PATTERN admits it.
function censusHash(index: number): string {
  return `feed${index.toString(16)}`;
}

interface MixedShard {
  readonly assets: readonly CleanupAsset[];
  /** Names an aged-out run MUST delete. */
  readonly prunable: readonly string[];
  /** Names an aged-out run must NEVER delete. */
  readonly retained: readonly string[];
}

function mixedShard(): MixedShard {
  const assets: CleanupAsset[] = [];
  const prunable: string[] = [];
  const retained: string[] = [];
  let id = 0;

  function seed(name: string, createdAt: string, prunes: boolean): void {
    id++;
    assets.push({ id, name, created_at: createdAt });
    (prunes ? prunable : retained).push(name);
  }

  // The PoC-era family. Matched by NO branch of the filter, before or after RETAIN-04,
  // so it is permanent ACCEPTED dead weight with a measured count (D-08) -- bounded at
  // 122 of a per-shard 1000 cap on a shard that stops taking writes. Retained: widening
  // the filter to reach it would widen a DELETE filter to a shape indistinguishable from
  // a foreign asset.
  for (let index = 0; index < CENSUS_TAR_GZ; index++) {
    seed(`${censusHash(index)}.tar.gz`, EXPIRED, false);
  }

  // RETAIN-04's legacy branch: today's `<hash>-<os>` shape. CORR-02 stops PRODUCING it
  // but cleanup must keep PRUNING it, or these 72 aged assets become immortal.
  for (let index = 0; index < CENSUS_LINUX; index++) {
    seed(`${censusHash(index)}-linux`, EXPIRED, true);
  }

  for (let index = 0; index < CENSUS_WINDOWS; index++) {
    seed(`${censusHash(index)}-windows`, EXPIRED, true);
  }

  // RETAIN-04's new branch, and the RED. Today's single-branch filter splits on the LAST
  // `-`, so the hash half of `nx-cache-feed0` is the literal string `nx-cache` -- which
  // holds a `-` and can never be hex -- and the asset is skipped, never pruned however
  // old. Post-rename these are the ONLY shape the publisher writes, so a filter that
  // cannot see them retains the entire live mirror forever.
  for (let index = 0; index < NEW_FORM_EXPIRED; index++) {
    seed(`nx-cache-${censusHash(index)}`, EXPIRED, true);
  }

  // A new-form asset INSIDE the age window, and it is the control that keeps the row
  // above honest: it is retained both before and after RETAIN-04, separating "the filter
  // widened" from "the filter widened and stopped honouring the created_at cutoff". The
  // second is data loss wearing a passing test.
  seed(`nx-cache-${censusHash(NEW_FORM_EXPIRED)}`, WITHIN_WINDOW, false);

  // Two foreign assets, and NEITHER may ever be deleted -- that is the entire reason an
  // accept filter guards this DELETE path. The first is unmistakably third-party. The
  // second is the adversarial one: it wears the real prefix, so it must be rejected by
  // the NEW branch on its non-hex remainder, not merely by the old one.
  seed('sbom.spdx.json', EXPIRED, false);
  seed('nx-cache-release-notes.md', EXPIRED, false);

  return { assets, prunable, retained };
}

describe('cleanupMirror over a MIXED shard (RETAIN-04, RETAIN-05, T-10-01)', () => {
  it('prunes both name families and deletes neither the PoC-era family nor a foreign asset', async () => {
    const { assets, prunable, retained } = mixedShard();
    const byId = new Map(assets.map((asset) => [asset.id, asset.name]));
    const deleted: string[] = [];
    const shardClient = client({
      listAllAssets: vi.fn(async () => [...assets]),
      deleteAsset: vi.fn(async (assetId: number) => {
        deleted.push(byId.get(assetId) ?? `UNKNOWN-ID-${assetId}`);
      }),
    });

    // Fixture-shape locks, asserted BEFORE the act: the three family counts must still
    // sum to the measured 122, and the two expectation sets must still have the sizes
    // the families above imply. Without these a mis-flagged family would silently
    // rewrite the expectation instead of failing.
    expect(CENSUS_TAR_GZ + CENSUS_LINUX + CENSUS_WINDOWS).toBe(CENSUS_TOTAL);
    expect(prunable).toHaveLength(
      CENSUS_LINUX + CENSUS_WINDOWS + NEW_FORM_EXPIRED,
    );
    expect(retained).toHaveLength(CENSUS_TAR_GZ + 3);

    const result = await cleanupMirror(shardClient, 30);

    // BOTH directions in one assertion: nothing expected is missing AND nothing
    // unexpected was deleted. "Deleted everything prunable" alone would still pass if
    // the filter had also eaten the PoC-era family.
    expect([...deleted].sort()).toEqual([...prunable].sort());

    // Then per retained NAME, because this is a delete path and the set equality above
    // is one careless edit away from being weakened into a subset check.
    for (const name of retained) {
      expect(deleted).not.toContain(name);
    }

    // `scanned` counts assets the filter ADMITTED, pruned or not -- so it is the prunable
    // set plus the one within-window new-form asset. It is the count that distinguishes
    // "the filter admitted it and the age gate held it" from "the filter never saw it".
    expect(result).toEqual({
      pruned: prunable.length,
      failed: 0,
      scanned: prunable.length + 1,
    });
    expect(core.setFailed).not.toHaveBeenCalled();
  });
});

describe('cleanupMirror DELETE phase isolation + fail-loud (TEST-04, OBS-01)', () => {
  it('isolates a per-item failure, deletes the rest, and fails loud on aggregate (TEST-04)', async () => {
    const deleteAsset = vi
      .fn<(assetId: number) => Promise<void>>()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(octokitFault(500))
      .mockResolvedValueOnce(undefined);
    const isolationClient = client({
      listAllAssets: vi.fn(async () => [
        { id: 1, name: 'a-linux', created_at: EXPIRED },
        { id: 2, name: 'b-linux', created_at: EXPIRED },
        { id: 3, name: 'c-linux', created_at: EXPIRED },
      ]),
      deleteAsset,
    });

    const result = await cleanupMirror(isolationClient, 30);

    // Isolation: the middle rejection did NOT stop the third delete.
    expect(deleteAsset).toHaveBeenCalledTimes(3);
    expect(result.pruned).toBe(2);
    expect(result.failed).toBe(1);
    expect(core.setFailed).toHaveBeenCalledOnce();
    expect(core.warning).toHaveBeenCalledOnce();
  });

  it('treats a 404 on delete as already-gone (benign) but a 5xx as a real failure (ROBUST-01)', async () => {
    const deleteAsset = vi
      .fn<(assetId: number) => Promise<void>>()
      .mockRejectedValueOnce(octokitFault(404))
      .mockRejectedValueOnce(octokitFault(500));
    const mixedFaultClient = client({
      listAllAssets: vi.fn(async () => [
        { id: 1, name: 'c0ffee-linux', created_at: EXPIRED },
        { id: 2, name: 'dec0de-linux', created_at: EXPIRED },
      ]),
      deleteAsset,
    });

    const result = await cleanupMirror(mixedFaultClient, 30);

    // Only the 5xx is a real failure; the 404 is the sole "already gone" absence.
    expect(result.pruned).toBe(1);
    expect(result.failed).toBe(1);
    expect(core.setFailed).toHaveBeenCalledOnce();
    expect(core.warning).toHaveBeenCalledOnce();
  });

  it('names GitHub own code AND message on a delete failure, not the status alone', async () => {
    // THE SAME BODY IS AVAILABLE ON A CLEANUP FAULT AS ON A PUBLISH FAULT, and B2's finding
    // was that a CODE-ONLY reader is useless because a policy rejection arrives as `custom`
    // whose documented meaning is "refer to the message". A STATUS-ONLY reader is strictly
    // weaker than the one already measured useless. `faultReason` is a lib/ leaf precisely so
    // this site reads the body on the same footing as the two publish sites -- one reader per
    // fault class, shared by every call site of that class, not per file.
    const policyClient = client({
      listAllAssets: vi.fn(async () => [
        { id: 1, name: 'facade-linux', created_at: EXPIRED },
      ]),
      deleteAsset: vi.fn(async () => {
        throw octokitFault(422, {
          message: 'Validation Failed',
          errors: [
            {
              resource: 'ReleaseAsset',
              code: 'custom',
              message: 'Release assets are immutable under this ruleset',
            },
          ],
        });
      }),
    });

    const result = await cleanupMirror(policyClient, 30);

    expect(result.failed).toBe(1);
    expect(core.warning).toHaveBeenCalledOnce();
    const warned = vi.mocked(core.warning).mock.calls[0][0];
    // `code custom` and not the bare token: the asset name and the message both risk
    // carrying the word, so an unpinned substring would assert something else entirely
    // (the identical hardening already applied at publish-mirror.spec.ts).
    expect(warned).toContain('code custom');
    expect(warned).toContain('Release assets are immutable under this ruleset');
  });
});

describe('cleanupMirror observability (OBS-01)', () => {
  it('reports pruned/failed/scanned counts in the run summary (OBS-01)', async () => {
    const obsClient = client({
      listAllAssets: vi.fn(async () => [
        { id: 1, name: 'ba5eba11-linux', created_at: EXPIRED },
        { id: 2, name: 'd15ea5e-linux', created_at: WITHIN_WINDOW },
      ]),
    });

    await cleanupMirror(obsClient, 30);

    expect(core.summary.addTable).toHaveBeenCalledOnce();
    const rows = vi.mocked(core.summary.addTable).mock.calls[0][0];
    const flat = JSON.stringify(rows);

    expect(flat).toContain('pruned');
    expect(flat).toContain('failed');
    expect(flat).toContain('scanned');
    expect(core.summary.write).toHaveBeenCalledOnce();
  });
});

describe('createReleasesReadBackend read-only-local put re-assertion (TEST-06)', () => {
  // ROADMAP couples TEST-06's read-only-local half (a local put() always resolves
  // 'forbidden' / 403 -- there is no local write path) with this phase's date-cleanup,
  // so it is re-asserted here alongside the prune/retain tests. The put path itself is
  // unchanged from Phase 3; this pins the coupling in a Phase 4 spec.
  it('exposes NO local write path -- read-only by construction (TEST-06)', () => {
    const readOnlyClient: ReleaseReadClient = {
      async fetchAsset(): Promise<Buffer | undefined> {
        return undefined;
      },
    };
    const backend = createReleasesReadBackend(readOnlyClient);

    // No put at all: the write refusal is structural (ReadableBackend), not a
    // runtime 'forbidden'. The server produces the contract's 403.
    expect(isWritableBackend(backend)).toBe(false);
    expect('put' in backend).toBe(false);
  });
});

describe('cleanupMirror malformed created_at guard', () => {
  it('warns and does NOT prune an asset whose created_at is unparseable (never delete on ambiguous age)', async () => {
    const deleteAsset = vi.fn(async () => {});
    const fake = client({
      listAllAssets: vi.fn(async () => [
        { id: 1, name: 'abcdef-linux', created_at: 'not-a-date' },
      ]),
      deleteAsset,
    });

    const result = await cleanupMirror(fake, 30);

    // NaN age -> not deleted (never delete on ambiguity) but surfaced, not silent.
    expect(deleteAsset).not.toHaveBeenCalled();
    expect(result).toEqual({ pruned: 0, failed: 0, scanned: 1 });
    expect(core.warning).toHaveBeenCalledWith(
      expect.stringContaining('unparseable created_at'),
    );
  });
});
