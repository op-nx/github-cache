---
phase: 09
phase_name: "os-invariant-actions-cache-version"
project: "@op-nx/github-cache - GitHub-backed Nx Remote Cache"
generated: "2026-07-29"
counts:
  decisions: 6
  lessons: 9
  patterns: 6
  surprises: 6
missing_artifacts:
  - "09-UAT.md (never created: verification passed without a blocking human_needed item)"
---

# Phase 09 Learnings: os-invariant-actions-cache-version

## Decisions

### One commit for all five VER requirements, as a hard constraint

Plan 09-03 landed VER-01, VER-03, VER-04, VER-07 and the CORR-05 site removal in a SINGLE
commit (`47597a6`, nine paths), with Task 1 expected RED and no commit until Task 3.

**Rationale:** VER-01 and VER-03 EACH change `getCacheVersion`'s input. Split, they give the
milestone FOUR all-MISS rotation windows where D-30 allows three and plan 09-02's
already-committed record says "expected once". Worse, a VER-03-only commit rotates only WINDOWS
entries (`cacheUtils.js:166` pushes `windows-only` only when `!enableCrossOsArchive`), producing
an ASYMMETRIC signal that reads as a Windows breakage rather than a rotation. The split would not
merely add a window; it would add a MISLEADING one.
**Source:** 09-03-PLAN.md, 09-03-SUMMARY.md

### Record the rotation prediction in git BEFORE the commit that causes it

Plan 09-02 committed `09-ROTATION-SIGNAL.md` at `e7018d0`, provably before `47597a6`.

**Rationale:** OBS-04's signal exists on exactly ONE run and cannot be re-sampled. A prediction
written afterwards is indistinguishable from a rationalisation, so "recorded IN ADVANCE" had to
be a claim about git history, which is the only proof that survives. This is what made D-29 a
control rather than paperwork -- and it paid off precisely because the prediction turned out
PARTLY WRONG (see Surprises). Written after the fact it would have been silently reshaped.
**Source:** 09-02-PLAN.md, 09-02-SUMMARY.md, 09-ROTATION-SIGNAL.md

### Register `ci.yml` as a `test` input FIRST, before any spec asserts on it

PARITY-08 (`nx.json:69`) was plan 09-01, the first plan in the phase, not a tidy-up at the end.

**Rationale:** Two later plans assert on `ci.yml` content. Until `ci.yml` is a `test` fileset
input, every one of those assertions serves a stale cached PASS -- the same false-pass class this
repo had already shipped twice (`governance-email.spec.ts`, and `typecheck`'s spec-excluding
inputs). Ordering was the mitigation.
**Source:** 09-01-PLAN.md

### The dogfood verify leg asserts PROVENANCE, not presence

`dogfoodBody(hash, producerOs)` folds a required producer stamp into the payload BYTES, and the
Windows verify leg asserts the bytes are `'linux'`-produced.

**Rationale:** The seed key is one per RUN, not per OS. A presence-only check on the Windows leg
would go green the moment anyone added a Windows seed leg, even with cross-OS restore completely
dead. Provenance is the only assertion that cannot pass vacuously. `producerOs` is REQUIRED with
no default so the two legs' arguments cannot be unified by accident.
**Source:** 09-05-PLAN.md, 09-05-SUMMARY.md

### Correcting a same-OS claim requires SUPPLYING A REPLACEMENT REASON

Plan 09-06 corrected two `ci.yml` comments that justified the two-leg `capture-hashes` matrix,
and gave each a new justification rather than deleting the old one.

**Rationale:** Two of the four DOCS-08 sites were the argument the "keep BOTH legs" instruction
rests on. Correcting the text without a replacement reason would leave a future reader holding a
documented argument for COLLAPSING the matrix -- silently destroying the cross-OS proof plan
09-05 had built one wave earlier. The new reason is a different axis: keeping both legs is now
justified by the Nx HASH, not the store.
**Source:** 09-06-PLAN.md, 09-06-SUMMARY.md

### Gap-close `read-back.ts` in Phase 9, overriding two recorded Phase 10 deferrals

Both `09-CONTEXT.md:794` and DOCS-08's own text deferred `read-back.ts`'s same-OS claims to
Phase 10. Plan 09-08 overrode both.

**Rationale:** The deferrals were made BEFORE anyone had seen the job fail. Once
`publish-verify (windows-11-arm)` was MEASURED red on run `30400231720`, the maintainer reversed
the deferral rather than hand Phase 10 a knowingly-red guard on every `main` push. This is a
deferral revised on EVIDENCE, not a plan defect -- and it is recorded as an explicit override in
the code comment lock and in 09-08-SUMMARY.md, because an override discovered by diffing is
indistinguishable from drift.
**Source:** 09-08-PLAN.md, 09-08-SUMMARY.md, 09-VERIFICATION.md

---

## Lessons

### A same-OS invariant sweep must include EXECUTABLE code, not only prose

DOCS-08 enumerated four DOCUMENTATION sites. The regression that reached CI came from a fifth
site in `roundtrip/read-back.ts`, where the same-OS premise sat in a `//` comment directly above
the comparison it justified. The security audit later found a SIXTH in a `ci.yml` capacity
comment that nobody had recorded at all.

**Context:** Final tally: 4 docs (09-06) + `read-back.ts` (09-08) + `ci.yml` shard-growth
(security audit) corrected; 2 deliberately deferred with named owners. A documentation-scoped
grep could not see any of the last three.
**Source:** 09-VERIFICATION.md, 09-SECURITY.md, 09-08-SUMMARY.md

### `git grep` returns a FALSE ZERO on untracked and gitignored paths, and it reads as confirmation

Plan 09-04 checked an "absence" acceptance criterion with `git grep` while the subject file was
still untracked, got zero matches, and nearly banked it as proof.

**Context:** The failure mode is that zero-matches looks identical to verified-absent. It
recurred as a category three times this phase. Rule adopted: any "no occurrence of X" criterion
uses `rg`, or confirms the path is tracked first.
**Source:** 09-04-SUMMARY.md, 09-05-SUMMARY.md

### `git grep -c` counts LINES, not occurrences -- so a `-c`-based criterion can be wrong on that alone

09-05's criterion expected `git grep -c "dogfoodBody"` to return 2; it returned 4. The substance
held via `git grep -n` (exactly two calls). 09-06 hit the same trap on `"differen"`.

**Context:** 09-06 resolved it the right way: rather than reinterpret the criterion, it reworded
the code so the command genuinely returns no match, making the readable check and the enforcing
check agree. 09-08 did the same for two more criteria.
**Source:** 09-05-SUMMARY.md, 09-06-SUMMARY.md, 09-08-SUMMARY.md

### `npm run typecheck` catches what a fully green test suite cannot

09-06 hit a real `TS2339` (an `as const` dropping `forbidden` from a union) while all 663 tests
passed. Vitest transpiles without type-checking.

**Context:** Corollary found later: after editing only spec files, `npm run typecheck` and
`npm run lint` returned `Cache: 2/2 hit` and did NOT re-run -- a stale PASS of exactly the class
PARITY-08 exists to prevent. Post-edit verification of specs must use `--skip-nx-cache`.
**Source:** 09-06-SUMMARY.md, this phase's post-audit battery runs

### An import-level RED proves far less than an assertion-level RED

09-04 volunteered that its RED was a whole-suite IMPORT failure, so none of its eight new
assertions was ever evaluated. It proved the spec was wired to a real subject, nothing more.

**Context:** The mutations, not the RED, are what prove assertions can fail. Every later plan was
asked to state which kind of RED it achieved; 09-05, 09-06 and 09-08 all achieved
assertion-level and said so explicitly.
**Source:** 09-04-SUMMARY.md, 09-05-SUMMARY.md, 09-08-SUMMARY.md

### A guard can be pinned at a CI sampling rate of ZERO and still look covered

`action/index.ts`'s `expectedProducerOs = 'linux'` was "guarded" by a hand-authored literal in
`action/index.spec.ts`. On ubuntu -- the only OS the `test` job runs -- `cachePlatform()` IS
`'linux'`, so the correct and substituted forms are indistinguishable there. Substituting it
reddened only the push-gated Windows leg.

**Context:** Proof the guard was worthless: replacing the literal with `cachePlatform()` reddened
the audit's two NEW cases while EVERY pre-existing test in the file stayed green, including the
one holding the pinned literal. 09-05 had already found one vacuous literal in this same file.
**Source:** 09-VALIDATION.md (gap G2), 09-05-SUMMARY.md

### A negated matcher inside `toHaveBeenCalledWith` is a vacuous absence guard

`expect(core.warning).toHaveBeenCalledWith(expect.not.stringMatching(/differen[t] OS/))` asserts
"SOME call lacks the phrase", not "NO call carries it", because the matcher passes when any one
call matches.

**Context:** Mutation proof: reintroducing the retracted "different OS" text AND adding a second
warning left ALL 675 tests passing. It was non-vacuous only by accident, because that path
happened to emit exactly one warning -- a property of the fixture, not of the claim. Fix: pin the
count AND assert absence across every recorded argument. Negate the QUANTIFIER, not the
PREDICATE.
**Source:** 09-VALIDATION.md (gap G3)

### The OS partition was never a security boundary

The security audit swept every site that infers from a restore outcome or a producer identity and
concluded no trust or isolation control depended on the OS partition.

**Context:** The Actions-cache read/write boundary is GitHub's per-ref scope plus this repo's own
write gate (`selectBackend` / `isTrustedSyncEvent`), and both are OS-blind. Two runners in the
same scope were ALREADY mutually trusted. The phase did not widen who can write -- only which of
an already-trusted writer's bytes a reader will accept. That reframing is what made 09-08's
relaxation assessable as bounded rather than alarming.
**Source:** 09-SECURITY.md section 1

### A one-commit constraint has a real, measurable cost

A provider spend-limit terminated the 09-04 executor mid-plan. Because 09-04 used a normal
RED -> GREEN split, its RED commit was already durable and the interruption cost only the
in-flight leaf; the agent resumed from its own transcript with no work lost.

**Context:** Had the same interruption hit 09-03 -- one-commit constraint, nothing committed until
Task 3 -- it would have discarded roughly forty minutes with nothing recoverable. The constraint
was still correct for 09-03 (four rotation windows is worse), but it is not free, and that cost
should be weighed rather than assumed away.
**Source:** 09-04-SUMMARY.md, 09-03-PLAN.md

---

## Patterns

### Pre-register a prediction in git before the event it predicts

Commit the expected observation, with its attribution logic and its explicit non-triggers, in a
commit provably earlier than the change that causes the event.

**When to use:** Any one-shot, non-re-samplable observation. The value is not that the prediction
is right -- this one was partly wrong -- but that the MISMATCH is legible as a mismatch instead of
being absorbed into a post-hoc story. Include a "this does NOT satisfy the prediction" section so
a null result cannot be read as a pass.
**Source:** 09-02-PLAN.md, 09-ROTATION-SIGNAL.md, 09-EVIDENCE.md ADDENDUM

### Mutation-test the guard, in both directions, and predict which case reddens

Apply a targeted mutation, OBSERVE the redness first-hand, name which assertions went red and
which stayed green, then revert. State the expected redness in advance.

**When to use:** Whenever a guard's value is being claimed. 09-04's four mutations each reddened
exactly one named case; 09-08's four matched prediction exactly, four for four. The technique also
DISPROVED two guards (G2, G3) that looked fine -- it is the only instrument that reliably
separates a guard that bites from one that merely exists.
**Source:** 09-04-SUMMARY.md, 09-08-SUMMARY.md, 09-VALIDATION.md

### Assert over the whole value set, never over "the value this machine is not"

`read-back.spec.ts` and the G2 fix assert acceptance for every member of `CACHE_OS_VALUES`,
deriving reader OSes from the real single-sourced tuple.

**When to use:** Any spec about a platform- or environment-dependent property. It makes the spec
machine-independent (so it bites at every-commit rate rather than only on one runner) and it
sidesteps LINT-02's ban on `process.platform` reads in spec files. "The OS that is not this one"
is the form that both bans and vacuity punish.
**Source:** 09-08-PLAN.md, 09-VALIDATION.md (gap G2)

### When two guards make contradictory assumptions, comment-lock the asymmetry in BOTH directions

`dogfood-verify` asserts the literal `'linux'`; `read-back.ts` accepts any known producer. Both
are correct: the former's producer is fixed by construction (single-leg ubuntu seed, pinned by a
no-matrix drift guard), the latter's is genuinely variable.

**When to use:** Any time a reader could "tidy" two similar guards into agreement. Name the other
guard, state why it legitimately differs, and point at it by a stable identifier (a JOB NAME, not
a line number) so the lock survives edits.
**Source:** 09-08-PLAN.md, 09-08-SUMMARY.md

### Verify a bundle/artifact check only where the build environment is authentic

`npm run check:action` reported 689 changed lines from a worktree with a junctioned
`node_modules` and 0 from the main tree, with no source edit in either case.

**When to use:** Any generated-artifact drift check. esbuild bakes the path by which it reached a
dependency into path comments and `__commonJS` keys, so a junction rewrites the artifact. Defer
such checks to an authentic tree, or `npm ci` real dependencies. Note this is the INVERSE of the
documented "edit drifts the bundle" rule and the symptom is identical, which is what makes it
dangerous.
**Source:** 09-01-SUMMARY.md, 09-02-SUMMARY.md, and the phase's post-merge gates

### Take the perishable measurement before the change that destroys it

Plan 09-07 captured a `gh api` snapshot of 106 shard assets and 164 Actions-cache entries
immediately before the temporary `main` push.

**When to use:** When a phase's own change closes an observation window. Here, once the version
became OS-invariant the ubuntu publish leg began mirroring the Windows `integration` entry too, so
"everything in this shard is ubuntu's" stopped being true. Phase 11's TEST-08 depends on that
record, and one `gh api` pass was the only moment it could be taken.
**Source:** 09-07-PLAN.md, 09-07-SUMMARY.md, 09-EVIDENCE.md

---

## Surprises

### The rotation prediction was confirmed in MECHANISM and wrong in FORM

Measured `publish` tables: ubuntu `scanned 47 / mirrored 6 / skipped 41 / restore-MISS 41`;
windows `scanned 48 / mirrored 7 / skipped 41 / restore-MISS 41`; no warning on either leg. The
prediction required `mirrored == 0` and `restore-MISS == scanned`.

**Impact:** The SYMMETRIC 41 == 41 is exactly the record's own fingerprint for a VER-01
PATH-caused rotation (a Windows-only asymmetry would have meant the flag landed without the
path), so the mechanism and attribution are confirmed. The all-or-nothing FORM failed, because
`publish` runs late and enumerates a cache list that already contains the same run's fresh
new-version entries. The observable should have been the restore-MISS COUNT and its symmetry
across legs, never the equality `restore-MISS == scanned`. The window is spent; a later real
merge will show all-HIT, so the record must be compared against run `30400231720` and nothing
else.
**Source:** 09-EVIDENCE.md ADDENDUM, 09-ROTATION-SIGNAL.md

### Making cross-OS restore work BROKE a guard that assumed it could not happen

`publish-verify (windows-11-arm)` went red: the Windows publish leg restored the shared
run-scoped dogfood key, received the LINUX payload, and mirrored those bytes under the WINDOWS
asset name, while `read-back.ts` still demanded own-OS bytes.

**Impact:** The phase's success was the regression's cause. Sharpest detail: on the SAME run, for
the SAME key, `dogfood-verify (windows)` PASSED by asserting the bytes are `'linux'`-produced
while `publish-verify (windows)` FAILED by asserting they are windows-produced. Two guards,
contradictory premises, only one updated. It was only findable live -- `publish-verify` is
push-gated to `main`, so no PR run would ever have shown it.
**Source:** 09-EVIDENCE.md ADDENDUM, 09-VERIFICATION.md

### A `toStrictEqual` rationale inherited from the plan was measured FALSE

The claim "`toEqual` treats a trailing `undefined` as absent, so it would accept a shorter array
whose missing tail is the flag" does not hold on vitest 4.1.10: both matchers return identical
verdicts on all eight argument shapes, because `toEqual` uses `hasDefinedKey` and compares the
COUNT of defined keys.

**Impact:** The executor measured it rather than shipping it, and the lock now names the
plausible-but-wrong assumption so nobody re-derives it. The actually load-bearing choice is
asserting the WHOLE array rather than indexing single positions.
**Source:** 09-03-SUMMARY.md

### The bundle diff was 458 lines and 426 of them were a variable rename

Adding `import { resolve } from 'node:path'` claimed the base name in the bundle's flat CJS
scope, so esbuild renamed vendored undici's `resolve2` to `resolve3` throughout.

**Impact:** Only 32 added / 6 removed lines were the two modules' real changes. Zero `__commonJS`
registrations changed, proving no new module entered the graph. A reviewer who assumed a 458-line
bundle diff meant 458 lines of risk would have been badly misled -- the diff needed explaining,
not waving through.
**Source:** 09-03-SUMMARY.md

### The plans themselves contained checkable falsehoods, and executors caught four of them

09-01's plan misattributed the "no `project.json`" assertion to Phase 7's D-02 (it is D-01);
09-05 found the "pinned in two files" premise false (one literal gated NOTHING) and a
`git grep -c` criterion off by construction; 09-07 found a handed-down line number stale
(`dogfoodBody` has TWO call sites, `:286` and `:329`, not one at `:265`) and `REQUIREMENTS.md:338`
wrong about `action-bundle-drift` running "only on push".

**Impact:** All were caught because executors were asked to VERIFY handed-down facts against the
tree rather than copy them. One of the stale facts was propagated by the orchestrator itself,
which is the argument for the instruction: the reviewer's confidence is not evidence.
**Source:** 09-01-SUMMARY.md, 09-05-SUMMARY.md, 09-07-SUMMARY.md

### `phase.complete` closed only 9 of 11 requirements, twice over

ROADMAP's `**Requirements**:` line WRAPS after `ROBUST-04,`, and the parser stops at the newline,
silently dropping `OBS-04` and `DOCS-08`. The same truncation appeared in `init.execute-phase`,
`init.plan-phase`, and finally in `phase.complete`'s traceability update.

**Impact:** Left uncorrected, `/gsd:audit-milestone`'s three-source cross-reference would have
credited the phase with 9 requirements and orphaned two that were fully delivered. A SECOND defect
compounded it: `phase.complete` updated traceability rows only where the value was a bare
`Pending`, leaving six rows carrying parenthetical annotations stale -- so 8 of 11 rows were wrong
until fixed by hand. Detection heuristic: extract the phase's ROADMAP section and `rg -o` all
`[A-Z]+-[0-9]{2}` tokens; if that set is larger than `phase_req_ids`, the line wrapped.
**Source:** this phase's tracking steps, cross-checked against .planning/REQUIREMENTS.md
