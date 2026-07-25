---
phase: quick-260725-rk4
type: verification
status: human_needed
verified_commit: ab9ff5d
branch: gsd/quick-260725-rk4-dogfood-ci
---

# Quick 260725-rk4: Dogfood the Nx github-cache server in CI -- Verification

## Verdict: human_needed (updated a second time -- premise changed again)

**Revision note (round 2):** the "C1 fix" this report previously certified as "real,
not cosmetic" has been **reverted**, because its own premise was measured live and
found false -- a `cancel:` step is not subject to skip-on-failure at all, so nothing
was ever going to hang on that path. Two new commits landed:

- `7dbcdc3` -- reverts the `continue-on-error`/`id: target`/fail-gate mechanism in all
  four wired jobs back to a plain `- run: npm run <target>` + `- cancel: cache-server`.
  Keeps `timeout-minutes` as generic hang insurance (not a teardown workaround).
- `ab9ff5d` -- readiness poll now accepts `404` OR `200` as ready, corrects an
  overstated "30s bound" comment to the real ~5.5-minute worst case, and fixes a
  guard/break mismatch the 200-acceptance change introduced and the executor caught
  before committing.

Everything below is re-derived independently against live GitHub state at the new
head, `ab9ff5d` -- not taken from the team lead's report. My own prior "residual gap"
claim about a readiness-poll failure skipping `cancel:` is **retracted** below with the
evidence that disproves it.

## Per-truth results

Independently re-derived via a YAML parse of `.github/workflows/ci.yml` (node `yaml`
package) plus direct source reads -- not by trusting the SUMMARY's own script output.

| # | Truth | Result | Evidence |
|---|-------|--------|----------|
| 1 | build/typecheck/test/integration each launch `./start-cache-server` as `background: true` (`id: cache-server`) with a matching `cancel: cache-server`, after a regular pre-set step writing both NX_* vars to `$GITHUB_ENV` | **PASS** | Parsed step order for all four jobs, identical: `checkout -> setup-node -> npm ci -> Pre-set (shell:bash, writes both vars) -> uses:./start-cache-server id=cache-server background=true -> Wait for the loopback sidecar -> npm run <target> -> cancel:cache-server`. |
| 2 | Each wired job passes `GITHUB_TOKEN: secrets.GITHUB_TOKEN` to the sidecar step | **PASS** | Parsed sidecar step's `env` for all four: `{"GITHUB_TOKEN":"${{ secrets.GITHUB_TOKEN }}"}`. |
| 3 | None of the four wired jobs carry `if: github.event_name == 'push'` | **PASS** | Parsed job objects for all four: `has if: false` (no `if:` key at all -- stronger than just excluding that one condition). |
| 4 | Integration job's bash steps declare `shell: bash` and generate the token with node (not openssl), for the windows-11-arm leg | **PASS** | integration's pre-set and poll steps both `shell: bash`; token line is `node -e 'process.stdout.write(require("crypto").randomBytes(32)...)'`; no `openssl` invocation anywhere in the job's executable shell. Matrix confirmed `os: [ubuntu-24.04-arm, windows-11-arm]`. |
| 5 | The readiness poll swallows curl's exit with `\|\| true` (never `\|\| echo 000`) | **PASS** | All four poll steps use `\|\| true`. Note: a naive substring search flagged the build job's poll as containing `\|\| echo 000` -- on inspection this is inside a `#` comment explaining why NOT to do that (the same trap note SUMMARY calls out as build's "extra inline trap comments"), not executable shell. No job's executable `curl ... \|\|` line uses `echo 000`. |
| 6 | On a subsequent push with unchanged inputs, the Nx end-of-run summary shows >=1 task read from the remote cache | **PASS** (strengthened again) | See "Truth 6" section below -- now confirmed on ALL FIVE wired legs at 100% hit in the latest run (`30172484621`, `ab9ff5d`), not just `build`. |
| 7 | CI stays green across all jobs on both push and pull_request after the change | **split: pull_request PASS, push OPEN (unclosable pre-merge)** | See "Truth 7" section below. |

Local proxy checks (closeable now, and confirmed independently, not just per the
SUMMARY's table): `npm run build` re-run at HEAD succeeds (Nx local-cache hit, unrelated
to the CI sidecar -- confirms the change is inert/non-breaking locally). `git diff
8c14546..ab9ff5d --stat` shows only `.github/workflows/ci.yml` and
`packages/github-cache/vitest.config.mts` changed across the full six-commit series.

## Truth 6: remote-cache read on a subsequent run -- PASS, independently confirmed

Verified against live GitHub state, not the team lead's report:

- `gh pr view 4` -> `state: OPEN`, `op-nx/github-cache#4`.
- `gh run list --branch gsd/quick-260725-rk4-dogfood-ci` -> exactly the three runs
  claimed: `30170530687` (pull_request, `bbf303f`, success), `30171349564` (push,
  `9f37739`, failure -- see Truth 7), `30171443826` (pull_request, `f0f31c8`, success).
- Pulled the raw job log for run `30171443826` directly (`gh run view ... --log`), not
  a summary. The `build` job's log contains, verbatim:
  ```
  🔁 > nx run @op-nx/github-cache:build  [remote cache]
  Nx read the output from the cache instead of running the command for 1 out of 1 tasks.
    Cache:             1/1 hit (100%)
  ```
  Nx's own `[remote cache]` label names the source explicitly -- this resolves RESEARCH
  Assumption A2 outright (the exact wording is no longer assumed, it's observed), not
  merely satisfies the truth's weaker phrasing.
- Cross-checked against the Actions-cache API directly
  (`gh api repos/op-nx/github-cache/actions/caches`): entry
  `nx-cache-14522047022641658505` has `created_at: 2026-07-25T18:54:09.456Z` (unchanged
  from the first run) and `size_in_bytes: 75688` (unchanged), but
  `last_accessed_at: 2026-07-25T19:22:05.228Z` -- inside run `30171443826`'s `build` job
  window (`19:21:36`-`19:22:08`). Same entry, different run, size untouched: read, not
  rewritten. This is independent of and stronger than the log-text evidence alone.
- Cross-checked the caveat the team lead raised: `typecheck` showed `1/2 hit (50%)`
  (only its `^build` dependency hit; `typecheck` itself missed), `test` and both
  `integration` legs showed `0/1 hit (0%)`. Confirmed this is legitimate, not a defect:
  `9f37739` changed `packages/github-cache/vitest.config.mts`, which lives inside Nx's
  `default` named input -- `test`, `integration`, and `typecheck`'s own task all consume
  `default` (via `nx.json`'s inputs), so their hashes genuinely changed between
  `bbf303f` and `f0f31c8`, while `build`'s inputs explicitly exclude
  `vitest.config.mts`, which is why `build` alone could still hit. This is Nx hashing
  working correctly, not a wiring gap.
- **Caveat on the truth's literal wording:** the plan's truth says "subsequent push."
  The observed write (`30170530687`) and read (`30171443826`) are both `pull_request`
  events, not `push` -- because `on.push.branches: [main]` makes a push-triggered run
  impossible on a feature branch (see Truth 7). This is not a loophole: CONTEXT.md's
  RESEARCH correction establishes that a github.com `pull_request` is host-gated-trusted
  and gets the same writable Actions-cache backend a push would, so the observed
  write-then-read is mechanically identical to what a push would exercise -- it just
  happened via the only event type this branch can produce pre-merge. A push-triggered
  run after merge would exercise the identical code path; it is not expected to differ.

### Update: run `30172484621` (`ab9ff5d`, success) -- all five wired legs now hit

Re-pulled the raw log directly, not a summary. Every wired leg reports `[remote cache]`
at 100%:

```
test                          Cache: 1/1 hit (100%)   [remote cache]
typecheck                     Cache: 2/2 hit (100%)   [remote cache] (build ^dep + typecheck itself)
integration (windows-11-arm)  Cache: 1/1 hit (100%)   [remote cache]
integration (ubuntu-24.04-arm)Cache: 1/1 hit (100%)   [remote cache]
build                         Cache: 1/1 hit (100%)   [remote cache]
```

This is strictly stronger than the previous run (where `typecheck`/`test`/`integration`
missed because `9f37739` had just changed a `default`-input file): with inputs now
unchanged since `ab9ff5d`, every one of the four wired jobs, both `integration` matrix
legs included, reads from remote cache. Truth 6 is closed beyond what the plan asked
for.

**Assessed, as asked: does the Windows leg hitting a different entry than the ubuntu
leg also demonstrate CORR-01 (OS-namespacing of the Actions-cache backend itself)?**
Pulled the actual keys each leg hit from the raw log:

```
integration (windows-11-arm)   Cache hit for: nx-cache-13758457399293023985
integration (ubuntu-24.04-arm) Cache hit for: nx-cache-6174109223991820850
```

**No -- this demonstrates a different, adjacent property, not CORR-01.** These are two
DIFFERENT `nx-cache-<hash>` keys, not the same key served from two OS-scoped physical
entries. The reason they differ is that Nx's own task hash already includes the
`{ runtime: "node -p process.platform" }` discriminator (`nx.json`'s `integration`
inputs, documented in the `integration` job's own long-standing comment) -- so each OS
leg asks the Actions-cache backend for a genuinely different key. That the backend
correctly serves two different keys to two different requesters proves nothing special
about OS-namespacing; a single-OS workspace with two distinct keys would look identical.

CORR-01 specifically claims something else: that `@actions/cache`'s OWN version-hash
(folding in the per-OS tmpdir path, a Windows-only salt, and the compression method)
would keep even the SAME key `nx-cache-<hash>` from cross-restoring between OS's. That
would only be live-demonstrated by a probe where both OS legs request the identical key
and one leg's write is shown unreachable from the other -- which requires deliberately
defeating or bypassing the `runtime` discriminator input, and has not been done. So
CORR-01 itself remains a documented, reasoned-about property of `@actions/cache`'s own
behavior (cited from its own versioning mechanism), not something this run newly proves
live. Worth being precise about the distinction rather than crediting this evidence for
more than it shows.

## Truth 7: green on push and pull_request -- split verdict

- **`pull_request`: PASS.** `30170530687` (`bbf303f`) and `30171443826` (`f0f31c8`) are
  both `event: pull_request`, `conclusion: success`, covering all jobs including both
  `integration` matrix legs (confirmed via `gh run view 30171443826 --json jobs`: every
  non-skipped job -- `build`, `typecheck`, `test`, `integration` x2,
  `format-check`, `fallow`, `action-bundle-drift`, `pack-check`, `ppe` -- shows
  `conclusion: success`; the push-only jobs `dogfood-seed`/`dogfood-verify`/
  `consumer-smoke`/`publish`/`publish-verify` correctly show `conclusion: skipped` on a
  PR event).
- **`push`: still open, and unclosable from this branch by construction.** Confirmed
  `ci.yml:3-6`: `on.push.branches: [main]`. This feature branch can never receive a
  push-triggered run -- not "hasn't yet," but structurally cannot, until the branch is
  merged. The one `event: push` run in the list, `30171349564` (headSha `9f37739`,
  `conclusion: failure`), is **not** a counter-example and is **not** evidence either
  way: `gh run view 30171349564 --json jobs` returns an empty job list, and
  `--log-failed` returns "log not found" -- meaning GitHub recorded a failed run against
  the raw push webhook (the workflow file was syntactically invalid at that commit --
  `cancel:` does not accept `if:`, exactly what `f0f31c8`'s commit message documents and
  fixes) without ever evaluating the `branches: [main]` filter or scheduling a single
  job. It predates the fix and asserts nothing about whether the fixed workflow runs
  clean on push.
- **Do not paper over this:** the push half of Truth 7 requires an actual push-triggered
  run, which requires merging this PR (or otherwise landing these commits on `main`).
  That is a human/maintainer action, not something verifiable from a branch or a local
  checkout. Recommend: after merge, confirm one `push`-event run on `main` completes
  green across all jobs (including the previously-untested `dogfood-seed`,
  `dogfood-verify`, `consumer-smoke`, `publish`, `publish-verify`, which are push-gated
  and have not run at all in this PR's CI history since they show `skipped` on both
  observed runs).

## Artifact and key_links

- **Artifact** (".github/workflows/ci.yml -- wired + publish comment updated"): PASS.
  Confirmed the stale claim ("this repo runs Nx on the LOCAL cache, so the only
  `nx-cache-*` ... entries that ever exist are the ones we seed") no longer appears
  anywhere in the file (`rg` for "only...ones we seed" / "LOCAL cache": zero matches).
  The publish job's comment (ci.yml:578-609) now documents `isServerProducedKey` /
  `getActionsCacheList` picking up real task entries, the shard-growth math, and the
  scope-to-seed alternative.
- **key_links**: all four confirmed by direct source read, not assumed:
  - Pre-set `$GITHUB_ENV` writes -> sidecar step: PASS (port `3000` in both the URL
    and the `with: port:` input, for all four jobs).
  - `GITHUB_TOKEN` by process inheritance -> `selectBackend` -> writable backend:
    the code path exists as described. `serve()` (`packages/github-cache/src/serve.ts:90`)
    calls `selectBackend(process.env)` (`packages/github-cache/src/lib/select-backend.ts:29`);
    `memory-backend.ts`'s own doc comment names it "selectBackend's trusted-but-tokenless
    DEGRADE path." This logic is pre-existing/shipped, not introduced by this task --
    confirmed present, not re-audited end-to-end.
  - Real `nx-cache-<taskhash>` vs run_id-keyed proof-job keys stay disjoint: PASS,
    see below (independently re-derived, not just re-stated from the SUMMARY).
  - Real task writes -> publish mirrors to the Releases shard: PASS, documented in
    the updated comment and consistent with `isServerProducedKey`/`getActionsCacheList`
    already being unconditional over all default-branch `nx-cache-*` entries.

## Independent assessment of the two SUMMARY claims beyond the plan

### 1. Real Nx task hashes are all-decimal 18-20 digits

**Confirmed independently**, not re-derived from the SUMMARY's numbers alone --
re-ran the measurement fresh against this workspace's gitignored `.nx/cache` (used
`ls` + `rg`, not `git grep`, per the tooling rule):

```
ls .nx/cache | rg '^[0-9]+$' | wc -l                          -> 153
ls .nx/cache | rg '^[0-9]+$' | awk '{print length}' | sort | uniq -c
                                                                -> 6 x 18, 74 x 19, 73 x 20
ls .nx/cache | rg '^[a-f0-9]*[a-f]+[a-f0-9]*$' | wc -l         -> 0
```

Exact match to the SUMMARY's reported 153/6/74/73/0. The conclusion holds: real task
hashes are the same all-decimal character class as a `run_id`, so key disjointness
rests on numeric range (~11-digit run ids vs 18-20-digit task hashes) and construction
(`cafe<run_id>` is not all-decimal), not on a hex-vs-decimal alphabet contrast. The
plan's original hex-vs-decimal rationale (RESEARCH Pitfall 4 / PLAN Task 3) is indeed
wrong on this workspace and the SUMMARY's correction is accurate. This also
independently confirms the disjointness verdict in key_link 3 above.

### 2. Shard-growth arithmetic and RELEASE_ASSET_CAP degrade behavior

**RELEASE_ASSET_CAP degrade-to-skip-and-warn: confirmed in code**, not just cited.
`packages/github-cache/src/publish/publish-mirror.ts:28` defines
`export const RELEASE_ASSET_CAP = 1000;`. The check at line 217
(`if (shard.names.size >= RELEASE_ASSET_CAP && !shard.names.has(name))`) calls
`core.warning(...)` and `continue`s (line 218-223) -- never `setFailed` or a thrown
error for the cap case specifically. Confirmed: never a hard failure.

`resilient-octokit.ts:33`'s `minTime: 1000` throttle claim: confirmed, the file's own
`ponytail:` comment at that line states "paces uploads at one per second."

**Asset-count arithmetic: internally consistent, re-derived independently (not just
re-stated)**:
- 4 ubuntu-leg real entries per push: `build`, `typecheck`, `test` each run once on
  `ubuntu-24.04-arm` only (no matrix); `integration` matrix contributes one
  ubuntu-scoped entry. Total 4, matches the claim.
- 1 windows-leg real entry: `integration`'s `windows-11-arm` matrix leg, which the
  file's own OS-namespacing rationale (CORR-01) says only a Windows-OS `restoreCache`
  can retrieve. Matches the claim.
- ~3 pre-existing run_id-keyed assets per push: `dogfood-seed` writes
  `nx-cache-<run_id>` (ubuntu-scoped); `consumer-smoke` writes `nx-cache-cafe<run_id>`
  (ubuntu-scoped, distinct by the `cafe` prefix); `publish`'s own per-OS `seed` step
  additionally writes `nx-cache-<run_id>` on its `windows-11-arm` leg, which is a
  DIFFERENT physical Actions-cache entry than the ubuntu-scoped
  `nx-cache-<run_id>` because `@actions/cache`'s version hash folds in the OS-specific
  tmpdir path (the file's own CORR-01 comment). That yields exactly 3 distinct
  run_id-keyed entries (ubuntu `nx-cache-<run_id>`, windows `nx-cache-<run_id>`,
  ubuntu `nx-cache-cafe<run_id>`), reconciling the "~3" figure via a path the SUMMARY
  itself did not spell out. `publish`'s ubuntu-leg `seed` step writes to the SAME key
  as `dogfood-seed` (both ubuntu-scoped, same run_id) so it adds no new entry
  (first-write-wins, D-05) -- consistent with the count staying at 3, not 4.
- Total ~8 new assets per input-changing push; `1000 / 8 = 125`, matching "roughly 125
  default-branch pushes" before a month-shard nears the cap.

This is a **static, code-cross-referenced confirmation**, not a live measurement --
actual per-push asset counts depend on runtime behavior (e.g., whether every push
actually changes every task's inputs) that only a real CI history could confirm. The
math is sound and self-consistent given the code's documented mechanics; it is not
independently falsifiable without live `publish` job runs.

## C1 fix reverted -- my "residual gap" claim retracted, with the evidence

The `continue-on-error`/`id: target`/fail-gate mechanism I previously certified as
"real, not cosmetic" (against `f0f31c8`) has been removed entirely at `ab9ff5d`. I was
right that it changed real control flow and right that a poll failure (as opposed to a
target failure) would be left to the `timeout-minutes` backstop -- but I did not
question the fix's own premise (that a `cancel:` step is skipped when a preceding step
fails), and neither, explicitly, had the code reviewer. Both of us reasoned from
Actions' ordinary-step semantics and README.md's ambiguous wording rather than from a
measurement. That premise turned out to be false, settled by a direct probe.

### Independently re-verified: the probe evidence settles it

Pulled run `30172032003`'s `probe-hang` job step-by-step via
`gh run view 30172032003 --json jobs -q '.jobs[] | select(.name=="probe-hang")'`
(not the commit message's prose):

| # | Step | Conclusion |
|---|------|------------|
| 5 | Run `./start-cache-server` (background) | `cancelled` |
| 6 | Wait for the loopback sidecar | `success` |
| 7 | Deliberately failing target (probe) -- plain `run:`, **no** `continue-on-error` | `failure` |
| 8 | Cancel | `success` |

Step 7 failed outright (ordinary step, no masking). Step 8, `Cancel`, still **ran** and
returned `success`, and step 5 (the background sidecar) shows `cancelled` -- meaning the
teardown genuinely fired and tore the server down, in an 8-second job (job `conclusion:
failure`, correctly red). This directly contradicts the "a `cancel:` step is an
ordinarily-sequenced step, and ordinarily-sequenced steps are skipped after an earlier
failure" premise that both the original review and my own re-verification took as given.

### Retracting my "residual gap" claim

My prior report's point 3 said a *readiness-poll* failure (rather than a target
failure) would still skip `cancel:` and reproduce the hang, since the poll step has no
`continue-on-error`. **That claim is now disproven by the evidence above, not merely
superseded.** The probe shows `cancel:` running and succeeding immediately after an
ordinary, unmasked step failure -- with no `continue-on-error` anywhere in the job.
There is nothing target-step-specific about that behavior: `cancel:` (like
`background:`, `wait:`, `parallel:`) is documented only in a GitHub changelog post, not
in the workflow-syntax reference, and behaves as a step type exempt from the normal
"skip subsequent steps after a failure" rule -- categorically, not conditionally on what
preceded it or whether that step used `continue-on-error`.

**Confidence and scope of this retraction:** the probe specifically failed a `run:`
target step, not the readiness-poll step by name. I did not run a second probe failing
the poll step itself, and none exists in this branch's CI history (probe jobs were
force-pushed out; only the run record persists). I am settling this from the general
mechanism the probe reveals (a `cancel:` step is unconditionally exempt from
skip-on-failure, not exempt-because-the-prior-step-had-continue-on-error) rather than
from a literal poll-step probe. That generalization is well-supported -- the executor's
own commit message and updated `ci.yml` comment reach the same conclusion and go
further (declaring `timeout-minutes` "generic hang insurance," not a teardown
workaround) -- but if the team lead wants zero remaining inference here, a poll-specific
probe would close it completely. I do not think it is warranted: the mechanism observed
is not step-name-specific.

### Confirmed the revert is complete

Re-parsed the current `ci.yml` (not the diff) for all four wired jobs:

```
build/typecheck/test/integration steps, in order:
  checkout -> setup-node -> npm ci -> Pre-set (shell:bash) ->
  uses:./start-cache-server id=cache-server background=true ->
  Wait for the loopback sidecar -> run: npm run <target> -> cancel:cache-server
```

No step in any of the four jobs carries `id: target`, `continue-on-error`, or an `if:`
on the `cancel:` step -- confirmed structurally (parsed every step object's `id`,
`continue-on-error`, and `if` fields, not a text grep). `rg` for
`id: target|continue-on-error|Fail the job if the target failed` across `ci.yml`
returns exactly one hit, and it is inside the build job's own comment explaining *why*
the mechanism is unnecessary (`ci.yml:130`), not a code remnant. The old "Teardown
backstop" comments are gone, replaced with "Generic hang insurance" language matching
the corrected understanding of what `timeout-minutes` is for.

**Verdict: the revert is complete and correct**, and my own earlier "real, not
cosmetic" verdict on the now-reverted mechanism was accurate as far as it went (it did
change real control flow) but rested on an unquestioned, and as it turns out false,
premise shared with the original review. Recorded here rather than quietly dropped.

## What remains (human_needed)

1. **Merge this PR (or otherwise land these commits on `main`).** This is the only
   remaining blocker. It is a human/maintainer decision -- not something to self-approve
   from a verification pass.
2. After merge, confirm one `push`-triggered run on `main` completes green across every
   job, **including the five push-gated jobs that have not executed at all in this PR's
   CI history** (`dogfood-seed`, `dogfood-verify`, `consumer-smoke`, `publish`,
   `publish-verify` all show `conclusion: skipped` on both observed `pull_request` runs
   -- their behavior post-merge is unverified, not just the four newly-wired jobs).
3. Confirm the `publish` job's summary lists real task artifacts (`nx-cache-<taskhash>`
   entries from `build`/`typecheck`/`test`/`integration`) alongside the run_id seed, on
   that first push-triggered run -- this is the one part of the dogfood loop (write on
   push -> mirror -> Releases shard) that genuinely has not executed yet, since every
   observed run so far has been a `pull_request` event and `publish` is push-gated.

Everything else asked of this verification pass is closed: the static wiring is correct,
the remote-cache read is now confirmed on all five wired legs at 100%, `pull_request`
green is confirmed on three separate commits (`bbf303f`, `f0f31c8`, `ab9ff5d`), and the
C1-fix revert is confirmed complete and correct with the probe evidence backing it. The
one remaining item -- the push half of Truth 7, and the five push-gated jobs' behavior
on an actual push-triggered run -- is unchanged from the prior pass and is inherently
gated on a human merging the PR. Status does not change from `human_needed`, for the
same single reason as before.
