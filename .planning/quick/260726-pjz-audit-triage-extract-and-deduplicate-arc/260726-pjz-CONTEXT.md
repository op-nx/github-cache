# Quick Task 260726-pjz: Extract and deduplicate ARCHITECTURE-DECISION.md - Context

**Gathered:** 2026-07-26
**Status:** Ready for planning
**Mode:** --full --auto (gray areas auto-resolved; one deliberately NOT auto-locked, see below)

<domain>
## Task Boundary

Audit, triage, extract and deduplicate the contents of the custom
`.planning/ARCHITECTURE-DECISION.md` into canonical GSD artifacts. Choose the most natural home
for each remaining part, removing anything irrelevant or stale. Add intentional
progressive-disclosure links from top-level canonical `.planning/` artifacts, and optionally
`AGENTS.md` if relevant.

IN scope: content triage, extraction, deduplication, removal of stale content, inbound links.
OUT of scope: renaming the file (see Decision 3), rewriting archived milestone artifacts
(Decision 4), and any change to the CREEP controls themselves (this is a documentation
reorganisation, not a security-posture change).

</domain>

<decisions>
## Implementation Decisions

### 1. What counts as "canonical"

GSD-SHIPPED artifacts are canonical: `PROJECT.md`, `STATE.md`, `ROADMAP.md`, `REQUIREMENTS.md`,
`MILESTONES.md`, `RETROSPECTIVE.md`, `research/*` (STACK/FEATURES/ARCHITECTURE/PITFALLS/SUMMARY
all ship as templates), and `codebase/*` (gsd-codebase-mapper output).

`ARCHITECTURE-DECISION.md` is the ONLY project invention under `.planning/`.

CORRECTED BY RESEARCH: `spikes/` is CANONICAL GSD, not an invention -- 9 gsd-core references, it
is documented in `artifact-types.md:75-79`, written by `/gsd:spike`, and `next.md:202` scans
`spikes/*/README.md` for `verdict: PENDING`. This repo's layout matches the shipped one exactly.

VERIFIED (with a caveat that matters): `rg` over the GSD install returns ZERO references to
`ARCHITECTURE-DECISION` in any workflow, agent or template. The FIRST pass was unsound --
`~/.claude/gsd-core` is a SYMLINK and `rg` does not traverse it without `-L`, so it returned zero
hits for everything, which looks identical to a clean confirmation. Every negative was re-run
against the resolved path with a positive control. Any future check of the GSD install must use
`-L` or the resolved path.

USEFUL RECATEGORISATION: GSD documents a "Standing Reference Artifact" category (see
`.planning/METHODOLOGY.md` in the GSD taxonomy) -- project-scoped, `.planning/`-root, consumed by
workflows. That is the category this file belongs to, which is a better frame than "invention".

### 2. Disposition per section (from the pre-planning audit)

The file is 91 lines. Roughly 74 percent is already duplicated into canonical artifacts or is
spent history; ~26 percent (the C1-C18 control ledger) has no canonical home.

| Section | Lines | Disposition |
|---------|-------|-------------|
| Framing (spike/PoC, sunk cost zero) | 3 | REMOVE - spent; the rebuild happened, MILESTONES.md carries v0.0.1 |
| Nx contract (fixed constraint) | 5 | MOVE to `PROJECT.md ## Constraints` |
| Decision 1 - one backend per process | 9 | REMOVE - already a PROJECT.md Key Decisions row |
| Decision 2 - write-trust + sync gate | 5 | REMOVE - already two Key Decisions rows |
| Decision 3 - Releases LOCKED | 12 | REMOVE - Key Decisions row + evidence in `.planning/spikes/001-005` |
| **Decision 4 - C1-C18 control ledger** | **24** | **KEEP** - no canonical home exists |
| Decision 5 - retention/LRU | 3 | REMOVE - already a Key Decisions row |
| Decision 6 - cross-OS correctness | 3 | REMOVE - already a Key Decisions row, and the one that DRIFTED |
| Consequences & spike scope | 6 | REMOVE - duplicated by `.planning/spikes/` READMEs |
| References | 5 | REMOVE - the corpus is already in `.planning/research/*` |

**Why the ledger cannot be extracted:** GSD models security strictly per-phase (a
`<threat_model>` block in PLAN.md, a per-phase SECURITY.md). There is no project-level control
register. `PROJECT.md ## Constraints` is the wrong shape - constraints are limits, controls are
mitigations - and 18 rows would swamp the section. Fragmenting the ledger into per-phase threat
models orphans cross-cutting controls: C1 applies to every future phase, so it cannot live in
Phase 5's SECURITY.md.

**Deletion, not annotation.** Decision 6 currently reads "Default to OS-namespacing the store"
with no supersession note and the file has ZERO mentions of v0.0.2, while PROJECT.md marks that
same decision `[WARN] SUPERSEDED in v0.0.2`. Two sources of truth, already disagreeing. Deleting
the duplicate removes the drift surface; annotating it would only patch one instance.

### 3. Renaming the file - DELIBERATELY NOT AUTO-LOCKED

A slimmed file containing only a control ledger makes "ARCHITECTURE-DECISION" a misnomer, and
`THREAT-MODEL.md` / `CONTROLS.md` would be more honest.

This sits in the `--auto` TRAP QUADRANT: HIGH impact (9 current inbound references plus ~35
archived artifacts, a shipped `docs/trust-and-security.md` citation, and a source comment in
`actions-cache-backend.ts`) and NOT-HIGH confidence (the task description says extract,
deduplicate and link - it does not authorise a rename).

DECISION: do NOT rename in this task. Record it as a follow-up for an interactive decision.
Scope discipline resolves the trap quadrant here - the rename is simply not what was asked.

### 4. Archived artifacts are NOT updated

~35 archived v0.0.1 phase artifacts reference the ADR. They are historical records; rewriting
them would falsify history. Only CURRENT artifacts are updated. Archived references remain valid
because the file keeps its name (Decision 3).

### 5. Progressive-disclosure links

CORRECTED BY RESEARCH: **the file is NOT orphaned.** Nine current artifacts already link it,
including `STATE.md:95` and `ROADMAP.md`. So the work is to make the EXISTING links describe the
right thing, not to add missing ones -- more pointers would be motion, not progress. Reachability
was never the failure; the missing REVIEW CADENCE was (Decision 6).

Follow the shape GSD already models for annotated references, from
`workflows/discuss-phase/templates/context.md:84`:
`` `path/to/adr-or-spec.md` - [What it decides/defines that's relevant] ``. The ANNOTATION is the
load-bearing half. Optionally borrow the `(updated <date>)` suffix from `templates/state.md:25`,
whose documented purpose is to trigger a re-read when stale. There is no GSD convention named
"progressive disclosure" (zero hits install-wide), so follow the annotated-reference shape rather
than inventing one.

`AGENTS.md` is agent-facing Nx/worktree guidance, not project architecture. A pointer there is
Claude's discretion: add one only if a natural anchor exists, and skip it rather than inventing a
section.

### 6. Close the review gap

The root cause of the drift is that nothing schedules a review of this file.

CORRECTED BY RESEARCH -- the originally planned fix DOES NOT WORK. Adding the control ledger to
`PROJECT.md`'s `## Evolution` section buys nothing: neither `transition.md:190` nor
`complete-milestone.md:249` READS that section. Both carry hardcoded checklists, and `## Evolution`
is a TRANSCRIPT of those lists, not an input to them. Writing there would produce exactly the
inert artifact this task exists to fix.

WORKING FIX: those hardcoded checklists DO audit `## Key Decisions` (item 6) and `## Constraints`
(item 7) at every milestone. So attach the cadence to the existing Key Decisions row at
`PROJECT.md:143`, which already points at the file -- that row is audited every milestone by a
checklist that actually runs. The Nx-contract move into `## Constraints` picks up cadence for free
via item 7.

Guiding doctrine, quotable from GSD's own taxonomy: "A well-formatted artifact that no workflow
reads is inert -- the consumption mechanism is what gives an artifact meaning."

KNOWN AND ACCEPTED: the file trips `gsd health` W019 today and will still trip it after slimming
(verified by executing `isCanonicalPlanningFile`). `THREAT-MODEL.md` and `CONTROLS.md` trip it
identically, so the deferred rename gains nothing on that axis. W019's remediation text ("Move to
archive or delete if stale") is wrong for this file -- GSD's own METHODOLOGY.md trips it too, so
the checker and the taxonomy disagree and the taxonomy is the better authority. Do NOT act on W019.

### Claude's Discretion

- Exact wording of the extracted Nx-contract constraint in `PROJECT.md ## Constraints`.
- Whether the slimmed file keeps its `## Decision 4` heading or is restructured now that it is
  the only section (prefer restructuring for readability, without renaming the file).
- Whether an `AGENTS.md` pointer is warranted (Decision 5).

</decisions>

<specifics>
## Specific Ideas

- The two references OUTSIDE `.planning/` must keep resolving: `docs/trust-and-security.md` and
  the comment in `packages/github-cache/src/backend/actions-cache-backend.ts`. The docs drift
  guard covers the former, so a mistake there fails a test rather than rotting silently.
- Verify no canonical artifact is left asserting something the extraction deleted.

</specifics>

<canonical_refs>
## Canonical References

- `.planning/ARCHITECTURE-DECISION.md` - the file under triage
- `.planning/PROJECT.md` - `## Constraints`, `## Key Decisions`, `## Evolution`
- `.planning/spikes/001-005` - already holds the FOUND-01 evidence Decision 3 summarises
- GSD templates at `~/.claude/gsd-core/templates/` - the canonical artifact set

</canonical_refs>
