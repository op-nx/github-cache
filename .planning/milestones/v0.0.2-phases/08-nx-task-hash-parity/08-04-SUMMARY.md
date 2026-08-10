---
phase: 08-nx-task-hash-parity
plan: 04
subsystem: infra
tags: [nx, task-hashing, cross-os, root-cause, record, requirement-audit, ordering-proof]

# Dependency graph
requires:
  - phase: 08-nx-task-hash-parity
    plan: 01
    provides: the opened 08-ROOT-CAUSE.md, its Method sections, and the D-09 admissibility rule this plan's root-cause section is gated on
  - phase: 08-nx-task-hash-parity
    plan: 03
    provides: the anchor commit, all four observation points, both node-level diffs, the merged-node field diff, and the 136-file typecheck outputs enumeration
provides:
  - PARITY-01's root cause as a named synthesis -- one node, one field, both axes separated, with the OS attribution gated on the staleness axis being pinned first
  - the fix ROUTE, written before it is taken -- `targetDefaults.typecheck.outputs` carrying the SEVEN-entry list, sourced from the 136-of-136 enumeration
  - U-01's trigger condition as a pre-committed C1-C4 / L1-L4 / N1-N3 predicate set, with the commitment that 08-05 STOPS on any L
  - `nx-target-inputs.spec.ts` named as the rationale lock 08-05 must EXTEND, with the reason text it must carry
  - six DOCS-07 checklist items derived for Phase 12
  - the git-history ordering proof -- zero nx.json commits across all 22 phase commits
  - a requirement-coverage audit against REQUIREMENTS.md's own words, with five recorded disagreements
  - four anti-requirement constraints binding plans 08-05 and 08-06
affects:
  [
    08-05 the nx.json fix (consumes the route, the value, the lock spec and U-01's stop condition),
    08-06 the gate (consumes the anti-requirement constraints -- no spec may read ci.yml),
    phase 9 PARITY-08 and VER-01,
    phase 12 DOCS-07,
  ]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - 'Pre-commit the trigger condition: write the confirm predicate, the escalation predicate AND the explicit non-triggers before running the experiment, so a known-orthogonal difference cannot be relabelled as the escalation and the escalation cannot be waved away by pointing at one'
    - 'Audit coverage against the requirement source, never the roadmap paraphrase -- the paraphrase in this repo carried a stale numbering that would have reported the one unmet row as covered'
    - 'Name the route the measurement ruled OUT, with its evidence, so a future divergence of that shape has a written starting point rather than a rediscovery'

key-files:
  created:
    - none
  modified:
    - .planning/phases/08-nx-task-hash-parity/08-ROOT-CAUSE.md

key-decisions:
  - 'The four task-1 sections are INSERTED before the two pre-existing tail sections rather than appended at the end, so the reading order is root cause -> proposed fix -> U-01 -> Phase 12 hand-off -> the all-MISS rotation window that is a consequence of that fix. The task-2 audit sections are appended at the very end, where a closing audit belongs.'
  - 'The external-dependency narrowing route is written down and explicitly NOT taken, with the empty only-in-* buckets as the reason. A route ruled out by measurement is recorded differently from a route never considered.'
  - "U-01's non-triggers (N1-N3) are pre-committed alongside its triggers. Without them, D-11's build-output residue -- which 08-05's fix provably does not close -- would read as U-01 going live on the first post-fix local-versus-CI comparison."
  - "The lint.outputs corroboration is recorded as WEAKER than the typecheck.inputs demonstration and the reason is stated: @nx/eslint may infer [] anyway, so it cannot separate declared from inferred. Recording it as equal evidence would have overstated the case for A2."
  - "ROADMAP.md's stale PARITY numbering is SURFACED, not fixed. It is outside this plan's file scope, and a drive-by renumber in the phase whose entire premise is a clean measure-then-fix ordering is the wrong trade."

patterns-established:
  - 'Pattern: state the two diff buckets and the DIFFERENT fix route each implies BEFORE reading which one the measurement produced, so the route is selected by the bucket rather than by preference'
  - "Pattern: an ordering claim is proven by two listings -- the empty one (what was not touched) and the dated one (when the record was written) -- because the empty listing alone is indistinguishable from a listing that was never run"

# Deliberately empty, matching plans 08-01, 08-02 and 08-03. This plan's frontmatter claims
# four PARITY requirements. PARITY-01, PARITY-04 and PARITY-06 are substantively COMPLETE in
# the record but are phase-end properties the verifier closes against
# VERIFICATION + SUMMARY + REQUIREMENTS; PARITY-03 is explicitly NOT satisfied here and the
# record says so in its own coverage table. Additionally `requirements.mark-complete` has
# corrupted REQUIREMENTS.md in two prior waves of this project (STATE.md, Phase 07 P04), so
# the tool was not invoked.
requirements-completed: []

coverage:
  - id: D1
    description: 'The root cause is named node by node and field by field, from measurement, with the staleness axis and the OS axis in separate labelled sub-sections'
    requirement: PARITY-01
    verification:
      - kind: other
        ref: "`## Root cause` carries `### Axis 1 -- STALENESS` and `### Axis 2 -- OPERATING SYSTEM` as separate sub-sections. Both name `@op-nx/github-cache:ProjectConfiguration` as the node and `targets.typecheck.outputs` as the field. A third sub-section records that both axes carry the SAME pair of node values, and a fourth records the D-11 build-output source as NEITHER axis"
        status: pass
    human_judgment: false
  - id: D2
    description: 'No difference is attributed to the OS without the staleness axis pinned first, and the two readings that pinned it are named'
    requirement: PARITY-01
    verification:
      - kind: other
        ref: '`### The D-09 gate, stated explicitly` names observation points 1 and 2 (same machine, same OS, same commit, same Nx, same Node, same install mode, clean tree, graph state the only variable) and states that the cross-OS reading is then taken between two points that BOTH record graphState cold with workspaceDataEntries 0'
        status: pass
    human_judgment: false
  - id: D3
    description: "The only-in-* bucket is read FIRST and the route it implies is named and ruled out by measurement, not by preference"
    requirement: PARITY-01
    verification:
      - kind: other
        ref: "`### Axis 2` leads with the only-in bucket, states what entries there would mean (a differing external-dependency SET) and the route they would imply (narrow externalDependencies), records the bucket EMPTY on all five targets, and `### The external-dependency route: named, and NOT taken` writes the unused route down with the five nx.json line ranges where the edit would land"
        status: pass
    human_judgment: false
  - id: D4
    description: "D-10's supersession by measurement is recorded rather than silently ignored"
    requirement: PARITY-01
    verification:
      - kind: other
        ref: "`## Root cause` closes with D-10 SUPERSEDED BY MEASUREMENT, cross-referencing 08-03's `### D-10's search ordering is SUPERSEDED` section, restating that both named buckets are provably identical at the anchor and that both remain reasonable priors for a different workspace"
        status: pass
    human_judgment: false
  - id: D5
    description: 'The proposed fix names a concrete nx.json key path, states the VALUE it must carry, and cites 08-03 enumeration rather than either candidate list size'
    requirement: PARITY-03
    verification:
      - kind: other
        ref: '`## Proposed fix` names `targetDefaults.typecheck.outputs`, quotes the seven-entry list verbatim as a jsonc block, and sources it as "136 of 136" emitted files from the enumeration section -- with the explicit statement that the source is the enumeration and not either list entry count, plus why a merely-STABLE list would be a caching correctness regression'
        status: pass
    human_judgment: false
  - id: D6
    description: 'The rationale lock is named and the pin is required to EXTEND the existing spec rather than being re-authored'
    requirement: PARITY-03
    verification:
      - kind: other
        ref: "`### Where the rationale lives, since nx.json cannot hold it` names packages/github-cache/src/nx-target-inputs.spec.ts, cites :229-234 (the targetDefaults.lint.outputs pattern) and :269-273 (the nx.json-is-a-test-input protection), states the pin must EXTEND that file because re-authoring creates a second copy to drift, and supplies the reason text 08-05 must carry"
        status: pass
    human_judgment: false
  - id: D7
    description: "U-01's trigger condition is written in advance, in testable terms, with the commitment to stop"
    requirement: PARITY-03
    verification:
      - kind: other
        ref: '`## U-01: the condition that would make it live` restates U-01 in full, then gives C1-C4 (all must hold to confirm), L1-L4 (any one makes it live), N1-N3 (explicitly not triggers), and the commitment that 08-05 STOPS and re-opens the fix location with the maintainer rather than improvising. Committed in eeace53, before 08-05 exists'
        status: pass
    human_judgment: false
  - id: D8
    description: "The Phase 12 hand-off lists at least five derivable checklist items"
    requirement: PARITY-04
    verification:
      - kind: other
        ref: '`## Hand-off to Phase 12 (DOCS-07)` carries SIX numbered items: the PARITY-04 answer plus its nx reset mitigation; the reset needed AFTER the fix because the plugin cache does not self-heal; that deleting .nx/ is not cold; that --onlyWorkspaceData can EPERM on Windows so the FULL reset is what to document; the two env vars as the non-destructive alternative; and the build-output typecheck item that the fix does not close'
        status: pass
    human_judgment: false
  - id: D9
    description: 'Git history proves the record predates every fix commit, with no programmatic guard'
    requirement: PARITY-01
    verification:
      - kind: other
        ref: '`## The ordering proof` carries two verbatim listings. `git log --oneline 7bfe64f..HEAD -- nx.json` returns ZERO lines across all 22 phase commits; `git log --format="%h %ad %s" --date=short ... -- 08-ROOT-CAUSE.md` returns four dated commits. A scoped scan over the phase-changed source files (capture-hashes.mjs, src/hash-parity/*, pack-check.cjs, .fallowrc.jsonc) for mtime/birthtime/rev-list/git-log returns zero matches'
        status: pass
    human_judgment: false
  - id: D10
    description: 'Requirement coverage is audited against the requirements own words, and unmet rows are marked deferred to a named plan rather than reported covered'
    requirement: PARITY-06
    verification:
      - kind: other
        ref: '`## Requirement coverage` has one row for each of PARITY-01..06, each naming a section and stating Q1 / Q2 / neither-it-is-method. PARITY-03 is marked NO with 08-05 (outcome) and 08-06 (enforcement) named. PARITY-05 is confirmed as a same-OS PAIR with the note that no CI job can enforce it. PARITY-06 is checked on a four-column table covering all four observation points'
        status: pass
    human_judgment: false
  - id: D11
    description: 'Disagreements between the requirements own words and either a paraphrase or the measurement are recorded rather than smoothed'
    requirement: PARITY-06
    verification:
      - kind: other
        ref: "Five recorded: FRESHNESS vs STALENESS (08-01's, restated); PARITY-01 naming two plugins where the measurement names one; PARITY-01(b)'s enumeration missing lint; PARITY-06 guessing install mode where the variable is build-output state; and ROADMAP.md's traceability rows :530-534 carrying a stale PARITY numbering that disagrees with its own :164-165 and with REQUIREMENTS.md :619-627"
        status: pass
    human_judgment: false
  - id: D12
    description: 'The four anti-requirements are recorded as constraints on plans 08-05 and 08-06'
    requirement: PARITY-01
    verification:
      - kind: other
        ref: "`## Anti-requirements: what does NOT count as evidence` carries four items, each with a bolded **Constraint:** clause naming the plan it binds -- the rejected CLI surface, the textual nx.json assertion vs CORR-03, the nx reset that converts PARITY-04 into PARITY-03, and the ci.yml stale-cached-PASS constraint with PARITY-08's Phase 9 deferral"
        status: pass
    human_judgment: false
  - id: D13
    description: 'No commit in this plan touched nx.json'
    requirement: PARITY-01
    verification:
      - kind: other
        ref: '`git log --oneline 7bfe64f..HEAD -- nx.json` returns 0 lines after both commits. `git show --stat` on eeace53 and 7b9a4bb each lists exactly one file, 08-ROOT-CAUSE.md'
        status: pass
    human_judgment: false

# Metrics
duration: 28min
completed: 2026-07-28
status: complete
---

# Phase 8 Plan 04: The Record Closed Before the Fix Summary

**One node, one field, both axes -- and the route out of it is now written down, bounded and audited in a commit that provably predates every `nx.json` edit in the phase.**

## Performance

- **Duration:** 28 min
- **Tasks:** 2 (2 commits)
- **Files modified:** 1 (0 created, 1 modified)

## Accomplishments

- **The root cause is a synthesis, not a restatement.** `## Root cause` separates the staleness axis (points 1 vs 2) from the OS axis (points 4 vs 3), names `@op-nx/github-cache:ProjectConfiguration` and the field `targets.typecheck.outputs` on both, and then states the finding neither axis produces alone: **both axes carry the SAME pair of node values.** A stale Windows graph does not imitate a cold Linux graph -- it emits literally the Linux value, because both carry the SEVEN-entry form of one field. That is the mechanical reason the masquerade is perfect.

- **The bucket was read before the route was picked.** `### Axis 2` states what `only-in-*` entries would mean (a differing external-dependency SET) and the route they would imply (narrow `externalDependencies`) BEFORE recording that the bucket is empty on all five targets. The `value-changed` bucket is what selects the `targetDefaults` route. The unused route is then written down anyway, with the five `nx.json` line ranges where the edit would land, so a future divergence of that shape has a starting point rather than a rediscovery.

- **The fix route is bounded before it is proposed.** A five-row constraint table (D-12, D-13, D-14, no `project.json`, no plugin-option patching) sits at the top of `## Proposed fix`, so the proposal reads as bounded rather than free. The key is `targetDefaults.typecheck.outputs`; the value is the SEVEN-entry list verbatim; the source of that value is 08-03's **136-of-136** enumeration and explicitly not either candidate list's size.

- **Why "stable" is not "correct" is stated where it matters.** `outputs` is what Nx caches and restores, so pinning the one-entry list -- which is perfectly stable -- would make `typecheck` cache none of its declaration output and restore nothing on a hit, while still reporting a cache hit. That is the inversion assumption A6 warned about, and it is recorded beside the value rather than left to the reader.

- **U-01's trigger condition is committed in advance, including its NON-triggers.** C1-C4 confirm, L1-L4 make it live, and N1-N3 are pre-declared as not triggers. N1 is the load-bearing one: `typecheck` differing between a built workstation and an unbuilt runner is D-11's residue, root-caused and provably not closed by this fix, and without pre-committing it as orthogonal it would read as U-01 going live on the first post-fix comparison anybody runs.

- **The ordering is proven by two listings, not one.** `git log --oneline 7bfe64f..HEAD -- nx.json` returns ZERO lines across all 22 phase commits; the second listing dates the four commits that built the record. The empty listing alone would be indistinguishable from a listing that was never run. No mtime guard, no timestamp assertion, no commit-ordering spec -- D-06 rules them out by name, and a scoped scan over the phase's changed source files confirms none exists.

- **The coverage audit caught a stale numbering that would have closed the wrong row.** Auditing against `REQUIREMENTS.md`'s own words rather than the roadmap's paraphrase surfaced that `ROADMAP.md:530-534` carries an off-by-N PARITY numbering: its `PARITY-02` row states PARITY-03's text, `PARITY-03` states PARITY-05's, `PARITY-04` states PARITY-06's, `PARITY-05` states PARITY-07's -- and its coverage line says seven Phase 8 requirements where its own Phase 8 section and `REQUIREMENTS.md` both say nine. An audit against the table would have reported PARITY-02 covered by the observation points, which is PARITY-03's job and is the one row this record does NOT satisfy.

- **PARITY-03 is marked NOT satisfied here, in the record itself.** Four values per target exist at one commit; they are not identical. The outcome belongs to 08-05, the continuous enforcement to 08-06, and the record says which -- with the additional note that only three of the four values can ever be brought into agreement by an `nx.json` change, because the workstation's `typecheck` carries the build-output variable.

## Task Commits

1. **Task 1: the root cause, the fix route, U-01's condition and the Phase 12 hand-off** - `eeace53` (docs)
2. **Task 2: the requirement audit, the ordering proof and the anti-requirements** - `7b9a4bb` (docs)

## Files Created/Modified

- `.planning/phases/08-nx-task-hash-parity/08-ROOT-CAUSE.md` - +566 lines across seven new sections: `## Root cause` (four sub-sections), `## Proposed fix` (constraint table, route, value, the ruled-out route, the rationale lock), `## U-01: the condition that would make it live` (C/L/N predicate sets plus the stop commitment), `## Hand-off to Phase 12 (DOCS-07)` (six items), `## The ordering proof` (two verbatim listings), `## Requirement coverage` (six-row table, three scrutiny sub-sections, five recorded disagreements) and `## Anti-requirements` (four bound constraints). The record is now 1989 lines across 22 top-level sections.

## Decisions Made

See the frontmatter. The three worth restating:

- **Section placement was chosen for reading order, not for append-convenience.** The four task-1 sections are inserted before `## SURFACED, NOT FIXED` and `## Pre-recorded: ... all-MISS rotation window`, so a reader goes root cause -> proposed fix -> U-01 -> Phase 12 hand-off -> the rotation window that is a direct consequence of that fix. The task-2 audit sections close the document.
- **The `lint.outputs` corroboration is labelled weaker than the `typecheck.inputs` demonstration.** `targetDefaults.lint.outputs` is declared `[]` and the merged node measures `[]` on both legs -- but `@nx/eslint` may infer `[]` anyway, so it cannot separate declared from inferred. Recording it as equal evidence would have overstated A2 in the very section that calls A2 a hypothesis.
- **`ROADMAP.md`'s stale numbering is surfaced and left unfixed.** Same posture as 08-03's `AGENTS.md` finding: it is outside this plan's file scope, and a drive-by edit in the phase whose entire premise is a clean measure-then-fix ordering is the wrong trade.

## Deviations from Plan

None - plan executed exactly as written.

Two places where the plan's wording anticipated a branch the measurement had already closed, and the record says so explicitly rather than writing a hypothetical as if it were live:

- The plan directs a route to be proposed "for an external-dependency-set divergence". There is none. The route is written down and marked NOT TAKEN with the empty `only-in-*` buckets as the reason, which is what the plan's own framing ("Both may be present. Name every one that is.") calls for.
- The plan asks Task 2 to "confirm or correct D-10's search ordering". It was already superseded by 08-03's measurement, so Task 1 records the supersession by cross-reference rather than restating the evidence -- exactly as the plan's Step 1 closing sentence instructs.

## Issues Encountered

None. `npm run format:check` exits 0 (the record is under `.planning/`, which `.prettierignore` excludes, so the check is a no-op for this file and was run to confirm nothing else regressed).

## Live-CI Items

None opened or closed by this plan -- it touches no workflow file and runs nothing on a runner. The three still open are 08-03's and are unchanged: CORR-03's gate seen RED against a real leg (08-06), `if-no-files-found: error` observed firing (08-06), and whether 08-05's fix actually brings the two legs to agreement -- which is now a **pre-committed predicate** (C1-C4) rather than an open prediction.

## User Setup Required

None.

## Next Phase Readiness

**Ready for 08-05 (the fix).** It now has everything the record can give it:

1. **The key:** `targetDefaults.typecheck.outputs` in `nx.json`, with `targetDefaults.lint` (`nx.json:147-148`) as the shape precedent -- `outputs` first, before `inputs`.
2. **The value:** the SEVEN-entry list, quoted verbatim in `## Proposed fix`, sourced from the 136-of-136 enumeration.
3. **The lock:** extend `packages/github-cache/src/nx-target-inputs.spec.ts`, not a new file, with the reason text the record supplies.
4. **The stop condition:** C1-C4 to confirm, L1-L4 to escalate, N1-N3 explicitly not triggers, and the commitment to re-open the fix location with the maintainer rather than improvise.
5. **The constraint it inherits:** its post-fix re-measurement must keep the environment-variable cold recipe and keep a warm-preexisting reading, or U-01's C1 is unmeasurable.

**Ready for 08-06 (the gate).** D-21's PRIMARY branch stands. The binding new constraint is anti-requirement 4: **no Phase 8 spec may assert on `ci.yml` content**, because `nx.json` registers `cleanup.yml` and not `ci.yml` as a `test` input, so such a spec serves a stale cached PASS. Registering `ci.yml` is PARITY-08, Phase 9.

**Carried forward:**

- **U-01 remains open** -- its named risk is the less likely branch, and its resolution is now a measurable predicate rather than a judgement call.
- **Six DOCS-07 items for Phase 12**, written out rather than left for a re-read.
- **A second surfaced, unfixed defect:** `ROADMAP.md:530-534`'s stale PARITY numbering, joining 08-03's `AGENTS.md` per-worktree cache claim.
- **PARITY-03 and the phase's remaining PARITY rows** stay open by design; this record's job for PARITY-03 was the measurement.

**No blockers.**

## Self-Check: PASSED

Files claimed modified, verified present with the claimed content:

- `.planning/phases/08-nx-task-hash-parity/08-ROOT-CAUSE.md` - FOUND; 1989 lines, 22 top-level `##` sections, all seven new headings present (`Root cause` :1370, `Proposed fix` :1500, `U-01: the condition that would make it live` :1616, `Hand-off to Phase 12 (DOCS-07)` :1695, `The ordering proof` :1797, `Requirement coverage` :1849, `Anti-requirements` :1947)

Commits claimed, verified present in `git log`:

- `eeace53` - FOUND (docs: root cause + fix route + U-01 + Phase 12 hand-off); `git show --stat` lists only the record file, 370 insertions
- `7b9a4bb` - FOUND (docs: requirement audit + ordering proof + anti-requirements); `git show --stat` lists only the record file, 196 insertions

Plan-level constraints, verified:

- `git log --oneline 7bfe64f..HEAD -- nx.json` returns 0 lines across all 24 phase commits - PASS (the hard ordering constraint)
- No file under `packages/github-cache/` changed in this plan - PASS (both commits list exactly one file)
- All NINE battery commands green at the final commit (`format:check`, `build`, `typecheck`, `typecheck:action`, `test`, `lint`, `fallow:ci`, `check:action`, `pack:check`) - PASS, each exit 0
- Zero non-ASCII characters in the touched file - PASS
- Allowlist-inversion email scan over the touched file: zero email-shaped tokens, so zero unexpected ones - PASS
- Committer identity `larsbrinknielsen@gmail.com` on both commits - PASS
- No programmatic mtime guard, timestamp assertion or commit-ordering spec: scoped scan over the phase's changed source files (`capture-hashes.mjs`, `packages/github-cache/src/hash-parity/*`, `pack-check.cjs`, `.fallowrc.jsonc`) for `mtime`, `birthtime`, `rev-list`, `git log`, `committerDate`, `toBeBefore` returns ZERO matches - PASS
- Every research figure appears only inside an explicitly-labelled prediction callout - PASS (the one research quotation added by this plan is the Finding 3 / A1 blockquote in `### Axis 2`, prefixed "Research prediction, quoted beside the measurement -- NOT this record's numbers")

Human-check item (Task 2), self-confirmed under the dispatch brief, with its evidence:

- **"Read the requirement-coverage table and confirm each row's answered-by section genuinely answers the requirement's own words, and that any row this record does NOT satisfy is marked as deferred to a named later plan rather than reported as covered":** CONFIRMED. Each of the six rows was read against `REQUIREMENTS.md:199-246` line by line, not against `ROADMAP.md`'s paraphrase -- which is how the paraphrase's stale numbering was caught. **One row is marked NOT satisfied: PARITY-03**, with 08-05 named for the outcome and 08-06 named for the enforcement, plus its own sub-section stating that this record's job for it was the measurement. PARITY-05's row was specifically checked for the same-OS reading the requirement asks for (workstation versus `windows-11-arm`, not cross-OS) and is presented as a pair with the cross-OS value beside it. PARITY-06's row was checked on all four observation points via a four-column table rather than sampled.

---

_Phase: 08-nx-task-hash-parity_
_Completed: 2026-07-28_
