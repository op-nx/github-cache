# Phase 6: Distribution + Docs + Governance - Research

**Researched:** 2026-07-20
**Domain:** npm package distribution + GitHub JS Action authoring + technical docs/governance for an Nx remote-cache tool
**Confidence:** HIGH (code surface + background-step schema tool-verified; npm publish semantics CITED/ASSUMED with a `npm pack --dry-run` gate)

<user_constraints>
## User Constraints (from 06-CONTEXT.md)

### Locked Decisions
- **D-01 (USER):** Stability posture = **pre-1.0, drift-guarded**. Enumerate + guard-test the FULL consumer surface (DOCS-05: no *accidental* drift), but GOV-03's semver statement uses standard 0.x semantics: the public surface MAY still evolve before 1.0; a breaking change bumps the MINOR and is documented; **1.0 freezes the contract**. The guard test guarantees change is *intentional and reviewed*, not that it never happens. Research serves THIS posture, not a stable-from-day-one freeze.
- **D-02:** Packaging kept **lean** (NOT PoC-parity-by-default). Default CI-RW quickstart is the primary product; publish/sync/cleanup ship advanced/opt-in. Action-vs-bin packaging is delegated to research/planning, constrained by: `serve` and `publish` both need the JS-action runtime for `ACTIONS_RUNTIME_TOKEN` (STATE 04-06) -> JS action(s)/operations, never plain `run:` bins; cleanup uses `GITHUB_TOKEN` + Octokit (`contents:write`) and may be a bin or action.
- **D-03:** Full milestone scope kept — advanced guide (DOCS-01) + advanced example (DOCS-04) for opt-in store/sync/cleanup stay in scope.
- **D-04:** Enumerated surface = **consumer contract only**, three groups: (a) consumer env knobs — `NX_SELF_HOSTED_REMOTE_CACHE_SERVER` / `NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN`, `CACHE_MIRROR_MAX_AGE_DAYS`, `MAX_CACHE_BODY_BYTES`, the server port var, `GH_TOKEN`/`GITHUB_TOKEN`; (b) the consumer JS action input(s); (c) the package export surface (today `createCacheServer` + `CacheBackend`/`GetHit`/`GetResult`/`PutResult`). Internal module exports (`withHashLock`, `shardTag`, `octokitFault`, `isWriteTrusted`, ~25 others) stay OUT of the frozen surface.
- **D-05:** Guard mechanism = a test that fails on unintended change to the enumerated surface. Snapshot vs explicit-list is the planner's call; the intentional-change diff must be human-readable and obviously reviewable.
- **D-06:** Root `README.md` = the 5-minute default quickstart (Actions-cache CI-RW only) + landing/nav; phase 6 rewrites the current neutral `@op-nx/source` shell.
- **D-07:** `docs/` holds: advanced guide (opt-in RO store/sync/cleanup); config reference for every `resolve*` knob + Nx client vars incl. the 10 GB repo-LRU note + no-default-local-read note; the trust/security section (D-08); a **minimal** example adopter config deliberately distinct from this repo's maximal dogfood config.
- **D-08:** DOCS-03 trust/security content (prescribed by ROADMAP criterion 4): which events write; CREEP posture; github.com-only backstop + GHES floor (state github.com-only + "do not enable PR/release writes on GHES below the floor" — never a guessed version); never enable fork-PR tokens/secrets; default-branch-protection + ephemeral-single-tenant-runner prerequisites; the coupled `CACHE_MIRROR_MAX_AGE_DAYS`; read-only-local-by-design; retention-as-storage-hygiene (NOT poison-containment); mirrored keys are anonymously public; freshness-window / mid-session-staleness caveats.
- **D-09:** Document `serve` as a GitHub Actions **background step** (`background: true` + explicit `cancel:` teardown) with a plain `&` fallback for GHES/older runners, plus the JS-action rationale. Consumer action is SEPARATE from `packages/github-cache/action.yml` (the internal-dogfood action, must not be presented as the consumer surface).
- **D-10:** `SECURITY.md` — GitHub private vulnerability reporting primary; supported-versions table; coordinated-disclosure window. **Any contact email MUST be the public gmail (`larsbrinknielsen@gmail.com`), NEVER the work domain — prefer GitHub advisories so no email is needed.**
- **D-11:** `LICENSE` = **MIT** at repo root AND bundled into the published package; copyright holder "Lars Gyrup Brink Nielsen" (GOV-02, locked).
- **D-12:** GOV-03 semver / consumer-contract statement lives in `docs/` (e.g. `docs/versioning.md`) + summarized in README; defines "breaking" against the D-04 surface under the D-01 pre-1.0 posture.
- **D-13:** Package is currently `private: true` with no `files`/`bin`/`publishConfig`. Phase 6 makes it publish-READY as public `@op-nx/github-cache` (`publishConfig.access: public`), ships only `dist/` (+ LICENSE + consumer README), adds the consumer bin(s)/action. Being publish-ready + `uses:`-consumable is sufficient for v0.0.1; an actual `npm publish` can be a later release step (planner discretion whether to wire a release workflow now).

### Claude's Discretion
- Exact action-vs-bin packaging within D-02's `ACTIONS_RUNTIME_TOKEN` constraint.
- Guard-test implementation (snapshot vs explicit list) within D-05.
- `docs/` file names and changelog format.
- Whether to wire an actual npm-publish release workflow now vs publish-ready only (D-13).

### Deferred Ideas (OUT OF SCOPE)
- **Docker container distribution form** (FOUND-03) — LOCKED-deferred to a later milestone; CI-sidecar motivation covered by the DOCS-06 background-step pattern.
- **GHCR/OCI synced store (GHCR-01) + cosign attestation (PROV-01)** — later-milestone revisit trigger. Not phase 6.
- **Actual npm publish / release automation** — may be wired now or deferred per D-13 (discretion). Milestone requires publish-READINESS, not a live publish.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DOCS-01 | Split 5-minute default quickstart (Actions-cache CI-RW) vs advanced guide (opt-in RO store/sync/cleanup) | Docs org (D-06/D-07); background-step quickstart schema (VERIFIED); default vs advanced surfaces enumerated below |
| DOCS-02 | Config reference for every `resolve*` knob + Nx client vars; 10 GB-repo-LRU + no-default-local-read notes | Env-knob enumeration table (grounded in `retention.ts`, `serve.ts`, `github-identity.ts`, `select-backend.ts`); MAX_CACHE_BODY_BYTES-is-a-constant discrepancy flagged |
| DOCS-03 | Trust/security section (events, CREEP posture, GHES floor, prerequisites, caveats) | ARCHITECTURE-DECISION.md C1-C18 + Phase 5 SECURITY.md/VERIFICATION.md render targets; trust.ts/sync-gate.ts single sources |
| DOCS-04 | Minimal example adopter config, distinct from the maximal dogfood config | Contrast: consumer background-step workflow vs this repo's `ci.yml` (dogfood, 7 jobs) |
| DOCS-05 | Enumerated, tested public surface; test fails on unintended consumer-contract change | Guard-test patterns (snapshot vs explicit-list); `pinned-deps.spec.ts` prior art; three D-04 surface groups enumerated |
| DOCS-06 | CI sidecar pattern: background step + `cancel:` teardown; `&` fallback; JS-action note | Background-step schema VERIFIED against docs.github.com; `background` works on `uses:` steps; implicit-`wait-all`-before-cleanup mechanism; JS-action distribution model |
| GOV-01 | SECURITY.md vulnerability-disclosure policy | GitHub private vulnerability reporting; supported-versions table under 0.x; public-gmail-only constraint |
| GOV-02 | LICENSE (MIT) | MIT text + holder "Lars Gyrup Brink Nielsen"; root + bundled |
| GOV-03 | Versioned consumer-contract / semver statement | semver 0.x semantics tied to the D-04 enumerated surface |
</phase_requirements>

## Summary

Phase 6 ships **no new cache behavior** — it packages, documents, and governs the code that phases 1-5 already settled. Three distinct pieces of work: (1) turn a `private: true` Nx library into a publish-ready public scoped npm package **and** a genuinely `uses:`-consumable GitHub JS Action; (2) write split adoption docs + a config reference + a trust/security section that render the *settled* model (never a re-typed guess); (3) add MIT LICENSE, SECURITY.md, and a 0.x semver statement, plus a guard test that makes any change to the enumerated consumer surface an obvious reviewable diff.

The single most consequential technical finding: **`dist/` is gitignored** (`.gitignore:4`), yet a `uses:` action resolves its `main:` **from the git ref, never from npm and never after a build step**. The internal dogfood action (`packages/github-cache/action.yml`, `main: dist/action/index.js`) works only because this repo's CI runs `npm run build` first — an external consumer's `uses:` cannot. So the consumer JS action must ship a **committed, dependency-bundled entry** (the `actions/*` standard: esbuild/ncc single-file with `@actions/cache`+`@actions/core` inlined) at a non-gitignored path, guarded by a CI drift-check — exactly the pattern this repo already uses for `trust.generated.cjs` (`selfcheck.cjs`). The npm tarball is a separate channel that ships `dist/` via a `files` allow-list (which overrides the `.gitignore`-fallback that would otherwise exclude it).

The DOCS-06 background-step pattern is now GA-schema-confirmed against docs.github.com: `background: true` is a step attribute valid on **`run` AND `uses` steps**, `cancel: <id>` teardown sends SIGTERM-then-SIGKILL, and — the load-bearing detail — **"an implicit `wait-all` runs before any post-job cleanup,"** which is precisely why a never-exiting `serve` needs an explicit `cancel:` (otherwise the implicit wait hangs the job). A composite action **cannot** declare `background:` internally (confirmed) — so the consumer action must be a JS action.

**Primary recommendation:** Ship two channels from one codebase: (1) the npm package `@op-nx/github-cache` (`publishConfig.access: public`, `files: ["dist"]`, a `bin` for the `&`/npx fallback), and (2) a new `uses:`-consumable JS action at a fresh path (NOT the dogfood `action.yml`) whose committed bundle is produced by **esbuild** (legitimacy OK, 255M downloads/wk; the repo's `vite` already pulls it transitively) and kept honest by a `selfcheck`-style CI drift guard. Guard the DOCS-05 surface with an **explicit-assertion-list** spec (the `pinned-deps.spec.ts` precedent), not a snapshot, so the contract change lands in the spec file itself.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Publish-ready npm package (`dist/` + LICENSE + README) | Build/Packaging (package.json `files`/`bin`/`publishConfig`) | — | npm tarball is governed by package.json fields, not `.gitignore`; `nx build` (tsc) already emits `dist/` |
| `uses:`-consumable JS action (background sidecar) | CI / GitHub Actions runtime | Build/Packaging (committed bundle) | Actions resolve `main:` from the git ref; needs a committed self-contained entry; `@actions/cache` needs the JS-action `ACTIONS_RUNTIME_TOKEN` runtime |
| Background-step lifecycle (serve up, Nx runs, teardown) | Consumer workflow YAML (`background:`/`cancel:`) | Server (`serve()` SIGTERM drain, ROBUST-04) | `background:`/`cancel:` are step-level workflow keywords; the action just keeps the process alive |
| Config reference (env knobs) | Docs (`docs/`) + the guard test | Runtime resolvers (`resolve*`) | Knobs live in code (`retention.ts`, `serve.ts`, `github-identity.ts`); docs enumerate, the guard test locks |
| Trust/security narrative (DOCS-03) | Docs (`docs/`) | Single-source model (`trust.ts`, `sync-gate.ts`, ADR C1-C18) | Docs render the settled model; never restate a guess |
| Governance (LICENSE/SECURITY/semver) | Repo root + `docs/` | GitHub advisories (private vuln reporting) | Project-hygiene files; disclosure routed through GitHub, no email needed |
| Public-surface enumeration + guard | Test (`*-public-surface.spec.ts`) | Barrel (`index.ts`), consumer `action.yml` | One spec asserts exports + action inputs + env-knob list |

## Standard Stack

This is a docs/distribution phase — the "stack" is packaging + docs tooling, not new runtime libraries. The three runtime deps are already pinned and unchanged (`@actions/cache 6.2.0`, `@actions/core 3.0.1`, `@octokit/rest 22.0.1` — all registry-confirmed current [VERIFIED: npm view]).

### Core (new tooling this phase likely needs)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| esbuild | 0.28.1 | Bundle the consumer JS action into ONE committed self-contained `index.js` (deps inlined) | `[VERIFIED: npm registry, legitimacy OK]` 255M downloads/wk, official `evanw/esbuild`; already transitive via `vite`; `--bundle --platform=node` is one command |

### Supporting / Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| esbuild | `@vercel/ncc` 0.44.1 | The GitHub-Actions-idiomatic bundler, **but** legitimacy `[SUS: too-new]` on the current release (published 2026-06-29) + ~285x fewer downloads (897K/wk vs 255M/wk). Requires a `checkpoint:human-verify` before install. No net advantage over esbuild for a single Node entry. |
| adding a bundler devDep at all | Reuse the already-installed **`vite`/rollup** in library mode | ZERO new supply-chain surface (vite 8.1.5 is already a devDep), but more config (Node/SSR target for a CJS/ESM single-file bundle) than esbuild's one flag. The ponytail-lean option if the team prefers no new dependency. |
| a committed action bundle | commit the action's `node_modules` | Works but bloats the repo and enlarges the supply-chain/audit surface; discouraged. |
| a committed action bundle | ship only the npm package, no `uses:` action | Violates FOUND-03/D-13 (JS Action is mandatory + must be `uses:`-consumable) and the ADR (Actions-cache CI-RW needs the JS-action runtime). Not viable. |

**Installation (if esbuild is chosen):**
```bash
npm install -D esbuild@0.28.1   # exact-pin, per this repo's ROBUST-03 convention; guard with pinned-deps.spec.ts
```

**Version verification:** all versions above confirmed via `npm view <pkg> version` on 2026-07-20. `@actions/*`/`@octokit/rest` match the current pins. Re-run `npm view` at plan time — the background-steps era is fast-moving.

## Package Legitimacy Audit

> This phase installs at most ONE new dependency (a bundler). Runtime deps are unchanged.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| esbuild | npm | published 2026-06-11 (mature project) | 255,790,269/wk | github.com/evanw/esbuild | **OK** | Approved (recommended). Note: has a `postinstall: node install.js` (the well-known native-binary fetch) — benign, universally used, but flag it in the plan. |
| @vercel/ncc | npm | current release 2026-06-29 (mature project, recent bump) | 897,406/wk | github.com/vercel/ncc | **SUS** (too-new) | Flagged — if chosen over esbuild, planner MUST add a `checkpoint:human-verify` before install. No postinstall. |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** `@vercel/ncc` (too-new on the current release; established package, false-positive-ish, but requires a human-verify checkpoint if selected). esbuild is the clean OK-verdict pick.

*Recommendation: esbuild. If the team wants zero new supply-chain surface, the vite-library-mode path (no new install) is the alternative and needs no audit entry.*

## Architecture Patterns

### System Architecture Diagram

```
TWO DISTRIBUTION CHANNELS FROM ONE CODEBASE
===========================================

  packages/github-cache/src/**  --(nx build / tsc)-->  dist/**  [gitignored]
         |                                                  |
         |                                                  |  files:["dist"] allow-list
         |                                                  v
         |                                        npm tarball (@op-nx/github-cache)
         |                                        + LICENSE + consumer README
         |                                        + bin -> `npx @op-nx/github-cache serve`
         |                                                  |
         |                                                  v
         |                              CHANNEL A: npm  ->  local library use +
         |                                                  the `&` GHES/older-runner fallback
         |
         '--(esbuild bundle @actions/cache+core inlined)--> actions/start-cache-server/index.js
                                                            [COMMITTED to git, NOT gitignored]
                                                            + action.yml (using: node24)
                                                            + CI drift-guard (selfcheck-style)
                                                                       |
                                                                       v
                                                     CHANNEL B: uses: op-nx/github-cache/
                                                                start-cache-server@vX


CONSUMER CI JOB (the DOCS-06 default quickstart, CHANNEL B)
===========================================================

  job:
   - uses: actions/checkout
   - uses: op-nx/github-cache/start-cache-server@vX   id: cache
     background: true            <-- serve() sidecar, keeps process alive on 127.0.0.1:PORT
        |   exports NX_SELF_HOSTED_REMOTE_CACHE_SERVER=http://localhost:PORT
        |           NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN=<csprng>  (setSecret + exportVariable)
        v
   - run: npx nx affected -t build test   <-- Nx client reads the two NX_* vars ->
        |                                     GET/PUT /v1/cache/{hash} on the loopback sidecar
        v                                     -> selectBackend(env) -> Actions-cache RW backend
   - cancel: cache              <-- SIGTERM -> serve() drains in-flight PUTs (ROBUST-04) -> exit
                                    (MANDATORY: implicit wait-all before post-job cleanup would
                                     otherwise hang forever on the never-exiting server)
```

### Recommended Project Structure (additions this phase)
```
/ (repo root)
├── README.md                 # rewrite: 5-min default quickstart + nav (D-06, DOCS-01)
├── LICENSE                   # MIT, holder "Lars Gyrup Brink Nielsen" (D-11, GOV-02)
├── SECURITY.md               # private vuln reporting + supported-versions + window (D-10, GOV-01)
├── docs/
│   ├── advanced.md           # opt-in RO store / sync / cleanup (D-07, DOCS-01)
│   ├── configuration.md      # every resolve* knob + Nx client vars + 10GB-LRU + no-local-read (DOCS-02)
│   ├── trust-and-security.md # DOCS-03 content (D-08); renders trust.ts/sync-gate.ts/ADR
│   ├── versioning.md         # 0.x semver / consumer-contract statement (D-12, GOV-03)
│   └── examples/             # minimal adopter workflow(s), distinct from this repo's ci.yml (DOCS-04)
├── start-cache-server/       # NEW consumer JS action (mirrors ppe/ layout); OR actions/…
│   ├── action.yml            # using: node24, main: index.js
│   └── index.js              # COMMITTED esbuild bundle (drift-guarded)
└── packages/github-cache/
    ├── package.json          # flip private, add files/bin/publishConfig (D-13)
    ├── action.yml            # UNCHANGED — internal dogfood only (do NOT present as consumer surface)
    └── src/
        ├── index.ts          # barrel: maybe add `serve`/`ServeOptions` for the library path (DOCS-05)
        └── <name>-public-surface.spec.ts   # the DOCS-05 guard test
```

### Pattern 1: `uses:`-consumable JS action = committed bundle + drift guard
**What:** A JS action's `main:` is resolved from the checked-out git ref; GitHub never runs `npm ci` or a build for it. So the entry and all runtime deps must exist at the tag. Bundle them into one committed file; add a CI check that rebuilds and `git diff`s to fail on staleness.
**When to use:** Any `uses: owner/repo/path@ref` JS action whose source is TS/has deps (all of them).
**Example (build + guard, mirroring `selfcheck.cjs`):**
```jsonc
// package.json scripts (illustrative)
"build:action": "esbuild start-cache-server/entry.ts --bundle --platform=node --format=cjs --outfile=start-cache-server/index.js",
"check:action": "npm run build:action && git diff --exit-code -- start-cache-server/index.js"
```
```yaml
# action.yml (consumer sidecar). Source: packages/github-cache/action.yml shape (node24), adapted.
name: 'op-nx github-cache server'
description: 'Runs the loopback Nx remote-cache sidecar as a background step.'
inputs:
  port:
    description: 'Loopback port for the sidecar (default OS-assigned if omitted).'
    required: false
runs:
  using: 'node24'
  main: 'index.js'
```

### Pattern 2: background sidecar step lifecycle
**What:** The GA background-step keywords replace `&`+`nohup`+`trap`, giving per-step logs and a graceful teardown.
**When to use:** The DOCS-06 default quickstart (github.com + modern runner).
**Example (VERIFIED verbatim from docs.github.com, adapted to this action):**
```yaml
# Source: docs.github.com/actions/reference/workflows-and-actions/workflow-syntax
#         (jobs.<job_id>.steps[*].background / .cancel)
steps:
  - uses: actions/checkout@v7
  - uses: op-nx/github-cache/start-cache-server@v0
    id: cache-server
    background: true            # runs asynchronously; job continues to the next step
  - run: npx nx affected -t build test
  - cancel: cache-server        # SIGTERM (then SIGKILL after a short grace); serve() drains
```

### Pattern 3: the `&` fallback (GHES / older runners lacking the background engine)
**What:** Where `background:`/`cancel:` are unavailable, background the process with a shell `&`.
**Critical caveat (DOCS-06, git-history-confirmed):** the `&` fallback serves the **token-based Releases reader** path only (native fetch, no `ACTIONS_RUNTIME_TOKEN` needed). The **CI-RW Actions-cache backend still requires a JS action** — a plain `run:`/`&` step's `@actions/cache` save/restore **silently no-ops** because `ACTIONS_RUNTIME_TOKEN`/`ACTIONS_RESULTS_URL` are injected only into a JS-action runtime. Do not present `&` as a CI-RW substitute.
```yaml
# GHES / older-runner fallback (reader path). No cancel keyword; the process is
# reaped at job end. serve() still handles SIGTERM (ROBUST-04) at teardown.
- run: |
    npx @op-nx/github-cache serve &
    echo "NX_SELF_HOSTED_REMOTE_CACHE_SERVER=http://localhost:3000" >> "$GITHUB_ENV"
```

### Anti-Patterns to Avoid
- **Presenting `packages/github-cache/action.yml` as the consumer surface.** It is explicitly the internal dogfood action (its own header says so); its `main:` points into gitignored `dist/` and its inputs (`operation: seed|verify|publish`) are dogfood-only. The consumer action is a NEW, separate artifact.
- **Pointing a `uses:` action's `main:` into `dist/` (gitignored).** Fails for every external consumer. Commit the bundle.
- **Documenting `MAX_CACHE_BODY_BYTES` as a tunable env var.** In code it is a fixed `const` (2 GiB) in `server.ts:12`, NOT read from `process.env`. Document it as a fixed contract limit unless the plan deliberately promotes it (scope decision — see Open Questions).
- **Restating the trust model in prose.** DOCS-03 must render `trust.ts`/`sync-gate.ts`/ADR C1-C18 (link/quote), never a hand-typed paraphrase that can drift from the single source.
- **Guessing a GHES version floor.** State github.com-only + "do not enable PR/release writes on GHES below the floor" (the floor is unpublished — ADR C1/C14).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Background sidecar lifecycle | `&` + `nohup` + `trap` + PID files + poll-for-ready | GA `background:`/`cancel:` step keywords | Native, per-step logs, graceful SIGTERM teardown; `&` is only the GHES fallback |
| Action dependency bundling | hand-concatenated JS / committed `node_modules` | esbuild `--bundle --platform=node` (drift-guarded) | One command; deterministic single file; the `actions/*` standard |
| Vulnerability intake | a custom email inbox / issue template for secrets | GitHub **private vulnerability reporting** (Security Advisories) | No email to leak; coordinated-disclosure workflow built in (D-10 prefers this so no email is needed) |
| Semver definition | a bespoke versioning scheme | semver.org 0.x semantics tied to the D-04 surface | Adopters already understand 0.x; the guard test enforces "intentional change" |
| Surface-drift detection | a custom TS AST walker over all exports | an explicit-assertion-list spec (the `pinned-deps.spec.ts` precedent) | The contract change lands in the spec file — an obvious PR diff (D-05) |
| npm tarball contents | a custom pack script / `.npmignore` juggling | `files: ["dist"]` allow-list + `npm pack --dry-run` | The allow-list overrides the `.gitignore`-fallback that would drop `dist` |

**Key insight:** every "custom" option here re-implements something GitHub/npm/the repo already provides — and each hand-rolled version is exactly where silent drift (the thing DOCS-05 exists to stop) creeps in. The repo's own `trust.generated.cjs` + `selfcheck.cjs` is the blueprint: generate an artifact from a single source, then fail CI on drift.

## Common Pitfalls

### Pitfall 1: `dist/` is gitignored — the action won't resolve for consumers
**What goes wrong:** A consumer `uses: op-nx/github-cache/...@v0` fails with "file not found" because `main:` points into `dist/`, which is not committed at the tag.
**Why it happens:** `.gitignore:4` ignores `dist`; the dogfood action only works because this repo's CI builds before `uses: ./packages/github-cache`.
**How to avoid:** Commit a bundled action entry to a non-gitignored path; add a CI drift-check (`npm run build:action && git diff --exit-code`).
**Warning signs:** The action works in this repo's CI but fails when referenced by SHA/tag from another repo.

### Pitfall 2: npm tarball silently omits `dist/`
**What goes wrong:** `npm publish` ships a package with no `dist/` (empty/broken import), because with no `.npmignore` present npm falls back to `.gitignore` rules and excludes `dist`.
**Why it happens:** No `.npmignore` in the repo; `dist` is gitignored.
**How to avoid:** Add `files: ["dist"]` to package.json (the allow-list wins), then **verify with `npm pack --dry-run`** and inspect the file list. `LICENSE`/`README.md`/`package.json` are auto-included regardless.
**Warning signs:** `npm pack --dry-run` output missing `dist/index.js`.

### Pitfall 3: never-exiting `serve` hangs the job without `cancel:`
**What goes wrong:** The job hangs at the end. `[VERIFIED: docs.github.com]` "An implicit `wait-all` runs before any post-job cleanup" — so a background `serve` that never exits blocks the implicit wait forever.
**How to avoid:** The `cancel: <id>` teardown step is MANDATORY (not optional). It sends SIGTERM (then SIGKILL after a short grace); `serve()`'s ROBUST-04 drain handles it.
**Warning signs:** Green until the last step, then the job times out.

### Pitfall 4: `&` fallback used for the CI-RW path
**What goes wrong:** On GHES a consumer backgrounds `serve` with `&` for CI writes; caching silently does nothing (every task a MISS, no error).
**Why it happens:** `@actions/cache` save/restore no-ops outside a JS-action runtime (`ACTIONS_RUNTIME_TOKEN` absent). Git-history-confirmed in this repo (Phase 2).
**How to avoid:** Docs must scope `&` to the reader path; CI-RW requires the JS action, full stop.

### Pitfall 5: composite action cannot declare `background:`
**What goes wrong:** Someone ships the consumer action as `using: composite` and tries `background:` inside it.
**Why it happens:** `[VERIFIED: docs.github.com]` "You cannot use `background` on steps inside a composite action. A composite action can itself run as a background step, but it cannot declare background steps internally." (Contrast: `ppe/action.yml` is legitimately composite because it has no background need.)
**How to avoid:** The consumer sidecar action is a **JS action** (`using: node24`); the consumer puts `background: true` on the `uses:` step.

### Pitfall 6: work-email / work-domain leak in governance files
**What goes wrong:** SECURITY.md or a `package.json` `author` field carries the maintainer's work email/domain into a public repo — a CLAUDE.md hard rule violation and a D-10 breach.
**How to avoid:** Any email is the public gmail `larsbrinknielsen@gmail.com` ONLY; prefer GitHub private vulnerability reporting so **no email appears at all**. The `author` field, if added, uses the public gmail. Add an allowlist-inversion check to the battery if authoring identity is touched.
**Warning signs:** any `@`-token in committed files that is not the approved gmail.

### Pitfall 7: `publishConfig.access` omitted on a scoped package
**What goes wrong:** `npm publish` of `@op-nx/github-cache` fails (scoped packages default to restricted/private, which needs a paid org or 402s).
**How to avoid:** `publishConfig: { "access": "public" }`. Keep the workspace root (`@op-nx/source`) `private: true` — only the package flips.

### Pitfall 8: the `@op-nx/source` export condition
**What goes wrong:** The package.json `exports["."]` has a custom `"@op-nx/source": "./src/index.ts"` condition (Nx workspace source-resolution). Harmless for external consumers (they never set that condition -> they fall through to `import`/`default` -> `./dist/index.js`), but worth confirming external resolution lands on `dist`.
**How to avoid:** Verify with `npm pack --dry-run` + a resolution smoke test; do not remove the `types`/`import`/`default` conditions.

## Code Examples

### Enumerated consumer env-knob surface (grounded in actual code)
```typescript
// The DOCS-02 config reference + the DOCS-05 guard cover EXACTLY these consumer-set knobs.
// Sources cited inline; all [VERIFIED: codebase].
//
// NX_SELF_HOSTED_REMOTE_CACHE_SERVER   -> read by the Nx CLIENT (not our code); consumer sets it
//                                          to http://localhost:<port> so Nx talks to the sidecar.
// NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN -> serve.ts:72 (bearer token); also presented by Nx.
// PORT                                 -> serve.ts:69 (resolvePort; invalid/omitted -> OS-assigned).
// CACHE_MIRROR_MAX_AGE_DAYS            -> retention.ts:48-58 resolveMaxAgeDays (default 30, clamp 365);
//                                          the ONE coupled knob (read window == cleanup window).
// GH_TOKEN / GITHUB_TOKEN              -> github-identity.ts:28-32 resolveGitHubToken (|| fallthrough);
//                                          CI publish/cleanup credential + local-read tier 1.
// GITHUB_REPOSITORY                    -> select-backend.ts / local-context.ts (owner/name identity;
//                                          runner-injected in CI, local override).
//
// NOT an env knob (document as a FIXED contract limit): MAX_CACHE_BODY_BYTES = 2 GiB, a const in
// server.ts:12 + an injectable test param — NOT read from process.env today.
//
// Runner-injected context (READ-ONLY, consumers must NOT set): GITHUB_ACTIONS, GITHUB_EVENT_NAME,
// GITHUB_SERVER_URL, GITHUB_REF, GITHUB_REF_NAME, GITHUB_EVENT_PATH, GITHUB_RUN_ID,
// ACTIONS_RUNTIME_TOKEN, ACTIONS_RESULTS_URL. These drive the trust/sync gates; document behavior,
// do not list as tunable knobs.
```

### Current package export barrel (the DOCS-05 export group)
```typescript
// packages/github-cache/src/index.ts  [VERIFIED: codebase]
export { createCacheServer } from './server/server.js';
export type { CacheBackend, GetHit, GetResult, PutResult } from './backend/types.js';
// NOTE: `serve`/`ServeOptions`/`RunningServer` (serve.ts) are NOT re-exported today. If the npm
// library/bin path should let consumers start the server programmatically, the plan adds `serve`
// to this barrel — and the guard test must then include it. Decide before writing the guard.
```

### DOCS-05 guard test — recommended explicit-assertion-list style
```typescript
// <name>-public-surface.spec.ts — mirrors pinned-deps.spec.ts (reads a file, asserts an
// explicit expectation). An intentional surface change edits the arrays HERE, so the PR diff
// shows the contract change in the spec itself (D-05). Preferred over toMatchSnapshot(), whose
// `-u` regen lands in a .snap file that is easy to rubber-stamp.
import { describe, expect, it } from 'vitest';
import * as barrel from './index.js';

const EXPECTED_EXPORTS = ['createCacheServer'].sort();               // value exports
const EXPECTED_ENV_KNOBS = [
  'NX_SELF_HOSTED_REMOTE_CACHE_SERVER',
  'NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN',
  'PORT',
  'CACHE_MIRROR_MAX_AGE_DAYS',
  'GH_TOKEN', 'GITHUB_TOKEN', 'GITHUB_REPOSITORY',
].sort();
const EXPECTED_ACTION_INPUTS = ['port'].sort();                     // parse the consumer action.yml

describe('public consumer surface (DOCS-05)', () => {
  it('package value exports are exactly the enumerated set', () => {
    expect(Object.keys(barrel).sort()).toEqual(EXPECTED_EXPORTS);
  });
  // + assert the consumer action.yml inputs (YAML.parse -> Object.keys(inputs))
  // + assert the documented env-knob list matches EXPECTED_ENV_KNOBS
});
```
*(Type-only exports don't appear on the runtime `barrel` object; assert them via a compile-time `satisfies`/`expectTypeOf` check or by parsing `index.ts`, whichever the planner prefers. Ponytail: a value-export + action-input + knob-list assertion covers the drift D-05 cares about; a full AST census is over-engineering.)*

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `&` + `nohup` + poll-for-ready + `trap` for CI sidecars | Native `background:`/`wait:`/`wait-all:`/`cancel:`/`parallel:` step keywords | Announced 2026-06-25 (postdates my Jan-2026 training cutoff) | DOCS-06's primary pattern; `&` demoted to the GHES/older-runner fallback |
| `services:` container sidecar (Linux-hosted only) | background step (cross-OS, step-context, works with the Actions-cache backend) | With the background-steps engine | Why Docker was deferrable (FOUND-03) |
| Committed hand-maintained action code | Committed bundler output + CI drift guard | Long-standing `actions/*` norm | The `trust.generated.cjs`/`selfcheck.cjs` pattern applied to the action |

**Deprecated/outdated:**
- Third-party "background-action" marketplace actions (JarvusInnovations, etc.): superseded by the native keywords for the serve->use->teardown lifecycle. Mention only as historical context, don't recommend.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `files: ["dist"]` in package.json overrides the `.gitignore`-fallback and includes `dist/` in the tarball; `LICENSE`/`README`/`package.json` auto-included | Pitfall 2, Don't Hand-Roll | Published package missing files. **Mitigated:** `npm pack --dry-run` at execute time turns this into a verified fact — make it a task. |
| A2 | `publishConfig.access: public` is required + sufficient for a public scoped-package publish | Pitfall 7 | Publish 402s. Low risk (long-stable npm behavior); verified at first `npm publish`/`npm publish --dry-run`. |
| A3 | esbuild `--bundle --platform=node` produces a working single-file node24 action entry with `@actions/cache`+`@actions/core` inlined | Standard Stack, Pattern 1 | Action fails at runtime. **Mitigated:** the CI drift-check + a smoke `uses:` in this repo's CI (like the dogfood jobs) proves it live. |
| A4 | `background: true` on a `uses:` step keeps the JS-action process alive as long as `serve()`'s HTTP server is listening (no explicit keep-alive needed) | Architecture diagram, Pattern 2 | Sidecar exits immediately -> Nx gets connection-refused. Node keeps the loop alive while a server listens; verify with a live CI smoke test. |
| A5 | The consumer action must export `NX_SELF_HOSTED_REMOTE_CACHE_SERVER` + `_ACCESS_TOKEN` to later steps (via `core.exportVariable` + `core.setSecret`) so Nx picks them up | Architecture diagram | Consumer must wire env manually. Design choice, not a fact — plan should decide the action's output contract (this becomes part of the DOCS-05 surface). |
| A6 | `@vercel/ncc` "too-new" SUS is a false-positive on a recent bump of a mature package | Package Legitimacy Audit | If ncc is chosen, a human-verify checkpoint resolves it. esbuild avoids the question. |

**If esbuild is swapped for the vite-library-mode path, A3 changes but the drift-guard mitigation is identical.**

## Open Questions (RESOLVED)

> All four resolved at plan-phase per 06-CONTEXT.md "Claude's Discretion" + the orchestrator's resolution notes. See each `RESOLVED:` line.

1. **Should `MAX_CACHE_BODY_BYTES` become a real env knob, or be documented as a fixed limit?**
   - What we know: D-04 lists it in the enumerated surface; the code (`server.ts:12`) has it as a `const` + injectable test param, NOT `process.env`-read.
   - What's unclear: whether D-04 intends it to be tunable or just *documented* as part of the contract.
   - Recommendation: document as a **fixed 2 GiB contract limit** (honest to code, matches the Releases ~2 GiB ceiling per ROBUST-02); promoting it to an env var is optional scope the plan can decline. The guard test should reflect whichever is chosen.
   - **RESOLVED: fixed 2 GiB const, NOT an env knob.** Plan 06-02 asserts `MAX_CACHE_BODY_BYTES === 2147483648` as a fixed contract limit (kept out of the env-knob list); 06-04 documents it as fixed. Recommendation adopted.

2. **Does the npm package export `serve` (library path), or is the bin the only server entry?**
   - What we know: `index.ts` exports only `createCacheServer` (needs a backend + token); `serve()` (the full composition root) is not exported.
   - Recommendation: add `serve`/`ServeOptions`/`RunningServer` to the barrel so `npx`/library consumers get the batteries-included path; include them in the DOCS-05 surface. Decide before writing the guard test (the surface set depends on it).
   - **RESOLVED: MINIMAL barrel -- serve is NOT exported** (reverses the research recommendation, per the orchestrator + D-04). The importable surface stays `createCacheServer` + the 4 port types; the server entry for `npx`/`&` is the `bin` (dist/serve.js), not a barrel export. The 06-02 DOCS-05 guard enumerates exactly that minimal set. See 06-02 / D-04.

3. **Where does the consumer action live — `start-cache-server/` (repo root, mirrors `ppe/`) or `actions/start-cache-server/`?**
   - Recommendation: repo-root `start-cache-server/` mirrors the existing `ppe/` precedent (`uses: op-nx/github-cache/ppe@v`), keeping the consumer-action convention consistent. Planner discretion; either works for `uses:`.
   - **RESOLVED: repo-root `start-cache-server/`.** Plan 06-01 creates start-cache-server/{action.yml,entry.ts,index.js} at the repo root, mirroring ppe/. Recommendation adopted. See 06-01.

4. **Wire an actual `npm publish` release workflow now, or publish-ready only?**
   - What we know: D-13 says publish-ready + `uses:`-consumable is sufficient for v0.0.1; a release workflow is planner discretion.
   - Recommendation: ship publish-READY + a `npm publish --dry-run`/`npm pack --dry-run` CI check (proves the tarball is correct without publishing). Defer the live-publish trigger; `--provenance` can come with it later.
   - **RESOLVED: publish-READY + a `npm pack --dry-run` file-list guard, NO live-publish workflow this milestone.** Plan 06-01 ships the pack-check.cjs file-list guard + CI job; the live-publish trigger is deferred per D-13. Recommendation adopted. See 06-01 / D-13.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | build, action runtime | Yes | v24.13.0 | — |
| npm | pack/publish, workspaces | Yes | 11.6.2 | — |
| git | tag the action ref | Yes | 2.54.0 | — |
| esbuild (or ncc) | bundle the committed action entry | **No** | — | vite/rollup library mode (already installed) — zero new dep |
| @actions/cache / core / @octokit/rest | runtime (unchanged) | Yes | 6.2.0 / 3.0.1 / 22.0.1 | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** a standalone bundler (esbuild/ncc) is not installed; the plan either adds one (recommend esbuild, legitimacy OK) or reuses the already-present `vite`/rollup in library mode (no new install).

## Validation Architecture

> nyquist_validation is ENABLED (config.json). This section derives what VALIDATION.md must prove.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ~4.1.0 (via `@nx/vitest` 23.1.0) `[VERIFIED: package.json]` |
| Config file | per-project (no root vitest.config committed for the lib; Nx `@nx/vitest` inferred targets) |
| Quick run command | `npx nx test github-cache` |
| Full suite command | `npx nx test github-cache` (424 tests / 21 files today, per 05-VERIFICATION) |
| Doc/pack checks | `npm pack --dry-run`; `node packages/github-cache/selfcheck.cjs`-style drift for the action bundle; `npx nx format:check --all`; `npm run fallow:ci` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DOCS-05 | Package value-exports == enumerated set; drift fails | unit | `npx nx test github-cache` (new `*-public-surface.spec.ts`) | Wave 0 |
| DOCS-05 | Consumer `action.yml` inputs == enumerated set | unit (YAML parse) | same spec | Wave 0 |
| DOCS-05 | Documented env-knob list == `EXPECTED_ENV_KNOBS` | unit | same spec | Wave 0 |
| DOCS-06 | Consumer action's committed bundle is in sync with source | drift check (CI) | `npm run build:action && git diff --exit-code` | Wave 0 |
| DOCS-06 | `serve()` sidecar answers over loopback and drains on SIGTERM (ROBUST-04) | existing unit + live CI smoke | `npx nx test github-cache` (`serve.spec.ts` exists); add a `uses:`+`background:`+`cancel:` smoke job | serve.spec.ts exists; smoke job Wave 0 |
| DOCS-02 | The knob resolvers behave as documented (defaults/clamps) | unit (existing) | `retention.spec.ts` etc. already green | Exists |
| GOV-02 | `LICENSE` present at root + shipped in tarball | pack assertion | `npm pack --dry-run` lists `LICENSE` | Wave 0 (manual/CI) |
| GOV-01 | `SECURITY.md` present; contains no non-gmail email | content/allowlist-inversion check | grep-style assertion (email allowlist inversion) | Wave 0 |
| DOCS-06 | npm tarball ships `dist/`, not CI/dogfood internals | pack assertion | `npm pack --dry-run` file-list assertion | Wave 0 |
| DOCS-01/03/04 | Docs exist + link-check + no work-domain leak; trust doc matches single source | content check | doc-presence + allowlist-inversion; optional link-lint | Wave 0 (lightweight) |
| GOV-03 | Versioning doc defines "breaking" against the D-04 surface | content check | doc-presence assertion | Wave 0 (lightweight) |

### Sampling Rate
- **Per task commit:** `npx nx test github-cache` (fast; includes the guard spec).
- **Per wave merge:** full suite + `npm pack --dry-run` + the action-bundle drift check + `format:check --all` + `fallow:ci`.
- **Phase gate:** full suite green + a live CI smoke of the `uses:`+`background:`+`cancel:` consumer flow (the first-push live-close pattern this repo already uses for the dogfood/PPE jobs) before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `packages/github-cache/src/<name>-public-surface.spec.ts` — DOCS-05 export + action-input + env-knob guard (explicit-assertion-list).
- [ ] A committed-action-bundle drift check (script + CI job), modeled on `selfcheck.cjs`.
- [ ] A `npm pack --dry-run` file-list assertion (CI) proving `dist/` in + CI/dogfood internals out.
- [ ] An allowlist-inversion email check over new governance files (SECURITY.md, any `author`) — the only email-shaped token is the approved gmail.
- [ ] A live CI smoke job for the consumer background-step flow (serve up -> scripted GET/PUT -> `cancel:` -> clean exit), analogous to `dogfood-seed`/`dogfood-verify`.
- [ ] Bundler install (`esbuild@0.28.1` exact-pin) + a `pinned-deps.spec.ts` entry if added.

*(Existing infra — `serve.spec.ts`, `retention.spec.ts`, `pinned-deps.spec.ts`, `selfcheck.cjs`, 424 green tests — covers the runtime behavior; Phase 6's new tests are surface/packaging guards, not new-behavior tests.)*

## Security Domain

> security_enforcement ENABLED, ASVS level 1, block_on high. This phase adds NO new runtime code, so the auth/session/crypto categories are N/A; the live surface is **supply chain + configuration + docs correctness**.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V1 Architecture/Docs | yes | DOCS-03 renders the settled trust model from single sources (`trust.ts`/`sync-gate.ts`/ADR); no guessed GHES floor |
| V2 Authentication | no | No new auth surface (bearer auth unchanged, Phase 1) |
| V3 Session Management | no | N/A |
| V4 Access Control | no | Trust/sync gates unchanged (Phases 2/4/5) |
| V5 Input Validation | no | No new runtime input handling (guard test reads local files only) |
| V6 Cryptography | no | CSPRNG token unchanged (`server.ts`) |
| V10 Malicious Code / Supply Chain | yes | Committed action bundle drift-guarded; bundler pinned + legitimacy-vetted (esbuild OK); npm tarball ships only `dist/` |
| V14 Configuration | yes | `publishConfig.access: public` intentional; `files` allow-list excludes secrets/CI internals; no `.env`/token in the package; workspace root stays `private` |

### Known Threat Patterns for this phase
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Maintainer work-email/domain leak in SECURITY.md / package.json `author` | Information Disclosure | Public-gmail-only; prefer GitHub advisories (no email); allowlist-inversion check in the battery (CLAUDE.md hard rule + D-10) |
| Published tarball leaks CI/dogfood internals or secrets | Information Disclosure | `files: ["dist"]` allow-list; `npm pack --dry-run` file-list assertion; dogfood-stays-local invariant |
| Committed action bundle tampered / stale vs source | Tampering | CI drift-check (`build:action && git diff --exit-code`); pinned, OK-verdict bundler |
| DOCS-03 misstates the security model (e.g., retention as poison-containment; a guessed GHES floor) | Repudiation / False assurance | Render single sources; explicit "retention = storage-hygiene, not poison-containment" + "github.com-only, no version guess" (D-08, ADR C14/C15) |
| Supply-chain: a SLOP/typo bundler dep | Tampering | Package-legitimacy gate ran (esbuild OK; ncc SUS-flagged); exact-pin + `pinned-deps.spec.ts` |
| Docs encourage fork-PR write tokens / secrets | Elevation of Privilege | DOCS-03 explicitly says never enable fork-PR send-tokens/secrets; default-branch protection + ephemeral single-tenant runner prerequisites (ADR C14) |

## Project Constraints (from CLAUDE.md / AGENTS.md)

Load-bearing directives the planner must honor (treated with locked-decision authority):
- **ASCII-only output** in all files/scripts/docs — no em/en dashes, curly quotes, ellipsis, box-drawing, emoji (Windows cp1252). Use `--`, `->`, `[OK]`, `|--`.
- **TypeScript strict ESM `module: nodenext`**; relative imports carry `.js`. New code follows this (the barrel already does).
- **Dependency-free CommonJS** for any JS action code that runs **before `npm ci`** (the trust gate); the consumer serve action runs a *bundled* entry (deps inlined) — "dependency-free" there means no separate `node_modules` at the tag, satisfied by the esbuild bundle.
- **Public-repo email rule:** only the public gmail `larsbrinknielsen@gmail.com` in committed content/commit identity; NEVER the work email or its bare domain. Detect by allowlist-inversion, never by encoding the forbidden value.
- **Dogfood-stays-local:** nx.json / project targets / `.github/workflows` tuning never enters the published package (ships only `dist/`). `[[dogfood-changes-stay-consumer-safe]]`
- **Git:** never `git add .`/`-A`/`-u` (stage by name); `git mv` for renames; no AI attribution in commits; on this repo, `git commit -F <file>` (COMMIT_EDITMSG EINVAL on the D: ReFS Dev Drive).
- **Nx-native:** run tasks via `nx` (`npx nx build|test github-cache`), prefer generators for scaffolding; check `node_modules/@nx/<plugin>/PLUGIN.md` for plugin best practices; never guess CLI flags.
- **JS/TS style:** blank lines around control flow/returns; always braces on control-flow bodies.
- **Search:** `git grep` first; `rg` for gitignored/untracked (e.g. anything under `dist/`, `node_modules/`); never the `grep` tool.
- **GSD:** commit STATE.md after `/gsd:plan-phase`; run verify -> secure -> validate -> extract-learnings after execute.

## Sources

### Primary (HIGH confidence)
- **docs.github.com** — Workflow syntax for GitHub Actions (`jobs.<job_id>.steps[*].background` / `.wait` / `.wait-all` / `.cancel` / `.parallel`), fetched 2026-07-20 via markdown.new. VERIFIED: `background` on `run`+`uses` steps; `id` required for `wait`/`cancel`; implicit `wait-all` before post-job cleanup; `cancel` = SIGTERM->SIGKILL; composite cannot declare `background`; max 10 concurrent background steps.
- **Codebase** (Read, this session): `src/index.ts`, `serve.ts`, `server/server.ts`, `lib/retention.ts`, `lib/github-identity.ts`, `lib/select-backend.ts`, `lib/trust.ts`, `lib/sync-gate.ts`, `lib/cache-key.ts`, `lib/local-context.ts`, `lib/release-asset-name.ts`, `backend/{types,actions-cache-backend,releases-backend}.ts`, `action/index.ts`, `action/trust.generated.cjs`, `cleanup/index.ts`, `roundtrip/read-back.ts`, `selfcheck.cjs`, `pinned-deps.spec.ts`, `package.json`, `action.yml`, `ppe/action.yml`, `.github/workflows/ci.yml`, `.gitignore`, `tsconfig.lib.json`.
- **Planning docs:** ARCHITECTURE-DECISION.md (C1-C18), REQUIREMENTS.md, ROADMAP.md, PROJECT.md, 06-CONTEXT.md, 05-SECURITY.md, 05-VERIFICATION.md, config.json, STATE.md.
- **npm registry** (`npm view`, this session): esbuild 0.28.1, @vercel/ncc 0.44.1, @actions/cache 6.2.0, @actions/core 3.0.1, @octokit/rest 22.0.1. Legitimacy gate (`gsd-tools query package-legitimacy check`): esbuild OK, ncc SUS(too-new).

### Secondary (MEDIUM confidence)
- **github.blog changelog** "Actions steps can now be run in parallel" (2026-06-25) — feature announcement; the four keywords; sidecar/serve/teardown use case.
- **WebSearch synthesis** — background-steps engine in the Actions Runner (recent version); GHES lags github.com (availability tied to the GHES-bundled runner) -> justifies the `&` fallback; June-2026 minimum-version enforcement excludes GHES.

### Tertiary (LOW confidence)
- npm `files`/`.gitignore`-fallback/`publishConfig.access` semantics — training knowledge `[ASSUMED]`, gated by `npm pack --dry-run` at execute time (see Assumptions A1/A2).

## Metadata

**Confidence breakdown:**
- Consumer surface enumeration (env knobs / exports / action shape): HIGH — read from the actual repo files this session.
- Background-step schema (DOCS-06): HIGH — tool-verified against docs.github.com; the `uses:`-step + implicit-wait-all facts are load-bearing and confirmed.
- JS-action distribution model (committed bundle): HIGH on the mechanism (`dist/` gitignored + `uses:` resolves from ref), MEDIUM on the exact bundler choice (esbuild recommended; vite-lib-mode alternative).
- npm publish config (files/bin/publishConfig): MEDIUM/LOW — well-established but ASSUMED this session; `npm pack --dry-run` converts it to verified at execute time.
- Background-steps GA status / GHES availability: MEDIUM — announced 2026-06-25, feature confirmed, exact GHES floor unpublished (matches the project's github.com-only-no-version-guess posture).

**Research date:** 2026-07-20
**Valid until:** ~2026-08-03 (14 days). The background-steps era is fast-moving — re-check the workflow-syntax doc if planning slips; the code surface is stable (30 days).
