# Quick Task 260726-gok: Plan Check

**Checked:** 2026-07-26
**Mode:** `quick-full` (single plan -- no ROADMAP phase goal, no cross-plan dependency checks)
**Plan:** `.planning/quick/260726-gok-resolve-typecheck-stale-cache-false-pass/260726-gok-PLAN.md`
**Tree state at check:** branch `gsd/quick-260726-gok-typecheck-inputs-consumer-docs`, HEAD `e56e5d2`, clean
apart from the untracked quick-task directory.

## ISSUES FOUND

**0 BLOCKING, 5 ADVISORY. The plan is executable as written.** Every load-bearing claim I was asked to
challenge held up under independent measurement, including the one that most plausibly could have failed
(the self-referential typecheck hazard). The five advisory items are two wrong expected VALUES in `verify`
steps, one false sentence in a code comment, one over-promise in the same comment, and one uncovered
artifact. None changes the plan's shape or task ordering.

**One correction that runs the other way:** the plan's deviation from RESEARCH.md's recommended Nx
function pair is not a deviation from a better design -- RESEARCH.md item 7 is WRONG, and its recommended
pair would THROW at runtime on this repo's `typecheck.inputs`. See item 2. Record this so a future reader
does not "restore" the research's version.

### Method note

Findings marked MEASURED come from an executed probe or a real compile run against the installed
`nx@23.1.0` and the current `nx.json`, done in the session scratchpad
(`.../scratchpad/tscheck/`, junctioned to the repo's `node_modules` for full-fidelity exports-map
resolution) and deleted afterwards. Nothing in the repo was modified except this file.

---

## Standard dimensions

### Requirement coverage vs the task description

Description: "Resolve typecheck stale-cache false-pass and the consumer-doc defects in a single PR."

| Requirement | Where | Verdict |
| --- | --- | --- |
| typecheck stale-cache false-pass | Task 1 (`nx.json` + new guard spec) | COVERED |
| Consumer-doc defect 1: `openssl` token mint | Task 2 (5 sites) | COVERED |
| Consumer-doc defect 2: no readiness poll | Task 3a, 3e | COVERED |
| Consumer-doc defect 3: no `timeout-minutes` guidance | Task 3b, 3d | COVERED |
| Two dead-citation claims "verify or drop" | U1 kept (corroborated); A5 annotated in Task 4b | COVERED |
| Single PR | one branch, four atomic commits | COVERED |
| STATE.md Deferred Items rows closed | nowhere | GAP -- see ADVISORY 4 |

### Task completeness

All four tasks carry `files`, `action`, `verify`, `done`, plus a drafted commit message and an explicit
scratchpad path for `git commit -F` (correct: `git commit -m` fails on this ReFS Dev Drive). The shared
per-task gate (8 commands, required green BEFORE each commit) is stated once and applies to all four.
No task is missing a section.

### Key links real

| Link | Verdict |
| --- | --- |
| `260726-gok-RESEARCH.md` | EXISTS |
| `260726-gok-CONTEXT.md` | EXISTS |
| `.planning/STATE.md` "CI hygiene" row at line 197 | MEASURED CORRECT -- line 197 is the CI-hygiene row, line 196 is the consumer-doc `Docs` row ("alongside it", as the plan says) |
| `.github/workflows/ci.yml:179-227` | ACCURATE -- `:179-182` is the node-not-openssl WHY comment, `:183` the one-liner, `:193` the poll step's `- name:`. The poll's closing `fi` sits a few lines past `:227`; harmless for a pointer, not an assertion. |

### Scope sanity for a quick task

Reasonable. Eight files, one config token swap, one config array entry, one new spec, four doc/YAML edits,
one planning-artifact annotation. The four-commit split is justified (CI-config half bisectable from the
docs half) and the "Out of scope" / "Deliberately not doing" sections are explicit and well drawn --
including naming the `DOCS_WITH_ENV_WRITE` widening as a deliberate one-line follow-up rather than
silently absorbing it.

### `must_haves` traceable to the description

11 truths, 7 artifacts, 4 key links. Every truth traces to either the task description or a LOCKED
CONTEXT decision (A1-A8, U1). No truth is invented, and none contradicts CONTEXT.

### Context compliance with the locked decisions

| Decision | Plan's handling | Verdict |
| --- | --- | --- |
| A1 (spec fileset becomes an input, do NOT stop typechecking specs) | Task 1b: `production` -> `default`; explicitly forbids dropping spec typechecking | COMPLIANT |
| A2 (`openssl` -> `node`) | Task 2, all 5 sites | COMPLIANT |
| A3 (reuse the repo's own proven poll, with its reasoning) | Task 3a ports shape AND reasoning from `ci.yml:193-227` | COMPLIANT |
| A4 (`timeout-minutes` = generic hang insurance; no continue-on-error) | Task 3b keeps the two hangs distinct and explicitly forbids `continue-on-error` / `if:` gates | COMPLIANT |
| A5 (annotate, never propagate -- premise INVERTED by research) | Task 4b says CORROBORATED with URL; count limit stays out of consumer docs | COMPLIANT (see item 7) |
| A6 (doc-guard discipline) | Task 2/3 verify steps; research VERIFIED all doc copy sites are already `test` inputs | COMPLIANT |
| A7 (`ci.yml:128-132` is now FALSE -- correct it) | Task 4a, measurements preserved verbatim | COMPLIANT |
| A8 (`ci.yml:523` is in scope) | Task 2, with the reasoning in the commit message | COMPLIANT |
| U1 (RESOLVED -- keep the claim as-is) | Task 4 "Do not touch"; Out of scope; no probe | COMPLIANT (see item 7) |

---

## The seven specific verdicts

### 1. THE SELF-REFERENTIAL HAZARD -- claim VERIFIED. No blocking issue.

The plan's probe-compiled claim (lines ~148-151) is **TRUE**. I compiled the plan's exact guard body
independently.

**Compile result: 0 errors, twice.**

- `tsc --noEmit` under a faithful mirror of this repo's spec tsconfig -- `module: nodenext`,
  `moduleResolution: nodenext`, `customConditions: ["@op-nx/source"]`, `strict`, `isolatedModules`,
  `noUnusedLocals`, `esModuleInterop: false`, `types: ["vitest/globals","vitest/importMeta","vite/client","node","vitest"]`
  -> **0 errors**.
- The real `typecheck` target is `tsc --build tsconfig.json --emitDeclarationOnly`, so I also ran the
  declaration-emit path (`composite` + `declaration` + `declarationMap` + `emitDeclarationOnly` +
  `noEmitOnError`) -> **0 errors**, emitted `nx-target-inputs.spec.d.ts` cleanly. The file exports
  nothing, so there is no TS4023-class declaration-portability exposure.

**The `TargetInputs` derivation DOES satisfy all three signatures.** MEASURED against the installed
`.d.ts` files:

- `NonNullable<NxJsonConfiguration['namedInputs']>[string]` resolves to `(string | InputDefinition)[]`
  (`nx/dist/src/config/nx-json.d.ts:779-780`).
- `splitInputsIntoSelfAndDependencies(inputs: ReadonlyArray<InputDefinition | string>, namedInputs: { [inputName: string]: ReadonlyArray<InputDefinition | string> })`
  (`task-hasher.d.ts:134-135`) -- the array is assignable (mutable -> readonly), and
  `Record<string, TargetInputs>` is assignable to the index-signature parameter (index signatures are
  covariant in TS).
- `extractPatternsFromFileSets(inputs: readonly ExpandedInput[])` (`:117`) -- receives
  `selfInputs: ExpandedSelfInput[]`, and `ExpandedInput = ExpandedSelfInput | ExpandedDepsOutput`, so
  assignable.
- `filterUsingGlobPatterns(root: string, files: FileData[], patterns: string[])` (`:160`) --
  `{ file, hash: 'probe' }` satisfies `FileData` with no excess property, returns `FileData[]` so
  `.map((entry) => entry.file)` is `string[]`, matching the declared `string[]` return.

**The plan's sidestep of `InputDefinition` is not merely tidier -- it is REQUIRED.** Confirmed
independently: `nx/dist/src/config/nx-json.d.ts:7` imports `InputDefinition` type-only from
`./workspace-json-project-json` and never re-exports it, which is exactly the leftover probe's `TS2459`.
`NxJsonConfiguration` IS exported from that module. The structural derivation needs no importable name,
so the `TS2345` argument mismatch does not recur either.

**Module resolution holds under `nodenext` + `customConditions`.** MEASURED: nx's exports map has BOTH
`"./src/*.js"` and `"./src/*"` entries with `{ "@nx/nx-source": "./src/*.ts", "types": "./dist/src/*.d.ts", "default": "./dist/src/*.js" }`.
So `nx/src/hasher/task-hasher.js` -> `dist/src/hasher/task-hasher.d.ts` for types and `.js` at runtime.
This repo's `customConditions` is `["@op-nx/source"]`, NOT `@nx/nx-source`, so the raw-TS-source branch
never engages -- worth noting because that branch would have pulled nx's uncompiled sources into the
build.

**Runtime also verified**, not just types: executing the same call chain from a `type: module` package
under Node ESM resolves the bare-specifier named imports from nx's CJS module and runs without throwing.
All three are plain `exports.X = X;` assignments (`task-hasher.js:6,8,13`), which `cjs-module-lexer`
detects, so the named ESM import interop is sound.

**Two collateral checks the plan depends on, both confirmed:**

- The file is picked up: `vitest.config.mts` `include` is
  `['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}']` and `tsconfig.spec.json` includes
  `src/**/*.spec.ts`. `src/nx-target-inputs.spec.ts` matches both.
- The `fallow:ci` contingency names the right thing: `fallow:ci` is `fallow dead-code --fail-on-issues`,
  `.fallowrc.jsonc` does have an `ignoreDependencies` array (currently `@nx/vitest`, `@swc-node/register`,
  `@swc/helpers`, `tslib`), and `nx` is a root devDependency at `23.1.0`. A finding is unlikely and the
  named remedy is correct if one fires.

**`pack:check` is a non-issue** (checked because Task 1 adds a source file): `pack-check.cjs` asserts
REQUIRED / FORBIDDEN path predicates, not an exact file list, and `packages/github-cache/package.json`
`files` is `["dist", ...]` while the spec project's `outDir` is `./out-tsc/vitest`. A new spec cannot
reach the tarball. Structurally identical to the eight specs already present.

### 2. The three named functions -- ALL exported, trio CORRECT, and better than RESEARCH.md's pair

**All three are exported at both levels.** MEASURED: types at `task-hasher.d.ts:117`
(`extractPatternsFromFileSets`), `:134` (`splitInputsIntoSelfAndDependencies`), `:160`
(`filterUsingGlobPatterns`); runtime at `task-hasher.js:6`, `:8`, `:13`.

**The trio is correct for the stated purpose, and it is the same composition Nx's own hasher uses.**
`task-hasher.js:130-131` (`getTargetInputs`) does literally
`splitInputsIntoSelfAndDependencies(...)` then `extractPatternsFromFileSets(inputs.selfInputs)`.
Critically, `splitInputsIntoSelfAndDependencies` ends with
`const expandedInputs = expandSingleProjectInputs(selfInputs, namedInputs)` and returns
`expandedInputs.filter(isSelfInput)` -- so named inputs ARE recursively expanded to `{ fileset }` objects
and `dependentTasksOutputFiles` is routed out to `depsOutputs`. Nothing is left unexpanded.

**RESEARCH.md item 7's recommended pair is WRONG, and the plan is right to have changed it.** MEASURED:
```
expandSingleProjectInputs(nxJson.targetDefaults.typecheck.inputs, nxJson.namedInputs)
-> Error: namedInputs definitions can only refer to other namedInputs definitions within the same project.
```
Cause: `expandSingleProjectInputs` throws on `if (d.projects || d.dependencies)`, and
`typecheck.inputs` contains `{ "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}", "dependencies": true }`
(`nx.json:123-126`). Only `splitInputsIntoSelfAndDependencies` routes that entry to `depsFilesets`
BEFORE expansion. So the plan's third function is load-bearing, not decoration. The research's probe
table only ever fed bare `["production"]`, which is why it never hit this.

**Token resolution -- `{projectRoot}` yes, `{workspaceRoot}` NO.** MEASURED resolved patterns for the
current `production`-based inputs:
```
["{projectRoot}/**/*", "{workspaceRoot}/tsconfig.base.json",
 "!{projectRoot}/**/?(*.)+(spec|test).[jt]s?(x)?(.snap)", "!{projectRoot}/tsconfig.spec.json"]
```
`filterUsingGlobPatterns` does `f.replace('{projectRoot}', root)` only. `{workspaceRoot}` stays literal
and matches nothing. Harmless for the plan's three `{projectRoot}`-relative probe files, but see
ADVISORY 3 -- the guard's comment over-promises on this.

**Not vacuous today** -- the filter genuinely filters (1 file kept vs 3, see item 3). But the plan's
stated REASON for its control test is false; see ADVISORY 2.

### 3. The claimed 3-failure RED -- EXACT. Arithmetic confirmed.

MEASURED against the current `nx.json` by executing the guard's own resolver chain:

| assertion | resolved fileset today | outcome | plan's claim |
| --- | --- | --- | --- |
| hashes the spec sources | `["packages/github-cache/src/index.ts"]` | FAIL | FAIL -- correct |
| hashes tsconfig.spec.json | same | FAIL | FAIL -- correct |
| still hashes the lib sources | same | pass | pass (control) -- correct |
| nx.json is a test input | `test.inputs.includes('{workspaceRoot}/nx.json') === false` | FAIL | FAIL -- correct |

**Exactly 3 failing, 1 passing.** The previous task's overshoot cannot recur: the guard has four plain
`it()` blocks and zero `it.each`, so vitest's case count equals the assertion-site count. No hidden
parametrization.

The GREEN side also checks out: swapping `inputs[0]` to `default` yields patterns
`["{projectRoot}/**/*", "{workspaceRoot}/tsconfig.base.json"]` and keeps all three probe files, so
`typecheck` resolves to `src/index.ts` + `src/index.spec.ts` + `tsconfig.spec.json` exactly as step 1c
claims.

Two mechanics worth confirming, both sound: adding a NEW spec file at step 1a busts the `test` hash via
`{projectRoot}/**/*`, so the RED is a real run and not a replay; and step 1c's addition of
`{workspaceRoot}/nx.json` changes the `test` file list itself, so the GREEN re-run is also fresh.

### 4. The mandatory precondition IS in the same commit, and the caveat is honest

**Not split.** Task 1's `files` lists `nx.json` once; steps 1b (`production` -> `default`) and 1c
(`{workspaceRoot}/nx.json` -> `test.inputs`) both edit it; `done` requires both; the commit message
argues for the wiring as load-bearing rather than tidy; and the `verify` step requires
`git diff --stat` to show exactly `nx.json` plus the new spec. There is no path by which the guard lands
without its precondition.

**The caveat at plan lines 245-249 is ACCURATE, not hand-waving.** Research VERIFIED from
`hash_project_config.rs` that a target's `inputs` array and nx.json's root `namedInputs` are not in the
ProjectConfiguration hash node. So if someone later REMOVES `{workspaceRoot}/nx.json` from `test.inputs`,
that removal edit is itself no longer hashed for `test`, and the guard replays its cached PASS until an
unrelated `test` input changes. That is precisely what the plan states, including that the next unrelated
source edit closes the window. Correctly scoped as a limitation rather than a defect.

Confirmed independently: the current 15-entry `test.inputs` list (`nx.json:44-69`) contains nothing that
already covers `nx.json`. And `ci.yml` is NOT a `test` input either (only `cleanup.yml` is), so Task 4's
own framing -- "this task's battery is a regression check, not a content check" -- is accurate. Also
confirmed: `.planning/` is in `.prettierignore`, so Task 4b's markdown annotation cannot be reflowed by
`format:check`.

### 5. Guard-hazard coverage -- every cited line number is REAL; one expected VALUE is wrong

| Citation | Measured | Verdict |
| --- | --- | --- |
| `docs-adoption.spec.ts:87-113` (`::add-mask::`) | `:87` is the describe, `:113` closes the `it.each`; `DOCS_WITH_ENV_WRITE` at `:95-99` (as the plan's follow-up note says) | CORRECT |
| `docs-adoption.spec.ts:143-154` (LIFECYCLE_TOKENS) | `:143` describe, `:154` close; `LIFECYCLE_TOKENS = ['start-cache-server','background:','cancel:']` at `:41` | CORRECT |
| `docs-adoption.spec.ts:156-166` (distinctness) | `:160` `not.toContain('operation:')`, `:164` `not.toMatch(/matrix:/)` | CORRECT |
| `public-surface.spec.ts:150-155` (action inputs) | `:150-155` is the assertion; `EXPECTED_ACTION_INPUTS = ['port']` at `:53` | CORRECT |
| `ci.yml:144-146` ("the integration matrix's windows-11-arm leg") | exact | CORRECT |
| `start-cache-server/action.yml`: openssl at `:15`, `uses:` recipe at `:18-22`, `npx nx affected` at `:23`, `inputs:` at `:38` | all exact | CORRECT |

Each hazard is addressed in a `verify` step:

- add-mask: Task 2 grep + Task 3's `npm run test` (which runs `docs-adoption.spec.ts`).
- `operation:` / `matrix:`: Task 3 verify greps `minimal-ci.yml` for both; the plan ALSO encodes the
  rephrase requirement in prose ("Guard hazard, encoded") and its own drafted comment text carries
  neither token. I read the drafted 3a/3b/3c/3d text: clean.
- LIFECYCLE_TOKENS: Task 3 verify names all three tokens explicitly.
- action input key set: Task 2 verify plus Task 3e's "Add NO input ... Keep every edit ABOVE `inputs:`".

Two additional guard checks I ran that the plan did not need to state: no spec asserts markdown link
validity (so 3e's `../README.md#quickstart-5-minutes` is unguarded either way -- and the anchor is
correct, `README.md:13` is `## Quickstart (5 minutes)`); and neither README nor `docs/` currently contains
`shell:` or `30s`, so 3c's prose and Task 3's `30s` grep both start from a clean slate.

**ADVISORY 1 -- Task 2's add-mask count expectation is wrong.** Plan line ~394:
> `git grep -c "::add-mask::" -- README.md docs/advanced.md docs/examples/minimal-ci.yml` returns 1 for each

MEASURED on the current tree: `README.md:2`, `docs/advanced.md:1`, `docs/examples/minimal-ci.yml:1`.
README has a prose mention at `:37` ("from the moment the `::add-mask::` command is processed") in
addition to the command at `:40`. As written, the executor will read a perfectly healthy state as a
regression.
**Minimal fix:** change the expectation to `README.md:2, docs/advanced.md:1, docs/examples/minimal-ci.yml:1`
-- or, more robustly, restate it as "unchanged from `origin/main`".

### 6. Copy-site completeness -- all 5 covered, the adaptation is flagged, no "30s" restatement

**All 5 sites, at the exact lines the plan names.** MEASURED
`git grep -n "openssl" -- ':!.planning'`:

```
.github/workflows/ci.yml:179   (prose -- leave alone)
.github/workflows/ci.yml:352   (prose -- leave alone)
.github/workflows/ci.yml:523   token="$(openssl rand -hex 32)"
README.md:39                   token="$(openssl rand -hex 32)"
docs/advanced.md:98            export NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN="$(openssl rand -hex 32)"
docs/examples/minimal-ci.yml:35 token="$(openssl rand -hex 32)"
start-cache-server/action.yml:15 #       token="$(openssl rand -hex 32)"     # mask BEFORE writing $GITHUB_ENV
```

The plan's per-site table covers all five invocation sites, explicitly preserves `:179` and `:352`, and
its verify expectation ("returns exactly the two ci.yml PROSE mentions and no `openssl rand` invocation")
is exactly right.

**`docs/advanced.md:98` is handled as an adaptation, not a pattern replace.** The plan's table marks it
**"adapt, do not blind-replace": keep the `export VAR="$(...)"` shape, swap only the command
substitution's body.** Confirmed the line really is the `export` shape, and that `:101` already carries
its `::add-mask::`.

The replacement one-liner is quoted verbatim from `ci.yml:183` (confirmed byte-for-byte), and the WHY
comment it adapts is `ci.yml:179-182` (confirmed).

**No "30s bound" restatement.** The plan's poll comment says "the loop's worst case is 30 x (10 + 1),
about 5.5 minutes -- not 30 seconds"; `must_haves` truth 9 forbids the 30s claim; and Task 3 verify greps
`"30s"` across all three docs. The verify grep does not collide with the plan's own literal "30 seconds"
negation. rk4 finding N3b's correction is preserved, not re-broken.

Non-issue worth stating so it is not mistaken for one later: `start-cache-server/action.yml:15` will grow
past 100 characters once the node payload lands, and the plan's contingency (drop the trailing inline note
to its own comment line) is a style call only -- prettier does not reformat YAML comment content, so
`format:check` will not fail either way.

### 7. Locked-decision compliance -- direction CORRECT on every count

**U1 stays EXACTLY as written.** The plan says: "**Do not touch** `docs/advanced.md:127-132` or
`start-cache-server/action.yml:29`. U1 is RESOLVED: the composite-`background:` claim is corroborated and
ships as written. No soften, no probe, no drop." Reinforced in `must_haves` truth 5, in "Out of scope"
(twice), and in "Deliberately not doing" (no live probe -- "the claim is settled from two primary
sources"). I confirmed those two locations are exactly the composite claim:
`docs/advanced.md:127` is the bullet "**A composite action cannot declare `background:` internally.**"
running to `:132`, and `start-cache-server/action.yml:29` is
"`# cannot declare background: internally (Pitfall 5).`" The verify step cross-checks
`git grep -c "composite"` against `origin/main` plus a `git diff origin/main -- docs/advanced.md` read.
No softening, no probing, no dropping anywhere in the plan. COMPLIANT.

**A5's annotation gets the direction RIGHT.** Task 4b's text says the two flagged claims "are both
CORROBORATED", carries the URL
`https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax`, cites the second
independent source (`content/actions/reference/workflows-and-actions/workflow-syntax.md:918-919`), gives
the provenance (docs PR #61978, 2026-06-30, three weeks before the 2026-07-20 fetch), and frames the rk4
flag as a FETCH failure rather than a factual finding. It never says "not reproducible". `must_haves`
truth 6 pins the direction independently. I confirmed `06-RESEARCH.md:508` is exactly the
`- **docs.github.com** -- Workflow syntax ...` citation bullet, and that the plan's instruction to keep
that bullet byte-identical including its pre-existing em dash is correct (the line does contain one).
COMPLIANT.

**The 10-concurrent-background-step limit does NOT reach any consumer doc.** It appears only inside the
`.planning` annotation, where the annotation itself states it is "deliberately NOT propagated". It is in
"Out of scope". Task 4's verify greps `git grep -n "10 background steps" -- ':!.planning'` for nothing.
The Task 4a `ci.yml` replacement lists the keyword family (`background:/wait:/wait-all:/cancel:/parallel:`)
with no count. COMPLIANT.

Task 4a's target is real and its surroundings are correctly identified: `ci.yml:128-132` is the false
doc-lag clause, `:133-143` the three measured bullets (runs 30172888579 / 30172032003 / 30171349564), and
`:144-146` the `shell: bash` note -- all exactly as the plan says, and the plan preserves `:133-146`
untouched.

---

## Issues, classified

### ADVISORY 1 -- Task 2's `::add-mask::` count expectation is wrong

**Where:** plan verify step, Task 2 (line ~394).
**Problem:** expects "1 for each"; the measured truth is README.md **2**, advanced.md 1, minimal-ci.yml 1.
The README prose mention at `:37` is a legitimate second hit.
**Impact:** the executor reads a healthy state as a failure and may "fix" the prose sentence.
**Minimal fix:** state the real counts (`2 / 1 / 1`), or reword to "unchanged from `origin/main`".

### ADVISORY 2 -- the non-vacuity control's stated rationale is FALSE

**Where:** the guard's comment at plan lines ~237-238: "proves the resolver is really filtering rather
than returning the whole probe list because a pattern list came back empty."
**Problem:** it proves no such thing. `filterUsingGlobPatterns` contains
`if (positive.length === 0 && negative.length === 0) { return files; }` -- an empty pattern list returns
the WHOLE probe list. The control asserts membership in that whole list, so it passes in exactly the case
it claims to exclude. All three `typecheck` assertions would pass vacuously together.
**Why only advisory:** the regression the guard actually exists to catch -- someone reverting
`default` -> `production`, or adding a spec-excluding negation -- reintroduces NEGATIVE patterns, which
the guard does catch (MEASURED). The empty-pattern case is not a plausible path.
**Minimal fix (one line, no new helper):** add a discriminating negative assertion against a target whose
fileset genuinely excludes specs --
`expect(hashedFilesFor('build')).not.toContain(`${PROJECT_ROOT}/src/index.spec.ts`)`. MEASURED: `build`
keeps only `src/index.ts`, so this is true today and false the moment the resolver stops filtering.
Alternatively just delete the false sentence from the comment and keep the control as the weaker check it
is -- but do not ship the claim as written.

### ADVISORY 3 -- the guard comment over-promises on `{workspaceRoot}`

**Where:** the guard's comment, "It delegates every glob decision to Nx's own resolver".
**Problem:** `filterUsingGlobPatterns` substitutes `{projectRoot}` only. A `{workspaceRoot}`-prefixed
pattern survives literally and matches nothing (MEASURED: `{workspaceRoot}/tsconfig.base.json` is present
in the resolved pattern list and matches no probe file).
**Impact:** none today -- all three probe paths are `{projectRoot}`-relative. The risk is a future
maintainer adding a `{workspaceRoot}`-shaped probe path and getting a silent, permanent non-match.
**Minimal fix:** add half a sentence -- "`filterUsingGlobPatterns` substitutes `{projectRoot}` only, so
probe paths must be project-relative; a `{workspaceRoot}` pattern never matches here."

### ADVISORY 4 -- STATE.md's two Deferred Items rows are not closed by any task

**Where:** `must_haves.key_links` cites `.planning/STATE.md`'s two Deferred Items rows "this task closes"
(MEASURED: `CI hygiene` at line 197, `Docs` at line 196), but no task's `files`, `action`, `done` or
`artifacts` touches STATE.md.
**Impact:** after the PR, both rows still read "open follow-up" while the underlying defects are fixed --
exactly the kind of stale planning artifact this task's own Task 4 exists to correct elsewhere.
**Why only advisory:** in GSD quick tasks the orchestrator normally owns STATE.md updates outside the
plan's task list. Flagging so it is a deliberate hand-off rather than an omission.
**Minimal fix:** either add the STATE.md row updates to Task 4 (they are `.planning`-only, prettier-
ignored, and not a `test` input, so they carry no battery risk), or state explicitly in the plan that the
orchestrator closes them post-execution.

### ADVISORY 5 -- one Task 4 verify check is vacuous today

**Where:** Task 4 verify: `git grep -n "not reproducible" -- .../06-RESEARCH.md` returns nothing.
**Problem:** MEASURED -- neither "not reproducible" nor "unreproducible" appears in that file today, so
the check passes before any edit and proves nothing about the flip having happened.
**Why only advisory:** as a "did you write the wrong thing" tripwire it still does its job, which is
plausibly the intent. The substantive positive check is that the annotation contains "CORROBORATED" plus
the URL.
**Minimal fix:** add the positive counterpart --
`git grep -n "CORROBORATED" -- .../06-RESEARCH.md` returns the new annotation line, and
`git grep -c "docs.github.com/en/actions/reference" -- .../06-RESEARCH.md` increases by one.

---

## Correction to the upstream research (not a plan defect -- record it)

**RESEARCH.md item 7 / the Q3 code sketch (lines ~210-218) is WRONG.** It recommends
`expandSingleProjectInputs` + `filterUsingGlobPatterns`. MEASURED: calling
`expandSingleProjectInputs` directly on `nxJson.targetDefaults.typecheck.inputs` THROWS
(`namedInputs definitions can only refer to other namedInputs definitions within the same project.`),
because `expandSingleProjectInputs` rejects any entry with `dependencies` or `projects` and
`typecheck.inputs` carries `{ "fileset": "{projectRoot}/**/*.{d.ts,d.cts,d.mts}", "dependencies": true }`.
The plan's `splitInputsIntoSelfAndDependencies` + `extractPatternsFromFileSets` +
`filterUsingGlobPatterns` trio is the only correct composition for this inputs array, and it mirrors
`getTargetInputs` (`task-hasher.js:130-131`) exactly. Do not "restore" the research's version during
execution or review.

---

## Verdict

Proceed with execution. Fix ADVISORY 1 and ADVISORY 2 before or during Task 1/Task 2 -- both are one-line
edits inside the plan, and ADVISORY 2's fix touches the guard the plan is about to write, so it is
cheapest now. ADVISORY 3 is a comment clarification. ADVISORY 4 and 5 can be handled at PR time.
