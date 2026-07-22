---
phase: 1
slug: walking-skeleton
status: verified
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-18
updated: 2026-07-19
---

# Phase 1 — Validation Strategy

> Per-phase validation contract. Phase 1 delivers the walking-skeleton Nx-contract HTTP
> server: SRV-01..05 (loopback bind, timing-safe auth, hash validation, body-size cap,
> best-effort read/fail-closed write) plus TEST-07 (the vendored-spec conformance fixture).
> TDD was used throughout (RED before GREEN, per 01-02/01-03/01-04-SUMMARY.md). This audit
> re-runs the test suite live, maps every requirement to a concrete green test, and closes
> one specific false-confidence nuance flagged by 01-REVIEW.md (WR-01: the `server.spec.ts`
> SRV-01 test is vacuous).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ~4.1.0 (`@nx/vitest` inferred `test` target) |
| **Config file** | `packages/github-cache/vitest.config.mts` |
| **Quick run command** | `npx nx test github-cache` |
| **Full suite command** | `npx nx run-many -t test` |
| **Observed runtime** | ~0.3-0.8s (in-process `node:http` server on ephemeral ports; no network) |

---

## Sampling Rate

- **After every task commit:** `npx nx test github-cache` (per Plans 01-04, all green at GREEN commits)
- **After every plan wave:** `npx nx run-many -t test`
- **This audit:** full suite re-run live (`--skip-nx-cache`) plus `typecheck`/`build`, not
  copied from SUMMARY claims

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | Test File | Status |
|---------|------|------|-------------|------------|-----------------|-----------|--------------------|-----------|--------|
| 01-01-T1/T2 | 01 | 1 | (vessel only — no requirement completed) | — | `@op-nx/github-cache` lib scaffolded, inferred targets, green Wave-0 harness | infra | `npx nx test github-cache` | generator sample (replaced in 01-02) | pass |
| 01-02-T2 | 02 | 2 | SRV-01 | T-1-01 | `serve()` binds `127.0.0.1` only — production choice, not test-supplied (no `host` option exists) | integration | `npx nx test github-cache` | `src/serve.spec.ts` ("binds the loopback interface only, never a routable interface (SRV-01, production bind)" — **added by this audit**; also exercised incidentally by the pre-existing round-trip test) | pass |
| 01-02-T2 | 02 | 2 | SRV-02 | T-1-02, T-1-02b, T-1-07 | bearer compared via `timingSafeEqual` on fixed 32-byte SHA-256 digests; missing/wrong bearer → 401 without throwing | unit | `npx nx test github-cache` | `src/server/server.spec.ts` ("returns 401 when the Authorization header is missing (SRV-02)", "returns 401 for a wrong bearer token without throwing (SRV-02)") | pass |
| 01-03-T2 | 03 | 3 | SRV-03 | T-1-03 | malformed `{hash}` (non-hex / >512 chars / empty) → 400 before any backend call; spy proves backend not invoked | unit | `npx nx test github-cache` | `src/server/server.spec.ts` (4 tests: non-hex GET, malformed PUT, >512 chars, empty) | pass |
| 01-03-T2 | 03 | 3 | SRV-04 | T-1-04 | `MAX_CACHE_BODY_BYTES` = exactly 2 GiB; oversized `Content-Length` → 413 fast path; streamed overflow → 413 without full buffering | unit | `npx nx test github-cache` | `src/server/server.spec.ts` (3 tests: constant value, Content-Length fast-reject, streaming abort) | pass |
| 01-03-T2 | 03 | 3 | SRV-05 | T-1-05 | `backend.get` fault → 404 MISS (never 5xx); `backend.put` fault → 500 (never a silent 200) | unit | `npx nx test github-cache` | `src/server/server.spec.ts` ("degrades a backend.get fault to a 404 MISS, never 5xx (SRV-05)", "surfaces an error status on a backend.put fault, never a silent 200 (SRV-05 fail-closed)") | pass |
| 01-04-T2 | 04 | 4 | TEST-07 | T-1-09 | full vendored-spec sha256 drift guard + `PINNED_NX_VERSION` (never `info.version`) + behavioral hard-200/401/403/404/409/Content-Length | unit + integration | `npx nx test github-cache` | `src/conformance/conformance.spec.ts` (9 tests: Layer a x3, Layer b x6) | pass |

*Status: pending · pass · fail · flaky*

---

## Independent Re-Verification (this audit, adversarial)

Every command below was re-run live during this audit (`--skip-nx-cache` where cache could
mask a stale result), not copied from SUMMARY/REVIEW claims:

| Command | Result | Exit |
|---------|--------|------|
| `npx nx test github-cache --skip-nx-cache` (baseline, before this audit's change) | 4 files, 34 tests passed | 0 |
| `npx nx test github-cache --skip-nx-cache` (after adding the SRV-01 production-bind test) | 4 files, 35 tests passed | 0 |
| `npx nx run-many -t test` | 35/35 passed | 0 |
| `npx nx run-many -t typecheck build --projects=github-cache --skip-nx-cache` | both green, fresh (not cache-hit) | 0 |
| `node -e` sanity check: bind a throwaway `http.Server` to `0.0.0.0` and read `server.address().address` | reports `"0.0.0.0"` (≠ `'127.0.0.1'`) | confirms the new SRV-01 assertion technique is not vacuous — it would fail under a real loopback-bind regression |

**Conclusion:** all 6 phase requirements (SRV-01..05, TEST-07) have automated, green test
coverage; no regression since the Plan 04 SUMMARY's claimed 34/34.

---

## Gap Analysis Verdict

Gap analysis was run per-requirement against 01-REVIEW.md's one open nuance (WR-01):

1. **SRV-01 — was the loopback-bind requirement genuinely covered, or only vacuously?**
   `server.spec.ts`'s test named `binds 127.0.0.1 only (SRV-01)` is confirmed vacuous per
   WR-01: it calls its own local `listen()` helper (`server.listen(0, '127.0.0.1', ...)`)
   and then asserts that same hardcoded value — `createCacheServer` itself never binds
   (binding is `serve()`'s job). This test would pass unchanged even if `serve()` bound
   `0.0.0.0`.

   The **real** production-level coverage already existed in `serve.spec.ts`, which calls
   the actual `serve()` composition root (no test-suppliable `host` — `ServeOptions` only
   exposes `port`/`token`) and asserts the resulting `server.address().address`. This is
   structurally non-vacuous: the test cannot inject the bind address, so a pass is only
   possible if `serve.ts`'s own hardcoded `'127.0.0.1'` literal is what actually ran.
   Verified by a throwaway `node -e` sanity check (above): binding `0.0.0.0` instead makes
   `server.address().address` report `"0.0.0.0"`, which the assertion `toBe('127.0.0.1')`
   would catch.

   **Decision: ADDED a new, decisively-labeled test** —
   `src/serve.spec.ts` › `"binds the loopback interface only, never a routable interface
   (SRV-01, production bind)"` — rather than relying solely on the pre-existing combined
   round-trip test (whose primary label/purpose is the PUT/GET round-trip, with the bind
   assertion as an incidental first line). This closes the false-confidence gap with a
   dedicated, traceable SRV-01 assertion at the correct (production) layer, per the code
   reviewer's own recommendation ("treat `serve.spec.ts` as the authoritative SRV-01
   assertion"). The vacuous `server.spec.ts` test itself was left untouched — it is a
   test-quality/naming defect already tracked as WR-01 (WARNING, not a coverage gap), not
   a coverage hole, and renaming/removing it is a code-review remediation, not a Nyquist
   gap-fill action. Verdict: **SRV-01 — COVERED** (now with a dedicated non-vacuous test;
   green, 35/35).

2. **SRV-02, SRV-03, SRV-04, SRV-05, TEST-07** — each mapped to concrete, currently-green
   tests in `server.spec.ts` / `conformance.spec.ts` (see Per-Task Verification Map). All
   assert an observable status code, header, or invariant (constant value, spy-not-called,
   exact digest) directly tied to the requirement's `must_haves`/prohibitions in their
   PLAN.md. No vacuous or tautological assertions found in these five. Verdict: **COVERED**.

**No BLOCKER-class gap found.** One WARNING-adjacent false-confidence nuance (SRV-01) was
closed by adding a test; no implementation defect was found or needed fixing.

---

## Manual-Only Verifications

None remaining. The one item the draft VALIDATION.md flagged as a manual-verification
candidate — "a real `serve` process answers a scripted GET/PUT locally (SC4)" — was
automated as planned in 01-04-PLAN.md (`src/serve.spec.ts`, in-process `listen(0, '127.0.0.1')`
+ global `fetch`); confirmed green in this audit.

---

## Validation Sign-Off

- [x] All tasks have an `<automated>` verify command (all six requirements map to
      `npx nx test github-cache`)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covered all MISSING references (Plan 01 scaffolded the harness before any
      RED test in Plans 02-04)
- [x] No watch-mode flags (CI runs `test` non-interactively)
- [x] Feedback latency < 15s (observed ~0.3-0.8s)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-19 (gsd-nyquist-auditor, retroactive audit)
