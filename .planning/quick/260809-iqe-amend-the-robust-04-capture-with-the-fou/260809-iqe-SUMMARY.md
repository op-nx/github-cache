---
phase: quick-260809-iqe
plan: 01
subsystem: planning-artifacts
tags: [docs, capture-correction, robust-04, action-bundle-drift]
status: complete
requires: []
provides:
  - "An accurate ROBUST-04 capture whose every factual claim traces to a re-derived verdict"
affects:
  - .planning/todos/pending/robust-04-all-restore-miss-clause-is-false.md
tech-stack:
  added: []
  patterns: []
key-files:
  created: []
  modified:
    - .planning/todos/pending/robust-04-all-restore-miss-clause-is-false.md
decisions:
  - "Cite `e78a842` for the partial branch's introduction, not `aee017c`, which only gated an already-existing branch."
  - "Drop the 'spec files' half of the unpaired-commit claim entirely rather than repair it -- it has no referent."
  - "Support 'no drift shipped' with the byte-identity build measurement, never with a CI-silence argument."
  - "Skip the GSD per-plan tracking handlers for this quick task; they would corrupt phase counters that a quick task does not own."
metrics:
  duration: ~25 min
  completed: 2026-08-09
---

# Quick Task 260809-iqe: Amend the ROBUST-04 capture Summary

Amended one unfrozen capture file with four reviewed corrections, using only figures that a
forensic re-derivation confirmed -- past-tense runtime silence, the literally false
"stops receiving anything" phrase, the no-drift-shipped finding on a byte-identity measurement,
and the rollover misattribution recorded as an open unfiled defect.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Correct the frontmatter and the two false sentences in place | `06ccf16` | `.planning/todos/pending/robust-04-all-restore-miss-clause-is-false.md` |
| 2 | Add the latent-and-unrealised finding, the mechanism, and the unfiled defect | `06ccf16` | same |
| 3 | Run the blocklist sweep and the single-file scope gate | `06ccf16` | same |

All three tasks edit one file, so they landed in a single atomic commit rather than three.

## What Changed

**Frontmatter.** Added `amended: 2026-08-09` and `amended_by: quick 260809-iqe` after the
existing keys. Existing keys untouched.

**"Why" section.** Replaced the present-conditional sentence predicting what a drifted run
would show via the proportional branch with two past-tense paragraphs: the C-H correction
(the shard stops receiving real cache content but is not empty, because the publish leg seeds
and mirrors its own synthetic entry through the `dist/`-built internal action -- stated as one
event, not two, per C-H's explicit warning), and the C-E statement that before 2026-08-09 there
was no partial branch at all, so drift was fully runtime-silent for the requirement's entire
life, 2026-07-26 to 2026-08-09.

**Three new sections.**
1. *No drift was actually shipped in that window* -- the byte-identity measurement (a fresh
   build at HEAD reproduces the committed bundle byte for byte, 47 commits after `501bcb1`),
   supported by C-A's nine commits and C-B's corrected eight-of-nine with `db577db` as the
   `undici` lockfile re-resolution, the seven unpaired commits described as comment-only, and
   C-C's residual carried explicitly.
2. *What is established about how drift surfaces from 2026-08-09 onward* -- C-G's mechanism
   (`publish-mirror.ts:635` skip, `alreadyPresent` versus `readMisses`, full-enumeration
   denominator) with its enumeration-order caveat, and C-F's rollover behaviour
   (`publish-mirror.ts:895-902`, the `:866` comment) as fires-and-misattributes.
3. *The misattribution is an open, unfiled defect* -- tied to the `docs/advanced.md` precedent
   that quick `260809-hcr` fixed, with the note that `publish-mirror.ts` is not in the action
   bundle's 18-file input set.

**"Note on scope".** Extended by one sentence so it does not read as untouched by the
amendment; the checkbox-stays-ticked statement is preserved verbatim.

**"Related" and the REQUIREMENTS.md block quote.** Unchanged. The quotation is byte-identical
to HEAD~1, confirmed by the diff carrying no removal for those lines.

## Verification Results

| Gate | Output |
|------|--------|
| Task 1 automated | `TASK1-OK` |
| Task 2 automated | `TASK2-OK` |
| Task 3 blocklist sweep | `BLOCKLIST-CLEAN` |
| Task 3 scope gate | `SCOPE-OK` |
| ASCII check (added) | `ASCII-CLEAN` |
| Post-commit deletion check | `NO-DELETIONS` |

Task 1's gate failed on its first run -- `MISSING: synthetic entry`. Not a false alarm: the
literal needle is line-oriented and the phrase had hard-wrapped across a newline. Fixed by
rewrapping the sentence, not by weakening the gate. Every other gate passed first time.

The scope gate confirms exactly one tracked file differed from HEAD, and
`.planning/REQUIREMENTS.md` was not among them.

## Manual Read-Through (verification step 4)

Every factual sentence in the amended file maps to a RESEARCH verdict:

| Claim in the file | Traces to |
|-------------------|-----------|
| Shard receives real content only via the run's own mirrored synthetic seed; "stops receiving anything" is literally false | C-H |
| No partial branch before 2026-08-09; fully runtime-silent 2026-07-26 to 2026-08-09; `e78a842` introduced it, `aee017c` gated it | C-E |
| Fresh build at HEAD reproduces the committed bundle byte for byte, 47 commits after `501bcb1` | C-C (4) |
| Nine commits rebuilt the bundle in `969de3e..HEAD` | C-A |
| Eight of the nine paired; `db577db` was the `undici` 6.27.0 -> 6.28.0 lockfile re-resolution | C-B |
| Seven unpaired commits are comment-only; esbuild emits no comments | C-C (1)(3) |
| Residual: byte-identity covers only the two post-`501bcb1` commits directly | C-C residual |
| The guard has fired once in this window, 2026-07-27, rebuild staged in the same commit | C-D (the one approved sentence) |
| `:635` skip, `alreadyPresent` not `readMisses`, full-enumeration denominator, enumeration-order caveat | C-G |
| Rollover fires naming only two candidate causes; `:866` treats the branch as the rotation signal; drift is neither | C-F |
| `publish-mirror.ts` is not in the 18-file bundle input set | C-F |
| The misattribution is deliberately unfiled | CONTEXT.md locked decision |

Two carry-items from the plan check were handled specifically:

1. **The CI-silence argument has no expression in the file, in any wording.** The file makes no
   reference to CI job outcomes on any commit. The only drift-history sentence is C-D's approved
   one about the guard having fired on 2026-07-27. The evasion path the gates leave open (the
   verb `fired`, deliberately ungated because C-D's approved wording uses it) was not taken.
2. **The mid-month behaviour reads as expectation throughout.** "is expected to be silent",
   "That is an expectation, not a guarantee", "Mid-month quiet is the expected behaviour; it is
   not something to rely on". The enumeration-order caveat sits in the same passage, and the
   reason for it (the shard resolves only after the first restore hit) is stated.

## Deviations from Plan

None. The plan executed as written. The one gate failure was a wrapping defect in my own prose,
corrected before the commit.

## Deliberately Not Done

- **`.planning/REQUIREMENTS.md` untouched.** Hard constraint; ROBUST-04's checkbox stays ticked.
- **Nothing merged.** No branch, no PR.
- **`ROADMAP.md` not updated.** Per constraint.
- **GSD per-plan tracking handlers skipped.** `state.advance-plan`, `state.update-progress`,
  `state.record-metric`, `roadmap.update-plan-progress`, and `requirements.mark-complete` were
  not run. This is a quick task with `requirements: []`; advancing a phase plan counter or
  touching the ROADMAP progress table would write tracking state this task does not own, and
  `requirements.mark-complete` would touch the file the hard constraint freezes. Noted here
  rather than fought.
- **Docs commit left to the orchestrator.** Only the capture file was committed. `PLAN.md`,
  `RESEARCH.md`, `CONTEXT.md`, and this `SUMMARY.md` remain uncommitted.

## Known Stubs

None. Docs-only change; nothing is wired to a placeholder.

## Threat Flags

None. No source, test, CI, or dependency input was touched, so no security-relevant surface
was introduced or moved.

## Self-Check: PASSED

- `FOUND: .planning/todos/pending/robust-04-all-restore-miss-clause-is-false.md`
- `FOUND: 06ccf16`
