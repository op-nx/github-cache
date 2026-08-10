---
phase: 13-read-only-actions-cache-backend
plan: 01
subsystem: planning
tags: [traceability, requirements, threat-model, roadmap, gsd]

# Dependency graph
requires:
  - phase: 12-windows-ci-reuse-o4-consumer-recipe
    provides: the three windows-11-arm reuse legs and their ungated `[remote cache]` counts, which are what CR-18 found RECORDED but never GATED
provides:
  - Seven Phase 13 requirement bodies in REQUIREMENTS.md (VER-08, VER-09, TRUST-14, XOS-09, TEST-11, DOCS-09, DOCS-10), unchecked, each citing the CONTEXT.md decision that settled it
  - Fourteen traceability rows (seven per file) and reconciled coverage tallies in both REQUIREMENTS.md (57) and ROADMAP.md (51)
  - The Case-B base-scope-READ live-CI item, with its A2 verification step, its procedure and its push-only fallback
  - One THREAT-MODEL.md Residual-notes bullet recording the CACHE_READ_ONLY ratchet and the deliberate no-control-row decision
affects: [13-02, 13-03, 13-04, 13-05, 13-06, audit-milestone, secure-phase, verify-phase-goal]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Register requirement IDs BEFORE the code that claims them, so no plan can self-close a requirement it only partially satisfies"
    - "Two coverage totals that legitimately differ are reconciled by naming the exact difference set, not by forcing them equal"

key-files:
  created:
    - .planning/phases/13-read-only-actions-cache-backend/13-01-SUMMARY.md
  modified:
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md
    - .planning/THREAT-MODEL.md
    - .planning/STATE.md

key-decisions:
  - "Phase 13's seven IDs are registered Pending, NOT marked complete -- `requirements.mark-complete` was deliberately NOT run, following the recorded Phase 12 lesson where a RED-only plan falsely closed three XOS rows"
  - "No C19 control row for CACHE_READ_ONLY -- the phase strictly reduces capability, so it meets THREAT-MODEL.md's own criterion for a Residual note and not for a control; the no-row decision is written INTO the bullet"
  - "REQUIREMENTS.md (57) and ROADMAP.md (51) assert different totals by design; the six-ID difference is named in both files and verified mechanically"

patterns-established:
  - "Cross-file tally reconciliation: when two authoritative files count different sets, record the expected difference set in both, so a future drift is detectable rather than arguable"
  - "A no-decision (no control row added) is recorded explicitly, because a ledger's silence is indistinguishable from an omission to a later auditor"

requirements-completed: []
# DELIBERATELY EMPTY. This plan REGISTERS VER-08, VER-09, TRUST-14, XOS-09, TEST-11, DOCS-09 and
# DOCS-10; it does not satisfy them. Their bodies are unchecked `- [ ]` and their traceability rows
# read `Pending` in both files by design. They close as their code lands in 13-02..13-06. Listing
# them here would reproduce the exact Phase 12 defect STATE.md records -- a RED-only plan falsely
# closing three XOS rows -- and would break the milestone audit's three-source cross-reference.

coverage:
  - id: D1
    description: "Seven requirement bodies in REQUIREMENTS.md, unchecked, each in its own category section, each citing at least one CONTEXT.md decision ID"
    verification:
      - kind: other
        ref: "node scratchpad/verify-req.mjs -- asserts all seven `- [ ] **ID**` bodies, all seven `| ID | Phase 13 |` rows, the 57/57 tally, and that every body names a D-0N decision"
        status: pass
    human_judgment: false
  - id: D2
    description: "Fourteen traceability rows and reconciled tallies: REQUIREMENTS.md 50 -> 57, ROADMAP.md 44 -> 51, with the six-ID difference named in both"
    verification:
      - kind: other
        ref: "node scratchpad/verify-gap.mjs -- parses both traceability tables, asserts 57 and 51, asserts the gap is exactly PARITY-06/07/08, RETAIN-05, ROBUST-04, VER-07, and asserts no reverse gap"
        status: pass
    human_judgment: false
  - id: D3
    description: "ROADMAP's Phase 13 `**Requirements**:` line survives `init.plan-phase` with all seven IDs on one physical line"
    verification:
      - kind: other
        ref: "gsd-tools query init.plan-phase 13 -- phase_req_ids echoes `VER-08, VER-09, TRUST-14, XOS-09, TEST-11, DOCS-09, DOCS-10.`; re-run AFTER the Live-CI edit"
        status: pass
    human_judgment: false
  - id: D4
    description: "The Case-B live-CI item registered with its A2 verification step, its four-step procedure and its push-only fallback"
    verification: []
    human_judgment: true
    rationale: "Procedural correctness of a live-CI observation cannot be proven by a static check -- whether the described PR actually forces Case B depends on Assumption A2 holding against the live Nx graph, which the procedure itself instructs the operator to verify first"
  - id: D5
    description: "One THREAT-MODEL.md Residual-notes bullet recording the knob's narrowing asymmetry, branch order as the guarantee, and the deliberate no-control-row decision; C1-C18 byte-unchanged"
    verification:
      - kind: other
        ref: "node scratchpad/verify-threat.mjs -- asserts the knob appears only below `## Residual notes`, no `^| C19 ` row exists, the bullet names BRANCH ORDER and the no-row decision, and the ledger still has exactly 18 rows"
        status: pass
    human_judgment: false

# Metrics
duration: 25min
completed: 2026-08-02
status: complete
---

# Phase 13 Plan 01: Register Phase 13 Requirements and Traceability Summary

**Seven Phase 13 requirement IDs registered in both authoritative files before any code claims them, with both coverage tallies reconciled to a named six-ID difference, plus the CACHE_READ_ONLY ratchet recorded as a Residual note with an explicit no-control-row decision**

## Performance

- **Duration:** 25 min
- **Started:** 2026-08-02T00:02:00Z
- **Completed:** 2026-08-02T00:27:14Z
- **Tasks:** 3
- **Files modified:** 3 (plus STATE.md as plan metadata)

## Accomplishments

- **Closed the orphan.** Phase 13 had NO requirement IDs registered: ROADMAP.md's traceability table had no Phase 13 row, REQUIREMENTS.md had neither bodies nor rows, and ROADMAP.md still asserted `44/44 v0.0.2 requirements map to exactly one phase`. Every other plan in this phase cites these seven IDs, so without this plan all seven were orphaned and the milestone audit's three-source cross-reference could not close them.
- **Seven bodies, in the file's own voice.** Each states the claim, then the mechanism, then the silent failure it exists to prevent, and each names the CONTEXT.md decision that settled it -- VER-08 (D-01, plus the record that D-09's shrink-to-a-decision hatch was live and NOT taken), VER-09 (the file-scope -> package-scope widening), TRUST-14 (D-02a/D-02b/D-02c/D-03), XOS-09 (D-04/D-05), TEST-11 (D-07), DOCS-09 (D-06), DOCS-10 (D-02b).
- **Both tallies reconciled, and their difference made falsifiable.** REQUIREMENTS.md 50 -> 57, ROADMAP.md 44 -> 51. Rather than forcing the two to agree, both files now record WHY they differ and name the exact six-ID difference set, so a future drift is detectable instead of arguable.
- **The Case-B live-CI item promoted from a pointer to a procedure.** ROADMAP.md's Live-CI close previously said only "Plan 13-01 registers the full procedure". It now carries the procedure: verify Assumption A2 first via `npx nx show project github-cache --json`, land on main, open a `.planning/`-only PR, observe `count >= 1` while the ubuntu producers HIT and wrote nothing -- plus the push-only fallback and the note that a Case-B MISS is a hard red, not a first-run-only red.
- **A no-decision recorded as a decision.** THREAT-MODEL.md gains one Residual-notes bullet and zero control rows, with the no-row reasoning written INTO the bullet so a security auditor does not read the ledger's silence as an omission.

## Task Commits

Each task was committed atomically:

1. **Task 1: Register the seven requirement bodies and traceability rows in REQUIREMENTS.md** - `34577b8` (docs)
2. **Task 2: Fill the ROADMAP Phase 13 traceability, tallies, and the Case-B live-CI item** - `4b22cee` (docs)
3. **Task 3: Record the knob's narrowing asymmetry in THREAT-MODEL.md, and record that no control row was added** - `7b45c38` (docs)

## Files Created/Modified

- `.planning/REQUIREMENTS.md` - Seven unchecked requirement bodies across five category sections; seven traceability rows; coverage 50 -> 57 with `Phase 13 = 7`; a dated amendment note recording the addition and the 57-vs-51 relationship.
- `.planning/ROADMAP.md` - Seven traceability rows; coverage assertion 44/44 -> 51/51; per-phase counts gain `Phase 13: 7`; both tally lines reconciled (VER 6->8, XOS 8->9, TRUST 4->5, DOCS 2->4, TEST 3->4); two dated notes; the Live-CI close expanded into the full Case-B procedure.
- `.planning/THREAT-MODEL.md` - One Residual-notes bullet. 26 insertions, 0 deletions; the C1-C18 ledger is byte-unchanged.
- `.planning/STATE.md` - Position advanced to plan 2 of 6, three decisions recorded, session recorded; handler-introduced corruption repaired (see Deviations).

## Decisions Made

- **The seven IDs are registered Pending, not marked complete.** `requirements.mark-complete` was deliberately NOT run, and `requirements-completed` in this SUMMARY's frontmatter is deliberately empty. This plan registers traceability; the code that satisfies the IDs lands in 13-02..13-06. STATE.md records the precedent directly: on 12-01, a RED-only plan falsely closed all three XOS rows, after which every Phase 12 plan skipped the handler and the requirements were closed once at the phase step. Same discipline applied here.
- **No C19 control row.** The phase strictly REDUCES capability, opens no attack surface and introduces no new trust boundary, so THREAT-MODEL.md's own criterion ("keep only what has no canonical home") is met by a note and not by a control. The decision is recorded inside the bullet rather than left implicit.
- **The two coverage totals are allowed to differ.** REQUIREMENTS.md counts the full DEFINED set (57); ROADMAP.md counts the ROADMAPPED subset (51). Forcing them equal would require either inventing roadmap rows for six IDs that legitimately have none, or deleting definitions. Instead both files name the difference set, and a script verifies it.
- **The ROADMAP `**Requirements**:` line was verified, not re-authored.** The planner had already filled it; re-writing it risked a line wrap, which `init.plan-phase` silently truncates at. It was re-checked after the Live-CI edit landed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Repaired GSD handler corruption in STATE.md**
- **Found during:** Task 2 (after probing `init.plan-phase 13` to verify the requirements line)
- **Issue:** The GSD init/state handlers rewrote STATE.md's Current Position block during this session and left it malformed in three ways: (a) three em dashes (U+2014) where this project is ASCII-only -- Windows cp1252 renders them as mojibake; (b) a dangling orphan line, `learnings extracted and pooled`, left behind when the handler replaced only the first two lines of Phase 12's multi-line `Status:` sentence; (c) `Progress: 6/6 phases complete [######] 100%` and a `Milestone v0.0.2 is ready for /gsd:audit-milestone` paragraph, both of which now contradict an executing seventh phase.
- **Fix:** Replaced the em dashes with `--`, deleted the orphan line, corrected the progress line to `6/7 phases complete [########--] 86%`, and reframed the audit-milestone paragraph to state that the milestone gained a seventh phase. Also corrected `state.add-decision`'s malformed `[Phase ?]` marker on the entries this plan added (the handler defaults to `?` unless `--phase` is passed).
- **Files modified:** `.planning/STATE.md`
- **Verification:** A diff-scoped ASCII scan over every added line across STATE.md, THREAT-MODEL.md and config.json returns clean.
- **Committed in:** the plan metadata commit

**2. [Rule 3 - Blocking] Rewrote the plan's inline `node -e` verifiers as script files**
- **Found during:** Task 1 (running the plan's `<verify><automated>` command)
- **Issue:** The plan's verification commands are `node -e "..."` one-liners with four-deep backslash escaping. Git Bash strips the outer double quotes and mangles the regex escapes before Node sees them, producing `SyntaxError: Invalid regular expression: /^- [ ] **VER-08**/m: Nothing to repeat` -- a tooling failure that is easy to misread as a real verification failure.
- **Fix:** Wrote the same assertions as `.mjs` files in the session scratchpad and ran them by path. This is the documented project-level mitigation for inline `-e` scripts on this shell.
- **Files modified:** none in the repo (scratchpad only)
- **Verification:** All three verifiers plus a fourth cross-file gap verifier pass.
- **Committed in:** n/a (no repo files changed)

### Strengthened beyond the plan

**3. [Rule 2 - Missing Critical] Added a mechanical check for the cross-file six-ID invariant**
- **Found during:** Overall verification
- **Issue:** The plan states the REQUIREMENTS-vs-ROADMAP difference must be exactly six named IDs, but its own `<verify>` blocks check each file in isolation -- nothing would catch the two tables drifting apart, which is the specific failure the invariant exists to detect.
- **Fix:** Wrote a verifier that parses both traceability tables, asserts 57 and 51, asserts the difference set equals the six named IDs, and asserts there is no reverse gap (an ID roadmapped but undefined). Recorded as coverage entry D2.
- **Verification:** Passes -- `REQUIREMENTS traced: 57 / ROADMAP traced: 51 / gap: PARITY-06, PARITY-07, PARITY-08, RETAIN-05, ROBUST-04, VER-07`.

---

**Total deviations:** 3 (1 bug fix, 1 blocking tooling workaround, 1 missing critical check)
**Impact on plan:** No scope creep. Two are repairs to tooling/handler output rather than to plan content; the third adds the check the plan's own verification section describes in prose but does not automate.

## Issues Encountered

- **`state.record-metric` and `state.add-decision` reject positional arguments.** Both require named flags (`--phase`, `--plan`, `--duration`, `--summary`); called positionally as the executor spec describes, they fail with a bare `... required` error and the metric silently never records. Both were invoked with named flags and succeeded.
- **`state.update-progress` reports a Unicode block-character progress bar** (`[########..] 76%` with U+2588/U+2591). It did not write that bar to disk -- STATE.md's textual progress line is separate -- so no mojibake landed, but the JSON output should not be copied into any file on this platform.
- **`init.*` probes mutate tracked files.** Probing `init.execute-phase` / `init.plan-phase` flipped `config.json`'s `_auto_chain_active` and rewrote STATE.md's frontmatter and Current Position block. Those flag/pointer changes are legitimate execute-phase bookkeeping and were left in place; only the malformed output was repaired.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **13-02 through 13-06 are unblocked.** All seven IDs now resolve in both traceability files, and `init.plan-phase 13` returns them, so every downstream GSD gate that reads `phase_req_ids` sees the full set.
- **The seven IDs remain open by design.** They must be closed as their implementing plans land -- 13-02 (VER-08, VER-09), 13-03 (TRUST-14), 13-04 (DOCS-10), 13-05 (XOS-09, TEST-11, DOCS-09), 13-06 (XOS-09, TEST-11). Do not close them at 13-01.
- **One item is deferred by construction, not by omission.** The Case-B base-scope READ observation cannot be made by this phase's own landing commit, which rotates all three task hashes. It is registered in ROADMAP.md's Live-CI close with its full procedure and must be executed as a separate PR after Phase 13 lands on `main`.
- **No blockers.** This plan touched only `.planning/**`, which is in no Nx target's declared input set, so no task hash rotated and no build or test run was required.

## Self-Check: PASSED

Every claim above was verified against disk and git after the final commit.

**Files claimed, files found:** `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`,
`.planning/THREAT-MODEL.md`, `.planning/phases/13-read-only-actions-cache-backend/13-01-SUMMARY.md`
-- all present.

**Commits claimed, commits found:** `34577b8`, `4b22cee`, `7b45c38`, `decf56d` -- all present in
`git log --all`.

**Assertions re-run after the final commit:**

| Check | Result |
|---|---|
| Seven `- [ ] **ID**` bodies + seven `\| ID \| Phase 13 \|` rows + 57/57 tally + every body cites a `D-0N` decision | PASS |
| ROADMAP: seven rows, 51/51 assertion, both tally lines `= 51`, Live-CI block naming the hash rotation | PASS |
| THREAT-MODEL: knob only below `## Residual notes`, no `^\| C19 ` row, ledger still exactly 18 rows, bullet names BRANCH ORDER and the no-row decision | PASS |
| Cross-file gap: REQUIREMENTS 57, ROADMAP 51, difference exactly the six named IDs, no reverse gap | PASS |
| `init.plan-phase 13` echoes all seven IDs on one physical line | PASS |
| Every line added by this plan is ASCII-only | PASS |

**One assertion was corrected, not waived.** An initial whole-file ASCII scan of THREAT-MODEL.md
failed on pre-existing `->`-style arrows in the C1 control row. The scan was re-scoped to the lines
this plan added, which is the actual claim; the pre-existing characters are outside this plan's
scope boundary and the diff is 26 insertions with 0 deletions, so the ledger is byte-unchanged.

---
*Phase: 13-read-only-actions-cache-backend*
*Completed: 2026-08-02*
