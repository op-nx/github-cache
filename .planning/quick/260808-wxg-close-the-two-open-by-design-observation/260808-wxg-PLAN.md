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
| O-A | 09-VALIDATION.md:263 (the `[ ] OPEN` row) | `publish-verify (windows-11-arm)` green with a `'linux'` producer named | log line `github-cache round-trip read-back: cache HIT for <run_id> on win32 with bytes matching a 'linux'-produced payload` |
| O-B | 10-VERIFICATION.md item 1 | ubuntu `publish` leg's OBS-01 summary + shard census | nonzero `mirrored`, `readMisses 0`, no all-restore-MISS warning, `nx-cache-*` names present, legacy `<hash>-<os>` names not growing |
| O-C | 10-VERIFICATION.md item 2 | both `publish-verify` leg logs | windows leg logs a windows-produced payload and `mirrored-by: windows`; ubuntu leg logs `linux` for both; `publish (windows)` summary reports `mirrored: 1`, not 0 (OBS-05) |
| O-D | 10-VERIFICATION.md item 3 | `publish` ordering vs `integration (windows-11-arm)` | `publish` starts only after `integration (windows-11-arm)` completes; census shows the Windows integration hash mirrored by the ubuntu leg too (XOS-07) |

Record each as OBSERVED or NOT OBSERVED against a run id. **A leg that does not run is NOT
an observation.** Do not infer O-C from O-B.

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

`ci.yml` at `43f3612` is BYTE-IDENTICAL to `ci.yml` at the feature tip (verified with
`git diff --stat 43f3612 HEAD -- .github/workflows/ci.yml`, empty). So between hop 1 and hop
2 the workflow file is a constant and `forced` is the ONLY variable. That is a controlled
experiment; the original two-hop design would have compared two different workflow versions.

### Hop 1 -- OPEN (fast-forward, gated workflow, forced=false)

```bash
git push origin HEAD:main          # PLAIN push. Never --force.
```

Pre-registered: `publish` RUNS, `publish-verify` RUNS on both OS legs. This hop carries all
four observations O-A..O-D. Wait for the run to CONCLUDE before hop 2 -- a rewind mid-run
cancels it and destroys the measurement.

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
   The restore point is also at `refs/backups/pre-wxg-window`.
3. `gh workflow list --all` -- CI must be `active`. If disabled, enable it.
4. `gh pr view 16` -- must be OPEN with `mergedAt: null`. If closed, `gh pr reopen 16`. **If
   `mergedAt` is NOT null, the milestone was de-facto merged: STOP and tell the maintainer.**
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
