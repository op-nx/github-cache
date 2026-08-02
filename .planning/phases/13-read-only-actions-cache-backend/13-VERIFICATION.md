---
phase: 13-read-only-actions-cache-backend
verified: 2026-08-02T13:20:00Z
status: human_needed
score: 6/7 must-haves verified
behavior_unverified: 1
overrides_applied: 0
must_haves:
  truths:
    - "createReadOnlyActionsCacheBackend returns a ReadableBackend with NO put -- a write is unrepresentable, not refused at runtime (VER-08)"
    - "createActionsCacheBackend composes the read-only factory (spread) rather than duplicating get -- exactly ONE cache.restoreCache READ call site survives (VER-08)"
    - "The @actions/cache drift guard is widened from file scope to package scope, closing the future-sibling evasion (VER-09)"
    - "CACHE_READ_ONLY is a strictly-narrowing env knob read by selectBackend as its LAST branch; selectBackend.length stays 0; the narrowing table asserts the correct implication direction (TRUST-14)"
    - "All three Windows legs (build-windows/typecheck-windows/test-windows) construct the read-only backend via CACHE_READ_ONLY, and their [remote cache] counts are GATED at a floor of >= 1 with an actionable failure message (XOS-09)"
    - "The new gate clauses are non-vacuous (never asserting a bare exit 1) and this is proven by recorded mutation, not argued (TEST-11)"
    - "Every stale site arguing the counts cannot be soundly gated is corrected in the same commit that gates them, bounded to exactly the seven in-scope sites, with the two out-of-scope sites (runner.debug, LEG_OS integration leg) left untouched (DOCS-09)"
    - "The ninth env knob is enumerated in the single-sourced consumer contract as a reviewable diff, documented on all three doc surfaces, and the outcome count is corrected from four to five everywhere, mutation-proven (DOCS-10)"
  artifacts:
    - packages/github-cache/src/backend/actions-cache-backend.ts
    - packages/github-cache/src/backend/actions-cache-backend.spec.ts
    - packages/github-cache/src/lib/select-backend.ts
    - packages/github-cache/src/lib/select-backend.spec.ts
    - packages/github-cache/src/test/consumer-contract.ts
    - packages/github-cache/src/public-surface.spec.ts
    - packages/github-cache/src/docs-adoption.spec.ts
    - .github/workflows/ci.yml
    - packages/github-cache/src/dogfood-cross-os.spec.ts
    - start-cache-server/index.js
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md
    - .planning/THREAT-MODEL.md
    - .planning/phases/13-read-only-actions-cache-backend/13-EVIDENCE.md
  key_links:
    - "createActionsCacheBackend -> spread of createReadOnlyActionsCacheBackend() -> the single get closure -> the single cache.restoreCache READ call site"
    - "CACHE_READ_ONLY (select-backend.ts, last branch) -> ci.yml pre-set step ($GITHUB_ENV write) -> serve() -> selectBackend -> read-only Actions backend -> server.ts answers PUT with 403"
    - "ci.yml gate step (count >= 1) -> dogfood-cross-os.spec.ts per-leg clauses (knob write + comparison line, never bare exit 1) -> mutation-proven non-vacuous"
    - "13-EVIDENCE.md pre-registration (commit 631a2e7) -> proving run 30744366870 (headSha = 631a2e7) -> observation appended, never back-edited"
behavior_unverified_items:
  - truth: "Each Windows leg's job FAILS (exit 1, red job) when its [remote cache] count is below the floor of 1 (part of XOS-09's 'GATED' claim)"
    test: "Trigger a genuine cross-OS restore failure on a real windows-11-arm runner (e.g., a deliberately broken @actions/cache version or archive path) with a ubuntu producer that has already saved the entry, and confirm the Windows leg's job goes RED with the `::error::` annotation."
    why_human: "The gate's shell comparison (`if [ \"${count}\" -lt 1 ]; then ... exit 1; fi`) is pinned in dogfood-cross-os.spec.ts only as TEXT (a regex match against the ci.yml source) and proven non-vacuous by MUTATING the spec's input (deleting the gate step, deleting the knob line, breaking the comparison) -- this proves the SPEC clause detects absence of the gate, not that the real bash executes exit 1 and reddens the job on a real runner. The one CI run recorded in 13-EVIDENCE.md (30744366870) observed only the PASS path (counts 1/2/1, all >= 1); the FAIL path was never exercised live, and 13-EVIDENCE.md and 13-05-SUMMARY.md both say so explicitly ('the live gate REDDENING on a real cross-OS restore failure is not observed and was deliberately not induced'). No spec runs the shell script; a repo-wide search for execSync/spawnSync in dogfood-cross-os.spec.ts returns nothing."
---

# Phase 13: Read-Only Actions-Cache Backend Verification Report

**Phase Goal:** Make "read the Actions cache, never write it" a representable backend, so the three
Windows reuse legs (`build-windows` / `typecheck-windows` / `test-windows`) can be GATED on a
genuine cross-OS HIT instead of merely recording one -- without giving the `@actions/cache`
cache-version computation a second place to drift.

**Verified:** 2026-08-02
**Status:** human_needed (one item routed for human decision; no gaps found)
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | VER-08: read-only backend is the SAME implementation as the writable one's read path; write is unrepresentable | VERIFIED | `actions-cache-backend.ts:88-219` (`createReadOnlyActionsCacheBackend`, no `put`), `:242-247` (`createActionsCacheBackend` spreads it); `types.ts:46-50` `isWritableBackend` is `'put' in backend`; unit tests assert `isWritableBackend` false/true and the SAME `restoreCache` argument array from either factory. `actions-cache-backend.spec.ts:517-531`'s pre-existing ordered-member scan (`['restoreCache','saveCache','restoreCache']`) passes with **zero edits** -- the strongest available confirmation. `npx nx test github-cache --skip-nx-cache` green (975/975). |
| 2 | VER-09: the `@actions/cache` drift guard widens from file scope to package scope, closing the future-sibling evasion | VERIFIED | `actions-cache-backend.spec.ts` (`is the ONLY non-spec module ... that imports @actions/cache (VER-09)`) asserts `toStrictEqual(['packages/github-cache/src/backend/actions-cache-backend.ts'])` against a package-wide comment-stripped glob scan. 13-02-SUMMARY.md records a live mutation: a throwaway sibling file importing `@actions/cache` scored `1 failed / 30 passed` (this clause alone red, the two file-scoped clauses stayed green) -- exactly the gap this requirement exists to close. |
| 3 | TRUST-14: `CACHE_READ_ONLY` is a strictly-narrowing env knob, read as `selectBackend`'s LAST branch; `selectBackend.length` stays 0 | VERIFIED | `select-backend.ts:67-93`: the knob branch sits immediately before `return createActionsCacheBackend()`, after every other narrowing/throw branch. `select-backend.spec.ts`'s `TRUST-14` describe: an exhaustive 5-row table asserts `widened(withoutKnob, withKnob) === false` **unconditionally** (never a negated matcher inside a single call assertion -- confirmed by reading the `widened()` helper: `return withKnob === 'writable' && withoutKnob !== 'writable'`, asserted `.toBe(false)` on every row, which is the correctly-negated quantifier form, not the vacuous predicate-negation form this repo has shipped before per project memory). Truthiness semantics (`'0'`, `'false'`, `'no'`, `'off'`, `'FALSE'`, `' '` all narrow; only unset/empty leave it writable) verified. `selectBackend.length === 0` clause untouched and green. |
| 4 | XOS-09: all three Windows legs construct the read-only backend and their counts are GATED at a floor of >= 1, with an actionable failure message | VERIFIED (structural + live pass-path), see behavior_unverified_items for the fail-path caveat | `ci.yml:512-520,624-630,715-723` -- each leg's regular pre-set step writes `CACHE_READ_ONLY=1` to `$GITHUB_ENV` before the `background: true` sidecar starts, preserving the `env: GITHUB_TOKEN` block. `ci.yml:594-603,687-696` (build/typecheck) and the test-leg equivalent -- each gate step computes the count, prints it, and `exit 1`s with a two-cause `::error::` when `count -lt 1`. Live CI run `30744366870` (recorded in `13-EVIDENCE.md`) observed gate counts `1 / 2 / 1` against a pre-registration committed as that run's own `headSha` (`631a2e7`) -- the PASS path is behaviorally proven. |
| 5 | TEST-11: the new gate clauses are non-vacuous, proven by mutation, never a bare `exit 1` | VERIFIED | `git grep -n -E "(toMatch\|toContain)\(.*exit 1"` on `dogfood-cross-os.spec.ts` returns **zero matches** -- no clause asserts the vacuous form, even though `ci.yml:527`'s readiness poll contains a bare `exit 1` that predates the gate. `dogfood-cross-os.spec.ts` clause comments record three recorded mutations (delete the whole gate step -> exactly 2 clauses redden, both for that leg; delete the knob line -> that leg's `readOnlyLeg` clause alone reddens; break one leg's comparison -> that leg's `gatedCount` clause alone reddens), each stating what was deleted and what stayed green. |
| 6 | DOCS-09: every stale site arguing the counts cannot be soundly gated is corrected in the SAME commit, bounded to exactly the seven in-scope sites | VERIFIED | `git grep -c "RECORDED, never gated" -- .github/workflows/ci.yml` = 2, and both survivors are identified by their own tokens: `ci.yml:856` (`runner.debug`, unrelated to remote-cache gating) and `ci.yml:959` (`LEG_OS`, the `integration` matrix job Phase 13 does not convert) -- confirmed both are genuinely a different, still-true claim about a different job. `git grep -c "WRITABLE sidecar" -- .github packages` = 0 (fully swept). The seven in-scope sites (3 `ci.yml` rationale comments, 3 `ci.yml` echo strings, 1 `cacheObservation` reason string) are all corrected to the inductive argument. |
| 7 | DOCS-10: the ninth env knob is enumerated as a reviewable diff, documented on all three surfaces, outcome count corrected everywhere | VERIFIED | `consumer-contract.ts` `EXPECTED_ENV_KNOBS` has 9 entries including `CACHE_READ_ONLY`; `public-surface.spec.ts`'s inline sorted literal matches it (`npx nx test github-cache -- public-surface` green). `docs/configuration.md` has both a table row and a `### CACHE_READ_ONLY` section; `docs/versioning.md` lists it; `docs/advanced.md` documents FIVE outcomes in prose and in a fifth table row placed last (branch order). `docs-adoption.spec.ts`'s fifth-outcome and count-pinning clauses are mutation-proven (both measured `1 failed \| 42 passed`). `git grep -c -i -e "four .*backend-selection outcomes" -e "has FOUR outcomes" -- docs packages README.md` returns zero matches. |

**Score:** 6/7 truths fully verified (1 present + wired + partially behavior-proven, not fully behavior-proven -- see below)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/github-cache/src/backend/actions-cache-backend.ts` | Both factories, read-only first, writable composes it | VERIFIED | Read directly; matches D-01's shape exactly; both VER-04 guards and the VER-07 mkdir moved verbatim into the read-only factory; error messages renamed to the function that actually runs. |
| `packages/github-cache/src/backend/actions-cache-backend.spec.ts` | Behavioural describes + VER-09 scan | VERIFIED | Ordered-member scan unchanged (zero edits); VER-09 package-scope scan present and mutation-proven. |
| `packages/github-cache/src/lib/select-backend.ts` | Fifth outcome, last branch, `length === 0` | VERIFIED | Read directly; knob branch is structurally last, comment-locked on position. |
| `packages/github-cache/src/lib/select-backend.spec.ts` | Narrowing-only exhaustive table | VERIFIED | `widened()` helper correctly negates the quantifier, not the predicate. |
| `packages/github-cache/src/test/consumer-contract.ts` | `CACHE_READ_ONLY` as 9th `EXPECTED_ENV_KNOBS` entry | VERIFIED | Present, grouped with other `CACHE_`-prefixed knobs. |
| `packages/github-cache/src/public-surface.spec.ts` | Inline literal grew by exactly one line, hand-edited | VERIFIED | 9-entry sorted literal present; test green. |
| `packages/github-cache/src/docs-adoption.spec.ts` | Fifth-outcome + count-pinning clauses | VERIFIED | Both present, line-scoped to avoid the pre-existing writable-Actions clause's false-pass risk. |
| `.github/workflows/ci.yml` | Knob + gate on all 3 legs, 6 corrected sites, 2 untouched survivors | VERIFIED | Read directly at all three job blocks; `-lt 1` (not `-eq 0`) x3; `::error::` x3 (new); `\|\| true` and `GITHUB_TOKEN` env unchanged. |
| `packages/github-cache/src/dogfood-cross-os.spec.ts` | 6 new per-leg clauses, corrected `cacheObservation`, no bare `exit 1` assertion | VERIFIED | Confirmed via direct read and grep; zero vacuous assertions. |
| `start-cache-server/index.js` | Regenerated, matches source | VERIFIED | `npm run check:action` exits 0 with no diff, run from the main tree. |
| `.planning/REQUIREMENTS.md` | 7 bodies + 7 traceability rows, coverage 57/57 | VERIFIED | All seven `[x]` bodies present (marked complete progressively as 13-02..13-06 landed, per the documented Pending-then-Complete lifecycle); `57 requirements, 57 mapped` present. |
| `.planning/ROADMAP.md` | Requirements line (1 physical line, all 7 IDs), 7 traceability rows, 51/51 | VERIFIED | `init.plan-phase 13` echoes all seven IDs; `51/51 v0.0.2 requirements` and both `= 51` tally lines present and arithmetically correct (5+6+5+8+9+1+5+4+4+4=51; 7+7+8+11+7+4+7=51). |
| `.planning/THREAT-MODEL.md` | One Residual-notes bullet, zero new control rows | VERIFIED | `CACHE_READ_ONLY` appears only below `## Residual notes`; no `C19` row; names branch order as the guarantee and the deliberate no-row decision. |
| `.planning/phases/13-read-only-actions-cache-backend/13-EVIDENCE.md` | Pre-registration before the run, observation appended, Case A scope stated | VERIFIED | Pre-registration commit `631a2e7` IS the proving run's `headSha`; observation records counts 1/2/1 exactly meeting pre-registered values; scope stated as Case A twice; a wrong prediction (job-log raw counts) recorded as wrong, not smoothed over. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `createActionsCacheBackend` | single `get` closure | object spread | VERIFIED | `actions-cache-backend.ts:242-247`; `serve.ts:91-95` precedent for spread-safety confirmed. |
| `select-backend.ts` (last branch) | `ci.yml` pre-set step | `$GITHUB_ENV` write, propagates to background sidecar | VERIFIED | Confirmed the sidecar's `env: GITHUB_TOKEN` block is preserved on all three legs (memory-degrade branch would otherwise fire before the knob). |
| `ci.yml` gate step | `dogfood-cross-os.spec.ts` clauses | job-block regex match on the comparison line, never `exit 1` | VERIFIED | Zero `toMatch`/`toContain` calls in the spec contain the string `exit 1`. |
| `13-EVIDENCE.md` pre-registration | proving run `30744366870` | committed BEFORE, `headSha` equality | VERIFIED | `git diff <pre-registration> HEAD -- 13-EVIDENCE.md` shows additions only (confirmed via SUMMARY's self-check; the run's recorded `headSha` matches the pre-registration commit). |
| Server 403 boundary | read-only backend | `isWritableBackend` structural check | VERIFIED | `server.ts` comment + code: "PUT to a read-only backend -> the Nx contract's 403 ... A ReadableBackend has no put". |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| VER-08 | 13-02 | Read-only backend = writable's read path, composed not duplicated | SATISFIED | Code read, tests run, ordered-member guard unchanged |
| VER-09 | 13-02 | Package-scope `@actions/cache` importer scan | SATISFIED | Scan present, mutation-proven |
| TRUST-14 | 13-03 | Strictly-narrowing last-branch knob | SATISFIED | Branch order verified mechanically + exhaustive table verified correct-direction |
| XOS-09 | 13-05, 13-06 | Three legs read-only, gated at floor 1 | SATISFIED (structural + partial live proof) | See behavior_unverified_items for the one open sub-claim |
| TEST-11 | 13-05 | Non-vacuous gate clauses | SATISFIED | Zero `exit 1` assertions; 3 mutations recorded |
| DOCS-09 | 13-05 | Stale sites corrected, bounded sweep | SATISFIED | 2 out-of-scope survivors confirmed correct |
| DOCS-10 | 13-04 | Ninth knob enumerated + documented | SATISFIED | All 3 doc surfaces + contract confirmed |

No orphaned requirements: all seven Phase-13 IDs found in both REQUIREMENTS.md and ROADMAP.md traceability tables, matching the plans' `requirements:` frontmatter exactly.

### Anti-Patterns Found

None. Scanned all files modified in this phase for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` and stub patterns (`return null`, hardcoded empty arrays feeding render, `console.log`-only bodies) -- none found. The one prior debt-marker class in this codebase (`RECORDED, never gated`) is precisely what this phase corrects, and the correction is scoped and verified above.

### Carried-Forward Item Assessed (per task instruction)

**`packages/github-cache/src/dogfood-cross-os.spec.ts:349-352`** -- flagged by both 13-05-SUMMARY.md and 13-06-SUMMARY.md as "Flagged for Review, Not Changed": the sentence "VER-06 is now PR-observable; OBS-04 is the surviving example, because its `[remote cache]` counts are RECORDED and never GATED" has an ambiguous "its."

**Assessment:** Traced the sentence's git history (introduced in commit `fee5fbe`, Phase 12, predating Phase 13 entirely) and cross-checked it against REQUIREMENTS.md's actual OBS-04 definition ("The all-restore-MISS warning's message... two consecutive all-miss pushes... `mirrored == 0`" -- a Phase 9/10 publish-leg concept, unrelated to the Windows legs' per-target `[remote cache]` counts). Every OTHER "OBS-04" reference in the tree (`ci.yml:837`, `:1058`, `:2025`, `windows-regression-detector.yml:26`) correctly uses OBS-04 as precedent for "a tripwire that fires on correct work gets disabled" -- but this ONE sentence appears to conflate that correct usage with a factual claim about `[remote cache]` counts, which is actually OBS-02's subject ("Evidence = non-zero `[remote cache]` label count, named per target"), not OBS-04's.

**Verdict: the declining-to-edit judgment call was correct.** The sentence is a pre-existing (Phase-12-era) documentation imprecision, not something Phase 13 introduced or is required to fix under DOCS-09's scope (the seven DOCS-09 sites are enumerated and this is not one of them -- it sits in the `ROBUST-04`/`action-bundle-drift` describe block, a different topic). Editing it under either candidate reading risks deleting a true claim, which is exactly the failure mode the project's own DOCS-09 sweep was built to avoid (D-06/the bounded-sweep pattern). This is a real, pre-existing defect worth a small follow-up (recommend a future quick task retitle the reference to OBS-02 or otherwise disambiguate), but it does **not** block Phase 13's goal and is correctly out of this phase's scope.

### Human Verification Required

#### 1. Live gate-reddening on a genuine cross-OS restore failure (XOS-09)

**Test:** On a real `windows-11-arm` CI run, after a ubuntu producer has genuinely populated an entry, deliberately break cross-OS restore for one leg (e.g., temporarily corrupt the archive path constant or pin an `@actions/cache` version known to break `enableCrossOsArchive`) and confirm that leg's job goes RED with the `::error::` message naming both possible causes, then revert.

**Expected:** The job fails (exit 1) rather than silently passing, and the `::error::` annotation is legible and actionable.

**Why human:** The gate's shell comparison is pinned only as TEXT in `dogfood-cross-os.spec.ts` (regex-matched against the `ci.yml` source) and proven non-vacuous by mutating the SPEC's input, not by executing the real bash. The one live CI run recorded (`30744366870`) exercised only the PASS path (counts 1/2/1, all meeting the floor); `13-EVIDENCE.md` and `13-05-SUMMARY.md` both explicitly and honestly state the FAIL path was "not observed, and deliberately not induced." This is a genuine state-transition (green job -> red job) that no automated check in this repository exercises end-to-end.

**Note for the decision-maker:** This exact class of limitation (a live-CI-only observation deferred as a named follow-up) has established precedent in this same project -- Phase 12's XOS-05 was marked "Complete" on analogous grounds (structural gate + a live run observing the pass path, with reddening proof deferred). If that precedent is acceptable here too, this item can be waived and the phase treated as `passed`; it is surfaced rather than silently accepted because the adversarial verification stance requires flagging state-transitions that are present+wired but not behaviorally proven, rather than defaulting to VERIFIED on presence alone.

### Gaps Summary

No gaps. All seven requirement IDs (VER-08, VER-09, TRUST-14, XOS-09, TEST-11, DOCS-09, DOCS-10) are satisfied by code that was read directly, tests that were run directly (`npx nx test github-cache --skip-nx-cache`: 975/975 passing; `npx nx run-many -t typecheck lint --projects=github-cache --skip-nx-cache`: clean; `npm run check:action`: clean, no bundle drift), and a live CI run (`30744366870`) that behaviorally confirms the pass path. Traceability and coverage tallies in both ROADMAP.md and REQUIREMENTS.md are arithmetically correct and internally consistent. The THREAT-MODEL.md residual note is present and the C1-C18 ledger is unchanged. The sole human-verification item is a live-CI behavioral proof of the gate's FAIL path, which is a known, honestly-disclosed, and precedented class of deferred observation in this project -- not a defect in the delivered work.

---

*Verified: 2026-08-02*
*Verifier: Claude (gsd-verifier)*
