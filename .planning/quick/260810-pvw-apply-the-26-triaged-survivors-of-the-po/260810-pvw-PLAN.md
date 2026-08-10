---
quick_id: 260810-pvw
phase: quick-260810-pvw
plan: 01
type: execute
wave: 1
depends_on: []
autonomous: true
execution_tree: main
files_modified:
  - packages/github-cache/src/action/index.spec.ts
  - packages/github-cache/src/publish/publish-mirror.spec.ts
  - packages/github-cache/src/publish/publish-mirror.ts
  - packages/github-cache/src/backend/actions-cache-backend.spec.ts
  - packages/github-cache/src/backend/types.ts
  - packages/github-cache/src/hash-parity/compare.spec.ts
  - packages/github-cache/src/lib/release-asset-name.spec.ts
  - packages/github-cache/src/lib/compression-method.spec.ts
  - packages/github-cache/src/lib/cache-archive-path.spec.ts
  - packages/github-cache/src/lib/cache-key.spec.ts
  - packages/github-cache/src/lib/mirror-seed.spec.ts
  - packages/github-cache/src/lib/select-backend.spec.ts
  - packages/github-cache/src/lib/octokit-fault-reason.ts
  - packages/github-cache/src/public-surface.spec.ts
  - packages/github-cache/src/serve.spec.ts
  - packages/github-cache/src/cleanup/cleanup.ts
  - packages/github-cache/src/cleanup/cleanup.spec.ts
  - packages/github-cache/src/test/repo-file.ts
  - packages/github-cache/src/test/consumer-contract.ts
requirements:
  - P1
  - P3
  - P4
  - P5
  - P6
  - P8
  - P9
  - P10
  - P11
  - P12
  - P13
  - P14
  - P15
  - P16
  - P17
  - P18
  - P19
  - P21
  - P22
  - P24
  - P25
  - P26

must_haves:
  truths:
    - All 22 in-scope P-items are dispositioned at the anchor RESEARCH.md confirmed; P2, P7, P20 and P23 are untouched. P5 is applied at REDUCED scope (the :698 literal half only); P18 and P21 are measurement-gated and may legitimately land as MEASURED-BLOCKED.
    - No guard is weakened. Every deletion either removes a provably redundant assertion, or preserves the relational/subset half of the test it edits. Where a candidate was measured to be the unique catcher of a mutation, it is RETAINED and the retention is recorded.
    - No comment in the tree describes an assertion that no longer exists, and no deletion leaves an obituary comment naming what was removed.
    - check:action reports zero drift in the MAIN TREE after the group-B commit; if it drifts, the regenerated bundle lands in that same commit.
    - The full acceptance battery (test, lint, typecheck, format:check, check:action, fallow:ci) is green at HEAD.
    - Four commits, one per mechanism group, each individually green.
  artifacts:
    - packages/github-cache/src/test/repo-file.ts gains a shared nonSpecModules() returning BARE paths, and a shared leaf-import scan helper parameterised on the forbidden-prefix list.
    - packages/github-cache/src/lib/octokit-fault-reason.ts gains an exported faultSuffix renderer.
    - Four commits on branch gsd/v0.0.2-os-invariant-cross-os-sharing, in group order A, B, C, D.
  key_links:
    - P11's edit to backend/types.ts is the ONE serve()-reachable source in this task; it links to check:action in the main tree.
    - P16's two deletions link to src/test/consumer-contract.ts:10-14, which argues for the pins being deleted and must be corrected in the same commit.
    - P5's surviving :698 test links to its split comment: :699-701 argues for the deleted literal pin and must be corrected; :701-705 argues for the surviving subset half and stays.
    - P21's candidate assertions link to the D-23 comment at compare.spec.ts:189-190, which argues for exactly those assertions; the comment is corrected only if the measurement clears the cut.
    - P1's deletion links to the doc block at action/index.spec.ts:574-576, which describes both assertions.
    - P6's deletion links to the comment at release-asset-name.spec.ts:305-307, which cross-references it by name.
    - P22's three files link to serve.spec.ts:42-44 and select-backend.spec.ts:82-84, which assert all three share one shape; editing fewer than three falsifies both.
    - P12's shared helper returns BARE paths, so actions-cache-backend.spec.ts must re-prefix at each of its three call sites.
---

<objective>
Apply the 22 in-scope survivors (P1..P26 minus P2, P7, P20, P23) of the /ponytail-review
multi-agent over-engineering review of PR #16, as four mechanism-scoped commits.

Purpose: the triage ledger and the research pass are both complete. This plan is execution
only -- the ledger decides WHAT, the research decides WHERE, and this plan decides the order
and the gates. There is NO line-reduction target. An earlier -450 figure assumed the full
ledger scope and is stale: P5 was reduced to one half-deletion, and P18 and P21 may each
legitimately apply nothing. MEASURED-BLOCKED is a correct outcome, not a failure -- a net
smaller than expected is the gates working, and a line target is precisely the pressure
that produces the guard deletions this task exists to prevent.

Output: four commits (vacuous assertions, aliases/one-call-site indirection, real duplication,
prose corrections), full battery green at HEAD, check:action drift-free in the main tree.

CONTEXT.md locks FIVE commits, one per ACCEPT GROUP. This plan produces FOUR: the fifth group was
the docs-gate triple assertion, whose only member was P23, and research moved P23 out of scope
(it sits in the N1 file). The group emptied; the granularity rule is unchanged.
</objective>

<execution_context>
@~/.claude/gsd-core/workflows/execute-plan.md
@~/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/quick/260810-pvw-apply-the-26-triaged-survivors-of-the-po/260810-pvw-TRIAGE.md
@.planning/quick/260810-pvw-apply-the-26-triaged-survivors-of-the-po/260810-pvw-RESEARCH.md
@.planning/quick/260810-pvw-apply-the-26-triaged-survivors-of-the-po/260810-pvw-CONTEXT.md
@AGENTS.md
</context>

<standing_rules>
These apply to EVERY task below. They are not repeated per item.

1. **Execution tree: the MAIN TREE.** Do not create a worktree. check:action's verdict is only
   trustworthy here (a junctioned node_modules makes esbuild rewrite ~689 module paths with no
   source edit, producing FALSE drift).

2. **Guard discipline, non-negotiable.** No guard is weakened. A guard that reddens gets the
   CODE changed, not the assertion deleted. If a NEW "X subsumes this assertion" argument
   surfaces during execution, it MUST be settled by RUNNING THE MUTATION before acting. This
   is the A12 precedent: that reasoning class was accepted once, weakened the single-choke-point
   guard, and had to be reversed after measurement showed `tsc --noEmit` exiting 0 on the
   mutation. P18 AND P21 each ship with a mandatory measurement step, and BOTH gates are
   binding -- neither is advisory. Either may legitimately end in MEASURED-BLOCKED.

3. **No obituaries.** A deletion does not leave behind a comment naming what was removed. The
   repo already carries ~31 lines of obituary comment (deferred as U6); do not add to it.

4. **Prose travels with its subject.** Where an item deletes an assertion that a nearby comment
   describes, the comment correction lands in the SAME commit. Splitting them ships a false
   comment between commits.

5. **Anchors are excerpt-based.** Every line number in RESEARCH.md was read at HEAD 2f75c68 and
   drifts as edits land. Locate by the verbatim excerpt, not by the line number.

6. **Battery capture.** When running the battery, tee each run to a per-iteration log and capture
   the REAL exit code into a variable:
   `npm run test 2>&1 | tee "test-$(date +%s)-1.log"; status=${PIPESTATUS[0]}`
   Never `exit ${PIPESTATUS[0]}` inline. Nx caches terminal output for SUCCESSFUL runs only, so a
   failing run's output is destroyed by the re-run. Run a failing target once with
   `--skip-nx-cache --output-style=stream` BEFORE any re-run. Delete the logs before committing --
   an untracked workspace-root artifact pegs capture-hashes.mjs's workingTreeClean to false.

7. **Staging.** Never `git add .` / `-A` / `-u`. Stage by name.

8. **Out of scope, do not re-open.** P2, P7, P20, P23; the 9 REJECTs; the DEFERs (U2, U5, U6, U8,
   T4-3, N1, N2, N3); `.planning/`, `package-lock.json`, and `start-cache-server/index.js` as a
   hand-edited file (it is generated -- regenerate it via check:action if and only if it drifts).
</standing_rules>

<tasks>

<task type="auto">
  <name>Task 1: Group A -- vacuous and suite-level-redundant assertions (P1, P3, P4, P5, P6)</name>
  <files>
packages/github-cache/src/action/index.spec.ts
packages/github-cache/src/publish/publish-mirror.spec.ts
packages/github-cache/src/backend/actions-cache-backend.spec.ts
packages/github-cache/src/hash-parity/compare.spec.ts
packages/github-cache/src/lib/release-asset-name.spec.ts
  </files>
  <action>
Five deletions. Apply in this order; each is independent.

**P1 -- `action/index.spec.ts`.** Inside the `it.each` at `:592-618`, delete the single assertion
whose excerpt is `.split('/').at(-1)).not.toBe(RUN_ID)`. Keep the whole-URL assertion above it.
Then correct the describe's doc block at `:574-576`, which currently says the assertion is on the
whole url AND on the final path segment -- half of that is now gone. The corrected prose records
the MEASURED rationale from CONTEXT.md: the deleted clause is redundant at SUITE level because
`mirror-seed.spec.ts` catches the identity mutation five ways off hand-authored literals (`:59`,
`:66`, `:82`, `:101`). Do NOT write that it "can never fail" -- M1 measured that false (mutating
`mirrorSeedHash` to identity reddens 13 tests including this one).

**P3 -- `publish/publish-mirror.spec.ts`.** Delete the whole `it` at `:1471-1485` whose title
begins `the partial TARGET RATE is one half`. The project's own VERIFICATION.md calls it a
fixture-coupling lock, not a behaviour gate. Its named-constant import at `:15` becomes unused --
drop it from the import list too (lint will otherwise redden).

**P4 -- `backend/actions-cache-backend.spec.ts`.** Delete `:368` -- the `in`-operator membership
assertion sitting beside the `isWritableBackend(backend)` assertion at `:367`, which is DEFINED as
exactly that membership check (`backend/types.ts:86`). Keep `:367`. The doc block at `:350-353`
cites the membership form in prose and stays TRUE, so leave it alone. RESEARCH flagged three
UNNAMED siblings carrying the identical pair (`memory-backend.spec.ts:55-56`,
`releases-backend.spec.ts:178-179`, `cleanup.spec.ts:472-473`). Scope is the named site only --
do NOT sweep them; record them in the SUMMARY for the maintainer.

**P5 -- `hash-parity/compare.spec.ts`. REDUCED SCOPE -- one half-deletion, not three tests.**

  The ledger's premise is FALSE and plan-check measured it. `INVARIANT_TARGETS`,
  `REQUIRED_META_KEYS`, `LIKE_FOR_LIKE_META_KEYS` and `DIVERGENT_TARGET` are NOT literals from the
  same file: `compare.spec.ts:27-34` IMPORTS all four from `./compare.js`, where they are exported
  production constants (`compare.ts:82`, `:90`, `:99`, `:165`). These are hand-authored pins OF
  PRODUCTION VALUES -- the same deliberate guard pattern as `public-surface.spec.ts` and
  `mirror-seed.spec.ts`'s `PINNED_SEEDS`, not self-referential restatement.

  Measured consequences of the two whole-test deletions the ledger asked for:
  - `:682` is the ONLY assertion pinning `REQUIRED_META_KEYS` membership. The surviving subset
    assertion at `:711-713` asserts only that it CONTAINS the three like-for-like keys, so dropping
    `os` / `nodeVersion` / `graphState` from `compare.ts:99`, or adding an eighth key, goes
    UNCAUGHT. The relational partition at `:671-680` is about TARGETS and has no meta-key
    counterpart, so the fallback the ledger relied on does not exist.
  - `:662` is the ONLY test catching a swap between the invariant set and the divergent target.
    Mutating `compare.ts` to `DIVERGENT_TARGET = 'test'` with `INVARIANT_TARGETS` gaining
    `integration` leaves BOTH surviving relational assertions green (`:676` union equality, `:679`
    non-membership); only `:662` reddens.

  Both also carry argued-retention comments at `:683-686` -- triage authority #3, the same authority
  that moved P2 and P7 out of scope. So:

  - **RETAIN `:662` and `:682` UNDER AUTHORITY #3.** Do not delete them. Record the retention and its
    measured reason in the SUMMARY, the same way P2/P7/P20/P23 are recorded.
  - **APPLY only the `:698` half-deletion:** delete the literal-pin half at `:706-710`, keep the
    subset assertion at `:711-713` and the comment at `:701-705` that argues for it, and rename the
    test so its title describes the subset claim alone.
  - **Correct `:699-701` in this same commit.** That half of the comment argues for the literal pin
    being deleted and would otherwise describe an assertion that is gone. `:701-705` (the subset
    argument) stays.
  - No imports become unused (`INVARIANT_TARGETS` at `:409`, `:662`, `:676`, `:679`;
    `REQUIRED_META_KEYS` at `:682`, `:711`; `LIKE_FOR_LIKE_META_KEYS` at `:217`, `:712`).

**P6 -- `lib/release-asset-name.spec.ts`.** Delete the whole `it` at `:320-326` whose title begins
`pins the both-true count across the whole table to ZERO`. Two guards survive it and are what make
the aggregate redundant: the per-row `it.each` at `:311-318`, which asserts the both-true condition
row by row, and the `toHaveLength(26)` table-size lock at `:309`, which is what stops a row from
being deleted to satisfy the per-row check. The reworded comment at `:305-307` MUST name both --
it currently cross-references the deleted aggregate by name, and a reword that only drops the
reference would leave the reader with no account of why per-row plus table-size is sufficient.
  </action>
  <verify>
    <automated>npm run test 2>&1 | tee "t1-test-$(date +%s)-1.log"; s=${PIPESTATUS[0]}; echo "test exit=$s"</automated>
    <automated>npm run lint 2>&1 | tee "t1-lint-$(date +%s)-1.log"; s=${PIPESTATUS[0]}; echo "lint exit=$s"</automated>
    <automated>npm run typecheck</automated>
    <automated>git grep -c "PARTIAL_READ_MISS_WARN_RATIO" -- packages/github-cache/src/publish/publish-mirror.spec.ts; test $? -eq 1</automated>
    <automated>git grep -c "arrayContaining" -- packages/github-cache/src/hash-parity/compare.spec.ts</automated>
  </verify>
  <done>
- The final-path-segment assertion is gone from `action/index.spec.ts` and its doc block no longer
  claims two assertions; the replacement prose names the five `mirror-seed.spec.ts` literals.
- The partial-rate `it` and its now-unused import are gone from `publish-mirror.spec.ts`; `git grep`
  for that constant in that file returns no match (exit 1).
- `actions-cache-backend.spec.ts` keeps the `isWritableBackend` assertion and has lost only the
  membership duplicate; the three unnamed sibling sites are UNTOUCHED and recorded in the SUMMARY.
- `compare.spec.ts` has lost ONLY the literal half of `:698`. `:662` and `:682` are RETAINED under
  triage authority #3 and the retention is recorded in the SUMMARY with its measured reason. The
  relational partition test and the subset assertion both survive (`arrayContaining` still present),
  and `:699-701` no longer argues for a deleted assertion.
- The both-true count `it` is gone from `release-asset-name.spec.ts`, and the reworded comment at
  `:305-307` names both surviving guards: the per-row `it.each` and the `toHaveLength(26)` lock.
- test, lint and typecheck all exit 0. Test count decreased; zero failures.
- Committed as one commit: `refactor(260810-pvw): drop five vacuous or suite-redundant assertions`.
  </done>
</task>

<task type="auto">
  <name>Task 2: Group B -- aliases and one-call-site indirection (P8, P9, P10, P11)</name>
  <files>
packages/github-cache/src/lib/compression-method.spec.ts
packages/github-cache/src/public-surface.spec.ts
packages/github-cache/src/lib/select-backend.spec.ts
packages/github-cache/src/backend/types.ts
  </files>
  <action>
Four indirection removals. P10 is GATED -- read its paragraph before editing.

**P8 -- `lib/compression-method.spec.ts`.** Delete `:279` `const strippedSourceOf = stripLineComments;`
and rename its three in-file call sites (`:281`, `:320`, `:336`) to `stripLineComments`. This is the
third of the class `260810-kuo` A11 already cut two of. NOTE the ordering: RESEARCH prefers P14
(Task 3) first, because P14 deletes the tests holding two of those three call sites. The locked
commit granularity puts group B before group C, so rename all three here; Task 3 then deletes two of
them. The end tree is identical either way -- this is churn, not a correctness hazard.

**P9 -- `public-surface.spec.ts`** (NOT a `docs-*.spec.ts` file; the ledger's path is wrong and
RESEARCH relocated it). Delete the pure alias at `:83-85`:
`function readSource(relativePath: string) { return readRepoFile(relativePath); }`
and rename its three call sites (`:152`, `:160`, `:202`) to `readRepoFile`. Delete the comment block
at `:78-82` outright -- it exists solely to justify the alias ("THROUGH readRepoFile, not a second
copy of its body") and has no subject once the alias is gone. Reword `:61-64`, which names the alias
while making a still-true point about repo-relative paths.

**P10 -- `lib/select-backend.spec.ts`** (again NOT `actions-cache-backend.spec.ts`). Delete the
one-call-site helper at `:436-439`:
`function widened(withoutKnob: SelectOutcome, withKnob: SelectOutcome): boolean`
and inline it at its single call site `:515`.

  GATE -- the comment at `:510-514`, directly above that call site, is a warning against exactly the
  vacuous forms this edit could produce. It states that the implication is asserted by negating the
  QUANTIFIER, not a predicate, and names two forbidden shapes: an `if (withKnob === 'writable')`
  guard around the assertion, and a negated matcher inside a single call assertion (which this repo
  has shipped before). The ONLY correct inline is the boolean-identical, still-non-vacuous form:

      expect(withKnob === 'writable' && withoutKnob !== 'writable').toBe(false);

  If the inline cannot take that shape for any reason, STOP and leave P10 unapplied rather than
  ship a vacuous assertion. Also reword `:537`, which names the deleted helper in prose. The
  helper's own docstring at `:435` ("the single forbidden transition") is the sentence worth moving
  onto the inlined assertion.

**P11 -- `backend/types.ts`.** Delete the `readonly` modifier from `:66` `readonly put?: never;`,
and delete the two explanation lines at `:58-59` that exist only to say the modifier does nothing
("readonly is documentation, not the mechanism: it contributes nothing to assignability"). Keep the
rest of the docstring, including the `:61-63` note that `ReadOnlyBackend` is deliberately internal.

  This is the ONE serve()-reachable edit in the whole task. `backend/types.ts` is imported by
  `serve.ts:9` and `server/server.ts:9` and its path marker appears in the generated
  `start-cache-server/index.js`. The ledger's blanket claim that no P-item touches a
  serve()-reachable source is FALSE. The mitigating fact is that interfaces emit no JavaScript, so
  the bundle SHOULD be byte-unchanged -- VERIFY that, do not assume it. If `check:action` reports
  drift, the regenerated bundle is staged in THIS SAME commit (an action bundle that drifts out of
  step with its source fails the action-bundle-drift gate on that commit).
  </action>
  <verify>
    <automated>npm run check:action 2>&1 | tee "t2-action-$(date +%s)-1.log"; s=${PIPESTATUS[0]}; echo "check:action exit=$s"</automated>
    <automated>npm run test 2>&1 | tee "t2-test-$(date +%s)-1.log"; s=${PIPESTATUS[0]}; echo "test exit=$s"</automated>
    <automated>npm run typecheck</automated>
    <automated>npm run lint</automated>
    <automated>git grep -c "strippedSourceOf" -- packages/github-cache/src/lib/compression-method.spec.ts; test $? -eq 1</automated>
    <automated>git grep -c "readSource" -- packages/github-cache/src/public-surface.spec.ts; test $? -eq 1</automated>
    <automated>git grep -c "expect(withKnob === 'writable' && withoutKnob !== 'writable').toBe(false)" -- packages/github-cache/src/lib/select-backend.spec.ts</automated>
    <automated>git grep -c "function widened" -- packages/github-cache/src/lib/select-backend.spec.ts; test $? -eq 1</automated>
  </verify>
  <done>
- `strippedSourceOf` and `readSource` no longer exist in their files (grep exits 1 in both), and
  every former call site calls the real function directly.
- The alias-justifying comment block in `public-surface.spec.ts` is deleted, not reworded.
- `widened` is gone and its call site reads exactly the `expect(... && ...).toBe(false)` form above;
  there is no `if` guard and no negated matcher at that site. The `:537` prose no longer names it.
- `backend/types.ts` declares `put?: never` with no `readonly`, and the two lines explaining the
  modifier are gone.
- `check:action` exits 0. If it did not, the regenerated `start-cache-server/index.js` is staged in
  this same commit and the re-run exits 0.
- test, typecheck, lint all exit 0.
- Committed as one commit: `refactor(260810-pvw): remove three aliases and one no-op modifier`.
  </done>
</task>

<task type="auto">
  <name>Task 3: Group C -- real duplication (P12, P13, P14, P15, P16, P17, P18, P19, P21, P22)</name>
  <files>
packages/github-cache/src/test/repo-file.ts
packages/github-cache/src/test/consumer-contract.ts
packages/github-cache/src/lib/cache-key.spec.ts
packages/github-cache/src/lib/mirror-seed.spec.ts
packages/github-cache/src/lib/cache-archive-path.spec.ts
packages/github-cache/src/lib/compression-method.spec.ts
packages/github-cache/src/lib/octokit-fault-reason.ts
packages/github-cache/src/lib/select-backend.spec.ts
packages/github-cache/src/backend/actions-cache-backend.spec.ts
packages/github-cache/src/cleanup/cleanup.ts
packages/github-cache/src/cleanup/cleanup.spec.ts
packages/github-cache/src/publish/publish-mirror.ts
packages/github-cache/src/publish/publish-mirror.spec.ts
packages/github-cache/src/public-surface.spec.ts
packages/github-cache/src/serve.spec.ts
packages/github-cache/src/hash-parity/compare.spec.ts
  </files>
  <action>
Ten items, in this order. P12 and P15 both land helpers in `src/test/repo-file.ts`, so they go first
and together. P18 and P21 EACH ship with a MANDATORY measurement step; both are binding.

**P12 -- one walk primitive plus a per-caller path shape.** The two `nonSpecModules()` copies
(`backend/actions-cache-backend.spec.ts:784-788`, `lib/cache-key.spec.ts:100-104`) are NOT
byte-identical -- the ledger's premise is false. The `actions-cache-backend` copy appends
`.map((file) => \`${PACKAGE_SOURCE_ROOT}/${file}\`)`; the `cache-key` copy returns bare paths.
Move ONE `nonSpecModules()` into `src/test/repo-file.ts` beside `packageSourceFiles` (`:135`),
returning BARE paths -- `repo-file.ts:126-128` already prescribes exactly this resolution ("BARE
paths, not prefixed with the root ... the one that asserts on prefixed literals re-prefixes at its
own call site, which is a smaller and clearer contract than an options bag"). Then:
  - `cache-key.spec.ts`: delete the local copy, import the shared one, `:165` unchanged.
  - `actions-cache-backend.spec.ts`: delete the local copy, import the shared one, and re-prefix
    with `PACKAGE_SOURCE_ROOT` (already exported from `repo-file.ts:108`) at each of its three call
    sites `:840`, `:880`, `:904`.
  - `cache-key.spec.ts:133` names the shape in prose ("the same nonSpecModules() shape
    actions-cache-backend.spec.ts uses") -- update it to name the shared helper.

**P15 -- the true-leaf import scan, unified for TWO of three sites only.** AMBIGUOUS in the ledger;
RESEARCH resolved it. `cache-key.spec.ts:116-127` and `mirror-seed.spec.ts:144-155` share one shape
(read source, then N x `expect(source).not.toMatch(/from '...'/)`). `cache-archive-path.spec.ts:144-156`
does NOT -- it asserts an EXACT import-list equality, which its own comment at `:145-148` argues is
strictly stronger ("Equality, NOT a not.toContain: an exact import list fails on a builder reached
through a module the FORBIDDEN list never anticipated"). Consolidating all three onto the weaker
shape is a guard weakening. So: unify ONLY the two `not.toMatch` copies into one helper in
`src/test/repo-file.ts` taking the forbidden-prefix list as a parameter (the `packageSourceFiles(predicate)`
precedent), and LEAVE `cache-archive-path.spec.ts` alone. `mirror-seed.spec.ts` passes five prefixes
(it adds `../action`), `cache-key.spec.ts` passes four -- the parameter is what carries that
difference.

**P14 -- scan-site non-vacuity triads.** Each of `lib/cache-archive-path.spec.ts:167-197` and
`lib/compression-method.spec.ts:308-338` is clause 2 and clause 3 of a three-clause triad. Delete
clauses 2 and 3 at BOTH sites (32 generated cases total: `FORBIDDEN` has 14 needles,
`FORBIDDEN_RESULT_MEMBERS` has 2, times two clauses). KEEP clause 1 at both sites
(`cache-archive-path.spec.ts:163-165`, `compression-method.spec.ts:301-306`) -- that is the MANDATORY
non-vacuity control, and the prose at `:159-162` / `:298-300` refers to it and stays true. The owner
of the deleted clauses is `src/test/repo-file.spec.ts:45-73`, whose first two `it`s carry the same
names. Re-read both describe TITLES after the cut and reword if they now over-claim.

**P13 -- one fault-suffix renderer.** Three sites render `(status ..., code ..., message ...)`, but
only two are identical -- the ledger's "authored 3x" is false. Add a new export to the EXISTING
`src/lib/octokit-fault-reason.ts` (CONTEXT.md locks the placement; do not create a new `lib/` leaf):

    export function faultSuffix(error: unknown, messageOverride?: string): string

returning the same `(status ${statusOf(error) ?? 'unknown'}, code ${reason.code ?? 'unknown'},
message ${messageOverride ?? reason.message ?? 'unknown'})` string it replaces, computing
`reason` via the module's own `faultReason(error)`. A POSITIONAL optional override, not an options
bag -- `repo-file.ts:126-128` records the repo's preference for the smaller contract. Then:
  - `cleanup/cleanup.ts:164` -> `faultSuffix(error)`
  - `publish/publish-mirror.ts:1087` -> `faultSuffix(error)`
  - `publish/publish-mirror.ts:424` -> `faultSuffix(error, burnedTagMessage)` (this is the site with
    the extra fallback; the override is what keeps it on the shared renderer)
  Leave `publish-mirror.ts:360` alone -- it is a status-only rendering, not this class.
  The rendered strings are BYTE-IDENTICAL after the change, so the existing message-string
  assertions in `cleanup.spec.ts` and `publish-mirror.spec.ts` are the refactor's oracle: they must
  stay green untouched. If any reddens, the extraction changed behaviour -- fix the extraction, do
  not adjust the assertion. Check whether the now-possibly-unused `const reason = faultReason(error)`
  locals at `cleanup.ts:160` and `publish-mirror.ts:1018` still have other readers before deleting
  them; `publish-mirror.ts:341`'s `reason` feeds `:424` and may have other uses.
  `octokit-fault-reason.ts` is NOT in the serve() bundle (verified count 0), so this is bundle-safe.

**P16 -- drop the duplicated export self-checks.** In `public-surface.spec.ts`, delete `:166-168`
and `:170-179` (the group (c) value-export and type-export inline pins). KEEP `:181-193` (the env
knobs -- DOCS-10 MANDATES that pin) and KEEP `:195-198` (`MAX_CACHE_BODY_BYTES`). The counter-argument
is that group (c) already has the barrel EQUALITY at `:146` and `:155`, so the inline pin is a third
copy of the same list, whereas group (a) has no barrel to compare against. That reasoning must be
written INTO `src/test/consumer-contract.ts:10-14` in this same commit -- that docstring currently
argues for BOTH pins and would otherwise describe a pin that no longer exists. Same for
`public-surface.spec.ts:44` and `:53`.

**P17 -- drop the third copy of the miss test.** Delete `backend/actions-cache-backend.spec.ts:416-427`
(`returns a miss from either factory when restoreCache resolves undefined (VER-08)`). The sibling
arg-array test at `:390-414` stays and is the real "one get closure" claim; `:163` keeps the
writable-factory miss. (RESEARCH assumption A1: the ledger does not enumerate copies 1 and 2, so the
survivor is identified from "the sibling arg-array test is the real claim". If the file makes a
different reading obvious once open, record the deviation rather than forcing this one.)

**P18 -- VER-04's four throw tests. MEASURE FIRST, THEN CUT.** All four
(`:966`, `:974` writable; `:1014`, `:1021` read-only) exercise ONE construction guard, because
`actions-cache-backend.ts:286` composes the writable factory as `{...createReadOnlyActionsCacheBackend(), put}`.
But VER-04 is a named requirement and two in-code blocks (`:864-868`, `:1005-1009`) argue the
READ-ONLY pair matters MORE. The locked discipline forbids acting on a subsumption argument without
measuring it.

  The four tests are CONJUNCT-SPECIFIC, not conjunction-wide: `:966` and `:1014` assert
  `toThrow(/nx\.json/)`, `:974` and `:1021` assert `toThrow(/GITHUB_WORKSPACE/)`. So each mutation
  is expected to redden TWO of the four, one per factory. Do not phrase the criterion as a
  reddening COUNT -- phrase it as SURVIVING COVERAGE:

  1. Break conjunct 1 (`nx.json`) in `backend/actions-cache-backend.ts`, run the file's tests, record
     the reddening SET. Revert.
  2. Break conjunct 2 (`GITHUB_WORKSPACE`), run, record the reddening set. Revert.
  3. **Delete a pair only if EVERY mutation is still caught by a test that SURVIVES the cut.**
     Otherwise apply NOTHING and record P18 as MEASURED-BLOCKED in the SUMMARY with both transcripts.
  4. Under the expected outcome (conjunct 1 reddens `:966` + `:1014`; conjunct 2 reddens `:974` +
     `:1021`), deleting the WRITABLE pair `:966` / `:974` satisfies step 3 -- `:1014` still catches
     conjunct 1 and `:1021` still catches conjunct 2 -- and it agrees with the two in-code blocks
     arguing the read-only pair matters more. Deleting the read-only pair would satisfy step 3
     arithmetically too; do NOT take that option, because it contradicts those blocks.
  5. If either mutation reddens fewer than two tests, or reddens tests on only one factory, the
     composition premise is wrong -- stop and record MEASURED-BLOCKED rather than improvising.
  Record both transcripts in the SUMMARY either way -- they are the evidence for the cut.

**P19 -- shrink the census fixture, keep the measured record.** `cleanup/cleanup.spec.ts:212-236` is
a MEASURED record (shard `cache-mirror-202607`, release id 354838660, read live 2026-07-29, recorded
in `10-EVIDENCE-PRE-RENAME.md`), not an invented fixture. Reduce the GENERATED row counts from 122 to
7 while KEEPING the census NUMBERS in the comment at `:212-222` as the recorded measurement, so the
evidence link survives -- reword it to say the fixture MODELS that shard at reduced scale rather than
reproducing its counts. Four regions move in step: the comment `:212-222`, the constants `:223-226`,
the three generation loops `:263-284`, and the arithmetic locks `:318-322`. Do NOT delete `:318` --
re-point it at the new constants, or the fixture-shape lock argued for at `:314-317` is gone. Every
asset family must still be exercised at least once (the predicate is stateless, which is the whole
basis of the item).

**P21 -- two prose substrings. GATED by the same surviving-coverage criterion as P18.** In
`hash-parity/compare.spec.ts`, the candidates are `:194` and `:195` (`toContain('upload')` /
`toContain('download')`). The ledger's rationale -- "the reason-code enum is asserted separately in
the same tests" -- does NOT hold: plan-check verified these two strings are asserted ONLY here, they
pin production strings from `compare.ts:382-383`, and the test's own D-23 comment at `:189-190`
argues for naming all three suspects rather than reporting a count.

  So measure before cutting, with P18's criterion: drop one suspect name from the detail string in
  `compare.ts:382-383` and confirm a SURVIVING assertion reddens. If the only clause that reddens is
  one of `:194`/`:195` themselves, they are unique catchers -- apply NOTHING and record P21 as
  MEASURED-BLOCKED in the SUMMARY.

  If the cut does proceed, `:193` (`toContain('if-no-files-found')`) becomes the sole assertion of
  that `it`, and BOTH the test title AND the D-23 comment at `:189-190` must be corrected in the
  same commit -- that comment argues for exactly the assertions being deleted.

**P22 -- beforeAll returns its own teardown, across all three siblings.** vitest 4.1.10 is installed
and `enterWorkspaceRootCwd()` returns its teardown closure (`src/test/workspace-root-cwd.ts:106-120`),
so the whole 8-line hook block collapses to `beforeAll(() => enterWorkspaceRootCwd());`. Apply to ALL
THREE, in one commit -- `serve.spec.ts:45-53`, `lib/select-backend.spec.ts:85-93`,
`backend/actions-cache-backend.spec.ts:117-125`. Editing fewer than three falsifies two in-file
comments (`serve.spec.ts:42-44` "same shape in all three files"; `select-backend.spec.ts:82-84` "an
ASYMMETRICAL hook in THIS file would be the most visible possible inconsistency"). Import asymmetry:
the `afterAll` import DROPS in `serve.spec.ts` (`:6`) and `select-backend.spec.ts` (`:7`), but STAYS
in `actions-cache-backend.spec.ts` (`:13`) -- it has a second `afterAll` at `:943`. Leave
`capture-hashes-cli.spec.ts:179-191` alone; CONTEXT.md fixes the sweep at three files.
  </action>
  <verify>
    <automated>npm run test 2>&1 | tee "t3-test-$(date +%s)-1.log"; s=${PIPESTATUS[0]}; echo "test exit=$s"</automated>
    <automated>npm run typecheck</automated>
    <automated>npm run lint</automated>
    <automated>test "$(git grep -l 'function nonSpecModules' -- packages/github-cache/src | wc -l)" -eq 1</automated>
    <automated>git grep -c "export function faultSuffix" -- packages/github-cache/src/lib/octokit-fault-reason.ts</automated>
    <automated>git grep -c "toEqual(\[\"import type { Hash } from './cache-key.js';\"\])" -- packages/github-cache/src/lib/cache-archive-path.spec.ts</automated>
    <automated>git grep -c "restoreCwd" -- packages/github-cache/src/serve.spec.ts packages/github-cache/src/lib/select-backend.spec.ts packages/github-cache/src/backend/actions-cache-backend.spec.ts; test $? -eq 1</automated>
  </verify>
  <done>
- `nonSpecModules` is declared exactly once in the package, in `src/test/repo-file.ts`, returns BARE
  paths, and `actions-cache-backend.spec.ts` re-prefixes at all three of its call sites.
- The leaf-import scan helper is shared by `cache-key.spec.ts` and `mirror-seed.spec.ts` only;
  `cache-archive-path.spec.ts` still carries its stronger exact-import-list equality untouched.
- Clause 1 of both scan triads survives; clauses 2 and 3 are gone at both sites; `repo-file.spec.ts`
  is unmodified.
- `faultSuffix` is exported from `octokit-fault-reason.ts` and used at all three rendering sites, one
  of them with the burned-tag message override. Every pre-existing message-string assertion in
  `cleanup.spec.ts` and `publish-mirror.spec.ts` is UNCHANGED and green.
- The two group (c) inline export pins are gone; the env-knob pin and `MAX_CACHE_BODY_BYTES` remain;
  `consumer-contract.ts:10-14` and `public-surface.spec.ts:44`/`:53` describe what actually exists.
- The third miss-test copy is gone; the arg-array test and the writable-factory miss both remain.
- P18: both conjunct mutations were RUN and their reddening SETS are recorded in the SUMMARY. Either
  the writable pair is deleted BECAUSE every mutation is still caught by a surviving test, or nothing
  was deleted and P18 is recorded as MEASURED-BLOCKED with both transcripts. No pair was deleted on
  argument alone, and the criterion applied was surviving coverage, not a reddening count.
- The census fixture generates 7 rows, still exercises every asset family, still carries its measured
  provenance numbers, and the arithmetic lock points at the new constants rather than being deleted.
- P21: the suspect-name mutation was RUN. Either the two substring assertions are gone with the test
  title AND the D-23 comment at `:189-190` corrected in this same commit, or they were measured to be
  unique catchers and P21 is recorded as MEASURED-BLOCKED. `if-no-files-found` survives either way.
- All three sibling specs use the one-line `beforeAll(() => enterWorkspaceRootCwd());` form, no
  `restoreCwd` remains in any of them (grep exits 1), and the `afterAll` import is dropped in exactly
  two of the three.
- test, typecheck, lint all exit 0.
- Committed as one commit: `refactor(260810-pvw): collapse ten duplicated spec and rendering sites`.
  </done>
</task>

<task type="auto">
  <name>Task 4: Group D -- prose corrections of measured-false claims (P24, P25, P26)</name>
  <files>
packages/github-cache/src/lib/mirror-seed.spec.ts
packages/github-cache/src/hash-parity/compare.spec.ts
packages/github-cache/src/test/repo-file.ts
  </files>
  <action>
Three comment corrections. NO assertion is deleted by this task and no test changes. The
measurements are already done and recorded in the TRIAGE ledger -- do NOT re-derive them, and do NOT
convert any of these into a deletion. Wording is Claude's discretion, provided each states the
MEASURED fact and does not delete the correction history around it.

**P24 -- `lib/mirror-seed.spec.ts:33-36`.** The claim that "a hardcoded 0/1/2 mapping satisfies every
literal in this file and fails only there" is FALSE: measured, a hardcoded `{windows:0, macos:1,
linux:2}` map passes 22/22. Correct it to state what the derived check at `:66` UNIQUELY catches --
the COMPOSITE of a hardcode PLUS a tuple reorder: reorder the tuple to `[linux, macos, windows]` and
the pinned literals at `:59` still pass while `:66` reddens. Note also, because it is the reason no
stronger claim is available, that a map returning identical output for every input is not an
observable mutation, so no test can catch a hardcode alone. Keep the test at `:66`.

**P25 -- `hash-parity/compare.spec.ts:837-841`.** This is a failure-message string literal; the
matcher at `:842` is untouched. The claim that a second authored copy "is invisible to every other
gate in the battery -- it typechecks, it lints" is FALSE in both reachable states: a top-level
re-declaration alongside the import produces `TS2440`, and function-scoped shadowing of the only use
site produces `TS6133` (and `:842` fails, the single failing test of 46). Correct it to state that
the clause is SUBSUMED TODAY by typecheck, and that it becomes the unique catcher the moment a
SECOND use site is added -- at which point shadowing one site no longer trips `TS6133`. That is why
the clause is kept rather than deleted.

**P26 -- `src/test/repo-file.ts:74-76`** (the ledger's `:52-55` is WRONG -- that range is the
`REPO_FILE_CACHE` writer-disjointness docstring and says something else entirely). The false sentence
is in the `readRepoFile` docstring: "three specs loop over every package module, and
`.github/workflows/ci.yml` alone is read at four sites across four files". BOTH halves are false for
the same reason -- vitest isolates per file by default, so each spec gets its own module registry and
`REPO_FILE_CACHE` cannot dedupe across files. Correct BOTH clauses, not only the ci.yml one, and
state the memo's surviving justification: it still earns its keep WITHIN one file
(`docs-same-os-claims.spec.ts` alone reads `ci.yml` many times).
  </action>
  <verify>
    <automated>npm run test 2>&1 | tee "t4-test-$(date +%s)-1.log"; s=${PIPESTATUS[0]}; echo "test exit=$s"</automated>
    <automated>npm run typecheck</automated>
    <automated>npm run lint</automated>
    <automated>npm run format:check</automated>
    <automated>git diff --stat HEAD -- packages/github-cache/src/lib/mirror-seed.spec.ts packages/github-cache/src/hash-parity/compare.spec.ts packages/github-cache/src/test/repo-file.ts</automated>
    <automated>test -z "$(git diff HEAD --name-only -- packages/github-cache/src | rg -v 'mirror-seed.spec.ts|compare.spec.ts|test/repo-file.ts')"</automated>
  </verify>
  <done>
- All three corrected passages state the MEASURED fact (22/22 pass; TS2440 and TS6133; per-file
  module registry isolation) and none deletes the surrounding correction history.
- The P26 correction covers BOTH false clauses, not only the ci.yml one.
- Zero assertions changed: the diff for this commit touches comment lines and string literals only,
  and the test count is identical before and after.
- test, typecheck, lint and format:check all exit 0.
- Committed as one commit: `docs(260810-pvw): correct three measured-false comments`.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| GitHub Actions runner -> generated `start-cache-server/index.js` | The consumer bundle is what adopters execute; a drifted bundle is code nobody reviewed. P11 is the one edit inside its import graph. |
| Untrusted GitHub API error payloads -> log output | P13 relocates the renderer that interpolates `status`/`code`/`message` from API error objects into log strings. |

No new package-manager installs, so no Package Legitimacy Gate applies to this task.

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-pvw-01 | Tampering | `start-cache-server/index.js` vs `backend/types.ts` (P11) | medium | mitigate | `npm run check:action` in the MAIN TREE is a Task 2 verify gate. Drift, if any, is regenerated and staged in the SAME commit. The main-tree requirement is itself the mitigation for the false-drift verdict a junctioned worktree produces. |
| T-pvw-02 | Information disclosure | `faultSuffix` renderer (P13) | low | accept | The extraction is byte-identical to the three strings it replaces and the `messageOverride` parameter carries only an already-logged value. No new field is interpolated, so the disclosure surface is unchanged. Existing message-string assertions in both specs are the regression oracle. |
| T-pvw-03 | Tampering | VER-04 / VER-08 construction guards (P17, P18, P21) | high | mitigate | P18 and P21 each ship a mandatory measurement before any deletion, judged by SURVIVING COVERAGE: a pair is deleted only if EVERY mutation is still caught by a test that survives the cut. Otherwise apply nothing and record MEASURED-BLOCKED. The superseded unique-catcher/reddening-count rule is NOT the criterion -- it was unsatisfiable, since each conjunct-specific mutation reddens exactly two of the four tests. P17's survivor-of-record is the shared-get-closure argument-array test at `actions-cache-backend.spec.ts:390-414`. |
| T-pvw-04 | Repudiation | `cleanup.spec.ts` census provenance (P19) | low | mitigate | The measured shard numbers and the `10-EVIDENCE-PRE-RENAME.md` citation stay in the comment; only the GENERATED row count shrinks, so the evidence link survives the fixture change. |
</threat_model>

<verification>
Run the FULL acceptance battery once, uncached, at HEAD after the fourth commit. All six must exit 0:

```
npm run test
npm run lint
npm run typecheck
npm run format:check
npm run check:action
npm run fallow:ci
```

Capture per-run with the tee/`${PIPESTATUS[0]}` idiom from standing rule 6, then DELETE the logs
before the final state check -- an untracked workspace-root artifact pegs `capture-hashes.mjs`'s
`workingTreeClean` to false.

Additional checks, none of which the battery makes for you:

1. **Bisect safety.** Each of the four commits is individually green on test + typecheck + lint. Run
   the battery after each commit, not only at the end. Full per-commit gating on all six gates is
   4 checkouts x 6 gates; if it is not run, say so explicitly in the SUMMARY rather than implying it.
2. **Out-of-scope files unchanged.** `git diff --stat <base>..HEAD` must show NO change to
   `.planning/` (beyond this task's own artifacts), `package-lock.json`, `nx.json`, or `.github/`.
   `start-cache-server/index.js` appears only if `check:action` regenerated it, and then only in the
   group-B commit.
3. **Scope discipline.** P2, P7, P20, P23 appear NOWHERE in the diff. So do the three unnamed P4
   sibling sites, `capture-hashes-cli.spec.ts`, `docs-same-os-claims.spec.ts`,
   `read-integration-hash.integration.spec.ts`, and `repo-file.spec.ts`.
4. **Guard-count sanity.** Record test count before and after. It must DECREASE, and no test may go
   from passing to failing. Any test that reddens during execution is a signal that a guard was
   load-bearing -- change the CODE or drop the item, never the assertion.
</verification>

<success_criteria>
- 22 items dispositioned; 4 items (P2, P7, P20, P23) provably untouched.
- 4 commits, one per mechanism, in group order A -> B -> C -> D, each individually green. Four, not
  the five CONTEXT.md names, because the docs-gate group emptied when P23 left scope.
- `check:action` exits 0 at HEAD in the MAIN TREE.
- All six battery gates exit 0 at HEAD.
- P18's and P21's mutation measurements are recorded in the SUMMARY with their verdicts, whichever
  way they went. MEASURED-BLOCKED is a legitimate outcome for either and is not a failure.
- P5's retention of `:662` and `:682` under triage authority #3 is recorded with its measured reason.
- Net line change is a reduction. RESEARCH's -450 estimate assumed the full ledger scope; the reduced
  P5 and the two gated items make a smaller reduction expected. Do not treat -450 as a target.
- No comment in the tree describes an assertion that no longer exists.
</success_criteria>

<output>
Create `.planning/quick/260810-pvw-apply-the-26-triaged-survivors-of-the-po/260810-pvw-SUMMARY.md`
when done. It MUST record, at minimum:
- Per-item disposition for all 22 (APPLIED / REDUCED / RETAINED / MEASURED-BLOCKED) with the reason.
- P5: that `:662` and `:682` were RETAINED under triage authority #3, with the measured reason (each
  is the unique catcher of a production-constant mutation), and that only the `:698` literal half
  was applied.
- P18's two mutation transcripts, the reddening SET per mutation, and the surviving-coverage
  argument for whichever pair was cut (or the reason none was).
- P21's mutation transcript and whether the cut cleared the surviving-coverage criterion.
- Whether `check:action` drifted after the P11 edit, and if so what was regenerated.
- The three unnamed P4 sibling sites, flagged for the maintainer, explicitly NOT swept.
- Test count before and after.
- Whether full per-commit gating on all six gates was run, stated plainly either way.
</output>
