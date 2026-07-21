---
gsd_state_version: 1.0
milestone: v0.0.1
milestone_name: Greenfield MVP Rebuild
current_phase: 6
status: "Milestone v0.0.1 shipped -- PR #3"
stopped_at: Phase 6 context gathered (--analyze --auto; 1 gray area escalated + resolved)
last_updated: "2026-07-21T09:01:10.973Z"
last_activity: 2026-07-21
progress:
  total_phases: 7
  completed_phases: 7
  total_plans: 33
  completed_plans: 33
  percent: 100
current_phase_name: Distribution + Docs + Governance
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-07-18)

**Core value:** Correct and safe caching on GitHub infrastructure, for public and private repos, with nothing extra to host.
**Current focus:** Phase 6 — Distribution + Docs + Governance

## Current Position

Phase: 6
Plan: Not started
Status: Milestone v0.0.1 shipped -- PR #3 (post-review remediation quicks 260721-g1p + 260721-pej + 260721-qk1; CI green)
Last activity: 2026-07-21 - Completed quick task 260721-uao: inlined the dead run wrapper in withHashLock (ponytail-review finding); 4 of 5 candidates rejected on read; 344 tests + tsc green

Progress: [██████████] 100% of planned plans (phase 5 pending verification)

## Performance Metrics

**Velocity:**

- Total plans completed: 30
- Average duration: - min
- Total execution time: 0.0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 0 | 5 | - | - |
| 1 | 4 | - | - |
| 02 | 6 | - | - |
| 04 | 6 | - | - |
| 05 | 4 | - | - |
| 6 | 5 | - | - |

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
| Phase 05 P05-01 | 9min | 2 tasks | 7 files |
| Phase 05 P05-02 | 13min | 2 tasks | 3 files |
| Phase 05 P05-03 | 15min | 2 tasks | 7 files |
| Phase 05 P05-04 | 6min | 2 tasks | 4 files |
| Phase 06 P01 | 45min | 3 tasks | 13 files |
| Phase 06 P03 | 9 | 2 tasks | 4 files |
| Phase 06 P05 | 11min | 2 tasks | 3 files |
| Phase 06 P02 | 10min | 2 tasks tasks | 2 files files |
| Phase 06 P04 | 16 | 3 tasks | 7 files |

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
- [Phase 05]: 05-01 (TRUST-08, ships FIRST per D-09): promoted the server-produced-key namespace into ONE src/lib/cache-key.ts leaf (CACHE_KEY_PREFIX + HASH_PATTERN + cacheKeyFor + new isServerProducedKey). isServerProducedKey = prefix + HASH_PATTERN suffix (the FULL filter the Phase 4 startsWith-only subset lacked, D-08): a foreign or nx-cache-<non-hex> key is filtered BEFORE restore, closing the info-disclosure gap (T-05-08-01). HASH_PATTERN moved out of server.ts so SRV-03 + TRUST-08 share one home; cacheKeyFor output byte-identical (T-05-08-03). Strict cross-file count===1 assertion guards against a duplicate authored literal (T-05-08-02). Leaf imports nothing from siblings (github-identity.ts precedent).
- [Phase ?]: Host-gated write-trust: pull_request/release admitted only on github.com/*.ghe.com, fail-closed on GHES/malformed (TRUST-01)
- [Phase ?]: endsWith('.ghe.com') requires a real leading label; bare ghe.com / notghe.com / github.com.attacker.com denied via structural URL hostname parse
- [Phase 05]: 05-04 (TRUST-06): shipped ppe/action.yml, an ADVISORY composite action (using: composite) self-installing EXACT-pinned zizmor==1.27.0 (pipx) + actionlint 1.7.12 (official download-actionlint.bash), running both non-failing (zizmor --no-exit-codes, actionlint exit swallowed) for the named unsafe-trigger patterns. Positioned in name/description as advisory defense-in-depth, NOT the containment control (D-10/D-11/D-12; containment stays TRUST-02 sync gate + branch protection). ppe-action.spec.ts is the D-11 exact-pin analog: comment-stripped, mutation-proven config-assertion (pin change fails) since consumer-runtime installs are invisible to pinned-deps.spec.ts. Advisory `ppe` CI job dogfoods ./ppe against ppe/fixtures/unsafe-workflow.yml (kept outside .github/workflows so it never runs); the findings-produced behavior is a first-push live close (human_needed). NOTE for reviewer: download-actionlint.bash is fetched from actionlint `main` while the binary is pinned to 1.7.12.
- [Phase 05]: 05-03 (TRUST-04): trust.ts is the ONE authored allowlist; selfcheck.cjs extracts TRUSTED_EVENTS+HOST_GATED_EVENTS from trust.ts SOURCE (build-order-independent, node builtins only) and emits committed dependency-free trust.generated.cjs (require node:url only, GENERATED banner, in .prettierignore). Two-layer drift guard: CI selfcheck byte-diff exit-1-on-drift + trust.generated.spec.ts full-matrix isWriteTrusted parity (144 combos) + deep-equal arrays. Wired into ci.yml named job + selfcheck/generate:trust scripts + fallow entry/ignore (D-06/D-07).
- [Phase 06]: 06-03: SECURITY.md is advisories-first with NO contact email (GitHub private vulnerability reporting primary); root MIT LICENSE mirrors the 06-01 package LICENSE (holder Lars Gyrup Brink Nielsen). GOV-01/GOV-02, D-10/D-11.
- [Phase 06]: 06-03: governance-email.spec.ts is an allowlist-inversion guard (only the approved public gmail allowed; forbidden value never encoded; maintainer-content-scoped). Wired SECURITY.md/LICENSE/root package.json as nx test-target inputs so a scanned-file edit busts the cache and re-runs it -- closes T-06-03-02 (a stale nx cache had replayed a false pass).
- [Phase 06]: 06-05: docs/trust-and-security.md renders the settled Phase-5 CREEP model from the single sources (trust.ts/sync-gate.ts/ADR C1-C18/Phase-5 SECURITY+VERIFICATION); github.com-only with NO guessed GHES version, retention framed as storage hygiene (not poison-containment), explicit never-enable-fork-PR-tokens + no sub-floor-GHES PR/release writes (DOCS-03/D-08).
- [Phase 06]: 06-05: docs-trust.spec.ts is a single-source drift guard -- imports TRUSTED_EVENTS/HOST_GATED_EVENTS/SYNC_EVENTS and asserts each event string renders verbatim in the trust doc, so widening any allowlist trips the build until the doc is updated; imports from ./lib/... (flat-in-src convention, matching serve.ts) and resolves docs at ../../../docs via import.meta.url (ppe-action.spec.ts precedent).
- [Phase 06]: 06-05: docs/versioning.md defines the public surface as the D-04 set and "breaking" against it under the pre-1.0 (0.x) posture (breaking bumps MINOR + documented; DOCS-05 guard makes changes intentional not silent; 1.0 freezes to standard semver) (GOV-03/D-01/D-12).
- [Phase 06]: 06-02 (DOCS-05): public-surface.spec.ts is an explicit-assertion-list guard (not snapshot) enumerating the D-04 consumer contract ONLY -- value export createCacheServer + 4 type exports (CacheBackend/GetHit/GetResult/PutResult), the single 'port' action input, 7 env knobs, and MAX_CACHE_BODY_BYTES as a fixed 2 GiB const (NOT a knob). Value exports read from runtime barrel keys; type exports parsed from index.ts (type-only exports are erased at runtime). Internal helpers excluded structurally via barrel-key equality (never grepped by name). Proven real RED (bogus 'serve') -> GREEN (one-line fix).
- [Phase 06]: 06-02 (Rule 2 deviation): wired {workspaceRoot}/start-cache-server/action.yml + entry.ts into the nx test targetDefaults inputs (the 06-03 T-06-03-02 stale-cache precedent) so the DOCS-05 guard re-runs when those out-of-project files drift; two explicit files, not a start-cache-server/** glob, to avoid churning on the 2.4 MB bundle.
- [Phase ?]: [Phase 06]: 06-04 (DOCS-01): README rewritten as the 5-min default CI-RW quickstart (start-cache-server background step + mandatory cancel: teardown); GITHUB_TOKEN passed to the step so selectBackend hands back the writable backend, else every CI write silently MISSes. docs/ nav + pre-1.0 versioning note added.
- [Phase ?]: [Phase 06]: 06-04 (DOCS-01/DOCS-06): advanced.md documents opt-in Releases reader / publish-sync / cleanup by capability + trust/runtime requirements only, never presenting the internal dogfood action as the consumer surface; the & fallback is scoped to the token-based Releases reader path ONLY (CI-RW requires the JS action because a plain run:/& step lacks ACTIONS_RUNTIME_TOKEN).
- [Phase ?]: [Phase 06]: 06-04 (DOCS-02/DOCS-04): configuration.md documents all 7 consumer env knobs (matching DOCS-05 EXPECTED_ENV_KNOBS) + the 10 GB LRU and no-anonymous-default-local-read notes + MAX_CACHE_BODY_BYTES as a fixed 2 GiB limit; minimal-ci.yml distinct from the dogfood ci.yml. docs-adoption.spec.ts guard wired repo-root docs into nx.json test inputs (explicit paths); 06-05 docs-trust wiring gap logged to deferred-items.md.

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
| 260720-fal | Break releases-backend<->select-backend import cycle (github-identity leaf) + format phase-4 sources; fallow:ci + format:check green | 2026-07-20 | 77163a6 | Verified | (inline /gsd:fast --validate) |
| 260721-eac | Address A1 and A2: remove orphaned trust.generated write-trust loop (TRUST-04) + flip TRUST-07 checkbox; residual-ref scrub | 2026-07-21 | 70213b0 | Verified | [260721-eac-address-a1-and-a2-in-this-branch](./quick/260721-eac-address-a1-and-a2-in-this-branch/) |
| 260721-g1p | Address v0.0.1 PR #3 review findings (C1 Critical + all silent-failure + I5/I6 coverage + I1 integration tests + dedup/branded-Hash/trust-union/comments); 2 items deliberately not taken (would degrade shipped code) | 2026-07-21 | 6d268ac | Verified | [260721-g1p-audit-and-triage-all-findings-then-addre](./quick/260721-g1p-audit-and-triage-all-findings-then-addre/) |
| 260721-pej | Read-only backend put-less split (type-design #5), spec-compliant: read-only backends drop put, server owns the Nx-OpenAPI 403-on-PUT-to-read-only; 'forbidden' PutResult removed (supersedes g1p's declined verdict) | 2026-07-21 | ebb62fd | Verified | [260721-pej-read-only-backend-put-less-split-in-comp](./quick/260721-pej-read-only-backend-put-less-split-in-comp/) |
| 260721-qk1 | PR #3 review remediation round 3 (/code-review max, 16 findings triaged): retention sub-1-day floor (HIGH, retention-locked violation), POSIX bin shebang, nx test-input wiring + dead storybook input, 3 meta-guard strengthenings (one uncovered an unscanned-manifest path bug); full CI battery green | 2026-07-21 | dd71737 | Verified | [260721-qk1-address-triaged-code-review-findings-on-](./quick/260721-qk1-address-triaged-code-review-findings-on-/) |
| 260721-rdp | PR #3 thermos-review remediation (dual thermo-nuclear, no Critical/High): PPE advisory-install non-fatal guards + audit binary-guard (M1, real consumer-job hard-fail bug; also fixed an inline-YAML colon-space break) + env-knob test dedup (Q5) + CacheBackend comment fix (Q3) + PUT buffering ponytail note (L3); Q1/Q2/Q4/Q6/Q7/L2 deferred/rejected with reasons; full CI battery green | 2026-07-21 | 8b1e1e4e | Verified | [260721-rdp-address-triaged-thermos-review-findings-](./quick/260721-rdp-address-triaged-thermos-review-findings-/) |
| 260721-tj7 | Apply triaged /simplify cleanup findings on PR #3 (reuse/simplification/altitude): MS_PER_DAY sourced from retention leaf, releases-backend fault status via statusOf, writeCountSummary leaf for OBS-01 tables, isEntrypoint leaf for the 4 direct-invocation guards; 5 findings triaged out with reasons; full CI battery green | 2026-07-21 | ab5553d | Verified | [260721-tj7-apply-triaged-simplify-cleanup-findings-](./quick/260721-tj7-apply-triaged-simplify-cleanup-findings-/) |
| 260721-uao | Apply triaged ponytail-review over-engineering finding on PR #3: inline the dead `run` wrapper in withHashLock (`prior.then(fn, fn)`); 4 of 5 candidates rejected on read (documented deliberate decisions + one actively-wrong `.finally` suggestion that would unhandled-reject); 344 tests + tsc green | 2026-07-21 | d4ba437 | Verified | [260721-uao-inline-the-run-wrapper-in-with-hash-lock](./quick/260721-uao-inline-the-run-wrapper-in-with-hash-lock/) |

## Deferred Items

Items acknowledged and carried forward:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Storage | GHCR/OCI as an additional synced store (GHCR-01) | later-milestone revisit trigger (with PROV-01 + Docker) | 2026-07-18 |
| Provenance | Cosign keyless attestation (PROV-01) | a later milestone | 2026-07-18 |
| Distribution | Docker container form (FOUND-03) | a later milestone | 2026-07-18 |
| Packaging | Zero-dep barrel vs CLI/Action package split (PKG-SPLIT, PR #3 review code-reviewer #6) | a later milestone (needs a package restructure; peer/optional half-measure would break the published CLI-bin contract) | 2026-07-21 |

## Session Continuity

Last session: 2026-07-21
Stopped at: Findings-A cleanup complete (quick 260721-eac). A1 (removed the orphaned trust.generated write-trust loop, TRUST-04) + A2 (flipped TRUST-07 checkbox) + residual-ref scrub, all on gsd/v0.0.1-greenfield-rebuild. Gates green: nx test github-cache (330), fallow:ci (0 issues), check:action, pack:check. Verifier passed (6/6); code review clean (0 blocker/warning).
Resume file: none - the findings-A HANDOFF.json + .continue-here.md were resolved and removed.
Next: milestone-fate decision (non-blocking) - complete/archive v0.0.1 (/gsd:complete-milestone v0.0.1 + /gsd:cleanup) and land on main via a PR from this feature branch. Milestone is audit-passed; origin/main is at the pre-milestone baseline (98da97a).
