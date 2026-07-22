# Phase 1: Walking Skeleton - Pattern Map

**Mapped:** 2026-07-18
**Files analyzed:** 14 (11 create + 1 modify + 2 generator-produced-verify)
**In-repo analogs found:** 5 / 14 (all config files)
**Greenfield (RESEARCH.md skeleton is the reference):** 9 / 14 (all source + test modules)

> **Greenfield reality:** This is a torn-down Nx workspace SHELL. `packages/` holds
> only `.gitkeep`; the sole tracked `.ts` file is the root `vitest.workspace.ts`
> (a config, not a source module). There are ZERO source analogs in this repo.
> So:
> - **Config files** copy from the workspace-shell configs (`tsconfig.base.json`,
>   root `tsconfig.json`, `nx.json`, `.prettierrc`, `vitest.workspace.ts`, root
>   `package.json`) and are mostly GENERATOR-PRODUCED (`nx g @nx/js:lib`) -- verify
>   via `--dry-run`, do NOT hand-author.
> - **Source + test modules** have NO in-repo analog. Their authoritative reference
>   is the VERIFIED CODE SKELETONS in `01-RESEARCH.md` (cited by line range below).
>   Do not invent an analog -- copy the RESEARCH.md skeleton.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/github-cache/tsconfig.lib.json` | config (build) | -- (n/a) | `tsconfig.base.json` + `nx.json` build target | exact (generator-produced) |
| `packages/github-cache/tsconfig.spec.json` | config (test) | -- (n/a) | `tsconfig.base.json` + `nx.json` test inputs | exact (generator-produced) |
| `packages/github-cache/vitest.config.mts` | config (test-runner) | -- (n/a) | `vitest.workspace.ts` + `@nx/vitest` plugin block | role-match (generator-produced) |
| `packages/github-cache/package.json` | config (project manifest) | -- (n/a) | root `package.json` (`@op-nx/source`) | role-match (generator-produced) |
| `tsconfig.json` (root, **MODIFY**) | config (references) | -- (n/a) | itself (`references: []` -> add lib) | exact (self, integration point) |
| `src/backend/types.ts` | model (port + unions) | CRUD | none -- RESEARCH.md Pattern 2 | greenfield (skeleton) |
| `src/backend/memory-backend.ts` | service (adapter) | CRUD | none -- RESEARCH.md Pattern 2 + diagram | greenfield (trivial Map) |
| `src/server/server.ts` | controller (protocol layer) | request-response (streaming body) | none -- RESEARCH.md Code Examples | greenfield (skeleton) |
| `src/serve.ts` | entrypoint (composition root) | request-response | none -- RESEARCH.md Pitfalls 6-8 | greenfield (skeleton) |
| `src/index.ts` | barrel (public surface) | -- (n/a) | none -- RESEARCH.md structure L225 | greenfield (trivial) |
| `src/conformance/nx-cache-openapi.v23.1.0.json` | fixture (vendored spec) | file-I/O | none -- RESEARCH.md L73-114 (verbatim) | greenfield (direct copy) |
| `src/server/server.spec.ts` | test | request-response (real socket) | none -- RESEARCH.md L446-465 | greenfield (TDD-first) |
| `src/backend/memory-backend.spec.ts` | test | CRUD | none -- RESEARCH.md Test Map | greenfield (TDD-first) |
| `src/conformance/conformance.spec.ts` | test | file-I/O + request-response | none -- RESEARCH.md L423-444 | greenfield (TDD-first) |

**Note on auth:** SRV-02's timing-safe auth (`generateToken` / `makeAuthGate`) is NOT
listed as a separate file. The RESEARCH.md recommended structure (L221-241) folds it
into `server.ts`. Extracting it to a co-located `src/server/auth.ts` is a planner call
(YAGNI leans inline). It is documented as a Shared Pattern below regardless of placement.

## Pattern Assignments

### `packages/github-cache/tsconfig.lib.json` (config, generator-produced)

**Analog:** `tsconfig.base.json` (whole file, 25 lines) + `nx.json` build target (L19-24, `configName: "tsconfig.lib.json"`).

**What to copy:** MUST `extends: "../../tsconfig.base.json"` so it inherits the strict
solution-style options. The base is `composite: true` + `emitDeclarationOnly: true`
(`tsconfig.base.json` L3-5), so `tsode` (`tsc`) emits ONLY `.d.ts` -- real JS emit comes
from the chosen build compiler (swc, per RESEARCH Q1), NOT `tsc`. `@nx/js/typescript`
infers `build` from THIS file's presence (`nx.json` L19-24).

**Base options it inherits** (`tsconfig.base.json` L2-24):
```json
{
  "composite": true,
  "declarationMap": true,
  "emitDeclarationOnly": true,
  "module": "nodenext",
  "moduleResolution": "nodenext",
  "target": "es2022",
  "strict": true,
  "isolatedModules": true,
  "esModuleInterop": false,
  "customConditions": ["@op-nx/source"],
  "noFallthroughCasesInSwitch": true,
  "noImplicitOverride": true,
  "noImplicitReturns": true,
  "noUnusedLocals": true
}
```

**Do NOT:** hand-author it beyond generator output; re-declare base options; add `noEmit`.
Let `nx g @nx/js:lib ... --dry-run` produce it, then confirm the `extends` path resolves.

---

### `packages/github-cache/tsconfig.spec.json` (config, generator-produced)

**Analog:** `tsconfig.base.json` + `nx.json` test target inputs (L47, L65 reference the
`{projectRoot}/tsconfig.spec.json` fileset; also the `production` namedInput at
`nx.json` L5-9 EXCLUDES `tsconfig.spec.json` so specs never leak into `build`/`typecheck`).

**What to copy:** Test-only TS config; scopes vitest globals / spec files out of the
production fileset. Generator-produced by `--unitTestRunner=vitest`. The `test` and
`integration` targets both key on this file existing (`nx.json` L47, L66).

**Do NOT:** omit it -- `@nx/vitest` + the `test` target inputs expect it per-project.

---

### `packages/github-cache/vitest.config.mts` (config, generator-produced)

**Analog:** `vitest.workspace.ts` (root, 4 lines -- the discovery glob) + `@nx/vitest`
plugin block (`nx.json` L27-33).

**What to copy:** The generator emits this as `vitest.config.mts` (NOT `.ts`). The mere
PRESENCE of this file makes `@nx/vitest` infer the `test` target and makes the root
`vitest.workspace.ts` glob pick the project up (its glob matches `.mts`). No manual wiring.

**Root glob that auto-discovers it (`vitest.workspace.ts`, whole file):**
```ts
export default [
  '**/vite.config.{mjs,js,ts,mts}',
  '**/vitest.config.{mjs,js,ts,mts}',
];
```

**Do NOT edit `vitest.workspace.ts`** -- the new `vitest.config.mts` is matched
automatically by the existing glob. Touching the root file is unnecessary.

---

### `packages/github-cache/package.json` (config, generator-produced)

**Analog:** root `package.json` (`@op-nx/source`, L1-36) -- specifically the scope
convention `@op-nx/*` (L2) and `workspaces: ["packages/*"]` (L30-32).

**What to copy:** `name` MUST be `@op-nx/github-cache` (the LOCKED published package
name, D-02). No hand-authored `project.json` -- targets are INFERRED by
`@nx/js/typescript` + `@nx/vitest` (`nx.json` L12-34). Phase 1 adds ZERO dependencies
(RESEARCH Standard Stack: `node:http`/`node:crypto` stdlib; vitest/swc/ts already in
root devDeps at root `package.json` L15-29).

**Do NOT:** add runtime deps; add a `project.json`; pass `--useProjectJson` to the generator.

---

### `tsconfig.json` (root) -- **generator-modified** (integration point)

**Analog:** itself. Current state (whole file):
```json
{
  "extends": "./tsconfig.base.json",
  "compileOnSave": false,
  "files": [],
  "references": [],
  "compilerOptions": { "ignoreDeprecations": "6.0" }
}
```

**What changes:** `nx g @nx/js:lib` (via `@nx/js`'s `addProjectToTsSolutionWorkspace`)
AUTO-ADDS the new lib to `references[]` (currently `[]`, L5) as
`{ "path": "./packages/github-cache" }` -- the project aggregator directory (its own
`tsconfig.json` references `tsconfig.lib.json`/`tsconfig.spec.json`), NOT
`./packages/github-cache/tsconfig.lib.json`. This is generator-produced, not a hand-edit;
Plan 01 Task 2 VERIFIES it is present and runs `nx sync:check`. Do NOT hand-add a second,
differently-shaped entry -- `./packages/github-cache/tsconfig.lib.json` does not dedup
against `./packages/github-cache`. STRUCTURE.md L122-124 and CONTEXT.md L163 name this as
the required integration reference.

---

### `src/backend/types.ts` (model -- CacheBackend port + result unions)

**Reference (no in-repo analog -- greenfield):** RESEARCH.md **Pattern 2** (L249-262).
This is a load-bearing contract; copy it verbatim:

```typescript
export type PutResult = 'stored' | 'conflict' | 'forbidden';
export interface GetHit { readonly kind: 'hit'; readonly bytes: Buffer; }
export type GetResult = GetHit | { readonly kind: 'miss' };

export interface CacheBackend {
  get(hash: string): Promise<GetResult>;
  put(hash: string, bytes: Buffer): Promise<PutResult>;
}
```

**Why load-bearing:** `PutResult` is the discriminated union the server's `never`-typed
exhaustiveness guard (D-06) switches over -- adding a variant without a status becomes a
compile error. `'forbidden'` is the read-only-PUT -> 403 seam (D-04). Keep `readonly`.
Covers: D-03 (port module), D-04 (forbidden seam), D-06 (union for never-guard).

---

### `src/backend/memory-backend.ts` (service -- trivial Map adapter)

**Reference (greenfield, trivial):** RESEARCH.md Pattern 2 (L249-262) for the port shape
+ Architecture diagram (L210-217) for the two adapter forms. There is NO code skeleton for
the Map body because it is trivial -- a `Map<string, Buffer>` behind the port.

**What to build:** Two factory functions returning the SAME `CacheBackend` shape (D-04):
- **writable** form: `put` -> `Map.has(hash) ? 'conflict' : (Map.set(...), 'stored')`;
  `get` -> `Map.has(hash) ? {kind:'hit',bytes} : {kind:'miss'}`.
- **read-only** form: `put` -> always `'forbidden'` (the 403 seam); `get` -> same as writable.

Diagram contract (RESEARCH.md L210-217):
```
writable Map-backed adapter   |  read-only Map-backed adapter
put -> stored | conflict      |  put -> forbidden (403 seam)
get -> hit | miss             |  get -> hit | miss
```

**Do NOT:** add a caller-facing mode flag (TRUST-05); the RW/RO choice is which factory
you call at construction, injected into the server. Import the port with an explicit `.js`
extension (`from '../backend/types.js'`, nodenext -- see Shared Patterns).

---

### `src/server/server.ts` (controller -- node:http protocol layer)

**Reference (greenfield):** RESEARCH.md Code Examples, four consecutive skeletons:
- **Server skeleton + loopback bind (SRV-01):** L334-363 -- `createCacheServer`, the
  `ROUTE = /^\/v1\/cache\/([^/]+)$/` regex, `listen(port, '127.0.0.1')`.
- **Timing-safe auth (SRV-02):** L365-382 -- `generateToken` / `makeAuthGate` (see Shared Patterns).
- **Body-size cap (SRV-04):** L384-401 -- `MAX_CACHE_BODY_BYTES` + 413-socket-destroy.
- **PUT status map + best-effort GET (SRV-05/D-06):** L403-421 -- `never`-guard + read swallow.

**Core structure -- guard-clause ladder (RESEARCH.md Pattern 1, L244-247 + diagram L185-208).**
Fixed ORDER, each clause returns early:
```
[1] route/method match  --(not GET/PUT or not /v1/cache/{hash})--> 404
[2] auth gate (SRV-02)  --(missing/mismatched bearer)-----------> 401
[3] hash validate       --(not ^[a-f0-9]{1,512}$)---------------> 400   (before ANY backend call)
[4] PUT only: body cap  --(> MAX_CACHE_BODY_BYTES)--------------> 413   (destroy socket)
[5] backend.get/put -> map GetResult/PutResult -> status
```
Order is load-bearing: auth (401) BEFORE hash-validate (400) so unauth callers never
learn if a hash is well-formed; hash-validate BEFORE any backend call (SRV-03).

**Load-bearing status mapping (RESEARCH.md L406-420) -- exact bytes matter:**
```typescript
// PUT -- backend.put may throw -> let it propagate (fail closed), do NOT catch->200
switch (result) {
  case 'stored':    res.statusCode = 200; break;   // HARD 200, not any 2xx (Pitfall 1)
  case 'conflict':  res.statusCode = 409; break;
  case 'forbidden': res.statusCode = 403; break;    // read-only backend (D-04)
  default: { const _exhaustive: never = result; res.statusCode = 500; void _exhaustive; }
}
// GET -- best-effort read degrades to MISS, never 5xx (SRV-05)
try {
  const got = await backend.get(hash);
  if (got.kind === 'hit') { res.statusCode = 200; res.end(got.bytes); } // Buffer -> auto Content-Length
  else { res.statusCode = 404; res.end(); }
} catch { res.statusCode = 404; res.end(); }
```

Covers SRV-01..05 + D-04/D-06. Return `401` on unauthenticated GET too (spec omits it but
SRV-02 mandates it -- RESEARCH.md L130, Pitfall 5; safe because the real Nx client is
always authed).

---

### `src/serve.ts` (entrypoint -- SC4 real serve process)

**Reference (greenfield):** RESEARCH.md structure L236 + Pitfalls 6-8 (L318-328). This is
the composition root: resolve port -> `generateToken()` -> pick writable backend ->
`createCacheServer(backend, token)` -> `listen(port, '127.0.0.1')`.

**Three verified cross-platform gotchas to bake in (all load-bearing on Windows CI):**
- **Pitfall 6 (L318-320):** entry-point guard MUST be
  `import.meta.url === pathToFileURL(process.argv[1]).href` (from `node:url`) --
  `'file://' + process.argv[1]` is permanently false on Windows.
- **Pitfall 7 (L322-324):** resolve the port through a validator that falls back to `0`
  (OS-assigned) on NaN/negative/out-of-range -- `listen()` throws `ERR_SOCKET_BAD_PORT`
  synchronously otherwise.
- **Pitfall 8 (L326-328):** use `||` (not `??`) for token env fallback -- a set-but-empty
  `""` token passes `??`.

---

### `src/index.ts` (barrel -- public surface)

**Reference (greenfield, trivial):** RESEARCH.md structure L225 -- "public barrel
(createServer, CacheBackend types) - minimal for Phase 1". A thin re-export of
`createCacheServer` + the port types. No skeleton needed; keep it minimal (YAGNI --
Phase 6 owns the enumerated public surface, per CONTEXT deferred). Explicit `.js`
extensions on re-exports (nodenext).

---

### `src/conformance/nx-cache-openapi.v23.1.0.json` (fixture -- vendored spec)

**Reference (greenfield, DIRECT COPY):** RESEARCH.md L73-114 -- the CITED OpenAPI 3.0.0
JSON. Commit it VERBATIM (byte-for-byte); the conformance test hashes exactly these bytes.

**Why it must be committed, not read from node_modules:** RESEARCH.md L50, L596 -- there is
NO standalone spec file in `node_modules`; the Nx client is compiled into a 14.7 MB Rust
addon. The spec exists only as JSON in the Nx docs, so it is transcribed and vendored here.

---

### `src/server/server.spec.ts` (test -- SRV-01..05 + status codes, TDD-first)

**Reference (greenfield):** RESEARCH.md "Vitest real-socket test" (L446-465) +
Phase-Requirements->Test-Map (L536-546). Real socket via `listen(0,'127.0.0.1')` + global
`fetch` -- NO supertest (RESEARCH.md L289, L446).

**Real-socket harness (RESEARCH.md L449-465) -- copy the shape:**
```typescript
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
  expect(put.status).toBe(200);                        // HARD 200, not < 300
  const get = await fetch(url, { headers: auth });
  expect(get.headers.get('content-length')).toBe('9'); // SC2 required header
});
```

**Per-requirement test rows to author FIRST (RESEARCH.md L538-546):** SRV-01 (bound to
`127.0.0.1`, not `0.0.0.0`), SRV-02 (no/blank/wrong bearer -> 401, correct passes),
SRV-03 (malformed hash -> 400 with backend spy NOT called), SRV-04 (Content-Length > cap
-> 413 fast path; streamed overflow -> 413 + socket destroyed), SRV-05 (get throws -> 404;
put throws -> error surfaced, never silent 200), SC2 round-trip, SC4 real-serve.

---

### `src/backend/memory-backend.spec.ts` (test -- Map adapter, TDD-first)

**Reference (greenfield):** RESEARCH.md Test Map (L544 conceptually) + Pattern 2. No code
skeleton -- unit-tests the port impl directly (no HTTP). Assert: writable `put` new ->
`'stored'`, same hash again -> `'conflict'`, `get` hit/miss; read-only `put` ->
`'forbidden'` (the 403 seam feeder). Pure, no socket.

---

### `src/conformance/conformance.spec.ts` (test -- TEST-07 two-layer, TDD-first)

**Reference (greenfield):** RESEARCH.md "Conformance fixture (TEST-07)" (L423-444).

**Layer (a) spec-drift guard (RESEARCH.md L426-435) -- exact approach matters:**
```typescript
const PINNED_NX_VERSION = '23.1.0';              // documented human-maintained; floor = Nx 21+
const VENDORED_SPEC_SHA256 = '<pinned digest>';  // regenerate ONLY when re-vendoring
const specBytes = readFileSync(new URL('./nx-cache-openapi.v23.1.0.json', import.meta.url));
const digest = createHash('sha256').update(specBytes).digest('hex');
// expect(digest).toBe(VENDORED_SPEC_SHA256)
```
Hash the FULL committed file; NEVER assert `spec.info.version` (permanently `1.0.0` across
drift -- Pitfall 2, D-05).

**Layer (b) behavioral guard (RESEARCH.md L437-444):** real server + Map backend, assert
`=== 200` on PUT-new (NOT `< 300`), 409 on PUT-same, 401 on unauth, 403 on read-only PUT,
404 on GET-missing, 200 + `Content-Length` present on GET-hit.

## Shared Patterns

### TypeScript strict + nodenext + explicit `.js` relative imports
**Source:** `tsconfig.base.json` (L2-24) + CONVENTIONS.md (L38-46).
**Apply to:** ALL `.ts` source AND spec files.
Relative imports MUST carry explicit `.js` extensions (`from '../backend/types.js'`) --
`module: nodenext` (base L9). `esModuleInterop: false` (base L22) -> use named or
`import * as http from 'node:http'` for CJS-only (RESEARCH.md L337 does exactly this).
`isolatedModules: true` (base L7) -> no const enums, every file independently transpilable.

### Timing-safe bearer auth (SRV-02)
**Source:** RESEARCH.md "Timing-safe auth" (L365-382).
**Apply to:** `server.ts` (or extracted `auth.ts`) + its specs.
```typescript
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
export function generateToken(): string { return randomBytes(32).toString('hex'); }
export function makeAuthGate(expectedToken: string): (header?: string) => boolean {
  const expected = createHash('sha256').update(expectedToken).digest(); // fixed 32 bytes
  return (header) => {
    if (!header?.startsWith('Bearer ')) return false;
    const presented = createHash('sha256').update(header.slice(7)).digest();
    return timingSafeEqual(expected, presented); // equal length -> never throws, no length leak
  };
}
```
Hash BOTH sides to 32-byte SHA-256 digests first -- `timingSafeEqual` throws
`ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH` on unequal length (Pitfall 3). Never `===`.

### `never`-typed exhaustiveness guard (D-06)
**Source:** RESEARCH.md Pattern 3 (L264-266) + code L407-412.
**Apply to:** the PUT `PutResult`->status switch in `server.ts`.
`default: { const _exhaustive: never = result; ... }` -- adding a `PutResult` variant
without a status becomes a compile error.

### Best-effort read asymmetry (SRV-05)
**Source:** RESEARCH.md Pattern 4 (L268-270) + code L415-420.
**Apply to:** `server.ts` GET vs PUT branches.
Wrap `backend.get` in try/catch -> ANY fault degrades to 404 MISS. Do NOT wrap
`backend.put` the same way -- a put fault must surface (fail closed), never silent 200.

### Body-size cap: 413-socket-destroy (SRV-04)
**Source:** RESEARCH.md "Body-size cap" (L384-401).
**Apply to:** the PUT branch in `server.ts`.
`MAX_CACHE_BODY_BYTES = 2 * 1024 * 1024 * 1024`. Precheck `Content-Length` header (fast
reject), THEN count bytes during streaming and `req.destroy()` on overflow -- never buffer
the whole body first. (A1: confirm 2 GiB vs 2 GB; A3: 413 is planner-ratified, not in spec.)

### Real-socket test via global `fetch` + `listen(0)`
**Source:** RESEARCH.md L446-465.
**Apply to:** `server.spec.ts`, `conformance.spec.ts` (behavioral layer).
Built-in `fetch` against `listen(0,'127.0.0.1')` -- zero deps, real socket (matches SC4).
`afterEach` closes the server. Assert `.toBe(200)`, never `< 300`.

### Inferred targets + Prettier single-quote (no hand-authored config)
**Source:** `nx.json` plugins (L12-34) + `.prettierrc` (`{ "singleQuote": true }`) +
CONVENTIONS.md (L29, L74-79).
**Apply to:** all config files + formatting of all sources.
`@nx/js/typescript` infers `build`/`typecheck`; `@nx/vitest` infers `test`. Never
hand-author `project.json`. Format via `npx nx format:write`, not the Prettier CLI.

### Cross-OS Nx hash parity (inherit, do NOT touch)
**Source:** `.gitattributes` (`* text=auto eol=lf`) + `nx.json` `integration` input
`{ "runtime": "node -p process.platform" }` (L73).
**Apply to:** nothing new -- these are load-bearing Phase 0 invariants. If the planner
defines an `integration` target (Q2, optional this phase), it MUST keep the platform
discriminator. Do not remove or re-derive (RESEARCH.md Pitfall 7 / "Don't Hand-Roll" L290).

## No Analog Found

Every source and test MODULE is greenfield -- there is no in-repo `.ts` file to copy a
pattern from. The planner MUST use the `01-RESEARCH.md` skeleton section cited for each
(NOT invent an analog, and NOT reach for a framework). Listed here so the greenfield
signal is explicit:

| File | Role | Data Flow | RESEARCH.md reference | Reason |
|------|------|-----------|-----------------------|--------|
| `src/backend/types.ts` | model | CRUD | Pattern 2 (L249-262) | No source files exist; port is defined verbatim in RESEARCH |
| `src/backend/memory-backend.ts` | service | CRUD | Pattern 2 + diagram (L210-217) | Trivial Map adapter; no skeleton needed, structure is clear |
| `src/server/server.ts` | controller | request-response | Code Examples (L334-421) | node:http pipeline; four verified skeletons in RESEARCH |
| `src/serve.ts` | entrypoint | request-response | structure L236 + Pitfalls 6-8 (L318-328) | Composition root; cross-platform gotchas are the substance |
| `src/index.ts` | barrel | -- | structure L225 | Trivial minimal re-export |
| `src/conformance/nx-cache-openapi.v23.1.0.json` | fixture | file-I/O | L73-114 (verbatim) | Direct copy of the CITED spec; no node_modules source |
| `src/server/server.spec.ts` | test | request-response | L446-465 + Test Map L538-546 | TDD-first; real-socket harness in RESEARCH |
| `src/backend/memory-backend.spec.ts` | test | CRUD | Test Map L544 + Pattern 2 | TDD-first; pure port unit test |
| `src/conformance/conformance.spec.ts` | test | file-I/O + req-resp | L423-444 | TDD-first; two-layer fixture in RESEARCH |

## Metadata

**Analog search scope:** repo root configs (`tsconfig.base.json`, `tsconfig.json`,
`nx.json`, `vitest.workspace.ts`, `package.json`, `.prettierrc`, `.gitattributes`,
`.github/workflows/ci.yml`), `packages/` (empty but for `.gitkeep`), all tracked `.ts`
(only `vitest.workspace.ts`), and the `@nx/js:lib` generator dir in `node_modules`
(no static config templates -- generator composes programmatically, confirming the
`--dry-run` mandate).
**Files scanned:** 8 shell config/CI files + 3 codebase planning docs (STRUCTURE,
CONVENTIONS, TESTING) + CONTEXT + RESEARCH.
**Confirmed greenfield:** `packages/` = `.gitkeep` only; zero source `.ts` in-repo.
**Pattern extraction date:** 2026-07-18
