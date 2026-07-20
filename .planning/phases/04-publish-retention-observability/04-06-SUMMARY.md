---
phase: 04-publish-retention-observability
plan: 06
subsystem: infra
tags: [octokit, github-releases, actions-cache, github-actions, workflow, publish, sync-gate, observability]

# Dependency graph
requires:
  - phase: 04-01
    provides: isSyncTrusted sync-gate predicate (separate from the write gate, D-01/TRUST-02)
  - phase: 04-02
    provides: retention.ts shardTag/shardTagsForWindow month-shard scheme + resolveMaxAgeDays
  - phase: 04-04
    provides: publishMirror engine + the PublishClient injected-client interface (D-04)
  - phase: 04-05
    provides: createCleanupClient real-Octokit adapter precedent; @octokit/rest@22.0.1 pin
  - phase: 03-01
    provides: releaseAssetName single-source OS+hash asset name; createReleasesReadBackend/Client reader
provides:
  - "publish operation on the node24 JS action (isSyncTrusted gate FIRST -> Octokit createPublishClient adapter -> publishMirror -> D-17 core.summary)"
  - "action.yml with hash made optional + the publish operation documented"
  - "ci.yml per-OS publish matrix job (push-gated, needs: build, contents:write + actions:read)"
  - "live cross-OS publish/read-back round-trip: roundtrip/read-back.ts bin + ci.yml publish-verify matrix job"
affects: [phase-05-trust-widening, phase-06-consumer-docs]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Real-Octokit adapter over the injected PublishClient seam, mirroring createCleanupClient (octokit.paginate for getActionsCacheList + listReleaseAssets)"
    - "Reader-direct read-back bin (createReleasesReadBackend(createReleasesReadClient(env)), NOT selectBackend) with a pathToFileURL invocation guard"
    - "Per-OS publish matrix as a JS-action operation (restoreCache needs the JS-action-only ACTIONS_RUNTIME_TOKEN runtime; a run: step MISSes)"

key-files:
  created:
    - packages/github-cache/src/roundtrip/read-back.ts
  modified:
    - packages/github-cache/src/action/index.ts
    - packages/github-cache/action.yml
    - .github/workflows/ci.yml
    - .fallowrc.jsonc

key-decisions:
  - "The publish path is an operation on the EXISTING node24 action (not a run: step, not a dedicated sibling action.yml): reuses the proven JS-action restoreCache runtime and needs no ../ traversal in action main (Wiring caveat)"
  - "isSyncTrusted is the FIRST statement of the publish branch; a gated-out run is core.info + exit 0, never an error (D-01/TRUST-02) -- the default-branch check lives in the predicate, not the workflow if: alone"
  - "The publish job seeds a known nx-cache-<run_id> entry per OS before publishing, because this repo runs Nx on the LOCAL cache and has no other nx-cache-* Actions traffic to mirror -- this doubles as the round-trip's deterministic producer"
  - "The live round-trip read-back invokes the Releases reader DIRECTLY (a plain node step, native fetch) rather than selectBackend, which returns the writable backend in a push context (TRUST-05)"

patterns-established:
  - "Publish operation on the JS action: sync-gate -> fail-closed repo/token resolution -> Octokit adapter -> engine -> D-17 summary"
  - "publish-verify matrix mirrors dogfood-verify: push-gated, needs the producer, inherits contents:read only, a MISS fails loud"

requirements-completed: [TRUST-02, OBS-01]

coverage:
  - id: D1
    description: "Sync-gated publish operation on the node24 JS action (isSyncTrusted gate first, createPublishClient real-Octokit adapter, publishMirror call, D-17 core.summary mirrored/skipped/failed table); action.yml hash optional + publish documented"
    requirement: "TRUST-02"
    verification:
      - kind: unit
        ref: "packages/github-cache/src/publish/publish-mirror.spec.ts (publishMirror engine, 16 tests)"
        status: pass
      - kind: unit
        ref: "packages/github-cache/src/lib/sync-gate.spec.ts (isSyncTrusted matrix, 21 tests)"
        status: pass
      - kind: other
        ref: "npx nx typecheck+build github-cache green; git grep isSyncTrusted/octokit.paginate/core.summary in action/index.ts"
        status: pass
    human_judgment: true
    rationale: "The real @octokit/rest PublishClient adapter glue and the live per-OS mirror are exercised only by a real default-branch push (the publish-verify CI leg); the engine and gate are unit-proven but no unit covers the adapter wiring."
  - id: D2
    description: "ci.yml per-OS publish matrix job [ubuntu-24.04-arm, windows-11-arm], fail-fast:false, needs: build (NOT test), if: !cancelled() && push, job-level permissions restating BOTH contents: write AND actions: read"
    requirement: "TRUST-02"
    verification:
      - kind: other
        ref: "rg actions:read + windows-11-arm + operation: publish in ci.yml; YAML parse (publish.needs=build, permissions={contents:write,actions:read})"
        status: pass
    human_judgment: true
    rationale: "Per-OS restore correctness and the both-scopes token grant are only provable by a real default-branch push run of the matrix (needs real Actions cache + Releases API + both runner OSes)."
  - id: D3
    description: "Live cross-OS publish/read-back round-trip: roundtrip/read-back.ts resolves <run_id> through the real Releases reader directly and asserts a same-OS HIT; ci.yml publish-verify matrix job (push-gated, needs: publish) drives it"
    requirement: "OBS-01"
    verification:
      - kind: unit
        ref: "packages/github-cache/src/backend/releases-backend.spec.ts (reader branches + window walk, 28 tests)"
        status: pass
      - kind: other
        ref: "npx nx build green (dist/roundtrip/read-back.js emitted); rg run_id/createReleasesReadBackend in ci.yml; fallow entry declared"
        status: pass
    human_judgment: true
    rationale: "The end-to-end live leg (real publisher writes a month-shard asset the real Releases reader resolves cross-context) is only green on a real default-branch push; the reader branches are unit-proven, the live round-trip is manual by design (VALIDATION.md Manual-Only)."

# Metrics
duration: 10min
completed: 2026-07-20
status: complete
---

# Phase 04 Plan 06: Make Publish Run Live Summary

**A sync-gated `publish` operation on the node24 JS action mirrors this OS leg's `nx-cache-*` entries to the current month-shard GitHub Release via the tested publishMirror engine and emits the D-17 counts, wired as a per-OS ci.yml matrix (both token scopes restated) plus a live publish/read-back round-trip that resolves a mirrored asset through the real Releases reader.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-07-20T03:54:32+02:00
- **Completed:** 2026-07-20T04:04:21+02:00
- **Tasks:** 3
- **Files modified:** 5 (1 created, 4 modified)

## Accomplishments
- Added the `publish` operation to the existing node24 action: `runPublish()` gates FIRST on `isSyncTrusted` (gated-out = exit 0), fail-closed-resolves owner/repo + token, builds a real `createPublishClient` adapter over `@octokit/rest` (getActionsCacheList + listReleaseAssets through `octokit.paginate`, get/createRelease, uploadReleaseAsset with explicit content-length), drives `publishMirror`, and emits the D-17 `core.summary` mirrored/skipped/failed table. Seed/verify branches preserved verbatim; `operation` read before the required `hash`.
- Added the per-OS `publish` matrix job to ci.yml: `[ubuntu-24.04-arm, windows-11-arm]`, `fail-fast: false`, `needs: build` (NOT test), `if: !cancelled() && push`, with a job-level `permissions:` block restating BOTH `contents: write` AND `actions: read` (Pitfall 3), invoking `operation: publish` on the JS action (not a run: step) with the token by inheritance.
- Closed the deferred-from-Phase-3 live cross-OS round-trip: a new `roundtrip/read-back.ts` bin resolves `<run_id>` through the real Releases reader DIRECTLY (`createReleasesReadBackend(createReleasesReadClient(process.env))`, not selectBackend) and asserts a same-OS HIT; a `publish-verify` matrix job (push-gated, `needs: publish`) drives it. The publish job seeds a known `nx-cache-<run_id>` entry per OS so the mirror has a deterministic producer.

## Task Commits

Each task was committed atomically:

1. **Task 1: publish operation (JS action + action.yml)** - `58b0b80` (feat), formatting corrected in `ef93f60` (style)
2. **Task 2: ci.yml per-OS publish matrix** - `1dd807e` (feat)
3. **Task 3: live cross-OS publish/read-back round-trip** - `80fb65f` (feat)

**Plan metadata:** (this commit) (docs: complete plan)

## Files Created/Modified
- `packages/github-cache/src/roundtrip/read-back.ts` (created) - Live round-trip read-back bin: resolves the mirrored asset through the real Releases reader, asserts HIT, fails loud on MISS
- `packages/github-cache/src/action/index.ts` (modified) - Added `createPublishClient` adapter + `runPublish` (sync-gate, Octokit, publishMirror, D-17 summary); `operation` read before `hash`; publish branch added to run()
- `packages/github-cache/action.yml` (modified) - `hash` now `required: false`; `operation` documents the `publish` value
- `.github/workflows/ci.yml` (modified) - `publish` per-OS matrix job (seed + publish) + `publish-verify` read-back matrix job
- `.fallowrc.jsonc` (modified) - Declared `roundtrip/read-back.ts` as a runner-invoked entry point

## Decisions Made
- **Publish as an operation on the existing action, not a run: step or a sibling action.yml.** `@actions/cache` restoreCache needs the JS-action-only `ACTIONS_RUNTIME_TOKEN`/`ACTIONS_RESULTS_URL` runtime (a run: step silently MISSes, verified Phase 2). Reusing the existing node24 action gives the proven runtime with no `../` traversal in `main`.
- **Seed inside the publish job.** This repo runs Nx on the LOCAL cache, so there is no production `nx-cache-*` Actions traffic to mirror; seeding a known `nx-cache-<run_id>` per OS gives the matrix a deterministic entry AND serves as the round-trip's producer (dogfood pattern: seed then act).
- **Read-back invokes the reader directly.** In a push (write-trusted) context `selectBackend` returns the writable Actions-cache backend, not the Releases reader, so the round-trip constructs the reader directly. The reader is native-fetch (no ACTIONS_RUNTIME_TOKEN), so it runs as a plain `node` step, unlike publish/seed.
- **`key?` filter in the adapter.** `getActionsCacheList` items type `key` as optional; the adapter drops keyless rows so the engine only sees concrete keys (the `nx-cache-` prefix filter would skip them anyway).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Prettier drift in the Task 1 publish additions**
- **Found during:** Task 3 (format:check gate check)
- **Issue:** The import wrap and the `core.summary` chain I added in `58b0b80` were not Prettier-clean, failing the `format-check` CI gate for `action/index.ts`.
- **Fix:** `npx prettier --write packages/github-cache/src/action/index.ts` (touched only my added lines; seed/verify code unchanged).
- **Files modified:** packages/github-cache/src/action/index.ts
- **Verification:** `npx prettier --check` clean on action/index.ts + read-back.ts; typecheck + build still green.
- **Committed in:** `ef93f60` (style)

---

**Total deviations:** 1 auto-fixed (1 bug/format). No scope creep.
**Impact on plan:** The format fix was necessary to keep my own code passing the CI format gate.

## Deferred Issues (out-of-scope, pre-existing)

**Pre-existing Prettier drift in prior-plan files fails `format-check` CI.** `npx nx format:check --all` is RED because 5 files committed by earlier plans (04-01/04-02/04-04) are not Prettier-clean: `sync-gate.ts`/`sync-gate.spec.ts` (04-01), `retention.ts`/`retention.spec.ts` (04-02), `publish-mirror.ts` (04-04). None were touched by 04-06; all are out of scope. Logged to `deferred-items.md`. Does NOT affect test/typecheck/build (all green). Recommend a dedicated `/gsd:fast` formatting pass (alongside the already-queued Phase 3 fallow import-cycle task).

**Pre-existing Phase 3 fallow import cycle keeps `fallow:ci` RED.** `releases-backend -> local-context -> select-backend -> releases-backend` (documented, not mine). My new `roundtrip/read-back.ts` entry is declared in `.fallowrc.jsonc`, so it adds NO new fallow finding (fallow reports exactly 1 cycle, 27 entry points).

## Issues Encountered
- A single flaky test run (212/225) in the socket-based `serve`/`server` specs; a re-run returned 225/225 and it reproduced green consistently afterward. Not caused by this plan's changes (ci.yml + an isolated new bin).

## User Setup Required
None - no external service configuration required. The live publish/round-trip runs under the runner-injected `GITHUB_TOKEN` (no PAT).

## Next Phase Readiness
- Phase 4 publish path now runs live on a default-branch push: the per-OS matrix mirrors each OS's own entries, emits the OBS-01 counts, and the publish-verify leg proves the real reader resolves a mirrored asset.
- The live cross-OS round-trip is green only on a real default-branch push (the deferred Phase-3 live leg is now wired; its first real-push run closes it).
- Deferred to `/gsd:fast`: reformat the 5 prior-plan files (format gate) and break the Phase 3 fallow import cycle (fallow gate). Phase 5 closes TRUST-08 (full server-produced-key filter) before any private-repo adopter enables the mirror.

## Self-Check: PASSED

- Created file exists: `packages/github-cache/src/roundtrip/read-back.ts` (+ dist/roundtrip/read-back.js built)
- All task commits present: `58b0b80`, `ef93f60`, `1dd807e`, `80fb65f`
- Acceptance greps confirmed: `core.summary` (D-17) in action/index.ts; `operation: publish` + `actions: read` in ci.yml
- Battery: test 225/225, typecheck green, build green, integration N/A (no target), fallow 1 pre-existing cycle only

---
*Phase: 04-publish-retention-observability*
*Completed: 2026-07-20*
