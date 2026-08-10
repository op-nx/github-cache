---
phase: quick-260810-v1g
plan: 01
status: complete
subsystem: planning records, gate measurement
tags: [milestone-audit, per-commit-gating, records-closure, bisect-safety]
requires:
  - .planning/quick/260810-v1g-close-the-two-substantive-v0-0-2-audit-i/260810-v1g-PLAN.md
  - .planning/quick/260810-v1g-close-the-two-substantive-v0-0-2-audit-i/260810-v1g-RESEARCH.md
provides:
  - .planning/quick/260810-v1g-close-the-two-substantive-v0-0-2-audit-i/260810-v1g-SWEEP.md
  - both substantive v0.0.2 milestone-audit items closed in every record that carried them
affects:
  - .planning/v0.0.2-MILESTONE-AUDIT.md
  - .planning/quick/260810-kuo-apply-the-15-triaged-survivors-of-the-si/
  - .planning/phases/10-os-invariant-releases-mirror/10-VERIFICATION.md
  - .planning/quick/260809-2s6-stop-the-publish-mirror-from-re-enumerat/260809-2s6-SUMMARY.md
tech-stack:
  added: []
  patterns:
    - supersede a record in place; never delete the reasoning that justified the earlier state
    - substitute only a MEASURED figure, and carry its denominator and its run id
    - classify a probe failure as INSTRUMENT distinctly from a gate failure, and cite the log
key-files:
  created:
    - .planning/quick/260810-v1g-close-the-two-substantive-v0-0-2-audit-i/260810-v1g-SWEEP.md
  modified:
    - .planning/quick/260810-kuo-apply-the-15-triaged-survivors-of-the-si/260810-kuo-VERIFICATION.md
    - .planning/quick/260810-kuo-apply-the-15-triaged-survivors-of-the-si/260810-kuo-SUMMARY.md
    - .planning/phases/10-os-invariant-releases-mirror/10-VERIFICATION.md
    - .planning/quick/260809-2s6-stop-the-publish-mirror-from-re-enumerat/260809-2s6-SUMMARY.md
    - .planning/v0.0.2-MILESTONE-AUDIT.md
decisions:
  - the sweep ran on the main checkout, never a worktree, because a junctioned node_modules makes check:action return a false drift verdict
  - the in-loop ran-probe failure was classified INSTRUMENT and resolved by recounting the SAME captured logs, never by re-running a gate
  - STATE.md was deliberately NOT touched -- the plan's files_modified does not list it and the known state.* handler defects make an unrequested edit a corruption risk
metrics:
  commits: 0
  tasks: 4
  commits_gated: 22
  gates_per_commit: 8
  sweep_wall_clock_seconds: 369
  gate_logs_captured: 88
---

# Quick Task 260810-v1g: Close the two substantive v0.0.2 audit items -- Summary

Both substantive items of the v0.0.2 milestone audit are closed, by different means: item A by running
the measurement that was missing (22 of 22 commits, all eight gates, green), item B by establishing
that the measurement already existed and correcting the audit's own misreading of a summary with two
same-titled sections. One new evidence file, five edited records, zero source changes, zero commits,
zero pushes.

Every number below was measured in this session, with the command or log path that produced it.

## Item A -- the measurement, and it is 22 of 22

**Measured: all 22 commits of `4518787..1b06816`, oldest first, on all EIGHT gates, uncached, on the
main checkout. 22 of 22 green.**

- Range size 22, from `git rev-list --count 4518787..1b06816`.
- 22 result rows in `RESULTS.tsv`, four recorded process exit codes each, **88 exit codes, every one
  0**.
- **88 gate logs** captured, from `ls "$LOG_DIR" | rg -c '\.log$'`.
- `check:action` exit 0 at every commit, so **zero bundle drift** anywhere in the range. This is a real
  result rather than a formality: `start-cache-server/index.js` is untouched by every commit in the
  range, so drift at a mid-range commit would have been a genuine finding.
- **369 seconds, 6 minutes 9 seconds** of wall clock end to end, from the sweep directory's own file
  timestamps (`PATH.txt` mtime to `RESULTS.tsv` mtime). About 17 seconds per commit including the
  checkout; the `nx` phase printed `Run duration` between 3.6s and 5.9s.
- No install ran at any point. `git diff --name-only 4518787..HEAD -- package.json package-lock.json`
  is empty, so the main tree's existing install served all 22 checkouts.
- Post-sweep: branch `gsd/v0.0.2-os-invariant-cross-os-sharing` at the pre-sweep tip
  `5c70c92214a6f1c3a53542d223959a160dea04eb`, `git diff --exit-code` silent. Recorded in
  `RESULTS.tsv`'s own trailer as `TREE-CLEAN yes`.

Full matrix, the eight gate commands verbatim, and the absolute log directory:
`260810-v1g-SWEEP.md`.

**No red commit.** The greenness is reported as a finding, not consumed as a pass condition -- had any
commit reddened, it would have been named with its gate and log path and left red.

**One INSTRUMENT finding, and it is in the probe.** The in-loop assertion on the `Successfully ran
targets` line measured 0 on all 22 commits while `nx` exited 0 on all 22 -- which under the plan's own
rule is the missing-target failure mode and had to be treated as red rather than waved past. Cause:
Nx emits each target name wrapped in SGR bold escapes, so the plan's plain literal needle cannot
match. Resolved by recounting the SAME captured logs with the escapes stripped -- present exactly once
in each of the 22 `nx` logs -- with three controls: the unstripped literal matches 0 of 22 logs (which
is what identifies the escapes as the cause), the stripped needle with one target dropped matches 0
(so the probe can still fail), and the needle against a log with no such line matches 0. No gate was
re-run to make this go away. SWEEP.md carries the verbatim escape-visible line and states that an
INSTRUMENT classification is falsifiable by a reader rather than mechanically gated.

**Then the two kuo records.** `260810-kuo-VERIFICATION.md` gained a third dated section and moved to
`status: passed`, 7/7, `behavior_unverified: 0` -- the status following the measurement, not asserted
beside it. Truth 6's original row, the `behavior_unverified_items` entry and both `human_verification`
entries are all retained verbatim under superseded keys, so a machine reading the live keys sees the
corrected empty lists while a reader keeps the original reasoning. Its own cost framing ("22 checkouts
x 6 gates", routed to a maintainer judgement about cost) is recorded as measured false: the judgement
was never needed.

`260810-kuo-SUMMARY.md`: the audit named three stale references and **all three were already fixed
downstream**, so they were re-measured rather than re-edited (`read-back.spec.ts:360` already correct
in both the SUMMARY and the deferred-items record; frontmatter already `commits: 22`,
`test_count: 1184`; bisect prose already "10 of the 22 commits, on `test` only"). What was actually
still stale, and is now fixed: both commit-counting Self-Check bullets (17 -> 22, each re-measured --
22 checked with `git merge-base --is-ancestor`, 0 non-ancestors, and both pre-reword SHAs `65d36e1` /
`703a261` still correctly failing it; zero non-ASCII lines across the 22 commit messages with a
positive control confirming the scanner fires), the untracked-document count (three -> five), and the
"was not run" claim, which now points at the sweep. The file records which references were already
closed so the next reader does not re-open them.

## Item B -- a records closure, from a run that already existed

No push, no window, no backup ref, no `gh workflow disable`. The maintainer's locked decision was "no
window", and the research that produced it holds: run `31305961054` at head `e3bf98b`, 2026-08-09, had
already measured all three of 260809-2s6's NOT OBSERVED items a day before the audit was written.

`10-VERIFICATION.md`: the first `live_ci_only_items` row now carries the measured figures with their
denominators and their run id -- `readMisses` 43 of `scanned` 112 on `publish (ubuntu-24.04-arm)` job
`93226687998`, 43 of 113 on `publish (windows-11-arm)` job `93226687984`. I cross-checked those
figures against tracked source before writing them: `publish-mirror.ts` and `publish-mirror.spec.ts`
carry 43/112 and 43/113 with the same run id, so no third denominator was invented. The stale
top-level `score:` key moved in the same edit (it had read "1 closed-with-one-clause-falsified", which
contradicted the row directly below it). The `open_sub_item` reasoning is preserved verbatim under
`open_sub_item_closed`, so a machine reading the frontmatter sees no open sub-item while the reasoning
survives -- that reasoning was correct, and its own closing instruction was satisfied rather than
overruled. Provenance is stated rather than implied: the five counts reach the job summary only and
never the step log, so they were read from the job summary at the time and transcribed with their run
id; a fresh first-hand re-read would need a browser and is not required to close this.

`260809-2s6-SUMMARY.md`: a pointer added immediately under the FIRST `## NOT OBSERVED` heading, naming
the closing run and the existence of the second, PLAN-2 section that lists two different things.
Neither section was deleted or rewritten -- the first was true when written. This is the cheapest of
item B's three edits and the only one that prevents a recurrence.

## The milestone audit's own error, named

`.planning/v0.0.2-MILESTONE-AUDIT.md` carried item B as open because it read the FIRST of two
same-titled `## NOT OBSERVED` sections. That is now said in the file, in the frontmatter closure and in
the prose, rather than quietly overwritten.

Recounted from the corrected frontmatter, not by subtraction -- which is how a **third** error
surfaced: the audit's line read "Total: 12 items across 8 groupings" while the frontmatter it
summarised held **13** items across those 8. Removing the two closed groupings (`260810-kuo (quick)`,
2 items; `09 + 10 (open by design, push-gated)`, 1 item) leaves **10 items across 6 groupings** --
measured by parsing the corrected frontmatter with js-yaml, not counted by eye. `open_by_design` is now
`[]` and `closed_since_prior_audit` grew from 10 to 12 entries. Zero items need a maintainer decision
and zero need a push; the "needs a push to `main`" clause was dropped as false in its entirety. The
header `Status:` line and the Assessment paragraph were both corrected, and the Assessment keeps its
shape observation about artifact prose, which is still true and is the audit's most useful finding --
now with the note that it applies to the audit itself.

## Deviations

**One, and it is in the plan's own instruments, not in the work.**

**[Rule 3 -- blocking issue] The `<verify>` blocks for tasks 2, 3 and 4 could never pass as written.**
Each positive check is shaped `c=$(git grep -c -F "$needle" -- "$FILE" || echo 0)` followed by
`[ "$c" -ge 1 ]`. With a single pathspec, `git grep -c` prints `<path>:<count>`, not a bare count, so
`[` dies with `integer expected` and the check FAILS while the needle is present. Measured on the first
run of task 2's block: `FAIL: ...260810-kuo-VERIFICATION.md does not cite 260810-v1g-SWEEP.md` on a
file that cites it. Fixed by extracting the count (`| cut -d: -f2`) with the semantics otherwise
untouched, and each corrected block carries a falsifiability control proving an absent needle still
reports 0. The negative checks (`-eq 0`) were unaffected, because a zero-match `git grep -c` prints
nothing and the `|| echo 0` fallback fires. All four blocks then passed. The corrected scripts live in
the session scratchpad, outside the repo.

**Not a deviation, but worth stating: task 1's `<verify>` no longer passes on a re-run, by design.**
Its final assertion is `git diff --exit-code --quiet`, a sweep-time check on "the sweep left no tracked
file modified". It passed when run immediately after the sweep, and `RESULTS.tsv`'s `TREE-CLEAN yes`
trailer is the durable record of that. Tasks 2-4 then deliberately edited five tracked `.planning/`
records, so re-running that check afterwards reports the plan's own intended output as a failure. The
invariant that actually matters was asserted separately and holds: **zero tracked files outside
`.planning/` are modified**, the modified set is exactly the five records tasks 2-4 own (byte-compared
against the expected list, exact match), and `start-cache-server/index.js` is unchanged against HEAD.

## What I could not do, and why

- **No STATE.md update.** The plan's `files_modified` frontmatter lists six files and STATE.md is not
  among them, and this project has recorded defects in the GSD `state.*` handlers (they mutate STATE.md
  on probe; `state.record-metric` silently records nothing when called positionally as the executor
  spec does). Editing it unrequested is a corruption risk with no instruction behind it, so it is left
  to the orchestrator.
- **No ROADMAP.md update.** Quick tasks are separate from planned phases.
- **No `requirements.mark-complete`.** This plan's `requirements: [AUDIT-ITEM-A, AUDIT-ITEM-B]` are
  audit item labels, not `REQUIREMENTS.md` IDs.
- **No commits.** The plan's `<commits>` section specifies the executor makes none; all six touched
  files are `.planning/` artifacts the orchestrator commits. Committing mid-sweep would also have
  corrupted the sweep, since `.planning/` is tracked and reverts under every checkout.
- **No fresh first-hand read of the five publish counts.** They exist only in run `31305961054`'s job
  summary, which needs a browser against that run's page. The figures used are the transcriptions
  already in tracked source, and the records say so explicitly rather than implying a fresh read.

## Where a plan premise turned out false

1. **The `ran` probe.** The plan asserted the literal `Successfully ran targets build, typecheck, test,
   integration, lint` was "verified present in this session's log" and told the sweep to treat `ran=0`
   with `nx=0` as RED. Measured: the literal matches **0 of 22** captured logs, because Nx wraps each
   target name in SGR bold escapes. The gate was green throughout; the needle was wrong. Resolved by
   recount over the same logs, never by re-running.
2. **The verify blocks for tasks 2-4.** See the deviation above -- broken as written, in all three.
3. **The audit's item arithmetic.** The plan said to recount rather than subtract two from twelve. Doing
   so exposed that the twelve was itself wrong: the frontmatter held 13 items, not 12.

## Limits of the evidence

The sweep is a local Windows-arm64 measurement on the maintainer's workstation. Nothing was pushed and
no CI run was created, so none of it is evidence about runner behaviour. The log directory is a session
scratchpad path outside the repo -- durable for this session and its transcript, not forever; SWEEP.md's
22-row matrix and `RESULTS.tsv`'s 22 rows are the record that survives. And an INSTRUMENT
classification is falsifiable by a reader rather than mechanically proven, deliberately: the only
mechanical discriminator would be re-running a gate until it goes green, which is the pass condition
the locked best-effort decision forbids.

## Self-Check: PASSED

- All six touched files exist on disk; verified by the file-existence loop in task 4's automated block.
- All six are ASCII-only; verified by `rg -l '[^\x00-\x7F]'` over the six paths, empty.
- All four task `<verify>` blocks pass (tasks 2-4 with the `git grep -c` extraction corrected, each
  carrying a falsifiability control). Task 1's block passed at sweep time; its final tracked-file
  assertion is superseded by the scoped assertions above, as explained under Deviations.
- Branch `gsd/v0.0.2-os-invariant-cross-os-sharing` at `5c70c92214a6f1c3a53542d223959a160dea04eb`; zero
  tracked files modified outside `.planning/`; the modified set is exactly the five records this task
  owns.
- Zero commits made, zero pushes, no window, no backup ref, no workflow toggle, no source-file change.
