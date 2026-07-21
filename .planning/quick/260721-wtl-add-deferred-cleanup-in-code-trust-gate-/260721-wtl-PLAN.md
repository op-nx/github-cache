---
quick_id: 260721-wtl
title: Add deferred cleanup in-code trust gate (narrow schedule-safe predicate)
status: planned
created: 2026-07-21
must_haves:
  truths:
    - The cleanup delete path has an in-code trust gate that runs FIRST in run().
    - The gate CANNOT fail-closed on the happy path (a real schedule run in Actions),
      so scheduled retention cleanup is never silently disabled (retention-LOCKED).
    - The gate does NOT depend on repository.default_branch (unlike isSyncTrusted).
    - A gated-out context never constructs the Octokit client nor calls cleanupMirror.
  artifacts:
    - packages/github-cache/src/lib/sync-gate.ts (isTrustedSyncEvent)
    - packages/github-cache/src/lib/sync-gate.spec.ts (predicate tests + anti-fail-closed proof)
    - packages/github-cache/src/cleanup/index.ts (gate wired first; run() exported)
    - packages/github-cache/src/cleanup/index.spec.ts (gate-wiring tests)
  key_links:
    - packages/github-cache/src/action/index.ts (runPublish gate-first pattern mirrored)
    - packages/github-cache/src/lib/retention.ts (retention-LOCKED discipline guarded)
---

# Quick Task 260721-wtl: Cleanup in-code trust gate (defense-in-depth)

## Objective

Close the single item deferred from PR #3 security-review round 7: cleanup
(`cleanup/index.ts run()`) had no in-code trust gate. Add one as defense-in-depth
(CREEP C2 / RETAIN-03) WITHOUT reintroducing the deferred trap.

## Decided design (locked, not reopened)

Reviewers reflexively want `isSyncTrusted` wired into cleanup. That is the trap:
`isSyncTrusted` reads `repository.default_branch` from the SYNTHESIZED `schedule`
event payload, a field GitHub does not contractually guarantee for scheduled runs.
If absent, the gate returns `not-default-branch`, cleanup silently no-ops every run,
and the mirror leaks toward the 1000-asset cap -- the exact retention-LOCKED failure
`retention.ts` guards.

Instead: a NEW narrow predicate `isTrustedSyncEvent(env)` =
`GITHUB_ACTIONS === 'true' && GITHUB_EVENT_NAME in SYNC_EVENTS`, reusing SYNC_EVENTS
as the single source of truth. It does NOT read the default branch (redundant anyway:
GitHub runs `schedule` only on the default branch), so it CANNOT fail-closed on the
happy path.

## Tasks

1. `sync-gate.ts`: add `isTrustedSyncEvent`. `sync-gate.spec.ts`: unit tests incl. the
   anti-fail-closed proof (trusts `schedule` with NO `GITHUB_EVENT_PATH`).
2. `cleanup/index.ts`: gate `run()` FIRST on `isTrustedSyncEvent` (mirror `runPublish`);
   gated-out => `core.info` + clean return (never `setFailed`). Export `run()`.
   `cleanup/index.spec.ts`: prove a gated-out context never constructs Octokit / calls
   cleanupMirror.
3. Full CI battery green (nx test, typecheck, fallow:ci, format:check, check:action,
   pack:check). Empirical schedule-payload probe on `main` documents the fact the
   design sidesteps. Append PR #3 body round 8.

## Verify

- `nx test github-cache` green (predicate tests + gate-wiring tests).
- `check:action` clean (cleanup is not serve()-reachable -> no bundle drift).
