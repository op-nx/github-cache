---
phase: 2
slug: default-cache-in-ci
status: verified
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-19
validated: 2026-07-19
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

*Finalized by `/gsd:validate-phase` (gsd-nyquist-auditor), 2026-07-19. Each mapping below was
independently re-verified against the actual spec code and re-run live (not trusted from
SUMMARY/VERIFICATION claims).*

| Requirement | Secure Behavior | Test Type | Status | Evidence |
|-------------|-----------------|-----------|--------|----------|
| TEST-01 | `selectBackend(env)` context-derived RW/RO; no caller flag | unit | COVERED | `packages/github-cache/src/lib/select-backend.spec.ts` — 22 tests, all pass. Independently confirmed non-tautological: drives the returned backend's `put`/`get` behaviorally (not identity checks); covers CI+push/schedule -> writable, all 6 dangerous events + unset event + no-`GITHUB_ACTIONS` -> `forbidden`; malformed/absent/empty-segment `GITHUB_REPOSITORY` -> throws; absent/empty token -> degrades (does not throw); `GH_TOKEN`\|\|`GITHUB_TOKEN` fallthrough incl. set-but-empty; a `process.env`-never-mutated assertion. `npx nx test github-cache` re-run green. |
| TEST-02 | `withHashLock` serialize/concurrent/evict/no-wedge | unit | COVERED | `packages/github-cache/src/lib/with-hash-lock.spec.ts` — 4 tests, all pass. Deterministic via deferred promises + a shared order log (`git grep` confirms no `setTimeout`-based sequencing). All four properties asserted non-vacuously: serialize (exact order log), concurrent (both start before either resolves), evict (`inFlightHashCount()` returns to a captured baseline), no-wedge (rejection reaches its own caller; next same-hash op still runs). Also independently confirmed WIRED into `serve.ts`'s real write path by `serve.spec.ts`'s "TEST-02 wiring" tests (exact-order proof, not presence-only). |
| TRUST-03 | dangerous events refused; only `{push,schedule}` trusted | unit | COVERED | `packages/github-cache/src/lib/trust.spec.ts` — 18 tests, all pass: `push`/`schedule` -> true; an 11-entry `REFUSED_EVENTS` table (`pull_request`, `pull_request_target`, `issue_comment`, `workflow_run`, `workflow_dispatch`, `repository_dispatch`, `merge_group`, `release`, `delete`, `registry_package`, `page_build`) all -> false; unset event, non-CI, `GITHUB_ACTIONS: 'false'`, empty bag all -> false; `TRUSTED_EVENTS` deep-equals `['push','schedule']` (content pin, not a substring/length check). `git grep -c 'export const TRUSTED_EVENTS'` = 1 (single source of truth). |
| TRUST-05 | RW/RO derived from runtime context, no caller-facing mode | unit (structural + behavioral) | COVERED | Folded into `select-backend.spec.ts`'s `'TRUST-05: no caller-facing mode surface'` describe block. Confirmed genuinely non-vacuous (not the class of tautological test this repo has shipped before, per 01-REVIEW.md WR-01): structural (`selectBackend.length === 0`) AND behavioral (an UNTRUSTED env bag carrying `MODE`, `FORCE_WRITABLE`, `NX_CACHE_MODE`, `writable`, `readOnly` override-shaped keys still yields `put -> 'forbidden'`, driven through the real function, not a stub). |
| ROBUST-04 | `serve` SIGTERM drains in-flight put before exit; bounded grace | unit/integration | **PARTIAL -> FILLED** | Original 3 tests in `serve.spec.ts`'s `'serve SIGTERM drain (ROBUST-04)'` block all called `shutdown()` **directly** or only asserted listener-count bookkeeping — none of them fired the actual `process.once('SIGTERM', onSigterm)` registration that production relies on, so a regression where `onSigterm` called `process.exit(0)` before (not after) the drain settled would have passed every existing test. Gap-filled: added `'a real SIGTERM event drains the in-flight put before process.exit is called (ROBUST-04)'`, which fires a real `process.emit('SIGTERM')` (with `process.exit` stubbed) and asserts `process.exit` is deferred until the gated in-flight put actually settles. Debugged in 2 iterations: iteration 1 hit a test-file-only fixture bug (unrelated to the new assertion) — `with-hash-lock`'s module-global lock map permanently queues behind the file's pre-existing "hung put never settles" test if the same hash (`abcdef`) is reused, confirmed by reproducing the identical hang with a verbatim duplicate of an already-passing test at the same position; fixed by using a hash unique to this test (`deadbeef01`). All 10 `serve.spec.ts` tests + full 101-test suite pass green after the fix; `npx nx run-many -t typecheck build` green; `npx nx format:check --all` clean. |
| ROBUST-03 | `@actions/cache` pinned exact; upgrade gated by e2e restore | unit (pin) + CI-only canary | COVERED | Pin: `packages/github-cache/src/pinned-deps.spec.ts` — 2 tests, pass; asserts `/^\d+\.\d+\.\d+$/` against the live manifest for both `@actions/cache` and `@actions/core`. Backend mapping: `actions-cache-backend.spec.ts` (10 tests) + `cache-archive-path.spec.ts` (3 tests, literal filename spelled out, non-tautological). Real e2e canary: correctly classed Manual-Only (see below) — confirmed live on CI run 29685631933 (push to `main` at `b9c513d`): `dogfood-seed` logged a stored PUT 200, `dogfood-verify` logged a real cross-job cache HIT with matching bytes (per 02-VERIFICATION.md and the orchestrator's report). |

---

## Wave 0 Requirements

*Finalized by the nyquist auditor, 2026-07-19. All Wave 0 gaps are closed.*

- [x] `packages/github-cache/src/lib/select-backend.spec.ts` — TEST-01 + TRUST-05 (22 tests, pass)
- [x] `packages/github-cache/src/lib/with-hash-lock.spec.ts` — TEST-02 (4 tests, pass)
- [x] `packages/github-cache/src/lib/trust.spec.ts` — TRUST-03 (18 tests, pass)
- [x] `packages/github-cache/src/serve.spec.ts` — ROBUST-04 SIGTERM-drain (10 tests, pass; the real-signal
      drain-defers-exit case was added by this audit pass — see "Validation Audit" trail below)
- [x] No new framework install — Vitest already inferred by `@nx/vitest`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions | Status |
|----------|-------------|------------|-------------------|--------|
| Real Actions-cache HIT in CI (dogfood) | ROBUST-03, SC5 | `ACTIONS_RUNTIME_TOKEN`/`ACTIONS_RESULTS_URL` injected only in a runner's action runtime; cannot be faked locally | Push to a branch; the `seed`->`verify` dogfood jobs must show `restoreCache` returning a cache key (HIT) keyed on `github.run_id` | **CONFIRMED** — CI run 29685631933 (push to `main` at `b9c513d`): `dogfood-seed` logged `stored 29685631933 (PUT 200)`; `dogfood-verify` logged `cache HIT for 29685631933 with matching bytes`. Per 02-VERIFICATION.md's resolved `human_needed` item. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (none remained MISSING; one PARTIAL was found and filled)
- [x] No watch-mode flags
- [x] Feedback latency < 15s (unit suite runs in ~1.5-2s; the one CI-only item is out-of-band by construction)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** granted (gsd-nyquist-auditor, 2026-07-19)

---

## Validation Audit 2026-07-19

**Auditor:** gsd-nyquist-auditor (independent pass; did not rubber-stamp the orchestrator's
preliminary 0-gaps read)

**Gaps found:** 1
**Gaps resolved (FILLED):** 1
**Gaps escalated (BLOCKER):** 0

### Finding: ROBUST-04 was PARTIAL, not fully COVERED

All three pre-existing tests in `serve.spec.ts`'s `'serve SIGTERM drain (ROBUST-04)'` block
exercised `RunningServer.shutdown()` by calling it **directly**, or only asserted that
`process.listeners('SIGTERM').length` changed. None of them actually fired the
`process.once('SIGTERM', onSigterm)` listener that production code registers, so the
composition `onSigterm` performs — `void shutdown().then(() => process.exit(0))` — was never
exercised end-to-end. A regression that called `process.exit(0)` before the drain settled (e.g.
`shutdown(); process.exit(0);` instead of the correct `.then()` chain) would have passed every
existing test.

**Test added:** `'a real SIGTERM event drains the in-flight put before process.exit is called
(ROBUST-04)'` in `packages/github-cache/src/serve.spec.ts`. It fires a real `process.emit('SIGTERM')`
(with `process.exit` stubbed via `vi.spyOn`) against a gated in-flight put, asserts `process.exit`
has NOT been called while the put is still pending, then releases the put and asserts
`process.exit` was called with `0` only after the drain genuinely completed.

**Debug loop (2 iterations, both resolved — no implementation change):**
1. **Iteration 1 — timeout, not an assertion failure.** The new test hung for the full test
   timeout when run as part of the whole `serve.spec.ts` file, but passed in isolation. Root-caused
   by reproducing the identical hang with a byte-for-byte duplicate of an already-passing test
   placed at the same position in the file — proving the hang was a **pre-existing test-fixture
   defect**, not a bug in the new assertion or in `serve.ts`/`with-hash-lock.ts`. Cause: `with-hash-lock`'s
   lock map is module-global (by design, per its own doc-comment and D-03); the preceding
   `'shutdown() resolves within the bounded grace even if a put never settles'` test uses hash
   `'abcdef'` for a put whose gate is **deliberately never released** (that is the point of the
   hung-write test) and never cleans up the module-global map entry. Any later test reusing that
   same hash queues forever behind the abandoned promise. This had been latent and undetected
   because no pre-existing test reused `'abcdef'` in a `put` after that test ran.
2. **Iteration 2 — fixed the test fixture.** Changed the new test's hash to `'deadbeef01'` (unique
   across the file, valid lowercase-hex per `HASH_PATTERN`), added a comment documenting the hazard
   for future spec authors. Re-ran: full file green (10/10), full suite green (101/101),
   `npx nx run-many -t typecheck build` green, `npx nx format:check --all` clean.

**Verdict:** FILLED. No implementation bug — `serve.ts`'s `onSigterm`/`shutdown()` composition is
correct as written; the gap was in test coverage (an untested seam), now closed by a real,
non-vacuous test that would fail if that composition regressed.

**Requirements independently re-verified as already COVERED (no gap):** TEST-01, TEST-02,
TRUST-03, TRUST-05, ROBUST-03. Each was checked against its actual spec file (not trusted from
SUMMARY/VERIFICATION prose) for the specific adversarial failure modes this audit role is charged
with catching: tautological assertions (identity checks instead of behavioral ones), missing hard
edges (e.g. the extra-keys-can't-force-write behavioral test for TRUST-05), and absent negative
cases. None were found. TRUST-05 in particular was checked against this repo's own prior
tautological-test precedent (01-REVIEW.md WR-01) and confirmed to avoid it.
