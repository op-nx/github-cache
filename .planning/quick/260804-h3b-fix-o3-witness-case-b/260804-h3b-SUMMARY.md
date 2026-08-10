---
phase: 260804-h3b
plan: 01
subsystem: ci-observability
tags: [o3-witness, actions-cache-scoping, live-ci-observation, main-window, gh-stack, doc-correction]
status: complete
requires:
  - "the o3-witness Case-B code fix (40e4d21, e5d3cd3), already landed 2026-08-03"
  - "operator authorisation for a temporary main push, branch pushes, and PR create/close"
provides:
  - "the $defaultref clause observed as the SATISFYING clause on a real run (30910935382) -- a first"
  - "the prior-existence delta allowance observed live (30907575624), headSha == its own pre-registration commit"
  - "ROADMAP.md:700-705 superseded in place; v0.0.2-MILESTONE-AUDIT.md corrected at all four sites"
affects:
  - .planning/ROADMAP.md
  - .planning/v0.0.2-MILESTONE-AUDIT.md
tech-stack:
  added: []
  patterns:
    - "pre-registration frozen by a MACHINE BOUNDARY heading, so verdict tokens stay mutable while every predicted value is byte-frozen"
    - "clause attribution by measured exclusion: prove the other disjuncts unsatisfiable rather than asserting the one that fired"
    - "stacked probe PR (base != default branch) to break base_ref == default_ref aliasing"
key-files:
  created:
    - .planning/quick/260804-h3b-fix-o3-witness-case-b/260804-h3b-EVIDENCE.md
  modified:
    - .planning/ROADMAP.md
    - .planning/v0.0.2-MILESTONE-AUDIT.md
decisions:
  - "Superseded both status documents in place rather than deleting the stale claims, per 12-PATTERNS.md S-1 (a correction needs a REPLACEMENT reason)"
  - "Scoped the correction to the two LIVE status documents; left the six frozen phase/quick artifacts alone with forward pointers"
  - "Added no standing spec guard -- the three-ref allowlist, the absent &ref= and the delta floor are already pinned by exact regexes"
  - "Waited for the in-flight PR #16 run to finish before opening the main window, closing the merge-ref recomputation hazard the plan's own T-h3b-05 names"
metrics:
  duration: ~70 min wall (including a spend-limit interruption between STEP 3 and STEP 4)
  completed: 2026-08-04
  tasks: 3
  commits: 3
  files_changed: 3
  window_open: 3m30s (2026-08-04T12:32:08Z to 12:35:38Z)
---

# Quick Task 260804-h3b: Fix o3-witness Case-B Summary

Retired a ROADMAP follow-up that two same-day commits had already fixed, corrected the milestone
audit that had inherited it at four sites, and then observed the fixed path live in two separately
reported sub-claims -- including the `$defaultref` clause that had never once been the satisfying
clause on a real run.

## What happened

The stated task was "fix o3-witness Case-B". The code fix already existed: `40e4d21` dropped the
server-side `&ref=` narrow that filtered out the row proving prior existence, and `e5d3cd3` admitted
the default-branch scope to the client-side ref allowlist. Both landed 2026-08-03, both AFTER the
note describing the defect (`da462b5`, 01:09 the same day), and nobody retired the note -- so the
ROADMAP and the milestone audit were both still asserting an item the repo had closed.

What had genuinely never been observed was the LIVE path. So the task split into a doc correction and
two live sub-claims, reported separately because they prove different things.

### Task 1 -- the doc correction and the pre-registration (`d4dc093`)

`ROADMAP.md` gained a dated `###` STATUS block after the stale paragraph, following the file's own
house style at `:646-647` and `:679-688`. The original paragraph is **byte-identical** -- the ROADMAP
diff contains zero removed lines. `v0.0.2-MILESTONE-AUDIT.md` carries the marker
`SUPERSEDED by quick 260804-h3b` at exactly four sites (frontmatter `tech_debt`, open follow-up 1,
the Tech Debt Summary, the Verdict), with `status: tech_debt` deliberately unchanged because the other
items are untouched.

`260804-h3b-EVIDENCE.md` pre-registered BOTH sub-claims before either run existed, with a
`## THE VERDICT CONTRACT` heading acting as a machine boundary: everything above it is frozen, the
four verdict lines below it are mutable status fields.

**Guard line numbers were re-derived at commit time rather than copied**, which caught one: CONTEXT.md
cites `:806` for the `matched_ref` guard, but that is the `it()` line -- the assertion is at `:816`.
Recorded in both documents, since `2df3af5` exists in this repo specifically to stop citing line
numbers that have moved. Measured guard sites: `:584`, `:634`, `:733`, `:816`, `:827`. Spec count
24 assertions across 2 files, unchanged at task start and task end.

### Task 2 -- sub-claim (a), the prior-existence delta allowance (`dd780f8`)

Task 1's push was the trigger. Run **`30907575624`** carried `headSha` EQUAL to `d4dc093`, the commit
that made the prediction, so the prediction was provably in the tree the run measured.

```
o3-witness: EXISTENCE OK key=nx-cache-16483311331776729079 created_at=2026-08-04T09:29:14.513483000Z started_at=2026-08-04T12:09:10Z delta=9596s margin=30s matched_ref=refs/pull/16/merge
```

Every predicted value held, including the full sub-second `created_at`. Both `integration` legs were
`remote-cache-hit` and both positive controls returned 200, confirming research Q1 live.

**VERDICT SUBCLAIM-A-PRIOR-EXISTENCE-DELTA: CLOSED.**

### Task 3 -- the main window, then sub-claim (b) (`76a9e9b`)

The window commit `W` (`5693d90`) was built by plumbing with `GIT_INDEX_FILE` outside the repo. Both
load-bearing properties were ASSERTED, not trusted: identical trees to the feature tip, and the
feature tip NOT in `W`'s ancestry, so PR #16 could not be marked merged.

Window open **3 minutes 30 seconds** (12:32:08Z to 12:35:38Z): advance, confirm the save at
`refs/heads/main  nx-cache-16483311331776729079  2026-08-04T12:32:44.447744000Z` (assumption A2 held,
key exactly as pre-registered), restore. Then the blocking three-way gate passed -- remote SHA at
`fe25a3f`, `docs/cross-os.md` 404 on `main` (its 200 positive control taken during the window), and
an empty diff against the backup ref -- and only then was the backup ref deleted.

`gh stack link 16 obs/case-b-defaultref-260804-h3b` succeeded at **exit 0**; the exit-9 rollout
fallback was not needed. Draft PR #17, base = the feature branch. Run **`30910935382`**:

```
o3-witness: EXISTENCE OK key=nx-cache-16483311331776729079 created_at=2026-08-04T12:32:44.447744000Z started_at=2026-08-04T12:53:36Z delta=1252s margin=30s matched_ref=refs/heads/main
```

**The attribution, which is what makes this non-vacuous.** `matched_ref=refs/heads/main` alone would
not prove the clause fired. Both other arms of the jq chain were measured empty at observation time:
the probe's own merge ref `refs/pull/17/merge` held only its run-id seed `nx-cache-30910935382`, and
the base scope `refs/heads/gsd/v0.0.2-os-invariant-cross-os-sharing` held **zero rows of any kind**
-- stronger than predicted. `$defaultref` was the only satisfiable arm, so it was the satisfying one.
Outcome (ii) was excluded by measurement too: the hash did not rotate and the ubuntu leg HIT rather
than saving, so the run did not degrade to Case A.

**VERDICT SUBCLAIM-B-DEFAULTREF-CLAUSE: CLOSED. VERDICT MAIN-RESTORE: RESTORED.
VERDICT RESTORE-RUN-RELEASE-WRITE: NONE.**

Teardown ran in this task: stack #18 unstacked, PR #17 closed (never merged), probe branch deleted
both ends. Nothing this task created survives on the public repo.

## Production side effects, as disclosed

The advance run `30909525695` was **FULL GREEN, 26 of 26 jobs**, including both `publish` and both
`publish-verify` legs, and wrote real Release assets into the live `nx-cache-202608` shard. Authorised
and expected, matching the `30807461616` precedent.

The restore run `30909793853` failed on exactly the two legs research Q3 named -- both `publish` legs
at the burned `cache-mirror-202608` tag (`GET 404` -> `POST 422` -> `GET 404`), uploading nothing,
with all 13 other jobs green. The post-window tag census returned only `nx-cache-202608` and `v0.0.1`;
no `cache-mirror-*` release exists at all. **This is AUGUST-BOUNDED** and recorded as such: in
September the tag would be fresh and this check would be expected to come out the other way.

## Deviations from Plan

**1. [Rule 3 - Blocking hazard avoided] Waited for the in-flight PR #16 run before opening the window**

- **Found during:** Task 3 pre-flight
- **Issue:** Task 2's push (as the plan instructs) fired run `30908269720`, which was still in flight.
  Advancing `main` recomputes `refs/pull/16/merge` for every open PR based on `main`, and the plan's
  own threat T-h3b-05 plus research Q5 name that as a hazard for `dogfood-verify`, `consumer-smoke`
  and `hash-parity` -- they can fail on an unreachable merge commit. The plan's pre-flight table did
  not list "no in-flight PR #16 run" as a row, and STEP 11's ordering rule addresses only pushes made
  DURING the window, not a run already running when it opens.
- **Fix:** Polled `30908269720` to completion (`success`) before STEP 4. Cost about 5 minutes.
- **Why this is the conservative choice:** it removes the hazard rather than accepting collateral red
  that would then need explaining away in the evidence.

**2. [Recorded, not a fix] Task 2's collateral-run note was folded into task 3's commit**

- **Issue:** Task 2 asks for a one-line note naming the run that task 2's own push fires. Committing
  that note requires a push, which fires another run, which would need its own note -- unbounded.
- **Resolution:** Run `30908269720` is recorded in the EVIDENCE file under
  `### Collateral run, named so it cannot be mistaken for the observed one`, inside task 3's commit,
  with the regress named explicitly so the choice reads as deliberate.

**3. [Recorded] One frontmatter parenthetical was extended, not preserved byte-for-byte**

- The audit's frontmatter `tech_debt` scalar is a single-line YAML string, so superseding it in place
  meant rewriting the line. Every original word is preserved inside the new scalar, but the closing
  `(ROADMAP.md:700-705)` became `(ROADMAP.md:700-705, superseded in place by the status block that
  follows it)`. This is the one place in either document where original text is not byte-identical.
  The ROADMAP's original paragraph IS byte-identical (zero removed lines in its diff). YAML re-parsed
  clean afterwards via the workspace `yaml` module.

**4. [Recorded] The `Trigger is concrete` sentence was covered by the section status line, not annotated in place**

- The plan flags that sentence as now historical. Annotating it with the marker literal would have
  made five marker occurrences and failed the gate that asserts exactly four. So the section's bolded
  status line names the sentence explicitly and declares it HISTORICAL, and the body is kept verbatim
  as the plan directs.

**5. [Environmental] Spend-limit interruption between STEP 3 and STEP 4**

- Execution halted after the backup ref was pushed but before the advance. `main` was still at
  `fe25a3f`, so the window had never opened and no recovery action was required. On resume the live
  state was independently re-verified (main, backup ref, `W`, probe branch, `W`'s two load-bearing
  properties, and absence of in-flight runs) before STEP 4 ran.

No deviation touched anything under `packages/`, `.github/` or `docs/`, and no spec guard was added.

## Verification

| Check | Result |
|---|---|
| `main` at `fe25a3f865f20f3d4f8a40e96f8cb5717608ba8a` | PASS |
| `docs/cross-os.md` 404 on `main` (200 control taken during the window) | PASS |
| `refs/backups/main-pre-window-260804-h3b` absent | PASS |
| Five pre-existing `refs/backups/*` untouched | PASS -- still 5, all at `fe25a3f` |
| `refs/heads/obs/*` absent | PASS |
| Stack objects on origin | PASS -- `length` 0 |
| PR #16 | PASS -- `main OPEN null` |
| PR #17 | CLOSED, `mergedAt` null -- closed, never merged |
| `npx vitest run -t "o3-witness"` | PASS -- 24 assertions, 2 files, unchanged |
| `ROADMAP.md` lines ending in an enumerated token | PASS -- exactly 2, each with its run id |
| `v0.0.2-MILESTONE-AUDIT.md` marker sites | PASS -- exactly 4 |
| Pre-registration is a byte-exact prefix of the evidence file | PASS -- 159 frozen lines, anchor `d4dc093` |
| Nothing outside `.planning/` changed | PASS |
| ASCII-only in all edited files | PASS (instrument positive-controlled) |

## Self-Check: PASSED

All three claimed files exist; all three commits (`d4dc093`, `dd780f8`, `76a9e9b`) resolve and are on
origin at `76a9e9b55c596d6b5cb2c4896951db36bd43591a`. The probe file is correctly absent from the
feature branch, its content preserved verbatim in the EVIDENCE file.

## What this does NOT prove

Nothing here re-proves the code fix -- 24 assertions already do, and they passed before any run fired.
Sub-claim (a) does not prove (b): (a) matched the run's own merge ref and never evaluated
`$defaultref`. Neither sub-claim exercises the FAIL direction of the witness. And whether GitHub ever
garbage-collects a cache entry whose creating commit became unreachable remains explicitly open on any
horizon longer than the hours-to-weeks measured -- named rather than closed by inference.

One documentation defect was found and deliberately NOT fixed here: `ci.yml:1004` describes the
`integration` positive control's key as "the entry this leg's own task just saved", while the code's
actual invariant is "restored OR saved". Both observation runs demonstrate it -- neither leg saved
anything, yet both controls returned 200. It is left alone because `ci.yml` is a declared `test` input,
so editing it would rotate `test`'s hash and break the pre-registered all-five-targets-HIT shape.
