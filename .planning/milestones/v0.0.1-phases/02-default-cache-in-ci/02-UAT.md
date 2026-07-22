---
status: passed
phase: 02-default-cache-in-ci
source: [02-VERIFICATION.md]
started: 2026-07-19T13:00:00Z
updated: 2026-07-19T14:30:00Z
---

## Current Test

number: 1
name: Live cross-job GitHub Actions cache HIT on default-branch push (ROADMAP SC5)
expected: |
  After a push to the default branch, the workflow run shows `dogfood-seed` reporting a
  stored PUT (200) and `dogfood-verify` reporting a cache HIT (GET 200) with matching
  bytes, keyed on the same `github.run_id`.
awaiting: none -- passed

## Tests

### 1. Live cross-job Actions-cache HIT (ROADMAP SC5, ROBUST-03 end-to-end)
expected: |
  A push to the default branch runs `dogfood-seed` (PUT 200, stored) and `dogfood-verify`
  (needs: dogfood-seed, same `github.run_id`) reporting a cache HIT with matching bytes.
why_human: |
  The real `@actions/cache` v2 twirp protocol only runs inside a JS action on genuine
  GitHub-hosted CI; `ACTIONS_RUNTIME_TOKEN` / `ACTIONS_RESULTS_URL` are injected only into
  that runtime and cannot be faked locally (`act` implements only the legacy v1 REST
  protocol). Confirmed by an actual push-triggered workflow run.
result: passed
evidence: |
  CI run 29685631933 (push to origin/main at b9c513d), all 9 jobs green:
    dogfood-seed:   "github-cache dogfood seed: stored 29685631933 (PUT 200)."
    dogfood-verify: "Cache hit for: nx-cache-29685631933"
                    "Cache restored successfully"
                    "github-cache dogfood verify: cache HIT for 29685631933 with matching bytes."
  Bearer token masked as ***. The run also depended on the lockfile fix from quick task
  260719-in3 (without it, npm ci failed on every job). origin/main was subsequently
  restored to the pre-Phase-2 backup per plan; the work + fix live on
  gsd/v0.0.1-greenfield-rebuild (16e9479).

## Summary

total: 1
passed: 1
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
