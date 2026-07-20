---
phase: 6
slug: distribution-docs-governance
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-20
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Scaffold created at plan-phase; the per-task map + sign-off are completed by
> `/gsd:validate-phase` (gsd-nyquist-auditor) after execution. See
> `06-RESEARCH.md` §"Validation Architecture" for the derived test targets.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (via @nx/vitest) |
| **Config file** | `packages/github-cache/vite.config.ts` |
| **Quick run command** | `npx nx test github-cache` |
| **Full suite command** | `npx nx run-many -t test,build,typecheck,lint` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx nx test github-cache`
- **After every plan wave:** Run the full suite
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

> Filled by `/gsd:validate-phase` after execution against the shipped plans.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | — | — | DOCS-05 | — | public-surface guard fails on unintended contract change | unit | `npx nx test github-cache` | [ ] W0 | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] Public-surface guard spec (DOCS-05) — analog: existing `pinned-deps.spec.ts`
- [ ] Existing vitest infrastructure covers the remaining (docs/governance) requirements via file-existence + content assertions where automatable.

*Most of phase 6 is docs/governance (markdown + config). The load-bearing automated
check is the DOCS-05 public-surface guard; DOCS-06 background-step behavior is
partly manual (see below).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Consumer JS action runs `serve` as a real GA background step with `cancel:` teardown | DOCS-06 | Requires a live GitHub Actions runner; cannot run in unit tests | Documented pattern verified by reading the committed consumer action YAML + a dogfood/live CI proof if wired |
| Published npm tarball ships only dist/ + LICENSE + consumer README | DOCS-06/FOUND-03 | Requires `npm pack --dry-run` inspection | `npm pack --dry-run` in the package dir; assert file list |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
