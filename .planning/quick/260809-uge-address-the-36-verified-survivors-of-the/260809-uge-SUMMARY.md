---
phase: 260809-uge
plan: 01
status: complete
---

# Quick 260809-uge: PR #16 review survivors -- execution record

Base HEAD `c7793c4`. Five-gate battery
(`lint && typecheck && test && check:action && pack:check`) run before every commit.

## Commit log

| Task | Finding IDs | Short sha | REBUILD | Notes |
| ---- | ----------- | --------- | ------- | ----- |
| 01 | A1, A2 | aca4955 | no | Mutation verified: deleting README's executable mask echo reddens the clause. |
| 02 | A3, A4, A5 | 63436f0 | no | FINDINGS' prescribed A3 regex was insufficient -- `/writable[^\n]*Actions-cache backend/` also matches advanced.md's closing prose, so the clause is anchored at the table row instead. Mutation verified. |
| 03 | A6 | 044f335 | no | Four member clauses collapse to one exact list pin; test count 1079 -> 1076. Mutation verified. |
| 04 | A7 | 4587db3 | no | Strip spelled to match the existing idiom so task 29 can fold it. Mutation verified. |
| 05 | A8, A9 | e9cc69d | no | Behaviour-preserving at HEAD as research predicted. Mutation verified: a runtime input on project.json's test target reddens the exclusivity clause. |
| 06 | A10 | b1e540a | no | Both mutations verified (block deleted; write scope after three filler lines). Negative matches any scope name rather than the finding's four-name enumeration. |
| 07 | A11 | 2f1fd72 | no | Mutation verified: total count stays 4 and BOTH new clauses redden. |
| 08 | A12, A13 | 1148963 | no | Both mutations verified; count stays 2 under the A12 attack and the per-block clause reddens. |
| 09 | A14, A15 | 989747c | no | Spec-only, no bundle diff. Both new cases green at HEAD -- no production defect surfaced. Both mutations verified. |
| 10 | A16 | 6db4253 | no | Both hoists verified red, independently (above the trust check; between the trust check and the identity throw). |
| 11 | A17, D9, D11 | 774708e | rebuilt, no diff | `build:action` run as required; both source edits are comment-only so esbuild emits no bundle change and there was nothing to stage. Guard made STRICTER (map -> tree walk); no production code needed changing. Mutation verified. Walk rooted at `import.meta.url`, not the cwd -- this spec has no workspace-root chdir hook. |
| 12 | A18 | e6efeac | no | ci.yml UNCHANGED by this commit, as required. A18's secondary anchoring clause deliberately NOT implemented; reason recorded at the new guard. Mutation verified. |
| 13 | A19 | df18b5a | no | Smallest possible change; no CLI change. |
| 14 | B1 | 3cdc2fb | no | STRICTER GUARD WENT RED: `dogfood-cross-os.spec.ts` pinned the floor literal `1` for this leg. Resolved by making the floor a per-leg parameter of `windowsLegReasons` (build 1, typecheck 2, test 1) -- the pin stays exact; the shared constant is what let this leg's floor read as a house value. Guard not relaxed. |
| 15 | B2, B3 | 49dc2db | no | All four label counters now binary-safe; one readiness-poll idiom left in the file. |
| 16 | C1 | 712e4f9 | YES | Bundle regenerated and staged. Note: `check:action` compares the working tree against the INDEX, so the bundle must be `git add`ed before the gate can pass. Mutation verified. |
| 17 | C2 | d9435f0 | YES | Bundle regenerated and staged. New warning pinned by level, not just emission. Sibling enumeration restated as a sample, not a census. |
| 18 | C3 | ee5b552 | no | `compare.ts` is not serve()-reachable, so no bundle diff. Discriminator status field left unmodelled -- optional reinforcement only. |
| 19 | C4 | 1a5baae | no | Fixed at the action call site for reader/writer symmetry. Confirmed the hole is reachable: `getInput` throws on an absent or empty input but NOT on whitespace, and the trim after it produces `''`. |
| 20 | C5 | 90c9623 | rebuilt, no diff | `build:action` run; the change is types plus comments, which erase, so esbuild emits no bundle diff. Laundering wrapper verified TS2322 by scratch probe. `src/index.ts` and `public-surface.spec.ts` untouched. |
| 21 | C6 | ecc7926 | no | Verified TS2345 on a misspelled code by scratch probe. Field helper and rendered code property untouched. |
| 22 | D1 | 120bf82 | rebuilt, no diff | `build:action` run; comment-only, so esbuild emits nothing. Branch behaviour unchanged. |
| 23 | D2, D4 | 07e6d55 | no | Comment/docstring lines only, verified by a filtered diff. Both D4 sites in one commit; the scoped grep is clean. D4-optional tripwire change NOT made, per CONTEXT UNRESOLVED. Retraction prose reworded to avoid re-planting the retracted phrase. |
| 24 | D3, D10 | e3829c2 | rebuilt, no diff | All four D3 wordings in one commit. `build:action` run; comment-only, no bundle diff. Legacy branch, OS values and platform helper all KEPT. D10 consumer lists derived by grep. |
| 25 | D5, D6 | 7d585ab | no | Adopter-facing prose only. Task 01's stricter mask guard stayed green on the README edit. |
| 26 | D7, D8 | cc3850b | no | Whole-file sweep; every internal pointer is now a job/step/config-key NAME. One pointer LEFT numeric on purpose: `cacheUtils.js:162-163`, a citation into the exact-pinned dependency and the repo-wide house form (nine sibling citations in the sources). D8 measurement intact, qualifier added. |
| 27 | E1 | 84e4b46 | no | Emit-oracle baseline captured FRESH immediately before the edit; diff EMPTY. `publish-mirror.spec.ts` unchanged, which is the other half of the byte-identity proof. |
| 28 | E2 | 37576da | no | Emit-oracle diff EMPTY across the E1+E2 pair, comparing the message SET -- the extraction moves both warnings earlier in the file, so scan order changes while no message does, and the oracle's placeholder table needed `scanned` bound to the same value as `hashes.length`. `publishMirror` 506 -> 335 lines. Helper not exported. No other fallow entry touched. |
| 29 | E3, E4 | 56b5276 | no | New `src/test/repo-file.ts`; `workspace-root-cwd.ts` imports the root rather than recomputing it, so one authored walk remains. No vitest import. No assertion changed (filtered-diff verified). Dogfood injection scan still reads RAW. `pack:check` needed no change -- `dist/test` is already excluded and the guard asserts it. |
| 30 | D12 | e114676 | no | Scope pinned to the PR-diff list (286 files) at execution time. 374 prose chars converted across 14 files; 17 left as fenced or backtick-quoted. Leave-class files byte-identical by checksum; re-run reports zero remaining prose-class; the open todo untouched. |

## What changed

All 44 enumerated findings (A1-A19, B1-B3, C1-C6, D1-D12, E1-E4) landed across 30
bisect-safe commits on `gsd/v0.0.2-os-invariant-cross-os-sharing`, base `c7793c4`.

Group A (19 items) strengthened guards that read as coverage and were not: a credential
guard satisfiable by an adjacent comment, three self-disabling or co-presence clauses,
four counts that could not localize, an exclusivity claim asserted at the wrong merge
layer, absence-only least-privilege clauses, and two uncovered production behaviours.

Group B (3) raised the typecheck-windows gate floor to 2 -- the leg resolves two cacheable
tasks -- and finished two ci.yml shell idioms that were left one copy behind.

Group C (6) are the code fixes: put()'s archive write moved inside its try/finally, a
warning on the token-absent degrade, a non-empty discriminator stdout requirement, an
empty-run-id refusal at the action call site, an internal `ReadOnlyBackend` so the
read-only union carries information, and a typed GitHub error-code parameter.

Group D (12) corrected false reasons this PR's own changes created, including three
N-copy sweeps that each landed atomically, and the PR-scoped non-ASCII conversion.

Group E (4) removed two duplications and the repo's only newly-introduced complexity
failure, both with emitted bytes proven unchanged.

## Where a stricter guard went red

ONE, at task 14 (B1). `dogfood-cross-os.spec.ts` pinned the gate floor literal `1` for
`typecheck-windows`, so raising the leg's floor to 2 reddened it. The guard was NOT
relaxed: its floor became a per-leg parameter of `windowsLegReasons` (build 1, typecheck
2, test 1). The pin is still exact, and the shared constant is precisely what let this
leg's floor read as a house value while the leg resolved two tasks.

No other guard reddened. Task 09's two new cases and task 11's tree-walk guard were both
green at HEAD, so no production defect surfaced behind them.

## The six REBUILD tasks

`npm run build:action` ran on all six (11, 16, 17, 20, 22, 24). Only TWO produced a
bundle diff to stage -- task 16 (C1, a moved statement) and task 17 (C2, a new warning).
The other four are comment-only or type-only edits, and both comments and types erase
under esbuild, so there was nothing to stage. `check:action` is the real gate and was
green at every commit and is green at HEAD.

`check:action` compares the working tree against the INDEX, so on a rebuild task the
regenerated bundle must be `git add`ed BEFORE the gate can pass.

## The two rejected sub-items

**A18's secondary clause -- anchor the lint-success grep in `ci.yml`. NOT implemented.**
Measured: `NO_COLOR=1 npx nx run-many -t lint --skip-nx-cache` prints the phrase behind a
leading space and Nx's own banner prefix, so a column-0 anchor could never match and the
lint job would fail on every run including good ones. It is also self-contradictory with
A18's primary fix, whose regex requires the unanchored literal. The reason is recorded at
the new guard so a future reader does not re-derive the anchor as an improvement.

**D4's optional tripwire change -- fold `alreadyPresent` into the read-miss condition.
NOT implemented.** CONTEXT.md marks it UNRESOLVED: whether
`alreadyPresent + readMisses === scanned` false-positives on a healthy run is unmeasured,
and the obvious alternative (an attempted-only denominator) was MEASURED firing on both
legs of a healthy run. Task 23 was the comment retraction only, and its diff contains
comment and docstring lines alone. The reason is recorded at the branch.

## One deliberate deviation from the plan's own instruction

Task 26 (D7) swept every INTERNAL numeric cross-reference out of `ci.yml`, but left
`cacheUtils.js:162-163` numeric. That is a citation into the exact-pinned
`@actions/cache` artifact rather than an internal cross-reference: it does not move when
`ci.yml` is edited, `pinned-deps.spec.ts` gates the pin those line numbers belong to, and
nine sibling citations in the TypeScript sources use the identical form. Converting one
of ten would have created an inconsistency and lost the citation's precision.

## Verification at HEAD

1. `lint && typecheck && test && check:action && pack:check` green.
2. 30 commits in `c7793c4..HEAD`, no AI attribution on any.
3. Every serve()-reachable source edit is either accompanied by the staged bundle or
   provably produced no bundle diff; `check:action` green at HEAD.
4. Bisect spot check: `d9435f0`, `774708e` and `b1e540a` checked out detached, all five
   commands green on each.
5. All 44 finding IDs map to exactly one commit in the table above.
6. Nothing from the "Explicitly REJECTED" or "Recorded, NOT fixed here" lists appears in
   the diff: no new barrel export, no deleted legacy accept branch, no deleted OS values
   or platform helper, and no change to the read-miss tripwire's firing condition,
   threshold or denominator (`PARTIAL_READ_MISS_WARN_RATIO` unchanged; the only edit in
   that expression is E2's `hashes.length` -> `scanned` parameter rename, proven
   byte-equivalent by the emit oracle).
   `git grep -n 'live rotation signal' -- packages docs README.md .github` returns nothing.
