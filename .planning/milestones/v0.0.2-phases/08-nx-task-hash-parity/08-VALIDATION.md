---
phase: 8
slug: nx-task-hash-parity
status: validated
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-28
audited: 2026-07-28
audit_base: 7bfe64f..HEAD
rows_total: 19
rows_resolved_to_a_real_test: 13
rows_closed_by_a_recorded_run_or_measurement: 6
gaps_filled: 2
gaps_open: 0
tests_added: 3
suite_at_audit: 574 passed / 574, 34 files
---

# Phase 8 -- Validation Strategy (post-execution)

> Per-phase validation contract for feedback sampling.
> Strategy derived from `08-RESEARCH.md` `## Validation Architecture`; every row below is now
> resolved against CODE at HEAD rather than against the plan that predicted it.

**What changed on 2026-07-28.** This file was a PRE-EXECUTION ledger -- `status: draft`, every row
`pending`, both flags false -- written before any code existed. `08-VERIFICATION.md`'s observation
O-03 flagged exactly that and was careful not to over-read it: the coverage largely EXISTED, so it
was an un-run `/gsd:validate-phase`, not a coverage hole. That reading is confirmed. Thirteen of the
nineteen rows resolve to a real, named, executed test; six close on a recorded run or measurement
that no unit test can reach. Two NAMED gaps were genuinely open and are now filled -- see
`## Gaps filled`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.10 via `@nx/vitest` (`testTargetName: "test"`) |
| **Config file** | `packages/github-cache/vitest.config.mts` (unit); `vitest.integration.config.mts` (integration) |
| **Quick run command** | `npx nx test @op-nx/github-cache` |
| **Full suite command** | `npm test` (`nx run-many -t test`) |
| **Measured at audit** | 574 passed / 574, 34 spec files, ~7s |
| **Comparator spec alone** | 37 passed / 37 (`compare.spec.ts`) |

Spec placement is co-located, always -- `foo.ts` + `foo.spec.ts` in the same directory. No `tests/`
tree. Cross-cutting drift guards live at the package-source root. [VERIFIED:
`.planning/codebase/TESTING.md:37-56`]

---

## Sampling Rate

- **After every task commit:** `npx nx test @op-nx/github-cache`
- **After every plan wave:** `npm test && npm run typecheck && npm run lint`
- **Before `/gsd:verify-work`:** full suite green, PLUS the two-leg job observed both GREEN and
  (via a deliberate fixture-level RED) demonstrably capable of failing -- D-22
- **Max feedback latency:** ~7s for the unit suite; one CI round-trip for the Live-CI items
- **Actual latency measured at audit:** 445ms for the two spec files this audit touched, 6.9s for
  the whole `test` target. Under the 60s sign-off bound with room to spare.

---

## Per-Task Verification Map

Every row cites the spec FILE and the TEST NAME that closes it, or names the recorded run /
measurement that does. `pending` no longer appears: a row either has a test that was executed, or a
stated reason why no local test can reach it.

### Rows closed by an executed unit test

| # | Requirement | Behaviour | Test (file : line -- name) | Automated Command | Status |
|---|-------------|-----------|----------------------------|-------------------|--------|
| 1 | CORR-03(a) | Fewer than two records FAILS | `compare.spec.ts:163` -- `FAILS with wrong-record-count for ${count} record(s)`, looped over 0 / 1 / 3 | `npx nx test @op-nx/github-cache` | green |
| 2 | CORR-03(a) | A record missing a target's hash FAILS | `compare.spec.ts:244` -- `... when one target entry is absent`; `:254` -- `... on an EMPTY hash string`; `:264` -- `... on an EMPTY nodes map (PARITY-02)` | same | green |
| 3 | CORR-03(a) | An EMPTY `targets` map FAILS (vacuity control, D-22) | `compare.spec.ts:229` -- `FAILS clause (a) on an EMPTY targets map -- the named vacuity control (D-22)` | same | green |
| 4 | CORR-03(b) | Matching `integration` hashes FAIL | `compare.spec.ts:280` -- `FAILS with integration-not-divergent when the two integration hashes MATCH` | same | green |
| 5 | CORR-03(c) | Differing `build` FAILS | `compare.spec.ts:347` -- `FAILS with invariant-target-diverged when \`build\` differs`, generated from `INVARIANT_TARGETS` | same | green |
| 6 | CORR-03(c) | Differing `typecheck` FAILS | same loop, `typecheck` iteration | same | green |
| 7 | CORR-03(c) | Differing `test` FAILS | same loop, `test` iteration | same | green |
| 8 | D-21 | Differing `lint` FAILS | same loop, `lint` iteration; membership pinned by `compare.spec.ts:549` -- `INVARIANT_TARGETS deep-equals the four that must be IDENTICAL` | same | green |
| 9 | CORR-03 | A genuinely-correct record pair PASSES (positive control) | `compare.spec.ts:142` -- `PASSES a genuinely-correct two-record pair and names both platforms` | same | green |
| 10 | PARITY-06 | `meta` completeness (every field non-empty when parsing) | `compare.spec.ts:569` -- `REQUIRED_META_KEYS deep-equals the seven D-04 fields`; the six `malformed-record` mutations at `:425` cover a missing `meta`, a missing `installMode` and an empty `graphState`; `:434` -- `names the record index and the offending path` | same | green |
| 11 | CORR-04 | `integration` is the only runtime-input target | `nx-target-inputs.spec.ts:354` -- `integration is still the only target with a platform runtime input` (iterates ALL `targetDefaults`, deep-equals `['integration']`); `:394` -- `integration declares exactly the byte-identical discriminator command`. **NEW:** `:441` / `:456` read the MERGED configuration -- see `## Gaps filled` | same | green |
| 12 | PARITY-07 | Public surface unchanged | `public-surface.spec.ts` (unmodified by this phase -- `git diff --name-only 7bfe64f..HEAD` over it, `src/index.ts` and `src/test/consumer-contract.ts` returns empty) plus the tarball exclusion asserted by `pack-check.cjs:112-115` feeding `:147-150` | `npx nx test @op-nx/github-cache` and `npm run pack:check` | green |
| 13 | T-08-03 | The `nx` specifier cannot widen unnoticed | **NEW:** `pinned-deps.spec.ts:150` -- `nx is pinned to an exact version in the workspace devDependencies, never a range (T-08-03)`. See `## Gaps filled` | `npx nx test @op-nx/github-cache` | green |

Rows 1-10 sit in the 37-test `compare.spec.ts`. Every negative there mutates exactly ONE field of a
pair that otherwise passes, which is what makes each isolate a single clause instead of co-firing
with its neighbours.

**Review fixes are in the map, per the audit brief.** Each of the four code findings landed
assertions, and they are the rows above plus these, all in `compare.spec.ts` and all green:

| Review finding | Assertions it added |
|---|---|
| WR-01 (the success line is forgeable from record content) | `:511` -- `reports ONE line, and the named reason, for ${label}`, over two vectors (a target KEY and `meta.os`); `:522` -- `still NAMES the offending target key, escaped rather than swallowed` |
| WR-03 (the seven `REQUIRED_META_KEYS` were never compared ACROSS the pair) | `:194` -- `FAILS with not-like-for-like when the legs measured DIFFERENT things`, driven from `LIKE_FOR_LIKE_META_KEYS`; `:214` -- the `nodeVersion` OVER-REACH control; `:585` -- the three-key pin plus the subset assertion; `:184` -- `duplicate-platform` |
| WR-04 (`discriminator.stdout` was required present, then never read) | `:302` -- `FAILS when both legs printed the SAME value but integration still diverged`; `:317` -- the clause-ORDERING control; `:331` -- the `stderr` over-reach control |
| WR-02 (the `typecheck`/`build` outputs overlap) | `nx.json` edit DECLINED on three stated grounds; the review's own sanctioned alternative taken -- the rationale is comment-locked at `nx-target-inputs.spec.ts:164-236` above the seven-entry pin at `:237` |
| WR-05 (`pack-check.cjs` called `process.exit()` immediately after writing) | No spec. Closed by `npm run pack:check` exiting 0 with the message intact, plus a recorded forced-failure probe (a bogus `REQUIRED` entry and a `README.md` leak predicate, then reverted) that showed exit 1 with BOTH problems and the full trailing paragraph present. `pack-check.cjs` is a root CJS script in the same no-spec class as `capture-hashes.mjs`; the residual is that the POSIX-pipe flush hazard is not observable from a Windows workstation |

### Rows that no local unit test can reach

These are NOT gaps and were not converted into tests. Per `TESTING.md`'s Live-CI first-push close
pattern, synthesizing them locally would require faking the exact thing under test and would produce
a false COVERED. Each closes on a recorded run.

| # | Requirement | Behaviour | Why no unit test | How it actually closed |
|---|-------------|-----------|------------------|------------------------|
| 14 | PARITY-02 | Instrument emits a non-empty `details.nodes` per target | `capture-hashes.mjs` deliberately carries NO spec (D-19: a spec importing an untyped root `.mjs` would not compile under `typecheck`) | Measurement M1/M2: 5 records, 428-444 node entries each, in both graph states at HEAD. The COMPARATOR half is unit-covered at `compare.spec.ts:264` -- an empty `nodes` map is `missing-target-hash` |
| 15 | PARITY-02 | Instrument's hash equals Nx's own | Same D-19 reason; and byte-equality against Nx is the substitute the decision names | Measurement M4: `nx run @op-nx/github-cache:build`, then `.nx/cache/run.json` -- `17776792307406644378`, byte-identical to the instrument's value at HEAD |
| 16 | PARITY-01 | Node-by-node root-cause record predates the fix | D-06 explicitly declines a programmatic mtime guard | `git log --oneline 7bfe64f..eeace53 -- nx.json` returns ZERO commits; re-run independently by both the verifier and the security audit (T-08-17, T-08-18) |
| 17 | PARITY-03 / PARITY-05 | Byte-identical at three observation points; `integration` identical workstation vs `windows-11-arm` | No Linux leg, and no hosted runner is a developer workstation | Run `30367663950` at `e84fcb4`: both legs `success`, artifacts downloaded and compared field by field. `build`/`typecheck`/`test`/`lint` byte-identical across legs AND equal to the workstation readings taken at `9f5138c`; `integration` divergent (`4975009469470580751` vs `14358488692745251710`) |
| 18 | PARITY-04 | Warm-local vs cold-CI, as its own named question | Requires both a local box and a CI record at the same commit | `08-ROOT-CAUSE.md`'s dedicated "Q2, and only Q2" section: NO on 5/5 at the anchor, YES on 5/5 post-fix. M2 proves the cold recipe does not reset (`.nx/workspace-data` at 18 entries before AND after) |
| 19 | CORR-03 | The gate actually gates -- observed RED on a REAL leg (D-22) | A fixture RED is not a real-leg RED, and faking one is the thing under test | Baseline GREEN `30355822956` -> RED `30356229082` (`hash-parity-compare` conclusion `failure`, verbatim message) -> GREEN after a byte-for-byte revert `30356937751`. `git diff 6260496~1 65a2e13 -- nx.json` is EMPTY, so no mutated tree persists. The one-record case was ALSO seen live (`30357290164`, windows leg `failure`), and run `30358020343` proved the invariant survives a full hash rotation |

---

## Wave 0 Requirements

- [x] `packages/github-cache/src/hash-parity/compare.spec.ts` -- all nine comparator cases, and 28
      more besides (37 total, covering all 8 named failure reasons)
- [x] Fixture records as inline TypeScript objects -- `leg()` / `validPair()` at `compare.spec.ts:68`
      and `:114`, built FROM `EXPECTED_TARGETS` so a fixture can never be short a target the
      comparator asserts on. Inline in the spec, so they are covered by the `default` named input
      (`{projectRoot}/**/*`) and cannot serve a stale cached PASS
- [x] `!dist/hash-parity` in `packages/github-cache/package.json` `files` (`:31`, correctly ordered
      AFTER `"dist"` at `:27`), PLUS the matching `pack-check.cjs` forbidden-list entry
      (`:112-115` feeding the derived predicate at `:147-150`). `npm run pack:check` exits 0 and
      names `dist/hash-parity` as excluded, so the exclusion is ASSERTED, not merely declared
- [x] No framework install needed -- `package-lock.json` is absent from the phase-8 diff

**Wave 0 is complete.** All three MISSING references from the pre-execution ledger now exist and are
executed by `npx nx test @op-nx/github-cache` / `npm run pack:check`.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Outcome |
|----------|-------------|------------|---------|
| Windows workstation COLD hash, all five targets | PARITY-03, PARITY-05 | No hosted runner is a developer workstation | DONE (M2). **The instruction in the pre-execution ledger was WRONG and is corrected here:** it said `npx nx reset`, which PARITY-04 and D-08 explicitly forbid as a substitute. What was actually executed redirects `NX_WORKSPACE_DATA_DIRECTORY` to a scratch path, leaving `.nx/workspace-data` at 18 entries before AND after -- a cold READING without a reset |
| Windows workstation WARM hash, all five targets | PARITY-03, PARITY-04 | Same | DONE (M1). 5 records, full `meta` block on each |
| Does a warm local box compute the hash cold CI published? | PARITY-04 | Requires both a local box and a CI record for the same commit | DONE. Recorded as Q2 and only Q2, with the answer moving NO 5/5 -> YES 5/5. M3 adds both workstation graph states at HEAD: zero differing nodes on all five targets, 164/164 identical `projectConfiguration` fields |
| Which `typecheck` outputs list is correct (7-entry vs 1-entry) | Research A6 | Must be checked against what `tsc --build tsconfig.json --emitDeclarationOnly` actually writes, before pinning either | DONE by enumeration on a cleaned tree: 136 emitted files. The seven-entry list covers 136 of 136; the one-entry list covers 0 of 136. Pinned by deep equality at `nx-target-inputs.spec.ts:237`, with the D-13 rationale comment-locked at `:164-236` because `nx.json` is strict JSON |

## Live-CI First-Push Closures

All four are CLOSED, by real runs rather than by an invented test. Run IDs recorded so the closure is
checkable:

- [x] The `ubuntu-24.04-arm` and `windows-11-arm` observation points (PARITY-03, PARITY-05) --
      run `30367663950` at `e84fcb4`, both legs `success`, both artifacts downloaded and compared
      field by field
- [x] The two-leg comparison itself (CORR-03) -- `hash-parity-compare` `success` in the same run,
      and the CURRENT comparator additionally re-run over the REAL `3fff526` leg records (M6,
      `ok: true`) so the two clauses added by review do not reject a healthy pair
- [x] The gate's ability to fail on a real leg, as distinct from a fixture (CORR-03, D-22) --
      RED `30356229082` between GREEN `30355822956` and GREEN-after-revert `30356937751`
- [x] Whether `lint` diverges cross-OS -- no research could settle it, only the runner. It does NOT:
      measured byte-identical on both legs, so D-21's PRIMARY branch was taken and `lint` is a full
      member of `INVARIANT_TARGETS` (`compare.ts:60-65`), downgraded to nothing and deleted from
      nothing

---

## Gaps filled

Two coverage gaps were genuinely open. Both were NAMED by the security audit rather than found here,
and both were fillable as unit tests, so both were filled. Per D-22 and Phase 7's two recorded
lessons ("prove a guard can fail before trusting it"; "the vacuity mutation, distinct from the
deletion mutation"), each new assertion was mutated until it went RED on exactly the intended line,
then the mutation was reverted byte-for-byte.

### NF-02 -- the CORR-04 guards read `nx.json`, and `project.json` can override it

**The hole.** `packages/github-cache/project.json` exists and declares the `integration` target with
`command` and `options` only -- no `inputs` key -- so `targetDefaults.integration.inputs` does apply
today and the discriminator is live. But all three reads that assert it
(`nx-target-inputs.spec.ts:354`, `:394`, and the instrument's `readDiscriminatorCommand` at
`capture-hashes.mjs:220-239`) read `nx.json`'s `targetDefaults`, never the MERGED project
configuration. A target key declared in `project.json` REPLACES the default's key wholesale, so
adding an `"inputs"` array there would drop the platform discriminator out of the effective hash
while all three reads stayed GREEN. That is a WRONG RESULT, not a miss: with the discriminator gone
`integration` becomes OS-invariant and a Linux-computed `integration` result becomes restorable on
Windows. CI catches it (`compare.ts`'s `integration-not-divergent` clause, on a job with no
`continue-on-error`), so the signal arrived LATE rather than never.

**Added.** `packages/github-cache/src/nx-target-inputs.spec.ts`, commit `f778dab`:

- `:441` -- `keeps the byte-identical discriminator once project.json is merged over targetDefaults`
- `:456` -- `DROPS the discriminator when project.json declares its own inputs, proving the merge merges`

The merge is delegated to Nx's OWN `readTargetDefaultsForTarget` + `mergeTargetConfigurations` pair
rather than hand-rolling a "does `project.json` declare inputs" check. A hand-rolled check would
assert the SPELLING of one particular way to break it, and would go red on a `project.json` that
declared an inputs list CARRYING the discriminator -- a legitimate configuration. `integration` is
declared, never plugin-inferred, so those two layers are the whole merge for this target. Reading
`project.json` from a spec is safe for the same reason reading `nx.json` is: it is a `test` input,
here via `default` -> `{projectRoot}/**/*`, because the file sits at the project root.

**Proven able to fail, both axes:**

| Axis | Mutation | Observed |
|---|---|---|
| Deletion | Add `"inputs": ["default"]` to `project.json`'s `integration` target -- the exact NF-02 attack | `:441` RED: `expected [] to deeply equal [ 'node -p process.platform' ]`. 1 failed / 20 passed -- and BOTH pre-existing CORR-04 guards (`:354`, `:394`) stayed GREEN. That green pair IS the hole, demonstrated live rather than argued. Reverted; `git status` clean on the file |
| Vacuity | Reverse the two arguments to `mergeTargetConfigurations`, so the default wins over the project layer | `:456` RED: `expected [ 'node -p process.platform' ] to deeply equal []`, while `:441` stayed GREEN on a merge that never consulted `project.json`. That is precisely the false pass the control exists to catch. Reverted |

### NF-01 -- `pinned-deps.spec.ts` did not pin `nx`

**The hole.** T-08-03 accepted the risk of `capture-hashes.mjs` statically importing six `nx/src/*`
internal subpaths -- paths with no semver guarantee -- on the stated basis that "`nx` is exact-pinned
at 23.1.0 and `pinned-deps.spec.ts` fails the build if a specifier widens". The first half was true
(`package.json:40`). The second half was false: the guard asserted ten specifiers and `nx` was not
among them, so widening `"nx": "23.1.0"` to `"^23.1.0"` failed no test. An accepted risk resting on a
guard that does not exist is the weakest kind of accepted risk. Low severity rather than a live hole,
because `package-lock.json` still pins the resolved version and `npm ci` honours it, so a widened
range only bites on a lockfile regeneration.

**Added.** `packages/github-cache/src/pinned-deps.spec.ts:150`, commit `71e3061` --
`nx is pinned to an exact version in the workspace devDependencies, never a range (T-08-03)`.

**Proven able to fail, both axes:**

| Axis | Mutation | Observed |
|---|---|---|
| Widening | `"nx": "23.1.0"` -> `"^23.1.0"` in the root manifest | RED: `expected '^23.1.0' to match /^\d+\.\d+\.\d+$/`. 1 failed / 11 passed -- only the new assertion. Reverted |
| Vacuity | Rename the key so the specifier is absent entirely | RED: `.toMatch() expects to receive a string, but got undefined`. An absent dependency is a hard fail, not a silent pass. Reverted |

### What was deliberately NOT converted into a test

- **`capture-hashes.mjs` has no spec, by decision D-19** -- a spec importing an untyped root `.mjs`
  would not compile under `typecheck`. Its correctness is established by byte-equality against Nx's
  own hash (M4) instead. Not "fixed".
- **The two runner observation points, the two-leg comparison, and the gate's real-leg RED** are not
  locally reachable. They are closed by the runs listed above. Faking them would produce a false
  COVERED.
- **`08-VERIFICATION.md`'s O-01 and O-02** are bounded observations, not requirement gaps. O-01 (a
  SIXTH target becoming OS-sensitive without declaring a `runtime` input) is outside CORR-03's
  explicitly-named target list, and the declaring half is already caught by
  `nx-target-inputs.spec.ts:354`; `compare.spec.ts:539` deep-equality-pins `EXPECTED_TARGETS` to the
  instrument's list so the two cannot drift silently. O-02 (`" "` literally satisfies clause (a)'s
  "non-empty") is unreachable from the instrument, which writes Nx's decimal hash.
- **`08-SECURITY.md`'s NF-04** (the loader's `error.message` print bypasses `fail()`'s CR/LF
  collapse) is an implementation hardening, not a coverage gap. There is no green assertion to write:
  the residual is an unpinned dependency on V8's snippet width, and the one-line fix would modify
  implementation, which this audit does not do. Recorded, not manufactured.
- **NF-03** (whether a red `hash-parity-compare` actually BLOCKS a merge) is a base-branch
  required-status-check setting with no in-repo representation. Not testable from the tree.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or a stated Live-CI / measurement closure
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references -- all three exist and run
- [x] No watch-mode flags (`vitest run` / `nx test`, never `--watch`)
- [x] Feedback latency < 60s -- measured 6.9s for the whole `test` target
- [x] `nyquist_compliant: true` set in frontmatter

**Battery at audit, all green:** `format:check`, `build`, `typecheck`, `typecheck:action`, `test`
(574/574), `lint`, `fallow:ci`, `check:action`, `pack:check`.

**Approval:** validated 2026-07-28. 19/19 rows resolved -- 13 to an executed test, 6 to a recorded
run or measurement with the reason no test can reach them. 2 gaps filled, 3 tests added, 0 gaps open.

---

_Audited: 2026-07-28_
_Auditor: Claude (gsd-nyquist-auditor)_
