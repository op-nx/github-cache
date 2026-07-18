# Project Research Summary

**Project:** @op-nx/github-cache
**Domain:** Self-hosted Nx remote cache backed by GitHub-native primitives (Actions cache + GitHub Releases reader) - greenfield build
**Researched:** 2026-07-17
**Confidence:** HIGH

## Executive Summary

This is a greenfield build of a self-hosted Nx remote cache on GitHub-native primitives. The system speaks Nx's stable OpenAPI HTTP contract (`GET`/`PUT /v1/cache/{hash}`, bearer auth) as a loopback sidecar and picks its storage backend from runtime context - GitHub Actions cache for read-write in CI, a read-only GitHub Releases reader for cross-context/local reads. All four research dimensions converge on the load-bearing conclusion: the two-backend design is the correct fit for the two hard constraints (CI needs an authenticated keyed RW cache with native eviction; cross-context needs a keyed read path reachable off-runner - anonymous for public repos and authenticated for private via the developer's existing GitHub auth), and **no other GitHub/Git primitive beats it** - every alternative fails either the read-reachability or the keyed-lookup requirement. The FOUND-01 spike has since **LOCKED the reader as GitHub Releases** (GHCR/OCI validated but deferred to the later-milestone revisit trigger). The build is delivered as MVP vertical slices on that locked foundation.

The trust design is driven by GitHub's 2026-06-26 change that issues a **read-only cache token** to untrusted triggers running in the default-branch scope. This makes `pull_request` and `release` **safe to add to the serve write-trust gate**, because GitHub scope-isolates their writes to a non-default-branch scope that trusted `push`/`schedule` restores never read - so a fork PR cannot poison the shared cache. The load-bearing control is GitHub's server-side ref-scoping and read-only token; the in-code gate is defense-in-depth only (its env is fork-spoofable), and it is host-detected fail-closed (`github.com`/`*.ghe.com` -> ON; every GHES host -> OFF). The single sharpest design insight: the sync/publish gate is a **different trust boundary** and must stay default-branch-`{push, schedule}`-only, because publishing goes to a world-readable Release channel that erases GitHub's scope isolation. Build the write-trust gate and the sync/publish gate as **two separate predicates from the start**, and test-lock the sync gate's rejection of `pull_request`/`release`/non-default refs.

Key risks: (1) GitHub's read-only-token backstop is github.com/Data-Residency only with no documented GHES version, so adoption docs need a version floor or a "do not enable on GHES" note, and the widened trusted set fails closed on GHES; (2) three silent-failure classes (CRLF hash divergence, `@actions/cache` literal-path version hashing, cross-OS publish gap) must be built out correctly from the start - `.gitattributes eol=lf`, a single-source archive-path helper, and a per-OS publish matrix are load-bearing and comment-locked; (3) recency/LRU eviction on the Releases reader is genuinely hard on this substrate (no last-accessed signal, anonymous read-only readers, mutable manifest is security-negative) and is **OUT OF SCOPE for v0.0.1** - deferred to a later-milestone spike. Overall confidence is HIGH: every load-bearing claim is grounded in primary sources fetched in full and cross-checked.

## Key Findings

### Recommended Stack

Target the only current, supported Nx self-hosted path (the OpenAPI HTTP server on Nx 21+; the workspace shell is on Nx 23.1.0) and avoid all three deprecated generations. Use `@octokit/rest` structural error discrimination from the start for the GitHub REST I/O.

**Core technologies:**
- **Nx self-hosted OpenAPI HTTP contract (v1.0.0)** - THE interface Nx speaks; stable across Nx 21+ ("data format may change, spec should remain stable"). The `409 Conflict` on write-to-existing is load-bearing CREEP safety. PUT success is a hard `200` (Nx 21+ floor; the client matches `200` strictly). Source: https://nx.dev/docs/guides/tasks--caching/self-hosted-caching#usage-notes
- **`@actions/cache@6.2.0`** (CI RW backend) - purpose-built CI cache with a first-party keyed API, ref-scoped isolation, and built-in 7-day/10 GB LRU for free. **Pin EXACT** (not floating `^`): the library computes a cache-version hash over resolved archive path + compression; a minor bump can silently invalidate every entry. Gate upgrades behind an end-to-end save->restore verification (`npm run test:act`).
- **GitHub Release assets** (cross-context RO reader, LOCKED FOUND-01) - the only v0.0.1 primitive offering a keyed read path reachable off-runner (anonymous for public, authenticated for private). ~2 GiB/asset (coincides with the 2 GB body cap - the boundary must fail loud), 1000 assets/release (month-sharding + skip-and-warn at the cap), no last-accessed signal (the recency-eviction constraint).
- **`@octokit/rest@22`** - gives structural `error.status` (404/409/422). Use it from the start on publish AND cleanup paths; never build a `gh`-stderr-matching path. Caveat: verify large (~2 GiB) asset upload via `uploads.github.com` before relying on `repos.uploadReleaseAsset`.
- **Avoid (all deprecated prior-art traps):** Nx custom Tasks Runner API; Powerpack `@nx/s3-cache`/`@nx/gcs-cache`/`@nx/azure-cache`/`@nx/shared-fs-cache` (deprecated 2026-05-21, CVE-2025-36852/CREEP, unpatchable design flaw); `nx-remotecache-custom`/`-azure` (custom-task-runner era). Read them for storage-adapter ideas only, never for the Nx integration shape.

### Expected Features

Table stakes are the working-cache baseline; differentiators are where this build wins.

**Must have (table stakes):**
- Nx HTTP contract + correct 200/401/403/404/409 status semantics - maps to `PutResult = 'stored'|'conflict'|'forbidden'`
- Best-effort reads (fault degrades to MISS, never breaks the build) - contract-level expectation
- RW-in-CI / RO-local capability - built context-*derived* (no caller flag), named and tested
- CREEP / cache-poisoning safety - in-code gate + GitHub's server-side RO token
- Bounded retention (age-based `CACHE_MIRROR_MAX_AGE_DAYS`) - the mandatory floor
- Cross-machine/cross-OS hash parity - silent-failure-prone, load-bearing
- Copy-paste setup + minimal config surface - adoption docs

**Should have (differentiators):**
- Zero extra infrastructure (GitHub-native storage) - THE differentiator vs azure/s3/Nx Cloud
- Anonymous read-only reader (public Release assets, zero credentials to read) - uniquely fits OSS/low-churn repos
- Runtime-context backend selection (no misconfigurable mode flag) - safer than azure's `ciMode`/`localMode`
- Free + MIT - fills the hole left by deprecated `@nx/azure-cache` and archived community caches
- Safe `pull_request` + `release` RW - matches GitHub's own scoping model, host-detected fail-closed

**Defer (a later milestone / triggered):**
- Recency/LRU retention - OUT OF SCOPE for v0.0.1 (mutable manifest security-negative; `download_count` signal unverified); possible later-milestone spike
- GHCR/OCI as an additional synced store - later-milestone revisit trigger (when Docker + cosign graduate)
- Sub-sharding beyond 1000 assets/release - only when a repo exceeds it (low-churn audience won't)

**Anti-features (rejected with reasons):** local read-write mode (reopens CREEP; local stays RO by construction), hosted/managed service (defeats zero-infra value prop), a second retention knob (windows drift -> retained-unreadable or expired-uncleanable), true touch-on-read LRU (readers are anonymous+RO, cannot write back), shared-credential read+write (the CVE-2025-36852 shape).

### Architecture Approach

Ports-and-adapters around a single `CacheBackend` read port (`get(hash)`, `put(hash, body): PutResult`), a thin HTTP protocol layer, and side-effect-free pure domain modules (shard planning, cleanup planning, trust, types). The read port isolates any future storage addition to a new factory behind `selectBackend`; the protocol/auth/trust layers never move. The publish + retention/cleanup subsystem is reader-specific and behind no port (build it with the Releases reader; do not assume it is pluggable). Build the domain logic pure and inject every I/O client from day one (TDD).

**Major components to build:**
1. **Serve write gate** (`isCacheWriteTrusted`) - conservative default-deny; widen to `pull_request` + `release` in the trust-widening slice, host-detected fail-closed. Protocol/auth untouched.
2. **Sync/publish gate** (`isSyncPublishTrusted`) - default-branch `{push, schedule}` ONLY, a separate predicate. Test-lock its rejection of PR/release/non-default refs. The trusted-event allowlist has a single source of truth; the dependency-free action copy (runs pre-`npm ci`) is generated from / shares it, with a `selfcheck.cjs` parity assertion.
3. **Single-writer scheduled cleanup** - age-based cleanup under a `concurrency:` group (queue, don't cancel); the list phase aborts with zero deletions on partial pagination; per-item isolation on delete. Recency/manifest LRU is OUT of v0.0.1.
4. **Testability seams** - pure decision + injected I/O client: inject Octokit into the publish/cleanup orchestration (structural `error.status`, including the 404 bootstrap); give `selectBackend` an explicit `env` param; export `withHashLock` for concurrency specs.

### Critical Pitfalls

1. **Re-introducing CREEP by trusting the wrong trigger set** - add EXACTLY `pull_request` + `release` (non-default-branch scope). Do NOT add `pull_request_target`, `issue_comment`, or `workflow_run` (they run in the shared default-branch scope - the real CREEP vector). Comment the changelog + scope reasoning next to the list; test the exact set and that dangerous events are refused; keep both allowlist copies in sync.
2. **The publish/mirror as a cross-trust bridge** - the project-specific re-poisoning path. The serve write gate and the publish gate LOOK like one change but are two trust boundaries. Build the sync/publish gate strict (default-branch + `{push, schedule}`) as its own predicate; test that it refuses PR/release/non-default refs regardless of the serve gate's set.
3. **Assuming the RO-token backstop exists on GHES** - it ships to github.com + Data Residency only, no named GHES version. On old GHES the in-code (spoofable) gate is the ONLY control. Detect the host from `GITHUB_SERVER_URL` and fail closed on GHES; adoption docs state the dependency + a version floor (or "do not enable PR/release writes there").
4. **Recency/LRU on a no-last-access store** - Releases expose no last-accessed field (only `created_at`/`updated_at`/`download_count`); readers are anonymous+RO and cannot write back; a manifest is mutable shared retention state (security-negative). This is why recency eviction is OUT OF SCOPE for v0.0.1. Keep age-based cleanup as the mandatory floor; native Actions-cache LRU covers the CI tier. Revisit only as a later-milestone spike gated on the `download_count` signal.
5. **Cross-OS / compression silent-failure traps** - `.gitattributes eol=lf`, the archive-path helper as the sole temp-path source, and the per-OS publish matrix are load-bearing invariants to build in from the start. All three fail silently (a MISS or a wrong result, not a crash). OS-namespace the store (CORR-01) so a Linux-produced entry is never served to a Windows reader; re-verify an end-to-end restore on any temp-path/matrix change.

## Implications for Roadmap

**The canonical roadmap is `.planning/ROADMAP.md`** - a greenfield MVP / vertical-slice plan of 7 phases (Phase 0 Teardown + 6 build slices: walking skeleton -> default cache in CI -> cross-context read -> publish + retention + observability -> trust-widening + PPE gate -> distribution + docs + governance), each mapped to the locked requirement IDs. This research feeds those phases; it does not define its own phase list.

**Ordering rationale that the research supports (informational, not a competing plan):**
- **Seams / skeleton before trust semantics:** prove the Nx contract against a trivial backend and lock behavior with tests before any real backend or trust widening. The safety net exists first.
- **Default cache before cross-context read:** the CI RW backend produces the entries the reader later reads back.
- **Trust settles before docs:** the adoption docs describe the final RW/RO and `pull_request`/`release` trust model, so trust-widening lands before the docs slice.
- **Highest-uncertainty / lowest-value work is deferred:** recency/LRU and GHCR/OCI are a later milestone, off the v0.0.1 critical path.

### Research Flags

Areas likely needing deeper research during phase planning (`/gsd:plan-phase --research-phase`):
- **Trust-widening slice:** the trust model is fully resolved in this research (grounded in the 2026-06-26 changelog + the host-detected fail-closed decision); it is an implementation of a settled design, not open research. Confirm only the GHES host-detection edge (`.ghe.com` Data-Residency suffix) before relying on it.
- **Publish/retention slice:** the large-asset (~2 GiB) `uploads.github.com` upload path needs a verification step (a real large-asset upload at the boundary), not open research.

Areas with standard patterns (skip research-phase): the walking-skeleton server (Vitest + the Nx OpenAPI spec), `selectBackend`/`withHashLock` (pure/near-pure), the Octokit I/O (structural `error.status`, `@octokit/rest@22`), and the docs slice (writing, not research).

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Nx contract + GitHub limits + npm versions verified against primary docs in full 2026-07-17; primitive-selection rationale MEDIUM-HIGH but every alternative provably fails a hard requirement, and the reader is LOCKED (FOUND-01 spike). |
| Features | HIGH | Primary sources fetched in full (Nx OpenAPI spec, GitHub RO-cache changelog, Actions cache REST API, azure-cache + nx-remotecache-custom config surfaces); v0.0.1 capabilities mapped to requirement IDs. |
| Architecture | HIGH for trigger/token/permission model and testability seams; recency/LRU is deferred a later milestone | The one MEDIUM item (recency/LRU on `download_count` octet-stream semantics) is now out of v0.0.1 scope, so it is not a v0.0.1 blocker. |
| Pitfalls | HIGH | Primary sources cross-checked; the cross-OS/CRLF/compression silent-failure classes are first-party verified and comment-locked as build-in-from-the-start invariants. |

**Overall confidence:** HIGH

### Gaps to Address

- **GHES read-only-token version floor:** GitHub names no GHES version for the 2026-06-26 enforcement. Handle in the docs slice with an explicit github.com-only statement + a "do not enable PR/release writes on GHES older than <version>" note; the widened trusted set fails closed on GHES via `GITHUB_SERVER_URL` host detection.
- **Octokit large-asset (~2 GiB) upload:** `repos.uploadReleaseAsset` can be finicky with large bodies (Content-Length, Buffer/stream). Handle in the publish/retention slice by verifying a real large-asset upload at the boundary before relying on it, and ensure the boundary case fails loud.
- **`download_count` increment semantics (now a later-milestone concern):** unverified whether an `Accept: application/octet-stream` API download increments the counter. This blocks recency/LRU, which is deferred to a later milestone - not a v0.0.1 blocker. Resolve in the later-milestone recency spike before any manifest design; if it fails, recency stays limited to the Actions-cache native-LRU piggyback.
- **GHCR/OCI additional store:** logged, not evaluated for v0.0.1. Handle in the later-milestone GHCR revisit trigger (when Docker + cosign graduate).

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
*Research completed: 2026-07-17. Greenfield reframe: 2026-07-18 (rebased from a subsequent-milestone gap-closure summary onto a build-from-scratch framing on the LOCKED foundation; the phase-by-phase brownfield plan is superseded by `.planning/ROADMAP.md`; domain findings, sources, and confidence ratings unchanged; recency/LRU moved to OUT OF SCOPE / a later milestone).*
*Ready for roadmap: yes (see `.planning/ROADMAP.md`)*
