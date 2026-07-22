# @op-nx/github-cache - GitHub-backed Nx Remote Cache

## What This Is

An open-source, self-hosted Nx remote cache that stores task artifacts on GitHub-native
primitives instead of a dedicated cache service. It speaks Nx's self-hosted-cache HTTP
contract (`GET`/`PUT /v1/cache/{hash}`) as a loopback-only sidecar and picks its storage
backend from runtime context, so there is no mode flag a caller can get wrong. Today it uses
the **GitHub Actions cache** (read-write, in CI) and a **read-only GitHub Release-asset
mirror** (for local reads). It is meant for **other projects to adopt** - across **both
public and private** GitHub repositories - not only for dogfooding in this repo.

**Architecture + storage primitives decided.** `selectBackend` returns
**one backend per process, chosen by runtime context** (default: Actions-cache CI-RW only);
an opt-in reader/cross-context store and its publish/cleanup are a separate, reader-specific
step. Write-trust is an allowlist; the full CREEP control ledger is in
`.planning/ARCHITECTURE-DECISION.md`. **The current implementation is a spike/PoC (reference,
rebuildable; sunk cost = 0).** The reader adapter is **LOCKED = GitHub Releases** (FOUND-01
spike, forward merits) and the Docker container form is **deferred to a later milestone** (FOUND-03); GHCR/OCI
is the later-milestone revisit trigger (with cosign + Docker).

## Core Value

**Correct and safe caching on GitHub infrastructure, for public and private repos, with
nothing extra to host.** A remote cache must never serve a wrong or poisoned artifact and must
never let an untrusted trigger write - correctness and CREEP-safety come before every other
feature. If everything else fails, reads must stay best-effort (a fault degrades to a MISS,
never a broken build) and writes must stay gated.

## Requirements

### Validated

<!-- Inferred from the existing codebase (.planning/codebase/) - shipped and dogfooded in this repo, not yet fully test-covered. Describes the CURRENT spike/PoC implementation; the storage-primitive choice is being re-verified (see Key Decisions). Reconciliation: the PoC mirror serves anonymous reads, but FOUND-02 supersedes it - the forward requirement is authenticated, private-repo-capable local read, with anonymous public read demoted to an optional OSS bonus (not a dependency). -->

> **These describe the spike/PoC that is being deleted and rebuilt greenfield** (ROADMAP Phase 0-1, MVP/vertical). They are the **target spec** the rebuild re-establishes test-first, not shipped current state.

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

**FOUNDATION (P0):**

- [x] **Reader / cross-context storage adapter = GitHub Releases (LOCKED, FOUND-01 spike):** decided on forward merits - fewer incident/operational hazards + no public poison-remediation gap vs GHCR (spike `.planning/spikes/001-005`). Actions cache stays the CI-RW default; git-native and Actions artifacts are out; GHCR is the later-milestone revisit trigger. See `.planning/ARCHITECTURE-DECISION.md`.
- [ ] **Local read uses the developer's existing GitHub authentication** (git credential helper and/or `gh` CLI, or `GH_TOKEN`/`GITHUB_TOKEN`) and MUST work for **private repositories**. Anonymous zero-credential read is an optional convenience for public repos only - never a design driver.
- [x] **Distribution forms = npm package + JS Action (v0.0.1); Docker deferred to a later milestone (LOCKED, FOUND-03).** The JS Action is mandatory for the Actions-cache CI-RW role. The Docker container's CI `services:` motivation is covered by running `serve` as a GitHub Actions background step (`background`/`cancel`) + a plain `&` fallback; residual niche (hermetic / non-Node CI) is a later-milestone item.

**Feature work (see REQUIREMENTS.md for the full, security-reviewed set):**

- [ ] `pull_request`/`release` write-trust, **gated on GitHub's server-side read-only-token backstop** (default off on GHES below the floor)
- [ ] Document + test the runtime-context-derived RW/RO mode (no caller-facing mode flag)
- [ ] Comprehensive test coverage for the untested paths (publish/cleanup orchestration, `selectBackend`, cleanup wrapper, `withHashLock`)
- [ ] Structural (Octokit) error discrimination on the publish AND cleanup paths
- [ ] Shipped PPE-hygiene gate + repo-wide safety controls; cross-OS correctness (CORR-01); consumer adoption docs (public + private); governance (SECURITY.md/LICENSE)

(LRU via a manifest is out of scope - native Actions-cache LRU + age-only RO; see Key Decisions.)

### Out of Scope

- Hosted / managed cache service - GitHub-native storage only; the whole point is zero extra infrastructure to run
- Nx custom task runner API - deprecated; target only the current self-hosted-cache HTTP contract
- Streaming of large bodies - fully buffered up to 2 GB; revisit only if real workloads demand it
- Multi-tenant / persistent shared self-hosted runners - deployment assumes ephemeral single-tenant runners (predictable temp path + in-process lock are safe only there)
- Local read-write mode - by design local is read-only only; only CI may write

(The 1000-assets-per-release Release cap is now **in scope** as ROBUST-05, since FOUND-01 = Releases is locked - handled by month-sharding + skip-and-warn, no longer under reconsideration.)

## Context

- **Greenfield rebuild.** A substantial PoC exists and is dogfooded, but it is being **deleted and rebuilt from scratch** (Phase 0 teardown -> MVP/vertical slices; sunk cost = 0). The PoC's `.planning/codebase/*` map and the platform facts/gotchas in `.planning/research/PITFALLS.md` carry forward as **reference/spec only**, never as code to extend. The codebase map is regenerated against the torn-down workspace between Phase 0 and Phase 1 (see ROADMAP.md).
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
| **One backend per process, context-selected** (`selectBackend`); default = Actions-cache CI-RW only; opt-in reader store + its publish/cleanup are a separate reader-specific step | Matches the ecosystem norm; minimal default, pay-as-you-compose; the publisher/cleanup subsystem is reader-specific (not port-isolated) | [OK] Decided (see ARCHITECTURE-DECISION.md) |
| Reader / cross-context adapter: **GitHub Releases** (v0.0.1) | Forward merits (FOUND-01 spike): fewer incident/operational hazards + no public poison-remediation gap (vs GHCR's >5000 wall, child-manifest, delete-cred, visibility); reversible/additive. GHCR = later-milestone trigger with cosign + Docker | [OK] LOCKED (FOUND-01) |
| **Write-trust = allowlist-only** (default-deny; no denylist); `pull_request`/`release` on **only where GitHub's untrusted-default-branch cache guard exists — host-detected from `GITHUB_SERVER_URL`** (`github.com`/`*.ghe.com` → ON; all GHES → OFF, fail-closed; no caller flag) | In-code gate is fork-spoofable defense-in-depth; the host-based check is a pure env-var function; no GA GHES has the guard yet (floor unpublished) | [OK] Decided |
| **Sync gate = a separate predicate = `{push, schedule}` only**, test-locked to reject all other events + non-default refs | Syncing a PR- or dispatch-influenced entry into a shared store recreates the CREEP precondition | [OK] Decided (load-bearing) |
| **Shipped installable PPE-hygiene gate** (best-effort/advisory) + default-branch-protection prerequisite | Heuristic linters can't catch novel evasions, so the load-bearing containment is the `{push,schedule}` sync gate + branch protection; the gate is defense-in-depth | [OK] Decided |
| **No content signing as a CREEP control**; digest-pin iff GHCR | CVE-2025-36852: poison precedes hashing, so signing is ineffective; CREEP is defended at the write/sync gates | [OK] Decided |
| Retention: native Actions LRU (CI tier) + age-only (RO tier); **no LRU manifest** | A manifest adds mutable retention state (security-negative); GHCR exposes no last-accessed signal | [OK] Decided |
| **OS-namespace the store by default** (or documented consumer OS-discrimination) | Cross-OS cache hit must never serve a wrong-OS artifact (Core Value: never a wrong result) | [OK] Decided |
| Runtime-context backend selection instead of a mode flag | No caller can misconfigure read-write vs read-only | [OK] Good |
| Publish/cleanup I/O uses Octokit (`error.status`) from the start, never `gh` stderr text-matching | `gh` gives no structured errors for already-exists/404 and is version-fragile; Octokit discriminates structurally | [OK] Decided (greenfield - no gh-CLI to migrate from) |

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
*Last updated: 2026-07-18 - Phase 1 (Walking Skeleton) complete: the greenfield `@op-nx/github-cache` lib speaks the Nx self-hosted-cache HTTP contract end-to-end (`GET`/`PUT /v1/cache/{hash}`) against a trivial in-process backend, built test-first (TDD). Delivered SRV-01..05 (loopback bind, timing-safe bearer auth, hash validation, body cap, best-effort MISS) + TEST-07 (conformance fixture hashing the full vendored Nx spec, hard-200/Nx-21+ floor); zero runtime dependencies, `node:http` + `node:crypto` only. Prior (2026-07-17): FOUND-01/03 LOCKED after the reader spike (`.planning/spikes/001-005`): reader adapter = GitHub Releases; Docker deferred to a later milestone; GHCR = later-milestone revisit trigger. 6-panel triage + Sonnet `/lz-security-review` + targeted research (host-based fail-closed write-trust detection; GHCR no-overwrite best-effort/low-severity; Nx PUT floor hard 200/Nx-21+). See ARCHITECTURE-DECISION.md.*
