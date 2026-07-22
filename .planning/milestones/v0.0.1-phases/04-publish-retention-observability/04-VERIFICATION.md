---
phase: 04-publish-retention-observability
verified: 2026-07-20T04:20:00Z
status: passed
live_proof_confirmed: "CI run 29726834220 on main (7fec51e) GREEN: publish (ubuntu-24.04-arm + windows-11-arm) + publish-verify (both OS legs) + dogfood-seed/verify all success; the deferred-from-Phase-3 live cross-OS mirror->read-back round-trip is confirmed on real GitHub infrastructure. (First push run 29726381233 failed on a cross-OS npm-ci lockfile drift, fixed in 7fec51e.)"
score: "37/37 must-haves verified (5 roadmap success criteria + 32 plan-level truths; the 1 previously-behavior-unverified live round-trip now CONFIRMED green on CI; 21/21 prohibitions honored; 7/7 artifacts verified; 8/8 key links wired)"
behavior_unverified: 0
overrides_applied: 0
re_verification: false
behavior_unverified_items:
  - truth: "A live publish->read-back CI leg proves the real publisher's mirrored asset is resolvable by the real GitHub Releases reader (04-06-PLAN.md must-have; deferred-from-Phase-3 live round-trip)"
    test: "On a real default-branch push to main, confirm the `publish` job matrix (ubuntu-24.04-arm + windows-11-arm) seeds a run_id-keyed nx-cache entry, mirrors it via `operation: publish` on the JS action, and the `publish-verify` job's `roundtrip/read-back.js` resolves a HIT for each OS leg (job logs show 'cache HIT for <run_id> on <platform>')."
    expected: "Both publish-verify matrix legs (ubuntu, windows) report a HIT and exit 0; core.summary on the publish job shows mirrored >= 1, failed = 0."
    why_human: "The real @octokit/rest PublishClient/CleanupClient adapters, the getActionsCacheList enumeration, and the live cross-OS mirror-then-read-back round-trip only execute against real GitHub Releases/Actions-cache services on a real default-branch push -- no local test harness can exercise the live adapter wiring or GitHub's actual per-OS cache-version-hash behavior. Every sub-component (sync gate, publishMirror engine, cleanupMirror engine, retention window walk) is independently unit-proven with fault-shaped fakes; only the end-to-end live wire-up is unverified. This is the explicitly deferred-from-Phase-3 leg (spike 005 proved it on paper; this phase wires the real job pair) and closes on the phase's first real push."
---

# Phase 4: Publish + Retention + Observability Verification Report

**Phase Goal:** The default-branch `{push,schedule}`-gated publish/sync engine mirrors
CI-produced entries to GitHub Releases, prunes them by age safely, fails loud on whole-run
failure, and degrades gracefully at the storage caps instead of breaking the build. (Mode: MVP)

**Verified:** 2026-07-20T04:20:00Z
**Status:** human_needed
**Re-verification:** No -- initial verification

## Method

Read all six PLAN.md files (frontmatter `must_haves` + task bodies), all six SUMMARY.md files,
04-CONTEXT.md (17 locked decisions), 04-RESEARCH.md, 04-PATTERNS.md, deferred-items.md, and
REQUIREMENTS.md. Directly read the seven production source files this phase created/modified
(`sync-gate.ts`, `retention.ts`, `cleanup.ts`, `publish-mirror.ts`, `cleanup/index.ts`,
`action/index.ts`, `roundtrip/read-back.ts`) and their spec files, `action.yml`, `ci.yml`, and
`cleanup.yml` line by line -- not summarized from SUMMARY.md claims. Ran `npx nx test
github-cache`, `npx nx typecheck github-cache`, `npx nx build github-cache`, `npm run
fallow:ci`, and `npx nx format:check --all` fresh to independently confirm green (not trusting
SUMMARY-claimed results, several of which predate the phase's own closeout-fix commits). Ran 12+
structural `git grep`/`rg` gates against the acceptance criteria in each PLAN.md. Verified all 19
commit hashes cited across the six SUMMARYs exist in git history. Cross-referenced the union of
`requirements:` fields across all six plans against REQUIREMENTS.md's Phase 4 traceability row.

## Goal Achievement

### Observable Truths -- Roadmap Success Criteria (the phase contract)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A separate sync/publish gate = literally `{push, schedule}` on the default branch (NOT the write allowlist) publishes CI entries to Releases and is test-locked to reject `pull_request`, `release`, `repository_dispatch`, `workflow_dispatch`, `merge_group`, `delete`, `registry_package`, `page_build`, and non-default refs (TRUST-02) | VERIFIED | `sync-gate.ts` declares `SYNC_EVENTS = ['push','schedule'] as const` as a NEW declaration (`git grep "TRUSTED_EVENTS\|isWriteTrusted" sync-gate.ts` returns nothing). `isSyncTrusted` requires `GITHUB_ACTIONS==='true'` + event membership + `refs/heads/` prefix + branch-equals-`repository.default_branch` (read from `GITHUB_EVENT_PATH`, fail-closed on any read/parse error). `sync-gate.spec.ts`: 21 tests -- all 11 REFUSED_EVENTS, a non-default-branch push, a `refs/tags/*` ref, a tag ref whose name equals the default branch (isolates the `refs/heads/` guard independently), non-`"true"` `GITHUB_ACTIONS`, outside-Actions, unreadable payload, empty env -- plus a deep-equality content-pin on `SYNC_EVENTS`. `action/index.ts`'s publish branch calls `isSyncTrusted(process.env)` as its FIRST statement (`runPublish` line 121), never `isWriteTrusted`. |
| 2 | The publish + cleanup orchestration runs behind an injected client and is tested across already-exists / not-found / other-fault branches; every fault is discriminated structurally via Octokit `error.status` (never stderr text) on both the publish and delete paths, so a real fault is never mistaken for absence (TEST-03, ROBUST-01) | VERIFIED | `publish-mirror.ts`'s `PublishClient` and `cleanup.ts`'s `CleanupClient` are both narrow injected interfaces; neither imports `@octokit/rest` (no `import` statement for it in either file -- only `@actions/core` and sibling lib/backend modules). Both duck-type `statusOf(error)` on a numeric `.status`, never `instanceof RequestError`, never body text. `publish-mirror.spec.ts` (16 tests): 404-then-create shard, createRelease-422-then-reread, real 5xx surfaced as a whole-run throw, per-item 5xx isolated+annotated, 422 `already_exists` benign skip. `cleanup.spec.ts` (9 tests): non-404 list fault aborts, mixed 404-vs-5xx delete discrimination. `octokit-fault.ts` is the shared fault-shaped factory (`{status, response.data}`) both specs inject. |
| 3 | Age-based cleanup prunes expired assets and retains within-window ones; the list phase aborts with ZERO deletions on any non-404 fault or incomplete pagination, the delete phase isolates per-item failures with a non-zero exit on aggregated failure, and deletion uses the same `contents:write` `GITHUB_TOKEN` that publishes under a queue-don't-cancel `concurrency:` group (TEST-04, TEST-06, RETAIN-01, RETAIN-03) | VERIFIED | `cleanupMirror`'s LIST phase materializes the complete `cache-mirror-*` release+asset set BEFORE any delete; any throw from `listAllReleases`/`listAllAssets` propagates. The load-bearing test (`cleanup.spec.ts` "aborts with ZERO deletions when listAllAssets throws mid-pagination") seeds an expired asset in release 1, faults on release 2's asset listing, and asserts `deleteAsset` was NEVER called. DELETE phase: `prunes an expired created_at and retains a within-window one` (pruned=1, scanned=2); `isolates a per-item failure ... fails loud on aggregate` (3 deletes attempted despite a middle rejection, `core.setFailed` called once). `cleanup.yml`: separate scheduled workflow, `permissions: contents: write` only (no `actions:read`), `concurrency: {group: github-cache-cleanup, cancel-in-progress: false}`, `GITHUB_TOKEN` by inheritance (no PAT; `rg` for `delete:packages\|personal-access\|PAT\|ACTIONS_STEP` returns nothing). |
| 4 | The mirror never overwrites an existing hash-named asset (first-write-wins; a same-hash trusted write is byte-identical, a benign no-op); an artifact at the ~2 GiB Releases/body-cap boundary fails loud rather than silently truncating or dropping; and a shard reaching the 1000-asset cap skips-and-warns (workflow annotation) rather than hard-failing the build (TRUST-07, ROBUST-02, ROBUST-05) | VERIFIED | `publish-mirror.ts`: pre-list existing-name check -> benign skip (no upload call); a 422 `already_exists` upload race -> benign skip, no `core.warning`. `bytes.byteLength >= RELEASE_ASSET_MAX_BYTES` (2 GiB) -> `core.error` + throw BEFORE any upload; spec asserts `uploadReleaseAsset` NEVER called at/over the cap, and a cap-1 byteLength DOES upload (boundary pinned both sides). 1000-asset cap: `it.each([999,1000,1001])` asserts skip-and-warn (`core.warning`, no throw, no `setFailed`) at/over the cap and normal mirror below it. |
| 5 | A whole-run publish/sync failure fails loud (workflow annotation + non-zero exit) with a documented "how do I know the cache is working / detect sync degradation" signal, and a local `put()` always returns `403` (read-only-local) (OBS-01, TEST-06) | VERIFIED | `publishMirror`/`cleanupMirror` propagate whole-run faults (enumeration, list, ~2 GiB) as throws; both `action/index.ts`'s `run().catch(core.setFailed)` and `cleanup/index.ts`'s equivalent tail turn that into a non-zero exit. Both engines emit a `core.summary` table (mirrored/skipped/failed; pruned/failed/scanned) -- this IS the D-17 signal and ships in this phase. `cleanup.spec.ts`'s `createReleasesReadBackend(...).put(...)` re-assertion resolves `'forbidden'`. The PROSE documentation of how to read the signal is explicitly deferred to Phase 6 / DOCS-03 (CONTEXT.md D-17, confirmed against ROADMAP Phase 6 SC4) -- not a Phase 4 gap, a documented phase-boundary split. |

**Score:** 5/5 roadmap success criteria verified (0 present-but-behavior-unverified at the SC level; the one behavior-unverified item lives at the plan-level-truth granularity below).

### Must-Have Truths -- Plan-Level Detail

**04-01-PLAN.md (4 truths, all VERIFIED):**

| Truth | Evidence |
|-------|----------|
| `isSyncTrusted` returns true ONLY for `{push,schedule}` inside GitHub Actions on the repo default branch | 2 positive tests (push, schedule), both requiring `refs/heads/main` == injected default branch. |
| `isSyncTrusted` rejects all 11 named events | `for (const event of REFUSED_EVENTS)` loop, 11 dedicated `it()` cases. |
| `isSyncTrusted` rejects a push whose branch != default, and rejects tag/non-`refs/heads/` refs | Two NON-VACUOUS negatives isolate each guard independently (branch mismatch; tag ref whose name equals the default branch). |
| An unreadable/absent `GITHUB_EVENT_PATH` payload fails closed | `readDefaultBranch` injected as `() => undefined` -> `isSyncTrusted` returns `false`; production `defaultBranch()` wraps `readFileSync`+`JSON.parse` in try/catch returning `undefined`. |

**04-02-PLAN.md (4 truths, all VERIFIED):**

| Truth | Evidence |
|-------|----------|
| `resolveMaxAgeDays` defaults to 30, clamps to 365, rejects NaN/<=0 | `retention.spec.ts` boundary cases; `resolveMaxAgeDays` source: `!Number.isFinite(raw) \|\| raw<=0 -> 30`, else `Math.min(Math.floor(raw), 365)`. |
| `shardTagsForWindow` returns `cache-mirror-YYYYMM` newest-first via calendar-month arithmetic (not `/30`) | UTC month-cursor walk in `shardTagsForWindow`, stepping back one month per iteration; `retention.spec.ts` covers 30-day, Dec->Jan boundary, 28-day February, single-day windows. |
| The Releases reader walks the window newest-first; a 404 on one shard tries the next; only exhausting all shards is a MISS | `releases-backend.spec.ts` "retention window walk" tests (28 total tests in file); reader imports `shardTagsForWindow`+`resolveMaxAgeDays` from `retention.js`. |
| A current-month HIT resolves identically to the pre-walk single-shard reader (no FOUND-02/TEST-05 regression) | Full 225/225 suite green including the pre-existing `releases-backend.spec.ts` happy-path/pagination/fault-matrix tests (fake-timer pinned for determinism). |

**04-03-PLAN.md (6 truths, all VERIFIED):**

| Truth | Evidence |
|-------|----------|
| LIST phase materializes ALL `cache-mirror-*` releases+assets first; any non-404 fault or incomplete pagination aborts with ZERO deletions | `cleanup.ts` lines 86-105 (LIST) throws propagate before DELETE phase begins; load-bearing mid-pagination test asserts `deleteAsset` never called. |
| DELETE phase deletes ONLY expired assets, per-item isolated; aggregate failure calls `core.setFailed` | `isolates a per-item failure ... fails loud on aggregate` test: 3 deletes attempted, 1 rejected, `setFailed` called once. |
| Expired assets pruned, within-window retained, keyed on `created_at` | `prunes an expired created_at and retains a within-window one` test (pruned=1, scanned=2). |
| Read-only-local `put()` -> `'forbidden'`/403 re-asserted in a Phase 4 spec | `cleanup.spec.ts` "createReleasesReadBackend read-only-local put re-assertion (TEST-06)" describe block. |
| Faults discriminated structurally on `error.status` via `statusOf`; only 404 is absence | `statusOf` duck-type (lines 44-54); 404-on-delete counted as pruned (already-gone), every other status is `failed`. |
| A run summary reports pruned/failed/scanned counts | `core.summary.addHeading(...).addTable([...])` + `write()`; OBS-01 test asserts the table contains all three labels. |

**04-04-PLAN.md (8 truths, all VERIFIED):**

| Truth | Evidence |
|-------|----------|
| `publishMirror` enumerates entries, filters by `nx-cache-`, strips the prefix, mirrors ONLY those (D-16) | `mirrors ONLY nx-cache- keys` test: 2 nx keys + 1 unrelated key, only 2 hashes reach `get`/upload. |
| Each hash restored via `createActionsCacheBackend().get`; a foreign-OS/evicted MISS is skipped (D-03) | `skips a foreign-OS/evicted entry` test: MISS -> `skipped:1`, zero Release I/O (no `getReleaseByTag`/`createRelease` calls). |
| Pre-upload `bytes.byteLength >= ~2 GiB` fails loud BEFORE any upload | `refuses to upload at the ~2 GiB ceiling` test: `core.error` called once, `uploadReleaseAsset` never called, whole call rejects. |
| A shard at the 1000-asset cap skips-and-warns without hard-failing | `it.each([999,1000,1001])`: at/over cap -> `skipped:1`, `core.warning` once, no throw/setFailed. |
| First-write-wins: name-already-present and 422-race are both benign no-ops; a real fault is surfaced | Both dedicated tests pass; a real 5xx on the shard lookup is asserted to `rejects.toThrow()`. |
| already-exists / not-found(404) / other-fault(5xx) branches all covered behind an injected client | `ensureShardRelease`'s 404->create, 422->reread, and 500->throw are each a distinct spec case. |
| `publishMirror` returns mirrored/skipped counts; per-item failure annotated, whole-run fault throws | `{mirrored,skipped,failed}` shape; per-item 5xx test asserts `{mirrored:1,skipped:0,failed:1}` + one `core.warning`, batch continues. |
| All annotations go through `@actions/core`, never a raw `::error::` string | `git grep` in `publish-mirror.ts`/`cleanup.ts` shows only `core.error`/`core.warning`/`core.summary` calls; no `console.log('::error')`-shaped string anywhere in either file. |

**04-05-PLAN.md (4 truths, all VERIFIED):**

| Truth | Evidence |
|-------|----------|
| `@octokit/rest` pinned to exact `22.0.1`, guarded by `pinned-deps.spec.ts` | `package.json` line 21: `"@octokit/rest": "22.0.1"` (bare, no range). `pinned-deps.spec.ts` asserts `EXACT_SEMVER` match; 3/3 tests in that file pass. |
| The cleanup bin resolves `maxAgeDays`+token+owner/repo, constructs a real Octokit `CleanupClient`, calls `cleanupMirror` | `cleanup/index.ts` `run()`: `GITHUB_REPOSITORY_PATTERN` validation (fail-closed) -> `resolveGitHubToken` (fail-closed if undefined) -> `new Octokit({auth:token})` -> `resolveMaxAgeDays(process.env)` -> `cleanupMirror(createCleanupClient(...), maxAgeDays)`. |
| The bin fails loud: a whole-run fault reaches `core.setFailed` via `run().catch` | `run().catch((error) => core.setFailed(...))` behind a `pathToFileURL(process.argv[1])` direct-invocation guard (Windows-safe). |
| `cleanup.yml` runs on a daily schedule, single writer, `contents:write` only, queue-don't-cancel, same `GITHUB_TOKEN`, no PAT | Confirmed by direct read: `schedule: cron '17 3 * * *'`; `permissions: {contents: write}` (no `actions:read`); `concurrency: {group: github-cache-cleanup, cancel-in-progress: false}`; `GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}` by inheritance. |

**04-06-PLAN.md (6 truths, 5 VERIFIED + 1 PRESENT_BEHAVIOR_UNVERIFIED):**

| Truth | Status | Evidence |
|-------|--------|----------|
| The publish path's first statement is `isSyncTrusted(process.env)`; a gated-out run is `core.info`+exit 0 (D-01/TRUST-02) | VERIFIED | `runPublish()` lines 121-127: gate check first, `core.info(...); return;` on false -- no throw, no `setFailed`. |
| The publish operation runs in a node24 JS-action context (Actions-cache runtime present) | VERIFIED | `action.yml`: `using: node24`, `main: dist/action/index.js`; publish is a branch inside `run()`, not a separate `run:` step; `operation` read before the required `hash` so publish never trips `getInput`'s required-throw. |
| The publish job is a per-OS matrix `[ubuntu-24.04-arm, windows-11-arm]`, `fail-fast: false`, `needs: build`, `if: !cancelled() && push` | VERIFIED | `ci.yml` `publish:` job lines 180-187 match exactly; `needs: build` only (no `test` dependency, confirmed by `rg "needs:.*test"` finding nothing in the publish job). |
| The publish job's permissions RESTATE both `contents: write` AND `actions: read` | VERIFIED | `ci.yml` lines 192-194: `permissions: {contents: write, actions: read}` on the job block. |
| The publish path emits a `core.summary` mirrored/skipped counts; a whole-run fault reaches `core.setFailed` | VERIFIED | `runPublish()` lines 159-168: `core.summary.addHeading(...).addTable([mirrored,skipped,failed])` + `write()`; a thrown fault propagates to the top-level `run().catch(core.setFailed)`. |
| A live publish->read-back CI leg proves the real publisher's mirrored asset is resolvable by the real GitHub Releases reader (deferred-from-Phase-3 live round-trip) | PRESENT_BEHAVIOR_UNVERIFIED | `roundtrip/read-back.ts` exists, builds (`dist/roundtrip/read-back.js`), is registered in `.fallowrc.jsonc`, and is wired into `ci.yml`'s `publish-verify` job (push-gated, `needs: publish`, per-OS matrix). It invokes the real reader directly (`createReleasesReadBackend(createReleasesReadClient(process.env))`), never `selectBackend`. Code is present, well-formed, and typechecked/built green -- but no test (unit or otherwise) exercises the actual live round-trip (real Actions-cache enumeration -> real Release upload -> real cross-context read), because that requires a genuine default-branch push against live GitHub services. See Human Verification below. |

**Score:** 31/32 plan-level truths VERIFIED, 1 PRESENT_BEHAVIOR_UNVERIFIED (routed to human verification, excluded from the verified count per the scoring rule).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/github-cache/src/lib/sync-gate.ts` + `.spec.ts` | `isSyncTrusted`/`SYNC_EVENTS`, TRUST-02 matrix | VERIFIED | 74 lines source, 21 tests, separate source of truth confirmed by `git grep`. |
| `packages/github-cache/src/lib/retention.ts` + `.spec.ts` | `resolveMaxAgeDays`/`shardTag`/`shardTagsForWindow` single-source | VERIFIED | 86 lines source, 16 tests; `cache-mirror-` tag-generation template exists only here (cleanup.ts's match is a prefix-filter check, not a second generator). |
| `packages/github-cache/src/cleanup/cleanup.ts` + `.spec.ts` | `cleanupMirror` list-abort/delete-isolate engine | VERIFIED | 147 lines source, 9 tests; no `@octokit/rest` import. |
| `packages/github-cache/src/publish/publish-mirror.ts` + `.spec.ts` | `publishMirror` mirror engine | VERIFIED | 244 lines source, 16 tests; no `@octokit/rest` import; both caps + first-write-wins + fault matrix covered. |
| `packages/github-cache/src/cleanup/index.ts` | Scheduled cleanup bin + real `CleanupClient` adapter | VERIFIED | 107 lines; `createCleanupClient` wraps `octokit.paginate` for both list methods (list-abort guarantee inherited); direct-invocation guard; builds to `dist/cleanup/index.js`. |
| `packages/github-cache/src/action/index.ts` (publish operation) | isSyncTrusted gate + real `PublishClient` adapter + `publishMirror` + D-17 summary | VERIFIED | 305 lines total; `runPublish()` (lines 114-169) added; seed/verify branches preserved verbatim (diff-confirmed unchanged bodies). |
| `packages/github-cache/src/roundtrip/read-back.ts` | Live cross-OS round-trip read-back bin | VERIFIED (artifact) / behavior unverified (live) | 74 lines; builds clean; direct-invocation guard; fallow-registered. The artifact itself is substantive and wired (see the plan-level truth above for the live-behavior caveat). |

**Score:** 7/7 artifacts VERIFIED at the exists/substantive/wired levels (Level 4 data-flow: N/A in the UI-rendering sense; see Data-Flow Trace below for the equivalent check).

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `action/index.ts` `runPublish` | `sync-gate.ts` `isSyncTrusted` | Direct call, first statement | WIRED | Confirmed at `action/index.ts:121`; `git grep "isSyncTrusted"` shows the gate precedes all repo/token resolution. |
| `action/index.ts` `runPublish` | `publish-mirror.ts` `publishMirror` | Direct call via `createPublishClient` adapter | WIRED | `const result = await publishMirror(createPublishClient(octokit, owner, repo, ref))`; adapter satisfies the full `PublishClient` interface (`listCacheEntries`/`getReleaseByTag`/`createRelease`/`listReleaseAssets`/`uploadReleaseAsset`), each going through `octokit.paginate` where the engine expects a materialized list. |
| `cleanup/index.ts` `run` | `cleanup.ts` `cleanupMirror` | Direct call via `createCleanupClient` adapter | WIRED | `await cleanupMirror(createCleanupClient(octokit, owner, repo), maxAgeDays)`; both list methods wrap `octokit.paginate` (rejects on any page fault -- inherits the RETAIN-01 guarantee). |
| `publish-mirror.ts` `publishMirror` | `retention.ts` `shardTag` | Import + call | WIRED | `const tag = shardTag(options.now)`; single import site. |
| `cleanup/index.ts` `run` | `retention.ts` `resolveMaxAgeDays` | Import + call | WIRED | `const maxAgeDays = resolveMaxAgeDays(process.env)`. |
| `ci.yml` `publish` job | `action.yml` (`operation: publish`) | `uses: ./packages/github-cache` | WIRED | Confirmed: `uses: ./packages/github-cache` with `operation: publish`, not a `run:` step; job needs `build`, gated `if: !cancelled() && github.event_name == 'push'`. |
| `ci.yml` `publish-verify` job | `roundtrip/read-back.ts` (built) | `run: node .../dist/roundtrip/read-back.js` | WIRED | `needs: publish`, push-gated, per-OS matrix; plain `node` step (reader needs no JS-action runtime). |
| `.github/workflows/cleanup.yml` | `dist/cleanup/index.js` | `run: node ...` | WIRED | Same-repo `GITHUB_TOKEN` by inheritance; scheduled trigger only. |

**Score:** 8/8 key links WIRED.

### Prohibitions (must-NOT checks -- 21 of 21 honored)

| Prohibition (plan) | Verification | Result |
|---------------------|---------------|--------|
| No import of `TRUSTED_EVENTS`/`isWriteTrusted` in `sync-gate.ts` (04-01) | `git grep` | 0 matches -- HONORED |
| Default branch not inferred from `GITHUB_REF_NAME` alone (04-01) | Direct read | Uses `GITHUB_EVENT_PATH` payload `repository.default_branch` -- HONORED |
| 04-01 does not touch `lib/trust.ts`, the serve path, or any backend | `git diff --stat` across the 04-01 commit range | Only `sync-gate.ts`/`.spec.ts` + planning docs changed -- HONORED |
| No second `cache-mirror-YYYYMM` template anywhere (04-02) | `git grep -c "cache-mirror-"` across `src/` (non-spec) | Tag-GENERATION exists only in `retention.ts`; `cleanup.ts`'s match is a `.startsWith('cache-mirror-')` prefix filter, not a second generator -- HONORED |
| No second retention knob (04-02) | Direct read | `resolveMaxAgeDays` is the sole knob, consumed by both reader and cleanup -- HONORED |
| Reader's fault split / redirect-drop download unchanged (04-02) | Full suite green (28 `releases-backend.spec.ts` tests incl. pre-existing fault matrix) | HONORED |
| No delete-as-you-go / page streaming in cleanup (04-03) | Direct read of `cleanup.ts` | LIST phase fully materializes before DELETE phase begins -- HONORED |
| Non-404 never treated as absence; list fault never swallowed (04-03) | Direct read + mid-pagination test | Any throw propagates -- HONORED |
| No `@octokit/rest` import in `cleanup.ts` engine (04-03) | `git grep "^import"` | Only `@actions/core` imported -- HONORED (comment PROSE mentions "@octokit/rest" explaining its absence; see Anti-Patterns note) |
| Cleanup not scoped to the reader window (04-03) | Direct read | Enumerates EVERY `cache-mirror-*` release, sharing only the age cutoff -- HONORED |
| No `@octokit/rest` import in `publish-mirror.ts` engine (04-04) | `git grep "^import"` | Only `@actions/core` + sibling lib/backend modules -- HONORED (same comment-prose caveat) |
| No overwrite of an existing hash-named asset; no naive already-exists inference (04-04) | Direct read + spec | Pre-list check + status-only 422 discrimination -- HONORED |
| No hard-fail at the 1000-asset cap; no upload at/over ~2 GiB (04-04) | Spec assertions | Both boundary directions pinned -- HONORED |
| No second `releaseAssetName`/tag template (04-04) | `git grep` | `publish-mirror.ts` imports `releaseAssetName` and `shardTag`, defines neither locally -- HONORED |
| No PAT / no scope beyond `contents:write` for cleanup (04-05) | Direct read of `cleanup.yml` + `rg` forbidden-token guard | `permissions: {contents: write}` only; no `actions:read`; `rg "delete:packages\|personal-access\|PAT\|ACTIONS_STEP"` returns nothing -- HONORED |
| No `cancel-in-progress: true`; cleanup not inside `ci.yml`/publish matrix (04-05) | Direct read | Separate `cleanup.yml`, `cancel-in-progress: false` -- HONORED |
| `@octokit/rest` not widened to a range (04-05) | `package.json` + `pinned-deps.spec.ts` | Bare `22.0.1` -- HONORED |
| Publish path not run as a plain `run:` step (04-06) | Direct read of `ci.yml` | `uses: ./packages/github-cache` with `operation: publish` -- HONORED |
| Per-OS matrix not collapsed; publish not `needs: test` (04-06) | Direct read + `rg` | Both OSes present; `needs: build` only -- HONORED |
| Job permissions not `contents:write`-only (would drop `actions:read`) (04-06) | Direct read | Both scopes restated -- HONORED |
| Publish gate does not reuse `isWriteTrusted` (04-06) | `git grep "isSyncTrusted"` in `action/index.ts` | Gate call is `isSyncTrusted`, not `isWriteTrusted` -- HONORED |

**Score:** 21/21 prohibitions HONORED.

## Data-Flow Trace (Level 4)

Not applicable in the UI-rendering sense. The equivalent check here is "does the wired
publish/cleanup path carry real bytes/real API responses end to end, not a static/empty stub."
Traced: `ci.yml`'s `publish` job -> `action/index.ts`'s `runPublish` -> `createPublishClient`'s
`listCacheEntries` (real `octokit.paginate(getActionsCacheList)`) -> `publishMirror` ->
`createActionsCacheBackend().get(hash)` (real `@actions/cache` restore) ->
`uploadReleaseAsset` (real Octokit upload with explicit `content-length`). Every adapter method
is a thin, direct wrap of a real Octokit call -- none returns a static/hardcoded value. The one
sub-path NOT exercisable outside a live push is the actual GitHub-side round trip (a real
Actions-cache entry existing, a real Release asset being created, a real cross-context read
resolving it) -- this is exactly the item flagged PRESENT_BEHAVIOR_UNVERIFIED above. FLOWING
(with the live-push caveat noted).

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full suite green (fresh) | `npx nx test github-cache` | 225/225 passed, 17 files | PASS |
| Typecheck green | `npx nx typecheck github-cache` | tsc --build clean (2 tasks) | PASS |
| Build green | `npx nx build github-cache` | tsc --build clean, dist emitted | PASS |
| `fallow:ci` dead-code gate | `npm run fallow:ci` | "27 entry points detected ... No issues found" -- 0 circular deps (confirms the closeout fix `d10f8fd` landed) | PASS |
| Format gate | `npx nx format:check --all` | Clean, no output (confirms the closeout fix `77163a6` landed) | PASS |
| `sync-gate.ts` separate source of truth | `git grep "TRUSTED_EVENTS\|isWriteTrusted" sync-gate.ts` | 0 matches | PASS |
| Single-source `cache-mirror-` tag template | `git grep -c "cache-mirror-"` (non-spec) | 2 files: `retention.ts` (generator) + `cleanup.ts` (prefix-filter check only) | PASS |
| `@octokit/rest` exact-pinned | `git grep "@octokit/rest" package.json` | `"22.0.1"` bare | PASS |
| 19 cited commit hashes exist | `git cat-file -e` per hash | 19/19 found | PASS |
| Union of plan `requirements:` == REQUIREMENTS.md Phase 4 row | Manual set comparison | Exact match, 11/11, no orphans | PASS |

## Probe Execution

SKIPPED -- no `scripts/*/tests/probe-*.sh` files exist in this repo and no PLAN/SUMMARY
references a probe convention; this phase's verification runnables are the Nx targets and
structural `git grep`/`rg` gates covered above.

## Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|--------------|-----------------|--------------|--------|----------|
| TEST-03 | 04-04 | Publish+cleanup orchestration behind an injected client, already-exists/not-found/other-fault branches tested | SATISFIED | `publish-mirror.spec.ts` (16 tests) + `cleanup.spec.ts` (9 tests) cover all three branch families. |
| TEST-04 | 04-03 (engine) / 04-05 (bin, thin glue) | Cleanup bin: per-item isolation + non-zero exit on aggregated failure | SATISFIED | Isolation+`setFailed` proven at the engine level (`cleanup.spec.ts`); the bin (`cleanup/index.ts`) is untested glue that only wires the real adapter (typecheck-verified, no dedicated spec -- see Anti-Patterns note). |
| TEST-06 | 04-03 | Expired pruned / within-window retained by `created_at`; local `put()` always `'forbidden'`/403 | SATISFIED | `cleanup.spec.ts` prune/retain test + read-only-local re-assertion. |
| ROBUST-01 | 04-03, 04-04 | Structural `error.status` discrimination on both publish and cleanup/delete paths | SATISFIED | `statusOf` duck-type in both engines; fault-matrix tests in both specs. |
| ROBUST-02 | 04-04 | Deterministic pre-upload ~2 GiB fail-loud, never truncate/drop | SATISFIED | `RELEASE_ASSET_MAX_BYTES` boundary check + cap-1/cap spec pair. |
| ROBUST-05 | 04-04 | 1000-asset cap skips-and-warns, never hard-fails | SATISFIED | `it.each([999,1000,1001])` spec. |
| TRUST-02 | 04-01, 04-06 | Separate `{push,schedule}`+default-branch sync gate, test-locked rejection matrix | SATISFIED | `sync-gate.spec.ts` (21 tests) + `runPublish`'s first-statement gate call. |
| TRUST-07 | 04-04 | First-write-wins / no-overwrite; 422 discriminated structurally | SATISFIED | Pre-list check + 422-race benign-skip spec pair. |
| RETAIN-01 | 04-02 (shared knob), 04-03 (engine) | List phase aborts with zero deletions on any non-404 fault or incomplete pagination | SATISFIED | Load-bearing mid-pagination-abort test asserts `deleteAsset` never called. |
| RETAIN-03 | 04-05 | Cleanup credential: same `contents:write` `GITHUB_TOKEN`, no PAT, queue-don't-cancel | SATISFIED | Direct read of `cleanup.yml`: contents:write only, `cancel-in-progress:false`, `GITHUB_TOKEN` inherited. |
| OBS-01 | 04-03, 04-04, 04-05, 04-06 | Whole-run failure fails loud; signal reports mirrored/skipped/pruned counts | SATISFIED | Both engines' `core.summary` tables; both bins' `run().catch(core.setFailed)` tails. Prose documentation of the signal is Phase 6/DOCS-03 (documented deferral, not a gap). |

No orphaned requirements: the union of `requirements:` across all six plans (`{TRUST-02} ∪
{RETAIN-01} ∪ {RETAIN-01,TEST-04,TEST-06,ROBUST-01,OBS-01} ∪
{TEST-03,ROBUST-01,ROBUST-02,ROBUST-05,TRUST-07,OBS-01} ∪ {RETAIN-03,OBS-01} ∪ {TRUST-02,OBS-01}`
= `{TEST-03, TEST-04, TEST-06, ROBUST-01, ROBUST-02, ROBUST-05, TRUST-02, TRUST-07, RETAIN-01,
RETAIN-03, OBS-01}`) exactly matches REQUIREMENTS.md's Phase 4 traceability row -- all 11
required IDs accounted for, none missing, none extra.

Note: REQUIREMENTS.md's own checkboxes lag this coverage (TEST-03, TEST-04, ROBUST-01,
ROBUST-02, ROBUST-05, and TRUST-07 remain `[ ]`) -- this is a documented project convention
(04-02/04-04 SUMMARYs: "this project closes requirements at the phase verification gate", i.e.
here), not a functional gap. The 3-source cross-reference (this VERIFICATION + the six
SUMMARYs + REQUIREMENTS.md) resolves all 11 IDs to SATISFIED.

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `cleanup.ts` | 23, 41 | Explanatory PROSE comments contain the literal substrings "octokit/rest" and "instanceof RequestError" (inside "@octokit/rest" and "`instanceof RequestError`" respectively), which means the exact `git grep` command several PLAN acceptance criteria specify ("returns NOTHING") technically returns 2 comment-line matches, not zero | INFO | Purely a self-reported-verification-claim inaccuracy (04-03/04-04 SUMMARYs assert the grep "returns nothing"/"confirms no octokit/rest"). Independently confirmed via `^import` grep that NEITHER file has an actual `@octokit/rest` import statement or `instanceof` usage -- the underlying prohibition (no real Octokit coupling in the engine) is functionally honored. Not a code defect; a documentation-precision nit worth a future comment reword (mirrors the 04-01 SUMMARY's own note about the identical trap with `isWriteTrusted`). |
| `publish-mirror.ts` | 41, 76 | Same pattern as above (`@octokit/rest`, `instanceof RequestError` named in comments) | INFO | Same as above. |
| `cleanup/index.ts` | (whole file) | No dedicated `.spec.ts` for the bin/adapter (`createCleanupClient`); TDD note in 04-05 SUMMARY says only the pin-guard was RED-then-GREEN, the rest is "config/glue" verified by typecheck only | INFO | The behavior the requirement (TEST-04) actually cares about -- per-item isolation + non-zero exit -- is fully proven at the `cleanupMirror` engine level, which the bin only thinly wires. Not a stub (the adapter correctly wraps `octokit.paginate`/`deleteReleaseAsset`), just untested glue. Acceptable given the injected-client-seam design, but a future `cleanup/index.spec.ts` (mocking `@octokit/rest`) would close the residual gap between "typechecks" and "behaviorally proven". |
| `sync-gate.ts` | 11 | `ponytail:` deliberate-simplification marker ("array .includes is fine at n=2") | INFO | Sanctioned, scoped, harmless -- a 2-element array `.includes` needs no upgrade. |

No `TBD`/`FIXME`/`XXX` debt markers found in any of the 13 phase-4 files (`git grep` across all
of them returns zero matches). No `TODO`/`HACK`/`PLACEHOLDER` markers, no `not yet implemented`
strings. No blockers.

## Human Verification Required

### 1. Live cross-OS publish/read-back round-trip (deferred-from-Phase-3 leg)

**Test:** On a real default-branch push to `main`, observe the `publish` job matrix (both
`ubuntu-24.04-arm` and `windows-11-arm`) seed a `run_id`-keyed `nx-cache-*` entry, mirror it via
the sync-gated `operation: publish` JS-action step, and confirm the `publish-verify` job's
`roundtrip/read-back.js` step resolves a HIT for each OS leg.

**Expected:** Both `publish-verify` matrix legs report `cache HIT for <run_id> on <platform>` and
exit 0; the `publish` job's `core.summary` shows `mirrored >= 1` and `failed = 0` for each OS.

**Why human:** Every sub-component behind this leg is independently unit-proven with
fault-shaped fakes (the sync gate, the `publishMirror`/`cleanupMirror` engines, the retention
window walk, the real-Octokit adapter's typecheck-verified shape) -- but the actual wire
crossing (a real `getActionsCacheList` enumeration, a real Release asset upload, a real
cross-context read resolving it, and GitHub's actual per-OS Actions-cache version-hash behavior)
can only be observed on a genuine default-branch push against live GitHub services. This is
explicitly the leg Phase 3 deferred here (spike 005 proved the mechanism on paper); this phase
wires the real job pair but its first green run is the closing proof. This is a known,
expected, and explicitly documented deferral (see 04-06-PLAN.md's own acceptance criteria: "on a
real default-branch push, the publish matrix uploads assets and the read-back job resolves one
(green)") -- not a phase-goal failure, but it is unverifiable by this agent without a live push.

## Deferred Items

Not phase-4 gaps -- explicitly addressed by a later phase per CONTEXT.md/ROADMAP:

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | OBS-01's PROSE documentation of "how do I know the cache is working" (the signal itself ships in Phase 4; the write-up does not) | Phase 6 | ROADMAP Phase 6 SC4 (DOCS-03): "a trust/security section documents ... the coupled `CACHE_MIRROR_MAX_AGE_DAYS` ... retention-as-storage-hygiene". CONTEXT.md D-17: "The prose documentation of how to read it is Phase 6 / DOCS-03 ... but the signal itself is a Phase 4 requirement and ships here." |
| 2 | Full TRUST-08 server-produced-key filter (single source of truth + parity assertion); Phase 4 ships only the cheap `nx-cache-` prefix filter (D-16) | Phase 5 | CONTEXT.md `<deferred>`: "Full TRUST-08 server-produced-key filter ... -> Phase 5 ... MUST close before any private-repo adopter enables the mirror." Safe here because `op-nx/github-cache` is a public repo. |

## Gaps Summary

No blocking gaps. All 5 roadmap success criteria, 31 of 32 plan-level must-have truths, all 7
artifacts, all 8 key links, and all 21 prohibitions are independently verified against the
actual codebase -- not inferred from SUMMARY.md claims. The full test suite (225 tests),
typecheck, build, `fallow:ci` (0 circular deps, confirming the phase's own closeout fix landed),
and `format:check --all` were re-run fresh and are all green. 19/19 cited commits exist in git
history. The union of plan-declared requirements exactly matches REQUIREMENTS.md's Phase 4 row
(11/11, no orphans).

The single remaining item -- the live cross-OS publish/read-back round-trip -- is PRESENT (code
complete, unit-tested at every sub-component boundary, typechecked, built, and wired into
`ci.yml`) but its end-to-end live behavior cannot be exercised without a real default-branch
push against live GitHub services. This is the explicit, planned, deferred-from-Phase-3 leg
(spike 005 already proved the mechanism on paper) and is routed to human verification rather than
either PASS or FAIL. Two additional items are recorded as informational only: a
self-reported-verification-claim imprecision in two SUMMARYs (the literal acceptance-criteria
`git grep` matches explanatory comment prose, not real `@octokit/rest` imports -- independently
confirmed absent) and the cleanup bin's lack of a dedicated adapter-level spec (its behavior is
fully proven at the engine level it thinly wires). Neither blocks phase-goal achievement.

---

_Verified: 2026-07-20T04:20:00Z_
_Verifier: Claude (gsd-verifier)_
