# Phase 7 Plan Check -- Lint Toolchain and the Ambient-Platform-Read Ban

## VERIFICATION PASSED

Reviewed: 07-01-PLAN.md, 07-02-PLAN.md, 07-03-PLAN.md, 07-04-PLAN.md against
ROADMAP.md Phase 7, REQUIREMENTS.md (LINT-01..06, CORR-05, CORR-06), 07-CONTEXT.md
(D-01..D-36), 07-RESEARCH.md (G1-G7, C1-C9, Validation Architecture), and
07-VALIDATION.md (M1-M9, non-vacuity table). No BLOCKER found. Two WARNING-level
observations recorded below; neither prevents the phase goal from being achieved.

---

## Phase-Specific Checks (P1-P11)

| # | Check | Verdict | Evidence |
|---|---|---|---|
| P1 | C2 correction: FOUR disables at real error positions (1/38/39/60), never a 5th at cache-archive-path.spec.ts:26; site table keyed on FILE+EXPRESSION, not line numbers | PASS | 07-02-PLAN.md:143-167 states "FOUR sites and FOUR error positions... There is NO fifth error position" and explains why line 26 would be an unused directive. Acceptance criteria at 07-02-PLAN.md:274-277 requires git grep -c for eslint-disable-next-line = 4 across 3 files, cache-archive-path.spec.ts accounts for exactly 1. Table-keying requirement at 07-02-PLAN.md:145-148 (key every row on FILE plus EXPRESSION TEXT, never a line number) and acceptance criteria 07-02-PLAN.md:271-273 (no row contains a line number as its key). The markdown prose table at 07-02-PLAN.md:150-155 uses "at line N" as human-readable description only; the acceptance criteria explicitly forbid the code constant from keying on line numbers, so the prose does not contradict the requirement. |
| P2 | C1 correction: ImportExpression selector (P6) present in no-restricted-syntax | PASS | 07-02-PLAN.md:198-199 lists P6: ImportExpression[source.value=/^(node:)?(os\|path)$/] and states at 07-02-PLAN.md:202-206 "P6 is MANDATORY, not optional... no-restricted-imports... has no import-expression visitor". Acceptance criteria 07-02-PLAN.md:263-264 requires a source assertion that the selector list contains an ImportExpression-prefixed entry. |
| P3 | C3 correction: global ignores covering dist/, out-tsc/ | PASS | 07-01-PLAN.md:229-238 creates a standalone ignores-only object with dist, out-tsc, test-output, .nx, coverage stems, with rationale citing the filesystem-walk-vs-git-file-map mismatch. Negative control (linted-file-count invariance across rm -rf dist out-tsc) is required in both 07-01-PLAN.md:318-321/348 and re-verified in 07-04-PLAN.md:111-116/137. |
| P4 | C8 ordering: install -> config -> plugin registration | PASS | Install happens in 07-01 Task 1 (07-01-PLAN.md:87-197); eslint.config.mjs is authored in 07-01 Task 2 (07-01-PLAN.md:199-363); @nx/eslint/plugin registration happens only in 07-03 Task 1 (07-03-PLAN.md:137-141), which depends_on chains through 07-02 back to 07-01, guaranteeing config exists before registration. 07-03-PLAN.md:46-49 states the ordering explicitly. |
| P5 | C5 ordering: .cjs override AFTER tseslint.configs.recommended spread | PASS | 07-01-PLAN.md:245-255 states item 4 "MUST come AFTER the tseslint.configs.recommended spread... an override placed before the spread is itself overridden and silently does nothing." Acceptance criteria 07-01-PLAN.md:338-340 requires a source assertion that the .cjs override's array index is greater than the spread's index. |
| P6 | D-25 second-order stale-cache hole: eslint.config.mjs enters test.inputs in the SAME COMMIT as the first guard spec reading it | PASS | 07-01 Task 3 creates lint-rules.spec.ts (07-01-PLAN.md:407-410) and extends nx.json targetDefaults.test.inputs (07-01-PLAN.md:446-457) in the same task; the plan objective (07-01-PLAN.md:62-68) declares Tasks 1-3 land as ONE commit, so the spec and the input wiring cannot land in different commits. |
| P7a | Non-vacuity: ESLint-returns-empty-array-for-ignored-paths trap, warnIgnored/ignore-warning assertion | PASS | 07-01-PLAN.md:423-424 passes warnIgnored: true explicitly; 07-01-PLAN.md:432-435 requires ONE shared non-vacuity helper asserting no severity===1 && ruleId===null message; acceptance criteria 07-01-PLAN.md:484-485 requires every assertion route through it. |
| P7b | Non-vacuity: "rule does NOT fire at integration path" paired with a DIFFERENT rule that DOES fire there (D-17) | PASS | 07-01-PLAN.md:397-400 establishes the CORR-06 control (no-explicit-any fires at .integration.spec.ts); 07-02-PLAN.md:121-123 explicitly pairs every ban-direction assertion with "the plan 07-01 control that a different rule DOES still fire at that same path." |
| P7c | Non-vacuity: nx-target-inputs.spec.ts filterUsingGlobPatterns-returns-everything trap and negative control (probe outside {projectRoot}) | PASS | 07-03-PLAN.md:107-123 selects start-cache-server/entry.ts as the negative-control probe (outside {projectRoot}, genuinely un-linted per D-07), states why build cannot be reused, and requires the assertion + comment in the same voice as the existing control. Acceptance criteria 07-03-PLAN.md:198-200. |
| P8 | Mutation testing M1-M9 as real executable work, expected failure sets, reverted before commit | PASS | 07-04-PLAN.md Task 2 (149-222) reproduces all nine mutations verbatim against 07-VALIDATION.md's table, requires OBSERVED (not merely expected) failure sets recorded in a 9-row table, and states "REVERT before moving to the next... Never commit a mutated tree" (07-04-PLAN.md:166-167, 201). Acceptance criteria 07-04-PLAN.md:207-216 require the reverted tree to pass the full battery. |
| P9 | LINT-04 closes by differential (ROADMAP SC4), not by config-reading | PASS | 07-04-PLAN.md Task 1 (59-147) runs RESEARCH G5's Measurements A/B/C plus both negative controls with before/after Cache: n/m hit lines and git SHAs recorded (acceptance criteria 07-04-PLAN.md:129-141). A spec-only closure is explicitly rejected: 07-VALIDATION.md:62 states unit test alone "does NOT close it". |
| P10 | Green at every commit; assess 07-01's 3-task/1-commit boundary and any other un-noticed red-commit risk | PASS | 07-01's boundary (07-01-PLAN.md:62-68) is forced: 5 new devDeps are uncredited by fallow until eslint.config.mjs (Task 2) imports 3 of them and lint-rules.spec.ts (Task 3) imports eslint itself -- a commit after Task 1 or Task 2 alone would trip fallow dead-code --fail-on-issues (battery command 6). Checked all other plan commit boundaries for the same class of risk: 07-02 Task 1 bundles RED-observation + rule-enablement + the 4 disables into one commit because the D-22 guard assertions themselves require the disables to already be on disk to pass (07-02-PLAN.md:127-130, 243-246); 07-02 Task 2, 07-03 Tasks 1-2, and 07-04 Tasks 1-3 each introduce no new uncredited dependency and commit independently without leaving a red state. No other un-noticed boundary found. |
| P11a | D-06: packages/github-cache/package.json UNTOUCHED | PASS | Not present in any plan's files_modified frontmatter. Explicit acceptance criteria: 07-01-PLAN.md:181 (byte-identical to its pre-task state, D-06), verification 07-01-PLAN.md:534, 07-03-PLAN.md:305. |
| P11b | No plan removes a CORR-05 violation | PASS | 07-02-PLAN.md:48-52 (objective) explicitly forbids removal; acceptance criteria 07-02-PLAN.md:280-281 requires git diff over the three violation-site files to show ONLY added comment lines; verification section 07-02-PLAN.md:424 restates it. |

---

## Requirement Coverage

| Requirement | Covering plan(s) / task(s) | Status |
|---|---|---|
| LINT-01 | 07-01 Task 1 (install+pin+guard, 87-197), 07-01 Task 2 (config, 199-363), 07-03 Task 1 (target registration, 68-210), 07-03 Task 2 (CI/script wiring, 212-277) | COVERED |
| LINT-02 | 07-02 Task 1 (two ban rules, 72-290), 07-02 Task 2 (scope-drift guard, 292-398) | COVERED |
| LINT-03 | 07-02 Task 1 (evasion + 4-site RED-before-GREEN, 99-250), 07-04 Task 2 (M1-M3 mutation proof, 149-222) | COVERED |
| LINT-04 | 07-01 Task 3 (test.inputs, 366-504), 07-03 Task 1 (lint.inputs + probes, 68-210), 07-04 Task 1 (differential closure, 59-147) | COVERED |
| LINT-05 | 07-01 Task 2 (require-description, ban-ts-comment config, 199-363), 07-02 Task 1 (4 described disables, 234-246), 07-04 Task 2 (M8, 149-222) | COVERED |
| LINT-06 | 07-01 Task 2 (reportUnusedDisableDirectives: error, 256-258), 07-02 Task 1 (stale-disable is what the removal schedule relies on), 07-04 Task 2 (M9) | COVERED |
| CORR-06 | 07-01 Task 3 (integration-path control, 397-400), 07-02 Task 1 (direction pair, 121-123) | COVERED |

All 7 requirement IDs from ROADMAP.md's Phase 7 Requirements line appear in at least one
plan's requirements frontmatter (07-01: LINT-01,04,05,06; 07-02: LINT-02,03,05,06,CORR-06;
07-03: LINT-01,04; 07-04: LINT-01,03,04,05,06 -- union covers all 7). No requirement is
uncovered.

---

## Standard Dimension Notes

- Dependency correctness: linear chain 07-01(wave1,[]) -> 07-02(wave2,[07-01]) ->
  07-03(wave3,[07-02]) -> 07-04(wave4,[07-03]). No cycles, waves consistent with depends_on.
- Task completeness: every task has files/action/verify/done; all automated verify
  commands are fast, non-watch (npm run test, npm run lint, npx vitest run FILE,
  npm run format:check) -- no E2E/watch-mode anti-patterns found.
- Context compliance: cross-checked all 36 locked decisions (D-01..D-36) against the four
  plans; every decision has an implementing task, no plan contradicts a locked decision, no
  Deferred Idea (sidecar dogfood, eslint@10, root-file linting, curly/blank-lines mechanization,
  .planning/codebase/* regen) appears in any plan.
  Notably, plans correctly follow RESEARCH's corrections over stale REQUIREMENTS.md/CONTEXT.md/
  ROADMAP.md text in three places, and record the deviation rather than silently diverging:
  (1) .mts vitest configs need NO override block (C4, 07-01-PLAN.md:299-302) though D-13's
  literal text implied one; (2) start-cache-server/entry.ts is NOT a lint input (C6/D-07) even
  though REQUIREMENTS.md's LINT-04(b) prose lists it -- 07-03 instead uses it as the negative-control
  probe precisely because it is unlinted (07-03-PLAN.md:112-114); (3) ROADMAP SC2's
  releaseAssetName(hash, 'win32') example is deliberately NOT used as the canonical allowed shape
  (D-18); cachePlatform('win32') substitutes for it, which asserts the identical underlying
  behavior (injected values are never banned) without reproducing the doomed example
  (07-02-PLAN.md:230-232).
- Scope reduction (7b): git grep scan across all four plans for scope-reduction language
  ("v1"/"v2", "static for now", "placeholder", "future enhancement", "stub", "not wired to", etc.)
  returned zero matches. No silent scope reduction found.
- Architectural tier compliance (7c): SKIPPED -- no "## Architectural Responsibility Map"
  section in 07-RESEARCH.md.
- Nyquist compliance (Dim 8): 07-VALIDATION.md exists (8e gate passes). Every task across all
  four plans carries an automated verify command (8a); no watch-mode flags, no full E2E suite,
  all commands are seconds-scale (8b); every task has automated verify so sampling continuity (8c)
  trivially holds; no MISSING markers present, so 8d is not applicable.
- Verify-command format sanity: no grep with a caret anchor on tree-formatted output, no
  swallowed-error-into-comparison pattern, in any automated block.
- Numeric/factual claim authority: the one apparent conflict (ROADMAP SC3 "three CORR-05
  violations" vs REQUIREMENTS/CONTEXT/RESEARCH "four") is pre-resolved by an explicit correction
  already appended to ROADMAP.md itself (the SC3 correction note), not a live plan-vs-research
  conflict requiring adjudication here.
- CLAUDE.md / AGENTS.md compliance: plans use npm run SCRIPT / nx run-many -t TARGET
  consistent with the workspace's package manager (npm) and the prefer-nx-run-many rule; the
  D-05 linux/arm64 container lockfile-regeneration requirement matches the project's own documented
  Windows-npm-install-prunes-Linux-optional-deps hazard. No plan issues a scaffolding/generator
  request that should have routed through the nx-generate skill (these are hand-edits to
  nx.json/eslint.config.mjs, not generator-driven scaffolding). No violations found.
- Pattern compliance (Dim 12): 07-PATTERNS.md exists with a File-Classification-bearing
  structure; every task across all four plans cites a specific 07-PATTERNS.md section by name in
  its read_first block for each file it creates or modifies. Full-text pattern-by-pattern diffing
  was not performed against the 940-line file, but citation coverage is complete across all
  created/modified files.
- Cross-plan data contracts (Dim 9): eslint.config.mjs, lint-rules.spec.ts, and
  nx-target-inputs.spec.ts are each extended incrementally across plans (07-01 -> 07-02 -> 07-03)
  with no plan stripping or re-transforming a prior plan's addition. No conflict found.

---

## WARNING Findings (non-blocking)

```yaml
issues:
  - severity: WARNING
    dimension: research_resolution
    plan: null
    location: "07-RESEARCH.md ## Open Questions (Q1-Q10)"
    problem: >
      The Open Questions section heading lacks a RESOLVED suffix and no individual
      question carries an inline RESOLVED marker (Dimension 11's literal convention). In
      substance every question already has an operationalized resolution path embedded in the
      plans: Q1 is explicitly transferred to Phase 8 rather than reasoned closed (07-04-PLAN.md
      Task 3, D-35/D-36), Q3/Q4 are measured in-phase by 07-01 Task 2's D-12 baseline command,
      Q6/Q7 have a primary route plus documented fallback in 07-02 Task 2, and Q8 has an explicit
      fallback recorded in 07-04 Task 1. This is a formatting gap in RESEARCH.md, not a
      substantive planning gap.
    fix: >
      Optional: mark the RESEARCH.md heading resolved and add an inline resolution note per
      question for future dimension-11 scans. Does not block phase execution.

  - severity: WARNING
    dimension: scope_sanity
    plan: "07-01"
    location: "07-01-PLAN.md frontmatter files_modified (lines 7-17), Tasks 1-3 (87-504)"
    problem: >
      07-01 modifies/creates 10 files across 3 tasks, all landing in a single forced commit
      (package.json, package-lock.json, .fallowrc.jsonc, eslint.config.mjs, nx.json, 3 spec
      files, a contingent action-bundle file, and 07-EVIDENCE.md) -- above the 5-8 file soft
      target and at the 10-file warning threshold. The plan's own objective (lines 62-68)
      documents why the 3 tasks cannot split across commits (a fallow:ci unused-dependency
      finding would fire on any earlier commit boundary), and P10 above confirms the reasoning
      holds and no other commit boundary in the phase has the same latent problem.
    fix: >
      No action required -- the single-commit shape is mechanically forced, not a planning
      oversight, and 3 tasks is within the task-count target. Flagged for visibility only.
```

---

## Summary

No BLOCKER issues found across the 11 phase-specific checks (P1-P11), the 7-requirement
coverage matrix, and the standard dimension sweep (task completeness, dependency correctness,
key-link wiring, scope sanity, must_haves derivation, context/decision compliance, scope-reduction
scan, Nyquist compliance, verify-command sanity, CLAUDE.md/AGENTS.md compliance, and pattern
citation coverage). Two WARNING-level, non-blocking observations are recorded above. The four
plans, executed in sequence, mechanically deliver both halves of the phase goal: a unit spec
deriving an expectation from the running machine fails lint naming the rule (07-02), and the
author cannot silence it without a described reason that is itself enforced
(reportUnusedDisableDirectives: error + require-description, 07-01/07-02), with the
stale-cache and RED-before-GREEN evidentiary chain (07-01 Task 3, 07-03 Task 1, 07-04) closing
the loop by measurement rather than by inspection.
