# @op-nx/github-cache - GitHub-backed Nx Remote Cache

## What This Is

An open-source, self-hosted Nx remote cache that stores task artifacts on GitHub-native
primitives instead of a dedicated cache service. It speaks Nx's self-hosted-cache HTTP
contract (`GET`/`PUT /v1/cache/{hash}`) as a loopback-only sidecar and picks its storage
backend from runtime context, so there is no mode flag a caller can get wrong. Today it uses
the **GitHub Actions cache** (read-write, in CI) and a **read-only GitHub Release-asset
mirror** (for local reads). It is meant for **other projects to adopt** - across **both
public and private** GitHub repositories - not only for dogfooding in this repo.

**Under active verification (gates the roadmap):** which GitHub / Git primitive(s) are the
best storage/distribution backends is being re-opened via `/gsd:explore` + `/gsd:spike`
before any roadmap is formed (see Key Decisions). The current Actions-cache + Releases pair
is the incumbent, not a locked choice.

## Core Value

**Correct and safe caching on GitHub infrastructure, for public and private repos, with
nothing extra to host.** A remote cache must never serve a wrong or poisoned artifact and must
never let an untrusted trigger write - correctness and CREEP-safety come before every other
feature. If everything else fails, reads must stay best-effort (a fault degrades to a MISS,
never a broken build) and writes must stay gated.

## Requirements

### Validated

<!-- Inferred from the existing codebase (.planning/codebase/) - shipped and dogfooded in this repo, not yet fully test-covered. Describes the CURRENT implementation; the storage-primitive choice itself is being re-verified (see Key Decisions). -->

- [x] Nx self-hosted remote-cache HTTP server: loopback bind, timing-safe bearer auth, hash validation, body-size cap, best-effort read degradation - existing
- [x] Runtime-context backend selection (no caller-facing mode flag) - existing
- [x] Read-write cache in CI on trusted events (Actions cache backend) - existing
- [x] Read-only enforcement locally (local `put()` always forbidden -> 403) - existing
- [x] CREEP (CVE-2025-36852) write-trust gate: `isWriteTrusted(env)`, defense-in-depth alongside GitHub's server-side read-only cache token - existing
- [x] Date-based auto-cleanup via `CACHE_MIRROR_MAX_AGE_DAYS`, coupled to the read-lookback window so retained assets stay readable and expired ones stay cleanable - existing
- [x] Daily scheduled single-writer mirror cleanup, decoupled from pushes - existing
- [x] Cross-OS content-hash parity (`.gitattributes` `eol=lf`; OS-discriminated integration hash) and per-OS publish-mirror matrix (ubuntu + windows) - existing
- [x] Published npm package `@op-nx/github-cache` with three bins; two dependency-free GitHub JS actions (`start-cache-server`, `publish-mirror`) - existing

### Active

<!-- New scope for this milestone. Hypotheses until shipped and validated. -->

**FOUNDATION (P0 - gates the roadmap):**

- [ ] **Verify the best GitHub / Git storage primitive(s)** for both public and private repos, before committing to a roadmap. The anonymous-read assumption that favored Release assets is **retracted** (authenticated local read is now the baseline), so the candidate field is re-opened. Candidates to research, explore, and analyze (**including but not limited to**): GitHub Actions cache; GitHub Releases; GitHub Packages; GHCR (OCI container registry); GitHub Actions build artifacts; Git LFS; a separate Nx-cache Git repo; a separate Nx-cache Git branch. Resolve via `/gsd:explore` -> `/gsd:spike`.
- [ ] **Local read uses the developer's existing GitHub authentication** (git credential helper and/or `gh` CLI, or `GH_TOKEN`/`GITHUB_TOKEN`) and MUST work for **private repositories**. Anonymous zero-credential read is an optional convenience for public repos only - never a design driver.
- [ ] **Distribution forms:** consumers can use the project via published **Docker containers** and **npm packages** (both usable in local and CI environments), and via published **GitHub Actions** (CI, where relevant). Docker distribution is new; npm + Actions exist.

**Feature work (may be reshaped by the primitive verification above):**

- [ ] Support `pull_request` and `release` trigger events with correct read-write vs read-only semantics, relying on GitHub's read-only cache token for untrusted / fork PRs (resolves the open "why not pull_request?" question)
- [ ] Make CI read-write vs read-only mode a first-class, documented, testable capability
- [ ] Optional LRU-style retention in addition to the mandatory date-based cleanup (approach depends on the chosen primitive's last-accessed signal)
- [ ] Comprehensive automated test coverage for the currently untested paths: I/O orchestration in publish-mirror, `selectBackend`, the cleanup bin wrapper, and the `withHashLock` concurrency edge
- [ ] Consumer-facing adoption docs (public + private setup) so external projects can wire this in without reading the source
- [ ] Replace `gh` CLI stderr text-matching with structural Octokit error discrimination (robustness on uncontrolled `gh` versions)

### Out of Scope

- Hosted / managed cache service - GitHub-native storage only; the whole point is zero extra infrastructure to run
- Nx custom task runner API - deprecated; target only the current self-hosted-cache HTTP contract
- Streaming of large bodies - fully buffered up to 2 GB; revisit only if real workloads demand it
- Multi-tenant / persistent shared self-hosted runners - deployment assumes ephemeral single-tenant runners (predictable temp path + in-process lock are safe only there)
- Local read-write mode - by design local is read-only only; only CI may write
- Per-release asset-count limits (the 1000-assets-per-release Release cap) - a **Release-specific** limit under reconsideration in the primitive verification; primitives like ghcr.io/OCI do not have it

## Context

- **Brownfield.** A substantial, well-architected implementation already exists and is dogfooded in this repo; it is early in **test coverage and public-consumption readiness**, not in implementation. See `.planning/codebase/` (ARCHITECTURE, STACK, CONCERNS, TESTING, CONVENTIONS, STRUCTURE, INTEGRATIONS).
- **Ports-and-adapters** around a single `CacheBackend` port, with a thin HTTP protocol layer and side-effect-free pure domain modules (`shard`, `cleanup`, `trust`, `types`) for testability. The port isolates any future storage-primitive pivot to a new factory behind `selectBackend`.
- **Auth assumption:** because the platform is GitHub, local developer environments are assumed already authenticated to GitHub (git credential helper and/or `gh`). Requiring auth is free; depending on anonymous access is not (it excludes private repos).
- **Three credentials, never mixed:** per-process CSPRNG bearer token (Nx <-> server), `ACTIONS_RUNTIME_TOKEN` (Actions cache service, passed only by process inheritance into JS actions), and `GITHUB_TOKEN`/`GH_TOKEN` (gh/Octokit REST).
- **Known silent-failure history:** a cross-OS publish-mirror gap and a CRLF hash-divergence bug were both fixed; both failed silently. New work must not reopen them - the per-OS matrix and `.gitattributes` are load-bearing.
- **Retention is one coupled setting.** `CACHE_MIRROR_MAX_AGE_DAYS` drives both the read lookback and the cleanup window through shared `resolveMaxAgeDays`/`shardTagsForWindow`; never introduce a second knob.

### Key external references (fold into research / spike)

- Nx self-hosted caching usage notes: https://nx.dev/docs/guides/tasks--caching/self-hosted-caching#usage-notes
- Nx enterprise security: https://nx.dev/enterprise/security
- CVE-2025-36852 - critical cache-poisoning (CREEP): https://nx.dev/blog/cve-2025-36852-critical-cache-poisoning-vulnerability-creep
- GitHub read-only Actions cache for untrusted triggers (2026-06-26): https://github.blog/changelog/2026-06-26-read-only-actions-cache-for-untrusted-triggers/
- GitHub dependency-caching reference: https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching
- Nx self-hosted-cache packages (deprecated set): https://nx.dev/docs/reference/deprecated/self-hosted-cache-packages
- Nx deprecated custom task runner API: https://21.nx.dev/docs/reference/deprecated/custom-tasks-runner
- 1st-party prior art `@nx/azure-cache`: https://npmx.dev/package/@nx/azure-cache and https://21.nx.dev/docs/reference/remote-cache-plugins/azure-cache/overview
- 3rd-party prior art (older custom-task-runner era): https://github.com/NiklasPor/nx-remotecache-azure
- Exploring Nx self-hosted cache (community write-up): https://emilyxiong.medium.com/exploring-of-nx-self-hosted-cache-5bc39bd2ed7f

## Constraints

- **Tech stack**: TypeScript (strict, ESM, `module: nodenext`), Node 24 LTS, Nx 23, Vitest - relative imports carry `.js`; the two GitHub JS actions must be dependency-free CommonJS (they run before `npm ci`).
- **Platform**: GitHub-native only - candidate storage primitives under verification (Actions cache, Release assets, ghcr.io/OCI, GitHub Packages, git-native), via `@actions/cache`, `@octokit/rest`, the `gh` CLI, and/or git; no hosted deployment; runs as a loopback sidecar.
- **Auth / repo scope**: local environments are assumed authenticated to GitHub; the design MUST work for private repositories and MUST NOT depend on anonymous/public access. Anonymous read is an optional OSS-only convenience.
- **Security**: writes gated to trusted trigger events; server binds `127.0.0.1` only; GitHub's server-side read-only cache token (since 2026-06-26) is the load-bearing CREEP control, the in-code gate is defense-in-depth (env is fork-spoofable).
- **Compatibility**: cross-OS content-hash parity is load-bearing (`.gitattributes`); `@actions/cache` version-hashes the literal temp-path strings, so `cacheArchivePath()` must stay the single source of truth and must not change without re-verifying an end-to-end restore.
- **Distribution**: consumable via Docker containers + npm packages (local & CI) and GitHub Actions (CI); minimal setup for external adopters; changes made for this repo's own CI/hashing must never leak into the consumer contract.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| **Storage primitive(s): incumbent = Actions cache (RW/CI) + Release-asset mirror (RO/local)** | GitHub-native, zero extra hosting | **UNVERIFIED - foundational.** Being re-verified via `/gsd:explore` + `/gsd:spike` BEFORE any roadmap. The anonymous-read assumption that favored Releases is retracted; candidates widened (ghcr.io/OCI, git-native, Packages). |
| Local read requires the developer's existing GitHub auth; support public AND private repos | We assume GitHub, so auth is free; anonymous access excludes private repos | [OK] Good (user-confirmed) |
| Distribution forms: Docker containers + npm packages (local & CI) + GitHub Actions (CI) | Meet consumers where they run; Docker container is a new form | [OK] Good (user-confirmed) |
| Runtime-context backend selection instead of a mode flag | No caller can misconfigure read-write vs read-only | [OK] Good |
| Write-trust gate currently omits `pull_request` and `release` | CREEP precaution: the event name is fork-spoofable | [WARN] Revisit - GitHub's 2026-06-26 read-only-cache-token change backstops forks server-side, making these events safe to add |
| Age-based retention is the mandatory floor; LRU optional | LRU approach depends on the chosen primitive's last-accessed signal | - Pending (revisit after primitive verification) |
| `gh` CLI (stderr text-matching) for publish/cleanup | `gh` handles auth/pagination for free on runners | [WARN] Revisit - migrate to Octokit for structural error discrimination |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? -> Move to Out of Scope with reason
2. Requirements validated? -> Move to Validated with phase reference
3. New requirements emerged? -> Add to Active
4. Decisions to log? -> Add to Key Decisions
5. "What This Is" still accurate? -> Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check - still the right priority?
3. Audit Out of Scope - reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-07-17 after auth-baseline correction + primitive-selection re-opened (roadmap + Phase-1 discussion rewound)*
