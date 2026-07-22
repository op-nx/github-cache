# Roadmap: @op-nx/github-cache

**Core Value:** Correct and safe caching on GitHub infrastructure, for public and private
repos, with nothing extra to host. A remote cache must never serve a wrong or poisoned
artifact and must never let an untrusted trigger write; correctness and CREEP-safety come
before every other feature. If everything else fails, reads stay best-effort (a fault
degrades to a MISS, never a broken build) and writes stay gated.

Foundations are LOCKED (grounding, not phase work): reader = GitHub Releases (FOUND-01);
default composition = Actions-cache CI-RW only, one backend per process via `selectBackend`;
write-trust = host-detected fail-closed allowlist; sync gate = `{push, schedule}`; no content
signing; OS-namespacing; Nx PUT floor = hard `200`/Nx-21+; distribution = npm package + JS
Action, Docker deferred (FOUND-03). Decision record + CREEP control ledger C1-C18:
`.planning/ARCHITECTURE-DECISION.md`.

## Milestones

- ✅ **v0.0.1 Greenfield MVP Rebuild** — Phases 0-6 (shipped 2026-07-22) — full detail: [milestones/v0.0.1-ROADMAP.md](milestones/v0.0.1-ROADMAP.md)

## Phases

<details>
<summary>✅ v0.0.1 Greenfield MVP Rebuild (Phases 0-6) — SHIPPED 2026-07-22</summary>

- [x] **Phase 0: Teardown** — Strip the PoC + its cache-coupled CI; leave the Nx workspace green with a lean, cache-independent baseline CI. (5/5 plans, completed 2026-07-18)
- [x] **Phase 1: Walking Skeleton** — A new lib speaks the Nx self-hosted-cache HTTP contract E2E against a trivial in-process backend, proven by a conformance fixture. (4/4 plans, completed 2026-07-18)
- [x] **Phase 2: Default Cache in CI** — Actions-cache CI-RW backend + context-derived `selectBackend` + conservative write gate + per-hash lock, dogfooded live in this repo's CI. (6/6 plans, completed 2026-07-19)
- [x] **Phase 3: Cross-Context Read** — GitHub Releases read-only reader + authenticated private-repo local read + OS-namespacing, so a cross-OS hit never serves a wrong-OS artifact. (3/3 plans, completed 2026-07-19)
- [x] **Phase 4: Publish + Retention + Observability** — The `{push,schedule}`-gated publish/sync engine + safe age-based cleanup + fail-loud observability + storage-cap graceful degradation. (6/6 plans, completed 2026-07-20)
- [x] **Phase 5: Trust-Widening + PPE Gate** — Host-detected fail-closed `pull_request`/`release` write-trust + single-source allowlist + server-produced-key mirror filter + shipped PPE-hygiene gate. (4/4 plans, completed 2026-07-20)
- [x] **Phase 6: Distribution + Docs + Governance** — npm package + JS Action + background-step CI pattern + enumerated/tested public surface + adoption docs + SECURITY.md/LICENSE/semver. (5/5 plans, completed 2026-07-21)

Full phase detail, success criteria, traceability, and coverage validation archived to
[milestones/v0.0.1-ROADMAP.md](milestones/v0.0.1-ROADMAP.md). Requirements archived to
[milestones/v0.0.1-REQUIREMENTS.md](milestones/v0.0.1-REQUIREMENTS.md). Audit:
[milestones/v0.0.1-MILESTONE-AUDIT.md](milestones/v0.0.1-MILESTONE-AUDIT.md).

</details>

### 🚧 Next milestone (planning)

Run `/gsd:new-milestone` to define the next version. Later-milestone revisit triggers carried
out of v0.0.1: **GHCR-01** (GHCR/OCI as an additional synced store), **PROV-01** (cosign
keyless provenance), **FOUND-03** (Docker container distribution form) — re-evaluate together
per the FOUND-01 ledger.

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

---
*Roadmap collapsed at v0.0.1 milestone completion (2026-07-22). Full v0.0.1 detail archived to
`milestones/v0.0.1-ROADMAP.md`. Next milestone: `/gsd:new-milestone`.*
