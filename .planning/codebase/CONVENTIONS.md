# Coding Conventions

**Analysis Date:** 2026-07-17

## Naming Patterns

**Files:**
- kebab-case for all source files: `actions-cache-backend.ts`, `release-mirror-backend.ts`, `publish-mirror-cleanup.ts`
- Unit specs co-located with source: `<name>.spec.ts` (e.g. `packages/op-nx-github-cache/src/lib/shard.spec.ts`)
- Integration specs co-located with a distinct suffix: `<name>.integration.spec.ts` (e.g. `packages/op-nx-github-cache/src/lib/server.integration.spec.ts`)
- CLI entry points live in `src/bin/` with a `#!/usr/bin/env node` shebang: `packages/op-nx-github-cache/src/bin/serve.ts`
- Composite-action scripts at repo root are CommonJS: `start-cache-server/index.cjs`, `publish-mirror/index.cjs`, plus `selfcheck.cjs` siblings
- Vitest configs use `.mts`: `vitest.config.mts`, `vitest.integration.config.mts`

**Functions:**
- camelCase: `isWriteTrusted`, `shardTagsForWindow`, `cacheArchivePath`
- Factory functions prefixed `create*` returning an interface, never classes: `createServer` (`src/lib/server.ts`), `createActionsCacheBackend`, `createReleaseMirrorBackend`
- Env-knob resolvers prefixed `resolve*`: `resolveMaxBodyBytes` (`src/lib/server.ts`), `resolveMaxAgeDays` (`src/lib/shard.ts`), `resolvePort` (`src/bin/serve.ts`) — all take `envValue: string | undefined`, return a validated value, and fall back to a documented default
- Predicates prefixed `is*`: `isAuthorized`, `isNotFound`, `isWriteTrusted`
- Pure helpers extracted from I/O-heavy code specifically so they are unit-testable: `filterNxCacheKeys`, `filterMirrorShardTags`, `actionsCachesListArgs`, `planShardCleanup` (see `src/bin/publish-mirror.ts`, `src/lib/cleanup.ts`)

**Variables:**
- camelCase for locals; SCREAMING_SNAKE_CASE for module-level constants: `HASH_PATTERN`, `TRUSTED_EVENTS`, `DEFAULT_MAX_BODY_BYTES`, `MAX_CACHE_MIRROR_MAX_AGE_DAYS`, `GH_ALREADY_EXISTS_PATTERN`
- Regex constants are named `*_PATTERN` or `*_MARKER`: `CACHE_PATH_PATTERN`, `BRANCH_NAME_PATTERN`, `MIRROR_SHARD_PATTERN`, `GH_NOT_FOUND_MARKER`

**Types:**
- PascalCase interfaces, no `I` prefix: `CacheBackend`, `ServerOptions`, `ReleaseMirrorBackendOptions`, `CleanupOptions`, `ShardCleanupPlan` (see `src/lib/types.ts`, `src/lib/cleanup.ts`)
- String-literal unions over enums: `type PutResult = 'stored' | 'conflict' | 'forbidden'` (`src/lib/types.ts`)
- Options-object parameter for factories: `createServer({ backend, token }: ServerOptions)`

## Code Style

**Formatting:**
- Prettier 3, config `.prettierrc` — single setting: `{ "singleQuote": true }` (everything else is Prettier defaults: 2-space indent, trailing commas, semicolons, 80-col wrap)
- `.prettierignore` excludes `/dist`, `/coverage`, `.nx` caches
- Enforced in CI via `npx nx format:check --all` (`.github/workflows/ci.yml` format-check job); run locally with `npm run format` / `npm run format:check`

**Linting:**
- No ESLint / Biome. TypeScript strictness IS the linter: `tsconfig.base.json` sets `strict`, `noUnusedLocals`, `noImplicitReturns`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `noEmitOnError`
- `nx typecheck` (via `@nx/js/typescript` plugin in `nx.json`) is the enforcement gate

**Language/module conventions:**
- ESM throughout the package (`"type": "module"` in `packages/op-nx-github-cache/package.json`), `module`/`moduleResolution: nodenext`
- Relative imports MUST carry the `.js` extension even from `.ts` files: `import { isWriteTrusted } from './trust.js';`
- Node built-ins always use the `node:` prefix: `import { tmpdir } from 'node:os';`
- Root-level GitHub composite-action helpers are plain CJS (`'use strict'` + `require`) using Node built-ins only — no npm install needed at action time (`start-cache-server/index.cjs`)

**Control flow layout (consistently applied everywhere):**
- Blank line before and after `if`/`for`/`try`/`return` blocks, except at block edges
- Always braces, never braceless one-liners
- Early return over nested else

## Import Organization

**Order (observed across all files):**
1. `node:` built-ins
2. External packages (`vitest`, `@actions/cache`, `@octokit/rest`)
3. Relative imports (with `.js` extension)

**Type imports:** `import type { ... }` or inline `type` specifiers: `import { HASH_PATTERN, type CacheBackend } from './types.js';`

**Path Aliases:**
- None. Workspace-internal resolution uses the `@op-nx/source` custom condition (`tsconfig.base.json` `customConditions`, `exports` map in the package's `package.json`) — pointing at `./src/index.ts` in-repo and `./dist/index.js` when published

**Barrel files:**
- One public barrel per package: `packages/op-nx-github-cache/src/index.ts` re-exports the public API with explicit named exports, `export type` for types
- `src/lib/backends/index.ts` is not a dumb barrel — it holds `selectBackend()` logic

## Error Handling

**Patterns (prescriptive — follow these):**
- **Reads fail open, writes fail loud.** A backend GET fault degrades to a 404 cache miss with `console.error` server-side (`src/lib/server.ts` GET path); write faults surface as 4xx/5xx and are always logged
- **Structural error discrimination over message matching** where possible: `isNotFound()` checks `error.status === 404` (`src/lib/backends/release-mirror-backend.ts`). When only text is available (gh CLI stderr), hoist the fragile sentinels to named constants in one place: `GH_ALREADY_EXISTS_PATTERN`, `GH_NOT_FOUND_MARKER` (`src/bin/publish-mirror.ts`)
- **Custom error classes only where a catch needs to branch:** `class PayloadTooLargeError extends Error {}` (`src/lib/server.ts`)
- **Exhaustiveness guards on unions:** assign the unhandled value to `const unhandled: never = result;` so a new `PutResult` variant is a compile error, not a silent wrong status (`src/lib/server.ts` PUT mapping)
- **Batch operations isolate per-item failures:** collect into a `failures: string[]` array, `console.error` each, throw one summary error at the end — one bad item never aborts the rest (`main()` and `cleanupMirror()` in `src/bin/publish-mirror.ts`)
- **Env knobs never crash on bad input:** set-but-invalid values fall back to the default with a `console.warn`; unset values are the silent normal path (`resolveMaxBodyBytes`, `resolveMaxAgeDays`, `resolvePort`)
- **Fail-safe direction is explicit:** e.g. an unparseable asset date is KEPT, never deleted (`selectAssetsToDelete` in `src/lib/cleanup.ts`)
- **CLI mains:** `main().catch(error => { console.error(error); process.exitCode = 1; })` — never `process.exit()` (all three `src/bin/*.ts`)
- `catch (error)` treats the value as `unknown` and narrows with type guards or targeted casts (`error as ExecFailure`)

## Logging

**Framework:** `console` only — `console.log` / `console.warn` / `console.error`. No logging library.

**Patterns:**
- `console.error` for faults with context prefix: `` console.error(`cache GET ${hash} failed:`, error) ``
- `console.warn` only for operator misconfiguration that was silently corrected
- GitHub Actions workflow commands where appropriate: `::add-mask::` for secrets before any echo (`src/bin/serve.ts`), `::error::` annotations in the CJS actions (`start-cache-server/index.cjs`)
- Never print secrets to stdout in CI; hand them to later steps via `$GITHUB_ENV`

## Comments

**When to Comment (this codebase's defining trait — dense "why" comments):**
- Every non-obvious decision carries a rationale comment explaining WHY, the failure mode it prevents, and often the verification source: upstream issue numbers (`actions/cache#1622`, `nrwl/nx#34971`), CVE references (`CVE-2025-36852` in `src/lib/trust.ts`), internal verification tags (`verified pv-1`, `pv-5`)
- Trade-offs are stated inline: the shard-cache comment in `release-mirror-backend.ts` names the staleness trade-off it accepts
- Deliberate simplifications marked with `ponytail:` naming the ceiling and upgrade path: `// ponytail: in-process lock only; ... drop if this backend is ever run single-flight behind a queue` (`src/lib/backends/actions-cache-backend.ts`)
- Cross-file coupling is documented at BOTH ends (e.g. `cacheArchivePath` byte-identical-paths contract, shard retention window shared between `shard.ts`, `cleanup.ts`, `release-mirror-backend.ts`)
- Duplicated logic that must stay in sync says so: `// Mirrors packages/.../trust.ts (TRUSTED_EVENTS) -- keep in sync.` (`start-cache-server/index.cjs`)

**JSDoc/TSDoc:**
- Not used. Plain `//` block comments above declarations carry the documentation. Follow that; do not introduce `/** */` JSDoc

## Function Design

**Size:** Small and single-purpose; I/O orchestration functions (`main`, `cleanupShard`) compose the extracted pure helpers

**Parameters:**
- 1-3 positional params for pure functions; an options interface once optional/injectable knobs appear
- Testability injection via optional options fields, defaulting to the real thing: `now?: () => Date`, `octokit?: Octokit` (`ReleaseMirrorBackendOptions`)

**Return Values:**
- `null` for "not found" (`CacheBackend.get`), string-literal unions for multi-state outcomes (`PutResult`), never boolean flags where three states exist
- Async functions declare explicit `Promise<T>` return types

## Module Design

**Exports:**
- Named exports only, no default exports anywhere
- Export a symbol from a module ONLY when it is public API or needed by a spec; helpers used solely by `main()` stay unexported
- Constants that specs assert against are exported (`DEFAULT_MAX_BODY_BYTES`, `BRANCH_NAME_PATTERN`, `MIRROR_SHARD_PATTERN`)

**CLI entry-point guard (required for every `src/bin/*.ts`):**
```typescript
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
```
This makes bins importable by specs without executing (`src/bin/serve.ts`, `src/bin/publish-mirror.ts`, `src/bin/publish-mirror-cleanup.ts`).

**Security-relevant conventions (do not relax):**
- Validate at trust boundaries with anchored allowlist regexes before interpolating into paths/commands: `HASH_PATTERN` (`src/lib/types.ts`), `BRANCH_NAME_PATTERN`, `MIRROR_SHARD_PATTERN`
- Constant-time token comparison via `timingSafeEqual` (`src/lib/server.ts`)
- Write trust derived from runtime context (`isWriteTrusted(process.env)`), never a caller-settable flag (`src/lib/backends/index.ts` `selectBackend`)

---

*Convention analysis: 2026-07-17*
