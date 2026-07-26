---
status: passed
task: 260726-gok
title: Resolve the typecheck stale-cache false-pass and the consumer-doc defects
verified: 2026-07-26
verifier: independent audit (fresh context, no orchestrator verdict inherited)
branch: gsd/quick-260726-gok-typecheck-inputs-consumer-docs
base: e56e5d2
head: 5f54049
commits_audited: 4
must_haves: 11 truths MET, 7 artifacts MET, 4 key_links MET (0 PARTIAL, 0 UNMET)
blocking_gaps: 0
advisory_gaps: 4
mutation_test_run: true
mutation_test_result: guard FAILS when the hole is reopened (2 failures) -- guard is not vacuous
tree_clean_after: true
---

# Quick Task 260726-gok -- Independent Verification

**Goal under audit:** "Resolve typecheck stale-cache false-pass and the consumer-doc
defects in a single PR."

**Verdict: PASSED.** Every load-bearing claim I re-derived held. The one check no prior
agent had run -- the mutation test proving the guard can actually FAIL -- passes
decisively. I additionally proved the second, previously-unmeasured instance of the same
defect (`tsconfig.spec.json`) both exists and is closed by the same one-token change.
Four advisory gaps, none blocking, none in the shipped consumer contract.

Everything marked MEASURED below was executed by me in this session against the live
tree, not read from SUMMARY.md.

---

## Method note, and one self-inflicted measurement error I corrected

Working-tree mutations were applied via scratchpad scripts with an `EXIT` trap doing
`git checkout --`, so no probe could survive a failure. No probe file was written into
the repo or into `node_modules`. Final `git status --porcelain` is exactly
`?? .planning/quick/260726-gok-resolve-typecheck-stale-cache-false-pass/`.

**Correction to my own process, recorded because it nearly produced two false
REFUTATIONS.** I ran one batch of `git grep` working-tree measurements concurrently with
a backgrounded bisect script that was hopping detached checkouts. Those readings were
taken against `37f7d63`, not HEAD, and appeared to show (a) `ci.yml` still containing
"does not mention them at all" and (b) the `06-RESEARCH.md` URL count unchanged at 0 --
i.e. Task 4 not landed. Both are artifacts of the race. Re-measured after the bisect
restored the branch: both SUMMARY claims are CORRECT. Every number in this report is from
a post-restore, branch-confirmed measurement (`git rev-parse` sanity-checked in the same
invocation).

---

## THE SIX ITEMS REQUIRING SPECIFIC JUDGEMENT

### ITEM 1 -- THE MUTATION TEST: **PASS**. The guard can fail, and fails for the right reason.

MEASURED. Reverted `nx.json` `targetDefaults.typecheck.inputs[0]` from `default` back to
`production` in the working tree (single-token change, diff verified before running), then
`npx nx test github-cache --skip-nx-cache`:

```
FAIL  src/nx-target-inputs.spec.ts > typecheck hashes everything its command compiles > hashes the spec sources
AssertionError: expected [ Array(1) ] to include 'packages/github-cache/src/index.spec.ts'
  at src/nx-target-inputs.spec.ts:82:41

FAIL  src/nx-target-inputs.spec.ts > typecheck hashes everything its command compiles > hashes tsconfig.spec.json
AssertionError: expected [ Array(1) ] to include 'packages/github-cache/tsconfig.spec.json'
  at src/nx-target-inputs.spec.ts:88:41

Test Files  1 failed | 30 passed (31)
     Tests  2 failed | 436 passed (438)
```

| | failures | detail |
| --- | --- | --- |
| HEAD (`default`) | **0** of 438 | 31 files / 438 tests passed |
| Mutated (`production`) | **2** of 438 | both spec-hashing assertions; both controls still PASS |

Then `git checkout -- nx.json`; `inputs[0]` back to `"default"`, `git status` clean, and
the subsequent `--skip-nx-cache` run at HEAD is 438/438 green again (re-confirmed twice:
in the bisect leg for `5f54049` and in the full battery).

Three things this establishes beyond "it fails":

- The failures are **exactly** the two assertions that encode the fix. The presence
  control and the negative non-vacuity control both still pass under the mutation --
  which is the plan's stated STOP condition, and it did not fire. The resolver's shape is
  intact; only the fileset moved.
- `[ Array(1) ]` in both messages is the measured proof that `typecheck` resolved to one
  file (`src/index.ts`) out of three probes. The filter genuinely filtered.
- The mutated failure text is **byte-for-byte the same assertion output the SUMMARY
  reports for its pre-fix RED** at `:82` and `:88`. That independently corroborates the
  claimed RED without having to trust the executor's transcript.

The SUMMARY reports a 3-failure RED; my mutation reproduces 2 of the 3. The third
(`nx.json is a test input`) is not reachable by mutating `inputs[0]` alone -- it is
corroborated separately: `{workspaceRoot}/nx.json` is an ADDED line in `37f7d63`, so
`origin/main`'s `test.inputs` provably lacked it. The 3-count is consistent.

### ITEM 2 -- NON-VACUITY: **PASS**, and non-vacuous in exactly the way the amendment intended.

The amendment's premise is real. MEASURED in `node_modules/nx/dist/src/hasher/task-hasher.js`:

```
285:    if (positive.length === 0 && negative.length === 0) {
286:        return files;
```

So an empty pattern list IS a pass-through, and every `toContain()` in that describe
would pass together on a resolver that resolved nothing. The negative control is
therefore the right shape.

MEASURED that it genuinely discriminates -- `build`'s resolved pattern list is **16
patterns, not 0**, of which **12 are negations**, including the decisive one:

```
positive : ["{projectRoot}/package.json","{workspaceRoot}/tsconfig.base.json",
            "{projectRoot}/tsconfig.lib.json","{projectRoot}/src/**/*.ts"]
NEGATIVE : [... "!{projectRoot}/src/**/*.spec.ts" ...]  (12 total)
build resolves to : ["packages/github-cache/src/index.ts"]
spec excluded     : true
```

`build` keeps 1 of 3 probe files. The `not.toContain(<spec path>)` assertion is true
because the filter actively excluded the spec, NOT because the pattern list was empty --
so it is meaningful, and it flips false the instant the filter stops filtering. Confirmed
by the mutation test too: the control held under the mutation, which is what a control is
for.

I also verified the **mechanism** behind `must_haves` truth 1 at the JS layer the guard
actually uses (research proved it at the Rust hashing layer). `filterUsingGlobPatterns`
buckets by leading `!` in a position-blind loop (`:277-284`) and then applies
`negative.every(pattern => minimatch(f.file, pattern))` **unconditionally** after the
positive test (`:297-299`). A later positive pattern therefore cannot undo an earlier
negation. "Keep `production` and re-add the two globs" would indeed have been a no-op.

### ITEM 3 -- THE SECOND, UNREPORTED INSTANCE (`tsconfig.spec.json`): **PASS**. Confirmed present, and confirmed closed.

Nobody had measured this one. I ran the same differential shape as item 1, at HEAD and
under the `production` mutation, so the DELTA is the evidence rather than an absolute
reading. Each cell is a real `npm run typecheck` invocation.

| scenario | HEAD (`default`, fixed) | mutated (`production`, broken) |
| --- | --- | --- |
| warm, then re-run unchanged | EXIT 0, `Cache: 2/2 hit (100%)` | EXIT 0, `Cache: 2/2 hit (100%)` |
| **after a spec-source type error** | **EXIT 1**, `Found 2 errors.`, task re-ran | **EXIT 0**, `Cache: 2/2 hit (100%)` -- the FALSE PASS |
| **after touching `tsconfig.spec.json`** | **`Cache: 1/2 hit (50%)`** -- `typecheck` RE-RAN | **`Cache: 2/2 hit (100%)`** -- REPLAYED |

Both rows are the same bug and both are closed by the same one-token change. The
`tsconfig.spec.json` row is the instance no prior artifact measured; it behaved exactly as
the plan predicted, and `default` covers it via `{projectRoot}/**/*` with **no separate
input entry** (`must_haves` truth 4 -- MET by measurement, not by argument).

Corroborating resolver-level measurement, same session:

```
typecheck patterns at HEAD (default)     : ["{projectRoot}/**/*","{workspaceRoot}/tsconfig.base.json"]
  -> resolves to src/index.ts, src/index.spec.ts, tsconfig.spec.json   (all 3)
typecheck patterns MUTATED (production)  : [... "!{projectRoot}/**/?(*.)+(spec|test).[jt]s?(x)?(.snap)",
                                                "!{projectRoot}/tsconfig.spec.json"]
  -> resolves to src/index.ts                                          (1 of 3)
```

**Orchestrator's differential: CONFIRMED, independently reproduced.** Warmed the cache at
HEAD, appended a deliberate type error to `packages/github-cache/src/pinned-deps.spec.ts`,
re-ran: **EXIT 1, "Found 2 errors."** (the appended `const __probe: number = "not a
number";` yields TS2322 plus a `noUnusedLocals` TS6133 -- hence 2, matching the
orchestrator and the SUMMARY exactly). Under the mutation the identical edit gives EXIT 0
at `Cache: 2/2 hit (100%)`. File restored via `git checkout --`; never staged.

### ITEM 4 -- CONSUMER DOC EDITS: **PASS** on (a)-(c) and (e); **PASS with one advisory** on (d).

**(a) Byte-identity of the node one-liner -- MET.** Extracted `origin/main:.github/workflows/ci.yml:183`
and string-compared it (leading whitespace and `#` stripped) against every new site:

```
origin/main ci.yml:183 : token="$(node -e 'process.stdout.write(require("crypto").randomBytes(32).toString("hex"))')"
IDENTICAL  HEAD:README.md:49
IDENTICAL  HEAD:docs/examples/minimal-ci.yml:48
IDENTICAL  HEAD:.github/workflows/ci.yml:526
IDENTICAL  HEAD:start-cache-server/action.yml:18
IDENTICAL  HEAD:.github/workflows/ci.yml:185   (the pre-existing proven site, unchanged)
```

`docs/advanced.md:101` is the adaptation the plan mandated -- `export VAR="$(...)"` shape
preserved, only the substitution body swapped. Verified by eye and in the diff.

Zero `openssl rand` invocations remain in tracked non-`.planning` files. The 7 surviving
`openssl` tokens are 2 pre-existing `ci.yml` prose mentions (`:181`, `:354`) plus 5 new
`# node, not openssl:` WHY clauses the plan's own Task 2 action REQUIRED. The SUMMARY's
deviation D2 correctly identifies the plan's verify expectation as self-contradictory;
its substitution of `openssl rand` as the operative check is the right call.

**(b) It actually produces 64 hex chars -- MET, RUN.** Executed the one-liner verbatim in
Git Bash on this Windows machine:

```
value  : 834b83de41af3ba4e264821a324459fb82715d331f3749b15cf4713ef5b81851
length : 64
matches ^[0-9a-f]{64}$ : YES
byte count (wc -c)     : 64  -> no trailing newline
```

Entropy and format are equivalent to `openssl rand -hex 32`. The `-e` payload is
single-quoted and contains no `$`, no backtick and no single quote, and it sits inside a
`run: |` literal block scalar with no `${{`, so neither the outer-shell-expansion trap
nor YAML/Actions interpolation can engage. It survives YAML embedding: `format:check`
(which covers the README's fenced block and both YAML files) is green.

**(c) Poll demands exactly 404-or-200 and claims no 30s bound -- MET.** MEASURED:

```
README.md:85 / minimal-ci.yml:86 : if [ "${code}" = "404" ] || [ "${code}" = "200" ]; then
README.md:90 / minimal-ci.yml:91 : if [ "${code}" != "404" ] && [ "${code}" != "200" ]; then
git grep -n "30s" -- README.md docs/examples/minimal-ci.yml docs/advanced.md   -> (none)
git grep -n "5.5 minutes"                                                     -> 1 hit in each
git grep -c "max-time 10"                                                     -> README.md:1, minimal-ci.yml:1
```

Both files carry the reasoning verbatim, including the "Accepting 'any status but 000'
would pass a 401" clause and the `30 x (10 + 1), about 5.5 minutes -- not 30 seconds`
arithmetic. **rk4 finding N3b's correction is preserved, not re-broken.** The poll sits
AFTER the sidecar step and BEFORE `npx nx affected` in both snippets (read end to end).

**(d) `shell: bash` on anything a Windows runner would execute -- MET as scoped, one
ADVISORY.** Both consumer snippets pin `runs-on: ubuntu-latest` (`README.md:26`,
`minimal-ci.yml:19`), where the key is a no-op, and both carry the plan's single-sentence
Windows note (`README.md:108`, `minimal-ci.yml:28`). That is exactly the plan's Task 3c
decision -- do not sprinkle redundant keys through a beginner quickstart -- and it is the
right call. See ADVISORY 1 for the `docs/advanced.md` `&`-fallback snippet, which is the
one bash-dependent snippet with no Windows note.

**(e) `timeout-minutes` framing, and no fail-gate mechanism -- MET.** One
`timeout-minutes:` YAML key per snippet (`README.md:34`, `minimal-ci.yml:27`), each
preceded by the comment that keeps the two hangs distinct: generic hang insurance, NOT
the containment control for a failing step, and explicitly noting that a `cancel:` step
is not subject to skip-on-failure so the omitted-`cancel:` hang is a different thing.
MEASURED: `git grep -n -e "continue-on-error" -e "if:" -- README.md docs/ start-cache-server/`
returns **nothing**. No `continue-on-error`, no `if:` gate, no fail-gate step reached
adopters. rk4's rejection is honoured.

The SUMMARY's D3 (README shows 2 textual `timeout-minutes` hits, not 1) is accurate and
correctly reasoned -- step 3d itself mandates the prose bullet that creates the second
hit. `docs/advanced.md:118` carries a third mention in the 3e pointer prose; that file
was not in the plan's grep list, so no expectation is violated.

### ITEM 5 -- LOCKED-DECISION COMPLIANCE, BOTH DIRECTIONS: **PASS**.

**U1 -- the composite-`background:` claim ships EXACTLY as written. MET by byte
comparison**, not by reading the diff. Line numbers shifted (Task 2/3 inserted above),
so I located the blocks by content and `cmp`-ed them:

```
docs/advanced.md              origin/main :127-132  ==  HEAD :137-142   [OK] BYTE-IDENTICAL
start-cache-server/action.yml origin/main :29-30    ==  HEAD :34-35     [OK] BYTE-IDENTICAL
"composite" counts   advanced.md 4 -> 4  |  action.yml 1 -> 1           [OK] UNCHANGED
```

Neither block appears in `git diff origin/main..HEAD`. `docs/advanced.md` has exactly two
hunks (the Task 2 openssl swap, the Task 3 poll pointer) and `start-cache-server/action.yml`
exactly two (openssl swap, poll pointer). **No soften, no probe, no drop.**

**A5 -- MET, and the direction is right.** `06-RESEARCH.md:508` is BYTE-IDENTICAL to
`origin/main` (`cmp` clean), pre-existing em dash preserved. The annotation is a new
nested bullet at `:509-520`, and it says:

- "are both **CORROBORATED**" -- MEASURED at `:511`.
- WITH the URL -- MEASURED: `docs.github.com/en/actions/reference` count goes **0 on
  `origin/main` -> 1 at HEAD**, delta exactly +1, at `:513`.
- Never "not reproducible" / "unreproducible" -- MEASURED: neither string is in the file.
  (This check is vacuous on its own, as the plan itself flags; the two positive checks
  above are the substantive ones and both land.)
- The 10-concurrent-background-step limit -- MEASURED
  `git grep -n "10 background steps" -- ':!.planning'` returns **nothing**. It exists only
  inside the `.planning` annotation, which itself states it is deliberately not
  propagated. **No consumer doc asserts it.**

**A7 -- the `ci.yml` doc-lag correction, MET.** `git grep "does not mention them at all"
-- .github/workflows/ci.yml` returns nothing at HEAD and returns `:132` at `origin/main`.
All three measured run ids survive (`30172888579` at `:135`, `30172032003` at `:141` and
`:163`, `30171349564` at `:145`), as does the `shell: bash` note. Only the false premise
was rewritten; every measurement is intact.

### ITEM 6 -- BISECT-SAFETY: **PASS**. All four commits independently green, on FRESH runs.

I checked out each commit detached and ran both gates with `--skip-nx-cache`, so **every
result below is a fresh execution, not a cache replay** -- which matters specifically
because `typecheck` is the target whose inputs changed:

| commit | subject | `nx test --skip-nx-cache` | `npm run typecheck -- --skip-nx-cache` |
| --- | --- | --- | --- |
| `37f7d63` | fix(nx): hash spec sources... | EXIT 0 -- 438 passed (438), 31 files | EXIT 0, 0 errors |
| `e6430bf` | fix(docs): mint ... with node | EXIT 0 -- 438 passed (438), 31 files | EXIT 0, 0 errors |
| `3385cb7` | docs(adoption): readiness poll... | EXIT 0 -- 438 passed (438), 31 files | EXIT 0, 0 errors |
| `5f54049` | docs(citations): workflow-syntax... | EXIT 0 -- 438 passed (438), 31 files | EXIT 0, 0 errors |

I did all four rather than the requested minimum of two. Branch restored to
`gsd/quick-260726-gok-typecheck-inputs-consumer-docs` @ `5f54049`, tree clean.

**Atomicity of the load-bearing commit -- MET.** `git show 37f7d63` is exactly two files,
and BOTH `nx.json` hunks are in it:

```
 nx.json                                            |   3 +-
 packages/github-cache/src/nx-target-inputs.spec.ts | 125 +++++++++++++++++++++
 @@ -47,6 +47,7 @@   + "{workspaceRoot}/nx.json",
 @@ -115,7 +116,7 @@  - "production"   + "default"
```

The guard cannot land without its precondition. No `.fallowrc.jsonc` -- the contingency
did not fire.

**Full 8-command battery at HEAD, independently re-run: 8/8 GREEN.**
`format:check`, `build`, `typecheck`, `typecheck:action`, `test`, `fallow:ci`,
`check:action`, `pack:check` -- all `[OK]`, tree clean afterwards (so `check:action` found
no bundle drift: the regenerated `start-cache-server/index.js` is byte-identical, as
expected since nothing touched a `serve()`-reachable source).

CONFIRMED of the orchestrator's re-measurement: battery 8/8; `nx test --skip-nx-cache`
**438 passed in 31 files**; the `nx.json` diff is exactly `typecheck.inputs[0]`
`production`->`default` plus `{workspaceRoot}/nx.json` in `test.inputs`, both in
`37f7d63` with the guard; the non-vacuity control is the negative `not.toContain` form;
`expandSingleProjectInputs` absent from the repo; no composite line changed in
`docs/advanced.md`; `::add-mask::` counts still `README.md:2 / advanced.md:1 /
minimal-ci.yml:1`; `minimal-ci.yml` free of `operation:` and `matrix:`. **Nothing
refuted.**

---

## `must_haves` -- per-item verdict

### Truths (11/11 MET)

| # | Truth | Verdict | Evidence I derived |
| --- | --- | --- | --- |
| 1 | `typecheck.inputs` starts from `default`, not `production` + re-added globs (the re-add is a no-op) | **MET** | `nx.json` `inputs[0]` = `"default"`; diff is that one token. Mechanism re-proved at the JS layer the guard uses: `filterUsingGlobPatterns` buckets by leading `!` position-blind (`task-hasher.js:277-284`) then applies `negative.every(...)` unconditionally (`:297-299`) -- a later positive cannot undo an earlier negation |
| 2 | `{workspaceRoot}/nx.json` joins `test.inputs` in the SAME commit as the guard | **MET** | `git show 37f7d63` = 2 files, both `nx.json` hunks present. Guard's own assertion passes at HEAD and would be the 3rd RED failure pre-fix |
| 3 | The guard pins the INVARIANT, not the spelling -- resolves via Nx's own exported resolver, never `inputs[0] === 'default'` | **MET** | No `'default'` / `"default"` literal anywhere in the spec (grep clean). Imports are the trio only. Mutation test confirms it responds to the resolved FILESET, not to a string |
| 4 | `tsconfig.spec.json` needs NO separate input entry -- `default` covers it, same one-token fix | **MET** | ITEM 3 differential: resolver keeps `tsconfig.spec.json` under `default`, drops it under `production`; and the live `Cache: 1/2 hit (50%)` vs `2/2 hit (100%)` delta on a real edit |
| 5 | U1 RESOLVED -- `docs/advanced.md:127-132` and `action.yml:29` stay EXACTLY as written | **MET** | `cmp` byte-identical vs `origin/main` at both sites; absent from the diff; `composite` counts unchanged 4/4 and 1/1 |
| 6 | A5: `06-RESEARCH.md:508` annotation says corroborated WITH the URL, never "not reproducible"; 10-step limit stays out of consumer docs | **MET** | `:508` byte-identical (em dash preserved); `CORROBORATED` at `:511`; URL count 0 -> 1; `"10 background steps"` outside `.planning` returns nothing |
| 7 | `timeout-minutes` is generic hang insurance, NOT the containment control; no continue-on-error / fail-gate reaches adopters; two hangs kept distinct | **MET** | One YAML key per snippet with the distinguishing comment; `continue-on-error` and `if:` both absent from `README.md docs/ start-cache-server/` |
| 8 | Poll demands exactly 404-or-200 with the reasoning; `--max-time 10` bounds each attempt so worst case ~5.5 min; never restate a 30s bound | **MET** | Exact `= "404" \|\| = "200"` and `!= "404" && != "200"` in both files; `30s` grep empty; `5.5 minutes` present in both; `max-time 10` one hit each |
| 9 | The full 8-command battery passes at EVERY commit, not just the last | **MET** | Battery 8/8 re-run at HEAD by me. At all four commits I re-ran the two gates that can actually regress here (`test`, `typecheck`) with `--skip-nx-cache`: green everywhere. See ADVISORY 3 on the residual scope |
| 10 | `workflow.tdd_mode`: Task 1 observes a real RED before GREEN, inside one atomic commit | **MET (corroborated, see note)** | The RED *state* is not recoverable from a squashed commit, but I reproduced it: the mutation yields byte-identical assertion output at `:82` and `:88` to the SUMMARY's reported RED. Ordering (test-before-config) rests on the executor's transcript; the RED's existence and its exact shape do not |
| 11 | ASCII only in every written file | **MET** | `git diff e56e5d2..HEAD \| rg '^\+' \| rg '[^\x00-\x7F]'` -> no matches. Every added line across all 4 commits is ASCII |

### Artifacts (7/7 MET)

| # | Artifact | Verdict |
| --- | --- | --- |
| 1 | `nx.json`: `typecheck.inputs[0]` `production`->`default`; `test.inputs` gains `{workspaceRoot}/nx.json` | **MET** -- exactly those two changes, nothing else in the file |
| 2 | `nx-target-inputs.spec.ts` NEW, resolving via the trio, asserting spec path + `tsconfig.spec.json` survive, plus the `test.inputs` self-wiring assertion | **MET** -- 125 lines, 5 `it()` blocks, zero `it.each`; all five assertions present |
| 3 | `openssl rand -hex 32` -> the proven node one-liner at all 5 sites | **MET** -- 4 byte-identical, 1 adapted `export` shape as mandated; zero `openssl rand` invocations remain |
| 4 | `README.md` + `minimal-ci.yml` carry the poll and `timeout-minutes` with reasoning; `advanced.md` + `action.yml` POINT at it | **MET** -- full block in the two copy-paste surfaces; `advanced.md:110-118` and `action.yml:26-27` are pointers, not copies. Relative link anchor resolves (`README.md:13` = `## Quickstart (5 minutes)`) |
| 5 | `.github/workflows/ci.yml`: the stale doc-lag comment at `:128-132` corrected | **MET** -- false clause gone, all 3 run ids and the `shell: bash` note intact |
| 6 | `06-RESEARCH.md:508` annotated as corroborated, with the URL | **MET** -- see truth 6 |
| 7 | Four atomic bisect-safe commits, each independently green | **MET** -- see ITEM 6 |

### Key links (4/4 MET)

`260726-gok-RESEARCH.md` EXISTS. `260726-gok-CONTEXT.md` EXISTS. `.planning/STATE.md`
EXISTS; its two Deferred Items rows are at `:196` (`Docs`) and `:197` (`CI hygiene`) as
the plan-check measured, both still reading "open follow-up" -- correct at this point, see
ADVISORY 2. `.github/workflows/ci.yml:179-227` accurate: the node-not-openssl WHY comment
and the hardened poll are there (now at `:181-185` and `:195+` after the Task 2 insertion).

---

## ALSO ASSESSED (reported, not fixed)

### RESEARCH.md item 7 is WRONG -- **CONFIRMED, by execution**

MEASURED. Calling the research's recommended function directly on this repo's inputs:

```
expandSingleProjectInputs(nxJson.targetDefaults.typecheck.inputs, nxJson.namedInputs)
-> THROWS: namedInputs definitions can only refer to other namedInputs definitions
           within the same project.
```

Cause confirmed -- the offending entry is present:
`{"fileset":"{projectRoot}/**/*.{d.ts,d.cts,d.mts}","dependencies":true}`. Only
`splitInputsIntoSelfAndDependencies` routes it to `depsFilesets` before expansion. The
plan-check's correction stands; the plan's divergence from RESEARCH.md was a **fix, not a
drift**. Do not "restore" the research version.

**The shipped guard mirrors Nx's own `getTargetInputs`.** I dumped the live function
source:

```js
function getTargetInputs(nxJson, projectNode, target) {
    const namedInputs = getNamedInputs(nxJson, projectNode);
    const targetData = projectNode.data.targets[target];
    const inputs = splitInputsIntoSelfAndDependencies(targetData.inputs || DEFAULT_INPUTS, namedInputs);
    const selfInputs = extractPatternsFromFileSets(inputs.selfInputs);
    ...
```

Identical composition to `hashedFilesFor()`. All five functions are present on the runtime
module (`splitInputsIntoSelfAndDependencies`, `extractPatternsFromFileSets`,
`filterUsingGlobPatterns`, `expandSingleProjectInputs`, `getTargetInputs` -- all
`function`), and `expandSingleProjectInputs` is nowhere in this repo.

### Deep-import failure mode -- **CONFIRMED LOUD**

MEASURED. Requiring a moved subpath under the same resolver the spec uses:

```
code: MODULE_NOT_FOUND
message: Cannot find module '...\node_modules\nx\dist\src\hasher\task-hasher-MOVED.js'
```

A hard throw at import time, which vitest reports as a failed test FILE, not a skipped or
silently-passing one. The accepted trade holds: an Nx major relocating `nx/src/*` breaks
the guard loudly and immediately. Never a silent pass.

### What the SUMMARY over- or under-reported

**Over-reported: nothing material.** I attempted to refute two of its Task 4 claims and
both survived once my own measurement race was removed. Every `verify` result I spot-checked
reproduced, including the exact `Found 2 errors.` / EXIT 1 double-run and the
`Cache: 1/1 hit (100%)` explanation (the hit is the `build` dependency task; `typecheck`
itself re-ran and failed).

**Under-reported, in the SUMMARY's favour -- two things it did not claim and could have:**

1. **It never ran the mutation test.** The guard's entire value proposition -- that it
   fails when someone reopens the hole -- was asserted by construction, never executed.
   It does fail (ITEM 1). Worth having in the record; a guard nobody has seen go red is a
   guard nobody has verified.
2. **It never measured the `tsconfig.spec.json` instance end to end.** The SUMMARY proves
   the resolver keeps the file, but never showed a real `tsconfig.spec.json` edit busting
   the hash where it previously replayed. It does (ITEM 3). This was the second, unreported
   half of the original defect.

**One cosmetic imprecision in the shipped guard's comment** (informational, not a gap):
it says `filterUsingGlobPatterns` "starts with
`if (positive.length === 0 && negative.length === 0) return files`". That check is at
`:285-286`, after pattern normalization and bucketing at `:264-284` -- so not literally
"starts with". The semantic claim is exactly right and load-bearing; only the word
"starts" is loose.

**One SUMMARY framing worth keeping visible:** the deviations D2 and D3 are not executor
sloppiness -- both are genuine self-contradictions inside the plan's own `verify` steps
(a task that mandates adding `# node, not openssl:` comments cannot also expect the
`openssl` grep to return only 2 hits). The executor resolved both by substituting the
substantive invariant. That was the right call and is correctly documented.

---

## GAPS

### Blocking: **NONE**

### ADVISORY 1 -- `docs/advanced.md`'s `&`-fallback snippet is bash-only with no Windows note

The Task 3c Windows sentence went to `README.md:108` and `minimal-ci.yml:28`, both of
which pin `runs-on: ubuntu-latest`. The one snippet that is bash-dependent AND has no
`runs-on` to reassure the reader is the `&` fallback at `docs/advanced.md:90-113`: it uses
`export`, `$(...)`, `&` and `>> "$GITHUB_ENV"`, and its own new WHY clause at `:98-100`
explicitly invokes "a Windows runner's Git Bash". On a Windows runner every one of those
steps needs `shell: bash`, and that file never says so.

Not blocking, and not a plan violation -- Task 3c scoped the note to the two copy-paste
surfaces by design, and `advanced.md` was out of that scope. But the `&` fallback is
precisely the older-runner / GHES / self-hosted path where a Windows runner is most
plausible, so the omission is slightly counter-aimed. One sentence next to `:115-118`
would close it. Follow-up, not a fix for this PR.

### ADVISORY 2 -- `STATE.md`'s two Deferred Items rows are still open

`.planning/STATE.md:196` (`Docs`) and `:197` (`CI hygiene`) both still read "open
follow-up" while the underlying defects are fixed. This is CORRECT at this point in the
workflow: the plan's ADVISORY-4 amendment explicitly assigns STATE.md to the orchestrator
and forbids the executor from touching it, and the executor complied. Recorded so the
hand-off is not lost -- the orchestrator must close both rows and add the Quick Tasks row
before this is done.

### ADVISORY 3 -- per-commit battery coverage is 2 of 8 commands, independently

The SUMMARY claims 8/8 green before each of the four commits (32 runs). I re-ran the full
8 only at HEAD, and at each of the four commits re-ran `test` and `typecheck` with
`--skip-nx-cache`. Those two are the only gates that can plausibly regress from these
changes, and `typecheck` is specifically the target whose inputs moved -- so the residual
risk is low and confined to `format:check` / `pack:check` / `check:action` /
`fallow:ci` / `build` / `typecheck:action` at the three intermediate commits. I am
accepting the SUMMARY's claim for those; it is not independently re-derived. Flagged for
honesty about what I measured, not as a suspected defect.

### ADVISORY 4 -- the `test`-input assertion has a one-edit blind spot (already documented in code)

`it('nx.json is a test input, ...')` pins a literal, and if someone REMOVES
`{workspaceRoot}/nx.json` from `test.inputs`, that removal is itself no longer hashed for
`test`, so Nx replays the guard's cached PASS until an unrelated `test` input changes. The
guard's own comment states this limitation honestly and the plan-check verified the
mechanism from `hash_project_config.rs`. Correctly scoped as a limitation rather than a
defect -- the window closes on the next unrelated source edit. No action; recorded so a
future reader does not rediscover it as a surprise.

---

## Tree state on exit

```
$ git rev-parse --abbrev-ref HEAD
gsd/quick-260726-gok-typecheck-inputs-consumer-docs
$ git rev-parse --short HEAD
5f54049
$ git status --porcelain
?? .planning/quick/260726-gok-resolve-typecheck-stale-cache-false-pass/
```

Every temporary mutation (`nx.json` x2, `pinned-deps.spec.ts` x2, `tsconfig.spec.json` x2,
four detached checkouts) restored. Nothing staged, nothing committed, nothing pushed. All
probe scripts live in the session scratchpad only; none was written into the repo or into
`node_modules`. This VERIFICATION.md is left uncommitted.
