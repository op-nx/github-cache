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

---

## OBSERVATION -- the proving run

**Nothing above this line was edited to produce this section.** The pre-registration stands as
written, including the one prediction it got wrong, which is recorded as wrong below.

### The run

| Item | Value |
|---|---|
| Run id | **`30744366870`** (run number 169) |
| Run URL | `https://github.com/op-nx/github-cache/actions/runs/30744366870` |
| Trigger | `event: pull_request` -- a `synchronize` on same-repo PR #12, fired by pushing this branch |
| `attempt` | **1** -- the FIRST run of this head. A re-run would be disqualified, not merely discouraged: on a re-run the ubuntu producer restores the entry the first run saved, so the producer attribution WITHIN the run evaporates |
| `headSha` | **`631a2e7`** -- which IS the pre-registration commit |
| Conclusion | `success`, 24 job legs (3 `skipped`: `publish`, `publish-verify`, `consumer-smoke`, all push-gated) |
| Created / finished | `2026-08-02T10:45:24Z` / `2026-08-02T10:49:45Z` |

**The ordering claim is structural rather than a timestamp comparison.** The run's `headSha` is the
pre-registration commit itself, so the prediction was in the tree the run measured. It could not
have been written afterwards.

### Per-leg counts, named INDIVIDUALLY, with the gate's own printed line

Every number below is the leg's own gate step output, quoted from that leg's job log.

```
remote-cache label occurrences on windows-11-arm (build): 1 -- GATED at a floor of 1
remote-cache label occurrences on windows-11-arm (typecheck): 2 -- GATED at a floor of 1
remote-cache label occurrences on windows-11-arm (test): 1 -- GATED at a floor of 1
```

| Leg | Pre-registered gate count | Observed gate count | Floor of 1 | Job | Verdict |
|---|---|---|---|---|---|
| `build-windows` | 1 | **1** | met | `success` | **MET** |
| `typecheck-windows` | 2 | **2** | met | `success` | **MET** |
| `test-windows` | 1 | **1** | met | `success` | **MET** |
| aggregate (recorded, NOT the gate) | 4 | **4** | -- | -- | MET |

The targets named individually, from each leg's Nx output:

| Leg | Target(s) restored | Nx key | Bytes received |
|---|---|---|---|
| `build-windows` | `build` | `nx-cache-6303782621882711279` | 137951 |
| `typecheck-windows` | `build` AND `typecheck` | `nx-cache-6303782621882711279`, `nx-cache-12280368578858856585` | 137951, 98227 |
| `test-windows` | `test` | `nx-cache-12695567002797499449` | 1309 |

All three legs report `Nx read the output from the cache instead of running the command for N out of
N tasks` -- 1/1, 2/2 and 1/1 respectively. **`Cache: n/n hit (100%)` is NON-DISCRIMINATING IN BOTH
DIRECTIONS** and is recorded only because the requirement says to record it: a `0%` prints
identically with no sidecar at all, and a non-zero count includes LOCAL hits. The per-leg
`[remote cache]` label count is the gate; that line is not.

### Each producer's own line

This is what separates liveness from correctness. The producer's line is why the entry was PRESENT
at all (the `needs:` edge); read-only-ness is why the Windows HIT means what it says.

**ubuntu `typecheck` -- MISSED and SAVED, twice.** It resolved `build` as well as `typecheck` and
executed both. Transcribed from its own log; the group-marker glyph is rendered `[OK]` because this
record is ASCII-only:

```
##[group][OK] > nx run @op-nx/github-cache:build
> tsc --build tsconfig.lib.json
[command]/usr/bin/tar --posix -cf cache.tzst ... --use-compress-program zstdmt
Sent 137951 of 137951 (100.0%), 0.4 MBs/sec
##[group][OK] > nx run @op-nx/github-cache:typecheck
> tsc --build tsconfig.json --emitDeclarationOnly
[command]/usr/bin/tar --posix -cf cache.tzst ... --use-compress-program zstdmt
Sent 98227 of 98227 (100.0%), 0.3 MBs/sec

  Cache:             0/2 hit (0%)
```

**ubuntu `test` -- MISSED and SAVED.** It executed the suite (975 tests) before saving:

```
Sent 1309 of 1309 (100.0%), 0.0 MBs/sec

  Cache:             0/1 hit (0%)
```

**ubuntu `build` -- HIT.** It restored the entry the ubuntu `typecheck` job had already saved:

```
Cache hit for: nx-cache-6303782621882711279

  Cache:             1/1 hit (100%)
```

| ubuntu leg | Predicted | Observed | Verdict |
|---|---|---|---|
| `typecheck` | MISS-and-SAVE (`0`) | **MISS-and-SAVE, `0/2`** | **MET** |
| `test` | MISS-and-SAVE (`0`) | **MISS-and-SAVE, `0/1`** | **MET** |
| `build` | MISS-and-SAVE (`0`), with the race named in advance as either outcome | **HIT, `1/1`** -- the race resolved to the `typecheck` job | **the anticipated race, NOT a deviation** |

The pre-registration named this race and said explicitly that neither outcome invalidates anything.
It resolved the same way Phase 11's `List 3` measured it on run `30471772954`: the `build` hash was
written by the `typecheck` job rather than by the `build` job. **`needs:` ordering still holds
transitively** -- `build-windows` waits on the ubuntu `build` job, which had itself already
demonstrated the entry existed by restoring it.

### The producer-to-consumer tie, at the byte

Not inferred from the label alone. The saved and received sizes match exactly, per entry:

| Entry | ubuntu producer SENT | Windows consumer RECEIVED |
|---|---|---|
| `nx-cache-6303782621882711279` (`build`) | 137951 (ubuntu `typecheck`) | 137951 on `build-windows`, 137951 on `typecheck-windows` |
| `nx-cache-12280368578858856585` (`typecheck`) | 98227 (ubuntu `typecheck`) | 98227 on `typecheck-windows` |
| `nx-cache-12695567002797499449` (`test`) | 1309 (ubuntu `test`) | 1309 on `test-windows` |

### The read-only knob, observed on the wire

Each leg's regular pre-set step wrote the knob, and the sidecar step that follows shows it in its
inherited env -- so the `$GITHUB_ENV` write propagated, which is the whole reason it is not in the
background step's own `env:`:

```
echo "CACHE_READ_ONLY=1" >> "$GITHUB_ENV"
##[group]Run ./start-cache-server
env:
  NX_SELF_HOSTED_REMOTE_CACHE_SERVER: http://127.0.0.1:3000
  NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN: ***
  CACHE_READ_ONLY: 1
```

Corroborated by absence: **`Sent <n> of <n>` appears ZERO times on all three legs.** No leg saved
anything. And the obsolete claim is gone -- `RECORDED, never gated` occurs **0** times in each of
the three job logs.

`action-bundle-drift` is **GREEN** on this run, which is the control that ties the committed
`./start-cache-server` bundle to its source. These three legs run that committed bundle; the dogfood
pair runs `uses: ./packages/github-cache` built in-job. Nothing in this gate ties the two, which is
why the bundle job is recorded here beside it.

### A PREDICTION THAT DID NOT HOLD: the job-log raw counts

Recorded as a miss rather than smoothed over, per `09-EVIDENCE.md`'s precedent.

| Leg | Pre-registered raw job-log count | Observed | Verdict |
|---|---|---|---|
| `build-windows` | 2 | **3** | **NOT met** |
| `typecheck-windows` | 3 | **4** | **NOT met** |
| `test-windows` | 2 | **3** | **NOT met** |

**The mechanism was right; the multiplier was wrong.** The pre-registration measured the echo
artifact against run `30721656181`, whose legs still carried the OLD Record step -- a two-line body
containing the literal exactly once, in the `grep` needle. The step this phase installed has a
four-line body containing it **twice**: once in the `grep` needle and once inside the `::error::`
message, which reads `got ${count} [remote cache] labels`. So the runner's command echo contributes
**+2** per leg, not +1.

The correction, which is what a future reader should use:

| Quantity | How to get it | Value this run |
|---|---|---|
| The GATE's number, and the only one that gates | the leg's own printed `remote-cache label occurrences ...` line, counted from `<target>-nx.log` | 1 / 2 / 1 |
| The JOB LOG raw count | `rg -o -F "[remote cache]" <job log> \| wc -l` | 3 / 4 / 3 -- the gate number **plus 2** |

The pre-registered GATE counts (1 / 2 / 1) were MET exactly. Only the derived job-log figure was
wrong, and it was wrong because the instrument changed under it in this phase's own commit. That is
worth recording precisely because a record that reported only the clean numbers would have hidden a
live drift between two ways of reading the same quantity.

### Assumption A1 -- NOT EXERCISED on this run, and structurally so

RESEARCH.md's A1 is: *the Nx client tolerates a PUT `403` without failing the build or producing
alarming output*, flagged "Confirm on the landing run". The observation is honest and negative:

| Check, over all three read-only legs | Result |
|---|---|
| Tasks that MISSed | **0** -- every leg reports `n/n` restored |
| Save attempts (`Sent <n> of <n>`) | **0** |
| `##[warning]` / `##[error]` annotations | **0** |
| `NX Warning` / `NX Error` banners, `Failed to save`, `Cache upload` | **0** |
| Occurrences of `403` or `forbidden` in Nx or sidecar output | **0** -- the only `403` substrings in these logs are inside ISO timestamps and a toolcache path, which is why this row says the count is zero rather than three |

**A1 cannot be answered by a run in which nothing MISSes.** The `403` only exists on a PUT, a PUT
only follows an EXECUTED task, and a leg on which every pre-registered count is MET is precisely a
leg on which no task executed. This is the same shape `11-EVIDENCE.md` already recorded for the
second-producer capability: a fully-restoring run is exactly the run that exercises none of it.

**Status: A1 remains OPEN, now with a stated observation condition instead of a vague one.** It is
observable on a green run -- it does not need a red one. `typecheck-windows` resolves TWO tasks, so
a run where one HITs and one MISSes prints a count of 1, clears the floor, stays GREEN, and attempts
exactly one PUT that receives a `403`. That is the run to read. No `OBS` requirement is opened for
it, per RESEARCH open question 3: the recommendation was to observe first and build only if the log
is actually confusing, and there is still no evidence it is.

What this run DOES establish about the 403 path: on the read-only legs there was **no output of any
kind** a reader could mistake for a failure. That is consistent with A1 and is not a test of it.

### SCOPE, restated: Case A

Every prediction in the pre-registration's scope section held. All three hashes rotated, all three
ubuntu producers were reached, and every Windows leg restored a same-run, same-scope
(`refs/pull/12/merge`) entry. **Every leg took the intra-run merge-ref path.**

- **PROVEN:** cross-OS restore is LIVE, read-only Windows legs restore what ubuntu legs saved in the
  same run, and the gate observes it at a floor of 1 per leg.
- **NOT PROVEN, and not touched:** the base/default-branch scope read. **Case B.** See `ROADMAP.md`
  Phase 13 `**Live-CI close**` item 2 for the procedure, including the step that VERIFIES Assumption
  A2 before the PR is opened. This run must not be cited as reproducing it.

### What this run does NOT establish

- **That the gate REDDENS on a genuine cross-OS restore failure.** Not observed, and deliberately
  not induced. `13-VALIDATION.md`'s Manual-Only table says to confirm the failure direction by the
  TEST-11 mutation check rather than by breaking CI, and that is what was done: three mutations,
  recorded in `13-05-SUMMARY.md`, each reddening exactly the intended clause. **Local mutation
  proves the CLAUSES are non-vacuous. It does not prove the live gate reddens.** Those are two
  claims and only the first is made here.
- **That a PARTIAL cross-OS regression would be caught.** The gate is a floor of 1 per leg, and
  `typecheck-windows` resolves two tasks -- so a drop from 2 to 1 clears the floor and the leg stays
  green. The floor was chosen deliberately (D-05: the counts follow Nx's task graph and an exact pin
  would break on a graph change), and this is its cost, stated rather than left for a reader to
  discover. The per-target counts recorded above are the record against which such a drop would be
  legible.
- **That the targets are PORTABLE.** A restored task does not execute. The success signal here is
  the IDENTICAL observation to a Windows-only regression being invisible forever; the scheduled
  `windows-regression-detector` workflow is what covers that, not this gate.
- **Anything about uncommitted source.** These legs run the committed `./start-cache-server` bundle.
  `action-bundle-drift` is the control, and it is green on this run.

### VERDICT

**XOS-09: PROVEN for Case A.** Run `30744366870`, attempt 1, `event: pull_request`, head `631a2e7`.
All three read-only Windows legs green, gate counts 1 / 2 / 1 against a pre-registered 1 / 2 / 1 and
a floor of 1, with all three ubuntu producers reached and the byte sizes matching per entry.

**TEST-11: PROVEN locally by mutation**, live gate-reddening not observed and not required to be.
**SUPERSEDED by the ADDENDUM below** -- live gate-reddening WAS subsequently observed on a real
`windows-11-arm` runner. This line is left as written rather than back-edited, per this file's own
"nothing above this line was edited" discipline.

**Assumption A1: OPEN**, with a named observation condition. **Case B: OPEN**, carried in ROADMAP.

---

## ADDENDUM -- the gate FAIL path, observed on a real runner (2026-08-02)

**Why this exists.** `13-VERIFICATION.md` returned `human_needed` on exactly one point: the gate's
FAIL path had never executed on a real runner. Run `30744366870` exercised only the PASS path, and
non-vacuity had been proven by mutating the SPEC's input -- not by running the real bash with a zero
count. The maintainer elected to close it by observation rather than by precedent.

### Method

A throwaway branch `gsd/13-gate-failpath-proof` (draft PR #13, commit `bafd7be`) appended
`--skip-nx-cache` to **`build-windows`'s target run only**, forcing zero `[remote cache]` labels into
`build-nx.log`. That is the exact observable state the gate exists to catch, so the gate's own code
path ran end to end: the `grep -o -F` with its `|| true`, the `wc -l`, the `-lt 1` comparison, the
`::error::` annotation, and `exit 1`.

`typecheck-windows` and `test-windows` were left **UNPERTURBED in the same run as a positive
control** -- this repo's TEST-09 idiom. Their staying green is what makes the red attributable to the
count rather than to the runner, the queue, or an `@actions/cache` regression.

### The run

| Item | Value |
|---|---|
| Run id | **`30745558383`** |
| Run URL | `https://github.com/op-nx/github-cache/actions/runs/30745558383` |
| Trigger | `event: pull_request` (draft PR #13, base = this phase branch) |
| `headSha` | **`bafd7be`** -- the perturbation commit |
| Conclusion | `failure`, as designed |

### Result -- the discrimination that matters

| Leg | Perturbed | Count | Job | Failing step |
|---|---|---|---|---|
| `build-windows` | YES (`--skip-nx-cache`) | **0** | **failure** | **`Gate on the cross-OS remote-cache label count for this leg`** |
| `typecheck-windows` | no (control) | **2** | success | -- |
| `test-windows` | no (control) | **1** | success | -- |

**The job reddened AT THE GATE STEP, not at the build and not at the readiness poll.** This is the
load-bearing check: a red job proves nothing on its own, because `ci.yml:527`'s pre-existing bare
`exit 1` in the readiness poll can redden the same job for an unrelated reason -- which is precisely
the vacuity trap TEST-11 was written to avoid. The failing step is named explicitly above.

The annotation emitted was the gate's own, verbatim:

> `build-windows got 0 [remote cache] labels, but this leg is read-only and can only get one by
> restoring the ubuntu build job's entry. Either cross-OS restore is broken (an @actions/cache
> regression or a cache-version drift), or the ubuntu producer never populated the entry this run.
> Check the producer job's own log for a HIT or a save before assuming the former.`

The two control legs returned **2** and **1** -- byte-identical to their pre-registered values in
this file's PRE-REGISTRATION section, measured on a different run and a different commit.

### What this does NOT prove

- **That a genuinely broken cross-OS restore is what produces a zero.** The perturbation produced
  the zero by skipping the cache, not by breaking a restore. That a broken restore yields zero is a
  property of the BACKEND and is carried by the inductive read-only argument (a leg with no write
  path can only get a label from the producer's entry), not by this observation.
- **Case B.** Unchanged and still open; see ROADMAP Phase 13 Live-CI item 2.

### Cleanup

Draft PR #13 closed and branch `gsd/13-gate-failpath-proof` deleted after this record was written.
No perturbation reached the phase branch: `--skip-nx-cache` exists only on `bafd7be`, which is not
an ancestor of any retained ref.

### REVISED VERDICT

**TEST-11: PROVEN, live.** The gate's fail path executes as designed on a real `windows-11-arm`
runner -- correct step, correct annotation, non-zero exit, job red -- with a same-run positive
control isolating the cause to the count.

---

## ADDENDUM 2 -- reproduction on a second head (run 30746080731)

Recorded during the phase audit tail, after the four previously-unpushed commits were pushed to
PR #12. Appended, never back-edited, on the same append-only discipline as ADDENDUM 1.

**Observation.** Run `30746080731`, event `pull_request`, head `e6b3268`, conclusion `success`.
All three read-only Windows legs green at the gate, at the counts read out of their own gate lines:

| Leg | Gate-printed count | Floor |
|-----|--------------------|-------|
| `build-windows` | 1 | 1 |
| `typecheck-windows` | 2 | 1 |
| `test-windows` | 1 | 1 |

1 / 2 / 1 -- identical to the counts pre-registered in `631a2e7` and observed on the proving run
`30744366870`.

### What this DOES add

A second independent execution of the gate, on a different head, three runs after the
pre-registration. The gate is not a one-run artifact.

### What this does NOT add, stated because over-reading a green is the mistake CR-18 caught

- **It is not an independent Case-A instance.** Every commit between `631a2e7` and `e6b3268`
  touches only `.planning/`, which is in no Nx target's declared input set. No task hash rotated,
  so this run consumed the SAME producer entries the proving run did. It reproduces the
  observation; it does not re-derive it from a fresh producer.
- **Case B is untouched.** Still open, still ROADMAP Phase 13 Live-CI item 2. A run whose hashes
  did not rotate cannot exhibit the base-scope read by construction.
- **Assumption A1 is untouched.** Every task HIT again, so again no PUT was attempted and no 403
  path was exercised. The stated observation condition is unchanged: a partial miss on the
  two-task `typecheck-windows` leg clears the floor, stays green, and produces exactly one 403.

---

## ADDENDUM 3 -- both live-CI residuals CLOSED (quick `260802-toz` and `260803-0rr`)

Appended 2026-08-03, never back-edited. Everything above this line was correct for the tree and the
runs it describes; this section supersedes the OPEN status those sections record for Case B and for
assumption A1. In particular ADDENDUM 2's two "untouched" bullets and the `Assumption A1: OPEN`
line earlier in this file are superseded here rather than edited in place.

### Case B -- PROVEN on run `30768540898`

Closed by quick `260802-toz`. Event `pull_request`, draft PR #14, head `7188a66` -- which IS the
pre-registration commit, so the prediction was provably in the tree the run measured.

All three ubuntu producers HIT and emitted **no `Sent` line at all**, so nothing was written into
the PR's merge-ref scope during the run. The three Windows legs nonetheless restored entries whose
keys are byte-identical to the ones `main`'s scope received from run `30767511870`:

| Leg | Key restored | `Received` | Baseline `Sent` | Gate count |
|-----|--------------|-----------|-----------------|------------|
| `build-windows` | `nx-cache-6303782621882711279` | 137951 | 137951 | 1 |
| `typecheck-windows` | `nx-cache-11553684120103592295` (+ the build dep) | 98227 | 98227 | 2 |
| `test-windows` | `nx-cache-11565398464176149070` | 1299 | 1299 | 1 |

Counts 1 / 2 / 1, exactly as pre-registered, all three legs GREEN. No same-run merge-ref entry
existed for them to have restored, so the entries came from a scope populated BEFORE the run
started. That is Case B, and it is what the gate's soundness argument needs.

**Scope, unchanged from the pre-registration.** It does not distinguish BASE-branch scope from
DEFAULT-branch scope -- for a PR off `main` they are the same ref. The narrower proven claim is
"restored from a scope populated before the run, outside this run's merge ref".

**Unplanned finding carried forward: `o3-witness` is not Case-B-safe.** That job asserts a CREATION
ordering (the linux entry came into existence before the Windows integration step began). On a
Case-B run nothing is created, so the assertion has no event to observe and the job reddens. The
first post-Phase-13 PR touching no declared input will hit this. It is a FALSE red -- the three
read-only legs were green in that very run. Follow-up, not fixed by either quick task.

### Assumption A1 -- ANSWERED AFFIRMATIVELY, by local measurement

Closed by quick `260803-0rr`. Full write-up and controls:
`.planning/quick/260803-0rr-address-a1-so-that-it-can-be-closed/260803-0rr-EVIDENCE.md`.

The route changed. A1's row said "Confirm on the landing run", but a landing run in which every
task HITs exercises none of the path -- the reason this file recorded A1 OPEN three times. It was
instead answered LOCALLY, with no source change and no CI cycle, because `server.ts:128-133`
answers a read-only PUT with 403 and RETURNS BEFORE `handlePut`: no backend method runs on a
refused PUT, so the backend's identity provably cannot affect the PUT path. That makes the existing
`createReadOnlyMemoryBackend` exactly equivalent for this question, and PUT-maximal besides -- it
is permanently empty, so every task must execute and every execution is a store opportunity.

A tap on the real `createCacheServer` recorded eight requests across two runs, four GET/PUT pairs
at real Nx task hashes:

```
GET /v1/cache/6303782621882711279  -> 404   |  PUT -> 403     run 1 (build)
GET /v1/cache/11553684120103592295 -> 404   |  PUT -> 403     run 1 (typecheck)
GET /v1/cache/16145199525155793066 -> 404   |  PUT -> 403     run 2, hashes rotated (build)
GET /v1/cache/3356125849110639811  -> 404   |  PUT -> 403     run 2, hashes rotated (typecheck)
```

1. **Nx DOES attempt a store after a MISS** -- four PUTs, one per executed task. This is the fact
   A1 could not establish, and it is what the two-way ambiguity turned on.
2. **The backend refuses each with 403**, at the protocol boundary, without being consulted.
3. **Nx swallows it in complete silence** -- the definitive run's full 30-line output contains zero
   occurrences of `403`, `forbidden`, `refus`, `store`, `fail`, `could not`, `unable`, `error` or
   `warn`.
4. **The build still succeeds** (`Successfully ran target typecheck`).

**What transfers to CI, stated narrowly:** *given a 403 to a store, this pinned Nx emits no
output.* That is a property of the client and the protocol response, not of the environment, so it
holds on `windows-11-arm`. **It is an inference, not a measurement:** no CI run has directly
observed a PUT arriving. The silence on run `30768554184` is now best EXPLAINED by this mechanism
rather than being ambiguous between "refused silently" and "never attempted".

**Incidental, and it cuts the other way if you invert it:** because a store IS attempted,
`server.ts:128-133` is reachable in ordinary operation. Had no PUT arrived, the finding would have
been that the project ships a read-only guard production never exercises.

**Incidental corroboration of the OS-invariant work:** run 1's hashes `6303782621882711279` and
`11553684120103592295` are byte-identical to the keys recorded from CI run `30767511870`, whose
producers are ubuntu. A local Windows 11 arm64 machine and an ubuntu runner computed the same task
hashes -- exactly what the discriminator work predicts, observed here as a side effect.

**Latent since Phase 10.** `10-EVIDENCE-PRE-RENAME.md:88` ran a local sidecar against a read-only
backend with a control row reading "no PUT-to-read-only-backend crash". It stood on this exact seam
and recorded only that nothing crashed, never whether a PUT arrived. That omission IS A1's
residual, and it read as coverage for three phases.

**The method hazard worth carrying:** one harness run reported a clean "Nx said nothing" while
adding ZERO tap lines -- served entirely from local cache, so it never contacted the instrument. It
was rejected as vacuous. Root cause: `NX_CACHE_DIRECTORY` is NOT honoured by Nx 23.1.0 here (a
verifiably empty directory still produced `[local cache]` 2/2). Coldness was forced by ROTATING THE
HASH instead. Before believing any silence, count the requests the run actually made.

### What remains open after this addendum

Nothing from the `**Live-CI close**` block. Both items are closed; `ROADMAP.md` is updated to
match. The `o3-witness` Case-B limitation above is a new follow-up, not a residual of either item.
