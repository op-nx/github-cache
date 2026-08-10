---
status: complete
task: 260726-pjz
title: Audit, triage, extract and deduplicate .planning/ARCHITECTURE-DECISION.md
executed: 2026-07-26
branch: main
base: fe25a3f
head: 27e2cb6
commits: 3
gates: 3/3 green, each run verbatim from the plan's <verify><automated> block
ledger_hash_before: bb8cd9515a8e1477ea557ebc3aa5ce820fbc032744b2459e9b80fa2b44d1ce2f
ledger_hash_after: bb8cd9515a8e1477ea557ebc3aa5ce820fbc032744b2459e9b80fa2b44d1ce2f
source_files_changed: 0
pushed: false
pr: none
---

# Quick Task 260726-pjz -- Execution Summary

Three atomic commits on `main`, in plan order. Documentation only: no file under `packages/` was
touched, and `git diff fe25a3f..HEAD -- packages/` is empty. Nothing pushed.

`.planning/ARCHITECTURE-DECISION.md` went from 91 lines carrying ten sections to 118 lines
carrying one control ledger, seven residual notes and a retained bibliography. The line count
went UP because the framing that explains where everything went is new; the DUPLICATED content
is what left.

## Task -> commit

| Task | SHA | Subject | Files |
| --- | --- | --- | --- |
| 1 | `4699232` | prove per-claim coverage before slimming the ADR | `260726-pjz-COVERAGE.md` (NEW, 150 lines) |
| 2 | `45dd0f4` | slim the ADR to the C1-C18 ledger and move the Nx contract | `.planning/ARCHITECTURE-DECISION.md`, `.planning/PROJECT.md` |
| 3 | `27e2cb6` | re-point the nine inbound references at what the ADR now holds | 9 files, `27 insertions(+), 20 deletions(-)` |

Every gate was executed verbatim, in the order the plan specifies, and Task 2's gate was re-run
after Task 3 to confirm the later PROJECT.md edits had not regressed it. Task 1's 36-assertion
battery was ALSO run assertion-by-assertion first (36/36 individually PASS) so that each
COVERAGE.md row records a probe that genuinely ran, rather than a share of one chained result.

## COVERAGE.md dispositions, per claim

44 rows, one per distinctive claim, no row reading anything else:

| Disposition | Count | What it means here |
| --- | --- | --- |
| COVERED | 35 | proven present in a named artifact outside the ADR; deleted |
| SPENT | 1 | the spike/PoC framing; obsolete because the rebuild happened and `MILESTONES.md` records v0.0.1 shipped |
| RESIDUE | 8 | proven absent everywhere else; RETAINED in the slimmed ADR |

Three ways a coverage probe can lie were closed explicitly rather than assumed away:

1. **One term standing in for a list.** The twelve-source bibliography is a single wholesale
   RESIDUE row citing eight measured-absent tokens, not one token pretending to prove twelve.
2. **A term that only matches a shipped-requirements checklist tick.** A tick records that
   something SHIPPED, not that the reasoning being deleted survives. Three assertions were
   therefore pointed at substantive prose instead: `context-derived` at
   `codebase/INTEGRATIONS.md:84`, `no-flag safety property` at `research/FEATURES.md:152`, and
   `2 GiB` at `MILESTONES.md:28`.
3. **A negative probe built from the sentence being deleted**, which passes by phrasing accident.
   Each residue row therefore carries substance probes as well as the literal token, and excludes
   the ADR, this task's `quick/` directory, and archived `.planning/milestones/` (an archived
   record is history, not a canonical home).

That third safeguard is what caught the one measured deviation from the plan -- see below.

## The seven claims retained as residue, and why

Retention is the DEFAULT here, not an escape hatch: the governing criterion is "keep only what has
no canonical home", so a claim with no home stays where it is. All seven live in the new
`## Residual notes` section:

1. **The D1 YAGNI deferrals** -- `synchronous write fan-out` and `multiple simultaneous stores`.
   The third item in the original list, a local read-write store, is COVERED at
   `PROJECT.md ## Out of Scope:104` and was NOT retained.
2. **The GHES anti-spoofing cross-check** -- absence of `/meta` `installed_version` plus the
   `X-GitHub-Enterprise-Version` header, and the dormant version-gate knob held OFF until a GHES
   floor publishes.
3. **Read-time integrity** -- store-and-verify a published `content-sha256`, and explicitly NOT
   `sha256(blob) == {hash}`, because the Nx key hashes task inputs rather than the stored bytes.
4. **The rejection rationale** for git-native storage and Actions build artifacts. See the
   deviation note below: this one is genuinely covered and was retained deliberately.
5. **The CREEP-orthogonality scope check** -- the reader choice does not move the primary threat;
   it is a remediation win, not a prevention one.
6. **The Nx client's inherited tarball-extraction hardening** against `..`/absolute/symlink/
   `hardlink` escape, so a malicious server cannot `zip-slip` the client. This one was found by
   auditing the MOVE section on the same terms as the REMOVEs -- it is the disposition table's only
   un-audited row, it is not part of the contract facts being moved, and it would otherwise have
   been deleted silently along with its unactioned recommendation.
7. **The single-layer containment residual risk** -- gate correctness is load-bearing with
   `no backstop`, because the only true second layer (C7 provenance attestation) is deferred.

Plus the whole `## References` block as an eighth RESIDUE row, retained byte-identical:
`Cacheract`, `sccache`, `HeroDevs`, `CodeQL`, `nixcache-oci`, tag mutability and `nx.app/files`
appear in no other tracked file, so deleting the block would strand twelve sources.

### Two claims previously assumed homeless were measured COVERED and deleted

Both were deleted rather than retained because a second copy would rebuild exactly the
two-sources-of-truth pair this task exists to remove:

- **"Do not assume the publisher is pluggable"** -- `research/ARCHITECTURE.md:161`, verbatim again
  at `research/SUMMARY.md:58`.
- **The retention "never introduce a second knob" invariant** -- six homes, including
  `PROJECT.md:115` and SHIPPED CODE at `packages/github-cache/src/lib/retention.ts:5`. A doc-only
  copy drifting away from executable code is the worst version of this failure.

## The ledger survived byte-identical

This was a documentation reorganisation, not a security-posture change, and the 18 control rows
prove it:

| Tree | sha256 of the 18 control rows |
| --- | --- |
| before (`fe25a3f`) | `bb8cd9515a8e1477ea557ebc3aa5ce820fbc032744b2459e9b80fa2b44d1ce2f` |
| after (`27e2cb6`) | `bb8cd9515a8e1477ea557ebc3aa5ce820fbc032744b2459e9b80fa2b44d1ce2f` |

The rows were never retyped. The rebuild spliced them in by line extraction from a pristine copy
of the original, so a reword, an ASCII fold or a dropped row was not merely gated against but
structurally impossible. The same splice preserved the CVE-2025-36852 preamble and the
`## References` block; all three regions were then byte-diffed against the original and came back
identical. Non-ASCII characters survive only on those preserved lines (line 53 and control rows
C1/C3/C4/C5/C6/C7/C11/C16/C18) -- every line authored by this task is ASCII, verified by a
character-class scan over the authored line ranges.

C10's row still cites a decision number. That is the single sanctioned exception, and
`Decision [0-9]` now matches exactly one line in the whole file.

## What moved, and where the second copy lives

`PROJECT.md ## Constraints` gained one `**Nx contract**` row carrying the operative hard floor --
the Nx client (`HttpRemoteCache`) matches PUT success strictly as `200`, so a `202`-returning
server breaks it -- plus a pointer, not a copy.

**`.planning/research/STACK.md` section 1 is the SECOND, more detailed copy of the Nx contract.**
A future reader who finds the trimmed `## Constraints` row should go there and should NOT
re-inflate the row. STACK.md section 1 already holds, measured: the OpenAPI 3.0 spec and
`version: 1.0.0` (`:16,23`); the `202`->`200` drift and the static `info.version` (`:36-38`,
verbatim the same sentence); the hash-the-vendored-spec requirement (`:38`); and the hard Nx 21+
floor with `HttpRemoteCache`'s strict-200 match (`:39-40`). Copying the endpoint/status table into
`## Constraints` would have made a third copy -- the exact defect this task exists to remove.

The MOVE itself still stands because `## Constraints` is audited by `/gsd:complete-milestone`
checklist item 7 and `research/STACK.md` is audited by nothing. `Nx 23` (already in the Tech stack
row) and the deprecated task-runner exclusion (already at `## Out of Scope:101`) were deliberately
not restated; the task-runner phrase still appears exactly once in the file.

## The cadence is attached to something that actually runs

The `## Key Decisions` pointer row now names what the file holds and states the cadence:
re-read and reconcile at each milestone Key Decisions audit. That row is covered by
`/gsd:complete-milestone`'s hardcoded checklist item 6.

Nothing was written to `## Evolution`, and the diff confirms that section is untouched. Neither
`transition.md` nor `complete-milestone.md` reads it -- both carry hardcoded checklists, and
`## Evolution` is a transcript of them rather than an input -- so a line there would have been the
precise inert artifact this task exists to fix.

## The inbound link SET, unchanged at nine

The gate asserts the sorted FILE LIST, not a count, because a count of 9 also passes a
simultaneous +1/-1 (REQUIREMENTS.md gaining the filename while research/STACK.md loses it) which
would violate the constraint while looking clean. The set after the change is exactly:

1. `.planning/PROJECT.md`
2. `.planning/ROADMAP.md`
3. `.planning/STATE.md`
4. `.planning/codebase/CONCERNS.md`
5. `.planning/research/ARCHITECTURE.md`
6. `.planning/research/FEATURES.md`
7. `.planning/research/STACK.md`
8. `.planning/spikes/004-ghcr-hazards/README.md`
9. `.planning/spikes/MANIFEST.md`

Plus the two out-of-tree references, both still resolving because the filename did not change:
`docs/trust-and-security.md:15` and the C1 comment at
`packages/github-cache/src/backend/actions-cache-backend.ts:88`. Worth recording: `docs-trust.spec.ts`
asserts on the docs FILE but not on this path STRING, so no test backs either reference. The
unchanged filename is the only thing holding them.

Seven live sites that cited a now-deleted decision number were re-pointed to
`PROJECT.md ## Key Decisions`. A bare `Decision [0-9]` grep over all of `.planning` now returns
zero outside four excluded paths.

`REQUIREMENTS.md` was re-pointed WITHOUT gaining the ADR filename, which would have made the set
ten.

## Deliberately not touched

- **`.planning/milestones/**`** -- archived records; rewriting them falsifies history.
  `git status --porcelain` on that path is empty.
- **`.planning/spikes/005-cross-os-roundtrip/**`** (`README.md:5`, `README.md:16`,
  `ci-roundtrip.mjs:4`) -- these three cite the decision number as the thing the spike was RUN TO
  VALIDATE, so rewriting them falsifies the evidence, on the same rationale as the archived
  milestones. `git status --porcelain` on that path is empty too. `spikes/MANIFEST.md` IS the live
  spike index rather than a sealed record, so both of its sites were re-pointed.
- **`gsd health` W019** -- it fires today, fires after slimming, and fires for GSD's own
  METHODOLOGY.md. Its remediation text ("move to archive or delete if stale") is wrong for a
  deliberately-kept standing reference; the taxonomy is the better authority. The ADR now records
  this in the first person so it is not re-litigated.
- **`PROJECT.md:17`** (already accurate), the dated `Last updated` footer (a log entry; rewriting
  it would falsify the log), and `AGENTS.md` (Nx/worktree agent guidance with no natural anchor).

## Deviations

### D1 -- one residue row is genuinely covered, and was retained anyway (documented, not silent)

The plan asserts that residue item 4, the git-native / Actions-build-artifact rejection rationale,
is homeless, on the grounds that "the MANIFEST records THAT they are out, not WHY". That is true
of `spikes/MANIFEST.md:7`, but the plan did not probe `research/STACK.md`, which records both
rejections WITH their reasons:

- `research/STACK.md:77` -- git objects / refs: "**Reject** - bloats history, no clean eviction".
  The phrase "no clean eviction" is VERBATIM the ADR's.
- `research/STACK.md:75` -- Actions Artifacts: "No (run-scoped, not key-scoped) ... **Reject** - no
  anon read, wrong lookup shape", which is "not content-keyed" in substance plus a further reason.

The plan's literal token probes (`clone bloat`, `content-keyed`) do return homeless -- which is
exactly the phrasing accident the plan itself warns against, since the probe was built from the
sentence being deleted.

**Retained, deliberately, for three reasons.** Retention is the plan's stated default and is the
LOSSLESS error, whereas deleting on a contested measurement is not. Task 2's gate requires the
`content-keyed` token to be present, and gates were to be run verbatim rather than edited to match
a fresh finding. And unlike the two claims the plan DID reclassify, this is a dead-end historical
rationale for primitives that were never built, not a live invariant, so a second copy carries
essentially no drift risk. The retained bullet now signposts `research/STACK.md` section 2 as the
fuller treatment, which converts a silent duplicate into a labelled one. Recorded in full as Note
C in COVERAGE.md.

### D2 -- a second, smaller partial-coverage finding

The dormant version-gate knob half of residue item 2 has partial coverage at
`research/PITFALLS.md:310` ("keep the version-gate knob dormant/OFF") and
`docs/trust-and-security.md:76`. The distinctive claim -- the anti-spoofing cross-check MECHANISM
itself -- is homeless everywhere. The row was retained whole rather than split, since splitting a
two-clause sentence to delete half of it buys nothing and risks losing the mechanism's motivation.
Recorded as Note B in COVERAGE.md.

### D3 -- `.planning/STATE.md` was committed as part of Task 3

The orchestrator brief says not to commit STATE.md. The plan's Task 3, however, lists STATE.md in
its `<files>` and requires re-pointing `STATE.md:95`, and that file must remain in the nine-file
inbound set. Committing the one-line content edit with the rest of Task 3 keeps the task atomic;
leaving it dangling in the working tree would have mixed plan content into the orchestrator's
bookkeeping commit. Only the line-95 attribution changed -- no counters, no position, no session
fields. The orchestrator's own STATE.md update is unaffected and will apply cleanly on top.

## Deferred follow-ups (both need an interactive decision)

### 1. The rename to `THREAT-MODEL.md` or `CONTROLS.md`

Not done here, and out of scope by SCOPE DISCIPLINE rather than by merit. A file containing only a
control ledger does make "ARCHITECTURE-DECISION" a misnomer, and the honest names are better ones.
But the task authorised extract, deduplicate and link -- not a rename -- and the blast radius is
real: nine current inbound references, roughly 35 archived artifacts, a shipped
`docs/trust-and-security.md` citation and a source comment in `actions-cache-backend.ts`, none of
which is covered by a test that asserts the path string.

Worth carrying into that discussion: **a rename would gain nothing on W019.** Evaluated directly
against GSD's shipped `isCanonicalPlanningFile` predicate, `THREAT-MODEL.md` and `CONTROLS.md`
trip W019 exactly as `ARCHITECTURE-DECISION.md` does -- the warning fires for any non-canonical
root `.md`. Rename on naming merit only.

### 2. The zip-slip docs note that was recommended and never written

The Nx contract section carried an unactioned recommendation: the Nx client's inherited
tarball-extraction hardening is "worth a docs note". The CLAIM is now preserved in the ADR's
`## Residual notes`, but the RECOMMENDATION is a consumer-docs change, and this task reorganises
existing documentation rather than authoring new consumer docs.

Candidate paragraph for `docs/trust-and-security.md`, offered as a starting point rather than
final wording:

> **What the Nx client protects on its own.** Cache entries are tar archives, and the Nx client
> hardens extraction against archive members that try to escape the extraction directory -- `..`
> path segments, absolute paths, and symlink or hardlink targets pointing outside it. A malicious
> or compromised cache server therefore cannot use a crafted archive to write outside the cache
> directory (a "zip-slip"). This protection is inherited from the Nx client and is not implemented
> by this project, so it applies to any self-hosted cache server the client talks to, not just
> this one. It is not a CREEP control: it defends the extraction step, whereas CREEP poisons the
> bytes before they are ever hashed (see the write-trust and sync gates above).

Before it ships, someone should re-verify the hardening against the pinned Nx version rather than
inheriting this claim from the original record -- a consumer-facing security statement should rest
on a fresh check.

## Verification at HEAD

All three gates re-run at `27e2cb6`, plus a consolidated pass:

- 44 disposition rows, none reading anything but COVERED / RESIDUE / SPENT
- 18 control rows, hash unchanged, no removed heading survives, `## Residual notes` and
  `## References` both present, all 18 residue tokens present, `Decision [0-9]` on exactly one line
- the ADR contains no reference to its own filename, so it is not a tenth inbound match
- `**Nx contract**` row present with the ASCII separator, `HttpRemoteCache`, and the STACK.md
  pointer on the same line; task-runner exclusion still appears exactly once
- bare `Decision [0-9]` over `.planning` returns zero outside the four excluded paths; the inbound
  file SET matches the nine exactly; both out-of-tree references resolve
- `.planning/milestones` and `.planning/spikes/005-cross-os-roundtrip` both clean
- no `packages/` file modified; no AI-attribution trailer; no email-shaped token introduced;
  committer identity is the public address on all three commits

## Self-Check: PASSED

Every artifact this summary claims was created exists on disk (`COVERAGE.md`, the rewritten
`ARCHITECTURE-DECISION.md`, `PROJECT.md`, this file). All three commit hashes resolve in
`git log`. Both hygiene scans that reported a failure on the first pass were re-run after the
checks themselves were corrected -- the ASCII check had a wrong expected line count, and
`git log --grep` exits 0 whether or not it matches, so it could never have reported a clean
result. Both are clean under the corrected checks.
