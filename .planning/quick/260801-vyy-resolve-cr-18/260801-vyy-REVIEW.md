---
phase: quick/260801-vyy-resolve-cr-18
reviewed: 2026-08-01T22:05:00Z
depth: deep
commit: fee5fbe49c510f0df1af9b28f61289ed3b18663f
files_reviewed: 2
files_reviewed_list:
  - .github/workflows/ci.yml
  - packages/github-cache/src/dogfood-cross-os.spec.ts
findings:
  critical: 1
  warning: 6
  info: 3
  total: 10
status: issues_found
---

# Quick 260801-vyy (CR-18): Code Review Report

**Reviewed:** 2026-08-01
**Depth:** deep (cross-file: `lib/trust.ts`, `lib/select-backend.ts`, `action/index.ts`,
`server/server.ts`, `backend/actions-cache-backend.ts`, `action/index.spec.ts`,
`docs-same-os-claims.spec.ts`, `cleanup.yml`)
**Files Reviewed:** 2 changed; 8 more read to verify the claims they are cited for
**Status:** issues_found

## Summary

The **mechanism** is correct. The widened `if:` is legal, total, and genuinely
fork-excluding; a skipped seed cleanly skips verify; nothing else in the workflow or the
spec tree is invalidated by the trigger change; and the new spec clause is non-vacuous
against the single-job revert it was mutation-tested for. All five of the requester's
explicit review questions were traced to primary evidence in-tree, and four of them come
back clean.

The **prose** does not hold up, which matters more than usual because prose truth IS this
change's deliverable. One replacement sentence -- reproduced in four places, one of them a
live assertion message -- is factually false and contradicts the header block, the action's
own runtime failure text, and the commit's own justification for existing. Five further
sites carrying the very claim the eight-site sweep set out to kill were missed, one of them
six lines below the edited `if:`.

Separately, the new pin has a **proved false-green hole** (probe run, not theorized): a YAML
plain-scalar continuation line appended under the pinned line is invisible to the anchor
while YAML folds it into the condition -- including a widening to fork PRs, which the pin's
own reason string names as "a decision to make, not a drive-by fix".

### Answers to the five review questions

| # | Question | Verdict |
|---|---|---|
| 1 | Is the widened `if:` correct and safe? | **CLEAN.** See "Verified clean" below. |
| 2 | Vacuity of the new spec clause | **TWO HOLES** -- WR-01 (proved false-green), WR-02 (`on:` removal). |
| 3 | Did a correction introduce a NEW false claim? | **YES -- CR-01.** No PR-close eviction claim was planted (that specific trap was avoided). |
| 4 | Are the three legs' new rationales TRUE? | **CLEAN.** Laundering mechanism verified against `actions-cache-backend.ts`. |
| 5 | Anything the change breaks | **Nothing functional.** Six prose/robustness defects (WR-01..WR-06). |

---

## Critical Issues

### CR-01: The replacement sentence is FALSE, and it is the sentence this commit exists to write

**File:** `.github/workflows/ci.yml:527-529`, `:613-615`, `:700-702`
**Also:** `packages/github-cache/src/dogfood-cross-os.spec.ts:722-724` -- **inside a live
assertion message**, i.e. it ships in the suite's own failure output. That is precisely the
defect the commit message celebrates fixing.

**The text:**

> An @actions/cache bump that broke cross-OS restore would leave all three GREEN, hash-parity
> green (it compares hashes, not storage), and **the dogfood canary would not catch it
> either**: dogfood-verify drives a DIRECT scripted PUT/GET on a run-scoped key, so it never
> observes whether a REAL Nx build/typecheck/test task got a remote HIT.

**Issue:** the antecedent of "it" in "would not catch it either" is "an @actions/cache bump
that broke cross-OS restore". `dogfood-verify` catches exactly that. Three independent
in-tree sources say so:

1. `packages/github-cache/src/action/index.ts:427-433` -- the verify branch's own 404
   `setFailed` message: *"suspect the cacheArchivePath archive-path derivation or **a pinned
   @actions/cache upgrade that changed the archive version hash**. This runner is
   `<os>` and the seed leg is `linux`: on a NON-LINUX runner a MISS additionally suggests the
   archive VERSION still differs across OSes."* The action names the bump scenario as its
   own trigger.
2. `.github/workflows/ci.yml:1644-1648` (the header block this same commit edited): the pair
   *"doubles as the **upgrade canary for the exact-pinned @actions/cache dependency**
   (ROBUST-03): a version bump that changes the archive version hash surfaces here as a
   failed verify job."*
3. The commit message itself: *"That pair is already the sound cross-OS gate."* And
   `ci.yml:544-545`, **eight lines below the false sentence in the same step block**: *"The
   run-scoped, provenance-checked dogfood-verify canary **is the gate** instead."* Two
   comments fifteen lines apart now say opposite things.

The false sentence also makes the commit incoherent: if the dogfood canary does not catch a
cross-OS-restore break, widening its trigger to PRs does not close CR-18's stated failure
scenario, and the whole change is unmotivated.

The correct correction was available and is even half-written in the same paragraph. The
ORIGINAL sentence was a **timing** claim (`dogfood-verify` is push-gated, so the bump PR
merges before it fires) -- true then, dead now. The replacement turned it into a **coverage
denial**, which is false. What is true is the narrower pair the paragraph already ends with:
dogfood-verify does not observe a REAL Nx task HIT, and it is skipped on fork PRs.

**Fix** (`ci.yml`, all three legs -- keep the last clause, drop the denial):

```yaml
      # leave all three GREEN, hash-parity green (it compares hashes, not storage). The
      # dogfood canary DOES catch that bump -- its verify leg MISSes and reddens, and
      # since CR-18 it does so on same-repo PRs too -- but it catches a different thing
      # from these records: it drives a DIRECT scripted PUT/GET on a run-scoped key, so it
      # never observes whether a REAL Nx build/typecheck/test task got a remote HIT. These
      # per-target records are the only runtime observation of THAT -- and on a fork pull
      # request, where the dogfood pair is skipped, the only cross-OS signal at all.
```

Mirror the same narrowing in `dogfood-cross-os.spec.ts:722-724` (`'and the dogfood canary
does not cover it either: '` -> `'and the dogfood canary catches the bump but not this: '`).

---

## Warnings

### WR-01: The new pin false-GREENs on a YAML plain-scalar continuation -- including a fork widening

**File:** `packages/github-cache/src/dogfood-cross-os.spec.ts:111-112`

**Issue:** the anchor is `/^ {4}if: ...== github\.repository\s*$/m`. `\s` matches `\n` and
`$` under `/m` matches at end of ANY line, so the engine satisfies `\s*$` by consuming zero
characters and matching at the end of the pinned line -- it never inspects what follows. YAML
plain scalars continue onto more-indented following lines, so a continuation changes the
effective condition while the pin stays green.

**Measured, not theorized** (probe against the exact regex from `:112`):

```
baseline (want true)       : true
continuation (want FALSE)  : true   <-- FALSE GREEN
appended-or (want false)   : false
reordered (want false)     : false
!= mutation (want false)   : false
```

where `continuation` is:

```yaml
    if: github.event_name == 'push' || github.event.pull_request.head.repo.full_name == github.repository
      && false
```

Two concrete drifts this admits: `&& false` (the jobs never run again -- CR-18 reopens with
the pin green), and `|| github.event.pull_request.head.repo.fork` (fork PRs admitted -- the
exact widening the reason string at `:121-124` calls "a decision to make, not a drive-by
fix"). The reason string only anticipates a wrapped scalar going RED; it does not anticipate
an appended continuation going GREEN.

**Fix** -- anchor the whole scalar by requiring the next line to be a key, not a
continuation:

```ts
const trigger =
  /^ {4}if: github\.event_name == 'push' \|\| github\.event\.pull_request\.head\.repo\.full_name == github\.repository[ \t]*(?:\n {0,4}\S|\n?$)/m;
```

Or, simpler and stricter -- exact line membership plus a shape check:

```ts
const IF_LINE =
  "    if: github.event_name == 'push' || github.event.pull_request.head.repo.full_name == github.repository";
const lines = jobBlock('dogfood-seed').split('\n');
expect(lines, reason).toContain(IF_LINE);
expect(lines[lines.indexOf(IF_LINE) + 1] ?? '', reason).toMatch(/^ {0,4}\S/);
```

### WR-02: The pin cannot see the trigger it claims to pin -- removing `pull_request` from `on:` stays green

**File:** `packages/github-cache/src/dogfood-cross-os.spec.ts:110-133`; subject
`.github/workflows/ci.yml:3-7`

**Issue:** the clause is titled *"both dogfood jobs are **SCHEDULED** on same-repo pull
requests"* and its reason string asserts *"Reverting either job to push-only reopens CR-18
... and every other clause in this file would stay green while it did."* But the assertion
only proves each job's `if:` **permits** a PR run. Deleting `pull_request:` from the
workflow-level `on:` block (`ci.yml:7`) leaves both `if:` lines byte-identical, reopens CR-18
completely (and takes every other PR gate with it), and this clause plus every other clause
in the tree stays GREEN. Verified: no spec in the repo asserts anything about `ci.yml`'s `on:`
block --

```
git grep -n -e "branches:" -e "^on:" -- packages/github-cache/src/**/*.spec.ts   # exit 1
```

(positive control: the same sweep DOES find `windows-regression-detector.spec.ts:95`, which
pins its own workflow's triggers -- so the zero is a real absence, not a broken needle.)

That title/reason overclaim is the "cannot-fail-for-its-stated-reason" defect the clause
itself warns about, one level up.

**Fix:** add a second, cheap expectation on the raw file (it must be raw, not `codeLines` --
the `on:` block is not inside any `jobBlock`), and narrow the title:

```ts
it('ci.yml is PR-triggered at all, which is the precondition the CR-18 job gates rely on', () => {
  expect(rawCiYml, 'Deleting `pull_request:` from ci.yml `on:` reopens CR-18 with every ' +
    'job-level `if:` still byte-correct and every clause in this file still green.')
    .toMatch(/^on:\n(?: .*\n)*? {2}pull_request:/m);
});
```

### WR-03: `dogfood-seed`'s own timeout comment still calls it push-only -- six lines below the edited `if:`

**File:** `.github/workflows/ci.yml:1676-1685`

**Issue:** still reads *"WHY THIS JOB AND THE TWO PUBLISH JOBS, and not every job in the
file: these three are the **push-only background ones**. **Nobody watches them the way a PR
author watches a check**, so a hang here is invisible rather than merely slow."* and then
enumerates *"The short PR gates (format-check, lint, fallow, action-bundle-drift, pack-check,
ppe) are still uncapped"* -- a list that now omits `dogfood-seed`, which just became a PR
gate. Both sentences are false as of this commit, and they sit immediately under the line
that made them false. This is the highest-visibility miss in the eight-site sweep.

**Fix:**

```yaml
    # WHY THIS JOB AND THE TWO PUBLISH JOBS: the publish pair is push-only background work
    # nobody watches, and this job -- PR-visible since CR-18 -- inherited the same cap when
    # it was. Keeping it is strictly correct either way: a capped PR check fails loud, an
    # uncapped one hangs. The short PR gates (format-check, lint, fallow,
    # action-bundle-drift, pack-check, ppe) are still uncapped and deliberately so.
```

### WR-04: Two more live sites still call the Windows verify leg "push-gated ... unobservable before a merge"

**File:** `packages/github-cache/src/action/index.spec.ts:78` and `:471`

**Issue:** `:78` -- *"The substitution reddens only the live `dogfood-verify
(windows-11-arm)` leg, which is **push-gated to `main` and therefore unobservable before a
merge**."* This is the stated justification for the `vi.mock('../lib/release-asset-name.js')`
sampling-rate fix. `:471` -- *"it would do so on EVERY runner rather than only on the
**push-gated** Windows leg."* Both are false as of this commit. `:78`'s is load-bearing: a
reader can now use it to argue the mock is unnecessary, which is exactly the
"false-comment-as-standing-argument-for-undoing-the-work" failure mode the commit message
invokes. The file was outside the diff, but the sweep claimed to be exhaustive over this
exact claim.

**Fix** (`:78`): `"...leg, which before CR-18 was push-gated and unobservable pre-merge, and
even now is skipped on fork PRs -- so the property is still sampled at a rate this spec has
to backstop."` (`:471`): drop "push-gated", keep "the Windows leg".

### WR-05: The "carries the push gate because it WRITES" rule now cites a job that no longer carries it

**File:** `.github/workflows/ci.yml:209-211`, `:1254-1256`, `:1539-1541`

**Issue:** two sites state *"Every job in this file that carries that gate does so because it
WRITES (**seeds a cache entry**, publishes a release asset)"*, and a third says *"NOT
push-gated, **unlike the proof jobs**"*. The "seeds a cache entry" exemplar is `dogfood-seed`,
which stopped carrying the bare gate in this commit; and "the proof jobs" now includes a
PR-eligible pair. Post-change the surviving bare-`push` jobs are `consumer-smoke` (writes),
`publish` (writes) and `publish-verify` (**read-only** -- so the rule was already false there
before this commit, and is now false on both halves).

**Fix** (`:1255` and `:1540`): `does so because it WRITES (publishes a release asset,
round-trips through a write-trusted sidecar) or because it reads back something only the
push path produces (publish-verify).` And at `:209`: `NOT push-gated -- like the dogfood
proof pair since CR-18, and unlike the publish pair.`

### WR-06: The concurrency rationale now under-describes what a cancelled PR run can interrupt

**File:** `.github/workflows/ci.yml:17-24`

**Issue:** *"On a `push` to main this workflow WRITES: `publish` uploads Release assets and
`dogfood-seed` PUTs a cache entry. Cancelling one of those mid-upload is how a shard acquires
a zero-byte asset ... Push runs therefore queue rather than cancel; only pull-request runs,
which write nothing outside their own merge-ref cache scope, are superseded."* The trailing
qualifier keeps this literally true, but the enumeration now reads as "only push runs
perform the `dogfood-seed` PUT", which is false -- and PR runs are the ones that DO get
cancelled mid-flight. A reader auditing "can cancellation interrupt a write?" is handed the
wrong answer. `260801-vyy-RESEARCH.md:108-117` identified this and recommended "a one-clause
note is cheap insurance"; the note was not written.

The underlying behaviour is safe, and the reason should be recorded rather than re-derived:
the seed key is `nx-cache-<GITHUB_RUN_ID>`, so a torn PR-side upload leaves at most an absent
entry under a run id that is never reused -- there is no first-write-wins filename
arbitration to poison, which is the specific hazard this block reserves
cancellation-avoidance for.

**Fix:** append to line 24: `dogfood-seed now PUTs on same-repo PR runs too, and those ARE
cancellable -- safely, because its key is nx-cache-<GITHUB_RUN_ID>: a torn upload leaves an
absent entry under a run id that is never reused, with no filename arbitration to poison.`

---

## Info

### IN-01: The pin's reason string asserts an unverified property of an external tool

**File:** `packages/github-cache/src/dogfood-cross-os.spec.ts:126-127`
**Issue:** *"prettier is MEASURED not to rewrap the one-line form."* Nothing re-measures this.
`ci.yml` is not in `.prettierignore`, so a future prettier bump that rewraps the 106-char
`if:` would make `nx format:check --all` rewrite it and this clause go RED carrying a message
asserting that cannot happen. (Confirmed green today: `npx prettier --check` passes on both
files.)
**Fix:** qualify -- `measured against the prettier version pinned at the time of writing; if
a bump rewraps it, fix the pin, do not delete it.`

### IN-02: "seconds earlier in the SAME run" overstates the intra-run gap

**File:** `.github/workflows/ci.yml:547-548` (and the two copies at `:631-632`, `:718-719`)
**Issue:** the ubuntu `build`/`typecheck`/`test` producers are multi-minute jobs, so the
producer repopulates the entry *minutes* earlier, not seconds. The argument (intra-run, so
the cross-run OBS-04 lesson does not transfer) is sound and unaffected; only the number is
wrong. On a branch whose theme is retiring inaccurate comments, a throwaway inaccurate number
is worth not writing.
**Fix:** `earlier in the SAME run`.

### IN-03: The corrected block is now 14 duplicated lines x 3, tripling the next correction's blast radius

**File:** `.github/workflows/ci.yml:538-552`, `:624-638`, `:711-725` (verbatim x3), and
`:521-531`, `:607-617`, `:694-704` (verbatim x3)
**Issue:** the RECORDED/never-GATED rationale grew from 4 lines to 14 and is copy-pasted three
times; the teed-output rationale is 11 lines x 3. `git grep -c "LAUNDERABLE gate rather than
coverage"` -> 3; `git grep -c "the dogfood canary would not catch it either"` -> 3. CR-01 must
now be fixed in three places instead of one, and this commit's own eight-site sweep is
evidence that N-copy prose drifts partially. The three legs already use "see the build job
above" for the sidecar block (`:488`, `:575`).
**Fix:** keep the full rationale on `build-windows` and reduce `typecheck-windows` /
`test-windows` to `# RECORDED, never GATED -- rationale in full on build-windows above
(launderable count, intra-run producer).`

---

## Verified clean (traced, not assumed)

- **The `if:` expression.** Bare (unwrapped) form is correct and is house style: the only
  `${{ }}`-wrapped `if:`s in the file (`:1039`, `:1611`, `:1925`) are the ones starting with
  `!`, which YAML reserves. Nonexistent-property dereference on a `push` event yields an
  empty string, so the RHS is total whether or not `||` short-circuits; `'' == 'op-nx/...'`
  is false. The `on:` block admits only `push` (branches: main) and `pull_request`, so the
  disjunction is exhaustive over reachable events.
- **Fork exclusion is genuine.** `head.repo.full_name` carries the owner, so no fork can
  produce `op-nx/github-cache`; `github.event_name` is `pull_request`, never `push`, on a
  fork PR. `pull_request_target` is not in `on:`. Not satisfiable by a fork.
- **No PR-close eviction claim was planted.** `git grep -i -e evict -e "when the PR closes"
  -e "pull request is closed"` over both files: exit 1 (positive control on the same files:
  `merge-ref scope` -> 2 hits). The header block says "ageing out under the standard
  7-day-unaccessed policy", which is correct. The RESEARCH CONTRADICTION was respected.
- **The header block's trust claim is true.** `lib/trust.ts:34` `HOST_GATED_EVENTS =
  ['pull_request', 'release']`; `:92-97` returns `{trusted:true}` for it when
  `hostSupportsWidenedTrust` passes (github.com). `lib/select-backend.ts:32` is the sole
  consumer, so a same-repo PR really does get the writable Actions backend.
- **The laundering rationale is TRUE.** A broken cross-OS restore is an archive-VERSION
  mismatch, so the Windows leg's own save lands under a different version -> no 409 -> a real
  self-produced entry -> a same-commit re-run HITs it -> `count >= 1` green with cross-OS
  reuse dead. Confirmed against `backend/actions-cache-backend.ts:245-278` and
  `server/server.ts:261-270`.
- **A skipped seed cleanly skips verify.** `dogfood-verify` carries no status-check function,
  so the default `success()` still applies on top of the custom `if:`; a skipped need skips
  its dependents. Nothing else in the file `needs:` either dogfood job.
- **Re-runs are safe** (checked because `cancel-in-progress` makes PR re-runs routine). A
  re-run keeps `github.run_id`, so `dogfood-seed` re-PUTs an existing key; `saveCache` returns
  `-1`, the `lookupOnly` probe finds the entry present, the backend answers `'stored'` and the
  server returns 200. No spurious red. (`actions-cache-backend.ts:245-272`.)
- **No other consumer is invalidated.** `publish` enumerates cache entries scoped to
  `refs/heads/main`, so PR merge-ref entries are invisible to the mirror
  (`action/index.ts:80-84`). `cleanup.yml` touches Release assets only -- "No actions:read --
  cleanup lists no Actions caches" -- so the new PR entries are outside its reach.
  `docs-same-os-claims.spec.ts`'s `DOCS_08_SITES` ci.yml rows pin phrases none of which land
  on an edited line. `o3-witness` already filters by ref because "ONE hash holds TWO entries
  on TWO DIFFERENT refs". The "twenty-two jobs" count is unchanged.
- **The pin resists the mutations it claims to.** Probe-confirmed RED for `!=`, for reordered
  disjuncts, and for an appended `|| true`. `codeLines` strips `#`-lines, so commenting the
  `if:` out also reddens. Suite green: 57/57 in `dogfood-cross-os.spec.ts`.
- **Formatting/tree.** `npx prettier --check` passes on both files. `git status --short`
  clean apart from this untracked planning directory.

---

_Reviewed: 2026-08-01_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
