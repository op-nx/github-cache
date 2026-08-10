# Quick Task 260726-pjz: Extract and deduplicate ARCHITECTURE-DECISION.md - Research

**Researched:** 2026-07-26
**Domain:** GSD artifact taxonomy / documentation reorganisation (local only - no web research)
**Confidence:** HIGH (all claims verified against the shipped GSD install and this repo's tracked files)

## Summary

Four questions were asked. Three have clean answers; the fourth surfaced two corrections to
CONTEXT.md's premises. The headline finding is not in any of the four questions: **GSD names the
exact failure mode this task is fixing, and it names the cure - a consumption mechanism.** The
shipped taxonomy states "A well-formatted artifact that no workflow reads is inert"
[VERIFIED: `gsd-core/references/artifact-types.md:5`]. That single sentence is the design
principle the extraction should be built around.

Second headline: **CONTEXT.md Decision 6 does not work as written.** Adding the control ledger to
PROJECT.md's `## Evolution` section will NOT give it GSD's review cadence, because neither
`transition.md` nor `complete-milestone.md` reads that section - both carry hardcoded checklists.
Details and the fix in Q-EXTRA below.

**Primary recommendation:** Keep the disposition table from CONTEXT.md Decision 2 unchanged, but
re-target Decision 6 from `## Evolution` to `## Key Decisions` (which IS audited every milestone),
and adopt the `path - what it decides` annotation shape GSD already uses for `<canonical_refs>`.

## Q1 - Does GSD have a cross-artifact linking / progressive-disclosure convention?

**Answer: No generic "see also" convention exists. But three specific, quotable pointer shapes do.
Use shape (b).** [VERIFIED: full-text search of `gsd-core/templates/` and `gsd-core/workflows/`]

`rg -i "progressive.disclosure"` over the whole install returns **zero** hits. There is no named
convention by that term.

What exists instead, in order of relevance to this task:

**(a) `See: <path> (updated [date])`** - the only literal "See:" pointer in any template. Appears
once, in `state.md`, under a dedicated heading:

```markdown
## Project Reference

See: .planning/PROJECT.md (updated [date])
```
[VERIFIED: `templates/state.md:23-25`, mirrored at `templates/project.md:195`]

Note the `(updated [date])` suffix - the template's own rationale is a staleness trigger: "Last
update date (triggers re-read if stale)" [VERIFIED: `templates/state.md`, `### Project Reference`].
This is the closest GSD gets to a drift guard on a pointer.

**(b) `` `path` - [what it decides/defines] `` - the canonical-refs annotation shape.** This is the
established style and the one the extraction should copy:

```markdown
### [Topic area 1]
- `path/to/adr-or-spec.md` - [What it decides/defines that's relevant]
- `path/to/doc.md` SS N - [Specific section reference]
```
[VERIFIED: `workflows/discuss-phase/templates/context.md:84-85`; same shape at
`workflows/plan-phase.md:314`]

The load-bearing part is the annotation, not the path. `discuss-phase.md` is emphatic that a bare
path is insufficient: "Every entry needs a full relative path - not just a name"
[VERIFIED: `workflows/discuss-phase/templates/context.md:80`]. CONTEXT.md Decision 5 already
reaches this conclusion independently ("make that pointer explicit about WHAT the file now
contains ... rather than a generic 'see also'") - shape (b) is the shipped precedent for it.

**(c) `@path` mentions** - used for *required reading* in agent prompts
(`@.planning/PROJECT.md`) [VERIFIED: `templates/phase-prompt.md:48-50`,
`templates/planner-subagent-prompt.md:16-28`]. Not applicable here; this is prompt-injection
syntax, not a document cross-reference.

**Also relevant:** `templates/project.md` models an explicit out-of-tree pointer field -
`**Strategy notes**: [Link to external strategy doc, if any]` [VERIFIED: `templates/project.md`,
`## Business Context`], with guidance "Use **Strategy notes** to link out to a dedicated strategy
doc rather than duplicating it here". So GSD does sanction "point out, don't duplicate" - that is
precisely this task's thesis. (The field itself is unusable here: Business Context is explicitly
"only for monetized or customer-facing projects. Delete this section otherwise", and this
PROJECT.md correctly omits it.)

**Actionable:** use shape (b) for every inbound pointer added. Consider borrowing (a)'s
`(updated <date>)` suffix on the PROJECT.md pointer - it is shipped precedent for making a
pointer carry its own staleness signal, which is the exact drift this task is remediating.

## Q2 - Is there any canonical GSD home for a project-level SECURITY CONTROL REGISTER?

**Answer: No. CONTEXT.md's assertion survives falsification. But there is one near-miss worth
recording, and it reframes the file's category favourably.**

Falsification attempts, all negative [VERIFIED: `rg -uu -i` over the real install path]:

| Probe | Result |
|-------|--------|
| `control register\|control ledger\|security register\|controls.md` | 0 hits anywhere in gsd-core |
| `ARCHITECTURE-DECISION` | 0 hits anywhere in gsd-core |
| `templates/SECURITY.md` frontmatter | `phase: {N}` - structurally per-phase, cannot be project-scoped |
| `gsd-security-auditor.md` | Scope is "Verifies threat mitigations from PLAN.md threat model"; reads one phase's PLAN.md, writes one phase's SECURITY.md. No project-level input or output. |
| `workflows/secure-phase.md` | Reads `PLAN.md <threat_model>` per phase; `register_authored_at_plan_time` is a per-phase flag |
| `templates/README.md` root-artifact table | 11 exact names, none security-related |

**The near-miss: `.planning/METHODOLOGY.md`, a "Standing Reference Artifact".**
[VERIFIED: `references/artifact-types.md:95-131`]

GSD documents a third artifact category beyond Core and Extended - **Standing Reference
Artifacts** - explicitly "project-scoped, not phase-scoped", living at the `.planning/` root. Its
one member is METHODOLOGY.md, and its listed example lenses include **"STRIDE threat modeling"**.

I checked whether this is real or aspirational. It is **partly real**:

- `workflows/discuss-phase-assumptions.md:195` genuinely runs `cat .planning/METHODOLOGY.md` [VERIFIED]
- `workflows/pause-work.md:182` genuinely lists it as required reading [VERIFIED]
- `references/artifact-types.md:110` claims `plan-phase` reads it - **this claim is false**;
  `rg -F METHODOLOGY` over `workflows/plan-phase.md` returns zero hits [VERIFIED]

**Why it is still not the home for C1-C18:** METHODOLOGY.md holds *lenses* - "reusable
interpretive frameworks", each with "What it diagnoses / What it recommends / When to apply". That
is a how-to-reason artifact. C1-C18 is a what-we-decided-to-build artifact. Putting concrete
controls in a lens registry would be read by `discuss-phase-assumptions` as analytical guidance and
mis-applied. **Does not change the plan.**

**Why it matters anyway - two consequences:**

1. **Recategorise the file.** ARCHITECTURE-DECISION.md is not a rogue invention; it is a
   *Standing Reference Artifact* - a category GSD documents but under-populates. This is a better
   frame than "project invention" for the pointer text and for the deferred rename discussion.
2. **GSD's own criterion for this category is a consumption mechanism.** Quoting in full:

   > **Why consumption matters:** A METHODOLOGY.md that no workflow reads is inert. The lenses only
   > take effect when an agent loads them into its reasoning context before analysis. This is why
   > both the discuss-phase-assumptions and pause-work workflows explicitly reference this file.
   >
   > -- `references/artifact-types.md:114-116` [VERIFIED]

   Also `artifact-types.md:5`: "A well-formatted artifact that no workflow reads is inert - the
   consumption mechanism is what gives an artifact meaning." This is the doctrinal basis for the
   whole task. Cite it in the plan.

## Q-EXTRA (not asked, but it breaks CONTEXT.md Decision 6)

**CONTEXT.md Decision 6 says:** "`PROJECT.md`'s `## Evolution` section lists what to review at each
milestone; add the control ledger to that checklist so it inherits GSD's review cadence."

**This does not work.** Neither workflow reads PROJECT.md's `## Evolution` section. Both carry
their own hardcoded checklists:

- `workflows/complete-milestone.md:249-292` - `<step name="evolve_project_full_review">` with a
  fixed 7-item list [VERIFIED]
- `workflows/transition.md:190-212` - `<step name="evolve_project">` with a fixed list [VERIFIED]

The `## Evolution` section in PROJECT.md is a *transcript* of those hardcoded lists, not an input
to them. Adding a line to it is human-readable prose that no workflow will execute - the precise
"inert artifact" failure mode Q2 just quoted.

**What IS in the hardcoded milestone checklist** (and therefore does inherit the cadence):

| # | Checklist item | Reviews |
|---|----------------|---------|
| 6 | "Key Decisions audit" | `## Key Decisions` table |
| 7 | "Constraints check: Any constraints changed during development? Update as needed" | `## Constraints` |

[VERIFIED: `workflows/complete-milestone.md:284-292`]

**Fix - both halves are already in the plan, they just need re-pointing:**

- The Nx-contract row moving to `## Constraints` (Decision 2) **already** picks up cadence via
  item 7. No extra work.
- Re-target Decision 6 from `## Evolution` to `## Key Decisions`. The row
  `| One backend per process ... | ... | [OK] Decided (see ARCHITECTURE-DECISION.md) |`
  (PROJECT.md:143) already exists and already gets audited every milestone under item 6.
  Strengthening that row's pointer text is strictly more load-bearing than an Evolution line.
- Keeping the Evolution line as well is harmless documentation - just do not rely on it.

## Q3 - Exact shape of PROJECT.md `## Constraints`

**Template shape** [VERIFIED: `templates/project.md`]:

```markdown
## Constraints

- **[Type]**: [What] - [Why]
- **[Type]**: [What] - [Why]

Common types: Tech stack, Timeline, Budget, Dependencies, Compatibility, Performance, Security
```

Guidance: "Hard limits on implementation choices" and **"Include the 'why' - constraints without
rationale get questioned"** [VERIFIED: `templates/project.md`, `<guidelines>`, `**Constraints:**`].

**Live shape** (`.planning/PROJECT.md:130-137`) - 6 rows, all conforming:

| Line | Type label |
|------|-----------|
| 132 | `**Tech stack**` |
| 133 | `**Platform**` |
| 134 | `**Auth / repo scope**` |
| 135 | `**Security**` |
| 136 | `**Compatibility**` |
| 137 | `**Distribution**` |

Three shape facts the new row must match:

1. **Separator is an ASCII hyphen-space, ` - `, not an em dash.** The template prints an em dash;
   the live file uses ASCII throughout `## Constraints` (per the repo's ASCII-only rule). Match the
   live file, not the template.
2. **Type labels are open-ended.** `Platform`, `Auth / repo scope`, and `Distribution` are all
   invented locally, outside the template's "Common types" list. So a new `**Nx contract**` label
   is well-precedented and preferable to force-fitting the material into `**Compatibility**`
   (already occupied by cross-OS hash parity).
3. **Rows are one long sentence, semicolon-chained.** No sub-bullets anywhere in the section.

**Pre-existing duplication to reconcile** - the Nx-contract material is not fully novel:

- `## Constraints` line 132 already declares `Nx 23`.
- `## Out of Scope` line 101 already says "Nx custom task runner API - deprecated; target only the
  current self-hosted-cache HTTP contract" - which covers the ADR's final sentence.

So the genuinely-new content to carry over is narrower than the ADR's 5 lines: the OpenAPI 3.0.0
spec is embedded in the Nx docs with no standalone artifact; the PUT success code moved 202 -> 200
between Nx 20 and Nx 21 while `info.version` stayed `1.0.0` (so version-watching does not detect
drift); the conformance fixture must hash the full vendored spec and pin a named Nx version; and
the Nx 21+ floor is hard because `HttpRemoteCache` matches `200` strictly. Per CONTEXT.md's own
`<specifics>` ("Verify no canonical artifact is left asserting something the extraction deleted"),
do not re-state the task-runner exclusion - it is already in Out of Scope.

## Q4 - Other project-invented files under `.planning/`

**Answer: ARCHITECTURE-DECISION.md is the ONLY invention. `spikes/` is canonical - CONTEXT.md
Decision 1 is wrong about it.**

### Correction: `spikes/` is shipped GSD, not a project invention

[VERIFIED: 9 gsd-core files reference `.planning/spikes/`]

| Evidence | Location |
|----------|----------|
| Documented artifact type, incl. `MANIFEST.md` | `references/artifact-types.md:75-79` |
| `/gsd:spike` writes there | `workflows/spike.md:4` |
| `discuss-phase` probes for `MANIFEST.md` | `workflows/discuss-phase.md:255` |
| `new-project` probes for `MANIFEST.md` | `workflows/new-project.md:341` |
| `next` scans `spikes/*/README.md` for `verdict: PENDING` | `workflows/next.md:202` |
| `pause-work` writes spike handoffs there | `workflows/pause-work.md:21,31` |

The shipped layout is `.planning/spikes/NNN-name/README.md` + `.planning/spikes/MANIFEST.md`. This
repo's tree matches it exactly (`001-reader-round-trip` .. `005-cross-os-roundtrip`, `MANIFEST.md`).
Only `spikes/CONVENTIONS.md` is a local addition, and it is inside a canonical directory.

**Consequence for this task: none** - `spikes/` was already out of scope. But CONTEXT.md
Decision 1's sentence "`ARCHITECTURE-DECISION.md` and `spikes/` are project inventions" should not
be echoed into any artifact the plan writes.

### Full `.planning/` root inventory vs. the canonical set

The authoritative list is `CANONICAL_EXACT` in `gsd-core/bin/lib/artifacts.cjs:18-30`:
`PROJECT.md`, `ROADMAP.md`, `STATE.md`, `REQUIREMENTS.md`, `MILESTONES.md`, `BACKLOG.md`,
`LEARNINGS.md`, `THREADS.md`, `config.json`, `CLAUDE.md`, `RETROSPECTIVE.md`; plus regex patterns
for `vX.Y-*.md`.

| Entry | Canonical? | Evidence |
|-------|-----------|----------|
| `PROJECT.md` `ROADMAP.md` `STATE.md` `REQUIREMENTS.md` `MILESTONES.md` `RETROSPECTIVE.md` `config.json` | yes | `CANONICAL_EXACT` |
| `codebase/` | yes | `gsd-codebase-mapper`; 21 gsd-core refs |
| `research/` | yes | `templates/research-project/` ships all 5 files, names match exactly |
| `phases/` `milestones/` `debug/` `quick/` | yes | 52 / 11 / 10 / 5 gsd-core refs |
| `spikes/` | **yes** (correction above) | 9 gsd-core refs |
| **`ARCHITECTURE-DECISION.md`** | **NO** | sole non-canonical entry |

**No further orphans exist. Nothing to scout for follow-ups.**

### Machine-checkable signal: W019

`.planning/` root `.md` files not in `CANONICAL_EXACT` are flagged by `gsd health`:

```
addIssue('warning', 'W019', `Unrecognized .planning/ file: ${entry.name} - not a canonical GSD artifact`,
  'Move to .planning/milestones/ archive subdir or delete if stale. See templates/README.md ...')
```
[VERIFIED: `gsd-core/bin/lib/verify.cjs:1495-1496`; catalogued at `workflows/health.md:182`]

Evaluated directly against the shipped predicate:

```
ARCHITECTURE-DECISION.md  -> W019
THREAT-MODEL.md           -> W019
CONTROLS.md               -> W019
METHODOLOGY.md            -> W019
PROJECT.md                -> canonical
```
[VERIFIED: `node -e` against `artifacts.cjs.isCanonicalPlanningFile`]

Three things follow:

1. **The file trips W019 today and will still trip it after slimming.** This task cannot clear the
   warning; it is inherent to any non-canonical root `.md`. Do not let the plan claim otherwise.
2. **The deferred rename gains nothing here** - `THREAT-MODEL.md` and `CONTROLS.md` are equally
   non-canonical. Useful input for that follow-up discussion: rename on naming merit only, not to
   satisfy health.
3. **W019's remediation text ("Move to ... or delete if stale") is wrong for this file** and should
   not be followed. GSD's own `artifact-types.md` sanctions project-scoped standing references at
   the `.planning/` root, and METHODOLOGY.md - GSD's own example - trips W019 too. The checker and
   the taxonomy disagree; the taxonomy is the better authority for a deliberately-kept file.
   Directories are never checked (`if (!entry.isFile()) continue`), so `spikes/` etc. are unaffected.

### Inbound reference counts, CURRENT artifacts only

[VERIFIED: `git grep -c -F "ARCHITECTURE-DECISION"`]

| File | Count |
|------|-------|
| `.planning/research/ARCHITECTURE.md` | 3 |
| `.planning/PROJECT.md` | 3 |
| `.planning/codebase/CONCERNS.md` | 3 |
| `.planning/ROADMAP.md` | 2 (lines 14, 541) |
| `.planning/research/FEATURES.md` | 2 |
| `.planning/STATE.md` | 1 (line 95) |
| `.planning/research/STACK.md` | 1 |
| `.planning/spikes/MANIFEST.md` | 1 |
| `.planning/spikes/004-ghcr-hazards/README.md` | 1 |
| `docs/trust-and-security.md` | 1 (line 15, table row "CREEP control ledger (C1-C18)") |
| `packages/github-cache/src/backend/actions-cache-backend.ts` | 1 (line 88, control C1) |

**9 current `.planning/` files + 2 outside.** Confirms CONTEXT.md Decision 3's count exactly.
Archived (`milestones/`) and historical (`quick/`) refs excluded per Decision 4.

**Reframe this changes:** the file is *not* orphaned - it is already linked from 9 current
artifacts, including STATE.md and ROADMAP.md, which CONTEXT.md Decision 5 does not mention. Decision
6 correctly diagnoses the real root cause (nothing *schedules a review*), so the work is not "add
missing links" but "make the existing links describe the right thing, and attach the one that gets
audited". Adding many more pointers would be motion, not progress.

**Drift-guard note:** `packages/github-cache/src/docs-trust.spec.ts:25` asserts on
`docs/trust-and-security.md` [VERIFIED], so CONTEXT.md `<specifics>` is right that a mistake in the
docs file fails a test. But the guard does **not** assert the `ARCHITECTURE-DECISION.md` path
string - it does not check the pointer resolves. Keeping the filename (Decision 3) is what keeps
that link alive; there is no test backing it.

## Don't Hand-Roll

| Problem | Don't build | Use instead |
|---------|-------------|-------------|
| Pointer format for the slimmed file | A bespoke "See also" block | `` `path` - [what it decides] `` from `context.md:84` |
| Staleness signal on a pointer | A custom review-date comment | `See: <path> (updated [date])` from `state.md:25` |
| Scheduling a milestone review | A line in `## Evolution` (inert) | A row in `## Key Decisions` or `## Constraints` (hardcoded checklist items 6 and 7) |

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|-------|---------|---------------|
| A1 | `## Evolution` re-targeting is a plan change, not a scope expansion | Q-EXTRA | If treated as out of scope, Decision 6 ships inert and the drift recurs at the next milestone - the exact failure this task exists to fix |
| A2 | `**Nx contract**` is the right new Constraints label | Q3 | Cosmetic; CONTEXT.md marks exact wording as Claude's discretion |

No `[ASSUMED]` package or version claims - this task installs nothing.

## Sources

**Primary (HIGH):** all read directly from the installed GSD 1.6.1 at
`~/.gsd-opengsd/1.6.1/package/gsd-core` and from this repo's git index.

- `references/artifact-types.md` - artifact taxonomy, Standing Reference Artifacts, inertness doctrine
- `templates/README.md` - GSD Canonical Artifact Registry, W019 statement
- `templates/project.md`, `templates/state.md`, `templates/SECURITY.md`
- `workflows/discuss-phase/templates/context.md`, `workflows/plan-phase.md`
- `workflows/complete-milestone.md`, `workflows/transition.md`, `workflows/health.md`
- `workflows/secure-phase.md`, `workflows/spike.md`, `workflows/next.md`, `workflows/pause-work.md`,
  `workflows/discuss-phase-assumptions.md`
- `bin/lib/artifacts.cjs`, `bin/lib/verify.cjs` (executed, not just read)
- `~/.claude/agents/gsd-security-auditor.md`
- This repo: `.planning/PROJECT.md`, `.planning/ARCHITECTURE-DECISION.md`, `.planning/ROADMAP.md`,
  `.planning/STATE.md`, `packages/github-cache/src/docs-trust.spec.ts`

**Method note:** `~/.claude/gsd-core` is a symlink. `rg` does not traverse symlinks without `-L`,
so an initial pass silently returned zero hits for every query. All negative results above were
re-run against the resolved real path and validated with a positive control
(`planning/codebase` -> 21 files) before being recorded as genuine zeros.

## Metadata

**Confidence breakdown:**
- Q1 linking convention: HIGH - exhaustive template search, exact line cites
- Q2 no security-register home: HIGH - six independent falsification probes, all negative
- Q3 Constraints shape: HIGH - template and live file both read in full
- Q4 inventory + counts: HIGH - `CANONICAL_EXACT` executed against real filenames
- Q-EXTRA Evolution finding: HIGH - both workflow steps read in full

**Valid until:** next `/gsd:update` (findings are pinned to GSD 1.6.1 internals).
