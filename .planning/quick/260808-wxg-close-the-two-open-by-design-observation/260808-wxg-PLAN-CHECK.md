# Plan check -- 260808-wxg temporary main window

Adversarial pre-execution review of a LIVE PRODUCTION, stateful, outward-facing operation.
All findings re-derived independently; the command behind each is quoted. Read-only
throughout: no push, no PR state change, no workflow toggle, no ref created.

Measured at: origin/main = fe25a3f, local HEAD = c4b532f, tree clean.

## ISSUES FOUND -- 2 BLOCKERS, 9 WARNINGS

---

## BLOCKERS

### B1. Observation O-A is structurally unobservable as pre-registered. BLOCKS.

O-A pre-registers this line from `publish-verify (windows-11-arm)`:

    github-cache round-trip read-back: cache HIT for <run_id> on win32 with bytes matching a 'linux'-produced payload

`publish-verify` cannot emit that. The job is a PER-LEG SELF round-trip since D-15/OBS-05:
the reader derives its own seed, and asserts the asset was published by ITS OWN leg.

    rg -n -B3 -A10 "cache HIT" packages/github-cache/src/roundtrip/read-back.ts
    rg -n "readerOs" packages/github-cache/src/roundtrip/read-back.ts
    rg -n -A18 "async function assertPublishedByThisLeg" packages/github-cache/src/roundtrip/read-back.ts

`const readerOs = cachePlatform()` is the LOCAL leg's OS, and the success line interpolates
`readerOs` as BOTH the reader and the producer -- "matching the '<readerOs>'-produced payload
this leg seeded, published by this same leg (label 'mirrored-by: <readerOs>')". A `'linux'`
producer on the Windows leg is not merely unlikely, it is what `assertPublishedByThisLeg`
exists to reject.

Two further mismatches in the same string:

- The OS token is `windows`, not `win32`.
  `git grep -n "CACHE_OS_VALUES = "` -> `['windows', 'macos', 'linux']`, with win32 -> windows.
- The wording is "matching THE '<os>'-produced payload this leg seeded", not "matching A
  'linux'-produced payload".

The `'linux'`-producer phrasing belongs to a DIFFERENT job, `dogfood-verify`
(packages/github-cache/src/action/index.ts, the "github-cache dogfood verify: cache HIT ..."
line) -- which is exactly the job 09-VALIDATION.md already cites as VER-06 CLOSED LIVE. The
OPEN row conflates "publish-verify (windows-11-arm) green" (observable) with a cross-OS
producer signal that publish-verify stopped producing when D-15/OBS-05 reshaped it. The plan
copied the stale row verbatim without re-deriving it against the code.

**The plan contradicts itself.** O-C pre-registers, for the same job, "windows leg logs a
windows-produced payload and mirrored-by: windows" -- which matches the code. O-A and O-C
cannot both be true.

Why this BLOCKS rather than being fixed after the fact: the plan's discipline is
pre-registration, and its own must_have forbids claiming an observation the window did not
produce. Executed as written, the operator either records O-A NOT OBSERVED (leaving the
09-VALIDATION row open forever, when the row's expectation is what is wrong), or loose-matches
O-C's line onto O-A and records a false closure. Re-registering the expectation after reading
the logs destroys the pre-registration property the whole plan rests on. Fix the expectation
before the window, not after.

Fix: re-register O-A as "publish-verify (windows-11-arm) conclusion success, self-seed
round-trip line naming this leg as both producer and publisher", and note that the cross-OS
'linux'-producer half is already closed under VER-06 via dogfood-verify. Correct
09-VALIDATION.md's OPEN row in the same pass -- it carries the same stale string.

### B2. The "BYTE-IDENTICAL" control claim is false as written. BLOCKS the pre-flight, not the experiment.

The plan states: "ci.yml at 43f3612 is BYTE-IDENTICAL to ci.yml at the feature tip (verified
with `git diff --stat 43f3612 HEAD -- .github/workflows/ci.yml`, empty)."

    git diff --stat 43f3612 HEAD -- .github/workflows/ci.yml
    -> 1 file changed, 18 insertions(+)
    git rev-parse 43f3612:.github/workflows/ci.yml HEAD:.github/workflows/ci.yml
    -> ec100b87... / be4b7a74...   (different blobs)

The claim was already false when the plan was committed: d70c667 touched ci.yml and precedes
c4b532f, the commit that adds this plan.

    git log --oneline 43f3612..HEAD -- .github/workflows/ci.yml   -> d70c667

**The experiment itself survives.** The 18 lines are ALL comments -- verified by stripping
comment and blank lines from both sides:

    git show 43f3612:.github/workflows/ci.yml | rg -v '^\s*#' | rg -v '^\s*$' > /tmp/a.yml
    git show HEAD:.github/workflows/ci.yml    | rg -v '^\s*#' | rg -v '^\s*$' > /tmp/b.yml
    diff /tmp/a.yml /tmp/b.yml   -> exit 0, 823 lines each

So `forced` really is the only variable between hop 1 and hop 2, and the controlled-experiment
argument holds. What does not hold is the operator instruction: a careful operator running the
cited verification during pre-flight gets a non-empty result and has no guidance on whether to
abort. Restate as "executable YAML identical (823/823 lines); the 18-line delta is
comment-only" and cite the strip-and-diff command instead.

---

## WARNINGS

### W1. The stated reason for waiting between hops is wrong. Does not block.

The plan says "a rewind mid-run cancels it and destroys the measurement". Push runs are not
cancellable in this workflow:

    git grep -n -e "cancel-in-progress" HEAD -- .github/workflows/ci.yml
    -> concurrency: group: ci-${{ github.ref }}
       cancel-in-progress: ${{ github.event_name == 'pull_request' }}

Hops 1 and 2 both push refs/heads/main, so they share group ci-refs/heads/main, and
cancel-in-progress is false for push. A hop-2 push during hop 1 QUEUES; it does not cancel.
Separately, c4b532f stays reachable through refs/heads/gsd/v0.0.2-os-invariant-cross-os-sharing
after the rewind (`git ls-remote --heads origin`), so hop 1's actions/checkout is not orphaned
either.

Keep the instruction -- serialising the hops is still correct for clean run attribution and
avoids the one-pending-run-per-group supersede rule. Replace the reason.

### W2. Two stale line references. Does not block.

- Plan cites 09-VALIDATION.md:263 for the OPEN row. It is at line 282.
  `rg -n '\[ \]' .planning/phases/09-*/09-VALIDATION.md`
- Plan cites 10-VERIFICATION.md:9-16 for live_ci_only_items. The block spans 8-20.

Both sections are findable; only the anchors rotted.

### W3. The window puts a NEW scheduled workflow onto main. Unmentioned. Does not block.

    git cat-file -e fe25a3f:.github/workflows/windows-regression-detector.yml   -> exit 128 (absent)
    git diff --stat fe25a3f HEAD -- .github/workflows/windows-regression-detector.yml -> 120 insertions

windows-regression-detector.yml (probe-crossos, id 320974202) does not exist at the restore
point. While the window is open, main carries it, and its `schedule: '23 4 * * *'` becomes live
from the default branch. Impact is low -- `permissions: contents: read`, it deletes nothing --
and a same-session window will not reach 04:23 UTC. It only matters if the window is stranded
overnight. Worth one line in the recovery section.

cleanup.yml (the destructive one) is NOT a concern: identical at both SHAs.

    git diff --stat fe25a3f HEAD -- .github/workflows/cleanup.yml   -> exit 0, no output

Neither scheduled workflow has a push trigger, so no hop fires them directly.

### W4. O-B's "legacy names not growing" has no pre-window baseline instruction. Does not block.

The plan's pre-flight measures shard HEADROOM, not the legacy-name census O-B needs. Measured
here so it can be pasted in as the baseline:

    gh release view nx-cache-202608 --json assets --jq '.assets[].name'
    -> 78 assets; 78 match ^nx-cache- ; 0 match -(linux|windows|win32|darwin)($|\.)

Baseline is 78 assets, all nx-cache-*, ZERO legacy <hash>-<os>. Record it before hop 1.

### W5. Hop 1 leaves permanent production state the restore does not undo. Does not block.

publish uploading to nx-cache-202608 IS the point of hop 1, but the POST-WINDOW section asserts
five things and none of them acknowledges that the shard permanently gains assets. "Nothing
merged" is true; "nothing left behind" is not, and the evidence file should say so alongside
the after-census.

### W6. `gh workflow disable` is not idempotent in the recovery path. Does not block.

Recovery step 2 unconditionally runs `gh workflow disable 313666980`. In the
died-between-disable-and-push case the workflow is already disabled and the command is likely
to error, stalling a resumer who is following the steps literally. Add "ignore an
already-disabled error".

### W7. Recovery does not forbid reopening PR #16 while the window is open. Does not block.

Step ordering (restore at 2, PR at 4) implies it, but step 4 is the alarming one and a resumer
may jump straight to it. Reopening #16 while main still contains its commits re-creates exactly
the auto-merge condition pre-flight step 1 exists to prevent. State the precondition inside
step 4.

### W8. The close is proven; the REOPEN is not. Does not block.

    gh pr view 12 --json state,mergedAt,headRefName
    -> CLOSED, mergedAt null, head gsd/v0.0.2-os-invariant-cross-os-sharing

STATE.md records that PR #12 was closed first and verified mergedAt=null after both the push
and the restore -- on the SAME head branch as #16. Excellent precedent for the close. But #12
was never reopened; it was REPLACED by #16. Name the fallback (open a fresh PR) so a refused
reopen is not read as a failure state.

### W9. The new backup ref is the least discoverable restore pointer. Does not block.

refs/backups/* is outside the default fetch refspec, so refs/backups/pre-wxg-window will not
appear in `git branch -r` for someone with no context. Three ORDINARY branches already point at
the restore point and would:

    git ls-remote --heads origin
    -> backup/main-before-phase10-verify, backup/main-before-phase11-verify  (both fe25a3f)

Mention them in recovery as the no-context path. The refs/backups/ push remains fine; note also
that the recovery procedure itself lives only on the feature branch -- 43f3612 does not contain
this plan, so after hop 2 main does not carry it either.

---

## CONFIRMED SOUND

**Merge risk (highest severity checked, no path found).** Exactly one open PR:

    gh pr list --state open --json number,baseRefName,headRefOid
    -> only #16, base main, head c4b532f (== local HEAD)

    gh pr view 16 --json state,mergedAt,autoMergeRequest  -> OPEN, null, null
    gh api repos/op-nx/github-cache/branches/main/protection -> 404 Branch not protected
    gh api repos/op-nx/github-cache/rulesets -> []
    gh api repos/op-nx/github-cache --jq '{allow_auto_merge}' -> false

No branch protection, no rulesets, no merge queue, no auto-merge request, no second PR whose
head would become reachable. Closing #16 removes the only auto-close-as-merged path, and the
mechanism is empirically proven on this exact head branch (W8). Hops 2 and 3 are rewinds and
cannot mark anything merged. The plan's reasoning is correct and its precedent is real.

**43f3612 is the right hop-2 target on all three counts.**

    git merge-base --is-ancestor 43f3612 HEAD              -> exit 0  (rewind, not a new tip)
    git grep -n -e "github.event.forced" 43f3612 -- .github/workflows/ci.yml
      -> if: ${{ !cancelled() && github.event_name == 'push' && !github.event.forced }}
    (identical expression at HEAD; executable YAML identical -- see B2)

**fe25a3f genuinely lacks the gate, so hop 3's suppression is required.**

    git grep -n -e "github.event.forced" fe25a3f -- .github/workflows/ci.yml   -> exit 1
    git grep -c -e "runs-on" fe25a3f -- .github/workflows/ci.yml               -> 14  (positive control passes)

Backed empirically TWICE, not once. Two prior restore-shaped push runs at fe25a3f both
concluded FAILURE -- 30825636788 (the documented incident) and 30909793853:

    gh run list --branch main --limit 8 --json databaseId,event,conclusion,headSha

**Hop 2 will produce a run, and the skip will be distinguishable from a no-run.** ci.yml has no
paths / paths-ignore filter -- `on: push: branches: [main]` only. The workflow defines 21 jobs;
on hop 2 all of them run except publish and publish-verify, so "publish skipped" appears inside
a populated run rather than as an absent one.

**The cascade skip is correct.** publish-verify carries `if: github.event_name == 'push'` with
`needs: publish` and no always() / !cancelled(), so the default needs-success gate applies and a
SKIPPED publish skips it.

**Hop 2's "no release POST" assertion is sound.** publish is the only release-asset writer;
dogfood-seed PUTs an Actions cache entry, not a Release asset. Nothing else in ci.yml reaches
the mirror path.

**O-D's ordering claim is structurally guaranteed.** publish declares
`needs: [build, typecheck, test, integration]`, and needs on a matrix job waits for every leg,
so publish cannot start before integration (windows-11-arm).

**O-C and O-D are achievable -- the 2026-08-02 publish-verify breakage is resolved.**

    gh run view 30909525695 --json jobs
    -> publish (ubuntu/windows) success; publish-verify (ubuntu/windows) BOTH success

**The FOUR-observations scope correction is correct.** 10-VERIFICATION.md really carries three
live_ci_only_items, and the 09-VALIDATION OPEN row is a fourth. All four are push-gated and
samplable from one push.

**Pre-flight numbers that had not rotted.**

- Workflow CI id 313666980, state active -- `gh workflow list --all`. Exact.
- Five pre-existing refs/backups/*, all at fe25a3f; pre-wxg-window free --
  `git ls-remote origin 'refs/backups/*'`. Exact.
- nx-cache-202608 holds 78 assets against the 1000 cap. Still exactly 78; ample headroom.
- Starting state: origin/main == fe25a3f, tree clean, local HEAD pushed,
  `git merge-base --is-ancestor fe25a3f HEAD` exit 0 (hop 1 is a fast-forward). All true now.

**Recovery is complete at every death point.** Walked all seven (after PR close, after backup,
after hop 1, after hop 2, after disable, after hop 3 push, before reopen). Each lands in a state
the recovery section's steps 1-5 restore, including the awkward one -- died after the hop-3
push, where main is already correct but CI is disabled and step 1 still routes to the step-3 CI
check. The gaps are W6, W7 and W9 only; none leaves the repo unrestorable.

---

## Verdict

Two BLOCKERS, both plan-text defects with cheap fixes, both to be applied before the window
opens: B1 because a wrong pre-registration cannot be corrected after the observation without
destroying the pre-registration, B2 because the pre-flight otherwise instructs a check that now
fails with no guidance.

Nothing found that makes the window itself unsafe. The merge-avoidance design, the hop-2
target, the hop-3 suppression and the recovery procedure are all sound and, where the plan
claims precedent, the precedent is real.
