# 260808-u2q -- PLAN CHECK (iteration 1)

**Verdict:** ISSUES FOUND -- 3 BLOCKERS, 4 WARNINGS.
**Mode:** quick-full. Single plan, so cross-plan dependency checks and ROADMAP goal
derivation are out of scope by the orchestrator's instruction.
**Tree at check time:** branch `gsd/v0.0.2-os-invariant-cross-os-sharing`, HEAD `f9be637`,
`origin/main` `fe25a3f`. Three untracked planning artifacts (see BLOCKER 2).

Every finding below carries the command that produced it and its exit code. Every zero was
taken only after a positive control on the same path.

---

## BLOCKERS

### B1 -- Planner claim 2 is FALSE. `ci.yml` IS in the `test` target's Nx inputs, and this repo has an active guard against re-acquiring the opposite claim.

The plan asserts, in THREE places, that `.github/workflows/ci.yml` is "not provably in the
`test` target's Nx inputs":

- `must_haves.key_links[2]` (frontmatter, line 32)
- Task 1 STEP 3 prose (lines 239-242)
- `<verification>` step 2 ("--skip-nx-cache on the test leg is not optional")

It is not merely unproven. It is contradicted by the file the plan is editing.

    $ cat nx.json      # targetDefaults.test.inputs
    ...
            "{workspaceRoot}/.github/workflows/cleanup.yml",
            "{workspaceRoot}/.github/workflows/ci.yml",
            "{workspaceRoot}/.github/workflows/windows-regression-detector.yml",
    ...
    rc=0

The registration is asserted by a live spec, three times:

    $ git grep -n -F -e "workflows/ci.yml" -- packages/github-cache/src/nx-target-inputs.spec.ts
    packages/github-cache/src/nx-target-inputs.spec.ts:701:      '{workspaceRoot}/.github/workflows/ci.yml',
    packages/github-cache/src/nx-target-inputs.spec.ts:743:      '{workspaceRoot}/.github/workflows/ci.yml',
    packages/github-cache/src/nx-target-inputs.spec.ts:771:      '{workspaceRoot}/.github/workflows/ci.yml',
    rc=0

And `ci.yml` STATES IT ITSELF, twice, with an exactly-2 cardinality guard over it:

    $ git grep -n -F -e "ci.yml IS in nx.json's targetDefaults.test.inputs" -- .github/workflows/ci.yml
    .github/workflows/ci.yml:1638:  # ci.yml IS in nx.json's targetDefaults.test.inputs (PARITY-08, Phase 9)
    .github/workflows/ci.yml:1881:  # ci.yml IS in nx.json's targetDefaults.test.inputs (PARITY-08, Phase 9)
    rc=0

`packages/github-cache/src/docs-same-os-claims.spec.ts:707-722` asserts that phrase occurs
exactly twice, and its own failure message names this exact regression:

> "Both blocks previously claimed the OPPOSITE (that ci.yml is NOT an nx.json test input);
> removing the correction from one of them leaves a future reader holding a documented
> argument for REMOVING the registration, and removing it turns every ci.yml content guard
> in this file and in dogfood-cross-os.spec.ts into a replay of a pass computed before its
> subject existed."

**Why this is a BLOCKER and not a warning.** `--skip-nx-cache` itself is harmless
over-caution -- the plan's mechanics still work. The damage is the RECORD. PLAN.md and the
mandated SUMMARY.md are both committed under `.planning/`, so executing this plan as written
writes the already-corrected misconception back into two tracked files, directly against a
correction this repo spent a commit making and now guards with a cardinality assertion. The
plan also uses the false claim as load-bearing reasoning for its RED step ("a cached PASS
can be replayed over a changed workflow file") -- that specific hazard does not exist here,
because editing `ci.yml` changes the `test` task hash.

**Fix:** correct the claim in all three places. Keep `--skip-nx-cache` if wanted, but
rewrite the rationale to "belt-and-braces; ci.yml IS a registered test input (nx.json
targetDefaults.test.inputs, asserted by nx-target-inputs.spec.ts), so the hash already
changes -- the flag only removes any doubt". Do not state or imply the opposite.

---

### B2 -- The whole-task verification is UNSATISFIABLE. No tree state passes verification steps 3 and 4 together.

This is the exact structural defect the previous task hit.

    $ git status --porcelain -uall
    ?? .planning/quick/260808-u2q-stop-the-temporary-main-window-restore-f/260808-u2q-CONTEXT.md
    ?? .planning/quick/260808-u2q-stop-the-temporary-main-window-restore-f/260808-u2q-PLAN.md
    ?? .planning/quick/260808-u2q-stop-the-temporary-main-window-restore-f/260808-u2q-RESEARCH.md
    rc=0

    $ git check-ignore -v .planning/quick/260808-u2q-.../260808-u2q-PLAN.md
    rc=1        # NOT gitignored

These artifacts are tracked by this repo's own convention:

    $ git log --oneline -3 --name-only -- .planning/quick/
    142ea72 docs(260808-lpt): correct the inherited five-weeks figure the verifier caught
    .planning/quick/260808-lpt-.../260808-lpt-PLAN.md
    .planning/quick/260808-lpt-.../260808-lpt-REVISION-3.md
    .planning/quick/260808-lpt-.../260808-lpt-SUMMARY.md
    .planning/quick/260808-lpt-.../260808-lpt-VERIFICATION.md
    ...
    rc=0

The plan requires, at the final tree:

- step 3: `git diff --name-only "$BASE"..HEAD` lists EXACTLY four files "and nothing else"
- step 4: `git status --porcelain` is EMPTY, and exactly TWO commits since `$BASE`
- `<output>`: a `260808-u2q-SUMMARY.md` must be created in that same untracked directory

Enumerate the states:

| Executor does | step 3 | step 4 (clean tree) | step 4 (2 commits) |
|---|---|---|---|
| Leaves artifacts untracked | passes | FAILS (3-5 untracked files) | passes |
| Commits artifacts in a 3rd commit | FAILS (list grows) | passes | FAILS (3 commits) |
| Adds artifacts to commit 1 or 2 | FAILS (list grows) | passes | passes |

No row is all-green. Adding this PLAN-CHECK.md makes it worse. The step-3 gate even
advertises the failure it will produce: "This gate fails ... if a stray file is swept in
(list grows)" -- and by the plan's own accounting the planning artifacts are exactly that.

**Fix:** state the artifact-commit policy explicitly. Either (a) enumerate a third planning
commit and change step 3 to
`git diff --name-only "$BASE"..HEAD -- ':!.planning/quick/'` with step 4 expecting three
commits, or (b) scope step 3's expected list to source files and drop "and nothing else"
for the `.planning/quick/` prefix. Whichever, SUMMARY.md and PLAN-CHECK.md must be named in
the accounting rather than left to collide with it.

---

### B3 -- `$BASE` does not survive between tool calls, and the failure is SILENT and exit-0. The scope gate is vacuous as written.

The plan does the right thing on the prompt's structural-defect-2 axis: it captures
`BASE=$(git rev-parse HEAD)` at execution start (line 102) and explicitly forbids a
hardcoded SHA ("Do NOT use a hardcoded SHA here; $BASE was captured in pre-flight for
exactly that reason", lines 577-578). It also avoids the vacuous relative form
`HEAD~N..HEAD`. The INTENT is correct. The MECHANISM is not.

Shell state does not persist between Bash tool invocations in this harness, and BASE must be
captured BEFORE the commits while the scope gate runs AFTER them -- so they cannot share one
call:

    $ echo "BASE=[$BASE]"
    BASE=[]

Both gate commands then degrade to a silent empty pass:

    $ git diff --name-only ..HEAD | head -5
    rc_diff=0                      # NO output, exit 0

    $ git log --oneline ..HEAD | wc -l
    0
    rc_log=0                       # zero commits, exit 0

Neither snippet carries `set -u` (unlike the `<verify>` blocks, which do), so nothing errors.
The gate reports "no files changed, no commits" and exits 0. That is precisely the "list
shrinks" outcome the plan says the gate catches -- produced by variable loss rather than by
dropped work, and indistinguishable from it.

`$SCRATCH` is NOT affected: it is re-derived from `TMPDIR` in each block, and `TMPDIR=/tmp`
here, so `/tmp/u2q/shapes-raw.txt` genuinely survives for G5.

**Fix:** persist the baseline to a file at pre-flight --
`git rev-parse HEAD > "$SCRATCH/base.txt"` -- and have the verification block read
`BASE=$(cat "$SCRATCH/base.txt")` under `set -u` plus an explicit `test -n "$BASE"` guard, so
an unset baseline fails LOUD instead of empty.

---

## WARNINGS

### W1 -- G6b cannot tell step 4(a) from step 4(a)+4(b). The dedicated forced-clause assertion is required by the action but gated by nothing.

Task 1 STEP 4 requires two distinct edits: (a) tighten the existing positive control's
regex, and (b) ADD a new `it()` whose title and `reason` are about the forced gate
specifically. The plan argues (b) is load-bearing: "a guard whose title reads as false
coverage is the exact defect class this repo has spent commits correcting -- (a)'s title
says 'scopes to a real publish job block', which is not a claim about the gate."

The only gate over it:

    rg -q -F -e 'github.event.forced' packages/github-cache/src/dogfood-cross-os.spec.ts

That is satisfied by (a) alone. It is satisfied by a bare COMMENT containing the string. It
is satisfied without any `it()` at all. The plan's `<done>` block does not mention (b)
either, and `<success_criteria>` requires only "a live spec assertion fails if that clause
is deleted" -- which (a) alone provides.

So the artifact `must_haves` promises ("plus one new dedicated assertion for the forced
clause") has no enforcement. Downgraded from BLOCKER because the load-bearing truth
(deleting the clause reddens the suite) IS delivered by (a), so the task goal survives.

**Fix:** gate the title, not the string. Require a line matching `^\s*it\('.*forced` in the
spec, and assert the file's count of `github.event.forced` is at least 2 (one per `it`).

### W2 -- The `## ` heading level forced by G7a nests the new AGENTS.md section under an unrelated H1.

    $ rg -n -e '^#+ ' AGENTS.md
    4:# General Guidelines for working with Nx
    13:## Scaffolding & Generators
    17:## When to use nx_docs
    27:# Git worktree strategy (parallel plan execution)
    35:## Decision rule (default to the simple option)
    46:## Sharing node_modules via a junction (deps-unchanged only)
    59:## Shared / race-prone resources
    rc=0

`AGENTS.md` uses `# ` for TOPICS and `## ` for their subsections. The plan mandates a new
`## Capturing test-battery output` section and gates it with
`rg -q -e '^## Capturing test-battery output$'`, but never says WHERE. Appended at the end
(the natural reading), a level-2 heading lands as a subsection of "# Git worktree strategy
(parallel plan execution)" -- a topic it has nothing to do with. An executor who correctly
picks `# ` instead FAILS G7a.

This answers the prompt's "heading at the wrong LEVEL" question in the affirmative: the gate
pins a level that is wrong for the placement it implies.

**Fix:** either make it `# Capturing test-battery output` (topic-level, matching the file's
convention) and gate `^# ...$`, or keep `## ` and require it under the Nx H1 at line 4,
before line 27.

### W3 -- The eight rationale claims are gated as LITERALS only. The semantic half is unchecked.

G4 asserts 13 short literals appear in the publish region and nowhere else. It cannot
distinguish a genuine eight-claim rationale from thirteen label lines with no content. The
plan half-acknowledges this for claim 2 only ("The per-shape split in the comment is checked
by READING that pasted table against the comment; that half is not script-checked, and the
SUMMARY says so") but does not extend the acknowledgement to claims 1, 3, 4, 5, 6, 7, 8.

Inherent to prose gates, not fixable by a better regex. Flagged so the orchestrator reads the
rationale block by eye at review rather than trusting the green `[OK] task 1 gates green`.

### W4 -- STEP 5's restore leg drops `--skip-nx-cache` in prose.

Step 5: "RESTORE the clause, re-run green". The two preceding runs in the same step pass the
flag explicitly; this one does not. Cosmetic given B1 (the flag is belt-and-braces, not
load-bearing), but it contradicts the plan's own "MANDATORY on every test run in this plan".

---

## CONFIRMED SOUND

Every item below was independently re-measured, not accepted.

### Planner claim 1 -- CONFIRMED, including the sharper sub-question

The positive control is at 280-284 exactly:

    280:   it('scopes to a real publish job block', () => {
    281:     expect(jobBlock('publish')).toMatch(
    282:       /^ {4}if:\s*\$\{\{\s*!cancelled\(\)\s*&&\s*github\.event_name == 'push'\s*\}\}$/m,
    283:     );
    284:   });

It genuinely breaks against the new expression (the trailing anchor after the closing braces
cannot absorb ` && !github.event.forced`):

    $ node /tmp/regexcheck.mjs
    old matches: true
    new matches: false
    rc=0

So the RED step is real, not asserted. The replacement is a TIGHTENING, not a loosening:
step 4(a) says "require the new clause". The separate-assertion requirement IS present in
the action text -- its enforcement gap is W1, not a soundness defect in the design.

jobBlock (spec lines 62-77) slices codeLines from the publish job key to the next top-level
key, over comment-STRIPPED content -- so the rationale-comment edits in STEP 6 cannot perturb
any existing jobBlock publish assertion. Verified by reading the helper.

### Planner claim 3 -- CONFIRMED. All 13 literals absent, with exit codes and a positive control.

    FORCE-PUSH                     rc=1 count=[]
    MEASURED PUSH SHAPES           rc=1 count=[]
    run 30825636788                rc=1 count=[]
    SKIP DIRECTION                 rc=1 count=[]
    HISTORY-REWRITE EXCEPTION      rc=1 count=[]
    RESTATEMENT DECLINED           rc=1 count=[]
    NO TRIPWIRE                    rc=1 count=[]
    WINDOW PROCEDURE               rc=1 count=[]
    no force bit                   rc=1 count=[]
    empty forward commit           rc=1 count=[]
    no production write            rc=1 count=[]
    HEAD:main                      rc=1 count=[]
    previous window                rc=1 count=[]

Every rc=1 is a genuine no-match, not a failed command (rc=2). Positive controls on the same
path:

    $ git grep -c -F -e 'MECHANISM:' -- .github/workflows/ci.yml
    .github/workflows/ci.yml:1        rc=0
    $ git grep -c -F -e 'BOUNDED FAILURE MODE:' -- .github/workflows/ci.yml
    .github/workflows/ci.yml:1        rc=0

The eight LONGER G4 forms (FORCE-PUSH MECHANISM:, no production write at all, etc.) also
measure 0 with rc=1. No gate is pre-satisfied. The pre-flight three named exclusions are
correct: MECHANISM: is at 2180 (exactly once), and "A recoverable GAP, never a wrong
artifact" is at 2189.

### Planner claim 4 -- CONFIRMED, both halves.

    $ ls -d scripts tools 2>&1
    ls: cannot access 'scripts': No such file or directory
    ls: cannot access 'tools': No such file or directory
    rc=2

    $ node -p 'Object.keys(require("./package.json").scripts).join(" ")'
    build typecheck test integration lint format format:check fallow fallow:ci build:action
    capture:hashes assert:graph-premise check:action typecheck:action pack:check test:act

No battery/loop entry. AGENTS.md is genuinely prettier-ignored:

    $ cat .prettierignore
    ...
    # Agent and planning docs - churny, not workspace source (D-07)
    .planning/
    CLAUDE.md
    AGENTS.md

format:check is `nx format:check`, which honours .prettierignore, so task 2 edits cannot
perturb it. The AGENTS.md literals the plan gates are all absent today (PIPESTATUS, "tee ",
battery, 69bd1b7, skip-nx-cache all rc=1) against a working positive control (node_modules,
rc=0, line 15).

### Gate-vacuity audit -- every gate passes the four questions

| Gate | Honest FALSIFIED passes? | Writing nothing passes? | Deleting guarded text passes? | Additive-direction deletion passes? |
|---|---|---|---|---|
| G1a / G1b | no | no | no | no |
| G2 | no | no | no | no |
| G3a / G3b / G3c | no | no | no | no |
| G4 (x13) | no | no | no | no (all 13 are 0 file-wide today, nothing to delete) |
| G5 | no | no | no | no |
| G6 / G6b | no | no | no | see W1 |
| G7a-e | no | no | no | no |
| G8 | no | no | no | no |
| G9 | no | no | no | no |

**Cardinality does not carry localization weight it cannot bear -- verified for BOTH count
gates, not just the one the plan describes.**

G2 (the == 1 gate) is a pure scope bound. Localization is done independently by G1 awk,
which reads the line IMMEDIATELY after the job key -- genuine adjacency, not a count:

    $ awk '/^  publish:$/{getline; print; exit}' .github/workflows/ci.yml
        if: ${{ !cancelled() && github.event_name == 'push' }}
    awk_rc=0
    $ git grep -n -e '^  publish:$' -- .github/workflows/ci.yml
    .github/workflows/ci.yml:2206:  publish:      rc=0     # unique

G4-scope (the f == r comparison) is the second count gate and the plan does NOT describe it.
It survives the question anyway, on a different mechanism: r counts within a contiguous
SLICE of the same file that f counts across, so f == r is subset-equality, which does
localize validly. Not bare cardinality.

### Region gates bound BOTH ends -- verified by running the extraction

    $ awk '/^  # The per-OS publish matrix/{f=1} f{print} /^  publish:$/{if(f) exit}' .github/workflows/ci.yml > /tmp/pb.txt
    awk_rc=0
    $ wc -l /tmp/pb.txt
    53 /tmp/pb.txt
    $ tail -1 /tmp/pb.txt
      publish:
    $ rg -n -F -e 'publish:' /tmp/pb.txt
    53:  publish:      rc=0     # exactly one -- the end anchor itself, so G3c is not vacuous
    $ rg -c -F -e 'BOUNDED FAILURE MODE:' /tmp/pb.txt
    1                rc=0

Both anchors exist and are unique (start 2154, end 2206). The G3b positive control proves the
extraction landed. The G3c end-anchor check is NOT satisfied by incidental prose -- the
literal occurs exactly once in the 53-line region, at the end anchor.

### Insertion anchors are real and inside the region

    $ git grep -n -F -e 'load-bearing gate (D-01), not the workflow if: alone.' -- .github/workflows/ci.yml
    .github/workflows/ci.yml:2172        rc=0
    $ git grep -n -F -e '# WHY needs:' -- .github/workflows/ci.yml
    .github/workflows/ci.yml:2174        rc=0

Line 2173 is the lone comment separator the plan names. Insertion between 2172 and 2173 sits
inside region 2154-2206, so the G4-region half is reachable. All anchors are literals, not
line numbers, per the plan own instruction.

### G9 pre-existing-text guard is satisfiable -- measured against the live file

    $ node -e '...operator_plan.find(x=>x.item===3)...'
    {
      "item": 3,
      "detail": "Phase 9 first post-merge publish-verify (windows-11-arm) leg, ...
                 skipped on run 30947535877. ... MUST be done AFTER item 2, ..."
    }
    rc=0

All three G9 literals -- publish-verify, 30947535877, "AFTER item 2" -- are present today, so
the append-not-rewrite guard has something real to protect. .planning/HANDOFF.json is tracked
(git ls-files --error-unmatch, rc=0).

### Line-wrap false-zero exposure -- assessed, and the mitigation is real

ci.yml is heavily commented, so this is the live risk the prompt named. The plan mitigation
is structural rather than regex-based: every gated literal is short and must sit unwrapped on
one comment line. Longest is 26 chars (HISTORY-REWRITE EXCEPTION:, "no production write at
all") against ~100-col comments -- no wrap pressure. The plan uses rg -U with a whitespace
class nowhere, so the comment-continuation trap cannot fire. The G4 failure message even
names the wrap as the likely cause. "previous window" (two words) is the only wrappable
literal, and a wrap there fails the gate CLOSED, which is correct.

The plan also uses -e on every git grep and rg pattern, so the dash-leading unknown-switch
trap is avoided.

### Context compliance -- every LOCKED decision honoured, none redesigned

| CONTEXT.md LOCKED decision | Plan location | Verdict |
|---|---|---|
| github.event.forced, publish job only | STEP 2 + G2 scope bound | HONOURED |
| publish-verify cascades via needs:, not separately gated | claim 6 RESTATEMENT DECLINED: plus explicit do-not-restate | HONOURED |
| dogfood-seed / consumer-smoke untouched | STEP 6 explicit prohibition | HONOURED |
| NO tripwire | claim 7 NO TRIPWIRE: plus threat T-U2Q-03 disposition accept | HONOURED |
| Change at the job if:, rationale in the comment | STEP 2 + STEP 6 | HONOURED |
| Half B = capture, not diagnosis; nothing larger | task 2 explicit lockouts | HONOURED |
| Record the window procedure | claim 8 + HANDOFF item 3 | HONOURED |

All four rejected alternatives are explicitly forbidden in the plan text (repo-variable
toggle, hardcoded before == fe25a3f, workflow_dispatch-only, step-level ancestry check,
sentinel tag). No deferred idea appears. No scope-reduction language (v1, "static for now",
"future enhancement", placeholder, simplified) appears anywhere in the plan -- checked.

### The honesty requirement is met, and met strongly

The what-this-plan-does-not-prove block (lines 64-93) states plainly that everything gated is
STATIC, that the if: is asserted as TEXT and "proves nothing about how GitHub evaluates it",
that no local check can distinguish forced:true from forced:false, and:

> "THE BEHAVIOURAL PROOF ARRIVES ONLY ON THE NEXT REAL WINDOW, which is operator-plan item 3.
> That window is the run that will carry it, in two directions..."

It names both directions, names which run carries them, mandates the framing
"CORRECT-BY-ARGUMENT AND STATICALLY-GATED", and explicitly forbids writing that the fix is
"proven, verified in CI, or confirmed working". actionlint is correctly characterised as
CI-advisory-only, with both outcomes acceptable but neither allowed to go unrecorded.

No claim anywhere in the plan asserts behavioural proof from a local check. CONFIRMED.

### Baseline handling -- INTENT correct (the mechanism is B3)

BASE is captured with git rev-parse HEAD at execution start, with "never hardcode a SHA"
inline. No HEAD~N..HEAD relative form anywhere. The one hardcoded SHA in the plan
(git rev-parse origin/main, still fe25a3f..., verification step 5) is a MUST-NOT-CHANGE
invariant, not a range endpoint -- a legitimate use.

### Task completeness and scope sanity

Both tasks carry files, action, verify/automated, and done. Task 1 is tdd="true" and carries
a behavior block. Two tasks, four files -- well inside quick-task budget. All four
files_modified paths exist. The plan file is well-formed (614 lines, one closing tag).

### The acceptance battery matches the documented one

    $ rg -n -A5 -e 'acceptance' .planning/codebase/TESTING.md
    218:- The real gate is the **acceptance command battery** run on every commit:
    219-  `format:check`, `build`, `typecheck`, `test`, `fallow:ci`, `check:action`,
    220-  `pack:check`, plus `typecheck:action` ...

The plan eight commands are exactly these eight. lint is correctly absent (not in the
documented battery). npm run test is `nx run-many -t test` and packages/ holds only
github-cache, so the plan substitution to `npx nx test github-cache` loses no coverage.

### No forbidden-phrase collision

docs-same-os-claims.spec.ts carries forbidden-regex rows over ci.yml (same-OS restore claims,
per-OS tmpdir path, CORR-01 namespacing). None intersects the plan new prose (force-push
mechanism, push shapes, window procedure). The MECHANISM: row at :196 requires the FULL
string "MECHANISM: !cancelled() runs this job even when a needs: dependency FAILED." --
adding FORCE-PUSH MECHANISM: does not disturb it, and the plan choice of that longer label is
exactly why.

---

## Structured issue list

```yaml
issues:
  - id: B1
    dimension: numeric_factual_claim_authority
    severity: blocker
    plan: "260808-u2q-01"
    location: "must_haves.key_links[2] (L32); task 1 STEP 3 (L239-242); verification step 2 (L560)"
    description: >
      Plan asserts ci.yml is "not provably in the test target Nx inputs". Live measurement
      contradicts it: nx.json targetDefaults.test.inputs contains
      {workspaceRoot}/.github/workflows/ci.yml; nx-target-inputs.spec.ts asserts it three
      times; ci.yml states it twice at 1638/1881 under an exactly-2 cardinality guard at
      docs-same-os-claims.spec.ts:707-722 whose failure message warns against re-acquiring
      precisely this misconception.
    measurement: >
      cat nx.json (rc=0); git grep -n -F -e "workflows/ci.yml" --
      packages/github-cache/src/nx-target-inputs.spec.ts (rc=0, 3 hits); git grep -c -F -e
      "ci.yml IS in nx.json" -- .github/workflows/ci.yml -> 2 (rc=0)
    fix_hint: >
      Correct the claim in all three places. Keep --skip-nx-cache as belt-and-braces if
      desired, but state that ci.yml IS a registered test input so the hash already changes.

  - id: B2
    dimension: verification_satisfiability
    severity: blocker
    plan: "260808-u2q-01"
    location: "verification steps 3 and 4 (L564-582); output block (L608-614)"
    description: >
      No tree state satisfies step 3 ("exactly four files ... and nothing else") together
      with step 4 ("git status --porcelain is empty" AND "exactly two commits"). Three
      planning artifacts are untracked and not gitignored, the plan mandates creating a
      fourth (SUMMARY.md), and this repo own convention commits these files.
    measurement: >
      git status --porcelain -uall -> 3 untracked (rc=0); git check-ignore -v on PLAN.md ->
      rc=1 (not ignored); git log --oneline -3 --name-only -- .planning/quick/ -> prior quick
      tasks commit PLAN/SUMMARY/PLAN-CHECK (rc=0)
    fix_hint: >
      Name the artifact-commit policy. Either add a third planning commit and adjust both
      counts, or exclude the .planning/quick/ prefix from the step-3 pathspec.

  - id: B3
    dimension: gate_vacuity
    severity: blocker
    plan: "260808-u2q-01"
    location: "pre_flight L102; verification steps 3-4 (L566, L580)"
    description: >
      BASE is captured in one Bash call and consumed in a later one; shell state does not
      persist. With BASE empty, git diff --name-only ..HEAD emits nothing and exits 0, and
      git log --oneline ..HEAD reports zero commits and exits 0. Neither snippet carries
      set -u, so the scope gate silently reports the exact list-shrinks outcome it claims to
      detect. SCRATCH is unaffected (TMPDIR=/tmp, re-derived per block).
    measurement: >
      echo BASE -> empty; git diff --name-only ..HEAD -> no output, rc=0; git log --oneline
      ..HEAD | wc -l -> 0, rc=0
    fix_hint: >
      Persist to $SCRATCH/base.txt at pre-flight; read it back under set -u with an explicit
      test -n guard so an unset baseline fails loud.

  - id: W1
    dimension: gate_vacuity
    severity: warning
    plan: "260808-u2q-01"
    location: "task 1 verify G6b (L381-382); STEP 4(b) (L252-259)"
    description: >
      G6b greps the whole spec file for the bare string github.event.forced. It is satisfied
      by step 4(a) alone, and by a comment. The dedicated forced-gate it() that 4(b) requires
      -- and that must_haves lists as an artifact -- has no enforcement, and is absent from
      done and success_criteria.
    fix_hint: Gate the it() title and require an occurrence count of at least 2.

  - id: W2
    dimension: gate_correctness
    severity: warning
    plan: "260808-u2q-01"
    location: "task 2 action (L436); G7a (L488-489)"
    description: >
      AGENTS.md uses level-1 for topics and level-2 for subsections. G7a pins a level-2
      heading but the plan never says where the section goes; appended at the end it becomes
      a subsection of the git-worktree topic. An executor choosing the convention-correct
      level-1 heading fails the gate.
    fix_hint: Use level-1 and gate that, or require placement under the Nx H1 before L27.

  - id: W3
    dimension: gate_vacuity
    severity: warning
    plan: "260808-u2q-01"
    location: "task 1 verify G4 (L360-371)"
    description: >
      G4 gates 13 short literals. It cannot distinguish a real eight-claim rationale from 13
      bare label lines. The plan acknowledges the unchecked half for claim 2 only, not for
      claims 1 and 3-8.
    fix_hint: >
      Extend the plan own "not script-checked, and the SUMMARY says so" caveat to all eight
      claims so the orchestrator reads the block by eye rather than trusting the green.

  - id: W4
    dimension: internal_consistency
    severity: warning
    plan: "260808-u2q-01"
    location: "task 1 STEP 5 (L267-268)"
    description: >
      "RESTORE the clause, re-run green" omits --skip-nx-cache, contradicting the plan own
      "MANDATORY on every test run in this plan". Cosmetic given B1.
    fix_hint: Spell the flag on the restore run too, or drop the every-run absolute.
```

---

## Counts

- BLOCKERS: 3
- WARNINGS: 4
- CONFIRMED SOUND: 15 areas. All four planner claims were re-derived independently; three
  confirmed, one falsified as B1.

## Recommendation

Return to the planner. B2 and B3 are mechanical and cheap. B1 requires the planner to reverse
a factual claim it currently treats as load-bearing in three places -- it must not be softened
to "unclear" or "unproven"; the measurement is decisive and this repo already guards the
correct statement.

Not re-checked, by instruction: cross-plan dependencies (single plan) and ROADMAP phase-goal
derivation (quick task). Nothing was edited, committed, pushed, or linted by this check.

---
---

# ITERATION 2 -- revision check

**Verdict:** ISSUES FOUND -- 1 BLOCKER, 3 WARNINGS.
**Scope:** narrowed to what the revision touched, per the coordinator. The 15 areas confirmed
sound in iteration 1 were NOT re-reviewed.
**Tree:** unchanged, HEAD `f9be637`, `origin/main` `fe25a3f`. A gitignored probe was created
under `tmp/u2qprobe/` for one measurement and removed; `git status --porcelain -uall`
afterwards shows only the four `260808-u2q` artifacts.

The standing lesson applied: two of this project eight vacuous gates were introduced BY fixes.
One of the four fixes in this revision is the third.

---

## BLOCKER

### B4 -- G6c is VACUOUS. The fix for W1 introduced a decorative gate. It cannot fail, given this plan own construction.

G6c is the gate the coordinator singled out as "the one gate standing between a real guard
and a decorative one". Measured: it is decorative.

    # --- G6c: and it is LOAD-BEARING -- it failed BY NAME under the mutation ---
    rg -q -F -e 'skips publish on a FORCED push' "$SCRATCH/mutation.log" \
      || { echo "FAIL G6c: the assertion never failed when the clause was removed"; exit 1; }

The gate assumes Vitest prints a test title only when that test FAILS. It does not.

**Measurement 1 -- the live suite.** reporters: ['default'], vitest 4.1.10
(packages/github-cache/vitest.config.mts:36). A GREEN run prints individual check-mark lines
for slow tests:

    $ npx nx test github-cache 2>&1 | tee green-probe.log   # rc=0
    ...
         [check] refuses --diff with --out, because diff mode measures nothing  429ms
         [check] reports an EMPTY array against an ABSENT key ...  509ms
     Test Files  43 passed (43)
          Tests  1058 passed (1058)

So the reporter is NOT failure-only. (Note this run was itself a cache replay --
Cache: 1/1 hit (100%) -- which independently confirms Nx reprints cached terminal output.)

**Measurement 2 -- the decisive one.** An out-of-repo probe returned a false zero (exit-2
class: ERR_MODULE_NOT_FOUND: Cannot find package 'vitest'), so it was re-run from a gitignored
tmp/u2qprobe/ inside the repo where resolution works. One spec file, three passing tests and
one failing test, same reporters: ['default']:

    $ npx vitest run --config tmp/u2qprobe/vitest.config.mts   # rc=1
    $ cat -v probe-fail.log | rg -e 'canary|DELIBERATE|FAIL'
    5:     [check] FASTPASS canary alpha 1ms
    6:     [check] FASTPASS canary beta 0ms
    7:     [x] DELIBERATE failure in the same file 3ms
    8:     [check] FASTPASS canary gamma 0ms
    12: FAIL  |probe| tmp/u2qprobe/a.spec.ts > probe describe > DELIBERATE failure in the same file

    $ rg -c -F -e 'FASTPASS canary alpha' probe-fail.log
    1        rc=0        # a PASSING title, present in a failing run log

**When one test in a file fails, Vitest expands the whole file and prints EVERY test title in
it, passing ones included.**

**Why that makes G6c unconditionally true here, not merely weak.** Step 4(a) updates the
existing positive control regex to REQUIRE the forced clause. The mutation deletes the clause.
So "scopes to a real publish job block" is GUARANTEED to fail in the mutation run.
dogfood-cross-os.spec.ts therefore always has at least one failure, is always expanded, and
the dedicated test title is always printed -- whether that test failed, passed, or is a no-op
expect(true).toBe(true) carrying the right title.

Apply the standard questions:

| Question | Answer |
|---|---|
| Would an honest FALSIFIED pass? | YES -- a passing no-op with the right title passes G6c |
| Would writing NOTHING pass? | No, but only because G6b-title already checks existence |
| Does G6c add anything over G6b? | NO. Given G6b passes, G6c is unconditionally satisfied |

G6c is the single mechanism that `<done>` (L477-479) and `<success_criteria>` (L710-712) cite
for the claim "FAILED BY NAME in mutation.log". That claim is not established by any check in
the plan.

**Fix, measured rather than guessed.** The failing test is the ONLY one whose title is
preceded by "> " (the FAIL file > describe > title line). Verified on the same probe log:

    $ rg -c -F -e '> DELIBERATE failure in the same file' probe-fail.log
    1        rc=0        # the FAILING test
    $ rg -c -F -e '> FASTPASS canary alpha' probe-fail.log
             rc=1        # a PASSING test -- genuine no-match
    $ rg -c -F -e '> FASTPASS canary gamma' probe-fail.log
             rc=1        # genuine no-match

So change G6c to pin the FAIL-line form:

    rg -q -F -e '> skips publish on a FORCED push' "$SCRATCH/mutation.log" \
      || { echo "FAIL G6c: the assertion never failed by name when the clause was removed"; exit 1; }

That is ASCII (no reliance on the check-mark / multiplication-sign glyphs, which are non-ASCII
and fragile on this cp1252 workstation), it is one character of change in intent, and it
genuinely discriminates pass from fail. Recommend also adding the reciprocal control -- assert
the same prefixed form is ABSENT from green.log -- so the gate proves the test is red under
mutation AND green without it.

**BLOCKS EXECUTION.** Not because the shipped behaviour would be wrong -- ci.yml would still
carry the correct clause, and G1/G2/G6b still hold. It blocks because W1 was raised precisely
to stop a decorative guard, the revision answer to it is itself decorative, and the plan now
asserts in two places a proof it does not perform. The fix is one line and measured; shipping
the unfixed version would record a third introduced-by-a-fix vacuous gate in a repo that is
actively counting them.

---

## WARNINGS

### W5 -- Task 2 `<done>` still demands the level-2 heading the W2 fix removed. The plan contradicts its own gate.

The W2 fix landed in three of four places:

    $ rg -n -F -e '# Capturing test-battery output' PLAN.md
    525:- Heading exactly `# Capturing test-battery output`, at the end of the file.   <- action, L1
    576:rg -q -e '^# Capturing test-battery output$' AGENTS.md                         <- G7a, L1
    598:- `AGENTS.md` has a `## Capturing test-battery output` section (level 2, exact text) that

Line 598 is task 2 `<done>`. `<success_criteria>` (L719-720) also says level 1. An executor
who works from `<done>` writes the level-2 form and fails G7a.

The heading level itself is now CORRECT and matches the measured convention (AGENTS.md uses
level 1 for its two topics at :4 and :27, level 2 for subsections) -- iteration 1 W2 is
resolved.

**Acceptable to ship with the limitation recorded.** It fails CLOSED: G7a catches it and costs
one retry inside the executor, not a wrong artifact. Cheapest fix is deleting one hash char.

### W6 -- Verification step 4 consumes $BASE without re-reading it or asserting it. The B3 fix covers step 3 but not step 4.

The B3 fix is correct where it was applied. Pre-flight writes git rev-parse HEAD to
$SCRATCH/base.sha (L103) and verification step 3 re-reads it under set -u with both assertions
(L664-668). Verified as a real guard.

Step 4 is a SEPARATE fenced block (L686-691) and does neither:

    test "$(git rev-list --count "$BASE"..HEAD)" -eq 2 \
      || { echo "FAIL: expected exactly 2 executor commits"; exit 1; }

No set -u, no re-read, no test -n. Run as its own tool call, $BASE is empty. Measured
consequence:

    $ git rev-list --count ..HEAD
    0
    rc=0

test 0 -eq 2 fails, so the gate fails LOUD with "expected exactly 2 executor commits" -- the
safe direction, not the silent-vacuous case. But the message misdiagnoses the cause, and the
gate can never pass when run separately.

The same SCRATCH-undefined pattern exists in task 1 STEP 1 (L219-230), STEP 5 mutation block
(L313-317), STEP 7 (L384-387) and task 2 commit block (L565-568). Those are covered: the
revision ADDED fail-fast assertions at the top of task 1 verify block --

    test -s "$SCRATCH/shapes-raw.txt" || { echo "FAIL: step-1 measurement missing"; exit 1; }
    test -s "$SCRATCH/mutation.log"   || { echo "FAIL: step-5 mutation log missing"; exit 1; }

-- which catch a log written to the wrong path. That addition is sound and is the right shape.

**Acceptable to ship with the limitation recorded.** Fails closed. Fix is to prepend step 4
block with the same four lines step 3 already carries, or merge steps 3 and 4 into one block.

### W7 -- The G4b comment overstates its own reach ("13 bare label lines"); the loop covers 7.

    428: # This is a LENGTH FLOOR, not a content check: it kills 13 bare label lines, and it is the
    431: for t in 'FORCE-PUSH MECHANISM:' 'MEASURED PUSH SHAPES:' 'SKIP DIRECTION:' \
    432:          'HISTORY-REWRITE EXCEPTION:' 'RESTATEMENT DECLINED:' 'NO TRIPWIRE:' \
    433:          'WINDOW PROCEDURE:'; do

Seven labels, not thirteen. The other six gated literals (no force bit, no production write at
all, empty forward commit, run 30825636788, HEAD:main, previous window) are content, not
labels, so excluding them is right -- only the number in the comment is wrong.

**Acceptable to ship.** A comment, not a gate. Flagged only because this plan is being held to
"no number stated that was not measured".

---

## CONFIRMED SOUND (revision items only)

### B1 -- RESOLVED. The misconception is gone and the replacement citation chain is exact.

    $ rg -c -F -e 'not provably' PLAN.md      -> rc=1 (genuine no-match)
    $ rg -c -F -e 'not in the test' PLAN.md   -> rc=1
    $ rg -c -F -e 'NOT in nx' PLAN.md         -> rc=1

Every surviving --skip-nx-cache mention (8 total) was read in context: three are the new
NEGATIVE statements with their reason (L32, L263, L318), one is the done-block prohibition
(L482), one is the verification note (L656), and three are the AGENTS.md rule CONTENT (L536,
L582, L600) -- the "second habit" the operator is told to use, which is correct and unrelated.
No residual copy of the misconception anywhere.

Citation chain re-measured, all four exact:

    $ awk 'NR==70 {print NR": "$0}' nx.json
    70:         "{workspaceRoot}/.github/workflows/ci.yml",

nx-target-inputs.spec.ts:701/743/771, ci.yml:1638 and :1881, and
docs-same-os-claims.spec.ts:707-722 were all measured in iteration 1 and match.

**Is dropping the flag SAFE?** Traced every tree state the plan runs the suite at:

| Run | ci.yml | spec | Hash novel? |
|---|---|---|---|
| STEP 3 RED | NEW (clause) | OLD | yes -- real run, fails as designed |
| STEP 5 GREEN | NEW | NEW | yes -- real run |
| STEP 5 MUTATION | OLD bytes | NEW | yes -- never run before, real failure |
| STEP 5 restore | NEW | NEW | no -- replays STEP 5 GREEN |
| G6 / battery | NEW + rationale | NEW | yes at first run |

Both runs a gate READS (mutation.log for G6c, final.log for G6) are novel hashes, so neither
can be a stale replay. The default named input is a projectRoot glob which covers the spec
file, and the workspaceRoot ci.yml entry covers the workflow. Nx does not cache failures, so
the RED and mutation runs always execute. **The drop is safe.**

One imprecision, benign: L318 "each tree state is a distinct ci.yml, so each rotates the test
hash" and the key_links "no test run in this plan can be a stale replay" are not literally true
of the STEP 5 restore re-run, which repeats STEP 5 GREEN exact tree and WILL replay. That run
asserts nothing and its replay is a pass either way, so nothing depends on it. Worth one clause
of softening if the plan is touched again; not worth a revision on its own.

### B2 -- RESOLVED. A satisfying tree state exists, and the filter behaves.

Simulated the post-commit-2 check against the live tree:

    $ git status --porcelain | rg -v -F -e '260808-u2q'
    filtered_rc=1                                   # every line filtered
    $ DIRT=$(git status --porcelain | rg -v -F -e '260808-u2q' || true); echo "[$DIRT]"
    []
    PASSES

git status --porcelain collapses the untracked directory to a single line that contains the
token, so the filter catches it whether git reports the directory or the individual files
(measured both: -uall lists four files, each containing 260808-u2q). The trailing "or true" is
load-bearing -- rg -v exits 1 when it filters everything.

Full satisfiability at the post-commit-2 tree:

| Check | Holds? |
|---|---|
| step 3: exactly the four tracked files | yes -- executor two commits touch only those |
| step 4a: rev-list --count == 2 | yes -- two executor commits |
| step 4b: filtered status empty | yes -- artifacts are the only dirt, all filtered |
| output: SUMMARY.md written into that dir | yes -- also filtered |
| this PLAN-CHECK.md | yes -- also filtered |

**A satisfying tree state exists.** The unsatisfiable-by-construction defect is gone, and the
plan states the reasoning inline (L633-641) so a later editor does not tighten it back.

Over-exclusion check: the filter admits any dirty path containing 260808-u2q. In practice only
this task artifact directory. A stray log written into the REPO with that token in its name
would be admitted -- but the plan tees every log to SCRATCH (outside the repo) and .gitignore
already covers the workspace-root log names. Residual risk is negligible.

### W1 -- PARTIALLY resolved. The static half is now real; the dynamic half is B4.

G6b is a genuine improvement over the iteration-1 bare grep. Both new literals were measured
site-unique across the whole tree:

    $ git grep -c -F -e 'skips publish on a FORCED push'
             rc=1        # genuine no-match
    $ git grep -c -F -e 'a rewind push to main would resume real production Release writes'
             rc=1        # genuine no-match
    $ git grep -c -F -e 'scopes to a real publish job block'      # positive control
    packages/github-cache/src/dogfood-cross-os.spec.ts:1          rc=0

So the count-equals-1 assertions are not pre-satisfied, and step 4(a) alone can no longer
satisfy the title check. G6b-title and G6b-reason both pass the deletion test. What G6b cannot
do is prove the assertion is load-bearing rather than a no-op with the right title -- that was
G6c job, and B4 is why it does not do it.

### W3 -- RESOLVED, and honestly bounded.

The G4b length floor was checked against the real rg output shape, because a filename or
line-number prefix would have inflated the measured length and weakened the floor:

    $ rg -m1 -F -e 'BOUNDED FAILURE MODE:' publish-block.txt
      #   BOUNDED FAILURE MODE: a skipped mirror, never a wrong artifact.
    len=69

No prefix. rg on a single file argument prints the bare line, so the floor measures real
content length. For that 22-char label the floor would be 62 and the real line is 69 -- the
threshold is calibrated to this file actual prose, not arbitrary.

Can padding satisfy it? Yes -- any length floor can. **The plan does not overclaim.** L428-430
says verbatim that this is a LENGTH FLOOR, not a content check, and that whether the prose is
TRUE is checked by reading the block, which is why the done-block requires it quoted verbatim
in the SUMMARY; done-block L471-472 repeats it. That is the honest ceiling, stated.

Four of the seven floored labels additionally carry a mandated content literal on the SAME line
(no force bit, no production write at all, empty forward commit, and MEASURED PUSH SHAPES is
pinned to an exact form by G5), so padding is further constrained there. Three (RESTATEMENT
DECLINED, NO TRIPWIRE, WINDOW PROCEDURE) are floor-only.

### W2 -- RESOLVED on the substance (see W5 for the residual).

The level-1 heading matches the measured convention: AGENTS.md uses level 1 for its two topics
(:4, :27) and level 2 for subsections. The G7a anchored pattern is correct. The action
(L519-523) now states the measurement and the reason inline.

### The new fail-fast additions

    test -s "$SCRATCH/shapes-raw.txt" || { echo "FAIL: step-1 measurement missing"; exit 1; }
    test -s "$SCRATCH/mutation.log"   || { echo "FAIL: step-5 mutation log missing"; exit 1; }

Deletion test: deleting either log fails the gate. Writing nothing fails. An honest FALSIFIED
fails. These also close the SCRATCH-undefined hazard in STEP 1 and the STEP 5 mutation block
(an unset SCRATCH would tee to a root-level path, and the verify block reads the correct path
and fails). Sound, and the right shape.

---

## Iteration-2 counts

- BLOCKERS: 1 (B4 -- G6c vacuous)
- WARNINGS: 3 (W5 done/gate contradiction, W6 step-4 baseline, W7 comment number)
- RESOLVED from iteration 1: B1, B2, B3 (step 3), W2, W3; W1 partially
- New vacuous gate introduced by a fix: 1 (G6c)

## Ship / block read for the coordinator

**B4 BLOCKS.** One line, measured fix in hand. Shipping it unfixed means the plan asserts a
mutation proof in its done-block and success-criteria that nothing performs, and adds a third
introduced-by-a-fix vacuous gate to a repo that is counting them.

**W5, W6, W7 are all shippable with the limitation recorded.** Every one fails CLOSED: W5 is
caught by G7a, W6 is caught by its own count comparison, W7 is a comment. If B4 is being fixed
anyway, W5 costs one deleted hash character and W6 costs four copied lines -- cheap enough to
fold into the same pass.
