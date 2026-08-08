---
phase: quick/260808-lpt
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/REQUIREMENTS.md
  - .planning/ROADMAP.md
  - .planning/phases/12-windows-ci-reuse-o4-consumer-recipe/12-VERIFICATION.md
  - .planning/STATE.md
  - .planning/v0.0.2-MILESTONE-AUDIT.md
autonomous: true
requirements:
  - AUDIT-DEBT-01
  - AUDIT-DEBT-02
  - AUDIT-DEBT-03
  - AUDIT-DEBT-04
  - AUDIT-DEBT-05
  - AUDIT-DEBT-06
  - AUDIT-DEBT-07
  - AUDIT-DEBT-08

must_haves:
  truths:
    - "Each of the nine Phase 8 requirement IDs (CORR-03, CORR-04, PARITY-01..07) is ticked in REQUIREMENTS.md ONLY where 08-VERIFICATION.md's own Requirements Coverage row renders SATISFIED for that exact ID, with the evidence quoted per ID in the SUMMARY."
    - "No traceability status cell in REQUIREMENTS.md still reads the pre-closure placeholder, AND all 57 traceability rows still exist -- the placeholder is gone because each row was reconciled, not because any row was deleted."
    - "ROADMAP.md's Phase 8 traceability block carries nine rows whose IDs match REQUIREMENTS.md's own numbering, so a future audit reading the ROADMAP table cannot mis-report PARITY-02 or PARITY-04."
    - "Every count that depends on the Phase 8 row set is reconciled in BOTH files in the same commit: the per-phase tally, the total, the category tally, and the two mirrored 'why the totals differ' sentences."
    - "ROADMAP.md's Phase 12 phase checkbox and every v0.0.2 plan checkbox are ticked -- Phase 10's eight, Phase 11's seven, Phase 13's six -- each row asserted to still EXIST and now be ticked, so no count is satisfiable by deletion."
    - "Exactly one unticked box survives in ROADMAP.md, the v0.0.2 milestone rollup, asserted positively because /gsd:complete-milestone owns it."
    - "12-VERIFICATION.md's frontmatter, body status line and counters agree with each other, the four behaviour-unverified items each cite the downstream artifact that closed them, and the original 13-truth findings table is left exactly as written."
    - "STATE.md's 260726-pjz row carries a verdict re-derived this task, and its unresolvable `research/STACK.md` citation is corrected to a path that exists at HEAD."
    - "Nothing outside `.planning/` is modified."
  artifacts:
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md
    - .planning/phases/12-windows-ci-reuse-o4-consumer-recipe/12-VERIFICATION.md
    - .planning/STATE.md
    - .planning/v0.0.2-MILESTONE-AUDIT.md
  key_links:
    - "REQUIREMENTS.md checkbox -> 08-VERIFICATION.md `## Requirements Coverage` row for that ID. The milestone audit's summary of those nine is NOT a permitted source."
    - "ROADMAP.md Phase 8 row note text -> the REQUIREMENTS.md body wording of the ID it is labelled with."
    - "ROADMAP.md `## Coverage Validation` arithmetic -> REQUIREMENTS.md's mirrored closing note. Both assert the same difference and must move together."
    - "ROADMAP.md Phase 12 phase checkbox -> the `## Progress` table row for Phase 12."
    - "STATE.md 260726-pjz row -> 260726-pjz-VERIFICATION.md's two `human_verification` items -> the commit that closed them."
---

<objective>
Close the eight bookkeeping-debt items the v0.0.2 milestone audit recorded, so the milestone archive
freezes an accurate record instead of a stale one.

Purpose: `/gsd:complete-milestone` seals these artifacts. A requirement that reads `[ ]` while its
phase verification renders SATISFIED, a traceability table whose IDs are shifted, and a VERIFICATION
whose frontmatter contradicts its own body are all cheap to fix now and permanent once archived.

Output: five reconciled `.planning/` artifacts and three commits. No source code, no `nx.json`, no
`package.json`, no `ci.yml`.
</objective>

<execution_context>
@~/.claude/gsd-core/workflows/execute-plan.md
@~/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/v0.0.2-MILESTONE-AUDIT.md
@.planning/REQUIREMENTS.md
@.planning/ROADMAP.md
@.planning/phases/08-nx-task-hash-parity/08-VERIFICATION.md
@.planning/phases/12-windows-ci-reuse-o4-consumer-recipe/12-VERIFICATION.md
@.planning/quick/260726-pjz-audit-triage-extract-and-deduplicate-arc/260726-pjz-VERIFICATION.md
@./CLAUDE.md
@./AGENTS.md
</context>

<the_one_hazard>
**A false `[x]` on a requirement is worse than a missing one: it ends the audit trail.**

Task 1 is the dangerous task, not the tedious one. Nine checkboxes and twelve status cells are
flipped, and the temptation is to flip them from the milestone audit's summary sentence ("08-VERIFICATION.md
marks all nine SATISFIED"). That sentence is HEARSAY for this purpose.

Binding rules for Task 1:

1. Open `08-VERIFICATION.md` and read its `## Requirements Coverage` table. For EACH of the nine IDs
   individually, locate the row whose first cell is that exact ID, and read its own Status and
   Evidence cells.
2. Quote that row's evidence, per ID, into the SUMMARY, under a heading that is exactly
   `## Per-ID evidence (08-VERIFICATION.md Requirements Coverage)` at line start. Nine separate
   quotes. A single sentence covering all nine is a FAIL of this rule. Gate G8 region-scopes to that
   heading and requires all nine ID tokens plus the anchor inside it, and FORBIDS the milestone
   audit's filename inside it -- so citing the forbidden source is a gate failure, not just a rule
   violation.
3. `.planning/v0.0.2-MILESTONE-AUDIT.md` is FORBIDDEN as the evidence source for any of the nine.
   Read it for the item list only.
4. If any one of the nine does NOT render SATISFIED in its own row, that checkbox STAYS unticked and
   its status cell STAYS as it is. Report it in the SUMMARY under a heading naming the ID. Do not
   average, do not round up, do not reason from the other eight.
5. The same discipline binds the twelve status cells and Task 3's item 8. Each cell gets its own
   located evidence, or it does not move.

**What G8 can and cannot prove -- stated plainly, because a silent gap here is how these nine boxes
rotted in the first place.**

G8 PROVES: a per-ID evidence section exists; it is anchored to `08-VERIFICATION.md`'s
`## Requirements Coverage` table by name; all nine IDs appear inside it; and the milestone audit is
not cited inside it.

G8 CANNOT PROVE: that the quoted text is a faithful transcription of the row rather than a plausible
paraphrase, or that the executor read the row at all. No grep can distinguish a real reading from a
convincing reconstruction. That residue is REAL and is not closed by this plan. It is bounded by two
things and no more: the quotes are per-ID and verbatim-able, so a reviewer can diff any one of them
against the row in seconds; and G8's forbidden-source clause removes the single most likely shortcut.
Do not report G8 green as evidence that the readings happened -- report it as evidence that the
citations exist and are anchored to the right table.
</the_one_hazard>

<gate_design_rules>
MEASURED and load-bearing: **no spec in this repo reads any `.planning/` file at runtime.** Every
`.planning/` mention in `packages/**/*.spec.ts` is a comment; the `readFileSync` targets are only
`nx.json`, `package.json`, `project.json` and doc URLs. `.planning/` is not a declared Nx input for
any target. Therefore:

- `nx run-many -t test` CANNOT catch a bad edit in this task. Do not run the battery as the gate and
  do not report its green as evidence. Every gate below is a self-authored assertion over the
  artifacts, which is exactly the condition under which vacuous gates ship.

Apply these three questions to every gate you write or extend. Each answer must be "no":

- Would an honest FALSIFIED result still pass this gate?
- Would writing NOTHING still pass it?
- Would DELETING the offending text without writing a replacement still pass it?

Design rules, each of which has fired in this repo:

- **Every absence/count gate is PAIRED with a per-item presence gate.** "0 unchecked boxes remain" is
  satisfiable by deleting the nine requirement lines. So the nine IDs are asserted to still EXIST and
  to now be ticked, one gate per ID.
- **Cardinality proves count, never distribution.** A `>= N` or `== N` gate says nothing about which
  sites changed. State only what the gate proves; scope the gate to the site when you need the site.
- **Absence gates use the `set -e`-exempt form:**
  `if git grep -q -E '<pattern>' -- <file>; then echo "FAIL ..."; exit 1; fi`
  Do NOT write `cmd; test $? -eq 1`. MEASURED here: under `set -e` the absence-confirming nonzero
  exit aborts the line before `test` runs, so a CORRECT absence false-fails and invites weakening a
  working gate.
- **Count gates default an empty result to 0.** `git grep -c` prints NOTHING on zero matches, so a
  bare `test "$N" -eq 0` dies with `integer expected` instead of failing cleanly. Use
  `N=$(git grep -c ... | rg -o '[0-9]+$' || true)` then `test "${N:-0}" -eq <n>`.
- **Prefer anchored regexes over bare literals** for absence gates, so a mention of the same words in
  prose or in a gate script cannot satisfy or invalidate the gate.
- **A PRESENCE gate whose literal already exists in the target file is vacuous -- it passes on an
  empty edit.** This is the "would writing NOTHING still pass it?" question applied to the additive
  direction, and it is the easiest one to miss, because a presence gate FEELS safe. Test every
  presence literal against the file at HEAD before relying on it. Found and fixed while writing this
  plan: six of the presence gates drafted for Tasks 2 and 3 were vacuous this way -- `11-EVIDENCE.md`,
  `260803-mew` and `12-VALIDATION.md` already appear in 12-VERIFICATION.md, and
  `requirements_completed`, `Phase 10` and `Phase 11` already appear in the milestone audit.
- **When the deliverable is an APPENDED section, region-scope its component gates to that section**
  rather than grepping the file. Extract with a LINE-ANCHORED heading match:
  `LN=$(rg -n --no-heading -e '^## Heading' "$F" | rg -o '^[0-9]+' | head -1)` then
  `REGION=$(tail -n +"$LN" "$F")`, then `printf '%s\n' "$REGION" | rg -q -F -e '<token>'`.
  The `^` is load-bearing: MEASURED on 08-VERIFICATION.md, the UNANCHORED form matched three lines
  (11, 56, 343) because the frontmatter and body both mention the heading in prose, selected line 11,
  and swept in 376 lines including the entire report -- so every in-region gate would have been
  satisfied by pre-existing text. The anchored form returns 343 alone, a 44-line region.
- **A region gate must bound its END, not only its start, whenever the target section is not provably
  last** -- and "provably last" means this plan's own `<output>` ordering says so. Add the bound:
  `| awk 'NR==1{print;next} /^## /{exit} {print}'`.
  The mechanism is worth understanding, because the same rule flipped outcome purely on POSITION. The
  unbounded form was safe for the two Task 3 region gates, whose sections are APPENDED at EOF, so
  "to EOF" and "this section" are the same range. G8 was the first region gate aimed at a section in
  the MIDDLE of a multi-section file -- the per-ID evidence section is listed FIRST of eight in
  `<output>` -- and the form was carried over without adapting the bound. Unbounded, it broke in BOTH
  directions at once: the presence checks passed on an EMPTY section because downstream text satisfied
  them, and the forbidden-literal check false-FAILED on legitimate downstream text. Same rule,
  different position, opposite outcome.
  MEASURED both ways on 08-VERIFICATION.md: for a middle section the bound cuts 300 lines to 35; for
  a last section it is an exact no-op (44 unbounded, 44 bounded). Because the bound costs nothing when
  the section IS last, all three region gates in this plan use it, rather than carrying three separate
  last-ness arguments that a future edit could silently invalidate.
- **A presence gate over PRE-EXISTING text is legitimate when the gate's purpose is that the text
  SURVIVES** (T3 G7l on `audited_at_commit`, T2 G10a on `10-01`, T2 G11a on the milestone rollup).
  Presence-at-HEAD is the point there, not a vacuity. Say which kind each gate is.

- **A gate literal that spans a LINE WRAP is dead: it matches nothing, silently.** `git grep` and `rg`
  are line-oriented, so a literal copied out of rendered prose can be unmatchable while looking
  perfectly reasonable. Always build gate literals from a SINGLE source line. MEASURED example, and
  the reason this rule is here: an earlier draft of gate G7 used `ROADMAPPED subset (51)` to guard
  REQUIREMENTS.md's stale subset value. The phrase `ROADMAPPED subset` ends `:788` and `(51).` opens
  `:789`, so the literal returned exit 1 against a positive control at exit 0 -- a dead gate, and the
  ONLY guard that value had. If a phrase must be matched across a wrap, use `rg -U` with a pattern
  that actually bridges it, and note that `\s+` cannot cross a wrap whose continuation carries a `#`.

**One allowlisted literal.** Gate G8e negative-greps the milestone audit's filename inside the
SUMMARY's per-ID evidence section, and that same filename appears legitimately in Task 3's action,
where the audit is the file being edited. The two are different files, so the action text cannot echo
into the region G8e checks, but the literal is declared rather than left as an apparent violation:

<!-- planner-discipline-allow: MILESTONE-AUDIT -->

**Per-gate provenance, not a blanket claim.** Every gate below records inline what was measured for
it: for an absence gate, that its literal is PRESENT at the current tree (so removing it is a real
change); for a presence gate, that its literal is ABSENT (so it cannot pass on an empty edit); for a
survival gate, that its literal is present and is MEANT to stay. Do not read a global "everything was
verified" sentence into this plan -- an earlier revision carried one and it was false, because the
dead G7b literal above had never been executed. If you add or widen a gate, measure ITS literal and
record the result next to it.
</gate_design_rules>

<shell_conventions>
Windows arm64, Git Bash. Binding on every command.

- **The `grep` command and the Grep tool are BOTH DENIED.** `git grep` for tracked files, `rg` for
  untracked/gitignored, `| rg` for every pipe filter.
- **`git grep` needs `-e` when the pattern starts with `-`.** MEASURED: `git grep -n -F '- [ ]' -- file`
  fails with `error: unknown switch` because the pattern parses as a switch. The working form is
  `git grep -n -F -e '- [ ]' -- file`. Every checkbox search in this plan hits this.
- A zero-hit search is NOT absence until you check the EXIT CODE (0 = match, 1 = genuine no-match,
  2+ = the command FAILED) and run a positive control on the same path. A typo'd path yields zero
  match lines and exit 2, indistinguishable from absence if you only read stdout. The OS error text
  is localized -- never match on English error strings.
- **`git grep` cannot see untracked or gitignored paths and returns a silent zero.** MEASURED this
  session: `research/STACK.md` does not exist at the repo root at all (the real path is
  `.planning/research/STACK.md`), and both the search AND its positive control returned exit 1 --
  which reads as "absent" rather than "wrong path". Run the positive control.
- `rg` is line-oriented and undercounts this repo's prose. Use `-i`; for wrapped phrases use `-U`,
  and note `\s+` cannot bridge a wrap whose continuation carries a `#` -- use `[\s#]+` there. Use
  `-F` for literals containing `.`, `+`, `(`, `?`. Never `-rn` with `rg` (parses as `--replace n`).
- **`git commit -m` FAILS on this Dev Drive** (D:, ReFS, `.git/COMMIT_EDITMSG: Invalid argument`).
  Write the message with the Write tool, then `git commit -F <file>`.
- Never `git add .` / `-A` / `-u` -- stage by name. Never prefix a command with `cd <path> &&`.
- **No heredocs.** Write gate scripts with the Write tool into the session scratchpad
  (`C:\Users\LARSGY~1\AppData\Local\Temp\claude\D--projects-github-op-nx-github-cache\...\scratchpad`),
  never into the repo. Run them with `bash <path>`.
- **ASCII only** -- `--` not an em dash, straight quotes, no emojis, no box-drawing. Public repo: no
  work email and no bare work domain in any committed file or commit message. No CI-skip token in any
  commit message, not even as prose.
- **RE-DERIVE every cited line number from the current tree before editing.** Every `file:NN` in this
  plan is annotated "at `c84ebd5`". Commit `2df3af5` exists in this repo because cited numbers had
  moved. Prefer the phrase citation over the number.
- This runs on the MAIN TREE. No worktree.
</shell_conventions>

<tasks>

<task type="auto">
  <name>Task 1: Close the nine Phase 8 requirement checkboxes and the twelve stale traceability cells</name>

  <files>.planning/REQUIREMENTS.md</files>

  <read_first>
    - `.planning/phases/08-nx-task-hash-parity/08-VERIFICATION.md`, section `## Requirements
      Coverage` (the nine rows are at `:188-196` at `c84ebd5`; re-derive with
      `git grep -n -F -e '| PARITY-01 |' -- .planning/phases/08-nx-task-hash-parity/08-VERIFICATION.md`).
    - `.planning/REQUIREMENTS.md`, the nine requirement bullets and the `## Traceability` table.
  </read_first>

  <action>
Two edits to one file, both pure status reconciliation. Touch no requirement BODY text and no
traceability row other than the twelve named.

**Edit A -- the nine requirement checkboxes.**

The nine IDs, MEASURED unticked at `c84ebd5` with their line numbers (re-derive before editing):
CORR-03 (:75), CORR-04 (:84), PARITY-01 (:201), PARITY-02 (:214), PARITY-03 (:222), PARITY-04 (:228),
PARITY-05 (:235), PARITY-06 (:238), PARITY-07 (:245). MEASURED: exactly 9 unticked and 48 ticked
bullets in the file, so these nine are the whole set.

Per ID, in order: locate its row in 08-VERIFICATION.md's `## Requirements Coverage` table, read that
row's own Status and Evidence cells, and tick the checkbox only if the row renders SATISFIED for that
exact ID. Change only the two characters inside the brackets. Quote the row's evidence for that ID in
the SUMMARY. Nine quotes.

Read `<the_one_hazard>` before starting. Rule 4 is live: an ID whose own row does not render
SATISFIED stays unticked and gets a named heading in the SUMMARY.

**Edit B -- the twelve traceability status cells.**

MEASURED: exactly 12 cells hold the pre-closure placeholder, at `c84ebd5` lines 719-727 (the nine
Phase 8 rows) plus RETAIN-05 (:741), CORR-05 (:742) and TEST-08 (:754). MEASURED: 57 traceability
rows total, 45 already reconciled.

Rewrite each of the twelve cells to the shape:

`| <ID> | Phase <N> | Complete (<evidence pointer located during THIS task>) |`

The evidence pointer is a short artifact-plus-finding citation, not a restatement of the
requirement. Keep the existing parenthetical's factual content where it survives the change; drop
only the part that asserted the work was still outstanding.

Sources, per group:

- The nine Phase 8 rows: the same 08-VERIFICATION.md row used for that ID in Edit A. The two
  reconciliations move together, so a ticked box and its row cannot disagree.
- CORR-05 and RETAIN-05 (both Phase 10): evidence EXISTS and was located --
  `10-VERIFICATION.md:55` (`### #12 CORR-05 -- VERIFIED (was Uncertain)`), `:107` (the RETAIN-05
  (a)(b)(c) row, VERIFIED), `:116` (the CORR-05 round-2 row, VERIFIED) and `:137` (the ticked list
  naming both). Re-derive each, then reconcile both cells and cite the site you read.
  **Search by ID, not by row shape.** MEASURED: `git grep -n -E '^\| (CORR-05|RETAIN-05) '` returns
  exit 1 on this file against a positive control at exit 0, because Phase 10 records verdicts as
  headings and numbered rows rather than as `| ID | Phase |` rows. A shape-anchored search here reads
  as "no evidence" and would wrongly leave the cells alone. Use `git grep -n -F -e 'CORR-05'`.
  CORR-05 additionally needs the explicit Phase 10 call on violation site 4
  (`release-asset-name.spec.ts:60`), which REQUIREMENTS.md's own CORR-05 body says the requirement
  cannot become true without; `:116`'s `CORR_05_SITES` empty clause is where to start.
- TEST-08 (Phase 11): evidence EXISTS -- `11-EVIDENCE.md:1004` is `## O4 (XOS-04, XOS-05)` and
  `:1006` records that the reservation held through Phase 11 "is DISCHARGED by plan 12-06". That is
  the append the placeholder was waiting on. Re-derive it in `11-EVIDENCE.md` itself rather than from
  `12-VERIFICATION.md`'s claim about it, then reconcile the cell and cite the section.

**These three cells are REQUIRED to flip.** Hazard rule 4's "leave it alone" permission does NOT
extend to them: their evidence has been located and is named above, so leaving them is a failure to
look, not an honest shortfall. G4 and G6b require the flip and G8 requires the citation. If you
genuinely cannot re-derive one of the four sites above, that is a discrepancy against a measurement
in this plan -- stop and report it rather than silently leaving the cell or weakening the gate.

Do not touch the `**Coverage:** 57 requirements...` line or the closing amendment notes -- the
totals-reconciliation half belongs to Task 2 and lands in the same commit as its ROADMAP mirror.
  </action>

  <verify>
    <automated>
Write to the scratchpad as `gate-t1.sh` and run with `bash`. Provenance is recorded PER GATE in the
comments below, per `<gate_design_rules>` -- there is deliberately no blanket claim here. G1 through
G7 had their literals measured against REQUIREMENTS.md at the current tree. **G8 did NOT and could
not**: it reads the SUMMARY, which does not exist yet -- that directory holds only this PLAN. G8's
provenance is therefore structural (its region cannot exist before the SUMMARY is written), not
measured, and it is the one gate here whose literals are unmeasured.

```
set -e
F=.planning/REQUIREMENTS.md
IDS="CORR-03 CORR-04 PARITY-01 PARITY-02 PARITY-03 PARITY-04 PARITY-05 PARITY-06 PARITY-07"

# G1 PRESENCE, per ID. Verified ABSENT at c84ebd5 for all nine (positive control: the
# corresponding unticked form was verified PRESENT on the same path).
for id in $IDS; do
  git grep -q -E "^- \[x\] \*\*$id\*\*" -- "$F" || { echo "FAIL G1: $id not present as a ticked requirement bullet"; exit 1; }
done

# G2 ABSENCE, per ID, set -e-exempt form. Verified PRESENT at c84ebd5 for all nine.
for id in $IDS; do
  if git grep -q -E "^- \[ \] \*\*$id\*\*" -- "$F"; then echo "FAIL G2: $id still unticked"; exit 1; fi
done

# G3 the bullet set is INTACT: 57 requirement bullets, 0 unticked. Pairs with G1 so a
# deletion cannot satisfy G2. MEASURED at c84ebd5: ticked 48, unticked 9, sum 57.
X=$(git grep -c -F -e '- [x] **' -- "$F" | rg -o '[0-9]+$' || true)
U=$(git grep -c -F -e '- [ ] **' -- "$F" | rg -o '[0-9]+$' || true)
test "${X:-0}" -eq 57 || { echo "FAIL G3a: ticked bullets ${X:-0}, expected 57"; exit 1; }
test "${U:-0}" -eq 0  || { echo "FAIL G3b: ${U:-0} bullets still unticked"; exit 1; }

# G4 PRESENCE, per row, for all twelve reconciled cells. Each literal verified ABSENT at
# c84ebd5 (positive control: the placeholder form of the same row verified PRESENT).
for r in "PARITY-01 | Phase 8" "PARITY-02 | Phase 8" "PARITY-03 | Phase 8" \
         "PARITY-04 | Phase 8" "PARITY-05 | Phase 8" "PARITY-06 | Phase 8" \
         "PARITY-07 | Phase 8" "CORR-03 | Phase 8" "CORR-04 | Phase 8" \
         "RETAIN-05 | Phase 10" "CORR-05 | Phase 10" "TEST-08 | Phase 11"; do
  git grep -q -F -e "| $r | Complete" -- "$F" || { echo "FAIL G4: row '$r' is not reconciled"; exit 1; }
done

# G5 ABSENCE of the placeholder, anchored to the row shape so prose cannot trip it.
# Verified PRESENT (12 rows) at c84ebd5.
if git grep -q -E '^\| [A-Z]+-[0-9]+ \| Phase [0-9]+ \| Pending' -- "$F"; then
  echo "FAIL G5: a traceability row still holds the pre-closure placeholder"; exit 1; fi

# G6 the row set is INTACT: 57 rows, all reconciled. Pairs with G4 against deletion.
R=$(git grep -c -E '^\| [A-Z]+-[0-9]+ \| Phase ' -- "$F" | rg -o '[0-9]+$' || true)
C=$(git grep -c -E '^\| [A-Z]+-[0-9]+ \| Phase [0-9]+ \| Complete' -- "$F" | rg -o '[0-9]+$' || true)
test "${R:-0}" -eq 57 || { echo "FAIL G6a: ${R:-0} traceability rows, expected 57"; exit 1; }
test "${C:-0}" -eq 57 || { echo "FAIL G6b: ${C:-0} reconciled rows, expected 57"; exit 1; }

# G7 scope: this task touches exactly one file (the SUMMARY is written by the executor's own
# output step, not staged here).
D=$(git diff --name-only -- . | rg -v '^\.planning/REQUIREMENTS\.md$' || true)
test -z "$D" || { echo "FAIL G7: out-of-scope files touched: $D"; exit 1; }

# G8 the per-ID evidence discipline, gated rather than merely instructed. Region-scoped to the
# SUMMARY's own heading, line-anchored AND END-BOUNDED per the region rule. Run this AFTER the
# SUMMARY is written. Read the admission in <the_one_hazard> for what this does and does not
# prove.
#
# The END BOUND is load-bearing and this gate is why the rule exists. The per-ID section is
# listed FIRST of eight in <output>, so it is NOT last in the SUMMARY. Unbounded, the region
# ran to EOF and swallowed every later section, which broke the gate in BOTH directions:
# G8c passed on a per-ID section containing ZERO quotes (the nine ID tokens were satisfied by a
# downstream disposition line that happens to list them), and G8e false-FAILED on a downstream
# line legitimately citing the file Task 3 edits. Bounding at the next '^## ' fixes both.
SUM=.planning/quick/260808-lpt-fix-the-v0-0-2-milestone-audit-bookkeepi/260808-lpt-SUMMARY.md
test -f "$SUM" || { echo "FAIL G8a: no SUMMARY to check"; exit 1; }
EN=$(rg -n --no-heading -e '^## Per-ID evidence \(08-VERIFICATION\.md Requirements Coverage\)' "$SUM" | rg -o '^[0-9]+' | head -1)
test -n "$EN" || { echo "FAIL G8b: the SUMMARY has no line-anchored per-ID evidence section with the required heading"; exit 1; }
EV=$(tail -n +"$EN" "$SUM" | awk 'NR==1{print;next} /^## /{exit} {print}')
for id in $IDS; do
  printf '%s\n' "$EV" | rg -q -F -e "$id" || { echo "FAIL G8c: $id has no evidence citation in the per-ID section"; exit 1; }
done
for id in CORR-05 RETAIN-05 TEST-08; do
  printf '%s\n' "$EV" | rg -q -F -e "$id" || { echo "FAIL G8d: $id was reconciled without a cited source"; exit 1; }
done
# the forbidden source must NOT be cited inside the evidence section
if printf '%s\n' "$EV" | rg -q -F -e 'MILESTONE-AUDIT'; then
  echo "FAIL G8e: the milestone audit is cited inside the per-ID evidence section -- it is hearsay for these nine"; exit 1; fi

echo "T1 GATES PASS"
```

G3/G6 are cardinality only and prove nothing about WHICH sites moved -- G1, G2, G4, G5 and G8 carry
that.

**On hazard rule 4 and these gates, so the action and the gates do not contradict each other.**
Rule 4's "leave it unticked" permission applies ONLY to the nine Phase 8 IDs, and if it fires,
G1/G3a/G4/G6b WILL fail. That is deliberate, not an oversight: the intended outcome is a HARD STOP --
record the shortfall by ID, leave the gate failing, and report. Do not weaken the gate to make a
shortfall pass. The permission does NOT extend to CORR-05 / RETAIN-05 / TEST-08, whose evidence is
located and named in the action; for those three the flip is required and G4/G6b/G8d enforce it.
    </automated>
  </verify>

  <done>
- Each of the nine IDs is ticked in REQUIREMENTS.md and its `## Traceability` row reads Complete with
  an evidence pointer, OR it is unticked with a named SUMMARY heading explaining which
  08-VERIFICATION.md row failed to render SATISFIED.
- The SUMMARY carries a line-anchored `## Per-ID evidence (08-VERIFICATION.md Requirements Coverage)`
  section holding nine per-ID quotes from 08-VERIFICATION.md's own rows, plus a cited source for
  CORR-05, RETAIN-05 and TEST-08, and it does NOT cite the milestone audit. G8 checked, after the
  SUMMARY was written.
- All 57 requirement bullets and all 57 traceability rows still exist.
- No file other than `.planning/REQUIREMENTS.md` is modified.
- Committed with `git commit -F <scratchpad msg file>`, staging `.planning/REQUIREMENTS.md` by name.
  Message: `docs(260808-lpt): close the nine Phase 8 checkboxes and twelve stale traceability cells`
  </done>
</task>

<task type="auto">
  <name>Task 2: Fix the ROADMAP Phase 8 ID shift, reconcile every dependent count in both files, and tick the stale phase and plan checkboxes</name>

  <files>.planning/ROADMAP.md, .planning/REQUIREMENTS.md</files>

  <read_first>
    - `.planning/ROADMAP.md` `## Traceability` Phase 8 rows (`:753-757` at `c84ebd5`) and
      `## Coverage Validation` (`:798-832`).
    - `.planning/ROADMAP.md` `**Requirements**` line for Phase 8 (`:168` at `c84ebd5`) -- it already
      names all NINE correctly and is the in-file authority for the row set.
    - `.planning/REQUIREMENTS.md` bodies of PARITY-01..07 -- the note text you write must describe the
      ID it is labelled with.
    - `.planning/REQUIREMENTS.md` closing amendment note (`:786-791` at `c84ebd5`) -- the mirror of
      ROADMAP's difference sentence.
  </read_first>

  <action>
**Edit A -- the Phase 8 ID shift (audit item 3).**

MEASURED at `c84ebd5`: ROADMAP has 7 Phase 8 traceability rows; REQUIREMENTS assigns 9. The shift,
re-derived by reading each row's note text against the REQUIREMENTS body of the ID it claims:

| ROADMAP row label | Its note text actually describes |
|---|---|
| PARITY-01 | PARITY-01 -- correct, leave the label |
| PARITY-02 | PARITY-03 (byte-identical at all THREE observation points) |
| PARITY-03 | PARITY-05 (`integration` workstation vs windows-11-arm, O2's precondition) |
| PARITY-04 | PARITY-06 (Nx version, Node version, install mode) |
| PARITY-05 | PARITY-07 (public-surface guard passes unchanged) |

REQUIREMENTS' PARITY-02 (the per-NODE `details` instrument) and PARITY-04 (warm-local-vs-cold-CI as a
separate named question) have no ROADMAP row at all.

Relabel the four shifted rows to PARITY-03 / PARITY-05 / PARITY-06 / PARITY-07 keeping their note
text, and insert two new rows for PARITY-02 and PARITY-04 whose note text is derived from the
REQUIREMENTS bodies (Success Criteria 2 and 4 in ROADMAP's own Phase 8 section are the matching
in-file wording). Leave the block sorted PARITY-01..07 then CORR-03, CORR-04 -- nine rows.

Add one dated note under the table recording that the shift is now FIXED, that REQUIREMENTS.md is
authoritative, and where the defect was originally surfaced (`08-ROOT-CAUSE.md` item 5 of "Where the
requirements' own words disagree", carried forward as residue (d) in `08-VERIFICATION.md`). Those two
Phase 8 records cite the old ROADMAP line numbers and state the defect is still open -- they are
sealed and MUST NOT be back-edited. The dated note here is what closes the loop.

**Edit B -- every count the row set feeds (audit item 4), in BOTH files, in this commit.**

The Phase 8 row set going 7 -> 9 moves the roadmapped total 51 -> 53, and that in turn moves the
documented difference between the two files from six IDs to four. Both files carry a self-checking
clause warning that if the difference is ever anything other than the six IDs it lists, one of the two
tables has drifted. Reconcile every site, or that clause becomes the drift it warns about.

**ELEVEN live lines -- EIGHT in ROADMAP.md and THREE in REQUIREMENTS.md -- carrying THIRTEEN stale
literals**, because ROADMAP `:815` and `:831` each carry two. Every literal was located and measured
to match exactly one line. Re-derive every line number before editing.

In `.planning/ROADMAP.md` (line numbers at the current tree):

| Line | What it asserts now | Rewrite to |
|---|---|---|
| :800 | the coverage assertion, both operands at fifty-one | `**Assertion: 53/53 v0.0.2 requirements map to exactly one phase. No orphans, no duplicates.**` |
| :808 | the Phase 8 tally: seven, listing only PARITY-01 through PARITY-05 | `- Phase 8: 9 (PARITY-01..07, CORR-03, CORR-04)` |
| :815 | the total sum, plus the PARITY category count of five | `Total mapped: 7 + 9 + 8 + 11 + 7 + 4 + 7 = 53. Source categories: CORR 5, LINT 6, PARITY 7, VER 8,` |
| :816 | the CONTINUATION of that same sentence, ending in its own sum of fifty-one | `XOS 9, RETAIN 1, TRUST 5, DOCS 4, TEST 4, OBS 4 = 53.` |
| :828 | the paragraph heading naming this file's total | `**Why this file says 53 and \`REQUIREMENTS.md\` says 57.** Both are correct and neither is drifting:` |
| :830 | the count of differing IDs, spelled in words | `difference is exactly FOUR IDs that predate Phase 13 and have a row there but none here --` |
| :831 | the six-entry ID list, and the subtraction | `` `PARITY-08`, `VER-07`, `ROBUST-04`, `RETAIN-05`. 57 - 53 = 4. If a future `` |
| :832 | the drift-warning clause, naming the count in words | `edit makes that difference anything other than those four, one of the two tables HAS drifted.` |

**`:816` is a separate site and needs its own edit.** The category sentence WRAPS across `:815` and
`:816`, and each half carries its own trailing sum. Fixing `:815` alone ships a sentence whose own
operands add to 53 while its stated total says otherwise. G5d/G6d gate `:816` specifically.

In `.planning/REQUIREMENTS.md`, the mirrored closing amendment note:

| Line | What it asserts now | Rewrite to |
|---|---|---|
| :789 | the roadmapped-subset value, then the differing-ID count in words | `(53). The difference is exactly FOUR IDs that predate Phase 13 and have a row here but none there:` |
| :790 | the six-entry ID list | `` `PARITY-08`, `VER-07`, `ROBUST-04`, `RETAIN-05`. If a future `` |
| :791 | the drift-warning clause | `that difference anything other than those four, one of the two tables has drifted.*` |

**The subset value wraps.** MEASURED: `ROADMAPPED subset` ends `:788` and its parenthesised value
opens `:789`, so any gate or edit spanning that break silently matches nothing -- this is exactly how
the earlier draft of gate G7b came to be dead. Keep the phrase `ROADMAPPED subset` on `:788` intact
and change only the value at the head of `:789`; G7 asserts `:789` as a single-line fragment.

Also add, per this file's existing dated-note convention (it already carries "Count corrected
2026-07-30" and "Phase 13 added 2026-08-02"): a third dated note explaining that the 51 -> 53 move is
the Phase 8 shift closure, not a scope change -- no requirement was added or removed.

**FOUR historical sites that MUST NOT change, and one of them contains a `51`.** A bulk find-replace
of 51 -> 53 across either file is WRONG and G13 will catch it:

- ROADMAP `:801` -- the "was stated as 43/43, then 44/44" history.
- ROADMAP `:818-821` -- the 2026-07-30 dated note, which records a total that read 43.
- ROADMAP `:825` -- inside the 2026-08-02 dated note, the phrase `Total 44 -> 51`. **This 51 is
  historical and must survive**; it records what the total became at that date, not what it is now.
- REQUIREMENTS `:786` -- the quoted "43/43 mapped" sentence, explicitly "left as written".

Arithmetic check before you write: 7 + 9 + 8 + 11 + 7 + 4 + 7 = 53, the category operands
5 + 6 + 7 + 8 + 9 + 1 + 5 + 4 + 4 + 4 = 53, and 57 - 53 = 4. If any of the three fails, stop -- one of
your two tables is wrong.

**Edit C -- Phase 12's phase checkbox (audit item 6).**

`:94` at `c84ebd5` is the only unticked entry in the v0.0.2 phase list. Tick it and add the
completion suffix in the same shape the six sibling entries use, with the date taken from the
`## Progress` table's Phase 12 row (`:948` at `c84ebd5`, Complete 2026-07-31). Read that row rather
than copying the date from this plan.

**Edit D -- every stale plan checkbox in the v0.0.2 phase list (audit item 7, widened).**

MEASURED at the current tree (re-derived, not carried forward -- `git grep -n -F -e '- [ ]' --
.planning/ROADMAP.md`, 22 hits, positive control 60 ticked on the same path). Re-derive again before
editing; Task 1 and Task 2's earlier edits are in files above these lines.

| Phase | Unticked plan rows | Lines | Rows in the block |
|---|---|---|---|
| 10 | `10-02` .. `10-08` (seven) | 435-441 | EIGHT -- `10-01` at `:434` is already ticked |
| 11 | `11-01` .. `11-07` (seven) | 508-514 | seven |
| 13 | `13-01` .. `13-06` (six) | 639-644 | six |

Tick all twenty. Three measured corrections to the audit's item 7 sit behind this:

1. **The audit says five Phase 13 checkboxes. There are SIX** (`13-01` .. `13-06`), corroborated by
   STATE.md's "Plan: 6 of 6" and the `## Progress` table's Phase 13 row.
2. **The audit omitted Phases 10 and 11 entirely** -- fourteen more boxes of the identical class.
3. **Phase 10's block has eight rows, not seven** -- `10-01` is already ticked, so the gate asserts
   all EIGHT are ticked rather than seven, which also catches an accidental untick of `10-01`.

The tick is corroborated IN THIS FILE, not just by the audit: `**Plans**: 8/8 plans complete` (Phase
10) and `**Plans**: 7/7 plans complete` (Phase 11) already declare both phases' plans complete while
their boxes read otherwise -- the same internal contradiction item 6 fixes between Phase 12's
checkbox and the Progress table. Locate each phase's own `**Plans**:` line and its `## Progress` row
before ticking, and cite both in the SUMMARY. If either says a phase's plans are NOT all complete,
that phase's boxes STAY unticked and the SUMMARY reports it by phase.

**What stays unticked, and why -- exactly ONE box.**

After Edits C and D the correct total is **1**, not 0. Recomputed: 22 - 1 (Phase 12's phase entry)
- 7 (Phase 10) - 7 (Phase 11) - 6 (Phase 13) = 1.

The single survivor is `:26`, the `**v0.0.2 OS-invariant cross-OS sharing**` milestone rollup entry.
`/gsd:complete-milestone` owns it; ticking it here would assert the milestone is closed while this
task is the work that makes closing it safe. G11 asserts it SURVIVES and STAYS unticked, so it can
be neither ticked nor deleted.

**Do not widen further -- and re-measure before you describe what you are not touching.**

An earlier revision of this plan claimed "twenty more unticked boxes, all in `*-RESEARCH.md`
checklists plus one in `12-01-SUMMARY.md`". **That claim was FALSE**, and it was produced by a
pattern that required a backtick immediately after the checkbox, which silently dropped every box
whose text starts with a word. Re-measured with the correct pattern:

```
git grep -c -F -e '- [ ]' -- .planning ':!.planning/milestones' ':!.planning/quick' ':!.planning/ROADMAP.md'
```

**102 unticked boxes across 20 files.** Nine of those are REQUIREMENTS.md's own requirement
checkboxes, which Task 1 ticks, leaving **93 across 19 files** once Task 1 lands. Per class:
`.planning/research/` 35 in 3 files; phase `*-RESEARCH.md` 30 in 5 files; `PROJECT.md` 7 in 1 file;
and the remaining 21 spread across phase SUMMARY / PLAN / LEARNINGS / VERIFICATION / deferred-items
files -- including THREE in `12-01-SUMMARY.md`, not one. Both `.planning/research/` and `PROJECT.md`
were missing from the earlier claim entirely.

Re-run that command yourself and use YOUR figure, dated, in the SUMMARY. Do not carry the numbers
above forward as fact -- they are this plan's measurement, not yours, and boxes get added.

None of these is a phase/plan completion marker: they are research checklists, roadmap-adjacent
progress lists, and per-plan scratch. Different class, out of scope. Leave every one of them.

**The precise figure goes in the SUMMARY, NOT in the sealed audit.** See Task 3 Edit C item 5 -- a
count written into an archived artifact is the exact defect class this task exists to close.
  </action>

  <verify>
    <automated>
Write to the scratchpad as `gate-t2.sh` and run with `bash`. Recorded HEAD state is in the comments.

```
set -e
R=.planning/ROADMAP.md
Q=.planning/REQUIREMENTS.md

# G1 PRESENCE, per row: nine Phase 8 rows with the correct IDs.
for id in PARITY-01 PARITY-02 PARITY-03 PARITY-04 PARITY-05 PARITY-06 PARITY-07 CORR-03 CORR-04; do
  git grep -q -F -e "| $id | Phase 8 |" -- "$R" || { echo "FAIL G1: no Phase 8 row for $id"; exit 1; }
done

# G2 CARDINALITY of the Phase 8 block: exactly 9, no duplicate labels left behind by the
# relabel. MEASURED 7 at c84ebd5.
P8=$(git grep -c -E '^\| [A-Z]+-[0-9]+ \| Phase 8 \|' -- "$R" | rg -o '[0-9]+$' || true)
test "${P8:-0}" -eq 9 || { echo "FAIL G2: ${P8:-0} Phase 8 rows, expected 9"; exit 1; }

# G3 ABSENCE of the shift: the PARITY-02 row must no longer carry PARITY-03's text, and the
# PARITY-03 row must no longer carry PARITY-05's. Both verified PRESENT at c84ebd5.
if git grep -q -E '^\| PARITY-02 \| Phase 8 \| Byte-identical' -- "$R"; then
  echo "FAIL G3a: the PARITY-02 row still carries PARITY-03's note text"; exit 1; fi
if git grep -q -E '^\| PARITY-03 \| Phase 8 \| Byte-identical `integration`' -- "$R"; then
  echo "FAIL G3b: the PARITY-03 row still carries PARITY-05's note text"; exit 1; fi

# G4 total row set. MEASURED 51 at c84ebd5.
RT=$(git grep -c -E '^\| [A-Z]+-[0-9]+ \| Phase ' -- "$R" | rg -o '[0-9]+$' || true)
test "${RT:-0}" -eq 53 || { echo "FAIL G4: ${RT:-0} traceability rows, expected 53"; exit 1; }

# ---- G5/G6/G7: the twelve invariant-prose sites, PAIRED per site ----
# Every literal below was measured individually at the current tree and is unique to exactly
# ONE line, so each pair localises to its own site. A gate pair per site is what stops a
# partial fix -- the earlier draft gated only three of the twelve, and a fix to :815 that left
# :816 alone passed every gate while shipping a sentence contradicting its own operands.
#
# Helper: p = presence (must exist after), a = absence (must be gone after).
p(){ git grep -q -F -e "$2" -- "$1" || { echo "FAIL $3"; exit 1; }; }
a(){ if git grep -q -F -e "$2" -- "$1"; then echo "FAIL $3"; exit 1; fi; }

# G5 ROADMAP.md presence, NINE gates. All nine literals verified ABSENT at the current tree.
p "$R" 'Assertion: 53/53'                          'G5a :800 coverage assertion not reconciled'
p "$R" '- Phase 8: 9 ('                            'G5b :808 Phase 8 tally not reconciled'
p "$R" '= 53. Source categories'                   'G5c :815 total not reconciled'
p "$R" 'OBS 4 = 53.'                               'G5d :816 category-sentence sum not reconciled  <-- the wrap continuation'
p "$R" 'PARITY 7,'                                 'G5e :815 PARITY category count not reconciled'
p "$R" 'says 53 and'                               'G5f :828 paragraph heading not reconciled'
p "$R" 'exactly FOUR IDs'                          'G5g :830 differing-ID count not reconciled'
p "$R" '57 - 53 = 4'                               'G5h :831 subtraction not reconciled'
p "$R" 'other than those four'                     'G5i :832 drift-warning clause not reconciled'

# G6 ROADMAP.md absence, TEN gates (:815 and :831 each carry two stale literals). All ten
# verified PRESENT at the current tree, each matching exactly one line.
a "$R" 'Assertion: 51/51'                          'G6a :800 stale assertion survives'
a "$R" '- Phase 8: 7 ('                            'G6b :808 stale Phase 8 tally survives'
a "$R" '= 51. Source categories'                   'G6c :815 stale total survives'
a "$R" 'OBS 4 = 51.'                               'G6d :816 stale category sum survives  <-- the wrap continuation'
a "$R" 'PARITY 5,'                                 'G6e :815 stale PARITY count survives'
a "$R" 'says 51 and'                               'G6f :828 stale paragraph heading survives'
a "$R" 'exactly SIX IDs'                           'G6g :830 stale differing-ID count survives'
a "$R" '57 - 51 = 6'                               'G6h :831 stale subtraction survives'
a "$R" 'other than those six'                      'G6i :832 stale drift-warning clause survives'
a "$R" '`PARITY-06`, `PARITY-07`, `PARITY-08`'     'G6j :831 the ID list still opens with PARITY-06/07'

# G7 REQUIREMENTS.md mirror, moved in the SAME commit. Single-line fragments only.
# The earlier draft used 'ROADMAPPED subset (51)', which is a DEAD literal: MEASURED, the
# phrase ends :788 and the value opens :789, so it matched nothing (exit 1 against a positive
# control at exit 0) and the stale value had no guard at all. Both halves are now gated on
# :789 alone.
p "$Q" '(53). The difference is exactly FOUR IDs'  'G7a :789 subset value + differing-ID count not reconciled'
p "$Q" 'other than those four'                     'G7b :791 drift-warning clause not reconciled'
a "$Q" '(51). The difference is exactly SIX IDs'   'G7c :789 stale subset value + count survive'
a "$Q" 'other than those six'                      'G7d :791 stale drift-warning clause survives'
a "$Q" '`PARITY-06`, `PARITY-07`, `PARITY-08`'     'G7e :790 the ID list still opens with PARITY-06/07'

# G7f SURVIVAL gates -- pre-existing text whose PRESENCE is the point, so presence-at-HEAD is
# not a vacuity here. The 4-ID tail must survive the list edit (otherwise G6j/G7e are
# satisfiable by deleting the whole list), and the 57 side must not move.
p "$R" '`PARITY-08`, `VER-07`, `ROBUST-04`, `RETAIN-05`' 'G7f the 4-ID list was deleted from ROADMAP rather than trimmed'
p "$Q" '`PARITY-08`, `VER-07`, `ROBUST-04`, `RETAIN-05`' 'G7g the 4-ID list was deleted from REQUIREMENTS rather than trimmed'
p "$Q" 'DEFINED set (57)'                          'G7h the 57 side of the REQUIREMENTS comparison was altered'
p "$Q" 'ROADMAPPED subset'                         'G7i the :788 phrase was deleted instead of revalued'

# G13 the FOUR historical sites survive. A bulk 51 -> 53 replace breaks these; ':825' in
# particular carries a 51 that is HISTORICAL and must stay. All verified PRESENT.
p "$R" 'Was stated as 43/43, then 44/44'           'G13a :801 dated history was rewritten'
p "$R" 'the total read 43'                         'G13b :818 dated note was rewritten'
p "$R" 'Total 44 -> 51'                            'G13c :825 historical 51 was swept by a bulk replace'
p "$Q" '"43/43 mapped" sentence'                   'G13d REQUIREMENTS :786 quoted history was rewritten'

# G8 Phase 12 phase checkbox: PRESENCE of the ticked line, keyed on its own title so it cannot
# be satisfied by another entry. Verified ABSENT at c84ebd5.
git grep -q -F -e '- [x] **Phase 12: Windows CI Reuse (O4) + Consumer Recipe**' -- "$R" || \
  { echo "FAIL G8a: the Phase 12 entry is not ticked"; exit 1; }
if git grep -q -F -e '- [ ] **Phase 12:' -- "$R"; then echo "FAIL G8b: an unticked Phase 12 entry survives"; exit 1; fi

# G9 Phase 13 plan rows: SIX per-plan presence gates, each keyed on its own filename, so
# five ticked plus one deleted cannot pass. All six verified unticked at c84ebd5.
for n in 01 02 03 04 05 06; do
  git grep -q -F -e "- [x] \`13-$n-PLAN.md\`" -- "$R" || { echo "FAIL G9a: 13-$n-PLAN.md row is not present-and-ticked"; exit 1; }
  if git grep -q -F -e "- [ ] \`13-$n-PLAN.md\`" -- "$R"; then echo "FAIL G9b: 13-$n-PLAN.md still unticked"; exit 1; fi
done

# G10 Phase 10 and Phase 11 plan rows, same shape. Phase 10 asserts EIGHT rows -- 10-01 was
# already ticked at c84ebd5, so including it catches an accidental untick. Phase 11 asserts
# seven, all verified unticked at c84ebd5.
for n in 01 02 03 04 05 06 07 08; do
  git grep -q -F -e "- [x] \`10-$n-PLAN.md\`" -- "$R" || { echo "FAIL G10a: 10-$n-PLAN.md row is not present-and-ticked"; exit 1; }
  if git grep -q -F -e "- [ ] \`10-$n-PLAN.md\`" -- "$R"; then echo "FAIL G10b: 10-$n-PLAN.md still unticked"; exit 1; fi
done
for n in 01 02 03 04 05 06 07; do
  git grep -q -F -e "- [x] \`11-$n-PLAN.md\`" -- "$R" || { echo "FAIL G10c: 11-$n-PLAN.md row is not present-and-ticked"; exit 1; }
  if git grep -q -F -e "- [ ] \`11-$n-PLAN.md\`" -- "$R"; then echo "FAIL G10d: 11-$n-PLAN.md still unticked"; exit 1; fi
done

# G11 the ONE legitimate survivor. A presence gate on the UNTICKED form, so the milestone
# rollup can be neither ticked nor deleted. Verified PRESENT and unticked at c84ebd5.
git grep -q -E '^- \[ \] \*\*v0\.0\.2 OS-invariant cross-OS sharing\*\*' -- "$R" || \
  { echo "FAIL G11a: the v0.0.2 milestone rollup entry was ticked or removed -- /gsd:complete-milestone owns it"; exit 1; }
# and it is the ONLY survivor. MEASURED 22 at c84ebd5; recomputed target 22-1-7-7-6 = 1.
UB=$(git grep -c -F -e '- [ ]' -- "$R" | rg -o '[0-9]+$' || true)
test "${UB:-0}" -eq 1 || { echo "FAIL G11b: ${UB:-0} unticked boxes, expected exactly 1 (the milestone rollup)"; exit 1; }

# G12 scope: exactly two files.
D=$(git diff --name-only -- . | rg -v '^\.planning/(ROADMAP|REQUIREMENTS)\.md$' || true)
test -z "$D" || { echo "FAIL G12: out-of-scope files touched: $D"; exit 1; }

echo "T2 GATES PASS"
```

G2, G4 and G11b are cardinality only. They prove counts, not distribution -- G1, G3, G5, G8, G9,
G10 and G11a carry that. G11b is why the per-row presence gates matter: on its own, "exactly 1
unticked" is satisfiable by DELETING the twenty plan rows, and G9a/G10a/G10c forbid that. G11a is
the inverse guard -- it is the one place a surviving `[ ]` is the correct result, so it is asserted
positively rather than left to a count.
    </automated>
  </verify>

  <done>
- ROADMAP's Phase 8 traceability block has nine rows whose labels match REQUIREMENTS' numbering, each
  note text describing the ID it is labelled with, plus a dated note recording the closure and
  pointing at where the defect was surfaced.
- `53/53`, the Phase 8 tally of 9, `7 + 9 + 8 + 11 + 7 + 4 + 7 = 53`, `PARITY 7` and `57 - 53 = 4`
  all present in ROADMAP; the mirrored sentence in REQUIREMENTS names 53 and the same four IDs.
- Phase 12's phase entry is ticked, and all twenty-one v0.0.2 plan entries are present-and-ticked:
  eight for Phase 10, seven for Phase 11, six for Phase 13.
- Exactly ONE unticked box remains in ROADMAP.md -- the `**v0.0.2 OS-invariant cross-OS sharing**`
  milestone rollup -- and it is provably still present and still unticked.
- Each phase's own `**Plans**:` line and `## Progress` row were read before its boxes were ticked,
  and both are cited in the SUMMARY.
- No sealed Phase 8 record was back-edited.
- Committed with `git commit -F <msg file>`, staging `.planning/ROADMAP.md` and
  `.planning/REQUIREMENTS.md` by name. Message:
  `docs(260808-lpt): fix the ROADMAP Phase 8 ID shift and reconcile every dependent count`
  </done>
</task>

<task type="auto">
  <name>Task 3: Reconcile 12-VERIFICATION.md, resolve the 260726-pjz status honestly, and record the closure in the audit</name>

  <files>.planning/phases/12-windows-ci-reuse-o4-consumer-recipe/12-VERIFICATION.md, .planning/STATE.md, .planning/v0.0.2-MILESTONE-AUDIT.md</files>

  <read_first>
    - `.planning/phases/12-windows-ci-reuse-o4-consumer-recipe/12-VERIFICATION.md` frontmatter and
      the `**Status:**` / score lines under the report heading.
    - `.planning/phases/08-nx-task-hash-parity/08-VERIFICATION.md`, its `## Human Verification
      Closed` section (`:343-386` at `c84ebd5`). **This is the in-repo precedent for exactly this
      reconciliation -- follow its shape, including its honesty clause.**
    - `.planning/quick/260726-pjz-audit-triage-extract-and-deduplicate-arc/260726-pjz-VERIFICATION.md`
      frontmatter (the two `human_verification` items) and its closing "Two loose ends" section.
    - `.planning/STATE.md` `### Quick Tasks Completed`, the 260726-pjz row (`:445` at `c84ebd5`).
  </read_first>

  <action>
**Edit A -- 12-VERIFICATION.md (audit item 5). The ONE sealed-record edit this task is allowed.**

The contradiction: the frontmatter carries the passed verdict while the body's Status line, the
`score` key (nine of thirteen) and the `behavior_unverified` counter (four) all still read the
pre-closure state. All four behaviour-unverified items ARE closed downstream; the artifact was never
reconciled.

Reconcile by SUPERSEDING IN PLACE, which is this repo's convention (used by 260804-h3b on the
milestone audit, by 08-ROOT-CAUSE.md's CORR-04 block, and already by this very file's own
`superseded:` key on human_verification item 2). Do NOT rewrite the 13-truth findings table, the
per-item verdicts, or the `## Central Question` section -- those were correct for the tree they
audited and are the record.

Three parts:

1. Append a section whose heading is exactly `## Human Verification Closed` **at line start** --
   gate G1 line-anchors on it and region-scopes every closure check inside it, so a differently
   worded heading fails the gate. Model it on 08-VERIFICATION.md's section of the same name. It
   carries a
   four-row table -- item, closed by, evidence -- and a sentence stating which artifact is now the
   status of record. **Re-derive every closure from the named artifact. The milestone audit's
   "Phase 12's contradiction, resolved" table is a POINTER, not a source.** The four items and where
   to look:
   - Item 1, the per-leg `[remote cache]` counts on a first same-repo PR run: closed by Phase 12's
     own landing. Look in `.planning/phases/11-live-proofs-o1-o2-o3/11-EVIDENCE.md`'s O4 section and
     cross-check the XOS-05 row in `.planning/REQUIREMENTS.md`.
   - Item 2, the `windows-regression-detector.yml` dispatch: closed by quick `260803-mew`. Its
     `superseded:` key in this file's own frontmatter names the evidence; confirm it against
     `.planning/quick/260803-mew-*/260803-mew-EVIDENCE.md`.
   - Item 3, RESEARCH assumption A1: closed by measurement in
     `.planning/phases/12-windows-ci-reuse-o4-consumer-recipe/12-VALIDATION.md`.
   - Item 4, the `docs/cross-os.md` prose review: closed by
     `.planning/phases/12-windows-ci-reuse-o4-consumer-recipe/12-UAT.md` test 4.
2. Update the frontmatter to agree with the body: `behavior_unverified` becomes 0, the score records
   both the at-verification figure and the closed figure, and add
   `human_verification_closed` / `human_verification_closed_by` keys naming what closed each item --
   the same key names 08-VERIFICATION.md uses.
3. The body's `**Status:**` line under the report heading must read the passed verdict, and must
   carry the explicit honesty clause 08-VERIFICATION.md wrote for its own equivalent line: that it
   read the pre-closure value at the moment of verification and was updated when the items were
   CLOSED, not when they were waived. Without that clause the edit is indistinguishable from a
   quiet upgrade.

If any of the four cannot be re-derived from its named artifact, that item is NOT closed: leave
`behavior_unverified` at the honest remaining count, leave the body Status line as it is, and record
the shortfall in the SUMMARY. The gates below will fail, by design. Do not weaken them.

**Edit B -- STATE.md's 260726-pjz row (audit item 8). Honest resolution, not a status flip.**

The row's OPEN clause claims two things: (a) residue item 4 is a labelled duplicate retained against
the file's own criterion, and (b) four removed sentences have no coverage row and no home. Both are
judgment calls addressed to a human by `260726-pjz-VERIFICATION.md`'s two `human_verification`
items. Re-derive the state of BOTH before writing anything.

Run these probes, checking exit codes and running the positive control on the same path:

1. Does residue item 4's bullet still exist? Probe `.planning/THREAT-MODEL.md` for its distinctive
   tokens (`rejected outright`, `content-keyed`, `clean eviction`), positive control
   `Residual notes` on the same path. Count the bullets under `## Residual notes` against the
   eight the row claims were retained.
2. If it is gone, find the commit that removed it and read its message:
   `git log --oneline -S 'content-keyed' -- .planning/THREAT-MODEL.md .planning/ARCHITECTURE-DECISION.md`
   (the file was renamed, so both paths are needed).
3. For the four sentences, probe their distinctive tokens (`raw-count`, `safety-weighted`,
   `re-populate`, `self-inflicted`) across `.planning` EXCLUDING `.planning/quick` and
   `.planning/milestones`, which is the same exclusion `260726-pjz-VERIFICATION.md` used. Record per
   token whether it now has a home. **Beware: a trailing `| tr` or `| head` in the pipeline makes
   `$?` the filter's exit code, not `git grep`'s** -- capture the exit code before piping.
4. The row cites `research/STACK.md:75,77`. MEASURED at `c84ebd5`: `research/` does NOT exist at the
   repo root, so that citation is unresolvable, and both a search of it AND its positive control
   return failure -- which reads as "absent" rather than "wrong path". The real file is
   `.planning/research/STACK.md`. Re-derive the correct line numbers for the two Reject rows the
   citation means (the Actions Artifacts row and the git objects / refs row) and correct the
   citation.

Then write the honest verdict into the row:

- Replace the row's Status cell with a value re-derived from the probes. If both follow-ups are
  closed with located evidence, say so and cite the closing commit. If one is closed and the other is
  only accepted-as-non-operative, say exactly that -- and name which tokens remain homeless. If a
  probe FALSIFIES the closure, the row stays open with a restated, precise description of what
  remains. All three are passing outcomes. The forbidden outcome is a `Verified`-class value without
  located evidence for both follow-ups.
- Rewrite the row's OPEN clause to match the verdict, keeping it factual and citing the corrected
  `.planning/research/STACK.md` path.
- Leave the rest of the row (description, date, commit range, directory link) alone.

**STATE.md is the exception to the docs-commit rule and must not be lost between two commits.** The
executor does not commit `.planning/STATE.md` -- the orchestrator does. So:
- Make the edit, then leave `.planning/STATE.md` UNSTAGED. Do not `git add` it.
- Reproduce the new Status cell value and the new OPEN clause VERBATIM in the SUMMARY, under a
  heading that says the orchestrator must preserve them, so the edit is re-appliable if the
  orchestrator's own STATE.md write clobbers it.
- After the orchestrator's commit lands, re-run gate G6 below to confirm the edit survived.

**Edit C -- the audit closing note (audit item 5's bookkeeping tail, plus the out-of-scope item).**

Append ONE dated block to `.planning/v0.0.2-MILESTONE-AUDIT.md`, following that file's own in-place
supersede convention -- it already carries three such blocks from 260804-h3b. Do NOT edit the
`tech_debt` frontmatter list: it is the as-audited record at `2df3af5` and the note supersedes it in
place, exactly as 260804-h3b did.

Its heading must be exactly `## Bookkeeping debt closed` followed by this task's id, **at line
start**. Gate G7 line-anchors on that heading and region-scopes all ten component checks inside the
section, because three of them (`requirements_completed`, `Phase 10`, `Phase 11`) already appear
elsewhere in the audit and would otherwise pass on an empty edit.

The block records:

1. Which of the eight items closed, in which commit, and by what evidence. Anything that did NOT
   close under a hazard rule is named as still open.
2. **The `requirements_completed` item, RECLASSIFIED as a `house-style` CONVENTION rather than a
   defect** -- this is the explicitly out-of-scope item and the note is its deliverable. State the
   convention: this project's SUMMARY frontmatter records `provides:` / `affects:` / `requires:` and
   does not populate `requirements_completed`, so the audit's third cross-reference source is
   structurally non-discriminating here; the `two sources of record` are the phase VERIFICATION.md
   verdict and REQUIREMENTS.md's traceability table. Use both of those quoted phrases verbatim --
   G7d and G7e gate on them. State explicitly that NO sealed SUMMARY was back-edited and that
   backfilling 30 REQ-IDs across Phases 7-9 was declined for that reason.
3. The roadmapped-subset arithmetic moving 51 -> 53 and the documented difference SIX -> FOUR, so the
   audit's own as-audited counts are not silently contradicted by Task 2's edit.
4. **A finding about the AUDIT's own completeness**, in three measured parts: its item 7 said "all
   five Phase 13 plan checkboxes" when there are SIX (`13-01`..`13-06`); it omitted Phases 10 and 11
   entirely, which carried fourteen more boxes of the identical class; and Phase 10's block has EIGHT
   rows, not seven, because `10-01` was already ticked. All twenty were closed by this task. Record
   this as a completeness finding about the audit, not as a defect in the phases -- an item list that
   catches 6 of 20 instances of one defect is the interesting result here.
5. That unticked checkboxes remain elsewhere under `.planning/` -- in research documents, in
   `PROJECT.md`, and in phase artifacts -- and that they are research checklists and per-plan scratch
   rather than phase/plan completion markers, so they are a different class and out of scope.
   **Record this QUALITATIVELY. Write NO number into the audit**, and include the sentence
   `No count is recorded here deliberately` so the choice is visible as a choice rather than an
   omission -- G7m gates that phrase. Point at this task's SUMMARY for the measured figure.
   The reason, which is the same reason this whole task exists: a precise count in a sealed artifact
   rots the moment anyone adds a checklist item, and an audit that carries a rotted count is what
   produced these eight items. An earlier revision of this plan was about to insert a FALSE count
   here (twenty, against a measured 93); that near-miss is itself worth one clause in the note.
6. The ONE box left unticked in ROADMAP.md by design -- the v0.0.2 milestone rollup, owned by
   `/gsd:complete-milestone`.
7. That the paragraph-level "11 items across 7 areas" vs frontmatter "13 items across 8 areas" drift
   is PRE-EXISTING and deliberately NOT re-arithmetic'd, matching the scope note the audit already
   carries on that paragraph.
  </action>

  <verify>
    <automated>
Write to the scratchpad as `gate-t3.sh` and run with `bash`. Recorded HEAD state is in the comments.

```
set -e
V=.planning/phases/12-windows-ci-reuse-o4-consumer-recipe/12-VERIFICATION.md
S=.planning/STATE.md
A=.planning/v0.0.2-MILESTONE-AUDIT.md

# G1 the closing section exists and carries all FOUR closures, one presence gate per closure
# keyed on its own evidence artifact -- so three closures plus a stub cannot pass.
#
# REGION-SCOPED, and this is load-bearing. MEASURED at c84ebd5: three of the four evidence
# tokens (11-EVIDENCE.md, 260803-mew, 12-VALIDATION.md) are ALREADY present elsewhere in this
# file, so a file-wide grep for them passes on an EMPTY edit. Scoping to the new section --
# whose anchor is verified ABSENT at c84ebd5, positive control '^## Goal Achievement' matched
# on the same path -- is what makes them non-vacuous.
#
# The anchor regex is LINE-ANCHORED, also load-bearing. MEASURED on 08-VERIFICATION.md: the
# unanchored form matched THREE lines (11, 56, 343) because the frontmatter and body both
# mention the heading in prose; it selected line 11 and swept in 376 lines including the whole
# report. The anchored form returns 343 alone, a 44-line region that correctly excludes
# everything above it.
#
# END-BOUNDED as well. This section IS appended last, so the bound is a measured NO-OP today
# (verified against 08-VERIFICATION.md's section of the same name: 44 lines unbounded, 44
# bounded). It is applied anyway, because "provably last" is an argument a later edit can
# silently invalidate, and one uniform region form is cheaper to trust than three per-gate
# last-ness arguments.
LN=$(rg -n --no-heading -e '^## Human Verification Closed' "$V" | rg -o '^[0-9]+' | head -1)
test -n "$LN" || { echo "FAIL G1a: no '## Human Verification Closed' section heading in $V"; exit 1; }
REGION=$(tail -n +"$LN" "$V" | awk 'NR==1{print;next} /^## /{exit} {print}')
for tok in '11-EVIDENCE.md' '260803-mew' '12-VALIDATION.md' '12-UAT.md'; do
  printf '%s\n' "$REGION" | rg -q -F -e "$tok" || { echo "FAIL G1b: closure evidence $tok not cited INSIDE the closing section"; exit 1; }
done

# G2 frontmatter agrees. Verified ABSENT at c84ebd5 (the pre-closure counter value was
# verified PRESENT on the same path).
git grep -q -E '^behavior_unverified: 0$' -- "$V" || { echo "FAIL G2a: behavior_unverified not reconciled"; exit 1; }
if git grep -q -E '^behavior_unverified: 4$' -- "$V"; then echo "FAIL G2b: stale counter survives"; exit 1; fi
git grep -q -E '^human_verification_closed:' -- "$V" || { echo "FAIL G2c: no closed-on key"; exit 1; }
git grep -q -E '^human_verification_closed_by:' -- "$V" || { echo "FAIL G2d: no closed-by key"; exit 1; }

# G3 the body status line moved, PAIRED with the honesty clause so a bare upgrade cannot pass.
# The pre-closure form was verified PRESENT at c84ebd5.
if git grep -q -E '^\*\*Status:\*\* human_needed' -- "$V"; then
  echo "FAIL G3a: the body status line still holds the pre-closure verdict"; exit 1; fi
git grep -q -E '^\*\*Status:\*\* passed' -- "$V" || { echo "FAIL G3b: the body status line does not read passed"; exit 1; }
git grep -q -F -e 'not when it was waived' -- "$V" || { echo "FAIL G3c: the honesty clause is missing -- a status upgrade without it is indistinguishable from a waiver"; exit 1; }

# G4 the original findings survive: the 13-truth table and the Central Question section are
# NOT rewritten. All verified PRESENT at c84ebd5.
git grep -q -F -e 'PRESENT_BEHAVIOR_UNVERIFIED' -- "$V" || { echo "FAIL G4a: the original per-truth verdicts were rewritten"; exit 1; }
git grep -q -F -e '## Central Question' -- "$V" || { echo "FAIL G4b: the Central Question section was removed"; exit 1; }
git grep -q -F -e '9/13' -- "$V" || { echo "FAIL G4c: the at-verification score was erased rather than superseded"; exit 1; }

# G5 the pjz row still EXISTS -- paired with G6 so deletion cannot satisfy it.
git grep -q -F -e '| 260726-pjz |' -- "$S" || { echo "FAIL G5a: the 260726-pjz row is gone"; exit 1; }
# and the citation is corrected to a path that exists at HEAD. Verified: research/STACK.md
# does NOT exist at c84ebd5; .planning/research/STACK.md does.
test -f .planning/research/STACK.md || { echo "FAIL G5b: the corrected citation target does not exist"; exit 1; }
git grep -q -F -e '.planning/research/STACK.md' -- "$S" || { echo "FAIL G5c: the row does not cite a resolvable path"; exit 1; }

# G6 the row's status was re-derived. Region-scoped to the pjz row: extract it, then assert.
# Verified at c84ebd5: exactly one row in STATE.md holds the review-pending value, and it is
# this one.
ROW=$(git grep -h -F -e '| 260726-pjz |' -- "$S")
echo "$ROW" | rg -q -F -e '| Needs Review |' && { echo "FAIL G6: the pjz row still holds the review-pending value -- resolve it or restate what remains open"; exit 1; }
echo "$ROW" | rg -q -F -e '260726-pjz' || { echo "FAIL G6b: row extraction failed"; exit 1; }

# G7 the audit closing note exists and carries all SEVEN numbered components from the action,
# checked by ELEVEN region-scoped gates (component 2 alone needs three literals, and component
# 4's three-part finding needs four), so a partial note cannot pass.
#
# REGION-SCOPED for the same reason as G1. MEASURED at c84ebd5: 'requirements_completed',
# 'Phase 10' and 'Phase 11' are ALREADY present elsewhere in the audit -- the first in the
# tech_debt frontmatter that raised the item, the others in the open_by_design list -- so
# file-wide gates on them pass on an EMPTY edit. The section anchor is verified ABSENT at
# c84ebd5 (positive control '^## Tech Debt Summary' matched on the same path), so scoping
# every component gate inside it makes all seven non-vacuous by construction. Line-anchored,
# per the G1 note.
#
# The note's heading must therefore be exactly '## Bookkeeping debt closed ...' at line start.
AN=$(rg -n --no-heading -e '^## Bookkeeping debt closed' "$A" | rg -o '^[0-9]+' | head -1)
test -n "$AN" || { echo "FAIL G7a: no '## Bookkeeping debt closed' section heading in $A"; exit 1; }
# END-BOUNDED, same uniform form and same reasoning as G1: appended last today, so the bound is
# a no-op, applied so no gate depends on a last-ness argument.
NOTE=$(tail -n +"$AN" "$A" | awk 'NR==1{print;next} /^## /{exit} {print}')
gate7(){ printf '%s\n' "$NOTE" | rg -q -F -e "$1" || { echo "FAIL $2"; exit 1; }; }
gate7 '260808-lpt'              'G7b: the note does not identify this task'
gate7 'requirements_completed'  'G7c: the convention note is missing'
gate7 'house-style'             'G7d: the convention is not named as house style'
gate7 'two sources of record'   'G7e: the convention does not name the two sources of record'
gate7 '57 - 53 = 4'             'G7f: the arithmetic change is not recorded'
# the three-part audit-completeness finding, each part gated separately
gate7 '13-06'                   'G7g: the five-vs-six Phase 13 correction is missing'
gate7 'Phase 10'                'G7h: the omitted-Phase-10 finding is missing'
gate7 'Phase 11'                'G7i: the omitted-Phase-11 finding is missing'
gate7 '10-01'                   'G7j: the eight-rows-not-seven finding is missing'
gate7 'complete-milestone'      'G7k: the surviving-rollup note is missing'
# the out-of-scope boxes are described QUALITATIVELY. Verified ABSENT from the audit at the
# current tree (positive control 'audited_at_commit' PRESENT on the same path).
gate7 'No count is recorded here deliberately' 'G7m: the out-of-scope checkbox note must state that omitting a count is deliberate -- a precise count in a sealed artifact rots'
# the as-audited tech_debt frontmatter is UNTOUCHED (file-wide by design -- this one asserts
# that pre-existing text SURVIVES, so its presence at HEAD is the point, not a vacuity)
git grep -q -F -e 'audited_at_commit: 2df3af5' -- "$A" || { echo "FAIL G7l: the as-audited frontmatter was edited"; exit 1; }

# G8 scope. STATE.md must be MODIFIED but NOT STAGED (the orchestrator commits it).
git diff --name-only -- "$S" | rg -q -F -e 'STATE.md' || { echo "FAIL G8a: STATE.md was not edited"; exit 1; }
if git diff --cached --name-only -- "$S" | rg -q -F -e 'STATE.md'; then
  echo "FAIL G8b: STATE.md is staged -- the orchestrator owns that commit"; exit 1; fi
D=$(git diff --name-only -- . | rg -v '^\.planning/' || true)
test -z "$D" || { echo "FAIL G8c: files outside .planning/ touched: $D"; exit 1; }

echo "T3 GATES PASS"
```

G6 is deliberately permissive about WHICH verdict the row carries, because all three honest outcomes
(both follow-ups closed, one closed and one accepted, or a falsified closure restated as open) are
different strings. What it forbids is leaving the value unchanged. The evidence discipline for the
verdict itself is `<the_one_hazard>` rule 5 and is carried by the SUMMARY's located citations, not
by a grep -- state that limitation in the SUMMARY rather than claiming the gate proves the verdict.

Re-run G6 AFTER the orchestrator commits STATE.md, to confirm the edit survived.
    </automated>
  </verify>

  <done>
- 12-VERIFICATION.md's frontmatter, body Status line and counters agree; a `## Human Verification
  Closed` section carries all four closures each citing its own downstream artifact; the honesty
  clause is present; the 13-truth table, the at-verification score and the Central Question section
  are preserved rather than rewritten.
- STATE.md's 260726-pjz row carries a verdict re-derived from executed probes with exit codes and
  positive controls, cites `.planning/research/STACK.md` with re-derived line numbers, and is
  MODIFIED BUT UNSTAGED, with its new Status cell and OPEN clause reproduced verbatim in the SUMMARY
  for the orchestrator.
- The audit carries one dated closing block with all six components, and its `tech_debt` frontmatter
  and `audited_at_commit` are untouched.
- Nothing outside `.planning/` is modified.
- Committed with `git commit -F <msg file>`, staging
  `.planning/phases/12-windows-ci-reuse-o4-consumer-recipe/12-VERIFICATION.md` and
  `.planning/v0.0.2-MILESTONE-AUDIT.md` by name -- NOT `.planning/STATE.md`. Message:
  `docs(260808-lpt): reconcile 12-VERIFICATION, resolve the pjz status, and record the closure`
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| this task -> the sealed milestone archive | `/gsd:complete-milestone` freezes these five artifacts. Anything written here becomes unfalsifiable history. |
| this task -> a future auditor | A future audit reads these artifacts as evidence. A false `[x]` is not a cosmetic error; it terminates that audit's inquiry into the requirement. |
| committed prose -> the public repo | This is a public repository. Commit messages and file content are world-readable. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-lpt-01 | Tampering | the nine REQUIREMENTS.md checkboxes | high | mitigate | Per-ID verification against 08-VERIFICATION.md's own row, nine quoted evidence citations in the SUMMARY, the milestone audit forbidden as a source, and hazard rule 4 keeping an unevidenced box unticked. `<the_one_hazard>`. |
| T-lpt-02 | Repudiation | 12-VERIFICATION.md's findings | high | mitigate | Supersede in place: the 13-truth table, the at-verification score and the Central Question section are preserved and gated (T3 G4), so the reconciliation cannot be mistaken for a re-verification. |
| T-lpt-03 | Tampering | every absence/count gate in this plan | high | mitigate | Every absence and count gate is paired with a per-item presence gate (T1 G1/G4, T2 G1/G9/G10a/G10b, T3 G1/G5), so deletion cannot satisfy any of them. |
| T-lpt-04 | Information disclosure | commit messages and file content | high | mitigate | ASCII only, no work email and no bare work domain in any committed file or commit message, no CI-skip token even as prose. Committer identity verified as the public address at plan time. |
| T-lpt-05 | Denial of service | the Nx cache and CI | low | accept | Only `.planning/` files change, and `.planning/` is not a declared input of any Nx target, so no task hash rotates and no CI leg is affected. Gated by the scope checks (T1 G7, T2 G11, T3 G8c). |
| T-lpt-SC | Tampering | npm/pip/cargo installs | low | accept | No package-manager install task exists in this plan and no dependency changes. The Package Legitimacy Gate has nothing to audit. |
</threat_model>

<verification>
Whole-task checks, after all three commits:

1. The eight audit items each have a disposition recorded in the SUMMARY: closed with evidence, or
   left open with the reason and the ID/site named. Eight dispositions, no fewer.
2. `git diff --name-only c84ebd5..HEAD` lists only paths under `.planning/`. No source file, no
   `nx.json`, no `package.json`, no `ci.yml`.
3. `git log --format=%s c84ebd5..HEAD` shows three subjects, all ASCII, none carrying a CI-skip
   token or a work-email domain.
4. Re-run `gate-t1.sh`, `gate-t2.sh` and `gate-t3.sh` against the final tree. All three pass
   together -- Task 2's edits must not have re-broken Task 1's row counts.
5. Re-run T3's G6 after the orchestrator's STATE.md commit lands.
6. Do NOT run or report `nx run-many -t test` as verification. No spec reads `.planning/`, so its
   green is not evidence about this change. Say so explicitly rather than omitting it.
</verification>

<success_criteria>
- All nine Phase 8 requirement IDs are ticked with per-ID evidence quoted from 08-VERIFICATION.md's
  own rows, or the shortfall is named by ID.
- REQUIREMENTS.md holds 57 requirement bullets and 57 traceability rows, all reconciled, with none
  deleted.
- ROADMAP.md's Phase 8 traceability block matches REQUIREMENTS.md's numbering, and both files agree
  that the roadmapped subset is 53 and the documented difference is four named IDs.
- Phase 12's phase checkbox is ticked and all twenty-one v0.0.2 plan checkboxes are present-and-ticked
  (Phase 10 eight, Phase 11 seven, Phase 13 six), each asserted per row so no count is satisfiable by
  deletion. Exactly one box survives unticked -- the v0.0.2 milestone rollup -- asserted positively.
- 12-VERIFICATION.md is internally consistent, with the four closures cited and the original
  findings preserved.
- STATE.md's 260726-pjz row carries an honestly re-derived verdict and a resolvable citation, and its
  content is reproduced in the SUMMARY for the orchestrator's commit.
- The milestone audit carries one dated closing block, including the `requirements_completed`
  convention note, and its as-audited frontmatter is untouched.
</success_criteria>

<output>
Create `.planning/quick/260808-lpt-fix-the-v0-0-2-milestone-audit-bookkeepi/260808-lpt-SUMMARY.md`
when done.

The SUMMARY must contain, at minimum:
- A section headed exactly `## Per-ID evidence (08-VERIFICATION.md Requirements Coverage)` at line
  start, holding the nine per-ID quotes (Task 1, hazard rule 2) plus the cited source for CORR-05,
  RETAIN-05 and TEST-08, and citing no other verdict source. Gate G8 depends on this heading.
- The re-measured unticked-checkbox figure for the rest of `.planning/`, WITH the command that
  produced it and the date -- the precise number lives here, never in the sealed audit (B4).
- A disposition line for each of the eight audit items.
- The new STATE.md Status cell and OPEN clause, verbatim, under a heading telling the orchestrator to
  preserve them.
- The probe results for item 8, with exit codes and positive controls shown.
- The three-part audit-completeness finding on item 7, with each part's measurement: Phase 13 is six
  not five, Phases 10 and 11 were omitted entirely, and Phase 10's block has eight rows not seven.
- Each ticked phase's own `**Plans**:` line and `## Progress` row, cited as the in-file corroboration.
- The one ROADMAP box left unticked and why, plus the per-class breakdown of the boxes measured
  elsewhere under `.planning/` and deliberately left as a different class. The breakdown must be
  accurate or absent -- an earlier revision of this plan shipped a wrong one.
- An explicit statement that the test battery is not a gate for this change and was not used as one.
</output>
