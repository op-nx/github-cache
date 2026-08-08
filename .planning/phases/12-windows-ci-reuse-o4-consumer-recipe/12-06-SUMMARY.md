---
phase: 12-windows-ci-reuse-o4-consumer-recipe
plan: 06
subsystem: evidence-record
tags: [O4, XOS-04, XOS-05, XOS-08, pre-registration, PENDING, live-CI, TEST-08, D-18, D-19, D-20, D-22]

# Dependency graph
requires:
  - phase: 11-live-proofs-o1-o2-o3
    provides: "11-EVIDENCE.md's RESERVED O4 section, its four-row status table, and the two other O4 references this plan reconciles"
  - phase: 12-windows-ci-reuse-o4-consumer-recipe
    provides: "12-02's three windows-11-arm legs -- the subject of the claim, and the edit that falsifies the producer-attribution conjunct"
  - phase: 12-windows-ci-reuse-o4-consumer-recipe
    provides: "12-04's compare.ts edit -- the reason the ubuntu build leg is pre-registered as MISS-and-save rather than HIT"
provides:
  - "11-EVIDENCE.md's O4 section, filled IN PLACE: the claim, the pre-registered per-target counts with their derivation, the five anti-requirements, the corrected vehicle reason, the does-not-need list, the FORCED write decision, and a PENDING verdict slot"
  - "A six-step observation procedure handed to the operator, so the counts do not have to be reconstructed"
  - "A re-measured confirmation of the resolved task sets: build 1, typecheck 2, test 1"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "PENDING as an allowed TERMINAL outcome: the record states what was measured about repository state and refuses to state anything about a run that did not happen"
    - "Convert a reservation rather than delete it, so a reader sees what the slot was and what discharged it"
    - "Pre-registration written and committed in its own commit, BEFORE the observation-attempt commit, so commit order itself evidences that the counts predate the reading"

key-files:
  created:
    - .planning/phases/12-windows-ci-reuse-o4-consumer-recipe/12-06-SUMMARY.md
  modified:
    - .planning/phases/11-live-proofs-o1-o2-o3/11-EVIDENCE.md
    - .planning/STATE.md
    - .planning/ROADMAP.md

key-decisions:
  - "12-06: the O4 verdict is PENDING -- live-CI, first run of the proving PR, and that is a TERMINAL outcome for this plan rather than a failure. No proving run exists and none was created: the plan states at line 146 that opening the pull request is a carried OPERATOR decision, so no push, no gh pr create and no workflow trigger was performed."
  - "12-06: the reservation text was CONVERTED, not deleted. A reader can still see that the slot existed, what it forbade, and what discharged it. The reason the reservation existed -- that O4 permanently destroys O1's producer attribution -- is retained and upgraded from pending to REALISED, because plan 12-02's legs already falsified the second conjunct."
  - "12-06: RESEARCH assumption A1 is recorded as OPEN, not closed. The newest available hash-parity artifacts DO carry a per-leg discriminator block with stdout and stderr, which calibrates the instrument, but they record the PRE-hardening command. Closing A1 from them would be closing it by inference, which the plan forbids in as many words."
  - "12-06: two commits rather than one. The pre-registration landed FIRST and alone; the observation attempt landed second. That ordering is itself part of the evidence -- git log shows the counts were fixed before anything was read."
  - "12-06: requirements.mark-complete deliberately NOT run, carried forward from 12-01 through 12-05. XOS-05 in particular is not closeable without the live observation this plan did not obtain."

requirements-completed: []

coverage:
  - id: D1
    description: "11-EVIDENCE.md's RESERVED O4 section is discharged IN PLACE with the claim, the pre-registered counts and their derivation, all five anti-requirements, the corrected vehicle reason, the does-not-need list, and the FORCED write decision"
    requirement: XOS-04
    verification:
      - kind: manual
        ref: "rg sweeps recorded under ## Task 2 below: PRE-REGISTERED 1, MISS-and-save 4, compare.ts 2, CIRCULAR 1, paired with a COUNT 1, MISSes everything 1, refs/pull 9, does not trigger CI at all 1; ## O4 (XOS-04, XOS-05) heading count exactly 1; no 12-EVIDENCE.md anywhere"
        status: pass
    human_judgment: true
    rationale: "A doc artifact. This row records that the recording obligation is discharged; it does NOT close XOS-04's live half."
  - id: D2
    description: "The pre-registered per-target counts are traceable to a fresh measurement of the resolved task sets, not to a guess"
    requirement: XOS-08
    verification:
      - kind: manual
        ref: "## Task 1 measurement C below -- nx run-many -t <target> --graph, task ids enumerated per target: build 1, typecheck 2, test 1"
        status: pass
    human_judgment: false
  - id: D3
    description: "The O4 observation itself -- per-target [remote cache] occurrence counts on the three Windows legs, from the FIRST run of a same-repo proving pull request"
    requirement: XOS-05
    verification:
      - kind: manual
        ref: "PENDING. No proving run exists. Procedure handed over in 11-EVIDENCE.md's O4 section and under ## Open human-verify items below."
        status: pending
    human_judgment: true
    rationale: "Live-CI only, and the vehicle is an operator decision this plan is forbidden to take. Deliberately not claimed."

# Metrics
duration: 30min
completed: 2026-07-30
status: complete
---

# Phase 12 Plan 06: Close O4 -- Pre-Registration Recorded, Verdict PENDING Summary

**The O4 slot in `11-EVIDENCE.md` is discharged in place with everything that has to exist BEFORE the
observation -- the claim, the per-target counts, the five anti-requirements, the corrected vehicle
reason and the forced write decision -- and the verdict is an honest `PENDING`, because no proving
run exists and this plan is forbidden to create one.**

## Performance

- **Duration:** ~30 min
- **Tasks:** 3 of 3
- **Files modified:** 1 source-of-record file (`11-EVIDENCE.md`), plus `STATE.md` / `ROADMAP.md`

## Task Commits

| Task | What | Commit |
|---|---|---|
| 1 | pre-flight measurements -- changed no file, so no commit (the plan permits this) | none |
| 2 | the RESERVED O4 section discharged in place with the pre-registration | `f5d03b0` (docs) |
| 3 | the observation attempt recorded as PENDING, with the procedure handed over | `29484b3` (docs) |

**The two-commit split is load-bearing, not cosmetic.** `f5d03b0` contains the counts and contains no
observation; `29484b3` contains the attempt and adds no count. `git log` therefore evidences on its
own that the pre-registration predates the reading, which is what D-19 asks for and what a single
squashed commit could not show.

---

## Task 1: the four pre-flight measurements

### A -- the full local battery, all four green

Run from the MAIN working tree at `D:/projects/github/op-nx/github-cache` (`.git` is a directory, so
this is not a worktree and no junctioned `node_modules` is in play).

| Gate | Command | Result |
|---|---|---|
| tests | `npm run test` | **42 files passed (42), 896 tests passed (896)**, exit 0 |
| typecheck | `npm run typecheck` | exit 0, `Successfully ran target typecheck ... and 1 task it depends on` |
| lint | `npm run lint` | exit 0 |
| format | `npx nx format:check --all` | exit 0 |

Re-run after both task commits landed: identical, all four still exit 0 at `29484b3`.

**Baseline comparison the plan asks for.** The plan's stated baseline is 40 files / 856 tests; plan
12-04's SUMMARY records 41 files / 886 tests. This plan measures **42 files / 896 tests**. The delta
of +1 file and +10 tests is plan 12-05's `docs/cross-os.md` drift guard, landed after 12-04 wrote its
count. This plan adds no test of its own -- it edits only `.planning/**`, which is not an Nx input --
so an unchanged count from 12-05's is the correct outcome.

The `test` target's own run reported `Cache: 0/1 hit (0%)`, so it genuinely EXECUTED rather than
replaying a cached PASS. `typecheck` and `lint` reported `2/2` and `1/1` hits and were replays;
recorded plainly rather than presented as executions.

### B -- the action bundle, from the MAIN working tree

```
npm run check:action
```

**Exit 0. No drift. `start-cache-server/index.js` did not move and is in no commit of this plan.**

Recorded explicitly rather than omitted, because plan 12-04 touched a non-spec `src/` file and this
is the check that confirms ROBUST-04 was honoured rather than assumed. It was run from the main tree
only -- never from a junctioned worktree, where esbuild rewrites 689 module paths and reports a false
drift with no source edit. Verdict: the earlier plan's commits are correct on this axis and the
proving run is not blocked by a stale bundle.

### C -- the resolved task sets, re-measured and reconciled

`npx nx run-many -t <target> --graph <scratch>/graph-<target>.json` for each of the three targets,
task ids read out of the emitted graph's `tasks.tasks` map. Graph files were written to the session
scratchpad, never into the repository.

| Target | Pre-registered | Measured task ids | Count | Verdict |
|---|---|---|---|---|
| `build` | 1 | `@op-nx/github-cache:build` | **1** | **MATCHES** |
| `typecheck` | 2 | `@op-nx/github-cache:typecheck`, `@op-nx/github-cache:build` | **2** | **MATCHES** |
| `test` | 1 | `@op-nx/github-cache:test` | **1** | **MATCHES** |

The `typecheck` graph's `dependencies` map reads
`{"@op-nx/github-cache:typecheck":["@op-nx/github-cache:build"], "@op-nx/github-cache:build":[]}`, so
the second task is the inferred `dependsOn` edge and not an artefact of the invocation. `test`'s
`dependsOn: ["^build"]` resolves to zero extra tasks, confirming the single-project-workspace
reasoning the pre-registration rests on.

**No correction was needed.** The pre-registered expected `[remote cache]` occurrence counts stand
unchanged at **1 / 2 / 1, total 4**, and were committed in `f5d03b0` before any observation attempt.

`git status --porcelain` was empty before and after: no scratch graph JSON and no stray log file
entered the repository.

### D -- RESEARCH assumption A1: explicitly OPEN, NOT closed

**A1 stays OPEN and is carried as a human-verify item.** It was closed neither by inference nor by
the nearest available artifact.

What was actually READ, rather than assumed. The plan's instruction is to download
`hash-parity-<os>.json` for both legs once a CI run exists on this tree. The instrument was located
and verified to work, on the newest run that carries hash-parity artifacts at all
(`30500255530`, event `push`, branch `main`, head `38f9aea`):

| Leg artifact | `discriminator.command` | `discriminator.stdout` | `discriminator.stderr` | `status` |
|---|---|---|---|---|
| `hash-parity-ubuntu-24.04-arm` | `node -p process.platform` | `linux\n` | `` (EMPTY) | 0 |
| `hash-parity-windows-11-arm` | `node -p process.platform` | `win32\n` | `` (EMPTY) | 0 |

**What that establishes, and what it does NOT.** It establishes that the instrument exists and is
readable: `readDiscriminatorCommand` really does write a per-leg block carrying `command`, `stdout`,
`stderr` and `status`, on both OSes, with no new instrument needed -- so the plan's "free per-leg
verification" claim is confirmed rather than hoped for. It does **NOT** close A1, because the command
recorded there is `node -p process.platform`, the PRE-hardening spelling. A1 is specifically about
`node --no-warnings -p process.platform` on `linux/arm64`, and that literal entered `nx.json` in plan
12-04 (commit `3d9f895`), which is unpushed. **No CI run has ever executed on a tree carrying it.**

Recording the linux/win32 pair from the old command as if it closed A1 would be exactly the inference
the plan forbids at line 212. It is recorded above as a CALIBRATION of the instrument and a baseline
for comparison, labelled as such.

A useful correction for whoever closes it: the artifact NAMES are the RUNNER LABELS
(`hash-parity-ubuntu-24.04-arm`, `hash-parity-windows-11-arm`), not `hash-parity-<os>`; each contains
a same-named `.json` with a top-level `discriminator` key.

---

## Task 2: the RESERVED O4 section, discharged IN PLACE

`f5d03b0`, one file, 179 insertions / 20 deletions. `git show --stat` lists only
`.planning/phases/11-live-proofs-o1-o2-o3/11-EVIDENCE.md`.

### What the section now carries, in the plan's required order

1. **The CLAIM in full** -- the three `windows-11-arm` legs log the literal `[remote cache]` per
   resolved target, against entries the ubuntu legs saved IN THE SAME RUN, `needs:` ordering producer
   before consumer. Two clauses are broken out separately so neither is lost: *same run* (which is
   what makes the attribution readable within the run), and *`needs:` orders but does not make
   correct* (mirroring O3's own disclaimer, so XOS-06 is untouched).
2. **The PRE-REGISTERED counts** -- the 1 / 2 / 1 table with its resolved-task-set derivation and the
   note that the aggregate 4 is recorded but is NOT the gate; the per-target ubuntu MISS-and-save
   table with the EDIT that rotates each one (`compare.ts` for `build`, the new spec files plus
   rotated declaration outputs for `typecheck`, seven separate inputs for `test`); and the named
   `typecheck`-job-versus-`build`-job race ambiguity, tied back to the same shape this file already
   measured on run `30471772954`.
3. **All five ANTI-REQUIREMENTS** -- all-MISS is not a proof; a RE-RUN is not the proof; `Cache: n/m
   hit` is non-discriminating in both directions; green-with-no-count is not evidence; a green O4 leg
   is NOT a portability finding (CIRCULAR). Closed with XOS-05's own sentence about the success signal
   being identical to an invisible Windows-only regression.
4. **The vehicle and its CORRECTED reason** -- `ci.yml` is `on: push` for `main` plus
   `pull_request`, so a phase-branch push does not trigger CI at all and a same-repo PR is the ONLY
   vehicle short of pushing to `main`. The false fork-PR read-only-cache premise is named as false and
   REPLACED with the changelog's own wording, not merely deleted.
5. **What this proof does NOT need** -- no temporary `main` push; no warm mirror and no mirror row
   (the push-gated publish/dogfood/consumer jobs are SKIPPED on a PR run); and the `refs/pull/N/merge`
   entry is ephemeral and isolated.
6. **The write decision as FORCED** -- cross-referencing `10-SECURITY.md`'s Q1 Leg A / Leg B append
   made by plan 12-02 rather than restating it differently, plus the sharpening that a fully-restored
   Windows leg writes NOTHING, so the second-producer fact is a CAPABILITY that materialises on a
   Windows MISS.
7. **The VERDICT slot**, left at `PENDING -- live-CI, first run of the proving PR`, with an explicit
   line saying nothing above it is an observation.

The section also records that this file is NOT an Nx input, so no stale cached PASS is reachable and
no spec can usefully guard it -- Phase 11's Nyquist audit already declined that, and this does not
reopen it.

### The reservation was CONVERTED, not deleted

The section opens by quoting what the reservation said and naming plan 12-06 as its authorised
discharge. The reason the reservation existed is retained verbatim in substance and then **upgraded
from pending to REALISED**: plan 12-02's three legs already falsified the "Windows CI runs only
`integration`" conjunct, so the attribution loss is a fact rather than a risk, and the claim was
corrected at three sites in the same commit that caused it.

### The three other O4 references, reconciled in the same commit

| Site | Was | Now |
|---|---|---|
| `## Headline` status table, O4 row | `\| **O4 (XOS-04, XOS-05)** \| **RESERVED** -- Phase 12 \|` | left cell states the CLAIM in full (mirroring the O1 row's register); right cell opens `**PENDING -- live-CI, first run of the proving PR.**` then the pre-registered per-target counts, then "No observation recorded: no such run exists" |
| the intro paragraph (`:19`) | "O4 is RESERVED for Phase 12 and must be neither filled nor deleted here" | "O4's slot WAS reserved ... and plan 12-06 DISCHARGED that reservation IN PLACE", naming the verdict as PENDING |
| `## What remains unobservable` bullet | "**O4.** RESERVED above, and owned by Phase 12" | the section is filled; what remains unobservable is the OBSERVATION itself, and inventing one is named as the worst available outcome |
| calibrated-instruments row for `--assert-graph-premise` | "Phase 12's XOS-04 CHANGES this premise ... the flag must be re-read, not re-run blindly" | the change has LANDED: the assertion is byte-unchanged and still a real gate on the GRAPH PROPERTY, what moved is what it ESTABLISHES, and the correction sits at the three sites plan 12-02 actually edited |

Four sites, not the plan's three: the intro paragraph at `:19` also asserted the section was reserved,
and the success criterion is that no line asserts it is unfilled. Reconciled with the rest.

### Acceptance sweeps, with their exit codes read

All run against `.planning/phases/11-live-proofs-o1-o2-o3/11-EVIDENCE.md` with the path named
explicitly, because `.planning/` is a dot-directory and a bare `rg` traversal skips it silently at
exit 0 (PATTERNS M-1).

| Sweep | Required | Measured |
|---|---|---|
| `rg -n -F "## O4 (XOS-04, XOS-05)"` | exactly 1 line | **1** (line 1004) |
| `rg -c -F "RESERVED -- Phase 12"` | 0 | **exit 1** -- a genuine no-match, and it was already 0 before the edit, so the literal was never the discriminator |
| `12-EVIDENCE.md` anywhere under the phase-12 directory | absent | **absent** |
| `PRE-REGISTERED` | >= 1 | 1 |
| `MISS-and-save` | present | 4 |
| `[remote cache]` (needs `-F`) | present | 21 |
| `compare.ts` | present | 2 |
| `re-run` | present | 8 |
| `Cache:` | present | 11 |
| `CIRCULAR` | present | 1 |
| `paired with a COUNT` | present | 1 |
| `MISSes everything` | present | 1 |
| `refs/pull` | >= 1 | 9 |
| `does not trigger CI at all` | present | 1 |
| `PENDING -- live-CI` | present | 3 |
| non-ASCII | 0 | **exit 1** (pure ASCII) |
| negative control `zzz-not-present-control` | 0 | 0 |

Counted with `rg -o -F <needle> <file> | wc -l` throughout -- occurrences, never `rg -c`'s lines. The
negative control is included because a matcher that matched everything would satisfy every presence
assertion simultaneously.

**A defect in the plan's own `<automated>` verify command for this task, recorded rather than worked
around silently.** It reads
`... && rg -c -F "RESERVED -- Phase 12" <file> | rg -q '^0$'`. `rg -c` prints NOTHING and exits 1 when
there are zero matches -- it never prints `0` -- so that final clause fails precisely when the
criterion is SATISFIED. The chain is unsatisfiable as written. The three components were therefore run
separately and their exit codes read individually, which is what the criterion actually means.

---

## Task 3: the observation, recorded as PENDING

`29484b3`, one file, 73 insertions. `deferred-items.md` was deliberately NOT touched: no run executed
the `test` target on any leg, so there is nothing to append to its item 1.

### The result: no proving run exists, and none was created

**No observation is recorded.** Not a partial one, not an inferred one, not one reconstructed from an
earlier run. This is the plan's explicitly allowed terminal outcome.

Why there is no run, measured rather than asserted:

| Check | Command | Result |
|---|---|---|
| the branch's remote tip | `git ls-remote --heads origin gsd/v0.0.2-os-invariant-cross-os-sharing` | `38f9aea` -- the Phase 11 proving head, from 2026-07-29 |
| local tree ahead of that tip | `git rev-list --count 38f9aea..HEAD` | **55 commits**, all unpushed |
| is the tip an ancestor of HEAD | `git merge-base --is-ancestor 38f9aea HEAD` | YES -- so the remote is strictly behind, not divergent |
| open pull requests | `gh pr list --repo op-nx/github-cache --state open` | **none.** PR #11 is CLOSED, at head `38f9aea` |
| newest run in the repository, any branch | `gh run list --repo op-nx/github-cache --limit 1` | `30518183457`, event `schedule`, branch `main`, head `fe25a3f`, `2026-07-30T05:59:07Z` |

The three Windows legs landed in `f5dd429` (plan 12-02) and exist nowhere on the remote. CI can only
run on a pushed ref, so no run can carry them.

**No PR was opened, no branch was pushed, no workflow was triggered.** The plan states at line 146
that opening the pull request is a carried OPERATOR decision and that this plan "records it; it does
not open the pull request." Every `gh` call made by this plan was read-only: `run list`, `pr list`,
`api .../artifacts` and `run download`.

### The four shortcuts, refused explicitly

- **A workflow RE-RUN is not the proof.** None was sought. On a re-run the ubuntu leg restores the
  merge-ref entry the first run saved, so it HITs instead of MISS-and-saving and the in-run producer
  attribution evaporates.
- **An all-MISS run is not a proof.** No run at all was substituted for one.
- **A green job with no paired count is not a proof.** No green-job claim appears anywhere in the
  record.
- **A green O4 leg is NOT evidence the targets are portable.** No portability inference was drawn,
  and the anti-requirement naming that argument CIRCULAR is on record before any observation.

The record also names the VEHICLE requirement even in its PENDING state, so the handover cannot drift
to a weaker one: the FIRST run of a same-repo pull request, `run_attempt` = 1, and nothing else.

### The handover procedure, written into the evidence record

Six steps, so the operator does not reconstruct them: identify the run and confirm `run_attempt` is
`1`; count occurrences per Windows leg with `rg -o -F "[remote cache]" <log> | wc -l` against the
pre-registered 1 / 2 / 1 with targets named individually; record each ubuntu leg as MISSED-and-saved
or HIT plus the outcome of the `typecheck`-versus-`build` race; record the run id and URL and mark any
`Cache: n/m hit` line non-discriminating beside it; record any difference as a DIFFERENCE rather than
absorbing it into the pre-registration; and capture `test` output BEFORE any re-run if it fails, into
`deferred-items.md` item 1.

The same first run also closes A1 for free, and the procedure says how, with the corrected artifact
names.

---

## Verification

| Gate | Result |
|---|---|
| `npm run test` | exit 0 -- 42 files / 896 tests |
| `npm run typecheck` | exit 0 |
| `npm run lint` | exit 0 |
| `npx nx format:check --all` | exit 0 |
| `npm run check:action` (MAIN tree) | exit 0, no drift |
| O4 section filled in place, status table and all other O4 references reconciled | done, sweeps above |
| verdict is an observation OR an explicit PENDING | **explicit PENDING**, with the procedure handed over |
| `.planning/REQUIREMENTS.md` byte-identical to `0251bd3` | `git diff --stat 0251bd3 -- .planning/REQUIREMENTS.md` is EMPTY |
| ROADMAP plan list | exactly **6** entries, all `[x]` |
| STATE.md non-ASCII lines | **13**, unchanged from baseline |

---

## Open human-verify items, each with its exact reproduction command

These are the items this phase hands to a human. All four were surfaced by the plan itself;
`workflow.human_verify_mode` is `end-of-phase`, so they are verification items rather than blocking
checkpoints.

### 1. The O4 observation -- the FIRST run of a same-repo proving pull request (XOS-05, XOS-04)

Opening the PR is an OPERATOR decision. Once it exists, and on its FIRST run only:

```
gh run list --repo op-nx/github-cache --branch gsd/v0.0.2-os-invariant-cross-os-sharing --event pull_request
gh run view <run-id> --repo op-nx/github-cache --log-failed
gh run view <run-id> --repo op-nx/github-cache --json jobs -q '.jobs[].name'
```

Per Windows leg, against that leg's log:

```
rg -o -F "[remote cache]" <log> | wc -l
```

| Leg | PRE-REGISTERED occurrences | Targets to name individually |
|---|---|---|
| `build-windows` | **1** | `build` |
| `typecheck-windows` | **2** | `typecheck` AND `build` |
| `test-windows` | **1** | `test` |

Total **4**. `-F` is mandatory. `rg -c` counts LINES and is wrong. Exit code 2 means the command
FAILED while printing nothing. A re-run does not count; `run_attempt` must be `1`.

### 2. RESEARCH assumption A1 -- `--no-warnings` on `linux/arm64`

Closed by READING, from the same first run:

```
gh run download <run-id> --repo op-nx/github-cache \
  -n hash-parity-ubuntu-24.04-arm -n hash-parity-windows-11-arm -D <dir>
```

Then read the top-level `discriminator` block of each `<name>/<name>.json`. Expected: `command`
`node --no-warnings -p process.platform` on BOTH legs, `stdout` `linux` and `win32` respectively,
`stderr` **EMPTY** on both. A non-empty `stderr` on either leg is a **FINDING**, not a nuisance: Nx
hashes `trim(stdout) + trim(stderr)` together, so it means the hardening did not close the channel it
was chosen for.

Baseline for comparison, measured this session on run `30500255530` with the PRE-hardening command:
ubuntu `stdout` `linux\n` / `stderr` empty; windows `stdout` `win32\n` / `stderr` empty.

### 3. The scheduled Windows regression detector going green on a real `windows-11-arm` runner

A POST-MERGE first-run close, structurally impossible before merge: GitHub dispatches only workflow
files present on the DEFAULT branch. Carried from plan 12-03's coverage row D3.

```
gh workflow run windows-regression-detector.yml --repo op-nx/github-cache   # only after merge to main
gh run list --repo op-nx/github-cache --workflow windows-regression-detector.yml --limit 1
```

The gate is the printed success LINE, never the exit code:
`Successfully ran targets build, typecheck, test for project @op-nx/github-cache`.

### 4. Whether the consumer recipe is correct and safe to copy

A review judgement, not an assertion. Handled by `/gsd:code-review`.

---

## Deviations from Plan

### 1. [Rule 3 - Blocking] `roadmap.update-plan-progress` fired both of its known defects again

- **Found during:** the state-update step.
- **Issue:** identical to 12-01 through 12-05. It injected a duplicate BARE plan list (count went
  6 -> 12) and re-mangled the progress-table cell to `| 5/6 | In Progress|  |`, losing the separator
  spacing and the trailing `-`.
- **Fix:** deleted the injected bare list, checked off `12-06-PLAN.md` in the existing descriptive
  list, corrected the "**Plans**: N/6 plans executed" line to 6/6, and restored the table row to
  `| 6/6 | In Progress | - |`.
- **Files modified:** `.planning/ROADMAP.md`
- **Verification:** `rg -c "12-0[1-6]-PLAN.md" .planning/ROADMAP.md` returns **6**;
  `rg -n '^- \[ \] \x60?12-0' ` returns nothing; the file stays pure ASCII (`rg -c '[^\x00-\x7F]'`
  exits 1).

### 2. [Rule 1 - Bug] `state.advance-plan` wrote a non-ASCII em dash into STATE.md

- **Found during:** the state-update step.
- **Issue:** it set `Status: Phase complete <U+2014> ready for verification`, taking STATE.md's
  non-ASCII line count from 13 to 14. `CLAUDE.md` forbids non-ASCII in committed file content.
- **Fix:** replaced with ` -- `. Count back to **13**.
- **Files modified:** `.planning/STATE.md`

### 3. [Rule 1 - Bug] `state.add-decision` injected `[Phase ?]` markers

- **Found during:** the state-update step.
- **Issue:** both decisions were prefixed `- [Phase ?]:` rather than `- [Phase 12]:`. The handler also
  rejects positional arguments and requires `--summary`.
- **Fix:** both markers corrected to `[Phase 12]`. Passing ONLY `--summary` (no `--rationale`) avoided
  the em-dash join defect entirely this time -- the U+2014 is inserted as the summary/rationale
  separator, so a single-field decision never triggers it. Worth carrying forward.
- **Files modified:** `.planning/STATE.md`
- **Verification:** `rg -c '[^\x00-\x7F]' .planning/STATE.md` returns 13; neither 12-06 decision line
  carries `[Phase ?]`.

### 4. [Deliberate skip, carried forward from 12-01 through 12-05] `requirements.mark-complete` NOT run

- **Issue:** the handler falsely closes requirements. XOS-05 in particular is not closeable without
  the live observation this plan did not obtain, and closing it here would be exactly the fabrication
  the plan's threat register calls T-12-20.
- **Action taken:** skipped entirely. Traceability closes ONCE, at the orchestrator's `phase.complete`
  step, after the verifier runs.
- **Verification:** `git diff --stat 0251bd3 -- .planning/REQUIREMENTS.md` is EMPTY.

### 5. [Recorded, not fixed] The plan's Task 2 `<automated>` verify command is unsatisfiable as written

- **Issue:** its final clause is `rg -c -F "RESERVED -- Phase 12" <file> | rg -q '^0$'`. `rg -c` emits
  nothing and exits 1 on zero matches; it never prints `0`. So the clause fails exactly when the
  criterion is met.
- **Action taken:** ran the three components separately and read each exit code, which is what the
  criterion means. Recorded here rather than silently substituted. A correct form is
  `! rg -q -F "RESERVED -- Phase 12" <file>`.

### 6. [Recorded] Four O4 reference sites reconciled, not the plan's three

- **Issue:** the plan names the status table, the `## What remains unobservable` bullet and the
  calibrated-instruments row. The intro paragraph at `:19` ALSO asserted the section was reserved and
  must be neither filled nor deleted, which the success criterion forbids leaving in place.
- **Action taken:** reconciled it too, in the same commit.

**Total deviations:** 6 -- three GSD state-tooling defects handled, one deliberate skip carried
forward, and two recorded observations about the plan text itself. No plan clause was weakened, no
count was adjusted after the fact, and no verdict was claimed that no log showed.

---

## Known Stubs

None in code -- this plan edits only `.planning/**` and ships no source.

**One deliberate, documented PENDING, which is not a stub.** `11-EVIDENCE.md`'s O4 verdict slot reads
`PENDING -- live-CI, first run of the proving PR`. It is not a placeholder awaiting a later plan's
convenience: it is the honest state of a measurement that has not been taken, it is the plan's
explicitly allowed terminal outcome, and the section carries the full procedure to resolve it. The
opposite -- a verdict written from inference -- is the single worst outcome available in this plan and
is what `T-12-20` exists to prevent.

## Issues Encountered

None blocking. Three GSD state handlers misbehaved and were corrected before the docs commit.

## User Setup Required

None. The four open human-verify items above are operator decisions and observations, not
configuration.

## Threat Flags

None. The delta is two `.planning/**` documents. Re-checked rather than inherited:

- **T-12-04 (critical if present) -- CHECKED, structurally absent.** This plan writes no workflow
  YAML, adds no CI step and no `$GITHUB_ENV` line of any kind.
- **T-12-SC -- VERIFIED, not asserted.** No `package.json` and no `package-lock.json` in the
  changeset; nothing installed.
- **T-12-03 (log quoting) -- respected in advance.** No raw runner log excerpt is pasted anywhere. The
  only externally-sourced values recorded are a run id, an artifact name, and a `discriminator` block
  containing `linux` / `win32` and two empty strings. No `Bearer` header, no `NX_SELF_HOSTED_*` value,
  no absolute runner path.
- **T-12-20 (repudiation) -- this plan's whole subject.** Mitigated as the register specifies: counts
  pre-registered in the PLAN and committed before the observation attempt, five anti-requirements on
  record, PENDING treated as a legitimate terminal state, and a `<human-check>` that re-counts from
  the logs independently.

## Self-Check: PASSED

- `.planning/phases/12-windows-ci-reuse-o4-consumer-recipe/12-06-SUMMARY.md` - FOUND
- `.planning/phases/11-live-proofs-o1-o2-o3/11-EVIDENCE.md` - FOUND
- commit `f5d03b0` - FOUND
- commit `29484b3` - FOUND
- `.planning/REQUIREMENTS.md` byte-identical to `0251bd3` - CONFIRMED
- ROADMAP phase-12 plan list = 6 entries, all `[x]` - CONFIRMED
- STATE.md non-ASCII line count = 13 - CONFIRMED

---
*Phase: 12-windows-ci-reuse-o4-consumer-recipe*
*Completed: 2026-07-30*
