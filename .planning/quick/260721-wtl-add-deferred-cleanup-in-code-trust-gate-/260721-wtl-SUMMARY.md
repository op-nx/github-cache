---
quick_id: 260721-wtl
title: Add deferred cleanup in-code trust gate (narrow schedule-safe predicate)
status: complete
completed: 2026-07-21
commits:
  - 44df14d feat(sync-gate): add isTrustedSyncEvent narrow cleanup trust predicate
  - f7e7f74 feat(cleanup): gate run() on isTrustedSyncEvent (defense-in-depth)
---

# Quick Task 260721-wtl - Summary

Closed the single item deferred from PR #3 security-review round 7: the Releases-mirror
cleanup delete path (`cleanup/index.ts run()`) had no in-code trust gate. Added one as
defense-in-depth (CREEP C2 / RETAIN-03) without reintroducing the deferred fail-closed
trap.

## What shipped

- **`lib/sync-gate.ts` -> `isTrustedSyncEvent(env)`**: `GITHUB_ACTIONS === 'true' &&
  GITHUB_EVENT_NAME in SYNC_EVENTS`. Reuses SYNC_EVENTS as the single source of truth.
  Deliberately narrower than `isSyncTrusted` -- it does NOT read
  `repository.default_branch`, so it cannot fail-closed on the happy path.
- **`cleanup/index.ts`**: gate wired FIRST in `run()` (mirrors `runPublish`); gated-out
  => `core.info` + clean return (never `setFailed`). `run()` exported so the wiring is
  testable-by-import.
- **Tests**: `sync-gate.spec.ts` +7 (incl. the anti-fail-closed proof: trusts `schedule`
  with NO `GITHUB_EVENT_PATH`); new `cleanup/index.spec.ts` (4) proving a gated-out
  context never constructs Octokit nor reaches `cleanupMirror`.

## Why the narrow gate (not `isSyncTrusted`)

Reviewers reflexively want `isSyncTrusted` on cleanup. That reads `repository.default_branch`
from the SYNTHESIZED `schedule` payload -- a field GitHub does not contractually guarantee.
If absent, cleanup silently no-ops every run and the mirror leaks toward the 1000-asset cap
(the retention-LOCKED failure `retention.ts` guards). The default-branch check is also
redundant for cleanup: GitHub runs `schedule` only on the default branch.

## Empirical probe (temporary workflow on `main`, then reverted)

To settle the open question authoritatively, a throwaway `schedule` probe workflow ran on
`main` (add `ca2124b` -> revert `c06664f`; `main` net-unchanged). Result on the real
`schedule` run (`29874290591`): `event_name=schedule`, `ref=refs/heads/main`,
`ref_name=main`, `GITHUB_ACTIONS=true`, and `repository.default_branch = main` **PRESENT**.
So `isSyncTrusted` would NOT have fail-closed today. The narrow gate is kept regardless:
"present today" is not a contract, and the branch check is redundant for cleanup -- so a
retention-LOCKED path should not depend on it. See `260721-wtl-PROBE.md`.

## Verification

- `nx test github-cache`: 384 pass (373 -> 384: +7 predicate, +4 gate-wiring).
- typecheck / format:check / fallow:ci (0 issues) / check:action (no bundle drift --
  cleanup is not serve()-reachable) / pack:check: all green.
- PR #3 CI: green on the full cross-OS matrix (`29871165963`).
