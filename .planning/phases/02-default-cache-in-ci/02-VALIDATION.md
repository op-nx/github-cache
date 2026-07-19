---
phase: 2
slug: default-cache-in-ci
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-19
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Draft — the per-task map + Wave 0 list are finalized by `/gsd:validate-phase`
> (gsd-nyquist-auditor) after execution. Seeded from 02-RESEARCH.md "## Validation Architecture".

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (via `@nx/vitest` inferred `test` target) |
| **Config file** | `packages/github-cache/vitest.config.ts` |
| **Quick run command** | `npx nx test github-cache` |
| **Full suite command** | `npx nx run-many -t test` |
| **CI-only e2e canary** | `npx nx run github-cache:test:act` (self-skips locally when `ACTIONS_RUNTIME_TOKEN` absent — R-01: real-CI restore, not local `act`) |
| **Estimated runtime** | ~5-15 seconds (unit); e2e canary runs only in CI |

---

## Sampling Rate

- **After every task commit:** Run `npx nx test github-cache`
- **After every plan wave:** Run `npx nx run-many -t test typecheck`
- **Before `/gsd:verify-work`:** Full suite green + the CI dogfood job shows a real HIT
- **Max feedback latency:** ~15 seconds (unit); the `@actions/cache` end-to-end HIT is CI-only by construction (R-01/R-02)

---

## Per-Task Verification Map

*Filled by `/gsd:validate-phase` (gsd-nyquist-auditor) after execution. Requirement -> test-type seed from 02-RESEARCH.md "## Validation Architecture":*

| Requirement | Secure Behavior | Test Type | Notes |
|-------------|-----------------|-----------|-------|
| TEST-01 | `selectBackend(env)` context-derived RW/RO; no caller flag | unit | CI-vs-local, `GITHUB_REPOSITORY` validation, `GH_TOKEN`\|\|`GITHUB_TOKEN` fallthrough, malformed-repo rejection, explicit `env` |
| TEST-02 | `withHashLock` serialize/concurrent/evict/no-wedge | unit | promise-map concurrency spec (deterministic, no real timers) |
| TRUST-03 | dangerous events refused; only `{push,schedule}` trusted | unit | assert exact trusted set + each dangerous event -> RO |
| TRUST-05 | RW/RO derived from runtime context, no caller-facing mode | unit | folded with TEST-01; assert no mode param exists on the public surface |
| ROBUST-04 | `serve` SIGTERM drains in-flight put before exit | unit/integration | in-flight-put drain test (no lost write at teardown) |
| ROBUST-03 | `@actions/cache` pinned exact; upgrade gated by e2e restore | CI-only canary | real-CI HIT assertion (local `act` cannot back `@actions/cache` 6.x twirp — R-01) |

---

## Wave 0 Requirements

*Finalized by the nyquist auditor. Seed (from research):*

- [ ] `packages/github-cache/src/lib/select-backend.spec.ts` — TEST-01 stubs (written first, TDD)
- [ ] `packages/github-cache/src/lib/with-hash-lock.spec.ts` — TEST-02 stubs
- [ ] `packages/github-cache/src/lib/trust.spec.ts` — TRUST-03/TRUST-05 stubs
- [ ] `packages/github-cache/src/serve.spec.ts` — ROBUST-04 SIGTERM-drain case (extends existing serve spec)
- [ ] No new framework install — Vitest already inferred by `@nx/vitest`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real Actions-cache HIT in CI (dogfood) | ROBUST-03, SC5 | `ACTIONS_RUNTIME_TOKEN`/`ACTIONS_RESULTS_URL` injected only in a runner's action runtime; cannot be faked locally | Push to a branch; the `seed`->`verify` dogfood jobs must show `restoreCache` returning a cache key (HIT) keyed on `github.run_id` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
