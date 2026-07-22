# Phase 2: Default Cache in CI - Research

**Researched:** 2026-07-19
**Domain:** GitHub Actions cache primitive (`@actions/cache` v2/twirp) behind an Nx self-hosted-cache HTTP server; runtime-context backend selection; in-process concurrency; JS-action CI dogfood on an arm64 host
**Confidence:** HIGH on platform facts and API surface; MEDIUM on the `act`-cache-protocol detail (community-sourced, but the recommendation holds on a second independent ground)

## Summary

Phase 2 plugs the first REAL storage backend into the Phase 1 contract server: an `@actions/cache`-backed RW `CacheBackend`, chosen purely by runtime context via `selectBackend(env)`, gated by a default-deny `isWriteTrusted(env)` (`{push, schedule}` only), serialized by an in-process `withHashLock`, drained on `SIGTERM`, and dogfooded live in this repo's CI through a minimal JS action. The heavy lifting is already scaffolded by Phase 1 (the `CacheBackend` port, the `PutResult`->status map, `serve()` composition root, the RO 403 seam, the cross-OS `integration` target). Phase 2 is mostly new small modules + one CI job.

Two research items forced this pass, and both resolve cleanly. **R-01 (`test:act` on arm64):** drop local `act` entirely. It fails on TWO independent grounds - (1) x86 runner images run under slow QEMU emulation on this Snapdragon host, and (2) `act`'s built-in cache server only implements the legacy v1 REST protocol (`ACTIONS_CACHE_URL`), whereas `@actions/cache` 6.x speaks the v2 twirp `CacheService` at `ACTIONS_RESULTS_URL`, so `act` cannot back the pinned library at all. The ROBUST-03 upgrade canary must be a **real-CI end-to-end restore** (the SC5 dogfood job), not a local target. **R-02 (CI launch + verification):** a JS action is mandatory and the reason is now airtight - `ACTIONS_RUNTIME_TOKEN`/`ACTIONS_RESULTS_URL` are injected only into JS/action runtimes, never plain `run:` steps, and the usual `$GITHUB_ENV` re-export workaround is FORBIDDEN here by D-06's secret hygiene. The lowest-risk dogfood is an **in-process JS action** (or a two-job seed->verify pair) that drives a real save then restore and asserts a deterministic HIT via `restoreCache`'s return value - no long-running background server, no detached-stdio pitfall, no experimental `background:`/`cancel:` machinery (that is Phase 6/DOCS-06).

**Primary recommendation:** Build `selectBackend`/`isWriteTrusted`/`withHashLock` as small `src/lib/*` modules (test-first), an `actions-cache-backend.ts` whose `cacheArchivePath(hash)` is the single comment-locked temp-path source, reuse Phase 1's `createReadOnlyMemoryBackend()` as the local RO placeholder, add a bounded `SIGTERM` drain to `serve`, pin `@actions/cache` EXACT, and dogfood with an in-process node24 JS action asserting a real cross-run HIT. Do NOT widen the write gate beyond `{push, schedule}`.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** `selectBackend(env)` is a **pure function returning exactly ONE `CacheBackend`** per process, chosen only from runtime context. `serve()` calls it in place of the hard-wired `createWritableMemoryBackend()` (serve.ts:54). **RW-vs-RO is 100% context-derived - NO caller-facing mode flag** (TRUST-05, ARCHITECTURE Decision 1). The writable memory backend stays as a test/dev aid; local context gets a **read-only** backend (a RO wrapper for now; the real GitHub Releases reader lands in Phase 3). `env` is an explicit injectable param (defaulting to `process.env`) so unit specs drive CI-vs-local without mutating global env. [IMPACT med / CONFIDENCE high]

- **D-02:** A **separate `isWriteTrusted(env)` pure predicate** that `selectBackend` composes (CI + trusted event -> RW Actions-cache; otherwise RO). `TRUSTED_EVENTS = ['push','schedule']` is the **single source of truth**, **default-deny, no denylist**. Dangerous shared-default-scope events (`pull_request_target`, `issue_comment`, fork-`workflow_run`, and every non-allowlisted trigger) are **refused by construction** and asserted by test. `pull_request`/`release` widening is **Phase 5 (TRUST-01)** - do NOT add them now. The dependency-free action copy + `selfcheck.cjs` parity is **Phase 5 (TRUST-04)**; seed ONE const now and do NOT create a dual root copy (avoid the PoC's duplicated-`TRUSTED_EVENTS` debt - Pitfall 1). [IMPACT high / CONFIDENCE high]

- **D-03:** `withHashLock` = an in-process `Map<hash, Promise>` that **serializes same-hash writes, runs different hashes concurrently, evicts the map entry on settle, and never wedges on a rejected op**, applied at the write path. Ceiling is single-process / ephemeral-single-tenant runner - comment-lock that ceiling; a distributed lock is out of scope. [IMPACT med / CONFIDENCE high]

- **D-04:** First runtime dependency: **`@actions/cache` pinned EXACT** (not `^`); upgrades gated behind a `test:act` end-to-end restore. **`cacheArchivePath(hash)` is the SINGLE SOURCE OF TRUTH** for the temp path, comment-locked. `get` -> `restoreCache`, `put` -> `saveCache`; the `saveCache` **`-1` return is ambiguous** (entry-exists OR write-denied by a read-only token) - treat as a benign no-op (idempotent under CORR-01) because the **write gate (D-02), not the backend, is what keeps a denied write from masking a real outage**. [IMPACT HIGH / CONFIDENCE high on the pattern]

- **D-05:** Build a **minimal JS action scoped to THIS repo's CI dogfood only** - NOT the published/enumerated public surface (Phase 6). A JS action is the **only** launch path for the Actions-cache backend. `serve` gains a **SIGTERM handler that drains in-flight puts before exit**, covered by an in-flight-put drain test. Scope is locked; the exact CI launch + verification mechanism was the research item (resolved below). [IMPACT HIGH / CONFIDENCE high on SCOPE, medium on mechanism]

- **D-06:** Phase 2 introduces the **`ACTIONS_RUNTIME_TOKEN`** and reads **context env** (`GITHUB_ACTIONS`, `GITHUB_EVENT_NAME`, `GITHUB_REPOSITORY`, `GH_TOKEN`||`GITHUB_TOKEN`). The runtime token is passed **only by process inheritance, never via `$GITHUB_ENV`**, and the bearer token is masked. These stay distinct from the Phase 1 per-process CSPRNG bearer token; do NOT mix them.

### Claude's Discretion

- Exact module layout under `packages/github-cache/src/` (e.g. `lib/select-backend.ts`, `lib/trust.ts`, `lib/with-hash-lock.ts`, `backend/actions-cache-backend.ts`, `backend/read-only-backend.ts`) - mirror Phase 1's internal-modules-in-one-lib shape (D-02); planner call.
- Whether the dogfood action lives under `packages/github-cache/` (e.g. an `action/` dir + a CJS entry) or a top-level `action.yml` - resolve against FOUND-03.
- The `test:act` target wiring / whether the real-socket + Actions-cache round-trip runs under the dormant `integration` target vs a new `test:act` target - planner call (see R-01).
- Exact `read-only` backend shape for local context (a RO wrapper over the memory backend vs a dedicated `createReadOnlyBackend()`) - the Phase 1 `createReadOnlyMemoryBackend()` (403 seam) is the reusable analog.

### Deferred Ideas (OUT OF SCOPE)

- GitHub Releases read-only reader + OS-namespacing + authenticated private-repo local read -> **Phase 3**.
- `{push,schedule}`-gated publish/sync + age-based cleanup + observability + storage-cap degradation -> **Phase 4**.
- `pull_request`/`release` trust-widening + single-source allowlist with `selfcheck.cjs` parity + server-produced-key filter + PPE gate -> **Phase 5**.
- The **published** npm package + JS Action, background-step consumption docs (DOCS-06), enumerated public surface (DOCS-05), governance -> **Phase 6** (Phase 2's action is dogfood-internal only).
- Do NOT widen the write gate early; do NOT build the second store.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TEST-01 | `selectBackend` unit specs (CI-vs-local, `GITHUB_REPOSITORY` validation, `GH_TOKEN\|\|GITHUB_TOKEN` fallthrough, malformed-repo rejection, explicit `env` param) | Exact spec-case matrix + the `\|\|`-not-`??` empty-string trap (Pitfall 8) in "Code Examples" and "Validation Architecture" |
| TEST-02 | `withHashLock` concurrency spec (same-hash serializes; different concurrent; entry evicted; rejected op doesn't wedge) | Promise-map pattern + the 4-property deferred-promise test shape in "Code Examples"/"Pitfalls" |
| ROBUST-03 | `@actions/cache` (and version-hash-sensitive deps) pinned **exact**; upgrades gated behind `test:act` | Exact-pin version + the SUS/too-new freshness flag; the canary re-scoped to a real-CI restore (R-01) |
| ROBUST-04 | `serve` handles `SIGTERM` to drain in-flight writes before exit; tested | Bounded-drain design + the "must not deadlock the runner's implicit `wait-all`" ceiling |
| TRUST-03 | Dangerous shared-default-scope events refused on the write gate; asserted by test | `isWriteTrusted` allowlist + the exact refused-event set |
| TRUST-05 | Runtime-context-derived RW/RO mode documented + test-covered; NO caller-facing mode surface | The no-flag structural property + how to test it non-vacuously |
</phase_requirements>

## Architectural Responsibility Map

The "tiers" here are the process/trust boundaries a request crosses, not web tiers.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| RW-vs-RO decision | `selectBackend(env)` (composition, in `serve()`) | `isWriteTrusted(env)` predicate | Context-derived at process start; the server/backend never see a mode flag (D-01/TRUST-05) |
| Trust gate (CREEP control C1) | `isWriteTrusted(env)` pure predicate | GitHub server-side read-only-token (load-bearing, but only matters once PR/release widen in Phase 5) | Phase 2 is conservative `{push,schedule}` -> safe by construction; in-code gate is the whole control here |
| Real cache storage | `actions-cache-backend.ts` -> `@actions/cache` -> GitHub v2 cache service | `cacheArchivePath(hash)` temp file | `@actions/cache` is the ONLY sanctioned surface; it version-hashes the literal path |
| Same-hash write serialization | `withHashLock` (in-process `Map<hash,Promise>`) | the shared temp path it protects | Single-process ceiling; guards the `cacheArchivePath` file from concurrent-write truncation |
| HTTP contract + status map | Phase 1 `server.ts` (unchanged) | `PutResult` never-guard | Already exhaustive; the new backend just returns `stored`/`conflict`/`forbidden` |
| Graceful shutdown | `serve()` `SIGTERM` handler | in-flight-put tracking | Background-step teardown sends SIGTERM->grace->SIGKILL; drain must be bounded |
| Token injection into the process | the **JS action** runtime (`ACTIONS_RUNTIME_TOKEN`/`ACTIONS_RESULTS_URL`) | process inheritance to any child | Plain `run:` steps do NOT get these vars; `$GITHUB_ENV` re-export is forbidden (D-06) |
| Local dev read | `createReadOnlyMemoryBackend()` (Phase 1 reuse, always MISS) | Phase 3 Releases reader (later) | No local read path until Phase 3; RO placeholder keeps `put`->403 |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@actions/cache` | `6.2.0` (pin EXACT) | `saveCache`/`restoreCache` against GitHub's v2 (twirp) cache service | The official `actions/toolkit` cache package; the ONLY supported way to read/write the Actions cache. Contract-mandated by the ADR (Decision 3). `[VERIFIED: npm registry - version 6.2.0, latest, github.com/actions/toolkit]` |
| `@actions/core` | `3.0.1` (pin EXACT) | Secret masking (`core.setSecret`) + `core.info`/`core.setFailed` in the dogfood JS action | Official toolkit; needed to mask the bearer token per D-06 and to fail the dogfood loudly. `[VERIFIED: npm registry - 3.0.1, latest]` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node:* builtins (`http`, `crypto`, `fs`, `os`, `path`, `net`) | Node 24 | Everything else (temp file I/O, SIGTERM, server) | Already the whole Phase 1 stack; add NOTHING new beyond `@actions/cache`(+`@actions/core`) |

`@actions/cache` transitively pulls `@actions/core|exec|glob|io|http-client`, `@azure/storage-blob`, `@azure/core-rest-pipeline`, `@protobuf-ts/runtime-rpc`, `semver`. This is a real dependency tree - acceptable because D-04 explicitly sanctions `@actions/cache` as the first runtime dep, and it only ships in the CI/dogfood path, not the zero-dep server core. `[VERIFIED: npm view @actions/cache dependencies]`

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@actions/cache` `restore/saveCache` | Raw twirp calls to `ACTIONS_RESULTS_URL` | Reinvents the version-hash/compression/upload-chunking the toolkit already does; guaranteed to drift from GitHub's protocol. Never hand-roll (see Don't Hand-Roll). |
| `@actions/cache` 6.2.0 | `@actions/cache` 6.1.0 (2026-06-18, ~1mo baked) | 6.2.0 is 6 days old (SUS/too-new). 6.1.0 is a more-baked exact pin on the same major. Either is defensible since the CI canary gates it; see Package Legitimacy Audit. |
| local `act` canary | real-CI end-to-end restore | `act` cannot back `@actions/cache` v2 AND is QEMU-slow on arm64 (R-01). |

**Installation:**
```bash
# From the workspace root; pins EXACT (no ^/~) per ROBUST-03/D-04.
npm install --save-exact --workspace @op-nx/github-cache @actions/cache@6.2.0 @actions/core@3.0.1
```
Verify the lockfile records exact specifiers and that `packages/github-cache/package.json` shows `"@actions/cache": "6.2.0"` (no caret). A ROBUST-03 guard test should assert no `^`/`~`/range on `@actions/cache`.

**Version verification (already run this session):**
```
npm view @actions/cache version   -> 6.2.0 (published 2026-07-13; 5.2.0 also current on the 5.x line 2026-07-15)
npm view @actions/core version    -> 3.0.1 (published 2026-04-21)
```
The 6.0.0 major landed 2026-01-29; 6.x therefore has ~6 months of bake even though the 6.2.0 patch is fresh.

## Package Legitimacy Audit

Run this session via `gsd-tools query package-legitimacy check --ecosystem npm @actions/cache @actions/core`.

| Package | Registry | Age (pkg) | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----------|-----------|-------------|---------|-------------|
| `@actions/cache` | npm | pkg years old; latest v6.2.0 is 6 days | ~164K/wk | github.com/actions/toolkit | **SUS** (`too-new`) | **KEEP** - contract-mandated official GitHub package. Flag is a version-freshness artifact, not supply-chain. Planner adds a `checkpoint:human-verify` before install and pins an exact baked version. |
| `@actions/core` | npm | published 2026-04-21 | ~11.7M/wk | github.com/actions/toolkit | **OK** | Approved |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** `@actions/cache` [WARNING: flagged `too-new` because latest 6.2.0 is 6 days old]. This is the official `actions/toolkit` package (164K weekly downloads, no `postinstall`, not deprecated, canonical GitHub org repo) - there is no legitimate alternative for the Actions-cache primitive. The correct response is exactly what ROBUST-03 already mandates: pin an **exact** version and gate upgrades behind the CI canary. Planner MUST insert a `checkpoint:human-verify` task before the install, and MAY choose 6.1.0 (more baked) over 6.2.0.

No `postinstall` scripts on either package `[VERIFIED: npm view scripts.postinstall -> null]`.

## Architecture Patterns

### System Architecture Diagram

```
                          selectBackend(env)                [pure, in serve()]
                                  |
                  isWriteTrusted(env)?  (GITHUB_ACTIONS==true && event in {push,schedule})
                        /  yes (CI trusted)           \  no (local / untrusted / PR)
                       v                                v
        createActionsCacheBackend()            createReadOnlyMemoryBackend()   [Phase 1 reuse]
                       |                                |  put -> 'forbidden' -> 403
                       |                                |  get -> always MISS (until Phase 3)
                       v
        serve() ---- http server (127.0.0.1) ---- guard ladder (Phase 1, unchanged)
          |                                          route->auth->hash->body-cap
          |  write path wrapped by withHashLock(hash)
          v
   put(hash,bytes):  write bytes -> cacheArchivePath(hash) file
                     saveCache([cacheArchivePath(hash)], keyFor(hash))  --> @actions/cache
                        cacheId > 0  -> 'stored' (200)
                        cacheId ===-1 -> 'stored' (200)  [benign no-op, D-04: exists OR denied]
   get(hash):        restoreCache([cacheArchivePath(hash)], keyFor(hash)) --> @actions/cache
                        returns key  -> read file -> {kind:'hit', bytes}
                        undefined    -> {kind:'miss'}
                                  |
                                  v
          @actions/cache  --(v2 twirp, ACTIONS_RESULTS_URL + ACTIONS_RUNTIME_TOKEN)-->  GitHub cache service

   [ CI launch ]  ci.yml job --uses--> dogfood JS action (runs.using: node24)
                     process.env has ACTIONS_RUNTIME_TOKEN/ACTIONS_RESULTS_URL  (JS action only!)
                     -> starts serve() in-process (RW backend) OR calls backend directly
                     -> scripted PUT then GET (or two-job seed->verify) asserts real HIT
                     -> SIGTERM drains in-flight puts on teardown
```

Data-flow, not files. The file->module map is in "Recommended Project Structure".

### Recommended Project Structure

```
packages/github-cache/
├── action.yml                       # dogfood JS action (runs.using: node24) -- or under action/
├── src/
│   ├── lib/
│   │   ├── select-backend.ts        # selectBackend(env=process.env): CacheBackend  (D-01, TEST-01)
│   │   ├── select-backend.spec.ts   # TEST-01 + TRUST-05 (written FIRST)
│   │   ├── trust.ts                 # TRUSTED_EVENTS + isWriteTrusted(env)  (D-02, TRUST-03)
│   │   ├── trust.spec.ts            # TRUST-03 dangerous-events-refused (written FIRST)
│   │   ├── with-hash-lock.ts        # withHashLock<T>(hash, fn)  (D-03, TEST-02)
│   │   └── with-hash-lock.spec.ts   # TEST-02 (written FIRST)
│   ├── backend/
│   │   ├── actions-cache-backend.ts # createActionsCacheBackend() + cacheArchivePath(hash)  (D-04)
│   │   ├── actions-cache-backend.spec.ts  # backend unit (mock @actions/cache)
│   │   ├── memory-backend.ts        # UNCHANGED (createReadOnly/WritableMemoryBackend)
│   │   └── types.ts                 # UNCHANGED (CacheBackend port)
│   ├── action/
│   │   └── index.cjs (or index.ts)  # dogfood entry: mask token, drive save/restore, assert HIT
│   ├── serve.ts                     # swap memory -> selectBackend(process.env); add SIGTERM drain
│   └── serve.spec.ts                # extend for ROBUST-04 SIGTERM in-flight-put drain
└── package.json                     # + "@actions/cache":"6.2.0" (exact), + "test:act" script (CI-gated)
```

### Pattern 1: `selectBackend` composes a trust predicate, returns one backend

**What:** A pure function that reads context env and returns exactly one `CacheBackend`. No mode flag anywhere in the signature.
**When to use:** Called once in `serve()` in place of `createWritableMemoryBackend()`.
```typescript
// src/lib/trust.ts
// Single source of truth (D-02). Default-deny, no denylist. pull_request/release
// widening is Phase 5 -- do NOT add them here. ponytail: array .includes is fine at n=2.
export const TRUSTED_EVENTS = ['push', 'schedule'] as const;

export function isWriteTrusted(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.GITHUB_ACTIONS !== 'true') {
    return false; // not CI -> never RW
  }

  return (TRUSTED_EVENTS as readonly string[]).includes(env.GITHUB_EVENT_NAME ?? '');
}
```
```typescript
// src/lib/select-backend.ts
import type { CacheBackend } from '../backend/types.js';
import { createActionsCacheBackend } from '../backend/actions-cache-backend.js';
import { createReadOnlyMemoryBackend } from '../backend/memory-backend.js';
import { isWriteTrusted } from './trust.js';

// D-01/TRUST-05: RW-vs-RO is 100% context-derived. There is NO caller-facing
// mode flag -- the only argument is the (injectable) env bag.
export function selectBackend(env: NodeJS.ProcessEnv = process.env): CacheBackend {
  if (isWriteTrusted(env)) {
    return createActionsCacheBackend(env); // reads GITHUB_REPOSITORY etc.
  }

  return createReadOnlyMemoryBackend(); // Phase 1 reuse; Phase 3 swaps in the Releases reader
}
```

### Pattern 2: `cacheArchivePath(hash)` is the single, comment-locked temp-path source

**What:** One helper returns the temp file path; save AND restore pass its byte-identical output. `@actions/cache` folds the literal path string (+ compression method + `enableCrossOsArchive`) into its version hash, so any cosmetic change silently MISSes every restore.
```typescript
// src/backend/actions-cache-backend.ts
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFile, writeFile, rm } from 'node:fs/promises';
import * as cache from '@actions/cache';
import type { CacheBackend, GetResult, PutResult } from './types.js';

// LOAD-BEARING, comment-locked (Pitfall 7 / ROBUST-03). @actions/cache version-
// hashes the LITERAL path string. Never inline, reformat, or "tidy" this path
// without re-verifying an end-to-end restore in CI -- a change is a silent MISS.
function cacheArchivePath(hash: string): string {
  return join(tmpdir(), `nx-github-cache-${hash}.tar`);
}

// keyFor: the Actions-cache key space == HASH_PATTERN ^[a-f0-9]{1,512}$ (TRUST-08).
// A prefix keeps it distinguishable from unrelated CI cache keys (Phase 5 hardens this).
function keyFor(hash: string): string {
  return `nx-cache-${hash}`;
}

export function createActionsCacheBackend(
  _env: NodeJS.ProcessEnv = process.env,
): CacheBackend {
  return {
    async get(hash): Promise<GetResult> {
      const path = cacheArchivePath(hash);
      const matched = await cache.restoreCache([path], keyFor(hash));

      if (matched === undefined) {
        return { kind: 'miss' };
      }

      const bytes = await readFile(path);

      return { kind: 'hit', bytes };
    },

    async put(hash, bytes): Promise<PutResult> {
      const path = cacheArchivePath(hash);
      await writeFile(path, bytes);

      try {
        const cacheId = await cache.saveCache([path], keyFor(hash));
        // D-04: -1 is ambiguous (already-exists OR RO-token-denied). Treat as a
        // benign no-op -- a same-hash write is byte-identical (CORR-01), and the
        // WRITE GATE (D-02), not the backend, is what stops a denied write from
        // masking a real outage. Do NOT probe exists-vs-denied here.
        return cacheId === -1 ? 'stored' : 'stored';
      } finally {
        await rm(path, { force: true });
      }
    },
  };
}
```
Note the `cacheId === -1 ? 'stored' : 'stored'` collapses to `'stored'` - written explicitly so the D-04 reasoning is visible at the return site. The RW backend never returns `'forbidden'`; the RO local backend (a different factory `selectBackend` returns) owns 403. `'conflict'`/409 is NOT emitted by this backend (checking existence needs an extra round-trip + rate cost); first-write-wins/409 semantics live at the memory/contract layer and, for the mirror, in Phase 4 (TRUST-07).

### Pattern 3: `withHashLock` stores the in-flight promise, chains on settle, evicts on tail

**What:** `Map<hash, Promise>` that serializes same-hash writes, runs different hashes concurrently, evicts on settle, and never wedges on a rejected op. Wrap the write path (`backend.put`).
```typescript
// src/lib/with-hash-lock.ts
// ponytail: global in-process map. Ceiling = single-process / ephemeral single-
// tenant runner (the documented deployment). A distributed lock is out of scope;
// upgrade path is a shared coordinator only if multi-process writers ever appear.
const inFlight = new Map<string, Promise<unknown>>();

export function withHashLock<T>(hash: string, fn: () => Promise<T>): Promise<T> {
  const prior = inFlight.get(hash) ?? Promise.resolve();
  // Chain AFTER prior settles (resolve OR reject) so one rejection never wedges
  // the queue. `.then(run, run)` runs `fn` in both branches.
  const run = () => fn();
  const result = prior.then(run, run);
  // Store a non-rejecting tail so a failed op cannot reject a later waiter's chain.
  const tail = result.then(
    () => undefined,
    () => undefined,
  );
  inFlight.set(hash, tail);
  // Evict only if still the tail (identity check) so a concurrent re-add is safe.
  void tail.then(() => {
    if (inFlight.get(hash) === tail) {
      inFlight.delete(hash);
    }
  });

  return result; // caller sees the REAL resolution/rejection, not the swallowed tail
}
```

### Pattern 4: bounded `SIGTERM` drain in `serve()`

**What:** On SIGTERM, stop accepting new connections and await in-flight puts, then exit - but bounded, because the runner sends SIGTERM then SIGKILL after a short grace and the implicit `wait-all` must not deadlock.
```typescript
// in serve(), after listen():
const inFlightPuts = new Set<Promise<unknown>>(); // populate where backend.put is awaited
function onSigterm(): void {
  server.close(); // stop accepting new connections
  // ponytail: bounded drain. Do NOT await forever -- a hung put must yield to the
  // runner's SIGKILL, not block wait-all. Grace ~ a few seconds.
  const drained = Promise.allSettled([...inFlightPuts]);
  const timeout = new Promise((r) => setTimeout(r, 4000).unref());
  void Promise.race([drained, timeout]).then(() => process.exit(0));
}
process.once('SIGTERM', onSigterm);
```
Track in-flight puts wherever `backend.put` is awaited (the server write path or a small wrapper). Return the listener/registration so tests can trigger it deterministically without a real signal.

### Anti-Patterns to Avoid

- **Re-exporting `ACTIONS_RUNTIME_TOKEN` via `$GITHUB_ENV`** (the common `actions/github-script`/`ghaction-github-runtime` workaround). FORBIDDEN by D-06 - the token reaches the process only by inheritance. This is the whole reason a JS action is mandatory. `[CITED: github.com/orgs/community/discussions/42856]`
- **Detecting exists-vs-denied on `saveCache -1`.** Impossible via the public API and explicitly a trust-gate concern, not a backend concern (D-04).
- **Storing the resolved value (not the promise) in `withHashLock`'s map.** A cold-start burst then all observe an empty map and each proceed - the coalescing is lost (Pitfall: "cache the in-flight PROMISE, not the value").
- **Changing `cacheArchivePath` cosmetically.** Silent MISS class (Pitfall 7).
- **Adding `pull_request`/`release`/`workflow_dispatch` to `TRUSTED_EVENTS`.** Phase 5 only; Phase 2 stays `{push, schedule}`.
- **A second, root-level copy of `TRUSTED_EVENTS`.** Seed ONE const; the dependency-free action copy + `selfcheck.cjs` parity is Phase 5 (avoid the PoC's duplicated-const debt).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Talk to the GitHub cache service | Raw twirp/HTTP against `ACTIONS_RESULTS_URL` | `@actions/cache` `save/restoreCache` | The toolkit owns the version-hash, zstd/gzip selection, chunked upload, and the v1->v2 protocol migration; hand-rolling drifts on the next GitHub change. |
| Cross-OS archive correctness | Your own OS/arch namespacing at the Actions-cache layer | `@actions/cache`'s version hash (folds compression + literal path) | It already OS-partitions restores by construction. (Explicit CORR-01 OS-namespacing is Phase 3, for the Releases reader.) |
| Secret masking in the action | `console.log` guards / manual regex | `@actions/core` `setSecret` | Masks the bearer token in logs per D-06; re-masking on Windows is a known toolkit behavior. |
| Local Actions-cache emulation | Stand up `act`'s cache server | Nothing - test the backend with a MOCKED `@actions/cache` (unit) + a real-CI restore (canary) | `act` is v1-only and QEMU-slow (R-01); a mock proves the backend's mapping, CI proves the real primitive. |

**Key insight:** The only place `@actions/cache` actually works is inside a JS action on real CI. Every other verification layer (unit specs) must MOCK it; the single real exercise is the CI dogfood, which is therefore both the SC5 proof AND the ROBUST-03 canary.

## Common Pitfalls

### Pitfall 1: `act` cannot back `@actions/cache` v6 (the R-01 crux)

**What goes wrong:** You wire a local `test:act` target expecting an end-to-end restore, but every restore MISSes or errors "Cache Service Url not found".
**Why it happens:** `act`'s built-in cache server implements the **legacy v1 REST protocol** (`ACTIONS_CACHE_URL` + `_apis/artifactcache/...`). `@actions/cache` 6.x uses the **v2 twirp `CacheService`** at `ACTIONS_RESULTS_URL`. `act` has implemented the twirp `ArtifactService` (v4 artifacts) but there is no evidence it implements the twirp `CacheService`. `[CITED: nektos/act issues #285/#1034/#1513 + DeepWiki artifact/cache server page]` (MEDIUM - community-sourced; re-verify against the current `act` release if ever revisited).
**How to avoid:** Do not use `act` for the cache canary. Independently, `act` on this Snapdragon arm64 host runs x86 runner images under slow QEMU (`--container-architecture linux/amd64`) `[CITED: nektosact.com + nektos/act discussion #2157]` - so even a v2-capable `act` would be the wrong canary here.
**Warning signs:** A green local `act` run that never actually wrote to any cache (silent no-op).

### Pitfall 2: `ACTIONS_RUNTIME_TOKEN`/`ACTIONS_RESULTS_URL` absent in `run:` steps (the R-02 crux)

**What goes wrong:** `serve` launched from a plain `run:` step silently no-ops all save/restore (fail-open, no error) - a green CI job that cached nothing.
**Why it happens:** These vars are injected only into JS/action runtimes, not plain `run:` steps. `[CITED: community #42856; actions/toolkit; CONFIRMED by this repo's PITFALLS "Empirically-Verified Facts", git-history-confirmed]` (HIGH).
**How to avoid:** Launch from a JS action (`runs.using: node24`). Pass the token to any child only by process inheritance (never `$GITHUB_ENV`, D-06).
**Warning signs:** `restoreCache` always returns `undefined` in CI; cache never appears in the repo's Actions caches list.

### Pitfall 3: Windows detached-background-process stdio kill

**What goes wrong:** On `windows-11-arm`, a backgrounded `serve` that inherits the runner step's stdout is killed when the runner closes the step pipe.
**Why it happens:** Windows pipe teardown propagates to the inheriting child. `[CITED: this repo's PITFALLS "Empirically-Verified Facts" (verified)]` (HIGH).
**How to avoid:** For the RECOMMENDED in-process dogfood (serve runs in the JS action's foreground, no detached child) this cannot occur - prefer it. If a background child is ever used, `detached: true` + redirect stdio to a temp file (`stdio: ['ignore', fd, fd]`), `unref()`, and re-register secret masks out of band. (Full background-step pattern is Phase 6/DOCS-06.)

### Pitfall 4: job-level `permissions:` REPLACE-not-merge

**What goes wrong:** A dogfood job that adds `contents: write` silently drops `actions: read`, so any REST caches-list call 404s (reads like a bug, is a dropped scope).
**Why it happens:** A job `permissions:` block replaces the workflow grant wholesale. `[CITED: this repo's PITFALLS "GitHub Actions job semantics"]` (HIGH).
**How to avoid:** The recommended dogfood asserts HIT via `restoreCache`'s RETURN VALUE (no REST call), which needs NO `permissions:` scope at all (runtime save/restore uses `ACTIONS_RUNTIME_TOKEN`, independent of the GITHUB_TOKEN `permissions:` block). If you ever add a REST assertion, restate EVERY scope the job needs (`actions: read` AND whatever else).
**Warning signs:** `GET /repos/.../actions/caches` returns 404 in a job that "should" see caches.

### Pitfall 5: `withHashLock` promise bookkeeping (TEST-02's target)

**What goes wrong:** A rejected op wedges the same-hash queue, or the map grows unbounded, or the caller sees a swallowed result.
**Why it happens:** Naive `.then(fn)` chaining propagates a rejection to the next waiter; eviction without an identity check clobbers a concurrent re-add; returning the non-rejecting tail hides failures from the caller.
**How to avoid:** Chain with `.then(run, run)`; store a non-rejecting `tail` in the map but RETURN the real `result`; evict only when `inFlight.get(hash) === tail`. See Pattern 3.
**Warning signs:** A test where op B never runs after op A rejects; a growing map size after all ops settle.

### Pitfall 6: seeding via Nx short-circuits on a local HIT

**What goes wrong:** If the dogfood drives real `nx` tasks through `serve`, Nx writes to the remote only on a genuine LOCAL miss - a local HIT means no remote PUT, so the server looks healthy but is inert.
**Why it happens:** Nx short-circuits on its local cache. `[CITED: this repo's PITFALLS "Seeding a remote cache from CI"]` (HIGH).
**How to avoid:** The recommended dogfood drives a DIRECT scripted PUT/GET (or calls the backend directly), not real Nx tasks - so this does not bite Phase 2. If you later seed via Nx, `nx reset` between a bootstrap build and the seed build to force a real miss.

## Runtime State Inventory

Not applicable - Phase 2 is greenfield module additions + one CI job, not a rename/refactor/migration. No stored data, live-service config, OS-registered state, or build artifacts carry an old identity. **None - verified: this phase creates new files and adds a dependency; it renames nothing.**

## Code Examples

### `selectBackend` unit spec shape (TEST-01, TRUST-05)

```typescript
// select-backend.spec.ts -- write FIRST. env is injected, never process.env mutated.
import { describe, expect, it, vi } from 'vitest';

const base = { GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: 'op-nx/github-cache' };

describe('selectBackend (TEST-01 / TRUST-05)', () => {
  it('CI + push -> writable Actions-cache backend (put does NOT 403)', () => { /* ... */ });
  it('CI + schedule -> writable backend', () => { /* ... */ });
  it('CI + pull_request -> read-only backend (put -> forbidden)', () => { /* ... */ });
  it('CI + pull_request_target / issue_comment / workflow_run -> read-only (TRUST-03)', () => { /* ... */ });
  it('local (GITHUB_ACTIONS unset) -> read-only backend', () => { /* ... */ });
  it('malformed GITHUB_REPOSITORY in trusted context -> rejected (throws, fail-closed)', () => { /* ... */ });
  it('resolves GH_TOKEN || GITHUB_TOKEN, and a set-but-EMPTY GH_TOKEN falls through', () => {
    // Pitfall 8: `??` keeps '' and shadows the fallback; the impl must use `||`.
  });
  // TRUST-05 non-vacuous: selectBackend's signature exposes NO mode param -- assert
  // the type/shape (only `env`) so a future caller cannot force RW. RW-vs-RO is proved
  // behaviorally by driving the returned backend's put() (200-path vs 403).
});
```
Exact TEST-01 case matrix: `{push, schedule}`->RW; `{pull_request, pull_request_target, issue_comment, workflow_run, workflow_dispatch, release, <unset>}`->RO; local->RO; malformed repo (not `^[^/]+/[^/]+$`)->reject; `GH_TOKEN||GITHUB_TOKEN` incl. empty-string fallthrough; explicit `env` param drives all of it.

### `withHashLock` concurrency spec shape (TEST-02)

```typescript
// with-hash-lock.spec.ts -- deferred promises + a shared order log.
function deferred<T>() {
  let resolve!: (v: T) => void, reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

it('serializes same-hash ops (B waits for A to settle)', async () => { /* order log: A-start, A-end, B-start */ });
it('runs different hashes concurrently (both start before either settles)', async () => { /* h1 & h2 both A-start before resolve */ });
it('evicts the map entry after the tail settles', async () => { /* assert internal size 0 -- expose a size probe or test indirectly */ });
it('a rejected op does not wedge the lock (B still runs; A rejects to its caller)', async () => {
  const a = withHashLock('h', () => Promise.reject(new Error('boom')));
  const b = withHashLock('h', () => Promise.resolve('ok'));
  await expect(a).rejects.toThrow('boom');
  await expect(b).resolves.toBe('ok');
});
```

### `SIGTERM` drain spec shape (ROBUST-04)

```typescript
// serve.spec.ts (extend). Prefer a deterministic trigger over a real OS signal:
it('drains an in-flight put before exiting on SIGTERM', async () => {
  // start serve with a backend whose put is gated by a deferred; begin a PUT (in flight);
  // trigger the SIGTERM handler (exposed for test / process.emit('SIGTERM'));
  // resolve the deferred; assert the put completed (bytes stored) and the server closed,
  // and that process.exit was invoked (spy) -- bounded, never hanging.
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@actions/cache` v1 REST (`ACTIONS_CACHE_URL`, `_apis/artifactcache`) | v2 twirp `CacheService` (`ACTIONS_RESULTS_URL` + `ACTIONS_RUNTIME_TOKEN`) | v4.0.0 line, Feb 2025 deprecation; default in 6.x | `act`'s v1 cache server is incompatible; only real CI backs it (R-01) |
| JS actions `runs.using: node20` | `node24` (default on runners from **2026-06-16**; node20 EOL Apr 2026) | github.blog changelog 2025-09-19 | Dogfood action should declare `node24`; matches this repo's Node 24 pin `[CITED: github.blog/changelog/2025-09-19-deprecation-of-node-20]` |
| Shell backgrounding (`&`) for sidecar services | Native `background:`/`wait`/`wait-all`/`cancel`/`parallel` step keywords | GA **2026-06-25** | The DOCS-06 background-step pattern is now real/GA - but it is Phase 6; Phase 2 uses the simpler in-process dogfood `[CITED: github.blog/changelog/2026-06-25-actions-steps-can-now-be-run-in-parallel]` |

**Deprecated/outdated:** `@actions/cache` <4.0.0 (v1 service, EOL). `runs.using: node20` (deprecating). Do not target either.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `act` does NOT implement the v2 twirp `CacheService` (only v1 REST + v4 artifact twirp) | Pitfall 1 / R-01 | LOW - even if a future `act` adds it, the QEMU-slow arm64 ground independently kills local `act` as the canary; recommendation unchanged. Community-sourced; re-verify only if someone insists on local `act`. |
| A2 | Same-run `saveCache` then `restoreCache` reliably HITs | Dogfood mechanism | MEDIUM - if flaky, use the two-job seed->verify pattern (recommended anyway for determinism). Not load-bearing. |
| A3 | The RW Actions-cache backend maps `saveCache -1 -> 'stored'` (200) | Pattern 2 | LOW - D-04 locks "treat as benign no-op"; 200 vs 409 are both graceful for the Nx client, so a wrong pick is non-breaking. Confirm framing at plan time. |
| A4 | `keyFor(hash) = "nx-cache-" + hash` (prefix now, Phase 5 hardens the filter) | Pattern 2 | LOW - TRUST-08 (server-produced-key filter) is Phase 5; any prefix works for the Phase 2 dogfood. Planner's discretion. |
| A5 | Pin `@actions/cache` 6.2.0 exact (vs 6.1.0) | Standard Stack | LOW - the CI canary gates it; 6.1.0 is the more-baked fallback. Gate behind the human-verify checkpoint. |

## Open Questions (RESOLVED)

> All three were resolved at planning time. The binding decisions live in
> `02-06-PLAN.md` (and `02-01-PLAN.md` for the pin) under its "Resolved planning
> decision (do not re-open)" blocks. Recorded here for traceability -- do not
> re-open these during execution.

1. **Two-job seed->verify vs single in-process save->restore for the SC5 hit assertion?**
   - **RESOLVED: two-job `dogfood-seed` -> `dogfood-verify`, keyed on `github.run_id`** (`02-06-PLAN.md`). A single-job restore can succeed from local state while the upload is entirely broken; two jobs prove the round-trip actually crossed GitHub's cache service. `run_id` is decimal, so it already satisfies the server's `^[a-f0-9]{1,512}$` validator.
   - What we know: both exercise the real primitive; two-job with `needs:` + a `github.run_id`-scoped key is deterministic; single-job is simpler but leans on A2.
   - Recommendation: default to the **two-job seed->verify** (deterministic HIT, proves cross-job round-trip). Fall back to single-job only if the second job's token/cost is unwelcome.

2. **Does the dogfood run the full `serve` HTTP server or call the backend directly?**
   - **RESOLVED: run `serve()` in-process in the action's FOREGROUND + scripted PUT/GET** (`02-06-PLAN.md`), so the dogfood covers the HTTP contract too. No detached child -- this keeps the Windows detached-stdio kill pitfall out of scope, and `background:`/`cancel:` stays Phase 6 (DOCS-06).

3. **`test:act` npm script - keep the name or rename?**
   - **RESOLVED: keep the name `test:act`** (`02-06-PLAN.md`) as a thin wrapper around the same built action entry that SELF-SKIPS (skip notice, exit 0) when `ACTIONS_RESULTS_URL`/`ACTIONS_RUNTIME_TOKEN` are absent. One artifact, two invocation paths; the real ROBUST-03 canary is the CI seed/verify job pair. Local `act` is infeasible (R-01: `act`'s cache server speaks only legacy v1 REST, while `@actions/cache` 6.x uses the v2 twirp `CacheService`).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js 24 | everything | Yes | v24.13.0 (`.node-version` lts/krypton) | - |
| npm | install/CI | Yes | lockfile-based `npm ci` | - |
| `@actions/cache` 6.2.0 | Actions-cache backend | via `npm install` | 6.2.0 (exact) | none - contract-mandated |
| GitHub Actions v2 cache service | real save/restore | CI only | `ACTIONS_RESULTS_URL`/`ACTIONS_RUNTIME_TOKEN` injected in the JS action | none locally |
| `act` (local CI runner) | (would-be local canary) | **No / infeasible** | - | **real-CI restore** (R-01) |
| Docker (for `act`) | (would-be) | not needed | - | n/a |

**Missing dependencies with no fallback:** none that block Phase 2 (all unit specs run locally with a MOCKED `@actions/cache`; the real primitive runs in CI).
**Missing dependencies with fallback:** local `act` end-to-end restore -> replaced by the real-CI dogfood canary.

## Validation Architecture

> `workflow.nyquist_validation: true` in config.json - section included.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest `~4.1.0` via `@nx/vitest` |
| Config file | `packages/github-cache/vitest.config.mts` (env `node`, `globals: true`, `watch: false`) |
| Quick run command | `npx nx test @op-nx/github-cache` |
| Full suite command | `npx nx run-many -t test build typecheck` (+ `integration` matrix if used) |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TEST-01 | `selectBackend` CI/local/repo/token/malformed/explicit-env | unit | `npx nx test @op-nx/github-cache` (`select-backend.spec.ts`) | ❌ Wave 0 |
| TRUST-05 | RW/RO context-derived, no mode flag | unit (structural + behavioral) | same file as TEST-01 | ❌ Wave 0 |
| TRUST-03 | dangerous events refused on the write gate | unit | `... test` (`trust.spec.ts`) | ❌ Wave 0 |
| TEST-02 | `withHashLock` serialize/concurrent/evict/no-wedge | unit (deferred promises) | `... test` (`with-hash-lock.spec.ts`) | ❌ Wave 0 |
| ROBUST-04 | `SIGTERM` drains in-flight put before exit | unit/integration (deterministic trigger) | `... test` (`serve.spec.ts` extend) | ⚠️ extend existing |
| (backend) | `put`->saveCache / `get`->restoreCache / `-1`->stored | unit (MOCK `@actions/cache`) | `... test` (`actions-cache-backend.spec.ts`) | ❌ Wave 0 |
| ROBUST-03 (a) | `@actions/cache` pinned EXACT (no `^`/`~`) | unit/static guard | `... test` (assert on package.json) or a `fallow`/CI check | ❌ Wave 0 |
| ROBUST-03 (b) / SC5 | real save->restore HIT (the canary) | **CI-only** dogfood job | `.github/workflows/ci.yml` dogfood job on `push` | ❌ Wave 0 (CI) |

### Sampling Rate

- **Per task commit:** `npx nx test @op-nx/github-cache` (all unit specs; `@actions/cache` mocked; < a few seconds).
- **Per wave merge:** `npx nx run-many -t test build typecheck`.
- **Phase gate:** the CI dogfood job green (real HIT on a push to `main`) + full suite green before `/gsd:verify-work`.

### Wave 0 Gaps

- [ ] `src/lib/select-backend.spec.ts` - TEST-01, TRUST-05
- [ ] `src/lib/trust.spec.ts` - TRUST-03
- [ ] `src/lib/with-hash-lock.spec.ts` - TEST-02
- [ ] `src/backend/actions-cache-backend.spec.ts` - backend mapping (mock `@actions/cache`)
- [ ] `src/serve.spec.ts` - extend for ROBUST-04 SIGTERM drain
- [ ] package.json exact-pin guard - ROBUST-03(a)
- [ ] `.github/workflows/ci.yml` dogfood job + `action.yml` + action entry - SC5 / ROBUST-03(b) canary
- [ ] Framework install: none - Vitest/@nx/vitest already wired (Phase 1)

## Security Domain

> `security_enforcement: true`, `security_asvs_level: 1` - section included. Governing threat is CVE-2025-36852 (CREEP), defended at the write gate.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (carry-forward) | Phase 1 CSPRNG bearer token, timing-safe; unchanged. NEW: `ACTIONS_RUNTIME_TOKEN` kept distinct (D-06), never mixed |
| V3 Session Management | no | stateless per-request |
| V4 Access Control | yes | the write-trust gate (`isWriteTrusted`) IS the access-control boundary for writes (default-deny) |
| V5 Input Validation | yes (carry-forward) | `HASH_PATTERN ^[a-f0-9]{1,512}$` (Phase 1) also bounds the Actions-cache key space; `GITHUB_REPOSITORY` format validated (TEST-01) |
| V6 Cryptography | yes (carry-forward) | never hand-roll; token compare stays `timingSafeEqual` (Phase 1) |
| V7 Secrets / logging | yes | `@actions/core.setSecret` masks the bearer token; `ACTIONS_RUNTIME_TOKEN` by process inheritance only, never `$GITHUB_ENV` (D-06) |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cache poisoning via untrusted write (CREEP, CVE-2025-36852) | Tampering / Elevation | Default-deny `isWriteTrusted` = `{push, schedule}` only; dangerous events refused by construction (TRUST-03). Phase 2 is conservative -> safe by construction (no PR/release widening yet) |
| Fork-spoofable `GITHUB_EVENT_NAME` | Spoofing | In-code gate is defense-in-depth; the load-bearing control (GitHub server-side read-only token) only becomes relevant when Phase 5 widens to PR/release. Phase 2's `{push,schedule}` set is not fork-reachable to `main`'s scope |
| Runtime-token / bearer-token leak to logs or `$GITHUB_ENV` | Information Disclosure | `core.setSecret` mask; process-inheritance-only for `ACTIONS_RUNTIME_TOKEN` (D-06) |
| Concurrent same-hash write truncating the shared temp file | Tampering (data corruption) | `withHashLock` serializes same-hash writes on the shared `cacheArchivePath` (D-03); single-tenant-runner ceiling comment-locked |
| Denied write masked as success (`saveCache -1`) | Repudiation / integrity | The write GATE (not the backend) ensures we only saveCache in trusted RW context, so `-1` is a benign no-op not an outage mask (D-04) |

## Sources

### Primary (HIGH confidence)
- `.planning/research/PITFALLS.md` "Empirically-Verified Platform Facts" - `saveCache -1` ambiguity; JS-action-only token injection + plain-`run:` silent no-op (git-history-confirmed); Windows detached-stdio kill; `permissions:` REPLACE-not-merge; Nx seed-on-local-miss; `withHashLock` under-tested; `cacheArchivePath` literal-path version hashing + zstd/gzip + `enableCrossOsArchive` non-rescue (actions/cache#1622). First-party, verified.
- npm registry via `npm view` - `@actions/cache` 6.2.0 (latest, 2026-07-13), deps, no postinstall; `@actions/core` 3.0.1. `[VERIFIED]`
- `gsd-tools query package-legitimacy check` - verdicts (cache=SUS/too-new, core=OK). `[VERIFIED]`
- github.blog changelog 2025-09-19 (Node 20 deprecation -> node24 default 2026-06-16); 2026-06-25 (parallel/background steps GA). `[CITED]`

### Secondary (MEDIUM confidence)
- actions/toolkit cache source + GitHub Docs dependency-caching - `save/restoreCache` signatures, `-1` sentinel, `enableCrossOsArchive` in the version hash. `[CITED]` (cross-checked against PITFALLS)
- community discussion #42856 + actions/toolkit issues - `ACTIONS_RUNTIME_TOKEN`/`ACTIONS_RESULTS_URL` not in `run:` steps; `$GITHUB_ENV` re-export workaround (which D-06 forbids). `[CITED]`

### Tertiary (LOW confidence - flagged for re-verify)
- nektos/act issues (#285, #1034, #1513) + DeepWiki - `act` cache server is v1-only; v2 twirp `CacheService` not implemented. Drives R-01 but the recommendation also holds on the independent QEMU-slow ground. Re-verify against the current `act` release only if local `act` is ever reconsidered.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - official toolkit packages, versions verified against the registry this session.
- Architecture / patterns: HIGH - grounded in the locked ADR + Phase 1 seams read directly from source; `withHashLock`/`selectBackend`/backend patterns follow the established codebase shape.
- R-01 recommendation: HIGH on the outcome (drop local `act`), MEDIUM on one of the two reasons (act's v2 gap is community-sourced) - but the QEMU-slow ground alone is sufficient.
- R-02 recommendation: HIGH - JS-action-only token injection is corroborated by this repo's own git-history-confirmed finding; the in-process dogfood sidesteps the two Windows/permissions traps.
- Pitfalls: HIGH - first-party empirically-verified facts.

**Research date:** 2026-07-19
**Valid until:** ~2026-08-02 for `@actions/cache` version specifics (fast-moving; 6.2.0 is days old). Platform facts (token injection, `act` v1-only, node24 default, background-steps GA) stable ~90 days.
