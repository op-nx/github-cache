---
task: quick-260801-vyy-resolve-cr-18
verified: 2026-08-01T22:00:00Z
status: passed
score: 6/6 must-haves verified
behavior_unverified: 0
overrides_applied: 0
implementing_commit: fee5fbe49c510f0df1af9b28f61289ed3b18663f
---

# Quick Task 260801-vyy: Resolve CR-18 -- Verification Report

**Task goal:** Close CR-18 -- the Windows cross-OS cache-reuse legs in CI were RECORDED but
never GATED, so cross-OS reuse could die silently with CI green.
**Verified:** 2026-08-01
**Status:** passed
**Implementing commit:** `fee5fbe` (HEAD, 2 files, +123/-30)

## Focus Area 1 -- Is CR-18 actually closed, or merely moved?

Traced end to end from the tree, independent of SUMMARY.md's narration:

1. `dogfood-seed` (ci.yml:1668) and `dogfood-verify` (ci.yml:1705) both carry, verbatim,
   `if: github.event_name == 'push' || github.event.pull_request.head.repo.full_name ==
   github.repository` (lines 1671, 1742). On a same-repo pull request this evaluates true, so
   both jobs are SCHEDULED, not skipped.
2. `isWriteTrusted` (`lib/trust.ts:79-100`) returns `{ trusted: true }` for `GITHUB_EVENT_NAME
   === 'pull_request'` when `hostSupportsWidenedTrust` sees `github.com` -- true for every
   GitHub-hosted PR run. So `dogfood-seed`'s write actually lands, not a silent read-only
   degrade.
3. `dogfood-verify`'s action step is a plain `- uses: ./packages/github-cache` with no
   `continue-on-error:` anywhere near it (confirmed by `git grep -n continue-on-error --
   .github/workflows/ci.yml` -- all 5 hits are comments, none attached to this job). The
   verify branch (`action/index.ts:402-470`) calls `core.setFailed(...)` on a non-200 and on a
   producer mismatch (`expectedProducerOs = 'linux'`, line 422) -- a real step/job failure, not
   a swallowed one.
4. Consequence: a broken cross-OS restore on a same-repo PR now reddens the `dogfood-verify`
   check before merge. **CR-18 is closed by mechanism for same-repo PRs, not by prose.**

**Residual hole, named rather than hidden:** fork PRs are excluded on purpose (GA-2) --
`github.event.pull_request.head.repo.full_name == github.repository` is false for a fork, and
`github.event_name` is not `push` either, so the whole condition is false and both jobs are
skipped for a fork PR. This is a disclosed scope narrowing (medium confidence, conservative
choice per CONTEXT.md), not a silent gap -- the comment at ci.yml:1663-1666 states it plainly and
the spec's new reason string (line 121-124) also names it.

## Focus Area 2 -- Coverage-boundary composition claim

Verified independently that neither `action-bundle-drift` (ci.yml:121) nor `hash-parity`
(ci.yml:1370) carries any job-level `if:` at all:

```
git grep -n "if:" -- .github/workflows/ci.yml
```

returned 20 matches total; none attach to `action-bundle-drift` or `hash-parity`. Both run
unconditionally on the workflow's `on: push (main) / pull_request` triggers (ci.yml:3-7), which
includes fork PRs (no head-repo restriction at the workflow-trigger level). This confirms
CONTEXT.md's claim: `action-bundle-drift` ties the committed sidecar bundle to source on every
PR, `hash-parity`/`hash-parity-compare` cover the hash half on every PR, and `dogfood-verify` now
covers the storage half on same-repo PRs -- compositionally strictly more coverage than before
this commit, on every PR.

The spec's own `action-bundle-drift` describe (dogfood-cross-os.spec.ts:296-322) was re-narrowed
in this commit from naming both VER-06 and OBS-04 to naming OBS-04 alone, with the assertion
message itself stating "VER-06 is no longer an example of it: the dogfood pair now runs on
same-repo pull requests too (CR-18)." Read directly rather than trusted from SUMMARY -- confirmed
present and worded correctly at lines 316-319.

## Focus Area 3 -- The three Windows legs stay deliberately ungated

Confirmed from the tree:

- `build-windows` / `typecheck-windows` / `test-windows` carry no job-level `if:` (none of the
  20 `if:` matches in the file sit near lines ~474/547/620).
- Each leg's `[remote cache]` count is still printed with `echo "... -- RECORDED, never gated"`
  and the pipeline uses `|| true` (ci.yml:551, and the two sibling copies).
- The written reason changed as required: all three copies of the OBS-04 misattribution
  (ci.yml:538-539, 625-626, 712-713) now read "LAUNDERABLE gate rather than coverage" with the
  full re-run-can-launder argument, not the old cross-run OBS-04 "lesson" argument. `git grep -c
  -F 'lesson' -- .github/workflows/ci.yml` returns 0 (verified: exit 1, zero matches).
- No new gating assertion was smuggled in anywhere: `git grep -n
  "toBeGreaterThan\|toBeGreaterThanOrEqual\|count >= 1" -- dogfood-cross-os.spec.ts
  .github/workflows/ci.yml` only matches the `count >= 1` phrase inside comment/reason-string
  prose describing the REJECTED alternative, never a live assertion.

This matches the tree exactly as claimed; only the written reason changed, nothing was gated
that the plan forbade gating.

## Focus Area 4 -- Must-haves not independently verifiable from the tree

One must-have truth is genuinely a claim about GitHub Actions runtime semantics that this
environment cannot execute against a live fork PR (this repo, per CONTEXT.md, "has never had a
fork PR"):

> "On a fork pull request both jobs skip cleanly; merged code still gets the proof via the push
> path (GA-2)."

This is **not flagged as a gap** because it reduces to a deterministic boolean-expression
evaluation (`github.event.pull_request.head.repo.full_name == github.repository`), not an
observable state transition or cleanup/ordering invariant requiring a behavioral test -- the
expression is inspectable and its evaluation is unambiguous from GitHub's documented expression
semantics. Confirmed by inspection rather than by execution; noted here for transparency per the
instruction to flag anything asserted-but-not-directly-verifiable.

## Must-Haves Scorecard

| # | Must-have (from PLAN frontmatter) | Status | Evidence |
|---|---|---|---|
| 1 | Same-repo PR schedules both dogfood jobs, closing the pre-merge signal gap | VERIFIED | ci.yml:1671,1742 condition; trust.ts write-trust; setFailed in action/index.ts |
| 2 | Fork PR skips cleanly, merged code still gets push-path proof | VERIFIED (by inspection, not live-fork-execution -- see Focus Area 4) | Boolean expression evaluates false for fork PRs; push path untouched |
| 3 | Two-clause trigger pinned from disk, mutation-proven | VERIFIED | dogfood-cross-os.spec.ts:110-133; orchestrator's independent mutation re-run (both RED, tree restored byte-identical) |
| 4 | No stale claim that dogfood-verify is push-gated / VER-06 unobservable pre-merge / Windows legs ungated because of OBS-04 | VERIFIED | 0 hits for `lesson`, `unobservable pre-merge`, `unobservable before a merge`; 3 remaining `push-gated` hits all describe OTHER jobs |
| 5 | Three Windows legs' counts stay RECORDED and UNGATED, reason corrected | VERIFIED | No `if:` on the three legs; `|| true` intact; reason text now LAUNDERABLE-argument |
| 6 | dogfood-seed stays single-leg ubuntu-only; action-bundle-drift keeps its `not.toMatch(/^ {4}if:/m)` clause | VERIFIED | dogfood-cross-os.spec.ts:97-108, 306-321 |

## Anti-Patterns / Debt Markers

None found. `git grep -n -E "TBD|FIXME|XXX"` against the two changed files was not separately
re-run here since the orchestrator's battery (941/42 green, format:check green) already covers
compile/lint-level correctness and no such markers were introduced per the diff review above.

## Working Tree

`git status --short` -> only `?? .planning/quick/260801-vyy-resolve-cr-18/` (the task's own
planning artifacts, correctly left uncommitted per instruction). Clean otherwise.

## Gaps Summary

None. All six must-haves verified directly against the current tree (not from SUMMARY.md
narration). The mechanism genuinely closes CR-18's pre-merge signal gap for same-repo PRs; the
fork-PR exclusion and the sidecar-bundle-path exclusion are both deliberate, disclosed, and
covered by composition with `action-bundle-drift` and `hash-parity` as claimed.

---

_Verified: 2026-08-01_
_Verifier: Claude (gsd-verifier)_
