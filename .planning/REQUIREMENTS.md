# Requirements: @op-nx/github-cache v0.0.2

**Defined:** 2026-07-26
**Core Value:** Correct and safe caching on GitHub infrastructure, for public and private repos,
with nothing extra to host. A remote cache must never serve a wrong or poisoned artifact.

## Milestone goal

A Windows developer reuses Linux CI's portable task artifacts, and Windows CI reuses them too,
with the OS-sensitive target still provably separated. Proven by dogfooding this repo, then
documented as a recipe consumers can copy.

## Framing: the four target outcomes

Maintainer-stated acceptance outcomes. Every requirement exists to serve one.

| # | Outcome | Layer |
|---|---------|-------|
| O1 | Local Windows dev gets cache HITs for `build`/`typecheck`/`test` produced by Linux CI | Releases mirror |
| O2 | Local Windows dev gets cache HITs for `integration` produced by Windows CI | Releases mirror |
| O3 | Windows CI gets cache MISSes for `integration` produced by Linux CI | Actions cache |
| O4 | Windows CI gets cache HITs for `build`, `typecheck` and `test` produced by Linux CI | Actions cache |

**Testing strategy (pre-existing, restored by this milestone).** `test` is
platform/OS/arch/filesystem-AGNOSTIC by design; `integration` is the target that "hit[s] real OS
surface (real sockets, real filesystem/tmpdir)" and therefore carries the platform discriminator
(`ci.yml:336-337`, `STATE.md:192`). Cross-OS sharing of `test` is correct UNDER that strategy.
Three spec files currently VIOLATE it by reading live platform state, which would make a restored
Linux verdict green on Windows without executing them -- so the violations are removed (CORR-05),
not used as grounds to excuse `test` from sharing.

`typecheck` and `test` cache a pass/fail VERDICT rather than files, so a WRONG VERDICT is the
severe failure mode. Correctness rests on the target being platform-agnostic (CORR-05), NOT on
which OS wins the first-write-wins race: if the verdict is platform-independent, both directions
are safe and leg ordering is irrelevant.

An earlier draft argued that ubuntu-first ordering made the "stricter" Linux verdict win. That
argument is REJECTED as brittle -- it would rest a wrong-result guarantee on CI job scheduling,
which is the same accidental-correctness pattern VER-01 exists to remove, and it would be the
THIRD such dependency in a milestone whose premise is removing two. The filename-casing axis that
motivated it is closed by an explicit mechanism instead: `forceConsistentCasingInFileNames` is
`true` in both `tsconfig.lib.json:8` and `tsconfig.spec.json:12` (and is the TypeScript 6
default), so a casing mismatch errors on EVERY platform, not only on a case-sensitive one.

**Mandatory ordering:** O1 must be PROVEN before O4 is enabled. Windows CI today runs only
`integration`, so any local Windows HIT on the other targets is unambiguously Linux-produced.
Enabling O4 makes Windows CI a second producer and permanently destroys that attribution, so the
evidence must be captured at proof time (TEST-08).

**Adopter context:** this repo is currently the ONLY consumer. Adopter-migration concerns
(opt-out knobs, read-fallback chains, changelog signalling, version-bump signalling) are
deliberately deferred; they are additive if an adopter ever appears. Correctness of THIS repo's
cache, and the public-repo exposure surface, are not deferred.

## Decisions locked before requirements

| ID | Decision | Basis |
|----|----------|-------|
| D2-01 | The store is OS-INVARIANT; OS discrimination lives exclusively in the declared Nx input | ADR Decision 6's documented alternative branch |
| D2-02 | No new env knob and no new action input | Zero adopters, so no exit is needed yet (YAGNI); additive later. NOT justified by TRUST-05, which is scoped to RW-vs-RO only |
| D2-03 | The Releases asset name is `nx-cache-<hash>`, single-sourced from the existing `CACHE_KEY_PREFIX` | C16's "distinguishing namespace/prefix" read literally; a suffix accept-list on a DELETE filter grows per scheme revision |
| D2-04 | The archive path is a workspace-relative forward-slash literal under `.nx/cache/` | `@actions/cache` docs forbid absolute paths cross-OS; `.nx/cache` is gitignored by `nx init` and excluded from Nx's file map. NOT `node_modules/.cache/`, which our own AGENTS.md junctions across worktrees |
| D2-05 | Ecosystem norm is trust-the-hash | `nx-remotecache-custom` keys on `hash + ".tar.gz"`; no Nx cache implementation documents cross-OS correctness |
| D2-06 | Ship as v0.0.2 | The three-group consumer surface is untouched and there are no adopters to signal |

## v0.0.2 Requirements

### Cross-OS correctness (CORR)

- [ ] **CORR-02**: The Releases mirror asset name is `nx-cache-<hash>` -- a distinguishing prefix
  with no OS component -- derived by both reader and publisher from the single `releaseAssetName`
  helper, and recognisable to the cleanup filter. Supersedes CORR-01's "OS-namespaced by default"
  branch.
- [ ] **CORR-03**: A single cross-OS measurement, run as a build-gating CI job over BOTH matrix
  legs at one commit, asserts: (a) exactly two platform records exist, each carrying a non-empty
  hash per target -- fewer than two is a FAILURE, not a skip; (b) the `integration` hash DIFFERS
  between legs; (c) `build`, `typecheck` and `test` hashes are IDENTICAL. Clause (c) is the
  non-vacuity control for (b): with every other input demonstrably shared, the only surviving
  explanation for (b) is the declared discriminator. The discriminator command's raw stdout AND
  stderr are recorded per leg. A textual assertion that `nx.json` contains the input does NOT
  satisfy this.
- [ ] **CORR-04**: `integration` declares a platform discriminator in its Nx inputs, and is the
  ONLY target that does. After VER-03 this is the SOLE mechanism separating OS-sensitive targets;
  removing it is a Core-Value regression.
- [ ] **CORR-05**: Every target shared cross-OS (`build`, `typecheck`, `test`) is
  platform-agnostic -- its RESULT does not depend on the OS, architecture, or filesystem semantics
  of the machine that produced it. This is what makes first-write-wins safe in EITHER direction,
  and is why no ordering control is needed. Assertions that read live platform state belong in
  `integration`, per the recorded strategy (`ci.yml:336-337`, `STATE.md:192`). Three spec files
  violate this today -- `cache-archive-path.spec.ts` (asserts `dirname === tmpdir()`),
  `releases-backend.spec.ts` (derives a wrong-OS fixture from `process.platform`) and
  `release-asset-name.spec.ts` (compares against `process.platform`) -- and all three are
  eliminated as a side effect of VER-02 and CORR-02, which remove the platform-dependent
  behaviour those specs exist to pin.
- [ ] **CORR-06**: The strategy is MECHANICALLY enforced, not documented: a guard fails the `test`
  target when a non-integration spec reads AMBIENT platform state -- `process.platform`,
  `process.arch`, any `node:os` accessor (`tmpdir`, `EOL`, `platform`, `arch`, `homedir`, `type`,
  `release`), or `path.sep`/`path.delimiter`/`path.win32`/`path.posix`. Scoped by the partition
  that already exists: `vitest.config.mts` includes `**/*.{test,spec}.ts` and excludes
  `*.integration.spec.ts`, which `vitest.integration.config.mts` exclusively owns -- so the same
  APIs stay ALLOWED in `integration`, where OS-specific assertions belong.
  Injected or explicit platform values are NOT banned: `releaseAssetName(hash, 'win32')` is the
  designed test seam ("the platform parameter exists ONLY for test injection"). Only deriving an
  expectation from the RUNNING machine is prohibited.
  Enforced by the lint rules in LINT-02.

### Lint toolchain (LINT)

This repo currently has NO linter (no ESLint, no Biome). Adopting one is its own phase.

- [ ] **LINT-01**: ESLint is adopted with a v9 FLAT config and a `lint` target wired into the CI
  battery. v9 is mandatory, not preference: Nx 23.1 dropped ESLint v8 support. New dev
  dependencies are exact-pinned under the existing ROBUST-03 discipline and covered by the
  `pinned-deps` guard.
- [ ] **LINT-02**: A `no-restricted-syntax` rule set bans AMBIENT platform reads in unit specs and
  ALLOWS them in integration specs, scoped by the partition that already exists -- `files:
  ['**/*.spec.ts']` with `ignores: ['**/*.integration.spec.ts']`, mirroring
  `vitest.config.mts`'s include/exclude and `vitest.integration.config.mts`'s exclusive include.
  Banned: `process.platform`, `process.arch`, every `node:os` accessor (`tmpdir`, `EOL`,
  `platform`, `arch`, `homedir`, `type`, `release`), and
  `path.sep`/`path.delimiter`/`path.win32`/`path.posix`.
  NOT banned: injected or explicit platform values. `releaseAssetName(hash, 'win32')` is the
  designed test seam ("the platform parameter exists ONLY for test injection"). Only deriving an
  expectation from the RUNNING machine is prohibited, which is precisely what the three CORR-05
  violations do.
- [ ] **LINT-03**: The rule set is proven RED before GREEN -- a deliberately violating fixture
  fails `lint`, and each of the three CORR-05 violations is confirmed caught before it is removed.
  A rule that matches nothing is indistinguishable from a rule that is not wired up.
- [ ] **LINT-04**: The `lint` target's Nx inputs are declared so it cannot serve a stale-cache
  false PASS. This repo has already hit that class once: `typecheck`'s inputs excluded `*.spec.ts`
  while its command compiled them, so a real error was masked by a cache hit.
- [ ] **LINT-05**: An intentional violation opts out ONLY via an inline disable annotation
  carrying a DESCRIPTION that names the reason -- `// eslint-disable-next-line <rule> -- <reason>`.
  A bare disable is itself a lint error, enforced by a require-description rule
  (`@eslint-community/eslint-plugin-eslint-comments`'s `eslint-comments/require-description` or
  equivalent), so an opt-out can never be silent. The same discipline applies to TypeScript
  suppressions: `@typescript-eslint/ban-ts-comment` is configured `allow-with-description`, so a
  bare `@ts-expect-error`/`@ts-ignore` is also an error.
- [ ] **LINT-06**: `linterOptions.reportUnusedDisableDirectives` is `error`. A disable left behind
  after its violation is removed must FAIL, not linger -- a stale annotation silently pre-authorises
  a future violation on that line, which is the same silent-widening failure class as a dead
  allowlist entry. For a unit spec specifically, the reason text must say why the assertion cannot
  move to `integration`, since the recorded strategy is that OS-specific assertions belong there.

### Nx task-hash parity (PARITY)

- [ ] **PARITY-01**: The current cross-OS divergence for `build`/`typecheck`/`test` is root-caused
  node-by-node (native Windows vs Linux) and RECORDED, with the capture command named, before any
  fix is applied.
- [ ] **PARITY-02**: `build`, `typecheck` and `test` compute a byte-identical Nx task hash for the same
  commit at all three observation points: native Windows workstation (O1's precondition),
  windows-11-arm runner (O4's precondition), and ubuntu-24.04-arm runner. Three values per target,
  not two. Enforced continuously by CORR-03(c), not measured once.
- [ ] **PARITY-03**: `integration` computes a byte-identical hash between the native Windows
  workstation and windows-11-arm (O2's precondition).
- [ ] **PARITY-04**: Every measurement records the Nx version, the Node version, and the install
  mode (`npm ci` vs `npm install`). The 23.0.2 -> 23.1.0 hash-planner rewrite makes cross-version
  measurements non-comparable, and `.node-version` is a moving alias (`lts/krypton`).
- [ ] **PARITY-05**: The public-surface guard passes unchanged -- no new env knob, no new action
  input, no new package export (D2-02).

### Cache-version hardening (VER)

- [ ] **VER-01**: The path string passed to `@actions/cache` is byte-identical on Windows and
  Linux for a given hash: a hardcoded forward-slash, workspace-relative literal under `.nx/cache/`.
  It MUST NOT be built with `node:path` (`join`/`resolve`/`sep`/`normalize`), MUST NOT be
  absolutized, and MUST NOT derive from `os.tmpdir()`, `RUNNER_TEMP`, or `~`. `@actions/cache`
  sha256s the raw path strings into the cache version, so any separator difference is a silent
  cross-OS MISS.
- [ ] **VER-02**: The two version-determining inputs are pinned by spec -- the archive-path
  literal is byte-identical for `win32` and `linux`, and `enableCrossOsArchive` is `true` at every
  call site. The derived version itself is NOT assertable: `getCacheVersion` is not on
  `@actions/cache`'s exported surface (verified: `ERR_PACKAGE_PATH_NOT_EXPORTED`).
  `cache-archive-path.spec.ts:25-26` is REPLACED, not relaxed -- it currently pins
  `dirname === tmpdir()`.
- [ ] **VER-03**: `enableCrossOsArchive: true` is hardcoded at ALL THREE `@actions/cache` call
  sites -- `restoreCache` (read, `:46`), `saveCache` (write, `:101`), and the `lookupOnly`
  existence probe (`:107`). It is a POSITIONAL argument at a different index in each function, and
  upstream's JSDoc documents the wrong order. A spec asserts the argument list of each call and
  the call count, so a fourth site added later fails.
- [ ] **VER-04**: The process asserts its cwd is the Nx workspace root, failing loud otherwise. A
  relative path plus a wrong cwd is a silent split-brain between the derived version and the file.
- [ ] **VER-05**: The resolved `@actions/cache` compression method is surfaced in the publish
  summary. It is a third version component sensed at runtime by probing for `zstd`, so a runner
  image that loses zstd silently re-partitions the version. Surfaced, NOT gated -- a hard failure
  would punish an otherwise-healthy runner.
- [ ] **VER-06**: The cross-OS behavioural close is a `dogfood-verify` leg on windows-11-arm that
  reads back the entry `dogfood-seed` wrote on ubuntu-24.04-arm. A MISS fails the job. This, not a
  unit spec, is the load-bearing control: a spec runs in one process on one OS and cannot observe
  a two-OS property.

### Cross-OS outcomes (XOS)

- [ ] **XOS-01**: A local Windows developer gets a cache HIT for `build`, `typecheck` and `test`
  from artifacts produced by Linux CI, via the Releases mirror. (O1)
- [ ] **XOS-02**: A local Windows developer gets a cache HIT for `integration` from artifacts
  produced by Windows CI. Measured BEFORE the CORR-02 rename as a baseline and AFTER as a
  non-regression. (O2)
- [ ] **XOS-03**: Windows CI gets a cache MISS for `integration` produced by Linux CI. (O3)
- [ ] **XOS-04**: `ci.yml` runs `build`, `typecheck` and `test` on a windows-11-arm leg in addition
  to the ubuntu leg, wired through the same sidecar block as the `integration` matrix. Without this
  there is no Windows job that could exhibit O4's HIT.
- [ ] **XOS-05**: Those Windows legs get a cache HIT for all three targets from entries saved by
  the ubuntu leg. Whether they also WRITE is an explicit recorded decision; if they write, the loss
  of clean Linux attribution is recorded alongside TRUST-11/12. (O4)
- [ ] **XOS-06**: `max-parallel: 1` is RETAINED for its existing reasons (serialised legs, no
  concurrent shard-creation or delete races) but MUST NOT become a correctness control. No
  requirement may depend on which OS leg wins the first-write-wins race -- cross-OS sharing is made
  safe by CORR-05's platform-agnosticism, not by ordering. A comment records this explicitly so a
  future reader does not reconstruct the rejected ordering argument.
- [ ] **XOS-07**: `publish` depends on every job producing a mirrored entry (`build`, `typecheck`,
  `test`, `integration`), not on `build` alone, so one default-branch push mirrors that push's full
  task set. Otherwise the O1 proof races job completion and can fail on a correct implementation.

### Retention and cleanup (RETAIN)

- [ ] **RETAIN-04**: The cleanup asset filter admits BOTH the new `nx-cache-<hash>` name and the
  legacy `<hash>-<os>` names, so legacy assets age out through the existing
  `CACHE_MIRROR_MAX_AGE_DAYS` window instead of accumulating. MUST land in the SAME COMMIT as
  CORR-02 -- a publisher writing the new name against an unextended filter silently stops pruning.
  `CACHE_OS_VALUES` is retained and annotated as intentionally-kept legacy support so `fallow`
  dead-code analysis does not prune it. Proven by specs over both name families plus a cleanup
  dry-run over a mixed shard.

### CREEP trust posture (TRUST)

- [ ] **TRUST-10**: C1 (write-trust allowlist), C2 (sync gate) and C16's enumeration-side filter
  (`isServerProducedKey`, over Actions-cache keys) are unchanged, verified rather than assumed.
  C16's Releases-side filter (`isServerProducedAssetName`) DOES change under CORR-02/RETAIN-04;
  the change is additive. The `ref` scoping of `listCacheEntries` (`action/index.ts:40-43`) is
  pinned by spec and comment-locked: with the OS-version barrier removed it becomes the ONLY
  in-repo control keeping non-default-branch trusted writes (`TRUSTED_EVENTS` includes `push` with
  no ref check) out of the world-readable mirror.
- [ ] **TRUST-11**: The phase threat model records that C3/TRUST-07's "byte-identical under
  CORR-01" premise is now FALSE, not merely re-founded: an Nx cache entry carries captured terminal
  output (`ci.yml:652`), which embeds OS-specific paths, so two legs produce different bytes for
  the same hash. First-write-wins therefore arbitrates between differing payloads, and the
  month-shard newest-first read walk makes the winner shard-dependent.
- [ ] **TRUST-12**: The phase threat model records that VER-01/VER-03 remove the incidental
  within-scope OS partitioning, leaving CORR-04's declared discriminator as the sole separation
  mechanism; and records the public-repo EXPOSURE DELTA -- a single-OS publish leg can now restore
  and mirror every OS's entries, so the captured terminal output of every CI job on every OS
  crosses into the anonymously-readable Releases mirror.
- [ ] **TRUST-13**: TRUST-11 and TRUST-12 are classified by gsd-security-auditor in SECURITY.md,
  not self-certified. The proposed classification (neither crosses a trust boundary, because the
  Actions cache's boundary is ref scope, not OS) is offered as INPUT to that audit, not as its
  conclusion.

### Documentation (DOCS)

- [ ] **DOCS-07**: A consumer-facing cross-OS adoption recipe whose PRIMARY instruction is
  safe-by-default: declare the platform discriminator across all cacheable targets first, then
  remove it per target only after proving that target's output is portable. The portability
  checklist is the SECOND section, framed as how to earn a removal, and its items are derived from
  PARITY-01's root-cause record rather than prejudged. Names architecture and libc as axes
  `process.platform` does not cover (this repo cannot exercise them -- every machine here is
  arm64). The documented discriminator command must be stderr-immune, since `hash_runtime` hashes
  stdout AND stderr. Registered in `nx.json`'s `test` inputs and guarded against drift.
- [ ] **DOCS-08**: `docs/advanced.md:54-57` and `ci.yml:577-583` are corrected -- both currently
  assert same-OS restore as a load-bearing invariant, which VER-03 inverts. `README.md`'s
  unconditional "never a wrong result" gains its new precondition. The statement that correctness
  now depends on the declared Nx input is added to `docs/trust-and-security.md`.

### Verification (TEST)

- [ ] **TEST-08**: Each of O1-O4 has a recorded live proof executed in the mandated order.
  Evidence is defined: the workflow run URL (O3/O4) or captured terminal output (O1/O2), the Nx
  hash observed, and the literal `[remote cache]` label. The O1 proof additionally captures
  PRODUCER ATTRIBUTION at proof time -- per hit hash, the Actions-cache entry list and shard asset
  list with `created_at`, cross-referenced against job windows -- because enabling O4 permanently
  destroys the ability to re-derive it. The premise that Windows CI produces no
  `build`/`typecheck`/`test`
  hash is asserted mechanically against the resolved Nx task graph, not assumed from the job list.
- [ ] **TEST-09**: The O3 negative proof runs AFTER VER-01 and VER-03 have landed, so the MISS is
  attributable to the Nx discriminator and not to the removed `@actions/cache` OS salt. It requires
  a POSITIVE CONTROL in the same run: the Windows job must MISS the Linux `integration` hash AND
  HIT at least one entry through the same code path. A run that MISSes everything is not a valid
  proof. Both hashes are recorded and shown to differ.
- [ ] **TEST-10**: The O1/O2 local proofs begin from a cleared local Nx cache (`nx reset`). A HIT
  recorded without a preceding reset is not accepted -- a local cache hit short-circuits before the
  remote is ever queried.

### Observability (OBS)

- [ ] **OBS-02**: Proof evidence is a non-zero count of tasks carrying the literal `[remote cache]`
  label, named per target. Nx 23.1's end-of-run performance report is supporting context only --
  it cannot separate local from remote, cannot attribute a producer OS, and prints an identical
  `0%` line for a run with no sidecar at all. It renders to the job summary in CI and to the
  terminal locally.
- [ ] **OBS-03**: Every mirrored asset records its producing OS in Release asset metadata that is
  NOT part of the lookup name (the free-form `label` field). The store stays OS-invariant for
  lookup; only attribution is preserved. CORR-02 otherwise removes the only means of attributing a
  served artifact to a producer -- an incident-response gap of the same class the ADR weighed
  decisively when choosing Releases over GHCR.
- [ ] **OBS-04**: The all-restore-MISS warning's message drops the now-false "different OS"
  explanation and names cache-version rotation as a candidate cause. The expected signal of the
  first post-change push is recorded IN ADVANCE (all-miss on both publish legs, `mirrored == 0`);
  a SECOND consecutive all-miss push is a FAILURE, not warm-up. It stays a warning, not a hard
  failure -- the one-time rotation makes a full MISS legitimate exactly once.
- [ ] **OBS-05**: Each `publish` matrix leg seeds a leg-DISTINGUISHABLE hash and each
  `publish-verify` leg reads back its OWN leg's asset. Today both legs seed
  `GITHUB_RUN_ID` (`read-back.ts:37`) and are separated only by the OS suffix, so CORR-02 would
  make the Windows leg read the ubuntu-produced asset and pass even if the Windows publish path
  were entirely dead.

## Sequencing constraints

Consumed by the roadmapper as phase dependencies.

| Before | After | Why |
|--------|-------|-----|
| LINT-01 | PARITY-01 | `@nx/eslint` is an INFERENCE plugin: an inferred `lint` target changes `hash_project_config`, which is folded into EVERY task hash. Adding it after the root-cause work would invalidate that work -- and an OS-divergent lint inference would be a NEW parity bug of exactly the `@nx/vitest` / `@nx/js/typescript` class |
| LINT-01 | LINT-02, LINT-03, LINT-04 | Toolchain before rules |
| LINT-02 | CORR-05 violation removal | The rule must be proven to CATCH the three violations before they are removed, or nothing shows the rule works |
| PARITY-01 | PARITY-02 | Root-cause before fixing |
| PARITY-01 | DOCS-07 | The checklist is derived from the findings |
| PARITY-02 | XOS-01 | Hash parity is O1's precondition |
| CORR-02 | XOS-01, XOS-02 | The rename is what enables the cross-OS read |
| RETAIN-04 | (same commit as CORR-02) | A new name against an unextended filter silently stops pruning |
| OBS-05 | CORR-02 | Or `publish-verify` goes vacuous the moment the rename lands |
| VER-01, VER-03 | TEST-09 | Otherwise the O3 proof passes for the pre-change reason |
| XOS-01 proven | XOS-04, XOS-05 | Enabling O4 destroys O1's attribution permanently |
| A default-branch push republishing under the new name | XOS-01, XOS-02 proofs | The mirror must be warm under the new scheme |

## Out of Scope

| Item | Reason |
|------|--------|
| Executor portability classification | Not knowable a priori and project-dependent. The Nx hash is the classification ONLY GIVEN the DOCS-07 declaration; the residual risk is recorded in TRUST-11 |
| Empirical divergence-detection subsystem | Disproportionate. NOTE: "O4's green CI is the portability evidence" is NOT the reason -- that argument is circular, since a restored task does not execute |
| Per-job or per-target OS-invariance flag | D2-02 (no adopters, so no exit is needed yet). NOT forbidden by TRUST-05, which is scoped to RW-vs-RO |
| Read-fallback across old and new asset names | No adopters; our own mirror repopulates on the next default-branch push |
| Adopter-migration signalling (changelog, `v0` tag policy, version-bump signal, rotation notice) | No adopters to signal; all additive later |
| Collapsing the publish matrix to one leg | Only safe AFTER XOS-05 is proven; a follow-on decision |
| Archive file-mode handling across the OS boundary | Unverified; carried as an XOS-05 investigation item, not a requirement |

## Traceability

Populated during roadmap creation (2026-07-26). Every v0.0.2 requirement maps to exactly one
phase; 43/43 mapped, no orphans, no duplicates. Phase detail and the sequencing-constraint
honour table: `.planning/ROADMAP.md`.

| Requirement | Phase | Status |
|-------------|-------|--------|
| LINT-01 | Phase 7 | Pending |
| LINT-02 | Phase 7 | Pending |
| LINT-03 | Phase 7 | Pending |
| LINT-04 | Phase 7 | Pending |
| LINT-05 | Phase 7 | Pending |
| LINT-06 | Phase 7 | Pending |
| CORR-06 | Phase 7 | Pending |
| PARITY-01 | Phase 8 | Pending |
| PARITY-02 | Phase 8 | Pending |
| PARITY-03 | Phase 8 | Pending |
| PARITY-04 | Phase 8 | Pending |
| PARITY-05 | Phase 8 | Pending |
| CORR-03 | Phase 8 | Pending |
| CORR-04 | Phase 8 | Pending |
| VER-01 | Phase 9 | Pending |
| VER-02 | Phase 9 | Pending |
| VER-03 | Phase 9 | Pending |
| VER-04 | Phase 9 | Pending |
| VER-05 | Phase 9 | Pending |
| VER-06 | Phase 9 | Pending |
| OBS-04 | Phase 9 | Pending |
| DOCS-08 | Phase 9 | Pending |
| CORR-02 | Phase 10 | Pending |
| RETAIN-04 | Phase 10 | Pending (same commit as CORR-02) |
| CORR-05 | Phase 10 | Pending (1st of 3 violations removed in Phase 9 with VER-02) |
| OBS-03 | Phase 10 | Pending |
| OBS-05 | Phase 10 | Pending (must land before CORR-02) |
| XOS-06 | Phase 10 | Pending |
| XOS-07 | Phase 10 | Pending |
| TRUST-10 | Phase 10 | Pending |
| TRUST-11 | Phase 10 | Pending |
| TRUST-12 | Phase 10 | Pending |
| TRUST-13 | Phase 10 | Pending |
| XOS-01 | Phase 11 | Pending (live-CI/live-workstation only) |
| XOS-02 | Phase 11 | Pending (baseline captured in Phase 10, before CORR-02) |
| XOS-03 | Phase 11 | Pending (live-CI only) |
| TEST-08 | Phase 11 | Pending (O4 evidence row appended in Phase 12) |
| TEST-09 | Phase 11 | Pending (live-CI only) |
| TEST-10 | Phase 11 | Pending |
| OBS-02 | Phase 11 | Pending |
| XOS-04 | Phase 12 | Pending |
| XOS-05 | Phase 12 | Pending (live-CI only) |
| DOCS-07 | Phase 12 | Pending |

---
*Requirements defined: 2026-07-26*
*Revised 2026-07-26 after adversarial review by five independent critics (52 findings triaged:
15 independently verified, 4 inter-critic conflicts resolved, 5 rejected).*
*Traceability populated 2026-07-26 at roadmap creation (Phases 7-12).*
