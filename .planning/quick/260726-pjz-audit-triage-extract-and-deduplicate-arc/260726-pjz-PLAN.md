---
phase: quick/260726-pjz
plan: 01
type: execute
wave: 1
depends_on: []
autonomous: true
requirements: [D-01, D-02, D-03, D-04, D-05, D-06]
files_modified:
  - .planning/quick/260726-pjz-audit-triage-extract-and-deduplicate-arc/260726-pjz-COVERAGE.md
  - .planning/ARCHITECTURE-DECISION.md
  - .planning/PROJECT.md
  - .planning/ROADMAP.md
  - .planning/STATE.md
  - .planning/REQUIREMENTS.md
  - .planning/research/ARCHITECTURE.md
  - .planning/research/FEATURES.md
  - .planning/research/STACK.md
  - .planning/codebase/CONCERNS.md
  - .planning/spikes/MANIFEST.md

must_haves:
  truths:
    - "Every DISTINCTIVE CLAIM of every removed section is classified before the removal edit
      runs, by an executed grep - not asserted in prose - into exactly one of COVERED (proven
      present in a named canonical artifact OUTSIDE the ADR), RESIDUE (proven absent everywhere
      else, therefore RETAINED in the slimmed ADR), or SPENT (obsolete by a recorded event).
      One term per claim; a term that lands on a shipped-requirements checklist tick is NOT
      coverage - the tick records what shipped, not the reasoning being deleted. The proof is
      recorded in 260726-pjz-COVERAGE.md and the removal is gated on it."
    - "Retention is the DEFAULT for uncovered content, not an escape hatch. The KEEP criterion
      is 'keep only what has no canonical home', so content with no home stays in the ADR under
      `## Residual notes` and the whole `## References` block is RETAINED. Homelessness is probed
      at CLAIM level against the LIVE tree - a probe that searches the ADR's own phrasing passes
      by phrasing accident, and an archived `.planning/milestones/` hit is a historical record,
      not a canonical home (D-04), so both are excluded. SEVEN residue claim items survive that
      probe (each measured homeless): the D1 YAGNI deferrals reduced to `synchronous write
      fan-out` + `multiple simultaneous stores` ONLY; the GHES anti-spoofing cross-check; the
      read-time `content-sha256` integrity note; the git-native / Actions-build-artifact
      rejection rationale; the CREEP-orthogonality scope check; the Nx-client tarball-extraction
      (`zip-slip`/`hardlink`) inherited-protection note carried out of the MOVE section; and the
      single-layer-containment residual risk. Plus the `## References` block as one more RESIDUE
      row = EIGHT RESIDUE rows. Two claims previously mis-filed as residue are COVERED and are
      DELETED, not retained: the 'do not assume it is pluggable' clause (research/ARCHITECTURE.md:161,
      verbatim in research/SUMMARY.md:58) and the retention 'no second knob' invariant (six homes,
      incl. PROJECT.md:115 and shipped code at packages/github-cache/src/lib/retention.ts:5) -
      retaining either would recreate the two-sources-of-truth pair this task exists to delete."
    - "Controls C1-C18 survive BYTE-IDENTICAL. This is a documentation reorganisation, not a
      security-posture change (D-02). The 18 table rows hash to
      bb8cd9515a8e1477ea557ebc3aa5ce820fbc032744b2459e9b80fa2b44d1ce2f after the rewrite,
      exactly as before it."
    - "The file KEEPS its name (D-03). Two references live outside .planning/ and must keep
      resolving: docs/trust-and-security.md:15 and the C1 comment at
      packages/github-cache/src/backend/actions-cache-backend.ts:88. No rename, no move."
    - "No LIVE artifact cites a Decision number that no longer exists. Ten sites do today
      (measured): seven live ones - PROJECT.md:80, PROJECT.md:153, REQUIREMENTS.md:59,
      ROADMAP.md:541, research/ARCHITECTURE.md:157, spikes/MANIFEST.md:13, spikes/MANIFEST.md:30
      - are re-pointed; three are inside the SEALED spike record
      `.planning/spikes/005-cross-os-roundtrip/` (README.md:5, README.md:16, ci-roundtrip.mjs:4)
      and are EXCLUDED on the same rationale as D-04: a spike README/script records what was
      validated at the time, so rewriting it falsifies the evidence. MANIFEST.md is the live
      spike INDEX, not a sealed record, so both of its sites ARE re-pointed."
    - "Decision 6's alternative branch is the load-bearing authority for D2-01/CORR-02. It is
      NOT lost by the deletion - PROJECT.md Key Decisions already carries
      'or documented consumer OS-discrimination'. Citations move to that row, they do not
      lose their authority."
    - "The inbound link count stays EXACTLY 9 current .planning/ files (D-05). Links are
      re-described in place. Adding pointers is motion, not progress; deleting one strands
      a reader."
    - "The review cadence attaches to the PROJECT.md ## Key Decisions row, NOT to ## Evolution
      (D-06). Neither transition.md nor complete-milestone.md reads ## Evolution - both carry
      hardcoded checklists that DO audit Key Decisions (item 6) and Constraints (item 7).
      Writing to Evolution would ship the exact inert artifact this task exists to fix."
    - "Archived milestone artifacts are NOT touched (D-04) and gsd health W019 is NOT acted on
      (D-06). W019 fires today, fires after slimming, and fires for GSD's own METHODOLOGY.md;
      the taxonomy is the better authority."
    - "The MOVE is de-duplicated too, not just the REMOVEs. Every fact in the Nx contract
      section ALREADY lives in `.planning/research/STACK.md` section 1 (OpenAPI 3.0 /
      `version: 1.0.0` at :16,23; the 202->200 drift and static `info.version` at :36-38,
      verbatim; the hash-the-vendored-spec requirement at :38; the hard Nx 21+ floor and
      `HttpRemoteCache` strict-200 at :39-40). D-02's MOVE to `## Constraints` still stands -
      it buys milestone cadence via complete-milestone checklist item 7, which STACK.md does
      not get - so the row is TRIMMED to the hard floor plus a pointer to STACK.md rather than
      copying the table a third time. `Nx 23` (Tech stack row) and the task-runner exclusion
      (## Out of Scope:101) are also not restated."
  artifacts:
    - ".planning/quick/260726-pjz-audit-triage-extract-and-deduplicate-arc/260726-pjz-COVERAGE.md
      - the pre-removal coverage proof, one row per removed section"
    - ".planning/ARCHITECTURE-DECISION.md - slimmed to the C1-C18 ledger plus its framing"
    - ".planning/PROJECT.md - new **Nx contract** Constraints row + re-described Key Decisions row"
  key_links:
    - "PROJECT.md ## Key Decisions row (currently line 143) -> ARCHITECTURE-DECISION.md. This
      row IS the cadence mechanism (milestone checklist item 6). If the annotation is left
      generic, the drift recurs at the next milestone."
    - "PROJECT.md ## Constraints **Nx contract** row -> picks up cadence for free via milestone
      checklist item 7."
    - "docs/trust-and-security.md:15 -> `.planning/ARCHITECTURE-DECISION.md`. The docs-trust
      guard (docs-trust.spec.ts) asserts on the docs file but does NOT assert this path string,
      so nothing tests that the pointer resolves. Keeping the filename is the only thing
      holding it."
    - "actions-cache-backend.ts:88 -> control C1. C1 must survive verbatim in the ledger or a
      shipped source comment points at nothing."
---

<objective>
Audit, triage, extract and deduplicate `.planning/ARCHITECTURE-DECISION.md` into canonical GSD
artifacts: remove the 7 duplicated/spent sections, MOVE the Nx contract into
`PROJECT.md ## Constraints`, KEEP the C1-C18 control ledger plus the residue that has no home
anywhere else (`## Residual notes` and the retained `## References`), re-describe the 9 existing
inbound links so they name what the file actually holds, and attach a review cadence that a
workflow really runs.

D-02's disposition table marks `References` REMOVE and marks five other sections REMOVE whole.
Measurement contradicts it: seven distinct claims plus the entire twelve-source bibliography
exist in no other tracked file. The governing criterion is the KEEP rule - "keep only what has no
canonical home" - so those claims stay, in place, in this file. That is a smaller diff than
inventing homes for them in five canonical artifacts, and it is what D-02's own criterion says.

Every disposition is audited on the same terms, MOVE included. That is how the Nx contract
section's orphan parenthetical (the Nx client's inherited zip-slip protection) was found: it is
homeless, it is not part of the contract facts being moved, and it would otherwise have been
deleted silently. It joins the residue. Symmetrically, two claims previously assumed homeless are
COVERED and get deleted - the "publisher is pluggable" warning and the retention "no second knob"
invariant.

Purpose: the file is ~74 percent duplicate. That duplication already produced measurable drift -
Decision 6 reads "Default to OS-namespacing the store" with no supersession note while PROJECT.md
marks the same decision `[WARN] SUPERSEDED in v0.0.2`. Two sources of truth, already disagreeing.
Deleting the duplicate removes the drift surface; the cadence stops it recurring.

Doctrine, quotable from GSD's own taxonomy (`references/artifact-types.md:5`): "A well-formatted
artifact that no workflow reads is inert - the consumption mechanism is what gives an artifact
meaning."

Output: a coverage proof, a ledger-only ADR, a PROJECT.md that carries the extracted material
under a mechanism that is audited every milestone, and nine inbound links that describe the right
thing.

Scope: documentation reorganisation only. No source-code behaviour changes. No package installs.
</objective>

<execution_context>
@~/.claude/gsd-core/workflows/execute-plan.md
</execution_context>

<context>
@.planning/quick/260726-pjz-audit-triage-extract-and-deduplicate-arc/260726-pjz-CONTEXT.md
@.planning/quick/260726-pjz-audit-triage-extract-and-deduplicate-arc/260726-pjz-RESEARCH.md
@.planning/ARCHITECTURE-DECISION.md
@.planning/PROJECT.md

Decision IDs used below map to CONTEXT.md's numbered decisions:
D-01 = what counts as canonical (`spikes/` IS canonical GSD - do not echo the "project
invention" phrasing); D-02 = the per-section disposition table; D-03 = do NOT rename the file;
D-04 = archived artifacts are NOT updated; D-05 = re-describe the 9 existing links, do not add
new ones; D-06 = attach cadence to `## Key Decisions`, and do NOT act on `gsd health` W019.

Shell note: this repo forbids `grep`. Use `git grep` for tracked files and `rg` otherwise.
All new prose must be ASCII - `-` not an em dash. The surviving C1-C18 rows are the one
exception and are preserved byte-identical, non-ASCII characters included.

<!-- planner-discipline-allow: ADR Decision -->
<!-- planner-discipline-allow: Decision 6 -->
</context>

<tasks>

<task type="auto">
  <name>Task 1: Classify every removed CLAIM as COVERED, RESIDUE or SPENT (gate)</name>
  <files>.planning/quick/260726-pjz-audit-triage-extract-and-deduplicate-arc/260726-pjz-COVERAGE.md</files>
  <action>
The unit of proof is a DISTINCTIVE CLAIM, not a section. One term standing in for a whole list is
the defect this task exists to avoid: a single reference token cannot prove a twelve-item
bibliography, and a term that lands on a ticked entry in PROJECT.md's shipped-requirements
checklist proves only that something shipped, NOT that the reasoning being deleted survives.

Three dispositions, and RETENTION IS THE DEFAULT for anything not proven elsewhere:

- **COVERED** - the claim is proven present in a NAMED artifact outside
  `.planning/ARCHITECTURE-DECISION.md` by the executed assertion in the row. Safe to delete.
- **RESIDUE** - the claim is proven absent everywhere else, so it is RETAINED in the slimmed ADR
  under `## Residual notes` (Task 2c). This is not a failure and not an escape hatch; it is the
  KEEP criterion ("keep only what has no canonical home") doing its job.
- **SPENT** - obsolete by a recorded event, evidenced by the event's record. Applies to the
  Framing section ONLY: the rebuild happened and `MILESTONES.md` records v0.0.1 shipped.

Write `260726-pjz-COVERAGE.md` as one table, one row per claim:
`| Section | Claim | Disposition | Home | Executed assertion |`. At least 44 rows carry a
disposition cell of `COVERED`, `RESIDUE` or `SPENT`. Never write `UNCOVERED` or `TODO` - a claim
with no home is RESIDUE, and RESIDUE is a legal, complete outcome. The disposition-cell gate below
tolerates column-aligned padding, so you may align the table or not; both pass.

**The 36 COVERED/SPENT assertions.** Run exactly the command in `<verify><automated>` below -
it IS this battery, in this order, plus the two COVERAGE.md checks; do not retype a variant.
Each `git grep`/`test` in it is one table row, in this reading:

- Framing (SPENT): `v0.0.1` in `MILESTONES.md`.
- Decision 1 (7 claims): one-backend-per-process, `selectBackend`, the `get`/`put` port shape
  (`PutResult`), RW-vs-RO being `context-derived` (`codebase/INTEGRATIONS.md:84`, substantive
  prose - NOT PROJECT.md's dated log footer), the `no-flag safety property` being load-bearing
  (`research/FEATURES.md:152` - NOT PROJECT.md's Validated tick), the publisher/retention seam
  sitting `behind no port`, and the "do not assume it is pluggable" clause
  (`research/ARCHITECTURE.md:161`, verbatim at `research/SUMMARY.md:58`).
- Decision 2 (5 claims): write-trust allowlist, the separate sync-gate predicate, the
  `GITHUB_SERVER_URL` host detection, the `ghe.com` Data-Residency suffix, and the PR
  activity-type nuance (`base-scope`, which lives in the shipped backend source + its spec).
- Decision 3 (7 claims): the locked Releases reader, the >5000 wall, the 1000-asset cap, the
  month-shard model, the ~2 GiB ceiling (`MILESTONES.md:28`, the publish-engine prose - NOT
  PROJECT.md's Validated tick), the PROV-01 revisit trigger, and reversibility being `additive`.
- Decision 5 (4 claims): no LRU manifest, `CACHE_MIRROR_MAX_AGE_DAYS`, the age-only RO tier, and
  the retention "never introduce a second knob" invariant (`PROJECT.md:115`, substantive prose;
  five further homes at `RETROSPECTIVE.md:31`, `research/ARCHITECTURE.md:132,227`,
  `docs/trust-and-security.md:116` and shipped code `packages/github-cache/src/lib/retention.ts:5`).
- Decision 6 (2 claims): both branches ("or documented consumer OS-discrimination"), and a
  cross-OS hit being a `wrong result` rather than a MISS.
- Consequences (10 claims): the spike verdict (`strongest pro-Releases dim` in the MANIFEST
  verdict column - the content, not `test -f` on the file), the `background-step` pattern and
  the `composite`-action caveat in `docs/advanced.md`, the `services:` Linux-only limitation and
  the `hermetic` non-Node niche in `codebase/CONCERNS.md`, the `wait-all`/cancel teardown in
  `docs/examples/minimal-ci.yml`, the `SIGTERM` drain in the shipped `serve.ts`, and the
  governance trio as the shipped `SECURITY.md` + `LICENSE` + the `semver` statement in
  `docs/versioning.md`.

**The 7 RESIDUE claim rows.** Probe each at CLAIM level, never by echoing the ADR's own
phrasing - a probe built from the sentence you are about to delete passes by phrasing accident.
Exclude the ADR itself, this task's `quick/` directory, and `.planning/milestones/` (an archived
record is history, not a canonical home - D-04). Record the executed probe as the row's
assertion, e.g.
`git grep -q -F "content-sha256" -- . ':!.planning/ARCHITECTURE-DECISION.md' ':!.planning/quick' ':!.planning/milestones'`
exits non-zero. All 7 were re-measured homeless at plan time:

1. Decision 1 YAGNI deferrals - `synchronous write fan-out` and `multiple simultaneous stores`
   ONLY. The "do not assume the publisher is pluggable" warning is NOT residue: it is COVERED
   above (`research/ARCHITECTURE.md:161`, verbatim at `research/SUMMARY.md:58`) and is deleted.
2. Decision 2 GHES anti-spoofing cross-check - absence of `/meta` `installed_version` plus the
   `X-GitHub-Enterprise-Version` header, and the dormant version-gate knob held OFF until a GHES
   floor publishes.
3. Decision 3 read-time integrity - store-and-verify a published `content-sha256`, and
   explicitly NOT `sha256(blob) == {hash}` because the Nx key hashes task inputs.
4. Decision 3 rejection rationale - git-native (clone bloat, no clean eviction) and Actions build
   artifacts (not content-keyed). The MANIFEST records THAT they are out, not WHY.
5. Decision 3 CREEP-orthogonality scope check - the reader choice does not move the primary
   threat; it is a remediation win, not a CREEP-prevention one.
6. Nx contract section, the parenthetical at ADR line 15 - the Nx client hardens tarball
   extraction against `..`/absolute/symlink/hardlink escape, so a malicious server cannot
   `zip-slip` the client; inherited protection. This one sits in the MOVE section, not a REMOVE
   section, and is the disposition table's only un-audited row - it would otherwise be deleted
   silently along with its unactioned "worth a docs note" recommendation. The claim is homeless
   in `.planning/`, `docs/` and `packages/` source (the only tree hits are inside the vendored
   `start-cache-server/index.js` bundle, which is generated output, not a home). The docs-note
   recommendation itself is carried forward in the SUMMARY's deferred follow-ups.
7. Consequences residual risk - containment is single-layer at the write/sync gates, so gate
   correctness is load-bearing with no backstop.

NOT residue: the retention "no second knob" invariant. It has six homes (see Decision 5 above),
so it is COVERED and deleted. Keeping it would recreate exactly the two-sources-of-truth pair
this task exists to remove.

The whole `## References` block is RETAINED wholesale (Task 2c), so it needs no per-token row -
record it as one RESIDUE row citing the measured absence of `Cacheract`, `sccache`, `HeroDevs`,
`CodeQL`, `nixcache-oci`, `tag mutability` and `nx.app/files` from every other tracked file.

The Nx contract section is NOT in this battery - it is MOVED, not removed, and its assertion is
Task 2's post-move check.
  </action>
  <verify>
    <automated>git grep -q -F "v0.0.1" -- .planning/MILESTONES.md && git grep -q -F "One backend per process, context-selected" -- .planning/PROJECT.md && git grep -q -F "selectBackend" -- .planning/research/ARCHITECTURE.md && git grep -q -F "PutResult" -- .planning/research/ARCHITECTURE.md && git grep -q -F "context-derived" -- .planning/codebase/INTEGRATIONS.md && git grep -q -F "no-flag safety property" -- .planning/research/FEATURES.md && git grep -q -F "behind no port" -- .planning/research/ARCHITECTURE.md && git grep -q -F "do not assume it is pluggable" -- .planning/research/ARCHITECTURE.md && git grep -q -F "Write-trust = allowlist-only" -- .planning/PROJECT.md && git grep -q -F "Sync gate = a separate predicate" -- .planning/PROJECT.md && git grep -q -F "GITHUB_SERVER_URL" -- .planning/PROJECT.md && git grep -q -F "ghe.com" -- .planning/PROJECT.md && git grep -q -F "base-scope" -- packages/github-cache/src/backend/actions-cache-backend.ts && git grep -q -F "Reader / cross-context adapter: **GitHub Releases**" -- .planning/PROJECT.md && git grep -q -F "5000" -- .planning/PROJECT.md && git grep -q -F "1000-asset" -- .planning/PROJECT.md && git grep -q -F "month-shard" -- .planning/PROJECT.md && git grep -q -F "2 GiB" -- .planning/MILESTONES.md && git grep -q -F "PROV-01" -- .planning/PROJECT.md && git grep -q -F "additive" -- .planning/PROJECT.md && git grep -q -F "no LRU manifest" -- .planning/PROJECT.md && git grep -q -F "CACHE_MIRROR_MAX_AGE_DAYS" -- .planning/PROJECT.md && git grep -q -F "age-only" -- .planning/PROJECT.md && git grep -q -F "never introduce a second knob" -- .planning/PROJECT.md && git grep -q -F "or documented consumer OS-discrimination" -- .planning/PROJECT.md && git grep -q -F "wrong result" -- .planning/PROJECT.md && git grep -q -F "strongest pro-Releases dim" -- .planning/spikes/MANIFEST.md && git grep -q -F "background-step" -- docs/advanced.md && git grep -q -F "composite" -- docs/advanced.md && git grep -q -F "services:" -- .planning/codebase/CONCERNS.md && git grep -q -F "hermetic" -- .planning/codebase/CONCERNS.md && git grep -q -F "wait-all" -- docs/examples/minimal-ci.yml && git grep -q -F "SIGTERM" -- packages/github-cache/src/serve.ts && test -f SECURITY.md && test -f LICENSE && git grep -q -F "semver" -- docs/versioning.md && test "$(rg -c -N '^\|.*\|\s*(COVERED|RESIDUE|SPENT)\s*\|' .planning/quick/260726-pjz-audit-triage-extract-and-deduplicate-arc/260726-pjz-COVERAGE.md)" -ge 44 && ! rg -q '^\|.*\|\s*(UNCOVERED|TODO)\s*\|' .planning/quick/260726-pjz-audit-triage-extract-and-deduplicate-arc/260726-pjz-COVERAGE.md</automated>
  </verify>
  <done>COVERAGE.md exists with at least 44 disposition rows (36 COVERED/SPENT + 7 RESIDUE claim
rows + the `## References` RESIDUE row = 44), every row reading COVERED, RESIDUE or SPENT and
naming the executed assertion that produced it. No row reads UNCOVERED or TODO. The 36-assertion
COVERED/SPENT battery exits 0 against the pre-removal tree, and the 8 RESIDUE rows are each
recorded with the claim-level negative probe - excluding the ADR, `quick/` and `milestones/` -
that proved them homeless.</done>
</task>

<task type="auto">
  <name>Task 2: Move the Nx contract into PROJECT.md, slim the ADR to the ledger, attach the cadence</name>
  <files>.planning/PROJECT.md, .planning/ARCHITECTURE-DECISION.md</files>
  <action>
Gated on Task 1: do not start until COVERAGE.md exists with every row classified COVERED, RESIDUE
or SPENT. Every RESIDUE row must land in the slimmed ADR here - that is what makes the removal
lossless.

**(a) `PROJECT.md ## Constraints` - add one `**Nx contract**` row** (per D-02's MOVE).

Match the LIVE shape, not the template: `- **[Type]**: [What] - [Why]`, ASCII ` - ` separator
(never an em dash), one semicolon-chained sentence, no sub-bullets. A new type label is
well-precedented - `Platform`, `Auth / repo scope` and `Distribution` are all locally invented.

**The MOVE is a de-dup too, and it is the disposition table's only un-audited row.** Measured:
every fact in the ADR's Nx contract section ALREADY lives in `.planning/research/STACK.md`
section 1 - OpenAPI 3.0 / `version: 1.0.0` at `:16,23`; the 202->200 drift and the static
`info.version` at `:36-38` (verbatim, same sentence); the hash-the-vendored-spec requirement at
`:38`; the hard Nx 21+ floor and `HttpRemoteCache` strict-200 at `:39-40`. So a full copy into
`## Constraints` would be a THIRD copy, which is the defect this task exists to remove.

D-02's MOVE is NOT overridden - it stands, because `## Constraints` is audited by
complete-milestone checklist item 7 and `research/STACK.md` is audited by nothing. So the row
carries the HARD FLOOR (the operative constraint) plus a pointer to STACK.md for the detail,
rather than restating the contract table.

Do NOT re-state `Nx 23` (already in the Tech stack row) and do NOT re-state the deprecated
task-runner exclusion (already at `## Out of Scope:101`) - CONTEXT.md's `<specifics>` requires
that no canonical artifact be left asserting the same thing twice.

Recommended wording (exact wording is your discretion per D-02, but keep the live shape and the
pointer):

`- **Nx contract**: the self-hosted-cache HTTP contract is an OpenAPI 3.0.0 spec embedded in the Nx docs source with no standalone artifact, and the Nx 21+ floor is HARD - the Nx client (`HttpRemoteCache`) matches PUT success strictly as `200` - so the conformance fixture pins a named Nx version and hashes the full vendored spec; the endpoint/status table, the `202`->`200` drift and the reason `info.version` cannot detect it are in `.planning/research/STACK.md` section 1.`

**(b) `PROJECT.md ## Key Decisions` - re-describe the pointer row and attach the cadence** (D-05, D-06).

The row whose Outcome cell currently reads `[OK] Decided (see ARCHITECTURE-DECISION.md)` (the
one-backend-per-process row) is the cadence carrier: `/gsd:complete-milestone` runs a hardcoded
"Key Decisions audit" over this table every milestone. Rewrite that Outcome cell into the
annotated-reference shape from `workflows/discuss-phase/templates/context.md:84`
(`` `path` - what it decides/defines ``), name what the file NOW holds, and state the cadence.
Borrow the `(updated <date>)` staleness suffix from `templates/state.md:25`.

Recommended Outcome cell:

`[OK] Decided - the project-level CREEP control ledger C1-C18 backing this and every other trust decision is `.planning/ARCHITECTURE-DECISION.md`; re-read and reconcile it at each milestone Key Decisions audit (updated 2026-07-26)`

Do NOT write the cadence into `## Evolution` (D-06). Neither `transition.md` nor
`complete-milestone.md` reads that section - both carry hardcoded checklists, and `## Evolution`
is a transcript of them, not an input. A line there would be inert.

Leave `PROJECT.md:17` alone - it already reads "the full CREEP control ledger is in
`.planning/ARCHITECTURE-DECISION.md`", which is exactly right. Leave the dated `Last updated`
footer alone; it is a log entry, and rewriting it would falsify the log (same principle as D-04).

**(c) Rewrite `.planning/ARCHITECTURE-DECISION.md` to the ledger only.**

Keep the filename (D-03). Restructure for readability now that one section remains:

1. `# Architecture Decision Record: CREEP-Safety Control Ledger` - the H1 may say what the file
   now is; the FILENAME must not change.
2. A Status/Scope block stating that this file holds only the control register, and pointing at
   where the extracted material went: `PROJECT.md ## Key Decisions` (every locked decision),
   `PROJECT.md ## Constraints` (the Nx contract), `.planning/spikes/001-005` (the FOUND-01
   evidence and verdict), `.planning/research/*` (the source corpus). Use the same annotated
   `` `path` - what it holds `` shape.
3. A Review cadence line: audited every milestone via the `## Key Decisions` row in PROJECT.md
   that points here.
4. A short "why the ledger has no canonical GSD home" note: GSD models security strictly
   per-phase (a `<threat_model>` in PLAN.md, a per-phase SECURITY.md) with no project-level
   register; C1 applies to every future phase so it cannot live in one phase's SECURITY.md;
   `## Constraints` is the wrong shape because constraints are limits and controls are
   mitigations. GSD's taxonomy sanctions this as a project-scoped "Standing Reference Artifact"
   at the `.planning/` root, the same category as its own METHODOLOGY.md. Record that the file
   trips `gsd health` W019 today, will keep tripping it, and that W019's remediation text does
   not apply here - do NOT act on it (D-06). Write that note in the FIRST PERSON of the document
   ("this file trips ...") and do NOT name its own filename: a self-reference would make the ADR
   a tenth inbound match and break Task 3's link count. Do not describe the file as a "project
   invention" and do not repeat CONTEXT.md's claim that `spikes/` is one - `spikes/` is canonical
   GSD (D-01).
5. The CVE-2025-36852 preamble paragraph and the C1-C18 table, BYTE-IDENTICAL. Copy the rows;
   do not retype them, do not ASCII-fold them, do not renumber, do not reword. Any change to the
   controls themselves is out of scope. (C10's row cites a Decision number; it stays verbatim and
   is the single sanctioned exception to point 7's rule.)
6. `## Residual notes` - the SEVEN RESIDUE claims Task 1 proved have no home anywhere else, kept
   here because the KEEP criterion is "keep only what has no canonical home" and these qualify.
   One short bullet each, faithful to the original meaning, preserving these exact tokens so the
   gate can see them: `synchronous write fan-out` and `multiple simultaneous stores` (the D1
   YAGNI deferrals); `installed_version` and `X-GitHub-Enterprise-Version` (the GHES
   anti-spoofing cross-check, and the dormant version-gate knob held OFF until a GHES floor
   publishes); `content-sha256` (store-and-verify at publish, NOT a hash of the blob against the
   key, which hashes task inputs); the git-native and Actions-build-artifact rejection rationale
   (`content-keyed`); the reader choice being `orthogonal` to CREEP - a remediation win, not a
   prevention one; the Nx client's inherited tarball-extraction hardening against
   `..`/absolute/symlink/`hardlink` escape, so a malicious server cannot `zip-slip` the client
   (carried out of the Nx contract section, whose other facts all moved or were already in
   `research/STACK.md`); and the residual risk that containment is `single-layer` at the
   write/sync gates, so gate correctness is load-bearing with `no backstop`.

   Do NOT carry over the "do not assume the publisher is pluggable" warning or the retention
   `no second knob` invariant. Task 1 classifies both COVERED (six homes for the latter,
   including shipped code); re-writing them here would rebuild the duplicate pair this task
   deletes. The gate does not look for them.
7. `## References` - RETAINED, byte-identical. The corpus pointer `.planning/research/*` covers
   only the corpus, not the twelve named sources; `Cacheract`, `sccache`, `HeroDevs`, `CodeQL`,
   `nixcache-oci`, tag mutability and `nx.app/files` appear in no other tracked file, so
   deleting the block would strand them.
8. A trimmed provenance footer keeping only the revision history that is about the ledger
   (the C1/C4/C11/C16/C18 revisions). Drop the FOUND-01 sentence's `(Decision 3)` parenthetical
   along with the rest of the non-ledger history.

Outside the C10 row, the slimmed file must cite NO Decision number - not in the Status block, not
in the residual notes, not in the footer. Name the surviving home instead
(`PROJECT.md ## Key Decisions`).

Delete the Framing, Nx contract, Decision 1, Decision 2, Decision 3, Decision 5, Decision 6 and
Consequences-and-spike-scope sections, minus the residue carried into point 6. Deletion, not
annotation: Decision 6 is the drift instance, and annotating it would patch one of two
disagreeing copies rather than removing the disagreement.
  </action>
  <verify>
    <automated>test "$(rg -N '^\| C[0-9]+ \|' .planning/ARCHITECTURE-DECISION.md | sha256sum | cut -c1-64)" = "bb8cd9515a8e1477ea557ebc3aa5ce820fbc032744b2459e9b80fa2b44d1ce2f" && test "$(rg -c -N '^\| C[0-9]+ \|' .planning/ARCHITECTURE-DECISION.md)" = "18" && ! rg -q '^## (Framing|Nx contract|Consequences)' .planning/ARCHITECTURE-DECISION.md && ! rg -q '^## Decision [0-9]' .planning/ARCHITECTURE-DECISION.md && rg -q '^## Residual notes' .planning/ARCHITECTURE-DECISION.md && rg -q '^## References' .planning/ARCHITECTURE-DECISION.md && test "$(rg -c 'Decision [0-9]' .planning/ARCHITECTURE-DECISION.md)" = "1" && { m=0; for t in "synchronous write fan-out" "multiple simultaneous stores" "installed_version" "X-GitHub-Enterprise-Version" "content-sha256" "content-keyed" "orthogonal" "zip-slip" "hardlink" "single-layer" "no backstop" "Cacheract" "sccache" "HeroDevs" "CodeQL" "nixcache-oci" "tag mutability" "nx.app/files"; do git grep -q -F "$t" -- .planning/ARCHITECTURE-DECISION.md || { echo "RESIDUE MISSING: $t"; m=1; }; done; test "$m" = "0"; } && git grep -q -F "CVE-2025-36852" -- .planning/ARCHITECTURE-DECISION.md && git grep -q -F "**Nx contract**" -- .planning/PROJECT.md && git grep -q -F "HttpRemoteCache" -- .planning/PROJECT.md && rg -q '^- \*\*Nx contract\*\*:.*research/STACK\.md' .planning/PROJECT.md && ! rg -q 'Nx contract.*—' .planning/PROJECT.md && test "$(git grep -c -F 'Nx custom task runner API' -- .planning/PROJECT.md | cut -d: -f2)" = "1" && git grep -q -F "milestone Key Decisions audit" -- .planning/PROJECT.md && ! git grep -q -F 'ARCHITECTURE-DECISION' -- .planning/ARCHITECTURE-DECISION.md && test -f .planning/ARCHITECTURE-DECISION.md</automated>
  </verify>
  <done>The 18 control rows hash unchanged. The 8 removed headings are gone and no `## Decision N`
heading survives, while `## Residual notes` and the retained `## References` both exist and carry
all 18 residue tokens. `Decision [0-9]` appears on exactly one line - C10's verbatim ledger row.
The ADR contains no self-reference, so Task 3's 9-file set still holds. PROJECT.md has a new
`**Nx contract**` Constraints row using the ASCII separator, carrying the hard Nx 21+ floor
(`HttpRemoteCache`) plus a `.planning/research/STACK.md` pointer instead of a third copy of the
contract table; the task-runner exclusion still appears exactly once in the file; and the Key
Decisions pointer row names the ledger and its milestone cadence.</done>
</task>

<task type="auto">
  <name>Task 3: Re-point the 9 inbound references so none cites deleted content</name>
  <files>.planning/PROJECT.md, .planning/ROADMAP.md, .planning/STATE.md, .planning/REQUIREMENTS.md, .planning/research/ARCHITECTURE.md, .planning/research/FEATURES.md, .planning/research/STACK.md, .planning/codebase/CONCERNS.md, .planning/spikes/MANIFEST.md</files>
  <action>
Re-describe in place. Do NOT add a pointer to any file that does not already have one, and do NOT
delete an existing pointer (D-05) - the count of current `.planning/` files referencing the ADR
must stay exactly 9. Do not touch anything under `.planning/milestones/` (D-04). Do not add an
`AGENTS.md` pointer: it is Nx/worktree agent guidance with no natural anchor, and D-05 says skip
rather than invent a section.

Use the annotated shape `` `path` - what it decides/defines `` throughout.

**Group A - seven LIVE sites cite a Decision number that will no longer exist. Re-point each to
the surviving canonical home:**

- `PROJECT.md:80` and `PROJECT.md:153` - both credit the CORR-01 alternative branch to the ADR's
  Decision 6. That authority now lives in this same table: the CORR-01 Key Decisions row already
  reads "or documented consumer OS-discrimination". Cite that row, not a deleted section.
- `REQUIREMENTS.md:59` - the D2-01 source cell has the same problem; re-point it the same way.
  `REQUIREMENTS.md` does NOT currently contain the ADR filename and must not gain it, or the
  inbound count below reads 10.
- `ROADMAP.md:541` - the provenance footer credits the same deleted section; re-point to
  `PROJECT.md ## Key Decisions` (the CORR-01 either/or row).
- `spikes/MANIFEST.md:13` - "Canonical scope" cites the deleted reader section plus the ledger.
  Keep the ledger half; move the reader half to `PROJECT.md ## Key Decisions`.
- `spikes/MANIFEST.md:30` - the CORR-01 rubric bullet ends "(CORR-01 / Decision 6)". Drop the
  dangling half; `CORR-01` alone is the durable identifier. MANIFEST.md is the LIVE spike index -
  it is the same file being edited at line 13 - so it is in scope even though the per-spike
  records below are not.
- `research/ARCHITECTURE.md:157` - cites the deleted reader section for FOUND-01 being resolved;
  re-point to `PROJECT.md ## Key Decisions` and keep the existing spike citation.

**Explicitly EXCLUDED - the sealed spike record `.planning/spikes/005-cross-os-roundtrip/`**
(`README.md:5` in the `validates:` frontmatter, `README.md:16`, and the header comment at
`ci-roundtrip.mjs:4`). These three cite Decision 6 as the thing the spike was run to validate.
They are historical evidence of what was checked at the time, so rewriting them falsifies the
record - the same rationale D-04 applies to archived milestone artifacts. Do not touch them; the
gate below excludes that directory by path and asserts it stays unmodified.

**Group B - four sites describe the file as holding decisions it no longer holds:**

- `ROADMAP.md:13-14` - "Decision record + CREEP control ledger C1-C18" - drop the decision-record
  half; the locked foundations listed above it are PROJECT.md's Key Decisions.
- `STATE.md:95` - "Full log in PROJECT.md Key Decisions + .planning/ARCHITECTURE-DECISION.md" -
  keep both pointers but split them honestly: the decision log is PROJECT.md; the ADR is the
  CREEP control ledger C1-C18.
- `research/ARCHITECTURE.md:8-10` and `research/STACK.md:9-10` and `research/FEATURES.md:9` -
  each header block attributes the port/`selectBackend`/write-trust/reader choices to the ADR.
  Those are PROJECT.md Key Decisions now; the ADR is the control ledger. Adjust the attribution
  only - do not rewrite the research findings.
- `research/FEATURES.md:209` - a bare path in the "Locked foundation" list; give it the same
  annotation `research/ARCHITECTURE.md:239` already has.
- `codebase/CONCERNS.md:389-391` - "These are LOCKED architectural decisions ... recorded in
  `.planning/ARCHITECTURE-DECISION.md`". The GHCR-01 deferral rationale is a PROJECT.md Key
  Decisions row; what the ADR still records is the control surface those triggers carry
  (C6/C10/C11/C13/C18, already cited in the bullet below it). Re-attribute accordingly.

**Leave alone - already accurate after slimming:**
`PROJECT.md:17`; `PROJECT.md:178` (dated log footer); `codebase/CONCERNS.md:198` (control C5) and
`:414` (control C7); `research/ARCHITECTURE.md:239`; `spikes/004-ghcr-hazards/README.md:25`
(C10/C11); `docs/trust-and-security.md:15` (already "CREEP control ledger (C1-C18)"); and the
`actions-cache-backend.ts:88` C1 comment. The two out-of-tree references keep resolving because
the filename is unchanged (D-03) - note that no test asserts that path string, so the filename is
the only thing holding them.
  </action>
  <verify>
    <automated>! rg -q 'Decision [0-9]' .planning --glob '!**/milestones/**' --glob '!**/quick/**' --glob '!ARCHITECTURE-DECISION.md' --glob '!**/spikes/005-cross-os-roundtrip/**' && test "$(git grep -l -F 'ARCHITECTURE-DECISION' -- .planning ':!.planning/milestones' ':!.planning/quick' ':!.planning/ARCHITECTURE-DECISION.md' | LC_ALL=C sort | tr '\n' ' ')" = ".planning/PROJECT.md .planning/ROADMAP.md .planning/STATE.md .planning/codebase/CONCERNS.md .planning/research/ARCHITECTURE.md .planning/research/FEATURES.md .planning/research/STACK.md .planning/spikes/004-ghcr-hazards/README.md .planning/spikes/MANIFEST.md " && git grep -q -F ".planning/ARCHITECTURE-DECISION.md" -- docs/trust-and-security.md && git grep -q -F "ARCHITECTURE-DECISION.md control C1" -- packages/github-cache/src/backend/actions-cache-backend.ts && test -f .planning/ARCHITECTURE-DECISION.md && test "$(git status --porcelain .planning/milestones | wc -l)" = "0" && test "$(git status --porcelain .planning/spikes/005-cross-os-roundtrip | wc -l)" = "0"</automated>
  </verify>
  <done>The gate greps BARE `Decision [0-9]` - not just the `ADR `-prefixed or filename-adjacent
form - across all of `.planning`, excluding four paths only: `milestones/` (D-04), `quick/` (this
task's own artifacts), the ADR itself (C10's verbatim row legitimately cites one, gated separately
in Task 2), and the sealed `spikes/005-cross-os-roundtrip/` record. It returns zero, so all seven
live sites including both MANIFEST.md lines are re-pointed. The inbound gate asserts the exact
sorted FILE LIST, not a count - a count of 9 also passes a simultaneous +1/-1 (e.g. REQUIREMENTS.md
gains the filename while research/STACK.md loses it), which violates D-05 while looking clean. The
list must be exactly: PROJECT.md, ROADMAP.md, STATE.md, codebase/CONCERNS.md,
research/ARCHITECTURE.md, research/FEATURES.md, research/STACK.md,
spikes/004-ghcr-hazards/README.md, spikes/MANIFEST.md. Both out-of-tree references resolve.
Neither `.planning/milestones/` nor `.planning/spikes/005-cross-os-roundtrip/` is modified.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Security documentation -> shipped code | `actions-cache-backend.ts:88` and `docs/trust-and-security.md:15` treat the ledger as the source of truth for the CREEP posture; a silent edit to it changes what "settled" means. |
| `.planning/` docs -> future planners | Planners and the milestone audit read these artifacts as authority; a false or dangling pointer propagates into future phase plans. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-pjz-01 | Tampering | C1-C18 ledger in `.planning/ARCHITECTURE-DECISION.md` | high | mitigate | The rewrite preserves the 18 rows BYTE-IDENTICAL; Task 2's gate compares their sha256 against `bb8cd9515a8e1477ea557ebc3aa5ce820fbc032744b2459e9b80fa2b44d1ce2f`. A reword, an ASCII fold or a dropped row fails the task. If the hash differs, diff the rows before accepting - only a line-ending delta is benign. |
| T-pjz-02 | Repudiation | The 7 removed sections + the MOVEd Nx contract section | high | mitigate | Task 1 gates removal on a per-CLAIM executed battery (36 positive assertions + 8 negative probes), recorded row-by-row in COVERAGE.md; Task 2 then gates on all 18 residue tokens being present in the slimmed file. No claim is removed on assumption, and no claim is removed at all unless it is proven to live somewhere else. Three ways a probe can lie, all closed: a single term standing in for a list; a term that only matches a shipped-requirements checklist tick (assertions 05/06/17 are pointed at substantive prose instead); and a negative probe built from the ADR's own phrasing, which passes by phrasing accident rather than genuine homelessness (probe the CLAIM, and exclude archived `milestones/` - history is not a home). The MOVE section is audited on the same terms as the REMOVEs, which is how its orphan `zip-slip` parenthetical was caught. |
| T-pjz-03 | Information disclosure | Newly authored prose in a public repo | low | mitigate | All new text is derived from tracked files in this repo; no contact details, credentials or tokens are authored. No new email-shaped token is introduced by this change. |
| T-pjz-04 | Denial of service | Out-of-tree references at `docs/trust-and-security.md:15` and `actions-cache-backend.ts:88` | medium | mitigate | The filename is unchanged (D-03) and Task 3's gate asserts both references still resolve. No test asserts the path string, so the gate is the only guard. |

No package-manager installs occur in this plan, so the package legitimacy gate does not apply.
</threat_model>

<verification>
- Task 1's 36-assertion battery is green BEFORE any removal edit; COVERAGE.md has at least 44
  rows (36 COVERED/SPENT + 8 RESIDUE), every one classified COVERED, RESIDUE or SPENT, and none
  reading UNCOVERED or TODO. The disposition-cell gate tolerates column-aligned padding.
- The 18 control rows hash to the pre-change value after the rewrite.
- `.planning/ARCHITECTURE-DECISION.md` retains its filename, contains no `## Decision N` heading,
  and carries all 18 residue tokens under `## Residual notes` plus the retained `## References`.
- `Decision [0-9]` matches exactly one line in the slimmed ADR - C10's verbatim ledger row.
- The ADR contains no reference to its own filename, so the inbound count is unaffected by it.
- `PROJECT.md ## Constraints` gained exactly one `**Nx contract**` row, ASCII separator, carrying
  the hard Nx 21+ floor plus a `.planning/research/STACK.md` pointer rather than a third copy of
  the contract table; the task-runner exclusion still appears exactly once in the file.
- The PROJECT.md Key Decisions pointer row names the ledger and its milestone cadence; nothing
  was written to `## Evolution`.
- A BARE `Decision [0-9]` grep over `.planning` returns zero outside `milestones/`, `quick/`, the
  ADR, and the sealed `spikes/005-cross-os-roundtrip/` record; the inbound reference SET (not
  merely its count) is byte-identical to the 9-file list; both out-of-tree references resolve.
- `git status --porcelain` is empty for both `.planning/milestones` and
  `.planning/spikes/005-cross-os-roundtrip`.
- No file under `packages/` is modified - this plan changes documentation only.
</verification>

<success_criteria>
`.planning/ARCHITECTURE-DECISION.md` holds the C1-C18 ledger, the residue that has no canonical
home, and nothing that duplicates a canonical artifact; every removed claim was proven redundant
before it was removed and every claim that was not is still readable in the file; the nine
existing inbound links describe what the file actually contains; the extracted Nx contract and
the ledger pointer both sit under a milestone checklist item that really runs.
</success_criteria>

<output>
Create `.planning/quick/260726-pjz-audit-triage-extract-and-deduplicate-arc/260726-pjz-SUMMARY.md`
when done. Record: the COVERAGE.md disposition per CLAIM (COVERED / RESIDUE / SPENT counts), which
claims were retained as residue and why, the ledger hash before/after, and the final inbound-link
SET (the nine paths, not just the number).

Name `.planning/research/STACK.md` section 1 explicitly as the SECOND, more detailed copy of the
Nx contract, so a future reader who finds the trimmed `## Constraints` row knows where the
endpoint/status table and the `202`->`200` drift analysis live and does not re-inflate the row.

Two deferred follow-ups, both needing an interactive decision:

1. From D-03 - the rename to `THREAT-MODEL.md`/`CONTROLS.md` is deliberately NOT done here (note
   that it would gain nothing on W019, which fires for any non-canonical root `.md`).
2. Carried out of the Nx contract section - the Nx client hardens tarball extraction against
   `..`/absolute/symlink/hardlink escape, so a malicious server cannot zip-slip the client. The
   original text flagged this as "worth a docs note" and nothing was ever written; the claim is
   preserved in the ADR's `## Residual notes`, but the recommendation is a candidate paragraph
   for `docs/trust-and-security.md` and is out of scope here (this task reorganises existing
   documentation, it does not author new consumer docs).
</output>
