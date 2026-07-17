# Architecture Decision Record: Storage Model & CREEP-Safety Posture

**Status:** Proposed — the reader/cross-context storage adapter (GHCR/OCI vs Releases) is pending an empirical spike; everything else is decided.
**Date:** 2026-07-17
**Scope:** Supersedes the rewound v1 roadmap. Grounds the re-derivation of REQUIREMENTS.md and ROADMAP.md.

## Context

`@op-nx/github-cache` is a self-hosted Nx remote cache built on GitHub-native primitives, meant for external adoption across **public and private** GitHub repos. It speaks Nx's self-hosted-cache HTTP contract as a loopback sidecar. The core threat is **cache poisoning (CREEP, CVE-2025-36852)**. This record is derived from: web research of the build-cache ecosystem (Bazel, Turborepo, Gradle, sccache, Nx Cloud) + GitHub/OCI-as-store prior art + the Nx remote-cache landscape; a full read of the CVE advisory (Nx blog, GHSA-rrr2-jcr8-7q3x, NVD, the HeroDevs technical analysis); and a four-decision security review.

## Nx contract (fixed constraint)

The current (Nx 20.8+/21+) self-hosted path is the **"Nx custom remote cache specification" v1.0.0**, expressed in **OpenAPI 3.0.0** (embedded as JSON in the Nx docs source; not published as a standalone artifact). It is a local HTTP server: `PUT /v1/cache/{hash}` → 200 / 401 / 403 / **409 (cannot override existing record)**, required `Content-Length`; `GET` → 200 / 403 / 404; single bearer token (server decides RO vs RW). The deprecated custom task-runner API and the `@nx/*-cache` Powerpack plugins are out of scope. Action: **vendor the spec JSON as a conformance fixture / test oracle** (Nx ships no standalone file); watch `info.version` for contract changes.

## Decision 1 — Architecture: pluggable multi-store, role/trust-composed

Behind the existing `CacheBackend` port (`exists`/`get`/`put`, keyed by Nx hash), compose stores by role and trust context:

- **Mandatory core:** one **CI read-write store**, active on *trusted* events. Default adapter: **GitHub Actions cache**.
- **Opt-in:** a **CI read-only store** (untrusted / non-allowlisted events, fork PRs); a **local-dev read-only store**.
- **Deferred (later milestone):** a local-dev read-write store; synchronous write fan-out.
- **Write-sync:** trusted writes propagate to configured stores via **async backfill** (out-of-band publish/sync step, off the CI write hot path; freshness window accepted → reads degrade to MISS).
- **Default composition = Actions-cache CI-RW only** (no sync, no RO store, no cleanup job). "Actions cache + GHCR reader, synced" and "unified GHCR" are opt-in presets, not the default.

Trust stays at the protocol/serve layer, never in the storage adapter. Retention/cleanup is a separate single-writer concern, not part of the port.

## Decision 2 — Write-trust = allowlist-only

A single write-trust policy: **an allowlist of events granted read-write; everything else read-only (default-deny). No denylist.**
- **Configured allowlist** (consumer-supplied) replaces the default; **default (implicit) allowlist** applies when unconfigured. Defining an allowlist and a denylist together is impossible (denylist does not exist).
- Default allowlist: `push`, `schedule`, `workflow_dispatch`, `repository_dispatch`, `delete`, `registry_package`, `page_build`, `merge_group`, **`pull_request`**, **`release`**.
- `pull_request`/`release` are safe to write-trust because GitHub **ref-scopes** their writes (PR → `refs/pull/N/merge`) to a scope the default branch cannot restore — safe *by scope*, not by trust.
- The dangerous shared-default-branch-scope events (`pull_request_target`, `issue_comment`, fork-`workflow_run`, and `discussion_comment`/`fork`/`watch`/future triggers) are refused by construction (allowlist). Completeness depends on staying an allowlist; a denylist would silently miss them.

## Decision 3 — Storage primitives

- **CI read-write adapter: GitHub Actions cache** — native LRU (7-day last-access + size cap), GitHub ref-scope isolation, server-side read-only-token backstop (2026-06-26). Structurally CI-only (`ACTIONS_RUNTIME_TOKEN` exists only in a workflow), which is why a separate reader store exists.
- **Reader / cross-context adapter: SPIKE-GATED — GHCR/OCI vs GitHub Releases.** Security reweighting (below) narrowed GHCR's earlier lead; the spike resolves it on the merits.
- **Out:** git-native (separate repo / orphan branch — documented ~6 GiB clone-bloat, no clean eviction) and GitHub Actions build artifacts (ID-addressed, retention-bounded, not content-keyed).

### Reader adapter reweighting (spike input)
| Factor | GHCR/OCI | Releases |
|--------|----------|----------|
| Per-key immutability | Tags mutable → **must app-enforce** no-overwrite; **pull-by-digest mandatory** | Assets first-write-wins (no `--clobber`) |
| Count cap | None | 1000 assets/release (sharding) |
| Multi-arch/OS | Distinct tags; untagged **child-manifest** cleanup burden | Distinct asset names; no manifests |
| Public age-cleanup | **>5000-download versions undeletable** (breaks mandatory age-cleanup for popular public caches; no count API) | **Sidesteps entirely** (assets aren't "packages") |
| Docker synergy | Native (GHCR is the container registry) | None |
| Cost (public/private) | Free public; private currently free (policy, 1-month-notice) | Free storage + un-metered download bandwidth |

Net: for the public-OSS priority audience, GHCR and Releases are roughly even on security/ops; GHCR wins where its no-count-cap + Docker synergy justify its added machinery. Reader choice deferred to the spike.

## Decision 4 — CREEP-safety control ledger

CVE-2025-36852: poison happens at **artifact construction, before hashing**; **first-to-cache-wins** race; low privilege (any PR-privileged contributor); no patched version (design-class). Exposure test: *"any system where PRs and main share the same cache is vulnerable."* Fix = write-scope isolation aligned to VCS trust; **integrity/signing/encryption are explicitly ineffective** against it.

| # | Control | Layer |
|---|---------|-------|
| C1 | Write-trust allowlist (default-deny; default includes `pull_request`/`release`, refuses the dangerous set by construction) | write |
| C2 | Narrow sync gate — only default-branch `push`/`schedule` entries sync to a shared/RO store; separate predicate from the write gate; test-locked to reject `pull_request`/`release` | sync |
| C3 | First-write-wins / no-overwrite (409) enforced per adapter; Actions cache native; GHCR via check-then-write + read-by-digest | write/store |
| C4 | Repo-wide PPE hygiene: no workflow runs untrusted code in default-branch context; enforced by a CI check (`zizmor`/`actionlint`) | repo-wide |
| C5 | No content signing for CREEP (ineffective — trusted producer signs poisoned bytes) | integrity |
| C6 | Pull-by-digest mandatory iff GHCR (no immutable tags); the `{hash}→digest` map's trust = C3 | integrity |
| C7 | Optional/deferred (v2): asymmetric provenance attestation (cosign keyless), reader-verified — never HMAC | integrity |
| C8 | Retention disposition: native Actions LRU + age-only RO + no manifest (removes mutable retention state) | retention |
| C9 | Delete path fails loud / skips on non-404 faults + partial listings (structural-404-only deletion) | cleanup |
| C10 | Non-fatal handling of the GHCR >5000-download delete refusal (log + continue) | cleanup |
| C11 | Cleanup credential = job-scoped `GITHUB_TOKEN` (`packages: write`), schedule-only, no untrusted checkout, never referenced in a PR workflow; not a fine-grained PAT (unsupported for GHCR); classic PAT (`read:packages`+`delete:packages`) only for cross-repo ownership | cleanup |
| C12 | First-party Octokit cleanup preferred over a third-party action (keeps the highest-privilege credential out of a dependency) | cleanup |
| C13 | Cleanup `concurrency:` group (queue, don't cancel) + fail-closed multi-arch child-manifest handling (GHCR only) | cleanup |
| C14 | Docs: github.com-only backstop + GHES version floor; warn adopters never to enable fork-PR "send write tokens"/"send secrets" policies | docs |
| C15 | Docs: retention is storage-hygiene, not poison-containment | docs |

**Controls scale with composition:** the mandatory core (Actions-cache CI-RW only) carries only C1 + C4 + docs; C3/C6/C9-C13 attach only when an opt-in RO store + sync + cleanup are enabled.

## Decision 5 — Retention / LRU

Age-based cleanup (`CACHE_MIRROR_MAX_AGE_DAYS`, one coupled setting) is the mandatory floor. LRU is served **natively on the Actions-cache CI tier**; the RO tier is **age-only**. A **stateful LRU manifest is out of scope** (security-negative — mutable shared retention state; and GHCR exposes no last-accessed signal). Retention is storage-hygiene, not a poison-containment or remediation path.

## Consequences & open items (spike)

- **Spike resolves:** reader adapter (GHCR vs Releases) on the reweighted rubric; GHCR check-then-write atomicity (is create-if-absent racy?), read-by-digest, untagged child-manifest cleanup, `GITHUB_TOKEN`-can-delete-GHCR durability (public preview); GHCR read/write latency + cost (public/private); the ~2 GB body path (ROBUST-02).
- **Distribution constraint:** the JS Action is mandatory for the Actions-cache CI-RW role (`ACTIONS_RUNTIME_TOKEN` is injected only into JS actions); the Docker container is clean only for the reader role.
- **Consumer responsibility (C4):** the cache's CREEP-safety in an adopter's repo depends on that repo's workflow hygiene — documented as a prerequisite; dogfooded here as a required CI check. Whether to ship a consumer-facing hygiene helper is an open scope question (lean: docs-only now).

## References

- CVE-2025-36852 / GHSA-rrr2-jcr8-7q3x / NVD `CVE-2025-36852` (CVSS v4.0 9.4, CWE-829); Nx blog `nx.dev/blog/cve-2025-36852-critical-cache-poisoning-vulnerability-creep`; HeroDevs analysis `nx.app/files/cve-2025-06`
- Nx self-hosted caching contract: `nx.dev/docs/guides/tasks--caching/self-hosted-caching`
- GitHub read-only Actions cache for untrusted triggers (2026-06-26): `github.blog/changelog/2026-06-26-read-only-actions-cache-for-untrusted-triggers/`
- GitHub dependency-caching (scope isolation): `docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching`
- CodeQL cache-poisoning queries; Adnan Khan "Cacheract"; Wiz GitHub Actions security; GitHub Security Lab "Preventing pwn requests"
- OCI distribution spec (tag mutability); GHCR has no immutable tags (`github.com/orgs/community/discussions/181783`)
- Turborepo signing; sigstore/cosign; sccache pluggable backends; bazel-remote; `nixcite/nixcache-oci`
- Full corpus: `.planning/research/{STACK,FEATURES,ARCHITECTURE,PITFALLS,SUMMARY}.md`

---
*Recorded: 2026-07-17*
