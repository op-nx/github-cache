---
phase: 260804-lc3
plan: 01
subsystem: ci-prose
tags: [ci, positive-control, comment-lock, docs-correction, xos-03, srv-05]
requires:
  - .github/workflows/ci.yml
  - packages/github-cache/src/docs-same-os-claims.spec.ts
provides:
  - corrected presence-mechanism premise (RESTORED OR WROTE) at all five ci.yml sites
  - corrected failure-implication attribution (SRV-05 read-fault degradation) at both ci.yml sites
  - two new `required` lock phrases on docs-same-os-claims.spec.ts row D
affects:
  - .github/workflows/ci.yml
  - packages/github-cache/src/docs-same-os-claims.spec.ts
tech-stack:
  added: []
  patterns:
    - "replacement-reason corrections: every site proves what it now says, not merely that the false clause left"
    - "per-site required literals, because a cardinality gate cannot localize"
key-files:
  created: []
  modified:
    - .github/workflows/ci.yml
    - packages/github-cache/src/docs-same-os-claims.spec.ts
decisions:
  - "Both defects corrected in ONE commit with the guard that pins them (DOCS-09 precedent)"
  - "REQUIREMENTS.md and ROADMAP.md deliberately NOT edited -- XOS-03 never asserted the narrow premise"
  - "ci.yml:450 deliberately NOT edited -- different claim, guaranteed by a needs: edge"
  - "Dropped a line-distance number from authored prose rather than correcting it -- distances rot like line citations"
metrics:
  duration: ~50min
  completed: 2026-08-04
  tasks: 1
  files: 2
status: complete
---

# Quick Task 260804-lc3: Close the ci.yml positive-control "just saved" defect -- Summary

Corrected two independent false claims in the `integration` positive-control comment block --
a presence-mechanism claim that measurement falsifies and a failure-attribution claim that
self-contradicts inside the same block -- at all eight sites, and pinned the corrected reasons
in the one guard file that can see a comment, in a single commit.

**Commit:** `abb722d2cf3a460d8ba2e91928061442c6bb2830`
**Files:** 2 (`.github/workflows/ci.yml`, `packages/github-cache/src/docs-same-os-claims.spec.ts`)
**Diff:** 106 insertions, 26 deletions -- every changed `ci.yml` content line is `#`-prefixed or blank.

## The eight corrected sites, at POST-EDIT line numbers

Every number below was re-derived from the tree at `abb722d` by phrase search, never copied from
PLAN.md or RESEARCH.md. The edit shifted every line below `:1003` in `ci.yml` by roughly +30.

| # | Post-edit site | Defect corrected | Replacement literal (line) |
|---|---|---|---|
| 1 | `ci.yml:205-212` (`build` job fork-PR block) | presence | `RESTORED OR WROTE` (`:211`) |
| 2 | `ci.yml:1003-1040` (primary block, PART A) | BOTH | `UNCONDITIONAL cache.restoreCache` (`:1006`), `THE DISJUNCTION IS MEASURED` (`:1008`), `404 means the sidecar DID answer` (`:1015`), `SRV-05` (`:1018`), `NON-DETERMINISM` (`:1031`), `REDUNDANT AS A LIVENESS PROOF` (`:1032`), `NEVER OBSERVED` (`:1035`) |
| 3 | `ci.yml:1052-1054` (fork-PR premise, was quoted) | presence | premise restated as the disjunction, quote removed |
| 4 | `ci.yml:1055-1060` (fork-PR second leg, NEW) | presence | `NO WRITE PERMISSION` (`:1056`) |
| 5 | `ci.yml:1065-1071` (escape hatch) | failure-implication | `ADMITS THE DEGRADATION` (`:1067`), `SRV-05` (`:1069`) |
| 6 | `ci.yml:1073-1081` (no-retry-loop) | presence + inversion | `a retry would HIDE` (`:1075`), `NON-DETERMINISM` (`:1076`) |
| 7 | `ci.yml:1083-1093` (placement) | presence, REPLACED not swapped | `INPUT DOES NOT EXIST` (`:1084`) |
| 8 | `docs-same-os-claims.spec.ts:514-574` (row D object) | BOTH | `CORRECTED by quick 260804-lc3` (`:524`), `left the REASONS unguarded` (`:533`), new array entries at `:570-571` |

Site 4 is additive rather than a correction: research's Q3 strengthening, giving the fork argument a
second, independently sufficient leg. Site 7 is the one genuinely different site -- its stated reason
is false on a HIT leg (the key is present BEFORE the Nx run), so it received a premise-INDEPENDENT
replacement reason rather than a phrase swap: `own_hash` is read from `integration-hash.txt`, which
the run.json reader step writes, so the step's INPUT does not exist before the Nx run at all. The
Case-A reason is kept as secondary; the `BEFORE cancel: cache-server` half is untouched.

## MEASURED vs REASONED, kept visibly distinct

This was the plan's single most important quality constraint, and the shipped prose carries it in
its own words at two separate literals:

- **MEASURED** (`ci.yml:1008`): `THE DISJUNCTION IS MEASURED, not defensive: on runs 30907575624 and
  30910935382` -- four leg-observations across those two runs, every leg HIT, wrote nothing, every
  control still returned 200. Both run IDs appear on that one line.
- **REASONED** (`ci.yml:1035`): `THE FAILURE DIRECTION IS NEVER OBSERVED.` No 404 has ever come back
  from this step, so every claim about what a non-200 would MEAN is derived from the code rather than
  measured. Asserting the reasoned half as observed would have been a fresh defect of the same class
  as the one being fixed.

## The two defects, restated

1. **Presence mechanism.** The block said the key is present because the leg's own task had just
   written it. The real invariant is RESTORED OR WROTE: the probed key resolves through an
   UNCONDITIONAL `cache.restoreCache` in `actions-cache-backend.ts`, which is not conditioned on a
   write. Falsified by the two runs above.
2. **Failure implication -- a self-contradiction inside the same block.** The block said a 404 means
   a dead sidecar. Its own `|| true` paragraph (now `:1095-1104`, UNTOUCHED) says a dead sidecar yields `000`,
   and the readiness poll (`:925`) treats 404 as its own proof-of-life signature. A 404 means the
   sidecar ANSWERED. The masquerade agent is `handleGet`'s catch in `src/server/server.ts` degrading
   every backend read fault to a 404 MISS (SRV-05, verified against
   `v0.0.1-REQUIREMENTS.md:35`: "a read fault degrades to a MISS ... writes fail closed"). The
   CONSEQUENCE the old prose stated (`INADMISSIBLE`) is correct for a MISS-then-write leg; only the
   named agent was wrong.

Research's shorthand paths were corrected to the real ones in this SUMMARY and named by bare filename
plus SYMBOL in the shipped prose: `src/lib/select-backend.ts` (`createReadOnlyMemoryBackend`) and
`src/server/server.ts` (`handleGet`). No `file.ext:NN` citation was introduced -- `ci.yml` carries
zero of those and commit `2df3af5` exists to keep it that way.

## What deliberately survived

- **`ci.yml:450`** (`producer just wrote and can restore that entry`) -- byte-identical. A different
  claim about the Windows reuse legs, guaranteed by a `needs:` edge rather than by this probe. It is
  also the positive control proving the presence-absence gate is not vacuous, and its own search
  returns exactly ONE line.
- **Both legitimate `dead sidecar` claims.** `:1046` (`blaming a dead sidecar that was alive`) is the
  historical record of the claim being corrected; `:1096` (`a DEAD SIDECAR -- curl exits 7`) is the
  `|| true` paragraph, where a dead sidecar genuinely does yield `000` -- the fact that makes PART A's
  correction true. PART A points at it rather than restating it.

  **CENSUS CORRECTED post-verification: there are now FOUR `dead sidecar` occurrences, not three.**
  Two are the legitimate survivors above (`:1046`, `:1096`); TWO are new DENIALS -- `:1020`
  (`That degradation, not a dead sidecar, is the masquerade agent this control exists to catch`) and
  `:1070-1071` (`Not a dead / sidecar: that yields 000, as the paragraph below records`), inside the
  escape hatch. The original count here said "a third", missing the second denial.

  **The undercount is this task's own recorded trap, fired one more time.** `:1070-1071` wraps across
  a `#` continuation, so `rg -U -i 'dead\s+sidecar'` returns 3 with exit 0 -- a clean, confident,
  WRONG answer. `\s+` cannot bridge the wrap because the continuation line carries a `#` between the
  two words. The pattern that measures correctly is `rg -U -i 'dead[\s#]+sidecar'`, which returns 4.
  Recorded because the handoff's own warning ("use `-U` with `\s+` for anything that might wrap") is
  INSUFFICIENT for this file's comment prose, and following it exactly still produced the undercount.
- **`ci.yml:1001-1002`** -- row D's two existing pinned phrases, byte-identical, sitting immediately
  above the edit zone.
- **`.planning/REQUIREMENTS.md` and `.planning/ROADMAP.md`** -- NOT edited. Both already say
  `a known-present key` and attribute nothing. **XOS-03 never asserted the narrow premise**; it was
  narrowed at implementation time. This correction RESTORES the requirement's own wording rather than
  revising a requirement. Asserted: `git diff --stat a372b96 HEAD` is EMPTY for both files.

## Row D: the eighth site, not merely the guard

Row D's docstring repeated BOTH defects in a LIVE guard file. It was corrected, and it records why it
did not catch the drift: it pinned the acceptance SET and `left the REASONS unguarded`. The superseded
wording is described BY CONCEPT and deliberately not quoted -- this file's read is RAW and it is its
own subject, so a quoted stale phrase would be indistinguishable from a regression to a repo-wide
search.

Two phrases added to `required`, nothing to `forbidden`:

- `UNCONDITIONAL cache.restoreCache` -- pins the MECHANISM that makes the premise a disjunction.
- `404 means the sidecar DID answer` -- pins the failure-attribution correction.

Each matches **exactly one** `ci.yml` line by count (`:1006` and `:1015` respectively), so neither
spans a hard wrap and neither is a silent false PASS. Both were copied character-for-character out of
the authored `ci.yml` lines, not typed from the plan. The disjunction's own wording ("restored or
saved") is deliberately NOT pinned -- short, generic, and the kind of phrasing that gets legitimately
reworded. `forbidden: []` stays, for the reason three sibling rows already record, and the file's
count of empty `forbidden: []` arrays is still **14**.

## Verification -- all 26 gates PASS

Every `<automated>` gate in the plan's `<verify>` block, run against the final commit:

| # | Gate | Exit |
|---|---|---|
| 1 | ci.yml absence: `own save`\|`just saved` | 0 PASS |
| 2 | ci.yml `:450` positive control survives | 0 PASS |
| 3 | ci.yml absence: `a dead sidecar had masqueraded as a cache MISS` | 0 PASS |
| 4 | ci.yml absence: `sidecar masquerading as a cache MISS` | 0 PASS |
| 5 | survivor: `blaming a dead sidecar that was` | 0 PASS |
| 6 | survivor: `a DEAD SIDECAR -- curl exits 7` | 0 PASS |
| 7 | `THE DISJUNCTION IS MEASURED` + both run IDs | 0 PASS |
| 8 | `NEVER OBSERVED` + `NON-DETERMINISM` + `REDUNDANT AS A LIVENESS PROOF` | 0 PASS |
| 9 | `INPUT DOES NOT EXIST` + `NO WRITE PERMISSION` + `a retry would HIDE` + `RESTORED OR WROTE` | 0 PASS |
| 10 | `SRV-05` count >= 2 | 0 PASS |
| 11 | escape hatch `ADMITS THE DEGRADATION` | 0 PASS |
| 12 | lock phrase 1 matches EXACTLY 1 ci.yml line | 0 PASS |
| 13 | lock phrase 2 matches EXACTLY 1 ci.yml line | 0 PASS |
| 14 | existing pinned phrases byte-identical | 0 PASS |
| 15 | spec: `CORRECTED by quick 260804-lc3` + both new phrases | 0 PASS |
| 16 | spec: `left the REASONS unguarded` | 0 PASS |
| 17 | spec: `forbidden: []` count == 14 | 0 PASS |
| 18 | spec absence: `just-saved` | 0 PASS |
| 19 | spec absence: `dead sidecar masqueraded as a cache MISS` | 0 PASS |
| 20 | `nx run-many -t test,typecheck,build,lint` | 0 PASS |
| 21 | `npm run format:check` | 0 PASS |
| 22 | `npm run check:action` | 0 PASS |
| 23 | HEAD touches EXACTLY 2 files | 0 PASS |
| 24 | HEAD touches the RIGHT 2 files | 0 PASS |
| 25 | ci.yml diff is comment-only | 0 PASS |
| 26 | nothing else modified in tree | 0 PASS |

**The `test` hash rotation was accepted, not worked around, and it PAID.** On the first battery run
after the edit, Nx reported `Cache: 0/4 hit (0%)` -- both edited files are declared `test` inputs
under PARITY-08, so `test` genuinely re-ran (43 files, 1058 tests) rather than replaying a cached
PASS. That is the only thing that proves row D's two new phrases actually MATCH raw `ci.yml` rather
than silently spanning a wrap. `check:action` exit 0 confirms no `start-cache-server/index.js` bundle
drift; run on the MAIN TREE, so the verdict is true (a junctioned worktree `node_modules` produces
false drift).

## Deviations

**[Rule 3 - Blocking] The plan's PART D battery command does not parse.** `npm exec nx run-many -t
test typecheck build lint` fails with `Missing required argument: targets` -- `npm exec` consumes the
flags itself instead of passing them to `nx`. Fixed with the documented form:
`npm exec nx -- run-many -t test,typecheck,build,lint`. The `--` is what fixes the parse; the comma
form is what `run-many --help` prescribes verbatim for multiple targets
(`run-many --targets=lint,test,build`). This is a **plan defect worth carrying forward**, not just a
local workaround -- the same broken invocation will fail for the next executor that copies it.

**[Rule 1 - Bug] A line-distance number in my own authored prose was wrong.** The first draft of PART
A said the file must not read one status code as proof of life "at the poll and as proof of death
eighty lines later". Measured: the readiness poll's 404 acceptance is at `:925` and the sentence
landed at `:1017` -- 92 lines, not 80. The number was accurate only for the ORIGINAL defect's location
at `:1005`. Rather than update it to 92, the number was DROPPED (`at the poll above and as proof of
death in this block`), because a line-distance rots exactly the way the `file.ext:NN` citations that
commit `2df3af5` exists to prevent do. Shipping a measurably-wrong number inside the commit that
corrects false claims would have been the same defect class the task exists to close. Fixed by amend
before any push; the full battery and all 26 gates were re-run against the amended commit.

## EXPLICITLY OPEN -- carried forward, never closed

1. **The control's FAIL direction has NEVER been observed.** There is no 404 on record from this step.
   `404 means the sidecar answered` is derived from the code and is airtight; `the MISS observation is
   INADMISSIBLE` is an evidentiary judgement that has never been exercised. The corrected prose is
   reasoning, like the prose it replaces. Only the presence disjunction is measured. This is stated in
   the shipped prose at `ci.yml:1035`, not only here.
2. **Fork PR behaviour remains CITED, never reproduced.** Unchanged by this task. The escape hatch at
   `ci.yml:1065-1071` STAYS: a fork PR that MISSES still rests entirely on the cited, never-reproduced
   fork-write behaviour. The new `NO WRITE PERMISSION` leg reduces the citation exposure (fork runs
   that HIT no longer need it) but does not eliminate it, and the prose explicitly declines to
   overclaim this as "the fork question is closed".

## GSD handler tax -- what was skipped and why

- **`requirements.mark-complete`: NOT called.** It would have falsely closed requirements on a quick
  task. Traceability is closed once, by the orchestrator, after the verifier runs. Asserted:
  `git diff --stat a372b96 HEAD -- .planning/REQUIREMENTS.md` is EMPTY.
- **`roadmap.update-plan-progress`: NOT called.** This quick task has no ROADMAP phase entry, and the
  handler injects a duplicate plan list into a ROADMAP whose entries are backtick-quoted and
  descriptive. Asserted: `.planning/ROADMAP.md` diff is EMPTY.
- **`state.add-decision`: NOT called.** It writes a U+2014 em dash as its summary/rationale join,
  which is non-ASCII in a committed file. Decisions are recorded in this SUMMARY's frontmatter instead.
- **`state.record-metric`: SKIPPED, deliberately.** It mutates `.planning/STATE.md`, which this task
  is forbidden to stage or touch (the orchestrator holds an uncommitted modification there). Per-plan
  metrics are recorded in this SUMMARY's frontmatter instead. Baselines held: `STATE.md` still has
  exactly **10** non-ASCII lines and `REQUIREMENTS.md` **0**; neither rose.

Both committed files are **100% ASCII** (0 non-ASCII lines each). The commit message carries no
CI-skip token in any form, not even as prose, and no AI attribution trailer.

## Self-Check: PASSED

- `.github/workflows/ci.yml` -- FOUND, modified, in commit `abb722d`
- `packages/github-cache/src/docs-same-os-claims.spec.ts` -- FOUND, modified, in commit `abb722d`
- `abb722d2cf3a460d8ba2e91928061442c6bb2830` -- FOUND in `git log`, 2 files changed
- Working tree clean apart from the orchestrator's `.planning/STATE.md` and the untracked
  `.planning/quick/260804-lc3-.../` documents, neither of which is this task's to stage.
