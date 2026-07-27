---
phase: 8
slug: nx-task-hash-parity
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-28
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `08-RESEARCH.md` `## Validation Architecture`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ~4.1.0 via `@nx/vitest` (`testTargetName: "test"`) |
| **Config file** | `packages/github-cache/vitest.config.mts` (unit); `vitest.integration.config.mts` (integration) |
| **Quick run command** | `npx nx test @op-nx/github-cache` |
| **Full suite command** | `npm test` (`nx run-many -t test`) |
| **Estimated runtime** | ~30 seconds (unit suite, ~438 tests) |

Spec placement is **co-located, always** — `foo.ts` + `foo.spec.ts` in the same directory. No
`tests/` tree. [VERIFIED: `.planning/codebase/TESTING.md:37-45`]

---

## Sampling Rate

- **After every task commit:** Run `npx nx test @op-nx/github-cache`
- **After every plan wave:** Run `npm test && npm run typecheck && npm run lint`
- **Before `/gsd:verify-work`:** Full suite green, PLUS the two-leg job observed both GREEN and
  (via a deliberate fixture-level RED) demonstrably capable of failing — D-22
- **Max feedback latency:** ~30 seconds locally; one CI round-trip for the Live-CI items

---

## Per-Task Verification Map

Task IDs are assigned by the planner; this map is keyed on requirement until plans exist.

| Requirement | Behaviour | Threat Ref | Test Type | Automated Command | File Exists | Status |
|-------------|-----------|------------|-----------|-------------------|-------------|--------|
| CORR-03(a) | Fewer than two records FAILS | — | unit | `npx nx test @op-nx/github-cache` | ❌ W0 | ⬜ pending |
| CORR-03(a) | A record missing a target's hash FAILS | — | unit | same | ❌ W0 | ⬜ pending |
| CORR-03(a) | An EMPTY `targets` map FAILS (vacuity control, D-22) | — | unit | same | ❌ W0 | ⬜ pending |
| CORR-03(b) | Matching `integration` hashes FAIL | — | unit | same | ❌ W0 | ⬜ pending |
| CORR-03(c) | Differing `build` FAILS | — | unit | same | ❌ W0 | ⬜ pending |
| CORR-03(c) | Differing `typecheck` FAILS | — | unit | same | ❌ W0 | ⬜ pending |
| CORR-03(c) | Differing `test` FAILS | — | unit | same | ❌ W0 | ⬜ pending |
| D-21 | Differing `lint` FAILS | — | unit | same | ❌ W0 | ⬜ pending |
| CORR-03 | A genuinely-correct record pair PASSES (positive control) | — | unit | same | ❌ W0 | ⬜ pending |
| PARITY-02 | Instrument emits a non-empty `details.nodes` per target | — | unit | spec over a captured fixture record | ❌ W0 | ⬜ pending |
| PARITY-02 | Instrument's hash equals Nx's own | — | **CI step** | run instrument, then `nx run <t>`, compare to `run.json` in the same step | ❌ W0 | ⬜ pending |
| PARITY-06 | `meta` completeness (every field non-empty when parsing) | — | unit | same | ❌ W0 | ⬜ pending |
| CORR-04 | `integration` is the only runtime-input target | — | unit | `nx-target-inputs.spec.ts:241-260` | ✅ **EXISTS — reuse** | ⬜ pending |
| PARITY-07 | Public surface unchanged | — | unit | existing public-surface guard + `npm run pack:check` | ✅ EXISTS | ⬜ pending |
| PARITY-01 | Node-by-node root-cause record predates the fix | — | **git history** | `git log` ordering (D-06: no programmatic mtime guard) | n/a | ⬜ pending |
| PARITY-03 | Byte-identical at three observation points | — | **Live-CI + hand-capture** | two-leg job; points 1-2 pasted by hand | Live-CI | ⬜ pending |
| PARITY-04 | Warm-local vs cold-CI, as its own named question | — | **hand-capture** | two local runs, both `meta`-stamped | manual | ⬜ pending |
| PARITY-05 | `integration` identical: workstation vs windows-11-arm | — | **Live-CI + hand-capture** | same records | Live-CI | ⬜ pending |
| CORR-03 | The gate actually gates | — | **Live-CI first push** | compare job observed RED once before it is trusted (D-22) | Live-CI | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `packages/github-cache/src/hash-parity/compare.spec.ts` — all nine comparator cases above
- [ ] Fixture records (valid pair, one-record, empty-targets, and one per single-clause violation)
      — as inline TypeScript objects or `.json` under `{projectRoot}` so they are covered by the
      `default` named input and cannot serve a stale cached PASS
- [ ] `!dist/hash-parity` in `packages/github-cache/package.json` `files`, **plus** the matching
      `pack-check.cjs` forbidden-list entry — without the second half the exclusion is unasserted
- No framework install needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Windows workstation COLD hash, all five targets | PARITY-03, PARITY-05 | No hosted runner is a developer workstation | `npx nx reset`, then run the instrument; paste the record with its full `meta` block |
| Windows workstation WARM hash, all five targets | PARITY-03, PARITY-04 | Same | Re-run the instrument without resetting; paste with `meta` |
| Does a warm local box compute the hash cold CI published? | PARITY-04 | Requires both a local box and a CI record for the same commit | Compare the WARM local record against the ubuntu leg's artifact at the same SHA; record WHICH question the proof answers |
| Which `typecheck` outputs list is correct (7-entry vs 1-entry) | Research A6 | Must be checked against what `tsc --build tsconfig.json --emitDeclarationOnly` actually writes, before pinning either | Run the command on a clean tree; enumerate the emitted paths |

## Live-CI First-Push Closures

Per `TESTING.md`'s Live-CI first-push close pattern, these are unreachable locally without faking
the exact thing under test. They close on the first push that runs the workflow, and MUST be named
in the plan as Live-CI items rather than appearing as ordinary verification steps that were
skipped:

- The `ubuntu-24.04-arm` and `windows-11-arm` observation points (PARITY-03, PARITY-05)
- The two-leg comparison itself (CORR-03)
- The gate's ability to fail on a real leg, as distinct from a fixture (CORR-03, D-22)
- Whether `lint` diverges cross-OS — no research can settle it, only the runner (D-21)

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
