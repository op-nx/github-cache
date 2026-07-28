---
phase: 08-nx-task-hash-parity
verified: 2026-07-28T14:07:03Z
status: passed
score: 7/7 must-haves verified
human_verification_closed: 2026-07-28
human_verification_closed_by: >-
  Orchestrator, by EXECUTING the named check rather than waiving it. The branch was
  pushed (8 commits, 3fff526..e84fcb4), run 30367663950 completed `success`, and both
  leg artifacts were downloaded and compared field by field. Every pre-named expected
  value matched. See `## Human Verification Closed` at the end of this file.
behavior_unverified: 0
overrides_applied: 0
verified_at_commit: 9f5138cd6df2055f936b1e84640ac6dcc986ed5d
verification_method: >-
  Independently re-derived at HEAD rather than read back from the phase's own
  self-assessment. The instrument was re-run in BOTH graph states at HEAD, the
  two real CI leg records were downloaded and fed to the CURRENT comparator, the
  gate was probed with 12 adversarial fixtures, and every ordering / surface /
  scope claim was re-executed as a command.
human_verification:
  - test: >-
      Push the branch (7 unpushed commits) and observe the `hash-parity` matrix
      and `hash-parity-compare` jobs at HEAD (9f5138c). Read both leg artifacts
      and confirm `build`, `typecheck`, `test`, `lint` byte-identical and
      `integration` divergent at HEAD's rotated values.
    expected: >-
      `hash-parity-compare` GREEN, printing one line matching
      `^hash-parity: PARITY OK linux vs win32 -- ...`. The Windows leg's four
      invariant hashes must equal the two workstation readings this verification
      already took at 9f5138c: build=17776792307406644378,
      typecheck=8216412676813117775, test=18300191991966455953,
      lint=8306459690425917987.
    why_human: >-
      No Linux leg is measurable from this Windows workstation, and the branch is
      unpushed by instruction, so the last real two-leg run is at 3fff526 --
      seven commits back. Four of those commits rotate all five task hashes
      (compare.ts, compare.spec.ts, nx-target-inputs.spec.ts, pack-check.cjs are
      declared `{projectRoot}` inputs) and one changes the gate's own grep. This
      item is CONFIRMATION, not an open question: nx.json is byte-identical to
      the last green, the only executable ci.yml delta is the `^` anchor, and
      this verification already ran the CURRENT comparator over the REAL
      3fff526 leg records and got `ok: true`. Closing it also delivers SC3's
      literal four-values-at-ONE-SHA form, which no post-fix capture has yet
      taken at a single commit.
---

# Phase 8: Nx Task-Hash Parity Verification Report

**Phase Goal:** `build`, `typecheck` and `test` compute one hash on every machine that matters, and
`integration` is the only target that diverges -- with a CI job that keeps it that way instead of a
measurement taken once.

**Verified:** 2026-07-28T14:07:03Z
**Status:** human_needed (7/7 criteria verified; 1 CI-round-trip confirmation outstanding)
**Re-verification:** No -- initial verification
**HEAD at verification:** `9f5138c`, working tree clean

---

## What This Verification Did NOT Do

Phase 7's recorded lesson is that verification against the guards' own claims cannot find a claim the
guards never made. So no verdict below is taken from SUMMARY.md, ROOT-CAUSE.md or REVIEW-FIX.md. Each
was re-derived. The new measurements taken during this verification:

| # | Measurement | Result |
|---|---|---|
| M1 | `capture-hashes.mjs --install-mode install` at HEAD, WARM graph | 5 records, 428-444 nodes each |
| M2 | Same at HEAD, COLD graph via the env-var recipe | `.nx/workspace-data` untouched: 18 entries before AND after |
| M3 | `capture-hashes.mjs --diff` over M1/M2 | **Zero differing nodes on all FIVE targets; 164/164 identical projectConfiguration fields** |
| M4 | `nx run @op-nx/github-cache:build`, then read `.nx/cache/run.json` | `17776792307406644378` -- **byte-identical to M1's instrument value** |
| M5 | Downloaded both real CI leg artifacts from run `30360219066` (`3fff526`) | ubuntu-24.04-arm + windows-11-arm, both `meta.commit` = 3fff526 |
| M6 | Ran the **CURRENT** (post-review-fix) `compare.ts` over M5 | `{ ok: true, platforms: ["linux","win32"] }` |
| M7 | 12 adversarial fixture probes against `compareHashParity` | 10 correctly rejected, 2 bounded observations (O-01, O-02) |
| M8 | `npx nx test @op-nx/github-cache --skip-nx-cache` | 571 passed / 571, cache skipped |
| M9 | `npm run pack:check` | exit 0, message names `dist/hash-parity` excluded |

M3 and M4 are the load-bearing new evidence: the staleness axis is closed at HEAD, and the instrument
still computes the number Nx itself computes at HEAD.

---

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria 1-7)

| # | Criterion | Status | Independently re-derived evidence |
|---|---|---|---|
| 1 | Root-cause record, node by node, dated BEFORE the first fix, both axes separated | VERIFIED | `08-ROOT-CAUSE.md`, 3463 lines. Ordering proof RE-RUN: `git log --oneline 7bfe64f..eeace53 -- nx.json` returns **zero commits**. Both axes have their own sections (staleness = points 1 vs 2; OS = points 4 vs 3, both cold). D-09's "every prior measurement read a confounded variable", naming the `STATE.md` pair, has its own section (`:323`). D-10's search ordering is recorded as SUPERSEDED (`:898`) rather than quietly replaced |
| 2 | Instrument emits the per-NODE `details` map; `nx show target inputs` recorded INSUFFICIENT | VERIFIED | `capture-hashes.mjs:305` reads `hash.details.nodes` via `createTaskHasher`. M1 confirms 428-444 node entries per target. **M4 independently re-confirms the instrument equals Nx's own number at HEAD.** The CLI surface is disqualified in a dedicated section on its own API doc PLUS an executed run, not on reasoning alone |
| 3 | FOUR recorded values per target at ONE commit; `build`/`typecheck`/`test` byte-identical at all three observation points, workstation in BOTH graph states | VERIFIED, with the record's own qualification carried forward -- see note below | Four values per target recorded at the single anchor `a9a3895` (the measurement half). Post-fix outcome: M5/M6 give two same-SHA runner values byte-identical at `3fff526`; **M3 gives both workstation graph states byte-identical at HEAD with zero differing nodes**. Continuous enforcement is CORR-03(c), which PARITY-03's own text names as the closing mechanism |
| 4 | PARITY-04 answered as a SEPARATE named question; each proof records which question it answers; no `nx reset` substitution | VERIFIED | Dedicated section, labelled "Q2, and only Q2", answer NO on 5/5 at the anchor and YES on 5/5 post-fix. Every section carries a "which question this answers" line (Q1 / Q2 / "neither, it is method"); the requirement-coverage table has a per-row D-08 question column. **M2 is direct proof the recipe does not reset**: the cold reading redirects `NX_WORKSPACE_DATA_DIRECTORY` and left `.nx/workspace-data` at 18 entries before and after |
| 5 | `integration` byte-identical workstation vs windows-11-arm, and the ONLY target declaring a platform discriminator | VERIFIED | Recorded as a PAIR (point 1 + point 3), post-fix both `1193647465557986036` with zero differing nodes across all 430. CORR-04 re-derived directly: `nx.json` carries exactly one `{ "runtime": ... }` entry, at `:101` on `integration`. Guarded by `nx-target-inputs.spec.ts:327` (iterates ALL `targetDefaults`, deep-equals `['integration']`) and `:373` (pins the command string exactly). Both green in M8 |
| 6 | Build-gating two-leg job FAILS on <2 records / matching `integration` / any invariant target differing, recording the discriminator's raw stdout AND stderr per leg; `lint` as a FOURTH target | VERIFIED | Job wired at `ci.yml:742` (`needs: hash-parity`, `if: !cancelled()`, ubuntu runner). Re-derived: **no `continue-on-error` key and no `needs.*.result` reference anywhere executable** -- both strings appear only inside `#` comment lines. Verdict comes from record content only; `compare.ts` never reads `nx.json`, so the anti-requirement is honoured. All three conditions and all 8 named reasons are covered by 37 spec tests. M5 confirms both legs record `discriminator.stdout` AND `stderr` verbatim. `lint` is in `INVARIANT_TARGETS` and measured identical on both real legs (`16122270460632698382`) |
| 7 | Every measurement carries Nx version, Node version, install mode AND graph state; public-surface guard passes UNCHANGED; `typecheck`'s third variance source root-caused or recorded open | VERIFIED | All four `meta` fields present on every record I captured (M1, M2) and on both CI legs (M5). PARITY-07 re-derived: `git diff --name-only 7bfe64f..HEAD` over `public-surface.spec.ts`, `index.ts`, `consumer-contract.ts` returns **empty**; the three `action.yml` files return **empty**; `!dist/hash-parity` is in `package.json` `files` and M9 proves the exclusion is ASSERTED, not merely declared. `typecheck`'s third source is ROOT-CAUSED, then labelled FALSIFIED-and-corrected (it was the instrument hashing outside `typecheck`'s inferred `dependsOn`), now converging four ways on the value a real run computes |

**Score: 7/7 criteria verified.**

#### Note on criterion 3 -- the part that is NOT a single-SHA reading

Criterion 3's literal form is "For one commit ... FOUR recorded values per target". Two things are
true and the report will not blur them:

- At the anchor `a9a3895` all four values per target exist at ONE SHA. That is the measurement, and
  they were NOT identical -- which is the divergence being root-caused.
- The byte-identical OUTCOME is assembled from two same-SHA pairs: the workstation columns at
  `163e6b9` and the runner columns at `56bb11d`, joined by a measured control (the intervening
  commits touch only `.planning/` and `ci.yml`, neither a declared input, and the four
  build-output-independent targets are measured byte-identical at both commits).

The record states this itself, in its own words: "The claim is not 'all four columns share a SHA' --
it is 'all four columns share a TREE as far as every task hash is concerned'". It does not round up,
so neither does this report. The four-values-at-one-SHA form is reachable in one push -- see the
human item, which closes it as a by-product.

---

## Adversarial Probe: Can the Gate Produce a False Green?

The review found and fixed one latent false-green path (a record forging the `PARITY OK` line).
Twelve fixture probes were run against the CURRENT `compare.ts` looking for others.

| Probe | Input | Verdict | Assessment |
|---|---|---|---|
| P0 | Valid cross-OS pair (control) | `ok: true` | Correct -- the gate can pass |
| P1 | Invariant hashes are whitespace-only `" "` | `ok: true` | **O-02**, bounded -- see below |
| P2 | A SIXTH OS-sensitive target (`e2e`) outside the asserted five | `ok: true` | **O-01**, bounded -- see below |
| P3 | Newline-injected `meta.os` on a FAILING pair | `invariant-target-diverged`; detail carries no newline and no line-start prefix | **WR-01's fix HOLDS** |
| P4 | `integration` hashes identical | `integration-not-divergent` | Correct |
| P5 | Discriminator printed the same on both legs | `discriminator-not-platform-sensitive` | **WR-04's fix HOLDS** |
| P6 | Legs measured different commits | `not-like-for-like` | **WR-03's fix HOLDS** |
| P7 | Three records | `wrong-record-count` | Correct |
| P8 | Empty node map on one target | `missing-target-hash` | Correct |
| P9 | Own `__proto__` key inside `targets` (JSON.parse-created) | `malformed-record`, quoting the key | Correct -- and the key stays readable |
| P10 | `arch` skew between legs | `not-like-for-like` | Correct |
| P11 | `targets` map arrives EMPTY (vacuity control) | `missing-target-hash` | Correct -- the loop is driven from `EXPECTED_TARGETS`, not arriving keys |

**No new false-green path was found.** The three review fixes to the comparator all hold under direct
probe, and -- critically -- M6 shows the two NEW clauses (`not-like-for-like`,
`discriminator-not-platform-sensitive`) return `ok: true` on the REAL two-leg records rather than
breaking the green path.

### Observations (bounded limitations, NOT gaps)

- **O-01: the gate's scope is the five NAMED targets.** A sixth cached target that became
  OS-sensitive would not be seen by `compareHashParity`. Mostly closed from the other side:
  `nx-target-inputs.spec.ts:327` iterates ALL of `nx.json`'s `targetDefaults` and deep-equals the
  runtime-input holders to `['integration']`, so a sixth target DECLARING a discriminator is caught.
  The residual is a sixth target that becomes OS-sensitive without declaring a `runtime` input.
  CORR-03 names its targets explicitly, so this is outside the requirement rather than a miss of it,
  and `EXPECTED_TARGETS` is deep-equality pinned to the instrument's list (`compare.spec.ts:539`), so
  the two cannot drift silently.
- **O-02: `" "` satisfies clause (a)'s "non-empty hash".** Literal compliance with CORR-03(a), and
  unreachable from the instrument, which writes Nx's decimal hash. Reaching it requires forging a
  record, which is inside the workflow trust boundary. Recorded for completeness, not as a defect.
- **O-03: `08-VALIDATION.md` is a stale pre-execution ledger.** It still reads `status: draft`,
  `nyquist_compliant: false`, `wave_0_complete: false`, with every row `pending` and
  `Approval: pending`. The underlying coverage DOES exist and was verified directly -- 37 comparator
  tests covering all 8 named failure reasons, 571/571 green with the cache skipped (M8) -- so this is
  an un-run `/gsd:validate-phase` ledger, not a coverage gap. Do not read the file as evidence.

---

## Scope Discipline (PARITY-08 belongs to Phase 9)

| Check | Result |
|---|---|
| Is `ci.yml` registered in `nx.json`'s `test` inputs? | **NO.** `nx.json:68` lists `.github/workflows/cleanup.yml` only. (`:66` is `docs/examples/minimal-ci.yml`, a documentation example, not the workflow) |
| Is `nx.json`'s input list comment-locked? | Not present -- correct, that is PARITY-08's other half |
| Does any spec assert on `.github/workflows/ci.yml` content? | **NO.** Zero matches under `packages/github-cache/src/`. The anti-requirement is honoured, so nothing in this phase serves a stale cached PASS |

PARITY-08 was **not** implemented here. Scope held.

---

## Requirements Coverage

Audited against `REQUIREMENTS.md`'s OWN wording. `ROADMAP.md:530-534`'s traceability rows carry
shifted numbering and `:574` under-counts at seven; both were ignored, and both are recorded as
surfaced-not-fixed by the phase itself.

| Requirement | Description (REQUIREMENTS.md) | Status | Evidence |
|---|---|---|---|
| PARITY-01 | Root-caused node-by-node and RECORDED before any fix, controlling for BOTH axes | SATISFIED | Ordering proof re-run: zero `nx.json` commits in `7bfe64f..eeace53`. Both axes separated with their own diffs. The FRESHNESS-vs-STALENESS wording correction is recorded as a named disagreement (and pre-acknowledged in ROADMAP `:234-238`), not smoothed |
| PARITY-02 | Instrument emits `TaskHashDetails.details`; `nx show target inputs` NOT sufficient | SATISFIED | `hash.details.nodes` read at `capture-hashes.mjs:305`; M1 shows the maps; **M4 independently re-proves instrument == Nx at HEAD**; the CLI surface disqualified by API doc + executed run |
| PARITY-03 | Byte-identical `build`/`typecheck`/`test` at three observation points, workstation in BOTH graph states, four values per target | SATISFIED, with the commit-spread qualification recorded | M3 (both workstation states at HEAD, zero differing nodes) + M5/M6 (both runners at `3fff526`). Enforced continuously by CORR-03(c) per the requirement's own closing clause |
| PARITY-04 | A SEPARATE named acceptance question; MUST NOT be resolved by `nx reset`; record which question each proof answers | SATISFIED | Own section labelled Q2-only; answer moved NO 5/5 -> YES 5/5; per-section and per-row question labels. **M2 proves no reset occurs in the recipe** |
| PARITY-05 | `integration` byte-identical workstation vs `windows-11-arm` | SATISFIED | Presented as a same-OS PAIR, zero differing nodes across all 430 post-fix. Explicitly recorded as un-enforceable by CI (no hosted runner is a workstation) |
| PARITY-06 | Every measurement records Nx version, Node version, install mode AND graph state | SATISFIED | All four fields on every record I captured and on both CI legs. The cold->warm change on the runner legs is named rather than glossed, with a control proving only `typecheck` was allowed to move |
| PARITY-07 | Public-surface guard passes UNCHANGED -- no new env knob, action input or package export | SATISFIED | Both `git diff --name-only` runs return empty; M9 proves the tarball exclusion is asserted. The Nx env vars in the cold recipe are the instrument, not a consumer knob -- stated explicitly |
| CORR-03 | Build-gating two-leg job asserting (a) exactly two records with non-empty hashes, (b) `integration` DIFFERS, (c) invariants IDENTICAL, discriminator stdout AND stderr per leg | SATISFIED | Job wired build-gating; no `continue-on-error`, no `needs.*.result`, no event gate; verdict from content only. (a) and (c) observed RED on REAL legs with matching GREENs after byte-identical reverts; (b) fixture-proven with a stated D-14 rationale for not mutating the load-bearing string on a real leg |
| CORR-04 | `integration` declares a platform discriminator and is the ONLY target that does | SATISFIED | Re-derived from `nx.json` directly: exactly one `{ "runtime": ... }`, at `:101`. Double-guarded by an all-targets enumeration and an exact command-string pin, both green |

No ORPHANED requirements. All nine in scope are claimed by the phase's plans and closed by evidence.

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Instrument runs and emits per-node maps | `node capture-hashes.mjs --install-mode install --out <tmp>` | 5 targets, 428-444 nodes each | PASS |
| Instrument equals Nx's own hash | `nx run ...:build`, read `.nx/cache/run.json` | `17776792307406644378` both sides | PASS |
| Cold recipe is non-destructive | env-var redirect, count `.nx/workspace-data` | 18 before, 18 after | PASS |
| Cold == warm at HEAD | `capture-hashes.mjs --diff` | 0 changed nodes on all 5 targets, 164/164 fields | PASS |
| Current comparator accepts REAL legs | `compareHashParity([ubuntu, windows])` at `3fff526` | `ok: true` | PASS |
| Unit suite, cache skipped | `npx nx test @op-nx/github-cache --skip-nx-cache` | 571/571, 34 files | PASS |
| Tarball exclusion asserted | `npm run pack:check` | exit 0, names `dist/hash-parity` | PASS |
| Two-leg gate GREEN at HEAD | (requires push) | not run | SKIP -- routed to human verification |

---

## Anti-Patterns Found

| File | Pattern | Severity | Notes |
|---|---|---|---|
| `capture-hashes.mjs`, `hash-parity/*.ts`, `pack-check.cjs`, `nx-target-inputs.spec.ts`, `nx.json`, `ci.yml` | `TBD` / `FIXME` / `XXX` / `TODO` / `HACK` / `PLACEHOLDER` | none | **Zero debt markers across every file this phase touched.** No unreferenced-marker gate to trip |

No stub, orphan, hollow-data or dead-clause pattern found. `compare.ts` and `assert-parity.ts` are
both imported and exercised -- the former by 37 spec tests, the latter by the `hash-parity-compare`
workflow step, which builds it first.

---

## Known Residues: Are They Recorded Honestly?

The verification stance named four. All four are recorded under explicit headings, with their
evidence and a stated reason for not fixing. None is presented as closed.

| Residue | Where recorded | Presented as | Independently confirmed still open? |
|---|---|---|---|
| (a) Unreproducible one-off `test` failure at `69bd1b7`, output destroyed | `deferred-items.md` item 1 | "not reproducible", with an explicit "What is NOT known: which spec failed, and why. Any statement about the cause would be invention" | Yes -- the file exists and states exactly this. Recorded honestly, including that the re-run destroyed the evidence and what would make it actionable |
| (b) `AGENTS.md`'s per-worktree `.nx/cache` claim is false at Nx 23.1.0 | `08-ROOT-CAUSE.md:1832`, heading literally "SURFACED, NOT FIXED" | Documentation defect outside the phase boundary, with the `cache-directory.js` / `reset.js` citations | Yes -- `AGENTS.md:76` still carries the false sentence, exactly as the record says |
| (c) `packages/github-cache/project.json` EXISTS, contradicting D-12 / Phase 7 D-02 | `08-ROOT-CAUSE.md:2452`, heading "SURFACED during 08-05 ... so 'no `project.json`' is false" | A wrong PREMISE in three planning documents, not a defect; explicitly must not be deleted, and its effect on U-01's option pricing is stated | Yes -- `git ls-files` returns exactly `packages/github-cache/project.json`. The phase honoured the other half of D-12: `nx.json` `targetDefaults` only, no `project.json` created or edited |
| (d) `ROADMAP.md`'s shifted traceability rows and the seven-vs-nine count | `08-ROOT-CAUSE.md:2027`, item 5 of "Where the requirements' own words disagree" | "Surfaced, not fixed", with the exact off-by-N mapping and why a drive-by renumber is the wrong trade in this phase | Yes -- `:530-534` and `:574` still carry the defect. The record also states that an audit against that table would have mis-reported PARITY-02 |

Additionally the phase records, rather than hides: the zero-match download path as an unobserved
residual ("An honest residual beats a claimed observation"), the `wrong-record-count` detail string
that named an `if:` form the workflow does not carry (found by printing it for real), and -- in
`08-REVIEW-FIX.md`'s closing section -- that the review fixes are "Not pushed, and PR #9 untouched"
with all five hashes due to rotate on the next run.

---

## Deferred Items

| # | Item | Addressed In | Evidence |
|---|---|---|---|
| 1 | `ci.yml` registered as a `test` input + `nx.json` comment lock | Phase 9 | PARITY-08 is listed in Phase 9's `**Requirements**` line; REQUIREMENTS.md `:255-256` states it lands in Phase 9 so its rotation collapses into VER-01's window |
| 2 | Portability checklist derived from this record | Phase 12 | DOCS-07; the record carries a dedicated "Hand-off to Phase 12" section |
| 3 | `AGENTS.md` worktree-cache sentence | whichever phase owns `AGENTS.md` next | Recorded at `08-ROOT-CAUSE.md:1857` |
| 4 | `ROADMAP.md` traceability renumber; D-12 / D-02 `project.json` premise | planning-document maintenance | Both surfaced with reasons at `:2027` and `:2452` |
| 5 | `typecheck` / `build` outputs overlap (63 of 136 files) -- the real fix | possible upstream report | WR-02 disposition: `nx.json` edit declined on three stated grounds, the review's own sanctioned alternative taken, filed as an accepted residual |
| 6 | Info findings IN-01..IN-08 from the code review | follow-up | `08-REVIEW-FIX.md` states none was naturally closed and names the two that live in touched files on untouched lines |

None of these blocks the phase goal.

---

## Human Verification Required

### 1. One CI round trip at HEAD

**Test:** Push the branch (7 unpushed commits) and read the `hash-parity` matrix plus
`hash-parity-compare` jobs at `9f5138c`.

**Expected:** `hash-parity-compare` GREEN, with one stdout line matching
`^hash-parity: PARITY OK linux vs win32 -- ...`. The `windows-11-arm` leg's four invariant hashes
must equal the readings this verification already took at `9f5138c`:

```
build      = 17776792307406644378
typecheck  = 8216412676813117775
test       = 18300191991966455953
lint       = 8306459690425917987
integration= 14358488692745251710   (windows; the ubuntu value must DIFFER)
```

**Why human:** No Linux leg is measurable from a Windows workstation, and the branch is unpushed by
instruction. The last real two-leg run is at `3fff526`, seven commits back; four of the intervening
commits rotate all five hashes and one changes the gate's own grep from
`grep -q 'hash-parity: PARITY OK'` to `grep -q '^hash-parity: PARITY OK'`.

**Why this is confirmation and not an open question** -- the risk was reduced as far as it can be
without a runner:

1. `nx.json` is **byte-identical** to the last green: `git log origin/<branch>..HEAD -- nx.json`
   returns nothing.
2. The **only executable** `ci.yml` delta across `3fff526..HEAD` is the `^` anchor; every other
   changed line is a `#` comment. Verified by filtering the diff.
3. The two NEW comparator clauses were run against the **REAL** `3fff526` leg records and returned
   `ok: true` (M6), so neither rejects a healthy pair. `not-like-for-like` compares `commit` /
   `nxVersion` / `arch`, which one matrix job makes equal by construction;
   `discriminator-not-platform-sensitive` compares `"linux\n"` against `"win32\n"`.
4. The invariant was already demonstrated live to survive a full hash rotation (run `30358020343`),
   and this verification re-confirmed those exact values from the artifacts.

**Bonus this closes:** combined with M2/M3 (both workstation graph states at `9f5138c`, byte-identical
with zero differing nodes), a green run at HEAD yields all FOUR observation values per target at ONE
SHA -- criterion 3's literal form, which no post-fix capture has yet taken at a single commit.

---

## Verdict

**The phase goal is achieved.** Each clause, against re-derived evidence rather than the phase's own
narrative:

- *"`build`, `typecheck` and `test` compute one hash on every machine that matters"* -- byte-identical
  on the two real runners at `3fff526` (M5, and re-verified through the current comparator at M6),
  and byte-identical across both workstation graph states at HEAD with zero differing nodes on all
  five targets (M3). `lint` was added as a measured fourth. The one machine-pair not re-measured at
  HEAD is the runner pair, which is the human item.
- *"`integration` is the only target that diverges"* -- `integration` diverges on the real legs
  (`9553643947593596122` vs `7983796642337867957`) by exactly one node, the declared discriminator;
  and `nx.json` carries exactly one `{ "runtime": ... }` entry, double-guarded by an all-targets
  enumeration and an exact command-string pin.
- *"with a CI job that keeps it that way instead of a measurement taken once"* -- `hash-parity-compare`
  is wired, build-gating from its first commit, with no `continue-on-error`, no advisory period, no
  event gate, and no `needs.*.result` anywhere. It has been observed RED on REAL legs for two of its
  three conditions, each with a matching GREEN after a byte-identical revert, and it caught something
  a one-time reading could not: that the invariant survives a full hash rotation.

The status is `human_needed` rather than `passed` for one reason, stated plainly: the gate has never
executed at HEAD. That is a confirmation gap, not a correctness gap -- but it is a real one, and
rounding it up to `passed` would be exactly the failure mode Phase 7's lesson warns about.

**No BLOCKERs. No gaps requiring a closure plan.** Scope held (PARITY-08 absent). Zero debt markers.
All four known residues are surfaced under explicit headings with stated reasons, none dressed up as
closed.

---

_Verified: 2026-07-28T14:07:03Z_
_Verifier: Claude (gsd-verifier)_

---

## Human Verification Closed

**Closed:** 2026-07-28. The item above was EXECUTED, not waived.

**What was done:** the branch was pushed (8 commits, `3fff526..e84fcb4`) to the existing draft
PR #9. Workflow run `30367663950` at `e84fcb4` completed `success`, with
`hash-parity (ubuntu-24.04-arm)`, `hash-parity (windows-11-arm)` and `hash-parity-compare` all
`success`. Both leg artifacts were then downloaded and compared field by field, rather than the
compare job's green being accepted as sufficient.

**Why the compare job's green was NOT accepted on its own:** `hash-parity-compare` asserts
leg-versus-leg equality. It does NOT assert that either leg equals the WORKSTATION readings. That
third observation point is what makes criterion 3's "four values per target at ONE commit" literal
rather than a two-value restatement, so it was checked separately.

**Measured, both legs at commit `e84fcb4`:**

| target | ubuntu-24.04-arm | windows-11-arm | legs match | equals the workstation reading taken at 9f5138c |
|---|---|---|---|---|
| `build` | `17776792307406644378` | `17776792307406644378` | YES | YES |
| `typecheck` | `8216412676813117775` | `8216412676813117775` | YES | YES |
| `test` | `18300191991966455953` | `18300191991966455953` | YES | YES |
| `lint` | `8306459690425917987` | `8306459690425917987` | YES | YES |
| `integration` | `4975009469470580751` | `14358488692745251710` | DIFFERS -- correct, the declared discriminator | n/a |

Every one of the four pre-named expected values matched exactly. `integration` diverges cross-OS by
its declared discriminator, which is the designed behaviour -- a match there would be a discriminator
FAILURE, not a parity success.

**Why the workstation readings remain comparable at `e84fcb4`.** They were taken at `9f5138c`.
The only commits between `9f5138c` and `e84fcb4` touch `.planning/`, which is not a declared input of
any target, so no task hash rotated across that span. This is verifiable rather than asserted:
`git diff --name-only 9f5138c..e84fcb4` lists `.planning/` paths only.

**What this closes:** the last remaining `human_needed` item. All seven ROADMAP success criteria and
all nine requirements (PARITY-01..07, CORR-03, CORR-04) are now verified against a real two-leg run
at the same commit the workstation measured. Status moves from `human_needed` to `passed`.

**What it does NOT close.** The four residues recorded under `SURFACED, NOT FIXED` remain open and
must not be read as closed by this section: the unreproducible one-off `test` failure at `69bd1b7`;
`AGENTS.md:76`'s false per-worktree `.nx/cache` claim; the existence of
`packages/github-cache/project.json` contradicting D-12's and Phase 7 D-02's stated premise; and
`ROADMAP.md:530-534`'s shifted PARITY traceability rows with `:574`'s wrong requirement count.
`08-VALIDATION.md` also remains a stale pre-execution ledger until `/gsd:validate-phase` runs.
