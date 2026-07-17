# Requirements: @op-nx/github-cache

**Defined:** 2026-07-17
**Core Value:** Correct and safe caching on GitHub infrastructure, for public and private repos, with nothing extra to host.

> **PROVISIONAL - pending the reader-adapter spike.** Architecture + CREEP-safety posture are decided (see `.planning/ARCHITECTURE-DECISION.md`). The current implementation is a spike/PoC (reference, rebuildable; sunk cost = 0). The one open primitive choice is the reader/cross-context adapter (GHCR/OCI vs Releases), resolved by `/gsd:spike` on forward merits. GHCR-/Releases-conditional requirements bind with that outcome.

## Foundational Decisions (resolve BEFORE the roadmap)

- [ ] **FOUND-01 - Reader/cross-context adapter (spike, forward-merits only).** GHCR/OCI vs Releases; Actions cache is the decided CI-RW default; git-native + artifacts are out. Symmetric rubric: authenticated private keyed lookup; CI read/write performance; cost incl. **free-tier durability**; **cold-read API fan-out vs 60/hr anon + 5000/hr auth**; **first-write-wins/no-overwrite enforceability** (GHCR atomic = GO/NO-GO); content-addressing/digest-pin; **ongoing control-surface count**; per-primitive **size ceiling**; **poison-remediation capability**; Docker synergy. GHCR-side: >5000-undeletable + child-manifest + mutable-tag + cleanup-PAT burden. Releases-side: 1000-asset cap + ~2 GiB ceiling vs the 2 GB body cap. Verified in `/gsd:spike`.
- [ ] **FOUND-02 - Auth baseline.** Local read uses the developer's existing GitHub auth (git credential helper / `gh` / `GH_TOKEN`|`GITHUB_TOKEN`) and MUST work for private repos; MUST NOT depend on anonymous/public access.
- [ ] **FOUND-03 - Distribution forms.** v1 ships **npm package + JS Action** (the JS Action is mandatory for the Actions-cache CI-RW role). The **Docker container form is deferred** until the reader adapter lands (its image can't be finalized before FOUND-01).

## v1 Requirements

Grounded in `.planning/ARCHITECTURE-DECISION.md` (control ledger C1-C17). Most controls attach to the opt-in RO-store / sync / cleanup layers; the default (Actions-cache CI-RW only) carries only C1 + C4 + docs.

### Testing & Safety Net
- [ ] **TEST-01**: `selectBackend` unit specs (CI-vs-local, `GITHUB_REPOSITORY` validation, `GH_TOKEN||GITHUB_TOKEN` fallthrough, malformed-repo rejection, explicit `env` param)
- [ ] **TEST-02**: `withHashLock` concurrency spec (same-hash serializes; different concurrent; entry evicted; rejected op doesn't wedge)
- [ ] **TEST-03**: the **publish + cleanup orchestration** (the currently-untested `gh`/client I/O: ensure-shard, upload, get-release, list-assets, cleanup) is tested behind an injected client, with already-exists / not-found / other-fault branches
- [ ] **TEST-04**: cleanup bin wrapper spec (per-item isolation + non-zero exit on aggregated failure) — paired with RETAIN-01's list-phase-abort test
- [ ] **TEST-05**: regression guards for the must-not-reopen cross-OS invariants **and** a cross-OS round-trip through the chosen reader adapter (OS-invariant + OS-sensitive hash, from each CI OS)
- [ ] **TEST-06**: date-cleanup + read-only-local covered (expired pruned; within-window retained; local `put()` always 403)
- [ ] **TEST-07**: conformance fixture that **hashes the full vendored Nx spec** and **pins a named Nx version** (not `info.version`), asserting the server's success/401/403/404/409 + required `Content-Length`; **floor = Nx 21+ (server must return exactly `200`** — verified: the Nx client matches `200` strictly, treats `409`/`403` as graceful no-ops, and errors on any other status, so a `202` breaks it)

### Robustness
- [ ] **ROBUST-01**: structural error discrimination (client `error.status`, not stderr text) on **both publish and cleanup/delete** paths; a real fault is never treated as absence
- [ ] **ROBUST-02**: the large-body path is verified **per-primitive** (true ceiling per Actions-cache / GHCR / Releases, not a generic "~2 GB") before any legacy path is dropped
- [ ] **ROBUST-03**: `@actions/cache` (and version-hash-sensitive deps) pinned **exact** (not `^`); upgrades gated behind `test:act`

### Trust & CREEP-safety
- [ ] **TRUST-01**: write-trust = **allowlist** (configured replaces default; else default implicit); default-deny; **no denylist**. `pull_request`/`release` are safe by GitHub scope-isolation, but the default allowlist enables them **only where GitHub's untrusted-default-branch cache guard exists**, detected from **`GITHUB_SERVER_URL`** (`github.com`/`*.ghe.com` → ON; **every GHES host → OFF, fail-closed**; no caller flag). No GA GHES has the guard today (floor unpublished); a dormant version-gate knob stays OFF until one is published. Optional spoof cross-check: `/meta` `installed_version` + `X-GitHub-Enterprise-Version` absence. The in-code gate is fork-spoofable defense-in-depth only
- [ ] **TRUST-02**: the sync/publish gate is a **separate predicate = `{push, schedule}`** (not the write allowlist), test-locked to **reject** `pull_request`, `release`, `repository_dispatch`, `workflow_dispatch`, `merge_group`, `delete`, `registry_package`, `page_build`, and non-default refs
- [ ] **TRUST-03**: dangerous shared-default-scope events (`pull_request_target`, `issue_comment`, fork-`workflow_run`, and any non-allowlisted trigger) are refused on the write gate; asserted by test
- [ ] **TRUST-04**: the trusted-event allowlist has a **single source of truth** (the pre-`npm ci` action copy is generated from / shares it — eliminate the dual copy at root), with a `selfcheck.cjs` assertion
- [ ] **TRUST-05**: the runtime-context-derived RW-vs-RO mode is **documented and test-covered** (do NOT introduce a caller-facing mode surface — the no-flag safety property is load-bearing)
- [ ] **TRUST-06**: a **shipped installable PPE-hygiene gate** (reusable workflow / composite action) running `zizmor`/`actionlint` for named patterns (no `pull_request_target`+PR-checkout; no `issue_comment`/`workflow_run` executing PR code). It is **best-effort/advisory** (cannot verify novel/obfuscated evasions), NOT the load-bearing control - containment is TRUST-02 + **default-branch protection** (both stated as adopter prerequisites)
- [ ] **TRUST-07**: first-write-wins/no-overwrite (409) per adapter — CREEP value **conditional on TRUST-02**; Actions cache native. **GHCR has no atomic create-if-absent (confirmed unavailable in the OCI spec + GHCR) → best-effort check-then-write; low-severity** (same-hash trusted writes are byte-identical under CORR-01 = idempotent; untrusted overwrite is TRUST-02's job) — reinforced by pull-by-digest (not a GO/NO-GO) (GHCR-conditional)
- [ ] **TRUST-08**: the mirror publishes **only server-produced keys** (distinguishing namespace/prefix), never "any 1-512 hex" Actions-cache key; this filter **MUST ship before/with** enabling the reader mirror for any private repo (a broad filter leaks unrelated CI artifacts as world-readable assets)
- [ ] **TRUST-09** (GHCR-conditional): a **publish-time package-visibility fail-closed assert** - the publish pipeline verifies package visibility matches the repo (private repo -> private package) and fails the run on mismatch (not a docs-only setting)
- [ ] **CORR-01 (cross-OS correctness)**: the store is **OS-namespaced by default** (or the consumer requirement to OS-discriminate non-portable outputs is documented + enforced), so a cross-OS hit never serves a wrong-OS artifact (Core-Value: never a wrong result)

### Retention & Cleanup
- [ ] **RETAIN-01**: **list phase aborts with zero deletions** on any non-404 fault or incomplete pagination; **delete phase** isolates per-item failures + non-zero exit. Test injects a mid-pagination fault and asserts no deletion
- [ ] **RETAIN-02**: (GHCR-conditional) the >5000-download delete refusal is **non-fatal** (log+continue); documented age-floor exception; recorded as a poison-remediation gap
- [ ] **RETAIN-03**: cleanup credential - **prefer keeping GHCR in-repo so a job-scoped `GITHUB_TOKEN` suffices** (no long-lived PAT). Fine-grained PATs / GitHub App tokens are **unsupported for GHCR deletion**, so an org-owned/unlinked package forces a **classic PAT (`delete:packages`)** - gate it **behind an Actions Environment with required reviewers** and **document its org-wide-package-deletion blast radius** as an accepted trade-off. Never in a PR-triggered workflow; deletion via first-party Octokit; `concurrency:` group (queue, don't cancel); GHCR child-manifest deletion is reference-checked/fail-closed and the reader degrades a missing child to MISS

### Observability
- [ ] **OBS-01**: a whole-run publish/sync failure **fails loud** (workflow annotation + non-zero exit); ship a documented "how do I know the cache is working / detect sync degradation" signal

### Consumer Adoption Docs
- [ ] **DOCS-01**: **split** into a 5-minute default quickstart (Actions-cache CI-RW only) and a separate advanced guide (opt-in RO store / sync / cleanup)
- [ ] **DOCS-02**: config reference for every `resolve*` knob **and** the Nx client vars `NX_SELF_HOSTED_REMOTE_CACHE_SERVER` / `_ACCESS_TOKEN`; note Actions-cache 10 GB-repo LRU (monorepo thrash) and that the default composition has **no local read path**
- [ ] **DOCS-03**: trust/security section: events that write; CREEP posture; github.com-only backstop + **GHES floor**; **never enable fork-PR send-tokens/secrets**; **default-branch-protection** + ephemeral-single-tenant-runner prerequisites; coupled-`CACHE_MIRROR_MAX_AGE_DAYS`; read-only-local-by-design; **retention = storage-hygiene, not poison-containment**; mirrored keys are anonymously public; freshness-window + mid-session-staleness caveats; (GHCR) pull-by-digest + package-visibility publish step
- [ ] **DOCS-04**: a minimal **example adopter config** (example workflow/repo), distinct from this repo's maximal dogfood config
- [ ] **DOCS-05**: an **enumerated, tested public surface** (every consumer env knob, action input, package export) with a test that fails on unintended changes ("dogfood changes stay consumer-safe")

### Governance
- [ ] **GOV-01**: **SECURITY.md** vulnerability-disclosure policy (required for a poisoning-class tool)
- [ ] **GOV-02**: LICENSE (MIT)
- [ ] **GOV-03**: a versioned **consumer-contract / semver** statement (what "breaking" means for the public surface)

## v2 Requirements

- **PROV-01**: optional reader-verified **asymmetric provenance attestation** (cosign keyless via OIDC) - never content signing, never HMAC; only clean on a GHCR/OCI backend. (One line by design; see ARCHITECTURE-DECISION.md C7.)

## Deferred (not out of scope)

- Docker container distribution form - gated on the reader adapter (FOUND-03).
- Synchronous write fan-out; a local read-write store; multiple simultaneous stores; CONTRIBUTING / maintenance-statement.

## Out of Scope

| Feature | Reason |
|---------|--------|
| LRU via a stateful manifest | Security-negative (mutable shared retention state) + no GHCR last-accessed signal; LRU is native on the Actions-cache CI tier, RO tier is age-only |
| Content signing as a CREEP control | Ineffective - poison precedes hashing (CVE-2025-36852); CREEP is defended at the write/sync gates |
| Local read-write mode | Reopens CREEP; local stays read-only by construction |
| Hosted / managed cache service | Defeats zero-infrastructure |
| Streaming large bodies | Buffered to the per-primitive ceiling; revisit only if real workloads demand it |
| A second retention knob | Read-window vs retention-window drift (Releases-shaped invariant) |
| Multi-tenant / persistent shared self-hosted runners | Predictable temp path + in-process lock safe only on ephemeral single-tenant runners |
| Deprecated Nx custom task-runner API and `@nx/*-cache` plugins | Deprecated + CREEP-affected |

## Traceability

Populated during roadmap creation (after the FOUND-01 reader spike).

| Requirement | Phase | Status |
|-------------|-------|--------|
| (populated by roadmap) | - | Pending |

---
*Requirements defined: 2026-07-17*
*Last updated: 2026-07-17 - 6-panel triage + Sonnet `/lz-security-review` + targeted research: TRUST-01 detection is host-based fail-closed (`GITHUB_SERVER_URL`; all GHES OFF, floor unpublished); TRUST-07 GHCR no-overwrite is best-effort/low-severity (atomic create confirmed unavailable, C2-covered); TEST-07 floor is a hard `200`/Nx-21+ (client requires exactly 200). See ARCHITECTURE-DECISION.md.*
