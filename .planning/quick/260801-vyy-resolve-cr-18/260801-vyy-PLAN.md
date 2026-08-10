---
phase: quick-260801-vyy
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .github/workflows/ci.yml
  - packages/github-cache/src/dogfood-cross-os.spec.ts
autonomous: true
requirements: [CR-18]

must_haves:
  truths:
    - 'On a same-repo pull request, dogfood-seed and dogfood-verify are SCHEDULED (not skipped), so cross-OS Actions-cache restore is proven BEFORE merge -- closing the CR-18 signal gap.'
    - 'On a fork pull request both jobs skip cleanly; merged code still gets the proof via the push path (GA-2).'
    - 'The two-clause trigger is pinned from disk: reverting either dogfood job to push-only reddens dogfood-cross-os.spec.ts (GA-4).'
    - 'No comment or assertion message in either edited file still claims dogfood-verify is push-gated, that VER-06 is unobservable pre-merge, or that the Windows legs stay ungated because of OBS-04.'
    - 'The three Windows legs [remote cache] counts remain RECORDED and UNGATED (GA-1/GA-3) -- only the written reason changes.'
    - 'dogfood-seed remains SINGLE-LEG ubuntu-only and action-bundle-drift keeps its not.toMatch(/^ {4}if:/m) clause.'
  artifacts:
    - .github/workflows/ci.yml
    - packages/github-cache/src/dogfood-cross-os.spec.ts
  key_links:
    - "dogfood-verify's `needs: dogfood-seed` + the default success() status check: a SKIPPED seed cleanly SKIPS verify (the fork-PR path) rather than queueing or failing it. Both jobs therefore carry the SAME condition."
    - 'The single-line `if:` <-> the single-line `^ {4}if: ...$` regex pin. jobBlock() joins its lines with \n, so a folded or wrapped multi-line YAML scalar silently breaks the pin. Prettier is MEASURED not to rewrap the one-line form.'
    - 'nx.json:70 puts ci.yml in targetDefaults.test.inputs -- that is what lets this spec re-run instead of replaying a cached PASS computed against an older ci.yml.'
---

<objective>
Close CR-18 ("Windows reuse legs are RECORDED, never GATED") by un-push-gating the already-sound
`dogfood-seed` / `dogfood-verify` cross-OS proof so it runs on same-repo pull requests, pinning the
new trigger from disk, and correcting the EIGHT stale prose sites that claim otherwise.

Purpose: cross-OS reuse currently has no pre-merge signal. Gating the three Windows legs' counts
instead would be launderable by a re-run (GA-1), so the sound gate is the run-scoped,
provenance-checked dogfood canary -- it just needs to run on PRs.

Output: two edited files, one commit, a spec clause that goes RED on a silent revert.
</objective>

<execution_context>
@~/.claude/gsd-core/workflows/execute-plan.md
</execution_context>

<context>
@.planning/quick/260801-vyy-resolve-cr-18/260801-vyy-CONTEXT.md
@.planning/quick/260801-vyy-resolve-cr-18/260801-vyy-RESEARCH.md
@.github/workflows/ci.yml
@packages/github-cache/src/dogfood-cross-os.spec.ts
</context>

<hard_constraints>
Read these before the first edit. Each one is a decision, not an omission.

- Do NOT gate the three Windows legs' `[remote cache]` counts. Ungated is the DECISION (GA-1):
  those legs write through a writable sidecar, so a broken cross-OS restore makes them MISS,
  execute, and SAVE their own entry -- a re-run then HITs that self-produced entry and a
  `count >= 1` gate goes green with cross-OS reuse dead.
- Do NOT give `dogfood-seed` a Windows leg. Single-leg ubuntu-only is the VACUITY CONDITION and
  the spec pins it.
- Do NOT touch `nx.json`.
- Do NOT weaken `action-bundle-drift`'s `.not.toMatch(/^ {4}if:/m)` clause while correcting its
  prose. The clause is correct and load-bearing; only the surrounding words change.
- Do NOT write "GitHub evicts PR caches when the PR closes" anywhere. RESEARCH refutes it:
  eviction is 7-day-unaccessed and the 10 GB LRU cap only.
- Do NOT widen to fork PRs.
- Do NOT add a `${{ }}` wrapper to the new `if:`. The bare form is correct for a `github.`-leading
  expression and matches every other bare gate in the file; the wrapper marks `!`-leading ones.
- Do NOT touch `ci.yml:1497-1498` or `:1212-1213` ("Every job carrying `if: github.event_name ==
  'push'` does so because it WRITES"). That statement is imprecise for `publish-verify` both before
  and after this change -- pre-existing, not made worse here, and outside CR-18's scope.
- The Bash tool is Git Bash. Use `git grep` for tracked files and `rg` for pipe filtering, never
  `grep` as a standalone command. ASCII only -- `--`, never an em dash.
- `git commit -m` fails on this D: drive (ReFS, COMMIT_EDITMSG EINVAL). Use `git commit -F <file>`
  with the message written by the Write tool.
</hard_constraints>

<tasks>

<task type="auto">
  <name>Task 1: Widen the dogfood trigger and correct the five ci.yml stale-claim sites</name>
  <files>.github/workflows/ci.yml</files>
  <action>
Six edits in one file. Line numbers are from HEAD; re-locate by content, not by number.

(1) THE TRIGGER, per D-GA-1 and D-GA-2. Replace the `if:` on BOTH dogfood jobs -- `dogfood-seed`
(line 1622) and `dogfood-verify` (line 1687) -- with this exact ONE-LINE form, four-space indented:

    if: github.event_name == 'push' || github.event.pull_request.head.repo.full_name == github.repository

Keep it on ONE LINE. Research measured this repo's prettier leaves the 105-char single-line form
byte-identical, and a wrapped or folded scalar silently defeats the single-line spec pin Task 2
adds. Leave the other two job-level push gates (`publish` at 1735, `publish-verify` at 2089)
untouched -- exactly two `if:` lines change.

Put both jobs on the same condition even though `needs: dogfood-seed` plus the default `success()`
would already skip verify when seed skips. Belt-and-braces, and it matches the file's existing
`publish` / `publish-verify` pairing.

(2) THE HEADER BLOCK (lines ~1615-1617), stale site 5. It currently says both jobs run ONLY on the
default-branch push trigger because the write gate trusts no other trigger. False on both halves:
`HOST_GATED_EVENTS` in `lib/trust.ts:34` admits `pull_request`, and `isWriteTrusted` returns
trusted for it on github.com. Replace with the accurate account:
  - both jobs also run on SAME-REPO pull requests, so the cross-OS proof is pre-merge;
  - fork PRs are deliberately excluded -- name it so it does not read as an oversight -- because
    fork `pull_request` cache behaviour is CITED from GitHub's docs but never reproduced in this
    repo, and merged code still gets the push path;
  - PR writes land in the merge-ref scope, invisible to main's cache, and age out under the
    standard 7-day-unaccessed policy.

(3) THE THREE LEGS' "no signal anywhere" SENTENCE (lines 527, 600, 673), stale sites 1-3. The tee
and record still need justifying, but the reason must stop resting on dogfood-verify being
push-gated. The surviving true argument: dogfood-verify drives a DIRECT scripted PUT/GET on a
run-scoped key, so it never observes whether real Nx `build`/`typecheck`/`test` tasks got remote
HITs -- these per-target records are the only runtime observation of that, and the only cross-OS
signal at all on a fork PR, where the canary is skipped.

(4) THE OBS-04 MISATTRIBUTION (lines 535-537, 608-610, 681-683), stale site 4, three verbatim
copies. Keep "RECORDED, never GATED" and the `|| true` note. Replace only the justification with
the true one from D-GA-1: the count is a LAUNDERABLE signal, because these legs write through a
writable sidecar and a re-run of the same commit HITs the entry a broken run saved itself -- so a
non-zero gate would read as coverage while providing none. State that the run-scoped,
provenance-checked dogfood-verify canary is the gate instead. One clause is worth adding so nobody
re-derives the old reason: `needs:` makes these legs INTRA-run (the ubuntu producer repopulates the
entry seconds earlier in the same run), so the cross-run "first run after a version-affecting
change" argument never applied here. Do not name that argument by its requirement ID.

(5) THE PUBLISH-VERIFY CROSS-REFERENCE (line 2085) -- an EIGHTH site RESEARCH's sweep did not
find. It reads "Mirrors the dogfood-verify shape: push-gated, needs the producer, ...". After edit
(1) that comparison is false. Narrow it: publish-verify mirrors dogfood-verify's `needs`-the-
producer / MISS-fails-loud shape, but publish-verify stays push-only. Verified safe to edit --
nothing in `docs-same-os-claims.spec.ts` pins any `push-gated` or `dogfood-verify` phrase.

Leave the three legitimate remaining `push-gated` mentions alone: lines 209, 992 and 1212 all say
some OTHER job is NOT push-gated, which stays true.
  </action>
  <verify>
    <automated>cd "D:/projects/github/op-nx/github-cache" && npx nx format:check && git diff --numstat -- .github/workflows/ci.yml && [ "$(git grep -c -F "if: github.event_name == 'push' || github.event.pull_request.head.repo.full_name == github.repository" -- .github/workflows/ci.yml)" = "2" ] && [ "$(git grep -c -F 'push-gated' -- .github/workflows/ci.yml)" = "3" ] && ! git grep -q -F 'lesson' -- .github/workflows/ci.yml && ! git grep -q -i -F 'evicts' -- .github/workflows/ci.yml && echo TASK1-OK</automated>
  </verify>
  <done>
`nx format:check` is green AND the widened one-line `if:` survived it byte-identical (the
occurrence count is still 2 after formatting). Exactly two job-level `if:` lines changed.
`push-gated` is down from 7 occurrences to the 3 legitimate ones; the three `lesson` misattribution
copies are gone; no eviction claim was introduced.
  </done>
</task>

<!-- planner-discipline-allow: push-gated -->
<!-- planner-discipline-allow: lesson -->
<!-- planner-discipline-allow: unobservable pre-merge -->
<!-- planner-discipline-allow: unobservable before a merge -->

<task type="auto" tdd="true">
  <name>Task 2: Pin the new trigger from disk and correct the two spec stale sites</name>
  <files>packages/github-cache/src/dogfood-cross-os.spec.ts</files>
  <behavior>
    - New clause PASSES against the Task 1 tree (both dogfood jobs carry the two-clause `if:`).
    - New clause FAILS if either dogfood job reverts to `if: github.event_name == 'push'`.
    - New clause FAILS if either job's `if:` is authored as a wrapped or folded multi-line scalar.
    - Existing clauses (seed single-leg, verify two-leg matrix, action-bundle-drift no-`if:`) all
      still pass unchanged.
  </behavior>
  <action>
(1) THE NEW PIN, per D-GA-4. Add ONE `it` to the EXISTING `describe('ci.yml dogfood cross-OS
sampling (VER-06)', ...)` block (lines 79-109), after the seed single-leg clause. Prefer that
describe over a new one: its positive control at lines 80-85 already proves the extraction is
non-empty, and `jobBlock` throws on an absent job key, so the new clause inherits both guards
instead of duplicating them.

Assert over `jobBlock('dogfood-seed')` and `jobBlock('dogfood-verify')` with a single regex per job
matching the WHOLE line and BOTH clauses of the disjunction, anchored at FOUR spaces under `/m`:

    /^ {4}if: github\.event_name == 'push' \|\| github\.event\.pull_request\.head\.repo\.full_name == github\.repository\s*$/m

Four spaces because a job's own keys sit one level under the two-space job key -- unanchored, a
step-level `if:` (eight spaces) would satisfy it. Both clauses because a regex matching only the
push half stays GREEN against the exact silent revert this clause exists to catch. Mirror the
positive form of the `.not.toMatch(/^ {4}if:/m)` idiom at line 289.

Give it a reason string carrying the argument, in the house style: reverting to push-only reopens
CR-18 with every other clause in this file still green; fork PRs are excluded on purpose; the `if:`
must stay ONE LINE because `jobBlock` joins with `\n` and a folded scalar defeats a single-line
anchor. Build the string INSIDE the `it` callback and keep it SELF-CONTAINED -- do not append
`RENAME_NOTE`. The reason is LOCAL CONSISTENCY, not a language constraint: the sibling seed clause
at lines 97-108 also omits it, and that is the pattern to copy. (`RENAME_NOTE` would in fact
resolve fine from an `it` body despite being declared at line 630 -- `it` callbacks are deferred to
the run pass, long after the module's top-level `const`s initialize. It is simply not the idiom
this describe uses.)

Add no comment-phrase assertion here: `codeLines` strips every `#` line, so a prose lock in this
file is vacuous by construction.

(2) THE `cacheObservation` REASON STRING (lines 685-695), stale site 6. Two sentences are wrong
now. Replace the "dogfood-verify is push-gated, so the bump PR merges with no signal anywhere"
clause with the Task-1(3) argument: dogfood-verify's scripted PUT/GET never observes real Nx task
reuse, and it is skipped on fork PRs. Replace the closing "the count is deliberately not gated
because reddening on a legitimate zero" clause with the Task-1(4) laundering argument. Keep the
clause's actual subject unchanged -- it is about the RECORD existing, never its VALUE -- and keep
the trailing `${RENAME_NOTE}`.

(3) THE `action-bundle-drift` PROSE (line 261 doc comment, and lines 287-288 inside a LIVE
assertion message), stale site 7 -- the one that ships a falsehood inside the suite's own failure
output. Both say gating on push is the same gate that leaves VER-06 and OBS-04 unobserved until a
merge; after Task 1 that is false for VER-06. Narrow BOTH to OBS-04 alone and note that VER-06
became PR-observable in this commit. Leave `.not.toMatch(/^ {4}if:/m)` and the rest of the
assertion message exactly as they are.

The two halves are worded DIFFERENTLY on disk and must be located separately -- `:261` ends
"pre-merge" on a single JSDoc line, `:288` ends "before a merge" and its wording is split across a
string-concatenation break. Fixing only the one a whole-phrase search finds is the failure mode
this task's `<verify>` uses two needles to catch.
  </action>
  <verify>
    <automated>cd "D:/projects/github/op-nx/github-cache" && npx nx run-many -t test typecheck lint --skip-nx-cache && npx nx format:check && ! git grep -q -F 'push-gated' -- packages/github-cache/src/dogfood-cross-os.spec.ts && ! git grep -q -F 'lesson' -- packages/github-cache/src/dogfood-cross-os.spec.ts && ! git grep -q -F 'unobservable pre-merge' -- packages/github-cache/src/dogfood-cross-os.spec.ts && ! git grep -q -F 'unobservable before a merge' -- packages/github-cache/src/dogfood-cross-os.spec.ts && [ "$(git grep -c -F 'not.toMatch(/^ {4}if:/m)' -- packages/github-cache/src/dogfood-cross-os.spec.ts)" != "0" ] && echo TASK2-OK</automated>
  </verify>
  <done>
`test`, `typecheck` and `lint` are green with the cache skipped, and the suite's `it` count is
exactly one higher than the 940 at HEAD. All FOUR stale literals are gone from the spec, and
`action-bundle-drift`'s absence clause is still present verbatim.

WHY FOUR NEEDLES AND NOT ONE. `git grep` is line-oriented, and site 7's two halves are worded
DIFFERENTLY on disk: `:261` reads `unobservable pre-merge` inside a JSDoc line, while `:288` reads
`unobservable before a merge` and is split across a string-concatenation break (`...VER-06 and ' +`
/ `'OBS-04 unobservable before a merge.'`). A single needle spanning that break can never match the
live assertion message -- it would return TASK2-OK with the falsehood still shipping inside the
suite's own failure output, which is precisely the cannot-fail-for-its-stated-reason defect this
review round just closed as CR-12. Each of the two needles above was measured to isolate exactly
one site.
  </done>
</task>

<task type="auto">
  <name>Task 3: Prove the new pin is non-vacuous, run the full battery, commit</name>
  <files>.github/workflows/ci.yml, packages/github-cache/src/dogfood-cross-os.spec.ts</files>
  <action>
(A) NON-VACUITY, TWICE. This repo mutation-tests every new guard -- a pin that cannot fail is the
CR-12 defect this same review round just fixed. Run the mutation for EACH job separately, so a
clause that only pins one of the two is caught:

  1. Edit `.github/workflows/ci.yml` and revert ONLY `dogfood-seed`'s `if:` to
     `if: github.event_name == 'push'`. Run
     `npx nx run @op-nx/github-cache:test --skip-nx-cache`. The new clause MUST fail and its reason
     string MUST print. Restore the widened line and re-run to GREEN.
  2. Repeat for `dogfood-verify` alone. Same RED, same restore-to-GREEN.

Use `--skip-nx-cache` on every mutation run: the mutation rotates the `test` hash, but skipping
removes any doubt about a replayed PASS. After the second restore, confirm
`git diff -- .github/workflows/ci.yml` matches the Task 1 intent exactly -- no mutation residue.

(B) FULL BATTERY, on the restored tree and on the MAIN TREE (a junctioned worktree gives false
bundle drift):

  - `npx nx run-many -t test typecheck lint --skip-nx-cache` -- green.
  - `npx nx format:check` -- green, and the widened `if:` is still one line (re-assert the
    occurrence count is 2).
  - `npm run check:action` -- expected EMPTY. Neither edited file is reachable from `serve()`, so
    the committed `start-cache-server/index.js` must not drift. If it reports drift, STOP and
    report rather than regenerating the bundle -- that would mean something unexpected was touched.

(C) COMMIT. Write the message with the Write tool to
`<scratchpad>/cr18-commit-msg.txt`, then `git commit -F <that path>`. `git commit -m` fails on this
D: drive. Stage the two files BY NAME -- never `git add .` / `-A` / `-u`.

Subject: `ci(12): run the cross-OS dogfood proof on same-repo pull requests`
Body must name: CR-18 as the finding closed; why the three Windows legs stay ungated (launderable
by a re-run, GA-1); why fork PRs are excluded (GA-2); that eight stale prose sites were corrected
in the same commit, one of them a live assertion message; and that the new spec clause was
mutation-proven RED on each job independently. No AI attribution trailers.
  </action>
  <verify>
    <automated>cd "D:/projects/github/op-nx/github-cache" && npx nx run-many -t test typecheck lint --skip-nx-cache && npx nx format:check && npm run check:action && git status --porcelain | rg . ; [ -z "$(git status --porcelain)" ] && git log -1 --stat && echo TASK3-OK</automated>
  </verify>
  <done>
Both mutations were observed RED and reverted, leaving no residue. `test`/`typecheck`/`lint` and
`format:check` are green with the cache skipped, `check:action` reports no bundle drift, the
working tree is clean, and `git log -1 --stat` shows exactly the two intended files in one commit
authored with `-F`.
  </done>
</task>

</tasks>

<verification>
- CR-18 is closed by MECHANISM, not by prose: a same-repo PR now schedules `dogfood-seed` and
  `dogfood-verify`, whose run-scoped key and `'linux'` producer-stamp assertion make the proof
  re-run-safe.
- The gate cannot be silently removed: reverting either job to push-only reddens
  `dogfood-cross-os.spec.ts`, PROVEN by two independent mutations, not asserted.
- Every claim that contradicts the new behaviour is corrected in the SAME commit -- all eight
  sites, including `dogfood-cross-os.spec.ts:287-288` (a live assertion message) and
  `ci.yml:2085` (found during planning, absent from RESEARCH's sweep of seven).
- Nothing forbidden moved: counts still ungated, seed still single-leg, `nx.json` untouched,
  `action-bundle-drift` still un-gated, no eviction claim planted, no fork-PR widening.
</verification>

<success_criteria>
- Exactly two `if:` lines in `ci.yml` changed, both to the same one-line two-clause form.
- `npx nx run-many -t test typecheck lint --skip-nx-cache` green; `it` count = 941 (940 + 1).
- `npx nx format:check` green with the `if:` unwrapped.
- `npm run check:action` reports no drift.
- `git grep -c -F 'push-gated' -- .github/workflows/ci.yml` = 3 (was 7); 0 in the spec.
- Zero occurrences of the OBS-04 misattribution, and zero of BOTH site-7 wordings -- `unobservable
  pre-merge` (the `:261` JSDoc) and `unobservable before a merge` (the `:288` assertion message).
  Two needles, because the second is split across a string-concatenation break and no single
  line-oriented needle reaches it.
- One commit, message written via the Write tool and applied with `git commit -F`.
</success_criteria>

<output>
No SUMMARY file -- this is a quick task. Report back: the commit SHA, the two mutation RED
observations, and the final `it` count.
</output>
