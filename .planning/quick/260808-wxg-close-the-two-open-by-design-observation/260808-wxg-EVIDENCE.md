---
phase: quick
plan: 260808-wxg
quick_id: 260808-wxg
title: Evidence -- three-hop temporary main window
date: 2026-08-08
window_opened: 2026-08-08T22:19:01Z
window_closed: 2026-08-08T23:24:26Z
window_duration: 65m25s
runs:
  hop_1: 31281406708
  hop_2: 31283360543
  hop_3: none (suppressed by design)
---

# Evidence -- 260808-wxg three-hop temporary main window

Executed end to end in one sitting on 2026-08-08. The window was OPEN (`origin/main !=
fe25a3f`) for **65m25s**, from 22:19:01Z to 23:24:26Z, and is CLOSED as of this record.

## The three hops, as executed

Push times are the server's own, from `GET /repos/op-nx/github-cache/events`, not the
local clock:

| Hop | Push | Ref moved | Pushed at | Run | Result |
|---|---|---|---|---|---|
| 1 | `git push origin HEAD:main` (plain, fast-forward) | `fe25a3f` -> `b276bdc` | 22:19:01Z | `31281406708` | success, 0 failed jobs, 11m22s |
| 2 | `git push --force-with-lease origin 43f3612:main` | `b276bdc` -> `43f3612` | 23:10:03Z | `31283360543` | success, 24 jobs, exactly 2 skipped |
| 3 | `git push --force-with-lease origin fe25a3f:main`, CI disabled | `43f3612` -> `fe25a3f` | 23:24:26Z | NONE (suppression worked) | window closed |

Pre-flight passed on every item: `origin/main == fe25a3f`, clean tree, HEAD pushed,
`fe25a3f` an ancestor of HEAD, CI workflow `313666980` active, shard at 78/1000, plan and
recovery procedure already on the remote. PR #16 was CLOSED before the open push and
REOPENED after the restore.

The read-only pre-flight items were run BEFORE the PR close, so that a failed assertion
would not have cost a needless close/reopen cycle. The plan's ordering puts the PR close
first for emphasis, not as a data dependency.

## The controlled experiment (hop 1 vs hop 2)

This is the core result, and it is a genuine controlled experiment rather than two
observations placed side by side.

- Same branch (`refs/heads/main`), same event (`push`), same `publish` job.
- Executable workflow held CONSTANT: `ci.yml` at `43f3612` and at `b276bdc` differ by 18
  lines, ALL of them comments. Verified by stripping comment and blank lines from both
  sides -- **823 lines each, `diff` exit 0**. Not asserted as byte-identical, which is
  false: commit `d70c667` (this session's own correction to the gate's rationale comment)
  makes `git diff --stat` report 18 insertions.
- The ONLY variable is `github.event.forced`.

| | Hop 1 | Hop 2 |
|---|---|---|
| push kind | plain fast-forward | forced rewind |
| `github.event.forced` | false | true |
| `publish` | **ran** (both legs success) | **skipped** |
| `publish-verify` | **ran** (both legs success) | **skipped** (cascade) |
| release assets written | 9 | 0 |

Hop 2 is the first behavioural evidence of the `260808-u2q` `!github.event.forced` clause
in the SKIP direction. Hop 1 supplies the same clause's RUN direction from the same
workflow text, which is what makes the pair a control rather than a single-sided check.

Hop 2's run was POPULATED, not absent: 24 jobs, 22 success, exactly 2 skipped
(`publish`, `publish-verify`). `ci.yml` has no paths filter, so the skip is visible inside
a full run and is distinguishable from "no run happened". The shard census was unchanged
at 87 across hop 2 -- no release POST.

## The four observations

All four were sampled from hop 1's run `31281406708` (head `b276bdc`, event `push`,
conclusion `success`). Run-id attribution is airtight: the round-trip seeds embed the run
id itself (`feed03` + `31281406708`).

### O-A -- publish-verify (windows-11-arm) green. OBSERVED.

Job `93164047226`, conclusion **success**, started 22:27:13Z, completed 22:30:23Z.

Verbatim, from the `Run node packages/github-cache/dist/roundtrip/read-back.js` step:

```
2026-08-08T22:30:17.3605130Z github-cache round-trip read-back: cache HIT for feed031281406708 on windows with bytes matching the 'windows'-produced payload this leg seeded, published by this same leg (label 'mirrored-by: windows'); the real publisher/reader round-trip is closed.
```

**The source row's expectation was wrong, and the log proves it rather than merely
contradicting it.** `09-VALIDATION.md`'s OPEN row asked for a `'linux'` producer named on
the Windows leg, with the token `win32`. The line above says `on windows`, `'windows'`-produced,
and "matching THE ... payload", against the row's `win32`, `'linux'`, and "matching A".
All three mismatches are structural, not incidental: `read-back.ts:373` sets
`const readerOs = cachePlatform()` and interpolates `readerOs` as BOTH reader and producer,
and `assertPublishedByThisLeg` exists to REJECT a producer that is not this leg. A `'linux'`
producer on the Windows leg is the exact condition the assertion refuses to pass.

O-A is therefore the job's GREEN CONCLUSION plus its self-round-trip line. The cross-OS
`'linux'`-producer signal belongs to `dogfood-verify`, which the same table already records
as VER-06 CLOSED LIVE.

### O-B -- ubuntu publish leg OBS-01 summary and shard census. OBSERVED, one expectation FALSIFIED.

Job `93163556127` (`publish (ubuntu-24.04-arm)`), conclusion success, 22:22:09Z-22:23:08Z.

The OBS-01 counts live ONLY in the job summary: `index.ts:213` calls `writeCountSummary`,
which is `core.summary.addHeading(...).addTable(...)` and nothing else, and
`publish-mirror.ts` contains ZERO `core.info` calls (13 `core` references, all warnings or
failures). No count reaches the log, GitHub exposes job summaries through neither the REST
API nor an unauthenticated page fetch, and the summaries are lazy-loaded behind a "Load
summary" control. They were read by driving the maintainer's signed-in Chrome via
`playwright-cli --extension` (see the deviations section).

Verbatim, both legs:

```
publish (ubuntu-24.04-arm) summary        publish (windows-11-arm) summary
github-cache publish                      github-cache publish
metric                     count          metric                     count
scanned                      149          scanned                      150
mirrored                       8          mirrored                       1
skipped                      141          skipped                      149
restore-MISS (of skipped)     63          restore-MISS (of skipped)     63
failed                         0          failed                         0

compression method (@actions/cache):      compression method (@actions/cache):
zstd-without-long                         zstd-without-long
```

MET as pre-registered:

- **Nonzero mirrored: 8** on the ubuntu leg.
- **No all-restore-MISS warning.** `rg "restored as a MISS"` -> exit 1 (genuine no-match),
  `rg "::warning"` -> exit 1. Positive control on the same file passes:

  ```
  2026-08-08T22:23:06.1523150Z github-cache publish: @actions/cache resolved compression method zstd-without-long.
  ```

  Consistent with the guard's own condition, which needs `readMisses == hashes.length AND
  mirrored == 0`: here 63 != 149 and mirrored is 8, so the warning correctly stays silent.
- **All names `nx-cache-*`, zero legacy.** After hop 1: 87/87 match `^nx-cache-`; the legacy
  `<hash>-<os>` pattern returns exit 1. Positive control counts 87 lines. Baseline before
  hop 1 was 78/78 and zero legacy, so the legacy namespace did not grow.

**FALSIFIED: `readMisses 0`. Measured 63, on BOTH legs identically.** See the findings
section below -- this row does NOT close as fully satisfied.

**Independent cross-check of the method.** Before the summaries were readable, `mirrored`
was derived purely from the shard census and the `mirrored-by` labels: 8 for the ubuntu
leg, 1 for the windows leg. The summaries report exactly 8 and exactly 1. Two unrelated
measurement paths agreeing on both legs is a real check on the census-attribution technique
used for O-C and O-D, which have no summary to fall back on.

### O-C -- both publish-verify leg logs, and publish (windows) mirrored count. OBSERVED.

Windows leg: the O-A line above -- a windows-produced payload and `mirrored-by: windows`.

Ubuntu leg, job `93164047233`, conclusion success:

```
2026-08-08T22:27:44.8753560Z github-cache round-trip read-back: cache HIT for feed231281406708 on linux with bytes matching the 'linux'-produced payload this leg seeded, published by this same leg (label 'mirrored-by: linux'); the real publisher/reader round-trip is closed.
```

`linux` for both reader and producer, as pre-registered.

**OBS-05's `mirrored: 1, not 0` for `publish (windows)` is OBSERVED twice over.** The job
summary reports `mirrored 1` outright (table above). Independently, exactly ONE of the nine
new assets carries `mirrored-by: windows`:

```
nx-cache-feed031281406708	mirrored-by: windows	2026-08-08T22:26:18Z	48
```

created inside job `93163556152`'s window (22:23:10Z-22:27:11Z). The self-reported count and
the census agree: 1, and distinct from 0.

### O-D -- publish ordering and full-task-set mirror (XOS-07). OBSERVED.

**Ordering, measured from job timestamps rather than inferred from `needs:`.**

| Job | started | completed |
|---|---|---|
| `integration (windows-11-arm)` | 22:19:05Z | **22:22:07Z** |
| `publish (ubuntu-24.04-arm)` | **22:22:09Z** | 22:23:08Z |
| `publish (windows-11-arm)` | 22:23:10Z | 22:27:11Z |

`publish` started 2 seconds AFTER `integration (windows-11-arm)` completed. The `needs:`
declaration makes this structurally guaranteed; this is the measurement of it.

**Census: the Windows integration hash is mirrored by the ubuntu leg.** The
`integration (windows-11-arm)` job (`93163258864`) names its own task hash:

```
2026-08-08T22:21:59.1065798Z integration hash=14313827470950829191 cacheStatus=cache-miss status=0 -> integration-hash.txt
```

and that same hash appears in the shard, uploaded by the OTHER OS's leg:

```
nx-cache-14313827470950829191	mirrored-by: linux	2026-08-08T22:22:41Z	473
```

A hash produced on Windows, mirrored under a single OS-free asset name by the ubuntu
publish leg. That is XOS-07's designed proof shape. The other four real task hashes in the
delta do not appear in the Windows integration log (each `rg` exit 1, positive control on
the same file passes), so this is a specific attribution rather than a coincidence of a
crowded census.

## FINDING -- readMisses is 63, not 0, and the two source rows disagreed with each other

`10-VERIFICATION.md` item 1 pre-registered `readMisses 0`. Both publish legs report **63**,
identically. The expectation is FALSIFIED, so item 1 does not close clean.

**But the falsification is not the interesting part, and a nonzero symmetric restore-MISS
is NOT a new phenomenon.** `09-VALIDATION.md`'s own OBS-04 section already records the
prior window, run `30400231720` (2026-07-28), measuring exactly this shape:

| | ubuntu | windows | warning |
|---|---|---|---|
| run `30400231720`, 2026-07-28 | scanned 47 / mirrored 6 / skipped 41 / **restore-MISS 41** | scanned 48 / mirrored 7 / skipped 41 / **restore-MISS 41** | none |
| run `31281406708`, 2026-08-08 | scanned 149 / mirrored 8 / skipped 141 / **restore-MISS 63** | scanned 150 / mirrored 1 / skipped 149 / **restore-MISS 63** | none |

So the real finding is a documentation defect, not a runtime surprise:

1. **`10-VERIFICATION.md` item 1's `readMisses 0` was already contradicted by
   `09-VALIDATION.md`'s measured 41/41 at the time it was written.** Two rows in the same
   milestone, describing the same job's summary table, disagreed with each other about what
   healthy looks like, and nothing reconciled them. This window measured which one was
   right: the one with a number in it.
2. **The symmetry is the documented signal, not an anomaly.** `09-VALIDATION.md:291-296`
   pre-registered `restore-MISS` being SYMMETRIC across both legs as the fingerprint of a
   VER-01 PATH-caused cache-version rotation -- a Windows-only asymmetry would instead have
   meant VER-03's flag landed without VER-01's path. 63 == 63 continues to match that
   fingerprint, 11 days and many runs after 41 == 41. The earlier attribution holds; this is
   a second sample of it, not a contradiction of it.
3. **What genuinely needs triage is the "one-shot" framing.** `09-VALIDATION.md:300-301`
   states the window is SPENT and that "a later real merge will show a normal all-HIT
   `publish`". It has not. Eleven days later the restore-MISS count is not 0 and not
   decaying -- it GREW, 41 -> 63, while `scanned` grew 47 -> 149. A steady population of
   entries that no leg can restore is a different situation from a one-time rotation
   flushing through, and only the second was predicted.

The guard is behaving exactly as written throughout: its condition is the ALL case
(`readMisses == hashes.length AND mirrored == 0`), which is false in both samples, so the
silence is correct. No guard covers the partial case, which is why this went unnoticed for
11 days across two windows.

Deliberately NOT diagnosed here. It needs its own triage against the `publishMirror`
scan/restore path, and both runs are permanent so the evidence stays available. Guessing at
a cause from the summary table alone would repeat the defect class this milestone has spent
three quick tasks cleaning up.

Consequence for the source rows: `10-VERIFICATION.md` item 1 closes on four of its five
clauses and carries `readMisses` forward as an open sub-item pointing here. Items 2 and 3
close fully.

## Permanent state this window left behind

Hop 1's writes are REAL and the restore does not undo them. This is intended -- it is what
makes O-B, O-C and O-D observable -- but it must not be read as "nothing was left behind":

- `nx-cache-202608` grew from **78 to 87 assets** (+9, zero removed). Still far under the
  1000-asset cap.
- The nine: five real Nx task hashes, one dogfood-seed run-id entry, one `cafe` seed, and
  the two `feed0`/`feed2` publish-verify seeds.
- One new backup ref, `refs/backups/pre-wxg-window`, at `fe25a3f`. The five pre-existing
  `refs/backups/*` were neither reused nor deleted.

## Post-window assertions -- all five pass

- `origin/main == fe25a3f865f20f3d4f8a40e96f8cb5717608ba8a`
- CI workflow `313666980` is `active`
- PR #16 is OPEN with `mergedAt` null, `mergedBy` null, `mergeCommit` null
- the five pre-existing `refs/backups/*` are untouched, all at `fe25a3f`
- nothing merged: 9 merged PRs exist, the newest merged 2026-07-29, none during the window

Two side notes from the close:

- **The reopen is now proven.** The plan flagged that PR #12 was closed and then REPLACED,
  never reopened, so the reopen step had no precedent here. `gh pr reopen 16` succeeded and
  the PR came back OPEN with `mergedAt` still null.
- **W3 resolved itself.** While the window was open, `main` carried
  `windows-regression-detector.yml`, and a new workflow "Windows regression detector"
  (`324200310`) appeared as active with its `23 4 * * *` cron live from the default branch.
  It dropped off the workflow list on restore. The window ran 22:19Z-23:2xZ against a
  04:23Z cron, so it never fired.

## Deviations from the plan

**1. The hop-3 suppression was operator-run.** `gh workflow disable 313666980` was DENIED to
the agent by the auto-mode permission classifier -- correctly, since no message in the
session named that command as authorized. The maintainer ran the disable and the re-enable
directly; the agent performed only the restore push between them and asserted the outcome.
Net behaviour is exactly what the plan specified. Recorded because the plan's hop-3 block
reads as a single agent-run sequence and **the next window will hit the same denial** --
budget for it rather than discovering it mid-window with `main` forward.

**2. The job summaries were read through the maintainer's browser.** The plan says to record
a verbatim LOG line per observation. For O-B and for OBS-05 that is not possible: those
counts never reach a log. The agent first recorded them NOT OBSERVED; the maintainer
directed it to use `playwright-cli attach --extension=chrome`, which reads the run page from
the already-signed-in Chrome session. That is what produced the falsified `readMisses`
finding above. Worth generalising: **an observation that exists only in a job summary is
invisible to `gh` and to every unauthenticated fetch, and will be silently recorded as
unobservable unless someone reaches for a browser.** Two of this window's four observations
had a component in that category.

**3. Read-only pre-flight ran before the PR close.** Noted in the pre-flight section: the
plan's ordering is emphasis, not dependency, and running the assertions first avoids a
pointless close/reopen if one fails.

## WHAT THIS DOES NOT PROVE

Hop 2 proves the gate skips a forced push **whose pushed tip carries the gate**. It does
NOT make the final restore safe. `fe25a3f` predates the clause, so a restore push landing
there runs the UNGATED workflow and would attempt real production publish writes -- which
is why hop 3 required disabling CI at all.

The gate stays DORMANT for restores until `main` itself contains it, which happens at
merge, which the maintainer has placed LAST, after additional code and security reviews.
**Every window until v0.0.2 lands needs the hop-3 suppression.** A green hop 2 must not be
read as "restores are safe now".
