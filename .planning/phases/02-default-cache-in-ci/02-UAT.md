---
status: testing
phase: 02-default-cache-in-ci
source: [02-VERIFICATION.md]
started: 2026-07-19T13:00:00Z
updated: 2026-07-19T13:00:00Z
---

## Current Test

number: 1
name: Live cross-job GitHub Actions cache HIT on default-branch push (ROADMAP SC5)
expected: |
  After this branch merges to the default branch, the push-triggered workflow run shows
  `dogfood-seed` reporting a stored PUT (200) and `dogfood-verify` reporting a cache HIT
  (GET 200) with matching bytes, keyed on the same `github.run_id`. `dogfood-verify` logs
  "cache HIT for <run_id> with matching bytes."
awaiting: user response

## Tests

### 1. Live cross-job Actions-cache HIT (ROADMAP SC5, ROBUST-03 end-to-end)
expected: |
  Push this branch to the default branch, open the resulting workflow run, and confirm:
  - `dogfood-seed` reports a stored PUT (200).
  - `dogfood-verify` (needs: dogfood-seed, same `github.run_id`) reports a cache HIT (GET 200)
    with matching bytes.
  A MISS (404) or byte mismatch means the round-trip did not reach GitHub's real Actions-cache
  service -- investigate the archive path and the pinned `@actions/cache@6.2.0` version before
  treating the phase as complete.
why_human: |
  The real `@actions/cache` v2 twirp protocol only runs inside a JS action on genuine
  GitHub-hosted CI; `ACTIONS_RUNTIME_TOKEN` / `ACTIONS_RESULTS_URL` are injected only into that
  runtime and cannot be faked locally. `act` implements only the legacy v1 REST protocol, and
  this arm64/QEMU host would emulate x86 runner images even if it could. Every precondition is
  independently confirmed green in-repo; only the live cross-job HIT requires a real
  push-triggered workflow run, which does not exist on this unpushed branch.
result: [pending]

## Summary

total: 1
passed: 0
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps
