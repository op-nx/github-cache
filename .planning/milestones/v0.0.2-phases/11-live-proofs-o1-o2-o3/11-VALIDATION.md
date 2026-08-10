---
phase: 11
slug: live-proofs-o1-o2-o3
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-29
audited_at: 2026-07-30
auditor: gsd-nyquist-auditor
gaps_found: 3
gaps_filled: 3
gaps_escalated: 1
tests_before: 848 unit / 4 integration
tests_after: 856 unit / 15 integration
---

# Phase 11 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `11-RESEARCH.md` `## Validation Architecture`.

**Status glyphs are ASCII by project rule** (`CLAUDE.md`: no emoji or non-ASCII in any output --
Windows cp1252 produces mojibake). `[ ]` = pending, `[OK]` = green, `[FAIL]` = red,
`[WARN]` = flaky. The machine-readable state lives in the frontmatter, not in the glyphs.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest via `@nx/vitest` (plugin-inferred `test` target, `nx.json:28-32`) |
| **Config file** | `packages/github-cache/vitest.config.mts` (unit) + `vitest.integration.config.mts` (integration) |
| **Quick run command** | `npm exec nx test github-cache` |
| **Full suite command** | `npm exec nx run-many -t test typecheck build lint` |
| **Estimated runtime** | ~60 seconds for the quick run; ~3 min for the full battery |

---

## Sampling Rate

- **After every task commit:** Run `npm exec nx test github-cache`
- **After every plan wave:** Run `npm exec nx run-many -t test typecheck build lint`
- **Before `/gsd:verify-work`:** Full suite green AND the `o3-witness` job green on the proving run
- **Max feedback latency:** ~60 seconds locally; the live-CI half is bounded by the proving run

### HARD SUSPENSION of the per-task sampling across the measurement window

**Between the TEST-10 `nx reset` and the completion of the O1/O2 measurement, the after-every-task
`npm exec nx test github-cache` sampling above is SUSPENDED.** This is a correctness rule, not a
convenience: running `test` in that window repopulates `.nx/workspace-data` and writes a `test`
entry into `.nx/cache`, which turns O1's `test` REMOTE hit into a LOCAL hit and destroys the proof
that the phase exists to produce. TEST-10 states the underlying mechanism -- a local cache hit
short-circuits before the remote is ever queried.

The hazard is live rather than theoretical: `.nx/cache` on the measurement workstation already holds
an entry for the `test` hash `11681410932071446589`. Plans `11-02` and `11-03` each carry this rule
in their own text so an executor meets it where it applies; it is restated here so a reader of the
validation contract alone does not reintroduce the sampling.

Sampling resumes at plan `11-05`, which is where the first `nx`-invoking work after the measurement
lands. `11-04` is inside the suspension window by the same rule, but it is unexposed either way: its
tasks invoke no `nx` command at all. The plans are the contract here and both `11-02-PLAN.md` and
`11-03-PLAN.md` name `11-05`; an earlier draft of this file said `11-04`.

**CRITICAL, and a real hazard in this phase:** the `o3-witness` job is a new CI job with no inferred
target behind it. `nx run-many` on a missing target exits 0 (recorded project trap), and by the same
logic a deleted CI *job* is a silently removable gate. Assert the witness job's presence by CONTENT
-- extend `docs-same-os-claims.spec.ts`'s phrase-keyed pattern (CONTEXT.md D-19) with a literal from
the witness job. That spec edit must land in wave 2 or later, because it rotates
`test`/`typecheck`/`integration` (D-10 row 2) and would otherwise expire the O1/O2 window.

---

## Per-Task Verification Map

This phase is proof-led and most of its success criteria are NOT unit-testable by construction.
Recorded explicitly, because the temptation is to manufacture one spec per requirement -- and every
such spec costs the perishable measurement window (CONTEXT.md D-10, D-11).

| Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 11-01 | 1 | TEST-08 (graph premise) | see `11-01-PLAN.md` register | Read-only graph resolution; no network, no cache mutation | script assertion, output captured as evidence | `npm run assert:graph-premise` (also both `hash-parity` legs in `ci.yml`) | `capture-hashes.mjs` | [OK] green |
| 11-01 | 1 | TEST-08 (evidence channel: `--out`, mode exclusivity) | -- (post-execution audit) | A record must never claim a provenance it never measured, and `--out` must never silently write nothing | unit (Vitest, spawns the real instrument) | `npm exec nx test github-cache` | `capture-hashes-cli.spec.ts` [NEW, this audit] | [OK] green |
| 11-02 | 2 | XOS-01, XOS-02, TEST-10 | see `11-02-PLAN.md` register | Authorised, irreversible `nx reset` behind a decision checkpoint; warm capture taken first | manual-only (live, one-shot, perishable) | -- (captures recorded in `11-EVIDENCE.md`) | N/A -- see justification | [OK] evidenced |
| 11-03 | 3 | XOS-01, XOS-02, TEST-10, OBS-02, TEST-08 | see `11-03-PLAN.md` register | Local read-only; sidecar bound to 127.0.0.1; `put()` 403 off-CI | manual-only (live, one-shot) | -- (captured terminal output in `11-EVIDENCE.md`) | N/A | [OK] evidenced |
| 11-04 | 4 | TEST-08 (producer attribution) | see `11-04-PLAN.md` register | REST capture transcribed by field; no raw payloads (uploader identity, node ids, signed URLs) | manual-only (REST capture) | -- | N/A | [OK] evidenced |
| 11-05 | 5 | XOS-03, TEST-09 | see `11-05-PLAN.md` register | Guards assert job presence and comment prose; RED before GREEN | unit (Vitest) | `npm exec nx test github-cache` | `dogfood-cross-os.spec.ts`, `docs-same-os-claims.spec.ts` | [OK] green |
| 11-05 | 5 | XOS-03, TEST-09 (H_linux producer) | T-11-27 (upstream half) | Command-token match, exactly-one-task, all-decimal hash shape; throw BEFORE any write | integration (Vitest, spawns the real instrument) | `npm exec nx integration github-cache` | `read-integration-hash.integration.spec.ts` [NEW, this audit] | [OK] green |
| 11-06 | 6 | XOS-03, TEST-09 | see `11-06-PLAN.md` register | `actions: read` + `contents: read` only; exact-equality key match, never a `?key=` prefix pass; positive-control acceptance set is `{200}` alone | CI gate (live) + unit shape/body guards | the `o3-witness` job's own `exit 1`; `npm exec nx test github-cache` | `ci.yml`, `dogfood-cross-os.spec.ts` | [OK] green |
| 11-06 | 6 | XOS-03, T-11-28 (sink absence) | T-11-28 | The artifact-controlled H_linux reaches NO `$GITHUB_ENV` / `$GITHUB_OUTPUT` sink | unit (Vitest, comment-stripped `ci.yml`) | `npm exec nx test github-cache` | `dogfood-cross-os.spec.ts` [NEW case, this audit] | [OK] green |
| 11-07 | 7 | XOS-03, TEST-09, TEST-08, OBS-02 | see `11-07-PLAN.md` register | Temporary authorised `main` push with a retained backup ref and SHA-equality restore | manual-only (live proving run) | -- (run URL and transcribed lines) | N/A | [OK] evidenced |

*Status: `[ ]` pending - `[OK]` green - `[FAIL]` red - `[WARN]` flaky*

**Threat refs are owned by the PLAN registers, not by this table.** The plans allocate `T-11-01`
through `T-11-23`; an earlier draft of this file invented three IDs with different meanings, and
`/gsd:secure-phase` reads the PLAN registers rather than this one. Pointing at the owning plan keeps
the two from drifting apart. Per-task rows are likewise deliberately collapsed to per-plan rows --
task IDs live in the plans and restating them here would create a second copy to maintain.

The wave column reflects the ordering lock in CONTEXT.md D-11: the hash-neutral instruments and the
O1/O2 capture come BEFORE any `packages/**` (11-05) or `ci.yml` (11-06) edit, with 11-04's blocking
sign-off between them.

**Why the manual-only rows are legitimate and not a coverage gap.** Each names a live one-shot
observation -- on a real Windows workstation, or on a real runner, against a mirror that expires
around 2026-08-28. No fixture can stand in without the substitution destroying the requirement:
TEST-10 says in as many words that a HIT recorded without a preceding reset is not accepted, and
OBS-02's evidence is the literal `[remote cache]` label, which only a real Nx run emits. The
mechanical half of each requirement -- the part a machine CAN check -- is exactly what TEST-08's
graph assertion, the `o3-witness` job and the positive control are, and all three are automated and
fail loud.

---

## Wave 0 Requirements

None. Existing test infrastructure covers everything this phase can automate. The two automatable
instruments (the `capture-hashes.mjs` mode and the `ci.yml` probes) are the phase's own deliverables,
not test-harness gaps -- no fixture work, no framework install.

*Existing infrastructure covers all phase requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Local Windows HIT on `build`, `typecheck`, `test` from Linux-CI artifacts | XOS-01, TEST-10, OBS-02 | Needs a real Windows workstation, a warm mirror that expires ~2026-08-28, and a cleared local Nx cache. A fixture would prove nothing about the real read path | Warm `capture:hashes` FIRST (irrecoverable once reset), then `nx reset`, then start the sidecar, then the 401/404/200 soundness triple, then a cold `nx run-many`. Record the literal `[remote cache]` label per target |
| Local Windows HIT on `integration` from Windows-CI artifacts | XOS-02 | Same, plus a non-regression comparison against a pre-rename baseline that no longer exists to re-measure | Same session as XOS-01; compare against both halves of the pre-rename baseline (read-path 200 at `06019d4`, Nx-level HIT at `bfd5143`) |
| Producer attribution per hit hash | TEST-08 | The attribution window closes permanently when Phase 12 enables O4; `mirrored-by` cannot answer it | Capture the Actions-cache entry list and shard asset list with `created_at` and label per asset; cross-reference against job windows; add the replayed `terminalOutput` runner-path fingerprint per hit |
| Reset-before-sidecar ordering and probe-before-measurement timestamping | TEST-10 | The ordering of a one-shot session is not reproducible after the fact | Record the soundness probe's timestamp as preceding the first Nx run, in `11-EVIDENCE.md` |

---

## Validation Sign-Off

- [OK] All tasks have `<automated>` verify or a recorded manual-only justification
- [OK] Sampling continuity: no 3 consecutive tasks without automated verify
- [OK] Wave 0 covers all MISSING references (N/A at plan time; one post-execution infrastructure
  item is ESCALATED below rather than silently absorbed)
- [OK] No watch-mode flags
- [OK] Feedback latency < 60s for the automatable half (measured: `test` 3.1s, `integration` 1.6s)
- [OK] The `o3-witness` job's presence is asserted by content, not assumed (the deletable-gate trap)
- [OK] Every count that would differ under the failure hypothesis is pre-registered in the PLAN (D-23)
- [OK] `nyquist_compliant: true` set in frontmatter

**Approval:** APPROVED (post-execution audit, 2026-07-30)

---

# Post-execution audit (retroactive, 2026-07-30)

Everything above this line is the PLAN-TIME contract, updated only in its frontmatter, its
status column and this sign-off. Everything below is the retroactive audit of what was
actually executed. Starting hypothesis for every requirement: uncovered until a test that can
FAIL proves otherwise.

## The two halves, judged separately

This phase's deliverable is half **perishable evidence** and half **instrumentation**, and a
single verdict over the two would be wrong in one direction or the other.

### Half 1 -- the perishable measurement (XOS-01, XOS-02, TEST-10, OBS-02, TEST-08 attribution)

**NOT re-testable, and proposing a test for it would be a wrong finding.** O1/O2 were measured
once from a cold local Nx cache created by an `nx reset` on the maintainer's workstation
against a warm remote mirror; three of the four proof hashes have since rotated, so no current
commit can retake that measurement. O3 was measured once in a temporary push to the public
default branch, since restored. A fixture substitution destroys the requirement rather than
standing in for it -- TEST-10 says in as many words that a HIT recorded without a preceding
reset is not accepted, and OBS-02's evidence is the literal `[remote cache]` label only a real
Nx run emits.

The admissible question is whether the EVIDENCE is adequately specified and self-checking.
Audited directly rather than taken from `11-VERIFICATION.md`:

| Property | Observed |
|---|---|
| Counts pre-registered BEFORE the run | `## Pre-registered counts` present in `11-03-PLAN.md` and `11-07-PLAN.md`, reproduced verbatim in `11-EVIDENCE.md` (2 sections) |
| Observed-vs-registered verdicts | 19 explicit MET / NOT MET markers in `11-EVIDENCE.md` |
| No unfilled placeholders | zero `PENDING` occurrences in `11-EVIDENCE.md` |
| Non-discriminating readings marked | every `Cache: n/m hit` occurrence carries its NON-DISCRIMINATING marking |
| Artifacts present and internally consistent | `11-task-graph-premise.json` (`PREMISE OK`), `11-hashes-warm.json`, `11-hashes-cold.json` all on disk; the witness's own arithmetic re-derives (`23:43:01Z - 23:40:37Z = 144s`, margin 30s) |

**No automated shape-check was written over `11-EVIDENCE.md`, and that is a decision rather
than an omission.** Three reasons, each sufficient: (1) `.planning/**` is in no target's Nx
input set, so such a spec would replay a cached PASS the moment the record changed -- a guard
that reads as coverage and cannot fail is the exact defect this phase exists to eliminate;
(2) `/gsd:complete-milestone` MOVES this directory to `.planning/milestones/<version>-phases/`,
so a path-keyed guard reddens later for a bookkeeping reason and gets deleted; (3) the record
is FROZEN one-shot evidence nobody edits again, so a shape guard defends against no live
failure mode. The plan-time contract already warns against manufacturing one spec per
requirement; this is that warning applied.

**Verdict for half 1: COVERED by evidence, correctly not by tests.**

### Half 2 -- the instrumentation (XOS-03, TEST-09, TEST-08 premise)

This is where real gaps lived, and three were found. All three are FILLED.

## Gaps found and filled

| # | Gap | Requirement | Why it was a gap | Filled by | Target |
|---|---|---|---|---|---|
| 1 | `read-integration-hash.mjs` had ZERO automated execution | XOS-03, TEST-09 | It produces H_linux -- the value the whole O3 proof rests on, uploaded as an artifact and composed into a cache key. Its three guards were hand-checked once during the review fix (WR-01/02/03); `git grep read-integration-hash -- packages/` returned one PROSE mention and no assertion. The DOWNSTREAM half of guard 3 was locked in `dogfood-cross-os.spec.ts`; the UPSTREAM half had nothing | `packages/github-cache/src/read-integration-hash.integration.spec.ts` (11 cases) | `integration` |
| 2 | No guard asserted the ABSENCE of a `$GITHUB_ENV` write in `o3-witness` (T-11-28) | XOS-03 | The five WR-04 body clauses assert what the job DOES, including that the shape check is present. Nothing asserted what it must never do again, so a reinstated `echo "H_LINUX=${h_linux}" >> "$GITHUB_ENV"` left the whole suite green. A reinstated sink is safer than the original only while the shape check runs FIRST, and that ordering was itself unguarded | new case in `packages/github-cache/src/dogfood-cross-os.spec.ts` | `test` |
| 3 | `capture-hashes.mjs`'s CLI contract had ZERO automated execution | TEST-08 | WR-05 wired the mode's four graph ASSERTIONS into CI and an npm script, so those are live. The layer above them was not: `--out` with a missing value (IN-02) silently wrote no record while exiting 0, and the premise branch silently swallowed `--diff` (IN-01). `--out` is the ONLY channel producing TEST-08's required captured assertion output | `packages/github-cache/src/capture-hashes-cli.spec.ts` (7 cases) | `test` |

## Observed RED -- every new assertion was seen to fail before it passed

Eleven mutations, each applied to the real implementation, run, then reverted with
`git checkout --`. No deliberately-broken state was left behind; the working tree carries only
the three test files. Each row records which case(s) reddened -- the discrimination is the
evidence, not the bare failure.

| Mutation | Cases reddened | Result |
|---|---|---|
| GUARD 1 back to `.includes(TARGET)` (pre-WR-03 substring) | 1 | substring spoof accepted -- exactly the case, 14 others green |
| GUARD 2 `!== 1` -> `< 1` (first-match) | 1 | two-task fixture accepted |
| GUARD 3 -> bare falsiness test | 3 of 4 | `abc`, `123 456` and numeric `42` accepted; the empty string still rejected -- the predicted split |
| `writeFileSync(outPath, task.hash)` gains a `\n` | 1 | byte-exact clause caught it; a `toContain` would not have |
| `cacheStatus ?? '<absent>'` -> raw value | 1 | prints `cacheStatus=undefined` |
| `echo "H_LINUX=..." >> "$GITHUB_ENV"` reinstated in `o3-witness` | 1 | T-11-28 clause fired, 859 others green |
| one usage line deleted from `capture-hashes.mjs` | 1 | the positive control fired -- proving it is a control, not decoration |
| IN-02 `--out` value check -> `if (false)` | 2 | both `--out` cases; confirmed AssertionError, not a timeout |
| IN-01 `\|\| args.diff !== undefined` removed | 1 | premise mode ran and discarded the diff |
| `args.installMode !== undefined \|\|` removed | 1 | premise mode accepted an install mode it never measured |
| diff-branch `\|\| args.out !== undefined` removed | 1 | `--diff ... --out` accepted |
| `INSTALL_MODES.includes(...)` -> `if (false)` | 1 | a capture ran with no recorded install mode |

## Design constraints the fill had to respect, recorded because each rejected the obvious route

1. **`read-integration-hash.integration.spec.ts` is an INTEGRATION spec by constraint, not
   preference.** Its fixtures need a scratch directory and `tmpdir` is on LINT-02's banned
   `node:os` accessor list at every unit-spec path. The ban's message offers a described
   `eslint-disable` as the alternative; that was REJECTED because `lint-rules.spec.ts` asserts
   CORR-05 as a positive claim (`CORR_05_SITES` empty -- "zero extant ambient-platform reads
   remain in unit specs"), and the last site phase 9 removed to make that true was literally
   `cache-archive-path.spec.ts`'s `import { tmpdir } from 'node:os'`. Reopening a closed
   requirement to add a guard is a bad trade in both directions. Writing fixtures under
   `{projectRoot}` was rejected too -- the project directory is inside the `default` input, so
   every run would dirty the tree the next hash is computed over. The move is a net gain: the
   `integration` target runs on BOTH matrix legs, so an instrument whose output becomes a
   cross-OS cache key is now exercised on the Windows runner too.
2. **The T-11-28 clause is scoped to `jobBlock('o3-witness')` and must never be widened to the
   file.** The `integration` job legitimately writes `$GITHUB_ENV` in its sidecar pre-set step.
   The comment strip is load-bearing in the other direction: the witness's own leading comment
   names `$GITHUB_ENV` five times explaining why the sink was removed, so the same assertion
   against the RAW file would fail on the CORRECT implementation.
3. **No existing guard was weakened and no `ci.yml` prose was touched.** All 10 Phase 11 locked
   phrases re-verified present after the audit, each contained WITHIN a single line, by an
   independent line-scan rather than by the suite being green (row A's two phrases at count 2,
   the other eight at count 1).

## ESCALATED -- one infrastructure item, outside this audit's write scope

**Both new instrument specs can replay a stale cached PASS after a lone edit to their
subject.** `read-integration-hash.mjs` and `capture-hashes.mjs` are workspace-ROOT files, and
`nx.json` enumerates every workspace-root input as an explicit path -- there is no
`{workspaceRoot}` `.mjs` glob anywhere in it, which `capture-hashes.mjs`'s own header states as
the reason those instruments are hash-neutral. So editing an instrument ALONE rotates no target
hash, and the guard over it may not re-run.

This is a WARNING, not a BLOCKER: the guards still redden on any commit that also touches a
registered input, which in practice is most of them. But the deterministic fix is two lines and
is exactly the move PARITY-08 made for `ci.yml` in phase 9, for exactly this reason:

```jsonc
// nx.json -> targetDefaults.test.inputs
"{workspaceRoot}/capture-hashes.mjs",
// nx.json -> targetDefaults.integration.inputs
"{workspaceRoot}/read-integration-hash.mjs",
```

Not applied here because `nx.json` is not a test file and this audit's write scope is test
files, fixtures and this record. It rotates the `test` and `integration` hashes, which
`11-REVIEW-FIX.md` note 4 already sanctions (O1/O2/O3 are recorded and nothing further depends
on the current hashes). Each spec carries the same caveat in its own header, so the finding
cannot be lost with this file.

## Known low-severity security gaps, considered for coverage

- **T-11-28** -- CLOSED by gap 2 above. The guard fires on a reinstated sink and was observed
  RED against exactly that mutation.
- **T-11-29** (`integration-nx.log`, `integration-hash.txt`, `o3-witness.log` root-written and
  not gitignored) -- NOT closed, and deliberately not turned into a failing test. `.gitignore`
  is not a test file, so the fix is outside this audit's write scope, and a spec asserting the
  entries exist would be RED on arrival with no permitted remedy. Recorded here instead. Note
  the new integration spec passes BOTH positionals to the instrument, so it writes its fixtures
  to a temp directory and never adds a fourth untracked root artifact.

## Final state

| Measure | Before | After |
|---|---|---|
| `test` target | 848 passed / 39 files | **856 passed / 40 files** |
| `integration` target | 4 passed / 2 files | **15 passed / 3 files** |
| `lint`, `typecheck`, `build` | pass | pass |
| `npm run check:action` | exit 0 | exit 0 |
| Failures | 0 | **0** |
