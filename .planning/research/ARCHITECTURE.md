# Architecture Research

**Domain:** Self-hosted Nx remote cache on GitHub-native primitives (brownfield refinement)
**Researched:** 2026-07-17
**Confidence:** HIGH for the trigger/token/permission model (Q1) and testability seams (Q4); MEDIUM for LRU retention (Q2, hinges on `download_count` semantics); HIGH-on-conclusion / MEDIUM-on-specifics for backend pivot (Q3).

> This is a SUBSEQUENT-milestone refinement. The existing ports-and-adapters design is already documented in `.planning/codebase/ARCHITECTURE.md` and is NOT re-derived here. This file answers only: how the four Active requirements integrate into (or refine) that design, validated against GitHub's 2026-06-26 cache-token model and comparable systems. Every integration point below is expressed against the existing `CacheBackend` port, the `isWriteTrusted`/`resolveTrustedRepo` trust gates, the shard/retention coupling, and the single-writer cleanup workflow.

---

## 1. GitHub trigger + permissions + cache-token model (Active req: `pull_request` + `release` events)

### The load-bearing fact (verified in full)

Per <https://github.blog/changelog/2026-06-26-read-only-actions-cache-for-untrusted-triggers/> (published 2026-06-26), GitHub now issues a **read-only** cache token when **BOTH** are true:

1. the triggering event is untrusted (someone other than a repo collaborator can trigger it), AND
2. the workflow execution context and cache scope come from the **shared default-branch SHA**.

Full read-write is preserved for `push`, `schedule`, `workflow_dispatch`, `repository_dispatch`, `delete`, `registry_package`, `page_build`. And, quoting verbatim: *"any trigger that uses a non-default-branch scope, such as `pull_request` and `release`, keeps read-write caching permission."*

This is the crux. `pull_request` and `release` are NOT trusted by being collaborator-gated; they are safe by being **scope-isolated**. A `pull_request` writes to the merge-ref scope (`refs/pull/N/merge`); a `release` writes to the tag/release scope. Neither can write the default-branch cache. Per <https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching>, a PR cache *"can only be restored by re-runs of the pull request. It cannot be restored by the base branch or other pull requests."* So a fork PR (even one that spoofs its own event name) can only pollute its own throwaway scope, which no trusted consumer ever reads. This exactly matches Nx's own stated model in <https://nx.dev/enterprise/security>: *"Writes only from trusted CI branches ... pull request artifacts remain isolated and cannot contaminate the shared cache."*

### Data flow through the read-only-token model

```
                      GitHub Actions cache service (server-side token authority)
                                          |
        +---------------------------------+---------------------------------+
        |                                 |                                 |
  push / schedule /              pull_request / release           pull_request_target /
  workflow_dispatch / ...        (NON-default-branch scope)       issue_comment /
  (default-branch scope,                  |                       workflow_run
   trusted)                               |                       (default-branch scope,
        |                                 |                        UNTRUSTED)
        v                                 v                                 v
  RW token to the             RW token to an ISOLATED               READ-ONLY token
  DEFAULT-BRANCH cache        per-PR / per-release scope            (saveCache -> warning,
  (the shared read path)      (invisible to default branch)         job continues)
        |                                 |                                 |
        v                                 v                                 v
  serve PUT -> 'stored'       serve PUT -> 'stored'                 serve PUT -> @actions/cache
  (safe: trusted)            (safe: cannot poison shared)          returns -1 -> mapped 'conflict'
                                                                    (GitHub already refused it)
```

The last column is why the in-code gate is only defense-in-depth: even if the sidecar's env-based gate is spoofed into allowing a write on an untrusted default-branch-scoped trigger, `@actions/cache` receives a read-only token and `saveCache` returns `-1`, which `actions-cache-backend.ts` already collapses to a `'conflict'` (see `.planning/codebase/CONCERNS.md`, "-1 sentinel collapse"). The poison write never lands.

### Defense-in-depth ordering (outermost = load-bearing)

| Layer | Control | Load-bearing? | Where it lives |
|-------|---------|---------------|----------------|
| 1 (outermost) | GitHub server-side cache-token: RO for untrusted+default-scope; scope-isolated RW for `pull_request`/`release` | **YES** (the CREEP fix) | GitHub, github.com + Data Residency; version-floor caveat for GHES |
| 2 (middle) | Workflow `permissions:` scoping + job isolation | YES for the mirror | `.github/workflows/*.yml` |
| 3 (innermost) | `isWriteTrusted(env)` in `server.ts:154`; `resolveTrustedRepo()` in `publish-mirror.ts:335` | NO (env is fork-spoofable) | `src/lib/trust.ts` |

The in-code gate sits *behind* GitHub's control by design and stays there. Its purpose after this milestone is unchanged: fail-safe when layer 1 is absent (older GHES) or misconfigured. Do not promote it to load-bearing.

### The critical integration decision: split the trust predicate

`TRUSTED_EVENTS` is consumed in **two** places today (`.planning/codebase/ARCHITECTURE.md`): the serve write gate (`server.ts:154`) and the mirror-publish gate (`publish-mirror.ts:335`). These are different trust decisions and must diverge:

- **Serve write path (Actions cache PUT):** SAFE to widen to `pull_request` + `release`. GitHub scope-isolates the write; the value delivered is PR/release builds getting their own caching (resolves the open "why not pull_request?" question).
- **Mirror-publish path (Actions cache -> PUBLIC Release asset):** MUST NOT widen. Publish-mirror is the shared, anonymous, public read path for local dev. Mirroring a PR-scoped or release-scoped entry would collapse exactly the isolation GitHub gives us, republishing untrusted content as the shared read path.

Fortunately the existing code already protects the mirror path: `resolveTrustedRepo()` layers a `GITHUB_REF == default branch` check on top of `isWriteTrusted`. A `pull_request` (`refs/pull/N/merge`) and a `release` (`refs/tags/vX`) both fail that default-branch check, so widening the shared `TRUSTED_EVENTS` list does not, today, widen the mirror path.

**Recommendation (opinionated):** do not rely on that coincidence. Make the two predicates explicit so the invariant is legible and test-locked:

```ts
// src/lib/trust.ts
export function isCacheWriteTrusted(env): boolean   // serve PUT: TRUSTED_EVENTS + pull_request + release
export function isMirrorPublishTrusted(env): boolean // publish: default-branch push/schedule ONLY
```

Add a regression test asserting `isMirrorPublishTrusted` REJECTS `pull_request` and `release`. This is the guardrail that stops a future "simplify the gate" change from reopening a poisoning path through the public mirror.

### Permission scoping + job isolation (workflow layer)

- Build / test / `serve` jobs: `permissions: contents: read` only. They never create releases.
- `publish-mirror` job: `permissions: contents: write` (needs release create/upload), isolated as its own job, gated on trusted default-branch push (unchanged).
- `mirror-cleanup` job: `permissions: contents: write`, on the daily schedule only (unchanged, single-writer; see section 2).
- For `pull_request` from forks: GitHub already restricts `GITHUB_TOKEN` to read by default, and the mirror job simply does not run in the PR context. The PR context only ever exercises the serve write path against its own isolated Actions-cache scope. No `pull_request_target` is introduced (that would re-import default-branch scope and the RO-token regression).

### `TRUSTED_EVENTS` duplication caveat (existing debt, now more sensitive)

`TRUSTED_EVENTS` is duplicated in `src/lib/trust.ts:5-21` and `start-cache-server/index.cjs:12-21` (the action must run pre-`npm ci` with Node built-ins only). Adding `pull_request`/`release` must be mirrored in both, and the `selfcheck.cjs` assertion comparing the two sets (proposed in `CONCERNS.md`) becomes worth doing now, because a divergence here now changes which events cache at all.

---

## 2. LRU / last-accessed retention (Active req: optional LRU on top of mandatory age-based cleanup)

### The core problem: GitHub exposes no last-accessed signal

The Release Asset API object exposes `created_at`, `updated_at`, and `download_count` (verified against <https://docs.github.com/en/rest/releases/assets>) but **no** `last_accessed`. So true LRU-by-access is impossible from GitHub metadata. The only per-asset access proxy is `download_count`.

**Signal reliability (MEDIUM confidence):** GitHub's docs do not authoritatively state whether an `Accept: application/octet-stream` API download (exactly how `release-mirror-backend.ts` reads) increments `download_count`. Community knowledge holds that it increments when the binary is actually retrieved (via `browser_download_url` or the octet-stream 302 redirect) but not on metadata reads. This uncertainty is the single biggest risk for this requirement and should be resolved by a short empirical spike (fetch metadata, do an octet-stream download, re-fetch metadata, diff the counter) before committing to the design.

### Why the reader cannot write the manifest

The access event (a cache hit) happens on the READ side, i.e. the anonymous, read-only local `serve` process. That process is read-only by design and MUST stay so ("Local read-write mode" is explicitly Out of Scope). So readers cannot push access records anywhere. Any access signal must be reconstructed **server-side, after the fact**, from `download_count` deltas observed by the single writer. This is the only design that respects the read-only-local invariant.

### Manifest design: read-modify-write in the single-writer cleanup workflow

Home: the daily scheduled `mirror-cleanup.yml` workflow, exactly where the code comment already earmarks it (`publish-mirror.ts:378`). Physical location: a **dedicated manifest release** (e.g. tag `cache-mirror-manifest`) holding one JSON asset. Rationale over alternatives:

- Dedicated release (RECOMMENDED): reuses the Release primitive the cleanup job already has `contents: write` for; no git-history churn; the cleanup workflow is already the single writer.
- Committed file on a branch: REJECTED - churns git history and forces the workflow to commit/push (more blast radius, merge conflicts).
- Actions cache entry: REJECTED - CI-scoped and evicts on the 7-day/10 GB policy; the manifest must outlive Actions cache to describe the mirror.

Critical integration constraint: `MIRROR_SHARD_PATTERN` (`publish-mirror.ts:97`) must NOT match the manifest release, or cleanup deletes its own state. Add the manifest tag to the exclusion the same way the current-month shard is protected.

```
mirror-cleanup.yml (cron 17 4 * * *, single writer)
      |
      v
  1. GET manifest release asset (JSON)   -- 404 -> start empty (needs structural 404; see section 3/4)
      |
      v
  2. list ALL cache-mirror-* shard assets -> {name -> {download_count, created_at}}
      |
      v
  3. MERGE (the read-modify-write core):
       for each asset:
         if current download_count > manifest[asset].count  -> last_active = today
         else                                                -> last_active = carry forward
      |
      v
  4. EVICT decision (planShardCleanup, extended):
       delete if  (now - created_at > maxAgeDays)          [mandatory age gate, unchanged]
              AND (now - last_active > lruIdleDays)          [NEW: LRU protection, optional]
      |
      v
  5. PUT manifest back (upload --clobber to manifest release)
      |
      v
  6. delete evicted assets  (existing cleanupShard path)
```

### Single-writer / concurrency constraints

- Exactly one writer of the manifest: the `mirror-cleanup` job. The per-OS `publish-mirror` upload job (runs on push) must NEVER touch the manifest, preserving single-writer.
- No distributed lock is needed IF two cleanup runs never overlap. The daily cron plus `workflow_dispatch` CAN overlap. Guard with a workflow-level `concurrency: { group: mirror-cleanup }` (queue, do not cancel mid-write). This is the workflow-level analogue of the existing in-process `withHashLock` philosophy: serialize the read-modify-write, let unrelated work run free.
- The RMW is last-writer-wins on a whole-file JSON blob; because there is only ever one writer and it is serialized by the concurrency group, there is no lost-update hazard. Do not add optimistic-concurrency/ETag machinery - it is unneeded complexity given the single-writer guarantee.

### The coupling constraint bounds what LRU can do (important)

Retention and the read window are ONE coupled setting (`CACHE_MIRROR_MAX_AGE_DAYS` -> `resolveMaxAgeDays`/`shardTagsForWindow`); `CONCERNS.md` forbids a second knob. This bounds LRU semantics:

- SAFE (recommended, lowest blast radius): LRU as *additional early eviction of cold entries within the read window* to save space under the 1000-asset/shard cap. Worst case is an extra cache MISS (best-effort reads rebuild it) - never a wrong result.
- UNSAFE without decoupling: LRU as *"keep hot entries past `maxAgeDays`"*. The reader only walks `maxAgeDays` of shards, so an entry kept in an older shard is unreadable dead storage unless LRU also re-promotes it into the current-month shard (a re-upload path). That variant requires decoupling read-window from retention, which the coupling rule forbids, OR a promotion mechanism - a materially larger change. **Flag for deeper research / defer.**

Given the target audience (low-churn OSS repos, generous 30-day window), the honest recommendation is: ship the age-gate-plus-cold-eviction variant, keep it strictly optional (off by default), and treat "keep-hot-longer" as a separate future spike gated on the `download_count` signal proving reliable.

---

## 3. Backend-pivot integration behind the `CacheBackend` port (Active req: evaluate other GitHub/Git primitives)

### Primitive comparison

| Primitive | Anon public read | Per-entry size | Count cap | Native TTL/evict | Access signal | Fit |
|-----------|------------------|----------------|-----------|------------------|---------------|-----|
| Actions cache (current CI RW) | No (CI-scoped) | large | 10 GB repo | 7-day disuse + LRU at cap | none | Best for CI RW; keep |
| Release assets (current local RO) | Yes | ~2 GiB | 1000/release | none (manual) | `download_count` only | Best for anon local read; keep |
| Container/OCI registry (ghcr.io) | Yes (public pkgs) | large (blobs) | none | none | pull stats (coarse) | Plausible mirror alt; higher blast radius |
| Git LFS | No (quota/billing) | 2 GB | n/a | none | none | Poor fit |
| Orphan branch / git blobs | Yes (raw CDN) | repo-bloat | n/a | history-rewrite only | none | Poor fit (cleanup = history surgery) |
| Git notes / Gists | n/a | tiny | n/a | none | none | Metadata only, not artifacts |

### Recommendation: no pivot now; the port already isolates blast radius

The current two-backend split maps cleanly onto the two access patterns (CI needs authenticated RW with native eviction; local needs anonymous read). No candidate clearly beats that for the low-churn target audience. The one worth a *time-boxed spike* is the OCI/container registry as a mirror-read replacement (content-addressable by digest = the hash, no 1000-asset cap, anonymous pulls for public packages, richer metadata) - but it adds the OCI protocol and push auth, and does not obviously win. Default outcome: keep Actions cache + Releases; log the OCI option.

### How a pivot slots in with minimal blast radius

The `CacheBackend` port (`get(hash): Promise<Buffer|null>`, `put(hash, body): Promise<PutResult>`) is precisely the seam. A pivot is a new factory returning the object literal, wired into `selectBackend`. What stays UNTOUCHED: `server.ts` (protocol/auth/trust), `trust.ts`, `types.ts`. What must be handled because it lives OUTSIDE the port today:

1. **Shard/retention coupling** (`shard.ts`, used by `release-mirror-backend.ts` + `publish-mirror.ts`): Release-specific (month tags, 1000-cap). A digest-addressed OCI backend has no month-shard cap, so `shardTagsForWindow` would collapse to a single namespace or a backend-specific retention model. This is the biggest non-port coupling to redesign.
2. **`cacheArchivePath` cross-backend reuse**: `publish-mirror.ts` reuses the Actions backend's deterministic temp path. A pivot that changes the CI backend must preserve or replace this (and re-verify an end-to-end `@actions/cache` restore - the path is version-hashed).
3. **Out-of-band population**: the mirror is filled by the `publish-mirror` bin, not through the port's `put()`. A pivot of the mirror storage changes the publish/cleanup bins too, not just one backend file.

Blast-radius summary: replacing the LOCAL READ backend (Releases -> OCI) is contained - new `*-mirror-backend.ts` + `selectBackend` local branch + rewrite of publish/cleanup targets + retention model; protocol layer untouched. Replacing the CI RW backend (Actions cache -> other) is high blast radius - you lose `@actions/cache` native eviction and the JS-actions-only runtime-env plumbing that the two composite actions exist solely to carry. Not recommended.

For comparison, the 1st-party `@nx/azure-cache` plugin (<https://21.nx.dev/docs/reference/remote-cache-plugins/azure-cache/overview>) validates this shape: it is a thin adapter over Azure Blob Storage configured by `container`/`accountName`, with `localMode`/`ciMode` (`read-only`/`no-cache`) toggles and OIDC auth. It is the same "one storage adapter behind the Nx remote-cache contract" pattern this project already implements; the only structural difference is that this project derives RW/RO from runtime context instead of exposing a mode toggle (a deliberate, safer choice per the Key Decisions).

---

## 4. Testability seams for the untested I/O paths (Active req: comprehensive test coverage)

The codebase already has ONE proven seam: *extract pure decisions, inject the I/O client*. `filterNxCacheKeys`, `planShardCleanup`, `shardTagsForWindow` are pure and tested; `createReleaseMirrorBackend(options)` already injects its Octokit. The untested paths are exactly the ones that have NOT yet had their I/O client injected. Extend the existing pattern; do not invent a new one.

| Path | Current seam gap | Recommended seam | Effort / priority |
|------|------------------|------------------|-------------------|
| `gh` orchestration (`ensureShardExists`, `uploadHash`, `getReleaseId`, `listShardAssets`, `cleanupShard`, `cleanupMirror`, `resolveTrustedRepo`) | calls `execFile(gh, ...)` inline; only mocked via nothing | Inject a narrow runner: `type GhRunner = (args: string[]) => Promise<{stdout,stderr,code}>`, default = real `execFile`. Spec asserts the already-exists / `HTTP 404` / other-error branch per sentinel. | High. Converges with the Octokit-migration req (both are "dependency-inject the REST/CLI client") - do them together. |
| `selectBackend` | pure fn of env but reads `process.env` and builds a real backend | Accept an explicit `env` param; assert WHICH backend + config is returned (CI vs local, `GITHUB_REPOSITORY` validation, `GH_TOKEN \|\| GITHUB_TOKEN` empty-string fallthrough). No network - assert identity/mode, do not exercise I/O. | Low. Cheap, pure. Do first. |
| `withHashLock` | in-process promise-chain lock, not exported/tested | Export it; drive with deferred fake work fns. Assert: same-hash serializes in order; different hashes run concurrently; map entry is EVICTED after completion (leak guard); a rejected op does not wedge the chain. Zero I/O. | Medium. Closes the sharpest edge (rare truncated reads under concurrency). |
| cleanup bin wrapper (`publish-mirror-cleanup.ts`) | 34-line failure-aggregation-to-throw, no spec | Inject `cleanupMirror`; force a per-shard failure, assert aggregate-and-exit-nonzero. | Low. |

**Convergence to flag for the roadmap:** the `gh`-runner injection seam IS the Octokit-migration refactor. Migrating `publish-mirror` from `gh` stderr text-matching to structural Octokit `error.status` discrimination (as `release-mirror-backend.ts:25-32` already does) both (a) removes the fragile stderr contract and (b) yields a mockable injected client for the specs. And the LRU manifest bootstrap (section 2) needs a structural 404 ("no manifest yet") - the same structural-error capability. Sequence these together.

---

## Integration Points (against the existing `CacheBackend` port and trust gates)

| Boundary | Change | Notes |
|----------|--------|-------|
| `server.ts` PUT gate -> `isCacheWriteTrusted` | Widen to include `pull_request`, `release` | Safe: GitHub scope-isolates these writes. Protocol/auth untouched. |
| `publish-mirror.ts` -> `isMirrorPublishTrusted` | Keep default-branch push/schedule ONLY | Split the predicate; test-lock the rejection of `pull_request`/`release`. |
| `trust.ts` + `start-cache-server/index.cjs` | Mirror the event-list change in BOTH; add `selfcheck.cjs` parity assertion | Duplication is load-bearing (action runs pre-`npm ci`). |
| `mirror-cleanup.yml` | Add manifest read-modify-write + `concurrency: mirror-cleanup` group | Single-writer stays single; manifest lives in a dedicated release. |
| `MIRROR_SHARD_PATTERN` (`publish-mirror.ts:97`) | Exclude the manifest release tag | Or cleanup deletes its own state. |
| `cleanup.ts` `planShardCleanup` | Extend with optional LRU idle gate (age gate stays mandatory) | Pure fn - unit-test the new branch. |
| `publish-mirror.ts` gh calls | Inject runner / migrate to Octokit `error.status` | Enables specs + structural 404 for manifest bootstrap. |
| `selectBackend`, `withHashLock` | Export + accept explicit inputs | Pure/near-pure specs, no I/O. |
| `CacheBackend` port | UNCHANGED | Any future storage pivot is a new factory behind `selectBackend`; protocol/trust never move. |

## Suggested Build Order (dependencies between the Active requirements)

1. **Testability seams + coverage first** (`selectBackend`, `withHashLock`, gh-runner injection). Cheap, independent, and the safety net that locks current behavior before trust semantics change. `selectBackend`/`withHashLock` are pure and unblock nothing else; the gh-runner seam is a prerequisite for both step 2 and step 4.
2. **Octokit migration (structural error discrimination).** Builds directly on the gh-runner seam from step 1. Removes the stderr contract; provides the structural 404 that step 4 needs.
3. **`pull_request` + `release` events + first-class CI RW/RO mode.** Depends on the trust tests from step 1 and the predicate split. Can run in parallel with step 2. Deliverable: the "why not pull_request?" question resolved, RW/RO made documented and testable.
4. **LRU manifest retention.** Depends on step 2 (structural 404 for manifest bootstrap) and the cleanup `concurrency` guard. Highest uncertainty (`download_count` signal) - gate on a spike; ship the cold-eviction variant, defer keep-hot-longer.
5. **Consumer adoption docs.** After step 3 settles the final trust model, so docs describe the shipped RW/RO semantics.
6. **Backend-pivot evaluation.** Independent spike, off the critical path; likely a no-pivot outcome. The port makes it low-risk whenever it happens.

## Anti-Patterns (specific to this new work)

### Widening the shared `TRUSTED_EVENTS` for both gates at once
**What people do:** add `pull_request`/`release` to the single `TRUSTED_EVENTS` list and stop.
**Why it's wrong:** it also widens the mirror-publish gate (today only saved by a coincidental default-branch check), which would republish PR/release-scoped cache content as the shared public read path - collapsing the very isolation GitHub provides.
**Do this instead:** split `isCacheWriteTrusted` (serve, wide) from `isMirrorPublishTrusted` (publish, narrow) and add a test that locks the mirror gate's rejection of `pull_request`/`release`.

### Treating the in-code trust gate as the CREEP control
**What people do:** reason "we gate writes in code, so forks are safe."
**Why it's wrong:** the env is fork-spoofable; the load-bearing control is GitHub's server-side read-only cache token (2026-06-26). The in-code gate is defense-in-depth only.
**Do this instead:** keep the ordering explicit (GitHub server-side > workflow permissions > in-code gate); document the GHES version-floor caveat for the server-side control.

### Letting a reader try to write the LRU manifest
**What people do:** have the local `serve` process record access into a manifest.
**Why it's wrong:** local is anonymous and read-only by design (writes must stay Out of Scope). A reader-write path reopens the exact trust surface the whole design avoids.
**Do this instead:** reconstruct access server-side from `download_count` deltas in the single-writer cleanup workflow. No reader ever writes.

### Adding a second retention knob for LRU
**What people do:** introduce a separate "LRU window" env var distinct from `CACHE_MIRROR_MAX_AGE_DAYS`.
**Why it's wrong:** read-window and retention are one coupled setting; a second knob desynchronizes them (retained-but-unreadable or expired-but-uncleanable), the exact class of silent bug already fixed twice here.
**Do this instead:** keep LRU strictly WITHIN the coupled window (cold-eviction only); resolve everything through `resolveMaxAgeDays`.

## Sources

- GitHub read-only Actions cache for untrusted triggers (2026-06-26, fetched in full via markdown.new): <https://github.blog/changelog/2026-06-26-read-only-actions-cache-for-untrusted-triggers/> - HIGH. States `pull_request`/`release` keep RW via non-default-branch scope; lists the RW trigger set; RO issued for untrusted + default-scope.
- GitHub Actions dependency-caching reference (scope model, PR merge-ref isolation, RO triggers, "anyone who can open a PR can read base-branch caches"): <https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching> - HIGH.
- GitHub REST release-assets schema (`download_count`, `created_at`, `updated_at`; increment-on-octet-stream not authoritatively documented): <https://docs.github.com/en/rest/releases/assets> - MEDIUM on the LRU signal.
- Nx self-hosted caching usage notes + HTTP contract (`GET`/`PUT /v1/cache/{hash}`, bearer token, 403 for read-only writes, 409 override, 404 miss): <https://nx.dev/docs/guides/tasks--caching/self-hosted-caching#usage-notes> - HIGH.
- Nx enterprise security ("writes only from trusted CI branches", CREEP framing, PR artifacts isolated): <https://nx.dev/enterprise/security> - HIGH (corroborates the scope-isolation design; note it is Nx-Cloud marketing framing).
- Nx `@nx/azure-cache` plugin overview (comparable adapter shape: single storage backend behind the Nx contract, `localMode`/`ciMode`, OIDC): <https://21.nx.dev/docs/reference/remote-cache-plugins/azure-cache/overview> - HIGH.
- CVE-2025-36852 CREEP background: <https://nx.dev/blog/cve-2025-36852-critical-cache-poisoning-vulnerability-creep> - referenced, not re-fetched (already in project context).
- Existing design (not re-derived): `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/CONCERNS.md`.

---
*Architecture research (brownfield refinement) for: self-hosted Nx remote cache on GitHub-native primitives*
*Researched: 2026-07-17*
