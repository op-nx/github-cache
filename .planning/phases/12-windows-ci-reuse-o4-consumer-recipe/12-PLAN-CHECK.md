# Phase 12 Plan Check: Windows CI Reuse (O4) + Consumer Recipe

**Verifier:** gsd-plan-checker
**Date:** 2026-07-30
**Plans checked:** 12-01, 12-02, 12-03, 12-04, 12-05, 12-06
**Mode:** standard, goal-backward, adversarial

## VERDICT: ISSUES FOUND (0 blockers, 2 warnings)

No blocker prevents execution. Both warnings are documentation-precision defects that do not
threaten the phase goal, and each carries a self-correcting instruction already present in the
plan text. Execution may proceed; fixes are recommended but not required.

---

## Goal-backward questions, answered directly

**If all 6 plans execute exactly as written, is the phase goal achieved?**
Yes, no gap found. "Windows CI reuses Linux CI's portable artifacts" is delivered by 12-01/12-02
(the three windows-11-arm legs with needs: edges) plus 12-03 (the regression detector that keeps
the reuse honest) plus 12-06 (the live O4 proof, pre-registered and recorded). "An outside project
can copy the recipe without inheriting a wrong-result risk" is delivered by 12-04 (the repo's own
discriminator hardened and single-sourced) plus 12-05 (docs/cross-os.md, safe-default first,
checklist second, drift-guarded).

**Are all FOUR requirement IDs covered, and does each plan's claimed coverage match its tasks?**
Yes. requirements frontmatter across the six plans: 12-01 [XOS-04, XOS-08, XOS-05], 12-02
[XOS-04, XOS-08, XOS-05], 12-03 [XOS-05], 12-04 [DOCS-07], 12-05 [DOCS-07], 12-06
[XOS-05, XOS-04, XOS-08]. Union = XOS-04, XOS-05, XOS-08, DOCS-07 -- the authoritative FOUR per
REQUIREMENTS.md (CONTEXT D-00/D-01, correctly overriding ROADMAP's undercounted traceability table
which the plans also correct in the same pass). Cross-checked each plan's tasks against its claimed
IDs: 12-01's tasks author the RED guards for exactly XOS-04/08/05's shapes; 12-02's tasks add the
GREEN legs (XOS-04/08) and record the XOS-05 write-decision consequence; 12-03 is XOS-05's detector
half; 12-04/12-05 are DOCS-07's config and doc halves. No mismatch found.

**Is the wave/depends_on graph correct? Do 12-02 and 12-03 (same wave 2) share a files_modified
entry?**
Graph is correct: wave = max(dep waves) + 1 holds for all six plans (verified 01=1, 02=2, 03=2,
04=3, 05=4, 06=5). Verified files_modified for 12-02 = ci.yml, capture-hashes.mjs,
10-SECURITY.md and 12-03 = windows-regression-detector.yml -- zero overlap, confirming the
planner's claim. Cross-wave file ownership is also correctly sequenced: both 12-01 and 12-04 (and
12-05) touch nx-target-inputs.spec.ts at different content regions, and depends_on correctly
orders them (12-04 depends on 12-01 explicitly, not just transitively via 12-02; 12-05 depends on
12-04) so no two plans touching the same file ever land in the same wave.

**Does anything depend on an ordering not enforced by depends_on?**
No violation found. D-17 (no perishable-window ordering; keep depends_on for genuine build-order
dependencies) is honored: every depends_on edge traces to either a producer/consumer artifact
relationship (12-02 needs 12-01's guards to exist to go GREEN against; 12-04 needs 12-01's and
12-02's file states because it edits nx-target-inputs.spec.ts and ci.yml again) or a genuine
same-file edit sequencing need (12-05 depends on 12-04 for the same reason). No plan instructs an
executor to remember an ordering via a comment alone.

**Is any CONTEXT.md decision (D-02..D-22) relied upon but uncited, or cited but not implemented?**
No gap found. 12-01-PLAN.md's multi-source coverage audit table maps every CONTEXT decision D-02
through D-22 to at least one plan, and spot-checks against the actual task action bodies (not just
the coverage table) confirm each citation corresponds to real implementing text: D-04 (port 3000
unchanged) in 12-02; D-06 (forced write decision, measured against select-backend.ts) in 12-02 Task
2; D-08 (detector shape, hard fail, no sidecar) in 12-03; D-15/U-01 (single-sourced stderr-immune
discriminator) in 12-04; D-19 (pre-registered counts) in 12-06, independently re-derived and
verified below; D-21 (graph-premise claim correction, code unchanged) in 12-02 Task 1 Edit 3-4,
verified via an explicit acceptance criterion that the step's YAML is byte-unchanged.

## Independent verification of the two planner claims

### Claim 1 -- pre-registered counts are 1 / 2 / 1 (total 4), not 1/1/1, and D-19's build-HIT
### allowance does not hold this phase

VERIFIED CORRECT, by live measurement (read-only nx run-many -t TARGET --graph FILE, never
executing any task):

| Target | Resolved tasks (measured) | Plan's pre-registered count |
|---|---|---|
| build | 1 (github-cache:build only) | 1 -- matches |
| typecheck | 2 (github-cache:typecheck + github-cache:build, an inferred dependsOn from the JS/typescript plugin) | 2 -- matches |
| test | 1 (github-cache:test only; dependsOn resolves to zero tasks in this single-project workspace) | 1 -- matches |

Total = 4, matching plan 12-06's PRE-REGISTERED COUNTS section exactly.

Also verified the nx.json build target's inputs list directly: it includes
projectRoot/src/star-star/star.ts with explicit negated globs excluding spec/test files.
packages/github-cache/src/hash-parity/compare.ts (edited by plan 12-04, a non-spec src file)
therefore IS a build input, confirming the planner's override of CONTEXT D-19's "build does NOT
rotate on a ci.yml-only edit, so its ubuntu leg may well HIT" allowance -- this phase's edits are
not ci.yml-only, so the override to "all three MISS-and-save" is correctly derived, not asserted.

### Claim 2 -- a fully-restored Windows leg writes NOTHING (capability, not observation)

Correctly caveated. Plan 12-02 Task 2 explicitly marks this as DERIVED from RESEARCH F-6's
postRunSteps call-site enumeration, not measured, so the security auditor re-checks it rather than
inheriting it. This is standard, well-established Nx behavior (a cache HIT never re-triggers a save
because postRunSteps' shouldCache gate only fires for genuinely-executed tasks), and the plan does
not use the derivation to weaken or skip either XOS-05 consequence -- both the attribution-loss
record (12-02 Task 2) and the required detector (12-03) are unconditional, not gated on this
derivation. XOS-05's conditional clause fires on the capability (Windows legs CAN write), exactly
as instructed, not on an observed write during the proving run.

---

## Trap-by-trap verification (the phase's known failure-mode class)

- M-2 vacuous success-line needle: Correctly forbidden. Plan 12-01 Task 2's behavior/action mandate
  the plural three-target needle naming build, typecheck and test explicitly, with an acceptance
  criterion that the vacuous short-form needle appears ZERO times as a standalone pin. Plan 12-03's
  detector YAML uses the same plural needle. Confirmed non-vacuous shape.
- M-1 rg without --hidden drops .github/: Correctly corrected. Plan 12-04 Task 2's action and
  verify explicitly add --hidden plus a --glob exclusion for .git, and pair it with a positive
  control (the new literal must return exactly 8 hits). Independently re-verified the underlying
  fact: the token windows-11-arm occurs exactly 19 times in ci.yml and the sidecar preset-step
  phrase occurs exactly 5 times pre-phase -- both match PATTERNS.md's stated measurements exactly.
- Indent-anchoring: Plan 12-01 Task 1 requires every regex anchored at 4 or 6 leading spaces and
  explicitly forbids an unanchored word-boundary check on "build" (citing the file's own recorded
  tautology bug). Cross-checked against plan 12-02's actual YAML shape (the needs: rationale
  comment sits ABOVE the needs: line, never trailing on it), so the end-anchored regex is safe
  against a legitimate trailing comment.
- Half-locked phrases: "all four wired jobs" measured at exactly 1 occurrence (confirmed
  independently), so plan 12-02's single-edit-no-count-assertion approach is correct. The token
  windows-11-arm at 19 occurrences is correctly never asserted file-wide; every clause is scoped to
  a single job block. The sidecar preset phrase (5 -> 8) is asserted by occurrence COUNT in every
  plan that touches it, never by a bare containment check.
- Same-commit stale-cache guard: nx.json registration for the detector workflow lands in 12-01 (the
  SAME commit as its spec), before the workflow file exists in 12-03 -- this is actually stronger
  than the strict same-commit-as-artifact rule, since it closes the stale-pass risk window for the
  entire phase rather than for one commit (an Nx fileset input tolerates an absent path and still
  rotates the hash once content appears). docs/cross-os.md's registration lands in the literal SAME
  commit as the doc (12-05 Task 2). Both satisfy PARITY-08's lesson.
- Anti-requirements: All five (MISS-everything is not proof; a workflow re-run is not proof; a
  cache-hit-percentage line is non-discriminating in both directions; "green" without a paired
  count is not evidence; a green O4 CI is not portability evidence -- named CIRCULAR) are restated
  verbatim in plan 12-06's ANTI-REQUIREMENTS section, positioned before the tasks, and
  cross-referenced again in the Live-CI-close / threat-register language in 12-03.
- Pre-registration ordering (TEST-08): Plan 12-06 carries PRE-REGISTERED COUNTS as a named
  top-level section preceding all tasks, with the derivation stated, not the run. Independently
  re-derived and confirmed correct (see Claim 1 above).
- threat_model presence and substance: Present in all six plans. Substance check passed: every
  plan's threat model states that the concrete delta is exactly one thing -- a SECOND WRITER on an
  existing write path, with no new credential, no new write path, no new public surface -- and none
  inflate the delta into new attack surface. The record-controlled-value-into-GITHUB_ENV shape is
  explicitly CHECKED (not assumed) in every plan that touches CI YAML or a GITHUB_ENV-adjacent
  path, and confirmed absent in each case with a stated reason (the only GITHUB_ENV writes are a
  fixed literal URL and a locally minted random token, neither record- nor artifact-derived).
- Deferred items staying deferred: No plan reopens the sidecar-block drift guard, the every-commit
  graph-premise Vitest spec, the publish-matrix collapse, archive file-mode handling, PARITY-04's
  everyday-box question, macOS, or the codebase-docs regeneration. Explicit "Do NOT add" language
  appears at each relevant point. Scanned all six plans for scope-reduction language (v1/v2/
  simplified/static-for-now/placeholder/stub/etc.) and omission-justifying language (too-complex/
  non-trivial/would-take) -- zero matches in both sweeps.

---

## Issues found

### WARNING 1 -- plan 12-02's acceptance criteria contains a numerically wrong prediction

- Dimension: Numeric/Factual Claim Authority
- Plan: 12-02, Task 1, acceptance_criteria
- Description: One criterion asserts that counting the literal string "runs-on: windows-11-arm"
  in ci.yml after this plan's edits equals 6, reasoning that the count "was 3" before this phase
  because the integration, hash-parity and publish matrices resolve the runner label through
  matrix.os. Live measurement (read-only rg) against the current tree shows the literal string
  "runs-on: windows-11-arm" occurs 0 times today, not 3 -- because matrix jobs render
  "runs-on: dollar-brace-brace matrix.os brace-brace" and never the literal OS name, so no matrix
  job ever contributes to this specific literal-string count. (There are also actually FIVE matrix
  jobs carrying windows-11-arm as an os: option -- integration, hash-parity, dogfood-verify,
  publish, publish-verify -- not the three named, though this does not change the literal-string
  count since none of them produce it either way.) The correct after-phase count is 3 (0 plus the
  three new literal runs-on lines from the three new jobs), not 6.
- Why it's a WARNING, not a BLOCKER: This wrong number lives only in the acceptance_criteria
  checklist, not in the verify/automated gate that programmatically decides task completion (that
  gate runs the windows-scoped test suite plus the graph-premise assertion script, and does not
  reference this count at all). The clause also already instructs the correct fallback methodology
  in the same breath: "MEASURE the before-count ... and assert the delta is exactly +3, rather than
  trusting the absolute number." A diligent executor following that instruction reaches the right
  answer (0 -> 3) despite the wrong headline number.
- Fix hint: Correct the criterion to state the accurate before/after counts (0 -> 3), or drop the
  wrong "equals 6" headline and keep only the delta-based instruction, to avoid an executor wasting
  time trying to reconcile a number that cannot be reached by a correct implementation.

### WARNING 2 -- RESEARCH.md's Open Questions section lacks resolution markers (Dimension 11)

- Dimension: Research Resolution
- File: 12-RESEARCH.md, the "Open Questions" section (distinct from the separate, properly-marked
  "U-01 RESOLVED" section earlier in the same file)
- Description: Per the required convention, an Open Questions section should either carry a
  RESOLVED heading suffix or each listed question should carry an inline RESOLVED marker. Neither
  is present for the four questions in this section (CORR-04 supersession authority; one combined
  detector command vs. three steps; where docs/cross-os.md links from; whether test ever executes
  on Windows post-O4).
- Why it's a WARNING, not a BLOCKER: Each of the four questions carries an explicit
  "Recommendation:" line, and each recommendation is concretely followed by a plan task: plan 12-04
  Task 3 makes and documents the CORR-04 supersession decision (with a stated fallback if a
  reviewer disagrees); plan 12-03 Task 1 picks the one-command detector shape; plan 12-05 Task 2
  links from both README and docs/advanced.md; plan 12-03's header comment states the "test never
  executes on Windows post-O4" sentence exactly where CONTEXT/RESEARCH ask for it. Functionally
  resolved in the plan artifacts; only the RESEARCH.md formatting marker is missing.
- Fix hint: Rename the heading to "Open Questions (RESOLVED)" or add inline RESOLVED markers per
  question, purely for future-audit hygiene.

---

## Dimension-by-dimension summary

| Dimension | Result |
|---|---|
| 1. Requirement coverage | PASS -- all 4 requirement IDs (XOS-04, XOS-05, XOS-08, DOCS-07) covered, ROADMAP/REQUIREMENTS discrepancy correctly resolved per D-00/D-01 |
| 2. Task completeness | PASS -- every task has files/action/verify/done or is a doc-only task with automated verify |
| 3. Dependency correctness | PASS -- wave numbers consistent with depends_on; no cycles; zero file overlap confirmed between 12-02/12-03 (same wave) |
| 4. Key links planned | PASS -- artifacts wired via existence-guarded reads, nx.json registration, and single-sourced JSON extraction (never re-spelled literals) |
| 5. Scope sanity | PASS -- 2-3 tasks/plan throughout; largest file list is 12-04's 8 files (within 5-8 target band) |
| 6. Verification derivation | PASS given phase nature (CI/tooling/docs, not UI) -- truths are concrete, testable, requirement-traced |
| 7. Context compliance | PASS -- D-02 through D-22 all cited and cross-checked against actual task text, not just the coverage table |
| 7b. Scope reduction | PASS -- zero scope-reduction or omission-justifying language found across all six plans |
| 7c. Architectural tier compliance | PASS -- all 7 capabilities in RESEARCH.md's Responsibility Map correctly assigned by the plans |
| 8. Nyquist compliance | PASS -- VALIDATION.md exists; every task has automated verify; no watch-mode flags; no E2E/latency risk; sampling continuity trivially met |
| 9. Cross-plan data contracts | PASS -- no conflicting transforms; discriminator string touched only by 12-04, downstream plans correctly do not reference the old literal |
| 10. CLAUDE.md compliance | PASS -- ASCII-only enforced with acceptance criteria, action-bundle regeneration handled in-commit, junctioned-worktree caveat restated, no unsafe git staging usage |
| 11. Research resolution | WARNING (see above) |
| 12. Pattern compliance | PASS -- PATTERNS.md exists; every plan's read_first cites the exact analog file/line |
| Verify command format sanity | PASS -- no vacuous package-manager-list-into-grep pattern; no swallowed-error-into-comparison pattern found |
| Numeric/factual claim authority | WARNING (see above) |

---

## Recommendation

0 blockers. 2 warnings, both non-blocking and each already partially self-mitigated by text in the
same clause. Execution may proceed as planned; the two fixes are optional quality improvements for
the planner to apply before or during execution, not a required revision loop.
