---
phase: 04-publish-retention-observability
plan: 02
subsystem: infra
tags: [github-releases, retention, month-shard, reader, tdd, vitest, cross-os]

# Dependency graph
requires:
  - phase: 03-releases-reader
    provides: "createReleasesReadClient.fetchAsset (release-lookup -> paginate-assets -> redirect-drop download) + the shardTag() single-shard seam this plan replaces"
  - phase: 03-releases-reader
    provides: "releaseAssetName / cachePlatform single-source OS+hash asset name (unchanged, still the derivation the walk resolves)"
provides:
  - "resolveMaxAgeDays(env) — the ONE coupled retention knob CACHE_MIRROR_MAX_AGE_DAYS (default 30, clamp 365, reject NaN/<=0), shared by the reader window AND (04-03) cleanup"
  - "shardTagsForWindow(maxAgeDays, now?) — calendar-month shard tags over [now-maxAgeDays, now], NEWEST FIRST (no maxAgeDays/30 under-scan)"
  - "shardTag(date?) — the cache-mirror-YYYYMM month-shard tag, MOVED to lib/retention.ts as the single-source template (comment-locked)"
  - "Releases reader walks the retention window newest-first: 404 advances to the next shard, MISS only after exhausting the window (D-08); fault split + redirect-drop download preserved"
affects: [04-03-cleanup, 04-04-publish-mirror, 04-06-ci-publish-job]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One coupled retention knob (resolveMaxAgeDays) feeds BOTH read window and prune scan — a second knob is prohibited (read/retention drift = simultaneously unreadable + unprunable)"
    - "Single-source comment-locked month-shard template: shardTagsForWindow reuses shardTag so cache-mirror-YYYYMM exists in exactly one function (drift = silent cross-OS MISS)"
    - "Window walk newest-first with per-shard helper (fetchAssetFromShard): 404 = absence-in-this-shard -> next; non-404 = fault -> throw (port degrades to warned MISS)"
    - "Calendar-month cursor arithmetic (UTC month step-back), never maxAgeDays/30, so short months and month boundaries are covered"
    - "Deterministic time-dependent specs via vi.useFakeTimers + setSystemTime (reader reads new Date() internally; pin the clock, do not widen the signature)"

key-files:
  created:
    - packages/github-cache/src/lib/retention.ts
    - packages/github-cache/src/lib/retention.spec.ts
  modified:
    - packages/github-cache/src/backend/releases-backend.ts
    - packages/github-cache/src/backend/releases-backend.spec.ts

key-decisions:
  - "shardTag MOVED (not copied) to lib/retention.ts; releases-backend no longer defines it — single production home for the cache-mirror-YYYYMM template (Task 1 single-source acceptance, verified by rg)"
  - "shardTagsForWindow reuses shardTag(cursor) internally so the tag literal lives in exactly one function (stronger single-source than the RESEARCH Pattern 5 inline build)"
  - "Per-shard sequence extracted to a module-level fetchAssetFromShard helper so the outer window loop stays a clean for-of; the inner release-lookup/pagination/redirect-drop-download logic is byte-identical to Phase 3"
  - "Existing tests pinned to a deterministic 2-shard window (2026-07-15 + default 30d) via fake timers rather than changing ~13 call sites; only the absent-asset test was widened to exhaust both shards"
  - "RETAIN-01 is NOT marked complete: it is the cleanup list-abort/delete-isolate requirement (04-03). 04-02 delivers only the shared retention knob it will consume."

patterns-established:
  - "Coupled-knob retention module consumed by both reader and cleanup (D-07)"
  - "Newest-first month-shard window walk that exhausts before MISS (D-08)"

requirements-completed: []  # RETAIN-01 (cleanup) is delivered by 04-03, not here; see Decisions.

coverage:
  - id: D1
    description: "resolveMaxAgeDays: one coupled knob CACHE_MIRROR_MAX_AGE_DAYS, default 30, clamp to 365 ceiling, reject NaN/empty/0/negative/non-finite back to default (T-04-04 input validation)"
    verification:
      - kind: unit
        ref: "packages/github-cache/src/lib/retention.spec.ts#resolveMaxAgeDays one coupled knob (D-07, T-04-04)"
        status: pass
    human_judgment: false
  - id: D2
    description: "shardTagsForWindow: calendar-month shard tags over [now-maxAgeDays, now], newest first, no /30 under-scan (30-day, Dec->Jan boundary, 28-day February 3-shard, single-day windows)"
    verification:
      - kind: unit
        ref: "packages/github-cache/src/lib/retention.spec.ts#shardTagsForWindow calendar-month walk, newest first (D-08)"
        status: pass
    human_judgment: false
  - id: D3
    description: "shardTag moved to lib/retention.ts as the single-source cache-mirror-YYYYMM month-shard tag (string-literal pins carried over from the Phase 3 seam)"
    verification:
      - kind: unit
        ref: "packages/github-cache/src/lib/retention.spec.ts#shardTag current-month single-shard tag (D-03/D-08)"
        status: pass
      - kind: other
        ref: "rg -n cache-mirror- packages/github-cache/src --glob '!*.spec.ts' => retention.ts only"
        status: pass
    human_judgment: false
  - id: D4
    description: "Releases reader walks shardTagsForWindow(resolveMaxAgeDays(env)) newest-first: newest-shard 404 advances to the prior shard and HITs there; MISS only after exhausting the window; non-404 fault still throws; redirect-drop download unchanged"
    verification:
      - kind: unit
        ref: "packages/github-cache/src/backend/releases-backend.spec.ts#createReleasesReadClient retention window walk (D-08)"
        status: pass
      - kind: unit
        ref: "packages/github-cache/src/backend/releases-backend.spec.ts#createReleasesReadClient fault matrix through the backend (SRV-05, D-11)"
        status: pass
    human_judgment: false

# Metrics
duration: 45min
completed: 2026-07-20
status: complete
---

# Phase 4 Plan 02: Retention Module + Reader Window Walk Summary

**One coupled retention knob (`resolveMaxAgeDays`, default 30) and a single-source calendar-month `shardTagsForWindow` drive a newest-first reader window walk so a Releases read survives a month boundary, replacing Phase 3's single-shard `shardTag()` stub.**

## Performance

- **Duration:** ~45 min (active; wall-clock inflated by a mid-run spend-limit pause)
- **Started:** 2026-07-19T23:33:54Z
- **Completed:** 2026-07-20
- **Tasks:** 2 (each TDD: RED then GREEN)
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments
- `lib/retention.ts`: `resolveMaxAgeDays` (one coupled knob, default 30, clamp 365, reject NaN/<=0) + `shardTagsForWindow` (calendar-month, newest-first) + `shardTag` moved here as the single-source `cache-mirror-YYYYMM` template.
- Releases reader now walks the retention window newest-first: a 404 on one shard advances to the next; only exhausting every shard is a MISS. Cross-month reads resolve; the current-month HIT is unchanged (no FOUND-02/TEST-05 regression).
- The `cache-mirror-YYYYMM` tag scheme now lives in exactly one production file, comment-locked (drift = silent cross-OS MISS).
- Suite made calendar-date-independent (fake timers pin a deterministic 2-shard window); 199 tests green.

## Task Commits

1. **Task 1 RED: move shardTag pins + retention spec** - `6a68b1f` (test)
2. **Task 1 GREEN: lib/retention.ts single-source scheme + coupled knob** - `8c3d69c` (feat)
3. **Task 2 RED: failing retention-window walk tests** - `a853cd4` (test)
4. **Task 2 GREEN: reader walks the window newest-first** - `79f4708` (feat)

**Plan metadata:** `docs(04-02)` (this SUMMARY + STATE + ROADMAP + deferred-items)

## Files Created/Modified
- `packages/github-cache/src/lib/retention.ts` - resolveMaxAgeDays + shardTagsForWindow + shardTag (single-source, comment-locked).
- `packages/github-cache/src/lib/retention.spec.ts` - moved shardTag pins + knob boundary cases + calendar-month walk cases (16 tests).
- `packages/github-cache/src/backend/releases-backend.ts` - imports shardTagsForWindow + resolveMaxAgeDays; fetchAsset loops the window via the extracted fetchAssetFromShard helper; local shardTag removed.
- `packages/github-cache/src/backend/releases-backend.spec.ts` - fake-timer pinned window + 2 walk tests; absent-asset test widened to exhaust the window; shardTag pins removed (moved).

## Decisions Made
- **shardTagsForWindow reuses shardTag** so the `cache-mirror-` literal exists in one function only (single-source > RESEARCH Pattern 5's inline rebuild).
- **Per-shard helper (`fetchAssetFromShard`)** keeps the walk loop clean while the inner release-lookup -> paginate -> redirect-drop-download stays byte-identical to Phase 3 (fault split and no-`redirect:manual` download preserved).
- **Determinism via fake timers** (pin 2026-07-15 + default 30d = 2-shard window) rather than editing ~13 existing call sites; the reader reads `new Date()` internally, so the clock is the only injection point without widening the signature.
- **RETAIN-01 left OPEN** (see Deviations).

## Deviations from Plan

### 1. [Scope] RETAIN-01 NOT marked complete (frontmatter attribution vs actual delivery)
- **Found during:** Task wrap-up (requirements state update).
- **Issue:** The plan frontmatter lists `requirements: [RETAIN-01]`, but RETAIN-01 in REQUIREMENTS.md is the **cleanup** requirement ("list phase aborts with zero deletions on any non-404 fault or incomplete pagination; delete phase isolates + non-zero exit; test injects a mid-pagination fault"). 04-02 delivers no cleanup code — it delivers the shared `resolveMaxAgeDays` knob + `shardTagsForWindow` (D-07/D-08) that RETAIN-01's cleanup (Plan 04-03) will consume.
- **Fix:** `requirements-completed: []`; RETAIN-01 stays `[ ]` in REQUIREMENTS.md. Marking it now would be a false positive the milestone audit's 3-source cross-reference exists to catch.
- **Impact:** None on delivered work; prevents premature requirement closure. 04-03 will complete RETAIN-01.

### 2. [Out of scope - deferred] Pre-existing fallow:ci circular-dependency failure
- **Found during:** Task 2 verification (`npm run fallow:ci`).
- **Issue:** The blocking `fallow:ci` gate exits non-zero on one circular dependency: `releases-backend.ts -> local-context.ts -> select-backend.ts -> releases-backend.ts`.
- **Fix:** None (out of scope). Confirmed empirically PRE-EXISTING — fallow:ci was already RED at `34a2f70` (pre-04-02) with the identical finding; the cycle edge was introduced in `41d0445` (03-03) and documented then as a "benign call-time-only circular import". 04-02's `retention.ts` has zero imports and is not in the cycle. Logged to `deferred-items.md`.
- **Impact:** None from 04-02. Breaking the cycle is a Rule 4 architectural change (move shared identity symbols out of `select-backend`) touching the Phase 3 auth core — belongs to a dedicated structural task, not a retention plan.

---

**Total deviations:** 2 (1 scope decision, 1 pre-existing out-of-scope finding). No auto-fixes to source were needed.
**Impact on plan:** All planned work delivered exactly; no scope creep.

## Issues Encountered
- Editor/LSP intermittently reported stale "Cannot find name 'shardTag'" false positives in releases-backend files during the move; `npx nx typecheck` (authoritative) was green throughout. No code chased the stale diagnostics.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Ready: `resolveMaxAgeDays` + `shardTagsForWindow` are the shared retention foundation for 04-03 cleanup (prune scan enumerates every `cache-mirror-*` release, wider than the read window, but shares this one knob) and for the 04-04 publisher's shard tags.
- Blocker (repo-wide, pre-existing): `fallow:ci` is RED on the releases-backend/local-context/select-backend import cycle. Not introduced here; needs a dedicated structural cleanup before the CI dead-code gate passes.

## Self-Check

- retention.ts: FOUND
- retention.spec.ts: FOUND (16 tests)
- releases-backend.ts walk (shardTagsForWindow): FOUND
- releases-backend.spec.ts walk tests: FOUND (28 tests)
- Commits 6a68b1f, 8c3d69c, a853cd4, 79f4708: present on HEAD

## Self-Check: PASSED

---
*Phase: 04-publish-retention-observability*
*Completed: 2026-07-20*
