---
phase: 11-live-proofs-o1-o2-o3
plan: 06
subsystem: ci-workflow
tags: [green-half, o3-witness, integration-probes, positive-control, stale-comment-correction]
requires:
  - '11-05 RED: 17 assertions across two spec files, committed at 345ce56 and 932a13b'
  - '11-01 read-integration-hash.mjs at the workspace root'
  - '11-04 sign-off authorising the ci.yml test-hash rotation'
provides:
  - 'ci.yml integration job: 5 new probe steps, one shared step per probe on both legs'
  - 'ci.yml o3-witness job asserting the H_linux existence inequality with a 30 s stated margin'
  - 'CI artifact integration-hash-${{ matrix.os }} consumed by o3-witness'
  - 'anchored success literal o3-witness: EXISTENCE OK'
  - 'the three stale test-inputs comment blocks corrected WITH a replacement fact'
affects:
  - '11-07 (runs what this builds; its selectors depend on the literal names below)'
tech-stack:
  added: []
  patterns:
    - 'one shared step in a matrix job as symmetry BY CONSTRUCTION, never two conditioned copies'
    - 'brace group inside a pipeline so a legitimate zero-count grep does not abort under pipefail'
    - 'jq exact .key equality plus a ref filter plus a // empty terminator'
    - 'exit code PLUS an anchored content assertion as the double signal'
key-files:
  created: []
  modified:
    - .github/workflows/ci.yml
decisions:
  - 'The runner.debug recorder is ECHO-ONLY, not the fatal gate RESEARCH.md recommended'
  - 'o3-witness does not check out the repository; contents: read is restated anyway'
  - 'A THIRD stale test-inputs comment block was found in the typecheck job and corrected too'
metrics:
  duration: 25m
  completed: 2026-07-30
status: complete
---

# Phase 11 Plan 06: The O3 `ci.yml` instrumentation -- Summary

The GREEN half of plan 11-05's RED. `ci.yml` now carries the whole O3 instrument: five probe
steps inside the existing `integration` job, one shared step per probe so both matrix legs are
symmetric BY CONSTRUCTION, plus a new `o3-witness` job that asserts the existence inequality
from the cache service's own metadata and fails loud. All 17 of plan 11-05's assertions are
green and no assertion was touched.

## What was built

| Task | Commit | Change |
|---|---|---|
| 1 | `d3eaf22` | the `integration` job's 5 probe steps (D-16, D-17 a/b/c, D-21) |
| 2 | `39b6ffc` | the `o3-witness` job, three stale-comment corrections, rows A/B/C/E prose |

337 insertions, 14 deletions, in ONE file. `git diff --name-only HEAD~2 -- packages/
start-cache-server/` prints nothing, so no source file and no bundle-reachable file was touched.

## Observed GREEN -- measured, not predicted

Pre-registered by plan 11-06 itself: exactly **15** failing after task 1, exactly **0** after
task 2. Plan 11-05 measured the baseline at 823 passed / 0 failed and the RED at 17 failed /
823 passed (840 total).

| After | Observed Vitest summary | Pre-registered | Match |
|---|---|---|---|
| task 1 | `Tests  15 failed \| 825 passed (840)` | 15 | **exact** |
| task 2 | `Tests  840 passed (840)`, `Test Files  39 passed (39)` | 0 | **exact** |

The 825 at the task-1 checkpoint is 823 + 2, which is the arithmetic that mattered: exactly row
D's two phrases went green and nothing else did. A count BELOW 15 would have meant a phrase
matched pre-existing text, making that row a lock on nothing; it did not happen.

**840 is the target the orchestrator named and 840 is what was observed** -- 823 pre-existing
plus the 17 formerly-red. There is no delta to explain.

### The o3-witness describe block was observed to RUN, not merely to not-fail

`--reporter=verbose` names all seven cases as passed, which is the difference between a green
run and a describe block that silently never executed:

```
+ ci.yml o3-witness job exists and keeps its shape (XOS-03, TEST-09) > scopes to a real o3-witness job block that waits on integration
+ ... > declares a job-level permissions block at all
+ ... > RESTATES contents: read, which the job-level block would otherwise drop
+ ... > grants actions: read, which is what the two REST endpoints need
+ ... > runs on a SINGLE ubuntu-24.04-arm runner, not a matrix
+ ... > carries a timeout-minutes value -- generic hang insurance, like every other job
+ ... > carries the house if: !cancelled() form, so a red needs: dependency still gates
```

### No assertion was weakened

`git diff --name-only HEAD~2 -- packages/` is empty. Neither spec file was edited, skipped,
`.todo`'d or deleted. The guard was the specification and `ci.yml` conformed to it, in that
direction only.

## The ten locked literals, each verified on ONE line

All ten were written character for character from `11-05-SUMMARY.md` and then verified
programmatically: one `String.prototype.includes` pass per phrase over the raw file, reporting
the line numbers it landed on. Longest phrase is 70 characters; the deepest indent used is a
step-level comment (`      # `, 8-character prefix), so the worst case is 78 -- under the file's
own 97-character maximum, which is unchanged by this plan.

| Row | # | Line(s) | Where |
|---|---|---|---|
| A | 1 | 883, 1063 | both corrected `hash-parity` / `hash-parity-compare` blocks |
| A | 2 | 886, 1066 | same, one line apart from A1 in each |
| B | 1 | 665 | `o3-witness` `permissions` comment |
| B | 2 | 668 | same block |
| C | 1 | 615 | `o3-witness` block, the WHAT-THIS-JOB-DOES-NOT-ASSERT paragraph |
| C | 2 | 606 | `o3-witness` block, the margin paragraph |
| D | 1 | 555 | `integration` job, beside the positive control |
| D | 2 | 556 | same, the immediately next line |
| E | 1 | 632 | `o3-witness` block, the exact-key-equality paragraph |
| E | 2 | 636 | same paragraph |

Row A's two phrases appear TWICE each because both corrected blocks carry the replacement fact
independently. `toContain` is satisfied by one, but a reader arriving at either block needs it.

Row C landed in the `o3-witness` block rather than beside the label-count step, as plan 11-06
directs. That forced a deliberate wording choice in task 1: the label step's own comment says
`RECORDED and never GATED (the o3-witness block carries the full reason)`, which is NOT row C's
literal (`RECORDED and never GATED: a zero count is ...`). Writing the colon form there would
have satisfied row C one task early and broken the pre-registered 15.

The house not-a-guarantee clause -- `A measurement is not a documented guarantee` -- IS written
into the `o3-witness` margin paragraph as required in prose, and is correctly not pinned: the
literal already exists in the `publish` block, so a row asserting it would lock nothing.

## The literal names plan 11-07's selectors depend on

These are contracts, not labels. The witness's own `jq` filters name two of them, so a rename
in either place must land in the SAME commit as the other.

| Kind | Literal |
|---|---|
| job | `o3-witness` |
| rendered matrix job the witness selects | `integration (windows-11-arm)` |
| step the witness selects by name | `Run the integration target and tee its output` |
| step | `Record whether step debug logging is active` (first step of `integration`) |
| step | `Read this leg's integration hash from run.json` |
| step | `Record the remote-cache label occurrence count for this leg` |
| step | `Positive control on this leg's own key, which must return 200` |
| step | `Create the record directory before the download` |
| step | `Read H_linux from the ubuntu integration leg's record` |
| step | `Assert the H_linux cache entry existed before the Windows integration step started` |
| artifact (upload, per leg) | `integration-hash-${{ matrix.os }}` |
| artifact (download) | `integration-hash-ubuntu-24.04-arm` |
| anchored success literal | `o3-witness: EXISTENCE OK` |
| runtime files, never committed | `integration-nx.log`, `integration-hash.txt`, `o3-witness.log` |

Verified by parsing the YAML rather than by reading it: `yaml.parse` reports the `integration`
job's step sequence as debug-recorder, checkout, setup-node, `npm ci`, pre-set, sidecar,
readiness poll, **tee'd Nx run, hash read, upload, label count, positive control**, cancel. The
hash read is the IMMEDIATELY next step after the Nx run with nothing between them, which is the
load-bearing half: every `nx` invocation overwrites `.nx/cache/run.json`.

## The margin value chosen: 30 seconds

`MARGIN = 30`, stated in the comparison and echoed in every verdict line (`margin=30s`).

Chosen against a measured floor of **109 s** across 11 consecutive runs, ubuntu-first 11 of 11,
max 182 s on run `30471772954`. That is roughly **four times headroom**. A stated minimum rather
than a bare `<` is required because the two sides disagree on precision -- cache `created_at` is
sub-second, step `started_at` is whole-second -- so a bare comparison could be satisfied by a
truncation artefact alone. The floor-by-parsing-to-seconds is the truncation, and the 30 s
margin is what makes it harmless.

The margin is recorded as a MEASUREMENT and never as a guarantee, with the structural cause
named in the comment (`npm ci` at ~19 s on ubuntu against ~180 s on windows-11-arm), which is
what stops a reader promoting leg order into a correctness control.

## The two stale comment blocks were CORRECTED WITH a replacement reason, not deleted

This was the must_have most easily satisfied badly, so here is the evidence rather than the
claim. Both blocks previously asserted that `ci.yml` was NOT an `nx.json` `test` input and that
the comment was therefore the only place the rationale could live.

| Block | Before | After |
|---|---|---|
| above `hash-parity` | `This comment block is the ONLY place that rationale can live. ci.yml is NOT in nx.json's test inputs (only cleanup.yml is, nx.json:68) ...` | opens `CORRECTED, and supplying the REPLACEMENT FACT is the point rather than retracting the old one`, then states the current fact read from `nx.json`, names the two specs and the comment-stripped / raw split, and says why a bare deletion would be a regression |
| above `hash-parity-compare` | `NO SPEC ASSERTS ON THIS FILE, so this comment block is the only place the rationale can live ...` | opens `CORRECTED.`, quotes the retracted header, states the current fact, names the two specs, and records that the rationale still lives there because that is where a reader looks -- not because nothing else can see it |

Neither block still claims the file is outside `nx.json`'s `test` inputs, and neither is a bare
deletion: each supplies `nx.json:69`, PARITY-08 and Phase 9 as the replacement fact, plus the
reason the registration must not be removed (removing it turns every `ci.yml` content guard into
a replay of a pass computed before its subject existed -- which is how Phase 9 shipped a
regression).

## Hash rotation: the prediction held exactly

Measured from `.nx/cache/run.json` after both commits, via one
`npm exec -- nx run-many -t build,typecheck,test,integration`.

| Target | 11-05 baseline | Post-edit observed | Rotated |
|---|---|---|---|
| `build` | `17269409342684722256` | `17269409342684722256` | **NO -- byte-identical** |
| `typecheck` | `14220792214246320661` | `14220792214246320661` | **NO -- byte-identical** |
| `integration` | `4283357908429349587` | `4283357908429349587` | **NO -- byte-identical** |
| `test` | `188679580032851371` | `5057102264757918793` | YES |

`build` UNROTATED is the criterion that was named, and it held -- but so did `typecheck` and
`integration`, which is the sharper reading of D-10: `ci.yml` is registered as a `test` input
ONLY (`nx.json:69`), so a `ci.yml`-only plan rotates exactly one hash. Plan 11-05's spec edits
rotated three; this plan rotates one. The rotation was authorised by plan 11-04's gate.

`read-integration-hash.mjs` was smoke-tested against the live `run.json` in the same session:
it printed `integration hash=4283357908429349587 cacheStatus=local-cache-hit status=0` and wrote
**19 bytes** whose last byte is `0x37` (the hash's own final character), so the no-trailing-
newline byte assertion from plan 11-01 still holds. The output file was deleted immediately; it
is a runtime artifact and is not committed.

## The mechanics were verified locally before being committed, not assumed

Every non-obvious shell and `jq` construct in the witness was exercised against fixtures on this
box before it went into `ci.yml`. This matters because the witness's whole failure mode is
passing on the happy path.

| Mechanic | Probe | Result |
|---|---|---|
| `date -u -d` parses the sub-second cache form and floors it | `date -u -d "2026-07-29T16:40:21.612895000Z" +%s` vs `date -u -d "2026-07-29T16:43:23Z" +%s` | delta **182** against RESEARCH's measured 181.4 s -- the parse works and the floor IS the truncation |
| exact `.key` + `.ref` match | fixture holding the same key on two refs plus a longer key sharing the prefix | returns only the `refs/heads/main` entry's `created_at` |
| `// empty` on absence | same fixture, absent key | `out=[]`, and `[ -z "$out" ]` passes. Without the terminator the emptiness test is false and the guard passes on absence |
| jobs-endpoint selector | fixture with both matrix legs and a decoy step | returns the Windows `started_at`; a renamed step OR a renamed job both yield EMPTY, so a rename fails loud |
| tolerant zero label count | `{ grep -o -F '[remote cache]' log \|\| true; } \| wc -l` on a log with no match | `count=[0]` under `set -euo pipefail`, not an aborted leg |
| occurrences, not lines | same, on a log with two labels on ONE line | `count=[2]`, which a line-count flag would have reported as 1 |

## Local battery

| Check | Result | How it was asserted |
|---|---|---|
| `nx test github-cache` | **GREEN, 840 passed / 0 failed** | the printed Vitest summary, plus `--reporter=verbose` naming all 7 new cases |
| `nx typecheck github-cache` | GREEN | `rg -c 'Successfully ran target'` = 1 under `NO_COLOR=1` |
| `nx lint github-cache` | GREEN | same |
| `nx format:check` | GREEN | ran after `npm run format` on both tasks; prettier reflowed nothing and folded no step name |
| `npm run check:action` | **GREEN, exit 0** | run in the MAIN tree, so this is a true verdict rather than the junctioned-`node_modules` false drift. `git diff --exit-code -- start-cache-server/index.js` produced no output |
| YAML validity | GREEN | `yaml.parse` over the whole file; 18 jobs; `o3-witness` reports `needs=integration`, `if=${{ !cancelled() }}`, `runs-on=ubuntu-24.04-arm`, `timeout=15`, `permissions={contents:read, actions:read}` |
| `continue-on-error` | absent as YAML | 5 textual hits, all inside pre-existing comments -- confirmed by inverting the match on `#` |
| `needs.*.result` | absent as YAML | 3 textual hits, all inside comments (one of them the witness's own statement that it carries none) |
| `if:` mentioning `matrix.os` | absent as YAML | 1 textual hit, inside the comment that states nothing carries one |
| non-ASCII | none | a per-line scan of the whole file |
| `packages/` and `start-cache-server/` | UNCHANGED | `git diff --name-only HEAD~2 --` over both paths printed nothing |

`typecheck` and `lint` were asserted on the PRINTED success line rather than on the exit code,
per this repo's recorded trap that `nx run-many` on a missing target exits 0. `NO_COLOR=1` is
required because Nx bolds the target name mid-phrase, which is what defeated a literal match in
plan 11-05.

## Deviations from Plan

### 1. [Rule 2 - missing critical correctness] A THIRD stale `test`-inputs comment block was found and corrected

- **Found during:** task 2, while locating the two blocks the plan enumerates.
- **Issue:** the `typecheck` job carried a third instance of the same stale claim:
  `note ci.yml is NOT in nx.json's test inputs (only cleanup.yml is), so such a guard would
  need ci.yml added there or it goes stale behind a cache hit`. The plan, RESEARCH.md Pitfall 1
  and PATTERNS.md all name exactly TWO blocks, so this one was outside the enumerated scope.
- **Why it was not left alone:** the must_have's own stated reason for requiring a replacement
  reason is that a bare deletion leaves a future reader holding a documented case for REMOVING
  the registration. A third surviving copy of that case is the same defect the correction
  exists to close -- and it also said `cleanup-workflow.spec.ts is the precedent ... if that
  ever becomes worth enforcing`, which is now false twice over. Correcting two of three
  instances would have satisfied the letter of the must_have while leaving its purpose unmet.
  Phase 9's recorded lesson is exactly this: a documentation-scoped sweep declared itself
  complete while two instances survived.
- **Fix:** corrected in place with the replacement fact (`PARITY-08 registered it
  (nx.json:69)`, both spec names, `the precondition is already met -- only the drift guard
  itself would be new work`), and `cleanup-workflow.spec.ts` retained as the precedent for the
  SHAPE. Deliberately written WITHOUT row A's locked literals, so the phrase locks keep
  pointing at the two blocks the guard's own JSDoc names.
- **Files modified:** `.github/workflows/ci.yml` (comment only).
- **Commit:** `39b6ffc`.

### 2. The `runner.debug` recorder is echo-only, and its context value goes through `env:`

Echo-only is the plan's own recorded decision, not a deviation. What IS a small shape choice
inside the plan's latitude: RESEARCH.md's snippet interpolates `${{ runner.debug }}` directly
into the `run:` body, and this step passes it through the step's `env:` instead
(`RUNNER_DEBUG_OBSERVED`). The plan's acceptance criterion only forbids `${{ matrix.os }}` in a
`run:` body, so the direct form would have been permitted -- but the `hash-parity` capture
step's recorded rule is that a context value reaches the script through `env:` so it never
lands on a command line the shell re-parses, and there is no reason for this step to be the one
exception. The recorded value is unchanged; `${RUNNER_DEBUG_OBSERVED:-<unset>}` prints `<unset>`
rather than an empty string when debug is off, which reads better in the evidence transcript.

A distinct variable name was used rather than reading the runner's own `RUNNER_DEBUG`, because
`runner.debug` is the DOCUMENTED surface and the env var is an implementation detail.

### 3. The witness's verdict is tee'd through a brace group, not a single piped command

`hash-parity-compare`'s precedent is one command piped into `tee`. The witness needs several
statements, so the whole sequence is wrapped in `{ ...; } 2>&1 | tee o3-witness.log` followed by
the anchored `grep`. This preserves both halves of the double signal AND the reason the anchor
is load-bearing: failure detail still merges into the same log the `grep` reads, so an
unanchored match could still hit a mid-line substring of a failure line. `exit 1` inside the
group exits the pipeline's subshell, `pipefail` propagates it, and `set -e` fails the step
before the `grep` ever runs -- so the exit code remains the first verdict and the content
assertion the second.

## Known Stubs

None. Every step added is fully wired: the tee feeds the label count, the reader feeds the
artifact and the positive control, the artifact feeds `o3-witness`, and the witness's verdict is
gating from its first commit. No placeholder, no hardcoded empty value, no advisory period.

## Deferred Items

`integration-nx.log`, `integration-hash.txt` and `o3-witness.log` are NOT in `.gitignore`.
They are created only inside CI jobs on ephemeral runners, so nothing is at risk in CI -- but a
local `npm run integration` followed by a manual reader invocation leaves `integration-hash.txt`
untracked. Not added here on purpose: `.github/workflows/ci.yml` is the only file this plan is
scoped to change, and a `.gitignore` edit would break that. Logged rather than done.

## Requirements

**Nothing was flipped.** `XOS-03` and `TEST-09` stay **Pending** -- they close at plan 11-07,
which runs what this plan built. `TEST-08` stays **Pending** for Phase 12. This plan ships the
instrument; the instrument has not yet been fired.

## Threat Flags

None beyond the register plan 11-06 already carries. The `o3-witness` job adds two read-only
REST GETs authenticated with the existing `${{ secrets.GITHUB_TOKEN }}`, requests `actions: read`
and never `actions: write` (the cache DELETE verb), introduces no new credential, no new network
listener, no file-access pattern and no schema change. T-11-01, T-11-02, T-11-05, T-11-22,
T-11-07 and T-11-04 are all mitigated as planned; T-11-23 and T-11-SC remain accepted, and no
package was installed.

## TDD Gate Compliance

`workflow.tdd_mode` is true. This plan is the **GREEN** half of a RED/GREEN pair whose RED
landed in plan 11-05, one plan earlier by design so the RED evidence survived.

| Gate | Commit | Status |
|---|---|---|
| RED | `345ce56`, `932a13b` (`test(11-05): ...`) | present, in plan 11-05 |
| GREEN | `d3eaf22`, `39b6ffc` (`feat(11-06): ...`) | present, this plan |
| REFACTOR | n/a | no behaviour to clean up; the change is CI configuration |

Both GREEN commits carry a `feat(11-06):` subject. No test passed unexpectedly: HEAD was
verified RED at 17 before task 1, was measured at exactly the pre-registered 15 after task 1,
and reached 0 only after task 2. Two `feat` commits rather than one because the plan defines two
tasks with two pre-registered counts, and collapsing them would have destroyed the task-1
checkpoint that proves row D and only row D went green first.

## Self-Check: PASSED

- `.github/workflows/ci.yml` exists on disk and parses as YAML with 18 jobs, one of which is
  keyed `o3-witness`.
- Commits `d3eaf22` and `39b6ffc` are both reachable in `git log`.
- `git diff --diff-filter=D --name-only` across both commits lists no deletion.
- `git status --short` is clean and lists no untracked file.
- No file outside `.github/workflows/ci.yml` was modified by either commit.
