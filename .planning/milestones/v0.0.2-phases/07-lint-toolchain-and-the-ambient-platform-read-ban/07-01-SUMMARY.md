---
phase: 07
plan: 01
subsystem: lint-toolchain
tags: [eslint, flat-config, nx-inputs, stale-cache, supply-chain, tdd]
status: complete
requires:
  - the eight-command pre-commit battery
  - packages/github-cache/src/pinned-deps.spec.ts (ROBUST-03 name-list guard)
  - packages/github-cache/src/nx-target-inputs.spec.ts (Nx resolver-trio inputs guard)
provides:
  - eslint.config.mjs (root flat config; plan 07-02 adds the ban rules to it)
  - packages/github-cache/src/lint-rules.spec.ts (ESLint Node-API harness; 07-02 extends it)
  - WORKSPACE_ROOT module const in lint-rules.spec.ts
  - the five exact-pinned ESLint devDependencies (07-03 registers @nx/eslint as a plugin)
  - nx.json targetDefaults.test.inputs carrying {workspaceRoot}/eslint.config.mjs
  - 07-EVIDENCE.md (appended to by 07-02, 07-03, 07-04)
affects:
  - package.json
  - package-lock.json
  - nx.json
  - .fallowrc.jsonc
  - start-cache-server/index.js
tech-stack:
  added:
    - eslint@9.39.5
    - "@eslint/js@9.39.5"
    - typescript-eslint@8.65.0
    - "@eslint-community/eslint-plugin-eslint-comments@4.7.2"
    - "@nx/eslint@23.1.0"
  patterns:
    - ESLint 9 flat config, single root file, no helper module (D-10)
    - non-type-checked typescript-eslint recommended (D-11)
    - standalone global `ignores` object distinct from D-17 per-object ignores
    - ESLint Node-API (`lintText`) as a permanent guard rather than a one-time observation
key-files:
  created:
    - eslint.config.mjs
    - packages/github-cache/src/lint-rules.spec.ts
    - .planning/phases/07-lint-toolchain-and-the-ambient-platform-read-ban/07-EVIDENCE.md
  modified:
    - package.json
    - package-lock.json
    - nx.json
    - .fallowrc.jsonc
    - packages/github-cache/src/pinned-deps.spec.ts
    - packages/github-cache/src/nx-target-inputs.spec.ts
    - start-cache-server/index.js
decisions:
  - "D-12 call: ZERO rules turned off repo-wide, ZERO code edits, TWO configuration blocks. Baseline 10 findings -> residual 0."
  - "Q2 resolved: fallow auto-credits eslint.config.mjs and its three imports; the contingency `entry` line was NOT needed."
  - "Q10 contingency FIRED: undici 6.27.0 -> 6.28.0 drifted the action bundle; rebuilt and staged in the same commit per SC9."
  - "The shared non-vacuity control needed a position check, not just severity+ruleId; the RED observation is what exposed it."
  - "comments.recommended is spread (the ./configs subpath D-29 names), bringing five aligned opt-out-hygiene rules at zero measured cost."
metrics:
  duration: ~40 min
  tasks: 3
  files: 10
  tests: 438 -> 453
  completed: 2026-07-27
---

# Phase 7 Plan 01: Lint Toolchain Adoption Summary

ESLint 9 flat config adopted with five exact-pinned devDependencies, the opt-out discipline
proven live through the ESLint Node API, and the D-25 `test.inputs` hole closed in the same
commit -- with no `lint` target yet, because the mechanism forbids one before the config
exists.

## What Shipped

**Five exact-pinned devDependencies** in the ROOT manifest, each name-guarded by its own
`it()` block in `pinned-deps.spec.ts` (never an `it.each`, because D-04 turns on the guard
being a hard-coded NAME list -- the workspace deliberately carries ranges for `typescript`,
`vitest`, `prettier` and `@types/node`). The lockfile was regenerated in a linux/arm64
`node:24` container per D-05, and the Linux-only WASM-fallback subtrees a Windows install
would have pruned are verified present.

**`eslint.config.mjs`** at the workspace root: a standalone global `ignores` object, the two
recommended sets (non-type-checked), the CommonJS override ordered after the
`typescript-eslint` spread, the comments plugin, and the LINT-05/LINT-06 opt-out rules. Three
facts are comment-locked in the header -- the workspace-root glob frame, D-08's
never-create-a-root-`src`-or-`lib` rule (which has no vehicle at its stated home, because
`nx.json` is strict JSON), and D-07's recorded scope deviation.

**`lint-rules.spec.ts`**: nine assertions running real ESLint against the real root config via
`lintText`, all routed through a shared non-vacuity control, plus a self-test proving that
control can itself fail.

**The D-25 wiring**: `{workspaceRoot}/eslint.config.mjs` plus the four ESLint
`externalDependencies` in `test.inputs`, with the guard assertion in the same commit.

## Task Commits

All three tasks land as ONE commit, per the plan's declared commit boundary. This is forced,
not stylistic: `fallow dead-code --fail-on-issues` is a battery command, and five new
devDependencies with zero importers is an unused-dependency finding. `@eslint/js`,
`typescript-eslint` and the comments plugin are credited only by `eslint.config.mjs` (task 2);
`eslint` itself is credited only by `import { ESLint } from 'eslint'` in the guard spec (task
3). A commit after task 1 or task 2 alone would have been RED.

## Key Results

**The D-12 baseline reproduced RESEARCH G4's analytic prediction exactly** -- 64 files linted,
10 findings, file-for-file and line-for-line, with the low-confidence regex class producing
zero. Post-remediation residual is zero. The call: **zero rules turned off repo-wide, zero
code edits, two configuration blocks.** One scoped rule-off exists and is recorded honestly
rather than claimed away -- `@typescript-eslint/no-require-imports: 'off'` limited to
`**/*.cjs`, which D-13 mandates for `pack-check.cjs`. `no-undef` was deliberately kept LIVE
for that glob via a four-name inline globals map, so the one file in the repo where the rule
still applies keeps its typo check.

**The G3 finding is closed and the closure is proven.** The linted-file count is invariant
across `rm -rf dist out-tsc` (64 / 64). M7 shows that control can fail: without the global
`ignores` block the count is **155**, so 91 generated files would be linted at an Nx hash that
never moves.

**Q10's contingency fired.** The container lockfile regeneration re-resolved `undici`
6.27.0 -> 6.28.0 through `@actions/*`'s ranged dependencies, drifting the committed action
bundle by 88 lines. Rebuilt and staged in this same commit per SC9 -- never as a follow-up,
which would leave the `action-bundle-drift` gate failing on this commit and every later one.

**Q2 resolved favourably.** `fallow:ci` is green with the new config file and its three
imports, so fallow does auto-credit `eslint.config.mjs` (F20's binary-strings inference was
right). No speculative `.fallowrc.jsonc` entry was added; the only fallow change is the
`@nx/eslint` `ignoreDependencies` line, which was the one certain case.

## TDD

The RED was produced deliberately by stripping the opt-out rules object from the config:
**2 failed, 7 passed of 9**, restored to 9/9. The two failures were exactly the assertions
depending on rules only that object provides. Critically, **the CORR-06 controls passed on
both sides** -- had they failed too, the RED would have meant the config was not loading at
all (the `unconfigured` trap) rather than that a rule was missing.

Recorded honestly: three `ban-ts-comment` assertions also passed in RED, because
`typescript-eslint`'s recommended set already enables that rule and its plugin defaults
coincide with D-30's configuration. Those three do not discriminate D-30's explicit block.
The block still earns its four lines -- it pins the behaviour against a future default change,
and the `@ts-ignore`-described-form assertion would fail if `'ts-ignore': true` were weakened
-- but the stronger claim is not made.

Mutations M5 and M7 applied, observed, and reverted before the commit.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The shared non-vacuity control was itself vacuous**

- **Found during:** Task 3, by the RED observation
- **Issue:** The control filtered on `severity === 1 && ruleId === null`, taken straight from
  RESEARCH G1(c). Under RED that also matches the LINT-06 unused-directive report, because
  with `reportUnusedDisableDirectives` back at v9's default `warn` such a report is likewise
  severity 1 with a null rule id. The control therefore reported "this file was not linted"
  about a file that had just been linted correctly -- the exact misdiagnosis it exists to
  prevent, reproduced inside itself. It passed in GREEN only because `'error'` moves those
  reports to severity 2, meaning its correctness depended on the very setting it was supposed
  to be independent of.
- **Fix:** Added a position check. Measured: an ignore/unconfigured result describes the whole
  FILE and carries no `line`; every rule report and every directive report carries one. The
  filter is now `severity === 1 && ruleId === null && line === undefined`. The spec carries a
  self-test asserting the control still detects a genuinely ignored path.
- **Files modified:** `packages/github-cache/src/lint-rules.spec.ts`
- **Note:** This is the gok lesson ("a guard's own non-vacuity control can itself be vacuous")
  recurring, and it is the concrete return on running the RED rather than assuming green.

**2. [Rule 3 - Blocking] `MSYS_NO_PATHCONV=1` required on the container invocation**

- **Found during:** Task 1
- **Issue:** Git Bash rewrote the container-side `-w /app` into `C:/Program Files/Git/app` and
  docker rejected it.
- **Fix:** Prefixed the invocation with `MSYS_NO_PATHCONV=1`. Recorded in `07-EVIDENCE.md` so
  the next executor does not rediscover it.

### Procedural Deviation

**The manifest was edited directly instead of via `npm i -D -E`.** The plan names `npm i -D -E`,
but that command is itself a bare Windows `npm install` and writes `package-lock.json` -- the
exact thing D-05 forbids. Editing the manifest produces byte-identical devDependency entries
(bare exact specifiers, alphabetical) and then hands the whole resolve to the container, which
is the more faithful reading of the two instructions taken together. All five versions were
independently confirmed to resolve on the registry beforehand, and the container resolve would
have failed loudly on a bad specifier.

### Requirement Checkboxes Deliberately NOT Ticked

`REQUIREMENTS.md` is left **unchanged**. The plan frontmatter lists
`[LINT-01, LINT-04, LINT-05, LINT-06]`, and running `requirements mark-complete` over that
list ticks four boxes this plan does not close:

- **LINT-01**'s own text requires "a `lint` target wired into the CI battery". This plan
  deliberately ships NO `lint` target -- that is the C8 ordering constraint, not an oversight.
  Ticking it would put a factual falsehood in the ledger the milestone audit reads.
- **LINT-04** is closed "by differential, not by reading the config" (D-27/SC4). The
  differential needs the `lint` target to exist.
- **LINT-05 / LINT-06** have their rules configured and proven live here, but plan 07-02 still
  owes the four described disables and 07-04 owes the recorded evidence.

All four recur in the frontmatter of 07-03 and 07-04, which are the plans that actually
complete them. The ticks belong there. (The mechanical run also introduced cosmetic blank
lines into unrelated CORR rows, which the revert removes.)

### Discretionary Call

**`comments.recommended` is spread rather than the plugin being hand-registered.** D-29 says
`require-description` is "imported from the plugin's `./configs` subpath export", and spreading
that export is what the subpath is for -- hand-registering `plugins` would require importing
the package's MAIN entry instead, contradicting D-29. The cost is five additional rules
(`disable-enable-pair`, `no-aggregating-enable`, `no-duplicate-disable`,
`no-unlimited-disable`, `no-unused-enable`). They are the same opt-out-hygiene family as
LINT-05/LINT-06 and measure ZERO findings, since the tree has no `eslint-disable` comments
yet.

## Prohibitions Verified

Both D-06 halves are clean at the commit:
`git diff --exit-code -- packages/github-cache/package.json` and
`git diff --exit-code -- packages/github-cache/src/public-surface.spec.ts` both return zero.
The package manifest is byte-identical and the public-surface guard passes unchanged, which is
itself a v0.0.2 requirement.

## For the Verifier

**D-07's scope narrowing is an intentional, recorded DEVIATION, not a gap.** `lint` is
project-scoped, so `esbuild.action.mjs`, `start-cache-server/entry.ts`, `vitest.workspace.ts`
and the spike scripts are not linted. That narrows LINT-01 SC1's literal "across the
workspace" to "across the project that has specs". All 32 spec files and all four CORR-05
sites are inside the scope, so LINT-02, LINT-03 and CORR-06 are fully covered. The reasoning
is comment-locked in `eslint.config.mjs`'s header.

**`.planning/codebase/CONVENTIONS.md` still says "ESLint is NOT configured in this
repository".** This plan falsifies that sentence. Regenerating `.planning/codebase/*` is a
Deferred Idea, not a Phase 7 deliverable -- do not treat the stale line as a contradiction.

**No `lint` target exists yet, deliberately.** `@nx/eslint@23.1.0`'s `createNodes` returns
`[]` when no `eslint.config.*` exists anywhere, so the config file is a hard precondition of
the target. Registration is plan 07-03's job. The battery is eight commands at this commit and
becomes nine there.

## Battery at the Commit

Eight commands, all exit 0: `format:check`, `build`, `typecheck`, `typecheck:action`, `test`,
`fallow:ci`, `check:action`, `pack:check`.

Unit suite: **453 tests across 32 files**, up from 438. The +15 are 5 pin guards, 9 lint-rule
assertions and 1 input assertion.

## Self-Check: PASSED
