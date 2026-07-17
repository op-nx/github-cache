# Requirements: @op-nx/github-cache

**Defined:** 2026-07-17
**Core Value:** Correct and safe caching on GitHub infrastructure with nothing extra to host - reads stay best-effort, writes stay gated.

> Brownfield / subsequent milestone. Table-stakes cache behavior is already shipped and dogfooded (see `.planning/PROJECT.md` "Validated"). This milestone closes the gap from "dogfooded" to "consumable and trustworthy by outside projects": test coverage, robustness, safe `pull_request`/`release` support, adoption docs. Grounded in `.planning/research/SUMMARY.md`.

## v1 Requirements

Requirements for this milestone. Each maps to a roadmap phase.

### Testing & Safety Net

- [ ] **TEST-01**: `selectBackend` has unit specs covering CI-vs-local selection, `GITHUB_REPOSITORY` format validation, the `GH_TOKEN || GITHUB_TOKEN` fallthrough, and malformed-repo rejection
- [ ] **TEST-02**: `withHashLock` has a concurrency spec (same hash serializes; different hashes run concurrently; the map entry is evicted after completion; a rejected op does not wedge the chain)
- [ ] **TEST-03**: publish-mirror's `gh` orchestration is testable behind an injected `GhRunner` seam, with specs for the already-exists / 404 / other-error branches
- [ ] **TEST-04**: the publish-mirror-cleanup bin wrapper has a spec asserting per-item failure isolation and a non-zero exit on aggregated failure
- [ ] **TEST-05**: regression guards assert the must-not-reopen cross-OS invariants (both OS publish legs run; `.gitattributes` keeps `eol=lf`; `cacheArchivePath()` is the sole temp-path source)
- [ ] **TEST-06**: date-based auto-cleanup and read-only-local enforcement are covered by tests that assert an expired asset is pruned, a within-window asset is retained, and a local `put()` is always refused (403)

### Robustness

- [ ] **ROBUST-01**: publish-mirror and cleanup discriminate GitHub outcomes structurally via Octokit `error.status` instead of `gh` stderr text-matching (already-exists, 404, and real faults are distinguished; a real fault is never treated as absence)
- [ ] **ROBUST-02**: the large (~2 GiB) release-asset upload path is verified via Octokit before `gh release upload` is dropped

### Trust & Modes

- [ ] **TRUST-01**: the serve write-trust gate accepts `pull_request` and `release` events (scope-isolated writes that cannot poison the default-branch cache, per GitHub's read-only-token model)
- [ ] **TRUST-02**: the publish-mirror gate stays restricted to default-branch `push`/`schedule` and refuses `pull_request`/`release`/non-default refs (test-locked)
- [ ] **TRUST-03**: the two trust boundaries are separate predicates (`isCacheWriteTrusted` wide vs `isMirrorPublishTrusted` narrow); the exact trusted-event sets are asserted, and dangerous events (`pull_request_target`, `issue_comment`, `workflow_run`) are refused on the write gate
- [ ] **TRUST-04**: both `TRUSTED_EVENTS` copies (`src/lib/trust.ts` and `start-cache-server/index.cjs`) stay in sync, enforced by a `selfcheck.cjs` parity assertion
- [ ] **TRUST-05**: CI read-write vs read-only mode is a named, documented, tested capability rather than an implicit derivation

### Consumer Adoption Docs

- [ ] **DOCS-01**: an adoption guide with a copy-paste CI workflow (the `serve` step, the isolated-permission `publish-mirror` job, and the scheduled cleanup) so an external project can wire it in without reading the source
- [ ] **DOCS-02**: a config reference table listing every `resolve*` env knob and its default (`PORT`, `MAX_CACHE_BODY_BYTES`, `CACHE_MIRROR_MAX_AGE_DAYS`, token vars)
- [ ] **DOCS-03**: a trust/security section covering which events write, the CREEP posture, the github.com-only read-only-token backstop plus a GHES version floor (or "do not enable on GHES"), the single-tenant-ephemeral-runner warning, the one-coupled-`CACHE_MIRROR_MAX_AGE_DAYS` caveat, and read-only-local-by-design

## v2 Requirements

Deferred to a future milestone. Tracked but not in the current roadmap. Both are gated on a preliminary spike per the research.

### Optional LRU Retention

- **RETAIN-LRU-01**: optional, off-by-default within-window LRU cold-eviction via a single-writer manifest owned by the daily cleanup workflow - gated on a spike verifying that Release-asset `download_count` increments on octet-stream API downloads; the age-based floor stays mandatory and no second retention knob is introduced

### Backend Primitive Evaluation

- **BACKEND-01**: a time-boxed spike evaluating an alternative mirror-read primitive (OCI / ghcr.io: content-addressable, no 1000-asset cap, anonymous pulls) behind the existing `CacheBackend` port - expected outcome is no pivot

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Local read-write mode | Reopens CREEP; local stays read-only by construction |
| Hosted / managed cache service | Defeats the zero-infrastructure value proposition |
| Streaming large bodies | Fully buffered up to 2 GB matches the Release-asset ceiling; revisit only if real workloads demand it |
| A second retention knob | Read-window vs retention-window drift makes retained assets unreadable or expired assets uncleanable |
| Touch-on-read / true LRU | Local readers are anonymous and read-only - they cannot write an access signal back |
| Multi-tenant / persistent shared self-hosted runners | Predictable temp path + in-process lock are safe only on ephemeral single-tenant runners |
| Sub-sharding beyond 1000 assets/release | Deferred until a repo actually exceeds it; the low-churn target audience will not |
| Deprecated Nx custom task runner API and `@nx/*-cache` Powerpack plugins | Deprecated + CREEP-affected; target only the current self-hosted-cache HTTP contract |

## Traceability

Which phases cover which requirements. Populated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| (populated by roadmap) | - | Pending |

**Coverage:**
- v1 requirements: 16 total
- Mapped to phases: 0 (roadmap pending)
- Unmapped: 16

---
*Requirements defined: 2026-07-17*
*Last updated: 2026-07-17 after initial definition*
