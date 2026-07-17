# Architecture Decision Record: Storage Model & CREEP-Safety Posture

**Status:** Proposed — the reader/cross-context storage adapter is pending an empirical spike; everything else is decided.
**Date:** 2026-07-17 (rev. after the D1-D4 security review + a 6-member advisor panel + triage)
**Scope:** Supersedes the rewound v1 roadmap. Grounds the re-derivation of REQUIREMENTS.md and ROADMAP.md.

## Framing: the current implementation is a spike / proof-of-concept

The shipped architecture, implementation, and delivery mechanism are a **spike/PoC** — a reference to learn from, **not** an asset to preserve. **Sunk cost is zero.** No decision here is justified by "it is already built/tested," and any component may be rebuilt. Consequently the reader-adapter choice is made on **forward merits only**, and known PoC hazards (e.g. the duplicated `TRUSTED_EVENTS` copies, the `gh`-CLI stderr coupling) are to be fixed at the **root** in the rebuild, not parity-patched.

## Nx contract (fixed constraint)

The current self-hosted path is the **"Nx custom remote cache specification"** expressed in **OpenAPI 3.0.0** (embedded as JSON in the Nx docs source; no standalone artifact). Local HTTP server: `PUT /v1/cache/{hash}` → success / 401 / 403 / **409 (cannot override existing record)**, required `Content-Length`; `GET` → 200 / 403 / 404; single bearer token (server decides RO vs RW). The deprecated custom task-runner API and `@nx/*-cache` Powerpack plugins are out of scope.

**Contract-drift caveat (verified):** the PUT success code changed **202 → 200 between Nx 20 and Nx 21 while `info.version` stayed `1.0.0`** — so watching `info.version` does **not** detect drift. The conformance fixture must **hash the full vendored spec** and **pin a named Nx version**. The server returns `200` (Nx 21 behavior); the declared floor is **Nx 21+** (a strict Nx 20.8 client expecting 202 is unsupported unless it accepts any 2xx — verify).

## Decision 1 — One backend per process, selected by context (not a composition framework)

`selectBackend(env)` returns **exactly one** `CacheBackend` per process, chosen by runtime context; there is **no** runtime composite/registry. The `CacheBackend` port is **`get`/`put`** (keyed by Nx hash); `put` returns `PutResult` and the `'conflict'`/409 path enforces no-overwrite at PUT (no `exists` verb). Write-sync to any second store is the **separate, out-of-band publish step** (today's `publish-mirror`), not a composition primitive.

- **Default:** Actions-cache CI-RW only — no sync, no second store, no cleanup job.
- **Opt-in (deploy-time configuration, not a per-call mode):** enabling a reader/cross-context store, and untrusted-CI/local reads from it. **RW-vs-RO stays fully context-derived** — no caller-facing flag a consumer can get wrong (a load-bearing CREEP property). "Enable store X" is config; "this request is RW" is never config.
- **Deferred (YAGNI until a real consumer needs them):** multiple simultaneous stores, synchronous write fan-out, a local read-write store.

**Publisher/retention seam (explicit):** only the serve-time **read** path is behind the `CacheBackend` port. The **publish + retention/cleanup subsystem is reader-specific and behind no port** — every reader choice requires building its own publish/cleanup; there is no symmetric publisher port unless a second reader is ever shipped. Do not assume the publisher is pluggable.

## Decision 2 — Write-trust = allowlist-only; sync gate is separate and minimal

- **Write-trust = an allowlist** (configured replaces default; else the default implicit allowlist); default-deny; **no denylist**. The dangerous shared-default-scope events (`pull_request_target`, `issue_comment`, fork-`workflow_run`, `discussion_comment`, `fork`, `watch`, …) are refused by construction.
- **`pull_request`/`release` are in the default allowlist ONLY when GitHub's server-side read-only-cache-token backstop is present.** Presence is decided by a **runtime-derived check** (github.com / Data Residency vs GHES below the enforcement floor) — **never an adopter/caller flag** (which would violate the no-mode-flag property). The check **fails closed**: on any uncertainty (undetectable, unknown GHES version, error) the widened events default **OFF**. The in-code allowlist is **defense-in-depth only** — fork-spoofable, no standalone value; GitHub's server-side ref-scoping is what actually refuses, so a detection that **failed open** would leave *no* real control (a direct CREEP path). (Nuance: `pull_request` scope isolation is activity-type-dependent — `[closed]` etc. run in the base scope with a read-only token; PR write *success* is activity-type-dependent, a blocked write is a benign 409/no-op.)
- **Sync gate = a separate, narrower predicate = literally `{push, schedule}`** on the default branch. It is **not** the write allowlist. Test-lock it to **reject** `pull_request`, `release`, `repository_dispatch`, `workflow_dispatch`, `merge_group`, `delete`, `registry_package`, `page_build`, and non-default refs — because `repository_dispatch`/`workflow_dispatch` carry attacker-influenced inputs into trusted default-branch code whose output would then be laundered into a shared store.

## Decision 3 — Storage primitives (reader spike-gated, forward-only)

- **CI read-write adapter: GitHub Actions cache** — native LRU + GitHub ref-scope isolation + server-side read-only-token backstop; structurally CI-only.
- **Reader / cross-context adapter: SPIKE-GATED — GHCR/OCI vs GitHub Releases**, decided on **forward merits only** (the "Releases is already built" argument is void per the Framing). With that removed, the two are ~even; the spike resolves it against a **symmetric operational ledger**:
  - *GHCR-side burden:* non-atomic no-overwrite under the per-OS publish matrix (**GO/NO-GO**: requires an atomic create-if-absent, else no-overwrite is best-effort and C2 is the only containment); mutable tags → pull-by-digest mandatory; untagged child-manifest cleanup; the **>5000-download-undeletable** wall (breaks age-cleanup *and* poison-remediation for popular public entries; no count API); cleanup credential often forces a classic PAT; "currently free" private tier is revocable on 1 month's notice.
  - *Releases-side burden:* **1000 assets/release** cap (sharding); **~2 GiB/asset** ceiling colliding with the 2 GB body cap (silent large-artifact failure).
  - *Shared rubric factors:* authenticated private keyed lookup; CI read/write performance; cost incl. free-tier durability; **cold-read API fan-out vs the 60/hr anon + 5000/hr auth limits**; ongoing **control-surface count**; per-primitive size ceiling; **remediation capability** for a poisoned entry; Docker-distribution synergy.
- **Out:** git-native (clone bloat, no clean eviction) and Actions build artifacts (not content-keyed).

## Decision 4 — CREEP-safety control ledger

CVE-2025-36852 (CVSS 9.4, CWE-829, GHSA-rrr2-jcr8-7q3x, no patched version): poison at **construction, before hashing**; **first-to-cache-wins**; any PR-privileged contributor. Fix = write-scope isolation aligned to VCS trust; **signing/integrity is ineffective** against it. Controls scale with composition — the default (Actions-cache CI-RW only) carries only C1 + C4 + docs.

| # | Control |
|---|---------|
| C1 | Write-trust allowlist (default-deny); `pull_request`/`release` included **only when the server-side backstop is present — via a runtime-derived, fail-closed check (default OFF on any uncertainty; never a caller flag)**; dangerous set refused by construction |
| C2 | Sync gate = separate predicate = `{push, schedule}` only; test-locked to reject all other events + non-default refs |
| C3 | No-overwrite/409 per adapter — **contract-mandated**, and its CREEP value is **conditional on C1/C2** (not standalone). Actions cache native; GHCR requires atomic create-if-absent (GO/NO-GO) |
| C4 | Repo-wide PPE hygiene: a **shipped installable gate** (reusable workflow / composite action) running `zizmor`/`actionlint` for named patterns (no `pull_request_target`+PR-checkout; no `issue_comment`/`workflow_run` executing PR code). **Best-effort/advisory** — heuristic linters cannot verify novel/obfuscated evasions, so it is NOT load-bearing; containment is **C2 (untrusted writers kept out of the shared store) + default-branch protection** |
| C5 | No content signing for CREEP (ineffective — trusted producer signs poisoned bytes) |
| C6 | Pull-by-digest mandatory iff GHCR; the `{hash}→digest` map is **designed out** (tag == hash) or its single writer + concurrency pinned — never a mutable shared index |
| C7 | Deferred (v2): asymmetric provenance attestation (cosign keyless), reader-verified — never HMAC |
| C8 | Retention: native Actions LRU + age-only RO + **no manifest** (no mutable retention state) |
| C9 | Cleanup delete path: **list phase aborts with zero deletions on any non-404 fault / incomplete pagination**; delete phase isolates per item |
| C10 | GHCR >5000-download refusal handled non-fatally; documented age-floor exception; recorded as a **poison-remediation gap** (weighs in Decision 3) |
| C11 | Cleanup credential: **prefer keeping GHCR in-repo so a job-scoped `GITHUB_TOKEN` suffices** (no long-lived PAT). Fine-grained PATs / GitHub App tokens are **unsupported for GHCR deletion**, so an org-owned/unlinked package forces a **classic PAT (`delete:packages`)** — gate it **behind an Actions Environment with required reviewers** and **document its org-wide-package-deletion blast radius** as an accepted trade-off. Never referenced in a PR-triggered workflow |
| C12 | First-party Octokit cleanup (the delete credential never enters a third-party action) |
| C13 | GHCR child-manifest cleanup gated on a reference check (fail-closed); reader degrades a missing/partial child to MISS, never truncated bytes |
| C14 | Docs: github.com-only backstop + GHES floor; **never enable fork-PR "send write tokens"/"send secrets"**; default-branch-protection + ephemeral-single-tenant-runner prerequisites |
| C15 | Docs: retention is storage-hygiene, **not** poison-containment |
| C16 | Mirror filter admits **only server-produced keys** (distinguishing namespace/prefix), not "any 1-512 hex" — **must ship before/with** enabling the mirror for any private repo (else unrelated hex-keyed CI artifacts leak); docs warn every mirrored key is world-readable |
| C17 | Observability: a whole-run sync/publish failure **fails loud** (annotation + non-zero exit); ship a "how do I know the cache is working" signal |
| C18 | (GHCR) Publish-time **package-visibility fail-closed assert**: the publish pipeline verifies package visibility matches the repo (private repo → private package) and **fails the run** on mismatch — not a docs-only step |

## Decision 5 — Retention / LRU

Age-based cleanup (`CACHE_MIRROR_MAX_AGE_DAYS`, one coupled setting) is the mandatory floor. LRU is native on the Actions-cache CI tier; the RO tier is age-only. A **stateful LRU manifest is out of scope** (security-negative + no GHCR last-accessed signal). On GHCR the age-floor has a documented exception for >5000-download entries (C10). The month-shard model + the "no second knob" invariant are **Releases-shaped and reader-conditional**, not universal.

## Decision 6 — Cross-OS correctness (Core Value)

The cache keys on the opaque Nx **input** hash; Nx does not include the runner OS by default. Serving a Linux-produced entry to a Windows reader is a **wrong result, not a MISS** — a Core-Value violation the CREEP controls do not cover. **Default to OS-namespacing the store** (or require the consumer to OS-discriminate non-portable outputs, documented). The reader-adapter spike must **round-trip both an OS-invariant and an OS-sensitive hash from each CI OS** through the chosen store.

## Consequences & spike scope

- **Spike (both readers' full operational + security ledger, symmetric):** GHCR atomic create-if-absent (GO/NO-GO), read-by-digest, child-manifest cleanup, cleanup-credential capability, cold-read fan-out vs rate limits; Releases per-asset ceiling vs body cap + 1000-asset behavior; the ~2 GB path (ROBUST-02); cross-OS round-trip (Decision 6).
- **Distribution:** the JS Action is mandatory for the Actions-cache CI-RW role. The **Docker container distribution form is deferred** until the reader adapter lands (its image can't be finalized before it); v1 ships npm + the JS Action.
- **Governance (project hygiene, required for a poisoning-class OSS tool):** SECURITY.md (vulnerability-disclosure policy), LICENSE, and a versioned consumer-contract / semver statement.
- **Residual:** CREEP containment is single-layer at the write/sync gates + the (heuristic) PPE gate; the only true second layer is reader-side provenance attestation (C7, deferred). Gate correctness is therefore load-bearing with no backstop.

## References

CVE-2025-36852 / GHSA-rrr2-jcr8-7q3x / NVD (CVSS 9.4, CWE-829); Nx blog + HeroDevs `nx.app/files/cve-2025-06`; Nx self-hosted caching + the 2026-06-26 read-only-cache changelog; GitHub dependency-caching (scope isolation); CodeQL cache-poisoning; Adnan Khan "Cacheract"; Wiz PPE; OCI distribution spec (tag mutability); GHCR has no immutable tags; sccache/bazel-remote/Turborepo; `nixcite/nixcache-oci`. Full corpus: `.planning/research/*`.

---
*Recorded: 2026-07-17. Rev after an independent Sonnet `/lz-security-review`: C1 capability-gate is runtime-derived + fail-closed; C4 PPE gate relabeled advisory (containment = C2 + branch protection); C11 prefers in-repo GHCR (fine-grained/App tokens unsupported for GHCR delete); C16 sequenced before private mirror; added C18 (publish-time visibility fail-closed assert).*
