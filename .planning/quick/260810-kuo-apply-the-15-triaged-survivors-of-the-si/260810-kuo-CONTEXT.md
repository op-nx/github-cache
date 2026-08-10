# Quick Task 260810-kuo: Apply the 15 triaged survivors of the /simplify review of PR #16 - Context

**Gathered:** 2026-08-10
**Status:** Ready for planning
**Mode:** `--full --auto` (gray areas auto-locked; see the auto-lock discipline below)

<domain>
## Task Boundary

Apply exactly the 15 ACCEPT rows (A1..A15) from the `/simplify` multi-agent cleanup review of PR #16
(milestone v0.0.2, branch `gsd/v0.0.2-os-invariant-cross-os-sharing`).

Eight review agents ran: four lenses (reuse, simplification, efficiency, altitude) over the whole
diff, and four components in depth (CI + tooling config; hash-parity + root scripts; core lib +
backends; publish/roundtrip + spec suites). Scope excluded `.planning/`, `package-lock.json`, and the
generated `start-cache-server/index.js`.

QUALITY ONLY -- reuse, simplification, efficiency, altitude. This is not a correctness-bug hunt.

The full triage ledger, including every rejection with its authority and the nine UNRESOLVED items,
is reproduced in this task's PLAN.md. It was authored before any file was touched.

</domain>

<decisions>
## Implementation Decisions

### Scope -- locked to 15 items

A1 memoize `readRepoFile`; A2 memoize `jobBlock` + hoist its per-line `new RegExp`; A3 lazy-load the
six `nx/src/...` imports in `capture-hashes.mjs`; A4 hoist `createTaskHasher` out of the per-target
loop; A5 route three hand-rolled workspace-root walks through `repoFileUrl` and drop them from
`WORKSPACE_ROOT_WALK_EXCEPTIONS`; A6 extract the package-source-tree walk into `test/repo-file.ts`;
A7 replace the `SNIPPET_DISCRIMINATOR_SITES = 3` cardinality gate with a JSON parse over the fence;
A8 build the detector needles from `INVARIANT_TARGETS`; A9 call `mirroredByLabel` at the two
`read-back.ts` sites; A10 dedupe `probeTokenOf`; A11 delete two identity aliases; A12 delete the
Prettier-import-shape assertion; A13 hoist a duplicated fixture spawn; A14 collapse six
`no-restricted-imports` entries to a flatMap over three pairs; A15 collapse five identical
registration assertions to `it.each`.

### Rejections are NOT re-litigated

Three authorities closed a finding, in precedence order. The planner must not reopen any of them:

1. **A satisfied requirement.** Deleting `lib/compression-method.ts` contradicts **VER-05**, which
   mandates the module AND pre-rejects the reviewers' own alternative ("The value is NOT readable
   from the library ... this is an independent re-implementation and must mirror upstream EXACTLY";
   it must be *surfaced in the publish summary*, which `ACTIONS_STEP_DEBUG` does not do). Deleting
   the construction-time `mkdirSync` at `actions-cache-backend.ts:183` contradicts **VER-08**
   verbatim: it "live[s] in the shared read core ... and MUST NOT be 'unified' with the read path" --
   the finding IS that unification. Dropping the `required`-phrase half of
   `docs-same-os-claims.spec.ts` deletes DOCS-08 guards.
2. **DEC-2 / the seven v0.0.3 deferred items.** DEC-2 is a stated PR #16 decision, not merely a
   planning note.
3. **A recorded in-code decision.** `capture-hashes.mjs` clause 5 was MEASURED reachable both ways
   (`FORBIDDEN_TARGETS = []` and `= ['zzz']` each make it fail first), so the finding's premise is
   false. Clause 6 is genuinely unreachable but its contract block argues the retention: "RETAINED
   deliberately rather than deleted, because a deleted clause is indistinguishable from one that
   never existed."

### Auto-lock discipline (`--auto`)

Auto-lock ONLY what is low-impact or genuinely evidence-backed. Anything high-impact AND
not-high-confidence goes to the deferral record as UNRESOLVED. Where a gray area was high-impact but
MEASURABLE, it is auto-locked WITH a mandatory proof obligation -- measurement is what converts it to
high confidence, and this project's own practice is to measure rather than argue.

### G1 -- shape of the A6 walk extraction

Export a parameterised `packageSourceFiles(predicate)` from `src/test/repo-file.ts` plus the root
constant, and keep each of the three callers' own filter at the call site. LOW impact. Rationale: the
three copies differ ONLY in the filter, so parameterising the filter is what removes the duplication;
one copy's own docstring states the cost ("three copies of it are three chances to get the one
correctness detail wrong in a way that makes a guard silently scan nothing on one OS").

This is NOT deferred item **T4-5**. T4-5 defers RELOCATING the two package-scope assertions -- a
decision about where package-scope assertions belong. Extracting the walk PRIMITIVE leaves every
assertion exactly where it is.

### G2 -- A1 cache invalidation

A plain module-scope `Map<string, string>` with no invalidation, and a comment stating why that is
sound: `readRepoFile` is anchored on `import.meta.url`, and no spec writes into the repo tree it
reads (fixture writers use `mkdtemp` under `.nx/cache` or the OS temp dir). LOW impact, and the
premise is directly checkable -- the plan must check it rather than assume it.

### G3 -- A3 touches the milestone's evidence instrument (PROOF OBLIGATION)

`capture-hashes.mjs` produced the Phase 8 and Phase 11 hash records, and **T4-4** defers restructuring
it for exactly that provenance reason. Converting six static imports to `await import()` moves
module-load timing only; it changes no computed value.

AUTO-LOCKED WITH A PROOF OBLIGATION: the change is only acceptable if the executor MEASURES that a
record produced after the change is byte-identical to one produced before it (capture a record at the
pre-change tree, capture again after, compare). Without that measurement the item is not done. A4
(hoisting `createTaskHasher`) carries the same obligation and can share one measurement.

This is the distinction from T4-4: T4-4 defers SPLITTING the file into three programs. A3 and A4 move
no logic between programs and produce a provably identical record.

### G4 -- A9 and the `MIRRORED_BY_PREFIX` export

Change the two `read-back.ts` sites to call `mirroredByLabel(readerOs)`. Then MEASURE whether any
reference to `MIRRORED_BY_PREFIX` survives -- in production code or in a spec. Drop the export only
if nothing references it; if a spec pins it, leave the export and say so. Do not delete an export on
the assumption that it is unused.

### G5 -- commit granularity

Bisect-safe atomic commits grouped by mechanism, following the `260810-bxj` precedent (31 bisect-safe
commits for 27 items). Each commit leaves the suite green.

### G6 -- `eslint.config.mjs` (A14) rotates the `test` and `lint` task hashes

`nx.json` lists `{workspaceRoot}/eslint.config.mjs` in both `targetDefaults.test.inputs` and
`targetDefaults.lint.inputs`, so editing it rotates those two task hashes. Recorded so a reviewer does
not read it as a **T4-7a** violation: it is NOT. T4-7a is about editing `nx.json` ITSELF, whose bytes
Nx folds into EVERY task hash via the `workspace:[{workspaceRoot}/nx.json,...]` node -- including
`integration` -- and which would rotate all five for a semantically neutral refactor. Every item in
this task edits tracked source and therefore rotates the dependent hashes anyway; A14 is not special.
`nx.json` stays BYTE-UNCHANGED.

### Claude's Discretion

Ordering of the 15 items within the commit sequence; the exact `it.each` / `describe.each` table
shape for A15; helper naming in `src/test/repo-file.ts`.

</decisions>

<specifics>
## Specific Ideas

Two items are guard STRENGTHENING and must not be softened into cosmetic edits:

- **A7** replaces a cardinality gate that cannot localize. `SNIPPET_DISCRIMINATOR_SITES = 3` sits under
  a title claiming "once per target -- build, test and lint", but a count of 3 never proves three
  DIFFERENT target keys: deleting `lint` and adding a second entry under `build` keeps it green. This
  repo has recorded prior art on that exact shape. The fence is valid JSON, so the real invariant is
  one level down and trivially reachable.
- **A8** removes a silent hole. The detector hardcodes `build, typecheck, test, lint` twice while its
  own docstring cites `INVARIANT_TARGETS` as canonical, so adding a fifth member leaves the detector
  silently four-of-five. Both join products must stay byte-identical to today's literals, making this
  a no-verdict-change edit that converts a silent hole into a red test.

**No guard may be weakened.** If a guard reddens, change the CODE, not the guard -- the `260810-bxj`
precedent, where the one guard that reddened was closed by changing the code.

Dispatch note: execute on the MAIN TREE, not in a worktree. A junctioned `node_modules` makes esbuild
rewrite module paths so `check:action` reports false bundle drift, and `check:action` is a required
gate here. There is one plan, so worktree isolation buys no parallelism.

</specifics>

<canonical_refs>
## Canonical References

- `.planning/quick/260810-bxj-address-the-27-verified-survivors-of-the/260810-bxj-deferred-items.md`
  -- the seven v0.0.3 items (T4-1..T4-5, T4-7a, T4-8) and DEC-2. Two NEW items (U3, U5) are to be
  appended by this task.
- `.planning/REQUIREMENTS.md` -- VER-05, VER-07, VER-08, DOCS-08.
- `.planning/PROJECT.md:146` -- "changes made for this repo's own CI/hashing must never leak into the
  consumer contract" (the authority confirming U3).
- `.planning/RETROSPECTIVE.md` -- Top Lesson #1 (local gates cannot prove GitHub Actions runtime
  behaviour), which is why U4 and U9 are deferred rather than applied.
- PR #16 body, `## Key Decisions` -- DEC-1 and DEC-2.

</canonical_refs>
