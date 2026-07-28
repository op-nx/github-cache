---
phase: 09-os-invariant-actions-cache-version
plan: 02
subsystem: observability
tags: [obs-04, rotation-signal, actions-cache-version, tripwire, pre-registration]
requires:
  - '09-CONTEXT.md D-27, D-28b, D-29, D-30, C-04, C-10'
  - '09-RESEARCH.md Q9 (three-window table) and Hazard E'
  - '07-CONTEXT.md D-36 (three legitimate all-MISS rotation windows)'
  - '08-LEARNINGS.md (pre-register the falsifiable condition, including non-triggers)'
provides:
  - 'the recorded-in-advance rotation-signal prediction for the first post-09-03 push to main'
  - 'the canonical axis wording plan 09-06 must match in the reworded warning message'
  - 'the two-consecutive-pushes tripwire gate as a documented reading instruction'
  - 'five pre-declared non-triggers, including the bundle-drift look-alike'
affects:
  - 'plan 09-03 (its commit must be a descendant of this one; that ordering is the control)'
  - 'plan 09-06 (its warning message must name the same axis in the same words)'
tech-stack:
  added: []
  patterns:
    - 'record-in-advance: the prediction is committed before the observation, and git history is the proof'
    - 'PARITY-06 header block: capture date + authoring commit SHA + pinned upstream version'
    - 'pre-registered non-triggers alongside the positive prediction'
key-files:
  created:
    - .planning/phases/09-os-invariant-actions-cache-version/09-ROTATION-SIGNAL.md
  modified: []
decisions:
  - 'The record names the axis as the @actions/cache cache VERSION, kept distinct from the Nx TASK hash (window 1) and the Release ASSET NAME (window 3), because a message that says only "rotation" lets a reader misdiagnose the other two windows.'
  - 'The both-legs all-MISS is attributed to VER-01 the PATH, not to enableCrossOsArchive: cacheUtils.js:166 pushes the windows-only component only when process.platform === "win32" && !enableCrossOsArchive, so off win32 the flag is a no-op on the version.'
  - 'The tripwire stays a documented reading instruction gated on two consecutive all-miss pushes with NO version-affecting change in between -- never a hard failure, because a tripwire that fires on correct work gets disabled.'
  - 'Persisted markers (Release asset, repo variable, cache entry) and a scheduled last-two-runs diff are rejected and recorded as rejected, so a later maintainer sees the reasoning rather than re-deriving it.'
  - 'No PROJECT.md Key Decisions row was added: the decision is "no mutable observability state", which Key Decisions already asserts, and a second copy would drift.'
metrics:
  duration: ~14 min
  completed: 2026-07-28
  tasks: 1
  files_changed: 1
status: complete
---

# Phase 9 Plan 02: Record the Rotation Signal In Advance Summary

OBS-04's first half closed: the expected all-MISS signal of the first post-rotation `main` push is now
on record in git history at commit `e7018d0`, before any commit that changes `getCacheVersion`'s input.

## What Was Built

One artifact:
`.planning/phases/09-os-invariant-actions-cache-version/09-ROTATION-SIGNAL.md` (251 lines), carrying a
PARITY-06 header block plus the seven required sections.

The plan's whole value is positional, not textual: the signal exists on **exactly one run** and cannot
be re-sampled, so a prediction written afterwards is indistinguishable from a rationalisation.
"Recorded IN ADVANCE" is therefore a claim about git history, and the commit's position relative to
plan 09-03's is the control. That control is intact -- see Verification below.

### Content, section by section

| Section | What it pins |
|---|---|
| `## Method` | capture date 2026-07-28, authoring commit `4296d1d`, `@actions/cache` **6.2.0**, plus a table of the five sites read first-hand this session |
| `## The prediction` | both legs at `mirrored == 0`, `restore-MISS (of skipped) == scanned`, `failed == 0`; one `core.warning` per leg containing `restored as a MISS`; `publish-verify` has nothing new to read back; and an explicit clause that `scanned == 0` does NOT satisfy it |
| `## The axis, and why naming it matters` | the three-window table with MECHANISM and AXIS columns, naming window 2's axis as the `@actions/cache` cache VERSION |
| `## Attribution: the PATH, not the flag` | `cacheUtils.js:166` and the exact condition `process.platform === 'win32' && !enableCrossOsArchive`, plus the Windows-only-asymmetry diagnostic |
| `## The version-affecting commits in this phase` | exactly ONE (plan 09-03's), both reasons the merge is load-bearing, the rewrite-this-file instruction for a split, and the bundle-drift look-alike |
| `## The tripwire` | the two-consecutive-pushes gate verbatim, that it stays a `core.warning`, and both rejected alternatives with their reason |
| `## Non-triggers` | five cases, each with what it is instead |
| `## How this record is consumed` | first `main` push after the merge (a `human_needed` item), and the axis-wording match with plan 09-06 |

The prediction is phrased in `writeCountSummary`'s **exact five row labels** (`action/index.ts:162-168`)
so a reader can diff it against the real job summary without translating. Two count semantics that are
easy to get wrong are called out inline: `restore-MISS (of skipped)` is a **breakdown** of `skipped`
rather than an addend (the miss branch increments both), and the message's `entr(y|ies)` count is
**distinct keys after dedup** rather than enumerated rows.

## Mechanism Claims Verified First-Hand

Every upstream and in-repo claim in the record was read at the cited line this session, against the
pinned `@actions/cache` 6.2.0 -- not carried from research prose:

- `cacheUtils.js:157-172` -- `getCacheVersion`. Path components first and unconditional (`:159`),
  compression method pushed **unconditionally** (`:162-163`), `windows-only` pushed **only** under
  `process.platform === 'win32' && !enableCrossOsArchive` (`:166-168`). This is the whole basis for
  "the flag alone rotates only Windows entries" and it is why a path change moves the version on
  every platform.
- `publish-mirror.ts:300-307` -- the warning branch requires `hashes.length > 0 && readMisses ===
  hashes.length && mirrored === 0`, and the substring `restored as a MISS` is present. The
  `hashes.length > 0` guard is what makes the `scanned == 0` non-trigger a structural fact rather than
  a stylistic preference.
- `action/index.ts:162-168` -- the five row labels, verbatim.
- `ci.yml:3-7` -- pushes filtered to `main`. `ci.yml:958-975` -- `publish` is
  `if: ${{ !cancelled() && github.event_name == 'push' }}`, matrix
  `[ubuntu-24.04-arm, windows-11-arm]`, `fail-fast: false`, `max-parallel: 1`. Together these confirm
  first-hand that nothing on this branch and nothing on a PR can consume the prediction early.
- `packages/github-cache/package.json:42` -- `@actions/cache` exact-pinned at `6.2.0`, guarded by
  `pinned-deps.spec.ts:22`.

## Key Decisions

See the frontmatter `decisions` list. The two with the longest reach:

1. **Naming the axis.** Three rotation windows, three different mechanisms, two different axes. A
   tripwire keyed on "all-restore-MISS at publish" sees window 2 directly while windows 1 and 3
   produce a superficially identical symptom through unrelated machinery. The record states the axis so
   D-30's "do not author a tripwire that fires on windows 1 or 3" is enforceable by a human reader.

2. **Recording the bundle-drift look-alike as the most likely misuse of this file.** If a
   `serve()`-reachable edit reaches `main` without the rebuilt `start-cache-server/index.js`, the five
   sidecar sites write at the old cache version while the publish action restores at the new one, and
   the mirror silently stops receiving -- surfacing as *exactly* the predicted warning, on a run where
   it is a **defect**. `action-bundle-drift` catches it, but only after the misleading signal has been
   rationalised as "the rotation OBS-04 told us to expect". The record therefore carries a reading rule:
   an all-MISS is only this event if 09-03's commit is in range **and** the bundle in that commit
   matches a fresh `npm run build:action`.

## Deviations from Plan

### 1. [Scope] The plan-level nine-command battery was NOT run; four of its five claims were verified from git instead

The task's own `<verify>` block asks for two commands and both are green (`format:check` exit 0; the
`git log` ordering check). The plan-level `<verification>` block additionally lists all nine battery
commands. Those were **not** run, deliberately. Three reasons, in order of weight:

1. **`check:action` is a MUTATING check.** It runs `build:action` and then
   `git diff --exit-code -- start-cache-server/index.js`. `node_modules` is **absent** from this
   worktree (`npm run format:check` only worked because Node's resolution walked up into the main
   tree's `node_modules`, the worktree being nested under it). Rebuilding the bundle against
   deps resolved that way is how you manufacture a false drift on a doc-only commit -- which is the
   precise hazard D-26 cites from Phase 7's Q10, where a lockfile re-resolution drifted the bundle by
   88 lines with no source edit. Running it would risk dirtying the worktree with a bundle change this
   plan has no business making.
2. **Junctioning `node_modules` would race sibling wave-1 agents.** Per `AGENTS.md`, worktrees
   junctioned to one `node_modules` race on `node_modules/.vite` (Vitest's cache dir) during test runs.
   Other wave-1 agents may be mid-`test`. Risking a spurious red in a sibling agent's run to
   re-verify an unchanged markdown file is a bad trade.
3. **This commit cannot affect any of the nine.** It touches one file under `.planning/`, which is
   prettier-ignored (`.prettierignore`: `.planning/`) and is not an input to any Nx target. The battery's
   result at `e7018d0` is definitionally the result at the wave base `4296d1d`, which the orchestrator
   already validated.

The other four `<verification>` items were verified directly from git history, which for a doc-only
commit is a **stronger** claim than a rebuild -- it shows the bytes are identical to the parent rather
than merely reproducible:

- exactly one file in the diff, under `.planning/`;
- `cache-archive-path.ts`, `actions-cache-backend.ts`, `publish-mirror.ts` and
  `start-cache-server/index.js` all absent from the commit's file list (the bundle's last touch is
  `db577db`, Phase 7);
- no deletions (`git diff --diff-filter=D HEAD~1 HEAD` empty).

**Recommended follow-up:** the phase verifier should run the nine-command battery once post-merge on
the main tree, where `node_modules` legitimately lives and `check:action` is a meaningful, non-racing
check. Nothing in this plan needs it to pass to be correct, but the phase as a whole does.

No other deviations. No Rule 1/2/4 issues arose -- the plan is a single documentation task with a fully
specified content contract.

## Verification

| Check | Result |
|---|---|
| `npm run format:check` | **exit 0** |
| `git log --oneline -1 -- packages/github-cache/src/lib/cache-archive-path.ts` | `263b512` -- **predates** this plan's commit `e7018d0`, so the rotation has not happened yet and the record is genuinely in advance |
| all seven required section headings present, exact names | yes, plus the `## Method` header block |
| header block carries capture date, authoring SHA, `@actions/cache` 6.2.0 | yes (`2026-07-28`, `4296d1d`, `6.2.0`) |
| `git diff HEAD~1 HEAD --name-only` | exactly `.planning/.../09-ROTATION-SIGNAL.md` |
| protected files in commit (`cache-archive-path.ts`, `actions-cache-backend.ts`, `publish-mirror.ts`, `start-cache-server/index.js`) | none |
| deletions in commit | none |
| non-ASCII characters in the record | none (`rg` found zero matching lines) |

### The ordering control

T-09-07 (a prediction written after the fact) is mitigated by history, not by assertion:

```
263b512  fix(backend): move the per-hash lock ...   <- last touch of cache-archive-path.ts
4296d1d  docs(09): close decision traceability ...  <- wave base, authoring commit
e7018d0  docs(09-02): record the expected rotation signal in advance   <- THIS
```

`git log <base>..<head> -- packages/github-cache/src/lib/cache-archive-path.ts` must stay **empty**
through wave 1. It is empty at `e7018d0`. Plan 09-03's commit will be a descendant of this one, which
is what makes "recorded in advance" checkable.

## Known Stubs

None. The record is complete against its acceptance criteria; no placeholder, no TODO, no deferred
section.

## Threat Flags

None. This plan added no network endpoint, no auth path, no file-access pattern and no schema. The
record carries a commit SHA, runner labels, upstream file citations and count names -- no tokens, no
host paths, no `gh api` output (T-09-12, disposition `accept`; the snapshot with real repository data
is plan 09-07's artifact, not this one).

## Commits

| Commit | Message |
|---|---|
| `e7018d0` | `docs(09-02): record the expected rotation signal in advance` |

## Self-Check: PASSED

- `.planning/phases/09-os-invariant-actions-cache-version/09-ROTATION-SIGNAL.md` -- FOUND
- commit `e7018d0` -- FOUND in `git log`
