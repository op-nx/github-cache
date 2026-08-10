---
task: quick/260808-lpt
title: Fix the v0.0.2 milestone audit bookkeeping debt
status: complete
completed: 2026-08-08
base_commit: ccd8248cbb45e37eb35621ebccbf8b3160ecaae6
commits:
  - c3fe74d
  - d5841c2
requires:
  - .planning/phases/08-nx-task-hash-parity/08-VERIFICATION.md
  - .planning/phases/10-os-invariant-releases-mirror/10-VERIFICATION.md
  - .planning/phases/11-live-proofs-o1-o2-o3/11-EVIDENCE.md
  - .planning/phases/12-windows-ci-reuse-o4-consumer-recipe/12-UAT.md
  - .planning/phases/12-windows-ci-reuse-o4-consumer-recipe/12-VALIDATION.md
provides:
  - "REQUIREMENTS.md with all 57 bullets ticked and all 57 traceability rows reconciled"
  - "ROADMAP.md Phase 8 traceability block matching REQUIREMENTS.md's numbering, and 53/53 coverage"
  - "12-VERIFICATION.md internally consistent, with its four human-verification items closed"
  - "v0.0.2-MILESTONE-AUDIT.md carrying one dated closing block for the eight tech-debt items"
affects:
  - .planning/REQUIREMENTS.md
  - .planning/ROADMAP.md
  - .planning/STATE.md
  - .planning/v0.0.2-MILESTONE-AUDIT.md
  - .planning/phases/12-windows-ci-reuse-o4-consumer-recipe/12-VERIFICATION.md
---

# Quick task 260808-lpt: Fix the v0.0.2 milestone audit bookkeeping debt -- Summary

Closed the eight bookkeeping-debt items the v0.0.2 milestone audit recorded, so
`/gsd:complete-milestone` seals an accurate record rather than a stale one. Five `.planning/`
artifacts reconciled, nothing outside `.planning/` touched.

## Per-ID evidence (08-VERIFICATION.md Requirements Coverage)

Every quote below is read from that ID's OWN row in
`.planning/phases/08-nx-task-hash-parity/08-VERIFICATION.md`'s `## Requirements Coverage` table,
re-derived at `:188-196` with
`git grep -n -E '^\| (CORR-0[34]|PARITY-0[1-7]) ' -- <08-VERIFICATION.md>` (exit 0, nine rows).
All nine render SATISFIED in their own Status cell, so hazard rule 4 did not fire for any of them.
Nine separate quotes, one per ID.

**PARITY-01** -- Status `SATISFIED`. Evidence: "Ordering proof re-run: zero `nx.json` commits in
`7bfe64f..eeace53`. Both axes separated with their own diffs. The FRESHNESS-vs-STALENESS wording
correction is recorded as a named disagreement (and pre-acknowledged in ROADMAP `:234-238`), not
smoothed".

**PARITY-02** -- Status `SATISFIED`. Evidence: "`hash.details.nodes` read at
`capture-hashes.mjs:305`; M1 shows the maps; **M4 independently re-proves instrument == Nx at
HEAD**; the CLI surface disqualified by API doc + executed run".

**PARITY-03** -- Status `SATISFIED, with the commit-spread qualification recorded`. Evidence: "M3
(both workstation states at HEAD, zero differing nodes) + M5/M6 (both runners at `3fff526`).
Enforced continuously by CORR-03(c) per the requirement's own closing clause".

**PARITY-04** -- Status `SATISFIED`. Evidence: "Own section labelled Q2-only; answer moved NO 5/5
-> YES 5/5; per-section and per-row question labels. **M2 proves no reset occurs in the recipe**".

**PARITY-05** -- Status `SATISFIED`. Evidence: "Presented as a same-OS PAIR, zero differing nodes
across all 430 post-fix. Explicitly recorded as un-enforceable by CI (no hosted runner is a
workstation)".

**PARITY-06** -- Status `SATISFIED`. Evidence: "All four fields on every record I captured and on
both CI legs. The cold->warm change on the runner legs is named rather than glossed, with a control
proving only `typecheck` was allowed to move".

**PARITY-07** -- Status `SATISFIED`. Evidence: "Both `git diff --name-only` runs return empty; M9
proves the tarball exclusion is asserted. The Nx env vars in the cold recipe are the instrument, not
a consumer knob -- stated explicitly".

**CORR-03** -- Status `SATISFIED`. Evidence: "Job wired build-gating; no `continue-on-error`, no
`needs.*.result`, no event gate; verdict from content only. (a) and (c) observed RED on REAL legs
with matching GREENs after byte-identical reverts; (b) fixture-proven with a stated D-14 rationale
for not mutating the load-bearing string on a real leg".

**CORR-04** -- Status `SATISFIED`. Evidence: "Re-derived from `nx.json` directly: exactly one
`{ "runtime": ... }`, at `:101`. Double-guarded by an all-targets enumeration and an exact
command-string pin, both green".

### The three non-Phase-8 cells, with their located sources

**CORR-05** (Phase 10) -- `10-VERIFICATION.md:55`, `### #12 CORR-05 -- VERIFIED (was Uncertain)`,
and `:116`, the round-2 row "CORR-05: `CORR_05_SITES` empty, positive assertion present, historical
block survives, no repointing, non-vacuity replacement present | VERIFIED". Site 4, which
REQUIREMENTS' own CORR-05 body says the requirement cannot become true without, is called
explicitly as D-17 on `release-asset-name.spec.ts:60` (`10-CONTEXT.md:244`, `10-RESEARCH.md:109`
and `:450`). Corroborated by `:137`'s ticked list naming CORR-05.

**RETAIN-05** (Phase 10) -- `10-VERIFICATION.md:107`, the round-1 row "RETAIN-05(a)(b)(c): tar.gz
disposition, mutual exclusivity, 4-consumer lock | VERIFIED | Code + evidence doc read directly
(round 1)". Corroborated by `:137`'s ticked list naming RETAIN-05.

**TEST-08** (Phase 11) -- `11-EVIDENCE.md:1004` is `## O4 (XOS-04, XOS-05)`, and `:1006` records
that the reservation which stood through Phase 11 "is DISCHARGED by plan 12-06", appended IN PLACE
per D-22 with no `12-EVIDENCE.md` and no relocation. That append is what the placeholder was
waiting on. Re-derived in `11-EVIDENCE.md` itself, not from `12-VERIFICATION.md`'s claim about it.

## What gate G8 does and does not prove

G8 proves that this section exists, is line-anchored under the required heading, is anchored to
`08-VERIFICATION.md`'s `## Requirements Coverage` table by name, names all nine IDs plus the three
non-Phase-8 IDs inside its own region, and does not cite the milestone audit inside that region.

**G8 cannot prove that the quotes above are faithful transcriptions rather than plausible
paraphrase, or that the rows were read at all. No grep can.** That residue is real and is not
closed. It is bounded only by the quotes being per-ID and verbatim-able, so a reviewer can diff any
one against its row in seconds, and by G8's forbidden-source clause removing the likeliest shortcut.
G8 green is evidence that the citations exist and are anchored to the right table -- nothing more.

## Disposition of the eight audit items

1. **cross-cutting (bookkeeping), 5 sub-items** -- CLOSED, four of five. The 9 requirement
   checkboxes and the 12 traceability status cells in `c3fe74d`; the ROADMAP Phase 8 ID shift and
   the 7-vs-9 count in `d5841c2`. The fifth, `requirements_completed`, is RECLASSIFIED as a
   house-style convention rather than closed -- see the audit note, section 2.
2. **12-windows-ci-reuse-o4-consumer-recipe, 2 sub-items** -- CLOSED. `12-VERIFICATION.md`
   reconciled with a `## Human Verification Closed` section carrying all four closures; Phase 12's
   ROADMAP checkbox ticked in `d5841c2`.
3. **13-read-only-actions-cache-backend** -- CLOSED and WIDENED. Six Phase 13 boxes, not five, plus
   fourteen the item never named. See the three-part completeness finding below.
4. **08-nx-task-hash-parity, the unattributed `test` failure at `69bd1b7`** -- STILL OPEN,
   untouched. Actionable only on a second occurrence with output captured.
5. **11-live-proofs-o1-o2-o3, `o3-witness` Case-B** -- ALREADY CLOSED before this task by `40e4d21`
   and `e5d3cd3`, per the 260804-h3b supersede. Not open debt; not re-touched.
6. **process, the main-window restore force-push firing production CI** -- STILL OPEN, untouched.
   An operator procedural decision, outside a bookkeeping pass.
7. **09-os-invariant-actions-cache-version, the first post-merge `publish-verify (windows-11-arm)`
   leg** -- STILL OPEN BY DESIGN. Live-CI; listed in the audit's own `open_by_design`.
8. **260726-pjz (quick), still `Needs Review`** -- RESOLVED honestly and partially. Follow-up (a)
   closed with a located commit; follow-up (b) partially closed with two tokens still homeless. Full
   probe record below.

## Probe results for item 8, with exit codes and positive controls

**Probe 1 -- does residue item 4's bullet still exist?**

- Positive control: `rg -n -e '^## Residual notes' .planning/THREAT-MODEL.md` -> line 84, **exit 0**.
- `rg -c -F -e 'rejected outright'` -> **exit 1**. `rg -c -F -e 'content-keyed'` -> **exit 1**.
  `rg -c -F -e 'clean eviction'` -> **exit 1**. All three against `.planning/THREAT-MODEL.md`.
- Genuine no-match on all three tokens against a positive control at exit 0 on the same path.
  The bullet is GONE.

**Probe 1, the bullet count -- the EXPECTED mismatch, recorded rather than adjusted.**

```
LN=$(rg -n --no-heading -e '^## Residual notes' .planning/THREAT-MODEL.md | rg -o '^[0-9]+' | head -1)
tail -n +"$LN" .planning/THREAT-MODEL.md | awk 'NR==1{print;next} /^## /{exit} {print}' | rg -c '^- '
-> 7   (exit 0)
```

The section holds **SEVEN** bullets against the pjz row's claim of eight, and one of the seven
postdates the pjz task by ONE WEEK (`45dd0f4` 2026-07-26 -> `7b45c38` 2026-08-02), so the count when the row was written was six. **The row
was wrong when written.** This is recorded in the re-derived verdict; the count was not adjusted to
match the row, and `.planning/THREAT-MODEL.md` was NOT edited.

**Probe 2 -- which commit removed it?**

```
git log --oneline -S 'content-keyed' -- .planning/THREAT-MODEL.md .planning/ARCHITECTURE-DECISION.md
-> 83ac4fd docs: close pjz follow-ups, rename the ADR to THREAT-MODEL.md, document inherited zip-slip protection
   c0dd4bc docs: persist architecture decision + D1-D4 security controls
   (exit 0)
```

`83ac4fd`'s diff removes the whole "Why two storage primitives were rejected outright" bullet,
including its `research/STACK.md` pointer. Its subject explicitly says "close pjz follow-ups". Both
paths were needed because the file was renamed.

**Probe 3 -- do the four removed sentences have homes now?** Exit codes captured BEFORE any pipe.
Pathspec `.planning ':!.planning/quick' ':!.planning/milestones'`, the same exclusion
`260726-pjz-VERIFICATION.md` used. Positive control on that pathspec: `git grep -c -F -e
'THREAT-MODEL'` -> exit 0 with hits.

| Token | Exit | Homes |
|---|---|---|
| `raw-count` | 0 | `.planning/THREAT-MODEL.md` |
| `safety-weighted` | **1** | **none -- still homeless** |
| `re-populate` | **1** | **none -- still homeless** |
| `self-inflicted` | 0 | `.planning/THREAT-MODEL.md`, `10-02-SUMMARY.md`, `13-04-SUMMARY.md` |

**Probe 4 -- the unresolvable citation.**

- `test -d research` -> **exit 1**: no `research/` directory at the repo root, so
  `research/STACK.md:75,77` never resolved. This is the failure mode where the search AND its
  positive control both return failure, which reads as absence rather than as a wrong path.
- `test -f .planning/research/STACK.md` -> **exit 0**. The real file.
- `rg -n -e 'Reject' .planning/research/STACK.md` -> **exit 0**, with the two rows the citation
  means at **`:76`** (`| Actions Artifacts | ... | **Reject** - no anon read, wrong lookup shape |`)
  and **`:78`** (`| git objects / refs (cache branch, LFS) | ... | **Reject** - bloats history, no
  clean eviction |`). The citation is off by one line at both positions and is corrected to
  `.planning/research/STACK.md:76,78`.

**What gate G5c cannot distinguish.** The pjz row carries TWO unresolvable `research/STACK.md`
citations: `:16-40` in its description and `:75,77` in its OPEN clause. Only the OPEN-clause one was
in scope -- the plan leaves the description alone as the sealed record of what was claimed -- so
**`research/STACK.md:16-40` in the description remains unresolvable by design**. G5c is a bare
presence check for `.planning/research/STACK.md` anywhere in STATE.md and goes green once either is
corrected, so it cannot tell the two apart. The in-scope one is the OPEN-clause `:75,77`, now
`:76,78`; the description's was not touched.

## FOR THE ORCHESTRATOR -- preserve these two STATE.md values

`.planning/STATE.md` is MODIFIED BUT NOT STAGED by this task. The orchestrator owns that commit. If
its own STATE.md write clobbers the edit, re-apply these verbatim to the `260726-pjz` row in
`### Quick Tasks Completed`.

**New Status cell value (replacing `Needs Review`):**

```
Resolved (1 of 2 follow-ups closed)
```

**New OPEN clause (replacing the clause that began `OPEN (verifier \`human_needed\`, 0 blockers):`),
verbatim:**

```
RE-DERIVED 2026-08-08 by quick task `260808-lpt`, from executed probes rather than by restating this row; both `human_verification` items in `260726-pjz-VERIFICATION.md` were re-checked. **(a) CLOSED.** Residue item 4 (the git-native / build-artifact rejection rationale) -- the one labelled duplicate that violated the file's own criterion -- was REMOVED from the ADR in commit `83ac4fd` (`docs: close pjz follow-ups, rename the ADR to THREAT-MODEL.md, document inherited zip-slip protection`). All three of its distinctive tokens (`rejected outright`, `content-keyed`, `clean eviction`) now return a genuine no-match against `.planning/THREAT-MODEL.md` at exit 1, with a positive control at exit 0 on the same path. Its fuller treatment survives at `.planning/research/STACK.md:76,78` -- the Actions Artifacts Reject row and the git objects / refs Reject row. Those two line numbers are the resolvable form of the citation this row previously gave as `research/STACK.md:75,77`: no `research/` directory exists at the repo root, so that path resolved to nothing and its search and its positive control BOTH returned exit 1, which reads as absence rather than as a wrong path. **(b) PARTIALLY CLOSED, the remainder accepted as non-operative.** Of the four removed sentences' distinctive tokens, `raw-count` and `self-inflicted` now have homes (both in `.planning/THREAT-MODEL.md`; `self-inflicted` additionally in `10-02-SUMMARY.md` and `13-04-SUMMARY.md`), while `safety-weighted` and `re-populate` remain HOMELESS -- both exit 1 across `.planning` excluding `quick/` and `milestones/`, the same exclusion `260726-pjz-VERIFICATION.md` used, against a positive control at exit 0 on that pathspec. **FINDING, recorded rather than smoothed:** this row's own "8 residue rows retained" is wrong and was wrong when written. `## Residual notes` holds SEVEN bullets, and one of those seven postdates the pjz task by ONE WEEK (`45dd0f4` 2026-07-26 -> `7b45c38` 2026-08-02), so the count at the time the row was written was six. The description above is left as the sealed record of what was claimed.
```

Everything else in the row -- description, date, commit range and directory link -- is unchanged.

**Gate G6 must be re-run after the orchestrator's STATE.md commit lands**, to confirm the edit
survived. G6 is deliberately permissive about WHICH verdict the row carries, because all three
honest outcomes are different strings; what it forbids is leaving the value unchanged. **G6 does not
prove the verdict is correct** -- the evidence discipline for the verdict is carried by the located
citations above, not by a grep.

## The three-part audit-completeness finding on item 7

Each part measured at the current tree, not carried forward.

1. **Phase 13 has SIX plan checkboxes, not the five the audit's item names.** `13-01` through
   `13-06`, at `ROADMAP.md:639-644` -- a six-row range the item itself cites while calling them
   five. Corroborated by STATE.md's "Plan: 6 of 6" and the Progress table's Phase 13 row `6/6`.
2. **Phase 10 and Phase 11 were omitted from the audit entirely** -- fourteen more unticked plan
   checkboxes of the identical class, seven in each.
3. **Phase 10's block has EIGHT rows, not seven.** `10-01` was already ticked, so gate G10a asserts
   all eight are present-and-ticked, which also catches an accidental untick of `10-01`.

All twenty were ticked in `d5841c2`. An item list that caught 6 of 20 instances of one defect is
the interesting result here; this is a finding about the audit's completeness, not about the phases.

## In-file corroboration read before each phase's boxes were ticked

| Phase | The phase's own line | `## Progress` table row |
|---|---|---|
| 10 | `**Plans**: 8/8 plans complete` (`ROADMAP.md:423`) | `\| 10. OS-Invariant Releases Mirror \| v0.0.2 \| 8/8 \| Complete \| 2026-07-29 \|` |
| 11 | `**Plans**: 7/7 plans complete` (`ROADMAP.md:498`) | `\| 11. Live Proofs -- O1, O2, O3 \| v0.0.2 \| 7/7 \| Complete \| 2026-07-30 \|` |
| 12 | `**Plans**: 6/6 plans executed` (`ROADMAP.md:562`) | `\| 12. Windows CI Reuse (O4) + Consumer Recipe \| v0.0.2 \| 6/6 \| Complete \| 2026-07-31 \|` -- the source of the `(completed 2026-07-31)` suffix |
| 13 | **no `**Plans**:` line exists** -- see the discrepancy note below | `\| 13. Read-Only Actions-Cache Backend \| v0.0.2 \| 6/6 \| Complete \| 2026-08-02 \|` |

None of the four says its plans are incomplete, so no phase's boxes were held back.

## The one ROADMAP box left unticked, and the boxes elsewhere

Exactly ONE unticked checkbox survives in `ROADMAP.md`, verified by `git grep -n -F -e '- [ ]' --
.planning/ROADMAP.md` returning a single line:

```
.planning/ROADMAP.md:26:- [ ] **v0.0.2 OS-invariant cross-OS sharing** -- Phases 7-13
```

That is the v0.0.2 milestone rollup entry, owned by `/gsd:complete-milestone`. Gate G11a asserts it
is still present AND still unticked, so it can be neither ticked nor deleted. Recomputed:
22 - 1 (Phase 12's phase entry) - 7 (Phase 10) - 7 (Phase 11) - 6 (Phase 13) = 1.

### The re-measured census for the rest of `.planning/`

Measured **2026-08-08**, at commit `c3fe74d` (after Task 1's nine ticks landed), with exactly this
command:

```
git grep -c -F -e '- [ ]' -- .planning ':!.planning/milestones' ':!.planning/quick' ':!.planning/ROADMAP.md'
```

**100 unticked boxes across 21 files** (exit 0). `REQUIREMENTS.md` no longer appears, because Task 1
ticked its nine. Per class:

| Class | Boxes | Files |
|---|---|---|
| `.planning/research/` -- `FEATURES.md` 10, `PITFALLS.md` 8, `v0.0.2/PITFALLS.md` 17 | 35 | 3 |
| phase `*-RESEARCH.md` -- 07 5, 08 3, 10 10, 12 7, 13 5 | 30 | 5 |
| `PROJECT.md` | 7 | 1 |
| transient handoff artifacts -- `.continue-here.md` 6, `HANDOFF.json` 1 | 7 | 2 |
| phase SUMMARY / PLAN / LEARNINGS / VERIFICATION / deferred-items -- incl. THREE in `12-01-SUMMARY.md` | 21 | 10 |

35 + 30 + 7 + 7 + 21 = 100. The four non-transient per-class figures match the plan's own `c84ebd5`
measurement exactly; the 7 transient boxes are this task's own handoff artifacts and vanish when
consumed.

None of these is a phase or plan completion marker -- they are research checklists,
roadmap-adjacent progress lists and per-plan scratch. A different class, out of scope, all left
alone. **This precise figure lives here and deliberately NOT in the sealed audit**, which records
the qualitative statement plus the sentence "No count is recorded here deliberately".

## Verification

**`$BASE` was CAPTURED as the first action**, not hardcoded:
`ccd8248cbb45e37eb35621ebccbf8b3160ecaae6`.

1. Eight dispositions recorded above -- one per audit item, none omitted.
2. `git diff --name-only $BASE..HEAD` lists only paths under `.planning/`. No source file, no
   `nx.json`, no `package.json`, no `ci.yml`.
3. `git log --format=%s $BASE..HEAD` shows three subjects, all ASCII, none carrying a CI-skip token
   or a work-email domain.
4. **Every CONTENT gate in all three scripts passes against the final tree**, T1's G8 included --
   Task 2's edits did not re-break Task 1's row counts. The two working-tree SCOPE gates, T1's G7
   and T2's G12, do NOT pass at the final tree, and cannot: see discrepancy 3 below. Each passed at
   its own task boundary, which is the only point at which it is meaningful.
5. T3's G6 must be re-run after the orchestrator's STATE.md commit lands.

### The test battery is NOT a gate for this change, and was not used as one

`nx run-many -t test` was neither run nor reported as verification. **No spec in this repo reads any
`.planning/` file at runtime** -- every `.planning/` mention in `packages/**/*.spec.ts` is a comment,
and the `readFileSync` targets are only `nx.json`, `package.json`, `project.json` and doc URLs.
`.planning/` is not a declared Nx input for any target, so no task hash rotates and a green battery
would carry no information about this change. Every gate here is a self-authored assertion over the
artifacts.

### What the gates do NOT prove

Stated rather than omitted, because a silent gap here is how these nine boxes rotted originally.

- **G8** proves the per-ID evidence section exists, is anchored to the right table, names all nine
  IDs and does not cite the forbidden source. It **cannot** prove the quotes are faithful
  transcriptions rather than plausible paraphrase, and no grep can. Do not read G8 green as evidence
  that the readings happened.
- **T3's G7** covers FIVE of the seven numbered audit-note components, via eleven region-scoped
  literals. Components 1 (the eight dispositions) and 7 (the pre-existing 11-vs-13 drift note) have
  NO literal gate -- both are open-ended prose with no stable token. Green means "five components
  present and the note is real", not "all seven present". Both were written anyway.
- **T3's G5c** cannot distinguish between the pjz row's two unresolvable `research/STACK.md`
  citations. Only the OPEN-clause `:75,77` was in scope and corrected; the description's `:16-40`
  remains unresolvable by design.
- **T3's G6** forbids leaving the pjz Status value unchanged. It does not prove the new verdict is
  correct; that is carried by the located probe citations, not by a grep.
- **G3/G6 (T1) and G2/G4/G11b (T2)** are cardinality only. They prove counts, never distribution --
  the per-item presence gates carry that, which is why every count gate here is paired with one.

## Discrepancies found against the plan

Neither changed the outcome; both are recorded rather than silently absorbed.

1. **The `not when it was waived` honesty clause initially spanned a line wrap at BOTH sites**, so
   gate G3c returned a genuine FAIL on text that was actually present. This is the plan's own
   documented dead-literal trap firing during execution rather than during authoring. Fixed by
   keeping the phrase on a single line at both sites; the gate was not weakened.
2. **Phase 13 has no `**Plans**:` line in ROADMAP.md.** Task 2's `<done>` says each ticked phase's
   own `**Plans**:` line was read; Phases 10, 11 and 12 have one, Phase 13's block uses a bare
   `Plans:` heading with no `N/N` count. Corroboration for Phase 13 came from the `## Progress`
   table row (`6/6 Complete 2026-08-02`) and from the parallel bare-name plan list in the same
   block, which was already fully ticked. The plan's own action text anticipated this -- it cites
   STATE.md's "Plan: 6 of 6" and the Progress row for Phase 13, not a `**Plans**:` line.

3. **The plan's `<verification>` item 4 -- "re-run all three gate scripts against the final tree,
   all three pass together" -- is NOT SATISFIABLE, by construction.** T1's G7 and T2's G12 are
   working-tree scope allowlists that exclude `.planning/STATE.md`; T3's G8a REQUIRES STATE.md to be
   modified-and-unstaged. Before the orchestrator's STATE.md commit, G7 and G12 fail on a dirty
   STATE.md; after it, G8a fails because STATE.md is clean. There is no tree state satisfying all
   three at once. Measured at the final tree: T3 passes whole; T1 and T2 fail on G7 / G12 ONLY, with
   `.planning/STATE.md` as the sole reported path, and every other gate in both scripts passes
   (verified by re-running each script with just its scope line neutralised -- `T1 GATES PASS`
   including G8, and `T2 GATES PASS`).

   The gates are not wrong; item 4 over-generalises them. A per-task working-tree scope gate is only
   meaningful at its own task boundary, and both were evaluated there and passed: T1's G7 before
   `c3fe74d`, T2's G12 before `d5841c2`. **No gate was weakened to make this pass**, and the substance
   item 4 exists to catch -- Task 2 re-breaking Task 1's row counts -- is fully covered, because
   every content gate in T1 and T2 was re-run against the final tree and passes.

Also worth naming, though it is a finding rather than a discrepancy: **`11-EVIDENCE.md`'s O4
`### VERDICT` slot still reads `PENDING -- live-CI, first run of the proving PR`.** The observation
that closed 12-VERIFICATION's item 1 was written into `12-UAT.md` and into REQUIREMENTS' XOS-05 row
but never back into the slot that section reserved for it. That is a separate, still-open
bookkeeping item in a Phase 11 artifact, outside this task's scope. It is named in the
`## Human Verification Closed` section so a future reader does not read the PENDING verdict as
contradicting the closure.

## Commits

| Task | Commit | Files |
|---|---|---|
| 1 | `c3fe74d` | `.planning/REQUIREMENTS.md` |
| 2 | `d5841c2` | `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md` |
| 3 | see below | `12-VERIFICATION.md`, `.planning/v0.0.2-MILESTONE-AUDIT.md`, this SUMMARY |

`.planning/STATE.md` is modified but deliberately UNSTAGED -- the orchestrator owns that commit.
