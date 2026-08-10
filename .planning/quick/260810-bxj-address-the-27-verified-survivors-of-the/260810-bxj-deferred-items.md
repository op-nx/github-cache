# Quick Task 260810-bxj: Deferred items (DEC-2)

**Recorded:** 2026-08-10
**Deferral lane:** v0.0.3 (`ROADMAP.md:418` -- "write it down so v0.0.3 does not re-derive it")
**In-scope set for this task:** 27 items (T1-1..T1-8, T2-1..T2-7, T3-1..T3-10, T4-6, T4-7).
**Deferred set:** SEVEN items, recorded below. None is implemented by this task.

The thermos multi-agent review of PR #16 produced 33 verified survivors. Twenty-seven are fixed by
quick task `260810-bxj`. The seven below are recorded here, with the measured size and the written
reason each, so v0.0.3 does not re-derive them.

The governing rule is DEC-2: a quick task fixes defects, it does not restructure. The supporting
record is `RETROSPECTIVE.md` "What Was Inefficient", which penalises speculative restructuring by
name, and Top Lesson #1, verified across both milestones -- local gates cannot prove GitHub Actions
runtime behaviour.

---

## T4-1 -- split `.github/workflows/ci.yml`

**Measured size:** 2594 lines, five named seams.

**Reason for deferral.** `ci.yml` is the file that PRODUCED this milestone's O1-O4 live evidence.
Restructuring it invalidates the provenance of the evidence the PR rests on, and re-establishing that
provenance needs fresh live windows on a maintainer-only push path -- not something a quick task can
supply. Top Lesson #1 applies directly: three distribution bugs in this project passed every local
gate AND the verifier and took five live pushes to surface, so a local green on a restructured
`ci.yml` would not be evidence that the restructure is sound.

Additionally blocked by T2-2 by construction: T2-2 replaces the byte-pinned count-pipeline clauses
with token-level assertions over the same shell, so the shell text must be stable while T2-2 lands.
Seam B of this item (extracting the gate shell to a script) is the specific conflict, and quick task
`260810-bxj` states in task 6 that the extraction is deferred here rather than taken.

**Ordering:** after T2-2 has landed (it has, in this task).

## T4-2 -- restructure `packages/github-cache/src/publish/publish-mirror.ts`

**Measured size:** 1043 lines, 11 fallow complexity findings.

**Reason for deferral.** A quick task fixes defects, it does not restructure. This task does change
this file (T1-1's fail-closed upload classifier and T1-8's burned-tag hoist), and both changes are
local edits inside existing branches. Splitting the module in the same pass would mean the DEC-1
behaviour change and a structural move arrive in one diff, so a future bisect could not separate a
classifier regression from a move regression. The 11 complexity findings are a code-quality signal
with no correctness component -- no reviewer on the correctness axis raised this file's size.

## T4-3 -- split `packages/github-cache/src/dogfood-cross-os.spec.ts`

**Measured size:** 2211 lines, 11 unrelated concerns, roughly 370 duplicated lines.

**Reason for deferral.** Same rule: a quick task does not restructure. This task rewrites three of
this file's guards (T1-5's partition, T2-2's de-byte-pinning, T2-3's per-block mask localization) and
adds one clause (the jobs-API element guard). Those are the changes that make the file's coverage
claims true; moving the clauses to new files at the same time would make each guard's before/after
unreadable in review. The ~370 duplicated lines are the strongest argument for the split and they
survive this task untouched.

## T4-4 -- split `capture-hashes.mjs`

**Measured size:** 957 lines, three programs in one file (capture, diff, report).

**Reason for deferral.** A quick task does not restructure. This file is an INSTRUMENT, not shipped
code -- it is what produced the Phase 8 and Phase 11 hash records, and the research for this task used
it again (`--install-mode install`, then `--diff`). Changing the instrument that produced the
milestone's evidence carries the same provenance cost as T4-1, at lower value, because nothing in the
27 in-scope items touches it.

## T4-5 -- split `packages/github-cache/src/backend/actions-cache-backend.spec.ts`

**Measured size:** 1069 lines, plus two misplaced package-scope tree walks.

**Reason for deferral.** A quick task does not restructure. The two misplaced package-scope walks are
the substantive half of this item and they are genuinely misplaced -- they are facts about the
package, asserted from a single backend's spec. This task touches the file for prose corrections
(T2-1's census claims, T3-4's stale temp-directory word in three test titles, T3-5's superseded port
name) and for T4-6's workspace-root routing, all of which are local edits. Relocating the two walks
means deciding where package-scope assertions belong, which is a structure decision for v0.0.3.

## T4-8 -- `ReadOnlyBackend` re-widened at three sites; four port names for two concepts

**Measured size:** three re-widening sites; four names for two concepts.

**Reason for deferral.** This is a TYPE-SURFACE change, and narrowing an annotation can change what
callers may pass. This task deliberately corrects only the PROSE at the six sites that name the
superseded port type (T3-5) and explicitly does not widen or narrow any annotation, because the
annotation change is this item. Doing both in one pass would mean a reader cannot tell whether a
downstream type error came from the rename or from the re-widening. The four-names-for-two-concepts
half is a vocabulary decision that should be taken once, deliberately, rather than as a side effect
of a prose fix.

## T4-7a -- single-source the `nx.json` `namedInputs` ESLint toolchain array

**Measured size:** one four-element array authored twice in `nx.json` (under `test` and under
`lint`). This is the SINGLE-SOURCING half of T4-7; the DRIFT-GUARD half shipped in this task
(task 7), at zero `nx.json` bytes changed.

**Reason for deferral -- the sharpest of the seven, and it is the project's own hard ordering rather
than a preference.** Research MEASURED that the refactor rotates ALL FIVE task hashes (build,
typecheck, test, integration, lint) and makes
`.planning/phases/11-live-proofs-o1-o2-o3/11-hashes-{cold,warm}.json` non-reproducible from HEAD.

The rotation is caused by `nx.json`'s OWN BYTES -- Nx hashes the file's content into every task via
the `workspace:[{workspaceRoot}/nx.json,...]` node -- and NOT by `namedInputs`. Measured: zero
`externalDependencies` nodes changed, the node count was identical on every target, and there were no
`only-in-A` / `only-in-B` entries, so the effective hashed input set is bit-for-bit the same set. That
means the rotation is unavoidable for ANY `nx.json` edit whatsoever, including a comment-free
reformat.

`REQUIREMENTS.md:654` and `STATE.md:608` record that this milestone was SEQUENCED expressly to prevent
that class of change -- "Phase 7 before Phase 8 because `@nx/eslint` is an Nx INFERENCE plugin: an
inferred `lint` target changes `hash_project_config`, which is folded into EVERY task hash, so
adopting the linter after the parity root-cause work would invalidate that work." An `nx.json` edit
that rotates the workspace node is the same class, and landing it post-Phase-13 does to Phase 8's and
Phase 11's records precisely what the ordering existed to prevent.

The rotation is OS-uniform (`.gitattributes` forces `* text=auto eol=lf`, with this as the stated
reason), gates nothing (no tracked file pins a live-computed Nx hash; the literal in
`read-integration-hash.integration.spec.ts` is a hand-authored fixture value, not a captured hash),
and is semantically neutral. So the cost is to EVIDENCE PROVENANCE, not to correctness. That is why it
is deferred rather than rejected.

**ORDERING CONSTRAINT: T4-7a must land EARLY in v0.0.3, before any new hash record is captured.**
Landing it after a v0.0.3 hash record would invalidate that record too, repeating the cost instead of
paying it once.

**Its landing commit must additionally carry both companion actions:**

1. **The Phase 11 provenance note**, stating that
   `.planning/phases/11-live-proofs-o1-o2-o3/11-hashes-{cold,warm}.json` are historical evidence
   records whose values no longer reproduce from HEAD. They are evidence of a past run, not gates --
   nothing reddens -- but without the note a future reader reads the mismatch as a regression.
2. **The LINT-04 guard repair** in `packages/github-cache/src/nx-target-inputs.spec.ts`, through Nx's
   own arithmetic: `splitInputsIntoSelfAndDependencies` then `expandSingleProjectInputs`, both from
   `nx/src/hasher/task-hasher.js` (the file already imports from that internal module). SPLIT FIRST --
   `lint.inputs` contains a `^`-prefixed entry (`^default`) and `expandSingleProjectInputs` throws
   `namedInputs definitions cannot start with ^` on a dependency input. Measured without the repair:
   the guard fails with `expected [] to deeply equal [ ...(4) ]`, one test failing and 28 passing.

A partial version -- named input added, guard not repaired -- is a RED commit. A hash rotation without
the provenance note is a booby trap for the next reader of Phase 11's records.

Note that this task's task 7 already leaves a pointer for this: the drift guard's own comment records
that it is the drift-guard half of the house pattern (`RETROSPECTIVE.md` Patterns Established:
"single-source-of-truth + a byte/semantic drift guard beats a hand-synced second copy") and that the
single-sourcing half is deferred with an ordering constraint.

---

**Deferral lane:** v0.0.3, per `ROADMAP.md:418`. **In-scope set for `260810-bxj`: 27 items.** None of
the seven items above is implemented by this task; each is recorded only.
