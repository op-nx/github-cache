# Phase 4: Publish + Retention + Observability - Research

**Researched:** 2026-07-20
**Domain:** GitHub Releases asset mirroring via first-party Octokit; Actions Cache Management REST enumeration; age-based scheduled cleanup; `@actions/core` workflow observability; a sync-gate predicate distinct from the write gate.
**Confidence:** HIGH (Octokit + REST + `@actions/core` verified against official docs and the npm registry; repo integration verified by reading every named source file; two body-shape details tagged `[ASSUMED]` in the Assumptions Log.)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01 (sync gate is a SEPARATE predicate):** publish/sync gate is its own predicate -- `{push, schedule}` AND the default branch -- and is NOT `isWriteTrusted` (`lib/trust.ts`). Test-lock rejection of `pull_request`, `release`, `repository_dispatch`, `workflow_dispatch`, `merge_group`, `delete`, `registry_package`, `page_build`, and non-default refs. The default-branch check is part of the predicate, not a workflow-level `if:` alone. (ADR C2.)
- **D-02 (out-of-band publish, NOT dual-write):** the publisher is a separate job that runs after CI, reads entries out of the Actions cache, uploads them to Releases. NOT an inline fan-out from `put()`. The serve path stays untouched.
- **D-03 (per-OS publish matrix -- LOAD-BEARING):** matrix over `[ubuntu-24.04-arm, windows-11-arm]`; each leg mirrors ONLY entries it can restore on its own OS. `@actions/cache`'s `getCacheVersion` folds raw `paths` (per-OS `os.tmpdir()`) + a windows-only salt + compression method into the version hash. `enableCrossOsArchive` does NOT fix it. Failure mode is a SILENT skip. Publish legs are UPLOAD-ONLY; cleanup is separate (D-09).
- **D-04 (Octokit for publish + cleanup):** publish and cleanup I/O go through first-party Octokit (`@octokit/rest`), discriminate faults STRUCTURALLY on `error.status`, never stderr text. The reader stays on native `fetch`/`res.status` -- do NOT retrofit the reader to Octokit.
- **D-05 (first-write-wins / no overwrite, TRUST-07):** the mirror never overwrites an existing hash-named asset. An already-exists response is a benign no-op, discriminated structurally (`error.status`); never conflated with a real fault, and a real fault never treated as absence.
- **D-06 (age-only, `created_at`):** retention prunes on absolute asset age via `created_at`. NO LRU, NO manifest.
- **D-07 (ONE coupled knob; default = 30 days):** `CACHE_MIRROR_MAX_AGE_DAYS` drives BOTH the cleanup window AND the reader's month-shard lookback through shared resolution. Never a second knob. Default = 30.
- **D-08 (month-shard read-window walk):** implement `shardTagsForWindow(maxAgeDays)` replacing `shardTag()` (`releases-backend.ts:139`). Returns shard tags covering the retention window, newest first; a lookup stops at the first hit; a MISS must exhaust the window. At 30 days this is 1-2 shards. ME-01 memoization is OPTIONAL at this width.
- **D-09 (cleanup = a SEPARATE scheduled workflow):** cleanup in its own daily scheduled workflow, single writer by construction, `concurrency:` group that QUEUES rather than cancels, same `contents:write` `GITHUB_TOKEN` (no PAT).
- **D-10 (list-phase aborts, delete-phase isolates):** the cleanup list phase aborts with ZERO deletions on any non-404 fault or incomplete pagination; the delete phase isolates per-item failures and exits non-zero on aggregated failure. Deletion is PER-ASSET. Test injects a mid-pagination fault and asserts no deletion. (ADR C9.)
- **D-11 (1000-asset cap -> skip-and-warn):** a shard at the 1000-asset per-release cap causes the publish path to SKIP the entry and emit a workflow annotation, never hard-fail the build. Cap is PER RELEASE (per month shard).
- **D-12 (~2 GiB boundary -> fail loud, pre-upload):** detect the boundary with a pre-upload byte-length check, not by catching an upload failure. An artifact at the cap MUST fail loud -- never silently truncate or drop.
- **D-13 (whole-run vs per-item):** a per-item publish failure is isolated and annotated; a whole-run publish/sync failure fails loud with a non-zero exit. Distinct paths, both tested.
- **D-14 (annotations via `@actions/core`):** `core.error`/`core.warning`/`core.notice`, already exact-pinned from 02-01. No raw `::error::` string echoing.
- **D-15 (fail loud):** a whole-run publish/sync failure emits an annotation AND exits non-zero.
- **D-16 (mirror only server-produced keys -- cheap prefix filter now):** mirror only keys carrying the `nx-cache-` prefix from `cacheKeyFor` (`actions-cache-backend.ts:13`). Full single-source filter + parity assertion is Phase 5. Safe here because `op-nx/github-cache` is PUBLIC.
- **D-17 ("is the cache working" signal):** emit the OBS-01 signal (a run summary / annotation reporting mirrored, skipped, and pruned counts). Prose docs are Phase 6.

### Claude's Discretion

Exact module, file, and function names; the precise injected Octokit client interface shape; the publish job's placement relative to existing ci.yml jobs; annotation wording; the summary format for D-17; and whether `shardTagsForWindow` lives beside `shardTag` or in its own module -- all at the planner's/executor's discretion within the decisions above.

### Deferred Ideas (OUT OF SCOPE)

- Full TRUST-08 server-produced-key filter with a single source of truth + parity assertion -> Phase 5.
- Write-trust widening to `pull_request`/`release` (TRUST-01) and the dependency-free action allowlist copy (TRUST-04) -> Phase 5.
- Consumer docs for the sync/cleanup layer and the "is the cache working" prose (DOCS-01..06) -> Phase 6. Phase 4 ships the SIGNAL (D-17), not the prose.
- Octokit convergence for the Phase 3 read path -> the reader stays on native `fetch` (D-04).
- Optional LRU via a `download_count`-delta manifest -> out of scope (ADR C8).
- Per-process shard-release-ID memoization -> optional optimization at a 30-day window (D-08).
- Synchronous write fan-out, an LRU manifest, a second retention knob -> out of scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TEST-03 | Publish + cleanup orchestration built behind an injected client and tested, with already-exists / not-found / other-fault branches | Standard Stack (Octokit) + "Injected narrow client seam" pattern + Code Examples (fault-shaped fakes with `{status}`) |
| TEST-04 | Cleanup bin wrapper spec: per-item isolation + non-zero exit on aggregated failure; paired with RETAIN-01's list-phase-abort test | Pattern 4 (list-abort / delete-isolate) + Validation Architecture (fault-injection row) |
| TEST-06 | Date-cleanup + read-only-local covered (expired pruned; within-window retained; local `put()` always 403) | Pattern 3 (age prune by `created_at`) + existing `createReleasesReadBackend.put()==='forbidden'` |
| ROBUST-01 | Structural error discrimination (`error.status`, not stderr) on BOTH publish and cleanup/delete; a real fault never treated as absence | Finding: Octokit throws `RequestError` with numeric `.status`; duck-type `typeof error.status === 'number'`; Pitfall 1 |
| ROBUST-02 | Large-body path verified for Releases; ~2 GiB/asset ceiling coincides with 2 GB body cap; fail loud, never truncate/drop | Finding: pre-upload `bytes.byteLength` check + explicit `content-length`; D-12; Pitfall 5 |
| ROBUST-05 | 1000-asset/release cap -> skip-and-warn (annotation, no hard-fail) | Pattern 2 (cap check from the paginated asset count) + `core.warning`; D-11 |
| TRUST-02 | Sync/publish gate = separate predicate `{push, schedule}` + default branch; test-locked to reject the 8 named events + non-default refs | Pattern 1 (sync-gate module) + default-branch detection via `GITHUB_EVENT_PATH` payload |
| TRUST-07 | First-write-wins / no-overwrite; same-hash trusted write is byte-identical (benign no-op) | Finding: duplicate asset -> 422; recommend pre-list existence check + 422 fallback; D-05 |
| RETAIN-01 | List phase aborts with zero deletions on any non-404 fault or incomplete pagination; delete phase isolates + non-zero exit | Pattern 4 + Finding: `octokit.paginate` REJECTS on any page fault (materialize-before-delete) |
| RETAIN-03 | Cleanup uses the same `contents:write` `GITHUB_TOKEN`, no PAT, under a queue-don't-cancel `concurrency:` group | Pattern 5 (cleanup workflow shape) + `concurrency.cancel-in-progress: false` |
| OBS-01 | Whole-run failure fails loud (annotation + non-zero exit); documented "is the cache working" signal | `@actions/core` `error`/`setFailed` + `core.summary` counts table; D-15/D-17 |
</phase_requirements>

## Summary

Phase 4 adds three new, independently-gated moving parts on top of the Phase 1-3 skeleton: (1) an **out-of-band publisher** that enumerates default-branch Actions-cache entries, restores each on its own OS leg, and uploads the bytes to a month-shard GitHub Release; (2) a **separate daily cleanup workflow** that prunes Release assets by absolute age; and (3) **workflow-annotation observability** so a whole-run failure is loud and a summary reports mirrored/skipped/pruned counts. All GitHub I/O for publish and cleanup goes through first-party `@octokit/rest` (D-04), which throws a `RequestError` carrying a numeric `.status` -- the entire structural-fault-discrimination requirement (ROBUST-01) reduces to reading `error.status`, never parsing text.

The three sharpest, non-obvious findings the planner must build around: (a) **a duplicate release-asset upload returns HTTP 422, not 409** -- so first-write-wins (TRUST-07/D-05) keys on `422`, and because `422` is also GitHub's generic validation status, the publisher should prefer a cheap pre-upload existence check (it must paginate the shard's assets anyway for the 1000-cap check, D-11) and treat a residual `422` race as benign only after confirming the body's `already_exists` code; (b) **`octokit.paginate` rejects the whole call if any page request fails**, which is exactly the guarantee RETAIN-01/C9 needs -- materialize the complete asset list first (it throws on incomplete pagination), and only then enter the delete phase, so a mid-list fault can never leave partial "orphan" deletions; (c) **the per-OS matrix is load-bearing and self-enforcing** -- `@actions/cache.restoreCache` recomputes its version from the local tmpdir path + compression, so a foreign-OS entry simply MISSes (returns `undefined`) and is skipped, which is why each leg mirrors only its own OS and collapsing the matrix silently drops the other OS's entries.

The publisher can **reuse the existing `createActionsCacheBackend().get(hash)`** (restore -> `readFile(cacheArchivePath)` -> `rm`) to fetch bytes on the same OS -- the only genuinely new I/O it needs is Octokit's `actions.getActionsCacheList` (to enumerate hashes) plus the Releases upload path. Retention is one coupled knob (`resolveMaxAgeDays`, default 30) feeding both a `shardTagsForWindow` **reader** walk (window-bounded, newest-first) and a **cleanup** scan that enumerates EVERY `cache-mirror-*` release (deliberately wider than the read window -- an out-of-window shard must still be pruned).

**Primary recommendation:** Add `@octokit/rest@22.0.1` as an exact-pinned dependency (extend `pinned-deps.spec.ts`); build one `sync-gate` predicate module, one `resolveMaxAgeDays` + `shardTagsForWindow` retention module (consumed by reader AND cleanup), one publish bin + one cleanup bin each behind a narrow injected client interface (the `ReleaseReadClient` precedent), a per-OS publish matrix job in `ci.yml`, and a separate daily `cleanup.yml` scheduled workflow. Discriminate every fault on `error.status`; fail loud via `core.setFailed`; skip-and-warn the 1000-cap via `core.warning`; fail loud pre-upload on ~2 GiB via `core.error`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Sync-gate predicate (event + default-branch) | Pure lib (`sync-gate.ts`) | Workflow `if:` (defense-in-depth) | D-01: the check is part of the predicate, not a workflow `if:` alone; test-lockable as a pure function |
| Enumerate Actions-cache entries to mirror | Octokit (`actions.getActionsCacheList`) | Workflow permission `actions:read` | D-04; the `@actions/cache` toolkit has no "list" API -- only the REST endpoint enumerates |
| Fetch cached bytes for a hash | `@actions/cache` (`restoreCache`) via existing `createActionsCacheBackend().get` | -- | D-03 same-OS restore; reuse the existing backend (ponytail rung 2) |
| Ensure shard release + upload asset | Octokit (`repos.getReleaseByTag`/`createRelease`/`uploadReleaseAsset`) | uploads.github.com host (auto) | D-04, D-05; upload is a distinct host with Content-Length finickiness (ROADMAP risk) |
| No-overwrite decision | Octokit response status (`201` vs `422`) + pre-list check | -- | D-05/TRUST-07; 422 = duplicate |
| ~2 GiB boundary detection | Pure lib (pre-upload `bytes.byteLength`) | -- | D-12: deterministic, before any I/O |
| Age-based pruning | Cleanup bin over Octokit (`repos.listReleases`/`listReleaseAssets`/`deleteReleaseAsset`) | Scheduled workflow (single writer) | D-06/D-09/D-10 |
| Retention resolution (one knob) | Pure lib (`resolveMaxAgeDays` + `shardTagsForWindow`) | consumed by reader + cleanup | D-07/D-08 |
| Observability (annotations + summary) | `@actions/core` in the bins | -- | D-14/D-15/D-17 |
| Cleanup credential + concurrency | Workflow config (`permissions`, `concurrency`) | -- | RETAIN-03/D-09 |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@octokit/rest` | 22.0.1 | Publish + cleanup GitHub I/O (releases, assets, actions-cache list); structural `error.status` fault discrimination | First-party GitHub SDK named in D-04 / ADR C12 / ROADMAP SC2; throws `RequestError` with numeric `.status` `[VERIFIED: npm registry]` |
| `@actions/core` | 3.0.1 | Workflow annotations (`error`/`warning`/`notice`), `setFailed` (non-zero exit), `summary` job-summary table | Already exact-pinned (02-01); D-14 forbids raw `::error::` echoing `[VERIFIED: repo package.json]` |
| `@actions/cache` | 6.2.0 | Same-OS `restoreCache` to fetch cached bytes for a hash (reused via existing backend) | Already exact-pinned; D-03 version-hash coupling is why the matrix is per-OS `[VERIFIED: repo package.json]` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node:fs` / `node:fs/promises` | Node 24 built-in | Read `GITHUB_EVENT_PATH` payload (default-branch); read restored archive bytes | Sync-gate default-branch detection; publisher byte read (already used by `actions-cache-backend`) |
| Node global `fetch` | Node 24 built-in | Injected into `new Octokit({ request: { fetch } })` if a custom fetch/timeout is wanted | Optional; Octokit uses global fetch by default on Node 24 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@octokit/rest` | `@octokit/action` (auth pre-wired from `GITHUB_TOKEN`) | `@octokit/action` auto-auths in Actions but hides the auth seam and adds implicit env coupling; D-04 names `@octokit/rest`, and passing `auth: token` explicitly is clearer and testable. Stay with `@octokit/rest`. |
| `@octokit/rest` (full) | `@octokit/core` + only the plugins used | Smaller, but `@octokit/rest` bundles `plugin-rest-endpoint-methods` + `plugin-paginate-rest` (the exact methods D-04 needs) and is the named choice. Not worth hand-composing. |
| Direct `import { RequestError }` + `instanceof` | Duck-typed `typeof error.status === 'number'` | `instanceof` breaks when two `@octokit/request-error` versions coexist in the tree; duck-typing on `.status` is the documented pattern ("Octokit errors always have a `error.status`") and needs no extra direct dep. Prefer duck-typing. |
| `octokit.paginate.iterator` (stream pages) | `octokit.paginate(...)` (materialize all) | The iterator would tempt delete-as-you-go, defeating RETAIN-01. `octokit.paginate` returns the complete array and REJECTS on any page fault -- exactly the list-abort guarantee. Prefer full materialization. |

**Installation:**
```bash
npm install @octokit/rest@22.0.1 -w @op-nx/github-cache
```
Then extend `packages/github-cache/src/pinned-deps.spec.ts` to assert `@octokit/rest` matches `EXACT_SEMVER` (the guard already covers `@actions/cache` and `@actions/core`).

**Version verification:** `npm view @octokit/rest version` -> `22.0.1` (published 2025-10-31; `dist-tags.latest = 22.0.1`). Transitive (arrive with `@octokit/rest`, no direct dep needed): `@octokit/request-error@7.1.0` (the `RequestError` class), `@octokit/plugin-paginate-rest@14.0.0` (`octokit.paginate`). All verified against the npm registry on 2026-07-20.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| `@octokit/rest` | npm | since 2018-01-17 (~8 yr) | ~15.8M/wk | github.com/octokit/rest.js (maintainer `octokitbot <security+octokitbot@github.com>`) | OK | Approved (add as exact-pinned direct dep) |
| `@octokit/request-error` | npm (transitive) | since 2019-05-16 (~7 yr) | (transitive of `@octokit/rest`) | github.com/octokit/request-error.js | OK | Approved (transitive; do NOT add a direct dep -- duck-type `.status`) |
| `@octokit/plugin-paginate-rest` | npm (transitive) | mature | (transitive of `@octokit/rest`) | github.com/octokit/plugin-paginate-rest.js | OK | Approved (transitive; provides `octokit.paginate`) |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** none. `npm view @octokit/rest scripts.postinstall` and `@octokit/request-error scripts.postinstall` both returned empty (no postinstall scripts). `@octokit/rest` is the official GitHub Octokit SDK (org `octokit`, published by `octokitbot@github.com`), named in the locked decision D-04 and documented at octokit.github.io/rest.js -> `[VERIFIED: npm registry]`.

## Architecture Patterns

### System Architecture Diagram

```
                          PUBLISH  (ci.yml, per-OS matrix, {push,schedule} + default branch)
                          ================================================================
GITHUB_EVENT_PATH ---> [ sync-gate predicate ] --pass--> continue ; --fail--> exit 0 (not an error)
   + GITHUB_EVENT_NAME     (D-01/TRUST-02)                                     |
   + GITHUB_REF_NAME                                                          gated OUT
                                                                              (silent, no publish)
[ Octokit.actions.getActionsCacheList ]  --octokit.paginate-->  all entries
   (ref=default branch)                                              |
        (needs actions:read)                        filter key startsWith 'nx-cache-'  (D-16)
                                                                     |
                                            for each hash (strip 'nx-cache-'):
                                                                     |
   [ createActionsCacheBackend().get(hash) ] --restoreCache(this OS)--> HIT bytes | MISS (undefined)
        (@actions/cache, cacheArchivePath)                              |             |
                                                                        |          skip (D-03/Pitfall foreign-OS or evicted)
                                        pre-upload byte-length check (D-12)
                                          bytes.byteLength >= ~2GiB ? --yes--> core.error + fail loud (ROBUST-02)
                                                                        | no
                        [ ensure shard release: getReleaseByTag(shardTag) 404? -> createRelease ]
                                                                        |
                        [ listReleaseAssets (paginate) ] -> asset-name set + count
                              count >= 1000 ? --yes--> core.warning + skip (ROBUST-05/D-11)  (NO fail)
                              name already present ? --yes--> benign no-op (D-05 first-write-wins)
                                                                        | else
                        [ Octokit.repos.uploadReleaseAsset (uploads.github.com) ]
                              201 -> mirrored++ ; 422 already_exists -> benign no-op ;
                              other error.status -> per-item annotate (D-13) ; whole-run fault -> setFailed
                                                                        |
                        [ core.summary: mirrored / skipped / pruned counts ] (D-17)  --> job summary


                          CLEANUP  (cleanup.yml, schedule daily, single writer, queue-don't-cancel)
                          ====================================================================
[ resolveMaxAgeDays(env) ]  (default 30, clamp, reject NaN/neg)
        |
LIST PHASE  (fail-loud, zero-delete on any non-404 fault / incomplete pagination -- D-10/C9)
   [ Octokit.repos.listReleases (paginate ALL cache-mirror-*) ]
   [ Octokit.repos.listReleaseAssets (paginate) per release ]  --octokit.paginate throws on any page fault-->
        materialize the COMPLETE {release, asset, created_at} set  (throw -> abort, ZERO deletions)
        |
DELETE PHASE  (per-item isolation, non-zero exit on aggregate -- D-10/TEST-04)
   for each asset where age(created_at) > maxAgeDays:
        try Octokit.repos.deleteReleaseAsset(asset_id) -> pruned++ ; catch -> record failure, continue
   any failure ? --> core.setFailed (non-zero exit)
   [ core.summary: pruned / failed counts ]  (D-17)


                          READ  (serve path, native fetch, UNCHANGED client -- D-04 do NOT converge)
                          =======================================================================
[ resolveMaxAgeDays(env) ] -> [ shardTagsForWindow(maxAgeDays) ] newest-first  (D-07/D-08)
   for each shard tag (newest first): getReleaseByTag 404? -> next shard ;
        list assets (paginate) find releaseAssetName(hash) -> download & return HIT
   exhaust all shards -> MISS
```

### Recommended Project Structure
```
packages/github-cache/src/
  lib/
    sync-gate.ts            # D-01/TRUST-02: separate {push,schedule}+default-branch predicate (NOT trust.ts)
    sync-gate.spec.ts
    retention.ts            # D-07/D-08: resolveMaxAgeDays + shardTagsForWindow (shared reader+cleanup)
    retention.spec.ts
  backend/
    releases-backend.ts     # D-08: replace shardTag() call site with shardTagsForWindow walk
  publish/
    publish-mirror.ts       # D-02/D-03/D-04/D-05/D-11/D-12: orchestration behind an injected client
    publish-mirror.spec.ts  # TEST-03: already-exists / not-found / other-fault branches
  cleanup/
    cleanup.ts              # D-06/D-09/D-10: list-abort / delete-isolate behind an injected client
    cleanup.spec.ts         # TEST-04/RETAIN-01: mid-pagination fault -> zero deletions
  action/ or bin/
    publish/index.ts        # thin bin: sync-gate check -> construct real Octokit client -> publish-mirror
    cleanup/index.ts        # thin bin: construct real Octokit client -> cleanup; core.setFailed on aggregate
.github/workflows/
  ci.yml                    # add per-OS publish matrix job (needs: build, if: !cancelled() && push, permissions contents:write + actions:read)
  cleanup.yml               # NEW: schedule (daily) + concurrency queue-don't-cancel, permissions contents:write
```
(Exact names/placement are Claude's Discretion per CONTEXT; the structure above matches the repo's existing `lib/` + `backend/` + `action/` layout.)

### Pattern 1: Sync-gate predicate (separate from the write gate)
**What:** A pure, injectable predicate `{push, schedule}` AND ref is `refs/heads/<default-branch>`. Own frozen event set; must NOT import `TRUSTED_EVENTS`/`isWriteTrusted` (D-01: Phase 5 widens the write set; sync must not widen with it).
**When to use:** First statement of the publish bin; a fail returns exit 0 (gated out, not an error).
**Example:**
```typescript
// Source: pattern derived from lib/trust.ts + GitHub Actions env contract (docs.github.com/en/actions/reference/variables)
// Default branch is read from the event payload, NOT a dedicated env var.
import { readFileSync } from 'node:fs';

// Separate source of truth on purpose (D-01): do NOT reuse TRUSTED_EVENTS.
const SYNC_EVENTS = ['push', 'schedule'] as const;

/** Read repository.default_branch from the event payload JSON (GITHUB_EVENT_PATH). */
function defaultBranch(env: NodeJS.ProcessEnv): string | undefined {
  const path = env.GITHUB_EVENT_PATH;
  if (!path) {
    return undefined;
  }
  try {
    const payload = JSON.parse(readFileSync(path, 'utf8')) as {
      repository?: { default_branch?: string };
    };
    return payload.repository?.default_branch;
  } catch {
    return undefined; // unreadable payload -> fail-closed (not synced)
  }
}

export function isSyncTrusted(
  env: NodeJS.ProcessEnv = process.env,
  readDefaultBranch: (e: NodeJS.ProcessEnv) => string | undefined = defaultBranch,
): boolean {
  if (env.GITHUB_ACTIONS !== 'true') {
    return false;
  }
  if (!(SYNC_EVENTS as readonly string[]).includes(env.GITHUB_EVENT_NAME ?? '')) {
    return false; // rejects pull_request/release/repository_dispatch/workflow_dispatch/merge_group/delete/registry_package/page_build
  }
  const ref = env.GITHUB_REF ?? '';
  if (!ref.startsWith('refs/heads/')) {
    return false; // rejects tags and non-branch refs
  }
  const branch = env.GITHUB_REF_NAME ?? '';
  const def = readDefaultBranch(env);
  return def !== undefined && branch === def; // default-branch check IS part of the predicate (D-01)
}
```

### Pattern 2: Octokit construction + duck-typed structural fault discrimination (ROBUST-01)
**What:** One authenticated Octokit instance from `GITHUB_TOKEN`; every fault branch reads `error.status`.
**When to use:** Every publish/cleanup GitHub call.
**Example:**
```typescript
// Source: octokit.github.io/rest.js/v22 + github.com/octokit/request-error.js
import { Octokit } from '@octokit/rest';

const octokit = new Octokit({ auth: token }); // token = GH_TOKEN||GITHUB_TOKEN (reuse resolveGitHubToken)

// Duck-type on .status (docs: "Octokit errors always have an error.status property").
// Avoids an instanceof pitfall when multiple @octokit/request-error versions coexist.
function statusOf(error: unknown): number | undefined {
  return error && typeof (error as { status?: unknown }).status === 'number'
    ? (error as { status: number }).status
    : undefined;
}

try {
  await octokit.rest.repos.getReleaseByTag({ owner, repo, tag });
} catch (error) {
  if (statusOf(error) === 404) {
    // ordinary "shard not created yet" -> create it (publish) / skip it (cleanup)
  } else {
    throw error; // a REAL fault (401/403/429/5xx) -- never inferred as absence (ROBUST-01, Pitfall 1)
  }
}
```

### Pattern 3: Get-or-create shard release; upload with a pre-upload size guard + first-write-wins
**What:** Ensure the month-shard release exists, then upload the OS-namespaced asset without ever overwriting.
**When to use:** The publish inner loop.
**Example:**
```typescript
// Sources: docs.github.com/en/rest/releases/releases + .../releases/assets + octokit.github.io/rest.js/v22
import * as core from '@actions/core';
import * as assetNaming from '../lib/release-asset-name.js'; // single-source name (D-05/D-16, CORR-01)

const RELEASE_ASSET_MAX_BYTES = 2 * 1024 * 1024 * 1024; // ~2 GiB ceiling == 2 GB body cap (ROBUST-02/D-12)

// 1. get-or-create the shard release (handles a concurrent-create race across matrix legs).
async function ensureShardRelease(tag: string): Promise<number> {
  try {
    const { data } = await octokit.rest.repos.getReleaseByTag({ owner, repo, tag });
    return data.id;
  } catch (error) {
    if (statusOf(error) !== 404) {
      throw error;
    }
  }
  try {
    const { data } = await octokit.rest.repos.createRelease({ owner, repo, tag_name: tag });
    return data.id;
  } catch (error) {
    if (statusOf(error) === 422) {
      // Another leg created it first -> re-read (422 = validation, incl. "tag already exists").
      const { data } = await octokit.rest.repos.getReleaseByTag({ owner, repo, tag });
      return data.id;
    }
    throw error;
  }
}

// 2. per-hash: cap check, pre-upload size check, first-write-wins upload.
async function mirrorHash(releaseId: number, hash: string, bytes: Buffer, existingNames: Set<string>): Promise<'mirrored' | 'skipped'> {
  const name = assetNaming.releaseAssetName(hash); // OS from process.platform on THIS leg

  // D-12: deterministic pre-upload boundary check -- BEFORE any I/O, fail loud.
  if (bytes.byteLength >= RELEASE_ASSET_MAX_BYTES) {
    core.error(`github-cache: asset ${name} is ${bytes.byteLength} bytes, at/over the ~2 GiB Releases ceiling; refusing to upload (never truncate).`);
    throw new Error('asset exceeds the ~2 GiB release-asset ceiling'); // whole-run fail loud (ROBUST-02)
  }

  // D-11: 1000-asset per-release cap -> skip-and-warn, NEVER hard-fail (ROBUST-05).
  if (existingNames.size >= 1000 && !existingNames.has(name)) {
    core.warning(`github-cache: month-shard release at the 1000-asset cap; skipping ${name} (cache MISS-on-write, not an error).`);
    return 'skipped';
  }

  // D-05 first-write-wins: prefer the cheap pre-list check (existingNames already in hand).
  if (existingNames.has(name)) {
    return 'skipped'; // byte-identical under CORR-01; benign no-op, no upload.
  }

  try {
    await octokit.rest.repos.uploadReleaseAsset({
      owner, repo, release_id: releaseId, name,
      data: bytes as unknown as string, // Octokit accepts a Buffer here
      headers: { 'content-type': 'application/octet-stream', 'content-length': String(bytes.byteLength) },
    });
    return 'mirrored';
  } catch (error) {
    // Residual race: another leg uploaded the same name between our list and upload.
    if (statusOf(error) === 422) {
      return 'skipped'; // benign already-exists (D-05); see Assumptions Log A1 re: 422 body precision
    }
    throw error; // real fault -> per-item annotate (D-13) at the call site
  }
}
```

### Pattern 4: Cleanup list-abort / delete-isolate (RETAIN-01, C9, TEST-04)
**What:** Materialize the COMPLETE asset set first (paginate throws on any fault); only then delete; isolate per-item; non-zero on aggregate.
**When to use:** The cleanup bin.
**Example:**
```typescript
// Source: github.com/octokit/plugin-paginate-rest.js (octokit.paginate rejects if any page request fails)
import * as core from '@actions/core';

async function cleanup(maxAgeDays: number): Promise<void> {
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;

  // LIST PHASE -- any throw here aborts with ZERO deletions (D-10). Enumerate EVERY cache-mirror-* release
  // (deliberately wider than the read window: an out-of-window shard must still be pruned).
  const releases = await octokit.paginate(octokit.rest.repos.listReleases, { owner, repo, per_page: 100 });
  const expired: { assetId: number; name: string }[] = [];
  for (const release of releases) {
    if (!release.tag_name.startsWith('cache-mirror-')) {
      continue;
    }
    // paginate REJECTS on a mid-list fault -> propagates -> zero deletions (incomplete pagination = abort).
    const assets = await octokit.paginate(octokit.rest.repos.listReleaseAssets, {
      owner, repo, release_id: release.id, per_page: 100,
    });
    for (const asset of assets) {
      if (new Date(asset.created_at).getTime() < cutoff) {
        expired.push({ assetId: asset.id, name: asset.name });
      }
    }
  }

  // DELETE PHASE -- per-item isolation; aggregate failure -> non-zero exit (TEST-04).
  let pruned = 0;
  let failed = 0;
  for (const { assetId, name } of expired) {
    try {
      await octokit.rest.repos.deleteReleaseAsset({ owner, repo, asset_id: assetId });
      pruned++;
    } catch (error) {
      failed++;
      core.warning(`github-cache: failed to delete ${name} (status ${statusOf(error) ?? 'unknown'}); continuing.`);
    }
  }

  core.summary.addHeading('github-cache cleanup', 2).addTable([
    [{ data: 'metric', header: true }, { data: 'count', header: true }],
    ['pruned', String(pruned)], ['failed', String(failed)], ['scanned', String(expired.length)],
  ]);
  await core.summary.write();

  if (failed > 0) {
    core.setFailed(`github-cache cleanup: ${failed} asset deletion(s) failed.`);
  }
}
```

### Pattern 5: Retention resolution + shard-window walk (D-07/D-08)
**What:** One coupled knob resolver + a calendar-month shard-window generator; the reader loop replaces the `shardTag()` single call site.
**Example:**
```typescript
// Source: releases-backend.ts:139 upgrade path + PITFALLS.md "calendar-month arithmetic, not maxAgeDays/30"
const DEFAULT_MAX_AGE_DAYS = 30; // D-07
const MAX_AGE_CEILING_DAYS = 365; // clamp a fat-fingered value (PITFALLS minor)

export function resolveMaxAgeDays(env: NodeJS.ProcessEnv = process.env): number {
  const raw = Number(env.CACHE_MIRROR_MAX_AGE_DAYS);
  if (!Number.isFinite(raw) || raw <= 0) {
    return DEFAULT_MAX_AGE_DAYS;
  }
  return Math.min(Math.floor(raw), MAX_AGE_CEILING_DAYS);
}

/** Shard tags covering [now - maxAgeDays, now], NEWEST FIRST. Calendar-month arithmetic, not /30. */
export function shardTagsForWindow(maxAgeDays: number, now: Date = new Date()): string[] {
  const oldest = new Date(now.getTime() - maxAgeDays * 24 * 60 * 60 * 1000);
  const tags: string[] = [];
  const cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  while (cursor.getTime() >= Date.UTC(oldest.getUTCFullYear(), oldest.getUTCMonth(), 1)) {
    const y = cursor.getUTCFullYear();
    const m = String(cursor.getUTCMonth() + 1).padStart(2, '0');
    tags.push(`cache-mirror-${y}${m}`); // newest first (cursor starts at current month, steps back)
    cursor.setUTCMonth(cursor.getUTCMonth() - 1);
  }
  return tags;
}
```
Reader integration (D-08): in `createReleasesReadClient.fetchAsset`, loop `shardTagsForWindow(resolveMaxAgeDays(env))` newest-first; per tag do the existing `releases/tags/{tag}` -> paginate-assets -> download sequence; a `404` on a tag means "not in this shard, try next"; only `undefined` after exhausting ALL shards is a MISS.

### Anti-Patterns to Avoid
- **Reusing `isWriteTrusted`/`TRUSTED_EVENTS` for the sync gate.** Silently widens SYNC when Phase 5 widens WRITE (D-01, the exact CREEP precondition C2 prevents). Build a separate predicate.
- **`octokit.paginate.iterator` + delete-as-you-go.** A mid-stream fault leaves earlier pages already deleted -> live-data loss on a partial listing (Pitfall 5/8). Materialize first.
- **Treating a duplicate-asset `422` (or any caught error) as "safe to overwrite / already gone".** A real `422`/`5xx` is a fault, not an already-exists (Pitfall 8). Confirm the `already_exists` code (see A1) or rely on the pre-list check.
- **Inferring the default branch from `GITHUB_REF_NAME` alone.** `GITHUB_REF_NAME` is just the current branch; you must compare it to the repo's `default_branch` (from the event payload). A tag push has `GITHUB_REF_NAME` too -- also require `refs/heads/`.
- **Depending the publish job on the test matrix.** One failing test leg would skip the whole mirror, dropping already-written build/typecheck entries. Use `needs: build` + `if: ${{ !cancelled() }}` (empirically-verified fact, PITFALLS).
- **A job-level `permissions:` block that lists only `contents: write`.** It REPLACES the workflow grant wholesale; `actions:read` drops to none and `getActionsCacheList` 404s. Restate BOTH scopes on the publish job.
- **Editing `cacheArchivePath` / `releaseAssetName` / the per-OS matrix.** All three are comment-locked; drift is a silent cross-OS MISS (Pitfall 7).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| GitHub REST auth, retries, endpoint typing | A `fetch` wrapper for releases/assets | `@octokit/rest` (D-04) | First-party, typed endpoints, `RequestError.status`; the reader's hand-rolled fetch is deliberately kept only because it is the zero-dep serve path |
| Structural fault discrimination | Parsing `gh` stderr / error messages | `error.status` (Octokit `RequestError`) | Text drifts across `gh`/API versions and locales (Pitfall 8, PoC debt); status is stable |
| Multi-page list assembly | Manual `page++` loops for cleanup | `octokit.paginate(...)` | It materializes all pages AND rejects on any page fault -- the exact list-abort guarantee (RETAIN-01) |
| Workflow annotations / job summary | Raw `::error::`/`::warning::` echo, hand-written markdown | `@actions/core` `error`/`warning`/`notice`/`summary` (D-14) | Escaping + summary-file plumbing handled; consistent with 02-01 |
| Fetch cached bytes for a hash | A second `restoreCache` call site | Reuse `createActionsCacheBackend().get(hash)` | Already routes through `cacheArchivePath` + `cacheKeyFor`, cleans up the temp file, and MISSes foreign-OS entries correctly (D-03) |
| OS-namespaced asset name | A new name template in the publisher | `releaseAssetName(hash)` (comment-locked) | D-05/D-16/CORR-01: a drift from the reader is a silent cross-OS MISS (Pitfall 7) |
| Enumerating Actions caches | Scraping the UI / guessing keys | `octokit.rest.actions.getActionsCacheList` | The `@actions/cache` toolkit has NO list API; the REST endpoint is the only enumeration path |

**Key insight:** Almost every "new" capability in this phase is an assembly of existing single-source helpers (`releaseAssetName`, `cacheArchivePath`, `cacheKeyFor`, `resolveGitHubToken`) plus Octokit calls. The only genuinely new pure logic is the sync-gate predicate and `shardTagsForWindow` -- both small, both testable in isolation.

## Common Pitfalls

### Pitfall 1: Treating a real fault as absence (or a real 422 as "already exists")
**What goes wrong:** A `401`/`403`/`429`/`5xx` on `getReleaseByTag`/`listReleaseAssets` is swallowed as "not found", or a `422` that means a genuine validation error is treated as a benign duplicate. On the cleanup path this deletes live data; on the publish path it can overwrite or drop.
**Why it happens:** "Best-effort read degrades to MISS" over-applied to non-read paths (Pitfall 8 in PITFALLS.md).
**How to avoid:** Only `status === 404` means absence; every other status throws. For the duplicate case, prefer the pre-list existence check and confirm the `already_exists` code before treating a `422` as benign.
**Warning signs:** Mirror assets disappear after a cleanup run that logged rate-limit warnings; a publish "succeeds" while entries silently vanish.

### Pitfall 2: The per-OS matrix collapsed to one OS
**What goes wrong:** `restoreCache` on the wrong OS returns `undefined` (version-hash mismatch), so foreign-OS entries are silently skipped; collapsing to one leg drops the other OS's entries with no error.
**Why it happens:** The matrix looks like redundant CI cost.
**How to avoid:** Keep `[ubuntu-24.04-arm, windows-11-arm]`, `fail-fast: false`; comment-lock the reason; each leg uploads only what its own `restoreCache` returns.
**Warning signs:** A wave of Windows (or Linux) local cache MISSes after a "CI simplification".

### Pitfall 3: Job-level permissions dropping `actions:read`
**What goes wrong:** `getActionsCacheList` returns 404 because a job that set only `contents: write` lost the workflow's `actions:read`.
**Why it happens:** Job-level `permissions:` REPLACE the workflow grant wholesale (no merge) -- empirically verified (PITFALLS.md).
**How to avoid:** On the publish job set BOTH `contents: write` AND `actions: read`. The cleanup job needs only `contents: write` (it does not list caches).
**Warning signs:** `getActionsCacheList` 404 that reads like an existence/permissions bug.

### Pitfall 4: Cleanup scanning only the read window
**What goes wrong:** Cleanup uses `shardTagsForWindow` and never revisits a shard that aged out of the window (after a publish gap or a shortened knob), orphaning assets toward the per-release cap.
**Why it happens:** The read window and the cleanup scan look like the same scope; they are intentionally asymmetric (PITFALLS.md "Windowed-shard retention").
**How to avoid:** Cleanup enumerates EVERY `cache-mirror-*` release (`listReleases` paginated) and prunes by `created_at`; the reader alone uses the window walk. Same knob (`resolveMaxAgeDays`), different scan scope.
**Warning signs:** Mirror total size grows steadily despite cleanup running.

### Pitfall 5: Content-Length finickiness on `uploads.github.com` (~2 GiB)
**What goes wrong:** A large `uploadReleaseAsset` fails or (worse) truncates because the upload host mishandles a missing/streamed Content-Length; catching the failure after the fact is non-deterministic.
**Why it happens:** Uploads go to a different host with its own body handling (ROADMAP risk).
**How to avoid:** Do the deterministic pre-upload `bytes.byteLength` check (D-12) and set `content-length` explicitly; buffer the asset in memory (already the model, per ROBUST-02) so the length is known. Fail loud via `core.error` before uploading.
**Warning signs:** Intermittent 502s from `uploads.github.com`; an asset in state `starter` (empty).

## Code Examples

Cross-referenced in Patterns 1-5 above (sync-gate, Octokit + `error.status`, get-or-create + size guard + first-write-wins, cleanup list-abort/delete-isolate, retention window). Sources: octokit.github.io/rest.js/v22; docs.github.com/en/rest/releases/{releases,assets}; docs.github.com/en/rest/actions/cache; github.com/octokit/request-error.js; github.com/octokit/plugin-paginate-rest.js; github.com/actions/toolkit (packages/core).

### Actions-cache enumeration (the one new I/O the publisher needs)
```typescript
// Source: docs.github.com/en/rest/actions/cache + octokit.github.io/rest.js/v22 (#actions-get-actions-cache-list)
// Response entry shape: { id, ref, key, version, last_accessed_at, created_at, size_in_bytes }
const caches = await octokit.paginate(octokit.rest.actions.getActionsCacheList, {
  owner, repo,
  ref: env.GITHUB_REF, // scope to the default branch's ref (e.g. refs/heads/main)
  per_page: 100,
});
const hashes = caches
  .filter((c) => c.key.startsWith('nx-cache-')) // D-16 cheap prefix filter (TRUST-08 subset)
  .map((c) => c.key.slice('nx-cache-'.length));
// Each leg then restores per hash on its OWN OS; a foreign-OS entry MISSes and is skipped (D-03).
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `gh` CLI + stderr text-matching for outcome discrimination (the PoC) | `@octokit/rest` + `error.status` structural discrimination | This rebuild (D-04) | No locale/version-drift in fault handling (Pitfall 8) |
| Duplicate-asset overwrite assumed to be `409` | Duplicate release asset returns **422** (409 is not used for release assets) | GitHub REST contract | First-write-wins keys on 422, and 422 needs body/pre-list disambiguation (A1) |
| Single-shard `shardTag()` current-month stub | `shardTagsForWindow(maxAgeDays)` newest-first walk | This phase (D-08) | Reader survives a month boundary; MISS exhausts the window |
| Manual `page++` REST loops | `octokit.paginate` (throws on any page fault) | Octokit `plugin-paginate-rest` 14 | Gives RETAIN-01's list-abort guarantee for free |

**Deprecated/outdated:**
- `enableCrossOsArchive` as a cross-OS fix: does NOT rescue a zstd-vs-gzip compression mismatch (actions/cache#1622). OS-partition instead (D-03).
- Reading a release's inline `assets` array: a non-paginated first-page snapshot; paginate the assets endpoint (Pitfall 7 / releases-backend.ts already does this for reads).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A duplicate-asset `422` response body carries an `errors` array with `code: "already_exists"` (letting the publisher distinguish a benign duplicate from a generic validation `422`) | Pattern 3, Pitfall 1 | If the body code differs, status-only `422` handling could treat a real validation fault as benign. MITIGATION already recommended: use the pre-upload existence check (from the paginated asset set the publisher fetches anyway for the cap) as the primary no-overwrite mechanism, making the `422` catch a rare race fallback. Verify the body shape empirically during implementation (or in the live cross-OS round-trip). |
| A2 | `octokit.rest.repos.uploadReleaseAsset` accepts a Node `Buffer` as `data` and sets the upload host from the release automatically | Standard Stack, Pattern 3 | If a Buffer is not accepted directly, wrap as needed; the pre-upload byte-length check (D-12) is independent of this and still fires. Confirm against octokit.github.io/rest.js/v22 during implementation. |
| A3 | `getActionsCacheList` via `GITHUB_TOKEN` requires the fine-grained `actions: read` repository permission (the docs page cited `repo` scope for classic PATs) | Pitfall 3, Environment Availability | If the required scope differs, the publish job's `permissions:` block needs adjusting; the empirically-verified repo fact (PITFALLS.md: only-`contents:write` -> caches list 404s) strongly supports `actions:read`. |

## Open Questions (RESOLVED)

1. **Should the publish job trigger on `schedule` as well as `push`?**
   - What we know: the sync-gate predicate ACCEPTS both `push` and `schedule` (TRUST-02); `ci.yml` currently triggers on `push: main` + `pull_request`.
   - What's unclear: whether a scheduled publish adds value (it would re-mirror whatever Actions-cache entries survive) vs. push-only.
   - Recommendation: gate in the bin (load-bearing) regardless; wire the publish job to `push` (matching existing CI) and optionally add a `schedule` trigger later. The predicate must still accept `schedule` for the test-lock.
   - RESOLVED: 04-06 Task 2 wires the publish matrix job to `if: github.event_name == 'push'` (push-only, matching existing CI) while `isSyncTrusted` still accepts `schedule` for the test-lock (04-01). A `schedule` trigger can be added later without touching the gate.

2. **Does the live cross-OS round-trip (deferred from Phase 3) run as a CI job or a local integration test?**
   - What we know: it needs real GitHub Releases + real cross-OS Actions cache, like the dogfood-seed/verify pair.
   - What's unclear: the exact shape.
   - Recommendation: model it as a CI job pair (per-OS publish -> a read-back that resolves via the Releases mirror on the other OS), analogous to `dogfood-seed`/`dogfood-verify`; the local Vitest suite covers the injected-client branches.
   - RESOLVED: 04-06 Task 3 models it as a push-gated CI job pair (per-OS publish matrix -> a read-back invoking the real Releases reader directly), analogous to `dogfood-seed`/`dogfood-verify`; the injected-client branches stay covered by the local Vitest suite.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | all bins/tests | Yes (repo `.node-version`) | 24 | -- |
| `@octokit/rest` | publish + cleanup I/O | To install | 22.0.1 | none (D-04 mandates it) |
| `@actions/core` | annotations + summary | Yes (dep) | 3.0.1 | -- |
| `@actions/cache` | same-OS restore | Yes (dep) | 6.2.0 | -- |
| `GITHUB_TOKEN` with `contents:write` | publish upload + cleanup delete | Runner-injected | -- | none (RETAIN-03: no PAT) |
| `GITHUB_TOKEN` with `actions:read` | `getActionsCacheList` | Must be granted on the publish job | -- | none (A3) |
| `windows-11-arm` + `ubuntu-24.04-arm` runners | per-OS matrix | Yes (existing integration matrix) | -- | none (D-03 load-bearing) |

**Missing dependencies with no fallback:** `@octokit/rest` must be installed and exact-pinned before publish/cleanup can be built.
**Missing dependencies with fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ~4.1.0 via `@nx/vitest` |
| Config file | `packages/github-cache/vitest.config.mts` (+ `vitest.workspace.ts`) |
| Quick run command | `npx nx test github-cache` |
| Full suite command | `npm run test` (`nx run-many -t test`) + `npm run integration` (`nx run-many -t integration`, per-OS `process.platform` discriminator) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TRUST-02 | Sync gate accepts `{push,schedule}`+default branch; rejects the 8 named events + non-default/tag refs | unit (property over event set) | `npx nx test github-cache` | Wave 0 |
| TEST-03 | Publish orchestration: already-exists (422) / not-found (404) / other-fault (5xx) branches behind an injected client | unit (fault-shaped fakes) | `npx nx test github-cache` | Wave 0 |
| ROBUST-01 | `error.status` discrimination on BOTH publish and cleanup; a `5xx`/`429` never treated as absence | unit (fault injection) | `npx nx test github-cache` | Wave 0 |
| TRUST-07 | Duplicate asset -> benign no-op (no overwrite); real fault -> surfaced | unit (fault injection) | `npx nx test github-cache` | Wave 0 |
| ROBUST-02 | ~2 GiB pre-upload byte-length check fails loud (no upload attempted at/over the cap) | unit (boundary) | `npx nx test github-cache` | Wave 0 |
| ROBUST-05 | 1000-asset cap -> `core.warning` + skip, NO non-zero exit | unit (cap boundary) | `npx nx test github-cache` | Wave 0 |
| RETAIN-01 / TEST-04 | Mid-pagination fault -> ZERO deletions; delete phase isolates per-item + non-zero exit on aggregate | unit (fault injection) | `npx nx test github-cache` | Wave 0 |
| TEST-06 | Expired pruned; within-window retained (by `created_at`); local `put()` returns 403 | unit | `npx nx test github-cache` | Wave 0 (put()==='forbidden' exists) |
| RETAIN-03 | Cleanup workflow: `contents:write` `GITHUB_TOKEN` (no PAT) + `concurrency` queue-don't-cancel | config assertion / workflow lint | manual + `cleanup.yml` review | Wave 0 |
| OBS-01 | Whole-run failure -> `core.setFailed` (non-zero exit) + annotation; summary counts emitted | unit (spy on `@actions/core`) | `npx nx test github-cache` | Wave 0 |
| D-07/D-08 | `shardTagsForWindow` calendar-month correctness (month boundary, short months, UTC); `resolveMaxAgeDays` default/clamp | unit (property/boundary) | `npx nx test github-cache` | Wave 0 |
| cross-OS round-trip (deferred from Phase 3) | Publish on OS A, resolve via Releases mirror on OS B (OS-invariant HIT + OS-sensitive MISS) | integration / CI job | `npx nx integration github-cache` or a CI job pair | Wave 0 (no integration spec yet) |

**Classification for the Nyquist auditor:**
- **Fault-injection tests (highest priority):** RETAIN-01/TEST-04 (mid-pagination abort -> zero deletions -- the ROADMAP's named cleanup risk); ROBUST-01/TRUST-07 (404 vs 422 vs 5xx branches); ROBUST-02 (~2 GiB boundary). Drive these by making the injected fake throw an object shaped `{ status, response: { data: { errors: [{ code: 'already_exists' }] } } }`.
- **Property / boundary tests:** `shardTagsForWindow` across a December->January boundary, a 28-day February, and exactly-30-days windows (assert newest-first, no `/30` under-scan); `resolveMaxAgeDays` NaN/negative/over-ceiling -> default/clamp; the 1000-asset cap at 999/1000/1001.
- **Ordinary unit tests behind the injected client:** TEST-03 happy-path publish; TEST-06 age prune + within-window retain + `put()===403`; TRUST-02 sync-gate event/ref matrix; OBS-01 annotation/summary emission (spy on `@actions/core`).
- **Live / integration (CI, not local Vitest):** the cross-OS round-trip through the real Releases mirror (needs real network + both runner OSes) -- model as a CI job pair like `dogfood-seed`/`dogfood-verify`.

### Sampling Rate
- **Per task commit:** `npx nx test github-cache`
- **Per wave merge:** `npm run test` + `npm run typecheck` + `npm run build`
- **Phase gate:** full suite green (incl. `pinned-deps.spec.ts` extended for `@octokit/rest`) before `/gsd:verify-work`; the CI cross-OS round-trip green on a real push.

### Wave 0 Gaps
- [ ] `src/lib/sync-gate.spec.ts` -- covers TRUST-02
- [ ] `src/lib/retention.spec.ts` -- covers D-07/D-08 (`resolveMaxAgeDays`, `shardTagsForWindow`)
- [ ] `src/publish/publish-mirror.spec.ts` -- covers TEST-03, ROBUST-01/02/05, TRUST-07
- [ ] `src/cleanup/cleanup.spec.ts` -- covers TEST-04/06, RETAIN-01, OBS-01
- [ ] Extend `src/pinned-deps.spec.ts` -- assert `@octokit/rest` exact-pinned
- [ ] A shared `octokitFault(status, body?)` test helper (fault-shaped error factory) for the injected fakes
- [ ] (Integration) a cross-OS round-trip CI job pair (no `*.integration.spec.ts` exists yet; the `integration` target is currently a green no-op)

## Security Domain

### Applicable ASVS Categories (Level 1)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V1 Architecture | yes | Sync gate is a distinct trust boundary from the write gate (D-01); publisher/cleanup are reader-specific, behind no port (ADR) |
| V2 Authentication | yes | `GITHUB_TOKEN` via `resolveGitHubToken` (`GH_TOKEN||GITHUB_TOKEN`, `||` not `??`); no PAT (RETAIN-03) |
| V4 Access Control | yes | Least-privilege job scopes: publish `contents:write`+`actions:read`, cleanup `contents:write`; single-writer scheduled cleanup (D-09) |
| V5 Input Validation | yes | `CACHE_MIRROR_MAX_AGE_DAYS` validated + clamped (`resolveMaxAgeDays`); `nx-cache-` prefix filter (D-16); asset name via `releaseAssetName` |
| V6 Cryptography | no | No new crypto in this phase (hash validation + timing-safe auth are Phase 1) |
| V7 Errors & Logging | yes | Tokens never interpolated into annotations/logs (existing discipline); `core.error`/`setFailed` fail loud (D-15) |
| V8 Data Protection | yes | Mirrored assets are world-readable (public repo, ADR C16); no secret material written to Release assets |

### Known Threat Patterns for {publish/cleanup on GitHub Releases}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-trust mirror publish (fork/PR-influenced entry becomes a public asset) | Tampering / Elevation | Sync gate STRICT `{push,schedule}` + default branch, independent of the write gate (D-01/TRUST-02); Phase 4 does NOT widen it (Pitfall 2 is a Phase 5 concern kept out here) |
| Cleanup deletes live data on a partial/faulted listing | Denial of Service / data loss | List phase aborts with zero deletions on any non-404 fault / incomplete pagination; `octokit.paginate` rejects on any page fault (D-10/C9/RETAIN-01) |
| A real fault misread as "absent" -> overwrite / drop | Tampering | Structural `error.status`: only 404 is absence; everything else throws (ROBUST-01, Pitfall 1) |
| Token leak via annotations / logs | Information Disclosure | Never interpolate the token; `core.setSecret` any minted secret before printing; token by process inheritance only |
| Over-scoped credential | Elevation of Privilege | Job-scoped `GITHUB_TOKEN`, least privilege per job; no `delete:packages`/PAT (Releases needs none -- RETAIN-03) |

## Sources

### Primary (HIGH confidence)
- octokit.github.io/rest.js/v21 & v22 -- `repos.getReleaseByTag`/`getRelease`/`createRelease`/`uploadReleaseAsset`/`listReleaseAssets`/`deleteReleaseAsset`; `actions.getActionsCacheList`; `octokit.paginate`
- docs.github.com/en/rest/releases/assets -- upload endpoint (uploads.github.com), duplicate name -> 422, list (per_page/page), delete -> 204, 502 upstream-failure note
- docs.github.com/en/rest/releases/releases -- get-by-tag 200/404, create 201/422
- docs.github.com/en/rest/actions/cache -- list endpoint, query params (`ref`/`key`/`sort`/`direction`), response fields (`id/ref/key/version/last_accessed_at/created_at/size_in_bytes`)
- github.com/octokit/request-error.js -- `RequestError.status` (number), `.response.data`
- github.com/actions/toolkit (packages/core README) -- `error`/`warning`/`notice`, `AnnotationProperties`, `summary.addHeading/addTable/addRaw/addList/write`, `setFailed`
- npm registry (2026-07-20) -- `@octokit/rest@22.0.1` (published 2025-10-31, ~15.8M/wk, `octokitbot@github.com`, no postinstall); `@octokit/request-error@7.1.0`; `@octokit/plugin-paginate-rest@14.0.0`
- Repo source (read in full): `releases-backend.ts`, `release-asset-name.ts`, `actions-cache-backend.ts`, `cache-archive-path.ts`, `trust.ts`, `select-backend.ts`, `local-context.ts`, `action/index.ts`, `ci.yml`, `nx.json`, `pinned-deps.spec.ts`, `releases-backend.spec.ts`
- `.planning/research/PITFALLS.md` (Pitfalls 4-9; empirically-verified platform facts) -- HIGH (first-party)

### Secondary (MEDIUM confidence)
- Fine-grained token scope for `getActionsCacheList` inferred as `actions:read` from the repo's own empirically-verified fact (only-`contents:write` -> caches list 404s) -- see A3

### Tertiary (LOW confidence)
- The exact `422` duplicate-asset body carrying `errors[].code === 'already_exists'` -- not confirmed on the fetched docs page (A1); mitigated by the pre-list existence check

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- `@octokit/rest@22.0.1` verified on the registry and named in D-04; `@actions/core`/`@actions/cache` already pinned
- Architecture / integration: HIGH -- every named source file read; reuse points (`createActionsCacheBackend().get`, `releaseAssetName`, `cacheArchivePath`, `resolveGitHubToken`) confirmed in source
- Fault semantics: HIGH for status codes (404/422/201/204) and `error.status`; MEDIUM for the 422 body shape (A1) and the exact `actions:read` scope (A3)
- Pitfalls: HIGH -- carried from the repo's own verified PITFALLS.md + the FOUND-01 spike

**Research date:** 2026-07-20
**Valid until:** 2026-08-19 (Octokit is stable; re-verify `@octokit/rest` latest and the 422 body shape if implementation slips past 30 days)

## Project Constraints (from CLAUDE.md / AGENTS.md)

- **Nx-first:** run tasks via `nx`/`npm run` (`npx nx test github-cache`, `npm run build`), never underlying tooling directly; prefer the package manager prefix (this repo uses **npm**, not pnpm).
- **Zero-dep serve path:** the reader stays on native `fetch` (D-04) -- do NOT add Octokit to the serve/read path.
- **JS actions dependency-free CommonJS constraint:** the pre-`npm ci` action-context copy is a Phase 5 concern (TRUST-04); Phase 4's bins run AFTER `npm ci` (build output), so they may `import` Octokit. Keep the sync-gate predicate importable without network/subprocess so a future dependency-free copy stays feasible.
- **ESM `.js` relative imports; `type: module`; strict TS (typescript ~6.0.3); Node 24.**
- **JS/TS style:** blank lines around control-flow/returns; always braces on control-flow bodies (see existing files).
- **Exact-pinned deps guarded by `pinned-deps.spec.ts`:** adding `@octokit/rest` MUST extend that guard.
- **TDD mandatory** (`workflow.tdd_mode: true`); **MVP mode** for this phase. **Nyquist validation ON** (this file's `## Validation Architecture`).
- **Security enforcement ON**, ASVS L1, block-on `high` (see Security Domain).
- **No emojis / non-ASCII** anywhere; `git grep` for tracked search, `rg -uu` for node_modules (never the `grep` tool).
- **Fallow dead-code gate ON** (`npm run fallow:ci`): declare any tsconfig-`files`-only or contract-mirror entry points in `.fallowrc.jsonc` so new bins/modules do not false-positive as unreachable.

## RESEARCH COMPLETE
