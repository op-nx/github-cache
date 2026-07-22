import { HASH_PATTERN, type Hash } from './cache-key.js';

/**
 * The OS discriminators folded into every Release asset name (D-06). Authored ONCE
 * as a runtime tuple so `isServerProducedAssetName` can validate the OS half against
 * a real value set without a second copy of the literals; `CacheOs` derives from it.
 */
export const CACHE_OS_VALUES = ['windows', 'macos', 'linux'] as const;

/**
 * Map the running platform to the OS discriminator folded into every Release
 * asset name (D-06). `win32 -> windows`, `darwin -> macos`, and every other value
 * (linux and any exotic platform) to `linux`. The discriminator is the runtime
 * `process.platform` -- compiled-in, emulation-proof, and shell-invariant -- not
 * `env:RUNNER_OS`, which is CI-only and absent locally.
 */
export type CacheOs = (typeof CACHE_OS_VALUES)[number];

export function cachePlatform(
  platform: NodeJS.Platform = process.platform,
): CacheOs {
  if (platform === 'win32') {
    return 'windows';
  }

  if (platform === 'darwin') {
    return 'macos';
  }

  return 'linux';
}

/**
 * Single source of truth for the OS-namespaced Release asset name (CORR-01).
 * BOTH the Phase 3 reader and the Phase 4 publisher MUST derive names through this
 * one helper so a read on platform P can only ever resolve an asset produced under
 * platform P.
 *
 * LOAD-BEARING, comment-locked (Pitfall 7, D-07). A drift between the two
 * derivations is a SILENT cross-OS MISS -- no error, no crash, just a wave of
 * rebuilds when a reader looks under a name the publisher never wrote. Never
 * inline this, never "tidy" the template, and never change the separator without
 * re-verifying an end-to-end cross-OS read; the failure mode is a silent MISS, not
 * a crash. The exact produced name is pinned by release-asset-name.spec.ts.
 *
 * The platform parameter exists ONLY for test injection -- it lets one CI leg
 * assert all three OS mappings and simulate a wrong-OS reader. It is NOT a mode
 * surface: it cannot influence RW-vs-RO selection (TRUST-05 intact).
 */
export function releaseAssetName(
  hash: Hash,
  platform: NodeJS.Platform = process.platform,
): string {
  return `${hash}-${cachePlatform(platform)}`;
}

/**
 * Whether an asset name is the publisher's `<hash>-<os>` shape -- a valid
 * lowercase-hex hash followed by one of the CACHE_OS_VALUES discriminators
 * (equivalent to `^[a-f0-9]{1,512}-(windows|macos|linux)$`). Mirrors the
 * `isServerProducedKey` discipline: the cleanup delete filter uses it so a foreign
 * asset dropped into a genuine month-shard release is never pruned as ours.
 *
 * Reuses HASH_PATTERN for the hash half and CACHE_OS_VALUES for the OS half so
 * neither the hex char-class nor the OS literals are re-authored. Splits on the
 * LAST `-` (a hash is hex, so it holds no dash -- the last dash is the separator);
 * a name with no dash, an empty hash, a non-hex hash, or an unknown OS is rejected.
 */
export function isServerProducedAssetName(name: string): boolean {
  const separator = name.lastIndexOf('-');

  if (separator < 0) {
    return false;
  }

  const hash = name.slice(0, separator);
  const os = name.slice(separator + 1);

  return (
    HASH_PATTERN.test(hash) &&
    (CACHE_OS_VALUES as readonly string[]).includes(os)
  );
}
