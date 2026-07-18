# Phase 1: Walking Skeleton - Research

**Researched:** 2026-07-18
**Domain:** Nx self-hosted-cache HTTP contract server (`node:http`), ports-and-adapters, TDD conformance fixture
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01 (server runtime):** The HTTP server uses Node's built-in **`node:http`** - zero runtime dependencies. Rejected Fastify/Hono/Express. Rationale: dependency-free JS action mandate (FOUND-03; actions run before `npm ci`), ESM `module: nodenext`, bodies fully buffered up to 2 GB, loopback-only bind, direct control over the body-size cap (413-socket-destroy) and the required `Content-Length`.
- **D-02 (project shape):** ONE Nx library at **`packages/github-cache`**, import path **`@op-nx/github-cache`** (the LOCKED published package name), created via **`nx g @nx/js:lib`** (exact flags resolved at plan/execute time via the `nx-generate` skill + `--help`/`--dry-run`). Ports-and-adapters realized as **internal modules within this one lib**, NOT multiple Nx projects. The lib carries its own `tsconfig.lib.json` + `tsconfig.spec.json` + `vitest.config.ts` so `@nx/js/typescript` infers `build`/`typecheck` and `@nx/vitest` infers `test`; add the new tsconfig as a `reference` in root `tsconfig.json`.
- **D-03 (module scope, YAGNI):** Build ONLY the modules Phase 1 needs: the **HTTP protocol layer**, the **`CacheBackend` port + `types`** module, a **trivial in-process (`Map`-backed) backend**, and the **TEST-07 conformance fixture**. Pure domain modules stay side-effect-free. DEFER `selectBackend` (Phase 2), `shard` (Phase 3/4), `cleanup` (Phase 4), `trust`/write-gate (Phase 2/5).
- **D-04 (read-only 403 seam) [LOW-DEFERENCE / re-openable in Phase 2]:** Model **RW-vs-RO as a `CacheBackend` port capability injected at server construction** (internal seam), NEVER a caller-facing mode flag. Phase 1 exercises the read-only-PUT -> **403** path before `selectBackend` exists; instantiate the trivial backend in a writable form and a read-only form whose `put()` yields a forbidden result -> 403. Preserves the load-bearing "no caller-facing mode flag" property (TRUST-05).
- **D-05 (conformance fixture):** Pin the **installed Nx version `23.1.0`** as the named version; **document the floor = Nx 21+**. **Hash the FULL vendored Nx spec** committed as a fixture; the fixture fails if the server returns anything other than `200` on PUT success OR if the vendored spec drifts. **Never watch `info.version`** (stayed `1.0.0` across the `202 -> 200` change). Also assert `401`/`403`/`404`/`409` and the required `Content-Length`. **RESOLVED by this research (see Standard Stack / Open Questions): the spec bytes must be transcribed from the Nx docs; NO spec file ships in `node_modules`.**
- **D-06 (best-effort read discipline, SRV-05):** A read fault degrades to a **404 MISS, never a 5xx**; writes **fail closed**. Encode structurally (a `never`-typed `PutResult` exhaustiveness guard); write the MISS-not-5xx test FIRST. Invariant: every degradation is a MISS, never a wrong or truncated result.

### Claude's Discretion
- Exact `nx g @nx/js:lib` flags (bundler `none` vs a builder, `--unitTestRunner=vitest`, `--directory`, `--importPath=@op-nx/github-cache`) - resolve at plan/execute time against `--help`/`--dry-run` + the `nx-generate` skill. Let `@nx/js/typescript` + `@nx/vitest` infer targets; do NOT hand-author `project.json`.
- Body-cap enforcement mechanism (SRV-04): a streaming byte-counter that aborts + rejects before unbounded buffering; exact reject status/format per the vendored contract - planner call.
- Bearer-token comparison primitive (SRV-02): `crypto.timingSafeEqual` with a length guard; the per-process token is a CSPRNG value (`crypto.randomBytes`).
- Test-file layout (co-located `*.spec.ts` vs `src/`-nested) and whether the "real `serve` answers a scripted GET/PUT" acceptance (SC4) runs under the `test` target or the dormant `integration` target. Recommend unit specs under `test`; the real-socket round-trip is a candidate for `integration`, but Phase 1 has no cross-OS requirement yet (that is Phase 3), so `test` is acceptable - leave to the planner.

### Deferred Ideas (OUT OF SCOPE)
- `selectBackend(env)` + Actions-cache RW backend + `withHashLock` + SIGTERM drain -> **Phase 2**.
- GitHub Releases read-only reader + OS-namespacing + authenticated private-repo local read -> **Phase 3**.
- `{push,schedule}`-gated publish/sync + age-based cleanup + observability + storage-cap degradation -> **Phase 4**.
- `pull_request`/`release` trust-widening + single-source allowlist + server-produced-key filter + PPE-hygiene gate -> **Phase 5**.
- npm package + JS Action + background-step CI pattern + enumerated public surface + adoption docs + SECURITY.md/LICENSE/semver -> **Phase 6**.
- `shard` / `cleanup` / `trust` pure domain modules -> their respective phases.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SRV-01 | HTTP server binds `127.0.0.1` only; never reachable on a routable interface | `server.listen(port, '127.0.0.1')` verified to bind IPv4 loopback (Node 24.13.0). See Code Examples "Server skeleton". |
| SRV-02 | Bearer-token auth uses a per-process CSPRNG token compared in constant time; unauth/mismatch -> 401 | `crypto.randomBytes` (token) + fixed-length SHA-256 digest + `crypto.timingSafeEqual` (constant-time, no length leak). Verified `timingSafeEqual` throws on unequal length. See Code Examples "Timing-safe auth". |
| SRV-03 | `{hash}` path segment validated (bounded-length hex); malformed rejected before any backend call | Nx `{hash}` is `type:string` in the spec (no pattern); Actions-cache key space is 1-512 hex (TRUST-08). Recommend `^[a-f0-9]{1,512}$`, reject with `400` before auth-independent backend work. See Common Pitfalls + Code Examples. |
| SRV-04 | Bodies capped at `MAX_CACHE_BODY_BYTES` (2 GB); oversized rejected, never buffered unbounded | Pre-check `Content-Length` header (required by spec) + streaming byte-counter that destroys the socket on overflow (413-socket-destroy). `MAX_CACHE_BODY_BYTES = 2 GiB = 2,147,483,648`. See Code Examples "Body-size cap". |
| SRV-05 | A read fault degrades to a MISS (never a build-breaking 5xx); writes fail closed | `CacheBackend.get` fault -> catch -> `404`; `put` fault -> surface as error, never silent `200`. `never`-typed `PutResult` exhaustiveness guard (D-06). See Code Examples "PutResult never-guard". |
| TEST-07 | Conformance fixture hashes the full vendored Nx spec, pins a named Nx version (not `info.version`), asserts hard `200` on PUT success + 401/403/404/409 + required `Content-Length` | Full authoritative OpenAPI 3.0.0 spec captured below (nx.dev). Two-layer fixture: (a) spec-drift = sha256 of the committed spec file vs a pinned digest; (b) server-conformance = behavioral run through all status codes. See Code Examples "Conformance fixture" + Validation Architecture. |
</phase_requirements>

## Summary

The Nx self-hosted-cache contract is small, stable, and fully knowable. It is **OpenAPI 3.0.0**, two operations (`GET`/`PUT /v1/cache/{hash}`), bearer auth, transferring tar archives as `application/octet-stream`. This research captured the **complete authoritative spec** from nx.dev and confirmed the exact status semantics against the installed `nx@23.1.0` native client. The single hardest constraint is verified: **PUT success is exactly `200`** (Nx 21+ hard floor); `409`/`403` are graceful client no-ops; any other status errors the Nx store, so a `202` breaks it. `info.version` is `1.0.0` and stays that way across drift, so it is useless as a drift signal.

The most important discovery for the planner (D-05's open item): **there is NO standalone OpenAPI spec file in `node_modules`.** The HTTP client (`v1/cache/`, `Authorization`/`Bearer`, `content-length`, `Conflict`/`Forbidden`/`Not Found`/`Unauthorized`/`read-only`) is compiled into the 14.7 MB Rust native addon (`@nx/nx-win32-arm64-msvc/nx.win32-arm64-msvc.node`); the spec exists only as JSON embedded in the Nx docs source. Therefore the "vendored spec" must be **transcribed from the docs and committed as a repo fixture** - the fixture hashes that committed file, not any installed artifact.

The build is genuinely **dependency-free**: `node:http` + `node:crypto` (stdlib), tested with Vitest (already a devDep) and Node's built-in global `fetch` (no supertest). Ports-and-adapters is realized as internal modules in one lib. The RW/RO distinction is a backend capability injected at construction (no caller-facing flag). Every SRV property and every status code is covered by a first-written test (TDD).

**Primary recommendation:** Build a single `node:http` request pipeline - `method/route -> auth (401) -> hash-validate (400) -> [PUT: body-cap 413] -> backend -> map PutResult/GetResult to status` - behind a `CacheBackend` port with a `Map`-backed trivial adapter in writable and read-only forms, and lock the contract with a two-layer conformance fixture (committed-spec-hash drift guard + behavioral status-code run). Verify the generator with `nx g @nx/js:lib --dry-run` before committing scaffolding.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| HTTP request parsing / routing / status mapping | API / Backend (protocol layer) | - | The `node:http` server owns the wire contract; it is the only tier that speaks HTTP. |
| Bearer-token auth (SRV-02) | API / Backend (protocol layer) | - | Auth is a request-pipeline gate; the token is a per-process secret held in the server process, never client-facing. |
| Hash validation (SRV-03) | API / Backend (protocol layer) | - | Input validation at the trust boundary, before any backend call. |
| Body-size cap (SRV-04) | API / Backend (protocol layer) | - | Enforced on the raw request stream; a transport concern the backend never sees. |
| Cache storage/retrieval (`get`/`put`) | Database / Storage (the `CacheBackend` port) | - | The port abstracts storage; Phase 1's adapter is an in-process `Map` (no real storage yet). |
| RW-vs-RO decision (403 seam, D-04) | Database / Storage (backend capability) | API / Backend (maps `forbidden` -> 403) | Injected at construction as a backend capability; the protocol layer only translates the result to a status. No caller flag. |
| Best-effort MISS discipline (SRV-05) | API / Backend (fault -> 404) | Database / Storage (writes fail closed) | Read faults are swallowed to MISS at the protocol edge; write faults must propagate (never silent success). |
| Conformance fixture (TEST-07) | Test tier | - | Verifies the protocol layer against the vendored contract; not shipped runtime code. |

## The Nx Custom Remote Cache Contract (authoritative, vendored)

`[CITED: nx.dev/docs/guides/tasks--caching/self-hosted-caching]` - fetched 2026-07-18. This exact JSON is the artifact TEST-07 vendors and hashes. Commit it verbatim as a fixture file (e.g. `packages/github-cache/src/conformance/nx-cache-openapi.v23.1.0.json`).

```json
{
  "openapi": "3.0.0",
  "info": {
    "title": "Nx custom remote cache specification.",
    "description": "Nx is an AI-first monorepo platform that connects everything from your editor to CI. Helping you deliver fast, without breaking things.",
    "version": "1.0.0"
  },
  "paths": {
    "/v1/cache/{hash}": {
      "put": {
        "description": "Upload a task output",
        "operationId": "put",
        "security": [{ "bearerToken": [] }],
        "responses": {
          "200": { "description": "Successfully uploaded the output" },
          "401": { "description": "Missing or invalid authentication token.", "content": { "text/plain": { "schema": { "type": "string", "description": "Error message provided to the Nx CLI user" } } } },
          "403": { "description": "Access forbidden. (e.g. read-only token used to write)", "content": { "text/plain": { "schema": { "type": "string", "description": "Error message provided to the Nx CLI user" } } } },
          "409": { "description": "Cannot override an existing record" }
        },
        "parameters": [
          { "in": "header", "description": "The file size in bytes", "required": true, "schema": { "type": "number" }, "name": "Content-Length" },
          { "name": "hash", "description": "The task hash corresponding to the uploaded task output", "in": "path", "required": true, "schema": { "type": "string" } }
        ],
        "requestBody": { "content": { "application/octet-stream": { "schema": { "type": "string", "format": "binary" } } } }
      },
      "get": {
        "description": "Download a task output",
        "operationId": "get",
        "security": [{ "bearerToken": [] }],
        "responses": {
          "200": { "description": "Successfully retrieved cache artifact", "content": { "application/octet-stream": { "schema": { "type": "string", "format": "binary", "description": "An octet stream with the content." } } } },
          "403": { "description": "Access forbidden", "content": { "text/plain": { "schema": { "type": "string", "description": "Error message provided to the Nx CLI user" } } } },
          "404": { "description": "The record was not found" }
        },
        "parameters": [ { "name": "hash", "in": "path", "required": true, "schema": { "type": "string" } } ]
      }
    }
  },
  "components": { "securitySchemes": { "bearerToken": { "type": "http", "description": "Auth mechanism", "scheme": "bearer" } } }
}
```

**Contract facts the planner must honor:**

| Fact | Source | Confidence |
|------|--------|-----------|
| PUT success = **exactly `200`** (not any 2xx); a `202` breaks the Nx 21+ client | `[VERIFIED: node_modules/@nx native binary + ARCHITECTURE-DECISION.md + spec]` | HIGH |
| PUT: `401` (missing/invalid token), `403` (forbidden, e.g. read-only token writing), `409` (cannot override existing record) | `[CITED: nx.dev spec]` | HIGH |
| GET: `200` (octet-stream body), `403` (forbidden), `404` (not found) | `[CITED: nx.dev spec]` | HIGH |
| `Content-Length` is a **required** request header on PUT ("The file size in bytes") | `[CITED: nx.dev spec]` | HIGH |
| Request/response body media type = `application/octet-stream` (binary tar) | `[CITED: nx.dev spec]` + `[VERIFIED: native binary string]` | HIGH |
| Auth scheme = HTTP `bearer` -> client sends `Authorization: Bearer <token>` | `[CITED: nx.dev spec]` + `[VERIFIED: native binary strings "Authorization"/"Bearer"]` | HIGH |
| `info.version` is `1.0.0` and does NOT change on contract drift - never use as a drift signal | `[VERIFIED: spec + native binary "1.0.0"]` | HIGH |
| The spec is a **stability guarantee**: "while the underlying data format may change in future Nx versions, the OpenAPI specification should remain stable" | `[CITED: nx.dev]` | HIGH |
| Client env vars a *consumer* sets: `NX_SELF_HOSTED_REMOTE_CACHE_SERVER`, `NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN`, `NODE_TLS_REJECT_UNAUTHORIZED` | `[CITED: nx.dev]` + `[VERIFIED: native binary strings]` | HIGH |

**Spec gap the planner must decide (SRV-02 vs spec):** The GET operation's documented responses are `200`/`403`/`404` - it does **not** list `401`. But the `bearerToken` security scheme applies to GET too, and SRV-02 mandates `401` on any unauthenticated request. Returning `401` on an unauthenticated GET is safe because the real Nx client is **always** authenticated (it never sends an unauth GET, so it never observes the `401`), and it satisfies the security requirement. Recommendation: return `401` on unauthenticated GET and PUT; the conformance fixture asserts the spec's documented codes, and the SRV-02 tests separately assert `401` on unauth GET+PUT.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `node:http` | Node 24.13.0 (stdlib) | HTTP server, request/response, streaming body | D-01 locked; zero deps; direct control over body-cap + `Content-Length`; dependency-free JS-action mandate |
| `node:crypto` | Node 24.13.0 (stdlib) | `randomBytes` (CSPRNG token), `timingSafeEqual` (constant-time compare), `createHash` (spec-hash + fixed-length token digest) | Constant-time compare and CSPRNG must never be hand-rolled |
| `node:buffer` / global `fetch` | Node 24.13.0 (stdlib) | Buffer body handling; `fetch` as the test HTTP client | `fetch` is built-in in Node 24 - no supertest/axios needed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `vitest` | `~4.1.0` (present) | Test runner; `@nx/vitest` infers the `test` target | All TDD specs |
| `@vitest/coverage-v8` | `~4.1.0` (present) | Coverage | If coverage is wired (not required Phase 1) |
| `@swc/core` + `@swc-node/register` | `1.15.8` / `1.11.1` (present) | Fast TS transpile for Vitest and (if chosen) the `build` bundler | Test transform; candidate build compiler |
| `typescript` | `~6.0.3` (present) | Type checking; `@nx/js/typescript` infers `build`/`typecheck` | Always |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `node:http` | Fastify / Hono / Express | **Rejected (D-01).** Adds deps + surface for zero benefit; breaks the dependency-free JS-action mandate; frameworks obscure the body-cap socket-destroy and `Content-Length` control this contract needs. |
| global `fetch` (tests) | supertest / undici / axios | Unnecessary dep; `fetch` is built-in in Node 24 and hits a real socket, which is exactly what SC4 wants. |
| `bundler: swc` | `bundler: tsc` / `esbuild` / `vite` / `none` | See Open Questions Q1 - genuine planner call; `swc` recommended (installed, emits real ESM, fast). |

**Installation:**
```bash
# NONE. Phase 1 introduces zero new runtime or dev dependencies.
# node:http, node:crypto, node:buffer, global fetch are Node 24 stdlib.
# vitest / @swc/core / typescript are already in devDependencies (Phase 0 shell).
```

**Version verification:** `nx@23.1.0` confirmed via `node_modules/nx/package.json` (`[VERIFIED: local package.json]`). Node `v24.13.0` confirmed via `process.version` (`[VERIFIED: runtime]`). All server/test primitives are stdlib or existing devDeps - no registry lookup needed.

## Package Legitimacy Audit

> **N/A - this phase installs no external packages.**

The walking skeleton is dependency-free by design (D-01, FOUND-03). The server uses only Node stdlib (`node:http`, `node:crypto`, `node:buffer`), tests use Vitest (already present) + built-in `fetch`, and the build uses an already-installed compiler (`@swc/core` or `typescript`). No npm install occurs, so there is no slopsquatting / hallucination surface to audit.

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*If the planner nonetheless proposes adding any dependency (it should not), gate each install behind a `checkpoint:human-verify` task and run the Package Legitimacy Gate first.*

## Architecture Patterns

### System Architecture Diagram

```
                Nx client (or test fetch / scripted serve)
                          |  HTTP  Authorization: Bearer <token>
                          |        GET|PUT /v1/cache/{hash}   (octet-stream body on PUT)
                          v
   +===================== node:http server (protocol layer) =====================+
   |                                                                             |
   |  [1] method + route match  --(not GET/PUT, not /v1/cache/{hash})--> 400/404 |
   |            |                                                                |
   |  [2] auth gate (SRV-02) ----(missing/mismatched bearer)------------> 401    |
   |            |  (constant-time compare of fixed-length SHA-256 digests)       |
   |  [3] hash validation (SRV-03) --(not ^[a-f0-9]{1,512}$)-----------> 400     |
   |            |                                                                |
   |    +-------+--------+                                                       |
   |    | GET            | PUT                                                   |
   |    v                v                                                       |
   |  backend.get     [4] body-size cap (SRV-04)                                 |
   |    |              Content-Length precheck + streaming counter               |
   |    |                --(> MAX_CACHE_BODY_BYTES)--> 413 (destroy socket)      |
   |    |                     |                                                  |
   |    |                  backend.put                                           |
   |    v                     v                                                  |
   |  GetResult            PutResult (discriminated union)                       |
   |   hit  -> 200 + bytes   'stored'    -> 200                                  |
   |   miss -> 404           'conflict'  -> 409                                  |
   |   fault-> 404 (SRV-05)  'forbidden' -> 403  (read-only backend, D-04)       |
   |            (read swallow)  <put fault surfaces as error, never silent 200>  |
   |                        [never-typed exhaustiveness guard, D-06]             |
   +==============================|==============================================+
                                  v
              CacheBackend port  { get(hash), put(hash, bytes) }
                                  |
                   +--------------+---------------+
                   | writable Map-backed adapter  |  read-only Map-backed adapter
                   | put -> stored | conflict     |  put -> forbidden (403 seam)
                   | get -> hit | miss            |  get -> hit | miss
                   +------------------------------+
```

The server binds `127.0.0.1` only (SRV-01). Data flow for the primary PUT-then-GET round-trip (SC2): client PUTs bytes -> auth -> hash-validate -> body-cap -> `backend.put` stores in the `Map` -> `200`; a second PUT of the same hash -> `backend.put` returns `conflict` -> `409`; client GETs -> `backend.get` hit -> `200` + bytes + auto `Content-Length`.

### Recommended Project Structure
```
packages/github-cache/
|-- src/
|   |-- index.ts                     # public barrel (createServer, CacheBackend types) - minimal for Phase 1
|   |-- server/
|   |   |-- server.ts                # createCacheServer(backend, token, opts) -> http.Server
|   |   |-- server.spec.ts           # SRV-01..05 + status-code specs (TDD, first)
|   |-- backend/
|   |   |-- types.ts                 # CacheBackend port, PutResult / GetResult unions
|   |   |-- memory-backend.ts        # trivial Map-backed adapter (writable + read-only factories)
|   |   |-- memory-backend.spec.ts
|   |-- conformance/
|   |   |-- nx-cache-openapi.v23.1.0.json   # committed vendored spec (the CITED JSON above)
|   |   |-- conformance.spec.ts      # TEST-07: spec-hash drift + behavioral status run
|   |-- serve.ts                     # SC4 entrypoint: real serve process (loopback, CSPRNG token)
|-- tsconfig.lib.json                # extends ../../tsconfig.base.json (build/typecheck inference)
|-- tsconfig.spec.json               # test-only TS config
|-- vitest.config.ts                 # so @nx/vitest infers the `test` target
|-- package.json                     # @op-nx/github-cache (inferred targets; no hand-authored project.json)
```
Add `packages/github-cache/tsconfig.lib.json` to root `tsconfig.json` `references[]`. `vitest.config.ts` is auto-discovered by the existing `vitest.workspace.ts` glob.

### Pattern 1: One linear request pipeline (guard-clause ladder)
**What:** A single `http.createServer` handler that runs ordered guard clauses, each returning early with the correct status. Order: route -> auth -> hash -> (PUT: body-cap) -> backend -> status map.
**When to use:** Always for this contract - it is small enough that a router library is over-engineering (D-01).
**Why the order:** Auth (`401`) comes before hash validation so unauthenticated callers never learn whether a hash is well-formed. Hash validation comes before any backend call (SRV-03). Body-cap runs only on PUT, before buffering (SRV-04).

### Pattern 2: Ports-and-adapters inside one lib (D-02, D-03)
**What:** A `CacheBackend` port (`get`/`put`) with a `Map`-backed adapter. The server depends on the port, never on the adapter. RW/RO is two factory functions returning the same port shape (D-04).
**Example:**
```typescript
// Source: derived from ADR Decision 1 (CacheBackend port = get/put) + D-04/D-06
export type PutResult = 'stored' | 'conflict' | 'forbidden';
export interface GetHit { readonly kind: 'hit'; readonly bytes: Buffer; }
export type GetResult = GetHit | { readonly kind: 'miss' };

export interface CacheBackend {
  get(hash: string): Promise<GetResult>;
  put(hash: string, bytes: Buffer): Promise<PutResult>;
}
```

### Pattern 3: `never`-typed exhaustiveness guard (D-06, SRV-05)
**What:** Map `PutResult` to a status in a `switch` whose `default` assigns to `never`, so adding a variant without a status is a compile error. Guarantees no unhandled result silently becomes a wrong status.
**When to use:** The PUT status mapping and any future `PutResult` extension.

### Pattern 4: Best-effort read asymmetry (SRV-05, Pitfall 8)
**What:** Wrap `backend.get` in try/catch and degrade ANY fault to `404` MISS. Do NOT apply the same swallowing to `put` - a `put` fault must surface as an error (fail closed), never a silent `200`.
**Why:** On the read path a false MISS is harmless (extra rebuild); on the write path treating a fault as success would serve/accept wrong state.

### Anti-Patterns to Avoid
- **Router/framework for two routes:** Fastify/Express here is pure surface-area cost (D-01). One handler + guard clauses is correct.
- **Watching `info.version` for drift:** It is permanently `1.0.0`. Hash the whole spec file instead (D-05).
- **`if (a.length !== b.length) return false` as the only length guard:** Still a (small) length side-channel and still needs the equal-length call. Compare fixed-length SHA-256 digests instead (see Don't Hand-Roll).
- **Buffering the whole PUT body before checking size:** Defeats SRV-04. Precheck `Content-Length`, then enforce during streaming and destroy the socket on overflow.
- **Returning `202` on PUT success:** Breaks the Nx 21+ client (hard `200`).
- **Swallowing a `put` fault to `200`:** Violates fail-closed writes (SRV-05).
- **Hand-authoring `project.json`:** Workspace relies on `@nx/js/typescript` + `@nx/vitest` inference (D-02).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP parsing / streaming / `Content-Length` | Custom socket parser | `node:http` | Correct framing, chunked handling, auto `Content-Length` from a Buffer body (verified) |
| Constant-time token compare | `===` or a hand-written loop | `crypto.timingSafeEqual` on fixed-length SHA-256 digests | `===` short-circuits (timing leak); `timingSafeEqual` throws on unequal length (verified) so hash both sides to 32 bytes first |
| Token generation | `Math.random` / timestamps | `crypto.randomBytes(32).toString('hex')` | CSPRNG; `Math.random` is not cryptographically secure |
| Spec-drift detection | Field-by-field diff / `info.version` watch | `crypto.createHash('sha256')` over the committed spec file | Single stable digest; catches ANY drift; `info.version` never changes |
| Test HTTP client | supertest / axios | built-in global `fetch` against `listen(0)` | Zero deps; real socket; matches SC4 |
| Cross-OS Nx hash parity | Custom normalization | existing `.gitattributes eol=lf` + `nx.json` `integration` discriminator | Load-bearing Phase 0 invariants - inherit, do not touch (Pitfall 7) |

**Key insight:** Everything the walking skeleton needs is either Node stdlib or an existing workspace primitive. The only "custom" code is the ~120-line request pipeline and the trivial `Map` adapter - both intentionally small and fully testable.

## Common Pitfalls

### Pitfall 1: PUT success = `202` (or "any 2xx")
**What goes wrong:** Returning `202` (or `201`/`204`) on a successful PUT. The Nx 21+ client matches `200` strictly; anything else errors the store.
**Why it happens:** Nx 20 returned `202`; the contract changed to `200` in Nx 21 while `info.version` stayed `1.0.0`, so stale knowledge or a copied old server ships `202`.
**How to avoid:** Return exactly `200` on stored success. TEST-07's behavioral layer asserts `=== 200` (not `< 300`).
**Warning signs:** Nx logs "unexpected response from remote cache" while your server logs a "successful" write.

### Pitfall 2: Using `info.version` as the drift signal
**What goes wrong:** A drift-detection test that watches `spec.info.version` never fires (it is always `1.0.0`).
**How to avoid:** Hash the full committed spec file; pin `PINNED_NX_VERSION = '23.1.0'` as a documented human-maintained constant (D-05).

### Pitfall 3: `timingSafeEqual` length side-channel / crash
**What goes wrong:** Passing raw tokens of differing length to `crypto.timingSafeEqual` throws `ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH` (verified) - both a crash and a length oracle.
**How to avoid:** Hash both the expected and presented tokens to fixed 32-byte SHA-256 digests, then `timingSafeEqual` - always equal length, no throw, no length leak. This IS the "length guard" (SRV-02).

### Pitfall 4: Fault-as-absence on the write path (Pitfall 8 in PITFALLS.md)
**What goes wrong:** Over-applying "best-effort read -> MISS" to `put`, treating a write fault as `200`.
**How to avoid:** Keep the asymmetry explicit (Pattern 4). Reads swallow to `404`; writes fail closed. Write the MISS-not-5xx test AND a write-fault-not-200 test first.

### Pitfall 5: GET spec omits `401` (spec vs SRV-02)
**What goes wrong:** A literal reading of the spec's GET responses (`200`/`403`/`404`) leaves unauthenticated GET returning `404`/`200`, violating SRV-02.
**How to avoid:** Return `401` on unauthenticated GET+PUT (safe - the real client is always authed). Assert it in the SRV-02 specs, separate from the conformance fixture's spec-documented codes.

### Pitfall 6: Windows entry-point guard (SC4 `serve`)
**What goes wrong:** `import.meta.url === 'file://' + process.argv[1]` is permanently false on Windows, so `serve.ts`'s `main()` never runs on direct invocation (PITFALLS "Cross-platform Node / ESM").
**How to avoid:** Use `import.meta.url === pathToFileURL(process.argv[1]).href` (from `node:url`).

### Pitfall 7: `ERR_SOCKET_BAD_PORT` from a bad port env
**What goes wrong:** `server.listen()` throws synchronously on NaN/negative/out-of-range ports, crashing the `serve` process.
**How to avoid:** Resolve the port through a validator that falls back to `0` (OS-assigned ephemeral) on invalid input (PITFALLS "numeric env-var resolver"). `0` is also the right default for tests.

### Pitfall 8: Empty-env-var defeats `??`
**What goes wrong:** A set-but-empty token env var (`""`) passes `??` and shadows a fallback.
**How to avoid:** Use `||` (not `??`) for token/credential env fallbacks (PITFALLS). Minor for Phase 1 (single token) but establishes the pattern for Phase 2.

## Code Examples

Verified against Node 24.13.0. These are illustrative skeletons, not final code - the planner/executor writes tests FIRST (TDD).

### Server skeleton + loopback bind (SRV-01)
```typescript
// Source: node:http (verified: listen(0,'127.0.0.1') -> IPv4 loopback + ephemeral port)
import * as http from 'node:http';
import type { CacheBackend } from '../backend/types.js';

const ROUTE = /^\/v1\/cache\/([^/]+)$/;

export function createCacheServer(backend: CacheBackend, token: string): http.Server {
  const authGate = makeAuthGate(token); // see Timing-safe auth
  return http.createServer(async (req, res) => {
    const match = req.url ? ROUTE.exec(req.url) : null;
    if (!match || (req.method !== 'GET' && req.method !== 'PUT')) {
      res.statusCode = 404;
      return res.end();
    }
    if (!authGate(req.headers.authorization)) {
      res.statusCode = 401; // SRV-02
      return res.end();
    }
    const hash = match[1];
    if (!/^[a-f0-9]{1,512}$/.test(hash)) {
      res.statusCode = 400; // SRV-03 - before any backend call
      return res.end();
    }
    // ... GET / PUT branches (below)
  });
}
// Bind loopback only (SRV-01): server.listen(port, '127.0.0.1', cb)
```

### Timing-safe auth (SRV-02)
```typescript
// Source: node:crypto (verified: timingSafeEqual throws ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH on unequal length)
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export function generateToken(): string {
  return randomBytes(32).toString('hex'); // per-process CSPRNG
}

export function makeAuthGate(expectedToken: string): (header?: string) => boolean {
  const expected = createHash('sha256').update(expectedToken).digest(); // fixed 32 bytes
  return (header) => {
    if (!header?.startsWith('Bearer ')) return false;
    const presented = createHash('sha256').update(header.slice(7)).digest(); // fixed 32 bytes -> never throws, no length leak
    return timingSafeEqual(expected, presented);
  };
}
```

### Body-size cap (SRV-04)
```typescript
// Source: 413-socket-destroy pattern (PITFALLS "buffered-bodies-to-2GB")
export const MAX_CACHE_BODY_BYTES = 2 * 1024 * 1024 * 1024; // 2 GiB = 2,147,483,648

// Fast reject via the (required) Content-Length header, then defend during streaming:
const declared = Number(req.headers['content-length']);
if (Number.isFinite(declared) && declared > MAX_CACHE_BODY_BYTES) {
  res.statusCode = 413; res.end(); req.destroy(); return;
}
const chunks: Buffer[] = []; let total = 0;
for await (const chunk of req) {
  total += chunk.length;
  if (total > MAX_CACHE_BODY_BYTES) { res.statusCode = 413; res.end(); req.destroy(); return; }
  chunks.push(chunk);
}
const bytes = Buffer.concat(chunks);
```

### PUT status map with never-guard (D-06) + best-effort GET (SRV-05)
```typescript
// PUT
const result = await backend.put(hash, bytes);      // may throw -> propagate (fail closed), do NOT catch->200
switch (result) {
  case 'stored':    res.statusCode = 200; break;    // hard 200
  case 'conflict':  res.statusCode = 409; break;
  case 'forbidden': res.statusCode = 403; break;    // read-only backend (D-04)
  default: { const _exhaustive: never = result; res.statusCode = 500; void _exhaustive; }
}
res.end();

// GET (best-effort read -> MISS, SRV-05)
try {
  const got = await backend.get(hash);
  if (got.kind === 'hit') { res.statusCode = 200; res.end(got.bytes); } // Buffer -> auto Content-Length (verified)
  else { res.statusCode = 404; res.end(); }
} catch { res.statusCode = 404; res.end(); } // fault degrades to MISS, never 5xx
```

### Conformance fixture (TEST-07)
```typescript
// Source: D-05 two-layer design
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const PINNED_NX_VERSION = '23.1.0';                 // documented; floor = Nx 21+
const VENDORED_SPEC_SHA256 = '<pinned digest>';     // regenerate ONLY when re-vendoring from new Nx docs

// Layer (a): spec-drift guard - hashes the committed file, NOT info.version
const specBytes = readFileSync(new URL('./nx-cache-openapi.v23.1.0.json', import.meta.url));
const digest = createHash('sha256').update(specBytes).digest('hex');
// expect(digest).toBe(VENDORED_SPEC_SHA256)

// Layer (b): behavioral guard - real server + Map backend, assert HARD 200 + 401/403/404/409 + Content-Length
// PUT new hash        -> expect(res.status).toBe(200)         // NOT < 300
// PUT same hash again  -> 409
// unauth PUT/GET       -> 401
// read-only backend PUT-> 403
// GET missing hash     -> 404
// GET hit              -> 200 && res.headers.get('content-length') is set
```

### Vitest real-socket test (no supertest)
```typescript
// Source: node:http + global fetch (verified round-trip on Node 24.13.0)
import { afterEach, expect, it } from 'vitest';
let server: import('node:http').Server;
afterEach(() => new Promise<void>((r) => server.close(() => r())));

it('stores then serves with Content-Length', async () => {
  const token = generateToken();
  server = createCacheServer(createWritableMemoryBackend(), token);
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address() as import('node:net').AddressInfo;
  const url = `http://127.0.0.1:${port}/v1/cache/abc123`;
  const auth = { authorization: `Bearer ${token}` };
  const put = await fetch(url, { method: 'PUT', headers: auth, body: Buffer.from('tar-bytes') });
  expect(put.status).toBe(200);                       // hard 200
  const get = await fetch(url, { headers: auth });
  expect(get.status).toBe(200);
  expect(get.headers.get('content-length')).toBe('9'); // SC2 required header
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Nx custom task-runner API + `@nx/*-cache` Powerpack plugins | OpenAPI self-hosted-cache HTTP contract (`GET`/`PUT /v1/cache/{hash}`) | Deprecated pre-21 | Out of scope by decree (ADR); build the HTTP server, not a task runner |
| PUT success = `202` | PUT success = **`200`** (client-enforced strict) | Nx 20 -> 21 (`info.version` unchanged) | The single hardest Phase 1 constraint; the whole TEST-07 spec-hash design exists for this |
| supertest / external HTTP test clients | built-in global `fetch` | Node 18+ (stable in 24) | Zero-dep real-socket tests |

**Deprecated/outdated:**
- **Nx custom tasks runner API** - deprecated; replaced by the OpenAPI self-hosted spec (and pre/post task hooks). Do not build against it.
- **`@nx/*-cache` plugins** - deprecated + CREEP-affected (out of scope).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `MAX_CACHE_BODY_BYTES = 2 GiB (2,147,483,648)` rather than 2 GB decimal (2,000,000,000) | SRV-04 / Code Examples | Boundary-case tests off by ~7%; ROBUST-02 (Phase 4) ultimately owns the exact ceiling. Planner should confirm the exact constant. |
| A2 | Malformed hash rejected with `400` (not `404`); hash pattern `^[a-f0-9]{1,512}$` | SRV-03 | If the planner prefers a tighter fixed length or a different reject status, tests change. `400` is safe (real client never sends malformed). The `1-512` bound is inferred from the Actions-cache key space (TRUST-08), not the Nx spec (spec says `type:string`, no pattern). |
| A3 | Oversized body rejected with `413` | SRV-04 | Status not in the Nx spec's documented set; the real client rarely triggers it. If it must map to a spec code, planner decides. |
| A4 | `401` returned on unauthenticated GET (spec omits it) | Spec gap / Pitfall 5 | Safe (real client always authed); but it is a deliberate superset of the spec - planner should ratify. |
| A5 | `bundler: swc` is the best generator choice for this TS-solution workspace | Open Questions Q1 | Wrong bundler -> build target misconfigured; mitigated by mandatory `--dry-run` before commit. |

**All contract facts (status codes, headers, media type, auth scheme, the vendored spec JSON, the hard-`200` floor) are `[VERIFIED]`/`[CITED]`, not assumed.**

## Open Questions

1. **`nx g @nx/js:lib` bundler choice (Claude's Discretion).**
   - What we know: schema `bundler` enum = `swc|tsc|rollup|vite|esbuild|none`, default `tsc`; `none` means "not buildable". `linter` enum `none|eslint` (workspace has NO ESLint - pass `--linter=none`). `unitTestRunner` enum `none|jest|vitest` (pass `vitest`). `directory` is REQUIRED. Base tsconfig is a TS-solution setup (`composite`, `emitDeclarationOnly`, `customConditions:['@op-nx/source']`), so a plain `tsc` build emits only `.d.ts` - JS emit needs a real compiler.
   - What's unclear: exact interaction of the generator's scaffolding with the base's `emitDeclarationOnly`.
   - Recommendation: `nx g @nx/js:lib github-cache --directory=packages/github-cache --importPath=@op-nx/github-cache --unitTestRunner=vitest --linter=none --bundler=swc --dry-run` first; inspect output; adjust; then run for real. `swc` is already installed, emits real ESM under `nodenext`, and is the common non-published-lib choice. Do NOT pass `--useProjectJson` (keep inferred config, D-02).

2. **`test` vs `integration` target for the SC4 real-`serve` round-trip (Claude's Discretion).**
   - What we know: `nx.json` defines a dormant `integration` target with the `{runtime:"node -p process.platform"}` cross-OS discriminator; CI already matrixes it ubuntu+windows.
   - Recommendation: Put SRV-01..05 + TEST-07 unit/behavioral specs under `test`. The SC4 "real serve answers a scripted GET/PUT" is a real-socket test but has no cross-OS requirement in Phase 1 (that is Phase 3), so `test` is acceptable and simpler. Defining an `integration` target now is optional scaffolding - reasonable but not required; planner call.

3. **Re-vendoring workflow for a future Nx bump.**
   - What we know: the spec is a committed fixture with a pinned sha256 + pinned version string; no `node_modules` file to diff against.
   - Recommendation: Document (in a comment by `VENDORED_SPEC_SHA256`) that bumping Nx requires manually re-fetching the spec from the new version's docs, re-hashing, and updating both constants - the human step where a real `202->200`-class drift is caught. Not Phase 1 work, but the fixture comment should say so.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | server + tests + build | Yes | v24.13.0 (`.node-version` `lts/krypton`) | - |
| `node:http` / `node:crypto` / global `fetch` | SRV-01..05, tests | Yes | stdlib (Node 24) | - |
| `nx` | generator, targets | Yes | 23.1.0 | - |
| `@nx/js` (`@nx/js/typescript`) | lib generator + build/typecheck inference | Yes | 23.1.0 | - |
| `@nx/vitest` | `test` target inference | Yes | 23.1.0 | - |
| `vitest` / `@vitest/coverage-v8` | tests | Yes | ~4.1.0 | - |
| `@swc/core` / `@swc-node/register` | test transform + (chosen) build | Yes | 1.15.8 / 1.11.1 | `bundler:tsc` if swc build rejected |
| `typescript` | typecheck / build | Yes | ~6.0.3 | - |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none - the workspace shell (Phase 0) already carries everything Phase 1 needs.

## Validation Architecture

> `nyquist_validation: true` and `tdd_mode: true` - every requirement maps to a first-written test.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest `~4.1.0` (via `@nx/vitest`) |
| Config file | `packages/github-cache/vitest.config.ts` (Wave 0 - does not exist yet; auto-discovered by `vitest.workspace.ts`) |
| Quick run command | `npx nx test github-cache` |
| Full suite command | `npx nx run-many -t test` (CI: `npm run test`) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SRV-01 | server bound to `127.0.0.1` is reachable on loopback; `server.address()` reports `127.0.0.1` (and is not bound to `0.0.0.0`) | unit (real socket) | `npx nx test github-cache` | Wave 0 |
| SRV-02 | no/blank `Authorization` -> 401; wrong bearer -> 401; correct bearer -> passes; compare is constant-time (fixed-length digest) | unit | `npx nx test github-cache` | Wave 0 |
| SRV-03 | malformed `{hash}` (non-hex / too long / empty) -> 400 with NO backend call (spy asserts backend not invoked) | unit | `npx nx test github-cache` | Wave 0 |
| SRV-04 | `Content-Length` > cap -> 413 (fast path); streamed body exceeding cap -> 413 + socket destroyed, never fully buffered | unit | `npx nx test github-cache` | Wave 0 |
| SRV-05 | backend `get` throws -> 404 MISS (not 5xx); backend `put` throws -> error surfaced, never a silent 200 | unit | `npx nx test github-cache` | Wave 0 |
| TEST-07 (a) | sha256 of committed vendored spec === pinned digest; `PINNED_NX_VERSION==='23.1.0'`; test does NOT read `info.version` | unit | `npx nx test github-cache` | Wave 0 |
| TEST-07 (b) | PUT new -> `=== 200`; PUT existing -> 409; unauth -> 401; read-only PUT -> 403; GET missing -> 404; GET hit -> 200 + `Content-Length` present | unit (real socket) | `npx nx test github-cache` | Wave 0 |
| SC2 round-trip | PUT-then-GET returns the stored bytes with correct `Content-Length` | unit (real socket) | `npx nx test github-cache` | Wave 0 |
| SC4 | a real `serve` process (loopback, CSPRNG token) answers a scripted GET/PUT | unit or integration (planner call, Q2) | `npx nx test github-cache` (or `npx nx integration github-cache`) | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx nx test github-cache`
- **Per wave merge:** `npx nx run-many -t test`
- **Phase gate:** full suite green + `npx nx run-many -t build typecheck test` green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/github-cache/vitest.config.ts` - so `@nx/vitest` infers `test` (created by the generator; verify present)
- [ ] `packages/github-cache/tsconfig.spec.json` - test-only TS config (generator-created)
- [ ] `packages/github-cache/src/server/server.spec.ts` - SRV-01..05 + status codes
- [ ] `packages/github-cache/src/backend/memory-backend.spec.ts` - Map adapter (writable + read-only)
- [ ] `packages/github-cache/src/conformance/conformance.spec.ts` - TEST-07 (both layers)
- [ ] `packages/github-cache/src/conformance/nx-cache-openapi.v23.1.0.json` - committed vendored spec
- [ ] Framework install: none (Vitest already present)

## Security Domain

> `security_enforcement: true`, ASVS L1, block on `high`. The walking skeleton IS a hardening phase (SRV-01..05 are security properties).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Per-process CSPRNG bearer token (`crypto.randomBytes`), constant-time compare via fixed-length SHA-256 digests + `crypto.timingSafeEqual` (SRV-02) |
| V3 Session Management | no | Stateless bearer-per-request; no sessions |
| V4 Access Control | yes | RW-vs-RO enforced as a backend capability injected at construction -> read-only PUT returns 403 (D-04, TRUST-05); no caller-facing mode flag |
| V5 Input Validation | yes | Bounded-hex `{hash}` validation before any backend call (SRV-03); body-size cap with streaming abort (SRV-04) |
| V6 Cryptography | yes | Only stdlib `node:crypto` primitives; never hand-roll compare or RNG |
| V7 Error Handling & Logging | yes | Best-effort read -> 404 (no 5xx leak); writes fail closed; error bodies are `text/plain` per spec, no internal detail leaked |
| V10 Malicious Code / SSRF | n/a | No outbound calls; loopback-only bind (SRV-01) removes remote attack surface |

### Known Threat Patterns for {node:http contract server}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Timing attack on token compare | Information Disclosure | Fixed-length SHA-256 digest + `crypto.timingSafeEqual` (never `===`) - SRV-02 |
| Token length oracle via `timingSafeEqual` throw | Information Disclosure | Hash both sides to 32 bytes so lengths always match (no throw) - Pitfall 3 |
| Unbounded body -> memory exhaustion (DoS) | Denial of Service | `Content-Length` precheck + streaming byte-counter + socket destroy at cap - SRV-04 |
| Path/hash injection into backend | Tampering | Reject non-`^[a-f0-9]{1,512}$` before any backend call - SRV-03 |
| Remote reachability of a local cache | Elevation of Privilege / Spoofing | Bind `127.0.0.1` only; never `0.0.0.0` - SRV-01 |
| Read-only context tricked into writing | Elevation of Privilege | RW/RO is a construction-time backend capability, not a request/caller flag -> 403 - D-04 / TRUST-05 |
| Read fault escalated to build-breaking error | Denial of Service | Best-effort read degrades to 404 MISS; writes fail closed - SRV-05 |
| Weak/predictable token | Spoofing | CSPRNG `crypto.randomBytes(32)` - SRV-02 |

No `high`+ residual threats for Phase 1 given these controls; all seven SRV/access threats have a first-written test (see Validation Architecture).

## Sources

### Primary (HIGH confidence)
- `node_modules/@nx/nx-win32-arm64-msvc/nx.win32-arm64-msvc.node` (14.7 MB Rust addon) - extracted strings confirm `v1/cache/`, `Authorization`, `Bearer`, `content-length`, `application/octet-stream`, `Conflict`/`Forbidden`/`Not Found`/`Unauthorized`/`read-only`, `NX_SELF_HOSTED_REMOTE_CACHE_SERVER`/`_ACCESS_TOKEN`, `openapi`/`1.0.0`. Proves the client is compiled (no spec file ships).
- `node_modules/nx/package.json` -> `23.1.0`; `node_modules/nx/dist/src/tasks-runner/*` -> remote-cache delegates to native (`require("../native")`); NO `v1/cache` string in any JS (confirms native-only client).
- `node_modules/@nx/js/dist/src/generators/library/schema.json` - authoritative `nx g @nx/js:lib` flags/enums/defaults.
- Live runtime (Node v24.13.0): `crypto.timingSafeEqual` throws `ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH` on unequal length; `res.end(Buffer)` auto-sets `Content-Length`; `listen(0,'127.0.0.1')` -> IPv4 loopback + ephemeral port.
- nx.dev self-hosted-caching docs (via markdown.new, 2026-07-18) - the FULL OpenAPI 3.0.0 spec (vendored above) + usage-note env vars + the "spec should remain stable" guarantee.

### Secondary (MEDIUM confidence)
- Project docs (locked inputs, first-party): ARCHITECTURE-DECISION.md (Nx contract + hard-200 client verification), PITFALLS.md "Empirically-Verified Platform Facts" (202->200 drift, best-effort-MISS, 413-socket-destroy, entry-point guard, `??`-vs-`||`, `ERR_SOCKET_BAD_PORT`), REQUIREMENTS.md (SRV-01..05, TEST-07), codebase/* (workspace shell state).

### Tertiary (LOW confidence)
- none - no claim in this document rests on unverified web search.

## Metadata

**Confidence breakdown:**
- Nx contract / status semantics: HIGH - authoritative spec (nx.dev) cross-checked against the installed native binary and prior client verification.
- Standard stack: HIGH - all stdlib or existing devDeps; versions read from disk.
- Node API behaviors (SRV-01/02/04): HIGH - executed against the exact runtime (v24.13.0).
- Generator flags: MEDIUM-HIGH - schema is authoritative; exact bundler interaction confirmed via `--dry-run` at plan time (Q1).
- Pitfalls: HIGH - carried from first-party empirically-verified platform facts.

**Research date:** 2026-07-18
**Valid until:** 2026-08-17 (30 days; the Nx contract is a documented stability guarantee, so drift risk is low - but re-verify on any `nx` major bump per Open Question 3).
