---
quick_id: 260721-vdn
description: Harden Releases-mirror cleanup delete scoping (exact month-shard tag + server-produced asset-name guard)
status: planned
mode: quick-full
branch: gsd/v0.0.1-greenfield-rebuild
execution: sequential-on-main
must_haves:
  truths:
    - Only genuine cache-mirror-YYYYMM month-shard releases are scoped for cleanup; a cache-mirror-latest / cache-mirror-backup release is skipped entirely (loose prefix no longer matches).
    - Only publisher <hash>-<os> assets are eligible for pruning; a non-<hash>-<os> asset inside a genuine month-shard release is never deleted.
    - A genuine <hash>-<os> asset past the cutoff in a real month shard is STILL pruned -- the change is a pure narrowing, never deleting more than before and still pruning every real shard asset.
    - The shard-tag scheme and the OS-namespaced asset-name scheme each stay single-source (isShardTag derives from SHARD_TAG_PREFIX; isServerProducedAssetName reuses HASH_PATTERN + the CacheOs value set).
  artifacts:
    - packages/github-cache/src/lib/retention.ts
    - packages/github-cache/src/lib/retention.spec.ts
    - packages/github-cache/src/lib/release-asset-name.ts
    - packages/github-cache/src/lib/release-asset-name.spec.ts
    - packages/github-cache/src/cleanup/cleanup.ts
    - packages/github-cache/src/cleanup/cleanup.spec.ts
  key_links:
    - packages/github-cache/src/lib/cache-key.ts (HASH_PATTERN reused by isServerProducedAssetName; isServerProducedKey doc-style precedent)
    - start-cache-server/index.js (esbuild bundle; retention.ts + release-asset-name.ts are serve()-reachable via selectBackend -- run npm run check:action every commit)
---

# Quick Task 260721-vdn: Harden Releases-mirror cleanup delete scoping

Defense-in-depth hardening triaged from the PR #3 security review (two independent
reviewers, one rating HIGH). Guards the project's non-negotiable retention-locked
requirement. The fix is a **pure NARROWING** of the cleanup delete filter: it must
NEVER delete MORE than before, and MUST still prune every genuine `<hash>-<os>`
asset in every real `cache-mirror-YYYYMM` month-shard release.

Two compounding gaps in `packages/github-cache/src/cleanup/cleanup.ts`:

1. `cleanup.ts:76` scopes releases by `release.tag_name.startsWith(SHARD_TAG_PREFIX)`
   -- a loose prefix matching any `cache-mirror-*` tag (`cache-mirror-latest`,
   `cache-mirror-backup`), not only genuine `cache-mirror-YYYYMM` month shards.
2. `cleanup.ts:82-103` deletes every asset older than the cutoff in a matched
   release with NO check that the asset name is the publisher's `<hash>-<os>` shape
   -- asymmetric with the strict `isServerProducedKey` discipline the read/write
   side enforces (`cache-key.ts:52`).

## Constraints (apply to every commit)

- Bisect-safe, atomic commits on the current branch `gsd/v0.0.1-greenfield-rebuild`.
  Each commit independently passes tsc + tests (build-green at every commit).
- Reuse the existing single-source helpers. Do NOT add speculative abstractions,
  and do NOT modify the existing locked helpers (`shardTag`, `shardTagsForWindow`,
  `resolveMaxAgeDays`, `SHARD_TAG_PREFIX`, `MS_PER_DAY`) -- only ADD siblings.
- `retention.ts` and `release-asset-name.ts` are serve()-reachable (serve -> selectBackend
  -> releases-backend -> shardTag/releaseAssetName), so the committed action bundle
  can drift. `cleanup.ts` is NOT serve()-reachable. Regardless: run `npm run check:action`
  in EVERY commit; if it reports drift, run `npm run build:action` and stage
  `start-cache-server/index.js` in that SAME commit (new unused exports normally
  tree-shake out, so no drift is expected -- confirm, don't assume).
- Follow project JS/TS style: blank lines around control-flow/returns, braces on all
  control-flow bodies. Prettier singleQuote.
- No AI attribution in commits. Stage files by name (never `git add .`). Commit author
  identity must be the public gmail (larsbrinknielsen@gmail.com), never a work email/domain.
- On the D: Dev Drive, `git commit -m` can fail with COMMIT_EDITMSG EINVAL; use
  `git commit -F <file>` if it does.

## Commit 1 -- feat(retention): exact month-shard tag check (isShardTag)

- **files:** `packages/github-cache/src/lib/retention.ts`,
  `packages/github-cache/src/lib/retention.spec.ts`
- **action:** Add a NEW exported single-source exact-month-shard check ADJACENT to
  `shardTag`, comment-locked and spec-pinned in the same "one home for the tag scheme"
  style as the rest of the file. Derive the pattern FROM `SHARD_TAG_PREFIX` so the
  prefix literal is not copied a second time -- e.g. build
  `export const SHARD_TAG_PATTERN` via `new RegExp('^' + SHARD_TAG_PREFIX + '\\d{6}$')`
  (equivalent to `/^cache-mirror-\d{6}$/`), and
  `export function isShardTag(tag: string): boolean` returning
  `SHARD_TAG_PATTERN.test(tag)`. The `\d{6}` still matches ALL `YYYYMM` month shards
  (deliberately wider than the reader window, per the existing Pitfall 4 intent) --
  it only excludes non-shard `cache-mirror-*` tags. Do NOT touch the existing locked
  helpers. Extend `retention.spec.ts` with a describe block pinning the exact
  accept/reject sets: ACCEPT `cache-mirror-202607`, `cache-mirror-202601`,
  `cache-mirror-202612`; REJECT the bare `cache-mirror-`, `cache-mirror-2026`
  (4 digits), `cache-mirror-20260` (5 digits), `cache-mirror-2026070` (7 digits),
  `cache-mirror-latest`, `cache-mirror-backup`, `cache-mirror-2026-07`, and a
  non-prefixed `v1.0.0`. Add a round-trip guard: `isShardTag(shardTag(anyDate))` is
  true, so the accepter can never drift from the producer.
- **verify:** `npx nx test github-cache` (retention.spec passes incl. new cases) and
  `tsc --noEmit -p packages/github-cache/tsconfig.lib.json` green; `npm run check:action`
  reports no drift (regenerate + stage the bundle in this commit if it does).
- **done:** `isShardTag` + `SHARD_TAG_PATTERN` exported and derived from
  `SHARD_TAG_PREFIX`; accept/reject + round-trip cases pass; existing retention tests
  unchanged and green; action-bundle-drift gate green.

## Commit 2 -- feat(release-asset-name): server-produced asset-name validator

- **files:** `packages/github-cache/src/lib/release-asset-name.ts`,
  `packages/github-cache/src/lib/release-asset-name.spec.ts`
- **action:** Add a NEW exported single-source validator
  `export function isServerProducedAssetName(name: string): boolean` matching the
  publisher's `<hash>-<os>` shape (equivalent to `^[a-f0-9]{1,512}-(windows|macos|linux)$`),
  mirroring the `isServerProducedKey` doc style. It MUST reuse `HASH_PATTERN`
  (import from `./cache-key.js`) for the hash half and the existing `CacheOs` value set
  for the OS half -- do NOT re-author the hex char-class and do NOT hardcode a second
  copy of the OS literals. To give the OS set a runtime source without a second copy,
  promote the `CacheOs` union to a single `const` tuple and derive the type from it,
  e.g. `export const CACHE_OS_VALUES = ['windows', 'macos', 'linux'] as const;` then
  `export type CacheOs = (typeof CACHE_OS_VALUES)[number];` (identical resolved type;
  `cachePlatform`/`releaseAssetName` runtime bodies unchanged). Implement by splitting
  on the LAST `-`: reject when there is no `-`, else validate the head with
  `HASH_PATTERN.test(...)` and the tail against `CACHE_OS_VALUES`. Extend
  `release-asset-name.spec.ts` with a describe block pinning the exact accept/reject
  sets: ACCEPT `abc123-linux`, `deadbeef-windows`, `0-macos` (single hex char), and a
  512-char-hash `-linux`; REJECT `ABC123-linux` (uppercase hash), `abc123-Linux`
  (uppercase os), `abc123-freebsd` (unknown os), `abc123` (no dash / missing os),
  `-linux` (empty hash), `abc123-` (empty os), `xyz-linux` (non-hex hash),
  `notes-backup` (non-hex head + unknown os). Add a round-trip guard:
  `isServerProducedAssetName(releaseAssetName('abc123' as Hash, p))` is true for each
  of win32/darwin/linux, so the accepter can never drift from the producer.
- **verify:** `npx nx test github-cache` (release-asset-name.spec passes incl. new cases)
  and `tsc --noEmit -p packages/github-cache/tsconfig.lib.json` green; `npm run check:action`
  reports no drift (regenerate + stage the bundle in this commit if it does).
- **done:** `isServerProducedAssetName` + `CACHE_OS_VALUES` exported; `CacheOs`
  derived from the tuple with no other file broken; accept/reject + round-trip cases
  pass; existing cachePlatform/releaseAssetName tests green; action-bundle-drift gate green.

## Commit 3 -- fix(cleanup): narrow release scope + asset guard (SC hardening)

- **files:** `packages/github-cache/src/cleanup/cleanup.ts`,
  `packages/github-cache/src/cleanup/cleanup.spec.ts`
- **action:** In `cleanup.ts`, replace the loose `release.tag_name.startsWith(SHARD_TAG_PREFIX)`
  scope filter (line ~76) with `!isShardTag(release.tag_name)` (import `isShardTag` from
  `../lib/retention.js`; drop the now-unused `SHARD_TAG_PREFIX` import, keep `MS_PER_DAY`).
  Add the asset-name guard as the FIRST statement in the per-asset loop, BEFORE
  `scanned++` and BEFORE the created_at parse: `if (!isServerProducedAssetName(asset.name)) { continue; }`
  (import `isServerProducedAssetName` from `../lib/release-asset-name.js`). Placing it
  first keeps `scanned` = genuine mirror assets considered and ensures a foreign asset
  with a malformed created_at is skipped silently (not warned about as ours). Add a
  short comment explaining the guard mirrors `isServerProducedKey`. Do NOT disturb the
  LIST-abort / per-item-isolation / 404-benign / NaN-created_at-retain semantics for
  genuine assets.

  MANDATORY FIXTURE RENAME (the new guard requires a lowercase-hex head): the existing
  `cleanup.spec.ts` fixtures use word-based "hash" heads that are NOT valid hex
  (`expired`, `fresh`, `gone`, `faulted`, `old`, `bad`), so the new
  `isServerProducedAssetName` guard would FILTER them and break those tests (deleteAsset
  never called, counts collapse to 0). Rename every non-hex head to a genuine `<hash>-<os>`
  hex name, keeping distinct heads per test so fixtures do not collide. The single-hex
  isolation fixtures `a-linux` / `b-linux` / `c-linux` are ALREADY valid hex -- leave them
  as-is. Apply this exact map:
  - LIST-abort test (`old-linux`, ~L76) -> `feed01-linux`
  - prune/retain test (`expired-linux`, `fresh-linux`, ~L146) -> `abc123-linux`, `deadbeef-linux`
  - 404-vs-5xx test (`gone-linux`, `faulted-linux`, ~L194) -> `c0ffee-linux`, `dec0de-linux`
  - observability test (`expired-linux`, `fresh-linux`, ~L214) -> `ba5eba11-linux`, `d15ea5e-linux`
  - malformed-created_at (NaN) test (`bad-timestamp`, ~L258) -> `abcdef-linux`

  Then the new/updated assertions:
  (a) NEW: a non-shard `cache-mirror-latest` (and/or `cache-mirror-backup`) release is
      skipped entirely -- `listAllAssets`/`deleteAsset` never called (proves the loose
      prefix no longer matches the exact `isShardTag`).
  (b) NEW: a foreign asset (e.g. `sbom.json`, no dash) inside a genuine `cache-mirror-202607`
      release is skipped (not pruned) while a genuine expired `deadc0de-linux` in the same
      release IS pruned -- assert `deleteAsset` called once with the genuine asset id. This
      test IS the "genuine <hash>-<os> still pruned" regression guard for the asset-name
      narrowing.
  (c) UPDATED, not kept-unchanged: the existing prune/retain and 404-vs-5xx tests are
      updated only by the fixture rename above; with genuine hex heads they resume
      exercising their original intent (expired-vs-fresh age cutoff; 404-benign vs
      5xx-real-failure) and now also confirm genuine `<hash>-<os>` assets still prune. Their
      assertion counts are unchanged by the rename -- the head is the only edit. (The prior
      `expired-linux` fixture did NOT establish the regression guard, because `expired` is
      not hex; test (b) is the guard.)
  (d) The malformed-created_at (NaN) test fixture (renamed `bad-timestamp` -> `abcdef-linux`)
      still reaches the NaN warn-and-retain path (scanned 1, not pruned, warning emitted).
      The original `bad-timestamp` would have been filtered by the name guard before the NaN
      check (`bad` is valid hex but `timestamp` is not a valid OS), which is exactly why the
      rename is required.
- **verify:** `npx nx test github-cache` (all cleanup tests green: new a/b, the
  fixture-renamed prune/retain + 404/5xx + observability + NaN tests, and the LIST-abort
  test) and `tsc --noEmit -p packages/github-cache/tsconfig.lib.json` green;
  `npm run check:action` green (cleanup.ts is not serve()-reachable, so no drift expected).
  Confirm each renamed fixture still exercises its original intent: expired-vs-fresh age
  cutoff, 404-benign vs 5xx-real-failure, list-abort-before-delete, NaN warn-and-retain.
- **done:** cleanup scopes releases via `isShardTag` and prunes only assets passing
  `isServerProducedAssetName`; non-shard release skipped (a); foreign asset skipped while a
  genuine expired `<hash>-<os>` is still pruned (b, the regression guard); all pre-existing
  cleanup tests pass with renamed genuine-hex fixtures preserving their original intent (c);
  NaN semantics preserved (d); no over-deletion path introduced.

## Final verification (post-commits)

Full local CI battery, matching PR #3 checks:
`npx nx build github-cache`, `npx nx test github-cache`,
`tsc --noEmit -p packages/github-cache/tsconfig.lib.json`,
`npx nx lint github-cache` (or the repo lint target),
`npx nx run github-cache:format-check` (or `npx nx format:check --all`),
`npm run fallow:ci`, `npm run pack:check`, `npm run check:action`.
All green. `.planning/` (other than this task's own artifacts) untouched.

## Scope guard

Only the six listed source/spec files change (plus `start-cache-server/index.js`
ONLY if `check:action` reports drift). Do NOT modify the existing locked retention
helpers, the reader/publisher, the server, or any workflow. No new dependencies.
