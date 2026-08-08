---
phase: 09-os-invariant-actions-cache-version
plan: 07
subsystem: evidence
status: complete
tags:
  - d-34
  - producer-attribution
  - live-ci-closures
  - human-needed
  - recorded-corrections
requires:
  - 09-01 # nx.json:69 registers ci.yml as a test input -- inherited, not exercised here
  - 09-02 # 09-ROTATION-SIGNAL.md at e7018d0, the prediction OBS-04 is checked against
  - 09-03 # 47597a6, the version-rotating commit whose merge closes the attribution window
  - 09-04 # VER-05's value, recorded as informational and push-gated
  - 09-05 # VER-06's open live clause, carried into this record
  - 09-06 # OBS-04's open live clause, carried into this record
provides:
  - 09-EVIDENCE.md # the phase's hand-off record: snapshot + closures + corrections
  - the producer-attribution snapshot # 106 shard assets + 164 Actions-cache entries, dated pre-merge
  - two named human_needed items # VER-06's cross-OS read-back and OBS-04's one-time rotation signal
  - sixteen recorded corrections # in three groups, each re-verified against the tree at 72eeca3
affects:
  - Phase 11 TEST-08 # this record preserves its perishable input; it does NOT perform the proof
  - the phase verifier # the closures section is what it reads instead of inferring closure
  - the milestone audit # the corrections are what keep a content-located edit from reading as drift
tech-stack:
  added: [] # no package, no script, no dependency; two read-only gh api reads and one markdown file
  patterns:
    - live-ci-closures-table # one row per item with a reference or an explicit open-with-reason (08-ROOT-CAUSE precedent)
    - record-corrections-not-edits # miscounts stated with the right value, source documents left alone
    - allowlist-inversion-leak-check # assert the only email-shaped token present is approved, never spell the forbidden one
key-files:
  created:
    - .planning/phases/09-os-invariant-actions-cache-version/09-EVIDENCE.md
  modified: []
decisions:
  - The snapshot captures the named fields only and renders them as TSV; no raw API JSON, so no uploader identity, node id or signed URL reaches a public commit
  - VER-06 and OBS-04 are recorded as OPEN / human_needed with where each is read; no acceptance check in this plan or any plan in this phase could satisfy either pre-merge
  - ROBUST-04 and VER-04 are recorded as AVAILABLE pre-merge but NOT YET SAMPLED, because the branch is unpushed and PR 9's head is Phase 8's tip -- the existing green run is Phase 8's tree and is NOT this phase's evidence
  - The duplicate-(key, ref) observation is recorded as a raw property of the captured list with its attribution explicitly NOT derived, so the snapshot does not grow into TEST-08's proof
  - Two of the corrections handed to this plan were themselves stale and are corrected in the record rather than propagated
requirements: [VER-06, OBS-04]
requirements_completed: [] # DELIBERATE. This plan closes NEITHER. Their code halves closed in 09-05 and 09-06; their live clauses are the phase's two human_needed items.
metrics:
  duration: ~21 min
  completed: 2026-07-28
  tasks: 2
  commits: 1
  files: 1
---

# Phase 09 Plan 07: Preserve the Perishable Evidence and Name the Open Items Summary

The measurement that the merge destroys is on record and dated; the two clauses no pre-merge run
can produce are named as open with where each is read; and every citation a later audit would trip
over is written down with the number that is right.

## What Was Built

One artifact, one commit: `09-EVIDENCE.md` (835 lines) at **`2059d0f`**, with the three required
sections.

### 1. `## Producer-attribution snapshot (D-34)` -- the perishable half

Captured **2026-07-28T20:30:55Z** at commit `72eeca3`, from `op-nx/github-cache`, shard
`cache-mirror-202607` (release `354838660`), with `gh` 2.86.0 and Nx 23.1.0 recorded beside the
data per PARITY-06.

- **106 shard assets**: `name`, `created_at`, `size`, `label`.
- **164 Actions-cache entries**: `key`, `ref`, `created_at`, `last_accessed_at`, `size_in_bytes`.

Every input was RESOLVED rather than remembered. The shard tag was derived from `shardTag()`
(`retention.ts:54-59`) and its `SHARD_TAG_PREFIX` (`:52`) applied to the captured UTC date, not
hand-guessed. The two `gh api` flag facts were confirmed from `gh api --help` before running:
`--method` defaults to `GET`, and the Actions-cache endpoint wraps its array in `actions_caches`
(verified by `-q 'keys'` returning `["actions_caches","total_count"]`, so a naive `-q '.[]'`
returns nothing).

**All 106 labels are EMPTY.** Recording that emptiness is the point: `mirrored-by` is OBS-03,
Phase 10, so until it lands the mirrored assets carry no attribution field at all and this
snapshot is what covers the window. The record does NOT write the retracted whose-bytes claim --
the label will carry the PUBLISHING leg's OS, which from this phase forward can differ from the
producing OS.

**Why the window closes, stated mechanically rather than asserted.** The `publish` job seeds
`nx-cache-<run_id>` on EACH matrix leg (`ci.yml:1084-1089`) and then mirrors what that leg can
restore, naming it `<hash>-<its own OS>`. Under the OS-partitioned version each leg could only
restore its OWN save, so the suffix WAS producer attribution. After the merge a leg can restore the
other leg's save and would still name it after itself.

The visible fingerprint of the old partition is in the captured list: **15 `(key, ref)` pairs
appear exactly twice**, all `nx-cache-<run_id>` seed keys on `refs/heads/main` -- two cache
VERSIONS under one key. Real `nx-cache-<taskhash>` keys appear once each, because the platform
discriminator already keeps those hashes distinct. **Which version belongs to which OS is
deliberately NOT derived**: the endpoint does not expose the version, the version also folds in the
compression method (`cacheUtils.js:162-163`), and deriving it is TEST-08's work. This is the
T-09-56 boundary and it is stated in the record as well as here.

### 2. `## Live-CI closures` -- five items, none overstated

Two OPEN / `human_needed`, two AVAILABLE-but-not-yet-sampled, one informational. Detail in the
record; the honesty calls are in Deviations below.

One live observation this plan DID make: `gh run list` on this branch returns `pull_request`
events ONLY, and in the latest such run
([`30372679674`](https://github.com/op-nx/github-cache/actions/runs/30372679674)) exactly the five
`if: github.event_name == 'push'` jobs are `skipped` -- `dogfood-seed`, `dogfood-verify`,
`consumer-smoke`, `publish`, `publish-verify`. C-06's reason VER-06 and OBS-04 cannot close
pre-merge has been read from `ci.yml` all phase; it is now MEASURED on a real run.

### 3. `## Recorded corrections` -- sixteen items in three groups

Group A (requirement counts and traceability, 8 items), Group B (instruments and methods, 4),
Group C (position drift caused by this phase's own edits, 4), plus the two reader notes and the
phase-level TDD gate note. Every item was **re-verified against the tree at `72eeca3` while
writing**, which is how two stale corrections were caught (Deviations 2 and 3).

## The two `human_needed` items -- OPEN, and NOT claimed

Recorded here as well as in the record, because a summary that omitted them would be the failure
mode this plan exists to prevent.

**VER-06 -- the cross-OS read-back.** `ci.yml:3-7` filters pushes to `main` and both dogfood jobs
are `if: github.event_name == 'push'` (`:802`, `:853`), so neither runs on this branch or on any
pull request -- observed `skipped`. Read on the first push to `main` after the merge:
`dogfood-seed` (ubuntu, single leg) then both `dogfood-verify` legs. **A MISS fails the job, so a
green `windows-11-arm` leg IS the proof**; the confirming line is
`github-cache dogfood verify: cache HIT for <run_id> on windows with bytes matching a 'linux'-produced payload.`
Re-samplable on every `main` push. A RED Windows leg is a REAL RESULT, not a setup problem.

**OBS-04 -- the one-time rotation signal.** Same gate (`publish` at `:1004`). Read on the FIRST
`main` push after the merge, in that run's `publish` job summary, on BOTH legs, against
`09-ROTATION-SIGNAL.md` (committed at `e7018d0`, deliberately before `47597a6`;
`git merge-base --is-ancestor e7018d0 47597a6` succeeds). Expect a **BOTH-LEGS all-MISS**. It
exists on **exactly one run** and cannot be re-sampled; a `scanned == 0` run does not satisfy it
either. A **WINDOWS-ONLY** miss would instead mean VER-03 landed without VER-01.

**No acceptance check in this plan, or in any plan in this phase, could satisfy either
pre-merge.** Neither is marked complete: `requirements_completed` in this summary's frontmatter is
deliberately empty.

## Deviations from Plan

### 1. [Rule 3 - Blocking] The plan's Task 2 four-command verify was NOT run

`09-07-PLAN.md` Task 2 asks for `npm run test && npm run lint && npm run check:action && npm run
pack:check`, and the plan-level `<verification>` asks for all nine battery commands. Only
`npm run format:check` was run (**exit 0**). Three reasons, in order of weight:

1. **`npm run check:action` is MUTATING and produces a FALSE verdict from a worktree.** It runs
   `build:action` then diffs `start-cache-server/index.js`. Plan 09-01 measured the artefact
   precisely: run against a `node_modules` reached through a junction or an ancestor walk, esbuild
   emits `../../../node_modules/...` where the committed bundle has `node_modules/...`, producing
   **689 insertions / 689 deletions** with no source edit. This worktree has NO `node_modules` of
   its own (`format:check` worked only because Node's resolution walked up into the main tree's).
   Running it here would risk committing a rewritten bundle as though it were this plan's work --
   the exact failure 09-01 avoided.
2. **The orchestrator's dispatch forbade it explicitly**, on that measured basis, and stated this
   plan carries no bundle obligation. Correct: the commit touches one file under `.planning/`.
3. **This commit cannot affect any of the nine.** `.planning/` is prettier-ignored
   (`.prettierignore`) and is an input to no Nx target, so the battery's result at `2059d0f` is
   definitionally its result at `72eeca3`, which the orchestrator already validated.

Verified from git instead, which for a doc-only commit is the stronger claim: one file in the
diff, no deletions (`git diff --diff-filter=D HEAD~1 HEAD` empty), and no source file, workflow
file or `start-cache-server/index.js` in the commit.

**Carry-forward (repeat of 09-01's and 09-02's, not a new item):** run the full nine-command
battery once on the MAIN tree at the merge commit, where `node_modules` legitimately lives and
`check:action` is meaningful and non-racing.

### 2. [Rule 1 - Bug] A correction handed to this plan was itself stale: `dogfoodBody`'s call sites

The dispatch's recorded-correction list states "`dogfoodBody` is called at `action/index.ts:265`
(09-04 shifted it from `:224`)". Measured at `72eeca3`: **TWO calls, at `:286` and `:329`.**

`:265` describes the state 09-05 INHERITED, not the current tree. 09-05 (D-19, C-01) moved the
single pre-branch call INTO each branch so the seed leg's `cachePlatform()` and the verify leg's
literal `'linux'` stay physically apart -- the whole point of that plan's vacuity control. Writing
the handed-down sentence verbatim would have put a false position claim into the record whose
purpose is preventing exactly that. The record carries the full four-stage table (as cited ->
C-01's measurement -> after 09-04 -> measured here) so a reader meeting any of the four numbers
can place it.

Same class, smaller: `resolveCompressionMethod()` is called at `action/index.ts:184`, not `:183`.

### 3. [Rule 2 - Missing critical functionality] A NEW correction the plan did not name, and it undercuts the phase's only pre-merge control

`REQUIREMENTS.md:338` says `action-bundle-drift` "catches it, but only on push". **It does not.**
The job at `ci.yml:99-114` carries **no `if:` gate** -- verified by reading the whole job -- so it
runs on pull requests, which is the ENTIRE reason C-06 names ROBUST-04 as the one control in this
phase available before the merge.

This belonged in the record because the requirement's own text argues against the pre-merge
availability the phase's closure plan depends on, and a reader reconciling the two would conclude
ROBUST-04 is also merge-gated. Added to Group A3 alongside the four-vs-five sidecar count, in the
same item, because both errors are in the same requirement sentence.

Also recorded there: this phase's own artifacts cite the job as `ci.yml:99-116`; the body ends at
`:114` and `:116` opens the next job's comment.

### 4. [Honesty] The plan's "AVAILABLE pre-merge, and record how each stood" could not be satisfied as written

The plan asks for ROBUST-04's and VER-04's results "on this branch's PR". Measured:
`git rev-list --left-right --count origin/gsd/...---HEAD` returns **`0 32`** -- every commit in
this phase is LOCAL ONLY -- and PR #9's head is **`3327a4f`** (`docs(08): extract phase
learnings`), the END of Phase 8.

So the green `action-bundle-drift` and green two-leg `integration` in run `30372679674` were
computed on **Phase 8's tree, containing none of this phase's code**. Reporting them as this
phase's pre-merge results would have been precisely the claimed-observation failure T-09-54
guards against, one category over.

Recorded instead as **AVAILABLE but NOT YET SAMPLED**, in their own subsection, with an explicit
precondition paragraph warning the reader not to merge that category with the two `human_needed`
ones -- these two CAN close before the merge, on the next push of this branch, and simply have not
run yet. The record also names what pre-merge evidence DOES exist for ROBUST-04 (09-03's
`check:action` exit 0 with an empty diff, on an `npm ci` tree) and labels it a workstation
measurement rather than that job.

**Total deviations:** 1 blocking tooling incompatibility, 2 stale-claim bugs caught before they
were written down, 1 honesty reclassification. No scope change; no source, workflow or bundle file
touched.

## Checkpoints

The plan's Task 2 carries two `<human-check>` items. Per the dispatch, the orchestrator is in
auto-mode for `human-verify`, so both were resolved and the resolution is recorded here for
review.

**Check 2 (no leak, plausible lists) -- resolved MECHANICALLY, which is stronger than an eyeball.**
Run against the committed file:

| Assertion | Instrument | Result |
|---|---|---|
| Only email-shaped token present is the approved public one | allowlist-inversion `rg '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'` | **no match** -- the file carries no email-shaped token at all, which strictly satisfies the criterion. The forbidden value is never spelled, per the detection rule. |
| No signed URL, node id or uploader identity | `rg 'objects\.githubusercontent\|X-Amz\|\?token=\|node_id\|login\|browser_download_url\|RA_kwDO'` | no match |
| Only public, non-signed URLs | `rg 'https?://'` | one match: the Actions run reference, matching `08-ROOT-CAUSE.md`'s Live-CI precedent |
| ASCII only | `rg '[^\x00-\x7F]'` | no match |
| Lists plausible for the current month | 106 assets spanning `2026-07-16T02:52:09Z`..`2026-07-26T11:53:33Z`; 164 cache entries spanning `2026-07-16T02:35:33Z`..`2026-07-28T15:21:26Z`; family counts sum exactly (50+38+18=106, 104+50+10=164) | consistent |

**Check 1 (the two `human_needed` items are understood as open) -- carried, not fabricated.** This
one is a maintainer acknowledgement and cannot be discharged by an agent. It is not a blocker: the
substance is the two items above, recorded as open with where each is read, and nothing in this
phase marks either closed. The maintainer's reading of the real post-merge run IS the closure
event, and that is stated in the record.

## Verification

| Check | Result |
|---|---|
| `npm run format:check` | **exit 0** |
| `git log -1 --name-only` | exactly `.planning/phases/09-os-invariant-actions-cache-version/09-EVIDENCE.md` |
| `git diff --diff-filter=D HEAD~1 HEAD` | empty -- no deletions |
| `git config user.email` | the approved PUBLIC gmail address (asserted by allowlist-inversion, not by spelling the alternative) |
| Section headings | `## Producer-attribution snapshot (D-34)` (`:21`), `## Live-CI closures` (`:452`), `## Recorded corrections` (`:607`) |
| Write sentinel removed | `rg 'gsd:write-continue'` -- no match |
| Snapshot precedes any merge | capture `2026-07-28T20:30:55Z` at `72eeca3`; branch is 32 commits ahead of origin and unmerged; every `publish` job on this branch is `skipped` |
| VER-06 / OBS-04 status | recorded `human_needed`, `requirements_completed: []` |
| No source, workflow or bundle file touched | none in the commit; `git status --short` clean after it |
| Worktree discipline | HEAD on `worktree-agent-a584c832dac13ba77`, git dir and toplevel re-asserted before staging; no `git stash`, no `git clean`, no `git reset` at any point |
| STATE.md / ROADMAP.md | NOT modified (orchestrator owns them) |

All `gh` calls were read-only and GET-shaped. Nothing was created, updated or deleted: no release,
no asset, no issue, no pull request, no workflow dispatch.

## Known Stubs

None. The record is complete against its acceptance criteria. The two open items are OPEN by
measurement, not placeholders -- each names its gate, its reader and its closing signal.

## Threat Flags

None new. This plan added no network endpoint, no auth path, no file-access pattern and no schema.
The plan's own register is discharged as follows:

| Threat | Disposition | How |
|---|---|---|
| T-09-52 raw API JSON in a public repo | mitigated | named fields only, rendered as TSV; four leak greps clean |
| T-09-53 contact data in a public commit | mitigated | zero email-shaped tokens in the file; committer email verified by allowlist-inversion before the commit |
| T-09-54 claiming VER-06/OBS-04 closed | mitigated | both recorded OPEN with both `if:` gates and the push filter cited; `requirements_completed: []` |
| T-09-55 a once-only signal lost | mitigated | the prediction was already committed at `e7018d0`; the record names WHERE, WHEN and that it cannot be re-sampled |
| T-09-56 the snapshot growing into the O1 proof | mitigated | stated in the section framing; the one derivable observation (duplicate keys) is recorded with its attribution explicitly NOT derived |
| T-09-57 a content-located edit read as drift | mitigated | sixteen corrections with the right values, including the `ci.yml` drift and this phase's own position shifts |
| T-09-58 a 404 read as a failure | n/a, and the handling is stated | the shard resolved; the record states a 404 would have been written verbatim rather than the query widened |
| T-09-SC package installs | mitigated | no package, no script, no dependency; two read-only `gh api` reads and one markdown file |

## Follow-ups

- **Two `human_needed` items** for the maintainer at the first `main` push after the merge, as
  above. OBS-04's is unrecoverable if missed on that one run.
- **ROBUST-04 and VER-04** close on the next push of this branch (which updates PR #9), before the
  merge. Watch `action-bundle-drift` and `integration (windows-11-arm)`.
- **VER-05's observed value** on both `publish` legs after the merge -- informational, surfaced,
  never gated. VER-05's correctness is already closed by 09-04's fixture matrix.
- **Nine-command battery on the MAIN tree** at the merge commit.
- **Phase 11 TEST-08** consumes this snapshot as an INPUT. It must not treat the duplicate-key
  observation as an attribution result.
- **`09-CONTEXT.md` D-24's corollary (`:296-297`)** still carries the Phase 7 D-02 misattribution
  on disk. Recorded rather than edited, per the house pattern; a later reader will meet it again.

## Self-Check: PASSED

- `.planning/phases/09-os-invariant-actions-cache-version/09-EVIDENCE.md` -- FOUND (835 lines, 3
  required sections)
- Commit `2059d0f` -- FOUND in `git log`, one file, no deletions
- `e7018d0` (`09-ROTATION-SIGNAL.md`) and `47597a6` (the version-rotating commit) -- both FOUND,
  and `git merge-base --is-ancestor e7018d0 47597a6` succeeds
- Every citation in the record's corrections section re-verified against the tree at `72eeca3`
  while writing; two handed-down claims found stale and corrected rather than propagated
- `STATE.md` and `ROADMAP.md` untouched

---

*Phase: 09-os-invariant-actions-cache-version*
*Completed: 2026-07-28*
