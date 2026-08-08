# Revision 3, final piece: every aggregate in the lpt plan, re-derived

Scope: prose numbers only. No gate was added, removed, or restructured. Only
`260808-lpt-PLAN.md` was modified (1152 -> 1179 lines). Nothing committed, nothing staged.

Baseline: HEAD `ff21356`, working tree clean at start. `git diff --stat c84ebd5..HEAD` over
`.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md`,
`.planning/v0.0.2-MILESTONE-AUDIT.md` and `.planning/phases/` is EMPTY, so every claim annotated
"MEASURED at `c84ebd5`" about those files is measurable at HEAD without a checkout.

## First: the handoff's two named residue items

Both descriptions were stale, as you suspected. Independently confirmed:

| Handoff claim | Measured | Verdict |
|---|---|---|
| `:649` G5 count reads "nine", should be TEN | `rg -N '^p "\$R"'` inside the G5 block returns 9 lines, gate IDs `G5a..G5i`; prose reads `NINE gates` | ALREADY CORRECT |
| `:660` G6 count reads "nine", should be TEN | `rg -N '^a "\$R"'` returns 10 lines, gate IDs `G6a..G6j`; prose reads `TEN gates` | ALREADY CORRECT |
| `four in REQUIREMENTS` survives somewhere | `rg -n -i 'four in REQUIREMENTS'` -> exit 1; positive control `rg -c -F 'in REQUIREMENTS.md'` -> exit 0 with hits. `:486` reads `THREE in REQUIREMENTS.md` and the plan's REQUIREMENTS rewrite table has exactly 3 rows (`:789`, `:790`, `:791`) | ALREADY CORRECT |

The residue does NOT survive anywhere else. Both edits were applied before the pause; the handoff
was written from the pre-edit intent, not from the post-edit file.

## The `:639` "site" unit -- settled

**Decision: a SITE is one stale literal at one line.** Count: **THIRTEEN literals across ELEVEN
lines.**

Why that unit and not "line":

- It is the unit the gates are actually written in. ROADMAP `:815` carries two stale literals (the
  total sum and the PARITY category count) and `:831` carries two (the ID list and the
  subtraction), which is exactly why EIGHT ROADMAP lines produce TEN absence gates (`G6a..G6j`).
  A "line" unit cannot explain the gate count; a "literal" unit explains it exactly.
- It matches the plan's own measured statement at `:486`, which was already right:
  "ELEVEN live lines -- EIGHT in ROADMAP.md and THREE in REQUIREMENTS.md -- carrying THIRTEEN stale
  literals". The header at `:639` was the only place using a third, unsourced unit.

Arithmetic, measured:

```
ROADMAP lines      8   (:800 :808 :815 :816 :828 :830 :831 :832)
REQUIREMENTS lines 3   (:789 :790 :791)
                  --
lines             11

ROADMAP absence gates      G6a..G6j   10   (:815 and :831 each carry two literals)
REQUIREMENTS absence gates G7c..G7e    3
                                      --
literals                              13   -- one absence gate per literal

ROADMAP presence gates      G5a..G5i    9
REQUIREMENTS presence gates G7a, G7b    2
                                       --
paired                                 11  of 13
```

Where "twelve" came from: neither 11 nor 13. It is reachable only by mixing units -- counting G5's
NINE ROADMAP gate-sites plus G7's THREE REQUIREMENTS lines. That mix is what made the header
unfalsifiable, so it is gone.

The two unpaired literals are the ID-list rewrites at ROADMAP `:831` and REQUIREMENTS `:790`. They
have no positive-form presence gate by design; their post-edit form is carried by the survival gates
`G7f` / `G7g`. The rewritten `:639` block now states all of this explicitly, so "PAIRED per site" no
longer overclaims.

## Every aggregate re-derived

`P` = the plan file. Line numbers are pre-edit. All searches had their exit code checked and a
positive control run on the same path.

### CHANGED (10 edits across 8 sites)

| Line | Claim as written | Measured truth | Command | Verdict |
|---|---|---|---|---|
| :639 | "the twelve invariant-prose sites, PAIRED per site" | 13 literals across 11 lines; 11 of 13 paired | `rg -N '^(p\|a) "\$[RQ]"' P` -> 32 lines, split 13/6/10/3 | CHANGED |
| :643 | "the earlier draft gated only three of the twelve" | unit wrong; "three" UNMEASURABLE (see below) | same | CHANGED (unit only) |
| :173 | per-ID evidence section "listed FIRST of eight in `<output>`" | `<output>` lists NINE bullets | `awk '/^<output>/,/^<\/output>/' P \| rg -c '^- '` -> 9 | CHANGED |
| :385 | same claim, repeated in the T1 G8 gate comment | NINE | same | CHANGED |
| :316 | "one of the four sites above" | SIX named sites: `10-VERIFICATION.md` :55 :107 :116 :137 and `11-EVIDENCE.md` :1004 :1006 | `git grep -n -F -e 'CORR-05' -- 10-VERIFICATION.md` -> 55 62 116 137; `-e 'RETAIN-05'` -> 107 137; `rg -n '^## O4 \(XOS-04, XOS-05\)' 11-EVIDENCE.md` -> 1004; `rg -n 'DISCHARGED by plan 12-06'` -> 1006 | CHANGED |
| :592 | "**102 unticked boxes across 20 files**" (unanchored, reads as current) | 102/20 at `c84ebd5`; **109 across 22 files** at `ff21356` | the plan's own `git grep -c -F -e '- [ ]' -- .planning ':!...'` verbatim -> 22 files summing 109 | CHANGED (anchored + HEAD delta recorded) |
| :919 | "(twenty, against a measured 93)" | 93 is the `c84ebd5` figure; 100 at `ff21356` | 109 - 9 REQUIREMENTS bullets = 100 | CHANGED (anchor added) |
| :901 | "backfilling 30 REQ-IDs across Phases 7-9" | ROADMAP Phases 7-9 = **22** rows; REQUIREMENTS Phases 7-9 = **27**. 30 matches neither | `git grep -c -E '^\| [A-Z]+-[0-9]+ \| Phase [789] \|' -- ROADMAP.md` -> 22; same on REQUIREMENTS.md -> 27 | CHANGED (attributed to the audit, not re-asserted) |
| :1064 | audit block "with all six components" | the action's numbered list has **SEVEN** | `awk '/^The block records:/,/^  <\/action>/' P \| rg -c '^[0-9]+\. '` -> 7 | CHANGED |
| :33 / :851 | "its unresolvable `research/STACK.md` citation" (singular) | the row carries **TWO**: `:16-40` in the description, `:75,77` in the OPEN clause | `sed -n '445p' STATE.md \| rg -o 'research/STACK\.md' \| rg -c ''` -> 2 | CHANGED (scoped; see finding F3) |

The `:901` correction also records a second-order fact: Task 2's own edit moves the roadmapped
Phase 7-9 figure 22 -> 24 (Phase 8 goes 7 -> 9), so any re-derived number written into the sealed
audit would be stale on arrival. Quoting the audit's figure is the only stable option.

### UNCHANGED -- measured and correct

| Line | Claim | Measured | Command |
|---|---|---|---|
| :26, :86, :263, :273, :421, :1114 | nine Phase 8 IDs | 9 | `git grep -n -E '^- \[ \] \*\*' -- REQUIREMENTS.md` -> 9 rows at 75 84 201 214 222 228 235 238 245 |
| :266-267 | the nine line numbers, verbatim | exact match, all nine | same |
| :268, :348 | "exactly 9 unticked and 48 ticked bullets", sum 57 | 9 / 48 / 57 | `git grep -c -F -e '- [ ] **'` -> 9; `-e '- [x] **'` -> 48 |
| :27, :282, :368, :428 | 57 traceability rows | 57 | `git grep -c -E '^\| [A-Z]+-[0-9]+ \| Phase '` -> 57 |
| :280 | "exactly 12 cells", at lines 719-727 + 741 + 742 + 754 | 12, at exactly those lines | `git grep -n -E '... \| Pending'` -> 719 720 721 722 723 724 725 726 727 741 742 754 |
| :282 | "45 already reconciled" | 45 | `git grep -c -E '... \| Complete'` -> 45 |
| :354 | G4 covers "all twelve reconciled cells" | 12 row literals in the `for r in` list | `rg -o '"[A-Z]+-[0-9]+ \| Phase [0-9]+"' P \| sort \| uniq -c` -> 12 distinct |
| :253 | 08-VERIFICATION Requirements Coverage rows at `:188-196` | exactly 188..196 | `git grep -n -E '^\| (CORR-0[34]\|PARITY-0[1-7]) ' -- 08-VERIFICATION.md` |
| :454 | "ROADMAP has 7 Phase 8 rows; REQUIREMENTS assigns 9" | 7 / 9 | `git grep -c -E '... \| Phase 8 \|'` on each |
| :636 | "MEASURED 51 at c84ebd5" (ROADMAP total rows) | 51 | `git grep -c -E '^\| [A-Z]+-[0-9]+ \| Phase ' -- ROADMAP.md` |
| :468 | "the four shifted rows" | 5 table rows, 1 correct (PARITY-01), 4 shifted | plan shift table, `rg '^\| PARITY'` -> 5 |
| :486 | "ELEVEN live lines -- EIGHT in ROADMAP, THREE in REQUIREMENTS -- THIRTEEN literals" | 8 + 3 = 11 lines; 10 + 3 = 13 literals | rewrite tables: 8 rows / 3 rows; G6 = 10, G7c-e = 3 |
| :524, :692 | "FOUR historical sites" | 4 bullets; 4 gates G13a..G13d | `rg '^- '` in the block -> 4 |
| :533 | `7+9+8+11+7+4+7 = 53`; `5+6+7+8+9+1+5+4+4+4 = 53`; `57-53 = 4` | all three hold | arithmetic |
| :538 | ":94 is the only unticked entry in the v0.0.2 phase list" | only `- [ ] **Phase 12:` | `git grep -n -E '^- \[[x ]\] \*\*Phase [0-9]+:'` -> 14 rows, one unticked |
| :540 | "the six sibling entries" | Phases 7-13 = 7 entries, minus Phase 12 = 6 | same |
| :546 | "22 hits, positive control 60 ticked" | 22 / 60 | `git grep -c -F -e '- [ ]' -- ROADMAP.md` -> 22; `-e '- [x]'` -> 60 |
| :552-554 | Phase 10 rows 435-441 + `10-01` at 434 (EIGHT); Phase 11 508-514 (seven); Phase 13 639-644 (six) | exact, all three ranges | `git grep -n -E '^ *- \[[x ]\] \`1[013]-[0-9]+-PLAN\.md\`' -- ROADMAP.md` |
| :556, :741 | "Tick all twenty" / "the twenty plan rows" | 7 + 7 + 6 = 20 | same |
| :556 | "Three measured corrections" | 3 numbered | `rg '^[0-9]\. '` in the block |
| :560, :906 | "fourteen more boxes" (Phases 10 + 11) | 7 + 7 = 14 | same |
| :573, :728 | "22 - 1 - 7 - 7 - 6 = 1" | holds; the survivor is `:26` | `sed -n '26p'` -> `- [ ] **v0.0.2 OS-invariant cross-OS sharing**` |
| :753, :1120 | "twenty-one v0.0.2 plan entries" | 8 + 7 + 6 = 21 | same |
| :594-596 | per class: research/ 35 in 3; phase RESEARCH 30 in 5; PROJECT.md 7 in 1; THREE in 12-01-SUMMARY | ALL EXACT, unchanged at `ff21356` | per-class sums of the census output |
| :50, :892, :1100, :1141 | "the eight audit items" | 8 `- phase:` entries in `tech_debt` | `awk '/^tech_debt:/,/^open_by_design:/' AUDIT \| rg '^  - '` -> 8 |
| :57 | "five reconciled artifacts and three commits" | 5 in `files_modified`; 3 tasks, 3 commit lines | frontmatter + `<done>` blocks |
| :129 | "these three questions" | 3 bullets | `sed -n '132,134p'` |
| :156 | "six of the presence gates were vacuous" | all 6 literals PRESENT at HEAD | `git grep -c -F` per literal: 11-EVIDENCE.md 1, 260803-mew 3, 12-VALIDATION.md 1 in 12-VERIFICATION.md; requirements_completed 2, Phase 10 2, Phase 11 4 in the audit |
| :166 | "UNANCHORED matched three lines (11, 56, 343) ... swept in 376 lines ... anchored returns 343 alone, a 44-line region" | EXACT on all four numbers | `rg -n -e '## Human Verification Closed'` -> 11 56 343; file is 386 lines, 386-11+1 = 376; 386-343+1 = 44 |
| :171 | "the two Task 3 region gates" | 2 (G1, G7) | `rg -n "awk 'NR==1"` -> 3 uses: 394 (T1 G8), 959 (T3 G1), 1015 (T3 G7) |
| :178 | "middle section: cuts 300 lines to 35"; "last section: 44 unbounded, 44 bounded" | EXACT. `## Goal Achievement` at :87 -> 300/35; `## Human Verification Closed` at :343 -> 44/44 | per-heading unbounded/bounded sweep over 08-VERIFICATION.md |
| :180 | "all three region gates in this plan use it" | 3 | `rg -n "awk 'NR==1"` -> 394, 959, 1015 |
| :195 | "One allowlisted literal" | 1 | `rg -n 'planner-discipline-allow'` -> line 200 only |
| :326 | "G1 through G7 had their literals measured" (G8 excepted) | T1 has G1..G8; G8 targets the not-yet-written SUMMARY | structural |
| :649 | "G5 ROADMAP.md presence, NINE gates" | 9 (`G5a..G5i`) | see above |
| :660 | "G6 ROADMAP.md absence, TEN gates" | 10 (`G6a..G6j`) | see above |
| :706 | "G9: SIX per-plan presence gates" | 6 (`for n in 01..06`) | plan text; corroborated by 6 rows at ROADMAP 639-644 |
| :712 | "Phase 10 asserts EIGHT rows ... Phase 11 asserts seven" | 8 / 7 | `for n in 01..08` and `01..07` |
| :732 | "G12 scope: exactly two files" | ROADMAP + REQUIREMENTS | plan text |
| :786 | "score (nine of thirteen) and behavior_unverified (four)" | `score: 9/13`, `behavior_unverified: 4`; truth table has 13 rows, 9 VERIFIED, 2 PRESENT_BEHAVIOR_UNVERIFIED, 2 UNCERTAIN | `git grep -n -E '^(status\|score\|behavior_unverified):' -- 12-VERIFICATION.md`; `rg -n '^\| '` -> rows 1..13 at :43-55 |
| :796 | "Three parts" | 3 numbered | `rg '^[0-9]\. '` in the block |
| :804, :826 | "The four items" / "If any of the four" | 4 (`- Item 1..4` at :806 :809 :812 :814), mapping 1:1 to truth rows 5, 11, 12, 13 | `rg -n '^   - Item [0-9]'` |
| :832-833 | "claims two things"; "four removed sentences" | 2 clauses; THREAT-MODEL's own text says "Four reasoning sentences were deleted" | `## Residual notes` region read |
| :834 | "two `human_verification` items" | 2; corroborated by the file's own "Two loose ends" at :185 | pjz-VERIFICATION.md frontmatter |
| :846 | "the eight the row claims were retained" | the row does claim "8 residue rows retained" -- faithful restatement (see finding F2) | `sed -n '445p' STATE.md` |
| :847 | "the four sentences ... four distinctive tokens" | 4 tokens listed, 4 sentences claimed | plan text vs THREAT-MODEL `### Accepted as spent` |
| :881 | "it already carries three such blocks from 260804-h3b" | 3 in-body supersede blocks at :192, :244, :266 (the 4th hit, :37, is frontmatter, not a block) | `git grep -n -F -e '260804-h3b' -- AUDIT` -> 37 192 244 266 |
| :886 | "region-scopes all ten component checks" | 10 (11 `gate7` calls minus `G7b`, which checks task identity, not a component) | `rg -c '^gate7 ' P` -> 11 |
| :887 | "three of them ... already appear elsewhere" | all 3 present at HEAD | see :156 row |
| :904 | "in three measured parts" | 3 | plan text |
| :909 | "catches 6 of 20 instances" | defensible: the audit's item names the range `ROADMAP.md:639-644`, which spans exactly 6 plan rows, while calling them "five". 6/20 = 30 percent | `git grep -n` on the Phase 13 block -> 639..644 = 6 rows |
| :922 | "'11 items across 7 areas' vs '13 items across 8 areas'" | both literals present, at audit :241 and :248 | `git grep -n -E '(11 items across 7 areas\|13 items across 8 areas)'` |
| :992 | "exactly one row in STATE.md holds the review-pending value" | 1 | `git grep -c -F -e '\| Needs Review \|' -- STATE.md` -> 1 |
| :998 | "all SEVEN numbered components ... ELEVEN region-scoped gates" | 7 components; 11 `gate7` calls | see :886 and :1064 rows |
| :1045 | "all three honest outcomes" | 3 enumerated | plan text |
| :1081 | "freezes these five artifacts" | 5 in `files_modified` | frontmatter |
| :1098, :1104, :1106 | "three commits" / "three subjects" / "All three pass" | 3 | task count |

`:886` (ten) and `:998` (eleven) look contradictory but are consistent and both correct under one
reading: **eleven region-scoped `gate7` calls, of which ten check one of the seven numbered
components and one (`G7b`, the `260808-lpt` literal) checks that the note identifies the task.**
The mapping: component 2 -> G7c/G7d/G7e, component 3 -> G7f, component 4 -> G7g/G7h/G7i/G7j,
component 5 -> G7m, component 6 -> G7k; components 1 and 7 have no gate. I left both numbers alone
and record the derivation here so the next reader does not "fix" one of them.

### UNMEASURED -- stated as unmeasured, not assumed

| Line | Claim | Why it cannot be measured |
|---|---|---|
| :643 | "the earlier draft gated only three of them" | `git log --oneline -- <plan>` returns exactly ONE commit (`ff21356`). No earlier draft exists in history, so the "three" is unverifiable from the repo. I corrected only its wrong unit ("of the twelve") and left the count attributed to the draft. |
| :583 | the quoted earlier-revision claim "twenty more unticked boxes ... plus one in `12-01-SUMMARY.md`" | quoted as a FALSE claim being refuted; not an assertion by this plan. The refutation itself is measured (3 in `12-01-SUMMARY.md`, confirmed). |
| T1 G8 (:379-403) | all G8 literals | G8 reads the SUMMARY, which does not exist yet. The plan already labels this the one gate whose literals are unmeasured. Unchanged. |

## Findings that are not aggregate corrections

**F1 -- The census rotted inside this task, which is the plan's own thesis.** `102 across 20 files`
was exactly right at `c84ebd5` and is wrong at `ff21356` (`109 across 22`) because
`.planning/.continue-here.md` (6 boxes) and `.planning/HANDOFF.json` (1) are this task's own handoff
artifacts. Both are transient and will vanish when consumed, so the figure will move a third time
before the executor runs. This is why I anchored rather than replaced: the anchored `c84ebd5` figure
stays true forever, and the plan's standing instruction ("use YOUR figure, dated") already covers the
live number. Every per-class figure is unchanged.

**F2 -- Probe 1 in Task 3 Edit B will fire, and it should.** The pjz row claims "8 residue rows
retained IN the ADR under `## Residual notes`". MEASURED: **7** top-level bullets in that section --
and one of those seven (`CACHE_READ_ONLY`, labelled "Phase 13, 2026-08-02") was added five weeks
AFTER the pjz task, so the count at pjz time was **6**, not 8. The plan's instruction to "count the
bullets ... against the eight the row claims" is a faithful restatement of the row and needs no
correction; I am flagging the expected outcome so the executor does not read a mismatch as its own
error. Command: `tail -n +84 .planning/THREAT-MODEL.md | awk 'NR==1{print;next} /^## /{exit} {print}'
| rg -c '^- '` -> 7.

**F3 -- Two unresolvable citations, one gate.** The pjz row cites `research/STACK.md` twice
(`:16-40` in the description, `:75,77` in the OPEN clause); repo-root `research/` does not exist
(`test -d research` -> exit 1) while `.planning/research/STACK.md` does (255 lines). Gate `G5c` is
`git grep -q -F -e '.planning/research/STACK.md'` -- a bare presence check that goes green once
EITHER is corrected, and Edit B's closing bullet ("Leave the rest of the row ... alone") puts the
description's `:16-40` out of scope. So one unresolvable citation survives by design. I corrected the
prose to say so (`:33`, `:851`) and deliberately did NOT add a gate: the brief forbids it, and the
plan is past the point where another gate buys correctness. Recording it as known, bounded residue --
the same disposition the plan gives G8.

**F4 -- Two gate cross-references in the threat model are off, and I did not touch them** (not
aggregates, out of my brief): `:1093` cites the T2 scope check as "G11" when the scope gate is
**G12** (G11 is the unticked-box gate); `:1091` lists "T2 ... G10b" among gates described as
per-item PRESENCE gates, but G10b is an absence gate. Flagging for iteration 3, not fixing.

## Re-validation -- verbatim

### 1. `verify.plan-structure`

```
{
  "valid": true,
  "errors": [],
  "warnings": [],
  "task_count": 3,
  "tasks": [
    { "name": "Task 1: Close the nine Phase 8 requirement checkboxes and the twelve stale traceability cells",
      "hasFiles": true, "hasAction": true, "hasVerify": true, "hasDone": true },
    { "name": "Task 2: Fix the ROADMAP Phase 8 ID shift, reconcile every dependent count in both files, and tick the stale phase and plan checkboxes",
      "hasFiles": true, "hasAction": true, "hasVerify": true, "hasDone": true },
    { "name": "Task 3: Reconcile 12-VERIFICATION.md, resolve the 260726-pjz status honestly, and record the closure in the audit",
      "hasFiles": true, "hasAction": true, "hasVerify": true, "hasDone": true }
  ],
  "frontmatter_fields": [ "phase", "plan", "type", "wave", "depends_on", "files_modified",
                          "autonomous", "requirements", "must_haves" ]
}
exit=0
```

### 2. `frontmatter.validate --schema plan`

```
{
  "valid": true,
  "missing": [],
  "present": [ "phase", "plan", "type", "wave", "depends_on", "files_modified", "autonomous",
               "must_haves" ],
  "schema": "plan"
}
exit=0
```

Zero errors, zero missing. Unchanged from before revision 3.

### 3. The 32-gate dry-run against the UNEDITED tree

The 32 gates are the T2 `p` / `a` helper block, extracted VERBATIM from the plan rather than
retyped (`rg -N '^(p|a) "\$[RQ]"' <plan>` -> exactly 32 lines: 13 `p "$R"`, 6 `p "$Q"`,
10 `a "$R"`, 3 `a "$Q"`), then sourced with reporting helpers substituted for the exiting ones.

```
extracted gate lines: 32

fail  G5a :800 coverage assertion not reconciled
fail  G5b :808 Phase 8 tally not reconciled
fail  G5c :815 total not reconciled
fail  G5d :816 category-sentence sum not reconciled  <-- the wrap continuation
fail  G5e :815 PARITY category count not reconciled
fail  G5f :828 paragraph heading not reconciled
fail  G5g :830 differing-ID count not reconciled
fail  G5h :831 subtraction not reconciled
fail  G5i :832 drift-warning clause not reconciled
fail  G6a :800 stale assertion survives
fail  G6b :808 stale Phase 8 tally survives
fail  G6c :815 stale total survives
fail  G6d :816 stale category sum survives  <-- the wrap continuation
fail  G6e :815 stale PARITY count survives
fail  G6f :828 stale paragraph heading survives
fail  G6g :830 stale differing-ID count survives
fail  G6h :831 stale subtraction survives
fail  G6i :832 stale drift-warning clause survives
fail  G6j :831 the ID list still opens with PARITY-06/07
fail  G7a :789 subset value + differing-ID count not reconciled
fail  G7b :791 drift-warning clause not reconciled
fail  G7c :789 stale subset value + count survive
fail  G7d :791 stale drift-warning clause survives
fail  G7e :790 the ID list still opens with PARITY-06/07
PASS  G7f the 4-ID list was deleted from ROADMAP rather than trimmed
PASS  G7g the 4-ID list was deleted from REQUIREMENTS rather than trimmed
PASS  G7h the 57 side of the REQUIREMENTS comparison was altered
PASS  G7i the :788 phrase was deleted instead of revalued
PASS  G13a :801 dated history was rewritten
PASS  G13b :818 dated note was rewritten
PASS  G13c :825 historical 51 was swept by a bulk replace
PASS  G13d REQUIREMENTS :786 quoted history was rewritten

PASS=8 fail=24 total=32
```

**PASS=8 / fail=24. The split HELD.** The 8 passing are exactly the survival gates (`G7f..G7i`,
`G13a..G13d`); the 24 failing are the reconciliation gates. Revision 3 touched the COMMENT block
above these gates (`:639-643`) and no gate line, which the verbatim extraction proves: the 32
extracted lines are byte-identical to the plan's.

## Post-edit hygiene

```
rg -c -F -e 'of eight' <plan>          -> exit 1 (gone)
rg -c -F -e 'twelve invariant' <plan>  -> exit 1 (gone)
rg -c -F -e 'invariant-prose' <plan>   -> 1      (positive control, exit 0)
rg -c '[^\x00-\x7F]' <plan>            -> exit 1 (ASCII only, no em dash, no curly quote)
git status --porcelain                 -> ' M .planning/quick/260808-lpt-.../260808-lpt-PLAN.md'
```

Nothing staged, nothing committed, no file outside the quick-task directory touched.
