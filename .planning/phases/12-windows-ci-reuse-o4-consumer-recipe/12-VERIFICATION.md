---
phase: 12-windows-ci-reuse-o4-consumer-recipe
verified: 2026-07-30T21:10:00Z
status: passed
score: 9/13 must-haves verified at verification time; 13/13 after the four human-verification items were CLOSED downstream
human_verification_closed: 2026-08-08
human_verification_closed_by: >-
  Quick task 260808-lpt, by re-deriving each closure from its own named downstream
  artifact rather than from any summary of them. Item 1 (the per-leg `[remote cache]`
  counts on a first same-repo PR run) by 12-UAT.md test 1 -- run 30586177358, PR #12,
  FIRST run, event=pull_request, headSha=e757d4c, measured 1/2/1 total 4 with every
  ubuntu leg MISS-and-saved in the same run -- against the counts 11-EVIDENCE.md's O4
  section pre-registered before any observation existed. Item 2 (the
  `windows-regression-detector.yml` dispatch) by quick 260803-mew, per this file's own
  `superseded:` key and 260803-mew-EVIDENCE.md's PASS and FAIL directions. Item 3
  (RESEARCH assumption A1) by 12-VALIDATION.md, which records A1 as CLOSED BY
  MEASUREMENT, not by inference. Item 4 (the `docs/cross-os.md` prose review) by
  12-UAT.md test 4, result pass, no inaccuracy found. See
  `## Human Verification Closed` at the end of this file.
behavior_unverified: 0
overrides_applied: 0
human_verification:

  - test: "Open the FIRST run of a same-repo pull request for this branch (never a re-run) and, per Windows leg, count `[remote cache]` occurrences in the leg's log with `rg -o -F \"[remote cache]\" <log> | wc -l`."
    expected: "build-windows=1, typecheck-windows=2, test-windows=1 (total 4), each ubuntu leg MISS-and-saved in the same run."
    why_human: "XOS-05's core claim is a property of the GitHub Actions cache service across two live jobs. No proving run exists on the remote (tip is unmoved at 38f9aea, 57 commits behind local HEAD, zero open PRs), and opening the PR is a carried operator decision the executor correctly declined to take unilaterally. Code, guard and pre-registration are all present and wired; only the observation is missing."

  - test: "After merge to main, dispatch `windows-regression-detector.yml` (`gh workflow run windows-regression-detector.yml`) and confirm the run's log contains the literal `Successfully ran targets build, typecheck, test for project`."
    expected: "The detector job goes green on a real windows-11-arm runner with the plural success line present."
    why_human: "GitHub only dispatches a workflow file present on the default branch, so this is structurally impossible to prove pre-merge. The command itself was measured green locally on win32/arm64 (12-03); only the CI dispatch is unverified."
    superseded: "SUPERSEDED by quick 260803-mew. The three-target literal named above as the expected evidence is no longer the needle: it was measured at `e757d4c`, and `9e79009` replaced it with the FOUR-target `Successfully ran targets build, typecheck, test, lint for project` (`git merge-base --is-ancestor 9e79009 e757d4c` is FALSE, so the closing run 30603713356 predates the current needle). Both directions of the four-target form are now observed on real windows-11-arm runners without waiting for merge, via an operator-authorised temporary main window: run 30825110047 PASS at headSha 41f65e1, and run 30825602626 FAIL at the needle's grep with nx at exit 0 in the same step. See 260803-mew-EVIDENCE.md. This entry is a forward pointer only -- status, score and the other counters are deliberately unchanged, because this is not a re-verification."

  - test: "Once any CI run exists on a tree carrying `node --no-warnings -p process.platform` (post plan 12-04, commit 3d9f895+), download both hash-parity-<runner> artifacts and read the discriminator's stdout/stderr pair for linux and win32."
    expected: "stdout `linux`/`win32` respectively, stderr EMPTY on both legs, confirming `--no-warnings` closes the stderr channel on linux/arm64 too (RESEARCH assumption A1)."
    why_human: "The only artifact checked so far (run 30500255530) recorded the PRE-hardening command (`node -p process.platform`, no flag) because the hardened literal is unpushed. A1 remains explicitly OPEN, not closed by inference, per 12-06's own record."

  - test: "Read docs/cross-os.md end to end and judge whether the recipe is correct and safe for an external consumer to copy."
    expected: "The safe-default framing, the checklist, and the trap comments are technically accurate and not merely present."
    why_human: "This is a prose/judgement review, not a mechanical assertion. The drift guard proves the doc SAYS the right things; it cannot prove the doc MEANS them. The phase's own VALIDATION.md and every plan's `<verification>` block name this as a review item for `/gsd:code-review`, not a covered truth."
---

# Phase 12: Windows CI Reuse (O4) + Consumer Recipe Verification Report

**Phase Goal:** Windows CI reuses Linux CI's portable artifacts, and an outside project can copy the
recipe without inheriting a wrong-result risk.

**Verified:** 2026-07-30T21:10:00Z
**Status:** passed
**Re-verification:** No -- initial verification

**On that Status line, stated plainly so the edit is not mistaken for a quiet upgrade.** It read
`human_needed` at the moment of verification, and that was the correct value for the tree this
report audited. It was updated on 2026-08-08 because the four human-verification items were
CLOSED downstream and each closure was re-derived from its own named artifact --
**not when it was waived**, and not by re-running the verification.
Nothing below this line has been re-judged: the
13-truth findings table, the per-item verdicts, the at-verification score and the
`## Central Question` section are the record of what was true on 2026-07-30 and are left exactly as
written. The closures are appended under `## Human Verification Closed` at the end of this file,
which is now the status of record.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `ci.yml` declares `build-windows`/`typecheck-windows`/`test-windows`, each `runs-on: windows-11-arm`, `needs:` a bare single ubuntu producer, `timeout-minutes: 15`, sidecar present, own `npm run <target>` only, no job-level `if:` (XOS-04, XOS-08) | VERIFIED | Read `.github/workflows/ci.yml:434-579` directly -- all three jobs present with exact shape claimed. `rg` confirmed zero `if:` lines inside any of the three blocks and `runs-on: windows-11-arm` occurs exactly 3 times |
| 2 | The drift guard for the three legs is non-vacuous: indent-anchored (`^ {4}`/`^ {6}`), scoped to `jobBlock(<leg>)`, not a file-wide token match | VERIFIED | Read `dogfood-cross-os.spec.ts:628-741` -- every clause anchored and scoped exactly as claimed; `windows-11-arm` occurs 25 times file-wide so an unanchored clause would be vacuous, and none is unanchored |
| 3 | A scheduled `--skip-nx-cache` `windows-11-arm` regression detector exists, hard-fails, demands the plural non-vacuous success needle, carries no sidecar/cache tier, `contents: read` only, no `concurrency:` block | VERIFIED | Read `.github/workflows/windows-regression-detector.yml` in full -- matches every claimed clause verbatim (cron `'23 4 * * *'`, `workflow_dispatch` only alongside `schedule`, no sidecar, plural needle) |
| 4 | The detector workflow is registered as an `nx.json` `test` input in the SAME commit as its spec guard, so it cannot replay a stale cached PASS; same for `docs/cross-os.md` | VERIFIED | `nx.json`'s `targetDefaults.test.inputs` lists both, adjacent to `ci.yml` and `docs/configuration.md` respectively; `git log` shows both landed with their guards in the commits claimed (`91dbdc1`, `6c0c2d1`) |
| 5 | The three Windows legs exhibit `[remote cache]` HITs against ubuntu-saved entries on live CI, first run of the proving PR (XOS-05's core O4 claim) | PRESENT_BEHAVIOR_UNVERIFIED | Pre-registration (1/2/1, total 4) is fixed and committed (`f5d03b0`) before any observation attempt (`29484b3`); independently re-derived the same counts via `nx run-many -t <target> --graph`. No proving run exists: remote tip unmoved at `38f9aea`, 57 commits behind local HEAD, zero open PRs (verified via `git ls-remote`, `git rev-list --count`, `gh pr list`). Verdict is honestly PENDING, not fabricated |
| 6 | The write decision (Windows legs write, forced not chosen) is recorded alongside TRUST-11/12 with both halves (race removed vs. second producer not removed) | VERIFIED | `10-SECURITY.md` contains "Leg A -- ... removes the concurrent race", "Leg B -- ... does not remove the second producer", `select-backend.ts`, `D2-02`, `TRUST-05`, all present as claimed |
| 7 | `docs/cross-os.md` exists: safe default section 1, portability checklist section 2 (exactly 5 items, no 6th), architecture/libc/arm64-limit related in one sentence, exact discriminator rendered at both sites, registered as `nx.json` `test` input, linked from README and `docs/advanced.md` | VERIFIED | Read the doc in full -- matches every clause. `README.md:149` and `docs/advanced.md:59` both link it; `nx.json` places it adjacent to `docs/configuration.md` |
| 8 | The discriminator `node --no-warnings -p process.platform` is single-sourced across the whole tracked tree; the old spelling is gone; CORR-04's byte-identical invariant is superseded in place with a replacement reason | VERIFIED | `rg --hidden` sweep (with positive control) found 11 occurrences of the new literal and a genuine no-match (exit 1) for the old one. `08-ROOT-CAUSE.md:1596` carries the `SUPERSEDED` block with all required components (`hash_runtime.rs`, `PID`, `cmd /C`, `phase-scoped`, `nx-target-inputs.spec.ts`) |
| 9 | No debt markers or vacuous/half-locked guards were introduced by this phase | VERIFIED | `rg` for `TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER` across all phase-modified files found only "do NOT stub a placeholder" negations. Checked every remaining `toContain` in the new specs against its occurrence count in the target file -- each occurs exactly once, so none is half-locked. The one genuine two-occurrence case (the discriminator in `docs/cross-os.md`) is already asserted by exact `toBe(2)`, not `toContain` |
| 10 | Full test suite, typecheck, lint, format and action-bundle checks are all green with no drift | VERIFIED | Independently re-ran: `42 files / 896 tests` passed, `typecheck`/`lint`/`format:check` all exit 0, `npm run check:action` exit 0 with no diff on `start-cache-server/index.js` |
| 11 | The scheduled detector goes green on a real `windows-11-arm` GitHub Actions runner | PRESENT_BEHAVIOR_UNVERIFIED | Structurally impossible pre-merge: GitHub only dispatches a workflow file present on the default branch. The COMMAND itself was measured green locally (12-03, `886/886` on win32/arm64); the CI dispatch remains unobserved |
| 12 | RESEARCH assumption A1 -- `--no-warnings` behaves identically (stderr-empty) on `linux/arm64` | UNCERTAIN | Explicitly left OPEN by 12-06's own record. The only available hash-parity artifact (run `30500255530`) records the PRE-hardening command, not the new literal (which is unpushed), so A1 cannot be closed by inference and was not claimed closed |
| 13 | The consumer recipe (`docs/cross-os.md`) is correct and safe for an external adopter to copy | UNCERTAIN | Explicitly named a review judgement, not an assertion, by every plan's own `<verification>` block and by `12-VALIDATION.md`. Not covered by any mechanical guard by design |

**Score:** 9/13 truths verified (4 present, behavior-unverified)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `.github/workflows/ci.yml` | three `windows-11-arm` reuse legs plus corrected comment blocks | VERIFIED | Three jobs confirmed at exact lines with all required shape; invariant comment enumerates seven wired jobs; graph-premise comment corrected in place, step byte-unchanged |
| `.github/workflows/windows-regression-detector.yml` | the XOS-05 scheduled detector | VERIFIED | Exists, 114 lines, matches spec clause-for-clause |
| `packages/github-cache/src/dogfood-cross-os.spec.ts` | 3 new per-leg describes | VERIFIED | Present, indent-anchored, non-vacuous |
| `packages/github-cache/src/windows-regression-detector.spec.ts` | 8-clause shape guard | VERIFIED | Present, existsSync-guarded, non-vacuous |
| `packages/github-cache/src/docs-cross-os.spec.ts` | single-sourced doc drift guard | VERIFIED | Present, reads `nx.json` rather than re-spelling, exact-count discriminator pin |
| `docs/cross-os.md` | consumer cross-OS recipe | VERIFIED | Present, correct section order, 5-item checklist, honest arch/libc limit |
| `nx.json` | test-input registrations for detector + doc; hardened `integration` runtime | VERIFIED | Both entries present and adjacent to their neighbors; runtime literal is the hardened form |
| `capture-hashes.mjs` | corrected evidentiary language, behavior unchanged | VERIFIED | Both attribution sites corrected; `FORBIDDEN_TARGETS` and all six assertions byte-unchanged |
| `.planning/phases/10-os-invariant-releases-mirror/10-SECURITY.md` | TRUST-11 Q1 re-pricing | VERIFIED | Leg A / Leg B split present with all required tokens |
| `.planning/phases/11-live-proofs-o1-o2-o3/11-EVIDENCE.md` | O4 section filled in place | VERIFIED | Section discharged in place, no `12-EVIDENCE.md` created, status table and all other O4 references reconciled, verdict honestly PENDING |
| `.planning/phases/08-nx-task-hash-parity/08-ROOT-CAUSE.md` | CORR-04 superseded in place | VERIFIED | `SUPERSEDED` block present with all six required components |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `ci.yml build-windows`/`typecheck-windows`/`test-windows` | `ci.yml build`/`typecheck`/`test` | `needs: <target>` bare scalar | WIRED | Confirmed at four-space indent, one producer each |
| `windows-regression-detector.spec.ts` | `.github/workflows/windows-regression-detector.yml` | `existsSync`-guarded read | WIRED | File exists, guard is green |
| `nx.json` | `windows-regression-detector.spec.ts` / `docs-cross-os.spec.ts` | `test` input registration, same commit as guard | WIRED | Both entries present, landed same-commit per `git show --stat` |
| `docs-cross-os.spec.ts` | `nx.json targetDefaults.integration.inputs` | JSON read, never re-spelled | WIRED | Confirmed: `process.platform` does not appear as a literal in the spec; it reads `nx.json` |
| `capture-hashes.mjs readDiscriminatorCommand` | `nx.json` | reads command rather than re-spelling | WIRED | Confirmed unchanged in plan 12-04; per-leg verification remains free |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|-----------------|--------------|--------|----------|
| XOS-04 | 12-01, 12-02, 12-06 | Windows leg exists for build/typecheck/test | SATISFIED | Structural claim, fully code-verified |
| XOS-08 | 12-01, 12-02, 12-06 | Windows legs `needs:` their ubuntu producer | SATISFIED | Structural claim, fully code-verified |
| XOS-05 | 12-01, 12-02, 12-03, 12-06 | Windows legs HIT on live CI; write decision recorded; scheduled detector required | PARTIALLY SATISFIED / NEEDS HUMAN | Detector + write-decision recording both SATISFIED; the live HIT observation itself is PENDING, not yet satisfiable pre-merge |
| DOCS-07 | 12-04, 12-05 | Safe-default consumer recipe, stderr-immune discriminator, registered, drift-guarded | SATISFIED | Fully code-verified |

No orphaned requirements: `REQUIREMENTS.md:658-661` maps exactly these four IDs to Phase 12, and no other ID does.

`.planning/REQUIREMENTS.md` remains byte-identical to pre-phase commit `0251bd3` (confirmed unchanged by the orchestrator and consistent with every plan's deliberate skip of `requirements.mark-complete` -- closing traceability is the orchestrator's `phase.complete` step, which runs after this verification).

### Anti-Patterns Found

None. Scanned every phase-modified file for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER` -- the only matches are negated instructions ("do NOT stub a placeholder... to make the suite green"), not actual debt markers. Checked every `toContain` assertion introduced by this phase against its measured occurrence count in the target file; none is half-locked (the one two-occurrence case, the discriminator in `docs/cross-os.md`, is already asserted by exact `toBe(2)`).

### Central Question -- Is XOS-05's PENDING state a legitimate terminal outcome or a disguised gap?

**Verdict: legitimate, not disguised.** Independently confirmed, not merely re-read from the SUMMARY:

- `git ls-remote --heads origin gsd/v0.0.2-os-invariant-cross-os-sharing` returns `38f9aea` -- the same tip Phase 11 left, strictly behind local HEAD by 57 commits (`git rev-list --count 38f9aea..HEAD`), with `git merge-base --is-ancestor` confirming linear ancestry (not divergence).
- `gh pr list --repo op-nx/github-cache --state open` returns nothing; `gh pr view 11` confirms PR #11 is CLOSED at `38f9aea`. No PR exists carrying the three Windows legs.
- `ci.yml`'s only triggers are `on: push: branches: [main]` and `pull_request` -- confirmed by direct read. There is no `workflow_dispatch` on `ci.yml`, so a phase-branch push genuinely cannot trigger CI, and a same-repo PR is genuinely the only pre-`main`-push vehicle. This is not an invented constraint; it is the file's actual trigger configuration.
- `ROADMAP.md:568` itself states, at planning time, "**Live-CI close**: XOS-05's HIT is only observable on a real windows-11-arm runner after a ubuntu leg has saved the entries" -- i.e. the roadmap authors already knew this success criterion could not close within a single execution session, before any plan was written.
- The pre-registered counts (1/2/1, total 4) were independently re-derived here via `nx run-many -t <target> --graph` and matched exactly, and `git log` confirms the pre-registration commit (`f5d03b0`) precedes the observation-attempt commit (`29484b3`), so the ordering claim in the SUMMARY is not merely asserted -- it is visible in the commit graph.
- Opening the PR is explicitly scoped out as an operator decision rather than executor work. Given that `ci.yml` has no `workflow_dispatch` and no safe manual trigger exists short of a PR or a `main` push (which D-18 explicitly declines), this is a defensible scope boundary, not a missed opportunity: an autonomous agent unilaterally opening a PR against `main` to trigger paid CI minutes is exactly the kind of hard-to-reverse, outward-facing action that should route to a human decision.

No alternative vehicle was available and declined without cause. PENDING is the correct terminal state for this must-have, not a symptom of unfinished work.

### Human Verification Required

#### 1. The O4 live observation (XOS-05, XOS-04, XOS-08)

**Test:** Open the FIRST run of a same-repo pull request for this branch (never a re-run). Per Windows leg, count `[remote cache]` occurrences in the leg's log with `rg -o -F "[remote cache]" <log> | wc -l`.
**Expected:** `build-windows`=1, `typecheck-windows`=2, `test-windows`=1 (total 4); each ubuntu leg MISS-and-saved in the same run.
**Why human:** A property of the GitHub Actions cache service across two live jobs; no in-process test can observe it, and opening the PR is a carried operator decision.

#### 2. The detector going green on a real runner (XOS-05)

**Test:** After merging to `main`, dispatch `windows-regression-detector.yml` and read the run's log.
**Expected:** The plural success line `Successfully ran targets build, typecheck, test for project` appears; exit code alone is not sufficient evidence.
**Why human:** `workflow_dispatch` only fires for a workflow file present on the default branch, so this is structurally unobservable before merge.

**SUPERSEDED by quick 260803-mew.** The expected literal above is the THREE-target needle, measured
at `e757d4c` by run `30603713356`. Commit `9e79009` replaced the needle with the FOUR-target form
`Successfully ran targets build, typecheck, test, lint for project`, and
`git merge-base --is-ancestor 9e79009 e757d4c` is FALSE -- so that run cannot close the needle at
HEAD, and this item read as closed on a needle that no longer exists. Observed since, on real
`windows-11-arm` runners inside an operator-authorised temporary `main` window rather than after
merge: run **`30825110047`** (PASS, `headSha 41f65e1`, needle as genuine Nx output, `lint`
confirmed executing) and run **`30825602626`** (FAIL on a throwaway 3-of-4 tree, red at the
needle's `grep` with the plural three-target Nx line proving `nx` exited 0 in the same step). The
"structurally unobservable before merge" reasoning above is CONFIRMED rather than overturned: the
file still had to reach the default branch before the dispatch API would accept the call. See
`.planning/quick/260803-mew-observe-phase-12-fail-half-on-real-run/260803-mew-EVIDENCE.md`.

#### 3. RESEARCH assumption A1 (DOCS-07)

**Test:** Once a CI run exists on a tree carrying the hardened discriminator, download both `hash-parity-<runner>` artifacts and read the `discriminator` block's `stdout`/`stderr` pair.
**Expected:** `stdout` `linux`/`win32` respectively; `stderr` EMPTY on both legs.
**Why human:** The only artifact currently available records the pre-hardening command; the hardened literal has never run in CI because it is unpushed.

#### 4. Consumer recipe correctness (DOCS-07)

**Test:** Read `docs/cross-os.md` for technical accuracy and safety as an adoption recipe.
**Expected:** The guidance is not just present but actually correct and safe to follow.
**Why human:** A prose/judgement review the phase's own plans and VALIDATION.md name as belonging to `/gsd:code-review`, not to a mechanical assertion.

### Gaps Summary

No gaps. Every artifact this phase claims to ship exists, is substantive, and is wired -- independently confirmed by direct file reads, targeted greps with positive controls, an independent re-run of the full test suite (42 files / 896 tests, all green), an independent re-derivation of the pre-registered task-set counts, and an independent check of the remote git/PR state. The one requirement (XOS-05) that cannot close within this session is honestly recorded as PENDING rather than fabricated, and the phase's own ROADMAP entry anticipated this exact limitation before any plan was written. Four items are surfaced for human verification; none of them reflects missing or stubbed work in the codebase.

---

_Verified: 2026-07-30T21:10:00Z_
_Verifier: Claude (gsd-verifier)_

## Human Verification Closed

**Closed:** 2026-08-08 by quick task `260808-lpt`. All four items were CLOSED downstream --
**not when it was waived**.
Modelled on `08-VERIFICATION.md`'s section of the same name, including its honesty clause.

Each closure below was re-derived from its own named artifact. The v0.0.2 milestone audit's
"Phase 12's contradiction, resolved" table is a POINTER to these artifacts and was not used as the
source for any row.

| # | Item | Closed by | Evidence |
|---|---|---|---|
| 1 | Per-leg `[remote cache]` counts on a FIRST same-repo PR run (XOS-05's core O4 claim; truth 5) | Phase 12's own landing, observed | `12-UAT.md` test 1, result pass: run `30586177358`, PR #12, FIRST run, `event=pull_request`, `headSha=e757d4c`. Counted per leg from each leg's own log: `build-windows` 1, `typecheck-windows` 2, `test-windows` 1, total **4**, against the 1/2/1 total 4 that `11-EVIDENCE.md`'s `## O4 (XOS-04, XOS-05)` section pre-registered at `12-06-PLAN.md` before any observation existed. The producer half is the exact mirror in the same run -- every ubuntu leg MISSed, executed and saved. `REQUIREMENTS.md`'s XOS-05 traceability row carries the same observation |
| 2 | The `windows-regression-detector.yml` dispatch on a real runner (truth 11) | Quick `260803-mew` | This file's own `superseded:` key on human_verification item 2, confirmed against `260803-mew-EVIDENCE.md`: both directions observed on real `windows-11-arm` runners via an operator-authorised temporary main window, on the FOUR-target needle that `9e79009` introduced -- run `30825110047` PASS at `headSha 41f65e1`, and run `30825602626` FAIL at the needle's grep with `nx` at exit 0 in the same step |
| 3 | RESEARCH assumption A1 -- `--no-warnings` leaves stderr empty on `linux/arm64` (truth 12) | Measurement in `12-VALIDATION.md` | `12-VALIDATION.md:113` and its `### A1 -- OPEN at verification time, CLOSED by measurement at audit time` section: both leg artifacts from run `30586177358` downloaded and read, both recording the HARDENED command, `stderr` length **0** on both legs, `stdout` `linux\n` vs `win32\n`. Recorded there as CLOSED BY MEASUREMENT, not by inference |
| 4 | The `docs/cross-os.md` prose review (truth 13) | `12-UAT.md` test 4 | `12-UAT.md` test 4, result pass: every independently checkable doc claim verified against the repository (discriminator byte-identical to `nx.json`'s, exactly one `runtime` input and it is on `integration`, 28 `test` input entries, `* text=auto eol=lf` present, Nx 23.1.0, the `hash-parity-compare` job present, and the `nx show project` reproduction actually run). The two Nx-internals claims are sourced to `12-RESEARCH.md` rather than asserted. "No inaccuracy found" |

**The status of record for this phase is now this section**, read together with the frontmatter's
`human_verification_closed` / `human_verification_closed_by` keys. The `human_verification:` block
above is retained unchanged as the record of what was open at verification time.

**What this does NOT close, and one thing it corrects.**

- The four `human_verification:` entries above are kept verbatim, including item 2's existing
  `superseded:` forward pointer. Nothing in them has been rewritten.
- The 13-truth findings table, the per-item verdicts, the `**Score:** 9/13` line and the
  `## Central Question` section are preserved as written. Truths 5, 11, 12 and 13 still carry their
  at-verification verdicts (`PRESENT_BEHAVIOR_UNVERIFIED`, `PRESENT_BEHAVIOR_UNVERIFIED`,
  `UNCERTAIN`, `UNCERTAIN`). This section supersedes them in place; it does not re-verify them.
- **`11-EVIDENCE.md`'s O4 `### VERDICT` slot still reads `PENDING -- live-CI, first run of the
  proving PR`, and its "The observation attempt, and its honest result" subsection still records
  that no proving run existed at `f5d03b0`.** The observation that later closed item 1 was written
  into `12-UAT.md` and into `REQUIREMENTS.md`'s XOS-05 row, but was never written back into the
  slot that section reserved for it. That is a separate, still-open bookkeeping item in a Phase 11
  artifact, outside this task's scope; it is named here so a future reader does not read the
  PENDING verdict as contradicting this closure.
