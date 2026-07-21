---
status: testing
phase: 06-distribution-docs-governance
source: [06-VERIFICATION.md]
started: 2026-07-21T00:20:00Z
updated: 2026-07-21T00:20:00Z
---

## Current Test

number: 1
name: consumer-smoke CI job goes green on the next default-branch push
expected: |
  On the next default-branch push, the `consumer-smoke` job in
  `.github/workflows/ci.yml` (uses `./start-cache-server` with `background: true`,
  exports `NX_SELF_HOSTED_REMOTE_CACHE_SERVER` / `_ACCESS_TOKEN`, runs a scripted
  PUT+GET, then `cancel: cache-server`) goes green: the readiness poll succeeds,
  PUT returns 200, the GET byte-matches the PUT payload, and the job does not hang
  at teardown.
awaiting: user response

## Tests

### 1. consumer-smoke live round-trip (DOCS-06)
expected: The `consumer-smoke` CI job goes green - background-step export-variable
  propagation reaches the later `run:` step, a real PUT/GET round-trips through the
  write-trusted Actions-cache backend over the loopback sidecar, and `cancel:`
  drains the never-exiting `serve()` (SIGTERM -> ROBUST-04 drain -> clean exit)
  without hanging the job.
why_manual: core.exportVariable propagation from a `background: true` step and the
  background-steps engine's interaction with `cancel:` are GitHub Actions runtime
  behaviors not reproducible in local Vitest. The branch is 30 commits ahead of
  origin and unmerged, so this exact code has not run on a real push yet. Same
  first-push live-close pattern as Phase 4 (cross-OS mirror round-trip) and Phase 5
  (PPE live-findings proof).
result: [pending]

## Summary

total: 1
passed: 0
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps
