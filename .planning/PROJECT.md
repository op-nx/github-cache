# @op-nx/github-cache - GitHub-backed Nx Remote Cache

## What This Is

An open-source, self-hosted Nx remote cache that stores task artifacts on GitHub-native
primitives instead of a dedicated cache service: the **GitHub Actions cache** (read-write, in
CI) and an anonymous, **read-only GitHub Release-asset mirror** (for local development). It
speaks Nx's self-hosted-cache HTTP contract (`GET`/`PUT /v1/cache/{hash}`) as a loopback-only
sidecar and picks its storage backend from runtime context, so there is no mode flag a caller
can get wrong. It is meant for **other projects to adopt** - especially open-source /
low-churn repositories that want remote caching with zero extra hosting - not only for
dogfooding in this repo.

## Core Value

**Correct and safe caching on GitHub infrastructure with nothing extra to host.** A remote
cache must never serve a wrong or poisoned artifact and must never let an untrusted trigger
write - correctness and CREEP-safety come before every other feature. If everything else
fails, reads must stay best-effort (a fault degrades to a MISS, never a broken build) and
writes must stay gated.

## Requirements

### Validated

<!-- Inferred from the existing codebase (.planning/codebase/) - shipped and dogfooded in this repo, not yet fully test-covered. -->

- [x] Nx self-hosted remote-cache HTTP server: loopback bind, timing-safe bearer auth, hash validation, body-size cap, best-effort read degradation - existing
- [x] Runtime-context backend selection (Actions cache in CI vs Release mirror locally) with no caller-facing mode flag - existing
- [x] Read-write cache in CI on trusted events (Actions cache backend) - existing
- [x] Read-only enforcement locally (Release mirror `put()` always forbidden -> 403) - existing
- [x] CREEP (CVE-2025-36852) write-trust gate: `isWriteTrusted(env)`, defense-in-depth alongside GitHub's server-side read-only cache token - existing
- [x] Date-based auto-cleanup via `CACHE_MIRROR_MAX_AGE_DAYS`, coupled to the read-lookback window so retained assets stay readable and expired ones stay cleanable - existing
- [x] Daily scheduled single-writer mirror cleanup, decoupled from pushes - existing
- [x] Cross-OS content-hash parity (`.gitattributes` `eol=lf`; OS-discriminated integration hash) and per-OS publish-mirror matrix (ubuntu + windows) - existing
- [x] Two dependency-free GitHub JS actions (`start-cache-server`, `publish-mirror`) that carry the Actions-cache runtime env down to the built bins - existing
- [x] Published npm package `@op-nx/github-cache` with three bins (serve, publish-mirror, publish-mirror-cleanup) - existing

### Active

<!-- New scope for this milestone. Hypotheses until shipped and validated. -->

- [ ] Support the `pull_request` and `release` trigger events with correct read-write vs read-only semantics, relying on GitHub's read-only cache token for untrusted / fork PRs (resolves the open "why not pull_request?" question)
- [ ] Make CI read-write vs read-only mode a first-class, documented, testable capability (today it is derived but under-tested and under-documented)
- [ ] Optional LRU-style retention for the mirror, in addition to the mandatory date-based cleanup (age-only today; GitHub's Release API exposes no last-accessed signal, so this needs a manifest with read-modify-write state in the single-writer cleanup workflow)
- [ ] Comprehensive automated test coverage for the currently untested paths: `gh` I/O orchestration in publish-mirror, `selectBackend`, the cleanup bin wrapper, and the `withHashLock` concurrency edge
- [ ] Consumer-facing adoption docs so external projects (especially open-source / low-churn) can wire this in without reading the source
- [ ] Evaluate whether other GitHub / Git primitives beat Actions cache + Releases for any part of the pipeline; pivot if clearly better
- [ ] Replace `gh` CLI stderr text-matching in publish-mirror/cleanup with structural Octokit error discrimination (robustness for consumers on uncontrolled `gh` versions)

### Out of Scope

- Hosted / managed cache service - GitHub-native storage only; the whole point is zero extra infrastructure to run
- Nx custom task runner API - deprecated; target only the current self-hosted-cache HTTP contract
- Streaming of large bodies - fully buffered up to 2 GB (matches the ~2 GiB Release-asset ceiling); revisit only if real workloads demand it
- Multi-tenant / persistent shared self-hosted runners - deployment assumes ephemeral single-tenant runners (predictable temp path + in-process lock are safe only there)
- Sub-sharding beyond GitHub's 1000-assets-per-release cap - deferred until a repo actually exceeds it; the low-churn target audience will not
- Local read-write mode - by design local is read-only only; only CI may write

## Context

- **Brownfield.** A substantial, well-architected implementation already exists and is dogfooded in this repo; it is early in **test coverage and public-consumption readiness**, not in implementation. See `.planning/codebase/` (ARCHITECTURE, STACK, CONCERNS, TESTING, CONVENTIONS, STRUCTURE, INTEGRATIONS).
- **Ports-and-adapters** around a single `CacheBackend` port, with a thin HTTP protocol layer and side-effect-free pure domain modules (`shard`, `cleanup`, `trust`, `types`) for testability.
- **Three credentials, never mixed:** per-process CSPRNG bearer token (Nx <-> server), `ACTIONS_RUNTIME_TOKEN` (Actions cache service, passed only by process inheritance into JS actions), and `GITHUB_TOKEN`/`GH_TOKEN` (gh/Octokit REST for Release assets + cache-key listing).
- **Known silent-failure history:** a cross-OS publish-mirror gap and a CRLF hash-divergence bug were both fixed; both failed silently (mirror quietly missing entries / cross-OS cache misses). New work must not reopen them - the per-OS matrix and `.gitattributes` are load-bearing.
- **Retention is one coupled setting.** `CACHE_MIRROR_MAX_AGE_DAYS` drives both the read lookback and the cleanup window through shared `resolveMaxAgeDays`/`shardTagsForWindow`; never introduce a second knob.

### Key external references (fold into research)

- Nx self-hosted caching usage notes: https://nx.dev/docs/guides/tasks--caching/self-hosted-caching#usage-notes
- Nx enterprise security: https://nx.dev/enterprise/security
- CVE-2025-36852 - critical cache-poisoning (CREEP): https://nx.dev/blog/cve-2025-36852-critical-cache-poisoning-vulnerability-creep
- GitHub read-only Actions cache for untrusted triggers (2026-06-26; lists `pull_request` and `release` as read-write): https://github.blog/changelog/2026-06-26-read-only-actions-cache-for-untrusted-triggers/
- GitHub dependency-caching reference: https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching
- Nx self-hosted-cache packages (deprecated set): https://nx.dev/docs/reference/deprecated/self-hosted-cache-packages
- Nx deprecated custom task runner API: https://21.nx.dev/docs/reference/deprecated/custom-tasks-runner
- 1st-party prior art `@nx/azure-cache`: https://npmx.dev/package/@nx/azure-cache and https://21.nx.dev/docs/reference/remote-cache-plugins/azure-cache/overview (source likely in earlier tags/branches of the local nrwl/nx clone)
- 3rd-party prior art (older custom-task-runner era): https://github.com/NiklasPor/nx-remotecache-azure
- Exploring Nx self-hosted cache (community write-up): https://emilyxiong.medium.com/exploring-of-nx-self-hosted-cache-5bc39bd2ed7f

## Constraints

- **Tech stack**: TypeScript (strict, ESM, `module: nodenext`), Node 24 LTS, Nx 23, Vitest - relative imports carry `.js`; the two GitHub JS actions must be dependency-free CommonJS (they run before `npm ci`).
- **Platform**: GitHub-native only - Actions cache + Releases, via `@actions/cache`, `@octokit/rest`, and the `gh` CLI; no hosted deployment; runs as a loopback sidecar.
- **Security**: writes gated to trusted trigger events; server binds `127.0.0.1` only; GitHub's server-side read-only cache token (since 2026-06-26) is the load-bearing CREEP control, the in-code gate is defense-in-depth (env is fork-spoofable).
- **Compatibility**: cross-OS content-hash parity is load-bearing (`.gitattributes`); `@actions/cache` version-hashes the literal temp-path strings, so `cacheArchivePath()` must stay the single source of truth and must not change without re-verifying an end-to-end restore.
- **Distribution**: must stay adoptable by external projects with minimal setup; changes made for this repo's own CI/hashing must never leak into the consumer contract.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| GitHub Actions cache (RW/CI) + Release-asset mirror (RO/local) as the two backends | GitHub-native, zero extra hosting; Releases give an anonymous read path locally | - Pending (open to pivot if a better primitive surfaces) |
| Runtime-context backend selection instead of a mode flag | No caller can misconfigure read-write vs read-only | [OK] Good |
| Write-trust gate currently omits `pull_request` and `release` | CREEP precaution: the event name is fork-spoofable, so trusting it pre-2026-06-26 risked cache poisoning | [WARN] Revisit - GitHub's 2026-06-26 read-only-cache-token change now backstops forks server-side, making these events safe to add |
| Age-based retention only; LRU deferred | GitHub's Release API exposes no last-accessed signal; the daily single-writer cleanup workflow is the intended home for a future manifest | - Pending |
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
*Last updated: 2026-07-17 after initialization*
