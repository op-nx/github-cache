---
phase: quick
plan: 260808-wxg
type: quick
quick_id: 260808-wxg
title: Close the open-by-design live-CI observations via a three-hop temporary main window
date: 2026-08-08
autonomous: false
wave: 1
depends_on: [260808-u2q]
files_modified:
  - .planning/phases/09-os-invariant-actions-cache-version/09-VALIDATION.md
  - .planning/phases/10-os-invariant-releases-mirror/10-EVIDENCE-LIVE-CI.md
  - .planning/phases/10-os-invariant-releases-mirror/10-VERIFICATION.md
  - .planning/quick/260808-wxg-close-the-two-open-by-design-observation/260808-wxg-EVIDENCE.md
must_haves:
  truths:
    - "The window OPENS and CLOSES in the same session: origin/main ends at fe25a3f, the CI workflow ends ENABLED, and PR #16 ends OPEN with mergedAt still null."
    - "PR #16 is CLOSED before the open push and REOPENED after the restore, so GitHub cannot mark it merged when main transiently contains its commits."
    - "Every observation is recorded against a named run id and a verbatim log line, not paraphrased."
    - "Hop 2 observes publish SKIPPED on a FORCED push whose tip carries the gate -- the first behavioural evidence of the 260808-u2q clause in the skip direction."
    - "No observation is claimed that the window did not actually produce; a leg that does not run is recorded as NOT OBSERVED."
  artifacts:
    - .planning/quick/260808-wxg-close-the-two-open-by-design-observation/260808-wxg-EVIDENCE.md
  key_links:
    - "09-VALIDATION.md:263 Manual-Only Verifications -- the OPEN row is plan 09-08's live publish-verify (windows-11-arm) green"
    - "10-VERIFICATION.md:9-16 live_ci_only_items -- THREE items, not one"
    - ".github/workflows/ci.yml publish job -- if: !cancelled() && push && !github.event.forced"
---

# Close the open-by-design live-CI observations via a three-hop temporary main window

## SCOPE CORRECTION, made during pre-flight

The handoff described item 3 as two observations: "Phase 9's first post-merge
`publish-verify` (windows-11-arm) leg, and Phase 10's OBS-01 summary + shard census."

MEASURED: **there are FOUR**, because `10-VERIFICATION.md` carries THREE `live_ci_only_items`
and the handoff named only the first. All four are push-gated and all four are samplable from
the SAME open push, so this costs no extra window -- but recording two and calling the item
closed would have left two live-CI items silently open inside a closed milestone, which is
the exact defect class quick task 260808-lpt existed to clean up.

| # | Source | Observation | Pre-registered expectation |
|---|---|---|---|
| O-A | 09-VALIDATION.md:263 (the `[ ] OPEN` row) | `publish-verify (windows-11-arm)` GREEN -- job conclusion SUCCESS, by name, in hop 1's run | conclusion `success` for the job literally named `publish-verify (windows-11-arm)`. Its LOG CONTENT is O-C's business, not O-A's. |
| O-B | 10-VERIFICATION.md item 1 | ubuntu `publish` leg's OBS-01 summary + shard census | nonzero `mirrored`, `readMisses 0`, no all-restore-MISS warning, `nx-cache-*` names present, legacy `<hash>-<os>` names not growing |
| O-C | 10-VERIFICATION.md item 2 | both `publish-verify` leg logs | windows leg logs a windows-produced payload and `mirrored-by: windows`; ubuntu leg logs `linux` for both; `publish (windows)` summary reports `mirrored: 1`, not 0 (OBS-05) |
| O-D | 10-VERIFICATION.md item 3 | `publish` ordering vs `integration (windows-11-arm)` | `publish` starts only after `integration (windows-11-arm)` completes; census shows the Windows integration hash mirrored by the ubuntu leg too (XOS-07) |

Record each as OBSERVED or NOT OBSERVED against a run id. **A leg that does not run is NOT
an observation.** Do not infer O-C from O-B.

### O-A's source row carries a STALE EXPECTATION, and correcting it is part of this task

`09-VALIDATION.md:263`'s OPEN row says the closing observation is a `'linux'` producer named
on the Windows `publish-verify` leg, with the token `win32`. **That is impossible by
construction and always was.** `publish-verify` is a per-leg SELF round-trip under D-15 /
OBS-05: `read-back.ts` sets `const readerOs = cachePlatform()` and interpolates `readerOs` as
BOTH reader and producer, and `assertPublishedByThisLeg` then ENFORCES that they match -- so a
`'linux'` producer on the Windows leg is the exact condition the assertion REJECTS. The OS
token is `windows`, not `win32` (`CACHE_OS_VALUES = ['windows','macos','linux']`). The
`'linux'`-producer line belongs to `dogfood-verify`, which that same table already records as
VER-06 **CLOSED LIVE**.

So the row's EXPECTATION is what is wrong, not the observation. O-A is therefore the job's
GREEN CONCLUSION, and the Windows leg's self-round-trip CONTENT is O-C. **Do not loose-match
O-C's line onto O-A** -- that would record a false closure. And do not record O-A as NOT
OBSERVED on the strength of the stale string, which would leave the row open forever for a
reason that is not true.

Fix the row in `09-VALIDATION.md` as part of this task, superseding in place with the reason.
Had this been executed as written, the window would have been spent and the row still open.

## PRE-FLIGHT -- every item BLOCKS the open push

Run these in order. Any failure stops the window before it starts.

1. **PR #16 must be CLOSED first.** `gh pr close 16`. This is the single most important step
   and it is NOT optional. PR #16's base is `main` and its head is the branch about to be
   pushed there. With it open, GitHub sees `main` containing every commit of the PR and
   auto-closes it **as merged**, setting `mergedAt` -- a de-facto merge of v0.0.2, which is
   prohibited outright. PRECEDENT: PR #12 was closed first for exactly this reason during the
   Phase 13 window (STATE.md:447). After the window, `gh pr reopen 16` and assert
   `mergedAt == null`.
2. **Backup the restore point to a pushed ref**, so the restore target survives a lost
   session: `git push origin fe25a3f:refs/backups/pre-wxg-window`. Do NOT reuse or delete any
   existing `refs/backups/*` -- there are five, they are evidence for 260808-u2q, and they are
   reused by name, which is why they cannot count occurrences.
3. **Verify the workflow-disable mechanism BEFORE relying on it.** `gh workflow list --all`
   must show `CI` with id `313666980` and state `active`. Hop 3 depends on being able to
   disable and re-enable it.
4. **Confirm shard headroom.** `nx-cache-202608` held 78 assets against the 1000/month cap at
   plan time. Re-measure; a near-cap shard makes hop 1's publish fail for reasons unrelated
   to anything being tested.
5. **Assert the starting state:** `origin/main == fe25a3f`, working tree clean, local HEAD
   pushed, and `git merge-base --is-ancestor fe25a3f HEAD` true (so hop 1 is a fast-forward).
6. **Commit and push this plan and the recovery note BEFORE the window opens.** The window is
   the only stateful operation in this milestone; its recovery procedure must exist on the
   remote before it is needed.

## THE THREE HOPS

The hop-2 design is what makes the skip direction provable without a merge. A `push` event
runs the workflow at the PUSHED TIP, so a rewind landing on a tip that CARRIES the gate is
gated, while the final restore -- landing on `fe25a3f`, which predates the gate -- is not.

`ci.yml` at `43f3612` is EXECUTABLY IDENTICAL to `ci.yml` at the feature tip -- 823 identical
lines once comments and blanks are stripped. Verify it THIS way:

```bash
diff <(git show 43f3612:.github/workflows/ci.yml | rg -v '^\s*(#|$)') \
     <(git show HEAD:.github/workflows/ci.yml     | rg -v '^\s*(#|$)') && echo "IDENTICAL"
```

**NOT with `git diff --stat`, and NOT described as byte-identical.** An earlier revision of
this plan said byte-identical and cited the `--stat` check as empty. That was FALSE when
written: commit `d70c667` -- this same session's own correction to the gate's rationale
COMMENT -- landed before this plan was committed and makes `--stat` report 18 insertions. The
claim was falsified by the very habit of writing reasons next to gates.

The experiment SURVIVES intact, because every one of those 18 lines is a comment: the
executable content is identical, so between hop 1 and hop 2 the workflow's behaviour is a
constant and `forced` is the ONLY variable. That is a controlled experiment; the original
two-hop design would have compared two genuinely different workflow versions.

### Hop 1 -- OPEN (fast-forward, gated workflow, forced=false)

```bash
git push origin HEAD:main          # PLAIN push. Never --force.
```

Pre-registered: `publish` RUNS, `publish-verify` RUNS on both OS legs. This hop carries all
four observations O-A..O-D.

**Wait for the run to CONCLUDE before hop 2** -- but not for the reason an earlier revision
gave. `cancel-in-progress` is FALSE for push in this workflow, so a rewind does NOT cancel the
in-flight run; it QUEUES a second one behind it. The hazard is therefore confusion and
interleaved evidence, not destruction: two runs in flight, and an observation attributed to
the wrong one. Wait anyway, and record each observation against an explicit run id.

**Hop 1's shard writes are PERMANENT.** They are real Release assets and the restore does not
remove them. That is intended -- it is what makes O-B and O-D observable -- but the census
after this window is legitimately larger, and that is not a leak to clean up.

### Hop 2 -- SKIP PROOF (rewind, gated workflow, forced=true)

```bash
git push --force-with-lease origin 43f3612:main
```

Pre-registered: `publish` SKIPPED, `publish-verify` SKIPPED by cascade, and NO
`POST /repos/op-nx/github-cache/releases` in any leg. The four `needs:` jobs still run.

If `publish` RUNS here, the gate is broken in the fail-open direction: record it and proceed
to hop 3 immediately.

### Hop 3 -- RESTORE (rewind, UNGATED workflow -- suppression required)

```bash
gh workflow disable 313666980
git push --force-with-lease origin fe25a3f:main
# assert NO new run was created for this push
gh workflow enable 313666980
```

`fe25a3f` predates the gate, so its workflow would publish. Disabling is the suppression.
**Re-enable immediately and assert `active` again** -- a repo left with CI disabled is a worse
outcome than the defect this avoids.

## RECOVERY -- if this session ends mid-window

**The window is OPEN whenever `origin/main != fe25a3f`.** Anyone resuming, human or agent:

1. `git rev-parse origin/main`. If it is `fe25a3f`, the window is CLOSED; check only steps 3-5.
2. If not: `gh workflow disable 313666980`, then
   `git push --force-with-lease origin fe25a3f:main`, then `gh workflow enable 313666980`.
   The restore point is also at `refs/backups/pre-wxg-window` (list it with
   `git ls-remote origin 'refs/backups/*'` -- backup refs are NOT visible to `git branch -r`).
   `gh workflow disable` is NOT idempotent: on an already-disabled workflow it errors, which is
   harmless here -- read the state with `gh workflow list --all` first rather than trusting the
   command's exit code.
3. `gh workflow list --all` -- CI must be `active`. If disabled, enable it.
4. `gh pr view 16` -- must be OPEN with `mergedAt: null`. If closed, `gh pr reopen 16`. **If
   `mergedAt` is NOT null, the milestone was de-facto merged: STOP and tell the maintainer.**
   **Do the restore FIRST (step 2) and reopen the PR only once `origin/main == fe25a3f`.**
   Reopening while `main` is still forward re-creates the auto-close-as-merged condition the
   close existed to prevent. Note the reopen is the one step with no precedent here: PR #12 was
   closed and then REPLACED, never reopened -- so verify the result rather than assuming it.
5. Do NOT re-open a window to "finish"; re-run this plan from pre-flight.

## POST-WINDOW -- assert all five, then record

- `origin/main == fe25a3f`
- CI workflow `active`
- PR #16 OPEN, `mergedAt: null`
- the five pre-existing `refs/backups/*` untouched
- nothing merged

Write `260808-wxg-EVIDENCE.md` with, per observation, the run id, job name, conclusion, and
the VERBATIM log line. Mark anything the window did not produce as NOT OBSERVED with the
reason. Then update `09-VALIDATION.md`'s OPEN row and `10-VERIFICATION.md`'s
`live_ci_only_items` in place, superseding forward rather than back-editing sealed text.

## WHAT THIS DOES NOT PROVE

Hop 2 proves the gate skips a forced push whose tip carries it. It does NOT prove the final
restore is protected -- it is not, and will not be until `main` itself contains the clause,
which happens at merge, which the maintainer has placed LAST, after additional code and
security reviews. Until then every window's final hop needs the hop-3 suppression. Say this
in the evidence file rather than letting a green hop 2 read as "restores are safe now".
