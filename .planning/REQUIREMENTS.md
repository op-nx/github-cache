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
| D2-01 | The store is OS-INVARIANT; OS discrimination lives exclusively in the declared Nx input | The CORR-01 row in `.planning/PROJECT.md` `## Key Decisions` - its "or documented consumer OS-discrimination" branch |
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
  `integration`, per the recorded strategy (`ci.yml:336-337`, `STATE.md:192`).
  **FOUR violation sites in three files, and one is NOT removed by this milestone:**

  | Site | Removed by |
  |------|-----------|
  | `cache-archive-path.spec.ts:1` (`import { tmpdir }`) and `:26` | VER-02, Phase 9 |
  | `releases-backend.spec.ts:38` (wrong-OS fixture from `process.platform`) | CORR-02, Phase 10 |
  | `release-asset-name.spec.ts:39` (`releaseAssetName(hash, process.platform)`) | CORR-02, Phase 10 |
  | `release-asset-name.spec.ts:60` (`cachePlatform()` vs `cachePlatform(process.platform)`) | **NOTHING** |

  Site 4 survives because OBS-03 deliberately KEEPS `cachePlatform` (it derives the asset label), so
  the default-argument test stays meaningful and stays an ambient read. Phase 10 makes an explicit
  call on it -- recommended: move it to `server/public-server.integration.spec.ts`, where LINT-02
  allows it. Without that call CORR-05 cannot become true.

  **Sequencing consequence:** after Phase 7 all four sites FAIL `lint` on a green-required build,
  while LINT-03 requires them confirmed CAUGHT before removal. So Phase 7 lands a described
  `eslint-disable-next-line` at each site, and LINT-06's `reportUnusedDisableDirectives: 'error'`
  then forces each one out together with its violation in Phases 9 and 10. That is the mechanism
  working as designed, but a planner who does not know it will either leave the build red or delete
  the violations early and destroy LINT-03's evidence.

  Related, and not covered by the above: `releases-backend.spec.ts:103-118` is the DOCUMENTED
  non-vacuity proof for CORR-01, and CORR-02 destroys it on purpose. Phase 10 must name the
  replacement -- assert the reader requested EXACTLY ONE asset name, equal to the imported
  `releaseAssetName(hash)`, containing no platform token -- or coverage drops silently.
- [ ] **CORR-06**: The strategy is MECHANICALLY enforced, not documented: a guard fails the `test`
  target when a non-integration spec reads AMBIENT platform state -- `process.platform`,
  `process.arch`, any `node:os` accessor (`tmpdir`, `EOL`, `platform`, `arch`, `homedir`, `type`,
  `release`), or `path.sep`/`path.delimiter`/`path.win32`/`path.posix`. Scoped by the partition
  that already exists: `vitest.config.mts` includes `**/*.{test,spec}.ts` and excludes
  `*.integration.spec.ts`, which `vitest.integration.config.mts` exclusively owns -- so the same
  APIs stay ALLOWED in `integration`, where OS-specific assertions belong.
  Injected or explicit platform values are NOT banned -- `cachePlatform('win32')` is the canonical
  allowed shape. (Do NOT use `releaseAssetName(hash, 'win32')` as the example: CORR-02 deletes that
  parameter in Phase 10, three phases after Phase 7 writes the rule, and `fallow` will then flag it.
  OBS-03 keeps `cachePlatform`, so it is the stable substitute.) Only deriving an expectation from
  the RUNNING machine is prohibited.
  Enforced by the lint rules in LINT-02.

### Lint toolchain (LINT)

This repo currently has NO linter (no ESLint, no Biome). Adopting one is its own phase.

- [ ] **LINT-01**: ESLint is adopted with a v9 FLAT config and a `lint` target wired into the CI
  battery. v9 is mandatory, not preference: Nx 23.1 dropped ESLint v8 support (`@nx/eslint@23.1.0`
  peers `eslint ^9 || ^10`). New dev dependencies are exact-pinned AND their NAMES are added to
  `pinned-deps.spec.ts`. These are two separate tasks: that guard is a hard-coded name list with one
  `it()` per package, NOT a blanket "every dependency is exact" rule -- the workspace deliberately
  carries ranges (`typescript ~6.0.3`, `vitest ~4.1.0`, `prettier ^3.8.1`). Pinning without adding
  the names leaves them unguarded, and a later `npm install eslint@latest` passes every check. The
  ROBUST-03-class decision is recorded in the spec's comment, since the precedent is genuinely
  ambiguous: `esbuild` IS in the list, `prettier` is NOT.
- [ ] **LINT-02**: The rules ban AMBIENT platform reads in unit specs and ALLOW them in integration
  specs. **TWO rules are required, not one** -- `no-restricted-syntax` is an AST-selector matcher
  and cannot see a destructured named import, and one of the four CORR-05 sites is exactly that
  shape (`import { tmpdir } from 'node:os'`); conversely `no-restricted-imports` cannot ban a member
  of a namespace import. Both are ESLint core, no new dependency.
  Scoped by the partition that already exists, **mirroring its full extension set**: `files:
  ['**/*.spec.{ts,mts,cts}']` with `ignores: ['**/*.integration.spec.{ts,mts,cts}']`. The `.ts`-only
  form INVERTS the rule for `.mts`: `vitest.integration.config.mts` includes
  `{src,tests}/**/*.integration.spec.{ts,mts,cts}`, so an `*.integration.spec.mts` would be linted
  as a unit spec and its LEGITIMATE platform read would fail, while a `*.spec.mts` unit spec would
  slip the ban entirely. A drift spec asserts the ESLint globs and the two vitest configs agree --
  the repo already ships this guard class for the `trust.ts`/`sync-gate.ts` allowlists.
  Banned: `process.platform`, `process.arch`, every `node:os` accessor (`tmpdir`, `EOL`, `platform`,
  `arch`, `homedir`, `type`, `release`), and `path.sep`/`path.delimiter`/`path.win32`/`path.posix`.
  NOT banned: injected or explicit platform values -- `cachePlatform('win32')` is the canonical
  allowed shape. Only deriving an expectation from the RUNNING machine is prohibited.
- [ ] **LINT-03**: The rule set is proven RED before GREEN. The fixture covers the EVASION shapes,
  not only the four extant CORR-05 sites -- `const { platform } = process`, `const p = process;
  p.platform`, `import { platform } from 'node:os'`, `import * as os from 'node:os'`, `const
  k = 'platform'; process[k]`, and `await import('node:os')`. Each of the four CORR-05 sites is
  confirmed CAUGHT while it still exists, before Phases 9 and 10 remove it. A rule that matches
  nothing is indistinguishable from a rule that is not wired up, and a rule proven only against the
  cases that already exist is proven against the easy half.
- [ ] **LINT-04**: The `lint` target's Nx inputs are declared so it cannot serve a stale-cache
  false PASS. This repo has already hit that class once: `typecheck`'s inputs excluded `*.spec.ts`
  while its command compiled them, so a real error was masked by a cache hit. Three lint-specific
  instances: (a) `eslint.config.*` AND anything it imports must be inputs -- otherwise editing a
  rule replays a cached PASS, and since LINT-03 IS the activity that edits rules, the false PASS
  would surface during LINT-03 itself and read as "the rule does not fire"; (b) every file ESLint
  actually reads must be hashed, which is wider than `src/**` (config files,
  `start-cache-server/entry.ts`, `*.cjs` helpers); (c) do NOT enable type-aware linting -- none of
  LINT-02/05/06's rules need `parserOptions.projectService`, and it would make `lint` sensitive to
  every file in the TypeScript program plus the tsconfigs. Extend `nx-target-inputs.spec.ts` rather
  than building a new mechanism; note its own caveat that reading `nx.json` from a spec is safe only
  because `{workspaceRoot}/nx.json` is a `test` input, and only `test` declares it.
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

- [ ] **PARITY-01**: The divergence is root-caused node-by-node and RECORDED before any fix is
  applied, controlling for BOTH axes the pre-flight probe identified
  (`research/v0.0.2/PROBE-RESULTS.md`):
  (a) a real OS axis -- cold-ubuntu differs from cold-windows for every target; and
  (b) a FRESHNESS axis that perfectly masquerades as it -- a stale `.nx/workspace-data` on Windows
  reproduces the Linux result exactly (measured: warm-local-Windows `build`/`test` equal
  cold-ubuntu-CI to the digit, and cold-local-Windows equals cold-windows-CI to the digit).
  **Every prior cross-OS measurement in this repo read a confounded variable, including the pair in
  `STATE.md` attributed to "ubuntu CI" vs "windows CI".** No difference may be attributed to the OS
  until freshness is pinned. Leading hypothesis, now specific: a Windows-only inference difference
  visible ONLY on a cold graph -- the `@nx/vitest` / `@nx/js/typescript` OS-dependent
  `ProjectConfiguration` class, freshness-gated, which is why the v0.0.1 fixes appeared to hold.
- [ ] **PARITY-02**: The named capture instrument emits the per-NODE hash `details` map
  (`TaskHashDetails.details`). `nx show target inputs` is NOT sufficient and a "no difference"
  result from it is not evidence: it SKIPS `ProjectConfiguration` (per `HashPlanInspector`'s own
  API doc) and reports file PATHS rather than content hashes -- both of v0.0.1's named suspects are
  invisible to it. `nx-target-inputs.spec.ts` is the in-repo precedent for reaching into
  `nx/src/hasher/*`. `.nx/cache/run.json` is the per-TASK surface and is complementary, not a
  substitute; it is overwritten by every `nx` invocation, so read it immediately.
- [ ] **PARITY-03**: `build`, `typecheck` and `test` compute a byte-identical Nx task hash for the
  same commit at all three observation points -- native Windows workstation (O1's precondition),
  windows-11-arm runner (O4's precondition), ubuntu-24.04-arm runner -- with the Windows workstation
  measured in BOTH graph states. Four values per target, not two. Enforced continuously by
  CORR-03(c), not measured once.
- [ ] **PARITY-04**: "A warm local box computes the hash cold CI published" is a SEPARATE named
  acceptance question from cross-OS parity. If it is false, O1 is unreachable regardless of OS
  parity. It MUST NOT be resolved silently by `nx reset`: TEST-10's mandated reset clears
  `.nx/workspace-data` too and forces the COLD state, which is convenient for the proof and
  misleading as evidence of the everyday developer experience. Record which question each proof
  answers.
- [ ] **PARITY-05**: `integration` computes a byte-identical hash between the native Windows
  workstation and windows-11-arm (O2's precondition).
- [ ] **PARITY-06**: Every measurement records the Nx version, the Node version, the install mode
  (`npm ci` vs `npm install`), and the GRAPH STATE (cold / warm `.nx/workspace-data`). The
  23.0.2 -> 23.1.0 hash-planner rewrite makes cross-version measurements non-comparable, and
  `.node-version` is a moving alias (`lts/krypton`). Note `typecheck` carries a THIRD variance
  source beyond OS and freshness -- four distinct values across the four probe measurements --
  plausibly install mode reaching it via `dependentTasksOutputFiles` or `externalDependencies`.
- [ ] **PARITY-07**: The public-surface guard passes unchanged -- no new env knob, no new action
  input, no new package export (D2-02).
- [ ] **PARITY-08**: `{workspaceRoot}/.github/workflows/ci.yml` is registered as a `test` input and
  `nx.json`'s explicit input list is comment-locked. `nx.json` lists `cleanup.yml` and NOT `ci.yml`,
  so any spec asserting on `ci.yml` serves a stale cached PASS -- the same false-pass class the
  `typecheck` target already shipped once. Consumers: DOCS-08, OBS-05, XOS-06, XOS-07, DOCS-07's
  drift guard. The comment lock must record WHY the list is explicit: `targetDefaults` inputs
  REPLACE rather than merge, and `@nx/vitest`'s inferred `test` target carries `{ env: 'CI' }` --
  true on every runner, unset on a workstation -- which would make **O1 structurally impossible for
  `test`**. That safety currently holds by accident and nothing records it. Lands in Phase 9 so its
  hash rotation collapses into VER-01's existing window.

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
- [ ] **VER-04**: The process asserts, ONCE at `createActionsCacheBackend()` construction, the
  CONJUNCTION: cwd is the Nx workspace root AND (`GITHUB_WORKSPACE` is unset OR
  `resolve(GITHUB_WORKSPACE) === resolve(cwd)`), compared case-normalised. "The Nx workspace root"
  alone is the WRONG variable -- `@actions/cache` never reads it. A relative path is resolved
  against three anchors: glob expansion uses `process.cwd()`, while the tar manifest and `tar -C`
  use `GITHUB_WORKSPACE ?? cwd`; our own `readFile`/`writeFile` use `cwd`. When they diverge the
  restore reports a HIT, extraction lands under `$GITHUB_WORKSPACE`, `readFile` throws ENOENT under
  `$CWD`, and `server.ts` `handleGet` converts it to a 404 -- a permanent silent all-MISS while
  `@actions/cache` logs `Cache hit for:`. Assert at construction, not per request: a per-request
  check fires inside `get()` and is swallowed by the same catch. Keep `cacheArchivePath` a pure
  string function. MEASURED 2026-07-26: the identity HOLDS on both runners today
  (`research/v0.0.2/PROBE-RESULTS.md` Q2), so this is a drift guard, not a fix for a live break --
  nothing currently defends it. Record the asymmetry: the same fault is LOUD in `publishMirror` and
  SILENT in `serve`, so a green publish job is not evidence the serve path is healthy.
- [ ] **VER-05**: The resolved `@actions/cache` compression method is surfaced in the publish
  summary. It is a third version component, pushed into the version UNCONDITIONALLY -- before and
  independent of the `enableCrossOsArchive` branch -- so the flag cannot rescue a mismatch. The
  value is NOT readable from the library: the exports map is `{".": ...}` only and
  `getCompressionMethod` is internal, the same `ERR_PACKAGE_PATH_NOT_EXPORTED` wall VER-02
  documents. So this is an independent re-implementation and must mirror upstream EXACTLY: run
  `zstd --quiet --version`, collect stdout AND stderr into one string, swallow a throw to `''`, and
  branch on `versionOutput === '' ? Gzip : Zstd` -- the parsed semver is computed and then NOT used,
  so a broken-but-present zstd still selects zstd. Comment-lock it to the pinned version pointing at
  `cacheUtils.js`, and add "re-read `getCompressionMethod`; VER-05 duplicates it" to the
  `@actions/cache` bump checklist. Surfaced, NOT gated. MEASURED 2026-07-26: zstd v1.5.7 and GNU tar
  1.35 ARE present on `windows-11-arm`, so O4 is not blocked -- but zstd comes from `C:\tools\zstd`,
  NOT bundled by Git for Windows as the debug report claimed, which makes its presence a runner-image
  provisioning choice and MORE likely to move than assumed.
- [ ] **VER-06**: The cross-OS behavioural close is a `dogfood-verify` leg on windows-11-arm that
  reads back the entry `dogfood-seed` wrote on ubuntu-24.04-arm. A MISS fails the job. This, not a
  unit spec, is the load-bearing control: a spec runs in one process on one OS and cannot observe
  a two-OS property. It asserts PROVENANCE, not presence -- the seed key is
  `nx-cache-<GITHUB_RUN_ID>`, one key per RUN and not per OS, so the moment a Windows `dogfood-seed`
  leg exists the Windows verify would restore the Windows-written entry and pass even if cross-OS
  restore were completely broken. Extend `dogfoodBody` to encode the producing OS and assert the
  Windows leg read a LINUX-produced body. The vacuity condition is written into the job comment.
  This is the Actions-cache mirror image of the Releases-side trap OBS-05 closes; the asymmetry was
  an omission, not a decision.
- [ ] **VER-07**: The archive directory exists and the literal stays gitignored. `put()` calls
  `writeFile` before anything creates `.nx/cache`, so on a fresh runner or after `nx reset` that is
  ENOENT, which rethrows (not a `ReserveCacheError`) into a 500 and fails the build -- writes are
  fail-closed by design. One `mkdir` with `{ recursive: true }` at construction covers it. The read
  path self-heals because `extractTar` runs `io.mkdirP`; the write path does not. `.gitignore`
  covers `.nx/cache`, NOT `.nx/` wholesale -- so a later tidy to `.nx/github-cache/` would put a
  transient multi-megabyte file into Nx's workspace file map and produce a self-referential,
  intermittent task-hash perturbation. Comment-lock the literal as chosen because it is GITIGNORED,
  not merely because it is workspace-relative. `nx reset` deletes `.nx/cache`, and TEST-10 mandates
  a reset, so the Phase 11 proof order is reset FIRST, then start the sidecar.
- [ ] **ROBUST-04**: `npm run build:action` runs in the SAME COMMIT as any edit to a
  `serve()`-reachable source. The committed `start-cache-server/index.js` INLINES both
  comment-locked helpers and `getCacheVersion`'s `windows-only` branch, and four `ci.yml` sidecar
  jobs run that committed bundle from the git ref rather than a build output. Drift means the
  sidecar writes at one cache version while the publish action restores at another -- **the mirror
  silently stops receiving anything**, surfacing only as the all-restore-MISS warning that OBS-04
  has just told everyone to expect exactly once. `action-bundle-drift` catches it, but only on push,
  after the misleading signal has already been rationalised.

### Cross-OS outcomes (XOS)

- [ ] **XOS-01**: A local Windows developer gets a cache HIT for `build`, `typecheck` and `test`
  from artifacts produced by Linux CI, via the Releases mirror. (O1)
- [ ] **XOS-02**: A local Windows developer gets a cache HIT for `integration` from artifacts
  produced by Windows CI. Measured BEFORE the CORR-02 rename as a baseline and AFTER as a
  non-regression. (O2)
- [ ] **XOS-03**: Windows CI gets a cache MISS for `integration` produced by Linux CI. **This is a
  statement about Nx HASHES, not about cache storage.** After VER-01/VER-03 the storage layer no
  longer partitions by OS, so a storage-level probe for the Linux hash from a Windows runner would
  HIT -- asserting a 404 there would assert a property this milestone deliberately destroyed. The
  MISS occurs because Windows never ASKS for the Linux key. See TEST-09 for the proof shape.
  MEASURED 2026-07-26: `integration` hashes differ across the two runners as designed
  (`8865876519165210738` vs `1822904335635353663`), so CORR-04's mechanism is confirmed working at
  this commit. (O3)
- [ ] **XOS-04**: `ci.yml` runs `build`, `typecheck` and `test` on a windows-11-arm leg in addition
  to the ubuntu leg. Without this there is no Windows job that could exhibit O4's HIT. Note the
  `integration` matrix is NOT the wiring precedent here -- see XOS-08.
- [ ] **XOS-05**: Those Windows legs get a cache HIT for all three targets from entries saved by
  the ubuntu leg. Whether they also WRITE is an explicit recorded decision; if they write, the loss
  of clean Linux attribution is recorded alongside TRUST-11/12, **and a scheduled
  `--skip-nx-cache` windows-11-arm job becomes required rather than optional** -- once Windows
  replays Linux verdicts for all three targets, a Windows-only regression in the code under test is
  otherwise invisible forever, and the success signal for O4 (every target `[remote cache]`, wall
  time collapsing to sidecar overhead) is the identical observation. (O4)
- [ ] **XOS-08**: The O4 proof has an explicit producer-to-consumer ordering: the Windows legs
  declare `needs:` on the corresponding ubuntu jobs, mirroring `dogfood-seed` -> `dogfood-verify`.
  The `integration` matrix precedent does NOT transfer -- its two legs compute DIFFERENT hashes, so
  parallelism is harmless; the new legs compute the SAME hash, so run in parallel they both MISS,
  both execute, and both race `saveCache`. The cross-push alternative is also foreclosed: once
  PARITY-08 lands, the very commit that ADDS the Windows legs invalidates the `test` hash, so
  proving it on a later push would need a second no-op push.
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
- [ ] **RETAIN-05**: Three things RETAIN-04 does not cover. (a) The shard already holds ~50 PoC-era
  `<hash>.tar.gz` assets that match NO filter, before or after RETAIN-04 -- they have never been
  prunable and are permanent occupants of the 1000-asset per-release cap, whose overflow degrades to
  skip-and-warn rather than an error. Decide explicitly: prune once by hand, add a third accept
  branch, or record as accepted dead weight with a count. Do not leave the question unasked.
  (b) The two accept branches are asserted MUTUALLY EXCLUSIVE directly -- non-overlap is currently a
  property of the last-`-` split, not of the design. (c) After D2-03, `CACHE_KEY_PREFIX` becomes
  QUADRUPLY load-bearing: the Actions-cache key, `isServerProducedKey`, the asset name, and the
  cleanup filter. Changing it silently orphans the entire mirror, and RETAIN-04's legacy branch
  would NOT cover the orphans because it only knows `<hash>-<os>`. Pin the literal by spec and
  comment-lock it as governing four things.

### CREEP trust posture (TRUST)

- [ ] **TRUST-10**: C1 (write-trust allowlist), C2 (sync gate) and C16's enumeration-side filter
  (`isServerProducedKey`, over Actions-cache keys) are unchanged, verified rather than assumed.
  C16's Releases-side filter (`isServerProducedAssetName`) DOES change under CORR-02/RETAIN-04;
  the change is additive. The `ref` scoping of `listCacheEntries` (`action/index.ts:40-43`) is
  pinned by spec and comment-locked: with the OS-version barrier removed it becomes the ONLY
  in-repo control keeping non-default-branch trusted writes (`TRUSTED_EVENTS` includes `push` with
  no ref check) out of the world-readable mirror.
- [ ] **TRUST-11**: The phase threat model records where first-write-wins arbitrates between
  NON-identical payloads -- **at `saveCache`, not at the Release upload.** Two publish legs never
  produce differing payloads: for a given hash the Actions cache holds exactly ONE entry, and both
  legs restore it and upload it verbatim without re-executing the task, so the uploaded bytes are
  byte-identical. The real race appears only once XOS-04 puts `build`/`typecheck`/`test` on a
  Windows leg: two jobs then compute the same hash H and both call `saveCache(nx-cache-H)`, and the
  winner owns the entry INCLUDING its OS-specific captured terminal output (`ci.yml:652`). That race
  IS ordering-dependent, because the legs run in parallel. XOS-06 is satisfied because no
  requirement DEPENDS on the winner, not because the race does not exist. **This moves TRUST-11's
  residual risk into the XOS-05 write decision** -- a cross-phase consequence.
  Two clauses that remain correct as originally written: the month-shard newest-first read walk
  makes the winner shard-dependent when a hash is mirrored into two shards; and cross-OS restore is
  byte-faithful (tar-in-tar, inner entry names forward-slash-normalised by `resolvePaths`), so the
  out-of-scope file-mode question applies to the Nx client's extraction of the INNER tar, not to our
  transport. Separately and regardless: `publish-mirror.ts:159`'s "byte-identical under CORR-01"
  comment is rewritten in the SAME COMMIT as CORR-02 -- byte-identity survives, but its REASON
  changes from OS-namespacing to one-entry-per-hash.
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
- [ ] **DOCS-08**: Every location asserting same-OS restore as a load-bearing invariant is
  corrected, since VER-03 inverts it. The list is FOUR, not two: `docs/advanced.md:54-57`,
  `docs/advanced.md:45`, `ci.yml:577-583`, and `ci.yml:356-360` (the integration job's comment makes
  the same now-false claim and is easy to miss). `ci.yml:693` and `read-back.ts:10-31,52-56` assert
  the same contract and belong to Phase 10's CORR-02/OBS-05 work rather than here.
  `README.md:125` and `docs/trust-and-security.md:155` are a DIFFERENT case and must not be
  "corrected" as though they were wrong: both frame "never a wrong result" as a consequence of FAULT
  DEGRADATION ("every read fault degrades to a MISS"), which stays true. The edit there is ADDITIVE
  -- a new precondition about target platform-agnosticism -- not a contradiction.

### Verification (TEST)

- [ ] **TEST-08**: Each of O1-O4 has a recorded live proof executed in the mandated order.
  Evidence is defined: the workflow run URL (O3/O4) or captured terminal output (O1/O2), the Nx
  hash observed, and the literal `[remote cache]` label. The O1 proof additionally captures
  PRODUCER ATTRIBUTION at proof time -- per hit hash, the Actions-cache entry list and shard asset
  list with `created_at`, cross-referenced against job windows -- because enabling O4 permanently
  destroys the ability to re-derive it. **The attribution window closes at Phase 9, not Phase 12** --
  once the version is OS-invariant the ubuntu publish leg starts mirroring the Windows `integration`
  entry too, so the shard stops being "everything here is ubuntu's" before Phase 11 runs. Capture
  `created_at` and the OBS-03 label per asset, not just the asset list.
  The premise that Windows CI produces no `build`/`typecheck`/`test` hash is asserted mechanically
  against the RESOLVED task graph for the Windows leg's actual command, not assumed from the job
  list, and the assertion output is captured as evidence rather than discarded as a pre-flight
  check. The premise is a property of the CURRENT graph, not of the config: `integration`'s
  `dependsOn: ["^build"]` resolves to zero tasks only because this is a single-project workspace,
  and the `typecheck` job already touches the `build` hash as a dependency.
  Every "the job was green" claim is paired with a COUNT that would differ under the failure
  hypothesis, named in the plan rather than after the run; `ACTIONS_STEP_DEBUG` is on for the
  proving run, since restore MISSes log at `core.debug` and are otherwise absent from the log.
- [ ] **TEST-09**: The O3 proof is an Nx-HASH proof, not a storage probe, and runs AFTER VER-01 and
  VER-03 have landed. A storage-level probe is now INVALID: with the version OS-invariant,
  `restoreCache([path], 'nx-cache-<H_linux>')` on windows-11-arm would HIT, so asserting a 404 would
  assert a property this milestone deliberately destroyed -- and if it DID 404, the likeliest cause
  is a compression-method divergence (VER-05's third component), which is exactly the
  "passes for the pre-change reason" failure this requirement exists to prevent, inverted.
  Three parts: (1) cite CORR-03(b)'s build-gating record that `H_linux != H_win` for `integration`
  at the commit -- Phase 11 cites it, it does not re-derive it; (2) show the Windows `integration`
  task EXECUTED, carrying no `[remote cache]` label, in a run where `nx-cache-<H_linux>`
  demonstrably existed in the Actions cache at the time; (3) a POSITIVE CONTROL in the same job -- a
  scripted authed GET on a known-present key returns 200 through the same sidecar and backend, so
  part 2 is not an artifact of a dead sidecar. `ci.yml`'s existing readiness GET is already that
  shape, so this extends a proven pattern. A run that MISSes everything is not a valid proof.
  So reframed, the proof is STRONGER: it shows the declared Nx input is the only thing separating
  the two targets, which is CORR-04's actual claim.
- [ ] **TEST-10**: The O1/O2 local proofs begin from a cleared local Nx cache (`nx reset`), and the
  order is reset FIRST, THEN start the sidecar -- `nx reset` deletes `.nx/cache`, which is where
  VER-07 puts the archive, so resetting under a running sidecar makes the next PUT 500. A HIT
  recorded without a preceding reset is not accepted: a local cache hit short-circuits before the
  remote is ever queried, and a warm-graph copy can serve tasks locally from an artifact directory
  containing no artifacts, never consulting the remote at all.
  The proof records WHICH QUESTION it answers. `nx reset` clears `.nx/workspace-data` as well as
  `.nx/cache`, so it forces the COLD state -- which makes the proof "does a cold Windows box hit",
  not "does my everyday box hit". Both are legitimate questions and PARITY-04 names the second one;
  do not let the reset silently substitute one for the other.
  A soundness probe runs BEFORE the measurement, not after: a 401-vs-404 pair on a known-absent hash
  proves auth and reachability together, and a differential against a dead port proves the requests
  actually left the process. Record the probe's timestamp as preceding the first Nx run. The
  `Cache: n/m hit` line is recorded and explicitly marked NON-DISCRIMINATING in both directions --
  a `0%` prints identically with no sidecar at all, and a non-zero count includes local hits.

### Observability (OBS)

- [ ] **OBS-02**: Proof evidence is a non-zero count of tasks carrying the literal `[remote cache]`
  label, named per target. Nx 23.1's end-of-run performance report is supporting context only --
  it cannot separate local from remote, cannot attribute a producer OS, and prints an identical
  `0%` line for a run with no sidecar at all. It renders to the job summary in CI and to the
  terminal locally.
- [ ] **OBS-03**: Every mirrored asset records `mirrored-by: <os>` in Release asset metadata that
  is NOT part of the lookup name (the free-form `label` field). The store stays OS-invariant for
  lookup; only attribution is preserved. CORR-02 otherwise removes the only means of attributing a
  served artifact to a producer -- an incident-response gap of the same class the ADR weighed
  decisively when choosing Releases over GHCR.
  **It is `mirrored-by`, NOT "producing OS", and the distinction is load-bearing.** The label can
  only derive from the PUBLISHING leg's `cachePlatform()`; `listCacheEntries` returns `{ key }`
  only, and the Actions-cache API exposes no producing-OS field. Publisher-OS equals producer-OS
  today only because restore is same-OS -- and VER-03 is precisely what breaks that identity, so
  from Phase 9 the ubuntu leg can mirror a Windows-produced entry and would label it `linux`.
  Claiming "producing OS" would therefore be WRONG in exactly the cross-OS case the label exists to
  serve. Any stronger claim -- in particular that the label answers "whose bytes did the developer
  get" -- is explicitly RETRACTED and must not appear in TRUST-11/12 or DOCS-08.
  Requires a seam widening no other requirement mentions: `uploadReleaseAsset(releaseId, name,
  bytes)` gains a `label` parameter, plumbed through `action/index.ts` and every fake in
  `publish-mirror.spec.ts`.
- [ ] **OBS-04**: The all-restore-MISS warning's message drops the now-false "different OS"
  explanation and names cache-version rotation as a candidate cause. The expected signal of the
  first post-change push is recorded IN ADVANCE (all-miss on both publish legs, `mirrored == 0`).
  The tripwire is gated on **two consecutive all-miss pushes with NO version-affecting change in
  between**, not on a raw push counter: there are THREE legitimate rotation windows in this
  milestone, not one -- Phase 7's inferred `lint` target rotates `hash_project_config` (and `nx.json`
  is itself a `test` fileset input, so registering the plugin rotates `test` twice over), VER-01
  rotates the cache version on every OS, and CORR-02 rotates the asset name. A tripwire that fires
  on correct work gets disabled, and then it is not a tripwire. It stays a warning, not a hard
  failure. Note `enableCrossOsArchive` alone rotates only WINDOWS entries -- on Linux and macOS the
  flag is a no-op on the version -- so the first-push all-MISS on BOTH legs is caused by the PATH
  change, not the flag.
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
| LINT-02 | CORR-05 violation removal | The rule must be proven to CATCH all FOUR violations before they are removed, or nothing shows the rule works. Phase 7 lands a described disable at each site so the build stays green; LINT-06 then forces each out with its violation |
| PARITY-08 | any spec asserting on `ci.yml` | Without the `test` input the spec serves a stale cached PASS |
| VER-07 | VER-01 | The archive directory must exist before the first `writeFile` at the new path |
| PARITY-01 | PARITY-03 | Root-cause before fixing |
| PARITY-01 | DOCS-07 | The checklist is derived from the findings |
| PARITY-03 | XOS-01 | Hash parity is O1's precondition |
| ROBUST-04 | (same commit as any `serve()`-reachable edit) | Otherwise the sidecar and the publish action compute different cache versions and the mirror silently stops receiving |
| RETAIN-05 | (same commit as CORR-02) | The `CACHE_KEY_PREFIX` lock and branch-disjointness assertions guard the same change RETAIN-04 makes |
| XOS-08 | XOS-05 | Without the producer-to-consumer ordering the two legs both MISS and race `saveCache`, so the HIT cannot occur |
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
| Empirical divergence-detection subsystem | STRUCTURAL, not merely disproportionate: no surveyed build cache detects a portability violation at serve time, because every detector that exists re-executes the task (Nix `nix-store --realise --check`, exit code 104; Debian `reprotest`; Develocity's out-of-band scripts). A cache that re-runs tasks is not a cache. NOTE: "O4's green CI is the portability evidence" is NOT the reason -- that argument is circular, since a restored task does not execute, and Nix's `--check` exists precisely because an existing store path proves nothing until you rebuild. One exception is carried as a CONDITIONAL clause on XOS-05, not as a subsystem |
| Per-job or per-target OS-invariance flag | D2-02. The stronger reason is LAYER, not adopter count: every comparator puts the portability knob in the task DECLARATION (`@CacheableTask`, a `runtime` input, REAPI `Platform`), never in the cache BACKEND -- a backend-level knob would be an ecosystem inversion. "Wrong layer" does not expire the way "zero adopters" does. NOT forbidden by TRUST-05, which is scoped to RW-vs-RO |
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
| PARITY-01 | Phase 8 | Pending (must control BOTH the OS and freshness axes) |
| PARITY-02 | Phase 8 | Pending (per-node `details` instrument) |
| PARITY-03 | Phase 8 | Pending (four values per target, not two) |
| PARITY-04 | Phase 8 | Pending (warm-local vs cold-CI as a named question) |
| PARITY-05 | Phase 8 | Pending |
| PARITY-06 | Phase 8 | Pending |
| PARITY-07 | Phase 8 | Pending |
| CORR-03 | Phase 8 | Pending |
| CORR-04 | Phase 8 | Pending |
| PARITY-08 | Phase 9 | Pending (must land before any spec asserts on `ci.yml`) |
| VER-01 | Phase 9 | Pending |
| VER-02 | Phase 9 | Pending |
| VER-03 | Phase 9 | Pending |
| VER-04 | Phase 9 | Pending (drift guard -- identity MEASURED to hold today) |
| VER-05 | Phase 9 | Pending (zstd MEASURED present; O4 not blocked) |
| VER-06 | Phase 9 | Pending (asserts provenance, not presence) |
| VER-07 | Phase 9 | Pending (before VER-01's first write) |
| ROBUST-04 | Phase 9 | Pending (also Phase 10; Phase 7 if autofix touches those files) |
| OBS-04 | Phase 9 | Pending |
| DOCS-08 | Phase 9 | Pending (four locations, not two) |
| CORR-02 | Phase 10 | Pending |
| RETAIN-04 | Phase 10 | Pending (same commit as CORR-02) |
| RETAIN-05 | Phase 10 | Pending (same commit as CORR-02) |
| CORR-05 | Phase 10 | Pending (4 sites; 1 removed in Phase 9 with VER-02; site 4 needs an explicit Phase 10 call) |
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
| XOS-05 | Phase 12 | Pending (live-CI only; carries the conditional scheduled-detector clause) |
| XOS-08 | Phase 12 | Pending (`needs:` ordering -- without it the HIT cannot occur) |
| DOCS-07 | Phase 12 | Pending |

**Coverage:** 50 requirements, 50 mapped, 0 orphans, 0 duplicates. Distribution: Phase 7 = 7,
Phase 8 = 9, Phase 9 = 11, Phase 10 = 12, Phase 11 = 7, Phase 12 = 4. Verified mechanically by
set-differencing the defined IDs against the traced IDs in both directions.

---
*Requirements defined: 2026-07-26*
*Revised 2026-07-26 after adversarial review by five independent critics (52 findings triaged:
15 independently verified, 4 inter-critic conflicts resolved, 5 rejected).*
*Traceability populated 2026-07-26 at roadmap creation (Phases 7-12).*
*Amended 2026-07-26 after the four-dimension milestone research and the live cross-OS pre-flight
probe (`research/v0.0.2/SUMMARY.md`, `PROBE-RESULTS.md`): 11 blocking corrections, 5 new
requirements (PARITY-08, VER-07, ROBUST-04, RETAIN-05, XOS-08) plus 3 new PARITY IDs from the
freshness-axis discovery, and one conditional clause on XOS-05. Phase count, phase order and
per-phase ownership are unchanged -- the research explicitly endorsed the committed sequence.*
