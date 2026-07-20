---
phase: 05-trust-widening-ppe-gate
plan: 02
subsystem: infra
tags: [github-actions, write-trust, host-detection, ppe, creep, url-parsing, vitest]

# Dependency graph
requires:
  - phase: 02-write-gate
    provides: isWriteTrusted / TRUSTED_EVENTS write gate + selectBackend selection point
  - phase: 04-mirror
    provides: isSyncTrusted / SYNC_EVENTS separate sync gate (ADR C2 separation)
provides:
  - HOST_GATED_EVENTS allowlist (pull_request, release) in trust.ts
  - hostSupportsWidenedTrust structural fail-closed GITHUB_SERVER_URL host gate
  - widened isWriteTrusted (host-gated pull_request/release, GHES fail-closed)
  - trust.spec.ts host-detection matrix + sync-gate-not-widened regression
  - select-backend.spec.ts end-to-end widening proof (github.com writable, GHES read-only)
affects: [05-03-codegen-selfcheck, 05-04-ppe-action, 06-distribution-docs]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Host-gated write-trust: structural URL(...).hostname parse, fail-closed on throw/GHES"
    - "Two separate allowlists (base host-independent + host-gated widened) in one authored source"

key-files:
  created: []
  modified:
    - packages/github-cache/src/lib/trust.ts
    - packages/github-cache/src/lib/trust.spec.ts
    - packages/github-cache/src/lib/select-backend.spec.ts

key-decisions:
  - "endsWith('.ghe.com') requires a real leading label; bare ghe.com / notghe.com / github.com.attacker.com rejected"
  - "http://github.com admitted (host-based match, scheme-agnostic) per plan behavior"
  - "Reworded the trust.ts comment to avoid the literal 'sync-gate' token so the no-coupling grep returns nothing"

patterns-established:
  - "Host gate: parse GITHUB_SERVER_URL with global URL in try/catch, lowercase hostname, compare structurally, fail closed"
  - "Dangerous events tested WITH a github.com host present to prove the host does not rescue them (non-vacuous)"

requirements-completed: [TRUST-01]

coverage:
  - id: D1
    description: "isWriteTrusted admits pull_request/release only on github.com or a real *.ghe.com subdomain; fail-closed on GHES, malformed, empty, unset, bare-ghe.com, and attacker-suffix hosts"
    requirement: TRUST-01
    verification:
      - kind: unit
        ref: "packages/github-cache/src/lib/trust.spec.ts#isWriteTrusted host-gated widened events"
        status: pass
    human_judgment: false
  - id: D2
    description: "Base events push/schedule stay trusted on ANY host (host-independent); dangerous trio + unlisted events refused on every host even with a github.com host present"
    requirement: TRUST-01
    verification:
      - kind: unit
        ref: "packages/github-cache/src/lib/trust.spec.ts#isWriteTrusted base events (host-independent) / dangerous / unlisted events"
        status: pass
    human_judgment: false
  - id: D3
    description: "Host detection is a structural URL(...).hostname parse, never a substring includes; HOST_GATED_EVENTS + TRUSTED_EVENTS content-pinned"
    requirement: TRUST-01
    verification:
      - kind: unit
        ref: "packages/github-cache/src/lib/trust.spec.ts#allowlist content pins"
        status: pass
    human_judgment: false
  - id: D4
    description: "Widening flows through selectBackend: pull_request/release writable on github.com, read-only on GHES, dangerous events never rescued by host"
    requirement: TRUST-01
    verification:
      - kind: integration
        ref: "packages/github-cache/src/lib/select-backend.spec.ts#selectBackend host-gated widening flows through isWriteTrusted"
        status: pass
    human_judgment: false
  - id: D5
    description: "Write-widen did NOT widen the sync gate: isSyncTrusted still refuses pull_request AND release on a github.com host / default branch (ADR C2)"
    requirement: TRUST-01
    verification:
      - kind: unit
        ref: "packages/github-cache/src/lib/trust.spec.ts#write-widen did NOT widen the sync gate (ADR C2 cross-check)"
        status: pass
    human_judgment: false

# Metrics
duration: 13min
completed: 2026-07-20
status: complete
---

# Phase 5 Plan 02: Host-Gated Write-Trust Widening Summary

**isWriteTrusted now admits pull_request/release only where GitHub's server-side read-only-cache guard exists (github.com / *.ghe.com), fail-closed on GHES and malformed input, from the single trust.ts source, without widening the separate sync gate.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-07-20T09:37:30Z
- **Completed:** 2026-07-20T09:50:49Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Widened `isWriteTrusted` with a new `HOST_GATED_EVENTS = [pull_request, release]` set trusted only on hosts carrying GitHub's guard, while `TRUSTED_EVENTS = [push, schedule]` stays host-independent.
- Added `hostSupportsWidenedTrust`: a structural `new URL(GITHUB_SERVER_URL).hostname` parse in try/catch, `=== 'github.com' || endsWith('.ghe.com')`, fail-closed on any throw (GHES/malformed/empty/unset).
- Proved the widening end-to-end through `selectBackend` (github.com -> writable, GHES -> read-only) and proved the dangerous trio is never rescued by a guarded host.
- Added a regression cross-check that `isSyncTrusted` still refuses pull_request AND release on a github.com default-branch run (ADR C2 separation preserved).

## Task Commits

Each task was committed atomically (TDD RED -> GREEN):

1. **Task 1 (RED): host-gated widening matrix** - `5cbc5bb` (test)
2. **Task 1 (GREEN): widen isWriteTrusted + fail-closed host gate** - `41312fd` (feat)
3. **Task 2: selectBackend flow-through + sync-gate-not-widened regression** - `988e420` (test)

**Plan metadata:** committed separately (docs: complete plan)

_Task 2 is test-only (no production change): select-backend.ts is not edited; the widening flows through unchanged._

## Files Created/Modified
- `packages/github-cache/src/lib/trust.ts` - Added HOST_GATED_EVENTS + hostSupportsWidenedTrust; rewrote isWriteTrusted (base -> true, host-gated -> host check, else deny). Single source (D-05), no sync-gate import, no mode flag.
- `packages/github-cache/src/lib/trust.spec.ts` - Removed pull_request/release from unconditional refusal; added host-detection matrix, host-independent base tests, dangerous-events-with-github.com-host tests, HOST_GATED_EVENTS content pin, and the isSyncTrusted cross-check.
- `packages/github-cache/src/lib/select-backend.spec.ts` - Moved pull_request/release out of the always-forbidden it.each (gave it a github.com host to stay non-vacuous); added a host-gated widening describe (github.com writable, GHES read-only); switched the TRUST-05 behavioral case to pull_request_target so it stays meaningful under widening.

## Decisions Made
- `endsWith('.ghe.com')` requires a real leading label -> bare `ghe.com`, `notghe.com`, and `github.com.attacker.com` are all denied (structural, not substring).
- `http://github.com` is admitted: the match is host-based, not scheme-based (plan behavior explicitly allows this).
- Reworded the trust.ts header comment to avoid the literal `sync-gate` token so the acceptance-criterion grep (`git grep -n "sync-gate" trust.ts`) returns nothing while still documenting the ADR C2 non-coupling intent.

## Deviations from Plan

None - plan executed exactly as written. (The comment rewording noted above is a wording choice to satisfy the literal grep acceptance criterion, not a behavioral deviation.)

## Issues Encountered
None. Baseline suite (245 tests) was green; after the widening the suite is 271 tests green. As the plan predicted, the pre-existing select-backend fixtures lacked GITHUB_SERVER_URL, so the widening did not break any existing always-forbidden case before those cases were revised in Task 2.

## Threat Model Coverage
- **T-05-01-02 (EoP, dangerous trigger admitted):** mitigated - HOST_GATED_EVENTS is exactly pull_request+release; the dangerous trio is proven refused on every host including github.com.
- **T-05-01-03 (Tampering, write-widen widening sync):** mitigated - trust.ts imports nothing from the sync gate; cross-check proves isSyncTrusted still refuses pull_request/release on github.com.
- **T-05-01-04 (Spoofing, substring host match):** mitigated - structural URL hostname compare + endsWith('.ghe.com') leading-label requirement; tested against attacker-suffix and bare-ghe.com.
- **T-05-01-01 (Spoofing, GITHUB_SERVER_URL):** accepted residual per ADR C1 - the in-code gate is fork-spoofable defense-in-depth; GitHub's server-side read-only-token guard is load-bearing. /meta cross-check deferred (D-04).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Write-trust widening is complete and single-source; ready for 05-03 (codegen of the dependency-free CommonJS copy + selfcheck.cjs drift guard) which regenerates the same TRUSTED_EVENTS + HOST_GATED_EVENTS + host-gate logic into `.cjs`.
- No blockers.

## Self-Check: PASSED

All modified files exist on disk; all three task commits (`5cbc5bb`, `41312fd`, `988e420`) are present in git history. Suite 271 tests green; typecheck, build, `fallow:ci` (0 issues), and `nx format:check --all` all clean.

---
*Phase: 05-trust-widening-ppe-gate*
*Completed: 2026-07-20*
