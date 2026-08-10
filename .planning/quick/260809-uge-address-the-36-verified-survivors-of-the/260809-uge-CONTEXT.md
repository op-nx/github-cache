# Quick Task 260809-uge: Address the 36 verified survivors of the PR #16 review - Context

**Gathered:** 2026-08-09
**Status:** Ready for planning
**Mode:** `--full --auto` (discussion auto-resolved; no human checkpoint taken)

<domain>
## Task Boundary

Fix the 36 verified findings from the PR #16 multi-agent review of milestone v0.0.2
(OS-invariant cross-OS sharing). The complete finding set -- per-item location, concrete
failure scenario, smallest fix, and an explicit do-NOT-fix list -- is in
`260809-uge-FINDINGS.md` in this directory. That file is the authority; this file records
only the decisions taken before planning.

Branch `gsd/v0.0.2-os-invariant-cross-os-sharing`, base HEAD `c7793c4`. Battery green at
base: test 1079/1079 across 43 files, lint exit 0 forced-uncached, typecheck exit 0,
`check:action` exit 0, `pack:check` exit 0.

IN SCOPE: groups A (19 guard-strength items), B (3 CI gate items), C (6 code items),
D (12 comment/doc items), E (4 simplification items).

OUT OF SCOPE, and the planner must not re-open either list: the "Explicitly REJECTED"
and "Recorded, NOT fixed here" sections of the findings file.
</domain>

<decisions>
## Implementation Decisions

### Execution isolation -- sequential on the main tree, NOT a worktree
`workflow.use_worktrees` is `true` in project config, and it is OVERRIDDEN for this task.
Two independent reasons, both measured rather than assumed:
1. This task's per-commit acceptance battery includes `npm run check:action`, which
   compares the committed esbuild bundle against a fresh build. In a worktree with a
   junctioned `node_modules`, esbuild rewrites ~689 module paths with no source edit, so
   the gate reports FALSE drift. Only the main tree gives a true bundle verdict.
2. The work is one sequential executor producing ~25 dependent commits. There is no
   parallelism to gain, which is exactly the project's own AGENTS.md branch: "Plans
   sequentially dependent -> run sequential-on-main regardless of node_modules."

Confidence HIGH (documented, previously measured). Auto-locked.

### Plan size -- the 1-3 task quick-mode constraint is deliberately relaxed
Quick mode normally caps a plan at 1-3 tasks. 36 findings across ~25 atomic commits does
not fit that, and splitting into separate quick tasks would lose the shared ordering
constraints (the N-copy comment sweeps must land as single commits; the bundle rebuild
must ride along with its source edit). The plan may carry one task per commit group.

Confidence HIGH. Auto-locked. Recorded because a plan-checker scoping check will
otherwise flag the plan as oversized for quick mode -- that flag is expected and is not
a defect.

### Commit granularity -- bisect-safe, one group per commit
Every commit must independently pass
`npm run lint && npm run typecheck && npm run test && npm run check:action && npm run pack:check`.
A code change and the spec change covering it stay in ONE commit. All copies of an
N-copy comment claim stay in ONE commit -- a partially-corrected multi-copy comment is
this repo's named recurring defect and splitting it would ship the defect deliberately.

### ROBUST-04 -- bundle rebuild rides with its source edit
Any commit touching a `serve()`-reachable source (`actions-cache-backend.ts`,
`select-backend.ts`, `backend/types.ts`, `cache-archive-path.ts`, `cache-key.ts`,
`mirror-seed.ts`, `release-asset-name.ts`) MUST run `npm run build:action` and stage the
regenerated `start-cache-server/index.js` in the SAME commit. Affects groups 12, 13, 15,
16, 18. Prefer fixing C4 at the `action/index.ts` call site, which is NOT serve-reachable
and therefore needs no rebuild.

### C5 `ReadOnlyBackend` stays INTERNAL
Not exported from `src/index.ts`. D2-02 forbids new package exports this milestone, and
an internal type closes the hole without touching the consumer surface or the pinned
`public-surface.spec.ts` literal.

Confidence HIGH. Auto-locked.

### E2 `publishMirror` extraction lands LAST among code changes
The tail extraction is provably safe (the span reads only `readMisses`, `hashes.length`
and `mirrored`, all final by then) and emitted bytes must be unchanged. Sequencing it
last keeps a revert cheap if the byte-identity assertion fails.

### D12 `.planning` non-ASCII -- prose and emoji only, captures untouched
Convert em dashes and emoji in authored PROSE. Leave verbatim captured tool output
(vitest tick/cross marks in SUMMARY files) alone -- rewriting a recorded measurement to
satisfy a style rule falsifies evidence. Lands LAST and is separable.

### Never weaken a guard to make it pass
Several items make guards STRICTER. If a stricter guard goes red, the finding was real
and the CODE is what changes. A guard may not be relaxed, scoped down, or skipped to
reach green.

</decisions>

<unresolved>
## UNRESOLVED -- deliberately NOT auto-locked

### D4-optional: folding `alreadyPresent` into the read-miss tripwire
The findings file marks this OPTIONAL and separate from D4's comment retraction. It is
the one item in the trap quadrant: HIGH impact (it changes when a production warning
fires) and NOT-HIGH confidence (whether `alreadyPresent + readMisses === hashes.length`
produces false positives on a healthy run is unmeasured -- and the file records that the
obvious alternative, an attempted-only denominator, WAS measured firing on both legs of a
healthy run).

DO ONLY the comment retraction in group 19. Do NOT change the tripwire's firing
condition. Re-opening this needs a measurement against a real publish run, not a
judgement call in an autonomous pass.
</unresolved>

<specifics>
## Specific Ideas

Suggested commit grouping is enumerated in the invoking request and mirrored by the
findings file's own A/B/C/D/E structure: 25 groups, A1+A2 first (highest severity --
the `::add-mask::` guard protects a credential-exposure path), D12 last.
</specifics>

<canonical_refs>
## Canonical References

- `.planning/quick/260809-uge-address-the-36-verified-survivors-of-the/260809-uge-FINDINGS.md` -- the authority for every item
- `.planning/REQUIREMENTS.md` -- the 57 v0.0.2 requirements the findings are traced against
- `AGENTS.md` -- worktree decision rule, test-battery capture rule
- `CLAUDE.md` -- Nx task conventions
</canonical_refs>
