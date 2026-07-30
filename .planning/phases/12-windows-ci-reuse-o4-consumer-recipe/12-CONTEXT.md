# Phase 12: Windows CI Reuse (O4) + Consumer Recipe - Context

**Gathered:** 2026-07-30
**Status:** Ready for planning
**Mode:** `--analyze --auto --chain` (trade-off tables recorded in `12-DISCUSSION-LOG.md`;
recommended option auto-selected per area; one HIGH-impact / NOT-HIGH-confidence item withheld
from auto-lock and recorded as UNRESOLVED for `gsd-phase-researcher`)

<domain>
## Phase Boundary

The LAST phase of v0.0.2. Windows CI reuses Linux CI's portable task artifacts, and an outside
project can copy the recipe without inheriting a wrong-result risk.

Four things, and nothing else:

1. **XOS-04 -- the Windows legs exist.** `ci.yml` runs `build`, `typecheck` and `test` on
   `windows-11-arm` in addition to the ubuntu leg. Without them there is no Windows job that
   could exhibit O4's HIT.
2. **XOS-08 -- the producer-to-consumer ordering.** Those legs declare `needs:` on the
   corresponding ubuntu jobs, mirroring `dogfood-seed` -> `dogfood-verify`. The `integration`
   matrix is NOT the precedent: its two legs compute DIFFERENT hashes so parallelism is harmless,
   whereas the new legs compute the SAME hash and in parallel would both MISS, both execute, and
   race `saveCache`. The cross-push alternative is foreclosed too -- once PARITY-08 landed, the
   very commit that ADDS these legs invalidates the `test` hash.
3. **XOS-05 -- the O4 proof and the write decision.** Those legs log `[remote cache]` for all
   three targets against entries the ubuntu leg saved. Whether they also WRITE is an EXPLICIT
   RECORDED decision; if they write, the attribution loss is recorded alongside TRUST-11/12 AND
   the conditional clause fires: a scheduled `--skip-nx-cache` windows-11-arm job becomes
   REQUIRED rather than optional.
4. **DOCS-07 -- the consumer recipe.** Safe-by-default first (declare the discriminator on all
   cacheable targets, then remove per target only after proving portability); the portability
   checklist SECOND, framed as how to EARN a removal, with items derived from PARITY-01's
   root-cause record. It names architecture and libc as axes `process.platform` does not cover
   and states this repo cannot exercise them (every machine here is arm64). The documented
   discriminator command is stderr-immune, and the recipe is a `test` input and drift-guarded.

**Not in this phase.** Collapsing the publish matrix to one leg (explicitly out of scope for the
milestone until XOS-05 is proven, and then a follow-on decision). Read-fallback across old and
new asset names. Any per-job or per-target OS-invariance knob (D2-02, and the stronger "wrong
layer" reason). An empirical divergence-detection subsystem (structurally impossible: every
detector that exists re-executes the task). Archive file-mode handling across the OS boundary
(carried as an XOS-05 INVESTIGATION item, never as a requirement). macOS in any form. Any new
env knob, action input or package export (D2-02, PARITY-07).

</domain>

<decisions>
## Implementation Decisions

### BLOCKING PRE-FLIGHT: the requirement count, and the tooling trap

- **D-00 [informational]:** `gsd-tools query init.plan-phase 12` returns all **FOUR** IDs.
  MEASURED this session. The same residual trap as Phases 10 and 11: the last ID comes back as
  **`DOCS-07.`** with a trailing period, because the parser takes the `**Requirements**:` line to
  its end including sentence punctuation. Do not `rg` for the literal `DOCS-07.` and do not write
  it into an artifact that way. The authoritative list is **XOS-04, XOS-05, XOS-08, DOCS-07** --
  pass it EXPLICITLY to the researcher, the planner, the plan-checker, the coverage gate, the
  security auditor and the verifier.

- **D-01 [informational] -- ROADMAP.md UNDERCOUNTS this phase, and REQUIREMENTS.md wins.**
  MEASURED this session:

  | Source | Says |
  |---|---|
  | `ROADMAP.md:531` `**Requirements**:` line | XOS-04, XOS-05, **XOS-08**, DOCS-07 -- FOUR |
  | `ROADMAP.md:609-611` Traceability table | XOS-04, XOS-05, DOCS-07 -- THREE, **XOS-08 row missing** |
  | `ROADMAP.md:624` Coverage Validation | "Phase 12: 3 (XOS-04, XOS-05, DOCS-07)" -- THREE |
  | `ROADMAP.md:684` | "Phase 12 is intentionally light (3 requirements)" -- THREE |
  | `REQUIREMENTS.md:658-661` Traceability | XOS-04, XOS-05, **XOS-08**, DOCS-07 -- FOUR |
  | `REQUIREMENTS.md:663-665` Coverage | "Phase 12 = 4" |

  This is the SAME defect class Phase 10 caught (a missing traceability row) and Phase 8 caught
  (stale numbering). ROADMAP's own SC1 cites `(XOS-04, XOS-08)`, so the section text and its
  traceability table contradict each other inside one file. **Audit coverage against
  REQUIREMENTS.md's words: FOUR.** Do not let a coverage gate reading ROADMAP's table report
  XOS-08 as an orphan or as out-of-phase.

> **Why D-00 and D-01 are tagged `[informational]`.** Both are ORCHESTRATOR pre-flight
> instructions about artifact and tooling behaviour, not implementable behaviour -- an executor
> cannot "build" either one. Both were ACTED ON at discuss time: the authoritative four-ID list is
> stated above, and every coverage audit in this phase runs against REQUIREMENTS.md. Tagged per
> the decision-coverage gate's own documented resolution, not to dodge it.

### The wiring shape (XOS-04, XOS-08)

- **D-02 -- THREE dedicated jobs, not a matrix and not one combined job.** Add
  `build-windows`, `typecheck-windows` and `test-windows`, each `runs-on: windows-11-arm`, each
  declaring `needs:` on its ONE corresponding ubuntu job (`build`, `typecheck`, `test`
  respectively). Grounds, in order of weight:

  1. A matrix is STRUCTURALLY foreclosed. `needs:` is per-JOB, never per-LEG, so a matrix leg
     cannot depend on its sibling. XOS-08 requires exactly that dependency.
  2. XOS-08's own words name `dogfood-seed` -> `dogfood-verify` as the mirror, which is two
     separate jobs, and SC1 says "the corresponding ubuntu jobs" -- 1:1, not 3:1.
  3. It matches the repo's shipped convention of a distinct named job per concern
     (`format-check`, `lint`, `fallow`, `action-bundle-drift`, `pack-check`), so a Windows-only
     `typecheck` regression reddens a leg whose NAME says `typecheck-windows`.
  4. Each Windows leg starts as soon as its own producer finishes, rather than all three waiting
     on the slowest.

  The lazier alternative was weighed and NOT taken: ONE `windows-reuse` job with
  `needs: [build, typecheck, test]` running all three targets through a single sidecar. It costs
  one new sidecar block instead of three (5 copies of the duplicated block instead of 7), but it
  collapses three independent `[remote cache]` observations into one job log, delays every target
  behind the slowest producer, and reads "corresponding jobs" loosely. Recorded here so a planner
  does not re-derive it; see the Deferred Ideas entry on the block-drift guard for the cost this
  choice takes on.

- **D-03 -- the sidecar block is COPIED VERBATIM, and the invariant is restated, not weakened.**
  `ci.yml` carries an explicit unguarded invariant: "The EXECUTABLE shell must stay identical
  across all four wired jobs -- only the final `npm run <target>` line may differ, and only
  build's copy carries extra comments." This phase takes it from FOUR wired jobs to SEVEN. The
  block already declares `shell: bash` everywhere and takes its token from `node` rather than
  `openssl` FOR the Windows runner (`ci.yml`'s `integration` comment records both reasons), so it
  is already Windows-correct and needs no adaptation. Update the invariant comment's count and its
  job list in the SAME commit that adds the legs.

- **D-04 -- port 3000 on every new leg, unchanged.** Each job is its own isolated runner; the
  `integration` matrix comment already records this. No port allocation scheme, no new input.

- **D-05 -- `timeout-minutes` on each new leg, matching its ubuntu counterpart's 15.** Generic
  hang insurance, the reason already comment-locked above the `build` job. Not a teardown
  workaround.

### The XOS-05 write decision: they WRITE, and it is forced rather than chosen

- **D-06 (MEASURED against `packages/github-cache/src/lib/select-backend.ts` this session):**
  **The Windows legs WRITE. There is no read-only-but-still-reading configuration available, and
  D2-02 forbids creating one.** The measurement, from the source:

  | Configuration | `selectBackend` returns | Consequence for O4 |
  |---|---|---|
  | write-trusted event + valid `GITHUB_REPOSITORY` + token | `createActionsCacheBackend()` | reads AND writes -- the only shape that can HIT |
  | write-trusted event + valid repo + **no token** | `createReadOnlyMemoryBackend()` | an EMPTY backend: every read MISSes, so O4 is unprovable |
  | not write-trusted | `createReleasesReadBackend(...)` | the Releases mirror, not the Actions cache -- the wrong layer for O4 |

  Withholding `GITHUB_TOKEN` from the Windows legs does NOT buy a read-only Actions cache; it
  buys an empty in-memory one. TRUST-05 forbids a caller-facing mode flag and D2-02 forbids a new
  env knob or action input, so a read-only Actions-cache branch cannot be added in this phase.
  The decision is therefore recorded as FORCED, with its reasoning, not presented as a preference.

- **D-07 -- the two consequences fire, and both are Phase 12 scope.** XOS-05's own words:
  1. **The attribution loss is recorded alongside TRUST-11/12.** Append to Phase 10's threat-model
     record (`.planning/THREAT-MODEL.md` and/or
     `.planning/phases/10-os-invariant-releases-mirror/10-SECURITY.md`'s TRUST-11 section --
     the planner picks the surface, the record is not optional). TRUST-11 already predicted this:
     "The real race appears only once XOS-04 puts `build`/`typecheck`/`test` on a Windows leg: two
     jobs then compute the same hash H and both call `saveCache(nx-cache-H)`, and the winner owns
     the entry INCLUDING its OS-specific captured terminal output." The `needs:` ordering of D-02
     is what removes the RACE; it does not remove the second-producer fact.
  2. **The scheduled `--skip-nx-cache` windows-11-arm job becomes REQUIRED** (D-08).

- **D-08 -- the regression detector: a NEW workflow file, not a job in `ci.yml`.**
  `.github/workflows/windows-regression-detector.yml` (name at Claude's discretion), with:

  - `on: schedule` (a daily cron off the top of the hour -- `cleanup.yml`'s `'17 3 * * *'` is the
    in-repo precedent and its stated reason, GitHub delaying scheduled runs under load, applies
    identically) **plus `workflow_dispatch`**.
  - One `windows-11-arm` job running the three targets with `--skip-nx-cache`.
  - **NO sidecar block.** `--skip-nx-cache` bypasses remote read AND write, so a cache server
    would be dead weight and a fifth/sixth/seventh cache producer this milestone does not want.
  - **Hard fail, not a warning.** This is the one place in the phase where a gate is correct: a
    red leg here means a genuine Windows-only regression in the code under test, never correct
    work. It is NOT the "tripwire that fires on correct work" class OBS-04 records.

  `on: schedule` fires only on the default branch, so the job cannot be proven from the phase
  branch. **CORRECTED 2026-07-30 by `12-RESEARCH.md` Correction 2 -- the original text here claimed
  `workflow_dispatch` "closes the question before merge, at no cost". That is FALSE.** GitHub only
  dispatches a workflow whose file exists on the DEFAULT branch, so a brand-new workflow file on a
  feature branch cannot be dispatched at all -- it does not appear in the UI and the API rejects it.
  `cleanup.yml`, the named shape precedent, carries `schedule:` only.
  **Replacement reason, so the flag is not read as pointless:** keep `workflow_dispatch` because it
  is how the detector gets re-run ON DEMAND AFTER merge -- delete only the "before merge" claim.
  What actually closes the pre-merge risk, in order of cost: (1) prove the COMMAND rather than the
  job -- run `nx run-many -t build typecheck test --skip-nx-cache` on this Windows arm64 workstation
  with the demand-the-success-line guard (RESEARCH F-5 already did this for `test`: 40 files, 856
  tests, exit 0); (2) structurally guard the YAML, with `cleanup-workflow.spec.ts` as the in-repo
  spec-over-a-workflow-file precedent and D-09's registration making it non-stale; (3) treat
  green-on-runner as a POST-MERGE first-run close, which this repo already has by name
  (`.planning/codebase/TESTING.md` `## Live-CI first-push close pattern`; `ppe`, `dogfood-*` and
  `consumer-smoke` are all first-push closes). Do not invent a mechanism.

  Rejected: adding `schedule:` to `ci.yml`. It would fire all nineteen jobs on a schedule unless
  every one of them grew an `if:`, and `cleanup.yml`'s own header already records the reason a
  scheduled concern lives in its own file.

- **D-09 -- if the detector file gets a spec asserting on it, REGISTER IT in `nx.json`'s `test`
  inputs in the SAME commit.** PARITY-08's lesson, in the requirement's own words: `nx.json`
  listed `cleanup.yml` and NOT `ci.yml`, so any spec asserting on `ci.yml` served a stale cached
  PASS. A new workflow file starts out unregistered and repeats the defect exactly.

### DOCS-07: the recipe

- **D-10 -- a NEW `docs/cross-os.md`, not a section inside `docs/advanced.md`.** The repo's docs
  convention is one topic per file (`advanced.md`, `configuration.md`, `trust-and-security.md`,
  `versioning.md`), and this is the milestone's headline consumer deliverable, not an "advanced
  opt-in capability". The lazier alternative -- a section in `advanced.md`, which is ALREADY an
  `nx.json` `test` input and already covered by `docs-adoption.spec.ts` -- was weighed and not
  taken: it would satisfy DOCS-07's registration clause for free, but it buries a safe-by-default
  adoption recipe inside a page about the opt-in Releases reader and publish/cleanup. The cost of
  the new file is one `nx.json` line and one nav link, and this phase pays a `test` rotation
  regardless.

- **D-11 -- section ORDER is load-bearing and is fixed by the requirement.** Safe default FIRST
  ("declare the platform discriminator across ALL cacheable targets, then remove it per target
  only after proving that target's output is portable"), portability checklist SECOND, framed as
  how to EARN a removal. A reader who stops after section one must land on the safe
  configuration. Do not lead with the checklist, do not merge the two.

- **D-12 -- the checklist items are INHERITED, not re-derived.**
  `.planning/phases/08-nx-task-hash-parity/08-ROOT-CAUSE.md` `## Hand-off to Phase 12 (DOCS-07)`
  (`:1777-1828`) writes them out explicitly so Phase 12 inherits a list rather than a re-read.
  Items 1-5 ship; **item 6 is a STRUCK, FALSIFIED claim and its own text says what to document
  instead: NOTHING.** Reproduced here so no planner re-imports the struck text:

  | # | Item | Ships? |
  |---|---|---|
  | 1 | A warm local box does NOT compute the hash cold CI published; mitigation is a full `nx reset` | yes |
  | 2 | The reset is needed AFTER the fix commit, not only before -- a persisted plugin cache does not self-heal | yes |
  | 3 | Deleting the repo's `.nx/` does NOT produce a cold state (the native file cache lives under the OS temp dir); and at Nx 23.1.0 `sharedCacheDirectory()` resolves the MAIN worktree root | yes |
  | 4 | Document the FULL `nx reset`, never `--onlyWorkspaceData` (it does not kill the daemon; `EPERM` on Windows) | yes |
  | 5 | To REPRODUCE rather than repair, use `NX_WORKSPACE_DATA_DIRECTORY` + `NX_NATIVE_FILE_CACHE_DIRECTORY` -- non-destructive, and cold BY CONSTRUCTION rather than by an operation that can fail | yes |
  | 6 | ~~"a developer who has BUILT computes a different `typecheck` hash"~~ | **NO -- measured FALSE; document nothing** |

- **D-13 -- the two axes `process.platform` does not cover are named, with the honest limit
  stated.** Architecture and libc. The recipe states plainly that THIS repo cannot exercise
  either -- every machine here is arm64 -- so the reader is told the discriminator's coverage
  ends where this project's evidence ends. Requirement's own words; do not soften it into a
  "consider also" bullet.

- **D-14 -- the drift guard is the shipped phrase-keyed pattern, and it is proven RED first.**
  `docs-same-os-claims.spec.ts` (phrase-keyed `DOCS_08_SITES`), `docs-adoption.spec.ts` and
  `docs-trust.spec.ts` are the three in-repo precedents; `docs-trust.spec.ts` is the strongest
  shape because it IMPORTS the single source and asserts the doc renders it verbatim, so widening
  the source trips the build until the doc is updated. Two Phase 11 review findings govern how it
  is written:
  - **A phrase that occurs TWICE is only half-locked.** `toContain` is satisfied by the first
    occurrence, so deleting the other leaves the guard green (WR-09). Assert a COUNT, or key on a
    phrase measured unique.
  - **Observe the red, never predict it.** Mutate the doc, watch the named assertion fail with the
    right cause, revert.

### The discriminator command: direction locked, exact string UNRESOLVED

- **D-15 -- the DOCUMENTED command and `nx.json`'s OWN command are ONE string, single-sourced.**
  Documenting a hardened command the repo does not itself run is the exact defect class DOCS-08
  spent a phase correcting, and it would leave the drift guard unable to assert equality. So
  whatever the stderr-immune form turns out to be (U-01), `nx.json`'s `integration` runtime input
  changes to match it in the SAME commit, and the guard asserts the doc renders the literal that
  `nx.json` carries.
  The rotation cost is affordable and is measured, not assumed: editing `nx.json` rotates
  `integration` (its own input) and `test` (`nx.json` is a `test` input at `:69`). O2 and O3 are
  CLOSED (Phase 11), so no perishable measurement depends on the current `integration` value, and
  CORR-03's gate asserts only that the two legs DIFFER -- which any honest platform read still
  satisfies.

- **U-01 (below) owns the exact string.** It is an empirical question, not a maintainer
  preference.

### Ordering, rotation, and why this phase has NO perishable window

- **D-16 (MEASURED against `nx.json` this session):** the rotation table Phase 11 established
  still holds and is restated because the planner needs it:

  | Edit | Rotates |
  |---|---|
  | `.github/workflows/ci.yml` | **`test` only** -- an explicit `test` input (`nx.json:69`), in no other target's list |
  | `nx.json` | **`test`** (own input) plus whatever target's block changed -- so a discriminator edit rotates `test` AND `integration` |
  | a NEW `docs/cross-os.md` registered as a `test` input | **`test`** |
  | a new file under `packages/github-cache/` | `test`, `typecheck`, `integration` |
  | a new NON-spec source file under `packages/github-cache/src/` | the above plus `build` |
  | a NEW root-level workflow file, unregistered | **nothing** |

- **D-17 -- there is NO ordering constraint of the Phase 10 / Phase 11 kind, and saying so is the
  decision.** Phases 10 and 11 each guarded a PERISHABLE measurement that their own edits would
  destroy. Phase 12 does not: the O4 proof is a SAME-RUN property. The ubuntu producer and the
  Windows consumer both check out the same tree in the same run, the `needs:` edge orders them,
  and the ubuntu leg saves whatever hash the run's own tree computes. So the commit that
  invalidates the `test` hash is the same commit that proves the HIT, and XOS-08's "the very
  commit that adds these legs invalidates the `test` hash" is a reason the CROSS-PUSH shape fails,
  not a constraint on this one. Do not invent a `depends_on` chain to protect a window that does
  not exist -- but DO keep `depends_on` for genuine build-order dependencies.

### The proving run

- **D-18 -- a SAME-REPO pull-request run is the vehicle. NO temporary `main` push.** This breaks
  the Phase 9 / 10 / 11 pattern deliberately, and the reasons are measured rather than assumed:

  | Fact | Measured where | Why it matters |
  |---|---|---|
  | `build`, `typecheck` and `test` are NOT push-gated | `ci.yml` -- no `if: github.event_name == 'push'` on any of the three | they run on PRs, unlike `publish` / `dogfood-*` / `consumer-smoke` |
  | `pull_request` on github.com IS write-trusted | `trust.ts:32-34`, `HOST_GATED_EVENTS` (measured in 11-CONTEXT) | the ubuntu leg genuinely SAVES on a PR run |
  | producer and consumer are in ONE run | D-02's `needs:` edges | no cross-tree commensurability question, which is the ONLY reason O3 needed a push |
  | `o3-witness` and the positive control were GREEN on a PR as well as a push | `11-EVIDENCE.md` calibrated-instruments table | PR-shaped evidence is already established as sound in this repo |

  **CORRECTED 2026-07-30 by `12-RESEARCH.md` Correction 1. The original precondition here read:
  "the proving PR is a SAME-REPO branch PR. GitHub's read-only Actions cache for untrusted triggers
  makes a FORK PR read-only, so the ubuntu leg would save nothing and BOTH legs would MISS." That
  premise is FALSE.** The 2026-06-26 changelog says the opposite verbatim: "any trigger that uses a
  non-default-branch scope, such as `pull_request` and `release`, keeps read-write caching
  permission." The read-only rule fires only when an untrusted trigger ALSO runs at the shared
  default-branch scope (`pull_request_target`, `issue_comment`, fork `workflow_run` cascades) -- not
  `pull_request`. A PR run writes into its own merge-ref scope (`refs/pull/N/merge`), and BOTH legs
  of that run share it, which is exactly what O4 needs. This repo already measured it:
  `11-EVIDENCE.md:997` records both entries written under `refs/pull/11/merge`.

  **The REPLACEMENT reason, and it is STRONGER than the false one:** `ci.yml:3-7` is
  `on: push: branches: [main]` plus `pull_request:`. A push to the phase branch does not trigger CI
  AT ALL. So `pull_request` is not the PREFERRED vehicle -- it is the ONLY vehicle short of pushing
  to `main`, which is precisely what this decision declines. Write that reason into the plan.

  Two precise consequences the plan must carry:
  1. **The PR-scope entry is ephemeral and isolated.** The proof seeds neither `main`'s cache scope
     nor the Releases mirror. That is fine (D-17: the proof is a same-run property) -- but SAY so,
     or a reader will look for a mirror row that never appears.
  2. **The proof must come from the FIRST run of the PR, never a workflow RE-RUN.** On a re-run the
     ubuntu leg restores the merge-ref entry the first run saved, so it HITs instead of
     MISS-and-saving; the Windows HIT is still against Linux-produced bytes, but the
     producer attribution WITHIN the run evaporates. Phase 11 applied this same discipline as
     T-11-26 ("Proof taken from a FRESH push, never a workflow re-run"); it transfers verbatim.
     Pre-register it under D-19.

  If the maintainer nonetheless wants a `main` push, the contract is unchanged from Phases 9-11
  (retained backup ref, restore verified by SHA EQUALITY, the restore force-push's own run
  predicted IN ADVANCE) -- but nothing in XOS-04/05/08 requires it.

- **D-19 -- counts are PRE-REGISTERED in the PLAN, not written after the run.** Phase 11's
  pattern, and TEST-08's rule applied to O4. Per target, name in advance: whether the ubuntu leg
  is expected to HIT or MISS-and-save (both are legitimate; `build` does NOT rotate on a
  `ci.yml`-only edit, so its ubuntu leg may well HIT a pre-existing ubuntu-produced entry), and
  the expected non-zero `[remote cache]` occurrence count on the Windows leg. Count OCCURRENCES,
  not lines: `rg -c` counts lines; use `rg -o | wc -l`.

- **D-20 -- `Cache: n/m hit` stays marked NON-DISCRIMINATING IN BOTH DIRECTIONS, beside the
  line.** OBS-02 and Phase 11's D-24, unchanged: a `0%` prints identically with no sidecar at all
  (run `30169158892`), and a non-zero count includes local hits. The gate is the literal
  `[remote cache]` label count, named per target.

### The graph premise: keep the assertion, correct its meaning

- **D-21 (MEASURED against `capture-hashes.mjs` and `ci.yml` this session):** the
  `--assert-graph-premise` mode asserts that `nx run-many -t integration` resolves NO
  `build`/`typecheck`/`test` task. That is a property of the TASK GRAPH, and **XOS-04 does not
  change it** -- the new legs run different commands; they do not alter `integration`'s
  resolution. So the assertion KEEPS PASSING and the `hash-parity` job's step (`ci.yml:1065-1072`,
  both matrix legs, `--out graph-premise-<os>.json`) stays wired and stays a real gate against an
  Nx upgrade changing the inferred `dependsOn`.

  **What XOS-04 destroys is the INFERENCE the assertion fed, not the assertion.** O1's producer
  attribution rested on a CONJUNCTION: (a) the graph premise, AND (b) the fact that Windows CI ran
  only `integration`. XOS-04 falsifies (b) permanently. `11-EVIDENCE.md` says so in its own words:
  "the assertion's subject moves and the flag must be re-read, not re-run blindly."

  **So: keep the code, correct the claim, supply the replacement reason.** In the SAME commit that
  adds the Windows legs, rewrite the evidentiary language in BOTH places -- `ci.yml`'s comment
  block above the premise step, and `capture-hashes.mjs`'s contract comment -- to record that from
  this commit the premise no longer establishes producer attribution, that the attribution record
  is FROZEN at `11-EVIDENCE.md`'s O1 section, and that the assertion now guards only the graph
  property. The repo's own rule, from Phase 11's patterns: "Correcting a claim requires supplying
  a REPLACEMENT reason, or a future reader is left holding a documented argument for undoing the
  work."

### Evidence

- **D-22 -- the O4 section is APPENDED to `11-EVIDENCE.md`. There is no `12-EVIDENCE.md`.**
  Locked upstream and not reopened here: TEST-08's own words are "Phase 12 appends the O4 row to
  the same evidence record", and `11-EVIDENCE.md:1002-1019` carries an explicit
  `## O4 (XOS-04, XOS-05) -- RESERVED` block that says "Do not fill this section and do not delete
  it." FILL that section in place; do not relocate it, do not duplicate it, and update the
  four-row status table at `11-EVIDENCE.md:34` in the same edit. Note the file lives under Phase
  11's directory and is NOT an Nx input, so nothing about it can serve a stale cached PASS -- and
  equally, no spec can usefully guard it (Phase 11's Nyquist audit already declined that).

### Claude's Discretion

- The three Windows job names (`build-windows` / `typecheck-windows` / `test-windows` are the
  obvious form, but any consistent scheme is fine as long as the target is in the name).
- The regression-detector workflow's filename, job name, and exact cron minute.
- Whether the detector runs `nx run-many -t build typecheck test --skip-nx-cache` as one command
  or three steps.
- The `docs/cross-os.md` filename, its heading structure, and where it is linked from
  (`README.md` nav, `docs/advanced.md`, or both).
- Whether the DOCS-07 drift guard is a new spec file or an extension of `docs-adoption.spec.ts`.
- Plan count and wave grouping, subject to D-17 (no perishable-window ordering) and to genuine
  build-order dependencies.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

ROADMAP.md's Phase 12 section carries NO `Canonical refs:` line, so this list is assembled rather
than copied. Every entry is a full relative path.

### Required reading, in this order

- `.planning/REQUIREMENTS.md` -- **FIRST, and it is the authoritative requirement text** (D-01).
  Specifically: `:359-361` (XOS-04), `:363-369` (XOS-05 -- including the conditional
  scheduled-detector clause and the "success signal for O4 is the identical observation" trap),
  `:371-377` (XOS-08 -- why the `integration` matrix does not transfer and why cross-push is
  foreclosed), `:452-459` (DOCS-07), `:248-256` (PARITY-08 -- why `ci.yml` is a `test` input and
  what a spec on an unregistered file does), `:421-437` (TRUST-11 -- it PREDICTS this phase's race
  and names where the residual risk moves), `:439-443` (TRUST-12), `:568-591` (the `Before/After`
  sequencing table, specifically the `XOS-08 -> XOS-05` and `XOS-01 proven -> XOS-04, XOS-05`
  rows), `:592-602` (Out of Scope -- read it; several rows are things a planner would otherwise
  reach for, notably the divergence-detection subsystem and the publish-matrix collapse).
- `.planning/ROADMAP.md` `:519-561` -- the Phase 12 section: goal, depends-on, SC1-SC4, and the
  `Live-CI close` line. **Read its Traceability table (`:609-611`) only with D-01 in hand.**
- `.planning/phases/08-nx-task-hash-parity/08-ROOT-CAUSE.md` `## Hand-off to Phase 12 (DOCS-07)`
  (`:1777-1828`) -- **DOCS-07's checklist items, written out so this phase inherits a list.** Item
  6 is STRUCK and falsified; its own text says to document nothing. Also read
  `## SURFACED, NOT FIXED: AGENTS.md's per-worktree Nx cache claim is false at Nx 23.1.0`
  (`:1832`), which is checklist item 3's second half.
- `.planning/phases/11-live-proofs-o1-o2-o3/11-EVIDENCE.md` -- `## O4 (XOS-04, XOS-05) -- RESERVED`
  (`:1002-1019`) is the section this phase FILLS (D-22); the status table at `:34`; and
  `### The calibrated instruments Phase 12 inherits, by name` (`:1046-1057`), which names the four
  known-good measuring devices and flags that `--assert-graph-premise`'s subject moves (D-21).
- `.planning/phases/11-live-proofs-o1-o2-o3/11-CONTEXT.md` -- D-10's rotation table, D-14's
  four-means attribution scheme with each means' limit, D-20's proving-run contract, and the
  Deferred Ideas block that hands XOS-04/05/08 and DOCS-07 to this phase with their reasons.
- `.planning/phases/11-live-proofs-o1-o2-o3/11-LEARNINGS.md` -- load-bearing here: "Pre-register
  counts before the run, in the plan"; "Observe the red, never predict it"; "A prose lock that
  locked only half of what it named" (WR-09, a phrase occurring twice); "A leading-slash `rg`
  needle false-zeroes in Git Bash"; "The fallow bridge drops the complexity category".
- `.planning/phases/10-os-invariant-releases-mirror/10-SECURITY.md` -- the auditor's TRUST-11 /
  TRUST-12 classification, which D-07 appends the O4 attribution loss to.
- `.planning/THREAT-MODEL.md` -- the C1-C18 CREEP control ledger. This phase adds no new
  credential and no new write PATH, but it does add a second WRITER on an existing path.

### Project-level locks

- `.planning/PROJECT.md` `## Key Decisions` -- especially **"cross-OS sharing rests on target
  platform-agnosticism, NEVER on publish-leg ordering"** (D-02's `needs:` edge is a
  producer-consumer dependency for HIT-ability, NOT a correctness control -- say so in the comment
  so a future reader does not read it as the rejected ordering argument), **"no OS-separation
  knob"**, and the CORR-01 superseding row.
- `.planning/PROJECT.md` `## Constraints` -- "changes made for this repo's own CI/hashing must
  never leak into the consumer contract". The Windows legs and the detector are project-local; the
  recipe is the ONLY consumer-facing artifact in this phase.
- `.planning/REQUIREMENTS.md` `:55-64` -- D2-01 through D2-06, in particular **D2-02: no new env
  knob and no new action input.** This is what forces D-06.

### Files this phase edits or asserts on

- `.github/workflows/ci.yml` (1736 lines) -- the three new Windows jobs; the sidecar-block
  invariant comment (currently "all four wired jobs"); and the graph-premise comment block at
  `:1047-1064`. **Locate by JOB NAME, never by line number** -- this file drifted ~470 lines
  inside two milestones.
- `.github/workflows/<new>.yml` -- the D-08 scheduled detector. `cleanup.yml` is the shape
  precedent for a separate scheduled single-job workflow.
- `nx.json` -- the `test` inputs list (register `docs/cross-os.md`, and the detector workflow if a
  spec asserts on it) and, per D-15/U-01, the `integration` runtime discriminator at `:104`.
- `docs/cross-os.md` (NEW) -- DOCS-07's recipe.
- `packages/github-cache/src/docs-*.spec.ts` -- the drift guard. **Note the rotation cost (D-16):
  any file under `packages/` rotates `test`, `typecheck` and `integration`.**
- `capture-hashes.mjs` -- the contract-comment correction only (D-21). Root-level and hash-neutral
  as a FILE, but it IS an explicit `test` input (`nx.json:82`), so editing it rotates `test`.
- `.planning/phases/11-live-proofs-o1-o2-o3/11-EVIDENCE.md` -- the RESERVED O4 section (D-22).

### In-repo precedent

- `.github/workflows/ci.yml` `dogfood-seed` (`:1266`) / `dogfood-verify` (`:1289`) -- **the exact
  producer-then-consumer two-job shape XOS-08 names as the mirror**, including the recorded reason
  a same-run same-process read-back is not evidence the bytes crossed the service, and the VACUITY
  CONDITION comment explaining why the seed leg is ubuntu-ONLY by design.
- `.github/workflows/ci.yml` `build` (`:207-279`) -- the canonical sidecar block WITH its inline
  trap notes; the three new legs copy the comment-free form used by `typecheck`/`test`.
- `.github/workflows/ci.yml` `integration` (`:416`) -- the Windows-runner specifics already solved:
  `shell: bash` everywhere (the default on windows-11-arm is pwsh, which fails on `$GITHUB_ENV`,
  `$(...)`, `seq` and `[ ... ]`), and `node` rather than `openssl` for the token.
- `.github/workflows/ci.yml` `hash-parity` (`:998`) / `hash-parity-compare` (`:1214`) -- per-leg
  unique artifact names with `if-no-files-found: error`, and the recorded trap that folding a
  record into the wrong artifact reddens a CORRECT run.
- `.github/workflows/ci.yml` `lint` (`:37-72`) -- **`nx run-many` with no matching target prints
  "NX No tasks were run" and EXITS 0.** The shipped answer is to demand the success LINE, not the
  exit code. Directly applicable to the D-08 detector.
- `.github/workflows/cleanup.yml` `:4-12` -- the separate-scheduled-workflow rationale and the
  off-the-hour cron.
- `packages/github-cache/src/docs-trust.spec.ts` -- the strongest drift-guard shape: import the
  single source, assert the doc renders it verbatim.
- `packages/github-cache/src/docs-same-os-claims.spec.ts` -- the phrase-keyed `DOCS_08_SITES`
  content guard.

### Stale, and how to treat it

- `.planning/codebase/*.md` was mapped **2026-07-22 against v0.0.1** and is flagged stale in both
  PROJECT.md and STATE.md. v0.0.2 invalidated it materially (renamed asset scheme, new archive
  path, an inferred `lint` target, ESLint in the toolchain, seven new `ci.yml` jobs). Use
  `.planning/codebase/TESTING.md` for CONVENTIONS and for its
  `## Live-CI first-push close pattern` section; never for facts about the current tree.

### Measured this session (2026-07-30), not inherited

- `gsd-tools query init.plan-phase 12` -> all FOUR IDs, trailing period on the last (D-00).
- ROADMAP vs REQUIREMENTS Phase 12 count -> FOUR vs THREE, XOS-08 missing from ROADMAP's
  traceability table and coverage tally (D-01).
- `select-backend.ts` read in full -> no read-only-Actions-cache branch exists; a write-trusted
  context without a token yields an EMPTY memory backend (D-06).
- `nx.json` read in full -> the D-16 rotation table; `integration`'s discriminator is
  `{ "runtime": "node -p process.platform" }` at `:104`; `ci.yml` is a `test` input at `:69`;
  `capture-hashes.mjs` is a `test` input at `:82`; `docs/cross-os.md` is NOT yet registered.
- `ci.yml` job inventory -> 19 jobs. `build`, `typecheck` and `test` are SINGLE ubuntu-24.04-arm
  jobs (not matrices) and are NOT push-gated; `integration` is the only matrix (D-18).
- `capture-hashes.mjs` `assertGraphPremise` read -> asserts over `nx run-many -t integration`'s
  resolved set, wired at `ci.yml:1065` on both `hash-parity` legs (D-21).
- `.planning/spikes/MANIFEST.md` exists with no corresponding
  `./.claude/skills/spike-findings-*/SKILL.md`. Run `/gsd:spike --wrap-up` if those findings are
  needed; otherwise `.planning/research/v0.0.2/` is the current source.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **The sidecar dogfood block** is already Windows-correct: `shell: bash` on every step, `node`
  rather than `openssl` for the loopback token, a bounded readiness poll demanding 404-or-200 with
  a loud failure. It has run on windows-11-arm continuously as the `integration` matrix's Windows
  leg. The three new legs COPY it; nothing needs adapting.
- **`dogfood-seed` -> `dogfood-verify`** is a working, shipped, live-proven producer-then-consumer
  job pair with `needs:`, including its vacuity-condition comment. D-02's shape is this shape.
- **`cleanup.yml`** is a working separate scheduled single-job workflow with its rationale
  comment-locked. D-08's shape is this shape.
- **The `lint` job's "prove the target actually ran" step** solves the exact failure the D-08
  detector would otherwise ship: `nx run-many` on a missing target exits 0. Reuse the
  demand-the-success-line pattern (and its `NO_COLOR: '1'` requirement, which is load-bearing --
  Nx bolds the target name mid-phrase and a plain-text match never fires with colour on).
- **Three shipped docs drift guards** (`docs-trust.spec.ts`, `docs-adoption.spec.ts`,
  `docs-same-os-claims.spec.ts`) cover the two useful shapes: import-the-source-and-assert-verbatim,
  and phrase-keyed content assertion.
- **`11-EVIDENCE.md`'s RESERVED O4 section** is a pre-written slot with its own do-not-delete
  instruction.
- **`capture-hashes.mjs --assert-graph-premise`** is live on both `hash-parity` legs and stays
  live; only its evidentiary comment changes.

### Established Patterns

- **A distinct named job per concern**, so a regression reddens a leg whose name says what broke.
- **`needs:` as the ordering mechanism, never leg order.** XOS-06 and the PROJECT.md row forbid
  `max-parallel` becoming a correctness control; a `needs:` edge between two named jobs is a
  different thing and must be commented as such.
- **A tripwire that fires on correct work gets disabled** (OBS-04's own lesson, calibrated in this
  milestone). The D-08 detector is deliberately NOT in this class -- it fires only on a real
  Windows-only regression.
- **Observe the red, never predict it.** Every new guard is seen to fail before it passes, by
  mutating the thing it asserts on and confirming the message names the right cause.
- **Pair every absence or negative assertion with a positive control**, and a phrase that occurs
  twice is only half-locked (`toContain` stops at the first).
- **Correcting a claim requires supplying a REPLACEMENT reason** (D-21's whole shape).
- **`rg`, never `git grep`, for an absence claim.** `git grep` false-zeroes on untracked and
  gitignored paths, and the zero reads as confirmation. `rg -c` counts LINES; use `rg -o | wc -l`
  for occurrences. A leading-slash needle (`/home/runner/...`) is path-rewritten by MSYS before
  `rg` sees it and false-zeroes in Git Bash.
- **Fail-closed writes, best-effort reads.** Every read fault degrades to a MISS, which is exactly
  why a MISS is never self-evidencing and why the O4 proof needs the label, not the absence of an
  error.
- **`nx.json`'s `targetDefaults` inputs REPLACE rather than merge**, and the list is comment-locked
  for that reason. Adding an input means adding a line, never relying on a merge.

### Integration Points

- The three new Windows jobs -> `needs:` on `build` / `typecheck` / `test`; the shared sidecar
  block; `./start-cache-server`; `selectBackend`'s write-trusted branch; the Actions-cache backend.
- The detector workflow -> the runner only. No sidecar, no backend, no credentials beyond the
  implicit checkout.
- `docs/cross-os.md` -> `nx.json`'s `test` inputs; the drift-guard spec; the README/docs nav.
- `nx.json`'s `integration` runtime input -> Nx's `hash_runtime`, the `hash-parity` capture on both
  legs, and CORR-03's build-gating comparator (which asserts the two legs DIFFER).
- `11-EVIDENCE.md` -> filled in place; no Nx input, no spec.

</code_context>

<specifics>
## Specific Ideas

- **The phase's anti-requirements are explicit and each is worth restating in the plan.** A run
  that MISSes everything is not a valid O4 proof (TEST-09's rule, applied to O4). A fork-PR proving
  run is structurally incapable of proving it (read-only Actions cache -> ubuntu saves nothing).
  A `Cache: n/m hit` line read as discriminating (OBS-02). A "the job was green" claim with no
  paired count (TEST-08). A green O4 CI read as evidence the targets are PORTABLE -- that argument
  is CIRCULAR and REQUIREMENTS.md names it explicitly in the Out of Scope table: a restored task
  does not execute, which is precisely why the D-08 detector exists.
- **XOS-05 names a trap in its own words, and it is the sharpest thing in this phase:** "the
  success signal for O4 (every target `[remote cache]`, wall time collapsing to sidecar overhead)
  is the identical observation" to a Windows-only regression being invisible forever. Success and
  the failure mode look the same from the log. That is the whole argument for D-08, and the plan
  should say so at the point the detector is added, not in a distant rationale.
- **TRUST-11 already wrote this phase's threat entry, in advance.** It says the race "appears only
  once XOS-04 puts `build`/`typecheck`/`test` on a Windows leg" and that the residual risk "moves
  into the XOS-05 write decision". D-02's `needs:` edge removes the RACE (the legs are no longer
  concurrent); it does not remove the SECOND PRODUCER. Record both halves -- an appended note
  claiming the race is gone without saying the producer count changed would be half true.
- **This is the milestone's last phase.** After it: `/gsd:secure-phase 12`, `/gsd:validate-phase 12`,
  `/gsd:extract-learnings 12`, then the v0.0.2 milestone audit and completion. Two carried
  operator items are still open and are NOT this phase's work: the `.planning/codebase/*`
  regeneration, and the decision on opening a PR for `gsd/v0.0.2-os-invariant-cross-os-sharing`.
- **The `test` failure at `69bd1b7`** is still open in
  `.planning/phases/08-nx-task-hash-parity/deferred-items.md`. It has never been attributed. This
  phase runs `test` on a Windows runner for the first time, which is exactly the environment most
  likely to surface it. If it fires, capture the output BEFORE re-running.
- **`lint` is not in scope.** It has no sidecar by design (D-33: a fifth cache producer would add a
  fifth mirrored hash family), it is absent from the mirror by design, and XOS-04 names three
  targets. Recorded so a coverage audit does not read three-of-four as a gap.

</specifics>

<deferred>
## Deferred Ideas

- **A drift guard over the duplicated sidecar block.** `ci.yml`'s own comment records that the
  precondition is now met (`ci.yml` IS a `test` input, and two specs already assert on it), so
  "only the drift guard itself would be new work". This phase takes the block from FOUR copies to
  SEVEN, which raises the value of the guard -- and it is still a new capability that no Phase 12
  requirement asks for. Deferred with the count recorded, not overlooked. `cleanup-workflow.spec.ts`
  is the named shape precedent.
- **An every-commit Vitest version of the graph-premise assertion.** Phase 11 deferred this with
  "Revisit in Phase 12, where XOS-04 changes the graph premise anyway and the rotation cost is
  already being paid." **Revisited here and DECLINED, with the reason:** XOS-04 destroys the
  premise's evidentiary value (D-21), so there is nothing left for an every-commit gate to protect
  that `ci.yml:1065`'s existing both-legs step does not already protect. Adding a spec would rotate
  three hashes to duplicate a live gate.
- **Collapsing the publish matrix to one leg.** Out of scope for v0.0.2 by name, and only safe
  AFTER XOS-05 is proven -- which this phase does, so the trigger fires for v0.0.3. Phase 10's
  D-26(a) and `10-SC6-NOTES.md` already record the strongest argument for it (the Windows publish
  leg mirrors zero real assets).
- **Archive file-mode handling across the OS boundary.** Out of Scope by name, "carried as an
  XOS-05 investigation item, not a requirement". If the O4 proving run surfaces a file-mode
  symptom, record it as a finding and do not expand scope.
- **PARITY-04's "does my everyday box hit" question.** Named in Phase 11, deliberately not closed
  there, and not closed here. Checklist item 1 in `docs/cross-os.md` is the CONSUMER-facing half of
  it; the acceptance question itself stays open.
- **macOS in any form.** `cachePlatform` maps `darwin -> macos` and is unit-pinned, but no macOS
  runner or developer read exists anywhere in this project.
- **Regenerating `.planning/codebase/*`** via `/gsd:map-codebase` -- flagged stale in PROJECT.md and
  STATE.md, listed in Operator Next Steps, carried since Phase 10. Conventions only until it
  happens.
- **`roadmap update-plan-progress`'s duplicate checked/unchecked plan list** -- logged as D1 in
  `10-os-invariant-releases-mirror/deferred-items.md` and observed again on Phase 11's plan block
  (visible in `ROADMAP.md:494-510` right now). Expect it again on this phase's block.
- **The `requirements mark-complete` traceability defect** -- it ticks the checkbox but only
  rewrites rows whose status is exactly `Pending`, so a row reading `Pending (parenthetical)` is
  left untouched and the file contradicts itself. THREE of this phase's four rows carry a
  parenthetical (`XOS-05`, `XOS-08`) or will (`REQUIREMENTS.md:658-661`). Hand-correct, as Phase 11
  did twice.

</deferred>

<unresolved>
## U-01 -- RESOLVED 2026-07-30 by `12-RESEARCH.md`

**Withheld from auto-lock at discuss time (HIGH impact, NOT-HIGH confidence); settled empirically by
`gsd-phase-researcher`, exactly as assigned. The original statement is preserved below the verdict
because the reasoning that withheld it is what produced the measurement.**

**VERDICT: `node --no-warnings -p process.platform`**, in `nx.json:104` AND the recipe, single-
sourced per D-15. All three sub-questions were measured, not reasoned:

| Sub-question | Answer | Evidence |
|---|---|---|
| Does `hash_runtime` hash stderr? | **YES** -- `hash(&[std_out, std_err].concat())`, both `.trim()`ed | Nx 23.1.0 `packages/nx/src/native/tasks/hashers/hash_runtime.rs:33-35`. The premise five in-repo documents asserted uncited is TRUE and now has its citation |
| Is stderr empty on both legs today? | **YES** -- `{"stdout":"linux\n","stderr":""}` / `{"stdout":"win32\n","stderr":""}` | `08-ROOT-CAUSE.md:753,2625,3013`. The hazard is LATENT, not live |
| Which hardening is shell-invariant? | `--no-warnings` (a node flag, not a shell redirect). Nx's shell set is exactly two: `%COMSPEC% /C` or `sh -c` | `command.rs:28-43` |

**The measurement that decides it, which the discussion did not anticipate:** a node warning's text
carries the **PID** (`(node:29864) Warning: probe`, positive control run in-session; `--no-warnings`
-> 0 bytes). So a warning does not rotate the hash ONCE -- it varies it on EVERY invocation,
producing a permanent 100% MISS that presents as a phantom portability failure. That is a far worse
failure mode than the one-time rotation the requirement anticipated, and it is what makes the
hardening worth its rotation cost even though the hazard is currently latent.

**Residual, stated rather than glossed:** node's startup-error channel is NOT suppressed by
`--no-warnings`, and its text is machine- and shell-specific -- but it also empties stdout and exits
non-zero, so it fails loud instead of silently re-partitioning the cache.

**Nine sites the string change touches are enumerated in `12-RESEARCH.md`**, including two
exact-equality spec pins and `08-ROOT-CAUSE.md:1589`'s byte-identical CORR-04 invariant, which must
be **SUPERSEDED with a replacement reason**, never silently violated.

---

### The original UNRESOLVED statement, preserved

- **U-01: the exact stderr-immune discriminator command string.**

  DOCS-07 requires that "the documented discriminator command must be stderr-immune, since
  `hash_runtime` hashes stdout AND stderr." D-15 locks the DIRECTION -- one string, shared by
  `nx.json` and the doc, guarded by equality -- but NOT the string, because three facts underneath
  it have never been measured in this repo:

  1. **That `hash_runtime` really concatenates stderr into the hashed value.** It is asserted in
     REQUIREMENTS.md, ROADMAP.md, `research/v0.0.2/ARCHITECTURE.md:449`, `08-RESEARCH.md:50` and
     `08-CONTEXT.md:64` -- always as a premise, never with a citation to Nx source or a
     measurement. Phase 8's CORR-03 job was built to record "the discriminator command's raw
     stdout AND stderr per leg" BECAUSE of this premise, so the recorded artifacts may already
     contain the answer.
  2. **Whether the current command's stderr is empty on both runners today.** If
     `node -p process.platform` already emits nothing on stderr on both, the hazard is latent
     (a future Node deprecation or experimental warning) rather than live -- which changes whether
     `nx.json` must be edited at all, and therefore whether `integration` and `test` rotate.
  3. **Which hardening mechanism is shell-invariant.** A shell redirect is NOT: `2>/dev/null` is
     POSIX and `2>nul` is cmd.exe, and Nx executes a `runtime` input through the platform's default
     shell -- so a redirect makes the command itself fail on one OS rather than merely differ.
     `node --no-warnings -p process.platform` is the leading candidate precisely because the flag
     is node's, not the shell's, and is therefore identical on both legs. It is a candidate, not a
     measured answer, and `--no-warnings` does not cover everything a node process can print to
     stderr.

  **IMPACT is HIGH:** the documented string is a CONSUMER CONTRACT -- an adopter who copies it and
  later has to change it invalidates their whole cross-OS cache partition -- and under D-15 it also
  rewrites this repo's own `nx.json`, rotating `integration` and `test`.
  **CONFIDENCE is NOT HIGH:** all three facts are reasoned about rather than observed, and this
  repo's record on unmeasured platform intuitions is poor (Phase 10's U-01, Phase 11's U-01, and
  the `nx run-many` exit-0 finding all began as confident inferences).

  **`gsd-phase-researcher` OWNS this**, with a pre-stated falsifiable check -- it is an empirical
  question, not a maintainer preference, so it belongs in RESEARCH.md rather than a checkpoint.
  The check, in order:
  (a) Read Phase 8's recorded per-leg discriminator stdout AND stderr from the `hash-parity`
      artifacts / `08-ROOT-CAUSE.md` and state whether stderr was empty on each leg.
  (b) Locate Nx 23.1.0's `runtime` input hashing in `node_modules/nx` (use `rg`, never `git grep`
      -- `node_modules` is gitignored and `git grep` returns a silent zero) and quote the lines
      that show whether stderr is included.
  (c) Establish that the chosen command produces a byte-identical stdout token under BOTH bash and
      the platform default shell on each OS, and that it differs BETWEEN the two OSes.

  **If stderr is NOT hashed**, the requirement's premise is false; record that as a FINDING, keep
  `node -p process.platform` unchanged, and document why the recipe does not need a hardened form
  -- do not quietly drop the clause.
  **If stderr IS hashed and the current command can emit to it**, adopt the measured
  shell-invariant form in `nx.json` and the doc together (D-15).
  **What is NOT available:** picking a string on plausibility and shipping it to adopters. If
  neither (b) nor (c) can be settled, STOP and put the choice to the maintainer rather than
  auto-selecting.

</unresolved>

---

*Phase: 12-Windows CI Reuse (O4) + Consumer Recipe*
*Context gathered: 2026-07-30*
