# Architecture Research

**Domain:** Self-hosted Nx remote cache on GitHub-native primitives (greenfield build)
**Researched:** 2026-07-17
**Confidence:** HIGH for the trigger/token/permission model (section 1) and testability seams (section 4); MEDIUM for recency/LRU retention (section 2, hinges on `download_count` semantics); HIGH-on-conclusion / MEDIUM-on-specifics for storage-primitive choice (section 3).

> This research informs building the cache from scratch on the LOCKED foundation
> (`.planning/ARCHITECTURE-DECISION.md`): one `CacheBackend` read port, a context-derived
> `selectBackend`, a conservative write-trust gate, a separate `{push, schedule}` sync gate,
> and reader = GitHub Releases (FOUND-01). It does NOT re-derive the ADR. It answers how the
> domain capabilities are built against that architecture, validated against GitHub's 2026-06-26
> cache-token model and comparable systems. Phase structure lives in `.planning/ROADMAP.md`.

---

## 1. GitHub trigger + permissions + cache-token model

Grounds the write-trust gate (conservative default-deny in the default-cache slice; `pull_request`
/ `release` widening in the trust-widening slice) and the separate sync/publish gate.

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
  (safe: trusted)            (safe: cannot poison shared)          returns -1 -> map to 'conflict'
                                                                    (GitHub already refused it)
```

The last column is why the in-code gate is only defense-in-depth: even if the sidecar's env-based gate is spoofed into allowing a write on an untrusted default-branch-scoped trigger, `@actions/cache` receives a read-only token and `saveCache` returns `-1`. The Actions-cache backend must map that `-1` sentinel (already-cached / write-denied) to a `'conflict'`/409 rather than an error, so the poison write never lands and the build is not broken.

### Defense-in-depth ordering (outermost = load-bearing)

| Layer | Control | Load-bearing? | Where it lives |
|-------|---------|---------------|----------------|
| 1 (outermost) | GitHub server-side cache-token: RO for untrusted+default-scope; scope-isolated RW for `pull_request`/`release` | **YES** (the CREEP fix) | GitHub, github.com + Data Residency; version-floor caveat for GHES |
| 2 (middle) | Workflow `permissions:` scoping + job isolation | YES for the publish/mirror job | `.github/workflows/*.yml` |
| 3 (innermost) | The in-code write-trust gate (host-detected, env-derived) | NO (env is fork-spoofable) | the cache library's trust module |

The in-code gate sits *behind* GitHub's control by design and stays there. Its purpose is fail-safe when layer 1 is absent (older GHES) or misconfigured. Do not build it as, or promote it to, the load-bearing control.

### The critical design decision: two trust predicates, not one shared list

The trusted-event decision is consumed in **two** distinct places, and they must be **two separate predicates from the start** (not one shared list that gets split later):

- **Serve write path (Actions cache PUT):** may include `pull_request` + `release` (in the trust-widening slice, host-detected fail-closed). GitHub scope-isolates the write; the value delivered is PR/release builds getting their own caching.
- **Sync/publish path (Actions cache -> PUBLIC Release asset):** MUST NOT include them. Publishing is the shared, anonymous, public read path. Mirroring a PR-scoped or release-scoped entry would collapse exactly the isolation GitHub gives us, republishing untrusted content as the shared read path.

Build the two predicates explicitly so the invariant is legible and test-locked:

```ts
isCacheWriteTrusted(env): boolean    // serve PUT: allowlist (+ pull_request + release, host-gated)
isSyncPublishTrusted(env): boolean   // publish: default-branch push/schedule ONLY
```

Add a regression test asserting the sync/publish predicate REJECTS `pull_request` and `release` (and every non-`{push, schedule}` event + non-default ref). This is the guardrail that stops a future "simplify the gate" change from ever opening a poisoning path through the public mirror. Do NOT model the mirror gate as an accidental consequence of a default-branch ref check layered on the write gate - make it its own predicate.

### Permission scoping + job isolation (workflow layer)

- Build / test / `serve` jobs: `permissions: contents: read` only. They never create releases.
- publish/mirror job: `permissions: contents: write` (needs release create/upload), isolated as its own job, gated on trusted default-branch push.
- cleanup job: `permissions: contents: write`, on the schedule only (single-writer; see section 2).
- For `pull_request` from forks: GitHub already restricts `GITHUB_TOKEN` to read by default, and the publish/mirror job simply does not run in the PR context. The PR context only ever exercises the serve write path against its own isolated Actions-cache scope. Never introduce `pull_request_target` (it re-imports default-branch scope and the RO-token regression).

### Trusted-event allowlist: single source of truth

The trusted-event allowlist is needed in two runtime forms: the cache library (post-`npm ci`, full deps) and the consumption Action's pre-`npm ci` bootstrap, which must run with Node built-ins only (no dependency install yet). Build it with a **single source of truth**: the dependency-free action copy is generated from / shares the canonical list (no hand-maintained dual copy), with a `selfcheck.cjs` parity assertion that fails on drift. A divergence here changes which events cache at all, so the parity check is not optional.

---

## 2. Recency (LRU) retention: why it is hard on this substrate - DEFERRED

**Status: LRU via a stateful manifest is OUT OF SCOPE for v0.0.1** (`.planning/REQUIREMENTS.md`). Retention
is age-based only (`CACHE_MIRROR_MAX_AGE_DAYS`, one coupled setting; RETAIN-01/RETAIN-03). This section
records *why* recency eviction is hard on GitHub Releases so the deferral is grounded, not hand-waved.

### The core problem: GitHub exposes no last-accessed signal

The Release Asset API object exposes `created_at`, `updated_at`, and `download_count` (verified against <https://docs.github.com/en/rest/releases/assets>) but **no** `last_accessed`. So true LRU-by-access is impossible from GitHub Releases metadata. The only per-asset access proxy is `download_count`.

**Signal reliability (MEDIUM confidence):** GitHub's docs do not authoritatively state whether an `Accept: application/octet-stream` API download (exactly how the Releases reader retrieves an asset) increments `download_count`. Community knowledge holds it increments when the binary is actually retrieved (via `browser_download_url` or the octet-stream 302 redirect) but not on metadata reads. This uncertainty is a big reason recency eviction is deferred: the whole approach would rest on an unverified counter.

### Why the reader cannot maintain a recency signal

The access event (a cache hit) happens on the READ side - the anonymous, read-only local `serve` process, which is read-only by construction (a load-bearing CREEP property: local never writes). So readers cannot push access records anywhere. Any access signal would have to be reconstructed **server-side, after the fact**, from `download_count` deltas observed by a single writer. That is the only design that respects the read-only-local invariant - and it is more machinery than v0.0.1 warrants.

### What recency eviction would cost (sketch, for the deferral record)

A recency layer would need a read-modify-write manifest in a single-writer scheduled cleanup job:

```
scheduled cleanup (single writer)
  1. GET a manifest asset (JSON)              -- 404 -> start empty (needs structural 404)
  2. list shard assets -> {name -> {download_count, created_at}}
  3. MERGE: download_count increased -> last_active = today; else carry forward
  4. EVICT: age gate (mandatory) AND recency-idle gate (the deferred part)
  5. PUT manifest back; delete evicted assets
```

with a dedicated manifest release, a `concurrency:` group so two cleanup runs never race the RMW, and
the manifest tag excluded from the shard-cleanup pattern (or cleanup deletes its own state). This is
security-negative (mutable shared retention state), rests on the unverified `download_count` signal,
and duplicates recency that the Actions-cache CI tier already provides natively - so it is out of scope.

### The coupling constraint (why even a "keep-hot" variant does not fit)

Retention and the read window are ONE coupled setting (`CACHE_MIRROR_MAX_AGE_DAYS`); a second knob is
forbidden (windows drift -> retained-but-unreadable or expired-but-uncleanable). A "keep hot entries past
`maxAgeDays`" variant would need to re-promote entries into the current window (a re-upload path) or
decouple the window from retention - both larger than v0.0.1's value. The native alternative already covers
the common case: an entry unused in CI falls out of the Actions cache (7-day/10 GB LRU), stops being
re-published, and ages out of the mirror by date. **v0.0.1 ships age-based cleanup only; recency eviction is
a possible later-milestone spike gated on the `download_count` signal proving reliable.**

---

## 3. Storage primitives behind the `CacheBackend` read port (reader = Releases LOCKED)

### Primitive comparison

| Primitive | Anon public read | Per-entry size | Count cap | Native TTL/evict | Access signal | Fit |
|-----------|------------------|----------------|-----------|------------------|---------------|-----|
| Actions cache (CI RW) | No (CI-scoped) | large | 10 GB repo | 7-day disuse + LRU at cap | none | Best for CI RW; the default |
| Release assets (local RO) | Yes | ~2 GiB | 1000/release | none (manual) | `download_count` only | **LOCKED reader (FOUND-01)** |
| Container/OCI registry (ghcr.io) | Yes (public pkgs) | large (blobs) | none | none | pull stats (coarse) | later-milestone revisit trigger (GHCR-01) |
| Git LFS | No (quota/billing) | 2 GB | n/a | none | none | Poor fit |
| Orphan branch / git blobs | Yes (raw CDN) | repo-bloat | n/a | history-rewrite only | none | Poor fit (cleanup = history surgery) |
| Git notes / Gists | n/a | tiny | n/a | none | none | Metadata only, not artifacts |

### Decision: reader = GitHub Releases is LOCKED

FOUND-01 is resolved: the cross-context reader is **GitHub Releases** (`.planning/ARCHITECTURE-DECISION.md` Decision 3; FOUND-01 spike `.planning/spikes/001-005`). The two-backend split maps cleanly onto the two access patterns - CI needs authenticated RW with native eviction (Actions cache); local needs an anonymous keyed read path (Releases). The GHCR/OCI registry was the one serious alternative and was validated in the spike; it is deferred to the **later-milestone GHCR revisit trigger (GHCR-01)**, to be re-evaluated only when the Docker container form and cosign provenance (PROV-01) graduate together. Do not build a runtime store-selection framework; build the one locked reader.

### How the read port isolates a future store change

The `CacheBackend` read port (`get(hash): Promise<Buffer|null>`, `put(hash, body): Promise<PutResult>`, `put` returning `'stored'`/`'conflict'`/`'forbidden'`) is the seam. A future additional store (GHCR in a later milestone) is a new factory wired into `selectBackend`; the protocol/auth/trust layers never move. What lives OUTSIDE the read port and is reader-specific (build it with the Releases reader, do not assume it is pluggable):

1. **Shard/retention coupling** (used by the reader + the publisher): Release-specific (month tags, the 1000-asset cap, window-walk). A digest-addressed store has no month-shard cap, so this collapses to a store-specific retention model. This is the biggest non-port coupling - it is per-reader by design (the ADR: the publish/cleanup subsystem is behind no port).
2. **Archive-path reuse**: the publisher reuses the Actions backend's deterministic temp path. This helper must be the single source of truth; any change re-verifies an end-to-end `@actions/cache` restore, because the path is version-hashed (section 5 of STACK.md).
3. **Out-of-band population**: the mirror is filled by the publish step, not through the port's `put()`. The publish + cleanup subsystem is reader-specific and behind no port.

Blast-radius summary: because publish/cleanup is reader-specific, a later-milestone additional store (GHCR) is *additive* (multi-store + synced writes), not a switch - v0.0.1 Releases keeps serving. Replacing the CI RW backend (Actions cache -> other) would be high blast radius - you lose `@actions/cache` native eviction and the JS-action runtime-env plumbing the consumption Action exists to carry. Not in scope.

For comparison, the 1st-party `@nx/azure-cache` plugin (<https://21.nx.dev/docs/reference/remote-cache-plugins/azure-cache/overview>) validates this shape: a thin adapter over Azure Blob Storage configured by `container`/`accountName`, with `localMode`/`ciMode` (`read-only`/`no-cache`) toggles and OIDC auth - the same "one storage adapter behind the Nx remote-cache contract" pattern. The deliberate difference here (per the ADR) is deriving RW/RO from runtime context instead of exposing a mode toggle a consumer can set wrong.

---

## 4. Testability seams - build them from the start (TDD)

The proven pattern for this shape of system is: *extract pure decisions, inject the I/O client*. Build the domain logic (key filtering, shard planning, cleanup planning, the RW/RO selection, the per-hash lock) as pure/near-pure functions, and inject every network client (Octokit / any CLI runner) so each I/O branch is drivable in a unit test. Write the test first for each. The paths below are exactly the I/O surfaces that must have an injected client from day one, not retrofitted.

| Path | Seam to build | How to test | Priority |
|------|---------------|-------------|----------|
| publish + cleanup orchestration (ensure-shard, upload, get-release, list-assets, cleanup) | Inject the client (Octokit) rather than shelling out with inline string-matching. Discriminate faults structurally by `error.status`. | Spec asserts the already-exists (409) / not-found (404) / other-fault branch per structural status. | High. Same seam serves the whole publish/cleanup subsystem. |
| `selectBackend` | Accept an explicit `env` param (do not read `process.env` inside). | Assert WHICH backend + config is returned: CI vs local, `GITHUB_REPOSITORY` validation, `GH_TOKEN \|\| GITHUB_TOKEN` empty-string fallthrough, malformed-repo rejection. No network - assert identity/mode. | Low. Cheap, pure. Do first. |
| `withHashLock` | Export it as a standalone per-hash lock. | Drive with deferred fake work fns: same-hash serializes in order; different hashes run concurrently; the map entry is EVICTED after completion (leak guard); a rejected op does not wedge the chain. Zero I/O. | Medium. Closes the sharpest edge (rare truncated reads under concurrency). |
| cleanup bin wrapper | Inject the cleanup fn; the wrapper aggregates per-item failures. | Force a per-shard failure, assert aggregate-and-exit-nonzero + per-item isolation. | Low. |

**Use Octokit (structural `error.status`) from the start.** A greenfield build has no `gh` CLI to migrate from: discriminate GitHub faults structurally (`error.status === 404/409/422`) via `@octokit/rest`, never by matching human-readable CLI stderr. This gives (a) a robust fault contract and (b) a mockable injected client for the specs, and it supplies the structural 404 that a "does the asset/release exist yet" bootstrap needs. Build it this way - do not build a stderr-text-matching path and plan to replace it.

---

## Integration Points (seams to build against the LOCKED architecture)

| Boundary | Build | Notes |
|----------|-------|-------|
| serve PUT gate -> `isCacheWriteTrusted` | Conservative default-deny allowlist; widen to `pull_request` + `release` only in the trust-widening slice, host-detected fail-closed | Safe: GitHub scope-isolates these writes. Protocol/auth untouched. |
| sync/publish gate -> `isSyncPublishTrusted` | Separate predicate: default-branch `{push, schedule}` ONLY | Two predicates from the start; test-lock the rejection of `pull_request`/`release`/non-default refs. |
| trusted-event allowlist + dependency-free action copy | Single source of truth; action copy generated from / shares it; `selfcheck.cjs` parity assertion | The action bootstrap runs pre-`npm ci` (Node built-ins only). |
| scheduled cleanup | Age-based cleanup under a `concurrency:` group (queue, don't cancel); list phase aborts before any delete on partial pagination | Single-writer; recency/manifest LRU is OUT (section 2). |
| shard-cleanup pattern | Exclude any non-shard release tag from the delete set | Or cleanup deletes state it should keep. |
| cleanup planning (pure fn) | Age-gate deletion decision as a pure function | Unit-test the branch; no I/O. |
| publish/cleanup I/O | Inject Octokit; discriminate faults by `error.status` | Enables specs + structural 404 bootstrap. |
| `selectBackend`, `withHashLock` | Explicit inputs / exported | Pure/near-pure specs, no I/O. |
| `CacheBackend` read port | One port: `get`/`put`; publish/cleanup is reader-specific and behind no port | A later-milestone additional store is a new factory behind `selectBackend`; protocol/trust never move. |

## Build order

Phase structure and dependency ordering are owned by `.planning/ROADMAP.md` (7 phases: teardown, walking
skeleton, default cache in CI, cross-context read, publish + retention + observability, trust-widening +
PPE gate, distribution + docs + governance). This research feeds those phases; it does not define its own.

## Anti-Patterns (specific to this work)

### Trusting the wrong event set / one shared list for both gates
**What people do:** put all trusted events in one list and reuse it for both the serve write gate and the publish gate; or add `pull_request_target`/`issue_comment`/`workflow_run` to "cover more triggers."
**Why it's wrong:** one shared list means widening the write gate also widens the publish gate, republishing PR/release-scoped content as the shared public read path - collapsing GitHub's isolation. And `pull_request_target`/`issue_comment`/fork-`workflow_run` run untrusted-influenced code in the *default-branch* scope - the real CREEP vector.
**Do this instead:** build `isCacheWriteTrusted` (serve, wider) and `isSyncPublishTrusted` (publish, narrow: `{push, schedule}` + default branch) as two separate predicates; test-lock the publish gate's rejection of PR/release; add exactly `pull_request`/`release` to the write gate (host-gated), never the dangerous set.

### Treating the in-code trust gate as the CREEP control
**What people do:** reason "we gate writes in code, so forks are safe."
**Why it's wrong:** the env is fork-spoofable; the load-bearing control is GitHub's server-side read-only cache token (2026-06-26). The in-code gate is defense-in-depth only.
**Do this instead:** keep the ordering explicit (GitHub server-side > workflow permissions > in-code gate); document the GHES version-floor caveat for the server-side control; detect the host from `GITHUB_SERVER_URL` and fail closed on GHES.

### Letting a reader maintain a recency signal
**What people do:** have the local `serve` process record access into a manifest.
**Why it's wrong:** local is anonymous and read-only by construction (writes stay OUT). A reader-write path reopens the exact trust surface the design avoids.
**Do this instead:** do not build recency eviction in v0.0.1 (section 2); ship age-based cleanup only.

### Adding a second retention knob
**What people do:** introduce a separate "recency window" env var distinct from `CACHE_MIRROR_MAX_AGE_DAYS`.
**Why it's wrong:** read-window and retention are one coupled setting; a second knob desynchronizes them (retained-but-unreadable or expired-but-uncleanable) - a class of silent bug.
**Do this instead:** one coupled setting; resolve read-window and retention from the same value.

## Sources

- GitHub read-only Actions cache for untrusted triggers (2026-06-26, fetched in full via markdown.new): <https://github.blog/changelog/2026-06-26-read-only-actions-cache-for-untrusted-triggers/> - HIGH. States `pull_request`/`release` keep RW via non-default-branch scope; lists the RW trigger set; RO issued for untrusted + default-scope.
- GitHub Actions dependency-caching reference (scope model, PR merge-ref isolation, RO triggers, "anyone who can open a PR can read base-branch caches"): <https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching> - HIGH.
- GitHub REST release-assets schema (`download_count`, `created_at`, `updated_at`; increment-on-octet-stream not authoritatively documented): <https://docs.github.com/en/rest/releases/assets> - MEDIUM on the recency signal.
- Nx self-hosted caching usage notes + HTTP contract (`GET`/`PUT /v1/cache/{hash}`, bearer token, 403 for read-only writes, 409 override, 404 miss): <https://nx.dev/docs/guides/tasks--caching/self-hosted-caching#usage-notes> - HIGH.
- Nx enterprise security ("writes only from trusted CI branches", CREEP framing, PR artifacts isolated): <https://nx.dev/enterprise/security> - HIGH (corroborates the scope-isolation design; note it is Nx-Cloud marketing framing).
- Nx `@nx/azure-cache` plugin overview (comparable adapter shape: single storage backend behind the Nx contract, `localMode`/`ciMode`, OIDC): <https://21.nx.dev/docs/reference/remote-cache-plugins/azure-cache/overview> - HIGH.
- CVE-2025-36852 CREEP background: <https://nx.dev/blog/cve-2025-36852-critical-cache-poisoning-vulnerability-creep> - referenced (already in project context).
- Locked foundation (grounding, not re-derived): `.planning/ARCHITECTURE-DECISION.md` (control ledger C1-C18), `.planning/REQUIREMENTS.md`, FOUND-01 reader spike `.planning/spikes/001-005`.

---
*Architecture research for: self-hosted Nx remote cache on GitHub-native primitives*
*Researched: 2026-07-17. Greenfield reframe: 2026-07-18 (rebased from a subsequent-milestone refinement onto a build-from-scratch framing on the LOCKED foundation; domain findings, sources, and confidence ratings unchanged).*
