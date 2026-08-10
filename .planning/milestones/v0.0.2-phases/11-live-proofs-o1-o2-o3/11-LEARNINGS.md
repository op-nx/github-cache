---
phase: 11
phase_name: 'live-proofs-o1-o2-o3'
project: 'github-cache'
generated: '2026-07-30'
counts:
  decisions: 7
  lessons: 8
  patterns: 8
  surprises: 8
missing_artifacts:
  - '*-UAT.md'
---

# Phase 11 Learnings: live-proofs-o1-o2-o3

## Decisions

### Sequential-on-main rather than worktree isolation

All 7 plans ran as single-plan waves on the main working tree, with `isolation="worktree"`
declined despite `workflow.use_worktrees: true`.

**Rationale:** every wave held exactly one plan, so there was no parallelism to gain, and the
phase's central deliverable was a perishable measurement of the main tree's own Nx cache state.
A fresh worktree has no `.nx/workspace-data`, no `node_modules` and no
`packages/github-cache/dist`, so the warm capture would have been permanently unrecoverable and
the cold run would have measured the wrong tree. `AGENTS.md` already prescribes this: plans that
are sequentially dependent gain nothing from isolation.
**Source:** orchestrator decision, AGENTS.md worktree decision rule

### `literal-reset` over the non-destructive variant

The cache was cleared by literal `npx nx reset` rather than by redirecting
`NX_CACHE_DIRECTORY` / `NX_WORKSPACE_DATA_DIRECTORY` into a scratchpad.

**Rationale:** D-05's locked choice and TEST-10's named mechanism in its named order, so nothing
had to be recorded as a deviation. The variant was measured to be only a PARTIAL redirection --
`CACHE_ARCHIVE_DIR` does not follow `NX_CACHE_DIRECTORY` -- which would have become a stated
soundness caveat on the phase's central measurement. The destroyed data is reproducible Nx
output and the mirror still held all four hashes.
**Source:** 11-02-PLAN.md task 2 checkpoint, 11-02-SUMMARY.md

### Maintainer sign-off gated the first hash-rotating edit

O1 and O2 were signed off before any edit that rotates a proof hash, at a blocking decision
checkpoint in 11-04 rather than as a formality after the fact.

**Rationale:** plan 11-05 rotates `test`, `typecheck`, `integration` and `lint`; after that the
mirror still holds the OLD hashes, so any re-measurement would MISS for a reason unrelated to
cross-OS sharing. The `depends_on` graph is what enforces the ordering, not prose.
**Source:** 11-04-PLAN.md T-11-17, 11-04-SUMMARY.md

### Rehearse the O3 instrumentation on a PR before spending the proving run

A PR round trip exercised `o3-witness` and both probes before the temporary `main` push.

**Rationale:** the witness had never executed in any prior run. The rehearsal could catch a
broken jq selector, step rename or artifact-name drift at no cost to the real proof. It was
explicitly NOT accepted as the proof itself, because on a `pull_request` the `integration` job
checks out the merge commit while `hash-parity` pins `head.sha` -- two different trees, so
D-18's citation would not be commensurable.
**Source:** 11-07 checkpoint, maintainer selection

### PR #11 closed rather than allowed to auto-merge

The open PR was closed before the proving push instead of being auto-marked MERGED as in
phases 9 and 10.

**Rationale:** avoids leaving a permanent merged-PR record for a `main` state that existed for
roughly thirty minutes. Accepted as a deliberate divergence from the #9 / #10 precedent.
**Source:** 11-07 checkpoint, maintainer selection

### No shape-check spec written over `11-EVIDENCE.md`

The Nyquist audit deliberately declined to add an automated guard asserting the evidence
record's required sections.

**Rationale:** `.planning/**` is in no Nx input set, so such a spec would replay a cached PASS;
the directory moves at milestone completion, so a path-keyed guard rots; and the record is
frozen one-shot evidence with no live failure mode. Coverage of an unrepeatable measurement
belongs in the evidence's own self-checking properties, not in a test.
**Source:** 11-VALIDATION.md

### `read-integration-hash` covered by an integration spec, not a unit spec

Its 11 cases live in `read-integration-hash.integration.spec.ts`.

**Rationale:** by constraint rather than preference -- the fixtures need `tmpdir`, which LINT-02
bans at every unit-spec path, and the `eslint-disable` escape hatch would have reopened CORR-05
(whose closure phase 9 achieved by removing that exact import from `cache-archive-path.spec.ts`).
Net gain: the `integration` target runs on both matrix legs, so the instrument is now exercised
on Windows too.
**Source:** 11-VALIDATION.md

---

## Lessons

### Pagination is load-bearing, and the proof of it must be measured

`gh api` without `--paginate` returned 30 of 141 release assets carrying ZERO `nx-cache-` names.
An unpaginated read would have reported all four hashes ABSENT and manufactured D-07's
stop-the-phase finding on a reader artifact.

**Context:** the plan was willing to accept "141 > 100" as sufficient argument. Running the
unpaginated read converted an inference into a measurement, and the matcher was proven
non-vacuous the other way too (it rejects 125 non-prefixed assets, and a bogus control key reads
ABSENT).
**Source:** 11-02-SUMMARY.md

### A leading-slash `rg` needle false-zeroes in Git Bash

`rg -F -e '/home/runner/...'` reported ABSENT while the text was present; MSYS rewrites the
argument before `rg` sees it. `C:/...` needles pass through untouched.

**Context:** the asymmetry is the danger -- a sweep testing both a Linux and a Windows path
returns "Windows found, Linux absent", which reads as a meaningful result rather than a tooling
artifact. It nearly wrote a wrong producer-OS fingerprint into a proof record, and was caught
only because a regex search on the same file contradicted it.
**Source:** 11-03-SUMMARY.md

### The cold capture warms the graph it measures

`.nx/workspace-data` went 0 -> 13 entries during the cold capture itself.

**Context:** RESEARCH.md flagged this as unstated; it is now measured. There was exactly ONE
window for the cold number -- a verification re-run would have read 13 entries and reported
`warm`. `.nx/cache` is unaffected, so no local hit could short-circuit the remote read.
**Source:** 11-02-SUMMARY.md

### `requirements mark-complete` leaves a checkbox and its traceability row disagreeing

It ticks the checkbox but only rewrites rows whose status is exactly `Pending`; a row reading
`Pending (some parenthetical)` is left untouched, producing a self-contradictory file.

**Context:** hit twice, in 11-03 and 11-07, and hand-corrected both times. Plan 11-04 avoided it
by suppressing the call entirely once it determined the blanket flip had nothing to gain and one
forbidden effect.
**Source:** 11-03-SUMMARY.md, 11-07-SUMMARY.md

### `state.record-metric` silently rejects positional arguments

The executor spec calls it positionally; the router requires named flags and returns
`phase, plan, and duration required`. The failure is non-fatal, so per-plan metrics just stop
accumulating with no error anywhere.
**Source:** 11-04-SUMMARY.md

### Wrapping a shell snippet in `( ... ) || echo` suppresses errexit

A verification of the WR-10 fix produced a false negative for exactly this reason. Re-tested as
`bash -e <file>` -- the way Actions actually runs a step -- the pre-fix form exits 7 with
completely empty output.

**Context:** the harness used to check a shell behaviour changed the behaviour under test. Test
shell fixes the way the runner will execute them, not the way that is convenient to invoke.
**Source:** 11-REVIEW-FIX.md

### The fallow bridge drops the complexity category

GSD's `normalizeFallowReportFile` maps only dead-code and duplication keys, so a `verdict: fail`
driven entirely by complexity normalizes to `total: 0` and the code reviewer receives an EMPTY
structural findings block.

**Context:** measured here as 7 complexity findings, `max_cyclomatic` 12, normalizing to a
156-byte empty report. Reading `FALLOW.json` directly and hand-extracting `complexity.findings[]`
is what put the one INTRODUCED finding in front of the reviewer.
**Source:** 11-REVIEW.md structural findings section

### LSP diagnostics mis-parse JSDoc prose as syntax errors

Ten `Expression expected` / `';' expected` errors were reported against lines that were entirely
inside a JSDoc comment block. `nx typecheck` passed cleanly.

**Context:** a second instance the same session claimed `workingTreeClean` was declared but never
read, at a line number that did not contain the symbol at all. The test runner and compiler are
the authoritative signals; the diagnostic feed is not.
**Source:** orchestrator verification during 11-VALIDATION

---

## Patterns

### Bank the perishable number first, gate second

Plan 11-02 captured and COMMITTED the warm hashes as task 1, then put the destructive `nx reset`
behind the blocking checkpoint as task 2.

**When to use:** any plan where a gate precedes an irreversible action and some measurement is
already available. Whichever way the gate resolves, the unrecoverable number survives -- and the
maintainer decides against measured facts rather than intentions.
**Source:** 11-02-PLAN.md task ordering

### Pre-register counts before the run, in the plan

Each measuring plan carries a `## Pre-registered counts` section naming the expected count for
every claim, written before execution.

**When to use:** whenever a "the job was green" style claim will be made. It removes the option
of back-filling an expectation to match a result. The PR rehearsal's 15 green legs reconciled to
the pre-registered 23 (15 + 8 push-only) rather than being retro-fitted.
**Source:** 11-03-PLAN.md, 11-07-PLAN.md, D-23

### Mark a non-discriminating metric as such, beside the line

Every recorded `Cache: n/m hit` carries NON-DISCRIMINATING IN BOTH DIRECTIONS with both grounds
stated: a 0% prints identically with no sidecar at all, and a non-zero count includes local hits.

**When to use:** any headline metric a reader will reach for as evidence but which cannot
actually discriminate the hypothesis. Annotate at the point of use, not in a distant caveat.
**Source:** 11-EVIDENCE.md, D-24

### Multiple independent attribution means, each with its limit stated

Four means (structural, in-artifact fingerprint, job-window cross-reference, hash recomputation),
with every hash naming WHICH means carried its verdict AND that means' limit.

**When to use:** when the obvious signal is unavailable or misleading for some subjects. Two of
the four hashes had no in-artifact fingerprint at all and were carried by the job-window
cross-reference; the scheme was load-bearing rather than a fallback.
**Source:** 11-04-SUMMARY.md, 11-EVIDENCE.md

### Observe the red, never predict it

Every new guard was seen to fail before it passed, by mutating the thing it asserts on and
confirming the failure message named the right cause.

**When to use:** always, and especially for content guards. WR-09's mutation was the clearest
payoff -- deleting one of two occurrences left the EXISTING assertion passing while the new count
assertion failed, which proved the half-lock was real rather than merely argued.
**Source:** 11-05-SUMMARY.md, 11-REVIEW-FIX.md, 11-VALIDATION.md

### Detect secrets by allowlist inversion

Assert the only email-shaped token present is the approved public one and flag everything else,
rather than searching for the forbidden value.

**When to use:** any credential or identity sweep on a public repo. Writing the forbidden value
as a search needle is itself the leak.
**Source:** 11-SECURITY.md, 11-07-SUMMARY.md

### Pair every negative result with a positive control

A zero-hit search is not evidence of absence until a known-present pattern is shown to match
through the same path.

**When to use:** every `rg`-based absence claim. The secret pre-flight escalated from an
empty-output no-match to an API read returning `total_count: 0`, because the positive control
revealed the first listing had no content at all -- so "no match" and "nothing was read" were
indistinguishable.
**Source:** 11-07-SUMMARY.md, 11-02-SUMMARY.md

### Predict a side-effect run in advance so it is not later read as an anomaly

The restore push was stated, with its phase 9 and 10 precedents, before anything was pushed.

**When to use:** whenever an operation produces a second artifact a later reader could mistake
for a fault. Recording the prediction before the fact is what makes it a prediction.
**Source:** 11-07-PLAN.md D-20

---

## Surprises

### The `build` hash was written by the `typecheck` job

The `build` job's own sidecar came up at 16:40:25Z, three seconds AFTER the entry already
existed at 16:40:22.677666Z.

**Impact:** the graph premise showing up as live server-side metadata -- independent
corroboration of TEST-08's mechanically-asserted claim, from a direction the plan did not
anticipate.
**Source:** 11-04-SUMMARY.md

### `last_accessed_at` proved the local read never reached the Actions cache

The field read `17:5x`, not the `21:44` of the O1/O2 measurement.

**Impact:** server-side corroboration, from the opposite side, of the probe's
`isWriteTrusted === false` -> Releases-backend finding.
**Source:** 11-04-SUMMARY.md

### The PR merge commit's tree was byte-identical to head's

`refs/pull/11/merge` is a distinct commit, but both trees hashed to `f6610d30613d...` and
`git diff` between them was empty, because `origin/main` was a strict ancestor.

**Impact:** the incommensurability the design guards against did not actually obtain on that PR.
Reported rather than buried, because it qualifies how strong the "a PR cannot be the proof"
claim is -- while remaining contingent on nobody pushing to `main`, resting on tree-identity
where D-20 specifies commit-identity, and unable to re-warm the mirror Phase 12 needs.
**Source:** 11-07 rehearsal report

### A critical injection on a path the authors had already reasoned about

`ci.yml` anchors the verification grep at `^` precisely because "the failure detail interpolates
values the downloaded record controls" -- then wrote the same record-controlled value into
`$GITHUB_ENV` three lines earlier, guarded only against emptiness.

**Impact:** rated Critical: reachable on fork PRs, in a job holding `contents: read` +
`actions: read`. The security audit went further and found it was a threat-model GAP --
T-11-23 accepted the fork-PR witness "because it is read-only", a premise the code did not
satisfy until the fix. The threat was identified for one sink and missed for the other.
**Source:** 11-REVIEW.md CR-01, 11-SECURITY.md T-11-27

### Two of `assertGraphPremise`'s five assertions cannot fail

Assertion 5 is unreachable once assertion 4 pins `build` and `typecheck` into the control set;
assertion 6 can never fire because assertion 2 has already rejected the overlap.

**Impact:** a coverage-overstatement defect rather than a correctness one -- three live
assertions presented as five, in a phase whose entire subject is guards that read as coverage
but are not. Resolved by correcting the contract comment rather than deleting working code.
**Source:** 11-REVIEW.md WR-06

### A prose lock that locked only half of what it named

Row A's two required phrases each occur TWICE in `ci.yml`, and `toContain` is satisfied by the
first occurrence, so deleting either comment block left the row green.

**Impact:** exactly the trap row B was written to avoid by naming its job. Eight of the ten
phrases were unique; only row A's two were duplicated.
**Source:** 11-REVIEW.md WR-09

### The workspace has two graph nodes, not one

The reviewer's suggested `Object.keys(projectGraph.nodes)` fix throws
`Cannot find configuration for task @op-nx/source:integration`, because the root `@op-nx/source`
is also a node.

**Impact:** one of three suggested patches that would have shipped a defect if applied literally
(the others: folding the premise record into the `hash-parity` artifact would give the
comparator four records where it demands two, and bare `@uri` also escapes `/`). A review finding
can be right about the defect and wrong about the fix.
**Source:** 11-REVIEW-FIX.md

### A `ci.yml`-only edit rotates exactly one hash

Editing `ci.yml` rotated `test` alone, leaving `typecheck` and `integration` untouched, because
`nx.json:69` registers it as a `test` input only.

**Impact:** sharper than the plan predicted, and it made the rotation arithmetic verifiable
rather than assumed. `build` never rotated across the whole phase, exactly as `nx.json:116`'s
spec-file exclusion implied.
**Source:** 11-06-SUMMARY.md
