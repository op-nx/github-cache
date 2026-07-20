---
gsd_state_version: 1.0
milestone: v0.0.1
milestone_name: Greenfield MVP Rebuild
current_phase: 04
current_phase_name: Publish + Retention + Observability
status: verifying
stopped_at: "Completed 04-05-PLAN.md (cleanup runs: octokit pin + bin + cleanup.yml)"
last_updated: "2026-07-20T02:08:57.747Z"
last_activity: 2026-07-19
last_activity_desc: Phase 04 execution started
progress:
  total_phases: 7
  completed_phases: 5
  total_plans: 24
  completed_plans: 24
  percent: 71
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-18)

**Core value:** Correct and safe caching on GitHub infrastructure, for public and private repos, with nothing extra to host.
**Current focus:** Phase 04 — Publish + Retention + Observability

## Current Position

Phase: 04 (Publish + Retention + Observability) — EXECUTING
Plan: 6 of 6
Status: Phase complete — ready for verification
Last activity: 2026-07-19 — Phase 04 execution started

Progress: [█████████░] 89%

## Performance Metrics

**Velocity:**

- Total plans completed: 15
- Average duration: - min
- Total execution time: 0.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 0 | 5 | - | - |
| 1 | 4 | - | - |
| 02 | 6 | - | - |

**Recent Trend:**

- Last 5 plans: none yet
- Trend: -

*Updated after each plan completion*
| Phase 0 P01 | 21 | 3 tasks | 42 files |
| Phase 0 P02 | 1 | 2 tasks | 2 files |
| Phase 00 P03 | 6min | 2 tasks | 2 files |
| Phase 0 P04 | 8min | 2 tasks | 0 files |
| Phase 1 P1 | 21min | 2 tasks | 11 files |
| Phase 01 P02 | 7 | 2 tasks | 6 files |
| Phase 01 P03 | 12 | 2 tasks | 4 files |
| Phase 01 P04 | 7 | 2 tasks | 6 files |
| Phase 02 P01 | 2min | 2 tasks | 3 files |
| Phase 02 P02 | 3min | 1 tasks | 2 files |
| Phase 02 P03 | 5 | 1 tasks | 2 files |
| Phase 02 P04 | 5 | 2 tasks | 4 files |
| Phase 02 P05 | 14 | 2 tasks | 4 files |
| Phase 02 P06 | 6 | 2 tasks | 5 files |
| Phase 03 P01 | 15min | 2 tasks | 4 files |
| Phase 03 P02 | 10min | 2 tasks | 3 files |
| Phase 03 P03 | 8 | 2 tasks | 4 files |
| Phase 04 P01 | 15min | 1 tasks | 2 files |
| Phase 04 P02 | 45min | 2 tasks | 4 files |
| Phase 04 P04-03 | 5 | 3 tasks | 3 files |
| Phase 04 P04-04 | 12min | 1 tasks | 2 files |
| Phase 04 P04-05 | 7min | 3 tasks | 6 files |
| Phase 04 P04-06 | 10min | 3 tasks | 5 files |

## Accumulated Context

### Decisions

Full log in PROJECT.md Key Decisions + .planning/ARCHITECTURE-DECISION.md. Recent decisions affecting current work:

- FOUND-01: reader / cross-context store = GitHub Releases (forward merits, spike 001-005); GHCR = later-milestone revisit trigger (with PROV-01 + Docker).
- FOUND-03: distribution = npm + JS Action; Docker container form deferred to a later milestone (CI sidecar covered by the GA background-step pattern).
- Rebuild: the spike/PoC is deleted and rebuilt greenfield as MVP/vertical slices; teardown is Phase 0. Nx-native (`nx g @nx/workspace:remove`; `nx g` generators). Workspace shell kept.
- Granularity = standard (7 phases). CREEP (CVE-2025-36852) is the governing threat; control ledger C1-C18 is the security spec.
- [Phase 0]: Phase 0 teardown (00-01): removed @op-nx/github-cache PoC + siblings via nx g @nx/workspace:remove; workspace is now shell-only (@op-nx/source), graph-clean, npm ci green. D-03 cross-OS invariants (.gitattributes eol=lf, nx.json integration discriminator) preserved.
- [Phase 0]: verdaccio remains in package-lock.json as a transitive optional peer of @nx/js (workspace-core), NOT a dangling PoC ref; downstream lockfile-scoped verdaccio greps should drop that token (PoC tokens op-nx-github-cache/@octokit/@actions/cache ARE fully absent).
- [Phase 0]: Teardown (00-02): deleted mirror-cleanup.yml and reworked ci.yml to 5 jobs (format-check/build/typecheck/test/integration matrix) on Nx LOCAL cache only; workflow permissions reduced to contents:read (D-05, T-00-04).
- [Phase ?]: D-07: scoped nx format:check --all to source via .prettierignore (agent/planning docs + migration backup ignored); gate green
- [Phase ?]: D-08: root README trimmed to neutral @op-nx/source shell (no PoC refs, no dead links)
- [Phase 0]: Teardown (00-04): SC1-SC4 acceptance battery green on merged tree - graph-clean (only @op-nx/source), ci.yml cache-coupling gone, 5 targets green no-op on local cache, D-03 invariants intact. verdaccio-in-lockfile is a confirmed @nx/js transitive optional-peer non-defect; authoritative direct-ref greps return no matches.
- [Phase 1]: 01-01 scaffolded @op-nx/github-cache via nx g @nx/js:lib --bundler=tsc (NOT swc: @nx/js:swc require.resolve of @swc/cli violates D-01 zero-dep mandate); inferred build/typecheck/test targets, no project.json (D-02); lib dependencies empty (removed generator-added tslib); SRV-01 behavior deferred to Plan 01-02
- [Phase 1]: 01-02: bearer auth compares fixed 32-byte SHA-256 digests of both tokens via crypto.timingSafeEqual (no length oracle, never ===); per-process token via crypto.randomBytes (SRV-02)
- [Phase 1]: 01-02: RW/RO is the injected backend factory at server construction, never a caller-facing mode flag (D-04/TRUST-05); PutResult never-guard keeps forbidden->403 exhaustive (D-06); PUT success is hard 200
- [Phase 1]: 01-03: server hardened to the full Nx status contract (SRV-03/04/05): {hash} validated ^[a-f0-9]{1,512}$ AFTER auth, BEFORE any backend call (400, backend spy proves not-called); MAX_CACHE_BODY_BYTES=2 GiB via Content-Length precheck + streaming socket-destroy (413, never unbounded buffering)
- [Phase 1]: 01-03: best-effort read (get fault -> 404 MISS, never 5xx) vs fail-closed write (put fault -> 500, never a silent 200); a raw uncaught throw hangs the node:http socket, so put faults are caught->500 to surface an actual status
- [Phase 1]: 01-03: createReadOnlyMemoryBackend() (put -> 'forbidden' -> 403) is the D-04 seam injected at construction, never a caller flag (TRUST-05); route capture widened to [^/]* so an empty hash reaches the 400 guard; PutResult never-guard retained (D-06)
- [Phase 01]: 01-04: SC4 serve() composition root binds 127.0.0.1 (SRV-01); resolvePort falls back to OS-assigned 0 on NaN/negative/out-of-range (Pitfall 7); token env read via || so a blank value mints a fresh CSPRNG token (Pitfall 8); Windows-safe entry guard via pathToFileURL(process.argv[1]).href (Pitfall 6); index.ts finalized to re-export createCacheServer + CacheBackend port types
- [Phase 01]: 01-04: TEST-07 drift signal = sha256 of the FULL committed vendored spec (8c648a0f) vs VENDORED_SPEC_SHA256, never info.version (permanently 1.0.0, Pitfall 2); PINNED_NX_VERSION 23.1.0 (floor Nx 21+); behavioral layer asserts hard-200 (.toBe(200), never any-2xx) + 401/403/404/409 + Content-Length; the sha256 mechanism got a real RED (wrong placeholder digest) before GREEN
- [Phase 01]: 01-04: vendored nx-cache-openapi.v23.1.0.json added to .prettierignore so it stays byte-for-byte verbatim (LF-normalized under eol=lf for cross-OS hash parity; git blob + working tree both sha256 8c648a0f); Prettier reformatting it would break the pinned digest
- [Phase 02]: 02-01: pinned @actions/cache@6.2.0 (latest) + @actions/core@3.0.1 exact; human approved latest over the baked 6.1.0 default with the too-new (SUS) verdict surfaced and accepted; src/pinned-deps.spec.ts fails the build if either specifier ever widens to a range (ROBUST-03)
- [Phase 02]: 02-02: TRUST-03 write allowlist frozen at push+schedule, content-pinned by deep-equality; isWriteTrusted default-denies outside Actions / unrecognised triggers; single TRUSTED_EVENTS declaration (T-2-05); widening is Phase 5/TRUST-01.
- [Phase 02]: 02-03: withHashLock serializes same-hash ops via a module-global Map<hash,Promise> chained with .then(run,run); stores a non-rejecting tail but returns the real result so a rejection reaches its own caller without wedging; evicts on inFlight.get(hash)===tail identity check; inFlightHashCount() test-only probe; single-process ephemeral-single-tenant ceiling comment-locked (TEST-02/D-03)
- [Phase ?]: [Phase 02]: 02-05: selectBackend(env) is the single context-derived RW/RO decision point -- only param is the env bag; no options/2nd-arg/env var can request write (TRUST-05, proved structurally via selectBackend.length===0 AND behaviorally). Malformed GITHUB_REPOSITORY throws (fail-closed); unresolvable token degrades to read-only; token via GH_TOKEN||GITHUB_TOKEN.
- [Phase ?]: [Phase 02]: 02-05: serve() composes selectBackend(process.env) + one inline put-decorator carrying withHashLock and in-flight tracking (server.ts untouched); RunningServer.shutdown() is a bounded SIGTERM drain (unref'd timer) so a hung write yields to SIGKILL. serve gained NO backend-injection option; specs mock the selection module (ROBUST-04).
- [Phase 02]: 02-06: dogfood JS action (node24) runs serve() in foreground; two-job seed->verify keyed on github.run_id proves a real cross-job Actions-cache HIT (SC5). Bearer token setSecret-masked before any print; runtime creds by process inheritance only (no GITHUB_ENV); no job-level permissions block; push-trigger only. test:act self-skips off-CI - real ROBUST-03 canary is the CI job pair.
- [Phase ?]: [Phase 03]: 03-01: releaseAssetName is the single comment-locked OS+hash asset-name source (win32->windows / darwin->macos / else linux); Phase 4 publisher MUST import it (D-05/06/07, CORR-01). Namespace-imported into releases-backend so the one derivation call site is its sole reference (G3).
- [Phase ?]: [Phase 03]: 03-01: createReleasesReadBackend is read-only by construction (put declares zero params -> forbidden); degrade-to-MISS try/catch lives at the backend get, not the client, so an injected client that throws still MISSes; one-time credential-free stderr warner silent on the absent-asset path (D-02/D-11/SRV-05).
- [Phase ?]: [Phase 03]: 03-02: resolveLocalReadToken is the D-08 three-tier local read token chain (env->gh auth token->git credential fill) over one hardened spawn wrapper (shell false, bounded HELPER_TIMEOUT_MS, GIT_TERMINAL_PROMPT=0 + neutralised GIT_ASKPASS/SSH_ASKPASS); exhausted -> undefined with NO anonymous fallback (D-09). Structural stdout-only discrimination, no stderr listener (localized/credential-adjacent), error code never inspected (number vs 'ENOENT').
- [Phase ?]: [Phase 03]: 03-02: resolveRepoIdentity resolves owner/name from a shape-validated GITHUB_REPOSITORY override else git remote origin (https + scp-like ssh, .git optional); non-GitHub/unparseable -> undefined, never a guess (D-10). GITHUB_REPOSITORY_PATTERN exported from select-backend.ts (1-line diff) and reused; resolveGitHubToken body byte-identical (TEST-01 intact). FOUND-02 checkbox deferred to 03-03 end-to-end wiring.
- [Phase ?]: [Phase 03]: 03-03: createReleasesReadClient is the real default ReleaseReadClient (authenticated GitHub REST over native fetch, zero-dep): resolves token then repo BEFORE any request (D-09/D-10, zero-fetch on undefined), paginates assets (per_page=100, never inline release.assets), download drops Authorization on the 302 by spec (no redirect:manual). 404 -> silent undefined; other non-ok -> throw -> port warns+MISS (D-11). selectBackend local branch wires it and stays synchronous (async resolution deferred into fetchAsset, TRUST-05 length 0). shardTag = current-month cache-mirror-YYYYMM single-shard seam. Benign call-time-only circular import select-backend->releases-backend->local-context.
- [Phase ?]: 04-01: sync gate is a SEPARATE predicate (isSyncTrusted / SYNC_EVENTS), never reuses the write gate allowlist (D-01 / TRUST-02 / ADR C2 CREEP control)
- [Phase 04]: 04-02: retention.ts is the ONE coupled knob (resolveMaxAgeDays, default 30) + single-source cache-mirror-YYYYMM shard scheme (shardTag moved here); the Releases reader walks shardTagsForWindow newest-first, 404 advances shard, MISS only after exhausting the window (D-07/D-08). RETAIN-01 (cleanup) stays open -> 04-03. — One knob prevents read/retention drift; single-source template prevents silent cross-OS MISS; window walk survives month boundaries without FOUND-02 regression.
- [Phase 04]: 04-03: cleanupMirror is the list-abort/delete-isolate prune engine behind an injected CleanupClient -- LIST materializes every cache-mirror-* release+asset before any delete (any throw aborts with ZERO deletions, inverting the reader swallow discipline); DELETE prunes by created_at, per-item isolated, 404 benign vs non-404 real fault via statusOf duck-type, core.setFailed on aggregate; OBS-01 summary reports pruned/failed/scanned. Shared octokitFault test factory added (RETAIN-01/TEST-06).
- [Phase 04]: 04-04: publishMirror is the injected-client, Octokit-free mirror engine -- nx-cache- filter (D-16) -> same-OS restore (D-03) -> lazy get-or-create current-month shard -> first-write-wins upload; pre-upload ~2 GiB fail-loud whole-run throw (D-12), 1000-asset skip-and-warn (D-11), statusOf duck-type discrimination with per-item upload fault isolated+annotated vs whole-run throw (D-13/OBS-01); asset name via releaseAssetName only (CORR-01).
- [Phase ?]: Cleanup bin reuses GITHUB_REPOSITORY_PATTERN + resolveGitHubToken for fail-closed guards (no new code)
- [Phase ?]: @octokit/rest exact-pinned at 22.0.1 and guarded by pinned-deps.spec.ts (T-04-SC)
- [Phase ?]: [Phase 04]: 04-06: publish is an OPERATION on the existing node24 action (not a run: step) so restoreCache has the JS-action-only ACTIONS_RUNTIME_TOKEN runtime; isSyncTrusted gates FIRST (gated-out = exit 0, D-01/TRUST-02), then a real-Octokit createPublishClient adapter (getActionsCacheList + listReleaseAssets via octokit.paginate) -> publishMirror -> D-17 core.summary
- [Phase ?]: [Phase 04]: 04-06: per-OS publish matrix restates BOTH contents:write AND actions:read (job block replaces the workflow grant, Pitfall 3), needs: build NOT test; the publish job seeds nx-cache-<run_id> per OS (LOCAL Nx cache = no other traffic) doubling as the round-trip producer; publish-verify reads back through the Releases reader DIRECTLY, not selectBackend

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

### Quick Tasks Completed

| # | Description | Date | Commit | Status | Directory |
|---|-------------|------|--------|--------|-----------|
| 260719-26c | Add Fallow config + `fallow` package.json scripts/devDependency + `fallow` CI job | 2026-07-19 | 200bc34 | Verified | [260719-26c-add-fallow-config-add-fallow-package-jso](./quick/260719-26c-add-fallow-config-add-fallow-package-jso/) |
| 260719-3el | Add worktree strategy to AGENTS.md | 2026-07-19 | fb5e51a | Verified | [260719-3el-add-worktree-strategy-to-agents-md](./quick/260719-3el-add-worktree-strategy-to-agents-md/) |
| 260719-in3 | Fix cross-OS lockfile drift blocking CI npm ci + dogfood canary | 2026-07-19 | b9c513d | Verified | [260719-in3-fix-cross-os-lockfile-drift-blocking-ci-](./quick/260719-in3-fix-cross-os-lockfile-drift-blocking-ci-/) |

## Deferred Items

Items acknowledged and carried forward:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Storage | GHCR/OCI as an additional synced store (GHCR-01) | later-milestone revisit trigger (with PROV-01 + Docker) | 2026-07-18 |
| Provenance | Cosign keyless attestation (PROV-01) | a later milestone | 2026-07-18 |
| Distribution | Docker container form (FOUND-03) | a later milestone | 2026-07-18 |

## Session Continuity

Last session: 2026-07-20T02:08:05.971Z
Stopped at: Completed 04-05-PLAN.md (cleanup runs: octokit pin + bin + cleanup.yml)
Resume file: None
Next: execute 01-04-PLAN.md (conformance fixture TEST-07 + serve.ts SC4 + public surface)
