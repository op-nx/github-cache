---
phase: 3
slug: cross-context-read
status: verified
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-19
validated: 2026-07-19
---

# Phase 3 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `03-RESEARCH.md` `## Validation Architecture` (26 mapped behaviors, 5 seams;
> corrected from the "27" in that document's intro prose during the 2026-07-19 validation audit
> -- the table itself, in both documents, has always had 26 rows).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (via `@nx/vitest`), workspace-configured |
| **Config file** | inferred by the Nx plugin; no `project.json` (Phase 1 D-02) |
| **Quick run command** | `npx nx test github-cache` |
| **Full suite command** | `npx nx run-many -t test typecheck lint` |
| **Estimated runtime** | target < 60s quick run (measure at Wave 0; no watch-mode flags) |

---

## Sampling Rate

- **After every task commit:** Run `npx nx test github-cache`
- **After every plan wave:** Run `npx nx run-many -t test typecheck lint`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds (target)

---

## Per-Task Verification Map

> Finalized by a retroactive Nyquist validation audit, 2026-07-19. Task IDs are bound to the
> real plan/task that shipped each test. Every row below was independently re-verified against
> the actual spec file AND the implementation source (not trusted from SUMMARY/REVIEW-FIX
> prose), then re-run live. **26 rows** (the "27 mapped behaviors" phrase in this doc's header
> and in 03-RESEARCH.md's Validation Architecture intro is an off-by-one in that prose; the
> table itself -- in both documents -- has always had 26 rows. G2 and G4, the two cross-OS
> guards not called out as their own row, are folded into the two CORR-01-labeled rows above the
> TEST-05 rows. No 27th behavior exists anywhere in the research or plans.)

Status legend (ASCII): `[pending]` `[green]` `[red]` `[flaky]` - File: `[EXISTS]` / `[GAP-W0]`

| Task ID | Requirement | Behavior | Test Type | Automated Command | File | Status |
|---------|-------------|----------|-----------|-------------------|------|--------|
| 03-01 Task 1 | CORR-01 | `releaseAssetName(hash, platform)` produces exactly `<hash>-<platform>` (pinned literal) | unit | `npx nx test github-cache -- release-asset-name` | [EXISTS] | [green] |
| 03-01 Task 1 | CORR-01 | Platform map: `win32->windows`, `darwin->macos`, default (`linux`,`freebsd`)`->linux` | unit | `npx nx test github-cache -- release-asset-name` | [EXISTS] | [green] |
| 03-01 Task 2 | CORR-01/TEST-05 | Correct-hit: seeded entry for the reader's own platform returns those exact bytes | unit | `npx nx test github-cache -- releases-backend` | [EXISTS] | [green] |
| 03-01 Task 2 | CORR-01/TEST-05 | **Never-wrong-OS (NEGATIVE case): a hash seeded ONLY under the other platform returns MISS, never a hit** | unit | `npx nx test github-cache -- releases-backend` | [EXISTS] | [green] |
| 03-01 Task 2 | TEST-05 | Cross-OS round-trip covers BOTH an OS-invariant and an OS-sensitive hash (D-12) | unit | `npx nx test github-cache -- releases-backend` | [EXISTS] | [green] |
| 03-01 Task 1 | TEST-05 | G1 guard: `.gitattributes` still contains `* text=auto eol=lf` | unit | `npx nx test github-cache -- release-asset-name` | [EXISTS] | [green] |
| 03-01 Task 2 | TEST-05 | G3 guard: backend passes exactly `releaseAssetName(hash)` to the client (recorded arg) | unit | `npx nx test github-cache -- releases-backend` | [EXISTS] | [green] |
| 03-02 Task 1 | FOUND-02 | Tier 1 wins: env token short-circuits, no subprocess spawned | unit | `npx nx test github-cache -- local-context` | [EXISTS] | [green] |
| 03-02 Task 1 | FOUND-02 | Tier 1 set-but-EMPTY falls through (`\|\|` not `??`, Pitfall 8) | unit | `npx nx test github-cache -- local-context` | [EXISTS] | [green] |
| 03-02 Task 1 | FOUND-02 | Tier 2 wins when env absent: `gh` exit 0 + stdout token | unit | `npx nx test github-cache -- local-context` | [EXISTS] | [green] |
| 03-02 Task 1 | FOUND-02 | Tier 2 non-zero exit (`err.code === 1`) falls through to tier 3 | unit | `npx nx test github-cache -- local-context` | [EXISTS] | [green] |
| 03-02 Task 1 | FOUND-02 | Tier 2 missing binary (`err.code === 'ENOENT'`, a STRING) falls through to tier 3 | unit | `npx nx test github-cache -- local-context` | [EXISTS] | [green] |
| 03-02 Task 1 | FOUND-02 | Tier 3 wins: `password=` parsed from key-value stdout | unit | `npx nx test github-cache -- local-context` | [EXISTS] | [green] |
| 03-02 Task 1 | FOUND-02 | Tier 3 declined/empty stdout -> `undefined` (all tiers exhausted) | unit | `npx nx test github-cache -- local-context` | [EXISTS] | [green] |
| 03-03 Task 1 | FOUND-02 | **No-anon guarantee (D-09): every tier exhausted -> `get` MISSes and issues NO unauthenticated request** | unit | `npx nx test github-cache -- releases-backend` | [EXISTS] | [green] |
| 03-02 Task 1 | FOUND-02 | stderr is never consulted: a tier failing with rich stderr but exit 0 + empty stdout still falls through (stderr is LOCALIZED - measured Danish on this machine) | unit | `npx nx test github-cache -- local-context` | [EXISTS] | [green] |
| 03-02 Task 1 | FOUND-02 | `git credential fill` spawned with `GIT_TERMINAL_PROMPT=0`, askpass neutralized, and a `timeout` (recorded-options assertion) | unit | `npx nx test github-cache -- local-context` | [EXISTS] | [green] |
| 03-02 Task 2 | FOUND-02 | Repo identity parses both `https://` and `git@` remote forms, with/without `.git` | unit | `npx nx test github-cache -- local-context` | [EXISTS] | [green] |
| 03-02 Task 2 / 03-03 Task 1 | FOUND-02 | Unparseable/absent repo identity -> MISS (never a guessed repo) | unit | `npx nx test github-cache -- releases-backend` | [EXISTS] | [green] |
| 03-03 Task 1 | SRV-05/D-11 | Fault -> MISS for EACH branch: 401, 403, 404, 429, 5xx, thrown network error | unit | `npx nx test github-cache -- releases-backend` | [EXISTS] | [green] |
| 03-01 Task 2 | SRV-05/D-11 | An injected client that THROWS still yields MISS (never propagates) | unit | `npx nx test github-cache -- releases-backend` | [EXISTS] | [green] |
| 03-01 Task 2 / 03-03 Task 1 | SRV-05/D-11 | Warning emitted at most ONCE per process, and NOT for the ordinary 404-absent path | unit | `npx nx test github-cache -- releases-backend` | [EXISTS] | [green] |
| 03-01 Task 2 | TRUST-05/D-02 | Read-only: `put()` returns `'forbidden'` for every input | unit | `npx nx test github-cache -- releases-backend` | [EXISTS] | [green] |
| 03-03 Task 2 | TRUST-05/D-01 | `selectBackend` local branch returns the Releases reader; `selectBackend.length` stays 0 | unit | `npx nx test github-cache -- select-backend` | [EXISTS] (extended) | [green] |
| 03-03 Task 1 | D-03 | Asset list is PAGINATED (page 2 requested when page 1 returns 100) | unit | `npx nx test github-cache -- releases-backend` | [EXISTS] | [green] |
| 03-03 Task 1 | D-03 | Download carries `Accept: application/octet-stream` + bearer, and does NOT set `redirect:'manual'` | unit | `npx nx test github-cache -- releases-backend` | [EXISTS] | [green] |

---

## Test Seams

| Seam | Mechanism | Covers |
|------|-----------|--------|
| Injected fake Releases client (D-04) | Plain object implementing `ReleaseReadClient`, backed by a `Map` | All backend behavior: cross-OS hit/miss, put->forbidden, client-throws->MISS. No mocking framework needed. |
| Injectable platform parameter | `releaseAssetName(hash, platform)` default `process.platform` | All three OS mappings + wrong-OS simulation from a single CI leg. Cannot influence RW/RO, so TRUST-05 holds. |
| Mocked `node:child_process` | `vi.mock('node:child_process')` - precedent `actions-cache-backend.spec.ts:17` | Every auth tier outcome (exit 0 / exit 1 / ENOENT / empty stdout / rich stderr) with no real `gh`, `git`, keychain, or network. |
| Mocked global `fetch` | `vi.spyOn(globalThis, 'fetch')` returning crafted `Response` objects | Full fault matrix by `res.status`, pagination, recorded request headers. |
| Injected `env` bag | Existing convention (`select-backend.ts`, `trust.ts` both take `env` with a default) | Tier-1 cases without mutating `process.env`; `select-backend.spec.ts:102-109` already pins no-mutation. |

---

## Wave 0 Requirements

*All closed. The planner took the "may be folded" option for G1: there is no
`cross-os-invariants.spec.ts` file (confirmed absent on disk) -- G1 lives inside
`release-asset-name.spec.ts`, so the original fourth-file line item below is struck through
rather than left as a phantom gap.*

- [x] `src/lib/release-asset-name.spec.ts` - covers CORR-01 (pinned literal + platform map, G2/G4) - 10 tests, pass
- [x] `src/lib/local-context.spec.ts` - covers FOUND-02 (all tier outcomes; mocked `node:child_process`) - 22 tests, pass
- [x] `src/backend/releases-backend.spec.ts` - covers TEST-05 cross-OS, the D-11 fault matrix, put->forbidden, G3 - 28 tests, pass
- ~~`src/lib/cross-os-invariants.spec.ts`~~ - not created; G1 (`.gitattributes eol=lf`) folded into `release-asset-name.spec.ts` instead (the planner took the explicitly-sanctioned "fold" option, so this is not a gap)
- [x] Extended existing `src/lib/select-backend.spec.ts` - local branch returns the Releases reader, TRUST-05 unchanged - 23 tests, pass
- [x] Framework install: none needed (vitest already configured) - confirmed zero `package.json`/lockfile change across all four plan commits

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live authenticated private-repo read by a real developer | FOUND-02 | Depends on a real developer's machine auth (gh login / credential helper keychain); cannot be asserted in CI without embedding credentials | With `GH_TOKEN` unset and `gh auth login` completed, run a local Nx build against this repo and confirm a Releases-backed read is attempted with the developer's token |

**Deliberately NOT covered in Phase 3 (deferred per D-12):** the live-GitHub cross-OS CI matrix
round-trip. It requires the Phase 4 publisher to have written real assets, and was already proven
on paper by spike 005 (run 29613149528, all green).

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all [GAP-W0] references (all 26 rows now [EXISTS]/[green]; the one phantom
      `cross-os-invariants.spec.ts` reference was a stale plan-time guess, not a real gap -- see
      "Validation Audit" below)
- [x] No watch-mode flags
- [x] Feedback latency < 60s (full `npx nx test github-cache` run: ~1.0s)
- [x] Never-wrong-OS assertion is the NEGATIVE case (a positive-only test passes even with namespacing deleted - CORR-01 would regress silently) -- independently re-verified non-vacuous, see "Validation Audit"
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** granted (retroactive Nyquist validation audit, 2026-07-19)

---

## Validation Audit 2026-07-19

**Auditor:** retroactive adversarial test-coverage audit (independent pass over the executed
phase; did not trust SUMMARY/REVIEW-FIX prose at face value for any row).

**Gaps found:** 0 behavioral gaps. 1 documentation/binding defect (stale command reference).
**Gaps resolved (FILLED):** 0 new tests needed -- all 26 mapped behaviors already had real,
passing, non-vacuous coverage from Plans 01-03 plus the review-fix pass (`03-REVIEW-FIX.md`).
**Gaps escalated (BLOCKER):** 0.

### Method

Every row in the Per-Task Verification Map was checked three ways, not just read:
1. The cited spec file was opened and the exact test name matched to the row's behavior.
2. The corresponding implementation file (`release-asset-name.ts`, `local-context.ts`,
   `releases-backend.ts`, `select-backend.ts`) was read to confirm the test's assertion actually
   exercises the code path the row describes (not a coincidentally-passing check).
3. Each of the four filtered commands (`-- release-asset-name`, `-- releases-backend`,
   `-- local-context`, `-- select-backend`) was re-run fresh with `--reporter=verbose` and the
   printed test names were diffed against the row list. Counts: `release-asset-name.spec.ts`
   10/10, `releases-backend.spec.ts` 28/28, `local-context.spec.ts` 22/22, `select-backend.spec.ts`
   23/23 -- all pass. Full suite: `npx nx test github-cache` -> **162/162 passing (13 files)**.

### Finding: stale Automated Command for the TEST-05 G1 row

The G1 row's command (`npx nx test github-cache -- cross-os-invariants`) was carried verbatim
from 03-RESEARCH.md's strategy-time guess at a fourth spec file. That file was never created --
`03-01-PLAN.md` explicitly directed folding G1 into `release-asset-name.spec.ts` "rather than
creating a fourth spec file," and `03-01-SUMMARY.md` confirms this. Running the stale command
confirms it is not a no-op: `npx nx test github-cache -- cross-os-invariants` matches zero spec
files and **exits non-zero** ("Running target test... failed"), which would have misreported a
real, passing G1 test as a hard failure if anyone ran the row literally. **Fixed:** the row's
File and Automated Command columns now point to `release-asset-name.spec.ts`, where the guard
test (`'.gitattributes LF normalisation guard (TEST-05)' > 'forces LF line endings repo-wide so
cross-OS Nx hashes stay identical (TEST-05)'`) actually lives and passes.

### Non-vacuous checks independently re-verified (not trusted from claims)

- **Never-wrong-OS negative (CORR-01/TEST-05).** `releases-backend.spec.ts` ->
  `'MISSES an OS-sensitive hash present ONLY under another platform -- never a wrong-OS artifact
  (CORR-01)'`. Cross-checked against `releases-backend.ts`'s `get()`: it contains no logic beyond
  `client.fetchAsset(releaseAssetName(hash))` plus a hit/miss branch on `undefined`, so a fake
  client seeded ONLY at `releaseAssetName(hash, OTHER_PLATFORM)` and queried at the running
  platform can only return `{ kind: 'miss' }` if OS-namespacing genuinely holds. `03-01-SUMMARY.md`
  additionally documents the test was mutation-checked at authoring time (temporarily making
  `releaseAssetName` ignore its platform argument turned this test, and the G2 literal test, RED).
- **No-anon zero-fetch guarantee (D-09).** `releases-backend.spec.ts` ->
  `'returns undefined and issues ZERO fetches when no token resolves (D-09)'`. This asserts
  `fetchSpy` was never called, not merely that the return value is `undefined`. Cross-checked
  against `createReleasesReadClient(...).fetchAsset` in `releases-backend.ts`: the token is
  resolved and checked for `undefined` BEFORE the function's first `fetch(...)` call (line order
  in source), so the client-level zero-call assertion is structurally equivalent to the
  `CacheBackend.get()`-level guarantee (`get` adds no fetch calls of its own). Doubly covered at
  the resolver level by `local-context.spec.ts` -> `'every tier exhausted resolves undefined with
  no anonymous fallback, spawning only gh then git (FOUND-02, D-09)'`, which asserts exactly two
  spawns and no third/anonymous attempt.
- **HI-01 adversarial-URL test (repo identity, T-03-11).** `local-context.spec.ts` ->
  `'resolves undefined for a URL that merely embeds github.com as a path segment on another host
  -- never a guess (FOUND-02, D-10, T-03-11)'`, using the exact two adversarial URLs from
  `03-REVIEW.md`/`03-REVIEW-FIX.md` (`https://evil.example.com/github.com/attacker-org/...` and
  `https://internal-proxy.corp/mirror/github.com/real-owner/...`). Cross-checked against
  `resolveRepoIdentity`'s regex in `local-context.ts`:
  `/^(?:https:\/\/github\.com\/|git@github\.com:)([^/]+)\/([^/]+?)(?:\.git)?$/` -- the `^` anchor
  requires the string to START with the GitHub host, so a URL that merely contains `github.com`
  as a later path segment cannot match; `match` is `null` and the function returns `undefined`.
  `03-REVIEW-FIX.md` (commit `714ac3b`) documents this test was RED against the pre-fix
  substring-matching regex and GREEN after -- genuine regression coverage, not tautological.

### Requirements independently re-verified as already COVERED (no gap)

CORR-01, TEST-05 (G1-G4), FOUND-02 (all three tiers, both fallthrough directions, repo identity,
no-anon), SRV-05/D-11 (full fault matrix, injected-client-throws, once-per-process warning),
TRUST-05/D-01/D-02 (read-only-by-construction, `selectBackend` wiring and zero-arity), D-03
(pagination, download headers, redirect handling, `AbortSignal` timeout bound added by
`03-REVIEW-FIX.md` HI-02). None required a new test. The phase's TDD discipline plus the
code-review-fix pass (`03-REVIEW-FIX.md`: HI-01, HI-02, ME-01, LO-01) had already closed every
mapped behavior with a real, run test before this audit began; this audit's only correction was
the stale G1 command binding above.

**Verdict:** FILLED (0 new tests required). `nyquist_compliant: true`.
