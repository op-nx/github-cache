---
phase: 04-publish-retention-observability
plan: 03
subsystem: cleanup
tags: [cleanup, retention, octokit, fault-injection, observability, tdd]
status: complete
requires:
  - "04-02: resolveMaxAgeDays (the coupled retention knob the 04-05 bin passes to cleanupMirror)"
  - "03: createReleasesReadBackend / ReleaseReadClient (Phase 3 read-only backend, re-asserted for TEST-06)"
provides:
  - "cleanupMirror(client, maxAgeDays): list-abort / delete-isolate prune engine (CleanupResult)"
  - "CleanupClient / CleanupRelease / CleanupAsset: the narrow injected-client seam for cleanup I/O"
  - "octokitFault(status, body?): shared fault-shaped error factory for injected-client specs"
affects:
  - "04-05: cleanup bin wires the real @octokit/rest adapter (octokit.paginate) into CleanupClient + schedules it"
  - "04-04: publish-mirror.spec.ts imports the shared octokitFault factory"
tech_stack:
  added: []
  patterns:
    - "Injected narrow-client seam (ReleaseReadClient precedent): engine is pure logic, spec injects a fault-shaped fake, zero network"
    - "Structural fault discrimination via a statusOf duck-type on error.status (never instanceof RequestError, never stderr text)"
    - "Materialize-before-delete: LIST phase collects the complete set first; any throw aborts with ZERO deletions"
    - "@actions/core observability (summary table + setFailed) mocked with a chainable summary fake"
key_files:
  created:
    - packages/github-cache/src/test/octokit-fault.ts
    - packages/github-cache/src/cleanup/cleanup.ts
    - packages/github-cache/src/cleanup/cleanup.spec.ts
  modified: []
decisions:
  - "cleanup LIST phase aborts on ANY throw (faithful to octokit.paginate rejecting on any page fault, incl. a page 404); 404-as-absence discrimination lives in the DELETE phase where a single deleteAsset can legitimately 404 (already gone)"
  - "a 404 on deleteAsset counts as pruned (desired end state achieved), not failed; only non-404 (401/403/429/5xx) is a real per-item failure"
  - "scanned = total cache-mirror-* assets examined (more informative than the reference impl's expired.length; pruned+failed reflect delete outcomes)"
metrics:
  duration_min: 5
  tasks: 3
  files_changed: 3
  tests_added: 9
  completed: 2026-07-20
requirements_marked:
  - RETAIN-01
  - TEST-06
requirements_partial:
  - "TEST-04 (cleanup-side isolation + non-zero exit tested here; bin wrapper is 04-05)"
  - "ROBUST-01 (cleanup/delete half delivered; publish half is 04-04)"
  - "OBS-01 (cleanup summary + setFailed delivered; publish/sync whole-run + docs are 04-04/04-06/Phase 6)"
---

# Phase 4 Plan 3: Age-Based Cleanup Engine (list-abort / delete-isolate) Summary

Age-based GitHub Releases cleanup engine `cleanupMirror(client, maxAgeDays)` behind a narrow injected client: a fail-loud LIST phase that materializes every `cache-mirror-*` release + asset before any deletion (any fault aborts with ZERO deletions), and a per-item-isolated DELETE phase that prunes by `created_at` and exits non-zero on aggregate failure -- plus the shared `octokitFault` test factory.

## What Was Built

- **`octokitFault(status, body?)`** (`src/test/octokit-fault.ts`) -- a shared, framework-free factory returning a real `Error` with a numeric `.status` and `response.data`, so specs can drive the duck-typed structural fault discrimination and distinguish a duplicate-asset 422 (`{ errors: [{ code: 'already_exists' }] }`) from a generic validation fault. No product imports; imported by `cleanup.spec.ts` and (next) `publish-mirror.spec.ts`.
- **`cleanupMirror(client, maxAgeDays)`** (`src/cleanup/cleanup.ts`) -- the prune engine:
  - **LIST phase** materializes the complete `cache-mirror-*` release + asset set *before* any delete. Any throw from `listAllReleases` / `listAllAssets` propagates and aborts the whole run with zero deletions. A load-bearing comment states this deliberately INVERTS the Phase 3 reader's swallow-every-fault-into-a-MISS discipline (a swallowed list fault here would read as absence and delete live data). Cleanup enumerates EVERY `cache-mirror-*` release (wider than the reader window, Pitfall 4), sharing only the age cutoff with the reader.
  - **DELETE phase** deletes only assets older than `maxAgeDays` (by `created_at`), each per-item isolated. A 404 is the only "already gone" absence (benign); every other status is a real per-item failure counted and `core.warning`-ed. Aggregate failure -> `core.setFailed` (non-zero exit).
  - **OBS-01** emits a `core.summary` table of pruned / failed / scanned counts.
  - Structural discrimination via a `statusOf` duck-type on `error.status`; imports `@actions/core` only, never `@octokit/rest`.
- **`cleanup.spec.ts`** (9 tests, TDD RED-first) -- the load-bearing RETAIN-01 mid-pagination-abort (proves `deleteAsset` is NEVER called on a list fault), non-404 list-fault abort, empty-repo no-op, `cache-mirror-*` scope filter, prune/retain by `created_at` (TEST-06), per-item isolation + `setFailed` on aggregate (TEST-04), 404-benign-vs-5xx-real (ROBUST-01), the OBS-01 summary counts, and the re-asserted read-only-local `put()->'forbidden'` (TEST-06 second half).

## How It Was Verified

- `npx nx test github-cache` -- 16 files / 208 tests green (cleanup.spec = 9 tests).
- `npx nx typecheck github-cache` and `npx nx build github-cache` -- green.
- `git grep` confirms `cleanup.ts` contains no `octokit/rest`, no `instanceof RequestError`, no `paginate.iterator` (injected narrow client only).
- TDD gates in git log: `test(04-03)` RED (12601c7) before `feat(04-03)` GREEN (5ee5911).

## Deviations from Plan

### Auto-fixed / Design refinements (no user decision needed)

1. **LIST phase aborts on ANY throw (incl. a hypothetical page 404), rather than special-casing 404-as-absence in the list phase.** The must-have text ("any non-404 fault ... aborts") could read as "a 404 during listing is absence". But the real 04-05 adapter wraps `octokit.paginate`, which rejects the whole call on ANY page fault (a 404 on a page included) -- so abort-on-any-list-throw is faithful to the production mechanism and is the SAFE direction at a data-loss boundary (never delete on uncertainty). The "only 404 is absence" discrimination (ROBUST-01) is applied in the DELETE phase, where a single `deleteAsset` can legitimately 404 (already gone). Rule 1/2 (correctness at a data-loss boundary).
2. **A 404 on `deleteAsset` is counted as `pruned`, not a separate bucket.** The asset is gone (the desired end state), so it must not be `failed`; counting it as pruned keeps the OBS-01 counts meaningful. Documented and tested.
3. **`scanned` = total `cache-mirror-*` assets examined** (RESEARCH Pattern 4's reference used `expired.length`). Total-examined is the accurate reading of the word "scanned" and more useful for the OBS-01 signal; `pruned` + `failed` already reflect delete outcomes.

## Known Stubs

None. The engine is complete pure logic; the real `@octokit/rest`-backed `CleanupClient` adapter and the scheduled `cleanup.yml` workflow are the explicit scope of 04-05 / 04-06 (the injected-client seam is intentional, not a stub).

## Requirements

- **Marked complete:** RETAIN-01 (list-abort/delete-isolate engine + the mid-pagination-abort test), TEST-06 (expired pruned / within-window retained by `created_at` + read-only-local `put()->'forbidden'` re-asserted).
- **Partial (cleanup-side delivered; completing plan owns closure):** TEST-04 (bin wrapper is 04-05), ROBUST-01 (publish half is 04-04), OBS-01 (publish/sync whole-run + docs are 04-04/04-06/Phase 6). Left for their completing plan / the phase verifier's cross-reference rather than over-claimed here.

## Notes for Next Plans

- **04-05** constructs the real `CleanupClient` by wrapping `octokit.paginate(listReleases)` / `octokit.paginate(listReleaseAssets)` (materialize + reject-on-page-fault) and `deleteReleaseAsset`, resolves `maxAgeDays` via `resolveMaxAgeDays` (04-02), and must NOT swallow `core.setFailed`'s exit code. Register the bin as a fallow entry point.
- **04-04** should import `octokitFault` from `../test/octokit-fault.js` for the publish fault matrix.
- Pre-existing fallow import cycle (releases-backend -> local-context -> select-backend -> releases-backend) keeps `fallow:ci` RED; untouched here (not in scope).

## Self-Check: PASSED

- Files: `src/test/octokit-fault.ts`, `src/cleanup/cleanup.ts`, `src/cleanup/cleanup.spec.ts` -- all FOUND on disk.
- Commits: d949678, 12601c7, 5ee5911, a7984e7 -- all FOUND in git log.
