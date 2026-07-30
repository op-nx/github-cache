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

**v0.0.2 supersedes one locked decision.** CORR-01 was an either/or -- "OS-namespace the store
by default OR document consumer OS-discrimination". v0.0.1 took the first branch. v0.0.2 takes
the second (D2-01): the store becomes OS-INVARIANT and OS discrimination lives exclusively in
the declared Nx input on `integration`. This is a design change to a shipped requirement, not a
bug fix.

## Milestones

- [x] **v0.0.1 Greenfield MVP Rebuild** -- Phases 0-6 (shipped 2026-07-22) -- full detail: [milestones/v0.0.1-ROADMAP.md](milestones/v0.0.1-ROADMAP.md)
- [ ] **v0.0.2 OS-invariant cross-OS sharing** -- Phases 7-12

## v0.0.2 framing

**Goal:** A Windows developer reuses Linux CI's portable task artifacts, and Windows CI reuses
them too, with the OS-sensitive target still provably separated. Proven by dogfooding this repo,
then documented as a recipe consumers can copy.

**Two independent layers.** O1/O2 are Releases-mirror outcomes; O3/O4 are Actions-cache
outcomes. Their independence is what makes the mandated ordering achievable at all.

| # | Outcome | Layer | Phase that proves it |
|---|---------|-------|----------------------|
| O1 | Local Windows dev HITs `build`/`typecheck`/`test` produced by Linux CI | Releases mirror | Phase 11 |
| O2 | Local Windows dev HITs `integration` produced by Windows CI | Releases mirror | Phase 11 |
| O3 | Windows CI MISSES `integration` produced by Linux CI | Actions cache | Phase 11 |
| O4 | Windows CI HITs `build`/`typecheck`/`test` produced by Linux CI | Actions cache | Phase 12 |

**Mandatory ordering, expressed as the Phase 11 -> Phase 12 boundary.** O1 must be PROVEN before
O4 is ENABLED. Windows CI today runs only `integration`, so any local Windows HIT on the other
three targets is unambiguously Linux-produced. Enabling O4 makes Windows CI a second producer of
those hashes and permanently destroys that attribution, so the evidence is captured at proof time
(TEST-08) and the two never share a phase.

**Live-CI-only work is called out per phase.** The v0.0.1 retrospective's top lesson is that
local gates cannot prove GitHub Actions runtime behaviour: three real distribution bugs passed
every local gate AND the verifier and took five live pushes to close. Phases 9-12 each carry a
`Live-CI close` line naming what can only be closed on a real runner, and a default-branch push
is a hard precondition of the Phase 11 proofs (the mirror must be warm under the new scheme).

**Granularity:** standard (6 phases). **Mode:** `mvp` is marked on the three phases that build
shippable capability (9, 10, 12); Phase 7 is toolchain adoption and Phase 8 is measurement and
configuration, so MVP slicing does not apply to them. Phase 11 is proof-LED but NOT proof-only --
the 2026-07-26 research found it carries real implementation (new `ci.yml` probe steps for the
re-specified O3 proof, and new task-graph assertion tooling for TEST-08), so MVP slicing still
does not apply but plan capacity must be allocated. TDD stays globally on
(`workflow.tdd_mode: true`).

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

### v0.0.2 OS-invariant cross-OS sharing

- [x] **Phase 7: Lint Toolchain and the Ambient-Platform-Read Ban** - Adopt ESLint 9 flat config and a `lint` target, then make "unit specs must not read the running machine" a build failure instead of a convention. (completed 2026-07-27)
- [x] **Phase 8: Nx Task-Hash Parity** - Root-cause the cross-OS hash divergence node by node, fix it, and keep `integration` the only target that diverges -- enforced by a build-gating CI measurement. (completed 2026-07-28)
- [x] **Phase 9: OS-Invariant Actions-Cache Version** - Make the `@actions/cache` version stop depending on the OS: one hardcoded forward-slash path plus `enableCrossOsArchive` at every call site, closed behaviourally by a Windows runner reading back a Linux-written entry. (completed 2026-07-28)
- [x] **Phase 10: OS-Invariant Releases Mirror** - One `nx-cache-<hash>` asset name with no OS component -- still prunable, still attributable, with the trust consequences classified rather than assumed. (completed 2026-07-29)
- [x] **Phase 11: Live Proofs -- O1, O2, O3** - Record the three live proofs in the mandated order, including the producer attribution that enabling O4 destroys forever. (completed 2026-07-30)
- [ ] **Phase 12: Windows CI Reuse (O4) + Consumer Recipe** - Add the Windows `build`/`typecheck`/`test` legs, prove they HIT on Linux-produced entries, and ship the safe-by-default adoption recipe.

## Phase Details

### Phase 7: Lint Toolchain and the Ambient-Platform-Read Ban

**Goal**: A developer who writes a unit spec that derives an expectation from the running
machine gets a build failure naming the rule, and cannot silence it without writing down why.

**Depends on**: Nothing (first phase of v0.0.2). It must come FIRST for a hashing reason, not a
tidiness one: `@nx/eslint` is an Nx INFERENCE plugin, so an inferred `lint` target changes
`hash_project_config`, which is folded into EVERY task hash. Adopting it after Phase 8's
root-cause work would invalidate that work -- and an OS-divergent lint inference would be a NEW
parity bug of exactly the `@nx/vitest` / `@nx/js/typescript` class Phase 8 exists to close.

**Requirements**: LINT-01, LINT-02, LINT-03, LINT-04, LINT-05, LINT-06, CORR-06.

**Success Criteria** (what must be TRUE):

  1. A `lint` target runs ESLint 9 flat config across the workspace and is part of the CI
     battery; every new dev dependency is exact-pinned under the existing ROBUST-03 discipline
     and covered by the `pinned-deps` guard. v9 is forced, not preferred -- Nx 23.1 dropped
     ESLint v8. (LINT-01)

  2. A unit spec that reads `process.platform`, `process.arch`, any `node:os` accessor
     (`tmpdir`, `EOL`, `platform`, `arch`, `homedir`, `type`, `release`), or
     `path.sep`/`path.delimiter`/`path.win32`/`path.posix` FAILS `lint`; the identical code in
     an `*.integration.spec.ts` PASSES, and an injected value such as
     `releaseAssetName(hash, 'win32')` PASSES everywhere. (LINT-02, CORR-06)

  3. The rule set is proven RED before GREEN: a deliberately violating fixture fails `lint`, and
     each of the three CORR-05 violations (`cache-archive-path.spec.ts`,
     `releases-backend.spec.ts`, `release-asset-name.spec.ts`) is confirmed CAUGHT while it
     still exists -- before Phase 9/10 remove it. (LINT-03)

  4. Editing a linted file re-runs `lint` instead of replaying a cached PASS, proven by
     differential rather than by reading the config -- the same defect class that let
     `typecheck` serve a stale false PASS (quick 260726-gok). (LINT-04)

  5. A bare `eslint-disable` and a bare `@ts-expect-error`/`@ts-ignore` are both lint ERRORS
     (description required), and a disable directive left behind after its violation is removed
     FAILS rather than lingering as a pre-authorised future violation. (LINT-05, LINT-06)

> SC3 correction, recorded so the verifier does not read it as a miss: SC3 above says "three
> CORR-05 violations". REQUIREMENTS.md, 07-CONTEXT.md D-22 and 07-RESEARCH.md all say FOUR, in
> three files (`release-asset-name.spec.ts` carries two). Use FOUR. There are four error
> POSITIONS; `cache-archive-path.spec.ts:26` is not one of them.

**Plans**: 4/4 plans complete

Plans:

- [x] 07-01-PLAN.md -- Adopt the toolchain: five exact-pinned devDeps, the root flat config, the
      D-12 baseline, the ESLint Node-API guard harness, and the `test.inputs` wiring (wave 1)

- [x] 07-02-PLAN.md -- The ban itself: RED before GREEN over the evasion shapes and the four extant
      sites, the two core rules, the four described disables, and the scope-drift guard (wave 2)

- [x] 07-03-PLAN.md -- Wire the target: `@nx/eslint` registration, the declared `lint` inputs, the
      input probes with their negative control, the root script and the CI job (wave 3)

- [x] 07-04-PLAN.md -- Evidence: the LINT-04 differential with both negative controls, mutations
      M1-M9, and the Phase 8 / Phase 9 hand-off records (wave 4)

### Phase 8: Nx Task-Hash Parity

**Goal**: `build`, `typecheck` and `test` compute one hash on every machine that matters, and
`integration` is the only target that diverges -- with a CI job that keeps it that way instead
of a measurement taken once.

**Depends on**: Phase 7 (LINT-01 must land before PARITY-01, or the inferred `lint` target
changes `hash_project_config` and invalidates the root-cause record).

**Requirements**: PARITY-01, PARITY-02, PARITY-03, PARITY-04, PARITY-05, PARITY-06, PARITY-07, CORR-03, CORR-04.
<!-- KEEP ON ONE LINE (see the note on Phase 10's Requirements line). -->

**Success Criteria** (what must be TRUE):

  1. A recorded root-cause document names, node by node, every hash input that differed, is dated
     BEFORE the first fix commit, and separates the TWO axes the 2026-07-26 pre-flight probe
     established (`research/v0.0.2/PROBE-RESULTS.md`): a real OS axis (cold-ubuntu differs from
     cold-windows for every target) and a FRESHNESS axis that perfectly masquerades as it (warm
     local Windows `build`/`test` equal cold ubuntu CI to the digit; cold local Windows equals cold
     windows CI to the digit). No difference may be attributed to the OS until freshness is pinned.
     The record states that every prior cross-OS measurement in this repo, including the pair in
     `STATE.md`, read a confounded variable. Leading hypothesis to test first: a Windows-only
     inference difference visible ONLY on a cold graph. (PARITY-01)

  2. The capture instrument emits the per-NODE hash `details` map. `nx show target inputs` is
     recorded as INSUFFICIENT and a "no difference" result from it is not accepted as evidence: it
     SKIPS `ProjectConfiguration` and reports file PATHS rather than content hashes, so both of
     v0.0.1's named suspects are invisible to it. (PARITY-02)

  3. For one commit, `build`, `typecheck` and `test` each yield a byte-identical hash at all THREE
     observation points -- native Windows workstation, windows-11-arm runner, ubuntu-24.04-arm
     runner -- with the workstation measured in BOTH graph states. FOUR recorded values per target,
     not two. (PARITY-03)

  4. "Does a warm local box compute the hash cold CI published" is answered as a SEPARATE named
     question, and each proof records which of the two questions it answers. If the answer is no,
     O1 is unreachable regardless of OS parity, and that is recorded as a finding rather than
     absorbed by a `nx reset` in the proof recipe. (PARITY-04)

  5. `integration` yields a byte-identical hash between the native Windows workstation and
     windows-11-arm, and `integration` is the ONLY target declaring a platform discriminator in
     its Nx inputs. (PARITY-05, CORR-04)

  6. A build-gating CI job over BOTH matrix legs at one commit FAILS when fewer than two
     platform records exist, when the `integration` hashes match, or when any of
     `build`/`typecheck`/`test` differ -- recording the discriminator command's raw stdout AND
     stderr per leg. A textual assertion that `nx.json` contains the input does not satisfy
     this. It treats `lint` as a FOURTH target, since `@nx/eslint`'s inference is the newest and
     least-tested in the workspace. (CORR-03)

  7. Every recorded measurement carries the Nx version, the Node version, the install mode
     (`npm ci` vs `npm install`) AND the graph state (cold / warm `.nx/workspace-data`), and the
     public-surface guard passes unchanged -- no new env knob, no new action input, no new package
     export. `typecheck`'s third variance source (four distinct values across the four probe
     measurements) is either root-caused or explicitly recorded as open. (PARITY-06, PARITY-07)

**Plans**: 6/6 plans complete

Plans:

- [x] 08-01-PLAN.md -- The instrument: a root-level dev-only ESM capture script proven byte-identical
      to Nx's own arithmetic, and the root-cause record opened with its method sections (wave 1)

- [x] 08-02-PLAN.md -- The comparator: a pure typed verdict over two platform records with an
      observed RED per clause, its CI loader, and the tarball exclusion with its assertion (wave 2)

- [x] 08-03-PLAN.md -- Measure: the two-leg capture job, the anchor commit, and all FOUR observation
      points at that one commit plus the `typecheck` outputs enumeration (wave 3)

- [x] 08-04-PLAN.md -- Record: the root cause named node by node and the fix route written down
      BEFORE it is taken, in commits that provably predate every `nx.json` edit (wave 4)

- [x] 08-05-PLAN.md -- Fix: the `nx.json` `targetDefaults` change with its rationale pinned in the
      drift guard, a three-state local plus two-leg CI re-measurement, and U-01 closed by the
      maintainer (wave 5)

- [x] 08-06-PLAN.md -- Gate: the build-gating compare job, and the proof it can fail on a REAL leg
      rather than only on a fixture (wave 6)

> Correction carried into the plans, recorded so the verifier does not read it as drift: SC1 above
> and PARITY-01 both call the second axis a FRESHNESS axis. RESEARCH measured that cold and warm
> agree when `.nx/workspace-data` is FRESH -- only the long-lived directory differs -- so the axis
> is staleness-of-persisted-inference, and `nx reset` is its cure rather than a control. Plan 08-01
> records the correction with the quoted original.

**Live-CI close**: PARITY-03's windows-11-arm and ubuntu-24.04-arm observation points and
CORR-03's two-leg job exist only on real runners. Note the probe already supplied one cold
cross-OS reading at `fe25a3f` (`research/v0.0.2/PROBE-RESULTS.md` Q3); Phase 8 must re-take it at
its own commit rather than cite it as current.

### Phase 9: OS-Invariant Actions-Cache Version

**Mode:** mvp

**Goal**: The `@actions/cache` version stops depending on which OS computed it -- one hardcoded
forward-slash path literal and `enableCrossOsArchive: true` at every call site -- proven by a
Windows runner reading back an entry a Linux runner wrote.

**Depends on**: Phase 8 (the hash-parity work and its measurement job settle before the cache
version is rotated, so a rotation MISS is never confused with a parity MISS).

**Requirements**: PARITY-08, VER-01, VER-02, VER-03, VER-04, VER-05, VER-06, VER-07, ROBUST-04, OBS-04, DOCS-08.
<!-- KEEP ON ONE LINE (see the note on Phase 10's Requirements line). -->

**Success Criteria** (what must be TRUE):

  1. The path string handed to `@actions/cache` is a hardcoded, workspace-relative,
     forward-slash literal under `.nx/cache/`, byte-identical on `win32` and `linux`. It is not
     built with `node:path` (`join`/`resolve`/`sep`/`normalize`), not absolutized, and derives
     from neither `os.tmpdir()`, `RUNNER_TEMP` nor `~`. The process asserts, ONCE at
     `createActionsCacheBackend()` construction, the CONJUNCTION that cwd is the Nx workspace root
     AND `GITHUB_WORKSPACE` is unset or resolves case-normalised to the same path -- "the Nx
     workspace root" alone is the wrong variable, because `@actions/cache` reads
     `GITHUB_WORKSPACE`, and a per-request check would be swallowed by `handleGet` into another
     silent MISS. MEASURED 2026-07-26: the identity holds on both runners today, so this is a drift
     guard, not a live fix. (VER-01, VER-02, VER-04)

  1b. The archive directory is created before the first `writeFile` (`put()` otherwise ENOENTs into
     a 500 on a fresh runner or after `nx reset`), and the literal's comment lock states it was
     chosen because the path is GITIGNORED -- `.gitignore` covers `.nx/cache`, not `.nx/`
     wholesale, so a later tidy elsewhere under `.nx/` would put a transient multi-megabyte file
     into Nx's own file map. (VER-07)

  1c. `{workspaceRoot}/.github/workflows/ci.yml` is a `test` input and `nx.json`'s explicit input
     list is comment-locked, recording that `targetDefaults` inputs REPLACE rather than merge and
     that `@nx/vitest`'s inferred `test` target carries `{ env: 'CI' }` -- which would make O1
     structurally impossible for `test`. This lands BEFORE any spec asserts on `ci.yml`.
     (PARITY-08)

  1d. `npm run build:action` runs in the SAME COMMIT as every `serve()`-reachable source edit in
     this phase. The committed bundle inlines both comment-locked helpers, and the four sidecar
     jobs run that bundle from the git ref -- drift means the sidecar writes at one cache version
     while publish restores at another, and the mirror silently stops receiving. (ROBUST-04)

  2. A spec asserts the argument LIST and the call COUNT of all three `@actions/cache` call
     sites -- `restoreCache`, `saveCache`, and the `lookupOnly` existence probe -- so a fourth
     site added later fails. The flag is positional at a different index in each function and
     upstream's JSDoc documents the wrong order, so position is asserted, not assumed. (VER-03)

  3. A `dogfood-verify` leg on windows-11-arm READS BACK the entry `dogfood-seed` wrote on
     ubuntu-24.04-arm, and a MISS fails the job. It asserts PROVENANCE, not presence: the seed key
     is `nx-cache-<GITHUB_RUN_ID>`, one key per RUN and not per OS, so the moment a Windows seed leg
     exists a presence-only check would pass even if cross-OS restore were completely broken.
     `dogfoodBody` encodes the producing OS and the Windows leg asserts it read a LINUX-produced
     body; the vacuity condition is written into the job comment. (VER-06)

  4. The publish summary reports the resolved `@actions/cache` compression method, surfaced and
     never gated. The value is NOT readable from the library (`getCompressionMethod` is behind the
     exports map), so it is an independent re-implementation that mirrors upstream exactly --
     stdout AND stderr captured, a throw swallowed to `''`, and the branch on `=== ''` rather than
     on the parsed semver -- comment-locked to the pinned version. MEASURED 2026-07-26: zstd v1.5.7
     and GNU tar 1.35 are present on windows-11-arm, so O4 is NOT blocked; but zstd lives at
     `C:\tools\zstd` and is NOT bundled by Git for Windows as previously recorded, making its
     presence a runner-image choice rather than a guarantee. (VER-05)

  5. The all-restore-MISS warning drops the now-false "different OS" explanation and names
     cache-version rotation as a candidate cause; the expected signal of the first post-change
     push (all-miss on both publish legs, `mirrored == 0`) is written down IN ADVANCE, and the
     tripwire fires on two consecutive all-miss pushes WITH NO VERSION-AFFECTING CHANGE IN BETWEEN
     -- there are three legitimate rotation windows in this milestone, and a tripwire that fires on
     correct work gets disabled. FOUR locations asserting same-OS restore are corrected:
     `docs/advanced.md:54-57`, `docs/advanced.md:45`, `ci.yml:577-583` and `ci.yml:356-360`.
     `README.md:125` and `docs/trust-and-security.md:155` get an ADDITIVE precondition, not a
     correction -- both frame "never a wrong result" as a consequence of fault degradation, which
     stays true. (OBS-04, DOCS-08)

**Plans**: 8/8 plans complete

- [x] 09-08-PLAN.md

- [x] 09-01-PLAN.md
- [x] 09-02-PLAN.md
- [x] 09-03-PLAN.md
- [x] 09-04-PLAN.md
- [x] 09-05-PLAN.md
- [x] 09-06-PLAN.md
- [x] 09-07-PLAN.md

**Live-CI close**: VER-06's cross-OS `dogfood-seed`/`dogfood-verify` pair and OBS-04's one-time
rotation signal are only observable on a real runner and a real default-branch push.

### Phase 10: OS-Invariant Releases Mirror

**Mode:** mvp

**Goal**: One asset name per hash with no OS component -- still prunable, still attributable to
its producer, and with the trust consequences of collapsing two namespaces into one classified
by an auditor rather than assumed away.

**Depends on**: Phase 9 (the Actions-cache version is already OS-invariant, so the exposure
delta TRUST-12 records -- a single-OS publish leg restoring and mirroring every OS's entries --
is real and verifiable in code at audit time, not hypothetical). Also Phase 7, whose lint rule
must be proven to CATCH the three CORR-05 violations before this phase removes the last two.

**Requirements**: CORR-02, CORR-05, RETAIN-04, RETAIN-05, OBS-03, OBS-05, XOS-06, XOS-07, TRUST-10, TRUST-11, TRUST-12, TRUST-13.
<!-- KEEP ON ONE LINE. gsd-tools parses `**Requirements**:` up to the first newline, so a wrapped
     line silently drops every ID on the continuation. Measured: Phase 8 lost CORR-03/CORR-04,
     Phase 9 lost OBS-04/DOCS-08, and this line lost all four TRUST-1x IDs until unwrapped. -->

**Success Criteria** (what must be TRUE):

  1. Every mirrored asset is named `nx-cache-<hash>` -- a distinguishing prefix with no OS
     component -- derived by BOTH reader and publisher from the single `releaseAssetName`
     helper; and the cleanup filter admits BOTH that name and the legacy `<hash>-<os>` names in
     the SAME COMMIT, so legacy assets age out through `CACHE_MIRROR_MAX_AGE_DAYS` instead of
     accumulating. Proven by specs over both name families plus a cleanup dry-run over a mixed
     shard. `CACHE_OS_VALUES` survives, annotated as intentionally-kept legacy support so
     `fallow` does not prune it. (CORR-02, RETAIN-04)

  1b. The two accept branches are asserted MUTUALLY EXCLUSIVE directly rather than relying on the
     last-`-` split; the ~50 PoC-era `<hash>.tar.gz` assets that match NO filter -- permanent
     occupants of the 1000-asset cap -- get an explicit recorded disposition; and
     `CACHE_KEY_PREFIX` is pinned by spec and comment-locked as now governing FOUR things (the
     Actions-cache key, `isServerProducedKey`, the asset name, and the cleanup filter), since
     changing it would orphan the entire mirror and RETAIN-04's legacy branch would not cover the
     orphans. (RETAIN-05)

  2. No target shared cross-OS has a spec that derives an expectation from the RUNNING machine.
     There are FOUR violation sites, not three -- `cache-archive-path.spec.ts:1` and `:26` (gone in
     Phase 9 with VER-02), `releases-backend.spec.ts:38` and `release-asset-name.spec.ts:39` (gone
     here with CORR-02), and `release-asset-name.spec.ts:60`, which NOTHING in this milestone
     removes because OBS-03 keeps `cachePlatform` alive. This phase makes an explicit call on site
     4; recommended is moving it to `public-server.integration.spec.ts`, where LINT-02 allows it.
     `releases-backend.spec.ts:103-118` is the DOCUMENTED non-vacuity proof for CORR-01 and CORR-02
     destroys it on purpose, so a named replacement lands with it: assert the reader requested
     EXACTLY ONE asset name, equal to the imported `releaseAssetName(hash)`, carrying no platform
     token. (CORR-05)

  3. Each `publish` matrix leg seeds a leg-DISTINGUISHABLE hash and each `publish-verify` leg
     reads back its OWN leg's asset -- so a Windows publish path that is entirely dead FAILS
     instead of passing on the ubuntu leg's asset; and `publish` waits on every job producing a
     mirrored entry (`build`, `typecheck`, `test`, `integration`), not on `build` alone. (OBS-05,
     XOS-07)

  4. Every mirrored asset records `mirrored-by: <os>` in Release asset metadata that is NOT part
     of the lookup name (the free-form `label`), so collapsing the namespace does not also destroy
     incident-response attribution. It is `mirrored-by`, NOT "producing OS": the label can only
     derive from the PUBLISHING leg's platform, `listCacheEntries` returns `{ key }` only, and
     Phase 9 is precisely what breaks the publisher-equals-producer identity -- so a
     "producing OS" claim would be wrong in exactly the cross-OS case the label exists to serve.
     Requires widening `uploadReleaseAsset` with a `label` parameter through `action/index.ts` and
     every fake in `publish-mirror.spec.ts`. (OBS-03)

  5. `max-parallel: 1` is RETAINED with a comment recording that it is NOT a correctness control
     and that no requirement depends on which leg wins the first-write-wins race; C1/C2 and
     C16's Actions-cache-side filter are verified unchanged, `listCacheEntries`' `ref` scoping is
     pinned by spec and comment-locked as the now-sole control keeping non-default-branch
     trusted writes out of the world-readable mirror; and SECURITY.md carries
     gsd-security-auditor's classification of TRUST-11 and TRUST-12 -- authored by the auditor,
     never self-certified. TRUST-11 is handed to that auditor with its arbitration point CORRECTED:
     the differing-payload race is at `saveCache`, not at the Release upload, because two publish
     legs restore the SAME single Actions-cache entry and upload it verbatim without re-executing;
     the race only appears once Phase 12 adds a second producer, which moves TRUST-11's residual
     risk into the XOS-05 write decision. `publish-mirror.ts:159`'s "byte-identical under CORR-01"
     comment is rewritten in this same commit -- byte-identity survives, its REASON changes.
     (XOS-06, TRUST-10, TRUST-11, TRUST-12, TRUST-13)

  6. Recorded, not gated: after this phase the Windows publish leg mirrors ZERO real assets
     (ubuntu runs first under `max-parallel: 1` and wins every name), which is the strongest
     argument for the deferred single-leg collapse -- write it down so v0.0.3 does not re-derive
     it. Also record that the Phase 9-to-10 window doubles shard growth, since every hash is
     mirrored under both `-linux` and `-windows` until the rename lands: bounded, NOT a correctness
     bug, and the existing "~5 assets per push" estimate in `ci.yml` reads about double during it.

**Plans**: 8/8 plans complete

- [x] 10-01-PLAN.md
- [x] 10-02-PLAN.md
- [x] 10-03-PLAN.md
- [x] 10-04-PLAN.md
- [x] 10-05-PLAN.md
- [x] 10-06-PLAN.md
- [x] 10-07-PLAN.md
- [x] 10-08-PLAN.md

- [x] `10-01-PLAN.md` - capture the two perishable pre-rename measurements (D-25 XOS-02 baseline, D-08 census)
- [ ] `10-02-PLAN.md` - the `mirrored-by` label seam, engine through real Octokit adapter (OBS-03)
- [ ] `10-03-PLAN.md` - widen `publish`'s `needs:`, add the repo's first `needs:` value guard (XOS-07)
- [ ] `10-04-PLAN.md` - the per-leg seed helper and the `mirror-seed` operation branch (OBS-05)
- [ ] `10-05-PLAN.md` - flip the seed and reader atomically, add the `mirrored-by` read-back control, lock `max-parallel: 1` (OBS-05, XOS-06)
- [ ] `10-06-PLAN.md` - the ADD-only assertion-level RED for the rename wave (CORR-02, CORR-05, RETAIN-04/05)
- [ ] `10-07-PLAN.md` - THE ONE COMMIT: OS-free name, two-branch filter, prose sweep, rebuilt bundle (CORR-02, CORR-05, RETAIN-04/05)
- [ ] `10-08-PLAN.md` - pin the `ref` scoping, hand TRUST-11/12 to the auditor, record SC6 (TRUST-10..13)

**Live-CI close**: a default-branch push must republish the mirror under the new name before the
Phase 11 proofs can run. Expect the first such push to publish nothing if it coincides with
Phase 9's rotation window (OBS-04).

**Pre-condition owed to Phase 11**: XOS-02 requires an O2 baseline measured BEFORE the CORR-02
rename lands. Capture it (or cite the existing pre-rename record in
`quick/260725-w3s-.../260725-w3s-STEP0-RESULTS.md`, which logged a local Windows `[remote cache]`
HIT on `integration` from a Windows-CI-produced asset on 2026-07-26) before the rename plan
executes. Once the rename lands the baseline is unrecoverable.

### Phase 11: Live Proofs -- O1, O2, O3

**Goal**: Three of the four target outcomes are proven live and recorded with defined evidence,
including the producer attribution that Phase 12 destroys permanently.

**Depends on**: Phase 10 (CORR-02 enables the cross-OS read; a default-branch push must have
republished the mirror under the new name) and Phase 9 (VER-01/VER-03 must have landed, or the
O3 MISS is attributable to the removed `@actions/cache` OS salt rather than to the Nx
discriminator).

**Requirements**: XOS-01, XOS-02, XOS-03, TEST-08, TEST-09, TEST-10, OBS-02.

**Success Criteria** (what must be TRUE):

  1. Starting from a cleared local Nx cache (`nx reset`), a native Windows workstation logs a
     non-zero count of tasks carrying the literal `[remote cache]` label for `build`,
     `typecheck` AND `test`, named per target, against artifacts Linux CI produced. A HIT
     recorded without a preceding reset is not accepted -- a local cache hit short-circuits
     before the remote is ever queried. (XOS-01, TEST-10, OBS-02)

  2. The same local Windows run HITs `integration` from a Windows-CI-produced artifact, compared
     against the pre-rename baseline as a non-regression. (XOS-02)

  3. The O1 evidence captures PRODUCER ATTRIBUTION at proof time -- per hit hash, the
     Actions-cache entry list and the shard asset list with `created_at`, cross-referenced
     against job windows -- and the premise that Windows CI produces no
     `build`/`typecheck`/`test` hash is asserted MECHANICALLY against the resolved Nx task
     graph, not assumed from the job list. Each proof records the workflow run URL or captured
     terminal output, the Nx hash observed, and the literal `[remote cache]` label. (TEST-08)

  4. O3 is proven as an Nx-HASH property, NOT as a storage probe: (a) Phase 8's CORR-03(b) record
     showing `H_linux != H_win` for `integration` is cited, not re-derived; (b) the Windows
     `integration` task is shown to have EXECUTED, carrying no `[remote cache]` label, in a run
     where `nx-cache-<H_linux>` demonstrably existed in the Actions cache; (c) a POSITIVE CONTROL
     in the same job -- a scripted authed GET on a known-present key returns 200 through the same
     sidecar and backend. A storage-level probe for the Linux hash would now HIT and is explicitly
     NOT the proof. A run that MISSes everything is not a valid proof. (XOS-03, TEST-09)

  5. A soundness probe precedes the measurement and is timestamped as such (a 401-vs-404 pair on a
     known-absent hash, plus a differential against a dead port); `ACTIONS_STEP_DEBUG` is on for
     the proving run; every "the job was green" claim is paired with a COUNT that would differ
     under the failure hypothesis, named in the plan rather than after the run; and each recorded
     `Cache: n/m hit` line is explicitly marked NON-DISCRIMINATING in both directions. (TEST-08,
     TEST-10, OBS-02)

**Plans**: 7/7 plans complete

- [x] 11-01-PLAN.md
- [x] 11-02-PLAN.md
- [x] 11-03-PLAN.md
- [x] 11-04-PLAN.md
- [x] 11-05-PLAN.md
- [x] 11-06-PLAN.md
- [x] 11-07-PLAN.md

- [ ] `11-01-PLAN.md` - hash-neutral instruments: the `capture-hashes.mjs` graph-premise mode and the `run.json` reader (TEST-08)
- [ ] `11-02-PLAN.md` - D-06 pre-flight: warm capture, the authorised `nx reset`, cold capture (XOS-01, XOS-02, TEST-10)
- [ ] `11-03-PLAN.md` - the O1/O2 local proof: soundness probe, the cold run, the per-target counts, `11-EVIDENCE.md` (XOS-01, XOS-02, TEST-10, OBS-02)
- [ ] `11-04-PLAN.md` - producer attribution per hit hash, and the pre-rotation sign-off (TEST-08)
- [ ] `11-05-PLAN.md` - RED: the `o3-witness` presence guard and the `ci.yml` comment lock (XOS-03, TEST-09)
- [ ] `11-06-PLAN.md` - GREEN: the `integration` probe steps and the `o3-witness` job (XOS-03, TEST-09)
- [ ] `11-07-PLAN.md` - the O3 proving run and the O3 evidence (XOS-03, TEST-09, TEST-08, OBS-02)

**Live-CI close**: the whole phase. Nothing here closes locally except the `nx reset`
precondition; O1/O2 need a warm mirror and a real workstation, O3 needs a real Windows runner.

**Scoping correction (2026-07-26 research)**: this phase is NOT proof-only. MVP slicing still does
not apply, but "no code" does not either -- SC 4(b)/(c) needs new `ci.yml` probe steps, and
TEST-08's mechanical task-graph assertion is new tooling. Allocate plan capacity for both.

### Phase 12: Windows CI Reuse (O4) + Consumer Recipe

**Mode:** mvp

**Goal**: Windows CI reuses Linux CI's portable artifacts, and an outside project can copy the
recipe without inheriting a wrong-result risk.

**Depends on**: Phase 11 (XOS-01 must be PROVEN first -- enabling O4 makes Windows CI a second
producer of the `build`/`typecheck`/`test` hashes and permanently destroys O1's attribution) and
Phase 8 (DOCS-07's portability checklist is derived from PARITY-01's root-cause findings, not
prejudged).

**Requirements**: XOS-04, XOS-05, XOS-08, DOCS-07.

**Success Criteria** (what must be TRUE):

  1. `ci.yml` runs `build`, `typecheck` and `test` on a windows-11-arm leg in addition to the
     ubuntu leg, and those legs declare `needs:` on the corresponding ubuntu jobs. The
     `integration` matrix is NOT the wiring precedent: its two legs compute DIFFERENT hashes, so
     parallelism is harmless, whereas the new legs compute the SAME hash and in parallel would both
     MISS, both execute, and race `saveCache`. The cross-push alternative is foreclosed too --
     once PARITY-08 lands, the very commit that adds these legs invalidates the `test` hash.
     (XOS-04, XOS-08)

  2. Those Windows legs log `[remote cache]` for all three targets against entries the ubuntu leg
     saved; whether they also WRITE is an explicit RECORDED decision, and if they write, the
     loss of clean Linux attribution is recorded alongside TRUST-11/12. (XOS-05)

  3. A consumer-facing cross-OS adoption recipe leads with the SAFE default: declare the platform
     discriminator across all cacheable targets FIRST, then remove it per target only after
     proving that target's output is portable. The portability checklist is the SECOND section,
     framed as how to EARN a removal, with items derived from Phase 8's root-cause record. It
     names architecture and libc as axes `process.platform` does not cover, and states that this
     repo cannot exercise them -- every machine here is arm64. (DOCS-07)

  4. The documented discriminator command is stderr-immune (`hash_runtime` hashes stdout AND
     stderr), and the recipe is registered in `nx.json`'s `test` inputs and guarded against
     drift, so it cannot rot silently. (DOCS-07)

**Plans**: 6 plans

Plans:
- [ ] `12-01-PLAN.md` - RED: the three Windows-leg shape guards and the detector-workflow guard, registered in the same commit (XOS-04, XOS-08, XOS-05)
- [ ] `12-02-PLAN.md` - GREEN: the three windows-11-arm legs, plus the four claims their existence falsifies (XOS-04, XOS-08, XOS-05)
- [ ] `12-03-PLAN.md` - the scheduled --skip-nx-cache Windows regression detector, and its command proven on Windows arm64 (XOS-05)
- [ ] `12-04-PLAN.md` - the single-sourced stderr-immune discriminator, and CORR-04's invariant superseded (DOCS-07)
- [ ] `12-05-PLAN.md` - DOCS-07: docs/cross-os.md, registered, linked and drift-guarded (DOCS-07)
- [ ] `12-06-PLAN.md` - the O4 pre-registration, the proof, and the O4 evidence appended to 11-EVIDENCE.md (XOS-05, XOS-04, XOS-08)

**Live-CI close**: XOS-05's HIT is only observable on a real windows-11-arm runner after a
ubuntu leg has saved the entries.

## Traceability

Every v0.0.2 requirement maps to exactly one phase.

| Requirement | Phase | Note |
|-------------|-------|------|
| LINT-01 | Phase 7 | ESLint 9 flat config + `lint` target in the CI battery; exact-pinned deps under ROBUST-03. FIRST because `@nx/eslint` inference changes `hash_project_config`. |
| LINT-02 | Phase 7 | `no-restricted-syntax` ban on ambient platform reads, scoped `files: ['**/*.spec.ts']` / `ignores: ['**/*.integration.spec.ts']`. |
| LINT-03 | Phase 7 | RED before GREEN: violating fixture + all three CORR-05 violations confirmed caught while they still exist. |
| LINT-04 | Phase 7 | `lint` Nx inputs declared so it cannot serve a stale-cache false PASS (the `typecheck` defect class). |
| LINT-05 | Phase 7 | Opt-out only via a described disable; bare `@ts-expect-error`/`@ts-ignore` also an error. |
| LINT-06 | Phase 7 | `reportUnusedDisableDirectives: error`; a stale disable fails rather than pre-authorising a future violation. |
| CORR-06 | Phase 7 | The strategy is MECHANICALLY enforced, not documented -- the guard IS the LINT-02 rule set. |
| PARITY-01 | Phase 8 | Node-by-node root-cause record, capture command named, dated before any fix. |
| PARITY-02 | Phase 8 | Byte-identical `build`/`typecheck`/`test` hash at all THREE observation points. |
| PARITY-03 | Phase 8 | Byte-identical `integration` hash between native Windows and windows-11-arm (O2's precondition). |
| PARITY-04 | Phase 8 | Every measurement records Nx version, Node version and install mode. |
| PARITY-05 | Phase 8 | Public-surface guard passes unchanged (D2-02: no new knob, input or export). |
| CORR-03 | Phase 8 | Build-gating two-leg cross-OS measurement job; clause (c) is (b)'s non-vacuity control. |
| CORR-04 | Phase 8 | `integration` declares the discriminator and is the ONLY target that does. |
| VER-01 | Phase 9 | Hardcoded forward-slash workspace-relative archive-path literal under `.nx/cache/`. |
| VER-02 | Phase 9 | The two version-determining inputs pinned by spec; `cache-archive-path.spec.ts` REPLACED, not relaxed. |
| VER-03 | Phase 9 | `enableCrossOsArchive: true` at all THREE call sites; argument list and call count asserted. |
| VER-04 | Phase 9 | cwd asserted to be the Nx workspace root, failing loud otherwise. |
| VER-05 | Phase 9 | Resolved compression method surfaced in the publish summary; surfaced, not gated. |
| VER-06 | Phase 9 | windows-11-arm `dogfood-verify` reads back the ubuntu-written `dogfood-seed` entry; MISS fails. |
| OBS-04 | Phase 9 | All-restore-MISS warning reworded; expected one-time rotation signal recorded in advance. |
| DOCS-08 | Phase 9 | Corrects the docs VER-03 inverts (`docs/advanced.md:54-57`, `ci.yml:577-583`, README, trust-and-security). |
| CORR-02 | Phase 10 | `nx-cache-<hash>` asset name, single-sourced, recognisable to the cleanup filter. Supersedes CORR-01's OS-namespaced branch. |
| RETAIN-04 | Phase 10 | Cleanup filter admits both name families; MUST land in the SAME COMMIT as CORR-02. |
| CORR-05 | Phase 10 | Closes here -- the LAST of the three violations goes with CORR-02 (the first went with VER-02 in Phase 9). |
| OBS-03 | Phase 10 | Producing OS recorded in the free-form Release asset `label`, outside the lookup name. |
| OBS-05 | Phase 10 | Leg-distinguishable publish seed + own-leg read-back; must land BEFORE CORR-02 or `publish-verify` goes vacuous. |
| XOS-06 | Phase 10 | `max-parallel: 1` retained, comment-locked as NOT a correctness control. |
| XOS-07 | Phase 10 | `publish` depends on every mirrored-entry-producing job, not on `build` alone. |
| TRUST-10 | Phase 10 | C1/C2/C16-enumeration verified unchanged; Releases-side filter change is additive; `ref` scoping pinned + comment-locked. |
| TRUST-11 | Phase 10 | Threat model records that the byte-identical premise is FALSE: first-write-wins arbitrates between differing payloads. |
| TRUST-12 | Phase 10 | Threat model records the sole-mechanism collapse and the public-repo exposure delta. |
| TRUST-13 | Phase 10 | gsd-security-auditor classifies TRUST-11/12 in SECURITY.md; the proposed classification is INPUT, not conclusion. |
| XOS-01 | Phase 11 | O1 proof: local Windows HITs `build`/`typecheck`/`test` from Linux CI via the Releases mirror. |
| XOS-02 | Phase 11 | O2 proof: local Windows HITs `integration` from Windows CI; baseline captured pre-rename (see Phase 10). |
| XOS-03 | Phase 11 | O3 proof: Windows CI MISSES the Linux `integration` entry. |
| TEST-08 | Phase 11 | Evidence definition + the O1 producer-attribution capture that Phase 12 destroys permanently. |
| TEST-09 | Phase 11 | O3 negative proof with a POSITIVE CONTROL in the same run; runs after VER-01/VER-03. |
| TEST-10 | Phase 11 | O1/O2 local proofs begin from `nx reset`; a HIT without a reset is not accepted. |
| OBS-02 | Phase 11 | Evidence = non-zero `[remote cache]` label count, named per target; Nx's `0%` report line is context only. |
| XOS-04 | Phase 12 | windows-11-arm `build`/`typecheck`/`test` legs wired through the same sidecar block. |
| XOS-05 | Phase 12 | O4 proof: those legs HIT on ubuntu-saved entries; the write decision is explicit and recorded. |
| XOS-08 | Phase 12 | Producer-to-consumer ordering: each Windows leg `needs:` its ONE ubuntu counterpart. Row ADDED 2026-07-30 -- it was missing while this section's own `**Requirements**` line and SC1 both named XOS-08, so the file contradicted itself (Phase 12 CONTEXT D-01). REQUIREMENTS.md is authoritative and says FOUR. |
| DOCS-07 | Phase 12 | Safe-by-default consumer recipe; portability checklist second, derived from PARITY-01; drift-guarded. |

## Coverage Validation

**Assertion: 44/44 v0.0.2 requirements map to exactly one phase. No orphans, no duplicates.**
(Was stated as 43/43; corrected 2026-07-30 -- see the note under the per-phase counts. XOS-08 was
named in Phase 12's `**Requirements**` line and in its SC1, but had no traceability row and was not
counted.)

Per-phase counts:

- Phase 7: 7 (LINT-01..06, CORR-06)
- Phase 8: 7 (PARITY-01..05, CORR-03, CORR-04)
- Phase 9: 8 (VER-01..06, OBS-04, DOCS-08)
- Phase 10: 11 (CORR-02, CORR-05, RETAIN-04, OBS-03, OBS-05, XOS-06, XOS-07, TRUST-10..13)
- Phase 11: 7 (XOS-01, XOS-02, XOS-03, TEST-08, TEST-09, TEST-10, OBS-02)
- Phase 12: 4 (XOS-04, XOS-05, XOS-08, DOCS-07)

Total mapped: 7 + 7 + 8 + 11 + 7 + 4 = 44. Source categories: CORR 5, LINT 6, PARITY 5, VER 6,
XOS 8, RETAIN 1, TRUST 4, DOCS 2, TEST 3, OBS 4 = 44.

**Count corrected 2026-07-30.** The Phase 12 tally read 3 and the total read 43 while this file's own
Phase 12 `**Requirements**` line and SC1 both named XOS-08, and while `REQUIREMENTS.md` (`:658-665`)
said FOUR. `REQUIREMENTS.md` is authoritative; the traceability row for XOS-08 has been added above and
the tallies reconciled. The XOS category is 8, not 7 (XOS-01 through XOS-08).

### Every sequencing-constraint row, and where it is honoured

| Before | After | Honoured as |
|--------|-------|-------------|
| LINT-01 | PARITY-01 | Phase 7 -> Phase 8 boundary |
| LINT-01 | LINT-02, LINT-03, LINT-04 | Plan ordering within Phase 7 |
| LINT-02 | CORR-05 violation removal | Phase 7 -> Phase 9 (first violation) and Phase 7 -> Phase 10 (last two) |
| PARITY-01 | PARITY-02 | Plan ordering within Phase 8 |
| PARITY-01 | DOCS-07 | Phase 8 -> Phase 12 boundary |
| PARITY-02 | XOS-01 | Phase 8 -> Phase 11 boundary |
| CORR-02 | XOS-01, XOS-02 | Phase 10 -> Phase 11 boundary |
| RETAIN-04 | same commit as CORR-02 | Single commit within one Phase 10 plan (explicitly NOT a phase split) |
| OBS-05 | CORR-02 | Plan ordering within Phase 10 |
| VER-01, VER-03 | TEST-09 | Phase 9 -> Phase 11 boundary |
| XOS-01 proven | XOS-04, XOS-05 | Phase 11 -> Phase 12 boundary (the milestone's load-bearing ordering) |
| A default-branch push republishing under the new name | XOS-01, XOS-02 proofs | Phase 10 live-CI close, gating Phase 11 |

Three rows are intra-phase by their own wording rather than phase boundaries: RETAIN-04 mandates
the SAME COMMIT as CORR-02, and the LINT-01 -> LINT-02/03/04 and PARITY-01 -> PARITY-02 rows
order plans inside a single deliverable. Splitting any of them into separate phases would either
violate the requirement (RETAIN-04) or produce a non-shippable half-slice.

### Resolved ambiguities and deviations, with reasons

- **Phase 9 (Actions cache) before Phase 10 (Releases mirror), not the reverse.** Both are
  independent layers, so either order satisfies the constraint table. Actions-cache-first was
  chosen because it makes all four TRUST requirements land in ONE phase with verifiable code
  behind them: TRUST-11's differing-payload arbitration is created by CORR-02, TRUST-12's
  exposure delta is created by VER-01/VER-03 plus CORR-02, and TRUST-13 requires a SINGLE
  SECURITY.md classifying both. Reversing the order would leave the auditor classifying a
  VER-caused threat before VER exists.

- **CORR-05 owned by Phase 10 although one of its three violations is removed in Phase 9.**
  CORR-05's claim ("every target shared cross-OS is platform-agnostic") is only TRUE once all
  three violations are gone. `cache-archive-path.spec.ts` goes with VER-02 (Phase 9);
  `releases-backend.spec.ts` and `release-asset-name.spec.ts` go with CORR-02 (Phase 10). It is
  owned by the phase where it becomes true. Phase 9's plans must not close it early.

- **XOS-02's baseline is captured in Phase 10, but XOS-02 is owned by Phase 11.** The
  requirement is explicitly a before/after pair straddling the rename, so the measurement it
  needs is unrecoverable after Phase 10 lands. Phase 10 carries it as an explicit pre-condition;
  the requirement closes in Phase 11 where the after-measurement lands. A qualifying pre-rename
  baseline already exists in the 2026-07-26 Step 0 record.

- **TEST-08 owned by Phase 11 although its O4 evidence row is written in Phase 12.** TEST-08's
  load-bearing clause is the O1 producer-attribution capture, which is only possible before O4
  is enabled -- so it must be owned by the phase that performs it. Phase 12 appends the O4 row
  to the same evidence record.

- **Phase 10 is intentionally heavy (11 requirements).** Renaming the asset without extending
  the cleanup filter silently stops pruning (RETAIN-04's same-commit rule), and renaming without
  OBS-05 makes `publish-verify` vacuous. The rename, its filter, its attribution, its
  publish-matrix corrections and its threat classification are one indivisible change; splitting
  it would ship a half-state that is worse than either end.

- **Phase 12 is intentionally light (4 requirements -- count corrected 2026-07-30; it read 3, which
  omitted XOS-08).** It is not a granularity artifact -- the
  Phase 11 -> Phase 12 boundary IS the milestone's mandatory ordering. O1's attribution is
  destroyed the moment O4 is enabled, so the two cannot share a phase however few requirements
  that leaves.

- **`fallow`'s structural pre-pass is a no-op on this workflow.** `code_quality.fallow.enabled`
  is `true` in config, but the GSD pre-pass shells out with fallow 1.x flags that fallow 2.x
  rejects. Phase 7's `lint` target does not replace it; RETAIN-04's `CACHE_OS_VALUES` annotation
  still targets the real `fallow:ci` script, which is invoked directly.

### Cross-phase couplings (flagged, not gaps)

- **Phase 7's lint rule constrains Phases 9 and 10.** LINT-03 requires the three CORR-05
  violations to be confirmed CAUGHT while they still exist; they are then removed downstream.

- **Phase 8's CORR-03 job guards Phases 9-12 continuously.** PARITY-02 is enforced by CORR-03(c)
  on every subsequent commit, not measured once -- so a Phase 9 or 10 change that re-diverges
  the hashes fails the build immediately.

- **Phase 9's VER-01 rotates the Actions-cache version**, so the Phase 10 mirror republish may
  land in the same all-miss window OBS-04 pre-records. Sequence Phase 10's warming push after
  the rotation push has been observed.

- **Phase 12's XOS-05 write decision feeds back into Phase 10's TRUST-11/12 record.** If the
  Windows legs write, the attribution loss is appended to the recorded threat model.

## Out of Scope for v0.0.2

Carried from REQUIREMENTS.md, listed so no phase picks them up:

- Executor portability classification (not knowable a priori; residual risk in TRUST-11).
- An empirical divergence-detection subsystem (disproportionate; the "green O4 CI is the
  evidence" argument is circular -- a restored task does not execute).

- A per-job or per-target OS-invariance flag (D2-02: no adopters, so no exit is needed yet).
- Read-fallback across old and new asset names (our own mirror repopulates on the next push).
- Adopter-migration signalling: changelog, `v0` tag policy, version-bump signal, rotation notice.
- Collapsing the publish matrix to one leg (only safe AFTER XOS-05 is proven; a follow-on).
- Archive file-mode handling across the OS boundary (unverified; an XOS-05 investigation item).
- Later-milestone revisit triggers carried out of v0.0.1: GHCR-01, PROV-01, FOUND-03 (Docker),
  PKG-SPLIT.

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
| 7. Lint Toolchain and the Ambient-Platform-Read Ban | v0.0.2 | 4/4 | Complete   | 2026-07-27 |
| 8. Nx Task-Hash Parity | v0.0.2 | 6/6 | Complete   | 2026-07-28 |
| 9. OS-Invariant Actions-Cache Version | v0.0.2 | 8/8 | Complete    | 2026-07-28 |
| 10. OS-Invariant Releases Mirror | v0.0.2 | 8/8 | Complete   | 2026-07-29 |
| 11. Live Proofs -- O1, O2, O3 | v0.0.2 | 7/7 | Complete    | 2026-07-30 |
| 12. Windows CI Reuse (O4) + Consumer Recipe | v0.0.2 | 0/? | Not started | - |

---
*v0.0.2 roadmap created 2026-07-26 from `.planning/REQUIREMENTS.md` (43 requirements, revised
after adversarial review by five independent critics) and `.planning/PROJECT.md` (O1-O4 and the
mandatory ordering, plus the CORR-01 `## Key Decisions` row whose documented-consumer-
discrimination branch D2-01 now takes). Granularity: standard (6 phases). Phase numbering
continues from v0.0.1's archived Phases 0-6. Git branching: none (sequential).*
