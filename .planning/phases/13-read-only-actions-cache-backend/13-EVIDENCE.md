# Phase 13: the read-only Windows legs and their gated cross-OS counts (one evidence record)

**Captured:** 2026-08-02
**Commit at pre-registration:** the tip of `gsd/v0.0.2-os-invariant-cross-os-sharing` immediately
before the proving push (branch UNPUSHED at 31 commits ahead of `origin`'s `8a588d9`)
**Machine:** native Windows arm64, `process.platform=win32`, Node v24.13.0, Nx 23.1.0
**Tree:** the **MAIN tree** at `D:/projects/github/op-nx/github-cache` -- `.git` is a directory, not
a file, so this is NOT a git worktree and no junctioned `node_modules` is in play. Not boilerplate:
`check:action` reports FALSE drift from a junctioned worktree, and `11-EVIDENCE.md` records the same
check in the same position.

**NOT PERISHABLE.** Unlike Phases 9, 10 and 11, this record rests on no warm mirror shard and no
entry created in an earlier run. The property being observed is a SAME-RUN property: the ubuntu
producer saves and the Windows consumer restores inside one run, so the commit that rotates the
hashes is the same commit that proves the restore. No temporary `main` push is needed and none was
made.

This record has TWO sections by design. The PRE-REGISTRATION below was committed BEFORE the proving
run existed; the OBSERVATION was appended after it. **The pre-registration is never back-edited.**
A prediction that turns out wrong is recorded as wrong -- `09-EVIDENCE.md`'s `### OBS-04 -- SAMPLED,
and the prediction did NOT hold as written` is the precedent, and it is worth more than a claimed
pass.

---

## Headline

| Half | Verdict |
|---|---|
| **XOS-09 (Case A)** -- the three `windows-11-arm` legs are READ-ONLY and each one's `[remote cache]` count is GATED at a floor of 1, against Actions-cache entries the ubuntu legs saved in the SAME run | see the OBSERVATION section |
| **TEST-11** -- the new gate clauses are non-vacuous | **PROVEN LOCALLY**, by the three mutations recorded in `13-05-SUMMARY.md` and in the spec's own clause comments. Local mutation proves the CLAUSES can fail; it does NOT prove the live gate reddens |
| **Assumption A1** -- the Nx client tolerates a PUT `403` without failing the build or producing alarming output | see the OBSERVATION section |
| **Case B (Q4)** -- a PR restoring from the base/default-branch scope | **NOT OBSERVABLE HERE, BY CONSTRUCTION.** Carried as a named live-CI item in `ROADMAP.md` Phase 13, item 2, with its own procedure |
| The gate REDDENING on a genuine cross-OS restore failure | **NOT OBSERVED, and deliberately not induced.** Only visible on a real `windows-11-arm` runner after a ubuntu leg has saved; `13-VALIDATION.md`'s Manual-Only table says to confirm the failure direction by mutation rather than by breaking CI |

---

## The local battery, run from the MAIN tree BEFORE anything was pre-registered

Pre-registering against a red tree predicts nothing, so this ran first.

| Command | Result | Cache |
|---|---|---|
| `npm run test` (= `nx run-many -t test`) | **exit 0** -- 42 files, 975 tests, 975 passed | replayed (`Cache: 1/1 hit`) |
| `npx nx run-many -t test typecheck lint --skip-nx-cache` | **exit 0** -- same 42/975, plus `typecheck` and `lint` clean | **`Cache: Skipped (--skip-nx-cache)`** -- a real execution, not a replay |
| `npm run check:action` | **exit 0** -- `git diff --exit-code -- start-cache-server/index.js` clean | n/a |

The gating targets were re-run with `--skip-nx-cache` on purpose. This repository has a documented
stale-cache false PASS on `typecheck` -- it is the entire reason requirement LINT-04 exists -- so a
cached green is not evidence of an execution. The uncached line above is the one that counts; the
first row is recorded only to show the two agree.

---

## PRE-REGISTRATION -- committed BEFORE the proving run

Named here, before the run. **Recording a different value is a FINDING, not a reason to re-run and
not a reason to adjust the number.** Phase 12 established the idiom by fixing its counts in `f5d03b0`
before run `30586177358`; this section is the same move.

### The claim, stated in full

The three `windows-11-arm` legs -- `build-windows`, `typecheck-windows` and `test-windows` -- each
run with `CACHE_READ_ONLY=1` in `$GITHUB_ENV`, so each one's sidecar constructs a backend with **no
`put`**, and each leg's `[remote cache]` count is compared against a floor of 1 by a step that exits
non-zero below it.

Two clauses do the work and are stated separately so neither is lost:

- **Read-only is what makes the count GATEABLE.** With a writable sidecar the gate was launderable:
  a broken cross-OS restore made the leg MISS, execute and SAVE, and a re-run of the same commit then
  HIT that self-produced entry. Removing the write path removes the premise, so a green holds
  INDUCTIVELY -- of every run -- rather than only of this one.
- **`needs:` orders; it does not make correct.** The `needs:` edge is why the entry is PRESENT at
  all. Read-only-ness is why the Windows HIT MEANS something. Two arguments, kept apart.

### Expected `[remote cache]` counts, per leg

**Derived, not copied.** The resolved task set per target was re-measured at this commit with
`npx nx run-many -t <target> --graph <file>`, and agrees with the measurement Phase 12 took at
`03b0143`:

| Command the Windows leg runs | Resolved tasks | Expected count printed by that leg's GATE step |
|---|---|---|
| `npm run build` (`nx run-many -t build`) | 1 -- `@op-nx/github-cache:build` | **1** |
| `npm run typecheck` (`nx run-many -t typecheck`) | 2 -- `@op-nx/github-cache:typecheck` AND `@op-nx/github-cache:build`, via an inferred `dependsOn` | **2** |
| `npm run test` (`nx run-many -t test`) | 1 -- `@op-nx/github-cache:test` (`dependsOn: ["^build"]` resolves to zero extra tasks in this single-project workspace) | **1** |

Aggregate 4. **The aggregate is recorded and is NOT the gate.** The gate is per leg, and the gate is
a **FLOOR of 1**, not an exact pin on 1 / 2 / 1. Those three numbers are emitted by Nx's task graph
and legitimately move when the graph moves (D-05). A leg reading 2 where 1 was predicted is a
graph finding to investigate, never a gate failure; a leg reading 0 is a gate failure.

### A counting artifact, named BEFORE the run so the extra is not read as an extra HIT

**A reader counting the literal out of the JOB LOG will read one HIGHER than the gate's own printed
number, on each of the three Windows legs.** Measured on the most recent prior run, `30721656181`
(head `8a588d9`), whose Windows legs still carried the ungated Record step:

| Leg | Raw `rg -o -F "[remote cache]" <job log> \| wc -l` | The step's own printed count | Difference |
|---|---|---|---|
| `build-windows` | **2** | `1` | +1 |
| `typecheck-windows` | **3** | `2` | +1 |
| `test-windows` | **2** | `1` | +1 |
| ubuntu `build` / `typecheck` / `test` | 1 / 2 / 1 | n/a -- no count step | 0 |

The cause is mechanical: the runner ECHOES the count step's own shell body into the job log, and
that body contains the literal `grep -o -F '[remote cache]' <target>-nx.log`. The GATE itself counts
against `<target>-nx.log`, the tee'd Nx output, which carries no such echo -- so the gate's number is
the clean one and the job-log number is inflated by exactly one per leg.

**Predicted job-log raw counts on the proving run: 2 / 3 / 2. Predicted gate-printed counts:
1 / 2 / 1.** Both are stated because a record that gave only one of them would read as a discrepancy
against whichever number a future reader measured.

This artifact did NOT exist when Phase 12 measured `30586177358` at 1 / 2 / 1 from the job logs;
those legs had no count step. It arrived with the CR-18 dogfood-widening quick task, which added the
Record steps. So Phase 12's numbers and this phase's numbers are the same underlying quantity read
through two different instruments, and this paragraph is the conversion.

### Expected producer behaviour: all three ubuntu legs MISS-and-SAVE

Because of an EDIT, not a guess. The proving push carries these non-`.planning` files relative to
the remote tip `8a588d9`, which is what the last run measured:

| File | Which target's declared input | Where |
|---|---|---|
| `packages/github-cache/src/backend/actions-cache-backend.ts`, `backend/memory-backend.ts`, `lib/select-backend.ts`, `test/consumer-contract.ts` | `build` (non-spec `{projectRoot}/src/**/*.ts`) | `nx.json` `build.inputs` |
| the four changed `*.spec.ts` files, plus `build`'s rotated declaration outputs via `dependentTasksOutputFiles` | `typecheck` | `nx.json` `typecheck.inputs` |
| `.github/workflows/ci.yml`, `docs/configuration.md`, `docs/advanced.md`, `docs/versioning.md` | `test` | `nx.json` `test.inputs` |

So all three hashes ROTATE, and the expectation per producer is:

| Target | ubuntu leg | Predicted | Predicted `[remote cache]` count on the producer's own log |
|---|---|---|---|
| `build` | **MISS-and-SAVE** | rotated by four non-spec `src/**/*.ts` edits | **0** |
| `typecheck` | **MISS-and-SAVE** | rotated by the spec edits and by `build`'s rotated declaration outputs | **0**, but see the race below |
| `test` | **MISS-and-SAVE** | rotated many times over -- `ci.yml` and three `docs/` files are all explicit `test` inputs | **0** |

**One anticipated ambiguity, named IN ADVANCE so it is not read as a failure.** The ubuntu
`typecheck` job also resolves a `build` task, and the ubuntu `build` job has no `needs:` relationship
to it, so the two race for `nx-cache-<H_build>`. Whichever finishes first executes and saves; the
other HITs. That race predates this phase, it is covered by T-12-02, and NEITHER outcome invalidates
anything here. If the ubuntu `typecheck` leg reads **1** instead of **0**, that is the race resolving
the other way. Record which happened; do not treat it as a deviation.

### The count that would DIFFER under the failure hypothesis

Named before the run rather than after, because a number that only exists after the fact describes
rather than predicts.

| Hypothesis | `build-windows` gate | `typecheck-windows` gate | `test-windows` gate | Job outcome |
|---|---|---|---|---|
| Cross-OS restore is LIVE (predicted) | 1 | 2 | 1 | all three GREEN |
| **Cross-OS restore is DEAD** | **0** | **0** | **0** | **all three RED**, each with its own `::error::` |

**All three legs were converted rather than a subset, and that is exactly why.** A dead cross-OS
restore produces a three-way red, not an ambiguous one-leg red that could be blamed on the leg.

### SCOPE: this is Case A, and it says NOTHING about the base-scope read

Stated in both halves of this record, because over-reading a green is the same class of error CR-18
caught the first time.

The proving commit edits `packages/github-cache/src/**/*.ts` and `.github/workflows/ci.yml` plus
three `docs/` files -- all declared Nx inputs -- so **all three hashes rotate**. The ubuntu producers
therefore MISS and SAVE into the `refs/pull/12/merge` scope, and every Windows leg restores from
that same-run, same-scope entry. That is the **intra-run merge-ref path: Case A.**

- A green here proves **LIVENESS**: cross-OS restore works, read-only legs restore what ubuntu legs
  saved, and the gate observes it.
- A green here proves **NOTHING** about Case B -- a PR restoring from the base/default-branch scope,
  where the producers HIT and write nothing, so the merge-ref path cannot explain the Windows HIT.

**Case B cannot be exhibited by this commit and must not be written up as reproduced by it.** It is
carried as `ROADMAP.md` Phase 13 `**Live-CI close**` item 2, with its full procedure -- including the
step that VERIFIES Assumption A2 (`.planning/**` appears in no target's declared input set) FIRST,
rather than assuming it. That procedure is pointed at, not restated here, so there is one copy of it.

### Two things a reader must not over-read

1. **These three legs run the COMMITTED public `./start-cache-server` bundle.** The dogfood pair runs
   `uses: ./packages/github-cache` built in-job. Nothing in this gate ties the bundle to the source
   it was built from -- `action-bundle-drift` is the control that does. A green here is not evidence
   about uncommitted source, which is why `action-bundle-drift` is checked alongside it.
2. **A green Windows leg is NOT evidence the targets are PORTABLE.** A restored task does not
   execute. This is XOS-05's own anti-requirement 5 and it transfers verbatim: the success signal
   for cross-OS reuse is the IDENTICAL observation to a Windows-only regression being invisible
   forever. The scheduled `windows-regression-detector` workflow is what covers that, not this gate.

### How to count

`rg -o -F "[remote cache]" <log> | wc -l`. **Never `rg -c`**, which counts LINES rather than
occurrences. `-F` is mandatory because square brackets are a regex character class. Read the EXIT
CODE: `0` means hits, `1` means a genuine no-match, and **`2` means the command FAILED** while
printing zero lines, which is indistinguishable from absence if only the output is read. Count PER
LEG, from that leg's own job log -- never run-wide, which sweeps in the `integration` legs.

### VERDICT at pre-registration

**PENDING -- live-CI, the proving run does not exist yet.** Nothing above this line is an
observation. The counts, the producer expectations, the failure hypothesis and the scope statement
are all prediction. The observation record is below.
