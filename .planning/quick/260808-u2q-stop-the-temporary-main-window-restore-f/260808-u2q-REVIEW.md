---
task: 260808-u2q-stop-the-temporary-main-window-restore-f
reviewed: 2026-08-08
depth: quick
diff_range: 71773ee..0cd43b4
files_reviewed: 3
files_reviewed_list:
  - .github/workflows/ci.yml
  - packages/github-cache/src/dogfood-cross-os.spec.ts
  - AGENTS.md
findings:
  critical: 0
  high: 1
  medium: 4
  low: 6
  total: 11
blocks: false
status: issues_found
---

# 260808-u2q: Code Review Report

**Reviewed:** 2026-08-08
**Depth:** quick (widened to full read of the changed hunks and independent re-measurement,
because the change cannot be behaviourally tested before it ships)
**Files reviewed:** 3
**Status:** issues_found -- nothing BLOCKS

## Summary

**The gate itself is correct.** `if: ${{ !cancelled() && github.event_name == 'push' &&
!github.event.forced }}` is valid YAML, valid GitHub Actions expression syntax, and safe
against the absent-property case. The `needs:` cascade is correct and its single downstream
edge behaves as claimed. The spec's positive control still pins the whole expression rather
than loosening to a substring. I could not construct a fail-OPEN path through the gate that
is reachable on this repository.

What does not survive review is a **measured number in the rationale comment**. The comment
claims "Five of the restore-shaped runs concluded `success` and completed their uploads."
Independent re-measurement puts it at **four**. The fifth success is the PR #7 merge push --
the one push in that set the comment itself says SHOULD have published. The figure was
carried from RESEARCH.md's "12 push runs with headSha == fe25a3f (11 restores + the merge)
... 5 success" with the merge silently folded into the restore count. This is the exact
defect class the task brief flags as this project's documented history.

Separately, the `AGENTS.md` capture idiom is **wrong for the use case it names**. It
prescribes `exit ${PIPESTATUS[0]}` for "the acceptance-command battery, or any repeat/loop
of a single target". `exit` terminates the shell, so inside a loop it runs exactly ONE
iteration and returns 0. An operator following it would believe they ran the battery N times
having run it once, with a clean green exit. Demonstrated below, not reasoned.

---

## HIGH

### HI-01: The comment's "Five ... restore-shaped runs" is FOUR

**File:** `.github/workflows/ci.yml:2198-2199`

**Issue:** The comment states:

```
#   .planning/debug/publish-verify-422-empty-shard.md; do not conflate the two. Five of the
#   restore-shaped runs concluded `success` and completed their uploads.
```

Re-measured independently. There are 12 `push` workflow runs at `headSha == fe25a3f`, of
which 5 concluded `success`:

```
gh run list --branch main --workflow ci.yml --limit 200 \
  --json databaseId,headSha,conclusion,event,createdAt
  -> 12 push runs at fe25a3f: {"failure":7,"success":5}
     30200859202 success 2026-07-26T11:49:29Z   <-- the MERGE run
     30401077417 success 2026-07-28T21:32:20Z
     30473116345 success 2026-07-29T16:57:22Z
     30501074211 success 2026-07-29T23:55:47Z
     30608793890 success 2026-07-31T06:08:54Z
```

The events feed gives a 1:1 mapping from those 12 runs to 12 pushes, and identifies the
earliest one as the merge, not a restore:

```
gh api repos/op-nx/github-cache/events --paginate
  -> 12 pushes with head == fe25a3f, earliest:
     2026-07-26T11:49:28Z  e56e5d2 -> fe25a3f
gh pr view 7 --json mergedAt,mergeCommit
  -> mergedAt 2026-07-26T11:49:27Z, mergeCommit fe25a3f865f2...
```

The push at 11:49:28Z is one second after PR #7 merged, and its `before` is `e56e5d2`, the
merge's parent -- it IS the merge push, and run `30200859202` was created two seconds later.
`fe25a3f` did not exist before that moment, so no restore to it can predate it.

**Therefore: 4 restore-shaped runs succeeded, not 5.** The fifth success is the legitimate
merge push that the same comment paragraph explicitly says "SHOULD have published". The
comment counts a correct publish as an incident.

Origin of the error: RESEARCH.md:105-106 reads "12 push runs with `headSha == fe25a3f`
(11 restores + the merge), 7 of them `failure`, 5 `success`". The implementation attributed
all 5 successes to the 11 restores.

This matters beyond pedantry: it is the figure an operator uses to size the harm against the
1000-asset monthly shard cap, and the surrounding comment is the only place that reasoning
lives.

**Fix:**

```yaml
  #   already-documented burned-shard defect in
  #   .planning/debug/publish-verify-422-empty-shard.md; do not conflate the two. FOUR of the
  #   eleven restore-shaped runs concluded `success` and completed their uploads (the fifth
  #   `success` among the twelve runs at this SHA is the PR #7 merge push above, which was
  #   correct). Seven failed, most of them on the burned-shard 422.
```

---

## MEDIUM

### ME-01: `exit ${PIPESTATUS[0]}` runs ONE loop iteration, then exits 0

**File:** `AGENTS.md:80-86`

**Issue:** The section is titled "Capturing test-battery output" and its first sentence
scopes it to "the acceptance-command battery, or any repeat/loop of a single target". The
prescribed idiom is:

```bash
npm run test 2>&1 | tee "test-$(date +%s).log"; exit ${PIPESTATUS[0]}
```

`exit` terminates the shell. Placed in a loop, the first iteration ends the loop -- and when
that iteration SUCCEEDS it exits 0, so the truncation is silent and reads as a clean pass.
Executed, not reasoned:

```bash
bash -c 'for i in 1 2 3; do echo "iter $i"; true 2>&1 | tee /dev/null >/dev/null; exit ${PIPESTATUS[0]}; done; echo "LOOP COMPLETED"'
# iter 1
# outer saw exit=0        <- iters 2 and 3 never ran; "LOOP COMPLETED" never printed
```

The core mechanic the section is about IS correct in isolation -- `PIPESTATUS[0]` propagates
and plain `tee` masks:

```bash
bash -c 'bash -c "exit 42" 2>&1 | tee /dev/null >/dev/null; exit ${PIPESTATUS[0]}'  # -> 42
bash -c 'bash -c "exit 42" 2>&1 | tee /dev/null >/dev/null'                          # -> 0
```

So the diagnosis is right and only the packaging is wrong. Given the section exists precisely
because a battery loop silently discarded evidence once, shipping an idiom that silently
truncates the same battery is the same failure wearing a different hat.

**Fix:** capture into a variable instead of exiting, so it composes with a loop, and give the
single-run form separately:

````markdown
```bash
# In a loop -- capture, never `exit`, or the first iteration ends the run:
for i in 1 2 3 4 5; do
  npm run test 2>&1 | tee "test-$(date +%s%N).log"
  status=${PIPESTATUS[0]}
  echo "iteration $i -> ${status}"
done

# One-shot in a script, where terminating IS the intent:
npm run test 2>&1 | tee "test-$(date +%s%N).log"; exit ${PIPESTATUS[0]}
```
````

Note `PIPESTATUS` must be read on the very next command -- it is clobbered by every
subsequent one, including the `echo`.

### ME-02: `date +%s` collides at one-second granularity and destroys the logs

**File:** `AGENTS.md:80`

**Issue:** `tee "test-$(date +%s).log"` names the log by whole seconds. Iterations inside the
same second overwrite each other, so the section built to preserve evidence deletes it:

```bash
bash -c 'for i in 1 2 3; do echo "run $i" | tee "/tmp/pt-$(date +%s).log" >/dev/null; done; ls /tmp/pt-*.log | wc -l; cat /tmp/pt-*.log'
# 1
# run 3          <- runs 1 and 2 gone
```

A full `npm run test` takes longer than a second, but this repo's dominant case is an Nx
replay from cache, which returns in well under one -- and the section's own scope line says
"any repeat/loop of a single target".

**Fix:** `date +%s%N` (nanoseconds), or append the iteration index: `test-${i}-$(date +%s).log`.

### ME-03: The captured logs are not gitignored

**File:** `AGENTS.md:80`

**Issue:** The idiom writes `test-<epoch>.log` into the current working directory -- the
workspace root when following the battery instructions. `.gitignore` enumerates workspace-root
logs one by one (`/build-nx.log`, `/typecheck-nx.log`, `/test-nx.log`, `/lint.log`,
`/hash-parity.log`, `/detector.log`, `/integration-nx.log`, `/o3-witness.log`) and has no
`*.log` catch-all:

```bash
git grep -n -e "log" -- .gitignore   # exit 0, no `*.log` pattern present
```

So every capture leaves a permanently untracked file at the root. `.gitignore:65-75` shows
this project deliberately curates that list; the new idiom bypasses the discipline and
accumulates without bound. The `never git add .` rule limits the damage to `git status` noise,
but noise at the root is exactly what that gitignore block was written to prevent.

**Fix:** add `/test-*.log` to `.gitignore` alongside the existing root-log entries, or direct
the capture somewhere already ignored (`.nx/` is gitignored; a `tmp/` path would need its own
entry).

### ME-04: "separating 23/23 with zero misclassification" claims a ground truth that was never observed

**File:** `.github/workflows/ci.yml:2187-2193`

**Issue:** The push-shape counts are correct -- I re-measured them independently and they
match exactly:

```
gh api repos/op-nx/github-cache/events --paginate
  total events: 292
  PushEvent on refs/heads/main: 70
  head == fe25a3f (11 restores + 1 merge): 12
  before == fe25a3f (window-open):         11
  neither (older):                         47
```

`11 + 11 + 1 = 23`, `23 + 47 = 70`. The comment's arithmetic is sound.

But the same probe returns:

```
has forced field? false
```

The events-API `PushEvent` payload does not carry `forced`. Every row in that record is an
ANCESTRY classification derived from `before`/`head` plus `git merge-base`. Not one `forced`
value was ever read from any payload. "Misclassification" implies a classifier verdict was
compared against a known truth; here there is no truth column. The mapping shape -> `forced`
rests entirely on the wire-protocol argument (RESEARCH.md assumption A1), which is strong but
unobserved.

This does not weaken the change -- both plausible mechanisms for how GitHub computes `forced`
yield `true` for a rewind, and the residual risk is the fail-CLOSED direction. It does mean
the comment reads as more empirical than it is, in a file whose whole value is that its
comments can be trusted.

**Fix:** relabel to what was actually measured:

```yaml
  #   pushes predating that restore point. 23 in the fe25a3f era, and ANCESTRY separates them
  #   23/23 -- every restore a rewind, every open and the merge a fast-forward. NOTE the
  #   `forced` field itself is NOT in the events payload and was never directly observed; the
  #   shape -> `forced` mapping rests on the FORCE-PUSH MECHANISM above. Item 3's window run is
  #   the first direct observation of the field in either direction.
```

---

## LOW

### LO-01: The summary line above still describes the gate as two clauses

**File:** `.github/workflows/ci.yml:2170-2172`

The pre-existing sentence still reads "if: !cancelled() && push -- the mirror runs only on the
trusted push trigger". There are now three clauses. The new block immediately below opens with
"WHY the if: ALSO carries", which repairs it for a linear reader, but a reader who greps for
the gate's summary gets a stale two-clause description.

RESEARCH.md:157-160 recommended "Extend that paragraph; do not add a new trailing block"; the
implementation added a new block. That is defensible for a 47-line rationale, but then the old
one-liner should have been amended.

**Fix:** `# ... (a plain run: step silently MISSes -- verified Phase 2). if: !cancelled() &&
push && !forced -- the mirror runs only on the trusted push trigger and only on a
fast-forward, and isSyncTrusted re-checks ...`

### LO-02: The dedicated spec assertion is a strict subset of the control

**File:** `packages/github-cache/src/dogfood-cross-os.spec.ts:288-303`

Verified both regexes against the real file:

```
control matches:   true
dedicated matches: true
```

But the dedicated regex `/^ {4}if:.*&&\s*!github\.event\.forced\s*\}\}$/m` is weaker than the
control in every dimension. Verified:

```
dedicated passes on gate missing event_name: true
control  passes on gate missing event_name: false
control  on INVERTED clause (`&& github.event.forced`): false
dedicated on INVERTED clause:                           false
```

So it adds a NAME, not coverage -- which is exactly what its own comment claims it is for, so
this is not a defect. The residual risk is narrow: if a future contributor hits the control
failing and "fixes" it by loosening the control regex, the dedicated test keeps passing while
the `event_name` guard is gone. Worth one clause.

**Fix:** tighten the dedicated regex to also require the push guard, so it stands alone:
`/^ {4}if:.*github\.event_name == 'push'.*&&\s*!github\.event\.forced\s*\}\}$/m`

### LO-03: ci.yml says 23/23, RESEARCH.md says 22/22, with no note

`.planning/.../260808-u2q-RESEARCH.md:21` and `:102` state "22 pushes ... separate 22/22" while
listing `11 + 11 + 1`. ci.yml is the CORRECT one (23) and my re-measurement backs it. But the
correction was made silently, so a reader cross-referencing the research doc finds a
contradiction and has no way to tell which won. One clause in the SUMMARY noting the research
figure was an arithmetic slip would close it.

### LO-04: `npm run test --skip-nx-cache` will silently NOT skip the cache

**File:** `AGENTS.md:94-95`

The second habit prescribes `--skip-nx-cache --output-style=stream`, and the snippet above it
uses `npm run test`. An operator combining them writes `npm run test --skip-nx-cache`, which
npm consumes as its own config and never forwards to Nx -- the run replays from cache and the
habit silently does nothing. `npm run test -- --skip-nx-cache --output-style=stream` is
required.

**Fix:** spell the command out with the `--` separator.

### LO-05: A delete-and-recreate restore would fail OPEN

A push that CREATES a ref carries `created: true`, an all-zeros `before`, and `forced: false`.
So restoring `main` by deleting and recreating it would publish. Not reachable here -- GitHub
refuses to delete a repository's default branch -- and RESEARCH.md:253-256 names
`created`/`deleted` as separate fields without drawing this consequence. Recorded so it is not
re-derived as a live hole; no change wanted.

### LO-06: "over a tree that was already mirrored" is imprecise

**File:** `.github/workflows/ci.yml:2177-2178`

The publish job mirrors Actions-cache ENTRIES enumerated at the leg's start, not a tree. On a
restore run those entries include the ones the window tip's jobs had just seeded under `main`,
which the window-open run may have raced past. So the restore run was often mirroring NEW
entries, not re-mirroring an already-mirrored tree. The conclusion is unaffected -- the
SKIP DIRECTION paragraph's recovery argument still holds, because a later publish run
enumerates ALL default-branch entries rather than only that push's -- but the sentence
overstates the redundancy.

---

## Checks that PASSED

Recorded so they are not re-run.

**1. Gate semantics with `forced` absent.** `github.event.forced` on a payload lacking the key
evaluates to null; `!null` is true, i.e. PERMISSIVE. The `github.event_name == 'push'` conjunct
is what protects, and it does so fully: `ci.yml:3-7` declares only `push: branches: [main]` and
`pull_request`. No `workflow_dispatch`, no `merge_group`, no `schedule`. On the only non-push
trigger the first conjunct is already false, and GitHub Actions property access on a missing
key cannot error, so non-short-circuit evaluation is harmless here. The bare form
`!github.event.forced` would be unsafe standing alone; it does not stand alone.

**2. `needs:` cascade.** Exactly one job depends on publish:

```bash
rg -n "^\s*needs:" .github/workflows/ci.yml
#   2477:    needs: publish        <- publish-verify, the only one
```

`publish-verify` (`ci.yml:2475-2477`) carries `if: github.event_name == 'push'` with NO status
function, so the implicit `success()` over `needs` still applies and a SKIPPED publish skips it
-- confirmed programmatically, and corroborated on run 30825636788 where publish FAILED and
publish-verify shows `skipped`. Nothing else in the file references publish in a `needs:`, so
the blast radius is two jobs and there is no `always()`-guarded consumer that would run against
a missing seed.

**3. Spec regexes.** Ran both against the real `ci.yml` through a copy of the spec's own
`jobBlock` extractor: control matches, dedicated matches. `jobBlock('publish')` uses
`^ {2}publish:\s*$` (anchored), so it does NOT capture `publish-verify` -- verified, the
extracted block is 32 lines and contains no `read-back.js`. The control remains fully anchored
(`^ {4}if:` ... `\}\}$`), i.e. it pins the whole expression and did not loosen to a substring.

**4. Comment cross-references.** `.planning/debug/publish-verify-422-empty-shard.md` exists
(42270 bytes). Run id 30825636788 is real and its conclusion is `failure`, matching the
"THE INCIDENT" text. The 70 / 11 / 11 / 1 / 47 / 23 figures all re-measure exactly.

**5. Diff hygiene.** No CRLF anywhere in `ci.yml`. No trailing whitespace introduced
(`git diff | rg " +$"` -> exit 1, genuine no-match, with a positive control confirming the
pipeline works). The diff touches exactly one behavioural line; everything else is comment,
spec, or `AGENTS.md`. `.planning/HANDOFF.json` is also modified in the range -- out of review
scope, and its content is a consistent restatement of the WINDOW PROCEDURE plus the two
directions item 3 must record. No unrelated line swept along.

---

## Verdict

| Severity | Count |
|----------|-------|
| CRITICAL | 0 |
| HIGH | 1 |
| MEDIUM | 4 |
| LOW | 6 |

**Nothing BLOCKS.** The gate is correct in both YAML and Actions semantics, the cascade is
sound, and the spec pins it properly. HI-01 and ME-04 are wrong or overstated claims in the
comment an operator will read before the next window run, so they should be corrected before
that run rather than after. ME-01 through ME-03 should be fixed before the `AGENTS.md` capture
habit is used in anger -- as written it truncates the battery it exists to serve.

---

_Reviewed: 2026-08-08_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: quick_
