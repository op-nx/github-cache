import { rm } from 'node:fs/promises';
import * as cache from '@actions/cache';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cacheArchivePath } from './cache-archive-path.js';
import { resolveLocalReadToken, resolveRepoIdentity } from './local-context.js';
import type { Hash } from './cache-key.js';
import { resolveGitHubToken } from './github-identity.js';
import { releaseAssetName } from './release-asset-name.js';
import { selectBackend } from './select-backend.js';

// @actions/cache only actually works inside a JS action on real CI, so the
// writable-path cases below (which drive the returned backend's put) must mock
// it -- exactly as actions-cache-backend.spec.ts does. Auto-mock hoists above the
// imports and replaces every export with a vi.fn().
vi.mock('@actions/cache');

// The local/untrusted branch now returns the REAL Releases reader (D-01), whose
// default client resolves the developer's token and repo identity via local-context
// (subprocess-backed on a real machine). Mock that module so this unit layer never
// spawns gh/git, touches a keychain, or reaches api.github.com -- and so CI stays
// green on a runner with no gh installed. Resolvers default to undefined here, which
// makes the local branch's get MISS with zero network (D-09/D-11).
vi.mock('./local-context.js');

const saveCache = vi.mocked(cache.saveCache);

// A hash UNIQUE to this spec: the writable-path cases drive the Actions backend's
// put, which writes cacheArchivePath(HASH) to the shared tmpdir. Vitest runs spec
// files in parallel workers that share the filesystem, so reusing another spec's
// hash (e.g. actions-cache-backend.spec.ts's 'abc123') would race on the same
// temp file. Keep this value distinct from every other spec's hash.
const HASH = 'selectbackendfixture' as Hash;
const BYTES = Buffer.from('tar-bytes');

// A well-formed trusted CI context: Actions on, a trusted event, a valid
// owner/name repo, and a resolvable token. Individual tests spread over this to
// vary exactly one axis so a failure names the axis that broke.
const trusted = {
  GITHUB_ACTIONS: 'true',
  GITHUB_EVENT_NAME: 'push',
  GITHUB_REPOSITORY: 'op-nx/github-cache',
  GH_TOKEN: 'ghs_token',
} satisfies NodeJS.ProcessEnv;

beforeEach(() => {
  // A writable put maps to saveCache; a positive id resolves to 'stored'. This
  // keeps the writable-path assertions off the network and deterministic.
  saveCache.mockResolvedValue(1);
});

afterEach(async () => {
  vi.resetAllMocks();
  await rm(cacheArchivePath(HASH), { force: true });
});

describe('selectBackend context selection (TEST-01, TRUST-05)', () => {
  it('CI + push yields a writable backend whose put is not forbidden (TEST-01)', async () => {
    const backend = selectBackend({ ...trusted, GITHUB_EVENT_NAME: 'push' });

    const result = await backend.put(HASH, BYTES);

    expect(result).not.toBe('forbidden');
  });

  it('CI + schedule yields a writable backend whose put is not forbidden (TEST-01)', async () => {
    const backend = selectBackend({
      ...trusted,
      GITHUB_EVENT_NAME: 'schedule',
    });

    const result = await backend.put(HASH, BYTES);

    expect(result).not.toBe('forbidden');
  });

  // Assert the DECISION behaviorally (drive put and read the PutResult variant),
  // not by identity against a factory, so the test still means something if the
  // factories are later swapped. pull_request and release are NO LONGER here --
  // they are host-gated (TRUST-01) and covered in the widening describe below.
  // The remaining entries are the dangerous trio + workflow_dispatch: never in
  // any write allowlist, so a guarded github.com host must NOT rescue them.
  it.each([
    'pull_request_target',
    'issue_comment',
    'workflow_run',
    'workflow_dispatch',
  ])(
    'CI + %s yields a read-only backend whose put is forbidden even on a github.com host (TEST-01, TRUST-01, Pitfall 1)',
    async (event) => {
      // Non-vacuous: the guarded host is PRESENT, so a passing 'forbidden' proves
      // the host did not rescue a dangerous/unlisted event (it is in neither
      // write allowlist -> default-deny regardless of host).
      const backend = selectBackend({
        ...trusted,
        GITHUB_EVENT_NAME: event,
        GITHUB_SERVER_URL: 'https://github.com',
      });

      expect(await backend.put(HASH, BYTES)).toBe('forbidden');
    },
  );

  it('CI with the triggering event unset yields a read-only backend (TEST-01)', async () => {
    const noEvent = {
      GITHUB_ACTIONS: 'true',
      GITHUB_REPOSITORY: 'op-nx/github-cache',
      GH_TOKEN: 'ghs_token',
    };

    const backend = selectBackend(noEvent);

    expect(await backend.put(HASH, BYTES)).toBe('forbidden');
  });

  it('a local developer machine (no GITHUB_ACTIONS) yields a read-only backend: put forbidden and get misses (TEST-01)', async () => {
    // The local branch now returns the REAL Releases reader. local-context is mocked
    // (top of file) so its resolvers yield undefined -- fetchAsset returns before any
    // request, so get MISSES with zero spawn and zero network (D-09/D-11). This keeps
    // the unit layer off a real keychain/gh/git/api.github.com and green on CI.
    const backend = selectBackend({ GITHUB_REPOSITORY: 'op-nx/github-cache' });

    expect(await backend.put(HASH, BYTES)).toBe('forbidden');
    expect(await backend.get(HASH)).toEqual({ kind: 'miss' });
  });

  it('wires the REAL Releases reader into the local branch: a hit flows through with mocked resolvers + fetch (D-01, FOUND-02)', async () => {
    // Non-vacuous: this would FAIL against the old createReadOnlyMemoryBackend
    // placeholder (its store is empty, so get always missed). A hit here proves the
    // local branch now constructs the real reader wired to the real default client,
    // and that selectBackend stayed synchronous -- the async token/repo resolution
    // ran at get-time inside fetchAsset, not at construction (TRUST-05).
    vi.mocked(resolveLocalReadToken).mockResolvedValue('ghs_faketoken');
    vi.mocked(resolveRepoIdentity).mockResolvedValue('op-nx/github-cache');
    const assetName = releaseAssetName(HASH);
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 7 }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ id: 42, name: assetName }]), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(Buffer.from('hit-bytes'), { status: 200 }),
      );

    const backend = selectBackend({ GITHUB_REPOSITORY: 'op-nx/github-cache' });
    const result = await backend.get(HASH);

    expect(result).toEqual({ kind: 'hit', bytes: Buffer.from('hit-bytes') });
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it('never mutates process.env -- every case is driven by the explicit env argument (TEST-01)', () => {
    const before = JSON.stringify(process.env);

    selectBackend({ GITHUB_REPOSITORY: 'op-nx/github-cache' });
    selectBackend({ ...trusted });

    expect(JSON.stringify(process.env)).toBe(before);
  });
});

describe('selectBackend host-gated widening flows through isWriteTrusted (TRUST-01)', () => {
  // The widening lives entirely in trust.ts; selectBackend threads the full env
  // bag into isWriteTrusted unchanged, so pull_request/release now reach the
  // writable backend on a guarded host and stay read-only on a GHES host --
  // end-to-end proof that Task 1's gate flows through the selection point.
  it.each(['pull_request', 'release'])(
    'CI + %s on a github.com host yields a writable backend whose put is not forbidden (TRUST-01)',
    async (event) => {
      const backend = selectBackend({
        ...trusted,
        GITHUB_EVENT_NAME: event,
        GITHUB_SERVER_URL: 'https://github.com',
      });

      expect(await backend.put(HASH, BYTES)).not.toBe('forbidden');
    },
  );

  it.each(['pull_request', 'release'])(
    'CI + %s on a GHES host yields a read-only backend whose put is forbidden (fail-closed, TRUST-01)',
    async (event) => {
      const backend = selectBackend({
        ...trusted,
        GITHUB_EVENT_NAME: event,
        GITHUB_SERVER_URL: 'https://ghes.example.com',
      });

      expect(await backend.put(HASH, BYTES)).toBe('forbidden');
    },
  );
});

describe('selectBackend fail-closed repository validation (TEST-01)', () => {
  it('throws in trusted context when GITHUB_REPOSITORY is absent (TEST-01)', () => {
    const env = {
      GITHUB_ACTIONS: 'true',
      GITHUB_EVENT_NAME: 'push',
      GH_TOKEN: 'ghs_token',
    };

    expect(() => selectBackend(env)).toThrow(/selectBackend/);
  });

  it('throws in trusted context when GITHUB_REPOSITORY has no owner/name slash (TEST-01)', () => {
    expect(() =>
      selectBackend({ ...trusted, GITHUB_REPOSITORY: 'not-a-repo' }),
    ).toThrow(/GITHUB_REPOSITORY/);
  });

  it('throws in trusted context when GITHUB_REPOSITORY has an empty name segment (TEST-01)', () => {
    expect(() =>
      selectBackend({ ...trusted, GITHUB_REPOSITORY: 'owner/' }),
    ).toThrow(/GITHUB_REPOSITORY/);
  });

  it('degrades to a read-only backend (does NOT throw) in trusted context with no resolvable token (TEST-01)', async () => {
    const env = {
      GITHUB_ACTIONS: 'true',
      GITHUB_EVENT_NAME: 'push',
      GITHUB_REPOSITORY: 'op-nx/github-cache',
    };

    const backend = selectBackend(env);

    expect(await backend.put(HASH, BYTES)).toBe('forbidden');
  });

  it('degrades to a read-only backend when the only token present is set-but-empty (TEST-01)', async () => {
    const env = {
      GITHUB_ACTIONS: 'true',
      GITHUB_EVENT_NAME: 'push',
      GITHUB_REPOSITORY: 'op-nx/github-cache',
      GH_TOKEN: '',
      GITHUB_TOKEN: '',
    };

    const backend = selectBackend(env);

    expect(await backend.put(HASH, BYTES)).toBe('forbidden');
  });
});

describe('resolveGitHubToken fallthrough (TEST-01)', () => {
  it('prefers GH_TOKEN over GITHUB_TOKEN (TEST-01)', () => {
    expect(resolveGitHubToken({ GH_TOKEN: 'a', GITHUB_TOKEN: 'b' })).toBe('a');
  });

  it('falls through a set-but-EMPTY GH_TOKEN to GITHUB_TOKEN (|| not ??, Pitfall 8) (TEST-01)', () => {
    // If the impl used `??`, the empty string would bind and shadow GITHUB_TOKEN,
    // producing '' instead of 'b'. The || operator is load-bearing here.
    expect(resolveGitHubToken({ GH_TOKEN: '', GITHUB_TOKEN: 'b' })).toBe('b');
  });

  it('resolves GITHUB_TOKEN when GH_TOKEN is absent (TEST-01)', () => {
    expect(resolveGitHubToken({ GITHUB_TOKEN: 'b' })).toBe('b');
  });

  it('resolves undefined when neither token is present (TEST-01)', () => {
    expect(resolveGitHubToken({})).toBeUndefined();
  });
});

describe('TRUST-05: no caller-facing mode surface', () => {
  it('structural: selectBackend.length is 0 -- its single declared parameter has a default (TRUST-05)', () => {
    // Non-vacuous: Function.length counts parameters BEFORE the first default.
    // selectBackend declares exactly one parameter (env) and it carries a default
    // (= process.env), so length is 0 -- a caller has no required argument and no
    // second parameter to pass. If someone added a `mode`/options parameter to
    // request the writable backend, this count would change and the test fails.
    expect(selectBackend.length).toBe(0);
  });

  it('behavioral: an untrusted env bag carrying override-shaped extra keys still yields a forbidden put (TRUST-05)', async () => {
    // Non-vacuous: NOT an identity check against a factory (a smuggled flag could
    // pass that while still returning the writable backend). We spread several
    // plausible mode-switch keys onto an UNTRUSTED env and drive the REAL put; if
    // any of them could steer the decision, put would not be 'forbidden'. This
    // repo has already shipped a tautological security test (01-REVIEW.md WR-01);
    // this half exists so that failure mode cannot recur for TRUST-05.
    //
    // Under TRUST-01 widening pull_request became host-gated, so it would be
    // WRITABLE on a github.com host and no longer prove the point. Use
    // pull_request_target: refused on EVERY host (dangerous trio), even with a
    // guarded GITHUB_SERVER_URL present, so this stays a real untrusted example.
    const env = {
      GITHUB_ACTIONS: 'true',
      GITHUB_EVENT_NAME: 'pull_request_target', // refused on every host
      GITHUB_SERVER_URL: 'https://github.com', // guarded host must NOT rescue it
      GITHUB_REPOSITORY: 'op-nx/github-cache',
      GH_TOKEN: 'ghs_token',
      MODE: 'write',
      FORCE_WRITABLE: 'true',
      NX_CACHE_MODE: 'rw',
      writable: 'true',
      readOnly: 'false',
    };

    const backend = selectBackend(env);

    expect(await backend.put(HASH, BYTES)).toBe('forbidden');
  });
});
