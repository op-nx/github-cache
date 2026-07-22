---
phase: 02-default-cache-in-ci
plan: 02
subsystem: security
tags: [trust-boundary, write-gate, default-deny, creep, allowlist, tdd, vitest]

# Dependency graph
requires:
  - phase: 01-server
    provides: "in-repo pinned-constant spec convention (MAX_CACHE_BODY_BYTES) and the named-Vitest-imports / one-describe-per-export spec shape"
provides:
  - "TRUSTED_EVENTS: the comment-locked single-source-of-truth write allowlist (exactly push, schedule)"
  - "isWriteTrusted(env): a pure, injectable, default-deny write-trust predicate"
  - "src/lib/trust.spec.ts: the TRUST-03 refused-trigger table + deep-equality allowlist content pin"
affects: [02-04, 02-05, select-backend, actions-cache-backend]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Default-deny allowlist with NO denylist path: unrecognised/unset input returns not-trusted"
    - "Deep-equality content pin on a security-relevant constant so a widening cannot land as a silent one-word edit"
    - "Injectable env bag (single argument, defaulting to process.env) keeps the predicate pure and testable without process.env mutation"

key-files:
  created:
    - packages/github-cache/src/lib/trust.ts
    - packages/github-cache/src/lib/trust.spec.ts
  modified: []

key-decisions:
  - "The allowlist is exactly ['push','schedule'] and pinned by deep-equality; widening to contributor-facing triggers (pull_request/release) is Phase 5 / TRUST-01 work, not a maintenance edit here."
  - "?? (not ||) on the event-name lookup: an unset event name is not a trusted event either way; the load-bearing ||-not-?? rule applies to token fallthrough, not to this comparison."
  - "The dependency-free action-context copy of the allowlist plus its parity assertion is deliberately deferred to Phase 5 / TRUST-04, so exactly one TRUSTED_EVENTS declaration exists now (T-2-05 mitigation)."

patterns-established:
  - "Security-relevant constant = comment-locked single source of truth locked by a deep-equality content pin; an accidental early widening is a build failure, not a silent MISS of review."

requirements-completed: [TRUST-03]

coverage:
  - id: D1
    description: "isWriteTrusted is a pure default-deny predicate: true only inside GitHub Actions AND for a TRUSTED_EVENTS trigger; every dangerous shared-default-scope / fork-reachable trigger and every unrecognised or unset trigger is refused."
    requirement: "TRUST-03"
    verification:
      - kind: unit
        ref: "packages/github-cache/src/lib/trust.spec.ts#trusts push inside GitHub Actions (TRUST-03)"
        status: pass
      - kind: unit
        ref: "packages/github-cache/src/lib/trust.spec.ts#trusts schedule inside GitHub Actions (TRUST-03)"
        status: pass
      - kind: unit
        ref: "packages/github-cache/src/lib/trust.spec.ts#refuses pull_request_target even inside GitHub Actions (TRUST-03)"
        status: pass
      - kind: unit
        ref: "packages/github-cache/src/lib/trust.spec.ts#default-denies an empty env bag (TRUST-03)"
        status: pass
    human_judgment: false
  - id: D2
    description: "TRUSTED_EVENTS is the single source of truth (exactly one declaration in the repo) and its content is pinned by deep-equality against ['push','schedule']."
    requirement: "TRUST-03"
    verification:
      - kind: unit
        ref: "packages/github-cache/src/lib/trust.spec.ts#deep-equals the two-element push/schedule allowlist (TRUST-03)"
        status: pass
      - kind: manual
        ref: "git grep -c 'export const TRUSTED_EVENTS' -- packages/github-cache/src == 1"
        status: pass
    human_judgment: false

# Metrics
duration: 3min
completed: 2026-07-19
status: complete
---

# Phase 2 Plan 02: Default-deny write-trust gate (TRUST-03) Summary

**Built the CREEP write-trust boundary test-first: `isWriteTrusted(env)` trusts only `push` and `schedule` inside GitHub Actions and default-denies every other trigger, with the `TRUSTED_EVENTS` allowlist pinned by deep-equality so an early widening breaks the build (TRUST-03, CVE-2025-36852).**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-07-19T02:28Z
- **Completed:** 2026-07-19T02:31Z
- **Tasks:** 1 (TDD, RED -> GREEN)
- **Files created:** 2

## Accomplishments
- `packages/github-cache/src/lib/trust.ts` exports `TRUSTED_EVENTS` (comment-locked single source of truth, exactly `push` + `schedule`) and `isWriteTrusted(env)` -- a pure, injectable, default-deny predicate that early-returns `false` when `GITHUB_ACTIONS !== 'true'` and otherwise membership-tests `GITHUB_EVENT_NAME` against the allowlist.
- `packages/github-cache/src/lib/trust.spec.ts` covers every case in the plan's `<behavior>` block: both trusted triggers, the full 11-entry refused-trigger table (driven from a `REFUSED_EVENTS` array so adding a refused trigger is one line), unset event name, not-in-Actions, `GITHUB_ACTIONS: 'false'`, empty bag, plus the deep-equality allowlist content pin. No `process.env` mutation -- literal env bags throughout.
- The refused table asserts NOT-trusted for `pull_request`, `pull_request_target`, `issue_comment`, `workflow_run`, `workflow_dispatch`, `repository_dispatch`, `merge_group`, `release`, `delete`, `registry_package`, `page_build`.

## Task Commits

TDD cycle, committed atomically RED then GREEN:

1. **RED - failing write-trust gate spec** - `107f00b` (`test(02-02): add failing write-trust gate spec (TRUST-03)`) -- spec fails because `./trust.js` does not resolve yet.
2. **GREEN - default-deny write-trust gate** - `59286f1` (`feat(02-02): implement default-deny write-trust gate (TRUST-03)`) -- `trust.ts` created; all 20 trust tests pass.

The `test(02-02)` (RED) commit precedes the `feat(02-02)` (GREEN) commit in git history, satisfying the MVP+TDD gate.

## Files Created/Modified
- `packages/github-cache/src/lib/trust.ts` - `TRUSTED_EVENTS` allowlist + `isWriteTrusted(env)` predicate (the CREEP write-trust boundary)
- `packages/github-cache/src/lib/trust.spec.ts` - TRUST-03 refused-event table + allowlist content pin

## Verification
- `npx nx test github-cache` exits 0 (trust spec GREEN, 20 trust tests + prior specs pass).
- `npx nx run-many -t typecheck build` exits 0.
- `git grep -c 'export const TRUSTED_EVENTS' -- packages/github-cache/src` == 1 (single source of truth, T-2-05 mitigation).
- `npx nx format:write` applied (Prettier reflowed the guard `.includes(...)` call and the multi-key literal env bags; no logic change).

## Decisions Made
- **Allowlist frozen at `['push','schedule']` and content-pinned.** A deep-equality test turns any early widening into a build failure; widening to fork-reachable / contributor-facing triggers is Phase 5 / TRUST-01 work by design (T-2-03 mitigation).
- **`??` on the event-name lookup, not `||`.** An unset event name is not a trusted event either way; the load-bearing `||`-not-`??` house rule governs token fallthrough, not this membership comparison -- left un-harmonised deliberately per the plan.
- **One `TRUSTED_EVENTS` declaration only.** The dependency-free action-context copy plus its parity assertion is deferred to Phase 5 / TRUST-04 rather than introduced here without a parity guard (T-2-05).

## Deviations from Plan
None - plan executed exactly as written.

## Threat Model Notes
- **T-2-03 (critical, mitigate) closed in-code:** the gate is a default-deny allowlist with no denylist path; unrecognised/unset triggers return `false`, and the deep-equality pin blocks a silent widening.
- **T-2-05 (medium, mitigate) satisfied:** exactly one `TRUSTED_EVENTS` declaration (repo-wide count == 1).
- **T-2-04 (spoofing) and T-2-SC (installs):** accepted per plan; no new surface introduced -- no package-manager install occurred, and env-spoofing defence-in-depth is out of scope until Phase 5 widens to contributor-facing triggers.

## Issues Encountered
None.

## User Setup Required
None - pure in-code predicate, no external service configuration.

## Next Phase Readiness
- `isWriteTrusted` and `TRUSTED_EVENTS` are importable via `./trust.js`, so Plan 02-04's `selectBackend(env)` can compose the predicate to return the writable Actions-cache backend on trust and the read-only backend otherwise (D-01/TRUST-05).

## Self-Check: PASSED
- FOUND: packages/github-cache/src/lib/trust.ts
- FOUND: packages/github-cache/src/lib/trust.spec.ts
- FOUND: .planning/phases/02-default-cache-in-ci/02-02-SUMMARY.md
- FOUND commit: 107f00b (RED)
- FOUND commit: 59286f1 (GREEN)
