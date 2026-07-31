---
phase: 12
slug: windows-ci-reuse-o4-consumer-recipe
status: passed
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-30
audited_at: 2026-07-31
auditor: gsd-nyquist-auditor
audited_tree: 0063676
branch: gsd/v0.0.2-os-invariant-cross-os-sharing
requirements_total: 4
rows_total: 13
rows_green: 8
rows_manual_closed: 4
rows_deferred: 1
rows_still_open: 0
gaps_found: 1
gaps_filled: 1
gaps_escalated: 0
tests_before: 899 unit / 15 integration
tests_after: 900 unit / 15 integration
---

# Phase 12 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `12-RESEARCH.md` `## Validation Architecture`. Task IDs are filled in after
> planning; the requirement-level map below is authoritative until then.
> `/gsd:validate-phase` audits and closes the remaining rows after execution -- see
> `## Validation Audit 2026-07-31`.

**Status glyphs are ASCII by project rule** (`CLAUDE.md`: no emoji or non-ASCII in any output).
`pending` / `green` / `red` / `flaky` / `manual-closed`. The machine-readable state lives in the
frontmatter.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest via `@nx/vitest` (inferred `test` target, `testTargetName: "test"`) |
| **Config file** | `packages/github-cache/vitest.config.mts` (unit); `vitest.integration.config.mts` (integration) |
| **Quick run command** | `npx nx run @op-nx/github-cache:test --skip-nx-cache` |
| **Full suite command** | `npm run test` (`nx run-many -t test`) |
| **Estimated runtime** | ~4 seconds (plan time: 3.8 s cold, 2026-07-30, win32/arm64) |
| **Plan-time baseline** | 40 test files / 856 tests, all passing on win32/arm64 |
| **MEASURED post-execution** | **42 test files / 900 tests**, `test` 3.4 s cold; `integration` 3 files / 15 tests, 2.3 s. Both measured this audit on win32/arm64 at `0063676` |

The plan-time baseline is retained above as the contract's original figure; it is NOT the
post-execution measurement. The phase added 44 unit tests (856 -> 900): 24 Windows-leg clauses
(12-01), 9 detector clauses (12-01), 10 doc-guard + registration clauses (12-05), and this audit's
1 mask-ordering clause.

---

## Sampling Rate

- **After every task commit:** Run `npx nx run @op-nx/github-cache:test`
- **After every plan wave:** Run `npm run test && npm run typecheck && npm run lint && npx nx format:check --all`
- **Before `/gsd:verify-work`:** Full suite must be green, plus `npm run check:action` from the MAIN
  working tree -- never from a junctioned worktree, where esbuild rewrites 689 module paths and
  produces a false drift verdict with no source edit.
- **Max feedback latency:** 5 seconds (MEASURED this audit: `test` 3.4 s, `integration` 2.3 s)

---

## The honest constraint, stated before the map

Three of this phase's four requirements are **not Vitest-testable by construction**:

- **XOS-05's HIT** is a property of the GitHub Actions cache service observed in a runner log. No
  spec can produce it. REQUIREMENTS.md and ROADMAP both say so (`Live-CI close`).
- **XOS-04 / XOS-08's EFFECT** (that the Windows leg actually reuses the ubuntu artifact) is the
  same observation.
- **DOCS-07's QUALITY** (is the recipe correct and safe?) is a review judgement, not an assertion.

What IS mechanically testable is the **shape** of each: that the jobs exist with the right
`runs-on` / `needs:`, that the doc exists and renders the single-sourced literal, that the
discriminator is registered exactly once, and that the doc is an `nx.json` `test` input so the guard
cannot replay a stale pass.

Proposing specs for the unobservable half would manufacture false coverage -- the exact defect
`08-ROOT-CAUSE.md:2056` names ("a textual assertion that `nx.json` CONTAINS the discriminator does
NOT satisfy CORR-03").

**This constraint held.** The post-execution audit wrote no spec for any unobservable half. The
three unobservable rows closed on LIVE OBSERVATIONS re-measured independently by this audit (see
`## Manual-Only Verifications`), not on substitute assertions.

---

## Per-Requirement Verification Map

Task IDs are assigned at planning time; this map binds each requirement to its verification shape
so the planner cannot silently drop one. `Status` is the post-execution measurement.

| Req | Behavior | Threat Ref | Test Type | Automated Command | File Exists | Status |
|-----|----------|-----------|-----------|-------------------|-------------|--------|
| XOS-04 | `ci.yml` declares `build-windows` / `typecheck-windows` / `test-windows`, each `runs-on: windows-11-arm` | -- | unit (YAML shape) | `npx nx run @op-nx/github-cache:test -- -t "windows"` | `dogfood-cross-os.spec.ts:694`, `:791`, `:863` (24 clauses, jobs at `ci.yml:434`, `:484`, `:534`) | **green** |
| XOS-08 | each Windows job declares `needs:` on exactly its one ubuntu counterpart | -- | unit (YAML shape) | same spec | `dogfood-cross-os.spec.ts:722`, `:815`, `:887` -- bare-scalar regex `/^ {4}needs: <producer>$/m` | **green** |
| XOS-08 | sidecar block byte-identical across all seven wired jobs | -- | unit (optional) | -- | **DEFERRED by CONTEXT** (`12-CONTEXT.md:614`) -- the block drift guard is an explicit Deferred Idea. Do NOT add it | n/a |
| XOS-05 | the Windows legs log `[remote cache]` for all three targets | -- | **live-CI only** | none -- read the run log, count OCCURRENCES per leg | n/a | **manual-closed** -- run `30586177358`, attempt 1, `event=pull_request`, `headSha=e757d4c`. Re-counted by this audit from each leg's own log: `build-windows` 1, `typecheck-windows` 2, `test-windows` 1 (total 4); ubuntu `build`/`typecheck`/`test` 0/0/0 |
| XOS-05 | the write decision + attribution loss recorded alongside TRUST-11/12 | T-12 (see `12-RESEARCH.md` `## Security Domain`) | doc artifact | none -- a `.planning/**` edit, not an Nx input, correctly ungated | `10-SECURITY.md` `### Q1 (TRUST-11)` | **green** (doc-verified) -- located this audit with counts: `PHASE 12 RE-PRICING` 1, `Leg A --` 2, `Leg B --` 2, `second producer` 1, `removes the concurrent race` 1, `DERIVED` 1; negative control 0 |
| XOS-05 | detector workflow exists, is `windows-11-arm`, uses `--skip-nx-cache`, demands the success LINE | -- | unit (YAML shape) | `npx nx run @op-nx/github-cache:test -- -t "detector"` | `windows-regression-detector.spec.ts:74` (9 clauses); workflow at `:35` cron, `:50` `contents: read`, `:59` runner, `:118` flag | **green** |
| XOS-05 | the detector actually goes green on a `windows-11-arm` runner | -- | **live-CI, POST-MERGE** | `workflow_dispatch` once the file reaches `main` | n/a | **manual-closed** -- run `30603713356`, `event=workflow_dispatch`, job `detect` success on label `windows-11-arm`. Re-read by this audit: the plural needle appears as genuine Nx output, and `[remote cache]` occurs **0** times, so the targets EXECUTED |
| DOCS-07 | `docs/cross-os.md` exists and is an `nx.json` `test` input | -- | unit | `npx nx run @op-nx/github-cache:test -- -t "cross-os"` | `docs-cross-os.spec.ts:95`; `nx.json:63`; pin at `nx-target-inputs.spec.ts:793` | **green** -- registration proven EFFECTIVE by execution, not by reading `nx.json` (see audit RE-1) |
| DOCS-07 | safe default FIRST, portability checklist SECOND | -- | unit (ordered index assertion, phrase-keyed) | same | `docs-cross-os.spec.ts:153` (index compare, both `>= 0` pre-guarded) and `:171` (first numbered heading) | **green** |
| DOCS-07 | the doc names architecture AND libc, and states this repo cannot exercise either | -- | unit (phrase-keyed, COUNT-asserted) | same | `docs-cross-os.spec.ts:188` -- anchored same-sentence regex, not three `toContain`s; `:200` pins the checklist at exactly 5 items | **green** |
| DOCS-07 | the doc renders the exact discriminator literal `nx.json` declares | -- | unit (single-sourced equality, `docs-trust.spec.ts` shape) | same | `docs-cross-os.spec.ts:140-148` -- `RENDERED_DISCRIMINATOR_SITES = 4`, exact `toBe(4)`, literal read FROM `nx.json` and never re-spelled | **green** |
| DOCS-07 | `nx.json` declares exactly ONE runtime input and it is the new literal | -- | unit | `npx nx run @op-nx/github-cache:test -- -t "discriminator"` | `nx-target-inputs.spec.ts:445` and `:491`, both `toEqual` (not `toContain`), against `nx.json:106` | **green** |
| DOCS-07 (U-01) | the new command's raw stdout AND stderr, per OS, on real runners | -- | **live-CI, but FREE** | already wired -- `capture-hashes.mjs` reads the command out of `nx.json` and records both streams | n/a -- no new instrument needed | **manual-closed** -- both artifacts from run `30586177358` downloaded and read by this audit. Both legs record the HARDENED command, `stderr` length **0** on both, `stdout` `linux\n` vs `win32\n`. RESEARCH assumption **A1 is CLOSED by measurement, not by inference** |

*Status: pending / green / red / flaky / manual-closed*

---

## Wave 0 Requirements

- [x] `ci.yml` Windows-job shape assertions -- extended
      `packages/github-cache/src/dogfood-cross-os.spec.ts`. LANDED at `:694`, `:791`, `:863`;
      24 clauses, every one indent-anchored (`^ {4}` job keys, `^ {6}` step children) and scoped to
      `jobBlock(<leg>)`. `ci.yml` was already a `test` input (`nx.json:70`).
- [x] Detector-workflow shape assertions -- new file
      `packages/github-cache/src/windows-regression-detector.spec.ts:74`, 9 clauses, comment-stripped
      read, existence control asserted FIRST so the two absence clauses are non-vacuous.
- [x] **`nx.json` `test` input registration for the new detector workflow file** -- landed at
      `nx.json:71` in commit `91dbdc1`, the SAME commit as the guard. Registration proven
      EFFECTIVE by execution this audit (audit RE-2), not merely present in the file.
- [x] **`nx.json` `test` input registration for `docs/cross-os.md`** -- landed at `nx.json:63` in
      commit `6c0c2d1`, the same commit as the doc. Proven EFFECTIVE by execution (audit RE-1).
- [x] `docs/cross-os.md` drift guard -- new file
      `packages/github-cache/src/docs-cross-os.spec.ts` (9 clauses), single-sourced from `nx.json`.
- [x] Updated the two discriminator literals in `nx-target-inputs.spec.ts` (now `:445`, `:491`) and
      the fixture in `hash-parity/compare.spec.ts`. Both pins kept `toEqual`, so a SECOND runtime
      entry reddens too.
- [x] Framework install: **none needed** -- confirmed, zero commits touch `package.json` or
      `package-lock.json` in the phase range.

**Every new guard must be OBSERVED RED before it is trusted** -- mutate the thing it asserts on,
confirm the named assertion fails with the right cause, revert. Two standing traps from Phase 11:
a phrase occurring TWICE is only half-locked (`toContain` stops at the first occurrence -- assert a
COUNT or key on a phrase measured unique), and a predicted-only redness is not evidence.

**Discharged, and INDEPENDENTLY re-run rather than inherited.** The phase recorded its own reds
during execution; this audit did not take them on trust. Eight fresh mutations were applied to the
real artifacts, run, and reverted -- see `## Validation Audit 2026-07-31`.

---

## Manual-Only Verifications

All three rows are **CLOSED**. Each was re-measured by this audit from the primary source (the
GitHub API and the run artifacts), not read out of `12-UAT.md`.

| Behavior | Requirement | Why Manual | Closing evidence |
|----------|-------------|------------|------------------|
| The three Windows legs log `[remote cache]` against ubuntu-saved entries | XOS-05 | A property of the GitHub Actions cache service across two jobs; no in-process spec can observe it | **CLOSED.** Run `30586177358`, `attempt: 1`, `event: pull_request`, `headSha: e757d4c` -- verified via `gh run view --json attempt,event,headSha`, so D-18's first-run-never-a-re-run condition holds. Per-leg counts re-derived by this audit from each job's OWN log (`gh api .../jobs/<id>/logs`): `build-windows` **1**, `typecheck-windows` **2**, `test-windows` **1**; ubuntu `build`/`typecheck`/`test` all **0**. Matches the pre-registered 1/2/1 exactly, and the 1:1 per-target mirror is what attributes each restore to an in-run ubuntu producer. **Count per leg, never run-wide** -- a whole-run count returns 6, the two extras being the echoed shell command in the `integration` legs |
| The detector goes green on a real `windows-11-arm` runner | XOS-05 | `workflow_dispatch` only fires for workflow files present on the DEFAULT branch, so a new file cannot be dispatched pre-merge | **CLOSED.** Run `30603713356`, `event: workflow_dispatch`, job `detect` success, runner label `windows-11-arm` (confirmed via the jobs REST payload). The gate is the printed LINE and it is genuine Nx output, not the echoed `grep -q` line that also carries it -- both occurrences located, one at the command echo and one at ` NX   Successfully ran targets build, typecheck, test for project @op-nx/github-cache`. Non-vacuity holds: **0** `[remote cache]` markers in the whole log, so all three targets EXECUTED. The pre-merge block was cleared by an operator-approved temporary `main` placement with a verified backup-and-restore, so the documented constraint is CONFIRMED rather than circumvented |
| The recipe is correct and safe for a consumer to copy | DOCS-07 | A review judgement about prose, not an assertion | **CLOSED by review, as designed.** `/gsd:code-review` found CR-01 (BLOCKER): section 1's only copy-pasteable snippet declared the discriminator on ONE target while its heading said "every cacheable target". Fixed at `2f9f567` and now MECHANIZED -- `docs-cross-os.spec.ts:140` pins `RENDERED_DISCRIMINATOR_SITES = 4` with an exact `toBe`, and a count of 2 IS the CR-01 regression. `12-UAT.md` test 4 additionally re-checked every independently verifiable doc claim against the repository. This is the case the guard proved the doc SAYS the right things and only review proved it MEANS them |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or a recorded manual-only justification -- 8 of 13 rows
      close on an automated command, 4 on a live observation recorded in the table above, and 1 is
      the explicitly DEFERRED block-drift guard.
- [x] Sampling continuity: no 3 consecutive tasks without automated verify -- checked row by row;
      the longest run of non-automated rows is 2.
- [x] Wave 0 covers all MISSING references -- all 7 Wave 0 items confirmed landed and RUN this audit.
- [x] No watch-mode flags -- every command in this file is `--skip-nx-cache` or a plain target run.
      `nx.json` configures `@nx/vitest` with `testMode: "watch"`, so `CI=true` is what makes the
      inferred target run once on a workstation; `CI` is not a `test` input, so it does not perturb
      the hash.
- [x] Feedback latency < 5s -- MEASURED this audit: `test` 3.4 s cold, `integration` 2.3 s.
- [x] Every new guard OBSERVED red before green -- 8 independent mutations this audit, each with a
      distinct named cause, each reverted to a clean tree.
- [x] No guard can replay a stale cached PASS -- PROVEN BY EXECUTION for both non-project inputs,
      not by reading `nx.json` (audit RE-1, RE-2).
- [x] No absence guard uses a negated matcher inside `toHaveBeenCalledWith` -- swept this audit; the
      single hit is a COMMENT in `publish-mirror.spec.ts:604` explaining why that shape is not used.
      Zero live violations.
- [x] No phrase-containment guard added by this phase is half-locked -- swept this audit. The only
      live `toContain` on a phrase is `windows-regression-detector.spec.ts:163` (`NO_COLOR`),
      MEASURED at exactly 1 occurrence in the comment-stripped workflow. Every other count-sensitive
      claim uses an exact `toBe`/`toHaveLength`.
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** passed (2026-07-31 post-execution audit)

---

## Validation Audit 2026-07-31

**Auditor:** gsd-nyquist-auditor. **Audited tree:** `0063676` on
`gsd/v0.0.2-os-invariant-cross-os-sharing` (`.git` is a directory -- confirmed MAIN tree, so
`npm run check:action` is trustworthy here). **Method:** starting hypothesis for every row was
UNCOVERED. No row was closed on a SUMMARY's, a VERIFICATION's or the UAT's claim; each was closed by
reading the cited harness, running its command, and -- for the automatable rows -- mutating its
subject and watching the named assertion fail.

| Gaps found | 1 | Resolved | 1 | Escalated | 0 |

### The gap: `ci.yml`'s `::add-mask::` ordering was a deleted control that still looked present

`12-SECURITY.md` `## Residual 1` names it and this audit confirmed it independently: **8 executable
`::add-mask::` sites in `ci.yml`, and zero specs asserting the ordering for `ci.yml` itself.** The
only `add-mask` assertion in `packages/github-cache/src/` was `docs-adoption.spec.ts:111`, which
pins the DOCUMENTED snippet in an adoption doc, not the workflow.

It is a genuine Phase 12 gap rather than inherited surface: Phase 11's audit logged it as
PRE-EXISTING at five sites, and **this phase took the file to eight** by copying the sidecar block
onto the three new Windows legs. Three of the eight are Phase 12's. The `cacheClient` clause this
phase added (`dogfood-cross-os.spec.ts:770-782`) pins the two `$GITHUB_ENV` WRITE lines per leg but
not the mask line that must precede them -- so deleting or moving the mask left all 24 Windows-leg
clauses green while a bearer token reached `$GITHUB_ENV` unredacted on a PUBLIC repository.

**FILLED** at `packages/github-cache/src/dogfood-cross-os.spec.ts:977-1018`
(`describe('ci.yml masks the sidecar token before writing it (T-12-05)')`). Shape:

- Whole-file and PAIRWISE, deliberately NOT `jobBlock`-scoped. The usual scoping rule exists because
  a file-wide containment is vacuous; a pairwise ordering with count equality is the STRONGER claim
  -- it covers all eight pairs including the five pre-existing sites a three-leg version would leave
  exactly as unguarded as they are today, and it cannot be satisfied by an unrelated occurrence.
- Two POSITIVE CONTROLS FIRST. Two empty arrays are trivially equal in length and trivially
  pairwise-ordered, so without them the ordering assertion passes against a `ci.yml` that masks
  nothing at all.
- `MASKED_TOKEN_SITES = 8`, an exact `toHaveLength`, never a `>= 1` floor -- the half-locking defect
  WR-09 and CR-01 both landed on in this phase.
- Reads the comment-stripped `codeLines`, which is load-bearing: `ci.yml` mentions `::add-mask::` in
  three prose comments, so a raw read would count 11 and the pairing would be garbage.

**This does NOT reopen the deferred block-drift guard** (`12-CONTEXT.md:614`). That idea is a
byte-identity guard over the whole duplicated sidecar block; this is a two-line ordering invariant on
one mask/write pair, handed over by name in `12-SECURITY.md`'s Residual 1 with this exact shape and
this exact owner ("whichever phase next touches a sidecar block").

### OBSERVED RED -- eight mutations, applied to the real artifacts and reverted

Each mutation was applied to the shipped file, the filtered suite run, the failure transcribed, and
the file restored with `git checkout -- <one file>`. `git status --porcelain` was confirmed to carry
nothing but the new spec after every revert. The DISCRIMINATION is the evidence, not the bare
failure -- each row records how many of the selected tests reddened.

| # | Mutation | Subject | Reddened | Verdict |
|---|---|---|---|---|
| 1 | `needs: build` -> `needs: [build]` on `build-windows` | `ci.yml` | 1 of 63 | XOS-08's bare-scalar clause, that leg only; the other two legs stayed green, so the guard discriminates per leg |
| 2 | `runs-on: windows-11-arm` -> `ubuntu-24.04-arm` on `test-windows` | `ci.yml` | 1 of 63 | XOS-04's CONSUMER-half clause. Proves the anchoring claim: `windows-11-arm` occurs 10 times comment-stripped, so an unanchored guard would have stayed green |
| 3 | `grep -q '<needle>' detector.log` -> `grep '<needle>' detector.log \|\| true` | `windows-regression-detector.yml` | 1 of 9 | The needle SURVIVES and the GATE is deleted -- the "deleted control that still looks present" trap. WR-05's fix is real; a `toContain` would have passed |
| 4 | one of four rendered discriminators de-hardened, verification fence only | `docs/cross-os.md` | 1 of 13 | `expected 3 to be 4`. A `>= 1` floor accepts this mutation; the exact count rejects it. Confirms the CR-01/WR-09 conversion was load-bearing rather than tidy |
| 5 | `nx.json` discriminator reverted to the un-hardened spelling | `nx.json` | 3 of 22 | BOTH `toEqual` pins in `nx-target-inputs.spec.ts` plus the doc's single-sourced equality (which went to 0, since the doc still rendered the hardened form). DOCS-07's stderr-immunity clause is triangulated, not single-sourced-to-itself |
| 6 | section 1 and section 2 headings swapped | `docs/cross-os.md` | 3 of 13 | D-11's order clause, the first-numbered-heading clause, and (as a knock-on) the item count. The `>= 0` pre-guards are what stop `-1 < -1` reading as satisfied |
| 7 | `CPU architecture` -> `CPU width` | `docs/cross-os.md` | 1 of 13 | D-13's anchored same-sentence regex. Exactly one clause, so the lock is independently deletable and independently detectable |
| 8 | checklist item 4's marker deleted | `docs/cross-os.md` | 1 of 13 | D-12's exact five-item count; the received array names WHICH item went |

Three further mutations were applied to the NEW mask-ordering guard, covering all three failure
directions it claims to catch:

| Direction | Mutation | Observed |
|---|---|---|
| ordering inverted | mask and write swapped on `build-windows` | `[true, true, true, false, ...]` -- the failure NAMES the offending pair by index |
| mask lost | one `::add-mask::` line deleted on `typecheck-windows` | `7 ::add-mask:: lines for 8 token writes` |
| positive control | one token write deleted on `test-windows` | `expected [...] to have a length of 8 but got 7` -- proves the control is a control, not decoration |

### RE-1 / RE-2 -- the stale-cached-PASS trap, closed by EXECUTION rather than by reading `nx.json`

Trap 4 in this audit's brief ("a spec asserting on a file that is not a declared `nx.json` `test`
input replays a stale cached PASS") is the one that cannot be settled by reading a config. It was
settled by running the cache:

1. `nx run @op-nx/github-cache:test` -- `Cache: 0/1 hit`, 900 passed (cache warmed).
2. Same command again -- `Nx read the output from the cache instead of running the command for 1 out
   of 1 tasks`, `Cache: 1/1 hit`. A replay is genuinely reachable, so the test below is not vacuous.
3. **RE-1:** mutated ONLY `docs/cross-os.md` and re-ran WITHOUT `--skip-nx-cache`. No replay -- the
   task executed and `docs-cross-os.spec.ts` FAILED. The registration at `nx.json:63` is effective.
4. **RE-2:** same for `.github/workflows/windows-regression-detector.yml`. No replay --
   `windows-regression-detector.spec.ts` FAILED. The registration at `nx.json:71` is effective.
5. Reverted; the suite replays green again.

Both subjects live OUTSIDE `{projectRoot}`, which is precisely the condition under which PARITY-08's
defect shipped. It is closed here by measurement.

Related and confirmed while sweeping: Phase 11's ESCALATED infrastructure item is CLOSED --
`{workspaceRoot}/capture-hashes.mjs` is now `test.inputs` (`nx.json:74`) and
`{workspaceRoot}/read-integration-hash.mjs` is now `integration.inputs` (`nx.json:98`).

### A1 -- OPEN at verification time, CLOSED by measurement at audit time

This audit's brief carried A1 (`--no-warnings` leaves stderr empty on `linux/arm64`) as still OPEN,
and `12-VERIFICATION.md:20` / `12-SECURITY.md` `## Residual 2` both say so correctly **for the tree
they audited** -- at that point no CI run had ever executed on a tree carrying the hardened literal.
That condition no longer holds, and the closure is a MEASUREMENT rather than an inference:

Both `hash-parity-<runner>` artifacts from run `30586177358` were downloaded and parsed by this
audit. Both record `"command": "node --no-warnings -p process.platform"` -- the POST-`3d9f895`
literal, not the pre-hardening one the only prior artifact carried -- with `stderr` of length **0**
and `status` 0 on both legs, and `stdout` `linux\n` versus `win32\n`.

Two independent facts fall out of the same artifacts and are recorded because they are the
preconditions XOS-04/XOS-08 rest on:

- `build`, `typecheck`, `test` and `lint` hashes are IDENTICAL across the two legs -- which is what
  makes the Windows HIT possible at all.
- `integration` hashes DIFFER (`14017528273429599213` vs `6110443016908265237`), so CORR-04's
  discriminator is working and `compare.ts`'s `integration-not-divergent` clause
  (`hash-parity/compare.spec.ts:280`) is not firing for the wrong reason. The ubuntu `integration`
  hash is the same value `o3-witness` independently recorded as its cache key.

**Recommendation, not a gap:** `12-VERIFICATION.md`'s `human_verification` item 3 and
`12-SECURITY.md`'s Residual 2 both still read as forward-looking. Neither is a per-row status in this
map, so no row changes; recorded here as a correction rather than silently edited into another
phase's artifact.

### What was deliberately NOT done

- **No spec was written for any unobservable half.** No assertion claims a `[remote cache]` HIT, a
  runner-label resolution, or that the recipe is safe. Writing one would be the exact defect
  `08-ROOT-CAUSE.md:2056` names, and a worse outcome than an honest manual-only row.
- **No shape-check over `.planning/**` artifacts.** `10-SECURITY.md`'s Q1 re-pricing row is verified
  by located content with counts and a negative control, not by a spec. Three reasons, each
  sufficient and all inherited from Phase 11's audit: `.planning/**` is in no target's input set so
  such a spec would replay a cached PASS; `/gsd:complete-milestone` MOVES the directory so a
  path-keyed guard reddens later for a bookkeeping reason; and the record is frozen evidence nobody
  edits again.
- **No implementation file was modified.** The only source file written by this audit is one spec.
  Eight mutations touched `ci.yml`, `nx.json`, `docs/cross-os.md` and the detector workflow
  temporarily; every one was reverted with `git checkout --` and the tree verified clean.
- **The deferred sidecar block-drift guard was NOT added.** `12-CONTEXT.md:614` defers it explicitly
  and the map says "Do NOT add it".

### Full battery, run at `0063676` with the new guard in place

| Gate | Result |
|---|---|
| `npx nx run @op-nx/github-cache:test --skip-nx-cache` | **42 files / 900 tests passed**, 0 failures |
| `-t "windows"` | 63 passed across 11 files |
| `-t "detector"` | 9 passed across 2 files |
| `-t "cross-os"` | 13 passed across 4 files |
| `-t "discriminator"` | 11 passed across 4 files |
| `npm run integration --skip-nx-cache` | 3 files / 15 tests passed |
| `nx run-many -t typecheck --skip-nx-cache` | exit 0 |
| `nx run-many -t lint --skip-nx-cache` | exit 0 |
| `npx nx format:check --all` | exit 0 |
| `npm run check:action` (MAIN tree) | exit 0, empty diff on `start-cache-server/index.js` |

### Verdict

**FILLED.** 13/13 rows resolved: 8 `green`, 4 `manual-closed` on independently re-measured live
observations, 1 correctly `n/a` (deferred by CONTEXT). Zero rows left pending, zero escalations.
`nyquist_compliant: true`, `wave_0_complete: true`, `status: passed`.

### Files for commit

- `packages/github-cache/src/dogfood-cross-os.spec.ts` (modified -- the T-12-05 mask-ordering guard)
- `.planning/phases/12-windows-ci-reuse-o4-consumer-recipe/12-VALIDATION.md` (this file)
