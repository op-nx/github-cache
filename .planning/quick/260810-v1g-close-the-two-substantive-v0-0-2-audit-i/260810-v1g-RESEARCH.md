# Quick Task 260810-v1g: Close the two substantive v0.0.2 audit items - Research

**Researched:** 2026-08-10
**Mode:** quick-task, six scoped questions
**Repo state at research time:** HEAD `5c70c92`, branch `gsd/v0.0.2-os-invariant-cross-os-sharing`,
`origin/main` = `fe25a3f`, 620 ahead / 0 behind, tree clean

---

# PRE-FLIGHT BLOCKERS

## BLOCKER-1 (the big one): item B's window is NOT NEEDED. All three NOT OBSERVED items are already closed by an existing run.

**Run `31305961054` already did this.** [VERIFIED: `gh run view`]

```
databaseId 31305961054  event push  headBranch main  headSha e3bf98b  conclusion success
createdAt 2026-08-09T09:27:44Z  updatedAt 2026-08-09T09:39:31Z
```

`e3bf98b` is an ancestor of HEAD and carries the full post-fix engine: `isOtherRunsSeed` x5,
`alreadyPresent` x9, `bead` x8 in `ci.yml` (identical count to HEAD). [VERIFIED: `git show
e3bf98b:...` + `git merge-base --is-ancestor`]

This is quick 260809-2s6's **own PLAN-2 window** -- a 17-minute temporary `main` window, recorded
in `STATE.md:503` and `260809-2s6-PLAN-2.md:38`. Every figure in `publish-mirror.ts:520-527`
carries its run id.

**Why the audit thinks otherwise: `260809-2s6-SUMMARY.md` has TWO `## NOT OBSERVED` sections,
one per plan.** [VERIFIED: `rg -n "NOT OBSERVED"` -> lines 127 and 350]

- Line 127 is **PLAN-1's**, written before the window. It lists the three items.
- Line 350 is **PLAN-2's**, written after the window. It lists two *entirely different* things
  (whether a consumer ever sees the warning; behaviour on a real cache-version rotation).

The three items were never carried into PLAN-2's section because PLAN-2's window closed them.
The audit read the first section and inherited a stale claim. **Do not open a window to
re-measure something already measured.** See Q4 for the per-item observable and Q6 for what
this does to the ordering decision.

## BLOCKER-2: CONTEXT.md's locked pre-flight "fact" about hop 3 is FALSE. If a window is opened anyway, `gh workflow disable` is required and is DENIED to the agent.

CONTEXT.md:91-92 states: *"The `!github.event.forced` gate IS present in `ci.yml`, so the RESTORE
force-push skips `publish` and `publish-verify`. This is why no workflow suppression is needed for
hop 3."*

**Measured false.** [VERIFIED: `git show <ref>:.github/workflows/ci.yml | rg "github\.event\.forced"`]

| ref | `github.event.forced` present |
|---|---|
| `HEAD` | YES -- `ci.yml:2411` |
| `fe25a3f` (= `origin/main`, the restore target) | **NO** -- rg exit 1 |

A `push` event runs the workflow **at the pushed tip**. The restore lands on `fe25a3f`, which
predates the clause, so the restore push runs the **UNGATED** workflow and attempts real
production publish writes.

This is stated verbatim in two places CONTEXT.md did not carry forward:

- `260808-u2q-SUMMARY.md:73-74` -- *"the restore lands on `fe25a3f`, which PREDATES this clause --
  so the final restore hop runs the UNGATED workflow and publishes exactly as before. The clause
  is dormant for restores"*. **The same file's `must_haves` line 9 says the opposite** (*"a window
  RESTORE push writes nothing"*); CONTEXT.md lifted line 9 and missed the line-73 correction.
- `260808-wxg-EVIDENCE.md` "WHAT THIS DOES NOT PROVE" -- *"Every window until v0.0.2 lands needs
  the hop-3 suppression. A green hop 2 must not be read as 'restores are safe now'."*

Independently corroborated: `STATE.md` records a prior restore push firing run `30825636788`,
which *"failed on BOTH `publish` legs attempting real production writes"*.

**Consequence, only if a window is opened:** hop 3 needs `gh workflow disable 313666980` before the
restore push and `gh workflow enable 313666980` after. `260808-wxg-EVIDENCE.md` deviation 1 records
that command was **DENIED to the agent by the auto-mode permission classifier**, and says outright:
*"the next window will hit the same denial -- budget for it rather than discovering it mid-window
with `main` forward."* **Maintainer-run step.** Given BLOCKER-1, the cheapest resolution is to not
open a window at all.

## BLOCKER-3 (conditional, low): a browser is required only if a FRESH independent read of the counts is demanded.

The five publish counts exist **only** in the job summary (Q1). They are already transcribed into
tracked source with their run id. If the maintainer wants a fresh first-hand read rather than the
artifact chain, that is a browser step -- but **against the permanent run `31305961054`, not a new
window.** Job summaries persist with the run; that run is one day old.

---

# Q1 -- Is `readMisses` readable without a browser?

**Answer: NO for the five counts. They reach the job summary only, never the step log. But this
does not gate anything, because the numbers were already read and recorded.**

## The emission path, traced in code

`action/index.ts:222` calls `writeCountSummary('github-cache publish', [...])` with rows
`scanned` / `mirrored` / `skipped` / `restore-MISS (of skipped)` / `failed`.
[VERIFIED: `git grep` over `packages/github-cache/src`]

`lib/summary.ts:13-25` is the whole implementation:

```ts
core.summary.addHeading(heading, 2).addTable([...]);
await core.summary.write();
```

`core.summary` writes to `$GITHUB_STEP_SUMMARY` and nothing else. **No `core.info`, no
`console.log`, no `core.setOutput`, no uploaded artifact** anywhere in
`packages/github-cache/src/publish/`. [VERIFIED: `git grep -n "core\.info\|core\.summary\|
writeCountSummary\|setOutput\|console\.log" -- packages/github-cache/src/publish/` -> exit 1,
positive control: the directory has 2 tracked files]

## Measured against the real logs

Both publish legs of run `31305961054` pulled via `gh run view --job <id> --log`:

| needle | job 93226687998 (ubuntu) | job 93226687984 (windows) |
|---|---|---|
| `of 11[23]`, `scanned`, `restore-MISS`, `restored as a MISS`, `::warning` | no match | no match |
| positive control `github-cache publish` | `...resolved compression method zstd-without-long.` | same |

The positive control proves the log was fetched and does contain `github-cache publish` lines.
[VERIFIED: `gh run view --job ... --log`]

## The irony worth stating in the plan

The one code path that *would* put `readMisses`/`scanned` into the log is
`publish-mirror.ts:640` (`core.warning` -- warnings DO appear in the log). It fires only when
`wilsonLowerBound(readMisses, scanned) >= PARTIAL_READ_MISS_WARN_RATIO`. At the measured healthy
baseline the bound is 0.299, below the threshold, so **the branch is silent exactly when the fix
is working.** Success makes the number unobservable via `gh`. Confirmed by the table above.

## `ACTIONS_STEP_DEBUG`: not needed, and would not help

`ACTIONS_STEP_DEBUG` in this repo belongs to Phase 11's `Cache: n/m hit` / O3 observations, not to
the publish counts. [VERIFIED: `git grep`] `core.summary` does not write to the log at any
verbosity, so no debug setting can surface these five numbers. The recorded restore-MISS/debug
association is a different mechanism (`RUNNER_DEBUG_OBSERVED` at `ci.yml:955`, *"RECORDED, never
gated"*).

## What IS readable via `gh` alone

Both of these close item B's other two sub-items with no browser:

```bash
# publish-verify conclusions (item B #2)
gh run view 31305961054 --json jobs -q '.jobs[] | select(.name|startswith("publish")) | [.name,.conclusion] | @tsv'

# the bead round-trip (item B #3)
gh run view --job 93226343957 --log | rg -F "bead"   # windows leg
gh run view --job 93226343959 --log | rg -F "bead"   # ubuntu leg
```

---

# Q2 -- The window procedure, as previously executed

**Reconstructed for contingency only.** Given BLOCKER-1 this should not be executed. Sources:
`260808-wxg-PLAN.md`, `260808-wxg-EVIDENCE.md`, `260808-u2q-SUMMARY.md`. [CITED: those files]

## Pre-flight (every item blocks the open push)

```bash
gh pr close 16                                          # 1. NOT OPTIONAL -- see below
git push origin fe25a3f:refs/backups/pre-v1g-window     # 2. NEW name, never reuse
git ls-remote origin 'refs/backups/*'                   #    verify present on origin BEFORE moving anything
gh workflow list --all | rg CI                          # 3. must show 313666980 active
gh release view nx-cache-202608 --json assets -q '.assets|length'   # 4. headroom vs 1000 cap
git rev-parse origin/main                               # 5. == fe25a3f
git status --porcelain                                   #    clean
git merge-base --is-ancestor fe25a3f HEAD                #    hop 1 is a fast-forward
# 6. commit and PUSH this plan + the recovery note BEFORE the window opens
```

**Step 1 is the load-bearing one.** PR #16's base is `main` and its head is the branch being
pushed there. Left open, GitHub auto-closes it **as merged**, setting `mergedAt` -- a de-facto
merge of v0.0.2, which is prohibited. Precedent: PR #12 was closed for this reason.

**Backup ref verification:** `refs/backups/*` are invisible to `git branch -r`; list with
`git ls-remote origin 'refs/backups/*'`. Currently **seven** exist, all at `fe25a3f`:
`main-pre-phase13-verify`, `main-pre-publish-verify-window`, `main-pre-window2-260803`,
`main-pre-windowA-260803`, `main-pre-windowB-260803`, `pre-2s6-window`, `pre-wxg-window`.
[VERIFIED: `git ls-remote`] They are reused by name, so they cannot count occurrences -- do not
reuse or delete any. Shard `nx-cache-202608` is at **98** assets against the 1000/month cap.
CI workflow `313666980` is **active**. [VERIFIED]

## Hop 1 -- OPEN (fast-forward, forced=false, publish RUNS)

```bash
git push origin HEAD:main        # PLAIN push. Never --force. Fast-forward: 620 ahead, 0 behind.
```

Then **wait for the run to CONCLUDE** before anything else. `cancel-in-progress` is false for
push, so a later rewind does not cancel the in-flight run -- it queues a second one behind it. The
hazard is interleaved evidence attributed to the wrong run, not destruction.

## Hop 2 -- the skip proof (optional; already observed once)

```bash
git push --force-with-lease origin <tip-carrying-the-gate>:main
```

wxg established this as a genuine controlled experiment: `ci.yml` executable content held
constant (823 lines each after stripping comments/blanks, `diff` exit 0 -- **not** byte-identical,
and `git diff --stat` reports 18 comment-only insertions), so `github.event.forced` is the only
variable. Result: publish RAN on hop 1, SKIPPED on hop 2, `publish-verify` skipped by cascade,
0 release assets. Verify identity this way, never with `--stat`:

```bash
diff <(git show <sha>:.github/workflows/ci.yml | rg -v '^\s*(#|$)') \
     <(git show HEAD:.github/workflows/ci.yml  | rg -v '^\s*(#|$)') && echo IDENTICAL
```

## Hop 3 -- RESTORE (UNGATED -- suppression REQUIRED, see BLOCKER-2)

```bash
gh workflow disable 313666980                          # MAINTAINER-RUN (denied to agent)
git push --force-with-lease origin fe25a3f:main
# assert NO new run was created for this push
gh workflow enable 313666980                           # MAINTAINER-RUN; assert active again
gh pr reopen 16                                        # ONLY after origin/main == fe25a3f
```

A repo left with CI disabled is a worse outcome than the defect this avoids -- re-enable
immediately and assert.

## Recovery if the session dies mid-window

**The window is OPEN whenever `origin/main != fe25a3f`.** Staged so it survives a dead session by
being **committed and pushed to the remote before the window opens** (pre-flight step 6).

1. `git rev-parse origin/main`. If `fe25a3f`, window CLOSED -- check only steps 3-5.
2. Otherwise: disable CI, `git push --force-with-lease origin fe25a3f:main`, re-enable. Restore
   point also at `refs/backups/pre-v1g-window`. **`gh workflow disable` is not idempotent** -- it
   errors on an already-disabled workflow; read state with `gh workflow list --all` first rather
   than trusting the exit code.
3. CI must be `active`.
4. `gh pr view 16` -- OPEN, `mergedAt: null`. **Restore FIRST, reopen only once
   `origin/main == fe25a3f`** (reopening while `main` is forward re-creates the
   auto-close-as-merged condition). **If `mergedAt` is NOT null: STOP and tell the maintainer.**
5. Do NOT re-open a window to "finish" -- re-run from pre-flight.

## Duration and what went wrong last time

wxg's window: opened **22:19:01Z**, closed **23:24:26Z**, **65m25s**. Push times taken from
`GET /repos/op-nx/github-cache/events` (the server's clock), not the local one.

Three recorded deviations, all still live:

1. **`gh workflow disable` DENIED to the agent** -- maintainer ran it. Will recur. (BLOCKER-2)
2. **Job summaries required a browser** -- `playwright-cli attach --extension=chrome` against the
   maintainer's signed-in Chrome. The agent had first recorded them NOT OBSERVED. (Q1)
3. **Read-only pre-flight ran before the PR close** -- deliberate, so a failed assertion does not
   cost a needless close/reopen. The plan's ordering is emphasis, not a data dependency.

Also: hop 1's writes are **permanent**. The restore rewinds a git ref, not a Release. wxg's window
grew the shard 78 -> 87 (+9). Accepted, and recorded in CONTEXT.md.

---

# Q3 -- Which run, and how to wait for it

Contingency only. Locate by head SHA + event, never by "latest".

```bash
SHA=$(git rev-parse HEAD)

# locate (poll until non-empty; the run does not exist the instant the push returns)
RUN=$(gh run list --branch main --event push --limit 20 \
        --json databaseId,headSha,status \
        -q ".[] | select(.headSha==\"$SHA\") | .databaseId" | head -1)

# wait to completion
gh run watch "$RUN" --exit-status        # or: until [ "$(gh run view "$RUN" --json status -q .status)" = completed ]; do sleep 30; done

# resolve the job ids
gh run view "$RUN" --json jobs \
  -q '.jobs[] | select(.name|test("^publish")) | [.databaseId,.name,.conclusion] | @tsv'
```

Cross-check `headSha` on the resolved run before reading anything from it. Expected wall-clock:
wxg's window was ~65 min end to end; run `31305961054` itself took **11m47s** (09:27:44Z ->
09:39:31Z), with `publish` starting at 09:31:44Z and `publish-verify` finishing 09:39:30Z.
[VERIFIED: `gh run view`]

---

# Q4 -- What "closed" looks like for each of item B's three items

**All three are ALREADY closed by run `31305961054`.** The observable and its location:

## B-1 -- the `readMisses` / `scanned` ratio. CLOSED (job summary, transcribed).

| leg | scanned | mirrored | readMisses | alreadyPresent | rate |
|---|---|---|---|---|---|
| `publish (ubuntu-24.04-arm)` job 93226687998 | 112 | 10 | **43** | 59 | **38.4%** |
| `publish (windows-11-arm)` job 93226687984 | 113 | 1 | **43** | 69 | **38.1%** |

Both jobs `success`. [VERIFIED: `gh run view --json jobs`; figures CITED from
`publish-mirror.ts:520-527`, `publish-mirror.spec.ts:1611`, `260809-2s6-PLAN-2.md:38`,
`260809-2s6-SUMMARY.md:255`, `STATE.md:503`]

Provenance is honest and needs stating in the plan: these were read **from the job summary at the
time** by the task that ran the window, then transcribed into tracked source with the run id.
They are **measured, not derived** -- 260809-2s6 explicitly contrasts them against the DERIVED
33% and a review's corrected 41%, both of which were wrong by the *denominator* while the miss
count of 43 was right in both. They are **not re-readable via `gh` today** (Q1); a fresh
independent read needs a browser on run `31305961054`'s page.

## B-2 -- both `publish-verify` legs green. CLOSED (`gh`-readable).

```
publish-verify (ubuntu-24.04-arm)   93227111969   success   09:35:55Z -> 09:36:30Z
publish-verify (windows-11-arm)     93227112032   success   09:35:55Z -> 09:39:30Z
```

All 26 jobs in the run are `success`; zero failed, zero skipped. [VERIFIED: `gh run view
31305961054 --json jobs`]

## B-3 -- the `bead` round-trip cross-job HIT under the NEW key. CLOSED (verbatim log lines).

This is the least documented one, so here it is in full. `bead` is D2's marker word for the
`dogfood-seed` bare-run-id family (chosen over `dead` because `ci.yml` already ships `deadbeef`).
The key is `bead` + the run id: **`bead31305961054`**. The producer is the `dogfood-seed` job
(93226283306), the readers are the two `dogfood-verify` legs -- so this is genuinely
**cross-job**, and the windows leg is **cross-OS**.

Verbatim, from `gh run view --job <id> --log`: [VERIFIED]

```
job 93226343959  dogfood-verify (ubuntu-24.04-arm)   2026-08-09T09:28:52.0747651Z
github-cache dogfood verify: cache HIT for bead31305961054 on linux with bytes matching a 'linux'-produced payload.

job 93226343957  dogfood-verify (windows-11-arm)     2026-08-09T09:31:17.3254433Z
github-cache dogfood verify: cache HIT for bead31305961054 on windows with bytes matching a 'linux'-produced payload.
```

`bead` appears 3x in each verify log and 2x in the seed log; `bead` is present 8x in `ci.yml` at
`e3bf98b`, the same count as at HEAD, so the key the run used is the shipped one. The windows line
is the closing observable: **reader `windows`, producer `'linux'`, HIT, under the new key.**
Both legs `success`.

## The `10-VERIFICATION.md` rewrite rule

`10-VERIFICATION.md:12` still carries `expected: "... readMisses 0 ..."`, with `:15`'s
`open_sub_item` closing on: *"Close it from the same live window that closes the three unobserved
items in `260809-2s6-VERIFICATION.md`."* **That window happened: run `31305961054`.**

The rule, restated: **substitute only a MEASURED value, never a derived one.** The value that
qualifies is `readMisses 43 of scanned 112` on ubuntu (`43 of 113` on windows), attributed to run
`31305961054` at head `e3bf98b`, jobs 93226687998 / 93226687984. Do not write a rate without its
denominator -- `publish-mirror.ts:599` states the rule the codebase already follows: *"Read the
observable as `readMisses / scanned` and not as a bare `readMisses`: the count alone is consistent
only at one denominator, and `scanned` moves."* Every figure carries its run id; that convention
is guarded (260809-og2 pins it) and the rewrite must honour it.

---

# Q5 -- Per-commit gating mechanics and cost

## The range is 22 commits, all live ancestors of HEAD

`git rev-list --count 4518787..1b06816` -> **22**. Every one passes
`git merge-base --is-ancestor <sha> HEAD`; **zero non-ancestors**. `1b06816` is itself an ancestor
of HEAD. [VERIFIED]

`git merge-base --is-ancestor` is the correct check, exactly as the task framing says: kuo
reworded two commits, so the pre-reword hashes are dangling but still resolve in `git log --all`.
The 22 enumerated by `git rev-list 4518787..1b06816` are the live ones -- the range walk follows
parent pointers from the live tip, so a dangling pre-reword object cannot appear in it.

Order, oldest first (C1..C22 as they should be gated):

```
 1 a149f95 perf  A3 load the six nx/src specifiers lazily
 2 f31705f perf  A4 construct the task hasher once per capture
 3 de95090 refac A5 route three workspace-root walks through the repo-file layer
 4 5968d51 refac A6 one package-source walk primitive
 5 1a06f3b refac A10 one probeTokenOf
 6 e4f7f71 perf  A1 memoize readRepoFile's successful reads
 7 9586ec4 perf  A2 memoize jobBlock
 8 ffb7f96 test  A7 strengthen the docs discriminator gate
 9 9e12f46 test  A8 derive both detector needles from INVARIANT_TARGETS
10 2a97f1f refac A9 call mirroredByLabel at read-back.ts's two label sites
11 ca34893 refac A11a delete the `read` alias
12 73b6da1 refac A11b delete the `mirroredBy` alias
13 806165b test  A12 delete the Prettier-import-shape assertion
14 8cc8020 perf  A13 spawn the accepted fixture once, lazily
15 31bb47b refac A14 derive the six no-restricted-imports entries
16 a9184a4 test  A15 collapse the five entry pins to one it.each table
17 b6580ad docs  open the v0.0.3 deferral record
18 af53734 fix   CR-01 restore the collapseToOneLine single-choke-point pin
19 9709a2b fix   WR-01 re-close the gate on the six deferred nx/src subpaths
20 fd8fa7a fix   WR-02 + WR-05 single-source the snippet targets
21 c02f0d6 docs  WR-03 + WR-04 correct two docstrings
22 1b06816 docs  IN-01 tighten two ordering comments
```

`git diff --name-only 4518787..HEAD -- package.json package-lock.json` is **empty** -- deps are
constant, one `npm ci` covers all 22. [VERIFIED, re-confirming CONTEXT.md's measurement]

## MEASURED: one full eight-gate uncached battery is 15 SECONDS

Timed twice at HEAD in the main tree. [VERIFIED: timed this session]

| run | nx phase (5 targets, `--skip-nx-cache`) | tail (format:check, check:action, fallow:ci) | TOTAL | all gates |
|---|---|---|---|---|
| warm `dist`/tsbuildinfo | 7s | 8s | **15s** | green |
| cold (`dist` + `out-tsc` deleted first) | 8s | 7s | **15s** | green |

The cold run is the honest analogue of a fresh checkout, and it costs the same -- the critical
path is `lint` at 3.1s, not compilation. 1145 tests in `test`, 15 in `integration`, 44 files.

**So 22 commits x 15s = ~5.5 minutes of battery, plus ~1-2s per checkout: under 10 minutes for
the entire sweep.** "Best effort" reaches **22/22 comfortably**. The locked decision to scope the
deliverable honestly still stands -- but there is no cost reason to stop short, and the plan
should say plainly that 22/22 is now cheap rather than inheriting kuo's "22 checkouts x 6 gates
was not run" framing, which was written without this measurement.

## Traps in checking out 22 historical commits in the main tree

1. **Tree must be clean first.** Currently clean except the untracked
   `.planning/quick/260810-v1g-*/` directory, which survives checkout harmlessly (the target
   commits do not contain that path). But `.planning/` **is** tracked and its content changes
   under each checkout -- so do not commit task artifacts mid-sweep, and write the sweep log
   files outside the repo (`/tmp`, or the scratchpad).
2. **`check:action` writes into the tree. This is the real trap.** `check:action` =
   `npm run build:action && git diff --exit-code -- start-cache-server/index.js`. esbuild
   **always** rewrites `start-cache-server/index.js`; the gate is the subsequent `git diff`. If a
   historical commit's committed bundle does not match a fresh build of that commit's sources, the
   gate correctly fails **and leaves the tree dirty**, which blocks the next `git checkout`.
   Mitigation: `git checkout -- start-cache-server/index.js` at the end of every iteration,
   unconditionally, after recording the exit code.
   Note `start-cache-server/index.js` is **not touched by any commit in the range** (`git log
   4518787..1b06816 -- start-cache-server/index.js` is empty), so drift at a mid-range commit
   would be a genuine finding, not noise. [VERIFIED]
3. **`check:action` in the main tree gives a TRUE verdict.** The recorded false-drift finding
   (junctioned `node_modules` makes esbuild rewrite 689 module paths) is worktree-specific. This
   is the main tree with a real install, and `check:action` measured **green, tree left clean**
   this session. Do the sweep **on the main tree**, never in a worktree.
4. **`.nx/cache` and `.nx/workspace-data` live at the worktree root and are gitignored** -- they
   survive every checkout with content from other commits. `--skip-nx-cache` is what neutralises
   the terminal-output replay, and it is mandatory per commit. `packages/github-cache/dist` and
   `out-tsc` likewise survive; tsc `--build` is content-keyed so this is safe, and the cold
   measurement above proves deleting them costs nothing. Delete them per iteration if you want
   maximal isolation for 0 extra seconds.
5. **Detached HEAD.** Return with `git checkout gsd/v0.0.2-os-invariant-cross-os-sharing`, and
   assert `git rev-parse HEAD` == `5c70c92` (or the then-current tip) at the end.
6. **`nx run-many` on a missing target exits 0.** Assert on the printed line, not the exit code:
   `Successfully ran targets build, typecheck, test, integration, lint`. Verified present in this
   session's log. A silently-deleted inferred target would otherwise pass.

## The loop shape (AGENTS.md capture discipline)

`${PIPESTATUS[0]}` captured into a **variable**; never `exit ${PIPESTATUS[0]}` inline, which
terminates the shell and reports one clean iteration over a sweep that never ran. Per-iteration
suffix on the log name, because `date +%s` has one-second resolution and 15s iterations would
otherwise be fine but the sub-gates within one iteration would collide.

```bash
OUT=/tmp/v1g-sweep; mkdir -p "$OUT"
i=0
for sha in $(git rev-list --reverse 4518787..1b06816); do
  i=$((i + 1))
  git checkout --quiet "$sha" || { echo "CHECKOUT-FAILED $i $sha"; break; }

  L="$OUT/$i-$sha"
  npx nx run-many -t build typecheck test integration lint --skip-nx-cache 2>&1 | tee "$L-nx.log"
  nx=${PIPESTATUS[0]}
  ran=$(rg -c -F "Successfully ran targets build, typecheck, test, integration, lint" "$L-nx.log" || echo 0)

  npm run format:check 2>&1 | tee "$L-format.log"; fmt=${PIPESTATUS[0]}
  npm run check:action  2>&1 | tee "$L-action.log"; act=${PIPESTATUS[0]}
  npm run fallow:ci     2>&1 | tee "$L-fallow.log"; fal=${PIPESTATUS[0]}

  git checkout --quiet -- start-cache-server/index.js   # trap 2: always, even on green

  echo "$i $sha nx=$nx ran=$ran format=$fmt action=$act fallow=$fal" | tee -a "$OUT/RESULTS.tsv"
done
git checkout --quiet gsd/v0.0.2-os-invariant-cross-os-sharing
```

Do **not** `break` on a red gate -- best effort means recording every commit's verdict, and Nx
caches terminal output for successful runs only, so a red commit's output exists nowhere but the
`tee` log. `ran=0` with `nx=0` is the missing-target failure mode and must be treated as red.

## Recommended order

**Oldest-first (`--reverse`), as listed above.** Rationale, since the alternative is tempting:
kuo measured 10 of 22 on `test` only, and the 12 unmeasured are the obvious priority -- but at
15s per commit the whole sweep finishes before any prioritisation pays for itself, and
oldest-first is the only order in which a partial sweep is a **contiguous prefix**, which is what
"every commit up to X leaves all eight gates green" needs to be a bisect-safety claim at all. A
cherry-picked subset proves nothing about bisect safety no matter which subset it is. If the sweep
must be truncated, a prefix is the maximally informative partial result.

---

# Q6 -- Ordering, and the pre-flight blockers

## The locked ordering decision is CORRECT as reasoning, and MOOT as applied

CONTEXT.md locks *"B's window must be opened AND restored before A's first checkout"*, on the
grounds that A's 22 `git checkout`s would leave the tree detached at a historical commit while
`main` points at the feature tip.

**The reasoning is sound and I do not challenge it.** A detached working tree during an open
window would make the recovery procedure much harder to execute correctly, and the window is the
only stateful operation in the milestone.

**But it no longer binds anything, because item B needs no window** (BLOCKER-1). What item B
actually needs is: read four `gh` commands, transcribe the measured figures, and rewrite
`10-VERIFICATION.md`'s row plus the stale `260809-2s6-SUMMARY.md:127` section. All read-only
against a permanent run, all safe to interleave with anything.

**Recommended sequence:**

1. **Item B, evidence-only** (~5 minutes, no window, no push): re-run the four `gh` reads in Q1/Q4
   to confirm the run and its jobs are still resolvable, then write the closures.
2. **Item A** (~10 minutes): the 22-commit sweep, on the main tree.
3. Both artifacts committed together.

Keep the ordering constraint documented as the rule that *would* apply if a window were ever
opened -- do not delete the reasoning, just record that the precondition never arose.

## Pre-flight blockers, restated

| # | Blocker | Who | When |
|---|---|---|---|
| 1 | The three NOT OBSERVED items are stale; a window would re-measure what run `31305961054` already measured. **Maintainer decision: skip the window.** | maintainer | before planning |
| 2 | *If a window is opened anyway:* `gh workflow disable 313666980` / `enable` for hop 3 is **denied to the agent**, and IS required (`fe25a3f` lacks the gate). | maintainer | before hop 1 |
| 3 | *If a fresh first-hand read of the counts is demanded:* browser step (`claude-in-chrome` / `playwright-cli attach --extension=chrome`) against run `31305961054`'s page. Not a window. | maintainer + agent | optional |

Nothing else in either item requires a capability the agent lacks. No pushes, no ref creation, no
merges.

---

# Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|---|---|---|
| A1 | Run `31305961054`'s job summaries are still readable in a browser (retention). Run is 1 day old; GitHub retains summaries with the run. Not tested -- no browser used here. | Q1, BLOCKER-3 | Only affects the optional fresh re-read; the transcribed figures are unaffected. |
| A2 | The 43/112 and 43/113 figures are faithful transcriptions of that run's job summaries. Cross-checked across five independent tracked artifacts that agree, but not re-read from the source this session. | Q4 B-1 | A transcription error would propagate into `10-VERIFICATION.md`. Mitigated by A1's browser re-read if the maintainer wants belt-and-braces. |
| A3 | A mid-range commit's `check:action` could fail and dirty the tree. Reasoned from the script's shape (esbuild always writes, `git diff` is the gate), not observed at a historical commit. | Q5 trap 2 | If it never fires, the unconditional `git checkout --` is a harmless no-op. Cheap insurance either way. |

# Sources

**Primary (HIGH -- measured this session)**
- `gh run view 31305961054 --json ...` (metadata, 26 jobs, conclusions)
- `gh run view --job 93226343957|93226343959|93226283306|93226687998|93226687984 --log`
- `git show fe25a3f:.github/workflows/ci.yml`, `git show e3bf98b:...`, `git merge-base --is-ancestor`
- `git rev-list --count 4518787..1b06816`, per-commit ancestor loop
- two timed eight-gate battery runs at HEAD (warm and cold)
- `git ls-remote origin 'refs/backups/*'`, `gh workflow list --all`, `gh release view nx-cache-202608`

**Primary (HIGH -- tracked artifacts)**
- `packages/github-cache/src/lib/summary.ts`, `.../publish/publish-mirror.ts:440-650`,
  `.../action/index.ts:213-263`
- `260808-wxg-PLAN.md`, `260808-wxg-EVIDENCE.md`, `260808-u2q-SUMMARY.md:9,43,73-74`,
  `260809-2s6-SUMMARY.md:127-181,350-360`, `260809-2s6-PLAN-2.md:38`,
  `10-VERIFICATION.md:8-19,133-160`, `STATE.md:503`, `AGENTS.md`, `CLAUDE.md`
