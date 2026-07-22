# Phase 2: Default Cache in CI - Context

**Gathered:** 2026-07-19
**Status:** Ready for planning
**Mode:** `--auto` (autonomous single-pass) + `--analyze` + TDD (`workflow.tdd_mode: true`)

<domain>
## Phase Boundary

The **default composition** goes live: the Actions-cache CI-RW `CacheBackend`, selected
purely by runtime context via `selectBackend(env)`, gated by a **conservative default-deny**
write-trust (trusts only `{push, schedule}`), serialized by an in-process **per-hash lock**,
and drained on **SIGTERM** - dogfooded in THIS repo's CI through a minimal JS action. This is
the **first real GitHub cache** (Phase 1 proved the contract against an in-process `Map`).

In scope (HOW to build these six locked requirements): `selectBackend(env)` (TEST-01,
TRUST-05), `isWriteTrusted(env)` conservative gate (TRUST-03), `withHashLock` (TEST-02), the
`@actions/cache`-backed RW backend with a single-source archive-path helper + exact pinning
(ROBUST-03), `serve` SIGTERM drain (ROBUST-04), and the minimal dogfood JS action + CI wiring
that produces real hits/misses.

Out of scope (each its own later phase): the GitHub Releases reader + OS-namespacing +
private-repo auth (Phase 3); publish/sync + cleanup/retention + observability (Phase 4);
`pull_request`/`release` trust-widening + single-source-of-truth allowlist with `selfcheck.cjs`
parity + server-produced-key filter + PPE gate (Phase 5); the **published** npm/JS-action
surface + background-step consumption docs + enumerated public surface + governance (Phase 6).
Do NOT widen the write gate early; do NOT build the second store.

</domain>

<decisions>
## Implementation Decisions

Auto-selected in a single pass (`--auto`). Each rated on IMPACT (hard-to-reverse?) x
CONFIDENCE (evidence-backed?). None landed in the HIGH-IMPACT + NOT-HIGH-CONFIDENCE trap
quadrant as a *lock*; where a HIGH-IMPACT sub-choice was not HIGH-CONFIDENCE (the CI
launch/verify mechanism, the `test:act` harness on arm64), it is recorded as an explicit
RESEARCH/VERIFY item for plan-phase rather than silently locked (see "Open for research").

### Backend selection seam (supersedes Phase 1 D-04)
- **D-01:** `selectBackend(env)` is a **pure function returning exactly ONE `CacheBackend`**
  per process, chosen only from runtime context. `serve()` calls it in place of the hard-wired
  `createWritableMemoryBackend()` (serve.ts:54). **RW-vs-RO is 100% context-derived - NO
  caller-facing mode flag** (TRUST-05, ARCHITECTURE Decision 1; the load-bearing no-flag safety
  property). This supersedes Phase 1's re-openable D-04 construction-time seam. The writable
  memory backend stays as a test/dev aid; local context gets a **read-only** backend (a RO
  wrapper for now; the real GitHub Releases reader lands in Phase 3). `env` is an explicit
  injectable param (defaulting to `process.env`) so unit specs drive CI-vs-local without
  mutating global env. [IMPACT med / CONFIDENCE high]

### Write-trust gate (TRUST-03)
- **D-02:** A **separate `isWriteTrusted(env)` pure predicate** that `selectBackend` composes
  (CI + trusted event -> RW Actions-cache; otherwise RO). `TRUSTED_EVENTS = ['push','schedule']`
  is the **single source of truth**, **default-deny, no denylist**. Dangerous shared-default-
  scope events (`pull_request_target`, `issue_comment`, fork-`workflow_run`, and every
  non-allowlisted trigger) are **refused by construction** and asserted by test. Deliberately
  conservative: `pull_request`/`release` widening is **Phase 5 (TRUST-01)** - do NOT add them
  now. The dependency-free action copy + `selfcheck.cjs` parity assertion is **Phase 5
  (TRUST-04)**; seed ONE const now and do NOT create a dual root copy (avoid the PoC's
  duplicated-`TRUSTED_EVENTS` debt - Pitfall 1). [IMPACT high / CONFIDENCE high]

### Per-hash lock (TEST-02)
- **D-03:** `withHashLock` = an in-process `Map<hash, Promise>` that **serializes same-hash
  writes, runs different hashes concurrently, evicts the map entry on settle, and never wedges
  on a rejected op**, applied at the write path. Ceiling is single-process / ephemeral-single-
  tenant runner (the documented deployment) - comment-lock that ceiling; a distributed lock is
  out of scope. TEST-02 gives the lock the concurrency rigor the PoC's version lacked (Pitfall
  4 note: "codebase flags `withHashLock` promise bookkeeping as under-tested"). [IMPACT med /
  CONFIDENCE high]

### Actions-cache backend + archive-path (ROBUST-03, Pitfall 7)
- **D-04:** First runtime dependency: **`@actions/cache` pinned EXACT** (not `^`) in
  `packages/github-cache/package.json`; upgrades gated behind a `test:act` end-to-end restore.
  **`cacheArchivePath(hash)` is the SINGLE SOURCE OF TRUTH** for the temp path, comment-locked:
  `@actions/cache` version-hashes the *literal* path strings, so any cosmetic path change
  silently changes the version and every restore MISSes. `get` -> `restoreCache`, `put` ->
  `saveCache`; the `saveCache` **`-1` return is ambiguous** (entry-exists OR write-denied by a
  read-only token) - treat as a benign no-op (idempotent under CORR-01) because the **write gate
  (D-02), not the backend, is what keeps a denied write from masking a real outage**
  (Empirically-Verified Facts). [IMPACT HIGH (silent-MISS class) / CONFIDENCE high on the
  pattern]

### Dogfood JS action + SIGTERM drain (ROBUST-04, SC5, FOUND-03)
- **D-05:** Build a **minimal JS action scoped to THIS repo's CI dogfood only** - NOT the
  published/enumerated public surface (that is Phase 6, DOCS-05/06). A JS action is the **only**
  launch path for the Actions-cache backend: `ACTIONS_RUNTIME_TOKEN`/`ACTIONS_RESULTS_URL` are
  injected only into JS actions, and in a plain `run:` step `@actions/cache` save/restore
  **silently no-ops** (Empirically-Verified Facts, git-history-confirmed). `serve` gains a
  **SIGTERM handler that drains in-flight puts before exit** (the background-step `cancel`
  teardown sends SIGTERM then SIGKILL after a short grace), covered by an in-flight-put drain
  test. Scope is locked; the exact CI launch + verification mechanism is a research item
  (below). [IMPACT HIGH / CONFIDENCE high on SCOPE, medium on mechanism]

### Credentials (carry-forward, PROJECT.md "three credentials never mixed")
- **D-06:** Phase 2 introduces the **`ACTIONS_RUNTIME_TOKEN`** (Actions-cache backend) and
  reads **context env** (`GITHUB_ACTIONS`, `GITHUB_EVENT_NAME`, `GITHUB_REPOSITORY`,
  `GH_TOKEN`||`GITHUB_TOKEN`). The runtime token is passed **only by process inheritance, never
  via `$GITHUB_ENV`**, and the bearer token is masked. These stay distinct from the Phase 1
  per-process CSPRNG bearer token; do NOT mix them.

### Open for research / verify (NOT auto-locked - planner must resolve)
- **R-01:** **`test:act` feasibility on this arm64/QEMU host.** `act` runs x86 images under
  slow QEMU emulation on Snapdragon; the ROBUST-03 upgrade canary may have to be a **real-CI-run
  canary** rather than a local `act` target, or a dormant/CI-only target. Planner: research
  act-on-arm64 vs. a CI-gated end-to-end restore; pick the mechanism, don't assume local `act`.
- **R-02:** **The exact CI launch + verification of the dogfood action.** Surface the platform
  facts: the **Windows detached-background-process stdio pitfall** (a backgrounded server that
  inherits the step pipe is killed on windows-11-arm - must detach/log to a temp file), the
  **job-level `permissions:` REPLACE (not merge)** trap (a `contents: write` job silently loses
  `actions: read`, 404-ing cache list), and that Phase 2's CI job proves **real hits/misses**
  (not a green no-op). Planner: resolve how `serve`+the JS action are wired into `ci.yml` and
  how the hit/miss is asserted; this is HIGH-IMPACT and only MEDIUM-CONFIDENCE, so treat as
  verify-before-lock.

### Claude's Discretion
- Exact module layout under `packages/github-cache/src/` (e.g. `lib/select-backend.ts`,
  `lib/trust.ts`, `lib/with-hash-lock.ts`, `backend/actions-cache-backend.ts`,
  `backend/read-only-backend.ts`) - mirror Phase 1's internal-modules-in-one-lib shape (D-02);
  planner call.
- Whether the dogfood action lives under `packages/github-cache/` (e.g. an `action/` dir + a
  CJS entry) or a top-level `action.yml` - resolve at plan time against FOUND-03 (JS action,
  dependency-free, runs before `npm ci`).
- The `test:act` target wiring / whether the real-socket + Actions-cache round-trip runs under
  the dormant `integration` target vs a new `test:act` target - planner call (see R-01).
- Exact `read-only` backend shape for local context (a RO wrapper over the memory backend vs a
  dedicated `createReadOnlyBackend()` that always yields `put -> forbidden -> 403`) - the
  Phase 1 `createReadOnlyMemoryBackend()` (403 seam) is the reusable analog.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase spec (authoritative for Phase 2)
- `.planning/ROADMAP.md` -> "Phase 2: Default Cache in CI" - the 5 Success Criteria + the 3
  Risks are the phase contract (archive-path single-source silent-MISS; SIGTERM drain must not
  deadlock the runner's implicit `wait-all`; gate stays conservative - no early widening).
- `.planning/REQUIREMENTS.md` -> "Testing & Safety Net" (TEST-01, TEST-02), "Robustness"
  (ROBUST-03, ROBUST-04), "Trust & CREEP-safety" (TRUST-03, TRUST-05) - the locked requirement
  text.

### Grounding (LOCKED foundation - do not reopen)
- `.planning/ARCHITECTURE-DECISION.md` - Decision 1 (one backend per process via
  `selectBackend`; RW/RO context-derived, no caller flag; publisher behind no port),
  Decision 2 (write-trust allowlist default-deny; sync gate separate = `{push,schedule}`),
  Decision 4 control ledger (default carries C1 + C4; C1 host-detected fail-closed is Phase 5).
- `.planning/PROJECT.md` -> "Constraints" (TS strict/ESM `nodenext`, Node 24, Nx 23, Vitest;
  relative imports carry `.js`; dep-free CJS actions), "Context" (three credentials never mixed:
  bearer token vs `ACTIONS_RUNTIME_TOKEN` vs `GITHUB_TOKEN`/`GH_TOKEN`), "Key Decisions".

### Platform facts + pitfalls (implementation-independent, LOAD-BEARING)
- `.planning/research/PITFALLS.md` -> "Empirically-Verified Platform Facts" (`@actions/cache`
  `saveCache -1` ambiguity; `ACTIONS_RUNTIME_TOKEN` JS-action-only injection + plain-`run:`
  silent no-op; Windows detached-background stdio; job `permissions:` REPLACE-not-merge),
  Pitfall 1 (conservative trigger set + why `pull_request` is genuinely safe - Phase 5 detail,
  read it to NOT widen early), Pitfall 4 (`withHashLock`/concurrency rigor), Pitfall 7
  (`@actions/cache` literal-path version hashing + zstd-vs-gzip cross-OS; `cacheArchivePath()`
  as sole source; re-verify end-to-end restore on any bump).

### Phase 1 seams this phase plugs into (current source)
- `packages/github-cache/src/backend/types.ts` - the `CacheBackend` port (`get`/`put`),
  `PutResult = 'stored' | 'conflict' | 'forbidden'` - the exact interface `selectBackend`
  returns and the Actions-cache backend implements.
- `packages/github-cache/src/serve.ts` - the SC4 composition root (`serve()` at :46, hard-wires
  `createWritableMemoryBackend()` at :54; token `||` fallthrough; `resolvePort` 0-fallback;
  Windows-safe entry guard) - the point where `selectBackend(env)` replaces the memory backend
  and where the SIGTERM handler attaches.
- `packages/github-cache/src/server/server.ts` - the guard-clause ladder + `HASH_PATTERN`
  `^[a-f0-9]{1,512}$` (also the Actions-cache key space, TRUST-08) + the `PutResult`->status map
  (`stored`->200 / `conflict`->409 / `forbidden`->403) the write path drives; the write gate
  wraps `backend.put`.
- `packages/github-cache/src/backend/memory-backend.ts` - `createWritableMemoryBackend()` +
  `createReadOnlyMemoryBackend()` (the 403 seam) - the reusable analog for the local RO backend.

### Nx contract (implementation-independent)
- Nx self-hosted caching spec: https://nx.dev/docs/guides/tasks--caching/self-hosted-caching#usage-notes
  (`GET`/`PUT /v1/cache/{hash}`, status semantics, `NX_SELF_HOSTED_REMOTE_CACHE_SERVER`/`_ACCESS_TOKEN`).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable / preserved assets
- **`serve()` composition root** (serve.ts) - already resolves port/token and binds loopback;
  Phase 2 swaps the backend factory (memory -> `selectBackend(env)`) and adds SIGTERM. Keep the
  `||` token fallthrough (Pitfall 8) and the `pathToFileURL` entry guard (Pitfall 6) intact.
- **`createReadOnlyMemoryBackend()`** (memory-backend.ts) - the D-04 403 seam from Phase 1 is
  the direct analog for the local read-only backend `selectBackend` returns in non-CI context.
- **`PutResult` never-guard + status map** (server.ts) - the write path's `forbidden`->403 /
  `conflict`->409 / `stored`->200 mapping is already exhaustive; the Actions-cache backend just
  returns those variants; the write gate decides RW/RO upstream (backend never sees a flag).
- **`nx.json` dormant `integration` target** with `{ "runtime": "node -p process.platform" }`
  cross-OS discriminator (Phase 0 D-03; memory `os-sensitive-nx-hash-discriminator`) - the home
  for a real-socket + Actions-cache round-trip if the planner routes it there (see R-01).

### Established patterns (constraints for new source files)
- ONE Nx lib, internal modules (D-02 carry-forward); zero-runtime-dep server (D-01) - but
  Phase 2 legitimately adds `@actions/cache` as the FIRST runtime dep (D-04), pinned exact.
- Relative imports carry explicit `.js`; Prettier `{ singleQuote: true }` via `nx format:*`;
  strict `tsconfig.base.json` (`nodenext`, `noUnusedLocals`, exhaustive switches).
- TDD mandatory: each of TEST-01 (selectBackend: CI-vs-local, `GITHUB_REPOSITORY` validation,
  `GH_TOKEN||GITHUB_TOKEN` fallthrough, malformed-repo rejection, explicit `env`), TEST-02
  (withHashLock: serialize/concurrent/evict/no-wedge), TRUST-03 (dangerous events refused),
  ROBUST-04 (SIGTERM in-flight-put drain) gets a test written FIRST.

### Integration points
- `serve.ts:54` - `createCacheServer(createWritableMemoryBackend(), token)` becomes
  `createCacheServer(selectBackend(process.env), token)` (or equivalent), plus a SIGTERM
  listener on the running server.
- `packages/github-cache/package.json` - gains the exact-pinned `@actions/cache` dependency +
  (per R-01) a `test:act` script; the lib's inferred `build`/`typecheck`/`test` targets already
  flow into `ci.yml`'s `nx run-many` jobs.
- `.github/workflows/ci.yml` - the dogfood job that runs `serve` (via the JS action) against the
  Actions-cache backend and asserts real hits/misses (SC5); mind the `permissions:`
  REPLACE-not-merge trap (needs both `contents: read`/`write` as used AND `actions: read`).

</code_context>

<specifics>
## Specific Ideas

- **This is the first REAL cache** - the whole point of the slice is a live hit/miss in this
  repo's CI (SC5), not a mock. The dogfood must exercise the actual `@actions/cache` primitive.
- **Do NOT widen the write gate** - `{push, schedule}` only. `pull_request`/`release` is Phase 5.
  The conservative default is a Core-Value CREEP control (C1/C2), not a placeholder.
- **The `-1` ambiguity is a trust-gate concern, not a backend concern** - resist "detecting"
  exists-vs-denied at the backend layer; the gate upstream is what makes a denied write safe.
- **`test:act` may not run locally on this arm64 host** (QEMU-slow x86) - the upgrade canary's
  real form is a plan-phase decision (R-01), not assumed to be local `act`.

</specifics>

<deferred>
## Deferred Ideas

Belong to later phases; captured so they are not lost, not acted on now:

- GitHub Releases read-only reader + OS-namespacing + authenticated private-repo local read ->
  **Phase 3** (the local RO backend `selectBackend` returns is a placeholder until then).
- `{push,schedule}`-gated publish/sync + age-based cleanup + observability + storage-cap
  degradation -> **Phase 4**.
- `pull_request`/`release` host-detected fail-closed trust-widening + single-source-of-truth
  allowlist with the dependency-free action copy + `selfcheck.cjs` parity (TRUST-04) +
  server-produced-key mirror filter + PPE-hygiene gate -> **Phase 5**.
- The **published** npm package + JS Action, the background-step consumption pattern +
  `cancel:` teardown docs (DOCS-06), enumerated/tested public surface (DOCS-05), governance ->
  **Phase 6** (Phase 2's action is dogfood-internal only).

None else - discussion stayed within phase scope.

</deferred>

---

*Phase: 2-Default Cache in CI*
*Context gathered: 2026-07-19*
