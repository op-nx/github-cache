---
phase: 13
phase_name: 'read-only-actions-cache-backend'
project: 'github-cache'
generated: '2026-08-02'
counts:
  decisions: 12
  lessons: 14
  patterns: 10
  surprises: 10
missing_artifacts:
  - '13-UAT.md'
---

# Phase 13 Learnings: read-only-actions-cache-backend

## Decisions

### The read-only backend is selected per-LEG by ROLE, never per-EVENT

`CACHE_READ_ONLY` is a workflow-author signal. The event-derived alternative (make
`pull_request` read-only) and the "event band plus role signal" hybrid were both rejected.

**Rationale:** TRUST-05's asymmetry is a ONE-WAY RATCHET -- a signal may only narrow RW->RO,
never widen RO->RW. An event-derived read-only `pull_request` base could never be widened back
for `dogfood-seed`, which asserts a hard PUT 200, so it would have reverted quick task
`260801-vyy`'s CR-18 fix with no possible composition to restore it. Producer-vs-consumer ROLE is
not derivable from any GitHub-supplied env fact, and the 2026-06-26 read-only-cache changelog
exposes no per-job lever. The workflow author supplies the one thing the runner cannot.
**Source:** 13-CONTEXT.md (D-02a), 13-03-SUMMARY.md

---

### Both factories live in ONE file

`createActionsCacheBackend` and `createReadOnlyActionsCacheBackend` are composed in
`actions-cache-backend.ts` rather than split across sibling modules.

**Rationale:** the drift guard at `actions-cache-backend.spec.ts:501-543` is a FILE-SCOPED source
scan. A sibling-file split makes it blind, and a second `restoreCache` could ship with every spec
green. Confirmed rather than assumed: the guard passed with ZERO edits under the composed shape.
**Source:** 13-02-SUMMARY.md, 13-CONTEXT.md

---

### `CACHE_READ_ONLY` is checked LAST in `selectBackend`

The knob branch sits below every other branch, immediately above the writable return.

**Rationale:** branch ORDER is what makes "can only narrow" a fact rather than a promise. Every
path that could narrow has already returned or thrown, so the knob is structurally incapable of
widening -- it cannot resurrect the Releases branch, the fail-closed throw, or the memory-degrade
branch, because control never reaches that line from any of them. `selectBackend.length` stays 0,
so no caller can request write.
**Source:** 13-03-SUMMARY.md, 13-CONTEXT.md

---

### The knob name appears exactly once in `select-backend.ts`

The top-level JSDoc calls it "the read-only ROLE knob" instead of naming the literal.

**Rationale:** not stylistic. The branch-order guarantee is checked by FIRST-OCCURRENCE position,
so a second mention in a doc comment ABOVE the token check defeats the very check it documents.
The JSDoc now records this, so a later reader does not "improve" it back.
**Source:** 13-03-SUMMARY.md

---

### The rejected exact-string equality form is described in prose, never quoted

The comment says "never an exact-string equality against a `'true'` literal" rather than showing
the form.

**Rationale:** a zero-count grep on that file guards against a `'true'`/`'1'`/`'yes'` parser.
Quoting the banned form in the comment that bans it trips the ban. Bare truthiness is also the
fail-SAFE direction on a one-way ratchet: a value of `flase` still narrows, whereas an
exact-string parser would silently restore the WRITABLE backend on a typo.
**Source:** 13-03-SUMMARY.md

---

### The gate's soundness argument is INDUCTIVE, not per-run

The comments rest correctness on the read-only property, not on job ordering.

**Rationale:** a leg that cannot write can only carry a `[remote cache]` label from a genuine
restore of the ubuntu producer's entry -- independent of run ordering. XOS-08's `needs:` edge is
LIVENESS only. Resting the argument on the edge would make the gate's correctness contingent on
scheduling.
**Source:** 13-CONTEXT.md, 13-05-SUMMARY.md

---

### Stale-site correction bounded to seven sites, with exactly two survivors kept

`ci.yml:856` (`runner.debug`) and `ci.yml:959` (the `integration` matrix leg) keep saying
`RECORDED, never gated`.

**Rationale:** both are still TRUE -- this phase does not convert those jobs. `runner.debug` is a
fact about the run with no floor to compare against; the `integration` leg still SAVES, so its
count is exactly the launderable number XOS-09 removed elsewhere, and gating it would
re-introduce the confound. The research's proposed blanket sweep would have deleted two correct
claims.
**Source:** 13-05-SUMMARY.md, 13-CONTEXT.md

---

### The seven requirement IDs are registered Pending, closed at the phase step

`requirements.mark-complete` was deliberately not run per-plan.

**Rationale:** direct precedent -- on 12-01 a RED-only plan falsely closed all three XOS rows,
after which every Phase 12 plan skipped the handler and the requirements closed once at the phase
step. A requirement closed by a plan that only wrote failing tests is a false traceability claim.
**Source:** 13-01-SUMMARY.md

---

### No C19 control row added to THREAT-MODEL.md

The decision is written INTO the Residual-notes bullet with its reason.

**Rationale:** the phase strictly REDUCES capability, opens no attack surface and introduces no
new trust boundary, so the ledger's own criterion ("keep only what has no canonical home") is met
by a note. Recording the no-row decision explicitly matters because ledger silence is otherwise
indistinguishable between "assessed and empty" and "never assessed".
**Source:** 13-01-SUMMARY.md

---

### The two coverage totals are allowed to differ (57 vs 51)

REQUIREMENTS.md counts the full DEFINED set; ROADMAP.md counts the ROADMAPPED subset. Both files
name the difference set and a script verifies it.

**Rationale:** forcing them equal would require either inventing roadmap rows for six IDs that
legitimately have none, or deleting definitions. Naming the gap is honest; equalising it would
fabricate.
**Source:** 13-01-SUMMARY.md

---

### The non-vacuity pairing lives inside ONE test

"Knob narrows" and "same env is writable without it" are asserted in a single `it`.

**Rationale:** split across two tests, one can be deleted while the other still passes and still
looks meaningful. Kept together, neither half survives alone. The same reasoning produced the
in-test positive control in the T-13-03-E1 clause added during validate-phase, where an inert mock
would otherwise satisfy `not.toHaveBeenCalled()`.
**Source:** 13-03-SUMMARY.md, 13-VALIDATION.md

---

### The gate floor was NOT tightened after a green run

All three legs hit their exact predicted counts and the floor stayed at 1.

**Rationale:** D-05 locked the floor because the counts follow Nx's task graph, which can
legitimately change. One green run is not a reason to re-open that. Tightening to an exact pin
would convert a stable gate into a brittle one on the strength of a single observation.
**Source:** 13-06-SUMMARY.md

---

## Lessons

### "Asserted mechanically" in a plan is a claim to VERIFY, not a fact to inherit

Two separate threats in this phase declared a mechanical control that did not exist.
T-13-05-D1's "exactly two survivors, asserted mechanically" had no assertion at all.
T-13-03-E1's branch-order check was a one-shot `indexOf` from plan 13-03 that never became a
clause, and `select-backend.ts:33-35` and `:80-81` both stated it WAS standing.

**Context:** in both cases the STATE was correct, so nothing looked broken -- deleting a survivor
or hoisting the knob produced no red. A control that is described but absent is strictly worse
than one that is known missing, because the description suppresses the search.
**Source:** 13-SECURITY.md, 13-VALIDATION.md

---

### An audit can dismiss a real threat through the very lens that blinds the guard

The security audit's first pass found T-13-03-E1's guard was not standing, then argued the
property was covered anyway: "that move also does not widen (read-only -> read-only), so it is a
wrong-backend defect rather than an EoP." It reached that by reasoning through
`isWritableBackend`, which is exactly what collapses the memory stub and the read-only Actions
backend into one token and made the narrowing table blind.

**Context:** the memory stub reaches no external store; the read-only Actions backend reaches the
live cache. A token-less write-trusted context would have been handed a live cache reader instead
of an inert stub -- a genuine capability increase. The auditor retracted this in writing on its
third pass.
**Source:** 13-SECURITY.md (Correction section)

---

### Two audits asking DIFFERENT questions found what neither found alone

`verify_phase_goal` asked "was the requirement delivered" and found 7/7. `secure-phase` asked "does
the mitigation exist". `validate-phase` asked "would an automated check REDDEN if this regressed".

**Context:** the three come apart. The security pass found T-13-03-E1's guard was not standing but
argued coverage anyway; the nyquist pass MEASURED the property and found it uncovered. Neither
audit alone would have closed it. The verification pass, which preceded both, reported the
requirement as met -- correctly, because delivery and sampling are different properties.
**Source:** 13-SECURITY.md, 13-VALIDATION.md, 13-VERIFICATION.md

---

### Prose in a scanned file is INPUT to its own criterion

Four occurrences on this branch: 13-02 once (a comment quoting the OLD error prefix), 13-03 twice
(a JSDoc line putting the knob's first occurrence above the branch check; a comment containing the
banned equality form), 13-04 once (a zero-count criterion whose only match was the pre-existing
comment documenting the ban -- unsatisfiable without deleting a correct explanation).

**Context:** whenever a criterion is a mechanical scan over a file, any comment on that file that
quotes the guarded literal to explain it will trip it. 13-04's case is the instructive one: the
criterion was authored against a file whose PRE-EXISTING comment already tripped it, so it was
never satisfiable. Deleting an accurate explanation of why snapshots are banned, to satisfy a grep
that checks snapshots are banned, trades the documentation for the check that documents it.
**Source:** 13-02-SUMMARY.md, 13-03-SUMMARY.md, 13-04-SUMMARY.md

---

### A zero-count criterion with a non-zero baseline can never pass

`git grep -c -F -- "-lt 1"` was specified to print `3`. Measured at `HEAD~1` it already printed
`1`, because `ci.yml:1223` contains `-lt 100` and `-lt 1` is a substring of it.

**Context:** the precise needle `-lt 1 ]` reads exactly `3` post-edit and `0` before. Always
measure a criterion's baseline against the PRE-change tree before adopting it; a criterion that
cannot pass reads as a real failure to whoever runs it next.
**Source:** 13-05-SUMMARY.md

---

### `git grep -c` prints NOTHING and exits 1 when the count is zero

It does not print `0`.

**Context:** any criterion phrased as "prints `0`" is satisfied by empty output plus exit 1, which
reads as a failure to a careless check -- and as a pass to a careless script. Both zero-count
criteria in plan 13-04 were in that shape.
**Source:** 13-04-SUMMARY.md

---

### `nx test <project> -- <pattern> --skip-nx-cache` passes the flag to vitest

Vitest rejects it and the run fails with a Node error rather than an argument error.

**Context:** the flag must PRECEDE the `--`: `nx test github-cache --skip-nx-cache -- docs-adoption`.
Cost one confusing red run. Worth knowing before reading such a failure as a real one.
**Source:** 13-04-SUMMARY.md

---

### A red CI job is not proof the gate fired

`ci.yml:527` is a pre-existing bare `exit 1` in the sidecar readiness poll, present inside EVERY
Windows job block.

**Context:** a job can redden for that reason with the gate never reached, and a spec clause
matching `/exit 1/` was GREEN before this phase existed. Assert the count COMPARISON line, never
`exit 1`; when observing a red job, confirm WHICH STEP failed via the jobs API before claiming the
gate fired. This is a live vacuity trap the file MEASURED rather than reasoned about.
**Source:** 13-05-SUMMARY.md, 13-EVIDENCE.md

---

### esbuild comment retention is POSITIONAL, not blanket

Plan 13-03 claimed a `memory-backend.ts` comment-only edit would drift the committed bundle
because "esbuild preserves source comments in this configuration". It does not.

**Context:** leading JSDoc blocks on exported declarations are STRIPPED; a comment INSIDE an object
literal, between members, is kept. The bundle diff was exactly the three executable lines of the
new branch. A future executor should not expect a bundle diff from a doc-comment edit, and should
not treat a zero-diff bundle after one as a failed build.
**Source:** 13-03-SUMMARY.md

---

### A partial RED is the expected shape, not a broken test

13-03's RED was 7 failures, not the 14 predicted. 13-05's was 9, not the 6 the plan asked for.

**Context:** in 13-03 the narrowing table and the unset/empty rows pass against an implementation
that ignores the knob entirely -- correctly so, because the table proves narrowing, not that the
knob acts. In 13-05 the plan's own Task 2 renamed the count step, which the pre-existing
`cacheObservation` clause pins, so three more clauses HAD to move; the two instructions could not
both be satisfied. Read a partial RED against what each clause actually claims before calling it
wrong.
**Source:** 13-03-SUMMARY.md, 13-05-SUMMARY.md

---

### A missing ESM export surfaces at CALL time under vitest, not at link time

13-02's RED failed as "is not a function", not as an unresolved-import error.

**Context:** vitest's esbuild transform turns the ESM named import into an interop property read.
Same signal, same 5 tests, same reason -- worth knowing so a future executor does not chase a
"wrong RED".
**Source:** 13-02-SUMMARY.md

---

### GSD state handlers corrupted STATE.md on EVERY plan this phase

`state.advance-plan` regressed `last_activity_desc` to a stale plan id; `state.update-progress`
wrote `completed_phases`/`percent` as 2/29 against a body saying 6/7 and 86%; `state.add-decision`
injects U+2014 into an ASCII-only repo and defaults the phase marker to `?` unless `--phase` is
passed; `state.record-metric` and `state.add-decision` both REJECT positional arguments and fail
with a bare `... required`, so the metric silently never records.

**Context:** six for six. After any `state.*` call, re-read STATE.md and repair before staging.
Use named flags only, and never pipe handler JSON into a file -- `state.update-progress` emits a
Unicode block-character progress bar that would mojibake on this platform.
**Source:** 13-01-SUMMARY.md, .continue-here.md

---

### `init.*` probes MUTATE tracked files

Probing `init.execute-phase` / `init.plan-phase` flipped `config.json`'s `_auto_chain_active` and
rewrote STATE.md's frontmatter and Current Position block.

**Context:** these are legitimate execute-phase bookkeeping writes, not corruption, and were left
in place -- but a "probe" that changes tracked state is not a read. Expect a dirty tree after one.
**Source:** 13-01-SUMMARY.md

---

### The counting instrument itself had drifted, and was caught BEFORE the run

Phase 12 recorded 1/2/1 by counting the literal out of each job log. Counting the same way today
returns a higher number, because the count step's own shell body -- which contains the `grep`
needle -- is echoed into the job log by the runner.

**Context:** a pre-registration reusing Phase 12's numbers without saying which instrument produced
them would have manufactured a false mismatch. Both figures were pre-registered: the gate-printed
count and the job-log raw count. When re-using a prior phase's numbers, re-derive the instrument,
not just the value.
**Source:** 13-06-SUMMARY.md

---

## Patterns

### Mutation measurement as the acceptance standard for any guard

Break the thing the guard protects, confirm THAT clause reddens and preferably that it reddens
ALONE, restore, record the observed split.

**When to use:** every time a new guard is claimed as coverage. This phase recorded splits as
observed numbers (`1 failed | 42 passed`) rather than as adjectives, because the number is
re-runnable and "this clause is non-vacuous" is not. Both gaps found by the audits were found this
way and neither was visible by reading.
**Source:** 13-04-SUMMARY.md, 13-05-SUMMARY.md, 13-SECURITY.md, 13-VALIDATION.md

---

### Mutate IN MEMORY when the guard reads a file

Replicate the guard's own file-read and extraction logic in a scratchpad script, mutate the string,
and run the assertions against it -- rather than editing the real file.

**When to use:** any guard that scans `ci.yml`, a doc, or another spec. The security auditor
verified the T-13-05-D1 clauses this way by replicating the spec's `codeLines` strip and `jobBlock`
extractor, and the working tree was never perturbed. For a guard over SOURCE, in-memory is not
possible -- then mutate under a `trap`-guarded script and prove byte-exact restoration with
`git diff --quiet`.
**Source:** 13-SECURITY.md

---

### Pre-register predictions in a commit that IS the run's head

Write the expected numbers into a tracked file, commit, and let THAT commit be the one CI measures.

**When to use:** any behavioural observation where the result could be shaped after the fact. The
proving run's `headSha` is `631a2e7`, which is the pre-registration commit, so the prediction was
provably in the tree the run measured. Verified afterwards by showing the file's first 203 lines at
HEAD are byte-identical to the 203 lines `631a2e7` introduced -- pure append, never back-edited.
**Source:** 13-06-SUMMARY.md, 13-EVIDENCE.md, 13-SECURITY.md

---

### Keep the positive control INSIDE the assertion it protects

Put "the thing does happen in the complementary case" in the same `it` as "the thing does not
happen here", against the same mock.

**When to use:** whenever an assertion is an absence (`not.toHaveBeenCalled`, `not.toContain`,
`not.toMatch`). A permanently inert mock or an empty extraction satisfies an absence assertion
trivially. Splitting the control into its own test lets it be deleted while the absence assertion
still passes and still looks meaningful.
**Source:** 13-03-SUMMARY.md, 13-VALIDATION.md

---

### Identify each guarded site by its OWN surrounding token, never by the shared marker

The two record-only survivors are matched by `RUNNER_DEBUG_OBSERVED` and `LEG_OS` respectively,
not by the `RECORDED, never gated` string they share.

**When to use:** when guarding N sites that carry a common literal. Matching the shared literal
lets the sites cover for each other -- deleting one leaves the clause green. Per-token matching
means a sweep that deletes one reddens exactly one case.
**Source:** commit 7968f21, 13-SECURITY.md

---

### Pin a site COUNT exactly, never as a floor

`RECORD_ONLY_SURVIVOR_SITES = 2`, matching the `MASKED_TOKEN_SITES = 8` precedent already in the
file.

**When to use:** whenever the claim is "exactly N of these exist". A floor is satisfied by the
survivors alone, so a third instance can appear in silence -- and in this case a new ungated
`[remote cache]` record is exactly the launderable shape the phase exists to remove. An exact pin
catches both the over-sweep and the under-sweep direction.
**Source:** commit 7968f21

---

### Guard both DIRECTIONS of a scope limit

The three per-leg `not.toContain` clauses catch a leg reverting to record-without-gate (under-
sweep). The survivor clauses catch a sweep deleting a still-true claim (over-sweep).

**When to use:** any time a change converts SOME instances of a pattern and deliberately leaves
others. The un-converted ones need a guard too, or "we deliberately left these" is an unenforced
comment. The audit found exactly this gap.
**Source:** 13-SECURITY.md, commit 7968f21

---

### Append-only evidence files

`13-EVIDENCE.md` uses forward references ("see the OBSERVATION section") so the observation
required no edit above the fold, and the whole file diffs as additions only.

**When to use:** for any record whose credibility depends on not having been revised. "The file
diffs as additions only" is a stronger and more checkable property than "the pre-registration
section is unchanged", and it is verifiable by a prefix comparison.
**Source:** 13-06-SUMMARY.md

---

### Brief every agent with a FILE deliverable, and resume rather than respawn

Both audit agents this phase were told the file IS the deliverable and to write it early and terse,
then refine.

**When to use:** always, on this project. Agents here have repeatedly completed their work and gone
idle without returning text; the file is what survives. When more work is needed from an agent that
has already returned, resume it by id -- the security auditor's second and third passes reused its
full context and it could compare against its own earlier reasoning, which is how it caught its own
false claim.
**Source:** .continue-here.md, session record

---

### Scope a criterion to assertion ARGUMENTS, not to raw file text

Instead of counting `exit 1` occurrences in a spec, assert that no `toMatch` or `toContain`
argument contains `exit 1`.

**When to use:** whenever a mechanical criterion would otherwise be tripped by a comment explaining
the very thing it checks. This converts an unsatisfiable criterion into the property it was
actually proxying for, and it is the standing fix for the four prose-in-a-scanned-file collisions.
**Source:** 13-05-SUMMARY.md, 13-04-SUMMARY.md

---

## Surprises

### Hoisting the knob above the token branch left the ENTIRE suite green

978 of 978 passing, 42 files, with the exact shape T-13-03-E1 registers at HIGH severity already
applied to the source.

**Impact:** the highest-value finding of the audit tail. The exhaustive narrowing table -- the
phase's flagship proof, five enumerated env shapes, deliberately built to prove the knob cannot
widen -- was blind to it, because `outcomeOf` collapses both read-only outcomes into one
`'read-only'` token so `widened()` stays false while the fail-safe branch is bypassed. Closed by
`cbe69ce` with a behavioral clause that reddens alone.
**Source:** 13-VALIDATION.md, commit cbe69ce

---

### The security audit's own dismissal was the defect

Its first pass correctly found the branch-order guard was not standing, then talked itself out of
the finding using the same collapsing lens that made the table blind.

**Impact:** a correct observation followed by a wrong inference is more dangerous than no
observation, because the written dismissal discourages the next reader from looking. The auditor
retracted it in writing rather than silently editing, so the reasoning error is preserved for the
next reader.
**Source:** 13-SECURITY.md (Correction section)

---

### Both "survivors" live in the same job block

The scope limit was written as though `runner.debug` and the `integration` per-OS count were in two
different places. Both are inside `integration:` (`ci.yml` 823 to 1094).

**Impact:** simplified the guard -- one `jobBlock('integration')` scope covers both -- but it also
means the mental model in the plan text was wrong, and a guard written from that model would have
scoped one clause to a block that never contained its subject.
**Source:** commit 7968f21, 13-SECURITY.md

---

### DOCS-09's proposed zero-count command returns NINE legitimate hits

`git grep "RECORDED, never gated" -- .github packages` finds the 2 deliberate `ci.yml` survivors
plus 7 self-references inside the spec that scans for them.

**Impact:** the draft VALIDATION.md carried it as the automation for DOCS-09. Adopted as written it
would have been a permanent false red -- the fifth instance of the prose-in-a-scanned-file trap,
this time in a validation artifact rather than in code.
**Source:** 13-VALIDATION.md

---

### `git grep -c "createActionsCacheBackend:"` is not literally zero

One hit survives at `publish-mirror.spec.ts:26` -- a `vi.mock` object KEY, pre-existing, with
nothing to do with an error-message prefix.

**Impact:** the criterion holds in its intended sense (no non-spec module under `src/` carries the
prefix) but not as literally stated. Caught twice independently: by the executor at 13-02 and again
by the security auditor, which flagged that the register's stated evidence did not match the
observable command.
**Source:** 13-02-SUMMARY.md, 13-SECURITY.md

---

### A1 had two admitted outcomes and reality supplied a third

The plan allowed "quiet, so close it" or "noisy, so record a docs follow-up". Every task on every
read-only leg HIT, so nothing executed, nothing PUT, and no 403 was ever produced.

**Impact:** recorded as OPEN with the reason it is structurally unobservable on a fully-restoring
run, plus the condition that WOULD exercise it. Reporting the clean log as "A1 closed" would have
inferred a property of a path the run never took -- the same shape as reading a MISS as evidence.
The dictated commit subject asserting the closure was amended for the same reason.
**Source:** 13-06-SUMMARY.md

---

### The bundle drifts for ONE reason, not the two the plan named

The plan cited esbuild comment preservation as a non-obvious second cause of drift. Measured, the
JSDoc edit produced no bundle change at all.

**Impact:** the plan's premise was wrong while its instruction was right -- the regenerated bundle
is correct either way. Recorded as a plan-premise correction rather than a code deviation, so a
future executor does not treat a zero-diff bundle after a doc-comment edit as a failed build.
**Source:** 13-03-SUMMARY.md

---

### The `windows-11-arm` needle count in the spec was already stale before the phase touched it

Recorded as `10 stripped / 25 raw` "at HEAD"; measured at `13 / 29`. It drifted in the CR-18
dogfood-widening commits and was never re-measured.

**Impact:** a stale measurement inside a file whose house standard is MEASURED-not-predicted, in
the very comment written to prevent that. Re-measured and both sites updated, with the commits that
moved it named.
**Source:** 13-05-SUMMARY.md

---

### The raw job-log prediction missed by one more per leg

Even after correcting for the instrument drift, the pre-registered raw count was off.

**Impact:** vindicated pre-registering BOTH figures rather than one. The gate-printed count matched
exactly at 1/2/1; the raw count did not, and because both were written down in advance the
discrepancy is a published conversion rather than a silent correction.
**Source:** 13-06-SUMMARY.md, 13-EVIDENCE.md

---

### The phase kept reproducing, in its own guards, the defect it existed to remove

Phase 13 exists because a `count >= 1` gate over a leg that can write is launderable -- a guard
that reads as coverage without being it. That same shape appeared repeatedly in the guards written
to BUILD that gate: four criteria satisfied by prose rather than by the property, one clause that
stayed green when the row it tested was deleted, and two declared-but-absent mechanical controls
found only by the audits.

**Impact:** every instance was caught by mutation measurement, never by reading. The habit
generalises past this phase: mutate, then believe.
**Source:** .continue-here.md, 13-SECURITY.md, 13-VALIDATION.md
