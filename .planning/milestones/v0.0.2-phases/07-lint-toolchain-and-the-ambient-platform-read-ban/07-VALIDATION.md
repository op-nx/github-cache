---
phase: 7
slug: lint-toolchain-and-the-ambient-platform-read-ban
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-27
audited: 2026-07-28
audit_base: 7b451ca..HEAD
gaps_found: 2
gaps_filled: 2
gaps_escalated: 0
---

# Phase 7 -- Validation Strategy and Post-Execution Audit

> Sections 1-6 are the contract written BEFORE execution, corrected in place where
> execution superseded the prediction. Section 7 onward is the retroactive
> `/gsd:validate-phase` audit: what was predicted, what actually shipped, and the two
> gaps that were genuinely uncovered and are now closed.
>
> Every number in this file is MEASURED at HEAD on 2026-07-28, not carried forward.

---

## 1. Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest `4.1.10` (`@nx/vitest@23.1.0` infers the `test` target) |
| **Config file** | `packages/github-cache/vitest.config.mts` (unit); `vitest.integration.config.mts` (integration) |
| **Quick run command** | `npx vitest run src/<file> --root packages/github-cache`, or `npm run test` from the ROOT |
| **Full suite command** | `npm exec -- nx run-many -t test --skip-nx-cache` from the root; full gate is the NINE-command battery |
| **Measured runtime** | unit suite ~6 s uncached; `lint` 1.6-1.7 s; battery ~2-4 min cold |
| **Baseline at phase start** | 32 spec files, 438 tests (quick 260726-gok) |
| **At execution close** | 33 spec files, 507 tests |
| **At this audit's close** | **33 spec files, 532 tests** (+25, all in `lint-rules.spec.ts`: 46 -> 71) |

**The battery is NINE commands** from `372ed35` onward: `format:check`, `build`, `typecheck`,
`typecheck:action`, `test`, **`lint`**, `fallow:ci`, `check:action`, `pack:check`. All nine
verified green from the REPO ROOT at this audit's commit.

---

## 2. Sampling Rate

As executed, unchanged from the contract:

- **After every task commit:** `npm run test`, plus `npm run lint` from `372ed35` onward.
- **Before every commit:** the full battery. Honoured at all 24 source-touching commits in the
  range (`07-REVIEW-FIX.md:320` verifies it per commit for the 14 fix commits).
- **Before `/gsd:verify-work`:** battery green AND the G5 differentials recorded AND M1-M9
  recorded. All three satisfied at `0ef4aad`.
- **Max feedback latency:** ~6 s (unit suite) / ~4 min (battery). Well inside the 300 s target
  for the inner loop.

One sampling defect was found and fixed DURING the phase rather than by this audit: the two new
guard files paid a ~1000 ms ESLint toolchain boot inside a per-test budget and went
intermittently red under `nx run-many -t typecheck,test`. Fixed structurally by hoisting the boot
into `beforeAll`, proven at a per-test budget 100x tighter than the default
(`07-EVIDENCE.md:439-476`). Recorded here because a flaky sample is a broken sample.

---

## 3. Per-Task Verification Map (BOUND)

The contract shipped with every row `pending` and no task ID, because it predates the plans.
Bound below to the plan task and the commit that satisfies it. Task IDs are `<plan> T<n>`,
matching the `<task>` blocks in each PLAN.md.

| Requirement | Behaviour proven | Task | Commit | Test Type | Automated Command | File | Status |
|---|---|---|---|---|---|---|---|
| LINT-01 | five devDeps exact-pinned AND name-guarded | 07-01 T1 | `db577db` | unit | `npx vitest run src/pinned-deps.spec.ts --root packages/github-cache` | `src/pinned-deps.spec.ts:102-133` (5 explicit `it()`) | green |
| LINT-01 | a `lint` target EXISTS and is named `lint` | 07-03 T1 + CR-01 | `b3fdf6d`, `5e662a7` | unit | `npx vitest run src/nx-target-inputs.spec.ts --root packages/github-cache` | `src/nx-target-inputs.spec.ts:137-175` | green |
| LINT-01 | the target actually RAN, not "no tasks were run" | CR-01 | `5e662a7` | CI gate | `.github/workflows/ci.yml` lint job | requires the literal `Successfully ran target lint`, `NO_COLOR: '1'` | green |
| LINT-01 | `lint` is cacheable and in the battery | 07-03 T2 | `372ed35` | manual differential | `npm run lint` twice | `Cache: 0/1` then `1/1`, re-measured at HEAD in section 6 | green |
| LINT-02 | a platform read at a unit path FAILS; identical code at an integration path PASSES | 07-02 T1 | `1454404` | unit | `npx vitest run src/lint-rules.spec.ts --root packages/github-cache` | `src/lint-rules.spec.ts` `EVASION_SHAPES` x 2 describes | green |
| LINT-02 | the ban applies to EXACTLY what the unit runner collects (3 mirrors) | 07-02 T2, superseded by ME-01 | `5adde9b`, `a6af663` | unit | `npx vitest run src/lint-scope-drift.spec.ts --root packages/github-cache` | `src/lint-scope-drift.spec.ts:287-360` | green |
| LINT-02 | the ban FIRES at every one of the 16 unit path shapes | **this audit** | see commit below | unit | `npx vitest run src/lint-rules.spec.ts --root packages/github-cache` | `src/lint-rules.spec.ts` width matrix | **green (GAP-1)** |
| LINT-03 | every D-21 evasion shape has an explicit asserted verdict | 07-02 T1, HI-01, ME-02 | `1454404`, `5b9f5ca`, `7afb251` | unit | same file | 11 `EVASION_SHAPES` rows + 7 false-positive controls | green |
| LINT-03 | each of the FOUR extant CORR-05 sites is CAUGHT while it exists | 07-02 T1 | `1454404` | unit | same file | `CORR_05_SITES`, 4 rows x 2 assertions | green |
| LINT-04 (a) | the declared `lint` inputs are correct | 07-03 T1, LO-01, LO-05 | `b3fdf6d`, `331a60c`, `912b4b6` | unit | `npx vitest run src/nx-target-inputs.spec.ts --root packages/github-cache` | `src/nx-target-inputs.spec.ts:206-327` | green |
| LINT-04 (b) | `lint` cannot serve a stale-cache false PASS | 07-04 T1 | `9ea224f` | **manual differential** | the G5 sequence | `07-EVIDENCE.md:661-755`; **re-run at HEAD**, section 6 | green |
| LINT-04 | `test` re-runs when a rule changes (D-25) | 07-01 T3, 07-04 T1 | `db577db`, `9ea224f` | unit + manual | `nx-target-inputs.spec.ts:286` + G5 Measurement C | both | green |
| LINT-05 | a bare disable and a bare `@ts-expect-error` are both errors | 07-01 T3, 07-04 T2 | `db577db`, `be895a6` | unit + mutation | `lint-rules.spec.ts:205-263` + M8 | see the LINT-05 caveat in section 5 | green |
| LINT-06 | a stale disable FAILS | 07-01 T3, 07-04 T2 | `db577db`, `be895a6` | unit + mutation | `lint-rules.spec.ts:265-287` + M9 | green |
| LINT-06 | the reason states why the assertion cannot move to integration | 07-02 T1, HI-02, **this audit** | `1454404`, `2cc6203`, this commit | unit | same file | `CORR_05_SITES` reason assertion; strip widened to `\w+` | **green (GAP-2)**, with residual N-1 |
| CORR-06 | the ban is mechanical, and integration keeps every OTHER rule | 07-01 T3, 07-02 T1 | `db577db`, `1454404` | unit | same file | the direction pair + the non-ban-rule control | green |
| CORR-06 | the exemption is the integration SUITE, not everything named `integration` | **this audit** | see commit below | unit | same file | 6 still-banned + 3 exempt rows | **green (GAP-1)** |

*Status legend: pending / green / red / flaky. Zero rows remain pending.*

---

## 4. Non-Vacuous Assertions -- predicted vs shipped

All five predicted vacuity traps have their control in the shipped code. Two of the five went
further than predicted, because the trap fired for real during execution.

| Assertion | Control predicted | Control SHIPPED | Verdict |
|---|---|---|---|
| "the rule errors at a unit-spec path" | reject `severity:1, ruleId:null`; set `warnIgnored: true` | `lintFixture` + `ignoreWarnings`, and the filter needed a THIRD term: `line === undefined`. Without it the control matched an unused-directive report and mis-diagnosed a correctly linted file as un-linted (`07-EVIDENCE.md:241-267`) | **stronger than predicted** |
| "the rule does NOT error at an integration path" | pair with a DIFFERENT rule firing at the same path | `lint-rules.spec.ts:298-312`, `@typescript-eslint/no-explicit-any` at the integration path. Passed on BOTH sides of every RED, which is what makes each RED attributable | as predicted |
| `nx-target-inputs.spec.ts` `lint` probes | need a NEGATIVE control; say so if no clean negative exists | a fourth `PROBE_FILES` entry OUTSIDE `{projectRoot}` (`start-cache-server/entry.ts`). Mutation MV proved it is the ONLY assertion that catches an empty pattern list (`07-EVIDENCE.md:590-597`) | as predicted, and mutation-proven |
| "the four CORR-05 sites are caught" | key on FILE + EXPRESSION TEXT; BLANK, never delete | exactly that, `lint-rules.spec.ts` `CORR_05_SITES` + `lineIndexOf` + the blank-not-splice comment | as predicted |
| "the disables are described" | reason non-empty AND contains `integration` | plus HI-02's filename strip, plus this audit's widening of that strip to `\w+`. See GAP-2 | **stronger than predicted** |

A sixth trap was found by execution and is not in the original table: **the non-vacuity control
can itself be vacuous**. `lint-rules.spec.ts:188-203` now carries a self-test that lints a
genuinely ignored path and asserts the control detects it.

---

## 5. Mutation Testing (D-23)

All nine planned mutations were applied, observed and reverted, with observed failure sets at
`07-EVIDENCE.md:785-795`. **Row M4 in the pre-execution table was written against an invariant
that ME-01 deleted and is corrected below.** Three further mutations (W1-W3) were run by THIS
audit against the guards it adds.

| # | Mutation | Predicted | OBSERVED | Verdict |
|---|---|---|---|---|
| M1 | delete the P1 selector | 3 site assertions + the `process.platform` evasion row RED; import shapes GREEN | 4 failed / 33 passed, exactly those; every import-shape assertion GREEN | MATCH |
| M2 | delete the `node:os` entry from `no-restricted-imports.paths` | named/namespace import rows + site 1 RED; `process.*` GREEN | 3 failed / 34 passed, exactly those | MATCH. Failure set DISJOINT from M1's, which is D-15 measured |
| M3 | delete the P6 `ImportExpression` selector | ONLY the two dynamic-import rows RED | 1 failed / 36 passed. Both dynamic shapes live in ONE `it()` whose expected value is a two-element list, so the count is 1, not 2. Coverage identical, granularity different | MATCH, granularity noted |
| **M4 (SUPERSEDED)** | ~~`ignores` -> `['**/*.integration.spec.ts']`; the D-19 drift guard goes RED if it is not asserting equality of the wrong pair~~ | -- | The named assertion (`applies the ban to exactly the extension set it exempts`) was DELETED by ME-01. See M4' below | **stale, replaced** |
| **M4' (re-derived)** | widen `ignores` to the eight extensions of `files` -- the "tidy" the old symmetric invariant actively encouraged | leg 2 of the shipped three-mirror guard RED, plus the behavioural rows for the five non-integration extensions | **6 failed / 71 passed** (measured this audit): `still bans *.integration.spec.{js,mjs,cjs,jsx,tsx}` (5, behavioural) plus `exempts exactly what the unit runner EXCLUDES, not what it includes (D-19 new (2))` (1, comparison). `integration.test.ts` correctly stays GREEN -- the tidy is `spec`-only | **MATCH.** This is the mutation the OLD invariant could not see at all (`07-REVIEW-FIX.md:167`) |
| M4 (as originally written, re-run against the SHIPPED guard) | -- | **3 failed / 71 passed**: `exempts *.integration.spec.mts` and `.cts` (behavioural, from this audit's rows) plus leg 2 failing through the glob parser's own non-vacuity guard, `expected the glob "**/*.integration.spec.ts" to have a basename of the form *.<names>.{ext,ext}` | still discriminates, but via a different assertion than the record named. UF-4 / N-3 closed |
| M5 | remove `eslint.config.mjs` from `targetDefaults.test.inputs` | 1 assertion RED | 1 failed / 13 passed, zero collateral | MATCH |
| M6 | remove `eslint.config.mjs` from `targetDefaults.lint.inputs` | 1 assertion RED AND G5 NC1 reproduces the stale HIT | 1 failed / 13 passed; NC1 read `Cache: 1/1 hit (100%)` across a real rule edit | MATCH, both halves |
| M7 | remove the global `ignores` block | NC2 reports two different `linted:` counts | 66 -> 159 linted files | MATCH |
| M8 | replace a described disable with a bare one | `require-description` errors | 1 error, severity 2, `@eslint-community/eslint-comments/require-description` | MATCH, LINT-05 LIVE |
| M9 | move a described disable one line off its violation | unused-directive AND the underlying rule error | 2 errors, both expected | MATCH, LINT-06 LIVE |
| **W1** (this audit) | narrow `files` back to the pre-ME-01 `**/*.spec.{ts,mts,cts}` | the 13 newly-covered unit shapes + the 6 integration-named shapes RED; the 3 pre-ME-01 shapes GREEN | **20 failed / 57 passed**: 13 width rows (`spec.{js,mjs,cjs,jsx,tsx}` + all 8 `test.*`), 6 still-banned rows, and `lint-scope-drift` leg 1. `spec.{ts,mts,cts}` and every pre-existing assertion GREEN | **MATCH**, zero collateral |
| **W2** (this audit) | = M4' above | -- | -- | see M4' |
| **W3** (this audit) | a reason whose ONLY `integration` token is a JS-family filename (`public-server.integration.spec.mjs`) | site 4's reason assertion RED under the widened strip | **1 failed / 71 passed**, exactly that assertion. With the OLD `[cm]?ts` strip restored and the same mutation in place: **71 passed / 71** -- silently accepted | **MATCH.** The widening is load-bearing, not cosmetic |

Every mutated file was restored and verified byte-identical with `git diff --exit-code`
(`eslint.config.mjs` x 3, `release-asset-name.spec.ts` x 1). **No mutation is committed.**

---

## 6. Manual-Only Verifications

| Behaviour | Requirement | Recorded | RE-VERIFIED at HEAD by this audit |
|---|---|---|---|
| `lint` re-runs after a RULE edit (G5 Measurement A) | LINT-04 (b) | `07-EVIDENCE.md:678-686`, base `81048ca` | **YES.** warm `0/1` -> baseline `1/1 hit (100%)` -> **P7 selector perturbed: `0/1 hit (0%)`** -> restored: `1/1 hit (100%)`. `git diff --exit-code` clean after restore |
| `lint` re-runs after a linted SOURCE edit (Measurement B) | LINT-04 (b) | `07-EVIDENCE.md:690-706`, including the CONFOUNDED first attempt and the rule it yielded ("the perturbed side must be run exactly ONCE") | not re-run; A and NC1 carry the requirement, and B's confound is honestly recorded |
| `test` re-runs after a rule edit (Measurement C) | LINT-04 / D-25 | `07-EVIDENCE.md:710-717` | not re-run. Its assertion half (M5) is a committed guard and passes at HEAD |
| **NC1 -- the declared input block is LOAD-BEARING** | LINT-04 (b) | `07-EVIDENCE.md:728-754`: with `eslint.config.mjs` removed from `lint.inputs`, a real rule change served `Cache: 1/1 hit (100%)` | not re-run (expensive, and it mutates `nx.json`). `targetDefaults.lint.inputs` is byte-identical to `81048ca`, so the measurement still describes the shipped config |
| NC2 -- lint scope must not depend on gitignored build output | LINT-04 / G3 | `07-EVIDENCE.md:756-772`: 66 / 66 across `rm -rf dist out-tsc` | not re-run; M7 (66 -> 159) proves the control can fail |
| M1-M9 | LINT-03/04/05/06 | `07-EVIDENCE.md:774-841` | M4 re-derived and re-run (section 5) |
| the five packages carry no `postinstall` | LINT-01 (V14) | `07-EVIDENCE.md:14-31`, five-row table, run BEFORE install | pre-install gate, not reproducible after the fact by design |
| **the reason ARGUES, not merely contains the word** | LINT-06 | see residual N-1 below | **not automatable.** Stays a human-review item |

**SC4 is satisfied.** ROADMAP SC4 requires LINT-04 be proven "by differential rather than by
reading the config". Measurement A reproduces on demand at HEAD with the exact `Cache:` lines on
both sides, and NC1 is the control that makes A mean something (A and B pass even with NO declared
input block, because `@nx/eslint`'s INFERRED inputs already contain the config file -- the record
states this plainly at `07-EVIDENCE.md:730-732` rather than claiming more than the measurement
supports).

---

## 7. Observed vs Predicted -- reconciliation

The contract was written before any code existed. Execution diverged in seven places. Six are
improvements and one was a defect the strategy itself contained.

| # | Predicted | What actually shipped | Assessment |
|---|---|---|---|
| R1 | LINT-01's "a `lint` target exists" needs **no test** -- "the battery command IS the assertion (D-34)" | **FALSIFIED by CR-01.** `nx run-many -t lint` with no matching target prints `No tasks were run` and EXITS 0. Deleting the four-line plugin registration left all 14 input probes green and the battery green. Now closed by two assertions the strategy did not ask for: the registration + target-name pins in `nx-target-inputs.spec.ts`, and ci.yml requiring the literal success line | the single worst prediction in the contract; corrected in code |
| R2 | D-19 invariants: (a) ESLint `files` == `ignores`, (b) `files` superset-of the integration include | **SUPERSEDED by ME-01.** (a) forced SYMMETRY between two globs that must be asymmetric, and had no term for the RUNNER at all -- so both globs sat narrower than the unit runner in lockstep and stayed green. The ban was silently OFF for `*.test.*`, `*.spec.tsx`, `*.spec.cjs`, `*.spec.js`, `*.spec.mjs`, `*.spec.jsx` for the whole of plans 07-01..07-04. Replaced by three mirrors of the REAL runner configs | the strategy's invariant WAS the hole. Closed in `a6af663` |
| R3 | REQUIREMENTS LINT-02 literally specifies `files: ['**/*.spec.{ts,mts,cts}']` | ME-01 widened it to `**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}` | the requirement's own RATIONALE ("mirroring its full extension set") is what ME-01 satisfied; its literal glob did not. A fourth received-wording correction, same class as the three at `07-EVIDENCE.md:961-972` |
| R4 | M4 targets the D-19 identity invariant | that assertion no longer exists | corrected: M4' in section 5 |
| R5 | LINT-05's `ban-ts-comment` assertions prove D-30's block is present | they do NOT. The plugin's DEFAULT options coincide with D-30's requested configuration, so three of the five stay green if the block is deleted. Recorded honestly at `07-EVIDENCE.md:229-237`; the `@ts-ignore`-described row WOULD fail if `'ts-ignore': true` were weakened | a WARNING on LINT-05's coverage, correctly self-reported by the executor rather than found here |
| R6 | LINT-01 SC1's "across the workspace" | `lint` is PROJECT-scoped (`eslint .` at `packages/github-cache`). `esbuild.action.mjs`, `start-cache-server/entry.ts`, `vitest.workspace.ts` and `.planning/spikes/*.mjs` are NOT linted | an intentional, comment-locked deviation (D-07). All 33 spec files and all four CORR-05 sites are inside scope, and it keeps the LINT-04 input set matched to the real lint scope, which is the direction that CLOSES the stale-PASS class. Accepted |
| R7 | one RED-proof spec file (NEW) covering LINT-02/03/05/06/CORR-06, D-19 folded in at discretion | TWO new files: `lint-rules.spec.ts` (behavioural, ESLint Node API) and `lint-scope-drift.spec.ts` (comparative, reads the real configs) | the split is right. They fail for different reasons and the flake fix had to be applied to both independently |

---

## 8. Gaps found by this audit, and how they were closed

### GAP-1 -- the ban's WIDTH was never asserted behaviourally (real, filled)

**Found by:** brief item 5, confirmed by reading the shipped assertions.

After ME-01 the ban covers 2 name families x 8 extensions = 16 unit path shapes, plus a
deliberate asymmetry at the `integration` name. The shipped assertions exercised **one** of them,
`*.spec.ts`, plus `*.integration.spec.ts`. The width was covered only two ways, neither of them a
re-running assertion about behaviour:

1. `lint-scope-drift.spec.ts` compares the globs as TEXT and deliberately drops the path anchor.
   Its own header defers the behavioural half to `lint-rules.spec.ts` -- a deferral that was only
   true for `.spec.ts`.
2. The ME-01 fix (`07-REVIEW-FIX.md:182-190`) and the security audit (`07-SECURITY.md:209`) each
   measured all eight extensions BY HAND and wrote the table down. A hand measurement in a
   markdown file does not re-run.

This is not a bookkeeping gap. Glob-text comparison structurally cannot see a per-extension
CONFIG INTERACTION, and one exists in this config: `*.spec.cjs` matches BOTH the `**/*.cjs`
override (which rewrites `sourceType` and turns a rule off) and the ban block, and the two
composing rather than colliding is a property of their ORDER in the exported array.

**Filled** by extending `packages/github-cache/src/lint-rules.spec.ts` with 25 rows generated
from four LITERAL lists (literal on purpose -- deriving them from `eslint.config.mjs` would make
the guard agree with whatever the config says):

- 16 rows: a platform read is CAUGHT at `*.{spec,test}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}`.
- 6 rows: still BANNED at `*.integration.spec.{js,mjs,cjs,jsx,tsx}` and `*.integration.test.ts`
  -- each of these runs as a UNIT test despite the name, which is exactly what ME-01's asymmetric
  `ignores` is for.
- 3 rows: EXEMPT at `*.integration.spec.{ts,mts,cts}`, asserted as `ruleIdsOf(messages)` equal to
  `['@typescript-eslint/no-explicit-any']` -- one assertion carrying both directions, because the
  non-ban rule firing proves the path was linted rather than silently unconfigured.

**Mutation-proven:** W1 (13 + 6 RED, zero collateral) and W2/M4' (5 RED). Section 5.

### GAP-2 -- the LINT-06 filename strip leaked the JS family (real, filled)

**Found by:** brief item 4 / security residual N-2, then MEASURED rather than accepted as stated.

N-2 says the HI-02 strip regex `\S+\.integration\.spec\.[cm]?ts` "covers `.ts`/`.cts`/`.mts`
only". Measured across all eight extensions, that is not quite right and the correction matters:
`.tsx` was never a hole (the pattern matches the `ts` inside `.tsx` and strips the token anyway,
leaving a stray `x`). The four that genuinely LEAKED are the JS family -- `.js`, `.mjs`, `.cjs`,
`.jsx` -- and ME-01 brought all four into the ban's `files` set, so they are real in-scope path
shapes rather than the theoretical case N-2 described.

**Filled** by widening the strip to `\S+\.integration\.spec\.\w+`. Keying it on the integration
runner's collect set was the wrong frame in the first place: the token being stripped is a
FILENAME QUOTED IN PROSE, and prose can cite any name -- including one whose file would NOT be an
integration spec, which is precisely the case where the reason misleads.

**Mutation-proven:** W3. A reason citing only `public-server.integration.spec.mjs` fails under
the widened strip (1 of 71) and passes silently under the old one (71 of 71).

### Considered and DECLINED as gaps

| Candidate | Why it is not a gap |
|---|---|
| No spec asserts on `.github/workflows/ci.yml`'s lint job | Deliberate. `ci.yml` is not an Nx `test` input, so a spec reading it would replay a cached PASS after an edit -- the exact stale-cache class this phase exists to close. PARITY-06 registers the file in Phase 9; adding the guard now would ship the defect to buy the coverage |
| No spec asserts the root `lint` npm script exists | Deleting it is not silent: CI's lint job runs `npm run lint` and npm exits non-zero on a missing script. A guard here would duplicate a gate that already fires |
| `cache: true` is not restated or asserted for `lint` | D-24, deliberate. It is inferred, and the differential in section 6 proves the target genuinely caches |
| The two indirect module-loading ceilings (computed dynamic import, `createRequire`) have no `EVASION_SHAPES` row | ME-03 declined this for a good reason: that table renders each row as "catches `<shape>`", so a row asserting nothing is caught reads as the opposite of what it means. Both are recorded as three-part ceiling comments at `eslint.config.mjs:340-364` |
| Cross-OS `lint` inference is unverified | Transferred BY DESIGN to Phase 8 CORR-03 (T-07-17 / T-07-22), with the six hashed node fields baselined at `07-EVIDENCE.md:498-523`. Not a Phase 7 coverage gap |
| A guard for `*.spec.jsx` / `*.test.tsx` files that do not exist | Covered anyway, and legitimately: the guard IS what keeps such a file from appearing with the ban off. That is the one case where covering a non-existent file family is not speculative |

---

## 9. Residual WARNINGs (non-blocking, carried forward)

| # | Residual | Severity | Disposition |
|---|---|---|---|
| N-1 | The LINT-06 reason guard enforces the WORD `integration` in surviving prose, not the ARGUMENT. Sites 1-3 argue "moving gains nothing" rather than "cannot move" | low | **Not automatable, and not attempted.** A lexical control cannot judge an argument; asserting harder prose shapes would be theatre. Stays a human-review item, on record at `07-REVIEW-FIX.md:298-301` as a decision about how strictly LINT-06 reads |
| W-1 | Three of the five `ban-ts-comment` assertions do not discriminate D-30's explicit block (the plugin defaults coincide) | low | Self-reported by the executor at `07-EVIDENCE.md:229-237`. The `@ts-ignore`-described row DOES discriminate `'ts-ignore': true`. No false claim is made in the spec |
| W-2 | `07-EVIDENCE.md:790`'s M4 row still names a deleted assertion | low | **Closed here rather than there.** Section 5 carries the correction, the re-derivation (M4') and the re-run of the original mutation against the shipped guard. The evidence file is left as the dated executor record it is |
| W-3 | `.planning/codebase/CONVENTIONS.md:316` still says ESLint is not configured | low | Deferred idea. Hand-editing one sentence of a generated snapshot leaves the rest equally stale while looking current |
| W-4 | Measurements B, C and NC1 were taken at `81048ca`, not re-run at HEAD | low | `targetDefaults.lint.inputs` is byte-identical to `81048ca`, so each still describes the shipped config. Measurement A WAS re-run, and it is the one that carries SC4 |

---

## 10. Wave 0 Requirements

- [x] the D-20/D-22 RED-proof spec -- `src/lint-rules.spec.ts` (LINT-02, LINT-03, LINT-05, LINT-06, CORR-06). RED observed 15 failed / 22 passed before the rules existed
- [x] the D-19 drift-guard assertions -- shipped as a SEPARATE file, `src/lint-scope-drift.spec.ts` (the discretion the contract allowed), and its invariants replaced by ME-01
- [x] `src/pinned-deps.spec.ts` -- five new `it()` blocks (LINT-01)
- [x] `src/nx-target-inputs.spec.ts` -- `lint` probes, the `test.inputs` ESLint assertion, and the registration pin CR-01 added

**Wave 0 is complete.** No framework install was needed; the only new capability was the ESLint
Node API, which needed the `eslint` devDependency and nothing else, exactly as predicted.

---

## 11. Validation Sign-Off

- [x] All tasks have `<automated>` verify or a Wave 0 dependency
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags (`vitest run` everywhere; `--skip-nx-cache` on every trusted signal)
- [x] Feedback latency < 300 s (battery ~2-4 min; inner loop ~6 s)
- [x] Every non-vacuous control from section 4 is present in the shipped assertions
- [x] M1-M9 applied, observed, recorded and reverted; M4 re-derived as M4'
- [x] G5 Measurements A, B, C recorded with their `Cache: n/m hit` lines; **A re-verified at HEAD**
- [x] Two genuine coverage gaps found, filled, and mutation-proven
- [x] Zero escalations. No implementation file modified: `eslint.config.mjs`, `nx.json`,
      `packages/github-cache/package.json` and `public-surface.spec.ts` all `git diff --exit-code`
      clean. All four CORR-05 violation sites intact
- [x] All NINE battery commands green from the repo root at this audit's commit
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** VALIDATED. Phase 7's Nyquist coverage is sufficient, with the two gaps above closed
and five residuals carried forward as WARNINGs, none blocking.
