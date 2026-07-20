---
phase: 5
slug: trust-widening-ppe-gate
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-20
---

# Phase 5 - Validation Strategy

> Per-phase validation contract. Seeded from 05-RESEARCH.md `## Validation Architecture`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ~4.1.0 via `@nx/vitest` |
| **Config file** | `packages/github-cache/vitest.config.mts` |
| **Quick run command** | `npx nx test github-cache` |
| **Full suite command** | `npm run test` + `node packages/github-cache/selfcheck.cjs` |

---

## Sampling Rate

- **Per task commit:** `npx nx test github-cache`
- **Per wave merge:** `npm run test` + `node packages/github-cache/selfcheck.cjs` + `npm run typecheck` + `npm run build`
- **Phase gate:** full suite green + `selfcheck.cjs` exit 0 + `fallow:ci` 0 cycles + `format:check` clean before verify. The live PPE run is a first-push closing proof (like Phase 4's mirror round-trip - expect a `human_needed`/live close on the CI run).

---

## Per-Requirement Verification Map

| Req ID | Behavior | Test Type | Command | File |
|--------|----------|-----------|---------|------|
| TRUST-01 | Host matrix: github.com ON, *.ghe.com ON, GHES OFF, malformed/empty OFF (fail-closed); pull_request/release admitted only on ON hosts; dangerous trio always refused | property/boundary unit | `npx nx test github-cache` | extend `trust.spec.ts` (W0) |
| TRUST-01 | push/schedule still trusted on ANY host (not host-gated) | unit | `npx nx test github-cache` | extend `trust.spec.ts` (W0) |
| TRUST-01 (guard) | Widening the WRITE gate did NOT widen the SYNC gate (isSyncTrusted still refuses pull_request/release) | regression unit | `npx nx test github-cache` | `sync-gate.spec.ts`/`trust.spec.ts` (W0) |
| TRUST-04 | Semantic parity: identical isWriteTrusted verdicts across a full env matrix between TS source and committed .cjs; allowlist arrays deep-equal | mutation-proven parity unit | `npx nx test github-cache` | `trust.generated.spec.ts` (W0) |
| TRUST-04 | Build fails on drift (.cjs stale vs regeneration) | drift guard (CI) | `node packages/github-cache/selfcheck.cjs` | `selfcheck.cjs` + ci.yml wiring (W0) |
| TRUST-08 | Filter admits nx-cache-<valid hash>, rejects foreign key + nx-cache-<garbage>; cacheKeyFor round-trips | unit | `npx nx test github-cache` | `cache-key.spec.ts` (W0) |
| TRUST-08 (single source) | Exactly one authored 'nx-cache-' literal remains OR backend + publish both route through the leaf | config/count assertion | `npx nx test github-cache` | `cache-key.spec.ts` (W0) |
| TRUST-06 | Composite action.yml structure: using: composite, exact pins zizmor==1.27.0 + actionlint 1.7.12, named-rule/advisory posture present | config-assertion reading tracked action.yml (mutation-proven, like cleanup-workflow.spec.ts) | `npx nx test github-cache` | `<ppe>.spec.ts` (W0) |
| TRUST-06 (live) | The PPE action actually runs zizmor/actionlint on a fixture workflow and produces findings | live-CI (advisory job on push) | CI run on default branch (like dogfood pair) | needs live-CI |

---

## Nyquist Classification

- **Property/boundary:** TRUST-01 host-detection matrix (structural URL parse, fail-closed on throw/other host).
- **Mutation-proven parity/config-assertion:** TRUST-04 TS-vs-.cjs parity + selfcheck drift; TRUST-06 action.yml structure (pins + named rules + advisory), reading the tracked file with comment-strip + mutation proof.
- **Ordinary unit:** TRUST-08 filter admit/reject + single-source count.
- **Regression guard:** write-widen did NOT widen the sync gate (ADR C2 separation).
- **Live/CI (not local Vitest):** TRUST-06 behavior — the composite action running zizmor/actionlint against a fixture unsafe-pattern workflow. First-push closing proof.

---

## Wave 0 Requirements

- [ ] `src/lib/cache-key.spec.ts` - filter unit + single-source count (TRUST-08)
- [ ] `src/lib/trust.generated.spec.ts` - semantic parity TS vs .cjs (TRUST-04)
- [ ] `selfcheck.cjs` - CI drift tripwire (TRUST-04) + ci.yml wiring
- [ ] `<ppe-path>/*.spec.ts` - composite action config-assertion: pins + named rules + advisory (TRUST-06)
- [ ] extend `trust.spec.ts` - host-detection matrix + widened events + refusal (TRUST-01)
- [ ] cross-check in `sync-gate.spec.ts` - write-widen did not widen sync (TRUST-01 guard)
- [ ] live-CI: an advisory PPE job (+ a small unsafe-pattern fixture workflow) proving the action runs

*Final file layout is the planner's discretion; the coverage above is the contract.*

---

## Manual-Only / Live Verifications

| Behavior | Requirement | Why | Instructions |
|----------|-------------|-----|--------------|
| PPE composite action runs zizmor/actionlint live | TRUST-06 | Needs a real runner + tool install + a fixture workflow | An advisory CI job invoking the composite action on a known unsafe-pattern fixture; confirm findings emitted, job non-failing (advisory) |

---

## Validation Sign-Off

- [ ] All requirements have automated verify or a justified live-CI/manual classification
- [ ] Wave 0 covers all MISSING references
- [ ] selfcheck.cjs drift guard wired into CI
- [ ] `nyquist_compliant: true` set post-execution by validate-phase

**Approval:** pending
