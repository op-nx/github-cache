import { spawnSync } from 'node:child_process';

/**
 * The two values this code path can return. Upstream's enum
 * (`@actions/cache/lib/internal/constants.js:6-13`) carries a third, `zstd`, which
 * `getCompressionMethod` never returns -- it exists for callers that have already
 * established long-range support. Reproducing only the two reachable values keeps
 * the type honest about what this function can hand back.
 */
export type CompressionMethod = 'gzip' | 'zstd-without-long';

/**
 * Re-derive the compression method `@actions/cache` resolved for this job (VER-05).
 *
 * PINNED to `@actions/cache` 6.2.0, mirroring `getVersion` + `getCompressionMethod`
 * at `lib/internal/cacheUtils.js:100-136` and the enum's string values at
 * `lib/internal/constants.js:6-13`. Naming the version is PARITY-06 discipline: the
 * citations are only checkable against a known version, and `pinned-deps.spec.ts`
 * carries the re-read instruction on the assertion a bumper cannot avoid editing.
 *
 * ## Why a duplicate exists at all
 *
 * `getCompressionMethod` is not on `@actions/cache`'s exported surface -- reaching
 * for it hits the same `ERR_PACKAGE_PATH_NOT_EXPORTED` wall VER-02 documents -- so
 * the value has to be independently re-derived rather than asked for. It is worth
 * re-deriving because it is a cache-VERSION component: `getCacheVersion` pushes it
 * UNCONDITIONALLY at `cacheUtils.js:162-163`, before and independent of the
 * `process.platform === 'win32' && !enableCrossOsArchive` branch at `:166`. So the
 * `enableCrossOsArchive: true` that plan 09-03 hardcoded at all three call sites
 * CANNOT rescue a mismatch on this axis: two runners that disagree about zstd
 * disagree about the cache version no matter what the flag says.
 *
 * ## The observable contract reduces to ONE bit
 *
 * Is the combined trimmed output empty? It is empty iff `zstd` produced nothing on
 * either stream -- including because it does not exist. Everything else upstream
 * touches is unobservable downstream: the interleaving order of the two streams, the
 * exit code (upstream passes `ignoreReturnCode: true` at `cacheUtils.js:107` and
 * never inspects it), and the parsed semver, which upstream computes at `:127`, logs
 * to debug, and then DISCARDS -- it branches on `versionOutput === ''` at `:129`.
 *
 * So a broken-but-present zstd still selects zstd. Do NOT reintroduce the semver as
 * a condition: it looks like the load-bearing part and is not, and adding it would
 * make this report `gzip` for exactly the build VER-05 exists to describe correctly.
 *
 * ## Why `local-context.ts`'s `runHelper` is NOT reused
 *
 * A deliberate rejection, not an oversight. `runHelper` is wrong on both axes that
 * matter here, and both are comment-locked there as deliberate for ITS purpose:
 *
 * - `local-context.ts:85-86` attaches no stderr listener at all, because helper
 *   stderr is localized and credential-adjacent. Upstream accumulates BOTH streams
 *   into one string (`cacheUtils.js:110-111`), so a zstd build that banners on
 *   stderr would make a stdout-only probe report `gzip`.
 * - `local-context.ts:94-104` resolves `undefined` for any non-zero exit. That is
 *   precisely the broken-but-present-zstd case VER-05 names.
 *
 * Either inversion alone reports `gzip` where the library reported `zstd`, which is
 * the one failure this probe must not have. Only the two hardening options below are
 * borrowed; none of the discrimination logic is.
 *
 * ## ponytail: NO TIMEOUT, and it is the considered value rather than an omission
 *
 * D-15. `runHelper` carries one (`local-context.ts:55`) and this deliberately does
 * not: a killed spawn produces no output, and no output means `gzip`, so a timeout
 * would make the reported value diverge from what the library actually computed.
 * The hang risk is not ours to add either -- `@actions/cache` calls
 * `getCompressionMethod()` itself on every restore and every save in the same job,
 * so a wedged `zstd` has already wedged the publish before this runs. The job's
 * `timeout-minutes` is the backstop. `compression-method.spec.ts` asserts the
 * absence structurally, so the decision cannot decay into an apparent oversight.
 *
 * ## Not `serve()`-reachable, and it must stay that way (D-17)
 *
 * Import this ONLY from `runPublish` in `action/index.ts`. The committed sidecar
 * bundle has a single entry, `start-cache-server/entry.ts`, which does not reach
 * `action/index.ts`, so this module stays out of `start-cache-server/index.js` by
 * construction -- and `npm run check:action` returning an EMPTY diff is what proves
 * it stayed out. A second import site from anywhere in the serve graph would pull a
 * child-process spawn into the bundle every consumer resolves via `uses:`.
 *
 * ## Surfaced, never gated
 *
 * No branch anywhere reads this value. It reaches a `core.info` line and a job
 * summary line and stops there.
 *
 * ## A note on how this file is worded
 *
 * The two result fields this function refuses to consult are named by DESCRIPTION
 * above and never spelled, so that searching this file for either identifier returns
 * nothing and the "structurally unconsulted" claim is mechanically checkable instead
 * of requiring a reader's judgement. That is the house pattern for a
 * grep-verifiable absence claim (D-05); do not "tidy" the phrasing back to the
 * literal field names.
 */
export function resolveCompressionMethod(): CompressionMethod {
  const probe = spawnSync('zstd', ['--quiet', '--version'], {
    // shell false: injection-safe. An explicit argv array is passed, never an
    // interpolated command string, and a native binary resolves from PATH with no
    // quoting even when its directory contains spaces. Borrowed from
    // `local-context.ts:52`. Both the file and the args are hardcoded literals with
    // no interpolation and no caller input (T-09-27).
    shell: false,
    // windowsHide: no console-window flash per spawn on Windows. Borrowed from
    // `local-context.ts:65-66`.
    windowsHide: true,
    // encoding utf8 so both streams arrive as strings rather than Buffers; upstream
    // reaches the same place via `data.toString()` on each chunk.
    encoding: 'utf8',
  });

  // Both streams into ONE string, mirroring upstream's two listeners appending to
  // the same accumulator. The null coalescing is load-bearing even though
  // `@types/node` declares both fields non-nullable (`child_process.d.ts:1335-1343`):
  // a real ENOENT outcome delivers both as null, so without it this throws where
  // upstream swallowed. Only the emptiness of the result is used; the raw output is
  // never logged, so a localized or verbose zstd banner cannot reach the job summary
  // (T-09-28).
  const versionOutput = ((probe.stdout ?? '') + (probe.stderr ?? '')).trim();

  return versionOutput === '' ? 'gzip' : 'zstd-without-long';
}
