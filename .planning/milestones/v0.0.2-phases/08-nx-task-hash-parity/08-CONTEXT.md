# Phase 8: Nx Task-Hash Parity - Context

**Gathered:** 2026-07-28
**Status:** Ready for planning
**Mode:** `--analyze --auto` (trade-off tables recorded, recommended option auto-selected;
one HIGH-impact / NOT-HIGH-confidence item withheld from auto-lock and recorded as UNRESOLVED)

<domain>
## Phase Boundary

`build`, `typecheck` and `test` compute ONE Nx task hash on every machine that matters, and
`integration` is the only target that diverges -- enforced by a build-gating CI job rather than
established by a measurement taken once.

Three things, in this order:

1. **Measure and root-cause.** A dated, node-by-node record of every hash input that differs,
   controlling for BOTH axes the 2026-07-26 pre-flight probe established -- a real OS axis and a
   `.nx/workspace-data` freshness axis that perfectly masquerades as it.
2. **Fix.** Bring `build`/`typecheck`/`test` to byte-identical hashes across the three observation
   points, without touching the public surface.
3. **Keep it fixed.** A two-leg, build-gating CI job that fails on regression, on a missing leg,
   and on `integration` NOT diverging.

**Not in this phase:** the `@actions/cache` version (Phase 9), the Releases asset name (Phase 10),
any live O1-O4 proof (Phase 11/12), PARITY-08's `ci.yml` test-input registration (Phase 9, so its
hash rotation collapses into VER-01's window).

</domain>

<decisions>
## Implementation Decisions

### Capture instrument (PARITY-02, PARITY-06)

- **D-01:** The instrument is a **root-level, dev-only ESM script** (sibling of
  `esbuild.action.mjs`), NOT a module of the published package and NOT an Nx target. Two
  independent reasons, both load-bearing:
  (a) it imports `nx/src/hasher/*`, and `nx` is a **devDependency** -- a shipped module importing
  it would break every consumer install;
  (b) **an Nx-cached instrument would replay a stale record instead of measuring.** A cached
  capture is not a capture. It is invoked directly by the CI step and by hand locally, never
  through `nx run`.

- **D-02:** The API is `createTaskHasher(projectGraph, nxJson)` + `hashTask(...)`, reading
  `Hash.details.nodes` -- verified present in the installed Nx 23.1.0 at
  `node_modules/nx/dist/src/hasher/task-hasher.d.ts:19-33`, reached via the package's `./src/*`
  export condition. If an Nx major moves the internal subpath the script fails at IMPORT time:
  loud and immediate, never a silent pass. Same posture and precedent as
  `packages/github-cache/src/nx-target-inputs.spec.ts`.

- **D-03:** `HashPlanInspector` / `nx show target inputs` is **REJECTED as the instrument** and the
  record must say so: it SKIPS `ProjectConfiguration` per its own API doc and reports file PATHS
  rather than content hashes, so both of v0.0.1's named suspects are invisible to it. A "no
  difference" result from it is NOT evidence. `.nx/cache/run.json` is recorded as the complementary
  **task-level** surface -- read immediately after the run that produced it, since every `nx`
  invocation overwrites it.

- **D-04:** One JSON record per observation point, shaped:
  `{ meta: { os, arch, nxVersion, nodeVersion, installMode, graphState, commit },
     targets: { <target>: { hash, nodes: { <nodeName>: <nodeHash> } } },
     discriminator: { stdout, stderr } }`.
  `meta` carries every PARITY-06 field, `graphState` is `cold` | `warm`, and the discriminator
  command's **raw stdout AND stderr** are captured per leg because `hash_runtime` hashes both.

- **D-05:** **Five** targets are captured: `build`, `typecheck`, `test`, `integration`, and
  `lint`. Phase 7's D-35 hands `lint` over explicitly -- `STACK.md` section 7 leaves "does
  `@nx/eslint` infer `lint` identically on both OSes?" UNVERIFIED BY DESIGN, and Phase 8 is where
  that is settled empirically rather than reasoned closed.

### Root-cause record (PARITY-01, PARITY-03, PARITY-04, PARITY-06)

- **D-06:** The record is `.planning/phases/08-nx-task-hash-parity/08-ROOT-CAUSE.md`, matching
  Phase 7's `07-EVIDENCE.md` convention. It lands in **its own commit, before any fix commit**, and
  names the measured commit SHA in its header. Git history is the proof that it predates the fix --
  no programmatic mtime guard.

- **D-07:** **Four observation points per target**, not two:
  | # | Point | Graph state | Source |
  |---|-------|-------------|--------|
  | 1 | native Windows workstation | COLD (post-`nx reset`) | hand-captured, pasted with its `meta` |
  | 2 | native Windows workstation | WARM | hand-captured, pasted with its `meta` |
  | 3 | `windows-11-arm` runner | cold | CI artifact |
  | 4 | `ubuntu-24.04-arm` runner | cold | CI artifact |
  Points 1-2 cannot come from CI -- no hosted runner is a developer workstation -- so they are
  hand-captured. Every pasted value carries its full `meta` block so a stale paste is detectable.

- **D-08:** Every proof states **which question it answers**: cross-OS parity, or "does a warm
  local box compute the hash cold CI published" (PARITY-04). The second must NOT be silently
  resolved by `nx reset` -- TEST-10's mandated reset clears `.nx/workspace-data` and forces COLD,
  which answers the first question while looking like it answered the second.

- **D-09:** The record states explicitly that **every prior cross-OS measurement in this repo read
  a confounded variable**, naming the pair in `STATE.md` attributed to "ubuntu CI" vs "windows CI".
  No difference may be attributed to the OS until freshness is pinned.

- **D-10:** Leading hypothesis to test FIRST, carried from the probe: a **Windows-only inference
  difference visible only on a COLD graph** -- the `@nx/vitest` / `@nx/js/typescript`
  OS-dependent-`ProjectConfiguration` class, freshness-gated, which is why v0.0.1's fixes appeared
  to hold. Research already RULES OUT `hash_project_config` as the starting point (every hashed
  field is forward-slashed and `{projectRoot}`-tokenised), so start at `External`, then
  `ProjectFileSet`.

- **D-11:** `typecheck`'s **third** variance source (four distinct values across the four probe
  measurements) is attempted, with install mode reaching it via `dependentTasksOutputFiles` or
  `externalDependencies` as the lead candidate. If unsettled inside this phase it is recorded as
  **OPEN with its evidence** -- PARITY-06 permits either, and it must not become a phase blocker.

### Fix and sequencing (PARITY-03, PARITY-05, PARITY-07, CORR-04)

- **D-12:** Fixes land in **`nx.json` `targetDefaults` only**. No `project.json` (the workspace is
  deliberately free of them), and no plugin-option patching as a first resort.

- **D-13:** Prefer **narrowing** inputs over adding them. `nx.json` is strict JSON and carries no
  comments, so each fix's rationale lock lives in the guard spec that pins it -- the same
  displacement `eslint.config.mjs` already uses for the D-08 root-directory lock.

- **D-14:** `integration`'s `{ "runtime": "node -p process.platform" }` stays **byte-identical**.
  Phase 8 does not re-spell it; it only asserts that it is the ONLY declared discriminator
  (CORR-04). After VER-03 this is the sole mechanism separating OS-sensitive targets, so touching
  it is a Core-Value regression.

- **D-15:** **Order is load-bearing: measure -> commit the record -> fix -> wire the gate.** Every
  `nx.json` edit rotates hashes; doing any of it before the record lands contaminates the very
  investigation the record exists to document.

- **D-16:** PARITY-07's public-surface guard passes **unchanged** -- no new env knob, no new action
  input, no new package export.

### CORR-03 gating CI job

- **D-17:** Shape is a **two-leg matrix job** (`ubuntu-24.04-arm`, `windows-11-arm`) that runs the
  instrument and uploads its record, **plus a third compare job** that `needs` both legs, runs
  `if: always()`, downloads both records and asserts. A single job cannot see both legs -- and
  `if: always()` is what makes "fewer than two records is a FAILURE, not a skip" reachable, because
  a skipped or failed leg still arrives at the assertion.

- **D-18:** **Build-gating. No `continue-on-error`**, no advisory-first period.

- **D-19:** The comparator is a **pure, typed function** at
  `packages/github-cache/src/hash-parity/` with a co-located spec. This is the only location where
  it is typechecked and unit-testable (`typecheck` runs `tsc --build` over the spec project, so a
  spec importing an untyped root `.mjs` would not compile). It is kept out of the published
  tarball by adding `!dist/hash-parity` to `packages/github-cache/package.json` `files` -- the
  exact pattern already used for `!dist/action`, `!dist/roundtrip`, `!dist/test`.
  The CI job passes it the two downloaded records; the loader around it stays thin enough to
  review by eye.

- **D-20:** Assertions, per CORR-03: (a) **exactly two** platform records exist, each carrying a
  non-empty hash for every target -- fewer than two FAILS; (b) `integration` **DIFFERS** between
  legs; (c) `build`, `typecheck`, `test` are **IDENTICAL**. Clause (c) is the non-vacuity control
  for (b): with every other input demonstrably shared, the only surviving explanation for (b) is
  the declared discriminator. A textual assertion that `nx.json` contains the input does NOT
  satisfy this.

- **D-21:** `lint` is asserted as a **fourth IDENTICAL target**, alongside build/typecheck/test.
  The roadmap's SC6 says the job "treats `lint` as a FOURTH target", and measuring it without
  asserting on it would waste the measurement D-35 asked for. **Named fallback:** if `lint` does
  diverge and the fix proves out of Phase 8's scope, its clause is downgraded to
  recorded-with-a-named-finding -- never deleted, because a deleted clause is indistinguishable
  from a clause that never existed.

- **D-22:** The gate **must be proven able to fail** before it is trusted. Fixture-driven negative
  cases per clause, plus a **vacuity control** -- Phase 7 recorded both that a prescribed
  non-vacuity filter was itself vacuous and that a lexical guard can be satisfied by the wrong
  token, so a passing gate is not evidence until its RED has been observed.

- **D-23:** Assert on **content, never on exit code**. Phase 7's learning that
  `nx run-many -t <missing>` exits 0 makes an inferred target a silently deletable gate; the same
  hazard applies to a comparison step whose input file never arrived.

### Claude's Discretion

- Exact filenames, the record JSON's precise key spelling, and the artifact names used to move
  records between jobs.
- Whether the instrument emits one file per leg or one file per leg-and-target.
- How the `build`/`typecheck`/`test`/`lint` clauses are grouped in the comparator's return shape.
- Whether the root-cause record's per-node diff is a table or a nested list.
- Where exactly the `hash-parity` module sits under `src/` (subdirectory vs package-source root),
  given `TESTING.md` places cross-cutting drift guards at the root and cohesive modules in a
  subdirectory.

### UNRESOLVED -- withheld from auto-lock (HIGH impact, NOT-HIGH confidence)

- **U-01: Whether PARITY-03's byte-identical goal is reachable through `nx.json` alone.** The
  root cause is unknown by design -- that is what D-06 exists to establish. If the divergence
  turns out to live inside plugin inference that `targetDefaults` cannot override, then D-12's
  "fixes land in `nx.json` only" is not a sufficient fix location, and the options open up to:
  pinning the inferred target explicitly, patching plugin options, or escalating upstream.
  IMPACT is HIGH -- O1 and O4 both depend on PARITY-03, and the choice would freeze how this
  workspace configures targets. CONFIDENCE is NOT HIGH -- there is no evidence yet either way.
  **Do not treat D-12 as settled if the root-cause record lands outside its reach.** Re-open this
  with the maintainer at that point rather than auto-selecting a fix location.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Required reading, in this order

- `.planning/research/v0.0.2/PROBE-RESULTS.md` -- **FIRST.** Establishes the two axes and the
  reframing this entire phase is built on. Q3 carries the cold-vs-cold cross-OS table and the
  warm-Windows-equals-cold-ubuntu finding.
- `.planning/REQUIREMENTS.md` -- lines 199-246 (PARITY-01..07), 75-86 (CORR-03, CORR-04),
  248-256 (PARITY-08, and why it is Phase 9 not Phase 8), 619-628 (the traceability rows).
- `.planning/ROADMAP.md` -- the Phase 8 section: goal, the seven success criteria, and the
  Live-CI close note.
- `.planning/research/v0.0.2/SUMMARY.md` -- section 3.3 "Phase 8" (instrument naming, the
  `hash_project_config` ruling-out, start at `External` then `ProjectFileSet`); section "Two
  barriers are being removed and the third was never a barrier".

### Prior-phase decisions this phase inherits

- `.planning/phases/07-lint-toolchain-and-the-ambient-platform-read-ban/07-CONTEXT.md` -- D-35
  (the `lint` hand-off and the exact `hash_project_config` fields to record), D-36 (three
  legitimate all-MISS rotation windows in this milestone), D-08 (never create a root `src/` or
  `lib/` during v0.0.2), D-02 (no `project.json`).
- `.planning/phases/07-lint-toolchain-and-the-ambient-platform-read-ban/07-LEARNINGS.md` --
  "Prove a guard can fail before trusting it", "The vacuity mutation, distinct from the deletion
  mutation", "`nx run-many -t <missing>` exits 0", "Registering the plugin rotates every task hash".

### In-repo precedent and integration surfaces

- `packages/github-cache/src/nx-target-inputs.spec.ts` -- the precedent for reaching into
  `nx/src/hasher/*` from this repo, including its documented limits.
- `nx.json` -- `targetDefaults` for all five targets; `integration`'s declared discriminator.
- `.github/workflows/ci.yml` -- the existing `integration` two-leg matrix (`:409`) is the shape
  the new job follows; the readiness-poll pattern is proven on both runner OSes.
- `eslint.config.mjs` -- header comment carrying the D-08 root-directory lock, and the precedent
  for displacing a lock into a file that can hold comments.
- `.planning/codebase/TESTING.md` -- spec placement rules and the Live-CI first-push close pattern.
- `.planning/codebase/CONVENTIONS.md` -- the single-source-of-truth + drift-guard pattern.
- `packages/github-cache/package.json` -- the `files` array and its `!dist/<subtree>` exclusions.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `packages/github-cache/src/nx-target-inputs.spec.ts` -- already imports
  `nx/src/hasher/task-hasher.js` and documents the internal-subpath risk. The import mechanics,
  the loud-failure posture, and the "delegate glob decisions to Nx's own resolver" technique all
  transfer directly.
- `.github/workflows/ci.yml`'s `integration` job (`:409-455`) -- a working two-leg
  `[ubuntu-24.04-arm, windows-11-arm]` matrix with `fail-fast: false` and `timeout-minutes`.
- `packages/github-cache/package.json` `files` -- `!dist/action`, `!dist/roundtrip`, `!dist/test`
  is the established way to keep a `src/` subtree out of the tarball.
- `esbuild.action.mjs` -- the precedent for a root-level, dev-only ESM script in this workspace.

### Established Patterns

- **Single source + drift guard.** Author a fact once, then add a spec that fails the moment a
  second copy drifts.
- **Explicit assertion lists, never `toMatchSnapshot()`.** An intentional change must show up as a
  reviewable diff, not a rubber-stampable `.snap` regen.
- **Cross-cutting drift guards live at `packages/github-cache/src/*.spec.ts`**; cohesive modules
  get a subdirectory with co-located specs.
- **Comment density carries decisions** -- module headers state the invariant, why the alternative
  was rejected, and the requirement ID. A stale rationale comment is treated as a defect.
- **Strict ESM, `nodenext`** -- every relative import carries an explicit `.js` extension even
  from a `.ts` source; `import type` for type-only imports.
- **Live-CI first-push close.** Behaviors only a real runner can prove are named explicitly and
  closed by a job that fails loud -- never by a passive log line.

### Integration Points

- `nx.json` `targetDefaults` -- where every fix lands.
- `.github/workflows/ci.yml` job list -- where the two-leg capture and the compare job are wired.
- `packages/github-cache/src/hash-parity/` -- new comparator module plus its spec.
- `packages/github-cache/package.json` `files` -- one `!dist/hash-parity` exclusion.
- Root-level `.mjs` -- the capture instrument, beside `esbuild.action.mjs`.

</code_context>

<specifics>
## Specific Ideas

- The phase's own success criteria are unusually prescriptive about what does NOT count as
  evidence -- `nx show target inputs` returning "no difference", a textual assertion that
  `nx.json` contains the discriminator, and a `nx reset` that silently converts PARITY-04's
  question into PARITY-03's. Treat each of those as an explicit anti-requirement, not as advice.
- Phase 7 recorded that this milestone has **three legitimate all-MISS rotation windows**. Phase
  8's fix commits are one of them. Do not treat the resulting cache misses as a defect, and do not
  author a tripwire here that would fire on them.
- The probe already supplied one cold cross-OS reading at `fe25a3f`. Phase 8 **re-takes it at its
  own commit** rather than citing it as current.

</specifics>

<deferred>
## Deferred Ideas

- **PARITY-08** (`ci.yml` as a registered `test` input + the comment lock on `nx.json`'s explicit
  input list) -- Phase 9 by requirement, so its hash rotation collapses into VER-01's existing
  window. Any Phase 8 spec that would assert on `ci.yml` content must account for this: without
  the input, such a spec serves a stale cached PASS.
- **DOCS-07's portability checklist** -- Phase 12. Its items are DERIVED from this phase's
  root-cause record, so the record should be written knowing it will be read that way.
- **The `@actions/cache` version's OS-invariance** (VER-01..07) -- Phase 9.
- **The Releases asset name's OS component** (CORR-02) -- Phase 10.
- **Any live O1-O4 proof** -- Phase 11 and Phase 12. Phase 8 produces the preconditions, not the
  proofs.

</deferred>

---

*Phase: 8-Nx Task-Hash Parity*
*Context gathered: 2026-07-28*
