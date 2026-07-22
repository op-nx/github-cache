---
phase: 03-cross-context-read
verified: 2026-07-19T21:40:00Z
status: passed
score: "22/22 must-haves verified (4 roadmap success criteria + 18 plan-level truths; 20/20 prohibitions honored; 6/6 key links wired; 8/8 artifacts verified)"
behavior_unverified: 0
overrides_applied: 0
re_verification: false
---

# Phase 3: Cross-Context Read Verification Report

**Phase Goal:** A developer on any OS reads this repo's CI-produced cache locally through the
GitHub Releases reader using their existing GitHub auth, and a cross-OS hit never serves a
wrong-OS artifact. (Mode: MVP)

**Verified:** 2026-07-19T21:40:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Method

Read all three PLAN.md files (frontmatter `must_haves` + task bodies), all three SUMMARY.md
files, 03-REVIEW.md + 03-REVIEW-FIX.md, 03-CONTEXT.md, 03-RESEARCH.md, 03-VALIDATION.md, and
REQUIREMENTS.md. Directly read the four production source files
(`release-asset-name.ts`, `local-context.ts`, `releases-backend.ts`, `select-backend.ts`) and
their four spec files line by line — not summarized from SUMMARY.md claims. Ran
`npx nx test github-cache`, `npx nx typecheck github-cache`, and `npx nx build github-cache`
fresh with `--skip-nx-cache` (not trusting the Nx output cache) to independently confirm
green. Ran 10 structural `rg`/`git grep`/`git diff`/`git log` gates against the acceptance
criteria in each PLAN.md. Verified all 16 commit hashes cited across the three SUMMARYs and
REVIEW-FIX.md exist in git history with matching subjects.

## Goal Achievement

### Observable Truths — Roadmap Success Criteria (the phase contract)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `selectBackend` returns a GitHub Releases read-only reader in local context; a developer with existing GitHub auth (git credential helper / `gh` / `GH_TOKEN`\|`GITHUB_TOKEN`) reads a private-repo cache entry with no dependency on anonymous/public access (FOUND-02) | VERIFIED | `select-backend.ts:51` — untrusted branch returns `createReleasesReadBackend(createReleasesReadClient(env))`. Three-tier chain in `local-context.ts` (`resolveLocalReadToken`): env → `gh auth token` → `git credential fill`. `createReleasesReadClient.fetchAsset` resolves token first and returns `undefined` with **zero fetch calls** when unresolved (tested: `fetchSpy).not.toHaveBeenCalled()`). Wiring proven end-to-end by `select-backend.spec.ts` test "wires the REAL Releases reader into the local branch: a hit flows through" — non-vacuous (fails against the old empty-memory placeholder). |
| 2 | The store is OS-namespaced by default... so a Linux-produced entry is never served to a Windows reader; the discriminator lives in the key/namespace, not left to chance (CORR-01) | VERIFIED | Single-source `releaseAssetName(hash, platform = process.platform)` = `` `${hash}-${cachePlatform(platform)}` `` (`release-asset-name.ts:39-44`), comment-locked. `cachePlatform` maps `win32→windows`, `darwin→macos`, else `linux`, all 4 branches (incl. default) pinned by literal `it.each` assertions. Sole call site in `releases-backend.ts` confirmed by `rg` gate (exactly 1 non-comment reference). |
| 3 | A cross-OS round-trip test restores both an OS-invariant and an OS-sensitive artifact... asserts a cross-OS lookup returns a correct hit or a MISS — never a wrong-OS artifact (TEST-05). Scope note (D-12): injected-fake round-trip for Phase 3; live CI leg deferred to Phase 4 | VERIFIED | `releases-backend.spec.ts` "cross-OS round-trip" describe block: `INVARIANT_HASH` seeded under both the running platform and a computed `OTHER_PLATFORM` → hit returns exactly this platform's bytes; `SENSITIVE_HASH` seeded ONLY under `OTHER_PLATFORM` → `{ kind: 'miss' }`, carrying an explicit `// Non-vacuous:` comment (a positive-only test would still pass with namespacing deleted — this negative case is what actually proves CORR-01). `.gitattributes eol=lf` G1 guard folded into `release-asset-name.spec.ts`, reads the real file from disk and asserts the LF directive. Matches the phase's own documented D-12 scope (injected fake, not live GitHub). |
| 4 | The local reader is read-only by construction (no local write path) and any read fault — missing asset, auth failure, rate limit — degrades to a MISS rather than breaking the build | VERIFIED | `put()` (`releases-backend.ts:92-94`) declares zero parameters and unconditionally returns `'forbidden'` — no branch can store bytes; tested for a normal write, an empty buffer, and an already-seeded hash. `get()` wraps the entire client call in one `try/catch`; `it.each([401,403,429,500])` + a rejected-fetch test all assert `{ kind: 'miss' }` through the real client and backend together; a 404 is a silent `{ kind: 'miss' }` with **zero** stderr writes; a non-404 fault warns exactly once. An injected client that always throws also degrades to MISS (`throwingClient` test) — the catch lives at the port boundary so this holds for fakes too. |

**Score:** 4/4 roadmap success criteria verified (0 present-but-behavior-unverified, 0 failed).

### Must-Have Truths — Plan-Level Detail

**03-01-PLAN.md (5 truths, all VERIFIED):**

| Truth | Evidence |
|-------|----------|
| Reader on platform P resolves Release asset `H-P` and returns exactly those bytes | `release-asset-name.spec.ts`: `releaseAssetName('abc123', 'linux')` pinned to literal `'abc123-linux'` (not rebuilt from the template — non-vacuous). `releases-backend.spec.ts` correct-hit test returns exactly the seeded bytes for the running platform. |
| Hash present ONLY under another platform's asset name returns `{ kind: 'miss' }` — never a wrong-OS artifact | `SENSITIVE_HASH` negative test, carries `// Non-vacuous:` comment citing the repo's prior tautological-test incident (`select-backend.spec.ts:196-198`) this guard exists to not repeat. |
| `put` always answers `'forbidden'` for every input | Zero-parameter `put()`; 3 tests (normal, empty buffer, already-seeded hash). |
| An injected client that throws, for any reason, still yields `{ kind: 'miss' }` | `throwingClient` (throws with a credential-shaped string in its message) → `backend.get` resolves `{ kind: 'miss' }`; rejection never escapes `get`. |
| A degradation warning reaches stderr at most once per process, never for the ordinary absent-asset path | Module-level `warned` flag + `warnOnce()`; test asserts exactly 1 stderr write across 2 throwing `get` calls; separate test asserts 0 stderr writes for a genuine absent-asset MISS. |

**03-02-PLAN.md (7 truths, all VERIFIED):**

| Truth | Evidence |
|-------|----------|
| `GH_TOKEN`/`GITHUB_TOKEN` resolves with no subprocess spawned | Tier-1 test asserts `spawnMock).not.toHaveBeenCalled()` (non-vacuous: proves the short-circuit, not just the return value). |
| Neither env var but logged-in `gh` resolves the token on stdout | Tier-2-win test (exit 0, token on stdout). |
| Neither env var nor `gh`, but a configured git credential helper, resolves the password field | Tier-3-win test (`password=` line, structural regex extraction). |
| Every tier exhausted answers `undefined` — no anonymous fallback | Exhausted-chain test asserts `undefined` AND exactly 2 spawns (`gh` then `git`, no third attempt). |
| Repo identity resolves from origin remote (https/ssh, with/without `.git`), `GITHUB_REPOSITORY` overrides when valid | 4 dedicated tests: https+`.git`, https without, scp-like ssh, valid override with zero spawns. |
| Unparseable/absent repo identity resolves `undefined` — never guessed | Non-GitHub-host test (`gitlab.com`) + **2 adversarial host-boundary tests** added by the HI-01 fix (`evil.example.com/github.com/...`, `internal-proxy.corp/mirror/github.com/...`) + non-zero-exit + ENOENT tests. |
| No credential helper can wedge the build: bounded timeout, disabled prompts, neutralised askpass | Dedicated test asserts `shell:false`, `timeout === HELPER_TIMEOUT_MS` (5000), `windowsHide:true`, `GIT_TERMINAL_PROMPT:'0'`, both askpass vars blanked — all on the actual recorded spawn options. |

**03-03-PLAN.md (6 truths, all VERIFIED):**

| Truth | Evidence |
|-------|----------|
| `selectBackend`'s local branch returns the reader built with the real client; a dev with existing auth reads a private-repo entry back | `select-backend.spec.ts` "wires the REAL Releases reader" test — mocked resolvers + mocked fetch, asserts `{ kind: 'hit', bytes }`. |
| Default client resolves token, then repo, then issues authenticated REST calls; either `undefined` → `undefined` with NO request | 2 dedicated zero-fetch-calls tests (no-token, no-repo), both asserting `fetchSpy).not.toHaveBeenCalled()`. |
| Asset list is paginated: page 2 requested when page 1 returns a full page of 100 | Pagination test: full 100-item page-1 without the asset, page-2 request confirmed by inspecting the recorded URL (`page=1` then `page=2`). |
| Download carries `Accept: application/octet-stream` + bearer, follows the 302 via fetch defaults, never sets `redirect: manual` | Headers test asserts both header values AND `downloadInit.redirect).toBeUndefined()`. `rg` gate: 0 occurrences of `redirect: 'manual'` in the source. |
| 404 → silent MISS; 401/403/429/5xx/network-throw → MISS with one warning | `it.each([401,403,429,500])` fault matrix + rejected-fetch test, all through the real backend+client; separate silent-404 and warns-once-on-500 tests. |
| `selectBackend` stays synchronous, `Function.length === 0` | Structural test unchanged from Phase 2 (still passing); the wiring test proves a hit flows through a synchronously-constructed backend (async work deferred into `fetchAsset`). |

**Score:** 18/18 plan-level truths verified.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/github-cache/src/lib/release-asset-name.ts` | OS-namespaced single-source helper | VERIFIED | Exists, 45 lines, 2 exported functions, comment-locked, sole reference from `releases-backend.ts`. |
| `packages/github-cache/src/lib/release-asset-name.spec.ts` | G1/G2/G4 guards | VERIFIED | 10 tests, includes the folded-in `.gitattributes` guard. |
| `packages/github-cache/src/backend/releases-backend.ts` | Read-only port + real client | VERIFIED | 294 lines. Port (`createReleasesReadBackend`) from Plan 01; real client (`createReleasesReadClient`) + `shardTag` added by Plan 03. Both substantive, both wired. |
| `packages/github-cache/src/backend/releases-backend.spec.ts` | Cross-OS + fault + REST specs | VERIFIED | 28 tests covering both the port and the real client. |
| `packages/github-cache/src/lib/local-context.ts` | Auth chain + repo identity | VERIFIED | 209 lines, `HELPER_TIMEOUT_MS`, `resolveLocalReadToken`, `resolveRepoIdentity`, one hardened `runHelper` wrapper. |
| `packages/github-cache/src/lib/local-context.spec.ts` | Every tier outcome | VERIFIED | 22 tests, mocked `node:child_process` with an explicit factory + microtask-driven fake child. |
| `packages/github-cache/src/lib/select-backend.ts` | Wired local branch | VERIFIED | Untrusted branch constructs the real reader (line 51); trusted branch and `resolveGitHubToken` body untouched (confirmed by `git diff --stat` = 1 line for Plan 02's export, 3-line replacement for Plan 03's wiring). |
| `packages/github-cache/src/lib/select-backend.spec.ts` | Hermetic wiring test | VERIFIED | 23 tests; `local-context.js` mocked so the unit layer never spawns/reaches the network; new "hit flows through" test is non-vacuous. |

**Score:** 8/8 artifacts verified (exists, substantive, wired).

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `createReleasesReadBackend.get` | `releaseAssetName(hash)` → `client.fetchAsset(name)` | Direct call | WIRED | Sole derivation path; `rg` gate confirms exactly 1 non-comment reference; spec asserts the recorded argument equals `releaseAssetName(hash)`. |
| `resolveLocalReadToken` tier 1 | `resolveGitHubToken` in `select-backend.ts` | Import + delegation | WIRED | Body byte-identical (`git diff --stat` = 1 line, the added `export`); TEST-01's 4 fallthrough tests still pass (23/23 in `select-backend.spec.ts`). |
| `resolveRepoIdentity` | `GITHUB_REPOSITORY_PATTERN` in `select-backend.ts` | Import + reuse | WIRED | No second copy of the owner/name shape; imported and used once. |
| `selectBackend` local branch | `createReleasesReadBackend(createReleasesReadClient(env))` | Direct construction | WIRED | Confirmed at `select-backend.ts:51`; only production call site (`rg` gate). |
| `createReleasesReadClient.fetchAsset` | `resolveLocalReadToken` + `resolveRepoIdentity` (Plan 02) → GitHub REST | Await chain, get-time (not construction) | WIRED | Both resolved before any `fetch`; memoized per client instance (ME-01 fix); `selectBackend.length === 0` unaffected. |
| `createReleasesReadClient` | The ONLY production `ReleaseReadClient` | Single call site | WIRED | Every other `ReleaseReadClient` implementation (`recordingClient`, `throwingClient`) lives exclusively in `.spec.ts` files. |

**Score:** 6/6 key links wired.

### Prohibitions (must-NOT checks — all 20, all honored)

| Prohibition | Verification | Result |
|-------------|--------------|--------|
| No new runtime dependency (all 3 plans) | `git diff --stat` on `package.json`/`package-lock.json` across the whole `ad39325..HEAD` phase-3 commit range | 0 changes — HONORED |
| No asset-name template literal outside `release-asset-name.ts` | `git grep` for `` `${...}-${...}` `` shape across all of `src/` | Only match is inside `release-asset-name.ts` itself — HONORED |
| No per-target portable/non-portable classification branch | Direct read of `cachePlatform` | Exactly 3 branches (`win32`/`darwin`/default), no portability concept — HONORED |
| `createReleasesReadBackend` takes no mode/readOnly/writable option | Direct read + Plan 03 acceptance check | Single required `client` param, `Function.length === 1` — HONORED |
| No local write path in the reader | Direct read of `put()` | Zero params, one unconditional `return 'forbidden'` — HONORED |
| Resolved token never written to stderr/log | `rg` for `stderr.write\|console\.` across the 3 phase-3 lib/backend files | Single `stderr.write` call site, fixed ASCII string, no interpolation | HONORED |
| `resolveGitHubToken` keeps its exact body/signature | `git diff --stat select-backend.ts` for the Plan 02 commit | Exactly 1 line changed (added `export`) — HONORED |
| No branch reads/matches/asserts on subprocess stderr text | Direct read of `runHelper` | No `stderr` listener attached at all (only `stdout`) — HONORED |
| No switch on the subprocess error-code property | Direct read of `runHelper`'s `error`/`close` handlers | `error` event always resolves `undefined` regardless of `code`; `close` only checks `=== 0` — HONORED |
| No anonymous/unauthenticated fallback when tiers exhausted | Direct read + exhausted-chain test | Returns `undefined`, no further attempt — HONORED |
| No `shell: true`, no command interpolation | `rg` gate on `local-context.ts` | `shell: false` (1), `shell: true` (0) — HONORED |
| No nullish coalescing for credential fallback | `rg` gate on `local-context.ts` | 0 occurrences of `??` — HONORED (the `??=` in `releases-backend.ts`'s memoization is a lazy-init idiom on the promise slot, not a credential-value fallback — a distinct concern from Pitfall 8) |
| `selectBackend` not made async, gains no parameter | Direct read + `git diff --stat` | Signature unchanged (`env` param with default); still returns `CacheBackend` synchronously; `serve.ts` untouched (`git log` on the file across the phase-3 range returns nothing) — HONORED |
| No `redirect: 'manual'`, no re-attached `Authorization` after redirect | `rg` gate + direct read | 0 occurrences; download reuses the initial-request header only, never re-touches anything after the redirect (native fetch handles it) — HONORED |
| No unauthenticated request path | Zero-fetch-calls tests (no-token, no-repo) | Both assert `fetchSpy).not.toHaveBeenCalled()` — HONORED |
| Reader never reads `release.assets` inline | `rg` gate | 0 occurrences; explicit pagination loop instead — HONORED |
| Fault discrimination structural only, never body text | Direct read of all 3 fetch call sites | Every branch checks `.status`/`.ok` only — HONORED |
| `createReleasesReadBackend` keeps a required client param | Direct read + Plan 03 acceptance check | No default value on the `client` parameter — HONORED |

**Score:** 20/20 prohibitions honored (18 distinct statements; 2 appear once each across plans and are counted once).

## Data-Flow Trace (Level 4)

Not applicable in the UI-rendering sense (no component renders this data) — the equivalent check
here is "does the wired reader carry real bytes end to end, not a static/empty stub." Traced:
`select-backend.ts` → `createReleasesReadBackend(createReleasesReadClient(env))` → real client's
`fetchAsset` performs 3 real REST calls (release lookup, paginated list, download) and returns
`Buffer.from(await downloadResponse.arrayBuffer())` — the actual response body, not a static
placeholder. The `select-backend.spec.ts` "hit flows through" test proves this concretely: it
mocks only the resolvers and `fetch`, and the backend returned to the caller resolves the exact
mocked download bytes (`Buffer.from('hit-bytes')`), which is the real code path a production
call would take. FLOWING.

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Full suite green (fresh, not cache) | `npx nx test github-cache --skip-nx-cache` | 162/162 passed, 13 files, 0 regressions | PASS |
| Typecheck green (fresh) | `npx nx typecheck github-cache --skip-nx-cache` | tsc --build clean (2 tasks) | PASS |
| Build green (fresh) | `npx nx build github-cache --skip-nx-cache` | tsc --build clean | PASS |
| `run-many` acceptance-criteria command doesn't error despite no `lint` target | `npx nx run-many -t typecheck lint --projects=github-cache` | Exits 0; `lint` target absent and silently no-op'd by Nx, `typecheck` runs and passes | PASS |
| G3 structural gate: sole `releaseAssetName` call site | `rg` (non-comment lines) | count = 1 | PASS |
| No `redirect: 'manual'` / no inline `release.assets` / no `shell: true` / no `??` credential fallback / no stderr consultation | 5 `rg` gates on the 3 phase-3 lib/backend files | all 0 | PASS |
| `package.json`/`package-lock.json` unchanged across the whole phase | `git diff --stat` over the phase-3 commit range | empty diff | PASS |
| `serve.ts` untouched (TRUST-05 call site) | `git log` over the phase-3 commit range, path-scoped | no commits | PASS |
| All 16 commit hashes cited in the 3 SUMMARYs + REVIEW-FIX.md exist | `git cat-file -e` per hash | 16/16 found, subjects match | PASS |

## Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|----------------|--------------|--------|----------|
| FOUND-02 | 03-02, 03-03 | Local read uses the developer's existing GitHub auth; MUST work for private repos; MUST NOT depend on anonymous/public access | SATISFIED | Three-tier chain + zero-anon-fallback tests + end-to-end wiring test |
| CORR-01 | 03-01, 03-03 | The store is OS-namespaced by default, so a cross-OS hit never serves a wrong-OS artifact | SATISFIED | Single-source `releaseAssetName`/`cachePlatform` + never-wrong-OS negative test |
| TEST-05 | 03-01 | Regression guards for the cross-OS invariants AND a cross-OS round-trip through the reader | SATISFIED | Injected-fake round-trip (invariant + sensitive hash) + G1 `.gitattributes` guard + G3 recorded-argument guard |

No orphaned requirements: the union of `requirements:` across the 3 plans
(`{CORR-01, TEST-05} ∪ {FOUND-02} ∪ {FOUND-02, CORR-01}` = `{FOUND-02, CORR-01, TEST-05}`) exactly
matches REQUIREMENTS.md's Phase 3 traceability row. No REQUIREMENTS.md ID maps to Phase 3 without
a claiming plan.

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `releases-backend.ts` | 194, 217-220 | Bare `as` type assertions on GitHub JSON responses, no runtime shape validation (LO-02) | INFO | Already surfaced by 03-REVIEW.md, explicitly assessed and deferred in 03-REVIEW-FIX.md with reviewer-endorsed rationale: mitigated today by the port's existing catch-all (a malformed shape throws or produces a 404 downstream, both of which already degrade to a warned MISS). Not a live bug; not a must-have. |
| `releases-backend.ts` | 131 | `ponytail:` marker — `shardTag` single-shard (current-month) stub | INFO | Deliberate, explicitly sanctioned by CONTEXT.md's deferred-ideas list and scoped to Phase 4 (the read-window walk). Does not block Phase 3's goal — a developer reads the current month's cache correctly today. |
| `local-context.ts` | 42 | `ponytail:` marker — one spawn mechanism for all 3 call sites | INFO | Documented design consolidation, not a debt marker. |

No `TBD`/`FIXME`/`XXX` debt markers found anywhere in the 8 phase-3 files (`git grep` across all
8 files returned zero matches). No `TODO`/`HACK` markers. The one `PLACEHOLDER` string match is
prose inside a test comment describing why the wiring test is non-vacuous ("would FAIL against
the old ... placeholder"), not a debt marker. No blockers.

## Human Verification Required

None. The phase's own scope note (CONTEXT.md D-12, carried into ROADMAP Success Criterion 3 and
into 03-VALIDATION.md's "Manual-Only Verifications" table) explicitly defers the *live*
authenticated private-repo read and the *live* cross-OS CI matrix round-trip to Phase 4, because
the real publisher does not exist until then — this is not an oversight in Phase 3, it is the
phase's documented contract, and the injected-fake round-trip that Phase 3 *does* deliver is
non-vacuous (proven by the negative MISS assertion). No other truth in this phase depends on a
state transition, cancellation, or ordering invariant that lacks a direct behavioral test — the
once-per-process warning flag, the per-client token/repo memoization, and the zero-mutation of
`process.env` are each exercised by a dedicated test I read and confirmed asserts the actual
transition (not just presence of the relevant code).

## Notes for the Orchestrator (not a phase-goal gap)

`03-VALIDATION.md` frontmatter still shows `status: draft`, `nyquist_compliant: false`,
`wave_0_complete: false`, and every per-task row is `[pending]` — this is the pre-execution
Nyquist sampling *strategy* and has not been updated by a post-execution `/gsd:validate-phase`
pass. Cross-checking its own "Per-Task Verification Map" against the shipped spec files, every
row is in fact covered (I traced each one to a concrete passing test above), so this is a
bookkeeping gap in that file, not a code-truth gap in this phase. Likewise, no
`03-SECURITY.md` exists yet (`/gsd:secure-phase` has not been run), even though the STRIDE
threat register embedded in each PLAN.md was independently exercised by 03-REVIEW.md/-FIX.md
(HI-01/HI-02/ME-01 were threat-adjacent findings that got fixed with tests). Per this project's
documented workflow, both `/gsd:secure-phase` and `/gsd:validate-phase` should still be run to
close out the phase-completion sequence before `/gsd:extract-learnings`.

## Gaps Summary

None. All 4 roadmap success criteria, all 18 plan-level must-have truths, all 8 artifacts, all
6 key links, and all 20 prohibitions are independently verified against the actual codebase —
not inferred from SUMMARY.md claims. The full test suite (162 tests), typecheck, and build were
re-run fresh (bypassing the Nx cache) and are green. 16/16 cited commits exist in git history.

---

_Verified: 2026-07-19T21:40:00Z_
_Verifier: Claude (gsd-verifier)_
