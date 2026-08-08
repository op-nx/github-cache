---
phase: quick-260808-u2q
plan: 01
subsystem: ci-workflow
tags: [github-actions, force-push, publish-gate, evidence-capture]
requires:
  - "the temporary main window procedure (operator_plan items 2 and 3)"
provides:
  - "publish gated on !github.event.forced, so a window RESTORE push writes nothing"
  - "a dedicated live spec assertion that reddens BY NAME when the clause is deleted"
  - "the window procedure recorded in ci.yml and at its point of use in HANDOFF.json"
  - "a written rule that keeps the next battery run's output"
affects:
  - ".github/workflows/ci.yml"
  - "packages/github-cache/src/dogfood-cross-os.spec.ts"
  - "AGENTS.md"
  - ".planning/HANDOFF.json"
tech-stack:
  added: []
  patterns:
    - "job-level if: gate on a server-computed webhook field, fail-closed"
    - "dedicated named assertion + mutation proof matched on the Vitest FAIL-line prefix"
key-files:
  created: []
  modified:
    - ".github/workflows/ci.yml"
    - "packages/github-cache/src/dogfood-cross-os.spec.ts"
    - "AGENTS.md"
    - ".planning/HANDOFF.json"
decisions:
  - "!github.event.forced over github.event.forced == false -- identical under GitHub's loose equality, fewer coercion questions for a future reader"
  - "publish only; publish-verify inherits the skip through needs: publish and the restatement was declined for the minimal diff"
  - "no tripwire for a wrongly-skipped publish -- it fails closed and the gap is recoverable by construction"
  - "AGENTS.md, not .planning/, is the home for the capture rule, because there is no committed battery script and AGENTS.md is what the next agent loads"
metrics:
  duration: ~50 min
  completed: 2026-08-08
status: complete
---

# Quick Task 260808-u2q: Stop the temporary-main-window restore force-push from firing the production publish legs Summary

The `publish` job now carries `&& !github.event.forced`, so a window RESTORE push (a
rewind) skips the production mirror path while a window-OPEN push (a fast-forward) still
runs it -- with the mechanism, the measurement, the incident and the window procedure
written into the `publish` rationale block, and a dedicated spec assertion that reddens by
name if the clause is deleted.

## WHAT THIS DOES NOT PROVE

Stated plainly, in the plan's own terms, and not softened.

Everything gated by this task is STATIC:

- The `if:` expression is asserted as TEXT (a spec regex over the extracted `publish` job
  block). That proves the clause is present, exact, and scoped to `publish`. **It proves
  nothing about how GitHub evaluates it.**
- No local check can distinguish `forced: true` from `forced: false`. The webhook payload
  does not exist on this workstation.
- `actionlint` does NOT resolve locally (`command -v actionlint` -> rc=1, measured). It
  exists in this repo only inside the `ppe` composite action, which self-installs it on a
  runner and swallows its exit, so it is ADVISORY annotations in CI and never a gate. It
  was not installed. **No local workflow linter gates this change.**

**THE BEHAVIOURAL PROOF ARRIVES ONLY ON THE NEXT REAL WINDOW, which is operator-plan item
3.** That window is the run that will carry it, in two directions:

- (a) the window-OPEN push (fast-forward) MUST show `publish` and `publish-verify` RUNNING;
- (b) the RESTORE push (rewind) MUST show `publish` and `publish-verify` SKIPPED.

Item 3's operator records both. Until then this change is **CORRECT-BY-ARGUMENT AND
STATICALLY-GATED**. It is not proven, not verified in CI, and not confirmed working.

This task also did NOT open a window, did NOT push to `main` (`origin/main` is still
`fe25a3f865f20f3d4f8a40e96f8cb5717608ba8a`, measured after both commits), did NOT merge
anything, and did NOT touch the five `refs/backups/*` on origin (all five still present at
`fe25a3f`, measured).

## What Was Built

### Task 1 -- the clause, its rationale, and its guard (commit `92998de`)

`.github/workflows/ci.yml`, the line immediately after `^  publish:$`:

```yaml
    if: ${{ !cancelled() && github.event_name == 'push' && !github.event.forced }}
```

Exactly one `if:` line in the file carries the forced clause, and it is that one (G2 scope
bound; localization done independently by G1's adjacency read).

`packages/github-cache/src/dogfood-cross-os.spec.ts`:

- (a) the existing positive control `scopes to a real publish job block` was TIGHTENED to
  require the new clause, so it keeps matching the real line;
- (b) a NEW dedicated assertion was added, titled
  `skips publish on a FORCED push, so a temporary-main-window restore writes nothing (D-U2Q)`,
  carrying its own reason literal
  `a rewind push to main would resume real production Release writes`.

### Task 2 -- capture, and the procedure at its point of use (commit `0cd43b4`)

`AGENTS.md` gained a level-1 `# Capturing test-battery output` section; `.planning/HANDOFF.json`
`operator_plan` item 3's `detail` was APPENDED to (pre-existing text intact).

## The measured shape table (verbatim)

Produced by `gh api repos/op-nx/github-cache/events --paginate` filtered to `PushEvent` on
`refs/heads/main`, then `sort | uniq -c | sort -rn`. TOTAL = 70 lines.

```
      1 fe25a3f -> d043eec
      1 fe25a3f -> ce19770
      1 fe25a3f -> c53a096
      1 fe25a3f -> 9ec4739
      1 fe25a3f -> 70064f5
      1 fe25a3f -> 6992553
      1 fe25a3f -> 5693d90
      1 fe25a3f -> 38f9aea
      1 fe25a3f -> 1e5bc10
      1 fe25a3f -> 180c3d3
      1 fe25a3f -> 1162a01
      1 fe08c7c -> 98da97a
      1 fc07786 -> 5960afa
      1 e56e5d2 -> fe25a3f
      1 dd3fd85 -> bfd5143
      1 d8d5311 -> 8b2977f
      1 d043eec -> fe25a3f
      1 cf22aea -> 0793f08
      1 ce19770 -> fe25a3f
      1 ca2124b -> c06664f
      1 c77d144 -> 94d903e
      1 c53a096 -> fe25a3f
      1 c06664f -> 4c85b7a
      1 c05cc3c -> c01a949
      1 c01a949 -> 98da97a
      1 bfd5143 -> 2d3cfc5
      1 ba33c9f -> cf22aea
      1 b9c513d -> 16e9479
      1 a5db762 -> 7e36937
      1 9ec4739 -> fe25a3f
      1 9935af3 -> fc07786
      1 98da97a -> d8d5311
      1 98da97a -> ca2124b
      1 98da97a -> 4aea37d
      1 98da97a -> 3adf625
      1 97d7d6a -> 98da97a
      1 94d903e -> 91e8d65
      1 91e8d65 -> 15afbdd
      1 8fa51ae -> 8555fa8
      1 8eb5f80 -> 76cad87
      1 8b2977f -> a5db762
      1 8555fa8 -> 70efaf8
      1 7fec51e -> 5907d08
      1 7e36937 -> 97d7d6a
      1 76cad87 -> 8fa51ae
      1 70efaf8 -> c05cc3c
      1 70064f5 -> fe25a3f
      1 6992553 -> fe25a3f
      1 65bb227 -> 656216f
      1 656216f -> 50c9932
      1 63ba48e -> dd3fd85
      1 5c21f9d -> 8eb5f80
      1 5c112d4 -> ba33c9f
      1 5960afa -> 5c112d4
      1 5907d08 -> fe08c7c
      1 5693d90 -> fe25a3f
      1 50c9932 -> 270dc84
      1 4c85b7a -> 17b5902
      1 4aea37d -> 7fec51e
      1 3adf625 -> b9c513d
      1 38f9aea -> fe25a3f
      1 2d3cfc5 -> e56e5d2
      1 270dc84 -> 9935af3
      1 1e5bc10 -> fe25a3f
      1 180c3d3 -> fe25a3f
      1 17b5902 -> 63ba48e
      1 16e9479 -> 98da97a
      1 15afbdd -> 65bb227
      1 1162a01 -> fe25a3f
      1 0793f08 -> 5c21f9d
```

Classified by SHAPE, mechanically rather than by memory:

| Shape | Count | Measurement |
|---|---|---|
| right side is `fe25a3f` | 12 | `rg -c -e ' -> fe25a3f$'` |
| of which the PR #7 merge push (`e56e5d2 -> fe25a3f`) | 1 | `rg -c -F -e 'e56e5d2 -> fe25a3f'` |
| **restores (rewinds)** | **11** | 12 minus the merge |
| **window-opens (`fe25a3f -> tip`, fast-forwards)** | **11** | `rg -c -e '^fe25a3f -> '` |
| fe25a3f era total | 23 | 12 + 11 |
| older pushes predating the restore point | 47 | 70 - 12 - 11 |
| **TOTAL** | **70** | `wc -l shapes-raw.txt` |

**The per-shape split in the comment is checked by READING this table against the comment;
that half is NOT script-checked.** Only the TOTAL is script-checked, by G5, which requires
the literal `MEASURED PUSH SHAPES: 70 pushes to refs/heads/main` to be present. The reader
is expected to check the rest against the table above.

The measurement is anchored to `origin/main == fe25a3f` and dated `observed 2026-08-08`
because the events feed is a rolling window; the record is meaningless once `main` moves.

## The inserted ci.yml rationale block (verbatim)

Quoted in full because G4b is a LENGTH FLOOR, not a content check -- it kills bare label
lines and nothing more. Whether the prose is TRUE is checked by reading it.

```
  # WHY the if: also carries `&& !github.event.forced` (D-U2Q). The temporary `main` window is
  # this project's only sanctioned instrument for observing a push-only job: push the feature tip
  # to `main`, let the push jobs run, then force-push `main` back to its restore point. That
  # RESTORE push is itself a push to the default branch, so before this clause it fired the whole
  # production mirror path a SECOND time, over a tree that was already mirrored. Suppressing it
  # from the commit message is structurally unavailable -- the restore re-pushes an EXISTING
  # commit and cannot alter its message without changing the very SHA it is restoring.
  #   FORCE-PUSH MECHANISM: the git push wire protocol carries no force bit -- the update command
  #   on the wire is `<old-oid> <new-oid> <refname>`, and --force is a CLIENT-side policy that
  #   send-pack applies locally and never transmits. So GitHub can only be computing `forced`
  #   server-side from non-fast-forwardness. Consequence worth having: an operator who types
  #   --force-with-lease on a fast-forward window-OPEN push still gets `forced: false`, and that
  #   push still publishes. The discriminator is robust against operator habit, not against it.
  #   MEASURED PUSH SHAPES: 70 pushes to refs/heads/main, observed 2026-08-08 while
  #   origin/main == fe25a3f -- 11 restores (tip -> fe25a3f, every one a rewind), 11 window-opens
  #   (fe25a3f -> tip, every one a fast-forward), the single PR #7 merge push that CREATED
  #   fe25a3f (e56e5d2 -> fe25a3f, a fast-forward, and it SHOULD have published), and 47 older
  #   pushes predating that restore point. 23 in the fe25a3f era, separating 23/23 with zero
  #   misclassification. ANCHORED on purpose: the events feed is a rolling window and this record
  #   is meaningless once `main` moves, so re-measure it rather than carry the numbers forward.
  #   THE INCIDENT, run 30825636788: a restore-shaped run that reached
  #   POST /repos/op-nx/github-cache/releases and got 422 -- a real production write ATTEMPTED
  #   under this job's `contents: write` grant, not a dry run. The 422 itself is the separate,
  #   already-documented burned-shard defect in
  #   .planning/debug/publish-verify-422-empty-shard.md; do not conflate the two. Five of the
  #   restore-shaped runs concluded `success` and completed their uploads.
  #   SKIP DIRECTION: a wrongly-skipped publish means no production write at all -- that push's
  #   entries stay in the Actions cache and the next default-branch push mirrors them. This is
  #   not a new failure mode: it is verbatim the trade the needs: paragraph below already
  #   accepts, one recoverable gap rather than a wrong artifact on the world-readable mirror.
  #   HISTORY-REWRITE EXCEPTION: push one empty forward commit -- a fast-forward, so it publishes
  #   -- if the mirror is wanted immediately. A deliberate shared-history rewrite of `main` is
  #   the one legitimate force-push here and it skips publish; otherwise the rewritten tree
  #   simply mirrors on the next ordinary push.
  #   RESTATEMENT DECLINED: publish-verify is NOT separately gated. It inherits the skip through
  #   `needs: publish` plus the implicit success(), observed on run 30825636788 where publish
  #   FAILED and publish-verify shows `skipped`. Restating the condition there -- this file's
  #   usual pairing habit -- was CONSIDERED and declined for the minimal diff. Recorded so a
  #   reader does not re-derive the choice and assume it was an oversight.
  #   NO TRIPWIRE: a wrongly-skipped publish is silent in the general case, and that was WEIGHED
  #   rather than overlooked. It fails CLOSED and the gap is recoverable by construction, so a
  #   tripwire asserting "the mirror received this commit" would fire on correct behaviour in
  #   exactly the way this repo's OBS-04 record warns about. Deliberately not built.
  #   WINDOW PROCEDURE: open the window with a plain `git push origin HEAD:main`, never --force.
  #   And never open a second window while a previous window is still open: a tip that does not
  #   descend from the tip already on `main` is a REWIND, so it would silently skip publish and
  #   lose the very measurement the window exists to take.
```

All eight labelled claims are present inside the publish rationale block and nowhere else
in the file (G4 asserts region count >= 1 AND file-wide count == region count for every
gated literal, which is subset-equality and therefore localizes validly).

## The RED, and the mutation proof

**RED, observed BEFORE the spec was touched** (`ci.yml` clause added, spec unchanged):

```
 x scopes to a real publish job block 5ms
 FAIL  |@op-nx/github-cache| src/dogfood-cross-os.spec.ts > ci.yml publish waits on every job that produces a NEW mirrored key (XOS-07) > scopes to a real publish job block
 Test Files  1 failed | 42 passed (43)
      Tests  1 failed | 1057 passed (1058)
```

Exactly the test the plan predicted. The positive control at `dogfood-cross-os.spec.ts:280-284`
genuinely pins the `if:` line and genuinely broke against the new expression.

**GREEN after the spec update:** `Cache: 0/1 hit (0%)` -- a real execution, not a replay.

**MUTATION (` && !github.event.forced` deleted from the `if:`, spec left in its final,
prettier-formatted state):**

```
 FAIL  |@op-nx/github-cache| src/dogfood-cross-os.spec.ts > ci.yml publish waits on every job that produces a NEW mirrored key (XOS-07) > scopes to a real publish job block
 FAIL  |@op-nx/github-cache| src/dogfood-cross-os.spec.ts > ci.yml publish waits on every job that produces a NEW mirrored key (XOS-07) > skips publish on a FORCED push, so a temporary-main-window restore writes nothing (D-U2Q)
 Test Files  1 failed | 42 passed (43)
      Tests  2 failed | 1057 passed (1059)
```

**The failing test name recorded for the record:**
`skips publish on a FORCED push, so a temporary-main-window restore writes nothing (D-U2Q)`.

**G6c and G6d both discriminated, and the `> ` prefix is why:**

- **G6c** matched `> skips publish on a FORCED push` in `mutation.log` (count 1, rc=0). The
  prefix is the whole gate. Both tests in that file failed, so Vitest expanded the file and
  reprinted every title in it -- a bare title match would therefore have been satisfied
  whether the dedicated test failed, passed, or asserted nothing. Only the FAILING title
  carries `> `. The pattern was NOT relaxed.
- **G6d** confirmed the same failing form is ABSENT from `final.log` (the green tree), so
  the assertion is a discriminator rather than always-red.

The clause was then RESTORED and the suite re-run green before committing;
`git diff -- .github/workflows/ci.yml` was confirmed to show the clause present.

**No test run used `--skip-nx-cache`**, and the reasoning is measured, not inherited:
`ci.yml` **IS** registered in `nx.json`'s `targetDefaults.test.inputs` (`nx.json:70`,
asserted by `nx-target-inputs.spec.ts:701/743/771`, and `ci.yml` states it about itself at
`:1638` and `:1881` under an exactly-2 cardinality guard at `docs-same-os-claims.spec.ts:707-722`).
Editing `ci.yml` rotates the `test` task hash on its own, so a stale cached PASS cannot be
replayed over this change. Nothing written by this task claims the opposite.

## Half B: the measured absence of a committed battery script

MEASURED, not assumed:

```
$ ls -d scripts tools    -> rc=2, No such file or directory (both)
$ node -p '...package.json.scripts...'
  build typecheck test integration lint format format:check fallow fallow:ci
  build:action capture:hashes assert:graph-premise check:action typecheck:action
  pack:check test:act        -- no battery/loop entry
$ git grep -n -e 'for i in' -e 'for cmd in' -e 'seq 1' -- '*.md' '*.sh' '*.mjs' '*.ps1'
  -> only the CI sidecar readiness polls (`for _ in $(seq 1 30)`) in PATTERNS.md files
     and README.md, plus this task's own PLAN.md echoing the probe command
```

So the redirect that discarded the `69bd1b7` output lives in INSTRUCTIONS, not in a script,
and that is where the fix belongs. `AGENTS.md` is the correct home because it is the
agent-agnostic instruction file every agent in this repo loads (`CLAUDE.md` is
`@AGENTS.md`), so writing the rule there is what actually changes the next battery run. It
is also prettier-ignored (`.prettierignore` lists `AGENTS.md`), so it cannot perturb
`format:check`.

Heading level is 1, matching the file's measured convention (level 1 for its topics at :4
and :27, level 2 for their subsections). A level-2 section appended at the end would have
nested under the unrelated git-worktree topic.

### The AGENTS.md section (verbatim)

````
# Capturing test-battery output

When running the acceptance-command battery, or any repeat/loop of a single target,
pipe through `tee` to a log and propagate the REAL exit code, not `tee`'s:

```bash
npm run test 2>&1 | tee "test-$(date +%s).log"; exit ${PIPESTATUS[0]}
```

WHY, because a rule without its reason gets deleted: Nx caches terminal output for
SUCCESSFUL runs only, so a failing run's output never reaches
`.nx/cache/terminalOutputs` and THE RE-RUN DESTROYS THE EVIDENCE. This exists for one
occurrence: an unattributed `test` failure at `69bd1b7`, not reproducible in seven
attempts, with nothing recoverable afterwards. Nx classified it flaky (a FAILURE and a
SUCCESS at the same task hash), and the commit itself was docs-only, so no diagnosis
was ever possible - only capture would have helped.

The second habit, so the operator has it: run the failing target once with
`--skip-nx-cache --output-style=stream` BEFORE any re-run.

Nothing larger than this. No retry harness, no flaky-test dashboard, no
`--reporter=json` pipeline - the event has occurred once in five phases and has never
recurred.
````

The `69bd1b7` diagnosis was NOT reopened. It stays settled as
unactionable-until-recurrence, and nothing here states which spec failed -- that would be
invention.

## The deliberate second copy of the window procedure

`HANDOFF.json` item 3 now carries the procedure at its point of use. **This is a DELIBERATE
duplication, not drift.** `ci.yml` carries the durable statement; `HANDOFF.json` carries
the pointer where the operator will actually be standing, and it may be regenerated by GSD
tooling. A future reader should not "de-duplicate" the `ci.yml` one.

## Gate results

| Gate | What it bounds | Result |
|---|---|---|
| G1a / G1b | the `if:` line adjacent to `^  publish:$` keeps the house form AND gains the clause | PASS |
| G2 | scope bound: exactly one `if:` line file-wide carries the clause | PASS (1) |
| G3a/b/c | publish region extraction bounded at both ends, with the pre-existing `BOUNDED FAILURE MODE:` positive control | PASS (101 lines) |
| G4 (x13) | each gated literal present in the region AND nowhere outside it | PASS (all f == r) |
| G4b (x7) | no label line is bare (length floor) | PASS (83-97 chars vs floors 52-66) |
| G5 | the comment cites the TOTAL that was actually measured | PASS (70) |
| G6 | full suite green at the final tree | PASS |
| G6b-title / G6b-reason | the dedicated assertion exists exactly once with its own reason | PASS (1 / 1) |
| G6c | it failed BY NAME under the mutation, matched with the `> ` FAIL-line prefix | **PASS -- discriminated** |
| G6d | reciprocal control: that failing form is ABSENT from the green log | **PASS -- discriminated** |
| G7a-e | AGENTS.md section, level 1, with the idiom, `tee`, the reason, and the second habit | PASS |
| G8 | HANDOFF.json parses and item 3 carries the procedure | PASS |
| G9 | item 3's pre-existing text survived (append, not rewrite) | PASS |

### Whole-task verification

| Step | Result |
|---|---|
| Full acceptance battery: `format:check`, `build`, `typecheck`, `typecheck:action`, `test`, `fallow:ci`, `check:action`, `pack:check` | all rc=0 |
| `check:action` drift | none -- no `serve()`-reachable source was touched, as expected |
| Scope: `git diff --name-only 71773ee..HEAD` | exactly the four expected files, nothing else |
| Commit count | exactly 2 executor commits |
| Working tree | clean apart from this task's own `260808-u2q` artifacts (the orchestrator's step) |
| `origin/main` | still `fe25a3f865f20f3d4f8a40e96f8cb5717608ba8a` |
| `refs/backups/*` on origin | all five present, all at `fe25a3f`, untouched |
| `actionlint` | does NOT resolve locally (rc=1); CI-advisory-only in this repo, not installed |

## Deviations from Plan

No behaviour was changed to accommodate any of these, and no gate was relaxed.

### 1. Pre-flight expectation about the working tree was stale (plan discrepancy, benign)

The plan's pre-flight says `git status --porcelain` "is expected to show ONE untracked
entry: this task's own `.planning/quick/260808-u2q-*/` directory ... Those artifacts are
untracked". MEASURED at execution start: `git status --porcelain -uall` was **empty**, and
`git ls-files` shows CONTEXT, RESEARCH, PLAN and PLAN-CHECK are all **already tracked** at
the baseline `71773ee`. The orchestrator had committed them before dispatch.

Consequence: none. The state is strictly cleaner than the plan expected, and verification
step 4's `rg -v -F -e '260808-u2q'` filter still holds -- the only dirt at the end is this
SUMMARY, which the filter admits.

### 2. Pre-flight probe 2's command does not find what probe 2 describes (plan discrepancy)

The plan's probe is
`git grep -n -F -e "github.event_name == 'push'" -- packages/github-cache/src/dogfood-cross-os.spec.ts`
and it EXPECTS "a hit around line 282". MEASURED: it returns rc=0 with hits at **:115 and
:343 only** -- never :282. The reason is that line 282 holds a REGEX in which the dot is
escaped (`github\.event_name`), so the `-F` literal cannot match it.

The CLAIM the probe exists to establish is nonetheless TRUE, and it was confirmed by
reading the file directly: the positive control sits at `dogfood-cross-os.spec.ts:280-284`
exactly as described, and it went RED against the new `if:` as designed. Only the probe
command was wrong, not the fact.

### 3. The 22-vs-23 arithmetic in RESEARCH.md and in the plan (corrected, not repeated)

RESEARCH.md states "22 of 22 separate with zero misclassification", and the plan's step-1
note repeats "22 = 11 restores + 11 opens + 1 merge". **11 + 11 + 1 = 23**, and the
research's own table lists exactly those three rows. MEASURED independently at execution
time: 11 restores + 11 opens + 1 merge = **23** in the `fe25a3f` era, out of 70 pushes
total in the feed.

The plan says explicitly "WRITE WHAT YOU MEASURED, not what the research measured", so the
comment carries **23 in the fe25a3f era, separating 23/23** and the file-wide TOTAL of
**70**. The misstated 22 was not copied anywhere.

### 4. [Rule 3 - Blocking] Prettier reformatted the new spec assertion

`npm run format:check` went red on `dogfood-cross-os.spec.ts` after step 4 (prettier
preferred double-quoted strings for the two fragments containing an apostrophe). Fixed with
`npx nx format:write --files packages/github-cache/src/dogfood-cross-os.spec.ts`, scoped to
that one file. The change was quoting style only; both mandatory literals stayed intact on
single lines.

**Consequence handled rather than ignored:** the reformat changed the committed spec bytes
AFTER `mutation.log` had been produced, so the mutation proof was **re-run from scratch**
against the final, formatted tree. G6c and G6d both read that re-run. The mutation proof
therefore corresponds to the bytes that were actually committed.

### 5. An inline `node -e` script lost its quotes to bash, and it clobbered a log

While attempting to script the re-mutation, a `node -e '...'` one-liner containing
single-quoted `'push'` was mangled by the outer single quotes (the documented Git Bash
trap). It threw `clause not found`, so **no mutation was applied** -- but the `nx test` in
the same block still ran and overwrote `mutation.log` with a GREEN run.

Caught immediately by reading the output (`Tests 1059 passed`, rc=0). The mutation was
redone with the Edit tool and the log regenerated; the final `mutation.log` that G6c reads
carries the genuine 2-failure run shown above. Recorded because a green log sitting where a
gate expects a red one is exactly the shape that makes a gate silently vacuous.

## Authentication Gates

None. `gh` was already authenticated and the events-feed measurement ran on the first try.

## Known Stubs

None.

## Threat Flags

None. The change strictly NARROWS when the `contents: write` grant is exercised -- it
removes runs and cannot add one. No new credential, permission, dependency or input.

## Self-Check: PASSED

- `.github/workflows/ci.yml` -- FOUND, clause present at the line after `^  publish:$`
- `packages/github-cache/src/dogfood-cross-os.spec.ts` -- FOUND, both literals count 1
- `AGENTS.md` -- FOUND, level-1 section present
- `.planning/HANDOFF.json` -- FOUND, parses, item 3 carries the procedure with its
  pre-existing text intact
- commit `92998de` -- FOUND
- commit `0cd43b4` -- FOUND
