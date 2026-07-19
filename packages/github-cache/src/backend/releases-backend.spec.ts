import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  resolveLocalReadToken,
  resolveRepoIdentity,
} from '../lib/local-context.js';
import { cachePlatform, releaseAssetName } from '../lib/release-asset-name.js';
import {
  createReleasesReadBackend,
  createReleasesReadClient,
  type ReleaseReadClient,
} from './releases-backend.js';

// The real default ReleaseReadClient resolves the developer's token and repo
// identity through local-context, which is subprocess-backed (gh / git) on a real
// machine. Mock that module so these unit tests never spawn gh/git or touch a
// keychain -- and so CI stays green on a runner with no gh installed. The REST
// layer itself is exercised by spying on the global fetch (03-PATTERNS.md No
// Analog Found: mocked global fetch returning crafted Response objects).
vi.mock('../lib/local-context.js');

const mockToken = vi.mocked(resolveLocalReadToken);
const mockRepo = vi.mocked(resolveRepoIdentity);

// Safe to reuse short hashes shared with other specs: this spec touches NO
// filesystem -- the fake client is a plain in-memory Map -- so there is no shared
// temp-file race like actions-cache-backend.spec.ts guards against with a
// per-spec unique hash.
const INVARIANT_HASH = 'deadbeef';
const SENSITIVE_HASH = 'beefcafe';

// The OS discriminator this test process is NOT running under, so a "foreign OS"
// seeded entry is genuinely foreign on every CI matrix leg (Windows, Linux,
// macOS). cachePlatform(OTHER_PLATFORM) is always different from the running one,
// so releaseAssetName(hash) (running platform) never collides with the seed.
const OTHER_PLATFORM: NodeJS.Platform =
  cachePlatform(process.platform) === 'windows' ? 'linux' : 'win32';

interface RecordingClient extends ReleaseReadClient {
  readonly requested: readonly string[];
}

// A fake ReleaseReadClient over a Map -- no mocking framework needed for the
// cross-OS assertions (03-PATTERNS.md: the seam reduces to a Map). It records the
// asset names it was asked for so G3 can assert the derivation path.
function recordingClient(store: Map<string, Buffer>): RecordingClient {
  const requested: string[] = [];

  return {
    requested,
    async fetchAsset(assetName: string): Promise<Buffer | undefined> {
      requested.push(assetName);

      return store.get(assetName);
    },
  };
}

// Always throws, carrying a distinctive credential-shaped token in its message so
// the no-leak assertion is non-vacuous.
const throwingClient: ReleaseReadClient = {
  async fetchAsset(): Promise<Buffer | undefined> {
    throw new Error('boom ghs_leakedtokenvalue');
  },
};

// Pin the clock so the reader's shardTagsForWindow(resolveMaxAgeDays(env)) walk is
// calendar-date-independent: 2026-07-15 mid-month + the default 30-day knob yields a
// deterministic TWO-shard window ['cache-mirror-202607', 'cache-mirror-202606'] on every
// run, regardless of the real date. The reader reads new Date() internally, so faking the
// system clock is the only way to fix the window without changing the reader's signature.
const PINNED_NOW = new Date('2026-07-15T00:00:00Z');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(PINNED_NOW);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('createReleasesReadBackend get cross-OS round-trip (CORR-01, TEST-05)', () => {
  it('returns THIS platform bytes for an OS-invariant hash present under both platforms (CORR-01)', async () => {
    const here = releaseAssetName(INVARIANT_HASH);
    const there = releaseAssetName(INVARIANT_HASH, OTHER_PLATFORM);
    const backend = createReleasesReadBackend(
      recordingClient(
        new Map([
          [here, Buffer.from('here-bytes')],
          [there, Buffer.from('there-bytes')],
        ]),
      ),
    );

    const result = await backend.get(INVARIANT_HASH);

    expect(result).toEqual({ kind: 'hit', bytes: Buffer.from('here-bytes') });
  });

  it('MISSES an OS-sensitive hash present ONLY under another platform -- never a wrong-OS artifact (CORR-01)', async () => {
    // Non-vacuous: a positive-only correct-hit assertion above still passes with
    // OS-namespacing deleted entirely (releaseAssetName ignoring its platform).
    // THIS negative case is the one that actually proves CORR-01 -- it goes red the
    // moment the reader would serve a foreign-OS artifact as a valid hit. The repo
    // has already shipped one tautological guard (select-backend.spec.ts:196-198);
    // that failure mode must not recur here.
    const there = releaseAssetName(SENSITIVE_HASH, OTHER_PLATFORM);
    const backend = createReleasesReadBackend(
      recordingClient(new Map([[there, Buffer.from('there-bytes')]])),
    );

    const result = await backend.get(SENSITIVE_HASH);

    expect(result).toEqual({ kind: 'miss' });
  });
});

describe('createReleasesReadBackend name derivation (TEST-05)', () => {
  // Non-vacuous: assert the RECORDED fetchAsset argument equals
  // releaseAssetName(hash) imported from the single-source helper -- so it fails
  // if this backend ever inlines its own name template and drifts from the Phase 4
  // publisher (the silent cross-OS MISS class G3 exists to catch). Mirrors
  // actions-cache-backend.spec.ts:129-144.
  it('derives the get asset name ONLY through releaseAssetName (TEST-05)', async () => {
    const client = recordingClient(new Map());
    const backend = createReleasesReadBackend(client);

    await backend.get('abc123');

    expect(client.requested).toEqual([releaseAssetName('abc123')]);
  });
});

describe('createReleasesReadBackend put (D-02, TRUST-05)', () => {
  it('forbids a normal write (D-02)', async () => {
    const backend = createReleasesReadBackend(recordingClient(new Map()));

    expect(await backend.put('abc123', Buffer.from('bytes'))).toBe('forbidden');
  });

  it('forbids an empty-buffer write (D-02)', async () => {
    const backend = createReleasesReadBackend(recordingClient(new Map()));

    expect(await backend.put('abc123', Buffer.alloc(0))).toBe('forbidden');
  });

  it('forbids a write for a hash already present in the client (D-02)', async () => {
    const seeded = new Map([
      [releaseAssetName('abc123'), Buffer.from('bytes')],
    ]);
    const backend = createReleasesReadBackend(recordingClient(seeded));

    expect(await backend.put('abc123', Buffer.from('other'))).toBe('forbidden');
  });
});

describe('createReleasesReadBackend fault degradation (D-11, SRV-05)', () => {
  it('degrades a rejecting fetchAsset to a MISS; the rejection never escapes get (D-11)', async () => {
    vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    const backend = createReleasesReadBackend(throwingClient);

    await expect(backend.get('abc123')).resolves.toEqual({ kind: 'miss' });
  });

  it('returns a MISS and writes NOTHING to stderr for the ordinary absent-asset path (D-11)', async () => {
    const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    const backend = createReleasesReadBackend(recordingClient(new Map()));

    const result = await backend.get('abc123');

    expect(result).toEqual({ kind: 'miss' });
    expect(stderr).not.toHaveBeenCalled();
  });
});

describe('createReleasesReadBackend one-time warning (D-11, T-03-03, T-03-06)', () => {
  // The warned flag is module-level, so each warning test imports a FRESH module
  // via vi.resetModules() + dynamic import to keep the once-per-process assertion
  // independent of test order (03-01-PLAN.md Task 2 action).
  it('warns to stderr at most once across two throwing get calls (T-03-06)', async () => {
    vi.resetModules();
    const { createReleasesReadBackend: freshBackend } =
      await import('./releases-backend.js');
    const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    const backend = freshBackend(throwingClient);

    await backend.get('abc123');
    await backend.get('def456');

    expect(stderr).toHaveBeenCalledTimes(1);
  });

  it('never emits any credential-shaped material in the warning (T-03-03)', async () => {
    vi.resetModules();
    const { createReleasesReadBackend: freshBackend } =
      await import('./releases-backend.js');
    const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    const backend = freshBackend(throwingClient);

    await backend.get('abc123');

    const written = stderr.mock.calls.map((call) => String(call[0])).join('');
    expect(written).not.toContain('ghs_leakedtokenvalue');
    expect(written).not.toContain('boom');
  });
});

describe('createReleasesReadClient no-anonymous-request guarantee (FOUND-02, D-09/D-10)', () => {
  it('returns undefined and issues ZERO fetches when no token resolves (D-09)', async () => {
    // Non-vacuous: asserts the fetch spy recorded ZERO calls, not merely that the
    // result is undefined. A private repo must never be probed unauthenticated --
    // the reader MISSES rather than dropping to the anonymous 60/hr tier (D-09).
    mockToken.mockResolvedValue(undefined);
    mockRepo.mockResolvedValue('op-nx/github-cache');
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const bytes = await createReleasesReadClient({}).fetchAsset('abc123-linux');

    expect(bytes).toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns undefined and issues ZERO fetches when the repo identity is unresolved (D-10)', async () => {
    // Non-vacuous: zero fetch calls, not merely undefined -- with no repo identity
    // the reader never guesses another repository's namespace and never probes.
    mockToken.mockResolvedValue('ghs_faketoken');
    mockRepo.mockResolvedValue(undefined);
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const bytes = await createReleasesReadClient({}).fetchAsset('abc123-linux');

    expect(bytes).toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('createReleasesReadClient REST sequence (FOUND-02, D-03)', () => {
  it('resolves asset bytes on the happy path: release 200 -> assets 200 with the name -> download 200 (FOUND-02)', async () => {
    mockToken.mockResolvedValue('ghs_faketoken');
    mockRepo.mockResolvedValue('op-nx/github-cache');
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 7 }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ id: 42, name: 'abc123-linux' }]), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(Buffer.from('cache-bytes'), { status: 200 }),
      );

    const bytes = await createReleasesReadClient({}).fetchAsset('abc123-linux');

    expect(bytes).toEqual(Buffer.from('cache-bytes'));
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it('paginates: requests page 2 when page 1 returns a full page of 100 not containing the name (D-03)', async () => {
    // Non-vacuous: page 1 is a FULL page of 100 that does NOT contain the asset, so
    // a reader that stopped at page 1 (or read the inline release.assets snapshot)
    // would MISS a real HIT. The asset lives on page 2; the page query must increment.
    mockToken.mockResolvedValue('ghs_faketoken');
    mockRepo.mockResolvedValue('op-nx/github-cache');
    const fullFirstPage = Array.from({ length: 100 }, (_, index) => ({
      id: index,
      name: `other-${index}-linux`,
    }));
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 7 }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(fullFirstPage), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ id: 999, name: 'abc123-linux' }]), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(Buffer.from('page2-bytes'), { status: 200 }),
      );

    const bytes = await createReleasesReadClient({}).fetchAsset('abc123-linux');

    expect(bytes).toEqual(Buffer.from('page2-bytes'));
    expect(String(fetchSpy.mock.calls[1][0])).toContain('page=1');
    expect(String(fetchSpy.mock.calls[2][0])).toContain('page=2');
  });

  it('downloads with Accept octet-stream and a bearer header, and never sets redirect manual (D-03)', async () => {
    // Non-vacuous: native fetch drops Authorization on the cross-origin 302 to signed
    // storage by spec (whatwg/fetch#1544). Forcing manual redirect handling or
    // re-attaching the header would leak the token to third-party storage. Assert the
    // download carries the right headers AND that the redirect option is simply absent.
    mockToken.mockResolvedValue('ghs_downloadtoken');
    mockRepo.mockResolvedValue('op-nx/github-cache');
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 7 }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ id: 42, name: 'abc123-linux' }]), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(Buffer.from('bytes'), { status: 200 }),
      );

    await createReleasesReadClient({}).fetchAsset('abc123-linux');

    const downloadInit = fetchSpy.mock.calls[2][1] as unknown as {
      headers: Record<string, string>;
      redirect?: string;
    };

    expect(downloadInit.headers.accept).toBe('application/octet-stream');
    expect(downloadInit.headers.authorization).toBe('Bearer ghs_downloadtoken');
    expect(downloadInit.redirect).toBeUndefined();
  });

  it('bounds every GitHub REST fetch with an AbortSignal so a stalled connection degrades to a MISS (SRV-05, HI-02)', async () => {
    // Non-vacuous: a wedged connection to api.github.com must abort within a bound
    // (mirroring the subprocess HELPER_TIMEOUT_MS) rather than hang the build for
    // undici's multi-minute default. Assert each of the three fetches -- release
    // lookup, asset list, download -- carries an AbortSignal; an unbounded fetch
    // leaves signal undefined. The abort path itself degrades to a MISS via the
    // rejected-fetch fault handling already asserted in the fault matrix below.
    mockToken.mockResolvedValue('ghs_faketoken');
    mockRepo.mockResolvedValue('op-nx/github-cache');
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 7 }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ id: 42, name: 'abc123-linux' }]), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(Buffer.from('bytes'), { status: 200 }),
      );

    await createReleasesReadClient({}).fetchAsset('abc123-linux');

    expect(fetchSpy).toHaveBeenCalledTimes(3);

    for (const call of fetchSpy.mock.calls) {
      const init = call[1] as unknown as { signal?: unknown };

      expect(init?.signal).toBeInstanceOf(AbortSignal);
    }
  });

  it('returns undefined on a shard 404 -- the ordinary cold-cache MISS (FOUND-02)', async () => {
    mockToken.mockResolvedValue('ghs_faketoken');
    mockRepo.mockResolvedValue('op-nx/github-cache');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 404 }),
    );

    const bytes = await createReleasesReadClient({}).fetchAsset('abc123-linux');

    expect(bytes).toBeUndefined();
  });

  it('returns undefined when the asset name is absent across all pages (FOUND-02)', async () => {
    mockToken.mockResolvedValue('ghs_faketoken');
    mockRepo.mockResolvedValue('op-nx/github-cache');
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 7 }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ id: 1, name: 'someother-linux' }]), {
          status: 200,
        }),
      );

    const bytes = await createReleasesReadClient({}).fetchAsset('abc123-linux');

    expect(bytes).toBeUndefined();
  });

  it('resolves the token and repo identity once per client across multiple fetches, and a fresh client re-resolves (ME-01)', async () => {
    // Non-vacuous: without memoization each fetchAsset re-runs the subprocess-backed
    // resolvers (gh / git credential fill / git remote), respawning them once per
    // cache lookup -- hundreds of times in a real monorepo build -- and multiplying
    // HI-02's hang-exposure window. Assert the resolvers run once for one client's
    // lifetime, AND that a second client resolves independently, so the cache is per
    // instance and never a global that leaks across selectBackend constructions.
    mockToken.mockResolvedValue('ghs_faketoken');
    mockRepo.mockResolvedValue('op-nx/github-cache');
    mockToken.mockClear();
    mockRepo.mockClear();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 404 }),
    );
    const client = createReleasesReadClient({});

    await client.fetchAsset('abc123-linux');
    await client.fetchAsset('def456-linux');
    await client.fetchAsset('ghi789-linux');

    expect(mockToken).toHaveBeenCalledTimes(1);
    expect(mockRepo).toHaveBeenCalledTimes(1);

    const secondClient = createReleasesReadClient({});
    await secondClient.fetchAsset('jkl012-linux');

    expect(mockToken).toHaveBeenCalledTimes(2);
    expect(mockRepo).toHaveBeenCalledTimes(2);
  });
});

describe('createReleasesReadClient retention window walk (D-08)', () => {
  it('walks to the prior shard when the newest shard 404s and resolves the HIT there', async () => {
    // Pinned now (2026-07-15) + the default 30-day knob => a two-shard window
    // ['cache-mirror-202607', 'cache-mirror-202606'], newest first. The newest shard
    // 404s (nothing published this month yet), so the reader MUST try the prior shard
    // rather than concluding MISS after one lookup -- an asset written last month has to
    // survive the month boundary (D-08). Non-vacuous: asserts the SECOND lookup targets
    // cache-mirror-202606, not merely that a HIT resolved.
    mockToken.mockResolvedValue('ghs_faketoken');
    mockRepo.mockResolvedValue('op-nx/github-cache');
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 9 }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ id: 55, name: 'abc123-linux' }]), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(Buffer.from('walked-bytes'), { status: 200 }),
      );

    const bytes = await createReleasesReadClient({}).fetchAsset('abc123-linux');

    expect(bytes).toEqual(Buffer.from('walked-bytes'));
    expect(String(fetchSpy.mock.calls[0][0])).toContain(
      'releases/tags/cache-mirror-202607',
    );
    expect(String(fetchSpy.mock.calls[1][0])).toContain(
      'releases/tags/cache-mirror-202606',
    );
  });

  it('returns undefined (MISS) only after exhausting every shard in the window (D-08)', async () => {
    // Both shards 404. Non-vacuous: asserts TWO release lookups happened and the second
    // targeted the prior shard, so the MISS is proven to exhaust the window rather than
    // stopping at the newest shard (the Phase 3 single-shard regression this guards).
    mockToken.mockResolvedValue('ghs_faketoken');
    mockRepo.mockResolvedValue('op-nx/github-cache');
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 404 }));

    const bytes = await createReleasesReadClient({}).fetchAsset('abc123-linux');

    expect(bytes).toBeUndefined();
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(String(fetchSpy.mock.calls[1][0])).toContain(
      'releases/tags/cache-mirror-202606',
    );
  });
});

describe('createReleasesReadClient fault matrix through the backend (SRV-05, D-11)', () => {
  it.each([401, 403, 429, 500])(
    'degrades a %i on the release lookup to a MISS through the backend (SRV-05)',
    async (status) => {
      mockToken.mockResolvedValue('ghs_faketoken');
      mockRepo.mockResolvedValue('op-nx/github-cache');
      vi.spyOn(process.stderr, 'write').mockReturnValue(true);
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(null, { status }),
      );
      const backend = createReleasesReadBackend(createReleasesReadClient({}));

      expect(await backend.get('abc123')).toEqual({ kind: 'miss' });
    },
  );

  it('degrades a rejected fetch (network throw) to a MISS through the backend (SRV-05)', async () => {
    mockToken.mockResolvedValue('ghs_faketoken');
    mockRepo.mockResolvedValue('op-nx/github-cache');
    vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(
      new TypeError('network down'),
    );
    const backend = createReleasesReadBackend(createReleasesReadClient({}));

    expect(await backend.get('abc123')).toEqual({ kind: 'miss' });
  });

  it('a 404 shard is a silent MISS through the backend: no stderr warning (D-11)', async () => {
    mockToken.mockResolvedValue('ghs_faketoken');
    mockRepo.mockResolvedValue('op-nx/github-cache');
    const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 404 }),
    );
    const backend = createReleasesReadBackend(createReleasesReadClient({}));

    const result = await backend.get('abc123');

    expect(result).toEqual({ kind: 'miss' });
    expect(stderr).not.toHaveBeenCalled();
  });

  it('a non-404 fault warns on stderr exactly once through the backend (SRV-05, D-11)', async () => {
    // The warned flag is module-level, so re-import a FRESH module (fresh flag) and
    // reconfigure the freshly-mocked resolvers, keeping the once-per-process
    // assertion independent of test order (mirrors the port warning tests above).
    vi.resetModules();
    const localContext = await import('../lib/local-context.js');
    vi.mocked(localContext.resolveLocalReadToken).mockResolvedValue(
      'ghs_faketoken',
    );
    vi.mocked(localContext.resolveRepoIdentity).mockResolvedValue(
      'op-nx/github-cache',
    );
    const {
      createReleasesReadBackend: freshBackend,
      createReleasesReadClient: freshClient,
    } = await import('./releases-backend.js');
    const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 500 }),
    );

    await freshBackend(freshClient({})).get('abc123');

    expect(stderr).toHaveBeenCalledTimes(1);
  });
});
