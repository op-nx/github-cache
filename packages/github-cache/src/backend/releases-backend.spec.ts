import { afterEach, describe, expect, it, vi } from 'vitest';
import { cachePlatform, releaseAssetName } from '../lib/release-asset-name.js';
import {
  createReleasesReadBackend,
  type ReleaseReadClient,
} from './releases-backend.js';

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

afterEach(() => {
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
    const { createReleasesReadBackend: freshBackend } = await import(
      './releases-backend.js'
    );
    const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    const backend = freshBackend(throwingClient);

    await backend.get('abc123');
    await backend.get('def456');

    expect(stderr).toHaveBeenCalledTimes(1);
  });

  it('never emits any credential-shaped material in the warning (T-03-03)', async () => {
    vi.resetModules();
    const { createReleasesReadBackend: freshBackend } = await import(
      './releases-backend.js'
    );
    const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    const backend = freshBackend(throwingClient);

    await backend.get('abc123');

    const written = stderr.mock.calls.map((call) => String(call[0])).join('');
    expect(written).not.toContain('ghs_leakedtokenvalue');
    expect(written).not.toContain('boom');
  });
});
