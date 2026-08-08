import { CACHE_KEY_PREFIX, HASH_PATTERN, type Hash } from './cache-key.js';

/**
 * The OS discriminators the LEGACY Release asset names folded in (D-06). Authored
 * ONCE as a runtime tuple so the OS half of an already-published `<hash>-<os>`
 * asset is validated against a real value set rather than a second copy of the
 * literals; `CacheOs` derives from it.
 *
 * INTENTIONALLY KEPT after CORR-02 removed the OS from the name. Its live consumer
 * is `isLegacyOsSuffixedAssetName` below -- the cleanup accept filter's legacy
 * branch, which is the ONLY thing that can still prune the 122 assets already
 * published under the old shape. `fallow dead-code --fail-on-issues` gates this repo
 * in CI, so this annotation is what tells that gate (and the next reader) the
 * survival is deliberate and not leftovers.
 */
export const CACHE_OS_VALUES = ['windows', 'macos', 'linux'] as const;

export type CacheOs = (typeof CACHE_OS_VALUES)[number];

/**
 * Map the running platform to a cache OS discriminator. `win32 -> windows`,
 * `darwin -> macos`, and every other value (linux and any exotic platform) to
 * `linux`. The discriminator is the runtime `process.platform` -- compiled-in,
 * emulation-proof, and shell-invariant -- not `env:RUNNER_OS`, which is CI-only and
 * absent locally.
 *
 * INTENTIONALLY KEPT after CORR-02, and for a DIFFERENT reason than the tuple
 * above. Its live consumer is OBS-03's `mirrored-by: <os>` Release LABEL, built in
 * publish-mirror.ts: with the OS gone from the name, the label is the one piece of
 * OS attribution the mirror still carries, and it names the PUBLISHING leg -- never
 * the producing one. `fallow dead-code --fail-on-issues` is a real CI gate here, so
 * an unexplained survivor is a build failure rather than a style note. RETAIN-04
 * names only the tuple; this mapper needs the same annotation for the same reason
 * and no requirement says so, which is why it is spelled out here.
 */
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
 * Single source of truth for the Release asset name (CORR-02). ONE asset name per
 * hash -- the prefix followed by the hash, with NO OS component -- so a reader on
 * any platform resolves the same asset a publisher on any other platform wrote.
 * BOTH the Phase 3 reader and the Phase 4 publisher MUST derive names through this
 * one helper.
 *
 * The prefix is IMPORTED from cache-key.ts and composed here; it is NEVER
 * re-authored. `cache-key.spec.ts`'s cross-file authored-occurrence guard pins this
 * module at ZERO authored copies, which is the property that keeps one literal
 * governing four consumers instead of four literals drifting apart (RETAIN-05c).
 *
 * WHAT REPLACED THE OS NAMESPACE. Attribution did not vanish with the suffix, it
 * MOVED to Release `label` metadata (`mirrored-by: <os>`, OBS-03). The NAME answers
 * "which hash"; the LABEL answers "which leg uploaded it". Nothing answers "which
 * leg PRODUCED it" -- that claim is retracted repo-wide rather than relocated,
 * because a leg can now mirror another OS's bytes and would label them its own.
 *
 * LOAD-BEARING, comment-locked (Pitfall 7, D-03). A drift between the reader's and
 * the publisher's derivation is a SILENT cross-context MISS -- no error, no crash,
 * just a wave of rebuilds when a reader looks under a name the publisher never
 * wrote. Never inline this, never "tidy" the template, and never change the prefix
 * or the composition without re-verifying an end-to-end mirror read; the failure
 * mode is a silent MISS, not a crash. The exact produced name is pinned by
 * release-asset-name.spec.ts as a HAND-AUTHORED literal, and its arity is pinned
 * structurally so a `platform` parameter cannot creep back in behind a default.
 *
 * THE TIDY-UP A FUTURE READER WILL PROPOSE, and why NOT: fold this into
 * `cacheKeyFor` (cache-key.ts), which returns the byte-identical string today. Do
 * not. RETAIN-05c single-sources the PREFIX across FOUR DISTINCT consumers -- the
 * Actions-cache key, the Actions-cache enumeration filter, this Release asset name,
 * and the cleanup accept filter's current-shape branch -- not two aliases of one
 * builder. Aliasing would COUPLE the Actions-cache KEY namespace to the Release
 * ASSET namespace, so a later change intended for one would silently move both.
 */
export function releaseAssetName(hash: Hash): string {
  return `${CACHE_KEY_PREFIX}${hash}`;
}

/**
 * RETAIN-04 branch A: whether an asset name is the CURRENT shape -- the prefix
 * followed by a valid bounded lowercase-hex hash.
 *
 * What it is NOT: NOT a cheap `startsWith` prefix check. The bare prefix, a non-hex
 * remainder, an over-length remainder and a legacy OS-suffixed name are all
 * REJECTED. This is the full filter, for the same reason `isServerProducedKey`
 * rejects the cheap subset the Phase 4 publish path lacked (D-08) -- and with more
 * at stake, because this one feeds a DELETE path, where a widened accept set means
 * deleting somebody else's asset. Both conditions derive from single-sourced
 * constants; never a regex literal re-authoring the prefix or the hex class.
 *
 * NOT ALIASED to `isServerProducedKey` (cache-key.ts), even though the body is
 * identical in SHAPE -- and "these two are the same, tidy them together" is exactly
 * what a future reader will propose. Same reason `releaseAssetName` is not aliased
 * to `cacheKeyFor`: the Actions-cache KEY namespace and the Release ASSET namespace
 * are two of RETAIN-05c's FOUR distinct consumers of ONE prefix, and aliasing them
 * would make a change meant for either move both.
 */
export function isCurrentAssetName(name: string): boolean {
  return (
    name.startsWith(CACHE_KEY_PREFIX) &&
    HASH_PATTERN.test(name.slice(CACHE_KEY_PREFIX.length))
  );
}

/**
 * RETAIN-04 branch B: whether an asset name is the LEGACY pre-CORR-02 `<hash>-<os>`
 * shape -- a valid lowercase-hex hash followed by one of the CACHE_OS_VALUES
 * discriminators (equivalent to `^[a-f0-9]{1,512}-(windows|macos|linux)$`).
 *
 * The pre-rename filter's body, preserved VERBATIM under a new name. That verbatim
 * preservation is what makes the RETAIN-04 widening provably ADDITIVE: every name
 * the single-branch filter accepted is still accepted, byte for byte, so the
 * already-published shape stays prunable instead of becoming permanent shard
 * growth. Reuses HASH_PATTERN for the hash half and CACHE_OS_VALUES for the OS half
 * so neither the hex char-class nor the OS literals are re-authored.
 *
 * What it is NOT: not a general "contains a dash" check, and there is deliberately
 * NO third branch for the PoC-era `<hash>.tar.gz` family. That shape is
 * indistinguishable from a foreign asset dropped into a genuine shard, so admitting
 * it would widen a DELETE filter that was narrowed on security grounds; its 50
 * shipped instances are accepted dead weight bounded by the shard and the retention
 * window (D-08).
 *
 * The `separator < 0` early return is LOAD-BEARING, not incidental: it is the
 * second of the two independent reasons this branch cannot overlap branch A.
 *
 * DISJOINTNESS FROM BRANCH A -- comment-locked, because it is a property of the
 * DESIGN and NOT of the last-dash split a reader will assume it rests on:
 *   1. CACHE_KEY_PREFIX itself CONTAINS a dash, and that dash is its LAST
 *      character. For any name branch A accepts, the WHOLE post-prefix remainder
 *      matches HASH_PATTERN, which forbids a dash -- so the last dash of the whole
 *      name is the prefix's own trailing one, and this branch's hash half is
 *      exactly the prefix minus that dash. That string itself contains a dash and
 *      can therefore never match HASH_PATTERN.
 *   2. Belt: even a DASHLESS prefix would work. A branch-A name would then contain
 *      zero dashes at all, and the `separator < 0` return above rejects it outright.
 * MEASURED: 0 both-true results over a 26-case adversarial table AND 1.6M
 * randomised candidates drawn from `abcdef0123456789-nxcheus`, each wrapped four
 * ways. Both reasons and the table are asserted directly in
 * release-asset-name.spec.ts with the both-true count pinned to 0.
 */
export function isLegacyOsSuffixedAssetName(name: string): boolean {
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

/**
 * RETAIN-04: whether an asset name is one the publisher produced -- the CURRENT
 * shape OR the LEGACY OS-suffixed shape. Composed from the two branch predicates
 * above rather than written as one expression, so the widening is auditable branch
 * by branch; BOTH branches are exported so RETAIN-05(b) can assert their mutual
 * exclusivity DIRECTLY over an adversarial table, which asserting through this
 * union would be strictly weaker than.
 *
 * The cleanup DELETE filter's single call site (cleanup.ts). Mirrors the
 * `isServerProducedKey` discipline: a foreign asset dropped into a genuine
 * month-shard release is never pruned as ours. This widening had to land in the SAME
 * COMMIT as the rename, because a publisher writing the new name against an
 * unwidened filter silently stops pruning -- unbounded shard growth wearing a green
 * build, with no error anywhere.
 */
export function isServerProducedAssetName(name: string): boolean {
  return isCurrentAssetName(name) || isLegacyOsSuffixedAssetName(name);
}
