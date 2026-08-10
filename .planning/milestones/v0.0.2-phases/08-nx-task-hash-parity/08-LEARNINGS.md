---
phase: 8
phase_name: "Nx Task-Hash Parity"
project: "@op-nx/github-cache"
generated: "2026-07-28"
counts:
  decisions: 8
  lessons: 8
  patterns: 7
  surprises: 8
missing_artifacts:
  - "08-UAT.md"
---

# Phase 8 Learnings: Nx Task-Hash Parity

## Decisions

### The capture instrument is a root-level dev-only script, not a package module and not an Nx target

`capture-hashes.mjs` sits beside `esbuild.action.mjs` rather than under `packages/github-cache/src/`.

**Rationale:** two independent reasons, both load-bearing. (1) It imports `nx/src/hasher/*` and `nx`
is a **devDependency** -- a shipped module importing it would break every consumer install.
(2) **An Nx-cached instrument would replay a stale record instead of measuring.** A cached capture is
not a capture. A commonly-cited third reason was examined and DISCARDED: "keep it outside
`{projectRoot}` so it does not rotate the hashes it measures" does not hold, because both legs measure
the same commit and therefore hash the same instrument.
**Source:** 08-CONTEXT.md D-01, 08-01-SUMMARY.md, 08-DISCUSSION-LOG.md

### The comparator lives in the package source and is excluded from the tarball

`packages/github-cache/src/hash-parity/` with a co-located spec, kept out of the published artifact by
`!dist/hash-parity` in `files` plus a matching `pack-check.cjs` predicate.

**Rationale:** it is the only location where the gate is typechecked and unit-testable -- `typecheck`
runs `tsc --build` over the spec project, so a spec importing an untyped root `.mjs` would not compile.
`src/roundtrip/` is a 4-for-4 structural analog, and `!dist/action` / `!dist/roundtrip` / `!dist/test`
made the exclusion an existing pattern rather than a new mechanism.
**Source:** 08-CONTEXT.md D-19, 08-PATTERNS.md, 08-02-SUMMARY.md

### The fix lands in `nx.json` `targetDefaults` only, confirmed against a pre-registered condition

`targetDefaults.typecheck.outputs`, nine lines, one hunk.

**Rationale:** U-01 asked whether the goal was reachable through `nx.json` alone and was deliberately
withheld from auto-lock as HIGH-impact / NOT-HIGH-confidence. The confirming experiment was run against
conditions L1-L4 and non-triggers N1-N3 committed to git BEFORE it ran; all four confirming conditions
were met and no trigger fired, so `confirm-d12` was selected on measurement rather than on preference.
**Source:** 08-CONTEXT.md D-12 / U-01, 08-ROOT-CAUSE.md `## U-01 RESOLVED`, 08-05-SUMMARY.md

### The seven-entry outputs list was chosen by enumeration, not by size

**Rationale:** `outputs` controls what Nx caches and restores, so pinning the wrong list would silently
stop `typecheck` caching its declaration output rather than failing loudly. Measured:
`tsc --build tsconfig.json --emitDeclarationOnly` writes 136 files; the seven-entry list covers
**136 of 136**, the one-entry alternative covers **0 of 136**. Research assumption A6 warned the
inversion was possible; the measurement is what settled it.
**Source:** 08-03-SUMMARY.md, 08-ROOT-CAUSE.md, 08-RESEARCH.md A6

### `measure -> record -> fix -> gate` is encoded as wave dependencies, not as prose

Six plans, six waves, strictly linear: 08-01 -> 08-02 -> 08-03 -> 08-04 -> 08-05 -> 08-06.

**Rationale:** PARITY-01 requires the root-cause record to be dated BEFORE the first fix commit and
git history is the proof. A comment asking an executor to preserve ordering is not a control; a
`depends_on` graph is. The first `nx.json` commit could not physically land before the wave that
committed the record. Verified after every wave: `git log 7bfe64f..<head> -- nx.json` stayed empty
through wave 4.
**Source:** 08-CONTEXT.md D-15, all six PLAN.md frontmatter blocks, 08-04-SUMMARY.md

### `lint` is gated as a fourth invariant target rather than merely recorded

**Rationale:** Phase 7's D-35 handed `lint` over as UNVERIFIED BY DESIGN and the roadmap's SC6 says the
job "treats `lint` as a FOURTH target". Measuring it without asserting on it would have wasted the
measurement. It came out identical cross-OS, so D-21's primary branch applied and the named fallback
(downgrade to recorded-with-a-finding, never delete) was not needed.
**Source:** 08-CONTEXT.md D-21, 08-05-SUMMARY.md, 08-06-SUMMARY.md

### The `typecheck`/`build` outputs overlap was accepted and documented, not "fixed"

63 of `typecheck`'s 136 output files are also `build`'s outputs, including
`dist/tsconfig.lib.tsbuildinfo`, which the two targets write with contradictory `emitDeclarationOnly`.

**Rationale:** `build.outputs` is **plugin-inferred** -- `nx.json` declares no
`targetDefaults.build.outputs` -- and `@nx/js/typescript` declares that same tsbuildinfo on BOTH
targets. So the overlap is the plugin's own design, not something the pin introduced. Dropping the
entry would make the pin diverge from the plugin (the exact thing the verbatim list exists to prevent),
would leave `typecheck` declaring 135/136, and would not even fix the stated cost (62 of 63 files stay
shared). The rationale was corrected instead, since part of the finding was that it was silent.
**Source:** 08-REVIEW.md WR-02, 08-REVIEW-FIX.md

### The compare job uses `!cancelled()` rather than `always()`

**Rationale:** it satisfies D-17's intent -- a failed or skipped capture leg must still reach the
assertion, which is what makes "fewer than two records is a FAILURE, not a skip" enforceable -- while
matching the convention already used on the repo's `publish` job. Proven on real runner behaviour: a
run where the windows capture leg FAILED still reached the compare job and still failed it.
**Source:** 08-CONTEXT.md D-17, 08-RESEARCH.md, 08-06-SUMMARY.md

---

## Lessons

### The roadmap's "freshness axis" is misnamed -- it is staleness of persisted inference

Cold and warm graphs agree byte-for-byte when `.nx/workspace-data` is FRESH. Only the repo's
long-lived directory differs, because `tsc-<optionsHash>.hash` retains an old inference result and
never self-heals.

**Context:** the roadmap and REQUIREMENTS.md both say "FRESHNESS axis". That framing suggests
cold-vs-warm is the variable, which would make `nx reset` a control. It is not a control -- it is the
only known cure. The record says "STALENESS axis" wherever the roadmap says freshness.
**Source:** 08-RESEARCH.md, 08-ROOT-CAUSE.md

### The recommended CLI surface is blind to the one node that mattered

`HashPlanInspector` documents itself as skipping `ProjectConfiguration` (`native/index.d.ts:86`), and
that is precisely the single node that differed.

**Context:** this retroactively explains every prior "no difference" reading in this repo. Those
readings were telling the truth about the wrong thing. PARITY-02's insistence on the per-NODE
`details` map was not pedantry -- it was the only surface that could see the answer.
**Source:** 08-RESEARCH.md, 08-ROOT-CAUSE.md

### `nx show target <t> --inputs` is a subcommand, not a flag, at Nx 23.1.0

The flag form exits 0 with the flag inert, printing the target configuration instead.

**Context:** an inert flag that exits 0 is indistinguishable from a successful query. Both forms were
captured so the D-03 insufficiency evidence could not be dismissed as "you ran the wrong command".
**Source:** 08-01-SUMMARY.md

### A `dependsOn` can be inferred and invisible in `nx.json` -- and that invalidated a conclusion

`typecheck` carries `dependsOn: ["build", "^typecheck"]`, inferred by `@nx/js/typescript` and absent
from `nx.json`. Nx therefore defers `typecheck`'s hash until `build` has produced its outputs.

**Context:** the record initially concluded that a developer who has built computes a different
`typecheck` hash from CI, and that conclusion was queued to ship as consumer-facing DOCS-07 advice.
Two real `--skip-nx-cache` runs from opposite `dist/` states both computed the same hash, falsifying
it. The instrument had been observing a value real execution never produces, because it calls
`hashTask` outside the dependency chain. Fixing the capture job to run `build` first raised PARITY-03
from three invariant targets to four.
**Source:** 08-05-SUMMARY.md, 08-ROOT-CAUSE.md D-11 consequence (rewritten)

### A derivation can be unsatisfiable in a way that always reports the safe-looking answer

The `graphState` field could never have reported `cold`: the recommended derivation required both
`workspaceDataEntries` and `nativeFileCacheEntries` to be zero, but `getNativeFileCacheLocation()`
holds one copy of the `.node` addon binary, which the instrument's own import puts there before any
measurement runs.

**Context:** shipping it as written would have stamped every Phase 8 observation point `warm` -- a
field that silently always reports one value, on the axis the phase exists to separate.
**Source:** 08-01-SUMMARY.md

### `init.plan-phase` truncates `phase_req_ids` at a ROADMAP line wrap

Phase 8's `**Requirements**:` line wraps across two lines, and the query returned only
`PARITY-01..07`, silently dropping **CORR-03 and CORR-04** -- the entire gating-job requirement.

**Context:** every downstream consumer (researcher, planner, plan-checker, coverage gate, verifier)
would have inherited the truncation. The corrected list was passed explicitly to each. The same
underlying defect appears as shifted PARITY rows at `ROADMAP.md:530-534` and a wrong count at `:574`.
**Source:** orchestrator observation during plan-phase; 08-04-SUMMARY.md coverage audit

### A grep-verifiable ABSENCE claim must not spell the token it forbids -- anywhere

Twice in one plan, a spec's own header defeated its "no snapshot matcher" source scan by naming the
matcher, including once inside the sentence claiming the matcher was absent.

**Context:** caught by re-running the scan, not by reading the text. The first reword still contained
the token. The rule generalises: any assertion of the form "this token appears nowhere" is broken by
its own documentation unless the documentation spells the token differently.
**Source:** 08-02-SUMMARY.md deviations 1 and 2

### Complexity metrics on deliberately-untested files are artefacts, not signal

The structural pre-pass reported `critical` CRAP 156 on `capture-hashes.mjs:diff` and `high` 72 on
`pack-check.cjs:main`.

**Context:** CRAP squares complexity against assumed-zero coverage, and both files carry no tests BY
DESIGN (D-19). Their severities are substantially metric artefact. The one finding in tested code --
`compare.ts:shapeFault` at cognitive 14/18 -- was inspected and CLEARED: nine flat early returns, max
nesting 2, one branch per spec-exercised fault. Acting on the numbers alone would have refactored
correct code and ignored the real question.
**Source:** fallow 3.6.0 pre-pass, 08-REVIEW.md

---

## Patterns

### Pre-register the falsifiable condition, including its non-triggers, before running the experiment

Write down -- and commit -- what outcome would mean the hypothesis FAILED, before you can see the
result. Include explicit NON-triggers.

**When to use:** any decision that is high-impact and currently low-confidence. The non-triggers are
the half that does the work: they stop a known, already-root-caused difference being relabelled as the
hypothesis failing, and equally stop the hypothesis being waved away by pointing at one. This is what
moved U-01 out of the trap quadrant and made auto-locking it legitimate rather than a bare default.
**Source:** 08-04-SUMMARY.md, 08-ROOT-CAUSE.md `## U-01: the condition that would make it live`

### Re-derive at the current commit; never cite an earlier measurement as current

**When to use:** whenever a prior measurement exists and is tempting to quote. Research had already
measured the root cause at an earlier commit, and every plan explicitly forbade pasting those numbers
as measured values -- they were allowed only inside labelled prediction callouts. The verifier applied
the same rule to the phase's own output, re-running the instrument at HEAD rather than reading the
phase's self-assessment back.
**Source:** all six PLAN.md anti-requirement blocks, 08-VERIFICATION.md

### Prove a guard can fail on a fixture AND on a real leg

**When to use:** any CI gate. Fixture RED is necessary but not sufficient -- it proves the predicate,
not the wiring. The gate was mutated on a live PR twice, observed red, reverted, observed green, with
both run references recorded. The second pair was the stronger one: a capture leg genuinely FAILED and
the compare job still ran and still failed, proving the missing-record clause against real runner
behaviour rather than a crafted input.
**Source:** 08-CONTEXT.md D-22, 08-02-SUMMARY.md, 08-06-SUMMARY.md

### Against a forged log line, escaping and anchoring are jointly necessary

**When to use:** whenever a log line is used as a machine-readable signal and any part of it derives
from data. Measured truth table: escaping alone still matches as a mid-line substring; anchoring alone
still matches a forged line at position zero. Only both together reject the payload while accepting
the legitimate line.
**Source:** 08-REVIEW-FIX.md WR-01

### Neutralise at the choke point, not at the enumerated call sites

**When to use:** when a review names N vulnerable interpolation sites. The fix went into `fail()`
instead of the one site named, and `git grep "ok: false"` returning exactly one hit is what proves the
coverage. The review had named two vectors; the choke point covered eight failure returns including
`meta.os` and hash values.
**Source:** 08-REVIEW-FIX.md WR-01, 08-SECURITY.md

### Assert against the MERGED configuration when a lower-precedence file can silently replace it

**When to use:** any invariant declared in a config file that another file can override.
`project.json` declaring an `inputs` list would replace `targetDefaults.integration.inputs` wholesale
and remove the platform discriminator -- while all three existing guards stayed GREEN, because all
three read `nx.json` rather than the merged result. Delegate the merge to the framework's own
functions so the guard cannot drift from real precedence, and pair it with a vacuity control that
reddens if the merge never consulted the overriding file.
**Source:** 08-SECURITY.md NF-02, 08-VALIDATION.md `## Gaps filled`

### Label a deliberate demonstration commit so a later ordering proof stays readable

**When to use:** whenever you must temporarily break something to prove a gate works, in a history
that carries an ordering claim. The mutation and its revert were named
"D-22 GATE-RED DEMONSTRATION, NOT A FIX" and "revert the ... demonstration", and both SHAs were
recorded in the record. `git log -- nx.json` now returns three commits instead of one, but a reader
can still check that the record predates the first real fix without re-deriving it.
**Source:** 08-06-SUMMARY.md

---

## Surprises

### Exactly one node differed, and it was the one the CLI cannot show you

427-443 hash nodes per target, and the cross-OS diff was a single `value-changed` entry --
`@op-nx/github-cache:ProjectConfiguration` -- identically on all five targets, with the `only-in-*`
buckets empty everywhere.

**Impact:** collapsed an open-ended investigation into a one-field question. It also refuted the
research prediction that a differing external-dependency SET was an equally plausible shape: the
external set is lockfile-derived and therefore platform-independent.
**Source:** 08-03-SUMMARY.md, 08-ROOT-CAUSE.md

### Both axes carried the same two node values, which is why one masqueraded as the other

A warm Windows workstation was byte-identical to a cold ubuntu runner on `build`, `test` and `lint`.

**Impact:** explains why this was invisible for so long -- anyone measuring on an established Windows
workstation saw Linux's number and concluded parity. Every prior cross-OS measurement in the repo,
including the pair recorded in STATE.md, read a confounded variable.
**Source:** 08-RESEARCH.md, 08-ROOT-CAUSE.md

### The outputs-list inversion would have been a real regression

**Impact:** the one-entry list covers 0 of 136 emitted files. Had the larger list been assumed correct
merely because it was larger -- or worse, had the smaller one been pinned as "the stable one" -- the pin
would have silently stopped `typecheck` caching its declaration output while every hash-parity
assertion stayed green. A stability-only guard passes on the degraded list; the enumeration is what
distinguishes them.
**Source:** 08-03-SUMMARY.md, 08-REVIEW.md, 08-05-SUMMARY.md mutation M2

### `packages/github-cache/project.json` exists, falsifying a premise two locked decisions assert

Tracked since `7413363`, declaring the `integration` target.

**Impact:** D-12 and Phase 7's D-02 both state the workspace is deliberately free of `project.json`.
It is not. This did not change the phase's outcome, but it re-prices U-01's `pin-inferred-target`
option, whose stated cost was a departure from a posture the workspace does not hold. Surfaced, not
fixed -- the file must not be deleted, since `integration` is the one target no plugin infers.
**Source:** 08-05-SUMMARY.md, 08-SECURITY.md NF-02, 08-VERIFICATION.md

### Three guards for one invariant, and all three had the same blind spot

Adding `"inputs": ["default"]` to `project.json` reddens only the newly-added merged-config guard.
Both pre-existing CORR-04 guards stay GREEN.

**Impact:** the green pair WAS the hole. Guard count is not guard coverage when every guard reads the
same source. The build-gating CI clause caught it, so it could not merge silently -- but the local
battery, the fastest feedback layer, could not see it at all.
**Source:** 08-SECURITY.md NF-02, 08-VALIDATION.md `## Gaps filled`

### A mechanically-correct decomposition supported a factually wrong conclusion

The D-11 table explaining `typecheck`'s four values as two binary variables was correct about the
instrument. The consequence paragraph drawn from it -- that developers would diverge from CI -- was
false, and was queued to ship as consumer-facing advice.

**Impact:** the error was not in the analysis but in the step from analysis to consequence, and it
survived the phase's own review of its own record. It was caught only because an outside question
asked why `dist/` mattered at all. A reassurance about a non-problem is worse than silence, so the
Phase 12 hand-off item now says to document nothing there.
**Source:** 08-05-SUMMARY.md, 08-ROOT-CAUSE.md D-11 (rewritten)

### The requirement traceability table disagrees with the requirements

`ROADMAP.md:530-534` carries shifted PARITY numbering -- the `PARITY-02` row states PARITY-03's text,
and so on down -- and `:574` says seven Phase 8 requirements where both the roadmap header and
REQUIREMENTS.md say nine.

**Impact:** an audit run against that table would report PARITY-02 as covered by the observation
points, which is PARITY-03's job. Surfaced, not fixed. It will mislead the milestone audit's
three-source cross-reference if it is still there when that runs.
**Source:** 08-04-SUMMARY.md coverage audit

### A test failed once, and re-running it destroyed the only evidence

`npm run test` exited 1 at `69bd1b7`; the battery loop's redirect discarded the output, Nx's flaky
detector then fired (failure and success at the same hash), and seven subsequent runs plus CI at the
same tree were green.

**Impact:** which spec failed is unrecoverable, because Nx caches terminal output for SUCCESSFUL runs
only. The operational lesson is recorded in `deferred-items.md`: capture the output BEFORE re-running,
because the re-run is what destroys it. Logged with what is and is not known rather than guessed at.
**Source:** 08-06-SUMMARY.md, deferred-items.md
