# Quick Task 260810-pvw: Apply the 26 triaged survivors of the /ponytail-review of PR #16 - Context

**Gathered:** 2026-08-10
**Status:** Ready for planning
**Mode:** `--full --auto` (gray areas auto-decided; see the trap-quadrant note below)

<domain>
## Task Boundary

Apply the 26 ACCEPTED items (P1..P26) from `260810-pvw-TRIAGE.md`, the triage ledger for the
`/ponytail-review` multi-agent over-engineering review of PR #16 (milestone v0.0.2).

IN SCOPE: P1..P26 only.
OUT OF SCOPE, and must not be re-opened:
- the 7 REJECTs (VER-05, trust-boundary input validation, D2-01's `integration` discriminator,
  D2-03's comment locks, quick `260803-fcd`'s burned-tag skip, M3, DEC-1, T4-5)
- the 13 DEFERs (U2, U5, U6, U8, T4-3, plus the two NEW items N1 and N2)
- `.planning/`, `package-lock.json`, and the generated `start-cache-server/index.js`

</domain>

<decisions>
## Implementation Decisions

### Commit granularity
One commit per ACCEPT GROUP, not per item and not one bulk commit. Five commits:
vacuous assertions (P1-P7), aliases and one-call-site indirection (P8-P11), real duplication
(P12-P22), the docs-gate triple assertion (P23), prose corrections (P24-P26). Each group is a
distinct MECHANISM, which is the axis the findings were deduped on, so a bisect lands on a
mechanism rather than on an arbitrary slice of 26 unrelated edits.

### Execution tree -- MAIN TREE, not a worktree
`workflow.use_worktrees` is `true` in config; this task deliberately deviates. Two reasons, both
measured:
1. `check:action` is a REQUIRED gate for this task and its verdict is only trustworthy in the main
   tree -- a junctioned `node_modules` in a worktree makes esbuild rewrite ~689 module paths with
   no source edit, producing FALSE drift.
2. There is ONE plan and ONE executor. Worktree isolation exists to keep parallel executors from
   colliding; with no parallelism there is nothing to isolate, so it is pure cost.
`AGENTS.md`'s own decision rule already says sequential work runs sequential-on-main.

### `faultSuffix` placement (P13)
Add the shared renderer as a new export in the EXISTING `lib/octokit-fault-reason.ts`. Do not
create a new `lib/` leaf. The three duplicated renderings already import from that module, so the
reuse rung is satisfied without adding a file.

### `nonSpecModules` placement (P12)
Move into `src/test/repo-file.ts` beside `packageSourceFiles`. This is the same destination and the
same shape as the already-applied `260810-kuo` A6 extraction, so it follows a landed precedent
rather than inventing a home.

### P22 sweep scope
Apply the `beforeAll`-returns-teardown collapse to ALL THREE sibling spec files in one pass, not
just `serve.spec.ts`. The finding is explicit that it is only worth doing as one sweep, because the
three files' comments cite their identical shape.

### Guard discipline (inherited, non-negotiable)
No guard is weakened. A guard that reddens gets the CODE changed, not the assertion deleted. Any
NEW "X subsumes this assertion" argument surfacing during execution must be settled by running the
mutation before acting -- the A12 precedent in `260810-kuo` reversed exactly that reasoning after
measuring `tsc --noEmit` exit 0 on the mutation.

### Claude's Discretion
Exact wording of the three prose corrections (P24-P26), provided each states the MEASURED fact and
does not delete the correction history around it.

</decisions>

<specifics>
## Specific Ideas

Three items are PROSE CORRECTIONS of measured-false claims, NOT deletions. Their measurements are
already done and must not be re-derived:

- **P24** `mirror-seed.spec.ts:33-36` -- the claim that a hardcoded 0/1/2 map "fails only there" is
  false; measured 22/22 passing. KEEP the test at `:66`; it uniquely catches hardcode PLUS a tuple
  reorder.
- **P25** `compare.spec.ts:837-841` -- the claim to be "invisible to every other gate ... it
  typechecks" is false; measured `TS2440` on top-level re-declaration and `TS6133` on
  function-scoped shadowing. KEEP the clause; it becomes the unique catcher once a second use site
  exists.
- **P26** `test/repo-file.ts:52-55` -- the memo rationale claims ci.yml "is read at four sites
  across four files"; vitest isolates per file by default, so each spec gets its own module
  registry and the memo cannot dedupe across files. The memo still earns its keep WITHIN one file.

P1 carries a corrected rationale too: `action/index.spec.ts:610` is redundant because
`mirror-seed.spec.ts` catches the identity mutation five ways off hand-authored literals
(`:59` x3, `:66` x3, `:82`, `:101`) -- NOT because it "can never fail", which the measurement
falsified.

</specifics>

<canonical_refs>
## Canonical References

- `.planning/quick/260810-pvw-apply-the-26-triaged-survivors-of-the-po/260810-pvw-TRIAGE.md` -- the
  triage ledger, authored before any file was touched. Authoritative for P1..P26, the 7 REJECTs and
  the 13 DEFERs.
- `.planning/quick/260810-kuo-apply-the-15-triaged-survivors-of-the-si/260810-kuo-TRIAGE.md` -- the
  `/simplify` triage whose authority precedence this pass inherits, and the source of the A12
  precedent.
- `.planning/quick/260810-kuo-apply-the-15-triaged-survivors-of-the-si/260810-kuo-deferred-items.md`
  -- U1..U9.
- `.planning/quick/260810-bxj-address-the-27-verified-survivors-of-the/260810-bxj-deferred-items.md`
  -- T4-1..T4-5, T4-7a, T4-8.
- `.planning/REQUIREMENTS.md` -- VER-05 and DOCS-08 are the two requirements that decide REJECTs in
  this pass.

</canonical_refs>

<auto_mode_note>
## `--auto` trap-quadrant check

The standing rule is that `--auto` must not lock a HIGH-IMPACT, NOT-HIGH-CONFIDENCE gray area.
Every decision above is low-impact and locally reversible: commit slicing, two placement choices
that follow landed precedent, a sweep scope the finding itself specifies, and an execution-tree
choice backed by a measured tooling fact.

The high-impact / low-confidence items were identified during triage and routed to the DEFERRAL
record instead of being auto-decided -- N1 (`docs-same-os-claims.spec.ts` prose-freeze overflow,
~59 frozen phrases against DOCS-08's four mandated sites) and N2 (the detector cron-minute clause
on a gate that has never executed). Neither is touched by this task.
</auto_mode_note>
