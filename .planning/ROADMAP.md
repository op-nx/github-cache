# Roadmap: @op-nx/github-cache

**Core Value:** Correct and safe caching on GitHub infrastructure, for public and private
repos, with nothing extra to host. A remote cache must never serve a wrong or poisoned
artifact and must never let an untrusted trigger write; correctness and CREEP-safety come
before every other feature. If everything else fails, reads stay best-effort (a fault
degrades to a MISS, never a broken build) and writes stay gated.

Foundations are LOCKED (grounding, not phase work): reader = GitHub Releases (FOUND-01);
default composition = Actions-cache CI-RW only, one backend per process via `selectBackend`;
write-trust = host-detected fail-closed allowlist; sync gate = `{push, schedule}`; no content
signing; Nx PUT floor = hard `200`/Nx-21+; distribution = npm package + JS Action, Docker
deferred (FOUND-03). Those locked decisions live in the `## Key Decisions` table in
`.planning/PROJECT.md`; the CREEP control ledger C1-C18 that backs them is
`.planning/THREAT-MODEL.md`.

**One locked decision was superseded in v0.0.2.** CORR-01 was an either/or -- "OS-namespace the
store by default OR document consumer OS-discrimination". v0.0.1 took the first branch; v0.0.2
took the second (D2-01). The store is now OS-INVARIANT and OS discrimination lives exclusively in
the declared Nx input on `integration`. Recorded in `PROJECT.md` `## Key Decisions`; the full
reasoning is archived in [milestones/v0.0.2-ROADMAP.md](milestones/v0.0.2-ROADMAP.md).

## Milestones

- [x] **v0.0.1 Greenfield MVP Rebuild** -- Phases 0-6 (shipped 2026-07-22) -- full detail: [milestones/v0.0.1-ROADMAP.md](milestones/v0.0.1-ROADMAP.md)
- [x] **v0.0.2 OS-invariant cross-OS sharing** -- Phases 7-13 (shipped 2026-08-11) -- full detail: [milestones/v0.0.2-ROADMAP.md](milestones/v0.0.2-ROADMAP.md)

## Phases

<details>
<summary>v0.0.1 Greenfield MVP Rebuild (Phases 0-6) -- SHIPPED 2026-07-22</summary>

- [x] **Phase 0: Teardown** -- Strip the PoC + its cache-coupled CI; leave the Nx workspace green with a lean, cache-independent baseline CI. (5/5 plans, completed 2026-07-18)
- [x] **Phase 1: Walking Skeleton** -- A new lib speaks the Nx self-hosted-cache HTTP contract E2E against a trivial in-process backend, proven by a conformance fixture. (4/4 plans, completed 2026-07-18)
- [x] **Phase 2: Default Cache in CI** -- Actions-cache CI-RW backend + context-derived `selectBackend` + conservative write gate + per-hash lock, dogfooded live in this repo's CI. (6/6 plans, completed 2026-07-19)
- [x] **Phase 3: Cross-Context Read** -- GitHub Releases read-only reader + authenticated private-repo local read + OS-namespacing, so a cross-OS hit never serves a wrong-OS artifact. (3/3 plans, completed 2026-07-19)
- [x] **Phase 4: Publish + Retention + Observability** -- The `{push,schedule}`-gated publish/sync engine + safe age-based cleanup + fail-loud observability + storage-cap graceful degradation. (6/6 plans, completed 2026-07-20)
- [x] **Phase 5: Trust-Widening + PPE Gate** -- Host-detected fail-closed `pull_request`/`release` write-trust + single-source allowlist + server-produced-key mirror filter + shipped PPE-hygiene gate. (4/4 plans, completed 2026-07-20)
- [x] **Phase 6: Distribution + Docs + Governance** -- npm package + JS Action + background-step CI pattern + enumerated/tested public surface + adoption docs + SECURITY.md/LICENSE/semver. (5/5 plans, completed 2026-07-21)

Full phase detail, success criteria, traceability, and coverage validation archived to
[milestones/v0.0.1-ROADMAP.md](milestones/v0.0.1-ROADMAP.md). Requirements archived to
[milestones/v0.0.1-REQUIREMENTS.md](milestones/v0.0.1-REQUIREMENTS.md). Audit:
[milestones/v0.0.1-MILESTONE-AUDIT.md](milestones/v0.0.1-MILESTONE-AUDIT.md).

</details>

<details>
<summary>v0.0.2 OS-invariant cross-OS sharing (Phases 7-13) -- SHIPPED 2026-08-11</summary>

- [x] **Phase 7: Lint Toolchain and the Ambient-Platform-Read Ban** -- Adopt ESLint 9 flat config and a `lint` target, then make "unit specs must not read the running machine" a build failure instead of a convention. (4/4 plans, completed 2026-07-27)
- [x] **Phase 8: Nx Task-Hash Parity** -- Root-cause the cross-OS hash divergence node by node, fix it, and keep `integration` the only target that diverges -- enforced by a build-gating CI measurement. (6/6 plans, completed 2026-07-28)
- [x] **Phase 9: OS-Invariant Actions-Cache Version** -- Make the `@actions/cache` version stop depending on the OS: one hardcoded forward-slash path plus `enableCrossOsArchive` at every call site, closed behaviourally by a Windows runner reading back a Linux-written entry. (8/8 plans, completed 2026-07-28)
- [x] **Phase 10: OS-Invariant Releases Mirror** -- One `nx-cache-<hash>` asset name with no OS component -- still prunable, still attributable, with the trust consequences classified rather than assumed. (8/8 plans, completed 2026-07-29)
- [x] **Phase 11: Live Proofs -- O1, O2, O3** -- Record the three live proofs in the mandated order, including the producer attribution that enabling O4 destroys forever. (7/7 plans, completed 2026-07-30)
- [x] **Phase 12: Windows CI Reuse (O4) + Consumer Recipe** -- Add the Windows `build`/`typecheck`/`test` legs, prove they HIT on Linux-produced entries, and ship the safe-by-default adoption recipe. (6/6 plans, completed 2026-07-31)
- [x] **Phase 13: Read-Only Actions-Cache Backend** -- Make "read the Actions cache, never write it" representable, so the three Windows reuse legs can be GATED on a genuine cross-OS HIT rather than recording a launderable one. (6/6 plans, completed 2026-08-02)

Full phase detail, success criteria, the O1-O4 acceptance frame with its mandatory ordering,
traceability and coverage validation archived to
[milestones/v0.0.2-ROADMAP.md](milestones/v0.0.2-ROADMAP.md). Requirements archived to
[milestones/v0.0.2-REQUIREMENTS.md](milestones/v0.0.2-REQUIREMENTS.md). Audit:
[milestones/v0.0.2-MILESTONE-AUDIT.md](milestones/v0.0.2-MILESTONE-AUDIT.md). Cross-phase
integration check: [milestones/v0.0.2-INTEGRATION-CHECK.md](milestones/v0.0.2-INTEGRATION-CHECK.md).

</details>

## Carried forward

Not picked up by a phase yet; re-evaluate together when the next milestone is scoped.

- **GHCR-01** -- GHCR/OCI as an additional synced store (additive; multi-store keeps Releases).
- **PROV-01** -- optional reader-verified cosign keyless provenance attestation.
- **FOUND-03 (Docker)** -- Docker container distribution form.
- **PKG-SPLIT** -- package split, carried out of v0.0.1.
- **Collapsing the publish matrix to one leg** -- only safe now that XOS-05 is proven; the Windows
  publish leg mirrors zero real assets under `max-parallel: 1` (v0.0.2 Phase 10 SC6).
- **Nine `/simplify` items** deferred to v0.0.3 (`b6580ad`).
- **Archive file-mode handling across the OS boundary** -- unverified; an XOS-05 investigation item.
- **Executor portability classification** and **an empirical divergence-detection subsystem** --
  both stay out of scope; residual risk is recorded in TRUST-11.

## Progress

| Phase | Milestone | Plans | Status | Completed |
|-------|-----------|-------|--------|-----------|
| 0. Teardown | v0.0.1 | 5/5 | Complete | 2026-07-18 |
| 1. Walking Skeleton | v0.0.1 | 4/4 | Complete | 2026-07-18 |
| 2. Default Cache in CI | v0.0.1 | 6/6 | Complete | 2026-07-19 |
| 3. Cross-Context Read | v0.0.1 | 3/3 | Complete | 2026-07-19 |
| 4. Publish + Retention + Observability | v0.0.1 | 6/6 | Complete | 2026-07-20 |
| 5. Trust-Widening + PPE Gate | v0.0.1 | 4/4 | Complete | 2026-07-20 |
| 6. Distribution + Docs + Governance | v0.0.1 | 5/5 | Complete | 2026-07-21 |
| 7. Lint Toolchain and the Ambient-Platform-Read Ban | v0.0.2 | 4/4 | Complete | 2026-07-27 |
| 8. Nx Task-Hash Parity | v0.0.2 | 6/6 | Complete | 2026-07-28 |
| 9. OS-Invariant Actions-Cache Version | v0.0.2 | 8/8 | Complete | 2026-07-28 |
| 10. OS-Invariant Releases Mirror | v0.0.2 | 8/8 | Complete | 2026-07-29 |
| 11. Live Proofs -- O1, O2, O3 | v0.0.2 | 7/7 | Complete | 2026-07-30 |
| 12. Windows CI Reuse (O4) + Consumer Recipe | v0.0.2 | 6/6 | Complete | 2026-07-31 |
| 13. Read-Only Actions-Cache Backend | v0.0.2 | 6/6 | Complete | 2026-08-02 |

---
*v0.0.2 closed 2026-08-11: 7 phases, 45 plans, 110 tasks, 57/57 requirements, all phases verified
`passed`. Phase numbering continues from here -- never restart at 01. Next milestone starts with
`/gsd:new-milestone`, which authors a fresh `REQUIREMENTS.md`.*
