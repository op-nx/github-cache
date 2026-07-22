# Testing Patterns

**Analysis Date:** 2026-07-22

## Test Framework

**Runner:**
- Vitest ~4.1.0, driven through the `@nx/vitest` Nx plugin (`nx.json` plugin entry,
  `testTargetName: "test"`). Never invoke `vitest` directly — always go through
  `nx test github-cache` / `nx run-many -t test` (or `nx run-many -t integration` for
  the separate integration target), per the repo's Nx-first execution convention.
- Config: `packages/github-cache/vitest.config.mts` (unit) and
  `packages/github-cache/vitest.integration.config.mts` (integration) — two
  **separate Vitest configs, two separate targets**, not one config with a filter.
  This is deliberate: distinct `cacheDir`s (`node_modules/.vite/packages/github-cache`
  vs `.../github-cache-integration`) so the two suites never race on Vite's cache
  when run concurrently (see `AGENTS.md`'s worktree-parallelism note).
- Transpilation: `@swc-node/register` (SWC) + `@swc/helpers`, declared in
  `.fallowrc.jsonc`'s `ignoreDependencies` as load-bearing-but-not-an-ES-import.

**Assertion Library:** Vitest's built-in `expect` (Chai-compatible), `globals: true`
in both configs — so `describe`/`it`/`expect`/`vi` are ambient; specs still
explicitly `import { describe, expect, it, vi } from 'vitest'` throughout the
codebase for explicitness even though globals are enabled.

**Run Commands:**
```bash
npx nx test github-cache              # unit suite (fast; excludes *.integration.spec.ts)
npx nx run-many -t test                # unit suite, all projects
npx nx run-many -t integration         # integration target (cross-OS matrix in CI)
npx nx test github-cache --coverage    # v8 coverage report
```
(Package-manager prefix per project convention: `pnpm nx` / `npm exec nx` — this repo
uses plain `npm`, so `npx nx ...` / the root `npm run test` / `npm run integration`
package-json scripts, which themselves call `nx run-many -t test` / `-t integration`.)

## Test File Organization

**Location:** Co-located, always. Every `*.spec.ts` sits directly next to the module
it tests in the same directory (`select-backend.ts` +
`select-backend.spec.ts`, `server.ts` + `server.spec.ts`). There is no separate
`tests/` or `__tests__/` tree — `vitest.config.mts`'s `include` pattern
(`{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}`) supports a `tests/`
root as an alternative but the codebase does not use it.

**Naming:**
- Unit spec: `<module>.spec.ts` — co-located, runs under the `test` target.
- Integration spec: `<module>.integration.spec.ts` — co-located, runs under the
  separate `integration` target **only** (explicitly excluded from `test`'s `include`
  via `vitest.config.mts`'s exclude list, so it never double-runs).
- Cross-cutting/drift-guard specs live at the package-source root
  (`packages/github-cache/src/*.spec.ts`) rather than next to any single module,
  because they guard a fact that spans multiple files (the whole public surface, all
  adoption docs, the whole pinned-dependency set). Examples: `public-surface.spec.ts`,
  `docs-adoption.spec.ts`, `docs-trust.spec.ts`, `pinned-deps.spec.ts`,
  `governance-docs.spec.ts`, `governance-email.spec.ts`, `consumer-action-runtime.spec.ts`.

**Structure (current count, ~430 unit tests total across):**
```
packages/github-cache/src/
  action/index.spec.ts
  backend/actions-cache-backend.spec.ts
  backend/memory-backend.spec.ts
  backend/releases-backend.spec.ts
  cleanup/cleanup.spec.ts
  cleanup/cleanup-workflow.spec.ts
  cleanup/index.spec.ts
  conformance/conformance.spec.ts
  consumer-action-runtime.spec.ts
  docs-adoption.spec.ts
  docs-trust.spec.ts
  governance-docs.spec.ts
  governance-email.spec.ts
  lib/cache-archive-path.spec.ts
  lib/cache-key.spec.ts
  lib/dogfood-body.spec.ts
  lib/local-context.spec.ts
  lib/release-asset-name.spec.ts
  lib/resilient-octokit.spec.ts
  lib/retention.spec.ts
  lib/select-backend.spec.ts
  lib/sync-gate.spec.ts
  lib/trust.spec.ts
  lib/with-hash-lock.spec.ts
  pinned-deps.spec.ts
  ppe/ppe-action.spec.ts
  public-surface.spec.ts
  publish/publish-mirror.spec.ts
  serve.spec.ts
  server/public-server.integration.spec.ts   <- integration target only
  server/server.spec.ts
```
31 spec files total (30 unit + 1 integration, as of this analysis). 430 tests, up
from a 384-test baseline at the start of the most recent hardening pass (per
`.planning/STATE.md`).

## Test Structure

**Suite organization:** `describe` blocks are titled with the behavior under test
plus a bracketed requirement/decision ID, so a failing test name alone locates the
governing requirement:

```ts
describe('createActionsCacheBackend put (ROBUST-03)', () => {
  it('returns "stored" on a positive saveCache id (ROBUST-03)', async () => {
    saveCache.mockResolvedValue(42);
    const backend = createActionsCacheBackend();

    const result = await backend.put(HASH, Buffer.from('tar-bytes'));

    expect(result).toBe('stored');
  });
});
```

**Patterns:**
- `afterEach`/`beforeEach` reset mocks (`vi.resetAllMocks()` / `vi.clearAllMocks()`)
  and clean up any real filesystem side effects the test created (e.g.
  `await rm(cacheArchivePath(HASH), { force: true })` in
  `actions-cache-backend.spec.ts`), so tests never leak state across cases.
- Assertions favor exact equality (`toEqual`, `toBe`) over loose matchers; where a
  test could pass vacuously, the code comment says so explicitly — e.g.
  `// Non-vacuous: the assertion below compares...` in
  `actions-cache-backend.spec.ts`'s path-agreement test, or the cross-OS round-trip
  test in `releases-backend.spec.ts` that carries an explicit `// Non-vacuous:` note
  proving a namespacing bug would actually fail the negative case.
- **No fixed-timer waits.** Concurrency ordering tests use a hand-rolled
  `deferred<T>()` + `entryTracker()` pair (`actions-cache-backend.spec.ts`) that
  resolves the instant an expected call count is reached, and a `stableAt(n)` helper
  that flushes 50 microtask turns to assert "nothing further happened" — never
  `setTimeout`, because a fixed-tick wait can flake under CPU contention (documented
  in-file as a lesson learned).

## Mocking

**Framework:** Vitest's built-in `vi` (`vi.mock`, `vi.fn`, `vi.mocked`, `vi.hoisted`).
**No third-party mocking library** (no `sinon`, no `nock`, no `msw`).

**Two mocking shapes, chosen by what's being replaced:**

1. **Module mocking for vendored SDKs that only work on real infrastructure.**
   `@actions/cache` and `@actions/core` are `vi.mock()`'d wholesale — documented in
   `actions-cache-backend.spec.ts` as "First module mock in this repository"
   (`@actions/cache` only actually works inside a real GitHub Actions runner, so
   every unit layer must mock it):
   ```ts
   vi.mock('@actions/cache');
   vi.mock('@actions/core', () => ({ warning: vi.fn() }));

   const restoreCache = vi.mocked(cache.restoreCache);
   const saveCache = vi.mocked(cache.saveCache);
   ```
   `publish-mirror.spec.ts` mocks the backend module directly (not the raw
   `@actions/cache` import) via `vi.hoisted` + `vi.mock('../backend/actions-cache-backend.js', ...)`
   so a single `getMock` can drive HIT/MISS/size deterministically — including the
   ~2 GiB boundary, which cannot be exercised with a real allocation
   (`{ byteLength } as unknown as Buffer` fakes only the field the code reads).

2. **Injected fakes for the hand-written client ports (the dominant pattern).**
   `CleanupClient` and `PublishClient` are plain interfaces (see CONVENTIONS.md); specs
   build a fake object directly, using a small factory + `overrides` idiom so most
   tests only override the one method under test:
   ```ts
   function client(overrides: Partial<PublishClient> = {}): PublishClient {
     return {
       listCacheEntries: vi.fn(async () => [{ key: `nx-cache-${HASH}` }] as CacheEntry[]),
       getReleaseByTag: vi.fn(async () => ({ id: SHARD_ID })),
       createRelease: vi.fn(async () => ({ id: SHARD_ID })),
       listReleaseAssets: vi.fn(async () => [] as string[]),
       uploadReleaseAsset: vi.fn(async () => {}),
       ...overrides,
     };
   }
   ```
   No network call is ever made from a unit spec — every octokit-touching engine is
   exercised entirely through its injected port.

**What to mock:** vendored SDKs that require live infra (`@actions/cache`), and the
injected client ports (`CleanupClient`, `PublishClient`, `ReleasesReadClient`) at
their interface boundary.

**What NOT to mock:** the module under test's own internal logic, `node:http`/real
sockets in integration specs (see below), and never `instanceof` a vendor error class
— faults are faked with the shared `octokitFault(status, body?)` helper
(`packages/github-cache/src/test/octokit-fault.ts`), which builds a plain `Error`
carrying `.status` and `.response.data` so the duck-typed `statusOf` discrimination
(see CONVENTIONS.md) is exercised faithfully without a real Octokit dependency.

## Conformance fixture

`packages/github-cache/src/conformance/conformance.spec.ts` proves the server matches
the real Nx self-hosted-cache HTTP contract, in two layers:

- **Layer (a): vendored-spec drift guard.** A real Nx OpenAPI spec file
  (`nx-cache-openapi.v23.1.0.json`) is vendored verbatim (never reformatted — see the
  `.prettierignore` carve-out) and its **full-file sha256** is pinned as a constant
  (`VENDORED_SPEC_SHA256`). The spec's own `info.version` field is deliberately never
  used as the drift signal — it stayed `"1.0.0"` across a real 202→200 status-code
  contract change in Nx, so it is useless as a change detector. Re-vendoring on an Nx
  major bump is a documented manual step: re-fetch the spec, overwrite the file,
  recompute the sha256, bump `PINNED_NX_VERSION` and the filename together.
- **Layer (b): behavioral status conformance.** Live assertions against a real
  `createCacheServer` + real loopback HTTP: PUT succeeds with **exactly** 200 (never
  "any 2xx"), a second PUT of the same key is 409, an unauthenticated request is 401, a
  PUT against a read-only backend is 403, a GET of a missing hash is 404, and a GET hit
  reports the correct `Content-Length`.

Any change to the Nx cache protocol must update both layers together, never just the
sha256 pin without a matching behavioral assertion.

## Coverage posture

- `vitest.config.mts` wires `coverage: { provider: 'v8', reportsDirectory:
  './test-output/vitest/coverage' }` via `@vitest/coverage-v8`, but **sets no
  coverage thresholds** anywhere in the config or CI. Coverage is measurable
  (`nx test github-cache --coverage`) but not gated — the enforcement mechanism in
  this codebase is TDD discipline plus the drift-guard suite, not a percentage floor.
- The real gate is the **acceptance command battery** run on every commit:
  `format:check`, `build`, `typecheck`, `test`, `fallow:ci`, `check:action`,
  `pack:check`, plus `typecheck:action` for `start-cache-server/entry.ts` (excluded
  from the main `github-cache` typecheck target since it lives outside that
  project's `tsconfig.json`).
- Test-first (RED→GREEN) discipline is documented project-wide in
  `.planning/RETROSPECTIVE.md`: "mechanisms (sha256 conformance drift guard, pin
  guards, trust-allowlist deep-equality) were proven RED before GREEN" across every
  build phase. When adding a new drift guard or contract test, write it failing
  first against the pre-change code, then make the change.

## Live-CI first-push close pattern (GitHub-Actions-only behaviors)

Some behaviors are provably correct only on a real GitHub-hosted runner and cannot be
synthesized locally without faking the exact thing being proven. This codebase names
that gap explicitly rather than pretending a local mock covers it, and defers closure
to the **first push that exercises the real workflow**:

- **What triggers this classification:** background-step `$GITHUB_ENV` export-variable
  propagation timing, the `background:`/`cancel:` step lifecycle, GitHub's per-OS
  Actions-cache version hashing, a real `zizmor`/`actionlint` self-install-and-scan
  run, and the real cross-OS publish→read-back round-trip. None of these are
  reproducible in Vitest without faking the exact runtime behavior under test — doing
  so would produce a **false COVERED**, not a real proof.
- **How it's marked:** VALIDATION.md entries for these requirements are explicitly
  flagged `human_needed` / "first-push closing proof" rather than left as silent gaps
  (`.planning/milestones/v0.0.1-phases/05-trust-widening-ppe-gate/05-VALIDATION.md`).
  In code, the same posture appears as an explicit comment naming what only a live run
  can prove — e.g. `roundtrip/read-back.ts`'s module doc: "the leg deferred from
  Phase 3... proving the real publisher writes exactly what the real reader finds."
- **The mechanism that actually closes it:** a dedicated CI job or bin that runs only
  on a real push/schedule trigger and fails loud (non-zero exit / `core.setFailed`) on
  any deviation — never a passive log line. Examples: `ci.yml`'s `dogfood-seed`/
  `dogfood-verify` jobs (Phase 2), the `publish`/`publish-verify` cross-OS matrix
  (Phase 4, closed by `packages/github-cache/src/roundtrip/read-back.ts` asserting
  **byte-equality**, not just a HIT, against `dogfoodBody(hash)`), and the advisory
  `ppe` job in `ci.yml` running the real composite action against
  `ppe/fixtures/unsafe-workflow.yml` (Phase 5).
- **Lesson captured in-repo:** `.planning/RETROSPECTIVE.md` records that three real
  distribution bugs (cross-OS lockfile drift, the background-step export handshake,
  a readiness-poll/cache-key collision) passed every local gate and the verifier and
  surfaced only on real GitHub Actions — it took 5 live pushes to close them. When
  adding a new GitHub-Actions-only mechanism, plan its live first-push close
  explicitly; do not treat "green locally" as equivalent to "done."

## Common Patterns

**Async / ordering testing (no timers):**
```ts
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
}
// entryTracker() (actions-cache-backend.spec.ts) marks call order and lets a test
// await tracker.reached(n) or tracker.stableAt(n) instead of a fixed setTimeout.
```

**Fault/error-path testing:**
```ts
saveCache.mockRejectedValue(new Error('network down'));
const backend = createActionsCacheBackend();

await expect(backend.put(HASH, Buffer.from('tar-bytes'))).rejects.toThrow('network down');
```
```ts
// Octokit-shaped fault via the shared fixture, never a real SDK error class:
const fake = client({ deleteAsset: vi.fn().mockRejectedValue(octokitFault(404)) });
```

**Real-socket integration testing:** integration specs (`*.integration.spec.ts`, plus
the unit-target `conformance.spec.ts`, which also opens a real loopback server)
construct a real `http.Server` via `createCacheServer`, `listen(0, '127.0.0.1', ...)`
to get an OS-assigned ephemeral port, then drive it with the real global `fetch` —
never `supertest` or a mocked request/response pair:
```ts
function listen(server: Server): Promise<string> {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo;
      resolve(`http://127.0.0.1:${port}`);
    });
  });
}
```
`afterEach` always closes the server (`await new Promise<void>((r) => server.close(() => r()))`)
so no listening handle leaks between tests.

**Config-assertion (YAML/text) testing:** for facts that live in `.yml` with no
injectable-client seam (workflow permissions, composite-action tool pins), read the
file from disk via `import.meta.url` (never `__dirname`, never `process.cwd()`),
strip `#`-prefixed comment lines first, then regex-assert the load-bearing structure
— see `cleanup-workflow.spec.ts` and `ppe-action.spec.ts` for the canonical shape.

---

*Testing analysis: 2026-07-22*
