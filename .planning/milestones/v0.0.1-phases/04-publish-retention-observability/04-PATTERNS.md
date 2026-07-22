# Phase 4: Publish + Retention + Observability - Pattern Map

**Mapped:** 2026-07-20
**Files analyzed:** 15 (6 new modules, 6 new specs/helpers, 3 modified sources, 3 config)
**Analogs found:** 14 / 15 (one test helper has no in-repo analog)

Every new capability this phase is an assembly of existing single-source helpers plus
Octokit calls. The only genuinely new pure logic is `sync-gate` and `shardTagsForWindow`.
All source excerpts below are read-only references; the planner cites them per-plan.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/lib/sync-gate.ts` (new) | utility (pure predicate) | transform (env bag -> bool) | `src/lib/trust.ts` | exact (role+flow) |
| `src/lib/sync-gate.spec.ts` (new) | test | transform (property over event set) | `src/lib/trust.spec.ts` | exact |
| `src/lib/retention.ts` (new) | utility (comment-locked helper) | transform (knob -> days / shard tags) | `src/backend/releases-backend.ts:139` `shardTag()` + `src/lib/cache-archive-path.ts` | exact (role), replaces stub |
| `src/lib/retention.spec.ts` (new) | test | transform (boundary/property) | `src/backend/releases-backend.spec.ts:197-213` (shardTag block) + `src/lib/cache-archive-path.spec.ts` | exact |
| `src/publish/publish-mirror.ts` (new) | service (orchestration engine) | batch + file-I/O (enumerate -> restore -> upload) | `src/backend/actions-cache-backend.ts` + `src/backend/releases-backend.ts` (injected-client seam, ME-01) | role-match |
| `src/publish/publish-mirror.spec.ts` (new) | test | fault-injection (injected client) | `src/backend/actions-cache-backend.spec.ts` (vi.mock) + `src/backend/releases-backend.spec.ts` (injected fake + fault matrix) | exact |
| `src/cleanup/cleanup.ts` (new) | service (orchestration engine) | batch (list-abort / delete-isolate) | `src/backend/releases-backend.ts` (fault split) + RESEARCH Pattern 4 | role-match |
| `src/cleanup/cleanup.spec.ts` (new) | test | fault-injection (mid-pagination) | `src/backend/releases-backend.spec.ts:430-498` (fault matrix) | exact |
| `src/publish/index.ts` (new) | bin/entrypoint | event-driven (workflow-invoked) | `src/action/index.ts` + `src/serve.ts:141-156` (main + invocation guard) | exact (role) |
| `src/cleanup/index.ts` (new) | bin/entrypoint | event-driven (scheduled) | `src/action/index.ts` + `src/serve.ts:141-156` | exact (role) |
| `src/backend/releases-backend.ts` (modify) | backend/service | request-response (read) | itself (`createReleasesReadClient.fetchAsset`, lines 169-293) | in-place edit |
| `src/pinned-deps.spec.ts` (modify) | test (config assertion) | file-I/O (read manifest) | itself (lines 22-32) | in-place edit |
| `packages/github-cache/package.json` (modify) | config | n/a | itself (lines 18-21) | in-place edit |
| `.github/workflows/ci.yml` (modify) | config (workflow) | n/a | `dogfood-seed`/`dogfood-verify` pair (lines 121-163) + integration matrix (lines 89-102) | exact |
| `.github/workflows/cleanup.yml` (new) | config (workflow) | n/a | `ci.yml` job shape + integration matrix | role-match |
| `.fallowrc.jsonc` (modify) | config | n/a | itself (`entry` array, lines 9-19) | in-place edit |

Shared test helper `octokitFault(status, body?)` (new, `src/publish/` or a `src/test/` utility) has
**No Analog** -- see the section at the end.

## Pattern Assignments

### `src/lib/sync-gate.ts` (utility, transform)

**Analog:** `src/lib/trust.ts` (the WRITE gate D-01 says NOT to reuse -- copy the SHAPE, keep a SEPARATE source of truth).

**Frozen allowlist + default-deny predicate** (`trust.ts:1-25`):
```typescript
/**
 * Trusted triggers for the write gate (TRUST-03). Default-deny allowlist with NO
 * denylist path: an unrecognised or unset trigger returns not-trusted.
 * ponytail: array .includes is fine at n=2.
 */
export const TRUSTED_EVENTS = ['push', 'schedule'] as const;

export function isWriteTrusted(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.GITHUB_ACTIONS !== 'true') {
    return false; // not CI -> never RW
  }

  return (TRUSTED_EVENTS as readonly string[]).includes(
    env.GITHUB_EVENT_NAME ?? '',
  );
}
```

**What to copy vs. what to change (D-01, load-bearing):**
- Copy: the `GITHUB_ACTIONS !== 'true'` short-circuit; the frozen `as const` allowlist; the injectable `env` bag with `process.env` default (keeps `Function.length` at 0); the default-deny `.includes(... ?? '')` shape.
- Change: declare a NEW `const SYNC_EVENTS = ['push', 'schedule'] as const` -- do NOT `import { TRUSTED_EVENTS }`. Add the default-branch check (RESEARCH Pattern 1, 04-RESEARCH.md:219-260): read `repository.default_branch` from the `GITHUB_EVENT_PATH` payload JSON, require `GITHUB_REF` starts with `refs/heads/`, and require `GITHUB_REF_NAME === default_branch`. Unreadable payload -> fail-closed (return false).

**File-read + fail-closed idiom** for the default-branch read is already in-repo in `serve.ts`/`local-context.ts`; the payload parse follows the `try { JSON.parse(readFileSync(path, 'utf8')) } catch { return undefined }` shape from RESEARCH Pattern 1.

---

### `src/lib/sync-gate.spec.ts` (test)

**Analog:** `src/lib/trust.spec.ts` (exact structure to mirror).

**Refused-event table + content-pin** (`trust.spec.ts:7-19, 40-49, 79-87`):
```typescript
const REFUSED_EVENTS = [
  'pull_request', 'pull_request_target', 'issue_comment', 'workflow_run',
  'workflow_dispatch', 'repository_dispatch', 'merge_group', 'release',
  'delete', 'registry_package', 'page_build',
];

for (const event of REFUSED_EVENTS) {
  it(`refuses ${event} even inside GitHub Actions (TRUST-03)`, () => {
    const result = isWriteTrusted({ GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: event });
    expect(result).toBe(false);
  });
}

// Content pin: deep-equality turns an early widening into a build failure.
it('deep-equals the two-element push/schedule allowlist (TRUST-03)', () => {
  expect([...TRUSTED_EVENTS]).toEqual(['push', 'schedule']);
});
```

**For sync-gate (D-01/TRUST-02):** reuse the `REFUSED_EVENTS` table (CONTEXT.md names the same 8+ events to test-lock); add rejection cases for non-default refs and tag refs (`refs/tags/...`); add the `SYNC_EVENTS` deep-equal content-pin. Inject a fake `readDefaultBranch` (Pattern 1 exposes it as a second injectable param) so the spec never touches the filesystem -- mirrors the injectable-env convention. Add a NEGATIVE test where the current branch != default branch even for a `push`.

---

### `src/lib/retention.ts` (utility, transform)

**Analog:** the `shardTag()` stub at `src/backend/releases-backend.ts:127-144` (which D-08 REPLACES), plus the comment-locked-helper template from `src/lib/cache-archive-path.ts` and `src/lib/release-asset-name.ts`.

**The stub being replaced** (`releases-backend.ts:127-144`) -- note the explicit `ponytail:` upgrade path pointing at this phase:
```typescript
/**
 * ponytail: single-shard stub, current month only. The retention read-window walk
 * (shardTagsForWindow, coupled to CACHE_MIRROR_MAX_AGE_DAYS) is Phase 4's concern;
 * ... Upgrade path: replace this single call site with the Phase 4 read-window walk.
 */
export function shardTag(date: Date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');

  return `cache-mirror-${year}${month}`;
}
```

**Comment-locked-helper convention to carry into `retention.ts`** (`cache-archive-path.ts:4-17` header shows the exact tone: LOAD-BEARING, single-source, "the failure mode is a silent MISS, not a crash", "exact produced value is pinned by the spec"). `shardTagsForWindow` is coupled to `shardTag`'s tag scheme, so drift is the same silent-MISS class -- annotate it the same way.

**Concrete impl** is given in RESEARCH Pattern 5 (04-RESEARCH.md:422-449): `resolveMaxAgeDays(env)` (default 30, clamp to 365 ceiling, reject NaN/<=0) + `shardTagsForWindow(maxAgeDays, now = new Date())` (calendar-month arithmetic, NEWEST FIRST, cursor steps back a month at a time -- NOT `maxAgeDays/30`). Both are pure with injectable inputs, keeping `Function.length` low per repo convention. Whether it lives beside `shardTag` or in its own `lib/retention.ts` module is Claude's Discretion (CONTEXT.md:158); the recommended structure (RESEARCH:196) is a new `lib/retention.ts`.

---

### `src/lib/retention.spec.ts` (test)

**Analog:** the `shardTag` describe block at `src/backend/releases-backend.spec.ts:197-213` (string-literal pin, NOT rebuilt from the template) + `src/lib/cache-archive-path.spec.ts`.

**Pin-as-literal convention** (`releases-backend.spec.ts:197-213`):
```typescript
describe('shardTag current-month single-shard seam (D-03)', () => {
  it('is exactly cache-mirror-202607 for a July 2026 date (D-03)', () => {
    // Pinned as a string literal (not rebuilt from the same template the impl uses)
    // so a cosmetic change to the tag scheme fails here rather than silently reading
    // a different shard.
    expect(shardTag(new Date('2026-07-19'))).toBe('cache-mirror-202607');
  });

  it('zero-pads the month and reads year+month in UTC (D-03)', () => {
    expect(shardTag(new Date('2026-01-05T00:00:00Z'))).toBe('cache-mirror-202601');
    expect(shardTag(new Date('2026-12-31T00:00:00Z'))).toBe('cache-mirror-202612');
  });
});
```

**For retention (D-07/D-08, per RESEARCH Validation Architecture:601):** boundary tests for `shardTagsForWindow` across a Dec->Jan boundary, a 28-day February, and exactly-30-day windows (assert NEWEST-FIRST ordering and no `/30` under-scan). `resolveMaxAgeDays` NaN/negative/over-ceiling -> default/clamp. Pass an injected `now: Date` (Pattern 5 signature) so the spec is deterministic -- same shape as `shardTag(new Date(...))` above.

---

### `src/publish/publish-mirror.ts` (service, batch + file-I/O)

**Analog:** `src/backend/actions-cache-backend.ts` (byte fetch reuse, fault-as-benign-noop discipline) + `src/backend/releases-backend.ts` (the injected-client seam + ME-01).

**Injected narrow-client seam** (`releases-backend.ts:21-23, 59-61`) -- the precedent for TEST-03's fake:
```typescript
export interface ReleaseReadClient {
  fetchAsset(assetName: string): Promise<Buffer | undefined>;
}

export function createReleasesReadBackend(client: ReleaseReadClient): CacheBackend {
```
Copy this pattern: the publisher takes a NARROW injected Octokit-shaped client interface (e.g. `getReleaseByTag` / `createRelease` / `listReleaseAssets` / `uploadReleaseAsset` / `getActionsCacheList`), so the spec injects a fault-shaped fake and never hits the network. Declare the interface in the module; the real client is constructed only in the bin (`index.ts`).

**Reuse the existing backend for same-OS byte fetch** (do NOT add a second `restoreCache` call site -- RESEARCH Don't-Hand-Roll:468). `actions-cache-backend.ts:32-52` already restores through `cacheArchivePath` + `cacheKeyFor` and removes the temp file:
```typescript
export function createActionsCacheBackend(): CacheBackend {
  return {
    async get(hash: string): Promise<GetResult> {
      const path = cacheArchivePath(hash);
      const matched = await cache.restoreCache([path], cacheKeyFor(hash));
      if (matched === undefined) {
        return { kind: 'miss' };
      }
      try {
        const bytes = await readFile(path);
        return { kind: 'hit', bytes };
      } finally {
        await rm(path, { force: true }); // never leave cache bytes on a reused runner
      }
    },
```
The publisher calls `createActionsCacheBackend().get(hash)`; a foreign-OS entry MISSes and is skipped (D-03).

**The `nx-cache-` prefix D-16 filters on** (`actions-cache-backend.ts:6-15`):
```typescript
export function cacheKeyFor(hash: string): string {
  return `nx-cache-${hash}`;
}
```
Filter `getActionsCacheList` results with `c.key.startsWith('nx-cache-')` then `.slice('nx-cache-'.length)` (RESEARCH:519-522). Derive asset names ONLY through `releaseAssetName(hash)` (`lib/release-asset-name.ts:39-44`, comment-locked, D-05/D-16/CORR-01) -- never a new name template.

**Benign-fault vs real-fault discipline** to carry over (`actions-cache-backend.ts:54-84` shows the same-hash-write-is-byte-identical rationale; `releases-backend.ts:46-57` header spells out the publish/cleanup asymmetry):
```typescript
// releases-backend.ts:53-57 -- the asymmetry the publisher must respect:
// get here deliberately swallows every fault into a MISS, whereas
// Phase 4's cleanup and any delete/overwrite decision MUST fail loud -- a swallowed
// fault there reads as authoritative absence and would delete live data (Pitfall 7).
```
Concrete publish inner-loop (get-or-create shard, pre-upload `bytes.byteLength >= 2GiB` fail-loud, 1000-cap skip-and-warn, first-write-wins on 422) is RESEARCH Pattern 3 (04-RESEARCH.md:292-362). Structural fault discrimination via a `statusOf(error)` duck-type on `error.status` is RESEARCH Pattern 2 (04-RESEARCH.md:263-289).

---

### `src/publish/publish-mirror.spec.ts` (test)

**Analog:** `src/backend/actions-cache-backend.spec.ts` (the `vi.mock('@actions/cache')` convention + call-argument assertions) and `src/backend/releases-backend.spec.ts` (in-memory fake client + the it.each fault matrix).

**Module auto-mock convention** (`actions-cache-backend.spec.ts:11-27`):
```typescript
vi.mock('@actions/cache'); // hoists above imports, replaces each export with a vi.fn()
const restoreCache = vi.mocked(cache.restoreCache);
const saveCache = vi.mocked(cache.saveCache);

afterEach(async () => {
  vi.resetAllMocks();
  await rm(cacheArchivePath(HASH), { force: true });
});
```
Mock `@actions/cache` (byte fetch) and `@actions/core` (annotations) the same way; assert on recorded call arguments.

**In-memory fake + recording client** (`releases-backend.spec.ts:39-65`) -- the seam-reduces-to-a-Map precedent, plus a throwing fake carrying a credential-shaped token for non-vacuous leak assertions:
```typescript
function recordingClient(store: Map<string, Buffer>): RecordingClient {
  const requested: string[] = [];
  return {
    requested,
    async fetchAsset(assetName: string): Promise<Buffer | undefined> {
      requested.push(assetName);
      return store.get(assetName);
    },
  };
}

const throwingClient: ReleaseReadClient = {
  async fetchAsset(): Promise<Buffer | undefined> {
    throw new Error('boom ghs_leakedtokenvalue');
  },
};
```

**Fault matrix via `it.each`** (`releases-backend.spec.ts:430-444`) -- the exact TEST-03/ROBUST-01 shape:
```typescript
it.each([401, 403, 429, 500])(
  'degrades a %i on the release lookup to a MISS through the backend (SRV-05)',
  async (status) => { /* ... inject status, assert branch ... */ },
);
```
For publish, drive the fault fake shaped `{ status, response: { data: { errors: [{ code: 'already_exists' }] } } }` (RESEARCH:600) and assert the already-exists(422)/not-found(404)/other-fault(5xx) branches, the 1000-cap `core.warning`+skip (no non-zero exit), the ~2 GiB pre-upload fail-loud, and the name-derivation-through-`releaseAssetName` non-vacuous check (mirror `releases-backend.spec.ts:113-120` / `actions-cache-backend.spec.ts:123-145`).

---

### `src/cleanup/cleanup.ts` (service, batch)

**Analog:** the fault-split discipline in `src/backend/releases-backend.ts:160-167` (only 404 is absence; every other status THROWS) + RESEARCH Pattern 4.

**Structural-only, 404-is-the-only-absence** (`releases-backend.ts:160-167` doc + `:213-221` code):
```typescript
if (releaseResponse.status === 404) {
  return undefined; // ordinary cold-cache MISS -- shard not published yet
}
if (!releaseResponse.ok) {
  throw new Error(
    `github-cache: release lookup failed with status ${releaseResponse.status}`,
  );
}
```
Cleanup INVERTS the read path's swallow-everything discipline (see the `releases-backend.ts:53-57` asymmetry note above): the LIST phase must FAIL LOUD -- any non-404 fault or incomplete pagination aborts with ZERO deletions (D-10/RETAIN-01). Concrete list-abort/delete-isolate impl (materialize the complete `{release, asset, created_at}` set via `octokit.paginate` which REJECTS on any page fault, THEN delete per-item with isolation, `core.setFailed` on aggregate) is RESEARCH Pattern 4 (04-RESEARCH.md:364-417). Cleanup enumerates EVERY `cache-mirror-*` release (wider than the read window, Pitfall 4), sharing only `resolveMaxAgeDays` with the reader. Behind the same narrow injected-client seam as publish.

---

### `src/cleanup/cleanup.spec.ts` (test)

**Analog:** `src/backend/releases-backend.spec.ts:430-498` (fault matrix through an injected/mocked layer).

**The load-bearing test (RETAIN-01/TEST-04):** inject a mid-pagination fault and assert ZERO deletions occurred (CONTEXT.md D-10). Use the `octokitFault` helper (below) for the throwing page; assert the delete-phase mock was never called. Add: expired-pruned + within-window-retained by `created_at` (TEST-06), per-item isolation + non-zero exit on aggregate (spy `core.setFailed`), and the `put()==='forbidden'` local read-only case already exists (`releases-backend.spec.ts:123-144`). Use `vi.mock('@actions/core')` and assert on `core.warning`/`core.setFailed`/`core.summary` calls.

---

### `src/publish/index.ts` and `src/cleanup/index.ts` (bin/entrypoints, event-driven)

**Analog:** `src/action/index.ts` (the `@actions/core` bin conventions: `core.setSecret`, `core.info`, `core.setFailed`, top-level `run().catch`) + `src/serve.ts:141-156` (the `main()` + `pathToFileURL` invocation guard).

**Top-level run + setFailed catch** (`action/index.ts:137-139`) -- the fail-loud OBS-01/D-15 tail:
```typescript
run().catch((error: unknown) => {
  core.setFailed(error instanceof Error ? error.message : String(error));
});
```

**Direct-invocation guard** (`serve.ts:148-156`) -- required because Windows breaks the naive form (Pitfall 6):
```typescript
// Use pathToFileURL(process.argv[1]).href -- the naive 'file://' + argv[1] form
// is permanently false on Windows (Pitfall 6).
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  void main();
}
```

**Bin structure (D-01 gate placement, D-14/D-17 observability):** publish/index.ts first statement is `if (!isSyncTrusted(process.env)) { core.info(...); return; }` -- a gated-out run is exit 0, NOT an error (RESEARCH:137). Then construct the REAL Octokit client (`new Octokit({ auth: resolveGitHubToken(process.env) })`, reusing `resolveGitHubToken` from `select-backend.ts:24-28`) and call the engine. Emit the D-17 summary via `core.summary.addHeading(...).addTable(...)` + `await core.summary.write()` (RESEARCH Pattern 4:407-411). cleanup/index.ts skips the sync-gate (it is a scheduled single-writer, D-09) and constructs the client the same way. Both must be registered as fallow entry points (see `.fallowrc.jsonc` below) since they are invoked by the runner, never imported. `action.yml`-style build-output wiring: the workflow calls the built `dist/publish/index.js` / `dist/cleanup/index.js` after `npm run build` (mirrors `action.yml:7-10` + `ci.yml:133`).

---

### `src/backend/releases-backend.ts` (MODIFY -- reader integration, D-08)

**In-place edit** to `createReleasesReadClient.fetchAsset` (lines 169-293). Currently it resolves ONE shard via `shardTag()` at line 206:
```typescript
const releaseResponse = await fetch(
  `${GITHUB_API}/repos/${repo}/releases/tags/${shardTag()}`,
  { headers: githubJsonHeaders(token), signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) },
);
if (releaseResponse.status === 404) {
  return undefined;
}
```
**Change (RESEARCH:449):** wrap the release-lookup -> paginate-assets -> download sequence in a loop over `shardTagsForWindow(resolveMaxAgeDays(env))` newest-first; a 404 on a tag means "not in this shard, try the next"; only `undefined` after EXHAUSTING all shards is a MISS. Keep every other line (the token/repo ME-01 memoization at lines 180-201, the pagination at 228-258, the redirect-drop download at 264-291) UNCHANGED. The ME-01 promise-memoization pattern (lines 172-181) is the reusable precedent if per-process shard-release-ID caching is added (D-08 says it is OPTIONAL at a 30-day window). Update `releases-backend.spec.ts:197-213` (the `shardTag` describe block) to cover the window walk, or move that pin to `retention.spec.ts`.

---

### `src/pinned-deps.spec.ts` (MODIFY -- extend the exact-pin guard)

**In-place edit** (lines 22-32 are the template to duplicate):
```typescript
it('@actions/cache is pinned to an exact version, never a range (ROBUST-03)', () => {
  const specifier = manifest.dependencies?.['@actions/cache'];
  expect(specifier).toMatch(EXACT_SEMVER);
});
```
Add an identical `it(...)` asserting `manifest.dependencies?.['@octokit/rest']` matches `EXACT_SEMVER` (D-04, RESEARCH:115). `EXACT_SEMVER` (`/^\d+\.\d+\.\d+$/`, line 20) is reused as-is.

---

### `packages/github-cache/package.json` (MODIFY)

Add `"@octokit/rest": "22.0.1"` to `dependencies` (currently lines 18-21, only `@actions/cache` + `@actions/core`), exact-pinned per RESEARCH:113. Install via `npm install @octokit/rest@22.0.1 -w @op-nx/github-cache`.

---

### `.github/workflows/ci.yml` (MODIFY -- add per-OS publish matrix)

**Analog:** the `integration` matrix (lines 89-102, per-OS `fail-fast: false`) + the `dogfood-seed`/`dogfood-verify` pair (lines 121-163, `if: github.event_name == 'push'`, build-then-action, token by inheritance).

**Matrix shape to copy** (`ci.yml:89-102`):
```yaml
  integration:
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-24.04-arm, windows-11-arm]
    runs-on: ${{ matrix.os }}
```

**Dogfood job shape to copy** (`ci.yml:121-142`) -- note the comment-locked "NO job-level permission block" rationale and the token-by-inheritance pattern:
```yaml
  dogfood-seed:
    if: github.event_name == 'push'
    runs-on: ubuntu-24.04-arm
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v6
        with:
          node-version-file: '.node-version'
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - uses: ./packages/github-cache
        with: { hash: ${{ github.run_id }}, operation: seed }
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**Publish job (D-03/D-15 + Pitfall 3):** matrix `[ubuntu-24.04-arm, windows-11-arm]`, `fail-fast: false`, `needs: build`, `if: ${{ !cancelled() && github.event_name == 'push' }}` (RESEARCH Anti-Patterns:456 -- do NOT depend on `test`). UNLIKE the dogfood pair, this job DOES need a job-level `permissions:` block restating BOTH `contents: write` AND `actions: read` (the workflow default is `contents: read`, ci.yml:9-10; a job block REPLACES the grant wholesale, so omitting `actions: read` 404s `getActionsCacheList` -- Pitfall 3). Runs the built `dist/publish/index.js`.

---

### `.github/workflows/cleanup.yml` (NEW -- scheduled cleanup)

**Analog:** `ci.yml` job shape (checkout/setup-node/npm ci/npm run build steps) -- no exact in-repo scheduled-workflow analog, so model on RESEARCH Pattern 5 + RETAIN-03.

**Shape (D-09/RETAIN-03):** `on: schedule: - cron: ...` (daily); top-level or job `permissions: contents: write` (no `actions: read` -- cleanup does not list caches, Pitfall 3); `concurrency:` group with `cancel-in-progress: false` (QUEUE, don't cancel -- single-writer-by-construction, RESEARCH:59); same steps as a ci.yml job through `npm run build`, then run the built `dist/cleanup/index.js` with `GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}` by inheritance (no PAT, RETAIN-03).

---

### `.fallowrc.jsonc` (MODIFY -- register new bin entry points)

**Analog:** the existing `entry` array (lines 9-19), which already declares `serve.ts` and `action/index.ts` as runner-invoked-never-imported entries:
```jsonc
"entry": [
  "packages/github-cache/src/index.ts",
  "packages/github-cache/src/serve.ts",
  // JS-action entry: the runner invokes it as action.yml's `main`; never imported.
  "packages/github-cache/src/action/index.ts",
],
```
Add `packages/github-cache/src/publish/index.ts` and `packages/github-cache/src/cleanup/index.ts` with the same "invoked by the workflow, never imported" comment, so the fallow dead-code gate (`npm run fallow:ci`) does not false-positive them as unreachable (RESEARCH Project Constraints:684).

## Shared Patterns

### Structural fault discrimination (ROBUST-01)
**Source:** `src/backend/releases-backend.ts:160-167, 213-221` (only 404 is absence; every other status throws) + RESEARCH Pattern 2 (`statusOf(error)` duck-type on `error.status`, 04-RESEARCH.md:263-289).
**Apply to:** `publish-mirror.ts`, `cleanup.ts`, both bins. Duck-type `typeof error.status === 'number'` -- never `instanceof RequestError` (multiple `@octokit/request-error` versions can coexist), never stderr text. A real 401/403/429/5xx is a fault, never inferred as absence.

### Single-source comment-locked helpers (Pitfall 7, CORR-01)
**Source:** `src/lib/cache-archive-path.ts:4-17`, `src/lib/release-asset-name.ts:22-38` (LOAD-BEARING header tone; "the failure mode is a silent MISS, not a crash"; "exact produced value pinned by the spec").
**Apply to:** `retention.ts` (`shardTagsForWindow` shares `shardTag`'s tag scheme -- same silent-MISS drift class) and every publisher name derivation (MUST route through `releaseAssetName(hash)`, never a new template).

### Injectable pure functions with `process.env`/`process.platform` defaults
**Source:** `trust.ts:17`, `release-asset-name.ts:8-9,39-42`, `local-context.ts:118-120`, `select-backend.ts:40-42` (all take an injectable bag with a default so `Function.length` stays low and tests never touch real env/network).
**Apply to:** `sync-gate.ts` (`env` + injectable `readDefaultBranch`), `retention.ts` (`env`, `now: Date`).

### Injected narrow-client test seam + fault-shaped fakes (TEST-03/04)
**Source:** `src/backend/releases-backend.ts:21-23` (interface) + `releases-backend.spec.ts:39-65` (Map-backed recording fake + throwing fake) + `actions-cache-backend.spec.ts:11-27` (`vi.mock` auto-mock + call-arg assertions).
**Apply to:** `publish-mirror.spec.ts`, `cleanup.spec.ts` -- inject a fault-shaped Octokit fake, never live network.

### Observability via `@actions/core` (D-14/D-15/D-17)
**Source:** `src/action/index.ts:1, 54, 75, 137-139` (`import * as core`, `core.setSecret`, `core.setFailed`, top-level `run().catch(setFailed)`).
**Apply to:** both bins + engines. `core.error`/`core.warning`/`core.notice` for annotations; `core.setFailed` for non-zero exit (fail loud); `core.summary.addHeading/addTable/write` for the D-17 mirrored/skipped/pruned counts. NEVER raw `::error::` echoing. NEVER interpolate the token into any annotation (the `releases-backend.ts:35-44` / `action/index.ts:54` no-leak discipline).

### Token resolution (V2 Authentication, RETAIN-03)
**Source:** `src/lib/select-backend.ts:24-28` `resolveGitHubToken` (`GH_TOKEN || GITHUB_TOKEN`, `||` NOT `??` so a set-but-empty value falls through -- Pitfall 8).
**Apply to:** both bins construct `new Octokit({ auth: resolveGitHubToken(process.env) })`. No PAT; token by process inheritance only.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `octokitFault(status, body?)` test helper | test utility | transform (error factory) | No fault-shaped-error factory exists in-repo yet; `releases-backend.spec.ts:61-65` throws an ad-hoc `new Error(...)` and the fault matrix (`:431`) injects bare `Response` status codes, but neither builds an `{ status, response: { data: { errors: [{ code }] } } }` Octokit-shaped error. RESEARCH:616 calls for this shared helper explicitly. Model it on RESEARCH:600's shape. Keep it a plain factory (no framework), consistent with the repo's no-fixture test style. |

`.github/workflows/cleanup.yml` has a partial analog only (ci.yml job STEPS), because no scheduled/`concurrency` workflow exists in-repo -- the planner should lean on RESEARCH Pattern 5 (04-RESEARCH.md:419-449 context) + RETAIN-03 for the `schedule`/`concurrency`/`permissions` blocks.

## Metadata

**Analog search scope:** `packages/github-cache/src/` (lib, backend, action, server, serve), `.github/workflows/`, `.fallowrc.jsonc`, `package.json`, `action.yml`.
**Files scanned:** 16 (5 source modules, 4 specs, 2 helpers/config, 1 workflow, 1 fallow config, 1 manifest, 1 action manifest, 1 serve composition root).
**Pattern extraction date:** 2026-07-20
