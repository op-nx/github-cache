---
phase: 260809-uge
plan: 01
type: execute
wave: 1
depends_on: []
autonomous: true
requirements:
  [
    A1, A2, A3, A4, A5, A6, A7, A8, A9, A10, A11, A12, A13, A14, A15, A16, A17, A18, A19,
    B1, B2, B3,
    C1, C2, C3, C4, C5, C6,
    D1, D2, D3, D4, D5, D6, D7, D8, D9, D10, D11, D12,
    E1, E2, E3, E4,
  ]
files_modified:
  # `.planning/` is diff-scoped at execution time by task 30 -- the exact file list is
  # `git diff --name-only origin/main...HEAD -- .planning` computed then, not enumerable now.
  - .planning/
  - .github/workflows/ci.yml
  - README.md
  - docs/cross-os.md
  - packages/github-cache/src/action/index.spec.ts
  - packages/github-cache/src/action/index.ts
  - packages/github-cache/src/backend/actions-cache-backend.spec.ts
  - packages/github-cache/src/backend/actions-cache-backend.ts
  - packages/github-cache/src/backend/memory-backend.ts
  - packages/github-cache/src/backend/releases-backend.ts
  - packages/github-cache/src/backend/types.ts
  - packages/github-cache/src/capture-hashes-cli.spec.ts
  - packages/github-cache/src/cleanup/cleanup-workflow.spec.ts
  - packages/github-cache/src/cleanup/cleanup.ts
  - packages/github-cache/src/docs-adoption.spec.ts
  - packages/github-cache/src/docs-cross-os.spec.ts
  - packages/github-cache/src/docs-same-os-claims.spec.ts
  - packages/github-cache/src/dogfood-cross-os.spec.ts
  - packages/github-cache/src/hash-parity/compare.spec.ts
  - packages/github-cache/src/hash-parity/compare.ts
  - packages/github-cache/src/lib/cache-key.spec.ts
  - packages/github-cache/src/lib/cache-key.ts
  - packages/github-cache/src/lib/octokit-fault-reason.ts
  - packages/github-cache/src/lib/release-asset-name.spec.ts
  - packages/github-cache/src/lib/release-asset-name.ts
  - packages/github-cache/src/lib/select-backend.spec.ts
  - packages/github-cache/src/lib/select-backend.ts
  - packages/github-cache/src/nx-target-inputs.spec.ts
  - packages/github-cache/src/ppe/ppe-action.spec.ts
  # publish-mirror.spec.ts is deliberately ABSENT: task 27's <done> requires it UNCHANGED, which is
  # the byte-identity proof. If it needs editing, the extraction was not byte-identical.
  - packages/github-cache/src/publish/publish-mirror.ts
  - packages/github-cache/src/test/repo-file.ts
  - packages/github-cache/src/windows-regression-detector.spec.ts
  - start-cache-server/index.js

must_haves:
  truths:
    - "Every one of the 44 enumerated findings (A1-A19, B1-B3, C1-C6, D1-D12, E1-E4) has a landed change; nothing from the 'Explicitly REJECTED' or 'Recorded, NOT fixed here' sections is touched."
    - "Each of the 30 commits independently passes `npm run lint && npm run typecheck && npm run test && npm run check:action && npm run pack:check` in the MAIN tree."
    - "Every commit that edits a serve()-reachable source stages a regenerated `start-cache-server/index.js` in that same commit; `check:action` is clean at every commit."
    - "No guard was relaxed, scoped down, skipped or deleted to reach green. Where a stricter guard went red, the production code changed."
    - "Each N-copy claim correction (A17+D9+D11, D1, D4, D3+D10) lands with every copy of that claim in ONE commit; no commit leaves a partially-corrected multi-copy claim. D4 has TWO authored sites -- `publish-mirror.ts` and `docs-same-os-claims.spec.ts`."
    - "D4's tripwire FIRING CONDITION is unchanged -- only the false 'live rotation signal' comment is retracted."
    - "`ReadOnlyBackend` is declared in `backend/types.ts` and is NOT re-exported from `src/index.ts`; `public-surface.spec.ts` sees no diff."
    - "E1 and E2 change zero emitted warning bytes, proven by an emit-oracle diff captured before the edit."
    - "The D12 sweep is pinned to the PR-diff `.planning` file list and leaves every fenced or backtick-quoted captured measurement untouched."
  artifacts:
    - packages/github-cache/src/test/repo-file.ts
    - start-cache-server/index.js
    - .planning/quick/260809-uge-address-the-36-verified-survivors-of-the/260809-uge-SUMMARY.md
  key_links:
    - "Source edit <-> bundle: tasks 11, 16, 17, 20, 22, 24 touch serve()-reachable sources. `npm run build:action` + staging `start-cache-server/index.js` rides in the SAME commit, or `check:action` fails that commit."
    - "Task 01 before task 02: both edit `docs-adoption.spec.ts`, so task 02's finding line numbers shift. Locate by content, never by the line number in FINDINGS.md."
    - "Task 23 (D4 comment retraction) before tasks 27/28: E2 relocates the span that D4's comment sits in, so the correction must already be in place when the span moves."
    - "Task 27 (E1) before task 28 (E2): E1's site B lies inside the span E2 extracts."
    - "A17 (guard) and D9/D11 (the two other authored sites of the same claim) are one commit -- the guard change and the wording it makes true cannot be split."
---

# Quick 260809-uge: the PR #16 review survivors

## Why this exists

`260809-uge-FINDINGS.md` carries 44 verified findings across five groups, all confirmed against
source at HEAD `c7793c4` with the full battery green. Every item is therefore something the green
suite does not catch. That file is THE AUTHORITY for each item's location, failure scenario and
prescribed fix. This plan supplies only ordering, commit grouping and the per-commit gate.

`260809-uge-RESEARCH.md` corrects or sharpens four items (A8/A9, C5, E1, D12). **Where research and
findings disagree, research wins.**

Note on the count: the task title says 36 survivors; the findings file and CONTEXT.md both enumerate
44 across A(19) + B(3) + C(6) + D(12) + E(4). The enumeration is the contract. All 44 are planned.

## Scope note the plan-checker will flag, and should

Quick mode normally caps a plan at 1-3 tasks. CONTEXT.md deliberately relaxes that: 44 findings map
to 30 atomic commits and splitting into separate quick tasks would lose the shared ordering
constraints. A size flag from the checker is EXPECTED and is not a defect.

30 rather than the 25 sketched in CONTEXT. The extra commits come from the A group staying SPLIT by
spec file, so a bisect lands on one spec's guard rather than on a batch of unrelated ones. Five
merges pull the other way and are already priced in (D2+D4, D5+D6, D7+D8, B2+B3, E3+E4), each
merging findings that share a file and a claim. No finding was dropped or added.

<execution_rules>

## Rules that apply to EVERY task -- read once, obey thirty times

**1. Sequential on the MAIN tree.** No worktree. CONTEXT.md records the two measured reasons: a
junctioned `node_modules` makes esbuild rewrite ~689 module paths, so `check:action` reports FALSE
drift; and there is no parallelism to gain from 30 dependent commits.

**2. The gate is the same five commands for every task, in this order:**

```
npm run lint && npm run typecheck && npm run test && npm run check:action && npm run pack:check
```

All five, every commit, before it is committed. Bisect-safety is the point.

**3. Capture failing output before re-running.** Per AGENTS.md: Nx caches terminal output for
SUCCESSFUL runs only, so a re-run destroys a failure's evidence. On any red, first re-run that one
target with `--skip-nx-cache --output-style=stream` and keep the log.

**4. ROBUST-04 -- the bundle rides with its source.** `start-cache-server/index.js` is a committed
esbuild bundle inlining every `serve()`-reachable source. A commit touching any inlined source MUST
run `npm run build:action` and `git add start-cache-server/index.js` in that same commit.

DERIVE the inlined set, never trust a hand-maintained list. The bundle labels each inlined module
with its own path comment:

```
rg -N '^// packages/github-cache/src' start-cache-server/index.js | sort -u
```

That returns 17 sources today. Note two consequences the seven-file list in FINDINGS.md gets wrong
in BOTH directions, both re-measured: `mirror-seed.ts` is NOT bundled (its only importers are the
action entry and the read-back module, neither reachable from the server entry), and
`memory-backend.ts` and `releases-backend.ts` ARE bundled and were omitted. Tasks 11, 16, 17, 20, 22
and 24 are marked REBUILD and were checked against the derivation, not against the list.

Tasks not marked REBUILD must NOT produce a bundle diff. If `check:action` reddens on an unmarked
task, re-run the derivation first: either the edit reached an inlined source, or the inlined set has
changed since this plan was written. Investigate; do not just rebuild.

**5. Never weaken a guard to make it pass.** Several tasks make guards STRICTER. If a stricter guard
goes red, the finding was real and the PRODUCTION CODE is what changes. A guard may not be relaxed,
narrowed, made conditional, or skipped to reach green. This applies with equal force to
`pack:check` and `check:action`.

**6. Locate by content, not by line number.** FINDINGS.md line references were taken at HEAD
`c7793c4`. Earlier tasks shift later tasks' lines inside the same file. Grep for the quoted text.

**7. One commit per task.** Stage files by name -- never `git add .`/`-A`/`-u`. Commit subject
`<type>(260809-uge): <subject>`, no AI attribution trailers. If `git commit -m` fails with
COMMIT_EDITMSG "Invalid argument" (known on this ReFS Dev Drive), use `git commit -F <file>`.

**8. ASCII only in everything written.** `--` not an em dash, no emoji, no box drawing. This is the
house rule the whole D12 task exists to enforce; violating it while fixing it is not acceptable.

**9. Do not re-open the out-of-scope lists.** FINDINGS.md's "Explicitly REJECTED" and "Recorded, NOT
fixed here" sections are closed. Do not implement, and do not argue with, anything in them.

**10. Append to the SUMMARY as EACH commit lands, not at the end.** Immediately after each commit,
append ONE line to
`.planning/quick/260809-uge-address-the-36-verified-survivors-of-the/260809-uge-SUMMARY.md`:

```
<task NN> | <finding IDs> | <short sha> | <REBUILD if the bundle was staged> | <notes if a stricter guard went red>
```

Thirty commits will not fit one context window. Without the incremental record, exhausting context
partway leaves nothing saying which findings landed, and verification step 5's ID-to-commit mapping
becomes unreconstructable. The SUMMARY file is `.planning`-tracked; leave it UNCOMMITTED until the
final commit, or commit it alongside the next task's commit -- do not let it dirty a task commit's
scoped file list.

**11. Research scratchpad artifacts are available** at
`C:\Users\LarsGyrupBrinkNielse\AppData\Local\Temp\claude\D--projects-github-op-nx-github-cache\1e947d59-5716-459d-85a5-251919ee5fd2\scratchpad\`
-- `emit-warnings.mjs` (E1/E2 byte-identity oracle), `nonascii.mjs` (D12 per-line classifier),
`nx-merge-probe.mjs` (A8/A9), `c5/` (C5 tsc probe). Re-capture any "before" snapshot fresh at the
moment you need it; the checked-in `before.txt`/`after.txt` were taken at `c7793c4` and earlier
tasks in this plan will have moved the tree.

</execution_rules>

<tasks>

<task type="auto">
  <name>Task 01: A1 + A2 -- the add-mask guard and its self-disabling precondition</name>
  <files>packages/github-cache/src/docs-adoption.spec.ts</files>
  <action>Highest severity in the set; it guards a credential-exposure path, so it lands first and
alone. Per A1: replace the raw `toContain` of the mask directive with a match that requires the
EXECUTABLE form (an `echo` of it), and additionally assert that the executable occurrence's index in
the document precedes the index of the `$GITHUB_ENV` append that writes the token. The current guard
is satisfied by an adjacent YAML comment carrying the same token, so deleting the only executable
line leaves it green while the documented snippet writes an unmasked bearer token. Per A2: the early
`return` at the precondition makes all three cases silent PASSing no-ops if a doc stops naming the
access-token env var literally -- add an assertion that the precondition still holds for each of the
three docs, so a doc that stops matching reddens instead of vanishing. Both items are the same
guard's integrity; they stay in one commit. Do NOT edit `README.md` -- the docs are correct today;
only the guard is weak.</action>
  <verify>
    <automated>npm run lint &amp;&amp; npm run typecheck &amp;&amp; npm run test &amp;&amp; npm run check:action &amp;&amp; npm run pack:check</automated>
  </verify>
  <done>All five gates green. Deleting the single executable mask line from `README.md` reddens the
spec (verify by hand, then revert the doc). Removing the access-token literal from any one of the
three docs reddens the spec rather than silently passing.</done>
</task>

<task type="auto">
  <name>Task 02: A3 + A4 + A5 -- the three remaining docs-adoption clause weaknesses</name>
  <files>packages/github-cache/src/docs-adoption.spec.ts</files>
  <action>A3: the writable-outcome clause matches a phrase that occurs on five lines of
`docs/advanced.md`, only one of which is the selection-table row, so both table rows could be
deleted with the clause green. Line-scope it so the writable token and the backend name must share
one line. A4: two independent whole-document matches assert co-presence, not relation -- rewrite
both as single-line relations (the repository env var with its throws outcome; the memory backend
with its permanent-MISS outcome). A5: the bare `PORT` substring also matches IMPORTANT, SUPPORT and
EXPORT at both sites -- tighten to a word-boundary or backticked form. Not live today, but the guard
does not mean what it reads as. Locate by content; task 01 shifted this file's line numbers.</action>
  <verify>
    <automated>npm run lint &amp;&amp; npm run typecheck &amp;&amp; npm run test &amp;&amp; npm run check:action &amp;&amp; npm run pack:check</automated>
  </verify>
  <done>All five gates green with the docs unchanged. Deleting either selection-table row from
`docs/advanced.md` now reddens A3's clause (verify by hand, then revert).</done>
</task>

<task type="auto">
  <name>Task 03: A6 -- pin the publish job's needs list instead of matching words inside it</name>
  <files>packages/github-cache/src/dogfood-cross-os.spec.ts</files>
  <action>The four `needs:` cases use word-boundary matches that are satisfied by substrings of the
`*-windows` job names this PR introduced, so rewriting the publish job's `needs:` to the three
windows jobs keeps all four cases green while dropping every real producer -- the exact XOS-07 race
the block exists to prevent. Replace the four substring cases with ONE anchored whole-list pin of
the publish job's `needs:` line, indentation included, so the list is exact rather than
inhabitable. Keep the block's existing explanatory comment accurate to what now holds.</action>
  <verify>
    <automated>npm run lint &amp;&amp; npm run typecheck &amp;&amp; npm run test &amp;&amp; npm run check:action &amp;&amp; npm run pack:check</automated>
  </verify>
  <done>All five gates green. Substituting any one windows job name into that `needs:` list in
`ci.yml` reddens the spec (verify by hand, then revert).</done>
</task>

<task type="auto">
  <name>Task 04: A7 -- strip workflow comments before matching in the hash-parity spec</name>
  <files>packages/github-cache/src/hash-parity/compare.spec.ts</files>
  <action>This spec reads `ci.yml` RAW, so its assertion on the parity-OK grep line is satisfiable by
a comment. It is non-vacuous today only because the needle happens to appear exactly once, and the
house convention is that workflow comments repeat needles verbatim -- the spec that this file names
as its own model already strips `#` lines. Apply the same comment strip before matching here. Use
the existing stripping idiom from that model spec verbatim for now; task 29 folds all four copies
into one shared helper, so do not invent a variant spelling.</action>
  <verify>
    <automated>npm run lint &amp;&amp; npm run typecheck &amp;&amp; npm run test &amp;&amp; npm run check:action &amp;&amp; npm run pack:check</automated>
  </verify>
  <done>All five gates green. Moving the asserted grep line into a `#` comment in `ci.yml` reddens
the spec (verify by hand, then revert).</done>
</task>

<task type="auto">
  <name>Task 05: A8 + A9 -- assert CORR-04 exclusivity at the merged layer, not at targetDefaults</name>
  <files>packages/github-cache/src/nx-target-inputs.spec.ts</files>
  <action>Both findings are the same wrong-layer bug and share one helper, so they land together.
RESEARCH.md's A8/A9 section is VERIFIED by execution against the installed Nx and supersedes the
findings file wherever they differ -- follow the research shape exactly. Add a single
`effectiveInputsFor(target)` helper that merges the project layer over the defaults layer using the
`mergeTargetConfigurations` / `readTargetDefaultsForTarget` pair ALREADY imported at the top of this
file, copying the call shape the file already uses at its two existing merge sites (project layer
FIRST; `?? undefined` on the defaults lookup, which returns null and not undefined when absent; do
NOT pass an executor argument). Build the target-name list as the UNION of the defaults keys and the
project-json target keys -- research measured that targets inheriting everything are absent from the
project-json keys, which is why enumerating either alone is the bug. A8 then filters that union
through the existing runtime-inputs helper and asserts the result equals the single-element
integration list. A9 routes the hashed-files helper through `effectiveInputsFor` instead of reading
targetDefaults directly. Research pitfall to honour: the helper can return undefined for a target
with neither layer declaring inputs, and the self/dependency splitter does not tolerate that -- keep
A9's use restricted to the three names that have defaults, or guard it. Research proved this is
behaviour-preserving at HEAD and that it FAILS under the finding's attack, so no guard should go red
on the refactor alone.</action>
  <verify>
    <automated>npm run lint &amp;&amp; npm run typecheck &amp;&amp; npm run test &amp;&amp; npm run check:action &amp;&amp; npm run pack:check</automated>
  </verify>
  <done>All five gates green with no change to `nx.json` or `project.json`. Adding a runtime input to
the test target in `packages/github-cache/project.json` reddens the A8 assertion (verify by hand,
then revert). Adding inputs to the typecheck target in `project.json` is now visible to the
hashed-files helper.</done>
</task>

<task type="auto">
  <name>Task 06: A10 -- make the least-privilege clauses positive, not absence-only</name>
  <files>packages/github-cache/src/windows-regression-detector.spec.ts</files>
  <action>Nothing asserts a permissions block EXISTS, so deleting it entirely -- which makes the job
inherit repo or workflow default scopes -- passes both current assertions. Separately, the
write-scope negative uses a bounded 60-character window, which three added scope lines clear. Add a
positive anchored pin that the permissions block exists with exactly the read-only contents scope,
and replace the bounded negative with an UNBOUNDED line-anchored negative over the write-granting
scope names. Keep both directions: the positive alone would not catch an added scope, the negative
alone would not catch deletion.</action>
  <verify>
    <automated>npm run lint &amp;&amp; npm run typecheck &amp;&amp; npm run test &amp;&amp; npm run check:action &amp;&amp; npm run pack:check</automated>
  </verify>
  <done>All five gates green. Deleting the permissions block from the detector workflow reddens the
spec, and adding a write scope after three filler scope lines also reddens it (verify both by hand,
then revert).</done>
</task>

<task type="auto">
  <name>Task 07: A11 -- localize the discriminator-site count instead of only counting it</name>
  <files>packages/github-cache/src/docs-cross-os.spec.ts</files>
  <action>The guard pins an exact count of four occurrences across the whole document, which is
satisfied by deleting the adopter-facing verification fence and adding a fourth target to the
config snippet -- the count survives, the reader-facing instruction does not. Split the assertion:
count occurrences INSIDE the fenced config snippet and pin that at three, AND assert at least one
occurrence inside the bash verification fence. Keep the exact count on the snippet rather than
relaxing to a floor -- STATE.md records that the exact pin is deliberate after a code review showed
a green structural guard sitting over a wrong payload.</action>
  <verify>
    <automated>npm run lint &amp;&amp; npm run typecheck &amp;&amp; npm run test &amp;&amp; npm run check:action &amp;&amp; npm run pack:check</automated>
  </verify>
  <done>All five gates green with `docs/cross-os.md` unchanged. Deleting the verification fence
reddens the spec even after adding a fourth snippet occurrence (verify by hand, then revert).</done>
</task>

<task type="auto">
  <name>Task 08: A12 + A13 -- localize the Phase 11 row A count and finish the run-id phrase lock</name>
  <files>packages/github-cache/src/docs-same-os-claims.spec.ts</files>
  <action>Same file, same class of defect, one commit. A12: the row asserts two phrases occur exactly
twice anywhere in `ci.yml`, which is satisfied by deleting one of the two blocks and duplicating the
sentence inside the other -- slice `ci.yml` at each job key and assert the phrase inside EACH slice,
so the count can no longer be met from one place. A13: the run-id phrase occurs twice in `ci.yml` in
two different jobs, so the existing containment survives deleting the justification paragraph the
clause exists to protect -- extend the needle to the unique tail that only the justification
paragraph carries. ALSO in this commit: the docstring above these rows claims the other eight Phase
10/11 phrases were verified unique at count 1, which is false as written -- the Phase 10 rows
contribute 28 phrases and one of them is duplicated. Correct the docstring to what is true. That
correction is not optional bookkeeping: it is the false claim that let A13 look covered.</action>
  <verify>
    <automated>npm run lint &amp;&amp; npm run typecheck &amp;&amp; npm run test &amp;&amp; npm run check:action &amp;&amp; npm run pack:check</automated>
  </verify>
  <done>All five gates green with `ci.yml` unchanged. Deleting the run-id justification paragraph
reddens A13, and moving one of A12's two phrase occurrences into the other job reddens A12 (verify
both by hand, then revert).</done>
</task>

<task type="auto">
  <name>Task 09: A14 + A15 -- cover the archive cleanup on MISS and THROW, and cover the case-fold</name>
  <files>packages/github-cache/src/backend/actions-cache-backend.spec.ts</files>
  <action>Spec-only, no production change, no bundle rebuild. A14: the existing archive-existence
assertions cover the get HIT path and three put paths only. The source comment says the try was
moved ABOVE the restore precisely because it previously covered the hit branch alone -- so moving it
back leaves the suite green, and this PR made the exposure WORSE by the source's own argument (a
read-only leg issues zero puts, so put's finally no longer incidentally sweeps the leftover). Add
two cases: pre-write the archive at the deterministic path, then (a) mock the restore to resolve
undefined and (b) mock it to reject; assert in both that the archive file is gone afterwards. A15:
add the same-directory-different-case workspace case, which is the only reason the lowercase fold
exists -- today's cases cover unset, no config file, and a sibling directory, so dropping the fold
keeps every case green and then throws at construction on Windows CI, taking out all three
cross-OS legs. If either new case is red at HEAD, that is a real production defect: fix the
production code, do not adjust the case.</action>
  <verify>
    <automated>npm run lint &amp;&amp; npm run typecheck &amp;&amp; npm run test &amp;&amp; npm run check:action &amp;&amp; npm run pack:check</automated>
  </verify>
  <done>All five gates green. Moving the cleanup try below the restore reddens the new A14 cases, and
removing the lowercase fold reddens the new A15 case (verify both by hand, then revert). No diff in
`start-cache-server/index.js`.</done>
</task>

<task type="auto">
  <name>Task 10: A16 -- anchor the TRUST-14 branch order against all three earlier branches</name>
  <files>packages/github-cache/src/lib/select-backend.spec.ts</files>
  <action>The branch-order clause anchors the knob against only the token degrade; the write-trust
check and the repository-env throw are unanchored, so a reorder moving either below the knob keeps
the clause green while breaking the guarantee. STATE.md records this exact guard class already
failing once in this file (the knob-checked-last claim that was a one-shot and never became a
clause) -- so match the existing anchor style and add the two missing index anchors. Do not
restructure the clause; add to it.</action>
  <verify>
    <automated>npm run lint &amp;&amp; npm run typecheck &amp;&amp; npm run test &amp;&amp; npm run check:action &amp;&amp; npm run pack:check</automated>
  </verify>
  <done>All five gates green. Hoisting the knob above the write-trust check reddens the clause, and
hoisting it above the repository-env throw reddens it too (verify both by hand, then revert).</done>
</task>

<task type="auto">
  <name>Task 11: A17 + D9 + D11 -- the authored-copies claim, all sites in one commit [REBUILD]</name>
  <files>packages/github-cache/src/lib/cache-key.spec.ts, packages/github-cache/src/lib/cache-key.ts, .github/workflows/ci.yml, start-cache-server/index.js</files>
  <action>One claim, three authored sites, one commit -- splitting it would ship this repo's named
recurring N-copy defect deliberately. A17: the single-source guard is a hand-maintained four-file
map whose stated "exactly one production place" property is already FALSE -- the retention module
authors a byte-identical second copy as the shard-tag prefix, deliberately and documented at its own
site. Replace the hand map with the module tree walk that already exists in
`actions-cache-backend.spec.ts`, carrying an explicit TWO-site allowlist, and correct the guard's
"exactly one" wording to match the tree. The tree walk is the point: the map can see neither the
retention copy nor a future fifth module inlining the literal. D9: `cache-key.ts`'s header says it
is the one authored source and that a second copy must never be inlined -- add one sentence naming
the deliberate retention copy and pointing at the reasoning already recorded there. The
acknowledgement is currently one-sided. Do NOT alias the two constants; they should stay
independently changeable (two GitHub APIs, two keyspaces). D11: `ci.yml` authors a FIFTH copy of the
prefix as a shell key in the witness job, outside any guard, and a shell step cannot import the
helper so this is not a deletion -- add one line of prose at that site naming it as the shell copy
and pointing at the orphans-the-mirror warning in `cache-key.ts`. REBUILD: `cache-key.ts` is
serve()-reachable -- run `npm run build:action` and stage `start-cache-server/index.js` in this
commit.</action>
  <verify>
    <automated>npm run lint &amp;&amp; npm run typecheck &amp;&amp; npm run test &amp;&amp; npm run check:action &amp;&amp; npm run pack:check</automated>
  </verify>
  <done>All five gates green including a clean `check:action` with the regenerated bundle staged.
Inlining the prefix literal into a third module reddens the tree-walk guard (verify by hand, then
revert). No site anywhere in the tree still claims the literal exists in exactly one production
place.</done>
</task>

<task type="auto">
  <name>Task 12: A18 -- close the LINT-01 existence chain's unpinned second half</name>
  <files>packages/github-cache/src/dogfood-cross-os.spec.ts</files>
  <action>The chain's comment credits a workflow grep for the successful-lint line, but NOTHING
asserts that grep exists -- and `nx run-many` on a missing target exits 0, so an inferred lint target
is a silently deletable CI gate. Add one clause in `dogfood-cross-os.spec.ts` (which already has the
job-block helper) asserting the lint job block greps for that phrase against a `.log` file, matching
A18's primary regex. That is the whole task; `ci.yml` is NOT edited.
A18's SECONDARY clause -- "that grep is unanchored unlike its siblings, anchor it" -- is REJECTED and
must not be implemented. MEASURED: `NO_COLOR=1 npx nx run-many -t lint --skip-nx-cache` prints the
line with a leading space and Nx's banner prefix ahead of the phrase, so a column-0 anchor can NEVER
match and the lint job would fail on every run including good ones -- the exact failure the comment
ten lines above it already warns about. The unanchored form in `ci.yml` is CORRECT. It is also
self-contradictory with A18's own primary fix, whose regex requires the unanchored literal. This note
exists so a future reader does not re-derive the anchor as an improvement.</action>
  <verify>
    <automated>npm run lint &amp;&amp; npm run typecheck &amp;&amp; npm run test &amp;&amp; npm run check:action &amp;&amp; npm run pack:check</automated>
  </verify>
  <done>All five gates green with `ci.yml` UNCHANGED by this commit. Deleting the lint-success grep
step from the lint job reddens the new clause (verify by hand, then revert). The workflow grep is
still unanchored.</done>
</task>

<task type="auto">
  <name>Task 13: A19 -- tie the diff count to the key it counts</name>
  <files>packages/github-cache/src/capture-hashes-cli.spec.ts</files>
  <action>The diff case asserts a count and a key independently, so either could come from a
different part of the output. Replace with a single ordered match requiring the one-item count
header to be followed by the specific key it is counting. Smallest possible change; no CLI
change.</action>
  <verify>
    <automated>npm run lint &amp;&amp; npm run typecheck &amp;&amp; npm run test &amp;&amp; npm run check:action &amp;&amp; npm run pack:check</automated>
  </verify>
  <done>All five gates green. The case still passes against real CLI output, and a count reported
without its key would no longer satisfy it.</done>
</task>

<task type="auto">
  <name>Task 14: B1 -- raise the typecheck-windows floor to 2 and reword both messages</name>
  <files>.github/workflows/ci.yml</files>
  <action>The leg's floor is 1 but `npm run typecheck` resolves TWO cacheable tasks -- the typecheck
target carries an inferred dependency on build, and `capture-hashes.mjs` pins exactly that two-task
set, with the traceability record showing healthy counts of 1/2/1. So if cross-OS restore of the
typecheck entry breaks while build still restores, the count is 1 and the gate stays GREEN, meaning
the single observation this leg exists to make was never made. Raise THIS leg's floor to 2. Keep it
a FLOOR, not an exact pin -- XOS-09 forbids the exact form. Reword the step's two messages to name
BOTH tasks; the failure message currently asserts the count can only have come from the ubuntu
typecheck entry, which is false in exactly the state described. Leave the build and test windows
legs at 1 -- they resolve one task each. Do not touch `capture-hashes.mjs`.</action>
  <verify>
    <automated>npm run lint &amp;&amp; npm run typecheck &amp;&amp; npm run test &amp;&amp; npm run check:action &amp;&amp; npm run pack:check</automated>
  </verify>
  <done>All five gates green. The typecheck windows gate compares against 2, the two sibling gates
still compare against 1, and neither of the reworded messages claims a single-source origin for the
count.</done>
</task>

<task type="auto">
  <name>Task 15: B2 + B3 -- ci.yml shell-idiom hygiene</name>
  <files>.github/workflows/ci.yml</files>
  <action>Two independent one-line corrections to the same file, one commit. B2: the integration
leg's label counter lacks the binary-safe flag its three siblings all carry, and those siblings
carry a paragraph explaining why -- a single NUL byte, routine for PowerShell-invoked tooling on the
windows arm runner, makes grep emit one binary-file summary line, so the line count returns 1 on
ZERO real labels. This step is recorded rather than gated so it cannot launder a gate, but the
Windows leg's recorded zero is the observation the whole narrative rests on, and that same byte
would record a one. Add the flag so it matches its siblings. B3: the consumer-smoke readiness poll
is still on the loose non-zero-status form that this PR replaced everywhere else precisely because
it accepts a 401 -- the file now carries two contradictory poll idioms with the rejected one still
present as a copy source, and this copy also lacks a request timeout. Adopt the same
404-or-200 plus timeout form the six Nx-target jobs now use; copy their spelling rather than
inventing one.</action>
  <verify>
    <automated>npm run lint &amp;&amp; npm run typecheck &amp;&amp; npm run test &amp;&amp; npm run check:action &amp;&amp; npm run pack:check</automated>
  </verify>
  <done>All five gates green. All four label counters use the same binary-safe form, and only ONE
readiness-poll idiom remains in the file.</done>
</task>

<task type="auto">
  <name>Task 16: C1 -- move put()'s archive write inside the try [REBUILD]</name>
  <files>packages/github-cache/src/backend/actions-cache-backend.ts, packages/github-cache/src/backend/actions-cache-backend.spec.ts, start-cache-server/index.js</files>
  <action>The write of the archive sits OUTSIDE the try/finally, so the finally block's own claim that
cleanup runs on every exit path is false: a throwing write (disk full; permission or busy faults from
Windows antivirus or a concurrent handle) leaves a partial archive at the deterministic per-hash path
with the finally never entered. This is the identical defect the read path fixed in this same PR.
Move the write inside the existing try. A write fault then falls into the existing catch, is not a
reserve-cache error, and rethrows unchanged, so behaviour is preserved -- state that in the comment
so a future reader does not "restore" it. Add a spec case that makes the write reject and asserts no
archive file survives; without it this fix has no guard and task 09's sibling cases would look like
they covered it. Not a correctness hole today (a stale partial cannot become a wrong HIT and the put
still fails closed), so keep the comment's severity honest. REBUILD: run `npm run build:action` and
stage the bundle in this commit.</action>
  <verify>
    <automated>npm run lint &amp;&amp; npm run typecheck &amp;&amp; npm run test &amp;&amp; npm run check:action &amp;&amp; npm run pack:check</automated>
  </verify>
  <done>All five gates green with the regenerated bundle staged. A rejecting archive write leaves no
file behind, asserted by a new case. Moving the write back outside the try reddens that case (verify
by hand, then revert).</done>
</task>

<task type="auto">
  <name>Task 17: C2 -- warn on the token-absent degrade, and repair the enumeration that omits it [REBUILD]</name>
  <files>packages/github-cache/src/lib/select-backend.ts, packages/github-cache/src/lib/select-backend.spec.ts, start-cache-server/index.js</files>
  <action>The token-absent degrade is genuinely silent: on a write-trusted push with an unwired token
the sidecar starts, the readiness poll takes its 404 as proof of life, every read 404s, every write
403s, Nx degrades best-effort, and the job is GREEN with a permanently cold cache and not one line in
the log. This PR added an informational line to the ADJACENT read-only branch and justified its level
by enumerating "every other silent-degradation path in this package" -- an enumeration that omits the
branch three lines above it. Emit a `core.warning` here, not an info: the sibling's info is correct
because that path was REQUESTED, and this one is a surprise. Name the consequence (a cold cache for
the whole job), not just the missing variable. Then either add this branch to that enumeration or
drop its "every other" claim -- leaving the enumeration as-is reintroduces the same false-completeness
class this branch has already paid for twice (STATE.md, quicks 260809-og2 and 54677af). Add a spec
case pinning that the warning is emitted on this branch and that it is a warning, not an info.
REBUILD: run `npm run build:action` and stage the bundle in this commit.</action>
  <verify>
    <automated>npm run lint &amp;&amp; npm run typecheck &amp;&amp; npm run test &amp;&amp; npm run check:action &amp;&amp; npm run pack:check</automated>
  </verify>
  <done>All five gates green with the regenerated bundle staged. The token-absent branch emits a
warning naming the cold-cache consequence, pinned by a new case. No comment in the file claims an
enumeration is complete unless it is.</done>
</task>

<task type="auto">
  <name>Task 18: C3 -- require a non-empty discriminator stdout in the shape check</name>
  <files>packages/github-cache/src/hash-parity/compare.ts, packages/github-cache/src/hash-parity/compare.spec.ts</files>
  <action>An EMPTY discriminator stdout currently passes the platform-sensitivity clause: the shape
check tests the TYPE and never the length. That is correct for stderr, which is legitimately empty on
a healthy leg, and WRONG for stdout, which is never legitimately empty for the pinned platform probe.
The capture script returns an empty string when the spawn fails to launch, so leg A empty against leg
B's real value makes the trimmed comparison DIFFER, the clause PASS, and the gate print PARITY OK --
attributing a divergent integration hash to a discriminator that produced nothing on one leg. This is
the CORR-03 malformed-input-yielding-a-PASS class. Require non-empty stdout in the shape check while
leaving stderr type-only, and state the asymmetry and its reason in the comment (the existing comment
already half-argues it). Note the record already carries a discriminator status field FOR THIS PURPOSE
and no consumer reads it -- it is neither modelled in the record type nor checked; you may model and
check it, but non-empty stdout is the required fix and the status is optional reinforcement. Add spec
coverage for the empty-stdout leg reaching a FAULT rather than a PASS.</action>
  <verify>
    <automated>npm run lint &amp;&amp; npm run typecheck &amp;&amp; npm run test &amp;&amp; npm run check:action &amp;&amp; npm run pack:check</automated>
  </verify>
  <done>All five gates green. A record pair with one empty discriminator stdout now yields a shape
fault instead of PARITY OK, asserted by a new case. An empty stderr on a healthy leg still passes.</done>
</task>

<task type="auto">
  <name>Task 19: C4 -- reject an empty run id at the action call site</name>
  <files>packages/github-cache/src/action/index.ts, packages/github-cache/src/action/index.spec.ts</files>
  <action>An empty run id produces a hash that is VALID -- it matches the hash pattern, crosses the
parser, and is a perfectly good cache key, so the server's route validator cannot reject it. The
result is a 200 PUT writing a run-independent key that every future empty-run-id leg collides on.
The READER already guards this and its comment names this exact case; the WRITER does not. Fix it at
the ACTION CALL SITE, not in the seed helper, for the READER/WRITER SYMMETRY: the reader validates
the run id separately at its own layer, so the writer should refuse in the same shape at the same
layer. Mirror the reader's existing validation shape and message rather than inventing one.
NOTE, because FINDINGS.md gives a second reason that is FALSE: it says to prefer the call site
because the helper is serve()-reachable. Re-measured -- `mirror-seed.ts` is NOT inlined in the
bundle, so editing it would cost no rebuild either. The symmetry above is the real and sufficient
reason; do not repeat the bundle-cost argument in any comment. Impact is bounded by the retention
window and the reader still fails loud, so keep the comment's severity honest. Add a spec case for
the empty run id being rejected before any write, in the existing
`packages/github-cache/src/action/index.spec.ts`.</action>
  <verify>
    <automated>npm run lint &amp;&amp; npm run typecheck &amp;&amp; npm run test &amp;&amp; npm run check:action &amp;&amp; npm run pack:check</automated>
  </verify>
  <done>All five gates green. An empty run id is refused before any write, asserted by a new case,
and the refusal lives at the action call site rather than in the seed helper.</done>
</task>

<task type="auto">
  <name>Task 20: C5 -- add an internal ReadOnlyBackend so the read-only union carries information [REBUILD]</name>
  <files>packages/github-cache/src/backend/types.ts, packages/github-cache/src/backend/actions-cache-backend.ts, packages/github-cache/src/backend/memory-backend.ts, packages/github-cache/src/backend/releases-backend.ts, packages/github-cache/src/lib/select-backend.ts, start-cache-server/index.js</files>
  <action>The readable-or-writable union collapses to readable because writable extends readable, so
the selector's return type carries ZERO read-only information and the structural guarantee rests
entirely on excess-property checking, which fires only on a fresh object literal. A later non-literal
wrapper compiles clean, makes the writable predicate true on the read-only branch, the server calls
put, and XOS-09's inductive argument is silently false with every gate green. Add an internal
`ReadOnlyBackend` extending the readable interface with an optional-never put, return it from the
three read-only factories, and widen the selector's return to the read-only-or-writable union.
RESEARCH.md verified with a real strictness-matched `tsc --noEmit` that: the writable-to-read-only
assignment IS rejected; the writable predicate needs no signature change and still narrows both
branches; the spread pattern at the writable factory still compiles unchanged; and the server and
serve sites accept the new type unchanged. TWO HARD CONSTRAINTS. First, do NOT export
`ReadOnlyBackend` from `src/index.ts` -- D2-02 forbids new package exports this milestone and
research confirmed the public-surface spec asserts over the barrel only, so an internal type changes
nothing it can see. Second, the comment landing at the type MUST NOT claim the wrapper is
unrepresentable: research found the residual path -- a wrapper annotated with the OLD readable base
type still launders a writable backend through one indirection. State honestly that re-opening the
hole now requires a VISIBLE widening of a declared return type, i.e. a reviewable diff instead of a
silent one. The `readonly` modifier is documentation, not the mechanism; do not describe it as the
mechanism. REBUILD: run `npm run build:action` and stage the bundle in this commit.</action>
  <verify>
    <automated>npm run lint &amp;&amp; npm run typecheck &amp;&amp; npm run test &amp;&amp; npm run check:action &amp;&amp; npm run pack:check</automated>
  </verify>
  <done>All five gates green with the regenerated bundle staged and NO diff to
`public-surface.spec.ts` or its pinned literal. A wrapper declared as returning `ReadOnlyBackend`
that returns the writable factory is a compile error (verify by hand with a scratch edit, then
revert). No comment claims the laundering wrapper is unrepresentable.</done>
</task>

<task type="auto">
  <name>Task 21: C6 -- type the GitHub error code parameter</name>
  <files>packages/github-cache/src/lib/octokit-fault-reason.ts</files>
  <action>The fault-code predicate takes a bare string, so a misspelling of one of the six enum
members the module header itself enumerates compiles, always returns false, and silently converts a
genuine duplicate-upload race into a counted failure. Fail-closed, so not a Core-Value risk, but a
green run turns red for a benign cause with the cause invisible. Export a union type of exactly the
six members the header already enumerates and annotate that parameter with it. Do NOT do the same to
the field-message helper's field parameter -- those names are endpoint-specific and open. Leave the
fault reason's own code property as a plain string; it renders whatever GitHub actually sent, which
is not necessarily in the enum.</action>
  <verify>
    <automated>npm run lint &amp;&amp; npm run typecheck &amp;&amp; npm run test &amp;&amp; npm run check:action &amp;&amp; npm run pack:check</automated>
  </verify>
  <done>All five gates green. A misspelled code passed to the predicate is a compile error (verify by
hand with a scratch edit, then revert). The field helper and the rendered code property are
unchanged.</done>
</task>

<task type="auto">
  <name>Task 22: D1 -- correct the reserve-conflict reason, the third copy the sweep missed [REBUILD]</name>
  <files>packages/github-cache/src/backend/actions-cache-backend.ts, start-cache-server/index.js</files>
  <action>The comment justifies swallowing a reserve conflict by asserting another job is creating the
same byte-identical entry, and cites CORR-01 -- the superseded OS-namespaced-store invariant. Both
copies in the publish module were already corrected in this PR with the new reason (one entry per
hash, restored and re-uploaded verbatim without re-running the task); this is the third copy and the
sweep missed it. That new reason does NOT transfer here: this branch is two jobs that each EXECUTED
the task and race to reserve the same key. The collision was structurally IMPOSSIBLE before this
milestone -- the cache version partitioned by OS -- and is now reachable for an adopter running the
build target read-write on both an ubuntu and a windows runner, and two independently produced tar
archives from two operating systems are not byte-identical. First-write-wins is probably still the
right trade; the defect is the false reason plus the retired citation. Rewrite it to say byte
identity is no longer the reason, and that first-write-wins is accepted because both entries are
valid outputs of the same task hash. Do NOT change the branch's behaviour. REBUILD: run
`npm run build:action` and stage the bundle in this commit.</action>
  <verify>
    <automated>npm run lint &amp;&amp; npm run typecheck &amp;&amp; npm run test &amp;&amp; npm run check:action &amp;&amp; npm run pack:check</automated>
  </verify>
  <done>All five gates green with the regenerated bundle staged. No site in the tree still justifies
the reserve-conflict swallow by byte identity, and the retired CORR-01 citation is gone from this
comment. The branch's behaviour is unchanged.</done>
</task>

<task type="auto">
  <name>Task 23: D2 + D4 -- the two comments that assert what their own blocks retract, both sites</name>
  <files>packages/github-cache/src/publish/publish-mirror.ts, packages/github-cache/src/docs-same-os-claims.spec.ts</files>
  <action>Two comment corrections in one file, one commit, no behaviour change anywhere. D2: the
observability block's topic sentence says producer attribution where five lines later the same block
correctly states it names the PUBLISHING leg's OS and that no comment, doc, summary or threat-model
line may say otherwise. The topic sentence is the line a skimmer takes away and the only line that
survives a future trim, and the retraction guard is a same-sentence co-occurrence check so this
sentence sits in its known accepted blind spot. One word: publisher, not producer. D4: the branch
comment calls this the live rotation signal, which this PR's own reorder made false -- the new
pre-restore guard skips shard-present entries with no restore attempted, so a mid-month cache-version
rotation's victims land in the already-present bucket rather than the miss bucket, the partial branch
stays under its target rate on the file's own measured figures, and the total gate's condition cannot
be met either. Both tripwires silent, zero failures, leg green having mirrored only what it wrote
itself. Retract the claim and state the measured consequence: an entry already in the shard is never
restore-probed, so neither branch detects a mid-month rotation, and the detectable window is the
first publish against a NEW month shard -- which the warning message's own fourth cause already
describes. D4 IS AN N-COPY CLAIM, and the second site is easy to miss: the same sentence is authored
again as a docstring in `packages/github-cache/src/docs-same-os-claims.spec.ts` -- same claim, same
falsity, same reason -- and it survives in the very file whose job is to prove retracted wording
gone. Correct BOTH sites in this ONE commit; `git grep -n 'live rotation signal' -- packages docs README.md .github` must return
nothing afterwards. CONSTRAINT from CONTEXT.md: do the comment retraction ONLY. Do NOT change the
tripwire's firing condition -- folding the already-present count into it is marked UNRESOLVED and
needs a measurement against a real publish run, not a judgement call. Do not switch the denominator
to attempted-only; that was MEASURED firing on both legs of a healthy run.</action>
  <verify>
    <automated>npm run lint &amp;&amp; npm run typecheck &amp;&amp; npm run test &amp;&amp; npm run check:action &amp;&amp; npm run pack:check</automated>
  </verify>
  <done>All five gates green. `git diff` for this commit contains comment and docstring lines only --
no executable line changed, and no threshold, denominator or condition moved. No site IN THE TREE
still calls either branch a live rotation signal, and no site says producer attribution.</done>
</task>

<task type="auto">
  <name>Task 24: D3 + D10 -- the release-asset-name annotations, all sites in one commit [REBUILD]</name>
  <files>packages/github-cache/src/lib/release-asset-name.ts, packages/github-cache/src/cleanup/cleanup.ts, packages/github-cache/src/lib/release-asset-name.spec.ts, start-cache-server/index.js</files>
  <action>D3 is a false claim in FOUR places and is the same N-copy class as task 22 -- all four land
together. The claim is that the legacy branch is the only thing that can still prune the assets
already published under the old shape, repeated at the helper's header, at the cleanup module, at the
spec, and again at the helper with a dead-weight variant. The CORRECTED sibling in this same PR --
the retention module -- records the truth: the shard-tag prefix rename made old-prefix shards
unreadable AND unprunable and they were removed by hand instead. Cleanup scopes on the new shard-tag
pattern so it never visits an old-prefix release at all, and every new-prefix month shard postdates
the asset rename so it can only hold new-shape names. The branch is cheap, provably disjoint and
harmless to KEEP -- do NOT delete it (the rejected list names that deletion explicitly). Restate all
four wordings as defence-in-depth against any surviving old-shape asset, not as pruning a population
that no longer exists. D10 rides along because it is the same file and the same rebuild: both
survival annotations under-name their consumers. The OS-values annotation names only the legacy
predicate as its live consumer, but the seed helper imports it as a VALUE and evaluates it at
runtime, and the seed helper says so explicitly -- so the annotation names the weaker reason and
omits the load-bearing one. The platform helper names one consumer where five call sites exist across
the publish module, the action entry and the read-back module. These annotations exist to tell
`fallow dead-code` and the next reader why the symbols survive, so an under-naming is a latent
deletion. Name all consumers at both annotations; verify each by grep rather than copying this list.
REBUILD: `release-asset-name.ts` is serve()-reachable -- run `npm run build:action` and stage the
bundle in this commit.</action>
  <verify>
    <automated>npm run lint &amp;&amp; npm run typecheck &amp;&amp; npm run test &amp;&amp; npm run check:action &amp;&amp; npm run pack:check</automated>
  </verify>
  <done>All five gates green with the regenerated bundle staged. No site in the tree still says the
legacy branch prunes the old-shape asset population; the legacy branch itself, the OS values and the
platform helper all still exist; both survival annotations name every consumer that a grep finds.</done>
</task>

<task type="auto">
  <name>Task 25: D5 + D6 -- the two consumer-facing doc corrections</name>
  <files>docs/cross-os.md, README.md</files>
  <action>Both are adopter-facing prose, one commit. D5 is the most externally visible finding in the
set because it is the consumer-facing recipe: section 1's verification list tells the reader to check
TWO things about the discriminator probe, while section 3 says the replacement command must clear the
SAME bar section 1 sets and then lists THREE, including empty stderr. Section 1 mentions stderr only
as an explanation of why the no-warnings flag is pinned, never as something to check -- and section 1
explicitly invites substitution, so a consumer who swaps in their own probe never reaches section 3,
which is scoped to the architecture and libc case. The document names the consequence itself: a
warning carrying a process id gives a permanent 100% MISS that presents as a portability failure. Add
empty stderr as a third item under section 1's verification item; section 3's cross-reference then
becomes true as written. D6: the README quickstart precondition says the sidecar refuses to start
unless the workspace config is in the cwd and that directory matches the workspace env var, but the
backend resolves an absent value against the cwd, so unset or blank passes naturally -- its own
comment says so. That sends a reader debugging a non-Actions runner down a wrong path. Qualify the
sentence so it only claims the match requirement when the variable is set. Both are prose; do not
touch any code or guard. If task 01's stricter mask guard reddens on a README edit, that is the guard
working -- fix the edit, not the guard.</action>
  <verify>
    <automated>npm run lint &amp;&amp; npm run typecheck &amp;&amp; npm run test &amp;&amp; npm run check:action &amp;&amp; npm run pack:check</automated>
  </verify>
  <done>All five gates green, including the docs specs from tasks 01, 02 and 07. Section 1 of the
cross-OS doc lists three checks and section 3's same-bar cross-reference is true as written. The
README precondition no longer claims a match is required when the variable is unset.</done>
</task>

<task type="auto">
  <name>Task 26: D7 + D8 -- retire the rotting numeric cross-references in ci.yml</name>
  <files>.github/workflows/ci.yml</files>
  <action>D7: roughly a dozen internal numeric line cross-references are stale; FINDINGS.md verifies
twelve of them individually, several hanging off load-bearing claims -- one points at an Nx run step
while claiming a permissions trap. Some pointers ARE still correct, which is exactly what makes the
wrong ones costly: a reader cannot tell the classes apart without resolving each. The file already
legislates against this class at the detector workflow's header, which drops a count from a comment
because an unguarded number in a comment rots and a comment carrying a false claim is a documented
argument for undoing the work. Fix per that precedent: replace numeric pointers with the job or step
NAME, which the file already does elsewhere and which does not rot. Re-resolve each pointer against
the CURRENT file rather than trusting FINDINGS.md's corrected numbers -- tasks 11, 14 and 15 have all
moved this file since the finding was written. Sweep the whole file, not only the twelve verified
ones; a pointer left numeric is a future instance of the same defect. D8 rides along as the same
class: a reproduction instruction names an asset shape this milestone deleted (a hash present only
under an OS suffix). The measurement stays a true historical fact but is unfollowable as an
instruction, and every other legacy-shape reference in this PR carries a pre-CORR-02 qualifier while
this one does not. Qualify it in place; do not delete the measurement.</action>
  <verify>
    <automated>npm run lint &amp;&amp; npm run typecheck &amp;&amp; npm run test &amp;&amp; npm run check:action &amp;&amp; npm run pack:check</automated>
  </verify>
  <done>All five gates green, including the specs THIS PLAN touched that read `ci.yml` (tasks 03,
04, 08, 12). Task 12 READS `ci.yml` without editing it, so it belongs in that list -- the relation
here is read, not edit. That parenthetical is a reader's HINT, NOT the gate and NOT a complete set:
the full population of `ci.yml` readers this task can redden is much larger (every pre-existing
Phase 10/11 phrase row in `docs-same-os-claims.spec.ts`, the dogfood injection scan that
deliberately reads the file RAW, and hash-parity's other reads). The operative clause is "all five
gates green", which runs the whole suite and therefore covers every reader regardless of the
enumeration -- do not treat the four named tasks as the coverage boundary. No comment in the file
points at another line by number. The reproduction instruction carries its pre-CORR-02 qualifier
and its measurement is intact.</done>
</task>

<task type="auto">
  <name>Task 27: E1 -- one shared read-miss cause list, emitted bytes unchanged</name>
  <files>packages/github-cache/src/publish/publish-mirror.ts</files>
  <action>A byte-identical span of roughly 370 characters is authored twice in the two read-miss
warnings with no recorded reason, SPLIT ACROSS STRING CONCATENATION at different wrap boundaries in
the two literals -- which is why a contiguous grep will not find the pair and why two commits on this
branch already exist solely to repair it in lockstep. Contrast the seed marker constant in the same
file, which records its own duplication as ACCEPTED with the drift direction; this pair has no such
note. Extract one module-level constant interpolated into both sites. RESEARCH.md gives the EXACT
proven-byte-identical shape for the constant and for both call sites -- use it verbatim rather than
re-deriving it. The critical detail: the constant must end at the read-scope phrase with NO trailing
punctuation, because site A supplies a period and site B supplies a semicolon. BYTE-IDENTITY IS THE
ACCEPTANCE CRITERION, not a nicety. Before editing, capture the oracle baseline with the research
script:
`node <scratchpad>/emit-warnings.mjs <abs path to publish-mirror.ts> > before.txt`. Capture it FRESH
in this task -- task 23 has already moved this file, so the research pass's checked-in `before.txt`
is stale and must not be reused. After editing, re-run into `after.txt` and require an empty diff.
Three of the folded messages reference loop locals and print a stable unfoldable marker; that marker
is constant across before and after, so the diff is still sound. Every pinned substring in
`publish-mirror.spec.ts` must survive verbatim -- research checked all seven pin sites and confirmed
each lies wholly inside the shared span or inside an untouched head or tail.</action>
  <verify>
    <automated>npm run lint &amp;&amp; npm run typecheck &amp;&amp; npm run test &amp;&amp; npm run check:action &amp;&amp; npm run pack:check</automated>
  </verify>
  <done>All five gates green. The emit-oracle diff between the fresh `before.txt` and `after.txt` is
EMPTY. The cause list is authored once. `publish-mirror.spec.ts` is unchanged -- if a pin needed
editing, the extraction was not byte-identical and the extraction is what changes.</done>
</task>

<task type="auto">
  <name>Task 28: E2 -- extract the read-miss warning tail out of publishMirror</name>
  <files>packages/github-cache/src/publish/publish-mirror.ts</files>
  <action>`publishMirror` is the repo's only NEWLY-INTRODUCED complexity failure and is the reason
`fallow audit` exits 1 -- cyclomatic 25, cognitive 36, 506 lines, flagged as introduced. The
extractable part is the TAIL, not the loop: the two mutually exclusive read-miss warning branches
read only the miss list, the scanned count and the mirrored count, all final by then, and touch no
loop state. Of roughly 170 lines about 160 are comment blocks. Move the span VERBATIM into a
module-private `warnOnReadMisses(readMisses, scanned, mirrored): void` called on one line where the
block sits. With task 27 this takes the function from 506 to roughly 330 lines. Keep it module
PRIVATE for the reason the Wilson helper in the same file already records. CONTEXT.md sequences this
LAST among code changes so a revert stays cheap. Run the SAME emit-oracle across this change too --
research says to run it across the E1+E2 pair, not E1 alone; capture a fresh `before.txt` at the
start of this task. DO NOT touch any other fallow entry: the shard-release helper, the shape check,
the parity comparison, the cleanup routine, the action entry's run function, and the capture script's
argument parser, diff and premise assertion are all flat ordered guard chains where every branch
returns or throws a DISTINCT named reason, several comment-lock their ordering by name, and their
branch count IS the diagnosis surface. Flattening any of them loses an explicit failure branch. Do
not chase the fallow verdict to zero.</action>
  <verify>
    <automated>npm run lint &amp;&amp; npm run typecheck &amp;&amp; npm run test &amp;&amp; npm run check:action &amp;&amp; npm run pack:check</automated>
  </verify>
  <done>All five gates green. The emit-oracle diff is EMPTY across this change. `publishMirror` no
longer contains the warning branches; the new helper is not exported. No other complexity entry was
touched.</done>
</task>

<task type="auto">
  <name>Task 29: E3 + E4 -- one shared repo-file helper for the read and the YAML comment strip</name>
  <files>packages/github-cache/src/test/repo-file.ts, packages/github-cache/src/docs-adoption.spec.ts, packages/github-cache/src/docs-cross-os.spec.ts, packages/github-cache/src/docs-same-os-claims.spec.ts, packages/github-cache/src/windows-regression-detector.spec.ts, packages/github-cache/src/dogfood-cross-os.spec.ts, packages/github-cache/src/cleanup/cleanup-workflow.spec.ts, packages/github-cache/src/ppe/ppe-action.spec.ts</files>
  <action>Two duplications with the same shared home, one commit. E3: three identical repo-file read
helpers across the three docs specs. E4: the YAML comment-strip idiom authored four times across the
detector, dogfood, cleanup-workflow and ppe specs -- plus a fifth introduced by task 04, which
deliberately copied the existing spelling so this sweep can catch it. Create
`packages/github-cache/src/test/repo-file.ts` exporting the workspace root, a repo-file read and the
comment strip. FIRST check `packages/github-cache/src/test/workspace-root-cwd.ts` -- if it already
computes the workspace root, import it rather than recomputing; do not author a second root
constant while fixing a duplication. HARD CONSTRAINT, already recorded at that neighbouring file:
the new module must import NOTHING from vitest, because `src/test/` is inside the library tsconfig's
source include and a vitest import emits a vitest require into `dist`. Relative depth from the new
location is four levels up. CAVEAT that would break a blanket sweep: the dogfood spec deliberately
re-reads the RAW file at its injection scan because the stripped view drops shell comments inside
run bodies and would blind the scan -- the reason is recorded at that site. That read MUST stay raw;
the shared helper covers the stripped view only. If `pack:check` reddens because a new compiled test
helper appears in the consumer tarball, do NOT weaken pack-check -- look at how the three existing
modules in that directory (`consumer-contract.ts`, `octokit-fault.ts`, `workspace-root-cwd.ts`) are
handled and follow that precedent.</action>
  <verify>
    <automated>npm run lint &amp;&amp; npm run typecheck &amp;&amp; npm run test &amp;&amp; npm run check:action &amp;&amp; npm run pack:check</automated>
  </verify>
  <done>All five gates green with no assertion changed in any of the seven specs. One authored copy
of each of the two helpers remains. The dogfood injection scan still reads the file raw. The new
module has no vitest import.</done>
</task>

<task type="auto">
  <name>Task 30: D12 -- convert authored non-ASCII prose in the PR-scoped .planning files</name>
  <files>.planning/ (PR-diff scoped file list, computed at execution time)</files>
  <action>Lands LAST and is fully separable. SCOPE IS LOAD-BEARING, and RESEARCH.md corrects the
finding here: pin the sweep to the PR-DIFF file list, computed at execution time with
`git diff --name-only origin/main...HEAD -- .planning`. The whole tracked tree carries roughly nine
times more non-ASCII, dominated by archived v0.0.1 box-drawing diagrams that are 100% fenced; a
blanket tree-wide sweep would be nine times too large. The character figures in FINDINGS.md and
RESEARCH.md (391 total, 374 prose) are INDICATIVE, not a pin -- this plan's own 29 preceding commits
add `.planning` files to the PR diff, so recount rather than asserting a number. Apply the per-line
rule research measured: track a fenced-block toggle; a fence delimiter line toggles state and is
skipped; while the fence is OPEN leave the line untouched (verbatim tool output); if the non-ASCII
character sits inside a backtick span on the line leave it untouched (quoted literal or truncated
captured assertion text); otherwise it is authored prose -- convert. The rule biases correctly: its
naive backtick toggle over-classifies on an odd backtick count, and over-classifying means LEAVING a
line alone -- a false leave is a style miss, a false convert falsifies recorded evidence. That is
CONTEXT.md's locked constraint: never rewrite a captured measurement to satisfy a style rule. Use the
research conversion map (em and en dash to a double hyphen, arrow to `->`, ellipsis to three dots,
section sign to the word, middle dot to a hyphen, tick and check marks to `[OK]`, cross marks to
`[FAIL]`, warning sign to `[WARN]` dropping the variation selector, lock to `[MANUAL]`, white square
to an empty bracket pair). Two calls research measured that a human gets wrong: a discussion log's
tick marks are markdown TABLE cells in authored prose and DO convert; a review-fix file's tick mark
is inside backticks quoting a vitest line and stays. The classifier script
`<scratchpad>/nonascii.mjs` prints the class per line and is re-runnable -- use it rather than
eyeballing.</action>
  <verify>
    <automated>npm run lint &amp;&amp; npm run typecheck &amp;&amp; npm run test &amp;&amp; npm run check:action &amp;&amp; npm run pack:check</automated>
  </verify>
  <done>All five gates green. Re-running the classifier over the PR-diff file list reports zero
remaining prose-class non-ASCII characters, and the fenced and backtick-quoted characters it reports
as leave-class are byte-identical to before the sweep. No file outside the PR-diff list was
touched.</done>
</task>

</tasks>

<verification>

## After all 30 commits

1. `npm run lint && npm run typecheck && npm run test && npm run check:action && npm run pack:check`
   green at HEAD.
2. `git log --oneline c7793c4..HEAD` shows 30 commits, no AI attribution trailer on any.
3. Every commit that touched a serve()-reachable source also touched
   `start-cache-server/index.js`. Cross-check with
   `git log --format='%h %s' --name-only c7793c4..HEAD` -- tasks 11, 16, 17, 20, 22 and 24 must show
   the bundle; no other commit should.
4. Bisect-safety spot check: pick three commits at random from the middle of the range, check each
   out detached, and run the five-command battery. Any red is a bisect-safety failure that must be
   repaired before the run is considered done.
5. Every finding ID A1-A19, B1-B3, C1-C6, D1-D12, E1-E4 is attributable to exactly one commit. The
   mapping is the SUMMARY's per-commit lines, appended as each commit landed (execution rule 10) --
   this step CHECKS the record is complete at 30 lines; it does not reconstruct it after the fact.
6. Nothing from FINDINGS.md's "Explicitly REJECTED" or "Recorded, NOT fixed here" sections appears
   in the diff -- specifically: no new barrel export, no deleted legacy accept branch, no deleted
   OS values or platform helper, no change to the read-miss tripwire's firing condition or
   denominator.

</verification>

<success_criteria>

- 44 findings closed across 30 bisect-safe commits.
- The five-command battery green at every commit, in the main tree.
- Six commits carry a regenerated bundle; no other commit does.
- No guard relaxed. Where a stricter guard reddened, the SUMMARY records which production code
  changed and why.
- The four N-copy sweeps (task 11, task 22, task 23, task 24) each landed atomically.
  `git grep -n 'live rotation signal' -- packages docs README.md .github` returns nothing (task 23's second site).
  THE PATHSPEC IS LOAD-BEARING, not tidiness: the UNSCOPED grep also hits SEVEN `.planning` files
  (an archived phase VALIDATION artifact, five prior quick-task PLAN/RESEARCH/REVIEW records that
  QUOTE the source line, and `.planning/todos/pending/robust-04-all-restore-miss-clause-is-false.md`,
  an open todo whose subject IS this claim). Those are historical records and an open todo. They
  MUST NOT be edited to clear the grep -- doing so would falsify a recorded evidence trail and
  rewrite an open todo, which is the exact prohibition CONTEXT.md locks for D12. The unscoped form
  is unsatisfiable by design; only the two source sites are in scope.
- The two out-of-scope lists are untouched, and the D4-optional tripwire change is NOT in the diff.

</success_criteria>

<output>
`.planning/quick/260809-uge-address-the-36-verified-survivors-of-the/260809-uge-SUMMARY.md` is built
INCREMENTALLY -- one line per commit as it lands, per execution rule 10. At the end, add the prose
sections on top of the accumulated 30-line table: what changed, any case where a stricter guard went
red and which production code changed as a result, and the disposition of the two rejected
sub-items (A18's anchoring clause, D4's optional tripwire change).
</output>
