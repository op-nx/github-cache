---
phase: 07
plan: 03
subsystem: lint-toolchain
tags: [nx-plugin, target-inference, lint, target-inputs, stale-cache, hash-rotation, ci, tdd]
status: complete
requires:
  - eslint.config.mjs (plan 07-01) -- the plugin returns NO target without it, silently
  - "@nx/eslint 23.1.0 as a root devDependency (plan 07-01)"
  - packages/github-cache/src/nx-target-inputs.spec.ts and its hashedFilesFor helper (quick 260726-gok)
  - the eight-command pre-commit battery
provides:
  - the inferred cacheable lint target on packages/github-cache (LINT-01)
  - nx.json plugins[] entry for @nx/eslint/plugin with targetName lint
  - nx.json targetDefaults.lint -- full input list, four ESLint external dependencies, empty outputs (LINT-04)
  - the lint input probes plus an out-of-project negative control in nx-target-inputs.spec.ts
  - a CORR-04 assertion that integration is the only target with a platform runtime input
  - root package.json lint script, making the battery NINE commands
  - the lint CI job
  - the D-35 hashed-node baseline Phase 8's CORR-03 compares against
affects:
  - every task hash in the workspace (hash_project_config rotation, D-36)
  - .planning/phases/07-lint-toolchain-and-the-ambient-platform-read-ban/07-EVIDENCE.md
tech-stack:
  added: []
  patterns:
    - targetDefaults.<target>.inputs REPLACES the inferred list, so the block restates everything it keeps (D-24)
    - prove an inferred target EXISTS via nx show project, never assume registration worked (C8)
    - read the inferred input list from the installed plugin, not from a doc's quote of it (C7)
    - a negative control chosen for the target under test, not copied from a sibling target
key-files:
  created: []
  modified:
    - nx.json
    - package.json
    - .github/workflows/ci.yml
    - packages/github-cache/src/nx-target-inputs.spec.ts
    - .planning/phases/07-lint-toolchain-and-the-ambient-platform-read-ban/07-EVIDENCE.md
decisions:
  - "C8 verified, not assumed: nx show project lists lint, so the config-existence gate was satisfied. An absent target would have meant no eslint.config.* was found, not a broken plugin."
  - "C7 checked against the installed plugin source. The real inferred list is one entry longer than STACK.md quotes; the extra entry resolves to tsconfig.base.json, which sharedGlobals already folds into default, so the replacement needs no addition -- a checked conclusion, not an inherited one."
  - "build is UNUSABLE as lint's negative control, because lint's inputs start from default and hashing a spec is what lint is supposed to do. The chosen discriminator is a probe path outside {projectRoot}."
  - "A vacuity mutation (empty self pattern list) proved BOTH positive assertions still pass while only the negative control catches it -- the trap made visible rather than argued."
  - "outputs: [] rather than the inferred ['{options.outputFile}'], and no cache key, no command override, no --max-warnings: three hash_project_config fields deliberately left alone during a milestone about holding hashes still."
metrics:
  duration: ~20 min
  tasks: 2
  files: 5
  tests: 486 -> 494
  completed: 2026-07-27
---

# Phase 7 Plan 03: Wiring the lint Target into the Graph, the Battery and CI Summary

`lint` is now a real, cacheable, fully-declared Nx target: inferred by `@nx/eslint`, guarded
against the stale-cache hole its own inferred input list would have left open, and wired into
both the local battery and CI as a distinct named leg.

## What Shipped

**Task 1 (`b3fdf6d`) -- the plugin, the input block, and the probes.**

`nx.json` gains a third `plugins[]` entry (`@nx/eslint/plugin`, `targetName: lint`) and a
`targetDefaults.lint` block declaring `default`, `^default`,
`{workspaceRoot}/eslint.config.mjs`, `{workspaceRoot}/tools/eslint-rules/**/*`, and an
`externalDependencies` entry naming all four ESLint packages -- plus `outputs: []`.

`packages/github-cache/src/nx-target-inputs.spec.ts` gains eight assertions in three groups:
the `lint` glob probes with their negative control, the LINT-04 declaration pins
(four external dependencies, empty outputs, and the CORR-04 single-runtime-input check), and
two `{workspaceRoot}` literal pins in the existing stale-pass describe.

**Task 2 (`372ed35`) -- the battery command and the CI job.**

`"lint": "nx run-many -t lint"` in the root scripts, grouped with `build` / `typecheck` /
`test` / `integration`. A `lint` job in `ci.yml` on the `fallow` boilerplate, with a rationale
comment above its key.

## The Three Things That Were Proven Rather Than Assumed

**1. The target exists.** `@nx/eslint`'s `createNodes` short-circuits with
`if (eslintConfigFiles.length === 0) return [];` and produces nothing, silently. So after
registering, `nx show project @op-nx/github-cache --json` was run and `lint` confirmed present
in the target list -- exactly one new target. An absent `lint` would have meant the config file
was not found, not that the plugin was broken, and the two failure modes are indistinguishable
from the outside.

**2. The inferred input list, read from the plugin rather than from a doc.** D-24's premise is
"restate everything it keeps", so the real list was read at
`node_modules/@nx/eslint/dist/src/plugins/plugin.js:288-302`. It is one entry longer than
`STACK.md` quotes: `...tsconfigChainOutsideProjectRoot.map(...)`. All three of this project's
tsconfigs extend `../../tsconfig.base.json` and nothing else, so that entry resolves to exactly
one file which `sharedGlobals` already folds into `default`. The replacement list needs no
addition -- but a planner comparing against STACK's quote would have concluded it was complete
without ever knowing the entry existed. The `.eslintignore` entry is also conditional on
`existsSync`; no such file exists here.

**3. The negative control genuinely discriminates.** `build` -- the discriminator the
`typecheck` probes use -- is unusable for `lint`, because `lint`'s inputs start from `default`
and hashing a spec is precisely what `lint` is supposed to do. A `build`-shaped negative would
assert something false. The chosen control is a probe path outside `{projectRoot}`
(`start-cache-server/entry.ts` -- a real file, genuinely not linted, and already visible in
`test.inputs` as a `{workspaceRoot}` string). A mutation reducing `lint.inputs` to an empty
self pattern list then proved the point: `filterUsingGlobPatterns` returns the whole probe list
when the pattern list is empty, so **both positive assertions still passed** and the negative
was the only glob-resolution assertion that caught it.

## TDD

RED observed and recorded before any `nx.json` edit: **7 failed / 7 passed of 14**, every new
assertion throwing `TypeError: Cannot read properties of undefined (reading 'inputs')` on the
absent target default. GREEN after: **14 / 14**.

The CORR-04 assertion passed on BOTH sides by design -- the same direction-control device plans
07-01 and 07-02 used. Had it failed in RED, the meaning would have been "the spec cannot read
`nx.json` at all", not "`lint` is missing".

All four pre-existing assertions kept passing after the fourth `PROBE_FILES` entry was added,
confirming empirically that no assertion in the file is a whole-array comparison.

## Mutations (D-23)

| # | Mutation | Result |
|---|---|---|
| M6a | remove `{workspaceRoot}/eslint.config.mjs` from `targetDefaults.lint.inputs` | 1 failed / 13 passed -- the expected assertion, zero collateral |
| MV | reduce `lint.inputs` so the self pattern list resolves EMPTY | 3 failed / 11 passed -- both positives still passed; only the negative control caught it |

Both applied, observed, and REVERTED before the commit. `nx.json` restored byte-identical and
re-verified at 14 / 14. M6's second half (the stale-cache HIT differential) is plan 07-04's and
is not claimed here.

## D-35 -- the Phase 8 baseline (a deliverable, not a note)

The inferred `lint` target's HASHED node values, recorded in `07-EVIDENCE.md` as the baseline
CORR-03 compares against: `targetName: lint`, `executor: nx:run-commands`, `outputs: []`,
`options.cwd: packages/github-cache`, `options.command: eslint .`, `configurations: {}`,
`parallelism: true`. `metadata` is NOT hashed and is omitted, so the `${pmc.exec}` it carries is
a non-issue.

**This is a baseline, not a closure.** Whether `@nx/eslint` infers the same node on Linux is
UNVERIFIED BY DESIGN (T-07-17): the existence gate runs
`eslint.isPathIgnored(join(workspaceRoot, file))` with a POSIX `join` over an absolute Windows
root. `options.cwd` is the row most likely to diverge, and it is hashed. Phase 8's CORR-03 two-leg
measurement treats `lint` as a fourth target and settles it empirically.

## D-36 -- this is a legitimate all-MISS push

Registering an inference plugin changes `hash_project_config`, which is folded into EVERY task
hash, and `test` rotates twice over because `{workspaceRoot}/nx.json` is already an explicit
`test` input. The rotation is isolated in `b3fdf6d` so it stays attributable.

**Consequence for Phase 9:** Phase 7's first default-branch push carrying these commits is a
legitimate all-MISS push. OBS-04's tripwire must therefore be authored as *"two consecutive
all-miss pushes with NO version-affecting change in between"* -- there are three legitimate
rotation windows in this milestone, and a tripwire that fires on correct work gets disabled.
Plan 07-04 writes the pre-record.

## Deviations from Plan

**None on substance.** Two additive judgements inside the plan's own acceptance criteria:

1. **[Rule 2 - missing verification] The CORR-04 acceptance criterion was made executable.** The
   plan's acceptance criteria require "`nx.json` contains exactly ONE runtime input across the
   whole file, and it belongs to `integration`... verifiable as a source assertion over the
   `targetDefaults` block", but the `<behavior>` block did not list it. Shipped as an `it()`
   that walks every `targetDefaults` entry and asserts the set of targets carrying a `runtime`
   input equals `['integration']`. A criterion nobody executes is a comment.
2. **[Rule 2 - missing verification] MV, the vacuity mutation, was run in addition to M6a.** D-23
   is the repo standard and M6a alone only proves a literal pin can fail. MV is what proves the
   *negative control* is load-bearing, which is the assertion this plan actually had to invent.

## Battery

| Commit | Battery | Result |
|---|---|---|
| `b3fdf6d` | EIGHT | all exit 0 |
| `372ed35` | **NINE** (adds `lint`) | all exit 0 |

Green at EVERY commit, not just the last -- the standard set by quick 260726-4cc and 260726-gok.
Unit suite 486 -> **494 tests across 33 files**; the +8 are all this plan's, all in
`nx-target-inputs.spec.ts` (6 assertions -> 14). First `lint` run: 1.7 s, `Cache: 0/1 hit (0%)`,
cold by construction.

## Verification

| Check | Result |
|---|---|
| `nx show project` lists exactly ONE new target, `lint` | yes |
| `packages/github-cache/project.json` untouched (D-01/D-02) | `git diff --exit-code` clean |
| `packages/github-cache/package.json` untouched (D-06) | `git diff --exit-code` clean |
| `ci.yml` `lint` job has exactly checkout, setup-node, `npm ci`, `npm run lint` | parsed with the `yaml` package; confirmed |
| no job's `needs:` references `lint`; no spec asserts on `ci.yml` | confirmed |
| `integration` is still the only target with a platform runtime input (CORR-04) | asserted and passing |

## What This Leaves Open

- **T-07-17 (transferred, not closed).** OS-divergent inference. Phase 8 CORR-03.
- **The `lint` sidecar dogfood block** (D-33). Purely additive, deferred by decision.
- **LINT-04's differential proof** (D-27 / G5 measurements A, B, C and M6's cache half) is plan
  07-04's. This plan closed the *hole*; 07-04 measures that it is closed.
- **`.planning/codebase/CONVENTIONS.md` still says "ESLint is NOT configured in this
  repository".** Falsified since plan 07-01. Regenerating `.planning/codebase/*` is a deferred
  idea, not a Phase 7 deliverable.

## Known Stubs

None.

## Threat Flags

None. No new network endpoint, auth path, file-access pattern or trust-boundary schema change:
this plan modifies build-tool configuration, a package script, and a CI job.

## Self-Check: PASSED

All five modified files and the summary exist on disk; both commit hashes (`b3fdf6d`,
`372ed35`) resolve in `git log`.
