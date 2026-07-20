---
phase: 04-publish-retention-observability
plan: 04
subsystem: infra
tags: [github-releases, actions-cache, octokit, mirror, publish, retention, tdd]

# Dependency graph
requires:
  - phase: 04-publish-retention-observability (04-02)
    provides: retention.ts (shardTag current-month shard, resolveMaxAgeDays, shardTagsForWindow)
  - phase: 04-publish-retention-observability (04-03)
    provides: shared octokitFault test factory (src/test/octokit-fault.ts); cleanup engine statusOf duck-type precedent
  - phase: 03 (03-01)
    provides: releaseAssetName single-source OS-namespaced asset name (CORR-01)
  - phase: 02 (02-01)
    provides: createActionsCacheBackend().get same-OS restore; @actions/core exact-pinned
provides:
  - "publishMirror(client, options) injected-client, Octokit-free mirror engine"
  - "PublishClient narrow injected interface (listCacheEntries/getReleaseByTag/createRelease/listReleaseAssets/uploadReleaseAsset)"
  - "RELEASE_ASSET_MAX_BYTES (~2 GiB pre-upload boundary) + RELEASE_ASSET_CAP (1000) constants"
  - "publish-mirror.spec.ts full fault matrix + caps + first-write-wins (TEST-03)"
affects: [04-06 publish bin/action wiring, 04-05, cross-OS round-trip CI job]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Injected narrow-client seam + fault-shaped fake (no live network); the engine imports NO @octokit/rest"
    - "Structural fault discrimination via inlined statusOf duck-type on error.status (never instanceof RequestError, never body text)"
    - "Lazy get-or-create shard: an all-MISS OS leg never creates an empty Release"
    - "Deterministic pre-upload byte-length guard (fail-loud) before any I/O"

key-files:
  created:
    - packages/github-cache/src/publish/publish-mirror.ts
    - packages/github-cache/src/publish/publish-mirror.spec.ts
  modified: []

key-decisions:
  - "publishMirror returns { mirrored, skipped, failed } (added failed vs the plan's { mirrored, skipped }) so the 04-06 bin can fail loud on per-item failures for OBS-01/D-15 -- matches the 04-03 cleanup engine's { pruned, failed, scanned } shape"
  - "Upload 422 discriminated on STATUS ONLY (never body text) per the <important> directive; the pre-list existence check is the primary no-overwrite mechanism, so a residual 422 can only be a byte-identical race -> benign skip"
  - "statusOf inlined (not shared with cleanup.ts) so the engine imports nothing from a sibling module -- matches the 04-03 precedent"
  - "options param carries only { now?: Date } to pin the shard tag for tests (test-injection only, same convention as releaseAssetName's platform param); no runtime mode surface"

patterns-established:
  - "Pre-upload boundary check fails the WHOLE run loud (throw) even though discovered per-hash (D-12)"
  - "Per-item upload fault isolated: annotate via core.warning + count failed, batch continues (D-13); whole-run faults (enumeration, shard-ensure non-404, ~2 GiB) throw"

requirements-completed: []

coverage:
  - id: D1
    description: "publishMirror mirrors ONLY nx-cache- keys (prefix stripped to hash), ignoring every other CI cache key (D-16)"
    requirement: "TEST-03"
    verification:
      - kind: unit
        ref: "src/publish/publish-mirror.spec.ts#mirrors ONLY nx-cache- keys, stripping the prefix to the hash, and never restores a non-nx key"
        status: pass
    human_judgment: false
  - id: D2
    description: "Same-OS restore MISS (foreign-OS/evicted) is skipped with no Release I/O; lazy shard ensure (D-03)"
    requirement: "TEST-03"
    verification:
      - kind: unit
        ref: "src/publish/publish-mirror.spec.ts#skips a foreign-OS/evicted entry whose restore MISSes, touching no Release I/O"
        status: pass
    human_judgment: false
  - id: D3
    description: "Pre-upload bytes.byteLength >= ~2 GiB fails loud (core.error + throw) BEFORE any upload; cap-1 uploads (D-12/ROBUST-02)"
    requirement: "ROBUST-02"
    verification:
      - kind: unit
        ref: "src/publish/publish-mirror.spec.ts#refuses to upload at the ~2 GiB ceiling: core.error + throw, NO upload attempted (cap)"
        status: pass
      - kind: unit
        ref: "src/publish/publish-mirror.spec.ts#uploads an entry just under the ~2 GiB ceiling (cap-1)"
        status: pass
    human_judgment: false
  - id: D4
    description: "1000-asset per-release cap -> core.warning + skip (no throw, no setFailed) at 999/1000/1001 (D-11/ROBUST-05)"
    requirement: "ROBUST-05"
    verification:
      - kind: unit
        ref: "src/publish/publish-mirror.spec.ts#with %i existing assets it %ss the new entry (no hard-fail either way)"
        status: pass
    human_judgment: false
  - id: D5
    description: "First-write-wins: pre-list present name -> benign skip; upload 422 already_exists race -> benign skip; a real fault surfaced (D-05/TRUST-07)"
    requirement: "TRUST-07"
    verification:
      - kind: unit
        ref: "src/publish/publish-mirror.spec.ts#skips (no upload) when the asset name is already present in the shard (pre-list)"
        status: pass
      - kind: unit
        ref: "src/publish/publish-mirror.spec.ts#treats a 422 already_exists upload race as a benign skip, never a fault"
        status: pass
    human_judgment: false
  - id: D6
    description: "Structural error.status discrimination: 404->create shard, createRelease 422->re-read, real 5xx on lookup->whole-run throw (ROBUST-01)"
    requirement: "ROBUST-01"
    verification:
      - kind: unit
        ref: "src/publish/publish-mirror.spec.ts#surfaces a real 5xx on the shard lookup as a whole-run throw (never absence)"
        status: pass
      - kind: unit
        ref: "src/publish/publish-mirror.spec.ts#re-reads the shard by tag when createRelease 422s (another leg won the create race)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Per-item upload 5xx isolated+annotated+counted (batch continues); whole-run enumeration fault throws; returns mirrored/skipped/failed (OBS-01/D-13)"
    requirement: "OBS-01"
    verification:
      - kind: unit
        ref: "src/publish/publish-mirror.spec.ts#isolates and counts a per-item upload 5xx, annotates it, and mirrors the rest (D-13)"
        status: pass
      - kind: unit
        ref: "src/publish/publish-mirror.spec.ts#propagates a listCacheEntries fault as a whole-run throw"
        status: pass
    human_judgment: false
  - id: D8
    description: "Uploaded asset name derived ONLY through releaseAssetName(hash) -- non-vacuous single-source check (CORR-01)"
    requirement: "TEST-03"
    verification:
      - kind: unit
        ref: "src/publish/publish-mirror.spec.ts#derives the uploaded asset name ONLY through releaseAssetName(hash) (CORR-01, non-vacuous)"
        status: pass
    human_judgment: false

# Metrics
duration: 12min
completed: 2026-07-20
status: complete
---

# Phase 04 Plan 04: Publish/Mirror Engine Summary

**publishMirror: an injected-client, Octokit-free engine that mirrors only nx-cache- keys per-OS first-write-wins to the current-month Release shard, fails loud pre-upload at the ~2 GiB boundary, skips-and-warns at the 1000-asset cap, and discriminates every fault on error.status.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-07-20T03:29:58Z
- **Completed:** 2026-07-20T03:42:00Z
- **Tasks:** 1 (TDD: RED + GREEN)
- **Files modified:** 2 (both created)

## Accomplishments
- `publishMirror(client, options)` orchestration: enumerate -> `nx-cache-` prefix filter (D-16) -> same-OS restore via `createActionsCacheBackend().get` (D-03) -> lazy get-or-create current-month shard (`retention.shardTag`) -> first-write-wins upload; returns `{ mirrored, skipped, failed }`.
- Deterministic pre-upload `bytes.byteLength >= RELEASE_ASSET_MAX_BYTES` guard: `core.error` + throw BEFORE any upload, asserted to never reach the upload client method (D-12/ROBUST-02).
- 1000-asset per-release cap degrades to `core.warning` + skip with no throw/setFailed, verified at 999/1000/1001 (D-11/ROBUST-05).
- Full fault matrix behind an injected fake using the shared `octokitFault` factory: 404-then-create, createRelease-422 re-read, real 5xx whole-run throw, per-item upload 5xx isolated+annotated, 422 already_exists benign skip (TEST-03/ROBUST-01/TRUST-07).
- Engine is Octokit-free (`git grep octokit/rest` in the engine returns nothing); the real adapter is deferred to the 04-06 bin.

## Task Commits

Each task was committed atomically (TDD):

1. **Task 1 (RED): failing publish-mirror fault matrix + caps spec** - `d56c0ac` (test)
2. **Task 1 (GREEN): publishMirror injected-client mirror engine** - `e16517c` (feat)

**Plan metadata:** docs commit (this SUMMARY + STATE.md + ROADMAP.md)

## Files Created/Modified
- `packages/github-cache/src/publish/publish-mirror.ts` - the injected-client, Octokit-free mirror engine + `PublishClient` interface + `RELEASE_ASSET_MAX_BYTES`/`RELEASE_ASSET_CAP` constants
- `packages/github-cache/src/publish/publish-mirror.spec.ts` - 16 tests (prefix filter, happy path, MISS skip, first-write-wins pre-list + 422 race, 404-create/422-reread, real 5xx throw vs per-item annotate, 1000-cap at 999/1000/1001, ~2 GiB at cap-1/cap, non-vacuous name check)

## Decisions Made
- **Return shape `{ mirrored, skipped, failed }`** (superset of the plan's `{ mirrored, skipped }`): the 04-06 bin needs the per-item `failed` count to fail loud for OBS-01/D-15, and it matches the sibling 04-03 cleanup engine's `{ pruned, failed, scanned }`. A per-item upload fault is isolated (annotate + count), never a whole-run abort (D-13); only enumeration/shard-ensure-non-404/~2 GiB faults throw.
- **Upload 422 discriminated on STATUS ONLY** (never body text) per the `<important>` directive; the pre-list existence check is the primary no-overwrite mechanism, so a residual 422 can only be a byte-identical duplicate-upload race -> benign skip.
- **`statusOf` inlined** rather than shared with `cleanup.ts`, so the engine imports nothing from a sibling module (matches the 04-03 precedent; the same 8-line duck-type ships in both).
- **Test approach: mock `../backend/actions-cache-backend.js` (not `@actions/cache`)** so `get` is fully mock-driven and the restored `byteLength` is controllable -- the ~2 GiB boundary cannot be exercised by allocating a real 2 GiB buffer. This still honors the plan's intent ("get restore is mock-driven").
- **Requirements left unchecked in REQUIREMENTS.md**, consistent with plans 04-01/02/03: this project closes requirements at the phase verification gate (gsd-verifier's 3-source cross-reference), not per-plan.

## Deviations from Plan

### Auto-fixed / discretionary adjustments

**1. [Rule 2 - Missing critical for OBS-01] Return `{ mirrored, skipped, failed }` instead of `{ mirrored, skipped }`**
- **Found during:** Task 1 (GREEN)
- **Issue:** The plan's literal `{ mirrored, skipped }` gives the 04-06 bin no per-item failure count to fail loud on (OBS-01/D-15).
- **Fix:** Added `failed` to `PublishResult`; a per-item upload fault increments it and annotates via `core.warning`, matching the 04-03 cleanup engine shape.
- **Files modified:** packages/github-cache/src/publish/publish-mirror.ts
- **Verification:** `isolates and counts a per-item upload 5xx` test asserts `{ mirrored: 1, skipped: 0, failed: 1 }`.
- **Committed in:** e16517c

**2. [Discretion - test approach] Mock the backend module for deterministic byteLength**
- **Found during:** Task 1 (RED)
- **Issue:** The plan suggested `vi.mock('@actions/cache')`, but the ~2 GiB boundary needs a controllable restored byteLength that a real 2 GiB allocation cannot provide.
- **Fix:** Mocked `../backend/actions-cache-backend.js` so `get` returns a fake `{ kind: 'hit', bytes: { byteLength } }`; honors the plan's intent (mock-driven restore) within CONTEXT test-approach discretion.
- **Files modified:** packages/github-cache/src/publish/publish-mirror.spec.ts
- **Verification:** ~2 GiB tests pass; upload asserted never called at the cap.
- **Committed in:** d56c0ac

---

**Total deviations:** 2 (1 missing-critical for OBS-01, 1 test-approach discretion)
**Impact on plan:** Both within CONTEXT-granted discretion; no scope creep. The engine matches every must_have truth and prohibition (no @octokit/rest, no second name/tag template, no hard-fail at 1000-cap, no upload at/over ~2 GiB).

## Issues Encountered
None - RED failed as expected (missing module), GREEN passed all 224 tests on first implementation.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The engine is ready for the 04-06 bin, which constructs the real Octokit adapter satisfying `PublishClient` (behind `resolveGitHubToken`), applies the `isSyncTrusted` gate, and emits the OBS-01 summary from `{ mirrored, skipped, failed }`.
- Verification gates green: `npx nx test github-cache` (224 passed), `npx nx typecheck`, `npx nx build`. `git grep "octokit/rest\|instanceof RequestError"` on the engine returns nothing.
- Note: `npm run fallow:ci` has a pre-existing (Phase 3) import-cycle failure unrelated to this plan; publish-mirror.ts is reachable via its spec import and is NOT flagged by fallow.

## Self-Check: PASSED
- FOUND: packages/github-cache/src/publish/publish-mirror.ts
- FOUND: packages/github-cache/src/publish/publish-mirror.spec.ts
- FOUND commit: d56c0ac (test/RED)
- FOUND commit: e16517c (feat/GREEN)

---
*Phase: 04-publish-retention-observability*
*Completed: 2026-07-20*
