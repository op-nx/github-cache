# Stack Research

**Domain:** Self-hosted Nx remote cache backed by GitHub / Git primitives
**Researched:** 2026-07-17
**Confidence:** HIGH (Nx contract + GitHub limits verified against primary docs 2026-07-17; keep/pivot rationale MEDIUM-HIGH)

> Brownfield note: this milestone keeps the existing implementation. This file
> answers "are the current primitive choices still the best ones in 2026?" and
> pins the contract/versions the roadmap must target. It does NOT re-document
> the shipped system (see `.planning/codebase/STACK.md` / `ARCHITECTURE.md`).

---

## 1. Nx self-hosted remote cache contract (CURRENT, 2026)

**Verdict: the project targets the correct, current contract. Keep it.** On Nx 21+
(project is on Nx 23.1.0) the OpenAPI HTTP server is the ONLY supported
self-hosted path; both older mechanisms are deprecated (see section 4).

Source (verified in full 2026-07-17):
https://nx.dev/docs/guides/tasks--caching/self-hosted-caching#usage-notes

**The contract (stable OpenAPI 3.0 spec, `version: 1.0.0`):**

| Element | Value | Notes |
|---------|-------|-------|
| Endpoint | `PUT /v1/cache/{hash}` and `GET /v1/cache/{hash}` | tar archives as `application/octet-stream` binary |
| Auth | HTTP `bearer` scheme | single token; server decides read-only vs read-write |
| `hash` | path param, string | task hash; validate at the trust boundary |
| PUT `Content-Length` | required header | file size in bytes |
| PUT responses | `200` stored, `401` missing/invalid token, `403` forbidden (e.g. read-only token used to write), **`409` cannot override existing record** | 409 is load-bearing (see below) |
| GET responses | `200` octet-stream, `403` forbidden, `404` not found | |

**Handshake env vars (the client side, read by the Nx CLI):**

| Env var | Purpose |
|---------|---------|
| `NX_SELF_HOSTED_REMOTE_CACHE_SERVER` | base URL of your server; presence enables the feature |
| `NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN` | bearer token sent by Nx |
| `NODE_TLS_REJECT_UNAUTHORIZED=0` | disables TLS cert validation (N/A here: server is loopback plain HTTP) |

**Load-bearing detail for CREEP safety:** the deprecation guidance explicitly
requires `409 Conflict` on a write to an existing key and warns that
"implementations that allow overwriting existing entries are vulnerable even
without a race." The shipped server already maps `@actions/cache`'s `-1`
(already-cached / write-denied) to an idempotent 409 - **do not regress this.**
Source: https://nx.dev/docs/reference/deprecated/self-hosted-cache-packages

**"while the underlying data format may change in future Nx versions, the
OpenAPI specification should remain stable"** - so pinning behaviour to this
spec (not to a data-format assumption) is correct.

---

## 2. GitHub / Git storage primitives - comparison and keep-or-pivot

The two hard requirements that eliminate most primitives:
1. **CI read-write** needs a first-party CI cache API (the runner-injected token).
2. **Local dev read** needs an **anonymous public read path** (no
   `ACTIONS_RUNTIME_TOKEN` exists off-runner) AND **keyed lookup by hash**.

Sources: GitHub dependency-caching reference (verified in full 2026-07-17)
https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching
; read-only-token changelog https://github.blog/changelog/2026-06-26-read-only-actions-cache-for-untrusted-triggers/

| Primitive | Write auth | Anonymous read | Keyed lookup | Size / retention | Cleanup API | Last-accessed signal | Fit |
|-----------|-----------|----------------|--------------|------------------|-------------|----------------------|-----|
| **Actions cache** | `ACTIONS_RUNTIME_TOKEN` (runner-only, JS actions only), ref-scoped | **None** (no public REST download of content) | Yes (key = hash) | 10 GB/repo default (up to 10 TB configurable); **7-day last-access eviction**; LRU eviction over limit | `gh cache delete` / `DELETE /repos/{o}/{r}/actions/caches`; list via `GET .../actions/caches` | **YES** - list API returns `last_accessed_at`; eviction is last-access LRU | **CI RW backend - KEEP** |
| **Release assets** | `GITHUB_TOKEN` (`contents: write`) via gh/Octokit | **YES** (public repos) | Yes (asset name = hash, sharded by month) | ~2 GiB/asset; 1000 assets/release soft cap; **no auto-expiry** (permanent until deleted) | `gh release delete-asset` / `DELETE /repos/{o}/{r}/releases/assets/{id}` | **NO** - only `created_at`, `updated_at`, cumulative `download_count`; no per-access timestamp | **Local RO mirror - KEEP** |
| Actions Artifacts | `ACTIONS_RUNTIME_TOKEN` (runner-only) | **None** (auth required to download) | No (run-scoped, not key-scoped) | 90-day default retention (1-90 configurable) | `DELETE .../actions/artifacts/{id}` | No (created/expired only) | **Reject** - no anon read, wrong lookup shape |
| GitHub Packages | `GITHUB_TOKEN` (`packages: write`) | Partial (public pkgs; npm auth quirks) | Version namespace, not free-form key | Generous | Manual / version-delete API | No | **Reject** - version namespace churns badly on content hashes; overkill |
| git objects / refs (cache branch, LFS) | push via `GITHUB_TOKEN` | YES (public clone/raw) | Yes (ref/path) | Repo-bloating; no per-object expiry | Manual GC / history rewrite | No | **Reject** - bloats history, no clean eviction |

### Keep-or-pivot decisions

**Backend A - GitHub Actions cache (read-write, CI): KEEP. Confidence: HIGH.**
It is the only GitHub primitive that is a purpose-built CI cache with a
first-party keyed API, AND it gives two security properties for free that the
project depends on:
- **Ref-scoped isolation** - caches are scoped per branch/ref; a `pull_request`
  cache is scoped to the merge ref (`refs/pull/.../merge`) and *cannot* write the
  default-branch scope. This is the load-bearing CREEP defense (see section 3).
- **Built-in LRU** - GitHub evicts entries not accessed in 7 days and evicts by
  last-access order over the 10 GB limit. No client-side retention logic needed
  for the CI tier. No serious alternative exists: Actions Artifacts have no
  keyed lookup and expire per-run; no other primitive exposes the runner cache
  service.

**Backend B - Release-asset mirror (read-only, local): KEEP. Confidence: HIGH.**
Its entire reason to exist is the one property no other primitive offers:
**anonymous public read.** Local dev has no `ACTIONS_RUNTIME_TOKEN`, and there is
**no public REST endpoint to download Actions cache content** - so the Actions
cache is unreachable off-runner. Every alternative fails the anonymous-read
requirement (Artifacts, Packages both require auth to download) or the
keyed-lookup requirement (Artifacts are run-scoped). Releases give a stable,
anonymously-fetchable, name-addressable blob store. The ~2 GiB/asset ceiling is
already matched by the server's 2 GB body cap; the 1000-assets/release cap is
handled by month-sharding and is explicitly deferred as out-of-scope until a
repo exceeds it.

**Net: no pivot.** The current two-backend design is the correct fit for the two
hard constraints. The primitives that could theoretically replace either backend
all fail a hard requirement, verified above. Revisit only if GitHub ships a
public anonymous read path for Actions cache content (would collapse both tiers
into one) - none exists as of 2026-07-17.

---

## 3. `pull_request` / `release` triggers and the read-only cache token

This resolves the open "why not `pull_request`?" question (PROJECT.md Active req).

**What changed (2026-06-26):** GitHub now issues a **read-only** cache token to
runs where BOTH the trigger is untrusted (someone without write access can fire
it) AND the execution/cache scope resolves to the shared default-branch SHA.
Source: https://github.blog/changelog/2026-06-26-read-only-actions-cache-for-untrusted-triggers/

**Triggers that keep full read-write cache access:**
- Default-branch-scope writers: `push`, `schedule`, `workflow_dispatch`,
  `repository_dispatch`, `delete`, `registry_package`, `page_build`.
- **Non-default-branch-scope triggers: `pull_request` and `release`** keep RW
  because they write an *isolated* scope, not the default-branch scope.

**Why `pull_request`/`release` are safe to add to the write-trust gate:**
The dependency-caching reference states the `pull_request` event "is not
affected" - its caches are scoped to the merge ref and "cannot be written to the
default branch's scope." So a fork PR can write its own ref-scoped cache but can
never poison the `push` (default-branch) scope that trusted builds restore. The
load-bearing control is **GitHub's server-side ref-scoping + read-only token**,
not the in-code event-name check (which is fork-spoofable). Recommendation:
- **Server (`isWriteTrusted`): allow `pull_request` and `release`.** GitHub's
  ref-scoping/read-only-token backstops fork poisoning server-side. Confidence: HIGH.
- **Publish-mirror flow: keep gated to default-branch `push`.** PR/release-scoped
  cache entries are untrusted and ref-isolated; they must NOT be mirrored into the
  anonymously-readable Releases (that would launder untrusted artifacts into the
  trusted local-read path). This distinction is the important nuance for the
  roadmap. Confidence: HIGH.

Benefit of allowing PR writes is limited (PR-scoped entries only help re-runs of
the same PR), but it is correct and free once the server relies on ref-scoping.

---

## 4. What NOT to use (deprecated Nx APIs - prior art traps)

| Avoid | Why | Use instead |
|-------|-----|-------------|
| **Nx custom Tasks Runner API** (`tasksRunnerOptions.runner`, `defaultTasksRunner`) | Deprecated; predates the plugin API; "modifications to the lifecycle ... break important invariants." Removed as the caching path in Nx 21+. | The OpenAPI HTTP server (section 1). For pre/post logic use `preTasksExecution` / `postTasksExecution` plugin hooks (Nx 20.4+). Source: https://21.nx.dev/docs/reference/deprecated/custom-tasks-runner |
| **`@nx/s3-cache`, `@nx/gcs-cache`, `@nx/azure-cache`, `@nx/shared-fs-cache`** (Powerpack bucket-cache plugins) | Deprecated 2026-05-21. **CVE-2025-36852 (CREEP)** is a design flaw (single shared credential, no branch provenance) and is unpatchable. These are a *different generation* from the OpenAPI server - they use `NX_KEY` activation + `nx.json` config + `localMode`/`ciMode`/`NX_POWERPACK_CACHE_MODE`, none of which are part of the current contract. | The OpenAPI HTTP server. Sources: https://nx.dev/docs/reference/deprecated/self-hosted-cache-packages ; https://21.nx.dev/docs/reference/remote-cache-plugins/azure-cache/overview ; https://npmx.dev/package/@nx/azure-cache |
| **`nx-remotecache-azure` / `nx-remotecache-custom`** (3rd-party prior art) | A **custom task runner** built on `nx-remotecache-custom`; marked "Deprecated" for Nx >= 21 and explicitly CREEP-affected ("no planned fix"). Any prior art from this family targets the OLD task-runner API - do not copy its integration shape. | Read it only for storage-adapter ideas, not for the Nx integration. Source: https://github.com/NiklasPor/nx-remotecache-azure |
| **`NX_POWERPACK_CACHE_MODE`, `nx.json` `azure`/`localMode`/`ciMode` keys** | Powerpack-plugin config, not the OpenAPI server contract. Mixing them in signals targeting the wrong generation. | Server-side read-only enforcement (the mirror `put()` -> 403) + runtime-context backend selection, as already built. |

**Three generations, only the third is current:**
1. Custom Tasks Runner API (oldest) - deprecated.
2. Powerpack remote-cache plugins (`@nx/*-cache`, `NX_KEY`) - deprecated 2026-05-21 (CREEP).
3. **OpenAPI self-hosted HTTP server (`NX_SELF_HOSTED_REMOTE_CACHE_SERVER`)** - CURRENT. <- the project's target.

---

## 5. Versions and pinning that matter

| Package | Project has | Latest (2026-07-17) | Recommendation |
|---------|-------------|---------------------|----------------|
| `@actions/cache` | `^6.2.0` | **6.2.0** (published 2026-07-13) | **Keep, pin tightly.** Current. See churn note below. |
| `@octokit/rest` | `^22.0.1` | **22.0.1** (published 2025-10-31) | **Keep.** v22 is current major; `error.status` structural discrimination is available (relevant to the gh->Octokit migration). |
| `gh` CLI | runtime (runner) | uncontrolled | **Migrate error-sensitive paths off it** (see below). |
| Nx | `23.1.0` | 23.x line | Keep; OpenAPI contract is stable across Nx 21+. |
| Node | 24 LTS (`lts/krypton`) | - | Keep; `using: node24` for JS actions. |

**`@actions/cache` major-version churn (the v1->v2 story).** GitHub retired the
legacy Actions cache *service* (the "v1" backend brownout) in early 2025; the
`actions/cache` composite action jumped to v4.2.0+ and the `@actions/cache` npm
library took corresponding major bumps (v4 dropped the legacy service; v5 and v6
lines are both actively published - 6.0.0 landed 2026-01-29, 6.2.0 on
2026-07-13). **Pinning caveat that is load-bearing here:** `@actions/cache`
computes a *cache version* hash over the resolved archive path + compression
method. Bumping the library OR changing `cacheArchivePath()` can silently
invalidate every existing entry (every restore misses). Therefore:
- Pin `@actions/cache` to an exact version (not a floating `^`) OR gate upgrades
  behind an end-to-end save->restore verification, because a minor bump that
  changes compression defaults is a silent cache-wipe, not a visible error.
- `cacheArchivePath()` must remain the single source of truth (already a
  documented constraint). Confidence: HIGH (matches the codebase's own constraint).

**gh CLI -> Octokit migration (Active req).** `publish-mirror`/`cleanup`
discriminate `gh` outcomes by matching human-readable stderr
(`/already exists/i`, `HTTP 404`) - brittle across uncontrolled `gh` versions on
consumer runners. `@octokit/rest@22` is already a dependency and gives
structural errors (`error.status === 404/409/422`). Recommendation: move release
create / list / delete-asset / delete to Octokit REST for structural error
discrimination and one fewer external-CLI dependency for consumers. **Caveat to
flag:** Release *asset upload* goes to `uploads.github.com` with a raw binary
body; Octokit's `repos.uploadReleaseAsset` can be finicky with large (~2 GiB)
bodies (correct `Content-Length`, Buffer/stream handling) - verify a large-asset
upload before dropping the `gh release upload` path. Confidence: MEDIUM (robustness
improvement, not a correctness fix; gh works today).

---

## 6. Optional LRU for the mirror (Active req) - feasibility

**Age-based cleanup coupled to the read window is already correct; keep it as the
mandatory floor.** True per-asset LRU on the Release mirror is **architecturally
impossible** as a self-updating signal:
- Release assets expose no last-accessed timestamp - only `created_at`,
  `updated_at`, and a cumulative `download_count` (no time window, can't drive
  windowed LRU).
- Mirror reads are **anonymous and static** (a plain asset GET); there is no
  server to record access, so the read path can never update access state.

Therefore the only realistic "LRU" approximations, in order of laziness:
1. **Do nothing beyond age-based** (recommended default) - simplest, already
   coupled to the read lookback via `resolveMaxAgeDays`/`shardTagsForWindow`.
   Confidence: HIGH this is sufficient for the low-churn target audience.
2. **CI-side access approximation** - the Actions cache list API DOES return
   `last_accessed_at`. The daily single-writer cleanup could read it and prune
   mirror assets whose *CI-side* last-access is stale, recorded in a manifest
   (read-modify-write in the cleanup workflow). This tracks CI access only, never
   local reads. Confidence: MEDIUM it's worth the added manifest state.

If LRU is pursued, put the manifest in the single-writer daily cleanup workflow
(never on the read path), and never add a second retention knob beside
`CACHE_MIRROR_MAX_AGE_DAYS`.

---

## Installation

No stack change. Runtime deps stay as-is:

```bash
# runtime (already present)
npm install @actions/cache@6.2.0 @octokit/rest@^22.0.1 tslib@^2.3.0
```

`gh` CLI is a runner-provided external tool, not an npm dep. If the Octokit
migration (section 5) lands, `gh` usage in publish/cleanup can be reduced or
removed - no new dependency required (Octokit is already installed).

---

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `@actions/cache@6.2.0` | Node 24, current Actions cache service | Pin exact; cache-version hash sensitivity (section 5) |
| `@octokit/rest@22` | Node 24, GitHub REST v3 | Structural `error.status`; large-asset upload needs verification |
| Nx 23.1.0 | OpenAPI self-hosted contract v1.0.0 | Contract stable across Nx 21+ |

---

## Sources

- https://nx.dev/docs/guides/tasks--caching/self-hosted-caching#usage-notes - CURRENT OpenAPI contract, env vars (verified in full) - HIGH
- https://nx.dev/docs/reference/deprecated/self-hosted-cache-packages - deprecation of `@nx/*-cache`, 409 requirement, CREEP (verified in full) - HIGH
- https://21.nx.dev/docs/reference/deprecated/custom-tasks-runner - custom task runner deprecation, pre/post hooks (verified in full) - HIGH
- https://21.nx.dev/docs/reference/remote-cache-plugins/azure-cache/overview - Powerpack azure-cache generation, NX_KEY/localMode/ciMode (verified in full) - HIGH
- https://npmx.dev/package/@nx/azure-cache - deprecated 1st-party plugin (referenced) - MEDIUM
- https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching - Actions cache limits, 7-day LRU eviction, ref-scoping, low-trust triggers (verified in full) - HIGH
- https://github.blog/changelog/2026-06-26-read-only-actions-cache-for-untrusted-triggers/ - read-only token model, pull_request/release keep RW (verified in full) - HIGH
- https://github.com/NiklasPor/nx-remotecache-azure - 3rd-party custom-task-runner prior art, deprecated for Nx >= 21, CREEP-affected (verified in full) - HIGH
- registry.npmjs.org (@actions/cache, @octokit/rest) - current versions + publish dates (verified 2026-07-17) - HIGH
- https://nx.dev/blog/cve-2025-36852-critical-cache-poisoning-vulnerability-creep - CREEP background (referenced via deprecation notice) - HIGH

---
*Stack research for: self-hosted Nx remote cache on GitHub primitives*
*Researched: 2026-07-17*
