---
quick_id: 260721-vdn
verified: 2026-07-21T23:10:00Z
status: passed
score: 4/4 must-haves verified
behavior_unverified: 0
overrides_applied: 0
---

# Quick Task 260721-vdn: Harden Releases-mirror cleanup delete scoping - Verification Report

**Task Goal:** Harden the Releases-mirror scheduled cleanup delete scope (defense-in-depth from PR #3 security review): (1) replace the loose `startsWith('cache-mirror-')` release-scope filter with an exact `^cache-mirror-\d{6}$` month-shard check single-sourced in retention.ts; (2) add a `<hash>-<os>` asset-name allowlist reusing HASH_PATTERN + CacheOs so cleanup only deletes genuine server-produced cache assets. A pure NARROWING.
**Verified:** 2026-07-21
**Status:** passed
**Re-verification:** No - initial verification
**HEAD:** 602824b (third commit of the task)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | Only genuine `cache-mirror-YYYYMM` month-shard releases are scoped; `cache-mirror-latest` / `cache-mirror-backup` skipped entirely (loose prefix no longer matches) | VERIFIED | `cleanup.ts:77` uses `!isShardTag(release.tag_name)`; `isShardTag` -> `SHARD_TAG_PATTERN` = `/^cache-mirror-\d{6}$/` (`retention.ts:57,66`). Behavioral test `cleanup.spec.ts:140-159` asserts `listAllAssets`/`deleteAsset` NEVER called for `cache-mirror-latest`/`cache-mirror-backup`. Reject set pinned in `retention.spec.ts:44-55`. Tests pass. |
| 2 | Only publisher `<hash>-<os>` assets are eligible for pruning; a non-`<hash>-<os>` asset inside a genuine shard is never deleted | VERIFIED | `cleanup.ts:89` `if (!isServerProducedAssetName(asset.name)) { continue; }` is the FIRST statement in the per-asset loop (before `scanned++` and the created_at parse). Behavioral test `cleanup.spec.ts:182-204` asserts `sbom.json` in `cache-mirror-202607` is skipped (`scanned=1`, not deleted). Reject set pinned in `release-asset-name.spec.ts:77-88`. Tests pass. |
| 3 | A genuine `<hash>-<os>` asset past the cutoff in a real month shard is STILL pruned - pure narrowing, never deletes more than before | VERIFIED | Regression-guard test `cleanup.spec.ts:182-204`: genuine expired `deadc0de-linux` in `cache-mirror-202607` IS pruned (`deleteAsset` called once with id 2, `pruned=1`). Prune/retain test `cleanup.spec.ts:162-180` confirms `abc123-linux` (expired) pruned. Subset proof below. Tests pass. |
| 4 | The shard-tag scheme and OS-namespaced asset-name scheme each stay single-source (`isShardTag` derives from `SHARD_TAG_PREFIX`; `isServerProducedAssetName` reuses `HASH_PATTERN` + `CacheOs` value set) | VERIFIED | `retention.ts:57` `SHARD_TAG_PATTERN = new RegExp('^' + SHARD_TAG_PREFIX + '\\d{6}$')` - prefix not copied. `release-asset-name.ts:1` imports `HASH_PATTERN`; `:8` `CACHE_OS_VALUES` tuple; `:17` `CacheOs` derived from tuple; `:80-81` reuses both. No duplicated OS set, no re-authored hex char-class. Single-source pins in both spec files. |

**Score:** 4/4 truths verified (0 present, behavior-unverified)

The three cleanup truths are behavior-dependent (delete-vs-skip state transitions). Each is exercised by a passing named test in `cleanup.spec.ts`, not by symbol presence alone - hence VERIFIED rather than PRESENT_BEHAVIOR_UNVERIFIED.

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `packages/github-cache/src/lib/retention.ts` | Exports `SHARD_TAG_PATTERN` + `isShardTag` derived from `SHARD_TAG_PREFIX` | VERIFIED | Added at :57/:66. Locked helpers (`shardTag`, `shardTagsForWindow`, `resolveMaxAgeDays`, `SHARD_TAG_PREFIX`, `MS_PER_DAY`) unmodified - diff of d95a499 is additions-only after `shardTag`. |
| `packages/github-cache/src/lib/retention.spec.ts` | Pins accept/reject + round-trip + single-source | VERIFIED | `isShardTag` describe block (:31-70): accept `202607/202601/202612`; reject bare prefix, 4/5/7-digit tails, `latest`, `backup`, `2026-07`, `v1.0.0`; round-trip guard; `SHARD_TAG_PREFIX`/`SHARD_TAG_PATTERN` pin. |
| `packages/github-cache/src/lib/release-asset-name.ts` | Exports `isServerProducedAssetName` reusing `HASH_PATTERN` + OS value set, single-source | VERIFIED | `CACHE_OS_VALUES` tuple added; `CacheOs` derived (resolved type identical); `cachePlatform`/`releaseAssetName` bodies unchanged (diff 779079b). |
| `packages/github-cache/src/lib/release-asset-name.spec.ts` | Pins accept/reject + round-trip + single-source | VERIFIED | `isServerProducedAssetName` describe block (:64-101): accept `abc123-linux`, `deadbeef-windows`, `0-macos`, 512-char hash; reject uppercase hash/os, unknown os, no dash, empty hash/os, non-hex head; round-trip for win32/darwin/linux; `CACHE_OS_VALUES` pin. |
| `packages/github-cache/src/cleanup/cleanup.ts` | Uses exact-shard check + asset allowlist; preserves LIST-abort/isolation/404/NaN | VERIFIED | :77 `!isShardTag(...)`; :89 asset guard first in loop; LIST-abort (:72), per-item isolation (:120-138), 404-benign (:125), NaN-retain (:96-108) all intact. Imports `isShardTag`, `MS_PER_DAY`, `isServerProducedAssetName`; dropped unused `SHARD_TAG_PREFIX`. |
| `packages/github-cache/src/cleanup/cleanup.spec.ts` | Fixture rename + tests (a) non-shard skipped, (b) foreign skipped / genuine pruned | VERIFIED | Non-hex heads renamed to hex (`feed01`, `abc123`, `deadbeef`, `c0ffee`, `dec0de`, `ba5eba11`, `d15ea5e`, `abcdef`); `a/b/c-linux` kept. Test (a) :140-159; test (b) :182-204; NaN test renamed fixture :298-317 still warn-and-retain. |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `cleanup.ts` | `retention.ts` | `import { isShardTag, MS_PER_DAY }` used at :77, :69 | WIRED | Release-scope filter calls `isShardTag`. |
| `cleanup.ts` | `release-asset-name.ts` | `import { isServerProducedAssetName }` used at :89 | WIRED | Asset allowlist guard first in per-asset loop. |
| `release-asset-name.ts` | `cache-key.ts` | `import { HASH_PATTERN }` used at :80 | WIRED | Hash half reuses the single-source pattern, no re-authored char-class. |
| `retention.ts` | `retention.ts` | `SHARD_TAG_PATTERN` built from `SHARD_TAG_PREFIX` | WIRED | Prefix literal single-sourced, not copied. |

### Narrowing subset proof (Truth 3)

Old: release scope = `startsWith('cache-mirror-')`, asset filter = none (all expired assets deleted).
New: release scope = `^cache-mirror-\d{6}$`, asset filter = `isServerProducedAssetName` must pass.

- Every tag matching `^cache-mirror-\d{6}$` starts with `cache-mirror-`, so {new-scoped releases} is a subset of {old-scoped releases}.
- The new asset guard can only skip assets the old code would have deleted; it never admits an asset the old code skipped.

Therefore {new deletions} is a subset of {old deletions} - a pure narrowing, cannot delete more than before. Genuine `<hash>-<os>` assets in real `cache-mirror-YYYYMM` shards still pass both filters and are pruned by the unchanged created_at cutoff (proven by test b).

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Full github-cache unit suite | `npx nx test github-cache --skip-nx-cache` | 373 passed (27 files); retention.spec 30, release-asset-name.spec 24, cleanup.spec included | PASS |
| Library typecheck | `tsc --noEmit -p packages/github-cache/tsconfig.lib.json` | exit 0, no output | PASS |

### Anti-Patterns Found

None. No `TODO`/`FIXME`/`XXX`/`HACK`/`PLACEHOLDER`/`TBD` markers in any of the six changed files. The `continue` statements are legitimate loop-skip control flow, not stubs. Working tree clean apart from this task's own untracked planning directory.

### Gaps Summary

No gaps. All four must-have truths are verified against the committed code (HEAD 602824b) with passing behavioral tests, the locked retention/asset-name helpers are provably unmodified (additions-only diffs), the change is a mathematically pure narrowing, and the full 373-test suite plus library typecheck are green.

---

_Verified: 2026-07-21_
_Verifier: Claude (gsd-verifier)_
