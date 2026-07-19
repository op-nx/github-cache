---
phase: 03-cross-context-read
plan: 03
subsystem: backend
tags: [cache, github-releases, fetch, rest, pagination, cross-context-read, integration, tdd, vitest]

# Dependency graph
requires:
  - phase: 03-cross-context-read
    provides: "03-01 releaseAssetName + createReleasesReadBackend + ReleaseReadClient seam (read core); 03-02 resolveLocalReadToken + resolveRepoIdentity (local auth + repo identity) + exported GITHUB_REPOSITORY_PATTERN"
  - phase: 01-foundation
    provides: "selectBackend RW/RO-by-factory decision point (synchronous, Function.length 0, TRUST-05); CacheBackend port"
provides:
  - "createReleasesReadClient(env?) - the real default ReleaseReadClient: authenticated GitHub REST read over native fetch (release-by-tag -> paginated assets -> asset download), no new dependency; the ONLY production client"
  - "shardTag(date?) - current-month cache-mirror-YYYYMM single-shard seam (comment-locked as the Phase 4 read-window-walk upgrade path)"
  - "selectBackend local branch now returns the real GitHub Releases reader (D-01) - the phase goal is reachable end to end; selectBackend stays synchronous and zero-arity"
affects: [04-write-and-sync, phase-4-publisher, releases-publisher]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Async credential/repo resolution deferred into the client's fetchAsset (get-time), never at selectBackend construction, so a synchronous zero-arity factory can front a fully async read path (TRUST-05 sync/async integration)"
    - "Structural fault split at the HTTP client: 404 -> silent undefined (cold-cache MISS); any other non-ok status throws so the port boundary degrades it to a warned MISS (warn-on-fault, silent-on-absent)"
    - "Native global fetch follows the asset 302 to signed storage and drops Authorization cross-origin by spec (whatwg/fetch#1544); redirect handling is deliberately left untouched (no redirect:manual, no header re-attach)"
    - "No-anonymous-request guarantee proven by a zero-fetch-calls assertion, not merely an undefined return (D-09/D-10)"

key-files:
  created: []
  modified:
    - packages/github-cache/src/backend/releases-backend.ts
    - packages/github-cache/src/backend/releases-backend.spec.ts
    - packages/github-cache/src/lib/select-backend.ts
    - packages/github-cache/src/lib/select-backend.spec.ts

key-decisions:
  - "createReleasesReadClient resolves token BEFORE repo identity BEFORE any fetch; either undefined -> return undefined with ZERO fetches (D-09 no-anon, D-10 never-guess). Both async resolvers run inside fetchAsset at get-time so selectBackend stays synchronous (TRUST-05)."
  - "Fault handling is structural on res.status only: a 404 (shard or asset absent) returns undefined silently; any other non-ok (401/403/429/5xx) THROWS so the Plan-01 port catch degrades it to a warned MISS. No fault taxonomy, no retry/backoff (D-11, SRV-05)."
  - "shardTag stubs the current UTC month (cache-mirror-YYYYMM) in one comment-locked helper marked with a ponytail note naming the single-shard ceiling and the Phase 4 read-window-walk upgrade path (RESEARCH Open Question 1; CONTEXT deferred ideas sanction the single-location stub)."
  - "per_page=100 written as a literal (not a named constant) in the assets URL so the pagination is grep-verifiable; the reader paginates the assets endpoint and never reads the inline release.assets first-page snapshot (Pitfall 4)."
  - "select-backend.ts local branch wires createReleasesReadBackend(createReleasesReadClient(env)); createReadOnlyMemoryBackend and its import are kept for the trusted-but-no-token degrade at the old line 58. The wiring introduces a benign call-time-only circular import (select-backend -> releases-backend -> local-context -> select-backend) that compiles, builds, and runs cleanly."

patterns-established:
  - "Mocked global fetch in specs (vi.spyOn(globalThis, 'fetch') returning crafted Response objects) - the repo's first fetch-mocking spec; module-mock ../lib/local-context.js so the unit layer never spawns gh/git or reaches the network (green on a runner with no gh)"
  - "Deferring async work into a lazily-called method so a synchronous zero-arity composition-root factory keeps its structural TRUST-05 pin while fronting an async I/O path"

requirements-completed: [FOUND-02, CORR-01]

coverage:
  - id: D1
    description: "The real default client performs the D-03 REST sequence over native fetch: release-by-shardTag -> paginated assets (page 2 on a full page of 100, never inline release.assets) -> asset download with Accept octet-stream + bearer, no redirect:manual"
    requirement: "FOUND-02"
    verification:
      - kind: unit
        ref: "packages/github-cache/src/backend/releases-backend.spec.ts#createReleasesReadClient REST sequence (FOUND-02, D-03) [happy path, pagination page=1->page=2, download headers + redirect-absent, shard 404 -> undefined, asset absent -> undefined]"
        status: pass
    human_judgment: false
  - id: D2
    description: "No-anonymous-request and no-guessed-repo: with no token OR no repo identity, fetchAsset returns undefined and issues ZERO fetch calls (asserted on the fetch spy, non-vacuous)"
    requirement: "FOUND-02"
    verification:
      - kind: unit
        ref: "packages/github-cache/src/backend/releases-backend.spec.ts#createReleasesReadClient no-anonymous-request guarantee (FOUND-02, D-09/D-10)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every non-404 fault (401/403/429/500 and a rejected fetch) degrades to a MISS through the backend port with exactly one stderr warning; a 404 is a silent MISS with no warning (D-11, SRV-05)"
    requirement: "FOUND-02"
    verification:
      - kind: unit
        ref: "packages/github-cache/src/backend/releases-backend.spec.ts#createReleasesReadClient fault matrix through the backend (SRV-05, D-11)"
        status: pass
    human_judgment: false
  - id: D4
    description: "selectBackend's local branch returns the real Releases reader so a hit flows through end to end (mocked resolvers + mocked fetch), while selectBackend stays synchronous with Function.length 0 and the serve.ts call site unchanged (D-01, TRUST-05)"
    requirement: "FOUND-02"
    verification:
      - kind: unit
        ref: "packages/github-cache/src/lib/select-backend.spec.ts#wires the REAL Releases reader into the local branch: a hit flows through (D-01, FOUND-02)"
        status: pass
      - kind: unit
        ref: "packages/github-cache/src/lib/select-backend.spec.ts#structural: selectBackend.length is 0 (TRUST-05)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Cross-OS correctness holds end to end through the wired reader: the local-machine read is OS-namespaced via releaseAssetName, and a hit returns THIS platform's bytes (CORR-01, carried from Plan 01's never-wrong-OS guards)"
    requirement: "CORR-01"
    verification:
      - kind: unit
        ref: "packages/github-cache/src/backend/releases-backend.spec.ts#createReleasesReadBackend get cross-OS round-trip (CORR-01, TEST-05)"
        status: pass
    human_judgment: false

# Metrics
duration: 8min
completed: 2026-07-19
status: complete
---

# Phase 3 Plan 03: Cross-Context Read (real fetch client + selectBackend wiring) Summary

**The real authenticated GitHub Releases read client (native fetch, zero new dependency) plus the three-line selectBackend wiring that makes a developer on any OS actually read this repo's CI-produced cache back locally -- resolving token then repo before any request, degrading every fault to a MISS, and never leaking the token across the asset redirect.**

## Performance

- **Duration:** ~8 min
- **Tasks:** 2 (both TDD: RED failing test -> GREEN implementation)
- **Files modified:** 4 (all pre-existing from Plans 01/02)

## Accomplishments
- `createReleasesReadClient(env?)` - the D-03 real default `ReleaseReadClient`: the authenticated GitHub REST read sequence over the native global `fetch` with no new dependency. It resolves the token via `resolveLocalReadToken(env)` first, then the repo via `resolveRepoIdentity(env)`, and issues NO request when either is undefined (D-09 no-anonymous, D-10 never-guess). The async resolution runs inside `fetchAsset` at get-time, so `selectBackend` stays synchronous.
- The REST sequence: GET release by `shardTag()`, paginate `GET /releases/{id}/assets?per_page=100&page=N` (incrementing `page`, stopping at a short page, never reading the inline `release.assets` first-page snapshot), then GET the asset by id with `Accept: application/octet-stream` + bearer. Native fetch follows the 302 to signed storage and drops `Authorization` cross-origin by spec; the download sets no `redirect` option and re-attaches no header.
- Structural fault handling: a 404 (shard or asset genuinely absent) returns undefined silently; any other non-ok status (401/403/429/5xx) throws so Plan 01's port `try/catch` degrades it to a warned MISS. A rejected fetch (network throw) is a MISS too. No fault taxonomy, no retry/backoff (D-11, SRV-05).
- `shardTag(date?)` - the current-month `cache-mirror-YYYYMM` single-shard seam, comment-locked with a `ponytail:` note naming the single-shard ceiling and the Phase 4 read-window-walk upgrade path.
- `selectBackend`'s local/untrusted branch now returns `createReleasesReadBackend(createReleasesReadClient(env))` (D-01), replacing the empty-memory placeholder. The phase goal is now reachable end to end. `selectBackend` stays synchronous and zero-arity (TRUST-05); the trusted-but-no-token `createReadOnlyMemoryBackend()` degrade at the old line 58 is untouched.

## Task Commits

Each task was committed atomically (TDD: RED failing test -> GREEN implementation):

1. **Task 1: Real default fetch client -- REST sequence, pagination, redirect, fault matrix**
   - `19c11e4` (test - RED: failing spec for createReleasesReadClient + shardTag)
   - `3047c27` (feat - GREEN: createReleasesReadClient + shardTag, 26 specs green)
2. **Task 2: Wire the reader into selectBackend, keeping it synchronous**
   - `42c8fe2` (test - RED: failing "hit flows through" spec + hermetic local-machine test)
   - `41d0445` (feat - GREEN: wire createReleasesReadBackend(createReleasesReadClient(env)))

**Plan metadata:** committed separately (docs: complete plan).

_No REFACTOR commits: both implementations were minimal (one factory + one helper; a three-line branch edit) and needed no cleanup._

## Files Created/Modified
- `packages/github-cache/src/backend/releases-backend.ts` (modified) - added `createReleasesReadClient` (the real REST client), `shardTag` (current-month seam), `githubJsonHeaders`, and `GITHUB_API`; imports `resolveLocalReadToken`/`resolveRepoIdentity` from `../lib/local-context.js`. Plan 01's interface and port were left intact.
- `packages/github-cache/src/backend/releases-backend.spec.ts` (modified) - mocked `../lib/local-context.js`; added the shardTag pin, the no-anon/no-repo zero-fetch-calls tests, the REST-sequence tests (happy/pagination/redirect-headers/shard-404/asset-absent), and the fault matrix (401/403/429/500 + network throw -> MISS; 404 silent; non-404 warns once). 26 tests total.
- `packages/github-cache/src/lib/select-backend.ts` (modified) - three-line placeholder replaced with the real reader construction; new import; WHY comment rewritten to state the sync/async deferral and TRUST-05 rationale.
- `packages/github-cache/src/lib/select-backend.spec.ts` (modified) - mocked `./local-context.js`; made the local-machine test hermetic; added the "hit flows through the wired reader" test. 23 tests total.

## Decisions Made
- **Resolve-then-guard-then-fetch, all inside `fetchAsset`.** The token and repo resolution are both async and both run at get-time, not at `selectBackend` construction -- the single highest-risk integration detail. This keeps `selectBackend` synchronous with `Function.length === 0` (the TRUST-05 structural pin) and the `serve.ts:82` call site unchanged, while still fronting a fully async I/O path. Verified: the TRUST-05 length assertion and the no-mutation test both still pass, and a hit flows through end to end.
- **Structural fault split (undefined-vs-throw) is the mechanism behind "warn on fault, silent on absent".** A 404 returns undefined (the client's normal cold-cache answer, no warning); any other non-ok status throws, and Plan 01's port boundary owns the never-throw guarantee and the one-time warning. The client may throw freely because the port catches everything (RESEARCH Pattern 3). No fault taxonomy is built -- every fault is just a MISS (D-11).
- **`per_page=100` as a literal, not a constant.** The assets URL uses the literal so the pagination is grep-verifiable and matches the spike-001 reference; the short-page detection compares `batch.length < 100`. The reader never reads the inline `release.assets` array (Pitfall 4).
- **Mock `local-context` (not `releases-backend`) in `select-backend.spec.ts`.** Mocking the resolvers keeps the REAL `createReleasesReadBackend` + `createReleasesReadClient` in the wiring test, which is what proves the reader is genuinely wired; mocking the backend would mock away the very thing under test. The unit layer therefore never spawns `gh`/`git` or reaches `api.github.com`, staying green on a runner with no `gh`.

## Deviations from Plan

None - plan executed exactly as written. No Rule 1-4 auto-fixes were required. (The call-time-only circular import introduced by the wiring is inherent to the plan's prescribed `select-backend -> releases-backend` import and the Plan 02 `local-context -> select-backend` reuse; it is benign and covered under Issues Encountered.)

## Issues Encountered
- **Benign circular import.** Wiring `select-backend.ts -> releases-backend.ts -> local-context.ts -> select-backend.ts` forms a cycle. It is safe because every cross-module reference (`createReleasesReadBackend`/`createReleasesReadClient`, `resolveLocalReadToken`/`resolveRepoIdentity`, `GITHUB_REPOSITORY_PATTERN`/`resolveGitHubToken`) is used only at call-time, never at module-evaluation time -- no TDZ. Confirmed clean by `typecheck`, `build`, and the full test suite. Not refactored: the plan explicitly prescribes this import, and breaking the cycle would mean relocating Plan 02's shared exports (out of scope, TEST-01 risk).
- **No `lint` target** for `@op-nx/github-cache` (targets: typecheck, build, build-deps, watch-deps, test), as Plans 01/02 recorded. `typecheck` + `test` + `build` are the authoritative green signals and all pass; static style is Prettier `format:check` (verified with `prettier --check`).
- **Prettier reflow** on `select-backend.spec.ts` (an import that fit on one line was collapsed). Applied `prettier --write`; the formatting-only delta rode along in the Task 2 GREEN commit, as Plan 01 did for its RED-spec reflow.

## Verification
- `npx nx run-many -t test typecheck build --projects=github-cache` - all green.
- `npx nx test github-cache` - **159 passing (13 files)**, +17 over Plan 02's 142; no existing spec regressed (the 142 prior tests all still pass).
- `selectBackend.length === 0` asserted and passing; `selectBackend(...)` returns a non-Promise `CacheBackend` (the sync return is exercised by every passing test that calls `.get`/`.put` without awaiting the factory).
- Source gates (non-comment lines of `releases-backend.ts`): `redirect: 'manual'` count 0; `per_page=100` count 1; `page=${page}` present; `release.assets` count 0; `application/octet-stream` present. `cache-mirror-202607` pinned in the spec (count 2).
- `git diff --name-only d5f3dee..HEAD` - exactly the 4 planned files; `package.json`, `package-lock.json`, and `serve.ts` untouched across the whole plan (zero-dependency-change, TRUST-05 call site preserved).
- Machine-independent: specs mock `local-context` and `fetch`, so no real `gh`/`git`/keychain/network is touched (green on a runner with no `gh`).

## Known Stubs
- **`shardTag` single-shard (current month only)** - `packages/github-cache/src/backend/releases-backend.ts`. INTENTIONAL and explicitly sanctioned: CONTEXT deferred-ideas permit stubbing the shard walk "to a single known location", and RESEARCH Open Question 1 resolves to the current-month computed tag. It does NOT block the phase goal (a developer reads the current-month cache back correctly). The retention read-window walk (`shardTagsForWindow`, coupled to `CACHE_MIRROR_MAX_AGE_DAYS`) is deferred to **Phase 4**, which owns the publisher that writes the shards. The helper is comment-locked with a `ponytail:` note naming the upgrade path.

## User Setup Required
None. This slice is dependency-free and unit-tested with mocked resolvers + mocked fetch. On a real machine the reader now uses the developer's existing GitHub auth (`GH_TOKEN`/`GITHUB_TOKEN`, then `gh auth token`, then `git credential fill`) and the origin remote's repo identity automatically; a private-repo read works once Phase 4's publisher has written the current-month shard.

## Self-Check: PASSED
- Files: all 4 modified files FOUND on disk.
- Commits: 19c11e4, 3047c27, 42c8fe2, 41d0445 all FOUND in git history.

## Next Phase Readiness
- **The phase goal is reachable end to end:** `selectBackend`'s local branch returns the real Releases reader, wired to the real default client, and a private-repo read works with the developer's existing GitHub auth (FOUND-02) while never serving a wrong-OS artifact (CORR-01).
- **Phase 4 (write-and-sync) hand-off:** the publisher MUST derive asset names through the same `releaseAssetName` helper (drift = silent cross-OS MISS) and MUST write shard releases tagged `cache-mirror-YYYYMM`; the reader's `shardTag` currently reads only the current month, so Phase 4 owns the retention read-window walk that generalizes it.
- No blockers. `/gsd:secure-phase` and `/gsd:validate-phase` are the remaining phase-completion audits (both threat mitigations and Nyquist coverage are already covered by the tests above).

---
*Phase: 03-cross-context-read*
*Completed: 2026-07-19*
