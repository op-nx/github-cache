# @op-nx/github-cache - GitHub-backed Nx Remote Cache

## What This Is

An open-source, self-hosted Nx remote cache that stores task artifacts on GitHub-native
primitives instead of a dedicated cache service. It speaks Nx's self-hosted-cache HTTP
contract (`GET`/`PUT /v1/cache/{hash}`) as a loopback-only sidecar and picks its storage
backend from runtime context, so there is no mode flag a caller can get wrong. Today it uses
the **GitHub Actions cache** (read-write in trusted CI, or read-only via `CACHE_READ_ONLY`)
and a **read-only GitHub Release-asset mirror** (for local reads). It is meant for **other
projects to adopt** - across **both public and private** GitHub repositories - not only for
dogfooding in this repo.

**The store is OS-INVARIANT.** Since v0.0.2 an artifact carries no OS discriminator on either
layer: the `@actions/cache` version derives from one hardcoded forward-slash archive path with
`enableCrossOsArchive`, and the Releases mirror names every asset `nx-cache-<hash>`. Keeping a
genuinely OS-sensitive target separate is the CONSUMER's job, done in that target's declared Nx
inputs -- which is what `docs/cross-os.md` teaches, safe default first.

**Architecture + storage primitives decided.** `selectBackend` returns
**one backend per process, chosen by runtime context** (default: Actions-cache CI-RW only);
an opt-in reader/cross-context store and its publish/cleanup are a separate, reader-specific
step. Write-trust is an allowlist; the full CREEP control ledger is in
`.planning/THREAT-MODEL.md`. The reader adapter is **LOCKED = GitHub Releases** (FOUND-01
spike, forward merits) and the Docker container form is **deferred to a later milestone**
(FOUND-03); GHCR/OCI is the later-milestone revisit trigger (with cosign + Docker).

## Core Value

**Correct and safe caching on GitHub infrastructure, for public and private repos, with
nothing extra to host.** A remote cache must never serve a wrong or poisoned artifact and must
never let an untrusted trigger write - correctness and CREEP-safety come before every other
feature. If everything else fails, reads must stay best-effort (a fault degrades to a MISS,
never a broken build) and writes must stay gated.

## Current State

**Shipped: v0.0.2 OS-invariant cross-OS sharing (2026-08-11).** 7 phases (7-13), 45 plans, 110
tasks, 57/57 requirements, all phases verified `passed`. All four target outcomes were proven on
real runners in the mandated order:

- **O1** - local Windows dev HITs `build`/`typecheck`/`test` produced by Linux CI -- PROVEN
- **O2** - local Windows dev HITs `integration` produced by Windows CI -- PROVEN
- **O3** - Windows CI MISSES `integration` produced by Linux CI -- PROVEN as an Nx-hash property
- **O4** - Windows CI HITs `build`/`typecheck`/`test` produced by Linux CI -- PROVEN and GATED

The ordering constraint is now spent, not pending: O1's producer attribution was captured at the
last commit before anything rotated, and enabling O4 destroyed it permanently by design. The
evidence lives in `milestones/v0.0.2-phases/`.

**Next milestone: not yet scoped.** Start with `/gsd:new-milestone`, which authors a fresh
`REQUIREMENTS.md`. The carried-forward candidates are listed under `## Carried forward` in
`ROADMAP.md` -- GHCR-01, PROV-01, FOUND-03 (Docker), PKG-SPLIT, collapsing the publish matrix to
one leg (now unblocked by XOS-05), and nine deferred `/simplify` items.

## Requirements

### Validated

Shipped and verified in **v0.0.1 Greenfield MVP Rebuild** (all 7 phases verified `passed`,
6/6 E2E flows wired, all threats closed). Full per-requirement traceability:
`milestones/v0.0.1-REQUIREMENTS.md`.

- [OK] Nx self-hosted remote-cache HTTP server: loopback bind, timing-safe bearer auth, hash validation, 2 GB body cap, best-effort read degradation / fail-closed write (SRV-01..05) -- v0.0.1
- [OK] Runtime-context backend selection, one backend per process, no caller-facing mode flag (TRUST-05) -- v0.0.1
- [OK] Read-write Actions-cache backend in CI on trusted `{push,schedule}` events; per-hash lock; SIGTERM drain (ROBUST-04) -- v0.0.1
- [OK] Authenticated GitHub Releases read-only reader for cross-context/local read, private-repo-capable (FOUND-01/02); local `put()` always 403 -- v0.0.1
- [WARN] OS-namespaced store so a cross-OS hit never serves a wrong-OS artifact (CORR-01) -- v0.0.1, SUPERSEDED in v0.0.2 by CORR-02/D2-01 (the store is OS-invariant; discrimination moved to the consumer's declared Nx input)
- [OK] CREEP (CVE-2025-36852) write-trust: host-detected fail-closed allowlist + separate `{push,schedule}` sync gate + server-produced-key mirror filter (TRUST-01..08) -- v0.0.1
- [OK] `{push,schedule}`-gated publish/sync engine + fail-loud observability + ~2 GiB and 1000-asset graceful degradation (ROBUST-01/02/05, OBS-01) -- v0.0.1
- [OK] Age-based cleanup coupled to the read-lookback window via one `CACHE_MIRROR_MAX_AGE_DAYS` knob; daily single-writer scheduled cleanup (RETAIN-01/03) -- v0.0.1
- [OK] Shipped installable advisory PPE-hygiene gate (zizmor/actionlint) (TRUST-06) -- v0.0.1
- [OK] Cross-OS content-hash parity (`.gitattributes` `eol=lf`; OS-discriminated hash) + per-OS publish-mirror matrix (TEST-05) -- v0.0.1
- [OK] Published npm package `@op-nx/github-cache` + `uses:`-consumable `start-cache-server` JS action + background-step CI sidecar pattern; enumerated/tested public surface; SECURITY.md/LICENSE/semver (DOCS-01..06, GOV-01..03, FOUND-03) -- v0.0.1

Shipped and verified in **v0.0.2 OS-invariant cross-OS sharing** (all 7 phases verified `passed`,
5/5 E2E flows wired, 9/9 integration seams). Full per-requirement traceability:
`milestones/v0.0.2-REQUIREMENTS.md`.

- [OK] ESLint 9 flat config + `lint` target; the ambient-platform-read ban is a build failure in unit specs and allowed in integration specs, with stale disable directives failing (LINT-01..06, CORR-06) -- v0.0.2
- [OK] Nx task-hash parity for `build`/`typecheck`/`test` across Windows and Linux, root-caused node by node before it was fixed, and kept that way by a build-gating two-leg CI job proven RED on real runner data (PARITY-01..08, CORR-03, CORR-04) -- v0.0.2
- [OK] The `@actions/cache` archive path is a deliberate OS-invariant constant, not an inherited `os.tmpdir()` value, with `enableCrossOsArchive` hardcoded at all three call sites (VER-01..07, ROBUST-04, OBS-04, DOCS-08) -- v0.0.2. Closed BEHAVIOURALLY: a `windows-11-arm` runner read back a Linux-produced entry and asserted the bytes were `'linux'`-produced (run `30400231720`)
- [OK] Releases mirror asset names carry no OS discriminator (`nx-cache-<hash>`), with the cleanup filter admitting the legacy family in the SAME commit so nothing silently stops pruning; `mirrored-by: <os>` preserves attribution in the free-form label, outside the lookup name (CORR-02, CORR-05, RETAIN-04/05, OBS-03, OBS-05, XOS-06/07, TRUST-10..13) -- v0.0.2
- [OK] Live cross-OS proofs O1-O4 in the mandated order, each with a named non-vacuity control and O1's producer attribution captured before O4 destroyed it (XOS-01..05, XOS-08, TEST-08..10, OBS-02) -- v0.0.2
- [OK] A read-only Actions-cache backend composed from the writable one, so cache-version drift is unrepresentable rather than guarded -- which is what makes the three Windows reuse legs' `[remote cache]` counts soundly gateable instead of launderable (VER-08/09, TRUST-14, XOS-09, TEST-11, DOCS-09/10) -- v0.0.2
- [OK] Consumer-facing cross-OS adoption recipe leading with the safe default, portability checklist second, drift-guarded and registered in `nx.json`'s `test` inputs (DOCS-07) -- v0.0.2

### Active

**Next milestone not yet scoped.** `/gsd:new-milestone` authors the fresh `REQUIREMENTS.md`.
Carried-forward candidates (re-evaluate together per the FOUND-01 ledger):

- [ ] **GHCR-01** -- GHCR/OCI as an additional synced store (additive; multi-store keeps Releases)
- [ ] **PROV-01** -- optional reader-verified cosign keyless provenance attestation
- [ ] **FOUND-03 (Docker)** -- Docker container distribution form (CI-sidecar motivation already covered by the background-step pattern)
- [ ] **PKG-SPLIT** -- package split, carried out of v0.0.1
- [ ] **Collapse the publish matrix to one leg** -- now unblocked: XOS-05 is proven, and under `max-parallel: 1` the Windows publish leg mirrors zero real assets (v0.0.2 Phase 10 SC6)
- [ ] **Nine `/simplify` items** deferred to v0.0.3 (`b6580ad`)
- [ ] **Archive file-mode handling across the OS boundary** -- unverified; an XOS-05 investigation item

(LRU via a manifest remains out of scope -- native Actions-cache LRU + age-only RO; see Key Decisions.)

### Out of Scope

- Hosted / managed cache service - GitHub-native storage only; the whole point is zero extra infrastructure to run
- Nx custom task runner API - deprecated; target only the current self-hosted-cache HTTP contract
- Streaming of large bodies - fully buffered up to 2 GB; revisit only if real workloads demand it
- Multi-tenant / persistent shared self-hosted runners - deployment assumes ephemeral single-tenant runners (predictable temp path + in-process lock are safe only there)
- Local read-write mode - by design local is read-only only; only CI may write. (`CACHE_READ_ONLY`, added v0.0.2, is the opposite direction: it strictly NARROWS a CI leg that would otherwise write. It is not a mode flag - it is `selectBackend`'s last branch, and every branch above it has already returned read-only or thrown.)
- A per-job or per-target OS-invariance knob (v0.0.2 D2-02) - no adopters, so no exit is needed yet; purely additive if that changes. NOT forbidden by TRUST-05, which is scoped to RW-vs-RO only
- Read-fallback across old and new Releases asset names - our own mirror repopulates on the next push, and the cleanup filter ages the legacy family out
- Adopter-migration signalling for the v0.0.2 rename (changelog, `v0` tag policy, version-bump signal, rotation notice) - zero adopters at the time; revisit the moment one exists
- Executor portability classification (not knowable a priori; residual risk recorded in TRUST-11) and an empirical divergence-detection subsystem (disproportionate - "green O4 CI is the evidence" is circular, since a restored task does not execute)

(The 1000-assets-per-release Release cap is now **in scope** as ROBUST-05, since FOUND-01 = Releases is locked - handled by month-sharding + skip-and-warn, no longer under reconsideration.)

## Context

- **Current state: v0.0.2 shipped (2026-08-11).** ~7,300 LOC of TypeScript source plus ~19,700 LOC of specs; 1,145 tests across 44 files green at close. v0.0.1 (the greenfield rebuild) shipped 2026-07-22 via PR #3; v0.0.2 added OS-invariance on both storage layers, the four live cross-OS proofs, the read-only Actions-cache backend, and `docs/cross-os.md`. `.planning/codebase/*` is PARTLY STALE against the shipped tree -- `INTEGRATIONS.md` still records four `selectBackend` outcomes where Phase 13 made five; regenerate with `/gsd:map-codebase`. The platform facts/gotchas in `.planning/research/PITFALLS.md` remain reference.
- **`lint` is a real gate, not a convention.** ESLint 9 flat config bans ambient platform reads (`process.platform`, `node:os` accessors, `path.sep`/`win32`/`posix`) in `**/*.spec.ts` while allowing them in `**/*.integration.spec.ts`. Opting out requires a described disable; stale disables fail. Because `@nx/eslint` is an INFERENCE plugin, touching its registration changes `hash_project_config` and therefore EVERY task hash.
- **Cross-OS hash parity is enforced every run**, not measured once: a build-gating two-leg CI job fails when fewer than two platform records exist, when the `integration` hashes match, or when any of `build`/`typecheck`/`test` differ. `targets.typecheck.outputs` was the single divergent node; `targetDefaults.typecheck.outputs` in `nx.json` is the fix and is comment-locked.
- **Ports-and-adapters** around a single `CacheBackend` port, with a thin HTTP protocol layer and side-effect-free pure domain modules (`shard`, `cleanup`, `trust`, `types`) for testability. The port isolates any future storage-primitive pivot to a new factory behind `selectBackend`.
- **Auth assumption:** because the platform is GitHub, local developer environments are assumed already authenticated to GitHub (git credential helper and/or `gh`). Requiring auth is free; depending on anonymous access is not (it excludes private repos).
- **Three credentials, never mixed:** per-process CSPRNG bearer token (Nx <-> server), `ACTIONS_RUNTIME_TOKEN` (Actions cache service, passed only by process inheritance into JS actions), and `GITHUB_TOKEN`/`GH_TOKEN` (gh/Octokit REST).
- **Known silent-failure history:** a cross-OS publish-mirror gap and a CRLF hash-divergence bug were both fixed; both failed silently. New work must not reopen them - `.gitattributes eol=lf` and the per-OS publish matrix are load-bearing. The OS-DISCRIMINATED HASH that was the third member of that set is gone as of v0.0.2; what replaced it as the wrong-result control is target platform-agnosticism, proven per target, NEVER publish-leg ordering.
- **`max-parallel: 1` on the publish matrix is NOT a correctness control** and is comment-locked as such. No requirement depends on which leg wins the first-write-wins race. Removing it is safe for correctness and would surface the differing-payload arbitration recorded in TRUST-11.
- **Retention is one coupled setting.** `CACHE_MIRROR_MAX_AGE_DAYS` drives both the read lookback and the cleanup window through shared `resolveMaxAgeDays`/`shardTagsForWindow`; never introduce a second knob.

### Key external references (fold into research / spike)

- Nx self-hosted caching usage notes: https://nx.dev/docs/guides/tasks--caching/self-hosted-caching#usage-notes
- Nx enterprise security: https://nx.dev/enterprise/security
- CVE-2025-36852 - critical cache-poisoning (CREEP): https://nx.dev/blog/cve-2025-36852-critical-cache-poisoning-vulnerability-creep
- GitHub read-only Actions cache for untrusted triggers (2026-06-26): https://github.blog/changelog/2026-06-26-read-only-actions-cache-for-untrusted-triggers/
- GitHub dependency-caching reference: https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching
- Nx self-hosted-cache packages (deprecated set): https://nx.dev/docs/reference/deprecated/self-hosted-cache-packages
- Nx deprecated custom task runner API: https://21.nx.dev/docs/reference/deprecated/custom-tasks-runner
- 1st-party prior art `@nx/azure-cache`: https://npmx.dev/package/@nx/azure-cache and https://21.nx.dev/docs/reference/remote-cache-plugins/azure-cache/overview
- 3rd-party prior art (older custom-task-runner era): https://github.com/NiklasPor/nx-remotecache-azure
- Exploring Nx self-hosted cache (community write-up): https://emilyxiong.medium.com/exploring-of-nx-self-hosted-cache-5bc39bd2ed7f

## Constraints

- **Tech stack**: TypeScript (strict, ESM, `module: nodenext`), Node 24 LTS, Nx 23, Vitest - relative imports carry `.js`; the two GitHub JS actions must be dependency-free CommonJS (they run before `npm ci`).
- **Nx contract**: the self-hosted-cache HTTP contract is an OpenAPI 3.0.0 spec embedded in the Nx docs source with no standalone artifact, and the Nx 21+ floor is HARD - the Nx client (`HttpRemoteCache`) matches PUT success strictly as `200`, so a `202`-returning server breaks it - which is why the conformance fixture pins a named Nx version and hashes the full vendored spec rather than watching `info.version`; the endpoint/status table, the `202`->`200` drift and the reason `info.version` cannot detect it live in `.planning/research/STACK.md` section 1.
- **Platform**: GitHub-native only - candidate storage primitives under verification (Actions cache, Release assets, ghcr.io/OCI, GitHub Packages, git-native), via `@actions/cache`, `@octokit/rest`, the `gh` CLI, and/or git; no hosted deployment; runs as a loopback sidecar.
- **Auth / repo scope**: local environments are assumed authenticated to GitHub; the design MUST work for private repositories and MUST NOT depend on anonymous/public access. Anonymous read is an optional OSS-only convenience.
- **Security**: writes gated to trusted trigger events; server binds `127.0.0.1` only; GitHub's server-side read-only cache token (since 2026-06-26) is the load-bearing CREEP control, the in-code gate is defense-in-depth (env is fork-spoofable).
- **Compatibility**: cross-OS content-hash parity is load-bearing (`.gitattributes eol=lf`); `@actions/cache` version-hashes the literal archive-path string, so `cacheArchivePath()` must stay the single source of truth - and since v0.0.2 that string is a hardcoded workspace-relative forward-slash literal under `.nx/cache/`, byte-identical on every OS. It must never be rebuilt with `node:path`, absolutized, or derived from `os.tmpdir()`/`RUNNER_TEMP`/`~`, and must not change without re-verifying an end-to-end cross-OS restore.
- **Distribution**: consumable via Docker containers + npm packages (local & CI) and GitHub Actions (CI); minimal setup for external adopters; changes made for this repo's own CI/hashing must never leak into the consumer contract.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| **One backend per process, context-selected** (`selectBackend`); default = Actions-cache CI-RW only; opt-in reader store + its publish/cleanup are a separate reader-specific step | Matches the ecosystem norm; minimal default, pay-as-you-compose; the publisher/cleanup subsystem is reader-specific (not port-isolated) | [OK] Decided - the project-level CREEP control ledger C1-C18 backing this and every other trust decision is `.planning/THREAT-MODEL.md`; re-read and reconcile it at each milestone Key Decisions audit (updated 2026-07-26) |
| Reader / cross-context adapter: **GitHub Releases** (v0.0.1) | Forward merits (FOUND-01 spike): fewer incident/operational hazards + no public poison-remediation gap (vs GHCR's >5000 wall, child-manifest, delete-cred, visibility); reversible/additive. GHCR = later-milestone trigger with cosign + Docker | [OK] LOCKED (FOUND-01) |
| **Write-trust = allowlist-only** (default-deny; no denylist); `pull_request`/`release` on **only where GitHub's untrusted-default-branch cache guard exists -- host-detected from `GITHUB_SERVER_URL`** (`github.com`/`*.ghe.com` -> ON; all GHES -> OFF, fail-closed; no caller flag) | In-code gate is fork-spoofable defense-in-depth; the host-based check is a pure env-var function; no GA GHES has the guard yet (floor unpublished) | [OK] Decided |
| **Sync gate = a separate predicate = `{push, schedule}` only**, test-locked to reject all other events + non-default refs | Syncing a PR- or dispatch-influenced entry into a shared store recreates the CREEP precondition | [OK] Decided (load-bearing) |
| **Shipped installable PPE-hygiene gate** (best-effort/advisory) + default-branch-protection prerequisite | Heuristic linters can't catch novel evasions, so the load-bearing containment is the `{push,schedule}` sync gate + branch protection; the gate is defense-in-depth | [OK] Decided |
| **No content signing as a CREEP control**; digest-pin iff GHCR | CVE-2025-36852: poison precedes hashing, so signing is ineffective; CREEP is defended at the write/sync gates | [OK] Decided |
| Retention: native Actions LRU (CI tier) + age-only (RO tier); **no LRU manifest** | A manifest adds mutable retention state (security-negative); GHCR exposes no last-accessed signal | [OK] Decided |
| **OS-namespace the store by default** (or documented consumer OS-discrimination) | Cross-OS cache hit must never serve a wrong-OS artifact (Core Value: never a wrong result) | [WARN] SUPERSEDED in v0.0.2 - switched to the second branch (see below) |
| Runtime-context backend selection instead of a mode flag | No caller can misconfigure read-write vs read-only | [OK] Good |
| Publish/cleanup I/O uses Octokit (`error.status`) from the start, never `gh` stderr text-matching | `gh` gives no structured errors for already-exists/404 and is version-fragile; Octokit discriminates structurally | [OK] Decided (greenfield - no gh-CLI to migrate from) |
| **v0.0.2: take CORR-01's SECOND branch** - the store is OS-INVARIANT and OS discrimination lives only in the consumer's declared Nx input | The CORR-01 row above sanctions both branches ("or documented consumer OS-discrimination"); the first cost a Windows dev every cross-OS hit. Ecosystem norm is trust-the-hash (`nx-remotecache-custom` keys on `hash + ".tar.gz"`, no OS component) | [OK] Good - shipped v0.0.2; all four O1-O4 outcomes proven live, no wrong-result incident |
| **v0.0.2: the `@actions/cache` archive path becomes a deliberate OS-invariant constant**, not an inherited `os.tmpdir()` value | `tmpdir()` in the version-hashed path was ACCIDENTAL correctness - it also silently over-partitions on any runner with a different `TMPDIR`, username, or container, costing hits invisibly. Upstream docs forbid absolute paths cross-OS | [OK] Good - shipped v0.0.2, closed BEHAVIOURALLY (a `windows-11-arm` runner read back a Linux-written entry, run `30400231720`) |
| **v0.0.2: no OS-separation knob** | YAGNI - this repo is the only consumer, and the knob is additive if that changes. NOTE: TRUST-05 does NOT forbid it; TRUST-05 is scoped to RW-vs-RO only, and an earlier draft mis-cited it | [OK] Good - held through the whole milestone; the public-surface guard passed unchanged |
| **v0.0.2: Releases asset name is `nx-cache-<hash>`** (prefix, single-sourced from `CACHE_KEY_PREFIX`) | Satisfies C16's "distinguishing namespace/prefix" literally; a suffix accept-list on a DELETE filter would grow per scheme revision | [OK] Good - shipped v0.0.2; `CACHE_KEY_PREFIX` now governs FOUR things and is comment-locked, since changing it would orphan the entire mirror |
| **v0.0.2: cross-OS sharing rests on target platform-agnosticism, NEVER on publish-leg ordering** | An ordering-based argument (ubuntu-first wins the first-write-wins race) was proposed and REJECTED as brittle: it would rest a wrong-result guarantee on CI job scheduling - a third accidental-correctness dependency in a milestone whose premise is removing two | [OK] Good - load-bearing; `max-parallel: 1` survives only as a comment-locked non-control |
| **v0.0.2: the `test`-agnostic / `integration`-OS-specific split is enforced by lint**, not documentation | The strategy already existed (`ci.yml:336-337`) but three spec files silently violated it. This repo has no linter today, so ESLint 9 flat config is adopted as its own phase; intentional opt-outs require a described disable annotation and stale disables fail | [OK] Good - shipped v0.0.2; the rule was proven to CATCH all four extant violations before any was removed |
| **v0.0.2: the read-only Actions-cache backend COMPOSES the writable one** (`{ ...createReadOnlyActionsCacheBackend(), put }`), never a copy-paste second implementation or a construction-time flag | Two Actions-cache backends means two places for the cache-version computation to drift - this milestone's own root cause, behind a guard that looks like coverage. Composition makes drift unrepresentable rather than guarded; exactly one `cache.restoreCache` READ call site survives. The flag variant was rejected on TRUST-05 (RW-vs-RO is which factory constructs the backend, never a caller-facing mode) | [OK] Good - shipped v0.0.2; the "shrink to a documented decision" hatch was live and NOT taken |
| **v0.0.2: a cross-OS reuse gate must be UNLAUNDERABLE, not merely present** | A writable Windows leg that MISSes will execute and SAVE its own entry, so a re-run HITs that self-produced entry and takes a `count >= 1` check green with cross-OS reuse still dead. A gate a re-run can launder is worse than no gate, because it reads as coverage | [OK] Good - the read-only backend removes the confound structurally; soundness is INDUCTIVE, and the `needs:` edge stays the separate LIVENESS argument |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? -> Move to Out of Scope with reason
2. Requirements validated? -> Move to Validated with phase reference
3. New requirements emerged? -> Add to Active
4. Decisions to log? -> Add to Key Decisions
5. "What This Is" still accurate? -> Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check - still the right priority?
3. Audit Out of Scope - reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-08-11 after the v0.0.2 milestone (OS-invariant cross-OS sharing) completed and
was archived. Shipped 7 phases (7-13) / 45 plans / 110 tasks / 57 requirements over 20 days and 664
commits: the ESLint toolchain with the ambient-platform-read ban (LINT-01..06, CORR-06), Nx
task-hash parity root-caused to one node and gated every run (PARITY-01..08, CORR-03/04), the
OS-invariant `@actions/cache` version (VER-01..07, ROBUST-04, OBS-04, DOCS-08), the OS-invariant
`nx-cache-<hash>` Releases mirror with `mirrored-by` attribution and its auditor-classified trust
delta (CORR-02/05, RETAIN-04/05, OBS-03/05, XOS-06/07, TRUST-10..13), the four live cross-OS proofs
O1-O4 in the mandated order (XOS-01..05, XOS-08, TEST-08..10, OBS-02), the read-only Actions-cache
backend that makes the Windows reuse gate unlaunderable (VER-08/09, TRUST-14, XOS-09, TEST-11,
DOCS-09/10), and the safe-by-default consumer recipe `docs/cross-os.md` (DOCS-07). Milestone audit
status `tech_debt` with 0 requirement/integration/flow gaps; see milestones/v0.0.2-*. Tagged
v0.0.2. Prior update: 2026-07-29 after Phase 9 (OS-Invariant Actions-Cache Version) complete -- 8 plans, all 11 requirements closed, verification/security/validation all `passed`. v0.0.2 is 3 of 6 phases done (7, 8, 9); Phase 10 (OS-Invariant Releases Mirror) is next. Two live-CI items remain `human_needed` at the real merge: `publish-verify (windows-11-arm)` green with a `'linux'` producer line, and OBS-04's rotation signal is SPENT (sampled on run `30400231720`; a later merge shows all-HIT, so read `09-EVIDENCE.md`'s ADDENDUM, not the merge run). Prior update: 2026-07-26 at v0.0.2 milestone start - see the Current Milestone section and REQUIREMENTS.md. Prior update: 2026-07-22 after v0.0.1 milestone (Greenfield MVP Rebuild) complete. Shipped 7 phases / 33 plans: the Nx self-hosted-cache HTTP server (SRV-01..05), Actions-cache CI-RW backend + context-derived `selectBackend` (TRUST-05, ROBUST-04), authenticated GitHub Releases reader with OS-namespacing (FOUND-01/02, CORR-01), `{push,schedule}`-gated publish/cleanup + coupled retention + fail-loud observability (TRUST-02, RETAIN-01/03, ROBUST-01/02/05, OBS-01), host-detected trust-widening + server-produced-key filter + advisory PPE gate (TRUST-01/06/08), and npm package + `start-cache-server` JS action + docs/governance (DOCS-01..06, GOV-01..03). Merged via PR #3, tagged v0.0.1. Milestone audit passed (6/6 E2E flows wired, all threats closed). Later-milestone triggers: GHCR-01, PROV-01, FOUND-03 (Docker). See milestones/v0.0.1-* and THREAT-MODEL.md.*
