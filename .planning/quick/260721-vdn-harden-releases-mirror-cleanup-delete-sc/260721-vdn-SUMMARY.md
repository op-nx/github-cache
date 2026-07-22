---
quick_id: 260721-vdn
description: Harden Releases-mirror cleanup delete scoping (exact month-shard tag + server-produced asset-name guard)
status: complete
mode: quick-full
branch: gsd/v0.0.1-greenfield-rebuild
execution: sequential-on-main
completed: 2026-07-21
commits:
  - d95a499 feat(retention): exact month-shard tag check (isShardTag)
  - 779079b feat(release-asset-name): server-produced asset-name validator
  - 602824b fix(cleanup): narrow release scope + asset guard (SC hardening)
artifacts:
  - packages/github-cache/src/lib/retention.ts
  - packages/github-cache/src/lib/retention.spec.ts
  - packages/github-cache/src/lib/release-asset-name.ts
  - packages/github-cache/src/lib/release-asset-name.spec.ts
  - packages/github-cache/src/cleanup/cleanup.ts
  - packages/github-cache/src/cleanup/cleanup.spec.ts
  - start-cache-server/index.js
---

# Quick Task 260721-vdn: Harden Releases-mirror cleanup delete scoping

Defense-in-depth hardening triaged from the PR #3 security review. A pure NARROWING
of the cleanup delete filter: it never deletes more than before, and still prunes
every genuine `<hash>-<os>` asset in every real `cache-mirror-YYYYMM` month shard.
Two compounding gaps closed on the retention-locked cleanup path.

## What changed (3 atomic, bisect-safe commits)

### Commit 1 -- `d95a499` feat(retention): exact month-shard tag check (isShardTag)

- `retention.ts`: added `SHARD_TAG_PATTERN` (built from `SHARD_TAG_PREFIX` as
  `/^cache-mirror-\d{6}$/`) and `isShardTag(tag)` returning `SHARD_TAG_PATTERN.test(tag)`.
  The `\d{6}` matches all `YYYYMM` shards (deliberately wider than the reader window,
  per Pitfall 4) but rejects non-shard `cache-mirror-*` tags. Existing locked helpers
  untouched.
- `retention.spec.ts`: pinned exact accept set (`cache-mirror-202607/202601/202612`)
  and reject set (bare prefix, 4/5/7-digit tails, `latest`, `backup`, `2026-07`,
  `v1.0.0`); a round-trip guard (`isShardTag(shardTag(anyDate))` is true); and a
  single-source pin of `SHARD_TAG_PREFIX` + `SHARD_TAG_PATTERN`.
- `start-cache-server/index.js`: regenerated. `SHARD_TAG_PATTERN`'s module-level
  RegExp initializer does not tree-shake, so the serve()-reachable bundle drifted;
  staged in this same commit to keep the action-bundle-drift gate green and the
  commit bisect-safe. (`isShardTag` itself tree-shakes out.)

### Commit 2 -- `779079b` feat(release-asset-name): server-produced asset-name validator

- `release-asset-name.ts`: added `isServerProducedAssetName(name)` matching the
  publisher's `<hash>-<os>` shape (`^[a-f0-9]{1,512}-(windows|macos|linux)$`),
  mirroring the `isServerProducedKey` discipline. Reuses `HASH_PATTERN`
  (from `cache-key.js`) for the hash half; splits on the LAST `-`. Promoted the
  `CacheOs` union to a `const` tuple `CACHE_OS_VALUES` with `CacheOs` derived from it,
  so the OS literals have a single runtime source (resolved type and the
  `cachePlatform`/`releaseAssetName` bodies unchanged).
- `release-asset-name.spec.ts`: pinned the exact accept set (`abc123-linux`,
  `deadbeef-windows`, `0-macos`, 512-char hash) and reject set (uppercase hash/os,
  unknown os, no dash, empty hash, empty os, non-hex head); a round-trip guard for
  win32/darwin/linux; and a single-source pin of `CACHE_OS_VALUES`.
- No bundle drift (both new exports tree-shake out of the serve() bundle).

### Commit 3 -- `602824b` fix(cleanup): narrow release scope + asset guard (SC hardening)

- `cleanup.ts`: replaced the loose `release.tag_name.startsWith(SHARD_TAG_PREFIX)`
  scope filter with `!isShardTag(release.tag_name)` (dropped the now-unused
  `SHARD_TAG_PREFIX` import, kept `MS_PER_DAY`). Added the asset-name guard
  `if (!isServerProducedAssetName(asset.name)) { continue; }` as the FIRST statement
  in the per-asset loop -- before `scanned++` and the `created_at` parse -- so a
  foreign asset (even with a malformed timestamp) is skipped silently and `scanned`
  counts only genuine mirror assets. LIST-abort / per-item isolation / 404-benign /
  NaN-retain semantics preserved.
- `cleanup.spec.ts`: applied the MANDATORY fixture-rename map (non-hex heads to
  genuine lowercase-hex `<hash>-<os>` names, single-hex `a/b/c-linux` left as-is):
  - LIST-abort `old-linux` -> `feed01-linux`
  - prune/retain `expired-linux`/`fresh-linux` -> `abc123-linux`/`deadbeef-linux`
  - 404-vs-5xx `gone-linux`/`faulted-linux` -> `c0ffee-linux`/`dec0de-linux`
  - observability `expired-linux`/`fresh-linux` -> `ba5eba11-linux`/`d15ea5e-linux`
  - NaN `bad-timestamp` -> `abcdef-linux`
  Added (a) a non-shard `cache-mirror-latest`/`cache-mirror-backup` release is skipped
  entirely (listAllAssets/deleteAsset never called), and (b) a foreign `sbom.json` is
  skipped while a genuine expired `deadc0de-linux` in the same shard is still pruned
  (deleteAsset called once with the genuine id; scanned = 1) -- the asset-name
  narrowing regression guard.
- No bundle drift (cleanup.ts is not serve()-reachable).

## Deviations from Plan

Auto-fixed under Rule 3 (blocking issue) -- the repo's `fallow:ci` (dead-code) and
`nx format:check` gates, both part of the final battery, tripped after the plan's
mandated changes:

1. **[Rule 3] fallow unused-export gate.** The plan mandates exporting
   `SHARD_TAG_PATTERN` and `CACHE_OS_VALUES`, and the Commit 3 narrowing removed
   cleanup.ts's import of the (locked, must-not-modify) `SHARD_TAG_PREFIX` export.
   All three then had no consumer, so `fallow dead-code --fail-on-issues` failed.
   Fallow credits test imports as consumers (documented in `.fallowrc.jsonc`), so the
   fix is spec pins that import each symbol -- which is also the plan's own
   "single-source, spec-pinned" intent. `SHARD_TAG_PREFIX` was NOT un-exported (the
   plan forbids modifying that locked helper).
2. **[Rule 3] Prettier format.** The retention.ts/spec.ts additions needed
   Prettier reflow (`SHARD_TAG_PATTERN` collapsed to one line; `it.each` array
   reflow). The one-line `SHARD_TAG_PATTERN` re-drifted the bundle, so Commit 1's
   staged `start-cache-server/index.js` reflects the final single-line form.

Both fixes were folded back into the originating commits (the 3-commit sequence was
rebuilt via a mixed reset before any push, so history stays exactly 3 atomic commits
rather than trailing follow-up commits). No architectural changes; no new
dependencies; no authentication gates.

## Verification results (final battery, at HEAD 602824b)

| Check | Command | Result |
|-------|---------|--------|
| Unit tests | `npx nx test github-cache` | PASS (373 tests, 27 files) |
| Typecheck | `tsc --noEmit -p packages/github-cache/tsconfig.lib.json` | PASS |
| Build | `npx nx build github-cache` | PASS |
| Dead-code (lint) | `npm run fallow:ci` | PASS (0 issues) |
| Format | `npm run format:check` | PASS |
| Action-bundle-drift | `npm run check:action` | PASS (no drift) |
| Pack-check | `npm run pack:check` | PASS (88 files, no internals leaked) |

Note: this project has no `lint` target; `fallow:ci` (dead-code) + `nx format:check`
are the repo's lint-equivalents.

Per-commit bisect safety (hard gate: tsc + `nx test`) verified in isolation:
- Commit 1 `d95a499`: tsc PASS, 357 tests PASS
- Commit 2 `779079b`: tsc PASS, 371 tests PASS
- Commit 3 `602824b`: tsc PASS, 373 tests PASS

## Known Stubs

None.

## Threat Flags

None. This change is a pure narrowing of an existing security control (retention
cleanup delete scoping); it introduces no new network endpoints, auth paths, file
access, or trust-boundary schema.

## Self-Check: PASSED

- All six source/spec files + the regenerated bundle exist and are committed.
- Commits `d95a499`, `779079b`, `602824b` present in `git log`.
- Working tree clean apart from this task's own (uncommitted) planning artifacts.
