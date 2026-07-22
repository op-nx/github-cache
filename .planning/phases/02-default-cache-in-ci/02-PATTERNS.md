# Phase 2: Default Cache in CI - Pattern Map

**Mapped:** 2026-07-19
**Files analyzed:** 16 (12 new, 4 modified)
**Analogs found:** 13 / 16 (3 have no in-repo analog - use RESEARCH.md patterns)

Phase 1 left unusually strong seams: the `CacheBackend` port, a writable AND a
read-only factory, an exhaustive `PutResult`->status map, and a composition root
with the backend construction isolated to one line. Almost every Phase 2 file has
a direct in-repo shape to copy. The three exceptions (`with-hash-lock.ts`, the
action manifest, the action entry) are genuinely new territory.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/lib/trust.ts` | utility (pure predicate) | transform (env -> bool) | `src/server/server.ts` (module const + pure fn) | partial |
| `src/lib/trust.spec.ts` | test | - | `src/backend/memory-backend.spec.ts` | role-match |
| `src/lib/select-backend.ts` | factory / composition | transform (env -> backend) | `src/backend/memory-backend.ts` + `src/serve.ts` | role-match |
| `src/lib/select-backend.spec.ts` | test | - | `src/backend/memory-backend.spec.ts` | role-match |
| `src/lib/with-hash-lock.ts` | utility (concurrency) | event-driven (promise coord) | **none** | none |
| `src/lib/with-hash-lock.spec.ts` | test | - | existing specs (structure only) | partial |
| `src/lib/cache-archive-path.ts` | utility (path helper) | file-I/O | `src/server/server.ts` (comment-locked const) | partial |
| `src/backend/actions-cache-backend.ts` | backend adapter | file-I/O + request-response | `src/backend/memory-backend.ts` | role-match |
| `src/backend/actions-cache-backend.spec.ts` | test | - | `src/server/server.spec.ts` (inline spy) | role-match |
| `src/backend/read-only-backend.ts` | backend adapter | request-response | `createReadOnlyMemoryBackend()` | **exact (likely reuse - do not create)** |
| `src/serve.ts` (modify) | composition root | request-response | itself (:54, :56-58) | exact (self) |
| `src/serve.spec.ts` (extend) | test | - | itself + `server.spec.ts` spy | exact (self) |
| `action.yml` | config (action manifest) | - | **none** | none |
| `src/action/index.cjs` | entry-point / script | batch | **none** | none |
| `packages/github-cache/package.json` (modify) | config | - | itself (`"dependencies": {}`) | exact (self) |
| `.github/workflows/ci.yml` (modify) | config (CI job) | - | itself (`integration` job :89-102) | role-match |

**Two of the listed "new files" probably should not exist.** See "Files That May
Not Need To Exist" below before planning tasks for them.

## Pattern Assignments

### `src/lib/trust.ts` (utility, transform)

**Analog:** `src/server/server.ts` - for the *convention* (exported module const +
doc-comment that names the requirement ID), not the logic. No predicate exists yet.

**Comment-locked exported constant** (`server.ts:7-16`) - copy this shape for
`TRUSTED_EVENTS`: a `/** ... */` that names the requirement ID and the reason:

```typescript
/** Bounded lowercase-hex task hash (SRV-03); the Actions-cache key space (TRUST-08). */
const HASH_PATTERN = /^[a-f0-9]{1,512}$/;

/** Max PUT body (SRV-04): 2 GiB = 2,147,483,648 bytes. */
export const MAX_CACHE_BODY_BYTES = 2 * 1024 * 1024 * 1024;

/** Per-process CSPRNG bearer token (SRV-02); never Math.random or a timestamp. */
export function generateToken(): string {
  return randomBytes(32).toString('hex');
}
```

`MAX_CACHE_BODY_BYTES` is the precedent for a load-bearing constant that is both
exported AND pinned by its own test (`server.spec.ts:104-107` asserts the exact
value twice). `TRUSTED_EVENTS` deserves the same treatment - it is the CREEP
control surface, so a test asserting the array is exactly `['push','schedule']`
is what stops a careless Phase 5 widening from landing early.

**Implementation:** RESEARCH.md Pattern 1 gives the exact body. Two things it gets
right that must survive: the `env.GITHUB_ACTIONS !== 'true'` early return with a
blank line after it (house style, see below), and `env.GITHUB_EVENT_NAME ?? ''`
(here `??` is correct - an unset event is not a trusted event either way).

---

### `src/lib/select-backend.ts` (factory / composition, transform)

**Analog:** `src/backend/memory-backend.ts` for the "exported function returns a
`CacheBackend`" shape; `src/serve.ts:49-53` for the env-reading convention.

**Import pattern** (`memory-backend.ts:1`) - note `import type` for type-only, and
the explicit `.js` on the relative specifier (ESM `nodenext`, non-negotiable):

```typescript
import type { CacheBackend, GetResult, PutResult } from './types.js';
```

From `src/lib/`, the backend imports become `../backend/types.js`,
`../backend/memory-backend.js`, `../backend/actions-cache-backend.js`.

**The `||`-not-`??` env fallthrough** (`serve.ts:49-53`) - LOAD-BEARING (Pitfall 8).
`selectBackend` resolves `GH_TOKEN || GITHUB_TOKEN` and TEST-01 explicitly asserts a
set-but-empty `GH_TOKEN` falls through. Copy the operator choice exactly:

```typescript
const port = resolvePort(options.port ?? process.env.PORT);
const token =
  options.token ||
  process.env.NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN ||
  generateToken();
```

serve.ts:41-45 documents *why* in a doc-comment ("The token env fallback uses `||`
(not `??`) so a set-but-empty value falls through ... (Pitfall 8)"). Mirror that
comment on the token resolution in `selectBackend` - it is the difference between a
future reader "tidying" it to `??` or not.

**Validation-before-construction:** `GITHUB_REPOSITORY` must be format-validated
(`^[^/]+/[^/]+$`) and reject fail-closed in trusted context. The in-repo precedent
for a construction-time fail-closed guard is `server.ts:62-66`:

```typescript
if (!token || !token.trim()) {
  throw new Error(
    'createCacheServer: a non-empty bearer token is required (SRV-02)',
  );
}
```

Same shape: guard at the top of the factory, throw with a message naming the
function and the requirement ID.

**Implementation:** RESEARCH.md Pattern 1. TRUST-05's no-flag property is
structural - the signature takes only `env`, so keep it that way.

---

### `src/lib/with-hash-lock.ts` (utility, event-driven)

**Analog: NONE.** No module-level-state concurrency primitive exists in this
codebase. `memory-backend.ts` closes over a `Map` inside a factory, which is a
*different* shape (per-instance, not module-global) and should NOT be copied here -
the lock must be process-wide to serialize across every request.

**Use RESEARCH.md Pattern 3 verbatim.** It already encodes the four TEST-02
properties (chain with `.then(run, run)`; store the non-rejecting `tail` but return
the real `result`; evict only on `inFlight.get(hash) === tail`). Getting any one of
those wrong is a silent wedge - do not "simplify" it.

The only in-repo convention it must pick up is the `ponytail:` ceiling comment
style, which RESEARCH already drafts:

```typescript
// ponytail: global in-process map. Ceiling = single-process / ephemeral single-
// tenant runner (the documented deployment). A distributed lock is out of scope;
// upgrade path is a shared coordinator only if multi-process writers ever appear.
```

**Where it attaches - IMPORTANT, this is not obvious:** the write path
`withHashLock` wraps is `server.ts:197` (`result = await backend.put(hash, bytes)`),
but RESEARCH marks `server.ts` as UNCHANGED. So the lock must NOT go inside the
server. It goes in a `put`-decorating wrapper applied at composition in `serve.ts`,
between `selectBackend(...)` and `createCacheServer(...)`. See the `serve.ts`
assignment below - that same wrapper is also where SIGTERM in-flight tracking hooks,
so one wrapper serves both D-03 and ROBUST-04.

---

### `src/lib/cache-archive-path.ts` (utility, file-I/O)

**Analog:** `src/server/server.ts:7-11` for the comment-locked-constant convention.
No `node:os`/`node:path` usage exists anywhere in the repo yet.

**Implementation:** RESEARCH.md Pattern 2. The comment is the deliverable as much as
the code - it is the only thing standing between a future "tidy" and a silent
total-MISS:

```typescript
// LOAD-BEARING, comment-locked (Pitfall 7 / ROBUST-03). @actions/cache version-
// hashes the LITERAL path string. Never inline, reformat, or "tidy" this path
// without re-verifying an end-to-end restore in CI -- a change is a silent MISS.
function cacheArchivePath(hash: string): string {
  return join(tmpdir(), `nx-github-cache-${hash}.tar`);
}
```

**Separate module vs. private function - planner call.** RESEARCH Pattern 2
co-locates it as a *private* function inside `actions-cache-backend.ts`; the phase
prompt lists it as its own `lib/` module. The tiebreaker is testability: as a
separate exported module you can pin the exact produced string in a spec (the
`MAX_CACHE_BODY_BYTES` precedent at `server.spec.ts:104-107`), which is a real guard
against the silent-MISS class this whole helper exists to prevent. As a private
function it is only reachable through mocked `@actions/cache` call-argument
assertions. Recommend the separate module *only* if you write that pinned-string
test; otherwise inline it per RESEARCH and assert the path via the mock's call args.

---

### `src/backend/actions-cache-backend.ts` (backend adapter, file-I/O + request-response)

**Analog:** `src/backend/memory-backend.ts` - the strongest analog in the phase. Same
port, same factory shape, same return-variant vocabulary.

**The port it must satisfy** (`backend/types.ts:1-13`, unchanged):

```typescript
export type PutResult = 'stored' | 'conflict' | 'forbidden';

export interface GetHit {
  readonly kind: 'hit';
  readonly bytes: Buffer;
}

export type GetResult = GetHit | { readonly kind: 'miss' };

export interface CacheBackend {
  get(hash: string): Promise<GetResult>;
  put(hash: string, bytes: Buffer): Promise<PutResult>;
}
```

**Factory shape to copy** (`memory-backend.ts:19-37`) - exported `create*Backend()`
returning an object literal with `async get` / `async put`, explicit return types on
both, doc-comment above naming the requirement:

```typescript
export function createWritableMemoryBackend(): CacheBackend {
  const store = new Map<string, Buffer>();

  return {
    async get(hash: string): Promise<GetResult> {
      return readFrom(store, hash);
    },

    async put(hash: string, bytes: Buffer): Promise<PutResult> {
      if (store.has(hash)) {
        return 'conflict';
      }

      store.set(hash, bytes);

      return 'stored';
    },
  };
}
```

**Hit/miss construction** (`memory-backend.ts:3-11`) - the exact `GetResult` shapes,
including the blank line before each `return`:

```typescript
function readFrom(store: Map<string, Buffer>, hash: string): GetResult {
  const bytes = store.get(hash);

  if (bytes === undefined) {
    return { kind: 'miss' };
  }

  return { kind: 'hit', bytes };
}
```

**Implementation:** RESEARCH.md Pattern 2. Two D-04 notes to preserve at the return
site: the `-1`-is-benign comment, and the fact this backend never returns
`'forbidden'` (403 belongs to the RO backend) nor `'conflict'` (409 is the memory /
contract layer, and Phase 4 for the mirror).

---

### `src/backend/read-only-backend.ts` (backend adapter, request-response)

**Analog:** `createReadOnlyMemoryBackend()` (`memory-backend.ts:46-58`) - and the
analog is very likely the *answer*, not a template. See "Files That May Not Need To
Exist".

```typescript
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

Note `async put()` takes NO parameters - a deliberate signature-level signal that
the arguments are unreachable. Its doc-comment (`memory-backend.ts:39-45`) already
states the Phase 3 hand-off ("its store stays empty in Phase 1 (the real cross-context
reader is Phase 3), so get always misses here"), which is exactly Phase 2's need.

---

### `src/serve.ts` (MODIFY - composition root)

**Analog:** itself. Three edits, all localized.

**Edit 1 - the backend swap** (`serve.ts:54`). Current:

```typescript
const server = createCacheServer(createWritableMemoryBackend(), token);
```

Becomes `selectBackend(process.env)` wrapped by the put-decorator (below). Drop the
now-unused `createWritableMemoryBackend` import at `serve.ts:4` - `noUnusedLocals`
is on in the strict base config, and `fallow dead-code --fail-on-issues` gates CI
(`ci.yml:33-42`), so a stale import fails the build twice over. The writable memory
backend stays exported for tests/dev; only `serve.ts` stops importing it.

**Edit 2 - the put-decorating wrapper.** This is the single composition point where
D-03 (`withHashLock`) and ROBUST-04 (in-flight tracking) both attach, keeping
`server.ts` untouched:

```typescript
// sketch - the planner owns the final shape
const inFlightPuts = new Set<Promise<unknown>>();
const backend = selectBackend(process.env);
const tracked: CacheBackend = {
  get: (hash) => backend.get(hash),
  put: (hash, bytes) => {
    const op = withHashLock(hash, () => backend.put(hash, bytes));
    inFlightPuts.add(op);
    void op.catch(() => undefined).finally(() => inFlightPuts.delete(op));

    return op;
  },
};
const server = createCacheServer(tracked, token);
```

One wrapper, both requirements. A separate `lib/track-in-flight.ts` module for this
would be an abstraction with one caller - inline it in `serve.ts` unless a spec needs
it importable.

**Edit 3 - the SIGTERM handler**, attached after `listen()` resolves
(`serve.ts:56-58`), before the `RunningServer` return (`serve.ts:62-67`):

```typescript
await new Promise<void>((resolve) => {
  server.listen(port, '127.0.0.1', () => resolve());
});
```

RESEARCH.md Pattern 4 gives the bounded-drain body. The bound is load-bearing: the
runner sends SIGTERM then SIGKILL, and an unbounded await deadlocks the implicit
`wait-all`. Return the handler (or its registration) on `RunningServer` so the
ROBUST-04 spec can trigger it deterministically without a real OS signal - the
existing `RunningServer` interface (`serve.ts:14-19`) is the place to add it.

**Preserve verbatim:** the `resolvePort` 0-fallback (`serve.ts:26-34`), the `||`
token fallthrough (`:49-53`), the `127.0.0.1` bind (`:57`), and the
`pathToFileURL` entry guard (`:77-85`, permanently-false-on-Windows trap). All four
are pitfall-locked and unrelated to this phase.

---

### Spec files (all)

**Analogs:** `memory-backend.spec.ts` (pure-unit shape), `server.spec.ts` (fakes +
teardown), `serve.spec.ts` (production-path assertions).

**Import + describe/it structure** (`memory-backend.spec.ts:1-24`) - named Vitest
imports even though `globals: true` is set, `describe` per exported factory, one
fresh instance per `it`, arrange/act/assert separated by blank lines:

```typescript
import { describe, expect, it } from 'vitest';
import {
  createReadOnlyMemoryBackend,
  createWritableMemoryBackend,
} from './memory-backend.js';

describe('createWritableMemoryBackend', () => {
  it('put stores a new hash and returns "stored"', async () => {
    const backend = createWritableMemoryBackend();

    const result = await backend.put('abc123', Buffer.from('tar-bytes'));

    expect(result).toBe('stored');
  });
```

**Test names carry the requirement ID in parentheses** - the established convention
across all three spec files: `'put always yields "forbidden" (the 403 read-only seam,
D-04)'`, `'returns 401 when the Authorization header is missing (SRV-02)'`. Phase 2
specs should name TEST-01 / TEST-02 / TRUST-03 / TRUST-05 / ROBUST-04 the same way -
this is what makes the requirements traceable in the verification pass.

**Inline fake `CacheBackend`** (`server.spec.ts:111-124`) - hand-rolled object with a
captured flag, no `vi.fn()`. Copy this for `select-backend.spec.ts` (asserting which
backend came back) rather than reaching for mocking utilities:

```typescript
let called = false;
const spy: CacheBackend = {
  get: async () => {
    called = true;

    return { kind: 'miss' };
  },
  put: async () => {
    called = true;

    return 'stored';
  },
};
```

**Guarded `afterEach` teardown** (`serve.spec.ts:11-15`, identical at
`server.spec.ts:21-25`) - required in any spec that starts a server (i.e. the
extended `serve.spec.ts`). The guard exists because an `it.only` or a reorder would
otherwise mask the real failure with a `Cannot read properties of undefined`:

```typescript
let server: Server;

afterEach(async () => {
  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
```

**Non-vacuous-assertion discipline** (`serve.spec.ts:18-34`) - this codebase has
already been burned by a tautological test (the comment cites `01-REVIEW.md WR-01`,
where a test hardcoded `127.0.0.1` in its own helper then asserted that same value).
TRUST-05 has exactly this failure mode. The existing comment is the model for how to
document that a test is non-vacuous:

```typescript
// SRV-01, non-vacuous: ServeOptions exposes no `host` field, so the bind
// address below is 100% determined by serve.ts's own internal choice -- the
// test cannot supply or influence it. This closes the false-confidence gap
// left by server.spec.ts's SRV-01 test, which hardcodes '127.0.0.1' in its
// own local listen() helper and then asserts that same test-chosen value
// (a tautology; see 01-REVIEW.md WR-01).
```

For TRUST-05, prove it two ways per RESEARCH: structurally (the signature exposes no
mode param) and behaviorally (drive the returned backend's `put` and observe
200-path vs 403).

**Spec-file specifics:**

| Spec | Copy from | New technique needed |
|------|-----------|----------------------|
| `trust.spec.ts` | `memory-backend.spec.ts` wholesale | none - pure predicate, table of events |
| `select-backend.spec.ts` | `memory-backend.spec.ts` + inline fake | none - pass literal `env` objects, never mutate `process.env` |
| `with-hash-lock.spec.ts` | structure only | **deferred-promise helper + order log** - RESEARCH "Code Examples"; no in-repo precedent |
| `actions-cache-backend.spec.ts` | `server.spec.ts` fakes | **`vi.mock('@actions/cache')`** - first module mock in the repo; no in-repo precedent |
| `serve.spec.ts` (extend) | itself | deferred-gated `put` + `process.exit` spy |

Both "new technique" cells are genuinely absent from this codebase - take them from
RESEARCH.md rather than inventing a house style.

**Placement:** `vitest.config.mts:11` includes `{src,tests}/**/*.{test,spec}.*`, so
new specs under `src/lib/` are picked up with zero config change. `tsconfig.spec.json:19-26`
likewise globs `src/**/*.spec.ts`. Note it does NOT glob `.cjs` - relevant if the
action entry ships as CJS.

---

### `action.yml` + `src/action/index.cjs` (config + entry-point)

**Analog: NONE.** No action manifest exists anywhere in the repo (verified: zero
`action.yml`, no `src/action/`, no root `action/`). This is greenfield - use
RESEARCH.md (R-02 resolution, Pitfalls 2-4) as the source.

Non-negotiables carried from research, all of which are silent-failure traps:

- `runs.using: node24` - `node20` is deprecating; node24 is the runner default since
  2026-06-16 and matches this repo's `.node-version` pin.
- The action is the ONLY launch path - `ACTIONS_RUNTIME_TOKEN`/`ACTIONS_RESULTS_URL`
  are absent in plain `run:` steps and `@actions/cache` silently no-ops there.
- Token reaches children by process inheritance ONLY, never `$GITHUB_ENV` (D-06).
- `@actions/core.setSecret` masks the bearer token before anything prints it. The
  existing `main()` at `serve.ts:70-75` writes the token to stdout - the action must
  mask before any equivalent output.
- Prefer the in-process foreground dogfood (serve in the action's own process +
  scripted `fetch`), which sidesteps the Windows detached-stdio kill entirely.

The scripted PUT/GET the action drives has a working model in
`serve.spec.ts:36-55` - same URL construction, same bearer header, same
round-trip assertions:

```typescript
const url = `${running.url}/v1/cache/abc123`;
const auth = { authorization: `Bearer ${running.token}` };
const body = Buffer.from('tar-bytes');

const put = await fetch(url, { method: 'PUT', headers: auth, body });

expect(put.status).toBe(200);

const get = await fetch(url, { headers: auth });

expect(get.status).toBe(200);
```

In the action, the `expect(...)` calls become `core.setFailed` guards - the dogfood
must fail loudly on a MISS, since a silent pass is precisely the failure mode SC5
exists to catch.

---

### `packages/github-cache/package.json` (MODIFY)

**Analog:** itself. Currently `"dependencies": {}` (`:18`) - Phase 2 makes it the
first non-empty entry.

```json
{
  "name": "@op-nx/github-cache",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "dependencies": {}
}
```

Exact pin, no `^`/`~` (ROBUST-03/D-04): `"@actions/cache": "6.2.0"`. Install with
`npm install --save-exact --workspace @op-nx/github-cache`. RESEARCH flags
`@actions/cache` as SUS/`too-new` (6.2.0 was days old at research time) and requires
a `checkpoint:human-verify` before install, with 6.1.0 as the more-baked fallback -
plan that checkpoint explicitly.

`"type": "module"` (`:5`) is why a CJS action entry needs the `.cjs` extension.
Root `package.json:5-14` is the model for adding a `test:act` script; per RESEARCH
Open Question 3 it should self-skip when the runtime env vars are absent, so it is a
documented no-op locally rather than a failure.

---

### `.github/workflows/ci.yml` (MODIFY)

**Analog:** the existing jobs - every one is the same five-step shape
(`ci.yml:44-53`):

```yaml
  build:
    runs-on: ubuntu-24.04-arm
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v6
        with:
          node-version-file: '.node-version'
          cache: 'npm'
      - run: npm ci
      - run: npm run build
```

The `integration` job (`:89-102`) is the closest structural analog for a job with
non-default semantics, and its comment block (`:77-88`) is the house standard for
documenting *why* a job is shaped the way it is - the dogfood job needs the same
treatment.

**Phase-2-specific traps, both silent:**

- **`permissions:` REPLACE-not-merge.** The workflow grants `contents: read` at top
  level (`ci.yml:9-10`). A job-level `permissions:` block replaces that wholesale.
  RESEARCH's recommended dogfood asserts HIT via `restoreCache`'s return value, which
  needs NO `permissions:` scope at all (runtime save/restore uses
  `ACTIONS_RUNTIME_TOKEN`, independent of the `GITHUB_TOKEN` grant) - so the lazy
  path is to add no `permissions:` block. If a REST assertion is ever added, restate
  every scope including `actions: read`.
- **Trigger.** The workflow runs on `push: [main]` and `pull_request` (`:3-7`). The
  write gate trusts only `{push, schedule}`, so the dogfood only exercises the RW
  path on a push to `main`; on `pull_request` it correctly gets the RO backend. Make
  sure the job's assertions account for that rather than failing on PRs.
- **Dogfood must drive a direct scripted PUT/GET**, not real `nx` tasks - Nx
  short-circuits on a local HIT and never writes to the remote, so a task-driven
  dogfood can look green while the server sat inert.

## Shared Patterns

### ESM `nodenext` - explicit `.js` on every relative import
**Source:** `memory-backend.ts:1`, `serve.ts:1-5`, all spec files
**Apply to:** every new `.ts` file
```typescript
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { pathToFileURL } from 'node:url';
import { createWritableMemoryBackend } from './backend/memory-backend.js';
import { createCacheServer, generateToken } from './server/server.js';
```
Node builtins carry the `node:` prefix. Relative specifiers carry `.js` even though
the source is `.ts`. `import type` for type-only imports (`noUnusedLocals` is on).

### Blank lines around control flow and returns; always braces
**Source:** every source file - `memory-backend.ts:3-11`, `server.ts:73-94`, `serve.ts:26-34`
**Apply to:** all new `.ts` files
```typescript
function resolvePort(value: number | string | undefined): number {
  const port = Number(value);

  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    return 0;
  }

  return port;
}
```
No braceless one-liners anywhere in this codebase, including single-statement `if`s.
Blank line before and after each `if` / `return`, except when first/last in a block.
Prettier runs with `singleQuote: true` via `nx format:write`; `format:check --all`
gates CI (`ci.yml:13-24`).

### `PutResult` -> status map (consume, do not touch)
**Source:** `server.ts:205-226`
**Apply to:** `actions-cache-backend.ts`, `read-only-backend.ts` - they only need to
return the right variant; the map is already exhaustive and stays unchanged.
```typescript
switch (result) {
  case 'stored': {
    res.statusCode = 200;
    break;
  }

  case 'conflict': {
    res.statusCode = 409;
    break;
  }

  case 'forbidden': {
    res.statusCode = 403;
    break;
  }

  default: {
    const _exhaustive: never = result;
    res.statusCode = 500;
    void _exhaustive;
  }
}
```
The `const _exhaustive: never` never-guard is the house pattern for exhaustive
switches - reuse it if any new switch over a union appears.

### Doc-comment names the requirement ID and the reason
**Source:** `memory-backend.ts:13-18` and `:39-45`, `server.ts:38-50`, `serve.ts:36-45`
**Apply to:** every new exported function and load-bearing constant
```typescript
/**
 * Read-only form of the Map-backed CacheBackend (the D-04 403 seam): put always
 * yields 'forbidden' -> the server maps it to 403. get mirrors the writable read
 * path; its store stays empty in Phase 1 (the real cross-context reader is
 * Phase 3), so get always misses here. RW-vs-RO is which factory constructs the
 * server, never a caller-facing mode flag (TRUST-05).
 */
```
Every non-obvious decision in this codebase carries its ID (D-04, TRUST-05, SRV-02,
Pitfall 6/7/8) and the consequence of changing it. Phase 2's comment-locked items
(`TRUSTED_EVENTS`, `cacheArchivePath`, the `withHashLock` ceiling, the `-1` handling)
all need this - for several of them the comment IS the mitigation.

### Fail-closed guard at the trust boundary
**Source:** `server.ts:56-66`
**Apply to:** `select-backend.ts` (`GITHUB_REPOSITORY` validation)
```typescript
if (!token || !token.trim()) {
  throw new Error(
    'createCacheServer: a non-empty bearer token is required (SRV-02)',
  );
}
```
Guard at construction, throw naming function + requirement. The precedent covers the
"but the internal caller never passes a bad value" objection - `server.ts:58-59`
notes the factory is a public export a consumer can misconfigure.

## Files That May Not Need To Exist

Flagging these so the planner makes a deliberate call rather than creating files by
default. Both are on the phase's file list; neither is clearly justified.

| File | Why it may not need to exist |
|------|------------------------------|
| `src/backend/read-only-backend.ts` | `createReadOnlyMemoryBackend()` (`memory-backend.ts:46-58`) already IS the 403 seam, is already tested (`memory-backend.spec.ts:44-60`), and CONTEXT.md D-04 names it "the reusable analog". RESEARCH Pattern 1 imports it directly. A new module would be a rename of working code, and it gets replaced wholesale by the Phase 3 Releases reader anyway. **Recommend: reuse, create nothing.** Create a dedicated module only if the RO backend needs behavior the memory one lacks - which in Phase 2 it does not. |
| `src/lib/cache-archive-path.ts` | RESEARCH Pattern 2 co-locates `cacheArchivePath` as a private function in `actions-cache-backend.ts`, its only consumer. A separate module earns its keep only if you write the pinned-exact-string test (the `MAX_CACHE_BODY_BYTES` precedent) - which is a legitimate guard against the silent-MISS class. **Planner call: separate module + pinned test, or inline + assert via mock call args.** Do not create it as a bare re-export. |

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/lib/with-hash-lock.ts` | utility | event-driven | No concurrency primitive or module-level mutable state exists. `memory-backend.ts`'s per-instance closure Map is the wrong shape - do not copy it. Use RESEARCH Pattern 3 verbatim. |
| `action.yml` | config | - | No action manifest anywhere in the repo (verified). Greenfield; RESEARCH R-02 + Pitfalls 2-4. |
| `src/action/index.cjs` | entry-point | batch | No action entry exists; no CJS file exists in `src/` at all. `serve.ts:70-85`'s `main()` + entry guard is the nearest *launcher* shape, but the token-masking and fail-loud requirements are new. |

Two techniques are also absent from the codebase even though their host spec files
have analogs: **deferred-promise concurrency testing** (`with-hash-lock.spec.ts`) and
**`vi.mock` module mocking** (`actions-cache-backend.spec.ts`). The repo's existing
fakes are all hand-rolled inline objects. Take both from RESEARCH's "Code Examples"
rather than improvising.

## Metadata

**Analog search scope:** `packages/github-cache/src/**` (all 8 source + 4 spec files
read in full), `packages/github-cache/{package.json,vitest.config.mts,tsconfig.spec.json}`,
root `package.json`, `nx.json`, `.github/workflows/ci.yml`
**Files scanned:** 16 read in full; repo-wide globs for `action.yml`, `src/lib/`,
`src/action/`, and `@actions/*` dependencies (all confirmed absent)
**Pattern extraction date:** 2026-07-19
