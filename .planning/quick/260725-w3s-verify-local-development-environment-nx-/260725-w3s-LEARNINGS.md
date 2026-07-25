---
phase: quick-260725-w3s
phase_name: "Verify local development environment Nx cache HITs for all distinct Nx target names"
project: "@op-nx/github-cache"
generated: "2026-07-25"
counts:
  decisions: 4
  lessons: 6
  patterns: 4
  surprises: 3
missing_artifacts: []
note: "Spans quick 260725-rk4 and 260725-w3s -- the two ran back to back on one branch and several findings were measured during rk4 but only understood during w3s."
---

# Quick 260725-w3s Learnings: local cache HIT/MISS verification

## Decisions

### An all-MISS measurement is only reportable after the measurement is proven sound
The Releases reader degrades EVERY fault to a MISS by design (D-11), so a mistyped port, a
token mismatch, a failed `gh auth token`, a rate limit and a genuine absence are mutually
indistinguishable in the output. The plan therefore ordered soundness proof BEFORE any Nx run
and made it a `must_have`, not a courtesy.

**Rationale:** without it the headline result ("zero remote hits") is not a finding, it is an
uninterpreted symptom. Measured ordering: tier probe at 00:46, first Nx run at 00:48:32.
**Source:** 260725-w3s-PLAN.md Task 1, 260725-w3s-RESULTS.md sections 1 and 3

### Two graph states measured, not one, because no recipe isolates the artifact cache
The only true cold-local-cache recipe (fresh `NX_CACHE_DIRECTORY` + fresh
`NX_WORKSPACE_DATA_DIRECTORY`) CHANGES the task hash under test, and there is no recipe that
cold-starts only the artifact cache while preserving the warm-graph hash. Picking one state
silently would have answered a different question than the one asked.

**Rationale:** COLD answers "what a new developer and every CI runner experience"; WARM-GRAPH
answers "is the hash an established local box computes the hash CI published". Both were
wanted, so both were measured and reported separately.
**Source:** 260725-w3s-PLAN.md `<pre_flight>`, RESEARCH 4b/4c

### The outcome label was left UNRESOLVED rather than auto-locked
Whether all-MISS is a PASS or a FAIL was rated HIGH impact (it decides whether an
audit-passed milestone is recorded as having a functional gap) and NOT-HIGH confidence, which
is the trap quadrant. It was recorded as an explicit UNRESOLVED item and neither the executor
nor the verifier was permitted to decide it.

**Rationale:** the `--auto` discuss pass would otherwise have silently locked it. Deferred by
the maintainer to after the post-merge re-measurement, since the evidence that would settle it
does not exist yet.
**Source:** 260725-w3s-CONTEXT.md, 260725-w3s-VERIFICATION.md H1

### Verify-only scope held even though the fix direction was visible
The cross-OS gap's fix direction was understood mid-task, and nothing was fixed.

**Rationale:** the maintainer had deferred the gap to a later milestone, and resolving it
properly changes CORR-01's uniform wording plus two comment-locked single sources
(`releaseAssetName`, `cacheArchivePath`) -- milestone-shaped, not quick-shaped. Acting would
have silently expanded past a maintainer decision.
**Source:** 260725-w3s-CONTEXT.md, .planning/STATE.md Deferred Items

## Lessons

### GitHub Actions background-step semantics are documented ONLY in a changelog
`background:`, `wait:`, `wait-all:` and `cancel:` ship documented only in the 2026-06-25
changelog "Actions steps can now be run in parallel". The workflow-syntax reference that entry
links to does not mention them at all. Three semantics therefore had to be MEASURED, and one
prior assumption about each was wrong:

- Omitting `cancel:` DOES hang the job. The runner inserts a step literally named "Wait for
  all background steps"; run 30172888579 died at its 3-minute cap. (This had been asserted as
  fact in three places while being untested.)
- `cancel:` is NOT skipped after a failing step. Run 30172032003: a failing step with no
  `continue-on-error` followed by a bare `cancel:` ran the cancel (conclusion success), tore
  the sidecar down, and went red in 8 seconds.
- `if:` is REJECTED on a `cancel:` step. Parse-time rejection ("Unexpected value 'if'"), run
  30171349564, zero jobs scheduled.

**Prevention:** for these four keywords there is no doc to check. Probe with a throwaway job
first, then commit.

### `Cache: n/m hit` is non-discriminating in BOTH directions
It was cited as evidence a remote consult happened. It is not: a sidecar-less run printed the
identical `0/1 hit (0%)` line, and RESEARCH 4a then measured that a NON-zero hit counts LOCAL
hits identically (`CACHE_HIT_STATUSES` does not distinguish). This task's own two runs
demonstrate both directions live -- a `0/4` co-existing with a demonstrably consulted remote,
and a `4/4` produced with zero remote consults.

**Prevention:** only the per-task `[remote cache]` label discriminates. Record the `Cache:`
line, mark it non-discriminating, never conclude from it.

### A cross-OS hash comparison that does not control graph state proves nothing
An ubuntu-vs-Windows `build` hash difference was attributed to OS. The SAME two values are
reproducible on ONE Windows machine at one commit by varying only `.nx/workspace-data`
freshness (warm 14522047022641658505, cold 13655686526929222562). All four cacheable targets
diverge under freshness alone. The divergence is not DISPROVEN -- CI is always cold, and
cold-Windows measured locally equals the recorded cold-Windows value -- but the evidence does
not isolate OS as the variable.

**Prevention:** state the graph state of BOTH sides of any cross-OS hash claim. Cold-vs-cold
is the only valid comparison.

### Inferring severity from a quoted fragment instead of the acceptance criterion
The cross-OS finding was framed wrong THREE times (incidental protection -> defect against
intent -> deferred value) because each reading came from a quoted line or a memory note rather
than the requirement text. TEST-05's actual wording -- "a correct hit or a MISS, never a
wrong-OS artifact" -- settled it in one line, and it had been there the whole time.

**Prevention:** before asserting the severity of anything requirement-shaped, open the
ROADMAP/REQUIREMENTS acceptance wording for that requirement id and quote it. Never reason from
PROJECT.md summaries or STATE.md notes.

### A warm-graph copy masks the remote entirely
Copying `.nx/workspace-data` carries its `cache_outputs` rows, so Nx served all four tasks
locally from an artifact directory containing no artifacts and never consulted the remote at
all. Predicted by the plan, then confirmed.

**Prevention:** warm-state Nx labels are INCONCLUSIVE about the remote by construction. Answer
warm hashes with a direct read-path probe instead. Do not edit the copied DB to force a miss.

### `git commit -m` fails on this repo
Fails with COMMIT_EDITMSG "Invalid argument" because the repo lives on a D: Dev Drive (ReFS).

**Prevention:** write the message to the scratchpad and use `git commit -F <path>`.

## Patterns

### Prove the measurement before attributing the result
When the system under test degrades every fault to the same benign output, invert the usual
order: rule out the silent causes FIRST, through the code's own literal call shape, and only
then attribute. Here that meant replicating `runHelper`'s exact `spawn` options -- `shell:
false` does no PATHEXT resolution on Windows, so a `.cmd`-shimmed `gh` would silently yield
nothing and look identical to a genuine absence.

### Distinguish ACTIVE causes from causes MASKED behind them
Three candidate causes existed; one was established positively (16/16 asset probes absent,
plus a wider bare-hash probe at 0 under any suffix), and the other two were named UNOBSERVABLE
behind it and explicitly marked NOT TESTED in two places. Claiming a masked cause was tested
is the substantive defect this avoids.

### Differential control against a dead port
A COLD run pointed at a refusing port 41998 fails loudly and exits 1, so a clean exit 0 on
41999 proves Nx's requests actually arrived. The error text also revealed the exact request
shape (`/v1/cache/<task-hash>`), confirming the tabulated hashes are the ones Nx asks for. Its
limit was recorded too: the message appears after `Successfully ran targets`, consistent with
the post-run PUT, so it does not isolate the read half.

### Brief unreliable agents with a FILE deliverable, not a text return
`gsd-plan-checker` went idle without returning a verdict four times across three instances,
including once with all network and `nx` work capped out. `gsd-verifier` went idle the same
way -- but its full 15 KB verdict survived, because it had been told to write
`260725-w3s-VERIFICATION.md`. The plan-checker's work was lost because it had been told to
return text only. Both agents DID the work; only the return channel failed.

## Surprises

### The failure was in returning text, not in doing the work
Four idle-without-verdict events looked like agents failing at the task. The verifier's
recovered file proves otherwise: it had completed a thorough audit, independently re-deriving
facts with `Get-NetTCPConnection`, `git show --word-diff=porcelain`, and a direct ROADMAP read,
and had even caught an error in its own brief (10 `must_haves.truths`, not the 11 it was told).
A capped-out environment did not prevent the idle, which disproved the standing theory that
live probing was the cause.

### The verifier found the artifacts UNDER-reported, not over-reported
The expected failure mode for a self-authored measurement report is overclaiming. Here the
opposite: a fourth `.nx/` fingerprint existed in the scratchpad, taken after two extra runs the
SUMMARY never mentioned, and it was byte-identical to the first. The no-collateral-writes claim
was better supported than the record it was based on.

### The mirror's 79 assets were all unreachable, in two different ways
Cause (1) was not "the mirror is empty" -- it holds 79 assets. 50 are PoC-era `<hash>.tar.gz`,
unreachable because the reader asks for `<hash>-<os>` with no extension, and 29 are v0.0.1
`<run_id>-<os>` seeds: real publisher output, but keyed by run id rather than task hash. An
extra structural discriminator falls out of this -- 11-digit run-id keys cannot collide with
20-digit task hashes by construction.
