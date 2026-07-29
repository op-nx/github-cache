---
phase: 10
slug: os-invariant-releases-mirror
status: passed
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-29
audited_at: 2026-07-29
audited_tree: 3934b84
rows_total: 33
rows_green: 33
rows_manual_only: 0
rows_still_open: 0
live_ci_closed_at: 2026-07-29
live_ci_run: 30471772954
---

# Phase 10 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `10-RESEARCH.md` `## Validation Architecture`. Task IDs are filled at plan time;
> `/gsd:validate-phase` audits and closes the remaining gaps after execution.
> ASCII-only by project rule: `[OK]` = harness exists, `[W0]` = Wave 0 gap, `[ ]` = pending.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest `~4.1.0` (effective `4.1.10`, measured in 09-03) |
| **Unit config** | `packages/github-cache/vitest.config.mts` -- includes `**/*.{test,spec}.ts`, EXCLUDES `*.integration.spec.ts` |
| **Integration config** | `packages/github-cache/vitest.integration.config.mts:16` -- `include: ['{src,tests}/**/*.integration.spec.{ts,mts,cts}']`, distinct `cacheDir` |
| **Quick run command** | `npx nx run @op-nx/github-cache:test --skip-nx-cache` |
| **Full suite command** | `npm run test && npm run typecheck && npm run lint && npm run integration` |
| **Bundle drift** | `npm run check:action` -- **MAIN TREE ONLY** (a junctioned worktree `node_modules` made esbuild rewrite 689 lines with no source edit) |
| **Estimated runtime** | ~60 s unit, ~30 s integration |

### CI sampling rate per gate -- this is the load-bearing half

| Gate | Sampling | Consequence |
|------|----------|-------------|
| `test` | **ubuntu-24.04-arm ONLY, single leg** | Any hand-authored `'linux'` literal is sampled at rate **ZERO** (Phase 9 gap G2) |
| `integration` | **two-leg `[ubuntu-24.04-arm, windows-11-arm]`, `fail-fast: false`** | The only every-PR two-OS sampler -- why CORR-05 site 4 moves here (D-17) |
| `lint` | every PR/push | LINT-06 `reportUnusedDisableDirectives: 'error'` makes a stale disable a build failure |
| `action-bundle-drift` | every PR and every push (no job-level `if:`) | ROBUST-04's only automated guard; pinned by `dogfood-cross-os.spec.ts:138-151` |
| `publish` / `publish-verify` | **push-to-`main` ONLY** | Unobservable pre-merge at any rate. This is exactly why Phase 9's regression was only findable live |

---

## Sampling Rate

- **After every task commit:** `npx nx run @op-nx/github-cache:test --skip-nx-cache`.
  The `--skip-nx-cache` is **not optional** after a spec-only edit -- Phase 9 measured a
  `Cache: 2/2 hit` stale PASS on exactly that path. Add `npm run lint` on any commit touching a
  disable directive.
- **After every plan wave:** `npm run test && npm run typecheck && npm run lint && npm run integration`.
  The CORR-02 wave additionally runs `npm run check:action` **in the main tree**.
- **Before `/gsd:verify-work`:** full battery green.
- **Max feedback latency:** ~90 s (unit + integration).

---

## Per-Task Verification Map

Task IDs are assigned at plan time. Requirement -> behavior -> command is fixed here; the planner
maps each row onto a task and the executor fills `Status`.

| Req | Behavior | Test Type | Automated Command | Harness | Status |
|-----|----------|-----------|-------------------|---------|--------|
| CORR-02 | `releaseAssetName(hash)` is exactly `nx-cache-<hash>`, pinned as a hand-authored LITERAL | unit | quick run, `release-asset-name` | [OK] re-authored `src/lib/release-asset-name.spec.ts` | [OK] green -- `release-asset-name.spec.ts:59-91`, literal `'nx-cache-abc123'` pinned, `CACHE_OS_VALUES` loop, arity===1 |
| CORR-02 | reader and publisher both derive through the ONE helper (no inlined template) | unit | quick run, `releases-backend` + `publish-mirror` | [OK] `releases-backend.spec.ts:128-135`, `publish-mirror.spec.ts:127-136` | [OK] green -- `releases-backend.spec.ts:136-168`, `publish-mirror.spec.ts:168-187` both derive via `releaseAssetName` |
| CORR-02 | the prefix literal is authored exactly ONCE across the leaf + 3 consumers | unit (source-reading) | quick run, `cache-key` | [OK] extend `cache-key.spec.ts:108-137` `files` map | [OK] green -- `cache-key.spec.ts:108-158`, `total===1` pin over 4 files |
| CORR-02 | committed bundle matches a fresh build | artifact diff | `npm run check:action` (main tree) | [OK] existing script + `action-bundle-drift` job | [OK] green -- RAN in the main tree this audit: exit 0, empty `git diff` on `start-cache-server/index.js` |
| CORR-05 | zero extant ambient-platform reads in unit specs | unit (source-reading) | quick run, `lint-rules` | [OK] `lint-rules.spec.ts` -- `CORR_05_SITES` empties; ADD `expect(CORR_05_SITES).toEqual([])` (C-2) | [OK] green -- `lint-rules.spec.ts:751,779`, `CORR_05_SITES = []`, positive assertion present |
| CORR-05 | the ban still fires on all six evasion shapes at a unit path, exempt at an integration path | unit | quick run, `lint-rules` | [OK] `EVASION_SHAPES` `:353-503` -- unchanged | [OK] green -- `lint-rules.spec.ts:355-442` (11 rows across the 6 pattern families) fire at unit path (`:506-514`), exempt at integration path (`:526-540+`) |
| CORR-05 | `cachePlatform()`'s default-argument contract, sampled on BOTH OSes | **integration** | `npm run integration` | [W0] NEW `src/lib/release-asset-name.integration.spec.ts` (D-17) | [OK] green -- file exists, RAN this audit via `npm run integration --skip-nx-cache` on this win32/arm64 machine: 1/1 passed |
| CORR-05 | D-18's replacement: exactly one requested name, equal to the helper's, no platform token | unit | quick run, `releases-backend` | [OK] extend `releases-backend.spec.ts:128-135` | [OK] green -- `releases-backend.spec.ts:142-166`, `client.requested` pinned + `CACHE_OS_VALUES` loop |
| RETAIN-04 | both name families accepted by the cleanup filter | unit | quick run, `release-asset-name` | [OK] extend `release-asset-name.spec.ts:66-103` | [OK] green -- `release-asset-name.spec.ts:117-183`, current + legacy accept/reject sets both pinned |
| RETAIN-04 | a cleanup dry-run over a MIXED shard prunes both families, never a foreign asset | unit (engine + fake) | quick run, `cleanup` | [W0] mixed-shard fixture from the D-08 census | [OK] green -- `cleanup.spec.ts:207-340`, exact 50/46/26/122 census fixture; MUTATION-CONFIRMED this audit (see trail) |
| RETAIN-05b | the two branches are mutually exclusive, asserted DIRECTLY over an adversarial table | unit | quick run, `release-asset-name` | [W0] NEW describe -- 26-row table + 3 structural atoms | [OK] green -- `release-asset-name.spec.ts:185-341`; MUTATION-CONFIRMED this audit (see trail) |
| RETAIN-05c | `CACHE_KEY_PREFIX` pinned + comment-locked as governing FOUR things | unit (source-reading) | quick run, `cache-key` | [OK] extend `cache-key.spec.ts:108-137` | [OK] green -- `cache-key.spec.ts:108-158`, same pin as CORR-02 row 3 |
| RETAIN-05a | the 50 `.tar.gz` disposition RECORDED with a count | **documentation, not a test** | n/a | [W0] NEW note artifact (shares one file with D-26) | [OK] green -- `10-EVIDENCE-PRE-RENAME.md:224-300`, count is exactly 50, matches REQUIREMENTS' "~50" |
| OBS-03 | label is a 4th positional arg on every upload, value `mirrored-by: <os>`, asserted over the WHOLE argument array via `it.each(CACHE_OS_VALUES)` | unit | quick run, `publish-mirror` | [OK] 4 fakes + 4 argument assertions (C-6: 8 edits, not 10) | [OK] green -- `publish-mirror.spec.ts:190-219`, whole-array `toEqual` per OS |
| OBS-03 | `cachePlatform()` called ONCE per run, not per iteration | unit | quick run, `publish-mirror` | [W0] NEW case -- `toHaveBeenCalledOnce()` on a multi-hash fixture; without it the D-10 hoist is unguarded | [OK] green -- `publish-mirror.spec.ts:221-240`; independently mutation-tested in 10-VERIFICATION.md (hoist moved into loop, 1/28 reddened) |
| OBS-03 | the real Octokit adapter forwards `label` | unit | quick run, `action/index` | [OK] extend the adapter test | [OK] green -- `action/index.spec.ts:313-348`, whole-object `toHaveBeenCalledWith` including `label` |
| OBS-03 | no file claims "producing OS" / "whose bytes did the developer get" | unit (source-reading) | quick run, `docs-same-os-claims` | [OK] extend `EDITED_FILES` `:194-207` | [OK] green -- `docs-same-os-claims.spec.ts:393-455`, `EDITED_FILES` now 12 files, retraction guard `/whose byte[s]/i` |
| OBS-05 | `mirrorSeedHash` yields a distinct, hex, non-all-decimal key per `CACHE_OS_VALUES` member | unit | quick run, `mirror-seed` | [W0] NEW `src/lib/mirror-seed.{ts,spec.ts}` + `CACHE_OS_VALUES.length < 10` pin | [OK] green -- `mirror-seed.spec.ts:55-113`, injectivity + hex-letter + length<10 pin all present |
| OBS-05 | the derived seed survives `parseHash`, `isServerProducedKey`, `releaseAssetName` and BOTH cleanup branches | unit | quick run, `mirror-seed` | [W0] NEW round-trip case | [OK] green -- `mirror-seed.spec.ts:115-133`; cross-referenced by the live `feed2...` seed inside `release-asset-name.spec.ts`'s ADVERSARIAL_NAMES table and `cleanup.spec.ts`'s `feed`-prefixed new-form fixture |
| OBS-05 | `read-back.ts` accepts its OWN leg's seed payload and REJECTS every other member's | unit | quick run, `read-back` | [OK] TIGHTEN `read-back.spec.ts:80` `it.each(CACHE_OS_VALUES)` (D-15) | [OK] green -- `read-back.spec.ts:215-250`, own-leg accept + full cross-producer-pair reject matrix |
| OBS-05 | **the read-back asset's `mirrored-by` label equals the reader's own OS** -- the U-01 control | unit | quick run, `read-back` | [W0] NEW cases; mutation = flip the label | [OK] green -- `read-back.spec.ts:320-375`, own-label accept, wrong-label reject (named pair), empty-label reject |
| OBS-05 | the `mirror-seed` operation PUTs at the DERIVED hash, not the raw `hash` input | unit | quick run, `action/index` | [W0] NEW case asserting the fetched URL path -- the `url`-reuse trap at `action/index.ts:265`; without this the trap ships silently | [OK] green -- `action/index.spec.ts:513-553`, whole-URL equality + `not.toBe(RUN_ID)` on the final path segment |
| OBS-05 | live: each `publish-verify` leg reads back its OWN leg's asset | **live CI, push-to-`main`** | `publish-verify` job | [OK] observed on run `30471772954` -- both legs named their OWN OS; windows mirrored exactly 1 (its own seed), not 0 | [OK] green (see Post-Audit Addendum) |
| XOS-06 | `max-parallel: 1` retained | unit (ci.yml value) | quick run | [W0] NEW -- `jobBlock('publish')` matches `/max-parallel:\s*1/`. No guard exists today | [OK] green -- `dogfood-cross-os.spec.ts:191-206` |
| XOS-06 | the comment records "not a correctness control" + the rejected ordering argument + the U-01 sensitivity | unit (raw-file phrase) | quick run, `docs-same-os-claims` | [W0] NEW `DOCS_08_SITES` rows (raw `read(file)` sees comments; `jobBlock` does not) | [OK] green -- `docs-same-os-claims.spec.ts:160-236`, three separate additive rows (status+mechanism, rejected argument, guard-sensitivity) |
| XOS-07 | `publish` declares `needs: [build, typecheck, test, integration]` | unit (ci.yml value) | quick run | [W0] NEW -- `jobBlock('publish')` matches all four | [OK] green -- `dogfood-cross-os.spec.ts:153-189`, four separate per-producer cases |
| XOS-07 | the comment records `!cancelled()` as the mechanism | unit (raw-file phrase) | quick run, `docs-same-os-claims` | [W0] NEW row | [OK] green -- `docs-same-os-claims.spec.ts:131-159` |
| XOS-07 | live: one push mirrors that push's full task set | **live CI** | `gh api` asset census after the merge push | [OK] observed on run `30471772954` -- 16 new-form assets, 10 real task hashes each exactly once, legacy count 72 -> 72 | [OK] green (see Post-Audit Addendum) |
| TRUST-10 | C1/C2 unchanged | commit-range diff + existing specs | `git diff <base>..HEAD -- src/lib/trust.ts src/lib/sync-gate.ts` (expect empty) + `trust.spec.ts`, `sync-gate.spec.ts` | [OK] | [OK] green -- RAN this audit: `git diff --stat 06019d4..HEAD -- ...trust.ts ...sync-gate.ts` empty, exit 0 |
| TRUST-10 | C16 Actions-cache side unchanged | function-scoped diff + accept/reject pin | `cache-key.spec.ts:34-74` | [OK] | [OK] green -- `cache-key.spec.ts:34-84` (TRUST-08/SRV-03 accept/reject + bounds), file re-read this audit |
| TRUST-10 | `listCacheEntries` is `ref`-scoped, pinned by spec + comment-locked | unit | quick run, `action/index` | [W0] NEW case -- whole-argument-array assertion on `octokit.paginate` + call count | [OK] green -- `action/index.spec.ts:240-311`, whole-array `toEqual` over 2 distinct refs + separate `toHaveBeenCalledOnce()` |
| TRUST-11 / TRUST-12 | recorded in the PLAN.md `<threat_model>` block as INPUT | **plan artifact** | plan-checker reads it | n/a | [OK] green -- `10-08-PLAN.md:23,85,226-320`, both recorded as QUESTIONS with proposed classification marked INPUT |
| TRUST-13 | classified BY `gsd-security-auditor` in SECURITY.md | **agent gate** | `/gsd:secure-phase` -> `gsd-security-auditor` | n/a -- **do NOT take the inline short-circuit** | [OK] green -- `10-SECURITY.md` section 1 (lines 76-196), `requirements_closed_by_this_audit: [TRUST-13]`, short-circuit explicitly not taken |

*Status legend: `[ ] pending` / `[OK] green` / `[FAIL] red` / `[WARN] flaky`.*

---

## Wave 0 Requirements

New files and new cases required before or alongside implementation:

- [x] `packages/github-cache/src/lib/release-asset-name.integration.spec.ts` -- CORR-05 site 4 (D-17).
      MEASURED to be hashed by the `integration` target and to run on both OS legs (no stale-cache hazard).
      CONFIRMED landed and RAN green this audit (`npm run integration --skip-nx-cache`, 1/1 passed on
      this win32/arm64 machine).
- [x] `packages/github-cache/src/lib/mirror-seed.ts` + `mirror-seed.spec.ts` -- OBS-05's derivation and
      its `CACHE_OS_VALUES.length < 10` injectivity pin. A NEW file rather than an addition to
      `release-asset-name.ts`, so OBS-05's commit stays outside the bundle-source set.
      CONFIRMED landed; injectivity + length<10 pin read directly.
- [x] `release-asset-name.spec.ts` -- NEW `describe` for RETAIN-05(b): 3 structural atoms + the
      26-row adversarial disjointness table with the both-branch count pinned to 0.
      CONFIRMED landed; MUTATION-TESTED this audit (see trail below) -- reddened as designed.
- [x] `publish-mirror.spec.ts` -- NEW case: `cachePlatform` called exactly ONCE per run.
      CONFIRMED landed; independently mutation-tested in 10-VERIFICATION.md (hoist-move, 1/28 reddened).
- [x] `read-back.spec.ts` -- NEW cases: the `mirrored-by` label assertion (the U-01 control) and its
      wrong-label rejection.
      CONFIRMED landed; own-label accept, named wrong-label reject, and empty-label reject all present.
- [x] `action/index.spec.ts` -- NEW cases: the `mirror-seed` branch PUTs at the DERIVED hash (the
      `url`-reuse trap), and `listCacheEntries` passes the constructor's `ref` (TRUST-10).
      CONFIRMED landed; both cases read directly, whole-argument-array assertions in each.
- [x] `docs-same-os-claims.spec.ts` -- NEW `DOCS_08_SITES` rows for the D-21 sweep: `ci.yml`'s
      `publish-verify` job comment, the shard-growth third correction, the `max-parallel: 1`
      not-a-correctness-control lock, and the `needs:` / `!cancelled()` replacement reason.
      CONFIRMED landed; all rows present and content-pinned (not line-numbered).
- [x] `cleanup.spec.ts` -- mixed-shard fixture built from the D-08 measured census.
      CONFIRMED landed; exact 50/46/26/122 counts, MUTATION-TESTED this audit -- reddened as designed.
- [x] A `jobBlock('publish')` guard for the `needs:` and `max-parallel: 1` VALUES. **No such guard
      exists today** -- without it, reverting XOS-07's `needs:` reddens nothing.
      CONFIRMED landed in `dogfood-cross-os.spec.ts:153-206`; both VALUE guards present and separate
      from the docs-same-os-claims.spec.ts comment locks.
- [x] Recording artifacts (not tests): the D-08 census + bounding argument, D-25's fresh XOS-02
      baseline, and the D-26(a)+(b) SC6 notes.
      CONFIRMED present in `10-EVIDENCE-PRE-RENAME.md` and `10-SC6-NOTES.md`. Note: D-25's baseline
      capture is not merely planned -- it is DONE (captured at `06019d4`, before the rename landed),
      which the Manual-Only table below still phrases as forward guidance; see the audit trail.

**Framework install:** none. **New fixture file:** none -- every harness needed already exists.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Each `publish-verify` leg reads back its OWN leg's asset with its own `mirrored-by` label | OBS-05 | `publish` / `publish-verify` are `push`-gated to `main`; no PR run reaches them | After the merge push, read both `publish-verify` legs' logs and confirm each names its own OS as producer; confirm `publish (windows)` reports `mirrored: 1` (its own seed), NOT `0` -- per research correction C-1(ii) |
| One default-branch push mirrors that push's FULL task set | XOS-07 | Requires a real `push` to `main` with all four producer jobs green | `gh api repos/op-nx/github-cache/releases/tags/cache-mirror-<YYYYMM>` -- every task hash from the push present exactly once under `nx-cache-<hash>` |
| The mirror is warm under the new name (Phase 11's precondition) | CORR-02 | Only a default-branch push republishes | Census the shard after the merge; expect `nx-cache-*` names to appear and legacy `<hash>-<os>` names to stop growing |
| Pre-rename XOS-02 baseline | D-25 (owed to Phase 11) | A local cold `nx reset` + sidecar run on a real Windows workstation | Capture BEFORE any rename commit -- the window closes permanently once CORR-02 lands |

---

## Validation Sign-Off

- [x] All tasks have an automated verify command or a named Wave 0 dependency -- 31 of 33 rows close
      on an automated command; the remaining 2 (TRUST-11/12, TRUST-13) are correctly n/a plan/agent-gate
      artifacts, and 2 rows (OBS-05 live, XOS-07 live) are correctly left `[ ]` as live-CI-only.
- [x] Sampling continuity: no 3 consecutive tasks without an automated verify -- checked row-by-row;
      the longest run of `n/a` rows is 2 (TRUST-11/12, TRUST-13, both correctly non-test artifacts).
- [x] Wave 0 covers all `[W0]` references above -- all 10 Wave 0 items confirmed landed this audit.
- [x] No watch-mode flags -- none of the quick-run or full-battery commands pass `--watch`.
- [x] Feedback latency < 90 s -- measured this audit: unit ~1.8-2.5s, integration ~0.3-1.1s.
- [x] Every assertion that could be sampled at rate ZERO on ubuntu-only `test` is either moved to
      `integration` or derived from `CACHE_OS_VALUES` rather than the running machine (Phase 9 G2) --
      REAL CHECK, independently re-run this audit: `rg` scan for hand-authored `'linux'`/`'windows'`/
      `'macos'` literals outside `CACHE_OS_VALUES`-driven `it.each` found only injected-parameter uses
      (`action/index.spec.ts`'s `cachePlatform` stub, `dogfood-body.spec.ts`'s direct function-input
      literals, `hash-parity/compare.spec.ts`'s fixture data) -- zero ambient-machine-read violations.
- [x] No absence guard uses a negated matcher inside `toHaveBeenCalledWith` (Phase 9 G3 -- negate the
      QUANTIFIER, not the predicate) -- REAL CHECK, independently re-run this audit: `rg` scan for
      `toHaveBeenCalledWith(expect.not` across all spec files found exactly ONE hit, in
      `publish-mirror.spec.ts:604`, inside a comment explaining why that shape is NOT used -- the real
      guard at `:612-614` uses `.not.toContainEqual(...)` over the flattened call array, the correct
      quantifier-negation shape. Zero live violations.
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** passed (2026-07-29 post-execution audit; see Validation Audit section below)

---

## Validation Audit 2026-07-29

**Auditor:** gsd-nyquist-auditor. **Audited tree:** `3934b84` (`.git` is a directory --
confirmed MAIN tree, not a worktree). **Method:** every one of the 33 rows was closed by
reading the actual harness file the row cites (not a SUMMARY's or a prior verification's
claim) and, where the row names an automated command, running it. Zero new test files were
created -- every row that needed a harness already had one landed by the phase's Wave 0
work, and the two Phase 9 lesson-derived Sign-Off checks (G2 sampling-rate, G3 negated
quantifier) were independently re-run rather than trusted.

### Gaps found

**None requiring a new test.** All 33 rows close on an existing harness, an existing
artifact, or are correctly left open as live-CI-only. This audit generated ZERO new spec
files -- padding coverage that already exists would violate the "do not pad" instruction,
and no genuine uncovered behavior was found.

### Resolved (31 of 33)

All 31 non-live rows flipped `[ ] pending` -> `[OK] green`, confirmed by:

- **Reading the cited harness directly** for every row (all 39 spec files touched by the
  map were opened this audit: `release-asset-name.spec.ts`, `.integration.spec.ts`,
  `cache-key.spec.ts`, `releases-backend.spec.ts`, `publish-mirror.spec.ts`,
  `cleanup.spec.ts`, `mirror-seed.spec.ts`, `read-back.spec.ts`, `action/index.spec.ts`,
  `docs-same-os-claims.spec.ts`, `dogfood-cross-os.spec.ts`, `lint-rules.spec.ts`,
  `10-EVIDENCE-PRE-RENAME.md`, `10-08-PLAN.md`, `10-SECURITY.md`).
- **Running the full measurable battery this session:** unit `823 passed (823)` across
  `39 passed (39)` files (`--skip-nx-cache`, matches the expected baseline exactly, no
  delta to report), `npm run integration --skip-nx-cache` `4 passed (4)` across 2 files
  (including the CORR-05 integration spec, which genuinely exercised the real-platform
  branch on this win32/arm64 machine), `npm run typecheck` exit 0, `npm run lint` exit 0,
  `npm run check:action` (main tree) exit 0 with an empty bundle diff.
- **One independently-run mutation test**, beyond the two already recorded in
  `10-VERIFICATION.md` (the `needs:` revert and the `cachePlatform`-hoist move): I
  temporarily broke `isCurrentAssetName` in `release-asset-name.ts` (appended `&& false`)
  and re-ran `cleanup.spec.ts` + `release-asset-name.spec.ts` + `mirror-seed.spec.ts`.
  **Observed RED: 11 of 106 tests failed** across all three files -- the RETAIN-04
  mixed-shard dry-run, the RETAIN-05b mutual-exclusivity table, and the OBS-05 round-trip
  case all correctly reddened. Reverted with `git checkout --`, confirmed `git status`
  clean, re-ran the full unit suite: back to `823 passed (823)`. This directly answers
  the adversarial concern (four prior instances in this phase of a guard that passed for
  the wrong reason) for the highest-stakes new guard (a DELETE-path filter).

### Correctly left open (2 of 33) -- not gaps

- **OBS-05** "live: each `publish-verify` leg reads back its OWN leg's asset" and
  **XOS-07** "live: one push mirrors that push's full task set" both stay `[ ] pending`.
  Both are push-to-`main`-gated; this branch is 211+ commits ahead of `origin/main` and
  unmerged, so no local or PR-scoped run can reach them. Both are represented in the
  Manual-Only Verifications table above with instructions. No local substitute was
  invented.

### Correction to an upstream artifact (reported, not edited)

The Wave 0 checklist's D-25 bullet and the Manual-Only Verifications table's "Pre-rename
XOS-02 baseline" row both still read as forward-looking instructions ("Capture BEFORE any
rename commit"). That capture is not still pending -- it is **already done**:
`10-EVIDENCE-PRE-RENAME.md` records the D-25 baseline measured at commit `06019d4`, before
CORR-02's rename landed. This does not change any row's status (D-25 is not one of the 33
per-task rows), and per this audit's brief the Manual-Only table is being kept as-is rather
than restructured -- recorded here as a correction rather than silently edited.

### Sign-Off verdict

All 8 Sign-Off boxes ticked. The two boxes carried over from Phase 9 as genuine checks
(not formalities) were independently re-run against the CURRENT tree rather than trusted
from a prior audit, per row detail above: zero G2 (rate-zero sampling) violations, zero
live G3 (negated-quantifier-in-`toHaveBeenCalledWith`) violations.

### Verdict

**FILLED.** 33/33 rows resolved: 31 `[OK] green`, 2 correctly `[ ] pending` (live-CI-only
by design, not gaps). `nyquist_compliant: true`, `wave_0_complete: true`,
`status: passed`.

---

## Post-Audit Addendum 2026-07-29 -- the two live-CI rows CLOSED

The audit above left OBS-05's per-leg read-back and XOS-07's full-task-set census `[ ] pending`
on the correct ground that both are `push`-to-`main` gated and the branch was unmerged. That
condition no longer holds: a maintainer-authorised TEMPORARY push to `main` sampled them on run
`30471772954`, and `main` was then restored to `fe25a3f` (verified by SHA equality).

Both rows are now `[OK] green`, so `rows_green` moves 31 -> 33 and `rows_manual_only` 2 -> 0.
This is a new MEASUREMENT arriving after the audit, not a revision of its judgement -- the audit
named exactly this as the condition for closing them.

- **OBS-05:** each `publish-verify` leg named its OWN OS as publisher (`mirrored-by: linux` on
  the ubuntu leg, `mirrored-by: windows` on the windows leg), and the non-vacuity condition held
  -- `publish (windows)` mirrored exactly ONE asset, its own seed `nx-cache-feed030471772954`,
  not zero.
- **XOS-07:** `publish` started 3 s after the LAST of its four `needs:` dependencies finished
  (`integration (windows-11-arm)` at 16:43:49Z, publish at 16:43:52Z), having waited ~3m16s for
  it; the shard gained 16 new-form assets with all ten real task hashes present exactly once and
  the legacy `<hash>-<os>` count unchanged at 72.

The pre-registered CORR-02 falsifier did NOT fire: measured `readMisses` is 0, not
`readMisses == scanned`.

Full detail, including the before/after census and the `main` backup/restore record, is in
`10-EVIDENCE-LIVE-CI.md`. The Manual-Only Verifications table above is left as authored; its
first two rows are now discharged by that file.
