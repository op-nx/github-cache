---
phase: 04-publish-retention-observability
reviewed: 2026-07-20T12:00:00Z
depth: deep
files_reviewed: 16
files_reviewed_list:
  - packages/github-cache/src/lib/sync-gate.ts
  - packages/github-cache/src/lib/retention.ts
  - packages/github-cache/src/lib/github-identity.ts
  - packages/github-cache/src/lib/select-backend.ts
  - packages/github-cache/src/lib/local-context.ts
  - packages/github-cache/src/backend/releases-backend.ts
  - packages/github-cache/src/cleanup/cleanup.ts
  - packages/github-cache/src/cleanup/index.ts
  - packages/github-cache/src/publish/publish-mirror.ts
  - packages/github-cache/src/action/index.ts
  - packages/github-cache/src/roundtrip/read-back.ts
  - packages/github-cache/src/test/octokit-fault.ts
  - packages/github-cache/action.yml
  - packages/github-cache/package.json
  - .github/workflows/ci.yml
  - .github/workflows/cleanup.yml
findings:
  critical: 0
  warning: 3
  info: 5
  total: 8
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-07-20T12:00:00Z
**Depth:** deep
**Files Reviewed:** 16
**Status:** issues_found

## Summary

This phase wires the publish (mirror-to-Releases) and cleanup (age-prune) engines into live GitHub Actions workflows, plus the sync gate that trust-boundaries the publish path. I traced the full call graph: `action/index.ts` -> `publish-mirror.ts` -> `retention.ts`/`release-asset-name.ts`; `cleanup/index.ts` -> `cleanup.ts`; `sync-gate.ts`/`trust.ts` as the two independent trust predicates; `local-context.ts`/`github-identity.ts` -> `releases-backend.ts` for the cross-context reader. I also cross-referenced `.planning/phases/04-*` PLAN/SUMMARY/VERIFICATION docs against the shipped code to check whether documented invariants actually hold.

**No Critical/BLOCKER findings.** The three load-bearing security properties called out for this review all hold as designed:

- **Sync gate vs. write gate separation:** `sync-gate.ts`'s `SYNC_EVENTS`/`isSyncTrusted` is a genuinely separate declaration from `trust.ts`'s `TRUSTED_EVENTS`/`isWriteTrusted` (confirmed via `git grep` — neither imports the other), the default-branch check reads `GITHUB_EVENT_PATH`'s JSON payload (not `GITHUB_REF_NAME` alone), and it fails closed on every read/parse error. `sync-gate.spec.ts`'s content-pin test (`SYNC_EVENTS` deep-equals `['push','schedule']`) would catch an accidental merge with the write gate.
- **Fault discrimination** in `releases-backend.ts`, `cleanup.ts`, and `publish-mirror.ts` is structural on `error.status`/`res.status` throughout — 404 (or the reader's caught-exception boundary) is the only "absence" signal; every other status propagates as a real fault. Cleanup's LIST phase materializes fully before any `deleteAsset` call and aborts (zero deletions) on any list-phase throw.
- **Caps:** the ~2 GiB check in `publish-mirror.ts` runs before `ensureShardRelease`/any upload and throws (never truncates); the 1000-asset cap degrades to skip-and-warn.
- **Read-only-local invariant:** `createReleasesReadBackend.put()` unconditionally resolves `'forbidden'`, with no mode flag anywhere in `select-backend.ts`.

I did find three Warning-level robustness/observability gaps and five Info-level hardening notes, detailed below. None of them break the stated trust-boundary or fault-discrimination guarantees, but two of them (the cap race and the publish failure-visibility gap) are worth a maintainer decision.

## Warnings

### WR-01: Concurrent per-OS publish legs can race past the documented 1000-asset shard cap

**File:** `packages/github-cache/src/publish/publish-mirror.ts:196-209`
**Issue:** `ci.yml`'s `publish` job runs a `fail-fast: false` matrix over `[ubuntu-24.04-arm, windows-11-arm]` with no `max-parallel`, so both OS legs execute concurrently against the **same** month-shard release. Each leg independently calls `ensureShardRelease` + `listReleaseAssets` once (lazily, on its first restorable entry) and caches the resulting `existingNames` size locally for the rest of its own run — there is no re-fetch immediately before each upload. If both legs observe the shard at, say, 999 assets before either one uploads, both will treat the cap check (`existingNames.size >= RELEASE_ASSET_CAP`) as false and both will upload (different OS-suffixed names, so no name collision), pushing the shard to 1001 assets — one past the documented "at most 1000" invariant. This is a real, reachable race given the actual CI topology (not hypothetical), though the blast radius is small (bounded by the number of concurrent legs, currently 2) and the cap is explicitly documented as "soft" (skip-and-warn, never hard-fail), so it is not data-loss or security-critical.
**Fix:** Either accept this as a documented soft-cap approximation (add a one-line comment noting the per-run-only cap check is not race-free across concurrent OS legs), or re-fetch `listReleaseAssets` immediately before the cap check/upload for stronger enforcement:
```ts
if (existingNames.size >= RELEASE_ASSET_CAP && !existingNames.has(name)) {
  // Re-validate against the live shard before trusting the cached snapshot,
  // since another OS leg may have uploaded concurrently.
  existingNames = new Set(await client.listReleaseAssets(releaseId));
  if (existingNames.size >= RELEASE_ASSET_CAP && !existingNames.has(name)) {
    core.warning(/* ... */);
    skipped++;
    continue;
  }
}
```

### WR-02: Per-item publish failures never fail the CI job — a systemic 401/403/429/5xx would report green

**File:** `packages/github-cache/src/publish/publish-mirror.ts:233-240`, `packages/github-cache/src/action/index.ts:153-169`
**Issue:** `cleanupMirror` (`cleanup.ts:142-144`) explicitly calls `core.setFailed` when its aggregate `failed` count is nonzero (TEST-04). `publishMirror` has no equivalent: a per-item upload fault (401/403/429/5xx) is annotated via `core.warning` and counted into `result.failed`, but neither `publishMirror` itself nor its caller `runPublish` (`action/index.ts`) ever inspects `result.failed` to decide whether the job should fail. If every restorable entry in a run fails to upload (e.g., a token whose permissions regressed, or a sustained GitHub outage during the upload phase specifically), the job still exits 0 — the only visible trace is a `core.warning` annotation and a summary table cell, both easy to miss. Notably, `.planning/phases/04-publish-retention-observability/04-04-SUMMARY.md` states the `failed` count was added to the return shape specifically because *"the 04-06 bin needs the per-item `failed` count to fail loud for OBS-01/D-15"* — but the shipped 04-06 implementation only uses it for the summary table, not for `core.setFailed`. `04-VERIFICATION.md` reconciles this by treating OBS-01 as satisfied by "whole-run failure fails loud" alone, so this is not a regression against the *verified* requirement text, but it is a real gap against the *originally stated intent*, and a genuine observability blind spot in production.
**Fix:** Mirror cleanup's aggregate check in `runPublish` (or inside `publishMirror` itself, for symmetry with `cleanupMirror`):
```ts
const result = await publishMirror(createPublishClient(octokit, owner, repo, ref));
// ...summary emission...
if (result.failed > 0) {
  core.setFailed(`github-cache publish: ${result.failed} asset mirror(s) failed.`);
}
```

### WR-03: `runHelper`'s subprocess timeout relies on default SIGTERM with no escalation — a helper that ignores it can still hang past `HELPER_TIMEOUT_MS`

**File:** `packages/github-cache/src/lib/local-context.ts:47-68` (the `spawn(..., { timeout: HELPER_TIMEOUT_MS, ... })` call)
**Issue:** The doc comment states the explicit goal: *"A locked keychain or a network-probing credential helper would otherwise wedge the developer's build indefinitely; the safe direction on a slow helper is a cache MISS, not a hang."* Node's `child_process.spawn` `timeout` option only sends `killSignal` (default `SIGTERM`) once the timer elapses — it does not escalate to `SIGKILL` if the child ignores or is blocked from handling `SIGTERM` (e.g., stuck in an uninterruptible syscall, or a wrapper script that traps the signal). If that happens, the child's `'close'` event never fires, `runHelper`'s promise never settles, and the whole resolution chain (`resolveLocalReadToken` -> `createReleasesReadClient.fetchAsset` -> `createReleasesReadBackend.get`) hangs indefinitely despite the documented "MISS, not a hang" guarantee. This is a pre-existing Phase 2/3 code path (unchanged by this phase except the import source), but it is in this phase's review scope and the failure mode is exactly the one the surrounding comment claims is prevented. In practice `gh`/`git` rarely ignore SIGTERM, so likelihood is low; impact if it does occur is a wedged build, matching the exact class of failure this timeout exists to prevent.
**Fix:** Escalate after a grace period, e.g. pass `killSignal: 'SIGKILL'` (uncatchable) instead of relying on the default, or track the timer yourself and force-kill with `SIGKILL` if `SIGTERM` hasn't closed the child within a short grace window.

## Info

### IN-01: `GITHUB_REPOSITORY_PATTERN` accepts any non-slash character, not just valid GitHub owner/repo characters

**File:** `packages/github-cache/src/lib/github-identity.ts:15`
**Issue:** `/^[^/]+\/[^/]+$/` only guarantees "exactly one slash, both sides non-empty" — it does not restrict to GitHub's actual owner/repo character set (alphanumerics, hyphens, underscores, periods). A malformed `GITHUB_REPOSITORY` containing e.g. spaces or other unusual characters would pass this "fail-closed" guard in `select-backend.ts`, `cleanup/index.ts`, and `action/index.ts`, and only fail downstream (as a mangled/percent-encoded URL segment when passed to `fetch()`, typically resulting in a 404). Not exploitable as written (no filesystem path use of `repo`, and `fetch()` percent-encodes the string), but it undercuts the stated intent ("a corrupted repository identity... must fail loudly") since the loud failure doesn't happen at the validation boundary, it happens later as a generic HTTP fault.
**Fix:** Tighten the pattern to GitHub's actual identifier grammar, e.g. `/^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?\/[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?$/` (or reuse whatever validation `@octokit/rest` types already imply).

### IN-02: `cleanupMirror` never deletes now-empty month-shard release objects, only their assets

**File:** `packages/github-cache/src/cleanup/cleanup.ts:80-147`
**Issue:** The DELETE phase only calls `client.deleteAsset`; there is no code path that removes a `cache-mirror-*` Release once all of its assets have aged out. Over a long enough retention cycle this leaves an ever-growing set of empty Releases in the repo (harmless functionally — `ensureShardRelease`/`fetchAssetFromShard` don't care whether a release has assets — but it is unbounded clutter in the Releases tab and a minor discoverability/hygiene cost).
**Fix:** Optional: after the DELETE phase, if a `cache-mirror-*` release's asset count reaches zero, call an (currently absent) `deleteRelease` on the `CleanupClient` seam. Given the modest cost, this can reasonably stay deferred.

### IN-03: `shardTagsForWindow` has no input validation of its own; it fully depends on callers pre-clamping via `resolveMaxAgeDays`

**File:** `packages/github-cache/src/lib/retention.ts:67-86`
**Issue:** Passed a non-positive `maxAgeDays` (e.g. `-5`), `shardTagsForWindow` computes an `oldest` timestamp **in the future**, which can make `oldestMonthStart` exceed the current month's start, causing the `while` loop to execute zero times and return an **empty array**. Every current call site (`releases-backend.ts:296`) routes through `resolveMaxAgeDays` first, which clamps non-positive/non-finite input to the 30-day default, so this is unreachable in production today. But the file's own doc comment calls this function "LOAD-BEARING, comment-locked" and it is a public export with no assertion of its own — a future caller that invokes it directly (bypassing `resolveMaxAgeDays`) would silently get zero shard tags, i.e. every read immediately MISSes with no error.
**Fix:** Either clamp defensively inside `shardTagsForWindow` itself (`maxAgeDays = Math.max(1, maxAgeDays)`), or add an explicit runtime assertion/comment making the "callers must pre-validate" contract enforced rather than just documented.

### IN-04: `publish-mirror.ts`'s Actions-cache restore is not isolated per-item the way uploads are

**File:** `packages/github-cache/src/publish/publish-mirror.ts:172-179`
**Issue:** `actionsCache.get(hash)` (backed by the real, non-injected `createActionsCacheBackend()`) is called directly inside the per-hash loop with no `try/catch` around it, unlike the upload call a few lines later which isolates failures per item (D-13). If `restoreCache` were ever to throw for a single hash (today it does not, per `@actions/cache`'s internal fault-swallowing, but that's an external library's behavior, not a contract enforced by this module), the throw would abort the **entire** batch rather than being isolated to that one hash — an asymmetry with the documented per-item-isolation philosophy used elsewhere in this same function.
**Fix:** For defensive symmetry, wrap the restore call the same way uploads are wrapped, treating an unexpected restore throw as a per-item `failed` rather than a whole-run abort — or add a comment explaining why restore is deliberately whole-run (unlike upload) if that asymmetry is intentional.

### IN-05: `GITHUB_API` is hardcoded to `https://api.github.com`, so this reader cannot target a GitHub Enterprise Server host

**File:** `packages/github-cache/src/backend/releases-backend.ts:100`
**Issue:** Not a defect against this project's stated scope (public GitHub only, per the phase's own design docs), but worth a one-line note for future portability: any adopter on GHES would silently read/write against the wrong API host with no configuration surface to correct it.
**Fix:** No action needed unless GHES support becomes in-scope; if it does, thread `GITHUB_API_URL`/`GITHUB_SERVER_URL` through the injected env bag the same way `GITHUB_REPOSITORY`/tokens already are.

---

_Reviewed: 2026-07-20T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
