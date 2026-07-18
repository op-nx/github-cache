# Roadmap: @op-nx/github-cache

**Core Value:** Correct and safe caching on GitHub infrastructure, for public and private
repos, with nothing extra to host. A remote cache must never serve a wrong or poisoned
artifact and must never let an untrusted trigger write; correctness and CREEP-safety come
before every other feature. If everything else fails, reads stay best-effort (a fault
degrades to a MISS, never a broken build) and writes stay gated.

**This is a greenfield rebuild, delivered as MVP vertical slices.** The current
implementation is a spike/PoC and is being DELETED and rebuilt ground-up; sunk cost is zero.
The `.planning/codebase/*` docs describe the PoC - a historical record of what worked
(valuable input), NOT current state. Each build phase (1-6) delivers one end-to-end,
dogfoodable capability, built test-first (TDD); Phase 0 is a teardown/prep phase. Slices
stack: the walking skeleton comes first, then the default CI cache, then cross-context read,
then publish/retention, then trust-widening, then distribution/docs.

**Rebuild method is Nx-native.** Teardown removes the existing project with
`nx g @nx/workspace:remove`; every new project is created with an `nx g` generator (e.g.
`@nx/js:lib`). Exact generator flags are resolved at plan/execute time, not here. The Nx
workspace SHELL is preserved (nx.json, root tsconfigs, vitest.workspace, root package.json,
.gitattributes `eol=lf`) - only the cache project, its actions, and its CI are torn down.

**Foundations are LOCKED (grounding, not phase work).** Do not reopen: reader = GitHub
Releases (FOUND-01); default composition = Actions-cache CI-RW only, one backend per process
via `selectBackend`; publish/cleanup is reader-specific (behind no port); write-trust =
host-detected fail-closed allowlist; sync gate = `{push, schedule}`; no content signing;
OS-namespacing; Nx PUT floor = hard `200`/Nx-21+; distribution = npm package + JS Action,
Docker deferred to a later milestone (FOUND-03). Full decision record + CREEP control ledger C1-C18:
`.planning/ARCHITECTURE-DECISION.md`. Locked requirement set: `.planning/REQUIREMENTS.md`.
Reader spike (FOUND-01, Releases chosen): `.planning/spikes/001-005`.

**Granularity:** standard (7 phases: 1 teardown + 6 build slices).

**De-priming gate (Phase 0 -> Phase 1):** the `.planning/research/*` docs were already reframed
brownfield -> greenfield at planning time (PoC-implementation references scrubbed; the
implementation-independent platform facts kept - see PITFALLS.md "Empirically-Verified Platform
Facts"), and PROJECT.md was reconciled. Phase 0's remaining de-priming step is to run
`/gsd:map-codebase` on the torn-down (shell-only) workspace so `.planning/codebase/*` no longer
describes the deleted PoC, then confirm no rebuild-priming artifact remains. The codebase map
re-populates as the slices land.

## Phases

- [x] **Phase 0: Teardown** - Strip the PoC + its cache-coupled CI; leave the Nx workspace green with a lean, cache-independent baseline CI. (completed 2026-07-18)
- [x] **Phase 1: Walking Skeleton** - A new lib speaks the Nx self-hosted-cache HTTP contract E2E against a trivial in-process backend, proven by a conformance fixture. (completed 2026-07-18)
- [ ] **Phase 2: Default Cache in CI** - Actions-cache CI-RW backend + context-derived `selectBackend` + conservative write gate + per-hash lock, dogfooded live in this repo's CI.
- [ ] **Phase 3: Cross-Context Read** - GitHub Releases read-only reader + authenticated private-repo local read + OS-namespacing, so a cross-OS hit never serves a wrong-OS artifact.
- [ ] **Phase 4: Publish + Retention + Observability** - The `{push,schedule}`-gated publish/sync engine + safe age-based cleanup + fail-loud observability + storage-cap graceful degradation.
- [ ] **Phase 5: Trust-Widening + PPE Gate** - Host-detected fail-closed `pull_request`/`release` write-trust + single-source allowlist + server-produced-key mirror filter + shipped PPE-hygiene gate.
- [ ] **Phase 6: Distribution + Docs + Governance** - npm package + JS Action + background-step CI pattern + enumerated/tested public surface + adoption docs + SECURITY.md/LICENSE/semver.

## Phase Details

### Phase 0: Teardown

**Goal**: Remove the spike/PoC cache project and its cache-coupled CI while leaving the Nx
workspace shell intact and green, with a lean project-agnostic baseline CI that passes whether
or not any remote cache exists.

**Depends on**: Nothing (first phase; operates on the existing spike/PoC checkout).

**Requirements**: None (prep phase - clears the ground for the greenfield rebuild; no v0.0.1
requirement is delivered here).

**Success Criteria** (what must be TRUE):

  1. The `op-nx-github-cache` project is gone (removed via `nx g @nx/workspace:remove`), and
     `start-cache-server/`, `publish-mirror/`, and `.verdaccio/` no longer exist; the Nx
     project graph resolves with no dangling references to any of them.

  2. `.github/workflows/mirror-cleanup.yml` is deleted, and `ci.yml` contains no reference to
     `./start-cache-server`, the `build` job's `nx reset`+reseed, the `windows-selfcheck` job,
     or the `publish-mirror` job.

  3. The reworked `ci.yml` runs `format-check`, `build`, `typecheck`, `test`, and an
     ubuntu+windows `integration` matrix on Nx's LOCAL cache only, and passes green with no
     remote cache present.

  4. The Nx workspace shell is intact (nx.json, root tsconfigs, vitest.workspace, root
     package.json, `.gitattributes eol=lf`) and `nx build`/`nx test` across the remaining
     projects is green.

  5. De-priming is complete: `/gsd:map-codebase` has regenerated `.planning/codebase/*` against
     the torn-down workspace (no PoC trace). (The `.planning/research/*` brownfield -> greenfield
     reframe and the PROJECT.md reconciliation were already done at planning time.) A final check
     confirms no rebuild-priming artifact remains.

**Plans**: 5/5 plans complete
**Wave 1**

  - [x] 00-01-PLAN.md - Remove the PoC project + siblings, scrub nx.json/package.json, resync lockfile (SC1, SC4) [wave 1]
  - [x] 00-02-PLAN.md - Rework ci.yml to the 5-job local-cache-only baseline + delete mirror-cleanup.yml (SC2, SC3) [wave 1]
  - [x] 00-03-PLAN.md - De-priming doc hygiene: .prettierignore + neutral README.md (SC3 format gate, SC5 README) [wave 1]

**Wave 2** *(blocked on Wave 1 completion)*

  - [x] 00-04-PLAN.md - Graph-clean + green acceptance battery across the merged tree (SC1, SC3, SC4) [wave 2]

**Wave 3** *(blocked on Wave 2 completion)*

  - [x] 00-05-PLAN.md - SC5 de-priming: /gsd:map-codebase regenerate + no-trace check (SC5) [wave 3]

**Cross-cutting constraints:**

- `npx nx format:check --all` exits 0

**Risks**:

  - `nx g @nx/workspace:remove` can leave dangling references (tsconfig path aliases,
    `nx.json` targetDefaults, root `package.json` scripts); verify the graph and a clean
    `nx run-many` after removal.

  - The `ci.yml` rework must not disturb the load-bearing workspace invariants
    (`.gitattributes eol=lf`, cross-OS parity) even though nothing consumes them yet - they
    are the foundation Phase 3's cross-OS correctness stands on.

### Phase 1: Walking Skeleton

**Goal**: A new library speaks the Nx self-hosted-cache HTTP contract end-to-end against a
trivial in-process backend, proving the protocol before any real storage exists.

**Mode:** mvp

**Depends on**: Phase 0 (needs the torn-down, green workspace and clean baseline CI to
scaffold the new lib into).

**Requirements**: SRV-01, SRV-02, SRV-03, SRV-04, SRV-05, TEST-07.

**Success Criteria** (what must be TRUE):

  1. A fresh library (created via `nx g @nx/js:lib`) runs an HTTP server that binds loopback
     only (SRV-01), requires a timing-safe bearer token (SRV-02), validates the `{hash}` path
     (SRV-03), caps body size (SRV-04), and degrades a read fault to a MISS (SRV-05) - each
     covered by a test written first (TDD).

  2. `GET`/`PUT /v1/cache/{hash}` round-trips through a trivial in-process backend: a PUT
     stores and returns exactly `200`, a second PUT of an existing record returns `409`, an
     unauthorized request `401`, a forbidden/read-only PUT `403`, and a missing GET `404`,
     with the required `Content-Length`.

  3. A conformance fixture hashes the full vendored Nx spec and pins a named Nx version (not
     `info.version`), and fails if the server returns anything other than `200` on PUT success
     (Nx 21+ hard floor) or the vendored spec drifts. (TEST-07)

  4. `nx test` for the new library is green, and a real `serve` process answers a scripted
     GET/PUT locally.

**Plans**: 4/4 plans complete

**Wave 1**

  - [x] 01-01-PLAN.md - Scaffold the `@op-nx/github-cache` lib via `nx g @nx/js:lib` (inferred
    targets, zero deps) + wire root tsconfig `references[]` (SRV-01) [wave 1]

**Wave 2** *(blocked on Wave 1 completion)*

  - [x] 01-02-PLAN.md - Authenticated E2E round-trip spine: `CacheBackend` port + writable Map
    backend + `node:http` server happy path + timing-safe CSPRNG auth (SRV-01, SRV-02) [wave 2]

**Wave 3** *(blocked on Wave 2 completion)*

  - [x] 01-03-PLAN.md - Server hardening: hash validation (400 pre-backend), 2 GiB body cap
    (413-socket-destroy), best-effort read (404)/fail-closed writes, 409 + 403 read-only seam
    (SRV-03, SRV-04, SRV-05) [wave 3]

**Wave 4** *(blocked on Wave 3 completion)*

  - [x] 01-04-PLAN.md - SC4 real `serve` entrypoint + TEST-07 conformance fixture (vendored Nx
    spec sha256 drift guard + hard-`200` behavioral run) (TEST-07) [wave 4]

**Risks**:

  - The Nx contract's PUT-success code changed `202 -> 200` between Nx 20 and 21 while
    `info.version` stayed `1.0.0`; the fixture MUST hash the full vendored spec and pin the
    Nx version, never watch `info.version`.

  - The server-security properties are now numbered SRV-01..05 (loopback bind, timing-safe
    auth, hash validation, body cap, best-effort MISS); each needs a first-written test - they
    are Core-Value hardening, not incidental.

### Phase 2: Default Cache in CI

**Goal**: The default composition - the Actions-cache CI-RW backend, selected purely by
runtime context, gated by a conservative default-deny write-trust and serialized by a per-hash
lock - is dogfooded live in this repo's CI. First real GitHub cache.

**Mode:** mvp

**Depends on**: Phase 1 (plugs a real backend into the contract server + backend port proven
by the walking skeleton).

**Requirements**: TEST-01, TEST-02, ROBUST-03, ROBUST-04, TRUST-03, TRUST-05.

**Success Criteria** (what must be TRUE):

  1. `selectBackend(env)` returns the Actions-cache RW backend in CI and a read-only backend
     locally, chosen only from runtime context (no caller-facing mode flag); unit specs cover
     CI-vs-local, `GITHUB_REPOSITORY` validation, `GH_TOKEN || GITHUB_TOKEN` fallthrough,
     malformed-repo rejection, and the explicit `env` param. (TEST-01, TRUST-05)

  2. A conservative default-deny write gate trusts only `push`/`schedule` and refuses every
     dangerous shared-default-scope event (`pull_request_target`, `issue_comment`,
     fork-`workflow_run`, and any non-allowlisted trigger), asserted by test. (TRUST-03)

  3. `withHashLock` serializes same-hash writes, runs different hashes concurrently, evicts
     the map entry on completion, and a rejected op does not wedge the lock, all under test.
     (TEST-02)

  4. `serve` handles `SIGTERM` by draining in-flight writes before exit (background-step
     teardown safe), covered by an in-flight-put drain test. (ROBUST-04)

  5. This repo's CI runs `serve` against the Actions-cache backend and gets real hits/misses,
     with `@actions/cache` and other hash-sensitive deps pinned exact (not `^`) and upgrades
     gated behind a `test:act` end-to-end round-trip. (ROBUST-03)

**Plans**: TBD

**Risks**:

  - `@actions/cache` version-hashes the literal temp-path strings; the archive-path helper must
    be the single source of truth and must not change without re-verifying an end-to-end
    restore (`test:act`) - this class of bug fails silently as a MISS.

  - The SIGTERM drain must not deadlock the runner's implicit `wait-all` before post-job
    cleanup; test the in-flight-put drain explicitly.

  - Phase 2's gate is deliberately conservative (push/schedule only); `pull_request`/`release`
    widening is Phase 5 (TRUST-01) - do not widen early.

### Phase 3: Cross-Context Read

**Goal**: A developer on any OS reads this repo's CI-produced cache locally through the GitHub
Releases reader using their existing GitHub auth, and a cross-OS hit never serves a wrong-OS
artifact.

**Mode:** mvp

**Depends on**: Phase 2 (`selectBackend` provides the second, local read context; the CI
cache from Phase 2 produces the entries the reader reads back).

**Requirements**: FOUND-02, TEST-05, CORR-01.

**Success Criteria** (what must be TRUE):

  1. `selectBackend` returns a GitHub Releases read-only reader in local context; a developer
     with existing GitHub auth (git credential helper / `gh` / `GH_TOKEN`|`GITHUB_TOKEN`) reads
     a private-repo cache entry with no dependency on anonymous/public access. (FOUND-02)

  2. The store is OS-namespaced by default (or the consumer requirement to OS-discriminate
     non-portable outputs is documented and enforced) so a Linux-produced entry is never served
     to a Windows reader; the discriminator lives in the key/namespace, not left to chance.
     (CORR-01)

  3. A cross-OS round-trip test restores both an OS-invariant and an OS-sensitive artifact
     published from each CI OS (ubuntu + windows) through the Releases reader, and asserts a
     cross-OS lookup returns a correct hit or a MISS - never a wrong-OS artifact. (TEST-05)

  4. The local reader is read-only by construction (no local write path) and any read fault -
     missing asset, auth failure, rate limit - degrades to a MISS rather than breaking the
     build.

**Plans**: TBD

**Risks**:

  - Cross-OS hash divergence and the cross-OS publish gap both failed SILENTLY in the PoC (a
    MISS or a wrong result, not a crash); `.gitattributes eol=lf`, a single-source archive-path
    helper, and the per-OS matrix are load-bearing and comment-locked - re-verify an end-to-end
    restore on any change.

  - Reading a private repo depends on real developer auth; do NOT let an anonymous/public
    convenience path become a hidden dependency (FOUND-02 forbids it).

### Phase 4: Publish + Retention + Observability

**Goal**: The default-branch `{push,schedule}`-gated publish/sync engine mirrors CI-produced
entries to Releases, prunes them by age safely, fails loud on whole-run failure, and degrades
gracefully at the storage caps instead of breaking the build.

**Mode:** mvp

**Depends on**: Phase 3 (the publisher must write keys the Releases reader can find - the
reader's key scheme and OS-namespacing settle first) and Phase 2 (the write gate + injected
client seam).

**Requirements**: TEST-03, TEST-04, TEST-06, ROBUST-01, ROBUST-02, ROBUST-05, TRUST-02,
TRUST-07, RETAIN-01, RETAIN-03, OBS-01.

**Success Criteria** (what must be TRUE):

  1. A separate sync/publish gate = literally `{push, schedule}` on the default branch (NOT
     the write allowlist) publishes CI entries to Releases and is test-locked to reject
     `pull_request`, `release`, `repository_dispatch`, `workflow_dispatch`, `merge_group`,
     `delete`, `registry_package`, `page_build`, and non-default refs. (TRUST-02)

  2. The publish + cleanup orchestration runs behind an injected client and is tested across
     already-exists / not-found / other-fault branches; every fault is discriminated
     structurally via Octokit `error.status` (never stderr text) on both the publish and delete
     paths, so a real fault is never mistaken for absence. (TEST-03, ROBUST-01)

  3. Age-based cleanup prunes expired assets and retains within-window ones; the list phase
     aborts with ZERO deletions on any non-404 fault or incomplete pagination, the delete phase
     isolates per-item failures with a non-zero exit on aggregated failure, and deletion uses
     the same `contents:write` `GITHUB_TOKEN` that publishes under a queue-don't-cancel
     `concurrency:` group. (TEST-04, TEST-06, RETAIN-01, RETAIN-03)

  4. The mirror never overwrites an existing hash-named asset (first-write-wins; a same-hash
     trusted write is byte-identical, a benign no-op); an artifact at the ~2 GiB
     Releases/body-cap boundary fails loud rather than silently truncating or dropping; and a
     shard reaching the 1000-asset cap skips-and-warns (workflow annotation) rather than
     hard-failing the build. (TRUST-07, ROBUST-02, ROBUST-05)

  5. A whole-run publish/sync failure fails loud (workflow annotation + non-zero exit) with a
     documented "how do I know the cache is working / detect sync degradation" signal, and a
     local `put()` always returns `403` (read-only-local). (OBS-01, TEST-06)

**Plans**: TBD

**Risks**:

  - Octokit large-asset (~2 GiB) upload via `uploads.github.com` can be finicky
    (Content-Length / buffering); verify a real large-asset upload before relying on it, and
    ensure the boundary case fails loud rather than truncating.

  - The publish gate and the write gate LOOK like one predicate but are two trust boundaries;
    keep the publish gate strictly `{push, schedule}` + default-branch, independent of the
    serve write gate.

  - Cleanup safety hinges on the list phase aborting before any delete on partial pagination;
    inject a mid-pagination fault in the test and assert no deletion.

### Phase 5: Trust-Widening + PPE Gate

**Goal**: Widen write-trust to `pull_request`/`release` only where GitHub's untrusted-default-
branch cache guard exists (host-detected, fail-closed on GHES), from a single-source allowlist,
and ship the adopter-facing PPE-hygiene gate plus the server-produced-key mirror filter that
private-repo mirroring requires.

**Mode:** mvp

**Depends on**: Phase 4 (widens the write gate from Phase 2 and adds the key filter to the
publish/mirror path built in Phase 4).

**Requirements**: TRUST-01, TRUST-04, TRUST-06, TRUST-08.

**Success Criteria** (what must be TRUE):

  1. The write-trust allowlist (configured replaces default; else default implicit;
     default-deny; no denylist) enables `pull_request`/`release` only where GitHub's guard
     exists, detected purely from `GITHUB_SERVER_URL` (`github.com`/`*.ghe.com` -> ON; every
     GHES host -> OFF, fail-closed; no caller flag), asserted by test. (TRUST-01)

  2. The trusted-event allowlist has a single source of truth - the pre-`npm ci`
     dependency-free action copy is generated from / shares it (no dual root copy) - with a
     `selfcheck.cjs` parity assertion that fails on drift. (TRUST-04)

  3. The mirror publishes only server-produced keys (a distinguishing namespace/prefix, never
     "any 1-512 hex" Actions-cache key), and this filter ships before/with enabling the reader
     mirror for any private repo. (TRUST-08)

  4. A shipped, installable PPE-hygiene gate (reusable workflow / composite action running
     `zizmor`/`actionlint` for the named unsafe patterns - no `pull_request_target`+PR-checkout,
     no `issue_comment`/`workflow_run` executing PR code) is consumable by adopters as
     best-effort/advisory defense-in-depth; load-bearing containment stays TRUST-02 +
     default-branch protection. (TRUST-06)

**Plans**: TBD

**Risks**:

  - The `GITHUB_SERVER_URL` host check is fork-spoofable defense-in-depth only; the
    load-bearing control is GitHub's server-side read-only-token guard + scope isolation. No GA
    GHES has the guard today (floor unpublished) - keep any version-gate knob dormant/OFF.

  - TRUST-08 (namespace filter) MUST ship before any private-repo mirror or unrelated
    hex-keyed CI artifacts leak as world-readable assets - sequence it first within the phase;
    Phase 4's public dogfood publish is acceptable pre-filter only because everything is
    already public.

  - The PPE gate is heuristic and cannot catch novel evasions; do not let it read as the
    containment control in docs.

### Phase 6: Distribution + Docs + Governance

**Goal**: Ship the consumer-facing distribution (npm package + JS Action), the CI
background-step consumption pattern, an enumerated/tested public surface, split adoption docs,
and governance so outside repos can adopt the cache safely and know what "breaking" means.

**Mode:** mvp

**Depends on**: Phase 5 (docs describe the final trust/RW-RO model; the public-surface guard
locks the API only after Phase 1-5 have settled it).

**Requirements**: DOCS-01, DOCS-02, DOCS-03, DOCS-04, DOCS-05, DOCS-06, GOV-01, GOV-02,
GOV-03.

**Success Criteria** (what must be TRUE):

  1. The package publishes as `@op-nx/github-cache` (npm) plus a JS Action (not composite),
     and the CI consumption pattern runs `serve` as a GitHub Actions background step
     (`background: true` + an explicit `cancel:` teardown) with a plain `&` fallback for GHES /
     older runners, documented with the JS-action rationale. (DOCS-06)

  2. The public surface (every consumer env knob, action input, package export) is enumerated
     and guarded by a test that fails on unintended changes, so dogfood changes stay
     consumer-safe. (DOCS-05)

  3. A 5-minute default quickstart (Actions-cache CI-RW only) and a separate advanced guide
     (opt-in RO store / sync / cleanup) exist, backed by a minimal example adopter config
     distinct from this repo's maximal dogfood config, plus a config reference for every
     `resolve*` knob and the Nx client vars (`NX_SELF_HOSTED_REMOTE_CACHE_SERVER` /
     `_ACCESS_TOKEN`) with the 10 GB-repo LRU and no-default-local-read notes.
     (DOCS-01, DOCS-02, DOCS-04)

  4. A trust/security section documents which events write, the CREEP posture, the
     github.com-only backstop + GHES floor, never-enable-fork-PR-tokens/secrets,
     default-branch-protection + ephemeral-single-tenant-runner prerequisites, the coupled
     `CACHE_MIRROR_MAX_AGE_DAYS`, read-only-local-by-design, retention-as-storage-hygiene (not
     poison-containment), that mirrored keys are anonymously public, and the freshness-window /
     mid-session-staleness caveats. (DOCS-03)

  5. Governance is in place: a SECURITY.md vulnerability-disclosure policy (required for a
     poisoning-class tool), an MIT LICENSE, and a versioned consumer-contract / semver
     statement defining what "breaking" means for the public surface. (GOV-01, GOV-02, GOV-03)

**Plans**: TBD

**Risks**:

  - DOCS-05's public-surface guard can churn on internal dogfood changes; scope the enumerated
    surface to the consumer contract only (env knobs, action inputs, package exports), not
    internal helpers.

  - The GHES read-only-token version floor is unpublished; docs must state github.com-only + a
    "do not enable PR/release writes on GHES below the floor" note rather than a guessed
    version.

## Traceability

Every v0.0.1 requirement maps to exactly one phase. FOUND-01 and FOUND-03 are LOCKED grounding
decisions (not phase work) and are listed for completeness.

| Requirement | Phase | Note |
|-------------|-------|------|
| FOUND-01 | LOCKED | Reader = GitHub Releases; grounding decision, not phase work (ADR Decision 3). |
| FOUND-02 | Phase 3 | Authenticated private-repo local read via the Releases reader, no anonymous dependency. |
| FOUND-03 | LOCKED | Distribution forms = npm + JS Action; Docker deferred to a later milestone. Physical delivery: JS action for CI dogfooding (Phase 2) + full npm/action distribution (Phase 6, guarded by DOCS-05). |
| SRV-01 | Phase 1 | Server binds loopback (`127.0.0.1`) only; never a routable interface. |
| SRV-02 | Phase 1 | Timing-safe per-process CSPRNG bearer auth; unauth/mismatch -> 401. |
| SRV-03 | Phase 1 | `{hash}` path validated (bounded hex); malformed rejected before any backend call. |
| SRV-04 | Phase 1 | Body-size cap (`MAX_CACHE_BODY_BYTES` / 2 GB); oversized rejected, never buffered unbounded. |
| SRV-05 | Phase 1 | Best-effort read -> MISS on fault (never a build-breaking 5xx); writes fail closed. |
| TEST-07 | Phase 1 | Conformance fixture: hash full vendored Nx spec, pin named Nx version, assert hard `200` + 401/403/404/409 + Content-Length. |
| TEST-01 | Phase 2 | `selectBackend` unit specs (CI-vs-local, repo validation, token fallthrough, malformed-repo rejection, explicit env). |
| TEST-02 | Phase 2 | `withHashLock` concurrency spec (serialize / concurrent / evict / no-wedge). |
| ROBUST-03 | Phase 2 | Pin `@actions/cache` (and hash-sensitive deps) exact; upgrades gated behind `test:act`. |
| ROBUST-04 | Phase 2 | `serve` handles SIGTERM, drains in-flight writes before exit (background-step teardown). |
| TRUST-03 | Phase 2 | Dangerous shared-default-scope events refused on the (conservative default-deny) write gate; asserted by test. |
| TRUST-05 | Phase 2 | Runtime-context-derived RW/RO mode documented + test-covered; no caller-facing mode surface. |
| CORR-01 | Phase 3 | OS-namespaced by default (or documented + enforced consumer OS-discrimination); never wrong-OS. |
| TEST-05 | Phase 3 | Cross-OS round-trip through the Releases reader (OS-invariant + OS-sensitive hash from each CI OS); verifies CORR-01. |
| TEST-03 | Phase 4 | Publish + cleanup orchestration behind an injected client; exists / not-found / other-fault branches. |
| TEST-04 | Phase 4 | Cleanup bin wrapper spec (per-item isolation + non-zero exit); paired with RETAIN-01 list-abort test. |
| TEST-06 | Phase 4 | Date-cleanup (expired pruned; within-window retained) + read-only-local (local `put()` always 403). |
| ROBUST-01 | Phase 4 | Structural Octokit `error.status` discrimination on publish AND cleanup/delete paths. |
| ROBUST-02 | Phase 4 | Per-primitive large-body verification (Actions-cache + Releases); the ~2 GiB / 2 GB-body-cap boundary fails loud. |
| ROBUST-05 | Phase 4 | 1000-asset/release cap -> skip-and-warn (annotation), never a hard build failure. |
| TRUST-02 | Phase 4 | Sync gate = separate `{push, schedule}` predicate; test-locked rejections + non-default refs. |
| TRUST-07 | Phase 4 | No-overwrite / 409 first-write-wins; Releases mirror immutable-by-convention (same-hash = benign no-op). |
| RETAIN-01 | Phase 4 | Cleanup list phase aborts with zero deletions on non-404 / incomplete pagination; delete isolates per-item. |
| RETAIN-03 | Phase 4 | Cleanup credential = same `contents:write` `GITHUB_TOKEN`, first-party Octokit, `concurrency:` group. |
| OBS-01 | Phase 4 | Whole-run publish/sync failure fails loud (annotation + non-zero exit) + documented signal. |
| TRUST-01 | Phase 5 | Write-trust allowlist, default-deny, `pull_request`/`release` host-detected fail-closed from `GITHUB_SERVER_URL`. |
| TRUST-04 | Phase 5 | Trusted-event allowlist single source of truth; `selfcheck.cjs` parity (dual root copy eliminated). |
| TRUST-06 | Phase 5 | Shipped installable PPE-hygiene gate (zizmor/actionlint); best-effort/advisory. |
| TRUST-08 | Phase 5 | Mirror publishes only server-produced keys; ships before/with any private-repo mirror. |
| DOCS-01 | Phase 6 | Split 5-minute default quickstart vs advanced (opt-in store/sync/cleanup) guide. |
| DOCS-02 | Phase 6 | Config reference for every `resolve*` knob + Nx client vars; 10 GB-LRU + no-default-local-read notes. |
| DOCS-03 | Phase 6 | Trust/security section (events, CREEP posture, GHES floor, prerequisites, caveats). |
| DOCS-04 | Phase 6 | Minimal example adopter config, distinct from the maximal dogfood config. |
| DOCS-05 | Phase 6 | Enumerated, tested public surface; test fails on unintended consumer-contract changes. |
| DOCS-06 | Phase 6 | CI sidecar pattern: background step + `cancel:` teardown; `&` fallback; JS-action note. |
| GOV-01 | Phase 6 | SECURITY.md vulnerability-disclosure policy. |
| GOV-02 | Phase 6 | LICENSE (MIT). |
| GOV-03 | Phase 6 | Versioned consumer-contract / semver statement. |

## Coverage Validation

**Assertion: 38/38 v0.0.1 "v0.0.1 Requirements" entries map to exactly one phase, plus FOUND-02 (the
one unmet foundational deliverable). No orphans, no duplicates.**

Per-phase v0.0.1 requirement counts:

- Phase 0: 0 (teardown/prep - delivers no v0.0.1 requirement).
- Phase 1: 6 (SRV-01, SRV-02, SRV-03, SRV-04, SRV-05, TEST-07).
- Phase 2: 6 (TEST-01, TEST-02, ROBUST-03, ROBUST-04, TRUST-03, TRUST-05).
- Phase 3: 3 (FOUND-02, TEST-05, CORR-01).
- Phase 4: 11 (TEST-03, TEST-04, TEST-06, ROBUST-01, ROBUST-02, ROBUST-05, TRUST-02, TRUST-07,
  RETAIN-01, RETAIN-03, OBS-01).

- Phase 5: 4 (TRUST-01, TRUST-04, TRUST-06, TRUST-08).
- Phase 6: 9 (DOCS-01..06, GOV-01..03).

Total mapped: 39 (38 from the v0.0.1 Requirements section + FOUND-02). FOUND-01 and FOUND-03 are
LOCKED grounding decisions, not counted.

**Resolved ambiguities / deviations from the starting hypothesis (with reasons):**

- **TRUST-01 anchored in Phase 5 (not Phase 2).** TRUST-01 bundles two things: the base
  default-deny allowlist AND the `pull_request`/`release` host-detected widening. It cannot be
  FULLY delivered/tested until the widening exists (you are not trusting PR/release in Phase 2),
  so the phase that fully delivers it is Phase 5. Phase 2's "core write-trust gate" (a
  conservative default-deny gate trusting only push/schedule) is therefore anchored by TRUST-03
  (dangerous events refused) + TRUST-05 (RW/RO derived mode). Both phases' headline deliverables
  are backed by a requirement ID.

- **TEST-06 anchored in Phase 4.** It bundles date-cleanup (Phase 4 subsystem) with
  read-only-local (`put()` 403). Date-cleanup only exists in Phase 4, so TEST-06 lands there;
  the read-only-local half re-verifies a Phase 3 capability (see couplings below).

- **ROBUST-02 anchored in Phase 4.** "Verified per-primitive (Actions-cache + Releases)"
  requires both backends to exist; Releases publish is Phase 4, so the per-primitive + 2 GiB
  boundary-fail-loud acceptance is owned there (the Phase 1 server body cap is a foundation it
  builds on).

- **FOUND-03 kept as LOCKED grounding, not phase-mapped.** The DECISION (npm + JS Action, Docker
  deferred) is grounding; its physical build spans Phase 2 (JS action for dogfooding) and Phase 6
  (full distribution), and the consumer-facing surface is guarded by DOCS-05 (Phase 6). No
  orphaned requirement results.

- **Phase 4 is intentionally heavy (11 requirements).** Publish + retention + observability is
  one coherent vertical slice - a publisher with no cleanup, or cleanup with nothing to clean,
  does not dogfood independently. Splitting it would create non-shippable half-slices, so it
  stays whole under the standard granularity.

**Cross-phase couplings flagged (not gaps - each requirement is owned by one phase, but its
verification or the code it constrains touches another):**

- **CORR-01 (Phase 3) is verified by TEST-05 (Phase 3)** and enforced in the key/namespace set
  in the same phase; spike 005 proved OS-namespacing is store-agnostic, so no reader-specific
  rework is expected.

- **TRUST-07's server-side 409 (Phase 4)** rides on the contract server's 409 built in Phase 1
  and asserted by TEST-07; TRUST-07's distinctive content (the mirror never overwrites) is the
  publish-path property owned by Phase 4.

- **ROBUST-02's server body cap** is built with the walking-skeleton server (Phase 1) as a
  foundation; the per-primitive, boundary-fail-loud acceptance is owned by Phase 4.

- **TEST-06's read-only-local half** re-verifies the RO local reader built in Phase 3; the test
  is written in Phase 4 alongside the date-cleanup it is paired with.

- **ROBUST-04 (Phase 2) is motivated/documented by DOCS-06 (Phase 6).** The SIGTERM drain code
  is Phase 2; the background-step `cancel:` teardown docs that require it are Phase 6.

- **TRUST-08 (Phase 5) constrains the publish path built in Phase 4.** Phase 4's public dogfood
  publish is acceptable pre-filter only because this repo is public; the filter must precede any
  private-repo mirror.

**No coverage gaps and no un-orderable dependencies found.** The phases are strictly sequential
(teardown -> skeleton -> default cache -> read -> publish/retention -> trust-widening ->
distribution/docs) and self-consistent under the standard granularity.

## Deferred to a later milestone / Out of Scope (excluded from all v0.0.1 phases)

Listed for completeness. These are NOT v0.0.1 work and are intentionally unmapped:

- **TRUST-09** (a later milestone, N/A for Releases): publish-time package-visibility fail-closed assert -
  Releases assets inherit repo visibility, so no assert is needed in v0.0.1.

- **RETAIN-02** (a later milestone, N/A for Releases): GHCR >5000-download delete-refusal handling - Releases
  assets have no deletion wall.

- **PROV-01** (a later milestone): optional reader-verified asymmetric provenance attestation (cosign keyless
  via OIDC) - only clean on a GHCR/OCI backend.

- **GHCR-01** (later-milestone revisit trigger): re-evaluate GHCR/OCI as an additional synced store when
  PROV-01 (cosign) and the Docker container form graduate together; brings back the
  GHCR-conditional controls (C6/C10/C11/C13/C18, TRUST-07-GHCR, TRUST-09, RETAIN-02/03-GHCR).

- **Docker container distribution form** (a later milestone): the CI `services:` motivation is covered by the
  GA background-step pattern (DOCS-06) + the `&` fallback; residual niche is hermetic / non-Node
  CI (FOUND-03).

- **Out of scope entirely:** synchronous write fan-out; a local read-write store; multiple
  simultaneous stores; CONTRIBUTING / maintenance statement; LRU via a stateful manifest;
  content signing as a CREEP control; hosted/managed cache service; streaming large bodies; a
  second retention knob; multi-tenant / persistent shared self-hosted runners; the deprecated Nx
  custom task-runner API and `@nx/*-cache` plugins.

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 0. Teardown | 5/5 | Complete    | 2026-07-18 |
| 1. Walking Skeleton | 4/4 | Complete    | 2026-07-18 |
| 2. Default Cache in CI | 0/TBD | Not started | - |
| 3. Cross-Context Read | 0/TBD | Not started | - |
| 4. Publish + Retention + Observability | 0/TBD | Not started | - |
| 5. Trust-Widening + PPE Gate | 0/TBD | Not started | - |
| 6. Distribution + Docs + Governance | 0/TBD | Not started | - |

---
*Roadmap regenerated: 2026-07-18. Greenfield MVP / vertical-slice rebuild on the LOCKED
foundation (FOUND-01 = GitHub Releases; FOUND-03 = Docker deferred to a later milestone). Grounds on
`.planning/ARCHITECTURE-DECISION.md` (control ledger C1-C18), `.planning/REQUIREMENTS.md`
(locked v0.0.1 set), the FOUND-01 reader spike (`.planning/spikes/001-005`), and
`.planning/research/SUMMARY.md`. Granularity: standard (7 phases). Rebuild method: Nx-native
(`nx g @nx/workspace:remove` teardown, `nx g` generators for new projects). Git branching:
none (sequential).*
