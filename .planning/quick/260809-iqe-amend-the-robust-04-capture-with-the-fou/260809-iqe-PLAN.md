---
phase: quick-260809-iqe
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/todos/pending/robust-04-all-restore-miss-clause-is-false.md
autonomous: true
requirements: []   # quick task -- no ROADMAP requirement IDs. ROBUST-04 is the SUBJECT of the capture, not a requirement this plan discharges. REQUIREMENTS.md is untouched by hard constraint.
gap_closure: false

must_haves:
  truths:
    - "The capture states in the PAST tense that drift was fully runtime-silent for the requirement's entire life, 2026-07-26 to 2026-08-09 -- no partial branch existed before 2026-08-09."
    - "The capture states that no drift was actually shipped in that window, and the evidence it gives is the byte-identity build measurement, not a commit-counting or CI-silence argument."
    - "The capture contains no assertion that the drift gap has been resolved by the proportional branch."
    - "The capture states the mid-month silence as the EXPECTED behaviour with its enumeration-order caveat, and states that at month-shard rollover the warning fires but misattributes the cause."
    - "The capture records the misattribution as an open, UNFILED, consumer-facing defect."
    - "Every factual claim in the amended file traces to a verdict in 260809-iqe-RESEARCH.md (C-A through C-H)."
  artifacts:
    - ".planning/todos/pending/robust-04-all-restore-miss-clause-is-false.md -- amended, frontmatter carrying amended and amended_by"
  key_links:
    - "Frontmatter provenance (amended / amended_by) distinguishes corrected text from the original capture without a git blame."
    - "The verbatim REQUIREMENTS.md block quote at the top stays byte-unchanged; the correction of its wording is stated as prose, not by rewriting the quotation."
    - "Exactly one tracked file differs from HEAD when the plan completes; .planning/REQUIREMENTS.md is not among them."
---

<objective>
Amend one unfrozen capture file with four reviewed corrections, using only figures a forensic
re-derivation confirmed.

Purpose: the capture exists to be the accurate record of a false claim. It currently carries a
present-tense sentence that flatters the past, omits that the two-week gap was latent and
unrealised, and reproduces a phrase that is literally false. Leaving those in place reproduces the
defect the file documents.

Output: `.planning/todos/pending/robust-04-all-restore-miss-clause-is-false.md`, amended.
</objective>

<execution_context>
@~/.claude/gsd-core/workflows/execute-plan.md
</execution_context>

<context>
@.planning/quick/260809-iqe-amend-the-robust-04-capture-with-the-fou/260809-iqe-RESEARCH.md
@.planning/quick/260809-iqe-amend-the-robust-04-capture-with-the-fou/260809-iqe-CONTEXT.md
@.planning/todos/pending/robust-04-all-restore-miss-clause-is-false.md
@.planning/HANDOFF.json
</context>

<precedence>
RESEARCH.md OUTRANKS HANDOFF.json wherever they disagree, and they disagree substantially.
HANDOFF.json supplies WHICH four edits to make; RESEARCH.md supplies the figures each edit may
state. Do not lift a supporting figure from HANDOFF.json.

Each RESEARCH claim (C-A .. C-H) ends with a "Wording the amendment may use" line. Those lines are
pre-verified. Lift them rather than composing new prose, which would need re-verifying. Any
sentence that cannot be traced to a RESEARCH verdict does not go in the file.

RESEARCH's `## Figures the amendment MUST NOT state` is a hard blocklist. Task 3's verify block
enumerates it as runnable negative gates -- read that block BEFORE writing prose, not after.

Do not touch `.planning/REQUIREMENTS.md`. Its ROBUST-04 checkbox stays ticked. Do not merge
anything. One file, docs-only.
</precedence>

<tasks>

<task type="auto">
  <name>Task 1: Correct the frontmatter and the two false sentences in place</name>
  <files>.planning/todos/pending/robust-04-all-restore-miss-clause-is-false.md</files>
  <action>
Add two frontmatter keys after the existing ones: `amended: 2026-08-09` and
`amended_by: quick 260809-iqe`. Leave the existing keys as they are.

Replace the sentence at the end of the "Why" section that predicts, in the present conditional,
what a drifted run would show via the PROPORTIONAL branch. That framing is wrong for the entire
period the file is about. Rewrite it in the past tense from RESEARCH C-E's approved wording: before
2026-08-09 there was no partial branch at all, so drift was fully runtime-silent for the
requirement's entire life, 2026-07-26 to 2026-08-09. When citing a commit for the partial branch's
introduction, cite `e78a842` (2026-08-09 03:06:52) -- `aee017c` GATED an already-existing branch on
a Wilson lower bound hours later. Citing the date alone is also acceptable. Do not attribute the
introduction to `aee017c` in any word order (gated in verify).

Correct the "stops receiving anything" phrasing, which is literally false, per RESEARCH C-H. Do NOT
edit the block quote of REQUIREMENTS.md at the top of the file -- it is a verbatim quotation and
mangling it would be a new defect of the same species. Instead state the correction as prose in the
"Why" section: under drift the shard stops receiving real cache CONTENT; it is not empty, because
the publish leg seeds and mirrors its own synthetic entry in the same job through the `dist/`-built
internal action that bundle drift cannot touch -- and that single mirrored entry is the same fact
that keeps the all-restore-MISS gate silent, since the gate requires `mirrored === 0`. C-H is
explicit that a correction cannot assert both "receives nothing" and "the seed mirrors": they are
one event read twice.

Wherever the source file is referenced, the path is `packages/github-cache/src/publish/publish-mirror.ts`.
The `src/lib/` form in CONTEXT.md does not exist on disk (gated in verify).
  </action>
  <verify>
    <automated>F=.planning/todos/pending/robust-04-all-restore-miss-clause-is-false.md; rg -c -F 'ROBUST-04' "$F" >/dev/null || { echo "CONTROL FAILED -- search is not reaching the file; every result below is meaningless"; exit 1; }; for n in 'amended: 2026-08-09' 'amended_by: quick 260809-iqe' 'e78a842' 'src/publish/publish-mirror.ts' 'synthetic entry'; do rg -q -F -- "$n" "$F" || { echo "MISSING: $n"; exit 1; }; done; rg -U -q -i 'real\s+cache\s+content' "$F" || { echo "MISSING: C-H reword -- new-content anchor absent"; exit 1; }; for p in 'aee017c\s+introduced' 'would\s+actually\s+show' 'src/lib/publish-mirror'; do rg -U -q -i -- "$p" "$F"; rc=$?; [ "$rc" -eq 1 ] || { echo "BLOCKED or SEARCH ERROR (rc=$rc): $p"; exit 1; }; done; echo TASK1-OK</automated>
  </verify>
  <done>Frontmatter carries both provenance keys. The conditional-future sentence is gone, replaced by a past-tense statement of full runtime silence over 2026-07-26 to 2026-08-09 citing `e78a842` or the date. The C-H reword is present as prose and the REQUIREMENTS.md block quote is byte-unchanged. Only the real source path appears.</done>
</task>

<task type="auto">
  <name>Task 2: Add the latent-and-unrealised finding, the established mechanism, and the unfiled defect</name>
  <files>.planning/todos/pending/robust-04-all-restore-miss-clause-is-false.md</files>
  <action>
Add three new sections. Heading text and ordering are yours; the content is not.

FIRST -- that no drift actually shipped in the window, so a reader does not assume harm that did
not occur. The evidence is RESEARCH C-C's byte-identity measurement, which is a direct measurement
rather than an argument: forty-seven commits after the last rebuild (`501bcb1`, 2026-08-04), a
fresh build at HEAD still reproduces the committed `start-cache-server/index.js` byte for byte.
Support it with C-A (nine commits rebuilt the bundle in the window `969de3e..HEAD`) and C-B, whose
correct form is that EIGHT of the nine paired with the source change that required them, the ninth
being `db577db`, a lockfile re-resolution of `undici` 6.27.0 to 6.28.0 that staged the rebuilt
bundle in the same commit. Describe the seven commits that touched a bundled source without
rebuilding as comment-only; do not characterise them any other way (gated in verify). Carry C-C's
residual honestly: the byte-identity proof directly covers only the two unpaired commits after
`501bcb1`; for the earlier five the argument is the comment-only classification plus the strip
behaviour those two demonstrate, and any transient staleness would have been absorbed by the next
paired rebuild.

Two arguments are forbidden in this section, and RESEARCH C-D refutes both -- read it before you
write. The first is any claim that `.planning` holds no record of a drift catch: Phase 7's Q10 catch
appears in five places and sits INSIDE the window. The second is any appeal to the CI gate having
stayed quiet on the relevant commits: C-D establishes that the gate had no opportunity to evaluate
`db577db` or any of the seven unpaired commits, so its quiet is compatible with drift and is not
evidence of cleanliness. Do not restate either argument in ANY wording -- Task 3 gates them as
concepts, not as single sentences. If the drift history is worth a sentence, state C-D's true one:
the guard has fired once in this window, on 2026-07-27, and the rebuild was staged in the same
commit.

SECOND -- what IS established about how drift surfaces now, from C-G and C-F. Under drift the
proportional warning is silent for most of the month: an entry already in the month shard is
skipped before any restore is attempted (`publish-mirror.ts:635`), counted into `alreadyPresent`
rather than `readMisses`, so it stays in the warning's denominator -- the full enumeration -- and
leaves its numerator. Carry C-G's caveat: the skip is guarded on a shard that resolves only after
the first restore HIT, so the outcome is enumeration-order dependent and order is pinned nowhere.
Write the mid-month silence as the EXPECTED behaviour, never as a certainty. At month-shard
rollover the shard is empty, nothing can be skipped, and the warning fires -- naming only two
candidate causes, a cache-version rotation in the commit range and the runtime token's
Actions-cache read scope (`publish-mirror.ts:895-902`), with the comment at `:866` directing the
reader to treat the branch as the live rotation signal. Bundle drift is neither, so drift surfaces
as a warning pointing at a cause that did not occur. When lifting C-F's approved wording, stop at
that point -- its trailing clause about the message's omission contains a blocklisted token (see
Task 3's verify). State plainly that both outcomes are bad and that neither resolves the gap.

THIRD -- record the misattribution as an OPEN, UNFILED, consumer-facing defect of the same species
as the `docs/advanced.md` one that quick `260809-hcr` fixed. The maintainer was offered filing it
as a separate follow-up and chose the edit alone, so it is deliberately not filed here -- and it
must not be silently dropped either. Note while there that `publish-mirror.ts` is not in the action
bundle's 18-file input set: the drifting artifact and the warning that misattributes it are in
different graphs entirely (C-F).

Reconcile the existing "Note on scope" and "Related" sections with the corrected body. Their
substance is unaffected -- keep the statement that the requirement's checkbox should not be
un-ticked on the strength of this -- but do not leave them contradicting anything you added.
  </action>
  <verify>
    <automated>F=.planning/todos/pending/robust-04-all-restore-miss-clause-is-false.md; rg -c -F 'ROBUST-04' "$F" >/dev/null || { echo "CONTROL FAILED -- every result below is meaningless"; exit 1; }; for n in 'byte for byte' 'db577db' 'undici' '501bcb1' '969de3e' 'alreadyPresent' 'publish-mirror.ts:635' '895-902' ':866'; do rg -q -F -- "$n" "$F" || { echo "MISSING: $n"; exit 1; }; done; for p in 'eight\s+of\s+the\s+nine' 'comment[- ]only'; do rg -U -q -i -- "$p" "$F" || { echo "MISSING: $p"; exit 1; }; done; for n in 'unfiled' 'misattribut'; do rg -q -iF -- "$n" "$F" || { echo "MISSING: $n"; exit 1; }; done; rg -U -q -i 'alreadyPresent[\s\S]{0,120}readMisses' "$F" || { echo "MISSING: the C-G mechanism must contrast alreadyPresent against readMisses -- a bare readMisses mention already exists pre-edit and proves nothing"; exit 1; }; rg -U -q -i 'same\s+species[\s\S]{0,300}docs/advanced\.md' "$F" || { echo "MISSING: the unfiled defect must be tied to the docs/advanced.md precedent -- a bare docs/advanced.md mention already exists pre-edit in Related and proves nothing"; exit 1; }; rg -U -q -i 'silent\s+for\s+most\s+of\s+the\s+month[\s\S]{0,900}enumeration[- ]order' "$F" || { echo "MISSING: the silence claim must carry its enumeration-order caveat within the same passage"; exit 1; }; echo TASK2-OK</automated>
  </verify>
  <done>All three sections exist. The no-drift-shipped finding rests on the byte-identity measurement with the nine/eight-of-nine/db577db support and carries C-C's residual. The mechanism section states mid-month silence as expected with the enumeration-order caveat, and rollover as fires-and-misattributes. The misattribution is recorded as open and unfiled. "Note on scope" and "Related" do not contradict the new body.</done>
</task>

<task type="auto">
  <name>Task 3: Run the blocklist sweep and the single-file scope gate</name>
  <files>.planning/todos/pending/robust-04-all-restore-miss-clause-is-false.md</files>
  <action>
Run the two gates below against the finished file and fix any hit by rewriting the offending
sentence -- never by weakening a gate.

The first gate is the point of this task. RESEARCH's blocklist is what the amendment exists to
avoid; a check that only confirms the new text is present would pass over a file still carrying a
refuted claim. Every needle below is drawn from that blocklist, plus the two-word terms are matched
with `-U` and `\s+` because `rg` is line-oriented and markdown hard-wraps -- a term split across a
newline would otherwise read as a clean pass. The positive control runs first for the same reason:
a typo'd path or a broken pattern exits 2 with no match lines, which is indistinguishable from
absence if only the output is read.

Two of the needles are single tokens on purpose. The task's central prohibition is the claim that
the gap has been resolved, and a multi-word phrasing of it is unbounded -- so the file must simply
not use either token, in any sense. If a legitimate sentence trips one, rephrase the sentence.

Three of the patterns block the CI-silence argument rather than one sentence expressing it.
RESEARCH C-D forbids the argument itself, in any wording, so gating only the exact phrasing
`HANDOFF.json` used would let a paraphrase through. Task 2's approved sentence about the guard
having fired once in this window does not trip any of them.

Each negative gate discriminates on the exit code instead of chaining on a bare success: `rg`
returns 1 for a genuine no-match and 2 for a malformed pattern, and a `&&` chain treats both as
clean -- which is the exact false-negative class this repo has already been burned by. Anything
other than 1 fails the gate.

The second gate enforces the scope constraint: exactly one tracked file may differ from HEAD, and
`.planning/REQUIREMENTS.md` may not be among them.
  </action>
  <verify>
    <automated>F=.planning/todos/pending/robust-04-all-restore-miss-clause-is-false.md; rg -c -F 'ROBUST-04' "$F" >/dev/null || { echo "CONTROL FAILED -- every result below is meaningless"; exit 1; }; for n in 'closed' 'closure' '0.3746' '52/112' '46%' 'src/lib/publish-mirror'; do rg -q -iF -- "$n" "$F"; rc=$?; [ "$rc" -eq 1 ] || { echo "BLOCKED or SEARCH ERROR (rc=$rc, literal): $n"; exit 1; }; done; for p in 'spec\s+files?' 'catch\s+is\s+recorded' 'each\s+paired' 'each\s+of\s+the\s+nine' 'now\s+surfaced' 'aee017c\s+introduced' 'would\s+actually\s+show' 'no\s+runs?\b' 'never\s+(ran|flagged|caught|evaluated)' 'silence\s+(of|proves|is\s+not)'; do rg -U -q -i -- "$p" "$F"; rc=$?; [ "$rc" -eq 1 ] || { echo "BLOCKED or SEARCH ERROR (rc=$rc, pattern): $p"; exit 1; }; done; echo BLOCKLIST-CLEAN</automated>
    <automated>MOD=$(git diff HEAD --name-only); [ "$MOD" = ".planning/todos/pending/robust-04-all-restore-miss-clause-is-false.md" ] || { echo "SCOPE VIOLATION -- changed: $MOD"; exit 1; }; echo SCOPE-OK</automated>
  </verify>
  <done>Both automated gates print their OK line and exit 0. No blocklisted figure, path, refuted argument, or resolution token survives in the file, and exactly one tracked file differs from HEAD.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| (none) | Docs-only change to one markdown file under `.planning/`. No source, test, CI, or dependency input is touched, so no runtime trust boundary is crossed or moved. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-iqe-01 | Repudiation | the amended capture | low | mitigate | Frontmatter `amended` / `amended_by` keys make the corrected text distinguishable from the original capture without a git blame (Task 1). |
| T-iqe-02 | Tampering | scope of the change | low | mitigate | Task 3's scope gate asserts exactly one tracked file differs from HEAD, which is what keeps the frozen `REQUIREMENTS.md` out of the diff. |
| T-iqe-SC | Tampering | package installs | n/a | accept | No package-manager install occurs in this plan; no legitimacy audit is required. |
</threat_model>

<verification>
1. Task 1's automated gate passes (`TASK1-OK`).
2. Task 2's automated gate passes (`TASK2-OK`).
3. Task 3's blocklist sweep passes (`BLOCKLIST-CLEAN`) and its scope gate passes (`SCOPE-OK`).
4. Manual read-through: every factual sentence in the amended file maps to a RESEARCH claim ID
   (C-A .. C-H). Any sentence that does not is removed.
</verification>

<success_criteria>
- `.planning/todos/pending/robust-04-all-restore-miss-clause-is-false.md` is the only tracked file
  changed, and `.planning/REQUIREMENTS.md` is untouched.
- The capture reads in the past tense about a window in which drift was fully runtime-silent, and
  states that the gap was latent and unrealised on the strength of the byte-identity measurement.
- No resolution claim, no refuted supporting figure, and no nonexistent path survives in the file.
- The mid-month silence is stated as expected rather than certain; the rollover behaviour is stated
  as fires-and-misattributes; the misattribution is on record as an open, unfiled defect.
- Nothing is merged.
</success_criteria>

<output>
Create `.planning/quick/260809-iqe-amend-the-robust-04-capture-with-the-fou/260809-iqe-SUMMARY.md` when done.
</output>
