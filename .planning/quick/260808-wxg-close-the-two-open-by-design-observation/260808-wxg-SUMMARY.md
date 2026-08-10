---
context: quick
quick_id: 260808-wxg
slug: close-the-two-open-by-design-observation
title: Close the open-by-design live-CI observations via a three-hop temporary main window
tasks_completed: 4
total_tasks: 4
status: complete
executed: 2026-08-08
completed: 2026-08-11
completed_by: /gsd:complete-milestone v0.0.2 pre-close resolution
base: d70c667
head: fbfd88a
commits: c4b532f, 7b4b5b3, b276bdc, 6708929, fbfd88a
branch: gsd/v0.0.2-os-invariant-cross-os-sharing
pushed: transiently, to main, in a window opened and closed in the same session
window_opened: 2026-08-08T22:19:01Z
window_closed: 2026-08-08T23:24:26Z
window_duration: 65m25s
runs:
  hop_1: 31281406708
  hop_2: 31283360543
  hop_3: none (suppressed by design)
---

# Quick Task 260808-wxg: Close the live-CI observations via a three-hop main window - Summary

**Written retroactively on 2026-08-11**, during the `/gsd:complete-milestone v0.0.2` pre-close
gate, which flagged this task as `missing` its SUMMARY. The work itself completed on 2026-08-08
and its full record has been on disk since: `260808-wxg-EVIDENCE.md` (321 lines) carries every
observation, run id and verbatim log line. Nothing here is reconstructed from memory -- this file
is a navigational summary over that evidence, the plan, and the commit range `d70c667..fbfd88a`.
The v0.0.2 milestone audit had already consumed these results.

## What it did

Opened a temporary window on `main` to sample observations that are **structurally unreachable
from a pull request**, because the `publish` and `publish-verify` jobs are push-gated
(`on.push` `branches: [main]`). Three hops, all executed and closed in one sitting.

| Hop | Push | Ref moved | Pushed at | Run | Result |
|---|---|---|---|---|---|
| 1 | plain fast-forward | `fe25a3f` -> `b276bdc` | 22:19:01Z | `31281406708` | success, 0 failed jobs |
| 2 | `--force-with-lease` | `b276bdc` -> `43f3612` | 23:10:03Z | `31283360543` | success, 24 jobs, exactly 2 skipped |
| 3 | `--force-with-lease`, CI disabled | `43f3612` -> `fe25a3f` | 23:24:26Z | NONE (suppression worked) | window closed |

## Scope correction, made during pre-flight

The handoff described item 3 as **two** observations. Measured: there are **four** --
`10-VERIFICATION.md` carries THREE `live_ci_only_items` and the handoff named only the first.
All four were samplable from the same open push, so the correction cost no extra window.
Recording two and calling it closed would have left two live-CI items silently open inside a
closed milestone -- the exact defect class quick `260808-lpt` existed to clean up.

## The four observations -- all OBSERVED, all from hop 1's run `31281406708`

Run-id attribution is airtight: the round-trip seeds embed the run id itself
(`feed03` + `31281406708`).

| # | Observation | Outcome |
|---|---|---|
| O-A | `publish-verify (windows-11-arm)` green, job `93164047226` | OBSERVED -- success, plus its self-round-trip line |
| O-B | ubuntu `publish` leg OBS-01 summary + shard census, job `93163556127` | OBSERVED -- but one expectation FALSIFIED (see below) |
| O-C | both `publish-verify` leg logs + `publish (windows)` mirrored count | OBSERVED -- OBS-05's `mirrored: 1, not 0` confirmed twice over |
| O-D | `publish` ordering vs `integration (windows-11-arm)`, XOS-07 census | OBSERVED -- `publish` started 2s after integration completed |

### O-A's source row carried an impossible expectation, and the task fixed it

`09-VALIDATION.md:263`'s OPEN row asked for a `'linux'` producer named on the **Windows**
`publish-verify` leg, with the token `win32`. That is impossible by construction and always was:
`read-back.ts` sets `const readerOs = cachePlatform()` and interpolates it as BOTH reader and
producer, and `assertPublishedByThisLeg` exists to REJECT a producer that is not this leg. The OS
token is `windows`, not `win32`. So the row's **expectation** was wrong, not the observation. The
row was superseded in place with the reason. Had the plan been executed as written, the window
would have been spent and the row still open.

## The controlled experiment (hop 1 vs hop 2) -- the core result

A genuine controlled experiment, not two observations placed side by side. Same branch, same
event, same `publish` job. Executable workflow held **constant**: `ci.yml` at `43f3612` and at
`b276bdc` differ by 18 lines, all comments -- verified by stripping comment and blank lines from
both sides, **823 lines each, `diff` exit 0**. The only variable is `github.event.forced`.

| | Hop 1 | Hop 2 |
|---|---|---|
| push kind | plain fast-forward | forced rewind |
| `github.event.forced` | false | true |
| `publish` | **ran** (both legs success) | **skipped** |
| `publish-verify` | **ran** (both legs success) | **skipped** (cascade) |
| release assets written | 9 | 0 |

Hop 2 is the first behavioural evidence of quick `260808-u2q`'s `!github.event.forced` clause in
the SKIP direction; hop 1 supplies the RUN direction from the same workflow text. Hop 2's run was
POPULATED, not absent -- 24 jobs, 22 success, exactly 2 skipped -- so the skip is distinguishable
from "no run happened".

## FINDING -- `readMisses` is 63, not 0, and two source rows disagreed with each other

`10-VERIFICATION.md` item 1 pre-registered `readMisses 0`. Both publish legs reported **63**,
identically. Falsified.

The falsification is not the interesting part. `09-VALIDATION.md`'s OBS-04 section already
recorded the prior window (run `30400231720`, 2026-07-28) measuring 41/41 -- so **two rows in the
same milestone, describing the same job's summary table, disagreed about what healthy looks
like**, and nothing reconciled them. The symmetry itself is the documented signal, not an anomaly:
`09-VALIDATION.md:291-296` pre-registered symmetric restore-MISS as the fingerprint of a VER-01
PATH-caused cache-version rotation. What genuinely needed triage was the **"one-shot" framing** --
the count did not decay, it grew 41 -> 63 while `scanned` grew 47 -> 149.

Deliberately NOT diagnosed in this task. It was root-caused later by quick `260809-2s6`: 48 of
the 63 were prior runs' single-use CI seed entries the mirror was re-enumerating as cache content;
only 15 were real Nx hashes, all pre-rotation.

## Deviations from the plan

1. **Hop-3 suppression was operator-run.** `gh workflow disable 313666980` was DENIED to the agent
   by the auto-mode permission classifier -- correctly, since no message named that command as
   authorized. The maintainer ran the disable and re-enable; the agent performed only the restore
   push between them. **Every future window hits the same denial** -- budget for it rather than
   discovering it mid-window with `main` forward.
2. **Job summaries were read through the maintainer's browser.** OBS-01 counts never reach a log
   (`writeCountSummary` is `core.summary` only; `publish-mirror.ts` has zero `core.info` calls),
   and GitHub exposes job summaries through neither the REST API nor an unauthenticated fetch. The
   agent first recorded them NOT OBSERVED; the maintainer directed it to `playwright-cli attach
   --extension=chrome`. That is what produced the falsified `readMisses` finding. Generalises to:
   **an observation living only in a job summary is invisible to `gh` and will be silently
   recorded as unobservable unless someone reaches for a browser.**
3. **Read-only pre-flight ran before the PR close.** The plan's ordering is emphasis, not a data
   dependency; running assertions first avoids a pointless close/reopen if one fails.
4. **`10-EVIDENCE-LIVE-CI.md` was declared in `files_modified` but not touched.** The commit range
   shows it unchanged (last modified by `385f563`, before this task). The observations landed in
   `09-VALIDATION.md`, `10-VERIFICATION.md` and this task's own EVIDENCE file instead. Recorded
   for accuracy; nothing was lost.

## Permanent state left behind, and the post-window assertions

Hop 1's writes are REAL and the restore does not undo them -- that is what makes O-B, O-C and O-D
observable. `nx-cache-202608` grew from **78 to 87 assets** (+9, zero removed), far under the
1000-asset cap. One new backup ref, `refs/backups/pre-wxg-window`, at `fe25a3f`.

All five post-window assertions pass: `origin/main == fe25a3f`, CI workflow `313666980` active,
PR #16 OPEN with `mergedAt`/`mergedBy`/`mergeCommit` all null, the five pre-existing
`refs/backups/*` untouched, and nothing merged during the window (newest merged PR predates it by
10 days). The reopen is now proven -- PR #12 had been closed and REPLACED, never reopened, so the
step had no precedent here.

## What this does NOT prove

Hop 2 proves the gate skips a forced push **whose pushed tip carries the gate**. It does NOT make
the final restore safe: `fe25a3f` predates the clause, so a restore push landing there runs the
UNGATED workflow and would attempt real production publish writes -- which is why hop 3 required
disabling CI at all. **A green hop 2 must not be read as "restores are safe now."**
