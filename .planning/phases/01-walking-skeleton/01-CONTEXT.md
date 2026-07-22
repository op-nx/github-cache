# Phase 1: Walking Skeleton - Context

**Gathered:** 2026-07-18
**Status:** Ready for planning
**Mode:** `--auto` (autonomous single-pass) + `--analyze` + `--chain` + TDD (`workflow.tdd_mode: true`)

<domain>
## Phase Boundary

A new library speaks the **Nx self-hosted-cache HTTP contract end-to-end against a trivial
in-process backend**, proving the protocol before any real storage exists. In scope: the
Nx-contract HTTP server (`GET`/`PUT /v1/cache/{hash}`) with its Core-Value hardening
(SRV-01..05), a trivial `Map`-backed in-process `CacheBackend`, and the TEST-07 conformance
fixture - all built test-first.

Out of scope (each is its own later phase): real storage backends, `selectBackend`, the
Actions-cache backend (Phase 2), the GitHub Releases reader + OS-namespacing + private-repo
auth (Phase 3), publish/sync + cleanup/retention + observability (Phase 4), trust-widening +
PPE gate (Phase 5), npm/JS-action distribution + docs + governance (Phase 6). "HOW to build
the walking skeleton" is in scope; adding any new capability is not.

</domain>

<decisions>
## Implementation Decisions

Auto-selected in a single pass (`--auto`). Each was rated on IMPACT (hard-to-reverse?) x
CONFIDENCE (evidence-backed?); none landed in the HIGH-IMPACT + NOT-HIGH-CONFIDENCE trap
quadrant, so all are safe auto-locks. D-04 is flagged low-deference (re-openable in Phase 2).

### Server runtime
- **D-01:** The HTTP server uses Node's built-in **`node:http`** - zero runtime dependencies.
  Rejected Fastify/Hono/Express. Rationale: the distribution contract mandates a
  **dependency-free** JS action (FOUND-03; actions run before `npm ci`), the stack is ESM
  `module: nodenext`, bodies are fully buffered up to 2 GB, the server binds loopback only,
  and `node:http` gives direct control over the body-size cap (streaming byte-counter that
  aborts before unbounded buffering - PITFALLS "413-socket-destroy pattern") and the required
  `Content-Length`. A framework adds surface area and deps for zero benefit at this scope.

### Project shape
- **D-02:** ONE Nx library at **`packages/github-cache`**, import path **`@op-nx/github-cache`**
  (the LOCKED published package name - PROJECT.md), created via **`nx g @nx/js:lib`**
  (Nx-native, ROADMAP-mandated; exact flags resolved at plan/execute time via the
  `nx-generate` skill + `--help`). Ports-and-adapters is realized as **internal modules within
  this one lib**, NOT as multiple Nx projects (multi-project split is premature for an MVP
  slice). The lib carries its own `tsconfig.lib.json` + `tsconfig.spec.json` + a
  `vitest.config.ts` so `@nx/js/typescript` infers `build`/`typecheck` and `@nx/vitest` infers
  `test`; add the new tsconfig as a `reference` in root `tsconfig.json`.

### Module scope (YAGNI - MVP walking skeleton)
- **D-03:** Build ONLY the modules Phase 1 needs: the **HTTP protocol layer**, the
  **`CacheBackend` port + `types`** module, a **trivial in-process (`Map`-backed) backend**,
  and the **TEST-07 conformance fixture**. Pure domain modules stay side-effect-free for
  testability. DEFER `selectBackend` (Phase 2), `shard` (Phase 3/4), `cleanup` (Phase 4), and
  `trust`/write-gate (Phase 2/5) to their own phases - do NOT pre-build them here.

### Read-only 403 seam
- **D-04:** Model **RW-vs-RO as a `CacheBackend` port capability injected at server
  construction** (an internal seam), NEVER a caller-facing mode flag. Phase 1 must exercise the
  read-only-PUT -> **403** path (SC2) before `selectBackend` exists; the trivial backend is
  instantiated in a writable form and a read-only form whose `put()` yields a forbidden result
  -> 403. This preserves the load-bearing "no caller-facing mode flag" safety property
  (TRUST-05, PROJECT.md Key Decisions). **[LOW-DEFERENCE / re-openable]** - this internal seam
  is superseded by `selectBackend(env)` in Phase 2; a Phase 2 planner should treat the exact
  seam shape as an open choice, not settled precedent.

### Conformance fixture (TEST-07)
- **D-05:** Pin the **installed Nx version `23.1.0`** as the named version and **document the
  floor = Nx 21+** (the "server must return exactly `200` on PUT success" contract holds since
  Nx 21). **Hash the FULL vendored Nx spec** committed as a fixture in the repo; the fixture
  fails if the server returns anything other than `200` on PUT success OR if the vendored spec
  drifts. **Never watch `info.version`** (it stayed `1.0.0` across the `202 -> 200` change
  between Nx 20 and 21 - ROADMAP Risk, PITFALLS "Nx PUT 202->200 drift"). Also assert
  `401`/`403`/`404`/`409` and the required `Content-Length`. The **source of the vendored spec
  bytes** (which Nx package/asset ships the OpenAPI contract, vs docs transcription) is a
  RESEARCH item for plan-phase - see canonical refs.

### Best-effort read discipline (SRV-05)
- **D-06:** A read fault degrades to a **404 MISS, never a 5xx** that breaks the build; writes
  **fail closed**. Encode the discipline structurally (e.g. a `never`-typed `PutResult`
  exhaustiveness guard, per PITFALLS "Reads are best-effort by contract"), and write the
  MISS-not-5xx test FIRST. Invariant: every degradation is a MISS, never a wrong or truncated
  result.

### Claude's Discretion
- Exact `nx g @nx/js:lib` flags (bundler `none` vs a builder, `--unitTestRunner=vitest`,
  `--directory`, `--importPath=@op-nx/github-cache`) - resolve at plan/execute time against
  `--help` + the `nx-generate` skill. Let `@nx/js/typescript` + `@nx/vitest` infer targets
  (STRUCTURE.md / CONVENTIONS.md); do NOT hand-author `project.json`.
- Body-cap enforcement mechanism (SRV-04): a streaming byte-counter that aborts + rejects
  before unbounded buffering; exact reject status/format per the vendored contract - planner
  call.
- Bearer-token comparison primitive (SRV-02): `crypto.timingSafeEqual` with a length guard;
  the per-process token is a CSPRNG value (`crypto.randomBytes`).
- Test-file layout (co-located `*.spec.ts` vs `src/`-nested) and whether the "real `serve`
  answers a scripted GET/PUT" acceptance (SC4) runs under the `test` target or the dormant
  `integration` target. Recommend unit specs under `test`; the real-socket round-trip is a
  candidate for `integration` (real OS surface), but Phase 1 has no cross-OS requirement yet
  (that is Phase 3), so `test` is acceptable - leave to the planner.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase spec (authoritative for Phase 1)
- `.planning/ROADMAP.md` -> "Phase 1: Walking Skeleton" - the 4 Success Criteria + the 2 Risks
  are the phase contract (Nx PUT `202->200` drift; SRV-01..05 each need a first-written test).
- `.planning/REQUIREMENTS.md` -> "Server / Protocol Security" (SRV-01..05) + "Testing & Safety
  Net" (TEST-07) - the locked requirement text, including the verified TEST-07 note (Nx client
  matches `200` strictly, treats `409`/`403` as graceful no-ops, errors on any other status).

### Grounding (LOCKED foundation - do not reopen)
- `.planning/PROJECT.md` -> "Constraints" (TS strict/ESM `nodenext`, Node 24, Nx 23, Vitest;
  relative imports carry `.js`; dep-free CJS actions), "Context" (ports-and-adapters around a
  single `CacheBackend` port; three credentials never mixed; local-authenticated-to-GitHub
  assumption), "Key Decisions".
- `.planning/ARCHITECTURE-DECISION.md` - decision record + CREEP (CVE-2025-36852) control
  ledger C1-C18; the default server carries C1 + C4.

### Nx contract + platform facts (implementation-independent)
- `.planning/research/PITFALLS.md` -> "Empirically-Verified Platform Facts" - Nx PUT
  `202->200` drift, best-effort-MISS discipline (`never`-typed `PutResult`, 413-socket-destroy),
  buffered-bodies-to-2GB tradeoff, the Nx self-hosted-cache spec `401/403/404/409` semantics.
- Nx self-hosted caching spec + usage notes (upstream):
  https://nx.dev/docs/guides/tasks--caching/self-hosted-caching#usage-notes - the OpenAPI
  contract (`GET`/`PUT /v1/cache/{hash}`, status semantics, env vars, stable-spec guarantee).

### Workspace shell state (current tooling constraints)
- `.planning/codebase/STACK.md`, `STRUCTURE.md`, `CONVENTIONS.md`, `TESTING.md` - the
  torn-down shell (post Phase 0): where to add the lib (`packages/<name>` via `nx g`), the
  strict `tsconfig.base.json` options to extend, the `@nx/js/typescript` + `@nx/vitest`
  inferred-target model, and the CI job matrix the new targets flow into.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable / preserved assets (the workspace SHELL - keep intact, do not re-derive)
- `nx.json` - `targetDefaults` for `build`/`typecheck`/`test`, plus the dormant `integration`
  target with the load-bearing cross-OS discriminator `{ "runtime": "node -p process.platform" }`
  (D-03 from Phase 0; memory `os-sensitive-nx-hash-discriminator`). Inherit it; do NOT
  re-derive in later phases.
- `tsconfig.base.json` - strict, `module`/`moduleResolution: nodenext`, `target: es2022`,
  `composite: true`, `emitDeclarationOnly: true`, `customConditions: ["@op-nx/source"]`,
  `esModuleInterop: false` (use named / `import * as` for CJS-only packages), `isolatedModules`,
  `noUnusedLocals`/`noImplicitReturns`/`noFallthroughCasesInSwitch`/`noImplicitOverride`.
- `tsconfig.json` (root, `references: []`), `vitest.workspace.ts` (globs
  `vite.config.*`/`vitest.config.*` - the new lib needs its own config to be discovered),
  `.gitattributes eol=lf`, root `package.json` scripts (`nx run-many -t build/typecheck/test/
  integration`, `nx format:*`).

### Established patterns (constraints for the first source files)
- Prettier `{ "singleQuote": true }`; run via `nx format:*`, not the Prettier CLI.
- Relative imports MUST carry explicit `.js` extensions (nodenext). Each package ships its own
  `tsconfig.lib.json` (build) + `tsconfig.spec.json` (test); JS emit is via the build tool, not
  `tsc` (`emitDeclarationOnly`).

### Integration points (where the new lib connects to the shell)
- Root `tsconfig.json` `references[]` - add the new lib's tsconfig.
- `vitest.workspace.ts` - the new `vitest.config.ts` is auto-discovered by the glob.
- `.github/workflows/ci.yml` - the 5 existing jobs (`format-check`/`build`/`typecheck`/`test` +
  ubuntu+windows `integration` matrix) run `nx run-many -t <target>`, so the new lib's targets
  flow in automatically. The `integration` job stops being a green no-op only if the lib
  defines an `integration` target (optional this phase - see Claude's Discretion).

</code_context>

<specifics>
## Specific Ideas

- **Deliberately minimal.** The walking skeleton proves the contract E2E against a trivial
  `Map`-backed backend with NO real storage. Do NOT reach for `@actions/cache` or `@octokit/rest`
  in Phase 1 (Phase 2 / Phase 3+); keep Phase 1 dependency-light.
- **Three credentials, never mixed** (PROJECT.md): Phase 1 touches ONLY the per-process CSPRNG
  **bearer token** (Nx <-> server). `ACTIONS_RUNTIME_TOKEN` and `GITHUB_TOKEN`/`GH_TOKEN` belong
  to later phases - do NOT introduce them now.
- **TDD is mandatory** (`workflow.tdd_mode: true`; ROADMAP "built test-first"; the passed `--tdd`
  flag is consistent with the already-enabled global setting - no config change needed). Each
  SRV-01..05 property and each status code (`200`/`401`/`403`/`404`/`409`) gets a test written
  FIRST, then the implementation.

</specifics>

<deferred>
## Deferred Ideas

Belong to later phases; captured so they are not lost, not acted on now:

- `selectBackend(env)` + Actions-cache RW backend + `withHashLock` + SIGTERM drain -> **Phase 2**.
- GitHub Releases read-only reader + OS-namespacing + authenticated private-repo local read ->
  **Phase 3**.
- `{push,schedule}`-gated publish/sync + age-based cleanup + observability + storage-cap
  degradation -> **Phase 4**.
- `pull_request`/`release` trust-widening + single-source allowlist + server-produced-key
  filter + PPE-hygiene gate -> **Phase 5**.
- npm package + JS Action + background-step CI pattern + enumerated public surface + adoption
  docs + SECURITY.md/LICENSE/semver -> **Phase 6**.
- `shard` / `cleanup` / `trust` pure domain modules -> their respective phases (NOT Phase 1;
  D-03).

None else - discussion stayed within phase scope.

</deferred>

---

*Phase: 1-Walking Skeleton*
*Context gathered: 2026-07-18*
