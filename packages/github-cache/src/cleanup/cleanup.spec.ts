import * as core from '@actions/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
        { id: 1, name: 'old-linux', created_at: EXPIRED },
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
});

describe('cleanupMirror DELETE phase prune/retain by created_at (TEST-06)', () => {
  it('prunes an expired created_at and retains a within-window one (TEST-06)', async () => {
    const deleteAsset = vi.fn(async () => {});
    const pruneClient = client({
      listAllAssets: vi.fn(async () => [
        { id: 1, name: 'expired-linux', created_at: EXPIRED },
        { id: 2, name: 'fresh-linux', created_at: WITHIN_WINDOW },
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
        { id: 1, name: 'gone-linux', created_at: EXPIRED },
        { id: 2, name: 'faulted-linux', created_at: EXPIRED },
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
});

describe('cleanupMirror observability (OBS-01)', () => {
  it('reports pruned/failed/scanned counts in the run summary (OBS-01)', async () => {
    const obsClient = client({
      listAllAssets: vi.fn(async () => [
        { id: 1, name: 'expired-linux', created_at: EXPIRED },
        { id: 2, name: 'fresh-linux', created_at: WITHIN_WINDOW },
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
