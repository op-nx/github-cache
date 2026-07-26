# Architecture Decision Record: CREEP-Safety Control Ledger

**Status:** Accepted. This file holds the project-level CREEP-safety control register (C1-C18)
and the handful of notes that have no canonical home anywhere else. Nothing else.
**Date:** Controls recorded 2026-07-17; slimmed to the ledger 2026-07-26.
**Scope:** Project-wide. These controls apply across every phase and every milestone, not to one
phase's threat model.

## Where the rest of this record went

This file used to restate decisions that other artifacts own. It no longer does. Each of those
artifacts is the single source of truth for its own half:

- `.planning/PROJECT.md` `## Key Decisions` - every locked architecture and trust decision, with
  its rationale and its current status, supersessions included. That status is exactly what a
  second copy here kept getting wrong.
- `.planning/PROJECT.md` `## Constraints` - the Nx self-hosted-cache HTTP contract and the hard
  Nx version floor.
- `.planning/research/STACK.md` section 1 - the same contract in detail: the endpoint and status
  table, the PUT `202` to `200` drift between Nx 20 and Nx 21, and why watching `info.version`
  cannot detect it.
- `.planning/spikes/001-005` - the FOUND-01 reader-adapter evidence and its verdict.
- `.planning/research/*` - the source corpus behind all of the above.

## Review cadence

Audited every milestone. The `## Key Decisions` row in `.planning/PROJECT.md` that points here is
covered by the hardcoded Key Decisions audit that `/gsd:complete-milestone` runs, so this ledger
gets re-read and reconciled on the same schedule as the decisions it backs. The coupling is
deliberate: the previous arrangement scheduled no review at all, and this file drifted out of
agreement with PROJECT.md without anything noticing.

## Why the ledger has no canonical GSD home

GSD models security strictly per phase - a `<threat_model>` block in each PLAN.md and a per-phase
SECURITY.md - and provides no project-level control register. Fragmenting these controls into
per-phase threat models would orphan the cross-cutting ones: C1 applies to every future phase, so
it cannot live in any single phase's SECURITY.md. `PROJECT.md ## Constraints` is the wrong shape,
because constraints are limits and controls are mitigations.

GSD's own artifact taxonomy sanctions the alternative: a project-scoped Standing Reference
Artifact at the `.planning/` root, the same category as GSD's own METHODOLOGY.md. That is the
category this file belongs to.

One consequence, recorded so it is not re-litigated: this file trips `gsd health` W019
("unrecognized `.planning/` file"). It tripped W019 before the slimming, it still trips it after,
and GSD's own METHODOLOGY.md trips it too. W019's remediation text - move it to an archive
directory or delete it if stale - does not apply here, and renaming the file would not clear the
warning either. Do not act on W019.

## Control ledger

CVE-2025-36852 (CVSS 9.4, CWE-829, GHSA-rrr2-jcr8-7q3x, no patched version): poison at **construction, before hashing**; **first-to-cache-wins**; any PR-privileged contributor. Fix = write-scope isolation aligned to VCS trust; **signing/integrity is ineffective** against it. Controls scale with composition — the default (Actions-cache CI-RW only) carries only C1 + C4 + docs.

| # | Control |
|---|---------|
| C1 | Write-trust allowlist (default-deny); `pull_request`/`release` on **only where GitHub's untrusted-default-branch cache guard exists — detected from `GITHUB_SERVER_URL` (`github.com`/`*.ghe.com` → ON; all GHES → OFF, fail-closed; no caller flag)**; dangerous set refused by construction |
| C2 | Sync gate = separate predicate = `{push, schedule}` only; test-locked to reject all other events + non-default refs |
| C3 | No-overwrite/409 per adapter — **contract-mandated**, CREEP value **conditional on C1/C2** (not standalone). Actions cache native; **GHCR has no atomic create-if-absent (confirmed absent from the OCI spec and GHCR) → best-effort check-then-write**, which is low-severity: same-hash trusted writes are byte-identical under CORR-01 (idempotent overwrite), and an untrusted overwrite is C2's job, not atomicity's. Reinforced by pull-by-digest (C6) |
| C4 | Repo-wide PPE hygiene: a **shipped installable gate** (reusable workflow / composite action) running `zizmor`/`actionlint` for named patterns (no `pull_request_target`+PR-checkout; no `issue_comment`/`workflow_run` executing PR code). **Best-effort/advisory** — heuristic linters cannot verify novel/obfuscated evasions, so it is NOT load-bearing; containment is **C2 (untrusted writers kept out of the shared store) + default-branch protection** |
| C5 | No content signing for CREEP (ineffective — trusted producer signs poisoned bytes) |
| C6 | Pull-by-digest mandatory iff GHCR; the `{hash}→digest` map is **designed out** (tag == hash) or its single writer + concurrency pinned — never a mutable shared index |
| C7 | Deferred (a later milestone): asymmetric provenance attestation (cosign keyless), reader-verified — never HMAC |
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

## Residual notes

Kept here because the criterion for this file is "keep only what has no canonical home", and
these do not have one. Each was probed at claim level against the live tree before the rest of
the record was deleted.

- **Deferred by YAGNI, not designed out.** The one-backend-per-process port defers
  `multiple simultaneous stores` and `synchronous write fan-out` until a real consumer needs
  them. Neither is rejected; both are simply unbuilt.
- **GHES anti-spoofing cross-check (recorded, unbuilt).** The host-based write-trust gate can be
  cross-checked against the absence of an `installed_version` field on `/meta`, plus the
  `X-GitHub-Enterprise-Version` response header, which together catch a spoofed
  `GITHUB_SERVER_URL`. The matching version-gate knob stays dormant and OFF until GitHub
  publishes a GHES floor that carries the read-only-cache guard.
- **Read-time integrity for the reader (optional, unbuilt).** The defense-in-depth equivalent of
  a registry digest pin is to publish a `content-sha256` in the asset metadata and verify it on
  read. It is explicitly NOT `sha256(blob) == {hash}`: the Nx key hashes task INPUTS, not the
  stored bytes, so that comparison could never hold. It defends nothing against CREEP (C5).
- **Why two storage primitives were rejected outright.** git-native storage (a cache branch or
  LFS) is out for clone bloat and the absence of clean eviction; Actions build artifacts are out
  because they are not `content-keyed` - they are run-scoped. (Both rejections are also recorded,
  with the same reasons, in `.planning/research/STACK.md` section 2's primitive-comparison table,
  which is the fuller treatment.)
- **Scope check on the reader choice.** Choosing Releases over GHCR is `orthogonal` to CREEP: the
  primary threat is defended at the write and sync gates (C1/C2/C5) whichever reader is in use.
  The win is in incident remediation, not in poison prevention - which is also why the choice is
  low-stakes and reversible.
- **Inherited protection in the Nx client.** The Nx client hardens tarball extraction against
  `..`, absolute-path, symlink and `hardlink` escape, so a malicious cache server cannot
  `zip-slip` the client. This project inherits that protection rather than implementing it. It is
  worth a note in the consumer trust docs; that note has not been written.
- **Residual risk: containment is `single-layer`.** CREEP containment rests on the write and sync
  gates plus the advisory PPE gate. The only genuine second layer would be reader-side provenance
  attestation (C7), which is deferred. Gate correctness is therefore load-bearing with
  `no backstop`.

## References

CVE-2025-36852 / GHSA-rrr2-jcr8-7q3x / NVD (CVSS 9.4, CWE-829); Nx blog + HeroDevs `nx.app/files/cve-2025-06`; Nx self-hosted caching + the 2026-06-26 read-only-cache changelog; GitHub dependency-caching (scope isolation); CodeQL cache-poisoning; Adnan Khan "Cacheract"; Wiz PPE; OCI distribution spec (tag mutability); GHCR has no immutable tags; sccache/bazel-remote/Turborepo; `nixcite/nixcache-oci`. Full corpus: `.planning/research/*`.

---
*Controls recorded 2026-07-17. Rev after an independent Sonnet `/lz-security-review`: C1 fail-closed detection; C4 PPE gate advisory; C11 in-repo-GHCR preference; C16 sequenced before the private mirror; C18 visibility assert. Rev after targeted research: C1 detection is host-based (`GITHUB_SERVER_URL` github.com / `*.ghe.com` -> ON, all GHES -> OFF; GHES floor unpublished) and the backstop is a default-branch-poisoning guard, not a PR/release read-only; C3 GHCR no-overwrite is best-effort (atomic create-if-absent confirmed unavailable) - low-severity, C2-covered. Rev after the FOUND-01 spike (`.planning/spikes/001-005`): the GHCR-conditional controls C6/C10/C11/C13/C18 move to the later-milestone GHCR revisit trigger. Slimmed 2026-07-26 to the ledger plus the notes that have no canonical home; where the extracted material went is listed at the top of this file.*
