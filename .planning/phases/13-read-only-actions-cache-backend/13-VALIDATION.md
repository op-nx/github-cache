---
phase: 13
slug: read-only-actions-cache-backend
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-02
audited: 2026-08-02
audited_at_head: eb57440
---

# Phase 13 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `13-RESEARCH.md` § Validation Architecture. The Per-Task Verification Map is filled
> at plan time (task IDs do not exist until PLAN.md files are written) and audited post-execution
> by `/gsd:validate-phase`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest, via `@nx/vitest` (`nx.json:28-32`, `testTargetName: "test"`) |
| **Config file** | `packages/github-cache/vitest.config.mts` |
| **Quick run command** | `npx nx test github-cache` |
| **Full suite command** | `npm run test` (= `nx run-many -t test`) |
| **Bundle drift check** | `npm run check:action` — **MAIN TREE ONLY** (a junctioned worktree reports false drift) |
| **Estimated runtime** | package suite is fast; the from-disk CI pins are cheap |

---

## Sampling Rate

- **After every task commit:** `npx nx test github-cache`
- **After every plan wave:** `npm run test` **plus** `npm run check:action` from the main tree.
  The bundle check is NOT part of `nx test` and is the single most likely thing to be forgotten —
  editing any `serve()`-reachable source drifts the committed `start-cache-server/index.js`.
- **Before `/gsd:verify-work`:** full suite green + `check:action` clean + a real CI run showing all
  three gated Windows legs green.
- **Post-merge, separate PR:** the Q4 Case-B observation. Do NOT fold it into the landing commit —
  that commit rotates all three hashes, so every leg takes the intra-run merge-ref path (Case A)
  and cannot exhibit Case B.

---

## Per-Task Verification Map

Filled post-execution (2026-08-02, head `eb57440`). Task IDs are the `coverage:` deliverable IDs
from each plan's SUMMARY frontmatter, which is where this phase actually tracked units of work.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 13-01 D1 | 01 | 1 | (registration) | T-13-01-R1 | Seven requirement bodies land, each citing a decision ID | smoke | `gsd-tools query init.plan-phase 13` | `.planning/REQUIREMENTS.md` | ✅ green |
| 13-01 D2 | 01 | 1 | (registration) | T-13-01-R1 | Traceability tallies reconcile 57 / 51 with the six-ID gap named | smoke | one-shot scratchpad parse (not retained) | `.planning/REQUIREMENTS.md`, `ROADMAP.md` | ⚠️ one-shot |
| 13-01 D3 | 01 | 1 | (registration) | T-13-01-R1 | `**Requirements**:` survives `init.plan-phase` on ONE physical line | smoke | `gsd-tools query init.plan-phase 13` | `.planning/ROADMAP.md` | ✅ green |
| 13-01 D4 | 01 | 1 | XOS-09 | -- | Case-B live-CI item registered with its procedure | manual | none -- see Manual-Only | `.planning/ROADMAP.md` | 🔒 manual-only |
| 13-01 D5 | 01 | 1 | (registration) | T-13-01-R2 | Residual-notes bullet records the narrowing asymmetry; C1-C18 unchanged | smoke | one-shot scratchpad parse (not retained) | `.planning/THREAT-MODEL.md` | ⚠️ one-shot |
| 13-02 D1 | 02 | 2 | VER-08 | T-13-02-E1 | Read-only factory has NO `put`; `isWritableBackend` false | unit | `npx nx test github-cache --skip-nx-cache` | `backend/actions-cache-backend.spec.ts:235,245` | ✅ green |
| 13-02 D2 | 02 | 2 | VER-08 | T-13-02-T1 | ONE `get` closure -- same HIT and same whole `restoreCache` argument array from either factory | unit | same | `backend/actions-cache-backend.spec.ts:259,285` + ordered-member scan `:340-362` | ✅ green |
| 13-02 D3 | 02 | 2 | VER-08 | T-13-02-R1 | VER-04 cwd + `GITHUB_WORKSPACE` guards FIRE from the read-only factory | unit | same | `backend/actions-cache-backend.spec.ts:787,794` | ✅ green |
| 13-02 D3b | 02 | 2 | VER-08 | T-13-02-R1 | The VER-04 message names the function that actually ran | manual | none -- deliberately unpinned, see Manual-Only | `backend/actions-cache-backend.ts:141,158` | 🔒 manual-only |
| 13-02 D4 | 02 | 2 | VER-09 | T-13-02-T1 | Exactly ONE non-spec module under `src/` imports `@actions/cache`, at PACKAGE scope | unit | same | `backend/actions-cache-backend.spec.ts:687` | ✅ green (mutation-proven) |
| 13-02 D5 | 02 | 2 | VER-08 | T-13-02-T2 | Committed bundle matches source | smoke | `npm run check:action` (MAIN TREE) | `start-cache-server/index.js` | ✅ green |
| 13-03 D1 | 03 | 3 | TRUST-14 | T-13-03-E1 | Knob + write-trusted env yields the read-only ACTIONS backend, not the memory stub | unit | `npx nx test github-cache --skip-nx-cache` | `lib/select-backend.spec.ts:375` | ✅ green |
| 13-03 D2 | 03 | 3 | TRUST-14 | T-13-03-E1 | Exhaustive narrowing-only table over 5 env shapes, quantifier negated via `widened()`, plus two-way throw parity | unit | same | `lib/select-backend.spec.ts:423` | ✅ green |
| 13-03 D3 | 03 | 3 | TRUST-14 | T-13-03-E1 | **Branch order:** the memory-degrade branch stays AHEAD of the knob | unit | same | `lib/select-backend.spec.ts:450-491` **(added by this audit)** | ✅ green (mutation-proven, reddens ALONE) |
| 13-03 D4 | 03 | 3 | TRUST-14 | T-13-03-E2 | `selectBackend.length === 0` -- the knob is an env key, never a parameter | unit | same | `lib/select-backend.spec.ts:298-305` | ✅ green |
| 13-03 D5 | 03 | 3 | TRUST-14 | T-13-03-V1 | Truthiness, not `=== 'true'`: a non-empty typo still NARROWS; unset/empty does not | unit | same | `lib/select-backend.spec.ts:456,467` | ✅ green |
| 13-03 D6 | 03 | 3 | TRUST-14 | T-13-03-T1 | Bundle carries the knob and matches source | smoke | `npm run check:action` (MAIN TREE) | `start-cache-server/index.js` | ✅ green |
| 13-04 D1 | 04 | 4 | DOCS-10 | T-13-04-V1 | `CACHE_READ_ONLY` is the 9th `EXPECTED_ENV_KNOBS` entry, hand-edited not snapshotted | unit | `npx nx test github-cache --skip-nx-cache` | `public-surface.spec.ts:159-170` | ✅ green |
| 13-04 D2 | 04 | 4 | DOCS-10 | T-13-04-V1 | Knob documented on all three consumer surfaces, `it.each` over the same source list | unit | same | `docs-adoption.spec.ts:52-54,82` | ✅ green |
| 13-04 D3 | 04 | 4 | DOCS-10 | T-13-04-R1 | `advanced.md` documents FIVE outcomes, table row last, mirroring branch order | unit | same | `docs-adoption.spec.ts:153,171` | ✅ green (mutation-proven) |
| 13-04 D4 | 04 | 4 | DOCS-10 | T-13-04-R1 | No "four outcomes" text survives in `docs/`, `packages/` or `README.md` | unit + smoke | same, plus `git grep -c -i -e "four .*backend-selection outcomes" -e "has FOUR outcomes" -- docs packages README.md` | `docs-adoption.spec.ts:171` | ✅ green |
| 13-04 D5 | 04 | 4 | DOCS-10 | T-13-04-R1 | Fifth outcome and the count are BOTH spec-pinned and non-vacuous | unit | same | `docs-adoption.spec.ts:153,171` | ✅ green (2 mutations) |
| 13-04 D6 | 04 | 4 | DOCS-10 | T-13-04-E1 | `EXPECTED_ACTION_INPUTS` still exactly `['port']` -- option (c) not silently taken | unit | same | `public-surface.spec.ts` | ✅ green |
| 13-05 D1 | 05 | 5 | XOS-09 | T-13-05-T1 | All three Windows legs write `CACHE_READ_ONLY=1` to `$GITHUB_ENV` | unit (from disk) | `npx nx test github-cache --skip-nx-cache` | `dogfood-cross-os.spec.ts:978,1119,1235` | ✅ green (mutation 2) |
| 13-05 D2 | 05 | 5 | XOS-09 | T-13-05-R1 | Each leg FAILS below a count of 1 -- the COMPARISON line is matched, never `exit 1` | unit (from disk) | same | `dogfood-cross-os.spec.ts:1011,1127,1243` | ✅ green (mutations 1, 3) |
| 13-05 D3 | 05 | 5 | TEST-11 | T-13-05-R1 | The gate clauses are non-vacuous BY MEASUREMENT, not by the readiness poll's `exit 1` | unit + manual | same, plus `git grep -n -E "(toMatch\|toContain)\(.*exit 1" -- packages/github-cache/src/dogfood-cross-os.spec.ts` -> no matches | `dogfood-cross-os.spec.ts:886-893` mutation record | ✅ green (3 mutations recorded) |
| 13-05 D4 | 05 | 5 | DOCS-09 | T-13-05-R2 | No comment or printed string inside the three Windows blocks still argues the counts cannot be gated (UNDER-sweep) | unit (from disk) | same | `dogfood-cross-os.spec.ts:1017,1133,1249` | ✅ green |
| 13-05 D5 | 05 | 5 | DOCS-09 | T-13-05-D1 | The two record-only survivors stay PRESENT, each by its own token, marker pinned at exactly 2 (OVER-sweep) | unit (from disk) | same | `dogfood-cross-os.spec.ts:1305-1359` (landed `7968f21`) | ✅ green (mutation-proven 3 ways) |
| 13-05 D6 | 05 | 5 | XOS-09 | T-13-05-D2 | Sidecar `GITHUB_TOKEN` survives per leg | unit (from disk) | same | `dogfood-cross-os.spec.ts:1020,1136,1252` | ✅ green |
| 13-05 D6b | 05 | 5 | XOS-09 | T-13-05-D2 | `\|\| true` tolerant brace group survives | smoke | `git grep -c -F "\|\| true" -- .github/workflows/ci.yml` -> 19 | not spec-pinned | ⚠️ smoke-only (fail-safe direction -- see Audit note) |
| 13-06 D1 | 06 | 6 | TEST-11 | -- | Full local battery green from the MAIN tree, gating targets executed not replayed | smoke | `npx nx run-many -t test typecheck lint --skip-nx-cache` + `npm run check:action` | -- | ✅ green |
| 13-06 D2 | 06 | 6 | XOS-09 | T-13-06-R1 | Per-leg counts pre-registered in a commit PRECEDING the proving run | manual | none -- see Manual-Only | `13-EVIDENCE.md`, commit `631a2e7` | ✅ observed (run `30744366870`) |
| 13-06 D3 | 06 | 6 | XOS-09 | T-13-06-R1 | Run recorded with id, three per-leg counts, each ubuntu producer's line | manual | none | `13-EVIDENCE.md` | ✅ observed (1/2/1) |
| 13-06 D4 | 06 | 6 | XOS-09 | T-13-06-R2 | Evidence states Case A and does not imply the base-scope read | manual | none | `13-EVIDENCE.md` | ✅ observed |
| 13-06 D5 | 06 | 6 | TEST-11 | -- | Assumption A1 answered by observation rather than deferred silently | manual | none -- deliberately no standing guard, see Manual-Only | `13-EVIDENCE.md` ADDENDUM 3 | CLOSED (quick `260803-0rr`, local measurement) |
| 13-06 D6 | 06 | 6 | XOS-09 | T-13-06-R1 | Pre-registration never back-edited | smoke | `git diff 631a2e7 HEAD -- 13-EVIDENCE.md` shows 0 deletions | `13-EVIDENCE.md` | ✅ green |

**Requirement → behavior coverage (from RESEARCH.md; the planner maps these onto task IDs):**

`Exists?` re-evaluated against HEAD `eb57440` on 2026-08-02. Every "NO — Wave 0" cell was the
PLAN-TIME state; the post-execution state is recorded after the arrow.

| Req | Behavior | Command | Exists? |
|-----|----------|---------|---------|
| VER-08 | Exactly one `cache.restoreCache` READ site; ordered `cache.*` members unchanged | `npx nx test github-cache --skip-nx-cache` | YES — ordered-member scan passes with ZERO edits, which is the phase's own confirmation the composed shape is right |
| VER-08 | Read-only factory returns a `ReadableBackend` with NO `put`; `isWritableBackend` false | same | NO — Wave 0 -> **YES**, `actions-cache-backend.spec.ts:235,245` |
| VER-08 | Both factories share ONE `get` — read-only and writable restore identically | same | NO — Wave 0 -> **YES**, `:259` (same whole argument array), `:285` (same MISS) |
| VER-08 | VER-04 guards fire from the READ-ONLY factory too (wrong cwd throws; divergent `GITHUB_WORKSPACE` throws) | same | NO — Wave 0 -> **YES**, `:787,794` |
| VER-08 | `enableCrossOsArchive` still at the 5th/4th/5th positional across all three sites | same | YES — still green |
| VER-09 | Exactly one non-spec module under `src/` imports `@actions/cache` | same | NO — Wave 0 -> **YES**, `:687`, exact array not a count, comment-stripped, mutation-proven (throwaway importer scored 1 failed / 30 passed with both file-scoped clauses GREEN) |
| TRUST-14 | `selectBackend.length === 0` unchanged | `npx nx test github-cache --skip-nx-cache` | YES — `select-backend.spec.ts:298-305` |
| TRUST-14 | Knob set + fully write-trusted env → read-only Actions backend | same | NO — Wave 0 -> **YES**, `:375`; drives `get()` and asserts `restoreCache` ran, which is what tells the read-only Actions backend apart from the memory stub |
| TRUST-14 | **Narrowing-only, exhaustive (LOAD-BEARING):** for every enumerated env shape, the knob NEVER makes writable what was not writable without it. Assert the implication in the correct direction — `writable(withKnob) => writable(withoutKnob)` — never a negated matcher inside a single call assertion | same | NO — Wave 0 -> **YES**, `:423`. Shape verified against the trap: the quantifier is negated via a `widened()` helper, NOT a matcher inside a call assertion; every row also PINS its un-knobbed outcome, so a row that stopped reaching its branch cannot pass trivially |
| TRUST-14 | **Branch order: the memory-degrade branch stays AHEAD of the knob** | same | **GAP FOUND AND FILLED by this audit** — `:450-491`. Was NOT covered at HEAD: hoisting the knob above `resolveGitHubToken` left all 978 tests green |
| TRUST-14 | Truthiness: a non-empty typo value still NARROWS (fail-safe direction) | same | NO — Wave 0 -> **YES**, `:456` (6 values) plus `:467` (unset/empty leaves writable intact — the half that stops a permanently-on switch) |
| XOS-09 | Each Windows leg writes the read-only knob to `$GITHUB_ENV` | same | NO — Wave 0 -> **YES**, `dogfood-cross-os.spec.ts:978,1119,1235`; `ci.yml` carries the line 3x |
| XOS-09 | Each leg's count is COMPARED and the comparison can fail — **assert the comparison line, never `exit 1`** | same | NO — Wave 0 -> **YES**, `:1011,1127,1243` match `/^ {10}if \[ "\$\{count\}" -lt 1 \]; then$/m`. Trap 10 checked: no `toMatch`/`toContain` argument in the file contains `exit 1`, so the pre-existing readiness-poll `exit 1` at `ci.yml:527` cannot satisfy any clause |
| XOS-09 | The gate actually reddens on a real cross-OS restore failure | CI-only behavioural | **SATISFIED — run `30745558383`**: `build-windows` red AT THE GATE STEP at count 0, with `typecheck-windows` / `test-windows` green at 2/1 in the SAME run as a positive control. No longer pending |
| TEST-11 | `RECORDED, never gated` absent from all three job blocks | same | NO — Wave 0 -> **YES**, `:1017,1133,1249`, scoped per `jobBlock()` — NOT a file-wide zero count (see the DOCS-09 row) |
| TEST-11 | New clauses are NON-VACUOUS (mutation-proven) | manual, recorded | **DONE** — 3 mutations recorded in-file at `:886-893`: gate step deleted (2 clauses red, both that leg's, mutated block still containing the readiness `exit 1`); knob line deleted (1 red, alone); `-lt 1` -> `-lt 0` (1 red, alone) |
| DOCS-09 | No stale site survives | ~~`git grep -n "RECORDED, never gated\|WRITABLE sidecar" -- .github packages` returns nothing~~ — **the draft's command is WRONG at HEAD**; see below | **YES, and now FULLY automated in both directions** |
| DOCS-09 | UNDER-sweep: no surviving claim inside the three Windows job blocks | `npx nx test github-cache --skip-nx-cache` | YES — the three per-leg `not.toContain('RECORDED, never gated')` clauses |
| DOCS-09 | OVER-sweep: the two DELIBERATE record-only survivors stay present, and no third appears | same | **YES — new at `7968f21`**, `:1305-1359`. Each survivor pinned by its own surrounding token (`RUNNER_DEBUG_OBSERVED`, `LEG_OS`) plus an exact marker-site count of 2 (exact, not a floor, so a third ungated record cannot appear in silence) |
| DOCS-10 | Knob documented in `configuration.md` | `npx nx test github-cache --skip-nx-cache` | YES — `docs-adoption.spec.ts:52-54,82` |
| DOCS-10 | `EXPECTED_ENV_KNOBS` matches the reviewed inline literal | same | YES — `public-surface.spec.ts:159-170`; the predicted RED was observed and resolved (1 failed / 13 passed before the literal edit; +1 insertion / -0 deletions) |
| DOCS-10 | `advanced.md` documents FIVE outcomes, not four | same | NO — Wave 0 -> **YES**, `docs/advanced.md:21` now reads "FIVE outcomes"; pinned by `docs-adoption.spec.ts:171`, mutation-proven twice |
| (bundle) | Committed bundle matches source | `npm run check:action` | YES — re-run clean from the MAIN tree during this audit |

**Correction to the draft's DOCS-09 command.** `git grep "RECORDED, never gated" -- .github packages`
returns 9 hits at HEAD and that is CORRECT, not a regression. Two are the deliberate `ci.yml`
survivors T-13-05-D1 preserves; the other seven are inside `dogfood-cross-os.spec.ts` itself —
the clause comments and the two survivor regexes. That is trap 6 (prose in a scanned file is input
to its own criterion) in its purest form: a blanket file-wide zero count would be a permanent false
red. The sweep is correctly SCOPED per `jobBlock()`, and the file-wide direction is covered instead
by the exact-count survivor pin. The `WRITABLE sidecar` half of the draft's command does still
return zero (exit 1, genuine no-match, positive control confirmed).

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `packages/github-cache/src/backend/actions-cache-backend.spec.ts` — new describes for the
      read-only factory (no `put`; shared `get`; VER-04 guards fire from it) — VER-08
      *(verified at `:228-300`, `:787-801`)*
- [x] `packages/github-cache/src/backend/actions-cache-backend.spec.ts` — the package-scope
      `@actions/cache` importer scan — VER-09 *(verified at `:660-712`, exact array, mutation-proven)*
- [x] `packages/github-cache/src/lib/select-backend.spec.ts` — the knob's read-only outcome, the
      exhaustive narrowing-only table, and truthiness semantics — TRUST-14
      *(verified at `:365-491`; the branch-order clause at `:450-491` was MISSING and was added by
      this audit — see Validation Audit 2026-08-02)*
- [x] `packages/github-cache/src/dogfood-cross-os.spec.ts` — three new per-leg clauses (knob write,
      count comparison, absent revert marker) plus their reason strings — XOS-09 / TEST-11
      *(verified at `:978/1011/1017`, `:1119/1127/1133`, `:1235/1243/1249`; the OVER-sweep
      counterpart at `:1305-1359` landed later in `7968f21`)*
- [x] Framework install: **none needed** — Vitest is present and configured *(confirmed: no
      dependency changed this phase, which is itself load-bearing — a dependency change would
      rotate the task hashes the proving run measured)*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions | Status |
|----------|-------------|------------|-------------------|--------|
| The gate reddens on a real cross-OS restore failure | XOS-09 | Only observable on a real `windows-11-arm` runner after a ubuntu leg has saved | Land the change; record the run id showing all three gated legs green; then confirm the failure direction | **CLOSED** -- run `30745558383`: `build-windows` red AT THE GATE STEP at count 0, `typecheck-windows`/`test-windows` green at 2/1 in the SAME run as a positive control. Green direction: runs `30744366870` (1/2/1 against a pre-registration in the same sha `631a2e7`) and `30746080731` |
| New gate clauses are non-vacuous | TEST-11 | Vacuity is a property of the assertion, not of the run | Mutate the gate step out of one leg; confirm exactly the intended clause reddens. **`ci.yml:527` is already `exit 1`, so a clause matching `/exit 1/` is green today, before any change** | **CLOSED** -- 3 mutations recorded in-file at `dogfood-cross-os.spec.ts:886-893`; trap 10 additionally re-checked this audit (no `toMatch`/`toContain` argument in the file contains `exit 1`) |
| **PR restores from the base/default-branch scope (Case B)** | Q4 / XOS-09 | Live-CI behavioural; a spec cannot close it. Stays manual permanently | Executed as specified: draft PR #14 off `main` with a `.planning`-only diff, assumption A2 verified against the live Nx graph first | **CLOSED by quick `260802-toz`** (`13-EVIDENCE.md` ADDENDUM 3). Run `30768540898`, head `7188a66` = the pre-registration commit. All three ubuntu producers HIT with NO `Sent` line, so nothing entered the merge-ref scope, yet all three Windows legs restored `main`-scope keys byte-identically at counts 1 / 2 / 1. **Scope:** proves "restored from a scope populated before the run, outside this run's merge ref"; does NOT separate BASE from DEFAULT scope (same ref for a PR off `main`). Note run `30746080731` did NOT close it -- no hash rotated there, so it consumed the same producer entries |
| **RESEARCH assumption A1 -- the 403 log-noise path** | TEST-11 | Third-party client behaviour: a standing guard here would test Nx and redden on an unrelated bump, and the failure mode is self-announcing (it would redden read-only legs on any partial miss) | Superseded. The stated CI observation condition was never met and was not needed -- see the closure below | **CLOSED by quick `260803-0rr`** (`13-EVIDENCE.md` ADDENDUM 3). Answered AFFIRMATIVELY by local measurement, not by the landing run: four PUTs observed across two runs, each refused 403, Nx silent on all nine noise tokens, build green. **Scope:** local; the CI inference rests on the client-side property *given a 403 to a store, this pinned Nx emits no output* being environment-independent. No CI run has directly observed a PUT arriving. Deliberately NOT converted to a standing test |
| The VER-04 message names the function that actually ran | VER-08 / T-13-02-R1 | Pinning a function-name prefix in a spec would mean the guard has to be edited by the very change it guards -- the tautological-guard shape this phase exists to attack | The two VER-04 clauses assert the message's SUBSTANCE (`/nx\.json/`, `/GITHUB_WORKSPACE/`), which is the durable half. Re-read `actions-cache-backend.ts:141,158` by eye whenever either factory is renamed | **ACCEPTED as manual by design** (documented rationale at `actions-cache-backend.spec.ts:783-786`). Note the SUMMARY's `git grep "createActionsCacheBackend:"` check must exclude `*.spec.ts` -- unscoped it now hits a mock key at `publish/publish-mirror.spec.ts:26` |

---

## Validation Audit 2026-08-02

**Audited at head:** `eb57440` (branch `gsd/v0.0.2-os-invariant-cross-os-sharing`)
**Baseline measured, not assumed:** `npx nx test github-cache --skip-nx-cache` -> 42 files /
978 tests / 0 failures, `Cache: Skipped (--skip-nx-cache)`. LINT-04 exists because this repo has
shipped a stale-cache false PASS, so no cached green was accepted anywhere in this audit.

**Question answered.** `13-VERIFICATION.md` answered "was the requirement delivered" and found
7/7. This audit answers the different question: "is the delivered behavior sampled by an automated
check that would REDDEN if the behavior regressed". They came apart in exactly one place.

### Gaps found: 1

**GAP-13-V1 -- TRUST-14 branch order (T-13-03-E1, high) had NO automated coverage.**

`select-backend.ts:33-35` claims the "it is last" guarantee is "checked mechanically by
first-occurrence position", and `:80-81` claims the property "is asserted mechanically by the
narrowing table in `select-backend.spec.ts`". Neither was true at HEAD. The mechanical `indexOf`
comparison was an ad-hoc one-shot run during plan 13-03 and never became a clause;
`select-backend.spec.ts` does not read `select-backend.ts` at all.

Measured, not argued -- two mutations of `select-backend.ts`, both restored and confirmed with
`git diff --quiet`:

| # | Mutation | Result at HEAD (before the fix) |
|---|----------|--------------------------------|
| A | Knob branch hoisted to the TOP of `selectBackend`, above `isWriteTrusted` | 1 red -- the `narrowing-only (malformed repository identity)` row, via the two-way throw-parity assertion. So this direction WAS covered |
| B | Knob branch hoisted above `resolveGitHubToken` only -- **exactly T-13-03-E1's registered shape** | **0 red. 42 files / 978 tests all GREEN** |

Why the exhaustive table is blind to B: `outcomeOf` collapses BOTH read-only outcomes to the single
token `'read-only'`. The memory-degrade backend and the read-only Actions backend are
indistinguishable to `isWritableBackend`, so `widened()` stays false and every row passes while the
fail-safe branch has been bypassed. Behavioural consequence of the unguarded regression: a
write-trusted leg with the knob set and NO resolvable token would construct a real Actions-cache
backend instead of the memory stub.

This is the phase's own defect class -- a guard that reads as coverage without being it -- surviving
inside the phase that exists to remove it.

### Gaps resolved: 1

Added `packages/github-cache/src/lib/select-backend.spec.ts:450-491`:

> `keeps the memory-degrade branch AHEAD of the knob: a token-less write-trusted env still degrades
> to MEMORY, not to a read-only ACTIONS backend (TRUST-14, T-13-03-E1)`

Behavioural, not structural. It reuses the discriminator the D1 clause already established -- only
ONE of the two read-only outcomes touches `@actions/cache` -- and applies it to the complementary
case the file never covered. Both halves live inside one test so neither can be deleted without the
other: the positive control (same env WITH a token DOES reach `restoreCache`) is what stops
`not.toHaveBeenCalled()` being satisfied by an inert mock.

**Mutation proof of the new clause (the house standard -- an unmutated new test is decoration):**

| Step | Command | Result |
|------|---------|--------|
| Clause added, tree clean | `npx nx test github-cache --skip-nx-cache` | 42 files / **979** tests, 0 failures |
| Mutation B re-applied | same | **1 failed / 978 passed** -- `AssertionError: expected "vi.fn()" to not be called at all, but actually been called 1 times`. The new clause reddens, and it reddens **ALONE** |
| Restored | `git diff --quiet packages/github-cache/src/lib/select-backend.ts` | clean; `npm run check:action` clean from the MAIN tree, confirming a byte-exact restore |

Post-fix battery, all cache-skipped from the MAIN tree: `nx run-many -t test typecheck lint
--skip-nx-cache` exit 0 (979 tests), `npm run format:check` clean, `npm run check:action` clean.

### Gaps escalated: 0

No implementation file was modified. No implementation bug was found -- GAP-13-V1 was a missing
guard, not a broken behavior; the shipped branch order is correct.

### Findings that did NOT become gaps

- **WARNING -- the draft's DOCS-09 command is obsolete.** `git grep "RECORDED, never gated" --
  .github packages` returns 9 hits at HEAD, all legitimate (2 deliberate `ci.yml` survivors + 7
  self-references inside the scanning spec). Corrected in the coverage table above. A blanket
  file-wide zero count would be a permanent false red -- trap 6.
- **WARNING -- `13-05 D6b` (`|| true` retention, T-13-05-D2) is smoke-only, not spec-pinned.** Left
  uncovered deliberately: the failure direction is fail-SAFE. Losing the tolerant brace group makes
  the leg abort before the comparison, so it goes red anyway; it degrades diagnosis, it cannot
  launder a broken restore. Its sibling (`GITHUB_TOKEN` per leg) IS spec-pinned at `:1020,1136,1252`
  because losing THAT one takes the memory-degrade branch and reddens the gate for the wrong reason.
- **WARNING -- `13-01 D2` / `D5` were verified by one-shot scratchpad scripts** that were not
  retained. These are planning-document tallies, not shipped behavior; they cannot regress without a
  deliberate edit to `.planning/`. Not worth a permanent guard.
- **Trap checks run and passed:** the TRUST-14 narrowing table negates the QUANTIFIER via a
  `widened()` helper rather than using a negated matcher inside a call assertion (trap 7 / the
  draft's own flag); every row pins its un-knobbed outcome, so no row can pass vacuously (trap 8);
  no `toMatch`/`toContain` argument in `dogfood-cross-os.spec.ts` contains `exit 1`, so the
  pre-existing `ci.yml:527` readiness-poll `exit 1` satisfies nothing (trap 10).

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies -- with four items deliberately
      Manual-Only (Case B, A1, the VER-04 prefix, `|| true`), each with its reason and instruction
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references -- all five items verified present at HEAD
- [x] No watch-mode flags -- every command in this file is a single-shot run
- [x] `check:action` run from the MAIN tree, not a worktree -- clean, twice (post-mutation restore
      and post-fix)
- [x] Every generated test mutation-proven before being claimed as coverage
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved (2026-08-02, at head `eb57440` plus the one generated clause).
`nyquist_compliant: true` and `wave_0_complete: true` are set on measurement, not on assertion:
978 -> 979 tests, the one gap found was closed with a clause that was proven to redden alone under
the mutation it guards, and the two live-CI items (Case B, A1) remain OPEN and manual by design
rather than being laundered into coverage.

### Post-approval note -- 2026-08-03, both live-CI items since CLOSED

The approval above is a dated snapshot and is left as written: at `eb57440` both items WERE open,
and the sign-off's claim is about what that audit did, not about their permanent status. Both have
since closed, by two quick tasks rather than by this phase's execution, and the two Manual-Only
rows above are updated to match:

- **Case B** -- quick `260802-toz`, run `30768540898`.
- **Assumption A1** -- quick `260803-0rr`, local measurement.

Neither closure adds automated coverage, so `nyquist_compliant` is unaffected. Both remain
Manual-Only by design: Case B is live-CI behavioural, and A1 is third-party client behaviour whose
regression is self-announcing. Full record: `13-EVIDENCE.md` ADDENDUM 3.
