---
phase: 7
slug: lint-toolchain-and-the-ambient-platform-read-ban
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-27
---

# Phase 7 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `07-RESEARCH.md` `## Validation Architecture`. The per-task map is
> filled in after plans exist; `/gsd:validate-phase` closes it post-execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest `~4.1.0` (`@nx/vitest@23.1.0` infers the `test` target) |
| **Config file** | `packages/github-cache/vitest.config.mts` (unit); `vitest.integration.config.mts` (integration) |
| **Quick run command** | `npx vitest run <file>` from `packages/github-cache`, or `npm run test` from the root |
| **Full suite command** | `npm run test` from the root; full gate is the NINE-command battery below |
| **Estimated runtime** | ~5 s warm for `npm run test`; battery ~2-4 min cold |
| **Baseline today** | 32 spec files, 438 tests (quick 260726-gok, 2026-07-26) |

**The battery is EIGHT commands today and NINE from the commit that adds `lint`:**
`format:check`, `build`, `typecheck`, `typecheck:action`, `test`, **`lint`**, `fallow:ci`,
`check:action`, `pack:check`.

---

## Sampling Rate

- **After every task commit:** `npm run test` (whole unit suite, seconds), plus `npm run lint`
  from the commit that introduces the target onward.
- **Before every commit:** the full battery. The repo standard set by quick 260726-4cc and
  260726-gok is "green at EVERY commit, not just the last" -- this phase inherits it at nine
  commands.
- **Before `/gsd:verify-work`:** full battery green AND the two G5 differential measurements
  recorded AND the M1-M9 mutation results recorded.
- **Max feedback latency:** ~5 s (unit suite) / ~4 min (battery).

---

## Per-Task Verification Map

Task IDs are assigned when plans are written. Requirement-to-proof mapping is fixed now; the
planner binds each row to a task.

| Requirement | Behavior that must be proven | Threat Ref | Test Type | Automated Command | File | Status |
|-------------|------------------------------|-----------|-----------|-------------------|------|--------|
| LINT-01 | five devDeps exact-pinned AND name-guarded | V14 dep-drift | unit | `npx vitest run src/pinned-deps.spec.ts` | EXTEND `src/pinned-deps.spec.ts` (D-04) | pending |
| LINT-01 | a `lint` target exists, is cacheable, is in the battery | -- | command | `npm run lint` exits 0 | none -- the battery command IS the assertion (D-34) | pending |
| LINT-02 | unit spec reading ambient platform state FAILS; identical code at an integration path PASSES | -- | unit | `npx vitest run src/<red-proof>.spec.ts` | **NEW** (D-20) | pending |
| LINT-02 | ESLint globs and the vitest partition agree (superset, not equality) | -- | unit | same file or sibling (D-19) | **NEW** (D-19) | pending |
| LINT-03 | every D-21 evasion shape has an explicit asserted verdict | -- | unit | same file | **NEW** (D-20/D-21) | pending |
| LINT-03 | each of the FOUR extant CORR-05 sites is CAUGHT while it exists | -- | unit | same file | **NEW** (D-22) | pending |
| LINT-04 (a) | the declared `lint` inputs are correct | -- | unit | `npx vitest run src/nx-target-inputs.spec.ts` | EXTEND `src/nx-target-inputs.spec.ts` (D-26) | pending |
| LINT-04 (b) | `lint` cannot serve a stale-cache false PASS | -- | **manual differential** | the G5 command sequence | recorded in phase evidence -- D-27/SC4 require differential, so (a) alone does NOT close it | pending |
| LINT-04 | `test` re-runs when a rule changes (D-25) | -- | unit + manual | `nx-target-inputs.spec.ts` + G5 Measurement C | EXTEND `src/nx-target-inputs.spec.ts` | pending |
| LINT-05 | a bare disable and a bare `@ts-expect-error` are both errors | V14 repudiation | unit | RED-proof spec via `lintText` | **NEW**, folded into D-20 spec | pending |
| LINT-06 | a stale disable FAILS | V14 repudiation | unit | RED-proof spec: described disable over a NON-violating line | **NEW**, folded into D-20 spec | pending |
| CORR-06 | the ban is mechanical, and integration keeps every OTHER rule | -- | unit | D-20 direction pair + one assertion that a DIFFERENT rule still fires at the integration path | **NEW** | pending |

*Status: pending / green / red / flaky*

---

## Non-Vacuous Assertions

This phase has five distinct vacuity traps. Each assertion below is only admissible with its
control attached.

| Assertion | Vacuity trap | Control that closes it |
|-----------|--------------|------------------------|
| "the rule errors at a unit-spec path" | ESLint returns `[]` for an `ignored` or `unconfigured` path -- identical to "no violation" | assert `result.messages` contains no `severity:1, ruleId:null` ignore-warning; set `warnIgnored: true` explicitly |
| "the rule does NOT error at an integration path" | passes trivially if the config never loaded, the path is misspelled, or the ban rules were never added | pair with an assertion that a DIFFERENT rule (e.g. `@typescript-eslint/no-explicit-any` on `const x: any = 1;`) DOES fire at that same path -- proves the file is linted and only the ban is exempt (D-17) |
| `nx-target-inputs.spec.ts` `lint` probes | `filterUsingGlobPatterns` returns the WHOLE input list when the pattern list is empty, so every `toContain()` passes together on a resolver that resolved nothing (recorded in the spec's own comment) | reuse the existing NEGATIVE-control shape: assert `lint` does NOT hash something it genuinely must not. If no clean negative exists for `lint`, say so in the comment rather than shipping a positive-only set |
| "the four CORR-05 sites are caught" | rots the instant the disables shift line numbers -- which happens in the SAME commit | key the site table on FILE + EXPRESSION TEXT, locate position by searching file content, and blank out (do not delete) the stripped disable line so numbering is preserved |
| "the disables are described" | a disable with `--` and an empty reason still parses | assert the reason text is non-empty AND contains `integration` (LINT-06 requires it to state why the assertion cannot move there) |

---

## Mutation Testing (D-23 -- repo standard since quick 260726-gok)

A guard that cannot fail is worthless. Each mutation must be applied, observed, and **REVERTED
before the commit**. Mutation runs are never committed. Record observed failure counts.

| # | Mutation | Expected result |
|---|----------|-----------------|
| M1 | delete the P1 selector from `no-restricted-syntax` | the three `process.platform` site assertions + the `process.platform` evasion assertion go RED; import-shape assertions stay GREEN |
| M2 | delete the `node:os` entry from `no-restricted-imports` `paths` | site-1 + named-import/namespace-import evasion assertions go RED; `process.*` assertions stay GREEN |
| M3 | delete the P6 `ImportExpression` selector | ONLY `await import('node:os')` / `await import('node:path')` go RED. If nothing goes red, P6 is untested and D-21's dynamic-import shape is a silent gap |
| M4 | change `ignores` to `['**/*.integration.spec.ts']` (drop `mts,cts`) | the D-19 drift guard goes RED. If it stays green it is asserting equality of the wrong pair, or restating the globs instead of reading them |
| M5 | remove `{workspaceRoot}/eslint.config.mjs` from `targetDefaults.test.inputs` | the `nx-target-inputs.spec.ts` assertion goes RED (the D-25 guard's own mutation test) |
| M6 | remove `{workspaceRoot}/eslint.config.mjs` from `targetDefaults.lint.inputs` | the `lint` probe assertion goes RED, AND G5 negative control 1 reproduces the stale-cache HIT |
| M7 | remove the global `ignores` block from `eslint.config.mjs` | G5 negative control 2 reports two different `linted:` counts across `rm -rf dist out-tsc`. The only control for the G3 finding |
| M8 | replace one described disable with a bare `// eslint-disable-next-line no-restricted-syntax` | `require-description` errors -- proves LINT-05 is live, not merely configured |
| M9 | move a described disable one line off its violation | `reportUnusedDisableDirectives` errors AND the underlying rule errors -- proves LINT-06 is live |

---

## Wave 0 Requirements

- [ ] the D-20/D-22 RED-proof spec (NEW file) -- covers LINT-02, LINT-03, LINT-05, LINT-06, CORR-06
- [ ] the D-19 drift-guard assertions (NEW file, or folded into the above -- D-19 discretion)
- [ ] `src/pinned-deps.spec.ts` -- five new `it()` blocks (LINT-01)
- [ ] `src/nx-target-inputs.spec.ts` -- `lint` probes + the `test.inputs` ESLint assertion (LINT-04)

**No framework install needed.** Vitest, its config, and the `import.meta.url` disk-read idiom all
already exist. The only NEW capability is instantiating the ESLint Node API from a spec, which
needs the `eslint` devDependency and nothing else.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `lint` re-runs instead of replaying a cached PASS after a RULE edit | LINT-04 | SC4 requires proof "by differential rather than by reading the config". A spec asserting the declared inputs is necessary but explicitly not sufficient | G5 Measurement A: run `npm run lint` twice (second is a cache HIT), edit a rule in `eslint.config.mjs`, run again -- must re-run. Record the `Cache: n/m hit` line on both sides |
| `lint` re-runs after a linted SOURCE file edit | LINT-04 | same | G5 Measurement B, same shape |
| `test` re-runs after a rule edit (D-25) | LINT-04 | same defect class one level up; this is the second-order hole | G5 Measurement C |
| M1-M9 mutation results | LINT-03, LINT-04, LINT-05, LINT-06 | mutations must be reverted, so they cannot live in a committed test | apply, observe, record, revert |
| the five packages carry no `postinstall` | LINT-01 (V14) | pre-install supply-chain check | `npm view <pkg> scripts.postinstall` for all five BEFORE `npm i`. Non-empty on any is a STOP condition requiring human verification |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or a Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags (`vitest run`, never bare `vitest`)
- [ ] Feedback latency < 300 s (battery)
- [ ] Every non-vacuous control from the table above is present in the shipped assertions
- [ ] M1-M9 applied, observed, recorded, and reverted
- [ ] G5 Measurements A, B, C recorded with their `Cache: n/m hit` lines
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
