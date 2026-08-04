# Quick Task 260804-h3b: o3-witness Case-B -- Live Evidence

**Task:** 260804-h3b (fix-o3-witness-case-b)
**Date:** 2026-08-04
**Machine:** Windows 11 arm64, PowerShell Core host, commands run under Git Bash
**Tree:** the MAIN working tree, NOT a worktree -- `test -d .git` returns true (`.git` is a
DIRECTORY, not a file). This check sits here deliberately and in this position: `check:action`
reports FALSE bundle drift when run from a worktree with a junctioned `node_modules`, because
esbuild rewrites module paths with no source edit. Both `11-EVIDENCE.md` and `13-EVIDENCE.md` record
the same check in the same place.

## Headline

Two sub-claims. They prove DIFFERENT things and are reported SEPARATELY. (a) passing is not (b)
proven, and this file never writes it up that way.

| Sub-claim | What it proves | Cost | Observation |
|---|---|---|---|
| (a) the prior-existence delta allowance | The SUBSTANCE of the mechanism `40e4d21` restored: an entry created OUTSIDE this run, matched with a large delta, passes rather than reddening. Exercises the delta allowance and the absent server-side `&ref=` narrow. Does NOT exercise `$defaultref`. | Free -- a `.planning/`-only push to the EXISTING PR #16 branch. No `main` window. | `## OBSERVATION -- sub-claim (a)` |
| (b) the `$defaultref` clause matching | The SPECIFIC clause `e5d3cd3` added: the default-branch scope is admitted by the client-side ref allowlist and is the SATISFYING clause. No real run has ever matched on it -- run `30896484130` matched its OWN merge ref, which is Case A. | A temporary `main` window (authorised), plus a stacked probe PR opened after the window closes. | `## OBSERVATION -- sub-claim (b)` |

## Entry state as measured

Re-measured 2026-08-04 at the start of task 1, before any file was edited. Every row matched the
value the plan carried; nothing moved, so nothing was re-planned.

| Fact | Expected | Measured | Verdict |
|---|---|---|---|
| `main` (remote) | `fe25a3f865f20f3d4f8a40e96f8cb5717608ba8a` | `fe25a3f865f20f3d4f8a40e96f8cb5717608ba8a` | MATCH |
| Local HEAD | `3c67513b1fd6cd93236b06953d6268a49a39d63f` | `3c67513b1fd6cd93236b06953d6268a49a39d63f` | MATCH |
| Feature branch remote tip | `2df3af5f454016305cf1f574db7620ea7dea4bac` | `2df3af5f454016305cf1f574db7620ea7dea4bac` | MATCH (one `.planning/`-only commit behind local HEAD) |
| PR #16 | OPEN, head `gsd/v0.0.2-os-invariant-cross-os-sharing`, base `main` | `{"baseRefName":"main","headRefName":"gsd/v0.0.2-os-invariant-cross-os-sharing","isDraft":false,"mergedAt":null,"state":"OPEN"}` | MATCH |
| Caches rows for `nx-cache-16483311331776729079` | EXACTLY ONE, on `refs/pull/16/merge`, `created_at=2026-08-04T09:29:14.513483000Z` | `refs/pull/16/merge  2026-08-04T09:29:14.513483000Z` (one row, no others) | MATCH |
| Rows for that key on `refs/heads/main` or `refs/heads/gsd/v0.0.2-...` | NONE | NONE -- the key query returns the single merge-ref row above and nothing else | MATCH. This is what makes `$defaultref` the only satisfiable clause for the probe |
| `refs/heads/obs/*` on origin | NONE | empty output | MATCH |
| `refs/backups/main-pre-window-260804-h3b` | ABSENT | empty output | MATCH |
| Stale `refs/backups/*` on origin | five, all at `fe25a3f` | `main-pre-phase13-verify`, `main-pre-publish-verify-window`, `main-pre-window2-260803`, `main-pre-windowA-260803`, `main-pre-windowB-260803` -- all five at `fe25a3f865f20f3d4f8a40e96f8cb5717608ba8a` | MATCH. NOT reused and NOT cleaned up -- out of scope |
| Release tag `cache-mirror-202608` | HTTP 404 (research assumption A1) | `{"message":"Not Found",...,"status":"404"}` / `gh: Not Found (HTTP 404)` | MATCH |
| `repos/op-nx/github-cache/stacks` | `[]` | `[]` | MATCH. Read ONLY as "no stack exists yet", never as proof stacks are enabled here -- `torvalds/linux` returns the same, so the endpoint is universally routable |
| `docs/cross-os.md` | ADDED between `fe25a3f` and HEAD | `git diff --name-status fe25a3f 3c67513 -- docs/cross-os.md` prints `A	docs/cross-os.md` | MATCH. It is the restore probe AND its own positive control |
| Repo `default_branch` | `main` | `main` | MATCH |
| `git config user.email` | `larsbrinknielsen@gmail.com` | `larsbrinknielsen@gmail.com` | MATCH. Public repo, and the window commit lands on its default branch carrying both author and committer identity |
| `git status --porcelain` | nothing but the untracked quick-task directory | `?? .planning/quick/260804-h3b-fix-o3-witness-case-b/` | MATCH |

Ordering proof, re-measured: `git merge-base --is-ancestor da462b5 40e4d21` TRUE and
`... da462b5 e5d3cd3` TRUE. Commit dates measured: `da462b5` 2026-08-03 01:09:35 +0200,
`40e4d21` 2026-08-03 03:13:15 +0200, `e5d3cd3` 2026-08-03 22:27:23 +0200. So the ROADMAP note is
STALE, not wrong.

Guard sites re-derived at commit time with `git grep -n` against
`packages/github-cache/src/dogfood-cross-os.spec.ts`, never copied from the plan: assertions at
`:584` (three-ref jq select, exact regex), `:634` (`default_ref` derivation block), `:733`
(composed URL `.not.toMatch(/ref=/)`), `:816` (`matched_ref` printed on the OK line) and `:827`
(the `-lt 30` floor), inside `it()` blocks opening at `:559`, `:616`, `:711`, `:806` and `:819`.
CONTEXT.md cites `:806` for the `matched_ref` guard, which is that test's `it()` line rather than
its assertion -- recorded because `2df3af5` exists in this repo to stop citing line numbers that
have moved. `npx vitest run -t "o3-witness"` measured 24 assertions passed across 2 files (1047
skipped of 1071) at `3c67513`, matching the count recorded when the fixes landed.

## PRE-REGISTRATION -- sub-claim (a), the prior-existence delta allowance

Written and committed BEFORE the run exists. Never back-edited; the append-only property is proven
mechanically in `## OBSERVATION -- sub-claim (a)`.

**Shape.** A `.planning/`-only push to the EXISTING PR #16 branch
`gsd/v0.0.2-os-invariant-cross-os-sharing`. Task 1's own commit IS the trigger, so the run this
predicts is fired by the push that carries this prediction.

**Why nothing rotates.** Research Q4 measured all five task hashes (`build`, `typecheck`, `test`,
`integration`, `lint`) identical across the addition of one new `.planning/` file, with a
SAME-MODALITY positive control that DID rotate `integration` when a declared input
(`read-integration-hash.mjs`) was dirtied unstaged. So row 2 of that table cannot be an artefact of
the hasher reading only committed state. All five targets therefore HIT, and the ubuntu
`integration` leg writes nothing.

**Expected `o3-witness` success line, named IN FULL before the run:**

```
o3-witness: EXISTENCE OK key=nx-cache-16483311331776729079 created_at=2026-08-04T09:29:14.513483000Z started_at=<the Windows integration step start> delta=<hours, in seconds> margin=30s matched_ref=refs/pull/16/merge
```

The `created_at` is recorded with its FULL sub-second precision exactly as the API prints it
(`2026-08-04T09:29:14.513483000Z`), because the witness echoes the API value verbatim -- a reader
comparing against a truncated `...09:29:14Z` would see a false discrepancy.

**Expected delta SHAPE.** On the order of 10^4 seconds -- hours since 09:29:14Z today -- far above
the `-lt 30` floor. A LARGER delta is STRONGER evidence, and there is deliberately NO upper bound:
`ci.yml:1456-1461` says so in its own words. The delta is recorded as measured, not scored against
a target.

**Expected `matched_ref`: `refs/pull/16/merge`.** That is the run's OWN ref, and that is precisely
the point -- the entry was created by a DIFFERENT, EARLIER run on that same ref, so the delta is
hours rather than seconds. **This does NOT exercise the `$defaultref` clause.** Sub-claim (b) is
the only observation that can.

**Expected collateral.** Both `integration` legs green, and both positive controls
`-> 200 (wanted 200)`. Research Q1 closed the feared 404 by measurement on the real Case-B run
`30768540898`: the ubuntu leg logged `cacheStatus=remote-cache-hit` and the probe still returned
200, because the probed key resolves through an UNCONDITIONAL `cache.restoreCache` at
`actions-cache-backend.ts:219-225` -- a fresh restore against the cache service every call, not a
save-conditioned path.

## PRE-REGISTRATION -- sub-claim (b), the $defaultref clause matching

Written and committed BEFORE the run exists, in the same commit as (a)'s.

**Shape.** A probe branch `obs/case-b-defaultref-260804-h3b` carrying ONE new `.planning/` file,
stacked on the FEATURE branch via `gh stack link 16 obs/case-b-defaultref-260804-h3b`, and opened
as a DRAFT PR only AFTER the `main` window is closed. Research Q5 measured that rewriting
`refs/heads/main` neither deletes nor orphans that scope's cache entries -- 90 main-scope rows
created 2026-08-03 survive the same-day rewind, and the oldest surviving main-scope rows date to
2026-07-19 -- so the observation run does not need `main` to still be advanced.

**Why the base MUST NOT be `main`.** With base = `main`, `base_ref` and `default_ref` are the SAME
STRING, the jq `or` chain is satisfied by the `$baseref` clause before `$defaultref` is ever
reached, and the match is unattributable. `ci.yml:1255-1257` names that exact duplication as "the
reason the gap stayed invisible". The mechanism, not merely the conclusion: a satisfied earlier
disjunct makes the later one unobservable.

**Why base = the feature branch makes `$defaultref` the ONLY satisfiable clause,** with the
measurement behind each arm:

| Arm of the jq `or` chain | Scope it reads | Why it holds no row for the key |
|---|---|---|
| `$ref` | `refs/pull/<probe>/merge` | A fresh PR -- its own merge scope has never had a run, so nothing saved into it |
| `$baseref` | `refs/heads/gsd/v0.0.2-os-invariant-cross-os-sharing` | Measured empty for this key: the caches API returns EXACTLY ONE row for `nx-cache-16483311331776729079` and it is on `refs/pull/16/merge`. A branch push fires no CI (`ci.yml:4-6` triggers on `push` to `main` only), so nothing ever saved into the branch scope |
| `$defaultref` | `refs/heads/main` | The row WILL live here after the window's ubuntu `integration` save |

**Expected `o3-witness` success line:** same key `nx-cache-16483311331776729079`,
`matched_ref=refs/heads/main`, `created_at` equal to the window save's timestamp, and `delta` on the
order of minutes since it.

**THE DISCRIMINATOR, pre-registered because it is what makes the claim non-vacuous. Only the
REACHABLE outcomes are stated.** `ci.yml:1366-1367` binds the jq filter to THIS run's own `$ref`,
its `$baseref` and its `$defaultref`. So for the probe run -- a NEW, differently-numbered PR -- the
09:29:14Z `refs/pull/16/merge` row can NEVER be the match at any allowlist width: that ref is
another PR's own scope, which GitHub does not expose to a different PR's run at all. It is therefore
NOT written up here as a possible FALSIFIED outcome. The two reachable outcomes:

- **(i) `matched_ref=refs/heads/main`**, WITH the own-ref scope and the base-ref scope INDEPENDENTLY
  confirmed to hold no row for the key at observation time. That is **CLOSED**: `$defaultref` was
  the satisfying clause because it was the only satisfiable one.
- **(ii) `matched_ref` equal to the PROBE PR's OWN merge ref.** That is NOT an allowlist finding. It
  means the task hash ROTATED, the probe run's ubuntu leg MISSed and saved into its own scope, and
  the run degraded to Case A. That falsifies research assumption A2 / Q4, NOT the `$defaultref`
  clause. The honest token is **VOID**, with the rotated hash recorded.

**The FAIL shape, also named in advance.** An `o3-witness: FAIL --` line naming the three readable
scopes means no allowed row was found at all. That points at the STEP 6 save having not landed,
rather than at the clause.

**Named risk.** If the delta falls under the 30-second floor the claim is VOID rather than
falsified. It will not in practice -- the Windows `integration` step starts several minutes into a
run -- but the NUMBER is recorded, not the expectation.

**`base_ref != default_ref` is EVIDENCED FROM PR METADATA, not from the log.** The success line
prints `matched_ref` but not `base_ref`. So the probe PR's `baseRefName` and the repo's
`default_branch` are both recorded from the API at observation time.

## THE VERDICT CONTRACT

Everything ABOVE this heading is the frozen pre-registration: tasks 2 and 3 prove mechanically that
this commit's blob is a byte-exact PREFIX of the final file up to this line. The four lines below are
deliberately MUTABLE status fields -- their tokens are rewritten in place as each run reports, which
is the whole point of an enumerated contract. Freezing them too would make the gate self-defeating.
No predicted VALUE above is ever edited to make a gate pass.

`CLOSED` = observed as designed. `FALSIFIED` = the run disproved the thing it was built to prove --
a contrary observation, not merely an unusable one. `VOID` = the run happened but cannot speak to
the claim (a runner fault, an unrelated red, a delta under the floor, or a rotated hash that
degraded the run to Case A). `PENDING` = not observed at all. Each sub-claim's pre-registration
section above enumerates which shapes are REACHABLE for it; no outcome the mechanism cannot produce
is invented here.

```
VERDICT SUBCLAIM-A-PRIOR-EXISTENCE-DELTA: CLOSED
VERDICT SUBCLAIM-B-DEFAULTREF-CLAUSE: PENDING
VERDICT MAIN-RESTORE: PENDING
VERDICT RESTORE-RUN-RELEASE-WRITE: PENDING
```

## Optional follow-up, deliberately NOT taken here

Research Q1 found that the `integration` positive control's COMMENT is NARROWER than its code.
`ci.yml:1004` describes the probed key as "the entry this leg's own task just saved", whereas the
code's actual invariant is "restored OR saved" -- the GET resolves through an unconditional
`cache.restoreCache`, so a key the task RESTORED answers 200 just as readily as one it saved. That
is a DOCUMENTATION defect, not a code defect, and the step is correct as written.

It is NOT bundled into this task for a measured reason: `ci.yml` is a declared `test` input
(research Q4's positive control lists `{workspaceRoot}/.github/workflows/ci.yml` among `test`'s
resolved inputs), so editing it rotates `test`'s hash and turns `test` from Case B into Case A --
breaking the pre-registered "all five targets HIT" shape for no gain to either sub-claim.

## Scope boundary

`.planning/ROADMAP.md` and `.planning/v0.0.2-MILESTONE-AUDIT.md` are the only two artifacts
corrected by this task, and that dividing line is the repo's OWN, not a convenience. Those two are
LIVE status documents: a reader consults them for current state, so leaving a closed item asserted
OPEN in them is a live contradiction. A phase's audit artifacts and the quick-task record are
FROZEN with forward pointers instead -- `STATE.md` states this for Phase 13's audit artifacts in as
many words, and `13-SECURITY.md` already names `13-VALIDATION.md`'s Manual-Only table as its status
of record, so it does not claim to be current. Accordingly `13-SECURITY.md` (around `:332-334`),
`260802-toz-EVIDENCE.md`, `260802-toz-SUMMARY.md`, `260803-0rr-SUMMARY.md`, `260803-3g1-CONTEXT.md`
and the `STATE.md` history rows all still carry the stale sentence and NONE of them is edited. This
is a decision, recorded as such, not an oversight. Both corrections SUPERSEDE and delete nothing:
`12-PATTERNS.md` S-1 is explicit that correcting a claim requires a REPLACEMENT reason, because a
bare deletion leaves a future reader holding a documented argument for undoing the work.

## What this does NOT prove

- **Nothing here re-proves the CODE fix.** 24 assertions already do, and they passed at `3c67513`
  before any run was fired. These observations prove the fixed path RUNS live; they are not the
  guard.
- **(a) does not prove (b).** (a) matches the run's own merge ref and never evaluates
  `$defaultref`. Only (b) can attribute a match to the clause `e5d3cd3` added.
- **Neither sub-claim exercises the FAIL direction of the witness.** Both are PASS-direction
  observations. A red `o3-witness` from a genuinely missing entry is unobserved by this task.
- **Whether GitHub ever garbage-collects a cache entry whose creating commit became unreachable**
  remains EXPLICITLY OPEN on any horizon longer than the hours-to-weeks the Q5 measurements cover.
  It is not plan-relevant -- the observation completes minutes after the restore -- and the
  documented eviction mechanisms are the 7-day unused expiry and the 10 GB LRU. Named rather than
  closed by inference.
- **The restore run's no-write property is AUGUST-BOUNDED.** It rests on the burned name-scoped
  `cache-mirror-202608` tag. In September that tag is fresh, and the `fe25a3f`-era code would create
  a legacy-named release and mirror `fe25a3f`-era entries into it. This task pre-flights the 404 and
  re-checks after the window; it does not fix the underlying shape.

## OBSERVATION -- sub-claim (a)

PRE-REGISTRATION COMMIT: d4dc09384d7bcc8650d76bfe0a4b209874e99dea

SUBCLAIM-A RUN: 30907575624 headSha=d4dc09384d7bcc8650d76bfe0a4b209874e99dea

**The two SHAs are EQUAL.** The pre-registration commit IS the run's head, so every prediction above
was provably in the tree the run measured -- the `13-EVIDENCE.md` idiom, and the property the Phase 13
security audit independently re-verified. Exactly ONE run carried that `headSha` (no re-run), so no
selection was needed; the run was created 2026-08-04T12:05:34Z as a `pull_request` synchronize of
PR #16 and completed `success` at 12:10:45Z.

### The witness lines, quoted

```
o3-witness: H_linux=16483311331776729079
o3-witness: key=nx-cache-16483311331776729079 created_at=2026-08-04T09:29:14.513483000Z started_at=2026-08-04T12:09:10Z delta=9596s margin=30s matched_ref=refs/pull/16/merge
o3-witness: EXISTENCE OK key=nx-cache-16483311331776729079 created_at=2026-08-04T09:29:14.513483000Z started_at=2026-08-04T12:09:10Z delta=9596s margin=30s matched_ref=refs/pull/16/merge
```

### Both `integration` legs, quoted

```
integration (ubuntu-24.04-arm)  integration hash=16483311331776729079 cacheStatus=remote-cache-hit status=0 -> integration-hash.txt
integration (ubuntu-24.04-arm)  positive control: GET /v1/cache/16483311331776729079 -> 200 (wanted 200)
integration (windows-11-arm)    integration hash=4100361685679151443 cacheStatus=remote-cache-hit status=0 -> integration-hash.txt
integration (windows-11-arm)    positive control: GET /v1/cache/4100361685679151443 -> 200 (wanted 200)
```

### Prediction versus measurement

| Predicted | Measured | Verdict |
|---|---|---|
| `key=nx-cache-16483311331776729079` | `nx-cache-16483311331776729079` | PASS |
| `H_linux=16483311331776729079` | `16483311331776729079` | PASS -- so assumption A2's key is confirmed live on the feature tip |
| `created_at=2026-08-04T09:29:14.513483000Z`, full sub-second | `2026-08-04T09:29:14.513483000Z`, byte-identical | PASS. Recording the full precision was the right call -- a truncated `...09:29:14Z` would not have matched the log |
| `matched_ref=refs/pull/16/merge` | `refs/pull/16/merge` | PASS |
| delta on the order of 10^4 s (hours), far above the `-lt 30` floor | `delta=9596s` = 2h 39m 56s | PASS, and the exact figure is recorded rather than the expectation: 9596 s is 0.96 x 10^4, i.e. just UNDER a clean 10^4. The load-bearing halves both held -- it is hours, and it is 320x the floor |
| `margin=30s` | `margin=30s` | PASS |
| `started_at` = the Windows `integration` step start | `2026-08-04T12:09:10Z`, and the Windows leg's hash read is logged at 12:09:26Z | PASS -- consistent, and several minutes into a run that began 12:05:34Z, which is the same reason (b)'s delta will clear the floor |
| ubuntu `integration` HITs and writes nothing | `cacheStatus=remote-cache-hit` | PASS. Nothing entered the merge-ref scope during this run, so the intra-run path cannot explain the match |
| both `integration` legs green | both `success` | PASS |
| both positive controls `-> 200 (wanted 200)` | both `-> 200 (wanted 200)` | PASS. Research Q1's finding holds live |

**One measurement the pre-registration did not predict, recorded because it STRENGTHENS Q1 rather
than contradicting it.** The WINDOWS leg was also `cacheStatus=remote-cache-hit`, so its positive
control returned 200 from a RESTORE. Q1 had only ever measured the Windows leg in the SAVE direction
(`30807461616`, `cache-miss` then 200) and reasoned the restore direction from code. Both directions
of the "restored OR saved" invariant are now measured on a real runner, on both legs. This is also
direct evidence for the documentation defect noted under `## Optional follow-up`: `ci.yml:1004`
describes the probed key as "the entry this leg's own task just saved", and on this run NEITHER leg
saved anything.

### Per-job conclusions, whole run

Zero failures. `24` jobs: 21 `success`, 3 `skipped`, 0 `failure`, 0 `cancelled`. Listing the
non-success entries in full so nothing is absorbed into a headline:

| Job | Conclusion | Note |
|---|---|---|
| `consumer-smoke` | skipped | Its normal state on a `pull_request` run |
| `publish` | skipped | Push-gated to `main`; correctly not reached |
| `publish-verify` | skipped | Same push gate |

All 21 others -- `fallow`, `lint`, `ppe`, `pack-check`, `format-check`, `typecheck`,
`action-bundle-drift`, `test`, `hash-parity` x2, `integration` x2, `dogfood-seed`, `build`,
`dogfood-verify` x2, `build-windows`, `typecheck-windows`, `test-windows`, `hash-parity-compare`,
`o3-witness` -- concluded `success`.

### What this observation does and does not settle

Sub-claim (a) is **CLOSED**: an entry created OUTSIDE this run, on a ref this run could read, was
matched with a delta of 9596 seconds and the witness printed `EXISTENCE OK` instead of reddening.
That is the delta allowance and the absent server-side `&ref=` narrow, both exercised live for the
first time.

**This does NOT prove the `$defaultref` clause.** The witness matched `refs/pull/16/merge` -- the
run's OWN ref, satisfying the `$ref` arm of the jq chain. `$defaultref` was never reached, let alone
satisfied. The clause `e5d3cd3` added remains unobserved until sub-claim (b).
