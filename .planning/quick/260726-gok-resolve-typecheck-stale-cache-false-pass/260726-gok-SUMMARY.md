---
status: complete
task: 260726-gok
title: Resolve the typecheck stale-cache false-pass and the consumer-doc defects
executed: 2026-07-26
branch: gsd/quick-260726-gok-typecheck-inputs-consumer-docs
base: e56e5d2 (origin/main)
head: 5f54049
commits: 4
battery: 8/8 green before every commit (4 x 8 = 32 command runs, 0 failures)
tdd_red_observed: true
pushed: false
pr: none
---

# Quick Task 260726-gok -- Execution Summary

Four atomic commits, in the plan's order, on `gsd/quick-260726-gok-typecheck-inputs-consumer-docs`.
Nothing pushed, no PR opened. `.planning/STATE.md` untouched (orchestrator-owned per the plan's
ADVISORY 4 amendment). This SUMMARY.md is left uncommitted, as are PLAN/CONTEXT/RESEARCH/PLAN-CHECK.

## Task -> commit SHA

| Task | SHA | Subject | Files |
| --- | --- | --- | --- |
| 1 | `37f7d63` | `fix(nx): hash spec sources in the typecheck target's inputs` | `nx.json`, `packages/github-cache/src/nx-target-inputs.spec.ts` (NEW) |
| 2 | `e6430bf` | `fix(docs): mint the loopback bearer token with node, not openssl` | `README.md`, `docs/advanced.md`, `docs/examples/minimal-ci.yml`, `start-cache-server/action.yml`, `.github/workflows/ci.yml` |
| 3 | `3385cb7` | `docs(adoption): document the sidecar readiness poll and timeout-minutes` | `README.md`, `docs/examples/minimal-ci.yml`, `docs/advanced.md`, `start-cache-server/action.yml` |
| 4 | `5f54049` | `docs(citations): record that workflow-syntax now documents the background-step family` | `.github/workflows/ci.yml`, `.planning/milestones/v0.0.1-phases/06-distribution-docs-governance/06-RESEARCH.md` |

Diffstats as staged (each equals the committed tree, since `git status` showed only the untracked
quick-task directory at every commit point):

- Task 1: `nx.json | 3 ++-`, `nx-target-inputs.spec.ts | 125 +++` -- exactly the two files the plan's
  `verify` requires, no `.fallowrc.jsonc`.
- Task 2: 5 files, `16 insertions(+), 5 deletions(-)`.
- Task 3: 4 files, `94 insertions(+)`.
- Task 4: 2 files, `18 insertions(+), 4 deletions(-)`.

## Task 1 -- the observed RED, and that it preceded the config edit

Ordering was TEST-first, as `workflow.tdd_mode: true` requires. The guard spec was written and
`npm run test` was run **before** either `nx.json` edit. Measured result:

```
Test Files  1 failed | 30 passed (31)
     Tests  3 failed | 435 passed (438)
```

**Exactly 3 failures out of 5 assertion sites**, matching the amended plan's RED table exactly:

| assertion | outcome | detail |
| --- | --- | --- |
| `hashes the spec sources` | **FAIL** | `expected [ Array(1) ] to include 'packages/github-cache/src/index.spec.ts'` (`:82`) |
| `hashes tsconfig.spec.json` | **FAIL** | `expected [ Array(1) ] to include 'packages/github-cache/tsconfig.spec.json'` (`:88`) |
| `still hashes the lib sources` | pass | presence control -- passes on both sides by design |
| `does NOT hash the spec sources for build, proving the filter filters` | pass | non-vacuity control (NEGATIVE assertion) -- passes on both sides by design |
| `nx.json is a test input, so editing it re-runs this file` | **FAIL** | `expected [ 'default', '^production', ...(19) ] to include '{workspaceRoot}/nx.json'` (`:121`) |

Both controls PASSED on the RED side, so no STOP condition fired -- the resolver's shape is intact
and the `[ Array(1) ]` in both failure messages is the measured proof that `typecheck` resolved to
`src/index.ts` alone. `filterUsingGlobPatterns` genuinely filtered (1 of 3 probe files kept), which
is what makes the negative control non-vacuous.

After steps 1b (`production` -> `default`) and 1c (`{workspaceRoot}/nx.json` -> `test.inputs`), in the
same commit: `Test Files 31 passed (31)`, `Tests 438 passed (438)`, and the run was a genuine
`Cache: 0/1 hit (0%)` -- a fresh execution, not a replay.

## Plan `verify` checks -- every one, with its ACTUAL result

### Task 1

| Check | Result |
| --- | --- |
| `npm run test` shows the 3-failure RED, then GREEN | **PASS** -- 3/5 failed pre-fix, 438/438 passed post-fix (both recorded above) |
| `typecheck.options.command` unchanged | **PASS** -- `npx nx show project github-cache --json` returns `tsc --build tsconfig.json --emitDeclarationOnly`; resolved `typecheck.inputs` is `["default", {dependentTasksOutputFiles...}, {fileset...dependencies:true}, {externalDependencies...}]` -- only `inputs[0]` changed |
| End-to-end: deliberate spec type error, `npm run typecheck` non-zero **both** runs | **PASS** -- appended `const deliberateTypeError: number = 'not a number';` to `pinned-deps.spec.ts`. Run 1: `Found 2 errors.`, **EXIT 1**. Run 2: `Found 2 errors.`, **EXIT 1**. (The `Cache: 1/1 hit (100%)` on both is the `build` dependency task, which legitimately excludes specs -- `typecheck` itself re-ran and failed each time.) Before the fix this second run exited 0. |
| Revert the deliberate error, typecheck green again | **PASS** -- `git checkout --` on that one file; `Successfully ran target typecheck`, EXIT 0, `Cache: 2/2 hit (100%)`. Not committed; `git status` confirmed clean. |
| Full 8-command battery green | **PASS** -- 8/8 |
| `git diff --stat` shows exactly `nx.json` + the new spec | **PASS** (via `git diff --cached --stat` -- see deviation D6) -- `nx.json` + `nx-target-inputs.spec.ts`, nothing else |

### Task 2

| Check | Result |
| --- | --- |
| No `openssl rand` invocation anywhere in tracked non-`.planning` files | **PASS** -- `git grep -n "openssl rand" -- ':!.planning'` returns nothing |
| `git grep -n "openssl"` returns the two ci.yml prose mentions | **DEVIATED, invariant holds** -- 7 hits now: the 2 pre-existing prose mentions (`ci.yml:179`, `:352`) plus the 5 new `# node, not openssl:` WHY clauses the plan's own Task 2 action mandates. See deviation D2. |
| `::add-mask::` counts `README.md:2`, `docs/advanced.md:1`, `minimal-ci.yml:1`, unchanged from `origin/main` | **PASS** -- measured exactly `2 / 1 / 1`. README's prose mention at `:37` left alone, per the plan's explicit instruction not to "fix" it. |
| `npm run test` passes incl. `docs-adoption.spec.ts` + `public-surface.spec.ts` | **PASS** -- 438/438 |
| No file gained a non-ASCII character | **PASS** -- programmatic scan of all 5 edited files: every one ASCII-only end to end |
| Full 8-command battery green | **PASS** -- 8/8 |

### Task 3

| Check | Result |
| --- | --- |
| `npm run test` passes; LIFECYCLE_TOKENS present in both surfaces | **PASS** -- 438/438; `start-cache-server` / `background:` / `cancel:` all present (README 9 matching lines, minimal-ci.yml 5) |
| `git grep -n -e "operation:" -e "matrix:" -- docs/examples/minimal-ci.yml` returns nothing | **PASS** -- none. Ported comment text was rephrased, never copied from `ci.yml:144-146`. |
| `git grep -n "max-time 10"` -- one hit in each | **PASS** -- `README.md:1`, `docs/examples/minimal-ci.yml:1` |
| `git grep -n "timeout-minutes"` -- one hit in each | **DEVIATED in README, invariant holds** -- `README.md:2` (`:34` the snippet key + `:131` the mandated 3d prose bullet), `minimal-ci.yml:1` (`:27`). Exactly one `timeout-minutes:` YAML key per snippet. See deviation D3. |
| `git grep -n "30s"` across the 3 docs returns nothing | **PASS** -- none. The bound is written as "about 5.5 minutes -- not 30 seconds"; no "30s" restatement. |
| `git grep -n -e "continue-on-error" -- README.md docs/ start-cache-server/` returns nothing | **PASS** -- none. No `continue-on-error`, no `if:` gate, no fail-gate step introduced. |
| Read both snippets end to end; poll AFTER the sidecar and BEFORE the Nx step | **PASS** -- `minimal-ci.yml`: checkout -> setup-node -> `npm ci` -> pre-set vars -> sidecar (`background: true`) -> **poll** -> `npx nx affected` -> `cancel:`. `README.md` (an "add to your existing job" snippet, so no setup-node/npm ci by design): checkout -> pre-set vars -> sidecar -> **poll** -> `npx nx affected` -> `cancel:`. |
| Full 8-command battery green | **PASS** -- 8/8 |

### Task 4

| Check | Result |
| --- | --- |
| `git grep -n "does not mention them at all" -- ci.yml` returns nothing | **PASS** -- the false clause is gone |
| `git grep -n "30172888579" -- ci.yml` still returns its line | **PASS** -- all three run ids survive: `30172888579` (`:135`), `30172032003` (`:141`, plus `:163`), `30171349564` (`:145`). `:133-146` untouched apart from the line shift. |
| `git grep -n "not reproducible" -- 06-RESEARCH.md` returns nothing | **PASS** (and vacuous, as the plan itself flags -- kept as a wrote-the-wrong-thing tripwire) |
| `git grep -n "CORROBORATED" -- 06-RESEARCH.md` returns the NEW annotation line | **PASS** -- `06-RESEARCH.md:511`, "are both CORROBORATED" |
| `git grep -c "docs.github.com/en/actions/reference" -- 06-RESEARCH.md` increases by exactly one vs `origin/main` | **PASS** -- baseline on `origin/main` was **0**, now **1**. Delta +1. |
| `git grep -c "composite" -- docs/advanced.md start-cache-server/action.yml` unchanged vs `origin/main` | **PASS** -- `docs/advanced.md:4`, `start-cache-server/action.yml:1` on BOTH `origin/main` and HEAD |
| Cross-check `git diff origin/main -- docs/advanced.md` shows only Task 2 + Task 3 edits | **PASS** -- two hunks only: the openssl->node swap at `:98` and the Task 3 poll pointer. `docs/advanced.md:127-132` (the composite-`background:` claim) is not in the diff at all. `start-cache-server/action.yml:29` likewise untouched. U1 shipped exactly as written -- no soften, no probe, no drop. |
| `git grep -n "10 background steps" -- ':!.planning'` returns nothing | **PASS** -- none. The 10-concurrent-background-step limit exists only inside the `.planning` annotation, which itself states it is deliberately not propagated. |
| Full 8-command battery green | **PASS** -- 8/8 |

## Battery result per commit

`npm run format:check`, `build`, `typecheck`, `typecheck:action`, `test`, `fallow:ci`,
`check:action`, `pack:check` -- run from the repo root, all eight, immediately BEFORE each commit.

| Commit | Battery |
| --- | --- |
| `37f7d63` (Task 1) | **8/8 GREEN** |
| `e6430bf` (Task 2) | **8/8 GREEN** |
| `3385cb7` (Task 3) | **8/8 GREEN** |
| `5f54049` (Task 4) | **8/8 GREEN** |

Two contingencies the plan armed, neither of which fired:

- **`fallow:ci` on the new `nx` import** -- GREEN at Task 1 with no finding. `nx` is credited as a
  root devDependency exactly as the plan predicted, so **no `.fallowrc.jsonc` `ignoreDependencies`
  entry was added**.
- **`check:action` bundle drift** -- GREEN at all four commits. Nothing touched a `serve()`-reachable
  source, so `start-cache-server/index.js` was never regenerated and never needed staging.

`format:check` passed at every commit with no `npm run format` pass needed -- the new spec and every
doc/YAML edit were prettier-clean as written, including the YAML embedded in README.md's fenced block.

## Deviations, each with its reason

**D1 -- commit-message filenames.** Used
`scratchpad/gok-commit-{1,2,3,4}.txt` instead of the plan's `commit-<n>.txt`. The session scratchpad
already held `commit-1.txt`..`commit-4.txt` from the immediately preceding quick task (260726-4cc);
overwriting them would have destroyed that record and created a real risk of committing the wrong
message. Message BODIES are the plan's verbatim text, unmodified. `git commit -F` was used throughout
(`git commit -m` fails on this ReFS Dev Drive), so all four subjects and bodies landed intact.

**D2 -- Task 2's `git grep -n "openssl"` expected value was self-contradictory.** The plan's `verify`
expects "exactly the two ci.yml PROSE mentions", but the same task's `action` section requires adding
a WHY clause phrased "node, not openssl: ..." at each of four surfaces. Every such clause necessarily
contains the token. Resolved by treating the substantive check as the operative one:
`git grep -n "openssl rand" -- ':!.planning'` returns **nothing** -- zero invocations remain. The 5
extra hits are all new explanatory comments plus the 2 pre-existing prose mentions at `ci.yml:179`
and `:352`, which were left untouched as instructed.

**D3 -- Task 3's `timeout-minutes` count in README is 2, not 1.** Same shape of conflict: step 3d
mandates a prose bullet in "How it works" that names `timeout-minutes`, so the file must carry a
second textual hit. The YAML snippet itself has exactly one `timeout-minutes:` key
(`README.md:34`), and `minimal-ci.yml` is 1 as expected. Also note `docs/advanced.md` now contains
one `timeout-minutes` mention (in the 3e pointer prose, "Bound the job with `timeout-minutes` there
too") -- that file was not in the plan's grep list, so no expectation is violated.

**D4 -- the `start-cache-server/action.yml:15` contingency fired, as the plan anticipated.** The node
one-liner pushed the line past the file's comment width, so per the plan's stated fallback the
trailing inline note was dropped to its own comment line ("`# Mask BEFORE writing $GITHUB_ENV.`")
rather than wrapping the shell command. The note's content is preserved; only its placement moved.
Three WHY/mask comment lines now precede the token line. Every edit stayed ABOVE `inputs:`, and
`public-surface.spec.ts` still measures the action's key set as exactly `['port']` -- **no input was
added**.

**D5 -- `docs/advanced.md`'s openssl site was adapted, not pattern-replaced.** As the plan's table
requires: the `export VAR="$(...)"` shape is preserved and only the command substitution's body was
swapped. Its WHY clause is worded in the `&`-fallback block's own voice and adds the block-specific
reason (`npx @op-nx/github-cache` already requires node).

**D6 -- Task 1's `git diff --stat` check was run as `git diff --cached --stat`.** The new spec file
was untracked, so unstaged `diff --stat` cannot see it and reported only `nx.json`. Verified after
staging instead, which showed exactly the two intended files and nothing else -- the check's actual
intent.

**D7 -- ASCII verification was scoped to added lines for `06-RESEARCH.md`.** A whole-file scan of that
artifact reports many non-ASCII characters, all pre-existing em dashes (including on line 508 itself,
which the plan requires to stay byte-identical). Scoping the scan to this task's `+` lines across
both Task 4 files returns clean: **every added line is ASCII-only**. The `:508` bullet is unmodified;
the annotation is a new nested bullet beneath it.

## Blocking constraints -- confirmation

1. Guard + `{workspaceRoot}/nx.json` wiring landed in the SAME commit (`37f7d63`). Never split.
2. Non-vacuity control is the NEGATIVE assertion on `build`, verbatim from the amended plan.
3. The plan's THREE-function trio was used (`splitInputsIntoSelfAndDependencies` ->
   `extractPatternsFromFileSets` -> `filterUsingGlobPatterns`). `expandSingleProjectInputs` was never
   imported.
4. `TargetInputs` derived structurally; `InputDefinition` never imported. `typecheck` green.
5. Real RED observed before GREEN, inside Task 1's single commit; 3 of 5, both controls passing.
6. Full 8-command battery green before all four commits, not just the last.
7. `.planning/STATE.md` not edited. PLAN / CONTEXT / RESEARCH / PLAN-CHECK / SUMMARY not committed.
8. U1 untouched: `docs/advanced.md:127-132` and `start-cache-server/action.yml:29` are not in the
   diff vs `origin/main`.
9. The A5 annotation says "CORROBORATED" with the URL; never "not reproducible". The 10-step limit
   reaches no consumer doc.
10. `::add-mask::` counts unchanged at `2 / 1 / 1`; every existing mask line kept; README prose at
    `:37` not "fixed".
11. `minimal-ci.yml` contains neither `operation:` nor `/matrix:/`.
12. No input added to `start-cache-server/action.yml`.
13. No "30s bound" anywhere; the ~5.5-minute worst case is stated with its arithmetic.
14. `timeout-minutes` framed as generic hang insurance, kept distinct from the omitted-`cancel:` hang.
    No `continue-on-error` / `if:` / fail-gate mechanism introduced.

## Left behind / handed off

- **Nothing to clean up.** `git status` is clean apart from the untracked quick-task planning
  directory. The deliberate type error was reverted with `git checkout --` and never staged. No probe
  or throwaway file was written into the repo or into `node_modules` -- the battery script and the
  four commit-message files live in the session scratchpad only.
- **For the orchestrator:** close the two Deferred Items rows in `.planning/STATE.md`
  (`Docs` at `:196`, `CI hygiene` at `:197`), add the Quick Tasks row, and commit the planning
  artifacts. Not pushed, no PR.
- **Known one-line follow-up, deliberately out of scope** (already named in the plan): add
  `'start-cache-server/action.yml'` to `DOCS_WITH_ENV_WRITE` in `docs-adoption.spec.ts:95-99`. That
  file's comment block carries the token, `GITHUB_ENV` and `::add-mask::` yet is unguarded, and it is
  already a `test` input (`nx.json:50`), so the wiring is free. Task 3 added two more comment lines to
  that same block, so the gap is marginally wider than before.
