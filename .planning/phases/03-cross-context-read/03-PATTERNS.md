# Phase 3: Cross-Context Read - Pattern Map

**Mapped:** 2026-07-19
**Files analyzed:** 10 (7 created, 3 modified)
**Analogs found:** 9 / 10 (1 file has a partial-analog section: the subprocess wrapper)

The repo is small and internally consistent: every new file in this phase has a direct
in-repo sibling to copy from. The ONLY genuinely new ground is the `node:child_process`
subprocess wrapper inside `local-context.ts` -- there is no precedent anywhere in
`packages/github-cache/src`, so that one section comes from RESEARCH.md Pattern 1 instead.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/lib/release-asset-name.ts` (NEW) | utility | transform (pure) | `src/lib/cache-archive-path.ts` | exact |
| `src/lib/release-asset-name.spec.ts` (NEW) | test | transform (pure) | `src/lib/cache-archive-path.spec.ts` | exact |
| `src/lib/local-context.ts` (NEW) | service / resolver | request-response (subprocess) | `src/lib/select-backend.ts` (`resolveGitHubToken`) + `src/lib/trust.ts` | role-match (env tier exact; subprocess tiers NO analog) |
| `src/lib/local-context.spec.ts` (NEW) | test | module-mock | `src/backend/actions-cache-backend.spec.ts` + `src/lib/select-backend.spec.ts` | role-match |
| `src/backend/releases-backend.ts` (NEW) | backend adapter | request-response (HTTP) | `src/backend/memory-backend.ts` (`createReadOnlyMemoryBackend`) + `src/backend/actions-cache-backend.ts` | exact (both halves) |
| `src/backend/releases-backend.spec.ts` (NEW) | test | request-response | `src/backend/actions-cache-backend.spec.ts` | exact |
| `src/lib/cross-os-invariants.spec.ts` (NEW, optional) | test | file-I/O | `src/pinned-deps.spec.ts` | exact |
| `src/lib/select-backend.ts` (EDIT lines 40-42) | factory / composition | request-response | itself (lines 36-62) | exact |
| `src/lib/select-backend.spec.ts` (EDIT) | test | request-response | itself (lines 95-100, 182-214) | exact |
| `src/index.ts` (EDIT, likely NOT needed) | config / barrel | -- | itself | exact -- see note |

---

## Pattern Assignments

### `src/lib/release-asset-name.ts` (utility, pure transform)

**Analog:** `src/lib/cache-archive-path.ts` -- the D-07 comment-lock template. Copy its
comment IDIOM verbatim in structure, substituting the domain facts.

**Full analog file (20 lines), so the whole shape is the pattern** (`cache-archive-path.ts:1-20`):

```typescript
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Single source of truth for the temp archive path passed to @actions/cache
 * (ROBUST-03). Both the restore and the save call sites MUST resolve their path
 * through this one helper so save and restore always agree on a byte-identical
 * string.
 *
 * LOAD-BEARING, comment-locked (Pitfall 7). @actions/cache version-hashes the
 * LITERAL path string together with the compression choice, so a cosmetic edit
 * here -- inlining it, reformatting it, renaming the file stem, or "tidying" the
 * template -- silently changes the derived version and every restore MISSes, with
 * no error anywhere. Never touch this path without re-verifying an end-to-end
 * restore in CI (the Plan 06 dogfood canary); the failure mode is a silent MISS,
 * not a crash. Its exact produced file name is pinned by cache-archive-path.spec.ts.
 */
export function cacheArchivePath(hash: string): string {
  return join(tmpdir(), `nx-github-cache-${hash}.tar`);
}
```

**The comment idiom to replicate, sentence by sentence** (this is the load-bearing part
of the analog -- the code body is three lines):

| Slot | `cache-archive-path.ts` wording | `release-asset-name.ts` substitution |
|------|--------------------------------|--------------------------------------|
| 1. Single-source claim + req ID | "Single source of truth for the temp archive path passed to @actions/cache (ROBUST-03)." | "Single source of truth for the OS-namespaced Release asset name (CORR-01)." |
| 2. Both call sites named | "Both the restore and the save call sites MUST resolve their path through this one helper..." | "BOTH the Phase 3 reader and the Phase 4 publisher MUST derive names through this one helper..." |
| 3. `LOAD-BEARING, comment-locked (Pitfall N)` marker | "LOAD-BEARING, comment-locked (Pitfall 7)." | "LOAD-BEARING, comment-locked (Pitfall 7, D-07)." |
| 4. WHY the drift is silent (mechanism) | "@actions/cache version-hashes the LITERAL path string..." | "A drift between the two derivations is a SILENT cross-OS MISS -- no error, no crash, just a wave of rebuilds." |
| 5. Explicit forbidden edits | "inlining it, reformatting it, renaming the file stem, or 'tidying' the template" | "Never inline this, never 'tidy' the template, and never change the separator without re-verifying an end-to-end cross-OS read." |
| 6. Failure mode restated | "the failure mode is a silent MISS, not a crash" | same phrasing -- keep it |
| 7. Pointer to the pinning spec | "Its exact produced file name is pinned by cache-archive-path.spec.ts." | "The exact produced name is pinned by release-asset-name.spec.ts." |

**Extra paragraph with no analog** (from RESEARCH.md Pattern 2, lines 405-408) -- the
injectable-platform justification, needed so a later reader does not mistake it for a mode
surface (TRUST-05):

```
 * The platform parameter exists ONLY for test injection -- it lets one CI leg
 * assert all three OS mappings and simulate a wrong-OS reader. It is NOT a mode
 * surface: it cannot influence RW-vs-RO selection (TRUST-05 intact).
```

**Body pattern** (RESEARCH.md lines 409-426). Note the blank-line-before-`return` and
braced `if` bodies mandated by global CLAUDE.md:

```typescript
export function cachePlatform(platform: NodeJS.Platform = process.platform): string {
  if (platform === 'win32') {
    return 'windows';
  }

  if (platform === 'darwin') {
    return 'macos';
  }

  return 'linux';
}

export function releaseAssetName(
  hash: string,
  platform: NodeJS.Platform = process.platform,
): string {
  return `${hash}-${cachePlatform(platform)}`;
}
```

---

### `src/lib/release-asset-name.spec.ts` (test, pure transform)

**Analog:** `src/lib/cache-archive-path.spec.ts` -- the pinned-string-literal discipline
(G2/G4 in RESEARCH.md).

**Header-comment pattern** (`cache-archive-path.spec.ts:6-13`) -- the WHY-this-is-non-vacuous
block. Replicate its structure; it explains why the expectation is a literal:

```typescript
// ROBUST-03, non-vacuous: the expected file name below is spelled out as a string
// literal ON PURPOSE, not rebuilt from the same `nx-github-cache-${hash}.tar`
// template the implementation uses. A reconstructed expectation would still pass
// after a cosmetic rename of the path template -- which is exactly the change that
// silently MISSes every @actions/cache restore, because the toolkit version-hashes
// the literal path string (Pitfall 7). Pinning the literal here is the only
// assertion that fails on that rename instead of failing silently in CI. This is
// the same discipline as server.spec.ts's MAX_CACHE_BODY_BYTES pinned-value test.
```

**Assertion pattern** (`cache-archive-path.spec.ts:14-31`) -- note: imports are
`{ describe, expect, it }` from `'vitest'`, the import of the SUT uses the `.js`
extension, and every test title ends with the requirement ID in parentheses:

```typescript
describe('cacheArchivePath', () => {
  it('produces exactly the file name nx-github-cache-abc123.tar for hash abc123 (ROBUST-03)', () => {
    const path = cacheArchivePath('abc123');

    expect(basename(path)).toBe('nx-github-cache-abc123.tar');
  });

  it('is byte-identical for the same hash and differs for a different hash (ROBUST-03)', () => {
    expect(cacheArchivePath('abc123')).toBe(cacheArchivePath('abc123'));
    expect(cacheArchivePath('abc123')).not.toBe(cacheArchivePath('def456'));
  });
});
```

For Phase 3 the pinned-literal equivalents are `releaseAssetName('abc123', 'linux')` ->
`'abc123-linux'` (G2) and the three platform branches asserted with literals (G4), per
RESEARCH.md lines 884-886. `it.each` is available as a repo idiom -- see
`select-backend.spec.ts:67-81`.

---

### `src/lib/local-context.ts` (service / resolver, subprocess request-response)

**Analog (env tier + module conventions):** `src/lib/select-backend.ts` lines 6-24.
**Analog (env-bag-with-default convention):** `src/lib/trust.ts` lines 17-25.
**Analog (subprocess wrapper): NONE -- see "No Analog Found" below.**

**Env-bag + `||`-coalescing + comment-lock pattern** (`select-backend.ts:6-24`). This is
the function `resolveLocalReadToken` must REUSE unchanged (D-08), and its comment shows
the house style for pinning a `||`-vs-`??` decision:

```typescript
/** owner/name shape for GITHUB_REPOSITORY: one non-slash segment, a slash, one more. */
const GITHUB_REPOSITORY_PATTERN = /^[^/]+\/[^/]+$/;

/**
 * Resolve the GitHub token from runtime context: GH_TOKEN first, then
 * GITHUB_TOKEN. The chain deliberately uses the falsy-coalescing `||` (NOT the
 * nullish `??`) so a set-but-empty value falls through to the next source rather
 * than binding an empty secret (Pitfall 8; mirrors serve.ts:41-45). A later
 * reader must not "tidy" this to `??`.
 *
 * Nothing in Phase 2 sends this token anywhere -- the Actions-cache primitive
 * authenticates with its own runtime token -- but TEST-01 specifies the
 * fallthrough and Phase 3's authenticated private-repo read consumes it.
 */
export function resolveGitHubToken(
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  return env.GH_TOKEN || env.GITHUB_TOKEN || undefined;
}
```

Two concrete carry-overs for the planner:

1. `GITHUB_REPOSITORY_PATTERN` (`select-backend.ts:7`) already exists and RESEARCH.md
   line 714 says to reuse it for the D-10 env override. It is currently module-private
   (not exported). The planner must decide: export it from `select-backend.ts`, or move
   it to a shared spot. Exporting is the smaller diff; note that `select-backend.spec.ts`
   does not assert on it directly, so exporting breaks nothing.
2. The `env: NodeJS.ProcessEnv = process.env` signature with a DEFAULT is the repo-wide
   convention -- `trust.ts:17`, `select-backend.ts:21`, `select-backend.ts:37` all use it.
   `resolveLocalReadToken` and `resolveRepoIdentity` must match it (RESEARCH.md lines
   684-686, 716-718 already do).

**Signature/doc style from `trust.ts:12-25`** -- short doc, requirement ID, "Pure and
injectable -- the env bag is the sole input":

```typescript
/**
 * Default-deny write-trust predicate (TRUST-03): true only when the process runs
 * in GitHub Actions AND the triggering event is in the TRUSTED_EVENTS allowlist.
 * Pure and injectable -- the env bag is the sole input.
 */
export function isWriteTrusted(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.GITHUB_ACTIONS !== 'true') {
    return false; // not CI -> never RW
  }
  ...
}
```

`trust.ts:9` also shows the repo's `ponytail:` marker convention for a deliberate
simplification (`* ponytail: array .includes is fine at n=2.`) -- appropriate for the
Phase 3 single-shard stub (RESEARCH.md Open Question 1).

**Subprocess wrapper:** no in-repo analog. Copy RESEARCH.md Pattern 1 (lines 334-378) for
`tryHelper`, and RESEARCH.md lines 636-675 for the `spawn`-with-stdin `git credential fill`
call. Those excerpts are empirically verified on the target runtime and are the
authoritative source for this file's new ground.

---

### `src/lib/local-context.spec.ts` (test, module-mock)

**Analog (module mocking):** `src/backend/actions-cache-backend.spec.ts` lines 1-27 -- the
repo's ONLY `vi.mock` precedent, and it carries a comment explaining why module mocking is
justified. Replicate that justification comment for `vi.mock('node:child_process')`.

```typescript
import { existsSync } from 'node:fs';
import { rm, writeFile } from 'node:fs/promises';
import * as cache from '@actions/cache';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cacheArchivePath } from '../lib/cache-archive-path.js';
import {
  cacheKeyFor,
  createActionsCacheBackend,
} from './actions-cache-backend.js';

// First module mock in this repository. @actions/cache only actually works inside
// a JS action on real CI, so every unit layer MUST mock it and prove the backend
// mapping against the recorded call arguments (02-RESEARCH.md "Don't Hand-Roll";
// the spec-file table in 02-PATTERNS.md notes module mocking has no in-repo
// precedent and must come from research). vi.mock hoists above the imports and
// auto-replaces each @actions/cache export with a vi.fn().
vi.mock('@actions/cache');

const restoreCache = vi.mocked(cache.restoreCache);
const saveCache = vi.mocked(cache.saveCache);

const HASH = 'abc123';

afterEach(async () => {
  vi.resetAllMocks();
  await rm(cacheArchivePath(HASH), { force: true });
});
```

Carry over: namespace-import the mocked module (`import * as cache from ...`), bind each
mocked export via `vi.mocked(...)` at module scope, and `vi.resetAllMocks()` in `afterEach`.

**Analog (recorded-argument assertion):** `actions-cache-backend.spec.ts:123-144` -- the
exact discipline the FOUND-02 "spawned with `GIT_TERMINAL_PROMPT=0` and a `timeout`"
row needs (assert on `mock.calls[0][N]`):

```typescript
describe('createActionsCacheBackend path + key agreement (ROBUST-03)', () => {
  // Non-vacuous: the assertion below compares the RECORDED first argument of both
  // toolkit calls to each other AND to cacheArchivePath(hash) imported from the
  // helper -- so it fails if save and restore ever pass different path strings,
  // which is the silent-MISS class this backend's single-source rule exists to
  // prevent (Pitfall 7).
  it('passes exactly cacheArchivePath(hash) as the single path to both restoreCache and saveCache, with the same key (ROBUST-03)', async () => {
    ...
    const restorePaths = restoreCache.mock.calls[0][0];
    const savePaths = saveCache.mock.calls[0][0];

    expect(restorePaths).toEqual([cacheArchivePath(HASH)]);
    expect(savePaths).toEqual(restorePaths);
    expect(restoreCache.mock.calls[0][1]).toBe(cacheKeyFor(HASH));
    expect(saveCache.mock.calls[0][1]).toBe(cacheKeyFor(HASH));
  });
});
```

**Analog (no-`process.env`-mutation):** `select-backend.spec.ts:102-109` -- pins the
injected-env property structurally. Reuse verbatim for the tier-1 cases:

```typescript
it('never mutates process.env -- every case is driven by the explicit env argument (TEST-01)', () => {
  const before = JSON.stringify(process.env);

  selectBackend({ GITHUB_REPOSITORY: 'op-nx/github-cache' });
  selectBackend({ ...trusted });

  expect(JSON.stringify(process.env)).toBe(before);
});
```

---

### `src/backend/releases-backend.ts` (backend adapter, HTTP request-response)

**Analog A (the read-only shape):** `src/backend/memory-backend.ts:39-58` -- `put ->
'forbidden'` with the TRUST-05 comment. This is the exact shape D-02 asks for:

```typescript
/**
 * Read-only form of the Map-backed CacheBackend (the D-04 403 seam): put always
 * yields 'forbidden' -> the server maps it to 403. get mirrors the writable read
 * path; its store stays empty in Phase 1 (the real cross-context reader is
 * Phase 3), so get always misses here. RW-vs-RO is which factory constructs the
 * server, never a caller-facing mode flag (TRUST-05).
 */
export function createReadOnlyMemoryBackend(): CacheBackend {
  const store = new Map<string, Buffer>();

  return {
    async get(hash: string): Promise<GetResult> {
      return readFrom(store, hash);
    },

    async put(): Promise<PutResult> {
      return 'forbidden';
    },
  };
}
```

Note the zero-arg `async put(): Promise<PutResult>` -- the params are omitted entirely, not
named-and-ignored. Copy that.

**Analog B (real-backend structure, imports, single-source-helper usage):**
`src/backend/actions-cache-backend.ts:1-52`. This is the closest structural sibling --
a factory returning an object literal, deriving every key/name through one helper.

```typescript
import { readFile, rm, writeFile } from 'node:fs/promises';
import * as cache from '@actions/cache';
import { cacheArchivePath } from '../lib/cache-archive-path.js';
import type { CacheBackend, GetResult, PutResult } from './types.js';

/**
 * The project's first real storage backend (ROBUST-03, ROADMAP SC5): a
 * CacheBackend backed by GitHub's own Actions cache through the official,
 * exact-pinned @actions/cache toolkit. get maps to restoreCache, put maps to
 * saveCache, and every path string flows through the one cacheArchivePath helper
 * so save and restore always pass a byte-identical path (Pitfall 7).
 *
 * It takes NO parameters on purpose: nothing about RW-vs-RO is decided here --
 * that is the upstream write gate's job (D-01) -- and this factory must never
 * grow a mode argument (TRUST-05).
 *
 * This backend never returns 'forbidden' (403 is the read-only backend's job) and
 * never returns 'conflict' (409 belongs to the contract layer, and to Phase 4 for
 * the mirror), so a reader should not go looking for those branches here.
 */
export function createActionsCacheBackend(): CacheBackend {
  return {
    async get(hash: string): Promise<GetResult> {
      const path = cacheArchivePath(hash);
      const matched = await cache.restoreCache([path], cacheKeyFor(hash));

      if (matched === undefined) {
        return { kind: 'miss' };
      }
      ...
```

Structural facts to carry over:
- Import order: `node:` builtins, then packages, then `../lib/*.js` helpers, then
  `import type { ... } from './types.js'` LAST.
- `.js` extension on every relative import (NodeNext resolution).
- Doc block names the requirement IDs, then an explicit "must never grow a mode argument
  (TRUST-05)" paragraph, then a "what this backend deliberately does NOT do" paragraph.
  `releases-backend.ts` needs the mirror of that third paragraph: it never returns
  'stored' or 'conflict', and its `get` swallows faults while Phase 4's cleanup must not
  (RESEARCH.md Pitfall 7, lines 593-600).
- The `PutResult` type is imported even when only `'forbidden'` is returned.

**Analog C (a `cacheKeyFor`-style exported name derivation)** `actions-cache-backend.ts:6-15`
-- the precedent for exporting a small derivation helper from the backend module so the
spec can assert against it. Relevant if the shard-tag stub lives in the backend file:

```typescript
/**
 * Actions-cache key for a task hash. The key space is the same bounded
 * lowercase-hex space the server already validates (HASH_PATTERN
 * ^[a-f0-9]{1,512}$), and the `nx-cache-` prefix keeps these entries
 * distinguishable from unrelated CI cache keys. Hardening this prefix into an
 * enforced server-produced-key filter is Phase 5 / TRUST-08.
 */
export function cacheKeyFor(hash: string): string {
  return `nx-cache-${hash}`;
}
```

**The `get` body** comes from RESEARCH.md Pattern 3 (lines 438-469) -- one `try/catch` at
the port boundary. No in-repo analog for the catch-everything-degrade shape; the closest
is `actions-cache-backend.ts:72-77`, which does the OPPOSITE (rethrows anything unknown so
the write path fails closed). That asymmetry is worth a comment in the new file.

---

### `src/backend/releases-backend.spec.ts` (test, request-response)

**Analog:** `src/backend/actions-cache-backend.spec.ts` in full (see excerpts above for the
`vi.mock` header, the recorded-argument G3 assertion, and the `afterEach` reset).

Additional idioms to copy from that file:
- `const HASH = 'abc123';` at module scope; but see `select-backend.spec.ts:15-20` -- if
  the spec touches a SHARED resource, the hash must be unique per spec file:

```typescript
// A hash UNIQUE to this spec: the writable-path cases drive the Actions backend's
// put, which writes cacheArchivePath(HASH) to the shared tmpdir. Vitest runs spec
// files in parallel workers that share the filesystem, so reusing another spec's
// hash (e.g. actions-cache-backend.spec.ts's 'abc123') would race on the same
// temp file. Keep this value distinct from every other spec's hash.
const HASH = 'selectbackendfixture';
```

  `releases-backend.spec.ts` touches no filesystem, so `'abc123'` is safe -- but the
  planner should say so explicitly rather than leaving it to chance.
- `describe` blocks are grouped by SUT method with the requirement ID in the title:
  `describe('createActionsCacheBackend get (ROBUST-03)', ...)`,
  `describe('createActionsCacheBackend put (ROBUST-03)', ...)`,
  `describe('createActionsCacheBackend path + key agreement (ROBUST-03)', ...)`.
- `expect(result).toEqual({ kind: 'miss' })` -- assert the WHOLE `GetResult` object, not
  just `result.kind` (`actions-cache-backend.spec.ts:38,61`).
- Every non-obvious test carries a `// Non-vacuous: ...` comment explaining what would
  still pass if the assertion were weaker (`actions-cache-backend.spec.ts:125-128`,
  `select-backend.spec.ts:184-188`, `select-backend.spec.ts:193-198`). The TEST-05
  never-wrong-OS negative assertion NEEDS one of these -- RESEARCH.md line 903 makes the
  same point ("a positive-only test passes even if namespacing is removed entirely").

The TEST-05 fake client needs no mocking framework at all (RESEARCH.md lines 833-836,
894-898) -- a plain object over a `Map`. That is simpler than the `vi.mock` analog and is
the correct choice for the backend spec; `vi.mock`/`vi.spyOn(globalThis, 'fetch')` is only
needed for the REST-sequence and fault-matrix tests of the DEFAULT client.

---

### `src/lib/cross-os-invariants.spec.ts` (test, file-I/O) -- optional, G1 only

**Analog:** `src/pinned-deps.spec.ts` -- the repo's only "read a repo file and assert on
its contents" guard spec. Near-identical use case (G1: assert `.gitattributes` still
contains `* text=auto eol=lf`).

```typescript
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * ROBUST-03(a): the toolkit runtime dependencies MUST stay pinned to an exact
 * version (bare `x.y.z`), never a range (`^`/`~`/`>=`). This is a security
 * control, not a style rule: `@actions/cache` version-hashes the LITERAL archive
 * path and its compression choice into the restore key, so a silent minor/patch
 * bump behind a range operator can MISS every restore with no error -- and the
 * only end-to-end verification of a bump is the CI dogfood canary (Plan 06).
 * ...
 * This spec fails the build the moment either specifier widens to a range.
 */
describe('pinned toolkit dependencies (ROBUST-03)', () => {
  const manifest = JSON.parse(
    readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
  ) as { dependencies?: Record<string, string> };

  const EXACT_SEMVER = /^\d+\.\d+\.\d+$/;

  it('@actions/cache is pinned to an exact version, never a range (ROBUST-03)', () => {
    const specifier = manifest.dependencies?.['@actions/cache'];

    expect(specifier).toMatch(EXACT_SEMVER);
  });
});
```

Concrete carry-overs:
- **Path resolution idiom:** `new URL('<relative>', import.meta.url)` passed straight to
  `readFileSync` -- NOT `join(__dirname, ...)`, NOT `process.cwd()`. From
  `src/lib/`, the repo-root `.gitattributes` is `new URL('../../../../.gitattributes',
  import.meta.url)` (src/lib -> src -> github-cache -> packages -> repo root). The planner
  should have the executor VERIFY the depth by running the test, not by counting -- and
  should prefer placing this spec where the relative depth is least surprising.
- Read at `describe` scope, assert inside `it` -- the analog does the read once outside
  the test bodies.
- The doc block states the failure mode ("fails the build the moment...") in the same
  register.

**Verified current content of `.gitattributes`** (repo root) -- the guard's target exists
and is correct today:

```
# Normalize line endings to LF on checkout across every platform. Nx task hashes
# hash file CONTENTS, so a Windows checkout (GitHub runners default to
# core.autocrlf=true) would get CRLF and compute different hashes than Linux/macOS
# -- breaking cross-OS cache hits and local cache hits for any target that runs on
# Windows CI (e.g. the `integration` matrix leg). Forcing LF keeps the bytes -- and
# therefore the hashes -- identical everywhere.
* text=auto eol=lf
```

**Lazier alternative** (RESEARCH.md line 1029 flags it, and it is the better call): fold G1
into `release-asset-name.spec.ts` rather than create a fourth spec file. Both guards are
"the cross-OS key scheme must not silently drift"; one file is fewer moving parts.

---

### `src/lib/select-backend.ts` (EDIT, lines 40-42) (factory / composition)

**Analog:** the file itself. The edit replaces exactly three lines; everything around them
is the pattern and must be preserved byte-for-byte.

**Current state** (`select-backend.ts:36-62`) -- the placeholder to replace is lines 40-42:

```typescript
export function selectBackend(
  env: NodeJS.ProcessEnv = process.env,
): CacheBackend {
  if (!isWriteTrusted(env)) {
    // Phase 3 placeholder for the real cross-context Releases reader: today the
    // read-only backend's store is empty, so get always misses (put -> 403).
    return createReadOnlyMemoryBackend();
  }

  if (!GITHUB_REPOSITORY_PATTERN.test(env.GITHUB_REPOSITORY ?? '')) {
    // Fail-closed construction guard (server.ts:62-66 precedent): a corrupted
    // repository identity in a write-trusted context must fail loudly rather than
    // resolve into some other repository's cache namespace.
    throw new Error(
      'selectBackend: GITHUB_REPOSITORY must be a valid owner/name in a write-trusted context (TEST-01)',
    );
  }

  if (resolveGitHubToken(env) === undefined) {
    // Degrade, do NOT throw: a merely-unwired workflow token must not break the
    // build. A malformed repository identity (above) is a misconfiguration and
    // does throw; an absent token is just a not-yet-write-capable context.
    return createReadOnlyMemoryBackend();
  }

  return createActionsCacheBackend();
}
```

Hard constraints the edit must respect:
- **`selectBackend` stays SYNCHRONOUS and stays at `length === 0`.** It returns
  `CacheBackend`, not `Promise<CacheBackend>`, and is called synchronously at
  `serve.ts:82` (`const backend = selectBackend(process.env);`). Since
  `resolveLocalReadToken` and `resolveRepoIdentity` are ASYNC (RESEARCH.md lines 684, 716),
  the async resolution CANNOT happen at construction time -- it must happen lazily inside
  the default client's `fetchAsset`, or the backend factory must accept an already-built
  client. This is the single highest-risk integration detail in the phase and the planner
  must resolve it explicitly. `select-backend.spec.ts:189` pins `selectBackend.length === 0`;
  the `serve.ts:82` call site pins the synchronous return.
- The line-58 `createReadOnlyMemoryBackend()` call (the trusted-but-no-token degrade path)
  stays as-is. Only the line-42 call is replaced. If `createReadOnlyMemoryBackend` remains
  the only consumer at line 58, the import at line 2 stays.
- The inline comment above the replaced return must be REWRITTEN, not deleted -- the file's
  convention is that every early return carries a WHY comment (lines 40-41, 45-48, 54-57).

---

### `src/lib/select-backend.spec.ts` (EDIT)

**Analog:** the file itself.

The test that MUST be updated (`select-backend.spec.ts:95-100`) currently asserts the
placeholder's behavior -- an empty store always missing. Once the real reader is wired,
`get` will attempt a resolution:

```typescript
it('a local developer machine (no GITHUB_ACTIONS) yields a read-only backend: put forbidden and get misses (TEST-01)', async () => {
  const backend = selectBackend({ GITHUB_REPOSITORY: 'op-nx/github-cache' });

  expect(await backend.put(HASH, BYTES)).toBe('forbidden');
  expect(await backend.get(HASH)).toEqual({ kind: 'miss' });
});
```

The `put -> 'forbidden'` half stays true by construction (D-02). The `get -> miss` half
becomes a live-ish path -- in a unit test with no token and no network it should still MISS
(D-09 + D-11), which makes it a genuinely stronger assertion than before, but the planner
must ensure it does not spawn `gh`/`git` or reach the network during `nx test`. Either mock
`node:child_process` in this spec too, or drive the case through an env bag that
short-circuits (the tier-1 token path) plus a mocked `fetch`.

**Must NOT change** (`select-backend.spec.ts:182-214`) -- the TRUST-05 pair. Both remain
valid and both must still pass verbatim after the edit:

```typescript
describe('TRUST-05: no caller-facing mode surface', () => {
  it('structural: selectBackend.length is 0 -- its single declared parameter has a default (TRUST-05)', () => {
    // Non-vacuous: Function.length counts parameters BEFORE the first default.
    // selectBackend declares exactly one parameter (env) and it carries a default
    // (= process.env), so length is 0 -- a caller has no required argument and no
    // second parameter to pass. If someone added a `mode`/options parameter to
    // request the writable backend, this count would change and the test fails.
    expect(selectBackend.length).toBe(0);
  });

  it('behavioral: an untrusted env bag carrying override-shaped extra keys still yields a forbidden put (TRUST-05)', async () => {
    // Non-vacuous: NOT an identity check against a factory (a smuggled flag could
    // pass that while still returning the writable backend). We spread several
    // plausible mode-switch keys onto an UNTRUSTED env and drive the REAL put; if
    // any of them could steer the decision, put would not be 'forbidden'. ...
```

Also unchanged and reusable: the `trusted` fixture (`lines 26-31`) and the
`satisfies NodeJS.ProcessEnv` idiom.

---

### `src/index.ts` (EDIT -- probably NOT needed)

**Analog:** the file itself (10 lines, full content):

```typescript
// Public barrel for @op-nx/github-cache (minimal for Phase 1; Phase 6 owns the
// enumerated, tested public surface). Exposes the Nx-contract server factory and
// the CacheBackend port types so consumers can supply their own backend adapter.
export { createCacheServer } from './server/server.js';
export type {
  CacheBackend,
  GetHit,
  GetResult,
  PutResult,
} from './backend/types.js';
```

Conventions: value exports first as a named `export { X } from './path.js'`, then a single
grouped `export type { ... }` block. Every path carries `.js`.

**Recommendation: do not touch this file in Phase 3.** The comment states Phase 6 owns the
enumerated public surface, and nothing in CONTEXT.md or RESEARCH.md identifies a Phase 3
consumer outside the package. `selectBackend`, `createActionsCacheBackend`,
`cacheArchivePath`, and `isWriteTrusted` are all NOT exported today despite being
cross-module -- so an unexported `releaseAssetName` / `createReleasesReadBackend` matches
the established precedent. Phase 4's publisher is in the same package and imports directly.
If the planner disagrees, the change is two lines -- but it should be a deliberate
decision, not incidental.

---

## Shared Patterns

### Comment discipline: every non-obvious line explains WHY, with a requirement ID

**Source:** every file in `src/` -- `trust.ts:1-9`, `select-backend.ts:9-19`,
`memory-backend.ts:39-45`, `actions-cache-backend.ts:6-31`, `serve.ts:55-64`.
**Apply to:** all new files.

The house pattern is a JSDoc block that: (1) states what the thing is plus its
requirement ID in parentheses, (2) explains the load-bearing mechanism, (3) explicitly
warns off a future "tidying" edit. Inline `//` comments inside function bodies explain
each early return and each non-obvious branch. Two verbatim examples of the warn-off
sentence, which the planner should require in the new single-source helper:

```typescript
// select-backend.ts:14 -- "A later reader must not "tidy" this to `??`."
// cache-archive-path.ts:14-16 -- "Never touch this path without re-verifying an
//   end-to-end restore in CI; the failure mode is a silent MISS, not a crash."
```

### Test naming: `('<behavior sentence> (<REQ-ID>)')`

**Source:** every spec file. `actions-cache-backend.spec.ts:30`, `select-backend.spec.ts:45`,
`cache-archive-path.spec.ts:15`, `pinned-deps.spec.ts:22`.
**Apply to:** all new spec files.

```typescript
it('returns a hit with the restored archive bytes when restoreCache matches a key (ROBUST-03)', async () => {
it('CI + push yields a writable backend whose put is not forbidden (TEST-01)', async () => {
it('produces exactly the file name nx-github-cache-abc123.tar for hash abc123 (ROBUST-03)', () => {
```

Phase 3 IDs to use in titles: `CORR-01`, `FOUND-02`, `TEST-05`, `TRUST-05`, `SRV-05`.

### `// Non-vacuous:` justification on every guard test

**Source:** `actions-cache-backend.spec.ts:125-128`, `select-backend.spec.ts:184-188`,
`select-backend.spec.ts:193-198`, `cache-archive-path.spec.ts:6-13`.
**Apply to:** every TEST-05 guard (G1-G4) and every D-11 fault-matrix test.

`select-backend.spec.ts:196-198` names the reason this convention exists in this repo:

```typescript
// This repo has already shipped a tautological security test (01-REVIEW.md WR-01);
// this half exists so that failure mode cannot recur for TRUST-05.
```

### Factory functions returning object literals -- never classes

**Source:** `memory-backend.ts:19`, `memory-backend.ts:46`, `actions-cache-backend.ts:32`.
**Apply to:** `createReleasesReadBackend`.

There is no `class` anywhere in `packages/github-cache/src`. Every backend is
`export function createXBackend(...): CacheBackend { return { async get(...) {...}, async
put(...) {...} }; }`. Methods are declared as `async get(hash: string): Promise<GetResult>`
inside the returned literal -- not as arrow properties. The one exception is the decorator
in `serve.ts:83-97`, which uses arrow properties because it is delegating.

### Import ordering and `.js` extensions

**Source:** `actions-cache-backend.ts:1-4`, `select-backend.ts:1-4`,
`actions-cache-backend.spec.ts:1-9`.
**Apply to:** all new files.

```typescript
import { readFile, rm, writeFile } from 'node:fs/promises';   // 1. node: builtins
import * as cache from '@actions/cache';                       // 2. packages
import { cacheArchivePath } from '../lib/cache-archive-path.js'; // 3. relative helpers
import type { CacheBackend, GetResult, PutResult } from './types.js'; // 4. type-only, last
```

In specs, `vitest` sorts with the packages (`actions-cache-backend.spec.ts:4`), and the SUT
import comes last.

### Injected `env` bag with a `process.env` default

**Source:** `trust.ts:17`, `select-backend.ts:21`, `select-backend.ts:37`.
**Apply to:** `resolveLocalReadToken`, `resolveRepoIdentity`.

```typescript
export function isWriteTrusted(env: NodeJS.ProcessEnv = process.env): boolean {
export function resolveGitHubToken(env: NodeJS.ProcessEnv = process.env): string | undefined {
export function selectBackend(env: NodeJS.ProcessEnv = process.env): CacheBackend {
```

The default is what keeps `Function.length === 0` (the TRUST-05 structural pin) -- a
required parameter would break it.

### `||` not `??` for any credential/token fallback

**Source:** `select-backend.ts:23` (with the lock comment at lines 11-14),
`serve.ts:70-73` (with its own lock comment at lines 62-64),
`select-backend.spec.ts:167-171` (the test that pins it).
**Apply to:** every tier in `resolveLocalReadToken`.

```typescript
// select-backend.ts:23
return env.GH_TOKEN || env.GITHUB_TOKEN || undefined;

// serve.ts:70-73
const token =
  options.token ||
  process.env.NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN ||
  generateToken();

// select-backend.spec.ts:167-171 -- the pinning test
it('falls through a set-but-EMPTY GH_TOKEN to GITHUB_TOKEN (|| not ??, Pitfall 8) (TEST-01)', () => {
  // If the impl used `??`, the empty string would bind and shadow GITHUB_TOKEN,
  // producing '' instead of 'b'. The || operator is load-bearing here.
  expect(resolveGitHubToken({ GH_TOKEN: '', GITHUB_TOKEN: 'b' })).toBe('b');
});
```

Note `stdout.trim() || undefined` in RESEARCH.md's `tryHelper` (line 374) is the same
idiom applied to subprocess output -- consistent with the repo.

---

## No Analog Found

Files/sections with no close match in the codebase. The planner should use RESEARCH.md
patterns instead -- all three are empirically verified there.

| File / Section | Role | Data Flow | Reason | Use Instead |
|----------------|------|-----------|--------|-------------|
| `local-context.ts` -- the `execFile`/`spawn` wrapper | utility | subprocess | **The repo spawns no subprocesses at all.** Verified: no `child_process` import anywhere in `packages/github-cache/src`. RESEARCH.md line 126 states the same ("spawning subprocesses, which has no in-repo precedent"). | RESEARCH.md Pattern 1, lines 334-378 (`tryHelper`, four load-bearing options) and lines 636-675 (`spawn` + stdin for `git credential fill`). Both empirically verified on Node 24.13.0 win32/arm64. |
| `releases-backend.ts` -- the one-time stderr warning | utility | event | No `process.stderr.write`, `console.warn`, or `core.warning` exists anywhere in `packages/`. The only console output precedent is `process.stdout.write` at `serve.ts:144-145` -- wrong stream and not one-time. | RESEARCH.md lines 872-874 (module-level `warned` flag, stderr, plain ASCII, no token, silent on the ordinary 404). Model the write call on `serve.ts:144`'s `process.stdout.write(...)` form, switched to `process.stderr.write`. |
| `releases-backend.spec.ts` -- mocked global `fetch` | test | request-response | No spec mocks `fetch`. `serve.spec.ts` uses REAL `fetch` against a real loopback server (integration style), which is the opposite approach. | RESEARCH.md line 1015: `vi.spyOn(globalThis, 'fetch')` returning crafted `Response` objects. The `vi.mocked(...)`-at-module-scope + `vi.resetAllMocks()` housekeeping from `actions-cache-backend.spec.ts:19-27` still transfers. |

---

## Planner Notes (highest-value, non-obvious)

1. **`selectBackend` is synchronous; the new resolvers are async.** `serve.ts:82` calls it
   synchronously and `select-backend.spec.ts:189` pins `selectBackend.length === 0`. The
   async token/repo-identity resolution must be deferred into the client's `fetchAsset`,
   not awaited at construction. This is the one integration detail with no analog to lean
   on and the most likely source of a rework loop.
2. **`GITHUB_REPOSITORY_PATTERN` (`select-backend.ts:7`) is module-private.** Reusing it
   for D-10 (RESEARCH.md line 714) requires exporting it or duplicating it. Exporting is
   the smaller diff and breaks no test.
3. **`createReadOnlyMemoryBackend` stays in use** at `select-backend.ts:58` (the
   trusted-but-no-token degrade). Do not delete it or its import when replacing line 42.
4. **Fold the G1 `.gitattributes` guard into `release-asset-name.spec.ts`** rather than
   adding a fourth spec file -- RESEARCH.md line 1029 already offers this, and it avoids
   a spec whose only content is one `readFileSync`.
5. **Do not touch `src/index.ts`.** Nothing in Phase 3 has an out-of-package consumer, and
   the barrel's own comment reserves the enumerated surface for Phase 6.

## Metadata

**Analog search scope:** `packages/github-cache/src/**` (all 20 source + spec files),
repo-root `.gitattributes`
**Files scanned:** 12 read in full (`cache-archive-path.ts`, `cache-archive-path.spec.ts`,
`select-backend.ts`, `select-backend.spec.ts`, `memory-backend.ts`,
`actions-cache-backend.ts`, `actions-cache-backend.spec.ts`, `types.ts`, `trust.ts`,
`serve.ts`, `pinned-deps.spec.ts`, `index.ts`) + full-tree listing + a repo-wide search
for stderr/warn precedent
**Pattern extraction date:** 2026-07-19
