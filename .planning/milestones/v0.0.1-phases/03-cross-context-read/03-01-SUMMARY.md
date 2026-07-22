---
phase: 03-cross-context-read
plan: 01
subsystem: infra
tags: [cache, github-releases, cross-os, os-namespacing, cache-backend, tdd, vitest]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: CacheBackend port (backend/types.ts), createReadOnlyMemoryBackend read-only analog, selectBackend RW/RO-by-factory decision point
  - phase: 02-default-cache-in-ci
    provides: single-source path helper pattern (cache-archive-path.ts), actions-cache-backend fault->MISS + recorded-argument test discipline
provides:
  - releaseAssetName / cachePlatform - the single-source OS-namespaced Release asset-name helper (CORR-01, D-05/D-06/D-07)
  - ReleaseReadClient - the D-04 injected read seam (one method, fetchAsset)
  - createReleasesReadBackend - read-only Releases CacheBackend that degrades every fault to MISS and forbids every write
  - TEST-05 cross-OS regression guards G1-G4 (all non-vacuous)
affects: [04-write-and-sync, cross-context-read, phase-4-publisher, releases-publisher]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "OS-namespaced asset name folded into a single comment-locked helper both the reader and the Phase 4 publisher import (drift = silent cross-OS MISS)"
    - "Degrade-to-MISS try/catch at the CacheBackend port boundary (not inside the client) so an injected client that throws still yields MISS"
    - "Module-level once-per-process stderr warner; fresh-module dynamic import in specs to keep the once-per-process assertion order-independent"
    - "Non-vacuous negative assertion (never-wrong-OS) as the load-bearing CORR-01 proof"

key-files:
  created:
    - packages/github-cache/src/lib/release-asset-name.ts
    - packages/github-cache/src/lib/release-asset-name.spec.ts
    - packages/github-cache/src/backend/releases-backend.ts
    - packages/github-cache/src/backend/releases-backend.spec.ts
  modified: []

key-decisions:
  - "releaseAssetName is `${hash}-${cachePlatform(platform)}`; cachePlatform maps win32->windows, darwin->macos, else linux (D-05/D-06)"
  - "Namespace-import the helper into releases-backend.ts (import * as assetNaming) so the single derivation call site is the file's sole releaseAssetName reference (satisfies the G3 exactly-one-non-comment-line acceptance check; a named import would count import+call=2)"
  - "put declares zero parameters and returns 'forbidden' by construction; the degrade-to-MISS try/catch lives at the backend get, not the client (D-02, D-11)"
  - "One-time stderr warner takes no argument and writes a fixed ASCII sentence -- the caught error is never interpolated, so no credential-adjacent material can leak (D-11, T-03-03)"

patterns-established:
  - "Single-source OS+hash asset-name helper with the 7-slot cache-archive-path comment-lock idiom plus a TRUST-05 injectable-platform paragraph"
  - "OS-agnostic cross-OS spec: seed under a computed foreign platform (OTHER_PLATFORM) so one spec proves never-wrong-OS on every CI matrix leg"

requirements-completed: [CORR-01, TEST-05]

coverage:
  - id: D1
    description: "OS-namespaced Release asset name is derived through one comment-locked helper (releaseAssetName/cachePlatform); exact name pinned as a string literal (G2), all platform maps + default asserted (G4)"
    requirement: "CORR-01"
    verification:
      - kind: unit
        ref: "packages/github-cache/src/lib/release-asset-name.spec.ts#releaseAssetName (CORR-01)"
        status: pass
      - kind: unit
        ref: "packages/github-cache/src/lib/release-asset-name.spec.ts#cachePlatform (CORR-01)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Read-only Releases backend returns THIS platform's bytes and MISSES a hash present only under another platform -- never a wrong-OS artifact (load-bearing negative, Non-vacuous)"
    requirement: "CORR-01"
    verification:
      - kind: unit
        ref: "packages/github-cache/src/backend/releases-backend.spec.ts#get cross-OS round-trip (CORR-01, TEST-05)"
        status: pass
    human_judgment: false
  - id: D3
    description: "TEST-05 regression guards: G1 (.gitattributes eol=lf), G2 (literal name), G3 (backend derives names only via the helper), G4 (platform map)"
    requirement: "TEST-05"
    verification:
      - kind: unit
        ref: "packages/github-cache/src/lib/release-asset-name.spec.ts#.gitattributes LF normalisation guard (TEST-05)"
        status: pass
      - kind: unit
        ref: "packages/github-cache/src/backend/releases-backend.spec.ts#name derivation (TEST-05)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Read-only by construction (put forbidden for every input) and degrade-to-MISS for every fault, with one credential-free stderr warning per process, silent on the ordinary absent-asset path"
    requirement: "CORR-01"
    verification:
      - kind: unit
        ref: "packages/github-cache/src/backend/releases-backend.spec.ts#put (D-02, TRUST-05)"
        status: pass
      - kind: unit
        ref: "packages/github-cache/src/backend/releases-backend.spec.ts#fault degradation (D-11, SRV-05)"
        status: pass
      - kind: unit
        ref: "packages/github-cache/src/backend/releases-backend.spec.ts#one-time warning (D-11, T-03-03, T-03-06)"
        status: pass
    human_judgment: false

# Metrics
duration: 15min
completed: 2026-07-19
status: complete
---

# Phase 3 Plan 01: Cross-Context Read (OS-correct read core) Summary

**OS-namespaced Release asset-name helper plus a read-only `CacheBackend` that returns this platform's bytes, MISSES any wrong-OS artifact, forbids every write, and degrades every fault to a MISS with one credential-free stderr warning.**

## Performance

- **Duration:** 15 min
- **Started:** 2026-07-19T17:26:25Z
- **Completed:** 2026-07-19T17:41:39Z
- **Tasks:** 2 (both TDD)
- **Files modified:** 4 created

## Accomplishments
- `releaseAssetName(hash, platform?)` / `cachePlatform(platform?)` - the single comment-locked source of every OS-namespaced Release asset name (CORR-01, D-05/D-06/D-07). Phase 4's publisher imports this exact helper; a drift is a silent cross-OS MISS.
- `createReleasesReadBackend(client)` - a read-only `CacheBackend` over the injected `ReleaseReadClient` seam: `get` resolves this platform's asset through the helper and returns its bytes or a MISS; `put` is `'forbidden'` by construction (D-02, TRUST-05).
- Never-wrong-OS proven by the load-bearing NEGATIVE assertion (a hash seeded only under a foreign platform returns MISS), carrying the repo's `// Non-vacuous:` guard so the tautological-test failure mode cannot recur.
- Every fault (including an injected client that throws) degrades to MISS at the port boundary (D-11, SRV-05); one-time, credential-free stderr warning, silent on the ordinary absent-asset path.
- TEST-05 guards G1-G4 all present and non-vacuous; verified by temporarily removing OS-namespacing and confirming the negative + G2 tests go RED, then reverting.

## Task Commits

Each task was committed atomically (TDD: RED test -> GREEN impl):

1. **Task 1: Single-source OS-namespaced asset-name helper**
   - `c6148f1` (test - RED: failing spec, G1/G2/G4)
   - `ad39325` (feat - GREEN: cachePlatform + releaseAssetName, 10 specs green)
2. **Task 2: Read-only Releases backend over the injected client seam**
   - `2ba70ef` (test - RED: failing spec, cross-OS/fault/warning)
   - `2b69b9f` (feat - GREEN: createReleasesReadBackend + ReleaseReadClient, 10 specs green)

**Plan metadata:** committed separately (docs: complete plan).

_No REFACTOR commits: both implementations were minimal (2 pure functions; one factory) and needed no cleanup._

## Files Created/Modified
- `packages/github-cache/src/lib/release-asset-name.ts` - `cachePlatform` (D-06 platform map) and `releaseAssetName` (7-slot comment-locked single source, TRUST-05 injectable-platform paragraph).
- `packages/github-cache/src/lib/release-asset-name.spec.ts` - G2 literal pin, G4 platform map (it.each), running-platform default, and the folded-in G1 `.gitattributes` eol=lf guard (no fourth spec file).
- `packages/github-cache/src/backend/releases-backend.ts` - `ReleaseReadClient` seam + `createReleasesReadBackend`; degrade-to-MISS try/catch at the port boundary; module-level once-per-process warner.
- `packages/github-cache/src/backend/releases-backend.spec.ts` - OS-agnostic cross-OS round-trip (correct-hit + Non-vacuous never-wrong-OS negative), G3 recorded-argument assertion, put-forbidden matrix, fault->MISS matrix, once-per-process + no-credential-leak warning tests.

## Decisions Made
- **Namespace import for the helper in `releases-backend.ts`** (`import * as assetNaming`). The G3 acceptance check requires `releaseAssetName` on exactly one non-comment line; a named import would place the token on both the import and the call line (count 2). The namespace-import idiom already exists in the repo (`import * as cache from '@actions/cache'`), keeps the single derivation call site as the sole visible reference, and satisfies the check. The true G3 guard is the spec's recorded-argument assertion; the rg count is a secondary structural guard.
- **OS-agnostic cross-OS spec.** Instead of hardcoding "a linux reader", the spec computes `OTHER_PLATFORM` (the discriminator the process is NOT running under) and seeds the foreign entry through `releaseAssetName(hash, OTHER_PLATFORM)`. One spec therefore proves never-wrong-OS on every CI matrix leg (Windows, Linux, macOS).
- **Optional catch binding** (`catch {`) in `get` so the caught error is structurally unreachable inside the warner - it cannot be interpolated or leaked (D-11, T-03-03).
- **`put()` declares zero parameters** (not named-and-ignored), mirroring `createReadOnlyMemoryBackend`, so read-only is the absence of a write path (D-02, TRUST-05).

## Deviations from Plan

None - no Rule 1-4 auto-fixes were required. The plan executed as written. See Issues Encountered for two non-code observations (missing `lint` target; Prettier formatting) handled as routine hygiene.

## Issues Encountered
- **No `lint` target exists for `@op-nx/github-cache`** (targets: typecheck, build, build-deps, watch-deps, test). The plan's acceptance criteria reference `npx nx run-many -t typecheck lint --projects=github-cache`; that command exits 0 because nx no-ops the absent `lint` target and runs `typecheck` (green). The repo's static-style gates are Prettier `format:check` and Fallow (CI-gated), not a per-project ESLint target. `typecheck` + `test` are the authoritative green signals and both pass.
- **Prettier reflow.** `release-asset-name.ts` (signature wrap) and both backend files needed Prettier formatting (`format:check` is a CI gate); applied `prettier --write` and reconfirmed clean. The Task 2 RED spec was reflowed after its RED commit, so the formatting delta rode along in the GREEN commit (formatting-only, tests unchanged).

## Verification
- `npx nx test github-cache` - 121 passing (12 files), including the 20 new specs; no existing spec regressed.
- `npx nx typecheck github-cache` - green.
- `npx nx run-many -t typecheck lint --projects=github-cache` - exits 0.
- `prettier --check` on all 4 new files - clean.
- Single-source: `${hash}-${cachePlatform(platform)}` appears only in `release-asset-name.ts:43` across the package src.
- Zero dependency change: `package.json` / `package-lock.json` untouched across all four commits.
- Non-vacuous proof: temporarily neutering OS-namespacing turned the never-wrong-OS negative and G2 literal tests RED, then reverted.

## User Setup Required
None - no external service configuration required. This is a read-only, dependency-free, unit-tested slice with an injected client; the real GitHub client + `selectBackend` wiring is Plan 03-03.

## Self-Check: PASSED
- Files: all 4 created files FOUND on disk.
- Commits: c6148f1, ad39325, 2ba70ef, 2b69b9f all FOUND in git history.

## Next Phase Readiness
- The reader is complete and provably never serves a wrong-OS artifact against an injected client. `releaseAssetName` is the settled key scheme Phase 4's publisher must import (do not re-derive).
- Remaining phase work: Plan 03-02 (local auth chain `resolveLocalReadToken` + `git remote origin` repo identity), Plan 03-03 (real `fetch`-based `ReleaseReadClient` + wire into `selectBackend`'s local branch, replacing the `createReadOnlyMemoryBackend` placeholder at `select-backend.ts:40-42`).
- Watch-out for 03-03: `selectBackend` is synchronous (`length === 0`, `serve.ts:82`), but the auth/repo-identity resolvers are async - defer resolution into the client's `fetchAsset`, do not await at construction.

---
*Phase: 03-cross-context-read*
*Completed: 2026-07-19*
