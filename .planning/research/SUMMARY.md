# Project Research Summary

**Project:** @op-nx/github-cache
**Domain:** Self-hosted Nx remote cache backed by GitHub-native primitives (Actions cache + Release-asset mirror) - brownfield, subsequent milestone
**Researched:** 2026-07-17
**Confidence:** HIGH

## Executive Summary

This is a shipped, well-architected, self-hosted Nx remote cache that speaks Nx's stable OpenAPI HTTP contract (`GET`/`PUT /v1/cache/{hash}`, bearer auth) as a loopback sidecar and picks its storage backend from runtime context - GitHub Actions cache for read-write in CI, an anonymous read-only GitHub Release-asset mirror for local dev. All four research dimensions agree on the load-bearing conclusion: the current two-backend design is the correct fit for the two hard constraints (CI needs an authenticated keyed RW cache with native eviction; local needs an anonymous keyed read path), and **no other GitHub/Git primitive beats it** - every alternative fails either the anonymous-read or the keyed-lookup requirement. This milestone is about closing the gap between "shipped and dogfooded" and "consumable and trustworthy by outside projects": test coverage, robustness (Octokit), safe `pull_request`/`release` support, optional LRU, and adoption docs. No pivot.

The recommended approach is driven by GitHub's 2026-06-26 change that issues a **read-only cache token** to untrusted triggers running in the default-branch scope. This makes `pull_request` and `release` **safe to add to the serve write-trust gate**, because GitHub scope-isolates their writes to a non-default-branch scope that trusted `push`/`schedule` restores never read - so a fork PR cannot poison the shared cache. The load-bearing control is GitHub's server-side ref-scoping and read-only token; the in-code gate is defense-in-depth only (its env is fork-spoofable). The single sharpest new-work insight: the publish-mirror gate is a **different trust boundary** and MUST stay default-branch-push-only, because mirroring publishes to a world-readable Release channel that erases GitHub's scope isolation. The roadmap must split the one `TRUSTED_EVENTS` predicate into two (cache-write, wide; mirror-publish, narrow) and test-lock the mirror gate's rejection of `pull_request`/`release`.

Key risks: (1) the biggest uncertainty is whether Release-asset `download_count` increments on octet-stream API downloads - the entire LRU requirement hinges on it, so LRU is gated behind a spike and kept as within-window cold-eviction only, never a second retention knob or a beyond-window "keep-hot" path; (2) GitHub's read-only-token backstop is github.com/Data-Residency only with no documented GHES version, so adoption docs need a version floor or a "do not enable on GHES" note; (3) three already-fixed silent-failure bugs (CRLF hash divergence, `@actions/cache` literal-path version hashing, cross-OS publish-mirror gap) are MUST-NOT-REOPEN guardrails that any CI/hashing/temp-path change must respect. Overall confidence is HIGH: every load-bearing claim is grounded in primary sources fetched in full and cross-checked against the codebase's own `ARCHITECTURE.md`/`CONCERNS.md`.

## Key Findings

### Recommended Stack

No stack change. The project already targets the only current, supported Nx self-hosted path (the OpenAPI HTTP server on Nx 21+; the project is on Nx 23.1.0) and must avoid all three deprecated generations. Runtime deps stay pinned as-is; the only recommended robustness move is migrating error-sensitive `gh` CLI paths to the already-installed Octokit for structural error discrimination.

**Core technologies:**
- **Nx self-hosted OpenAPI HTTP contract (v1.0.0)** - THE interface Nx speaks; stable across Nx 21+ ("data format may change, spec should remain stable"). The `409 Conflict` on write-to-existing is load-bearing CREEP safety - do not regress. Source: https://nx.dev/docs/guides/tasks--caching/self-hosted-caching#usage-notes
- **`@actions/cache@6.2.0`** (CI RW backend) - purpose-built CI cache with a first-party keyed API, ref-scoped isolation, and built-in 7-day/10 GB LRU for free. **Pin EXACT** (not floating `^`): the library computes a cache-version hash over resolved archive path + compression; a minor bump can silently invalidate every entry. Gate upgrades behind an end-to-end save->restore verification (`npm run test:act`).
- **GitHub Release assets** (local RO mirror) - the only primitive offering anonymous public read + keyed lookup by name. ~2 GiB/asset (matches the server's 2 GB cap), 1000 assets/release (handled by month-sharding), no last-accessed signal (the LRU constraint).
- **`@octokit/rest@22`** - already a dependency; gives structural `error.status` (404/409/422) to replace brittle `gh` stderr text-matching. Caveat: verify large (~2 GiB) asset upload via `uploads.github.com` before dropping `gh release upload`.
- **Avoid (all deprecated prior-art traps):** Nx custom Tasks Runner API; Powerpack `@nx/s3-cache`/`@nx/gcs-cache`/`@nx/azure-cache`/`@nx/shared-fs-cache` (deprecated 2026-05-21, CVE-2025-36852/CREEP, unpatchable design flaw); `nx-remotecache-custom`/`-azure` (custom-task-runner era). Read them for storage-adapter ideas only, never for the Nx integration shape.

### Expected Features

Framed for brownfield: table stakes are shipped; the milestone ship-set is the Active-requirement gap to external consumability.

**Must have (table stakes - mostly shipped):**
- Nx HTTP contract + correct 200/401/403/404/409 status semantics - shipped, matches `PutResult = 'stored'|'conflict'|'forbidden'`
- Best-effort reads (fault degrades to MISS, never breaks the build) - shipped, contract-level expectation
- RW-in-CI / RO-local capability - shipped but **derived, under-tested, under-documented** (Active work)
- CREEP / cache-poisoning safety - shipped in-code gate + GitHub's server-side RO token
- Bounded retention (age-based `CACHE_MIRROR_MAX_AGE_DAYS`) - shipped; the mandatory floor
- Cross-machine/cross-OS hash parity - shipped, silent-failure-prone, load-bearing
- Copy-paste setup + minimal config surface - Active work (adoption docs)

**Should have (differentiators):**
- Zero extra infrastructure (GitHub-native storage) - THE differentiator vs azure/s3/Nx Cloud
- Anonymous read-only local mirror (public Release assets, zero credentials to read) - uniquely fits OSS/low-churn repos
- Runtime-context backend selection (no misconfigurable mode flag) - safer than azure's `ciMode`/`localMode`
- Free + MIT - fills the hole left by deprecated `@nx/azure-cache` and archived community caches
- Safe `pull_request` + `release` RW - matches GitHub's own scoping model (Active, P1)

**Defer (v-next.x / triggered):**
- Optional LRU retention - trigger: a real consumer reports hot entries aged out (P2, gated on spike)
- Octokit structural error discrimination - trigger: a `gh` version reword breaks a consumer (P2, robustness)
- Alternative-primitive pivot - only if one clearly beats Actions cache + Releases (P3)
- Sub-sharding beyond 1000 assets/release - only when a repo exceeds it (P3; low-churn audience won't)

**Anti-features (rejected with reasons):** local read-write mode (reopens CREEP; local stays RO by construction), hosted/managed service (defeats zero-infra value prop), a second retention knob (windows drift -> retained-unreadable or expired-uncleanable), true touch-on-read LRU (readers are anonymous+RO, cannot write back), shared-credential read+write (the CVE-2025-36852 shape).

### Architecture Approach

Ports-and-adapters around a single `CacheBackend` port (`get(hash)`, `put(hash, body): PutResult`), a thin HTTP protocol layer, and side-effect-free pure domain modules (`shard`, `cleanup`, `trust`, `types`). The port isolates any future storage pivot to a new factory behind `selectBackend`; the protocol/auth/trust layers never move. New work integrates against the existing seams, not a redesign.

**Major components (and the new-work integration points):**
1. **Serve write gate** (`server.ts` -> `isCacheWriteTrusted`) - widen to include `pull_request` + `release`; GitHub scope-isolates these writes. Protocol/auth untouched.
2. **Mirror-publish gate** (`publish-mirror.ts` -> `isMirrorPublishTrusted`) - keep default-branch push/schedule ONLY. Split the single `TRUSTED_EVENTS` predicate in two; test-lock the mirror gate's rejection of PR/release. `TRUSTED_EVENTS` is duplicated in `trust.ts` and the dependency-free `start-cache-server/index.cjs` (runs pre-`npm ci`) - mirror both, add a `selfcheck.cjs` parity assertion.
3. **Single-writer daily cleanup** (`mirror-cleanup.yml`) - home for the optional LRU manifest (read-modify-write in a dedicated `cache-mirror-manifest` release; guard with `concurrency: mirror-cleanup`; exclude the manifest tag from `MIRROR_SHARD_PATTERN` or cleanup deletes its own state). Age gate stays mandatory; LRU is an additive within-window cold-eviction branch in the pure `planShardCleanup`.
4. **Testability seams** - extend the proven "extract pure decision, inject the I/O client" pattern: inject a `GhRunner` into publish-mirror's `gh` orchestration (this seam IS the Octokit migration and provides the structural 404 the manifest bootstrap needs); give `selectBackend` an explicit `env` param; export `withHashLock` for concurrency specs.

### Critical Pitfalls

1. **Re-introducing CREEP by trusting the wrong trigger set** - add EXACTLY `pull_request` + `release` (non-default-branch scope). Do NOT add `pull_request_target`, `issue_comment`, or `workflow_run` (they run in the shared default-branch scope - the real CREEP vector). Comment the changelog + scope reasoning next to the list; add a test asserting the exact set and that dangerous events are refused; mirror both `TRUSTED_EVENTS` copies.
2. **The publish-mirror as a cross-trust bridge** - the project-specific re-poisoning path. Widening the server's write gate and the mirror's publish gate LOOK like one change but are two trust boundaries. Keep `resolveTrustedRepo`/`isMirrorPublishTrusted` strict (default-branch + trusted-event) regardless of the server's set; test that the mirror preamble still refuses PR/release/non-default refs.
3. **Assuming the RO-token backstop exists on GHES** - it ships to github.com + Data Residency only, no named GHES version. On old GHES the in-code (spoofable) gate is the ONLY control. Adoption docs must state the dependency + a GHES version floor (or "do not enable PR/release writes there"); consider gating the widened set on detected enforcement.
4. **LRU manifest write races / fake LRU** - the manifest is read-modify-write mutable state; the publish pipeline is a per-OS matrix (NOT single-writer). Keep ALL manifest mutation in the ONE daily cleanup job; never let the per-OS publish legs or `serve` write it. "LRU" must use a real access signal (`download_count` deltas), not `created_at`/`updated_at` (neither tracks access). Keep age-based cleanup as the mandatory floor.
5. **MUST-NOT-REOPEN cross-OS/compression traps** - `.gitattributes eol=lf`, `cacheArchivePath()` as the sole temp-path source, and the per-OS publish-mirror matrix are load-bearing, comment-locked invariants. All three fail silently (a MISS, not a crash). Never change the temp path or reduce the matrix without re-verifying an end-to-end restore.

## Implications for Roadmap

Based on the converged research, the suggested phase structure follows the architecture's dependency-ordered build order. This is a brownfield refinement milestone: phases refine existing seams, they do not build from scratch.

### Phase 1: Testability seams + coverage (safety net first)
**Rationale:** Cheap, independent, and locks current behavior before any trust semantics change. `selectBackend`/`withHashLock` are pure/near-pure and unblock nothing else; the `gh`-runner injection seam is a prerequisite for Phases 2 and 4. Extend the existing "extract pure decision, inject I/O client" pattern - do not invent a new one.
**Delivers:** Specs for `selectBackend` (explicit env param; CI-vs-local, `GITHUB_REPOSITORY` validation, `GH_TOKEN || GITHUB_TOKEN` fallthrough, malformed-repo rejection), `withHashLock` (same-hash serializes, different hashes concurrent, map entry evicted after completion, rejected op does not wedge), the cleanup bin wrapper, and an injected `GhRunner` for publish-mirror `gh` orchestration.
**Addresses:** FEATURES "Test coverage for untested paths" (P1); the exact silent-failure surfaces from the cross-OS gap history.
**Avoids:** Pitfall 9 (assert MISS-not-wrong-result under eviction/staleness/rate-limit); folds in Pitfall 7 "did-not-reopen" checks (both OS legs run, `.gitattributes`/`cacheArchivePath` guarded).

### Phase 2: Octokit migration (structural error discrimination)
**Rationale:** Builds directly on the Phase 1 `GhRunner` seam. Removes the fragile `gh` stderr contract and provides the structural 404 that Phase 4's manifest bootstrap needs. Can run in parallel with Phase 3.
**Delivers:** Release create/list/delete-asset/delete moved to `@octokit/rest@22` `error.status` discrimination; large-asset (~2 GiB) upload path verified before dropping `gh release upload`.
**Uses:** `@octokit/rest@22` (already installed).
**Avoids:** Pitfall 8 (fault-as-absence - structural `error.status === 404` replaces stderr matching so a reworded `gh` message can't turn a real fault into a false "already exists"/404; test cleanup against a mocked partial/failed listing asserts NO deletion).

### Phase 3: `pull_request` + `release` events + first-class RW/RO mode
**Rationale:** The highest external-value item (resolves the open "why not pull_request?" question). Depends on Phase 1's trust tests and the predicate split. Correct ONLY given GitHub's 2026-06-26 change.
**Delivers:** Split `isCacheWriteTrusted` (serve, wide: + `pull_request` + `release`) from `isMirrorPublishTrusted` (publish, narrow: default-branch push/schedule only); RW/RO mode turned from derived-and-implicit into a named, documented, tested capability.
**Addresses:** FEATURES P1 "safe `pull_request` + `release` RW" and "first-class RW/RO capability."
**Avoids:** Pitfall 1 (exact trusted set, dangerous events refused, both `TRUSTED_EVENTS` copies + `selfcheck.cjs` parity) and Pitfall 2 (test-lock the mirror gate's rejection of PR/release/non-default refs).

### Phase 4: Optional LRU manifest retention (gated on a spike)
**Rationale:** Highest uncertainty - hinges on whether `download_count` increments on octet-stream API downloads. Depends on Phase 2 (structural 404 for manifest bootstrap) and a cleanup `concurrency` guard. Off the critical path for consumability.
**Delivers:** (only if the spike proves the signal) A dedicated `cache-mirror-manifest` release holding per-shard `last_active` JSON, read-modify-written by the single daily cleanup job; `planShardCleanup` extended with an optional within-window cold-eviction gate. Age gate stays mandatory and off-by-default LRU.
**Addresses:** FEATURES P2 "Optional LRU retention."
**Avoids:** Pitfall 4 (single-writer: only cleanup mutates the manifest; `concurrency: mirror-cleanup`; exclude manifest tag from `MIRROR_SHARD_PATTERN`), Pitfall 5 (within-window only - assert every retained asset resolvable by `shardTagsForWindow`; never a second env knob), Pitfall 6 (real access signal, age floor preserved, ROI validated first).

### Phase 5: Consumer adoption docs
**Rationale:** After Phase 3 settles the final trust model, so docs describe the shipped RW/RO semantics. The value prop is wasted if external projects must read source to wire it in.
**Delivers:** One `uses:` CI step + copy-paste workflow snippet (including the isolated-permissions `publish-mirror` job and scheduled cleanup); "zero credentials for local reads" headline; a single table of every `resolve*` knob + default; an explicit trust/security section (which events write, CREEP posture, **github.com-only backstop + GHES version floor**, single-tenant-ephemeral-runner warning, "one coupled `CACHE_MIRROR_MAX_AGE_DAYS`" caveat, read-only-local-by-design).
**Addresses:** FEATURES P1 "Consumer adoption docs."
**Avoids:** Pitfall 3 (GHES version floor) and the UX pitfalls (HIT/MISS signal, restart-`serve`-for-freshness, coupled-setting-across-workflows).

### Phase 6: Backend-pivot evaluation (independent spike, likely no-pivot)
**Rationale:** Off the critical path. The `CacheBackend` port makes it low-risk whenever it happens. Research default outcome: keep Actions cache + Releases.
**Delivers:** A time-boxed spike on OCI/container registry (ghcr.io) as a mirror-read alternative (content-addressable by digest, no 1000-asset cap, anonymous public pulls) vs the added OCI protocol + push auth; log the option, expect no pivot.
**Addresses:** FEATURES P3 "Alternative primitives evaluation."

### Phase Ordering Rationale
- **Seams before semantics:** Phase 1 locks current behavior with tests before Phase 3 changes trust semantics - the safety net must exist first.
- **`GhRunner` seam is the shared prerequisite:** it unblocks both the Octokit migration (Phase 2) and the manifest structural-404 bootstrap (Phase 4); do the seam once.
- **Trust model settles before docs:** Phase 5 documents what Phase 3 shipped, so the RW/RO and PR/release story is final.
- **Highest-uncertainty work is deferred and gated:** LRU (Phase 4) sits behind a spike and off the consumability critical path; the pivot spike (Phase 6) is fully independent.

### Research Flags

Phases likely needing deeper research (`/gsd:plan-phase --research-phase`) during planning:
- **Phase 4 (LRU):** REQUIRES a preliminary empirical spike - fetch asset metadata, do an octet-stream download, re-fetch, diff `download_count`. If the counter does not increment on API octet-stream reads, the whole LRU access-signal design is invalid and only the coarse "piggyback the Actions cache native LRU" fallback remains. Do not commit to the manifest design before this resolves.
- **Phase 6 (backend pivot):** a time-boxed spike by definition - OCI push-auth + protocol cost vs the marginal win.

Phases with standard patterns (skip research-phase):
- **Phase 1 (seams/coverage):** established Vitest + the codebase's own proven inject-the-client pattern.
- **Phase 2 (Octokit):** `@octokit/rest@22` already in use in `release-mirror-backend.ts`; only the large-asset-upload path needs a verification step (not research).
- **Phase 3 (PR/release + RW/RO):** the trust model is fully resolved in this research (grounded in the 2026-06-26 changelog); it is an implementation of a settled design.
- **Phase 5 (docs):** writing, not research - all inputs are in these four files.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Nx contract + GitHub limits + npm versions verified against primary docs in full 2026-07-17; keep-or-pivot rationale MEDIUM-HIGH but every alternative provably fails a hard requirement. |
| Features | HIGH | Primary sources fetched in full (Nx OpenAPI spec, GitHub RO-cache changelog, Actions cache REST API, azure-cache + nx-remotecache-custom config surfaces); Active reqs mapped 1:1. |
| Architecture | HIGH for trigger/token/permission model and testability seams; MEDIUM for LRU | LRU hinges on `download_count` octet-stream increment semantics, which GitHub does not authoritatively document. |
| Pitfalls | HIGH | Primary sources cross-checked against the repo's own `ARCHITECTURE.md`/`CONCERNS.md`; MUST-NOT-REOPEN items are first-party verified. |

**Overall confidence:** HIGH

### Gaps to Address

- **`download_count` increment semantics (biggest gap):** unverified whether an `Accept: application/octet-stream` API download (how `release-mirror-backend.ts` reads) increments the counter. Handle in Phase 4 via a dedicated empirical spike BEFORE any manifest design; if it fails, fall back to documenting the Actions-cache native-LRU piggyback and defer manifest LRU.
- **GHES read-only-token version floor:** GitHub names no GHES version for the 2026-06-26 enforcement. Handle in Phase 5 docs with an explicit github.com-only statement + a "do not enable PR/release writes on GHES older than <version>" note; optionally gate the widened trusted set on detected enforcement in Phase 3.
- **Octokit large-asset (~2 GiB) upload:** `repos.uploadReleaseAsset` can be finicky with large bodies (Content-Length, Buffer/stream). Handle in Phase 2 by verifying a real large-asset upload before dropping `gh release upload`.
- **"Keep-hot-past-window" LRU variant:** forbidden by the one-coupled-setting rule unless a re-home/promotion mechanism is added (materially larger change). Handle by shipping only within-window cold-eviction; treat keep-hot as a separate future spike.
- **OCI mirror alternative:** logged, not evaluated. Handle in the independent Phase 6 spike; expect no pivot.

## Sources

### Primary (HIGH confidence)
- https://nx.dev/docs/guides/tasks--caching/self-hosted-caching#usage-notes - CURRENT OpenAPI contract, env vars, 200/401/403/404/409 semantics, stable-spec guarantee (fetched in full)
- https://github.blog/changelog/2026-06-26-read-only-actions-cache-for-untrusted-triggers/ - RO-token model; `pull_request`/`release` keep RW via non-default-branch scope; RW trigger set; RO for untrusted+default-scope; github.com + Data Residency scope (fetched in full)
- https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching - Actions cache limits, 7-day/10 GB last-access LRU, ref/branch-scope isolation, PR merge-ref, 200 uploads/min + 1500 downloads/min (fetched in full)
- https://docs.github.com/en/rest/actions/cache - Actions cache list API returns `last_accessed_at`/`created_at`/`size_in_bytes`, default sort by last-access (the LRU enabler at publish time)
- https://docs.github.com/en/rest/releases/assets - Release asset schema: `download_count`/`created_at`/`updated_at`, NO last-accessed field (MEDIUM on the octet-stream increment)
- https://nx.dev/docs/reference/deprecated/self-hosted-cache-packages - deprecation of `@nx/*-cache`, 409 requirement, CREEP (fetched in full)
- https://21.nx.dev/docs/reference/deprecated/custom-tasks-runner - custom task runner deprecation, pre/post plugin hooks (fetched in full)
- https://21.nx.dev/docs/reference/remote-cache-plugins/azure-cache/overview - Powerpack azure-cache generation, `NX_KEY`/`localMode`/`ciMode`, comparable adapter shape (fetched in full)
- https://nx.dev/enterprise/security - "writes only from trusted CI branches"; PR artifacts isolated; CREEP framing (corroborates scope-isolation design)
- https://nx.dev/blog/cve-2025-36852-critical-cache-poisoning-vulnerability-creep - CREEP mechanism, first-to-cache-wins race, why checksums don't help
- https://github.com/NiklasPor/nx-remotecache-azure - 3rd-party custom-task-runner prior art, deprecated for Nx >= 21, CREEP-affected (fetched in full)
- registry.npmjs.org (`@actions/cache`, `@octokit/rest`) - current versions + publish dates (verified 2026-07-17)

### Secondary (MEDIUM confidence)
- https://emilyxiong.medium.com/exploring-of-nx-self-hosted-cache-5bc39bd2ed7f - ecosystem history, deprecation, CVE framing
- https://npmx.dev/package/@nx/azure-cache - deprecated 1st-party plugin (config surface covered via the 21.nx.dev overview)
- Community knowledge on `download_count` increment behavior - needs the Phase 4 spike to confirm

### Tertiary (first-party project context)
- `.planning/codebase/ARCHITECTURE.md`, `CONCERNS.md`, `TESTING.md`, `STACK.md` - existing design, resolved cross-OS/CRLF bugs, single-writer cleanup, retention coupling, `gh` sentinel debt, in-process lock assumption
- `.planning/PROJECT.md` - Active requirements, Key Decisions, Out of Scope
- Dimension files: `.planning/research/STACK.md`, `FEATURES.md`, `ARCHITECTURE.md`, `PITFALLS.md`

---
*Research completed: 2026-07-17*
*Ready for roadmap: yes*
