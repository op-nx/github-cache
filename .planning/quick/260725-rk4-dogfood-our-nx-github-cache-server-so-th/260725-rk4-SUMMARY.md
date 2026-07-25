---
phase: quick-260725-rk4
type: summary
status: complete
requirements_addressed: [260725-rk4-DOGFOOD]
files_modified:
  - .github/workflows/ci.yml
commits: [488bd4f, ab8dc9b, bbf303f, 4053e53, 9f37739, f0f31c8, 7dbcdc3, ab9ff5d]
branch: gsd/quick-260725-rk4-dogfood-ci
base: 8c14546
tasks_executed: 3
tasks_total: 3
pr: 4
live_close: closed
review_findings_resolved: [C1, W1, W2, W3, I1, I2]
---

# Quick 260725-rk4: Dogfood the Nx github-cache server in CI -- Summary

Routed this repo's own cacheable Nx tasks (`build`, `typecheck`, `test`,
`integration`) through the shipped `./start-cache-server` loopback sidecar in
`.github/workflows/ci.yml`, so CI produces real cross-run remote cache hits for real
workloads -- not just the same-run, run_id-keyed proof jobs.

Exactly one file was modified across the whole series: `.github/workflows/ci.yml`
(236 insertions, 7 deletions). No file under `packages/`, `src/`, or
`start-cache-server/` was touched, so the committed `start-cache-server/index.js`
bundle did not drift and no regeneration was needed (`check:action` green at every
commit).

## Task -> commit mapping

| Task | Commit | Subject |
|------|--------|---------|
| Task 1 -- wire the three ubuntu Nx-task jobs (build, typecheck, test) | `488bd4f` | `ci: route build/typecheck/test through the shipped cache sidecar` |
| Task 2 -- wire the cross-OS integration matrix | `ab8dc9b` | `ci: route the cross-OS integration matrix through the cache sidecar` |
| Task 3 -- resolve + document the publish-mirror interaction | `bbf303f` | `docs(ci): correct the publish-mirror comment for real task artifacts` |

Base was `8c14546`; HEAD is `bbf303f` on `gsd/quick-260725-rk4-dogfood-ci`. No branch
was created, switched, or deleted; nothing was pushed; no PR was opened or modified.

## Per-commit full-battery table

Each commit was verified INDEPENDENTLY: the battery was run before committing, and
then re-run against each commit in a detached checkout of that exact SHA (so a later
commit cannot mask an earlier one's breakage). All three commits are bisect-safe.

| Check | `488bd4f` | `ab8dc9b` | `bbf303f` |
|-------|-----------|-----------|-----------|
| `npm run format:check` | OK | OK | OK |
| `npm run build` | OK | OK | OK |
| `npm run typecheck` | OK | OK | OK |
| `npm run typecheck:action` | OK | OK | OK |
| `npm run test` | OK | OK | OK |
| `npm run fallow:ci` | OK | OK | OK |
| `npm run check:action` | OK | OK | OK |
| `npm run pack:check` | OK | OK | OK |
| `npm run integration` | OK | OK | OK |
| ci.yml parses as YAML | OK | OK | OK |

`integration` (the plan's local verify for Task 2) was run at all three commits, not
just Task 2's, since it is cheap here.

Structural verification beyond the battery (scratchpad node scripts over the parsed
YAML, not greps):

- All four wired jobs carry the full block in the required ORDER: `npm ci` ->
  pre-set -> background `./start-cache-server` -> readiness poll -> `npm run <target>`
  -> `cancel: cache-server`.
- Each passes `GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}` to the sidecar step, has
  `id: cache-server`, `background: true`, and `port: '3000'` matching the pre-set url.
- None of the four carries `if:` at all (so not push-gated). The five proof jobs
  (`dogfood-seed`, `dogfood-verify`, `consumer-smoke`, `publish`, `publish-verify`)
  are still push-gated and un-wired.
- Both shell steps in all four jobs declare `shell: bash`; the token is generated with
  node and no `openssl` appears in any new block's executable shell.
- `::add-mask::` provably precedes the token's `$GITHUB_ENV` write (index comparison).
- The poll uses `|| true`; no new block contains `|| echo 000` in executable shell.
- No `NX_*` var exists at workflow `env:` level.
- The block's executable shell is byte-identical across all four jobs (only the build
  job's copy carries extra inline trap comments, and only the final `npm run <target>`
  differs) -- so the windows-11-arm leg cannot silently drift from the ubuntu ones.

The assertion script was confirmed to DISCRIMINATE, not just pass: run against the
still-unwired `integration` job between Task 1 and Task 2 it reported 6 failures.

## Task 3: the accept-vs-scope decision

**ACCEPTED the mirror. No scope change to the `publish` job.**

Once real tasks write `nx-cache-<taskhash>` entries on a default-branch push, those
keys pass `isServerProducedKey`, so `getActionsCacheList` enumerates them and
`publish` mirrors real task artifacts to the current-month Releases shard. That is the
intended dogfooding outcome -- the Releases mirror holding real task outputs is the
point of a remote cache -- so the deliverable was the comment correction the plan
expected, not a narrowing of `publish`.

The stale claim at the old ci.yml:374-380 ("this repo runs Nx on the LOCAL cache, so
the only `nx-cache-*` Actions-cache entries that ever exist are the ones we seed") is
gone, replaced by a comment that records the acceptance, both consequences, and the
alternative:

- **(a) Shard growth.** About 5 real assets per input-changing push -- 4 from the
  ubuntu leg (`build`, `typecheck`, `test`, `integration-linux`) plus 1 from the
  windows leg (`integration-win32`, which only the Windows leg can restore) -- on top
  of the ~3 run_id-keyed assets a push already added. That is roughly 125
  default-branch pushes inside ONE calendar month before that month's shard reaches
  `RELEASE_ASSET_CAP`. Verified in code that the cap degrades to skip-and-warn
  (`publish-mirror.ts:216-219`, D-11), never a hard failure, and retention prunes
  shards past the window. Not a concern at this repo's push rate.
- **(b) Wall clock.** Uploads are throttled to ~1/sec (`resilient-octokit.ts:33`), so
  `publish` gains a few seconds per push.
- **Alternative named for later:** scope `publish` to the run_id seed only. Not done
  now -- it would discard the real cross-context mirror this change exists to prove.

The 1000-asset cap is not imminent, so the plan's condition for actually scoping
`publish` down was not met.

## Key-namespace disjointness: CONFIRMED, but the plan's stated reason was wrong

**Verdict: the namespaces are disjoint.** The conclusion in PLAN Task 3 / RESEARCH
Pitfall 4 holds. Its stated REASON does not, and the corrected reasoning is now in the
ci.yml comment.

The plan asserted real keys are `nx-cache-<nx-task-hash>` with a "long mixed-hex"
hash, disjoint from the "all-decimal" `nx-cache-<run_id>` by contrasting character
class. Checked empirically against the 153 real task-hash entries in this workspace's
local `.nx/cache`:

- Every hash is **pure decimal, 18-20 digits** (6 x 18, 74 x 19, 73 x 20). **Zero**
  entries contain an `a-f` character. Nx renders its 64-bit task hash as a decimal
  string, so real task hashes are the SAME character class as a run id -- not a
  contrasting hex alphabet.

So disjointness rests on numeric range plus construction, not on alphabet:

- `nx-cache-cafe<run_id>` (consumer-smoke) is disjoint **by construction** -- the
  `cafe` literal makes it not all-decimal, so no all-decimal task hash can equal it.
- `nx-cache-<run_id>` is disjoint **by range**: a run id is ~11 digits (the research's
  own live example, run 29884131798) against task hashes of 18-20. A collision would
  need a 64-bit task hash whose decimal form exactly equals THIS run's id -- about 1
  in 1.8e19 per task, with a handful of tasks per run. Negligible.

The same finding closes a question the plan did not raise but which the whole change
depends on: a decimal hash still satisfies `HASH_PATTERN` (`^[a-f0-9]{1,512}$`,
`cache-key.ts:21`), because `0-9` is inside that character class. So the server's
SRV-03 route guard accepts real Nx hashes (they would otherwise 400 on every request
and the dogfood would produce nothing but errors), and `isServerProducedKey` accepts
their keys, which is exactly why the publish mirror picks them up.

## Deviations

1. **Corrected the key-namespace rationale rather than recording the plan's version.**
   The plan asked me to "confirm" the hex-vs-decimal argument; it is factually wrong on
   this workspace, so I recorded the measured facts and the corrected argument instead
   of parroting it. The verdict (disjoint) is unchanged, so no plan decision was
   affected.
2. **Comment placement.** The plan implied the rationale in each of the four jobs. I
   documented it ONCE above the `build` job with short pointers in the other three,
   rather than repeating ~30 lines of prose four times. The executable shell is
   byte-identical across all four (asserted), which is what matters for drift.
3. **Fixed my own slip before committing.** My first draft of the build job's poll line
   contained a stray `${NX_SELF_HOSTED_REMOTE_CACHE_ACCESS_TOKEN:+}` prefix inside the
   curl URL. Removed before any commit; the byte-identical assertion would have caught
   it regardless.

Nothing in the plan was left out.

## Observation: value vs latency (the plan's <observation> block)

Local cold task times on this workspace, measured with `--skip-nx-cache`:

| Target | Cold execution |
|--------|----------------|
| `build` | 4.0s |
| `typecheck` | 4.4s |
| `test` | 4.4s |
| `integration` | 3.4s |

Warm (local Nx cache hit) each target is 1-2s, and the full 8-check battery runs in
~15s.

These are local numbers and are NOT a proxy for CI wall clock, but they do confirm the
plan's prediction directionally: the per-job sidecar overhead (start ~0.5-1s + poll
~1-2s, plus a loopback GET/PUT per task and an `@actions/cache` save/restore
round-trip to GitHub's cache service) is **comparable to or larger than** the task it
is caching on this 1-project workspace. Expect net-neutral-to-slightly-slower CI wall
clock. This was accepted up front: the point is proving the shipped consumer surface
works on real tasks, not speed. The real CI timing comparison is part of the live-close
below.

## Outstanding non-blocking human action: the first-push live-close

This cannot be closed locally and remains open.

1. Push a real **default-branch** run so the four wired jobs WRITE real
   `nx-cache-<taskhash>` entries.
2. Push a second time with **unchanged** build/test inputs and read the Nx end-of-run
   summary for at least one task read from the remote cache -- e.g. `Nx read the output
   from the cache instead of running the command for X out of Y tasks`. A fresh runner
   has no local `.nx/cache` (`setup-node`'s `cache: npm` restores only `~/.npm`), so
   **any** read-from-cache on run N+1 is necessarily a REMOTE hit.
3. If the summary wording is ambiguous (RESEARCH Assumption A2 -- the exact log string
   is the one ASSUMED part), add `--verbose` to the `nx run-many` to log explicit
   remote retrieval.
4. Confirm all jobs stay green on **both** `push` and `pull_request`, and that the
   `publish` job's summary now lists real task artifacts alongside the run_id seed.

**HELD for the lead (deliberately):** the branch push and the PR. Both are
outward-facing, so this executor did not push and did not open or modify a PR, per the
task instructions. The live-close depends on that push.

---

# Orchestrator addendum (post-executor)

Everything above is the executor's record of Tasks 1-3 and stands as written. This
section covers what happened after: the maintainer approved the push, PR #4 was
opened, a code review found six issues that were fixed, and the live-close CLOSED.

## Push, PR, and the live-close -- CLOSED

Pre-push hygiene (public repo): author AND committer on every commit are the approved
public gmail; an allowlist-inversion scan of the added lines found no email-shaped
token at all; no AI-attribution trailer in any commit message or in the PR body.

PR #4 -- https://github.com/op-nx/github-cache/pull/4

**Truth 6 (a real cross-run remote cache read) is CLOSED.** Run 30171443826
(`pull_request`, headSha f0f31c8, success), build job:

```
nx run @op-nx/github-cache:build  [remote cache]
Nx read the output from the cache instead of running the command for 1 out of 1 tasks.
Cache:             1/1 hit (100%)
```

Nx labels the source `[remote cache]` literally, which resolves RESEARCH Assumption
A2 (the ASSUMED hit-log wording) outright rather than merely satisfying it -- no
`--verbose` fallback was needed.

Corroborated independently through the Actions cache API: entry
`nx-cache-14522047022641658505` kept its original `created_at`
(2026-07-25T18:54:09.456Z, written by the FIRST run at bbf303f) and its size (75688)
while `last_accessed_at` advanced to 19:22:05.228Z, inside build's window in run
30171443826. Same entry, different run, fresh runner -- READ, not rewritten.

Per-job cache outcome in that run, and why it is correct rather than a defect:

| Job | Outcome | Why |
|-----|---------|-----|
| `build` | `[remote cache]` 1/1 hit | inputs explicitly exclude `vitest.config.mts`, so its hash was unchanged |
| `typecheck` | `[remote cache]` 1/2 hit | its `^build` dependency hit; typecheck itself missed |
| `test` | 0/1 hit | `vitest.config.mts` is inside the `default` named input -> hash genuinely changed |
| `integration` (both legs) | 0/1 hit | same as `test` |

A NOTE ON EVIDENCE, recorded because it was nearly a false positive: `Cache: 0/1 hit
(0%)` is NOT evidence of a remote consult. The pre-change main run 30169158892, which
had no sidecar at all, printed the identical line -- Nx prints that summary for the
local cache too, and a fresh runner always misses locally. Only a NON-ZERO hit, or
the `[remote cache]` label, carries information.

## Code review: six findings, all resolved

`260725-rk4-REVIEW.md` (1 critical, 3 warning, 2 info). Fixes:

| # | Fix | Commit |
|---|-----|--------|
| C1 | teardown "fix" -- later REVERTED as a false positive, see round 2 | 4053e53 + f0f31c8, reverted by 7dbcdc3 |
| W1 | readiness poll demands exactly 404, plus `--max-time 10` | 4053e53 |
| W2 | resolved by DECISION -- evidence, not a committed check | (none) |
| W3 | vitest env neutralized so token-minting stays tested | 9f37739 |
| I1 | inaccurate "byte-identical" comment corrected | 4053e53 |
| I2 | cache-payloads-are-not-masked property documented | 4053e53 |

**C1 took two attempts, and the first was wrong.** `if: always()` on a `cancel:` step
is INVALID -- the runner rejects the entire workflow at parse time with "Unexpected
value 'if'". Run 30171349564 failed before scheduling any job (empty job list, no
logs); it is recorded as event `push` only because GitHub logs a parse-time rejection
against the raw webhook without evaluating the branch filter, so it is not evidence
about `on.push`. The working fix is `id: target` + `continue-on-error: true` on the
target step, `cancel:` after it, then a gate step re-failing on
`steps.target.outcome == 'failure'`.

`outcome` is load-bearing there and `conclusion` would have been a silent no-op:
`continue-on-error` rewrites `conclusion` to `success`, so a gate on `conclusion`
would never fire.

**W1 caveat worth knowing:** demanding 404 makes the gate prove auth as well as
reachability, closing the silent all-MISS path -- but it also means any legitimate
backend that answers an unknown-hash authed GET with something other than 404 would
now hard-fail a job that previously passed.

**W3 was proven load-bearing, not assumed.** With a deliberately NON-hex sentinel in
the ambient env the suite fails without the config and passes with it:

```
AssertionError: expected 'SENTINEL-not-hex-at-all' to match /^[a-f0-9]{64}$/
```

Reproduce with `--skip-nx-cache`: the ambient env is not part of the `test` task
hash, so Nx will otherwise replay a cached pass regardless of which code path ran.
Only `vitest.config.mts` needs it -- `public-server.integration.spec.ts` has no
`serve()` call (an earlier grep matched a comment, not a call).

## Round 2: the C1 fix was WRONG and has been reverted

A re-review of the fixes raised four new findings (0 critical). Auditing them
forced the one question that had been carried unverified since C1: nobody had ever
observed the failure path. It was measured, and C1's premise is FALSE.

**The measurement.** Two temporary probe jobs, run 30172032003. `probe-hang` used the
PRE-FIX shape -- a deliberately failing step with NO `continue-on-error`, followed by
a bare `- cancel: cache-server`, `timeout-minutes: 5` so a real hang would cost five
minutes rather than 360:

```
5. Run ./start-cache-server            -> completed/cancelled
7. Deliberately failing target (probe) -> completed/failure
8. Cancel                              -> completed/success
17. Complete job                       -> completed/success
```

Job conclusion `failure`, 19:39:16Z -> 19:39:24Z: **eight seconds**. The cancel step
RAN. It is not subject to skip-on-failure. `probe-gate` (the fixed shape) also failed
fast at 10s, so the gate worked but bought nothing.

The probe commit was force-pushed out of the branch so the delivered history stays
bisect-safe; the run record persists and is the evidence.

**Root cause of the error:** `README.md:84` warns the job hangs WITHOUT a `cancel:`
step. That is about OMITTING it, not about it being skipped after a failure. The two
were conflated, and a fix was built on the conflation.

### Round-2 triage

| # | Verdict | Resolution |
|---|---------|------------|
| C1 (round 1) | FALSE POSITIVE, retroactively | mechanism reverted in 7dbcdc3 |
| N1 fail-open gate | UPHELD as analysis | resolved by DELETING the gate, not hardening it |
| N2 misattribution | resolved by the same deletion | target fails under its own name again |
| N3a bound overstated | UPHELD | ab9ff5d |
| N3b 200 is legitimate | UPHELD (low) | ab9ff5d -- poll accepts 404 OR 200 |
| N4 docs teach pre-fix shape | REJECTED | the shape works; the docs need no change |

N1 was right on its own terms and is what prompted the measurement: making a single
`if: steps.target.outcome == 'failure'` expression the only thing failing the job
meant that a renamed id, a typo, a copy without its gate, or the gate deleted as
dead code would turn a failing `npm run test` GREEN. A worse end state than the hang
-- and the hang was not real either, so the gate was pure downside.

**N4 rejected matters most.** Acting on it would have shipped this unnecessary
complexity to every adopter who copies the quickstart.

**A bug introduced and caught inside the N3 fix:** making the poll accept 200 left
build's guard still rejecting anything but 404, so a 200 would have broken the loop
and then failed the job. Fixed in all four copies. The four blocks' executable shell
is now checked for parity mechanically rather than by eye, which is the I1 invariant.

### What the upstream docs actually say

Read after the fact, which was the wrong order. `background:` / `wait:` / `wait-all:`
/ `cancel:` ship documented ONLY in the 2026-06-25 changelog "Actions steps can now
be run in parallel"
(https://github.blog/changelog/2026-06-25-actions-steps-can-now-be-run-in-parallel).
The workflow-syntax reference that changelog itself links to does not mention any of
the four keywords. So neither the skip-on-failure question nor the `if:` question
could be answered from docs -- but that should have been established by reading
first, not asserted and then measured.

Separately confirmed by measurement: `if:` is REJECTED on a `cancel:` step. The
runner refuses to parse the workflow ("Unexpected value 'if'", run 30171349564, no
jobs scheduled).

### Still unmeasured, and consumer-facing

`README.md:84` and `start-cache-server/action.yml:7` assert that OMITTING `cancel:`
hangs the job at an implicit wait-all before post-job cleanup. Untested -- every job
here has always carried a `cancel:`. It underpins the shipped "cancel: is MANDATORY"
instruction, and the changelog documents `wait`/`wait-all` as EXPLICIT keywords,
which makes an implicit end-of-job wait-all less obviously true. Harmless as advice
either way; stated as fact in three places.

`consumer-smoke` keeps its bare `cancel:`, which is correct -- its scripted
round-trip steps can genuinely fail and the bare cancel handles that.

## Full-sweep live evidence at ab9ff5d

Run 30172484621 (`pull_request`, ab9ff5d, success). ALL FIVE wired legs read from the
remote cache:

| Job | Result |
|-----|--------|
| `build` | `[remote cache]` 1/1 hit (100%) |
| `typecheck` | `[remote cache]` x2, 2/2 hit (100%) |
| `test` | `[remote cache]` 1/1 hit (100%) |
| `integration` (ubuntu-24.04-arm) | `[remote cache]` 1/1 hit (100%) |
| `integration` (windows-11-arm) | `[remote cache]` 1/1 hit (100%) |

Strictly stronger than the first close, where test/integration missed because
9f37739 had touched a `default`-input file.

**CORR-01 is NOT demonstrated by this, despite appearances.** The two integration
legs hit DIFFERENT keys (`nx-cache-13758457399293023985` on Windows,
`nx-cache-6174109223991820850` on ubuntu) because Nx's task hash already includes the
`runtime: node -p process.platform` discriminator -- each leg asks for a genuinely
different key by construction. A backend serving two different keys to two different
requesters says nothing about OS namespacing; a single-OS workspace with two distinct
keys would look identical. CORR-01's actual claim -- that the SAME key cannot
cross-restore between OSes, via `@actions/cache`'s own version hash -- would need a
probe that deliberately defeats the discriminator. It remains a reasoned-about
property, not something these runs prove.

## Still open -- requires landing on main

- **The push half of "CI green on both events" is structurally unclosable on a
  branch.** `on.push` is restricted to `branches: [main]`, so a feature branch cannot
  receive a push-triggered run at all. Not "hasn't yet" -- cannot.
- **Task 3's actual subject is entirely unverified live.** All five push-gated jobs
  (`dogfood-seed`, `dogfood-verify`, `consumer-smoke`, `publish`, `publish-verify`)
  are `skipped` on both PR runs, so the publish-mirror interaction that Task 3
  documents and accepts has never executed with real task artifacts present. This is
  the larger of the two open items.

Both close on merge. Neither is a defect in the change.
