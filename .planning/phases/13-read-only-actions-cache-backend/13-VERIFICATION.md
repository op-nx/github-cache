---
phase: 13-read-only-actions-cache-backend
verified: 2026-08-03T01:45:00Z
verified_at_head: 4ac20dc
status: passed
score: 7/7 must-haves verified
behavior_unverified: 0
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
re_verification:
  previous_verification: 2026-08-02T13:20:00Z
  previous_status: human_needed
  previous_score: 6/7
  reason: >-
    The 2026-08-02 snapshot returned human_needed on exactly one item -- the gate's FAIL
    direction had never executed on a real runner. That item was closed by live observation
    afterwards (run 30745558383, head bafd7be) and is re-verified here against the GitHub
    Actions API directly, not against the prose that records it. Status reached by
    re-verification; the prior frontmatter was NOT edited.
  human_items_closed:
    - "Live gate-reddening on a genuine cross-OS restore failure (XOS-09) -- CLOSED, verified independently at step granularity on run 30745558383"
  gaps_remaining: []
  regressions: []
deferred: []
behavior_unverified_items: []
---

# Phase 13: Read-Only Actions-Cache Backend Verification Report

**Phase Goal:** Make "read the Actions cache, never write it" a representable backend, so the three
Windows reuse legs (`build-windows` / `typecheck-windows` / `test-windows`) can be GATED on a
genuine cross-OS HIT instead of merely recording one -- without giving the `@actions/cache`
cache-version computation a second place to drift.

**Verified:** 2026-08-03T01:45:00Z
**Verified at head:** `4ac20dc` (branch `gsd/v0.0.2-os-invariant-cross-os-sharing`)
**Status:** passed
**Re-verification:** Yes -- the 2026-08-02 `human_needed` snapshot is superseded (preserved verbatim
at the end of this file). The verdict below was reached from the codebase and from the GitHub
Actions API, not by editing the prior frontmatter.

---

## What changed since the superseded snapshot

The prior verification held exactly one item open: the gate's FAIL direction had never executed on a
real runner. Non-vacuity had been proven by mutating the SPEC's input, which proves the clause
detects the gate's absence -- not that the real bash exits 1 and reddens the job. Three live
observations postdate that snapshot, and all three were re-derived here from the API rather than
read out of `13-EVIDENCE.md`:

| Observation | Cited in | Independently confirmed here |
|---|---|---|
| XOS-09 gate, PASS direction | ADDENDUM 1 / ROADMAP | Yes -- run `30744366870`, gate lines read out of the raw job logs |
| XOS-09 gate, FAIL direction | ADDENDUM 1 | Yes -- run `30745558383`, confirmed at STEP granularity |
| Case B (base-scope read) | ADDENDUM 3 / ROADMAP | Yes -- run `30768540898`, producers' `Sent`/HIT lines counted from the raw logs |

Assumption A1 (ADDENDUM 3, quick `260803-0rr`) is a RESEARCH assumption, not a Phase 13
requirement, and it is treated as such below: its closure is noted, its narrow scope is respected,
and no truth in this report depends on it.

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence gathered in this verification |
|---|-------|--------|----------------------------------------|
| 1 | VER-08: the read-only backend is the writable one's read path; a write is unrepresentable, and exactly ONE `restoreCache` READ call site survives | VERIFIED | Read `actions-cache-backend.ts` end to end. `createReadOnlyActionsCacheBackend` (`:88-219`) returns `ReadableBackend` whose object literal contains `get` and nothing else. `createActionsCacheBackend` (`:242-244`) is `{ ...createReadOnlyActionsCacheBackend(), put(...) }`. Call-site census over all non-spec package sources: `restoreCache` at `:192` (the READ, inside the read-only factory) and `:340` (the `lookupOnly: true` existence probe inside `put`); `saveCache` at `:319`. One READ call site, one file. |
| 2 | VER-09: the drift guard is package-scoped, closing the future-sibling evasion | VERIFIED | Read the clause body at `actions-cache-backend.spec.ts:622-708`. It is a genuine recursive `readdirSync(PACKAGE_SOURCE_ROOT, {recursive: true})` over `packages/github-cache/src`, filters to non-spec `.ts`, strips line-leading comments, matches `/['"]@actions\/cache(?:\/[^'"]*)?['"]/` (so deep subpaths, `require` and dynamic `import` are all caught), and asserts `toStrictEqual([...actions-cache-backend.ts])` -- an exact array, not a count. Clause green in this run. |
| 3 | TRUST-14: strictly-narrowing knob, read as the LAST branch; `selectBackend.length` stays 0 | VERIFIED | Read `select-backend.ts` in full: the `if (env.CACHE_READ_ONLY)` branch is at `:67`, immediately before the terminal `return createActionsCacheBackend()` at `:95`, after all three earlier narrowing/throw branches. `select-backend.spec.ts:303-309` pins `selectBackend.length === 0`. The 5-row narrowing table (`:401-448`) pins each row's UN-knobbed outcome and asserts `widened(withoutKnob, withKnob) === false` via a helper that negates the QUANTIFIER, plus two-way throw parity. The branch-order clause added by the validation audit (`:471-489`) is present at HEAD and is what actually forbids hoisting the knob above the memory-degrade branch. |
| 4 | XOS-09: all three Windows legs construct the read-only backend and their counts are GATED at a floor of >= 1 with an actionable message | VERIFIED (both directions, live) | Structure: 3x `echo "CACHE_READ_ONLY=1" >> "$GITHUB_ENV"` in the REGULAR pre-set step (`ci.yml:520,630,723`), each before the `background: true` sidecar whose `env: GITHUB_TOKEN` block is intact; 3x tee (`:563,673,766`); 3x gate with `|| true`, `-lt 1`, an `::error::` naming both causes, and `exit 1` (`:594-603,687-696,780-789`). Behavior: see the two dedicated subsections below -- PASS direction read out of the raw job logs of run `30744366870`, FAIL direction confirmed at STEP granularity on run `30745558383`. |
| 5 | TEST-11: the new gate clauses are non-vacuous, never a bare `exit 1`, proven by mutation | VERIFIED | The three `gatedCount` clauses (`dogfood-cross-os.spec.ts:1126,1242,1358`) match the COMPARISON line `/^ {10}if \[ "\$\{count\}" -lt 1 \]; then$/m`, each paired with `.not.toContain('RECORDED, never gated')` as the revert detector. No gate clause asserts a bare `exit 1`. Three mutations are recorded in the clause comments and in 13-05-SUMMARY.md. The live FAIL-direction run then proved the real bash, not just the clause -- see below. One post-phase nuance recorded as INFO-1. |
| 6 | DOCS-09: every stale site is corrected in the same commit, bounded to the seven in-scope sites, two out-of-scope survivors untouched | VERIFIED | `git grep -F "RECORDED, never gated" -- .github/workflows/ci.yml` returns exactly 2 hits: `:856` (`runner.debug`, a different quantity) and `:959` (`LEG_OS`, the `integration` matrix job Phase 13 does not convert). Both are still-true claims about different jobs. `git grep -F "WRITABLE sidecar" -- .github packages` exits 1 (genuine no-match; positive control on the same paths returns 4 hits of the gate's own grep needle, so the search works). The 3 rationale comments (`:564-593`, `:675`, `:768`), the 3 gate echo strings, and the `cacheObservation` reason string (`:890-909`, now reading "its VALUE is gated by the gatedCount clause, and soundly so since XOS-09") are all corrected. |
| 7 | DOCS-10: the ninth knob is enumerated, documented on three surfaces, and the outcome count is corrected everywhere | VERIFIED | `consumer-contract.ts:26-36` lists 9 knobs including `CACHE_READ_ONLY`; `public-surface.spec.ts:171-182`'s independent sorted literal matches. `docs/configuration.md` carries both the table row (`:24`) and the `### CACHE_READ_ONLY` section (`:83`); `docs/versioning.md:23` lists it; `docs/advanced.md:21` says "`selectBackend` has FIVE outcomes" and `:30` is the fifth table row. `git grep -i -e "four .*outcomes" -e "four backend-selection" -- docs packages README.md` exits 1 (no stale count anywhere). `docs-adoption.spec.ts:176,194` pin both facts. |

**Score: 7/7 truths verified. 0 present-but-behavior-unverified. 0 overrides applied.**

### XOS-09 PASS direction -- re-derived from the raw job logs

Not taken from `13-EVIDENCE.md`. Run `30744366870` queried via `gh run view --json`:
`conclusion: success`, `event: pull_request`, `headSha: 631a2e7e64f4b5...` -- which IS the
pre-registration commit, so the prediction was provably in the tree the run measured. The three
Windows job logs were fetched individually
(`repos/op-nx/github-cache/actions/jobs/{91487384958,91487390532,91487385443}/logs`) and each
prints its own gate line:

```
remote-cache label occurrences on windows-11-arm (build): 1 -- GATED at a floor of 1
remote-cache label occurrences on windows-11-arm (typecheck): 2 -- GATED at a floor of 1
remote-cache label occurrences on windows-11-arm (test): 1 -- GATED at a floor of 1
```

1 / 2 / 1, matching the pre-registered values exactly, all three above the floor.

### XOS-09 FAIL direction -- the item the prior snapshot held open, now CLOSED

This is the state transition (green job -> red job) that presence checks cannot see, and it is why
the prior verification was `human_needed`. Run `30745558383` (`headSha: bafd7be...`,
`conclusion: failure`) resolves it. Per-job conclusions:

| Job | Conclusion |
|---|---|
| `build-windows` (perturbed) | **failure** |
| `typecheck-windows` (control) | success |
| `test-windows` (control) | success |
| `o3-witness` | success |

The load-bearing detail is the STEP, not the job -- a red job proves nothing on its own, because
`ci.yml:527`'s pre-existing readiness-poll `exit 1` can redden the same job for an unrelated reason,
which is precisely the vacuity trap TEST-11 exists to avoid. The step conclusions for
`build-windows` were queried directly:

| # | Step | Conclusion |
|---|------|-----------|
| 7 | Wait for the loopback sidecar | success |
| 8 | Run the build target and tee its output | success |
| 9 | **Gate on the cross-OS remote-cache label count for this leg** | **failure** |

The readiness poll passed; the build passed; the GATE is what failed. Two unperturbed legs stayed
green in the same run, isolating the cause to the count rather than the runner or the queue. The
gate's real bash -- `grep -o -F` with its `|| true`, the `wc -l`, the `-lt 1` comparison, the
`::error::` annotation and the `exit 1` -- executed end to end on a real `windows-11-arm` runner.

**This is behavioral proof, not a precedent waiver.** The prior report offered Phase 12's XOS-05 as
grounds to waive the item; no waiver is needed or used.

### Case B -- re-derived, and one precision note

Run `30768540898` (`headSha: 7188a66...`). All three Windows legs `success`. The producers' own logs
were counted rather than quoted from prose:

| ubuntu producer job | `Sent <n> of <n>` lines | `Cache hit for: nx-cache` lines |
|---|---|---|
| `build` (`91551499837`) | **0** | 1 |
| `typecheck` (`91551499827`) | **0** | 2 |
| `test` (`91551499835`) | **0** | 1 |

Nothing was written into the merge-ref scope during the run, yet all three read-only Windows legs
restored and cleared the floor. That is the base-scope read, and it is what the gate's soundness
argument needs. Recorded as INFO-2 below: the RUN-level conclusion is `failure`, from `o3-witness`
alone.

### Required Artifacts

| Artifact | Expected | Status | Verified how |
|----------|----------|--------|--------------|
| `backend/actions-cache-backend.ts` | Both factories, read-only first, writable composes it | VERIFIED | Read in full; spread at `:244`; single READ call site confirmed by census |
| `backend/actions-cache-backend.spec.ts` | Ordered-member scan + VER-09 package scan | VERIFIED | Clause body read at `:622-708`; suite green |
| `lib/select-backend.ts` | Fifth outcome, knob branch LAST, `length === 0` | VERIFIED | Read in full; branch at `:67`, terminal return at `:95` |
| `lib/select-backend.spec.ts` | Narrowing-only table + branch-order clause | VERIFIED | Read `:360-521`; `widened()` negates the quantifier; the audit-added `:471-489` clause is present at HEAD |
| `test/consumer-contract.ts` | `CACHE_READ_ONLY` as the 9th knob | VERIFIED | `:26-36`, 9 entries |
| `public-surface.spec.ts` | Independent 9-entry sorted literal | VERIFIED | `:171-182` |
| `docs-adoption.spec.ts` | Fifth-outcome + count-pinning clauses | VERIFIED | `:176`, `:194` |
| `.github/workflows/ci.yml` | Knob + gate on all 3 legs; 6 corrected sites; 2 untouched survivors | VERIFIED | Read the `build-windows` block in full; the other two confirmed line-by-line via targeted search; survivor census run with a positive control |
| `dogfood-cross-os.spec.ts` | Per-leg clauses, corrected `cacheObservation`, no bare `exit 1` gate clause | VERIFIED | Reason strings read at `:860-954`; three `gatedCount` assertions read at `:1126,1242,1358` |
| `start-cache-server/index.js` | Regenerated, matches source | VERIFIED | `npm run check:action` exits 0 from the MAIN tree (`.git` is a directory here, so no junction-induced false drift); `createReadOnlyActionsCacheBackend` appears 5x in the bundle and the knob at `:68710` |
| `.planning/REQUIREMENTS.md` | 7 bodies, all `[x]`; coverage 57/57 | VERIFIED | All seven `**ID**` bodies located; `57 requirements, 57 mapped` present |
| `.planning/ROADMAP.md` | 7 traceability rows; 51/51; Live-CI close block | VERIFIED | Rows at `:757-763`; `51/51` assertion at `:767`; the Live-CI STATUS block at `:679-698` records both items CLOSED |
| `.planning/THREAT-MODEL.md` | One residual bullet, zero new control rows | VERIFIED | Bullet at `:117-121`; no `C19` row exists (`git grep -E "^\| C19"` exits 1) |
| `13-EVIDENCE.md` | Pre-registration before the run; observations appended | VERIFIED | ADDENDUM 1-3 present and append-only; the superseded `OPEN` lines are left as written with SUPERSEDED pointers rather than back-edited |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `createActionsCacheBackend` | the single `get` closure | object spread | WIRED | `:242-244`; the read-only factory also carries the two VER-04 guards and the VER-07 mkdir, so the write path inherits them by calling rather than repeating |
| `select-backend.ts` last branch | `ci.yml` pre-set step | `$GITHUB_ENV` write, inherited by the background sidecar | WIRED | Regular-step write on all three legs; the sidecar's own `env: GITHUB_TOKEN` block intact on all three, so the memory-degrade branch cannot fire ahead of the knob |
| read-only backend | the Nx contract's 403 | `isWritableBackend` structural check | WIRED | `server/server.ts:128-133` sets 403 and RETURNS BEFORE `handlePut`, so no backend method runs on a refused PUT. Read directly. |
| `ci.yml` gate step | `dogfood-cross-os.spec.ts` clauses | job-block regex on the comparison line | WIRED | Three clauses, comparison-line anchored, each paired with the revert detector |
| `13-EVIDENCE.md` pre-registration | run `30744366870` | `headSha` equality | WIRED | API-confirmed: `headSha` = `631a2e7`, the pre-registration commit |

### Requirements Coverage

| Requirement | Source plan | Status | Evidence |
|---|---|---|---|
| VER-08 | 13-02 | SATISFIED | Composition read in code; one READ call site by census; suite green |
| VER-09 | 13-02 | SATISFIED | Package-scope recursive scan read and green |
| TRUST-14 | 13-03 | SATISFIED | Branch position read; narrowing table + branch-order clause green |
| XOS-09 | 13-05, 13-06 | SATISFIED | Structure read on all three legs; BOTH live directions confirmed via the API |
| TEST-11 | 13-05 | SATISFIED | Clause shapes read; mutations recorded; real bash proven live |
| DOCS-09 | 13-05 | SATISFIED | Survivor census with positive control |
| DOCS-10 | 13-04 | SATISFIED | 9 knobs, 3 doc surfaces, FIVE outcomes, zero stale "four" |

No orphaned requirements: all seven Phase-13 IDs appear in REQUIREMENTS.md bodies and in the
ROADMAP traceability table, matching the plans' `requirements:` frontmatter.

### Behavioral Spot-Checks

Run from the MAIN tree at head `4ac20dc`, with the working tree asserted clean immediately before
and after each run.

| Behavior | Command | Result | Status |
|---|---|---|---|
| Whole package suite is green | `npx nx test github-cache --skip-nx-cache` | 42 files / **1006 tests**, 0 failures, `Cache: Skipped` | PASS |
| Phase-13 guards specifically are green | same, filtered to the five Phase-13 spec files | 5 files / **208 tests**, 0 failures | PASS |
| Types and lint are clean | `npx nx run-many -t typecheck lint --skip-nx-cache` | `Successfully ran targets typecheck, lint`; the target lines `nx run @op-nx/github-cache:typecheck` and `:lint` were both printed (asserted on the printed lines, not the exit code) | PASS |
| The committed action bundle matches its source | `npm run check:action` | exit 0, `git diff --exit-code -- start-cache-server/index.js` clean | PASS |
| The three gate lines on the proving run | `gh api .../jobs/{id}/logs` x3 | 1 / 2 / 1 | PASS |
| The gate's FAIL path on a real runner | `gh run view 30745558383 --json jobs` (step granularity) | step 9 `Gate on the cross-OS remote-cache label count for this leg` = failure; readiness poll = success; 2 control legs green | PASS |
| Case B producers wrote nothing | `gh api .../jobs/{id}/logs` x3, counting `Sent`/`Cache hit` | 0 `Sent` on all three; 1/2/1 hits | PASS |

Nothing was mutated to obtain any of this. `git diff --quiet` is clean at the end of the run.

### Anti-Patterns Found

None. `git grep -E "\b(TBD|FIXME|XXX)\b"` and `git grep -E "\b(TODO|HACK|PLACEHOLDER)\b"` over the
twelve Phase-13 source/CI/doc files both exit 1 (genuine no-match; a positive control on the same
path set returns 822 hits, so the search works). No debt markers, so nothing trips the debt gate.
The one prior debt-marker class in this repo (`RECORDED, never gated`) is what this phase corrects,
and its two survivors are the deliberate out-of-scope ones.

### Informational findings (none block the phase goal)

**INFO-1 -- the TEST-11 evidence grep needs a multi-line form now, but the property still holds.**
The prior report's single-line `git grep -E "(toMatch|toContain)\(.*exit 1"` still exits 1. Since
that snapshot, post-phase commit `40e4d21` added a `toMatch` at `dogfood-cross-os.spec.ts:646-647`
whose regex argument sits on its own line and does contain `exit 1`. It is NOT a Phase-13 gate
clause (it belongs to the `o3-witness` describe) and it is not the vacuous shape: the gap is bounded
to a single line (`/if \[ -z "\$\{created\}" \]; then\n[^\n]*\n\s*exit 1\n/`), the file records that
the obvious unbounded form was MEASURED to survive its own mutation, and it is paired with a
`not.toMatch(/exit 0\b/)`. Recorded so a future verifier does not read the single-line grep as
covering the whole file.

**INFO-2 -- run `30768540898`'s RUN-level conclusion is `failure`, and neither ROADMAP nor
13-EVIDENCE says so.** Both correctly disclose that `o3-witness` reddens on a Case-B run and that it
is a FALSE red, but a reader who runs `gh run view 30768540898` sees `conclusion: failure` next to a
row marked **PROVEN**. The job-level facts hold: all three read-only Windows legs are `success` and
`o3-witness` is the only failing job. The follow-up ROADMAP records has since landed as post-phase
commit `40e4d21` ("make o3-witness read the base-branch cache scope (Case B)"). Worth one clarifying
sentence in the ROADMAP row; not a Phase 13 defect.

**INFO-3 -- transient full-suite reds during this verification were an artifact of a concurrent
session, not of HEAD.** Two early full-suite runs reported failures in `publish-mirror.spec.ts` and
`cleanup.spec.ts` at 997 tests. The reported failure line numbers did not match the file on disk,
and `git diff` subsequently showed `publish-mirror.spec.ts` transiently carrying +101 uncommitted
lines before returning to match HEAD -- the signature of a concurrent mutation-proof session on the
separate publish work. With the tree asserted clean on both sides, the suite is 42 files / 1006
tests green, twice. No Phase-13 file was ever among the modified set. Recorded because "the suite
was red" would otherwise be a false finding, and because it is the same hazard ADDENDUM 3 names:
before believing a run, check what the run actually measured.

### Out of scope for this verification, deliberately

- **`publish-verify`** is a separate, currently-open blocker handled elsewhere. It is not a Phase 13
  requirement and is not folded into this verdict. On the runs cited above it is `skipped`
  (push-gated).
- **RESEARCH assumption A1** is a research assumption, not one of the seven requirements. ADDENDUM 3
  answers it affirmatively by LOCAL measurement (four PUTs, each refused 403, Nx silent, build
  green), and states its own scope narrowly: what transfers to CI is the client-side property "given
  a 403 to a store, this pinned Nx emits no output", an INFERENCE from a local measurement -- no CI
  run has directly observed a PUT arriving. That scope is respected here and not upgraded. No truth
  in this report depends on A1.
- **The `o3-witness` Case-B limitation** surfaced by quick `260802-toz` is a new follow-up belonging
  to neither Live-CI item. A fix landed post-phase in `40e4d21`; verifying that fix is that change's
  business, not Phase 13's.

### Human Verification Required

None. The single item the prior snapshot routed to a human was closed by live observation and has
been re-verified here at step granularity against the GitHub Actions API. No truth in this phase is
left present-but-behavior-unverified.

### Gaps Summary

No gaps. All seven requirement IDs are satisfied by code read directly at head `4ac20dc`, by a test
suite executed uncached from the main tree with the working tree asserted clean on both sides
(42 files / 1006 tests), by a clean `typecheck`/`lint` pair whose target lines were asserted as
printed, by a clean `check:action`, and by three live CI runs whose job- and step-level facts were
queried from the API rather than read out of the phase's own prose. Both `**Live-CI close**` items
are closed and both closures independently reproduce. The phase goal -- a read-only Actions-cache
backend that makes the three Windows legs' `[remote cache]` counts soundly gateable -- is achieved,
and the gate is now proven to fire in both directions on a real runner.

---

*Verified: 2026-08-03T01:45:00Z at head `4ac20dc`*
*Verifier: Claude (gsd-verifier), re-verification*

---
---

## SUPERSEDED SNAPSHOT -- 2026-08-02T13:20:00Z (`status: human_needed`, score 6/7)

**Preserved verbatim, never rewritten.** This repository supersedes forward. The snapshot below was
correct for what it measured: at the time it was written, the gate's FAIL direction had genuinely
never executed on a real runner, and flagging that rather than defaulting to VERIFIED on presence
was the right call. It was closed afterwards by observation, which is why this file now reads
`passed`. Nothing in the snapshot was edited to produce that verdict.

Its frontmatter, as it stood, for the record:

```yaml
verified: 2026-08-02T13:20:00Z
status: human_needed
score: 6/7 must-haves verified
behavior_unverified: 1
overrides_applied: 0
behavior_unverified_items:
  - truth: "Each Windows leg's job FAILS (exit 1, red job) when its [remote cache] count is below the floor of 1 (part of XOS-09's 'GATED' claim)"
    test: "Trigger a genuine cross-OS restore failure on a real windows-11-arm runner (e.g., a deliberately broken @actions/cache version or archive path) with a ubuntu producer that has already saved the entry, and confirm the Windows leg's job goes RED with the `::error::` annotation."
    why_human: "The gate's shell comparison (`if [ \"${count}\" -lt 1 ]; then ... exit 1; fi`) is pinned in dogfood-cross-os.spec.ts only as TEXT (a regex match against the ci.yml source) and proven non-vacuous by MUTATING the spec's input (deleting the gate step, deleting the knob line, breaking the comparison) -- this proves the SPEC clause detects absence of the gate, not that the real bash executes exit 1 and reddens the job on a real runner. The one CI run recorded in 13-EVIDENCE.md (30744366870) observed only the PASS path (counts 1/2/1, all >= 1); the FAIL path was never exercised live, and 13-EVIDENCE.md and 13-05-SUMMARY.md both say so explicitly ('the live gate REDDENING on a real cross-OS restore failure is not observed and was deliberately not induced'). No spec runs the shell script; a repo-wide search for execSync/spawnSync in dogfood-cross-os.spec.ts returns nothing."
```

### (snapshot) Phase 13: Read-Only Actions-Cache Backend Verification Report

**Verified:** 2026-08-02
**Status:** human_needed (one item routed for human decision; no gaps found)
**Re-verification:** No -- initial verification

#### (snapshot) Observable Truths

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

#### (snapshot) Required Artifacts

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

#### (snapshot) Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `createActionsCacheBackend` | single `get` closure | object spread | VERIFIED | `actions-cache-backend.ts:242-247`; `serve.ts:91-95` precedent for spread-safety confirmed. |
| `select-backend.ts` (last branch) | `ci.yml` pre-set step | `$GITHUB_ENV` write, propagates to background sidecar | VERIFIED | Confirmed the sidecar's `env: GITHUB_TOKEN` block is preserved on all three legs (memory-degrade branch would otherwise fire before the knob). |
| `ci.yml` gate step | `dogfood-cross-os.spec.ts` clauses | job-block regex match on the comparison line, never `exit 1` | VERIFIED | Zero `toMatch`/`toContain` calls in the spec contain the string `exit 1`. |
| `13-EVIDENCE.md` pre-registration | proving run `30744366870` | committed BEFORE, `headSha` equality | VERIFIED | `git diff <pre-registration> HEAD -- 13-EVIDENCE.md` shows additions only (confirmed via SUMMARY's self-check; the run's recorded `headSha` matches the pre-registration commit). |
| Server 403 boundary | read-only backend | `isWritableBackend` structural check | VERIFIED | `server.ts` comment + code: "PUT to a read-only backend -> the Nx contract's 403 ... A ReadableBackend has no put". |

#### (snapshot) Requirements Coverage

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

#### (snapshot) Anti-Patterns Found

None. Scanned all files modified in this phase for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` and stub patterns (`return null`, hardcoded empty arrays feeding render, `console.log`-only bodies) -- none found. The one prior debt-marker class in this codebase (`RECORDED, never gated`) is precisely what this phase corrects, and the correction is scoped and verified above.

#### (snapshot) Carried-Forward Item Assessed (per task instruction)

**`packages/github-cache/src/dogfood-cross-os.spec.ts:349-352`** -- flagged by both 13-05-SUMMARY.md and 13-06-SUMMARY.md as "Flagged for Review, Not Changed": the sentence "VER-06 is now PR-observable; OBS-04 is the surviving example, because its `[remote cache]` counts are RECORDED and never GATED" has an ambiguous "its."

**Assessment:** Traced the sentence's git history (introduced in commit `fee5fbe`, Phase 12, predating Phase 13 entirely) and cross-checked it against REQUIREMENTS.md's actual OBS-04 definition ("The all-restore-MISS warning's message... two consecutive all-miss pushes... `mirrored == 0`" -- a Phase 9/10 publish-leg concept, unrelated to the Windows legs' per-target `[remote cache]` counts). Every OTHER "OBS-04" reference in the tree (`ci.yml:837`, `:1058`, `:2025`, `windows-regression-detector.yml:26`) correctly uses OBS-04 as precedent for "a tripwire that fires on correct work gets disabled" -- but this ONE sentence appears to conflate that correct usage with a factual claim about `[remote cache]` counts, which is actually OBS-02's subject ("Evidence = non-zero `[remote cache]` label count, named per target"), not OBS-04's.

**Verdict: the declining-to-edit judgment call was correct.** The sentence is a pre-existing (Phase-12-era) documentation imprecision, not something Phase 13 introduced or is required to fix under DOCS-09's scope (the seven DOCS-09 sites are enumerated and this is not one of them -- it sits in the `ROBUST-04`/`action-bundle-drift` describe block, a different topic). Editing it under either candidate reading risks deleting a true claim, which is exactly the failure mode the project's own DOCS-09 sweep was built to avoid (D-06/the bounded-sweep pattern). This is a real, pre-existing defect worth a small follow-up (recommend a future quick task retitle the reference to OBS-02 or otherwise disambiguate), but it does **not** block Phase 13's goal and is correctly out of this phase's scope.

#### (snapshot) Human Verification Required

##### 1. Live gate-reddening on a genuine cross-OS restore failure (XOS-09)

**Test:** On a real `windows-11-arm` CI run, after a ubuntu producer has genuinely populated an entry, deliberately break cross-OS restore for one leg (e.g., temporarily corrupt the archive path constant or pin an `@actions/cache` version known to break `enableCrossOsArchive`) and confirm that leg's job goes RED with the `::error::` message naming both possible causes, then revert.

**Expected:** The job fails (exit 1) rather than silently passing, and the `::error::` annotation is legible and actionable.

**Why human:** The gate's shell comparison is pinned only as TEXT in `dogfood-cross-os.spec.ts` (regex-matched against the `ci.yml` source) and proven non-vacuous by mutating the SPEC's input, not by executing the real bash. The one live CI run recorded (`30744366870`) exercised only the PASS path (counts 1/2/1, all meeting the floor); `13-EVIDENCE.md` and `13-05-SUMMARY.md` both explicitly and honestly state the FAIL path was "not observed, and deliberately not induced." This is a genuine state-transition (green job -> red job) that no automated check in this repository exercises end-to-end.

**Note for the decision-maker:** This exact class of limitation (a live-CI-only observation deferred as a named follow-up) has established precedent in this same project -- Phase 12's XOS-05 was marked "Complete" on analogous grounds (structural gate + a live run observing the pass path, with reddening proof deferred). If that precedent is acceptable here too, this item can be waived and the phase treated as `passed`; it is surfaced rather than silently accepted because the adversarial verification stance requires flagging state-transitions that are present+wired but not behaviorally proven, rather than defaulting to VERIFIED on presence alone.

> **Resolution (2026-08-03, this re-verification):** NOT waived on precedent -- CLOSED by observation.
> Run `30745558383` reddened `build-windows` AT THE GATE STEP (step 9) at count 0, with
> `typecheck-windows` and `test-windows` green in the same run as a positive control. Confirmed
> here at step granularity against the GitHub Actions API.

#### (snapshot) Gaps Summary

No gaps. All seven requirement IDs (VER-08, VER-09, TRUST-14, XOS-09, TEST-11, DOCS-09, DOCS-10) are satisfied by code that was read directly, tests that were run directly (`npx nx test github-cache --skip-nx-cache`: 975/975 passing; `npx nx run-many -t typecheck lint --projects=github-cache --skip-nx-cache`: clean; `npm run check:action`: clean, no bundle drift), and a live CI run (`30744366870`) that behaviorally confirms the pass path. Traceability and coverage tallies in both ROADMAP.md and REQUIREMENTS.md are arithmetically correct and internally consistent. The THREAT-MODEL.md residual note is present and the C1-C18 ledger is unchanged. The sole human-verification item is a live-CI behavioral proof of the gate's FAIL path, which is a known, honestly-disclosed, and precedented class of deferred observation in this project -- not a defect in the delivered work.

*Snapshot verified: 2026-08-02 / Verifier: Claude (gsd-verifier)*
