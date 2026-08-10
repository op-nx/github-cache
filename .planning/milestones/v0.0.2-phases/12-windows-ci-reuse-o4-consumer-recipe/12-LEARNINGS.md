---
phase: 12
phase_name: 'windows-ci-reuse-o4-consumer-recipe'
project: 'github-cache'
generated: '2026-07-31'
counts:
  decisions: 8
  lessons: 9
  patterns: 8
  surprises: 8
missing_artifacts: []
---

# Phase 12 Learnings: windows-ci-reuse-o4-consumer-recipe

## Decisions

### Three explicit describes per Windows leg, never `describe.each`

The three `ci.yml` Windows-leg guards are three literal describes with seven independently-named
`it`s each, rather than one parameterised loop.

**Rationale:** each leg fails independently, because a copy-paste that leaves the wrong
`npm run` line is a different regression from a lost `needs:` edge. The literal names are also
what let `-t` select each leg, which is what made three SEPARATE REDs observable instead of one
undifferentiated failure. A loop would have collapsed all three into a single reported cause.
**Source:** 12-01-PLAN.md key-decisions, 12-01-SUMMARY.md

### An exact occurrence count, never a `>= 1` floor

Every count-based clause in this phase asserts an exact number behind a named constant, with the
re-measure instruction comment-locked beside it.

**Rationale:** a `>= 1` floor is exactly as half-locking as the `toContain` it replaces -- it is
satisfied by the first occurrence, so deleting the second leaves the guard green. In
`docs/cross-os.md` the half a floor would have dropped is the verification fence, which is the
only control an adopter has against a discriminator that silently collapses to one value. This
was not an argument: mutation M4 altered one character at the fence site only, and the floor
accepted it while the exact count rejected it.
**Source:** 12-05-SUMMARY.md deviation 2, mutation M4

### `--no-warnings` as a node flag, not a shell redirect

The stderr channel on the `integration` runtime discriminator is closed with `--no-warnings`
rather than `2>/dev/null` or `2>nul`.

**Rationale:** Nx's `hash_runtime` runs the string through exactly ONE shell per OS, so any
redirect syntax is correct on one platform and broken on the other. A node flag is the only form
that is invariant across both shells. Nx hashes `trim(stdout) + trim(stderr)` together, so the
channel has to be closed rather than merely ignored.
**Source:** 12-04-SUMMARY.md decisions, 12-04-PLAN.md T-12-09

### Supersede a written invariant in place; never delete it

`08-ROOT-CAUSE.md`'s byte-identical constraint was superseded with a note attached to the
constraint itself. The commit is 55 insertions and zero deletions.

**Rationale:** silently violating a written invariant leaves a future reader holding a documented
argument for reverting the change -- the failure mode S-1 exists to prevent, and the one that
produced a shipped regression in Phase 9. The same discipline drove plan 12-02's landing of the
three legs in the SAME commit as the four claims their existence falsifies: the instant the legs
exist, a comment asserting Linux-only production is a documented argument for undoing the work.
**Source:** 12-04-SUMMARY.md Task 3, 12-02-SUMMARY.md

### The supersession note must NOT reproduce the retired literal

The note records the change as inserting `--no-warnings` immediately after `node`, and says why
it declines to quote the old string.

**Rationale:** a mechanical completeness sweep cannot distinguish a historical citation from a
live spelling site. Quoting the retired literal would have left the old spelling permanently
present in the tree, so the D-15 sweep could never return a clean no-match again. The prior value
stays exactly recoverable from the pins by deleting one flag, so nothing is lost. In-repo
precedent: `docs-same-os-claims.spec.ts` writes its forbidden phrases with a single-character
character class for the same reason.
**Source:** 12-04-SUMMARY.md deviation 2

### `PENDING` is a legitimate TERMINAL outcome, not a stub

Plan 12-06 discharged the O4 slot with the claim, the pre-registered counts, the five
anti-requirements and the forced write decision, then recorded the verdict as PENDING.

**Rationale:** no proving run existed, and opening the pull request is a carried OPERATOR
decision the plan was forbidden to take. A verdict written from inference is the single worst
outcome available in that plan and is what T-12-20 exists to prevent, because XOS-04 permanently
destroys the producer attribution a later session would need to re-derive it.
**Source:** 12-06-PLAN.md, 12-06-SUMMARY.md Known Stubs

### Pre-registration lands in its own commit, before the observation attempt

Two commits rather than one: `f5d03b0` carries the counts and no observation, `29484b3` carries
the attempt and adds no count.

**Rationale:** `git log` then evidences on its own that the counts were fixed before anything was
read. A single squashed commit could not show that ordering, and the ordering is the whole
anti-repudiation control.
**Source:** 12-06-SUMMARY.md Task Commits

### WR-09: narrow the guard's claim rather than widen `publish`'s `needs:`

Faced with three new producers absent from `publish`'s `needs:` list, Option B was chosen and
`ci.yml` was left unmodified.

**Rationale:** measured first, not reasoned about. At seven members prettier reformats `needs:`
into a multi-line flow sequence, stranding all four existing clauses anchored on
`^ {4}needs:.*\b<name>\b` -- measured at 4 failed / 895 passed. Substantively, the three legs are
non-producers BY DESIGN: they carry no platform discriminator, so each computes the same hash as
its ubuntu producer and HITs. The accepted cost (the title rename rots six coverage refs in two
Phase 10 summaries) is written into the block, along with the reversal of the earlier trade.
**Source:** 12-REVIEW-FIX.md WR-09

---

## Lessons

### A guard can be green while the artifact it guards is wrong

`docs/cross-os.md`'s section-ORDER guard was correct, non-vacuous and green, while section 1's
only copy-pasteable snippet declared the discriminator on exactly one target -- this repo's
earned exception, i.e. the opposite of its own heading.

**Context:** order is a structural property; the defect was in the payload. Code review caught it
(CR-01); the threat model did not, the same shape as Phase 11's T-11-27. The fix is mechanized
rather than prose: `RENDERED_DISCRIMINATOR_SITES` is pinned at exactly 4, and the constant's
comment records that a count of 2 specifically means the snippet collapsed back to one target, so
the number carries its own diagnosis.
**Source:** 12-REVIEW.md CR-01, 12-REVIEW-FIX.md, 12-SECURITY.md

### `rg -o | wc -l` counts OUTPUT LINES, so a multi-line match inflates it

The D-13 regex first reported 2 occurrences; `String.match(...g)` in node reported 1, and
printing the match showed ONE hit spanning a hard wrap.

**Context:** `rg -o | wc -l` is the right counter for a single-line phrase and the wrong one for
a multi-line pattern. For those, count matches in the language, not lines in the output. This is
adjacent to the standing trap that `rg -c` counts LINES rather than occurrences.
**Source:** 12-05-SUMMARY.md Task 3 Check A

### `rg -c` never prints `0`, so a `| rg -q '^0$'` chain is unsatisfiable

Plan 12-06's own `<automated>` verify command ends with
`rg -c -F "<needle>" <file> | rg -q '^0$'`. `rg -c` emits nothing and exits 1 on zero matches, so
that clause fails precisely when the criterion is SATISFIED.

**Context:** recorded rather than silently worked around. The three components were run
separately and their exit codes read individually. A correct form is
`! rg -q -F "<needle>" <file>`.
**Source:** 12-06-SUMMARY.md deviation 5

### ripgrep skips dot-directories during traversal and still exits 0

A documented flagless sweep found 7 sites; the corrected
`--hidden --glob '!.git'` form found 9. The delta was exactly the two `.github/workflows/ci.yml`
sites.

**Context:** `.github` and `.planning` are both dot-directories, so a bare traversal silently
drops real sites with exit code 0 in both cases -- nothing signals the omission. A completeness
sweep is only trustworthy with a positive control run in the identical command shape; the old
literal's zero was trusted only because the new literal returned 9 from the same invocation.
**Source:** 12-04-SUMMARY.md, 12-05-SUMMARY.md D-15 sweep

### Nx FILTERS the printed target list, so the short success needle is vacuous

A two-of-three run exits 0 and prints `Successfully ran targets build, test` -- `typecheck` is
filtered out of the printed list rather than named as missing.

**Context:** measured, not assumed (Measurement B). Three facts together are the red observation:
the run exits 0, the plural needle is ABSENT, and the naive short needle is PRESENT. A guard
using the obvious prefix would have passed a partial run. This is `formatting-utils.js:37`
behaving exactly as source-traced.
**Source:** 12-03-SUMMARY.md Measurement B

### An unguarded count in a comment rots silently, and three findings were the same defect

WR-07, IN-01 and IN-06 were one defect wearing three hats.

**Context:** the split that resolved them is worth carrying: where the count is load-bearing,
state it with the artifact it was measured against plus a re-measure instruction; where it is
decorative, DROP it in favour of a claim that cannot rot. IN-01's "nineteen jobs" was wrong on
the day it was authored (18) and wrong again three jobs later (21), so the argument never
depended on it. WR-07's "19 times" was measured against the raw file while the guard reads a
comment-stripped one -- two independent ways to be wrong about the same number.
**Source:** 12-REVIEW-FIX.md cross-cutting notes

### GSD state handlers corrupt tracking files on every single plan

Three handlers misfired on all six plans: `roadmap.update-plan-progress` injected a duplicate
bare plan list (6 entries becoming 12) and mangled the progress-table cell;
`state.add-decision` wrote `[Phase ?]` markers and joined summary to rationale with a non-ASCII
em dash; `state.record-metric` rejects the positional form the executor spec prescribes.

**Context:** all were caught and repaired before each commit, but the repair tax was paid six
times. Two workarounds are worth keeping: passing ONLY `--summary` to `state.add-decision` avoids
the em-dash join entirely, because U+2014 is inserted as the summary/rationale separator; and
`state.record-metric` needs named flags or it silently records nothing.
**Source:** all six SUMMARY files, deviations sections

### `requirements.mark-complete` must not run on a TDD RED plan

On 12-01 the handler flipped XOS-04/05/08 to `[x]` and moved a traceability row to Complete on a
plan that landed only failing guards.

**Context:** all three were false. It would have fed a false Complete into the milestone audit's
three-source cross-reference while nothing was implemented. It also left the file internally
inconsistent, rewriting only the XOS-04 row because the other two carry parenthetical text after
`Pending` that its matcher did not recognise. Skipped deliberately for 12-02 through 12-06;
traceability closes ONCE, at the orchestrator's `phase.complete` step.
**Source:** 12-01-SUMMARY.md deviation 4

### A mechanical acceptance proxy can measure the wrong thing in both directions

Three separate acceptance criteria in this phase were unsatisfiable or misleading as written.

**Context:** the `toMatch(/^` count criterion could not see anchored regexes that prettier had
split across lines (+3 measured, +30 real); the `rg -c "^  [a-z]"` one-job criterion also matches
`schedule:`, `workflow_dispatch:` and `contents: read`, measuring 4 for a correct file; and the
five-item checklist one-liner counted the section's own numbered heading, returning 6 and being
unsatisfiable for ANY five-item list under a numbered heading. In all three the INTENT held and
the code was correct. Verify the proxy before chasing the number.
**Source:** 12-01-SUMMARY.md deviations 1-2, 12-03-SUMMARY.md deviation 1, 12-05-SUMMARY.md deviation 1

---

## Patterns

### `existsSync`-guarded read yielding an empty string

The detector and doc guards read their subject through an `existsSync` guard that yields `''`
rather than letting `readFileSync` throw.

**When to use:** any guard authored RED against a file that does not exist yet. It converts a
module-load ENOENT -- which takes the file's other clauses down with it and reports nothing about
what is missing -- into a NAMED existence assertion that reads `expected false to be true` and
names the missing path.
**Source:** 12-01-SUMMARY.md, 12-05-SUMMARY.md

### Positive control asserted FIRST, before any absence or ordering clause

Every absence clause in this phase is preceded by a control proving the extraction is real.

**When to use:** always, and especially for ordering. Two empty arrays are trivially equal in
length AND trivially pairwise-ordered, so an ordering assertion with no control is satisfied by a
file that contains none of the thing being ordered. The `::add-mask::` guard added during the
validation audit needs BOTH controls for exactly this reason.
**Source:** 12-01-SUMMARY.md patterns-established, dogfood-cross-os.spec.ts:977-1018

### Two-sided needle proof

A positive control that the needle matches the real green line, PLUS an observed red where the
guarded command exits 0 and the needle still fails.

**When to use:** whenever a CI gate is a text match rather than an exit code. The second half is
what distinguishes a needle that works from one that merely happens to match today.
**Source:** 12-03-SUMMARY.md Measurements A and B

### Single-sourced doc equality

`docs-cross-os.spec.ts` reads the discriminator out of `nx.json` and never re-spells it in the
spec; the failure message interpolates the config value.

**When to use:** any doc that must render a configured literal byte-identically. It makes the
config authoritative by construction, so the doc cannot drift without a named failure, and the
spec cannot itself become a third spelling site.
**Source:** 12-05-SUMMARY.md, docs-cross-os.spec.ts

### Claim correction as three components

Every corrected claim carries: (a) what it STILL guards, (b) what it NO LONGER establishes, and
(c) where the superseded record is frozen.

**When to use:** whenever new work falsifies a shipped comment. Applied identically to a YAML
comment, a JSDoc block and a runtime failure-message string. The third site matters most --
`capture-hashes.mjs` carried the attribution claim in a docblock AND in the message an operator
reads at the moment the assertion fires, and correcting only the comment leaves the false claim
in the louder of the two.
**Source:** 12-02-SUMMARY.md

### Prove the COMMAND when the job cannot be proven

`workflow_dispatch` only fires for workflow files present on the DEFAULT branch, so a new
detector cannot be dispatched pre-merge at all.

**When to use:** any new workflow file. Close the substantive half locally (does this command
pass on this OS with the cache bypassed?) and leave green-on-a-real-runner as an explicit
POST-MERGE first-run close -- the pattern this repo already uses by name for `ppe`, `dogfood-*`
and `consumer-smoke`. Write the disclaimer into the workflow's own comment so no later reader
cites `workflow_dispatch` as evidence it was verified before merge.
**Source:** 12-03-SUMMARY.md

### Register the Nx `test` input in the SAME COMMIT as the guard

Both `windows-regression-detector.yml` and `docs/cross-os.md` were registered in the identical
commit as the spec that reads them, with an explicit path and never a glob.

**When to use:** any spec asserting on a file outside `{projectRoot}`. It removes the stale-pass
window entirely rather than leaving an ordering instruction for someone to remember. Registering
an input for a file that does not exist yet is safe -- an Nx fileset tolerates an absent path.
An explicit path beats a glob because a glob silently adopts whatever workflow lands next.
**Source:** 12-01-SUMMARY.md, 12-05-SUMMARY.md, PARITY-08

### Measure every pinned phrase against the written file before committing the assertion

Plan 12-05 built a phrase-count table for all seven pinned phrases before finalising the guard.

**When to use:** before committing any phrase-keyed guard. It is what surfaced the discriminator
rendering TWICE, which is what turned a `>= 1` floor into an exact `toBe(2)`. No row may have a
count of 0, or the clause is a silent false pass in the additive direction.
**Source:** 12-05-SUMMARY.md Task 3 Check A

---

## Surprises

### The `>= 1` floor the plan specified was measurably half-locking

The plan's `<behavior>` block specified `toBeGreaterThanOrEqual(1)` for the discriminator count.
Measured, the command renders twice.

**Impact:** converting it to an exact `toBe(2)` was not tidying. Mutation M4 altered one
character at the verification-fence site only; under the floor that mutation returns 1, satisfies
the assertion, and the guard stays GREEN with the doc telling an adopter to run a command node
rejects. A plan-specified assertion shape was wrong, and only measurement caught it.
**Source:** 12-05-SUMMARY.md deviation 2, mutation M4

### The `::add-mask::` ordering had 8 sites and 0 guards, and this phase tripled it

The retroactive validation audit found the only `add-mask` assertion in the spec tree pins a
DOCUMENTED snippet, not `ci.yml`.

**Impact:** Phase 11 logged this at 5 sites as pre-existing; copying the sidecar block onto three
Windows legs took it to 8, so it is no longer inherited. This phase's own `cacheClient` clause
pins the two `$GITHUB_ENV` write lines but not the mask that must precede them, so deleting a
mask left all 24 new Windows-leg clauses green while a bearer token reached `$GITHUB_ENV`
unredacted on a public repo. Closed by a whole-file pairwise guard that also covers the five
sites no phase owns.
**Source:** 12-SECURITY.md Residual 1, 12-VALIDATION.md, commit e73f49c

### Two independent audits converged on the same residual from opposite directions

The security audit named the unguarded mask ordering as its Residual 1; the Nyquist audit,
running afterwards with no instruction to look for it, independently classified it as the phase's
one real coverage gap and filled it.

**Impact:** the handoff worked without being designed. It is also evidence for why the two gates
stay separate agents rather than one pass -- the security lens found the exposure, the coverage
lens found that nothing would catch it.
**Source:** 12-SECURITY.md, 12-VALIDATION.md, this phase's post-completion sequence

### Assumption A1 was closed by a measurement that contradicts two committed artifacts

`12-VERIFICATION.md:20` and `12-SECURITY.md` both record A1 as OPEN. The validation audit
downloaded both hash-parity artifacts from the proving run and found the POST-hardening command
with `stderr` length 0 and status 0 on both legs.

**Impact:** both artifacts were correct for the tree they audited -- the earlier reading was
taken from run 30500255530, which predates the hardening. Confirmed independently here:
`3d9f895` is an ancestor of `e757d4c`, so the proving run genuinely exercised the hardened
literal. The artifacts are left as authored rather than back-edited; the supersession is recorded
in `12-VALIDATION.md`. The lesson is that "OPEN" in an audit is a statement about a tree, not a
permanent property.
**Source:** 12-VALIDATION.md, 12-06-SUMMARY.md measurement D

### The tree moved under plan 12-04's feet mid-phase

The plan budgeted five remaining discriminator spelling sites. Plan 12-02 had added a second
`ci.yml` occurrence in its XOS-08 wiring block.

**Impact:** aligning only the plan's five would have left the tree spelling two different strings,
which is exactly what D-15 forbids. Six sites this task, nine in the tree. An intra-phase plan
can invalidate a later plan's site inventory, so the sweep has to be re-run before editing rather
than trusted from the plan text.
**Source:** 12-04-SUMMARY.md deviation 1

### The supersession note defeated its own completeness sweep

The first draft quoted the retired literal verbatim while recording what changed -- honest, and
it left the old spelling permanently in the tree so the sweep could never return a clean
no-match again.

**Impact:** caught by running the sweep immediately after the note landed rather than at the end.
Nothing was wrong with the record; the problem is that a mechanical sweep cannot distinguish a
historical citation from a live spelling site.
**Source:** 12-04-SUMMARY.md deviation 2

### The literal `runs-on: windows-11-arm` before-count was 0, not 3

`integration`, `hash-parity` and `publish` resolve the label through `runs-on: ${{ matrix.os }}`,
so the three new legs are the FIRST literal occurrences in the file.

**Impact:** the bare token `windows-11-arm` occurs 19 times before and 22 after, so no file-wide
clause about the bare token can discriminate. Every guard must anchor on the full `runs-on: `
prefix. A file-wide clause would have passed unconditionally.
**Source:** 12-02-SUMMARY.md measured counts

### A code review's own figure did not survive re-measurement

WR-01's issue narrative cited a "25-entry" explicit `test` input list. Re-measured at HEAD:
28.

**Impact:** handled by dropping the count from the doc entirely rather than correcting 25 to 28 --
planting a fresh unguarded count is the same defect class WR-07, IN-01 and IN-06 exist to close.
Every number in the 16-finding fix sweep was re-measured against the finished tree rather than
taken from the review's text, which is the only reason this was caught.
**Source:** 12-REVIEW-FIX.md WR-01, cross-cutting notes
