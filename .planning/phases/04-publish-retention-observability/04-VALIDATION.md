---
phase: 4
slug: publish-retention-observability
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-20
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded from 04-RESEARCH.md `## Validation Architecture`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ~4.1.0 via `@nx/vitest` |
| **Config file** | `packages/github-cache/vitest.config.mts` (+ `vitest.workspace.ts`) |
| **Quick run command** | `npx nx test github-cache` |
| **Full suite command** | `npm run test` (`nx run-many -t test`) + `npm run integration` (per-OS `process.platform` discriminator) |
| **Estimated runtime** | ~10-30 seconds (unit); integration adds the per-OS matrix |

---

## Sampling Rate

- **After every task commit:** `npx nx test github-cache`
- **After every plan wave:** `npm run test` + `npm run typecheck` + `npm run build`
- **Before `/gsd:verify-work`:** full suite green (incl. `pinned-deps.spec.ts` extended for `@octokit/rest`); the CI cross-OS round-trip green on a real push
- **Max feedback latency:** ~30 seconds (unit)

---

## Per-Requirement Verification Map

| Req ID | Behavior | Test Type | Automated Command | File Exists |
|--------|----------|-----------|-------------------|-------------|
| TRUST-02 | Sync gate accepts `{push,schedule}`+default branch; rejects the 8 named events + non-default/tag refs | unit (property over event set) | `npx nx test github-cache` | ❌ W0 |
| TEST-03 | Publish orchestration: already-exists (422) / not-found (404) / other-fault (5xx) behind injected client | unit (fault-shaped fakes) | `npx nx test github-cache` | ❌ W0 |
| ROBUST-01 | `error.status` discrimination on BOTH publish and cleanup; a 5xx/429 never treated as absence | unit (fault injection) | `npx nx test github-cache` | ❌ W0 |
| TRUST-07 | Duplicate asset (422) -> benign no-op (no overwrite); real fault -> surfaced | unit (fault injection) | `npx nx test github-cache` | ❌ W0 |
| ROBUST-02 | ~2 GiB pre-upload byte-length check fails loud (no upload attempted at/over cap) | unit (boundary) | `npx nx test github-cache` | ❌ W0 |
| ROBUST-05 | 1000-asset cap -> `core.warning` + skip, NO non-zero exit | unit (cap boundary) | `npx nx test github-cache` | ❌ W0 |
| RETAIN-01 / TEST-04 | Mid-pagination fault -> ZERO deletions; delete phase isolates per-item + non-zero exit on aggregate | unit (fault injection) | `npx nx test github-cache` | ❌ W0 |
| TEST-06 | Expired pruned; within-window retained (by `created_at`); local `put()` returns 403 | unit | `npx nx test github-cache` | ⚠️ partial (put()==='forbidden' exists) |
| RETAIN-03 | Cleanup workflow: `contents:write` `GITHUB_TOKEN` (no PAT) + `concurrency` queue-don't-cancel | config/workflow lint | manual + `cleanup.yml` review | ❌ W0 |
| OBS-01 | Whole-run failure -> `core.setFailed` (non-zero exit) + annotation; summary counts emitted | unit (spy on `@actions/core`) | `npx nx test github-cache` | ❌ W0 |
| D-07/D-08 | `shardTagsForWindow` calendar-month correctness (boundary, short months, UTC); `resolveMaxAgeDays` default/clamp | unit (property/boundary) | `npx nx test github-cache` | ❌ W0 |
| cross-OS round-trip (deferred from P3) | Publish on OS A, resolve via Releases mirror on OS B (OS-invariant HIT + OS-sensitive MISS) | integration / CI job pair | `npx nx integration github-cache` or CI job pair | ❌ W0 |

*Status: ❌ pending · ✅ green · ⚠️ flaky*

---

## Nyquist Classification

- **Fault-injection (highest priority):** RETAIN-01/TEST-04 (mid-pagination abort -> zero deletions — the ROADMAP's named cleanup risk); ROBUST-01/TRUST-07 (404 vs 422 vs 5xx branches); ROBUST-02 (~2 GiB boundary). Drive by making the injected fake throw `{ status, response: { data: { errors: [{ code: 'already_exists' }] } } }`.
- **Property / boundary:** `shardTagsForWindow` across a Dec->Jan boundary, a 28-day February, and exactly-30-day windows (assert newest-first, no under-scan); `resolveMaxAgeDays` NaN/negative/over-ceiling -> default/clamp; the 1000-asset cap at 999/1000/1001.
- **Ordinary unit (injected client):** TEST-03 happy-path publish; TEST-06 age prune + within-window retain + `put()===403`; TRUST-02 event/ref matrix; OBS-01 annotation/summary emission.
- **Live / integration (CI, not local Vitest):** the cross-OS round-trip through the real Releases mirror — model as a CI job pair like `dogfood-seed`/`dogfood-verify`.

---

## Wave 0 Requirements

- [ ] `src/lib/sync-gate.spec.ts` — TRUST-02
- [ ] `src/lib/retention.spec.ts` — D-07/D-08 (`resolveMaxAgeDays`, `shardTagsForWindow`)
- [ ] `src/publish/publish-mirror.spec.ts` — TEST-03, ROBUST-01/02/05, TRUST-07
- [ ] `src/publish/cleanup.spec.ts` — RETAIN-01, TEST-04, TEST-06
- [ ] `src/publish/observability.spec.ts` (or folded into publish-mirror) — OBS-01
- [ ] extend `src/pinned-deps.spec.ts` — `@octokit/rest` exact pin
- [ ] cross-OS round-trip: integration spec or CI job pair (deferred from Phase 3)

*Final file layout is the planner's discretion; the coverage above is the contract.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Cleanup workflow token scope + concurrency | RETAIN-03 | Workflow YAML config, not runtime code | Review `cleanup.yml`: `permissions: contents: write`, `concurrency:` group with `cancel-in-progress: false`, no PAT |
| Live cross-OS mirror round-trip | cross-OS (deferred) | Needs real network + both runner OSes | CI job pair on a real default-branch push |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter (post-execution, by validate-phase)

**Approval:** pending
