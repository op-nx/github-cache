# Pitfalls Research

**Domain:** Self-hosted Nx remote cache backed by GitHub-native primitives (Actions cache + Release-asset mirror)
**Researched:** 2026-07-17
**Confidence:** HIGH (primary sources: CVE-2025-36852 blog, GitHub 2026-06-26 changelog, GitHub Actions caching docs, Nx self-hosted-cache spec; cross-checked against this repo's ARCHITECTURE.md / CONCERNS.md)

This is a SUBSEQUENT (brownfield) milestone. Several silent-failure bugs were already found and fixed here (cross-OS publish-mirror gap; CRLF hash divergence). Those are called out below as **MUST-NOT-REOPEN**, not as new bugs. The new/critical pitfalls are the ones that threaten the **Active** requirements: adding `pull_request`/`release` write semantics, making CI RW/RO mode a tested capability, LRU retention, test coverage, Octokit migration, and adoption docs.

---

## Critical Pitfalls

### Pitfall 1: Re-introducing CREEP by trusting the WRONG trigger set when adding `pull_request`/`release`

**What goes wrong:**
CREEP (CVE-2025-36852, severity 9.4) is a "first-to-cache-wins" race: whichever branch/PR first uploads a build artifact for a given source-file state has *its* version reused everywhere that source state appears, including production. Poisoning happens during the artifact-construction phase, *before* hashing/encryption, so checksums always match and no scanner detects it. The attack needs no direct cache access -- only PR privileges and a workflow that can write into a cache scope a trusted workflow (`push`/`schedule` on `main`) later restores (source: https://nx.dev/blog/cve-2025-36852-critical-cache-poisoning-vulnerability-creep).

The Active requirement is to add `pull_request` and `release` to the write-trust set. The trap is treating "add PR/release events" as "trust anything a fork can trigger." The GitHub 2026-06-26 changelog is explicit about which events are safe and which are not (source: https://github.blog/changelog/2026-06-26-read-only-actions-cache-for-untrusted-triggers/):

- Safe to keep read-write: `push`, `schedule`, `workflow_dispatch`, `repository_dispatch`, `delete`, `registry_package`, `page_build`, and -- crucially -- `pull_request` and `release`, **because they write to a NON-default-branch cache scope**.
- The actual CREEP vector is the events GitHub now forces read-only: `pull_request_target`, `issue_comment`, and fork-PR `workflow_run` cascades. These run in the *shared default-branch-SHA context*, so their writes land in `main`'s cache scope and get restored by trusted `push`/`schedule` runs.

Why `pull_request` is genuinely safe (confirmed in GitHub's own docs, https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching): a `pull_request` cache write is created for the merge ref (`refs/pull/.../merge`), and "workflow runs cannot restore caches created for child branches or sibling branches ... a cache created for the child `feature-b` branch would not be accessible to a workflow run triggered on the parent `main` branch." So a PR-written entry is invisible to `main`'s restores. Poisoning `main` via a plain `pull_request` write is structurally impossible.

**Why it happens:**
The in-code `isWriteTrusted(env)` gate keys off `GITHUB_EVENT_NAME`/`GITHUB_ACTIONS`, which a fork controls in its own workflow file (documented as spoofable-by-design in this repo). A developer widening the trusted set might (a) add `pull_request_target` "because it looks like `pull_request`", or (b) assume the in-code event name is authoritative. The event name is NOT the security boundary -- GitHub's server-side read-only cache token (issued when the event is untrusted AND the scope is the default-branch SHA) is. The in-code gate is defense-in-depth only.

**How to avoid:**
- Add exactly `pull_request` and `release` to `TRUSTED_EVENTS`. Do NOT add `pull_request_target`, `issue_comment`, or `workflow_run`. Put a comment naming the changelog and the non-default-branch-scope reasoning next to the list.
- Keep the two-layer model intact: the load-bearing control is GitHub's server-side token; the in-code gate is belt-and-suspenders. Never remove one because the other exists.
- Add a unit test asserting the exact trusted set and that the dangerous events are refused (this is also the "make RW/RO a tested capability" Active requirement -- fold them together).
- Remember `TRUSTED_EVENTS` exists twice (`src/lib/trust.ts` and `start-cache-server/index.cjs`, dependency-free CJS copy). Any change MUST be mirrored, or the action's start-gate diverges from the server's write-gate.

**Warning signs:**
- A PR (from anyone) produces cache entries that a subsequent `main` build restores -- if this ever happens, the scope isolation has been defeated (e.g. you switched to `pull_request_target`, or you are checking out and re-keying under a default-branch key).
- The trusted-set change has no accompanying test.
- The two `TRUSTED_EVENTS` copies differ.

**Phase to address:** The `pull_request`/`release` trigger-support phase (Active req 1), co-owned with the RW/RO-mode-as-tested-capability phase (Active req 2).

---

### Pitfall 2: The publish-mirror is the cross-trust bridge -- mirroring fork/PR cache into the PUBLIC Release mirror

**What goes wrong:**
This is the project-specific re-poisoning path and the sharpest consequence of widening the trust set. Even though a `pull_request` write is isolated from `main`'s Actions-cache restores (Pitfall 1), the **Release-asset mirror is a different, cross-trust-boundary channel**: `publish-mirror` restores Actions-cache entries and re-publishes them as anonymous, world-readable Release assets that every local `serve` then trusts and restores into a developer's build. If `publish-mirror` ever runs on a `pull_request`/`release` event (or on any non-default-branch ref), a fork-influenced cache entry becomes a poisoned artifact served to every local consumer. The Actions-cache scope isolation does NOT protect the mirror -- the mirror is a manual re-publish that erases the scope boundary.

**Why it happens:**
Widening the *server's* write-trust set (Active req 1) and the *mirror's* publish gate look like the same change, so a developer relaxes both. They are not the same trust boundary: the server writing a PR-scoped cache is safe; the mirror copying that PR-scoped cache to a public asset is a poisoning primitive.

**How to avoid:**
- Keep `resolveTrustedRepo()` in `publish-mirror.ts` STRICT regardless of the server's trust set: it must continue to require the trust gate AND `GITHUB_REF == default branch`. The mirror publishes only default-branch, push/schedule-produced entries -- never PR/release-scoped ones.
- Treat "server may write on event X" and "mirror may publish on event X" as two independent decisions. Document that the mirror's gate is the load-bearing one for local consumers.
- When you add `pull_request`/`release` to the server trust set, add a test asserting `publish-mirror`'s preamble still refuses those events / non-default refs.

**Warning signs:**
- A `cache-mirror-YYYYMM` release gains assets from a workflow run that was triggered by a PR or a release event.
- `publish-mirror` is invoked from a workflow job that runs on `pull_request`.
- `resolveTrustedRepo` is loosened "to match the server."

**Phase to address:** The `pull_request`/`release` trigger-support phase (Active req 1) -- explicitly scope the change to the server write path and assert the mirror preamble is untouched.

---

### Pitfall 3: Assuming GitHub's read-only cache token backstop exists on GHES (missing version floor)

**What goes wrong:**
The 2026-06-26 server-side read-only-token enforcement "ships to github.com and GitHub with Data Residency" (source: https://github.blog/changelog/2026-06-26-read-only-actions-cache-for-untrusted-triggers/). It does not name a GitHub Enterprise Server (GHES) version. On a GHES release that predates the enforcement, there is NO server-side backstop, so the ONLY thing standing between a fork and a poisoned default-branch cache is the in-code gate -- which is spoofable env by design. Documenting `pull_request`/`release` as "safe because GitHub backstops forks" without a GHES version floor silently ships a critical hole to any consumer on old GHES.

**Why it happens:**
The whole "these events are now safe" reasoning is built on a github.com-only guarantee. Adoption docs (an Active requirement) that state the guarantee unconditionally will be read by GHES users as applying to them.

**How to avoid:**
- In the adoption docs and the README, state the read-only-token dependency explicitly and add a GHES version floor (or a plain "on GHES older than <version>, the server-side backstop is absent; the in-code gate is spoofable, so do not enable `pull_request`/`release` writes there").
- Consider gating the widened trust set behind a detectable capability rather than assuming it (e.g. do not extend the trusted events on GHES unless the enforcement version is met).

**Warning signs:**
- Adoption docs describe fork safety with no "github.com only / GHES version >= X" caveat.
- A consumer reports enabling `pull_request` writes on GHES.

**Phase to address:** The adoption-docs phase (Active req 5) and the `pull_request`/`release` phase (Active req 1) jointly.

---

### Pitfall 4: LRU manifest read-modify-write races breaking the single-writer assumption

**What goes wrong:**
The Active LRU requirement needs a manifest with last-access state, because GitHub's Release Asset API exposes no last-accessed signal (age-only today). A manifest is read-modify-write mutable state. The mirror pipeline is NOT single-writer in general: `publish-mirror` runs as a **per-OS matrix (ubuntu + windows) on every trusted push**, and the cleanup is a separate daily scheduled workflow. If the manifest is written by more than one of these (e.g. both matrix legs record access/writes, or a cleanup overlaps a publish), you get lost updates -- a corrupted or stale manifest that either deletes hot entries (LRU defeated) or never deletes anything (unbounded growth).

**Why it happens:**
The existing age-only cleanup is genuinely single-writer (one daily scheduled job). LRU tempts you to record "last access" at read/publish time, which spreads writes across the per-OS matrix and the serve path. "Single-writer" was true for cleanup but was never true for the publish matrix.

**How to avoid:**
- Keep ALL manifest mutation in the ONE daily single-writer cleanup workflow (`mirror-cleanup.yml`), matching where CONCERNS.md already earmarks the manifest home (`publish-mirror.ts` line ~378). Do not have the per-OS publish legs or `serve` write the manifest.
- If access signals must come from elsewhere, have the single writer *derive* them (e.g. from asset download counts if exposed, or from a separate append-only log it alone compacts) rather than multiple writers mutating shared state.
- If concurrent writers are truly unavoidable, use optimistic concurrency (re-fetch + compare-and-set on the manifest asset; retry on mismatch) -- never blind read-modify-write.
- Add a concurrency-focused test (the codebase already flags `withHashLock` promise bookkeeping as under-tested; the manifest needs the same rigor).

**Warning signs:**
- Manifest is uploaded from `publish-mirror.ts` (the per-push, per-OS path) rather than only the cleanup bin.
- Two workflows both hold `contents: write` and touch the same release asset.
- Hot, recently-read entries disappear (lost-update symptom) or the mirror grows without bound (stale manifest).

**Phase to address:** The LRU-retention phase (Active req 3).

---

### Pitfall 5: LRU retention outliving the read-lookback window (retention vs read-window drift)

**What goes wrong:**
Retention is a single coupled setting: `CACHE_MIRROR_MAX_AGE_DAYS` drives BOTH how far back reads walk shards (`shardTagsForWindow` in `release-mirror-backend.ts`) AND the cleanup window, via shared `resolveMaxAgeDays`/`shardTagsForWindow`. LRU introduces a second retention dimension (keep hot-but-old entries). The trap: an LRU-retained entry that is *older than the read window's shard tags* lives in a month-shard the read side never walks. Result is dead storage -- bytes kept forever that no `serve` can ever find. The "fix" of extending the read walk to cover LRU-retained shards blows up API fan-out and pushes anonymous reads toward the 60 req/hr limit.

**Why it happens:**
LRU and the month-shard read walk are designed against different clocks. Age-only cleanup keeps read-window and retention-window identical by construction. Adding "keep hot entries longer" silently decouples them.

**How to avoid:**
- Preserve the "one coupled setting" invariant. Never introduce a second retention env knob (CONCERNS.md and PROJECT.md both mark this as load-bearing).
- Constrain LRU so a retained entry always stays within a shard the read walk covers -- e.g. LRU decides *which entries within the retention window survive a space-pressure prune*, not *whether to keep entries beyond the read window*. LRU as a within-window eviction policy avoids drift entirely.
- If hot entries must survive beyond the window, the mechanism must be "re-stamp/re-home into the current shard" (so the read walk still finds them), not "keep in an out-of-window shard."
- Test: assert every retained asset is resolvable by `shardTagsForWindow(now, maxAgeDays)` -- any retained asset the read walk can't reach is a bug.

**Warning signs:**
- Mirror total size grows steadily despite cleanup running (out-of-window retained assets).
- A hot hash is retained by cleanup but `serve` still MISSes it (it's in a shard the read walk skips).
- Any proposal that adds a second age/retention env var.

**Phase to address:** The LRU-retention phase (Active req 3).

---

### Pitfall 6: Age-only cleanup deleting hot entries (the problem LRU must solve -- solved wrongly)

**What goes wrong:**
Today's cleanup deletes any asset older than `CACHE_MIRROR_MAX_AGE_DAYS` on `created_at` alone, even if it is read on every build (a hot, stable dependency graph node). It is then rebuilt and re-uploaded, wasting CI time and Actions-cache/mirror churn. This is the exact gap the Active LRU requirement targets. The failure-of-the-fix is implementing "LRU" using a signal that does not actually track access -- e.g. `created_at` (age, not access) or `updated_at` (mirror never mutates assets, so it equals created_at). GitHub's Release Asset API has no last-accessed field; asset `download_count` is the closest real access proxy, but it is monotonic (never resets) and coarse.

**Why it happens:**
"LRU" is easy to say and hard to source on the Release API. Contrast with the *Actions* cache, which IS last-access LRU natively ("the cache eviction policy will create space by deleting the caches in order of last access date, from oldest to most recent", https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching) -- so the mirror is the ONLY layer where you must synthesize access data.

**How to avoid:**
- Be explicit that "LRU for the mirror" means "least-recently-*served* by our own `serve`," and that requires the manifest (Pitfall 4) to record reads, OR accepting `download_count` deltas as the access proxy (single writer computes deltas between runs).
- Keep age-based cleanup as the mandatory floor; LRU is additive/optional (PROJECT.md wording: "in addition to the mandatory date-based cleanup"). Never let LRU disable the age ceiling -- unbounded retention is a worse failure than an occasional hot-entry rebuild.
- Prove the win before building it: a hot entry rebuilt every 30 days is cheap; measure whether LRU actually saves anything for the low-churn target audience before adding manifest complexity.

**Warning signs:**
- "LRU" implemented against `created_at`/`updated_at` (neither tracks access).
- No mechanism records reads, yet the design claims least-*recently-used* eviction.
- LRU can retain entries with no age ceiling.

**Phase to address:** The LRU-retention phase (Active req 3). Consider a spike to validate the ROI first.

---

### Pitfall 7: MUST-NOT-REOPEN -- cross-OS hashing and compression traps (already fixed here)

**What goes wrong:**
Three already-fixed silent bugs. Reopening any is a wave of cross-OS cache MISSes with no error:

1. **CRLF hash divergence (RESOLVED).** `.gitattributes` forces `* text=auto eol=lf` so Nx content hashes match across OS checkouts. Deleting/weakening that file silently breaks every cross-OS hit.
2. **`@actions/cache` literal-path version hashing (load-bearing).** `@actions/cache` matches entries by a version hash computed over the *literal* temp-path strings. `cacheArchivePath(hash)` is the single source of truth; save and restore MUST pass byte-identical paths. Any path change (even cosmetic) silently changes the version and every restore MISSes. Per-OS compression is also folded in: windows-11-arm lacks zstd and falls back to gzip, so a Windows entry cannot be restored by a zstd host.
3. **Cross-OS publish-mirror gap (RESOLVED 2026-07-17).** Because the version hash folds in OS temp path + a windows-only salt + the compression method, an ubuntu job can never restore a Windows-saved entry. Fix: `publish-mirror` is a **per-OS matrix** (`ubuntu-24.04-arm` + `windows-11-arm`); each leg mirrors only its own OS's entries. `uploadHash` treats an unrestorable entry as "evicted; skip" with NO error -- so collapsing the matrix back to one OS silently drops the other OS's entries.

**Why it happens:**
All three failure modes are silent (a MISS, not a crash). A well-meaning "simplify the CI matrix" or "clean up .gitattributes" or "tidy the temp path" refactor looks harmless and passes CI (which may not cross-check OS restore).

**How to avoid:**
- Treat `.gitattributes` (`eol=lf`), `cacheArchivePath()` as sole path source, and the per-OS publish-mirror matrix as **load-bearing, comment-locked** invariants. Each already carries a "why" comment -- keep them.
- Never change `cacheArchivePath` or the paths passed to `restoreCache`/`saveCache` without re-verifying an end-to-end restore (the `act` harness / a real CI run). `npm run test:act` is the canary for any `@actions/cache` bump.
- Guard against matrix simplification with a comment and, ideally, a CI assertion that both OS legs run.

**Warning signs:**
- A PR that deletes/edits `.gitattributes`, renames the temp path, or reduces the publish-mirror matrix to one OS.
- A wave of Windows cache MISSes after a runner-image update (zstd added to windows-11-arm invalidates pre-existing gzip entries -- transient, self-heals; know the symptom so it is not misdiagnosed as a regression).

**Phase to address:** Cross-cutting guardrail for EVERY phase that touches CI, hashing, or the temp path. Fold explicit "did not reopen" checks into the test-coverage phase (Active req 4).

---

### Pitfall 8: Treating rate-limit/network faults as authoritative "not found" (best-effort-read correctness)

**What goes wrong:**
Reads are best-effort by contract: a fault must degrade to a 404 MISS so the build continues (never a 5xx that breaks the build). The correctness trap is applying that same "fault == absence" logic where absence is a *decision input*:
- A **cleanup** that lists shard assets, hits a rate-limit/partial-pagination failure mid-list, and then deletes "orphans" not in the (incomplete) list -- deleting live entries based on a false empty/partial listing.
- A **write/conflict** decision that treats a transient listing failure as "entry absent, safe to overwrite."

The architecture already encodes the correct rule ("Only structural/marker-verified 404s mean not found; auth/rate-limit/network errors must propagate, never be treated as absence" -- `publish-mirror.ts`, `release-mirror-backend.ts`). The trap is a new code path forgetting it.

**Why it happens:**
"Best-effort read degrades to MISS" is repeated so often it gets over-applied to non-read paths. On the read path, a false MISS is harmless (extra rebuild). On the cleanup/write path, a false MISS is destructive (deletes live data / overwrites).

**How to avoid:**
- Keep the asymmetry explicit: reads may swallow faults into MISS; cleanup and any delete/overwrite decision must FAIL LOUD on non-404 faults and never infer absence from an error.
- The `gh` -> Octokit migration (Active req 7) directly hardens this: structural `error.status === 404` discrimination replaces stderr text matching, so a reworded `gh` message can no longer turn a real fault into a false "already exists"/"404".
- Test the cleanup path against a mocked partial/failed listing and assert it does NOT delete.

**Warning signs:**
- Mirror assets disappear after a cleanup run that logged rate-limit warnings.
- Any code path infers "not present" from a caught exception rather than a verified 404.
- `gh` stderr sentinels (`/already exists/i`, `HTTP 404`) drift because a `gh` version reworded them.

**Phase to address:** The Octokit-migration phase (Active req 7) and the test-coverage phase (Active req 4) -- especially the untested `publish-mirror` gh I/O orchestration.

---

### Pitfall 9: Silent mirror misses accepted as design -- but must stay MISS-only, never wrong-result

**What goes wrong:**
Two accepted best-effort gaps can degrade into correctness bugs if mishandled:
- **Eviction between save and publish.** The Actions cache is last-access LRU at the 10 GB repo cap and evicts after 7-day disuse. An entry saved but evicted before the next main-push `publish-mirror` run is never mirrored (`uploadHash`'s no-hit `return` silently skips it). Accepted -- mirror is best-effort.
- **Mid-session mirror staleness.** `serve` caches each shard's asset list for the process lifetime (to stay under the anonymous 60 req/hr limit); a hash published after startup is invisible until restart.

Both are fine *as extra MISSes*. The danger is any change that turns a stale/partial view into a served *wrong* artifact (e.g. serving a truncated download, or caching a negative result and then serving a different hash's bytes).

**Why it happens:**
Optimizations for rate-limit avoidance (process-lifetime shard cache) and simplicity (skip-on-no-hit) trade freshness for fewer API calls. The trade is safe only while the failure is always "MISS," never "wrong bytes."

**How to avoid:**
- Preserve the invariant: every degradation is a MISS, never a wrong or truncated result. The `never`-typed `PutResult` exhaustiveness guard and 413-socket-destroy pattern exist for exactly this discipline -- keep them.
- Publish-mirror more often than per-push only if eviction misses actually hurt; otherwise accept (low-churn target audience rarely hits the 10 GB cap).
- Document the mid-session staleness clearly so consumers restart `serve` if they expect same-session freshness.

**Warning signs:**
- A `serve` GET returns bytes whose length/hash does not match the requested hash.
- Consumers report "wrong build output from cache" (this must be impossible by design -- investigate immediately if seen).

**Phase to address:** Test-coverage phase (Active req 4) -- assert MISS-not-wrong-result under eviction/staleness/rate-limit.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| `gh` CLI stderr text-matching (`/already exists/i`, `HTTP 404`) for outcome discrimination | `gh` handles auth/pagination free on runners; no token plumbing | A `gh` version rewording these strings silently flips behavior (failed mirror run, or aborted cleanup) | Until the Octokit migration (Active req 7) lands; Octokit is already a dependency and discriminates `error.status` structurally |
| Age-only (`created_at`) retention instead of true LRU | Simple, no state; matches the coupled read window | Deletes hot entries -> rebuild/re-upload churn | Acceptable now (30-day window is generous, low-churn audience); revisit only if ROI proven (Pitfall 6) |
| Fully-buffered request/response bodies (up to 2 GB) | Simple; matches ~2 GiB Release-asset ceiling | Concurrent large entries spike memory on small runners | Fine until real workspaces produce multi-hundred-MB task outputs (they rarely do) |
| Duplicated `TRUSTED_EVENTS` (lib + dependency-free CJS action) | Action can run before `npm ci` with Node built-ins only | Edit one, forget the other -> action start-gate diverges from server write-gate (safe-direction but confusing) | Never silently -- add a selfcheck assertion comparing the two sets (both files already carry "keep in sync" comments) |
| In-process per-hash lock (single-server assumption) | Zero external coordination | Two processes on one host (serve + publish-mirror) can interleave on the shared temp path -> truncated reads | Fine for ephemeral single-tenant runners (the documented deployment); never on shared persistent runners |
| Sequential per-hash mirror upload/delete | Simple loop; avoids rate-limit pressure | Slow at high hash counts | Fine for low-churn repos; add bounded concurrency only when wall time actually matters |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| GitHub Actions cache write-trust | Trusting a fork-spoofable `GITHUB_EVENT_NAME` as the security boundary; adding `pull_request_target`/`workflow_run` to the trusted set | Rely on GitHub's server-side read-only token (github.com, since 2026-06-26) as load-bearing; in-code gate is defense-in-depth; add only `pull_request`+`release` (non-default-branch scope) |
| GitHub Actions cache scoping | Assuming a PR write can poison `main` (it can't) OR assuming `main` cache is unreachable from PRs (it is reachable) | PR writes go to the merge-ref/child scope, unreachable by `main`'s restores; but PRs DO restore `main`'s cache -- so protect `main`'s writers, not PR reads (https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching) |
| GHES vs github.com | Documenting fork safety unconditionally | State the read-only-token dependency + a GHES version floor; without it the in-code gate is the only (spoofable) control |
| `@actions/cache` | Changing the temp path / compression assumptions "harmlessly" | Route all paths through `cacheArchivePath()`; re-run `npm run test:act` on any `@actions/cache` bump (v1->v2 already churned once) |
| GitHub Release Asset API | Expecting a last-accessed field for LRU | None exists; synthesize access via a single-writer manifest or `download_count` deltas (Pitfall 4/6) |
| `gh` CLI `api` verb | `-f` flag flips method to POST unexpectedly | Force `-X GET` for list calls (the repo already does this in `actionsCachesListArgs`) |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Anonymous REST reads capped at 60 req/hr per IP | Local `serve` starts MISSing under parallel runs behind one IP | Shard asset lists fetched once per process; rate-limit faults degrade to MISS; `GH_TOKEN`/`GITHUB_TOKEN` lifts to 5000/hr | Large workspace or many parallel local runs behind one NAT/IP |
| Actions cache service rate limits (200 uploads/min, 1500 downloads/min per repo) | `publish-mirror` upload/restore failures with `Retry-After` | Keep mirror uploads serial (avoids burst); bounded concurrency only if needed | Very high hash counts per run |
| Extending the read shard-walk to cover LRU-retained out-of-window shards | Read latency + API fan-out climb toward the 60/hr limit | Constrain LRU to within-window eviction (Pitfall 5); never widen the walk | Any LRU design that retains beyond `CACHE_MIRROR_MAX_AGE_DAYS` |
| 1000 assets per month-shard release | `gh release upload` failures once a month exceeds 1000 unique hashes | Sub-shard tags (`cache-mirror-YYYYMM-N`) with the same window-walk | Repo produces >1000 unique Nx hashes/month (low-churn audience won't) |
| Actions cache 10 GB repo cap + 7-day disuse eviction | Wave of MISSes; entries evicted before mirroring | Accept (mirror is best-effort); publish more often only if it hurts | Busy repo churning past 10 GB |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Trusting the event name without the server-side read-only-token backstop | CREEP re-introduction: fork poisons a cache a trusted workflow restores | Two-layer model: GitHub server-side token (load-bearing) + in-code gate (defense-in-depth); never collapse to one |
| Mirroring PR/fork/release-scoped cache to the public Release mirror | Poisoned artifact served to every local consumer (project-specific CREEP path) | Keep `resolveTrustedRepo` strict: default-branch + trusted-event only, independent of the server's trust set |
| Enabling `pull_request`/`release` writes on old GHES | No server-side backstop; spoofable in-code gate is the only control | GHES version floor in docs; gate the widened set on the enforcement being present |
| `HASH_PATTERN` admits any hex-shaped Actions-cache key | Unrelated workflow steps' hex keys re-published as public Release assets | Acceptable for public repos (Actions content already effectively public); document the visibility caveat for private repos |
| Predictable shared temp path on persistent multi-tenant runners | Co-tenant symlink pre-creation -> arbitrary-file overwrite | Documented single-tenant ephemeral deployment; keep the README warning; path can't be randomized (version-hash coupling) |
| Leaking the runtime token or bearer token to logs/`$GITHUB_ENV` | Secret exposure | `ACTIONS_RUNTIME_TOKEN` passed only by process inheritance, never `$GITHUB_ENV`; bearer token masked (`::add-mask::`) before any output, re-masked on Windows |

## UX Pitfalls (consumer adoption -- Active req 5)

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Docs imply CREEP safety is automatic everywhere | GHES adopters ship a poisoning hole | State the github.com-only backstop + GHES floor explicitly |
| No documented "how do I know it's working" signal | Adopters can't tell HIT from silent MISS | Document the cache HIT/MISS signal and the "restart `serve` for mid-session freshness" caveat |
| Adopter changes `CACHE_MIRROR_MAX_AGE_DAYS` in only one workflow | Retained assets unreadable or expired assets linger (read/cleanup window drift) | Document it as ONE coupled setting that must match across serve + cleanup |
| Adopter assumes local read-write | Confusion when local `put()` 403s | Document read-only-local by design up front |

## "Looks Done But Isn't" Checklist

- [ ] **`pull_request`/`release` support:** Often missing the negative case -- verify `pull_request_target`/`workflow_run`/`issue_comment` are REFUSED, and that the server change did NOT loosen `publish-mirror`'s `resolveTrustedRepo`.
- [ ] **RW/RO mode capability:** Often missing tests -- verify `selectBackend` and `isWriteTrusted` have specs covering the trusted set, `GH_TOKEN || GITHUB_TOKEN` fallthrough, and malformed-repo rejection.
- [ ] **LRU retention:** Often missing the single-writer guarantee and the within-window constraint -- verify only the daily cleanup mutates the manifest, and every retained asset is reachable by `shardTagsForWindow`.
- [ ] **LRU retention:** Often missing the age floor -- verify age-based cleanup still bounds total size even if LRU keeps hot entries.
- [ ] **Octokit migration:** Often missing structural 404 discrimination in the cleanup path -- verify a rate-limit/partial-listing fault does NOT trigger deletion.
- [ ] **Cross-OS parity:** Often silently reopened -- verify `.gitattributes eol=lf`, `cacheArchivePath()` as sole path source, and BOTH publish-mirror OS legs still run.
- [ ] **Best-effort reads:** Verify every read fault degrades to a MISS (never 5xx, never wrong/truncated bytes) AND that cleanup/write paths do the opposite (fail loud, never infer absence).
- [ ] **GHES docs:** Verify the fork-safety guarantee carries a github.com-only / version-floor caveat.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Poisoned entry mirrored to public Release assets | HIGH | Identify affected `cache-mirror-*` assets, delete them, tighten `resolveTrustedRepo`, force local consumers to re-pull; audit which builds restored the asset |
| Cross-OS parity reopened (CRLF / path / matrix) | LOW-MEDIUM | Restore `.gitattributes`/path/matrix; misses self-heal on next trusted push as entries rebuild and re-mirror; re-run `test:act` |
| LRU manifest corrupted by write race | MEDIUM | Manifest is derived state, not source of truth -- delete/rebuild it from current assets in the single writer; move all mutation back into the one cleanup job |
| Cleanup deleted live entries on a partial listing | MEDIUM | Entries rebuild + re-mirror on next trusted push (mirror is best-effort); add fail-loud guard so a faulted listing never deletes |
| Trusted set widened to a dangerous event | HIGH if exploited, LOW to revert | Revert the `TRUSTED_EVENTS` change in BOTH copies; rely on GitHub's server-side token having blocked the write in the interim (github.com) |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase (by Active req) | Verification |
|---------|----------------------------------|--------------|
| 1. CREEP via wrong trigger set | `pull_request`/`release` support (req 1) + RW/RO tested (req 2) | Unit test: exact trusted set; dangerous events refused; both `TRUSTED_EVENTS` copies identical |
| 2. Mirror as cross-trust bridge | `pull_request`/`release` support (req 1) | Test `publish-mirror` preamble still refuses PR/release/non-default refs after server trust widens |
| 3. GHES version floor | Adoption docs (req 5) + req 1 | Docs state github.com-only backstop + GHES floor; gate widened set on enforcement presence |
| 4. LRU manifest write race | LRU retention (req 3) | Only cleanup mutates manifest; concurrency test; no per-push/serve writes |
| 5. Retention vs read-window drift | LRU retention (req 3) | Assert every retained asset resolvable by `shardTagsForWindow`; no second env knob |
| 6. Hot-entry deletion / fake LRU | LRU retention (req 3) + spike | LRU uses a real access signal; age floor preserved; ROI validated |
| 7. Cross-OS parity reopened | Test coverage (req 4), cross-cutting | CI asserts both OS legs; `.gitattributes` + `cacheArchivePath` guarded; `test:act` on `@actions/cache` bump |
| 8. Fault-as-absence | Octokit migration (req 7) + test coverage (req 4) | Mocked partial-listing test asserts no deletion; structural 404 only |
| 9. Silent MISS -> wrong result | Test coverage (req 4) | Assert MISS-not-wrong-result under eviction/staleness/rate-limit |

## Empirically-Verified Platform Facts (rebuild carry-forward)

Platform/tooling truths verified by the PoC + the FOUND-01 spike - true regardless of implementation, and the most expensive to rediscover. Carry them into the greenfield rebuild; they prime no particular design (the implementation SHAPE that produced them is intentionally left in git history, not carried forward).

- **Nx OS-sensitive hashing recipe.** To make a task's Nx hash differ by OS (so a Linux-produced entry never serves a Windows reader, and a local run on each OS still hits its own entry), add a runtime input `{ "runtime": "node -p process.platform" }` to that task's `inputs` in `nx.json`. Rejected alternatives and WHY: `env:RUNNER_OS` is unset off-CI, so local runs never hit; a plain `env` var fails because MSYS/Git-Bash uppercases the variable name while Nx's env hasher is case-sensitive, so a bash-launched local run misses. `process.platform` is compiled into node -> stable across shell (PowerShell/Git-Bash/cmd) and across x64/arm64/emulation. REQUIRES Nx >= 22.7.0 (nrwl/nx#34971 runtime-input cache fix); older Nx returns a stale runtime value when the daemon is disabled (as it is on CI).
- **`@actions/cache` `saveCache` returns `-1` for BOTH "entry already exists" AND "write denied by a read-only token"** - indistinguishable via the public API (the distinguishing errors are caught internally). A systematically denied write looks identical to a benign idempotent write at the backend layer; only the write-trust gate keeps that from masking a real outage.
- **A Windows detached background process must NOT inherit the runner's stdio.** On windows-11-arm a backgrounded server that inherits the step's stdout is killed when the runner closes the step pipe (verified); it must detach (e.g. log to a temp file) and re-register any secret masks out of band. POSIX may inherit safely. Relevant to running `serve` as a background step and the DOCS-06 `cancel` teardown.
- **`ACTIONS_RUNTIME_TOKEN` / `ACTIONS_RESULTS_URL` (required by the Actions-cache backend) were observed injected only into JS actions, not plain `run:` steps** - and are passed to a child only by process inheritance, never via `$GITHUB_ENV`. OPEN VERIFICATION for the rebuild (Phase 2 / DOCS-06): confirm whether a background / `run:` step receives them, because the server-launch mechanism (background step vs JS action) depends on it.

Everything else in this doc (Pitfall 7's cross-OS `@actions/cache` version hashing incl. zstd-vs-gzip + `.gitattributes eol=lf`; the `gh` no-structured-errors + `-f`-flips-to-POST gotchas; no Release last-accessed signal; the 60/5000 rate limits; the 2 GiB / 1000-asset / 10 GB caps; the Nx PUT `202->200` drift; the github.com-only CREEP backstop) is also implementation-independent and carries forward.

## Sources

- CVE-2025-36852 / CREEP (Nx blog, 2025-06-12): https://nx.dev/blog/cve-2025-36852-critical-cache-poisoning-vulnerability-creep -- mechanism, first-to-cache-wins race, why checksums don't help, Nx Cloud's trust-boundary mitigation. Confidence HIGH.
- GitHub changelog "Read-only Actions cache for untrusted triggers" (2026-06-26): https://github.blog/changelog/2026-06-26-read-only-actions-cache-for-untrusted-triggers/ -- which events keep read-write (`push`/`schedule`/`workflow_dispatch`/`repository_dispatch`/`delete`/`registry_package`/`page_build`, plus non-default-scope `pull_request`/`release`), which are forced read-only (default-branch-SHA untrusted context), github.com + Data Residency scope. Confidence HIGH.
- GitHub Actions dependency-caching reference: https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching -- branch-scope isolation (child/sibling caches unreachable by parent; PR runs restore base/default caches; PR caches created for merge ref), last-access LRU eviction at 10 GB cap, 200 uploads/min + 1500 downloads/min rate limits, "cannot change contents of an existing cache." Confidence HIGH.
- Nx self-hosted caching spec + usage notes: https://nx.dev/docs/guides/tasks--caching/self-hosted-caching#usage-notes -- OpenAPI contract (`GET`/`PUT /v1/cache/{hash}`, 401/403/404/409 semantics), env vars, stable-spec guarantee. Confidence HIGH.
- Nx enterprise security: https://nx.dev/enterprise/security -- "self-hosted caching can't guarantee artifact integrity," even official Nx self-hosted plugins follow a similar (vulnerable) architecture, regulated-industry framing. Confidence HIGH (vendor-positioning, but the technical claim about self-hosted CREEP exposure is corroborated by the CVE).
- This repo's `.planning/codebase/ARCHITECTURE.md` and `CONCERNS.md` (2026-07-17) -- resolved cross-OS/CRLF bugs, single-writer cleanup, retention coupling, `gh` sentinel debt, in-process lock assumption. Confidence HIGH (first-party).

---
*Pitfalls research for: self-hosted Nx remote cache on GitHub primitives*
*Researched: 2026-07-17*
