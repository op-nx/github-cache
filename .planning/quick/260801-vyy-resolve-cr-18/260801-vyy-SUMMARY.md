---
phase: quick-260801-vyy
plan: 01
subsystem: ci
status: complete
tags: [ci, cross-os, actions-cache, guard, code-review-fix]
requirements: [CR-18]
dependency_graph:
  requires: []
  provides:
    - pre-merge cross-OS Actions-cache reuse signal on same-repo pull requests
    - disk-pinned two-clause dogfood trigger (mutation-proven per job)
  affects:
    - .github/workflows/ci.yml
    - packages/github-cache/src/dogfood-cross-os.spec.ts
tech_stack:
  added: []
  patterns:
    - single-line job-level `if:` pinned by a four-space-anchored `^ {4}if: ...$` regex
    - per-job independent mutation proof for a newly added guard
key_files:
  created: []
  modified:
    - .github/workflows/ci.yml
    - packages/github-cache/src/dogfood-cross-os.spec.ts
    - packages/github-cache/src/action/index.spec.ts
decisions:
  - "GA-1: close CR-18 by un-push-gating the dogfood pair, NOT by gating the three Windows legs' counts (launderable by a re-run)."
  - "GA-2: same-repo PRs only; fork PRs stay on the push path and the exclusion is named in the comment."
  - "GA-3: the three legs' counts stay RECORDED and UNGATED -- only the written reason changed."
  - "GA-4: the new trigger is pinned from disk with both halves of the disjunction matched."
metrics:
  duration: ~70 min (including the review round)
  tasks: 3
  files: 3
  tests_before: 940
  tests_after: 943
  completed: 2026-08-02
commits:
  - fee5fbe -- the CR-18 change
  - 70fd31c -- the code-review round (1 CRITICAL + 6 WARNING + 2 INFO)
---

# Quick Task 260801-vyy: Resolve CR-18 Summary

Un-push-gated the `dogfood-seed` / `dogfood-verify` cross-OS proof so it runs on same-repo pull
requests, pinned the new two-clause trigger from disk with a mutation-proven spec clause, and
corrected the eight stale prose sites that claimed otherwise -- all in one commit.

**Commits:**

| SHA | Subject | Files |
|-----|---------|-------|
| `fee5fbe` | `ci(12): run the cross-OS dogfood proof on same-repo pull requests` | 2 changed, +123/-30 |
| `70fd31c` | `ci(12): close the review findings on the CR-18 dogfood widening` | 3 changed, +138/-52 |

Code review of `fee5fbe` returned 1 CRITICAL, 6 WARNING, 3 INFO with verification passing 6/6 --
the mechanism was right, the prose was not. `70fd31c` closes the CRITICAL, all six warnings and two
of the three infos. See "Code review round" below.

## What Changed

### `.github/workflows/ci.yml`

1. **The trigger.** Both dogfood jobs now carry, on ONE line, four-space indented:
   `if: github.event_name == 'push' || github.event.pull_request.head.repo.full_name == github.repository`.
   Exactly two job-level `if:` lines changed; `consumer-smoke` (:1790) and `publish-verify` (:2146)
   keep their bare push gates, and `publish` (:1925) keeps its `!cancelled() && push` form.
2. **The dogfood header block.** Replaced the false "both jobs run ONLY on the default-branch push
   trigger, because the write gate trusts no other trigger" with the accurate account: PRs are
   write-trusted via `HOST_GATED_EVENTS`, the entry lands in the PR's own merge-ref scope and ages
   out on the 7-day-unaccessed timer, and fork PRs are deliberately excluded.
3. **The three legs' "no signal anywhere" sentence** (build/typecheck/test-windows, 3 verbatim
   copies). The surviving true argument now stands on its own: `dogfood-verify` drives a DIRECT
   scripted PUT/GET on a run-scoped key and never observes whether a real Nx task got a remote HIT,
   and it is skipped entirely on a fork PR -- so these per-target records are the only runtime
   observation of that.
4. **The OBS-04 misattribution** (3 verbatim copies). "RECORDED, never GATED" and the `|| true`
   note kept; the justification replaced with the laundering argument, plus the clause noting
   `needs:` makes these legs intra-run so the cross-run argument never applied.
5. **The `publish-verify` cross-reference** (an eighth site RESEARCH's sweep of seven did not find).
   Narrowed from "Mirrors the dogfood-verify shape: push-gated, needs the producer" to the two
   respects that still hold, with the trigger difference stated explicitly.

### `packages/github-cache/src/dogfood-cross-os.spec.ts`

1. **The new pin** -- one `it` added to the existing `ci.yml dogfood cross-OS sampling (VER-06)`
   describe, inheriting its positive control and `jobBlock`'s throw-on-absent-job guard. One
   whole-line regex per job, anchored at four spaces under `/m`, matching BOTH halves of the
   disjunction. Self-contained reason string (no `RENAME_NOTE`, matching the sibling seed clause).
2. **The `cacheObservation` reason string** -- both wrong sentences replaced; subject (the RECORD
   existing, never its VALUE) and the trailing `${RENAME_NOTE}` preserved.
3. **The `action-bundle-drift` prose** -- both halves narrowed to OBS-04 alone with a note that
   VER-06 became PR-observable in this commit. The doc comment and the LIVE assertion message were
   located and edited separately, as the plan required. `.not.toMatch(/^ {4}if:/m)` untouched.

## Verification

### Mutation proofs -- round 1, `fee5fbe` (both mandatory, both observed)

| # | Mutation | Result |
|---|----------|--------|
| 1 | `dogfood-seed`'s `if:` reverted to `if: github.event_name == 'push'`, alone | **RED** -- `x both dogfood jobs are SCHEDULED on same-repo pull requests, not push-only (CR-18)`, `1 failed \| 940 passed (941)`, full reason string printed |
| 2 | `dogfood-verify`'s `if:` reverted, alone | **RED** -- same clause, same failure output, `1 failed \| 940 passed (941)` |

Both runs used `--skip-nx-cache`. After each restore the file's sha256 returned to
`113a36a70a514f2127626b186b472a10ffd63c1461f40c12dbe397638ecd0433` -- byte-identical, no residue --
and the suite went back to 941 green.

### Mutation proofs -- round 2, `70fd31c` (the two new clauses)

| # | Mutation | Result |
|---|----------|--------|
| A | ` && false` appended as a continuation under `dogfood-seed`'s `if:` | **RED** on `the dogfood if: is a COMPLETE scalar`; the round-1 trigger clause stayed **GREEN** -- the false-green reproduced exactly. `1 failed \| 942 passed (943)` |
| B | ` \|\| github.event.pull_request.head.repo.fork` appended as a continuation under `dogfood-verify`'s `if:` | **RED** on the same clause, trigger clause again GREEN. `1 failed \| 942 passed (943)` |
| C | `pull_request:` deleted from `ci.yml`'s `on:` block | **RED** on `ci.yml is pull_request-triggered at all`; both trigger clauses stayed GREEN. `1 failed \| 942 passed (943)` |

Each mutation reddened exactly one clause and left the other two green -- the per-clause
discrimination this file's house style requires. All three restores returned ci.yml to sha256
`f9f3491574551bebfbb868d0159ff133ee6043dc4339bc7c6a53205501949fa0`, byte-identical, no residue.

That A and B leave the round-1 clause GREEN is the whole point: it is direct evidence the original
pin could not see the drift, not an inference from reading the regex.

### Battery (main tree, no worktree) -- at `70fd31c`

| Check | Result |
|-------|--------|
| `npx nx run-many -t test typecheck lint --skip-nx-cache` | green, **943 tests** (940 + 3), 42 files |
| `npx nx format:check` | green; the widened `if:` survived at 2 occurrences, still one line |
| `npm run check:action` | exit 0, empty diff -- no bundle drift |
| non-ASCII sweep over all three files | exit 1, clean |
| working tree after commit | clean apart from the untracked `.planning/quick/260801-vyy-resolve-cr-18/` |

### Negative-grep acceptance criteria

| Needle | Scope | Baseline | After |
|--------|-------|----------|-------|
| `push-gated` | ci.yml | 7 | **3** (:209, :1034, :1254 -- all say some OTHER job is NOT push-gated) |
| `lesson` | ci.yml | 3 | **0** |
| `evicts` (case-insensitive) | ci.yml | 0 | **0** -- no eviction claim planted |
| `push-gated` | spec | 1 | **0** |
| `lesson` | spec | 1 | **0** |
| `unobservable pre-merge` | spec | 1 | **0** |
| `unobservable before a merge` | spec | 1 | **0** |
| `not.toMatch(/^ {4}if:/m)` | spec | 4 | **4** (unchanged) |

Every zero was taken with a positive control on the same command form, per the plan's own warning
that a zero-hit search is not evidence of absence.

## Code Review Round (`70fd31c`)

Every finding was re-verified in-tree before editing; none was taken on the reviewer's word.

### CRITICAL-01 -- the replacement sentence was FALSE (3 ci.yml copies + 1 live assertion message)

`fee5fbe` wrote "the dogfood canary would not catch it either" of an `@actions/cache` bump that
breaks cross-OS restore. **That bump is precisely what the canary catches.** Confirmed against three
in-tree sources: `action/index.ts:431` (the verify branch's own 404 text names "a pinned
@actions/cache upgrade that changed the archive version hash"), the dogfood header block calling the
pair the ROBUST-03 upgrade canary, and `ci.yml:544` -- eight lines below the false sentence -- saying
"the dogfood-verify canary IS the gate".

The original sentence was a **timing** claim (true while dogfood was push-gated); my edit converted
it into a **coverage denial**, which is false and made the commit's own motivation incoherent. This
is the ironic failure mode: the task exists to delete false comments and shipped a new one, in the
same class as the three prior corrections on this branch. Narrowed to the true claim -- the canary
DOES catch the bump, but on a run-scoped scripted PUT/GET, so it never observes whether a REAL Nx
task got a remote HIT, which is what these per-target records are for.

### WR-01 -- the new pin FALSE-GREENED on a YAML continuation

The anchor ends `\s*$`, and `$` under `/m` matches at the end of ANY line, so the engine satisfies it
with zero width at the end of the pinned line and never inspects what follows. YAML folds a
more-indented following line into the plain scalar. Reproduced with a node probe against the exact
regex: `&& false`, `|| ...head.repo.fork`, and a blank line before either -- all three passed.

Fixed with a companion clause asserting **the next line is a job key** (`/^ {4}if: .*\n {0,4}\S/m`),
in the positive form rather than a `&&`/`||` token check, because the positive form also rejects a
blank line and any continuation whatever it starts with. Same defect class as CR-12.

### WR-02 -- the pin could not see its own precondition

Deleting `pull_request:` from `ci.yml`'s `on:` block reopens CR-18 in full -- and disables every
other PR-eligible gate -- with both `if:` lines byte-identical and every clause in the tree green.
Verified nothing in the repo asserted that block, with a working positive control
(`cleanup-workflow.spec.ts:54` and `windows-regression-detector.spec.ts:96` both pin their OWN
workflow's triggers, so the idiom exists and this was a real gap). Added, scoped to the `on:` block
by an alternation that consumes only indented lines and therefore cannot run past the next top-level
key.

### WR-03 to WR-06 -- five more stale sites, all made stale by `fee5fbe` itself

| # | Site | Was |
|---|------|-----|
| WR-03 | `ci.yml` dogfood-seed timeout comment, six lines below the edited `if:` | called it push-only background work "nobody watches the way a PR author watches a check" |
| WR-04 | `action/index.spec.ts:78`, `:471` | called the Windows verify leg push-gated and unobservable pre-merge |
| WR-05 | `ci.yml:209`, `:1255`, `:1540` | "carries that gate because it WRITES (**seeds a cache entry**, ...)" cited dogfood-seed, which stopped carrying it |
| WR-06 | `ci.yml` concurrency rationale | enumerated only push runs as performing the seed PUT; PR runs now PUT and are the cancellable ones |

WR-04's `:78` is the stated justification for a `vi.mock`, so it was checked on its own terms before
rewording: the mock stays warranted (the leg is still skipped on fork PRs, it is a CI job rather than
a machine-independent spec check, and a live job sampling the property elsewhere is not a reason to
sample it at zero here). It was reworded, not deleted.

**WR-05 reverses a plan hard-constraint, deliberately.** The plan said not to touch `ci.yml:1497-1498`
/ `:1212-1213` (today `:1540` / `:1255`) because their imprecision about `publish-verify` was
pre-existing and out of CR-18's scope. That held until `fee5fbe` removed the gate from
`dogfood-seed` -- the exemplar those very sentences cite. The change made them stale, so they came
into scope, and the coordinator listed WR-05 for fixing. Both halves are now correct, including the
pre-existing `publish-verify` read-only case.

### INFO

- **IN-01 (done):** the pin's "prettier is MEASURED not to rewrap" asserted an unverifiable property
  of an external tool. Qualified -- measured against the pinned version, fix the pin rather than
  delete it if a bump rewraps.
- **IN-02 (done):** "repopulates the entry **seconds** earlier in the SAME run" -- those ubuntu
  producers are multi-minute jobs. Dropped the number; the intra-run argument is unaffected.
- **IN-03 (NOT done, flagged):** the rationale blocks are now 14 lines x 3 and 11 lines x 3,
  verbatim, so the next correction has a 3x blast radius -- and this task is itself the evidence that
  N-copy prose drifts partially. The reviewer's fix is to keep the full text on `build-windows` and
  reduce the other two to a "see build-windows above" pointer, which the file already does for the
  sidecar block. Left undone because it is a structural refactor rather than a correctness fix and
  was outside the coordinator's list. **Recommend taking it** -- it is a net deletion.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 1 - Bug] The first `action-bundle-drift` rewrite reintroduced the banned literal.**
- **Found during:** Task 2 verification.
- **Issue:** Splitting the assertion message differently moved `unobservable before a merge` onto a
  single line, so the phrase the criterion forbids was present again -- caught only because the
  negative grep was actually run rather than assumed from the intent of the edit.
- **Fix:** reworded to `unobserved until a merge lands`.
- **Commit:** `fee5fbe`.

**2. [Rule 3 - Blocking] Prettier rejected one string's quote style.**
- **Found during:** Task 3 battery.
- **Issue:** `format:check` flagged the spec: one fragment of the new reason string was
  double-quoted but contains neither quote character, and this repo's `singleQuote: true` config
  prefers single quotes there.
- **Fix:** switched that one fragment to single quotes. `format:check` green.
- **Commit:** `fee5fbe`. Recurred once in `70fd31c` on a double-quoted `it()` title containing only
  backticks; resolved by running `npx prettier --write` on that one file and diffing to confirm the
  quote character was the only change.

### Plan defects found (verify-command only, not the acceptance criteria)

Both of the plan's `<automated>` one-liners would have passed VACUOUSLY. Neither affects the
criteria themselves, all of which were checked by hand and are recorded above.

1. **MSYS path-conversion false-zero on the slash-bearing needle.** In Git Bash,
   `git grep -c -F 'not.toMatch(/^ {4}if:/m)'` returns ZERO with exit 1 even though the literal is
   present at four sites -- MSYS rewrites the trailing `/^ {4}if:/m)` fragment as a path before git
   sees it. Running the identical command under `MSYS2_ARG_CONV_EXCL='*'` returns 4. This is the
   same class of trap as the repo's recorded `rg` leading-slash false-zero. Any needle containing
   `/.../` needs that env var. (The plan's guard was `!= "0"`, so the empty result would have
   satisfied it regardless.)
2. **`git grep -c` prints `path:count`, not a bare count.** So `[ "$(git grep -c -F 'push-gated' -- .github/workflows/ci.yml)" = "3" ]`
   compares `.github/workflows/ci.yml:3` against `3` and is never true. Checked by reading the
   printed value instead.

### Structural note

The plan's Task 3 specifies a SINGLE commit covering both files, and its success criteria repeat it
("One commit"). That was followed rather than the generic per-task commit rule, because the plan's
own verification requires every claim contradicting the new behaviour to be corrected in the SAME
commit -- a ci.yml-only first commit would have left the spec shipping the stale assertion message.

Per instruction, the end-of-plan GSD `state.*` handlers were NOT invoked, ROADMAP.md was not
touched, and no docs artifact (this SUMMARY, STATE.md, PLAN/CONTEXT/RESEARCH) was staged or
committed.

## Nothing Forbidden Moved

- The three Windows legs' `[remote cache]` counts are still RECORDED and UNGATED (GA-1/GA-3).
- `dogfood-seed` is still single-leg ubuntu-only; the spec's vacuity clause is untouched.
- `nx.json` untouched.
- `action-bundle-drift` still carries `.not.toMatch(/^ {4}if:/m)` verbatim and still has no `if:`.
- No eviction-at-PR-close claim written anywhere.
- No fork-PR widening; no `${{ }}` wrapper added to the new bare `github.`-leading `if:`.
- `ci.yml:1497-1498` and `:1212-1213` left alone as instructed.

## Self-Check: PASSED

- `.github/workflows/ci.yml` -- FOUND, modified, sha256 `f9f34915...` at `70fd31c`
- `packages/github-cache/src/dogfood-cross-os.spec.ts` -- FOUND, modified
- `packages/github-cache/src/action/index.spec.ts` -- FOUND, modified in `70fd31c`
- Commit `fee5fbe` -- FOUND in `git log`, 2 files, authored with `git commit -F`
- Commit `70fd31c` -- FOUND in `git log`, 3 files, authored with `git commit -F`
- Working tree clean apart from the untracked planning directory
