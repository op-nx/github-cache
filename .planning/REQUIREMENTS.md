# Requirements: @op-nx/github-cache

**Defined:** 2026-07-17
**Core Value:** Correct and safe caching on GitHub infrastructure, for public and private repos, with nothing extra to host.

> **PROVISIONAL - pending the reader-adapter spike.** Architecture and CREEP-safety posture are decided (see `.planning/ARCHITECTURE-DECISION.md`). The one open primitive choice is the reader/cross-context adapter (GHCR/OCI vs Releases), resolved by `/gsd:spike`. Backend-agnostic requirements below hold regardless; backend-specific ones (marked GHCR-conditional) resolve with the spike. Brownfield: table-stakes cache behavior is already shipped (see PROJECT.md "Validated").

## Foundational Decisions (must resolve BEFORE the roadmap)

- [ ] **FOUND-01 - Reader/cross-context storage adapter.** Choose GHCR/OCI vs GitHub Releases for the opt-in reader store (Actions cache is the decided CI-RW default; git-native and Actions artifacts are out). Rubric (security-weighted): authenticated keyed lookup for **private** repos via existing GitHub auth; CI read/write **performance**; **cost / free tier (esp. public OSS)**; **first-write-wins / no-overwrite enforceability** (C3); **content-addressing / digest-pin** (C6); **retention + delete mechanics** incl. the GHCR **>5000-download-undeletable** public-package wall (Releases sidesteps it); **untagged child-manifest cleanup** burden (GHCR only); count/size caps; Docker-distribution synergy. Anonymous read is an OSS-only bonus, not a filter. Empirically verified in `/gsd:spike`.
- [ ] **FOUND-02 - Auth baseline.** Local read uses the developer's existing GitHub authentication (git credential helper and/or `gh` CLI, or `GH_TOKEN`/`GITHUB_TOKEN`) and MUST work for private repositories; the design MUST NOT depend on anonymous/public access.
- [ ] **FOUND-03 - Distribution forms.** Consumable via published **Docker containers** and **npm packages** (local and CI) and **GitHub Actions** (CI). Constraint: the **JS Action is mandatory for the Actions-cache CI-RW role** (`ACTIONS_RUNTIME_TOKEN` is injected only into JS actions); the Docker container is clean for the **reader** role only.

## v1 Requirements

Grounded in `.planning/ARCHITECTURE-DECISION.md` (pluggable multi-store; allowlist write-trust; CREEP control ledger C1-C15). "Default composition" = Actions-cache CI-RW only; most controls attach to the opt-in RO-store / sync / cleanup layers.

### Testing & Safety Net

- [ ] **TEST-01**: `selectBackend` has unit specs (CI-vs-local, `GITHUB_REPOSITORY` validation, `GH_TOKEN || GITHUB_TOKEN` fallthrough, malformed-repo rejection)
- [ ] **TEST-02**: `withHashLock` has a concurrency spec (same hash serializes; different hashes concurrent; entry evicted after completion; rejected op does not wedge the chain)
- [ ] **TEST-03**: the backend's I/O orchestration is testable behind an injected client seam, with specs for the already-exists / not-found / other-error branches
- [ ] **TEST-04**: the cleanup bin wrapper has a spec asserting per-item failure isolation and a non-zero exit on aggregated failure
- [ ] **TEST-05**: regression guards assert the must-not-reopen cross-OS invariants (both OS legs run; `.gitattributes` keeps `eol=lf`; `cacheArchivePath()` is the sole temp-path source)
- [ ] **TEST-06**: date-based auto-cleanup and read-only-local enforcement are covered by tests (expired pruned; within-window retained; local `put()` always 403)
- [ ] **TEST-07**: the Nx spec (v1.0.0 / OpenAPI 3.0.0) is vendored as a conformance fixture; a test asserts the server's `200 / 401 / 403 / 404 / 409` + required `Content-Length` behavior against it

### Robustness

- [ ] **ROBUST-01**: GitHub outcomes are discriminated structurally (Octokit `error.status`, or the chosen client's structural errors) instead of `gh` stderr text-matching, on **both the publish and the cleanup/delete paths**; a real fault is never treated as absence
- [ ] **ROBUST-02**: the large (~2 GB) upload/download path for the chosen primitive is verified end-to-end before any legacy path is dropped

### Trust & CREEP-safety

- [ ] **TRUST-01**: write-trust is an **allowlist** (configured replaces default; else the default implicit allowlist); default-deny; **no denylist**. Default allowlist includes `pull_request` + `release` (scope-isolated) and refuses the dangerous set by construction
- [ ] **TRUST-02**: the sync/publish gate is a **separate, narrower predicate** than the write gate - only default-branch `push`/`schedule` entries sync to a shared/RO store; test-locked to refuse `pull_request`/`release`/non-default refs
- [ ] **TRUST-03**: dangerous shared-default-scope events (`pull_request_target`, `issue_comment`, fork-`workflow_run`, and any non-allowlisted trigger) are refused on the write gate; asserted by test
- [ ] **TRUST-04**: both `TRUSTED_EVENTS`/allowlist copies (`src/lib/trust.ts` and `start-cache-server/index.cjs`) stay in sync, enforced by a `selfcheck.cjs` parity assertion
- [ ] **TRUST-05**: CI read-write vs read-only mode is a named, documented, tested capability
- [ ] **TRUST-06**: a **repo-wide PPE hygiene CI check** (`zizmor`/`actionlint`, required gate) asserts no workflow runs untrusted code in the default-branch context - the control that backstops TRUST-02's residual (dogfooded here; documented as an adopter prerequisite)
- [ ] **TRUST-07**: **first-write-wins / no-overwrite (409)** is enforced per store adapter; Actions cache natively; GHCR via check-then-write + **read-by-digest** (GHCR-conditional)

### Retention & Cleanup

- [ ] **RETAIN-01**: the delete/cleanup path **fails loud / skips on non-404 faults and partial listings** (structural-404-only deletion) - never delete on incomplete data
- [ ] **RETAIN-02**: the GHCR **>5000-download delete refusal is handled non-fatally** (log + continue), so one popular public entry cannot wedge future cleanup runs (GHCR-conditional)
- [ ] **RETAIN-03**: the cleanup credential is a **job-scoped `GITHUB_TOKEN`** (`packages: write` on the cleanup job only), `schedule`/`workflow_dispatch`-triggered, no untrusted checkout, never referenced in a PR-triggered workflow; deletion uses first-party Octokit (not a third-party action); a `concurrency:` group (queue, don't cancel) + fail-closed child-manifest handling apply on GHCR

### Consumer Adoption Docs

- [ ] **DOCS-01**: an adoption guide with copy-paste setup for **both public and private** repos (local usage, the CI job, scheduled cleanup) across the supported distribution forms
- [ ] **DOCS-02**: a config reference table listing every `resolve*` env knob and its default
- [ ] **DOCS-03**: a trust/security section: which events write; CREEP posture; **github.com-only read-only-token backstop + GHES version floor**; **never enable fork-PR "send write tokens"/"send secrets"** policies; single-tenant-ephemeral-runner warning; coupled-`CACHE_MIRROR_MAX_AGE_DAYS` caveat; read-only-local-by-design; private-repo auth; **retention is storage-hygiene, not poison-containment**; (GHCR-conditional) pull-by-digest + package-visibility publish step

## v2 Requirements

Deferred.

- **PROV-01 - Optional provenance attestation** (defense-in-depth): reader-verified **asymmetric** attestation of the producer (trusted workflow identity + protected ref), e.g. cosign keyless via GitHub OIDC - **never** content signing (ineffective vs CREEP) and **never** HMAC (a shared secret handed to untrusted/public readers makes every reader a forger). Only clean with a GHCR/OCI backend; sized against FOUND-01.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Local read-write mode | Reopens CREEP; local stays read-only by construction (deferred to a later milestone as an explicit opt-in only) |
| Hosted / managed cache service | Defeats the zero-infrastructure value proposition |
| Streaming large bodies | Fully buffered up to 2 GB; revisit only if real workloads demand it |
| A second retention knob | Read-window vs retention-window drift makes retained assets unreadable or expired assets uncleanable |
| Touch-on-read / true LRU | Local readers are read-only - cannot write an access signal back regardless of auth |
| **LRU via a stateful manifest** | **Security-negative** (mutable shared retention state to race/corrupt) and GHCR exposes no last-accessed signal; LRU is served natively on the Actions-cache CI tier, RO tier is age-only |
| **Content signing as a CREEP control** | Ineffective - poison precedes hashing, so a trusted producer signs the poisoned bytes (per CVE-2025-36852). CREEP is defended at the write/sync gates, not by byte integrity |
| Multi-tenant / persistent shared self-hosted runners | Predictable temp path + in-process lock are safe only on ephemeral single-tenant runners |
| Deprecated Nx custom task runner API and `@nx/*-cache` Powerpack plugins | Deprecated + CREEP-affected; target only the current self-hosted-cache HTTP contract |
| Per-release asset-count limits (1000/release) | Release-specific limit weighed in FOUND-01; GHCR/OCI has no count cap |

## Traceability

Populated during roadmap creation (after the FOUND-01 reader spike).

| Requirement | Phase | Status |
|-------------|-------|--------|
| (populated by roadmap) | - | Pending |

---
*Requirements defined: 2026-07-17*
*Last updated: 2026-07-17 - folded in the D1-D4 security review (CREEP control ledger C1-C15); added TRUST-06/07, RETAIN-01/02/03, TEST-07; extended ROBUST-01/DOCS-03; reclassified LRU-via-manifest + content-signing to out-of-scope; see ARCHITECTURE-DECISION.md*
