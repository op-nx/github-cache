# Quick Task 260809-iqe: Amend the ROBUST-04 capture with the four reviewed corrections - Context

**Gathered:** 2026-08-09
**Status:** Ready for planning
**Discussion mode:** `--auto` (gray areas auto-locked, each rated IMPACT x CONFIDENCE per CLAUDE.md)

<domain>
## Task Boundary

Apply four specified edits to `.planning/todos/pending/robust-04-all-restore-miss-clause-is-false.md`
-- the one remaining task recorded in `.planning/HANDOFF.json` as the tail of quick `260809-hcr`.

This is the edit that a two-agent review left standing AFTER it rejected the correction the previous
session proposed. The rejected correction was an amendment to `.planning/REQUIREMENTS.md`; that
rejection is settled and is a hard constraint below, not a gray area.

Docs-only. ONE file. No source, no tests, no CI.

</domain>

<decisions>
## Implementation Decisions

### The four edits (LOCKED -- specified verbatim in HANDOFF.json, not re-derived here)

1. **Fix the present tense that flatters the past.** Line ~27 says a drifted run "would actually show
   ... the PROPORTIONAL branch". Before commit `aee017c` (today) there was NO partial branch at all,
   so drift was FULLY runtime-silent for the requirement's entire life, 2026-07-26 to 2026-08-09.
2. **Record that NO drift was actually shipped in the window.** The two-week gap was LATENT and
   UNREALISED. Without this a reader assumes harm that did not occur.
   *(Supporting figures NOT locked -- see the trap-quadrant item below.)*
3. **DELETE the closure claim.** Do NOT write that the gap "is now closed" or "is now surfaced by the
   proportional branch". FALSE; refuted independently by both reviewers for two different reasons.
4. **Add what IS established.** Under drift the proportional warning is SILENT mid-month, and at
   shard rollover it fires but MISATTRIBUTES the cause -- it names only cache-version rotation and
   the token's read scope as candidates. Both are bad; neither is closure.

Plus the reword flagged by the reviewers: "the mirror silently stops receiving anything" is literally
false, because the publish leg's own synthetic seed does upload. Reword to "receives only its own
synthetic seed" / "stops receiving real cache content".

### Edit shape: in-place for the false sentence, new sections for the new material

IMPACT low-medium. CONFIDENCE high. Auto-locked.

In-place rewriting is correct HERE and was refused for `REQUIREMENTS.md` for a reason that does not
transfer: this capture is in `todos/pending`, is NOT a milestone artifact, and is NOT frozen. The
whole purpose of the file is to be the accurate record of a false claim; leaving the false framing
in place and appending a contradiction would reproduce the defect it documents.

### Frontmatter provenance

IMPACT low. CONFIDENCE high. Auto-locked. Add `amended: 2026-08-09` and `amended_by: quick 260809-iqe`
so a reader can tell the corrected text from the original capture without a git blame.

### Filing the misattribution as its own follow-up: OUT OF SCOPE

IMPACT medium. CONFIDENCE high. Auto-locked OUT.

The integrity critic recommended the misattribution become its own follow-up rather than be folded in
as a closure. The maintainer was offered exactly that (option 2: apply the edit AND file the defect)
and chose option 1 -- the edit alone. So it is not filed here. It must NOT be silently dropped
either: the capture records that it is an open, unfiled, consumer-facing defect of the same species
as the `docs/advanced.md` one that `260809-hcr` fixed.

### Claude's Discretion

Section ordering, headings, and prose within the file. Whether the "Note on scope" and "Related"
sections need touching to stay consistent with the corrected body.

</decisions>

<unresolved>
## Trap quadrant -- NOT auto-locked, routed to measurement

**Edit 2's supporting figures are HIGH-IMPACT and NOT-HIGH-CONFIDENCE.** They are: "nine commits
touched `start-cache-server/index.js` since 2026-07-26"; "each paired with the source change that
required it"; "the unpaired commits to bundled sources are spec files or comment-only (`f6c91fd`),
and esbuild strips comments"; "no `action-bundle-drift` catch is recorded anywhere in `.planning`".

They originate with the previous session's orchestrator -- whose claims in THIS EXACT AREA were
falsified SIX times in a single session, every time by an agent RE-DERIVING from source, and NOT ONCE
by the agent that wrote them. `HANDOFF.json` says so itself and extends the warning to its own
contents. Writing an unverified count into a permanent capture is precisely that failure mode.

This is resolvable by measurement rather than by decision, so it is NOT parked as a blocker: the
research step re-derives every figure from git history before the planner may state it. Any figure
that does not survive re-derivation is corrected to what the history shows, or the sentence is
rewritten to drop the number. The QUALITATIVE claim -- the gap was latent and unrealised -- stands or
falls with that evidence too.

</unresolved>

<constraints>
## Hard constraints

- **DO NOT touch `.planning/REQUIREMENTS.md`.** Two independent reviewers concluded unanimously
  against it; the decision was already made earlier the same day in commit `9251809`, and the
  proposal to reverse it offered no changed circumstance. ROBUST-04's checkbox STAYS TICKED --
  legitimately, since its traceability cell at `:736` carries no discharge evidence and nothing
  anywhere cites the all-MISS warning as proof the requirement was met.
- **DO NOT write that the drift gap is "closed"** or "now surfaced by the proportional branch".
- **DO NOT merge anything** -- not v0.0.2, not PR #16, not any branch. Standing and absolute until
  the maintainer says otherwise.
- **XOS-05 at `REQUIREMENTS.md:759` is NOT a precedent** for an inline correction, in two independent
  ways (its supersession lives in the traceability status cell, not the requirement body; and it
  re-discharged a claim that was never false). Do not borrow its legitimacy.
- Single file. No source changes, no test changes, no CI changes.

</constraints>

<canonical_refs>
## Canonical References

- `.planning/HANDOFF.json` -- the four edits, the two established claims (C1, C2), the four refuted
  claims, and the context note about six falsifications.
- `.planning/.continue-here.md` -- the same constraints in checklist form.
- `.planning/todos/pending/robust-04-all-restore-miss-clause-is-false.md` -- the file being amended.
- `packages/github-cache/src/lib/publish-mirror.ts` -- the proportional-warning branch and its
  two named candidate causes; commit `aee017c` introduced it today.

</canonical_refs>
