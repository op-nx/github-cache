---
phase: 12-windows-ci-reuse-o4-consumer-recipe
plan: 02
subsystem: ci
tags: [github-actions, windows-11-arm, nx-cache, threat-model, claim-correction]

# Dependency graph
requires:
  - phase: 12-windows-ci-reuse-o4-consumer-recipe
    provides: "12-01's 21 RED leg assertions -- the full shape specification for the three Windows jobs"
  - phase: 10-os-invariant-releases-mirror
    provides: "10-SECURITY.md's Q1 section, written to be appended to, and its 're-priced by Phase 12' promise"
  - phase: 11-live-proofs-o1-o2-o3
    provides: "11-EVIDENCE.md's O1 section -- the frozen producer-attribution record the corrected claim now points at"
provides:
  - "ci.yml build-windows / typecheck-windows / test-windows: three windows-11-arm reuse legs, each needs: its ONE ubuntu producer"
  - "The sidecar invariant restated at SEVEN wired jobs, enumerated, with the eight-copies-vs-seven-wired distinction"
  - "The graph-premise claim corrected at three sites with a replacement reason, the step byte-unchanged"
  - "10-SECURITY.md Q1's Phase 12 re-pricing: race removed, second producer recorded, write decision recorded as FORCED"
affects: [12-03, 12-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Producer-to-consumer needs: edge documented as HIT-ability only, with the ordering-is-not-correctness disclaimer inline (XOS-06)"
    - "Claim correction as three components (still guards / no longer establishes / where the record is frozen), applied identically to a YAML comment, a JSDoc block and a runtime failure-message string"

key-files:
  created:
    - .planning/phases/12-windows-ci-reuse-o4-consumer-recipe/12-02-SUMMARY.md
  modified:
    - .github/workflows/ci.yml
    - capture-hashes.mjs
    - .planning/phases/10-os-invariant-releases-mirror/10-SECURITY.md

key-decisions:
  - "12-02: the shared rationale (what the legs are, why the needs: edge is HIT-ability and not ordering correctness, why integration's matrix is not the precedent, why dogfood-seed's ubuntu-only asymmetry must not be 'fixed') lives ONCE in a two-space comment block above build-windows, with a short four-space needs: comment inside each job. That mirrors ci.yml's own documented-once-above-the-build-job habit rather than triplicating 30 lines of prose."
  - "12-02: the invariant comment states BOTH counts and which one it governs -- SEVEN wired jobs, EIGHT copies of the step, the eighth being consumer-smoke's scripted PUT/GET which is deliberately outside the invariant. A note saying 'five become eight' describes a different set than the invariant governs."
  - "12-02: the graph-premise correction is applied at THREE sites, not the one CONTEXT names. capture-hashes.mjs carries the attribution claim in two places -- the FORBIDDEN_TARGETS docblock AND assertion 2's runtime failure message, which is a string a CI operator reads at the moment the assertion fires. Correcting only the comment would leave the false claim in the louder of the two."
  - "12-02: the 10-SECURITY.md append asserts Leg A and Leg B separately and names them as such, so a future half-true edit that keeps only 'the race is removed' visibly loses a labelled leg rather than quietly shortening a paragraph."
  - "12-02: requirements.mark-complete was deliberately NOT run (carried forward from 12-01's deviation 4). XOS-05 is live-CI-only and closes in 12-06; requirement traceability for this phase closes once, at the orchestrator's phase.complete step, after the verifier runs."

requirements-completed: []

coverage:
  - id: D1
    description: "build-windows job -- seven clauses, all GREEN against the authored job"
    requirement: XOS-04
    verification:
      - kind: unit
        ref: "packages/github-cache/src/dogfood-cross-os.spec.ts#ci.yml build-windows job exists and keeps its shape (XOS-04, XOS-08)"
        status: pass
    human_judgment: false
  - id: D2
    description: "typecheck-windows job -- same seven clauses, GREEN"
    requirement: XOS-04
    verification:
      - kind: unit
        ref: "packages/github-cache/src/dogfood-cross-os.spec.ts#ci.yml typecheck-windows job exists and keeps its shape (XOS-04, XOS-08)"
        status: pass
    human_judgment: false
  - id: D3
    description: "test-windows job -- same seven clauses, GREEN"
    requirement: XOS-04
    verification:
      - kind: unit
        ref: "packages/github-cache/src/dogfood-cross-os.spec.ts#ci.yml test-windows job exists and keeps its shape (XOS-04, XOS-08)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Each leg's needs: is a bare single-producer scalar at four spaces naming its own ubuntu counterpart"
    requirement: XOS-08
    verification:
      - kind: unit
        ref: "packages/github-cache/src/dogfood-cross-os.spec.ts#waits on the ubuntu build job as a bare single-producer needs: scalar (XOS-08)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The --assert-graph-premise step is byte-unchanged and still passes; only its evidentiary claim moved"
    requirement: XOS-04
    verification:
      - kind: manual
        ref: "npm run assert:graph-premise exits 0 with verdict PREMISE OK; git diff shows no change inside the step named 'Assert the TEST-08 graph premise on this runner'"
        status: pass
    human_judgment: false
  - id: D6
    description: "10-SECURITY.md Q1 carries the promised Phase 12 re-pricing with both halves, the forced write decision and its measurement, and the DERIVED marker on the replay nuance"
    requirement: XOS-05
    verification:
      - kind: manual
        ref: "rg -c -F over the seven required literals in .planning/phases/10-os-invariant-releases-mirror/10-SECURITY.md"
        status: pass
    human_judgment: true
    rationale: "A doc artifact. XOS-05 itself does NOT close here -- it is live-CI-only and closes in 12-06. This row records only that the recording obligation XOS-05 imposes on the write decision is discharged."

# Metrics
duration: 40min
completed: 2026-07-30
status: complete
---

# Phase 12 Plan 02: GREEN for the Windows-Reuse Slice Summary

**Three `windows-11-arm` legs that can restore a Linux-produced `build`, `typecheck` or `test`
artifact, landed in the same commit as the four claims their existence falsifies -- because the
instant the legs exist, a comment asserting Linux-only production is a documented argument for
undoing the work.**

## Performance

- **Duration:** ~40 min
- **Tasks:** 2 of 2
- **Files modified:** 3 (0 created, 3 modified)

## Accomplishments

- `ci.yml` declares `build-windows`, `typecheck-windows` and `test-windows`. Each is
  `runs-on: windows-11-arm`, each declares `needs:` on its ONE ubuntu producer as a bare scalar
  at four spaces, each carries `timeout-minutes: 15`, a character-for-character copy of the
  `test` job's comment-free sidecar block (only the final `npm run <target>` line differs), and
  NO job-level `if:` -- which is what keeps them PR-eligible for plan 12-06's proving run.
- The sidecar invariant now governs SEVEN wired jobs and names all seven, and states the
  seven-wired-vs-eight-copies distinction rather than just bumping a number.
- The graph-premise claim is corrected at three sites with a replacement reason at each; the
  step, its mode, its `NX_DAEMON` env and its `--out` artifact are byte-unchanged and the
  assertion still passes.
- `10-SECURITY.md`'s Q1 carries the Phase 12 re-pricing it promised, with both halves.

## Task Commits

1. **Task 1: the three Windows legs, and the four claims their existence falsifies** - `f5dd429` (feat)
2. **Task 2: the second-producer consequence recorded alongside TRUST-11/12** - `c46b844` (docs)

## Measured before/after counts

Requested explicitly by the plan's `<output>` block. All measured with
`rg -o -F '<needle>' .github/workflows/ci.yml | wc -l`, before-counts taken from
`git show 56dd7e1:.github/workflows/ci.yml`.

| Needle | Before | After | Delta |
|---|---|---|---|
| `runs-on: windows-11-arm` (literal, with the `runs-on: ` prefix) | 0 | 3 | +3 |
| `Pre-set the Nx cache client vars for the sidecar` | 5 | 8 | +3 |
| `all four wired jobs` | 1 | 0 | -1 |
| `all seven wired jobs` | 0 | 1 | +1 |
| `capture-hashes.mjs --assert-graph-premise` | 1 | 1 | 0 |
| `runs-on: ${{ matrix.os }}` | 5 | 5 | 0 |

**The plan's WARNING-1 correction is confirmed.** The before-count for the LITERAL
`runs-on: windows-11-arm` is **0**, not 3: `integration`, `hash-parity` and `publish` resolve the
label through `runs-on: ${{ matrix.os }}`. The three new legs are the first literal occurrences
in the file. The related non-vacuity fact also re-measured: the bare token `windows-11-arm`
occurs 19 times before and 22 after, so no file-wide clause about the bare token can
discriminate -- every guard must anchor on the full `runs-on: ` prefix, which 12-01's do.

## The exact wording at each of the three graph-premise correction sites

Recorded verbatim so a later checker can re-grep without guessing. All three carry the same
three components in the same order.

### Site 1 -- `ci.yml`, the comment block above `Assert the TEST-08 graph premise on this runner`

Lead line: `# CORRECTED BY XOS-04, with the replacement reason rather than a bare deletion,`

- (a) `WHAT IT STILL GUARDS, unchanged and still a real gate: the GRAPH PROPERTY`
- (b) `WHAT IT NO LONGER ESTABLISHES: producer attribution.` ... `rested on a CONJUNCTION`
- (c) `WHERE THE ATTRIBUTION RECORD IS FROZEN:` ... `11-EVIDENCE.md's O1 section`

One sentence was reflowed rather than rewritten: the original
`the premise it asserts is about the WINDOWS leg's resolved graph (D-12, D-14 row 1), so a
ubuntu-only check would assert it on the wrong runner` now reads
`the premise is about the WINDOWS leg's resolved graph, so a ubuntu-only check would assert it
on the wrong runner` -- the `(D-12, D-14 row 1)` citation moved down into component (b), where
the attribution claim it belongs to now lives.

### Site 2 -- `capture-hashes.mjs`, the `FORBIDDEN_TARGETS` docblock

Lead line: ` * CORRECTED BY XOS-04 (Phase 12), and the replacement reason is supplied rather`

- (a) ` *   (a) WHAT THE ASSERTION STILL GUARDS, unchanged: the GRAPH PROPERTY itself.`
- (b) ` *   (b) WHAT IT NO LONGER ESTABLISHES: producer attribution.`
- (c) ` *   (c) WHERE THE ATTRIBUTION RECORD IS FROZEN:`

The docblock's first sentence was also corrected for accuracy while in there: it said the
targets are absent from "the Windows CI leg's RESOLVED task graph", and now says absent from
"the `nx run-many -t integration` RESOLVED task graph" -- which is what the code actually
resolves, and which stays true now that the Windows CI legs resolve other things.

### Site 3 -- `capture-hashes.mjs`, assertion 2's runtime failure message

This is a string an operator reads at the moment the assertion fires, not a comment. CONTEXT
names only one attribution site; there are two, and this is the louder one.

- Retained subject: `` `premise is that this command resolves no ${FORBIDDEN_TARGETS.join('/')} task, and that ` ``
- (a) `is a property of the RESOLVED GRAPH: with it false, suspect an Nx upgrade that changed the inferred dependsOn (D-12, D-14 row 1).`
- Correction lead: `CORRECTED BY XOS-04 (Phase 12), replacement reason supplied rather than the old claim merely deleted: this message used to add "so any such hash in the store is Linux-produced". It no longer does.`
- (b) `That producer attribution rested on a CONJUNCTION -- this premise AND the fact that Windows CI ran only \`integration\` -- and ci.yml's build-windows/typecheck-windows/test-windows legs falsify the second conjunct permanently.`
- (c) `The attribution record is FROZEN at .planning/phases/11-live-proofs-o1-o2-o3/11-EVIDENCE.md's O1 section; this assertion now guards the graph property alone.`

`FORBIDDEN_TARGETS`, `CONTROL_TARGET`, `resolvedTaskIds`, `targetSegment` and all six assertions
are unchanged. `npm run assert:graph-premise` exits 0 with `"verdict": "PREMISE OK"`.

## The exact phrases used in the 10-SECURITY.md append

Also requested by `<output>`. Each bold lead sentence, verbatim, in file order. All land INSIDE
`### Q1 (TRUST-11)` (line 91) and before `### Q2 (TRUST-12)` (line 219).

1. `**PHASE 12 RE-PRICING (XOS-04 / XOS-05), which is the promise the classification line above made when it said "re-priced by Phase 12".**`
2. `**Leg A -- D-02's \`needs:\` edge removes the concurrent race, and only the race.**`
3. `**Leg B -- what the edge does NOT do: it does not remove the second producer.**`
4. `**The write decision is FORCED, not chosen, and this is the measurement that forces it.**`
5. `**A sharpening that keeps the record honest: the second-producer fact is a CAPABILITY, not an observation about the proving run.**`
6. `**The TRUST-12 half: the exposure delta is now WHICH OS's output, never WHETHER output crosses.**`
7. `**No new C-row, and that is a decision rather than an omission.**`

Grep-able literals and their measured counts in that file:

| Literal | Count |
|---|---|
| `second producer` | 1 |
| `removes the concurrent race` | 1 |
| `select-backend.ts` | 3 |
| `D2-02` | 1 |
| `TRUST-05` | 3 |
| `DERIVED` | 1 |
| `XOS-05` | 4 |

The DERIVED marker reads, in full:
`Marked [DERIVED from \`12-RESEARCH.md\` F-6's \`postRunSteps\` call-site enumeration over Nx
23.1.0's \`task-orchestrator.js\`], not measured on a run, so a later security audit re-checks it
instead of inheriting it.`

The C-row decision names both rows: the second writer sits under **C1** (the write-trust
allowlist decides who may write, and it is OS-blind -- both legs are the same already-trusted
principal on the same ref), with the arbitration between same-hash writes under **C3**
(no-overwrite/409 per adapter, whose CREEP value is explicitly conditional on C1/C2).
`.planning/THREAT-MODEL.md` is unmodified (`git status --porcelain` over it returns empty).

## Verification

| Check | Result |
|---|---|
| `-t "windows"` | `6 failed \| 54 passed` -- all 6 failures in `windows-regression-detector.spec.ts` |
| Full suite | `6 failed \| 880 passed (886)`, `1 failed \| 40 passed (41)` files |
| `npm run assert:graph-premise` | exit 0, `"verdict": "PREMISE OK"` |
| `npx nx format:check --all` | exit 0 |
| `npm run lint` | exit 0, `Successfully ran target lint for project @op-nx/github-cache` |
| `npm run check:action` | exit 0 (ROBUST-04 confirmed, not assumed; run from the MAIN tree) |
| `-t "governance"` | `4 passed` -- email hygiene allowlist-inversion still green |

**Arithmetic on the suite:** 12-01 left `27 failed | 859 passed`. This plan leaves
`6 failed | 880 passed`. 859 + 21 = 880 and 27 - 21 = 6, so exactly the 21 leg assertions
flipped and **no pre-existing test changed state**. The 6 remaining reds are all in
`windows-regression-detector.spec.ts` and are plan 12-03's to close --
`.github/workflows/windows-regression-detector.yml` was deliberately NOT created here.

## Files Created/Modified

- `.github/workflows/ci.yml` (modified, +239/-16) - three new jobs inserted between `test` and
  `integration` so the four target-running jobs stay contiguous; invariant comment restated at
  seven wired jobs; graph-premise comment corrected.
- `capture-hashes.mjs` (modified, +42/-16... net +26) - both attribution sites corrected.
  Behaviour, constants and all six assertions unchanged.
- `.planning/phases/10-os-invariant-releases-mirror/10-SECURITY.md` (modified, +68) - seven
  appended paragraphs inside the existing Q1 section.

## Decisions Made

Recorded in the frontmatter `key-decisions`. The two that matter downstream:

1. **Three correction sites, not two.** `capture-hashes.mjs` carries the attribution claim in a
   docblock AND in a runtime failure-message string. Correcting only the comment would leave the
   false claim in the message a CI operator actually reads.
2. **No job-level `if:` on any leg, and the reason is written down in the guard rather than only
   in the plan.** That absence is what keeps the three legs PR-eligible, which is the only
   vehicle plan 12-06 has for its proving run.

## Deviations from Plan

### 1. [Rule 3 - Blocking] `roadmap.update-plan-progress` injected a duplicate plan list again

- **Found during:** the state-update step.
- **Issue:** Identical to 12-01's deviation 5. The handler does not recognise this ROADMAP's
  backtick-quoted descriptive plan entries and appended a second bare list of six, leaving
  twelve entries for six plans. It also re-mangled the progress-table cell separator to
  `In Progress|  |`.
- **Fix:** Deleted the injected bare list, restored the table row to
  `| 1/6 | In Progress | - |` shape with the correct count, and checked off `12-02-PLAN.md` in
  the existing descriptive list.
- **Files modified:** `.planning/ROADMAP.md`
- **Verification:** `rg -n "12-0[1-6]-PLAN.md" .planning/ROADMAP.md` returns exactly six lines.

### 2. [Rule 1 - Bug] `state.add-decision` joins summary and rationale with a non-ASCII em dash

- **Found during:** the state-update step.
- **Issue:** The handler joins `<summary>` and `<rationale>` with a U+2014 separator. `CLAUDE.md` forbids
  non-ASCII in file content, and `.planning/STATE.md` is a committed file. Two lines were
  affected -- the two decisions this plan recorded.
- **Fix:** Both em dashes replaced with ` -- ` by targeted `Edit`. Not reported upstream as a
  repo bug; it is a GSD tooling behaviour, recorded here so the next plan in this phase expects
  it.
- **Files modified:** `.planning/STATE.md`
- **Verification:** `git diff .planning/STATE.md | rg "^\+.*[^\x00-\x7F]"` returns nothing.

### 3. [Carried forward from 12-01] `requirements.mark-complete` deliberately NOT run

- **Issue:** 12-01 recorded that this handler falsely closed XOS-04/05/08 on a RED-only plan.
  Requirement traceability for this phase closes ONCE, at the orchestrator's `phase.complete`
  step, after the verifier runs. XOS-05 in particular is live-CI-only and cannot close before
  12-06.
- **Action taken:** the step was skipped entirely.
- **Verification:** `git diff --stat 0251bd3 HEAD -- .planning/REQUIREMENTS.md` is empty --
  the file is byte-identical to the phase-planning commit.

**Total deviations:** 3 (2 GSD state-tooling defects handled, 1 deliberate skip carried forward).
No plan clause was weakened; no assertion was softened; no stub was introduced.

## Threat Flags

None new. The plan's own register was re-checked rather than inherited:

- **T-12-04 (critical if present) -- CHECKED BY READING, and structurally absent.** The only
  `$GITHUB_ENV` writes in the three new legs are the two `NX_*` vars: a fixed literal loopback
  URL, and a locally minted `randomBytes(32)` hex token. Neither is record-, artifact- or
  PR-controlled, so the T-11-27 shape is not present. No task added an `echo` of any downloaded
  or record-derived value into `$GITHUB_ENV`.
- **T-12-05 -- ordering preserved.** `echo "::add-mask::${token}"` sits STRICTLY BEFORE the
  `NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN` write in all three copies, because the block was
  copied character for character rather than tidied.
- **T-12-SC -- verified, not asserted.** No `package.json` and no `package-lock.json` was
  touched; no package was installed.
- **T-12-01 / T-12-02 / T-12-03 -- dispositioned by Task 2**, which is the RECORD those rows
  call for.

## Known Stubs

None. Nothing in this plan is placeholder, mock-fed or deferred to a later layer. The three legs
run real Nx targets against a real sidecar on a real runner; the only thing they cannot do from
this repo is be OBSERVED, which is live-CI-only and is plan 12-06's deliverable by design.

## Issues Encountered

None blocking. Two GSD state handlers misbehaved (deviations 1 and 2); both were caught and
corrected before the docs commit.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **Plan 12-03** inherits an unchanged 6-assertion RED in `windows-regression-detector.spec.ts`
  and an `nx.json` registration that is already live, so its first commit rotates the `test` hash
  and no stale PASS is reachable. Nothing in this plan touched that workflow path.
- **Plan 12-06** inherits the thing it actually needs: three PR-eligible `windows-11-arm` jobs
  with no job-level `if:`, so a pull request is a sufficient vehicle for the O4 proving run and
  neither `on: schedule` nor a push to `main` is required.
- **The claim surface is consistent at HEAD.** No shipped comment or message asserts
  Linux-only production of `build`/`typecheck`/`test` any more, and every correction carries its
  replacement reason plus a pointer to the frozen record.

## Self-Check: PASSED

- `.github/workflows/ci.yml` - FOUND
- `capture-hashes.mjs` - FOUND
- `.planning/phases/10-os-invariant-releases-mirror/10-SECURITY.md` - FOUND
- `.planning/phases/12-windows-ci-reuse-o4-consumer-recipe/12-02-SUMMARY.md` - FOUND
- commit `f5dd429` - FOUND
- commit `c46b844` - FOUND

---
*Phase: 12-windows-ci-reuse-o4-consumer-recipe*
*Completed: 2026-07-30*
