import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveCompressionMethod } from './compression-method.js';

/**
 * VER-05. `resolveCompressionMethod` is an independent re-implementation of
 * `@actions/cache`'s `getCompressionMethod` (`lib/internal/cacheUtils.js:100-136`,
 * version 6.2.0), which is unreachable through that package's exports map. The
 * value it derives is a cache-VERSION component -- pushed unconditionally at
 * `cacheUtils.js:163`, before and independent of the `enableCrossOsArchive` branch
 * at `:166` -- so the flag 09-03 hardcoded cannot rescue a mismatch here. A probe
 * that reports `gzip` where the library computed `zstd` is worse than no probe at
 * all: it sends the next reader looking in the wrong place.
 *
 * ## The seam is `node:child_process`, and it cannot be anywhere else
 *
 * The repo's established spec seam for a sibling leaf is a MODULE-level mock of
 * that leaf (`local-context.spec.ts`, `select-backend.spec.ts:24`). That precedent
 * is the nearest thing available and it is NOT sufficient here: module-mocking
 * `compression-method.ts` would replace the very branch under test, so every
 * assertion below would be asserting the fixture. The only seam that leaves the
 * derivation intact while making its one input controllable is the child-process
 * boundary, so `node:child_process` is mocked and `spawnSync`'s RESULT is the
 * fixture. There is no in-repo precedent for a child-process fixture; this file is
 * the first.
 *
 * ## Why `spawnSync`, and not `spawn`
 *
 * The exit code is STRUCTURALLY never consulted -- `status` is simply not read --
 * which is a stronger property than "we chose not to read it" and survives a later
 * tidy that a comment would not. An ENOENT result carries
 * `{ error, status: null, stdout: null, stderr: null }`, so coalescing both streams
 * to `''` yields `gzip` with no listener wiring and no `'error'` event to forget,
 * byte-for-byte the behaviour of upstream's caught throw. And there is no promise,
 * so there is no promise to leave unsettled.
 *
 * ## `promisify(execFile)` is ACTIVELY WRONG here and must never be substituted
 *
 * It REJECTS on a non-zero exit, and the child's output is then only reachable as
 * `error.stdout` / `error.stderr`. So the idiomatic `.catch(() => '')` reports
 * `gzip` for a broken-but-present zstd -- the exact inversion VER-05 exists to
 * forbid, arrived at by writing the natural thing. Case 4 below is the control that
 * catches it. Plain callback `execFile` is merely a trap rather than wrong (it
 * delivers `stdout`/`stderr` alongside `err`, so the correct implementation has to
 * ignore `err` deliberately) and additionally imposes a 1 MiB `maxBuffer` default
 * that upstream does not have.
 *
 * ## Recorded deviation from D-14's wording
 *
 * D-14 says "use `spawn` directly". This uses `spawnSync`, and the deviation is
 * RECORDED rather than silent (09-RESEARCH Q6, correction C-02). D-14's
 * load-bearing content is (i) do NOT reuse `local-context.ts`'s `runHelper` and
 * (ii) borrow `shell: false` + `windowsHide: true`. `spawnSync` preserves both, and
 * `runHelper` remains rejected for the two axes it inverts:
 * `local-context.ts:85-86` attaches no stderr listener, and `:94-104` resolves
 * `undefined` on any non-zero exit. Either one alone would report `gzip` in
 * precisely the case VER-05 names.
 */
vi.mock('node:child_process', () => ({ spawnSync: vi.fn() }));

const spawnSyncMock = vi.mocked(spawnSync);

/**
 * Build a `spawnSync` outcome carrying only the four fields the observable contract
 * can see. The cast is load-bearing rather than lazy: `@types/node` declares
 * `SpawnSyncReturns<T>` with `stdout: T` and `stderr: T` NON-nullable
 * (`child_process.d.ts:1335-1343`), yet the real ENOENT result carries
 * `stdout: null` and `stderr: null`. The declaration cannot express the shape the
 * implementation must survive, which is exactly why the implementation's null
 * coalescing looks redundant to the compiler and is not. Case 5 is the fixture that
 * would be unwritable without this cast.
 */
function outcome(fields: {
  status: number | null;
  stdout: string | null;
  stderr: string | null;
  error?: Error;
}): SpawnSyncReturns<string> {
  return {
    pid: 4242,
    output: [null, fields.stdout, fields.stderr],
    signal: null,
    ...fields,
  } as SpawnSyncReturns<string>;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('resolveCompressionMethod (VER-05, mirrors @actions/cache 6.2.0)', () => {
  it('returns gzip when zstd prints nothing on either stream', () => {
    spawnSyncMock.mockReturnValue(
      outcome({ status: 0, stdout: '', stderr: '' }),
    );

    expect(resolveCompressionMethod()).toBe('gzip');
  });

  it('returns gzip for whitespace-only output (the .trim() proof)', () => {
    // Without the trim, a build that prints a bare newline selects zstd -- and the
    // reported value then disagrees with the library on a machine where nothing is
    // actually wrong. Upstream trims at `cacheUtils.js:118`.
    spawnSyncMock.mockReturnValue(
      outcome({ status: 0, stdout: '  \n  ', stderr: '' }),
    );

    expect(resolveCompressionMethod()).toBe('gzip');
  });

  it('returns zstd-without-long when the version banner arrives on stderr ONLY', () => {
    // Upstream appends BOTH listeners to the SAME string (`cacheUtils.js:110-111`).
    // A stdout-only implementation reports `gzip` here -- `runHelper`'s first
    // inverted axis (`local-context.ts:85-86`, no stderr listener at all).
    spawnSyncMock.mockReturnValue(
      outcome({
        status: 0,
        stdout: '',
        stderr: '*** zstd command line interface 64-bits v1.5.7 ***',
      }),
    );

    expect(resolveCompressionMethod()).toBe('zstd-without-long');
  });

  it('returns zstd-without-long on a NON-ZERO exit that still produced output', () => {
    // THE CONTROL. Do not "simplify" this case away: it is the only one of the six
    // that distinguishes a faithful port from a `runHelper`-shaped one, and it is
    // the exact broken-but-present-zstd scenario VER-05 names. Upstream passes
    // `ignoreReturnCode: true` (`cacheUtils.js:107`) and never inspects the code, so
    // a zstd that exits 1 while still printing its banner selects ZSTD. Any
    // implementation that reads `status` -- or that uses `promisify(execFile)` with
    // the natural `.catch(() => '')` -- reddens here and nowhere else. M1 in plan
    // 09-04 Task 3 applies exactly that mistake and observes this test fail.
    spawnSyncMock.mockReturnValue(
      outcome({ status: 1, stdout: 'zstd 1.5.7', stderr: '' }),
    );

    expect(resolveCompressionMethod()).toBe('zstd-without-long');
  });

  it('returns gzip when the spawn itself faults (zstd absent, ENOENT)', () => {
    // The real ENOENT result: `error` set, `status` null, and BOTH streams null.
    // Coalescing each null to '' yields '' -> gzip, byte-for-byte upstream's caught
    // throw (`cacheUtils.js:115-117`). `error` is never read, only survived.
    spawnSyncMock.mockReturnValue(
      outcome({
        error: new Error('spawn zstd ENOENT'),
        status: null,
        stdout: null,
        stderr: null,
      }),
    );

    expect(resolveCompressionMethod()).toBe('gzip');
  });

  it('returns zstd-without-long for output no semver parser can read', () => {
    // Proves the parsed semver is NOT a condition. Upstream computes
    // `semver.clean(versionOutput)` at `cacheUtils.js:127`, logs it, and then
    // branches on `versionOutput === ''` at `:129` -- so the parse is discarded and
    // unparseable output still selects zstd. Do not reintroduce it as a condition.
    spawnSyncMock.mockReturnValue(
      outcome({ status: 0, stdout: 'not a version at all', stderr: '' }),
    );

    expect(resolveCompressionMethod()).toBe('zstd-without-long');
  });
});

describe('resolveCompressionMethod invocation shape (VER-05, T-09-27, D-15)', () => {
  it('spawns zstd exactly once with the upstream argv and only the two borrowed hardening options', () => {
    spawnSyncMock.mockReturnValue(
      outcome({ status: 0, stdout: 'zstd 1.5.7', stderr: '' }),
    );

    resolveCompressionMethod();

    expect(spawnSyncMock).toHaveBeenCalledOnce();

    const [file, args, options] = spawnSyncMock.mock.calls[0];

    expect(file).toBe('zstd');
    // Asserted by EQUALITY, not by containment, so a reordering or an added flag
    // fails. `--quiet` precedes `--version` because upstream PUSHES `--version`
    // onto the `['--quiet']` array it was passed (`cacheUtils.js:103`, which mutates
    // the caller's array) -- the order is fixed by upstream, not by preference.
    expect(args).toStrictEqual(['--quiet', '--version']);
    // Whole-object equality: `shell: false` and `windowsHide: true` are borrowed
    // from `local-context.ts:52,65-66`, `encoding: 'utf8'` is what makes the two
    // streams strings rather than Buffers, and NOTHING else is passed. T-09-27's
    // injection mitigation is `shell: false` plus an explicit argv of hardcoded
    // literals with no interpolation and no caller input.
    expect(options).toStrictEqual({
      shell: false,
      windowsHide: true,
      encoding: 'utf8',
    });
  });

  it('passes NO timeout, which is the considered value rather than an omission (D-15)', () => {
    // D-15 declines the timeout `runHelper` carries (`local-context.ts:55`)
    // deliberately: this probe must report what `@actions/cache` ACTUALLY computed,
    // and a killed spawn produces no output, which reports `gzip` where the library
    // reported `zstd` -- the one failure this probe must not have. The hang risk is
    // not ours to add either, because `@actions/cache` calls `getCompressionMethod()`
    // itself on every restore and save in the same job, so a wedged `zstd` has
    // already wedged the publish before this runs; the job's `timeout-minutes` is
    // the backstop.
    //
    // The whole-object equality above already subsumes this assertion today. It is
    // kept anyway, and it is not redundant: the moment a future contributor relaxes
    // that assertion to `toMatchObject` to admit some legitimate new option, this is
    // the only surviving guard -- and it names the timeout in its failure message,
    // so a "hardening" pass learns WHY rather than just that something broke. An
    // asserted omission is how a deliberate decision stops being indistinguishable
    // from an oversight.
    spawnSyncMock.mockReturnValue(
      outcome({ status: 0, stdout: 'zstd 1.5.7', stderr: '' }),
    );

    resolveCompressionMethod();

    expect(spawnSyncMock.mock.calls[0][2]).not.toHaveProperty('timeout');
  });
});
