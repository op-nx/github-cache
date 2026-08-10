---
phase: 7
phase_name: "Lint Toolchain and the Ambient-Platform-Read Ban"
project: "@op-nx/github-cache - GitHub-backed Nx Remote Cache"
generated: "2026-07-28"
counts:
  decisions: 6
  lessons: 7
  patterns: 6
  surprises: 6
missing_artifacts:
  - "07-UAT.md"
---

# Phase 7 Learnings: Lint Toolchain and the Ambient-Platform-Read Ban

## Decisions

### `@nx/eslint` inference plugin over an explicit project.json target

The `lint` target comes from `@nx/eslint/plugin` registered in `nx.json`, not from a
`command: 'eslint .'` target declared beside the existing `integration` target.

**Rationale:** Chosen by the maintainer at discuss time with the cost stated in full. The
alternative needed no inference plugin at all and would have removed an unverified cross-OS
inference, but `@nx/eslint` is the ecosystem norm and ROADMAP/REQUIREMENTS already cite inference
as the LINT-01 -> PARITY-01 ordering mechanism. The ordering constraint holds either way, since
any declared target mutates `hash_project_config`, so nothing in the roadmap shape depended on the
choice. The accepted cost is carried forward as D-35: Phase 7 records the inferred target's hashed
node values as the baseline Phase 8's CORR-03 compares against.
**Source:** 07-CONTEXT.md D-01, 07-DISCUSSION-LOG.md

### `lint` is project-scoped, and that narrows a stated success criterion

`eslint .` runs with `cwd = packages/github-cache`. The workspace root gets no lint target.

**Rationale:** `@nx/eslint`'s `getProjectUsingESLintConfig` returns `null` for the root because it
has neither `src/` nor `lib/`, and creating one would silently add a second lint target and rotate
every task hash mid-parity-investigation. The consequence was recorded rather than papered over:
`esbuild.action.mjs`, `start-cache-server/entry.ts` and `vitest.workspace.ts` are not linted, which
narrows LINT-01 SC1's literal "across the workspace" to "across the project that has specs".
**Source:** 07-CONTEXT.md D-07/D-08, 07-VERIFICATION.md

### Two core ESLint rules, not one

The ban is enforced by `no-restricted-imports` AND `no-restricted-syntax` together.

**Rationale:** Structural necessity, not preference. `no-restricted-syntax` is an AST-selector
matcher and cannot see a destructured named import, which is exactly the shape at
`cache-archive-path.spec.ts:1`. `no-restricted-imports` cannot ban a member of a namespace import.
Wiring one would have made the RED proof pass for one shape and silently miss the other. M1 and M2
later produced disjoint red sets, which is the measured form of this claim.
**Source:** 07-CONTEXT.md D-15, 07-EVIDENCE.md

### Bounded-cleanup rule for the recommended rule sets

Enable `@eslint/js` recommended plus `typescript-eslint` recommended (non-type-checked); measure
the baseline finding count BEFORE fixing anything; scope off any single broad rule with a recorded
reason rather than starting a codebase sweep.

**Rationale:** Keeps "adopt a linter" from becoming an open-ended cleanup while still adopting a
real baseline. Type-checked variants were rejected outright: no mandated rule is type-aware and
`projectService` would make `lint` sensitive to the whole TypeScript program plus tsconfigs,
widening the stale-cache blast radius. In the event the baseline closed to zero residual with zero
rules disabled and zero code edits.
**Source:** 07-CONTEXT.md D-11/D-12, 07-01-SUMMARY.md

### The RED proof is a permanent programmatic spec, not a red commit

LINT-03's evidence is a spec that drives ESLint's Node API via `lintText(code, { filePath })`,
not a deliberately-red intermediate commit and not a one-time observation.

**Rationale:** The repo's standard is bisect-safe atomic commits with the full battery green at
every commit, so a red intermediate was not available. `lintText` applies flat-config
`files`/`ignores` matching to the supplied path, so one mechanism proves the rule fires AND proves
the scoping in both directions. The rules and the four described disables therefore land in one
green commit.
**Source:** 07-CONTEXT.md D-20, 07-02-SUMMARY.md

### ME-01 amended two locked decisions rather than deferring the gap

D-16's glob text and D-19's invariants were rewritten so both globs derive from the real runner
configs: ESLint `files` == unit-runner include, ESLint `ignores` == unit-runner exclude, unit
exclude == integration include.

**Rationale:** The gap was latent (zero matching files existed), but measurement showed it was
repo-only with no consumer surface, so the cost of amending was purely procedural. The naive
"widen both globs symmetrically" fix was rejected because it opens a new hole: an
`integration.spec.tsx` is not collected by the integration runner but IS collected by the unit
runner, so a symmetric `ignores` would exempt a file that runs as a unit test.
**Source:** 07-REVIEW.md ME-01, 07-REVIEW-FIX.md, 07-CONTEXT.md D-16/D-19 amendment

---

## Lessons

### A cached Nx PASS hid a genuinely flaky test

`npm run test` reported `Cache: 1/1 hit (100%)` and exit 0. The same command with
`--skip-nx-cache` exited 1. The failure was real: `lint-scope-drift.spec.ts` timed out at 5000 ms
under CPU contention, reproducing 1 time in 3.

**Context:** This is the third appearance of the cache-masking-a-failure class in this repo, after
`governance-email.spec.ts` (T-06-03-02) and the `typecheck` inputs defect (quick 260726-gok). The
earlier two were stale INPUT SETS; this one was a genuine flake that the cache merely replayed. Nx's
own flaky-task detector fired, which is the symptom rather than the cause. Any test signal intended
to be trusted needs `--skip-nx-cache`.
**Source:** 07-02-SUMMARY.md, orchestrator post-merge gate

### Repeat-running until green does not prove a flake is fixed

The broken version produced three consecutive green runs before the flake was found, and three more
during the fix attempt. The fix was proven instead by pinning `--testTimeout=500` and then `50`,
where the pre-fix version already failed and the post-fix version passes.

**Context:** A controlled experiment that forces the failure deterministically beats a sample of
passing runs. The same reasoning applies to any intermittent defect: find the axis that makes it
deterministic rather than increasing N.
**Source:** 07-02-SUMMARY.md

### Verification against the guards' own claims cannot find a claim the guards never made

`07-VERIFICATION.md` returned `passed` at 22/22 must-haves, having re-derived the load-bearing
facts live rather than ratifying them. Code review then found 1 CRITICAL and 2 HIGH defects in the
same code.

**Context:** The verifier checked that each guard passes and that each recorded mutation fails as
recorded. Every review finding was a property no guard asserted: that a missing `lint` target exits
0, that a default import evades both rules, that a disable reason can satisfy `toContain('integration')`
via a filename substring. Verification and review are not redundant, and a `passed` verification is
not evidence that the must-haves are complete.
**Source:** 07-VERIFICATION.md, 07-REVIEW.md, 07-REVIEW-FIX.md

### `nx run-many -t <missing>` exits 0, so an inferred target is a silently deletable gate

Deleting the four-line `plugins[]` entry from `nx.json` left every guard green while the `lint`
gate stopped existing. `nx run-many` printed `NX No tasks were run` and returned 0.

**Context:** Load-bearing precisely because `@nx/eslint` returns `[]` silently when it finds no
config, and D-35 leaves cross-OS inference unverified. The correct discriminator is requiring the
run to PRINT `Successfully ran target lint`, not merely to exit 0. `NO_COLOR: '1'` is required on
that CI step because Nx bolds the target name mid-phrase.
**Source:** 07-REVIEW.md CR-01, 07-REVIEW-FIX.md `5e662a7`

### A ceiling comment that misstates its ceiling is worse than no comment

The shipped `// ponytail:` note claimed a namespace import is caught "regardless of the local
name". True for `import * as X`, false for `import X` -- and the default-import form evaded both
rules entirely.

**Context:** `importNames` maps a namespace specifier to `"*"` but a default specifier to
`"default"`, which was not in the lists. The comment would have actively steered a future reader
away from the hole it sat next to.
**Source:** 07-REVIEW.md HI-01, 07-REVIEW-FIX.md `5b9f5ca`

### A lexical guard can be satisfied by the wrong token

LINT-06 requires a disable reason to say why the assertion cannot move to `integration`. The guard
was `expect(reason).toContain('integration')`, which the substring inside
`public-server.integration.spec.ts` satisfies. Site 4's reason argued why the assertion SHOULD
move, and passed.

**Context:** The fix strips the filename token before the containment check. The residual is
recorded honestly: the control still enforces the WORD, not the ARGUMENT, and that half is not
automatable.
**Source:** 07-REVIEW.md HI-02, 07-SECURITY.md residual N-1

### The IDE's TypeScript diagnostics were wrong 17 times and right zero times

Across the phase the LSP feed flagged `comments`, `readFileSync`, three `eslint.config.mjs`
constants, `beforeAll` in two files, `statSync`, `extensionsOf` at six sites, and three more as
undefined or unused. Every one was genuinely used or genuinely absent from the current file.

**Context:** Several were stale snapshots of a mid-edit state; `extensionsOf` had been deleted by a
refactor and the feed still reported six references to it. `npm run typecheck` returned 0 at every
check. Confirms the standing rule that the compiler is authoritative and the diagnostics feed is
not.
**Source:** orchestrator verification at each wave boundary

---

## Patterns

### Prove a guard can fail before trusting it

Every guard added in this phase was mutation-tested: apply a mutation, observe the exact failure
set, revert, verify byte-identity. Nine mutations M1-M9 plus several ad-hoc ones.

**When to use:** Any time a spec's purpose is to prevent a class of defect rather than to test a
behaviour. A guard that cannot fail is worthless, and this repo has shipped one before.
**Source:** 07-VALIDATION.md, 07-EVIDENCE.md, 07-04-SUMMARY.md

### The vacuity mutation, distinct from the deletion mutation

Beyond "delete the thing and watch the assertion go red", run a mutation that makes the assertion's
INPUT empty. When `lint.inputs`' self pattern list resolved empty, both positive `toContain`
assertions still passed and only the outside-project-root negative control caught it.

**When to use:** Whenever a helper returns a collection that a filter narrows.
`filterUsingGlobPatterns` returns the WHOLE list when the pattern list is empty, so every
`toContain` passes together on a resolver that resolved nothing.
**Source:** 07-03-SUMMARY.md, 07-EVIDENCE.md

### Pair a negative assertion with a positive control at the same path

"The ban does not fire at an integration path" passes trivially if the config never loaded, the
path is misspelled, or the rules were never added. It is only meaningful paired with an assertion
that a DIFFERENT rule DOES fire at that same path.

**When to use:** Any assertion whose expected result is "nothing happened". The pairing is what
distinguishes "correctly exempt" from "never evaluated".
**Source:** 07-CONTEXT.md D-17, 07-VALIDATION.md, 07-02-SUMMARY.md

### Close a stale-cache hole in the same commit as the guard that depends on it

`{workspaceRoot}/eslint.config.mjs` entered `targetDefaults.test.inputs` in the same commit as the
first guard spec that reads it.

**When to use:** Whenever a spec asserts on a file outside its own project. Without the input
wiring the guard replays a cached PASS, and because the RED-before-GREEN activity IS the thing that
edits the file, the false pass surfaces during that activity and reads as "the rule does not fire".
**Source:** 07-CONTEXT.md D-25, 07-01-SUMMARY.md

### Derive a guard's expectations from the real config, but compare the part that matters

The drift guard reads both vitest configs off disk rather than restating their globs, but compares
the basename pattern (name family plus extension set as sorted sets) rather than the literal
string, because the path anchor legitimately differs between ESLint (`**/`) and vitest
(`{src,tests}/**/`).

**When to use:** Cross-tool invariants where the two sides express the same rule in different
coordinate systems. Comparing literals makes the guard permanently red; comparing nothing makes it
vacuous.
**Source:** 07-CONTEXT.md D-19 amendment, 07-REVIEW-FIX.md `a6af663`

### Behavioural coverage over text comparison for per-file-type rules

Glob-text comparison structurally cannot see a per-extension config interaction. The validation
audit added 25 literal path-shape rows because `*.spec.cjs` matches both the `**/*.cjs` override
and the ban block, and their composing rather than colliding is a property of array order.

**When to use:** Whenever config objects are order-sensitive and a rule's applicability varies by
file extension. Derive the row list literally, not from the config, or the guard agrees with
whatever the config says.
**Source:** 07-VALIDATION.md GAP-1

---

## Surprises

### Only four error positions exist for four violation sites

REQUIREMENTS.md and CONTEXT.md D-22 both describe `cache-archive-path.spec.ts` as having
violations at `:1` and `:26`. Measurement showed `:26` produces zero errors: in strict ESM the
`tmpdir` binding cannot exist without the import, and the import is already the error.

**Impact:** A disable placed above line 26 would have been an UNUSED directive, and
`reportUnusedDisableDirectives: 'error'` would have failed the build. The phase would have shipped
red through its own opt-out discipline. Caught by research before any code was written.
**Source:** 07-RESEARCH.md C2

### `eslint .` walks the filesystem while Nx hashes from git

`dist/` (60 files) and `out-tsc/` (36) are gitignored, so Nx never hashes them, but ESLint would
lint them.

**Impact:** `lint`'s result would depend on whether `build` had run, at an unchanged Nx hash -- a
stale-cache defect with no input change to detect it. Required a global `ignores` block. Recorded
nowhere in the project's prior artifacts; M7 later measured 66 linted files with the block and 159
without.
**Source:** 07-RESEARCH.md C3, 07-EVIDENCE.md M7

### The container lockfile regeneration changed a shipped consumer artifact

Regenerating `package-lock.json` in a linux/arm64 container re-resolved `undici` 6.27.0 -> 6.28.0
through `@actions/*`'s ranged transitive deps, drifting the committed action bundle by 88 lines.

**Impact:** The only consumer-facing change in an otherwise dev-tooling-only phase. Assessed twice:
the code reviewer found the new throw-on-invalid-header path unreached with safe inputs; the
security auditor found it stronger than that -- the bundled undici's `ProxyAgent` is dereferenced
once, inside `getAgentDispatcher()`, which has zero call sites in the bundle. Unreachable, not
merely un-hit.
**Source:** 07-01-SUMMARY.md, 07-REVIEW.md ME-05, 07-SECURITY.md

### The prescribed non-vacuity filter was itself vacuous under the setting it tested

RESEARCH G1(c) prescribed detecting an ESLint "file was ignored" result via
`severity === 1 && ruleId === null`. That also matches a LINT-06 unused-directive report at v9's
default `warn` severity.

**Impact:** The control misread a correctly-linted file as never-linted, and passed only because
`'error'` moves those reports to severity 2 -- meaning its correctness depended on the very setting
it existed to be independent of. Found during the RED phase and fixed with a position check.
**Source:** 07-01-SUMMARY.md

### A research-supplied false-positive control was itself a failing assertion

RESEARCH listed `path.join('a','b')` as a control that must NOT error. Valid for a standalone
esquery snippet, but under real ESLint `path` has to come from somewhere, and
`import * as path from 'node:path'` IS an error.

**Impact:** Using it verbatim would have turned a false-positive control into a failing assertion.
Replaced with a local object; the namespace form was reclassified as an evasion shape.
**Source:** 07-02-SUMMARY.md

### Registering the plugin rotates every task hash, and `test` twice

Adding a target changes `hash_project_config`, which is folded into every task hash; and
`{workspaceRoot}/nx.json` is already an explicit `test` input, so `test` rotates a second time.

**Impact:** Phase 7's first default-branch push is a legitimate all-MISS push. Recorded in advance
so Phase 9's OBS-04 tripwire is authored as "two consecutive all-miss pushes with NO
version-affecting change in between" -- there are three legitimate rotation windows in this
milestone, and a tripwire that fires on correct work gets disabled.
**Source:** 07-CONTEXT.md D-36, 07-03-SUMMARY.md, 07-EVIDENCE.md
