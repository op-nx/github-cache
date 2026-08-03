---
phase: 260803-fcd
plan: 01
subsystem: publish/retention
tags: [immutable-releases, fault-discrimination, tag-rename, tdd, mutation-proof]
status: complete
requires:
  - packages/github-cache/src/lib/octokit-fault-reason.ts (faultReason, commit 8dc0131)
  - packages/github-cache/src/lib/retention.ts (SHARD_TAG_PREFIX one-home rule)
provides:
  - faultMessageForField(error, field) -- field-scoped 422 body reader
  - ensureShardRelease returning `number | undefined` (undefined = shard skipped)
  - SHARD_TAG_PREFIX = 'nx-cache-' (month shards are nx-cache-YYYYMM)
affects:
  - start-cache-server/index.js (regenerated bundle)
  - docs/advanced.md (consumer-facing statement of the shard scheme)
tech-stack:
  added: []
  patterns:
    - field-scoped fault-body accessor instead of a first-message substring test
    - one-shot sentinel for a permanent whole-shard failure inside a per-item loop
    - mutation proof for guards that are not naturally RED
    - fixture rebase as the fix for silent test vacuity under a rename
key-files:
  created: []
  modified:
    - packages/github-cache/src/lib/octokit-fault-reason.ts
    - packages/github-cache/src/publish/publish-mirror.ts
    - packages/github-cache/src/publish/publish-mirror.spec.ts
    - packages/github-cache/src/lib/retention.ts
    - packages/github-cache/src/lib/retention.spec.ts
    - packages/github-cache/src/cleanup/cleanup.ts
    - packages/github-cache/src/cleanup/cleanup.spec.ts
    - packages/github-cache/src/backend/releases-backend.spec.ts
    - packages/github-cache/src/roundtrip/read-back.ts
    - packages/github-cache/src/roundtrip/read-back.spec.ts
    - docs/advanced.md
    - start-cache-server/index.js
decisions:
  - "A burned tag name is a non-fatal skip; every other 422 stays fatal"
  - "The guard reads the tag_name-scoped entry, not faultReason().message (which returns the pre_receive decoy)"
  - "The fatal log also prefers the tag_name entry -- taken deliberately, tested by A3"
  - "One-shot sentinel: one createRelease and one warning per leg, not per hash"
  - "Class 1 prose rewritten, Class 2 measurement records kept verbatim with an inline marker"
  - "isShardTag is NOT widened for legacy shards -- hand-delete instead (D6)"
metrics:
  commits: 2
  tasks_completed: 3
  tests_total: 1011
  test_files: 42
  completed: 2026-08-03
---

# Quick Task 260803-fcd: burned-name skip, then the nx-cache namespace - Summary

Two commits in the load-bearing order: a burned month-shard tag now makes the publish leg
skip loudly and exit 0 (Phase A), and only then does `SHARD_TAG_PREFIX` move to `nx-cache-`
(Phase B) -- because `cache-mirror-202608` is burned right now, so Phase A had a live
subject exactly once.

## Commits

| Phase | SHA | Subject |
|---|---|---|
| A | `1e5bc10` | `fix(publish): skip a burned month-shard tag instead of failing the run` |
| B | `a1d6139` | `refactor(retention): rename the month-shard tag prefix to nx-cache-` |

`git log --oneline -2` shows B then A, in that order, and the working tree is clean apart
from this untracked planning directory.

## Phase A -- what shipped

1. **`faultMessageForField(error, field)`** in `lib/octokit-fault-reason.ts`: the message of
   the first `errors[]` entry scoped to a field, `undefined` on anything unreadable. No
   publisher-specific predicate in the lib leaf -- one call site composes its own substring
   test.
2. **`ensureShardRelease` returns `number | undefined`** and takes a burned-name branch after
   the `already_exists` branch and before the fatal throw. Predicate: 422 AND a `tag_name`
   entry whose message includes `immutable release`.
3. **The fatal `core.error` now prints `faultMessageForField(error, 'tag_name') ?? reason.message`.**
   Taken deliberately (RESEARCH Open Question 1), not folded in silently, and A3 is its test.
4. **One-shot `burnedShardTag` sentinel** at the lazy resolve: one `createRelease` and one
   `core.warning` for the whole leg.
5. Run 30773689490's measurement record in the doc block was **extended, not rewritten**.

### RED (actual output, `npx nx test github-cache --skip-nx-cache -- src/publish/publish-mirror.spec.ts`)

`2 failed | 43 passed (45)`:

```
x SKIPS the whole shard ONCE when createRelease reports the tag name was burned by an
  immutable release
  Error: github-cache test: octokit fault (status 422)
    at ensureShardRelease src/publish/publish-mirror.ts:142:34
    at Module.publishMirror src/publish/publish-mirror.ts:345:18

x FAILS CLOSED when the tag_name entry is reworded past the substring, and the fatal log
  names THAT entry not the decoy
  AssertionError: expected 'github-cache: createRelease cache-mir...' to contain
  'tag_name is reserved'
  + github-cache: createRelease cache-mirror-202608 was rejected (status 422, code custom,
  + message pre_receive Repository rule violations found
  +
  + Cannot create ref due to creations being restricted.
```

That second failure is the **Q1.4 defect measured rather than argued**: the fatal log really
did print the `pre_receive` decoy for the tag-name failure it exists to diagnose.

A2 (the decoy-only 422) passed on first run, as predicted -- the old code already threw on
every non-`already_exists` 422 -- so it was an unproven guard until the mutation below.

### GREEN

`45 passed (45)` in `publish-mirror.spec.ts`; full suite `42 files / 1011 tests passed`;
typecheck + lint green; `check:action` clean (Phase A does **not** drift the bundle -- neither
edited file is `serve()`-reachable, verified rather than assumed).

### Mutation proof (A2 + A3)

Predicate replaced with the status-only reading `statusOf(error) === 422` -- the historical
defect class this project keeps hitting. `11 failed | 34 passed (45)`, including both target
clauses:

```
x still FAILS the run on a 422 carrying ONLY the pre_receive ruleset entry -- the decoy is
  not a burned name
  AssertionError: promise resolved "{ scanned: 1, mirrored: +0, ...(3) }" instead of rejecting
x FAILS CLOSED when the tag_name entry is reworded past the substring, and the fatal log
  names THAT entry not the decoy
  AssertionError: promise resolved "{ scanned: 1, mirrored: +0, ...(3) }" instead of rejecting
```

plus the nine pre-existing fail-closed frontier clauses. Restored file's `git hash-object`
matched its pre-mutation SHA `f48645f66e8e9117e5f87254a44b6164ed343f0e` exactly.

## Phase B -- what shipped

One source literal (`retention.ts`), its dependent pins, both vacuity traps, 14 prose sites
split into two classes, and the regenerated bundle -- all in the single commit `a1d6139`.

### RED after the literal change

`npx nx test github-cache --skip-nx-cache` -> `21 failed | 990 passed (1011)`:

```
x retention.spec.ts > is exactly cache-mirror-202607 for a July 2026 date
  expected 'nx-cache-202607' to be 'cache-mirror-202607'
x retention.spec.ts > derives from the single-sourced SHARD_TAG_PREFIX
  expected 'nx-cache-' to be 'cache-mirror-'
x retention.spec.ts > accepts the genuine month shard cache-mirror-202607
  expected false to be true
x retention.spec.ts > returns exactly the current month for a single-day mid-month window
  expected [ 'nx-cache-202607' ] to deeply equal [ 'cache-mirror-202607' ]
x releases-backend.spec.ts > walks to the prior shard when the newest shard 404s
  expected 'https://api.github.com/repos/op-nx/gi...' to contain
  'releases/tags/cache-mirror-202607'
x cleanup.spec.ts > prunes an expired created_at and retains a within-window one
  expected "vi.fn()" to be called 1 times, but got 0 times
x cleanup.spec.ts > aborts with ZERO deletions when listAllAssets throws mid-pagination
  promise resolved "{ pruned: +0, failed: +0, scanned: +0 }" instead of rejecting
```

Literals were rebased as string LITERALS, never derived from the constant under test, and the
non-home spec files were **not** converted to `shardTag()` calls (that refactor stays out).

### VACUITY -- the half that did not announce itself

Both trap blocks stayed **fully GREEN** through that 21-failure run while their coverage
evaporated. That is the confirmation the research predicted, observed:

1. `retention.spec.ts` non-shard REJECT list -- every fixture would be rejected on a PREFIX
   mismatch instead of the `\d{6}` suffix check it exists to test. `v1.0.0` left alone: it is
   the foreign-tag case and a prefix mismatch IS its rejection.
2. `cleanup.spec.ts` "skips a non-shard release entirely (exact isShardTag, not a loose
   prefix)" -- identical failure, and its own comment names what it guards.

Fixed by rebasing the fixtures, then proven by mutation. Dropping the suffix check
(`new RegExp('^' + SHARD_TAG_PREFIX)`) reddens BOTH blocks -- `9 failed | 39 passed (48)`:

```
x rejects the non-shard tag nx-cache-
x rejects the non-shard tag nx-cache-2026
x rejects the non-shard tag nx-cache-20260
x rejects the non-shard tag nx-cache-2026070
x rejects the non-shard tag nx-cache-latest
x rejects the non-shard tag nx-cache-backup
x rejects the non-shard tag nx-cache-2026-07
x derives from the single-sourced SHARD_TAG_PREFIX (one home for the scheme)
x cleanup.spec.ts > skips a non-shard nx-cache-* release entirely (exact isShardTag, not a
  loose prefix)
  AssertionError: expected "vi.fn()" to not be called at all, but actually been called 2 times
```

`v1.0.0` correctly stayed green under the mutation. Restored `retention.ts` `git hash-object`
matched `1f2b6566f0303a51fe72df5076b28e2dc8acc249` exactly. Both blocks now carry a comment
saying the fixtures must move with the prefix, so the next rename cannot re-open the trap
silently.

### Prose, two classes

- **Class 1 (rewritten, now-false claims):** `retention.ts`'s comment-locked header, the
  `shardTag` / `SHARD_TAG_PATTERN` / `isShardTag` docs and examples; `cleanup.ts`'s two
  LIST-phase sentences; `cleanup.spec.ts`'s scope comments and **two test names**;
  `retention.spec.ts`'s two one-home comments; `releases-backend.spec.ts`'s pinned-window
  narrative; `docs/advanced.md`'s two consumer-facing statements (only the tag literal moved,
  so `docs-same-os-claims.spec.ts`'s required phrases stay byte-identical).
- **Class 2 (verbatim + inline marker):** run 30773689490's probe evidence in
  `publish-mirror.ts`; the measured month-boundary 404 and the two 122-asset pagination
  justifications in `read-back.ts`; that shard's empty-label census in `read-back.spec.ts`;
  its 122-asset census in `cleanup.spec.ts`. Renaming these would claim a measurement was
  taken against a tag that never existed.
- One line next to `isShardTag` records why `cleanup.ts`'s same-commit-widening precedent does
  **not** apply to this tag rename (single hand-deleted shard, no adopters, tag not in the
  consumer contract).

### Bundle

`retention.ts` is `serve()`-reachable via `releases-backend.ts`, and the bundle preserves the
derivation, so the one literal plus `npm run build:action` fully updated it.
`start-cache-server/index.js:68503` now reads `var SHARD_TAG_PREFIX = "nx-cache-";`.
`npm run check:action` passes from the MAIN TREE, both pre-commit (staged) and against the
committed state.

### Residual sweep result

Run as a real pass/fail comparison against the expected survivor table, not a bare
`git grep -c` (which exits 0 on any match and is an eyeball, not a gate):

```
per-file line counts:
  1  packages/github-cache/src/cleanup/cleanup.spec.ts
  1  packages/github-cache/src/publish/publish-mirror.ts
  1  packages/github-cache/src/roundtrip/read-back.spec.ts
  3  packages/github-cache/src/roundtrip/read-back.ts
bundle rg exit: 1 (1 = no match, required)

RESIDUAL SWEEP PASS: survivors match the expected table exactly.
```

Matches the planned table exactly: no unexpected file (so no Class 1 claim was missed) and no
inflated count (so no marker introduced a new line carrying the old literal).
`CACHE_MIRROR_MAX_AGE_DAYS` / `CACHE_MIRROR_ALLOW_AGGRESSIVE_RETENTION` were left untouched
per D3, and `git grep` is case-sensitive so they never entered this lowercase sweep.

**The gate was proven non-vacuous.** Run against a needle with a known different
distribution it reports `UNEXPECTED FILE`, `COUNT DRIFT`, `MISSING RECORD` and `BUNDLE STALE`,
and exits 1.

## Verification

| Check | Result |
|---|---|
| `npx nx test github-cache --skip-nx-cache` | 42 files, **1011 tests passed** |
| `npx nx run-many -t typecheck lint --projects=github-cache --skip-nx-cache` | green -- both `typecheck` and `lint` target lines printed and ran (asserted on the printed lines, not the exit code, because `nx run-many` on a MISSING target exits 0) |
| `npm run check:action` (main tree) | exit 0, committed state |
| Mutation proofs | 2, each with a matching `git hash-object` SHA before and after restore |
| Residual sweep | PASS, with a negative control proving the gate fires |
| `git log --oneline -2` | `a1d6139` (Phase B) then `1e5bc10` (Phase A) |

Every verification run used `--skip-nx-cache`, so no cached PASS stood in for a fresh one.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The plan's `--skip-nx-cache` placement is rejected by vitest**

- **Found during:** Task 1, the very first RED run.
- **Issue:** The plan and RESEARCH both write
  `npx nx test github-cache -- src/publish/publish-mirror.spec.ts --skip-nx-cache`. Everything
  after `--` is forwarded to vitest, which rejects the flag outright:
  `CACError: Unknown option --skipNxCache` (exit non-zero, no tests run). The flag never
  reached Nx, so the mutation runs would have been unrunnable in that form.
- **Fix:** `--skip-nx-cache` goes BEFORE the `--`:
  `npx nx test github-cache --skip-nx-cache -- src/publish/publish-mirror.spec.ts`. Confirmed
  by the run banner reporting `Cache: Skipped (--skip-nx-cache)`.
- **Files modified:** none (invocation only).
- **Worth recording** because every mutation proof in this plan depends on the cache actually
  being skipped, and the broken form fails loudly rather than silently -- but a reader copying
  the plan's command verbatim will hit it again.

**2. [Rule 2 - Missing coverage] Test NAMES carrying the old tag (plan-checker W4)**

- `retention.spec.ts` had the old tag baked into an `it(...)` name string rather than a `%s`
  template, and `cleanup.spec.ts` had two more. Task 2's rebase list named only assertion
  literals. All three updated in the same commit rather than left for the residual gate to
  catch on a later cycle.

**3. [Rule 2 - Missing coverage] The residual sweep was not a gate (plan-checker W3)**

- The planned `git grep -c -F ... && rg -c ...` exits 0 whenever ANY match exists, so it could
  only ever be eyeballed. Replaced with a scratchpad script that compares actual per-file
  counts against the expected table and exits non-zero on an unexpected file, a count drift, a
  missing record, a stale bundle, a `git grep` invocation failure (exit > 1), or a zero-match
  positive-control failure. Then proven to fire.

**4. [Rule 2 - Missing coverage] Anti-recurrence comments on both trap blocks**

- Both rebased fixture blocks now state that the fixtures must move with the prefix and why a
  stale-prefix fixture is silently vacuous. Without this the next rename re-opens exactly the
  trap this task spent a mutation proving.

No architectural changes were needed, and nothing was deferred.

## Handover -- what the orchestrator still owns

- **Window A (D5) expects `publish` GREEN with the skip warning and `publish-verify` RED.**
  That combination is CORRECT, not a partial failure: if publish skips the burned shard then
  nothing is mirrored, so the read-back has nothing to find. Window A proves the skip fires;
  it cannot prove a green milestone. The skip emits exactly one `core.warning` naming the tag,
  status 422, and GitHub's own `tag_name`-entry message.
- **Window B (D5) expects a fresh `nx-cache-202608` shard and BOTH legs green.**
- **Phase C (D6) -- deleting the legacy `cache-mirror-202607` release and its 155 assets --
  was NOT touched** and must wait for Window B green.
- Two follow-ups noted, neither a blocker: after Phase C, `read-back.ts` and
  `read-back.spec.ts` describe that shard as "live", which stops being true; and the
  `immutable-releases` settings endpoints (`GET/PUT/DELETE /repos/{o}/{r}/immutable-releases`)
  found during research would turn the standing "anyone re-enabling the setting silently kills
  the mirror" exposure into a single-GET tripwire.

## Self-Check: PASSED

All 12 modified files exist on disk; both commit SHAs (`1e5bc10`, `a1d6139`) resolve in
`git log`; the working tree is clean apart from this untracked planning directory.
