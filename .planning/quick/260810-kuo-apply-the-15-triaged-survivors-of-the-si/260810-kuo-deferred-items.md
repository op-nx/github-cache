# Quick Task 260810-kuo: Deferred items (DEC-2)

**Recorded:** 2026-08-10
**Deferral lane:** v0.0.3 (`ROADMAP.md:418` -- "write it down so v0.0.3 does not re-derive it")
**In-scope set for this task:** 15 items (A1..A15), all applied.
**Recorded set:** NINE items (U1..U9), below. None is implemented by this task.
**Source of record:** `260810-kuo-TRIAGE.md` in this directory, the `/simplify` triage ledger,
authored before any file was touched. Its `## UNRESOLVED` section is the provenance for all nine.

The `/simplify` multi-agent cleanup review of PR #16 ran eight agents -- four lenses (reuse,
simplification, efficiency, altitude) over the whole diff, and four components in depth. Findings
were deduped by MECHANISM. Fifteen survived triage and are applied by this task. The nine below are
each HIGH-IMPACT and NOT-HIGH-CONFIDENCE -- the `--auto` trap quadrant -- so they are recorded
rather than auto-locked, per the standing rule that a high-impact choice made on low confidence goes
to the deferral record with its competing options intact.

## WHY THIS IS A NEW FILE AND NOT AN APPEND TO THE `260810-bxj` RECORD

CONTEXT.md's `<canonical_refs>` says two new items (U3, U5) are "to be appended by this task" to
`.planning/quick/260810-bxj-address-the-27-verified-survivors-of-the/260810-bxj-deferred-items.md`.
**This task deviates from that locked reference, deliberately and legibly.**

The bxj record declares its own scope THREE times, and appending items from a DIFFERENT review
falsifies all three:

| Where | Declaration |
|---|---|
| Opening lines | "**In-scope set for this task:** 27 items (T1-1..T1-8, T2-1..T2-7, T3-1..T3-10, T4-6, T4-7)." |
| Opening lines | "**Deferred set:** SEVEN items, recorded below." |
| Closing line | "**In-scope set for `260810-bxj`: 27 items.**" |

Those counts are facts about the thermos review of PR #16, not about the `/simplify` review. This
repo's practice is to supersede or cross-reference, never to back-edit a closed record.

**The bxj record is therefore untouched, and its seven items (T4-1..T4-5, T4-7a, T4-8) are
unaffected and still stand.** This file is the sibling v0.0.3 lane. DEC-2 governs both.

---

## U1 -- Delete `isLegacyOsSuffixedAssetName` and the disjointness apparatus

**Flagged by:** 2 agents (altitude, reuse).

**Measured evidence.** The agents' stated reason is factually WRONG, and that is the first half of
why this is not a simple accept: they objected on PUBLIC-SURFACE grounds, and `src/index.ts` exports
only `createCacheServer` and the backend types -- the helper is not on the public surface at all, so
the objection as filed does not describe this repo. What is true is the second half: the helper backs
a DELETE-path guard, and two further modules carry comment locks pointing at it.

**Fix shape.** Delete the helper and the disjointness assertions that consume it, then delete or
re-point the two comment locks that cite it.

Deferred because removing it removes a DELETE-path guard, which the `260810-bxj` precedent forbids
outright: no guard is weakened, and a guard that reddens gets the CODE changed. A deletion whose
stated justification has already been measured false is the weakest possible basis for retiring a
guard on the one path that destroys data, so the decision needs a deliberate v0.0.3 owner rather than
an `--auto` lock.

## U2 -- Replace the Wilson score interval with a flat ratio

**Flagged by:** 1 agent (simplification). Site: `publish-mirror.ts:54-103`.

**Measured evidence.** The Wilson score interval is arithmetic on a WARNING path -- nothing gates on
it. The file's own record states that NEITHER branch detects the rotation the guard was built for,
which is the decisive fact: the question is not which arithmetic is simpler but whether the guard
earns its place at all.

**Fix shape.** Either replace the interval with a flat ratio (the filed finding), or revisit the
whole guard, since its own site records it as not detecting its target condition.

Deferred because it is a BEHAVIOUR change on a warning path, and the file's own note that neither
branch detects the rotation it exists for argues for re-deciding the guard rather than re-deriving
its arithmetic. Swapping the formula under `--auto` would lock the smaller of two questions and make
the larger one harder to see.

## U3 -- `SEED_MARKER_WORDS` leaks this repo's CI key families into the shipped publish engine

**Flagged by:** 1 agent (altitude). Site: `publish-mirror.ts:234`. **NEW v0.0.3 item.**

**Measured evidence.** `publish-mirror.ts:234` hardcodes three hex-letter marker words. Those words
name THIS repository's `consumer-smoke`, `dogfood-seed` and `mirror-seed` cache-key families -- facts
about this repo's `ci.yml` -- inside a module that `docs/advanced.md:156` tells adopters to wire into
their own workflow. Confirmed against the governing authority, `PROJECT.md:146`: "changes made for
this repo's own CI/hashing must never leak into the consumer contract." This is a genuine altitude
defect, not a style preference: an adopter inherits a skip list naming key families they do not have.

**Fix shape.** Relocate the skip from the engine to the `listCacheEntries` adapter seam that
`action/index.ts` already uses for ref-scoping policy, so the shipped engine carries no
repo-specific vocabulary and this repo's own marker words live with this repo's own wiring.

Deferred because it is a SEAM change in the shipped consumer surface rather than a defect fix, and
DEC-2 governs: a quick task fixes defects, it does not restructure. The seam already exists and the
move is small, but relocating policy across the engine/adapter boundary changes what an adopter's
integration point is responsible for, which is a v0.0.3 decision.

## U4 -- Replace the `[remote cache]` log-grep gates with `run.json` `cacheStatus`

**Flagged by:** 2 agents (altitude, simplification).

**Measured evidence.** The current gates grep runner LOG TEXT. Moving to the structured
`run.json` `cacheStatus` field would retire, in one change: the floor arithmetic over match counts,
the `-a` text forcing, the output-shape `case`, and the `|| true`. `read-integration-hash.mjs`
already reads and prints `cacheStatus`, so the field is known present and known parseable -- the
altitude argument is strong and the mechanism is already in the repo.

Deferred because it cannot be proven locally: `RETROSPECTIVE.md` Top Lesson #1, verified across both
milestones, is that local gates cannot prove GitHub Actions runtime behaviour. Swapping the gate that
decides whether a cross-OS cache hit really happened, on a change no local run can validate, needs a
live runner and a deliberate window -- exactly the class of change this lesson exists to slow down.

## U5 -- `read-back.ts` re-authors the REST shard walk `releases-backend.ts` already has

**Flagged by:** 3 agents -- the strongest agreement in the set. **NEW v0.0.3 item.**

**Measured evidence.** The divergence is already MEASURABLE rather than hypothetical, which is what
separates this from an ordinary duplication finding. Two pieces of hardening have landed in ONE copy
only: the month-boundary fix (window-spanning shard tags rather than a single shard tag) and the
asset-page ceiling. `releases-backend.ts:227` still runs the UNBOUNDED loop. So the two copies are
not merely duplicated, they have already drifted in a way that affects correctness on a month
boundary and liveness on a large shard.

**Fix shape.** Extract a `lib/github-rest.ts` leaf and route both callers through it. Bundle-neutral
by the same precedent that produced `lib/mirror-seed.ts` and `lib/mirrored-by-label.ts` -- neither is
reachable from `serve()`, so neither consumer's shipped bundle grows.

Deferred because it is an extraction across TWO production modules, which DEC-2 places outside a
quick task. The measured drift makes it the highest-value item in this record, and the fix shape is
already precedented, so it should be early in v0.0.3 rather than merely recorded -- but a quick task
is the wrong vehicle.

## U6 -- Comment-to-code ratio 2.2:1, with roughly 21 "comment about a previous comment" sites

**Flagged by:** 3 agents (altitude, simplification, reuse).

**Measured evidence.** The ratio is real and measured at 2.2:1, and roughly 21 sites are a comment
correcting or annotating an earlier comment rather than the code. No defect follows from either
number: every one of those correction blocks exists because a previous revision carried a claim
measured false, and this repo's recorded discipline is to correct such a claim in place rather than
delete it -- the volume is the direct output of a rule that has repeatedly paid off (three such
corrections were required by this very task).

**Fix shape.** Nothing mechanical. A maintainer pass deciding, per site, whether the history is still
load-bearing or can be collapsed now that the correction has been absorbed.

Deferred because it is a MAINTAINER CALL on volume with no defect behind it, and the correction
blocks are the visible cost of a rule that is working. Trimming them under `--auto` would delete
exactly the reasoning that stops a future reader re-introducing a measured-false claim.

## U7 -- Broaden `.gitignore` to `/*.log`

**Flagged by:** 2 agents (simplification).

**Measured evidence.** Broadening the ignore set makes `capture-hashes.mjs`'s `workingTreeClean`
probe MORE likely to report clean, because that probe is `git status --porcelain` and an ignored file
is invisible to it. The instrument records `workingTreeClean` as EVIDENCE about the tree a hash record
was captured from, so widening what the probe cannot see loosens a guard rather than tidying a file.

**Fix shape.** If taken at all, pair the ignore broadening with a `workingTreeClean` probe that does
not lose sight of ignored artifacts, so the evidence field keeps meaning what the records claim.

Deferred because a `.gitignore` broadening is a GUARD LOOSENING here, against the no-guard-weakened
precedent, and the compensating probe change is the real work. The convenience gained is one line;
the property at risk is the provenance field the Phase 8 and Phase 11 hash records rest on.

## U8 -- A `hash-parity/targets.json` to replace the regex-scrape lockstep

**Flagged by:** 3 agents (reuse, altitude, simplification).

**Measured evidence.** Three mechanisms share ONE conceptual array of target names:
`capture-hashes.mjs`'s `const TARGETS`, `compare.spec.ts`'s `EXPECTED_TARGETS`, and the regex scrape
that links them. The scrape is genuinely brittle -- it extracts `^const TARGETS = \[([^\]]+)\];`, so
it empties silently if the declaration ever wraps, and this task had to preserve that single-line
form as an explicit constraint while editing the file around it. A shared JSON file would remove the
scrape entirely.

**Fix shape.** A `hash-parity/targets.json` read by both the instrument and the comparator, deleting
the regex extraction and its two coupled clauses.

Deferred because it touches `capture-hashes.mjs`, the instrument that produced the Phase 8 and Phase
11 hash records, and T4-4 already defers restructuring that file for exactly that provenance reason.
A3 and A4 were admissible in a quick task only because they were provably record-identical; changing
where the target list LIVES is not that kind of change.

## U9 -- Windows `npm ci` costs roughly 180 s x4 new legs, about 12 min per push

**Flagged by:** 1 agent (efficiency).

**Measured evidence.** The number is measured, not estimated: roughly 180 s per Windows `npm ci`,
times four new legs, is about 12 minutes of added wall time per push. The cost is real and recurring.

**Fix shape.** Every available lever -- dependency caching keyed on the lockfile, build-artifact
reuse across legs, or collapsing the `*-windows` matrix -- is a `ci.yml` restructure.

Deferred because every lever routes into T4-1, the already-deferred `ci.yml` restructure in the
`260810-bxj` record, and because `RETROSPECTIVE.md` Top Lesson #1 applies to the verification: no
local gate can prove that a caching change still produces a genuine cross-OS cache hit rather than a
faster wrong answer. Recorded here as the measured cost that motivates T4-1, not as a separate item.

---

## THREE FINDINGS THIS TASK CLOSED BY MEASUREMENT, so v0.0.3 does not re-open them

These are NOT deferrals. Each was an open question at plan time, measured during execution, and
settled. They are recorded because the settled answer is not obvious from the diff alone.

**A9 -- the `MIRRORED_BY_PREFIX` export STAYS, and that is the correct outcome.** The review proposed
deleting it once `read-back.ts` stopped importing it. Measured: `read-back.spec.ts:363` pins its
VALUE (`expect(MIRRORED_BY_PREFIX).toBe('mirrored-by: ')`) -- the constant's own value guard. Deleting
the export to satisfy an unused-export sweep would delete a live assertion. CONTEXT G4 pre-authorised
exactly this result. `fallow:ci` was run on that commit specifically and is clean: the config credits
spec imports, and two other exports are already spec-only-consumed and accepted.

**A6 -- CONTEXT G1's signature is SUPERSEDED.** G1 says the three package-source walks "differ ONLY
in the filter". Measured, they differed on THREE axes: root resolution (cwd-relative string vs
`import.meta.url` vs `repoFileUrl`), returned path shape (prefixed vs bare), and filter -- and the
third copy's filter selects a genuinely DISJOINT set rather than a variant spelling. The extraction
was still correct, but as "one walk primitive plus a per-caller path shape", and it carried a
docstring correction G1 did not budget for: routing through `repoFileUrl` removed a cwd dependency
that `actions-cache-backend.spec.ts` stated as a CONSTRAINT.

**A3 -- the lazy-load pays, and the decisive evidence is the import inventory rather than the
timing.** Measured at plan time: warm load of the six `nx/src/...` specifiers 687-1507 ms; a full
argument-rejection spawn about 1000 ms; a bare `node -e "process.exit(0)"` 375-526 ms. The decisive
fact is that `capture-hashes.mjs`'s only other static imports are `node:child_process`, `node:fs` and
`node:url` -- nothing else in the file pulls the Nx subtree -- so deferring all six removes it
ENTIRELY from every path that never reaches an Nx API. It is not a partial lazy-load that leaves the
tree loaded by a sibling specifier, which is the failure the decision rule was written to catch.

---

**Deferral lane:** v0.0.3, per `ROADMAP.md:418`. **In-scope set for `260810-kuo`: 15 items (A1..A15),
all applied.** None of the nine items above is implemented by this task; each is recorded only. The
seven items in the `260810-bxj` record (T4-1..T4-5, T4-7a, T4-8) are unaffected by this task and
still stand.
