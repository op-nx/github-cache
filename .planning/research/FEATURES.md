# Feature Research

**Domain:** Self-hosted Nx remote cache backed by GitHub / Git primitives (Actions cache + Release assets)
**Researched:** 2026-07-17
**Confidence:** HIGH (primary sources fetched in full: Nx self-hosted OpenAPI spec, GitHub read-only-cache changelog, GitHub Actions cache REST API, @nx/azure-cache + nx-remotecache-custom config surfaces)

> Greenfield note: this maps the *feature landscape* of Nx remote caches so the v0.0.1 capability set
> can be categorized as the system is built from scratch on the LOCKED foundation (reader = GitHub
> Releases; `.planning/ARCHITECTURE-DECISION.md`). It is not a plan - phase structure lives in
> `.planning/ROADMAP.md`. The v0.0.1 capabilities are mapped to requirement IDs in the last section.

## Feature Landscape

### Table Stakes (Users Expect These)

Missing any of these = "this isn't a working Nx remote cache." All are v0.0.1 build targets.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Nx self-hosted HTTP contract (`GET`/`PUT /v1/cache/{hash}`, bearer auth) | It is *the* interface Nx speaks; anything else Nx cannot call | LOW | Spec is tiny and stable: `NX_SELF_HOSTED_REMOTE_CACHE_SERVER` + `_ACCESS_TOKEN`. Build to it (walking skeleton, SRV-01..05). Source: https://nx.dev/docs/guides/tasks--caching/self-hosted-caching . |
| Correct status semantics: 200 / 401 / 403 / 404 / 409 | The OpenAPI spec bakes them in; Nx branches on them | LOW | Spec text: 403 = "read-only token used to write", 409 = "Cannot override an existing record", 404 = miss. Maps 1:1 to the port's `PutResult = 'stored' \| 'conflict' \| 'forbidden'`. Floor = Nx 21+ (PUT success is a hard `200`). |
| Best-effort reads (fault degrades to MISS, never breaks the build) | Nx treats remote cache as advisory; a 5xx must not fail a task | LOW | GET faults -> 404/MISS; writes fail closed. Contract-level expectation (SRV-05), not optional. |
| Read-write in CI, read-only downgrade available | Every cache exposes this: `@nx/azure-cache` `ciMode`/`localMode` (`read-only`/`no-cache`), `nx-remotecache-custom` independent `read`/`write` flags | LOW-MED | Build it context-*derived* (no caller flag), named and tested (TRUST-05). See mapping below. |
| Cache-poisoning safety (CREEP / CVE-2025-36852) | Post-CVE, "do not let untrusted triggers write" is baseline; Nx itself steers users to Nx Cloud over bucket caches for exactly this | MED | In-code trust gate + GitHub's 2026-06-26 server-side read-only token. Source: https://github.blog/changelog/2026-06-26-read-only-actions-cache-for-untrusted-triggers/ , https://nx.dev/blog/cve-2025-36852-critical-cache-poisoning-vulnerability-creep |
| Bounded retention / eviction | Storage cannot grow forever; every backend has *something* | LOW-MED | Azure/S3 delegate to cloud lifecycle rules; Actions cache has native 10 GB LRU + 7-day-disuse eviction; the RO tier uses age-based `CACHE_MIRROR_MAX_AGE_DAYS`. Age-based is the mandatory floor (RETAIN-01/03). |
| Cross-machine / cross-OS hash parity | A hit computed on machine A must restore on machine B, or the cache never hits | MED | `.gitattributes eol=lf`, OS-namespacing (CORR-01), per-OS publish matrix. Silent-failure prone; load-bearing. |
| Copy-paste setup + minimal config surface | Adoption dies if wiring it up needs source-reading | LOW-MED | Adoption docs (DOCS-01..06). `@nx/azure-cache` sets the bar: `nx add`, auth, set container+account in `nx.json`. See mapping below. |

### Differentiators (Competitive Advantage)

Where this project wins versus `@nx/azure-cache`, `@nx/s3-cache`, `nx-remotecache-*`, and Nx Cloud. Aligned with the Core Value ("correct + safe caching on GitHub infra with nothing extra to host").

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Zero extra infrastructure (GitHub-native storage) | No S3/Azure account, no bucket, no hosting, no bill. Every competing self-hosted cache needs a cloud account + credentials | LOW (inherent) | THE differentiator. Actions cache (RW/CI) + Release-asset mirror (RO/local). |
| Anonymous read-only local mirror (public Release assets) | External contributors / fresh clones get cache *reads* with **zero credentials**; azure/s3/custom all require creds even to read | MED | Uniquely fits open-source / low-churn repos. Anonymous 60 req/hr, `GH_TOKEN` lifts to 5000/hr. (Note: FOUND-02 requires authenticated private-repo local read to work too, not just anonymous public.) |
| Runtime-context backend selection (no mode flag) | Stronger safety than azure's `localMode`/`ciMode` which a user *can* set wrong; local is RO-only by construction | LOW-MED | "No caller can misconfigure RW vs RO" - a load-bearing CREEP property. Differentiator over the flag-based competitors. |
| Free + open-source (MIT) | `@nx/azure-cache` is commercial-licensed and **deprecated May 2026**; community `nx-remotecache-*` are archived / Nx-20-only. The ecosystem left a hole | LOW | Source: https://emilyxiong.medium.com/exploring-of-nx-self-hosted-cache-5bc39bd2ed7f . Being free+MIT is a real, current gap-filler (GOV-02). |
| CREEP defense-in-depth (3 layers) | In-code trust gate + GitHub server-side RO token + workflow permission isolation | MED | More layered than the "shared credentials read+write" model the Medium article flags as the CVE root cause. |
| Safe `pull_request` + `release` read-write | Matches GitHub's own cache-scoping model; unblocks PR-branch caching without poisoning the trusted default-branch cache | MED | Trust-widening slice (TRUST-01), host-detected fail-closed. See mapping. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Local read-write mode | "Let my laptop populate the shared cache" | Local writes = an untrusted, unauditable write path; reopens CREEP; local env is fork-spoofable | CI-only writes; local stays RO by construction (Out of Scope) |
| Hosted / managed cache service | "Give me an endpoint I don't run" | Defeats the entire zero-infra value prop; that market is Nx Cloud's | GitHub-native storage only |
| Nx custom task runner API | Old tutorials still show `tasksRunnerOptions` | Deprecated in Nx 20; removed path | Target only the self-hosted-cache HTTP contract |
| Streaming large bodies | "What if a task output is huge?" | Buffered-with-cap is simpler and matches the ~2 GiB Release-asset ceiling anyway; >2 GB outputs signal a caching-strategy problem upstream | Fully buffered, 2 GB cap (SRV-04); an artifact at the cap fails loud (ROBUST-02); revisit only on real demand |
| LRU / recency eviction on the mirror | "Bump last-accessed every time an entry is served" | Local mirror readers are **anonymous + read-only** and cannot write back; Releases expose no last-accessed field, only `download_count`; a manifest is mutable shared retention state (security-negative) | Age-based cleanup only in v0.0.1 (OUT OF SCOPE for recency; see mapping). Native Actions-cache LRU covers the CI tier |
| A second retention knob | "Separate read window from cleanup window" | Two knobs drift: retained assets become unreadable, or expired assets un-cleanable | One coupled setting (`CACHE_MIRROR_MAX_AGE_DAYS` drives both) |
| Shared-credential read+write model | Simpler config (one token does everything) | This *is* the CVE-2025-36852 shape the Medium write-up calls "fundamentally a design issue" | Three never-mixed credentials + anonymous RO read path |
| Sub-sharding beyond 1000 assets/release | "Handle any repo size" | Speculative for the low-churn target audience; adds tag-shape complexity everywhere | The 1000-asset cap skips-and-warns (ROBUST-05); `cache-mirror-YYYYMM-N` documented as the future path only if a repo exceeds it |

## Feature Dependencies

```
[Nx HTTP contract + status semantics]
    |-- requires --> [bearer auth + hash validation]
    '-- requires --> [best-effort read degradation]

[RW-in-CI / RO-local capability]
    '-- requires --> [runtime-context backend selection]
            '-- requires --> [Nx HTTP contract]

[pull_request + release RW]
    |-- requires --> [CREEP write-trust gate]
    '-- requires --> [GitHub server-side read-only token (2026-06-26)]   # backstop

[Age-based retention]
    '-- enhances --> [Release-asset mirror]        # recency/LRU is OUT of v0.0.1 (mutable manifest)

[Consumer adoption docs]
    '-- enhances --> [all of the above]  # docs surface the config, they do not gate it

[Local read-write mode]  --conflicts--> [CREEP safety]   # why it is an anti-feature
```

### Dependency Notes

- **RW/RO capability requires runtime-context selection:** the differentiator (no mode flag) is *how* this project delivers the table-stakes RW/RO capability. They ship together.
- **`pull_request`/`release` RW requires the server-side RO token as a backstop:** the in-code gate alone is fork-spoofable; safe only because GitHub issues RO tokens to genuinely untrusted default-branch-context triggers. This capability is only correct *given* the 2026-06-26 change, and is host-detected fail-closed on GHES.
- **Retention is age-based in v0.0.1:** age is the mandatory floor; recency/LRU is out of scope (mutable manifest is security-negative and the `download_count` signal is unverified).
- **Local RW conflicts with CREEP safety:** documented as an anti-feature for this reason.

## v0.0.1 Capability Set (ship set)

The v0.0.1 ship set is delivered as vertical slices; the slice/phase breakdown is owned by
`.planning/ROADMAP.md`. Grouped here by feature category, not by phase.

### Ship in v0.0.1

- [ ] **Nx-contract HTTP server + best-effort reads + status semantics** - the walking skeleton; the interface Nx speaks (SRV-01..05, TEST-07).
- [ ] **Default Actions-cache CI-RW backend + context-derived RW/RO + conservative write gate** - the first real GitHub cache, dogfooded (TEST-01, TRUST-03, TRUST-05, ROBUST-03/04).
- [ ] **Cross-context read via GitHub Releases + authenticated private-repo local read + OS-namespacing** - a developer on any OS reads CI-produced cache locally; never a wrong-OS artifact (FOUND-02, CORR-01, TEST-05).
- [ ] **Publish/sync + age-based retention + fail-loud observability** - mirror CI entries to Releases, prune by age safely, degrade gracefully at the caps (TRUST-02/07, RETAIN-01/03, ROBUST-01/02/05, OBS-01).
- [ ] **Trust-widening (`pull_request` + `release`) + PPE-hygiene gate + server-produced-key filter** - host-detected fail-closed widening; adopter-facing hygiene gate (TRUST-01/04/06/08).
- [ ] **Distribution (npm + JS Action) + adoption docs + governance** - external OSS/low-churn projects adopt without reading source (DOCS-01..06, GOV-01..03).

### Deferred / a later milestone (triggered)

- [ ] **Recency/LRU retention** - OUT OF SCOPE for v0.0.1 (mutable manifest is security-negative; `download_count` increment on octet-stream reads is unverified). Possible later-milestone spike gated on the signal proving reliable; native Actions-cache LRU covers the CI tier meanwhile.
- [ ] **GHCR/OCI as an additional synced store** - later-milestone revisit trigger (GHCR-01), re-evaluated when the Docker container form and cosign provenance (PROV-01) graduate together.
- [ ] **Sub-sharding beyond 1000 assets/release** - only when a real repo exceeds it (low-churn audience will not); the cap skips-and-warns until then.

### Build-from-the-start (not deferred, called out to avoid a retrofit)

- [ ] **Octokit structural error discrimination** - use `@octokit/rest` `error.status` from day one on publish AND cleanup paths (ROBUST-01). A greenfield build has no `gh` CLI to migrate from; never build a stderr-text-matching path.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Nx-contract server + status semantics + best-effort reads | HIGH | LOW-MED | v0.0.1 |
| Default Actions-cache CI-RW + context-derived RW/RO | HIGH | MED | v0.0.1 |
| Cross-context Releases read + private-repo auth + OS-namespacing | HIGH | MED | v0.0.1 |
| Publish/sync + age-based retention + observability | HIGH | MED-HIGH | v0.0.1 |
| `pull_request` + `release` trust-widening + PPE gate | HIGH | MED | v0.0.1 |
| Distribution + adoption docs + governance | HIGH | MED | v0.0.1 |
| Octokit structural error discrimination | MED | MED | v0.0.1 (build from start) |
| Recency / LRU retention | MED | HIGH | a later milestone (out of scope) |
| GHCR/OCI additional store | LOW | HIGH | a later milestone (trigger) |
| Sub-sharding | LOW | MED | a later milestone (defer) |

## Competitor Feature Analysis

| Feature | `@nx/azure-cache` (1st-party, deprecated) | `nx-remotecache-custom`/`-azure` (community, archived) | Nx Cloud | Our Approach |
|---------|-------------------------------------------|--------------------------------------------------------|----------|--------------|
| RW/RO control | `ciMode` + `localMode` = `read-only`\|`no-cache`; `NX_POWERPACK_CACHE_MODE` | Independent `read` / `write` boolean flags (default true) | Managed, token-scoped | Derived from runtime context - no flag to misconfigure |
| Credentials to read | Azure creds required | Azure creds required | Nx Cloud token required | **None** for anonymous public Release reads; developer's existing GitHub auth for private repos |
| Infra to run | Azure Storage account | Azure/S3/MinIO backend | SaaS (managed) | **None** - GitHub-native |
| Retention/eviction | Delegated to Azure lifecycle rules (cool@30d, delete@90d no-access) - true last-access LRU for free | Delegated to storage lifecycle | Managed multi-tier | Native Actions-cache LRU (CI tier) + age-based cleanup (RO tier); recency LRU out of scope |
| Cache-poisoning stance | Warns "bucket caches vulnerable to poisoning (CVE-2025-36852)", steers to Nx Cloud | Shared-credential model = the CVE shape | Marketed as the secure option | 3-layer defense-in-depth; CI-only writes; anonymous RO reads |
| License / status | Commercial, **deprecated May 2026** | Archived, Nx 20 only | Commercial SaaS | Free, MIT, current |
| `pull_request`/`release` handling | Not addressed in docs | Not addressed | Managed | Explicitly RW-eligible, backstopped by GitHub's RO token, host-detected fail-closed |

Sources: https://21.nx.dev/docs/reference/remote-cache-plugins/azure-cache/overview , https://github.com/NiklasPor/nx-remotecache-azure , https://emilyxiong.medium.com/exploring-of-nx-self-hosted-cache-5bc39bd2ed7f

---

## Capability Mapping (load-bearing detail for requirements)

### RW-vs-RO modes; expected behavior (TRUST-05)

**How the ecosystem expresses it (table stakes):**
- **Nx OpenAPI contract itself** encodes RO at the protocol level: a `PUT` with a read-only token returns **403** ("Access forbidden. e.g. read-only token used to write"); an override of an existing record returns **409** ("Cannot override an existing record"). Source: https://nx.dev/docs/guides/tasks--caching/self-hosted-caching . The port's `PutResult = 'stored'(200) | 'conflict'(409) | 'forbidden'(403)` maps to this exactly - so the *contract* is table stakes to build to.
- **`@nx/azure-cache`** exposes two independent knobs in `nx.json`: `ciMode` and `localMode`, each `read-only` or `no-cache`. Default is read-write; you *downgrade* per environment. Source: https://21.nx.dev/docs/reference/remote-cache-plugins/azure-cache/overview .
- **`nx-remotecache-custom`** (the community framework under `nx-remotecache-azure`) exposes independent `read` / `write` booleans (default `true`). RO = set `write: false`. Source: https://github.com/NiklasPor/nx-remotecache-azure .

**Expected behavior:** RW in CI on trusted events; RO everywhere the writer is not trusted (locally, and on untrusted CI triggers). Nx "only shows warnings when the remote cache is not writable" - a blocked write must be a soft warning + continue, never a hard failure (this mirrors GitHub's own "logs a warning and the job continues without saving").

**This project's differentiated execution:** derive the mode from runtime context (`GITHUB_ACTIONS`, trusted event) instead of a caller-set flag - strictly safer than azure's `ciMode`/`localMode` which a user can set wrong. Build the *derived* behavior as a **named, documented, tested capability** with no caller-facing mode surface (the no-flag safety property is load-bearing). Category: **table-stakes capability, differentiator execution.**

### `pull_request` / `release` trigger coverage + fork-poisoning avoidance (TRUST-01)

**What GitHub's 2026-06-26 change says (verbatim-grounded):** Source https://github.blog/changelog/2026-06-26-read-only-actions-cache-for-untrusted-triggers/

- GitHub now issues a **read-only cache token** when **both** are true: (1) the triggering event is **untrusted** (someone other than a repo collaborator can trigger it), **and** (2) the workflow context + cache scope come from the **shared default-branch SHA**.
- Triggers that **keep full read-write** caching: `push`, `schedule`, `workflow_dispatch`, `repository_dispatch`, `delete`, `registry_package`, `page_build`. **Additionally, any trigger that uses a non-default-branch scope - explicitly `pull_request` and `release` - keeps read-write caching.**
- The dangerous cases now downgraded to RO: `pull_request_target`, `issue_comment`, and fork-PR `workflow_run` cascades - because those run untrusted-influenced code *in the default-branch cache scope*, so a trusted later `push`/`schedule` would restore poisoned entries.
- When a write is restricted, `actions/cache` **logs a warning and the job continues without saving; restores are unaffected.** To keep caching in an untrusted workflow, use a **separate `push`-triggered workflow to do the saves**, and let the untrusted workflow restore-only.

**Why `pull_request`/`release` are safe to write-trust (the fork-poisoning avoidance):**
1. **Scope isolation.** `pull_request` (including fork PRs) writes to its *own* ref/branch cache scope, not the default-branch scope. Trusted workflows (`push`/`schedule` on the default branch) only restore from the default-branch scope, so a fork's PR-scoped cache entry is **never restored by a trusted workflow** - it cannot poison the trusted cache. That is precisely why GitHub keeps RW for these.
2. **Server-side backstop.** For the genuinely dangerous default-branch-context untrusted triggers, GitHub *itself* issues a RO token - so even if the in-code gate (which reads fork-spoofable env) were tricked, the write is refused server-side. The in-code gate stays defense-in-depth.
3. **Publish-from-trusted-only.** The Release-asset mirror is published exclusively on **trusted default-branch pushes**. Fork/PR cache entries live only in the Actions cache PR-scope and are never mirrored - the mirror has no fork-write path at all.

**Correct behavior for this project:** the write-trust allowlist enables `pull_request` and `release` **only where GitHub's guard exists**, detected from `GITHUB_SERVER_URL` (`github.com`/`*.ghe.com` -> ON; every GHES host -> OFF, fail-closed), relying on GitHub's RO token for untrusted fork variants. **Caveat:** on older GHES the server-side backstop is absent and the fork-spoofable gate is the only control - docs state github.com-only + a GHES version-floor note; the widened set fails closed on GHES. Category: **table-stakes correctness (post-2026-06-26), delivered as a safe, host-gated differentiator.**

### Auto-cleanup: age-based (v0.0.1) vs recency/LRU (OUT OF SCOPE)

**Age-based cleanup is the v0.0.1 floor** (`CACHE_MIRROR_MAX_AGE_DAYS`, one coupled setting; RETAIN-01/03). **Recency/LRU on the mirror is OUT OF SCOPE for v0.0.1** - it is genuinely hard on this substrate, which is worth recording:

**The constraint:** GitHub's **Release Asset API exposes no last-accessed signal** - only `created_at`/`updated_at` and a cumulative `download_count`. So true last-access LRU is not directly available on the mirror. (Contrast: Azure/S3 backends get real last-access LRU *for free* from cloud lifecycle rules, e.g. azure "delete after 90 days without access" - which is why the community caches never had to build it.)

**Why the approximations do not clear the v0.0.1 bar:**

| Approach | How | Why not in v0.0.1 |
|----------|-----|---------------|
| Harvest `last_accessed_at` at publish into a manifest | The Actions Cache REST API (`GET /repos/{owner}/{repo}/actions/caches`) *does* return `last_accessed_at`, `created_at`, `size_in_bytes` (default sort by last-access). Source: https://docs.github.com/en/rest/actions/cache . Persist it into a manifest asset; cleanup evicts by it. | A manifest is **mutable shared retention state (security-negative)** and needs a single-writer RMW job; the CI-side signal misses local reads. Out of scope. |
| Piggyback the Actions cache's native LRU (free, coarse) | The mirror only re-uploads entries **still present** in the Actions cache; GitHub evicts that cache by true LRU + 7-day-disuse at 10 GB. So an unused entry stops being re-mirrored and ages out by date. | **This is the v0.0.1 behavior** - it is why age-based cleanup is sufficient. Document it; build nothing extra. |
| Access manifest + hit counters (CI-side) | The CI backend records hits to a manifest. | Partial - CI reads only; local reads are anonymous/RO and invisible. Skewed. |
| Touch-on-read (bump timestamp per GET) | Reader rewrites a timestamp on every hit. | Anti-feature. Local readers are anonymous + RO; would need creds and blow the 60 req/hr limit. Rejected. |

**v0.0.1 knobs:** `CACHE_MIRROR_MAX_AGE_DAYS` as the mandatory age floor. No second retention knob (windows drift). Category: **age-based = table stakes (v0.0.1); recency/LRU = deferred to a later-milestone spike.**

### Consumer adoption ergonomics (DOCS-01..06)

**What the ecosystem shows makes adoption easy (bar set by `@nx/azure-cache`):** three steps - `nx add <plugin>`, authenticate, set two config values in `nx.json`. Anything requiring source-reading loses adopters (the Nx self-hosted docs themselves say "implementation is up to you," which is exactly the friction this project removes by being turnkey).

**What makes *this* project easy to adopt (what the docs must cover):**
- **One CI consumption step** (`uses: <owner>/github-cache/...` as a JS Action run as a background step) + a copy-paste workflow snippet, including the isolated-permissions publish job and the scheduled cleanup workflow.
- **Zero credentials for anonymous local reads** - the headline ergonomic win; document that a fresh clone gets cache reads with nothing but `GITHUB_REPOSITORY` set (and `GH_TOKEN` optional to lift the rate limit / read private repos).
- **Minimal config surface with sensible defaults** - one retention knob, default port, default body cap; document each `resolve*` knob and the Nx client vars (`NX_SELF_HOSTED_REMOTE_CACHE_SERVER`/`_ACCESS_TOKEN`) in a single table.
- **Explicit trust/security section** - which events write, the CREEP posture, the github.com-vs-GHES version floor for the RO-token backstop, and the shared-persistent-runner warning.
- **Copy-paste over prose** - a working `.github/workflows/*.yml` example beats paragraphs.

Category: **table stakes for adoption** (the value prop is wasted if external projects cannot wire it in without reading source).

## Sources

- Nx self-hosted remote cache (OpenAPI spec + usage notes, fetched in full): https://nx.dev/docs/guides/tasks--caching/self-hosted-caching - HIGH
- GitHub "Read-only Actions cache for untrusted triggers" changelog, 2026-06-26 (fetched in full): https://github.blog/changelog/2026-06-26-read-only-actions-cache-for-untrusted-triggers/ - HIGH
- GitHub Actions cache REST API (fields: `last_accessed_at`/`created_at`/`size_in_bytes`, default sort): https://docs.github.com/en/rest/actions/cache - HIGH
- `@nx/azure-cache` overview (`ciMode`/`localMode`, setup, CREEP warning): https://21.nx.dev/docs/reference/remote-cache-plugins/azure-cache/overview - HIGH
- `nx-remotecache-azure` / `nx-remotecache-custom` (independent `read`/`write` flags, Azure lifecycle retention): https://github.com/NiklasPor/nx-remotecache-azure - HIGH
- "Exploring Nx self-hosted cache" community write-up (ecosystem history, deprecation, CVE framing): https://emilyxiong.medium.com/exploring-of-nx-self-hosted-cache-5bc39bd2ed7f - MEDIUM
- CVE-2025-36852 (CREEP) background: https://nx.dev/blog/cve-2025-36852-critical-cache-poisoning-vulnerability-creep - HIGH
- Locked foundation: `.planning/ARCHITECTURE-DECISION.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, FOUND-01 reader spike `.planning/spikes/001-005`
- `npmx.dev/package/@nx/azure-cache` - config surface covered via the 21.nx.dev overview instead (page did not render through the fetch chain; not load-bearing).

---
*Feature research for: GitHub-native self-hosted Nx remote cache*
*Researched: 2026-07-17. Greenfield reframe: 2026-07-18 (rebased from a subsequent-milestone gap-closure framing onto a build-from-scratch v0.0.1 capability set; domain findings, competitor facts, sources, and confidence ratings unchanged; recency/LRU moved to OUT OF SCOPE per the locked requirements).*
