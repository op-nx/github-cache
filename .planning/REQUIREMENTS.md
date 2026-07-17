# Requirements: @op-nx/github-cache

**Defined:** 2026-07-17
**Core Value:** Correct and safe caching on GitHub infrastructure, for public and private repos, with nothing extra to host.

> **PROVISIONAL - pending primitive verification.** The storage-backend primitive is being
> re-verified via `/gsd:explore` -> `/gsd:spike` before a roadmap is formed. The Foundational
> Decisions below **gate** everything; the "Provisional v1" requirements are contingent on the
> chosen primitive and will be re-derived after the spike. Brownfield: table-stakes cache
> behavior is already shipped (see `.planning/PROJECT.md` "Validated").

## Foundational Decisions (must resolve BEFORE the roadmap)

- [ ] **FOUND-01 - Storage primitive verification.** Research, explore, and analyze all GitHub / Git primitives as the cache storage/distribution backend and choose the best fit for **public and private** repos. Candidate set (**including but not limited to**):
  - GitHub Actions cache
  - GitHub Releases
  - GitHub Packages
  - GHCR (OCI container registry)
  - GitHub Actions build artifacts
  - Git LFS
  - Separate Nx-cache Git repo
  - Separate Nx-cache Git branch

  Rubric: authenticated keyed lookup that works for **private** repos using the dev's existing GitHub auth; RW-in-CI path; retention/cleanup + any last-accessed (LRU) signal; size limits; per-namespace/count caps; CREEP-safety (scope isolation / no-overwrite); operational cost (auth plumbing, rate limits, repo bloat). Anonymous read is an optional OSS-only bonus, not a filter. Empirically verified in `/gsd:spike`.
- [ ] **FOUND-02 - Auth baseline.** Local read uses the developer's existing GitHub authentication (git credential helper and/or `gh` CLI, or `GH_TOKEN`/`GITHUB_TOKEN`) and MUST work for private repositories; the design MUST NOT depend on anonymous/public access.
- [ ] **FOUND-03 - Distribution forms.** Consumers can use the project via published **Docker containers** and **npm packages** (both usable in local and CI environments), and via published **GitHub Actions** (CI, where relevant). Docker distribution is new; npm + Actions exist.

## Provisional v1 Requirements

Contingent on FOUND-01. Backend-agnostic items (test coverage, trust events, docs) hold regardless of the chosen primitive; backend-specific items (the Octokit-vs-`gh` work, mirror-specific tests) will be re-derived if the primitive changes.

### Testing & Safety Net

- [ ] **TEST-01**: `selectBackend` has unit specs (CI-vs-local, `GITHUB_REPOSITORY` validation, `GH_TOKEN || GITHUB_TOKEN` fallthrough, malformed-repo rejection)
- [ ] **TEST-02**: `withHashLock` has a concurrency spec (same hash serializes; different hashes concurrent; entry evicted after completion; rejected op does not wedge the chain)
- [ ] **TEST-03**: the backend's I/O orchestration is testable behind an injected client seam, with specs for the already-exists / not-found / other-error branches
- [ ] **TEST-04**: the cleanup bin wrapper has a spec asserting per-item failure isolation and a non-zero exit on aggregated failure
- [ ] **TEST-05**: regression guards assert the must-not-reopen cross-OS invariants (both OS legs run; `.gitattributes` keeps `eol=lf`; `cacheArchivePath()` is the sole temp-path source)
- [ ] **TEST-06**: date-based auto-cleanup and read-only-local enforcement are covered by tests (expired pruned; within-window retained; local `put()` always 403)

### Robustness

- [ ] **ROBUST-01**: GitHub outcomes are discriminated structurally (Octokit `error.status`, or the chosen client's structural errors) instead of `gh` stderr text-matching; a real fault is never treated as absence
- [ ] **ROBUST-02**: the large (~2 GB) upload/download path for the chosen primitive is verified end-to-end before any legacy path is dropped

### Trust & Modes

- [ ] **TRUST-01**: the serve write-trust gate accepts `pull_request` and `release` events (scope-isolated writes; per GitHub's read-only-token model)
- [ ] **TRUST-02**: the publish/mirror gate stays restricted to default-branch `push`/`schedule` and refuses `pull_request`/`release`/non-default refs (test-locked)
- [ ] **TRUST-03**: the two trust boundaries are separate predicates (write gate wide vs publish gate narrow); exact trusted-event sets asserted; dangerous events (`pull_request_target`, `issue_comment`, `workflow_run`) refused on the write gate
- [ ] **TRUST-04**: both `TRUSTED_EVENTS` copies (`src/lib/trust.ts` and `start-cache-server/index.cjs`) stay in sync, enforced by a `selfcheck.cjs` parity assertion
- [ ] **TRUST-05**: CI read-write vs read-only mode is a named, documented, tested capability

### Consumer Adoption Docs

- [ ] **DOCS-01**: an adoption guide with copy-paste setup for **both public and private** repos (local usage, the CI job, scheduled cleanup) across the supported distribution forms
- [ ] **DOCS-02**: a config reference table listing every `resolve*` env knob and its default
- [ ] **DOCS-03**: a trust/security section (which events write, CREEP posture, github.com-only read-only-token backstop + GHES version floor, single-tenant-ephemeral-runner warning, coupled-`CACHE_MIRROR_MAX_AGE_DAYS` caveat, read-only-local-by-design, private-repo auth)

## v2 Requirements

Deferred; gated on a spike.

### Optional LRU Retention

- **RETAIN-LRU-01**: optional, off-by-default within-window LRU cold-eviction via a single-writer manifest owned by the daily cleanup - approach depends on the chosen primitive's last-accessed signal; the age-based floor stays mandatory; no second retention knob

## Out of Scope

| Feature | Reason |
|---------|--------|
| Local read-write mode | Reopens CREEP; local stays read-only by construction |
| Hosted / managed cache service | Defeats the zero-infrastructure value proposition |
| Streaming large bodies | Fully buffered up to 2 GB; revisit only if real workloads demand it |
| A second retention knob | Read-window vs retention-window drift makes retained assets unreadable or expired assets uncleanable |
| Touch-on-read / true LRU | Local readers are read-only - they cannot write an access signal back regardless of auth |
| Multi-tenant / persistent shared self-hosted runners | Predictable temp path + in-process lock are safe only on ephemeral single-tenant runners |
| Deprecated Nx custom task runner API and `@nx/*-cache` Powerpack plugins | Deprecated + CREEP-affected; target only the current self-hosted-cache HTTP contract |
| Per-release asset-count limits (1000/release) | Release-specific limit under reconsideration in FOUND-01; primitives like GHCR/OCI do not have it |

## Traceability

Populated during roadmap creation (after FOUND-01 is resolved).

| Requirement | Phase | Status |
|-------------|-------|--------|
| (populated by roadmap) | - | Pending |

---
*Requirements defined: 2026-07-17*
*Last updated: 2026-07-17 - reset to provisional; primitive selection (FOUND-01) re-opened, auth baseline + distribution forms confirmed*
