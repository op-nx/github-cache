# Phase 11: Live Proofs -- O1, O2, O3 - Research

**Researched:** 2026-07-29
**Domain:** GitHub Actions cache REST semantics, Nx task-graph resolution, live-CI proof construction
**Confidence:** HIGH throughout. Every claim is measured against this repo's own run history, read in
version-matched source, or fetched from the authoritative docs page. No `[ASSUMED]` claim survives.
The one question that is *not* settled here -- D-06's cold hashes -- is unsettled deliberately,
because measuring it would destroy the perishable window; it is specified as a live pre-flight with
exact commands instead.

## Summary

**U-01 is ANSWERED YES, decisively, and D-17 ships as written.** All three of its underpinning facts
were measured against this repo's own run history this session. Sibling matrix legs write cache
entries under the *same* `ref` and `GET /repos/{owner}/{repo}/actions/caches` lists both. Cache
`created_at` carries sub-second precision; step `started_at` is second-granular -- irrelevant,
because the measured margin is **109-182 seconds across 11 consecutive runs, ubuntu-first in 11 of
11**. The margin has a structural cause (Windows `npm ci` ~180 s vs ubuntu ~19 s) rather than a
scheduling one, so it is robust without being an ordering *control*: D-17's witness job **asserts**
the inequality and fails loud, which is exactly the right shape. The dedicated-job fallback is not
needed and should not be built.

**Five findings the plan needs, in descending order of how much they change the work.** None
re-litigates a locked choice; each is a measured mechanic or a measured contradiction.

1. **`.nx/cache/run.json` carries a per-task `cacheStatus` field with exactly three values --
   `remote-cache-hit`, `local-cache-hit`, `cache-miss`.** This is the remote-vs-local discrimination
   OBS-02 and D-24 say the `Cache: n/m hit` line *cannot* provide, available structurally and
   per-target. It does **not** replace the literal `[remote cache]` label (which OBS-02 and SC1 name
   in their own words) and it still cannot attribute a producer OS (D-14 untouched) -- but it
   replaces `Cache: n/m hit` as the corroborator of choice for O1, O2 and D-17(a), at zero cost.
2. **`?key=` on the caches endpoint is a PREFIX match, not exact.** `?key=nx-cache-1` returns 40
   entries. The witness must compare the returned `.key` for string equality, never
   `total_count > 0`. This would have shipped as a subtly-broken guard that passes on the happy path.
3. **An `ACTIONS_STEP_DEBUG` repository *secret* takes precedence over the *variable*.** Documented.
   If a stale secret exists at any value, D-21's variable is silently ineffective. One read-only
   pre-flight command closes it -- and the `runner.debug` context gives a better in-run check than a
   post-hoc log grep.
4. **`ci.yml` carries a STALE comment (`:574-577`) asserting `ci.yml` is not an `nx.json` `test`
   input.** It IS one now (`nx.json:69`, PARITY-08 landed in Phase 9). A planner reading that comment
   would conclude D-19's content guard cannot work -- the exact opposite of the truth.
5. **D-10's rotation table is CORRECT on all four rows** (independently re-derived from `nx.json` read
   in full), with two additions: a new or edited **`.spec.ts`** under `src/` rotates
   `test`/`typecheck`/`integration`/`lint` but **not** `build` -- which is precisely D-19's cost; and
   editing **root `package.json`** rotates `test`, so prefer a flag on the existing `capture:hashes`
   script over a new npm script.

**Primary recommendation:** ship D-17 unchanged, with the exact-key-equality guard; record
`run.json`'s `cacheStatus` alongside every `[remote cache]` count as the structured corroborator;
run D-06's warm capture **before** the reset, because the box is warm right now and that number is
otherwise unrecoverable.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| O1/O2 hit observation | Local workstation (Windows arm64) | Releases mirror (read) | TEST-10 names a native Windows workstation and a cleared local cache; no CI tier can produce it |
| O3 existence demonstration | GitHub Actions REST API (ubuntu witness job) | Actions cache service | `H_linux` is not computable on a Windows runner (D-16); the comparison is post-hoc metadata |
| O3 positive control | Windows runner, in-job (sidecar HTTP) | Actions cache service | TEST-09(3) requires same-job; only the leg itself can prove its own sidecar was alive |
| TEST-08 graph premise | Local dev tooling (`capture-hashes.mjs`) | -- | Root-level, non-target, hash-neutral by construction (D-10 row 4) |
| Evidence record | `.planning/` artifact | -- | Documentation tier; no runtime surface |

## User Constraints (from CONTEXT.md)

All 24 decisions D-00..D-24 in `11-CONTEXT.md` are LOCKED and reproduced there in full. This
research does not restate them. Where a measurement bears on a locked decision it is called out
inline below as CONFIRMS / CORRECTS / ADDS, and no locked choice is re-litigated.

Locked, and explicitly **not** reopened here: the literal `nx reset` harness order (D-05); O1/O2
measured first at the current commit (D-11); `capture-hashes.mjs` as TEST-08's instrument (D-12);
`mirrored-by` cannot attribute a producer (D-14); `H_linux` from the ubuntu leg's own `run.json`
(D-17 sub-lock 1); absence-of-`[remote cache]` RECORDED never GATED (D-17 sub-lock 2); the
temporary-`main`-push proving run (D-20); `H_linux != H_win` CITED from CORR-03(b) (D-18); one
`11-EVIDENCE.md` with a reserved O4 section (D-22); counts pre-registered in the PLAN (D-23).

Out of scope entirely, per CONTEXT.md: anything O4 (XOS-04/05/08), DOCS-07, collapsing the publish
matrix, read-fallback across asset names, any OS-invariance knob.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| XOS-01 | Local Windows HIT for `build`/`typecheck`/`test` from Linux-CI artifacts (O1) | D-06 cold/warm pre-flight commands (below); D-10 rotation table re-derived, which is what protects the perishable window |
| XOS-02 | Local Windows HIT for `integration` from Windows-CI artifacts (O2) | Windows `integration` hash confirmed present in the Actions cache and attributable by timing (`8137422034373911537`, three independent runs) |
| XOS-03 | Windows CI MISSes Linux-produced `integration` -- an Nx-HASH property | H_linux/H_win pair identified and timing-attributed in 3 runs; U-01 verdict makes the existence clause demonstrable |
| TEST-08 | Recorded proofs, producer attribution, mechanical graph assertion, pre-registered counts, `ACTIONS_STEP_DEBUG` | `createTaskGraph` call site and extension spec (below); `ACTIONS_STEP_DEBUG` surface; attribution-by-timing method measured |
| TEST-09 | O3 is an Nx-hash proof: cite (1), show executed-with-no-label (2), positive control (3) | U-01 answered for (2); `restoreCache` no-short-circuit confirmed in source for (3) |
| TEST-10 | Reset FIRST then sidecar; soundness probe precedes; `Cache: n/m` non-discriminating | `mkdirSync(CACHE_ARCHIVE_DIR)` and the fail-closed write path confirm the D-05 order rationale in source |
| OBS-02 | Non-zero count of literal `[remote cache]` tasks, named per target | Count-pre-registration shape (below) |

## U-01 -- VERDICT: the inequality IS establishable. D-17 ships as written.

Measured 2026-07-29 against this repo's own run history. Read-only `GET` only.

### (1) Sibling-leg visibility and `ref` -- YES, same `ref`, both listed

`GET /repos/op-nx/github-cache/actions/caches` lists entries written by **both** legs of the
`integration` matrix, under **one** `ref` -- the run's own ref.

| Run | Event | `ref` on both entries | Linux `integration` entry | Windows `integration` entry |
|---|---|---|---|---|
| `30471772954` | `push` / main | `refs/heads/main` | `nx-cache-1299325648892106405` | `nx-cache-8137422034373911537` |
| `30471172051` | `pull_request` #10 | `refs/pull/10/merge` | `nx-cache-1299325648892106405` | `nx-cache-8137422034373911537` |
| `30408345764` | `pull_request` #10 | `refs/pull/10/merge` | `nx-cache-5628514715519175728` | `nx-cache-7907925174069363349` |

`$GITHUB_REF` is the correct filter value on both events (`refs/heads/main` on push,
`refs/pull/N/merge` on PR), so one expression works for the proving run and for any PR rehearsal.
[VERIFIED: GitHub REST API, this repo]

**Producer attribution of the pair is itself a measured method, not an assumption.** In each run the
two `integration` entries are ~650-700 bytes and each was created *inside its own leg's step
window*: `1299325648892106405` at `16:40:21.612895Z` against the ubuntu step's `16:40:18Z-16:40:21Z`,
and `8137422034373911537` at `16:43:31.841858Z` against the Windows step's `16:43:23Z-16:43:42Z`.
This is D-14's row 3 (entry list cross-referenced against job windows) working in practice, and it
independently corroborates D-02's win32/arm64 `integration` hash. [VERIFIED: REST API, 3 runs]

### (2) Timestamp granularity -- adequate by three orders of magnitude

| Field | Endpoint | Observed precision |
|---|---|---|
| `created_at`, `last_accessed_at` on a cache entry | `/actions/caches` | sub-second, e.g. `2026-07-29T16:40:21.612895000Z` |
| `started_at`, `completed_at` on a job **and** on a step | `/actions/runs/{id}/jobs` | whole seconds, e.g. `2026-07-29T16:43:23Z` -- no fractional part |

The two sides disagree on precision, so the comparison must be done in **epoch seconds** with the
cache `created_at` fractional part truncated (floor). Given the measured margin, require a stated
**minimum margin** rather than a bare `<`, so a truncation artefact can never manufacture a false
pass. `>= 30 s` is generous against a 109 s observed floor and still leaves ~4x headroom.
[VERIFIED: REST API]

### (3) The observed margin -- 109-182 s, ubuntu-first in 11 of 11 runs

`npm run integration` step window per leg, every CI run in the last ~30 hours:

| Run | Event | ubuntu step completed | windows step started | margin |
|---|---|---|---|---|
| `30477430909` | PR | 17:54:34Z | 17:57:06Z | 152 s |
| `30474554061` | PR | 17:16:50Z | 17:18:58Z | 128 s |
| `30473795059` | PR | 17:06:42Z | 17:09:28Z | 166 s |
| `30473116345` | push/main | 16:57:50Z | 17:00:08Z | 138 s |
| `30471772954` | push/main | 16:40:21Z | 16:43:23Z | **182 s** (max) |
| `30471172051` | PR | 16:32:42Z | 16:34:45Z | 123 s |
| `30409045786` | PR | 23:46:47Z | 23:49:24Z | 157 s |
| `30408345764` | PR | 23:33:35Z | 23:35:53Z | 138 s |
| `30401077417` | push/main | 21:32:49Z | 21:34:38Z | 109 s (min) |
| `30400231720` | push/main | 21:20:39Z | 21:22:53Z | 134 s |
| `30372679674` | PR | 15:18:40Z | 15:21:18Z | 158 s |

n = 11, ubuntu-first 11/11, min 109 s, max 182 s. [VERIFIED: REST API]

Measured against the quantity D-17 actually compares (`created_at` of the H_linux **entry**, not
step completion): `30471772954` = 181.4 s, `30471172051` = 122.6 s, `30408345764` = 138.6 s.

**Structural cause, which is why this is not luck.** Both legs are dispatched in the same second
(`16:39:53Z` in run `30471772954`). The margin is dominated by per-step latency the OS forces:

| Step | ubuntu-24.04-arm | windows-11-arm |
|---|---|---|
| `actions/checkout@v7` | 1 s | 9 s |
| `actions/setup-node@v6` | 2 s | 15 s |
| `npm ci` | **19 s** | **180 s** |
| whole job | 31 s | 236 s |

The ubuntu leg's entire job finishes (`16:40:24Z`) before the Windows leg's `npm ci` is halfway
done. [VERIFIED: REST API, run `30471772954`]

### Verdict and the exact instrument the plan should build

**The inequality is establishable. Build D-17 as written. Do not build the dedicated-job fallback.**

This does **not** make leg order a correctness control and does not touch XOS-06 or the PROJECT.md
platform-agnosticism row. The proof is the witness job's *assertion*, evaluated post-hoc on recorded
metadata. If the margin ever collapses, the witness fails loud and the proof is simply not recorded
that run -- which is the correct failure mode, and the opposite of an ordering dependency (an
ordering dependency would let a reordered run silently produce a *wrong* verdict).

Exact endpoints, fields and comparison for the `o3-witness` job:

| # | Call | Fields read |
|---|---|---|
| 1 | `GET /repos/{owner}/{repo}/actions/caches?key=nx-cache-<H_linux>&ref=$GITHUB_REF&per_page=100` | `.actions_caches[] \| select(.key == "nx-cache-<H_linux>") \| .created_at` |
| 2 | `GET /repos/{owner}/{repo}/actions/runs/$GITHUB_RUN_ID/jobs?per_page=100` | `.jobs[] \| select(.name == "integration (windows-11-arm)") \| .steps[] \| select(.name == "Run npm run integration") \| .started_at` |

Comparison: `floor(epoch(created_at)) + MARGIN <= epoch(started_at)`, `MARGIN = 30`. Fail loud
(`exit 1`) with both raw timestamps and the computed delta printed, per the repo's
`hash-parity-compare` double-signal precedent.

Four mechanics the plan must get right:

1. **`?key=` is a PREFIX match. Compare `.key` for exact string equality.** Measured:
   `?key=nx-cache-1` -> 40 entries; `?key=nx-cache-129932564889210640` (full key minus its last
   character) -> 2 entries; `?key=299325648892106405` (substring, not prefix) -> 0;
   `?key=nx-cache-1299325648892106405-extra` -> 0. So the match is anchored at the start and
   open-ended at the tail. **`total_count > 0` is NOT a valid existence test** -- a shorter hash that
   is a prefix of a longer one would pass it. `jq 'select(.key == "...")'` closes it.
   [VERIFIED: REST API, 5 probes]
2. **Paginate or filter.** The repo currently holds 142 cache entries against a `per_page` max of
   100. The `key` + `ref` filter reduces this to 1-2, so filter rather than paginate.
   [VERIFIED: REST API]
3. **The step name in the `jobs` payload is the *rendered* name.** Today `- run: npm run integration`
   renders as `Run npm run integration`. If the plan adds a `name:` to that step (likely, since D-17
   adds a `tee`), the witness's selector must match the new name. Prefer giving the step an explicit
   `name:` in the same commit and matching that literal -- an implicit rendered name is a silent
   coupling. Match by content, and pair the selector with a non-empty assertion so a rename fails
   loud instead of comparing against an empty string.
4. **`curl` is confirmed available on `windows-11-arm`** -- the shipped `Wait for the loopback
   sidecar` step in the `integration` job is a `shell: bash` + `curl` step with no `if:` and it
   succeeds on both legs in all 11 runs above. D-17 sub-lock 4's preference for `curl` over `gh`
   therefore costs nothing. [VERIFIED: `ci.yml` integration job + 11 runs]

## Standard Stack

No new dependency. Every mechanic reuses something already in this tree.

### Core
| Tool | Version | Purpose | Why standard here |
|---|---|---|---|
| `curl` | runner-provided | all REST + sidecar GETs | proven on both legs by the shipped readiness poll; D-17 sub-lock 4 |
| `jq` | runner-provided (ubuntu) | field extraction from REST payloads | witness job is ubuntu-only by design (D-17 sub-lock 4) |
| `nx` | 23.1.0 (exact-pinned) | task-graph resolution | already imported by `capture-hashes.mjs` |
| `@actions/cache` | 6.2.0 (exact-pinned) | the read path the positive control exercises | already the sidecar's backend |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|---|---|---|
| `curl` + `jq` | `gh api` | ZERO workflow precedent in this repo; unverified on `windows-11-arm`. Rejected by D-17 sub-lock 4 and this research finds no reason to revisit |
| post-hoc REST comparison | dedicated Windows job that `needs:` ubuntu | Only needed if U-01 failed. It did not. Reshapes a core CI job for no gain |
| `node -e` for the timestamp arithmetic | `bash` `date -d` + integer compare | Both fine; witness is ubuntu-only so GNU `date -d` is available. D-17 leaves this to discretion |

**Installation:** none. No package is added by this phase. The Package Legitimacy Audit section
below is therefore N/A and states so.

## Package Legitimacy Audit

**N/A -- this phase installs no external package.** Every instrument extends an existing file
(`capture-hashes.mjs`, `ci.yml`) or uses a runner-provided binary (`curl`, `jq`, `date`). No
`package.json` edit is required for the O3 work.

Note the consequence, which is a *benefit* the plan should bank: adding a dependency would edit root
`package.json`, which is an `nx.json` `test` input (`nx.json:55`) and would rotate the `test` hash
mid-window. Staying dependency-free is not just lazy, it protects the perishable measurement.

## Architecture Patterns

### System Architecture Diagram

```
                        THE PROVING RUN (push to main, D-20)
                                     |
        +----------------------------+----------------------------+
        |                                                         |
  integration (ubuntu-24.04-arm)                     integration (windows-11-arm)
        |                                                         |
  npm ci  (~19s)                                        npm ci  (~180s)  <-- the 109-182s margin
        |                                                         |          originates here
  start sidecar (bg) --> readiness GET 404|200            start sidecar (bg) --> readiness GET
        |                                                         |
  npm run integration  | tee log                         npm run integration | tee log
        |                    |                                    |                  |
        |                    +-- MISS, task EXECUTES              |     +-- no [remote cache] label
        |                        Nx PUT --> sidecar               |         (RECORDED, never gated)
        |                            |                            |
        |                     saveCache(nx-cache-<H_linux>)  saveCache(nx-cache-<H_win>)
        |                            |                            |
        |                    [Actions cache service] <------------+
        |                                                         |
  read own .nx/cache/run.json ---> upload artifact          POSITIVE CONTROL (D-16):
    (per-leg unique name)          <hash>-ubuntu             authed GET sidecar /v1/cache/<H_win>
        |                                                    MUST be 200  -->  hard exit 1
        |                                                         |
        +----------------------------+----------------------------+
                                     |
                          o3-witness  (ubuntu-24.04-arm)
                          needs: integration
                          permissions: contents: read + actions: read   <-- RESTATE both (trap)
                                     |
              +----------------------+----------------------+
              |                                             |
   download artifact <hash>-ubuntu                GET /actions/runs/$RUN_ID/jobs
   -> H_linux                                     -> started_at(windows integration step)
              |                                             |
   GET /actions/caches?key=nx-cache-<H_linux>&ref=$GITHUB_REF
   -> select(.key == exact) -> created_at
              |                                             |
              +----------------------+----------------------+
                                     |
              ASSERT floor(created_at) + 30s <= started_at   --> exit 1 loud on failure
                                     |
                            run URL + numbers --> 11-EVIDENCE.md (O3 section)


   SEPARATE, EARLIER, LOCAL (D-11: before any packages/** or ci.yml edit):
   nx reset  -->  soundness probe (timestamped BEFORE)  -->  start sidecar
              -->  nx run-many  -->  count [remote cache] per target  -->  O1/O2
```

### Pattern 1: post-hoc metadata inequality instead of an ordering dependency
**What:** prove "X existed when Y ran" by comparing recorded timestamps after the fact, rather than
by forcing X to precede Y.
**When to use:** whenever the platform gives you no ordering guarantee but does give you timestamps.
**Why it is stronger:** an ordering control that regresses produces a silently *wrong* verdict; an
assertion that regresses produces a *loud failure*. This is D-17 sub-lock 2's logic (a tripwire that
fires on correct work gets disabled) applied in the other direction -- here the tripwire fires only
on genuinely unsound evidence.

### Pattern 2: exact-equality guard over a prefix-matching filter
**What:** when an API filter is prefix- or substring-shaped, never treat a non-zero count as an
existence proof; re-check the returned identifier for exact equality.
**Example (the witness's existence check):**
```bash
# Source: measured against GET /repos/{owner}/{repo}/actions/caches, 2026-07-29
key="nx-cache-${H_LINUX}"
created=$(curl -fsS \
  -H "Authorization: Bearer ${GITHUB_TOKEN}" \
  -H 'Accept: application/vnd.github+json' \
  -H 'X-GitHub-Api-Version: 2022-11-28' \
  "https://api.github.com/repos/${GITHUB_REPOSITORY}/actions/caches?key=${key}&ref=${GITHUB_REF}&per_page=100" \
  | jq -r --arg k "$key" 'first(.actions_caches[] | select(.key == $k) | .created_at) // empty')

if [ -z "${created}" ]; then
  echo "o3-witness: no Actions cache entry with key EXACTLY ${key} under ref ${GITHUB_REF}" >&2
  exit 1
fi
```
Note `select(.key == $k)`, not `total_count`. `first(...) // empty` yields a definitively empty
string rather than the literal `null` that `-r` would otherwise print -- `[ -z "null" ]` is false, so
without `// empty` the guard passes on absence. This is the same class of vacuity trap as D-13's.

### Pattern 3: the count that would differ under the failure hypothesis (D-23, OBS-02)
**What:** never record "green"; record a number whose value is different if the mechanism failed.
**For O1:** the count of tasks carrying the literal `[remote cache]` label, **named per target** --
`build`, `typecheck`, `test` each present, so the pre-registered value is 3-of-3 named individually,
not an aggregate of 3. Under the failure hypothesis (mirror read dead) the count is 0.
**For the witness:** the computed delta in seconds. Under the failure hypothesis (entry did not
exist yet) the delta is negative or the entry is absent.
**Explicitly non-discriminating and must be labelled so in the artifact (D-24, OBS-02):** the
`Cache: n/m hit` line, in both directions.

### Anti-Patterns to Avoid
- **Reading `total_count` as existence** on `/actions/caches`. Prefix match; see Pattern 2.
- **Comparing whole-second step timestamps with sub-second cache timestamps without flooring.**
  Use a stated margin.
- **A negative control that resolves nothing.** D-13's whole point; see the TEST-08 section.
- **Trusting `ci.yml:574-577`.** Stale; see Common Pitfalls.
- **Treating the 109-182 s margin as an ordering guarantee.** It is an observed margin with a
  structural cause. The *assertion* is the proof; the margin only explains why the assertion
  passes.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Nx task-graph resolution | a config reader that walks `dependsOn` | `createTaskGraph` (already imported at `capture-hashes.mjs:270`) | TEST-08 requires a property of the **resolved graph**, not of the config -- a config reader answers a different question |
| Nx task hash | any re-derivation | `createTaskHasher().hashTask()` (already in use) | the file's own header records it proven byte-identical to Nx's `run.json` |
| Reading the produced hash in CI | parsing Nx stdout | `.nx/cache/run.json` | per-task surface written unconditionally by `StoreRunInformationLifeCycle`; read IMMEDIATELY (next `nx` overwrites) |
| Per-leg artifact plumbing | a new mechanism | `hash-parity` / `hash-parity-compare` (`ci.yml:578`, `:747`) | unique-name-per-leg + `if-no-files-found: error` + `needs:` + `if: !cancelled()` already solved and commented |
| Authed sidecar GET | a new probe | the `Wait for the loopback sidecar` step's shape | already proven on both OS legs |
| Proving the service was reached | asserting on a local archive file | the sidecar 200 (see below) | the backend has no local short-circuit |

**Key insight:** this phase's correct posture is *zero new machinery*. Every SC has an existing
in-repo instrument one field away from doing the job. The only genuinely new artifact is the
`o3-witness` job, and it is 20 lines of `curl` + `jq` in an existing file.

## D-16 -- the positive control DOES round-trip to the service. CONFIRMED in source.

CONTEXT.md's open question 2. Read `@actions/cache@6.2.0` (local clone at
`D:\projects\github\actions\toolkit\packages\cache`, version-matched to the installed `6.2.0`) plus
this repo's own backend. Both halves of the path check out:

1. **`restoreCache` has no local-archive short-circuit.**
   `cache.ts:148-190`: `restoreCache` -> `getCacheServiceVersion()` -> `restoreCacheV1`/`V2`. Its
   *only* early return is `isCacheReadable(cacheMode)` being false -- an **env-driven cache-mode
   gate**, not a filesystem check. `restoreCacheV1` (`cache.ts:202+`) proceeds to
   `cacheHttpClient.getCacheEntry(keys, paths, ...)`. The `paths` argument is used to compute the
   cache *version* and as the extraction target; it is never consulted for a pre-existing file.
   [VERIFIED: `@actions/cache@6.2.0` source]

2. **This repo's backend cannot manufacture a false 200 either.**
   `packages/github-cache/src/backend/actions-cache-backend.ts` `get()`: calls
   `cache.restoreCache([path], cacheKeyFor(hash), undefined, undefined, true)` **first**, and
   `if (matched === undefined) return { kind: 'miss' }`. Only *after* a service match does it
   `readFile(path)`, and it `rm`s the archive in a `finally`. A stale local archive from a prior
   `put()` therefore cannot produce a hit: a service MISS returns `undefined` -> `{kind:'miss'}` ->
   sidecar 404. And `server.ts`'s `handleGet` degrades any `backend.get` fault to a **404 MISS**
   (`server.ts:140-151`), so a partial/failed extraction also cannot surface as 200.
   [VERIFIED: repo source]

**Conclusion:** a 200 from `GET /v1/cache/<H_win>` through the sidecar can *only* have come from a
real cache-service hit. D-16's control is sound and is in fact strictly conservative (it can produce
a false negative, never a false positive). **No alternative known-present key is needed.**

Two mechanics worth pinning in the plan:

- **Order matters:** the control must run **after** `npm run integration`, because it is the task's
  own `saveCache` that makes the key present. D-16 already says "taken AFTER the task ran".
- **Do not reuse the readiness step's `deadbeef` hash for the control.** That probe accepts
  `404 || 200` by design (it proves *reachability*). The control must require **exactly 200** on the
  leg's own hash -- a `404` there is a control FAILURE and must `exit 1`. Two probes with two
  different acceptance sets, both `curl -w '%{http_code}'`; do not collapse them.

## `.nx/cache/run.json` carries a STRUCTURED per-task remote-vs-local discriminator

Not asked in CONTEXT.md, found while confirming A3, and it is the most useful unasked-for finding in
this research. **`run.json` records, per task, whether the hit came from the REMOTE cache, the LOCAL
cache, or was a miss.** That is precisely the distinction OBS-02 and D-24 say the `Cache: n/m hit`
line *cannot* make.

The live file on this box (read 2026-07-29, from an earlier `nx run-many -t lint`):

```json
{
  "run": { "command": "nx run-many -t lint", "startTime": "...", "endTime": "...", "inner": false },
  "tasks": [
    {
      "taskId": "@op-nx/github-cache:lint",
      "target": "lint",
      "projectName": "@op-nx/github-cache",
      "hash": "12188798272866712437",
      "startTime": "...", "endTime": "...", "params": "",
      "cacheStatus": "local-cache-hit",
      "status": 0
    }
  ]
}
```

The derivation, exactly, from `nx/dist/src/tasks-runner/life-cycles/store-run-information-life-cycle.js:51-56`:

```js
const cacheStatus = tr.status === 'remote-cache'
  ? 'remote-cache-hit'
  : tr.status === 'local-cache' || tr.status === 'local-cache-kept-existing'
    ? 'local-cache-hit'
    : 'cache-miss';
```

**Exactly three values: `remote-cache-hit`, `local-cache-hit`, `cache-miss`.**
[VERIFIED: nx 23.1.0 source + the live file]

### What this changes, and what it must NOT change

**It does NOT replace the literal `[remote cache]` label.** OBS-02 and ROADMAP SC1 name that label in
their own words -- "a non-zero count of tasks carrying the literal `[remote cache]` label, named per
target". The label stays the primary instrument. Do not substitute.

**It DOES give every proof a second, structured, machine-readable signal that is strictly stronger
than the one D-24 marks non-discriminating.** Record both, and label each for what it is:

| Proof | Primary (requirement's own words) | New structured corroborator | Strength |
|---|---|---|---|
| O1 (XOS-01, OBS-02) | count of literal `[remote cache]` labels, named per target | `run.json` `tasks[] \| select(.cacheStatus=="remote-cache-hit") \| .target` -- the per-target set, directly | Discriminates remote from local. **Replaces `Cache: n/m hit` as the corroborator of choice** |
| O2 (XOS-02) | `[remote cache]` on `integration` | `cacheStatus == "remote-cache-hit"` on the `integration` task | same |
| O3 / D-17(a) | absence of `[remote cache]` on the Windows `integration` task, RECORDED not gated | `cacheStatus == "cache-miss"` on that task | A structural field, not a regex over terminal output. Same RECORDED-not-GATED treatment (sub-lock 2 is unaffected -- it is about *gating*, not about the instrument) |
| D-24's `Cache: n/m hit` | still recorded, still marked NON-DISCRIMINATING IN BOTH DIRECTIONS | -- | unchanged; D-24 stands |

**What it still cannot do, so D-14 is untouched:** `cacheStatus` does not attribute a producer OS. A
`remote-cache-hit` says the bytes came from the remote, not who made them. D-14's four means remain
exactly as locked.

### Three mechanics for the plan

1. **`run.command` self-documents which command produced the file** -- use it as a guard. D-17 step
   (b) reads the leg's own `integration` hash; assert `run.command` contains `integration` before
   trusting the hash, so a stale `run.json` from a different `nx` invocation cannot be uploaded as
   the integration hash. This is a free guard against Pitfall 5 misfiring silently.
2. **The `target` field means no task-id string-splitting.** `tasks[].target` is the bare target name
   and `tasks[].projectName` the project. Use them instead of parsing `taskId`.
3. **`run.json` is written in a `try/catch` that swallows every error unless `NX_VERBOSE_LOGGING`**
   (`store-run-information-life-cycle.js`, the `endCommand` catch arm). So a *missing* `run.json` is
   silent. Every reader must throw on absence -- never default to an empty hash.

**The project name is `@op-nx/github-cache`, not `github-cache`.** Confirmed from the live `run.json`.
Task ids are `@op-nx/github-cache:<target>`. Any literal task id in a plan, a selector or an
assertion must carry the scope.

**Incidental cross-check that strengthens D-02:** this box's `lint` hash in `run.json` is
`12188798272866712437` -- byte-identical to D-02's table value for `lint`. That is Nx's own
arithmetic agreeing with `capture-hashes.mjs`, independently re-confirming the header's
proven-byte-identical claim, and confirming D-02's table is still current at this HEAD (D-04).
It does *not* resolve cold-vs-warm: `.nx/workspace-data` currently holds 18 entries, so this box is
**WARM right now**, which is exactly why D-06's warm capture must be taken before the reset.

## TEST-08 / D-12 -- the task-graph assertion, concretely

CONTEXT.md's open question 6. `capture-hashes.mjs`'s existing call site (`captureTargets`) is:

```js
// capture-hashes.mjs, captureTargets -- the EXISTING shape, per-target
const taskGraph = createTaskGraph(projectGraph, {}, [PROJECT], [target], undefined, {});
const taskId = `${PROJECT}:${target}`;
if (!taskGraph.tasks[taskId]) {
  throw new Error(`... Available: ${Object.keys(taskGraph.tasks).join(', ')}`);
}
```

Positional signature confirmed in use: `(projectGraph, extraTargetDependencies, projectNames,
targets, configuration, overrides)`. The file already carries the measured pitfall that passing
`nxJson.targetDefaults` as arg 2 throws `flatMap is not a function` -- keep `{}`.

**The Windows leg's actual command is `npm run integration` = `nx run-many -t integration`.** In a
single-project workspace `run-many` over all projects is `[PROJECT]`, so the corresponding call is
the existing one with `targets = ['integration']`. The extension is therefore *not* a new call
shape -- it is emitting a value the current code only uses on its throw path:

```js
// The new mode, in full: resolve, emit the SET, assert absence over it.
const FORBIDDEN = ['build', 'typecheck', 'test'];

function resolvedTaskIds(projectGraph, targets) {
  const taskGraph = createTaskGraph(projectGraph, {}, [PROJECT], targets, undefined, {});
  return Object.keys(taskGraph.tasks).sort();
}

const actual = resolvedTaskIds(projectGraph, ['integration']);   // the Windows leg's command
const control = resolvedTaskIds(projectGraph, ['typecheck']);    // the NEGATIVE control
```

**Assertion (the premise):** `actual` contains no task whose target segment is in `FORBIDDEN`.
Split on the **last** `:` and compare the target segment -- do not substring-match the task id. The
project is scoped (`@op-nx/github-cache`, confirmed from the live `run.json`), so task ids contain
*two* colons' worth of structure; and a future `@op-nx/github-cache:build-deps` would false-positive
a naive `includes('build')`.

**Negative control (D-13), and it must be `typecheck`, not `test`.** This is the one place where
CONTEXT.md's parenthetical example is weaker than the alternative:
- `nx run-many -t test`: `test` declares `dependsOn: ["^build"]` (`nx.json:49`). `^` means
  *dependencies'* `build`, and this is a single-project workspace, so it resolves to **zero extra
  tasks**. The set is `{@op-nx/github-cache:test}`. This proves the resolver returns *something*,
  which clears bare vacuity -- but it does **not** prove the resolver expands `dependsOn` at all.
- `nx run-many -t typecheck`: `typecheck` carries an **inferred** `dependsOn: ["build",
  "^typecheck"]`, so the set is `{@op-nx/github-cache:build, @op-nx/github-cache:typecheck}` -- two
  tasks, one of them a **member of `FORBIDDEN`**.

**The inferred dependency is VERIFIED in source, not merely cited.**
`@nx/js/dist/src/plugins/typescript/plugin.js:281-293`:
```js
const dependsOn = [`^${targetName}`];                    // '^typecheck'
if (options.build && targets[options.build.targetName]) {
  dependsOn.unshift(options.build.targetName);           // -> ['build', '^typecheck']
} else if (options.build) { /* ...infers it from tsconfig.lib.json + package.json... */ }
```
`nx.json:19-24` supplies `options.build` (`targetName: 'build'`, `configName: 'tsconfig.lib.json'`),
so the branch fires. Un-prefixed `build` is *this* project's build. This also independently confirms
`ci.yml:514-517`'s measured record and TEST-08's own caveat that "the `typecheck` job already touches
the `build` hash as a dependency". [VERIFIED: `@nx/js` installed source]

The `typecheck` control is therefore strictly stronger: it demonstrates that this resolver *does* put
a `FORBIDDEN` task into a set when the graph calls for one, which is precisely what makes the absence
over the `integration` set meaningful. Assert the two-element expectation explicitly -- it is a
property of the *resolved graph*, not of `nx.json`, which is exactly TEST-08's own distinction, and
asserting it means an Nx upgrade that changes the inference fails loud instead of quietly weakening
the control.

**Belt and braces, cheap:** assert `control` is non-empty AND intersects `FORBIDDEN` AND that
`actual` and `control` differ. A resolver returning `{}` fails all three.

**Evidence capture (TEST-08's own words -- output captured, not discarded):** emit both sets and the
verdict as JSON to stdout and transcribe into `11-EVIDENCE.md`. Reuse the existing `--out` plumbing
rather than adding a second output channel.

**Hash-neutral, confirmed:** editing `capture-hashes.mjs` rotates nothing (D-10 row 4, re-derived
below), so this task may precede the perishable local proof exactly as D-11 orders it.

## D-10 -- the rotation table, independently re-derived. All four rows CORRECT.

CONTEXT.md's open question 5. Re-derived from `nx.json` read in full this session, not trusted.
`namedInputs.default = ["{projectRoot}/**/*", "sharedGlobals"]`;
`sharedGlobals = ["{workspaceRoot}/tsconfig.base.json"]` -- that single file, nothing else.

| Edit | `build` | `typecheck` | `test` | `integration` | `lint` | D-10 says |
|---|---|---|---|---|---|---|
| `.github/workflows/ci.yml` | no | no | **YES** | no | no | `test` only -- **CORRECT** |
| new non-`src` file under `packages/github-cache/` | no | **YES** | **YES** | **YES** | YES | 3 targets -- **CORRECT** |
| new non-spec `.ts` under `packages/github-cache/src/` | **YES** | **YES** | **YES** | **YES** | YES | +`build` -- **CORRECT** |
| new root-level `.mjs` | no | no | no | no | no | nothing -- **CORRECT** |

Derivation, per row:

- **`ci.yml`:** appears as `{workspaceRoot}/.github/workflows/ci.yml` in `test`'s input list
  (`nx.json:69`) and **nowhere else**. `integration`'s list is `default` + `^production` +
  tsconfig filesets + `externalDependencies: [vitest]` + `dependentTasksOutputFiles` + the runtime
  discriminator -- no workspace-root workflow entry. `build`'s list is fully explicit and contains
  none. `typecheck` and `lint` reach the workspace root only via `sharedGlobals`
  (= `tsconfig.base.json`). CONFIRMED.
- **new file under the project root, not under `src/`:** `test`/`typecheck`/`integration`/`lint` all
  start from `default` = `{projectRoot}/**/*`, so all four rotate. `build`'s only `{projectRoot}`
  entries are `package.json`, `tsconfig.lib.json`, `src/**/*.ts`, and a `{projectRoot}/**/*.{d.ts,
  d.cts,d.mts}` fileset carrying `dependencies: true` (= dependencies' roots, zero here). So `build`
  does NOT rotate. CONFIRMED.
- **new non-spec `.ts` under `src/`:** matches `build`'s `{projectRoot}/src/**/*.ts` and survives its
  `!...spec.ts` / `!...test.ts` exclusions (`nx.json:110-122`). CONFIRMED.
- **new root-level `.mjs`:** every workspace-root input in the file is an explicit path
  (`SECURITY.md`, `LICENSE`, `package.json`, `nx.json`, `eslint.config.mjs`,
  `tools/eslint-rules/**/*`, `start-cache-server/action.yml`, `start-cache-server/entry.ts`,
  `README.md`, four `docs/*.md`, two `docs/examples/*`, both workflow files, `.gitattributes`,
  `ppe/action.yml`, `tsconfig.json` json-fields, `tsconfig.base.json`). There is **no**
  `{workspaceRoot}/*.mjs` glob anywhere. A new root `.mjs` matches nothing. CONFIRMED, and this is
  what makes D-12's instrument hash-neutral.

**Two ADDITIONS the plan needs, both consequences of the same derivation:**

- **A new or edited `.spec.ts` under `src/` rotates `test`, `typecheck`, `integration` and `lint`
  but NOT `build`.** `build` excludes `src/**/*.spec.ts` explicitly (`nx.json:116`); the other four
  reach it through unfiltered `default` (`typecheck` uses `default`, *not* `production`, so the spec
  exclusions in `production` never apply to it). **This is the exact cost of D-19's
  `docs-same-os-claims.spec.ts` extension: three of the four proof targets.** D-10 row 2 already
  covers it correctly -- flagged only so nobody reasons "it's just a spec, `build` is excluded,
  therefore cheap."
- **Editing root `package.json` rotates `test`** -- `{workspaceRoot}/package.json` is a `test` input
  (`nx.json:55`). So adding an npm script for D-12's new mode, or any dependency, costs the `test`
  hash. Prefer a flag on the existing `capture:hashes` script over a new script entry; if a new
  script is genuinely wanted, it lands in wave 2 with the `ci.yml` edits, never before the local
  proofs.

No error found in D-10. The plan order it forces (D-11) stands.

## D-06 -- cold vs warm: NOT settleable from the record. Live pre-flight required.

CONTEXT.md's open question 1. Verdict: **the record cannot answer it, and the plan must measure it.**
Saying so plainly, as instructed.

Why it cannot be settled from the artifacts:

1. **`capture-hashes.mjs` has no graph-state flag, deliberately.** `measureGraphState()` derives
   `graphState` from `readdirSync(workspaceDataDirectory).length === 0 ? 'cold' : 'warm'`, with
   `graphStateBasis: 'workspaceDataEntries'`. The header states there is deliberately no CLI flag,
   because `nx reset --onlyWorkspaceData` can EPERM on Windows while the daemon holds the SQLite
   file open, leaving a warm graph behind a record claiming cold. So the state is **measured, not
   selected** -- you cannot re-derive a cold number from a warm box without actually clearing
   `.nx/workspace-data`. [VERIFIED: `capture-hashes.mjs:157-195`]
2. **Producing the cold state requires clearing `.nx/workspace-data`, which this research is
   forbidden from doing** (the safety brief bars `nx reset` and anything that deletes `.nx/cache`;
   `nx reset` clears both directories). So the cold half of the comparison is not measurable here
   without destroying the perishable window.
3. **The one indirect signal points the right way but is not proof.** The four hashes in D-02's table
   are the *same values* the CI legs saved (`17269409342684722256`, `122473981802582055`,
   `11681410932071446589` all appear as Actions cache keys from run `30471772954`, and
   `8137422034373911537` likewise). CI runners are cold by construction -- fresh checkout, no
   `.nx/workspace-data`. So the mirrored hashes ARE cold-graph hashes, and D-02's local capture
   agrees with them. That is consistent with post-08-05 cold/warm agreement, but it does not
   *establish* it: D-02's own graph state is unrecorded, and agreement could also mean D-02 was
   itself cold. [VERIFIED: REST API cross-reference; inference marked as such]

**Exact commands the plan should run, in this order, as the D-06 pre-flight.** These are D-05's
harness with one extra capture bolted on the front, so they cost the plan almost nothing:

```bash
# 1. WARM capture -- run this FIRST, on the box as it stands. Irrecoverable once reset.
npm run capture:hashes -- --install-mode ci --out .planning/phases/11-live-proofs-o1-o2-o3/11-hashes-warm.json
# Confirm the record's own verdict is warm:  jq -r '.meta.graphState, .meta.workspaceDataEntries' <that file>

# 2. The TEST-10 reset. Order is D-05's: reset FIRST, sidecar after.
npx nx reset

# 3. COLD capture -- BEFORE starting the sidecar and BEFORE any nx run-many.
npm run capture:hashes -- --install-mode ci --out .planning/phases/11-live-proofs-o1-o2-o3/11-hashes-cold.json
# Confirm:  jq -r '.meta.graphState' <that file>   ->  must read "cold"

# 4. Cross-check each state's four hashes against the warm mirror before proving anything.
```

Two hazards to encode in the plan:

- **Step 3 must precede the sidecar start and the first `nx run-many`.** `capture-hashes.mjs`'s own
  static import of `nx/src/project-graph/project-graph.js` populates the *native file cache* (which
  is why `graphStateBasis` is workspace-data-only), but a real `nx` invocation populates
  `.nx/workspace-data` and flips the box to warm irreversibly for this window. One shot at the cold
  number.
- **Step 1 is the only chance at the warm number.** If the plan skips it and the cold proof MISSes,
  D-07's finding cannot distinguish "cold != warm" from "the mirror is stale" -- the exact
  ambiguity D-06 exists to remove.

If cold == warm on all four: D-06 is discharged, PARITY-04's post-08-05 status is answered NO->YES
as a by-product (record it as a FINDING, do not promote it to a proof -- PARITY-04 stays out of
scope per CONTEXT.md's deferred list). If they differ: D-07 fires, and the finding is recorded rather
than absorbed.

## D-21 -- `ACTIONS_STEP_DEBUG`: surface CONFIRMED, plus a precedence trap and a better check

CONTEXT.md's open question 3. Fetched from the authoritative page (the `docs.github.com` WebFetch
block is real -- reached via `markdown.new`, per the project's fetch fallback chain).

**Documented verbatim:** "To enable step debug logging, set the following **secret or variable** in
the repository that contains the workflow: `ACTIONS_STEP_DEBUG` to `true`. **If both the secret and
variable are set, the value of the secret takes precedence over the variable.**"
[VERIFIED: docs.github.com/en/actions/how-tos/monitor-workflows/enable-debug-logging, fetched 2026-07-29]

So D-21's choice of the **variable** is fully supported, and its auditability advantage is real: a
variable's value is readable via `gh variable list` and the API, so "was debug on for run X" is
answerable after the fact, whereas a secret's value is not. For an evidence-producing run that is the
whole point.

### NEW TRAP the plan must handle: the secret takes precedence over the variable

If a repository **secret** named `ACTIONS_STEP_DEBUG` already exists -- at any value, including
`false` -- it **overrides** the variable D-21 sets. Setting the variable to `true` would then be
silently ineffective, and TEST-08's "restore MISSes log at `core.debug`" clause would go unmet with
no visible signal.

**Mandatory pre-flight, read-only, one command:**
```bash
gh secret list --repo op-nx/github-cache | rg -i 'ACTIONS_STEP_DEBUG'   # must find NOTHING
```
Exit code 1 (genuine no-match) is the pass. Exit 0 means a secret exists and must be dealt with
before the variable is trusted. Not executed in this research (it reads the secret *inventory*, which
is fine, but the finding belongs to the plan's pre-flight where it can be acted on).

### NEW, and better than a log grep: use the `runner.debug` context

The same page: "You can also use the `runner.debug` context to conditionally run steps only when
debug logging is enabled." This gives an **in-run, positively-recorded** confirmation instead of an
after-the-fact grep for `##[debug]`:

```yaml
      - name: Record that step debug logging is active (TEST-08)
        shell: bash
        run: |
          set -euo pipefail
          echo "runner.debug=${{ runner.debug }}"
          if [ "${{ runner.debug }}" != "1" ]; then
            echo "ACTIONS_STEP_DEBUG is NOT active -- restore MISSes will not be logged, so TEST-08's clause is unmet" >&2
            exit 1
          fi
```

This is strictly better than the log grep for three reasons: it fails **during** the proving run
rather than after it (so the run is not wasted); it produces a line that goes straight into
`11-EVIDENCE.md` as the recorded fact; and it is immune to the precedence trap above, because it
observes the *effect* rather than the configuration. **Recommend the plan add this step and treat it
as the check, with the `rg -F '##[debug]'` log sweep as a redundant secondary.**

Caveat to state in the plan: this step must be **removed or made conditional afterwards**, or it
becomes a permanent gate that fails every run once the variable is unset -- which is D-17 sub-lock
2's own lesson (a tripwire that fires on correct work gets disabled). Simplest resolution consistent
with D-19: add it in the same `ci.yml` commit as the other O3 probes and remove it in the phase's
cleanup, or guard it behind `if: ${{ runner.debug == '1' }}`... which is vacuous. **Prefer add-then-remove**,
and pre-register the removal in the plan so it is not forgotten.

### A workflow- or job-level `env:` is NOT an activation surface

The documented surface is repository (or organization/environment) **secrets and variables**. Workflow
`env:` is not listed, and D-21 independently rejects a committed `env:` on drift grounds. Both reasons
stand; do not use `env:`.

### The reversible maintainer action (both timestamps recorded, per D-21)
```bash
# 0. PRE-FLIGHT (read-only): confirm no overriding secret exists.
gh secret list --repo op-nx/github-cache | rg -i 'ACTIONS_STEP_DEBUG'

# 1. ON, immediately before the proving push. Record the timestamp.
gh variable set ACTIONS_STEP_DEBUG --body true --repo op-nx/github-cache
gh variable list --repo op-nx/github-cache | rg -i 'ACTIONS_STEP_DEBUG'   # confirm it took

# 2. OFF, immediately after the run completes and the log is captured. Record the timestamp.
gh variable delete ACTIONS_STEP_DEBUG --repo op-nx/github-cache
gh variable list --repo op-nx/github-cache | rg -i 'ACTIONS_STEP_DEBUG'   # confirm it is gone
```
Steps 1 and 2 are WRITE operations and therefore outside this research's read-only mandate --
**NOT executed here**, stated for the plan.

**Do not conflate `ACTIONS_STEP_DEBUG` with `ACTIONS_RUNNER_DEBUG`.** The latter is a separate knob on
the same page for *runner diagnostic* logging (runner/worker process log files added to the log
archive). TEST-08 needs step debug logging only. Setting the runner one buys nothing here and adds a
second thing to unset.

**Also documented, and deliberately NOT used:** debug logging can be enabled for a workflow
**re-run** by anyone who can run the workflow. That path is unavailable to this phase anyway -- D-20
uses a fresh push, and a re-run at the same commit would make the Windows `integration` task HIT its
own prior entry, which is exactly the condition D-17 sub-lock 2 exists to keep out of a gate.

## O3 witness -- endpoints, scopes, permissions

CONTEXT.md's open question 4.

| Endpoint | Purpose | Required scope |
|---|---|---|
| `GET /repos/{owner}/{repo}/actions/caches` | `created_at` of `nx-cache-<H_linux>` | `actions: read` |
| `GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs` | `started_at` of the Windows `integration` step | `actions: read` |

Both are `actions: read`. Neither needs `actions: write` (that is the DELETE verb, which this phase
never uses). `contents: read` is needed independently for `actions/checkout` and
`actions/download-artifact`.

**The job-level `permissions` block, and the trap.** `ci.yml`'s workflow-level grant is
`permissions: contents: read` (`ci.yml:9-10`). A job-level block **replaces** it wholesale rather
than merging, so the witness must restate `contents: read`:

```yaml
  o3-witness:
    needs: integration
    if: ${{ !cancelled() }}
    runs-on: ubuntu-24.04-arm
    permissions:
      contents: read   # RESTATED -- a job-level block REPLACES the workflow grant (ci.yml:9-10)
      actions: read    # /actions/caches and /actions/runs/{id}/jobs
```

The precedent is the `publish` job's block at `ci.yml:1092`, and the trap is documented in prose
inside `ci.yml` itself (the `hash-parity` comment at `:495-498` records it as the reason that job
deliberately carries **no** job-level block). Both readings are consistent: add a block only when you
need a scope the workflow grant lacks, and then restate everything you still need.
[VERIFIED: `ci.yml` structure, this session]

**`GITHUB_TOKEN` is the right credential** -- no PAT, no new secret. Pass it as
`${{ secrets.GITHUB_TOKEN }}` into the step `env:` and send it as
`Authorization: Bearer ${GITHUB_TOKEN}`. This adds no new credential to the THREAT-MODEL ledger,
consistent with CONTEXT.md's note that C16/C2 are untouched.

**Tooling:** `curl` + `jq`, both runner-provided on `ubuntu-24.04-arm`. `gh` is not used, per D-17
sub-lock 4. Re-confirmed this session:
`git grep -nE "gh (api|auth|run|variable|secret) " -- .github/workflows/` returns exactly **one**
hit, `ci.yml:558`, and it is inside a **comment** (a note recording a one-off manual
`gh api .../pulls/9` cross-check). So there is still **zero** `gh` invocation in any workflow, exactly
as CONTEXT.md measured. Positive control for that sweep: `git grep -c "curl" -- .github/workflows/ci.yml`
returns 10, so the search surface is live and the single-hit result is a real reading rather than a
false zero. Because the witness is ubuntu-only, the `windows-11-arm` `gh`-availability question never
arises at all.

## Common Pitfalls

### Pitfall 1: `ci.yml:574-577` is STALE and asserts the OPPOSITE of current fact
**What goes wrong:** that comment reads "`ci.yml` is NOT in nx.json's `test` inputs (only
cleanup.yml is, nx.json:68), so a spec asserting on this file's content would serve a stale cached
PASS; registering it is PARITY-08, deferred to Phase 9."
**Why it is wrong now:** PARITY-08 landed. `nx.json:69` is `"{workspaceRoot}/.github/workflows/ci.yml"`,
sitting directly below the `cleanup.yml` entry at `:68`. Both are `test` inputs.
**Consequence if believed:** a planner or executor reading it concludes D-19's `ci.yml` content
guard cannot work -- when in fact D-19 depends on the registration having landed, and it has.
**How to avoid:** derive the input membership from `nx.json` directly, never from the comment. Fixing
the comment is a `ci.yml` edit and therefore rotates `test` (D-10 row 1) -- so if the plan touches
it, it lands in wave 2 with the other `ci.yml` work, not before the local proofs.
[VERIFIED: `nx.json:68-69` vs `ci.yml:574-577`, this session]

### Pitfall 2: `?key=` prefix matching produces a false existence pass
Covered under U-01 mechanic 1 and Pattern 2. Restated here because it is the single most likely way
the witness ships subtly broken: it would *pass* on the happy path and only be wrong in the case it
exists to detect.

### Pitfall 3: `jq -r` prints the literal string `null` for a missing field
`[ -z "null" ]` is false, so a naive `if [ -z "$x" ]` guard passes on absence. Use `// empty`.
Same failure family as D-13's vacuity trap, in a different language.

### Pitfall 4: the negative control that proves nothing
`nx run-many -t test` resolves exactly one task in this single-project workspace, because `test`'s
`dependsOn` is `^build` (dependencies' build, of which there are none). It clears bare vacuity but
does not demonstrate `dependsOn` expansion. Use `typecheck` (inferred `["build", "^typecheck"]`).
See the TEST-08 section.

### Pitfall 5: `.nx/cache/run.json` is overwritten by the next `nx` invocation
Already in CONTEXT.md's code_context, restated because D-17 step (b) is where it bites: the read must
be the *immediately next* step after `npm run integration`, before any other `nx` call. Do not put a
convenience `nx` command between them.

### Pitfall 6: the step name in the `jobs` payload is the rendered name
`- run: npm run integration` renders as `Run npm run integration`. Adding a `name:` changes the
selector. Give the step an explicit `name:` and match that literal; assert the extracted `started_at`
is non-empty so a rename fails loud.

### Pitfall 7: the perishable window and this phase's own edits
D-03's window closes ~2026-08-28; D-10 says a single new file under `packages/` rotates three of the
four hashes. Combined: an out-of-order plan can destroy its own proof. This is why D-11's ordering is
`depends_on` frontmatter and not prose.

### Pitfall 8: `start-cache-server` steps report `conclusion: cancelled`
Observed in every run: the background sidecar step's conclusion is `cancelled` (it is killed by the
`- cancel: cache-server` step), while the job conclusion is `success`. Do not read that as a fault
when transcribing job metadata into evidence. [VERIFIED: REST API, run `30471772954`]

## Code Examples

### Reading the leg's own hash and cache status from `run.json` (D-17 step b)

Field names VERIFIED against the live file and the Nx source (see the `run.json` section). Prefer a
small `.mjs` in the scratch dir over an inline `node -e` -- the project's shell rules warn that
backticks and `$` inside a double-quoted `-e` are eaten by bash before node sees them, and this
script needs neither, but the guard-heavy version below is past one-liner length anyway.

```js
// read-integration-hash.mjs -- run IMMEDIATELY after `npm run integration`, no nx call between.
import { readFileSync, writeFileSync } from 'node:fs';

const run = JSON.parse(readFileSync('.nx/cache/run.json', 'utf8'));

// Guard 1: run.json is overwritten by every nx invocation, and it self-documents its command.
if (!run.run?.command?.includes('integration')) {
  throw new Error(`run.json is from a different command: ${run.run?.command}`);
}

const task = run.tasks?.find((t) => t.target === 'integration');

// Guard 2: absence must THROW. Nx writes run.json inside a try/catch that swallows every
// error unless NX_VERBOSE_LOGGING, so a missing file or task is otherwise SILENT.
if (!task) {
  throw new Error(
    `no integration task in run.json -- present: ${(run.tasks ?? []).map((t) => t.target).join(', ')}`,
  );
}

writeFileSync('integration-hash.txt', task.hash);
// The structured corroborator: 'remote-cache-hit' | 'local-cache-hit' | 'cache-miss'.
console.log(`integration hash=${task.hash} cacheStatus=${task.cacheStatus} status=${task.status}`);
```

The throw-on-absent shape mirrors `capture-hashes.mjs:292` and is mandatory: an empty hash file must
fail the leg, not upload an empty artifact (`if-no-files-found: error` covers the upload half only).
Printing `cacheStatus` here is what feeds D-17(a)'s RECORDED observation and O1/O2's structured
corroborator in one line, at no extra cost.

### The witness comparison
```bash
# Source: measured field precisions, 2026-07-29. floor() the sub-second cache timestamp.
created_epoch=$(date -u -d "${created}" +%s)
started_epoch=$(date -u -d "${started}" +%s)
delta=$(( started_epoch - created_epoch ))
echo "o3-witness: created_at(${key})=${created} started_at(win integration)=${started} delta=${delta}s"
if [ "${delta}" -lt 30 ]; then
  echo "o3-witness: FAIL -- H_linux entry was not demonstrably present >=30s before the Windows task started" >&2
  exit 1
fi
```
`date -u -d` parses the sub-second ISO form and truncates to seconds -- that IS the floor. Observed
deltas were 122-182 s, so the 30 s floor has ~4x headroom.

### The positive control (D-16), distinct from the readiness poll
```bash
# Source: extends ci.yml's readiness-poll shape. Acceptance set is {200} ONLY -- not {404,200}.
auth="Authorization: Bearer ${NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN}"
own_hash="$(cat integration-hash.txt)"
code=$(curl -s --max-time 10 -o /dev/null -w '%{http_code}' -H "${auth}" \
  "${NX_SELF_HOSTED_REMOTE_CACHE_SERVER}/v1/cache/${own_hash}")
echo "positive control: GET /v1/cache/${own_hash} -> ${code} (want 200)"
if [ "${code}" != "200" ]; then
  echo "positive control FAILED (${code}) -- the sidecar/backend was not proven alive, so the MISS observation is not evidence" >&2
  exit 1
fi
```

## Runtime State Inventory

Not a rename/refactor/migration phase -- but this phase has an unusual amount of *perishable
external state*, so the categories are answered anyway rather than omitted.

| Category | Items Found | Action Required |
|---|---|---|
| Stored data | Actions cache: 142 entries, incl. the four D-02 hashes under `refs/heads/main`. Releases mirror: `cache-mirror-202607` shard, 16 new-form assets created 2026-07-29T16:44Z | READ ONLY. Window closes ~2026-08-28 (D-03). No migration |
| Live service config | Repository *variable* `ACTIONS_STEP_DEBUG` must be set ON then OFF for the proving run (D-21). Not in git; a maintainer settings action with both timestamps recorded | Maintainer action, reversible, recorded |
| OS-registered state | None -- verified: no scheduled task, service or launch agent is involved; `cleanup.yml` runs on GitHub's `schedule` and is untouched by this phase | none |
| Secrets/env vars | `secrets.GITHUB_TOKEN` only, already granted; the sidecar's `NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN` is generated per-job by the existing pre-set step. **No new secret and no new credential** -- THREAT-MODEL C16/C2 untouched | none |
| Build artifacts | `.nx/cache` and `.nx/workspace-data` are DELIBERATELY destroyed by TEST-10's `nx reset` -- that is the instrument, not a side effect. `packages/github-cache/dist/lib/trust.js` **survives** the reset (verified in source) and exists on the box right now | none -- `dist/` needs no rebuild for D-08 |

**The `dist/` row was the one easy-to-miss item, and it is now RESOLVED in the safe direction.** D-08
requires reading `isWriteTrusted(process.env).trusted` from the **built** `dist/lib/trust.js`, and
TEST-10 requires the probe's timestamp to *precede* the first Nx run -- so `dist/` must already exist
after the reset and before any build. It does: `nx/dist/src/command-line/reset/reset.js` `rmSync`s
exactly the daemon dir, the cloud client dir, `cacheDir` (`.nx/cache`),
`getNativeFileCacheLocation()`, `workspaceDataDirectory` (`.nx/workspace-data`) and a shared
workspace-data dir. `packages/github-cache/dist/` is a task *output* directory outside `.nx/` and is
never touched. `dist/lib/trust.js` is present on the box today. [VERIFIED: nx 23.1.0 source + `ls`]

**Sequence the plan can rely on:** warm capture -> `nx reset` -> cold capture -> D-08 soundness probe
(reads the surviving `dist/`, timestamp recorded as PRECEDING) -> start sidecar -> `nx run-many` (where
`build`/`typecheck`/`test` HIT or run) -> read `run.json` -> count labels. No rebuild step is needed
and none should be inserted -- a rebuild before the measurement would populate outputs that
`typecheck`'s `dependentTasksOutputFiles` input hashes, and TEST-10's whole point is to measure the
cold box.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| `mirrored-by: <os>` reads as the producing OS | It reads as the *mirroring* leg's OS; a Linux publish leg stamps `linux` on a Windows-produced entry | Phase 9 (`enableCrossOsArchive`) + Phase 10 (observed live) | D-14; attribution needs the other three means |
| Storage probe for `nx-cache-<H_linux>` from Windows proves O3 | It would now HIT. O3 is an Nx-**hash** property | Phase 9 (VER-01/VER-03 removed the OS salt) | TEST-09; a 404 assertion would assert a destroyed property |
| `ci.yml` is not an Nx `test` input | It IS (`nx.json:69`) | Phase 9 (PARITY-08) | Enables D-19's content guard; `ci.yml:574-577` still says otherwise |
| Cache entries partitioned by OS in the version | OS-invariant version | Phase 9 | Sibling-leg entries are mutually visible and mutually restorable -- which is what makes U-01's post-hoc method possible at all |

**Deprecated/outdated in-tree:**
- `ci.yml:574-577`'s `test`-inputs claim (Pitfall 1).
- `.planning/codebase/*` -- mapped 2026-07-22 against v0.0.1; conventions only, never facts.

## Project Constraints (from CLAUDE.md / AGENTS.md)

| Directive | Bearing on this phase |
|---|---|
| Run tasks through `nx` (`npm exec nx` / package-manager-prefixed), not underlying tooling | The proof harness uses `npm run integration` / `nx run-many` -- already compliant, and it must stay so because the *proof* is about Nx's own labels |
| Never use the Grep tool or `grep`; `git grep` for tracked, `rg` for gitignored/untracked; pipe filtering via `rg` | Every absence assertion in this phase (the `[remote cache]` label sweep, the `gh`-CLI check) must use `rg`. `git grep` false-zeroes on untracked paths, and `.nx/` is gitignored -- so any assertion over a tee'd log or `run.json` MUST use `rg` |
| `rg -c` counts LINES, not occurrences | OBS-02 wants a COUNT of tasks carrying the label. Use `rg -o '\[remote cache\]' \| wc -l`, or better, count per-target lines and name each target |
| `rg` pattern is a regex unless `-F` | `[remote cache]` is a character class as written. Use `-F '[remote cache]'` or escape the brackets |
| Never write multi-line content via heredoc/echo; use the Write tool | Applies to `11-EVIDENCE.md` authoring |
| No emojis / non-ASCII in any output | `11-EVIDENCE.md` and every new `ci.yml` comment |
| `git commit -F <file>`, not `-m`, on this D: (ReFS) drive | Every commit in this phase |
| GSD workflow enforcement -- no direct edits outside a GSD workflow | The plan is the entry point |
| No AI attribution in commits | Every commit |
| Never `git add .` / `-A` / `-u`; stage by name | Every commit |

**One CLAUDE.md/AGENTS.md item with direct architectural bearing:** the worktree guidance says a plan
that edits `package.json`/lockfile must not share the main tree's `node_modules`. This phase should
edit neither (see Package Legitimacy Audit), which keeps worktree isolation cheap if the planner
wants parallel waves. It also means `check:action` bundle-drift false positives from a junctioned
`node_modules` are avoidable by keeping any `ci.yml`/bundle work on the main tree.

## Validation Architecture

### Test Framework
| Property | Value |
|---|---|
| Framework | Vitest via `@nx/vitest` (plugin-inferred `test` target, `nx.json:28-32`) |
| Config file | `packages/github-cache/vitest.config.*` (project-scoped); root `nx.includedScripts: []` |
| Quick run command | `npm exec nx test github-cache` |
| Full suite command | `npm exec nx run-many -t test typecheck build lint` |

**This phase is proof-led, and most of its success criteria are NOT unit-testable by construction.**
Saying so explicitly, because the temptation is to manufacture a spec per requirement and every such
spec costs the perishable window (D-10). The honest mapping:

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|---|---|---|---|---|
| XOS-01 | Local Windows HIT on `build`/`typecheck`/`test` from Linux artifacts | manual-only (live, one-shot, perishable) | -- (captured terminal output in `11-EVIDENCE.md`) | N/A -- see justification |
| XOS-02 | Local Windows HIT on `integration` from Windows artifacts | manual-only (live, one-shot) | -- (captured terminal output) | N/A |
| XOS-03 | Windows CI MISSes the Linux `integration` hash | CI gate (live) | the `o3-witness` job's own `exit 1` | [NEW] Wave 2 -- new job in `ci.yml` |
| TEST-08 | Graph premise asserted mechanically against the resolved graph | unit-ish, runs as a script; output captured | `node capture-hashes.mjs <new-mode-flag>` | [NEW] Wave 1 -- new mode on existing file |
| TEST-08 | Producer attribution captured at proof time | manual-only (REST capture, transcribed) | -- | N/A |
| TEST-09(3) | Positive control returns 200 in the same job | CI gate (live) | the control step's own `exit 1` | [NEW] Wave 2 -- new step in `integration` |
| TEST-10 | Reset precedes sidecar; soundness probe precedes first Nx run | manual-only (ordering of a one-shot session) | -- (timestamps in `11-EVIDENCE.md`) | N/A |
| OBS-02 | Non-zero `[remote cache]` count, named per target | manual-only, but the *count* is pre-registered in the PLAN (D-23) | -- | N/A |

**Why the manual-only rows are legitimate and not a coverage gap.** Each names a live one-shot
observation on a real Windows workstation or a real runner against a mirror that expires
~2026-08-28. There is no fixture that could stand in without the substitution destroying the
requirement (TEST-10 is explicit: a HIT without a preceding reset is not accepted). The mechanical
half of each requirement -- the part a machine CAN check -- is exactly what TEST-08's graph
assertion, the witness job and the positive control are, and all three are automated and fail loud.

### Sampling Rate
- **Per task commit:** `npm exec nx test github-cache` (unchanged; the phase adds no spec in wave 1)
- **Per wave merge:** `npm exec nx run-many -t test typecheck build lint`
- **Phase gate:** full suite green + the `o3-witness` job green on the proving run, before
  `/gsd:verify-work`
- **CRITICAL, and it is a real hazard here:** the `o3-witness` job is a **new inferred-nothing job**
  in `ci.yml`. `nx run-many` on a missing target exits 0 (recorded project trap), and by the same
  logic a deleted CI *job* is a silently removable gate. The plan should assert the witness job's
  presence by content -- extend `docs-same-os-claims.spec.ts`'s phrase-keyed pattern (D-19) with a
  literal from the witness job -- **and that spec edit lands in wave 2 or later**, because it rotates
  `test`/`typecheck`/`integration` (D-10 row 2).

### Wave 0 Gaps
None. Existing test infrastructure covers everything this phase can automate; the two automatable
instruments (D-12's mode, the `ci.yml` probes) are the phase's own deliverables, not test-harness
gaps. No `conftest`/fixture work and no framework install.

## Security Domain

`security_enforcement` is not disabled in `.planning/config.json` as far as this research
determined, so the section is included. **This phase adds no write path, no new credential and no new
network egress**, which is what makes it short.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---|---|---|
| V2 Authentication | no | no new authn surface; `GITHUB_TOKEN` is the existing runner credential |
| V3 Session Management | no | no sessions |
| V4 Access Control | **yes** | least-privilege job `permissions`: `contents: read` + `actions: read`, nothing more. `actions: write` is NOT requested (that is the cache DELETE verb) |
| V5 Input Validation | **yes** | the witness parses REST JSON. Validate: exact `.key` equality (not prefix), non-empty `created_at`/`started_at`, and numeric delta. A missing field must `exit 1`, never compare against an empty string |
| V6 Cryptography | no | none introduced; the sidecar's per-job token is generated by the existing `crypto.randomBytes(32)` step |
| V7 Error Handling / Logging | **yes** | fail-loud on every probe; do NOT `continue-on-error`. The sidecar token is already `::add-mask::`ed by the existing pre-set step -- any new step that echoes env must not defeat that |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---|---|---|
| Job-level `permissions` block silently DROPS a scope by replacing the workflow grant | Elevation / DoS-by-omission | Restate `contents: read`; the `publish` job (`ci.yml:1092`) is the precedent and `hash-parity` (`:495-498`) documents the trap |
| Prefix-matching `?key=` filter accepted as an existence proof | Spoofing (a different entry satisfies the check) | exact `.key` string equality |
| Secret leakage into an evidence artifact | Information disclosure | `11-EVIDENCE.md` records only named fields -- hashes, timestamps, run URLs, HTTP codes. **Never** paste a raw `gh api`/`curl` payload: those carry uploader identities, node ids and signed URLs, and this is a PUBLIC repo. No email address in any artifact |
| `ACTIONS_STEP_DEBUG` left ON after the proving run | Information disclosure (debug logs in every future public run) | D-21's explicit unset with both timestamps recorded; verify with `gh variable list` |
| A probe that degrades to a pass on fault | Repudiation / false evidence | Every new probe `exit 1`s on an unexpected code. The read path is best-effort by design (`SRV-05`), which is exactly why D-08's control table is mandatory rather than optional |

**One genuine, non-obvious residual worth stating for the security auditor.** The `o3-witness` job
runs on `pull_request` events too (it has no push gate unless the plan adds one, matching
`integration`, which `ci.yml`'s job inventory confirms is not push-gated). On a `pull_request` from a
fork, `GITHUB_TOKEN` is read-only and `actions: read` should still resolve, but the witness would
compare a merge-commit tree's hashes -- D-17 sub-lock 1's commensurability concern in a different
guise. The safe posture: let the witness run on PRs (it is read-only and fails loud, which is useful
rehearsal signal), but record the O3 proof **only** from the push run, per D-20.

## Assumptions Log

**All five assumptions this research opened were CLOSED before it finished** -- four in
version-matched source, one against the authoritative GitHub docs page. This table is retained as a
record of what was checked, not as a list of open risks.

| # | Claim | Section | Status |
|---|---|---|---|
| A1 | `typecheck` carries an inferred `dependsOn: ["build", "^typecheck"]` | TEST-08 / D-12 | **RESOLVED -- VERIFIED in source.** `@nx/js/dist/src/plugins/typescript/plugin.js:281-293`: `const dependsOn = ['^' + targetName]` then `dependsOn.unshift(options.build.targetName)` when a build target is configured or inferable. `nx.json:19-24` configures it. Two tasks resolve, one of them `build` |
| A2 | A repository *variable* `ACTIONS_STEP_DEBUG=true` activates step debug logging | D-21 | **RESOLVED -- VERIFIED, and it surfaced a trap.** Docs state "secret **or** variable", and that **the secret takes precedence when both are set**. Also surfaced the `runner.debug` context as a better in-run check. See the D-21 section |
| A3 | The `run.json` task-record field names | Code Examples | **RESOLVED -- VERIFIED against the live file and the Nx source.** The shape is richer than assumed and yields a structured remote-vs-local cache discriminator |
| A4 | `nx reset` does not delete `packages/github-cache/dist/` | Runtime State Inventory | **RESOLVED -- VERIFIED in source.** `nx/dist/src/command-line/reset/reset.js` `rmSync`s exactly: the daemon dir, the cloud client dir, `cacheDir` (`.nx/cache`), `getNativeFileCacheLocation()`, `workspaceDataDirectory` (`.nx/workspace-data`) and a shared workspace-data dir. `dist/` is a task *output* directory outside `.nx/` and is untouched |
| A5 | `security_enforcement` is not explicitly `false` | Security Domain | **RESOLVED -- VERIFIED.** `.planning/config.json`: `security_enforcement: true`, `security_asvs_level: 1`, `security_block_on: "high"`, `nyquist_validation: true`. Both the Security Domain and Validation Architecture sections are required |

**No `[ASSUMED]` claim survives in this document.** Every factual claim is `[VERIFIED]` (measured or
read in version-matched source this session) or `[CITED]` (an in-repo prior artifact, named). The
planner does not need a `checkpoint:human-verify` for any technical fact here.

The one thing that is *not* a fact and *is* a judgement call, flagged so the planner sees it as such:
whether to add the `runner.debug` guard step (recommended, D-21 section) and how to retire it. That is
a design choice inside Claude's Discretion, not an unresolved fact.

## Open Questions

**None blocking.** Everything CONTEXT.md handed this research is answered, and U-01 -- the item it was
explicitly told it owned -- is answered with measurement rather than argument.

Three items are answered *as instructions to the plan* rather than as settled values, because settling
them here was either impossible or destructive:

1. **D-06's cold hashes.** Not settleable from the record and not measurable here without destroying
   the perishable window (`capture-hashes.mjs` measures graph state rather than accepting it, so a
   cold number requires actually clearing `.nx/workspace-data`). The exact commands are specified in
   the D-06 section, in order, with the two hazards named. The box is currently **WARM** (18
   `.nx/workspace-data` entries), so the warm capture is available and must be taken first.
2. **The `typecheck` negative control's two-element expectation.** Verified in source, but it is a
   property of the *resolved graph*, so the plan asserts it rather than trusting it -- which is
   TEST-08's own distinction and makes an Nx upgrade fail loud.
3. **Whether an `ACTIONS_STEP_DEBUG` repository secret already exists** and would override D-21's
   variable. One read-only command, specified in the D-21 section, belonging to the plan's pre-flight
   where it can be acted on.

**Explicitly NOT open, and it should not be carried forward as a contingency:** U-01's
dedicated-Windows-job fallback. The post-hoc inequality holds with a 109-182 s margin across 11 runs
and a structural cause. Do not plan, cost or reserve the fallback -- keeping a settled question
"just in case" is how it gets re-litigated during execution.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|---|---|---|---|---|
| `gh` CLI (local, for REST reads + the `ACTIONS_STEP_DEBUG` variable) | U-01 measurement, D-21 maintainer action | yes | authenticated against `op-nx/github-cache`; all reads in this document succeeded | `curl` + a PAT |
| GitHub Actions cache REST API | O3 witness | yes | 142 entries readable; `key`/`ref`/`sort`/`direction`/`per_page` params all confirmed working | none needed |
| `curl` on `windows-11-arm` | D-16 positive control | yes | proven by the shipped readiness poll on both legs, 11/11 runs | none needed |
| `curl` + `jq` on `ubuntu-24.04-arm` | `o3-witness` | yes | runner-provided | `node -e` |
| Nx 23.1.0 | D-12 | yes | exact-pinned; `capture-hashes.mjs` already imports `nx/src/*` internals | none -- an import break is the desired loud failure |
| `@actions/cache` 6.2.0 | D-16 reasoning | yes | installed version matches the local clone at `D:\projects\github\actions\toolkit`, so the source read is version-accurate | none |
| Warm Releases mirror (`cache-mirror-202607`, 16 assets) | O1/O2 | yes | created 2026-07-29T16:44Z | **NONE -- expires ~2026-08-28 (D-03)**. Fallback is a re-warming default-branch push (D-07) |
| Native Windows arm64 workstation | O1/O2 | yes | this box (win32/arm64) | none -- TEST-10 names it |
| Local Nx clone for source reads | D-12 verification | partial | working tree at tag `23.0.2`, not `23.1.0` | read via `git show 23.1.0:<path>` in `D:\projects\github\nrwl\nx` |

**Missing dependencies with no fallback:** none blocking. The one hard clock is the mirror's
~2026-08-28 expiry, which is a *schedule* constraint on O1/O2, not a missing dependency -- and D-07
already pre-declares the contingency.

## Sources

### Primary (HIGH confidence -- measured or read this session)
- GitHub REST API over `op-nx/github-cache`, read-only `GET` only:
  `/actions/caches` (with `key`, `ref`, `sort`, `direction`, `per_page` probes),
  `/actions/runs/{id}`, `/actions/runs/{id}/jobs`, `/actions/workflows`, `/actions/runs`.
  Runs read: `30477430909`, `30474554061`, `30473795059`, `30473116345`, `30471772954`,
  `30471172051`, `30409045786`, `30408345764`, `30401077417`, `30400231720`, `30372679674`.
- `nx.json` -- read in full; D-10 re-derived from it.
- `.github/workflows/ci.yml` -- `integration` job, workflow-level `permissions`, job inventory,
  the `hash-parity` comment block, the stale `test`-inputs claim.
- `capture-hashes.mjs` -- header, `measureGraphState`, `captureTargets`, the `createTaskGraph` call
  site and its missing-task throw.
- `packages/github-cache/src/backend/actions-cache-backend.ts` -- the `get`/`put` bodies.
- `packages/github-cache/src/server/server.ts` -- the GET sub-handler's fault-to-404 degradation.
- `@actions/cache@6.2.0` source (`packages/cache/src/cache.ts`) at
  `D:\projects\github\actions\toolkit`, version-matched to the installed dependency.
- `.nx/cache/run.json` on this workstation -- the live task-record shape, the `cacheStatus` field, the
  scoped project name `@op-nx/github-cache`, and the `lint` hash cross-check against D-02.
- `node_modules/nx/dist/src/tasks-runner/life-cycles/store-run-information-life-cycle.js:40-75` --
  the exact `cacheStatus` derivation and the error-swallowing `endCommand` catch arm.
- `node_modules/nx/dist/src/command-line/reset/reset.js` -- the exhaustive `rmSync` list (A4).
- `node_modules/@nx/js/dist/src/plugins/typescript/plugin.js:272-300` -- the inferred `typecheck`
  `dependsOn` branch (A1).
- `.planning/config.json` -- `security_enforcement: true`, `nyquist_validation: true` (A5).

- `docs.github.com/en/actions/how-tos/monitor-workflows/enable-debug-logging` -- the
  `ACTIONS_STEP_DEBUG` secret-or-variable surface, the secret-takes-precedence rule, the
  `runner.debug` context, and the separate `ACTIONS_RUNNER_DEBUG` knob. **Fetched** via
  `markdown.new` (the project's documented fallback chain -- `docs.github.com` blocks WebFetch's
  user agent, so a failed WebFetch there would have been a fetch failure, not a finding).

### Secondary (in-repo priors, CITED not re-derived)
- `.planning/phases/10-.../10-EVIDENCE-LIVE-CI.md` -- D-02's warm-hash table, D-03's clock, D-14's
  publisher-not-producer instance. Cross-checked against the live Actions cache entry list this
  session and found consistent.
- `ci.yml:514-517` -- the inferred `typecheck` -> `build` dependency. Now independently VERIFIED in
  `@nx/js` source, so this citation is corroboration rather than the sole basis.
- `.planning/research/v0.0.2/PROBE-RESULTS.md` -- the `run.json`-overwrite method note (Pitfall 5).

### Tertiary (LOW confidence)
**None.** Every claim in this document reached `[VERIFIED]` or `[CITED]`. Nothing rests on training
knowledge alone.

## Metadata

**Confidence breakdown:**
- **U-01 verdict: HIGH** -- 11 runs, 3 independent cache/step cross-references, a structural cause
  for the margin, and all five `?key=` semantics probes. This is measurement, not argument.
- **`run.json` `cacheStatus`: HIGH** -- read from the live file on this box AND from the exact
  derivation in nx 23.1.0's `store-run-information-life-cycle.js`.
- **D-10 rotation table: HIGH** -- re-derived line-by-line from `nx.json` read in full; all four
  rows confirmed, two additions found.
- **D-16 positive control: HIGH** -- read in version-matched source on both sides of the boundary
  (`@actions/cache@6.2.0`, matching the installed dependency, and this repo's own backend). No local
  short-circuit exists, and the fault path degrades to 404, so a false 200 is impossible.
- **D-12 mechanics: HIGH** -- call shape read from the live call site; the stronger negative
  control's inferred dependency verified in `@nx/js` source (A1 upgraded from ASSUMED).
- **D-21 surface: HIGH** -- fetched from the authoritative page, and it yielded a trap (secret
  precedence) plus a better instrument (`runner.debug`) that reasoning alone would not have found.
- **D-06 cold/warm: intentionally UNSETTLED, with HIGH confidence in *why*** -- `capture-hashes.mjs`
  measures graph state rather than accepting it (source-read), so a cold number requires clearing
  `.nx/workspace-data`, which the safety mandate forbids and which would cost the phase its O1/O2
  proof. Answered as a specified live pre-flight with exact commands and named hazards.
- **Pitfall 1 (stale `ci.yml` comment): HIGH** -- both sides read this session.

**What a reviewer should re-check first if they doubt anything:** the U-01 margin table. Every row is
one `gh api .../jobs` call away from reproduction, and if it were wrong the whole O3 design would need
the fallback. It is not wrong -- but it is the load-bearing measurement, so it is the one worth a
second pair of eyes.

**Research date:** 2026-07-29
**Valid until:** ~2026-08-28 for anything touching the warm mirror (D-03's clock is the binding
constraint, not a doc-staleness estimate). The U-01 margin measurement is valid as long as the
Windows `npm ci` latency differential holds -- and the witness job asserts it rather than assuming
it, so a regression fails loud instead of expiring silently.
