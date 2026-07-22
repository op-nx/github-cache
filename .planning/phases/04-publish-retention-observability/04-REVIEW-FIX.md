---
phase: 04-publish-retention-observability
fixed_at: 2026-07-20T07:40:04Z
review_path: .planning/phases/04-publish-retention-observability/04-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 3
skipped: 0
status: all_fixed
---

# Phase 04: Code Review Fix Report

**Fixed at:** 2026-07-20T07:40:04Z
**Source review:** .planning/phases/04-publish-retention-observability/04-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 3 (WR-01, WR-02, WR-03 -- all Warning severity; the 5 Info findings are out of the critical_warning scope and were not attempted)
- Fixed: 3
- Skipped: 0

All gates green after the fixes: `nx test github-cache` (227 passed), `nx typecheck github-cache`, `nx build github-cache`, `nx format:check --all` (exit 0), `npm run fallow:ci` (0 issues, 0 cycles).

## Fixed Issues

### WR-01: Concurrent per-OS publish legs can race past the 1000-asset shard cap

**Files modified:** `.github/workflows/ci.yml`
**Commit:** aeb18c0
**Applied fix:** Added `max-parallel: 1` to the `publish` job's matrix `strategy`, serializing the two OS legs.

**Choice rationale (option b over option a):** The task offered (a) accept-as-soft-cap plus a comment, or (b) `max-parallel: 1` if it is a clean one-line YAML change that does not break per-OS isolation. Both conditions hold here, so the operative decision rule selects (b). Serialization makes the later leg's `listReleaseAssets` observe the earlier leg's uploads, so the cap check reads the true count instead of racing two stale 999-asset snapshots to 1001. Per-OS isolation is untouched (each leg still runs on its own OS and mirrors only the entries it can restore), `fail-fast: false` is preserved (a Windows-only failure never hides the ubuntu result), and the only cost is a little wall-clock on this push-only background mirror job. This deterministically removes the race rather than merely documenting it as (a) would.

### WR-02: Per-item publish failures never fail the CI job

**Files modified:** `packages/github-cache/src/publish/publish-mirror.ts`, `packages/github-cache/src/publish/publish-mirror.spec.ts`, `packages/github-cache/src/action/index.ts`
**Commit:** 5697abb
**Applied fix:** `publishMirror` now calls `core.setFailed(...)` when its aggregate `failed` count is nonzero, after the per-item loop, mirroring `cleanupMirror`'s aggregate check. Per-item faults remain isolated and counted (D-13); only the count is logged, never a token. Updated the engine doc block and the `runPublish` doc comment to reflect the aggregate fail-loud. Added two tests: a run with `failed > 0` asserts `core.setFailed` is called (with the count in the message); a clean whole-run success (`failed == 0`) asserts it is not.

**Location rationale (engine vs. runPublish):** The REVIEW fix text sanctions either `runPublish` or "inside publishMirror itself, for symmetry with cleanupMirror." I chose the engine because (1) it is the more symmetric option -- `cleanupMirror` owns its own aggregate `setFailed`, and putting it in `publishMirror` makes the two engines behave identically; and (2) it is the testable seam -- `action/index.ts` invokes `run()` at module load and does not export `runPublish`, so the engine spec (`publish-mirror.spec.ts`) is the clean place to assert the behavior without an entry-point refactor. Outcome is identical to the runPublish placement: the job exits non-zero on a degraded mirror and the OBS-01 summary is still written (the summary emission in `runPublish` runs after the engine returns; `core.setFailed` sets the exit code without halting execution, so ordering is immaterial).

### WR-03: runHelper's subprocess timeout relied on catchable SIGTERM

**Files modified:** `packages/github-cache/src/lib/local-context.ts`, `packages/github-cache/src/lib/local-context.spec.ts`
**Commit:** 03ffd1b
**Applied fix:** Added `killSignal: 'SIGKILL'` to the hardened `spawn` options so the `timeout`-triggered kill is uncatchable. A wrapper helper that traps or ignores the default SIGTERM could otherwise survive the timer, never fire `'close'`, leave `runHelper`'s promise unsettled, and wedge the resolution chain -- the exact "MISS, not a hang" failure the timeout exists to prevent. On Windows every kill already maps to a forceful TerminateProcess, so this only strengthens the POSIX path where SIGTERM is catchable; a child stuck in an uninterruptible syscall is unkillable by any signal and out of scope. Extended the existing "spawns git credential fill hardened" test to assert `killSignal === 'SIGKILL'`.

## Out of Scope (not attempted)

The fix scope was `critical_warning`, so the 5 Info findings were not attempted:

- **IN-01:** `GITHUB_REPOSITORY_PATTERN` accepts any non-slash characters (tighten to GitHub's identifier grammar).
- **IN-02:** `cleanupMirror` never deletes now-empty month-shard Release objects, only their assets.
- **IN-03:** `shardTagsForWindow` has no input validation of its own; depends on callers pre-clamping via `resolveMaxAgeDays`.
- **IN-04:** `publish-mirror.ts`'s Actions-cache restore is not isolated per-item the way uploads are.
- **IN-05:** `GITHUB_API` is hardcoded to `https://api.github.com` (no GHES host support).

These remain open in 04-REVIEW.md for a future maintainer decision.

---

_Fixed: 2026-07-20T07:40:04Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
