# Coding Conventions

**Analysis Date:** 2026-07-22

## Project shape

Single Nx-managed package, `@op-nx/github-cache` (`packages/github-cache/`), plus two
standalone consumer-facing artifacts at the repo root: `start-cache-server/` (the
`uses:`-consumable JS action) and `ppe/` (an advisory composite action). Source lives
under `packages/github-cache/src/`, organized by concern, not by layer-depth:

- `src/backend/` — the three `CacheBackend`/`ReadableBackend` adapters (Actions cache,
  Releases, in-memory) plus the `types.ts` port definitions.
- `src/lib/` — pure, dependency-light leaf modules (cache key, trust, retention,
  identity, hashing lock, status discrimination). Leaves import nothing from
  `backend/`, `publish/`, `server/`, or each other's siblings when it would create a
  cycle (see "Leaf modules" below).
- `src/server/` — the `node:http` protocol layer (`createCacheServer`).
- `src/publish/`, `src/cleanup/` — the two GitHub-Releases-mirror engines.
- `src/roundtrip/` — the live cross-OS read-back proof bin.
- `src/action/` — the internal CI dogfood JS-action entry (built by `nx build`, not
  esbuild; requires `npm run build` first — see "The two GitHub JS actions" below).
- `src/test/` — spec-only fixtures (`octokit-fault.ts`, `consumer-contract.ts`) with
  **no product imports**, so they stay pure test utilities even though they live
  inside the `src/` tree that ships as the npm package's lib build.
- `src/*.spec.ts` at the package root — cross-cutting drift guards (see
  "Single-source-of-truth + drift-guard pattern" below), not unit tests of one module.

## TypeScript conventions

**Strict ESM throughout.** `tsconfig.base.json` sets `module: "nodenext"`,
`moduleResolution: "nodenext"`, `strict: true`, `noUnusedLocals`, `noImplicitReturns`,
`noFallthroughCasesInSwitch`, `noImplicitOverride`, `isolatedModules`,
`esModuleInterop: false`. The package manifest declares `"type": "module"`.

- **Every relative import carries an explicit `.js` extension**, even though the
  source file is `.ts` — required by `nodenext` module resolution
  (`import { cacheKeyFor } from '../lib/cache-key.js'`). This is non-negotiable under
  the current `tsconfig.base.json`; do not drop the extension when adding a new
  relative import.
- **Type-only imports use `import type`** where the import is exclusively types
  (`import type { Hash } from '../lib/cache-key.js'`).
- **Branded types replace runtime validation duplication.** `Hash` is
  `string & { readonly __hash: unique symbol }` (`packages/github-cache/src/lib/cache-key.ts`),
  minted only by `parseHash`. An unvalidated string cannot be passed where a `Hash` is
  required — the compiler enforces validate-then-use instead of relying on tests alone.
- **Exhaustiveness guards on discriminated unions**: a `switch` over a closed union
  ends with a `default` branch assigning to `const _exhaustive: never = result;`
  (`packages/github-cache/src/server/server.ts:272-279`) so a future union member
  that isn't handled fails to compile, not silently falls through.

## Naming patterns

**Files:** kebab-case (`select-backend.ts`, `release-asset-name.ts`,
`with-hash-lock.ts`). Spec files are always co-located and named
`<module>.spec.ts`; integration specs add a second suffix segment,
`<module>.integration.spec.ts` (`server/public-server.integration.spec.ts`).

**Functions:** `camelCase`, verb-led and intention-revealing —
`selectBackend`, `isWriteTrusted`, `isServerProducedKey`, `resolveGitHubToken`,
`withHashLock`. Factory functions that construct a port implementation are always
prefixed `create*`: `createActionsCacheBackend`, `createReleasesReadBackend`,
`createWritableMemoryBackend`, `createReadOnlyMemoryBackend`, `createResilientOctokit`,
`createCacheServer`.

**Predicates:** `is*`/`has*` naming for boolean-returning functions —
`isWritableBackend`, `isWriteTrusted`, `isShardTag`, `isServerProducedAssetName`,
`isEntrypoint`. When a boolean alone would hide *why* it's false, the return type is a
discriminated union instead of a bare `boolean` (see "Fault discrimination" below).

**Constants:** `SCREAMING_SNAKE_CASE` for module-level fixed values —
`CACHE_KEY_PREFIX`, `HASH_PATTERN`, `MAX_CACHE_BODY_BYTES`, `TRUSTED_EVENTS`,
`HOST_GATED_EVENTS`.

**Types/interfaces:** `PascalCase`, named for the role they play, not the
implementation — `ReadableBackend`, `WritableBackend`, `CacheBackend` (the ergonomic
public alias for `WritableBackend`, `packages/github-cache/src/backend/types.ts:39`),
`CleanupClient`, `PublishClient`, `WriteTrust`.

## Ports/adapters pattern

The backend layer is a strict ports-and-adapters split:

- **Ports** (`packages/github-cache/src/backend/types.ts`): `ReadableBackend` (`get`
  only) and `WritableBackend extends ReadableBackend` (`get` + `put`). A read-only
  backend has **no `put` method at all** — an illegal write is unrepresentable at the
  type level, not a runtime `'forbidden'` result. `isWritableBackend` is the runtime
  discriminator the server uses to decide between a real `put` and a protocol-level
  403.
- **Adapters**: `createActionsCacheBackend` (`backend/actions-cache-backend.ts`,
  wraps `@actions/cache`), `createReleasesReadBackend` (`backend/releases-backend.ts`,
  wraps `@octokit/rest` over GitHub Releases, read-only), and the in-memory fixture
  pair in `backend/memory-backend.ts` (used only in tests and as the trusted-but-
  tokenless degrade path — never selected on any production `selectBackend` path
  except that degrade).
- **Composition root**: `selectBackend` (`packages/github-cache/src/lib/select-backend.ts`)
  is the **single place** RW-vs-RO is decided. It takes one injectable
  `env: NodeJS.ProcessEnv = process.env` parameter and returns
  `ReadableBackend | WritableBackend` — there is deliberately no caller-facing mode
  flag anywhere in the codebase (documented as "TRUST-05" throughout comments). When
  adding a new backend or a new selection condition, extend `selectBackend`, never add
  a parallel mode argument to a factory.

## Injected clients (no network in unit tests)

Every engine that talks to an external service is refactored behind a narrow,
hand-written interface injected at the call boundary — never a mocked HTTP client and
never `instanceof` on a vendor error class:

```ts
// packages/github-cache/src/cleanup/cleanup.ts
export interface CleanupClient {
  listAllReleases(): Promise<CleanupRelease[]>;
  listAllAssets(releaseId: number): Promise<CleanupAsset[]>;
  deleteAsset(assetId: number): Promise<void>;
}

export async function cleanupMirror(
  client: CleanupClient,
  maxAgeDays: number,
): Promise<CleanupResult> { ... }
```

`publish-mirror.ts` follows the identical shape with `PublishClient`. Both modules
**import no `@octokit/rest`** — the real adapter (constructed elsewhere, wrapping
`octokit.paginate`) is the only place that touches the network; the engine itself is
pure logic behind the seam, so its spec injects a fake with zero network calls.

## Fault discrimination via `error.status`

GitHub/Octokit faults are **never** discriminated with `instanceof RequestError`
(two `@octokit/request-error` versions can coexist in the dependency tree) and
**never** by parsing stderr or body text. The single, structural mechanism is
`statusOf` (`packages/github-cache/src/lib/octokit-status.ts`):

```ts
export function statusOf(error: unknown): number | undefined {
  if (error !== null && typeof error === 'object' &&
      typeof (error as { status?: unknown }).status === 'number') {
    return (error as { status: number }).status;
  }
  return undefined;
}
```

It is a `lib/` leaf (imports nothing from `cleanup/` or `publish/`) so both engines
share the one fault-discrimination contract instead of authoring it twice. Callers
branch on the numeric status only — e.g. `cleanup.ts` treats **404 as the only benign
"already gone"** outcome and every other status (401/403/429/5xx) as a real per-item
failure. The shared test fixture `octokitFault(status, body?)`
(`packages/github-cache/src/test/octokit-fault.ts`) builds an `Error` with `.status`
and `.response.data` so specs can exercise every branch without a real Octokit
instance.

## Error handling posture: best-effort read, fail-closed write

This split is load-bearing and repeated verbatim across the server and every backend:

- **Reads degrade to a MISS.** Any fault on a `get` path (backend throw, malformed
  data, network error) is swallowed and reported as `{ kind: 'miss' }` / HTTP 404 —
  never a 5xx. See `server.ts`'s `handleGet` (`try { ... } catch { res.statusCode =
  404; }`) and the Releases reader's read-only design.
- **Writes fail closed.** Any fault on a `put` path surfaces as a real error (HTTP
  500, or a thrown rejection that propagates to the caller) — **never** a silent 200.
  See `server.ts`'s `handlePut` (a `put` throw maps to 500, distinct from the earlier
  streaming-drain catch so a backend fault is never mistranslated into a 400) and
  `actions-cache-backend.ts`'s ambiguous-`-1` disambiguation (a `saveCache` result of
  `-1` is probed with a `lookupOnly` restore before deciding `'stored'` vs
  `'conflict'` — never assumed benign).
- **Ambiguous outcomes are surfaced, not hidden.** Where a result genuinely cannot be
  disambiguated (e.g. the `-1` cache-write sentinel), the code emits exactly one
  `core.warning` naming the cache key/asset and still returns a benign result
  (`'conflict'` → HTTP 409, which the Nx client treats as a graceful no-op) rather than
  throwing a build-breaking 500 for what may just be a scope restriction.
- **Discriminated "why not" over bare booleans.** `isWriteTrusted` returns
  `{ trusted: true } | { trusted: false; reason: WriteUntrustedReason }`
  (`packages/github-cache/src/lib/trust.ts`) instead of a plain boolean, so a silent
  read-only degrade is observable at the call site instead of an opaque `false`.

## The single-source-of-truth + drift-guard pattern

The dominant architectural convention in this codebase: **author a fact exactly
once**, then add a spec that fails the build the moment a second copy would drift
from it or the fact itself changes unintentionally. Recognize this pattern by its
comment markers ("single source", "one authored source", "drift guard") and reuse it
for any new cross-cutting contract:

- **`trust.ts`** — `TRUSTED_EVENTS` / `HOST_GATED_EVENTS` are declared once; the sync
  gate (`sync-gate.ts`) never imports from `trust.ts` (widening WRITE trust must never
  widen SYNC trust) and stays a separate, independently authored allowlist.
- **`cache-key.ts`** — `CACHE_KEY_PREFIX` and `HASH_PATTERN` are the one definition
  the server's hash guard and the publish-mirror's server-produced-key filter both
  validate against; `isServerProducedKey` is the one predicate, never re-implemented.
- **`test/consumer-contract.ts`** (`EXPECTED_ENV_KNOBS`) — the one list of consumer
  env knobs, shared by `public-surface.spec.ts` (pins it against an inline sorted
  literal so an intentional change is a reviewable diff) and `docs-adoption.spec.ts`
  (asserts every knob is documented in `docs/configuration.md` and
  `docs/versioning.md`).
- **`public-surface.spec.ts`** — enumerates the *exact* consumer contract (value
  exports, type exports, action inputs, env knobs, the fixed body cap) as explicit
  assertion lists, deliberately **not** `toMatchSnapshot()` — an intentional surface
  change must show up as a reviewable diff to the `EXPECTED_*` list in this file, not
  an easy-to-rubber-stamp `.snap` regen.
- **`conformance.spec.ts`** — pins the vendored Nx OpenAPI fixture's full-file sha256
  (never the embedded `info.version`, which stayed `1.0.0` across a real 202→200
  contract change) plus behavioral assertions (`exactly 200` on PUT, never
  "any 2xx"). Re-vendoring on an Nx bump is a deliberate, documented manual step.
- **`pinned-deps.spec.ts`** — every runtime/build-tool dependency that participates in
  a supply-chain-sensitive contract (`@actions/cache`, `@octokit/*`, `esbuild`) must
  be an **exact** semver (`/^\d+\.\d+\.\d+$/`), never a range — because a silent
  minor/patch bump can change cache-key hashing or bundle bytes with no error.
- **`action-bundle-drift`** (`npm run check:action`) — `start-cache-server/index.js`
  is a **committed, generated** esbuild bundle (`esbuild.action.mjs` → deterministic
  output); CI rebuilds it and `git diff --exit-code`s the committed file. Never hand-
  edit `start-cache-server/index.js`; edit `start-cache-server/entry.ts` and rerun
  `npm run build:action`.
- **`governance-email.spec.ts`** — an **allowlist-inversion** guard: it never encodes
  the forbidden email/domain as a search needle (that would itself be the leak); it
  asserts the only email-shaped token present in a fixed set of maintainer-authored
  files is the one approved public address, and fails on anything else.
- **`cleanup-workflow.spec.ts`** / **`ppe-action.spec.ts`** — config-assertion specs
  that read a `.yml` file straight off disk (via `import.meta.url`, never `__dirname`
  or `process.cwd()`), strip `#`-prefixed comment lines first (so the spec's own
  rationale prose can't make an assertion vacuously pass), then regex-assert the
  load-bearing structure (permissions, concurrency, exact tool-version pins). This is
  the pattern to reach for whenever a security- or contract-relevant fact lives in
  YAML with no injectable-client seam.

**When adding a new cross-cutting fact** (a new env knob, a new consumer export, a
new pinned tool version): find its existing single-source declaration first, extend
it there, and let the existing drift guard catch any file you forgot to update — do
not hand-sync a second copy anywhere.

## Leaf modules (breaking import cycles)

Several `lib/` modules are explicitly extracted to stay **true leaves** — importing
nothing from `backend/`, `publish/`, `server/`, or any sibling that would close a
cycle:

- `github-identity.ts` was extracted from `select-backend.ts` specifically to break
  `releases-backend → local-context → select-backend → releases-backend`. If you find
  yourself wanting to import from `select-backend.ts` inside a module that
  `select-backend.ts` itself depends on (even transitively), extract the needed
  symbol into a leaf instead of adding the import.
- `cache-key.ts` and `octokit-status.ts` are documented leaves for the same reason:
  both the cleanup and publish engines need the same primitive, and putting it in
  either engine would force the other to import a sibling engine.
- `select-backend.ts` re-exports `GITHUB_REPOSITORY_PATTERN` and `resolveGitHubToken`
  from `github-identity.ts` so existing `from './select-backend.js'` imports keep
  working — a deliberate compatibility re-export, not duplication.

## Dependency injection convention

Any function that reads ambient runtime state takes that state as an **injectable
parameter with a real-world default**, never reaching for `process.env` internally
without an override seam:

```ts
export function selectBackend(
  env: NodeJS.ProcessEnv = process.env,
): ReadableBackend | WritableBackend { ... }

export function isWriteTrusted(
  env: NodeJS.ProcessEnv = process.env,
): WriteTrust { ... }

export function resolveGitHubToken(
  env: NodeJS.ProcessEnv = process.env,
): string | undefined { ... }
```

This is what lets every trust/selection/identity unit test run with a plain object
literal instead of mutating `process.env` globally.

## The two GitHub JS actions: dependency-free CommonJS constraint

Any JS action consumed via `uses:` runs **before `npm ci`** on the consumer's runner,
so it cannot rely on `node_modules` — it must be a single, dependency-inlined
CommonJS file. In the current tree:

- **`start-cache-server/index.js`** is the shipped consumer artifact meeting this
  constraint: `esbuild.action.mjs` bundles `start-cache-server/entry.ts` into one
  committed CJS file (`format: 'cjs'`, all of `@actions/core` + `@actions/cache` +
  its transitive Azure SDK graph inlined). It is drift-guarded by
  `npm run check:action` (see the drift-guard pattern above). Never hand-edit the
  committed `index.js`.
- **`packages/github-cache/action.yml`** (`main: dist/action/index.js`) is the
  **internal CI dogfood action only** — its own header states any job using it "MUST
  build the package first." It is an ordinary `nx build` ESM output, not
  dependency-inlined, and is never presented as the consumer surface. Do not confuse
  the two: only `start-cache-server/` is meant for external `uses:` consumption.

## Comment style and rationale density

Comments favor **dense, decision-carrying prose over restating code**. A typical
module-level or function-level comment states: what invariant holds, why the
alternative was rejected, and which requirement ID it satisfies (inline tokens like
`ROBUST-03`, `TRUST-05`, `D-04`, `SRV-02` trace back to phase requirements/decisions
in `.planning/`). When editing a function with this style of header comment, update
the rationale, not just the code — a stale rationale comment is treated as a defect.

`// ponytail:` comments mark a deliberate, scoped simplification with its ceiling and
upgrade path named inline, e.g. `with-hash-lock.ts:1-3` ("global in-process map...
ceiling = single-process/ephemeral single-tenant runner... upgrade path is a shared
coordinator only if multi-process writers ever appear"). Treat these as intentional,
not TODOs — only revisit when the named ceiling is actually hit.

## Formatting and linting

**Prettier**: `.prettierrc` sets only `{ "singleQuote": true }` (all other options at
Prettier default). Run via `nx format:write` / `nx format:check`, not the prettier CLI
directly. `.prettierignore` excludes generated/vendored artifacts that must stay
byte-exact (`start-cache-server/index.js`, the vendored conformance fixture JSON) and
churny agent/planning directories.

**ESLint is NOT configured in this repository** — there is no `eslint.config.*`,
`.eslintrc*`, or `eslint` dependency anywhere in the tree (verified by search). Static
analysis / dead-code detection is instead handled by **fallow** (`npm run fallow`,
`npm run fallow:ci`), configured in `.fallowrc.jsonc`. When fallow flags a symbol as
unreachable that is actually a workflow-invoked entrypoint (a `main:` target, a
package-script bin, a tsconfig-`files`-only reference), declare it in the `entry`
array rather than suppressing the finding — see the existing entries for the pattern
(each carries a comment explaining why reachability analysis can't infer it).

**Style rules enforced by convention (not by a lint config), observed consistently
across the source tree:**
- Blank line before and after `if`/`else`/`switch`/`for`/`while`/`try`/`catch`/
  `finally`/`return`, except when the statement opens or closes a block.
- Every control-flow body uses braces — no bare one-line `if`/`for` bodies.

## Module design

**Barrel discipline (`src/index.ts`).** The package barrel exports only the consumer
contract: `createCacheServer` (value) plus `CacheBackend`, `GetHit`, `GetResult`,
`PutResult`, `ReadableBackend`, `WritableBackend` (types). Internal helpers (roughly
25+ other exported symbols across `lib/`) are deliberately **not** re-exported from
the barrel — `public-surface.spec.ts` enforces this by exact-equality on
`Object.keys(barrel)`. When adding a new internal module, do not add it to
`src/index.ts` unless it is genuinely part of the consumer contract; internal
modules are imported by deep relative path from wherever they're needed (including
from tests).

**One factory, no mode flags.** Every `create*` factory that constructs a backend or
client takes only the parameters needed to construct it — never a boolean or enum
that would let the *caller* pick read-vs-write mode. Mode is always a consequence of
*which* factory is called, decided by the single composition root (`selectBackend`).

---

*Convention analysis: 2026-07-22*
