# Plan-check iteration 3 -- 260808-lpt

NARROW, operator-authorized. Scope: the uncommitted diff (8 aggregate sites), the three findings
revision 3 left unfixed (F2/F3/F4), the G8 region-bound fix committed at `ff21356`, and the 32-gate
dry-run split. The settled list in `HANDOFF.json` `blockers[0]` was NOT re-reviewed; nothing I
measured contradicts it.

Baseline: HEAD `ff21356`, branch `gsd/v0.0.2-os-invariant-cross-os-sharing`. Working tree carries
only the modified PLAN.md and the untracked REVISION-3.md. Every number below is my own measurement,
run from the repo root; the revision report's figures were not accepted as evidence.

**VERDICT: BLOCKERS FOUND -- 2 blockers, 6 warnings, 9 confirmed sound.**
**Dry-run split measured independently: PASS=8 / fail=24.** The split HELD.

---

## BLOCKERS

### B1 -- `<verification>` items 2 and 3 use a STALE commit baseline; item 3 is measurably false

Plan `:1129` and `:1131` are the ONLY two places in the plan where a commit is used as a command
ARGUMENT rather than as a "MEASURED at" annotation:

```
2. `git diff --name-only c84ebd5..HEAD` lists only paths under `.planning/`. ...
3. `git log --format=%s c84ebd5..HEAD` shows three subjects, all ASCII, none carrying a CI-skip
   token or a work-email domain.
```

Measured:

```
$ git log --format='%h %s' c84ebd5..HEAD
ff21356 wip(260808-lpt): pause mid-revision, with the plan's own residue named
$ git rev-list --count c84ebd5..HEAD
1
```

`ff21356` already sits inside that range. After the three task commits land, item 3's range yields
**FOUR** subjects, not three. The check as written FAILS on a fully correct execution.

This is a HALF-APPLIED correction, which is the defect class the brief names. Revision 3 explicitly
recognised the `c84ebd5 -> ff21356` move -- it is the whole point of the census re-anchor -- and
`ff21356` appears in the plan at exactly two lines, both inside that new census block:

```
$ rg -n -F -e 'ff21356' <plan>
602:Re-measured at `ff21356`: **109 across 22 files**. ...
605:byte-for-byte unchanged at `ff21356`. ...
exit=0
$ rg -n -F -e 'c84ebd5..' <plan>
1129:2. `git diff --name-only c84ebd5..HEAD` lists only paths under `.planning/`. ...
1131:3. `git log --format=%s c84ebd5..HEAD` shows three subjects, ...
exit=0
```

The reviser corrected the number the move invalidated and left the two commands the move
invalidated. Item 2's SUBSTANCE survives either baseline (measured: `git diff --name-only
c84ebd5..HEAD` lists `.planning/.continue-here.md`, `.planning/HANDOFF.json` and the plan -- all
under `.planning/`), so only item 3 is false today; but both should move together or the next commit
to land breaks item 2 as well.

**Fix (one token each):** `c84ebd5..HEAD` -> `ff21356..HEAD` at `:1129` and `:1131`. Do NOT instead
change "three subjects" to "four" -- that re-encodes the same rot.

### B2 -- threat model `T-lpt-03` makes a blanket coverage claim that is FALSE, and the diff now contradicts it in-file

`:1116` (T-lpt-03 mitigation):

> Every absence and count gate is paired with a per-item presence gate (T1 G1/G4, T2
> G1/G9/G10a/G10b, T3 G1/G5), so deletion cannot satisfy any of them.

The diff's own new comment at `:651-656` says the opposite:

> ELEVEN of the thirteen are PAIRED with a presence gate (G5a..i, G7a..b). The two remaining
> literals are the ID-list rewrites at ROADMAP :831 and REQUIREMENTS :790, which have no
> positive-form pair by design

Measured -- the pairing, gate by gate:

```
$ rg -n '^(p|a) "\$[RQ]"' <plan>       # 32 lines; see the full listing under CS-3
p $R : 13   a $R : 10   p $Q : 6   a $Q : 3   total: 32
```

G6a..G6i each have a same-line G5 partner; **G6j (ROADMAP `:831` ID list) and G7e (REQUIREMENTS
`:790` ID list) have none.** So "Every absence gate is paired with a per-item presence gate" is
false as written, and it is now falsified by a sentence 460 lines earlier in the same file.

This is the exact class revision 3 already deleted once: W-i1 removed the false blanket "every gate
literal was executed at `c84ebd5`" claim. A false blanket claim surviving in the `<threat_model>` --
the artifact `/gsd:secure-phase` verifies mitigations against -- is worse than one in prose.

The SUBSTANTIVE property still holds and is worth keeping: deleting the ID list to satisfy G6j/G7e
trips the survival gates.

```
$ git grep -n -F -e '`PARITY-08`, `VER-07`, `ROBUST-04`, `RETAIN-05`' -- .planning/ROADMAP.md
.planning/ROADMAP.md:831:...      <- G7f guards this
$ git grep -n -F -e '`PARITY-08`, `VER-07`, `ROBUST-04`, `RETAIN-05`' -- .planning/REQUIREMENTS.md
.planning/REQUIREMENTS.md:790:... <- G7g guards this
exit=0 both
```

**Fix (one sentence, no new gate):** restate T-lpt-03 as "Every absence and count gate is backed by
a presence gate that makes deletion insufficient -- the two unpaired absence gates, G6j and G7e, are
backed by the survival gates G7f and G7g." That claim IS true and I verified it above.

---

## WARNINGS

### W1 -- `T-lpt-05` cites "T2 G11" for a scope check; T2's scope gate is G12 (F4, first half -- CONFIRMED)

```
$ rg -n -e '^# G1[12]' -e 'FAIL G11' -e 'FAIL G12' <plan>
741:# G11 the ONE legitimate survivor. A presence gate on the UNTICKED form, ...
744:  { echo "FAIL G11a: the v0.0.2 milestone rollup entry was ticked or removed ..."; exit 1; }
747:test "${UB:-0}" -eq 1 || { echo "FAIL G11b: ${UB:-0} unticked boxes, expected exactly 1 ..."; exit 1; }
749:# G12 scope: exactly two files.
751:test -z "$D" || { echo "FAIL G12: out-of-scope files touched: $D"; exit 1; }
```

`T-lpt-05` (`:1118`) reads "Gated by the scope checks (T1 G7, T2 G11, T3 G8c)". T1 G7 and T3 G8c are
correct; T2's scope check is **G12**. G11 is the unticked-box survivor gate. The real mitigation
exists and fires, so this is a mislabel rather than a missing mitigation -- WARNING, not BLOCKER.
Ruling on F4: the reviser was right that it is out of an aggregate brief, and wrong that it can ride
along. Fix it. One character.

### W2 -- the `:1088` done-criterion was STRENGTHENED to "all SEVEN numbered components" but only FIVE are gated

The edit itself is arithmetically correct:

```
$ awk '/^The block records:/,/^  <\/action>/' <plan> | rg -c '^[0-9]+\. '
7
```

Seven numbered components at `:913-952`. But applying the plan's own question -- "would writing
NOTHING still pass?" -- to each component against the eleven `gate7` calls at `:1044-1057`:

| Component | Gate | Would writing NOTHING pass? |
|---|---|---|
| 1 -- which of the eight items closed, in which commit, by what evidence | none | **YES** |
| 2 -- `requirements_completed` reclassified | G7c/G7d/G7e | no |
| 3 -- 51 to 53 and SIX to FOUR | G7f | no |
| 4 -- audit-completeness finding, 3 parts | G7g/G7h/G7i/G7j | no |
| 5 -- qualitative checkbox note | G7m | no |
| 6 -- the ONE box left unticked | G7k | no |
| 7 -- "11 items across 7 areas" vs "13 items across 8 areas" drift | none | **YES** |

G7b gates task identity, not a component -- which is how eleven `gate7` calls reconcile with
`:907`'s "all ten component checks". Both those numbers are correct; I verified that
`rg -c '^gate7 '` returns 11.

Two consequences:

1. The done-criterion at `:1091` now asserts more than the gates prove. Before the edit it said
   "six", which was equally ungated -- so the edit did not create the gap, it enlarged the claim
   over it.
2. The comment at `:1033-1034` -- "scoping every component gate inside it makes all seven
   non-vacuous by construction" -- is inaccurate: components 1 and 7 have no gate to be
   non-vacuous.

**Cheapest honest fix, zero new gates:** amend `:1033` to say which two components are carried by
prose rather than by a gate. If ONE gate is acceptable instead, component 7 is free and provably
non-vacuous under the existing region scope:

```
$ git grep -n -F -e '11 items across 7 areas' -- .planning/v0.0.2-MILESTONE-AUDIT.md
241:**11 items across 7 areas.** ...
248:"11 items across 7 areas" already disagrees with the frontmatter's 13 items across 8 areas, ...
exit=0
```

File-wide it would be vacuous (present twice already); region-scoped to the NOT-YET-EXISTING
`## Bookkeeping debt closed` section it cannot be -- the same argument the plan already makes for
components 2 and 4.

### W3 -- F3: G5c cannot localize between the row's two citations, AND it is file-wide while its sibling G6 is row-scoped

Ruling on F3: **the documented-but-ungated hole is defensible on the narrow question the brief
poses, but G5c has a second, separable weakness worth one line.**

Applying the plan's own rule literally -- would DELETING the guarded text without a replacement
still pass? Measured: **no.**

```
$ git grep -n -F -e '.planning/research/STACK.md' -- .planning/STATE.md
exit=1                                    <- absent at HEAD, so G5c is NOT vacuous
$ git grep -c -F -e 'research/STACK.md' -- .planning/STATE.md
.planning/STATE.md:1                      <- positive control, exit=0
```

So this is NOT the lc3 `SRV-05` class (that one was satisfiable by deletion). The real weakness is
mis-localization: both citations sit on the SAME line, `STATE.md:445` --

```
$ sed -n '445p' .planning/STATE.md | rg -o 'research/STACK\.md:[0-9,\-]*'
research/STACK.md:16-40
research/STACK.md:75,77
exit=0
$ test -d research ; echo exit=$?
exit=1
$ test -f .planning/research/STACK.md && wc -l < .planning/research/STACK.md
255
```

-- so G5c goes green if the executor corrects the DESCRIPTION's `:16-40` (which Edit B's closing
bullet puts out of scope) and leaves the in-scope OPEN-clause `:75,77` stale. The must_have, which
the diff rewrote at `:33` to name `:75,77` specifically, is therefore enforced only by prose.

Note that row-scoping G5c the way G6 is scoped buys NOTHING for localization here, because both
citations are on the same row. It is still worth doing for a different reason: G5c is currently
satisfiable by the literal appearing anywhere in STATE.md, including a row this task does not own.

**If one gate is affordable,** the pairing the plan uses everywhere else closes it exactly: an
absence gate on the BACKTICK-DELIMITED stale form. The leading backtick is load-bearing -- a bare
`research/STACK.md:75,77` is a SUBSTRING of the corrected `.planning/research/STACK.md:75,77` and
would false-fail after a correct edit. Paired with G5c's presence requirement, deletion is not
sufficient and mis-targeting is caught. **If no gate is affordable,** the prose disclosure the
reviser added is an honest, bounded residue and I do not consider it execution-blocking.

### W4 -- F2: probe 1's expected mismatch is recorded in REVISION-3.md, which the executor never reads

Ruling on F2: **the row IS restated faithfully -- confirmed -- but I CANNOT confirm the executor
will not read the mismatch as its own error.** The mitigation the reviser describes ("I am flagging
the expected outcome so the executor does not read a mismatch as its own error") lives in
`260808-lpt-REVISION-3.md`. The executor reads PLAN.md.

Measured, the mismatch is real:

```
$ rg -n -e '^## Residual notes' .planning/THREAT-MODEL.md
84:## Residual notes
exit=0
$ tail -n +84 .planning/THREAT-MODEL.md | awk 'NR==1{print;next} /^## /{exit} {print}' | rg -c '^- '
7
```

against the row's claim at `STATE.md:445`: "Net resolution: 8 residue rows retained IN the ADR under
`## Residual notes`". Plan `:865-868` says only "Count the bullets under `## Residual notes` against
the eight the row claims were retained" -- no expected value. Contrast probe 3, which DOES pre-warn
about the exit-code trap, and the CORR-05 note at `:305-308`, which pre-warns about the
shape-anchored false zero. Probe 1 is the only probe whose measured outcome is known-mismatching and
left unstated.

**Amplifier, and the reason this is a warning and not a note:** Task 3's scope gate is materially
looser than Task 1's and Task 2's.

```
T1 :378   rg -v '^\.planning/REQUIREMENTS\.md$'
T2 :750   rg -v '^\.planning/(ROADMAP|REQUIREMENTS)\.md$'
T3 :1069  rg -v '^\.planning/'
```

T1 and T2 are tight allowlists. T3 permits ANY file under `.planning/`. So an executor that reads
the 7-vs-8 mismatch as its own error and "fixes" `.planning/THREAT-MODEL.md` -- a file in neither
`files_modified` nor T3's `<files>` -- passes every gate in the plan, silently, inside the task
whose entire purpose is that sealed artifacts must not carry false bookkeeping.

**Fix:** one sentence in probe 1 stating the measured expectation ("MEASURED: 7 bullets against the
row's claimed 8; the mismatch is EXPECTED and is itself a finding for the SUMMARY -- do NOT edit
`.planning/THREAT-MODEL.md`"), and tighten T3's G8c to the allowlist form T1 and T2 already use.

### W5 -- G8's end bound only fires if a `^## ` line follows the per-ID section, and nothing requires one

The bound itself is present and correct in form at `:396` (see CS-6). But its correctness for G8
rests on an unstated precondition about a file that does not exist yet.

```
$ awk '/^<output>/,/^<\/output>/' <plan> | rg -c '^- '
9
```

`<output>` requires `## Per-ID evidence (...)` "at line start" for bullet 1 ONLY. Bullets 2-9
specify no heading level; bullet 4 says merely "under a heading". If the executor writes the
following item as prose or as a `### ` subsection, `/^## /` never fires -- correctly, since
`### Foo` does not match `^## ` -- the region runs to EOF, and both original G8 failure modes
return: G8c/G8d pass on an empty per-ID section, and G8e false-fails on downstream text.

This is the anti-pattern table's own entry -- "a rule carried outside the conditions that made it
safe" -- one level down: the FIX is now conditional on something the plan does not require.

Mitigating, and why this is a warning rather than a blocker: the repo's SUMMARY convention is
uniformly `## ` top-level with `### ` subsections. Checked with `rg -n '^#{1,4} '` across three
existing quick-task SUMMARYs -- all show `## What was done` / `## Verification` / `## Self-Check`
shapes throughout. The precondition will almost certainly hold.

**Fix:** one clause in `<output>` -- "every subsequent item is under its own `## ` heading at line
start, which is what bounds G8's region."

### W6 -- "the earlier draft gated only three of them" is unverifiable from the repo

```
$ git log --oneline -- <plan>
ff21356 wip(260808-lpt): pause mid-revision, with the plan's own residue named
$ git rev-list --count HEAD -- <plan>
1
```

The reviser corrected this claim's UNIT (it read "three of the twelve") and left the count. There is
exactly one commit of the plan, so no earlier draft exists in history and the "three" cannot be
checked by anyone downstream. Not load-bearing -- it is motivational prose for why a gate-per-literal
exists -- but it is the last unmeasurable number in a plan whose thesis is that unmeasurable numbers
rot. Either drop the count or mark it explicitly as un-reconstructable, the same disposition the
plan gives G8.

---

## CONFIRMED SOUND

Each re-derived independently. Exit codes checked; positive controls run on the same path.

### CS-1 -- `:173` and `:385`, "FIRST of NINE in `<output>`": correct, and applied at BOTH sites

```
$ awk '/^<output>/,/^<\/output>/' <plan> | rg -c '^- '
9
$ rg -n -F -e 'FIRST of NINE' <plan>
173:  the MIDDLE of a multi-section file -- the per-ID evidence section is listed FIRST of NINE in
387:# listed FIRST of NINE in <output>, so it is NOT last in the SUMMARY. ...
exit=0
$ rg -n -F -e 'of eight' <plan>
exit=1        <- residue gone; positive control 'FIRST of' returns exit=0 on the same two lines
```

Nine bullets at region lines 6, 9, 11, 12, 14, 15, 17, 18, 21; the per-ID evidence section is the
first of them. No half-applied repeat -- both sites read identically and both are right.

### CS-2 -- `:316`, "one of the SIX sites above": all six line refs resolve at the current tree

```
$ sed -n '55p;107p;116p;137p' 10-VERIFICATION.md
55:  ### #12 CORR-05 -- VERIFIED (was Uncertain)
107: | 3 | RETAIN-05(a)(b)(c): tar.gz disposition, mutual exclusivity, 4-consumer lock | VERIFIED | ...
116: | 12 | CORR-05: `CORR_05_SITES` empty, positive assertion present, ... | VERIFIED | ...
137: Ticked (10): CORR-02, CORR-05, RETAIN-04, RETAIN-05, OBS-03, XOS-06, XOS-07, TRUST-10,
$ sed -n '1004p;1006p' 11-EVIDENCE.md
1004: ## O4 (XOS-04, XOS-05)
1006: **The reservation that stood here through Phase 11 is DISCHARGED by plan 12-06, and converted rather
```

Every one matches the description the plan attaches to it, including `:116`'s `CORR_05_SITES` empty
clause, which the action names as the starting point for CORR-05.

### CS-3 -- `:645-660`, the rewritten "site" unit: the arithmetic closes and the two unpaired literals are named correctly

```
$ rg -c '^p "\$R"' <plan> -> 13      $ rg -c '^a "\$R"' <plan> -> 10
$ rg -c '^p "\$Q"' <plan> -> 6       $ rg -c '^a "\$Q"' <plan> -> 3        total 32
```

Broken out by gate ID from the full listing: G5a..G5i = 9, G6a..G6j = 10, G7a..G7b = 2,
G7c..G7e = 3, G7f..G7i = 4, G13a..G13d = 4. So absence gates = 10 + 3 = **13**; paired presence
gates = 9 + 2 = **11**. Both stated figures hold exactly.

The "`:815` and `:831` each carry TWO literals" claim, measured against the live files:

```
$ git grep -n -F -e '= 51. Source categories' -- .planning/ROADMAP.md                 -> :815
$ git grep -n -F -e 'PARITY 5,'               -- .planning/ROADMAP.md                 -> :815
$ git grep -n -F -e '57 - 51 = 6'             -- .planning/ROADMAP.md                 -> :831
$ git grep -n -F -e '`PARITY-06`, `PARITY-07`, `PARITY-08`' -- .planning/ROADMAP.md   -> :831
$ same three literals on .planning/REQUIREMENTS.md                             -> :789 :791 :790
exit=0 on all
```

Eight distinct ROADMAP lines (800, 808, 815, 816, 828, 830, 831, 832) with 815 and 831 doubled
= 10 gates. Three distinct REQUIREMENTS lines (789, 790, 791) = 3 gates. ELEVEN lines, THIRTEEN
literals -- the header's new unit is exactly what the gates are written in.

The unpaired pair is named correctly. Walking G6a..G6j and G7c..G7e against their G5 / G7a-b
partners by line ref, the only two absence gates with NO same-line presence partner are **G6j
(ROADMAP `:831`)** and **G7e (REQUIREMENTS `:790`)** -- exactly the two the comment names. Their
stated backstops resolve to the right files: G7f targets `$R` (ROADMAP `:831`), G7g targets `$Q`
(REQUIREMENTS `:790`).

The cross-reference to the action is verbatim, not a paraphrase:

```
$ rg -n -F -e 'ELEVEN live lines' <plan>
488:**ELEVEN live lines -- EIGHT in ROADMAP.md and THREE in REQUIREMENTS.md -- carrying THIRTEEN stale
652:# (G7c..e): thirteen absence gates for thirteen literals, matching the "ELEVEN live lines ...
exit=0
```

### CS-4 -- `:1088`, "all SEVEN numbered components": the count is correct

Seven numbered items at plan `:913`, `:915`, `:928`, `:930`, `:936`, `:947`, `:949`. The ARITHMETIC
of this edit is right; see W2 for the separate gating question.

### CS-5 -- `:591-606`, the checkbox census: both anchors correct, and the per-class figures really are unchanged

```
$ git grep -c -F -e '- [ ]' c84ebd5 -- .planning ':!.planning/milestones' ':!.planning/quick' ':!.planning/ROADMAP.md'
   -> 20 files, sum 102
$ git grep -c -F -e '- [ ]' ff21356 -- <same pathspec>
   -> 22 files, sum 109
$ diff <c84ebd5 census, rev prefix stripped> <ff21356 census, rev prefix stripped>
0a1,2
> .planning/.continue-here.md:6
> .planning/HANDOFF.json:1
exit=1
```

The delta is EXACTLY the two transient handoff artifacts, 6 + 1 = 7, and 102 + 7 = 109. Every other
line is byte-identical between the two censuses -- a stronger proof of "every per-class figure is
unchanged" than re-summing the classes. Re-summed anyway from the `c84ebd5` output:
`.planning/research/` 10 + 8 + 17 = **35 in 3 files**; phase `*-RESEARCH.md` 5 + 3 + 10 + 7 + 5 =
**30 in 5 files**; `PROJECT.md` **7 in 1 file**; `12-01-SUMMARY.md` **3**; remainder
1+1+1+1+2+5+1+3+2+4 = **21**; REQUIREMENTS.md 9, so 102 - 9 = **93 across 19** once Task 1 lands.
All six figures hold. Anchoring rather than replacing was the right call.

### CS-6 -- the G8 region-bound fix (committed at `ff21356`): all three gates bounded, and the rule entry describes what they do

```
$ rg -n -F -e "awk 'NR==1{print;next}" <plan>
169:  `| awk 'NR==1{print;next} /^## /{exit} {print}'`.       <- the gate_design_rules entry
396:EV=$(tail -n +"$EN" "$SUM" | awk 'NR==1{print;next} /^## /{exit} {print}')      <- T1 G8
986:REGION=$(tail -n +"$LN" "$V" | awk 'NR==1{print;next} /^## /{exit} {print}')    <- T3 G1
1042:NOTE=$(tail -n +"$AN" "$A" | awk 'NR==1{print;next} /^## /{exit} {print}')     <- T3 G7
$ rg -n -F -e 'tail -n +' <plan>   -> the same 3 executable lines, plus :162 (prose only)
exit=0
```

No unbounded region survives in an executable gate. Every measured number in the rule entry
(`:160-182`) is EXACT:

```
$ rg -n -e 'Human Verification Closed' 08-VERIFICATION.md      -> 11, 56, 343   (three, as claimed)
$ rg -n -e '^## Human Verification Closed' 08-VERIFICATION.md  -> 343 alone
$ tail -n +11  08-VERIFICATION.md | wc -l                      -> 376
$ tail -n +343 08-VERIFICATION.md | wc -l                      -> 44
$ tail -n +343 08-VERIFICATION.md | awk '<bound>' | wc -l      -> 44   (exact no-op, as claimed)
$ tail -n +87  08-VERIFICATION.md | wc -l                      -> 300
$ tail -n +87  08-VERIFICATION.md | awk '<bound>' | wc -l      -> 35   (300 to 35, as claimed)
```

And the two Task 3 anchors are genuinely ABSENT at HEAD -- so the region gates are non-vacuous --
each with a positive control on the same path, and each target section will be appended after the
file's current last `## `:

```
$ rg -n -e '^## Human Verification Closed' 12-VERIFICATION.md -> exit=1
$ rg -n -e '^## Goal Achievement'          12-VERIFICATION.md -> 37, exit=0     (positive control)
$ rg -n -e '^## Bookkeeping debt closed'   MILESTONE-AUDIT.md -> exit=1
$ rg -n -e '^## Tech Debt Summary'         MILESTONE-AUDIT.md -> 239, exit=0    (positive control)
last '## ' in 12-VERIFICATION.md: 37 of 161 lines ; in MILESTONE-AUDIT.md: 256 of 269 lines
```

The rule entry's own summary -- "all three region gates in this plan use it" -- is accurate.

### CS-7 -- `:919`, the 30 REQ-IDs attribution: accurate to what the audit actually says

The plan quotes the audit verbatim, and the audit's wording is exactly that:

```
$ git grep -n -F -e '30 of the 51' -- .planning/v0.0.2-MILESTONE-AUDIT.md
24: - "SUMMARY.md `requirements_completed` frontmatter absent for 30 of the 51 roadmapped REQ-IDs
     (all of Phase 7, all of Phase 8, all of Phase 9), so the audit's third cross-reference source is
     structurally non-discriminating on this project"
131: manually)**. That row fires for 30 of the 51 IDs -- but not because the work is unconfirmed. This
exit=0
```

The counter-measurement that justifies attributing rather than re-asserting also holds:

```
$ git grep -c -E '^\| [A-Z]+-[0-9]+ \| Phase [789] \|' -- .planning/ROADMAP.md      -> 22   (7 + 7 + 8)
$ git grep -c -E '^\| [A-Z]+-[0-9]+ \| Phase [789] \|' -- .planning/REQUIREMENTS.md -> 27   (7 + 9 + 11)
$ git grep -c -E '^\| [A-Z]+-[0-9]+ \| Phase ' -- both  -> ROADMAP 51, REQUIREMENTS 57
exit=0 on all
```

30 matches neither 22 nor 27, and ROADMAP Phase 8 (7 rows) vs REQUIREMENTS Phase 8 (9 rows)
confirms the "22 to 24 after Task 2" second-order note. Attribution is the right disposition and
the quote is faithful.

### CS-8 -- the must_haves rewrite at `:33`: the "TWO citations" claim is exact

```
$ sed -n '445p' .planning/STATE.md | rg -o 'research/STACK\.md:[0-9,\-]*'
research/STACK.md:16-40      <- in the description
research/STACK.md:75,77      <- in the OPEN clause
exit=0
```

Two, at the two claimed locations. The gating consequence is W3.

### CS-9 -- hygiene and structure

```
$ rg -c '[^\x00-\x7F]' <plan>   -> exit=1   (ASCII only; positive control 'MEASURED' -> 27, exit=0)
$ node gsd-tools.cjs query verify.plan-structure <plan>
   valid: true, errors: [], warnings: [], task_count: 3,
   all four elements present on all three tasks, exit=0
$ git status --porcelain
 M .planning/quick/260808-lpt-.../260808-lpt-PLAN.md
?? .planning/quick/260808-lpt-.../260808-lpt-REVISION-3.md
```

Nothing outside the quick-task directory is touched. I edited nothing and committed nothing.

---

## THE DRY-RUN SPLIT -- re-run independently

The 32 gate lines were extracted VERBATIM from the plan and checked byte-identical, then sourced
with reporting helpers substituted for the exiting ones. `R` and `Q` point at the UNEDITED
`.planning/ROADMAP.md` and `.planning/REQUIREMENTS.md`; `git status --porcelain` confirms neither
file is modified in the working tree.

```
$ rg -N '^(p|a) "\$[RQ]"' <plan> > gates32.txt          -> 32 lines
$ rg -N '^(p|a) "\$[RQ]"' <plan> | md5sum ; md5sum < gates32.txt
af0319b35db1ad77b1954e590f13f9bd   (identical -- extraction is byte-faithful)
$ bash dryrun.sh
fail  G5a .. G5i     (9  reconciliation, ROADMAP presence)
fail  G6a .. G6j     (10 reconciliation, ROADMAP absence)
fail  G7a .. G7e     (5  reconciliation, REQUIREMENTS)
PASS  G7f G7g G7h G7i    (survival)
PASS  G13a G13b G13c G13d (survival)

PASS=8 fail=24 total=32
```

**PASS=8 / fail=24.** Identical to the required split. The 8 passing are exactly the survival gates
(`G7f..G7i`, `G13a..G13d`); the 24 failing are exactly the reconciliation gates. Revision 3's edits
touched the COMMENT block above the gates and no gate line -- proven by the byte-identical
extraction, not asserted.

---

## Disposition

| Finding | Class | In the diff? | Fix size |
|---|---|---|---|
| B1 stale `c84ebd5..HEAD` baseline | BLOCKER | adjacent -- created by the pause commit the diff itself anchors against | one token, twice |
| B2 T-lpt-03 false blanket claim | BLOCKER | the CONTRADICTION was created by the diff | one sentence |
| W1 T-lpt-05 cites G11, not G12 | WARNING | no (F4) | one character |
| W2 SEVEN components, five gated | WARNING | yes (`:1088`) | one clause, or one free gate |
| W3 G5c cannot localize | WARNING | yes (`:33`, `:851`) | one gate, or accept as residue |
| W4 probe 1 expectation unstated, plus loose T3 scope gate | WARNING | no (F2) | one sentence, one allowlist |
| W5 G8 bound needs a `^## ` terminator | WARNING | no (committed at `ff21356`) | one clause in `<output>` |
| W6 "three of them" unverifiable | WARNING | yes (`:643`) | drop the count |

Nothing I measured contradicts the settled list in `HANDOFF.json` `blockers[0]`. Every settled item
I incidentally re-touched -- the 4-ID difference set, the 13 absence literals each matching exactly
one line, the historical 51 at `ROADMAP.md:825` surviving via G13c, G11a as the sole legitimate
survivor -- measured consistent with it.

Two blockers, both one-line prose corrections, neither requiring a new gate. The operator's
"resist further hardening" instruction is compatible with fixing all eight findings: only W2 and W3
would add a gate at all, and both have a no-new-gate option.

The pattern across both blockers is the one this task keeps rediscovering: the reviser measured what
it was asked to measure and did not sweep the SECOND-ORDER consequence. B1 is a number corrected in
one place and left stale in the two places it is executed. B2 is a scope disclosure added in one
place and left contradicted in the security artifact. Neither is a measurement error. Both are
half-applied corrections -- the same shape as the defect that opened this iteration's brief.
