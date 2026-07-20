# Requirements: @op-nx/github-cache

**Defined:** 2026-07-17
**Core Value:** Correct and safe caching on GitHub infrastructure, for public and private repos, with nothing extra to host.

> **LOCKED - reader adapter resolved by the FOUND-01 spike.** Architecture + CREEP-safety posture + the reader adapter are decided (see `.planning/ARCHITECTURE-DECISION.md`; spike `.planning/spikes/001-005`). **FOUND-01 = GitHub Releases; FOUND-03 = Docker deferred to a later milestone.** The current implementation is a spike/PoC (reference, rebuildable; sunk cost = 0). Releases-conditional requirements now bind; GHCR-conditional requirements move to the later-milestone GHCR revisit trigger.

## Foundational Decisions (resolve BEFORE the roadmap)

- [x] **FOUND-01 - Reader/cross-context adapter = GitHub Releases** (LOCKED, forward-merits, FOUND-01 spike `.planning/spikes/001-005`). Both stores validated; decided against GHCR on the **fewer incident/operational hazards + no public poison-remediation gap** axis (GHCR's >5000-undeletable wall, child-manifest cleanup, delete-credential nuance, visibility assert). Reversible/additive (multi-store); GHCR is the **later-milestone revisit trigger** with PROV-01 + Docker. Actions cache stays the CI-RW default; git-native + artifacts are out.
- [x] **FOUND-02 - Auth baseline.** Local read uses the developer's existing GitHub auth (git credential helper / `gh` / `GH_TOKEN`|`GITHUB_TOKEN`) and MUST work for private repos; MUST NOT depend on anonymous/public access.
- [x] **FOUND-03 - Distribution forms = npm package + JS Action (v0.0.1); Docker deferred to a later milestone** (LOCKED). The JS Action is mandatory for the Actions-cache CI-RW role. The Docker container form is deferred: its CI `services:` sidecar motivation is covered by running `serve` as a GitHub Actions **background step** (GA: `background`/`cancel`), which works cross-OS and in step context, with a plain `&` fallback for GHES/older runners; residual niche (hermetic/non-Node CI) is a later-milestone / on-demand item.

## v0.0.1 Requirements

Grounded in `.planning/ARCHITECTURE-DECISION.md` (control ledger C1-C18). Most controls attach to the opt-in RO-store / sync / cleanup layers; the default (Actions-cache CI-RW only) carries only C1 + C4 + docs. **Reader = GitHub Releases (LOCKED):** the GHCR-conditional controls/requirements (C6/C10/C11-GHCR/C13/C18; TRUST-07-GHCR, TRUST-09, RETAIN-02, RETAIN-03-GHCR) drop out of v0.0.1 and move to the later-milestone GHCR revisit trigger.

### Server / Protocol Security

Delivered by the Phase 1 walking-skeleton server - Core-Value hardening properties of the Nx-contract HTTP server, now independently traceable.

- [x] **SRV-01** (loopback bind): the HTTP server binds `127.0.0.1` only and is never reachable on a routable interface
- [x] **SRV-02** (timing-safe auth): bearer-token auth uses a per-process CSPRNG token compared in constant time; unauthenticated or mismatched requests are rejected (401)
- [x] **SRV-03** (hash validation): the `{hash}` path segment is validated (bounded-length hex) and malformed hashes are rejected before any backend call
- [x] **SRV-04** (body-size cap): request bodies are capped at `MAX_CACHE_BODY_BYTES` (2 GB); oversized bodies are rejected per contract, never buffered unbounded
- [x] **SRV-05** (best-effort read): a read fault degrades to a MISS (never a 5xx that breaks the build); writes fail closed

### Testing & Safety Net

- [x] **TEST-01**: `selectBackend` unit specs (CI-vs-local, `GITHUB_REPOSITORY` validation, `GH_TOKEN||GITHUB_TOKEN` fallthrough, malformed-repo rejection, explicit `env` param)
- [x] **TEST-02**: `withHashLock` concurrency spec (same-hash serializes; different concurrent; entry evicted; rejected op doesn't wedge)
- [ ] **TEST-03**: the **publish + cleanup orchestration** (the `gh`/client I/O: ensure-shard, upload, get-release, list-assets, cleanup) is **built behind an injected client and tested**, with already-exists / not-found / other-fault branches
- [ ] **TEST-04**: cleanup bin wrapper spec (per-item isolation + non-zero exit on aggregated failure) — paired with RETAIN-01's list-phase-abort test
- [x] **TEST-05**: regression guards for the must-not-reopen cross-OS invariants **and** a cross-OS round-trip through the chosen reader adapter (OS-invariant + OS-sensitive hash, from each CI OS)
- [x] **TEST-06**: date-cleanup + read-only-local covered (expired pruned; within-window retained; local `put()` always 403)
- [x] **TEST-07**: conformance fixture that **hashes the full vendored Nx spec** and **pins a named Nx version** (not `info.version`), asserting the server's success/401/403/404/409 + required `Content-Length`; **floor = Nx 21+ (server must return exactly `200`** — verified: the Nx client matches `200` strictly, treats `409`/`403` as graceful no-ops, and errors on any other status, so a `202` breaks it)

### Robustness

- [ ] **ROBUST-01**: structural error discrimination (client `error.status`, not stderr text) on **both publish and cleanup/delete** paths; a real fault is never treated as absence
- [ ] **ROBUST-02**: the large-body path is verified **per-primitive** (Actions-cache + **Releases** now that FOUND-01 is locked, not a generic "~2 GB"). Binding limit (spike 003): the **Releases ~2 GiB/asset ceiling coincides with the 2 GB server body cap** — an artifact at the cap sits on the failure boundary and MUST **fail loud, not silently truncate/drop**
- [x] **ROBUST-03**: `@actions/cache` (and version-hash-sensitive deps) pinned **exact** (not `^`); upgrades gated behind `test:act`
- [x] **ROBUST-04** (graceful shutdown): the `serve` process handles **`SIGTERM`** to flush in-flight writes / finalize async backfill before exit — required by the GitHub Actions background-step teardown (`cancel` sends `SIGTERM` then `SIGKILL` after a short grace), so a RW job does not lose its last writes at teardown; tested (SIGTERM during an in-flight put drains before exit)
- [ ] **ROBUST-05** (Releases 1000-asset/release cap, LOCKED-bound): the month-shard model keeps assets under the per-release cap; if a shard nonetheless reaches the **1000-asset limit**, the publish path **skips-and-warns** (workflow annotation, non-zero-free) rather than hard-failing the build — the cap degrades to a MISS-on-write, never a broken run

### Trust & CREEP-safety

- [ ] **TRUST-01**: write-trust = **allowlist** (configured replaces default; else default implicit); default-deny; **no denylist**. `pull_request`/`release` are safe by GitHub scope-isolation, but the default allowlist enables them **only where GitHub's untrusted-default-branch cache guard exists**, detected from **`GITHUB_SERVER_URL`** (`github.com`/`*.ghe.com` → ON; **every GHES host → OFF, fail-closed**; no caller flag). No GA GHES has the guard today (floor unpublished); a dormant version-gate knob stays OFF until one is published. Optional spoof cross-check: `/meta` `installed_version` + `X-GitHub-Enterprise-Version` absence. The in-code gate is fork-spoofable defense-in-depth only
- [x] **TRUST-02**: the sync/publish gate is a **separate predicate = `{push, schedule}`** (not the write allowlist), test-locked to **reject** `pull_request`, `release`, `repository_dispatch`, `workflow_dispatch`, `merge_group`, `delete`, `registry_package`, `page_build`, and non-default refs
- [x] **TRUST-03**: dangerous shared-default-scope events (`pull_request_target`, `issue_comment`, fork-`workflow_run`, and any non-allowlisted trigger) are refused on the write gate; asserted by test
- [ ] **TRUST-04**: the trusted-event allowlist has a **single source of truth**; the pre-`npm ci` dependency-free action copy is generated from / shares it (no dual root copy), with a `selfcheck.cjs` parity assertion
- [x] **TRUST-05**: the runtime-context-derived RW-vs-RO mode is **documented and test-covered** (do NOT introduce a caller-facing mode surface — the no-flag safety property is load-bearing)
- [ ] **TRUST-06**: a **shipped installable PPE-hygiene gate** (reusable workflow / composite action) running `zizmor`/`actionlint` for named patterns (no `pull_request_target`+PR-checkout; no `issue_comment`/`workflow_run` executing PR code). It is **best-effort/advisory** (cannot verify novel/obfuscated evasions), NOT the load-bearing control - containment is TRUST-02 + **default-branch protection** (both stated as adopter prerequisites)
- [ ] **TRUST-07**: first-write-wins/no-overwrite (409) — CREEP value **conditional on TRUST-02**; Actions cache native. **Releases (LOCKED):** the server returns 409 on an existing record and the mirror never overwrites an existing hash-named asset (immutable-by-convention; a same-hash trusted write is byte-identical under CORR-01, so a benign no-op). *(The GHCR best-effort check-then-write variant — low-severity, C2-covered — moves to the later-milestone GHCR trigger.)*
- [ ] **TRUST-08**: the mirror publishes **only server-produced keys** (distinguishing namespace/prefix), never "any 1-512 hex" Actions-cache key; this filter **MUST ship before/with** enabling the reader mirror for any private repo (a broad filter leaks unrelated CI artifacts as world-readable assets)
- [ ] **TRUST-09** (a later milestone - GHCR revisit trigger; N/A for Releases): a **publish-time package-visibility fail-closed assert** - verifies package visibility matches the repo and fails the run on mismatch. Releases assets inherit repo visibility, so no assert is needed in v0.0.1
- [x] **CORR-01 (cross-OS correctness)**: the store is **OS-namespaced by default** (or the consumer requirement to OS-discriminate non-portable outputs is documented + enforced), so a cross-OS hit never serves a wrong-OS artifact (Core-Value: never a wrong result)

### Retention & Cleanup

- [x] **RETAIN-01**: **list phase aborts with zero deletions** on any non-404 fault or incomplete pagination; **delete phase** isolates per-item failures + non-zero exit. Test injects a mid-pagination fault and asserts no deletion
- [ ] **RETAIN-02** (a later milestone - GHCR revisit trigger; N/A for Releases): the GHCR >5000-download delete refusal is non-fatal (log+continue); documented age-floor exception; recorded as a poison-remediation gap. Releases assets have no deletion wall
- [ ] **RETAIN-03**: cleanup credential — **Releases (LOCKED):** deletion uses the same `contents:write` `GITHUB_TOKEN` that publishes (no special scope, no PAT, no owner/linkage nuance), via first-party Octokit, under a `concurrency:` group (queue, don't cancel). *(GHCR's larger cleanup surface — `delete:packages`/classic-PAT for org/unlinked packages behind a reviewed Environment, child-manifest reference-checked/fail-closed deletion — moves to the later-milestone GHCR trigger; spike 005 confirmed the in-repo `GITHUB_TOKEN` covers the same-owner case.)*

### Observability

- [ ] **OBS-01**: a whole-run publish/sync failure **fails loud** (workflow annotation + non-zero exit); ship a documented "how do I know the cache is working / detect sync degradation" signal

### Consumer Adoption Docs

- [ ] **DOCS-01**: **split** into a 5-minute default quickstart (Actions-cache CI-RW only) and a separate advanced guide (opt-in RO store / sync / cleanup)
- [ ] **DOCS-02**: config reference for every `resolve*` knob **and** the Nx client vars `NX_SELF_HOSTED_REMOTE_CACHE_SERVER` / `_ACCESS_TOKEN`; note Actions-cache 10 GB-repo LRU (monorepo thrash) and that the default composition has **no local read path**
- [ ] **DOCS-03**: trust/security section: events that write; CREEP posture; github.com-only backstop + **GHES floor**; **never enable fork-PR send-tokens/secrets**; **default-branch-protection** + ephemeral-single-tenant-runner prerequisites; coupled-`CACHE_MIRROR_MAX_AGE_DAYS`; read-only-local-by-design; **retention = storage-hygiene, not poison-containment**; mirrored keys are anonymously public; freshness-window + mid-session-staleness caveats; (GHCR) pull-by-digest + package-visibility publish step
- [ ] **DOCS-04**: a minimal **example adopter config** (example workflow/repo), distinct from this repo's maximal dogfood config
- [ ] **DOCS-05**: an **enumerated, tested public surface** (every consumer env knob, action input, package export) with a test that fails on unintended changes ("dogfood changes stay consumer-safe")
- [ ] **DOCS-06** (CI sidecar pattern): document running `serve` as a GitHub Actions **background step** (`background: true` + an explicit **`cancel:` teardown** — mandatory, because the runner's implicit `wait-all` before post-job cleanup would otherwise hang on the never-exiting server), Nx pointed at `NX_SELF_HOSTED_REMOTE_CACHE_SERVER=http://localhost:<port>`; with the plain `&` background-process **fallback for GHES / older runners** that lack the feature. Note the consumption Action is a **JS action** (a composite action cannot declare `background:` internally); the background-step / `&` pattern serves the token-based **Releases reader**, whereas the CI-RW **Actions-cache** backend must be launched from a JS action - a plain `run:`/background step's `@actions/cache` save/restore silently no-ops (git-history-confirmed; see PITFALLS.md)

### Governance

- [ ] **GOV-01**: **SECURITY.md** vulnerability-disclosure policy (required for a poisoning-class tool)
- [ ] **GOV-02**: LICENSE (MIT)
- [ ] **GOV-03**: a versioned **consumer-contract / semver** statement (what "breaking" means for the public surface)

## Later-Milestone Requirements

- **PROV-01**: optional reader-verified **asymmetric provenance attestation** (cosign keyless via OIDC) - never content signing, never HMAC; only clean on a GHCR/OCI backend. (One line by design; see ARCHITECTURE-DECISION.md C7.)
- **GHCR-01 (later-milestone revisit trigger, re-run the FOUND-01 ledger):** re-evaluate adding **GHCR/OCI as an additional synced store** (additive, not a switch - multi-store keeps Releases) when PROV-01 (cosign) **and** the Docker container form graduate together. Brings back the GHCR-conditional controls parked out of v0.0.1: pull-by-digest (C6), >5000 non-fatal handling (RETAIN-02/C10), the delete-credential/PAT + child-manifest cleanup surface (RETAIN-03-GHCR/C11/C13), the visibility fail-closed assert (TRUST-09/C18), and the best-effort no-overwrite variant (TRUST-07-GHCR).

## Deferred (not out of scope)

- Docker container distribution form (a later milestone) - its CI `services:` motivation is covered by the GA background-step pattern (`background`/`cancel`, DOCS-06) + the `&` fallback; residual niche is hermetic / non-Node CI. See ARCHITECTURE-DECISION.md (FOUND-03).
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

Derived from `.planning/ROADMAP.md` (per-requirement detail + coverage validation live there). Every v0.0.1 requirement maps to exactly one phase.

| Phase | Requirements |
|-------|--------------|
| 0 - Teardown | (prep - delivers none) |
| 1 - Walking Skeleton | SRV-01, SRV-02, SRV-03, SRV-04, SRV-05, TEST-07 |
| 2 - Default Cache in CI | TEST-01, TEST-02, ROBUST-03, ROBUST-04, TRUST-03, TRUST-05 |
| 3 - Cross-Context Read | FOUND-02, CORR-01, TEST-05 |
| 4 - Publish + Retention + Obs | TEST-03, TEST-04, TEST-06, ROBUST-01, ROBUST-02, ROBUST-05, TRUST-02, TRUST-07, RETAIN-01, RETAIN-03, OBS-01 |
| 5 - Trust-Widening + PPE | TRUST-01, TRUST-04, TRUST-06, TRUST-08 |
| 6 - Distribution + Docs + Gov | DOCS-01, DOCS-02, DOCS-03, DOCS-04, DOCS-05, DOCS-06, GOV-01, GOV-02, GOV-03 |
| LOCKED (grounding) | FOUND-01 (reader = Releases), FOUND-03 (npm + JS Action) |
| a later milestone / deferred | TRUST-09, RETAIN-02, PROV-01, GHCR-01 |

---
*Requirements defined: 2026-07-17*
*Last updated: 2026-07-18 - greenfield MVP/vertical rebuild locked: added SRV-01..05 (P1 server-security), re-scoped TEST-03/TRUST-04 forward, populated the phase traceability from ROADMAP.md (7 phases, standard granularity). Prior: 2026-07-17 - FOUND-01/03 LOCKED after the reader spike (`.planning/spikes/001-005`): FOUND-01 = GitHub Releases, FOUND-03 = Docker deferred to a later milestone. Releases-conditional bind (ROBUST-02/05, TRUST-07-Releases, RETAIN-03-Releases); GHCR-conditional -> a later milestone (GHCR-01: TRUST-07-GHCR/09, RETAIN-02/03-GHCR, C6/C10/C13/C18). New: ROBUST-04 (SIGTERM graceful shutdown), ROBUST-05 (1000-asset skip-and-warn), DOCS-06 (background-step CI pattern). Prior: 6-panel triage + Sonnet `/lz-security-review` + targeted research (TRUST-01 host-based fail-closed; TEST-07 hard `200`/Nx-21+). See ARCHITECTURE-DECISION.md.*
