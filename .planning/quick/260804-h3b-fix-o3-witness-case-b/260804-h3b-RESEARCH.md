# Quick Task 260804-h3b: Fix o3-witness Case-B - Research

**Researched:** 2026-08-04
**Domain:** GitHub Actions cache scoping, ci.yml job wiring, Nx task-hash inputs
**Confidence:** HIGH on Q1-Q5 (each closed by measurement, not by reading)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Doc correction AND a live Case-B observation. Operator chose the observation explicitly over
  doc-only.
- Operator authorisation (granted 2026-08-04): temporary push to `main` with backup before and
  restore after; push to any branch; drafting, opening and closing any PR. Scoped to THIS task.
- Case B decomposes into two sub-claims; prove (a) first because it is free and de-risks (b).
  - (a) prior-existence delta allowance -- `.planning/`-only re-push to the EXISTING PR branch,
    no main window.
  - (b) the `$defaultref` clause matching -- needs an `nx-cache-<H_linux>` entry in the
    `refs/heads/main` scope for the CURRENT integration hash. Needs the main window.
  - Report them separately -- do not let (a) passing be written up as (b) proven.
- Retire the ROADMAP note in place (dated STATUS block, original text kept), per the file's own
  house style at `ROADMAP.md:646-688`.
- Correct `.planning/v0.0.2-MILESTONE-AUDIT.md` in the SAME task.
- No new standing guard.

### Claude's Discretion
- Wording of the ROADMAP status block and the audit correction.
- Branch and PR naming for the probe.
- Whether to fold the observation into `11-EVIDENCE.md` or keep it in this task's own EVIDENCE
  file (prefer this task's own).

### Deferred Ideas (OUT OF SCOPE)
- Any `o3-witness` behaviour change (scope re-opens only on a genuine code defect; none found).
</user_constraints>

## Summary

All five open questions are CLOSED, and none of the five closes the way the brief feared. The
positive control does NOT 404 on a Case-B run -- measured on the real Case-B run `30768540898`,
where the ubuntu leg logged `cacheStatus=remote-cache-hit` and the probe still returned 200. The
plan is viable as drafted.

Two findings change the plan's shape rather than its viability. **First**, a probe PR whose base
IS `main` cannot attribute its match to the `$defaultref` clause -- `base_ref` and `default_ref`
are then the same string and the `$baseref` clause matches first (`ci.yml:1255-1257` says so in
its own words). Sub-claim (b) as WRITTEN requires a **stacked** PR (base != default branch).
**Second**, rewriting `refs/heads/main` neither deletes nor orphans that scope's cache entries
(measured: 90 main-scope entries created 2026-08-03 survive the same-day rewind to `fe25a3f`), so
the observation run does not need main to still be advanced -- it can be created entirely AFTER
the restore. That collapses the exposure window to the advance-push-plus-save interval, roughly
2-4 minutes, and is strictly better than `260803-mew`'s restore-while-in-flight.

**Primary recommendation:** run sub-claim (a) as a `.planning/`-only re-push to PR #16 (free, key
`nx-cache-16483311331776729079` already in place). For (b), push two throwaway branches FIRST,
open the window only to let one ubuntu `integration` leg save, restore immediately, and open the
stacked PR afterwards.

---

## Q1 -- the integration positive control on a Case-B run

**VERDICT: it returns 200. It does NOT 404 and does NOT redden the leg. Measured on a real
Case-B run, both legs. The plan is viable as drafted.**

**Which key, and how derived.** `ci.yml:1061` reads `own_hash="$(cat integration-hash.txt)"` --
the file `read-integration-hash.mjs` wrote from `.nx/cache/run.json` one step earlier
(`ci.yml:955-959`). The GET is `${SERVER}/v1/cache/${own_hash}` (`ci.yml:1062`), so the probed key
is this leg's own `integration` task hash, per leg.

**Why a RESTORED-but-not-saved key still answers 200.** The sidecar's GET handler calls
`backend.get(hash)` (`server/server.ts:151`) and maps `kind: 'hit'` to 200, everything else to 404
(`:153-163`). The Actions backend's `get` is a real `cache.restoreCache([path], cacheKeyFor(hash),
undefined, undefined, true)` (`backend/actions-cache-backend.ts:219-225`) followed by `readFile`,
with an unconditional `rm` in `finally` (`:239`). Nothing in that path is save-conditioned: it is
a fresh restore against the cache service every call, and the service resolves the key from the
run's whole readable scope (own ref, base ref, default branch), not from what this run wrote. So a
key the task RESTORED is just as present as one it saved.

**Measured, not reasoned** -- run `30768540898` (`pull_request`, head `obs/case-b-base-scope`, the
run that exposed the `&ref=` bug), ubuntu leg log:

```
integration hash=12697574074682705580 cacheStatus=remote-cache-hit status=0 -> integration-hash.txt
Cache hit for: nx-cache-12697574074682705580          <- the probe's own restoreCache
positive control: GET /v1/cache/12697574074682705580 -> 200 (wanted 200)
```

Both `integration` legs concluded `success` on that run, and the `Positive control on this leg's
own key, which must return 200` step concluded `success` on BOTH. The o3-witness job failed; the
integration legs did not.

**Per leg.** The step carries no `if:` and sits in the one matrix job (`ci.yml:862-867,
1056-1067`), so it runs on ubuntu and Windows identically. On a Case-B run the ubuntu leg 200s
from a RESTORE; the Windows leg 200s from its own SAVE when `H_win` is not yet in a readable scope,
or from a restore when it is. Both directions are measured: run `30807461616` (push to main)
logged `cacheStatus=cache-miss` then `-> 200` on BOTH legs; run `30768540898` logged
`remote-cache-hit` then `-> 200` on the ubuntu leg.

**Consequence for the plan.** No probe reshaping, no red-leg workaround, no reading the
observation out of a failed log. The step's COMMENT is narrower than its code -- `ci.yml:1004`
says "the entry this leg's own task just saved", and the actual invariant is "restored or saved".
That is a documentation defect, not a code defect. Correcting that one line is optional and, if
taken, must NOT be bundled into sub-claim (a)'s `.planning/`-only push (`ci.yml` is a declared
`test` input; see Q4).

---

## Q2 -- does a `push` to `main` save into `refs/heads/main`'s scope, on both legs?

**VERDICT: YES, both legs, and the composition is CI-RW. Confirmed in code and then measured
end-to-end on run `30807461616`.**

The chain, file and line for each link:

| Link | Where | Why it passes on `push` to main |
|---|---|---|
| Event allowlist | `lib/trust.ts:32` | `TRUSTED_EVENTS = ['push','schedule']` |
| Trust verdict | `lib/trust.ts:88-90` | `push` is in `TRUSTED_EVENTS` -> `{trusted:true}` on ANY host, no host gate |
| Selection entry | `serve.ts:90` | `selectBackend(process.env)` |
| Gate 1 | `lib/select-backend.ts:44` | `isWriteTrusted` true -> does NOT take the Releases read-only branch |
| Gate 2 | `lib/select-backend.ts:55` | `GITHUB_REPOSITORY` = `op-nx/github-cache`, valid |
| Gate 3 | `lib/select-backend.ts:64` | `GITHUB_TOKEN` is passed to the sidecar at `ci.yml:915-916` |
| Gate 4 | `lib/select-backend.ts:71` | `CACHE_READ_ONLY` is set at exactly three sites -- `ci.yml:520`, `:655`, `:755` (`build-windows`, `typecheck-windows`, `test-windows`), ALL before the `integration` job at `:862`. The integration legs carry none, and `dogfood-cross-os.spec.ts:2027-2032` pins the site count at exactly 3 |
| Outcome | `lib/select-backend.ts:128` | `createActionsCacheBackend()` -- writable |

The `integration` job has no `needs:` and no `if:` (`ci.yml:862-870`), so it starts immediately on
a push and is not event-gated.

**Measured** -- run `30807461616`, `push` to `refs/heads/main` at `70064f5`, conclusion `success`:

| Leg | run.json record | caches API row |
|---|---|---|
| ubuntu-24.04-arm | `integration hash=1497899208623327405 cacheStatus=cache-miss` | `refs/heads/main  nx-cache-1497899208623327405  2026-08-03T10:55:51Z` |
| windows-11-arm | `integration hash=9972473348351546854 cacheStatus=cache-miss` | `refs/heads/main  nx-cache-9972473348351546854  2026-08-03T10:58:37Z` |

Both rows are still listed today. So the answer is yes for `H_linux` and yes for `H_win`.

**Consequence for the plan.** The advance push needs no extra plumbing to make the save happen,
and it must NOT carry `[skip ci]` -- the run IS the deliverable. The ubuntu `integration` leg
saved 34 seconds after run creation on `30807461616`, which is what makes the short window in Q5
realistic.

---

## Q3 -- the restore force-push fires a second full `ci.yml` run

**VERDICT: CONFIRMED, and the mechanism is structural. But the second run writes NO production
Release assets -- both `publish` legs fail at release resolution. Measured on run `30825636788`,
which is a byte-exact rehearsal of the next restore because it ran at `fe25a3f`.**

**Mechanism.** `ci.yml:4-6` triggers on `push: branches: [main]`. The restore is
`git push --force-with-lease=main:<W> origin fe25a3f...:refs/heads/main` -- pushing an EXISTING
commit, whose message cannot be edited without changing its SHA and thereby defeating the restore.
`fe25a3f`'s subject is `Merge pull request #7 from op-nx/gsd/quick-260726-gok-typecheck-input...`,
carrying no skip token. `concurrency.cancel-in-progress` is `false` for push (`ci.yml:36`), so the
run queues rather than being superseded.

**What runs, and what writes** (run `30825636788`, `push` to main at `fe25a3f`, 2026-08-03T15:03,
16 job legs):

| Legs | Conclusion | Writes |
|---|---|---|
| `format-check`, `lint`(via fallow), `fallow`, `action-bundle-drift`, `pack-check`, `ppe`, `build`, `typecheck`, `test`, `integration` x2, `dogfood-seed`, `dogfood-verify`, `consumer-smoke` | success | Actions-cache entries under `refs/heads/main` at `fe25a3f`'s task hashes, plus the run-id-keyed seed. Measured: `nx-cache-30825636788` at 15:03:42 and 15:08:11, `nx-cache-cafe30825636788` at 15:04:11 |
| `publish (ubuntu-24.04-arm)`, `publish (windows-11-arm)` | **failure** | mirror-seed cache PUT only. NO Release asset. Log: `GET /releases/tags/cache-mirror-202608 -> 404`, `POST /releases -> 422`, `GET -> 404`, `##[error]Not Found` |
| `publish-verify` | skipped | nothing |

The 422 is the **burned month-shard tag**, and it is name-scoped and permanent, not flaky --
`260803-fcd-CONTEXT.md:126-132` records a paired same-endpoint probe: a fresh tag ref got 201, the
burned `cache-mirror-202608` got 422, with no ruleset involved (measured four ways). `fe25a3f`'s
code still targets the legacy `cache-mirror-` prefix; HEAD's code targets `nx-cache-202608`, which
exists and holds 69 assets.

**Two disclosures the plan must carry, and one correction.** The brief's "TWICE" is one too many:
the ADVANCE push writes real Release assets (that is normal main-push dogfooding -- run
`30807461616` was FULL GREEN and the shard sits at 69 of a 1000 cap); the RESTORE push writes
none. **Time-bounded:** the burn is per-month. Run the window in August 2026 and the restore
writes nothing. In September the fe25a3f code would meet a FRESH `cache-mirror-202609`, create a
legacy-named release, and mirror `fe25a3f`-era entries into it. Pre-flight `gh api
repos/op-nx/github-cache/releases/tags/cache-mirror-202608` must 404, and post-window confirm no
`cache-mirror-*` release appeared.

Optional and NOT recommended by default: cancelling the advance run once the ubuntu `integration`
save is confirmed would skip `publish` entirely (its `if:` is `!cancelled() && ...`), removing the
production write. Cost: the ubuntu `build`/`typecheck`/`test` saves may not have landed, so the
stacked PR's three read-only Windows legs could MISS and redden their floor-of-1 gates, muddying a
clean observation. Also `ci.yml:17-24` warns that cancelling a push run mid-upload can leave a
permanent torn Release asset -- safe only strictly BEFORE `publish` starts. Name it, default to
letting the advance run complete.

---

## Q4 -- is `.planning/**` genuinely outside every declared Nx input?

**VERDICT: YES, and closed by direct hash measurement with a positive control on the instrument,
not by an input scan alone.**

**Scan half, with its own positive control.** `npx nx show project @op-nx/github-cache --json`
resolves `integration`'s inputs to: `default` (= `{projectRoot}/**/*` + `sharedGlobals` =
`{workspaceRoot}/tsconfig.base.json`), `^production`, `{workspaceRoot}/read-integration-hash.mjs`,
the `tsconfig.spec.json` fileset, the `tsconfig.json` `compilerOptions` json input,
`externalDependencies: [vitest]`, `dependentTasksOutputFiles`, and
`{runtime: node --no-warnings -p process.platform}`. `{projectRoot}` is `packages/github-cache`,
so no entry can reach `.planning/**`. **POSITIVE CONTROL, same command, same output:** `test`
DOES resolve `{workspaceRoot}/.github/workflows/ci.yml`, `{workspaceRoot}/docs/advanced.md` and 20
more workspace-root entries. The scan therefore demonstrably surfaces a `{workspaceRoot}` file
when one is declared -- it did not return "nothing" because it looks nowhere.

**Measurement half** (`capture-hashes.mjs`, which drives Nx's own `createTaskHasher`):

| Tree state | build | typecheck | test | integration | lint |
|---|---|---|---|---|---|
| baseline (clean) | 17727199787119239487 | 9209124846809945647 | 3225206396952678183 | **4100361685679151443** | 1164916491562201803 |
| + one new `.planning/` file | SAME | SAME | SAME | **SAME** | SAME |
| + one-line edit to `read-integration-hash.mjs` (unstaged) | SAME | SAME | SAME | **977961632194805072 ROTATED** | SAME |

The third row is the non-vacuity proof and it matters more than the second: it uses the SAME
modality -- an uncommitted, unstaged working-tree change -- so the SAME verdict in row 2 cannot be
an artefact of the hasher reading only committed state. It also rotates exactly one target, the
only one that declares that file. Tree restored clean afterwards; only the untracked task
directory remains.

**Independent cross-check that the local instrument is CI's instrument.** The baseline local
win32 `integration` hash `4100361685679151443` is exactly the key the CI Windows leg saved on the
latest PR #16 run: `refs/pull/16/merge  nx-cache-4100361685679151443  2026-08-04T09:31:45Z`. And
`build`/`typecheck`/`test`'s local hashes match the ubuntu saves byte for byte, which is the
OS-invariance this milestone exists to produce.

**Consequence for the plan.** A2 holds. A one-file `.planning/` diff rotates nothing, so the
probe PR is Case B for ALL FIVE targets, not just `integration`. Corollary the plan must respect:
do NOT bundle a `ci.yml` or `docs/*` edit into sub-claim (a)'s push, because those ARE declared
`test` inputs and would turn `test` into Case A.

---

## Q5 -- minimum-exposure ordering

**VERDICT: rewriting `refs/heads/main` neither deletes nor orphans that scope's cache entries, so
the observation run does not need main to still be advanced. It can be created entirely AFTER the
restore. Recommended window: advance -> confirm the save -> restore, with the PR opened
afterwards.**

**Scope persistence, measured.** GitHub scopes a cache entry by ref NAME, and the entry outlives
a rewrite of that ref's tip. `main` was force-rewound to `fe25a3f` on 2026-08-03T11:09 (run
`30808393246`) and again at 15:03 (run `30825636788`). The entries the 10:55 window run
`30807461616` created under `refs/heads/main` -- including `nx-cache-1497899208623327405` at
10:55:51 and `nx-cache-9972473348351546854` at 10:58:37 -- are STILL LISTED on 2026-08-04. Ninety
main-scope entries created on 2026-08-03 survive, and the oldest surviving main-scope entries date
to 2026-07-19, across every window since. If a rewind purged the scope, none of that could be
true. [VERIFIED: `GET /repos/op-nx/github-cache/actions/caches?per_page=100 --paginate`, 317 rows]

**What the witness still needs after the restore.** `o3-witness` reads the caches API
(`ci.yml:1359-1360`, ref-name-scoped rows -- persist), the jobs API (`:1424-1425`, run metadata --
immutable), the downloaded artifact, and `DEFAULT_BRANCH` from `github.event.repository.default_branch`
(`:1220`, fixed in the event payload at run creation). It does NOT check out the repository at all
-- `ci.yml:1152` states this explicitly. Nothing it reads depends on main's tip. The
`integration` leg's restore needs the ENTRY, not the tip.

**The real ordering hazard is the merge ref, and a stacked PR removes it.** Rewinding `main`
recomputes `refs/pull/N/merge` for every open PR whose base is `main`, so a job in an in-flight
run that has not yet checked out `github.sha` can fail on an unreachable merge commit. `o3-witness`
is immune (no checkout), but `dogfood-verify`, `consumer-smoke` and `hash-parity` are not. For a
STACKED PR (base = a throwaway branch B) the restore touches no ref the run depends on, so the
whole run is insulated. This is the second, independent reason to make (b)'s probe stacked. A base
change does not re-trigger `pull_request` (default activity types are opened/synchronize/reopened),
so the advance and restore do NOT fire PR #16 runs.

**EXPLICITLY OPEN:** whether GitHub ever garbage-collects a cache entry whose creating commit
became unreachable, on a longer horizon than the measurements above (hours to weeks) cover. It
does not affect this plan -- the observation completes minutes after the restore -- and the 7-day
unused expiry and 10 GB LRU eviction are the documented eviction mechanisms.

---

## The probe shapes, concretely

### Sub-claim (a) -- prior-existence delta. FREE, no window. Do this first.

- **Base:** `main`. **Head:** the existing PR #16 branch `gsd/v0.0.2-os-invariant-cross-os-sharing`.
- **Diff:** one new file under `.planning/quick/260804-h3b-fix-o3-witness-case-b/`. Nothing else --
  no `ci.yml`, no `docs/*`.
- **Why it rotates no input:** measured in Q4. All five targets HIT.
- **Pre-registrable expectations** (register BEFORE the push, this repo's own convention):
  - `o3-witness: key=nx-cache-16483311331776729079`
  - `matched_ref=refs/pull/16/merge`
  - `created_at=2026-08-04T09:29:14Z` (the row is present now; the witness selects the EARLIEST
    match, and no older row exists for that key)
  - `delta` on the order of hours, `>= 30`
  - both `integration` legs green, both positive controls `-> 200`
- **Free of the Q1 problem?** YES, and by the strongest possible evidence: this is exactly the
  shape run `30768540898` already ran green (`remote-cache-hit` then `-> 200`).
- **Proves:** the delta allowance, and the substance of the mechanism `40e4d21` restored. Does NOT
  prove the `$defaultref` clause. Report separately.

### Sub-claim (b) -- the `$defaultref` clause. Needs the window, and must be STACKED.

Base MUST NOT be `main`. With base = `main`, `base_ref == default_ref` and the jq `or` chain at
`ci.yml:1367` is satisfied by the `$baseref` clause -- `ci.yml:1255-1257` names this exact
duplication as "the reason the gap stayed invisible". A stacked PR makes `$defaultref` the only
satisfiable clause: own ref `refs/pull/N/merge` is empty (fresh PR), `base_ref = refs/heads/B` is
empty (a branch push fires no CI, `ci.yml:4-6`), and the entry lives on `refs/heads/main`.

That a stacked PR CAN read the default-branch scope is [CITED: docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching,
"Restrictions for accessing a cache", quoted verbatim in `13-RESEARCH.md:653-657`]: "Workflow runs
can restore caches created in either the current branch or the default branch (usually `main`). If
a workflow run is triggered for a pull request, it can also restore caches created in the base
branch". Search order is merge ref -> base branch -> default branch.

Ordering, minimum exposure:

1. Build the window commit `W` by plumbing -- `GIT_INDEX_FILE` pointed OUTSIDE the repo,
   `read-tree <HEAD>`, `write-tree`, `commit-tree <tree> -p fe25a3f...` -- so `W`'s TREE equals the
   feature branch HEAD's tree while `3c67513` is NOT in `W`'s ancestry. That last part is
   load-bearing: pushing a commit that CONTAINS `3c67513` would let GitHub mark PR #16 merged.
2. Push `refs/heads/obs/case-b-defaultref-base-260804-h3b` = `W`, and
   `refs/heads/obs/case-b-defaultref-head-260804-h3b` = `W` + the one `.planning/` file. Neither
   push fires CI. Confirm with `gh run list --limit 5`.
3. Back up: `git push origin fe25a3f865f20f3d4f8a40e96f8cb5717608ba8a:refs/backups/main-pre-window-260804-h3b`.
   The name is NEW -- five stale `refs/backups/*` already sit on origin, all at `fe25a3f`
   (`main-pre-phase13-verify`, `main-pre-publish-verify-window`, `main-pre-window2-260803`,
   `main-pre-windowA-260803`, `main-pre-windowB-260803`). Do not reuse or clean them up.
4. Advance: `git push origin <W>:refs/heads/main`. NO `[skip ci]` -- the run is the deliverable.
5. Wait ONLY for the ubuntu `integration` leg's save, then confirm it from the caches API:
   `gh api "repos/op-nx/github-cache/actions/caches?key=nx-cache-16483311331776729079" -q '.actions_caches[] | .ref + " " + .created_at'`
   must show `refs/heads/main`. Expect roughly 1-3 minutes (34 s on `30807461616`).
6. Restore: `git push --force-with-lease=main:<W> origin fe25a3f865f20f3d4f8a40e96f8cb5717608ba8a:refs/heads/main`.
   Explicit lease form, never bare `--force-with-lease` -- `main` is never checked out locally here.
7. Verify the restore three ways (below). Window closed.
8. NOW open the PR: head `obs/case-b-defaultref-head-260804-h3b`, base
   `obs/case-b-defaultref-base-260804-h3b`. Pre-register `key=nx-cache-16483311331776729079`,
   `matched_ref=refs/heads/main`, `delta` = minutes-to-hours, and record the PR's base branch from
   run metadata (the success line prints `matched_ref` but not `base_ref`, so base != default is
   evidenced from the run/PR metadata).
9. Clean up: close the PR, delete both `obs/*` branches and the backup ref.

CRASH RECOVERY between steps 4 and 6: first action on resume is `git ls-remote origin main`; if it
is not `fe25a3f865f20f3d4f8a40e96f8cb5717608ba8a`, restore immediately regardless of in-flight run
status.

### Three-way restore verification, as commands for THIS task

```bash
# 1. remote SHA equality
git ls-remote origin refs/heads/main
#    must print fe25a3f865f20f3d4f8a40e96f8cb5717608ba8a

# 2. file-presence 404 on main -- docs/cross-os.md is ADDED between fe25a3f and HEAD,
#    so it must be ABSENT from main after the restore (and present DURING the window,
#    which is the positive control that the advance actually landed)
gh api repos/op-nx/github-cache/contents/docs/cross-os.md?ref=main
#    must be HTTP 404

# 3. empty diff against the backup ref
git fetch origin refs/heads/main refs/backups/main-pre-window-260804-h3b
git diff --stat \
  "$(git ls-remote origin refs/backups/main-pre-window-260804-h3b | cut -f1)" \
  "$(git ls-remote origin refs/heads/main | cut -f1)"
#    must print nothing
```

---

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|---|---|---|
| A1 | The August burn on `cache-mirror-202608` still holds at window time, so the restore run's `publish` legs write no Release asset | Q3 | The restore run creates a legacy-named release and mirrors `fe25a3f`-era entries into it. Mitigated by the pre-flight 404 probe and a post-window check |
| A2 | `W`'s tree equals HEAD's tree, so `H_linux` on the advance run is `16483311331776729079` | (b) shape | The pre-registered key is wrong and the witness reports a different one. Detected immediately at step 5, before the restore; re-register and continue |
| A3 | Opening the stacked PR after the restore still yields a Case-B ubuntu `integration` leg | Q5, (b) shape | If the leg MISSes it saves and the run degrades to Case A -- a wasted claim, not a red run. The delta stays above 30 s either way |

## Explicitly OPEN

- Long-horizon GC of cache entries whose creating commit became unreachable (Q5). Not
  plan-relevant; named rather than closed by inference.
- The precise GitHub-side cause of the `POST /releases` 422 beyond "name-scoped burn, no ruleset,
  measured four ways" in `260803-fcd-CONTEXT.md:118-132`. Not plan-relevant.

## Sources

### Primary (HIGH -- measured this session)
- `gh api repos/op-nx/github-cache/actions/runs/30768540898/jobs` + job `91551499862` log -- Q1
- `gh api .../runs/30807461616/jobs` + jobs `91666028899`, `91666028565` logs -- Q1, Q2
- `gh api .../runs/30825636788/jobs` + job `91726544403` log -- Q3
- `gh api .../actions/caches?per_page=100 --paginate` (317 rows) -- Q2, Q5, probe pre-registration
- `node capture-hashes.mjs --install-mode install` x3 (baseline, `.planning/` added, declared input
  dirtied) -- Q4
- `npx nx show project @op-nx/github-cache --json` -- Q4
- `git ls-remote origin refs/backups/*`, `git diff --name-status fe25a3f 3c67513` -- probe shape

### Primary (HIGH -- read in this repo)
- `.github/workflows/ci.yml:4-6, 34-36, 862-870, 942-1067, 1133-1467, 2157-2221`
- `packages/github-cache/src/server/server.ts:120-164`
- `packages/github-cache/src/backend/actions-cache-backend.ts:186-245`
- `packages/github-cache/src/lib/trust.ts:32, 79-100`; `lib/select-backend.ts:41-129`;
  `lib/sync-gate.ts:15, 63-92`; `serve.ts:90`

### Secondary (CITED)
- docs.github.com dependency-caching, "Restrictions for accessing a cache" -- quoted verbatim in
  `.planning/phases/13-read-only-actions-cache-backend/13-RESEARCH.md:653-657`
- `.planning/quick/260803-fcd-.../260803-fcd-CONTEXT.md:110-140` -- the burned-tag measurement
- `.planning/quick/260803-mew-.../260803-mew-PLAN.md:78-230` -- the main-window procedure

## Metadata

**Confidence:** Q1 HIGH (measured both legs on a real Case-B run). Q2 HIGH (code chain plus
end-to-end measurement). Q3 HIGH (byte-exact rehearsal at the same SHA; A1 is the one time-bounded
assumption). Q4 HIGH (hash measurement with a same-modality positive control). Q5 HIGH on scope
persistence, MEDIUM on the merge-ref recomputation hazard, which the stacked shape avoids rather
than needing to resolve.

**Research date:** 2026-08-04. **Valid until:** the next `main` window, or 2026-08-31 for A1.
