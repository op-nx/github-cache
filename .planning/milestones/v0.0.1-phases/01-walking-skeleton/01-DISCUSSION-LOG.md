# Phase 1: Walking Skeleton - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-07-18
**Phase:** 1-Walking Skeleton
**Mode:** `--auto` (autonomous single-pass) + `--analyze` + `--chain`
**Areas discussed:** Server runtime, Project shape, Module scope, Read-only 403 seam, Conformance fixture, Best-effort read

> Auto-mode: Claude selected the recommended option for each area (no interactive
> AskUserQuestion). Each was rated IMPACT x CONFIDENCE; none fell in the HIGH-IMPACT +
> NOT-HIGH-CONFIDENCE trap quadrant, so all were auto-locked. D-04 flagged low-deference.

---

## Server runtime

| Option | Description | Selected |
|--------|-------------|----------|
| `node:http` (built-in, 0-dep) | Zero deps; full control of body-cap abort + `Content-Length`; loopback bind | ✓ |
| Fastify / Hono | Ergonomic routing; adds deps + surface | |
| Express | Familiar; heavier, adds deps | |

**Choice:** `node:http`.
**Notes:** Dependency-free-JS-action constraint (FOUND-03, actions run before `npm ci`), ESM `nodenext`, buffered 2 GB bodies, PoC precedent (PITFALLS 413-socket-destroy). IMPACT HIGH / CONFIDENCE HIGH.

---

## Project shape

| Option | Description | Selected |
|--------|-------------|----------|
| Single Nx lib, internal modules | `packages/github-cache` -> `@op-nx/github-cache`; ports-and-adapters as internal modules | ✓ |
| Multiple Nx libs | Split protocol/domain/backend into separate projects | |

**Choice:** Single lib.
**Notes:** Published name locked by PROJECT.md; multi-project split premature for an MVP slice. `nx g @nx/js:lib`, flags at plan/execute. IMPACT HIGH / CONFIDENCE HIGH.

---

## Module scope

| Option | Description | Selected |
|--------|-------------|----------|
| Only Phase-1 modules | http protocol + `CacheBackend` port/`types` + trivial backend + conformance fixture | ✓ |
| Build all domain modules now | Pre-build `shard`/`cleanup`/`trust`/`selectBackend` | |

**Choice:** Only Phase-1 modules.
**Notes:** YAGNI + phase boundaries; defer `selectBackend` (P2), `shard` (P3/4), `cleanup` (P4), `trust` (P2/5). IMPACT HIGH / CONFIDENCE HIGH.

---

## Read-only 403 seam

| Option | Description | Selected |
|--------|-------------|----------|
| Backend-port RW/RO capability | Injected at server construction; RO backend `put()` -> 403; no caller flag | ✓ |
| Caller-facing mode flag | Explicit RW/RO flag on the server | |

**Choice:** Port capability (no caller flag).
**Notes:** Preserves load-bearing no-flag property (TRUST-05). IMPACT MEDIUM / CONFIDENCE HIGH. **Low-deference / re-openable** - Phase 2 `selectBackend(env)` supersedes this seam.

---

## Conformance fixture (TEST-07)

| Option | Description | Selected |
|--------|-------------|----------|
| Pin installed nx `23.1.0`, floor 21+ | Hash full vendored spec; assert exactly `200`; never `info.version` | ✓ |
| Pin floor nx `21` | Pin the minimum-supported version instead of the installed one | |

**Choice:** Pin `23.1.0`, document floor 21+.
**Notes:** `23.1.0` is what the workspace runs; the exactly-`200` floor holds since Nx 21 (ROADMAP Risk, PITFALLS `202->200` drift). Vendored-spec byte **source** left as a research item. IMPACT HIGH / CONFIDENCE HIGH.

---

## Best-effort read (SRV-05)

| Option | Description | Selected |
|--------|-------------|----------|
| Fault -> 404 MISS | Best-effort; writes fail closed; `never`-typed `PutResult` exhaustiveness | ✓ |
| Fault -> 5xx | Surface backend faults as server errors | |

**Choice:** Fault -> 404 MISS, writes fail closed.
**Notes:** Every degradation is a MISS, never a wrong/truncated result; MISS-not-5xx test written first. IMPACT HIGH / CONFIDENCE HIGH.

---

## Claude's Discretion

- Exact `nx g @nx/js:lib` flags (bundler, `--unitTestRunner=vitest`, `--directory`, `--importPath`); let `@nx/js/typescript` + `@nx/vitest` infer targets.
- Body-cap enforcement mechanism (SRV-04): streaming byte-counter abort; exact reject status per contract.
- Bearer comparison primitive (SRV-02): `crypto.timingSafeEqual` + length guard; CSPRNG token via `crypto.randomBytes`.
- Test-file layout and whether the real-`serve` scripted round-trip (SC4) runs under `test` or the dormant `integration` target.

## Deferred Ideas

- Phase 2: `selectBackend` + Actions-cache RW + `withHashLock` + SIGTERM drain.
- Phase 3: Releases reader + OS-namespacing + private-repo auth.
- Phase 4: publish/sync + cleanup/retention + observability.
- Phase 5: trust-widening + PPE gate.
- Phase 6: npm/JS-action distribution + docs + governance.
- `shard`/`cleanup`/`trust` pure modules -> their respective phases.
