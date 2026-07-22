# Stack Research

**Domain:** Self-hosted Nx remote cache backed by GitHub / Git primitives
**Researched:** 2026-07-17
**Confidence:** HIGH (Nx contract + GitHub limits verified against primary docs 2026-07-17; primitive-selection rationale MEDIUM-HIGH)

> Greenfield note: this pins the contract/versions the build must target and confirms the storage
> primitives are the right ones to build on in 2026. The storage model is LOCKED
> (`.planning/ARCHITECTURE-DECISION.md`): Actions cache = CI RW default; GitHub Releases = the
> cross-context reader (FOUND-01). This file grounds those choices; it does not re-open them.

---

## 1. Nx self-hosted remote cache contract (CURRENT, 2026)

**Verdict: target the current OpenAPI HTTP contract.** On Nx 21+ (the workspace is on Nx 23.1.0)
the OpenAPI HTTP server is the ONLY supported self-hosted path; both older mechanisms are
deprecated (see section 4).

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

**Contract-drift caveat (verified):** the PUT success code changed **202 -> 200 between Nx 20 and
Nx 21 while `info.version` stayed `1.0.0`** - so watching `info.version` does NOT detect drift. The
conformance fixture must hash the full vendored spec and pin a named Nx version. The Nx client
(`HttpRemoteCache`) matches PUT success **strictly** as `200` (409/403 are graceful no-ops; any other
status errors the store), so the **Nx 21+ floor is hard** - a `202`-returning server breaks the client.

**Handshake env vars (the client side, read by the Nx CLI):**

| Env var | Purpose |
|---------|---------|
| `NX_SELF_HOSTED_REMOTE_CACHE_SERVER` | base URL of your server; presence enables the feature |
| `NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN` | bearer token sent by Nx |
| `NODE_TLS_REJECT_UNAUTHORIZED=0` | disables TLS cert validation (N/A here: server is loopback plain HTTP) |

**Load-bearing detail for CREEP safety:** the deprecation guidance explicitly requires `409 Conflict`
on a write to an existing key and warns that "implementations that allow overwriting existing entries
are vulnerable even without a race." Build the server to map `@actions/cache`'s `-1` (already-cached /
write-denied) to an idempotent 409 - this is a first-write-wins property, not an optional nicety.
Source: https://nx.dev/docs/reference/deprecated/self-hosted-cache-packages

**"while the underlying data format may change in future Nx versions, the OpenAPI specification should
remain stable"** - so pinning behaviour to this spec (not to a data-format assumption) is correct.

---

## 2. GitHub / Git storage primitives - comparison and selection

The two hard requirements that eliminate most primitives:
1. **CI read-write** needs a first-party CI cache API (the runner-injected token).
2. **Cross-context read** needs a **keyed lookup by hash** reachable off-runner - both an **anonymous
   public read path** (for public repos) AND authenticated read for private repos via the developer's
   existing GitHub auth (FOUND-02); no `ACTIONS_RUNTIME_TOKEN` exists off-runner.

Sources: GitHub dependency-caching reference (verified in full 2026-07-17)
https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching
; read-only-token changelog https://github.blog/changelog/2026-06-26-read-only-actions-cache-for-untrusted-triggers/

| Primitive | Write auth | Anonymous read | Keyed lookup | Size / retention | Cleanup API | Last-accessed signal | Fit |
|-----------|-----------|----------------|--------------|------------------|-------------|----------------------|-----|
| **Actions cache** | `ACTIONS_RUNTIME_TOKEN` (runner-only, JS actions only), ref-scoped | **None** (no public REST download of content) | Yes (key = hash) | 10 GB/repo default (up to 10 TB configurable); **7-day last-access eviction**; LRU eviction over limit | `gh cache delete` / `DELETE /repos/{o}/{r}/actions/caches`; list via `GET .../actions/caches` | **YES** - list API returns `last_accessed_at`; eviction is last-access LRU | **CI RW backend - LOCKED default** |
| **Release assets** | `GITHUB_TOKEN` (`contents: write`) via Octokit | **YES** (public repos) | Yes (asset name = hash, sharded by month) | ~2 GiB/asset; 1000 assets/release soft cap; **no auto-expiry** (permanent until deleted) | `DELETE /repos/{o}/{r}/releases/assets/{id}` | **NO** - only `created_at`, `updated_at`, cumulative `download_count`; no per-access timestamp | **LOCKED reader (FOUND-01)** |
| Actions Artifacts | `ACTIONS_RUNTIME_TOKEN` (runner-only) | **None** (auth required to download) | No (run-scoped, not key-scoped) | 90-day default retention (1-90 configurable) | `DELETE .../actions/artifacts/{id}` | No (created/expired only) | **Reject** - no anon read, wrong lookup shape |
| GitHub Packages / GHCR | `GITHUB_TOKEN` (`packages: write`) | Partial (public pkgs; npm auth quirks) | Version/tag namespace | Generous | Manual / version-delete API | No | **later-milestone revisit trigger (GHCR-01)** - deferred with cosign + Docker |
| git objects / refs (cache branch, LFS) | push via `GITHUB_TOKEN` | YES (public clone/raw) | Yes (ref/path) | Repo-bloating; no per-object expiry | Manual GC / history rewrite | No | **Reject** - bloats history, no clean eviction |

### Selection decisions

**Backend A - GitHub Actions cache (read-write, CI): the LOCKED default. Confidence: HIGH.**
It is the only GitHub primitive that is a purpose-built CI cache with a first-party keyed API, AND it
gives two security properties for free that the design depends on:
- **Ref-scoped isolation** - caches are scoped per branch/ref; a `pull_request` cache is scoped to the
  merge ref (`refs/pull/.../merge`) and *cannot* write the default-branch scope. This is the
  load-bearing CREEP defense (see section 3).
- **Built-in LRU** - GitHub evicts entries not accessed in 7 days and evicts by last-access order over
  the 10 GB limit. No client-side retention logic needed for the CI tier. No serious alternative exists:
  Actions Artifacts have no keyed lookup and expire per-run; no other primitive exposes the runner cache
  service.

**Backend B - Release-asset reader (read-only, local): the LOCKED reader (FOUND-01). Confidence: HIGH.**
Its reason to exist is the one property no other v0.0.1 primitive offers cleanly: **anonymous public read
plus keyed lookup**, with authenticated read for private repos via the developer's existing GitHub auth.
Local dev has no `ACTIONS_RUNTIME_TOKEN`, and there is **no public REST endpoint to download Actions
cache content** - so the Actions cache is unreachable off-runner. Alternatives fail the anonymous-read
requirement (Artifacts, Packages require auth to download) or the keyed-lookup requirement (Artifacts
are run-scoped). Releases give a stable, name-addressable blob store. The ~2 GiB/asset ceiling coincides
with the server's 2 GB body cap (an artifact at the boundary must fail loud, ROBUST-02); the
1000-assets/release cap is handled by month-sharding and skips-and-warns at the limit (ROBUST-05). The
GHCR/OCI registry was the one serious alternative, validated in the FOUND-01 spike
(`.planning/spikes/001-005`) and deferred to the **later-milestone GHCR revisit trigger** on the fewer-incident-hazards
axis (no >5000-download undeletable wall, no child-manifest cleanup, no delete-credential nuance).

**Net: the two-backend design is the locked fit** for the two hard constraints; every rejected primitive
provably fails a hard requirement above. Revisit only if GitHub ships a public anonymous read path for
Actions cache content (would collapse both tiers) - none exists as of 2026-07-17.

---

## 3. `pull_request` / `release` triggers and the read-only cache token

Grounds the trust-widening capability (TRUST-01).

**What changed (2026-06-26):** GitHub issues a **read-only** cache token to runs where BOTH the trigger
is untrusted (someone without write access can fire it) AND the execution/cache scope resolves to the
shared default-branch SHA.
Source: https://github.blog/changelog/2026-06-26-read-only-actions-cache-for-untrusted-triggers/

**Triggers that keep full read-write cache access:**
- Default-branch-scope writers: `push`, `schedule`, `workflow_dispatch`, `repository_dispatch`,
  `delete`, `registry_package`, `page_build`.
- **Non-default-branch-scope triggers: `pull_request` and `release`** keep RW because they write an
  *isolated* scope, not the default-branch scope.

**Why `pull_request`/`release` are safe to add to the write-trust gate:**
The dependency-caching reference states the `pull_request` event "is not affected" - its caches are
scoped to the merge ref and "cannot be written to the default branch's scope." So a fork PR can write
its own ref-scoped cache but can never poison the `push` (default-branch) scope that trusted builds
restore. The load-bearing control is **GitHub's server-side ref-scoping + read-only token**, not the
in-code event-name check (which is fork-spoofable). Build accordingly:
- **Serve write gate: allow `pull_request` and `release`** - but only where GitHub's guard exists,
  detected from `GITHUB_SERVER_URL` (`github.com`/`*.ghe.com` -> ON; every GHES host -> OFF,
  fail-closed). GitHub's ref-scoping/read-only-token backstops fork poisoning server-side. Confidence: HIGH.
- **Sync/publish gate: keep it a separate predicate, default-branch `{push, schedule}` only.**
  PR/release-scoped cache entries are untrusted and ref-isolated; they must NOT be mirrored into the
  anonymously-readable Releases (that would launder untrusted artifacts into the trusted local-read
  path). This distinction is the important nuance. Confidence: HIGH.

Benefit of allowing PR writes is limited (PR-scoped entries only help re-runs of the same PR), but it is
correct and free once the server relies on ref-scoping.

---

## 4. What NOT to use (deprecated Nx APIs - prior-art traps)

| Avoid | Why | Use instead |
|-------|-----|-------------|
| **Nx custom Tasks Runner API** (`tasksRunnerOptions.runner`, `defaultTasksRunner`) | Deprecated; predates the plugin API; "modifications to the lifecycle ... break important invariants." Removed as the caching path in Nx 21+. | The OpenAPI HTTP server (section 1). For pre/post logic use `preTasksExecution` / `postTasksExecution` plugin hooks (Nx 20.4+). Source: https://21.nx.dev/docs/reference/deprecated/custom-tasks-runner |
| **`@nx/s3-cache`, `@nx/gcs-cache`, `@nx/azure-cache`, `@nx/shared-fs-cache`** (Powerpack bucket-cache plugins) | Deprecated 2026-05-21. **CVE-2025-36852 (CREEP)** is a design flaw (single shared credential, no branch provenance) and is unpatchable. A *different generation* from the OpenAPI server - `NX_KEY` activation + `nx.json` config + `localMode`/`ciMode`/`NX_POWERPACK_CACHE_MODE`, none part of the current contract. | The OpenAPI HTTP server. Sources: https://nx.dev/docs/reference/deprecated/self-hosted-cache-packages ; https://21.nx.dev/docs/reference/remote-cache-plugins/azure-cache/overview ; https://npmx.dev/package/@nx/azure-cache |
| **`nx-remotecache-azure` / `nx-remotecache-custom`** (3rd-party prior art) | A **custom task runner** built on `nx-remotecache-custom`; marked "Deprecated" for Nx >= 21 and explicitly CREEP-affected ("no planned fix"). Any prior art from this family targets the OLD task-runner API - do not copy its integration shape. | Read it only for storage-adapter ideas, not for the Nx integration. Source: https://github.com/NiklasPor/nx-remotecache-azure |
| **`NX_POWERPACK_CACHE_MODE`, `nx.json` `azure`/`localMode`/`ciMode` keys** | Powerpack-plugin config, not the OpenAPI server contract. Mixing them in signals targeting the wrong generation. | Server-side read-only enforcement (mirror `put()` -> 403) + runtime-context backend selection. |

**Three generations, only the third is current:**
1. Custom Tasks Runner API (oldest) - deprecated.
2. Powerpack remote-cache plugins (`@nx/*-cache`, `NX_KEY`) - deprecated 2026-05-21 (CREEP).
3. **OpenAPI self-hosted HTTP server (`NX_SELF_HOSTED_REMOTE_CACHE_SERVER`)** - CURRENT. <- the target.

---

## 5. Versions and pinning that matter

| Package | Target | Latest (2026-07-17) | Recommendation |
|---------|--------|---------------------|----------------|
| `@actions/cache` | `6.2.0` (pin exact) | **6.2.0** (published 2026-07-13) | **Pin tightly (exact, not `^`).** Current. See churn note below. |
| `@octokit/rest` | `^22.0.1` | **22.0.1** (published 2025-10-31) | v22 is current major; `error.status` structural discrimination is available - use it from the start (no `gh` CLI). |
| `gh` CLI | not a dependency | uncontrolled | **Do not depend on it for error-sensitive paths** (see below). |
| Nx | `23.1.0` | 23.x line | OpenAPI contract is stable across Nx 21+. |
| Node | 24 LTS (`lts/krypton`) | - | `using: node24` for JS actions. |

**`@actions/cache` major-version churn (the v1->v2 story).** GitHub retired the legacy Actions cache
*service* (the "v0.0.1" backend brownout) in early 2025; the `actions/cache` composite action jumped to
v4.2.0+ and the `@actions/cache` npm library took corresponding major bumps (v4 dropped the legacy
service; v5 and v6 lines are both actively published - 6.0.0 landed 2026-01-29, 6.2.0 on 2026-07-13).
**Pinning caveat that is load-bearing here:** `@actions/cache` computes a *cache version* hash over the
resolved archive path + compression method. Bumping the library OR changing the archive-path helper can
silently invalidate every existing entry (every restore misses). Therefore:
- Pin `@actions/cache` to an exact version (not a floating `^`) AND gate upgrades behind an end-to-end
  save->restore verification (`test:act`), because a minor bump that changes compression defaults is a
  silent cache-wipe, not a visible error.
- The archive-path helper (`cacheArchivePath()`) must be the single source of truth - a load-bearing
  constraint. Confidence: HIGH.

**Octokit from the start (structural error discrimination).** Build publish/cleanup on `@octokit/rest@22`
`error.status === 404/409/422` from day one; do NOT build a `gh`-CLI path that discriminates outcomes by
matching human-readable stderr (brittle across uncontrolled `gh` versions on consumer runners) and plan
to replace it. Octokit gives structural errors and one fewer external-CLI dependency for consumers.
**Caveat to flag:** Release *asset upload* goes to `uploads.github.com` with a raw binary body;
`repos.uploadReleaseAsset` can be finicky with large (~2 GiB) bodies (correct `Content-Length`,
Buffer/stream handling) - verify a real large-asset upload against the ~2 GiB boundary before relying on
it, and ensure the boundary case fails loud (ROBUST-02). Confidence: MEDIUM (robustness detail, not a
correctness risk to the contract).

---

## 6. Recency / LRU for the reader - OUT OF SCOPE (feasibility record)

**Age-based cleanup coupled to the read window is the v0.0.1 floor; keep it mandatory (RETAIN-01/03).**
Recency/LRU on the Release reader is **out of scope for v0.0.1** (mutable manifest is security-negative;
`.planning/REQUIREMENTS.md`). It is also architecturally awkward, worth recording:
- Release assets expose no last-accessed timestamp - only `created_at`, `updated_at`, and a cumulative
  `download_count` (no time window; cannot drive windowed LRU).
- Reader reads are **anonymous and static** (a plain asset GET); there is no server to record access, so
  the read path can never update access state.

The only realistic "recency" approximations - harvesting `last_accessed_at` from the Actions cache list
API into a single-writer manifest, or piggybacking the Actions-cache native LRU (an unused entry falls
out of that cache and stops being re-mirrored, ageing out by date) - either need mutable shared state
(the manifest, out of scope) or are already covered by age-based cleanup + native CI-tier LRU. **v0.0.1 ships
age-based cleanup only; never add a second retention knob beside `CACHE_MIRROR_MAX_AGE_DAYS`.** Recency is
a possible later-milestone spike gated on the `download_count` octet-stream-increment signal proving reliable.

---

## Installation

Runtime deps to install:

```bash
# runtime
npm install @actions/cache@6.2.0 @octokit/rest@^22.0.1 tslib@^2.3.0
```

`gh` CLI is a runner-provided external tool, not an npm dep, and is not depended on for error-sensitive
paths (section 5). Octokit covers publish/cleanup - no new dependency needed.

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
*Researched: 2026-07-17. Greenfield reframe: 2026-07-18 (rebased from a "keep the existing stack" framing onto a build-from-scratch target-selection framing on the LOCKED storage model; contract facts, version pins, sources, and confidence ratings unchanged).*
