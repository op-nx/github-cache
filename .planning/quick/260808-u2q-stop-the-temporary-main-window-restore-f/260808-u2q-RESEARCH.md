# 260808-u2q: Stop the temporary-main-window restore from firing production CI -- Research

**Researched:** 2026-08-08
**Domain:** GitHub Actions push-event gating; local test-flake triage
**Confidence:** HIGH for Half A, HIGH for Half B
**Repo state at research time:** branch `gsd/v0.0.2-os-invariant-cross-os-sharing`, HEAD `f9be637`, `origin/main` `fe25a3f`, `git merge-base HEAD origin/main` = `fe25a3f` (verified, exit 0)

---

## Summary

**Half A.** The candidate fix is CORRECT, and it is now backed by a complete empirical
record rather than by reasoning alone. `forced` is a documented `push` webhook payload
field, `github.event` is documented as the full webhook payload, so `github.event.forced`
is readable in a job `if:`. The `--force` flag is NOT carried on the git push wire
protocol at all -- receive-pack sees only `<old-oid> <new-oid> <refname>` -- so GitHub can
only be computing `forced` server-side from non-fast-forwardness. That mechanical fact is
what makes the discriminator safe: an operator typing `--force-with-lease` on a
fast-forward window-open push still gets `forced: false`.

The 22 pushes to `main` in the `fe25a3f` era separate 22/22 with zero misclassifications:
11 restores (all rewinds, `forced: true`), 11 window-opens (all fast-forwards,
`forced: false`), plus the one genuine PR #7 merge push that CREATED `fe25a3f`
(fast-forward, `forced: false`, and it SHOULD have published). Every historical window tip
descends from `fe25a3f` -- verified with `git merge-base --is-ancestor` on all nine tips
still resolvable locally, including the current `f9be637`.

The occurrence count in the handoff is an UNDERCOUNT. Five `refs/backups/*` on origin
implied five occurrences; the actual figure is **11 restore pushes**, each firing a full
production `ci.yml` run. Backup refs are reused by name, so they cannot count events.

**Half B.** Nothing is recoverable and there is no investigation to do. `69bd1b7` is a
DOCS-ONLY commit (one file, `.planning/phases/08-nx-task-hash-parity/08-ROOT-CAUSE.md`,
+326, zero source). `gh run list --commit 69bd1b7` returns `[]` -- no CI run has ever
existed for that SHA, so there is no log and no artifact to retain. The failure was a
LOCAL `npm run test` inside a battery loop whose redirect discarded stdout, and Nx caches
terminal output for SUCCESSFUL runs only. The honest verdict is unactionable-until-recurrence.

**Primary recommendation:** add `&& !github.event.forced` to the `publish` job's existing
`if:` and let `publish-verify` follow via `needs:`. One line of behaviour change.

---

## Half A

### Q1. Does the push payload carry `forced`, and is it readable in an `if:`?

**Yes to both.**

- GitHub's webhook reference documents the `push` payload property **`forced`** with the
  description, verbatim: *"Whether this push was a force push of the ref."*
  [CITED: docs.github.com/en/webhooks/webhook-events-and-payloads]
- The Actions contexts reference documents `github.event` as *"The full event webhook
  payload. You can access individual properties of the event using this context."*
  [CITED: docs.github.com/en/actions/reference/workflows-and-actions/contexts]

Together those make `github.event.forced` a valid, documented expression in a job `if:`.

**Caveats, in order of how much they matter here:**

1. **Present only on `push`.** On `pull_request` / `schedule` / `workflow_dispatch` the
   field is absent and the expression is falsy. Irrelevant in this file because every
   proposed use is ANDed with `github.event_name == 'push'`, but it is why the bare form
   `if: !github.event.forced` must never stand alone. [CITED: community guidance, cross-checked
   against the contexts doc]
2. **Loose equality.** GitHub coerces mismatched types to a number, so `null == false` is
   TRUE. `!github.event.forced` and `github.event.forced == false` behave identically here.
   Prefer `!github.event.forced` -- fewer coercion questions for a future reader.
3. **`forced` does NOT exist on `pull_request`.** Detecting a force-push to a PR branch
   needs `synchronize` plus `before`/`after`. Not needed: the write jobs are push-gated.
4. **No documented statement on flag-vs-fast-forward semantics.** GitHub's one-line
   description is ambiguous on its face. Q2 resolves it from the protocol.

### Q2. Is the window-open push genuinely NOT forced?

**Yes, and it is measured, not assumed.**

The mechanism first, because it is the load-bearing part. The `--force` flag is a
CLIENT-SIDE policy and is never transmitted. The push update command on the wire is
`<old-oid> SP <new-oid> SP <refname>` with no force bit; `send-pack` performs the
fast-forward check locally and simply declines to send the command when it fails, and
`receive-pack` independently evaluates the transition (that is what `receive.denyNonFastForwards`
acts on). The token `forced-update` appears in the protocol only in the SERVER-to-CLIENT
`report-status-v2` direction. [VERIFIED: git-scm.com gitprotocol-pack, git-send-pack,
git-receive-pack] Therefore GitHub cannot know whether `--force` was typed, and `forced`
must be a server-computed non-fast-forward verdict.

**Consequence that matters operationally:** typing `--force` or `--force-with-lease` on
the window-OPEN push does NOT set `forced`, because that push is a fast-forward. The
discriminator is robust against operator habit.

The measurement, from `gh api repos/op-nx/github-cache/events --paginate` (292 events,
70 `PushEvent`s on `refs/heads/main`, range 2026-07-15 to 2026-08-04) classified by
`before` / `head` and cross-checked with `git merge-base --is-ancestor`:

| Shape | Count | Ancestry verdict | `forced` | Should publish? |
|-------|-------|------------------|----------|-----------------|
| `fe25a3f` -> tip (window open) | 11 | tip descends from `fe25a3f` | false | YES |
| tip -> `fe25a3f` (restore) | 11 | rewind to an ancestor | true | NO |
| `e56e5d2` -> `fe25a3f` (PR #7 merge) | 1 | fast-forward | false | YES (and it did) |

22/22 clean separation, zero misclassification. Every restore's `before` was verified a
DESCENDANT of `fe25a3f`; the single creating merge push's `before` (`e56e5d2`) was verified
an ANCESTOR. Corroborated independently by `gh run list --branch main --workflow ci.yml
--limit 200`: 12 push runs with `headSha == fe25a3f` (11 restores + the merge), 7 of them
`failure`, 5 `success`.

**What would make a window-open push forced (and silently skip publishing):**

- **Opening a second window while the first is still open.** `main` holds tip A; pushing
  tip B, which does not descend from A, is a rewind. The 11/11 record shows the
  open-then-restore discipline has held every time, but this is the real hazard.
- **Rebasing or amending the feature branch after `fe25a3f` stopped being its base.**
  Cannot happen while `fe25a3f` is the merge-base, which it is today.
- **`main` advancing between backup and open.** Only `cleanup.yml` (schedule) and
  `windows-regression-detector.yml` (schedule) run unattended; neither pushes. Not a live risk.

Failure direction if it happens anyway: publish is SKIPPED. See Q5.

### Q3. What else distinguishes the restore push?

| Discriminator | Needs action DURING the window? | If forgotten, fails... | Verdict |
|---------------|-------------------------------|----------------------|---------|
| **`github.event.forced`** | **No** | **CLOSED** (no writes; measurement missed) | **RECOMMENDED** |
| `github.event.before` / `after` ancestry, computed in a step | No | CLOSED | Redundant -- this IS what `forced` precomputes, and a step-level check runs after the job starts, so `needs:` still burns the whole matrix. Viable only as belt-and-braces. |
| `github.event.before == 'fe25a3f...'` hardcoded | No | Rots the day `main` moves; then fails OPEN | REJECT. A constant SHA in `ci.yml` is a landmine. |
| Repository variable / environment toggle | **Yes** -- flip on before open, flip off before restore | **OPEN** (forgotten flip-off means the restore publishes -- the exact defect) | REJECT. Wrong failure direction. |
| `workflow_dispatch`-only publishing | Yes (dispatch the run) | CLOSED, but | REJECT on a different ground: the window exists to observe the PUSH path. Moving publish to a dispatch trigger means the instrument no longer measures the thing under test. A `push && !forced` OR `workflow_dispatch` hybrid is possible but adds a trigger for no gain. |
| Sentinel ref or tag pinned at the window tip | Yes (create, and delete) | CLOSED (a stale sentinel points at the tip, not at `fe25a3f`, so the restore still skips) | Workable but three moving parts where one suffices. |

`github.event.forced` is the only option that is both zero-touch and fail-closed.

### Q4. Job `if:`, step, or documented procedure?

**Job `if:`, on `publish` only.**

Measured house form in this file:

| Job | Line | Current `if:` |
|-----|------|---------------|
| `publish` | 2207 | `if: ${{ !cancelled() && github.event_name == 'push' }}` |
| `publish-verify` | 2428 | `if: github.event_name == 'push'` |
| `consumer-smoke` | 2072 | `if: github.event_name == 'push'` |
| `dogfood-seed` | 1950 | `if: github.event_name == 'push' \|\| github.event.pull_request.head.repo.full_name == github.repository` |
| `dogfood-verify` | 2024 | same as `dogfood-seed`, deliberately restated |

The `${{ }}` wrapper appears where a function call is involved; the bare form elsewhere.
So the native edit is:

```yaml
    if: ${{ !cancelled() && github.event_name == 'push' && !github.event.forced }}
```

Three house conventions the accompanying comment must satisfy, all read off the
surrounding prose rather than guessed:

1. **The rationale block sits ABOVE the job, and the last paragraph explains the `if:`.**
   `publish`'s block already ends with "if: !cancelled() && push -- the mirror runs only on
   the trusted push trigger..." (2170-2172). Extend that paragraph; do not add a new
   trailing block.
2. **ALL-CAPS section labels for the load-bearing turns**, and measurements cited with a
   run id. The file's own precedents: "MECHANISM:", "BOUNDED FAILURE MODE:", "MEASURED on
   run 30400231720", "REJECTED ARGUMENT:", "recorded here rather than left to be re-derived".
   The new text should carry `MEASURED: 22 pushes to main in the fe25a3f era separate
   11/11/1`, and name run `30825636788`.
3. **State the failure direction explicitly.** `publish`'s existing comment already
   establishes the vocabulary: "A recoverable GAP, never a wrong artifact reaching the
   world-readable mirror." The `forced` gate has exactly that shape and should say so in
   those terms.

**Do NOT gate at the step level.** The write is a JS-action step deep inside a
`max-parallel: 1` two-OS matrix that first runs `npm ci` + `npm run build` on a
windows-11-arm runner. A step gate burns the entire matrix plus its four `needs:`
dependencies to arrive at a no-op.

**`publish-verify` needs no separate gate,** because `needs: publish` plus the implicit
`success()` skips it when `publish` skips -- the file states this itself at 2019-2023.
Empirical confirmation: on run `30825636788`, `publish` FAILED and `publish-verify` shows
`skipped`. However, that same comment records the house convention as restating the
condition anyway ("kept anyway, matching the publish / publish-verify pairing this file
already uses"). Both are defensible; the minimal diff is `publish` alone, and the
house-consistent diff restates on `publish-verify` too. Prefer the minimal one and say in
the comment that the restatement was considered and declined, so a reader does not
re-derive it.

**Do NOT gate `dogfood-seed` or `consumer-smoke`.** Their writes are `nx-cache-<run_id>`
Actions-cache entries under a run id that is never reused, invisible to `main`'s cache and
aged out by the 7-day-unaccessed policy. The file already argues this for the concurrency
key at lines 26-31. Gating them costs the live proofs and buys nothing.

**The documented procedure still needs a line,** but as belt-and-braces, not as the fix:
there is no runbook file for the window (it lives only in `.planning/.continue-here.md`
and `HANDOFF.json`). Add to whichever of those the task updates: *open the window with a
plain `git push origin HEAD:main` and never while a previous window is open.* A procedure
step alone would be the fix that item 2 exists to replace -- something the operator can
forget.

### Q5. Blast radius

**Cascade off `publish`:** exactly one job, `publish-verify` (`needs: publish`, two OS
legs). Nothing else in the file has `publish` in its `needs:`.

**What the restore runs actually did.** Run `30825636788` reached real production writes
before failing -- from its own log:

```
GET  /repos/op-nx/github-cache/releases/tags/cache-mirror-202608 - 404
POST /repos/op-nx/github-cache/releases                          - 422
##[error]Not Found - https://docs.github.com/rest/releases/releases#get-a-release-by-tag-name
```

That `POST /releases` is an attempted production write under the job's `contents: write`
grant. (The 422 itself is the separate, already-documented burned-shard defect in
`.planning/debug/publish-verify-422-empty-shard.md` -- do not conflate the two.) The five
restore runs that CONCLUDED `success` completed their uploads. Per the file's own
arithmetic at 2323-2331, a push mirrors ~8 assets against a 1000-asset per-month shard cap,
so 11 restore runs consumed roughly 88 asset slots plus 11 full CI runs across two OS
matrices -- for a tree whose entries were already mirrored.

**If publishing is wrongly skipped on a push that should publish:** that push's entries
stay in the Actions cache and the next default-branch push mirrors them. This is not a new
failure mode -- it is verbatim the trade `publish`'s existing comment already accepts for
its `needs:` list ("a recoverable GAP, never a wrong artifact"). The only thing genuinely
lost is a MEASUREMENT, which is precisely what item 3 needs.

**Is a wrongly-skipped publish caught, or silent?**

- **Loud, for item 3's purpose.** `publish-verify` reads back the asset its own leg seeded
  and fails on a MISS; if `publish` skipped, `publish-verify` skips too, and item 3's whole
  point is observing those legs run. A skipped `publish-verify` is the observation failing
  to happen, which is immediately visible on the run page.
- **Silent, in the general case.** No scheduled tripwire asserts "the mirror received this
  push". `cleanup.yml` prunes, it does not audit coverage. So a wrongly-skipped publish on
  an ordinary push would go unnoticed until someone read the shard. Worth one sentence in
  the comment; not worth building a tripwire for -- the failure is a recoverable gap by
  construction, and this repo's own OBS-04 record is about tripwires that fire on correct
  work getting disabled.

### Q6. Is a genuine force-push to `main` ever legitimate here?

**Yes, but it does not refute the discriminator.**

The one real case is a deliberate shared-history rewrite of `main` -- the leaked-contact
remediation path (`git filter-repo --replace-text` then `--force-with-lease`). Under the
gate, that push skips `publish`. Consequences:

- No wrong artifact reaches the mirror. The skip is the safe direction.
- The rewritten tree's entries mirror on the next ordinary push. Identical to the
  already-accepted `needs:`-skip gap.
- If publishing is wanted immediately, push one empty forward commit afterwards. That
  push is a fast-forward, so it publishes.

Two non-cases, named so they are not re-derived: a merge commit landing on `main` is a
fast-forward (`forced: false`, publishes -- exactly what the PR #7 merge did on 2026-07-26),
and branch deletion/creation is covered by the separate `deleted` / `created` payload
fields, not `forced`.

So: NO legitimate force-push to `main` requires publishing in the same push. The
discriminator stands.

### Why `[skip ci]` is genuinely unavailable

Confirmed rather than assumed. GitHub's skip mechanism inspects commit messages in the
push (and the PR HEAD commit). A rewind push carries an empty `commits` array and a
`head_commit` of `fe25a3f`, whose message ("Merge pull request #7 from
op-nx/gsd/quick-260726-gok-typecheck-input...") cannot be altered without changing the SHA
-- which would defeat the restore. [VERIFIED: github.blog changelog + payload shape]

---

## Half B: the `69bd1b7` test failure

### What was probed

| Probe | Result |
|-------|--------|
| `gh run list --commit 69bd1b73e8b4...` | `[]` -- **no CI run has ever existed for this SHA** (exit 0, so a genuine empty result, not a failure) |
| `git branch -a --contains 69bd1b7` | feature branch only; never pushed to `main`, so `ci.yml`'s `on: push: branches: [main]` never fired for it |
| `git show --stat 69bd1b7` | ONE file: `.planning/phases/08-nx-task-hash-parity/08-ROOT-CAUSE.md`, +326. **Docs-only. Zero source files.** |
| Artifacts | None -- no run, so no artifact |
| Nx terminal-output cache | `.nx/cache/terminalOutputs` holds SUCCESSFUL runs only; the failing entry was never written |

### Verdict

**Unactionable until it recurs with output. There is no investigation to do.**

The reasoning is short because the evidence is decisive:

1. **The commit cannot be the cause.** It touches one planning markdown file. A docs-only
   commit cannot change test behaviour. This is not an inference from the prior session's
   record -- it is `git show --stat` at the SHA.
2. **The evidence never existed in a recoverable place.** The failure was a local
   `npm run test` inside a battery loop whose redirect discarded stdout. There is no CI
   run, so log retention is not even a question.
3. **Nx already classified it.** `NX detected a flaky task: @op-nx/github-cache:test` means
   Nx saw a FAILURE and a SUCCESS at the SAME task hash -- byte-identical inputs, so
   non-determinism by definition, not a regression.
4. **It has not recurred across four subsequent phases.** Seven consecutive local passes at
   the same hash immediately after; `test` green in Phase 11 (replayed from remote) and,
   most tellingly, in Phase 12 with the cache BYPASSED on Windows -- a real execution, which
   is the condition a startup-race hypothesis would need. `12-03-SUMMARY.md:202`: "The
   `69bd1b7` `test` flake did NOT surface."

Any statement about which spec failed would be invention. The existing record in
`08-nx-task-hash-parity/deferred-items.md` already says exactly this and says it well; it
does not need rewriting.

### The smallest capture improvement

The root cause of the lost evidence is one thing: **a battery loop that redirects test
output into a discard**. The cheapest durable fix is to make that redirect a `tee` instead,
so the loop still gets its exit code while the output survives.

```bash
npm run test 2>&1 | tee "test-$(date +%s).log"; exit ${PIPESTATUS[0]}
```

No new file, no framework, no retry harness, no Vitest reporter config. If a
battery/loop script exists in `.planning` guidance rather than as a committed file, the
one-line change belongs wherever that loop is written down.

Second-cheapest, only if the loop is not the vehicle next time: run the failing target once
with `--skip-nx-cache --output-style=stream` before any re-run. Naming it here so the
operator has it; it is a habit, not a code change.

Anything larger than this -- a retry-with-capture wrapper, a flaky-test dashboard, a Vitest
`--reporter=json` pipeline -- is building infrastructure for an event that has occurred once
in five phases and has never recurred. Do not build it.

---

## Recommended change

```yaml
  publish:
    if: ${{ !cancelled() && github.event_name == 'push' && !github.event.forced }}
```

Plus an extension to the existing rationale paragraph at `ci.yml:2170-2172`, in the file's
own idiom, carrying: the mechanism (`--force` is not on the wire; GitHub computes `forced`
from non-fast-forwardness), the measurement (22 pushes, 11/11/1, zero misclassification),
the incident (run `30825636788`, `POST /releases` 422), the failure direction (skipped
publish is a recoverable gap, never a wrong artifact), and the one exception (a deliberate
`main` history rewrite skips publish; push an empty forward commit if the mirror is wanted
immediately).

Plus one procedural line wherever the window is written down: open with a plain
`git push origin HEAD:main`, never while a previous window is open.

**Skipped: a step-level ancestry cross-check, a sentinel tag, a shard-coverage tripwire.**
Add the first only if `forced` is ever observed misreporting; add the third only if a
wrongly-skipped publish actually bites.

---

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|-------|---------|---------------|
| A1 | GitHub computes `forced` server-side from non-fast-forwardness, not from a client flag | Q2 | If wrong, an operator typing `--force` on a window-open push silently skips publish and item 3's measurement is lost. Mitigated by the procedural line (plain `git push`), and the failure is fail-closed. **This is the single fact that would refute the fix.** Confidence HIGH: the wire protocol has no force bit. |
| A2 | A skipped `publish` skips `publish-verify` | Q5 | If wrong, `publish-verify` runs with no seed and fails red on the restore. Confidence HIGH: documented by GitHub, asserted by the file itself at 2019-2023, and observed on run `30825636788` (`publish` failure -> `publish-verify` skipped). |
| A3 | No unattended workflow pushes to `main` | Q2 | If wrong, `main` could advance between backup and open, making the open forced. Confidence HIGH: both other workflows are `schedule`-triggered and neither pushes (read their headers). |

## Project Constraints (from CLAUDE.md / AGENTS.md)

- `grep` and the Grep tool are DENIED; `git grep` primary, `rg` for gitignored paths, `| rg` for pipes. Followed throughout.
- ASCII only, no emoji, no em/en dashes.
- `git commit -m` fails on this Dev Drive (ReFS) -- use `git commit -F <file>`.
- Never `git add .` / `-A` / `-u`; stage by name.
- Never merge any PR or milestone without explicit operator approval. Temporary main
  windows and branch pushes ARE pre-approved.
- Do not touch the five `refs/backups/*` on origin -- evidence.
- Nx tasks run through `npx nx` / `npm exec nx`, never the underlying tool directly.

## Not applicable to this task

- **Package Legitimacy Audit** -- no dependency is added or changed.
- **Environment Availability** -- `gh` (authenticated), `git` 2.54, Node 24 all present and
  exercised during this research. No new external dependency.
- **Validation Architecture** -- the change is a single workflow `if:` expression; it has no
  unit-testable surface. Its verification is behavioural and belongs to item 3's window:
  the open push runs `publish` + `publish-verify`, the restore push does not.
- **Security Domain** -- the change strictly REDUCES the surface on which a `contents: write`
  grant is exercised. No new credential, no new permission, no new input.

## Sources

### Primary (HIGH)
- `.github/workflows/ci.yml` lines 1-36, 1816-1821, 1947-2029, 2071-2084, 2154-2278, 2395-2450 (read directly)
- `git merge-base --is-ancestor` over all 12 `head=fe25a3f` push events and 9 window tips
- `gh api repos/op-nx/github-cache/events --paginate` -- 292 events, 70 `PushEvent`s on `refs/heads/main`
- `gh run list --branch main --workflow ci.yml --limit 200` -- 69 push runs
- `gh run view 30825636788 --log-failed` and `--json jobs`
- `gh run list --commit 69bd1b73e8b4facac2d109f17516ee992853076f` -> `[]`
- `git show --stat 69bd1b7`
- `.planning/phases/08-nx-task-hash-parity/deferred-items.md`, `08-06-SUMMARY.md:262`
- `.planning/phases/12-windows-ci-reuse-o4-consumer-recipe/12-03-SUMMARY.md:202`
- `.planning/.continue-here.md`, `.planning/HANDOFF.json`
- docs.github.com/en/webhooks/webhook-events-and-payloads (`push` payload, `forced`)
- docs.github.com/en/actions/reference/workflows-and-actions/contexts (`github.event`)
- git-scm.com/docs/gitprotocol-pack, /git-send-pack, /git-receive-pack (no force bit on the wire)

### Secondary (MEDIUM)
- github.blog/changelog/2021-02-08-github-actions-skip-pull-request-and-push-workflows-with-skip-ci
- Community guidance on `github.event.forced` absence on non-push events (cross-checked against the contexts doc)

**Valid until:** 2026-09-08 (GitHub Actions expression and payload semantics are stable;
the empirical push-shape record is anchored to `origin/main == fe25a3f` and becomes stale
the moment `main` moves).
