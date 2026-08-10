# Phase 11 Plan Check -- Verdict

**Phase:** 11-live-proofs-o1-o2-o3
**Plans checked:** 7 (11-01 .. 11-07)
**Structural validation:** clean (gsd-tools verify plan-structure over each of the seven plans:
valid=true errors=0 warnings=0, per orchestrator; planner independently reported the same)
**Hygiene:** clean (ASCII-only + zero email-shaped tokens across every Phase 11 artifact, per
orchestrator, verified with rg with the exit code checked)

## VERIFICATION PASSED (with warnings)

No BLOCKER found across the dimensions checked. Findings below are all WARNING-level: none of them
threaten goal achievement; all have independent mechanical enforcement or explicit reasoning already
present elsewhere in the phase's own artifacts.

---

## Check 1 (highest priority): the ordering trace -- HOLDS end to end

Traced against the depends_on chain ([] -> 11-01 -> 11-02 -> 11-03 -> 11-04 -> 11-05 -> 11-06 ->
11-07, waves 1-7, linear, no cycles, no forward refs):

- **Warm capture before reset:** 11-02 task 1 (warm capture, committed) runs BEFORE task 2
  (checkpoint gate authorizing nx reset) and task 3 (reset + cold capture). Task 1's own action
  states: "Do this FIRST... the box is warm right now and this number is unrecoverable once
  cleared." Matches RESEARCH.md's D-06 finding that the box is warm (18 .nx/workspace-data
  entries) at research time.
- **O1/O2 before any packages/ or ci.yml edit:** confirmed via depends_on -- 11-05 (first
  packages/ edit) and 11-06 (first ci.yml edit) are waves 5/6, strictly after 11-02/11-03 (local
  measurement) and 11-04 (attribution + sign-off gate at wave 4). 11-04 task 2 is a blocking
  checkpoint gating "proceed" vs "reopen-local-proof" vs "defer" before any hash-rotating edit
  lands, and its acceptance criteria state plans 11-05..11-07 are reported BLOCKED unless
  "proceed" is selected. This is a mechanical control (depends_on graph + a blocking task), not
  prose asking an executor to preserve ordering.
- **Sampling suspension between reset and measurement completion:** confirmed genuinely
  suspended. 11-02 states the after-every-task-commit nx test sampling is "SUSPENDED for tasks 2
  and 3 of this plan and for tasks 1 and 2 of plan 11-03"; 11-03 restates the same suspension for
  its own tasks 1 and 2. Both additionally forbid ANY nx invocation (not just nx test) between
  the reset (11-02 task 3) and the measurement run (11-03 task 2) -- correctly scoped, since a
  local cache hit from a stray nx call would short-circuit the remote read that IS the proof
  (TEST-10's own stated mechanism).
- **Post-measurement rebuild avoided:** 11-03 task 1 confirms dist/ currency via an mtime
  comparison rather than rebuilding, citing that nx reset does not touch dist/ (verified in Nx
  source per RESEARCH.md) and that a rebuild would perturb typecheck's dependentTasksOutputFiles
  input mid-window. Correct.

**One inconsistency found -- WARNING, not BLOCKER:** 11-VALIDATION.md's HARD SUSPENSION section
states sampling "resumes at plan 11-04", but both 11-02-PLAN.md and 11-03-PLAN.md state it
"resumes at plan 11-05." Three artifacts, two different resumption points. Why this does not rise
to BLOCKER: 11-04's own two tasks invoke no nx command at all (task 1 is REST-only reads of the
Actions-cache/Releases-shard; task 2 is a checkpoint gate) -- so even if an executor literally
resumed the after-every-task nx test sampling at 11-04, the resulting local-only cache mutation
would not touch the GitHub Actions cache service that 11-04's REST reads observe, and by that
point O1/O2 is already fully captured and committed in 11-EVIDENCE.md (an immutable historical
record). No functional risk to the proof. Recommend reconciling the three artifacts to agree on
one resumption point (11-05, matching the two plans that already agree with each other) for
documentation accuracy.

**Verdict: ordering holds. No BLOCKER.**

---

## Check 2: pre-registered counts -- real, and would genuinely differ under the failure hypothesis

Verified each plan's pre-registered-count table names, in the PLAN TEXT before execution, a count
paired with an explicit "value under the failure hypothesis" (or equivalent):

- **11-03** (Pre-registered counts section): O1 gate is exactly 1 occurrence of the literal
  [remote cache] label per target (build, typecheck, test), explicit 0 under the failure
  hypothesis (mirror read dead) for each. O2 gate: integration exactly 1, 0 under failure.
  Structured corroborator: run.json cacheStatus === remote-cache-hit set expected to be exactly
  {build, typecheck, test, integration} (4 members), "every one reads cache-miss" under failure.
  These differ genuinely: a dead mirror read produces 0 occurrences and cache-miss status, not
  merely a smaller number.
- **11-05** (RED counts): task 1 expects exactly 7 new failing tests, task 2 expects exactly 17
  (7 plus 10). Not padding -- this is the literal count of it() cases authored (7 in task 1's
  describe block, 10 phrase assertions across task 2's 5 additive rows at 2 phrases each), so a
  wrong count is diagnostic: fewer failures than expected means a phrase matched pre-existing
  text, and the plan says so explicitly ("A lower number means a phrase matched pre-existing text
  and the row must be re-chosen").
- **11-06** (GREEN counts): task 1 expects exactly 15 remaining failures (17 minus row D's 2
  phrases), task 2 expects exactly 0. Same diagnostic property -- any count other than 15 after
  task 1 signals a partial or wrong land.
- **11-07** (Pre-registered counts section): the o3-witness delta must be at least 30 seconds,
  with explicit "negative, or the entry is ABSENT" as the failure value; both positive controls
  expect HTTP 200 with "404 or a transport failure" as the failure value; the Windows label
  occurrence count expects 0 -- correctly inverted, since this is an absence proof, a NON-ZERO
  count is the failure signal ("a non-zero count would... falsify XOS-03 outright"); the Windows
  cacheStatus expects the literal cache-miss with remote-cache-hit as the failure value; the
  run-level non-vacuity row (ubuntu build label count at least 1) states its fallback posture
  explicitly if it reads 0, rather than silently re-running to get a better number.

All four plans' counts are genuinely falsifiable measurements, not restated green claims. **No
BLOCKER.** D-23/TEST-08's requirement is satisfied.

---

## Check 3: Cache: n/m hit marked non-discriminating in both directions

Confirmed present and correctly bidirectional (D-24) everywhere the line is captured: 11-03 task 2
notes it beside the line, 11-03 task 3 acceptance criteria require it on every occurrence, 11-07
tasks 2 and 3 do the same. The stated grounds match RESEARCH.md exactly (a 0 percent line prints
identically with no sidecar at all; a non-zero count includes local hits). No BLOCKER.

---

## Check 4: H_linux != H_win and 09-EVIDENCE.md snapshot cited, not re-derived

11-07 task 3: "CITED from CORR-03(b)'s build-gating record... Phase 11 cites it and does not
re-derive it," plus PROBE-RESULTS.md Q3 as a corroborating prior, also cited. 11-04 task 1:
"09-EVIDENCE.md's snapshot is cited by section name with its capture time, and its contents are
NOT re-enumerated." Both citation clauses are mechanically checked: 11-04's automated verify greps
for the literal strings 09-EVIDENCE.md and Producer-attribution snapshot; 11-07's automated verify
greps for CORR-03(b) and PROBE-RESULTS.md. No BLOCKER.

---

## Check 5: the two easy-to-get-wrong research findings

- **The key prefix-match trap:** 11-06 task 2 specifies a jq filter selecting on exact key
  equality with a first(...) // empty terminator (never total_count), matching RESEARCH.md's
  Pattern 2 exactly, including the vacuity-trap guard (a bare null would otherwise pass an
  emptiness test).
- **Positive control acceptance set is 200 alone, distinct from the readiness poll's 404-or-200:**
  11-06 task 1 states explicitly: "the acceptance set is 200 ALONE. Do not reuse the readiness
  poll's deadbeef hash and do not collapse the two probes." Also correctly encoded in 11-03 task
  1's soundness-probe control table (a 401/401/404 triple, distinct from the 200-only production
  control). No BLOCKER.

---

## Check 6: scope fence -- nothing crosses into O4

Confirmed clean across all 7 plans: no XOS-04/05/08 work, no Windows build/typecheck/test legs
added, no write-decision code, no dedicated-Windows-job fallback for U-01 (RESEARCH.md explicitly
says not to build it; none of the plans do). 11-06 explicitly scopes itself to "Edit the
integration job only" and asserts no file under packages/ was touched. The O4 section in
11-EVIDENCE.md stays RESERVED (never populated) across 11-03/11-04/11-07. No BLOCKER.

---

## Check 7: must_haves quality

Goal-backward and observable throughout; artifacts and key_links map cleanly to truths in all 7
plans (verified end to end: capture-hashes.mjs mode -> JSON record -> EVIDENCE.md; and
read-integration-hash.mjs -> run.json -> integration-hash.txt -> CI artifact upload -> o3-witness
download -- no orphaned artifact found).

**WARNING (schema quality, not functional):** several must_haves.truths entries embed a must-NOT
clause rather than using a dedicated prohibitions block (none of the 7 plans' frontmatter has a
prohibitions key at all):
- 11-04: the mirrored-by retraction clause ("No claim that... appears anywhere").
- 11-06 (three instances): the never-GATED clause on the label absence; the never-a-prefix-count
  clause on the key check; the not-merely-deleted clause on the stale-comment correction.
- 11-07: the never-re-derived clause on the H_linux/H_win citation.

In every one of these cases the actual constraint IS mechanically enforced elsewhere via
acceptance criteria and/or automated verify (for example, 11-06 task 1's acceptance criteria
literally check that no step carries an if expression mentioning matrix.os). Documentation
structure nit, not a coverage gap. Not blocking.

---

## Additional dimensions checked

- **Requirement Coverage:** all 7 requirement IDs (XOS-01, XOS-02, XOS-03, TEST-08, TEST-09,
  TEST-10, OBS-02) appear in at least one plan's requirements frontmatter, correctly spelled with
  no trailing-period OBS-02 trap (CONTEXT.md D-00). Cross-checked against REQUIREMENTS.md's own
  words rather than ROADMAP's paraphrase (D-01). No gap.
- **Task Completeness:** all auto/tdd tasks have files/action/verify/done; all
  checkpoint:decision tasks have decision/context/options/resume-signal. One minor
  inconsistency: 11-07 task 2 is typed auto but its verify is human-check rather than automated --
  this matches VALIDATION.md's own manual-only classification for exactly this task (a force-push
  plus a live CI run plus a restore cannot be self-verified by a script) and is explicitly
  justified by the phase's proof-led nature. WARNING that the task-type label does not reflect
  this, but not blocking.
- **Dependency Correctness:** clean linear chain, waves match depends_on, no cycles, no missing
  references.
- **Key Links:** all artifacts wired; no isolated creations found.
- **Scope Sanity:** every plan has 2-3 tasks and touches 1-3 files, well within budget.
- **Context Compliance:** all 24 CONTEXT.md decisions (D-00 through D-24) plus U-01 map to at
  least one implementing plan (cross-checked against 11-01-PLAN.md's own Multi-Source Coverage
  Audit table, then independently re-verified against the raw CONTEXT.md text). No deferred item
  (O4, DOCS-07, the PARITY-04 closure, the dedicated-Windows-job fallback) appears anywhere in the
  7 plans. No contradiction of a locked decision found.
- **Scope Reduction Detection:** scanned for v1/v2/simplified/static-for-now/hardcoded/
  future-enhancement/placeholder/stub/not-wired-to language. The one substantive deviation found
  (11-06 makes the runner.debug recorder echo-only instead of RESEARCH.md's recommended fatal
  exit) is fully reasoned in the plan text with three explicit justifications, is scoped to
  CONTEXT.md's own Claude's Discretion area (RESEARCH.md itself flags this exact choice as
  discretionary), and does not reduce delivery of any locked decision -- D-21's actual requirement
  (the repository variable toggled on and off with recorded timestamps) is delivered unabridged in
  11-07. Not a scope reduction.
- **Architectural Tier Compliance:** RESEARCH.md's Architectural Responsibility Map is present;
  all task assignments match it (local workstation tier for O1/O2, ubuntu-witness tier for O3
  existence, Windows-in-job tier for O3 positive control, local dev tooling for the graph
  premise). No mismatch.
- **Nyquist Compliance:** VALIDATION.md exists (gate passes). Manual-only rows are pre-justified
  in VALIDATION.md's own Per-Task Verification Map and Manual-Only Verifications table, per this
  phase's explicit dispensation against demanding a unit test for an observation that cannot have
  one. No watch-mode flags, no full-E2E-suite-as-unit-test pattern, no swallowed-error anti-
  pattern in any automated block (checked specifically for the "2>/dev/null || echo" and
  "pnpm ls | grep" style anti-patterns -- none found; the "|| true" uses in 11-05/11-06's RED-phase
  automated blocks are legitimate, since pass/fail is actually determined by a subsequent node -e
  parse of the tee'd log against an exact pre-registered count, not a silently swallowed default).
- **Cross-Plan Data Contracts:** no conflicting transforms on shared data found (run.json field
  names and guards are consistent between 11-01's reader, 11-03's inline reads, and 11-06's CI
  usage of the same reader).
- **CLAUDE.md Compliance:** WARNING -- 11-02 and 11-03 use npx nx reset / npx nx run-many for the
  core measurement commands, while 11-05 and 11-06 correctly use npm exec nx test/typecheck/lint/
  format:check per CLAUDE.md's stated preference. Functionally equivalent (npx also resolves the
  local install, avoiding the global CLI the rule exists to avoid), so not blocking, but
  inconsistent with the documented house style. Everything else -- Write-tool-not-heredoc,
  ASCII-only, rg not grep/git grep for untracked paths, the public-repo committer-identity check
  in 11-07 task 1 -- is followed correctly.
- **Research Resolution:** WARNING -- RESEARCH.md's Open Questions heading lacks the (RESOLVED)
  suffix convention, even though the section's own content states "None blocking" and each of the
  three listed items has an explicit disposition (specified as pre-flight instructions to the
  plan, not left open), and U-01 (the actual CONTEXT.md-flagged unresolved item) has its own
  dedicated VERDICT section resolved with measurement. Recommend renaming the heading for
  convention compliance; substantively nothing is left unresolved that blocks planning.
- **Pattern Compliance:** PATTERNS.md exists; every file in its File Classification table has a
  corresponding plan task whose read_first cites the matching PATTERNS.md section. No gap.
- **Verify Command Format Sanity / Numeric Claim Authority:** no anchor-on-tree-output trap, no
  swallowed-error-into-comparison pattern, no unexplained hard-coded count. No conflict found
  between any plan's numeric claim and RESEARCH.md's (both dated the same day, and RESEARCH.md's
  measurements are cited rather than restated with different values anywhere).

---

## Summary

**Blockers: 0. Warnings: 5** -- the sampling-resumption artifact drift between 11-VALIDATION.md
and plans 11-02/11-03; the must-NOT-in-truths schema nit across 4 plans; the npx-nx versus
npm-exec-nx style inconsistency in 11-02/11-03; RESEARCH.md's Open Questions heading missing the
RESOLVED suffix; and 11-07 task 2's auto type paired with a human-check verify. None of the five
threatens the phase goal, the perishable measurement window, or the O1/O2/O3 proof chain -- each
has independent mechanical enforcement or an explicit, reasoned justification elsewhere in the
phase's own artifacts.

Plans verified. Recommend proceeding to execute-phase 11, with the five warnings optionally
reconciled first (cheapest fix: align 11-VALIDATION.md's resumption-point line with the two plans
that already agree with each other, at 11-05).
