---
phase: 04-publish-retention-observability
plan: 01
subsystem: infra
tags: [github-actions, trust-boundary, sync-gate, tdd, vitest, publish]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: "lib/trust.ts write-gate shape (default-deny allowlist, injectable env bag) copied as the SHAPE analog"
provides:
  - "isSyncTrusted(env, readDefaultBranch?) — the sync/publish predicate ({push,schedule} + default branch), a SEPARATE trust boundary from the write gate"
  - "SYNC_EVENTS — frozen ['push','schedule'] allowlist, a NEW declaration (not an import of the write gate's allowlist)"
  - "sync-gate.spec.ts — TRUST-02 event/ref matrix + widening-proof content-pin (21 tests)"
affects: [04-04-publish-mirror, 04-06-ci-publish-job, phase-05-trust-widening]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Separate-source-of-truth trust predicate: distinct allowlist declaration + content-pin so a sibling gate widening cannot silently widen this one (D-01 / ADR C2)"
    - "Injectable default-branch reader (2nd param) so the predicate is testable without touching the filesystem; Function.length stays 0 via defaulted params"
    - "Default-branch derived from the GITHUB_EVENT_PATH payload repository.default_branch, never inferred from GITHUB_REF_NAME (a tag push sets that too)"

key-files:
  created:
    - packages/github-cache/src/lib/sync-gate.ts
    - packages/github-cache/src/lib/sync-gate.spec.ts
  modified: []

key-decisions:
  - "SYNC_EVENTS is a NEW declaration, never an import of the write gate's allowlist (D-01: keep SYNC a distinct trust boundary so Phase 5 widening WRITE cannot silently widen SYNC)"
  - "Fail-closed default-branch read: any absent/unreadable/malformed payload returns undefined so the gate denies (an unknown default branch is never publish-eligible)"
  - "Two non-vacuous negative cases lock the two ref guards independently: a refs/heads/ non-default branch (branch-equality guard) and a refs/tags/main ref whose name equals the default branch (refs/heads/ prefix guard)"

patterns-established:
  - "Sibling trust boundary as a copied SHAPE with a separate source of truth + deep-equality content-pin"

requirements-completed: [TRUST-02]

coverage:
  - id: D1
    description: "isSyncTrusted is a pure, injectable, default-deny sync predicate ({push,schedule} inside Actions on the repository default branch), distinct from the write gate; rejects the 11 refused events, non-default branches, and tag/non-refs/heads refs; fails closed on an unreadable event payload"
    requirement: "TRUST-02"
    verification:
      - kind: unit
        ref: "packages/github-cache/src/lib/sync-gate.spec.ts#isSyncTrusted (20 cases: push/schedule accept, 11 refused events, non-default branch, tag ref, tag-ref-matching-default, non-true GITHUB_ACTIONS, outside Actions, fail-closed payload, empty env)"
        status: pass
    human_judgment: false
  - id: D2
    description: "SYNC_EVENTS is a separate declaration pinned to exactly ['push','schedule'] so a Phase 5 write-gate widening cannot silently widen the sync gate (widening-proof content-pin)"
    requirement: "TRUST-02"
    verification:
      - kind: unit
        ref: "packages/github-cache/src/lib/sync-gate.spec.ts#SYNC_EVENTS deep-equals the two-element push/schedule allowlist"
        status: pass
    human_judgment: false

# Metrics
duration: 15min
completed: 2026-07-19
status: complete
---

# Phase 04 Plan 01: Sync-Gate Predicate Summary

**`isSyncTrusted(env, readDefaultBranch?)` — a pure, injectable default-deny publish predicate ({push,schedule} inside Actions on the repository default branch) that is a SEPARATE trust boundary from the write gate, with a 21-test TRUST-02 event/ref matrix and a widening-proof content-pin.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-07-19T23:14:00Z (approx)
- **Completed:** 2026-07-19T23:29:15Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 2 (both created)

## Accomplishments
- `isSyncTrusted` enforces `{push,schedule}` + default-branch as a standalone predicate, independent of `lib/trust.ts`'s write gate (D-01 / ADR C2 CREEP control).
- `SYNC_EVENTS` is a NEW frozen `['push','schedule']` declaration with a deep-equality content-pin — a future write-gate widening cannot silently widen the sync gate.
- Default branch is read from the `GITHUB_EVENT_PATH` payload (`repository.default_branch`), fail-closed on any read/parse error; never inferred from `GITHUB_REF_NAME`.
- Full TRUST-02 refused-event/ref matrix is green (21 tests), including two non-vacuous negatives that lock the branch-equality guard and the `refs/heads/` prefix guard independently.

## Task Commits

Each task was committed atomically (TDD RED -> GREEN):

1. **Task 1 (RED): failing sync-gate event/ref matrix** - `0e451dd` (test)
2. **Task 1 (GREEN): implement isSyncTrusted predicate** - `6c84d9c` (feat)

**Plan metadata:** committed with SUMMARY.md + STATE.md + ROADMAP.md + REQUIREMENTS.md (docs).

## Files Created/Modified
- `packages/github-cache/src/lib/sync-gate.ts` - `SYNC_EVENTS` allowlist + `isSyncTrusted` predicate + private fail-closed `defaultBranch()` payload reader.
- `packages/github-cache/src/lib/sync-gate.spec.ts` - TRUST-02 matrix: push/schedule accept, 11 refused events, non-default branch, tag refs, non-true `GITHUB_ACTIONS`, outside-Actions, fail-closed payload, empty env, and the `SYNC_EVENTS` content-pin.

## Decisions Made
- Copied the SHAPE of `lib/trust.ts` (default-deny allowlist, `GITHUB_ACTIONS !== 'true'` short-circuit, `.includes(... ?? '')` membership, injectable env bag) but kept a SEPARATE source of truth — no import of the write gate's allowlist or predicate (D-01).
- Default-branch check is PART of the predicate (not a workflow `if:` alone), matching CONTEXT D-01; the reader is injected for tests so the predicate stays pure.

## Deviations from Plan

None - plan executed exactly as written. The one adjustment below was a wording change to satisfy an acceptance criterion, not a functional/scope deviation.

## Issues Encountered

**1. Acceptance-criterion grep conflicted with the required explanatory comment.**
- The plan's `<action>` requires a comment stating WHY the sync gate does not reuse the write gate, but the acceptance criterion requires `git grep "TRUSTED_EVENTS\|isWriteTrusted" sync-gate.ts` to return NOTHING. The initial comment named the write-gate symbol literally, tripping the grep.
- **Resolution:** Reworded the comment to explain the D-01 separation without the literal forbidden tokens ("the write gate's allowlist in lib/trust.ts ... never an import of it"). Both requirements now hold: the comment states why, and the grep returns nothing. Re-ran the suite (183/183 green) after the edit. Committed in `6c84d9c`.

## Deferred / Out-of-Scope Findings

**Pre-existing `npm run fallow:ci` failure (import cycle) — NOT introduced by this plan, out of scope, not fixed.**
- The plan `<verification>` listed `npm run fallow:ci` clean. It currently exits 1 on ONE finding: a circular dependency `releases-backend.ts -> local-context.ts -> select-backend.ts -> releases-backend.ts`.
- This cycle is 100% pre-existing: all three import edges exist at the base commit `15febbb` (before this plan's RED commit), and this plan's changeset is only `sync-gate.ts` + `sync-gate.spec.ts` (neither is in the cycle; `sync-gate.ts` imports only `node:fs`).
- It is a deliberate, documented, safe "call-time-only 3-file cycle" (source NOTE in `local-context.ts`; Phase 3 review item LO-01 accepted it as comment-only).
- All three cycle files are backend/serve-path modules, which this plan's `prohibitions` explicitly forbid touching ("MUST NOT touch lib/trust.ts, the serve path, or any backend"). Fixing it here is out of scope and prohibited.
- This plan's specific fallow concern IS satisfied: fallow detected 22 entry points and did NOT flag `sync-gate.ts` as unreachable — it is reachable via its spec import as the plan intended.
- Recommended owner: a backend-scoped plan/review may break the cycle (e.g., extract the shared `resolveGitHubToken` / `GITHUB_REPOSITORY_PATTERN` bindings), or fallow config may exempt the acknowledged call-time cycle. Tracked here for the phase verifier.

## Verification Results
- `npx nx test github-cache` — GREEN (183/183; 21 new sync-gate tests).
- `npx nx typecheck github-cache` — GREEN.
- `npx nx build github-cache` — GREEN.
- `git grep "TRUSTED_EVENTS\|isWriteTrusted" -- .../sync-gate.ts` — returns NOTHING (separate source of truth).
- `git grep "SYNC_EVENTS" -- .../sync-gate.ts` — single `as const` declaration.
- `npm run fallow:ci` — exits 1 on a PRE-EXISTING, out-of-scope import cycle unrelated to this plan (see Deferred / Out-of-Scope Findings); `sync-gate.ts` itself is reachable and not flagged.

## Self-Check: PASSED
- FOUND: packages/github-cache/src/lib/sync-gate.ts
- FOUND: packages/github-cache/src/lib/sync-gate.spec.ts
- FOUND commit: 0e451dd (test/RED)
- FOUND commit: 6c84d9c (feat/GREEN)
- Gate order verified: test(04-01) RED precedes feat(04-01) GREEN.

## TDD Gate Compliance
- RED gate: `0e451dd` test(04-01) — spec committed failing ("Cannot find module './sync-gate.js'") before implementation.
- GREEN gate: `6c84d9c` feat(04-01) — implementation committed with the suite green.
- REFACTOR: none needed (implementation is minimal).

## Next Phase Readiness
- `isSyncTrusted` and `SYNC_EVENTS` are ready to gate the publish path: 04-04 (publish-mirror engine) and 04-06 (CI publish matrix job) consume this predicate as the first statement of the publish bin.
- No blockers introduced by this plan. The pre-existing fallow:ci cycle is a phase-level backend concern, independent of this predicate.

---
*Phase: 04-publish-retention-observability*
*Completed: 2026-07-19*
