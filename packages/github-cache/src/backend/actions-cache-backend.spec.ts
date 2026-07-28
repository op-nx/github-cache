import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import * as cache from '@actions/cache';
import * as core from '@actions/core';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  CACHE_ARCHIVE_DIR,
  cacheArchivePath,
} from '../lib/cache-archive-path.js';
import { cacheKeyFor, type Hash } from '../lib/cache-key.js';
import { enterWorkspaceRootCwd } from '../test/workspace-root-cwd.js';
import { createActionsCacheBackend } from './actions-cache-backend.js';

// First module mock in this repository. @actions/cache only actually works inside
// a JS action on real CI, so every unit layer MUST mock it and prove the backend
// mapping against the recorded call arguments (02-RESEARCH.md "Don't Hand-Roll";
// the spec-file table in 02-PATTERNS.md notes module mocking has no in-repo
// precedent and must come from research). vi.mock hoists above the imports and
// auto-replaces each @actions/cache export with a vi.fn().
vi.mock('@actions/cache');

// @actions/core is mocked so the ambiguous-denial warning is spy-assertable and
// never touches a real workflow-command stream (D-14).
vi.mock('@actions/core', () => ({
  warning: vi.fn(),
}));

const restoreCache = vi.mocked(cache.restoreCache);
const saveCache = vi.mocked(cache.saveCache);
const warning = vi.mocked(core.warning);

const HASH = 'abc123' as Hash;

// VER-04's spec accommodation. This file constructs the REAL backend 16 times
// (:40,52,63,74,85,106,116,127,138,147,156,165,255,289,319,343 at the pre-Phase-9
// numbering), and VER-04's guard asserts the cwd IS the Nx workspace root -- which is
// FALSE under `nx test`, whose merged config carries `options.cwd:
// "packages/github-cache"`. The hook also mkdirs the archive directory, because the
// pre-write below runs BEFORE the construction that would create it.
//
// CENSUS CORRECTION, comment-locked rather than silently applied (the house pattern for a
// miscount, cf. lint-rules.spec.ts's ROADMAP SC3 lock): 09-RESEARCH.md's per-spec table
// says this file constructs the real backend 15 times and calls select-backend.spec.ts a
// "probably". Both are wrong. The real figures are 16 here plus 1 in serve.spec.ts = 17
// DIRECT constructions, and select-backend.spec.ts is CONFIRMED -- it mocks
// @actions/cache but NOT this module, so its 4 call sites (5 runtime invocations, one
// being an it.each of two) reach the real factory. 21 construction sites across THREE
// files. publish-mirror.spec.ts module-mocks the backend factory itself, so the guard
// never runs there and it must NOT get this hook.
let restoreCwd: () => void;

beforeAll(() => {
  restoreCwd = enterWorkspaceRootCwd();
});

afterAll(() => {
  restoreCwd();
});

afterEach(async () => {
  vi.resetAllMocks();
  await rm(cacheArchivePath(HASH), { force: true });
});

describe('createActionsCacheBackend get (ROBUST-03)', () => {
  it('returns a hit with the restored archive bytes when restoreCache matches a key (ROBUST-03)', async () => {
    const bytes = Buffer.from('tar-bytes');
    await writeFile(cacheArchivePath(HASH), bytes);
    restoreCache.mockResolvedValue(cacheKeyFor(HASH));
    const backend = createActionsCacheBackend();

    const result = await backend.get(HASH);

    expect(result).toEqual({ kind: 'hit', bytes });
  });

  it('removes the restored archive after a HIT so no cache bytes are left on a reused runner (WR-01, T-2-11)', async () => {
    // A real restoreCache recreates the archive on disk before get reads it;
    // simulate that here so the cleanup assertion below is non-vacuous.
    await writeFile(cacheArchivePath(HASH), Buffer.from('tar-bytes'));
    restoreCache.mockResolvedValue(cacheKeyFor(HASH));
    const backend = createActionsCacheBackend();

    expect(existsSync(cacheArchivePath(HASH))).toBe(true);

    await backend.get(HASH);

    expect(existsSync(cacheArchivePath(HASH))).toBe(false);
  });

  it('returns a miss when restoreCache resolves undefined (ROBUST-03)', async () => {
    restoreCache.mockResolvedValue(undefined);
    const backend = createActionsCacheBackend();

    const result = await backend.get(HASH);

    expect(result).toEqual({ kind: 'miss' });
  });
});

describe('createActionsCacheBackend put (ROBUST-03)', () => {
  it('returns "stored" on a positive saveCache id (ROBUST-03)', async () => {
    saveCache.mockResolvedValue(42);
    const backend = createActionsCacheBackend();

    const result = await backend.put(HASH, Buffer.from('tar-bytes'));

    expect(result).toBe('stored');
  });

  it('returns "stored" when saveCache resolves -1 AND a lookupOnly probe confirms the entry exists (benign already-exists, D-04) (ROBUST-03)', async () => {
    saveCache.mockResolvedValue(-1);
    // The -1 probe finds the entry present -> benign already-exists.
    restoreCache.mockResolvedValue(cacheKeyFor(HASH));
    const backend = createActionsCacheBackend();

    const result = await backend.put(HASH, Buffer.from('tar-bytes'));

    expect(result).toBe('stored');
    // The probe must be a lookupOnly (no-download) existence check -- and, since VER-03,
    // must carry enableCrossOsArchive at the 5th positional like every other call site.
    // The trailing `true` is not decoration here: toHaveBeenCalledWith is an EXACT
    // argument-list match, so omitting it would make this D-04 assertion contradict
    // VER-03 clause 1's whole-array pin below. D-10 is why they must agree.
    expect(restoreCache).toHaveBeenCalledWith(
      [cacheArchivePath(HASH)],
      cacheKeyFor(HASH),
      [],
      { lookupOnly: true },
      true,
    );
  });

  // The real trigger is a base-scope read-only PR activity type (for example
  // `pull_request` `[closed]`), NOT "all fork PRs" -- an ordinary fork PR writes its
  // own isolated scope and succeeds.
  it('returns "conflict" when saveCache resolves -1 but no entry exists, so an ambiguous denial answers 409 rather than 500 (ADR C1, D-04) (ROBUST-03)', async () => {
    saveCache.mockResolvedValue(-1);
    // The -1 probe finds nothing -> the -1 was a swallowed fault or a scope denial.
    restoreCache.mockResolvedValue(undefined);
    const backend = createActionsCacheBackend();

    const result = await backend.put(HASH, Buffer.from('tar-bytes'));

    expect(result).toBe('conflict');
  });

  it('emits exactly one warning naming the cache key on the ambiguous-denial branch (OBS-01) (ROBUST-03)', async () => {
    saveCache.mockResolvedValue(-1);
    restoreCache.mockResolvedValue(undefined);
    const backend = createActionsCacheBackend();

    await backend.put(HASH, Buffer.from('tar-bytes'));

    expect(warning).toHaveBeenCalledTimes(1);
    expect(warning.mock.calls[0][0]).toContain(cacheKeyFor(HASH));
  });

  it('still removes the temp archive on the ambiguous-denial branch (T-2-11) (ROBUST-03)', async () => {
    saveCache.mockResolvedValue(-1);
    restoreCache.mockResolvedValue(undefined);
    const backend = createActionsCacheBackend();

    await backend.put(HASH, Buffer.from('tar-bytes'));

    expect(existsSync(cacheArchivePath(HASH))).toBe(false);
  });

  it('returns "stored" when saveCache rejects with a ReserveCacheError (benign no-op, D-04) (ROBUST-03)', async () => {
    const reserveConflict = new Error('cache already reserved');
    reserveConflict.name = 'ReserveCacheError';
    saveCache.mockRejectedValue(reserveConflict);
    const backend = createActionsCacheBackend();

    const result = await backend.put(HASH, Buffer.from('tar-bytes'));

    expect(result).toBe('stored');
  });

  it('propagates any other saveCache rejection so the server fails closed (ROBUST-03)', async () => {
    saveCache.mockRejectedValue(new Error('network down'));
    const backend = createActionsCacheBackend();

    await expect(backend.put(HASH, Buffer.from('tar-bytes'))).rejects.toThrow(
      'network down',
    );
  });

  it('removes the temp archive after put on the success path (ROBUST-03)', async () => {
    saveCache.mockResolvedValue(42);
    const backend = createActionsCacheBackend();

    await backend.put(HASH, Buffer.from('tar-bytes'));

    expect(existsSync(cacheArchivePath(HASH))).toBe(false);
  });

  it('removes the temp archive after put on the propagating-error path (ROBUST-03)', async () => {
    saveCache.mockRejectedValue(new Error('network down'));
    const backend = createActionsCacheBackend();

    await expect(backend.put(HASH, Buffer.from('tar-bytes'))).rejects.toThrow();

    expect(existsSync(cacheArchivePath(HASH))).toBe(false);
  });
});

// A deferred lets a test drive settle order deterministically -- no timers.
function deferred<T>() {
  let resolve!: (value: T) => void;

  const promise = new Promise<T>((res) => {
    resolve = res;
  });

  return { promise, resolve };
}

/**
 * Records entry into a mock and lets a test await a specific entry count -- no
 * timers, so it cannot be starved by CPU contention the way a fixed setTimeout(0)
 * `tick()` can (that flaked once under parallel load). `mark()` is called from the
 * mock body; `reached(n)` resolves the instant the count hits n, or immediately if
 * it already has.
 */
function entryTracker() {
  const order: string[] = [];
  const waiters = new Map<number, () => void>();

  function mark(label: string): void {
    order.push(label);
    waiters.get(order.length)?.();
  }

  function reached(n: number): Promise<void> {
    if (order.length >= n) {
      return Promise.resolve();
    }

    const gate = deferred<void>();
    waiters.set(n, gate.resolve);

    return gate.promise;
  }

  /**
   * Assert that NO further entry appears after the current count settles. Awaits a
   * bounded number of microtask turns; if an unexpected entry were going to slip in
   * (the lock failing to hold), it would have by then. This is the one place a
   * timer-free "nothing else happened" check needs a settle window -- kept as
   * microtask flushes, not a wall-clock delay.
   */
  async function stableAt(n: number): Promise<void> {
    for (let i = 0; i < 50; i++) {
      await Promise.resolve();
    }

    if (order.length !== n) {
      throw new Error(
        `expected the entry count to stay ${n}, saw ${order.length}: ${order.join(',')}`,
      );
    }
  }

  return { order, mark, reached, stableAt };
}

describe('createActionsCacheBackend serializes same-hash operations (TEST-02, Pitfall 7)', () => {
  // These live HERE, not in serve.spec.ts, because the lock moved to the module
  // that owns the shared deterministic archive path. serve() no longer wraps put,
  // so a fake writable backend behind serve() is no longer serialized at all.
  const LOCK_A = 'aa11bb' as Hash;
  const LOCK_B = 'cc22dd' as Hash;

  afterEach(async () => {
    await rm(cacheArchivePath(LOCK_A), { force: true });
    await rm(cacheArchivePath(LOCK_B), { force: true });
  });

  it('does not interleave two concurrent same-hash gets -- the second starts only after the first settles (TEST-02)', async () => {
    const tracker = entryTracker();
    const gates: Array<(value: string | undefined) => void> = [];
    restoreCache.mockImplementation(() => {
      tracker.mark('restore');
      const gate = deferred<string | undefined>();
      gates.push(gate.resolve);

      return gate.promise;
    });
    const backend = createActionsCacheBackend();

    const first = backend.get(LOCK_A);
    await tracker.reached(1);

    const second = backend.get(LOCK_A);

    // Non-vacuous: WITHOUT the lock the second get would enter restoreCache too;
    // stableAt(1) proves it does NOT until the first settles.
    await tracker.stableAt(1);

    gates[0](undefined);
    await first;
    await tracker.reached(2);

    expect(tracker.order).toEqual(['restore', 'restore']);

    gates[1](undefined);
    await second;
  });

  it('does not interleave a same-hash get and put -- the pair the shared archive path actually races (TEST-02, Pitfall 7)', async () => {
    const tracker = entryTracker();
    const saveGate = deferred<number>();
    saveCache.mockImplementation(() => {
      tracker.mark('save');

      return saveGate.promise;
    });
    restoreCache.mockImplementation(async () => {
      tracker.mark('restore');

      return undefined;
    });
    const backend = createActionsCacheBackend();

    const put = backend.put(LOCK_A, Buffer.from('tar-bytes'));
    await tracker.reached(1);

    const get = backend.get(LOCK_A);

    // The get is queued BEHIND the in-flight put: its restoreCache has not run, so
    // its `rm` cannot delete the archive saveCache is still reading.
    await tracker.stableAt(1);
    expect(tracker.order).toEqual(['save']);

    saveGate.resolve(42);
    await expect(put).resolves.toBe('stored');
    await tracker.reached(2);

    expect(tracker.order).toEqual(['save', 'restore']);
    await expect(get).resolves.toEqual({ kind: 'miss' });
  });

  it('still runs distinct hashes concurrently (TEST-02)', async () => {
    const tracker = entryTracker();
    const gates: Array<(value: string | undefined) => void> = [];
    restoreCache.mockImplementation(() => {
      tracker.mark('restore');
      const gate = deferred<string | undefined>();
      gates.push(gate.resolve);

      return gate.promise;
    });
    const backend = createActionsCacheBackend();

    const a = backend.get(LOCK_A);
    const b = backend.get(LOCK_B);

    // BOTH gets reach restoreCache before EITHER gate is released -- if distinct
    // hashes were serialized, reached(2) would never resolve and this would hang.
    await tracker.reached(2);

    gates[0](undefined);
    gates[1](undefined);
    await Promise.all([a, b]);
  });
});

describe('createActionsCacheBackend path + key agreement (ROBUST-03)', () => {
  // Non-vacuous: the assertion below compares the RECORDED first argument of both
  // toolkit calls to each other AND to cacheArchivePath(hash) imported from the
  // helper -- so it fails if save and restore ever pass different path strings,
  // which is the silent-MISS class this backend's single-source rule exists to
  // prevent (Pitfall 7).
  it('passes exactly cacheArchivePath(hash) as the single path to both restoreCache and saveCache, with the same key (ROBUST-03)', async () => {
    restoreCache.mockResolvedValue(undefined);
    saveCache.mockResolvedValue(42);
    const backend = createActionsCacheBackend();

    await backend.get(HASH);
    await backend.put(HASH, Buffer.from('tar-bytes'));

    const restorePaths = restoreCache.mock.calls[0][0];
    const savePaths = saveCache.mock.calls[0][0];

    expect(restorePaths).toEqual([cacheArchivePath(HASH)]);
    expect(savePaths).toEqual(restorePaths);
    expect(restoreCache.mock.calls[0][1]).toBe(cacheKeyFor(HASH));
    expect(saveCache.mock.calls[0][1]).toBe(cacheKeyFor(HASH));
  });
});

describe('enableCrossOsArchive is hardcoded true at all three call sites (VER-03 clause 1)', () => {
  // The WHOLE recorded argument array per site, never `.mock.calls[0][0]` one index at a
  // time -- that shape pins positions 0 and 1 and says NOTHING about positions 2-4, which
  // is exactly where the flag lives. The test above is the position-0/1 agreement check
  // and it stays; this one is the positional pin.
  //
  // toStrictEqual, and the reason is NOT the one it is natural to assume -- MEASURED
  // against vitest 4.1.10 rather than reasoned about, because the plausible version of
  // this claim is false and would have shipped as an authoritative comment.
  //
  // The assumption to avoid: "toEqual treats a trailing undefined as absent, so it would
  // ACCEPT a shorter array whose missing tail is the flag." It would NOT. toEqual runs
  // `equals` with `hasDefinedKey` (@vitest/expect/dist/index.js:213,408), which compares
  // the COUNT of defined keys and then each value -- so dropping the flag changes that
  // count and fails, and `iterableEquality` catches an extra trailing undefined too. All
  // eight shapes this clause could see (flag correct / omitted / omitted-with-undefined
  // tail / in options' slot / extra trailing arg, across the three sites) were probed
  // directly: toEqual and toStrictEqual returned the SAME verdict on every one.
  //
  // So toStrictEqual is kept for what it genuinely adds -- type/class identity and
  // sparse-array holes -- and NOT because it is stronger on these particular shapes. The
  // real load-bearing choice in this test is asserting the WHOLE array instead of
  // indexing single positions; that is what pins the flag's index, under either matcher.
  it('passes the flag at the 5th positional for the read, the 4th for the write and the 5th for the lookupOnly probe (VER-03, D-09, D-10)', async () => {
    const path = cacheArchivePath(HASH);
    const key = cacheKeyFor(HASH);
    // get MISSes, then put takes the ambiguous -1 branch whose probe finds the entry
    // present. One test drives all THREE sites, which is also the only path with two
    // restoreCache calls.
    restoreCache.mockResolvedValueOnce(undefined).mockResolvedValueOnce(key);
    saveCache.mockResolvedValue(-1);
    const backend = createActionsCacheBackend();

    await backend.get(HASH);

    await expect(backend.put(HASH, Buffer.from('tar-bytes'))).resolves.toBe(
      'stored',
    );

    // read (actions-cache-backend.ts get): restoreCache's real signature is
    // (paths, primaryKey, restoreKeys?, options?, enableCrossOsArchive?), so the flag is
    // the 5TH positional. Positions 2 and 3 must be FILLED -- this is a real code change,
    // not an appended argument.
    expect(restoreCache.mock.calls[0]).toStrictEqual([
      [path],
      key,
      undefined,
      undefined,
      true,
    ]);

    // write: saveCache's real signature is (paths, key, options?, enableCrossOsArchive?),
    // so the flag is the 4TH positional and position 2 (options) must be filled. Upstream's
    // JSDoc documents enableCrossOsArchive BEFORE options -- see the comment lock at the
    // call site; a reader who trusts the JSDoc puts the flag in options' slot and it
    // silently becomes an options object.
    expect(saveCache.mock.calls[0]).toStrictEqual([
      [path],
      key,
      undefined,
      true,
    ]);

    // lookupOnly probe: 5TH positional, and here the flag is a pure APPEND -- which makes
    // this the site most likely to be the only one done right, and the one most likely to
    // be forgotten. D-10: it MUST carry the flag, because probing at a different cache
    // version than the save reports "absent" for a PRESENT entry and turns every Windows
    // write into a spurious 409.
    expect(restoreCache.mock.calls[1]).toStrictEqual([
      [path],
      key,
      [],
      { lookupOnly: true },
      true,
    ]);

    // The -1 path is the only one with two restoreCache calls, so the counts are pinned
    // here rather than in a test where a swallowed extra call would be invisible.
    expect(restoreCache).toHaveBeenCalledTimes(2);
    expect(saveCache).toHaveBeenCalledTimes(1);
  });
});

// The six-line comment-strip helper is DUPLICATED here rather than extracted, and that is
// deliberate: .planning/codebase/TESTING.md reserves the package-source root for facts
// spanning multiple files, and this is a fact about ONE module -- as is the VER-02 scan in
// cache-archive-path.spec.ts. The repo already carries this idiom three times for exactly
// that reason (lint-scope-drift.spec.ts, cleanup-workflow.spec.ts, ppe-action.spec.ts).
//
// All four markers are dropped, not just `//`: this module's call-site locks are `//` lines
// but its module header is a `/** */` block, whose interior lines begin with `*`.
const BACKEND_COMMENT_MARKERS = ['//', '/*', '*/', '*'] as const;

const strippedBackendSource = readFileSync(
  new URL('./actions-cache-backend.ts', import.meta.url),
  'utf8',
)
  .split('\n')
  .filter(
    (line) =>
      !BACKEND_COMMENT_MARKERS.some((marker) => line.trim().startsWith(marker)),
  )
  .join('\n');

describe('the module reaches @actions/cache at exactly three places (VER-03 clause 2)', () => {
  // Clause 1 above only sees sites the specs EXECUTE. This clause sees a fourth site on a
  // branch no spec reaches -- which is invisible to a mock-call count, because the count
  // stays at whatever the exercised paths produce. Both clauses live in this one file so a
  // reader sees immediately that neither is sufficient alone.
  it('accesses exactly the ordered members restoreCache, saveCache, restoreCache (VER-03)', () => {
    const members = [
      ...strippedBackendSource.matchAll(/\bcache\.([A-Za-z_$][\w$]*)/g),
    ].map((match) => match[1]);

    // ORDERED, and identities pinned -- never a bare `=== 3`. Source order proves the
    // probe is a restoreCache rather than a second saveCache, and a count alone is
    // satisfied by a module that DELETED saveCache and added two probes (Phase 8 D-23:
    // assert on content, never on a bare count a deletion satisfies).
    expect(members).toStrictEqual([
      'restoreCache',
      'saveCache',
      'restoreCache',
    ]);
  });

  it('imports @actions/cache exactly once, in the NAMESPACE form (VER-03)', () => {
    const imports = (
      strippedBackendSource.match(/import[^;]*'@actions\/cache';/g) ?? []
    ).map((statement) => statement.replace(/\s+/g, ' ').trim());

    // Closes the member scan's one evasion: a future
    // `import { saveCache } from '@actions/cache'` reaches the library with NO `cache.`
    // prefix and is invisible to the assertion above. Equality pins the count and the form
    // together.
    expect(imports).toStrictEqual(["import * as cache from '@actions/cache';"]);
  });
});

describe('createActionsCacheBackend asserts the cwd/GITHUB_WORKSPACE conjunction at construction (VER-04) and creates the archive directory (VER-07)', () => {
  // A throwaway workspace under the ROOT .nx/cache, which is gitignored (.gitignore:41
  // covers `.nx/cache` specifically, not `.nx/` wholesale) and invisible to Nx's file map
  // at any depth (MEASURED, with a positive control that DID move the hash). So the fixture
  // leaves no `git status` entry and perturbs no task hash.
  //
  // The relative `mkdtempSync` prefix is load-bearing: reaching for a temp directory
  // through the platform module would introduce a NEW LINT-02 error position, and Phase 7's
  // CORR_05_SITES doc block records that there are none left to add -- it would be a fresh
  // CORR-05-class violation that Phase 10 does not know about. It also depends on the chdir
  // hook having already run, which is why it is created in a nested beforeAll.
  let fixtureRoot: string;
  let fixtureAbsolute: string;
  let siblingAbsolute: string;
  let workspaceRoot: string;

  beforeAll(() => {
    workspaceRoot = process.cwd();
    fixtureRoot = mkdtempSync('.nx/cache/ver04-');
    fixtureAbsolute = resolve(fixtureRoot);
    siblingAbsolute = resolve(mkdtempSync('.nx/cache/ver04-sibling-'));
    // An empty object is sufficient -- the guard's first conjunct is an EXISTENCE check.
    writeFileSync(`${fixtureRoot}/nx.json`, '{}');
  });

  afterAll(() => {
    process.chdir(workspaceRoot);
    rmSync(fixtureAbsolute, { recursive: true, force: true });
    rmSync(siblingAbsolute, { recursive: true, force: true });
  });

  afterEach(() => {
    // Symmetrical, and it runs even when the construction under test threw.
    process.chdir(workspaceRoot);
    vi.unstubAllEnvs();
  });

  // GITHUB_WORKSPACE MUST be neutralised here or these tests pass locally and fail on CI:
  // the `test` job on a runner has GITHUB_WORKSPACE set to the REAL workspace root, which
  // is not the fixture, so the second conjunct would throw in the happy-path case. The stub
  // exists for CI-invariance, not for local convenience.
  it('does not throw at the fixture root with GITHUB_WORKSPACE unset (VER-04 happy path)', () => {
    vi.stubEnv('GITHUB_WORKSPACE', undefined);
    process.chdir(fixtureAbsolute);

    expect(() => createActionsCacheBackend()).not.toThrow();
  });

  it('THROWS naming the workspace-root condition when the cwd has no nx.json (VER-04 conjunct 1)', () => {
    vi.stubEnv('GITHUB_WORKSPACE', undefined);
    // The sibling fixture deliberately has no nx.json.
    process.chdir(siblingAbsolute);

    expect(() => createActionsCacheBackend()).toThrow(/nx\.json/);
  });

  it('THROWS naming the divergence when GITHUB_WORKSPACE points at a sibling directory (VER-04 conjunct 2)', () => {
    vi.stubEnv('GITHUB_WORKSPACE', siblingAbsolute);
    process.chdir(fixtureAbsolute);

    expect(() => createActionsCacheBackend()).toThrow(/GITHUB_WORKSPACE/);
  });

  // Asserting the THROWs above, not only the happy path, is the point: a VER-04 suite that
  // still passes with the guard deleted is the failure mode.
  it('creates the archive directory at construction when it is absent (VER-07)', () => {
    vi.stubEnv('GITHUB_WORKSPACE', undefined);
    process.chdir(fixtureAbsolute);
    // Removed FIRST -- otherwise the assertion passes against a directory that was already
    // there and proves nothing. This is the FIXTURE's own nested .nx/cache; the real
    // workspace .nx/cache is Nx's live cache and the running `test` task's own storage, and
    // no test in this plan removes it.
    rmSync(CACHE_ARCHIVE_DIR, { recursive: true, force: true });

    expect(existsSync(CACHE_ARCHIVE_DIR)).toBe(false);

    createActionsCacheBackend();

    expect(existsSync(CACHE_ARCHIVE_DIR)).toBe(true);
  });
});
