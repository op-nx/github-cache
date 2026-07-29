---
phase: 10-os-invariant-releases-mirror
verified: 2026-07-29T00:00:00Z
status: human_needed
score: 10/13 must-haves verified (2 uncertain, 3 correctly Live-CI-only)
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Push to main, then read the ubuntu publish leg's OBS-01 summary and the shard census for cache-mirror-<YYYYMM>."
    expected: "Nonzero mirrored count, readMisses 0, no all-restore-MISS warning; nx-cache-* names present; legacy <hash>-<os> names stop growing (CORR-02 warm-mirror precondition owed to Phase 11)."
    why_human: "publish / publish-verify are push-gated to main; no PR run samples them at any rate (by design, per plan 10-07's own human_needed block and 10-SC6-NOTES.md)."
  - test: "Read both publish-verify leg logs after the same push."
    expected: "publish-verify (windows-11-arm) logs a windows-produced payload and label mirrored-by: windows; publish-verify (ubuntu-24.04-arm) logs linux for both; publish (windows) summary reports mirrored: 1, not 0 (OBS-05)."
    why_human: "Same push-gate; OBS-05's live half cannot run pre-merge."
  - test: "Confirm the publish job in the same push run only starts after integration (windows-11-arm) completes, and that the resulting shard census contains no task hash mirrored under only one OS's production (XOS-07 full-task-set mirror)."
    why_human: "Same push-gate; this is the requirement's own designed proof shape, not observable in a PR."
    expected: "publish starts after integration (windows-11-arm); census shows the Windows integration hash mirrored by the ubuntu leg too."
---

# Phase 10: OS-Invariant Releases Mirror -- Verification Report (PARTIAL -- session interrupted)

**Phase Goal:** One asset name per hash with no OS component -- still prunable, still
attributable to its producer, and with the trust consequences of collapsing two namespaces
into one classified by an auditor rather than assumed away.

**Status:** human_needed (3 legitimate Live-CI-only items that cannot close pre-merge by
design, plus real gaps in MY OWN coverage -- see "Not verified" below).

**IMPORTANT -- this session was cut by a spend-limit reset partway through verification.**
This file is written from what was actually checked before the cutoff, not from a completed
pass over every artifact. Treat the "Not verified" section as load-bearing, not boilerplate.

## What I actually verified (with evidence)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | CORR-02: `releaseAssetName(hash)` returns `nx-cache-<hash>`, no OS component, single-sourced prefix, arity 1 | VERIFIED | Read `release-asset-name.ts` and `release-asset-name.spec.ts` directly: `releaseAssetName(hash: Hash): string { return \`${CACHE_KEY_PREFIX}${hash}\`; }`, prefix imported from `cache-key.ts`, `releaseAssetName.length === 1` pinned. |
| 2 | RETAIN-04: cleanup filter admits BOTH `nx-cache-<hash>` and legacy `<hash>-<os>`, same commit as CORR-02 | VERIFIED | Read code: `isServerProducedAssetName = isCurrentAssetName(name) \|\| isLegacyOsSuffixedAssetName(name)`, legacy branch preserved verbatim. `git rev-list --count b37a358..77f675c` = 1 -- confirmed the whole rename wave (RETAIN-04+RETAIN-05+CORR-02) is exactly one commit. |
| 3 | RETAIN-05(a)(b)(c): tar.gz disposition recorded; branches mutually exclusive over adversarial table; CACHE_KEY_PREFIX 4-consumer lock | VERIFIED | (a) `10-EVIDENCE-PRE-RENAME.md` read in full: 50 `.tar.gz` / 46 `-linux` / 26 `-windows` census, decision recorded as accepted dead weight with bounding argument. (b) `release-asset-name.spec.ts`'s 26-row `ADVERSARIAL_NAMES` table read directly, both-true count pinned to `[]`, 3 structural atoms present. (c) `cache-key.ts`'s comment lock read directly, names all 4 consumers plus orphaning consequence. |
| 4 | XOS-07: `publish` job `needs: [build, typecheck, test, integration]`, guard is not superset-vulnerable | VERIFIED BY INDEPENDENT MUTATION TEST | I personally reverted `ci.yml`'s `needs:` line to `needs: build`, ran `npx nx run @op-nx/github-cache:test --skip-nx-cache -- dogfood-cross-os` myself (not trusting the SUMMARY): observed exactly the predicted 3-of-4 split -- `waits on typecheck`/`waits on test`/`waits on integration` FAILED, `waits on build` stayed GREEN. Reverted via `git checkout --`, confirmed clean, re-ran, all green again. This is the single strongest piece of independent evidence in this verification: the guard genuinely bites and is not vacuous (the exact failure class Phase 9 shipped twice). |
| 5 | XOS-06: `max-parallel: 1` retained, value-guarded, comment-locked as NOT a correctness control | VERIFIED (read, not mutation-tested) | Read `dogfood-cross-os.spec.ts` directly: separate `it()` asserts `/^ {6}max-parallel:\s*1$/m` with a reason string naming the guard-sensitivity-vs-correctness distinction. Shares the same `jobBlock` mechanism I proved bites for XOS-07, so I have moderate-high confidence though I did not mutate this specific line myself. |
| 6 | OBS-05: per-leg seed, tightened single-producer read-back, `mirrored-by` label as the dead-publish-leg detector | VERIFIED at code level | Read `read-back.ts` and `read-back.spec.ts` IN FULL. Axis is `it.each(CACHE_OS_VALUES)` throughout, `DEFAULT_READER_OS = CACHE_OS_VALUES[0]` (not a hand-authored `'linux'`), `CROSS_PRODUCER_PAIRS` built combinatorially from the real tuple. Label mismatch/empty-label/pagination/absent-after-all-pages/non-404-fault cases all present and each driven by the tuple. This is code-level verification; the LIVE observation is correctly human_needed (see above). |
| 7 | TRUST-11 / TRUST-12: recorded as QUESTIONS with a proposed classification explicitly labelled INPUT, not conclusion | VERIFIED | Read `10-TRUST-EVIDENCE.md` Part B in full: the INPUT-not-conclusion framing appears before the proposed classification, arbitration point corrected to `saveCache` with code citations, required reading given by path and by a concrete commit range I independently confirmed (`git rev-list --count 3327a4f..7d467e8` = 51, matching the artifact's own claim exactly). |
| 8 | TRUST-13: NOT self-certified, still open | VERIFIED | REQUIREMENTS.md checkbox unticked (matches coordinator-supplied state). No `10-SECURITY.md` exists in the phase directory (confirmed by the directory listing taken at the start of this session). `10-TRUST-EVIDENCE.md` explicitly instructs the next step to spawn `gsd-security-auditor` and not take `/gsd:secure-phase`'s inline short-circuit. Correctly open, not a gap. |
| 9 | Five same-commit rules held in git, not just in prose | VERIFIED | `git rev-list --count b37a358..77f675c` = 1. `git show --name-only 77f675c` lists 14 files: the 13 the plan declared plus `publish-mirror.spec.ts`, which the commit message and `10-07-SUMMARY.md` both document as an honest, in-scope deviation (a test asserting the deleted OS-suffixed name shape, re-authored rather than deleted). No undisclosed scope creep found. |
| 10 | Pre-condition owed to Phase 11: XOS-02 baseline captured before the rename | VERIFIED | `10-EVIDENCE-PRE-RENAME.md` read in full: live HTTP 200 / 410-byte read on the pre-rename `<hash>-<os>` asset, dated before `77f675c`; the accompanying Nx-level MISS is correctly attributed to "never mirrored on this unmerged branch" rather than misrecorded as a regression. Matches the verify-hardest brief's own framing exactly. |

## Uncertain (checked partially, not enough to call VERIFIED)

| # | Truth | Status | Why uncertain |
|---|-------|--------|----------------|
| 11 | OBS-03: every mirrored asset carries `mirrored-by: <os>` label, adapter forwards it, `cachePlatform` called once per run | UNCERTAIN | I did not read `publish-mirror.ts` or `action/index.ts` directly this session (ran out of time before the cutoff). Resting entirely on plan/SUMMARY claims, which this verifier's own mandate says not to trust. No code-level confirmation from me. |
| 12 | CORR-05: zero extant ambient-platform reads in unit specs (3 sites removed, 1 moved to integration) | UNCERTAIN (partial) | `release-asset-name.ts`/`.spec.ts` confirm the platform PARAMETER is gone (2 of the 3 remaining sites' underlying cause). I did NOT read `lint-rules.spec.ts` (the `CORR_05_SITES` emptying + positive assertion) or `releases-backend.spec.ts` directly. `10-PLAN-CHECK.md` (a prior, independent static check) corroborates both, but that is not my own verification. |
| 13 | TRUST-10: C1/C2/C16/ref-scoping verified rather than assumed | UNCERTAIN (partial) | Read `10-TRUST-EVIDENCE.md` Part A closely -- it shows real commands (`git diff --stat <base>..HEAD -- lib/trust.ts lib/sync-gate.ts`) and their observed empty output, which is good practice, but I did not re-run those diffs myself before the cutoff. |

## Not verified (this session's coverage boundary -- be explicit, per instruction)

- **6 of 8 plan SUMMARY files never read**: only `10-07-SUMMARY.md` was read in full. `10-01, 10-02, 10-03, 10-04, 10-05, 10-06, 10-08-SUMMARY.md` were not opened this session (though all 8 PLAN.md files were read in full, and PLAN.md + the code itself are stronger evidence than a SUMMARY anyway).
- **Production source files never read directly**: `publish-mirror.ts`, `action/index.ts`, `mirror-seed.ts`, `cleanup.ts`, `releases-backend.ts`. The both-byte-identity-comment-rewrite claim (verify-hardest item 7), the mirror-seed url-derivation trap (OBS-05), and the `ref`-scoping pin itself (TRUST-10) all live in files I did not personally open.
- **Spec files never read directly**: `lint-rules.spec.ts`, `docs-same-os-claims.spec.ts`, `cleanup.spec.ts`, `mirror-seed.spec.ts`, `action/index.spec.ts`, `releases-backend.spec.ts`, `publish-mirror.ts`'s own non-spec content (only ~50 lines of `publish-mirror.spec.ts` were read, around the OBS-04 warning-message assertion).
- **Only one mutation test was independently run** (XOS-07's `needs:` guard). Phase 9's two disproved-guard shapes (G2 hardcoded-OS-at-rate-zero, G3 negated-matcher-inside-toHaveBeenCalledWith) were checked by repo-wide `rg` scan only (found zero real G3 violations -- the one hit was inside an explanatory comment, confirmed by reading context; found one intentional, well-commented `'linux'` literal in `action/index.spec.ts` for a pre-existing single-leg job, not a new violation) -- not by mutation-testing a second guard end-to-end.
- **10-VALIDATION.md's 14 `[W0]` rows were not cross-checked one-by-one against shipped code.** I counted 14 `[W0]` rows in the table, not the 10 the dispatch brief stated -- possibly a grouping difference, not re-derived. Also worth flagging: this file's own frontmatter still reads `status: draft`, `nyquist_compliant: false`, `wave_0_complete: false`, and every per-task row is `[ ] pending` with `Approval: pending` -- it was never updated post-execution, which suggests `/gsd:validate-phase` has not yet run for this phase. That is a process-sequencing observation, not a code defect; flagged as ADVISORY, not a blocker.
- **Stale-prose sweep (verify-hardest item 9)** was not independently re-swept across the phase's touched files; relied on `10-TRUST-EVIDENCE.md`/SUMMARY claims that the sweep happened.
- **Did not run the full test battery** -- per instructions, and because the coordinator confirmed it is green at HEAD (823 tests; build/typecheck/lint/format:check/check:action/fallow:ci/integration all exit 0).

## Requirements checkbox sanity (REQUIREMENTS.md, read in full earlier this session)

Ticked (10): CORR-02, CORR-05, RETAIN-04, RETAIN-05, OBS-03, XOS-06, XOS-07, TRUST-10,
TRUST-11, TRUST-12. Not ticked (2, correctly): OBS-05 (live per-leg read-back is push-gated),
TRUST-13 (auditor has not run). Of the 10 ticked, this session directly code-verified 7
(CORR-02, RETAIN-04, RETAIN-05, XOS-06, XOS-07, TRUST-11, TRUST-12 -- TRUST-13 additionally
verified as correctly-still-open) and left 3 uncertain (OBS-03, CORR-05 partial, TRUST-10
partial) for the reasons above.

## Anti-pattern scan performed

Repo-wide `rg` scan for `toHaveBeenCalledWith(expect.not` (Phase 9 gap G3 shape): one hit,
in `publish-mirror.spec.ts`, read in context -- it is inside a comment EXPLAINING why that
shape is avoided (the actual assertion uses `.not.toContainEqual` plus a separate call-count
pin). No live G3 violation found. No debt markers (TBD/FIXME/XXX) scan was completed before
the cutoff.

## Gaps

None found as FAILED. Everything actually checked matched its claim, including one
independently-reproduced mutation test. The "Uncertain" and "Not verified" sections above are
the honest limit of this session's coverage, not evidence of a defect.

## Recommendation

Given the volume of unread production source and spec files, recommend a follow-up
verification pass (or a fresh `/gsd:verify-work` re-run) that specifically closes: OBS-03
(read `publish-mirror.ts` + `action/index.ts`), CORR-05 (read `lint-rules.spec.ts` +
`releases-backend.spec.ts`), and TRUST-10 (re-run the Part A diff commands independently).
None of this blocks proceeding to `/gsd:secure-phase 10` and `/gsd:validate-phase 10`, both
of which are independent gates that will exercise much of this same surface.

---

_Verified: 2026-07-29 (partial session, interrupted by spend-limit reset and resumed)_
_Verifier: Claude (gsd-verifier)_
