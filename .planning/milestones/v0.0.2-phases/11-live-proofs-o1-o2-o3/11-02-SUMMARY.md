---
phase: 11-live-proofs-o1-o2-o3
plan: 02
subsystem: testing
tags: [nx-reset, graph-state, hash-parity, releases-mirror, pagination, perishable-window, evidence]

# Dependency graph
requires:
  - phase: 11-live-proofs-o1-o2-o3
    plan: 01
    provides: "capture-hashes.mjs with its `capture` path untouched -- 11-01 deliberately duplicated the --out writer rather than refactoring it, precisely so this plan's irrecoverable warm capture ran against an unmodified code path"
  - phase: 10-os-invariant-releases-mirror
    provides: "D-02's warm-hash table, D-03's clock, and the warm cache-mirror-202607 shard this plan cross-checks against"
provides:
  - "11-hashes-warm.json: the WARM-graph capture at bd492dd, taken before anything cleared the graph and therefore unrecoverable had it been skipped"
  - "11-hashes-cold.json: the COLD-graph capture taken immediately after `npx nx reset`, in the one window where it was obtainable"
  - "D-06 DISCHARGED: cold == warm on all four proof targets, and all four PRESENT in the warm shard -- so a MISS in plan 11-03 is now attributable IN ADVANCE rather than after the fact"
  - "A cleared local Nx cache (.nx/cache absent) ready for plan 11-03's cold measurement"
  - "MEASURED: a capture-hashes.mjs invocation warms .nx/workspace-data (0 -> 13), which the record did not previously state"
  - "MEASURED: an unpaginated shard read returns 30 of 141 assets with ZERO nx-cache- names -- T-11-12's guard is load-bearing, not defensive boilerplate"
affects: [11-03, 11-04, 11-07, PARITY-04, DOCS-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Capture the perishable number FIRST and commit it, so an irreversible action downstream cannot destroy the baseline it will be compared against"
    - "Turn a pagination guard from an assertion into a measurement by running the unpaginated read and counting what it would have missed"
    - "Bracket a one-shot measurement with before/after state counts, so the instrument's own side effect on the thing it measures becomes visible"

key-files:
  created:
    - .planning/phases/11-live-proofs-o1-o2-o3/11-hashes-warm.json
    - .planning/phases/11-live-proofs-o1-o2-o3/11-hashes-cold.json
  modified: []

key-decisions:
  - "Task 2's blocking checkpoint was resolved by the maintainer as `literal-reset` -- D-05's locked choice, TEST-10's named mechanism in TEST-10's named order. NOT the COLD-DIRECTORY variant, so there is NO deviation to record and NO partial-redirection caveat to carry"
  - "The checkpoint was NOT self-approved. Auto mode was verified inactive (workflow.auto_advance false, workflow._auto_chain_active false) and the checkpoint returned to the orchestrator with all three options and their costs; the reset ran only after the selection was relayed back"
  - "The SUMMARY was deliberately NOT written at the checkpoint. The plan's <output> contract requires it to carry the selected option id and all three workspace-data counts, none of which existed yet -- writing it early would have recorded numbers that had not been measured, which is the exact failure this phase exists to stamp out"
  - "The cold capture was run EXACTLY ONCE, and the before/after counts prove why: the invocation itself warms .nx/workspace-data from 0 to 13, so a second run would have read 13 entries and reported `warm`"
  - "The shard cross-check was re-read fresh (paginated) for the cold record rather than reusing task 1's listing, because D-07 hinges on the cold verdict and an inherited listing would make the load-bearing number a stale one"
  - "Outcome 1's finding is recorded and deliberately NOT promoted to a proof: PARITY-04's post-08-05 status looks answered, but 'does my everyday box hit' is a separate named question CONTEXT.md's deferred list keeps out of this phase"

patterns-established:
  - "A blocking destructive checkpoint presents the numbers the decision is taken against, not just the options -- the maintainer chose against four measured hashes, four PRESENT verdicts and a measured 29-day window"
  - "An absence check over a paged API states its own truncation margin as a measurement (30 of 141, zero matches on the single page), so 'ABSENT' can never be an artifact of the reader"

requirements-completed: []

coverage:
  - id: D1
    description: "The WARM graph-state hashes are captured and committed BEFORE anything clears the graph (D-06)"
    requirement: TEST-10
    verification:
      - kind: integration
        ref: "11-hashes-warm.json committed in 8d90fc8 BEFORE `npx nx reset` ran in task 3; meta.graphState === 'warm', meta.workspaceDataEntries === 18; all four hashes MATCH D-02's table exactly"
        status: pass
    human_judgment: false
  - id: D2
    description: "The local Nx cache is cleared by literal `nx reset`, and the reset happens BEFORE any sidecar is started (D-05, TEST-10's mechanism and order)"
    requirement: TEST-10
    verification:
      - kind: integration
        ref: "`npx nx reset` exit 0; .nx/cache and .nx/workspace-data both removed outright (directories absent, not merely empty); no sidecar was started at any point in this plan"
        status: pass
    human_judgment: false
  - id: D3
    description: "The COLD hashes are captured immediately after the reset and before any other nx invocation, so the cold number is measured rather than asserted"
    requirement: XOS-01
    verification:
      - kind: integration
        ref: "meta.graphState === 'cold' with meta.workspaceDataEntries === 0 and graphStateBasis === 'workspaceDataEntries'; only `ls`/`[ -f ]`/`[ -d ]` ran between the reset and the capture; T-11-13 satisfied because measureGraphState derives the verdict from the entry count and there is no graph-state CLI flag"
        status: pass
    human_judgment: false
  - id: D4
    description: "Each state's four hashes are cross-checked against the warm cache-mirror-202607 shard, so a later MISS is attributable in advance rather than after the fact"
    requirement: XOS-02
    verification:
      - kind: integration
        ref: "Two independent paginated reads (141 assets each) of release 354838660; all four warm hashes and all four cold hashes PRESENT as nx-cache-<hash>, with created_at and label recorded per asset"
        status: pass
      - kind: integration
        ref: "Non-vacuity: the matcher finds 16 nx-cache- assets and rejects 125 others, and a deliberately bogus nx-cache-0000000000000000000 reads ABSENT -- so PRESENT is discriminating rather than matching everything"
        status: pass
    human_judgment: false
  - id: D5
    description: "If the COLD hashes are absent from the mirror, that is recorded as a FINDING and the phase STOPS rather than re-running until something hits (D-07)"
    requirement: TEST-10
    verification:
      - kind: integration
        ref: "D-07 did NOT fire -- all four cold hashes PRESENT. Outcome 1 of the plan's three defined outcomes recorded by name. The capture was run once and never retried; no re-reset occurred"
        status: pass
    human_judgment: false

# Metrics
duration: 17min
completed: 2026-07-29
status: complete
---

# Phase 11 Plan 02: Warm/Cold Hash Capture and the TEST-10 Reset Summary

**D-06 is DISCHARGED: this Windows workstation computes the SAME four proof hashes cold as warm, and all four are PRESENT in the warm `cache-mirror-202607` shard -- so plan 11-03's measurement window is open and any MISS there is now attributable IN ADVANCE. The maintainer authorised `literal-reset` at a blocking checkpoint, the warm number was banked first, and D-07 did not fire.**

## Performance

- **Duration:** 17 min (including the blocking checkpoint wait)
- **Started:** 2026-07-29T21:06:16Z
- **Completed:** 2026-07-29T21:22:46Z
- **Tasks:** 3 (2 auto, 1 blocking decision checkpoint)
- **Files created:** 2

## The selected option

**`literal-reset`** -- recorded verbatim, as the plan's acceptance criteria require.

D-05's locked choice: TEST-10's named mechanism in TEST-10's named order (reset first, sidecar after). Phase 11 is the phase where TEST-10 CLOSES and the requirement names both the mechanism and the order in its own words.

**There is therefore NO deviation to record and NO soundness caveat.** The COLD-DIRECTORY fallback was offered with its reasons and was NOT taken, so this plan carries none of its baggage -- in particular, the measured fact that `CACHE_ARCHIVE_DIR` is a workspace-relative literal and is NOT redirected by `NX_CACHE_DIRECTORY` is irrelevant here, because no redirection was used.

The checkpoint was **not self-approved**. Auto mode was verified inactive (`workflow.auto_advance: false`, `workflow._auto_chain_active: false`), and the checkpoint was returned to the orchestrator with all three options, their costs and the numbers the decision was taken against. `npx nx reset` ran only after the maintainer's selection was relayed back.

## The evidence the decision was taken against

Pre-flight state, recorded before anything touched the graph:

| Item | Value |
|---|---|
| HEAD short SHA | `bd492dd` |
| `git status --porcelain` | printed nothing (clean) |
| Tree kind | **MAIN** -- `.git` is a directory, not a file |
| `.nx/workspace-data` entries | **18** (WARM) |
| `.nx/cache` entries | 86 |
| Days remaining before the D-03 clock closes (~2026-08-28) | **29** |

The MAIN-tree check is not boilerplate: this project's junctioned `node_modules` hazard makes a worktree measurement unattributable, and `10-EVIDENCE-PRE-RENAME.md` records the same check in the same position.

## The three `.nx/workspace-data` counts

| Point | Entries | Directory |
|---|---|---|
| Before the reset | **18** | present (WARM) |
| Immediately after `npx nx reset` | **0** | **absent** -- removed outright, not merely emptied |
| As read by the cold capture itself | **0** | absent -> `meta.graphState: cold` |
| Immediately after the capture returned | **13** | present again |

`.nx/cache` went 86 -> **absent**, and was still absent after the capture -- so the local task cache is genuinely cold for plan 11-03. `nativeFileCacheEntries` reads 1, which is the single version-prefixed copy of the `.node` addon binary that `capture-hashes.mjs`'s own static import places there; Phase 8 D-01 established this is not a hash cache, which is exactly why `graphStateBasis` is `workspaceDataEntries` alone.

## Per-target comparison and shard verdict

Cold capture: `meta.graphState` **`cold`**, `graphStateBasis` `workspaceDataEntries`, `workspaceDataEntries` 0, `installMode` `ci`, win32/arm64, Node v24.13.0, Nx 23.1.0, `workingTreeClean` true, captured 2026-07-29T21:17:11Z at commit `8d90fc8`.

| Target | Cold hash | Warm hash | Verdict | Shard | `created_at` | `label` |
|---|---|---|---|---|---|---|
| `build` | `17269409342684722256` | `17269409342684722256` | **SAME** | **PRESENT** | 2026-07-29T16:44:31Z | `mirrored-by: linux` |
| `typecheck` | `122473981802582055` | `122473981802582055` | **SAME** | **PRESENT** | 2026-07-29T16:44:32Z | `mirrored-by: linux` |
| `test` | `11681410932071446589` | `11681410932071446589` | **SAME** | **PRESENT** | 2026-07-29T16:44:30Z | `mirrored-by: linux` |
| `integration` | `8137422034373911537` | `8137422034373911537` | **SAME** | **PRESENT** | 2026-07-29T16:44:27Z | `mirrored-by: linux` |

All four also **MATCH D-02's committed table exactly**, in both graph states, with zero divergence. That re-confirms D-04 empirically: every commit since `3c6415f` touches `.planning/` only, and `.planning` appears in no named `nx.json` input.

`lint` = `12188798272866712437` in both states, absent from the shard **by design** -- its CI job is the one quality job that starts no sidecar. Recorded so a coverage audit does not read four-of-five as a gap.

**The `mirrored-by: linux` label is recorded as a PUBLISHER, never a producer.** D-14 retracted the producing-OS reading repo-wide on live evidence: the Windows-produced `integration` hash sits in this very shard stamped `mirrored-by: linux`, because the ubuntu publish leg restored a Windows-produced entry and stamped its own OS.

## The outcome, by name

**OUTCOME 1** of the three the plan defines: *cold equals warm on all four and all four are PRESENT in the shard.*

**Action it triggers: D-06 is DISCHARGED.** Plan 11-03 is cleared to measure, and a MISS there would now be a real finding rather than an ambiguity between "cold != warm" and "the mirror is stale" -- which is the entire purpose D-06 exists for.

**Recorded as a FINDING, and deliberately NOT promoted to a proof:** PARITY-04's post-08-05 status *looks* answered -- Phase 8's anchor measured a warm-preexisting Windows box computing a different hash from cold on all five targets, and that no longer reproduces here. But PARITY-04's question is "does my **everyday** box hit", and TEST-10's reset makes this phase's question "does a **cold** Windows box hit". Those are different named questions, CONTEXT.md's deferred list keeps the former out of this phase, and D-07 explicitly forbids letting the reset silently substitute one for the other. The data a later phase would need is now captured without being turned into a proof.

**D-07 did NOT fire.** No cold hash was ABSENT. The capture ran once and was never retried; no second reset occurred.

## Two measured results the record did not previously state

**1. A `capture-hashes.mjs` invocation DOES warm `.nx/workspace-data` -- 0 to 13 entries.**

RESEARCH.md flagged this as unstated and asked for the before/after pair to settle it empirically. It is now settled, and it retroactively justifies the plan's "run the capture exactly once" instruction as load-bearing rather than cautious: a second invocation would have read 13 entries and reported `warm`, so the cold number was obtainable in exactly one window and there was no second attempt available. `.nx/cache` is unaffected (still absent), so the capture cannot have written a task cache entry that would later short-circuit plan 11-03's remote read.

**2. `packages/github-cache/dist/lib/trust.js` SURVIVED the reset** -- confirmed by a file check immediately after `npx nx reset` returned.

This confirms RESEARCH.md's source-read claim that `nx reset` removes only the daemon dir, the cloud client dir, `cacheDir`, the native file cache location and the workspace-data dirs, while `packages/github-cache/dist/` is a task *output* directory outside `.nx/`. Consequence for plan 11-03: **no rebuild is needed before the D-08 soundness probe and none was inserted.** A rebuild would populate outputs that `typecheck`'s `dependentTasksOutputFiles` input hashes, and TEST-10's whole point is to measure the cold box.

## The pagination guard, measured rather than asserted (T-11-12)

The shard was listed with `gh api ... --paginate`: release `354838660` (`cache-mirror-202607`), **141 assets**, of which 16 carry the authored `nx-cache-` prefix and 125 do not. Two independent paginated reads were taken -- one per capture -- and both returned 141.

The plan's acceptance criteria treat "the recorded shard asset count exceeds 100" as the proof a single page would have truncated. That inference was replaced with a direct measurement:

| Read | Assets returned | `nx-cache-` names among them | The four proof hashes would read |
|---|---|---|---|
| `gh api ... --paginate` | **141** | **16** | **PRESENT** (all four) |
| Same endpoint, no `--paginate` | **30** | **0** | **ABSENT** (all four) |

So an unpaginated read would not merely have risked truncation -- it would have reported **every one of the four hashes ABSENT and manufactured a false D-07 finding**, stopping the phase on a reader artifact. The guard is load-bearing, not defensive boilerplate.

The matcher was also proven non-vacuous in the other direction: it rejects the 125 non-prefixed assets, and a deliberately bogus `nx-cache-0000000000000000000` reads ABSENT. A matcher that matched everything would have satisfied every PRESENT assertion simultaneously -- Phase 7's `filterUsingGlobPatterns` lesson recurring.

**No REST payload was pasted anywhere.** Only `name`, `created_at` and `label` were extracted programmatically via `gh api -q`, because payload fields carry uploader identity and this is a public repository (T-11-03).

## No `nx` command ran after the reset

**Explicit statement, as the plan's acceptance criteria require: after `npx nx reset`, no `nx` invocation of any kind occurred.**

Everything that ran after the reset:

| Command | Why it is not an `nx` invocation |
|---|---|
| `ls -1 .nx/workspace-data`, `[ -d ]`, `[ -f ]` | shell / coreutils file counts |
| `npm run capture:hashes` | expands to `node capture-hashes.mjs`; root `nx.includedScripts` is `[]`, so it cannot be an Nx target and a capture can never be a replay (Phase 8 D-01(b)) |
| `node -e` (the plan's own verify blocks) | plain Node; the plan authors these as `node` deliberately for this reason |
| `gh api ... --paginate` | read-only GitHub REST |

No `nx build`, `nx test`, `nx typecheck`, `nx integration`, `nx graph`, `nx show`, `nx format:check`, no second `nx reset`, and **no Nx MCP tool** -- any of those would have repopulated `.nx/workspace-data` and destroyed the cold state, or written a `.nx/cache` entry that would let a LOCAL hit short-circuit plan 11-03's remote read before the remote is ever queried.

VALIDATION.md's sampling rate instruction to run `npm exec nx test github-cache` after every task commit is **SUSPENDED** for tasks 2 and 3 of this plan and for tasks 1 and 2 of plan 11-03, per the plan's hard ordering rule. It resumes at plan 11-05.

Task 1 also ran no `nx` command, for the same `nx.includedScripts` reason.

## Task Commits

Each task was committed atomically:

1. **Task 1: Capture the WARM hashes first, and cross-check them against the live mirror (D-06)** - `8d90fc8` (docs)
2. **Task 2: Authorise the irreversible `nx reset` (D-05)** - no commit; a blocking decision checkpoint with `<files>none</files>`. The selection is recorded here and in `41c1f92`'s message.
3. **Task 3: Clear the cache, capture the COLD hashes, and cross-check them (D-05, D-06, D-07)** - `41c1f92` (docs)

## Files Created

- `.planning/phases/11-live-proofs-o1-o2-o3/11-hashes-warm.json` - CREATED. The WARM capture at `bd492dd`, 18 workspace-data entries. The irrecoverable one.
- `.planning/phases/11-live-proofs-o1-o2-o3/11-hashes-cold.json` - CREATED. The COLD capture at `8d90fc8`, 0 workspace-data entries, taken in the single window where it was obtainable.

Both carry all five target records (the four proof targets plus `lint`) with hash, command and the `details.nodes` map including the merged `ProjectConfiguration` node.

## Decisions Made

- **`literal-reset`, authorised explicitly rather than assumed.** The alternative was offered with its full cost. The maintainer accepted a reproducible loss (Nx output) against an unreproducible gain (TEST-10's named mechanism closing without a recorded deviation), with the warm number already banked and 29 days of window remaining.
- **The warm capture went first, and was committed before the reset.** This is the whole reason D-07's contingency stayed clean: had the warm number been skipped and the cold proof MISSed, the finding could not have distinguished "cold != warm" from "the mirror is stale".
- **The SUMMARY was withheld at the checkpoint rather than drafted with placeholders.** Its `<output>` contract requires the selected option id and all three counts; two of the three did not exist yet. Recording unmeasured numbers is the failure mode this phase exists to stamp out, so the checkpoint return carried the measured numbers instead and the artifact waited.
- **The cold shard read was taken fresh, not inherited from task 1.** D-07 hinges on the cold verdict; reusing a minutes-old listing would have made the load-bearing number a stale one for no saving.
- **`requirements mark-complete` was NOT run for this plan's frontmatter IDs.** See below -- this is a deliberate suppression, not an omission.

## Requirements: nothing flipped, deliberately

The plan's frontmatter carries `requirements: [XOS-01, XOS-02, TEST-10]`, and the execute-plan workflow would normally pass all three to `requirements mark-complete`. **That was suppressed, and `requirements-completed` is empty above.**

Reason: **no live proof exists yet.** XOS-01 and XOS-02 require a recorded local Windows `[remote cache]` HIT, which plan **11-03** measures. TEST-10 requires the full harness including the D-08 soundness probe and the post-reset measurement run, also 11-03 and beyond; this plan delivers only TEST-10's reset-order clause. TEST-08 and XOS-03 are not this plan's and close at 11-07.

This continues 11-01's finding: the same blanket flip fired there on TEST-08 and had to be reverted, and REQUIREMENTS.md's own traceability row was the decisive evidence the flip was wrong. Flipping a requirement here would assert that O1/O2 are proven when the measurement has not been taken -- precisely the "recorded green instead of a falsifiable number" failure this phase exists to eliminate.

`git status --porcelain .planning/REQUIREMENTS.md` prints nothing, so no revert was needed this time.

## Deviations from Plan

**None** - the plan executed exactly as written, on the option the maintainer selected.

Two items a reader could mistake for deviations, and neither is:

1. **No `test(...)` RED commit.** Neither task is a `tdd="true"` task; this plan writes only measurement records under `.planning/` and authors no behaviour. There is no gate to reach and none was skipped.
2. **The unpaginated-read measurement was not asked for.** The plan's acceptance criteria accept "the shard asset count exceeds 100" as sufficient proof that a single page would truncate. Running the unpaginated read is a strictly stronger, zero-cost, read-only form of the same check, and it converted an inference into a measurement. It added no file and no dependency; the throwaway scripts live in the session scratchpad, not the repository.

**Total deviations:** 0
**Impact on plan:** none.

## Issues Encountered

- **The cold capture's own side effect was the one thing that could have silently spoiled the measurement, and it was bracketed rather than assumed away.** The 0 -> 13 warming means there was exactly one chance at the cold number. Had the plan prescribed a verification re-run of the capture -- the instinctive thing to do -- the second reading would have said `warm` and the cold number would have been unobtainable for the rest of the window. The before/after bracket is what makes this visible instead of a later mystery.
- **`git commit -m` was not used.** Per the recorded Dev Drive (ReFS) `COMMIT_EDITMSG` "Invalid argument" hazard, both commits used `git commit -F <file>` with the message authored via the Write tool into the session scratchpad. No failure was hit as a result.
- **Both `rg` hygiene sweeps had their EXIT CODE checked, not their empty output read.** A zero-hit `rg` (exit 1) and a failed `rg` (exit 2) are indistinguishable from output alone. Both capture records are ASCII-only and carry no email-shaped token.

## User Setup Required

None. No external service configuration, no new credential, no package installed -- RESEARCH.md's Package Legitimacy Audit records N/A for this phase, and a dependency edit would have rotated the `test` hash mid-window.

## Next Phase Readiness

**Plan 11-03 is UNBLOCKED and the state it needs is exactly what it expects.**

Handed forward:

1. **The box is COLD in the way that matters.** `.nx/cache` is **absent**, so no local hit can short-circuit before the remote is queried -- which is TEST-10's stated reason for requiring the reset. `.nx/workspace-data` holds 13 entries from the cold capture; that affects the graph directory only, not the task cache, and the cold hashes are already recorded so nothing further depends on the graph state.
2. **No rebuild is needed and none should be inserted.** `packages/github-cache/dist/lib/trust.js` is present. Plan 11-03's D-08 soundness probe reads `isWriteTrusted(process.env).trusted` from that built file, and TEST-10 requires the probe's timestamp to PRECEDE the first Nx run. A rebuild would populate outputs that `typecheck`'s `dependentTasksOutputFiles` input hashes.
3. **The four hashes to expect a HIT on are these, and they are PRESENT in the shard right now:** `build` `17269409342684722256`, `typecheck` `122473981802582055`, `test` `11681410932071446589`, `integration` `8137422034373911537`. If 11-03 MISSes any of them, the cause is NOT a cold/warm hash divergence and NOT a stale mirror -- both are now excluded by measurement, which is the attributability D-06 was written to buy.
4. **The window: 29 days.** Closes around 2026-08-28. Plans 11-05 and 11-06 rotate three of the four hashes, so neither may run before 11-03's measurement is captured.
5. **`nx` remains forbidden until 11-03's measurement run.** The hard ordering rule extends through tasks 1 and 2 of plan 11-03. The first `nx` invocation must be the measurement itself.
6. **If `test` fails once during the measurement, capture the output BEFORE re-running.** The unattributed `test` failure at `69bd1b7` is still open in `08-nx-task-hash-parity/deferred-items.md`, and a re-run destroys the evidence.

No blockers.

## Self-Check: PASSED

Every claim above re-verified against disk, git and the live API rather than asserted:

| Claim | Check | Result |
|---|---|---|
| `11-hashes-warm.json` created | `[ -f ]` + parsed | FOUND, `graphState: warm`, 18 entries |
| `11-hashes-cold.json` created | `[ -f ]` + parsed | FOUND, `graphState: cold`, 0 entries |
| Task 1 commit `8d90fc8` | `git log --oneline` | FOUND |
| Task 3 commit `41c1f92` | `git log --oneline` | FOUND |
| Warm committed BEFORE the reset | commit order in `git log` | `8d90fc8` precedes `41c1f92`; the reset ran inside task 3 |
| Cold == warm on all four | the plan's own `node -e` verify block | 4/4 SAME, exit 0 |
| All four PRESENT in the shard | two paginated `gh api` reads | 4/4 PRESENT in both |
| Pagination was load-bearing | unpaginated read counted | 30 of 141, 0 `nx-cache-` names |
| Matcher discriminates | bogus-name control | ABSENT |
| `dist/lib/trust.js` survived the reset | `[ -f ]` immediately after reset | PRESENT |
| `.nx/cache` cleared | `[ -d ]` | absent |
| No source input rotated | `git status --porcelain packages/ .github/ start-cache-server/` | printed nothing |
| No `nx` after the reset | command-by-command audit, table above | confirmed |
| MAIN tree, not a worktree | `[ -d .git ]` | directory |
| ASCII-only artifacts | `rg '[^\x00-\x7F]'` on both records and this file | exit 1, no match |
| No email-shaped token | `rg` allowlist-inversion on both records and this file | exit 1, no match |
| Committer identity is the public one | `git config user.email` | the public gmail |
| REQUIREMENTS.md untouched | `git status --porcelain .planning/REQUIREMENTS.md` | printed nothing |

---
*Phase: 11-live-proofs-o1-o2-o3*
*Completed: 2026-07-29*
