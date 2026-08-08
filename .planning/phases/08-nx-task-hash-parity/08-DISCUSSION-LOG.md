# Phase 8: Nx Task-Hash Parity - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-07-28
**Phase:** 8-Nx Task-Hash Parity
**Mode:** `--analyze --auto` (trade-off table per question; recommended option auto-selected)
**Areas discussed:** Capture instrument, Root-cause record, Fix and sequencing, CORR-03 gating job

---

## Capture instrument (PARITY-02, PARITY-06)

### Q1 -- Where does the instrument live?

| Option | Description | Selected |
|--------|-------------|----------|
| Root-level dev-only `.mjs` | Beside `esbuild.action.mjs`. Keeps the `nx` devDependency out of the published tree; never an Nx target, so it cannot replay a cached record | ✓ |
| `packages/github-cache/src/` module | House convention and typed, but a shipped module importing `nx` (a devDependency) breaks consumer installs | |
| New root `tools/` directory | Outside `{projectRoot}` so edits do not rotate hashes -- but that benefit is illusory (see notes) | |

**Selected:** Root-level dev-only `.mjs` (recommended default).
**Notes:** Two independent reasons carried the choice, and one commonly-cited reason was
**discarded on inspection**: the "keep it outside `{projectRoot}` so it does not rotate the hashes
it measures" argument does not survive scrutiny, because both legs measure the *same commit* and
therefore hash the same instrument. Self-reference rotates hashes between revisions but cannot
introduce cross-OS divergence. The reasons that DID carry: `nx` is a devDependency, and an
Nx-cached instrument would replay a stale record instead of measuring.

### Q2 -- Which Nx API yields the per-node map?

| Option | Description | Selected |
|--------|-------------|----------|
| `createTaskHasher` + `hashTask` -> `Hash.details.nodes` | Verified present in installed Nx 23.1.0 at `dist/src/hasher/task-hasher.d.ts:19-33` | ✓ |
| `HashPlanInspector` / `nx show target inputs` | Explicitly rejected by PARITY-02: skips `ProjectConfiguration`, reports paths not hashes | |
| `.nx/cache/run.json` alone | Task-level only; complementary, not a substitute | |

**Selected:** `createTaskHasher` + `hashTask`.
**Notes:** Verified against the installed tree rather than assumed. `run.json` is retained as the
complementary task-level surface, read immediately after the run that produced it.

### Q3 -- Record format?

| Option | Description | Selected |
|--------|-------------|----------|
| One JSON per observation point | `meta` + per-target `{hash, nodes}` + discriminator stdout/stderr | ✓ |
| Markdown table | Human-readable but not machine-comparable by the gate | |

**Selected:** JSON per observation point.

### Q4 -- Which targets?

| Option | Description | Selected |
|--------|-------------|----------|
| Five (incl. `lint`) | Settles Phase 7's D-35 hand-off empirically | ✓ |
| Four cacheable targets | Smaller instrument, leaves `@nx/eslint` inference unverified | |

**Selected:** Five.

---

## Root-cause record (PARITY-01, -03, -04, -06)

### Q1 -- Location?

| Option | Description | Selected |
|--------|-------------|----------|
| `08-ROOT-CAUSE.md` in the phase dir | Matches Phase 7's `07-EVIDENCE.md` convention | ✓ |
| A doc under `docs/` | Consumer-facing too early; DOCS-07 is Phase 12 | |
| Folded into SUMMARY.md | Cannot be dated before the fix | |

**Selected:** `08-ROOT-CAUSE.md`.

### Q2 -- How is "dated before the first fix" proven?

| Option | Description | Selected |
|--------|-------------|----------|
| Its own commit, before any fix commit | Git history is the proof; record names the measured SHA | ✓ |
| A programmatic mtime / commit-order guard | Over-engineering for a one-shot ordering constraint | |

**Selected:** Its own commit.

### Q3 -- How many observation points?

| Option | Description | Selected |
|--------|-------------|----------|
| Four per target | Windows COLD + WARM, windows-11-arm, ubuntu-24.04-arm | ✓ |
| Three, warm as a footnote | Contradicts PARITY-03's explicit "four values per target, not two" | |

**Selected:** Four.
**Notes:** Points 1-2 are hand-captured -- no hosted runner is a developer workstation. Each pasted
value carries its full `meta` block so a stale paste is detectable. This is a recorded evidence-
quality limitation, not a hidden one.

### Q4 -- `typecheck`'s third variance source?

| Option | Description | Selected |
|--------|-------------|----------|
| Attempt root-cause, record OPEN if unsettled | PARITY-06 permits either; must not block the phase | ✓ |
| Declare open immediately | Wastes a lead the probe already narrowed | |

**Selected:** Attempt, then record OPEN with evidence if unsettled.

---

## Fix and sequencing (PARITY-03, -05, -07, CORR-04)

### Q1 -- Where do fixes land?

| Option | Description | Selected |
|--------|-------------|----------|
| `nx.json` `targetDefaults` only | Workspace is deliberately free of `project.json` | ✓ |
| Plugin `options` in `plugins[]` | Reserved as a fallback if inference proves unoverridable | |
| A `project.json` | Contradicts a standing workspace decision | |

**Selected:** `nx.json` `targetDefaults` only -- **but see UNRESOLVED U-01.**

### Q2 -- Fix shape?

| Option | Description | Selected |
|--------|-------------|----------|
| Narrow before widening; lock rationale in the guard spec | `nx.json` is strict JSON and holds no comments | ✓ |
| Add a normalizing synthetic input | Adds an input to fix an input problem | |

**Selected:** Narrow first, rationale displaced into the guard spec.

### Q3 -- Does `integration`'s discriminator change?

| Option | Description | Selected |
|--------|-------------|----------|
| No -- stays byte-identical | Sole mechanism separating OS-sensitive targets after VER-03 | ✓ |
| Re-spell it while here | Gratuitous risk to a Core-Value invariant | |

**Selected:** No change.

### Q4 -- Ordering against the fix commits?

| Option | Description | Selected |
|--------|-------------|----------|
| Measure -> record -> fix -> wire | No `nx.json` edit before the record lands | ✓ |
| Wire inputs first | Contaminates the investigation | |

**Selected:** Measure -> record -> fix -> wire.

---

## CORR-03 gating job

### Q1 -- Job shape?

| Option | Description | Selected |
|--------|-------------|----------|
| Two-leg matrix + third compare job (`needs` both, `if: always()`) | Only shape that can see both legs and fail on a MISSING leg | ✓ |
| Assert inside the existing `integration` job | Perturbs the target being measured; still cannot see both legs | |

**Selected:** Two-leg matrix + compare job.

### Q2 -- Gating or advisory?

| Option | Description | Selected |
|--------|-------------|----------|
| Build-gating, no `continue-on-error` | CORR-03 says build-gating | ✓ |
| Advisory first | Requirement does not permit it | |

**Selected:** Build-gating.

### Q3 -- Where does the comparator live?

| Option | Description | Selected |
|--------|-------------|----------|
| `packages/github-cache/src/hash-parity/`, excluded from the tarball via `!dist/hash-parity` | Only location where it is typechecked and unit-testable; exclusion pattern already used three times | ✓ |
| Inline bash in `ci.yml` | Unprovable -- cannot be shown to fail | |
| Root `.mjs` alongside the instrument | A spec importing an untyped `.mjs` fails `tsc --build` over the spec project | |

**Selected:** `src/hash-parity/` with a `files` exclusion.
**Notes:** This split -- instrument outside the package, comparator inside it -- is the only
arrangement that satisfies both constraints simultaneously (no `nx` in the shipped tree; a gate
with real typed unit tests).

### Q4 -- Is `lint` gated or only recorded?

| Option | Description | Selected |
|--------|-------------|----------|
| Gated as a fourth IDENTICAL target | Roadmap SC6 says the job "treats `lint` as a FOURTH target" | ✓ |
| Measured and recorded only | Wastes the measurement D-35 asked for | |

**Selected:** Gated, with a **named fallback**: if `lint` diverges and the fix is out of Phase 8's
scope, downgrade its clause to recorded-with-a-named-finding -- never delete it, because a deleted
clause is indistinguishable from one that never existed.

---

## Withheld from auto-lock

**U-01 -- Whether PARITY-03's byte-identical goal is reachable through `nx.json` alone.**
Rated HIGH impact (O1 and O4 both depend on PARITY-03; the choice would freeze how this workspace
configures targets) and NOT-HIGH confidence (the root cause is unknown by design -- establishing it
is the phase's first deliverable). Per the standing `--auto` trap-quadrant rule this was NOT
auto-decided. It is recorded in CONTEXT.md as UNRESOLVED with its competing options
(pin the inferred target / patch plugin options / escalate upstream) and must be re-opened with the
maintainer if the root-cause record lands outside `targetDefaults`' reach.

## Claude's Discretion

- Exact filenames, record JSON key spelling, and CI artifact names.
- One record file per leg vs per leg-and-target.
- Grouping of the four IDENTICAL clauses in the comparator's return shape.
- Table vs nested list for the per-node diff in the root-cause record.
- Subdirectory vs package-source root for the `hash-parity` module.

## Deferred Ideas

- **PARITY-08** (`ci.yml` as a `test` input + `nx.json` comment lock) -- Phase 9 by requirement.
- **DOCS-07's portability checklist** -- Phase 12, derived from this phase's root-cause record.
- **VER-01..07** (`@actions/cache` version OS-invariance) -- Phase 9.
- **CORR-02** (Releases asset name) -- Phase 10.
- **Live O1-O4 proofs** -- Phases 11 and 12.
