---
phase: 02-default-cache-in-ci
verified: 2026-07-19T13:00:00Z
status: passed
score: 10/10 must-haves verified
behavior_unverified: 0
overrides_applied: 0
re_verification: "resolved 2026-07-19 - the single human_needed item (live cross-job cache HIT) was confirmed on CI"
resolved_items:
  - truth: "This repo's CI runs `serve` against the Actions-cache backend and gets a real, cross-job cache HIT on a default-branch push (ROADMAP SC5)"
    evidence: "CI run 29685631933 (push to origin/main at b9c513d): all 9 jobs green. dogfood-seed logged `github-cache dogfood seed: stored 29685631933 (PUT 200)`; dogfood-verify logged `Cache hit for: nx-cache-29685631933` -> `Cache restored successfully` -> `github-cache dogfood verify: cache HIT for 29685631933 with matching bytes` (bearer token masked as ***). The run also required the lockfile fix from quick task 260719-in3, without which npm ci failed on every job. See 02-UAT.md."
---

# Phase 2: Default Cache in CI Verification Report

**Phase Goal:** The default composition — the Actions-cache CI-RW backend, selected purely by
runtime context, gated by a conservative default-deny write-trust and serialized by a per-hash
lock — is dogfooded live in this repo's CI. First real GitHub cache.

**Verified:** 2026-07-19T13:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

**Note on phase mode:** ROADMAP.md marks Phase 2 `Mode: mvp`, but the ROADMAP "Goal" field itself
is not phrased as a strict `As a ... I want to ... so that ...` User Story (each individual PLAN's
embedded "Phase Goal" section is, verbatim and identically, across all 6 plans). Per the task
instructions this verification checks the 5 ROADMAP Success Criteria directly (the roadmap
contract), which is the correct minimum bar regardless of the goal-field's literal formatting.

Every command below was re-run independently against the live workspace (not copied from
SUMMARY.md claims): `npx nx run-many -t build typecheck test --skip-nx-cache` (fresh, cache
bypassed), `npm run fallow:ci`, `npx nx format:check --all`, `npm run test:act`, and targeted
`git grep` counts against every acceptance-criteria invariant named in the six PLAN.md files.

## Goal Achievement

### Observable Truths (mapped to ROADMAP SC1–SC5)

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | SC1/TEST-01/TRUST-05: `selectBackend(env)` returns the Actions-cache RW backend in trusted CI context and a read-only backend everywhere else, chosen only from runtime context; unit specs cover CI-vs-local, `GITHUB_REPOSITORY` validation, `GH_TOKEN\|\|GITHUB_TOKEN` fallthrough (incl. set-but-empty), malformed-repo rejection, and the explicit `env` param | VERIFIED | `select-backend.ts` reads in full: `isWriteTrusted` gate, fail-closed `GITHUB_REPOSITORY_PATTERN` throw, degrade-not-throw on unresolved token, `createActionsCacheBackend()`/`createReadOnlyMemoryBackend()` factory choice. `select-backend.spec.ts` — 22 tests, all pass (re-run live): push/schedule -> writable; `pull_request`/`pull_request_target`/`issue_comment`/`workflow_run`/`workflow_dispatch`/`release`/unset-event/no-`GITHUB_ACTIONS` -> `forbidden`; malformed/absent `GITHUB_REPOSITORY` -> throws; unresolved token -> degrades (does not throw); `GH_TOKEN`/`GITHUB_TOKEN` fallthrough incl. empty-string case; a "never mutates `process.env`" assertion |
| 2 | TRUST-05 non-vacuous no-mode-surface: no caller-facing parameter, option, or env var can force the writable backend | VERIFIED | Structural: `expect(selectBackend.length).toBe(0)` (single defaulted param). Behavioral: an UNTRUSTED env bag carrying `MODE: 'write'`, `FORCE_WRITABLE: 'true'`, `NX_CACHE_MODE: 'rw'`, `writable: 'true'` etc. still yields `put -> 'forbidden'` — the exact "smuggled flag" failure class this repo's own prior tautological test (01-REVIEW.md WR-01) is guarded against here |
| 3 | SC2/TRUST-03: a conservative default-deny write gate trusts only `push`/`schedule` and refuses every dangerous shared-default-scope event, asserted by test | VERIFIED | `trust.ts`: early-`false` guard on `GITHUB_ACTIONS !== 'true'`, then allowlist membership test. `trust.spec.ts` — 18 tests pass: `push`/`schedule` -> true; 11-entry `REFUSED_EVENTS` table (`pull_request`, `pull_request_target`, `issue_comment`, `workflow_run`, `workflow_dispatch`, `repository_dispatch`, `merge_group`, `release`, `delete`, `registry_package`, `page_build`) all -> false; unset event, non-CI process, `GITHUB_ACTIONS: 'false'`, empty bag all -> false; `TRUSTED_EVENTS` deep-equals `['push','schedule']` (content pin). `git grep -c 'export const TRUSTED_EVENTS'` = 1 (single source of truth, re-verified live) |
| 4 | SC3/TEST-02: `withHashLock` serializes same-hash writes, runs different hashes concurrently, evicts the map entry on settle, and a rejected op does not wedge the lock | VERIFIED | `with-hash-lock.ts`: `.then(run, run)` chaining, non-rejecting `tail` stored + real `result` returned, identity-checked eviction (`inFlight.get(hash) === tail`). `with-hash-lock.spec.ts` — 4 tests, all pass, deterministic via deferred promises + a shared order log (no timers): serialize (B does not start until A's deferred resolves), concurrent (both start before either resolves), evict (`inFlightHashCount()` returns to baseline), no-wedge (a rejected op reaches its own caller; the next same-hash op still runs) |
| 5 | SC4/ROBUST-04: `serve` handles `SIGTERM` by draining in-flight writes before exit, bounded so a hung write cannot deadlock the runner's teardown | VERIFIED (behavioral test present and passing — not presence-only) | `serve.ts`: `process.once('SIGTERM', onSigterm)`, `shutdown()` races `Promise.allSettled([...inFlightPuts])` against an unref'd `setTimeout(graceMs)`, removes its own listener. `serve.spec.ts` "serve SIGTERM drain (ROBUST-04)" — 3 tests, all pass: a gated in-flight PUT's bytes are recorded by the backend AND `shutdown()` resolves only after release; `shutdown()` resolves within a 50ms bounded grace even when the put never settles (a genuinely hung write); the SIGTERM listener count increases by exactly 1 on `serve()` and returns to baseline after `shutdown()`. This is the state-transition/teardown invariant Step 3 calls out as needing a real test, not presence alone — the test exists and passes |
| 6 | SC3 wiring: `serve`'s write path actually routes through `withHashLock` (not just present, but composed) | VERIFIED | `serve.spec.ts` "serve write path is locked per hash (TEST-02 wiring)" — 2 tests, both pass: two PUTs of the SAME hash strictly serialize (`start:aaaaaa, release:1, start:aaaaaa` — non-vacuous exact-order proof); two PUTs of DIFFERENT hashes both start before either is released (would time out otherwise). `git grep -nF 'withHashLock' -- serve.ts` matches |
| 7 | ROBUST-03(a): `@actions/cache`/`@actions/core` pinned exact (bare `x.y.z`), guarded by a committed spec that fails the build on any range widening; a human explicitly approved the install (SUS/`too-new` legitimacy verdict) before it ran | VERIFIED | `package.json`: `"@actions/cache": "6.2.0"`, `"@actions/core": "3.0.1"` (no `^`/`~`). `pinned-deps.spec.ts` — 2 tests pass, asserting `/^\d+\.\d+\.\d+$/` against the live manifest. `02-01-SUMMARY.md` records the explicit human approval (2026-07-19) with the `too-new` verdict surfaced and accepted, plus the registry-verified canonical-org/no-postinstall evidence — this is a genuine recorded human decision, not a rubber stamp |
| 8 | ROBUST-03: a real `CacheBackend` maps `get`->`restoreCache`/`put`->`saveCache` through the exact-pinned toolkit; both call sites resolve through one comment-locked, pinned-file-name `cacheArchivePath(hash)`; the ambiguous `saveCache -1`/`ReserveCacheError` sentinel is a benign no-op while every other rejection propagates; the temp archive is removed on EVERY exit path of both `get` and `put` | VERIFIED | `cache-archive-path.ts` + `cache-archive-path.spec.ts` (3 tests, literal `nx-github-cache-abc123.tar` spelled out, not reconstructed — a genuine non-tautological pin). `actions-cache-backend.ts` + `.spec.ts` — 10 tests, all pass: hit/miss mapping; positive-id/`-1`/`ReserveCacheError`/other-error branches; path+key agreement (`restoreCache`/`saveCache` first arg recorded and compared to each other AND to `cacheArchivePath(hash)`); temp-file cleanup asserted on the `put` success path, the `put` propagating-error path, AND (the WR-01 fix, commits `4d1e580`/`4b5d99c`) the `get` HIT path — closing the code-review-flagged hygiene asymmetry. `git grep -c 'export function cacheArchivePath'` = 1 |
| 9 | Resolved planning decisions honored: no `read-only-backend.ts` module created; `createActionsCacheBackend()` takes zero parameters (no mode argument, TRUST-05); no dual `TRUSTED_EVENTS` copy | VERIFIED | `ls packages/github-cache/src/backend/read-only-backend.ts` fails (absent); `createActionsCacheBackend(): CacheBackend` declared with an empty parameter list (confirmed by reading the source); `git grep -c 'export const TRUSTED_EVENTS'` = 1 |
| 10 | SC5: this repo's CI runs `serve` against the Actions-cache backend and gets a real, cross-job cache HIT on a default-branch push, failing loudly on a miss, with runtime credentials never re-exported and the bearer token masked | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED (code fully present + wired + passes every local gate; the live-CI HIT itself is unexercisable pre-merge — see Human Verification) | `action.yml` (`node24`, `main: dist/action/index.js`); `src/action/index.ts` — self-skip guard, `core.setSecret(running.token)` first statement after `serve()`, fail-loud `seed`/`verify` branches (exact `200`, byte-equality check on verify, named MISS failure on 404), `await running.shutdown()` in `finally`. `.github/workflows/ci.yml` `dogfood-seed`/`dogfood-verify` — push-trigger-gated, `needs: dogfood-seed`, keyed on `github.run_id`, no job-level `permissions:` block, `GITHUB_TOKEN` passed by step `env:` (process inheritance). All local gates re-run and green: `npm run fallow:ci` (0 issues, 18 entry points), `npm run test:act` (exit 0, prints the SKIP notice as designed off-CI), `npx nx format:check --all` (exit 0), `git grep -c 'GITHUB_ENV'` = 0 in both the action and the workflow, `git grep -c 'permissions:'` = 1, `git grep -c 'uses: ./packages/github-cache'` = 2. The actual cross-job cache HIT requires a real push-triggered GitHub Actions run and cannot be produced locally (act cannot back the v2 twirp protocol; this arm64/QEMU host would emulate anyway) — this branch has not yet merged to the default branch, so no live run exists to inspect |

**Score:** 9/10 truths verified (1 present-but-behavior-unverified — the live cross-job CI cache
HIT, which by construction can only be observed after a real push-triggered workflow run)

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `packages/github-cache/package.json` | `@actions/cache`/`@actions/core` exact-pinned | VERIFIED | `"6.2.0"`/`"3.0.1"`, no range operator |
| `packages/github-cache/src/pinned-deps.spec.ts` | ROBUST-03(a) static guard | VERIFIED | 2 tests, pass live |
| `packages/github-cache/src/lib/trust.ts` | `TRUSTED_EVENTS` + `isWriteTrusted` | VERIFIED | Both exported, comment-locked, single declaration |
| `packages/github-cache/src/lib/trust.spec.ts` | TRUST-03 refused-event table + content pin | VERIFIED | 18 tests, pass live |
| `packages/github-cache/src/lib/with-hash-lock.ts` | `withHashLock` + `inFlightHashCount` | VERIFIED | Both exported; `inFlightHashCount` doc-marked test-only |
| `packages/github-cache/src/lib/with-hash-lock.spec.ts` | TEST-02 four-property spec | VERIFIED | 4 tests, pass live, deterministic (no timers) |
| `packages/github-cache/src/lib/cache-archive-path.ts` | single-source, pinned-name archive path helper | VERIFIED | Load-bearing comment-lock present, one export |
| `packages/github-cache/src/lib/cache-archive-path.spec.ts` | pinned literal-filename guard | VERIFIED | 3 tests, pass live, literal spelled out (non-tautological) |
| `packages/github-cache/src/backend/actions-cache-backend.ts` | real `CacheBackend` against `@actions/cache` | VERIFIED | `createActionsCacheBackend`/`cacheKeyFor` exported, empty param list |
| `packages/github-cache/src/backend/actions-cache-backend.spec.ts` | backend mapping spec (mocked toolkit) | VERIFIED | 10 tests, pass live |
| `packages/github-cache/src/lib/select-backend.ts` | context-derived selection point | VERIFIED | `selectBackend`/`resolveGitHubToken` exported, `selectBackend.length === 0` |
| `packages/github-cache/src/lib/select-backend.spec.ts` | TEST-01 + TRUST-05 structural/behavioral proofs | VERIFIED | 22 tests, pass live |
| `packages/github-cache/src/serve.ts` | composition root wired to selection + lock + drain | VERIFIED | `selectBackend(process.env)`, `withHashLock`, `process.once('SIGTERM', ...)`, `shutdown` on `RunningServer` |
| `packages/github-cache/src/serve.spec.ts` | ROBUST-04 drain + SIGTERM listener + TEST-02 wiring | VERIFIED | 9 tests, pass live |
| `packages/github-cache/action.yml` | internal dogfood JS action manifest | VERIFIED | `node24`, `hash`/`operation` inputs, description flags internal-only |
| `packages/github-cache/src/action/index.ts` | dogfood entry | VERIFIED | Self-skip guard, `setSecret` first, fail-loud seed/verify, `shutdown()` in `finally` |
| `.fallowrc.jsonc` | action entry declared as reachability entry point | VERIFIED | `packages/github-cache/src/action/index.ts` present in `entry` array with explanatory comment |
| `.github/workflows/ci.yml` (dogfood-seed/verify) | seed+verify jobs proving a real cross-job hit | VERIFIED (code); live HIT is human-check | Jobs present, push-gated, `needs`-chained, keyed on `github.run_id`, no `permissions:` block added, no `GITHUB_ENV` write |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `select-backend.ts` | `trust.ts` | `isWriteTrusted(env)` composed to decide RW/RO | WIRED | `git grep -nF 'isWriteTrusted'` matches in `select-backend.ts` |
| `select-backend.ts` | `actions-cache-backend.ts` | returns `createActionsCacheBackend()` only when trusted + valid repo + resolvable token | WIRED | confirmed in source, exercised by 22 passing specs |
| `select-backend.ts` | `memory-backend.ts` (`createReadOnlyMemoryBackend`) | RO fallback path, Phase 3 placeholder | WIRED | `git grep -nF 'createReadOnlyMemoryBackend'` matches; no new `read-only-backend.ts` created |
| `actions-cache-backend.ts` | `cache-archive-path.ts` | both `get`/`put` resolve their path through `cacheArchivePath(hash)` | WIRED | path+key agreement spec passes; `git grep -c 'cacheArchivePath'` >= 2 in the backend file |
| `actions-cache-backend.ts` | `@actions/cache` | `restoreCache`/`saveCache` against the exact-pinned toolkit | WIRED | mocked-toolkit spec exercises both call sites with recorded arguments |
| `serve.ts` | `select-backend.ts` | `selectBackend(process.env)` replaces the hard-wired writable memory backend | WIRED | `git grep -nF 'selectBackend(process.env)' -- serve.ts` matches; `createWritableMemoryBackend` import count in `serve.ts` = 0 |
| `serve.ts` | `with-hash-lock.ts` | every `put` wrapped in `withHashLock(hash, ...)`, in-flight puts tracked for the drain | WIRED | serialize/concurrent wiring specs pass (non-vacuous exact-order proof) |
| `src/action/index.ts` | `serve.ts` | dogfood entry runs `serve()` in its own foreground process | WIRED | confirmed in source; `test:act` locally exercises the same built entry (self-skip path) |
| `.github/workflows/ci.yml` | `packages/github-cache` (action) | two jobs `uses: ./packages/github-cache`, verify `needs` seed | WIRED | `git grep -c 'uses: ./packages/github-cache'` = 2; `needs: dogfood-seed` present |

### Data-Flow Trace (Level 4)

Not applicable in the UI/dashboard sense — Phase 2 delivers library/CI-glue code, not a
data-rendering component. The closest analog (does data really flow end-to-end rather than being
a stub) is covered by the mocked-toolkit backend specs (Truth #8, path+key agreement asserted from
recorded call arguments, not reconstructed) and by the CI dogfood's fail-loud byte-equality check
in `src/action/index.ts` (`received.equals(body)`), which is the real end-to-end data-flow proof —
deferred to the post-merge human check (Truth #10) because it requires the live cache service.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Full suite green (fresh, no cache) | `npx nx run-many -t build typecheck test --skip-nx-cache` | `Test Files 10 passed (10)`, `Tests 100 passed (100)`, build+typecheck exit 0 | PASS |
| Dead-code gate green | `npm run fallow:ci` | `18 entry points detected`, `No issues found` | PASS |
| Format gate green | `npx nx format:check --all` | exit 0, no output | PASS |
| `test:act` self-skips off-CI | `npm run test:act` | builds, then prints the documented SKIP notice, exit 0 | PASS |
| Single source of truth counts | `git grep -c` on `TRUSTED_EVENTS`/`cacheArchivePath` | both = 1 | PASS |
| Resolved decisions honored | `ls .../read-only-backend.ts` | fails (absent) | PASS |
| No credential re-export | `git grep -c 'GITHUB_ENV'` (action + workflow) | 0 | PASS |
| No permission-block replacement | `git grep -c 'permissions:' -- ci.yml` | 1 (pre-existing workflow grant only) | PASS |
| RED-before-GREEN TDD gate (spot-checked) | `git log --oneline` ordering for 02-03/02-04/02-05 and the WR-01 fix | every `test(...)` commit precedes its paired `feat(...)`/`fix(...)` commit | PASS |

### Probe Execution

Step 7c: SKIPPED (no runnable probe entry points — `find scripts -path '*/tests/probe-*.sh'` found
nothing, and no PLAN/SUMMARY file for this phase references a probe script).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| TEST-01 | 02-05 | `selectBackend` unit specs (CI-vs-local, repo validation, token fallthrough, malformed-repo rejection, explicit env) | SATISFIED | `[x]` in REQUIREMENTS.md; `select-backend.spec.ts` 22 tests pass |
| TEST-02 | 02-03 (primitive), 02-05 (wiring) | `withHashLock` concurrency spec + wired into `serve`'s write path | SATISFIED | `[x]` in REQUIREMENTS.md; `with-hash-lock.spec.ts` (4) + `serve.spec.ts` wiring tests (2) pass |
| ROBUST-03 | 02-01 (pin), 02-04 (backend), 02-06 (canary) | `@actions/cache` pinned exact; real backend; upgrade gated behind `test:act`/CI canary | SATISFIED (code); live canary confirmation is the one human-check item | `[x]` in REQUIREMENTS.md; `pinned-deps.spec.ts` (2) + `actions-cache-backend.spec.ts` (10) + `cache-archive-path.spec.ts` (3) all pass; dogfood jobs built and locally green, live HIT pending merge |
| ROBUST-04 | 02-05 | `serve` handles SIGTERM, drains in-flight writes | SATISFIED | `[x]` in REQUIREMENTS.md; `serve.spec.ts` SIGTERM-drain tests (3) pass |
| TRUST-03 | 02-02 | Dangerous shared-default-scope events refused on the write gate | SATISFIED | `[x]` in REQUIREMENTS.md; `trust.spec.ts` (18 tests) pass |
| TRUST-05 | 02-05 | Context-derived RW/RO, no caller-facing mode surface | SATISFIED | `[x]` in REQUIREMENTS.md; structural + behavioral no-mode-flag tests pass |

**Orphaned requirements check:** ROADMAP.md's Phase 2 traceability table maps exactly `TEST-01,
TEST-02, ROBUST-03, ROBUST-04, TRUST-03, TRUST-05` to Phase 2 — identical to the union of
`requirements:` fields declared across all 6 plan frontmatter blocks (02-01: ROBUST-03; 02-02:
TRUST-03; 02-03: TEST-02; 02-04: ROBUST-03; 02-05: TEST-01, TRUST-05, ROBUST-04; 02-06:
ROBUST-03). No orphaned requirements; no plan claims a requirement REQUIREMENTS.md doesn't also
map to this phase. All six are marked `[x]` in REQUIREMENTS.md.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| `packages/github-cache/src/**` (all 6 plans' files) | — | `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` scan | none found | `git grep` across every phase-modified source file returned zero debt markers |
| `select-backend.ts:40` | 40 | Comment reads "Phase 3 placeholder for the real cross-context Releases reader" | INFO, not a gap | This is a deliberate, resolved planning decision (documented in `02-04-PLAN.md`/`02-05-PLAN.md` and 02-CONTEXT.md's deferred-ideas list) — the read-only local backend is explicitly out of Phase 2's scope; Phase 3 replaces it. Not a stub masquerading as complete work |
| `02-REVIEW.md` WR-01 | — | `get` left the restored archive on disk (T-2-11 hygiene asymmetry) | RESOLVED before this verification | Fixed test-first in commits `4d1e580` (RED) + `4b5d99c` (GREEN), independently confirmed present in `actions-cache-backend.ts`'s `get` (`finally { await rm(path, { force: true }); }`) and in the spec (`removes the restored archive after a HIT`) |

No 🛑 BLOCKER-class anti-patterns found. The three 02-REVIEW.md INFO items (IN-01 hash
self-validation, IN-02 get/put lock asymmetry, IN-03 test-only export in production source) are
defense-in-depth notes explicitly marked "not action-required" by the reviewer and are consistent
with that framing on independent re-read — none of them contradicts a phase must-have.

### Human Verification Required

### 1. Real cross-job Actions-cache HIT on a default-branch push (SC5, ROBUST-03 canary)

**Test:** Merge/push this branch to the default branch. Open the resulting GitHub Actions
workflow run and inspect the `dogfood-seed` and `dogfood-verify` job logs.
**Expected:** `dogfood-seed` logs "stored `<run_id>` (PUT 200)"; `dogfood-verify` logs "cache HIT
for `<run_id>` with matching bytes." A MISS (404) or a byte mismatch means the round-trip did not
reach GitHub's cache service — investigate the `cacheArchivePath` derivation or a pinned
`@actions/cache` version change before treating the phase as fully complete.
**Why human:** The real `@actions/cache` v2 twirp protocol runs only inside a JS action on genuine
GitHub-hosted CI (`ACTIONS_RUNTIME_TOKEN`/`ACTIONS_RESULTS_URL` are injected only into that
runtime). Per 02-RESEARCH.md R-01, local `act` cannot back this primitive (v1-REST-only) and this
development host is arm64/QEMU-slow regardless. This item is directly harvested from
`02-06-PLAN.md` Task 2's `<verify><human-check>` block — the planner deliberately deferred it to
end-of-phase rather than a mid-run cold-start checkpoint. Everything else about the dogfood (code,
wiring, local gates) is independently verified above and is not in question — only the live
service round-trip itself requires a real, pushed CI run to observe.

### Gaps Summary

No gaps. Every one of the 5 ROADMAP Phase 2 Success Criteria, and every merged plan-level
must-have across all 6 plans, is independently re-verified against the live codebase (not from
SUMMARY.md claims): `selectBackend(env)` is genuinely context-derived with a proven (not just
declared) absence of any caller-facing mode surface; the default-deny write-trust gate refuses
every dangerous shared-default-scope trigger under test with a content-pinned allowlist;
`withHashLock` provides all four TEST-02 concurrency properties, proven deterministically and
proven WIRED into the real write path (not just present); the SIGTERM drain is a genuine bounded
teardown proven by a real behavioral test (not presence alone) covering the settle, hang, and
listener-cleanup cases; `@actions/cache`/`@actions/core` are exact-pinned with a build-breaking
guard and a genuinely recorded human approval of the SUS/`too-new` legitimacy verdict; the real
Actions-cache backend correctly maps `get`/`put`, shares one pinned archive-path source between
save and restore, handles the ambiguous `-1`/`ReserveCacheError` sentinel as a documented benign
no-op while propagating every real fault, and — after the WR-01 fix verified present in this
pass — cleans up the temp archive on every exit path of BOTH `get` and `put`. The dogfood JS
action and its two CI jobs are fully built and pass every local gate (100/100 tests, build,
typecheck, dead-code, format, the self-skipping `test:act` canary), with no credential
re-export and correct token masking.

The one item that is not (and by construction cannot be) verified in this pass is the live,
cross-job GitHub Actions cache HIT itself — the phase's headline capability proof requires a real
push-triggered workflow run on the default branch, which does not exist yet for this unpushed
branch. This is not a code gap: the plan itself designed this as an explicit end-of-phase human
check (`02-06-PLAN.md` Task 2), and every locally verifiable precondition for that HIT to succeed
is independently confirmed green above. Status is `human_needed`, not `gaps_found` — no must-have
failed; one behavior-dependent truth is present, fully wired, and awaiting its one unexercisable
(pre-merge) confirmation.

---

*Verified: 2026-07-19T13:00:00Z*
*Verifier: Claude (gsd-verifier)*
