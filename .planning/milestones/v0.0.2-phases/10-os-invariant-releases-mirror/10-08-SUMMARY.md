---
phase: 10-os-invariant-releases-mirror
plan: 08
subsystem: trust-posture
tags: [trust, threat-model, audit-handoff, spec-pin, comment-lock, recorded-not-gated]
requires:
  - 10-03 (XOS-07's widened `needs:`, which D-26(a) depends on)
  - 10-05 (OBS-05's per-leg seed, which supplies the Windows leg's one asset)
  - 10-07 (CORR-02's rename and the corrected `ci.yml` shard-growth comment)
  - 09-SECURITY.md section 1 (the reframing that bounds TRUST-12's delta)
provides:
  - the `ref`-scoping spec pin (whole-argument-array + call count, two ref values)
  - the `ref` scoping comment lock naming it the sole in-repo control
  - 10-TRUST-EVIDENCE.md -- TRUST-10 by observation, and the TRUST-11/12/13 auditor hand-off
  - 10-SC6-NOTES.md -- D-26(a)/(b) corrected, the falsifiable first-push prediction, the 5-row Live-CI register
affects:
  - "/gsd:secure-phase 10 -- MUST spawn gsd-security-auditor, MUST NOT take the inline short-circuit"
  - Phase 11 (L3 gates its proofs; L1/L2 close on the same push)
  - Phase 12 (inherits TRUST-11's residual risk in the XOS-05 write decision)
tech-stack:
  added: []
  patterns:
    - whole-argument-array deep equality PLUS a separate call-count pin, so an added call and a changed argument redden different cases
    - function-scoped unchanged-ness for a file that legitimately changed (comment-only diff + a pre-existing behavioural pin)
    - DOCS-08 content pins authored as within-one-line phrases, since the matcher is a raw `toContain`
key-files:
  created:
    - .planning/phases/10-os-invariant-releases-mirror/10-TRUST-EVIDENCE.md
    - .planning/phases/10-os-invariant-releases-mirror/10-SC6-NOTES.md
  modified:
    - packages/github-cache/src/action/index.spec.ts
    - packages/github-cache/src/action/index.ts
    - .github/workflows/ci.yml
    - packages/github-cache/src/docs-same-os-claims.spec.ts
decisions:
  - "The `ref` pin is THREE cases, not one assertion: two whole-argument-array cases driven with distinct refs plus a separate call-count pin, because three distinct regressions each redden a different case."
  - "Both phase bases recorded (`ff21b5f` planning base, `06019d4` pre-execution base) rather than choosing one -- they differ only by `.planning/`-only commits, and every source claim was run against both."
  - "`ci.yml`'s stale Windows-leg carve-out was FIXED rather than merely noted, because the plan requires the note and the comment to agree, and the stale half is exactly the reasoning that leads to collapsing the matrix."
  - "TRUST-13 left OPEN and its checkbox unticked. It closes when gsd-security-auditor publishes SECURITY.md, not when this plan lands."
metrics:
  duration: 23m
  tasks: 3
  commits: 4
  files_changed: 6
  completed: 2026-07-29
status: complete
---

# Phase 10 Plan 08: Trust Posture Proven and Handed Off Summary

The `ref` scoping is pinned by three mutation-proven cases and comment-locked as the sole in-repo
control on the mirror; TRUST-10's three "unchanged" claims are recorded as commands with observed
output rather than sentences; and TRUST-11/12 are handed to `gsd-security-auditor` as labelled INPUT
with the arbitration point corrected to `saveCache`, while TRUST-13 stays open by design.

## What was built

| Task | Output | Commit |
|------|--------|--------|
| 1 (RED) | The `ref`-scoping pin: two `it.each` whole-argument-array cases plus a separate call-count pin | `4374d5e` |
| 1 (lock) | The adapter comment widened into a lock naming the property, the two supporting facts, the failure mode and the guard | `1c0b69a` |
| 2 | `10-TRUST-EVIDENCE.md` -- Part A TRUST-10 by observation, Part B the auditor hand-off | `39eefa3` |
| 3 | `10-SC6-NOTES.md` plus two Rule 1 fixes found by writing it | `d4fc928` |

## Task 1 -- the `ref` pin and its lock

**Three cases, because three distinct regressions are in scope and each reddens a different one.**
The mutations were predicted first, then run, then reverted. All three predictions held exactly:

| Mutation | Predicted | Observed |
|----------|-----------|----------|
| `ref` dropped from the paginate options | both ref cases redden, count case green | `2 failed \| 18 passed` -- exactly those two |
| a SECOND, unscoped `octokit.paginate` call added | ONLY the count case reddens, both array cases stay GREEN | `1 failed \| 19 passed` -- the count case alone |
| the `ref` value hardcoded to `refs/heads/main` | ONLY the second ref case reddens, the first stays green | `1 failed \| 19 passed` -- the second case alone |

The middle row is the whole reason the count pin is a separate case: a deep equality on
`.mock.calls[0]` says nothing whatsoever about a SECOND call, and a second unscoped enumeration is
precisely the regression the scoping exists to prevent. The third row is what the two-value drive
buys -- with one ref, a hardcoded literal is indistinguishable from a plumbed parameter.

The endpoint reference is held as a NAMED sentinel and asserted by identity, so swapping
`getActionsCacheList` for an unscoped list endpoint also reddens.

**The lock** was located by the phrase `Scope to` per research correction C-7 (REQUIREMENTS cites
`:40-43`, CONTEXT cites `:42-51`, both stale; the parameter, the comment and the call are three
separate places). It states: what it governs; why nothing else carries it -- `TRUSTED_EVENTS` admits
`push` with NO ref check, AND the sync gate answers a different question (whether THIS RUN may
publish, not which entries a legitimately-running default-branch publisher may see), AND the per-OS
`@actions/cache` version barrier that narrowed the reachable set incidentally is gone since Phase 9;
the failure mode as INFORMATION DISCLOSURE rather than a MISS -- nothing turns red and the mirror
keeps reporting success; and the describe that pins it, so deleting the comment does not delete the
guard. The C-numbered ledger is cited, not restated.

## Task 2 -- TRUST-10 by observation, and the auditor hand-off

### Part A: every claim is a command plus an observed result

**Both bases recorded.** The plan named `ff21b5f` (`docs(roadmap): unwrap Requirements lines so
gsd-tools stops dropping continuation IDs`) as the last commit before this phase's PLANNING; the
orchestrator named `06019d4` (`docs(10): cite context decisions in plans and record planning
completion`) as the last planning commit before any IMPLEMENTATION. The plan's own instruction on a
divergent base is to record both, so both are in the artifact with their subject lines. They differ
only by this phase's eight `.planning/`-only commits, and each source-file claim was run against
both.

| Control | Command | Observed | Status |
|---------|---------|----------|--------|
| C1 (`trust.ts`) | `git diff --stat <base>..HEAD -- trust.ts sync-gate.ts` | prints NOTHING, from BOTH bases | unchanged |
| C2 (`sync-gate.ts`) | same command, second pathspec | prints NOTHING, from BOTH bases | unchanged |
| C16 Actions-cache side | see below -- FUNCTION scope | comment-only diff + a pre-existing pin | unchanged |
| C16 Releases side | `git show ff21b5f:release-asset-name.ts` | pre-rename body is character-for-character the current `isLegacyOsSuffixedAssetName` | changed, ADDITIVELY |
| C9 cleanup delete path | 10-07's mixed-shard dry-run | prunes both families, retains PoC-era and foreign assets | **EXTENDED**, not unchanged |
| `ref` scoping | three mutations above | all three predictions held | newly pinned |

**C16's Actions-cache side is the row that needed care, and the artifact says how it was scoped.**
`cache-key.ts` DOES change this phase (`1 file changed, 25 insertions(+)` -- its prefix lock widened
under RETAIN-05c), so a file-scoped diff would print a non-empty result whose honest reading is
"unchanged" -- exactly the trap. Three steps instead: the file's stat; a `--unified=0` filter for
non-comment changed lines returning **no output at exit 1**, with `--unified=0`'s necessity and the
filter's leading-token limitation both stated rather than glossed; and `isServerProducedKey`'s
seven-case accept/reject pin in `cache-key.spec.ts`, which pre-dates this phase and is untouched by
it, so the behavioural half rests on assertions that were already green.

**The additive claim is PROVEN, not asserted.** `git show ff21b5f:...release-asset-name.ts` returns
the pre-rename `isServerProducedAssetName` body -- the `lastIndexOf('-')` split, the `separator < 0`
early return, `HASH_PATTERN` over the hash half, `CACHE_OS_VALUES.includes` over the OS half. That is
character-for-character the current `isLegacyOsSuffixedAssetName`, only the name differing. So every
previously-accepted name is still accepted and the `||` can only add. The mutual-exclusion mechanism
spec is the second leg, and it matters specifically because RETAIN-04 widened a DELETE filter (C9's
path).

**CORR-05: zero live survivors.** `rg -n 'eslint-disable-next-line no-restricted-syntax'
packages/github-cache/src` returns no output at exit 1, so there is no survivor to attribute
elsewhere. The ten hits a broader `eslint-disable` search returns are all prose or lint-rule test
fixtures, and the artifact enumerates them so the count is not mis-read.

### Part B: the hand-off, and the seven required items

Every item is present. Enumerated with the heading that carries it, as the plan requires:

| # | Required item | Artifact heading |
|---|---------------|------------------|
| 1 | the two claims stated as QUESTIONS | `B1. The two questions, stated as questions` |
| 2 | the proposed classification labelled INPUT | `B2. The proposed classification -- OFFERED AS INPUT ONLY` |
| 3 | the CORRECTED arbitration point with code citations | `B3. Q1's arbitration point, CORRECTED -- it is at saveCache, not at the Release upload` |
| 4 | required reading by path and concrete commit range | `B5. Required reading, by path and by concrete commit range` |
| 5 | the controls in scope with verdict-relevant status | `B6. The controls in scope, with their verdict-relevant status` |
| 6 | the three anti-requirements | `B7. The three anti-requirements, so they can be checked` |
| 7 | the U-01 finding and the line drawn | `B9. U-01, and the line that was drawn` |

Plus `B4` (TRUST-12's exposure delta), `B0` (the INPUT framing, placed BEFORE B2 deliberately), and
`B8` (the process constraint).

**The INPUT framing precedes the proposed classification.** `B0. READ THIS FIRST: everything below
is INPUT, not a conclusion` is at artifact line 229; `B2. The proposed classification -- OFFERED AS
INPUT ONLY` is at line 250. Also stated in the file's own status header at line 3.

**The corrected arbitration point** is recorded with citations located by CONTENT: one enumeration
snapshot before the loop assigned to a `const` and never re-read; a per-hash RESTORE; the restored
bytes uploaded **verbatim**; no re-execution anywhere on that path; and for a given hash the Actions
cache holds **exactly ONE entry**, so both legs upload byte-identical bytes. The race is at
`saveCache` and is not reachable until a second producer exists on another OS -- which the artifact
states **moves TRUST-11's residual risk into the XOS-05 write decision (Phase 12)**, named as a
cross-phase consequence the next phase inherits rather than left implicit.

**Phase 9's range resolves and the count is recorded:** `git rev-list --count 3327a4f..7d467e8`
returns **51**, from `3327a4f docs(08): extract phase learnings` (exclusive) through `7d467e8
docs(phase-09): evolve PROJECT.md after phase completion` (inclusive). Verified before recording.

**`09-EVIDENCE.md` was cited, not spent** -- Phase 11's TEST-08 depends on its pre-Phase-9
producer-attribution snapshot.

### NO VERDICT WAS REACHED, ANYWHERE

Stated explicitly, as the plan requires rather than implies. **No TRUST-13 verdict, severity rating,
or classification appears in `10-TRUST-EVIDENCE.md`, in this SUMMARY, or in any Phase 10 PLAN.md
authored by this plan.** Every classification sentence in Part B is framed as a question (B1) or as
proposed input (B2, which carries the label in its own heading). Part A's `unchanged` / `additively
widened` / `extended` are observations about diffs, and the artifact says so in its opening section
so they cannot be read as security classifications.

`B8` records the process constraint in the artifact itself: `/gsd:secure-phase 10` **must spawn
`gsd-security-auditor` and must NOT take the inline short-circuit**, which fires on exactly this
phase's shape -- a register authored at plan time with no open high-severity row. TRUST-13 stays open
until SECURITY.md exists.

## Task 3 -- SC6 recorded, both corrections applied

**D-26(a), CORRECTION 1:** the claim depends on XOS-07's widened `needs:`, not on the rename alone.
MEASURED on run `30400231720` -- ubuntu enumerated ~`21:21:11Z`, the Windows `integration` leg
finished ~`21:23:13Z` -- with the shard fingerprint being task hash `8059758544828235640` existing
ONLY under `-windows`. Under the rename alone the Windows leg stays the SOLE mirrorer of that hash:
ONE real asset, not zero. The note says plainly that without this dependency named, v0.0.3 reads
D-26(a) as a consequence of the rename and reaches the wrong conclusion about the matrix.

**D-26(a), CORRECTION 2:** "zero assets" is false; "zero REAL TASK assets" is true. The Windows leg
mirrors exactly ONE asset -- its own publish seed -- and that asset is what makes OBS-05
non-vacuous. Both consequences recorded: the predicted count is **`mirrored: 1`, not `0`**, so the
all-restore-MISS warning (which requires `mirrored === 0`) will NOT fire; and **the deferred
single-leg collapse would DESTROY OBS-05**.

**Both halves of the collapse argument sit side by side in one table** -- the FOR half (CONTEXT's
`<deferred>` framing: the leg mirrors zero real task assets, so a second leg buys nothing) and the
AGAINST half (the leg's only asset IS what OBS-05 reads back, so the collapse cannot happen without
re-pricing OBS-05). The note says in as many words that a reader who finds only the first half will
collapse the matrix. The **second, non-expiring** reason for deferral is recorded separately: the
Windows leg is still the only leg that produces Windows-hash entries at all, because the platform
discriminator keeps those task hashes distinct -- and that reason does not become answerable when a
proof lands, unlike the OBS-05 objection.

**D-26(b)** cites the census by SHARD TAG (`cache-mirror-202607`, release id `354838660`, 122 of a
1000-asset cap, **46 `-linux` + 26 `-windows` = 72** OS-suffixed) because the shard rolls over
2026-08-01 and a bare number is unattributable afterwards. Bounded, NOT a correctness bug.

**The first-push prediction is recorded IN ADVANCE with an explicit FALSIFIER** (ubuntu reporting
`mirrored: 0` with `readMisses` equal to `scanned` falsifies it, and points at the cache-VERSION
axis rather than at CORR-02), and it **names ROADMAP as the document being contradicted**: ROADMAP's
Live-CI close says to expect the first such push to publish nothing, which no longer holds because
Phase 9's rotation window is SPENT and because a name rotation is a different mechanism from the
cache-version rotation the warning concerns.

**The Live-CI register has five rows** -- L1 OBS-05's labelled per-leg read-back (10-05), L2 XOS-07's
full-task-set mirror (10-03), L3 CORR-02's warm-mirror republish that gates Phase 11 (10-07), L4
Phase 9's VER-06 cross-OS dogfood pair, L5 Phase 9's OBS-04 rotation signal -- each with its owning
plan, its requirement, what a real runner must show, and its falsification condition. L5 is recorded
as already SPENT so a later all-HIT merge run is not cited as the rotation observation. **No
pre-merge acceptance check was authored for any row**, deliberately: `publish` and `publish-verify`
are both `push`-gated to the default branch, so any check that could pass pre-merge would pass for
the wrong reason.

**Anti-requirement confirmed by reading:** no claim in `10-SC6-NOTES.md` argues cross-OS safety from
publish-leg ordering. Ordering appears twice and in both places carries only a COUNT prediction
(section 1) or a CI guard's sensitivity (L2) -- never a correctness claim about what a reader
receives. The artifact carries that confirmation as its closing section.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 1 - Bug] `ci.yml`'s Windows-leg carve-out cited a pre-XOS-07 measurement as current**

- **Found during:** Task 3, while checking that the note and the `ci.yml` comment agree rather than
  drift -- which the plan's `read_first` explicitly requires.
- **Issue:** the comment read `THE WINDOWS LEG STILL MIRRORS EXACTLY ONE REAL ASSET` and explained
  the nonzero `mirrored` by *"its own `integration` hash, which ubuntu's enumeration snapshot
  predates"*, citing run `30400231720`. That measurement is correct and went stale the moment plan
  10-03 widened `publish`'s `needs:` to `[build, typecheck, test, integration]`: ubuntu's snapshot
  now CONTAINS that hash, so the Windows leg's real-task count is zero and its one remaining asset
  is its own seed. Left as-is, the workflow comment would have contradicted the note on exactly the
  point that drives the matrix-collapse decision.
- **Fix:** the carve-out now reads zero REAL TASK assets plus one seed with `mirrored: 1` named
  explicitly, states that the zero depends on XOS-07's widened `needs:` rather than the rename,
  keeps run `30400231720` as the evidence for the PRE-widening one-real-asset case, warns that
  reverting the `needs:` list silently restores it, and points at `10-SC6-NOTES.md` for the
  both-halves collapse record.
- **Files modified:** `.github/workflows/ci.yml`
- **Commit:** `d4fc928`

**2. [Rule 1 - Bug] The DOCS-08 content pin reddened on that fix, and its shape let count and cause drift apart**

- **Found during:** the full battery after fix 1 -- `docs-same-os-claims.spec.ts` failed on the
  pinned literal. **The guard working, not a defect in it.**
- **Issue:** the row pinned the single phrase `THE WINDOWS LEG STILL MIRRORS EXACTLY ONE REAL ASSET`.
  One phrase covering both the COUNT and its CAUSE meant either could change without the other
  reddening.
- **Fix:** three phrases instead -- the carve-out (`... EXACTLY ONE ASSET -- ITS OWN PUBLISH SEED`),
  the count (`` `mirrored: 1`, NOT 0 ``), and the dependency (`ZERO REAL TASK ASSETS DEPENDS ON
  XOS-07's WIDENED needs:, NOT ON THE RENAME`). Each is deliberately WITHIN ONE LINE of the wrapped
  comment, with a note recording why: `read()` is a raw file read and the matcher is `toContain`, so
  a line-spanning phrase would have to embed the `#` continuation prefix and would then redden on a
  pure re-wrap. The first attempt did embed it and was corrected before committing.
- **Files modified:** `packages/github-cache/src/docs-same-os-claims.spec.ts`
- **Commit:** `d4fc928`

### Judgement calls recorded rather than taken silently

**Both phase bases recorded instead of picking one.** The plan names `ff21b5f`; the orchestrator
named `06019d4`. Neither is wrong -- they answer different questions (pre-planning versus
pre-execution) -- and the plan's own instruction on a divergent base is to record BOTH. Every
source-file claim was run against both bases and both results are transcribed, so the artifact
satisfies either reading and a later reader can confirm the range rather than trust it.

**No TDD `feat` commit was authored, and that is not a gate violation.** Task 1 adds no behaviour:
`ref` was already plumbed through `createPublishClient` before this plan started, and the only
source edit is a comment. The RED was therefore demonstrated against deliberately weakened calls
(all three mutations, observed and transcribed) BEFORE the spec was trusted or committed, and the
commit types are truthful -- `test(10-08)` for the guard, `docs(10-08)` for the comment lock -- rather
than a phantom `feat` for a comment change. `git log` for this plan reads `test` then `docs`, with no
`feat` preceding the `test`.

## Requirements

| Requirement | Status | Why |
|-------------|--------|-----|
| TRUST-10 | **complete** | C1, C2 and C16's enumeration-side filter recorded unchanged by command-plus-observation (C16 at function scope with the method stated); the Releases-side change proven additive by the verbatim body comparison; the `ref` scoping pinned by three mutation-proven cases and comment-locked. Every clause of the requirement's text has a corresponding record. |
| TRUST-11 | **complete** | The threat register (`T-10-04`) and `10-TRUST-EVIDENCE.md` B3 record the arbitration point at `saveCache` with its code citations, the not-reachable-until-a-second-producer condition, and the move of residual risk into the XOS-05 write decision. The `publish-mirror.ts` byte-identity comment rewrite -- the requirement's separate clause -- landed in CORR-02's own commit (`77f675c`, plan 10-07). |
| TRUST-12 | **complete** | `T-10-05` and B4 record the removal of the incidental within-scope OS partitioning leaving the declared discriminator as the sole separation mechanism, and the public-repo exposure delta with its measured per-leg fingerprint -- plus the separation of Phase 9's exposure delta from this phase's attribution delta. |
| TRUST-13 | **NOT ticked -- OPEN by design** | It closes when `gsd-security-auditor` publishes `10-SECURITY.md`, not when this plan lands. Ticking it here would be the self-certification the requirement forbids. |

## Verification

| Check | Result |
|-------|--------|
| `nx run @op-nx/github-cache:test --skip-nx-cache` | **823 passed (823)** across **39 files** |
| `npm run integration` | **4 passed (4)** across 2 files |
| `npm run typecheck` | clean |
| `npm run lint` | clean |
| `npm run format:check` | clean |
| `npm run check:action` | empty bundle diff |
| `npm run fallow:ci` | no issues, 59 entry points |
| `git rev-list --count 3327a4f..7d467e8` | **51**, recorded in the artifact |
| `git diff --stat -- start-cache-server/index.js` | prints nothing |
| ASCII-only, both artifacts and `ci.yml` | `rg '[^\x00-\x7F]'` exit 1 on each |

All `rg` content checks for both artifacts pass: `10-TRUST-EVIDENCE.md` -- `INPUT` 9, `git diff` 4,
`ff21b5f` 5, `comment` 16, `C9` 5, `verbatim` 3, `exactly ONE entry` 1, `anti-requirement` 2,
`gsd-security-auditor` 3, `short-circuit` 2. `10-SC6-NOTES.md` -- `CORRECTION` 2, `30400231720` 7,
`8059758544828235640` 1, `collapse` 7, `only leg that produces` 1, `cache-mirror-202607` 2,
`falsif` 5, `ROADMAP` 7, `SPENT` 3, register rows 5.

## Human-needed

**1. TRUST-13's classification. `/gsd:secure-phase 10` MUST spawn `gsd-security-auditor`.**
The verdict on both questions is NOT reachable from this plan and must not be inferred from its
`<threat_model>` block or from `10-TRUST-EVIDENCE.md` Part B. **Do NOT take `secure-phase`'s inline
short-circuit** even though this phase's register was authored at plan time and shows no open
high-severity threat -- that short-circuit is precisely what TRUST-13 forbids. The auditor's required
reading is listed in the artifact's B5: `09-SECURITY.md` section 1, THREAT-MODEL rows C1/C2/C9/C16,
and Phase 9's range `3327a4f..7d467e8` (51 commits).

**2. Five Live-CI items, all push-to-`main` only.** Consolidated in `10-SC6-NOTES.md` section 4 with
each row's owning plan, required observation and falsification condition. **L3 gates Phase 11.** No
pre-merge acceptance check exists for any of them, deliberately. Two things not to do: do NOT
deliberately break the Windows publish path on `main` to demonstrate L1 (it is mutation-proven
offline; the live run is the confirming observation, not the proof), and do NOT cite a later all-HIT
merge run as L5's rotation observation (that signal is SPENT).

## Self-Check: PASSED

Files created, verified on disk:

- `.planning/phases/10-os-invariant-releases-mirror/10-TRUST-EVIDENCE.md` -- FOUND (432 lines)
- `.planning/phases/10-os-invariant-releases-mirror/10-SC6-NOTES.md` -- FOUND (212 lines)

Commits, verified present in `git log`:

- `4374d5e` -- FOUND, `test(10-08)`, 1 file, +73
- `1c0b69a` -- FOUND, `docs(10-08)`, 1 file, +32
- `39eefa3` -- FOUND, `docs(10-08)`, 1 file created, +432
- `d4fc928` -- FOUND, `docs(10-08)`, 3 files, +250 / -12

`git diff --stat 6d65459..HEAD` reports exactly the 6 files this plan touched and no others. No
commit in this plan deleted a tracked file (`git diff --diff-filter=D` empty for each). No untracked
file was left behind. `.planning/config.json` was already modified before this plan started and was
never staged. Both artifacts and this file are ASCII-clean.
