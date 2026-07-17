# Testing Patterns

**Analysis Date:** 2026-07-17

## Test Framework

**Runner:**
- Vitest ~4.1.0 (via `@nx/vitest` 23.1.0 plugin, `nx.json`)
- Unit config: `packages/op-nx-github-cache/vitest.config.mts` (project name `@op-nx/github-cache`)
- Integration config: `packages/op-nx-github-cache/vitest.integration.config.mts` (project name `@op-nx/github-cache:integration`) — intentionally named so the `@nx/vitest` plugin's config glob does NOT pick it up; it is driven by the explicit `integration` target in the package's `package.json` `nx.targets`
- Workspace file: `vitest.workspace.ts` (root) globs `**/vitest.config.*`
- Settings shared by both configs: `globals: true`, `environment: 'node'`, `watch: false`, `reporters: ['default']`

**Assertion Library:**
- Vitest built-in `expect`

**Run Commands:**
```bash
npm run test                                 # all unit tests (nx run-many -t test)
npx nx test @op-nx/github-cache              # unit tests for the package
npm run integration                          # integration tier (nx run-many -t integration)
npx nx integration @op-nx/github-cache       # integration tests for the package
npm run test:act                             # act-driven GitHub Actions round-trip (trusted push event)
npm run test:act:untrusted                   # act round-trip asserting the 403 trust-gate (pull_request_target)
```
(`test:act*` scripts live in `packages/op-nx-github-cache/package.json`; run from that directory.)

## Test File Organization

**Location:** Co-located with source. No separate `tests/` directory.

**Naming — the tier IS the filename suffix:**
- `*.spec.ts` — unit tier. Pure logic / mocked I/O. OS-portable by construction so the Nx cache hash is byte-identical across OSes (CI runs them on one OS only; see comment in `.github/workflows/ci.yml` `test` job)
- `*.integration.spec.ts` — integration tier. Real sockets / real filesystem. Excluded from the unit config, included only by `vitest.integration.config.mts`. The `integration` target's Nx inputs carry an OS discriminator (`{ "runtime": "node -p process.platform" }` in `nx.json`) so Linux and Windows runs never share a cache entry
- `__fixtures__/act-round-trip.mjs` + `__fixtures__/act-workflow.yml` — act tier: spawns the real built server (`dist/bin/serve.js`) inside `act` and exercises a full GET/PUT round-trip against the real `@actions/cache` backend
- `start-cache-server/selfcheck.cjs`, `publish-mirror/selfcheck.cjs` — standalone Node self-checks for the composite actions' gate/guard logic, run on Windows in CI (`windows-selfcheck` job)

**Structure:**
```
packages/op-nx-github-cache/
├── src/lib/shard.ts
├── src/lib/shard.spec.ts                            # unit, co-located
├── src/lib/server.integration.spec.ts               # integration, co-located
├── src/lib/backends/actions-cache-backend.integration.spec.ts
├── __fixtures__/act-round-trip.mjs                  # act-tier harness
├── vitest.config.mts                                # unit tier
└── vitest.integration.config.mts                    # integration tier
```

Spec compilation is governed by `packages/op-nx-github-cache/tsconfig.spec.json` (types: `vitest/globals`, `node`; references `tsconfig.lib.json`).

## Test Structure

**Suite Organization** (from `src/lib/cleanup.spec.ts`):
```typescript
import { describe, expect, it } from 'vitest';
import { planShardCleanup, selectAssetsToDelete } from './cleanup.js';

const NOW = new Date('2026-07-15T00:00:00Z');
const now = () => NOW;

function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

describe('selectAssetsToDelete', () => {
  it('keeps an asset exactly maxAgeDays old (age check is strict >, not >=)', () => {
    const result = selectAssetsToDelete(
      [{ name: 'exact.tar.gz', createdAt: daysAgo(30) }],
      { maxAgeDays: 30, now },
    );

    expect(result).toHaveLength(0);
  });
});
```

**Patterns:**
- One `describe` per exported function/factory, named after it; sometimes with a parenthetical rationale: `describe('actionsCachesListArgs (forces GET so gh does not POST on -f)', ...)`
- Test names are full behavior sentences, often naming the failure mode they guard: `'rethrows a non-404 error instead of masking it as a cache miss'`, `'falls back to 0 and warns on invalid input instead of crashing listen'`
- Regression-guard comments inside tests explain WHY the test exists and what naive implementation it would catch (see `'coalesces concurrent cold-shard lookups...'` in `src/lib/backends/release-mirror-backend.spec.ts`)
- Table-driven cases via `it.each`: `it.each(TRUSTED_EVENTS)('trusts "%s" under GITHUB_ACTIONS', ...)` (`src/lib/trust.spec.ts`), `it.each([...])('accepts plausible branch name "%s"', ...)` (`src/bin/publish-mirror.spec.ts`)
- Deterministic clock: fixed `const NOW = new Date('2026-07-15T00:00:00Z')` injected via the production code's `now?: () => Date` option — never fake timers for date logic
- `beforeEach`/`afterEach` only where real resources need setup/teardown (server listen/close in `src/lib/server.integration.spec.ts`); pure-function suites have none
- Integration server tests bind to `server.listen(0, '127.0.0.1', ...)` (ephemeral port) and use global `fetch`
- Env vars mutated in a test are saved and restored in `finally`/teardown (see the `request()` helper and the body-size-cap test in `src/lib/server.integration.spec.ts`)
- Module-level env-derived state is re-evaluated with `vi.resetModules()` + dynamic `await import('./server.js')` when a test needs a different env (MAX_CACHE_BODY_BYTES test)

## Mocking

**Framework:** Vitest (`vi`)

**Patterns:**

1. Hand-built fake objects from `vi.fn()`, assembled by a local factory — preferred for injectable dependencies (`src/lib/backends/release-mirror-backend.spec.ts`):
```typescript
function makeOctokit(overrides: {
  getReleaseByTag: ReturnType<typeof vi.fn>;
  paginate?: ReturnType<typeof vi.fn>;
  getReleaseAsset?: ReturnType<typeof vi.fn>;
}) {
  return {
    paginate: overrides.paginate ?? vi.fn().mockResolvedValue([]),
    rest: { repos: { getReleaseByTag: overrides.getReleaseByTag, ... } },
  } as never;
}
```

2. `vi.mock` for un-injectable module imports, with top-level `await import()` AFTER the mock so the SUT binds to it (`src/lib/backends/actions-cache-backend.integration.spec.ts`):
```typescript
vi.mock('@actions/cache', () => ({
  saveCache: vi.fn(async () => { events.push('save-start'); ...; return 1; }),
  restoreCache: vi.fn(async () => { ...; return undefined; }),
}));

const { cacheArchivePath, createActionsCacheBackend } =
  await import('./actions-cache-backend.js');
```
Typed per-test overrides via `vi.mocked(saveCache).mockResolvedValueOnce(-1)`. Ordering assertions use a shared `events: string[]` the mocks push into (concurrency serialization test).

3. In-memory fake implementing the real interface for integration tests — `createInMemoryBackend(): CacheBackend & { store: Map<string, Buffer> }` in `src/lib/server.integration.spec.ts`. Inline throwing/misbehaving `CacheBackend` literals for error-path tests.

4. Console spies to assert warn behavior: `vi.spyOn(console, 'warn').mockImplementation(() => {})` with `vi.restoreAllMocks()` in `afterEach` (`src/bin/serve.spec.ts`)

**What to Mock:**
- External SDKs at their injection seam (Octokit via the `octokit` option) or module boundary (`@actions/cache` via `vi.mock`)
- The clock, via the `now` option

**What NOT to Mock:**
- The HTTP server — integration specs run a real `node:http` server on a loopback ephemeral port and hit it with real `fetch`
- The filesystem in integration specs (real tmpdir writes)
- Anything a pure-function extraction can make mock-free: the codebase deliberately extracts logic (`filterNxCacheKeys`, `planShardCleanup`, `actionsCachesListArgs`) so its specs need zero mocks — prefer that over mocking `gh`/`execFile`

## Fixtures and Factories

**Test Data:**
- Small inline literals; local helper functions for repeated shapes: `daysAgo(days)` (`src/lib/cleanup.spec.ts`), `notFoundError()` (`src/lib/backends/release-mirror-backend.spec.ts`)
- Shared constants at the top of the file: `const TOKEN = 'test-token'; const HASH = 'abc123';`

**Location:**
- `packages/op-nx-github-cache/__fixtures__/` holds only act-tier assets: `act-workflow.yml`, `act-round-trip.mjs`, `pull_request_target-event.json`. No shared unit-test fixture directory — keep unit data inline

## Coverage

**Requirements:** None enforced (no thresholds configured)

**Provider:** `@vitest/coverage-v8`
- Unit reports: `packages/op-nx-github-cache/test-output/vitest/coverage`
- Integration reports: `packages/op-nx-github-cache/test-output/vitest/coverage-integration` (declared as the Nx `integration` target's output)

**View Coverage:**
```bash
npx nx test @op-nx/github-cache -- --coverage
```

## Test Types

**Unit Tests (`*.spec.ts`):**
- Pure logic and mocked-I/O contracts. Must stay OS-portable (no real sockets/fs/platform-dependent paths) — this is a hard constraint, not a preference: unit specs are cached cross-OS by Nx and CI runs them on one OS only

**Integration Tests (`*.integration.spec.ts`):**
- Real sockets, real filesystem, real process env mutation. Run on both `ubuntu-24.04-arm` and `windows-11-arm` in CI (`.github/workflows/ci.yml` `integration` job, `fail-fast: false`). Anything touching OS surface belongs here, never in the unit tier

**E2E / act tier:**
- `npm run test:act` runs the real built server inside `act` against a real emulated Actions cache; `test:act:untrusted` asserts the CREEP trust gate returns 403. Assertion style is plain `assertStatus()` throws, no framework (`__fixtures__/act-round-trip.mjs`)

**Selfchecks:**
- `node start-cache-server/selfcheck.cjs` / `node publish-mirror/selfcheck.cjs` — framework-free CJS scripts covering the composite actions' Windows-specific gate/skip/exit-code paths (CI `windows-selfcheck` job)

## Common Patterns

**Async Testing:**
```typescript
// resolves matcher for simple async contracts
await expect(backend.put('abc123', Buffer.from('x'))).resolves.toBe('forbidden');

// Promise.all to force genuine concurrency, then assert call counts / ordering
const [aaa, bbb] = await Promise.all([backend.get('aaa'), backend.get('bbb')]);
expect(getReleaseByTag).toHaveBeenCalledTimes(1);
```

**Error Testing:**
```typescript
// rejects.toThrow for propagation contracts
await expect(backend.get('abc123')).rejects.toThrow('boom');

// status-code mapping via a real server + throwing fake backend
// (see putStatusFor() helper in src/lib/server.integration.spec.ts)
expect(await putStatusFor(backend)).toBe(500);
```

**Boundary testing discipline:**
- Every allowlist regex gets both accept and reject tables, including adversarial inputs (`'../../etc/passwd'`, `'main\ninjected'`) — see `src/bin/publish-mirror.spec.ts`
- Off-by-one edges asserted explicitly (`'keeps an asset exactly maxAgeDays old (age check is strict >, not >=)'`)
- Fail-safe direction asserted (`'keeps an asset with an unparseable createdAt rather than deleting it'`)

**Adding a new test — decision rule:**
1. Can the logic be extracted as a pure function? Do that, unit-test it mock-free in a co-located `*.spec.ts`
2. Does it need a real socket/filesystem/env? `*.integration.spec.ts`, remember it runs on Windows too
3. Does it need the real GitHub Actions runtime (cache service, `$GITHUB_ENV`)? Extend `__fixtures__/act-workflow.yml` / `act-round-trip.mjs`

---

*Testing analysis: 2026-07-17*
