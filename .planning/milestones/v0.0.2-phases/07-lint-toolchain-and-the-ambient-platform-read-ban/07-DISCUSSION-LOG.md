# Phase 7: Lint Toolchain and the Ambient-Platform-Read Ban - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-07-27
**Phase:** 7-Lint Toolchain and the Ambient-Platform-Read Ban
**Mode:** `--analyze --auto --chain` (trade-off analysis per area; Claude auto-selected the
recommended option for every area except the one escalated below)
**Areas discussed:** Lint target provenance, Lint scope and blast radius, Rule set composition,
The ban rules, Scope-glob drift guard, RED-before-GREEN evidence, Stale-cache closure, Opt-out
discipline and the four CORR-05 sites, CI wiring, Phase 8 hand-off

---

## Lint target provenance (ESCALATED -- not auto-decided)

**Why this one was escalated rather than auto-locked.** It sat in the trap quadrant: HIGH impact
(the phase's central toolchain choice; it feeds Phase 8's clean-room parity investigation, and
unwinding it after Phase 8's root-cause record would invalidate that record -- the same argument
that put Phase 7 first) combined with NOT-HIGH confidence in the "recommended" option. STATE.md
called it "still undecided" and "deserves one line in the plan before it is dismissed"; research
SUMMARY section 4 item 5 called the dismissal "close"; and the stated reason for the
recommendation was a convention argument ("ecosystem norm, the generator does the wiring") against
an unrebutted mechanism argument (a new inference plugin is a new OS-divergence surface in the
milestone whose purpose is removing unverified cross-OS variance).

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit target in `project.json` | `command: 'eslint .'` beside the existing `integration` target, same shape. No inference plugin, four deps instead of five, closes STACK.md's "does `@nx/eslint` infer `lint` identically on both OSes? UNVERIFIED BY DESIGN" open item. Diverges from the research recommendation. | |
| `@nx/eslint` inference plugin | Research SUMMARY section 4 item 5 (three lenses converged on KEEP); ROADMAP and REQUIREMENTS already cite inference as the LINT-01 -> PARITY-01 mechanism; ecosystem norm. Costs a fifth exact-pinned dep in version lockstep with nx 23.1.0, and carries one unverified cross-OS inference. | Yes |

**User's choice:** `@nx/eslint` inference plugin.

**Notes:** Chosen with the OS-divergence cost stated in full, so the risk is ACCEPTED rather than
overlooked. Consequences recorded in CONTEXT.md: D-01 (the decision plus the one-line dismissal
the requirement demands), D-08 (never create a root `src/`or `lib/` this milestone, or a second
lint target appears silently), and D-35 (Phase 7 records the inferred target's hashed node values
as the baseline Phase 8's CORR-03 compares against, treating `lint` as a fourth target). The
Phase 7 -> Phase 8 ordering was NOT a differentiator: any declared target mutates
`hash_project_config`, so the constraint holds under either option.

---

## Lint scope and blast radius

| Option | Description | Selected |
|--------|-------------|----------|
| Project-scoped (`eslint .`, cwd `packages/github-cache`) | What `@nx/eslint` infers. Covers all 32 specs and all four CORR-05 sites. Leaves root-level files unlinted. | Yes |
| Workspace-wide | Matches LINT-01 SC1's literal "across the workspace" wording, but needs a root lint scope, which the `@nx/eslint` route can only reach by creating a root `src/` -- forbidden by the plugin's own caveat. | |

**Auto-selected:** project-scoped. Follows mechanically from the target-provenance choice, and is
the same answer under either option. **Recorded as an intentional deviation, not a gap** (D-07):
`esbuild.action.mjs`, `start-cache-server/entry.ts`, `vitest.workspace.ts` and
`.planning/spikes/*.mjs` are not linted by this phase. Widening later is additive and is carried
as a deferred idea.

---

## Rule set composition

| Option | Description | Selected |
|--------|-------------|----------|
| Mandated rules only | Only LINT-02/05/06's rules. Smallest surface, zero cleanup risk. Makes `@eslint/js` an unused dependency. | |
| Recommended sets, non-type-checked | `@eslint/js` recommended + `typescript-eslint` recommended, plus the mandated rules. What the research dependency table budgets for. | Yes |
| Recommended type-checked | Adds `parserOptions.projectService`. | |

**Auto-selected:** recommended, non-type-checked, with the D-12 bounded-cleanup rule attached.
Type-checked was rejected outright by LINT-04 clause (c) -- no mandated rule is type-aware, and it
would make `lint` sensitive to the whole TypeScript program plus tsconfigs, widening the input set
and the stale-cache blast radius. The bounded-cleanup rule is what keeps "adopt a linter" from
turning into an open-ended sweep: measure the baseline count first, fix what is few and
mechanical, scope off any single broad rule with a recorded reason -- never a blanket file or
directory disable.

---

## The ban rules (LINT-02, CORR-06)

| Option | Description | Selected |
|--------|-------------|----------|
| `no-restricted-syntax` alone | The rule the requirement names first. | |
| `no-restricted-imports` alone | Catches the import family in one line. | |
| Both core rules | Neither is sufficient alone; both are core, no new dependency. | Yes |

**Auto-selected:** both. Not a preference -- a structural necessity. `no-restricted-syntax` is an
AST-selector matcher and cannot see a destructured named import, and
`cache-archive-path.spec.ts:1` (`import { tmpdir } from 'node:os'`) is exactly that shape;
conversely `no-restricted-imports` cannot ban a member of a namespace import. Wiring one would
make LINT-03's RED proof pass for one shape and silently miss the other.

Two received-wording corrections locked at the same time: the allowed-shape example is
`cachePlatform('win32')`, NOT CORR-06's `releaseAssetName(hash, 'win32')` (that parameter is
deleted by CORR-02 in Phase 10 and `fallow` would then flag the example); and the glob set is the
full `{ts,mts,cts}` in BOTH `files` and `ignores`, because the `.ts`-only form inverts the rule
against `.mts` integration specs.

---

## Scope-glob drift guard

| Option | Description | Selected |
|--------|-------------|----------|
| Assert set equality with both vitest configs | Simplest to state. | |
| Assert the two load-bearing invariants | `files` and `ignores` extension sets identical to each other; that set a superset of the integration config's includes. | Yes |

**Auto-selected:** the two invariants. Set equality is not achievable -- `vitest.config.mts`'s
include is deliberately wider (`{js,mjs,cjs,ts,mts,cts,jsx,tsx}`) than the `{ts,mts,cts}` the
requirement mandates for the lint globs, so an equality assertion would be permanently red.
Discovered by reading the real config during the codebase scout; the requirement text does not
mention it.

---

## RED-before-GREEN evidence (LINT-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Deliberately-red intermediate commit | Land the rules, observe four failures, then land the disables. | |
| A committed violating fixture file | Permanent, but permanently reds the `lint` target. | |
| Programmatic ESLint spec via `lintText` | One mechanism proves the rule fires AND proves the scoping in both directions; permanent and mutation-testable; rules and disables land in one green commit. | Yes |

**Auto-selected:** the programmatic spec. The intermediate-red option breaks the repo's
bisect-safety discipline (full battery green at every commit), and a one-time observation is not
a regression guard. `lintText(code, { filePath })` applies flat-config `files`/`ignores` matching
to the supplied path, so a synthetic `...spec.ts` path and the identical source at a
`...integration.spec.ts` path prove the exemption too.

Two halves locked (D-21, D-22): inline evasion-shape fixtures for the rule set's completeness, and
a comment-locked table of the four real sites, each linted with its disable stripped. The table
carries its own removal schedule so Phases 9 and 10 delete the row with the site. Guard must be
mutation-tested before it counts (D-23).

---

## Stale-cache closure (LINT-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Rely on the inferred inputs | `{ externalDependencies: ['eslint'] }` plus `default`. | |
| Full `targetDefaults.lint` override, plus the `test` second-order fix | Restates every input, adds the three missing external deps, and closes the hole in `test` too. | Yes |

**Auto-selected:** the full override. The inferred `externalDependencies` list names `eslint`
only, so a `typescript-eslint` bump would not invalidate the `lint` cache -- precisely LINT-04's
named failure class. And `targetDefaults.<target>.inputs` REPLACES rather than merges, so the
block must restate everything it keeps.

**The second-order hole is the one most likely to be missed (D-25):** the RED-proof spec runs
under the `test` target, so `test.inputs` needs `{workspaceRoot}/eslint.config.mjs` and the ESLint
external deps in the SAME commit. Without it, editing a rule replays a cached `test` PASS -- and
since LINT-03 IS the activity that edits rules, the false PASS surfaces during LINT-03 and reads
as "the rule does not fire". This repo has shipped that exact defect twice already.

---

## Opt-out discipline and the four CORR-05 sites

No competing options -- REQUIREMENTS already dictates described-disable-only, and the four sites
each get one in the same commit as the rules so Phase 7 lands green. What was decided here is the
mechanism narrative that the requirement leaves implicit and that a planner will otherwise get
wrong in one of two ways: leave the build red, or delete the violations early and destroy LINT-03's
evidence. LINT-06's `reportUnusedDisableDirectives: 'error'` is what forces each disable out
together with its violation in Phases 9 and 10 -- the design working, not a leak.

One received-wording correction: the flat-config rule prefix is the scoped
`@eslint-community/eslint-comments/`, not the bare `eslint-comments/` LINT-05's text uses.

---

## CI wiring

| Option | Description | Selected |
|--------|-------------|----------|
| `lint` job with the sidecar dogfood block | Consistent with the four cacheable targets already dogfooded. | |
| Plain `lint` job, no sidecar | Lint runs in seconds; no fifth cache producer during the parity milestone. | Yes |

**Auto-selected:** plain job. Adding a fifth cache producer and a fifth mirrored hash family in
the middle of the milestone whose job is stabilising hashes adds surface to the Phase 8
investigation for no gain. Additive later -- carried as a deferred idea. Also locked: no
`--max-warnings` flag and no override of the inferred `command`, so one more
`hash_project_config` field stays untouched.

---

## Phase 8 hand-off

Not a fork -- an obligation created by the target-provenance choice. Phase 7 records the inferred
`lint` target's hashed node values as CORR-03's comparison baseline (D-35), and records in advance
that registering the plugin makes Phase 7's first default-branch push a legitimate all-MISS push
(D-36), so Phase 9's OBS-04 tripwire is authored as "two consecutive all-miss pushes with no
version-affecting change in between" rather than firing on correct work.

---

## Claude's Discretion

- Exact esquery selector strings, rule `message` wording, flat-config layout and object ordering,
  and the per-site disable reason prose.
- Which recommended-set rules end up scoped off under the bounded-cleanup rule, and where the
  fix-vs-disable line falls -- decided on the measured count, with the number recorded.
- Whether the evasion fixtures live inline or as exported constants in a sibling module.
- Whether the drift guard and the RED proof are one spec file or two.

## Deferred Ideas

- Mechanize `curly` and blank-lines-around-control-flow, the two style rules CONVENTIONS.md
  records as enforced by convention only. Outside LINT-01..06.
- Sidecar dogfood block for the `lint` job.
- Lint the root-level files the project-scoped target misses.
- `eslint@10` bump, blocked on checking `loadESLint` survives v10.
- Regenerate `.planning/codebase/*`; this phase falsifies CONVENTIONS.md's "ESLint is NOT
  configured in this repository".
- Surfaced but not owned here: whether the v0.0.2 branch gets a PR per phase or one at milestone
  end. It determines when the all-MISS push lands on `main`, which Phases 10 and 11 depend on.
