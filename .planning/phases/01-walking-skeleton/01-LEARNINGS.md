---
phase: 1
phase_name: "Walking Skeleton"
project: "@op-nx/github-cache"
generated: "2026-07-19"
counts:
  decisions: 4
  lessons: 6
  patterns: 6
  surprises: 4
missing_artifacts:
  - "01-UAT.md"
---

# Phase 1 Learnings: Walking Skeleton

## Decisions

### Bundler = tsc, not swc (zero-dependency mandate wins over the pinned default)
The plan/RESEARCH pinned `nx g @nx/js:lib --bundler=swc`, but `@nx/js:swc` `require.resolve`s and `execSync`s `@swc/cli` — it hard-requires `@swc/cli` (+~109-package tree) and declares `@swc/helpers` as a lib runtime dep. Switched to `--bundler=tsc` (uses the already-present `typescript`, zero new deps, inferred targets); removed the generator-added `tslib` from lib deps.

**Rationale:** D-01/FOUND-03 zero-runtime-dependency mandate is LOCKED; the bundler was explicitly "Claude's Discretion / re-openable at execute time." A locked constraint overrides a discretionary default.
**Source:** 01-01-SUMMARY.md

### `node:http` + `node:crypto` only — no server framework
The HTTP contract server uses Node stdlib exclusively (`node:http`, `node:crypto`, global `fetch`), no Fastify/Hono/Express.

**Rationale:** dependency-free JS-action mandate (actions run before `npm ci`), ESM `nodenext`, buffered 2 GB bodies, loopback bind, and direct control of the body-cap streaming abort + `Content-Length`.
**Source:** 01-CONTEXT.md (D-01), 01-RESEARCH.md

### RW vs RO modeled as a backend port capability, never a caller-facing mode flag
The read-only-PUT → 403 path is exercised via `createReadOnlyMemoryBackend()` (a port-capability factory whose `put()` yields `'forbidden'`), injected at server construction — not a mode flag.

**Rationale:** preserves the load-bearing "no caller-facing mode flag" safety property (TRUST-05, D-04); this Phase-1 seam is superseded by `selectBackend(env)` in Phase 2.
**Source:** 01-02-SUMMARY.md, 01-03-SUMMARY.md, 01-CONTEXT.md (D-04)

### Conformance fixture vendors the spec from docs, pins a named Nx version, hashes the full file
`nx-cache-openapi.v23.1.0.json` was transcribed verbatim (there is no standalone spec in node_modules); the fixture sha256-hashes the full file and pins `PINNED_NX_VERSION = '23.1.0'`, asserting PUT success = exactly `200` — never watching `info.version`.

**Rationale:** TEST-07 + the Nx `202→200` drift risk; `info.version` is permanently `1.0.0` so it is useless as a drift signal.
**Source:** 01-04-SUMMARY.md, 01-RESEARCH.md, REQUIREMENTS.md (TEST-07)

---

## Lessons

### `nx g @nx/js:lib` scaffolds a sample barrel that must be neutralized when the sample is deleted
The generator writes `src/index.ts` as `export * from './lib/<sample>.js'`. Deleting the sample `src/lib/*` without neutralizing `src/index.ts` leaves a dangling import that `tsconfig.lib.json` (`include: src/**/*.ts`) compiles → deterministic TS2307 typecheck failure. This was the plan-checker's one BLOCKER, fixed by neutralizing the barrel in the same step that deletes the sample (Plan 02), then finalizing real exports in Plan 04.

**Context:** caught pre-execution by the plan-checker reading the actual `@nx/js` generator templates + a dry-run.
**Source:** 01-REVIEW.md, 01-02-SUMMARY.md

### The generator's actual output differs from documentation assumptions
It emits `vitest.config.mts` (not `.ts`), plus `tsconfig.json`/`.swcrc`/`README.md`, auto-adds `{ "path": "./packages/github-cache" }` to the root `tsconfig.json` `references[]` (so do NOT hand-add a second differently-shaped ref — they don't dedup under `sync:check`), and updates root `nx.json`.

**Context:** verified empirically against the installed generator; the plans were corrected before execution.
**Source:** 01-REVIEW.md, 01-01-SUMMARY.md

### A write-path backend fault must be CAUGHT → 500, never left uncaught
An uncaught throw in the PUT path hangs the `node:http` socket and surfaces no status, which violates SRV-05's own prohibition ("an error status is surfaced, never a silent 200"). Catching → 500 is the fail-closed behavior; reads still degrade to 404.

**Context:** SRV-05 fail-closed-write requirement.
**Source:** 01-03-SUMMARY.md

### Assert security behavior at the layer that actually performs it
The `server.spec.ts` "binds 127.0.0.1 only" test was vacuous — it asserted its own test-harness `listen()` address, but `createCacheServer` never binds (binding is `serve()`'s job). Real, non-vacuous coverage lives in `serve.spec.ts`, which drives the actual `serve()` composition root that has no injectable `host`.

**Context:** WR-01 (code review) → the nyquist auditor added a dedicated non-vacuous production-bind test to `serve.spec.ts`.
**Source:** 01-REVIEW.md (WR-01), 01-VALIDATION.md

### `@nx/vitest testMode:"watch"` makes the inferred `test` target run bare `vitest`
Safe in the executor/CI path (non-TTY → Vitest's own watch default resolves false), but a human running `npx nx test github-cache` from an interactive terminal would drop into a hanging watch process. Not pinned to single-run in this phase.

**Context:** plan-checker W1 (non-blocking); a future phase may pin `-- --run` or `testMode: "run"`.
**Source:** 01-REVIEW.md / plan-checker re-verification

### The TypeScript LSP diagnostics feed is stale across TDD RED→GREEN
After every GREEN commit, the ambient LSP feed reported "Cannot find module" / "has no exported member" for modules that existed on disk. The authoritative signal is `npx nx test/typecheck/build`, which was green every time. Never gate a decision on the passive LSP feed.

**Context:** observed after all three TDD waves; matches the project's "LSP not authoritative" rule.
**Source:** session verification (post-wave gates), CLAUDE.md rule

---

## Patterns

### Guard-clause ladder with load-bearing order
`route(404) → auth(401) → hash(400) → body-cap(413) → backend`. The hash regex runs on the raw undecoded `req.url`, so encoded traversal and query strings 400 before any backend call; a spy backend asserts `called === false` on rejected requests.

**When to use:** any request-validating HTTP handler where a malformed/unauth/oversized request must never reach the backend.
**Source:** 01-03-SUMMARY.md, 01-REVIEW.md

### Timing-safe auth via fixed-length digests
Hash both the presented and expected bearer tokens to fixed 32-byte SHA-256 digests, then `crypto.timingSafeEqual`. This kills the length side-channel (`timingSafeEqual` throws on unequal-length inputs) and avoids any `===` fallback. Token itself is a CSPRNG `randomBytes(32)`.

**When to use:** constant-time secret comparison for variable-length inputs.
**Source:** 01-02-SUMMARY.md, 01-RESEARCH.md

### Body-size cap: Content-Length fast-reject + streaming byte-counter + `req.destroy()`
Fast-reject on a declared oversized `Content-Length`, then a streaming counter that aborts (413, socket-destroy) at the cap — over-cap chunks are counted but not pushed, so peak retained memory is cap + one chunk. Also catches a lying small `Content-Length`.

**When to use:** buffered request bodies with a hard size ceiling; DoS prevention.
**Source:** 01-03-SUMMARY.md

### Full-file-hash drift guard with RED-first proof
Vendor the external contract as a committed fixture, sha256-hash the whole file, and pin a named version — never a self-reported version field. Prove the guard fires with a RED-first step (a deliberately wrong placeholder digest must FAIL before the real digest is pinned).

**When to use:** locking conformance to an external spec whose own version field is unreliable.
**Source:** 01-04-SUMMARY.md

### Hash-pinned fixture belongs in `.prettierignore` (LF-normalized)
A byte-hash-pinned fixture must be excluded from Prettier (which would rewrite the JSON bytes and break the digest / fail `format-check`) and LF-normalized so git blob, working tree, and cross-OS checkout all hash identically under `.gitattributes eol=lf`.

**When to use:** any committed file whose exact bytes are asserted by a test.
**Source:** 01-04-SUMMARY.md

### Sequential-on-main execution for single-plan dependent waves
When waves are single-plan and sequentially dependent, run executors on the main working tree rather than in git worktrees: worktrees don't carry the gitignored `node_modules/`, so `nx g`/`vitest` would break without a slow per-worktree `npm ci`, and there is no parallelism to gain.

**When to use:** phases whose waves are single-plan and each depends on the prior, in Node/Nx repos.
**Source:** orchestrator execution decision (execute-phase, this session)

---

## Surprises

### No standalone Nx OpenAPI spec ships in node_modules
The Nx self-hosted-cache HTTP client is compiled into the ~14.7 MB Rust native addon (`@nx/nx-<os>-<arch>/*.node`); there is no vendorable spec file on disk. The conformance fixture had to transcribe the contract from nx.dev docs.

**Impact:** resolved D-05's open research item; the vendored fixture + full-file hash is the drift signal instead of a shipped spec.
**Source:** 01-RESEARCH.md

### Nx PUT-success drifted `202 → 200` (Nx 20 → 21) while `info.version` stayed `1.0.0`
The success status changed across a major Nx version without any bump to the spec's own `info.version`.

**Impact:** the reason TEST-07 mandates full-spec hashing + a pinned named version and forbids watching `info.version`; a `202` breaks the Nx client (matches `200` strictly).
**Source:** 01-RESEARCH.md, ROADMAP.md (Phase 1 Risk)

### `@nx/js:swc` pulls ~109 packages
Choosing the recommended swc bundler would have added a ~109-package `@swc/cli` tree plus a lib runtime dep — invisible until the generator dry-run was inspected.

**Impact:** forced the tsc-bundler deviation to hold the zero-dependency line.
**Source:** 01-01-SUMMARY.md

### Transient vitest forked-worker crash on Windows (flake)
One of five independent verifier test runs hit a vitest forked-worker pool crash with zero failed assertions; all other runs were clean 34/34 (later 35/35).

**Impact:** INFO-level only, non-blocking; noted for awareness as a Windows-pool flake.
**Source:** 01-VERIFICATION.md
