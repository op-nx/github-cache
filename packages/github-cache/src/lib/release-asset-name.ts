/**
 * Map the running platform to the OS discriminator folded into every Release
 * asset name (D-06). `win32 -> windows`, `darwin -> macos`, and every other value
 * (linux and any exotic platform) to `linux`. The discriminator is the runtime
 * `process.platform` -- compiled-in, emulation-proof, and shell-invariant -- not
 * `env:RUNNER_OS`, which is CI-only and absent locally.
 */
export function cachePlatform(
  platform: NodeJS.Platform = process.platform,
): string {
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
  hash: string,
  platform: NodeJS.Platform = process.platform,
): string {
  return `${hash}-${cachePlatform(platform)}`;
}
