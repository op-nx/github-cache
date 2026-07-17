# Feature Research

**Domain:** Self-hosted Nx remote cache backed by GitHub / Git primitives (Actions cache + Release assets)
**Researched:** 2026-07-17
**Confidence:** HIGH (primary sources fetched in full: Nx self-hosted OpenAPI spec, GitHub read-only-cache changelog, GitHub Actions cache REST API, @nx/azure-cache + nx-remotecache-custom config surfaces)

> Brownfield note: the core cache server already exists (see `.planning/codebase/ARCHITECTURE.md`). This file maps the *feature landscape* of Nx remote caches so the four Active requirements can be categorized, not re-invent the shipped system. The four Active requirements (RW/RO modes, `pull_request`/`release`, LRU, consumer docs) are mapped explicitly in the last section.

## Feature Landscape

### Table Stakes (Users Expect These)

Missing any of these = "this isn't a working Nx remote cache."

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Nx self-hosted HTTP contract (`GET`/`PUT /v1/cache/{hash}`, bearer auth) | It is *the* interface Nx speaks; anything else Nx cannot call | LOW | Spec is tiny and stable: `NX_SELF_HOSTED_REMOTE_CACHE_SERVER` + `_ACCESS_TOKEN`. Source: https://nx.dev/docs/guides/tasks--caching/self-hosted-caching . Already shipped. |
| Correct status semantics: 200 / 401 / 403 / 404 / 409 | The OpenAPI spec bakes them in; Nx branches on them | LOW | Spec text: 403 = "read-only token used to write", 409 = "Cannot override an existing record", 404 = miss. Maps 1:1 to the shipped `PutResult = 'stored' \| 'conflict' \| 'forbidden'`. |
| Best-effort reads (fault degrades to MISS, never breaks the build) | Nx treats remote cache as advisory; a 5xx must not fail a task | LOW | Already shipped (GET faults -> 404). Contract-level expectation, not optional. |
| Read-write in CI, read-only downgrade available | Every cache exposes this: `@nx/azure-cache` `ciMode`/`localMode` (`read-only`/`no-cache`), `nx-remotecache-custom` independent `read`/`write` flags | LOW-MED | Active req #1/#2. Existing but *derived* (context, not flag) and under-documented/tested. See mapping below. |
| Cache-poisoning safety (CREEP / CVE-2025-36852) | Post-CVE, "do not let untrusted triggers write" is baseline; Nx itself steers users to Nx Cloud over bucket caches for exactly this | MED | Existing in-code trust gate + GitHub's 2026-06-26 server-side read-only token. Source: https://github.blog/changelog/2026-06-26-read-only-actions-cache-for-untrusted-triggers/ , https://nx.dev/blog/cve-2025-36852-critical-cache-poisoning-vulnerability-creep |
| Bounded retention / eviction | Storage cannot grow forever; every backend has *something* | LOW-MED | Azure/S3 delegate to cloud lifecycle rules; Actions cache has native 10 GB LRU + 7-day-disuse eviction; this project has date-based `CACHE_MIRROR_MAX_AGE_DAYS`. Age-based is the mandatory floor. |
| Cross-machine / cross-OS hash parity | A hit computed on machine A must restore on machine B, or the cache never hits | MED | Already shipped (`.gitattributes eol=lf`, OS-discriminated integration hash, per-OS publish-mirror matrix). Silent-failure prone; load-bearing. |
| Copy-paste setup + minimal config surface | Adoption dies if wiring it up needs source-reading | LOW-MED | Active req #5. `@nx/azure-cache` sets the bar: `nx add`, auth, set container+account in `nx.json`. See mapping below. |

### Differentiators (Competitive Advantage)

Where this project wins versus `@nx/azure-cache`, `@nx/s3-cache`, `nx-remotecache-*`, and Nx Cloud. Aligned with PROJECT.md Core Value ("correct + safe caching on GitHub infra with nothing extra to host").

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Zero extra infrastructure (GitHub-native storage) | No S3/Azure account, no bucket, no hosting, no bill. Every competing self-hosted cache needs a cloud account + credentials | (shipped) | THE differentiator. Actions cache (RW/CI) + Release-asset mirror (RO/local). |
| Anonymous read-only local mirror (public Release assets) | External contributors / fresh clones get cache *reads* with **zero credentials**; azure/s3/custom all require creds even to read | (shipped) | Uniquely fits open-source / low-churn repos. Anonymous 60 req/hr, `GH_TOKEN` lifts to 5000/hr. |
| Runtime-context backend selection (no mode flag) | Stronger safety than azure's `localMode`/`ciMode` which a user *can* set wrong; here local is RO-only by construction | (shipped) | "No caller can misconfigure RW vs RO." Differentiator over the flag-based competitors. |
| Free + open-source (MIT) | `@nx/azure-cache` is commercial-licensed and **deprecated May 2026**; community `nx-remotecache-*` are archived / Nx-20-only. The ecosystem left a hole | (shipped) | Source: https://emilyxiong.medium.com/exploring-of-nx-self-hosted-cache-5bc39bd2ed7f . Being free+MIT is a real, current gap-filler. |
| CREEP defense-in-depth (3 layers) | In-code trust gate + GitHub server-side RO token + workflow permission isolation | (shipped) | More layered than "shared credentials read+write" model the Medium article flags as the CVE root cause. |
| Safe `pull_request` + `release` read-write | Matches GitHub's own cache-scoping model; unblocks PR-branch caching without poisoning the trusted default-branch cache | MED | Active req #2. See mapping. |
| LRU approximation on a no-last-access store | Releases expose no last-accessed field; harvesting `last_accessed_at` from the Actions cache API into a manifest recovers recency-based eviction that Releases alone cannot | MED-HIGH | Active req #3. Differentiator precisely because it is hard on this substrate. See mapping. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Local read-write mode | "Let my laptop populate the shared cache" | Local writes = an untrusted, unauditable write path; reopens CREEP; local env is fork-spoofable | CI-only writes; local stays RO by construction (already Out of Scope in PROJECT.md) |
| Hosted / managed cache service | "Give me an endpoint I don't run" | Defeats the entire zero-infra value prop; that market is Nx Cloud's | GitHub-native storage only |
| Nx custom task runner API | Old tutorials still show `tasksRunnerOptions` | Deprecated in Nx 20; removed path | Target only the self-hosted-cache HTTP contract |
| Streaming large bodies | "What if a task output is huge?" | Buffered-with-cap is simpler and matches the ~2 GiB Release-asset ceiling anyway; >2 GB outputs signal a caching-strategy problem upstream | Fully buffered, 2 GB cap; revisit only on real demand |
| True touch-on-read LRU on the mirror | "Bump last-accessed every time an entry is served" | Local mirror readers are **anonymous + read-only** and cannot write back; per-read writes would need creds and would blow the 60 req/hr anonymous limit | Approximate LRU from `last_accessed_at` harvested CI-side at publish time (see mapping) |
| A second retention knob | "Separate read window from cleanup window" | Two knobs drift: retained assets become unreadable, or expired assets un-cleanable | One coupled setting (`CACHE_MIRROR_MAX_AGE_DAYS` drives both) - already load-bearing |
| Shared-credential read+write model | Simpler config (one token does everything) | This *is* the CVE-2025-36852 shape the Medium write-up calls "fundamentally a design issue" | Three never-mixed credentials + anonymous RO read path |
| Sub-sharding beyond 1000 assets/release | "Handle any repo size" | Speculative for the low-churn target audience; adds tag-shape complexity everywhere | Defer; `cache-mirror-YYYYMM-N` documented as the future path only if a repo exceeds it |

## Feature Dependencies

```
[Nx HTTP contract + status semantics]
    |-- requires --> [bearer auth + hash validation]
    '-- requires --> [best-effort read degradation]

[RW-in-CI / RO-local capability]
    '-- requires --> [runtime-context backend selection]
            '-- requires --> [Nx HTTP contract]

[pull_request + release RW]
    |-- requires --> [CREEP trust gate (isWriteTrusted)]
    '-- requires --> [GitHub server-side read-only token (2026-06-26)]   # backstop

[LRU approximation]
    |-- requires --> [date-based retention]        # LRU is additive, never replaces the age floor
    |-- requires --> [single-writer cleanup workflow]  # read-modify-write home for the manifest
    '-- enhances --> [Release-asset mirror]

[Consumer adoption docs]
    '-- enhances --> [all of the above]  # docs surface the config, they do not gate it

[Local read-write mode]  --conflicts--> [CREEP safety]   # why it is an anti-feature
```

### Dependency Notes

- **RW/RO capability requires runtime-context selection:** the differentiator (no mode flag) is *how* this project delivers the table-stakes RW/RO capability. They ship together.
- **`pull_request`/`release` RW requires the server-side RO token as a backstop:** the in-code gate alone is fork-spoofable; safe only because GitHub now issues RO tokens to genuinely untrusted default-branch-context triggers. Order matters: this requirement is only correct *given* the 2026-06-26 change.
- **LRU requires (never replaces) date-based retention:** age is the mandatory floor; LRU is an optional recency refinement layered into the same single-writer cleanup workflow. They must resolve from the same coupled window.
- **Local RW conflicts with CREEP safety:** documented as an anti-feature for this reason.

## MVP Definition (this milestone's ship set)

Reframed for brownfield: "MVP" = the Active-requirement set that closes the gap between "shipped + dogfooded" and "consumable + trustworthy by outside projects."

### Ship in this milestone (v-next core)

- [ ] **`pull_request` + `release` read-write support** - the ecosystem-correct behavior post-2026-06-26; unblocks the most common CI trigger. Highest external-value item.
- [ ] **First-class, documented, tested RW-in-CI / RO-local capability** - turn a derived behavior into a named, spec'd, tested contract.
- [ ] **Consumer adoption docs** - external OSS/low-churn projects cannot adopt what they must read source to configure.
- [ ] **Test coverage for the untested paths** - `gh` I/O orchestration, `selectBackend`, cleanup wrapper, `withHashLock`. Trust prerequisite for external adoption; these are exactly the silent-failure surfaces (cross-OS gap history).

### Add after validation (v-next.x)

- [ ] **Optional LRU retention** - trigger: a real consumer reports hot entries being aged out, or a repo where the 30-day window causes measurable rebuild cost. Manifest + `last_accessed_at` harvest. Additive to age-based.
- [ ] **Octokit structural error discrimination** (replace `gh` stderr text-matching) - trigger: a `gh` version reword breaks a consumer on an uncontrolled runner; robustness, not new capability.

### Future consideration (defer)

- [ ] **Alternative GitHub/Git primitives** - only if one clearly beats Actions cache + Releases for part of the pipeline.
- [ ] **Sub-sharding beyond 1000 assets** - only when a real repo exceeds it (low-churn audience will not).

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| `pull_request` + `release` RW | HIGH | MED | P1 |
| First-class RW/RO capability (documented + tested) | HIGH | LOW-MED | P1 |
| Consumer adoption docs | HIGH | LOW-MED | P1 |
| Test coverage for `gh` I/O / `selectBackend` / cleanup / lock | HIGH | MED | P1 |
| Optional LRU retention | MED | HIGH | P2 |
| Octokit structural error discrimination | MED | MED | P2 |
| Alternative primitives evaluation | LOW | MED | P3 |
| Sub-sharding | LOW | MED | P3 |

**Priority key:** P1 = ship this milestone; P2 = add when triggered; P3 = defer until demand.

## Competitor Feature Analysis

| Feature | `@nx/azure-cache` (1st-party, deprecated) | `nx-remotecache-custom`/`-azure` (community, archived) | Nx Cloud | Our Approach |
|---------|-------------------------------------------|--------------------------------------------------------|----------|--------------|
| RW/RO control | `ciMode` + `localMode` = `read-only`\|`no-cache`; `NX_POWERPACK_CACHE_MODE` | Independent `read` / `write` boolean flags (default true) | Managed, token-scoped | Derived from runtime context - no flag to misconfigure |
| Credentials to read | Azure creds required | Azure creds required | Nx Cloud token required | **None** (anonymous public Release mirror) locally |
| Infra to run | Azure Storage account | Azure/S3/MinIO backend | SaaS (managed) | **None** - GitHub-native |
| Retention/eviction | Delegated to Azure lifecycle rules (cool@30d, delete@90d no-access) - true last-access LRU for free | Delegated to storage lifecycle | Managed multi-tier | Date-based (mandatory) + LRU approximation via harvested `last_accessed_at` |
| Cache-poisoning stance | Warns "bucket caches vulnerable to poisoning (CVE-2025-36852)", steers to Nx Cloud | Shared-credential model = the CVE shape | Marketed as the secure option | 3-layer defense-in-depth; CI-only writes; anonymous RO reads |
| License / status | Commercial, **deprecated May 2026** | Archived, Nx 20 only | Commercial SaaS | Free, MIT, current |
| `pull_request`/`release` handling | Not addressed in docs | Not addressed | Managed | Explicitly RW-eligible, backstopped by GitHub's RO token |

Sources: https://21.nx.dev/docs/reference/remote-cache-plugins/azure-cache/overview , https://github.com/NiklasPor/nx-remotecache-azure , https://emilyxiong.medium.com/exploring-of-nx-self-hosted-cache-5bc39bd2ed7f

---

## Active Requirement Mapping (load-bearing detail for requirements definition)

### Active #1/#2 - Read-write vs read-only modes; expected behavior

**How the ecosystem expresses it (table stakes):**
- **Nx OpenAPI contract itself** encodes RO at the protocol level: a `PUT` with a read-only token returns **403** ("Access forbidden. e.g. read-only token used to write"); an override of an existing record returns **409** ("Cannot override an existing record"). Source: https://nx.dev/docs/guides/tasks--caching/self-hosted-caching . The shipped `PutResult = 'stored'(200) | 'conflict'(409) | 'forbidden'(403)` already matches this exactly - so the *contract* is table stakes and done.
- **`@nx/azure-cache`** exposes two independent knobs in `nx.json`: `ciMode` and `localMode`, each `read-only` or `no-cache`. Default is read-write; you *downgrade* per environment. Source: https://21.nx.dev/docs/reference/remote-cache-plugins/azure-cache/overview .
- **`nx-remotecache-custom`** (the community framework under `nx-remotecache-azure`) exposes independent `read` / `write` booleans (default `true`). RO = set `write: false`. Source: https://github.com/NiklasPor/nx-remotecache-azure .

**Expected behavior:** RW in CI on trusted events; RO everywhere the writer is not trusted (locally, and on untrusted CI triggers). Nx "only shows warnings when the remote cache is not writable" - i.e. a blocked write must be a soft warning + continue, never a hard failure (this mirrors GitHub's own "logs a warning and the job continues without saving").

**This project's differentiated execution:** derive the mode from runtime context (`GITHUB_ACTIONS`, trusted event) instead of a caller-set flag - strictly safer than azure's `ciMode`/`localMode` which a user can set wrong. Active work is to make the *derived* behavior a **named, documented, tested capability** (today it is implicit and under-tested). Category: **table-stakes capability, differentiator execution.**

### Active #2 - `pull_request` / `release` trigger coverage + fork-poisoning avoidance

**What GitHub's 2026-06-26 change says (verbatim-grounded):** Source https://github.blog/changelog/2026-06-26-read-only-actions-cache-for-untrusted-triggers/

- GitHub now issues a **read-only cache token** when **both** are true: (1) the triggering event is **untrusted** (someone other than a repo collaborator can trigger it), **and** (2) the workflow context + cache scope come from the **shared default-branch SHA**.
- Triggers that **keep full read-write** caching: `push`, `schedule`, `workflow_dispatch`, `repository_dispatch`, `delete`, `registry_package`, `page_build`. **Additionally, any trigger that uses a non-default-branch scope - explicitly `pull_request` and `release` - keeps read-write caching.**
- The dangerous cases now downgraded to RO: `pull_request_target`, `issue_comment`, and fork-PR `workflow_run` cascades - because those run untrusted-influenced code *in the default-branch cache scope*, so a trusted later `push`/`schedule` would restore poisoned entries.
- When a write is restricted, `actions/cache` **logs a warning and the job continues without saving; restores are unaffected.** To keep caching in an untrusted workflow, use a **separate `push`-triggered workflow to do the saves**, and let the untrusted workflow restore-only.

**Why `pull_request`/`release` are safe to add (the fork-poisoning avoidance):**
1. **Scope isolation.** `pull_request` (including fork PRs) writes to its *own* ref/branch cache scope, not the default-branch scope. Trusted workflows (`push`/`schedule` on the default branch) only restore from the default-branch scope, so a fork's PR-scoped cache entry is **never restored by a trusted workflow** - it cannot poison the trusted cache. That is precisely why GitHub keeps RW for these.
2. **Server-side backstop.** For the genuinely dangerous default-branch-context untrusted triggers, GitHub *itself* now issues a RO token - so even if this project's in-code gate (which reads fork-spoofable env) were tricked, the write is refused server-side. The in-code gate stays as defense-in-depth.
3. **Mirror is publish-from-trusted-only.** The Release-asset mirror is published exclusively by the `publish-mirror` job on **trusted default-branch pushes**. Fork/PR cache entries live only in the Actions cache PR-scope and are never mirrored - the mirror has no fork-write path at all.

**Expected/correct behavior for this project:** add `pull_request` and `release` to the write-trusted event set (resolving the "why not pull_request?" open question in PROJECT.md), relying on GitHub's RO token for untrusted fork variants. **Caveat to flag:** this is only correct on github.com / GHEC (and GHES versions that ship the 2026-06-26 enforcement); on older GHES the server-side backstop is absent and the fork-spoofable gate is the only control - the docs must state a version floor. Category: **table-stakes correctness (post-2026-06-26), delivered as a safe differentiator.**

### Active #3 - Auto-cleanup: date/age-based (mandatory) vs LRU (optional)

**The constraint:** GitHub's **Release Asset API exposes no last-accessed signal** - only `created_at`/`updated_at` on assets. So true last-access LRU is not directly available on the mirror. (Contrast: Azure/S3 backends get real last-access LRU *for free* from cloud lifecycle rules, e.g. azure "delete after 90 days without access" - which is why the community caches never had to build it.)

**The key enabler (verified HIGH confidence):** the **Actions Cache REST API** (`GET /repos/{owner}/{repo}/actions/caches`) *does* return `last_accessed_at`, `created_at`, and `size_in_bytes` per entry, and `last_accessed_at` is the **default sort**. Source: https://docs.github.com/en/rest/actions/cache . `publish-mirror` already lists Actions-cache keys via `gh api`, so the recency signal is available *at publish time* even though the mirror itself lacks it.

**LRU-approximation approaches, ranked for this substrate:**

| Approach | How | Fit here |
|----------|-----|----------|
| **Harvest `last_accessed_at` at publish (recommended)** | During `publish-mirror`, read each entry's `last_accessed_at` from the Actions cache listing and persist it into a **manifest asset** (JSON) per shard. Cleanup evicts by manifest `last_accessed_at` instead of asset `created_at`. | **Best.** Uses data already fetched; single-writer cleanup workflow is the natural read-modify-write home (per the code comment at `publish-mirror.ts:378`). No reader writes needed. |
| **Piggyback the Actions cache's native LRU (free, coarse)** | The mirror only ever re-uploads entries **still present** in the Actions cache; GitHub already evicts the Actions cache by true LRU + 7-day-disuse at the 10 GB cap. So an unused entry falls out of the Actions cache -> stops being re-mirrored -> ages out of the mirror by date. | **Already partly in effect.** Worth documenting as the default "good enough" recency behavior; the manifest only refines it. |
| **Access manifest + hit counters (CI-side)** | The CI (RW) actions-cache backend records hits to a manifest as it serves them. | Partial - captures only CI reads; **local reads are anonymous/RO and invisible.** Skewed signal; not worth it alone. |
| **Touch-on-read (bump timestamp per GET)** | Reader rewrites a timestamp on every hit. | **Anti-feature.** Local readers are anonymous + RO; would need creds and blow the 60 req/hr limit. Rejected. |

**Expected knobs:** keep `CACHE_MIRROR_MAX_AGE_DAYS` as the **mandatory age floor** (never removed). LRU is **additive and optional**: an optional size/count cap (e.g. `CACHE_MIRROR_MAX_ENTRIES` or `..._MAX_TOTAL_BYTES`) that, when exceeded, evicts the least-recently-accessed entries *by the harvested `last_accessed_at`* - within, never beyond, the age window. Follow the existing `resolve*` knob contract (invalid-warns-and-defaults; unset is silent). Do **not** introduce a knob that decouples the read window from the retention window. Category: **age-based = table stakes (shipped); LRU = optional differentiator.**

### Active #5 - Consumer adoption ergonomics

**What the ecosystem shows makes adoption easy (bar set by `@nx/azure-cache`):** three steps - `nx add <plugin>`, authenticate, set two config values in `nx.json`. Anything requiring source-reading loses adopters (the Nx self-hosted docs themselves say "implementation is up to you," which is exactly the friction this project removes by being turnkey).

**What makes *this* project easy to adopt (and what the docs must cover):**
- **One `uses:` step for CI** (`uses: <owner>/github-cache/start-cache-server`) + a copy-paste workflow snippet, including the isolated-permissions `publish-mirror` job and the scheduled cleanup workflow.
- **Zero credentials for local reads** - the headline ergonomic win; document that a fresh clone gets cache reads with nothing but `GITHUB_REPOSITORY` set (and `GH_TOKEN` optional to lift the rate limit).
- **Minimal config surface with sensible defaults** - one retention knob, default port, default body cap; document each `resolve*` knob and its default in a single table.
- **Explicit trust/security section** - which events write, the CREEP posture, the github.com-vs-GHES version floor for the RO-token backstop, and the shared-persistent-runner warning.
- **Copy-paste over prose** - a working `.github/workflows/*.yml` example beats paragraphs.

Category: **table stakes for adoption** (the value prop is wasted if external projects cannot wire it in without reading source - the stated purpose in PROJECT.md).

## Sources

- Nx self-hosted remote cache (OpenAPI spec + usage notes, fetched in full): https://nx.dev/docs/guides/tasks--caching/self-hosted-caching - HIGH
- GitHub "Read-only Actions cache for untrusted triggers" changelog, 2026-06-26 (fetched in full): https://github.blog/changelog/2026-06-26-read-only-actions-cache-for-untrusted-triggers/ - HIGH
- GitHub Actions cache REST API (fields: `last_accessed_at`/`created_at`/`size_in_bytes`, default sort): https://docs.github.com/en/rest/actions/cache - HIGH
- `@nx/azure-cache` overview (`ciMode`/`localMode`, setup, CREEP warning): https://21.nx.dev/docs/reference/remote-cache-plugins/azure-cache/overview - HIGH
- `nx-remotecache-azure` / `nx-remotecache-custom` (independent `read`/`write` flags, Azure lifecycle retention): https://github.com/NiklasPor/nx-remotecache-azure - HIGH
- "Exploring Nx self-hosted cache" community write-up (ecosystem history, deprecation, CVE framing): https://emilyxiong.medium.com/exploring-of-nx-self-hosted-cache-5bc39bd2ed7f - MEDIUM
- CVE-2025-36852 (CREEP) background: https://nx.dev/blog/cve-2025-36852-critical-cache-poisoning-vulnerability-creep - HIGH
- Existing implementation: `.planning/codebase/ARCHITECTURE.md`, `.planning/codebase/CONCERNS.md`, `.planning/PROJECT.md`
- `npmx.dev/package/@nx/azure-cache` - config surface covered via the 21.nx.dev overview instead (page did not render through the fetch chain; not load-bearing).

---
*Feature research for: GitHub-native self-hosted Nx remote cache*
*Researched: 2026-07-17*
