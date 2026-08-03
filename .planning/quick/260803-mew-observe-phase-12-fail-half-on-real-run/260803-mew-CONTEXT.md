# Quick Task 260803-mew: Observe Phase 12 fail half on real run - Context

**Gathered:** 2026-08-03
**Status:** Ready for planning
**Mode:** `--full --auto` (gray areas auto-locked; see Confidence notes)

<domain>
## Task Boundary

Observe, on a real GitHub Actions runner, the FAIL half of Phase 12's Windows
regression detector gate -- the direction that has only ever been measured
locally.

The detector (`.github/workflows/windows-regression-detector.yml`) gates on a
literal needle rather than an exit code, because `nx run-many` exits 0 when a
target resolves no task and Nx filters the printed target list down to the
targets that actually ran. The PASS half of that gate is observed on a real
runner; the FAIL half is not.

### Entry state, measured 2026-08-03 (not inferred)

| Fact | Value | How established |
|------|-------|-----------------|
| Local HEAD | `41f65e1` | `git rev-parse` |
| Remote branch tip | `41f65e1` -- IDENTICAL, 0 ahead / 0 behind | `git ls-remote` + `git rev-list --left-right --count` |
| `main` | `fe25a3f`, detector file ABSENT | `git ls-remote`; restored after the Phase 12 UAT window |
| Open PR | #16, head = this branch | `gh pr list` |
| Detector runs in repo history | exactly ONE: `30603713356` | `gh run list --workflow windows-regression-detector.yml` |

### The two gaps this task closes

1. **FAIL half never observed on a runner.** The non-vacuity proof (a run that
   exits 0 while failing the plural needle) was measured on this Windows
   workstation only -- `12-03-SUMMARY.md:100,241`. Contrast Phase 13's XOS-09,
   which closed BOTH directions live (`ROADMAP.md:683`: `30744366870` pass,
   `30745558383` red at step granularity). Phase 12's gate has no such red.

2. **The observed PASS half pins a SUPERSEDED needle.** Commit `9e79009`
   (2026-08-01, "add lint to the detector, the one invariant it could not see")
   changed the needle to the FOUR-target line
   `Successfully ran targets build, typecheck, test, lint for project`.
   Run `30603713356` ran at `e757d4c` (2026-07-31) and proves the THREE-target
   line. `git merge-base --is-ancestor 9e79009 e757d4c` returns false -- so the
   needle at HEAD has never run on a real runner in EITHER direction.

</domain>

<decisions>
## Implementation Decisions

### D-1: Observe BOTH directions, not just the fail half

The request names the fail half, but the pass-half evidence of record is stale
(gap 2 above). Observing only the red would leave the repo with a red for the
four-target needle and a green for a needle that no longer exists. Both
dispatches run in the same `main` window, so the marginal cost is one extra
dispatch.

**Confidence: HIGH.** Follows directly from the measured `merge-base` result.

### D-2: The RED is produced by running 3 of the 4 needled targets

Reproduce on a runner the exact shape the local proof used: the guarded command
runs FEWER targets than the needle names, so `nx run-many` exits 0, Nx prints a
success line naming only the targets that ran, the needle does not match,
`grep -q` fails, and `set -euo pipefail` propagates it to a RED step.

Rejected alternatives:
- Breaking a target so Nx genuinely fails -- proves the exit code, not the
  needle. The needle exists precisely because exit 0 is insufficient, so a
  genuine failure tests the wrong mechanism.
- Waiting for a natural Windows-only regression -- unbounded, and the whole
  point is that such a regression is currently invisible.

**Confidence: HIGH.** Same shape as the accepted local proof; a deliberate
mutation is also how Phase 13 proved TEST-11's clauses.

### D-3: The mutation lives on a THROWAWAY remote branch, never on the phase branch or main

`workflow_dispatch` needs the workflow file on the DEFAULT branch for the API to
accept the call, but the run executes the workflow from the `--ref` tree (proven
by the Phase 12 UAT window: dispatched `--ref` the phase branch, executed
`e757d4c`, not `main`'s stale tree). So:

- One plumbing commit puts the detector file on `main` (accept the dispatch).
- Dispatch #1 `--ref` the phase branch at `41f65e1` -> expect GREEN.
- Dispatch #2 `--ref` a throwaway branch carrying the 3-of-4 mutation -> expect RED.

The mutation must never reach the phase branch (it would redden PR #16) or
`main`. A throwaway branch push does NOT trigger `ci.yml`, whose triggers are
`push: branches: [main]` and `pull_request` only -- so the push is free of side
effects.

**Confidence: HIGH.** The ref-vs-default-branch split is measured behaviour from
the prior window, not an assumption.

### D-4: Reuse the documented backup-and-restore procedure verbatim

`12-UAT.md:78-95` records the procedure that already survived one execution:
backup `main` to a remote ref and verify the SHA; push a single plumbing-built
commit adding ONLY the workflow file, `[skip ci]`, without touching the working
tree or index; dispatch; force-restore `main`; verify the restore by SHA, by the
file's absence, AND by an empty `git diff` against the backup; then delete the
backup ref.

Restore happens AFTER both dispatches are created (a run is pinned at creation
and does not re-read `main`), and the restore is verified before the task is
allowed to report success.

**Confidence: HIGH.** Documented, previously executed, operator-approved.

### D-5: Evidence is read at STEP granularity, never run colour

Phase 13's lesson (`13-VERIFICATION.md:84`, and the recorded memory that a job's
colour can come from an unrelated `exit 1`): confirm the RED is the needle's
`grep` step specifically, and confirm the nx command itself exited 0 in that
same run. A red job proves nothing unless the failing STEP is the gate and the
command under it succeeded.

**Confidence: HIGH.** This is the precise trap the needle exists to catch; a
run-level red would be circular evidence.

### Claude's Discretion

- Exact throwaway branch name and which target to drop from the `-t` list.
- Artifact filename and section layout for the observation record.
- Which existing artifacts get the evidence pointer (at minimum `12-UAT.md`
  item 2 must stop reading as closed on the current needle).

</decisions>

<specifics>
## Specific Ideas

The needle at HEAD, verbatim:

```
Successfully ran targets build, typecheck, test, lint for project
```

The guarded step at HEAD, verbatim:

```bash
set -euo pipefail
npm exec -- nx run-many -t build typecheck test lint --skip-nx-cache 2>&1 | tee detector.log
grep -q 'Successfully ran targets build, typecheck, test, lint for project' detector.log
```

Note the workflow comment already states the accepted cost: the needle pins the
`-t` ARGUMENT ORDER, and the documented repair is to update the needle and its
clause in `windows-regression-detector.spec.ts` in the SAME commit, never to
shorten the needle. Any mutation made for the RED observation is throwaway and
must not be confused with that repair path.

</specifics>

<canonical_refs>
## Canonical References

- `.github/workflows/windows-regression-detector.yml` -- the gate under observation
- `.planning/phases/12-windows-ci-reuse-o4-consumer-recipe/12-UAT.md:54-95` -- the PASS-half observation and the backup-and-restore procedure
- `.planning/phases/12-windows-ci-reuse-o4-consumer-recipe/12-03-SUMMARY.md:100,230-241` -- the LOCAL non-vacuity measurement this task lifts to a real runner
- `.planning/phases/12-windows-ci-reuse-o4-consumer-recipe/12-VERIFICATION.md:122-126` -- human-verify item 2, which the stale needle reopens
- `.planning/ROADMAP.md:683` -- Phase 13's both-directions precedent
- `.planning/phases/13-read-only-actions-cache-backend/13-VERIFICATION.md:126` -- the FAIL-direction section to mirror in form

</canonical_refs>
