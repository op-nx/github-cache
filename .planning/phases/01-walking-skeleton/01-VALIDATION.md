---
phase: 1
slug: walking-skeleton
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-18
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Draft — the Per-Task Verification Map + Wave 0 rows are finalized once PLAN.md files
> exist and by `/gsd-validate-phase 1`. TDD is enabled: every SRV-01..05 + TEST-07 test
> is written first (RED) before its implementation (GREEN).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ~4.1.0 (`@nx/vitest` inferred `test` target) |
| **Config file** | `packages/github-cache/vitest.config.ts` (created by the lib generator in Wave 0) |
| **Quick run command** | `npx nx test github-cache` |
| **Full suite command** | `npx nx run-many -t test` |
| **Estimated runtime** | ~5-15 seconds (in-process `node:http` server on an ephemeral port; no network) |

---

## Sampling Rate

- **After every task commit:** Run `npx nx test github-cache`
- **After every plan wave:** Run `npx nx run-many -t test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

> Populated once PLAN.md files exist. Each SRV/TEST requirement maps to a first-written
> (RED) test asserting a concrete observable, per RESEARCH.md "## Validation Architecture".

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 1-01-xx | 01 | 1 | SRV-01 | T-1-01 | server binds `127.0.0.1` only; not reachable on a routable interface | unit | `npx nx test github-cache` | ❌ W0 | ⬜ pending |
| 1-01-xx | 01 | 1 | SRV-02 | T-1-02 | bearer compared in constant time; unauth/mismatch → 401 | unit | `npx nx test github-cache` | ❌ W0 | ⬜ pending |
| 1-01-xx | 01 | 1 | SRV-03 | T-1-03 | malformed `{hash}` rejected before any backend call | unit | `npx nx test github-cache` | ❌ W0 | ⬜ pending |
| 1-01-xx | 01 | 1 | SRV-04 | T-1-04 | body over `MAX_CACHE_BODY_BYTES` rejected, never buffered unbounded | unit | `npx nx test github-cache` | ❌ W0 | ⬜ pending |
| 1-01-xx | 01 | 1 | SRV-05 | T-1-05 | read fault → 404 MISS (never a 5xx); writes fail closed | unit | `npx nx test github-cache` | ❌ W0 | ⬜ pending |
| 1-01-xx | 01 | 1 | TEST-07 | — | conformance: full vendored spec hashed; PUT success = exactly `200`; 401/403/404/409 + `Content-Length` | unit | `npx nx test github-cache` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `nx g @nx/js:lib` scaffolds `packages/github-cache` with a Vitest config (no framework install needed — Vitest already a root devDependency)
- [ ] First-written (RED) spec files for SRV-01..05 + TEST-07 before their implementations

*Vitest infrastructure already exists at the workspace root; the lib generator wires the project-level `vitest.config.ts` + `tsconfig.spec.json`.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real `serve` process answers a scripted GET/PUT locally (SC4) | SRV-01..05 round-trip | End-to-end against a real listening socket | Start `serve`, run a scripted `fetch` GET/PUT round-trip; candidate for automation under `test` (real socket on port 0) — planner decides |

*Most phase behaviors have automated verification; SC4 is automatable as an in-process listen-on-port-0 test.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags (CI runs `test` non-interactively)
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
