---
phase: 06-distribution-docs-governance
plan: 05
subsystem: docs
tags: [security-docs, trust-model, semver, creep, drift-guard, vitest]

# Dependency graph
requires:
  - phase: 05-trust-widening-ppe-gate
    provides: the SETTLED write/host-gate/sync trust model (trust.ts, sync-gate.ts) + the audited 05-SECURITY.md/05-VERIFICATION.md verdict this doc renders
  - phase: 02-04
    provides: TRUSTED_EVENTS/SYNC_EVENTS allowlists + retention.ts CACHE_MIRROR_MAX_AGE_DAYS + the Releases RO reader the caveats describe
provides:
  - docs/trust-and-security.md rendering the full D-08 trust/security model from the single sources
  - docs/versioning.md defining the 0.x consumer contract + "breaking" against the D-04 surface
  - a single-source doc-vs-code drift guard (docs-trust.spec.ts) importing the real allowlists
affects: [06-02-public-surface-guard, 06-04-docs, README-versioning-summary, verify-work, secure-phase, milestone-audit]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single-source doc-vs-code drift guard: import the code's allowlists into a spec and assert each value renders verbatim in the doc"

key-files:
  created:
    - docs/trust-and-security.md
    - docs/versioning.md
    - packages/github-cache/src/docs-trust.spec.ts
  modified: []

key-decisions:
  - "Rendered the trust doc FROM the single sources (trust.ts/sync-gate.ts/ADR C1-C18/Phase-5 audit), showing the actual allowlist declarations verbatim in fenced blocks -- never a hand-typed paraphrase that can drift"
  - "State github.com-only with NO guessed GHES version; frame retention as storage hygiene (not poison-containment); explicitly forbid enabling fork-PR write tokens/secrets and sub-floor GHES PR/release writes (ADR C14/C15)"
  - "The drift guard imports TRUSTED_EVENTS/HOST_GATED_EVENTS/SYNC_EVENTS (not hardcoded tokens) so widening ANY allowlist trips the build until the doc is updated"
  - "Guard imports from './lib/...' (flat-in-src convention, matching serve.ts); docs resolved at '../../../docs/...' via import.meta.url (ppe-action.spec.ts precedent)"

patterns-established:
  - "Single-source drift guard: a spec importing the authored allowlists and asserting verbatim rendering closes the doc-vs-code drift failure mode RESEARCH warned about"

requirements-completed: [DOCS-03, GOV-03]

coverage:
  - id: D1
    description: "docs/trust-and-security.md renders all 10 D-08 topics of the settled Phase-5 trust model from the single sources"
    requirement: "DOCS-03"
    verification:
      - kind: unit
        ref: "packages/github-cache/src/docs-trust.spec.ts#renders every write-gate and sync-gate event string verbatim"
        status: pass
      - kind: unit
        ref: "packages/github-cache/src/docs-trust.spec.ts#covers the required non-event trust topics (D-08)"
        status: pass
    human_judgment: true
    rationale: "The guard proves token/event PRESENCE, not semantic correctness. A security-literate read must confirm no guessed GHES version, retention framed as hygiene, and no fork-PR-token encouragement (plan verification: a wrong security claim is worse than none)."
  - id: D2
    description: "docs/versioning.md defines the public surface as the D-04 set and 'breaking' against it under the pre-1.0 posture with a 1.0 freeze"
    requirement: "GOV-03"
    verification:
      - kind: unit
        ref: "packages/github-cache/src/docs-trust.spec.ts#versioning.md defines breaking against the 0.x posture with a 1.0 freeze"
        status: pass
    human_judgment: true
    rationale: "The token guard checks 0.x/breaking/1.0/minor presence, not that 'breaking' is correctly defined against the D-04 surface -- a semantic judgment on a governance contract doc."
  - id: D3
    description: "docs-trust single-source drift guard: importing the real allowlists, a future code change to any allowlist fails the guard until the doc is updated"
    verification:
      - kind: unit
        ref: "packages/github-cache/src/docs-trust.spec.ts (6 tests, npx nx test github-cache -- --run docs-trust)"
        status: pass
    human_judgment: false

# Metrics
duration: 11min
completed: 2026-07-20
status: complete
---

# Phase 6 Plan 05: Trust/Security + Versioning Docs Summary

**docs/trust-and-security.md renders the settled Phase-5 CREEP trust model (write gate + separate sync gate, github.com-only backstop, retention-as-hygiene) and docs/versioning.md defines the 0.x consumer contract, both locked by a single-source drift guard that imports the real trust.ts/sync-gate.ts allowlists.**

## Performance

- **Duration:** ~11 min
- **Started:** 2026-07-20T22:57:06Z
- **Completed:** 2026-07-20T23:08:00Z
- **Tasks:** 2 (3 commits)
- **Files modified:** 3 created

## Accomplishments
- Wrote docs/trust-and-security.md covering all 10 D-08 topics rendered from the single sources (trust.ts/sync-gate.ts/ADR C1-C18/Phase-5 SECURITY+VERIFICATION), with the write and sync allowlists shown verbatim in fenced blocks and the in-code host gate framed as fork-spoofable defense-in-depth (not the load-bearing control).
- Wrote docs/versioning.md defining the public surface as the D-04 enumerated set, "breaking" against that surface, the pre-1.0 (0.x) posture (breaking bumps MINOR + documented; DOCS-05 guard makes changes intentional not silent), and the 1.0 freeze to standard semver.
- Authored docs-trust.spec.ts as a single-source drift guard: imports TRUSTED_EVENTS + HOST_GATED_EVENTS + SYNC_EVENTS and asserts each event string renders verbatim in the trust doc, so a future allowlist widening trips the build until the doc catches up.
- Honored the hard prohibitions: github.com-only with no guessed GHES version, retention as storage hygiene (not poison-containment), never-enable-fork-PR-tokens.

## Task Commits

Each task was committed atomically:

1. **Task 1: Write docs/trust-and-security.md (DOCS-03)** - `b46ba17` (docs)
2. **Task 2a: Write docs/versioning.md (GOV-03)** - `3f743dc` (docs)
3. **Task 2b: docs-trust content/drift guard** - `d3e3261` (test)

_Task 2 was split into two type-correct commits (docs + test), matching the 06-03 feat/test-split precedent. No TDD tasks in this plan._

## Files Created/Modified
- `docs/trust-and-security.md` - The DOCS-03 trust/security section: which events write, the CREEP posture, github.com-only + GHES floor (no guessed version), never-enable-fork-PR-tokens, adopter prerequisites (default-branch protection + ephemeral single-tenant runners), the coupled CACHE_MIRROR_MAX_AGE_DAYS, read-only-local, retention-as-hygiene, mirrored-keys-anonymously-public, freshness/staleness caveats.
- `docs/versioning.md` - The GOV-03 semver/consumer-contract statement under the D-01 pre-1.0 posture.
- `packages/github-cache/src/docs-trust.spec.ts` - Single-source drift guard (6 tests): event-string verbatim rendering + D-08 non-event topics + do-not-enable guidance + versioning tokens + both-docs-exist.

## Decisions Made
- Rendered the trust model from the single sources with the allowlist declarations quoted verbatim in fenced TS blocks, so the doc is a faithful rendering and the guard's verbatim-event assertions are naturally satisfied.
- Made the trust-doc guard a single-source drift check (imports the real arrays) rather than a generic topic-token list, closing the doc-vs-code drift failure mode.
- Split Task 2 into two commits so the versioning doc (docs) and the guard (test) carry correct conventional-commit types.

## Deviations from Plan

None - plan executed exactly as written. All content, prohibitions, import paths (`./lib/...`), and the single-source drift-guard design match the plan and its critical constraints.

## Issues Encountered
- During Task 1 the initial draft used "Ephemeral" (capitalized) only; the plan's own case-sensitive token check requires lowercase `ephemeral`. Self-caught by running the Task 1 automated verify before committing; added a lowercase "ephemeral single-tenant runners" phrase in section 5 and re-verified. Minor authoring correction, resolved before commit.

## User Setup Required

None - no external service configuration required. These are documentation + a test.

## Next Phase Readiness
- DOCS-03 and GOV-03 are satisfied and locked by an automated guard; the README versioning summary (D-06/D-12) can now link to docs/versioning.md.
- The docs-trust guard references DOCS-05 (public-surface guard, 06-02) descriptively only -- no hard file dependency, so it does not block on 06-02.
- Verification note for verify-work/secure-phase: D1 (trust doc) requires a security-literate read to confirm the prohibitions; the presence/drift guard is green but does not certify semantic correctness of the security claims.

## Self-Check: PASSED

- Files exist: `docs/trust-and-security.md`, `docs/versioning.md`, `packages/github-cache/src/docs-trust.spec.ts` -- all FOUND.
- Commits exist: `b46ba17`, `3f743dc`, `d3e3261` -- all FOUND.
- `npx nx test github-cache` -> 24 files / 439 tests green (docs-trust.spec.ts = 6 tests); `npx nx typecheck github-cache` green; new files prettier-clean.
- Stub scan (TODO/FIXME/placeholder/coming-soon) over the 3 files -> none.

---
*Phase: 06-distribution-docs-governance*
*Completed: 2026-07-20*
